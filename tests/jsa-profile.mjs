import assert from "node:assert/strict";
import { hasUsefulProfile, jsaProfileUrl, parseBashoRecords, parseJsaProfile, profileRefreshDue, summarizeBashoForm } from "../scripts/jsa-profile.mjs";

const html = `
  <div class="mdSection1">
    <table class="mdTable2"><tbody>
      <tr><td colspan="2" class="fntXL">Onosato Daiki</td></tr>
      <tr><th>Stable</th><td><a href="/stable">Nishonoseki</a></td></tr>
      <tr><th>Name</th><td>Daiki Nakamura</td></tr>
      <tr><th>Birthday</th><td>June 7, 2000</td></tr>
      <tr><th>Birthplace</th><td>Ishikawa</td></tr>
      <tr><th>Height</th><td>192.0cm</td></tr>
      <tr><th>Weight</th><td>189.0kg</td></tr>
      <tr><th>Signature Maneuver</th><td>tsuki, oshi, migi-yotsu, yori</td></tr>
    </tbody></table>
    <img src="/img/sumo_data/rikishi/270x474/20230048.jpg" />
    <dl><dt>Highest Rank</dt><dd>Yokozuna</dd></dl>
    <table id="ew_table"><tbody>
      ${[
        ["2026 September", "0-0"], ["2026 July", "9-6"], ["2026 May", "0-0-15"],
        ["2026 March", "0-4-11"], ["2026 January", "10-5"], ["2025 November", "11-4"],
        ["2025 September", "13-2"], ["2025 July", "11-4"],
      ].map(([basho, record]) => `<tr><td class="player bBnone"><div class="box"><span>${basho}</span><span>Yokozuna</span><span>Onosato Daiki</span><span>${record}</span><span></span></div></td></tr>`).join("")}
    </tbody></table>
  </div>`;

const url = jsaProfileUrl("https://www.sumo.or.jp", "4227");
const parsed = parseJsaProfile(html, { jsaId: "4227", requestedUrl: url, finalUrl: url, excludeBashoLabel: "2026 September" });
assert.equal(url, "https://www.sumo.or.jp/EnSumoDataRikishi/profile/4227/");
assert.equal(parsed.fullName, "Onosato Daiki");
assert.equal(parsed.height, "192.0cm");
assert.equal(parsed.weight, "189.0kg");
assert.equal(parsed.technique, "tsuki, oshi, migi-yotsu, yori");
assert.equal(parsed.careerHigh, "Yokozuna");
assert.equal(parsed.jsaPortrait, "https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/20230048.jpg");
assert.equal(parsed.profileVerified, true);
assert.equal(parsed.recentForm.bashos, 6);
assert.equal(parsed.recentForm.wins, 43);
assert.equal(parsed.recentForm.losses, 21);
assert.equal(parsed.recentForm.absences, 26);
assert.equal(parsed.recentForm.percentage, 67);
assert.equal(parseBashoRecords(html, { excludeBashoLabel: "2026 September", limit: 6 }).length, 6);
assert.equal(summarizeBashoForm([{ wins: 3, losses: 2, absences: 10 }]).percentage, 60);
assert.equal(hasUsefulProfile(parsed), true);
assert.equal(profileRefreshDue({ ...parsed, profileUpdatedAt: new Date().toISOString() }), false);
assert.equal(profileRefreshDue({ ...parsed, profileUpdatedAt: "2020-01-01T00:00:00.000Z" }), true);

console.log("JSA profile parser checks passed: canonical URL, measurements, signature maneuver, and career high.");
