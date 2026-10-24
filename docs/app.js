/* RODRIGUES F1 — app PWA. Todos os horários no fuso de São Paulo. */
'use strict';

const API = 'https://xruhlhlqkrxemsfgygcj.supabase.co/functions/v1';
const TZ = 'America/Sao_Paulo';
const view = document.getElementById('view');

/* ---------------- utilidades ---------------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d, o) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...o }).format(d);
const hhmm = (d) => fmt(d, { hour: '2-digit', minute: '2-digit' });
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const wdShort = (d) => fmt(d, { weekday: 'short' }).replace('.', '');
const wdLong = (d) => fmt(d, { weekday: 'long' }).split('-')[0];
const dm = (d) => fmt(d, { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ');
const monShort = (d) => fmt(d, { month: 'short' }).replace('.', '');
const dayNum = (d) => fmt(d, { day: '2-digit' });
const now = () => Date.now();
const MIN = 60000, H = 60 * MIN, DAY = 24 * H;

function relDay(d) {
  const k = dayKey(d), t = dayKey(new Date());
  if (k === t) return 'hoje';
  if (k === dayKey(new Date(now() + DAY))) return 'amanhã';
  if (k === dayKey(new Date(now() - DAY))) return 'ontem';
  return wdShort(d);
}
function ago(d) {
  const m = Math.round((now() - d) / MIN);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `${relDay(d)}, ${hhmm(d)}`;
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('rf1.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rf1.' + k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
};

/* ---------------- ícones ---------------- */
const svg = (p, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I = {
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  share: svg('<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/>'),
  flag: svg('<path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/>'),
  clock: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  news: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
};
function checker(cols, rows, cell, color = 'currentColor') {
  let r = '';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if ((x + y) % 2 === 0) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
  return `<svg width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}" fill="${color}" style="transform:skewX(-14deg);flex:none" aria-hidden="true">${r}</svg>`;
}
function track(loc, cls = 'trk', label) {
  const d = window.CIRCUITS && window.CIRCUITS[loc];
  if (!d) return '';
  const m = d.match(/^M([\d.]+) ([\d.]+)/);
  const a = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  return `<svg class="${cls}" viewBox="0 0 100 100" ${a}><path d="${d}"/>${m ? `<circle class="st" cx="${m[1]}" cy="${m[2]}" r="3.2"/>` : ''}</svg>`;
}
const logo = () => `<span class="logo" role="img" aria-label="RODRIGUES F1"><span class="w">RODRIGUES <b>F1</b></span><span class="u"><span class="bar"></span>${checker(6, 2, 3)}</span></span>`;

/* ---------------- nomes ---------------- */
const GP_PT = {
  'Australian Grand Prix': 'GP da Austrália', 'Chinese Grand Prix': 'GP da China', 'Japanese Grand Prix': 'GP do Japão',
  'Bahrain Grand Prix': 'GP do Bahrein', 'Bahrain Grand Prix in Malaysia': 'GP do Bahrein (Malásia)',
  'Saudi Arabian Grand Prix': 'GP da Arábia Saudita', 'Miami Grand Prix': 'GP de Miami', 'Emilia Romagna Grand Prix': 'GP da Emília-Romanha',
  'Canadian Grand Prix': 'GP do Canadá', 'Monaco Grand Prix': 'GP de Mônaco', 'Barcelona Grand Prix': 'GP de Barcelona',
  'Spanish Grand Prix': 'GP da Espanha', 'Austrian Grand Prix': 'GP da Áustria', 'British Grand Prix': 'GP da Grã-Bretanha',
  'Belgian Grand Prix': 'GP da Bélgica', 'Hungarian Grand Prix': 'GP da Hungria', 'Dutch Grand Prix': 'GP da Holanda',
  'Italian Grand Prix': 'GP da Itália', 'Azerbaijan Grand Prix': 'GP do Azerbaijão', 'Singapore Grand Prix': 'GP de Singapura',
  'United States Grand Prix': 'GP dos Estados Unidos', 'Mexico City Grand Prix': 'GP do México', 'Brazilian Grand Prix': 'GP de São Paulo',
  'São Paulo Grand Prix': 'GP de São Paulo', 'Las Vegas Grand Prix': 'GP de Las Vegas', 'Qatar Grand Prix': 'GP do Catar',
  'Abu Dhabi Grand Prix': 'GP de Abu Dhabi',
};
const gpName = (n) => GP_PT[n] || 'GP ' + String(n).replace(/\s*Grand Prix\s*/i, ' ').trim();
const gpShort = (n) => gpName(n).replace(/^GP (d[aeo]s?|de) /, '');
const COUNTRY_PT = {
  Australia: 'Austrália', China: 'China', Japan: 'Japão', USA: 'EUA', Canada: 'Canadá', Monaco: 'Mônaco', Spain: 'Espanha',
  Austria: 'Áustria', UK: 'Reino Unido', Belgium: 'Bélgica', Hungary: 'Hungria', Netherlands: 'Holanda', Italy: 'Itália',
  Azerbaijan: 'Azerbaijão', Malaysia: 'Malásia', Singapore: 'Singapura', Mexico: 'México', Brazil: 'Brasil', Qatar: 'Catar',
  UAE: 'Emirados Árabes', Bahrain: 'Bahrein', 'Saudi Arabia': 'Arábia Saudita',
};
const S_LONG = { FP1: 'Treino Livre 1', FP2: 'Treino Livre 2', FP3: 'Treino Livre 3', SQ: 'Classificação Sprint', SPRINT: 'Sprint', QUALI: 'Classificação', RACE: 'Corrida' };
const S_SHORT = { FP1: 'TL1', FP2: 'TL2', FP3: 'TL3', SQ: 'CL. SPR', SPRINT: 'SPRINT', QUALI: 'CLASS', RACE: 'CORRIDA' };
const S_DUR = { FP1: 60, FP2: 60, FP3: 60, SQ: 45, SPRINT: 45, QUALI: 60, RACE: 120 };
const S_GROUP = (k) => (k.startsWith('FP') ? 'practice' : k === 'QUALI' || k === 'SQ' ? 'quali' : 'race');
const TEAM_COLORS = [
  ['mclaren', '#FF8000'], ['ferrari', '#E8002D'], ['mercedes', '#27F4D2'], ['red bull', '#3671C6'], ['aston', '#229971'],
  ['alpine', '#0093CC'], ['williams', '#64C4FF'], ['haas', '#B6BABD'], ['rb f1', '#6692FF'], ['racing bulls', '#6692FF'],
  ['audi', '#BB0A30'], ['sauber', '#52E252'], ['cadillac', '#C9A227'],
];
const teamColor = (t) => (TEAM_COLORS.find(([k]) => String(t).toLowerCase().includes(k)) || [0, '#71717A'])[1];

/* ---------------- dados ---------------- */
let DATA = store.get('data', null);
let RACES = [];
function prepare(d) {
  (d?.news || []).forEach((n) => { n.title = String(n.title).replace(/^F1\s*[-–:]\s*/i, ''); });
  RACES = (d?.races || []).map((r) => {
    const sessions = (r.sessions || []).map((s) => ({ kind: s.kind, at: new Date(s.at) })).sort((a, b) => a.at - b.at);
    const race = sessions.find((s) => s.kind === 'RACE');
    return { ...r, sessions, raceAt: race ? race.at : new Date(r.date_end), first: sessions[0]?.at || new Date(r.date_start) };
  });
}
prepare(DATA);

async function load(force) {
  try {
    const r = await fetch(`${API}/f1-data${force ? '?t=' + now() : ''}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DATA = await r.json();
    store.set('data', DATA); prepare(DATA); render();
  } catch (e) {
    if (!DATA) view.innerHTML = `<div class="empty">Não consegui carregar os dados agora. Verifique sua internet e tente de novo.<br><br><button class="btn ghost" onclick="load(true)">Tentar de novo</button></div>`;
  }
}

const sessionLive = (s) => now() >= +s.at && now() < +s.at + S_DUR[s.kind] * MIN;
const sessionDone = (s) => now() >= +s.at + S_DUR[s.kind] * MIN;
function currentRace() { return RACES.find((r) => +r.raceAt + 3 * H > now()) || null; }
function raceAfter(r) { return r ? RACES.find((x) => x.round > r.round) || null : null; }
function raceState(r) {
  if (!r) return 'none';
  if (now() > +r.raceAt + 3 * H) return 'done';
  if (r.sessions.some(sessionLive)) return 'live';
  if (now() >= +r.first) return 'weekend';
  if (now() >= +r.first - 3 * DAY) return 'soon';
  return 'upcoming';
}
const nextSession = (r) => r?.sessions.find((s) => !sessionDone(s)) || null;
function dateRange(r) {
  const a = r.first, b = r.raceAt;
  return monShort(a) === monShort(b) ? `${+dayNum(a)}–${+dayNum(b)} ${monShort(b)}` : `${dm(a)}–${dm(b)}`;
}
function countdownText(ms) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), m = Math.floor((ms % H) / MIN), s = Math.floor((ms % MIN) / 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}:${p(m)}:${p(s)}`;
}

/* ---------------- tema ---------------- */
let THEME = store.get('theme', 'dark');
const mqLight = matchMedia('(prefers-color-scheme: light)');
function applyTheme() {
  const t = THEME === 'auto' ? (mqLight.matches ? 'light' : 'dark') : THEME;
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'light' ? '#F4F4F6' : '#0D0D0F';
}
function setTheme(v) { THEME = v; store.set('theme', v); applyTheme(); }
mqLight.addEventListener?.('change', () => { if (THEME === 'auto') applyTheme(); });
applyTheme();

/* ---------------- preferências e push ---------------- */
const DEFAULT_PREFS = { weekend: true, practice: false, quali: true, race: true, news: true, leads: [30] };
let PREFS = { ...DEFAULT_PREFS, ...store.get('prefs', {}) };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function getSub() {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
function b64ToBytes(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
async function post(body) {
  const r = await fetch(`${API}/f1-subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
async function enablePush() {
  if (isIOS && !isStandalone) { toast('No iPhone, adicione o app à Tela de Início primeiro.'); go('#boas-vindas'); return false; }
  if (!pushSupported) { toast('Este navegador não aceita notificações.'); return false; }
  if (!DATA?.vapid) { toast('Aguarde os dados carregarem e tente de novo.'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Permissão negada. Libere nas configurações do celular.'); render(); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(DATA.vapid) });
    await post({ action: 'save', subscription: sub.toJSON(), prefs: PREFS });
    store.set('subscribed', true);
    post({ action: 'test', endpoint: sub.endpoint }).catch(() => {});
    toast('Notificações ativadas!');
    return true;
  } catch (e) {
    toast('Não consegui ativar: ' + e.message);
    return false;
  }
}
async function disablePush() {
  const sub = await getSub().catch(() => null);
  if (sub) { await post({ action: 'remove', endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  store.set('subscribed', false); toast('Notificações desativadas.'); render();
}
let savePrefsTimer;
function savePrefs(msg) {
  store.set('prefs', PREFS);
  if (msg) toast(msg);
  clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(async () => {
    const sub = await getSub().catch(() => null);
    if (sub) post({ action: 'save', subscription: sub.toJSON(), prefs: PREFS }).catch(() => toast('Sem conexão: as preferências serão salvas depois.'));
  }, 400);
}

/* ---------------- caixa de entrada (gravada pelo service worker) ---------------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('rf1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('inbox', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function inbox() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const out = [];
      const c = db.transaction('inbox').objectStore('inbox').openCursor(null, 'prev');
      c.onsuccess = () => { const cur = c.result; if (cur && out.length < 30) { out.push(cur.value); cur.continue(); } else res(out); };
      c.onerror = () => res([]);
    });
  } catch { return []; }
}
async function updateDot() {
  const items = await inbox();
  const seen = store.get('seen', 0);
  document.querySelector('.tabbar .dot').hidden = !(items[0] && items[0].at > seen);
}

/* ---------------- calendário (.ics) ---------------- */
function icsFor(races) {
  const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RODRIGUES F1//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:RODRIGUES F1'];
  for (const r of races) for (const s of r.sessions) {
    lines.push('BEGIN:VEVENT', `UID:rf1-${DATA.season}-${r.round}-${s.kind}@rodrigues-f1`, `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(s.at)}`, `DTEND:${z(new Date(+s.at + S_DUR[s.kind] * MIN))}`,
      `SUMMARY:${S_LONG[s.kind]} · ${gpName(r.name)}`, `LOCATION:${(r.circuit || '').replace(/,/g, '\\,')}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${S_LONG[s.kind]}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = races.length === 1 ? `rodrigues-f1-gp-${races[0].round}.ics` : 'rodrigues-f1-temporada.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function share(title, url) {
  const full = new URL(url, location.href).href;
  if (navigator.share) { try { await navigator.share({ title, url: full }); } catch { /* cancelado */ } }
  else { try { await navigator.clipboard.writeText(full); toast('Link copiado.'); } catch { toast(full); } }
}

/* ---------------- componentes ---------------- */
const img = (src, cls, alt = '') => src
  ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls}'}))">`
  : `<div class="${cls}" aria-hidden="true"></div>`;
const newsItem = (n) => `<a class="item" href="#materia/${esc(n.id)}"><div class="tx"><span class="kicker">${esc(n.source)}</span><h4>${esc(n.title)}</h4><div class="meta" style="margin-top:6px">${ago(new Date(n.published_at))}</div></div>${img(n.image, 'th')}</a>`;
const newsLead = (n) => `<a class="lead" href="#materia/${esc(n.id)}">${img(n.image, 'ph')}<div class="tx"><span class="kicker red">${esc(n.source)}</span><h3>${esc(n.title)}</h3>${n.summary ? `<p>${esc(n.summary)}</p>` : ''}<p class="meta" style="margin-top:10px">${ago(new Date(n.published_at))}</p></div></a>`;
function strip(r) {
  const nx = nextSession(r);
  return `<div class="strip">${r.sessions.map((s) => {
    const live = sessionLive(s), done = sessionDone(s), isNext = nx === s && !live;
    const cls = live ? 'live-s' : isNext ? 'now' : s.kind === 'RACE' && !done ? 'race' : '';
    const sub = live ? 'ao vivo' : done ? `${relDay(s.at)} ✓` : (relDay(s.at) === 'hoje' ? hhmm(s.at) : `${relDay(s.at)} ${hhmm(s.at)}`);
    return `<div class="${cls}"><b>${S_SHORT[s.kind]}</b><span>${sub}</span></div>`;
  }).join('')}</div>`;
}
function stateBadge(st, r) {
  const live = r.sessions.find(sessionLive);
  if (st === 'live') return `<span class="live pulse">Ao vivo · ${S_LONG[live.kind]}</span>`;
  if (st === 'weekend') return '<span class="live">Em andamento</span>';
  if (st === 'soon') return '<span class="live" style="color:var(--amber)">Este fim de semana</span>';
  return '<span class="live" style="color:var(--soft)">Próximo GP</span>';
}
function nextBlock(r) {
  const live = r.sessions.find(sessionLive);
  if (live) return `<div class="next"><div><div class="meta">Acontecendo agora · começou ${hhmm(live.at)}</div><div class="t">${S_LONG[live.kind]}</div></div><span class="live pulse">Ao vivo</span></div>`;
  const nx = nextSession(r);
  if (!nx) return '';
  return `<div class="next"><div><div class="meta">Próxima sessão · ${relDay(nx.at)} ${hhmm(nx.at)}</div><div class="t">${S_LONG[nx.kind]}</div></div><div class="count" data-cd="${nx.at.toISOString()}">${countdownText(+nx.at - now())}</div></div>`;
}

/* ---------------- telas ---------------- */
function vInicio() {
  const r = currentRace();
  const news = DATA.news || [];
  let html = `<header class="page-h">${logo()}<a href="#alertas" class="round-btn" aria-label="Alertas">${I.bell}</a></header>`;
  if (r) {
    const st = raceState(r);
    html += `<section class="hero" aria-label="Fim de semana de corrida">
      <div class="hero-top"><span class="kicker">Fim de semana de corrida</span>${stateBadge(st, r)}</div>
      <div class="hero-title"><div><h1>${esc(gpName(r.name))}</h1><p class="where">${esc(r.circuit || '')} · ${esc(r.locality || '')} · ${dateRange(r)}</p></div>${track(r.locality)}</div>
      ${nextBlock(r)}${strip(r)}
      <div style="padding:16px"><a class="btn primary" href="#evento/${r.round}">Ver fim de semana completo ${I.chev}</a></div></section>`;
    const nx = raceAfter(r);
    if (nx) {
      const days = Math.max(1, Math.round((+nx.raceAt - now()) / DAY));
      html += `<a class="row-link" href="#evento/${nx.round}"><div style="display:flex;align-items:center;gap:12px"><div class="datebox"><small>${monShort(nx.raceAt)}</small><b>${dayNum(nx.raceAt)}</b></div><div><div class="meta">Próximo GP · em ${days} dias</div><div style="font-size:15px;font-weight:600">${esc(gpName(nx.name))}</div></div></div>${I.chev}</a>`;
    }
  } else {
    html += `<div class="empty">A temporada ${DATA.season} terminou. Os horários da próxima aparecem aqui assim que forem divulgados.</div>`;
  }
  const lr = DATA.lastResult;
  if (lr?.top?.length) {
    const w = lr.top[0];
    html += `<a class="row-link" href="#evento/${lr.round}"><div style="display:flex;align-items:center;gap:12px"><div class="datebox" style="color:var(--amber)">${I.trophy}</div><div><div class="meta">Vencedor · ${esc(gpName(lr.name))}</div><div style="font-size:15px;font-weight:600">${esc(w.name)}</div></div></div>${I.chev}</a>`;
  }
  html += `<div class="sec-h"><h2>Principais matérias</h2><a href="#noticias">Ver todas</a></div>`;
  if (news.length) html += newsLead(news[0]) + `<div class="list" style="margin-top:8px">${news.slice(1, 5).map(newsItem).join('')}</div>`;
  else html += '<div class="empty">As notícias aparecem aqui em instantes.</div>';
  return html;
}

let newsFilter = 'Tudo';
function vNoticias() {
  const all = DATA.news || [];
  const sources = ['Tudo', ...new Set(all.map((n) => n.source))];
  const list = newsFilter === 'Tudo' ? all : all.filter((n) => n.source === newsFilter);
  const r = currentRace(), nx = r && nextSession(r);
  let html = `<header class="page-h"><h1>Notícias</h1></header>
    <div class="chips" role="group" aria-label="Filtrar por veículo">${sources.map((s) => `<button class="chip ${s === newsFilter ? 'on' : ''}" aria-pressed="${s === newsFilter}" data-filter="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  if (nx && +nx.at - now() < 2 * DAY) html += `<a class="banner" href="#evento/${r.round}"><span class="live ${sessionLive(nx) ? 'pulse' : ''}" style="font-size:0"></span><span style="flex:1">${esc(gpShort(r.name))} · <b>${S_LONG[nx.kind]} ${sessionLive(nx) ? 'ao vivo' : relDay(nx.at) + ' ' + hhmm(nx.at)}</b></span>${I.chev}</a>`;
  if (!list.length) return html + '<div class="empty">Nenhuma notícia por aqui ainda.</div>';
  html += newsLead(list[0]);
  const groups = new Map();
  for (const n of list.slice(1)) {
    const d = new Date(n.published_at), rd = relDay(d);
    const k = rd === 'hoje' ? 'Hoje' : rd === 'ontem' ? 'Ontem' : `${wdLong(d)}, ${dm(d)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  for (const [k, items] of groups) html += `<div class="label">${esc(k)}</div><div class="list">${items.map(newsItem).join('')}</div>`;
  return html;
}

function vMateria(id) {
  const n = (DATA.news || []).find((x) => x.id === id);
  if (!n) return `<header class="page-h"><a href="#noticias" class="round-btn" aria-label="Voltar">${I.back}</a></header><div class="empty">Essa matéria não está mais disponível.</div>`;
  const r = currentRace();
  const more = (DATA.news || []).filter((x) => x.id !== id).slice(0, 2);
  return `<div class="art-ph">${n.image ? `<img src="${esc(n.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <div class="tools"><a href="#noticias" class="round-btn" aria-label="Voltar" data-back>${I.back}</a><button class="round-btn" aria-label="Compartilhar" data-share="${esc(n.title)}" data-url="${esc(n.link)}">${I.share}</button></div></div>
    <article class="art"><span class="kicker red">${esc(n.source)}</span><h1>${esc(n.title)}</h1>
      <div class="by"><b>${esc(n.source)}</b> · ${fmt(new Date(n.published_at), { day: 'numeric', month: 'long' })}, ${hhmm(new Date(n.published_at))}</div>
      ${n.summary ? `<p>${esc(n.summary)}</p>` : ''}
      <p class="note">Esta é uma prévia. A matéria completa está no site do ${esc(n.source)}.</p></article>
    <div style="padding:16px 20px 0"><a class="btn primary" href="${esc(n.link)}" target="_blank" rel="noopener">Ler matéria completa ${I.ext}</a></div>
    ${r ? `<a class="row-link" style="margin:16px 20px 0" href="#evento/${r.round}"><div style="display:flex;align-items:center;gap:12px"><div class="datebox" style="background:var(--red-bg);color:var(--red)">${I.flag}</div><div><div class="meta">Fim de semana</div><div style="font-size:14px;font-weight:600">${esc(gpName(r.name))}</div></div></div>${I.chev}</a>` : ''}
    ${more.length ? `<div class="label" style="padding-left:20px">Leia também</div><div class="list" style="margin:0 20px">${more.map(newsItem).join('')}</div>` : ''}`;
}

let calTab = 'next';
function vCalendario() {
  const cur = currentRace();
  const upcoming = RACES.filter((r) => +r.raceAt + 3 * H > now());
  const past = RACES.filter((r) => +r.raceAt + 3 * H <= now()).reverse();
  const last = RACES[RACES.length - 1];
  const row = (r, isPast) => {
    const sprint = r.sessions.some((s) => s.kind === 'SPRINT');
    const race = r.sessions.find((s) => s.kind === 'RACE');
    const won = isPast && DATA.lastResult?.round === r.round ? ` · venceu ${esc(DATA.lastResult.top[0]?.name || '')}` : '';
    return `<a href="#evento/${r.round}" class="${isPast ? 'past' : ''}">
      <div class="datebox"><small>${monShort(r.first) === monShort(r.raceAt) ? monShort(r.raceAt) : monShort(r.first) + '–' + monShort(r.raceAt)}</small><b>${dayNum(r.first)}–${dayNum(r.raceAt)}</b></div>
      <div class="n"><b>${esc(gpName(r.name))}</b>${r.country === 'Brazil' ? '<span class="badge home">CASA</span>' : ''}${sprint ? '<span class="badge spr">SPRINT</span>' : ''}${last && r.round === last.round ? '<span class="badge fin">FINAL</span>' : ''}
      <div class="meta" style="margin-top:2px">${isPast ? `Etapa ${r.round} · concluída${won}` : `${esc(r.locality || '')} · Corrida ${race ? wdShort(race.at) + ' ' + hhmm(race.at) : ''}`}</div></div>${track(r.locality, 'trk mini') || I.chev}</a>`;
  };
  let html = `<header class="page-h"><h1>Calendário ${DATA.season}</h1></header><p class="sub">Todos os horários de São Paulo</p>
    <div class="seg" role="tablist"><button role="tab" aria-selected="${calTab === 'next'}" class="${calTab === 'next' ? 'on' : ''}" data-cal="next">Próximos</button><button role="tab" aria-selected="${calTab === 'past'}" class="${calTab === 'past' ? 'on' : ''}" data-cal="past">Concluídos</button></div>`;
  if (calTab === 'next') {
    if (cur && ['live', 'weekend', 'soon'].includes(raceState(cur))) {
      const nx = nextSession(cur);
      const race = cur.sessions.find((s) => s.kind === 'RACE');
      html += `<a class="cal-hero" href="#evento/${cur.round}"><div style="display:flex;justify-content:space-between;align-items:center">${stateBadge(raceState(cur), cur)}<span class="meta">${dateRange(cur)}</span></div>
        <div class="nm">${esc(gpName(cur.name))}</div><div class="meta">${esc(cur.locality || '')}</div>
        <div class="pills">${nx ? `<span class="a">${S_LONG[nx.kind]} ${relDay(nx.at)} ${hhmm(nx.at)}</span>` : ''}${race && nx !== race ? `<span>Corrida ${wdShort(race.at)} ${hhmm(race.at)}</span>` : ''}</div></a>`;
      html += `<div class="label">Próximas etapas</div><div class="cal">${upcoming.filter((r) => r !== cur).map((r) => row(r)).join('')}</div>`;
    } else {
      html += `<div class="cal">${upcoming.map((r) => row(r)).join('') || '<div class="empty">Sem etapas futuras nesta temporada.</div>'}</div>`;
    }
    if (upcoming.length) html += `<div style="padding:16px"><button class="btn ghost" style="width:100%" data-ics="season">${I.cal} Pôr as próximas sessões na agenda do celular</button></div>`;
  } else {
    html += `<div class="cal">${past.map((r) => row(r, true)).join('') || '<div class="empty">Nenhuma etapa concluída ainda.</div>'}</div>`;
  }
  return html;
}

function vEvento(round) {
  const r = RACES.find((x) => x.round === +round);
  if (!r) return `<header class="page-h"><a href="#calendario" class="round-btn" aria-label="Voltar">${I.back}</a></header><div class="empty">GP não encontrado.</div>`;
  const st = raceState(r);
  const nx = nextSession(r), live = r.sessions.find(sessionLive);
  const subscribed = store.get('subscribed', false);
  let cdHtml = '';
  if (live) cdHtml = `<div class="cd"><div class="meta">Acontecendo agora</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><b style="font-size:20px">${S_LONG[live.kind]}</b><span class="live pulse">Ao vivo</span></div></div>`;
  else if (nx) cdHtml = `<div class="cd"><div class="meta">${S_LONG[nx.kind]} começa em</div><div class="grid" data-cd="${nx.at.toISOString()}" data-fmt="grid">${cdGrid(+nx.at - now())}</div></div>`;
  const tag = st === 'live' ? '<span class="tag">Ao vivo</span>' : st === 'weekend' ? '<span class="tag">Fim de semana em andamento</span>'
    : st === 'done' ? '<span class="tag dim">Concluído</span>' : st === 'soon' ? '<span class="tag">Este fim de semana</span>' : `<span class="tag dim">Etapa ${r.round}</span>`;
  let html = `<section class="ev-hero">${track(r.locality, 'trk bgtrk')}<div class="tools"><a href="#calendario" class="round-btn" aria-label="Voltar" data-back>${I.back}</a><button class="round-btn" aria-label="Compartilhar" data-share="${esc(gpName(r.name))}" data-url="#evento/${r.round}">${I.share}</button></div>
    <div style="margin-top:18px">${tag}<h1>${esc(gpName(r.name))}</h1><p class="where">${esc(r.circuit || '')} · ${esc(r.locality || '')}${r.country ? ', ' + esc(COUNTRY_PT[r.country] || r.country) : ''}</p><p class="when">${dateRange(r)} · etapa ${r.round}</p></div>
    ${cdHtml}
    ${st !== 'done' ? `<div class="ev-actions">${subscribed ? `<a class="btn primary" href="#alertas">${I.bell} Avisos ativos · ajustar</a>` : `<button class="btn primary" data-enable>${I.bell} Avisar antes das sessões</button>`}
      <button class="round-btn" style="width:48px;height:48px;border-radius:12px;background:var(--bg);border:1px solid var(--hero-line)" aria-label="Adicionar à agenda do celular" data-ics="${r.round}">${I.cal}</button></div>` : ''}</section>
    <div class="sec-h" style="padding-top:22px"><h2>Programação</h2><span class="meta">Horário de São Paulo</span></div>`;
  const byDay = new Map();
  for (const s of r.sessions) { const k = dayKey(s.at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(s); }
  for (const [, list] of byDay) {
    const d = list[0].at, rd = relDay(d);
    html += `<div class="label">${wdLong(d)} · ${dm(d)}${rd === 'hoje' ? ' · hoje' : rd === 'amanhã' ? ' · amanhã' : ''}</div><div class="ses">`;
    for (const s of list) {
      const isLive = sessionLive(s), done = sessionDone(s), isNext = s === nx && !isLive;
      const g = S_GROUP(s.kind), on = subscribed && PREFS[g];
      const note = isLive ? 'Ao vivo agora' : done ? 'Concluído' : isNext ? `Próxima · em ${countdownText(+s.at - now()).replace(/:\d\d$/, '').replace(':', 'h')}` : `${S_DUR[s.kind]} min`;
      html += `<div class="ses-row ${isLive ? 'live' : done ? 'done' : isNext ? 'next' : ''}"><div class="h">${hhmm(s.at)}</div><div class="n"><b>${S_LONG[s.kind]}</b><span>${note}</span></div>
        ${done ? '' : `<button class="bell ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'Desativar' : 'Ativar'} avisos de ${S_LONG[s.kind]}" data-bell="${g}">${I.bell}</button>`}</div>`;
    }
    html += '</div>';
  }
  if (DATA.lastResult?.round === r.round && DATA.lastResult.top?.length) {
    html += `<div class="sec-h"><h2>Resultado da corrida</h2></div><div class="tbl" style="margin-top:0">${DATA.lastResult.top.map((x) => `<div class="r"><span class="ps">${x.pos}</span><span class="cl" style="background:${teamColor(x.team)}"></span><span class="nm"><b>${esc(x.name)}</b><span>${esc(x.team || '')}</span></span><span class="df" style="width:auto">${esc(x.time || '')}</span></div>`).join('')}</div>`;
  }
  html += `<div class="sec-h"><h2>Circuito</h2></div><div class="circ">${track(r.locality, 'trk', 'Traçado do ' + (r.circuit || 'circuito'))}<div><div class="nm">${esc(r.circuit || '')}</div><div class="meta" style="text-align:center">${esc(r.locality || '')}${r.country ? ', ' + esc(COUNTRY_PT[r.country] || r.country) : ''} · o ponto vermelho marca a largada</div></div></div>`;
  const keys = [r.locality, gpShort(r.name), COUNTRY_PT[r.country]].filter(Boolean).map((k) => k.toLowerCase());
  const rel = (DATA.news || []).filter((n) => keys.some((k) => (n.title + ' ' + (n.summary || '')).toLowerCase().includes(k))).slice(0, 4);
  if (rel.length) html += `<div class="sec-h"><h2>Notícias do GP</h2><a href="#noticias">Ver todas</a></div><div class="list">${rel.map(newsItem).join('')}</div>`;
  return html;
}
function cdGrid(ms) {
  ms = Math.max(0, ms);
  const p = (n) => String(n).padStart(2, '0');
  const parts = [[Math.floor(ms / DAY), 'dias'], [Math.floor((ms % DAY) / H), 'horas'], [Math.floor((ms % H) / MIN), 'min'], [Math.floor((ms % MIN) / 1000), 'seg']];
  return parts.map(([v, l]) => `<div><b>${p(v)}</b><span>${l}</span></div>`).join('');
}

let champTab = 'drivers', showAll = false;
function vCampeonato() {
  const d = DATA.drivers || [], t = DATA.teams || [];
  const rr = RACES.find((x) => x.round === +DATA.standingsRound);
  let html = `<header class="page-h"><h1>Campeonato ${DATA.season}</h1></header>
    <p class="sub">${rr ? `Atualizado após a etapa ${rr.round} · ${esc(gpName(rr.name))}` : 'Pontuação oficial da temporada'}</p>
    <div class="seg" role="tablist"><button role="tab" aria-selected="${champTab === 'drivers'}" class="${champTab === 'drivers' ? 'on' : ''}" data-champ="drivers">Pilotos</button><button role="tab" aria-selected="${champTab === 'teams'}" class="${champTab === 'teams' ? 'on' : ''}" data-champ="teams">Construtores</button></div>`;
  if (champTab === 'drivers') {
    if (!d.length) return html + '<div class="empty">A pontuação aparece após a primeira corrida.</div>';
    const lead = +d[0].points;
    const av = (x) => x.photo
      ? `<div class="av photo" style="--c:${teamColor(x.team)}"><img src="${esc(x.photo)}" alt="${esc(x.given_name + ' ' + x.family_name)}" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('photo');this.parentNode.style.background='${teamColor(x.team)}';this.replaceWith('${esc(x.code || '')}')"></div>`
      : `<div class="av" style="background:${teamColor(x.team)}">${esc(x.code || x.family_name.slice(0, 3).toUpperCase())}</div>`;
    const pod = (x, cls) => x ? `<div class="${cls}">${av(x)}<div class="pos">${x.position}º</div><div class="nm">${esc(x.family_name)}</div><div class="tm">${esc(x.team || '')}</div><div class="pt">${+x.points} pts</div></div>` : '<div></div>';
    html += `<div class="podium">${pod(d[1], 'p2')}${pod(d[0], 'p1')}${pod(d[2], 'p3')}</div>`;
    if (d.slice(0, 3).some((x) => x.photo)) html += '<p class="credit">Fotos: Wikipédia / Wikimedia Commons (licenças livres).</p>';
    const rest = d.slice(3, showAll ? d.length : 10);
    html += `<div class="tbl"><div class="hd"><span class="ps">POS</span><span class="nm">PILOTO</span><span class="pt">PTS</span><span class="df">DIF</span></div>
      ${rest.map((x) => `<div class="r"><span class="ps">${x.position}</span><span class="cl" style="background:${teamColor(x.team)}"></span><span class="nm"><b>${esc(x.given_name)} ${esc(x.family_name)}</b><span>${esc(x.team || '')}${x.wins > 0 ? ` · ${x.wins} vitória${x.wins > 1 ? 's' : ''}` : ''}</span></span><span class="pt">${+x.points}</span><span class="df">−${lead - x.points}</span></div>`).join('')}
      ${d.length > 10 ? `<button class="more" data-all>${showAll ? 'Mostrar menos' : 'Ver todos os pilotos'}</button>` : ''}</div>`;
  } else {
    if (!t.length) return html + '<div class="empty">A pontuação aparece após a primeira corrida.</div>';
    const lead = +t[0].points || 1;
    html += `<div class="tbl" style="margin-top:0">${t.map((x) => `<div class="cons"><div class="top"><span class="ps" style="${x.position === 1 ? 'color:var(--amber)' : ''}">${x.position}</span><span class="nm">${esc(x.team)}</span><span class="pt">${+x.points} pts</span></div><div class="track"><div class="fill" style="width:${Math.max(2, (x.points / lead) * 100)}%;background:${teamColor(x.team)}"></div></div></div>`).join('')}</div>`;
  }
  return html;
}

async function vAlertas() {
  const perm = pushSupported ? Notification.permission : 'unsupported';
  const sub = await getSub().catch(() => null);
  const active = !!sub && perm === 'granted';
  if (!active && store.get('subscribed', false)) store.set('subscribed', false);
  const items = await inbox();
  store.set('seen', now()); updateDot();
  let status;
  if (isIOS && !isStandalone) status = `<div class="status warn">${I.bell}<div>No iPhone, as notificações só funcionam com o app instalado: toque em <b>Compartilhar › Adicionar à Tela de Início</b> e abra por lá.</div></div>`;
  else if (perm === 'unsupported') status = `<div class="status off">${I.bell}<div>Este navegador não aceita notificações. Tente o Chrome no Android ou o app instalado no iPhone.</div></div>`;
  else if (perm === 'denied') status = `<div class="status warn">${I.bell}<div>As notificações estão bloqueadas. Libere nas configurações do navegador ou do celular.</div></div>`;
  else if (active) status = `<div class="status ok">${I.bell}<div style="flex:1">Notificações ativas neste aparelho.</div><button class="btn ghost" style="min-height:40px;color:inherit" data-test>Testar</button></div>`;
  else status = `<div class="status off">${I.bell}<div style="flex:1">Notificações desligadas.</div><button class="btn primary" style="min-height:40px" data-enable>Ativar</button></div>`;
  const sw = (k, t, s) => `<div class="pref"><div class="tx"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div><button class="sw" role="switch" aria-checked="${!!PREFS[k]}" aria-label="${t}" data-pref="${k}"></button></div>`;
  const icon = (u) => (u || '').includes('materia') ? I.news : (u || '').includes('evento') ? I.clock : I.flag;
  return `<header class="page-h"><h1>Alertas</h1></header><div style="margin-top:12px">${status}</div>
    <div class="label">Recebidos</div>
    ${items.length ? `<div class="card inbox">${items.map((x) => `<a href="${esc(x.url || '#inicio')}"><div class="ic">${icon(x.url)}</div><div class="tx"><b>${esc(x.title)}</b><span>${esc(x.body || '')}</span></div><time>${relDay(new Date(x.at)) === 'hoje' ? hhmm(new Date(x.at)) : relDay(new Date(x.at))}</time></a>`).join('')}</div>` : '<div class="empty" style="margin-top:0">Os avisos que você receber ficam guardados aqui.</div>'}
    <div class="label">O que avisar</div>
    <div class="card">${sw('weekend', 'Início do fim de semana', 'Na véspera, com a programação do GP')}${sw('practice', 'Treinos livres', 'TL1, TL2 e TL3')}${sw('quali', 'Classificação e Classificação Sprint')}${sw('race', 'Corrida e Sprint')}${sw('news', 'Principais matérias', 'No máximo 2 por dia')}</div>
    <div class="label">Aparência</div>
    <div class="seg theme-seg" style="margin-top:0" role="radiogroup" aria-label="Aparência">${[['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) => `<button role="radio" aria-checked="${THEME === v}" class="${THEME === v ? 'on' : ''}" data-theme-set="${v}">${l}</button>`).join('')}</div>
    <div class="label">Avisar antes da sessão</div>
    <div class="leads">${[[15, '15 min'], [30, '30 min'], [60, '1 h'], [1440, '1 dia']].map(([v, l]) => `<button aria-pressed="${PREFS.leads.includes(v)}" data-lead="${v}">${l}</button>`).join('')}</div>
    <p class="help">Dá para escolher mais de um. Todos os horários seguem o fuso de São Paulo.</p>
    ${active ? '<div style="padding:24px 16px 0"><button class="btn ghost" style="width:100%" data-disable>Desativar notificações neste aparelho</button></div>' : ''}
    <p class="help" style="margin-top:24px">Dados de calendário e campeonato: Jolpica F1 API. Notícias: Motorsport.com e F1Mania. ${DATA.updatedAt ? 'Atualizado ' + ago(new Date(DATA.updatedAt)) + '.' : ''} Este app não é oficial da Fórmula 1.</p>`;
}

function vBoasVindas() {
  const needInstall = isIOS && !isStandalone;
  return `<div class="welcome"><div style="text-align:center">${logo().replace('class="logo"', 'class="logo" style="transform:scale(1.9);transform-origin:top center;margin-bottom:40px"')}</div>
    <h1>Não perca nenhuma largada</h1><p>Avisamos antes de cada treino, classificação e corrida, sempre no horário de São Paulo.</p>
    <div style="margin-top:22px"><div class="feat">${I.clock}<span>30 min antes de cada sessão (você ajusta)</span></div>
    <div class="feat">${I.flag}<span>Início de cada fim de semana de corrida</span></div><div class="feat">${I.news}<span>Matérias principais, sem exagero</span></div></div>
    ${needInstall ? `<div class="ios"><b>No iPhone:</b> toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em <b>Adicionar à Tela de Início</b>. Abra o RODRIGUES F1 pela tela de início para ativar os avisos.</div>` : ''}
    <div class="end">${needInstall ? '' : '<button class="btn primary" data-enable data-after="#inicio">Ativar notificações</button>'}<a class="btn ghost" href="#inicio" data-skip>${needInstall ? 'Continuar sem avisos' : 'Agora não'}</a></div></div>`;
}

/* ---------------- roteador ---------------- */
let lastRoute = '', lastNav = 0;
function go(h) { location.hash = h; }
async function render() {
  if (!DATA) {
    view.innerHTML = `<header class="page-h">${logo()}</header><div class="hero skeleton" style="height:360px;border:0"></div><div class="lead skeleton" style="height:260px;margin-top:16px"></div>`;
    return;
  }
  const h = location.hash.replace(/^#/, '') || (store.get('welcomed', false) ? 'inicio' : 'boas-vindas');
  const [route, arg] = h.split('/');
  document.body.classList.toggle('hide-tabs', route === 'boas-vindas');
  const tab = { evento: 'calendario', materia: 'noticias' }[route] || route;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  const map = { inicio: vInicio, noticias: vNoticias, materia: () => vMateria(arg), calendario: vCalendario, evento: () => vEvento(arg), campeonato: vCampeonato, alertas: vAlertas, 'boas-vindas': vBoasVindas };
  const fn = map[route] || vInicio;
  const html = await fn();
  const y = h === lastRoute ? scrollY : 0;
  view.innerHTML = html;
  if (h !== lastRoute) { scrollTo(0, 0); lastRoute = h; } else scrollTo(0, y);
  if (route === 'boas-vindas') store.set('welcomed', true);
}
addEventListener('hashchange', render);

/* ---------------- interações ---------------- */
view.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a');
  if (!t) return;
  const ds = t.dataset;
  if ('back' in ds && lastNav > 1) { e.preventDefault(); history.back(); return; }
  if (ds.filter) { newsFilter = ds.filter; render(); }
  else if (ds.cal) { calTab = ds.cal; render(); }
  else if (ds.champ) { champTab = ds.champ; showAll = false; render(); }
  else if ('all' in ds) { showAll = !showAll; render(); }
  else if (ds.share) { e.preventDefault(); share(ds.share, ds.url); }
  else if (ds.ics) { icsFor(ds.ics === 'season' ? RACES.filter((r) => +r.raceAt > now()) : RACES.filter((r) => r.round === +ds.ics)); }
  else if ('enable' in ds) { t.disabled = true; const ok = await enablePush(); t.disabled = false; if (ds.after && ok) go(ds.after); else render(); }
  else if ('disable' in ds) { disablePush(); }
  else if ('test' in ds) {
    const sub = await getSub(); if (!sub) return;
    try { await post({ action: 'test', endpoint: sub.endpoint }); toast('Aviso de teste enviado.'); } catch (err) { toast('Falhou: ' + err.message); }
  }
  else if (ds.themeSet) { setTheme(ds.themeSet); render(); }
  else if (ds.pref) { PREFS[ds.pref] = !PREFS[ds.pref]; t.setAttribute('aria-checked', PREFS[ds.pref]); savePrefs(); }
  else if (ds.lead) {
    const v = +ds.lead, has = PREFS.leads.includes(v);
    if (has && PREFS.leads.length === 1) { toast('Deixe pelo menos uma antecedência marcada.'); return; }
    PREFS.leads = has ? PREFS.leads.filter((x) => x !== v) : [...PREFS.leads, v].sort((a, b) => a - b);
    t.setAttribute('aria-pressed', !has); savePrefs();
  }
  else if (ds.bell) {
    const names = { practice: 'treinos livres', quali: 'classificação', race: 'corrida e sprint' };
    if (!store.get('subscribed', false)) {
      PREFS[ds.bell] = true; store.set('prefs', PREFS);
      if (await enablePush()) render();
      return;
    }
    PREFS[ds.bell] = !PREFS[ds.bell];
    savePrefs(`Avisos de ${names[ds.bell]} ${PREFS[ds.bell] ? 'ativados' : 'desativados'} para todos os GPs.`);
    render();
  }
});
addEventListener('hashchange', () => { lastNav++; });

/* contagem regressiva ao vivo */
setInterval(() => {
  let rerender = false;
  document.querySelectorAll('[data-cd]').forEach((el) => {
    const ms = new Date(el.dataset.cd) - now();
    if (ms <= 0) rerender = true;
    if (el.dataset.fmt === 'grid') el.innerHTML = cdGrid(ms); else el.textContent = countdownText(ms);
  });
  if (rerender) render();
}, 1000);

/* ---------------- início ---------------- */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !window.__rf1Reloaded) { window.__rf1Reloaded = true; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'push') { updateDot(); if (location.hash.startsWith('#alertas')) render(); } });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { load(); updateDot(); } });
setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5 * MIN);
render(); load(); updateDot();
window.load = load;
