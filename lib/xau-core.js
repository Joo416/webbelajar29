/* =====================================================================
   XAU CORE — lapisan data baru untuk News Analisis & Signal Entry.
   Semua data diambil langsung dari sumber publik:
   TradingView scanner · Yahoo Finance · gold-api · FRED · BLS · FairEconomy ·
   Google News RSS (media AS) · YouTube.
   Tidak ada angka karangan: setiap angka punya sumber dan waktu ambil.
   ===================================================================== */
'use strict';

const { tvCandles } = require('./tv-candles');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const memoMap = new Map();

function memo(key, ttl, fn) {
  const c = memoMap.get(key);
  if (c && Date.now() - c.t < ttl) return c.p;
  const p = Promise.resolve().then(fn);
  memoMap.set(key, { t: Date.now(), p });
  p.catch(() => memoMap.delete(key));
  return p;
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const cut = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 300);
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return ''; } };

async function get(url, opts) {
  const o = opts || {};
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: o.accept || 'application/json,text/plain,*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(o.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(o.timeout || 12000)
  });
  if (!r.ok) throw new Error(host(url) + ' membalas ' + r.status);
  return o.text ? r.text() : r.json();
}

/* ---------------- AI: memakai runner milik api/chat.js (fallback key otomatis) ---------------- */
let DEPS = { llm: null };
function setDeps(d) { DEPS = { ...DEPS, ...(d || {}) }; }
async function ai(system, user, opts) {
  if (!DEPS.llm) throw new Error('AI runner belum siap');
  const o = opts || {};
  const aerr = [], dl = Date.now() + (o.deadlineMs || 42000);
  const out = await DEPS.llm(system, [{ role: 'user', content: user }], o.maxTok || 6000, aerr, dl,
    { temp: o.temp == null ? 0.2 : o.temp, json: 'object', field: o.field || 'xau' }, { tmo: o.tmo || 30000, order: o.order });
  if (!out) throw new Error('Semua AI gagal: ' + (aerr.join(' | ') || 'tidak ada key aktif'));
  return { text: out.text || '', provider: out.provider || '', model: out.model || '' };
}
function parseJson(t) {
  const s = String(t || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch (e) { }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { } }
  return null;
}

/* ---------------- TradingView: chart & TA real-time ---------------- */
/* HFM/Exness tidak terdaftar di TradingView. FOREXCOM:XAUUSD adalah feed
   broker/CFD yang tersedia di scanner + chart + websocket, dan paling dekat
   dengan kuotasi MT5. Bisa diganti lewat env TV_XAU_SYMBOL. */
const TV_SYMBOL = process.env.TV_XAU_SYMBOL || 'FOREXCOM:XAUUSD';
const TV_FALLBACK = 'OANDA:XAUUSD';
const TV_FIELDS = [
  'close', 'change', 'change_abs', 'open', 'high', 'low', 'volume',
  'Recommend.All', 'Recommend.All|1', 'Recommend.All|5', 'Recommend.All|15', 'Recommend.All|60', 'Recommend.All|240',
  'RSI', 'RSI|15', 'RSI|60', 'EMA20', 'EMA50', 'EMA200', 'EMA20|15', 'EMA50|15', 'EMA200|15', 'ATR', 'ATR|15', 'ATR|60'
];
const recLabel = (v) => {
  const n = Number(v);
  if (v == null || !isFinite(n)) return '—';
  if (n >= 0.5) return 'STRONG BUY';
  if (n >= 0.1) return 'BUY';
  if (n <= -0.5) return 'STRONG SELL';
  if (n <= -0.1) return 'SELL';
  return 'NETRAL';
};
const tvRead = () => memo('tv', 30000, async () => {
  const readOne = async (symbol) => {
    const url = 'https://scanner.tradingview.com/symbol?symbol=' + encodeURIComponent(symbol) + '&no_404=true&fields=' + TV_FIELDS.join(',');
    const j = await get(url, { headers: { Referer: 'https://www.tradingview.com/' }, timeout: 9000 });
    return { j, symbol };
  };
  try {
    let got;
    try { got = await readOne(TV_SYMBOL); } catch (e) { got = await readOne(TV_FALLBACK); }
    const j = got.j, symbol = got.symbol;
    const n = (k) => num(j && j[k]);
    const price = n('close');
    if (!(price > 0)) throw new Error('harga TradingView kosong');
    const tf = {};
    const mk = (key) => ({ rec: n('Recommend.All' + key), recLabel: recLabel(n('Recommend.All' + key)), rsi: r2(n('RSI' + key)), ema20: r2(n('EMA20' + key)), ema50: r2(n('EMA50' + key)), ema200: r2(n('EMA200' + key)), atr: r2(n('ATR' + key)) });
    tf.D = mk(''); tf['240'] = mk('|240'); tf['60'] = mk('|60'); tf['15'] = mk('|15'); tf['5'] = mk('|5'); tf['1'] = mk('|1');
    const w = { D: 1.6, 240: 1.2, 60: 1, 15: 0.9, 5: 0.5, 1: 0.3 };
    let sum = 0, tot = 0;
    Object.keys(w).forEach(k => { const v = tf[k].rec; if (v == null) return; sum += v * w[k]; tot += w[k]; });
    const wavg = tot ? sum / tot : 0;
    return {
      ok: true, symbol, at: Date.now(), price: r2(price), changePct: r2(n('change')), changeAbs: r2(n('change_abs')),
      open: r2(n('open')), high: r2(n('high')), low: r2(n('low')), volume: n('volume'),
      tf, weighted: r2(wavg), bias: wavg >= 0.1 ? 1 : wavg <= -0.1 ? -1 : 0, strength: Math.round(Math.min(100, Math.abs(wavg) * 100)),
      biasLabel: recLabel(wavg), source: 'TradingView Scanner · ' + symbol
    };
  } catch (e) {
    return { ok: false, error: cut(e && e.message || e, 160), at: Date.now(), symbol: TV_SYMBOL, source: 'TradingView Scanner' };
  }
});

