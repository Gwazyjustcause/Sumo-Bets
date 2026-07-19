/* global SUMO_DATA */

(() => {
  const CACHE_KEY = "sumoBattleRikishiImageCache:v1";
  const PLACEHOLDER_PATH = "assets/rikishi-placeholder.svg";
  const SUCCESS_MAX_AGE = 1000 * 60 * 60 * 24 * 180;
  const MISSING_MAX_AGE = 1000 * 60 * 60 * 24;
  const resolutionById = new Map();
  let observer = null;

  function absoluteUrl(path) {
    return new URL(path, document.baseURI).href;
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function writeCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // The resolver still works when storage is disabled; it just cannot persist.
    }
  }

  function cachedResult(id) {
    const cache = readCache();
    const entry = cache[id];
    if (!entry?.url || !entry.source || !entry.resolvedAt) return null;
    const maxAge = entry.source === "placeholder" ? MISSING_MAX_AGE : SUCCESS_MAX_AGE;
    if (Date.now() - entry.resolvedAt > maxAge) {
      delete cache[id];
      writeCache(cache);
      return null;
    }
    return entry;
  }

  function remember(id, result) {
    const cache = readCache();
    cache[id] = { ...result, resolvedAt: Date.now() };
    writeCache(cache);
  }

  function forget(id) {
    const cache = readCache();
    delete cache[id];
    writeCache(cache);
  }

  function probeImage(url, timeoutMs = 8000) {
    return new Promise((resolve) => {
      const candidate = new Image();
      let finished = false;
      const finish = (success) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        candidate.onload = null;
        candidate.onerror = null;
        resolve(success);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      candidate.decoding = "async";
      candidate.referrerPolicy = "no-referrer";
      candidate.onload = () => finish(candidate.naturalWidth > 0 || candidate.width > 0);
      candidate.onerror = () => finish(false);
      candidate.src = url;
    });
  }

  async function fetchJson(url, timeoutMs = 8000) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch(url, { credentials: "omit", signal: controller?.signal });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function pageImageFrom(response) {
    const pages = Object.values(response?.query?.pages || {});
    const page = pages.find((item) => !item.missing && (item.original?.source || item.thumbnail?.source));
    return page?.original?.source || page?.thumbnail?.source || null;
  }

  async function lookupWikipediaPortrait(rikishi) {
    if (!rikishi.wikipedia) return null;
    const base = "https://en.wikipedia.org/w/api.php";
    const shared = {
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      prop: "pageimages",
      piprop: "original|thumbnail",
      pithumbsize: "1200",
      pilicense: "any",
    };

    const exact = new URLSearchParams({ ...shared, titles: rikishi.wikipedia, redirects: "1" });
    const exactImage = pageImageFrom(await fetchJson(`${base}?${exact}`));
    if (exactImage) return exactImage;

    const search = new URLSearchParams({
      ...shared,
      generator: "search",
      gsrsearch: `\"${rikishi.wikipedia}\" sumo wrestler`,
      gsrnamespace: "0",
      gsrlimit: "3",
    });
    const searchedImage = pageImageFrom(await fetchJson(`${base}?${search}`));
    if (searchedImage) return searchedImage;

    const commons = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      origin: "*",
      generator: "search",
      gsrsearch: `${rikishi.wikipedia} sumo`,
      gsrnamespace: "6",
      gsrlimit: "5",
      prop: "imageinfo",
      iiprop: "url|mime|size",
    });
    const commonsResponse = await fetchJson(`https://commons.wikimedia.org/w/api.php?${commons}`);
    const files = Object.values(commonsResponse?.query?.pages || {});
    const portrait = files.find((file) => file.imageinfo?.[0]?.url && file.imageinfo[0].mime?.startsWith("image/"));
    return portrait?.imageinfo?.[0]?.url || null;
  }

  function reportMissing(rikishi) {
    console.warn([
      "Image missing:",
      "",
      rikishi.shikona || rikishi.name || rikishi.id,
      "",
      "Tried:",
      "",
      "✗ Local",
      "✗ JSA",
      "✗ Wikipedia",
      "",
      "Using placeholder.",
    ].join("\n"));
  }

  async function resolveUncached(rikishi) {
    const localUrl = absoluteUrl(`assets/rikishi/${rikishi.id}.webp`);
    if (await probeImage(localUrl)) {
      const result = { source: "local", url: localUrl };
      remember(rikishi.id, result);
      return result;
    }

    const cached = cachedResult(rikishi.id);
    if (cached?.source === "placeholder") return cached;
    if (cached && await probeImage(cached.url)) return cached;
    if (cached) forget(rikishi.id);

    if (rikishi.jsaId && rikishi.jsaPortrait && await probeImage(rikishi.jsaPortrait)) {
      const result = { source: "jsa", url: rikishi.jsaPortrait };
      remember(rikishi.id, result);
      return result;
    }

    const wikipediaUrl = await lookupWikipediaPortrait(rikishi);
    if (wikipediaUrl && await probeImage(wikipediaUrl)) {
      const result = { source: "wikipedia", url: wikipediaUrl };
      remember(rikishi.id, result);
      return result;
    }

    const result = { source: "placeholder", url: absoluteUrl(PLACEHOLDER_PATH) };
    remember(rikishi.id, result);
    reportMissing(rikishi);
    return result;
  }

  function resolve(rikishi) {
    if (!rikishi?.id) return Promise.resolve({ source: "placeholder", url: absoluteUrl(PLACEHOLDER_PATH) });
    if (!resolutionById.has(rikishi.id)) resolutionById.set(rikishi.id, resolveUncached(rikishi));
    return resolutionById.get(rikishi.id);
  }

  async function resolveElement(element) {
    const rikishi = window.SUMO_DATA.rikishi.find((item) => item.id === element.dataset.rikishiId);
    if (!rikishi) return;
    element.dataset.imageState = "loading";
    const result = await resolve(rikishi);
    element.src = result.url;
    element.dataset.imageSource = result.source;
    element.dataset.imageState = "ready";
    const frame = element.closest(".rikishi-image");
    frame?.classList.toggle("uses-placeholder", result.source === "placeholder");
    frame?.classList.remove("is-resolving");
  }

  function bind(root = document) {
    const images = [...root.querySelectorAll("[data-rikishi-image]")];
    if (!images.length) return;
    const start = (element) => {
      if (element.dataset.imageResolverBound === "true") return;
      element.dataset.imageResolverBound = "true";
      resolveElement(element);
    };

    if (!("IntersectionObserver" in window)) {
      images.forEach(start);
      return;
    }
    if (!observer) {
      observer = new window.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const target = entry.target;
          if (target.dataset.imageResolverBound === "true") return;
          target.dataset.imageResolverBound = "true";
          resolveElement(target);
        });
      }, { rootMargin: "280px 0px" });
    }
    images.forEach((image) => {
      if (image.dataset.imageResolverBound !== "true") observer.observe(image);
    });
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore storage restrictions.
    }
    resolutionById.clear();
  }

  window.RIKISHI_IMAGES = {
    bind,
    resolve,
    clearCache,
    cacheKey: CACHE_KEY,
    placeholder: PLACEHOLDER_PATH,
    _testing: { lookupWikipediaPortrait, probeImage, readCache },
  };
})();
