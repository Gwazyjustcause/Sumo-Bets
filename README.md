# Sumo Battle

A polished static companion app for Gwazy and Jake's private fantasy-sumo rivalry. There is no gambling and no money involved.

## Player system

- Persistent Gwazy/Jake selector with isolated picks, side predictions, favourite wrestlers and notes
- One shared two-player draft: a rikishi can belong to Gwazy or Jake, never both
- Banzuke team builder with automatic slot filling, live validation, removal, moves and random draft tools
- Six scoring main picks plus three standby substitutes: exactly one Sanyaku and two Maegashira
- Official kyujo status automatically activates the matching substitute, restores returning main picks and records the substitution timeline
- Activating a substitute credits their full basho points, including earlier wins and bonuses; points are banked when they leave the lineup and catch up on reactivation
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

The shared game is stored separately in a Cloudflare D1 `shared_drafts` table behind a small Worker. The site loads the selected basho at startup, checks for updates every 15 seconds while visible, and saves changes through a revision-checked endpoint. Browser `localStorage` contains preferences and editable history only; it never owns the live draft. No shared roster is committed to this repository.

## Shared storage setup

Deployment and migration instructions are in [`cloudflare/README.md`](cloudflare/README.md).

1. Create a Cloudflare D1 database and apply [`cloudflare/schema.sql`](cloudflare/schema.sql).
2. Deploy [`cloudflare/worker.mjs`](cloudflare/worker.mjs) with the database binding.
3. Set the Worker URL in [`shared-config.js`](shared-config.js) and deploy the static site. Hosting credentials never go to the browser.

No player needs a hosting login or browser-stored credential. Saving is player-scoped: the app fetches the newest database revision, validates only the selected player's roster, replaces only that player's section, and preserves the opponent's latest roster and prediction. Non-overlapping revision races are merged and retried automatically. If both players claim the same rikishi, the first atomic save keeps ownership and the second editor receives a clear conflict message instead of overwriting either roster. Periodic checks update the other visible browser while preserving its unsaved working copy.

## Structure

- `index.html` — application shell and navigation
- `styles.css` — responsive visual system and themes
- `app.js` — hash routing, scoring, staged roster editing and shared-draft validation
- `cloudflare-draft.js` — shared loading, revision-checked saves and periodic updates
- `shared-config.js` — public Worker endpoint
- `cloudflare/` — database schema, Worker, deployment configuration and migration guide
- `shared-draft.js`, `supabase-config.js`, `supabase/` — legacy transport and migration source; not loaded by the site
- `data/official/` — generated, read-only JSA snapshots
- `data/draft/` — non-live game metadata and history schemas
- `data/sumo-data.js` — generated compatibility bundle consumed by the static UI
- `scripts/update-official-data.mjs` — zero-dependency JSA updater and integrity validator
- `.github/workflows/update-jsa-data.yml` — scheduled official-JSA refresh and conditional official-data commit

## Automatic official updates

The workflow runs every six hours. During an active basho it checks every run; outside the official dates the updater self-throttles to one check per day. It commits only `data/official/` and `data/sumo-data.js` when the normalized JSA content hash changes. It never reads or writes the shared draft. A new basho updates only the official files; the browser then offers “Start a new draft” while preserving previous drafts and history.

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
node tests/cloudflare-draft.mjs
```
