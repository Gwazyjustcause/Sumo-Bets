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

const defaultPlayers = Object.fromEntries(
  data.players.map((player) => [player.id, {
    mainPicks: [...player.team],
    substitutes: [...player.subs],
    sidePrediction: player.sidePrediction || null,
    favouriteWrestler: player.favouriteWrestler || "",
    notes: "",
  }]),
);

const defaults = {
  theme: "midnight",
  sound: false,
  reducedMotion: false,
  compact: false,
  activePlayer: "gwazy",
  selectedBashoId: data.banzuke?.currentBashoId || "",
  selectedDay: data.meta.day,
  players: defaultPlayers,
  history: JSON.parse(JSON.stringify(data.history)),
};

const readState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("sumoBattleSettings") || "{}");
    const players = Object.fromEntries(data.players.map((player) => {
      const legacy = saved.roster?.[player.id];
      const stored = saved.players?.[player.id] || {};
      const base = defaultPlayers[player.id];
      return [player.id, {
        ...base,
        ...stored,
        mainPicks: [...(stored.mainPicks || legacy?.team || base.mainPicks)],
        substitutes: [...(stored.substitutes || legacy?.subs || base.substitutes)],
      }];
    }));
    if (!saved.players && saved.bonusPrediction && players[saved.activePlayer || "gwazy"]) {
      players[saved.activePlayer || "gwazy"].sidePrediction = saved.bonusPrediction;
    }
    const history = Array.isArray(saved.history) && saved.history.every((event) => Number.isFinite(event.gwazyScore))
      ? saved.history.map((event) => {
        const base = defaults.history.find((item) => item.id === event.id) || defaults.history[0];
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
    return { ...defaults, ...saved, activePlayer, selectedBashoId, players, history };
  } catch {
    return JSON.parse(JSON.stringify(defaults));
  }
};

let state = readState();
let pendingSwap = null;
let historyEditMode = false;
let activeHistoryId = state.history[0]?.id || null;
let banzukeProfileTimer = null;

function saveState() {
  try {
    localStorage.setItem("sumoBattleSettings", JSON.stringify(state));
    localStorage.setItem("sumoBattleHistoryCache", JSON.stringify({ updated: new Date().toISOString(), events: state.history }));
  } catch {
    showToast("This browser is blocking local saves.");
  }
}

function getPlayerDefinition(id = state.activePlayer) {
  return data.players.find((player) => player.id === id);
}

function getPlayerState(id = state.activePlayer) {
  return state.players[id];
}

