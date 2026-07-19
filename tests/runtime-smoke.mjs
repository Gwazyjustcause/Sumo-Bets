import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const load = (path) => readFileSync(new URL(path, root), "utf8");

class FakeElement {
  constructor(name = "element") {
    this.name = name;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.dataset = {};
    this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }

  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute() {}
  removeAttribute() {}
  querySelector() { return null; }
  querySelectorAll(selector) {
    if (this.name === "app" && selector === "[data-banzuke-id]") {
      return [...this.innerHTML.matchAll(/<article[^>]*data-banzuke-id="([^"]+)"[^>]*data-banzuke-shikona="([^"]*)"[^>]*>/g)].map((match) => {
        const element = new FakeElement("banzuke-card");
        element.dataset.banzukeId = match[1];
        element.dataset.banzukeShikona = match[2];
        return element;
      });
    }
    return [];
  }
  closest() { return null; }
  close() {}
  showModal() {}
}

const app = new FakeElement("app");
const dialog = new FakeElement("dialog");
const profileContent = new FakeElement("profile");
const toast = new FakeElement("toast");
const soundButton = new FakeElement("sound");
const playerSelect = new FakeElement("player-select");
const playerLabel = new FakeElement("player-label");
const playerSelector = new FakeElement("player-selector");
const dialogClose = new FakeElement("dialog-close");
playerSelect.closest = () => playerSelector;

const elements = new Map([
  ["#app", app],
  ["#profile-dialog", dialog],
  ["#profile-content", profileContent],
  ["#toast", toast],
  ["#sound-toggle", soundButton],
  ["#active-player-select", playerSelect],
  ["#active-player-label", playerLabel],
  [".dialog-close", dialogClose],
]);

const documentElement = new FakeElement("html");
const document = {
  documentElement,
  listeners: {},
  querySelector: (selector) => elements.get(selector) || null,
  querySelectorAll: () => [],
  addEventListener(name, handler) { this.listeners[name] = handler; },
};

const storage = new Map();
storage.set("sumoBattleSettings", JSON.stringify({
  activePlayer: "jake",
  bonusPrediction: "West",
  roster: { gwazy: { team: ["onosato"], subs: ["ura"] } },
  players: { jake: { sidePrediction: "East", mainPicks: ["hoshoryu"] } },
}));
storage.set("sumoBattleHistoryCache", JSON.stringify({ events: [{ id: "demo-history" }] }));
const localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

const location = { hash: "#overview" };
const window = {
  listeners: {},
  addEventListener(name, handler) { this.listeners[name] = handler; },
  scrollTo() {},
};
const browserConsole = { errors: [], warnings: [], info: [] };
const sandboxConsole = {
  log: (...args) => console.log(...args),
  error: (...args) => browserConsole.errors.push(args.join(" ")),
  warn: (...args) => browserConsole.warnings.push(args.join(" ")),
  info: (...args) => browserConsole.info.push(args.join(" ")),
};

const context = vm.createContext({
  console: sandboxConsole,
  document,
  localStorage,
  location,
  performance,
  requestAnimationFrame: (callback) => callback(performance.now() + 1000),
  setTimeout,
  clearTimeout,
  window,
});

vm.runInContext(load("data/sumo-data.js"), context, { filename: "data/sumo-data.js" });
vm.runInContext(load("image-resolver.js"), context, { filename: "image-resolver.js" });
vm.runInContext(load("app.js"), context, { filename: "app.js" });
await new Promise((resolve) => setTimeout(resolve, 120));

assert(app.innerHTML.includes("GWAZY'S SIDE PREDICTION"), "Overview should render the active player's prediction control");
assert(app.innerHTML.includes("The draft has not started yet."), "A clean save must show the friendly pre-draft state");
assert.equal(playerSelect.value, "gwazy", "Gwazy should be the default active player");
const migratedSave = JSON.parse(storage.get("sumoBattleSettings"));
assert.equal(migratedSave.appVersion, 2, "The first Version 2 run must write a new compatible save");
assert.equal(JSON.parse(storage.get("sumoBattleHistoryCache")).events.length, 0, "The one-time migration must clear legacy history cache data");
assert.equal(vm.runInContext("state.history.length", context), 0, "The live Version 2 state must have no archived basho");
assert.equal(vm.runInContext("data.players.every((player) => player.score === 0 && player.sidePrediction === null)", context), true, "Scores and side predictions must start blank");

