/* global SUMO_DATA */

const data = window.SUMO_DATA;
const app = document.querySelector("#app");
const dialog = document.querySelector("#profile-dialog");
const profileContent = document.querySelector("#profile-content");
const toast = document.querySelector("#toast");
const soundButton = document.querySelector("#sound-toggle");
const playerSelect = document.querySelector("#active-player-select");
const playerLabel = document.querySelector("#active-player-label");

const icons = {
  spark: "✦",
  trophy: "♛",
  flame: "♨",
  arrow: "↗",
  source: "↗",
  calendar: "▣",
  pin: "◆",
  pulse: "⌁",
};

const APP_SAVE_VERSION = 3;
const DRAFT_SCHEMA_VERSION = 3;
const SETTINGS_STORAGE_KEY = "sumoBattleSettings";
const HISTORY_STORAGE_KEY = "sumoBattleHistoryCache";

const defaultPlayers = Object.fromEntries(
  data.players.map((player) => [player.id, {
    favouriteWrestler: player.favouriteWrestler || "",
    notes: "",
  }]),
);

function emptyDraftPlayers() {
  return Object.fromEntries(data.players.map((player) => [player.id, {
    mainPicks: [],
    substitutes: [],
    sidePrediction: null,
    substitutionEvents: [],
  }]));
}

function emptyDrafts() {
  return Object.fromEntries(data.banzuke.bashos.map((basho) => [basho.id, emptyDraftPlayers()]));
}

function normalizeDrafts(saved) {
  if (saved.draftSchemaVersion !== DRAFT_SCHEMA_VERSION || !saved.drafts) return emptyDrafts();
  const drafts = Object.fromEntries(Object.entries(saved.drafts).map(([bashoId, bashoDraft]) => [bashoId,
    Object.fromEntries(data.players.map((player) => {
      const previous = bashoDraft?.[player.id] || {};
      return [player.id, {
        mainPicks: Array.isArray(previous.mainPicks) ? previous.mainPicks.filter((id) => typeof id === "string").slice(0, 6) : [],
        substitutes: Array.isArray(previous.substitutes) ? previous.substitutes.filter((id) => typeof id === "string").slice(0, 3) : [],
        sidePrediction: ["East", "West"].includes(previous.sidePrediction) ? previous.sidePrediction : null,
        substitutionEvents: Array.isArray(previous.substitutionEvents) ? previous.substitutionEvents : [],
      }];
    })),
  ]));

  data.banzuke.bashos.forEach((basho) => {
    drafts[basho.id] = emptyDraftPlayers();
    const validIds = new Set(basho.entries.map((entry) => entry.rikishiId));
    const owned = new Set();
    data.players.forEach((player) => {
      const stored = saved.drafts?.[basho.id]?.[player.id] || {};
      const normalizeList = (values, limit) => {
        const result = [];
        (Array.isArray(values) ? values : []).forEach((id) => {
          if (result.length >= limit || !validIds.has(id) || owned.has(id)) return;
          owned.add(id);
          result.push(id);
        });
        return result;
      };
      drafts[basho.id][player.id] = {
        mainPicks: normalizeList(stored.mainPicks, 6),
        substitutes: normalizeList(stored.substitutes, 3),
        sidePrediction: ["East", "West"].includes(stored.sidePrediction)
          ? stored.sidePrediction
          : ["East", "West"].includes(saved.players?.[player.id]?.sidePrediction)
            ? saved.players[player.id].sidePrediction
            : null,
        substitutionEvents: Array.isArray(stored.substitutionEvents) ? stored.substitutionEvents : [],
      };
    });
  });
  return drafts;
}

const defaults = {
  theme: "midnight",
  sound: false,
  reducedMotion: false,
  compact: false,
  activePlayer: "gwazy",
  selectedBashoId: data.banzuke?.currentBashoId || "",
  selectedDay: Math.max(1, data.meta.day),
  players: defaultPlayers,
  appVersion: APP_SAVE_VERSION,
  draftSchemaVersion: DRAFT_SCHEMA_VERSION,
  drafts: emptyDrafts(),
  history: JSON.parse(JSON.stringify(data.history)),
  officialBashoId: data.meta.bashoId || "",
  officialDataSignature: data.meta.dataSignature || "",
};

function blankHistoryEvent() {
  return {
    rosters: { gwazy: [], jake: [] },
    predictions: { gwazy: null, jake: null },
    bonusPoints: { gwazy: 0, jake: 0 },
    notes: { gwazy: "", jake: "" },
    bestPicks: { gwazy: "", jake: "" },
    worstPicks: { gwazy: "", jake: "" },
  };
}

const readState = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    const compatible = stored.appVersion === APP_SAVE_VERSION;
    const historyCache = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "{}");
    const saved = compatible ? stored : {
      theme: stored.theme,
      sound: stored.sound,
      reducedMotion: stored.reducedMotion,
      compact: stored.compact,
      activePlayer: stored.activePlayer,
      players: stored.players,
      history: Array.isArray(historyCache.events) ? historyCache.events : stored.history,
    };
    const players = Object.fromEntries(data.players.map((player) => {
      const stored = saved.players?.[player.id] || {};
      const base = defaultPlayers[player.id];
      return [player.id, {
        ...base,
        ...stored,
        mainPicks: undefined,
        substitutes: undefined,
        sidePrediction: undefined,
      }];
    }));
    const history = Array.isArray(saved.history) && saved.history.every((event) => Number.isFinite(event.gwazyScore))
      ? saved.history.map((event) => {
        const base = defaults.history.find((item) => item.id === event.id) || blankHistoryEvent();
        return {
          ...base,
          ...event,
          rosters: { ...base.rosters, ...(event.rosters || {}) },
          predictions: { ...base.predictions, ...(event.predictions || {}) },
          bonusPoints: { ...base.bonusPoints, ...(event.bonusPoints || {}) },
          notes: { ...base.notes, ...(event.notes || {}) },
          bestPicks: { ...base.bestPicks, ...(event.bestPicks || {}) },
          worstPicks: { ...base.worstPicks, ...(event.worstPicks || {}) },
        };
      })
      : JSON.parse(JSON.stringify(defaults.history));
    const activePlayer = data.players.some((player) => player.id === saved.activePlayer) ? saved.activePlayer : defaults.activePlayer;
    const selectedBashoId = data.banzuke?.bashos.some((basho) => basho.id === saved.selectedBashoId)
      ? saved.selectedBashoId
      : defaults.selectedBashoId;
    // Rosters are never restored from localStorage. The repository-backed shared
    // draft is loaded after startup and remains the single source of truth.
    const drafts = emptyDrafts();
    const officialBashoId = saved.officialBashoId || defaults.officialBashoId;
    const officialChanged = saved.officialDataSignature && saved.officialDataSignature !== data.meta.dataSignature;
    const selectedDay = officialChanged ? Math.max(1, data.meta.day) : Number(saved.selectedDay || defaults.selectedDay);
    return { ...defaults, ...saved, appVersion: APP_SAVE_VERSION, activePlayer, selectedBashoId, selectedDay, players, drafts, draftSchemaVersion: DRAFT_SCHEMA_VERSION, history, officialBashoId, officialDataSignature: data.meta.dataSignature };
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    return JSON.parse(JSON.stringify(defaults));
  }
};

let state = readState();
let pendingSwap = null;
let pendingSubstituteReplacement = null;
let historyEditMode = false;
let activeHistoryId = state.history[0]?.id || null;
let banzukeProfileTimer = null;
let sharedDraftSha = null;
let savedSharedDraft = null;
let sharedDraftLoading = true;
let sharedDraftSaving = false;
let sharedDraftError = null;
let sharedValidationErrors = [];

function saveState() {
  try {
    const localState = { ...state, drafts: undefined };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(localState));
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ version: APP_SAVE_VERSION, updated: new Date().toISOString(), events: state.history }));
  } catch {
    showToast("This browser is blocking local saves.");
  }
}

function normalizedSharedPlayers(players = {}) {
  const validIds = new Set(selectedBasho().entries.map((entry) => entry.rikishiId));
  const owned = new Set();
  return Object.fromEntries(data.players.map((player) => {
    const source = players[player.id] || {};
    const normalizeList = (values, limit) => {
      const list = [];
      (Array.isArray(values) ? values : []).forEach((id) => {
        if (list.length >= limit || !validIds.has(id) || owned.has(id)) return;
        owned.add(id);
        list.push(id);
      });
      return list;
    };
    return [player.id, {
      mainPicks: normalizeList(source.mainPicks, 6),
      substitutes: normalizeList(source.substitutes, 3),
      sidePrediction: ["East", "West"].includes(source.sidePrediction) ? source.sidePrediction : null,
      substitutionEvents: Array.isArray(source.substitutionEvents) ? source.substitutionEvents : [],
    }];
  }));
}

function sharedComparable(players = state.drafts[state.selectedBashoId] || emptyDraftPlayers()) {
  return Object.fromEntries(data.players.map((player) => {
    const draft = players[player.id] || {};
    return [player.id, {
      mainPicks: [...(draft.mainPicks || [])],
      substitutes: [...(draft.substitutes || [])],
      sidePrediction: draft.sidePrediction || null,
    }];
  }));
}

function sharedPayloadPlayers(players = state.drafts[state.selectedBashoId] || emptyDraftPlayers()) {
  const comparable = sharedComparable(players);
  return Object.fromEntries(data.players.map((player) => [player.id, {
    ...comparable[player.id],
    substitutionEvents: [...(players[player.id]?.substitutionEvents || [])],
  }]));
}

function hasUnsavedDraftChanges() {
  if (!savedSharedDraft || sharedDraftLoading) return false;
  return JSON.stringify(sharedComparable()) !== JSON.stringify(sharedComparable(savedSharedDraft.players));
}

function draftEditingDisabled() {
  return sharedDraftLoading || sharedDraftSaving || Boolean(savedSharedDraft?.locked);
}

function applySharedDraft(document, sha = null) {
  const bashoId = document.bashoId || data.banzuke.currentBashoId;
  if (!data.banzuke.bashos.some((basho) => basho.id === bashoId)) throw new Error("The shared draft belongs to an unavailable basho.");
  state.selectedBashoId = bashoId;
  const players = normalizedSharedPlayers(document.players);
  state.drafts[bashoId] = JSON.parse(JSON.stringify(players));
  savedSharedDraft = { ...document, bashoId, players: JSON.parse(JSON.stringify(players)) };
  sharedDraftSha = sha;
  sharedDraftError = null;
  sharedValidationErrors = [];
  saveState();
}

async function loadSharedDraft({ force = false } = {}) {
  if (!window.SHARED_DRAFT_API) {
    sharedDraftLoading = false;
    sharedDraftError = "Shared draft service is unavailable.";
    render();
    return;
  }
  if (hasUnsavedDraftChanges() && !force) return;
  sharedDraftLoading = true;
  sharedDraftError = null;
  render();
  try {
    const result = await window.SHARED_DRAFT_API.load();
    applySharedDraft(result.document, result.sha);
  } catch (error) {
    sharedDraftError = error.message || "The shared draft could not be loaded.";
  } finally {
    sharedDraftLoading = false;
    render();
  }
}

async function refreshSharedDraft() {
  if (hasUnsavedDraftChanges() && !window.confirm("You have unsaved changes. Do you want to discard them?")) return;
  await loadSharedDraft({ force: true });
}

function validateSharedDraft() {
  const errors = [];
  const allIds = [];
  data.players.forEach((player) => {
    const check = validateRoster(player.id);
    if (check.team !== 6) errors.push(`${player.name} needs exactly 6 main picks.`);
    if (check.subs !== 3) errors.push(`${player.name} needs exactly 3 substitutes.`);
    if (check.sanyaku > 2) errors.push(`${player.name} has more than 2 Sanyaku main picks.`);
    if (check.underdogs !== 1) errors.push(`${player.name} needs exactly 1 M13-M17 underdog.`);
    if (check.substituteSanyaku !== 1) errors.push(`${player.name} needs exactly 1 Sanyaku substitute.`);
    if (check.substituteMaegashira !== 2) errors.push(`${player.name} needs exactly 2 Maegashira substitutes.`);
    const roster = getRoster(player.id);
    allIds.push(...roster.team, ...roster.subs);
  });
  const duplicates = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];
  duplicates.forEach((id) => errors.push(`${getRikishi(id)?.name || id} appears more than once in the shared draft.`));
  return { valid: errors.length === 0, errors };
}

async function saveSharedDraft() {
  if (sharedDraftSaving || savedSharedDraft?.locked) return;
  const validation = validateSharedDraft();
  sharedValidationErrors = validation.errors;
  if (!validation.valid) {
    render();
    showToast("The shared draft is not valid yet. Review the highlighted errors.");
    return;
  }
  sharedDraftSaving = true;
  render();
  try {
    syncAllSubstitutionEvents();
    const document = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      bashoId: state.selectedBashoId,
      revision: Number(savedSharedDraft?.revision || 0) + 1,
      locked: Boolean(savedSharedDraft?.locked),
      lastSavedAt: new Date().toISOString(),
      savedBy: getPlayerDefinition().name,
      players: sharedPayloadPlayers(),
    };
    const result = await window.SHARED_DRAFT_API.save(document, sharedDraftSha);
    applySharedDraft(result.document, result.sha);
    playBell();
    showToast(`Shared picks saved by ${document.savedBy}.`);
  } catch (error) {
    sharedDraftError = error.message || "The shared draft could not be saved.";
    showToast(sharedDraftError);
  } finally {
    sharedDraftSaving = false;
    render();
  }
}

async function toggleSharedDraftLock() {
  if (sharedDraftLoading || sharedDraftSaving || !savedSharedDraft) return;
  const nextLocked = !Boolean(savedSharedDraft.locked);
  if (hasUnsavedDraftChanges()) {
    showToast("Save or discard the working copy before changing the draft lock.");
    return;
  }
  if (nextLocked) {
    const validation = validateSharedDraft();
    sharedValidationErrors = validation.errors;
    if (!validation.valid) {
      render();
      showToast("Only a complete, valid draft can be locked.");
      return;
    }
  }
  sharedDraftSaving = true;
  render();
  try {
    const document = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      bashoId: state.selectedBashoId,
      revision: Number(savedSharedDraft.revision || 0) + 1,
      locked: nextLocked,
      lastSavedAt: new Date().toISOString(),
      savedBy: getPlayerDefinition().name,
      players: sharedPayloadPlayers(),
    };
    const result = await window.SHARED_DRAFT_API.save(document, sharedDraftSha);
    applySharedDraft(result.document, result.sha);
    showToast(nextLocked ? "The shared draft is now locked." : "The shared draft is unlocked for editing.");
  } catch (error) {
    sharedDraftError = error.message || "The draft lock could not be changed.";
    showToast(sharedDraftError);
  } finally {
    sharedDraftSaving = false;
    render();
  }
}

// Persist clean local preferences immediately after any one-time migration.
saveState();

function getPlayerDefinition(id = state.activePlayer) {
  return data.players.find((player) => player.id === id);
}

