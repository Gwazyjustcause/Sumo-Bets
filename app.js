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
const DRAFT_SCHEMA_VERSION = 4;
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
  spoilerFree: true,
  spoilerWatchedDays: {},
  spoilerPromptedDays: {},
  activePlayer: "gwazy",
  selectedBashoId: data.banzuke?.currentBashoId || "",
  selectedDay: Math.max(1, data.meta.day),
  players: defaultPlayers,
  appVersion: APP_SAVE_VERSION,
  draftSchemaVersion: DRAFT_SCHEMA_VERSION,
  drafts: emptyDrafts(),
  history: JSON.parse(JSON.stringify(data.history)),
  officialBashoId: data.meta.bashoId || "",
  pendingOfficialBasho: null,
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
    // Rosters are never restored from localStorage. The Supabase-backed shared
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
let historyEditMode = false;
let activeHistoryId = state.history[0]?.id || null;
let banzukeProfileTimer = null;
let resultsFilter = "all";
let sharedDraftRevision = 0;
let savedSharedDraft = null;
let sharedDraftLoading = true;
let sharedDraftSaving = false;
let sharedDraftError = null;
let sharedValidationErrors = [];
let stopSharedDraftSubscription = null;

function officialCompletedDays() {
  return (data.results?.days || [])
    .filter((officialDay) => (officialDay.bouts || []).some((bout) => bout.completed))
    .map((officialDay) => Number(officialDay.day))
    .filter((day) => Number.isFinite(day))
    .sort((a, b) => a - b);
}

function spoilerBashoId() {
  return data.meta.bashoId || state.selectedBashoId;
}

function watchedDaySet() {
  return new Set(state.spoilerWatchedDays?.[spoilerBashoId()] || []);
}

function promptedDaySet() {
  return new Set(state.spoilerPromptedDays?.[spoilerBashoId()] || []);
}

function initializeSpoilerState() {
  state.spoilerFree = state.spoilerFree !== false;
  state.spoilerWatchedDays = state.spoilerWatchedDays && typeof state.spoilerWatchedDays === "object" ? state.spoilerWatchedDays : {};
  state.spoilerPromptedDays = state.spoilerPromptedDays && typeof state.spoilerPromptedDays === "object" ? state.spoilerPromptedDays : {};
  const bashoId = spoilerBashoId();
  const completedDays = officialCompletedDays();
  if (!Array.isArray(state.spoilerWatchedDays[bashoId])) {
    const newest = completedDays.at(-1) || 0;
    state.spoilerWatchedDays[bashoId] = completedDays.filter((day) => day < newest);
  }
  if (!Array.isArray(state.spoilerPromptedDays[bashoId])) state.spoilerPromptedDays[bashoId] = [];
}

function spoilerVisibleDay() {
  const completedDays = officialCompletedDays();
  const latest = completedDays.at(-1) || 0;
  if (!state.spoilerFree) return latest;
  const watched = watchedDaySet();
  let visible = 0;
  for (let day = 1; day <= latest && watched.has(day); day += 1) visible = day;
  return visible;
}

function hiddenResultDays() {
  if (!state.spoilerFree) return [];
  const watched = watchedDaySet();
  return officialCompletedDays().filter((day) => !watched.has(day));
}

function activeHiddenDay() {
  return hiddenResultDays()[0] || null;
}

function isDayHidden(day) {
  return state.spoilerFree && officialCompletedDays().includes(Number(day)) && !watchedDaySet().has(Number(day));
}

function revealSpoilerDay(day) {
  const target = Number(day);
  const bashoId = spoilerBashoId();
  const watched = watchedDaySet();
  officialCompletedDays().filter((value) => value <= target).forEach((value) => watched.add(value));
  state.spoilerWatchedDays[bashoId] = [...watched].sort((a, b) => a - b);
  const prompted = promptedDaySet();
  prompted.add(target);
  state.spoilerPromptedDays[bashoId] = [...prompted].sort((a, b) => a - b);
  state.selectedDay = target;
  saveState();
  render();
  showToast(`Day ${target} revealed.`);
}

function keepSpoilerDayHidden(day) {
  const bashoId = spoilerBashoId();
  const prompted = promptedDaySet();
  prompted.add(Number(day));
  state.spoilerPromptedDays[bashoId] = [...prompted].sort((a, b) => a - b);
  saveState();
  render();
}

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

function sharedPlayerComparable(players, playerId) {
  return sharedComparable(players)[playerId];
}

function hasUnsavedPlayerChanges(playerId = state.activePlayer) {
  if (!savedSharedDraft || sharedDraftLoading) return false;
  return JSON.stringify(sharedPlayerComparable(state.drafts[state.selectedBashoId], playerId))
    !== JSON.stringify(sharedPlayerComparable(savedSharedDraft.players, playerId));
}

function hasUnsavedDraftChanges() {
  if (!savedSharedDraft || sharedDraftLoading) return false;
  return JSON.stringify(sharedComparable()) !== JSON.stringify(sharedComparable(savedSharedDraft.players));
}

function sharedPlayerLocks(document = savedSharedDraft) {
  if (!document) return { gwazy: false, jake: false };
  if (document.playerLocks) return Object.fromEntries(data.players.map((player) => [player.id, Boolean(document.playerLocks[player.id])]));
  const legacyLocked = Boolean(document.locked);
  return Object.fromEntries(data.players.map((player) => [player.id, legacyLocked]));
}

function isPlayerDraftLocked(playerId = state.activePlayer, document = savedSharedDraft) {
  return Boolean(sharedPlayerLocks(document)[playerId]);
}

function bothDraftsLocked(document = savedSharedDraft) {
  const locks = sharedPlayerLocks(document);
  return data.players.every((player) => locks[player.id]);
}

function tournamentStarted(document = savedSharedDraft) {
  return bothDraftsLocked(document) || ["tournament", "completed"].includes(document?.status);
}

function tournamentFinished() {
  const totalDays = Number(data.meta.totalDays || 15);
  return tournamentStarted() && Number(data.meta.day) >= totalDays && data.meta.active === false
    && (!state.spoilerFree || spoilerVisibleDay() >= totalDays);
}

function draftEditingDisabled(playerId = state.activePlayer) {
  return sharedDraftLoading || sharedDraftSaving || isPlayerDraftLocked(playerId) || tournamentFinished();
}

function applySharedDraft(document, revision = Number(document.revision || 0)) {
  const bashoId = document.bashoId || data.banzuke.currentBashoId;
  if (!data.banzuke.bashos.some((basho) => basho.id === bashoId)) throw new Error("The shared draft belongs to an unavailable basho.");
  state.selectedBashoId = bashoId;
  const players = normalizedSharedPlayers(document.players);
  state.drafts[bashoId] = JSON.parse(JSON.stringify(players));
  const playerLocks = sharedPlayerLocks(document);
  savedSharedDraft = {
    ...document,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    bashoId,
    playerLocks,
    locked: data.players.every((player) => playerLocks[player.id]),
    status: document.status || (data.players.every((player) => playerLocks[player.id]) ? "tournament" : "draft"),
    history: Array.isArray(document.history) ? document.history : [],
    players: JSON.parse(JSON.stringify(players)),
  };
  if (Array.isArray(document.history) && (document.history.length || !state.history.length)) state.history = JSON.parse(JSON.stringify(document.history));
  sharedDraftRevision = Number(revision || document.revision || 0);
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
    const result = await window.SHARED_DRAFT_API.load(state.selectedBashoId);
    applySharedDraft(result.document, result.revision);
    await archiveCompletedTournament();
    subscribeToSharedDraft();
  } catch (error) {
    sharedDraftError = error.message || "The shared draft could not be loaded.";
  } finally {
    sharedDraftLoading = false;
    render();
  }
}

function applyRealtimeSharedDraft(result) {
  if (!result?.document || Number(result.revision || 0) <= sharedDraftRevision) return;
  const playerId = state.activePlayer;
  const preserveWorkingCopy = hasUnsavedPlayerChanges(playerId);
  const workingPlayer = preserveWorkingCopy ? JSON.parse(JSON.stringify(getDraftPlayer(playerId))) : null;
  applySharedDraft(result.document, result.revision);
  if (workingPlayer && !isPlayerDraftLocked(playerId)) {
    const conflicts = ownershipConflicts(playerId, workingPlayer, savedSharedDraft.players);
    const blocked = new Set(conflicts.map((conflict) => conflict.id));
    workingPlayer.mainPicks = workingPlayer.mainPicks.filter((id) => !blocked.has(id));
    workingPlayer.substitutes = workingPlayer.substitutes.filter((id) => !blocked.has(id));
    state.drafts[state.selectedBashoId][playerId] = workingPlayer;
    if (conflicts.length) showToast("A wrestler in your working copy was just drafted by the other player.");
  }
  render();
}

function subscribeToSharedDraft() {
  if (!window.SHARED_DRAFT_API?.subscribe || !window.SHARED_DRAFT_API.configured?.()) return;
  stopSharedDraftSubscription?.();
  stopSharedDraftSubscription = window.SHARED_DRAFT_API.subscribe(state.selectedBashoId, applyRealtimeSharedDraft, (status) => {
    if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
      sharedDraftError = "Supabase Realtime is unavailable. Confirm shared_drafts is in the supabase_realtime publication.";
      render();
    }
  });
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

