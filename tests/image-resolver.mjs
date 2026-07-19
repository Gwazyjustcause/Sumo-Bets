import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../image-resolver.js", import.meta.url), "utf8");

function createResolver({ succeeds = () => false, wikipediaImage = null, storage = new Map() } = {}) {
  const attempts = [];
  const fetchCalls = [];
  const warnings = [];

  class MockImage {
    set src(value) {
      this._src = value;
      attempts.push(value);
      setTimeout(() => {
        if (succeeds(value)) {
          this.naturalWidth = 1200;
          this.width = 1200;
          this.onload?.();
        } else this.onerror?.();
      }, 0);
    }
    get src() { return this._src; }
  }

  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const fetch = async (url) => {
    fetchCalls.push(String(url));
    const isCommons = String(url).includes("commons.wikimedia.org");
    const payload = wikipediaImage && !isCommons
      ? { query: { pages: [{ title: "Rikishi", original: { source: wikipediaImage, width: 1600, height: 2200 } }] } }
      : { query: { pages: [] } };
    return { ok: true, json: async () => payload };
  };
  const context = vm.createContext({
    window: {},
    document: { baseURI: "http://localhost/", querySelectorAll: () => [] },
    localStorage,
    Image: MockImage,
    fetch,
    console: { warn: (message) => warnings.push(message) },
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    Date,
  });
  vm.runInContext(source, context, { filename: "image-resolver.js" });
  return { resolver: context.window.RIKISHI_IMAGES, attempts, fetchCalls, warnings, storage };
}

const baseRikishi = {
  id: "onosato",
  name: "Onosato",
  shikona: "Onosato",
  jsaId: "4227",
  jsaPortrait: "https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/20230048.jpg",
  wikipedia: "Ōnosato Daiki",
};

{
  const test = createResolver({ succeeds: (url) => url.endsWith("/assets/rikishi/onosato.webp") });
  const [result, duplicate] = await Promise.all([test.resolver.resolve(baseRikishi), test.resolver.resolve(baseRikishi)]);
  assert.equal(result.source, "local", "A local WebP must win immediately");
  assert.equal(duplicate.url, result.url, "Duplicate cards must share one in-flight resolution");
  assert.equal(test.attempts.length, 1, "No remote source may run after a local hit");
  assert.equal(test.fetchCalls.length, 0, "Local hits must not query Wikipedia");
}

{
  const test = createResolver({ succeeds: (url) => url === baseRikishi.jsaPortrait });
  const result = await test.resolver.resolve(baseRikishi);
  assert.equal(result.source, "jsa", "JSA must be used after a local miss");
  assert.deepEqual(test.attempts, ["http://localhost/assets/rikishi/onosato.webp", baseRikishi.jsaPortrait]);
  assert.equal(test.fetchCalls.length, 0, "A valid JSA portrait must prevent Wikipedia lookup");
}

{
  const sharedStorage = new Map();
  const wikiUrl = "https://upload.wikimedia.org/wikipedia/commons/example/onosato.jpg";
  const first = createResolver({ succeeds: (url) => url === wikiUrl, wikipediaImage: wikiUrl, storage: sharedStorage });
  const firstResult = await first.resolver.resolve(baseRikishi);
  assert.equal(firstResult.source, "wikipedia", "Wikipedia must be used after local and JSA failures");
  assert.equal(first.fetchCalls.length, 1, "An exact mapped Wikipedia page should be queried first");

  const revisit = createResolver({ succeeds: (url) => url === wikiUrl, storage: sharedStorage });
  const revisitResult = await revisit.resolver.resolve(baseRikishi);
  assert.equal(revisitResult.source, "wikipedia", "The persisted Wikipedia result must be reused");
  assert.equal(revisit.fetchCalls.length, 0, "A cached Wikipedia URL must avoid another API lookup");
}

{
  const test = createResolver();
  const result = await test.resolver.resolve(baseRikishi);
  assert.equal(result.source, "placeholder", "The silhouette is the final fallback");
  assert.equal(test.fetchCalls.length, 3, "Wikipedia article, search, and Commons stages must all be attempted");
  assert.equal(test.warnings.length, 1, "A complete missing-image report must be printed once");
  for (const text of ["Image missing:", "Onosato", "✗ Local", "✗ JSA", "✗ Wikipedia", "Using placeholder."]) {
    assert(test.warnings[0].includes(text), `Missing-image report must include: ${text}`);
  }
}

console.log("Image resolver checks passed: local, JSA, Wikipedia cache, and silhouette fallback.");