function getPlayerState(id = state.activePlayer) {
  return state.players[id];
}

function getDraftPlayer(id = state.activePlayer, bashoId = state.selectedBashoId) {
  if (!state.drafts[bashoId]) state.drafts[bashoId] = emptyDraftPlayers();
  if (!state.drafts[bashoId][id]) state.drafts[bashoId][id] = { mainPicks: [], substitutes: [], sidePrediction: null, substitutionEvents: [] };
  return state.drafts[bashoId][id];
}

function getSidePrediction(id = state.activePlayer, bashoId = state.selectedBashoId) {
  return getDraftPlayer(id, bashoId).sidePrediction || null;
}

function getRoster(id = state.activePlayer, bashoId = state.selectedBashoId) {
  const draft = getDraftPlayer(id, bashoId);
  return { team: draft.mainPicks, subs: draft.substitutes };
}

function isSanyaku(rikishi) {
  return Boolean(rikishi && ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"].includes(rikishi.rank));
}

function isMaegashira(rikishi) {
  return Boolean(rikishi?.rank?.startsWith("Maegashira"));
}

function substituteRules(ids) {
  const picks = ids.map(getRikishi).filter(Boolean);
  const sanyaku = picks.filter(isSanyaku).length;
  const maegashira = picks.filter(isMaegashira).length;
  return {
    sanyaku,
    maegashira,
    valid: ids.length <= 3 && sanyaku <= 1 && maegashira <= 2 && (ids.length < 3 || (sanyaku === 1 && maegashira === 2)),
  };
}

function rikishiDayStatus(rikishi, day) {
  const result = rikishi?.dailyResults?.find((item) => item.day === day);
  if (!result) return null;
  if (result.status) return result.status;
  if (result.kyujo) return "absent";
  if (result.result) return result.result;
  if (result.opponentId || result.opponentJsaId) return "scheduled";
  return null;
}

function isKyujoOnDay(rikishi, day) {
  if (!rikishi || day < 1) return false;
  const status = rikishiDayStatus(rikishi, day);
  if (["absent", "forfeit-loss"].includes(status)) return true;
  if (["win", "loss", "forfeit-win", "scheduled", "completed"].includes(status)) return false;
  return day <= (data.meta.scheduledThroughDay || data.meta.day) && isKyujoOnDay(rikishi, day - 1);
}

function currentLineupDay() {
  return Math.max(0, data.meta.day || 0, data.meta.scheduledThroughDay || 0);
}

function substitutionTimeline(playerId, throughDay = currentLineupDay()) {
  const roster = getRoster(playerId);
  const mainPicks = roster.team.map(getRikishi).filter(Boolean);
  const substitutes = roster.subs.map(getRikishi).filter(Boolean);
  const assignments = new Map();
  const events = [];
  const byDay = new Map();

  for (let day = 1; day <= throughDay; day += 1) {
    for (const [mainId, subId] of [...assignments]) {
      const main = getRikishi(mainId);
      const substitute = getRikishi(subId);
      const mainStillKyujo = isKyujoOnDay(main, day);
      const substituteKyujo = isKyujoOnDay(substitute, day);
      if (mainStillKyujo && !substituteKyujo) continue;
      assignments.delete(mainId);
      const type = mainStillKyujo ? "substitute-kyujo" : "returned";
      events.push({ id: `${playerId}-${day}-${type}-${mainId}-${subId}`, day, type, mainId, subId });
    }

    const occupiedSubstitutes = new Set(assignments.values());
    for (const main of mainPicks) {
      if (!isKyujoOnDay(main, day) || assignments.has(main.id)) continue;
      const categoryTest = isSanyaku(main) ? isSanyaku : isMaegashira;
      const substitute = substitutes.find((candidate) => categoryTest(candidate) && !occupiedSubstitutes.has(candidate.id) && !isKyujoOnDay(candidate, day));
      if (!substitute) continue;
      assignments.set(main.id, substitute.id);
      occupiedSubstitutes.add(substitute.id);
      events.push({ id: `${playerId}-${day}-activated-${main.id}-${substitute.id}`, day, type: "activated", mainId: main.id, subId: substitute.id });
    }

    const inactiveMainIds = mainPicks.filter((main) => isKyujoOnDay(main, day)).map((main) => main.id);
    const activeMainIds = mainPicks.filter((main) => !inactiveMainIds.includes(main.id)).map((main) => main.id);
    const activeSubIds = [...assignments.values()];
    byDay.set(day, {
      day,
      assignments: [...assignments].map(([mainId, subId]) => ({ mainId, subId })),
      inactiveMainIds,
      activeMainIds,
      activeSubIds,
      activeIds: [...activeMainIds, ...activeSubIds],
    });
  }

  const current = byDay.get(throughDay) || { day: throughDay, assignments: [], inactiveMainIds: [], activeMainIds: mainPicks.map((main) => main.id), activeSubIds: [], activeIds: mainPicks.map((main) => main.id) };
  const standbySubstitutes = substitutes.filter((substitute) => !current.activeSubIds.includes(substitute.id));
  return {
    ...current,
    byDay,
    events,
    standbySubIds: standbySubstitutes.map((substitute) => substitute.id),
    unavailableSubIds: standbySubstitutes.filter((substitute) => isKyujoOnDay(substitute, throughDay)).map((substitute) => substitute.id),
  };
}

function syncAllSubstitutionEvents() {
  if (!state?.drafts) return;
  for (const player of data.players) {
    const draft = getDraftPlayer(player.id);
    draft.substitutionEvents = substitutionTimeline(player.id).events;
  }
}

function pointsThroughDay(rikishi, day = data.meta.day) {
  const results = (rikishi.dailyResults || []).filter((result) => result.day <= day && result.completed);
  const wins = results.filter((result) => result.result === "win").length;
  const losses = results.filter((result) => result.result === "loss").length;
  let kinboshi = 0;
  for (const officialDay of data.results?.days || []) {
    if (officialDay.day > day) continue;
    for (const bout of officialDay.bouts || []) {
      if (bout.completed && bout.winner === rikishi.id) {
        const loserId = bout.winner === bout.east ? bout.west : bout.east;
        if (rikishi.rank.startsWith("Maegashira") && getRikishi(loserId)?.rank === "Yokozuna") kinboshi += 1;
      }
    }
  }
  return wins - (losses >= 8 ? 1 : 0) + (kinboshi * 3);
}

function sideWinner(day = data.meta.day) {
  if (day < data.meta.totalDays) return null;
  const totals = data.meta.sideTotals || { East: 0, West: 0 };
  return totals.East === totals.West ? null : totals.East > totals.West ? "East" : "West";
}

function playerScore(id, day = data.meta.day) {
  const timeline = substitutionTimeline(id, day);
  let pickPoints = 0;
  for (let currentDay = 1; currentDay <= day; currentDay += 1) {
    const lineup = timeline.byDay.get(currentDay);
    for (const rikishiId of lineup?.activeIds || []) {
      const rikishi = getRikishi(rikishiId);
      pickPoints += pointsThroughDay(rikishi, currentDay) - pointsThroughDay(rikishi, currentDay - 1);
    }
  }
  return pickPoints + (getSidePrediction(id) && getSidePrediction(id) === sideWinner(day) ? 20 : 0);
}

function playerDayScore(id, day = data.meta.day) {
  if (day < 1) return 0;
  return playerScore(id, day) - playerScore(id, day - 1);
}

function countedPointsForRikishi(playerId, rikishiId, day = data.meta.day) {
  const timeline = substitutionTimeline(playerId, day);
  const rikishi = getRikishi(rikishiId);
  let points = 0;
  for (let currentDay = 1; currentDay <= day; currentDay += 1) {
    if (!timeline.byDay.get(currentDay)?.activeIds.includes(rikishiId)) continue;
    points += pointsThroughDay(rikishi, currentDay) - pointsThroughDay(rikishi, currentDay - 1);
  }
  return points;
}

function hasNewOfficialBasho() {
  return Boolean(state.officialBashoId && data.meta.bashoId && state.officialBashoId !== data.meta.bashoId);
}

function newBashoNotice() {
  if (!hasNewOfficialBasho()) return "";
  return `<aside class="new-basho-notice" role="status"><span>新</span><div><small>OFFICIAL BASHO DETECTED</small><b>A new basho has begun.</b><p>The JSA layer is already updated. Your history and previous drafts are protected.</p></div><button class="primary-button" type="button" data-start-new-draft>Start a new draft</button></aside>`;
}

function resetCurrentDraft() {
  if (savedSharedDraft?.locked) return;
  state.drafts[state.selectedBashoId] = emptyDraftPlayers();
  pendingSwap = null;
  pendingSubstituteReplacement = null;
  sharedValidationErrors = [];
}

function startNewOfficialBashoDraft() {
  state.selectedBashoId = data.banzuke.currentBashoId;
  state.drafts[state.selectedBashoId] = emptyDraftPlayers();
  state.officialBashoId = data.meta.bashoId;
  state.officialDataSignature = data.meta.dataSignature;
  state.selectedDay = Math.max(1, data.meta.day);
  pendingSwap = null;
  pendingSubstituteReplacement = null;
  savedSharedDraft = { schemaVersion: DRAFT_SCHEMA_VERSION, bashoId: state.selectedBashoId, revision: 0, locked: false, lastSavedAt: null, savedBy: null, players: emptyDraftPlayers() };
  sharedValidationErrors = [];
}

function draftOwner(rikishiId, bashoId = state.selectedBashoId) {
  return data.players.find((player) => {
    const roster = getRoster(player.id, bashoId);
    return roster.team.includes(rikishiId) || roster.subs.includes(rikishiId);
  })?.id || null;
}

function draftPoolStats(basho = selectedBasho()) {
  const counts = Object.fromEntries(data.players.map((player) => {
    const roster = getRoster(player.id, basho.id);
    return [player.id, new Set([...roster.team, ...roster.subs]).size];
  }));
  const drafted = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    total: basho.entries.length,
    available: Math.max(0, basho.entries.length - drafted),
    drafted,
    counts,
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRikishi(id) {
  return data.rikishi.find((rikishi) => rikishi.id === id);
}

function wrestlerImage(rikishi, size = "small") {
  return `<span class="rikishi-image ${size} uses-placeholder is-resolving" style="--form:${rikishi.form}%">
    <img src="assets/rikishi-placeholder.svg" alt="${escapeHtml(rikishi.name)} portrait" loading="lazy" decoding="async" referrerpolicy="no-referrer"
      data-rikishi-image data-rikishi-id="${escapeHtml(rikishi.id)}" data-image-source="placeholder" data-image-state="queued" />
    <span class="image-loading-sheen" aria-hidden="true"></span>
  </span>`;
}

function sideBadge(rikishi) {
  return `<span class="side-badge ${rikishi.side.toLowerCase()}">${rikishi.side}</span>`;
}

function formatRank(rikishi) {
  return `${rikishi.side} ${rikishi.rank}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function playBell() {
  if (!state.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(196, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(98, context.currentTime + 0.34);
  gain.gain.setValueAtTime(0.09, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.42);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.42);
}

function setTheme() {
  const player = getPlayerDefinition();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.player = state.activePlayer;
  document.documentElement.classList.toggle("reduced-motion", state.reducedMotion);
  document.documentElement.classList.toggle("compact-mode", state.compact);
  soundButton.setAttribute("aria-pressed", String(state.sound));
  soundButton.classList.toggle("active", state.sound);
  playerSelect.value = state.activePlayer;
  playerLabel.textContent = player.name;
  playerSelect.closest(".player-selector").dataset.player = state.activePlayer;
}

function routeName() {
  const name = location.hash.replace("#", "").split("?")[0] || "overview";
  return ["overview", "roster", "banzuke", "results", "history", "settings"].includes(name)
    ? name
    : "overview";
}

function setActiveNav(route) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function pageIntro(eyebrow, title, copy, actions = "") {
  return `
    <section class="page-heading reveal">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${copy}</p>
      </div>
      ${actions}
    </section>`;
}

function editingBanner(copy = "All changes on this page are isolated to this player.") {
  const player = getPlayerDefinition();
  return `
    <aside class="editing-banner ${player.color} reveal" aria-label="Currently editing ${player.name}">
      <span class="player-avatar ${player.color}">${player.initials}</span>
      <span><small>CURRENTLY EDITING</small><b>${player.name.toUpperCase()}</b></span>
      <p>${copy}</p>
      <span class="editing-lock">● PLAYER-ONLY DATA</span>
    </aside>`;
}

function progressDots() {
  return Array.from({ length: data.meta.totalDays }, (_, index) => {
    const day = index + 1;
    const status = day < data.meta.day ? "done" : day === data.meta.day ? "current" : "";
    return `<span class="day-dot ${status}" title="Day ${day}"><b>${day}</b></span>`;
  }).join("");
}

function scoreDuel() {
  const [gwazy, jake] = data.players;
  const gwazyScore = playerScore(gwazy.id);
  const jakeScore = playerScore(jake.id);
  const lead = gwazyScore - jakeScore;
  const filledSlots = data.players.reduce((total, player) => {
    const roster = getRoster(player.id);
    return total + roster.team.length + roster.subs.length;
  }, 0);
  return `
    <article class="score-duel glass-card reveal" aria-label="Current score: ${gwazy.name} ${gwazyScore}, ${jake.name} ${jakeScore}">
      <div class="duel-player ${lead > 0 ? "leader" : ""}">
        <span class="player-avatar violet">${gwazy.initials}</span>
        <div>
          <div class="duel-label">${lead > 0 ? '<span class="live-chip">LEADING</span>' : ""}${gwazy.name}</div>
          <strong class="count-up" data-value="${gwazyScore}">0</strong><small>PTS</small>
        </div>
      </div>
      <div class="duel-center">
        <div class="lead-orb"><span>${lead ? `+${Math.abs(lead)}` : "0–0"}</span><small>${lead ? "LEAD" : "TIED"}</small></div>
        <p><b>${filledSlots}</b> of 18 draft slots filled</p>
      </div>
      <div class="duel-player right ${lead < 0 ? "leader" : ""}">
        <div>
          <div class="duel-label">${jake.name}${lead < 0 ? '<span class="live-chip">LEADING</span>' : ""}</div>
          <strong class="count-up" data-value="${jakeScore}">0</strong><small>PTS</small>
        </div>
        <span class="player-avatar gold">${jake.initials}</span>
      </div>
      <div class="duel-beam" aria-hidden="true"></div>
    </article>`;
}

function currentStandingsCard() {
  const scores = data.players.map((player) => ({
    ...player,
    score: playerScore(player.id),
    today: playerDayScore(player.id),
  }));
  const maximum = Math.max(1, ...scores.map((player) => player.score));
  const [gwazy, jake] = scores;
  const margin = Math.abs(gwazy.score - jake.score);
  const marginCopy = margin === 0 ? "Tied" : `${gwazy.score > jake.score ? gwazy.name : jake.name} +${margin}`;
  const rows = scores.map((player) => `
    <div class="standing-row">
      <div class="standing-meta"><strong>${player.name}</strong><span>${player.today >= 0 ? "+" : ""}${player.today} today</span><b>${player.score}</b></div>
      <div class="score-track"><span class="${player.color}" style="--width:${(player.score / maximum) * 100}%"></span></div>
    </div>`).join("");
  return `
    <section class="glass-card standings-card reveal" data-overview-standings>
      <div class="section-title"><div><p class="eyebrow">LIVE SCORE</p><h2>Current standings</h2></div><span class="sync-badge"><i></i> Day ${data.meta.day}</span></div>
      ${rows}
      <div class="difference-row"><span>Current margin</span><strong>${marginCopy}</strong></div>
    </section>`;
}

function projectedPlayerScore(playerId) {
  const currentDay = Math.max(0, Math.min(data.meta.totalDays, Number(data.meta.day) || 0));
  const remainingDays = Math.max(0, data.meta.totalDays - currentDay);
  const timeline = substitutionTimeline(playerId, currentDay);
  const activeIds = currentDay > 0 ? timeline.activeIds : getRoster(playerId).team;
  const expectedDailyPoints = activeIds.reduce((total, id) => {
    const rikishi = getRikishi(id);
    if (!rikishi) return total;
    const completed = Math.max(0, rikishi.wins + rikishi.losses);
    const adjustedWinRate = (rikishi.wins + 2) / (completed + 4);
    return total + adjustedWinRate;
  }, 0);
  const prediction = getSidePrediction(playerId);
  const sideTotals = data.meta.sideTotals || { East: 0, West: 0 };
  const leadingSide = sideTotals.East === sideTotals.West ? null : sideTotals.East > sideTotals.West ? "East" : "West";
  const expectedBonus = !prediction ? 0 : !leadingSide ? 10 : prediction === leadingSide ? 14 : 6;
  return Math.round(playerScore(playerId) + (expectedDailyPoints * remainingDays) + expectedBonus);
}

function forecastModel() {
  const projections = Object.fromEntries(data.players.map((player) => [player.id, projectedPlayerScore(player.id)]));
  const [gwazy, jake] = data.players;
  const margin = projections[gwazy.id] - projections[jake.id];
  const gwazyProbability = Math.round(100 / (1 + Math.exp(-margin / 5)));
  const winner = margin === 0 ? null : margin > 0 ? gwazy : jake;
  const winnerProbability = winner?.id === gwazy.id ? gwazyProbability : winner ? 100 - gwazyProbability : 50;
  return {
    projections,
    winner,
    probability: Math.max(5, Math.min(95, winnerProbability)),
    margin: Math.abs(margin),
    remainingDays: Math.max(0, data.meta.totalDays - data.meta.day),
  };
}

function forecastCard() {
  const forecast = forecastModel();
  const [gwazy, jake] = data.players;
  const winnerName = forecast.winner?.name || "Too close";
  return `
    <section class="glass-card projection-card reveal" data-overview-forecast>
      <div class="section-title"><div><p class="eyebrow">FORECAST</p><h2>Projected winner</h2></div><span class="spark-icon">${icons.spark}</span></div>
      <div class="forecast-winner"><strong>${winnerName}</strong><span>${forecast.probability}%</span></div>
      <div class="probability-track"><span class="${forecast.winner?.color || "violet"}" style="--width:${forecast.probability}%"></span></div>
      <div class="forecast-score"><small>PROJECTED FINAL SCORE</small><b>${forecast.projections[gwazy.id]} <span>-</span> ${forecast.projections[jake.id]}</b><strong>${forecast.margin ? `+${forecast.margin} projected margin` : "Projected tie"}</strong></div>
      <p class="microcopy">Live estimate from official records, active lineups, remaining days, and side predictions.</p>
    </section>`;
}

function momentumChart() {
  const width = 640;
  const height = 170;
  const left = 42;
  const right = 624;
  const top = 16;
  const bottom = 142;
  const observedDay = Math.max(1, Math.min(data.meta.totalDays, Number(data.meta.day) || 0));
  const series = data.players.map((player) => ({
    ...player,
    values: Array.from({ length: observedDay }, (_, index) => playerScore(player.id, index + 1)),
  }));
  const maximum = Math.max(1, ...series.flatMap((player) => player.values));
  const xForDay = (day) => left + ((day - 1) / Math.max(1, data.meta.totalDays - 1)) * (right - left);
  const yForScore = (score) => bottom - (score / maximum) * (bottom - top);
  const paths = series.map((player) => {
    const points = player.values.map((score, index) => [xForDay(index + 1), yForScore(score), score, index + 1]);
    const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<path class="chart-line ${player.color}" d="${path}" pathLength="1"></path>${points.map(([x, y, score, day]) => `<circle class="chart-point ${player.color}" cx="${x}" cy="${y}" r="3"><title>${player.name}, Day ${day}: ${score} points</title></circle>`).join("")}`;
  }).join("");
  const gridValues = [maximum, Math.round(maximum / 2), 0];
  const grid = gridValues.map((value) => {
    const y = yForScore(value);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line><text class="chart-y-label" x="34" y="${y + 3}" text-anchor="end">${value}</text>`;
  }).join("");
  return `
    <div class="chart-wrap" role="img" aria-label="Gwazy and Jake point totals from Day 1 through Day ${observedDay}">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${grid}${paths}</svg>
      <div class="chart-days">${[1, 3, 5, 7, 9, 11, 13, 15].map((day) => `<span>D${day}</span>`).join("")}</div>
    </div>`;
}

function momentumCard() {
  return `
    <section class="glass-card timeline-card reveal" data-overview-momentum>
      <div class="section-title"><div><p class="eyebrow">MOMENTUM</p><h2>Point progression</h2></div><div class="chart-legend"><span class="violet">Gwazy</span><span class="gold">Jake</span></div></div>
      ${momentumChart()}
    </section>`;
}

function boutCard(bout, compact = false) {
  const east = getRikishi(bout.east);
  const west = getRikishi(bout.west);
  if (!east || !west) return "";
  const winner = getRikishi(bout.winner) || east;
  const importance = Math.max(1, Math.min(5, Number(bout.importance) || 1));
  const stars = "★".repeat(importance) + "☆".repeat(5 - importance);
  return `
    <button class="bout-card ${compact ? "compact" : ""} ${bout.completed ? "" : "scheduled"}" type="button" data-profile="${winner.id}">
      <span class="bout-importance" title="Match importance ${importance} out of 5">${stars}</span>
      <span class="bout-wrestler ${bout.winner === east.id ? "winner" : ""}">
        ${wrestlerImage(east)}
        <span><b>${east.name}</b><small>${east.rank} · ${east.record}</small></span>
      </span>
      <span class="versus"><b>VS</b><small>${bout.technique || "Scheduled"}</small></span>
      <span class="bout-wrestler right ${bout.winner === west.id ? "winner" : ""}">
        <span><b>${west.name}</b><small>${west.rank} · ${west.record}</small></span>
        ${wrestlerImage(west)}
      </span>
      <span class="bout-swing">${bout.completed ? (bout.swing ?? "Official") : "Pending"}</span>
    </button>`;
}

function rosterCard(rikishi, playerId, substitute = false, role = "active") {
  const hasResult = rikishi.wins + rikishi.losses + (rikishi.absences || 0) > 0;
  const heat = !hasResult ? "unplayed" : rikishi.form >= 75 ? "hot" : rikishi.form < 40 ? "cold" : "steady";
  const isSwapSource = pendingSwap?.playerId === playerId && pendingSwap.rikishiId === rikishi.id;
  const isSwapTarget = pendingSwap?.playerId === playerId && pendingSwap.substitute !== substitute;
  const isKyujo = role === "kyujo";
  const isActiveSubstitute = role === "active-substitute";
  const isStandbySubstitute = role === "standby-substitute";
  const points = countedPointsForRikishi(playerId, rikishi.id);
  const statusBadge = isKyujo
    ? '<span class="roster-status-badge kyujo">⚠ KYUJO · INACTIVE</span>'
    : isActiveSubstitute
      ? '<span class="roster-status-badge active-substitute">✓ ACTIVE SUBSTITUTE</span>'
      : isStandbySubstitute
        ? '<span class="roster-status-badge standby">○ STANDBY · 0 PTS</span>'
        : '<span class="roster-status-badge active-main">● ACTIVE MAIN</span>';
  return `
    <article class="roster-card ${heat} ${isKyujo ? "is-kyujo" : ""} ${isActiveSubstitute ? "is-active-substitute" : ""} ${isStandbySubstitute ? "is-standby-substitute" : ""} ${isSwapSource ? "swap-source" : ""} ${isSwapTarget ? "swap-target" : ""}" data-profile="${rikishi.id}">
      ${wrestlerImage(rikishi, "medium")}
      <div class="roster-card-main">
        <div class="roster-card-title">
          <div><h3>${rikishi.name}</h3><p>${rikishi.rank} · ${rikishi.stable}</p></div>
          ${sideBadge(rikishi)}
        </div>
        ${statusBadge}
        <div class="record-line"><strong>${rikishi.record}</strong><span><b>${rikishi.wins}</b> wins · <b>${rikishi.losses}</b> losses</span></div>
        <div class="heat-track"><span style="--width:${rikishi.form}%"></span></div>
      </div>
      <div class="roster-points"><strong>${isStandbySubstitute ? 0 : points}</strong><small>${isKyujo ? "BANKED PTS" : isStandbySubstitute ? "INACTIVE" : "COUNTED PTS"}</small></div>
      ${rikishi.badge ? `<span class="clutch-badge">✦ ${rikishi.badge}</span>` : ""}
      <div class="roster-card-actions">
        <button type="button" data-roster-move="${rikishi.id}:${substitute ? "main" : "subs"}">${substitute ? "Move to main" : "Move to subs"}</button>
        <button type="button" data-swap-pick="${rikishi.id}:${substitute ? "sub" : "main"}">${isSwapTarget ? "Swap here" : isSwapSource ? "Cancel swap" : "Swap"}</button>
        ${substitute ? `<button type="button" data-sub-reorder="${rikishi.id}:up" aria-label="Move ${rikishi.name} earlier">↑ Earlier</button><button type="button" data-sub-reorder="${rikishi.id}:down" aria-label="Move ${rikishi.name} later">↓ Later</button><button type="button" data-replace-sub="${rikishi.id}">Change substitute</button>` : ""}
        <button class="remove" type="button" data-remove-pick="${rikishi.id}">Remove</button>
      </div>
    </article>`;
}

function compactPickCard(rikishi) {
  return `
    <button class="pick-chip" type="button" data-profile="${rikishi.id}">
      ${wrestlerImage(rikishi)}
      <span><b>${rikishi.name}</b><small>${rikishi.rank}</small></span>
      <strong>${rikishi.points}</strong>
    </button>`;
}

function overviewRosterSlots(player, ids, type, limit) {
  const slots = Array.from({ length: limit }, (_, index) => {
    const rikishi = getRikishi(ids[index]);
    if (!rikishi) {
      return `<div class="dashboard-pick-row empty" data-empty-draft-slot="${player.id}:${type}:${index + 1}">
        <span class="dashboard-slot-number">${index + 1}</span>
        <span class="dashboard-empty-avatar">+</span>
        <span><b>Available slot</b><small>Draft from the Banzuke</small></span>
      </div>`;
    }
    return `<button class="dashboard-pick-row" type="button" data-profile="${rikishi.id}">
      <span class="dashboard-slot-number">${index + 1}</span>
      ${wrestlerImage(rikishi)}
      <span><b>${escapeHtml(rikishi.name)}</b><small>${escapeHtml(rikishi.rank)} · ${escapeHtml(rikishi.side)}</small></span>
      <strong>${rikishi.points}<small> PTS</small></strong>
    </button>`;
  });
  return slots.join("");
}

function overviewPickRow(player, rikishiId, status, slot) {
  const rikishi = getRikishi(rikishiId);
  if (!rikishi) return "";
  const points = countedPointsForRikishi(player.id, rikishi.id);
  const statusCopy = status === "kyujo" ? "Kyujo · inactive" : status === "active-substitute" ? "Active replacement" : status === "standby" ? "Standby · 0 points" : "Active main";
  return `<button class="dashboard-pick-row ${status}" type="button" data-profile="${rikishi.id}">
    <span class="dashboard-slot-number">${slot}</span>${wrestlerImage(rikishi)}
    <span><b>${escapeHtml(rikishi.name)}</b><small>${statusCopy}</small></span>
    <strong>${status === "standby" ? 0 : points}<small> PTS</small></strong>
  </button>`;
}

function overviewEmptySlot(player, type, index) {
  return `<div class="dashboard-pick-row empty" data-empty-draft-slot="${player.id}:${type}:${index}">
    <span class="dashboard-slot-number">${index}</span><span class="dashboard-empty-avatar">+</span>
    <span><b>Available slot</b><small>Draft from the Banzuke</small></span>
  </div>`;
}

function overviewRosterDashboard(player) {
  const roster = getRoster(player.id);
  const timeline = substitutionTimeline(player.id);
  const prediction = getSidePrediction(player.id);
  const score = playerScore(player.id);
  const mainRows = Array.from({ length: 6 }, (_, index) => {
    const mainId = roster.team[index];
    if (!mainId) return overviewEmptySlot(player, "main", index + 1);
    return overviewPickRow(player, mainId, timeline.inactiveMainIds.includes(mainId) ? "kyujo" : "active-main", index + 1);
  }).join("");
  const activeReplacementRows = timeline.assignments.map((assignment, index) => overviewPickRow(player, assignment.subId, "active-substitute", index + 1)).join("");
  const standbyRows = timeline.standbySubIds.map((id, index) => overviewPickRow(player, id, timeline.unavailableSubIds.includes(id) ? "kyujo" : "standby", index + 1)).join("");
  return `
    <article class="team-preview overview-roster-column ${player.color}" data-overview-roster="${player.id}">
      <div class="team-preview-head">
        <span class="player-avatar ${player.color}">${player.initials}</span>
        <div><small>${player.name.toUpperCase()}'S DRAFT</small><h3>${roster.team.length + roster.subs.length} / 9 slots filled</h3></div>
        <strong>${score}</strong>
      </div>
      <div class="dashboard-team-meta"><span><small>CURRENT SCORE</small><b>${score} pts</b></span><span><small>SIDE PREDICTION</small><b>${prediction || "None"}</b></span></div>
      <section class="dashboard-roster-section">
        <div class="dashboard-roster-heading"><span>MAIN PICKS</span><b>${roster.team.length} / 6</b></div>
        <div class="dashboard-roster-list">${mainRows}</div>
      </section>
      ${activeReplacementRows ? `<section class="dashboard-roster-section active-replacements"><div class="dashboard-roster-heading"><span>ACTIVE REPLACEMENTS</span><b>${timeline.activeSubIds.length}</b></div><div class="dashboard-roster-list">${activeReplacementRows}</div></section>` : ""}
      <section class="dashboard-roster-section subs standby-substitutes">
        <div class="dashboard-roster-heading"><span>STANDBY SUBSTITUTES</span><b>${timeline.standbySubIds.length} / ${roster.subs.length || 3}</b></div>
        <div class="dashboard-roster-list">${standbyRows || (roster.subs.length ? "" : overviewRosterSlots(player, [], "sub", 3))}</div>
      </section>
    </article>`;
}

function overviewView() {
  const basho = selectedBasho();
  const pool = draftPoolStats(basho);
  const draftStarted = pool.drafted > 0;
  return `
    <section class="overview-shell">
      <div class="hero-card reveal">
        <img src="assets/sumo-arena-hero.webp" alt="Atmospheric sumo arena" />
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <div>
            <p class="eyebrow"><span class="live-dot"></span> OFFICIAL BASHO · DAY ${data.meta.day}</p>
            <h1>${data.meta.tournament}</h1>
            <p class="hero-detail"><span>${icons.calendar}</span> ${data.meta.dateRange}<span>${icons.pin}</span> ${data.meta.venue}</p>
          </div>
          <div class="basho-day">
            <small>DRAFT PROGRESS</small>
            <strong>${pool.drafted}<span> / 18 SLOTS</span></strong>
            <div class="pre-basho-progress"><span style="--width:${(pool.drafted / 18) * 100}%"></span></div>
          </div>
        </div>
      </div>

      ${scoreDuel()}

      <div class="overview-grid overview-analytics" data-overview-analytics>
        ${currentStandingsCard()}
        ${forecastCard()}
        ${momentumCard()}
      </div>

      <section class="content-section picks-preview reveal">
        <div class="section-title spacious"><div><p class="eyebrow">SHARED DRAFT · ${escapeHtml(basho.label.toUpperCase())}</p><h2>Complete rosters</h2><p>Both players' main picks, substitutes, scores, predictions, and completion progress update here automatically.</p></div><a class="text-link" href="#banzuke">Open draft <span>${icons.arrow}</span></a></div>
        ${!draftStarted ? `<div class="overview-roster-empty" data-overview-empty><b>The draft has not started yet.</b><span>Select wrestlers from the Banzuke to build each player's team. All ${pool.total} Makuuchi rikishi are available.</span></div>` : ""}
        <div class="pick-preview-grid overview-rosters">${data.players.map(overviewRosterDashboard).join("")}</div>
      </section>

      <section class="bonus-panel reveal">
        <div class="scoring-mini">
          <div class="section-title"><div><p class="eyebrow">QUICK REFERENCE</p><h2>Scoring system</h2></div><span class="spark-icon">♛</span></div>
          <div class="scoring-rows">${data.scoring.map((rule) => `<span><small>${rule.label}</small><b>${rule.value}</b></span>`).join("")}</div>
        </div>
        <div class="bonus-prediction ${getPlayerDefinition().color}">
          <div><p class="eyebrow">${getPlayerDefinition().name.toUpperCase()}'S SIDE PREDICTION</p><h2>Which side wins more bouts?</h2><p>No prediction is selected by default. This choice belongs only to ${getPlayerDefinition().name}.</p></div>
          <div class="side-choice" role="group" aria-label="Bonus side prediction">
            <button type="button" class="east ${getSidePrediction() === "East" ? "active" : ""}" data-bonus="East"><span>東</span><b>EAST</b><small>${getSidePrediction() === "East" ? "PICKED" : "SELECT"}</small></button>
            <span class="bonus-vs">VS<small>20 PTS</small></span>
            <button type="button" class="west ${getSidePrediction() === "West" ? "active" : ""}" data-bonus="West"><span>西</span><b>WEST</b><small>${getSidePrediction() === "West" ? "PICKED" : "SELECT"}</small></button>
          </div>
        </div>
      </section>

      ${appFooter()}
    </section>`;
}
function validateRoster(playerId) {
  const roster = getRoster(playerId);
  const team = roster.team.map(getRikishi);
  const sanyaku = team.filter(isSanyaku).length;
  const underdogs = team.filter((rikishi) => /Maegashira (1[3-7])/.test(rikishi.rank)).length;
  const substituteCheck = substituteRules(roster.subs);
  return {
    valid: team.length === 6 && roster.subs.length === 3 && sanyaku <= 2 && underdogs === 1 && substituteCheck.sanyaku === 1 && substituteCheck.maegashira === 2,
    team: team.length,
    subs: roster.subs.length,
    sanyaku,
    underdogs,
    substituteSanyaku: substituteCheck.sanyaku,
    substituteMaegashira: substituteCheck.maegashira,
  };
}

function validationChecklist(check) {
  const item = (valid, label) => `<span class="${valid ? "ok" : "bad"}"><b>${valid ? "✓" : "×"}</b>${label}</span>`;
  return `
    <div class="validation-checklist">
      ${item(check.team === 6, `${check.team} / 6 Main Picks`)}
      ${item(check.subs === 3, `${check.subs} / 3 Substitutes`)}
      ${item(check.sanyaku <= 2, `${check.sanyaku} / 2 Komusubi+`)}
      ${item(check.underdogs === 1, check.underdogs ? `${check.underdogs} Underdog` : "Missing Underdog")}
      ${item(check.substituteSanyaku === 1, `${check.substituteSanyaku} / 1 Sanyaku Sub`)}
      ${item(check.substituteMaegashira === 2, `${check.substituteMaegashira} / 2 Maegashira Subs`)}
    </div>`;
}

function emptyRosterSlots(count, type) {
  return Array.from({ length: count }, (_, index) => `<div class="empty-roster-slot"><span>+</span><b>${type} slot ${index + 1}</b><small>Add from the Banzuke</small></div>`).join("");
}

function rosterPickerOptions({ currentId = null, type = "main" } = {}) {
  const options = data.rikishi.filter((rikishi) => {
    if (rikishi.id === currentId) return true;
    if (rikishi.available === false || draftOwner(rikishi.id)) return false;
    if (type === "sub") return isSanyaku(rikishi) || isMaegashira(rikishi);
    return true;
  });
  return `<option value="">Choose a wrestler...</option>${options.map((rikishi) => `<option value="${rikishi.id}">${escapeHtml(rikishi.name)} - ${escapeHtml(rikishi.rank)} ${escapeHtml(rikishi.side)}</option>`).join("")}`;
}

function formatSharedSaveTime(value) {
  if (!value) return { day: "Never", time: "Not saved" };
  const date = new Date(value);
  const today = new Date();
  const sameUtcDay = date.getUTCFullYear() === today.getUTCFullYear() && date.getUTCMonth() === today.getUTCMonth() && date.getUTCDate() === today.getUTCDate();
  return {
    day: sameUtcDay ? "Today" : date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }),
    time: `${date.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false })} UTC`,
  };
}

function rosterView() {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const check = validateRoster(player.id);
  const timeline = substitutionTimeline(player.id);
  const assignmentByMain = new Map(timeline.assignments.map((assignment) => [assignment.mainId, assignment.subId]));
  const mainRoster = roster.team.map((id) => {
    const kyujo = timeline.inactiveMainIds.includes(id);
    const replacementId = assignmentByMain.get(id);
    return `<div class="main-roster-position ${kyujo ? "has-kyujo" : ""}">${rosterCard(getRikishi(id), player.id, false, kyujo ? "kyujo" : "active")}${replacementId ? `<div class="replacement-bridge"><span>↓</span><b>Automatically replaced by</b></div>${rosterCard(getRikishi(replacementId), player.id, true, "active-substitute")}` : kyujo ? '<div class="replacement-missing">No eligible substitute is available for this position.</div>' : ""}</div>`;
  }).join("");
  const standbyRoster = timeline.standbySubIds.map((id, index) => `<div class="sub-order"><span>${index + 1}</span>${rosterCard(getRikishi(id), player.id, true, timeline.unavailableSubIds.includes(id) ? "kyujo" : "standby-substitute")}</div>`).join("");
  const substitutionLog = timeline.events.length
    ? timeline.events.map((event) => {
      const main = getRikishi(event.mainId);
      const substitute = getRikishi(event.subId);
      const copy = event.type === "activated"
        ? `${substitute?.name || "Substitute"} activated for ${main?.name || "main pick"}`
        : event.type === "returned"
          ? `${main?.name || "Main pick"} returned; ${substitute?.name || "substitute"} back to standby`
          : `${substitute?.name || "Substitute"} entered kyujo; replacement slot reassessed`;
      return `<li class="${event.type}"><span>DAY ${event.day}</span><b>${copy}</b></li>`;
    }).join("")
    : '<li class="empty"><span>LIVE</span><b>No substitutions have been required.</b></li>';
  const saveTime = formatSharedSaveTime(savedSharedDraft?.lastSavedAt);
  const unsaved = hasUnsavedDraftChanges();
  const locked = Boolean(savedSharedDraft?.locked);
  const mainOptions = rosterPickerOptions({ type: "main" });
  const subOptions = rosterPickerOptions({ type: "sub" });
  const validationErrors = sharedValidationErrors.length ? `<div class="shared-validation-errors" role="alert"><b>Draft cannot be saved</b><ul>${sharedValidationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : "";
  return `
    <section class="page-shell">
      ${pageIntro("TEAM WORKSPACE", `${player.name}'s roster`, "Review, remove, move, or swap picks without rebuilding the team.", `<a class="primary-button" href="#banzuke">Add from Banzuke</a>`)}
      ${editingBanner(`This roster belongs only to ${player.name}. Use the header selector to edit the other player.`)}
      <div class="rules-strip reveal">
        <span><b>6</b> starters</span><i></i><span><b>1</b> Sanyaku substitute</span><i></i><span><b>2</b> Maegashira substitutes</span><i></i><span><b>SUBS SCORE</b> only while activated</span>
      </div>
      <section class="shared-draft-bar reveal ${unsaved ? "dirty" : ""}">
        <div><small>DRAFT STATUS</small><b>${sharedDraftLoading ? "Loading shared draft..." : locked ? "Draft locked" : unsaved ? "&#9679; Unsaved Changes" : "&#10003; Shared draft loaded"}</b></div>
        <div><small>LAST SAVED</small><b>${saveTime.day}</b><span>${saveTime.time}</span></div>
        <div><small>SAVED BY</small><b>${escapeHtml(savedSharedDraft?.savedBy || "No one yet")}</b><span>Revision ${Number(savedSharedDraft?.revision || 0)}</span></div>
        <div class="shared-draft-actions"><button class="secondary-button" type="button" data-refresh-shared>Refresh</button><button class="secondary-button" type="button" data-toggle-draft-lock ${unsaved || sharedDraftLoading || sharedDraftSaving ? "disabled" : ""}>${locked ? "Unlock draft" : "Lock draft"}</button></div>
      </section>
      ${sharedDraftError ? `<div class="shared-draft-error" role="alert">${escapeHtml(sharedDraftError)}</div>` : ""}
      <section class="active-roster-workspace ${player.color} reveal">
        <div class="roster-owner">
          <span class="player-avatar ${player.color}">${player.initials}</span>
          <div><p class="eyebrow">${player.name.toUpperCase()}'S PICKS</p><h2>${playerScore(player.id)} points</h2></div>
          <span class="legal-badge ${check.valid ? "valid" : "invalid"}">${check.valid ? "✓ ROSTER LEGAL" : "! ROSTER INCOMPLETE"}</span>
        </div>
        ${pendingSwap ? `<div class="swap-notice"><b>Swap mode:</b> choose a pick in the other column to swap with ${getRikishi(pendingSwap.rikishiId).name}. <button type="button" data-cancel-swap>Cancel</button></div>` : ""}
        <section class="roster-management-panel ${locked ? "locked" : ""}">
          <div><p class="eyebrow">WORKING COPY</p><h3>Add or replace picks</h3><p>Changes stay private in this tab until Save Picks publishes the complete shared draft.</p></div>
          <label>Add main wrestler<select id="roster-add-main" ${draftEditingDisabled() ? "disabled" : ""}>${mainOptions}</select><button type="button" data-roster-add="main">Add wrestler</button></label>
          <label>Add substitute<select id="roster-add-sub" ${draftEditingDisabled() ? "disabled" : ""}>${subOptions}</select><button type="button" data-roster-add="sub">Add substitute</button></label>
          <label>Replace main<select id="roster-replace-main-old" ${draftEditingDisabled() ? "disabled" : ""}><option value="">Current main...</option>${roster.team.map((id) => `<option value="${id}">${escapeHtml(getRikishi(id)?.name || id)}</option>`).join("")}</select><select id="roster-replace-main-new" ${draftEditingDisabled() ? "disabled" : ""}>${mainOptions}</select><button type="button" data-roster-replace="main" ${draftEditingDisabled() ? "disabled" : ""}>Replace wrestler</button></label>
          <label>Change substitute<select id="roster-replace-sub-old" ${draftEditingDisabled() ? "disabled" : ""}><option value="">Current substitute...</option>${roster.subs.map((id) => `<option value="${id}">${escapeHtml(getRikishi(id)?.name || id)}</option>`).join("")}</select><select id="roster-replace-sub-new" ${draftEditingDisabled() ? "disabled" : ""}>${subOptions}</select><button type="button" data-roster-replace="sub" ${draftEditingDisabled() ? "disabled" : ""}>Change substitute</button></label>
        </section>
        <div class="active-roster-grid">
          <section>
            <div class="slot-heading"><span><small>ACTIVE ROSTER & REPLACEMENTS</small><b>${roster.team.length} / 6</b></span><strong>${timeline.activeSubIds.length} substitute${timeline.activeSubIds.length === 1 ? "" : "s"} active</strong></div>
            <div class="roster-list">${mainRoster}${emptyRosterSlots(Math.max(0, 6 - roster.team.length), "Main")}</div>
          </section>
          <section>
            <div class="slot-heading"><span><small>STANDBY SUBSTITUTES</small><b>${timeline.standbySubIds.length} / ${roster.subs.length || 3}</b></span><strong>${3 - roster.subs.length} draft slots remaining</strong></div>
            <div class="roster-list substitute-list">${standbyRoster}${emptyRosterSlots(Math.max(0, 3 - roster.subs.length), "Substitute")}${!timeline.standbySubIds.length && roster.subs.length ? '<div class="all-subs-active">All drafted substitutes are currently active.</div>' : ""}</div>
          </section>
        </div>
        ${validationChecklist(check)}
        ${validationErrors}
        <section class="substitution-log"><div><p class="eyebrow">OFFICIAL JSA AUTOMATION</p><h3>Substitution log</h3></div><ol>${substitutionLog}</ol></section>
        <div class="roster-save-row shared"><p><b>${unsaved ? "Unsaved working copy" : "Shared draft is up to date"}</b><span>Save validates both players, prevents duplicate ownership, and commits one shared JSON file.</span></p><button class="primary-button" type="button" data-save-draft ${draftEditingDisabled() || !unsaved ? "disabled" : ""}>${sharedDraftSaving ? "Saving..." : "Save Picks"}</button></div>
      </section>
      ${appFooter()}
    </section>`;
}

function pickLocation(rikishiId, playerId = state.activePlayer) {
  const roster = getRoster(playerId);
  if (roster.team.includes(rikishiId)) return "main";
  if (roster.subs.includes(rikishiId)) return "sub";
  return null;
}

function mainPickRules(ids) {
  const picks = ids.map(getRikishi).filter(Boolean);
  const sanyaku = picks.filter(isSanyaku).length;
  const underdogs = picks.filter((rikishi) => /Maegashira (1[3-7])/.test(rikishi.rank)).length;
  return {
    sanyaku,
    underdogs,
    valid: ids.length <= 6 && sanyaku <= 2 && underdogs <= 1 && (ids.length < 6 || underdogs === 1),
  };
}

function selectedBasho() {
  return data.banzuke.bashos.find((basho) => basho.id === state.selectedBashoId)
    || data.banzuke.bashos.find((basho) => basho.id === data.banzuke.currentBashoId)
    || data.banzuke.bashos[0];
}

function banzukeRankRows(basho = selectedBasho()) {
  const groups = [];
  const byRank = new Map();
  basho.entries.forEach((entry, entryIndex) => {
    const rank = entry.rank || "Unranked";
    if (!byRank.has(rank)) {
      const group = { rank, entries: [] };
      byRank.set(rank, group);
      groups.push(group);
    }
    byRank.get(rank).entries.push({ ...entry, entryIndex });
  });

  const rows = [];
  groups.forEach((group) => {
    const east = group.entries.filter((entry) => entry.side === "East");
    const west = group.entries.filter((entry) => entry.side === "West");
    const unassigned = group.entries.filter((entry) => !["East", "West"].includes(entry.side));
    const pairedRowCount = Math.max(east.length, west.length);
    for (let index = 0; index < pairedRowCount; index += 1) {
      rows.push({
        key: `${group.rank}:${index + 1}`,
        rank: group.rank,
        position: index + 1,
        East: east[index] || null,
        West: west[index] || null,
      });
    }
    unassigned.forEach((entry, index) => rows.push({
      key: `${group.rank}:unassigned:${index + 1}`,
      rank: group.rank,
      position: pairedRowCount + index + 1,
      East: entry,
      West: null,
      unassigned: true,
    }));
  });
  return rows;
}

function rikishiForBanzukeEntry(entry) {
  const parsed = getRikishi(entry.rikishiId);
  if (parsed) return { rikishi: parsed, parsed: true };
  return {
    parsed: false,
    rikishi: {
      id: entry.rikishiId || `source-${entry.sourceIndex ?? "unknown"}`,
      name: entry.shikona || "Unknown rikishi",
      shikona: entry.shikona || "Unknown rikishi",
      rank: entry.rank || "Unknown rank",
      side: entry.side || "Unassigned",
      record: "—",
      wins: 0,
      losses: 0,
      points: 0,
      form: 0,
      stable: "Stable unavailable",
      birthplace: "Birthplace unavailable",
      height: "—",
      weight: "—",
      careerHigh: "—",
      technique: "Profile unavailable",
      available: false,
      jsaId: null,
      jsaPortrait: null,
      wikipedia: null,
      profile: null,
    },
  };
}

function banzukeRow(row) {
  const cell = (entry, side) => {
    if (!entry) return `<span class="banzuke-vacancy" aria-hidden="true"></span>`;
    const resolved = rikishiForBanzukeEntry(entry);
    const rikishi = resolved.rikishi;
    const ownerId = draftOwner(rikishi.id);
    const owner = ownerId ? getPlayerDefinition(ownerId) : null;
    const location = ownerId ? pickLocation(rikishi.id, ownerId) : null;
    const ownedByActivePlayer = ownerId === state.activePlayer;
    const lockedByOtherPlayer = Boolean(ownerId && !ownedByActivePlayer);
    const sourceUnavailable = rikishi.available === false || !resolved.parsed;
    const editingUnavailable = draftEditingDisabled();
    const availableToDraft = !ownerId && !sourceUnavailable;
    const activeRoster = getRoster();
    const canAddMain = activeRoster.team.length < 6 && mainPickRules([...activeRoster.team, rikishi.id]).valid;
    const replacementIndex = pendingSubstituteReplacement ? activeRoster.subs.indexOf(pendingSubstituteReplacement) : -1;
    const candidateSubs = replacementIndex >= 0
      ? activeRoster.subs.map((id, index) => index === replacementIndex ? rikishi.id : id)
      : [...activeRoster.subs, rikishi.id];
    const canAddSub = (replacementIndex >= 0 || activeRoster.subs.length < 3) && substituteRules(candidateSubs).valid;
    let action;
    if (ownedByActivePlayer) {
      action = `<button class="pick-action remove" type="button" data-remove-pick="${rikishi.id}"><small>${location === "main" ? "YOUR MAIN PICK" : "YOUR SUBSTITUTE"}</small>Remove</button>`;
    } else if (lockedByOtherPlayer) {
      action = `<button class="pick-action locked ${owner.color}" type="button" disabled><small>DRAFTED</small>🔒 ${owner.name}</button>`;
    } else {
      action = `<div class="pick-action-group"><button class="pick-action" type="button" data-add-pick="${rikishi.id}:main" ${editingUnavailable || sourceUnavailable || !canAddMain ? "disabled" : ""}><small>${!resolved.parsed ? "DATA INCOMPLETE" : "MAIN PICK"}</small>${editingUnavailable ? "Draft locked" : sourceUnavailable ? "Unavailable" : "Add Main"}</button><button class="pick-action substitute" type="button" data-add-pick="${rikishi.id}:sub" ${editingUnavailable || sourceUnavailable || !canAddSub ? "disabled" : ""}><small>${!resolved.parsed ? "DATA INCOMPLETE" : replacementIndex >= 0 ? "REPLACEMENT" : isSanyaku(rikishi) ? "SANYAKU SUB" : "MAEGASHIRA SUB"}</small>${editingUnavailable ? "Draft locked" : sourceUnavailable ? "Unavailable" : replacementIndex >= 0 ? "Replace" : "Add Sub"}</button></div>`;
    }
    const searchValue = `${rikishi.name} ${rikishi.fullName || ""} ${rikishi.stable} ${rikishi.rank} ${rikishi.side}`.toLowerCase();
    return `
      <article class="banzuke-rikishi ${side} ${ownerId ? `draft-owner-${ownerId}` : "draft-available"} ${ownedByActivePlayer ? "selected-pick" : ""} ${sourceUnavailable ? "unavailable" : ""} ${lockedByOtherPlayer ? "draft-locked" : ""} ${resolved.parsed ? "" : "incomplete-data"}"
        data-banzuke-id="${rikishi.id}" data-rank="${escapeHtml(rikishi.rank)}" data-side="${rikishi.side}"
        data-banzuke-shikona="${escapeHtml(entry.shikona || rikishi.shikona || rikishi.name)}" data-source-index="${entry.sourceIndex ?? ""}"
        data-search-value="${escapeHtml(searchValue)}" data-available="${String(availableToDraft)}" data-draft-owner="${ownerId || ""}"
        data-picked-current="${String(ownedByActivePlayer)}" data-picked-jake="${String(ownerId === "jake")}">
        ${side === "east" ? wrestlerImage(rikishi) : action}
        <button class="banzuke-profile" type="button" data-profile="${rikishi.id}" aria-label="Open ${escapeHtml(rikishi.name)} profile">
          <span class="banzuke-name-line"><b>${escapeHtml(rikishi.name)}</b><i class="position-chip ${side}">${rikishi.side}</i></span>
          <small>${escapeHtml(rikishi.stable)} stable</small>
          <span class="draft-owner-badge ${owner?.color || "available"}">${owner ? `Owned by ${owner.name}` : availableToDraft ? "Available" : "Unavailable"}</span>
          <span class="banzuke-record"><strong>${escapeHtml(rikishi.record)}</strong><em><b>${rikishi.wins}</b> wins</em><em><b>${rikishi.losses}</b> losses</em></span>
        </button>
        ${side === "west" ? wrestlerImage(rikishi) : action}
        <aside class="banzuke-quick-profile" aria-hidden="true">
          <small>QUICK PROFILE</small><b>${escapeHtml(rikishi.fullName || rikishi.name)}</b>
          <span>${escapeHtml(formatRank(rikishi))}</span><span>${escapeHtml(rikishi.stable)} · ${escapeHtml(rikishi.birthplace)}</span>
          <em>${lockedByOtherPlayer ? `Drafted by ${owner.name} · unavailable to ${getPlayerDefinition().name}` : `Single-click for full profile · double-click to ${ownedByActivePlayer ? "remove" : "add"}`}</em>
        </aside>
      </article>`;
  };
  const label = row.rank.toUpperCase();
  const isMaegashira = row.rank.startsWith("Maegashira");
  const pairLabel = row.unassigned ? "SIDE UNKNOWN · " : !isMaegashira && row.position > 1 ? `PAIR ${row.position} · ` : "";
  return `<div class="banzuke-row" data-banzuke-row>${cell(row.East, "east")}<div class="rank-seal"><b>${escapeHtml(label)}</b><small>${pairLabel}${isMaegashira ? "前頭" : "役力士"}</small></div>${cell(row.West, "west")}</div>`;
}

function banzukeView() {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const check = validateRoster(player.id);
  const basho = selectedBasho();
  const pool = draftPoolStats(basho);
  const rows = banzukeRankRows(basho);
  const rankOptions = [...new Set(basho.entries.map((entry) => entry.rank))];
  return `
    <section class="page-shell">
      ${pageIntro(`${escapeHtml(basho.label.toUpperCase())} · TEAM BUILDER`, "Pick from the complete banzuke", `All ${basho.entries.length} official Makuuchi rikishi. Single-click a wrestler for their profile or double-click to edit ${player.name}'s roster.`, `<label class="search-field"><span>⌕</span><input id="banzuke-search" type="search" placeholder="Find a rikishi or stable" autocomplete="off" /></label>`)}
      ${editingBanner(`Shared draft · currently editing ${player.name}. A rikishi drafted by either player is locked to the other.`)}
      ${pendingSubstituteReplacement ? `<aside class="replacement-mode reveal"><span>↻</span><div><small>CHANGE SUBSTITUTE</small><b>Choose a legal replacement for ${getRikishi(pendingSubstituteReplacement)?.name || "this substitute"}.</b></div><button type="button" data-cancel-sub-replacement>Cancel</button></aside>` : ""}
      <section class="draft-pool-status reveal" data-draft-available="${pool.available}" data-draft-total="${pool.total}">
        <div class="draft-pool-stat available"><small>AVAILABLE</small><b>${pool.available}</b><span>of ${pool.total} rikishi</span></div>
        <div class="draft-pool-meter" aria-label="${pool.available} available, ${pool.counts.gwazy} drafted by Gwazy, ${pool.counts.jake} drafted by Jake">
          <span class="available" style="--share:${pool.available}"></span><span class="gwazy" style="--share:${pool.counts.gwazy}"></span><span class="jake" style="--share:${pool.counts.jake}"></span>
        </div>
        <div class="draft-pool-stat drafted"><small>DRAFTED</small><b>${pool.drafted}</b><span>Gwazy ${pool.counts.gwazy} · Jake ${pool.counts.jake}</span></div>
      </section>
      <section class="banzuke-builder ${player.color} reveal">
        <div class="builder-counts">
          <span><small>MAIN PICKS</small><b>${roster.team.length} / 6</b><em>${Math.max(0, 6 - roster.team.length)} remaining</em></span>
          <span><small>SUBSTITUTES</small><b>${roster.subs.length} / 3</b><em>${Math.max(0, 3 - roster.subs.length)} remaining</em></span>
        </div>
        ${validationChecklist(check)}
        <a class="secondary-button" href="#roster">Manage swaps</a>
      </section>
      <section class="banzuke-tools reveal" aria-label="Banzuke filters">
        <label><small>BASHO</small><select id="basho-select">${data.banzuke.bashos.map((item) => `<option value="${item.id}" ${item.id === basho.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
        <label><small>PICKS</small><select id="banzuke-pick-filter"><option value="all">All wrestlers</option><option value="available">Available</option><option value="mine">Only my picks</option><option value="gwazy">Only Gwazy's picks</option><option value="jake">Only Jake's picks</option></select></label>
        <label><small>SIDE</small><select id="banzuke-side-filter"><option value="all">East & West</option><option value="East">East only</option><option value="West">West only</option></select></label>
        <label><small>RANK</small><select id="banzuke-rank-filter"><option value="all">All ranks</option>${rankOptions.map((rank) => `<option value="${escapeHtml(rank)}">${escapeHtml(rank)}</option>`).join("")}</select></label>
        <label class="availability-filter"><input id="banzuke-hide-unavailable" type="checkbox" /><span>Hide unavailable</span></label>
        <output id="banzuke-visible-count"><b>${basho.entries.length}</b> shown</output>
      </section>
      <section class="banzuke-board reveal">
        <div class="banzuke-title"><span>東 <small>EAST</small></span><div><p>${escapeHtml(basho.japaneseTitle)}</p><h2>幕内番付</h2><small>${escapeHtml(basho.tournament.toUpperCase())} · ${escapeHtml(basho.division.toUpperCase())}</small></div><span>西 <small>WEST</small></span></div>
        <div class="banzuke-integrity"><span class="status-dot"></span><b id="banzuke-render-count">Checking ${basho.expectedRikishi} official entries…</b><small>Every data-layer rikishi must render.</small></div>
        <div class="banzuke-rows">${rows.map(banzukeRow).join("")}</div>
      </section>
      <p class="source-note"><a href="${basho.officialUrl}" target="_blank" rel="noreferrer">Official Japan Sumo Association banzuke ↗</a> · Records update from the read-only JSA snapshot. Picks save only to ${player.name}'s local draft.</p>
      ${appFooter()}
    </section>`;
}

function resultsForDay(day) {
  const officialDay = data.results?.days?.find((item) => item.day === day);
  if (!officialDay) return [];
  return officialDay.bouts
    .filter((bout) => getRikishi(bout.east) && getRikishi(bout.west))
    .map((bout) => {
      const ranks = [getRikishi(bout.east)?.rank, getRikishi(bout.west)?.rank];
      const importance = ranks.includes("Yokozuna") ? 5 : ranks.includes("Ozeki") ? 4 : ranks.some((rank) => ["Sekiwake", "Komusubi"].includes(rank)) ? 3 : 1;
      return { ...bout, importance };
    });
}

function resultsView() {
  const day = Number(state.selectedDay);
  const bouts = resultsForDay(day);
  const [gwazy, jake] = data.players;
  const gwazyToday = playerDayScore(gwazy.id, day);
  const jakeToday = playerDayScore(jake.id, day);
  const completed = bouts.filter((bout) => bout.completed).length;
  return `
    <section class="page-shell">
      ${pageIntro(`${escapeHtml(selectedBasho().label.toUpperCase())} · DAY ${day}`, "Bout results", "Official schedules, records, winners, and kimarite update from the JSA snapshot.", `<div class="daily-score"><span>GWAZY <b>${gwazyToday}</b></span><i></i><span>JAKE <b>${jakeToday}</b></span></div>`)}
      <div class="day-selector reveal" role="tablist" aria-label="Tournament day">${Array.from({ length: 15 }, (_, index) => `<button type="button" role="tab" aria-selected="${day === index + 1}" class="${day === index + 1 ? "active" : ""}" data-day="${index + 1}"><small>DAY</small>${index + 1}</button>`).join("")}</div>
      <div class="results-summary reveal"><span class="status-dot"></span><strong>${bouts.length ? (completed === bouts.length ? `Day ${day} official results` : `Day ${day} official schedule`) : "Awaiting the official torikumi"}</strong><span>${completed} completed · ${bouts.length - completed} scheduled</span><span>Draft points today: ${gwazyToday + jakeToday}</span></div>
      <section class="results-list reveal">${bouts.length ? bouts.map((bout, index) => `<div class="result-number">${String(index + 1).padStart(2, "0")}</div>${boutCard(bout, true)}`).join("") : `<div class="empty-results"><span>取</span><h2>Awaiting torikumi</h2><p>Day ${day} matchups will appear here when the official schedule is published.</p></div>`}</section>
      ${appFooter()}
    </section>`;
}

function calculateHistoryStats(events = state.history) {
  const wins = { Gwazy: 0, Jake: 0 };
  const scores = { gwazy: 0, jake: 0 };
  const pickCounts = {};
  let closest = null;
  let biggestVictory = null;
  let biggestComeback = null;

  events.forEach((event) => {
    if (wins[event.winner] !== undefined) wins[event.winner] += 1;
    scores.gwazy += Number(event.gwazyScore) || 0;
    scores.jake += Number(event.jakeScore) || 0;
    const margin = Math.abs((Number(event.gwazyScore) || 0) - (Number(event.jakeScore) || 0));
    if (!closest || margin < closest.margin) closest = { event, margin };
    if (!biggestVictory || margin > biggestVictory.margin) biggestVictory = { event, margin };
    if (!biggestComeback || (Number(event.comeback) || 0) > biggestComeback.points) biggestComeback = { event, points: Number(event.comeback) || 0 };
    Object.values(event.rosters || {}).flat().forEach((id) => { pickCounts[id] = (pickCounts[id] || 0) + 1; });
  });

  let currentWinner = null;
  let currentRun = 0;
  let longestStreak = { winner: "—", count: 0 };
  [...events].reverse().forEach((event) => {
    if (event.winner === currentWinner) currentRun += 1;
    else {
      currentWinner = event.winner;
      currentRun = 1;
    }
    if (currentRun > longestStreak.count) longestStreak = { winner: currentWinner, count: currentRun };
  });

  const mostPickedEntry = Object.entries(pickCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    wins,
    scores,
    closest,
    biggestVictory,
    biggestComeback,
    longestStreak,
    mostPicked: mostPickedEntry ? { rikishi: getRikishi(mostPickedEntry[0]), count: mostPickedEntry[1] } : null,
    average: events.length ? Math.round((scores.gwazy + scores.jake) / (events.length * 2)) : 0,
  };
}

function rikishiOptions(selected = "", excluded = []) {
  const none = `<option value="" ${selected ? "" : "selected"}>None</option>`;
  return none + data.rikishi
    .filter((rikishi) => !excluded.includes(rikishi.id) || rikishi.id === selected)
    .map((rikishi) => `<option value="${rikishi.id}" ${rikishi.id === selected ? "selected" : ""}>${rikishi.name} · ${rikishi.rank}</option>`)
    .join("");
}

function historyEditor() {
  const player = getPlayerDefinition();
  const playerId = player.id;
  const opponentId = playerId === "gwazy" ? "jake" : "gwazy";
  const opponent = getPlayerDefinition(opponentId);
  const event = state.history.find((item) => item.id === activeHistoryId) || state.history[0];
  if (!event) return "";
  activeHistoryId = event.id;
  const roster = event.rosters[playerId] || [];
  const available = data.rikishi.filter((rikishi) => !roster.includes(rikishi.id));
  const playerScoreKey = `${playerId}Score`;
  const opponentScoreKey = `${opponentId}Score`;
  return `
    ${editingBanner(`Player-owned history fields below belong only to ${player.name}. Shared result fields are clearly marked.`)}
    <section class="history-editor ${player.color} reveal">
      <div class="history-event-tabs" role="tablist" aria-label="Choose basho to edit">
        ${state.history.map((item) => `<button type="button" role="tab" aria-selected="${item.id === event.id}" class="${item.id === event.id ? "active" : ""}" data-history-select="${item.id}">${item.basho}</button>`).join("")}
      </div>
      <div class="history-editor-heading">
        <div><p class="eyebrow">EDITING ARCHIVED BASHO</p><h2>${event.basho}</h2></div>
        <span>Changes save instantly and all rivalry statistics recalculate.</span>
      </div>
      <div class="history-form-grid">
        <fieldset class="history-shared-panel">
          <legend>Shared result</legend>
          <p class="field-note">These facts describe the basho for both players.</p>
          <label>Winner<select data-history-global="winner"><option value="Gwazy" ${event.winner === "Gwazy" ? "selected" : ""}>Gwazy</option><option value="Jake" ${event.winner === "Jake" ? "selected" : ""}>Jake</option></select></label>
          <label>${player.name}'s final score<input type="number" min="0" value="${event[playerScoreKey]}" data-history-score="${playerScoreKey}" /></label>
          <label>${opponent.name}'s final score<input type="number" value="${event[opponentScoreKey]}" readonly aria-describedby="score-switch-note" /></label>
          <small id="score-switch-note">Switch to ${opponent.name} in the header to edit that score.</small>
          <label>Biggest comeback<input type="number" min="0" value="${event.comeback || 0}" data-history-global="comeback" /></label>
          <label>MVP<select data-history-global="mvp">${rikishiOptions(event.mvp)}</select></label>
        </fieldset>
        <fieldset class="history-player-panel">
          <legend>${player.name}'s archive</legend>
          <div class="history-prediction"><span>East / West prediction</span><div role="group" aria-label="${player.name}'s side prediction"><button type="button" class="${event.predictions[playerId] === "East" ? "active" : ""}" data-history-prediction="East">East</button><button type="button" class="${event.predictions[playerId] === "West" ? "active" : ""}" data-history-prediction="West">West</button></div></div>
          <label>Bonus points<input type="number" min="0" value="${event.bonusPoints[playerId] || 0}" data-history-player-field="bonusPoints" /></label>
          <label>Best pick<select data-history-player-field="bestPick">${rikishiOptions(event.bestPicks[playerId])}</select></label>
          <label>Worst pick<select data-history-player-field="worstPick">${rikishiOptions(event.worstPicks[playerId])}</select></label>
          <label class="wide-field">Notes<textarea rows="3" data-history-player-field="notes">${escapeHtml(event.notes[playerId])}</textarea></label>
        </fieldset>
      </div>
      <section class="history-roster-editor">
        <div><p class="eyebrow">${player.name.toUpperCase()}'S ROSTER</p><h3>${roster.length} / 9 picks</h3><small>Positions 1–6 are main picks; 7–9 are substitutes.</small></div>
        <div class="history-roster-chips">${roster.map((id, index) => { const rikishi = getRikishi(id); return `<span><small>${index < 6 ? `M${index + 1}` : `S${index - 5}`}</small><b>${rikishi?.name || id}</b><button type="button" aria-label="Remove ${rikishi?.name || id}" data-history-remove="${id}">×</button></span>`; }).join("")}</div>
        <div class="history-roster-add"><select id="history-roster-add" ${available.length && roster.length < 9 ? "" : "disabled"}>${available.map((rikishi) => `<option value="${rikishi.id}">${rikishi.name} · ${rikishi.rank}</option>`).join("")}</select><button class="secondary-button" type="button" data-history-add ${available.length && roster.length < 9 ? "" : "disabled"}>Add pick</button></div>
      </section>
    </section>`;
}

function historyView() {
  if (!state.history.length) {
    return `
      <section class="page-shell">
        ${pageIntro("RIVALRY ARCHIVE", "Basho history", "Completed tournaments will build the rivalry record here.")}
        <section class="blank-state-panel history-empty-state reveal" data-history-empty>
          <span class="blank-state-icon">歴</span>
          <div><p class="eyebrow">NO ARCHIVED BASHO</p><h2>History starts with the first real tournament.</h2><p>There are no previous winners, scores, MVPs, picks, streaks, or head-to-head statistics yet.</p></div>
        </section>
        ${appFooter()}
      </section>`;
  }
  const stats = calculateHistoryStats();
  const player = getPlayerDefinition();
  const activeWins = stats.wins[player.name] || 0;
  const winRate = state.history.length ? Math.round((activeWins / state.history.length) * 100) : 0;
  return `
    <section class="page-shell">
      ${pageIntro("RIVALRY ARCHIVE", "Basho history", "The wins, the collapses, and the picks that still get mentioned.", `<button class="primary-button history-edit-toggle" type="button" data-history-edit>${historyEditMode ? "Finish editing" : "Edit history"}</button>`)}
      ${historyEditMode ? historyEditor() : ""}
      <section class="history-hero reveal">
        <div><p class="eyebrow">ALL-TIME HEAD TO HEAD</p><div class="history-score"><span><b>${stats.wins.Gwazy}</b><small>GWAZY WINS</small></span><i>—</i><span><b>${stats.wins.Jake}</b><small>JAKE WINS</small></span></div></div>
        <div class="history-stats"><span><small>${player.name.toUpperCase()} WIN RATE</small><b>${winRate}%</b></span><span><small>CLOSEST</small><b>${stats.closest?.margin || 0} pts</b></span><span><small>BIGGEST VICTORY</small><b>${stats.biggestVictory?.margin || 0} pts</b></span><span><small>LONGEST STREAK</small><b>${stats.longestStreak.count} · ${stats.longestStreak.winner}</b></span></div>
      </section>
      <section class="history-list reveal">
        <div class="history-table-head"><span>BASHO</span><span>WINNER</span><span>FINAL SCORE</span><span>MARGIN</span><span>MVP</span><span>STORY</span></div>
        ${state.history.map((event) => {
          const margin = Math.abs(event.gwazyScore - event.jakeScore);
          const mvp = getRikishi(event.mvp);
          return `<button type="button" class="history-row ${historyEditMode && activeHistoryId === event.id ? "selected" : ""}" data-history-select="${event.id}">
            <span><span class="basho-mark">${event.basho.slice(0, 1)}</span><b>${event.basho}</b></span>
            <span class="winner-name ${event.winner.toLowerCase()}">${event.winner}</span>
            <strong>${event.gwazyScore}–${event.jakeScore}</strong><span>+${margin}</span><span>${mvp?.name || "—"}</span><span class="story-badge">${escapeHtml(event.badge || "ARCHIVE")}</span>
          </button>`;
        }).join("")}
      </section>
      <section class="stat-grid reveal">
        <article><small>MOST PICKED</small><strong>${stats.mostPicked?.rikishi?.name || "—"}</strong><span>${stats.mostPicked?.count || 0} roster appearances</span></article>
        <article><small>BIGGEST COMEBACK</small><strong>${stats.biggestComeback?.points || 0} pts</strong><span>${stats.biggestComeback?.event.basho || "—"}</span></article>
        <article><small>BIGGEST VICTORY</small><strong>${stats.biggestVictory?.event.winner || "—"}</strong><span>${stats.biggestVictory?.margin || 0} pts · ${stats.biggestVictory?.event.basho || "—"}</span></article>
        <article><small>AVG. PLAYER SCORE</small><strong>${stats.average}</strong><span>across ${state.history.length} basho</span></article>
      </section>
      ${appFooter()}
    </section>`;
}

function toggleRow(id, title, copy, checked) {
  return `<label class="setting-row" for="${id}"><span><b>${title}</b><small>${copy}</small></span><input id="${id}" type="checkbox" ${checked ? "checked" : ""} /><i></i></label>`;
}

function settingsView() {
  const player = getPlayerDefinition();
  const playerState = getPlayerState();
  const storageKilobytes = (JSON.stringify(state).length / 1024).toFixed(1);
  return `
    <section class="page-shell settings-shell">
      ${pageIntro("PREFERENCES & DATA", "Settings", "Make the battle yours and keep its source data healthy.")}
      ${editingBanner(`Favourite wrestler and notes are private to ${player.name}. Display and sound settings apply to this device.`)}
      <div class="settings-grid">
        <section class="settings-card player-settings-card ${player.color} reveal"><div class="settings-card-title"><span class="player-avatar ${player.color}">${player.initials}</span><div><h2>${player.name}'s preferences</h2><p>Switch players above to load the other profile.</p></div></div>
          <label class="setting-field">Favourite wrestler<select data-player-field="favouriteWrestler">${rikishiOptions(playerState.favouriteWrestler)}</select></label>
          <label class="setting-field">Personal notes<textarea rows="5" data-player-field="notes" placeholder="Private notes for ${player.name}">${escapeHtml(playerState.notes)}</textarea></label>
        </section>
        <section class="settings-card reveal"><div class="settings-card-title"><span>◐</span><div><h2>Appearance</h2><p>Choose a Japanese-inspired display theme.</p></div></div>
          <div class="theme-options">
            <button type="button" class="theme-option ${state.theme === "midnight" ? "active" : ""}" data-theme-choice="midnight"><span class="theme-preview midnight"><i></i></span><b>Midnight purple</b><small>Modern esports</small></button>
            <button type="button" class="theme-option ${state.theme === "heritage" ? "active" : ""}" data-theme-choice="heritage"><span class="theme-preview heritage"><i></i></span><b>Heritage red</b><small>Traditional warmth</small></button>
          </div>
          ${toggleRow("setting-motion", "Reduce motion", "Minimise score and page animations.", state.reducedMotion)}
          ${toggleRow("setting-compact", "Compact density", "Fit more roster and result rows on screen.", state.compact)}
        </section>
        <section class="settings-card reveal"><div class="settings-card-title"><span>♫</span><div><h2>Match sounds</h2><p>A restrained cue when points change.</p></div></div>
          ${toggleRow("setting-sound", "Taiko score cue", "Play a soft drum tone on saved updates.", state.sound)}
          <button class="secondary-button test-sound" type="button">Test sound</button>
          <p class="microcopy">Sound always requires a user gesture and can be disabled instantly in the header.</p>
        </section>
        <section class="settings-card data-card reveal"><div class="settings-card-title"><span>↻</span><div><h2>Official JSA layer</h2><p>Read-only banzuke, records, schedules, results, and injury data.</p></div></div>
          <div class="sync-panel"><span class="sync-icon">✓</span><div><b>Official snapshot loaded</b><small>${data.meta.lastUpdated}</small></div><span class="sync-badge"><i></i> JSA</span></div>
          <div class="source-list">${data.meta.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><span>${icons.source}</span><b>${source.label}</b><small>sumo.or.jp</small></a>`).join("")}</div>
          <button class="secondary-button" type="button" data-mock-sync>Check data now</button>
        </section>
        <section class="settings-card reveal"><div class="settings-card-title"><span>⌁</span><div><h2>Shared draft repository</h2><p>Rosters and predictions are read from one repository JSON file on every device.</p></div></div>
          <div class="sync-panel"><span class="sync-icon">${window.SHARED_DRAFT_API?.token() ? "✓" : "!"}</span><div><b>${window.SHARED_DRAFT_API?.token() ? "Write access ready" : "Write token required to save"}</b><small>${escapeHtml(window.SHARED_DRAFT_API?.config?.owner || "")}/${escapeHtml(window.SHARED_DRAFT_API?.config?.repo || "")} · ${escapeHtml(window.SHARED_DRAFT_API?.config?.branch || "")}</small></div></div>
          <label class="setting-field">Fine-grained GitHub token<input id="shared-draft-token" type="password" autocomplete="off" placeholder="github_pat_…" /></label>
          <button class="secondary-button" type="button" data-store-draft-token>${window.SHARED_DRAFT_API?.token() ? "Replace session token" : "Use token for this session"}</button>
          <button class="secondary-button" type="button" data-refresh-shared>Download latest shared draft</button>
          <div class="storage-meter"><div><span>Local preferences only</span><b>${storageKilobytes} KB</b></div><span><i style="--width:${Math.min(100, Number(storageKilobytes) * 4)}%"></i></span></div>
          <button class="danger-button" type="button" data-reset-draft>Reset current draft only</button>
          <p class="microcopy">The token needs Contents read/write access to this repository. It exists only in this browser tab and is never written to localStorage or the repository.</p>
        </section>
      </div>
      ${appFooter()}
    </section>`;
}

function appFooter() {
  return `
    <footer class="app-footer">
      <div class="brand footer-brand"><span class="brand-mon"><span>相</span></span><span><strong>SUMO BATTLE</strong><small>Made for the rivalry, not for money.</small></span></div>
      <p>Official results come from the <a href="${data.meta.sources[0].url}" target="_blank" rel="noreferrer">Nihon Sumo Kyokai</a>. Picks come from the shared repository draft.</p>
      <span>v3.0 · ${data.meta.shortTournament}</span>
    </footer>`;
}

function profileMarkup(rikishi) {
  const ownerId = draftOwner(rikishi.id);
  const owner = ownerId ? getPlayerDefinition(ownerId) : null;
  const location = ownerId ? pickLocation(rikishi.id, ownerId) : null;
  const profileLink = rikishi.profile
    ? `<a class="primary-button profile-link" href="${escapeHtml(rikishi.profile)}" target="_blank" rel="noreferrer">Official profile ${icons.source}</a>`
    : `<span class="profile-link-unavailable">Official profile unavailable</span>`;
  return `
    <div class="profile-hero">
      ${wrestlerImage(rikishi, "large")}
      <div><p class="eyebrow">${formatRank(rikishi)}</p><h2 id="profile-name">${rikishi.fullName || rikishi.name}</h2><p>${rikishi.stable} stable · ${rikishi.birthplace}</p><div class="profile-record"><strong>${rikishi.record}</strong><span>${rikishi.wins} wins<br />${rikishi.losses} losses</span></div></div>
      <div class="profile-owner"><small>DRAFT OWNERSHIP</small><span class="player-avatar ${owner ? owner.color : "neutral"}">${owner ? owner.initials : "—"}</span><b>${owner ? `${owner.name} · ${location === "main" ? "Main pick" : "Substitute"}` : "Available"}</b></div>
    </div>
    <div class="profile-stats">
      <span><small>POINTS</small><b>${rikishi.points}</b></span><span><small>FORM</small><b>${rikishi.wins + rikishi.losses ? `${rikishi.form}%` : "—"}</b></span><span><small>HEIGHT</small><b>${rikishi.height}</b></span><span><small>WEIGHT</small><b>${rikishi.weight}</b></span>
    </div>
    <div class="profile-details"><div><small>CAREER HIGH</small><b>${rikishi.careerHigh}</b></div><div><small>SIGNATURE</small><b>${rikishi.technique}</b></div></div>
    <div class="profile-form"><span style="--width:${rikishi.form}%"></span></div>
    ${profileLink}`;
}

function openProfile(id) {
  const rikishi = getRikishi(id);
  if (!rikishi) return;
  profileContent.innerHTML = profileMarkup(rikishi);
  dialog.showModal();
  window.RIKISHI_IMAGES?.bind(profileContent);
}

function animateNumbers() {
  document.querySelectorAll(".count-up").forEach((element) => {
    const target = Number(element.dataset.value);
    if (state.reducedMotion) {
      element.textContent = target;
      return;
    }
    const start = performance.now();
    const duration = 750;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.floor(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function render() {
  const route = routeName();
  setActiveNav(route);
  const views = {
    overview: overviewView,
    roster: rosterView,
    banzuke: banzukeView,
    results: resultsView,
    history: historyView,
    settings: settingsView,
  };
  app.classList.add("route-leave");
  setTimeout(() => {
    app.innerHTML = `${newBashoNotice()}${views[route]()}`;
    app.classList.remove("route-leave");
    app.dataset.route = route;
    window.scrollTo({ top: 0, behavior: state.reducedMotion ? "auto" : "smooth" });
    bindViewEvents();
    if (route === "banzuke") verifyBanzukeIntegrity();
    window.RIKISHI_IMAGES?.bind(app);
    animateNumbers();
  }, state.reducedMotion ? 0 : 80);
}

function addPick(rikishiId, requestedTarget = null) {
  if (draftEditingDisabled()) {
    showToast(savedSharedDraft?.locked ? "The shared draft is locked." : "Wait for the shared draft to finish loading.");
    return;
  }
  const player = getPlayerDefinition();
  const roster = getRoster();
  const rikishi = getRikishi(rikishiId);
  if (!rikishi || pickLocation(rikishiId)) return;
  const ownerId = draftOwner(rikishiId);
  if (ownerId && ownerId !== state.activePlayer) {
    showToast(`${rikishi.name} was drafted by ${getPlayerDefinition(ownerId).name}.`);
    return;
  }
  if (rikishi.available === false) {
    showToast(`${rikishi.name} is unavailable for roster selection.`);
    return;
  }

  const target = ["main", "sub"].includes(requestedTarget) ? requestedTarget : null;
  const canAddMain = roster.team.length < 6 && mainPickRules([...roster.team, rikishiId]).valid;
  const replacementIndex = pendingSubstituteReplacement ? roster.subs.indexOf(pendingSubstituteReplacement) : -1;
  const candidateSubs = replacementIndex >= 0
    ? roster.subs.map((id, index) => index === replacementIndex ? rikishiId : id)
    : [...roster.subs, rikishiId];
  const canAddSub = (replacementIndex >= 0 || roster.subs.length < 3) && substituteRules(candidateSubs).valid;
  let destination = null;

  if ((target === "main" || target === null) && canAddMain) {
    roster.team.push(rikishiId);
    destination = "main picks";
  } else if ((target === "sub" || target === null) && canAddSub) {
    if (replacementIndex >= 0) roster.subs[replacementIndex] = rikishiId;
    else roster.subs.push(rikishiId);
    destination = "substitutes";
  }

  if (!destination) {
    const rule = mainPickRules([...roster.team, rikishiId]);
    const subRule = substituteRules(candidateSubs);
    const reason = target === "sub" && roster.subs.length >= 3 && replacementIndex < 0
      ? `${player.name}'s substitute roster is full. Choose Change substitute from the roster page.`
      : target === "sub" && subRule.sanyaku > 1
        ? "Substitutes may include exactly one Komusubi-or-higher wrestler."
        : target === "sub" && subRule.maegashira > 2
          ? "Substitutes may include exactly two Maegashira wrestlers."
          : target === "main" && roster.team.length >= 6
            ? `${player.name}'s main roster is full. Remove or swap a pick first.`
            : roster.team.length >= 6 && roster.subs.length >= 3
      ? `${player.name}'s roster is full. Remove or swap a pick first.`
      : rule.sanyaku > 2
        ? "Main picks can include at most two Komusubi or higher."
        : rule.underdogs > 1
          ? "Main picks can include exactly one M13–M17 underdog."
          : "The last main slot must be filled by an M13–M17 underdog.";
    showToast(reason);
    return;
  }

  const replaced = pendingSubstituteReplacement ? getRikishi(pendingSubstituteReplacement) : null;
  pendingSubstituteReplacement = null;
  render();
  showToast(replaced ? `${rikishi.name} replaced ${replaced.name}. Save Picks to publish.` : `${rikishi.name} staged in ${player.name}'s ${destination}.`);
}

