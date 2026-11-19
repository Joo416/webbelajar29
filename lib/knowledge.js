/* =====================================================================
   KNOWLEDGE BASE — bahan belajar dari sumber global terpercaya.

   Tujuan:
   - Mengumpulkan berita/analisis XAUUSD dari feed resmi (Fed, BLS, BEA,
     US Treasury), industri emas (World Gold Council, Kitco, FXStreet),
     media keuangan besar (CNBC, Yahoo Finance, Investing.com, ForexLive)
     dan kanal YouTube resmi (Bloomberg, Reuters, CNBC).
   - Tidak mengarang isi: yang disimpan hanya judul, tautan, nama sumber,
     waktu terbit, dan kecenderungan kata dari judul itu sendiri.
   - Mengurutkan bukti dengan bobot kelas sumber + kesegaran + relevansi,
     lalu (jika akun sudah punya catatan) bobot akurasi sumber tersebut.
   - Statistik akurasi per sumber berasal dari hasil nyata yang dicatat
     klien, bukan penilaian sendiri. Sumber tanpa sampel tidak diberi bobot.
   - Pembelajaran sumber hanya boleh menyesuaikan keyakinan (delta kecil,
     dibatasi). Arah sinyal TIDAK pernah diubah di sini.

   Batas yang jujur: feed publik bisa tertunda, berubah, atau memblokir
   server. Sumber yang gagal dilaporkan gagal, tidak diisi data palsu.
   ===================================================================== */
'use strict';
const C = require('./xau-core');
const L = require('./learn');

const TTL_MS = 10 * 60000;
const MAX_AGE_H = 96;
const MAX_ITEMS = 70;
const PER_SOURCE = 6;
const REQUEST_BUDGET_MS = 7000;

/* Kelas sumber: resmi > industri > media > komunitas. Bobot hanya untuk
   pengurutan bukti, bukan klaim kebenaran mutlak. */
const TIER = { resmi: 1.35, industri: 1.15, media: 1.05, komunitas: .75 };

/* Hanya feed yang terbukti hidup. Feed yang mati dihapus daripada selalu
   dilaporkan gagal; cakupan outlet tetap lewat Google News di bawah. */