playerSelect.value = "jake";
playerSelect.listeners.change();
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(JSON.parse(storage.get("sumoBattleSettings")).activePlayer, "jake", "Player selection should persist");
assert(app.innerHTML.includes("JAKE'S SIDE PREDICTION"), "Switching player should redraw player-owned content");

const gwazyRosterBefore = vm.runInContext("JSON.stringify(getPlayerState('gwazy'))", context);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('gwazy'))", context)), { team: [], subs: [] }, "A new basho must start with an empty Gwazy draft");
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('jake'))", context)), { team: [], subs: [] }, "A new basho must start with an empty Jake draft");
assert.equal(vm.runInContext("draftPoolStats().available", context), 42, "Every rikishi must start available");

vm.runInContext("addPick('hoshoryu');", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(vm.runInContext("draftOwner('hoshoryu')", context), "jake", "A drafted rikishi must have one shared owner");
assert(vm.runInContext("getRoster('jake').team.includes('hoshoryu')", context), "Jake's pick must enter Jake's draft");

playerSelect.value = "gwazy";
playerSelect.listeners.change();
await new Promise((resolve) => setTimeout(resolve, 120));
vm.runInContext("addPick('hoshoryu');", context);
assert(!vm.runInContext("getRoster('gwazy').team.includes('hoshoryu')", context), "Gwazy may not draft a rikishi owned by Jake");
assert.equal(vm.runInContext("draftOwner('hoshoryu')", context), "jake", "A rejected cross-player pick must not change ownership");

vm.runInContext("addPick('kirishima');", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(vm.runInContext("draftOwner('kirishima')", context), "gwazy", "Gwazy must own only the rikishi drafted as Gwazy");
vm.runInContext("removePick('kirishima');", context);
assert.equal(vm.runInContext("draftOwner('kirishima')", context), null, "Removing a rikishi must return him to the shared pool immediately");
assert.equal(vm.runInContext("draftPoolStats().available", context), 41, "Removing a rikishi must increment availability immediately");
vm.runInContext("addPick('kirishima');", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(vm.runInContext("JSON.stringify(getPlayerState('gwazy'))", context), gwazyRosterBefore, "Editing Jake must not change Gwazy");

location.hash = "#overview";
window.listeners.hashchange();
await new Promise((resolve) => setTimeout(resolve, 120));
assert(app.innerHTML.includes('data-overview-roster="gwazy"') && app.innerHTML.includes('data-overview-roster="jake"'), "Overview must always render both complete roster columns");
assert.equal((app.innerHTML.match(/data-empty-draft-slot=/g) || []).length, 16, "Overview must render all remaining main and substitute slots");
assert(app.innerHTML.includes("Kirishima") && app.innerHTML.includes("Hoshoryu"), "Overview must update both players' rosters without a refresh");

for (const route of ["roster", "banzuke", "results", "history", "settings"]) {
  location.hash = `#${route}`;
  window.listeners.hashchange();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(app.dataset.route, route, `${route} route should render without an exception`);
  if (route === "banzuke") {
    assert.equal((app.innerHTML.match(/data-banzuke-id=/g) || []).length, 42, "The view must render every current Makuuchi rikishi");
    assert.equal(vm.runInContext("banzukeRankRows().length", context), 21, "The data layer must generate all 21 East/West rows");
    assert(app.innerHTML.includes("Daiseizan") && app.innerHTML.includes("Asakoryu"), "The Banzuke must continue through M16 East and West");
    assert(app.innerHTML.includes('data-banzuke-shikona="Yoshinofuji"'), "Yoshinofuji must render from the official dataset");
    assert(app.innerHTML.includes('data-draft-owner="jake"') && app.innerHTML.includes("🔒 Jake"), "The active player must see the other player's picks as locked");
    assert(app.innerHTML.includes('data-draft-available="40"'), "Draft availability must update immediately after two picks");
  }
}
assert.equal(browserConsole.errors.length, 0, "A complete official banzuke must produce no coverage errors");

const duplicateSideRows = JSON.parse(vm.runInContext(`JSON.stringify(banzukeRankRows({entries:[
  {rikishiId:"east",shikona:"East One",rank:"Komusubi",side:"East",sourceIndex:0},
  {rikishiId:"west-a",shikona:"West One",rank:"Komusubi",side:"West",sourceIndex:1},
  {rikishiId:"west-b",shikona:"West Two",rank:"Komusubi",side:"West",sourceIndex:2}
]}))`, context));
assert.equal(duplicateSideRows.length, 2, "Duplicate same-side ranks must create additional rows instead of overwriting");
assert.deepEqual(
  duplicateSideRows.flatMap((row) => [row.East?.rikishiId, row.West?.rikishiId]).filter(Boolean).sort(),
  ["east", "west-a", "west-b"],
  "Every same-rank source entry must survive row generation exactly once",
);
const incompleteCard = vm.runInContext(`banzukeRow({rank:"Komusubi",position:1,East:{rikishiId:"missing",shikona:"Metadata Missing",rank:"Komusubi",side:"East",sourceIndex:99},West:null})`, context);
assert(incompleteCard.includes("Metadata Missing") && incompleteCard.includes("DATA INCOMPLETE"), "Incomplete metadata must render a placeholder card rather than disappear");
const errorsBeforeAudit = browserConsole.errors.length;
vm.runInContext(`verifyBanzukeIntegrity({officialRikishi:[{id:"yoshinofuji",shikona:"Yoshinofuji"}],entries:[{rikishiId:"yoshinofuji",shikona:"Yoshinofuji"}],expectedRikishi:1})`, context);
const missingRenderErrors = browserConsole.errors.slice(errorsBeforeAudit).join("\n");
assert(missingRenderErrors.includes("Parsed ✓") && missingRenderErrors.includes("Rendered ✗"), "Parsed-but-missing wrestlers must fail loudly with a reason");
const errorsBeforeParseAudit = browserConsole.errors.length;
vm.runInContext(`verifyBanzukeIntegrity({officialRikishi:[{id:"never-parsed",shikona:"Never Parsed"}],entries:[],expectedRikishi:1})`, context);
const missingParseErrors = browserConsole.errors.slice(errorsBeforeParseAudit).join("\n");
assert(missingParseErrors.includes("Never Parsed") && missingParseErrors.includes("Not parsed"), "Official wrestlers missing from the dataset must fail loudly");

const currentBashoId = vm.runInContext("state.selectedBashoId", context);
const corruptSaved = JSON.parse(storage.get("sumoBattleSettings"));
corruptSaved.draftSchemaVersion = 2;
corruptSaved.drafts[currentBashoId] = {
  gwazy: { mainPicks: ["onosato"], substitutes: [] },
  jake: { mainPicks: ["onosato", "hoshoryu"], substitutes: ["not-a-rikishi"] },
};
storage.set("sumoBattleSettings", JSON.stringify(corruptSaved));
vm.runInContext("state = readState();", context);
assert.equal(vm.runInContext("draftOwner('onosato')", context), "gwazy", "Stored duplicate ownership must be resolved deterministically");
assert(!vm.runInContext("getRoster('jake').team.includes('onosato')", context), "Sanitization must remove the losing duplicate assignment");
assert(!vm.runInContext("getRoster('jake').subs.includes('not-a-rikishi')", context), "Sanitization must remove unknown rikishi IDs");

location.hash = "#history";
vm.runInContext("state.activePlayer = 'jake'; historyEditMode = true; render();", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert(app.innerHTML.includes("NO ARCHIVED BASHO"), "History must render a clean empty state");
assert(!app.innerHTML.includes("EDITING ARCHIVED BASHO"), "Empty history must not expose a demo editor");
assert.equal(vm.runInContext("calculateHistoryStats().average", context), 0, "Empty history must calculate no statistics");

console.log("Runtime smoke checks passed: Version 2 migration, blank state, shared draft, and six routes.");