function validatePlayerDraft(playerId = state.activePlayer) {
  const player = getPlayerDefinition(playerId);
  const check = validateRoster(playerId);
  const roster = getRoster(playerId);
  const ids = [...roster.team, ...roster.subs];
  const errors = [];
  if (check.team !== 6) errors.push(`${player.name} needs exactly 6 main picks.`);
  if (check.subs !== 3) errors.push(`${player.name} needs exactly 3 substitutes.`);
  if (check.sanyaku > 2) errors.push(`${player.name} has more than 2 Sanyaku main picks.`);
  if (check.underdogs !== 1) errors.push(`${player.name} needs exactly 1 M13-M17 underdog.`);
  if (check.substituteSanyaku !== 1) errors.push(`${player.name} needs exactly 1 Sanyaku substitute.`);
  if (check.substituteMaegashira !== 2) errors.push(`${player.name} needs exactly 2 Maegashira substitutes.`);
  if (!["East", "West"].includes(getSidePrediction(playerId))) errors.push(`${player.name} must choose an East or West side prediction.`);
  [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
    .forEach((id) => errors.push(`${getRikishi(id)?.name || id} appears more than once in ${player.name}'s roster.`));
  return { valid: errors.length === 0, errors };
}

function ownershipConflicts(playerId, candidatePlayer, latestPlayers) {
  const otherOwners = new Map();
  data.players.filter((player) => player.id !== playerId).forEach((player) => {
    const draft = latestPlayers[player.id] || {};
    [...(draft.mainPicks || []), ...(draft.substitutes || [])].forEach((id) => otherOwners.set(id, player.id));
  });
  return [...(candidatePlayer.mainPicks || []), ...(candidatePlayer.substitutes || [])]
    .filter((id) => otherOwners.has(id))
    .map((id) => ({ id, ownerId: otherOwners.get(id) }));
}

function adoptLatestWhilePreservingPlayer(result, playerId, blockedIds = []) {
  const bashoId = result.document.bashoId || data.banzuke.currentBashoId;
  if (bashoId !== state.selectedBashoId) throw new Error("The shared draft changed to a different basho. Refresh before saving.");
  const workingPlayer = JSON.parse(JSON.stringify(getDraftPlayer(playerId)));
  const blocked = new Set(blockedIds);
  workingPlayer.mainPicks = workingPlayer.mainPicks.filter((id) => !blocked.has(id));
  workingPlayer.substitutes = workingPlayer.substitutes.filter((id) => !blocked.has(id));
  const latestPlayers = normalizedSharedPlayers(result.document.players);
  state.drafts[bashoId] = JSON.parse(JSON.stringify(latestPlayers));
  state.drafts[bashoId][playerId] = workingPlayer;
  savedSharedDraft = { ...result.document, bashoId, players: JSON.parse(JSON.stringify(latestPlayers)) };
  sharedDraftRevision = result.revision;
  return latestPlayers;
}

async function saveSharedDraft() {
  if (sharedDraftSaving || isPlayerDraftLocked()) return;
  const player = getPlayerDefinition();
  const playerId = player.id;
  const validation = validatePlayerDraft(playerId);
  sharedValidationErrors = validation.errors;
  if (!validation.valid) {
    render();
    showToast(`${player.name}'s roster is not valid yet. ${data.players.find((item) => item.id !== playerId).name}'s roster was not checked.`);
    return;
  }
  sharedDraftSaving = true;
  sharedDraftError = null;
  render();
  try {
    getDraftPlayer(playerId).substitutionEvents = substitutionTimeline(playerId).events;
    const candidatePlayer = sharedPayloadPlayers()[playerId];
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      const latest = await window.SHARED_DRAFT_API.load(state.selectedBashoId);
      if ((latest.document.bashoId || data.banzuke.currentBashoId) !== state.selectedBashoId) throw new Error("The shared draft changed to a different basho. Refresh before saving.");
      if (isPlayerDraftLocked(playerId, latest.document)) throw new Error(`${player.name}'s draft was locked on another device and can no longer be edited.`);
      const latestPlayers = normalizedSharedPlayers(latest.document.players);
      const conflicts = ownershipConflicts(playerId, candidatePlayer, latestPlayers);
      if (conflicts.length) {
        adoptLatestWhilePreservingPlayer(latest, playerId, conflicts.map((conflict) => conflict.id));
        const names = conflicts.map((conflict) => getRikishi(conflict.id)?.name || conflict.id).join(", ");
        const owners = [...new Set(conflicts.map((conflict) => getPlayerDefinition(conflict.ownerId).name))].join(" and ");
        const message = `${names} ${conflicts.length === 1 ? "has" : "have"} just been drafted by ${owners}. Please choose another.`;
        sharedValidationErrors = [message];
        throw new Error(message);
      }
      const mergedPlayers = sharedPayloadPlayers(latestPlayers);
      mergedPlayers[playerId] = candidatePlayer;
      const document = {
        ...latest.document,
        schemaVersion: DRAFT_SCHEMA_VERSION,
        bashoId: state.selectedBashoId,
        revision: Number(latest.document.revision || 0) + 1,
        lastSavedAt: new Date().toISOString(),
        savedBy: player.name,
        players: mergedPlayers,
      };
      try {
        const result = await window.SHARED_DRAFT_API.save(document, latest.revision);
        applySharedDraft(result.document, result.revision);
        saved = true;
        playBell();
        showToast(`${player.name}'s picks saved. ${data.players.find((item) => item.id !== playerId).name}'s draft was preserved.`);
      } catch (error) {
        if (![409, 422].includes(error.status) || attempt === 2) throw error;
      }
    }
  } catch (error) {
    sharedDraftError = error.message || "The shared draft could not be saved.";
    showToast(sharedDraftError);
  } finally {
    sharedDraftSaving = false;
    render();
  }
}

async function lockMyDraft() {
  if (sharedDraftLoading || sharedDraftSaving || !savedSharedDraft) return;
  const player = getPlayerDefinition();
  if (isPlayerDraftLocked(player.id)) return;
  if (hasUnsavedPlayerChanges(player.id)) {
    showToast("Save your picks before locking your draft.");
    return;
  }
  const validation = validatePlayerDraft(player.id);
  sharedValidationErrors = validation.errors;
  if (!validation.valid) {
    render();
    showToast(`Complete ${player.name}'s roster and prediction before locking.`);
    return;
  }
  sharedDraftSaving = true;
  render();
  try {
    const latest = await window.SHARED_DRAFT_API.load(state.selectedBashoId);
    if (isPlayerDraftLocked(player.id, latest.document)) {
      applySharedDraft(latest.document, latest.revision);
      showToast(`${player.name}'s draft is already locked.`);
      return;
    }
    const latestPlayers = normalizedSharedPlayers(latest.document.players);
    if (JSON.stringify(sharedPlayerComparable(latestPlayers, player.id)) !== JSON.stringify(sharedPlayerComparable(savedSharedDraft.players, player.id))) {
      applySharedDraft(latest.document, latest.revision);
      throw new Error(`${player.name}'s saved draft changed on another device. Review it before locking.`);
    }
    const conflicts = ownershipConflicts(player.id, latestPlayers[player.id], latestPlayers);
    if (conflicts.length) throw new Error("A saved wrestler now belongs to the other player. Refresh and choose another.");
    const playerLocks = { ...sharedPlayerLocks(latest.document), [player.id]: true };
    const allLocked = data.players.every((item) => playerLocks[item.id]);
    const document = {
      ...latest.document,
      schemaVersion: DRAFT_SCHEMA_VERSION,
      bashoId: state.selectedBashoId,
      revision: Number(latest.document.revision || 0) + 1,
      playerLocks,
      locked: allLocked,
      status: allLocked ? "tournament" : "draft",
      startedAt: allLocked ? (latest.document.startedAt || new Date().toISOString()) : null,
      lastSavedAt: new Date().toISOString(),
      savedBy: player.name,
      players: sharedPayloadPlayers(latestPlayers),
    };
    const result = await window.SHARED_DRAFT_API.save(document, latest.revision);
    applySharedDraft(result.document, result.revision);
    playBell();
    showToast(allLocked ? "Both drafts are locked. The tournament has started!" : `${player.name}'s draft is permanently locked.`);
  } catch (error) {
    sharedDraftError = error.message || "The draft lock could not be changed.";
    showToast(sharedDraftError);
  } finally {
    sharedDraftSaving = false;
    render();
  }
}

function reconcilePendingOfficialBasho() {
  if (!hasNewOfficialBasho()) {
    state.pendingOfficialBasho = null;
    return;
  }
  const current = { id: data.meta.bashoId, basho: data.meta.tournament };
  const pending = state.pendingOfficialBasho;
  if (pending?.id && pending.id !== current.id && !state.history.some((event) => event.id === pending.id)) {
    state.history.unshift({ ...blankHistoryEvent(), id: pending.id, basho: pending.basho, status: "skipped", winner: null, gwazyScore: 0, jakeScore: 0, badge: "SKIPPED", skippedAt: new Date().toISOString() });
  }
  state.pendingOfficialBasho = current;
}

initializeSpoilerState();
reconcilePendingOfficialBasho();
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
  return spoilerVisibleDay();
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

