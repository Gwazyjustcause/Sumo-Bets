# Sumo Battle

A polished static companion app for Gwazy and Jake's private fantasy-sumo rivalry. There is no gambling and no money involved.

## Player system

- Persistent Gwazy/Jake selector with isolated picks, side predictions, favourite wrestlers and notes
- One shared two-player draft: a rikishi can belong to Gwazy or Jake, never both
- Banzuke team builder with automatic slot filling, live validation, removal, moves and swaps
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

The private game has separate blank defaults in `data/draft/`. Live rosters, predictions, preferences and editable history remain in each browser's `localStorage`. “Reset current draft only” never changes `data/official/`, history, notes, image cache, appearance settings, or another basho's draft.

## Structure

- `index.html` — application shell and navigation
- `styles.css` — responsive visual system and themes
- `app.js` — hash routing, scoring, interactions and local draft storage
- `data/official/` — generated, read-only JSA snapshots
- `data/draft/` — blank game defaults and schemas
- `data/sumo-data.js` — generated compatibility bundle consumed by the static UI
- `scripts/update-official-data.mjs` — zero-dependency JSA updater and integrity validator
- `.github/workflows/update-jsa-data.yml` — scheduled refresh, conditional commit and Pages deployment

## Automatic official updates

The workflow runs every six hours. During an active basho it checks every run; outside the official dates the updater self-throttles to one check per day. It commits only when the normalized JSA content hash changes. A new basho updates only the official files; the browser then offers “Start a new draft” while preserving previous drafts and history.

Because GitHub does not start another Pages build from a commit made by the built-in workflow token, this workflow deploys the changed static tree directly. In the repository's Pages settings, select **GitHub Actions** as the source once; no recurring manual updates are needed after that.

Run a forced local refresh with:

```powershell
node scripts/update-official-data.mjs
```

The updater fails if the official banzuke is empty or contains duplicate JSA IDs. The browser performs its own official/parsed/rendered set comparison and reports any missing rikishi loudly.

## Verify

```powershell
node --check app.js
node --check scripts/update-official-data.mjs
node tests/smoke.mjs
node tests/runtime-smoke.mjs
```
