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

// Foto do piloto pela Wikipédia (imagens de pessoas vivas lá são de licença livre, via Wikimedia Commons).
async function driverPhoto(driverId: string, wikiUrl?: string): Promise<string | null> {
  const [c] = await sql`select photo from f1.driver_photos where driver_id = ${driverId}
    and checked_at > now() - interval '30 days'`;
  if (c) return c.photo;
  let photo: string | null = null;
  try {
    const title = decodeURIComponent((wikiUrl ?? "").split("/wiki/")[1] ?? "");
    if (title) {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { "User-Agent": "RodriguesF1/1.0 (gutemberg.inivendas@gmail.com)" },
      });
      if (r.ok) {
        const j = await r.json();
        const src: string | undefined = j.thumbnail?.source ?? j.originalimage?.source;
        if (src) photo = src.replace(/\/\d+px-/, "/330px-"); // tamanho padrão aceito pela Wikimedia
      }
    }
  } catch (_) { /* sem foto */ }
  await sql`insert into f1.driver_photos (driver_id, wiki_url, photo, checked_at)
    values (${driverId}, ${wikiUrl ?? null}, ${photo}, now())
    on conflict (driver_id) do update set wiki_url = excluded.wiki_url, photo = excluded.photo, checked_at = now()`;
  return photo;
}

