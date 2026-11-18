(() => {
  // Loaded after the legacy transport so cutover is a configuration change.
  const config = window.SUMO_SHARED_DRAFT_CONFIG || {};
  if (config.provider !== "cloudflare") return;
  const subscriptions = new Map();
  const pollMs = Math.max(10000, Number(config.pollMs) || 15000);
  function setupStatus() {
    let valid = false;
    try { valid = new URL(config.url).protocol === "https:"; } catch {}
    return { ready: valid, missing: valid ? [] : ["Shared storage URL"], message: valid
      ? "Shared storage is configured." : "Missing: Shared storage URL. Check shared-config.js." };
  }
  function blankDocument(bashoId) {
    const player = () => ({ mainPicks: [], substitutes: [], sidePrediction: null, substitutionEvents: [] });
    return { schemaVersion: 4, bashoId, revision: 0, locked: false, playerLocks: { gwazy: false, jake: false },
      status: "draft", startedAt: null, completedAt: null, history: [], lastSavedAt: null, savedBy: null,
      players: { gwazy: player(), jake: player() } };
  }
  async function request(bashoId, options = {}) {
    const status = setupStatus();
    if (!status.ready) throw new Error(status.message);
    const response = await fetch(`${config.url.replace(/\/$/, "")}/drafts/${encodeURIComponent(bashoId)}`, {
      ...options, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    let row;
    try { row = await response.json(); } catch { throw new Error("Shared storage returned an invalid response."); }
    if (!response.ok) {
      const error = new Error(row?.error || "Shared storage request failed.");
      error.status = response.status;
      throw error;
    }
    if (row === null && options.method === "PUT") throw new Error("Shared storage did not confirm the save.");
    if (row === null) return { document: blankDocument(bashoId), revision: 0 };
    if (!row?.document || row.basho_id !== bashoId || !Number.isSafeInteger(row.revision) || row.revision < 1) {
      throw new Error("Shared storage returned an invalid draft.");
    }
    return { document: { ...row.document, bashoId, revision: row.revision }, revision: row.revision };
  }
  const load = (bashoId) => request(bashoId);
  const save = (document, expectedRevision) => request(document.bashoId, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document, expectedRevision }),
  });
  function subscribe(bashoId, onChange, onStatus = () => {}) {
    subscriptions.get(bashoId)?.();
    let stopped = false;
    let timer;
    let revision = -1;
    let errorReported = false;
    async function poll() {
      try {
        if (typeof document !== "undefined" && document.hidden) return;
        const result = await load(bashoId);
        if (stopped) return;
        onStatus("SUBSCRIBED");
        errorReported = false;
        if (result.revision > revision) { revision = result.revision; onChange(result); }
      } catch {
        if (!stopped && !errorReported) { errorReported = true; onStatus("CHANNEL_ERROR"); }
      } finally {
        if (!stopped) timer = setTimeout(poll, pollMs);
      }
    }
    const stop = () => { stopped = true; clearTimeout(timer); if (subscriptions.get(bashoId) === stop) subscriptions.delete(bashoId); };
    subscriptions.set(bashoId, stop);
    poll();
    return stop;
  }
  window.SHARED_DRAFT_API = { config, setupStatus, configured: () => setupStatus().ready, load, save, subscribe };
})();
