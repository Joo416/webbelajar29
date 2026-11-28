/* =====================================================================
   PENCARIAN YOUTUBE — dipakai panel musik di halaman utama.

   Keamanan: setiap permintaan wajib membawa Firebase ID token
   (`Authorization: Bearer <idToken>`) milik pengguna yang sudah masuk.
   Token diverifikasi ke Identity Toolkit Firebase memakai API key publik
   web (bukan service account), jadi endpoint ini tidak bisa dipakai orang
   luar sebagai proxy pencarian gratis.

   Pencarian memakai YouTube Data API bila YOUTUBE_API_KEY tersedia.
   Tanpa key, endpoint memakai InnerTube (API web publik YouTube) lalu
   membaca halaman hasil sebagai cadangan. Tidak ada video yang diunduh;
   pemutaran tetap lewat IFrame Player resmi di browser pengguna.
   ===================================================================== */
'use strict';

/* API key web Firebase memang publik (dikirim ke browser di
   rb-firebase-config.js). Env var hanya untuk mengganti proyek. */
const FIREBASE_WEB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDKv_cb50KmpAPv8qxVGspsFQPWPT7Ym2w';
const INNERTUBE_KEY = process.env.YOUTUBE_INNERTUBE_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* Cache verifikasi singkat: satu pencarian bisa memicu beberapa permintaan. */
const TOKEN_CACHE = new Map();
const TOKEN_TTL = 60000;

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function bearer(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (m) return m[1].trim();
  const q = (req.query && (req.query.token || req.query.access_token)) || '';
  return typeof q === 'string' ? q.trim() : '';
}

function jwtExpiry(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return 0;
    const pad = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(pad, 'base64').toString('utf8'));
    return Number(json.exp || 0) * 1000;
  } catch (e) { return 0; }
}

async function verifyIdToken(token) {
  if (!token) throw fail(401, 'Token login tidak dikirim. Masuk dulu lalu buka panel musik lagi.');
  const hit = TOKEN_CACHE.get(token);
  if (hit && Date.now() - hit.at < TOKEN_TTL) return hit.user;

  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_WEB_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  if (!r.ok) {
    /* 400 = token tidak valid/kedaluwarsa. */
    throw fail(401, 'Sesi login tidak valid atau sudah kedaluwarsa. Muat ulang halaman lalu masuk lagi.');
  }
  const j = await r.json();
  const u = (j && j.users && j.users[0]) || null;
  if (!u) throw fail(401, 'Token login tidak dikenali Firebase.');
  if (u.emailVerified === false) throw fail(403, 'Email akun ini belum diverifikasi, jadi pencarian musik dikunci.');
  const user = { uid: String(u.localId || ''), email: String(u.email || '') };
  TOKEN_CACHE.set(token, { at: Date.now(), user });
  if (TOKEN_CACHE.size > 500) TOKEN_CACHE.clear();
  return user;
}

function cut(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 140); }

function itemOf(id, title, channel, duration) {
  return {
    id: id,
    title: cut(title || 'Video YouTube', 140),
    channel: cut(channel || '', 80),
    duration: cut(duration || '', 12),
    thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg'
  };
}

/* ---------- 1. YouTube Data API resmi (bila key tersedia) ---------- */
async function official(q, key) {
  const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&hl=id&q='
    + encodeURIComponent(q) + '&key=' + encodeURIComponent(key);
  const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('YouTube Data API membalas ' + r.status);
  const j = await r.json();
  return (j.items || []).map(function (x) {
    const id = x.id && x.id.videoId;
    if (!id) return null;
    const sn = x.snippet || {};
    return itemOf(id, sn.title, sn.channelTitle, '');
  }).filter(Boolean);
}

