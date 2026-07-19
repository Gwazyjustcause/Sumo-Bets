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
await new Promise((resolve) => setTimeout(resolve, 240));

assert(!app.innerHTML.includes("JAKE'S SIDE PREDICTION"), `Overview must no longer contain the editable prediction control. Browser errors: ${browserConsole.errors.join(" | ")}`);
assert(vm.runInContext("rosterView().includes(\"JAKE'S SIDE PREDICTION\")", context), "Roster must contain the selected player's prediction control");
assert(app.innerHTML.includes("The draft has not started yet."), "A clean save must show the friendly pre-draft state");
assert(app.innerHTML.includes("DRAFT MODE") && !app.innerHTML.includes("data-overview-analytics"), "Analytics must wait until both drafts are locked");
assert(app.innerHTML.includes("DRAFT PROGRESS") && app.innerHTML.includes("draft-progress") && !app.innerHTML.includes("TOURNAMENT PROGRESS"), "The draft-phase hero must show only shared slot progress");
assert(vm.runInContext("resultsView().includes('Daily results unlock with the tournament')", context), "Results and day navigation must wait until both drafts are locked");
vm.runInContext("savedSharedDraft={schemaVersion:4,bashoId:state.selectedBashoId,revision:0,playerLocks:{gwazy:true,jake:false},locked:false,status:'draft',players:emptyDraftPlayers()}", context);
assert.equal(vm.runInContext("draftEditingDisabled('gwazy')", context), true, "Gwazy's lock must make only Gwazy read-only");
assert.equal(vm.runInContext("draftEditingDisabled('jake')", context), false, "Jake must remain editable while only Gwazy is locked");
assert.equal(vm.runInContext("tournamentStarted()", context), false, "One player lock must not start the tournament");
vm.runInContext("savedSharedDraft=null", context);
assert.equal(playerSelect.value, "jake", "A storage migration must preserve the harmless active-player preference");
const migratedSave = JSON.parse(storage.get("sumoBattleSettings"));
assert.equal(migratedSave.appVersion, 3, "The first Version 3 run must write a new compatible preferences save");
assert.equal(Object.hasOwn(migratedSave, "drafts"), false, "Repository-backed rosters must not be copied into localStorage");
assert.equal(JSON.parse(storage.get("sumoBattleHistoryCache")).events.length, 0, "The one-time migration must clear legacy history cache data");
assert.equal(vm.runInContext("state.history.length", context), 0, "The live Version 3 state must have no archived basho");
assert.equal(vm.runInContext("data.players.every((player) => player.score === 0 && player.sidePrediction === null)", context), true, "Scores and side predictions must start blank");
assert.equal(vm.runInContext("data.meta.day", context), 8, "A draft migration must not erase the restored official day");
assert(vm.runInContext("data.rikishi.some((rikishi) => rikishi.wins > 0)", context), "A draft migration must not erase official rikishi records");
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('gwazy'))", context)), { team: [], subs: [] }, "Legacy browser drafts must be ignored in favor of the Supabase draft");

playerSelect.value = "jake";
playerSelect.listeners.change();
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(JSON.parse(storage.get("sumoBattleSettings")).activePlayer, "jake", "Player selection should persist");
assert(vm.runInContext("rosterView().includes(\"JAKE'S SIDE PREDICTION\")", context), "Switching player should redraw player-owned roster content");

const gwazyRosterBefore = vm.runInContext("JSON.stringify(getPlayerState('gwazy'))", context);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('gwazy'))", context)), { team: [], subs: [] }, "A new basho must start with an empty Gwazy draft");
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('jake'))", context)), { team: [], subs: [] }, "A new basho must start with an empty Jake draft");
assert.equal(vm.runInContext("draftPoolStats().available", context), 42, "Every rikishi must start available");

