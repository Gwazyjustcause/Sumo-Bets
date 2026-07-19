import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const load = (path) => readFileSync(new URL(path, root), "utf8");
const context = { window: {} };

runInNewContext(load("data/sumo-data.js"), context);
const data = context.window.SUMO_DATA;
const ids = new Set(data.rikishi.map((rikishi) => rikishi.id));

assert.equal(ids.size, data.rikishi.length, "Rikishi IDs must be unique");
assert.equal(data.meta.totalDays, 15, "A basho has fifteen days");
assert.equal(data.players.length, 2, "The league has exactly two players");
assert.deepEqual([...data.players.map((player) => player.id)].sort(), ["gwazy", "jake"], "Only Gwazy and Jake may be players");

for (const player of data.players) {
  assert.equal(player.team.length, 6, `${player.name} must have six starters`);
  assert.equal(player.subs.length, 3, `${player.name} must have three substitutes`);
  for (const id of [...player.team, ...player.subs]) {
    assert(ids.has(id), `${player.name} references unknown rikishi: ${id}`);
  }
  const starters = player.team.map((id) => data.rikishi.find((rikishi) => rikishi.id === id));
  const sanyaku = starters.filter((rikishi) => ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"].includes(rikishi.rank));
  const underdogs = starters.filter((rikishi) => /Maegashira (1[3-7])/.test(rikishi.rank));
  assert(sanyaku.length <= 2, `${player.name} may have at most two Komusubi+ starters`);
  assert.equal(underdogs.length, 1, `${player.name} must have exactly one M13–M17 underdog`);
  assert(["East", "West"].includes(player.sidePrediction), `${player.name} needs an independent side prediction`);
  assert(ids.has(player.favouriteWrestler), `${player.name} references an unknown favourite wrestler`);
}

assert.notEqual(data.players[0].sidePrediction, data.players[1].sidePrediction, "Seed predictions should demonstrate player isolation");

for (const bout of data.bouts) {
  assert(ids.has(bout.east), `Bout references unknown east rikishi: ${bout.east}`);
  assert(ids.has(bout.west), `Bout references unknown west rikishi: ${bout.west}`);
  assert([bout.east, bout.west].includes(bout.winner), "Winner must be one of the two rikishi");
  assert(bout.importance >= 1 && bout.importance <= 5, "Importance must be between one and five");
}

for (const event of data.history) {
  assert(["Gwazy", "Jake"].includes(event.winner), `${event.basho} needs a valid winner`);
  assert(Number.isFinite(event.gwazyScore) && Number.isFinite(event.jakeScore), `${event.basho} needs numeric final scores`);
  assert(ids.has(event.mvp), `${event.basho} references an unknown MVP`);
  for (const playerId of ["gwazy", "jake"]) {
    assert.equal(event.rosters[playerId].length, 9, `${event.basho} needs nine archived ${playerId} picks`);
    assert(event.rosters[playerId].every((id) => ids.has(id)), `${event.basho} has an unknown ${playerId} roster pick`);
    assert(["East", "West"].includes(event.predictions[playerId]), `${event.basho} needs ${playerId}'s side prediction`);
    assert.equal(typeof event.notes[playerId], "string", `${event.basho} needs ${playerId}'s notes`);
    assert(ids.has(event.bestPicks[playerId]) && ids.has(event.worstPicks[playerId]), `${event.basho} needs valid best and worst picks for ${playerId}`);
  }
}

const html = load("index.html");
const app = load("app.js");
const css = load("styles.css");
for (const asset of ["styles.css", "data/sumo-data.js", "app.js"]) {
  assert(html.includes(asset), `index.html must reference ${asset}`);
}
for (const match of [...app.matchAll(/assets\/[^"']+/g)]) {
  assert(existsSync(new URL(match[0], root)), `Missing app asset: ${match[0]}`);
}
assert(css.includes("@media (max-width: 620px)"), "Small-screen breakpoint must be present");
assert(css.includes("prefers-reduced-motion"), "Reduced-motion support must be present");
assert(html.includes('id="active-player-select"'), "The header needs a player selector");
assert(app.includes('localStorage.setItem("sumoBattleSettings"'), "Player state must persist locally");
for (const capability of ["data-add-pick", "data-roster-move", "data-swap-pick", "data-history-edit", "calculateHistoryStats", "sidePrediction"]) {
  assert(app.includes(capability), `Missing player-system capability: ${capability}`);
}

for (const textFile of ["index.html", "styles.css", "app.js", "data/sumo-data.js"]) {
  const contents = load(textFile);
  assert(!contents.includes("Ã"), `${textFile} contains likely mojibake`);
  assert(!contents.includes("â€“"), `${textFile} contains likely mojibake`);
}

console.log(`Smoke checks passed: ${data.rikishi.length} rikishi, ${data.bouts.length} bouts, ${data.history.length} archived basho.`);
