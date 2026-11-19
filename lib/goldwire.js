/* =====================================================================
   GOLD & USD WIRE — kumpulan berita emas + pair USD dari banyak situs,
   disaring ketat supaya hanya yang benar-benar membahas emas/dolar/USD
   yang masuk. Tidak ada angka harga yang dikarang: hanya judul, sumber,
   umur, topik, dan kecenderungan kata dari judul.

   Tujuan: memberi mesin & AI bahan berita yang luas (bukan satu situs),
   tetap auditable, dan tidak mencampur topik di luar pembahasan
   (olahraga, hiburan, kripto murni, dsb).
   ===================================================================== */
'use strict';
const C = require('./xau-core');

const HOUR = 3600000;
const MAX_AGE_H = 72;
const MAX_ITEMS = 36;
const FRESH_H = 24;

/* Hanya feed yang benar-benar menjawab pada 19 Nov 2026. Kitco/BullionVault/
   goldprice tidak menyediakan RSS publik (404/403), jadi situs itu tetap
   dijangkau lewat Google News di QUERIES — bukan diklaim aktif di sini. */
const FEEDS = [
  { name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', topic: 'pair USD', tier: 1 },
  { name: 'ForexLive', url: 'https://www.forexlive.com/feed/forex', topic: 'pair USD', tier: 1 },
  { name: 'Investing.com Forex', url: 'https://www.investing.com/rss/news_1.rss', topic: 'pair USD', tier: 2 },
  { name: 'Investing.com Commodities', url: 'https://www.investing.com/rss/news_11.rss', topic: 'emas', tier: 2 },
  { name: 'Yahoo Finance GC=F', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US', topic: 'emas', tier: 3 },
  { name: 'CNBC Markets', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', topic: 'makro', tier: 3 },
  { name: 'Mining.com', url: 'https://www.mining.com/feed/', topic: 'emas', tier: 2 },
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', topic: 'makro', tier: 1 }
];

/* Google News dipakai untuk menjangkau "semua situs" (Reuters, Bloomberg,
   AP, media Indonesia, blog analis), tanpa membatasi ke satu penerbit. */
const QUERIES = [
  { q: 'gold price OR XAUUSD OR bullion when:2d', topic: 'emas' },
  { q: 'harga emas OR emas antam OR logam mulia OR XAUUSD when:2d', topic: 'emas' },
  { q: '"dollar index" OR DXY OR "US dollar" when:1d', topic: 'dolar' },
  { q: 'EURUSD OR USDJPY OR GBPUSD OR USDCHF OR AUDUSD when:1d', topic: 'pair USD' },
  { q: '"Federal Reserve" OR FOMC OR "interest rate" OR inflation when:2d', topic: 'makro' },
  { q: 'site:kitco.com OR site:goldseek.com OR site:goldprice.org gold OR bullion when:3d', topic: 'emas' },
  { q: 'site:reuters.com OR site:apnews.com OR site:bloomberg.com gold OR XAUUSD OR dollar when:2d', topic: 'emas & dolar' },
  { q: 'site:cnbcindonesia.com OR site:kontan.co.id OR site:bisnis.com OR site:cnnindonesia.com emas OR dolar when:3d', topic: 'emas' }
];

const GOLD = /(?:\bgold\b|xauusd|\bxau\b|bullion|\bemas\b|logam mulia|antam|precious metal|harga emas|gold price)/i;
const USD = /(?:\bdollar\b|\bdxy\b|greenback|\busd\b|eur\/?usd|usd\/?jpy|gbp\/?usd|aud\/?usd|usd\/?chf|usd\/?cad|us10y|treasury|yield|\bfed\b|fomc|powell|inflation|\bcpi\b|\bnfp\b|payroll|interest rate|rate cut|rate hike|rupiah|dolar)/i;
/* Topik yang jelas di luar pembahasan emas/USD: dibuang walau ada kata "gold". */
const OFF = /(?:football|soccer|nba|nfl|nhl|olympic|cricket|celebrity|movie|box office|album|song|lyrics|lottery|horoscope|recipe|travel|fashion|royal family|gold medal|gold award|golden globe|goldfish)/i;
/* Kripto bukan pembahasan emas/USD: hanya boleh masuk bila judulnya benar-benar
   membahas emas. Ini yang mencegah artikel token/XRP masuk wire. */
const CRYPTO = /(?:bitcoin|\bbtc\b|ethereum|\beth\b|xrp|ripple|solana|cardano|dogecoin|altcoin|crypto|nft|token sale|memecoin)/i;

const BULL = /(?:gold (?:rises|rallies|climbs|jumps|gains|surges|advances|extends|hits record|near record|rebounds)|emas (?:naik|menguat|melonjak|meroket|rekor)|safe[- ]haven|rate cut|dovish|weaker dollar|dollar (?:falls|slips|weakens|drops|retreats)|yields? (?:fall|drop|slide)|central bank (?:buying|demand|purchases)|bullish|support(?:s)? gold)/i;
const BEAR = /(?:gold (?:falls|drops|slides|slumps|tumbles|declines|retreats|eases|under pressure)|emas (?:turun|melemah|anjlok|tertekan)|strong(?:er)? dollar|dollar (?:rises|jumps|climbs|strengthens|surges|rebounds)|hawkish|rate hike|yields? (?:rise|jump|climb|surge)|profit[- ]taking|bearish|pressure(?:s)? gold)/i;

const TIER_W = { 1: 1.25, 2: 1, 3: 0.8 };
/* Bobot topik: emas lebih relevan untuk XAUUSD daripada berita makro umum. */
const TOPIC_W = { 'emas': 1.35, 'emas & dolar': 1.5, 'pair USD': 1, 'dolar': 0.9, 'dolar / makro': 0.7 };
const recencyW = (ageH) => (ageH == null ? 0.5 : ageH <= 6 ? 1 : ageH <= 18 ? 0.9 : ageH <= 36 ? 0.75 : ageH <= MAX_AGE_H ? 0.55 : 0);

function leanOf(title) {
  const s = String(title || '');
  const bull = BULL.test(s), bear = BEAR.test(s);
  if (bull === bear) return 0;
  return bull ? 1 : -1;
}
function topicOf(title, fallback) {
  const s = String(title || '');
  if (OFF.test(s)) return null;
  const g = GOLD.test(s), u = USD.test(s);
  if (!g && !u) return null;
  /* Kripto selalu dibuang: artikel token/XRP yang menyinggung dolar bukan
     pembahasan emas/pair USD, dan tidak boleh masuk bahan analisis. */
  if (CRYPTO.test(s)) return null;
  if (g && u) return 'emas & dolar';
  if (g) return 'emas';
  return /(?:\bdxy\b|dollar|dolar|treasury|yield|\bfed\b|fomc|inflation|\bcpi\b|\bnfp\b|payroll)/i.test(s) ? 'dolar / makro' : 'pair USD';
}

function itemOf(x, srcName, topic, tier) {
  const at = x.at && isFinite(x.at.getTime()) ? x.at : null;
  const ageH = at ? Math.round((Date.now() - at.getTime()) / HOUR) : null;
  if (ageH != null && ageH > MAX_AGE_H) return null;
  const t = topicOf(x.title, topic);
  if (!t) return null;
  return {
    title: C.cut(x.title, 190),
    url: x.url,
    source: C.cut(x.source || srcName || '', 60),
    feed: srcName,
    topic: t,
    lean: leanOf(x.title),
    ageH,
    at: at ? at.toISOString() : null,
    tier,
    trust: tier === 1 ? 'utama' : tier === 2 ? 'industri' : 'media'
  };
}

async function loadFeed(f) {
  try {
    const xml = await C.get(f.url, { text: true, timeout: 10000 });
    const items = C.rssItems(xml).slice(0, 24);
    return items.map(x => itemOf(x, f.name, f.topic, f.tier)).filter(Boolean);
  } catch (e) {
    return { error: C.cut(e && e.message || e, 120) };
  }
}

async function loadQuery(q) {
  try {
    const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q.q) + '&hl=en-US&gl=US&ceid=US:en';
    const xml = await C.get(url, { text: true, timeout: 12000 });
    return C.rssItems(xml).slice(0, 30).map(x => itemOf(x, 'Google News', q.topic, 2)).filter(Boolean);
  } catch (e) {
    return { error: C.cut(e && e.message || e, 120) };
  }
}

function toneOf(items) {
  let num = 0, den = 0, bull = 0, bear = 0;
  items.forEach(x => {
    const w = (TIER_W[x.tier] || 1) * recencyW(x.ageH) * (TOPIC_W[x.topic] || 1);
    /* Penyebut memakai SEMUA berita, bukan hanya yang berlabel jelas, supaya
       skor tidak melonjak ±100 hanya karena 7 dari 36 judul punya kata arah. */
    den += w;
    if (!x.lean) return;
    if (x.lean > 0) bull++; else bear++;
    num += x.lean * w;
  });
  const score = den ? Math.round(num / den * 100) : 0;
  const abs = Math.abs(score);
  return {
    score,
    label: abs < 8 ? 'netral' : abs < 22 ? (score > 0 ? 'condong naik' : 'condong turun') : (score > 0 ? 'jelas naik' : 'jelas turun'),
    goldBias: abs < 8 ? 'NETRAL' : score > 0 ? 'BULLISH' : 'BEARISH',
    bull, bear,
    note: den
      ? 'Kecenderungan judul ' + items.filter(x => x.lean).length + ' dari ' + items.length + ' berita: ' + bull + ' naik / ' + bear + ' turun → ' + (abs < 8 ? 'netral' : score > 0 ? 'dukungan naik emas' : 'tekanan turun emas') + ' (skor ' + score + '). Ini konteks kata, bukan arah entry.'
      : 'Belum ada judul dengan kecenderungan jelas; wire hanya memberi konteks.'
  };
}

async function buildOnce() {
  const [feeds, queries] = await Promise.all([
    Promise.all(FEEDS.map(loadFeed)),
    Promise.all(QUERIES.map(loadQuery))
  ]);
  const errs = [];
  const feedItems = [];
  feeds.forEach(x => { if (Array.isArray(x)) feedItems.push(...x); else if (x && x.error) errs.push(x.error); });
  const queryItems = [];
  queries.forEach(x => { if (Array.isArray(x)) queryItems.push(...x); else if (x && x.error) errs.push(x.error); });

  const map = new Map();
  [...feedItems, ...queryItems].forEach(x => {
    const k = String(x.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
    if (!k) return;
    const prev = map.get(k);
    /* Judul sama: pertahankan sumber dengan tier terbaik dan umur terbaru. */
    if (!prev || (TIER_W[x.tier] || 0) > (TIER_W[prev.tier] || 0)) map.set(k, x);
  });
  const items = [...map.values()]
    .filter(x => recencyW(x.ageH) > 0)
    /* Emas lebih dulu, baru dolar/pair, lalu makro; dalam topik yang sama
       sumber utama dan judul terbaru didahulukan. */
    .sort((a, b) => (TOPIC_W[b.topic] || 0) - (TOPIC_W[a.topic] || 0)
      || (TIER_W[b.tier] || 0) - (TIER_W[a.tier] || 0)
      || (a.ageH == null ? 999 : a.ageH) - (b.ageH == null ? 999 : b.ageH))
    .slice(0, MAX_ITEMS);

  const counts = { emas: 0, 'emas & dolar': 0, dolar: 0, 'dolar / makro': 0, 'pair USD': 0 };
  items.forEach(x => { counts[x.topic] = (counts[x.topic] || 0) + 1; });
  const domain = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return ''; } };
  /* Google News membungkus tautan ke news.google.com, jadi keragaman sumber
     dihitung dari nama penerbit (field source) bila host adalah Google. */
  const srcKey = (x) => {
    const h = domain(x.url);
    if (/^news\.google\./i.test(h)) return String(x.source || 'Google News').toLowerCase();
    return (h || String(x.source || '')).toLowerCase();
  };
  const domains = [...new Set(items.map(srcKey).filter(Boolean))];
  const fresh = items.filter(x => x.ageH != null && x.ageH <= FRESH_H).length;
  const tone = toneOf(items);
  const okFeeds = feeds.filter(x => Array.isArray(x) && x.length).length;
  return {
    ok: items.length >= 3,
    at: new Date().toISOString(),
    items,
    tone,
    counts,
    coverage: {
      feedsActive: okFeeds, feedsTotal: FEEDS.length, queries: QUERIES.length,
      items: items.length, fresh24h: fresh, distinctSources: domains.length, domains: domains.slice(0, 16)
    },
    sources: [
      ...FEEDS.map((f, i) => ({ name: f.name, topic: f.topic, ok: Array.isArray(feeds[i]) && feeds[i].length > 0, items: Array.isArray(feeds[i]) ? feeds[i].length : 0 })),
      { name: 'Google News · semua situs (Reuters, Bloomberg, AP, Kitco, media Indonesia)', ok: queryItems.length > 0, items: queryItems.length }
    ],
    errors: [...new Set(errs)].slice(0, 4),
    note: items.length
      ? 'Wire emas & USD: ' + items.length + ' judul dari ' + domains.length + ' domain (' + fresh + ' dalam 24 jam). Hanya topik emas/dolar/pair USD/makro; topik lain dibuang.'
      : 'Wire emas & USD belum mendapat judul relevan. Cek koneksi atau coba lagi beberapa saat.'
  };
}

/* Cache pendek 90 detik: cukup untuk mencegah tarikan ganda saat News dan
   Signal dimuat hampir bersamaan, tanpa membuat berita tertinggal. */
function build() {
  return C.memo('goldwire:v1', 90000, buildOnce);
}

module.exports = { build, FEEDS, QUERIES, topicOf, leanOf, toneOf };