vm.runInContext(`savedSharedDraft={schemaVersion:4,bashoId:state.selectedBashoId,revision:0,locked:true,playerLocks:{gwazy:true,jake:true},status:'tournament',lastSavedAt:null,savedBy:null,players:emptyDraftPlayers()}; state.drafts[state.selectedBashoId]={
  gwazy:{mainPicks:['hoshoryu','kirishima','fujinokawa','gonoyama','hiradoumi','nishikifuji'],substitutes:['yoshinofuji','daieisho','ura'],sidePrediction:'East',substitutionEvents:[]},
  jake:{mainPicks:['onosato','kotozakura','takanosho','churanoumi','hakunofuji','takerufuji'],substitutes:['oho','ichiyamamoto','oshoma'],sidePrediction:'West',substitutionEvents:[]}
};`, context);
const tournamentOverview = vm.runInContext("overviewView()", context);
assert(tournamentOverview.includes("Current standings") && tournamentOverview.includes("Projected winner") && tournamentOverview.includes("Point progression"), "Tournament mode must restore standings, forecast, and momentum");
assert(tournamentOverview.includes("TOURNAMENT PROGRESS") && tournamentOverview.includes("DAY 8") && !tournamentOverview.includes("draft-progress"), "The tournament hero must replace draft slots with official day progress");
assert(!tournamentOverview.includes("of 18 draft slots filled"), "Tournament mode must not retain draft-progress copy in the score comparison");
assert.equal((tournamentOverview.match(/data-overview-day=/g) || []).length, 15, "The tournament hero must render all 15 basho days");
assert(tournamentOverview.includes('data-overview-day="8"') && tournamentOverview.includes('current selected'), "The official current day must be highlighted in the hero");
assert(tournamentOverview.includes('data-overview-day="9"') && tournamentOverview.includes('future" type="button" data-overview-day="9"'), "Future hero days must remain visible and disabled");
vm.runInContext("state.selectedDay=3", context);
const pastDayOverview = vm.runInContext("overviewView()", context);
assert(pastDayOverview.includes("DAY SNAPSHOT") && pastDayOverview.includes("Day 3"), "Selecting a completed day must update Overview's day-dependent statistics");
assert(pastDayOverview.includes('data-overview-day="3"') && pastDayOverview.includes('done selected'), "The selected completed day must be distinct from the official current day");
vm.runInContext("state.selectedDay=data.meta.day", context);
const overviewOrder = [tournamentOverview.indexOf("score-duel"), tournamentOverview.indexOf("data-overview-analytics"), tournamentOverview.indexOf("data-overview-roster")];
assert(overviewOrder[0] >= 0 && overviewOrder[0] < overviewOrder[1] && overviewOrder[1] < overviewOrder[2], "Tournament Overview must order score comparison, analytics, then shared rosters");
assert.equal((tournamentOverview.match(/class="chart-line /g) || []).length, 2, "Momentum must render a separate point-total line for each player");
assert(tournamentOverview.includes("D1") && tournamentOverview.includes("D15"), "Momentum must span the complete Day 1 to Day 15 axis");
assert.equal(vm.runInContext("validateSharedDraft().valid", context), true, "A complete two-player draft with legal substitute categories must save");
assert.equal(vm.runInContext("hasUnsavedDraftChanges()", context), true, "Editing the working copy must raise the unsaved-changes state");
const fantasyResult = JSON.parse(vm.runInContext("JSON.stringify(resultDraftImpact({east:'hoshoryu',west:'onosato',winner:'hoshoryu',completed:true,importance:5,technique:'yorikiri'}, state.selectedDay))", context));
assert.equal(fantasyResult.headToHead, true, "A Gwazy-versus-Jake matchup must be identified as a head-to-head draft bout");
assert.deepEqual([...fantasyResult.ownerIds].sort(), ["gwazy", "jake"], "Result impact must expose both draft owners");
const fantasyResultsHtml = vm.runInContext("resultsView()", context);
assert(fantasyResultsHtml.includes("data-results-daily-stats") && fantasyResultsHtml.includes("Important Bouts"), "Results must render daily player records and fantasy filters");
assert(fantasyResultsHtml.includes("result-owner-badge") && fantasyResultsHtml.includes("result-point-award"), "Every Results card must show ownership and point impact");
const liveForecast = JSON.parse(vm.runInContext("JSON.stringify(forecastModel())", context));
assert(Number.isFinite(liveForecast.projections.gwazy) && Number.isFinite(liveForecast.projections.jake), "Forecast must calculate both projected final scores from the live draft and official records");
assert(liveForecast.probability >= 5 && liveForecast.probability <= 95, "Forecast win probability must remain a meaningful percentage");
assert(vm.runInContext("momentumChart().includes('D15') && (momentumChart().match(/chart-line/g) || []).length === 2", context), "Momentum must plot both players across the full basho axis");
vm.runInContext("getDraftPlayer('jake').mainPicks[0]='hoshoryu'", context);
assert(vm.runInContext("validateSharedDraft().errors.some((error)=>error.includes('appears more than once'))", context), "Cross-player duplicate ownership must block Save Picks");
vm.runInContext(`getDraftPlayer('jake').mainPicks[0]='onosato'; state.activePlayer='gwazy';
  savedSharedDraft.playerLocks={gwazy:false,jake:false};savedSharedDraft.locked=false;savedSharedDraft.status='draft';
  globalThis.__concurrentSaves=[]; globalThis.__putAttempts=0;
  globalThis.__latestShared={schemaVersion:4,bashoId:state.selectedBashoId,revision:4,locked:false,playerLocks:{gwazy:false,jake:false},status:'draft',lastSavedAt:null,savedBy:'Jake',players:{
    gwazy:{mainPicks:[],substitutes:[],sidePrediction:null,substitutionEvents:[]},
    jake:{mainPicks:['onosato'],substitutes:[],sidePrediction:'West',substitutionEvents:[]}
  }};
  window.SHARED_DRAFT_API={
    config:{url:'https://test.supabase.co',table:'shared_drafts'},configured:()=>true,subscribe:()=>()=>{},
    load:async()=>({document:JSON.parse(JSON.stringify(__latestShared)),revision:__latestShared.revision}),
    save:async(document,revision)=>{__putAttempts+=1;if(__putAttempts===1){__latestShared.players.jake.sidePrediction='East';const error=new Error('concurrent update');error.status=409;throw error;}__concurrentSaves.push({document:JSON.parse(JSON.stringify(document)),revision});__latestShared=JSON.parse(JSON.stringify(document));return {document,revision:document.revision};}
  };`, context);
assert.equal(vm.runInContext("validatePlayerDraft('gwazy').valid", context), true, "Gwazy's valid roster must be independently saveable");
assert.equal(vm.runInContext("validatePlayerDraft('jake').valid", context), true, "The local complete Jake roster remains independently valid before the remote merge");
await vm.runInContext("saveSharedDraft()", context);
const firstPlayerScopedSave = JSON.parse(vm.runInContext("JSON.stringify(__concurrentSaves[0].document)", context));
assert.equal(firstPlayerScopedSave.players.gwazy.mainPicks.length, 6, "Saving Gwazy must publish Gwazy's complete roster");
assert.deepEqual(firstPlayerScopedSave.players.jake.mainPicks, ["onosato"], "Saving Gwazy must preserve Jake's latest incomplete remote roster without validating or overwriting it");
assert.equal(firstPlayerScopedSave.players.jake.sidePrediction, "East", "A harmless revision race must be retried against and preserve Jake's newer prediction");
assert.equal(vm.runInContext("__putAttempts", context), 2, "A non-overlapping concurrent update must retry automatically");
assert.equal(firstPlayerScopedSave.savedBy, "Gwazy", "Player-scoped save metadata must identify the editor");
vm.runInContext("getDraftPlayer('gwazy').mainPicks[0]='onosato'", context);
await vm.runInContext("saveSharedDraft()", context);
assert.equal(vm.runInContext("__concurrentSaves.length", context), 1, "A same-rikishi race loser must not write a conflicting draft");
assert.equal(vm.runInContext("getRoster('gwazy').team.includes('onosato')", context), false, "A rikishi won by the other player's earlier save must be removed from the losing working copy");
assert.equal(vm.runInContext("draftOwner('onosato')", context), "jake", "First committed ownership must remain authoritative after a race");
assert(vm.runInContext("sharedDraftError.includes('just been drafted by Jake')", context), "The race loser must receive a clear ownership conflict message");
vm.runInContext("state.drafts[state.selectedBashoId]=emptyDraftPlayers(); savedSharedDraft.players=emptyDraftPlayers();", context);

vm.runInContext("state.activePlayer='gwazy'; getDraftPlayer('jake').mainPicks=['hoshoryu'];", context);
for (let iteration = 0; iteration < 100; iteration += 1) {
  const candidate = JSON.parse(vm.runInContext("JSON.stringify(randomDraftCandidate('gwazy'))", context));
  assert(candidate, `Random Draft must find a valid roster whenever enough wrestlers remain available (pool: ${vm.runInContext("randomDraftPool('gwazy',true).length", context)})`);
  assert.equal(candidate.mainPicks.length, 6, "Random Draft must generate six main picks");
  assert.equal(candidate.substitutes.length, 3, "Random Draft must generate three substitutes");
  assert(![...candidate.mainPicks, ...candidate.substitutes].includes("hoshoryu"), "Random Draft must exclude wrestlers owned by the opponent");
  assert.equal(vm.runInContext(`mainPickRules(${JSON.stringify(candidate.mainPicks)}).valid`, context), true, "Random Draft main picks must obey all main-roster rules");
  assert.equal(vm.runInContext(`substituteRules(${JSON.stringify(candidate.substitutes)}).valid`, context), true, "Random Draft substitutes must contain one Sanyaku and two Maegashira");
}
vm.runInContext("generateRandomDraft()", context);
vm.runInContext("getDraftPlayer('gwazy').sidePrediction='East'", context);
assert.equal(vm.runInContext("validatePlayerDraft('gwazy').valid", context), true, "Generated working copy must be immediately valid for the selected player");
assert.equal(vm.runInContext("hasUnsavedPlayerChanges('gwazy')", context), true, "Generating must remain an unsaved working-copy change");
vm.runInContext("clearPlayerWorkingDraft(); addRandomPick('main'); addRandomPick('sub');", context);
assert.equal(vm.runInContext("getRoster('gwazy').team.length", context), 1, "Random Main Pick must fill only the next main slot");
assert.equal(vm.runInContext("getRoster('gwazy').subs.length", context), 1, "Random Substitute must fill only the next valid substitute slot");
assert.equal(vm.runInContext("getRoster('jake').team[0]", context), "hoshoryu", "Random and clear actions must never alter the opponent's roster");
vm.runInContext("state.drafts[state.selectedBashoId]=emptyDraftPlayers(); savedSharedDraft.players=emptyDraftPlayers();", context);

assert.equal(vm.runInContext("substituteRules(['onosato','takayasu','abi']).valid", context), true, "A legal substitute roster needs one Sanyaku and two Maegashira");
assert.equal(vm.runInContext("substituteRules(['onosato','hoshoryu','abi']).valid", context), false, "A second Sanyaku substitute must be rejected");
vm.runInContext(`state.activePlayer='gwazy'; savedSharedDraft.playerLocks={gwazy:true,jake:true};savedSharedDraft.locked=true;savedSharedDraft.status='tournament'; state.drafts[state.selectedBashoId].gwazy={mainPicks:['wakatakakage','wakanosho'],substitutes:['onosato','takayasu','abi'],sidePrediction:null,substitutionEvents:[]}; saveState();`, context);
const liveSubstitutions = JSON.parse(vm.runInContext("JSON.stringify(substitutionTimeline('gwazy'))", context));
assert(liveSubstitutions.assignments.some((entry) => entry.mainId === "wakatakakage" && entry.subId === "onosato"), "A Kyujo Sanyaku main pick must activate the Sanyaku substitute");
assert(liveSubstitutions.assignments.some((entry) => entry.mainId === "wakanosho" && entry.subId === "takayasu"), "A Kyujo Maegashira main pick must activate the first Maegashira substitute");
assert(liveSubstitutions.standbySubIds.includes("abi"), "An unused Maegashira substitute must remain on standby");
assert.equal(vm.runInContext("countedPointsForRikishi('gwazy','abi')", context), 0, "A standby substitute must contribute zero points");
assert.equal(vm.runInContext("countedPointsForRikishi('gwazy','onosato')", context), vm.runInContext("pointsThroughDay(getRikishi('onosato'))", context), "An activated substitute must count points only while active");
assert(liveSubstitutions.events.some((event) => event.type === "activated"), "Automatic activations must be present in the live substitution log");
vm.runInContext(`globalThis.__subTestBackup={tobizaru:JSON.parse(JSON.stringify(getRikishi('tobizaru').dailyResults)),takayasu:JSON.parse(JSON.stringify(getRikishi('takayasu').dailyResults))}; for(const day of [8,9]){const result=getRikishi('tobizaru').dailyResults.find((item)=>item.day===day); result.status='absent'; result.kyujo=true; result.completed=false; result.result=null; result.opponentId=null; result.opponentJsaId=null;} getDraftPlayer('gwazy').mainPicks=['wakanosho','tobizaru'];`, context);
const twoMaegashiraReplacements = JSON.parse(vm.runInContext("JSON.stringify(substitutionTimeline('gwazy',9))", context));
assert(twoMaegashiraReplacements.assignments.some((entry) => entry.mainId === "wakanosho" && entry.subId === "takayasu"), "The first withdrawn Maegashira must use the first Maegashira substitute");
assert(twoMaegashiraReplacements.assignments.some((entry) => entry.mainId === "tobizaru" && entry.subId === "abi"), "A second withdrawn Maegashira must use the second Maegashira substitute");
vm.runInContext(`getDraftPlayer('gwazy').mainPicks=['wakanosho']; for(const day of [8,9]){const result=getRikishi('takayasu').dailyResults.find((item)=>item.day===day); result.status='absent'; result.kyujo=true; result.completed=false; result.result=null; result.opponentId=null; result.opponentJsaId=null;}`, context);
const unavailableSubstitute = JSON.parse(vm.runInContext("JSON.stringify(substitutionTimeline('gwazy',9))", context));
assert(unavailableSubstitute.assignments.some((entry) => entry.mainId === "wakanosho" && entry.subId === "abi"), "A withdrawn substitute must be released and the next eligible substitute activated");
assert(unavailableSubstitute.events.some((event) => event.type === "substitute-kyujo" && event.subId === "takayasu"), "A substitute withdrawal must be logged");
vm.runInContext(`getRikishi('tobizaru').dailyResults=__subTestBackup.tobizaru; getRikishi('takayasu').dailyResults=__subTestBackup.takayasu; getDraftPlayer('gwazy').mainPicks=['wakatakakage','wakanosho']; delete globalThis.__subTestBackup;`, context);
location.hash = "#roster";
window.listeners.hashchange();
await new Promise((resolve) => setTimeout(resolve, 160));
assert(app.innerHTML.includes("KYUJO · INACTIVE") && app.innerHTML.includes("ACTIVE SUBSTITUTE") && app.innerHTML.includes("STANDBY · 0 PTS"), "The roster must visually distinguish injured, active-replacement, and standby states");
assert(app.innerHTML.includes("Substitution log") && app.innerHTML.includes("activated for"), "The roster must render its automatic substitution log");
vm.runInContext(`getRikishi('wakanosho').dailyResults[8].status='scheduled'; getRikishi('wakanosho').dailyResults[8].opponentId='abi';`, context);
const returnTimeline = JSON.parse(vm.runInContext("JSON.stringify(substitutionTimeline('gwazy',9))", context));
assert(!returnTimeline.assignments.some((entry) => entry.mainId === "wakanosho"), "A returning main wrestler must automatically reclaim his position");
assert(returnTimeline.events.some((event) => event.type === "returned" && event.mainId === "wakanosho"), "A return from Kyujo must be logged");
vm.runInContext(`getRikishi('wakanosho').dailyResults[8].status=null; getRikishi('wakanosho').dailyResults[8].opponentId=null; savedSharedDraft.playerLocks={gwazy:false,jake:false};savedSharedDraft.locked=false;savedSharedDraft.status='draft'; resetCurrentDraft(); state.activePlayer='jake'; saveState();`, context);

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

vm.runInContext("getDraftPlayer('gwazy').sidePrediction = 'East'; state.history = [{ id: 'kept', basho: 'Previous', winner: 'Gwazy', gwazyScore: 10, jakeScore: 9 }]; resetCurrentDraft();", context);
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('gwazy'))", context)), { team: [], subs: [] }, "Reset Draft must clear the current roster only");
assert.equal(vm.runInContext("getSidePrediction('gwazy')", context), null, "Reset Draft must clear the current prediction");
assert.equal(vm.runInContext("state.history.length", context), 1, "Reset Draft must preserve history");
assert.equal(vm.runInContext("data.meta.day", context), 8, "Reset Draft must leave the official layer untouched");
vm.runInContext("state.history = []; state.activePlayer = 'gwazy'; addPick('kirishima'); state.activePlayer = 'jake'; addPick('hoshoryu'); state.activePlayer = 'gwazy'; saveState();", context);

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
  if (route === "roster") {
    assert(!app.innerHTML.includes("roster-management-panel") && !app.innerHTML.includes("roster-add-main"), "Roster must not render the disconnected dropdown management form");
    assert(app.innerHTML.includes("&rarr; Substitute") && app.innerHTML.includes("&#128465; Remove"), "Main wrestler cards must expose direct move and remove actions");
  }
  if (route === "banzuke") {
    assert.equal((app.innerHTML.match(/data-banzuke-id=/g) || []).length, 42, "The view must render every current Makuuchi rikishi");
    assert.equal(vm.runInContext("banzukeRankRows().length", context), 21, "The data layer must generate all 21 East/West rows");
    assert(app.innerHTML.includes("Daiseizan") && app.innerHTML.includes("Asakoryu"), "The Banzuke must continue through M16 East and West");
    assert(app.innerHTML.includes('data-banzuke-shikona="Yoshinofuji"'), "Yoshinofuji must render from the official dataset");
    assert(app.innerHTML.includes('data-draft-owner="jake"') && app.innerHTML.includes("🔒 Jake"), "The active player must see the other player's picks as locked");
    assert(app.innerHTML.includes('data-draft-available="40"'), "Draft availability must update immediately after two picks");
    assert(app.innerHTML.includes("Add to Main") && !app.innerHTML.includes("Add to Subs"), "Banzuke cards must offer the single action for the section currently being filled");
  }
}
vm.runInContext("state.activePlayer='gwazy'; getDraftPlayer('gwazy').mainPicks=['kirishima','fujinokawa','gonoyama','hiradoumi','ura','nishikifuji']; location.hash='#banzuke'; render();", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert(app.innerHTML.includes("Add to Subs") && !app.innerHTML.includes("Add to Main"), "Banzuke cards must switch to substitute additions once the main roster is full");
assert.equal(browserConsole.errors.length, 0, "A complete official banzuke must produce no coverage errors");
app.innerHTML = "";

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

const corruptSaved = JSON.parse(storage.get("sumoBattleSettings"));
corruptSaved.draftSchemaVersion = 2;
corruptSaved.drafts = { "nagoya-2026": {
  gwazy: { mainPicks: ["onosato"], substitutes: [] },
  jake: { mainPicks: ["onosato", "hoshoryu"], substitutes: ["not-a-rikishi"] },
} };
storage.set("sumoBattleSettings", JSON.stringify(corruptSaved));
vm.runInContext("state = readState();", context);
assert.equal(vm.runInContext("draftOwner('onosato')", context), null, "Browser draft ownership must never override the shared Supabase draft");
assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(getRoster('jake'))", context)), { team: [], subs: [] }, "Legacy browser roster data must be discarded completely");

location.hash = "#history";
vm.runInContext("state.activePlayer = 'jake'; historyEditMode = true; render();", context);
await new Promise((resolve) => setTimeout(resolve, 120));
assert(app.innerHTML.includes("NO ARCHIVED BASHO"), "History must render a clean empty state");
assert(!app.innerHTML.includes("EDITING ARCHIVED BASHO"), "Empty history must not expose a demo editor");
assert.equal(vm.runInContext("calculateHistoryStats().average", context), 0, "Empty history must calculate no statistics");

console.log("Runtime smoke checks passed: Version 3 migration, blank state, staged shared draft, and six routes.");
