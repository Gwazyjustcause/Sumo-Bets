(() => {
  const defaults = {
    url: "",
    anonKey: "",
    table: "shared_drafts",
    saveFunction: "save_shared_draft",
  };
  const config = { ...defaults, ...(window.SUMO_SHARED_DRAFT_CONFIG || {}) };
  let client = null;
  let activeChannel = null;

  function configured() {
    return Boolean(config.url && config.anonKey && !config.url.includes("YOUR_PROJECT"));
  }

  function database() {
    if (!configured()) throw new Error("Supabase shared draft is not configured. Add the project URL and publishable key in supabase-config.js.");
    if (!window.supabase?.createClient) throw new Error("The Supabase client could not be loaded.");
    if (!client) {
      client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    return client;
  }

  function blankDocument(bashoId) {
    const emptyPlayer = () => ({ mainPicks: [], substitutes: [], sidePrediction: null, substitutionEvents: [] });
    return {
      schemaVersion: 3,
      bashoId,
      revision: 0,
      locked: false,
      lastSavedAt: null,
      savedBy: null,
      players: { gwazy: emptyPlayer(), jake: emptyPlayer() },
    };
  }

  function normalizeRow(row, bashoId) {
    if (!row) return { document: blankDocument(bashoId), revision: 0 };
    const revision = Number(row.revision || row.document?.revision || 0);
    return { document: { ...row.document, bashoId, revision }, revision };
  }

  async function load(bashoId) {
    const { data, error } = await database()
      .from(config.table)
      .select("basho_id, revision, document")
      .eq("basho_id", bashoId)
      .maybeSingle();
    if (error) throw new Error(`Shared draft request failed (${error.message || error.code || "unknown"}).`);
    return normalizeRow(data, bashoId);
  }

  async function save(document, expectedRevision) {
    const { data, error } = await database().rpc(config.saveFunction, {
      p_basho_id: document.bashoId,
      p_expected_revision: Number(expectedRevision || 0),
      p_document: document,
    });
    if (error) {
      const stale = error.code === "40001" || /STALE_DRAFT_REVISION|stale/i.test(error.message || "");
      const saveError = new Error(stale
        ? "The shared draft changed on another device. Reloading before saving."
        : `Shared draft request failed (${error.message || error.code || "unknown"}).`);
      saveError.status = stale ? 409 : Number(error.status || 500);
      throw saveError;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRow(row, document.bashoId);
  }

  function subscribe(bashoId, onChange) {
    const db = database();
    if (activeChannel) db.removeChannel(activeChannel);
    activeChannel = db
      .channel(`shared-draft-${bashoId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: config.table,
        filter: `basho_id=eq.${bashoId}`,
      }, (payload) => {
        if (payload.new) onChange(normalizeRow(payload.new, bashoId));
      })
      .subscribe();
    return () => {
      if (activeChannel) db.removeChannel(activeChannel);
      activeChannel = null;
    };
  }

  window.SHARED_DRAFT_API = { config, configured, load, save, subscribe };
})();
