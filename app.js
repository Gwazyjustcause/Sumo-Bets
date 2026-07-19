/* global SUMO_DATA */

const data = window.SUMO_DATA;
const app = document.querySelector("#app");
const dialog = document.querySelector("#profile-dialog");
const profileContent = document.querySelector("#profile-content");
const toast = document.querySelector("#toast");
const soundButton = document.querySelector("#sound-toggle");

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

const defaults = {
  theme: "midnight",
  sound: false,
  reducedMotion: false,
  compact: false,
  bonusPrediction: null,
  selectedDay: data.meta.day,
  roster: Object.fromEntries(
    data.players.map((player) => [player.id, { team: [...player.team], subs: [...player.subs] }]),
  ),
};

const readState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("sumoBattleSettings") || "{}");
    return { ...defaults, ...saved, roster: { ...defaults.roster, ...(saved.roster || {}) } };
  } catch {
    return { ...defaults };
  }
};

let state = readState();

try {
  if (!localStorage.getItem("sumoBattleHistoryCache")) {
    localStorage.setItem("sumoBattleHistoryCache", JSON.stringify({ updated: data.meta.lastUpdated, events: data.history }));
  }
} catch {
  // The app remains usable when a browser disables local storage.
}

function saveState() {
  localStorage.setItem("sumoBattleSettings", JSON.stringify(state));
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
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.classList.toggle("reduced-motion", state.reducedMotion);
  document.documentElement.classList.toggle("compact-mode", state.compact);
  soundButton.setAttribute("aria-pressed", String(state.sound));
  soundButton.classList.toggle("active", state.sound);
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
  return `
    <article class="roster-card ${heat}" data-profile="${rikishi.id}">
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
      <button class="card-action" type="button" data-swap="${playerId}:${rikishi.id}:${substitute ? "promote" : "bench"}" aria-label="${substitute ? "Promote" : "Move to substitutes"} ${rikishi.name}">${substitute ? "↑" : "↓"}</button>
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
              <div class="pick-chip-grid">${state.roster[player.id].team.slice(0, 4).map((id) => compactPickCard(getRikishi(id))).join("")}</div>
            </article>`).join("")}
        </div>
      </section>

      <section class="bonus-panel reveal">
        <div class="scoring-mini">
          <div class="section-title"><div><p class="eyebrow">QUICK REFERENCE</p><h2>Scoring system</h2></div><span class="spark-icon">♛</span></div>
          <div class="scoring-rows">${data.scoring.map((rule) => `<span><small>${rule.label}</small><b>${rule.value}</b></span>`).join("")}</div>
        </div>
        <div class="bonus-prediction">
          <div><p class="eyebrow">BONUS PREDICTION</p><h2>Which side wins more bouts?</h2><p>Lock a side before Day 1. A correct call is worth 20 points.</p></div>
          <div class="side-choice" role="group" aria-label="Bonus side prediction">
            <button type="button" class="east ${state.bonusPrediction === "East" ? "active" : ""}" data-bonus="East"><span>東</span><b>EAST</b><small>${state.bonusPrediction === "East" ? "PICKED" : "SELECT"}</small></button>
            <span class="bonus-vs">VS<small>20 PTS</small></span>
            <button type="button" class="west ${state.bonusPrediction === "West" ? "active" : ""}" data-bonus="West"><span>西</span><b>WEST</b><small>${state.bonusPrediction === "West" ? "PICKED" : "SELECT"}</small></button>
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
  const roster = state.roster[playerId];
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

