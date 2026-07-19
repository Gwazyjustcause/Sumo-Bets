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
  querySelectorAll() { return []; }
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

const context = vm.createContext({
  console,
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
vm.runInContext(load("app.js"), context, { filename: "app.js" });
await new Promise((resolve) => setTimeout(resolve, 120));

assert(app.innerHTML.includes("GWAZY'S BONUS PREDICTION"), "Overview should render the active player's prediction");
assert.equal(playerSelect.value, "gwazy", "Gwazy should be the default active player");

playerSelect.value = "jake";
playerSelect.listeners.change();
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(JSON.parse(storage.get("sumoBattleSettings")).activePlayer, "jake", "Player selection should persist");
assert(app.innerHTML.includes("JAKE'S BONUS PREDICTION"), "Switching player should redraw player-owned content");

const gwazyRosterBefore = vm.runInContext("JSON.stringify(getPlayerState('gwazy'))", context);
vm.runInContext("removePick('hakunofuji'); removePick('daieisho'); addPick('atamifuji');", context);
await new Promise((resolve) => setTimeout(resolve, 120));
const jakeAfterSanyaku = JSON.parse(vm.runInContext("JSON.stringify(getPlayerState('jake'))", context));
assert(!jakeAfterSanyaku.mainPicks.includes("atamifuji"), "A third Komusubi+ pick must not enter the main team");
assert(jakeAfterSanyaku.substitutes.includes("atamifuji"), "An ineligible main pick should fill the first substitute slot");
vm.runInContext("addPick('gonoyama');", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(vm.runInContext("validateRoster('jake').valid", context), true, "Legal automatic filling should restore a valid roster");
assert.equal(vm.runInContext("JSON.stringify(getPlayerState('gwazy'))", context), gwazyRosterBefore, "Editing Jake must not change Gwazy");

for (const route of ["roster", "banzuke", "results", "history", "settings"]) {
  location.hash = `#${route}`;
  window.listeners.hashchange();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(app.dataset.route, route, `${route} route should render without an exception`);
}

location.hash = "#history";
vm.runInContext("historyEditMode = true; render();", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert(app.innerHTML.includes("EDITING ARCHIVED BASHO"), "History edit mode should render");
assert(app.innerHTML.includes("JAKE'S ROSTER"), "History editor should stay scoped to the active player");

const averageBefore = vm.runInContext("calculateHistoryStats().average", context);
vm.runInContext("state.history[0].jakeScore += 100", context);
const averageAfter = vm.runInContext("calculateHistoryStats().average", context);
assert(averageAfter > averageBefore, "History statistics should derive immediately from edited scores");

console.log("Runtime smoke checks passed: player persistence, six routes, and history edit mode.");