function removePick(rikishiId) {
  if (draftEditingDisabled()) return;
  const player = getPlayerDefinition();
  const roster = getRoster();
  const location = pickLocation(rikishiId);
  if (!location) {
    const ownerId = draftOwner(rikishiId);
    if (ownerId) showToast(`${getRikishi(rikishiId).name} belongs to ${getPlayerDefinition(ownerId).name}.`);
    return;
  }
  const list = location === "main" ? roster.team : roster.subs;
  list.splice(list.indexOf(rikishiId), 1);
  if (pendingSwap?.rikishiId === rikishiId) pendingSwap = null;
  render();
  showToast(`${getRikishi(rikishiId).name} removed from the working copy.`);
}

function movePick(rikishiId, target) {
  if (draftEditingDisabled()) return;
  const player = getPlayerDefinition();
  const roster = getRoster();
  const from = target === "main" ? roster.subs : roster.team;
  const to = target === "main" ? roster.team : roster.subs;
  if (!from.includes(rikishiId)) return;
  const limit = target === "main" ? 6 : 3;
  if (to.length >= limit) {
    showToast(`${target === "main" ? "Main picks" : "Substitutes"} are full. Use Swap instead.`);
    return;
  }
  const candidateMain = target === "main" ? [...roster.team, rikishiId] : roster.team.filter((id) => id !== rikishiId);
  const candidateSubs = target === "subs" ? [...roster.subs, rikishiId] : roster.subs.filter((id) => id !== rikishiId);
  if (!mainPickRules(candidateMain).valid || !substituteRules(candidateSubs).valid) {
    showToast("That move would break a main-pick or substitute category rule.");
    return;
  }
  from.splice(from.indexOf(rikishiId), 1);
  to.push(rikishiId);
  pendingSwap = null;
  render();
  showToast(`${getRikishi(rikishiId).name} moved to ${player.name}'s ${target === "main" ? "main picks" : "substitutes"}.`);
}

