import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const load = (path) => readFileSync(new URL(path, root), "utf8");
const context = { window: {} };

runInNewContext(load("data/sumo-data.js"), context);
const data = context.window.SUMO_DATA;
const ids = new Set(data.rikishi.map((rikishi) => rikishi.id));
const currentBasho = data.banzuke.bashos.find((basho) => basho.id === data.banzuke.currentBashoId);

assert.equal(ids.size, data.rikishi.length, "Rikishi IDs must be unique");
assert(currentBasho, "The data layer needs a current banzuke");
assert.equal(currentBasho.division, "Makuuchi", "The current banzuke must be Makuuchi");
assert.equal(currentBasho.entries.length, currentBasho.expectedRikishi, "Every official entry must be present in the dataset");
assert.equal(currentBasho.officialRikishi.length, currentBasho.expectedRikishi, "The untouched official source list must remain available for comparison");
assert.equal(currentBasho.entries.length, 42, "Nagoya 2026 must contain all 42 Makuuchi rikishi");
assert.deepEqual(
  [...new Set(currentBasho.entries.map((entry) => entry.rikishiId))].sort(),
  [...ids].sort(),
  "The current Makuuchi dataset and rikishi layer must match exactly",
);
assert.equal(currentBasho.entries.filter((entry) => entry.side === "East").length, 21, "Every East position must be present");
assert.equal(currentBasho.entries.filter((entry) => entry.side === "West").length, 21, "Every West position must be present");
assert(currentBasho.entries.some((entry) => entry.rank === "Maegashira 16" && entry.side === "East"), "M16 East must render");
assert(currentBasho.entries.some((entry) => entry.rank === "Maegashira 16" && entry.side === "West"), "M16 West must render");
assert.equal(currentBasho.entries.filter((entry) => entry.rank === "Sekiwake").length, 4, "Variable Sekiwake seats must remain in the data");
assert(currentBasho.entries.some((entry) => entry.shikona === "Yoshinofuji"), "Yoshinofuji must reach the parsed dataset");
assert.deepEqual(
  [...new Set(currentBasho.officialRikishi.map((entry) => entry.shikona))].sort(),
  [...new Set(currentBasho.entries.map((entry) => entry.shikona))].sort(),
  "Official and parsed shikona sets must match exactly",
);
assert.equal(data.meta.totalDays, 15, "A basho has fifteen days");
assert(data.meta.day >= 0 && data.meta.day <= 15, "The official layer must expose a valid current day");
assert(data.meta.day > 0, "The restored JSA snapshot must not erase published tournament days");
assert.equal(data.players.length, 2, "The league has exactly two players");
assert.deepEqual([...data.players.map((player) => player.id)].sort(), ["gwazy", "jake"], "Only Gwazy and Jake may be players");

for (const player of data.players) {
  assert.equal(player.team.length, 0, `${player.name} must start a new basho with zero starters`);
  assert.equal(player.subs.length, 0, `${player.name} must start a new basho with zero substitutes`);
  assert.equal(player.score, 0, `${player.name} must start with zero points`);
  assert.equal(player.today, 0, `${player.name} must start with zero daily points`);
  assert.equal(player.sidePrediction, null, `${player.name} must start without a side prediction`);
  assert.equal(player.favouriteWrestler, "", `${player.name} must start without a favourite wrestler`);
  assert.equal(player.daily.length, 0, `${player.name} must start without timeline data`);
  assert(!Object.hasOwn(player, "projection"), `${player.name} must not have forecast seed data`);
  for (const id of [...player.team, ...player.subs]) {
    assert(ids.has(id), `${player.name} references unknown rikishi: ${id}`);
  }
}

