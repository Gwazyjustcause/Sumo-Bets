# Sumo Battle

A polished static companion app for Gwazy and Jake's private fantasy-sumo rivalry. There is no gambling and no money involved.

## Player system

- Persistent Gwazy/Jake selector with isolated picks, side predictions, favourite wrestlers and notes
- One shared two-player draft: a rikishi can belong to Gwazy or Jake, never both
- Banzuke team builder with automatic slot filling, live validation, removal, moves and random draft tools
- Six scoring main picks plus three standby substitutes: exactly one Sanyaku and two Maegashira
- Official kyujo status automatically activates the matching substitute, restores returning main picks and records the substitution timeline
- Editable basho history with player-specific archived picks, predictions, bonuses and notes
- Scores recalculate from the current official records whenever the generated snapshot changes

## Run locally

Any static server works. A zero-dependency preview server is included:

```powershell
node serve.mjs
```

Then open `http://localhost:4173`.

## Two independent data layers

Official tournament facts are read-only and generated from the Japan Sumo Association:

- `data/official/basho.json` — basho identity, dates, day and venue
- `data/official/banzuke.json` — every official Makuuchi position
- `data/official/rikishi.json` — records, absences and day-by-day opponents
- `data/official/results.json` — schedules, winners, kimarite and East/West totals

The private game is stored separately in a Supabase `shared_drafts` table. The site loads the selected basho row at startup, listens for realtime changes, and publishes a new database revision only when **Save Picks** is pressed. Browser `localStorage` contains preferences and editable history only; it never owns the live draft. No shared roster is committed to this repository.

## Supabase setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
2. Copy the project URL and publishable/anon key into [`supabase-config.js`](supabase-config.js).
3. Deploy the static site normally. The publishable key is intentionally browser-visible; the SQL schema limits direct table writes and exposes only the revision-checked save function.

No player needs a GitHub token, Supabase login, or browser-stored credential. Saving is player-scoped: the app fetches the newest database revision, validates only the selected player's roster, replaces only that player's section, and preserves the opponent's latest roster and prediction. Non-overlapping revision races are merged and retried automatically. If both players claim the same rikishi, the first atomic save keeps ownership and the second editor receives a clear conflict message instead of overwriting either roster. Realtime events update the other open browser immediately while preserving its unsaved working copy.

## Structure

- `index.html` — application shell and navigation
- `styles.css` — responsive visual system and themes
- `app.js` — hash routing, scoring, staged roster editing and shared-draft validation
- `shared-draft.js` — Supabase loading, atomic revision saves and realtime subscriptions
- `supabase-config.js` — public Supabase project configuration
- `supabase/schema.sql` — table, read policy, realtime publication and conflict-safe save function
- `data/official/` — generated, read-only JSA snapshots
- `data/draft/` — non-live game metadata and history schemas
- `data/sumo-data.js` — generated compatibility bundle consumed by the static UI
- `scripts/update-official-data.mjs` — zero-dependency JSA updater and integrity validator
- `.github/workflows/update-jsa-data.yml` — scheduled official-JSA refresh and conditional official-data commit

## Automatic official updates

The workflow runs every six hours. During an active basho it checks every run; outside the official dates the updater self-throttles to one check per day. It commits only `data/official/` and `data/sumo-data.js` when the normalized JSA content hash changes. It never reads or writes the Supabase draft. A new basho updates only the official files; the browser then offers “Start a new draft” while preserving previous drafts and history.

For GitHub Pages, use **Deploy from a branch** with `main` and `/ (root)`. The JSA workflow is intentionally not a site-deployment or shared-draft workflow.

Run a forced local refresh with:

```powershell
node scripts/update-official-data.mjs
```

The updater fails if the official banzuke is empty or contains duplicate JSA IDs. The browser performs its own official/parsed/rendered set comparison and reports any missing rikishi loudly.

## Verify

```powershell
node --check app.js
node --check shared-draft.js
node --check scripts/update-official-data.mjs
node tests/smoke.mjs
node tests/runtime-smoke.mjs
node tests/shared-draft.mjs
```