function chooseSwap(rikishiId, source) {
  if (draftEditingDisabled()) return;
  const playerId = state.activePlayer;
  const sourceIsSub = source === "sub";
  if (pendingSwap?.playerId !== playerId) pendingSwap = null;
  if (!pendingSwap) {
    pendingSwap = { playerId, rikishiId, substitute: sourceIsSub };
    render();
    return;
  }
  if (pendingSwap.rikishiId === rikishiId) {
    pendingSwap = null;
    render();
    return;
  }
  if (pendingSwap.substitute === sourceIsSub) {
    pendingSwap = { playerId, rikishiId, substitute: sourceIsSub };
    render();
    return;
  }

  const roster = getRoster();
  const mainId = sourceIsSub ? pendingSwap.rikishiId : rikishiId;
  const subId = sourceIsSub ? rikishiId : pendingSwap.rikishiId;
  const mainIndex = roster.team.indexOf(mainId);
  const subIndex = roster.subs.indexOf(subId);
  if (mainIndex < 0 || subIndex < 0) return;
  const candidateMain = [...roster.team];
  candidateMain[mainIndex] = subId;
  const candidateSubs = [...roster.subs];
  candidateSubs[subIndex] = mainId;
  if (!mainPickRules(candidateMain).valid || !substituteRules(candidateSubs).valid) {
    showToast("That swap would break a main-pick or substitute category rule.");
    return;
  }
  roster.team[mainIndex] = subId;
  roster.subs[subIndex] = mainId;
  pendingSwap = null;
  render();
  showToast(`${getRikishi(subId).name} moved into the main team.`);
}