function pointsThroughDay(rikishi, day = spoilerVisibleDay()) {
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

function rikishiDisplayStats(rikishi, day = spoilerVisibleDay()) {
  const results = (rikishi?.dailyResults || []).filter((result) => result.day <= day && result.completed);
  const wins = results.filter((result) => result.result === "win").length;
  const losses = results.filter((result) => result.result === "loss").length;
  const absences = results.filter((result) => result.kyujo || result.status === "absent").length;
  const decided = wins + losses;
  const form = decided ? Math.round((wins / decided) * 100) : 0;
  return {
    wins,
    losses,
    absences,
    form,
    record: absences ? `${wins}–${losses}–${absences}` : `${wins}–${losses}`,
    points: pointsThroughDay(rikishi, day),
  };
}

function sideWinner(day = spoilerVisibleDay()) {
  if (day < data.meta.totalDays) return null;
  const totals = data.meta.sideTotals || { East: 0, West: 0 };
  return totals.East === totals.West ? null : totals.East > totals.West ? "East" : "West";
}

function playerScore(id, day = spoilerVisibleDay()) {
  if (!tournamentStarted()) return 0;
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

function playerDayScore(id, day = spoilerVisibleDay()) {
  if (day < 1) return 0;
  return playerScore(id, day) - playerScore(id, day - 1);
}

function countedPointsForRikishi(playerId, rikishiId, day = spoilerVisibleDay()) {
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
  if (!hasNewOfficialBasho() || tournamentFinished()) return "";
  return `<aside class="new-basho-notice" role="status"><span>新</span><div><small>OFFICIAL BASHO DETECTED</small><b>${escapeHtml(data.meta.tournament)} is available.</b><p>Choose whether to create a shared draft or record this tournament as skipped.</p></div><div><button class="primary-button" type="button" data-start-new-draft>Start New Draft</button><button class="secondary-button" type="button" data-skip-basho>Skip Tournament</button></div></aside>`;
}

function spoilerNotice() {
  const day = activeHiddenDay();
  if (!day) return "";
  const visible = spoilerVisibleDay();
  return `<aside class="spoiler-notice" role="status"><span>◉</span><div><small>DAY ${day} RESULTS AVAILABLE</small><b>Spoiler-Free Mode is active.</b><p>Scores, records, standings, substitutions, and results remain frozen ${visible ? `through watched Day ${visible}` : "at the pre-basho state"}.</p></div><button class="secondary-button" type="button" data-reveal-day="${day}" onclick="event.stopPropagation();revealSpoilerDay(${day})">Reveal Day ${day}</button></aside>`;
}

function spoilerFirstTimeGate() {
  const day = activeHiddenDay();
  if (!day || promptedDaySet().has(day)) return "";
  return `<section class="spoiler-gate" role="dialog" aria-modal="true" aria-labelledby="spoiler-gate-title">
    <div class="spoiler-gate-card"><span class="spoiler-eye">◉</span><p class="eyebrow">NEW OFFICIAL RESULTS</p><h2 id="spoiler-gate-title">Day ${day} results are available.</h2><p>Would you like to keep the site spoiler free?</p><div><button class="secondary-button" type="button" data-keep-hidden="${day}" onclick="event.stopPropagation();keepSpoilerDayHidden(${day})">Keep Hidden</button><button class="primary-button" type="button" data-reveal-day="${day}" onclick="event.stopPropagation();revealSpoilerDay(${day})">Reveal Results</button></div></div>
  </section>`;
}

function spoilerHiddenPanel(day, context = "results") {
  return `<section class="spoiler-hidden-panel reveal" data-spoiler-hidden-day="${day}"><span>◉</span><div><p class="eyebrow">DAY ${day} · RESULTS HIDDEN</p><h2>Watch today's basho before revealing.</h2><p>${context === "overview" ? "Current scores, leader, forecast, momentum, and today's standings are protected." : "Bout winners, kimarite, point changes, and today's draft record are protected."}</p></div><button class="primary-button" type="button" data-reveal-day="${day}" onclick="event.stopPropagation();revealSpoilerDay(${day})">Reveal Day ${day}</button></section>`;
}

function resetCurrentDraft() {
  if (isPlayerDraftLocked()) return;
  state.drafts[state.selectedBashoId][state.activePlayer] = { mainPicks: [], substitutes: [], sidePrediction: null, substitutionEvents: [] };
  sharedValidationErrors = [];
}

function completedHistoryEntry(document = savedSharedDraft) {
  const gwazyScore = playerScore("gwazy", data.meta.totalDays);
  const jakeScore = playerScore("jake", data.meta.totalDays);
  const winner = gwazyScore === jakeScore ? "Draw" : gwazyScore > jakeScore ? "Gwazy" : "Jake";
  const rosterIds = data.players.flatMap((player) => [...getRoster(player.id).team, ...getRoster(player.id).subs]);
  const mvp = rosterIds.map((id) => ({ id, points: getRikishi(id)?.points || 0 })).sort((a, b) => b.points - a.points)[0]?.id || "";
  return {
    ...blankHistoryEvent(), id: document?.bashoId || state.selectedBashoId, basho: selectedBasho().label,
    status: "completed", winner, gwazyScore, jakeScore, margin: Math.abs(gwazyScore - jakeScore), mvp,
    rosters: Object.fromEntries(data.players.map((player) => [player.id, [...getRoster(player.id).team, ...getRoster(player.id).subs]])),
    predictions: Object.fromEntries(data.players.map((player) => [player.id, getSidePrediction(player.id)])),
    completedAt: new Date().toISOString(), badge: "COMPLETED",
  };
}

function historyWithCurrentCompletion() {
  const history = [...(savedSharedDraft?.history || state.history || [])];
  const entry = completedHistoryEntry();
  const index = history.findIndex((item) => item.id === entry.id);
  if (index >= 0) history[index] = entry;
  else history.unshift(entry);
  return history;
}

async function archiveCompletedTournament() {
  if (!tournamentFinished() || !savedSharedDraft || savedSharedDraft.status === "completed") return;
  const document = {
    ...savedSharedDraft,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    revision: Number(savedSharedDraft.revision || 0) + 1,
    status: "completed",
    completedAt: new Date().toISOString(),
    history: historyWithCurrentCompletion(),
  };
  try {
    const result = await window.SHARED_DRAFT_API.save(document, sharedDraftRevision);
    applySharedDraft(result.document, result.revision);
  } catch (error) {
    if (error.status !== 409) throw error;
    const latest = await window.SHARED_DRAFT_API.load(state.selectedBashoId);
    applySharedDraft(latest.document, latest.revision);
  }
}

async function startNewOfficialBashoDraft({ skipped = false } = {}) {
  if (sharedDraftSaving) return;
  const newBashoId = data.banzuke.currentBashoId;
  const history = tournamentFinished() ? historyWithCurrentCompletion() : [...(savedSharedDraft?.history || state.history || [])];
  if (skipped && !history.some((event) => event.id === newBashoId)) {
    history.unshift({ ...blankHistoryEvent(), id: newBashoId, basho: data.meta.tournament, status: "skipped", winner: null, gwazyScore: 0, jakeScore: 0, badge: "SKIPPED", skippedAt: new Date().toISOString() });
  }
  sharedDraftSaving = true;
  render();
  try {
    const latest = await window.SHARED_DRAFT_API.load(newBashoId);
    const document = {
      ...latest.document, schemaVersion: DRAFT_SCHEMA_VERSION, bashoId: newBashoId,
      revision: Number(latest.document.revision || 0) + 1, locked: false,
      playerLocks: { gwazy: false, jake: false }, status: skipped ? "skipped" : "draft",
      startedAt: null, completedAt: null, history, lastSavedAt: new Date().toISOString(),
      savedBy: getPlayerDefinition().name, players: emptyDraftPlayers(),
    };
    const result = await window.SHARED_DRAFT_API.save(document, latest.revision);
    state.selectedBashoId = newBashoId;
    state.officialBashoId = data.meta.bashoId;
    state.pendingOfficialBasho = null;
    state.officialDataSignature = data.meta.dataSignature;
    state.selectedDay = Math.max(1, data.meta.day);
    applySharedDraft(result.document, result.revision);
    subscribeToSharedDraft();
    showToast(skipped ? `${data.meta.tournament} recorded as skipped.` : `${data.meta.tournament} is ready for a new shared draft.`);
  } catch (error) {
    sharedDraftError = error.message || "The next basho could not be started.";
    showToast(sharedDraftError);
  } finally {
    sharedDraftSaving = false;
    render();
  }
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
  return `<span class="rikishi-image ${size} uses-placeholder is-resolving" style="--form:${rikishiDisplayStats(rikishi).form}%">
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
  const currentDay = Math.max(1, Math.min(Number(data.meta.totalDays || 15), Number(data.meta.day || 1)));
  const completedDays = new Set(officialCompletedDays());
  const watched = watchedDaySet();
  return Array.from({ length: data.meta.totalDays }, (_, index) => {
    const day = index + 1;
    const hidden = isDayHidden(day);
    const revealed = completedDays.has(day) && (!state.spoilerFree || watched.has(day));
    const selectable = revealed || hidden;
    const status = [revealed ? "watched done" : "", hidden ? "hidden" : "", day === currentDay ? "current" : "", day === Number(state.selectedDay) ? "selected" : "", !selectable ? "future" : ""].filter(Boolean).join(" ");
    const title = hidden ? `Day ${day} results hidden` : revealed ? `View watched Day ${day}` : `Day ${day} results are not available yet`;
    return `<button class="day-dot ${status}" type="button" data-overview-day="${day}" title="${title}" ${selectable ? "" : "disabled"}><b>${day}</b>${revealed ? "<i>✓</i>" : hidden ? "<i>◉</i>" : ""}</button>`;
  }).join("");
}

function overviewSelectedDay() {
  return Math.max(0, Math.min(spoilerVisibleDay(), Number(state.selectedDay || spoilerVisibleDay())));
}

function scoreDuel(day = overviewSelectedDay()) {
  const [gwazy, jake] = data.players;
  const gwazyScore = playerScore(gwazy.id, day);
  const jakeScore = playerScore(jake.id, day);
  const lead = gwazyScore - jakeScore;
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
        <p><b>Day ${day}</b> of ${data.meta.totalDays} · ${day === Number(data.meta.day) ? "Live standings" : "Selected snapshot"}</p>
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

function currentStandingsCard(day = overviewSelectedDay()) {
  const scores = data.players.map((player) => ({
    ...player,
    score: playerScore(player.id, day),
    today: playerDayScore(player.id, day),
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
      <div class="section-title"><div><p class="eyebrow">${day === Number(data.meta.day) ? "LIVE SCORE" : "DAY SNAPSHOT"}</p><h2>Current standings</h2></div><span class="sync-badge"><i></i> Day ${day}</span></div>
      ${rows}
      <div class="difference-row"><span>Current margin</span><strong>${marginCopy}</strong></div>
    </section>`;
}

function projectedPlayerScore(playerId, day = overviewSelectedDay()) {
  const currentDay = Math.max(0, Math.min(data.meta.totalDays, Number(day) || 0));
  const remainingDays = Math.max(0, data.meta.totalDays - currentDay);
  const timeline = substitutionTimeline(playerId, currentDay);
  const activeIds = currentDay > 0 ? timeline.activeIds : getRoster(playerId).team;
  const expectedDailyPoints = activeIds.reduce((total, id) => {
    const rikishi = getRikishi(id);
    if (!rikishi) return total;
    const completedResults = (rikishi.dailyResults || []).filter((result) => result.day <= currentDay && result.completed);
    const wins = completedResults.filter((result) => result.result === "win").length;
    const adjustedWinRate = (wins + 2) / (completedResults.length + 4);
    return total + adjustedWinRate;
  }, 0);
  const prediction = getSidePrediction(playerId);
  const sideTotals = data.meta.sideTotals || { East: 0, West: 0 };
  const leadingSide = sideTotals.East === sideTotals.West ? null : sideTotals.East > sideTotals.West ? "East" : "West";
  const expectedBonus = !prediction ? 0 : !leadingSide ? 10 : prediction === leadingSide ? 14 : 6;
  return Math.round(playerScore(playerId, currentDay) + (expectedDailyPoints * remainingDays) + expectedBonus);
}

function forecastModel(day = overviewSelectedDay()) {
  const projections = Object.fromEntries(data.players.map((player) => [player.id, projectedPlayerScore(player.id, day)]));
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
    remainingDays: Math.max(0, data.meta.totalDays - day),
  };
}

function forecastCard(day = overviewSelectedDay()) {
  const forecast = forecastModel(day);
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

function momentumChart(day = overviewSelectedDay()) {
  const width = 640;
  const height = 170;
  const left = 42;
  const right = 624;
  const top = 16;
  const bottom = 142;
  const observedDay = Math.max(1, Math.min(data.meta.totalDays, Number(day) || 0));
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

function momentumCard(day = overviewSelectedDay()) {
  return `
    <section class="glass-card timeline-card reveal" data-overview-momentum>
      <div class="section-title"><div><p class="eyebrow">MOMENTUM</p><h2>Point progression</h2></div><div class="chart-legend"><span class="violet">Gwazy</span><span class="gold">Jake</span></div></div>
      ${momentumChart(day)}
    </section>`;
}

function boutCard(bout, compact = false, day = spoilerVisibleDay()) {
  const east = getRikishi(bout.east);
  const west = getRikishi(bout.west);
  if (!east || !west) return "";
  const eastStats = rikishiDisplayStats(east, day);
  const westStats = rikishiDisplayStats(west, day);
  const winner = getRikishi(bout.winner) || east;
  const importance = Math.max(1, Math.min(5, Number(bout.importance) || 1));
  const stars = "★".repeat(importance) + "☆".repeat(5 - importance);
  return `
    <button class="bout-card ${compact ? "compact" : ""} ${bout.completed ? "" : "scheduled"}" type="button" data-profile="${winner.id}">
      <span class="bout-importance" title="Match importance ${importance} out of 5">${stars}</span>
      <span class="bout-wrestler ${bout.winner === east.id ? "winner" : ""}">
        ${wrestlerImage(east)}
        <span><b>${east.name}</b><small>${east.rank} · ${eastStats.record}</small></span>
      </span>
      <span class="versus"><b>VS</b><small>${bout.technique || "Scheduled"}</small></span>
      <span class="bout-wrestler right ${bout.winner === west.id ? "winner" : ""}">
        <span><b>${west.name}</b><small>${west.rank} · ${westStats.record}</small></span>
        ${wrestlerImage(west)}
      </span>
      <span class="bout-swing">${bout.completed ? (bout.swing ?? "Official") : "Pending"}</span>
    </button>`;
}

function rosterCard(rikishi, playerId, substitute = false, role = "active") {
  const stats = rikishiDisplayStats(rikishi);
  const hasResult = stats.wins + stats.losses + stats.absences > 0;
  const heat = !hasResult ? "unplayed" : stats.form >= 75 ? "hot" : stats.form < 40 ? "cold" : "steady";
  const isKyujo = role === "kyujo";
  const isActiveSubstitute = role === "active-substitute";
  const isStandbySubstitute = role === "standby-substitute";
  const points = countedPointsForRikishi(playerId, rikishi.id);
  const readOnly = draftEditingDisabled(playerId);
  const statusBadge = isKyujo
    ? '<span class="roster-status-badge kyujo">⚠ KYUJO · INACTIVE</span>'
    : isActiveSubstitute
      ? '<span class="roster-status-badge active-substitute">✓ ACTIVE SUBSTITUTE</span>'
      : isStandbySubstitute
        ? '<span class="roster-status-badge standby">○ STANDBY · 0 PTS</span>'
        : '<span class="roster-status-badge active-main">● ACTIVE MAIN</span>';
  return `
    <article class="roster-card ${heat} ${isKyujo ? "is-kyujo" : ""} ${isActiveSubstitute ? "is-active-substitute" : ""} ${isStandbySubstitute ? "is-standby-substitute" : ""}" data-profile="${rikishi.id}">
      ${wrestlerImage(rikishi, "medium")}
      <div class="roster-card-main">
        <div class="roster-card-title">
          <div><h3>${rikishi.name}</h3><p>${rikishi.rank} · ${rikishi.stable}</p></div>
          ${sideBadge(rikishi)}
        </div>
        ${statusBadge}
        <div class="record-line"><strong>${stats.record}</strong><span><b>${stats.wins}</b> wins · <b>${stats.losses}</b> losses</span></div>
        <div class="heat-track"><span style="--width:${stats.form}%"></span></div>
      </div>
      <div class="roster-points"><strong>${isStandbySubstitute ? 0 : points}</strong><small>${isKyujo ? "BANKED PTS" : isStandbySubstitute ? "INACTIVE" : "COUNTED PTS"}</small></div>
      ${!activeHiddenDay() && rikishi.badge ? `<span class="clutch-badge">✦ ${rikishi.badge}</span>` : ""}
      ${readOnly ? '<div class="roster-card-readonly">🔒 LOCKED</div>' : `<div class="roster-card-actions">
        ${substitute ? `<button class="move-section" type="button" data-roster-move="${rikishi.id}:main">&larr; Main</button>` : ""}
        ${substitute ? `<button class="order-button" type="button" data-sub-reorder="${rikishi.id}:up" aria-label="Move ${rikishi.name} earlier" title="Move earlier">&uarr;</button><button class="order-button" type="button" data-sub-reorder="${rikishi.id}:down" aria-label="Move ${rikishi.name} later" title="Move later">&darr;</button>` : ""}
        <button class="remove" type="button" data-remove-pick="${rikishi.id}">&#128465; Remove</button>
        ${!substitute ? `<button class="move-section" type="button" data-roster-move="${rikishi.id}:subs">&rarr; Substitute</button>` : ""}
      </div>`}
    </article>`;
}

function compactPickCard(rikishi) {
  return `
    <button class="pick-chip" type="button" data-profile="${rikishi.id}">
      ${wrestlerImage(rikishi)}
      <span><b>${rikishi.name}</b><small>${rikishi.rank}</small></span>
      <strong>${rikishiDisplayStats(rikishi).points}</strong>
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
      <strong>${rikishiDisplayStats(rikishi).points}<small> PTS</small></strong>
    </button>`;
  });
  return slots.join("");
}

function overviewPickRow(player, rikishiId, status, slot, day = overviewSelectedDay()) {
  const rikishi = getRikishi(rikishiId);
  if (!rikishi) return "";
  const points = countedPointsForRikishi(player.id, rikishi.id, day);
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

function overviewRosterDashboard(player, day = overviewSelectedDay()) {
  const roster = getRoster(player.id);
  const timeline = substitutionTimeline(player.id, day);
  const prediction = getSidePrediction(player.id);
  const score = playerScore(player.id, day);
  const scoreLabel = activeHiddenDay() ? (day ? `THROUGH WATCHED DAY ${day}` : "PRE-BASHO SCORE") : "CURRENT SCORE";
  const mainRows = Array.from({ length: 6 }, (_, index) => {
    const mainId = roster.team[index];
    if (!mainId) return overviewEmptySlot(player, "main", index + 1);
    return overviewPickRow(player, mainId, timeline.inactiveMainIds.includes(mainId) ? "kyujo" : "active-main", index + 1, day);
  }).join("");
  const activeReplacementRows = timeline.assignments.map((assignment, index) => overviewPickRow(player, assignment.subId, "active-substitute", index + 1, day)).join("");
  const standbyRows = timeline.standbySubIds.map((id, index) => overviewPickRow(player, id, timeline.unavailableSubIds.includes(id) ? "kyujo" : "standby", index + 1, day)).join("");
  return `
    <article class="team-preview overview-roster-column ${player.color}" data-overview-roster="${player.id}">
      <div class="team-preview-head">
        <span class="player-avatar ${player.color}">${player.initials}</span>
        <div><small>${player.name.toUpperCase()}'S DRAFT</small><h3>${roster.team.length + roster.subs.length} / 9 slots filled</h3></div>
        <strong>${score}</strong>
      </div>
      <div class="dashboard-team-meta"><span><small>${scoreLabel}</small><b>${score} pts</b></span><span><small>SIDE PREDICTION</small><b>${prediction || "None"}</b></span></div>
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

function draftWaitingOverview() {
  const locks = sharedPlayerLocks();
  return `<section class="overview-draft-mode reveal">
    <div><p class="eyebrow">DRAFT MODE</p><h2>Tournament scoring is waiting for both players.</h2><p>Each player saves and permanently locks their own roster. The dashboard, forecast, momentum, and daily scoring activate together.</p></div>
    <div class="overview-lock-grid">${data.players.map((player) => `<span class="${player.color} ${locks[player.id] ? "locked" : "open"}"><b>${locks[player.id] ? "🔒" : "○"} ${player.name}</b><small>${locks[player.id] ? "Draft locked" : "Building roster"}</small></span>`).join("")}</div>
    <a class="primary-button" href="#roster">Review my draft</a>
  </section>`;
}

function championOverviewView() {
  const result = completedHistoryEntry();
  const winner = result.winner === "Draw" ? null : data.players.find((player) => player.name === result.winner);
  const mvp = getRikishi(result.mvp);
  const seenKey = `sumoBattleChampionSeen:${result.id}`;
  let celebrate = false;
  try {
    celebrate = !localStorage.getItem(seenKey);
    if (celebrate) localStorage.setItem(seenKey, "1");
  } catch { celebrate = false; }
  const confetti = celebrate && !state.reducedMotion ? `<div class="champion-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</div>` : "";
  const nextCard = hasNewOfficialBasho() ? `<section class="next-basho-card reveal"><div><p class="eyebrow">THE NEXT BASHO IS AVAILABLE</p><h2>${escapeHtml(data.meta.tournament)}</h2><p>Archive this result, then choose whether to play the next official tournament.</p></div><div><button class="primary-button" type="button" data-start-new-draft>Start ${escapeHtml(data.meta.month || "Next")} Draft</button><button class="secondary-button" type="button" data-skip-basho>Skip ${escapeHtml(data.meta.month || "Tournament")}</button></div></section>` : `<section class="next-basho-card waiting reveal"><div><p class="eyebrow">OFF-SEASON</p><h2>The champion remains on top.</h2><p>The next-draft controls will appear when a new official banzuke is published.</p></div></section>`;
  return `<section class="page-shell champion-page">
    <section class="champion-hero ${winner?.color || "draw"} reveal">${confetti}<span class="champion-trophy">🏆</span><p class="eyebrow">${winner ? "BASHO CHAMPION" : "BASHO COMPLETE"}</p><h1>${winner?.name.toUpperCase() || "DRAW"}</h1><p>${escapeHtml(selectedBasho().label)}</p><div class="champion-score"><span><small>GWAZY</small><b>${result.gwazyScore}</b></span><i>–</i><span><small>JAKE</small><b>${result.jakeScore}</b></span></div><div class="champion-facts"><span><small>WINNING MARGIN</small><b>${result.margin} pts</b></span><span><small>MVP WRESTLER</small><b>${escapeHtml(mvp?.name || "—")}</b></span></div></section>
    ${nextCard}
    ${appFooter()}
  </section>`;
}

function overviewView() {
  if (tournamentFinished()) return championOverviewView();
  const basho = selectedBasho();
  const pool = draftPoolStats(basho);
  const draftStarted = pool.drafted > 0;
  const selectedDay = overviewSelectedDay();
  const heroProgress = tournamentStarted()
    ? `<div class="basho-day tournament-progress"><small>TOURNAMENT PROGRESS</small><strong>DAY ${data.meta.day}<span> / ${data.meta.totalDays}</span></strong><div class="day-progress" role="tablist" aria-label="Tournament day">${progressDots()}</div></div>`
    : `<div class="basho-day draft-progress"><small>DRAFT PROGRESS</small><strong>${pool.drafted}<span> / 18 SLOTS FILLED</span></strong><div class="pre-basho-progress"><span style="--width:${(pool.drafted / 18) * 100}%"></span></div></div>`;
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
          ${heroProgress}
        </div>
      </div>

      ${tournamentStarted() ? activeHiddenDay() ? spoilerHiddenPanel(activeHiddenDay(), "overview") : `${scoreDuel(selectedDay)}
        <div class="overview-grid overview-analytics" data-overview-analytics>
          ${currentStandingsCard(selectedDay)}
          ${forecastCard(selectedDay)}
          ${momentumCard(selectedDay)}
        </div>` : draftWaitingOverview()}

      <section class="content-section picks-preview reveal">
        <div class="section-title spacious"><div><p class="eyebrow">SHARED DRAFT · ${escapeHtml(basho.label.toUpperCase())}</p><h2>Complete rosters</h2><p>Both players' main picks, substitutes, scores, predictions, and completion progress update here automatically.</p></div><a class="text-link" href="#banzuke">Open draft <span>${icons.arrow}</span></a></div>
        ${!draftStarted ? `<div class="overview-roster-empty" data-overview-empty><b>The draft has not started yet.</b><span>Select wrestlers from the Banzuke to build each player's team. All ${pool.total} Makuuchi rikishi are available.</span></div>` : ""}
        <div class="pick-preview-grid overview-rosters">${data.players.map((player) => overviewRosterDashboard(player, selectedDay)).join("")}</div>
      </section>

      <section class="bonus-panel scoring-only reveal">
        <div class="scoring-mini">
          <div class="section-title"><div><p class="eyebrow">QUICK REFERENCE</p><h2>Scoring system</h2></div><span class="spark-icon">♛</span></div>
          <div class="scoring-rows">${data.scoring.map((rule) => `<span><small>${rule.label}</small><b>${rule.value}</b></span>`).join("")}</div>
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

function validationChecklist(check, playerId = state.activePlayer) {
  const item = (valid, label) => `<span class="${valid ? "ok" : "bad"}"><b>${valid ? "✓" : "×"}</b>${label}</span>`;
  return `
    <div class="validation-checklist">
      ${item(check.team === 6, `${check.team} / 6 Main Picks`)}
      ${item(check.subs === 3, `${check.subs} / 3 Substitutes`)}
      ${item(check.sanyaku <= 2, `${check.sanyaku} / 2 Komusubi+`)}
      ${item(check.underdogs === 1, check.underdogs ? `${check.underdogs} Underdog` : "Missing Underdog")}
      ${item(check.substituteSanyaku === 1, `${check.substituteSanyaku} / 1 Sanyaku Sub`)}
      ${item(check.substituteMaegashira === 2, `${check.substituteMaegashira} / 2 Maegashira Subs`)}
      ${item(["East", "West"].includes(getSidePrediction(playerId)), getSidePrediction(playerId) ? `${getSidePrediction(playerId)} Prediction` : "Missing Side Prediction")}
    </div>`;
}

function emptyRosterSlots(count, type) {
  return Array.from({ length: count }, (_, index) => `<div class="empty-roster-slot"><span>+</span><b>${type} slot ${index + 1}</b><small>Add from the Banzuke</small></div>`).join("");
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

function sidePredictionBuilder(player, locked) {
  const prediction = getSidePrediction(player.id);
  return `<section class="roster-side-prediction ${player.color}">
    <div><p class="eyebrow">${player.name.toUpperCase()}'S SIDE PREDICTION · 20 POINT BONUS</p><h3>Which side will win more bouts?</h3><p>This prediction belongs only to ${player.name} and becomes permanent when their draft is locked.</p></div>
    <div class="side-choice" role="group" aria-label="${player.name}'s side prediction">
      <button type="button" class="east ${prediction === "East" ? "active" : ""}" data-bonus="East" ${locked ? "disabled" : ""}><span>東</span><b>EAST</b><small>${prediction === "East" ? "PICKED" : "SELECT"}</small></button>
      <span class="bonus-vs">VS<small>20 PTS</small></span>
      <button type="button" class="west ${prediction === "West" ? "active" : ""}" data-bonus="West" ${locked ? "disabled" : ""}><span>西</span><b>WEST</b><small>${prediction === "West" ? "PICKED" : "SELECT"}</small></button>
    </div>
  </section>`;
}

function playerLockMessage(player) {
  const locks = sharedPlayerLocks();
  const opponent = data.players.find((item) => item.id !== player.id);
  if (bothDraftsLocked()) return `<div class="draft-lock-message started"><b>✅ Both drafts locked</b><span>${escapeHtml(selectedBasho().label)} has officially started. Tournament scoring and daily results are now active.</span></div>`;
  if (locks[player.id]) return `<div class="draft-lock-message waiting"><b>🔒 Your draft is locked.</b><span>Waiting for ${opponent.name} to lock their draft before the tournament begins…</span></div>`;
  if (locks[opponent.id]) return `<div class="draft-lock-message opponent"><b>${opponent.name}'s draft is locked.</b><span>You can continue editing ${player.name}'s roster until you lock it.</span></div>`;
  return "";
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
  const unsaved = hasUnsavedPlayerChanges(player.id);
  const locked = isPlayerDraftLocked(player.id);
  const allLocked = bothDraftsLocked();
  const validationErrors = sharedValidationErrors.length ? `<div class="shared-validation-errors" role="alert"><b>Draft cannot be saved</b><ul>${sharedValidationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></div>` : "";
  return `
    <section class="page-shell">
      ${pageIntro("TEAM WORKSPACE", `${player.name}'s roster`, "Move or remove wrestlers directly from their cards. Add new picks from the Banzuke.", `<a class="primary-button" href="#banzuke">Add from Banzuke</a>`)}
      ${editingBanner(`This roster belongs only to ${player.name}. Use the header selector to edit the other player.`)}
      <div class="rules-strip reveal">
        <span><b>6</b> starters</span><i></i><span><b>1</b> Sanyaku substitute</span><i></i><span><b>2</b> Maegashira substitutes</span><i></i><span><b>SUBS SCORE</b> only while activated</span>
      </div>
      <section class="shared-draft-bar reveal ${unsaved ? "dirty" : ""}">
        <div><small>${player.name.toUpperCase()} DRAFT STATUS</small><b>${sharedDraftLoading ? "Loading shared draft..." : sharedDraftError && !savedSharedDraft ? "Connection required" : locked ? "🔒 Permanently locked" : unsaved ? "&#9679; Unsaved Changes" : "&#10003; Ready to edit"}</b></div>
        <div><small>LAST SAVED</small><b>${saveTime.day}</b><span>${saveTime.time}</span></div>
        <div><small>SAVED BY</small><b>${escapeHtml(savedSharedDraft?.savedBy || "No one yet")}</b><span>Revision ${Number(savedSharedDraft?.revision || 0)}</span></div>
        <div class="shared-draft-actions"><button class="secondary-button" type="button" data-refresh-shared>Refresh</button></div>
      </section>
      ${playerLockMessage(player)}
      ${sharedDraftError ? `<div class="shared-draft-error" role="alert">${escapeHtml(sharedDraftError)}</div>` : ""}
      <section class="active-roster-workspace ${player.color} reveal">
        <div class="roster-owner">
          <span class="player-avatar ${player.color}">${player.initials}</span>
          <div><p class="eyebrow">${player.name.toUpperCase()}'S PICKS</p><h2>${playerScore(player.id)} points</h2></div>
          <span class="legal-badge ${check.valid ? "valid" : "invalid"}">${check.valid ? "✓ ROSTER LEGAL" : "! ROSTER INCOMPLETE"}</span>
        </div>
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
        ${sidePredictionBuilder(player, locked || allLocked)}
        <div class="roster-save-row shared"><p><b>${locked ? `${player.name}'s draft is permanently locked` : unsaved ? `Unsaved ${player.name} working copy` : `${player.name}'s saved picks are up to date`}</b><span>${locked ? "The roster, substitutes, and prediction are read-only." : `Save validates and updates only ${player.name}. The opponent's latest roster is preserved.`}</span></p><div class="roster-save-actions"><button class="primary-button" type="button" data-save-draft ${draftEditingDisabled() || !unsaved ? "disabled" : ""}>${sharedDraftSaving ? "Saving..." : "Save Picks"}</button>${locked ? "" : `<button class="lock-draft-button" type="button" data-lock-my-draft ${unsaved || sharedDraftLoading || sharedDraftSaving ? "disabled" : ""}>🔒 Lock My Draft</button>`}</div></div>
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

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomDraftPool(playerId = state.activePlayer, includeOwn = false) {
  return data.rikishi.filter((rikishi) => {
    if (rikishi.available === false) return false;
    const ownerId = draftOwner(rikishi.id);
    return !ownerId || (includeOwn && ownerId === playerId);
  });
}

function randomDraftCandidate(playerId = state.activePlayer) {
  const pool = shuffled(randomDraftPool(playerId, true));
  const sanyakuOptions = shuffled(pool.filter(isSanyaku));
  const maegashiraOptions = shuffled(pool.filter(isMaegashira));
  for (const sanyakuSub of sanyakuOptions) {
    for (let firstIndex = 0; firstIndex < maegashiraOptions.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < maegashiraOptions.length; secondIndex += 1) {
        const maegashiraSubs = [maegashiraOptions[firstIndex], maegashiraOptions[secondIndex]];
        const substituteIds = [sanyakuSub.id, ...maegashiraSubs.map((rikishi) => rikishi.id)];
        const reserved = new Set(substituteIds);
        const remaining = shuffled(pool.filter((rikishi) => !reserved.has(rikishi.id)));
        const underdogs = shuffled(remaining.filter((rikishi) => /Maegashira (1[3-7])/.test(rikishi.rank)));
        for (const underdog of underdogs) {
          const main = [underdog.id];
          let sanyakuMainCount = 0;
          for (const rikishi of remaining) {
            if (main.length === 6) break;
            if (rikishi.id === underdog.id || /Maegashira (1[3-7])/.test(rikishi.rank)) continue;
            if (isSanyaku(rikishi) && sanyakuMainCount >= 2) continue;
            main.push(rikishi.id);
            if (isSanyaku(rikishi)) sanyakuMainCount += 1;
          }
          if (main.length !== 6 || !mainPickRules(main).valid) continue;
          return { mainPicks: shuffled(main), substitutes: shuffled(substituteIds) };
        }
      }
    }
  }
  return null;
}

function generateRandomDraft() {
  if (draftEditingDisabled()) return;
  const player = getPlayerDefinition();
  const candidate = randomDraftCandidate(player.id);
  if (!candidate) {
    showToast("There are not enough available wrestlers to generate a valid draft.");
    return;
  }
  const draft = getDraftPlayer(player.id);
  draft.mainPicks = candidate.mainPicks;
  draft.substitutes = candidate.substitutes;
  draft.substitutionEvents = [];
  render();
  showToast(`Random ${player.name} draft generated. Review it, then press Save Picks.`);
}

function addRandomPick(type) {
  if (draftEditingDisabled()) return;
  const player = getPlayerDefinition();
  const roster = getRoster(player.id);
  const isMain = type === "main";
  const list = isMain ? roster.team : roster.subs;
  const limit = isMain ? 6 : 3;
  if (list.length >= limit) {
    showToast(`${isMain ? "Main roster" : "Substitute roster"} is already full.`);
    return;
  }
  const candidates = shuffled(randomDraftPool(player.id)).filter((rikishi) => {
    const ids = [...list, rikishi.id];
    return isMain ? mainPickRules(ids).valid : substituteRules(ids).valid;
  });
  if (!candidates.length) {
    showToast(`No available wrestler can fill the next ${isMain ? "main" : "substitute"} slot legally.`);
    return;
  }
  addPick(candidates[0].id, type);
}

function clearPlayerWorkingDraft() {
  if (draftEditingDisabled()) return;
  const draft = getDraftPlayer();
  draft.mainPicks = [];
  draft.substitutes = [];
  draft.substitutionEvents = [];
  render();
  showToast(`${getPlayerDefinition().name}'s working roster cleared. Save Picks is still required.`);
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
    const stats = rikishiDisplayStats(rikishi);
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
    const candidateSubs = [...activeRoster.subs, rikishi.id];
    const canAddSub = activeRoster.subs.length < 3 && substituteRules(candidateSubs).valid;
    const fillingMain = activeRoster.team.length < 6;
    const addTarget = fillingMain ? "main" : "sub";
    const canAddToTarget = fillingMain ? canAddMain : canAddSub;
    let action;
    if (ownedByActivePlayer) {
      action = editingUnavailable
        ? `<button class="pick-action locked ${getPlayerDefinition().color}" type="button" disabled><small>${location === "main" ? "YOUR MAIN PICK" : "YOUR SUBSTITUTE"}</small>🔒 ${getPlayerDefinition().name}</button>`
        : `<button class="pick-action remove" type="button" data-remove-pick="${rikishi.id}"><small>${location === "main" ? "YOUR MAIN PICK" : "YOUR SUBSTITUTE"}</small>Remove</button>`;
    } else if (lockedByOtherPlayer) {
      action = `<button class="pick-action locked ${owner.color}" type="button" disabled><small>DRAFTED</small>🔒 ${owner.name}</button>`;
    } else {
      action = `<button class="pick-action ${addTarget === "sub" ? "substitute" : ""}" type="button" data-add-pick="${rikishi.id}:${addTarget}" ${editingUnavailable || sourceUnavailable || !canAddToTarget ? "disabled" : ""}><small>${!resolved.parsed ? "DATA INCOMPLETE" : addTarget === "main" ? "MAIN ROSTER" : isSanyaku(rikishi) ? "SANYAKU SUBSTITUTE" : "MAEGASHIRA SUBSTITUTE"}</small>${editingUnavailable ? "Draft locked" : sourceUnavailable ? "Unavailable" : addTarget === "main" ? "Add to Main" : "Add to Subs"}</button>`;
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
          <span class="banzuke-record"><strong>${escapeHtml(stats.record)}</strong><em><b>${stats.wins}</b> wins</em><em><b>${stats.losses}</b> losses</em></span>
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
  const readOnly = tournamentStarted() || isPlayerDraftLocked(player.id);
  return `
    <section class="page-shell">
      ${pageIntro(`${escapeHtml(basho.label.toUpperCase())} · ${readOnly ? "TOURNAMENT BANZUKE" : "TEAM BUILDER"}`, readOnly ? "Official banzuke and draft ownership" : "Pick from the complete banzuke", readOnly ? `All ${basho.entries.length} official Makuuchi rikishi remain available to browse. The locked draft is read-only for the rest of the tournament.` : `All ${basho.entries.length} official Makuuchi rikishi. Single-click a wrestler for their profile or double-click to edit ${player.name}'s roster.`, `<label class="search-field"><span>⌕</span><input id="banzuke-search" type="search" placeholder="Find a rikishi or stable" autocomplete="off" /></label>`)}
      ${readOnly ? `<aside class="banzuke-readonly-notice reveal"><span>🔒</span><div><small>TOURNAMENT MODE · READ ONLY</small><b>The complete official Banzuke remains visible.</b><p>Ownership, records, profiles, search, and filters are available. Draft picks cannot be changed.</p></div></aside>` : editingBanner(`Shared draft · currently editing ${player.name}. A rikishi drafted by either player is locked to the other.`)}
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
        <a class="secondary-button" href="#roster">Manage roster</a>
        ${readOnly ? `<div class="banzuke-readonly-summary"><span>GWAZY <b>${pool.counts.gwazy}</b></span><span>JAKE <b>${pool.counts.jake}</b></span><span>AVAILABLE <b>${pool.available}</b></span></div>` : `<div class="random-draft-actions">
          <button class="random-draft-primary" type="button" data-random-draft ${draftEditingDisabled() ? "disabled" : ""}>🎲 Random Draft</button>
          <button type="button" data-random-pick="main" ${draftEditingDisabled() || roster.team.length >= 6 ? "disabled" : ""}>🎲 Random Main Pick</button>
          <button type="button" data-random-pick="sub" ${draftEditingDisabled() || roster.subs.length >= 3 ? "disabled" : ""}>🎲 Random Substitute</button>
          <button class="clear-draft" type="button" data-clear-player-draft ${draftEditingDisabled() || (!roster.team.length && !roster.subs.length) ? "disabled" : ""}>Clear Draft</button>
          <a href="#roster">Review &amp; Save</a>
        </div>`}
      </section>
      <dialog class="random-draft-dialog" id="random-draft-dialog" aria-labelledby="random-draft-title">
        <form method="dialog">
          <span class="random-draft-icon">🎲</span>
          <div><p class="eyebrow">RANDOM DRAFT</p><h2 id="random-draft-title">Generate a random draft?</h2><p>This will replace ${player.name}'s current unsaved roster with six valid main picks and three valid substitutes. Nothing is published until Save Picks.</p></div>
          <div class="random-draft-dialog-actions"><button class="secondary-button" value="cancel">Cancel</button><button class="primary-button" type="button" data-confirm-random-draft>Generate</button></div>
        </form>
      </dialog>
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
      <p class="source-note"><a href="${basho.officialUrl}" target="_blank" rel="noreferrer">Official Japan Sumo Association banzuke ↗</a> · Records update from the read-only JSA snapshot. ${player.name}'s working copy publishes to the shared Supabase draft only when Save Picks is pressed.</p>
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

function signedPoints(points) {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}

function resultDraftImpact(bout, day) {
  const activeByPlayer = Object.fromEntries(data.players.map((player) => [
    player.id,
    new Set(substitutionTimeline(player.id, day).byDay.get(day)?.activeIds || []),
  ]));
  const participants = [bout.east, bout.west].map((rikishiId) => {
    const rikishi = getRikishi(rikishiId);
    const ownerId = draftOwner(rikishiId);
    const owner = ownerId ? getPlayerDefinition(ownerId) : null;
    const active = Boolean(ownerId && activeByPlayer[ownerId].has(rikishiId));
    const totalPoints = active && bout.completed
      ? pointsThroughDay(rikishi, day) - pointsThroughDay(rikishi, day - 1)
      : 0;
    const won = Boolean(bout.completed && bout.winner === rikishiId);
    const winPoints = active && won ? 1 : totalPoints < 0 ? totalPoints : 0;
    const bonusPoints = Math.max(0, totalPoints - winPoints);
    return { rikishi, ownerId, owner, active, totalPoints, winPoints, bonusPoints, won };
  });
  const ownerIds = [...new Set(participants.map((participant) => participant.ownerId).filter(Boolean))];
  const draftedCount = participants.filter((participant) => participant.ownerId).length;
  const headToHead = ownerIds.length === 2;
  const bonus = participants.some((participant) => participant.bonusPoints > 0);
  const important = headToHead || bonus || (draftedCount > 0 && Number(bout.importance || 0) >= 3);
  const ownershipLabel = headToHead
    ? "GWAZY VS JAKE"
    : ownerIds.length === 1
      ? getPlayerDefinition(ownerIds[0]).name.toUpperCase()
      : "NOT DRAFTED";
  const contextLabel = headToHead ? "Both drafted" : draftedCount ? "Draft bout" : "No fantasy impact";
  return { participants, ownerIds, draftedCount, headToHead, important, ownershipLabel, contextLabel };
}

function resultOwnershipBadge(participant) {
  if (!participant.owner) return '<span class="result-owner-badge available">AVAILABLE</span>';
  return `<span class="result-owner-badge ${participant.owner.color}">${participant.owner.name.toUpperCase()}</span>`;
}

function resultPointAward(participant, completed) {
  if (!participant.owner) return '<span class="result-point-award available"><b>—</b><small>Not drafted</small></span>';
  if (!completed) return `<span class="result-point-award ${participant.owner.color}"><b>Pending</b><small>${participant.active ? "Active pick" : "Standby"}</small></span>`;
  if (!participant.active) return `<span class="result-point-award ${participant.owner.color}"><b>0 pts</b><small>Inactive substitute</small></span>`;
  return `<span class="result-point-award ${participant.owner.color}"><b>${signedPoints(participant.winPoints)} pt${Math.abs(participant.winPoints) === 1 ? "" : "s"}</b>${participant.bonusPoints ? `<small>+${participant.bonusPoints} bonus</small>` : `<small>${participant.won ? "Win counted" : "No points"}</small>`}</span>`;
}

function draftImpactBoutCard(bout, day, index) {
  const impact = resultDraftImpact(bout, day);
  const [east, west] = impact.participants;
  const ownerData = data.players.map((player) => `data-results-${player.id}="${String(impact.ownerIds.includes(player.id))}"`).join(" ");
  const playerMarkup = (participant, side) => {
    const stats = rikishiDisplayStats(participant.rikishi, day);
    return `
    <button class="result-rikishi ${side} ${participant.won ? "winner" : "loser"}" type="button" data-profile="${participant.rikishi.id}">
      ${side === "east" ? wrestlerImage(participant.rikishi, "medium") : ""}
      <span class="result-rikishi-copy">
        <span class="result-name-line"><b>${escapeHtml(participant.rikishi.name)}</b>${bout.completed ? `<i>${participant.won ? "✓" : "✕"}</i>` : ""}</span>
        <small>${escapeHtml(participant.rikishi.rank)} · ${escapeHtml(stats.record)}</small>
        ${resultOwnershipBadge(participant)}
      </span>
      ${resultPointAward(participant, bout.completed)}
      ${side === "west" ? wrestlerImage(participant.rikishi, "medium") : ""}
    </button>`;
  };
  return `
    <article class="draft-result-card ${impact.headToHead ? "head-to-head" : impact.draftedCount ? "draft-relevant" : "not-drafted"}" data-results-card ${ownerData} data-results-important="${String(impact.important)}">
      <span class="result-number">${String(index + 1).padStart(2, "0")}</span>
      ${playerMarkup(east, "east")}
      <div class="result-impact-center">
        <span class="bout-draft-label ${impact.headToHead ? "versus" : impact.ownerIds[0] ? getPlayerDefinition(impact.ownerIds[0]).color : "available"}">${impact.ownershipLabel}</span>
        <b>${bout.completed ? "FINAL" : "SCHEDULED"}</b>
        <small>${escapeHtml(bout.technique || "Awaiting result")}</small>
        <em>${impact.contextLabel}</em>
      </div>
      ${playerMarkup(west, "west")}
    </article>`;
}

function dailyDraftSummary(playerId, day, bouts) {
  const activeIds = new Set(substitutionTimeline(playerId, day).byDay.get(day)?.activeIds || []);
  let wins = 0;
  let losses = 0;
  bouts.filter((bout) => bout.completed).forEach((bout) => {
    [bout.east, bout.west].filter((id) => activeIds.has(id)).forEach((id) => {
      if (bout.winner === id) wins += 1;
      else losses += 1;
    });
  });
  return { wins, losses, points: playerDayScore(playerId, day) };
}

function applyResultsFilter() {
  const cards = [...app.querySelectorAll("[data-results-card]")];
  let visible = 0;
  cards.forEach((card) => {
    const matches = resultsFilter === "all"
      || (resultsFilter === "my" && card.dataset[`results${state.activePlayer[0].toUpperCase()}${state.activePlayer.slice(1)}`] === "true")
      || (resultsFilter === "important" && card.dataset.resultsImportant === "true")
      || card.dataset[`results${resultsFilter[0]?.toUpperCase()}${resultsFilter.slice(1)}`] === "true";
    card.classList.toggle("filter-hidden", !matches);
    if (matches) visible += 1;
  });
  app.querySelectorAll("[data-results-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.resultsFilter === resultsFilter);
    button.setAttribute("aria-pressed", String(button.dataset.resultsFilter === resultsFilter));
  });
  const count = app.querySelector("#results-visible-count");
  if (count) count.textContent = `${visible} bout${visible === 1 ? "" : "s"}`;
  app.querySelector("#results-filter-empty")?.classList.toggle("show", cards.length > 0 && visible === 0);
}

function resultsView() {
  const currentOfficialDay = Math.max(1, Number(data.meta.day || 1));
  const day = Math.min(Number(state.selectedDay), currentOfficialDay);
  if (!tournamentStarted()) {
    const locks = sharedPlayerLocks();
    const lockedNames = data.players.filter((player) => locks[player.id]).map((player) => player.name);
    return `<section class="page-shell">
      ${pageIntro(`${escapeHtml(selectedBasho().label.toUpperCase())} · DRAFT MODE`, "Daily results unlock with the tournament", "Both players must permanently lock their drafts before official bouts and draft scoring appear here.")}
      <section class="results-locked-state reveal"><span>🔒</span><div><p class="eyebrow">WAITING FOR BOTH PLAYERS</p><h2>${lockedNames.length ? `${lockedNames.join(" and ")} locked` : "No drafts locked yet"}</h2><p>Complete and lock each roster from the Roster page. The Day 1–15 timeline will activate automatically when both are ready.</p></div><a class="primary-button" href="#roster">Open Roster</a></section>
      ${appFooter()}
    </section>`;
  }
  if (isDayHidden(day)) {
    return `<section class="page-shell">
      ${pageIntro(`${escapeHtml(selectedBasho().label.toUpperCase())} · DAY ${day}`, "Results hidden", "Spoiler-Free Mode is protecting this day's official outcomes and draft scoring.")}
      ${bashoDayTimeline(day)}
      ${spoilerHiddenPanel(day, "results")}
      ${appFooter()}
    </section>`;
  }
  const bouts = resultsForDay(day);
  const [gwazy, jake] = data.players;
  const gwazyToday = dailyDraftSummary(gwazy.id, day, bouts);
  const jakeToday = dailyDraftSummary(jake.id, day, bouts);
  const completed = bouts.filter((bout) => bout.completed).length;
  const playerSummary = (player, summary) => `<article class="daily-draft-player ${player.color}"><span class="player-avatar ${player.color}">${player.initials}</span><div><small>${player.name.toUpperCase()} · TODAY'S RECORD</small><strong>${summary.wins}–${summary.losses}</strong></div><b>${signedPoints(summary.points)} pts</b></article>`;
  return `
    <section class="page-shell">
      ${pageIntro(`${escapeHtml(selectedBasho().label.toUpperCase())} · DAY ${day}`, "Draft impact", "See ownership, scoring changes, and the bouts that moved the Gwazy vs Jake battle.")}
      <section class="daily-draft-scoreboard reveal" data-results-daily-stats>${playerSummary(gwazy, gwazyToday)}<span class="daily-draft-vs">VS</span>${playerSummary(jake, jakeToday)}</section>
      ${bashoDayTimeline(day)}
      <div class="results-filter-bar reveal" role="group" aria-label="Draft result filters">
        ${[["all", "All"], ["gwazy", "Gwazy"], ["jake", "Jake"], ["my", "My Draft"], ["important", "Important Bouts"]].map(([value, label]) => `<button type="button" class="${resultsFilter === value ? "active" : ""}" data-results-filter="${value}" aria-pressed="${String(resultsFilter === value)}">${label}</button>`).join("")}
        <output id="results-visible-count">${bouts.length} bouts</output>
      </div>
      <div class="results-summary reveal"><span class="status-dot"></span><strong>${bouts.length ? `Day ${day} draft tracker` : "Awaiting the official torikumi"}</strong><span>${completed} completed · ${bouts.length - completed} scheduled</span><span>${signedPoints(gwazyToday.points + jakeToday.points)} combined draft pts</span></div>
      <section class="results-list draft-impact-results reveal" data-results-list>${bouts.length ? bouts.map((bout, index) => draftImpactBoutCard(bout, day, index)).join("") : `<div class="empty-results"><span>取</span><h2>Awaiting torikumi</h2><p>Day ${day} matchups will appear here when the official schedule is published.</p></div>`}<div class="results-filter-empty" id="results-filter-empty"><b>No matching draft bouts</b><span>Choose another filter to see more results.</span></div></section>
      ${appFooter()}
    </section>`;
}

function bashoDayTimeline(selectedDay = state.selectedDay) {
  const currentDay = Math.max(1, Math.min(Number(data.meta.totalDays || 15), Number(data.meta.day || 1)));
  const completedDays = new Set(officialCompletedDays());
  const watched = watchedDaySet();
  return `<div class="day-selector reveal" role="tablist" aria-label="Tournament day">${Array.from({ length: Number(data.meta.totalDays || 15) }, (_, index) => {
    const day = index + 1;
    const hidden = isDayHidden(day);
    const revealed = completedDays.has(day) && (!state.spoilerFree || watched.has(day));
    const selectable = revealed || hidden;
    const classes = [day === Number(selectedDay) ? "active" : "", day === currentDay ? "current" : "", revealed ? "completed watched" : "", hidden ? "hidden" : "", !selectable ? "future" : ""].filter(Boolean).join(" ");
    const label = hidden ? "HIDDEN" : day === currentDay ? "CURRENT" : revealed ? "WATCHED" : "DAY";
    return `<button type="button" role="tab" aria-selected="${day === Number(selectedDay)}" class="${classes}" data-day="${day}" ${selectable ? "" : "disabled"}><small>${label}</small>${day}${revealed ? " ✓" : hidden ? " ◉" : ""}</button>`;
  }).join("")}</div>`;
}

function calculateHistoryStats(events = state.history) {
  const completedEvents = events.filter((event) => event.status !== "skipped" && event.winner);
  const wins = { Gwazy: 0, Jake: 0 };
  const scores = { gwazy: 0, jake: 0 };
  const pickCounts = {};
  let closest = null;
  let biggestVictory = null;
  let biggestComeback = null;

  completedEvents.forEach((event) => {
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
  [...completedEvents].reverse().forEach((event) => {
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
    completedCount: completedEvents.length,
    average: completedEvents.length ? Math.round((scores.gwazy + scores.jake) / (completedEvents.length * 2)) : 0,
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
  if (event.status === "skipped") return `<section class="history-editor reveal"><div class="history-editor-heading"><div><p class="eyebrow">TOURNAMENT SKIPPED</p><h2>${escapeHtml(event.basho)}</h2></div><span>No draft was created, so there are no player results to edit.</span></div></section>`;
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
  const winRate = stats.completedCount ? Math.round((activeWins / stats.completedCount) * 100) : 0;
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
          if (event.status === "skipped") return `<button type="button" class="history-row skipped ${historyEditMode && activeHistoryId === event.id ? "selected" : ""}" data-history-select="${event.id}">
            <span><span class="basho-mark">⏭</span><b>${escapeHtml(event.basho)}</b></span><span class="winner-name skipped">Tournament Skipped</span><strong>—</strong><span>—</span><span>—</span><span class="story-badge skipped">SKIPPED</span>
          </button>`;
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
        <article><small>AVG. PLAYER SCORE</small><strong>${stats.average}</strong><span>across ${stats.completedCount} completed basho</span></article>
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
  const sharedSetup = window.SHARED_DRAFT_API?.setupStatus?.() || { ready: false, missing: ["Supabase client"] };
  const sharedBackendReady = sharedSetup.ready;
  const sharedBackendUrl = window.SHARED_DRAFT_API?.config?.url || "Not configured";
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
          ${toggleRow("setting-spoilers", "Spoiler-Free Mode", `Hide new official results until you reveal them. ${state.spoilerFree ? `Watched through Day ${spoilerVisibleDay()}.` : "Results currently reveal immediately."}`, state.spoilerFree)}
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
        <section class="settings-card reveal"><div class="settings-card-title"><span>⌁</span><div><h2>Realtime shared draft</h2><p>Rosters and predictions sync through Supabase without a personal write token.</p></div></div>
          <div class="sync-panel"><span class="sync-icon">${sharedBackendReady ? "✓" : "!"}</span><div><b>${sharedBackendReady ? "Supabase connection configured" : `Missing: ${escapeHtml(sharedSetup.missing.join(", "))}`}</b><small>${escapeHtml(sharedBackendUrl)}</small></div><span class="sync-badge"><i></i> LIVE</span></div>
          <button class="secondary-button" type="button" data-refresh-shared>Refresh realtime draft</button>
          <div class="storage-meter"><div><span>Local preferences only</span><b>${storageKilobytes} KB</b></div><span><i style="--width:${Math.min(100, Number(storageKilobytes) * 4)}%"></i></span></div>
          <button class="danger-button" type="button" data-reset-draft>Reset current draft only</button>
          <p class="microcopy">No GitHub or player credential is stored in the browser. The public Supabase key is limited by the database policies in supabase/schema.sql.</p>
        </section>
      </div>
      ${appFooter()}
    </section>`;
}

function appFooter() {
  return `
    <footer class="app-footer">
      <div class="brand footer-brand"><span class="brand-mon"><span>相</span></span><span><strong>SUMO BATTLE</strong><small>Made for the rivalry, not for money.</small></span></div>
      <p>Official results come from the <a href="${data.meta.sources[0].url}" target="_blank" rel="noreferrer">Nihon Sumo Kyokai</a>. Picks sync through the realtime Supabase draft.</p>
      <span>v3.0 · ${data.meta.shortTournament}</span>
    </footer>`;
}

function profileMarkup(rikishi) {
  const ownerId = draftOwner(rikishi.id);
  const owner = ownerId ? getPlayerDefinition(ownerId) : null;
  const location = ownerId ? pickLocation(rikishi.id, ownerId) : null;
  const stats = rikishiDisplayStats(rikishi);
  const profileLink = rikishi.profile
    ? `<a class="primary-button profile-link" href="${escapeHtml(rikishi.profile)}" target="_blank" rel="noreferrer">Official profile ${icons.source}</a>`
    : `<span class="profile-link-unavailable">Official profile unavailable</span>`;
  return `
    <div class="profile-hero">
      ${wrestlerImage(rikishi, "large")}
      <div><p class="eyebrow">${formatRank(rikishi)}</p><h2 id="profile-name">${rikishi.fullName || rikishi.name}</h2><p>${rikishi.stable} stable · ${rikishi.birthplace}</p><div class="profile-record"><strong>${stats.record}</strong><span>${stats.wins} wins<br />${stats.losses} losses</span></div></div>
      <div class="profile-owner"><small>DRAFT OWNERSHIP</small><span class="player-avatar ${owner ? owner.color : "neutral"}">${owner ? owner.initials : "—"}</span><b>${owner ? `${owner.name} · ${location === "main" ? "Main pick" : "Substitute"}` : "Available"}</b></div>
    </div>
    <div class="profile-stats">
      <span><small>POINTS</small><b>${stats.points}</b></span><span><small>FORM</small><b>${stats.wins + stats.losses ? `${stats.form}%` : "—"}</b></span><span><small>HEIGHT</small><b>${rikishi.height}</b></span><span><small>WEIGHT</small><b>${rikishi.weight}</b></span>
    </div>
    <div class="profile-details"><div><small>CAREER HIGH</small><b>${rikishi.careerHigh}</b></div><div><small>SIGNATURE</small><b>${rikishi.technique}</b></div></div>
    <div class="profile-form"><span style="--width:${stats.form}%"></span></div>
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
    app.innerHTML = `${newBashoNotice()}${spoilerNotice()}${views[route]()}${spoilerFirstTimeGate()}`;
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
    showToast(isPlayerDraftLocked() ? `${getPlayerDefinition().name}'s draft is permanently locked.` : "Wait for the shared draft to finish loading.");
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
  const candidateSubs = [...roster.subs, rikishiId];
  const canAddSub = roster.subs.length < 3 && substituteRules(candidateSubs).valid;
  let destination = null;

  if ((target === "main" || target === null) && canAddMain) {
    roster.team.push(rikishiId);
    destination = "main picks";
  } else if ((target === "sub" || target === null) && canAddSub) {
    roster.subs.push(rikishiId);
    destination = "substitutes";
  }

  if (!destination) {
    const rule = mainPickRules([...roster.team, rikishiId]);
    const subRule = substituteRules(candidateSubs);
    const reason = target === "sub" && roster.subs.length >= 3
      ? `${player.name}'s substitute roster is full. Remove a substitute before adding another.`
      : target === "sub" && subRule.sanyaku > 1
        ? "Substitutes may include exactly one Komusubi-or-higher wrestler."
        : target === "sub" && subRule.maegashira > 2
          ? "Substitutes may include exactly two Maegashira wrestlers."
          : target === "main" && roster.team.length >= 6
            ? `${player.name}'s main roster is full. Remove a pick before adding another.`
            : roster.team.length >= 6 && roster.subs.length >= 3
      ? `${player.name}'s roster is full. Remove a pick before adding another.`
      : rule.sanyaku > 2
        ? "Main picks can include at most two Komusubi or higher."
        : rule.underdogs > 1
          ? "Main picks can include exactly one M13–M17 underdog."
          : "The last main slot must be filled by an M13–M17 underdog.";
    showToast(reason);
    return;
  }

  render();
  showToast(`${rikishi.name} staged in ${player.name}'s ${destination}. Save Picks to publish.`);
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
  render();
  showToast(`${getRikishi(rikishiId).name} moved to ${player.name}'s ${target === "main" ? "main picks" : "substitutes"}.`);
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
      if (event.target.closest("[data-add-pick], [data-remove-pick], [data-roster-move], [data-sub-reorder]")) return;
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
  app.querySelector("[data-random-draft]")?.addEventListener("click", () => {
    const roster = getRoster();
    if (roster.team.length || roster.subs.length) app.querySelector("#random-draft-dialog")?.showModal();
    else generateRandomDraft();
  });
  app.querySelector("[data-confirm-random-draft]")?.addEventListener("click", () => {
    app.querySelector("#random-draft-dialog")?.close();
    generateRandomDraft();
  });
  app.querySelectorAll("[data-random-pick]").forEach((button) => button.addEventListener("click", () => addRandomPick(button.dataset.randomPick)));
  app.querySelector("[data-clear-player-draft]")?.addEventListener("click", () => {
    if (window.confirm(`Clear ${getPlayerDefinition().name}'s working roster? This will not publish until Save Picks.`)) clearPlayerWorkingDraft();
  });
  app.querySelectorAll("[data-remove-pick]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    removePick(button.dataset.removePick);
  }));
  app.querySelectorAll("[data-roster-move]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    movePick(...button.dataset.rosterMove.split(":"));
  }));
  app.querySelectorAll("[data-sub-reorder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    reorderSubstitute(...button.dataset.subReorder.split(":"));
  }));
  app.querySelectorAll("[data-overview-day]").forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    state.selectedDay = Number(button.dataset.overviewDay);
    saveState();
    location.hash = "#results";
  }));
  app.querySelectorAll("[data-day]").forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    state.selectedDay = Number(button.dataset.day);
    saveState();
    render();
  }));
  app.querySelectorAll("[data-results-filter]").forEach((button) => button.addEventListener("click", () => {
    resultsFilter = button.dataset.resultsFilter;
    applyResultsFilter();
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
  document.querySelector("#setting-spoilers")?.addEventListener("change", (event) => {
    state.spoilerFree = event.target.checked;
    if (state.spoilerFree) initializeSpoilerState();
    else state.selectedDay = Math.max(1, Number(data.meta.day || 1));
    saveState();
    render();
    showToast(state.spoilerFree ? "Spoiler-Free Mode enabled." : "Spoiler-Free Mode disabled. Current results are visible.");
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
  app.querySelector("[data-lock-my-draft]")?.addEventListener("click", lockMyDraft);
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
  });
  document.querySelector("[data-skip-basho]")?.addEventListener("click", () => startNewOfficialBashoDraft({ skipped: true }));
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
  app.querySelector("#basho-select")?.addEventListener("change", async (event) => {
    if (hasUnsavedDraftChanges() && !window.confirm("You have unsaved changes. Do you want to discard them?")) {
      event.target.value = state.selectedBashoId;
      return;
    }
    state.selectedBashoId = event.target.value;
    saveState();
    await loadSharedDraft({ force: true });
  });
  if (app.querySelector("[data-results-list]")) applyResultsFilter();
}

document.addEventListener("click", (event) => {
  const revealTarget = event.target.closest("[data-reveal-day]");
  if (revealTarget) {
    revealSpoilerDay(revealTarget.dataset.revealDay);
    return;
  }
  const keepHiddenTarget = event.target.closest("[data-keep-hidden]");
  if (keepHiddenTarget) {
    keepSpoilerDayHidden(keepHiddenTarget.dataset.keepHidden);
    return;
  }
  const routeLink = event.target.closest('a[href^="#"]');
  const destination = routeLink?.getAttribute("href");
  const staysInDraftWorkspace = ["#roster", "#banzuke"].includes(destination);
  if (routeLink && hasUnsavedDraftChanges() && !staysInDraftWorkspace) {
    if (!window.confirm("You have unsaved changes. Do you want to discard them?")) {
      event.preventDefault();
      return;
    }
    applySharedDraft(savedSharedDraft, sharedDraftRevision);
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
