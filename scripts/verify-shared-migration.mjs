import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const [endpoint, snapshot] = process.argv.slice(2);
if (!endpoint || !snapshot) throw new Error("Usage: node scripts/verify-shared-migration.mjs WORKER_URL BACKUP_JSON");
const rows = JSON.parse(readFileSync(snapshot, "utf8"));
assert(rows.length > 0, "Migration snapshot must not be empty");
for (const row of rows) {
  const url = `${endpoint.replace(/\/$/, "")}/drafts/${encodeURIComponent(row.basho_id)}`;
  const response = await fetch(url, { headers: { Origin: "https://gwazyjustcause.github.io" }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://gwazyjustcause.github.io");
  const actual = await response.json();
  assert.deepEqual(actual, row, "Copied document or revision differs from the source snapshot");
  const stale = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Origin: "https://gwazyjustcause.github.io" },
    body: JSON.stringify({ document: { ...row.document, bashoId: row.basho_id }, expectedRevision: row.revision - 1 }), signal: AbortSignal.timeout(30000) });
  assert.equal(stale.status, 409, "A stale save must be rejected without changing the copied game");
  assert.deepEqual(await (await fetch(url)).json(), row, "Stale-save verification must leave the game unchanged");
}
console.log(`Verified ${rows.length} documents: exact source match, CORS, and stale-write protection. No game documents changed.`);