function reorderSubstitute(rikishiId, direction) {
  if (draftEditingDisabled()) return;
  const roster = getRoster();
  const index = roster.subs.indexOf(rikishiId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= roster.subs.length) return;
  [roster.subs[index], roster.subs[targetIndex]] = [roster.subs[targetIndex], roster.subs[index]];
  render();
  showToast(`${getRikishi(rikishiId).name} moved to substitute slot ${targetIndex + 1}.`);
}

function replaceRosterPick(oldId, newId, type) {
  if (draftEditingDisabled() || !oldId || !newId || oldId === newId) return;
  const owner = draftOwner(newId);
  const rikishi = getRikishi(newId);
  if (!rikishi || rikishi.available === false || owner) {
    showToast("That wrestler is not available in the shared draft.");
    return;
  }
  const roster = getRoster();
  const list = type === "sub" ? roster.subs : roster.team;
  const index = list.indexOf(oldId);
  if (index < 0) return;
  const candidate = [...list];
  candidate[index] = newId;
  const legal = type === "sub" ? substituteRules(candidate).valid : mainPickRules(candidate).valid;
  if (!legal) {
    showToast("That replacement would break a roster category rule.");
    return;
  }
  list[index] = newId;
  pendingSwap = null;
  render();
  showToast(`${rikishi.name} staged as the replacement. Save Picks to publish.`);
}

