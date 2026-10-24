// RODRIGUES F1 — cadastro de aparelhos para notificações e preferências.
import postgres from "npm:postgres@3.4.4";
import webpush from "npm:web-push@3.6.7";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DEFAULT = { weekend: true, practice: false, quali: true, race: true, news: true, leads: [30] };
function cleanPrefs(p: any) {
  const out: any = { ...DEFAULT };
  for (const k of ["weekend", "practice", "quali", "race", "news"]) if (typeof p?.[k] === "boolean") out[k] = p[k];
  if (Array.isArray(p?.leads)) {
    const ok = p.leads.map(Number).filter((n: number) => [15, 30, 60, 1440].includes(n));
    out.leads = ok.length ? [...new Set(ok)] : [30];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "json" }, 400); }
  const action = body.action ?? "save";
  const sub = body.subscription;
  const endpoint: string | undefined = sub?.endpoint ?? body.endpoint;
  if (!endpoint || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) return json({ error: "endpoint" }, 400);

  if (action === "remove") {
    await sql`delete from f1.subscriptions where endpoint = ${endpoint}`;
    return json({ ok: true });
  }

  if (action === "save") {
    const p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
    if (!p256dh || !auth) return json({ error: "keys" }, 400);
    const prefs = cleanPrefs(body.prefs);
    const [row] = await sql`
      insert into f1.subscriptions (endpoint, p256dh, auth, prefs)
      values (${endpoint}, ${p256dh}, ${auth}, ${sql.json(prefs)})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
        prefs = excluded.prefs, last_seen = now()
      returning id, prefs`;
    return json({ ok: true, prefs: row.prefs });
  }

  if (action === "test") {
    const [s] = await sql`select endpoint, p256dh, auth from f1.subscriptions where endpoint = ${endpoint}`;
    if (!s) return json({ error: "not_found" }, 404);
    const cfg = Object.fromEntries((await sql`select key, value from f1.config where key like 'vapid_%'`).map((r) => [r.key, r.value]));
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "RODRIGUES F1", body: "Notificações ativadas! Você será avisado antes das sessões.", url: "./", tag: "test" }),
        { TTL: 600, urgency: "high" },
      );
      return json({ ok: true });
    } catch (e: any) {
      return json({ error: "push", status: e?.statusCode ?? null, detail: String(e?.body ?? e?.message ?? e) }, 502);
    }
  }

  return json({ error: "action" }, 400);
});
