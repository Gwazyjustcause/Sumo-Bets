# Sumo Battle

A polished static companion app for Gwazy and Jake's private fantasy-sumo rivalry. There is no gambling and no money involved.

## Run locally

Any static server works. A zero-dependency preview server is included:

```powershell
node serve.mjs
```

Then open `http://localhost:4173`.

## Structure

- `index.html` — application shell and navigation
- `styles.css` — responsive visual system and themes
- `app.js` — hash routing, interactions, local storage and rendering
- `data/sumo-data.js` — update-friendly tournament, roster and history data
- `assets/sumo-arena-hero.webp` — optimized original generated hero artwork

## Data updates

Official tournament facts are linked to the Nihon Sumo Kyokai. Private fantasy scores, rosters and history are deliberately stored separately in `data/sumo-data.js`. The structure can be produced by a future GitHub Action without changing the UI code.

The site is GitHub Pages-ready: it uses only relative paths and has no build step.

## Verify

```powershell
node --check app.js
node tests/smoke.mjs
```