function getRoster(id = state.activePlayer) {
  const player = getPlayerState(id);
  return { team: player.mainPicks, subs: player.substitutes };
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

function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function wrestlerImage(rikishi, size = "small") {
  const photo = rikishi.photo
      ? `<img src="${rikishi.photo}" alt="${rikishi.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('image-fallback');this.remove()" />`
    : "";
  return `<span class="rikishi-image ${size}" style="--form:${rikishi.form}%">${photo}<span class="fallback-initials" aria-hidden="true">${initials(rikishi.name)}</span></span>`;
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
  const lead = gwazy.score - jake.score;
  return `
    <article class="score-duel glass-card reveal" aria-label="Current score: ${gwazy.name} ${gwazy.score}, ${jake.name} ${jake.score}">
      <div class="duel-player leader">
        <span class="player-avatar violet">${gwazy.initials}</span>
        <div>
          <div class="duel-label"><span class="live-chip">LEADING</span>${gwazy.name}</div>
          <strong class="count-up" data-value="${gwazy.score}">0</strong><small>PTS</small>
        </div>
      </div>
      <div class="duel-center">
        <div class="lead-orb"><span>+${lead}</span><small>LEAD</small></div>
        <p><b>${gwazy.projection}%</b> projected win</p>
      </div>
      <div class="duel-player right">
        <div>
          <div class="duel-label">${jake.name}</div>
          <strong class="count-up" data-value="${jake.score}">0</strong><small>PTS</small>
        </div>
        <span class="player-avatar gold">${jake.initials}</span>
      </div>
      <div class="duel-beam" aria-hidden="true"></div>
    </article>`;
}

function scoreBars() {
  const max = Math.max(...data.players.map((player) => player.score));
  return data.players
    .map((player) => `
      <div class="standing-row">
        <div class="standing-meta"><strong>${player.name}</strong><span>+${player.today} today</span><b>${player.score}</b></div>
        <div class="score-track"><span class="${player.color}" style="--width:${(player.score / max) * 100}%"></span></div>
      </div>`)
    .join("");
}

function lineChart() {
  const width = 620;
  const height = 160;
  const maxScore = Math.max(...data.players.flatMap((player) => player.daily));
  const paths = data.players.map((player) => {
    const points = player.daily.map((value, index) => {
      const x = 16 + (index / (player.daily.length - 1)) * (width - 32);
      const y = height - 18 - (value / maxScore) * (height - 42);
      return [x, y];
    });
    const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<path class="chart-line ${player.color}" d="${path}" pathLength="1"></path>${points
      .map(([x, y]) => `<circle class="chart-point ${player.color}" cx="${x}" cy="${y}" r="3"></circle>`)
      .join("")}`;
  });
  return `
    <div class="chart-wrap" role="img" aria-label="Score lead across tournament days">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <line x1="16" y1="50" x2="604" y2="50"></line>
        <line x1="16" y1="95" x2="604" y2="95"></line>
        <line x1="16" y1="140" x2="604" y2="140"></line>
        ${paths.join("")}
      </svg>
      <div class="chart-days">${Array.from({ length: 8 }, (_, i) => `<span>D${i + 1}</span>`).join("")}</div>
    </div>`;
}

function boutCard(bout, compact = false) {
  const east = getRikishi(bout.east);
  const west = getRikishi(bout.west);
  const winner = getRikishi(bout.winner);
  const stars = "★".repeat(bout.importance) + "☆".repeat(5 - bout.importance);
  return `
    <button class="bout-card ${compact ? "compact" : ""}" type="button" data-profile="${winner.id}">
      <span class="bout-importance" title="Match importance ${bout.importance} out of 5">${stars}</span>
      <span class="bout-wrestler ${bout.winner === east.id ? "winner" : ""}">
        ${wrestlerImage(east)}
        <span><b>${east.name}</b><small>${east.rank} · ${east.record}</small></span>
      </span>
      <span class="versus"><b>VS</b><small>${bout.technique}</small></span>
      <span class="bout-wrestler right ${bout.winner === west.id ? "winner" : ""}">
        <span><b>${west.name}</b><small>${west.rank} · ${west.record}</small></span>
        ${wrestlerImage(west)}
      </span>
      <span class="bout-swing">${bout.swing}</span>
    </button>`;
}

function rosterCard(rikishi, playerId, substitute = false) {
  const heat = rikishi.form >= 75 ? "hot" : rikishi.form < 40 ? "cold" : "steady";
  const isSwapSource = pendingSwap?.playerId === playerId && pendingSwap.rikishiId === rikishi.id;
  const isSwapTarget = pendingSwap?.playerId === playerId && pendingSwap.substitute !== substitute;
  return `
    <article class="roster-card ${heat} ${isSwapSource ? "swap-source" : ""} ${isSwapTarget ? "swap-target" : ""}" data-profile="${rikishi.id}">
      ${wrestlerImage(rikishi, "medium")}
      <div class="roster-card-main">
        <div class="roster-card-title">
          <div><h3>${rikishi.name}</h3><p>${rikishi.rank} · ${rikishi.stable}</p></div>
          ${sideBadge(rikishi)}
        </div>
        <div class="record-line"><strong>${rikishi.record}</strong><span><b>${rikishi.wins}</b> wins · <b>${rikishi.losses}</b> losses</span></div>
        <div class="heat-track"><span style="--width:${rikishi.form}%"></span></div>
      </div>
      <div class="roster-points"><strong>${rikishi.points}</strong><small>PTS</small></div>
      ${rikishi.badge ? `<span class="clutch-badge">✦ ${rikishi.badge}</span>` : ""}
      <div class="roster-card-actions">
        <button type="button" data-roster-move="${rikishi.id}:${substitute ? "main" : "subs"}">${substitute ? "Move to main" : "Move to subs"}</button>
        <button type="button" data-swap-pick="${rikishi.id}:${substitute ? "sub" : "main"}">${isSwapTarget ? "Swap here" : isSwapSource ? "Cancel swap" : "Swap"}</button>
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

function overviewView() {
  const topBouts = data.bouts.slice(0, 4);
  return `
    <section class="overview-shell">
      <div class="hero-card reveal">
        <img src="assets/sumo-arena-hero.webp" alt="Atmospheric sumo arena" />
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <div>
            <p class="eyebrow"><span class="live-dot"></span> CURRENT BASHO</p>
            <h1>${data.meta.tournament}</h1>
            <p class="hero-detail"><span>${icons.calendar}</span> ${data.meta.dateRange}<span>${icons.pin}</span> ${data.meta.venue}</p>
          </div>
          <div class="basho-day">
            <small>TOURNAMENT PROGRESS</small>
            <strong>DAY ${data.meta.day}<span> / ${data.meta.totalDays}</span></strong>
            <div class="day-progress">${progressDots()}</div>
          </div>
        </div>
      </div>

      ${scoreDuel()}

      <div class="overview-grid">
        <section class="glass-card standings-card reveal">
          <div class="section-title">
            <div><p class="eyebrow">LIVE SCORE</p><h2>Current standings</h2></div>
            <span class="sync-badge"><i></i> Updated</span>
          </div>
          ${scoreBars()}
          <div class="difference-row"><span>Current margin</span><strong>Gwazy +11</strong></div>
        </section>

        <section class="glass-card projection-card reveal">
          <div class="section-title"><div><p class="eyebrow">FORECAST</p><h2>Projected winner</h2></div><span class="spark-icon">${icons.spark}</span></div>
          <div class="projection-value"><strong>82<span>%</span></strong><p>Gwazy is favoured<br />with 7 days remaining</p></div>
          <div class="probability-track"><span style="--width:82%"></span></div>
          <p class="microcopy">Based on roster form, remaining bouts and the side bonus.</p>
        </section>

        <section class="glass-card timeline-card reveal">
          <div class="section-title">
            <div><p class="eyebrow">MOMENTUM</p><h2>Lead timeline</h2></div>
            <div class="chart-legend"><span class="violet">Gwazy</span><span class="gold">Jake</span></div>
          </div>
          ${lineChart()}
        </section>

        <section class="glass-card form-card reveal">
          <div class="section-title"><div><p class="eyebrow">FORM GUIDE</p><h2>Carrying the teams</h2></div></div>
          ${["aonishiki", "takerufuji", "kotoeiho"].map((id, index) => {
            const rikishi = getRikishi(id);
            return `<button class="form-row" type="button" data-profile="${id}"><span>${index + 1}</span>${wrestlerImage(rikishi)}<b>${rikishi.name}</b><small>${rikishi.record}</small><strong>+${rikishi.points}</strong></button>`;
          }).join("")}
        </section>
      </div>

      <section class="content-section reveal">
        <div class="section-title spacious">
          <div><p class="eyebrow">DAY ${data.meta.day} · MAKUUCHI</p><h2>Today's key bouts</h2><p>Highest-impact matchups for the fantasy battle.</p></div>
          <a class="text-link" href="#results">All results <span>${icons.arrow}</span></a>
        </div>
        <div class="bout-list">${topBouts.map((bout) => boutCard(bout)).join("")}</div>
      </section>

      <section class="content-section picks-preview reveal">
        <div class="section-title spacious"><div><p class="eyebrow">YOUR TEAMS</p><h2>Roster pulse</h2><p>Green form is building. Red form needs watching.</p></div><a class="text-link" href="#roster">Open roster <span>${icons.arrow}</span></a></div>
        <div class="pick-preview-grid">
          ${data.players.map((player) => `
            <article class="team-preview ${player.color}">
              <div class="team-preview-head"><span class="player-avatar ${player.color}">${player.initials}</span><div><small>${player.name.toUpperCase()}'S TEAM</small><h3>${player.today} points today</h3></div><strong>${player.score}</strong></div>
              <div class="pick-chip-grid">${getRoster(player.id).team.slice(0, 4).map((id) => compactPickCard(getRikishi(id))).join("")}</div>
            </article>`).join("")}
        </div>
      </section>

      <section class="bonus-panel reveal">
        <div class="scoring-mini">
          <div class="section-title"><div><p class="eyebrow">QUICK REFERENCE</p><h2>Scoring system</h2></div><span class="spark-icon">♛</span></div>
          <div class="scoring-rows">${data.scoring.map((rule) => `<span><small>${rule.label}</small><b>${rule.value}</b></span>`).join("")}</div>
        </div>
        <div class="bonus-prediction ${getPlayerDefinition().color}">
          <div><p class="eyebrow">${getPlayerDefinition().name.toUpperCase()}'S BONUS PREDICTION</p><h2>Which side wins more bouts?</h2><p>This pick belongs only to ${getPlayerDefinition().name}. Switch players in the header to view the other prediction.</p></div>
          <div class="side-choice" role="group" aria-label="Bonus side prediction">
            <button type="button" class="east ${getPlayerState().sidePrediction === "East" ? "active" : ""}" data-bonus="East"><span>東</span><b>EAST</b><small>${getPlayerState().sidePrediction === "East" ? "PICKED" : "SELECT"}</small></button>
            <span class="bonus-vs">VS<small>20 PTS</small></span>
            <button type="button" class="west ${getPlayerState().sidePrediction === "West" ? "active" : ""}" data-bonus="West"><span>西</span><b>WEST</b><small>${getPlayerState().sidePrediction === "West" ? "PICKED" : "SELECT"}</small></button>
          </div>
        </div>
      </section>

      <section class="achievement-strip reveal">
        <span class="achievement-icon">🏆</span>
        <div><p class="eyebrow">ACHIEVEMENT UNLOCKED</p><h3>Perfect Underdog</h3><p>Takerufuji has scored in 6 of 8 bouts from Maegashira 13.</p></div>
        <span class="achievement-points">+250 XP</span>
      </section>

      ${appFooter()}
    </section>`;
}

function validateRoster(playerId) {
  const roster = getRoster(playerId);
  const team = roster.team.map(getRikishi);
  const sanyaku = team.filter((rikishi) => ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"].includes(rikishi.rank)).length;
  const underdogs = team.filter((rikishi) => /Maegashira (1[3-7])/.test(rikishi.rank)).length;
  return {
    valid: team.length === 6 && roster.subs.length === 3 && sanyaku <= 2 && underdogs === 1,
    team: team.length,
    subs: roster.subs.length,
    sanyaku,
    underdogs,
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
    </div>`;
}

function emptyRosterSlots(count, type) {
  return Array.from({ length: count }, (_, index) => `<div class="empty-roster-slot"><span>+</span><b>${type} slot ${index + 1}</b><small>Add from the Banzuke</small></div>`).join("");
}

function rosterView() {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const check = validateRoster(player.id);
  return `
    <section class="page-shell">
      ${pageIntro("TEAM WORKSPACE", `${player.name}'s roster`, "Review, remove, move, or swap picks without rebuilding the team.", `<a class="primary-button" href="#banzuke">Add from Banzuke</a>`)}
      ${editingBanner(`This roster belongs only to ${player.name}. Use the header selector to edit the other player.`)}
      <div class="rules-strip reveal">
        <span><b>6</b> starters</span><i></i><span><b>3</b> substitutes</span><i></i><span><b>MAX 2</b> Komusubi+</span><i></i><span><b>EXACTLY 1</b> M13–M17 underdog</span>
      </div>
      <section class="active-roster-workspace ${player.color} reveal">
        <div class="roster-owner">
          <span class="player-avatar ${player.color}">${player.initials}</span>
          <div><p class="eyebrow">${player.name.toUpperCase()}'S PICKS</p><h2>${player.score} points</h2></div>
          <span class="legal-badge ${check.valid ? "valid" : "invalid"}">${check.valid ? "✓ ROSTER LEGAL" : "! ROSTER INCOMPLETE"}</span>
        </div>
        ${pendingSwap ? `<div class="swap-notice"><b>Swap mode:</b> choose a pick in the other column to swap with ${getRikishi(pendingSwap.rikishiId).name}. <button type="button" data-cancel-swap>Cancel</button></div>` : ""}
        <div class="active-roster-grid">
          <section>
            <div class="slot-heading"><span><small>MAIN PICKS</small><b>${roster.team.length} / 6</b></span><strong>${6 - roster.team.length} remaining</strong></div>
            <div class="roster-list">${roster.team.map((id) => rosterCard(getRikishi(id), player.id)).join("")}${emptyRosterSlots(Math.max(0, 6 - roster.team.length), "Main")}</div>
          </section>
          <section>
            <div class="slot-heading"><span><small>SUBSTITUTES</small><b>${roster.subs.length} / 3</b></span><strong>${3 - roster.subs.length} remaining</strong></div>
            <div class="roster-list substitute-list">${roster.subs.map((id, index) => `<div class="sub-order"><span>${index + 1}</span>${rosterCard(getRikishi(id), player.id, true)}</div>`).join("")}${emptyRosterSlots(Math.max(0, 3 - roster.subs.length), "Substitute")}</div>
          </section>
        </div>
        ${validationChecklist(check)}
        <div class="roster-save-row"><p>Edits save automatically on this device.</p><button class="primary-button" type="button" data-save-draft ${check.valid ? "" : "disabled"}>Confirm ${player.name}'s roster</button></div>
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
  const sanyaku = picks.filter((rikishi) => ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"].includes(rikishi.rank)).length;
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
  const rows = [];
  const byPosition = new Map();
  basho.entries.forEach((entry) => {
    const position = entry.rankNumber ?? entry.rankSeat ?? 1;
    const key = `${entry.rank}:${position}`;
    if (!byPosition.has(key)) {
      const row = { key, rank: entry.rank, position, East: null, West: null };
      byPosition.set(key, row);
      rows.push(row);
    }
    byPosition.get(key)[entry.side] = entry;
  });
  return rows;
}

function banzukeRow(row) {
  const cell = (entry, side) => {
    if (!entry) return `<span class="banzuke-vacancy" aria-hidden="true"></span>`;
    const rikishi = getRikishi(entry.rikishiId);
    if (!rikishi) return `<span class="banzuke-vacancy missing-data" data-missing-rikishi="${escapeHtml(entry.rikishiId)}"></span>`;
    const location = pickLocation(rikishi.id);
    const unavailable = rikishi.available === false;
    const action = location
      ? `<button class="pick-action remove" type="button" data-remove-pick="${rikishi.id}"><small>${location === "main" ? "MAIN PICK" : "SUBSTITUTE"}</small>Remove</button>`
      : `<button class="pick-action" type="button" data-add-pick="${rikishi.id}" ${unavailable ? "disabled" : ""}><small>${unavailable ? "UNAVAILABLE" : `FOR ${getPlayerDefinition().name.toUpperCase()}`}</small>${unavailable ? "Absent" : "Add to Team"}</button>`;
    const searchValue = `${rikishi.name} ${rikishi.fullName || ""} ${rikishi.stable} ${rikishi.rank} ${rikishi.side}`.toLowerCase();
    return `
      <article class="banzuke-rikishi ${side} ${location ? "selected-pick" : ""} ${unavailable ? "unavailable" : ""}"
        data-banzuke-id="${rikishi.id}" data-rank="${escapeHtml(rikishi.rank)}" data-side="${rikishi.side}"
        data-search-value="${escapeHtml(searchValue)}" data-available="${String(!unavailable)}"
        data-picked-current="${String(Boolean(location))}" data-picked-jake="${String(Boolean(pickLocation(rikishi.id, "jake")))}">
        ${side === "east" ? wrestlerImage(rikishi) : action}
        <button class="banzuke-profile" type="button" data-profile="${rikishi.id}" aria-label="Open ${escapeHtml(rikishi.name)} profile">
          <span class="banzuke-name-line"><b>${escapeHtml(rikishi.name)}</b><i class="position-chip ${side}">${rikishi.side}</i></span>
          <small>${escapeHtml(rikishi.stable)} stable</small>
          <span class="banzuke-record"><strong>${escapeHtml(rikishi.record)}</strong><em><b>${rikishi.wins}</b> wins</em><em><b>${rikishi.losses}</b> losses</em></span>
        </button>
        ${side === "west" ? wrestlerImage(rikishi) : action}
        <aside class="banzuke-quick-profile" aria-hidden="true">
          <small>QUICK PROFILE</small><b>${escapeHtml(rikishi.fullName || rikishi.name)}</b>
          <span>${escapeHtml(formatRank(rikishi))}</span><span>${escapeHtml(rikishi.stable)} · ${escapeHtml(rikishi.birthplace)}</span>
          <em>Single-click for full profile · double-click to ${location ? "remove" : "add"}</em>
        </aside>
      </article>`;
  };
  const label = row.rank.toUpperCase();
  const isMaegashira = row.rank.startsWith("Maegashira");
  const pairLabel = !isMaegashira && row.position > 1 ? `PAIR ${row.position} · ` : "";
  return `<div class="banzuke-row" data-banzuke-row>${cell(row.East, "east")}<div class="rank-seal"><b>${escapeHtml(label)}</b><small>${pairLabel}${isMaegashira ? "前頭" : "役力士"}</small></div>${cell(row.West, "west")}</div>`;
}

function banzukeView() {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const check = validateRoster(player.id);
  const basho = selectedBasho();
  const rows = banzukeRankRows(basho);
  const rankOptions = [...new Set(basho.entries.map((entry) => entry.rank))];
  return `
    <section class="page-shell">
      ${pageIntro(`${escapeHtml(basho.label.toUpperCase())} · TEAM BUILDER`, "Pick from the complete banzuke", `All ${basho.entries.length} official Makuuchi rikishi. Single-click a wrestler for their profile or double-click to edit ${player.name}'s roster.`, `<label class="search-field"><span>⌕</span><input id="banzuke-search" type="search" placeholder="Find a rikishi or stable" autocomplete="off" /></label>`)}
      ${editingBanner(`Every roster action below changes ${player.name}'s team only.`)}
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
        <label><small>PICKS</small><select id="banzuke-pick-filter"><option value="all">All wrestlers</option><option value="mine">Only my picks</option><option value="jake">Only Jake's picks</option></select></label>
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
      <p class="source-note"><a href="${basho.officialUrl}" target="_blank" rel="noreferrer">Official Japan Sumo Association banzuke ↗</a> · Records are current through Day ${data.meta.day}. Picks save immediately for ${player.name}.</p>
      ${appFooter()}
    </section>`;
}

function resultsForDay(day) {
  if (day > data.meta.day) return [];
  if (day === data.meta.day) return data.bouts;
  const offset = Math.max(0, day - 1) % data.bouts.length;
  return [...data.bouts.slice(offset), ...data.bouts.slice(0, offset)].slice(0, 7).map((bout, index) => ({
    ...bout,
    winner: (index + day) % 3 ? bout.winner : bout.winner === bout.east ? bout.west : bout.east,
    swing: index % 2 ? `+${(index % 5) + 1} Jake` : `+${(index % 6) + 2} Gwazy`,
  }));
}

function resultsView() {
  const day = Number(state.selectedDay);
  const bouts = resultsForDay(day);
  const dailyGwazy = day === 8 ? 39 : 26 + ((day * 3) % 15);
  const dailyJake = day === 8 ? 34 : 25 + ((day * 5) % 14);
  return `
    <section class="page-shell">
      ${pageIntro(`NAGOYA 2026 · DAY ${day}`, "Bout results", "Every result, winning technique and fantasy-point swing in one place.", `<div class="daily-score"><span>GWAZY <b>+${dailyGwazy}</b></span><i></i><span>JAKE <b>+${dailyJake}</b></span></div>`)}
      <div class="day-selector reveal" role="tablist" aria-label="Tournament day">${Array.from({ length: 15 }, (_, index) => `<button type="button" role="tab" aria-selected="${day === index + 1}" class="${day === index + 1 ? "active" : ""}" data-day="${index + 1}"><small>DAY</small>${index + 1}</button>`).join("")}</div>
      <div class="results-summary reveal"><span class="status-dot"></span><strong>${day < data.meta.day ? "All bouts complete" : day === data.meta.day ? data.meta.status : "Torikumi not yet published"}</strong><span>${bouts.length} featured Makuuchi bouts</span><span>Fantasy total: ${dailyGwazy + dailyJake} pts</span></div>
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
  return data.rikishi
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
        <section class="settings-card data-card reveal"><div class="settings-card-title"><span>↻</span><div><h2>Data layer</h2><p>Static JSON-shaped data, ready for a GitHub Action updater.</p></div></div>
          <div class="sync-panel"><span class="sync-icon">✓</span><div><b>Data is current</b><small>${data.meta.lastUpdated}</small></div><span class="sync-badge"><i></i> Connected</span></div>
          <div class="source-list">${data.meta.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><span>${icons.source}</span><b>${source.label}</b><small>sumo.or.jp</small></a>`).join("")}</div>
          <button class="secondary-button" type="button" data-mock-sync>Check data now</button>
        </section>
        <section class="settings-card reveal"><div class="settings-card-title"><span>⌁</span><div><h2>Local storage</h2><p>Preferences and draft rosters stay on this device.</p></div></div>
          <div class="storage-meter"><div><span>Settings & draft</span><b>3.4 KB</b></div><span><i style="--width:18%"></i></span></div>
          <button class="danger-button" type="button" data-reset-settings>Reset local settings</button>
        </section>
      </div>
      ${appFooter()}
    </section>`;
}

function appFooter() {
  return `
    <footer class="app-footer">
      <div class="brand footer-brand"><span class="brand-mon"><span>相</span></span><span><strong>SUMO BATTLE</strong><small>Made for the rivalry, not for money.</small></span></div>
      <p>Fantasy points are private and manually maintained. Tournament facts link back to the <a href="${data.meta.sources[0].url}" target="_blank" rel="noreferrer">Nihon Sumo Kyokai</a>.</p>
      <span>v1.0 · ${data.meta.shortTournament}</span>
    </footer>`;
}

function profileMarkup(rikishi) {
  const player = getPlayerDefinition();
  const location = pickLocation(rikishi.id);
  return `
    <div class="profile-hero">
      ${wrestlerImage(rikishi, "large")}
      <div><p class="eyebrow">${formatRank(rikishi)}</p><h2 id="profile-name">${rikishi.fullName || rikishi.name}</h2><p>${rikishi.stable} stable · ${rikishi.birthplace}</p><div class="profile-record"><strong>${rikishi.record}</strong><span>${rikishi.wins} wins<br />${rikishi.losses} losses</span></div></div>
      <div class="profile-owner"><small>${player.name.toUpperCase()}'S TEAM</small><span class="player-avatar ${location ? player.color : "neutral"}">${location ? player.initials : "—"}</span><b>${location ? (location === "main" ? "Main pick" : "Substitute") : "Not selected"}</b></div>
    </div>
    <div class="profile-stats">
      <span><small>POINTS</small><b>${rikishi.points}</b></span><span><small>FORM</small><b>${rikishi.form}%</b></span><span><small>HEIGHT</small><b>${rikishi.height}</b></span><span><small>WEIGHT</small><b>${rikishi.weight}</b></span>
    </div>
    <div class="profile-details"><div><small>CAREER HIGH</small><b>${rikishi.careerHigh}</b></div><div><small>SIGNATURE</small><b>${rikishi.technique}</b></div></div>
    <div class="profile-form"><span style="--width:${rikishi.form}%"></span></div>
    <a class="primary-button profile-link" href="${rikishi.profile}" target="_blank" rel="noreferrer">Official profile ${icons.source}</a>`;
}

function openProfile(id) {
  const rikishi = getRikishi(id);
  if (!rikishi) return;
  profileContent.innerHTML = profileMarkup(rikishi);
  dialog.showModal();
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
    app.innerHTML = views[route]();
    app.classList.remove("route-leave");
    app.dataset.route = route;
    window.scrollTo({ top: 0, behavior: state.reducedMotion ? "auto" : "smooth" });
    bindViewEvents();
    if (route === "banzuke") verifyBanzukeIntegrity();
    animateNumbers();
  }, state.reducedMotion ? 0 : 80);
}

function addPick(rikishiId) {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const rikishi = getRikishi(rikishiId);
  if (!rikishi || pickLocation(rikishiId)) return;
  if (rikishi.available === false) {
    showToast(`${rikishi.name} is unavailable for roster selection.`);
    return;
  }

  let destination = null;
  if (roster.team.length < 6 && mainPickRules([...roster.team, rikishiId]).valid) {
    roster.team.push(rikishiId);
    destination = "main picks";
  } else if (roster.subs.length < 3) {
    roster.subs.push(rikishiId);
    destination = "substitutes";
  }

  if (!destination) {
    const rule = mainPickRules([...roster.team, rikishiId]);
    const reason = roster.team.length >= 6 && roster.subs.length >= 3
      ? `${player.name}'s roster is full. Remove or swap a pick first.`
      : rule.sanyaku > 2
        ? "Main picks can include at most two Komusubi or higher."
        : rule.underdogs > 1
          ? "Main picks can include exactly one M13–M17 underdog."
          : "The last main slot must be filled by an M13–M17 underdog.";
    showToast(reason);
    return;
  }

  saveState();
  render();
  showToast(`${rikishi.name} added to ${player.name}'s ${destination}.`);
}

function removePick(rikishiId) {
  const player = getPlayerDefinition();
  const roster = getRoster();
  const location = pickLocation(rikishiId);
  if (!location) return;
  const list = location === "main" ? roster.team : roster.subs;
  list.splice(list.indexOf(rikishiId), 1);
  if (pendingSwap?.rikishiId === rikishiId) pendingSwap = null;
  saveState();
  render();
  showToast(`${getRikishi(rikishiId).name} removed from ${player.name}'s roster.`);
}

function movePick(rikishiId, target) {
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
  if (target === "main" && !mainPickRules([...roster.team, rikishiId]).valid) {
    showToast("That move would break the Komusubi+ or underdog rule.");
    return;
  }
  from.splice(from.indexOf(rikishiId), 1);
  to.push(rikishiId);
  pendingSwap = null;
  saveState();
  render();
  showToast(`${getRikishi(rikishiId).name} moved to ${player.name}'s ${target === "main" ? "main picks" : "substitutes"}.`);
}

function chooseSwap(rikishiId, source) {
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
  if (!mainPickRules(candidateMain).valid) {
    showToast("That swap would break the Komusubi+ or underdog rule.");
    return;
  }
  roster.team[mainIndex] = subId;
  roster.subs[subIndex] = mainId;
  pendingSwap = null;
  saveState();
  render();
  showToast(`${getRikishi(subId).name} moved into the main team.`);
}

function verifyBanzukeIntegrity(basho = selectedBasho()) {
  const rendered = [...app.querySelectorAll("[data-banzuke-id]")];
  const renderedIds = new Set(rendered.map((element) => element.dataset.banzukeId));
  const missing = basho.entries.filter((entry) => !renderedIds.has(entry.rikishiId));
  const status = app.querySelector("#banzuke-render-count");
  const integrity = status?.closest(".banzuke-integrity");
  if (missing.length) {
    console.warn(`${missing.length} rikishi missing from rendered banzuke.`);
    if (status) status.textContent = `${missing.length} of ${basho.expectedRikishi} official rikishi are missing`;
    integrity?.classList.add("bad");
    return false;
  }
  if (status) status.textContent = `${renderedIds.size} / ${basho.expectedRikishi} official rikishi rendered`;
  integrity?.classList.add("ok");
  return renderedIds.size === basho.expectedRikishi;
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
      || (pickFilter === "mine" && card.dataset.pickedCurrent === "true")
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
      if (event.target.closest("[data-add-pick], [data-remove-pick], [data-roster-move], [data-swap-pick]")) return;
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
    if (pickLocation(rikishi.id)) removePick(rikishi.id);
    else if (rikishi.available === false) showToast(`${rikishi.name} is unavailable for roster selection.`);
    else addPick(rikishi.id);
  }));
  app.querySelectorAll("[data-add-pick]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    addPick(button.dataset.addPick);
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
    const player = getPlayerDefinition();
    const valid = validateRoster(player.id).valid;
    if (valid) {
      saveState();
      playBell();
      showToast(`${player.name}'s legal roster is saved on this device.`);
    } else showToast(`${player.name}'s roster still breaks a pick rule.`);
  });
  document.querySelector("[data-mock-sync]")?.addEventListener("click", (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Checking official sources…";
    setTimeout(() => {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Check data now";
      showToast("No newer static data found.");
    }, 900);
  });
  document.querySelector("[data-reset-settings]")?.addEventListener("click", () => {
    localStorage.removeItem("sumoBattleSettings");
    localStorage.removeItem("sumoBattleHistoryCache");
    state = readState();
    pendingSwap = null;
    historyEditMode = false;
    activeHistoryId = state.history[0]?.id || null;
    setTheme();
    render();
    showToast("Local preferences and draft were reset.");
  });
  app.querySelectorAll("[data-bonus]").forEach((button) => button.addEventListener("click", () => {
    getPlayerState().sidePrediction = button.dataset.bonus;
    saveState();
    render();
    showToast(`${button.dataset.bonus} saved as ${getPlayerDefinition().name}'s 20-point bonus prediction.`);
  }));
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
  saveState();
  setTheme();
  render();
  showToast(`Now playing as ${getPlayerDefinition().name}. Player-only data has been switched.`);
});

window.addEventListener("hashchange", render);
setTheme();
render();
