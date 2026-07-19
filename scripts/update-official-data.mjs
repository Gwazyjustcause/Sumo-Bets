import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const officialDir = path.join(root, "data", "official");
const draftDir = path.join(root, "data", "draft");
const scheduled = process.argv.includes("--scheduled");
const JSA_ORIGIN = "https://www.sumo.or.jp";
const headers = {
  "user-agent": "Mozilla/5.0 (compatible; SumoBattleUpdater/2.0; +https://github.com/)",
  "accept-language": "en-US,en;q=0.9",
  referer: `${JSA_ORIGIN}/EnHonbashoMain/`,
  "x-requested-with": "XMLHttpRequest",
};

const jsonFile = async (file, fallback = null) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`JSA request failed (${response.status}): ${url}`);
  const source = await response.text();
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`JSA returned non-JSON data for ${url}. Final URL: ${response.url}`);
  }
};

const fetchPostJson = (url, body) => fetchJson(url, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
  body: new URLSearchParams(body).toString(),
});

const writeAtomic = async (file, value) => {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, value, "utf8");
  await rename(temporary, file);
};

const writeJson = (file, value) => writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
const slugify = (value) => String(value || "rikishi")
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase() || "rikishi";
const numeric = (value) => Number.parseInt(value, 10) || 0;
const sideName = (value) => Number(value) === 1 ? "East" : "West";
const arrayify = (value) => Array.isArray(value) ? value : value ? [value] : [];
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : null;

const monthMetadata = {
  January: { slug: "hatsu", title: "Hatsu Basho" },
  March: { slug: "haru", title: "Haru Basho" },
  May: { slug: "natsu", title: "Natsu Basho" },
  July: { slug: "nagoya", title: "Nagoya Basho" },
  September: { slug: "aki", title: "Aki Basho" },
  November: { slug: "kyushu", title: "Kyushu Basho" },
};

const venueById = {
  1: "Ryogoku Kokugikan, Tokyo",
  2: "EDION Arena Osaka, Osaka",
  3: "IG Arena, Aichi",
  4: "Fukuoka Kokusai Center, Fukuoka",
};

function formatDateRange(start, end) {
  if (!start || !end) return "Dates awaiting confirmation";
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(last);
  return `${first.getUTCDate()}–${last.getUTCDate()} ${month} ${last.getUTCFullYear()}`;
}

function rankMetadata(entry) {
  const raw = String(entry.banzuke_name || "Unknown rank").replace("#", "").trim();
  const number = numeric(entry.number);
  if (/^Maegashira/i.test(raw)) return { rank: `Maegashira ${number}`, rankNumber: number };
  const rank = ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi"].find((name) => raw.toLowerCase().startsWith(name.toLowerCase())) || raw;
  return { rank, rankNumber: null };
}

function resultStatus(value) {
  const image = String(value?.result_image_new_en || value?.result_image || "");
  if (!image || image === "dummy.gif") return value?.opponent_rikishi_id ? "scheduled" : null;
  if (/result_ic03/.test(image)) return "win";
  if (/result_ic04/.test(image)) return "loss";
  if (/result_ic05/.test(image)) return "forfeit-win";
  if (/result_ic06/.test(image)) return "forfeit-loss";
  if (/result_ic07/.test(image)) return "absent";
  return "completed";
}

function completedResult(value) {
  return ["win", "loss", "forfeit-win", "forfeit-loss", "absent", "completed"].includes(resultStatus(value));
}

function sourceRikishi(person, idMap, priorByJsaId) {
  const jsaId = String(person.rikishi_id);
  const prior = priorByJsaId.get(jsaId) || {};
  const id = idMap[jsaId] || prior.id || slugify(person.shikona);
  idMap[jsaId] = id;
  const { rank, rankNumber } = rankMetadata(person);
  return {
    id,
    jsaId,
    rikishiId: numeric(person.rikishi_id),
    shikona: person.shikona,
    name: person.shikona,
    fullName: prior.fullName || person.shikona,
    rank,
    rankNumber,
    rankSeat: numeric(person.seat_order) || 1,
    side: sideName(person.ew),
    stable: person.heya_name || prior.stable || "Stable unavailable",
    birthplace: person.pref_name || prior.birthplace || "Birthplace unavailable",
    photoFile: person.photo || null,
    wikipedia: prior.wikipedia || null,
    sourceIndex: 0,
  };
}