function developmentDiagnosticsEnabled() {
  return window.SUMO_DEBUG === true || ["localhost", "127.0.0.1"].includes(window.location?.hostname);
}

function occurrenceMap(values) {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map());
}

function verifyBanzukeIntegrity(basho = selectedBasho()) {
  const official = basho.officialRikishi || basho.entries.map((entry) => ({
    id: entry.rikishiId,
    shikona: entry.shikona || getRikishi(entry.rikishiId)?.shikona || getRikishi(entry.rikishiId)?.name || entry.rikishiId,
  }));
  const datasetCounts = occurrenceMap(data.rikishi.map((rikishi) => rikishi.id));
  const rendered = [...app.querySelectorAll("[data-banzuke-id]")];
  const renderedCounts = occurrenceMap(rendered.map((element) => element.dataset.banzukeId));
  const officialShikona = new Set(official.map((source) => source.shikona));
  const renderedShikona = new Set(rendered.map((element) => element.dataset.banzukeShikona));
  const missingShikona = [...officialShikona].filter((shikona) => !renderedShikona.has(shikona));
  const unexpectedShikona = [...renderedShikona].filter((shikona) => !officialShikona.has(shikona));
  const notParsed = official.filter((source) => !datasetCounts.has(source.id));
  const parsedNotRendered = official.filter((source) => datasetCounts.has(source.id) && !renderedCounts.has(source.id));
  const missingRendered = official.filter((source) => !renderedCounts.has(source.id));
  const duplicateDataset = official.filter((source) => (datasetCounts.get(source.id) || 0) !== 1 && datasetCounts.has(source.id));
  const duplicateRendered = official.filter((source) => (renderedCounts.get(source.id) || 0) > 1);
  const development = developmentDiagnosticsEnabled();
  const status = app.querySelector("#banzuke-render-count");
  const integrity = status?.closest(".banzuke-integrity");
  integrity?.classList.remove("ok", "bad");

  official.forEach((source) => {
    const parsedCount = datasetCounts.get(source.id) || 0;
    const renderedCount = renderedCounts.get(source.id) || 0;
    if (!parsedCount) {
      console.error(`WARNING\n\n${source.shikona}\n\nNot parsed`);
      return;
    }
    if (!renderedCount) {
      console.error([
        "WARNING",
        "",
        source.shikona,
        "",
        "Parsed ✓",
        "Rendered ✗",
        "",
        "Reason:",
        "No matching banzuke card was created from the parsed dataset object.",
      ].join("\n"));
      return;
    }
    if (renderedCount > 1) {
      console.error(`WARNING\n\n${source.shikona}\n\nParsed ✓\nRendered ${renderedCount} times ✗\n\nReason:\nExpected exactly one rendered card.`);
      return;
    }
    if (development) console.info(`Rendered:\n\n${source.shikona} ✓`);
  });

  const summary = [
    "Official:",
    "",
    `${official.length} rikishi`,
    "",
    "Rendered:",
    "",
    `${officialShikona.size - missingShikona.length} rikishi`,
    "",
    "Missing:",
    "",
    missingShikona.length ? missingShikona.join("\n") : "None",
  ].join("\n");
  const valid = !notParsed.length && !parsedNotRendered.length && !duplicateDataset.length && !duplicateRendered.length
    && !missingShikona.length && !unexpectedShikona.length && renderedShikona.size === officialShikona.size;

  if (!valid) {
    if (missingRendered.length) console.error(`${missingRendered.length} rikishi missing from rendered banzuke.`);
    if (duplicateDataset.length) console.error(`Dataset duplicates: ${duplicateDataset.map((source) => source.shikona).join(", ")}`);
    if (duplicateRendered.length) console.error(`Rendered duplicates: ${duplicateRendered.map((source) => source.shikona).join(", ")}`);
    if (unexpectedShikona.length) console.error(`Unexpected rendered shikona: ${unexpectedShikona.join(", ")}`);
    console.error(`Banzuke coverage failure\n\n${summary}`);
    if (status) status.textContent = `${officialShikona.size - missingShikona.length} / ${officialShikona.size} official rikishi rendered · INVALID`;
    integrity?.classList.add("bad");
    return false;
  }
  if (development) console.info(`Banzuke coverage valid\n\n${summary}`);
  if (status) status.textContent = `${officialShikona.size} / ${officialShikona.size} official rikishi rendered`;
  integrity?.classList.add("ok");
  return true;
}