/* ---------- 2. InnerTube: API web publik YouTube, tanpa key ---------- */
function walk(node, out) {
  if (!node || typeof node !== 'object' || out.length >= 12) return;
  if (Array.isArray(node)) { node.forEach(function (x) { walk(x, out); }); return; }
  if (node.videoRenderer) {
    const v = node.videoRenderer;
    const id = v.videoId;
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && !out.some(function (o) { return o.id === id; })) {
      const t = v.title && v.title.runs && v.title.runs[0] ? v.title.runs[0].text : (v.title && v.title.simpleText);
      const ch = v.ownerText && v.ownerText.runs && v.ownerText.runs[0] ? v.ownerText.runs[0].text
        : (v.longBylineText && v.longBylineText.runs && v.longBylineText.runs[0] ? v.longBylineText.runs[0].text : '');
      const dur = v.lengthText && v.lengthText.simpleText;
      out.push(itemOf(id, t, ch, dur));
    }
  }
  Object.keys(node).forEach(function (k) {
    if (k === 'videoRenderer') return;
    walk(node[k], out);
  });
}

async function innertube(q) {
  const r = await fetch('https://www.youtube.com/youtubei/v1/search?key=' + encodeURIComponent(INNERTUBE_KEY) + '&prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Origin': 'https://www.youtube.com',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.7'
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20240401.00.00', hl: 'id', gl: 'ID' } },
      query: q,
      params: 'EgIQAQ%3D%3D'
    })
  });
  if (!r.ok) throw new Error('Pencarian YouTube membalas ' + r.status);
  const j = await r.json();
  const out = [];
  walk(j, out);
  if (!out.length) throw new Error('Hasil pencarian kosong.');
  return out;
}

/* ---------- 3. Halaman hasil publik sebagai cadangan terakhir ---------- */
async function scrape(q) {
  const u = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&hl=id&gl=ID&sp=EgIQAQ%253D%253D';
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.7' }
  });
  if (!r.ok) throw new Error('YouTube membalas ' + r.status);
  const html = await r.text();
  const out = [], seen = {};
  const re = /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const id = m[1];
    if (seen[id]) continue;
    seen[id] = 1;
    let title = '';
    try { title = JSON.parse('"' + m[2] + '"'); } catch (e) { title = m[2]; }
    out.push(itemOf(id, title, '', ''));
  }
  if (!out.length) throw new Error('Hasil pencarian YouTube tidak bisa dibaca.');
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, max-age=120');
  res.setHeader('Vary', 'Authorization');
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metode tidak didukung.' });
  }
  let user;
  try {
    user = await verifyIdToken(bearer(req));
  } catch (e) {
    return res.status(e.status || 401).json({ ok: false, error: String(e.message || e) });
  }
  const src = req.method === 'POST' && req.body ? req.body : (req.query || {});
  const q = String((src && src.q) || '').trim().slice(0, 90);
  if (!q) return res.status(400).json({ ok: false, error: 'Kata kunci kosong.' });

  const errors = [];
  let items = [], source = '';
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    try { items = await official(q, key); if (items.length) source = 'youtube-api'; }
    catch (e) { errors.push('YouTube Data API: ' + cut(e.message, 120)); }
  }
  if (!items.length) {
    try { items = await innertube(q); source = 'youtube-search'; }
    catch (e) { errors.push('Pencarian web YouTube: ' + cut(e.message, 120)); }
  }
  if (!items.length) {
    try { items = await scrape(q); source = 'youtube-public'; }
    catch (e) { errors.push('Halaman hasil YouTube: ' + cut(e.message, 120)); }
  }
  if (!items.length) {
    return res.status(502).json({
      ok: false,
      error: 'Pencarian YouTube sedang diblokir dari server ini. Tempel tautan video langsung, atau tambah YOUTUBE_API_KEY di pengaturan server.',
      detail: errors.slice(0, 3)
    });
  }
  return res.status(200).json({ ok: true, source: source, query: q, user: user.email ? 'ok' : 'ok', items: items.slice(0, 12) });
};

module.exports.__test = { verifyIdToken: verifyIdToken, innertube: innertube, scrape: scrape, bearer: bearer, official: official };