function normalizeBout(raw, day, idByJsaId) {
  const eastJsaId = String(raw?.east?.rikishi_id || "");
  const westJsaId = String(raw?.west?.rikishi_id || "");
  const east = idByJsaId.get(eastJsaId) || `jsa-${eastJsaId}`;
  const west = idByJsaId.get(westJsaId) || `jsa-${westJsaId}`;
  const judge = numeric(raw?.judge);
  return {
    id: `${day}-${eastJsaId}-${westJsaId}`,
    day,
    east,
    west,
    eastJsaId,
    westJsaId,
    eastName: raw?.east?.shikona_eng || "Unknown rikishi",
    westName: raw?.west?.shikona_eng || "Unknown rikishi",
    completed: judge === 1 || judge === 2,
    winner: judge === 1 ? east : judge === 2 ? west : null,
    winnerJsaId: judge === 1 ? eastJsaId : judge === 2 ? westJsaId : null,
    technique: raw?.technic_name_eng || null,
    techniqueId: numeric(raw?.technic_id) || null,
    eastRecord: `${numeric(raw?.east?.won_number)}–${numeric(raw?.east?.lost_number)}${raw?.east?.rest_eng || ""}`,
    westRecord: `${numeric(raw?.west?.won_number)}–${numeric(raw?.west?.lost_number)}${raw?.west?.rest_eng || ""}`,
  };
}

function importanceForBout(bout, rankById) {
  const weights = { Yokozuna: 5, Ozeki: 4, Sekiwake: 3, Komusubi: 3 };
  return Math.max(weights[rankById.get(bout.east)] || 1, weights[rankById.get(bout.west)] || 1);
}