function applyBanzukeFilters() {
  const search = app.querySelector("#banzuke-search");
  if (!search) return;
  const term = search.value.toLowerCase().trim();
  const pickFilter = app.querySelector("#banzuke-pick-filter")?.value || "all";
  const sideFilter = app.querySelector("#banzuke-side-filter")?.value || "all";
  const rankFilter = app.querySelector("#banzuke-rank-filter")?.value || "all";
  const hideUnavailable = Boolean(app.querySelector("#banzuke-hide-unavailable")?.checked);
  let visible = 0;

  app.querySelectorAll("[data-banzuke-id]").forEach((card) => {
    const matchesSearch = !term || card.dataset.searchValue.includes(term);
    const matchesPicks = pickFilter === "all"
      || (pickFilter === "available" && card.dataset.draftOwner === "" && card.dataset.available === "true")
      || (pickFilter === "mine" && card.dataset.pickedCurrent === "true")
      || (pickFilter === "gwazy" && card.dataset.draftOwner === "gwazy")
      || (pickFilter === "jake" && card.dataset.pickedJake === "true");
    const matchesSide = sideFilter === "all" || card.dataset.side === sideFilter;
    const matchesRank = rankFilter === "all" || card.dataset.rank === rankFilter;
    const matchesAvailability = !hideUnavailable || card.dataset.available === "true";
    const matches = matchesSearch && matchesPicks && matchesSide && matchesRank && matchesAvailability;
    card.classList.toggle("filter-hidden", !matches);
    if (matches) visible += 1;
  });

  app.querySelectorAll("[data-banzuke-row]").forEach((row) => {
    const cards = [...row.querySelectorAll("[data-banzuke-id]")];
    row.classList.toggle("filter-hidden", !cards.some((card) => !card.classList.contains("filter-hidden")));
  });
  const output = app.querySelector("#banzuke-visible-count");
  if (output) output.innerHTML = `<b>${visible}</b> shown`;
}