const FEEDS = [
  { id: 'fed', name: 'Federal Reserve', tier: 'resmi', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { id: 'bls', name: 'BLS', tier: 'resmi', url: 'https://www.bls.gov/feed/bls_latest.rss' },
  { id: 'bea', name: 'BEA', tier: 'resmi', url: 'https://apps.bea.gov/rss/rss.xml' },
  { id: 'ecb', name: 'ECB', tier: 'resmi', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { id: 'investing', name: 'Investing.com', tier: 'media', url: 'https://www.investing.com/rss/news.rss' },
  { id: 'cnbc', name: 'CNBC', tier: 'media', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { id: 'forexlive', name: 'ForexLive', tier: 'media', url: 'https://www.forexlive.com/feed/news' },
  { id: 'tv', name: 'TradingView Ideas', tier: 'komunitas', url: 'https://www.tradingview.com/feed/' }
];

/* Kueri Google News dibatasi domain terpercaya yang sama dengan modul news.
   Dua kueri gabungan (bukan banyak kueri paralel) agar tidak kena batas 429;
   outlet tetap dilebarkan oleh daftar site: di xau-core. */
const TOPICS = [
  { id: 'gold', q: 'gold OR XAUUSD OR bullion OR "gold price"' },
  { id: 'macro', q: 'Federal Reserve OR FOMC OR CPI OR inflation OR payrolls OR "dollar index" OR "Treasury yields"' }
];

const OUTLET = [
  [/reuters/i, 'reuters', 'Reuters'], [/bloomberg/i, 'bloomberg', 'Bloomberg'],
  [/cnbc/i, 'cnbc', 'CNBC'], [/wall street journal|^wsj$/i, 'wsj', 'WSJ'],
  [/financial times|^ft$/i, 'ft', 'Financial Times'], [/marketwatch/i, 'marketwatch', 'MarketWatch'],
  [/barrons/i, 'barrons', "Barron's"], [/fox business/i, 'foxbusiness', 'Fox Business'],
  [/kitco/i, 'kitco', 'Kitco'], [/fxstreet/i, 'fxstreet', 'FXStreet'],
  [/forexlive/i, 'forexlive', 'ForexLive'], [/investing\.com/i, 'investing', 'Investing.com'],
  [/yahoo/i, 'yahoo', 'Yahoo Finance'], [/ap news|associated press/i, 'apnews', 'AP'],
  [/cme/i, 'cmegroup', 'CME Group'], [/gold\.org|world gold council/i, 'wgc', 'World Gold Council']
];

const RELEVANT = /gold|xau|bullion|emas|precious|silver|mining|fed\b|federal reserve|fomc|powell|cpi|ppi|inflation|payroll|nfp|jobless|unemployment|treasury|yield|dollar|dxy|rate (cut|hike|decision)|central bank|geopolit|sanction|tariff|safe[- ]haven|etf/i;
const GOLDISH = /gold|xau|bullion|emas|precious|silver/i;
/* Rilis resmi memakai judul statistik yang tidak selalu menyebut emas
   (mis. "Consumer Price Index — November"), jadi filternya lebih longgar. */
const OFFICIAL = /monetary|interest|rate|inflation|consumer price|producer price|employment|unemployment|payroll|jobless|labor|labour|economic|powell|fomc|federal|treasury|debt|deficit|fiscal|yield|dollar|gold|silver|market|bank/i;
/* Kanal YouTube resmi sering memakai judul umum; konteks pasar tetap dipakai,
   tetapi kecenderungan arah hanya dihitung bila judul benar-benar soal emas. */
const MARKETISH = /market|stock|econom|inflation|rate|dollar|commodit|metal|fed\b|trade|tariff|bond|yield/i;

/* Kecenderungan hanya dari kata judul. Kata netral tidak dihitung. */
function leanOf(title) {
  const s = String(title || '').toLowerCase();
  /* Klausa inti saja: kata setelah "as/after/amid/while" biasanya menjelaskan
     penyebab (mis. "dollar slips"), bukan arah emasnya. */
  const head = s.split(/\b(?:as|after|amid|while|despite)\b/)[0];
  const up = /(gold|xau|bullion|emas)[^.]{0,90}\b(surge|rally|soar|jump|climb|rises?|rise|higher|gain|record high|breakout|rebound|bid|extends? (gains?|rises?|rally|rallies)|breaks? (above|through))\b/.test(head)
    || /\b(rate cut|dovish|inflation cools|inflation slows|cpi (falls|slows|cools)|payrolls (miss|weaker|disappoint)|yields? (fall|drop|slip)|dollar (falls|weakens|slips))\b/.test(s);
  const dn = /(gold|xau|bullion|emas)[^.]{0,90}\b(fall|falls|drop|drops|plunge|plunges|slump|slumps|slides?|slips?|sinks?|tumbles?|decline|declines|lower|sell-?off|crash|retreat|profit-taking|breaks? below|hits? (a )?(one|two|three|multi)[- ]year low|bear market)\b/.test(head)
    || /\b(rate hike|hawkish|inflation (hot|rises|accelerat)|payrolls (beat|strong)|yields? (rise|jump|climb)|dollar (rises|strengthens|jumps))\b/.test(s);
  if (up && !dn) return 'bullish';
  if (dn && !up) return 'bearish';
  return '';
}

function slug(name) {
  const s = String(name || '').trim();
  const hit = OUTLET.find(x => x[0].test(s));
  if (hit) return hit[1];
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
}
function display(name) {
  const s = String(name || '').trim();
  const hit = OUTLET.find(x => x[0].test(s));
  return hit ? hit[2] : C.cut(s || 'Sumber', 40);
}
function hash(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const recency = (ageH) => (ageH == null ? .55 : ageH <= 6 ? 1 : ageH <= 18 ? .92 : ageH <= 36 ? .8 : ageH <= 72 ? .62 : .45);
const titleKey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 72);

function itemOf(x, sid, src, tier, wide) {
  const title = C.cut(x && x.title, 180);
  const url = String((x && x.url) || '');
  if (!title || !/^https?:\/\//.test(url)) return null;
  const okTitle = tier === 'resmi' ? (OFFICIAL.test(title) || RELEVANT.test(title))
    : wide ? (RELEVANT.test(title) || MARKETISH.test(title)) : RELEVANT.test(title);
  if (!okTitle) return null;
  const at = x.at instanceof Date ? x.at.getTime() : (x.at ? Date.parse(x.at) : NaN);
  const ageH = isFinite(at) ? Math.max(0, Math.round((Date.now() - at) / 3600000)) : (x.ageH == null ? null : Number(x.ageH));
  if (ageH != null && ageH > MAX_AGE_H) return null;
  const lean = leanOf(title);
  const base = (TIER[tier] || 1) * recency(ageH) * (GOLDISH.test(title) ? 1 : .72);
  return {
    id: hash(sid + '|' + (titleKey(title) || url)),
    title, url, sid, src, tier,
    lean, ageH,
    at: isFinite(at) ? new Date(at).toISOString() : null,
    base: Math.round(base * 1000) / 1000
  };
}

async function bounded(p, ms) {
  return Promise.race([
    p.catch(() => null),
    new Promise(r => setTimeout(() => r(null), ms))
  ]);
}

async function fetchFeed(f) {
  try {
    const xml = await C.get(f.url, { text: true, timeout: 6000 });
    const items = C.rssItems(xml).map(x => itemOf(x, f.id, f.name, f.tier)).filter(Boolean);
    return { id: f.id, name: f.name, tier: f.tier, ok: items.length > 0, count: items.length, items, error: items.length ? '' : 'tidak ada judul relevan' };
  } catch (e) {
    return { id: f.id, name: f.name, tier: f.tier, ok: false, count: 0, items: [], error: C.cut(e && e.message || e, 90) };
  }
}

async function fetchTopic(t) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await C.usNews(t.q);
      const items = (r && r.items || []).map(x => itemOf(x, slug(x.source), display(x.source), 'media')).filter(Boolean);
      return { id: 'gnews:' + t.id, name: 'Google News · ' + t.id, tier: 'media', ok: items.length > 0, count: items.length, items, error: items.length ? '' : 'tidak ada judul relevan' };
    } catch (e) {
      /* 429 = batas laju. Beri jeda sekali, jangan mengulang terus. */
      if (attempt === 0 && /429/.test(String(e && e.message || ''))) { await new Promise(r => setTimeout(r, 1200)); continue; }
      return { id: 'gnews:' + t.id, name: 'Google News · ' + t.id, tier: 'media', ok: false, count: 0, items: [], error: C.cut(e && e.message || e, 90) };
    }
  }
  return { id: 'gnews:' + t.id, name: 'Google News · ' + t.id, tier: 'media', ok: false, count: 0, items: [], error: 'tidak tersedia' };
}

async function fetchYt(channel) {
  try {
    const items = (await C.ytRss(channel.id, channel.name))
      .map(x => itemOf(x, slug(channel.name), channel.name, 'media', true)).filter(Boolean);
    return { id: 'yt:' + channel.name, name: 'YouTube · ' + channel.name, tier: 'media', ok: items.length > 0, count: items.length, items, error: items.length ? '' : 'tidak ada video relevan' };
  } catch (e) {
    return { id: 'yt:' + channel.name, name: 'YouTube · ' + channel.name, tier: 'media', ok: false, count: 0, items: [], error: C.cut(e && e.message || e, 90) };
  }
}

/* YouTube pencarian akademi/komunitas emas. Konteks, bukan sumber resmi;
   tidak boleh menggeser keyakinan sebelum punya minimal 4 hasil terukur. */
async function fetchAcademy() {
  try {
    const r = await C.ytGoldAcademy();
    const items = (r && r.items || []).map(x => itemOf({
      title: x.title, url: x.url, at: x.at || null, ageH: x.ageH
    }, 'ytacademy:' + slug(x.channel || 'gold-academy'), 'YouTube · ' + (x.channel || 'akademi emas'), 'komunitas', true)).filter(Boolean);
    return { id: 'ytacademy:gold', name: 'YouTube · akademi/komunitas emas', tier: 'komunitas', ok: items.length > 0, count: items.length, items, error: items.length ? '' : (r && r.note) || 'tidak ada video relevan' };
  } catch (e) {
    return { id: 'ytacademy:gold', name: 'YouTube · akademi/komunitas emas', tier: 'komunitas', ok: false, count: 0, items: [], error: C.cut(e && e.message || e, 90) };
  }
}

function merge(all) {
  const map = new Map();
  all.forEach(r => {
    (r.items || []).forEach(x => {
      const k = titleKey(x.title);
      const cur = map.get(k);
      /* Duplikat judul: pakai sumber dengan kelas lebih tinggi / lebih segar. */
      if (!cur || (TIER[x.tier] || 1) > (TIER[cur.tier] || 1)) map.set(k, x);
    });
  });
  const per = new Map();
  const out = [];
  [...map.values()].sort((a, b) => b.base - a.base).forEach(x => {
    const n = per.get(x.sid) || 0;
    if (n >= PER_SOURCE) return;
    per.set(x.sid, n + 1);
    out.push(x);
  });
  return out.slice(0, MAX_ITEMS);
}

let cache = null, inflight = null;
async function load() {
  if (cache && Date.now() - cache.t < TTL_MS) return cache.v;
  if (inflight) return inflight;
  inflight = (async () => {
    const jobs = [
      ...FEEDS.map(f => bounded(fetchFeed(f), REQUEST_BUDGET_MS)),
      ...TOPICS.map(t => bounded(fetchTopic(t), REQUEST_BUDGET_MS)),
      ...C.YT_OFFICIAL.map(ch => bounded(fetchYt({ id: ch[1], name: ch[0] }), REQUEST_BUDGET_MS)),
      bounded(fetchAcademy(), REQUEST_BUDGET_MS)
    ];
    const res = (await Promise.all(jobs)).filter(Boolean);
    const items = merge(res);
    const v = {
      ok: items.length > 0,
      at: new Date().toISOString(),
      items,
      sources: res.map(r => ({ id: r.id, name: r.name, tier: r.tier, ok: r.ok, count: r.count, error: r.error || '' })),
      note: items.length
        ? items.length + ' bukti dari ' + res.filter(r => r.ok).length + '/' + res.length + ' feed terpercaya. Judul + tautan + waktu; isi tidak diarang.'
        : 'Feed terpercaya tidak dapat dijangkau dari server saat ini; tidak ada bukti yang diklaim.'
    };
    cache = { t: Date.now(), v };
    return v;
  })();
  try { return await inflight; } finally { inflight = null; }
}

/* Statistik akurasi per sumber (dari hasil nyata klien) -> bobot bukti. */
function sourceWeight(stat) {
  if (!stat || !(stat.n >= 4) || stat.accuracy == null) return 1;
  return Math.max(0.6, Math.min(1.3, 0.6 + stat.accuracy / 100 * 0.7));
}

function view(kb, learn, cap, dir) {
  const base = kb || { ok: false, items: [], sources: [], note: 'Pengetahuan global belum dimuat.' };
  const sl = L.sourceLearning(learn && learn.sources);
  const seen = new Map();
  sl.sources.forEach(x => seen.set(x.s, x));
  const items = (base.items || []).map(x => {
    const st = seen.get(x.sid);
    const sw = sourceWeight(st);
    const baseW = isFinite(Number(x.base)) && Number(x.base) > 0 ? Number(x.base) : .5;
    return {
      ...x,
      w: Math.round(baseW * sw * 1000) / 1000,
      sourceN: st ? st.n : 0,
      sourceAccuracy: st ? st.accuracy : null
    };
  }).sort((a, b) => b.w - a.w);
  /* Hanya sumber yang sudah punya >=4 hasil nyata yang boleh menggeser
     keyakinan. Tanpa bukti, berita tetap tampil sebagai konteks saja. */
  const measured = items.filter(x => x.lean && x.sourceN >= 4);
  let sum = 0, tot = 0;
  measured.forEach(x => {
    const w = x.w;
    sum += (x.lean === 'bullish' ? 1 : -1) * w;
    tot += w;
  });
  const score = tot ? sum / tot : 0;
  const aligned = dir === 'BUY' ? score : dir === 'SELL' ? -score : 0;
  const lim = Math.max(0, Math.min(8, Number(cap) || 5));
  /* Butuh minimal dua sumber berbeda yang sudah terukur. Satu outlet dengan
     dua judul tidak boleh menggeser keyakinan sendirian. */
  const measuredSources = new Set(measured.map(x => x.sid)).size;
  const delta = measuredSources >= 2 && dir ? Math.max(-lim, Math.min(lim, Math.round(aligned * lim))) : 0;
  const bull = items.filter(x => x.lean === 'bullish').length;
  const bear = items.filter(x => x.lean === 'bearish').length;
  const lean = bull === bear ? 'netral' : bull > bear ? 'bullish' : 'bearish';
  return {
    ok: !!base.ok,
    at: base.at,
    total: items.length,
    measured: measured.length,
    measuredSources,
    lean, bull, bear,
    items: items.slice(0, 12).map(x => ({ id: x.id, title: x.title, url: x.url, sid: x.sid, src: x.src, tier: x.tier, lean: x.lean, ageH: x.ageH, at: x.at, w: x.w, sourceN: x.sourceN, sourceAccuracy: x.sourceAccuracy })),
    sources: (base.sources || []).map(x => ({ ...x })),
    learning: { n: sl.n, accuracy: sl.accuracy, sources: sl.sources.slice(0, 12) },
    bias: {
      lean, score: Math.round(score * 100) / 100, delta, measured: measured.length,
      note: measuredSources >= 2
        ? 'Bukti global: ' + bull + ' bullish / ' + bear + ' bearish dari ' + items.length + ' judul; ' + measuredSources + ' sumber sudah punya akurasi terukur. Keyakinan disesuaikan ' + (delta >= 0 ? '+' : '') + delta + ' poin, arah tidak diubah.'
        : 'Bukti global: ' + bull + ' bullish / ' + bear + ' bearish dari ' + items.length + ' judul. Belum ada cukup sumber dengan akurasi terukur, jadi keyakinan tidak digeser; bukti hanya dipakai sebagai konteks.'
    },
    note: base.note
  };
}

module.exports = { load, view, leanOf, TIER, FEEDS, TOPICS };
