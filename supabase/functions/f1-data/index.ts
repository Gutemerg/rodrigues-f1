// RODRIGUES F1 — entrega os dados públicos do app num único JSON.
import postgres from "npm:postgres@3.4.4";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const season = +(new URL(req.url).searchParams.get("season") ?? new Date().getUTCFullYear());

  const races = await sql`
    select r.round, r.name, r.circuit, r.locality, r.country, r.date_start, r.date_end,
      coalesce(json_agg(json_build_object('kind', s.kind, 'at', s.starts_at) order by s.starts_at)
        filter (where s.kind is not null), '[]') as sessions
    from f1.races r left join f1.sessions s on s.season = r.season and s.round = r.round
    where r.season = ${season}
    group by r.season, r.round order by r.round`;
  const drivers = await sql`select position, code, given_name, family_name, nationality, team, points, wins, photo
    from f1.driver_standings where season = ${season} order by position`;
  const teams = await sql`select position, team, nationality, points, wins
    from f1.constructor_standings where season = ${season} order by position`;
  const news = await sql`select id, title, summary, link, image, source, published_at
    from f1.news
    where title !~* '^(MotoGP|Moto2|Moto3|MotoE|F2|F3|F1 Academy|Indy|IndyCar|Stock|WEC|Fórmula E|Formula E|NASCAR|WSBK|Superbike|Porsche)\\M'
    order by published_at desc limit 60`;
  const videos = await sql`select id, title, channel, published_at, thumb, views from f1.videos
    where embeddable and published_at > now() - interval '14 days' order by published_at desc limit 40`;
  const meta = await sql`select key, value, updated_at from f1.meta where key in ('standings_round', 'last_sync', 'grid')`;
  const [{ value: vapid }] = await sql`select value from f1.config where key = 'vapid_public'`;
  const m = Object.fromEntries(meta.map((x) => [x.key, { ...x.value, updated_at: x.updated_at }]));

  return new Response(JSON.stringify({
    season, races, drivers, teams, news, videos, vapid,
    lastResult: m.standings_round?.last ?? null,
    standingsRound: m.standings_round?.round ?? null,
    updatedAt: m.last_sync?.updated_at ?? null,
    grid: m.grid ?? null,
  }), {
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
  });
});