function currentHistoryEvent() {
  return state.history.find((event) => event.id === activeHistoryId) || state.history[0];
}

function bindViewEvents() {
  app.querySelectorAll("[data-profile]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.closest("[data-add-pick], [data-remove-pick], [data-roster-move], [data-swap-pick], [data-replace-sub], [data-sub-reorder]")) return;
      if (element.closest(".banzuke-rikishi")) {
        clearTimeout(banzukeProfileTimer);
        banzukeProfileTimer = setTimeout(() => openProfile(element.dataset.profile), 220);
      } else openProfile(element.dataset.profile);
    });
  });
  app.querySelectorAll("[data-banzuke-id]").forEach((card) => card.addEventListener("dblclick", (event) => {
    if (event.target.closest("[data-add-pick], [data-remove-pick]")) return;
    event.preventDefault();
    clearTimeout(banzukeProfileTimer);
    const rikishi = getRikishi(card.dataset.banzukeId);
    if (!rikishi) return;
    const ownerId = draftOwner(rikishi.id);
    if (ownerId === state.activePlayer) removePick(rikishi.id);
    else if (ownerId) showToast(`${rikishi.name} was drafted by ${getPlayerDefinition(ownerId).name}.`);
    else if (rikishi.available === false) showToast(`${rikishi.name} is unavailable for roster selection.`);
    else addPick(rikishi.id);
  }));
  app.querySelectorAll("[data-add-pick]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    addPick(...button.dataset.addPick.split(":"));
  }));
  app.querySelectorAll("[data-remove-pick]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    removePick(button.dataset.removePick);
  }));
  app.querySelectorAll("[data-roster-move]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    movePick(...button.dataset.rosterMove.split(":"));
  }));
  app.querySelectorAll("[data-swap-pick]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    chooseSwap(...button.dataset.swapPick.split(":"));
  }));
  app.querySelectorAll("[data-sub-reorder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    reorderSubstitute(...button.dataset.subReorder.split(":"));
  }));
  app.querySelectorAll("[data-replace-sub]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    pendingSubstituteReplacement = button.dataset.replaceSub;
    pendingSwap = null;
    location.hash = "#banzuke";
    render();
  }));
  document.querySelector("[data-cancel-sub-replacement]")?.addEventListener("click", () => {
    pendingSubstituteReplacement = null;
    render();
  });
  document.querySelector("[data-cancel-swap]")?.addEventListener("click", () => { pendingSwap = null; render(); });
  app.querySelectorAll("[data-day]").forEach((button) => button.addEventListener("click", () => {
    state.selectedDay = Number(button.dataset.day);
    saveState();
    render();
  }));
  app.querySelectorAll("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => {
    state.theme = button.dataset.themeChoice;
    saveState();
    setTheme();
    render();
  }));
  document.querySelector("#setting-motion")?.addEventListener("change", (event) => {
    state.reducedMotion = event.target.checked;
    saveState();
    setTheme();
  });
  document.querySelector("#setting-compact")?.addEventListener("change", (event) => {
    state.compact = event.target.checked;
    saveState();
    setTheme();
  });
  document.querySelector("#setting-sound")?.addEventListener("change", (event) => {
    state.sound = event.target.checked;
    saveState();
    setTheme();
  });
  document.querySelector(".test-sound")?.addEventListener("click", () => {
    const wasEnabled = state.sound;
    state.sound = true;
    playBell();
    state.sound = wasEnabled;
    showToast("Score cue played.");
  });
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => {
    saveSharedDraft();
  });
  app.querySelectorAll("[data-refresh-shared]").forEach((button) => button.addEventListener("click", refreshSharedDraft));
  app.querySelector("[data-toggle-draft-lock]")?.addEventListener("click", toggleSharedDraftLock);
  document.querySelector("[data-store-draft-token]")?.addEventListener("click", () => {
    const field = document.querySelector("#shared-draft-token");
    if (!field?.value.trim()) {
      showToast("Paste a fine-grained GitHub token first.");
      return;
    }
    window.SHARED_DRAFT_API?.setToken(field.value);
    field.value = "";
    render();
    showToast("Repository write access is ready for this session.");
  });
  app.querySelectorAll("[data-roster-add]").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.rosterAdd;
    const field = document.querySelector(type === "sub" ? "#roster-add-sub" : "#roster-add-main");
    if (field?.value) addPick(field.value, type);
  }));
  app.querySelectorAll("[data-roster-replace]").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.rosterReplace;
    const oldField = document.querySelector(type === "sub" ? "#roster-replace-sub-old" : "#roster-replace-main-old");
    const newField = document.querySelector(type === "sub" ? "#roster-replace-sub-new" : "#roster-replace-main-new");
    replaceRosterPick(oldField?.value, newField?.value, type);
  }));
  document.querySelector("[data-mock-sync]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Checking deployed snapshot…";
    try {
      const response = await fetch(`data/official/basho.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Snapshot unavailable");
      const latest = await response.json();
      const updateAvailable = latest.dataSignature && latest.dataSignature !== data.meta.dataSignature;
      showToast(updateAvailable ? "New official data is available. Refresh this page to load it." : "This page has the latest deployed JSA snapshot.");
    } catch {
      showToast("Could not check the deployed snapshot. Your draft is unchanged.");
    } finally {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Check data now";
    }
  });
  document.querySelector("[data-reset-draft]")?.addEventListener("click", () => {
    resetCurrentDraft();
    render();
    showToast(`${selectedBasho().label} working copy reset. Save Picks to publish it.`);
  });
  app.querySelectorAll("[data-bonus]").forEach((button) => button.addEventListener("click", () => {
    if (draftEditingDisabled()) return;
    getDraftPlayer().sidePrediction = button.dataset.bonus;
    render();
    showToast(`${button.dataset.bonus} staged as ${getPlayerDefinition().name}'s prediction. Save Picks to publish.`);
  }));
  document.querySelector("[data-start-new-draft]")?.addEventListener("click", () => {
    startNewOfficialBashoDraft();
    render();
    showToast(`${selectedBasho().label} is ready for a new shared draft. Previous history was preserved.`);
  });
  app.querySelectorAll("[data-player-field]").forEach((field) => field.addEventListener(field.tagName === "TEXTAREA" ? "input" : "change", () => {
    getPlayerState()[field.dataset.playerField] = field.value;
    saveState();
  }));
  document.querySelector("[data-history-edit]")?.addEventListener("click", () => {
    historyEditMode = !historyEditMode;
    render();
  });
  app.querySelectorAll("[data-history-select]").forEach((button) => button.addEventListener("click", () => {
    activeHistoryId = button.dataset.historySelect;
    if (historyEditMode) render();
    else showToast("Enable Edit history to change this basho.");
  }));
  app.querySelectorAll("[data-history-global]").forEach((field) => field.addEventListener("change", () => {
    const event = currentHistoryEvent();
    const key = field.dataset.historyGlobal;
    event[key] = field.type === "number" ? Number(field.value) : field.value;
    saveState();
    render();
  }));
  app.querySelectorAll("[data-history-score]").forEach((field) => field.addEventListener("change", () => {
    const event = currentHistoryEvent();
    event[field.dataset.historyScore] = Math.max(0, Number(field.value) || 0);
    if (event.gwazyScore !== event.jakeScore) event.winner = event.gwazyScore > event.jakeScore ? "Gwazy" : "Jake";
    saveState();
    render();
  }));
  app.querySelectorAll("[data-history-prediction]").forEach((button) => button.addEventListener("click", () => {
    const event = currentHistoryEvent();
    event.predictions[state.activePlayer] = button.dataset.historyPrediction;
    saveState();
    render();
  }));
  app.querySelectorAll("[data-history-player-field]").forEach((field) => {
    const eventName = field.tagName === "TEXTAREA" ? "input" : "change";
    field.addEventListener(eventName, () => {
      const event = currentHistoryEvent();
      const key = field.dataset.historyPlayerField;
      if (key === "bonusPoints") event.bonusPoints[state.activePlayer] = Math.max(0, Number(field.value) || 0);
      if (key === "bestPick") event.bestPicks[state.activePlayer] = field.value;
      if (key === "worstPick") event.worstPicks[state.activePlayer] = field.value;
      if (key === "notes") event.notes[state.activePlayer] = field.value;
      saveState();
      if (key !== "notes") render();
    });
  });
  app.querySelectorAll("[data-history-remove]").forEach((button) => button.addEventListener("click", () => {
    const roster = currentHistoryEvent().rosters[state.activePlayer];
    roster.splice(roster.indexOf(button.dataset.historyRemove), 1);
    saveState();
    render();
  }));
  document.querySelector("[data-history-add]")?.addEventListener("click", () => {
    const select = document.querySelector("#history-roster-add");
    const roster = currentHistoryEvent().rosters[state.activePlayer];
    if (select?.value && roster.length < 9 && !roster.includes(select.value)) roster.push(select.value);
    saveState();
    render();
  });
  app.querySelector("#banzuke-search")?.addEventListener("input", applyBanzukeFilters);
  ["#banzuke-pick-filter", "#banzuke-side-filter", "#banzuke-rank-filter", "#banzuke-hide-unavailable"].forEach((selector) => {
    app.querySelector(selector)?.addEventListener("change", applyBanzukeFilters);
  });
  app.querySelector("#basho-select")?.addEventListener("change", (event) => {
    state.selectedBashoId = event.target.value;
    saveState();
    render();
  });
}

document.addEventListener("click", (event) => {
  const routeLink = event.target.closest('a[href^="#"]');
  const destination = routeLink?.getAttribute("href");
  const staysInDraftWorkspace = ["#roster", "#banzuke"].includes(destination);
  if (routeLink && hasUnsavedDraftChanges() && !staysInDraftWorkspace) {
    if (!window.confirm("You have unsaved changes. Do you want to discard them?")) {
      event.preventDefault();
      return;
    }
    applySharedDraft(savedSharedDraft, sharedDraftSha);
  }
  const navTarget = event.target.closest("[data-nav]");
  if (navTarget) location.hash = navTarget.dataset.nav;
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

soundButton.addEventListener("click", () => {
  state.sound = !state.sound;
  saveState();
  setTheme();
  if (state.sound) playBell();
  showToast(`Score sounds ${state.sound ? "on" : "off"}.`);
});

playerSelect.addEventListener("change", () => {
  state.activePlayer = playerSelect.value;
  pendingSwap = null;
  pendingSubstituteReplacement = null;
  saveState();
  setTheme();
  render();
  showToast(`Now playing as ${getPlayerDefinition().name}. Player-only data has been switched.`);
});

window.addEventListener("hashchange", render);
window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedDraftChanges()) return;
  event.preventDefault();
  event.returnValue = "You have unsaved changes. Do you want to discard them?";
});
setTheme();
render();
loadSharedDraft();
