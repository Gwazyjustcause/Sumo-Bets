// Opt-in, read-only integration check against the configured live backend.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const load = (path) => readFileSync(new URL(path, root), "utf8");
const prelude = load("tests/runtime-smoke.mjs").split('vm.runInContext(load("data/sumo-data.js")')[0]
  .replace(/^import .*;\r?\n/gm, "").replace('new URL("../", import.meta.url)', "fixtureRoot");
const browsers = [];
try {
  for (let index = 0; index < 2; index += 1) {
    const scope = vm.createContext({ assert, readFileSync, performance, vm, console, setTimeout, clearTimeout, fixtureRoot: root });
    vm.runInContext(prelude + "\nglobalThis.harness={context,app,browserConsole};", scope);
    const { context, app, browserConsole } = scope.harness;
    Object.assign(context, { URL, AbortSignal, fetch: (url, options = {}) => {
      assert.equal(options.method || "GET", "GET", "Integration verification must never write game data");
      return fetch(url, options);
    } });
    browsers.push(context);
    for (const file of ["data/sumo-data.js", "image-resolver.js", "shared-config.js", "cloudflare-draft.js", "app.js"]) vm.runInContext(load(file), context, { filename: file });
    const deadline = Date.now() + 20000;
    while (vm.runInContext("sharedDraftLoading", context) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(vm.runInContext("sharedDraftLoading", context), false);
    assert.equal(vm.runInContext("sharedDraftError", context), null);
    assert.equal(vm.runInContext("getRoster('gwazy').team.length", context), 6);
    assert.equal(vm.runInContext("getRoster('jake').team.length", context), 6);
    assert(app.innerHTML.length > 1000);
    assert.equal(browserConsole.errors.length, 0, browserConsole.errors.join(" | "));
    vm.runInContext("state.spoilerFree=false; render()", context);
    assert.equal(vm.runInContext("countedPointsForRikishi('gwazy','hakunofuji')", context), vm.runInContext("pointsThroughDay(getRikishi('hakunofuji'))", context));
  }
  assert.equal(vm.runInContext("JSON.stringify(savedSharedDraft)", browsers[0]), vm.runInContext("JSON.stringify(savedSharedDraft)", browsers[1]));
  console.log("Live integration passed: two independent app instances loaded matching full rosters; replacement points include earlier wins. No writes made.");
} finally {
  for (const context of browsers) vm.runInContext("stopSharedDraftSubscription?.();stopLifecycleSubscription?.();", context);
}