assert(data.rikishi.some((rikishi) => rikishi.wins > 0 || rikishi.losses > 0), "Published official records must survive a draft reset");
assert(data.rikishi.every((rikishi) => Number.isFinite(rikishi.wins) && Number.isFinite(rikishi.losses)), "Every rikishi needs numeric official records");
assert(data.rikishi.every((rikishi) => Array.isArray(rikishi.kyujoDays) && typeof rikishi.currentKyujo === "boolean"), "Every official rikishi needs day-specific Kyujo status");
assert(data.rikishi.some((rikishi) => rikishi.currentKyujo && rikishi.dailyResults.some((result) => result.kyujo)), "The current snapshot must preserve official withdrawal days");
assert(data.bouts.length > 0, "The official layer must include the latest published Makuuchi results");
assert.equal(data.history.length, 0, "Version 3 must not ship previous basho history");

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
const sharedDraftApi = load("shared-draft.js");
const imageResolver = load("image-resolver.js");
const css = load("styles.css");
for (const asset of ["styles.css", "data/sumo-data.js", "image-resolver.js", "supabase-config.js", "shared-draft.js", "app.js"]) {
  assert(html.includes(asset), `index.html must reference ${asset}`);
}
assert(existsSync(new URL("assets/rikishi-placeholder.svg", root)), "The silhouette fallback asset must exist");
for (const match of [...app.matchAll(/assets\/[^"']+/g)]) {
  assert(existsSync(new URL(match[0], root)), `Missing app asset: ${match[0]}`);
}
assert(css.includes("@media (max-width: 620px)"), "Small-screen breakpoint must be present");
assert(css.includes("prefers-reduced-motion"), "Reduced-motion support must be present");
assert(html.includes('id="active-player-select"'), "The header needs a player selector");
assert(app.includes("localStorage.setItem(SETTINGS_STORAGE_KEY"), "Browser preferences must persist locally");
assert(app.includes("APP_SAVE_VERSION = 3"), "Version 3 must have an explicit save migration version");
assert(app.includes("drafts: undefined"), "The shared roster must never be written into browser localStorage");
assert(app.includes("data-overview-empty") && app.includes("data-history-empty"), "Blank Overview and History states must be present");
for (const capability of ["data-add-pick", "data-roster-move", "data-history-edit", "calculateHistoryStats", "sidePrediction", "substituteRules", "substitutionTimeline", "data-sub-reorder"]) {
  assert(app.includes(capability), `Missing player-system capability: ${capability}`);
}
for (const capability of ["DRAFT_SCHEMA_VERSION", "normalizeDrafts", "draftOwner", "draftPoolStats", "data-draft-owner", "data-overview-roster", "draft-owner-gwazy", "draft-owner-jake"]) {
  assert(app.includes(capability) || css.includes(capability), `Missing shared-draft capability: ${capability}`);
}
for (const capability of ["data-save-draft", "validateSharedDraft", "hasUnsavedDraftChanges", "beforeunload", "lastSavedAt", "savedBy", "data-lock-my-draft", "lockMyDraft", "playerLocks", "applyRealtimeSharedDraft", "subscribeToSharedDraft"]) {
  assert(app.includes(capability), `Missing realtime shared-roster capability: ${capability}`);
}
for (const capability of ["bashoDayTimeline", "tournamentStarted", "tournamentFinished", "championOverviewView", "data-skip-basho", "Tournament Skipped"]) {
  assert(app.includes(capability), `Missing tournament lifecycle capability: ${capability}`);
}
for (const capability of ["TOURNAMENT PROGRESS", "DRAFT PROGRESS", "data-overview-day", "overviewSelectedDay", "progressDots"]) {
  assert(app.includes(capability), `Missing dynamic Overview hero capability: ${capability}`);
}
for (const capability of ["validatePlayerDraft", "hasUnsavedPlayerChanges", "ownershipConflicts", "adoptLatestWhilePreservingPlayer", "latest.document", "attempt < 3", "just been drafted by"]) {
  assert(app.includes(capability), `Missing simultaneous player-save capability: ${capability}`);
}
for (const removedControl of ["roster-management-panel", "data-roster-add", "data-roster-replace", "data-swap-pick", "data-replace-sub", "Add main wrestler", "Add substitute<select", "Replace main<select", "Change substitute<select"]) {
  assert(!app.includes(removedControl), `Obsolete dropdown or swap UI must be removed: ${removedControl}`);
}
for (const directControl of ["&rarr; Substitute", "&larr; Main", "&#128465; Remove", "Add to Main", "Add to Subs"]) {
  assert(app.includes(directControl), `Missing direct card-management control: ${directControl}`);
}
for (const capability of ["data-overview-analytics", "data-overview-standings", "data-overview-forecast", "data-overview-momentum", "projectedPlayerScore", "forecastModel", "momentumChart"]) {
  assert(app.includes(capability), `Missing restored Overview analytics capability: ${capability}`);
}
for (const capability of ["data-random-draft", "data-clear-player-draft", "data-random-pick", "randomDraftCandidate", "generateRandomDraft", "addRandomPick", "random-draft-dialog"]) {
  assert(app.includes(capability) || css.includes(capability), `Missing random draft capability: ${capability}`);
}
for (const capability of ["draftImpactBoutCard", "resultDraftImpact", "dailyDraftSummary", "applyResultsFilter", "data-results-daily-stats", "data-results-filter", "My Draft", "Important Bouts", "result-owner-badge", "result-point-award"]) {
  assert(app.includes(capability) || css.includes(capability), `Missing draft-focused Results capability: ${capability}`);
}
const resultsCardSource = app.slice(app.indexOf("function draftImpactBoutCard"), app.indexOf("function dailyDraftSummary"));
assert(!resultsCardSource.includes('"Official"'), "Results cards must replace the Official badge with draft ownership");
assert(!app.includes("FORM GUIDE"), "The obsolete Overview Form Guide card must remain removed");
for (const capability of ["createClient", "save_shared_draft", "postgres_changes", "SHARED_DRAFT_API", "p_expected_revision", "setupStatus", "Project URL", "Publishable Key"]) {
  assert(sharedDraftApi.includes(capability), `Missing shared draft transport capability: ${capability}`);
}
assert(app.includes("supabase_realtime publication"), "Realtime setup failures must identify the missing publication");
for (const removedCredentialPath of ["api.github.com/repos", "sessionStorage", "Authorization", "setToken", "GitHub write token"]) {
  assert(!sharedDraftApi.includes(removedCredentialPath), `Personal GitHub credential path must be removed: ${removedCredentialPath}`);
}
for (const capability of ["banzukeRankRows", "data-banzuke-id", "data-banzuke-shikona", "applyBanzukeFilters", "verifyBanzukeIntegrity", "rikishi missing from rendered banzuke", "Rendered ✗", "Not parsed", "console.error"]) {
  assert(app.includes(capability), `Missing complete-banzuke capability: ${capability}`);
}
assert(!app.includes("const pairs = ["), "Banzuke rows must not be hardcoded in the view");
assert(!app.includes("byPosition.get(key)[entry.side] = entry"), "Same-rank, same-side wrestlers must never overwrite each other");
assert(data.rikishi.every((rikishi) => rikishi.photo?.includes("sumo.or.jp/img/sumo_data/rikishi/")), "Every Makuuchi rikishi needs an official photo");
assert(data.rikishi.every((rikishi) => rikishi.id && rikishi.shikona && rikishi.jsaId && rikishi.profile), "Every rikishi needs stable JSA identity metadata");
assert(data.rikishi.every((rikishi) => Object.hasOwn(rikishi, "wikipedia")), "Every rikishi needs a stable Wikipedia resolver slot, even when unresolved");
assert(app.includes('loading="lazy"') && app.includes("data-rikishi-image"), "Rikishi images must use lazy resolver markup");
assert(!app.includes("fallback-initials"), "The single-letter image fallback must be removed");
const resolverStages = ["assets/rikishi/${rikishi.id}.webp", "rikishi.jsaPortrait", "lookupWikipediaPortrait(rikishi)", "PLACEHOLDER_PATH"];
const resolverFlow = imageResolver.slice(imageResolver.indexOf("async function resolveUncached"), imageResolver.indexOf("function resolve(rikishi)"));
for (let index = 1; index < resolverStages.length; index += 1) {
  assert(resolverFlow.indexOf(resolverStages[index - 1]) < resolverFlow.indexOf(resolverStages[index]), "Image sources must remain in local, JSA, Wikipedia, placeholder order");
}
assert(imageResolver.includes('origin: "*"'), "Wikipedia API calls must support unauthenticated CORS");
assert(imageResolver.includes("IntersectionObserver"), "Offscreen portraits must resolve lazily");

for (const textFile of ["index.html", "styles.css", "app.js", "image-resolver.js", "data/sumo-data.js"]) {
  const contents = load(textFile);
  assert(!contents.includes("Ã"), `${textFile} contains likely mojibake`);
  assert(!contents.includes("â€“"), `${textFile} contains likely mojibake`);
}

for (const separatedFile of [
  "data/official/basho.json",
  "data/official/banzuke.json",
  "data/official/rikishi.json",
  "data/official/results.json",
  "data/draft/history.json",
  "data/draft/players.json",
  "scripts/update-official-data.mjs",
  ".github/workflows/update-jsa-data.yml",
]) {
  assert(existsSync(new URL(separatedFile, root)), `Missing separated data/update file: ${separatedFile}`);
}
const updateWorkflow = load(".github/workflows/update-jsa-data.yml");
assert(updateWorkflow.includes("scripts/update-official-data.mjs") && updateWorkflow.includes("git add data/official data/sumo-data.js"), "GitHub Actions must update only the official JSA layer");
for (const forbiddenWorkflowTask of ["deploy-pages", "upload-pages-artifact", "shared-draft.js", "data/draft", "github.event_name == 'push'"]) {
  assert(!updateWorkflow.includes(forbiddenWorkflowTask), `The JSA workflow must not manage application or draft persistence: ${forbiddenWorkflowTask}`);
}
assert(app.includes("resetCurrentDraft") && app.includes("data-reset-draft"), "Reset must be scoped to the current draft layer");
assert(app.includes("playerScore") && app.includes("pointsThroughDay"), "Draft scores must recalculate from official results");
assert(existsSync(new URL("supabase/schema.sql", root)), "Supabase schema and conflict-safe save function must be included");
const supabaseSchema = load("supabase/schema.sql");
assert(supabaseSchema.includes("on conflict on constraint shared_drafts_pkey"), "The first-save upsert must avoid PL/pgSQL output-column ambiguity");
assert(!supabaseSchema.includes("on conflict (basho_id)"), "The Supabase save function must not use an ambiguous basho_id conflict target");
assert(!existsSync(new URL("data/draft/current-draft.json", root)), "The live shared draft must not be committed to the repository");

console.log(`Smoke checks passed: ${data.rikishi.length} rikishi, ${data.bouts.length} bouts, ${data.history.length} archived basho.`);
