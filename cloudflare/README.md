# Shared storage migration

The replacement runs on a Cloudflare Worker with one D1 database. The existing
GitHub Pages site stays in place. Browsers check the draft and lifecycle documents
every 15 seconds, and existing app code still merges player edits and retries
revision conflicts. No Cloudflare API token is shipped to browsers.

The site now uses this backend. The legacy Supabase transport files remain for
read-only exports and rollback. They are not loaded by the site.

## Deploy and copy the existing game

Run these commands from the repository root with a signed-in Cloudflare account:

```powershell
npx wrangler login
npx wrangler d1 create sumo-battle
```

Put the returned database ID in `cloudflare/wrangler.jsonc`, then run:

```powershell
npx wrangler d1 execute sumo-battle --remote --file=cloudflare/schema.sql --config=cloudflare/wrangler.jsonc
node scripts/export-shared-drafts.mjs
```

The exporter reads every source row, including past drafts and the lifecycle
document. It writes a dated JSON backup and SQL import under ignored `backups/`.
It does not change the source. Pause both players' editing during the final export
and cutover so no save is left behind on the old backend.

Use the actual dated output directory from the export:

```powershell
npx wrangler d1 execute sumo-battle --remote --file=backups/DATE/import.sql --config=cloudflare/wrangler.jsonc
npx wrangler deploy --config=cloudflare/wrangler.jsonc
```

Before changing the site, compare every source document and revision with
`GET https://YOUR-WORKER.workers.dev/drafts/ENCODED-BASHO-ID`. Include the
`sumo-battle-lifecycle` row. Confirm a stale write returns HTTP 409. Import uses
plain INSERT so it refuses to overwrite existing destination records.

## Cut over

Enable the configuration in `shared-config.js`, using the deployed Worker URL.
Set `provider: "cloudflare"` and `pollMs: 15000`.

After verifying migration, remove the Supabase CDN script, `supabase-config.js`
script, and `shared-draft.js` script from `index.html`. Load `shared-config.js`
and `cloudflare-draft.js` before `app.js`. Update the remaining Supabase wording
in app settings and README to describe shared storage and periodic updates.

Publish and verify both players' existing rosters, locks, history, save conflicts,
and a two-browser update. Keep the old backend until that passes. Only then retire
the Supabase project through its dashboard to end its project lifecycle notices.
Rollback before any new Cloudflare saves: restore the original script tags and
disable `shared-config.js`. If new saves already exist, export those before any
rollback to avoid losing them.

The Worker preserves the current public game's access model: it does not add
player login. Allowed browser origins are configured in `ALLOWED_ORIGINS`; CORS
is not authentication. Free Cloudflare usage has daily limits.

## Verify locally

```powershell
node tests/cloudflare-draft.mjs
node tests/shared-draft.mjs
node tests/runtime-smoke.mjs
node tests/smoke.mjs
```

The backend test executes the actual queries against SQLite and checks races,
stale writes, input validation, CORS, and browser polling. A deployed D1 check is
still required before cutover.