async function syncStandings(season: number) {
  const d = await getJson(`/${season}/driverstandings.json?limit=50`);
  const dl = d.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
  const c = await getJson(`/${season}/constructorstandings.json?limit=30`);
  const cl = c.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
  const lastRound = d.MRData.StandingsTable.StandingsLists[0]?.round ?? null;
  // Fotos oficiais (recorte de macacão) pela OpenF1; a Wikipédia fica de reserva para quem não tiver.
  const official: Record<string, string> = {};
  try {
    const r = await fetch("https://api.openf1.org/v1/drivers?session_key=latest");
    if (r.ok) for (const x of await r.json()) {
      if (x.name_acronym && x.headshot_url) official[x.name_acronym] = String(x.headshot_url).replace(/\/\dcol\//, "/2col/");
    }
  } catch (_) { /* segue com a reserva */ }
  const photos: Record<string, string | null> = {};
  for (const s of dl) {
    photos[s.Driver.driverId] = official[s.Driver.code] ?? await driverPhoto(s.Driver.driverId, s.Driver.url);
  }
  await sql.begin(async (tx) => {
    if (dl.length) {
      await tx`delete from f1.driver_standings where season = ${season}`;
      for (const s of dl) {
        await tx`insert into f1.driver_standings
          (season, position, code, given_name, family_name, nationality, team, points, wins, driver_id, photo)
          values (${season}, ${+(s.position ?? s.positionText ?? 0)},
          ${s.Driver.code ?? null}, ${s.Driver.givenName}, ${s.Driver.familyName}, ${s.Driver.nationality ?? null},
          ${s.Constructors?.[0]?.name ?? null}, ${+s.points}, ${+s.wins}, ${s.Driver.driverId}, ${photos[s.Driver.driverId] ?? null})
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

// ---------- grid de largada (OpenF1, disponível de graça logo após a classificação) ----------
const OF1 = "https://api.openf1.org/v1";
async function of1(path: string) {
  const r = await fetch(`${OF1}${path}`);
  if (!r.ok) throw new Error(`openf1 ${path} -> HTTP ${r.status}`);
  return await r.json();
}
const lap = (s?: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60), r = (s - m * 60).toFixed(3).padStart(6, "0");
  return m ? `${m}:${r}` : r;
};
async function gridFor(sessionKey: number) {
  let rows: any[] = await of1(`/starting_grid?session_key=${sessionKey}`).catch(() => []);
  let fromResult = false;
  if (!rows.length) {
    rows = await of1(`/session_result?session_key=${sessionKey}`).catch(() => []);
    fromResult = true;
  }
  if (!rows.length) return null;
  await new Promise((r) => setTimeout(r, 400)); // respeita o limite de 3 req/s
  const drivers: any[] = await of1(`/drivers?session_key=${sessionKey}`).catch(() => []);
  const byNum = new Map(drivers.map((d) => [d.driver_number, d]));
  return rows.filter((x) => x.position).sort((a, b) => a.position - b.position).map((x) => {
    const d = byNum.get(x.driver_number) ?? {};
    const best = fromResult ? (Array.isArray(x.duration) ? x.duration.filter(Boolean).at(-1) : x.duration) : x.lap_duration;
    return {
      pos: x.position, num: x.driver_number, code: d.name_acronym ?? null,
      name: d.full_name ? String(d.full_name).replace(/\b(\p{L})(\p{L}*)/gu, (_: string, a: string, b: string) => a + b.toLowerCase()) : null,
      last: d.last_name ?? null, team: d.team_name ?? null, color: d.team_colour ? `#${d.team_colour}` : null,
      photo: d.headshot_url ? String(d.headshot_url).replace(/\/\dcol\//, "/2col/") : null, time: lap(best),
    };
  });
}
async function syncGrid(season: number) {
  // próxima corrida que ainda não terminou e cuja classificação já aconteceu
  const [race] = await sql`
    select r.round, max(s.starts_at) filter (where s.kind = 'RACE') race_at,
      max(s.starts_at) filter (where s.kind = 'QUALI') quali_at, max(s.starts_at) filter (where s.kind = 'SQ') sq_at
    from f1.races r join f1.sessions s using (season, round)
    where r.season = ${season} group by r.round
    having max(s.starts_at) filter (where s.kind = 'RACE') > now() - interval '4 hours'
    order by r.round limit 1`;
  if (!race) return "sem corrida";
  const now = Date.now();
  const sessions: any[] = await of1(`/sessions?year=${season}&date_start>=${new Date(+new Date(race.race_at) - 4 * 864e5).toISOString().slice(0, 10)}`);
  const near = (t: any, name: string) => t && sessions.find((x) => x.session_name === name &&
    Math.abs(+new Date(x.date_start) - +new Date(t)) < 3 * 36e5);
  const out: Record<string, unknown> = { round: race.round };
  for (const [key, at, name] of [["race", race.quali_at, "Qualifying"], ["sprint", race.sq_at, "Sprint Qualifying"]] as const) {
    if (!at || now < +new Date(at) + 50 * 60e3) continue; // só depois de a sessão acabar
    const sess = near(at, name) ?? (name === "Sprint Qualifying" ? near(at, "Sprint Shootout") : null);
    if (!sess) continue;
    await new Promise((r) => setTimeout(r, 400));
    const items = await gridFor(sess.session_key);
    if (items?.length) out[key] = items;
  }
  if (!out.race && !out.sprint) return `aguardando classificação da etapa ${race.round}`;
  await sql`insert into f1.meta (key, value) values ('grid', ${sql.json(out)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return { round: race.round, race: (out.race as any[])?.length ?? 0, sprint: (out.sprint as any[])?.length ?? 0 };
}

// ---------- vídeos (YouTube, canais brasileiros de F1) ----------
const CHANNELS = [
  { name: "Grande Prêmio", id: "UC9OlHEgxoaY6QY6nWPoiqQg" },
  { name: "Motorsport Brasil", id: "UCvm40-L5lbzlxQSbVnfX8pQ" },
  { name: "F1Mania", id: "UCp6p2Jgf0vsXsP-F-jLa33A" },
  { name: "Projeto Motor", id: "UCTdkDzyI3BBLjjWw0pA2eFw" },
];
const NOT_F1_VIDEO = /\b(MotoGP|Moto2|Moto3|Stock Car|Indy|IndyCar|NASCAR|WEC|Le Mans|F[óo]rmula E|Rally|WRC|Superbike|Porsche Cup|F[óo]rmula 2|F[óo]rmula 3|\bF2\b|\bF3\b)/i;
async function syncVideos() {
  const report: Record<string, string> = {};
  for (const ch of CHANNELS) {
    try {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`);
      if (!r.ok) { report[ch.name] = `HTTP ${r.status}`; continue; }
      const xml = await r.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
      let n = 0;
      for (const e of entries) {
        const id = e.match(/<yt:videoId>([^<]+)</)?.[1];
        const link = e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
        const title = decode(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
        const pub = e.match(/<published>([^<]+)</)?.[1];
        if (!id || !title || !pub || link.includes("/shorts/") || NOT_F1_VIDEO.test(title)) continue;
        if (Date.now() - +new Date(pub) > 14 * 864e5) continue;
        const views = +(e.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0);
        const [old] = await sql`select embeddable from f1.videos where id = ${id}`;
        let embeddable = old?.embeddable ?? null;
        if (embeddable === null) {
          const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`);
          embeddable = o.ok;
        }
        await sql`insert into f1.videos (id, title, channel, published_at, thumb, views, embeddable)
          values (${id}, ${title}, ${ch.name}, ${pub}, ${`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}, ${views}, ${embeddable})
          on conflict (id) do update set title = excluded.title, views = excluded.views, checked_at = now()`;
        n++;
      }
      report[ch.name] = `${n} vídeos`;
    } catch (e) {
      report[ch.name] = `erro: ${(e as Error).message}`;
    }
  }
  await sql`delete from f1.videos where published_at < now() - interval '21 days'`;
  return report;
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
        if (summary.length > 480) summary = summary.slice(0, 477).replace(/\s+\S*$/, "") + "…";
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
  if (what === "all" || what === "grid") {
    try { out.grid = await syncGrid(season); } catch (e) { out.grid = `erro: ${(e as Error).message}`; }
  }
  if (what === "all" || what === "news") out.news = await syncNews();
  if (what === "all" || what === "videos") out.videos = await syncVideos();
  await sql`insert into f1.meta (key, value) values ('last_sync', ${sql.json(out)})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return Response.json(out);
});