/* ---------------- Spot emas live ---------------- */
const spot = () => memo('spot', 20000, async () => {
  try {
    const j = await get('https://api.gold-api.com/price/XAU');
    const price = num(j && j.price);
    if (!(price > 0)) throw new Error('harga spot kosong');
    return { ok: true, price: r2(price), at: Date.now(), source: 'gold-api.com' };
  } catch (e) { return { ok: false, error: cut(e.message, 120) }; }
});

/* ---------------- Candle live (Yahoo) ---------------- */
const Y_SYM = 'GC=F';
function yahooChart(sym, interval, range) {
  return memo('y:' + sym + ':' + interval + ':' + range, 45000, async () => {
    const u = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=' + interval + '&range=' + range + '&includePrePost=false';
    const j = await get(u, { timeout: 12000 });
    const res = j && j.chart && j.chart.result && j.chart.result[0];
    const ts = res && res.timestamp, q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
    if (!Array.isArray(ts) || !q) throw new Error('candle ' + sym + ' kosong');
    /* Yahoo mengirim bar "0" saat market tutup/data bolong. Bar seperti itu
       tidak boleh masuk: dulu membuat reaksi rilis menjadi -39.000 pip. */
    const ok = (v) => v != null && v > 0 && v < 1e6;
    const rows = [];
    for (let i = 0; i < ts.length; i++) {
      const o = num(q.open[i]), h = num(q.high[i]), l = num(q.low[i]), c = num(q.close[i]);
      if (!ok(o) || !ok(h) || !ok(l) || !ok(c) || h < l) continue;
      rows.push({ t: ts[i] * 1000, o, h, l, c, v: num(q.volume && q.volume[i]) || 0 });
    }
    rows.sort((a, b) => a.t - b.t);
    const uniq = rows.filter((r, i) => i === 0 || r.t !== rows[i - 1].t);
    if (uniq.length < 10) throw new Error('candle ' + sym + ' terlalu sedikit');
    return { sym, interval, rows: uniq, last: uniq[uniq.length - 1], prevClose: uniq.length > 1 ? uniq[uniq.length - 2].c : null };
  });
}
/* Candle XAUUSD langsung dari websocket chart TradingView (real-time,
   sumber sama dengan widget). Yahoo hanya cadangan bila websocket gagal. */
const tvChart = (sym, resolution, count) => memo('tvc:' + sym + ':' + resolution + ':' + count, 20000, async () => {
  const rows = await tvCandles(sym, resolution, count, 13000);
  if (!rows || rows.length < 20) throw new Error('TradingView ' + sym + ' ' + resolution + ' candle kosong');
  return { sym, interval: resolution, rows, last: rows[rows.length - 1], prevClose: rows.length > 1 ? rows[rows.length - 2].c : null, source: 'TradingView ' + sym + ' ' + resolution };
});

function resample(rows, factor) {
  const out = [];
  for (let i = 0; i < rows.length; i += factor) {
    const w = rows.slice(i, i + factor);
    if (!w.length) continue;
    out.push({ t: w[0].t, o: w[0].o, h: Math.max(...w.map(r => r.h)), l: Math.min(...w.map(r => r.l)), c: w[w.length - 1].c, v: w.reduce((s, r) => s + (r.v || 0), 0) });
  }
  return out;
}

