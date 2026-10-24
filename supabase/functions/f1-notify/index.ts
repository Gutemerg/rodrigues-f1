// RODRIGUES F1 — dispara as notificações push. Roda a cada 5 min pelo pg_cron.
import postgres from "npm:postgres@3.4.4";
import webpush from "npm:web-push@3.6.7";
import { gpName, SESSION_PT, spDate, spDay, spHour, spTime } from "./names.ts";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const MIN = 60_000, H = 60 * MIN;
const NOT_F1 = /^(MotoGP|Moto2|Moto3|MotoE|F2|F3|F1 Academy|Indy|IndyCar|Stock|WEC|Fórmula E|Formula E|NASCAR|WSBK|Superbike|Porsche)\b/i;

type Job = { sub: any; key: string; payload: Record<string, string> };

function groupOf(kind: string) {
  if (kind.startsWith("FP")) return "practice";
  if (kind === "QUALI" || kind === "SQ") return "quali";
  return "race"; // SPRINT e RACE
}

Deno.serve(async (req) => {
  const cfg = Object.fromEntries((await sql`select key, value from f1.config`).map((r) => [r.key, r.value]));
  if (req.headers.get("x-f1-secret") !== cfg.cron_secret) return new Response("forbidden", { status: 403 });

  const subs = await sql`select id, endpoint, p256dh, auth, prefs from f1.subscriptions`;
  if (!subs.length) return Response.json({ subs: 0 });
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  const now = Date.now();
  const hourSP = spHour(new Date(now));
  const sessions = await sql`
    select s.season, s.round, s.kind, s.starts_at, r.name
    from f1.sessions s join f1.races r using (season, round)
    where s.starts_at between now() - interval '30 minutes' and now() + interval '31 hours'
    order by s.starts_at`;

  const jobs: Job[] = [];
  for (const s of sessions) {
    const start = new Date(s.starts_at).getTime();
    const gp = gpName(s.name);
    const label = SESSION_PT[s.kind] ?? s.kind;
    const hhmm = spTime(new Date(start));

    // Aviso de início do fim de semana (~30h antes do TL1), só em horário decente.
    if (s.kind === "FP1" && now >= start - 30 * H && now < start - H && hourSP >= 8 && hourSP <= 22) {
      for (const sub of subs) {
        if (!sub.prefs?.weekend) continue;
        jobs.push({
          sub, key: `w:${s.season}:${s.round}`,
          payload: {
            title: `Começa o fim de semana do ${gp}`,
            body: `${label} ${spDay(new Date(start))} às ${hhmm}. Toque para ver a programação.`,
            url: `./#evento/${s.round}`, tag: `w-${s.round}`,
          },
        });
      }
    }

    // Lembretes antes de cada sessão, conforme a antecedência escolhida.
    const g = groupOf(s.kind);
    for (const sub of subs) {
      if (!sub.prefs?.[g]) continue;
      for (const lead of (sub.prefs?.leads ?? [30]) as number[]) {
        const fireAt = start - lead * MIN;
        if (now < fireAt || now > fireAt + 20 * MIN || now > start + 5 * MIN) continue;
        const body = lead >= 1440
          ? `Amanhã às ${hhmm} (horário de São Paulo).`
          : lead >= 60 ? `Começa às ${hhmm} — daqui a ${lead / 60} h.` : `Começa às ${hhmm} — daqui a ${lead} min.`;
        jobs.push({
          sub, key: `s:${s.season}:${s.round}:${s.kind}:${lead}`,
          payload: { title: `${label} · ${gp}`, body, url: `./#evento/${s.round}`, tag: `s-${s.round}-${s.kind}` },
        });
      }
    }
  }

  // Matérias principais: no máximo 2 por dia, com 4h de intervalo, das 9h às 22h.
  if (hourSP >= 9 && hourSP <= 22) {
    const fresh = (await sql`select id, title, summary, source from f1.news
      where published_at > now() - interval '3 hours' order by published_at desc limit 10`)
      .filter((n) => !NOT_F1.test(n.title));
    if (fresh.length) {
      const today = spDate(new Date(now));
      const stats = await sql`
        select sub_id, count(*) filter (where (sent_at at time zone 'America/Sao_Paulo')::date = ${today}::date) as today,
               max(sent_at) as last
        from f1.sent where key like 'n:%' group by sub_id`;
      const byId = new Map(stats.map((r) => [r.sub_id, r]));
      const sentNews = new Set((await sql`select sub_id || '|' || key as k from f1.sent where key like 'n:%' and sent_at > now() - interval '2 days'`).map((r) => r.k));
      for (const sub of subs) {
        if (!sub.prefs?.news) continue;
        const st = byId.get(sub.id);
        if (st && (+st.today >= 2 || now - new Date(st.last).getTime() < 4 * H)) continue;
        const pick = fresh.find((n) => !sentNews.has(`${sub.id}|n:${n.id}`));
        if (!pick) continue;
        jobs.push({
          sub, key: `n:${pick.id}`,
          payload: { title: pick.title, body: pick.summary ?? pick.source, url: `./#materia/${pick.id}`, tag: `n-${pick.id}` },
        });
      }
    }
  }

  let sent = 0, gone = 0, failed = 0;
  for (let i = 0; i < jobs.length; i += 20) {
    await Promise.all(jobs.slice(i, i + 20).map(async (j) => {
      const claimed = await sql`insert into f1.sent (sub_id, key) values (${j.sub.id}, ${j.key})
        on conflict do nothing returning key`;
      if (!claimed.length) return; // já enviado
      try {
        await webpush.sendNotification(
          { endpoint: j.sub.endpoint, keys: { p256dh: j.sub.p256dh, auth: j.sub.auth } },
          JSON.stringify(j.payload), { TTL: 1800, urgency: "high" },
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await sql`delete from f1.subscriptions where id = ${j.sub.id}`; gone++;
        } else {
          failed++;
          await sql`delete from f1.sent where sub_id = ${j.sub.id} and key = ${j.key}`; // tenta de novo na próxima rodada
        }
      }
    }));
  }
  await sql`delete from f1.sent where sent_at < now() - interval '20 days'`;
  return Response.json({ subs: subs.length, jobs: jobs.length, sent, gone, failed });
});
