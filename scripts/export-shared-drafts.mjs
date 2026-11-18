import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import vm from "node:vm";

// Read-only export: never changes or deletes the source database.
const root = new URL("../", import.meta.url);
const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("supabase-config.js", root), "utf8"), context);
const { url, anonKey, table } = context.window.SUMO_SHARED_DRAFT_CONFIG;
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.search = new URLSearchParams({ select: "basho_id,revision,document", order: "basho_id.asc", offset: String(offset), limit: "1000" });
  const response = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Export failed (${response.status}); source data was not changed.`);
  const page = await response.json();
  if (!Array.isArray(page)) throw new Error("Invalid export response.");
  rows.push(...page);
  if (page.length < 1000) break;
}
if (!rows.length) throw new Error("No shared documents found. Refusing to create an empty migration.");
const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
for (const row of rows) {
  if (!row.basho_id || !Number.isSafeInteger(row.revision) || row.revision < 1 || !row.document) throw new Error("Invalid shared document in export.");
}
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const folder = new URL(`backups/${stamp}/`, root);
mkdirSync(folder, { recursive: true });
writeFileSync(new URL("shared-drafts.json", folder), JSON.stringify(rows, null, 2) + "\n");
// Plain INSERT intentionally refuses to overwrite any existing destination row.
writeFileSync(new URL("import.sql", folder), rows.map((row) =>
  `INSERT INTO shared_drafts (basho_id, revision, document) VALUES (${quote(row.basho_id)}, ${row.revision}, ${quote(JSON.stringify(row.document))});`).join("\n") + "\n");
console.log(`Exported ${rows.length} shared documents to ${folder.pathname}. Keep this snapshot private.`);
