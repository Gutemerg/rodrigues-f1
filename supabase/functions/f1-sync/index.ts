// RODRIGUES F1 — sincroniza calendário, sessões, campeonato e notícias.
// Chamado pelo agendador (pg_cron) com o cabeçalho x-f1-secret.
import postgres from "npm:postgres@3.4.4";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const API = "https://api.jolpi.ca/ergast/f1";

// filter: devolve o título limpo, ou null para descartar (ex.: MotoGP no F1Mania).
const FEEDS: { source: string; url: string; filter?: (t: string) => string | null }[] = [
  { source: "Motorsport.com", url: "https://br.motorsport.com/rss/f1/news/" },
  {
    source: "F1Mania", url: "https://www.f1mania.net/feed/",
    filter: (t) => /^F1\s*[:\-–]/i.test(t) ? t.replace(/^F1\s*[:\-–]\s*/i, "") : null,
  },
];

async function getJson(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { "User-Agent": "RodriguesF1/1.0" } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return await r.json();
}

function ts(d?: { date?: string; time?: string }) {
  if (!d?.date) return null;
  return `${d.date}T${d.time ?? "12:00:00Z"}`;
}

async function syncCalendar(season: number) {
  const j = await getJson(`/${season}.json?limit=100`);
  const races = j.MRData.RaceTable.Races as any[];
  for (const r of races) {
    const sessions: [string, any][] = [
      ["FP1", r.FirstPractice], ["FP2", r.SecondPractice], ["FP3", r.ThirdPractice],
      ["SQ", r.SprintQualifying ?? r.SprintShootout], ["SPRINT", r.Sprint],
      ["QUALI", r.Qualifying], ["RACE", { date: r.date, time: r.time }],
    ];
    const dates = sessions.map(([, s]) => s?.date).filter(Boolean).sort();
    await sql`
      insert into f1.races (season, round, name, circuit, locality, country, date_start, date_end)
      values (${season}, ${+r.round}, ${r.raceName}, ${r.Circuit?.circuitName ?? null},
              ${r.Circuit?.Location?.locality ?? null}, ${r.Circuit?.Location?.country ?? null},
              ${dates[0] ?? r.date}, ${r.date})
      on conflict (season, round) do update set name = excluded.name, circuit = excluded.circuit,
        locality = excluded.locality, country = excluded.country,
        date_start = excluded.date_start, date_end = excluded.date_end`;
    for (const [kind, s] of sessions) {
      const at = ts(s);
      if (!at) continue;
      await sql`
        insert into f1.sessions (season, round, kind, starts_at)
        values (${season}, ${+r.round}, ${kind}, ${at})
        on conflict (season, round, kind) do update set starts_at = excluded.starts_at`;
    }
  }
  return races.length;
}