async function candles() {
  const out = await Promise.allSettled([
    tvChart(TV_SYMBOL, '15', 320), tvChart(TV_SYMBOL, '5', 320), tvChart(TV_SYMBOL, 'D', 220),
    tvChart('TVC:DXY', '15', 160), tvChart('TVC:US10Y', '15', 160),
    yahooChart('DX-Y.NYB', '1d', '1mo'), yahooChart('^TNX', '1d', '1mo'),
    tvChart(TV_SYMBOL, '60', 320), tvChart(TV_SYMBOL, '240', 260)
  ]);
  const pick = (i) => (out[i].status === 'fulfilled' ? out[i].value : null);
  let m15 = pick(0), m5 = pick(1), d1 = pick(2);
  const dxyTv = pick(3), us10Tv = pick(4), dxy = pick(5), tnx = pick(6);
  let h1 = pick(7), h4 = pick(8);
  /* Fallback simbol: kalau feed broker tidak memberi candle, coba OANDA. */
  if (!m15 || !m5 || !d1 || !h1 || !h4) {
    const alt = await Promise.allSettled([
      tvChart(TV_FALLBACK, '15', 320), tvChart(TV_FALLBACK, '5', 320), tvChart(TV_FALLBACK, 'D', 220),
      tvChart(TV_FALLBACK, '60', 320), tvChart(TV_FALLBACK, '240', 260)
    ]);
    const ap = (i) => (alt[i].status === 'fulfilled' ? alt[i].value : null);
    m15 = m15 || ap(0); m5 = m5 || ap(1); d1 = d1 || ap(2); h1 = h1 || ap(3); h4 = h4 || ap(4);
  }
  /* Cadangan: kalau websocket TradingView diblokir, pakai Yahoo GC=F. */
  if (!m15 || !m5 || !d1) {
    const y = await Promise.allSettled([
      yahooChart(Y_SYM, '15m', '5d'), yahooChart(Y_SYM, '5m', '2d'), yahooChart(Y_SYM, '1d', '6mo')
    ]);
    const yp = (i) => (y[i].status === 'fulfilled' ? y[i].value : null);
    m15 = m15 || yp(0); m5 = m5 || yp(1); d1 = d1 || yp(2);
  }
  const m1 = null;
  if (!m15) throw new Error('candle M15 XAUUSD tidak tersedia');
  if (!h1) h1 = { rows: resample(m15.rows, 4), last: null, source: 'resample M15 → H1' };
  if (!h4) h4 = { rows: resample(m15.rows, 16), last: null, source: 'resample M15 → H4' };
  if (h1 && !h1.last) h1.last = h1.rows[h1.rows.length - 1];
  if (h4 && !h4.last) h4.last = h4.rows[h4.rows.length - 1];
  const source = m15.source || ('Yahoo ' + Y_SYM + ' 15m');
  return { m15, m5, m1, d1, h1, h4, dxy, dxyTv, us10Tv, tnx, source, live: /TradingView/.test(String(source)) };
}

/* ---------------- FRED (angka resmi) ---------------- */
const fred = (id) => memo('fred:' + id, 1800000, async () => {
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + encodeURIComponent(id);
  /* FRED menahan permintaan yang membawa header browser lengkap; UA minimal
     stabil dan cepat (diuji dari production). */
  const rr = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!rr.ok) throw new Error('FRED membalas ' + rr.status);
  const txt = await rr.text();
  const rows = [];
  String(txt).split(/\r?\n/).forEach(line => {
    const p = line.split(',');
    if (!p[1]) return;
    const v = Number(p[1]);
    if (isFinite(v)) rows.push({ d: p[0], v });
  });
  if (rows.length < 5) throw new Error('FRED ' + id + ' kurang data');
  return { id, rows, last: rows[rows.length - 1], prev: rows[rows.length - 2], source: 'FRED · ' + id };
});

/* ---------------- Kalender ekonomi (FairEconomy, agregator) ---------------- */
const calTag = (title) => {
  const t = String(title || '');
  if (/non-?farm|nfp\b|payrolls/i.test(t)) return 'NFP';
  if (/core cpi|cpi\b|consumer price index/i.test(t)) return 'CPI';
  if (/core ppi|ppi\b|producer price/i.test(t)) return 'PPI';
  if (/fomc|federal funds rate|fed interest rate decision|monetary policy statement|^interest rate$/i.test(t)) return 'FOMC';
  return '';
};
/* Kalender utama: TradingView Economic Calendar (actual/forecast/previous
   numerik + periode + sumber). Cadangan: FairEconomy JSON. */
