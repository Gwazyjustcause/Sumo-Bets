const EMPTY_VALUES = new Set(["", "—", "-", "See official profile", "Unavailable"]);

export function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plainText(value = "") {
  return decodeHtml(String(value).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tableValue(html, label) {
  const match = String(html).match(new RegExp(`<th[^>]*>\\s*${escapePattern(label)}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`, "i"));
  return plainText(match?.[1]);
}

function definitionValue(html, label) {
  const match = String(html).match(new RegExp(`<dt[^>]*>\\s*${escapePattern(label)}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`, "i"));
  return plainText(match?.[1]);
}

export function parseBashoRecords(html, { excludeBashoLabel = null, limit = 6 } = {}) {
  const records = [];
  const cells = String(html).matchAll(/<td[^>]*class=["'][^"']*\bplayer\b[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*\bbox\b[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/td>/gi);
  for (const cell of cells) {
    const values = [...cell[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((match) => plainText(match[1]));
    const basho = values[0] || "";
    const recordMatch = (values[3] || "").match(/^(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?$/);
    if (!recordMatch || (excludeBashoLabel && basho.toLowerCase() === excludeBashoLabel.toLowerCase())) continue;
    const wins = Number(recordMatch[1]);
    const losses = Number(recordMatch[2]);
    const absences = Number(recordMatch[3] || 0);
    if (wins + losses + absences === 0) continue;
    records.push({ basho, rank: values[1] || "", shikona: values[2] || "", record: values[3], wins, losses, absences });
    if (records.length === limit) break;
  }
  return records;
}

export function summarizeBashoForm(records = []) {
  const totals = records.reduce((result, record) => ({
    wins: result.wins + record.wins,
    losses: result.losses + record.losses,
    absences: result.absences + record.absences,
  }), { wins: 0, losses: 0, absences: 0 });
  const contested = totals.wins + totals.losses;
  return {
    percentage: contested ? Math.round((totals.wins / contested) * 100) : null,
    ...totals,
    bashos: records.length,
    records,
  };
}

export function jsaProfileUrl(origin, jsaId) {
  return new URL(`/EnSumoDataRikishi/profile/${encodeURIComponent(String(jsaId))}/`, origin).toString();
}

export function parseJsaProfile(html, { jsaId, requestedUrl, finalUrl = requestedUrl, excludeBashoLabel = null } = {}) {
  const source = String(html || "");
  const fullNameMatch = source.match(/<td[^>]*class=["'][^"']*fntXL[^"']*["'][^>]*>([\s\S]*?)<\/td>/i);
  const portraitMatch = source.match(/<img[^>]+src=["']([^"']*\/img\/sumo_data\/rikishi\/[^"']+)["'][^>]*>/i);
  const profile = finalUrl || requestedUrl || null;
  const origin = profile ? new URL(profile).origin : null;
  const portraitPath = portraitMatch?.[1] ? decodeHtml(portraitMatch[1]) : null;
  const recentForm = summarizeBashoForm(parseBashoRecords(source, { excludeBashoLabel, limit: 6 }));
  return {
    jsaId: String(jsaId || ""),
    fullName: plainText(fullNameMatch?.[1]),
    birthName: tableValue(source, "Name"),
    birthday: tableValue(source, "Birthday"),
    birthplace: tableValue(source, "Birthplace"),
    stable: tableValue(source, "Stable"),
    height: tableValue(source, "Height"),
    weight: tableValue(source, "Weight"),
    technique: tableValue(source, "Signature Maneuver"),
    careerHigh: definitionValue(source, "Highest Rank"),
    recentForm,
    form: recentForm.percentage,
    profile,
    profileVerified: Boolean(profile && /\/EnSumoDataRikishi\/profile\/\d+\/?$/i.test(new URL(profile).pathname)),
    jsaPortrait: portraitPath && origin ? new URL(portraitPath, origin).toString() : null,
  };
}

export function hasUsefulProfile(profile = {}) {
  return [profile.height, profile.weight, profile.technique].every((value) => !EMPTY_VALUES.has(String(value || "").trim()))
    && profile.profileVerified === true
    && Number.isFinite(profile.recentForm?.percentage);
}

export function profileRefreshDue(profile = {}, now = Date.now(), maxAgeDays = 7) {
  if (!hasUsefulProfile(profile)) return true;
  const updated = Date.parse(profile.profileUpdatedAt || "");
  return !Number.isFinite(updated) || now - updated >= maxAgeDays * 24 * 60 * 60 * 1000;
}

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
