import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("shared-draft.js", root), "utf8");
const calls = [];
let queryResult;
let rpcResult;
let realtimeHandler;
let removedChannel = null;

const client = {
  from(table) {
    calls.push({ type: "from", table });
    return {
      select(columns) {
        calls.push({ type: "select", columns });
        return {
          eq(column, value) {
            calls.push({ type: "eq", column, value });
            return { maybeSingle: async () => queryResult };
          },
        };
      },
    };
  },
  async rpc(name, parameters) {
    calls.push({ type: "rpc", name, parameters });
    return rpcResult;
  },
  channel(name) {
    const channel = {
      name,
      on(event, options, handler) {
        calls.push({ type: "channel", event, options });
        realtimeHandler = handler;
        return channel;
      },
      subscribe() { return channel; },
    };
    return channel;
  },
  removeChannel(channel) { removedChannel = channel; },
};

const context = vm.createContext({
  URL,
  window: {
    SUMO_SHARED_DRAFT_CONFIG: {
      url: "https://example.supabase.co",
      anonKey: "public-anon-key",
      table: "shared_drafts",
      saveFunction: "save_shared_draft",
    },
    supabase: {
      createClient(url, key, options) {
        calls.push({ type: "createClient", url, key, options });
        return client;
      },
    },
  },
});
vm.runInContext(source, context, { filename: "shared-draft.js" });
assert.deepEqual(JSON.parse(JSON.stringify(context.window.SHARED_DRAFT_API.setupStatus())), {
  ready: true,
  missing: [],
  message: "Supabase configuration is ready.",
}, "The setup check must report a complete browser configuration");

const document = {
  schemaVersion: 3,
  bashoId: "nagoya-2026",
  revision: 4,
  locked: false,
  lastSavedAt: "2026-07-19T14:32:00.000Z",
  savedBy: "Gwazy",
  players: {},
};
queryResult = { data: { basho_id: "nagoya-2026", revision: 4, document }, error: null };
const loaded = await context.window.SHARED_DRAFT_API.load("nagoya-2026");
assert.deepEqual(JSON.parse(JSON.stringify(loaded.document)), document, "The Supabase document must load without mutation");
assert.equal(loaded.revision, 4, "Loading must expose the database revision for optimistic writes");
assert(calls.some((call) => call.type === "eq" && call.column === "basho_id" && call.value === "nagoya-2026"), "Draft reads must be scoped to one basho row");
assert.equal(calls.find((call) => call.type === "createClient").key, "public-anon-key", "The browser must use the public Supabase key, not a personal token");

queryResult = { data: null, error: null };
const empty = await context.window.SHARED_DRAFT_API.load("new-basho");
assert.equal(empty.revision, 0, "A basho without a row must start at revision zero");
assert.deepEqual(JSON.parse(JSON.stringify(empty.document.players.gwazy.mainPicks)), [], "A new Supabase draft must start empty");

rpcResult = { data: [{ basho_id: "nagoya-2026", revision: 5, document: { ...document, revision: 5, savedBy: "Jake" } }], error: null };
const saved = await context.window.SHARED_DRAFT_API.save({ ...document, revision: 5, savedBy: "Jake" }, 4);
assert.equal(saved.revision, 5, "A successful atomic save must expose the database revision");
const rpc = calls.find((call) => call.type === "rpc");
assert.equal(rpc.name, "save_shared_draft", "Saving must use the conflict-safe database function");
assert.equal(rpc.parameters.p_expected_revision, 4, "Saving must include the previously loaded revision");
assert.equal(rpc.parameters.p_document.savedBy, "Jake", "The database function must receive the staged shared document");

rpcResult = { data: null, error: { code: "40001", message: "STALE_DRAFT_REVISION" } };
await assert.rejects(
  context.window.SHARED_DRAFT_API.save({ ...document, revision: 6 }, 4),
  /changed on another device/,
  "A stale Supabase write must fail loudly instead of overwriting another player's save",
);

let realtimeResult = null;
const unsubscribe = context.window.SHARED_DRAFT_API.subscribe("nagoya-2026", (result) => { realtimeResult = result; });
realtimeHandler({ new: { basho_id: "nagoya-2026", revision: 6, document: { ...document, revision: 6 } } });
assert.equal(realtimeResult.revision, 6, "Realtime database changes must be forwarded to the application");
unsubscribe();
assert(removedChannel, "Unsubscribing must release the Supabase realtime channel");

assert.equal(context.window.SHARED_DRAFT_API.token, undefined, "The transport must not expose a personal-token API");

const incompleteContext = vm.createContext({
  URL,
  window: {
    SUMO_SHARED_DRAFT_CONFIG: {
      url: "https://YOUR_PROJECT.supabase.co",
      anonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
    },
    supabase: { createClient() {} },
  },
});
vm.runInContext(source, incompleteContext, { filename: "shared-draft.js" });
const incomplete = JSON.parse(JSON.stringify(incompleteContext.window.SHARED_DRAFT_API.setupStatus()));
assert.deepEqual(incomplete.missing, ["Project URL", "Publishable Key"], "The setup check must name every missing configuration value");
await assert.rejects(
  incompleteContext.window.SHARED_DRAFT_API.load("nagoya-2026"),
  /Missing: Project URL, Publishable Key/,
  "An incomplete setup must fail with actionable field names",
);

const wrongHostContext = vm.createContext({
  URL,
  window: {
    SUMO_SHARED_DRAFT_CONFIG: {
      url: "https://gwazyjustcause.github.io/Sumo-Bets",
      anonKey: "sb_publishable_example",
    },
    supabase: { createClient() {} },
  },
});
vm.runInContext(source, wrongHostContext, { filename: "shared-draft.js" });
assert.deepEqual(
  JSON.parse(JSON.stringify(wrongHostContext.window.SHARED_DRAFT_API.setupStatus().missing)),
  ["Supabase Project URL (the current value is the GitHub Pages URL)"],
  "The setup check must identify a GitHub Pages URL before making a database request",
);
console.log("Shared draft transport checks passed: Supabase load, atomic revision save, realtime sync, and conflict rejection.");