function rosterView() {
  return `
    <section class="page-shell">
      ${pageIntro("PICK BUILDER", "The rosters", "Six starters. Three substitutes. Every selection can change the basho.", `<button class="primary-button" type="button" data-save-draft>Save draft</button>`)}
      <div class="rules-strip reveal">
        <span><b>6</b> starters</span><i></i><span><b>3</b> substitutes</span><i></i><span><b>MAX 2</b> Komusubi+</span><i></i><span><b>EXACTLY 1</b> M13–M17 underdog</span>
      </div>
      <div class="roster-columns">
        ${data.players.map((player) => {
          const roster = state.roster[player.id];
          const check = validateRoster(player.id);
          return `
            <section class="roster-column ${player.color} reveal">
              <div class="roster-owner">
                <span class="player-avatar ${player.color}">${player.initials}</span>
                <div><p class="eyebrow">${player.name.toUpperCase()}'S PICKS</p><h2>${player.score} points</h2></div>
                <span class="legal-badge ${check.valid ? "valid" : "invalid"}">${check.valid ? "✓ LEGAL" : "! CHECK PICKS"}</span>
              </div>
              <p class="roster-label">STARTERS · ${roster.team.length}/6</p>
              <div class="roster-list">${roster.team.map((id) => rosterCard(getRikishi(id), player.id)).join("")}</div>
              <p class="roster-label subs">SUBSTITUTE ORDER</p>
              <div class="roster-list substitute-list">${roster.subs.map((id, index) => `<div class="sub-order"><span>${index + 1}</span>${rosterCard(getRikishi(id), player.id, true)}</div>`).join("")}</div>
              <div class="roster-validation">
                <span class="${check.sanyaku <= 2 ? "ok" : "bad"}">${check.sanyaku}/2 Komusubi+</span>
                <span class="${check.underdogs === 1 ? "ok" : "bad"}">${check.underdogs}/1 underdog</span>
                <span class="${check.team === 6 && check.subs === 3 ? "ok" : "bad"}">${check.team + check.subs}/9 total</span>
              </div>
            </section>`;
        }).join("")}
      </div>
      ${appFooter()}
    </section>`;
}

function banzukeRow(east, west, label) {
  const cell = (rikishi, side) => rikishi ? `
    <button class="banzuke-rikishi ${side}" type="button" data-profile="${rikishi.id}">
      ${side === "east" ? wrestlerImage(rikishi) : ""}
      <span><b>${rikishi.name}</b><small>${rikishi.stable} · ${rikishi.record}</small></span>
      ${side === "west" ? wrestlerImage(rikishi) : ""}
    </button>` : `<span></span>`;
  return `<div class="banzuke-row">${cell(east, "east")}<div class="rank-seal"><b>${label}</b><small>${label.startsWith("M") ? "前頭" : "役力士"}</small></div>${cell(west, "west")}</div>`;
}

