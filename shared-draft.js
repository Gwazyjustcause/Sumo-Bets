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

  function setupStatus() {
    const missing = [];
    const url = String(config.url || "").trim();
    const anonKey = String(config.anonKey || "").trim();
    if (!url || url.includes("YOUR_PROJECT")) missing.push("Project URL");
    else {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") missing.push("valid HTTPS Project URL");
        else if (parsed.hostname.endsWith("github.io")) missing.push("Supabase Project URL (the current value is the GitHub Pages URL)");
      } catch {
        missing.push("valid Project URL");
      }
    }
    if (!anonKey || anonKey.includes("YOUR_PUBLISHABLE_OR_ANON_KEY")) missing.push("Publishable Key");
    if (!window.supabase?.createClient) missing.push("Supabase browser client");
    return {
      ready: missing.length === 0,
      missing,
      message: missing.length
        ? `Supabase setup incomplete. Missing: ${missing.join(", ")}. Check supabase-config.js.`
        : "Supabase configuration is ready.",
    };
  }

  function configured() {
    return setupStatus().ready;
  }

  function database() {
    const status = setupStatus();
    if (!status.ready) throw new Error(status.message);
    if (!client) {
      client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    return client;
  }

  function requestError(error, operation) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    if (/<!doctype html|github pages|file not found/i.test(message)) {
      return new Error("The configured Project URL is a website URL, not the Supabase Project URL. Copy the URL from Supabase Project Settings → API.");
    }
    if (["42P01", "PGRST205"].includes(code) || /relation .*shared_drafts.* does not exist/i.test(message)) {
      return new Error("Supabase table shared_drafts is missing. Run supabase/schema.sql in the Supabase SQL Editor.");
    }
    if (["42501", "PGRST301"].includes(code) || /permission denied|row-level security/i.test(message)) {
      return new Error("Supabase access policy is missing or blocked. Run the RLS section of supabase/schema.sql.");
    }
    if (["42883", "PGRST202"].includes(code) || /save_shared_draft.*not found|function .* does not exist/i.test(message)) {
      return new Error("Supabase save function is missing. Run the save_shared_draft section of supabase/schema.sql.");
    }
    return new Error(`Supabase ${operation} failed (${message || code || "unknown error"}).`);
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
    if (error) throw requestError(error, "draft check");
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
        : requestError(error, "save").message);
      saveError.status = stale ? 409 : Number(error.status || 500);
      throw saveError;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRow(row, document.bashoId);
  }

  function subscribe(bashoId, onChange, onStatus = () => {}) {
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
      .subscribe((status) => onStatus(status));
    return () => {
      if (activeChannel) db.removeChannel(activeChannel);
      activeChannel = null;
    };
  }

  window.SHARED_DRAFT_API = { config, setupStatus, configured, load, save, subscribe };
})();
