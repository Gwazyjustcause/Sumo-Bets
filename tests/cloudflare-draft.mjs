import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import worker from "../cloudflare/worker.mjs";

const sql = new DatabaseSync(":memory:");
sql.exec(readFileSync(new URL("../cloudflare/schema.sql", import.meta.url), "utf8"));
const env = {
  ALLOWED_ORIGINS: "https://gwazyjustcause.github.io",
  DB: { prepare(query) { return { bind(...values) { return { async first() { return sql.prepare(query).get(...values) || null; } }; } }; } },
};
const headers = { Origin: "https://gwazyjustcause.github.io", "Content-Type": "application/json" };
const call = (id, method = "GET", body) => worker.fetch(new Request(`https://shared.example/drafts/${id}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
assert.equal(await (await call("638")).json(), null);
const document = { bashoId: "638", players: { gwazy: { mainPicks: ["hakunofuji"] } } };
const attempts = await Promise.all([call("638", "PUT", { document, expectedRevision: 0 }), call("638", "PUT", { document, expectedRevision: 0 })]);
assert.deepEqual(attempts.map((response) => response.status).sort(), [200, 409], "Concurrent first saves must not overwrite each other");
const updates = await Promise.all([call("638", "PUT", { document, expectedRevision: 1 }), call("638", "PUT", { document, expectedRevision: 1 })]);
assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
assert.equal((await (await call("638")).json()).revision, 2);
assert.equal((await call("638", "PUT", { document, expectedRevision: -1 })).status, 400);
assert.equal((await call("different", "PUT", { document, expectedRevision: 0 })).status, 400);
assert.equal((await worker.fetch(new Request("https://shared.example/drafts/638", { headers: { Origin: "https://other.example" } }), env)).status, 403);
assert.equal((await call("638", "OPTIONS")).status, 204);
assert.equal((await call("638")).headers.get("Access-Control-Allow-Origin"), headers.Origin);

const timers = new Map();
let timerId = 0;
const page = { hidden: false };
let requestCount = 0;
const context = vm.createContext({ URL, AbortSignal, document: page, setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); },
  fetch: (url, options) => { requestCount += 1; return worker.fetch(new Request(url, { ...options, headers: { ...headers, ...options.headers } }), env); },
  window: { SUMO_SHARED_DRAFT_CONFIG: { provider: "cloudflare", url: "https://shared.example", pollMs: 15000 } },
});
vm.runInContext(readFileSync(new URL("../cloudflare-draft.js", import.meta.url), "utf8"), context);
const api = context.window.SHARED_DRAFT_API;
assert.equal(api.configured(), true);
assert.equal((await api.load("new")).revision, 0);
assert.equal((await api.load("638")).document.players.gwazy.mainPicks[0], "hakunofuji");
await assert.rejects(api.save(document, 1), (error) => error.status === 409);
assert.equal((await api.save(document, 2)).revision, 3);
let received;
const stop = api.subscribe("638", (value) => { received = value; });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(received.revision, 3);
assert.equal(timers.size, 1);
await api.save(document, 3);
const poll = [...timers.values()][0];
timers.clear();
await poll();
assert.equal(received.revision, 4);
page.hidden = true;
const previousCount = requestCount;
const hiddenPoll = [...timers.values()][0];
timers.clear();
await hiddenPoll();
assert.equal(requestCount, previousCount, "Hidden tabs must not spend requests polling");
stop();
assert.equal(timers.size, 0);
console.log("Cloudflare checks passed: SQLite conflict protection, CORS, validation, browser saves and polling.");