function banzukeView() {
  const pairs = [
    ["hoshoryu", "onosato", "YOKOZUNA"], ["kirishima", "kotozakura", "OZEKI"], ["atamifuji", "aonishiki", "SEKIWAKE"],
    ["wakatakakage", null, "SEKIWAKE"], [null, "oho", "KOMUSUBI"], ["gonoyama", "hakunofuji", "M2"],
    ["daieisho", null, "M4"], ["ura", null, "M5"], ["shodai", null, "M6"], ["kotoeiho", "takayasu", "M7"],
    [null, "tobizaru", "M9"], [null, "abi", "M12"], ["nishikifuji", "takerufuji", "M13"], [null, "shishi", "M14"], ["onokatsu", null, "M15"],
  ];
  return `
    <section class="page-shell">
      ${pageIntro("JULY 2026 · MAKUUCHI", "The banzuke", "East and West, presented as a modern companion to the official ranking sheet.", `<label class="search-field"><span>⌕</span><input id="banzuke-search" type="search" placeholder="Find a rikishi" autocomplete="off" /></label>`)}
      <section class="banzuke-board reveal">
        <div class="banzuke-title"><span>東 <small>EAST</small></span><div><p>令和八年 七月場所</p><h2>幕内番付</h2><small>NAGOYA BASHO · MAKUUCHI DIVISION</small></div><span>西 <small>WEST</small></span></div>
        <div class="banzuke-rows">${pairs.map(([east, west, label]) => banzukeRow(east && getRikishi(east), west && getRikishi(west), label)).join("")}</div>
      </section>
      <p class="source-note">Ranks mirror the official July 2026 Makuuchi list. Fantasy records and points are presented separately.</p>
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

function historyView() {
  const gwazyWins = data.history.filter((event) => event.winner === "Gwazy").length;
  const jakeWins = data.history.length - gwazyWins;
  return `
    <section class="page-shell">
      ${pageIntro("RIVALRY ARCHIVE", "Basho history", "The wins, the collapses, and the picks that still get mentioned.")}
      <section class="history-hero reveal">
        <div><p class="eyebrow">ALL-TIME HEAD TO HEAD</p><div class="history-score"><span><b>${gwazyWins}</b><small>GWAZY WINS</small></span><i>—</i><span><b>${jakeWins}</b><small>JAKE WINS</small></span></div></div>
        <div class="history-stats"><span><small>WIN RATE</small><b>${Math.round((gwazyWins / data.history.length) * 100)}%</b></span><span><small>CLOSEST</small><b>3 pts</b></span><span><small>BIGGEST MARGIN</small><b>43 pts</b></span><span><small>LONGEST STREAK</small><b>3</b></span></div>
      </section>
      <section class="history-list reveal">
        <div class="history-table-head"><span>BASHO</span><span>WINNER</span><span>FINAL SCORE</span><span>MARGIN</span><span>BEST PICK</span><span>STORY</span></div>
        ${data.history.map((event) => `
          <article class="history-row">
            <div><span class="basho-mark">${event.basho.slice(0, 1)}</span><b>${event.basho}</b></div>
            <span class="winner-name ${event.winner.toLowerCase()}">${event.winner}</span>
            <strong>${event.score}</strong><span>+${event.margin}</span><span>${event.best}</span><span class="story-badge">${event.badge}</span>
          </article>`).join("")}
      </section>
      <section class="stat-grid reveal">
        <article><small>MOST PICKED</small><strong>Onosato</strong><span>9 basho</span></article>
        <article><small>HIGHEST SCORER</small><strong>Aonishiki</strong><span>52 pts · current</span></article>
        <article><small>BEST SUBSTITUTE</small><strong>Ura</strong><span>31 career sub pts</span></article>
        <article><small>AVG. BASHO SCORE</small><strong>458</strong><span>across both players</span></article>
      </section>
      ${appFooter()}
    </section>`;
}

function toggleRow(id, title, copy, checked) {
  return `<label class="setting-row" for="${id}"><span><b>${title}</b><small>${copy}</small></span><input id="${id}" type="checkbox" ${checked ? "checked" : ""} /><i></i></label>`;
}

function settingsView() {
  return `
    <section class="page-shell settings-shell">
      ${pageIntro("PREFERENCES & DATA", "Settings", "Make the battle yours and keep its source data healthy.")}
      <div class="settings-grid">
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
  const owner = data.players.find((player) => state.roster[player.id].team.includes(rikishi.id) || state.roster[player.id].subs.includes(rikishi.id));
  return `
    <div class="profile-hero">
      ${wrestlerImage(rikishi, "large")}
      <div><p class="eyebrow">${formatRank(rikishi)}</p><h2 id="profile-name">${rikishi.fullName || rikishi.name}</h2><p>${rikishi.stable} stable · ${rikishi.birthplace}</p><div class="profile-record"><strong>${rikishi.record}</strong><span>${rikishi.wins} wins<br />${rikishi.losses} losses</span></div></div>
      <div class="profile-owner"><small>FANTASY OWNER</small><span class="player-avatar ${owner?.color || "neutral"}">${owner?.initials || "—"}</span><b>${owner?.name || "Nobody"}</b></div>
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
    animateNumbers();
  }, state.reducedMotion ? 0 : 80);
}

function swapRoster(playerId, rikishiId, action) {
  const roster = state.roster[playerId];
  const from = action === "bench" ? roster.team : roster.subs;
  const to = action === "bench" ? roster.subs : roster.team;
  const counterpart = to[0];
  const index = from.indexOf(rikishiId);
  if (index < 0 || !counterpart) return;
  from.splice(index, 1, counterpart);
  to.splice(0, 1, rikishiId);
  saveState();
  render();
  showToast(`${getRikishi(rikishiId).name} ${action === "bench" ? "moved to substitutes" : "promoted to the starting team"}.`);
}

function bindViewEvents() {
  app.querySelectorAll("[data-profile]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target.closest("[data-swap]")) return;
      openProfile(element.dataset.profile);
    });
  });
  app.querySelectorAll("[data-swap]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    swapRoster(...button.dataset.swap.split(":"));
  }));
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
    const valid = data.players.every((player) => validateRoster(player.id).valid);
    if (valid) {
      saveState();
      playBell();
      showToast("Both legal drafts are saved on this device.");
    } else showToast("One roster still breaks the pick rules.");
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
    setTheme();
    render();
    showToast("Local preferences and draft were reset.");
  });
  app.querySelectorAll("[data-bonus]").forEach((button) => button.addEventListener("click", () => {
    state.bonusPrediction = button.dataset.bonus;
    saveState();
    render();
    showToast(`${state.bonusPrediction} saved as the 20-point bonus prediction.`);
  }));
  const search = document.querySelector("#banzuke-search");
  search?.addEventListener("input", () => {
    const term = search.value.toLowerCase().trim();
    document.querySelectorAll(".banzuke-rikishi").forEach((row) => {
      row.classList.toggle("search-hidden", Boolean(term) && !row.textContent.toLowerCase().includes(term));
    });
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

window.addEventListener("hashchange", render);
setTheme();
render();
