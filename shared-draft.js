(() => {
  const defaults = {
    owner: "Gwazyjustcause",
    repo: "Sumo-Bets",
    branch: "main",
    path: "data/draft/current-draft.json",
  };
  const config = { ...defaults, ...(window.SUMO_SHARED_DRAFT_CONFIG || {}) };
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`;
  const tokenKey = "sumoBattleGitHubWriteToken";

  function token() {
    try { return sessionStorage.getItem(tokenKey) || ""; } catch { return ""; }
  }

  function setToken(value) {
    try {
      if (value) sessionStorage.setItem(tokenKey, value.trim());
      else sessionStorage.removeItem(tokenKey);
    } catch { /* Session credentials are optional until save time. */ }
  }

  function decodeBase64(value) {
    const bytes = Uint8Array.from(atob(value.replace(/\n/g, "")), (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  async function request(url, options = {}) {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(url, { cache: "no-store", ...options, headers });
    if (!response.ok) {
      const error = new Error(response.status === 409 || response.status === 422 ? "The shared draft changed on another device. Reload it before saving." : `Shared draft request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function load() {
    try {
      const result = await request(`${apiUrl}?ref=${encodeURIComponent(config.branch)}&t=${Date.now()}`);
      return { document: JSON.parse(decodeBase64(result.content)), sha: result.sha };
    } catch (error) {
      if (error.status && error.status !== 403) throw error;
      const response = await fetch(`${config.path}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw error;
      return { document: await response.json(), sha: null };
    }
  }

  async function save(document, sha) {
    if (!token()) throw new Error("Add a GitHub write token in Settings before saving the shared draft.");
    const body = {
      message: `Save ${document.bashoId} shared draft (${document.savedBy})`,
      content: encodeBase64(`${JSON.stringify(document, null, 2)}\n`),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    };
    const result = await request(apiUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { document, sha: result.content?.sha || sha };
  }

  window.SHARED_DRAFT_API = { config, load, save, token, setToken };
})();
