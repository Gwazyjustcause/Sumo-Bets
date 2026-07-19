import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { TextDecoder, TextEncoder } from "node:util";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("shared-draft.js", root), "utf8");
const session = new Map();
const requests = [];
let responseFactory;

const sessionStorage = {
  getItem: (key) => session.get(key) || null,
  setItem: (key, value) => session.set(key, value),
  removeItem: (key) => session.delete(key),
};
const fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  return responseFactory(url, options);
};
const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const context = vm.createContext({
  window: {},
  sessionStorage,
  fetch,
  TextEncoder,
  TextDecoder,
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
});
vm.runInContext(source, context, { filename: "shared-draft.js" });

const document = {
  schemaVersion: 3,
  bashoId: "nagoya-2026",
  revision: 4,
  locked: false,
  lastSavedAt: "2026-07-19T14:32:00.000Z",
  savedBy: "Gwazy",
  players: {},
};
responseFactory = () => response(200, {
  sha: "source-sha",
  content: Buffer.from(JSON.stringify(document)).toString("base64"),
});
const loaded = await context.window.SHARED_DRAFT_API.load();
assert.deepEqual(JSON.parse(JSON.stringify(loaded.document)), document, "The repository document must decode without mutation");
assert.equal(loaded.sha, "source-sha", "Loading must retain the GitHub blob SHA for optimistic writes");
assert(requests[0].url.includes("api.github.com/repos/Gwazyjustcause/Sumo-Bets/contents/data/draft/current-draft.json"), "The shared source must be the configured repository JSON file");

context.window.SHARED_DRAFT_API.setToken("  test-session-token  ");
assert.equal(session.get("sumoBattleGitHubWriteToken"), "test-session-token", "The write token must be scoped to sessionStorage");
responseFactory = () => response(200, { content: { sha: "saved-sha" } });
const saved = await context.window.SHARED_DRAFT_API.save({ ...document, revision: 5, savedBy: "Jake" }, "source-sha");
assert.equal(saved.sha, "saved-sha", "A successful save must expose the new repository SHA");
const put = requests.at(-1);
assert.equal(put.options.method, "PUT", "Saving must use the GitHub Contents API update operation");
assert.equal(put.options.headers.Authorization, "Bearer test-session-token", "Authenticated writes must use the session-only token");
const body = JSON.parse(put.options.body);
assert.equal(body.sha, "source-sha", "Saving must include the previously loaded SHA to prevent blind overwrites");
assert.equal(JSON.parse(Buffer.from(body.content, "base64").toString("utf8")).revision, 5, "The committed content must be the new shared revision");

responseFactory = () => response(409, {});
await assert.rejects(
  context.window.SHARED_DRAFT_API.save({ ...document, revision: 6 }, "stale-sha"),
  /changed on another device/,
  "A stale shared write must fail loudly instead of overwriting another player's save",
);

console.log("Shared draft transport checks passed: load, session credentials, optimistic save, and conflict rejection.");