async function syncStandings(season: number) {
  const d = await getJson(`/${season}/driverstandings.json?limit=50`);
  const dl = d.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
  const c = await getJson(`/${season}/constructorstandings.json?limit=30`);
  const cl = c.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
  const lastRound = d.MRData.StandingsTable.StandingsLists[0]?.round ?? null;
  await sql.begin(async (tx) => {
    if (dl.length) {
      await tx`delete from f1.driver_standings where season = ${season}`;
      for (const s of dl) {
        await tx`insert into f1.driver_standings values (${season}, ${+(s.position ?? s.positionText ?? 0)},
          ${s.Driver.code ?? null}, ${s.Driver.givenName}, ${s.Driver.familyName}, ${s.Driver.nationality ?? null},
          ${s.Constructors?.[0]?.name ?? null}, ${+s.points}, ${+s.wins})
          on conflict do nothing`;
      }
    }
    if (cl.length) {
      await tx`delete from f1.constructor_standings where season = ${season}`;
      for (const s of cl) {
        await tx`insert into f1.constructor_standings values (${season}, ${+(s.position ?? 0)},
          ${s.Constructor.name}, ${s.Constructor.nationality ?? null}, ${+s.points}, ${+s.wins})
          on conflict do nothing`;
      }
    }
  });
  let last = null;
  try {
    const lr = await getJson(`/${season}/last/results.json`);
    const race = lr.MRData.RaceTable.Races[0];
    if (race) {
      last = {
        round: +race.round, name: race.raceName,
        top: (race.Results ?? []).slice(0, 10).map((x: any) => ({
          pos: +x.position, name: `${x.Driver.givenName} ${x.Driver.familyName}`,
          code: x.Driver.code, team: x.Constructor?.name, time: x.Time?.time ?? x.status,
        })),
      };
    }
  } catch (_) { /* opcional */ }
  await sql`insert into f1.meta (key, value) values ('standings_round', ${sql.json({ round: lastRound, last })})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return { drivers: dl.length, teams: cl.length, lastRound };
}

// ---------- notícias ----------
function decode(s: string) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}
function strip(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function imageOf(item: string, desc: string) {
  const pats = [
    /<media:content[^>]+url="([^"]+)"/i, /<media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i, /<enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"/i,
  ];
  for (const p of pats) { const m = item.match(p); if (m) return decode(m[1]); }
  const m = desc.match(/<img[^>]+src="([^"]+)"/i);
  return m ? decode(m[1]) : null;
}
async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function syncNews() {
  const report: Record<string, string> = {};
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 RodriguesF1/1.0" } });
      if (!r.ok) { report[f.source] = `HTTP ${r.status}`; continue; }
      const xml = await r.text();
      const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
      let n = 0;
      for (const it of items.slice(0, 25)) {
        let title = strip(tag(it, "title"));
        if (f.filter) { const t = f.filter(title); if (!t) continue; title = t; }
        const link = tag(it, "link") || (it.match(/<guid[^>]*>([^<]+)</i)?.[1] ?? "");
        if (!title || !link.startsWith("http")) continue;
        const rawDesc = tag(it, "description");
        let summary = strip(rawDesc);
        if (summary.length > 220) summary = summary.slice(0, 217).replace(/\s+\S*$/, "") + "…";
        const pub = new Date(tag(it, "pubDate") || tag(it, "dc:date") || Date.now());
        const when = isNaN(+pub) ? new Date() : pub;
        await sql`insert into f1.news (id, title, summary, link, image, source, published_at)
          values (${await hash(link)}, ${title}, ${summary || null}, ${link}, ${imageOf(it, rawDesc)}, ${f.source}, ${when})
          on conflict (id) do update set title = excluded.title, summary = excluded.summary, image = coalesce(excluded.image, f1.news.image)`;
        n++;
      }
      report[f.source] = `${n} itens`;
    } catch (e) {
      report[f.source] = `erro: ${(e as Error).message}`;
    }
  }
  await sql`delete from f1.news where published_at < now() - interval '30 days'`;
  return report;
}

Deno.serve(async (req) => {
  const [{ value: secret }] = await sql`select value from f1.config where key = 'cron_secret'`;
  if (req.headers.get("x-f1-secret") !== secret) return new Response("forbidden", { status: 403 });
  const url = new URL(req.url);
  const what = url.searchParams.get("only") ?? "all";
  const season = +(url.searchParams.get("season") ?? new Date().getUTCFullYear());
  const out: Record<string, unknown> = { season };
  if (what === "all" || what === "calendar") {
    try { out.calendar = await syncCalendar(season); } catch (e) { out.calendar = `erro: ${(e as Error).message}`; }
  }
  if (what === "all" || what === "standings") {
    try { out.standings = await syncStandings(season); } catch (e) { out.standings = `erro: ${(e as Error).message}`; }
  }
  if (what === "all" || what === "news") out.news = await syncNews();
  await sql`insert into f1.meta (key, value) values ('last_sync', ${sql.json(out)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return Response.json(out);
});
