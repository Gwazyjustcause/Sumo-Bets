// The same public two-player game as the existing backend. CORS limits browser
// origins; it is not player authentication.
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim());
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(origin && allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed.includes(origin)) return reply({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    let bashoId;
    try {
      const match = new URL(request.url).pathname.match(/^\/drafts\/([^/]+)$/);
      if (!match) return reply({ error: "Not found." }, 404);
      bashoId = decodeURIComponent(match[1]);
      if (!bashoId || bashoId.length > 150) return reply({ error: "Invalid basho ID." }, 400);
    } catch { return reply({ error: "Invalid path." }, 400); }
    try {
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT basho_id, revision, document FROM shared_drafts WHERE basho_id = ?").bind(bashoId).first();
        return reply(row ? { ...row, document: JSON.parse(row.document) } : null);
      }
      if (request.method !== "PUT") return reply({ error: "Method not allowed." }, 405);
      // Bound the body before buffering it, including chunked requests.
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: "A JSON body is required." }, 400);
      let length = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1000000) { await reader.cancel(); return reply({ error: "Draft is too large." }, 413); }
        chunks.push(value);
      }
      let input;
      try { input = JSON.parse(await new Blob(chunks).text()); }
      catch { return reply({ error: "Invalid JSON." }, 400); }
      const { document, expectedRevision } = input || {};
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER
          || !document || typeof document !== "object" || Array.isArray(document) || document.bashoId !== bashoId) {
        return reply({ error: "Invalid draft or revision." }, 400);
      }
      const revision = expectedRevision + 1;
      const next = { ...document, bashoId, revision };
      // One statement checks the revision and writes atomically. RETURNING
      // returns this write's snapshot, even if another save follows immediately.
      const row = expectedRevision === 0
        ? await env.DB.prepare(`INSERT INTO shared_drafts (basho_id, revision, document) VALUES (?, ?, ?)
            ON CONFLICT(basho_id) DO NOTHING RETURNING basho_id, revision, document`)
          .bind(bashoId, revision, JSON.stringify(next)).first()
        : await env.DB.prepare(`UPDATE shared_drafts SET revision = ?, document = ?, updated_at = CURRENT_TIMESTAMP
            WHERE basho_id = ? AND revision = ? RETURNING basho_id, revision, document`)
          .bind(revision, JSON.stringify(next), bashoId, expectedRevision).first();
      if (row) return reply({ ...row, document: JSON.parse(row.document) });
      return reply({ error: "The shared draft changed on another device. Reloading before saving." }, 409);
    } catch (error) {
      console.error("Shared draft request failed", error);
      return reply({ error: "Shared storage is temporarily unavailable. Try again." }, 503);
    }
  },
};