async function tvCalendar() {
  /* Jendela 70 hari ke belakang agar rilis sebelumnya (bulanan) ikut masuk,
     bukan hanya rilis terakhir. Ini yang membuat perbandingan data lama vs
     data baru di News Analisis nyata, bukan panel kosong. */
  const from = new Date(Date.now() - 70 * 86400000).toISOString(), to = new Date(Date.now() + 45 * 86400000).toISOString();
  const url = 'https://economic-calendar.tradingview.com/events?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&countries=US';
  const j = await get(url, { timeout: 15000, headers: { Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/' } });
  const arr = (j && j.result) || [];
  if (!arr.length) throw new Error('kalender TradingView kosong');
  return arr.map(x => ({
    id: x.id, title: cut(x.title, 150), cur: 'USD',
    impact: x.importance >= 1 ? 'High' : x.importance === 0 ? 'Medium' : 'Low', importance: x.importance,
    date: x.date, ts: Date.parse(x.date),
    forecast: x.forecast == null ? '' : String(x.forecast), previous: x.previous == null ? '' : String(x.previous), actual: x.actual == null ? '' : String(x.actual),
    unit: x.unit || '', period: x.period || '', referenceDate: x.referenceDate || '', source: x.source || 'TradingView calendar', sourceUrl: x.source_url || ''
  })).filter(x => isFinite(x.ts));
}
async function ffCalendar() {
  const urls = ['https://nfs.faireconomy.media/ff_calendar_thisweek.json', 'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json', 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'];
  const all = [];
  for (const u of urls) { try { const j = await get(u, { timeout: 12000 }); if (Array.isArray(j)) all.push(...j); } catch (e) { } }
  if (!all.length) throw new Error('kalender cadangan juga gagal');
  const seen = new Set();
  return all.filter(x => { const k = String(x.date) + '|' + String(x.title); if (seen.has(k)) return false; seen.add(k); return true; }).map(x => ({
    title: cut(x.title || x.event || '', 140), cur: String(x.country || x.currency || '').toUpperCase().slice(0, 3), impact: String(x.impact || ''), importance: /high/i.test(x.impact) ? 1 : /medium/i.test(x.impact) ? 0 : -1,
    date: x.date || '', ts: Date.parse(x.date), forecast: cut(x.forecast, 24), previous: cut(x.previous, 24), actual: cut(x.actual, 24), unit: '', period: '', referenceDate: '', source: 'FairEconomy/FF calendar', sourceUrl: ''
  })).filter(x => isFinite(x.ts));
}
const calendar = () => memo('cal', 240000, async () => {
  try { return await tvCalendar(); } catch (e) { return await ffCalendar(); }
});

/* ---------------- Google News RSS: media AS terpercaya ---------------- */
const US_SOURCES = ['reuters.com', 'apnews.com', 'bloomberg.com', 'cnbc.com', 'wsj.com', 'ft.com', 'marketwatch.com', 'barrons.com', 'foxbusiness.com', 'kitco.com', 'fxstreet.com', 'forexlive.com', 'investing.com', 'finance.yahoo.com', 'cmegroup.com', 'gold.org'];
function rssItems(xml) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 40).map(m => {
    const b = m[1];
    const take = (t) => { const q = b.match(new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>')); return q ? q[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : ''; };
    const title = take('title'), link = take('link'), date = take('pubDate');
    const sm = /\s-\s([^-]{2,40})$/.exec(title);
    return { title: cut(sm ? title.slice(0, sm.index) : title, 180), source: cut(sm ? sm[1] : '', 40), url: link, at: date ? new Date(date) : null };
  }).filter(x => x.title && /^https?:\/\//.test(x.url));
}
const usNews = (q) => memo('us:' + q, 420000, async () => {
  const query = '(' + q + ') (' + US_SOURCES.map(s => 'site:' + s).join(' OR ') + ')';
  const xml = await get('https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en', { text: true, timeout: 12000 });
  const items = rssItems(xml).map(x => {
    const ageH = x.at && isFinite(x.at.getTime()) ? Math.round((Date.now() - x.at.getTime()) / 3600000) : null;
    return { ...x, at: x.at && isFinite(x.at.getTime()) ? x.at.toISOString() : null, ageH };
  }).filter(x => x.ageH == null || x.ageH <= 96);
  const map = new Map();
  items.forEach(x => { const k = x.title.toLowerCase().slice(0, 80); if (!map.has(k)) map.set(k, x); });
  const out = [...map.values()].sort((a, b) => (a.ageH == null ? 999 : a.ageH) - (b.ageH == null ? 999 : b.ageH)).slice(0, 10);
  return { ok: out.length > 0, items: out, sources: [...new Set(out.map(x => x.source).filter(Boolean))], at: new Date().toISOString(), note: 'Google News RSS · hanya media AS terpercaya; judul + sumber + tautan.' };
});

/* ---------------- YouTube: pencarian publik, kanal resmi ditandai ---------------- */
const YT_TRUST = [['Bloomberg', /bloomberg/i], ['Reuters', /reuters/i], ['CNBC', /cnbc/i], ['Fox Business', /fox business/i], ['Yahoo Finance', /yahoo finance/i], ['WSJ', /wall street journal|^wsj$/i], ['Financial Times', /financial times|^ft\b/i], ['Kitco News', /kitco/i], ['MarketWatch', /marketwatch/i], ['Investing.com', /investing\.com/i], ['BNN Bloomberg', /bnn bloomberg/i], ['Schwab Network', /schwab/i], ['Goldman Sachs', /goldman/i], ['JPMorgan', /jpmorgan|jp morgan/i], ['Federal Reserve', /federal reserve/i]];
const ytTrust = (ch) => { const h = YT_TRUST.find(x => x[1].test(String(ch || ''))); return h ? h[0] : ''; };
const ydec = (s) => String(s || '').replace(/\\u([0-9a-f]{4})/gi, (m, h) => { try { return String.fromCharCode(parseInt(h, 16)); } catch (e) { return m; } }).replace(/\\\//g, '/').replace(/\\"/g, '"');
function ytAge(s) {
  const m = /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|[smhdwy])\b/i.exec(String(s || ''));
  if (!m) return null;
  const u = m[2].toLowerCase(), k = /^(s|sec)/.test(u) ? 1 / 3600 : /^(m|min)/.test(u) ? 1 / 60 : /^(h|hr)/.test(u) ? 1 : /^(d|day)/.test(u) ? 24 : /^(w|week)/.test(u) ? 168 : /^(mo|month)/.test(u) ? 720 : 8760;
  return Math.round(Number(m[1]) * k);
}
async function ytQuery(q) {
  const u = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  const t = await get(u, { text: true, timeout: 12000 });
  const out = [];
  t.split('"videoRenderer":{').slice(1, 30).forEach(p => {
    const id = (p.match(/"videoId":"([A-Za-z0-9_-]{11})"/) || [])[1];
    if (!id) return;
    const title = ydec((p.match(/"title":\{"runs":\[\{"text":"([^"]{4,220})"/) || [])[1] || '');
    const channel = ydec((p.match(/"ownerText":\{"runs":\[\{"text":"([^"]{2,90})"/) || [])[1] || '');
    const ageTxt = ydec((p.match(/"publishedTimeText":\{"simpleText":"([^"]{2,40})"/) || [])[1] || '');
    const viewTxt = ydec((p.match(/"viewCountText":\{"simpleText":"([^"]{1,30})"/) || [])[1] || '');
    const li = p.indexOf('"lengthText":');
    const lenTxt = li >= 0 ? ydec((p.slice(li, li + 260).match(/"simpleText":"([^"]{1,12})"/) || [])[1] || '') : '';
    const lp = String(lenTxt).split(':').map(Number);
    const lengthSec = lp.length >= 2 && lp.every(isFinite) ? lp.reduce((a, b) => a * 60 + b, 0) : null;
    const tr = ytTrust(channel);
    if (!title || /#shorts/i.test(title)) return;
    /* Kanal resmi boleh muncul walau judulnya tidak menyebut gold (mis.
       "Markets in 3 Minutes"); kanal komunitas tetap wajib menyebut gold. */
    if (!/gold|xau|bullion|emas|precious/i.test(title) && !tr) return;
    const stance = stanceOf(title);
    out.push({ id, title: cut(title, 170), channel: cut(channel, 60), trusted: tr, ageH: ytAge(ageTxt), views: cut(viewTxt, 30), lengthSec, lengthLabel: cut(lenTxt, 12), stance, url: 'https://www.youtube.com/watch?v=' + id });
  });
  return out;
}
/* ---------------- Transkrip YouTube resmi (Bloomberg/Reuters/CNBC) ----------------
   Batas: hanya 3 video, durasi maksimal 20 menit, 2.800 karakter per video,
   total 8.400 karakter. Caption diambil dari track Inggris (manual/auto).
   Transkrip mentah tidak dipakai untuk angka harga — hanya konteks naratif. */
const YT_TRANS_CH = /^(bloomberg television|bloomberg news|bloomberg markets[^|]*|reuters|cnbc|cnbc television)$/i;
const YT_RELEVANT = /gold|xau|bullion|emas|precious|\bnfp\b|payroll|inflation|\bcpi\b|\bppi\b|\bfomc\b|\bfed\b|dollar|yield|\brate\b|market/i;
const YT_MAX_SEC = 1200;
const YT_MAX_CHARS = 2800;
const YT_TOTAL_CHARS = 8400;
const xdec = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function ytWatchHtml(id) {
  return memo('ytw:' + id, 6 * 3600000, async () => {
    /* Watch page WEB memberi caption URL ber-PoToken yang sering kosong.
       InnerTube client IOS mengembalikan URL caption bersih yang bisa diunduh. */
    const clients = [
      { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '17.5.1.21F90', hl: 'en', gl: 'US' },
      { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, osName: 'Android', osVersion: '11', hl: 'en', gl: 'US' }
    ];
    let last = { status: 0, play: '', tracks: 0 };
    for (const client of clients) {
      const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
        body: JSON.stringify({ context: { client }, videoId: id }),
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) { last = { status: r.status, play: '', tracks: 0 }; continue; }
      const j = await r.json();
      const sec = Number(j && j.videoDetails && j.videoDetails.lengthSeconds);
      const tracks = (j && j.captions && j.captions.playerCaptionsTracklistRenderer && j.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
      const track = tracks.find(t => /^en/i.test(t.languageCode || '') && !/asr/i.test(t.kind || ''))
        || tracks.find(t => /^en/i.test(t.languageCode || '')) || tracks[0] || null;
      if (track && isFinite(sec)) return { ok: true, sec, track, client: client.clientName };
      last = { status: r.status, play: String(j && j.playabilityStatus && j.playabilityStatus.status || ''), tracks: tracks.length };
    }
    return { ok: false, sec: null, track: null, debug: last };
  });
}
async function ytCaptionText(base) {
  const u = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'fmt=json3';
  const txt = await get(u, { text: true, timeout: 12000, headers: { Referer: 'https://www.youtube.com/' } });
  let out = '';
  try {
    const j = JSON.parse(txt);
    out = (j.events || []).map(e => (e.segs || []).map(s => s.utf8 || '').join('')).join(' ');
  } catch (e) {
    out = [...String(txt).matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(m => xdec(m[1])).join(' ');
  }
  return xdec(out);
}
async function ytTranscripts(items) {
  const pool = (items || []).filter(x => YT_TRANS_CH.test(String(x.channel || '')) && YT_RELEVANT.test(String(x.title || '')) && (x.ageH == null || x.ageH <= 96))
    .sort((a, b) => (b.trusted ? 1 : 0) - (a.trusted ? 1 : 0) || ((a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH)))
    .slice(0, 5);
  if (!pool.length) return { ok: false, items: [], checked: 0, note: 'Tidak ada video Bloomberg/Reuters/CNBC dalam 96 jam terakhir; transkrip tidak diklaim.' };
  const res = await Promise.allSettled(pool.map(async x => {
    const w = await ytWatchHtml(x.id);
    if (!w.ok || !w.track || !w.sec) throw new Error('caption tidak tersedia ' + JSON.stringify(w.debug || {}));
    if (w.sec < 30 || w.sec > YT_MAX_SEC) throw new Error('durasi ' + w.sec + ' detik di luar batas');
    const full = await ytCaptionText(w.track.baseUrl);
    if (full.length < 80) throw new Error('caption terlalu pendek');
    const text = C0(full, YT_MAX_CHARS);
    return {
      id: x.id, title: x.title, channel: x.channel, url: x.url,
      durationSec: w.sec, durationLabel: Math.floor(w.sec / 60) + ':' + String(w.sec % 60).padStart(2, '0'),
      lang: w.track.languageCode || 'en', auto: /asr/i.test(w.track.kind || ''),
      chars: full.length, clipped: full.length > YT_MAX_CHARS, text
    };
  }));
  const items2 = [];
  const errs = [];
  const seenTitle = new Set();
  let total = 0;
  res.forEach(r => {
    if (r.status !== 'fulfilled') { errs.push(cut(r.reason && r.reason.message || r.reason, 120)); return; }
    const t = r.value;
    const tk = String(t.title || '').toLowerCase().slice(0, 90);
    if (seenTitle.has(tk)) return;
    seenTitle.add(tk);
    if (total + t.text.length > YT_TOTAL_CHARS) {
      const room = YT_TOTAL_CHARS - total;
      if (room < 300) return;
      t.text = t.text.slice(0, room); t.clipped = true;
    }
    total += t.text.length;
    items2.push(t);
  });
  return {
    ok: items2.length > 0, items: items2, checked: pool.length, totalChars: total, errors: errs.slice(0, 5),
    note: items2.length
      ? 'Transkrip caption Inggris untuk ' + items2.length + ' video resmi; maksimal 20 menit/video. Auto-caption bisa salah kata; bukan sumber angka.'
      : 'Video resmi ditemukan tetapi caption tidak tersedia; analisis tetap memakai metadata saja.'
  };
}
const C0 = (s, n) => String(s || '').slice(0, n);

/* Feed resmi kanal YouTube: lebih andal daripada hasil pencarian untuk
   memastikan video Bloomberg/Reuters/CNBC benar-benar ikut diperiksa. */
const YT_OFFICIAL = [
  ['Bloomberg Television', 'UCIALMKvObZNtJ6AmdCLP7Lg'],
  ['Reuters', 'UChqUTb7kYRX8-EiaN3XFrSQ'],
  ['CNBC Television', 'UCrp_UI8XtuYfpiqluWLD7Lw'],
  ['CNBC', 'UCvJJ_dzjViJCoLf5uKUTwoA']
];
const stanceOf = (title) => /surge|rally|soar|jump|record high|bullish|breakout|climb|gain|rebound|naik/i.test(title) ? 'bullish'
  : /fall|drop|plunge|slump|bearish|selloff|sell-off|crash|decline|turun|pressure/i.test(title) ? 'bearish' : 'netral';
const ytRss = (id, label) => memo('ytrss:' + id, 600000, async () => {
  const xml = await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id, { text: true, timeout: 12000 });
  return [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 15).map(m => {
    const b = m[1];
    const vid = (b.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = xdec((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const pub = (b.match(/<published>([^<]+)<\/published>/) || [])[1];
    const at = pub ? new Date(pub) : null;
    const ageH = at && isFinite(at.getTime()) ? Math.round((Date.now() - at.getTime()) / 3600000) : null;
    if (!vid || !title) return null;
    return { id: vid, title: cut(title, 170), channel: label, trusted: label, ageH, views: '', stance: stanceOf(title), url: 'https://www.youtube.com/watch?v=' + vid };
  }).filter(Boolean);
});

const youtube = (focus) => memo('yt:' + focus, 900000, async () => {
  const base = focus && focus !== 'all' ? (focus + ' XAUUSD gold ') : 'XAUUSD gold ';
  const qs = [base + 'analysis today', base + 'forecast news', 'Bloomberg Television gold price ' + (focus || ''), 'CNBC Television gold price ' + (focus || ''), 'Reuters gold price ' + (focus || ''), 'gold price Federal Reserve ' + (focus || ''), 'Kitco gold news ' + (focus || '')];
  const [res, rss] = await Promise.all([
    Promise.allSettled(qs.map(ytQuery)),
    Promise.allSettled(YT_OFFICIAL.map(([label, id]) => ytRss(id, label)))
  ]);
  const map = new Map();
  res.forEach(r => { if (r.status === 'fulfilled') r.value.forEach(x => { if (!map.has(x.id)) map.set(x.id, x); }); });
  rss.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach(x => {
      if (map.has(x.id) || (x.ageH != null && x.ageH > 96)) return;
      if (!/gold|xau|bullion|emas|precious|nfp|payroll|inflation|cpi|ppi|fomc|fed|dollar|yield/i.test(x.title)) return;
      map.set(x.id, x);
    });
  });
  const items = [...map.values()].sort((a, b) => (b.trusted ? 1 : 0) - (a.trusted ? 1 : 0) || ((a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH))).slice(0, 12);
  const tally = { bullish: 0, bearish: 0, netral: 0 };
  items.forEach(x => { tally[x.stance] = (tally[x.stance] || 0) + 1; });
  const transcripts = await ytTranscripts(items);
  items.forEach(x => { const t = transcripts.items.find(v => v.id === x.id); if (t) x.transcript = { durationLabel: t.durationLabel, chars: t.chars, clipped: t.clipped, auto: t.auto }; });
  return {
    ok: items.length > 0, items, trusted: items.filter(x => x.trusted).length, tally, transcripts,
    at: new Date().toISOString(),
    note: 'YouTube: judul + kanal + umur + kecenderungan judul. Transkrip hanya untuk Bloomberg/Reuters/CNBC, maksimal 20 menit/video. Video komunitas hanya konteks; tidak ada angka harga dari video.'
  };
});

/* ---------------- Baca video resmi via Gemini (cadangan caption) ----------------
   YouTube memblokir caption dari IP datacenter (LOGIN_REQUIRED). Gemini bisa
   membaca video publik lewat URL. Output sengaja dilarang memuat angka agar
   tidak ada angka karangan yang masuk ke analisis. */
const videoRead = (id, title) => memo('vid:' + id, 6 * 3600000, async () => {
  const keys = Object.keys(process.env).filter(k => /^GEMINI_API_KEY(_\d+)?$/.test(k)).map(k => process.env[k]).filter(Boolean);
  if (!keys.length) return { ok: false, error: 'GEMINI_API_KEY tidak tersedia' };
  const models = (process.env.GEMINI_VIDEO_MODELS || 'gemini-3.5-flash-lite,gemini-3.8-flash').split(/[\s,]+/).filter(Boolean);
  const prompt = 'Tonton video YouTube ini. Ringkas isi pembicaraannya dalam Bahasa Indonesia, 5-8 poin, fokus pada argumen tentang emas, dolar, yield, Fed, dan risiko pasar. JANGAN menulis angka, harga, level, persentase, tanggal, atau nama indikator numerik. Jangan mengarang; jika video tidak bisa diakses jawab tepat: TIDAK_AKSES. Balas HANYA JSON: {"ok":true|false,"topik":"...","poin":["..."],"kecenderungan":"bullish|bearish|netral","catatan":"..."}';
  for (const key of keys) {
    for (const model of models) {
      try {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'https://www.youtube.com/watch?v=' + id, mimeType: 'video/*' } }, { text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1200 }
          }),
          signal: AbortSignal.timeout(22000)
        });
        if (!r.ok) continue;
        const j = await r.json();
        const text = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || []).map(p => p.text || '').join('');
        if (!text || /TIDAK_AKSES/.test(text)) continue;
        return { ok: true, text: cut(text, 2400), model, title: cut(title, 160), url: 'https://www.youtube.com/watch?v=' + id };
      } catch (e) { }
    }
  }
  return { ok: false, error: 'Gemini tidak bisa membaca video ini' };
});

/* ---------------- Papan makro global (FRED, angka resmi) ---------------- */
const FRED_BOARD = [
  ['DGS10', 'Yield 10Y', '%'], ['DFII10', 'Yield riil 10Y', '%'],
  ['DTWEXBGS', 'Dollar broad index', ''], ['T10YIE', 'Breakeven inflasi 10Y', '%'],
  ['DFEDTARU', 'Fed funds upper', '%'], ['DGS2', 'Yield 2Y', '%']
];
const fredBoard = () => memo('fredboard', 600000, async () => {
  const res = await Promise.allSettled(FRED_BOARD.map(([id]) => fred(id)));
  const items = [];
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled' || !r.value || !r.value.rows.length) return;
    const [id, label, unit] = FRED_BOARD[i];
    const rows = r.value.rows, n = rows.length, last = rows[n - 1], prev = rows[Math.max(0, n - 2)];
    const ref = rows[Math.max(0, n - 6)];
    items.push({
      id, label, unit, value: r2(last.v), prev: r2(prev.v), date: last.d,
      chg: r2(last.v - prev.v), chg5: r2(last.v - ref.v),
      source: 'FRED · ' + id
    });
  });
  return { ok: items.length >= 4, items, at: new Date().toISOString(), note: 'FRED menyajikan angka resmi; seri harian bisa tertinggal 1 hari bursa. Tanggal observasi ditampilkan apa adanya.' };
});

/* ---------------- util ---------------- */
function sma(a, n) { if (!a || a.length < n) return null; const w = a.slice(-n); return w.reduce((x, y) => x + y, 0) / w.length; }
function ema(a, n) { if (!a || a.length < n) return null; const k = 2 / (n + 1); let e = a.slice(0, n).reduce((x, y) => x + y, 0) / n; for (let i = n; i < a.length; i++) e = a[i] * k + e * (1 - k); return e; }
function atr(rows, n) { if (!rows || rows.length < n + 1) return null; const w = rows.slice(-n - 1); let s = 0; for (let i = 1; i < w.length; i++) { const p = w[i - 1].c; s += Math.max(w[i].h - w[i].l, Math.abs(w[i].h - p), Math.abs(w[i].l - p)); } return s / n; }
function rsi(a, n) { if (!a || a.length < n + 1) return null; const w = a.slice(-n - 1); let up = 0, dn = 0; for (let i = 1; i < w.length; i++) { const d = w[i] - w[i - 1]; if (d > 0) up += d; else dn -= d; } const rs = dn === 0 ? 100 : up / dn; return 100 - 100 / (1 + rs); }
function swing(rows, k) {
  const hi = [], lo = [], n = rows.length;
  for (let i = k; i < n - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (rows[j].h >= rows[i].h) isH = false;
      if (rows[j].l <= rows[i].l) isL = false;
    }
    if (isH) hi.push({ i, t: rows[i].t, p: rows[i].h });
    if (isL) lo.push({ i, t: rows[i].t, p: rows[i].l });
  }
  return { hi, lo };
}
function structure(rows) {
  const sw = swing(rows, 2), hi = sw.hi.slice(-6), lo = sw.lo.slice(-6);
  const lastHi = hi[hi.length - 1], prevHi = hi[hi.length - 2], lastLo = lo[lo.length - 1], prevLo = lo[lo.length - 2];
  const c = rows[rows.length - 1].c;
  const trend = lastHi && lastLo && prevHi && prevLo
    ? (lastHi.p > prevHi.p && lastLo.p > prevLo.p ? 'BULLISH' : lastHi.p < prevHi.p && lastLo.p < prevLo.p ? 'BEARISH' : 'RANGE')
    : 'RANGE';
  let bos = null;
  if (lastHi && c > lastHi.p) bos = { dir: 'BULLISH', level: r2(lastHi.p), kind: 'BOS', at: new Date(lastHi.t).toISOString(), t: lastHi.t };
  else if (lastLo && c < lastLo.p) bos = { dir: 'BEARISH', level: r2(lastLo.p), kind: 'BOS', at: new Date(lastLo.t).toISOString(), t: lastLo.t };
  return {
    trend, bos,
    lastHi: lastHi ? r2(lastHi.p) : null, lastLo: lastLo ? r2(lastLo.p) : null,
    lastHiAt: lastHi ? new Date(lastHi.t).toISOString() : null,
    lastLoAt: lastLo ? new Date(lastLo.t).toISOString() : null,
    lastHiI: lastHi ? lastHi.i : null, lastLoI: lastLo ? lastLo.i : null,
    hi: hi.map(x => r2(x.p)), lo: lo.map(x => r2(x.p)),
    hiTimes: hi.map(x => new Date(x.t).toISOString()), loTimes: lo.map(x => new Date(x.t).toISOString())
  };
}
function fvg(rows) {
  const out = [];
  for (let i = 2; i < rows.length; i++) {
    const a = rows[i - 2], c = rows[i];
    if (c.l > a.h) out.push({ kind: 'bull', lo: r2(a.h), hi: r2(c.l), i, t: c.t, at: new Date(c.t).toISOString() });
    else if (c.h < a.l) out.push({ kind: 'bear', lo: r2(c.h), hi: r2(a.l), i, t: c.t, at: new Date(c.t).toISOString() });
  }
  return out.slice(-6);
}
function orderBlock(rows, atrV) {
  const a = atrV || 1;
  for (let i = rows.length - 3; i > Math.max(2, rows.length - 40); i--) {
    const p = rows[i - 1], x = rows[i];
    const body = Math.abs(x.c - x.o);
    if (body > a * 1.1) return { dir: x.c > x.o ? 'BULLISH' : 'BEARISH', lo: r2(Math.min(x.o, x.c)), hi: r2(Math.max(x.o, x.c)), i, t: x.t, at: new Date(x.t).toISOString(), strength: r2(body / a) };
  }
  return null;
}
function sweep(rows) {
  const w = rows.slice(-40);
  const hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  const last = w[w.length - 1];
  if (last.h > hi - 1e-9 && last.c < hi) return { kind: 'high', level: r2(hi), t: last.t, at: new Date(last.t).toISOString(), why: 'Sapuan likuiditas di atas high 40 candle lalu ditolak.' };
  if (last.l < lo + 1e-9 && last.c > lo) return { kind: 'low', level: r2(lo), t: last.t, at: new Date(last.t).toISOString(), why: 'Sapuan likuiditas di bawah low 40 candle lalu ditolak.' };
  return null;
}
function ote(rows) {
  const w = rows.slice(-60), hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  const hiRow = w.find(r => r.h === hi), loRow = w.find(r => r.l === lo);
  const rng = hi - lo;
  if (!(rng > 0)) return null;
  return {
    hi: r2(hi), lo: r2(lo),
    long: [r2(hi - rng * 0.79), r2(hi - rng * 0.62)], short: [r2(lo + rng * 0.62), r2(lo + rng * 0.79)],
    hiAt: hiRow ? new Date(hiRow.t).toISOString() : null, loAt: loRow ? new Date(loRow.t).toISOString() : null,
    at: new Date(w[w.length - 1].t).toISOString()
  };
}
const sessionInfo = () => { const h = new Date().getUTCHours(); return h >= 13 && h < 17 ? { name: 'Overlap London–New York', kill: true } : h >= 12 && h < 15 ? { name: 'London', kill: true } : h >= 17 && h < 21 ? { name: 'New York', kill: true } : h >= 0 && h < 8 ? { name: 'Asia', kill: false } : { name: 'Sejuk', kill: false }; };
const pips = (a, b) => (a == null || b == null ? null : Math.round(Math.abs(a - b) / 0.1));

module.exports = {
  UA, memo, num, r2, clip, cut, host, get, setDeps, ai, parseJson,
  TV_SYMBOL, tvRead, recLabel, spot, candles, Y_SYM, fred, fredBoard, calendar, calTag,
  usNews, youtube, videoRead, sma, ema, atr, rsi, swing, structure, fvg, orderBlock, sweep, ote, sessionInfo, pips, rssItems,
  ytRss, YT_OFFICIAL
};
