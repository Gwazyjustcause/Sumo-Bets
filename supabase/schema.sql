create table if not exists public.shared_drafts (
  basho_id text primary key,
  revision bigint not null default 0,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_drafts enable row level security;

drop policy if exists "Public draft reads" on public.shared_drafts;
create policy "Public draft reads"
on public.shared_drafts for select
to anon, authenticated
using (true);

revoke insert, update, delete on public.shared_drafts from anon, authenticated;
grant select on public.shared_drafts to anon, authenticated;

create or replace function public.save_shared_draft(
  p_basho_id text,
  p_expected_revision bigint,
  p_document jsonb
)
returns table (basho_id text, revision bigint, document jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_revision bigint := p_expected_revision + 1;
begin
  if p_basho_id is null or p_basho_id = '' then
    raise exception 'INVALID_BASHO_ID' using errcode = '22023';
  end if;

  update public.shared_drafts as drafts
  set revision = next_revision,
      document = p_document || jsonb_build_object('bashoId', p_basho_id, 'revision', next_revision),
      updated_at = now()
  where drafts.basho_id = p_basho_id
    and drafts.revision = p_expected_revision;

  if not found and p_expected_revision = 0 then
    insert into public.shared_drafts (basho_id, revision, document)
    values (
      p_basho_id,
      next_revision,
      p_document || jsonb_build_object('bashoId', p_basho_id, 'revision', next_revision)
    )
    on conflict on constraint shared_drafts_pkey do nothing;
  end if;

  if not found then
    raise exception 'STALE_DRAFT_REVISION' using errcode = '40001';
  end if;

  return query
  select drafts.basho_id, drafts.revision, drafts.document
  from public.shared_drafts as drafts
  where drafts.basho_id = p_basho_id;
end;
$$;

revoke all on function public.save_shared_draft(text, bigint, jsonb) from public;
grant execute on function public.save_shared_draft(text, bigint, jsonb) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.shared_drafts;
exception
  when duplicate_object then null;
end $$;