async function main() {
  await mkdir(officialDir, { recursive: true });
  await mkdir(draftDir, { recursive: true });

  const previousBasho = await jsonFile(path.join(officialDir, "basho.json"), null);
  if (scheduled && previousBasho?.basho) {
    const today = new Date();
    const start = new Date(`${previousBasho.basho.startDate}T00:00:00Z`);
    const end = new Date(`${previousBasho.basho.endDate}T23:59:59Z`);
    const active = today >= start && today <= end;
    const checked = new Date(previousBasho.generatedAt || 0);
    if (!active && Date.now() - checked.getTime() < 20 * 60 * 60 * 1000) {
      console.log("Outside an active basho; the daily snapshot is not due yet.");
      return;
    }
  }

  const [banzukeSource, recordSource] = await Promise.all([
    fetchJson(`${JSA_ORIGIN}/EnHonbashoBanzuke/indexAjax/1/1/`),
    fetchPostJson(`${JSA_ORIGIN}/EnHonbashoMain/hoshitoriAjax/1/1/`, { kakuzuke_id: 1, ew_flg: 1 }),
  ]);
  if (String(banzukeSource.Result) !== "1" || String(recordSource.Result) !== "1") {
    throw new Error("The JSA did not return a successful Makuuchi dataset.");
  }

  const officialRows = arrayify(banzukeSource.BanzukeTable);
  if (!officialRows.length) throw new Error("The official Makuuchi banzuke is empty.");
  const duplicateJsaIds = officialRows.filter((row, index) => officialRows.findIndex((other) => other.rikishi_id === row.rikishi_id) !== index);
  if (duplicateJsaIds.length) throw new Error(`Duplicate JSA rikishi IDs: ${duplicateJsaIds.map((row) => row.rikishi_id).join(", ")}`);

  const previousRikishi = await jsonFile(path.join(officialDir, "rikishi.json"), { rikishi: [] });
  const priorByJsaId = new Map((previousRikishi.rikishi || []).map((person) => [String(person.jsaId), person]));
  const idMap = await jsonFile(path.join(officialDir, "id-map.json"), {});
  const rikishiBase = officialRows.map((row, sourceIndex) => ({ ...sourceRikishi(row, idMap, priorByJsaId), sourceIndex }));
  const idByJsaId = new Map(rikishiBase.map((person) => [person.jsaId, person.id]));
  const rankById = new Map(rikishiBase.map((person) => [person.id, person.rank]));

  const recordsByJsaId = new Map();
  for (const side of ["E", "W"]) {
    for (const person of recordSource.BanzukeTable?.[side] || []) {
      const record = recordSource.TorikumiData?.[side]?.[person.rikishi_id];
      if (record) recordsByJsaId.set(String(person.rikishi_id), record);
    }
  }

  let completedDay = 0;
  let scheduledThroughDay = 0;
  for (const record of recordsByJsaId.values()) {
    for (let day = 1; day <= 15; day += 1) {
      if (completedResult(record[day])) completedDay = Math.max(completedDay, day);
      if (record[day]?.opponent_rikishi_id) scheduledThroughDay = Math.max(scheduledThroughDay, day);
    }
  }
  const fetchThroughDay = Math.min(15, Math.max(completedDay, scheduledThroughDay));
  const dayPayloads = await Promise.all(Array.from({ length: fetchThroughDay }, (_, index) => {
    const day = index + 1;
    return fetchPostJson(`${JSA_ORIGIN}/EnHonbashoMain/torikumiAjax/1/${day}/`, { kakuzuke_id: 1, day });
  }));
  const days = dayPayloads.map((payload, index) => {
    const day = index + 1;
    const rawBouts = [...arrayify(payload.TorikumiData), ...arrayify(payload.FinalMuch)];
    const seen = new Set();
    const bouts = rawBouts.map((raw) => normalizeBout(raw, day, idByJsaId)).filter((bout) => {
      if (!bout.eastJsaId || !bout.westJsaId || seen.has(bout.id)) return false;
      seen.add(bout.id);
      return true;
    });
    return {
      day,
      label: String(payload.dayHead || `Day ${day}`).replaceAll("&nbsp;", " "),
      completed: bouts.length > 0 && bouts.every((bout) => bout.completed),
      bouts,
    };
  });

  const allBouts = days.flatMap((day) => day.bouts);
  const completedBouts = allBouts.filter((bout) => bout.completed);
  const sideTotals = completedBouts.reduce((totals, bout) => {
    totals[bout.winner === bout.east ? "East" : "West"] += 1;
    return totals;
  }, { East: 0, West: 0 });
  const kinboshiById = new Map();
  for (const bout of completedBouts) {
    const winnerRank = rankById.get(bout.winner) || "";
    const loser = bout.winner === bout.east ? bout.west : bout.east;
    if (winnerRank.startsWith("Maegashira") && rankById.get(loser) === "Yokozuna") {
      kinboshiById.set(bout.winner, (kinboshiById.get(bout.winner) || 0) + 1);
    }
  }

  const rikishi = rikishiBase.map((person) => {
    const record = recordsByJsaId.get(person.jsaId) || {};
    const wins = numeric(record.won_number);
    const losses = numeric(record.lost_number);
    const absences = numeric(record.rest_number);
    const kinboshi = kinboshiById.get(person.id) || 0;
    const dailyResults = Array.from({ length: 15 }, (_, index) => {
      const day = index + 1;
      const result = record[day] || {};
      const dayStatus = resultStatus(result);
      return {
        day,
        opponentJsaId: result.opponent_rikishi_id ? String(result.opponent_rikishi_id) : null,
        opponentId: result.opponent_rikishi_id ? idByJsaId.get(String(result.opponent_rikishi_id)) || null : null,
        opponent: result.opponent_name_eng || null,
        completed: completedResult(result),
        status: dayStatus,
        result: ["win", "forfeit-win"].includes(dayStatus) ? "win" : ["loss", "forfeit-loss"].includes(dayStatus) ? "loss" : null,
        kyujo: ["forfeit-loss", "absent"].includes(dayStatus),
        techniqueId: numeric(result.technic_id) || null,
      };
    });
    const scheduledReturn = scheduledThroughDay > completedDay && Boolean(record[scheduledThroughDay]?.opponent_rikishi_id);
    const currentKyujo = dailyResults[Math.max(0, completedDay - 1)]?.kyujo === true && !scheduledReturn;
    const kyujoDays = dailyResults.filter((result) => result.kyujo).map((result) => result.day);
    const jsaPortrait = person.photoFile ? `${JSA_ORIGIN}/img/sumo_data/rikishi/270x474/${person.photoFile}` : null;
    return {
      ...person,
      record: `${wins}–${losses}${absences ? `–${absences}` : ""}`,
      wins,
      losses,
      absences,
      kyujoDays,
      currentKyujo,
      status: currentKyujo ? "Kyujo · injured / withdrawn" : absences ? "Returned from kyujo" : "Active",
      available: !currentKyujo,
      kinboshi,
      points: wins - (losses >= 8 ? 1 : 0) + (kinboshi * 3),
      dailyResults,
      jsaPortrait,
      photo: jsaPortrait,
      profile: `${JSA_ORIGIN}/EnSumoDataRikishi/profile/${person.jsaId}/`,
      image: null,
      height: "—",
      weight: "—",
      careerHigh: priorByJsaId.get(person.jsaId)?.careerHigh || person.rank,
      technique: "See official profile",
      form: Math.round((wins / Math.max(1, wins + losses)) * 100),
      badge: kinboshi ? `${kinboshi} kinboshi` : null,
    };
  });

  const bashoInfo = banzukeSource.BashoInfo || {};
  const year = String(bashoInfo.year_eng || new Date().getUTCFullYear());
  const month = bashoInfo.basho_name_eng || banzukeSource.basho_name || "Grand Sumo";
  const naming = monthMetadata[month] || { slug: slugify(month), title: `${month} Basho` };
  const bashoSlug = `${naming.slug}-${year}`;
  const generatedAt = new Date().toISOString();
  const startDate = isoDate(bashoInfo.start_date);
  const endDate = isoDate(bashoInfo.end_date);
  const latestDay = days.find((item) => item.day === completedDay);
  const lastUpdatedLabel = latestDay?.label || (completedDay ? `Day ${completedDay}` : "Banzuke published");

  const bashoCore = {
    schemaVersion: 1,
    source: `${JSA_ORIGIN}/EnHonbashoBanzuke/index/`,
    basho: {
      id: String(bashoInfo.basho_id || banzukeSource.basho_id),
      slug: bashoSlug,
      year: numeric(year),
      month,
      name: `${naming.title} ${year}`,
      shortName: `${month} ${year}`,
      japaneseName: `${bashoInfo.year_jp || ""} ${bashoInfo.basho_name || ""}`.trim(),
      startDate,
      endDate,
      dateRange: formatDateRange(startDate, endDate),
      venueId: numeric(bashoInfo.venue_id),
      venue: venueById[numeric(bashoInfo.venue_id)] || "Official venue",
      currentDay: completedDay,
      scheduledThroughDay,
      totalDays: 15,
      active: Boolean(bashoInfo.BattleNow),
    },
  };
  const banzukeCore = {
    schemaVersion: 1,
    bashoId: bashoCore.basho.id,
    bashoSlug,
    division: "Makuuchi",
    expectedRikishi: officialRows.length,
    source: `${JSA_ORIGIN}/EnHonbashoBanzuke/index/`,
    rikishi: rikishiBase,
  };
  const rikishiCore = {
    schemaVersion: 1,
    bashoId: bashoCore.basho.id,
    bashoSlug,
    source: `${JSA_ORIGIN}/EnHonbashoMain/hoshitori/1/1/`,
    rikishi,
  };
  const resultsCore = {
    schemaVersion: 1,
    bashoId: bashoCore.basho.id,
    bashoSlug,
    division: "Makuuchi",
    currentDay: completedDay,
    scheduledThroughDay,
    sideTotals,
    injuries: rikishi.filter((person) => person.currentKyujo).map((person) => ({ id: person.id, jsaId: person.jsaId, name: person.name, absences: person.absences, kyujoDays: person.kyujoDays, status: person.status })),
    source: `${JSA_ORIGIN}/EnHonbashoMain/torikumi/1/${Math.max(1, completedDay)}/`,
    days,
  };
  const signature = createHash("sha256").update(JSON.stringify({ bashoCore, banzukeCore, rikishiCore, resultsCore })).digest("hex");
  if (signature === previousBasho?.dataSignature) {
    console.log(`Official JSA data is unchanged (${signature.slice(0, 12)}).`);
    return;
  }

  const basho = { ...bashoCore, generatedAt, dataSignature: signature };
  const banzuke = { ...banzukeCore, generatedAt, dataSignature: signature };
  const rikishiData = { ...rikishiCore, generatedAt, dataSignature: signature };
  const results = { ...resultsCore, generatedAt, dataSignature: signature };
  const draftPlayers = await jsonFile(path.join(draftDir, "players.json"), { players: [] });
  const draftDefaults = await jsonFile(path.join(draftDir, "current-draft.json"), { drafts: {} });
  const draftHistory = await jsonFile(path.join(draftDir, "history.json"), { events: [] });
  const currentBouts = (days.find((item) => item.day === completedDay)?.bouts || [])
    .filter((bout) => bout.completed && idByJsaId.has(bout.eastJsaId) && idByJsaId.has(bout.westJsaId))
    .map((bout) => ({ ...bout, importance: importanceForBout(bout, rankById) }));
  const entries = rikishiBase.map(({ id: rikishiId, shikona, rank, rankNumber, rankSeat, side, sourceIndex }) => ({ rikishiId, shikona, rank, rankNumber, rankSeat, side, sourceIndex }));
  const officialRikishi = rikishiBase.map(({ id, shikona, rank, rankNumber, rankSeat, side, sourceIndex }) => ({ id, shikona, rank, rankNumber, rankSeat, side, sourceIndex }));
  const bundle = {
    meta: {
      bashoId: bashoCore.basho.id,
      dataSignature: signature,
      tournament: bashoCore.basho.name,
      shortTournament: bashoCore.basho.shortName,
      day: completedDay,
      scheduledThroughDay,
      totalDays: 15,
      dateRange: bashoCore.basho.dateRange,
      venue: bashoCore.basho.venue,
      lastUpdated: `${lastUpdatedLabel} · official snapshot ${generatedAt.slice(0, 16).replace("T", " ")} UTC`,
      status: completedDay ? `Day ${completedDay} official results` : "Banzuke published · draft open",
      active: bashoCore.basho.active,
      sideTotals,
      sources: [
        { label: "Official Makuuchi banzuke", url: banzukeCore.source },
        { label: "Official matches & results", url: resultsCore.source },
        { label: "Official tournament records", url: rikishiCore.source },
        { label: "Official rikishi profiles", url: `${JSA_ORIGIN}/EnSumoDataRikishi/search/` },
      ],
    },
    scoring: [
      { label: "Win (kachi)", value: "1 pt" },
      { label: "Make-koshi", value: "−1 pt" },
      { label: "Kinboshi", value: "3 pts" },
      { label: "Correct side", value: "20 pts" },
    ],
    players: draftPlayers.players || [],
    rikishi,
    bouts: currentBouts,
    results,
    history: draftHistory.events || [],
    draftDefaults,
    banzuke: {
      currentBashoId: bashoSlug,
      bashos: [{
        id: bashoSlug,
        officialId: bashoCore.basho.id,
        label: bashoCore.basho.shortName,
        tournament: `${month} Grand Sumo Tournament`,
        japaneseTitle: bashoCore.basho.japaneseName,
        division: "Makuuchi",
        expectedRikishi: officialRows.length,
        officialUrl: banzukeCore.source,
        officialRikishi,
        entries,
      }],
    },
  };
  const diagnostics = `\n\n(() => {\n  const debug = window.SUMO_DEBUG === true || ["localhost", "127.0.0.1"].includes(window.location?.hostname);\n  const official = window.SUMO_DATA.banzuke.bashos[0].officialRikishi;\n  const parsed = window.SUMO_DATA.rikishi;\n  const counts = new Map(parsed.map((person) => [person.id, (parsed.filter((item) => item.id === person.id)).length]));\n  for (const person of official) {\n    const count = counts.get(person.id) || 0;\n    if (debug) console.info(\`Rank: \${person.rank}\\nSide: \${person.side}\\nName: \${person.shikona}\\nStatus: Parsed ✓\`);\n    if (count !== 1) console.error(count ? \`WARNING\\n\\n\${person.shikona}\\n\\nParsed \${count} times; expected exactly once.\` : \`WARNING\\n\\n\${person.shikona}\\n\\nNot parsed\`);\n  }\n})();\n`;

  await Promise.all([
    writeJson(path.join(officialDir, "basho.json"), basho),
    writeJson(path.join(officialDir, "banzuke.json"), banzuke),
    writeJson(path.join(officialDir, "rikishi.json"), rikishiData),
    writeJson(path.join(officialDir, "results.json"), results),
    writeJson(path.join(officialDir, "id-map.json"), idMap),
    writeAtomic(path.join(root, "data", "sumo-data.js"), `// Generated from data/official/*.json. Do not hand-edit official facts.\nwindow.SUMO_DATA = ${JSON.stringify(bundle, null, 2)};${diagnostics}`),
  ]);
  console.log(`Updated ${rikishi.length} Makuuchi rikishi and ${completedBouts.length} completed bouts through Day ${completedDay}.`);
  console.log(`Official data signature: ${signature}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
