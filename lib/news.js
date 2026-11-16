/* =====================================================================
   NEWS ANALISIS — ditulis ulang dari nol.
   Isi: 4 rilis inti (NFP, CPI, PPI, FOMC) + rilis lain yang muncul
   bersamaan. Arah BUY/SELL dan status spike TIDAK ditebak AI: dihitung
   dari reaksi harga nyata, kejutan aktual vs konsensus, dan data pasar.
   AI hanya merangkum seluruh sumber menjadi satu dokumen.
   ===================================================================== */
'use strict';
const C = require('./xau-core');

const TAGS = ['NFP', 'CPI', 'PPI', 'FOMC'];
const NAME = {
  NFP: 'Non-Farm Payrolls', CPI: 'Consumer Price Index', PPI: 'Producer Price Index',
  FOMC: 'FOMC — Federal Funds Rate & Statement'
};
const BASE_PIPS = { NFP: 260, CPI: 230, PPI: 175, FOMC: 360 };
const UNIT = { NFP: 75, CPI: 0.15, PPI: 0.15, FOMC: 0.25 };
const P = C.r2;

const HEAD_SCORE = (tag, t) => {
  const s = String(t || '');
  if (tag === 'NFP') return /^non[ -]?farm payrolls$/i.test(s) ? 3 : /payroll/i.test(s) && !/private|government|manufactur/i.test(s) ? 1 : 0;
  if (tag === 'CPI') return /cleveland|philly|regional|ny fed/i.test(s) ? 0 : /^cpi$/i.test(s) ? 3 : /^cpi (mom|m\/m|yoy|y\/y)$/i.test(s) ? 3 : /cpi|consumer price index/i.test(s) ? (/core/i.test(s) ? 1 : 2) : 0;
  if (tag === 'PPI') return /^ppi mo(m)?$/i.test(s) ? 3 : /^ppi yoy$/i.test(s) ? 2 : /ppi|producer price/i.test(s) ? (/core|ex food/i.test(s) ? 1 : 1.5) : 0;
  return /^interest rate$/i.test(s) || /(interest rate decision|fomc statement)/i.test(s) ? 3 : /fomc|federal funds/i.test(s) ? 1 : 0;
};

function eventOf(cal, tag, official) {
  const now = Date.now();
  let list = cal.filter(e => e.tag === tag && HEAD_SCORE(tag, e.title) > 0);
  if (!list.length) list = cal.filter(e => e.tag === tag);
  const max = Math.max(...list.map(e => HEAD_SCORE(tag, e.title)));
  if (isFinite(max)) list = list.filter(e => HEAD_SCORE(tag, e.title) === max);
  const recent = list.filter(e => e.ts <= now + 5 * 60000).sort((a, b) => b.ts - a.ts)[0];
  if (recent && now - recent.ts <= 48 * 3600000) return { ...recent, released: true };
  const next = list.filter(e => e.ts > now).sort((a, b) => a.ts - b.ts)[0];
  /* Rilis lama hanya boleh dipakai bila masih dalam 48 jam. Jika tidak,
     selalu pakai jadwal berikutnya — jangan menyajikan NFP 9 hari lalu
     seolah-olah rilis yang sedang dianalisis. */
  const cand = recent && now - recent.ts <= 48 * 3600000
    ? [next, recent].filter(Boolean).sort((a, b) => Math.abs(a.ts - now) - Math.abs(b.ts - now))[0]
    : next;
  if (cand) return { ...cand, released: !!cand.ts && cand.ts <= now };
  /* Kalender dua minggu tidak memuat rilis ini (mis. NFP awal bulan depan).
     Jangan mengarang tanggal: pakai DATA TERAKHIR dari FRED dan beri label
     periode resminya. Reaksi candle tidak dihitung karena jendelanya lewat. */
  if (official && official.ok) {
    return {
      tag, title: NAME[tag] + ' — data terakhir', ts: null, derived: true, released: true,
      forecast: '', previous: official.prev == null ? '' : String(official.prev), actual: '',
      actualOfficial: official.value, verified: 'fred', period: official.period, impact: 'High'
    };
  }
  return null;
}

function officialActual(tag) {
  return C.memo('official:' + tag, 900000, async () => {
    try {
      if (tag === 'NFP') {
        const [pay, un] = await Promise.all([C.fred('PAYEMS'), C.fred('UNRATE').catch(() => null)]);
        const r = pay.rows, n = r.length;
        const d = i => (i >= 1 ? Math.round((r[n - i].v - r[n - i - 1].v) * 10) / 10 : null);
        return {
          ok: true, label: 'Perubahan payrolls (FRED PAYEMS)', value: d(1), prev: d(2), prev2: d(3),
          period: r[n - 1].d, unit: 'ribu', source: 'FRED · PAYEMS',
          extra: un ? [{ metric: 'Unemployment rate', latest: un.last.v + '%', previous: un.prev.v + '%', period: un.last.d, source: 'FRED · UNRATE' }] : []
        };
      }
      if (tag === 'CPI') {
        const [cpi, core] = await Promise.all([C.fred('CPIAUCSL'), C.fred('CPILFESL').catch(() => null)]);
        const rows = cpi.rows, n = rows.length;
        const mom = i => (i >= 1 && rows[n - i - 1].v ? Math.round((rows[n - i].v / rows[n - i - 1].v - 1) * 10000) / 100 : null);
        const yoy = i => (n - i - 12 >= 0 && rows[n - i - 12].v ? Math.round((rows[n - i].v / rows[n - i - 12].v - 1) * 10000) / 100 : null);
        const crows = core ? core.rows : [], cn = crows.length;
        const cyoy = cn > 12 ? Math.round((crows[cn - 1].v / crows[cn - 13].v - 1) * 10000) / 100 : null;
        return {
          ok: true, label: 'CPI (FRED CPIAUCSL)', value: yoy(1), prev: yoy(2), unit: '% YoY', period: rows[n - 1].d, source: 'FRED · CPIAUCSL',
          extra: [
            { metric: 'CPI MoM', latest: mom(1), previous: mom(2), unit: '%', period: rows[n - 1].d, source: 'FRED · CPIAUCSL' },
            ...(cyoy == null ? [] : [{ metric: 'Core CPI YoY', latest: cyoy, unit: '%', period: crows[cn - 1].d, source: 'FRED · CPILFESL' }])
          ]
        };
      }
      if (tag === 'PPI') {
        /* Hanya PPI final demand (WPSFD4). Jangan fallback ke PPIACO:
           itu indeks semua komoditas, metriknya berbeda dari rilis PPI. */
        const ppi = await C.fred('WPSFD4');
        const rows = ppi.rows, n = rows.length;
        const mom = i => (n - i - 1 >= 0 && rows[n - i - 1].v ? Math.round((rows[n - i].v / rows[n - i - 1].v - 1) * 10000) / 100 : null);
        const yoy = i => (n - i - 12 >= 0 && rows[n - i - 12].v ? Math.round((rows[n - i].v / rows[n - i - 12].v - 1) * 10000) / 100 : null);
        return {
          ok: true, label: 'PPI final demand MoM (FRED ' + ppi.id + ')', value: mom(1), prev: mom(2), unit: '% MoM', period: rows[n - 1].d, source: 'FRED · ' + ppi.id,
          extra: [{ metric: 'PPI YoY', latest: yoy(1), previous: yoy(2), unit: '%', period: rows[n - 1].d, source: 'FRED · ' + ppi.id }]
        };
      }
      const [up, low] = await Promise.all([C.fred('DFEDTARU'), C.fred('DFEDTARL').catch(() => null)]);
      return {
        ok: true, label: 'Fed funds target (upper)', value: up.last.v, prev: up.prev.v, unit: '%', period: up.last.d, source: 'FRED · DFEDTARU',
        extra: low ? [{ metric: 'Fed funds target (lower)', latest: low.last.v, previous: low.prev.v, unit: '%', period: low.last.d, source: 'FRED · DFEDTARL' }] : []
      };
    } catch (e) { return { ok: false, error: C.cut(e && e.message || e, 140) }; }
  });
}

function parseNum(s) { const m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }

function reactionOf(ev, m5, m15) {
  if (!ev || !ev.ts || ev.ts > Date.now()) return null;
  if (Date.now() - ev.ts > 24 * 3600000) return null; // reaksi hanya dihitung maksimal 24 jam setelah rilis
  const m5ok = Array.isArray(m5) && m5.length > 12 && m5[0].t <= ev.ts;
  const rows = m5ok ? m5 : (Array.isArray(m15) ? m15 : []);
  const pre = rows.filter(r => r.t <= ev.ts), post = rows.filter(r => r.t > ev.ts);
  if (!pre.length || post.length < 2) return null;
  const anchor = pre[pre.length - 1].c;
  /* Hanya jendela reaksi 45 menit setelah rilis. Jangan memakai drift harga
     berjam-jam kemudian sebagai "reaksi berita" — itu sumber arah keliru. */
  const win = post.filter(r => r.t <= ev.ts + 45 * 60000);
  const w = win.length ? win : post.slice(0, 3);
  const last = w[w.length - 1].c;
  if (!(anchor > 0) || !(last > 0)) return null;
  const netPips = Math.round((last - anchor) / 0.1);
  /* Jaring pengaman: reaksi XAUUSD dalam 45 menit tidak masuk akal melebihi
     10.000 pip (1.000 USD). Kalau terjadi, data candle rusak -> jangan klaim. */
  if (!isFinite(netPips) || Math.abs(netPips) > 10000) return null;
  const firstBars = post.slice(0, 3);
  const firstPips = Math.round((firstBars[firstBars.length - 1].c - anchor) / 0.1);
  const hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  if (!(hi > 0) || !(lo > 0) || !isFinite(hi) || !isFinite(lo)) return null;
  return {
    tag: ev.tag, releasedAt: new Date(ev.ts).toISOString(), agoMin: Math.round((Date.now() - ev.ts) / 60000),
    anchor: P(anchor), last: P(last), netPips, firstPips,
    rangePips: Math.round((hi - lo) / 0.1), upPips: Math.round((hi - anchor) / 0.1), downPips: Math.round((anchor - lo) / 0.1),
    dir: Math.abs(netPips) < 12 ? 'DUA ARAH' : netPips > 0 ? 'BUY' : 'SELL',
    firstDir: Math.abs(firstPips) < 12 ? 'DUA ARAH' : firstPips > 0 ? 'BUY' : 'SELL',
    bar: m5ok ? 'M5' : 'M15', source: 'candle live mesin'
  };
}

function marketContext(d, tv) {
  const pct = (a, b) => (b ? Math.round((a / b - 1) * 10000) / 100 : null);
  const g = d.d1 ? d.d1.rows.map(r => r.c) : [];
  const dxy = d.dxy ? d.dxy.rows.map(r => r.c) : [];
  const tnx = d.tnx ? d.tnx.rows.map(r => r.c) : [];
  return {
    gold1d: g.length > 1 ? pct(g[g.length - 1], g[g.length - 2]) : null,
    gold5d: g.length > 5 ? pct(g[g.length - 1], g[g.length - 6]) : null,
    dxy5d: dxy.length > 5 ? pct(dxy[dxy.length - 1], dxy[dxy.length - 6]) : null,
    yield10_5d: tnx.length > 5 ? Math.round((tnx[tnx.length - 1] - tnx[tnx.length - 6]) * 100) / 100 : null,
    tv: tv && tv.ok ? { bias: tv.biasLabel, strength: tv.strength, weighted: tv.weighted, price: tv.price } : null
  };
}

/* Rilis pers resmi: Federal Reserve & BLS. Konteks tambahan, bukan pengganti angka. */
const OFFICIAL_FEEDS = [
  ['Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml'],
  ['BLS', 'https://www.bls.gov/feed/bls_latest.rss'],
  ['BEA', 'https://apps.bea.gov/rss/rss.xml'],
  ['US Treasury', 'https://home.treasury.gov/rss/press.xml']
];
const officialNews = (focus) => C.memo('offnews:' + focus, 180000, async () => {
  const key = focus === 'FOMC' ? /fomc|federal|rate|monetary|statement|powell/i
    : focus === 'NFP' ? /payroll|employment|job|unemployment|labou?r/i
      : focus === 'CPI' ? /consumer price|inflation|cpi/i : /producer price|ppi|wholesale/i;
  const all = [];
  for (const [src, url] of OFFICIAL_FEEDS) {
    try {
      const xml = await C.get(url, { text: true, timeout: 12000 });
      C.rssItems(xml).slice(0, 20).forEach(x => {
        const at = x.at && isFinite(x.at.getTime()) ? x.at : null;
        all.push({ title: x.title, url: x.url, source: src, at: at ? at.toISOString() : null, ageH: at ? Math.round((Date.now() - at.getTime()) / 3600000) : null });
      });
    } catch (e) { }
  }
  const rel = all.filter(x => key.test(x.title)).sort((a, b) => (a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH));
  const items = (rel.length ? rel : all).slice(0, 6);
  return { ok: items.length > 0, items, at: new Date().toISOString() };
});

function marketScore(d, tv) {
  let score = 0;
  const ev = [];
  const add = (w, why) => { const n = Number(w); if (!isFinite(n) || Math.abs(n) < 0.05) return; score += n; ev.push({ w: Math.round(n * 100) / 100, why }); };
  if (d.d1) {
    const c = d.d1.rows.map(r => r.c), last = c[c.length - 1], p1 = c[c.length - 2];
    const chg1 = p1 ? (last / p1 - 1) * 100 : null, chg5 = c.length > 5 ? (last / c[c.length - 6] - 1) * 100 : null;
    const s20 = C.sma(c, 20), s50 = C.sma(c, 50);
    if (chg1 != null) add(C.clip(chg1 * 0.5, -1.2, 1.2), 'Emas 1 hari ' + (chg1 > 0 ? '+' : '') + P(chg1) + '%');
    if (chg5 != null) add(C.clip(chg5 * 0.8, -2, 2), 'Emas 5 hari ' + (chg5 > 0 ? '+' : '') + P(chg5) + '%');
    if (s20 && s50) add(last > s20 && s20 > s50 ? 0.6 : last < s20 && s20 < s50 ? -0.6 : 0, 'Tren harian emas (SMA20 vs SMA50)');
  }
  if (d.dxy) {
    const c = d.dxy.rows.map(r => r.c), last = c[c.length - 1], p5 = c.length > 5 ? c[c.length - 6] : null;
    if (p5) { const chg = (last / p5 - 1) * 100; add(C.clip(-chg * 0.9, -1.8, 1.8), 'DXY 5 hari ' + (chg > 0 ? '+' : '') + P(chg) + '%'); }
  }
  if (d.tnx) {
    const c = d.tnx.rows.map(r => r.c), last = c[c.length - 1], p5 = c.length > 5 ? c[c.length - 6] : null;
    if (p5) { const dpp = last - p5; add(C.clip(-dpp * 3, -1.6, 1.6), 'Yield 10Y 5 hari ' + (dpp > 0 ? '+' : '') + P(dpp) + 'pp'); }
  }
  if (tv && tv.ok) add(C.clip(tv.weighted * 2.2, -2, 2), 'TradingView gabungan ' + tv.biasLabel + ' (' + tv.strength + '%)');
  return { score: Math.round(score * 100) / 100, evidence: ev.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)) };
}

function analyse(focus, pack) {
  const { ev, official, cal, d, tv } = pack;
  /* Pakai angka kalender sebagai aktual rilis ini (satu skala dengan forecast).
     Angka FRED tetap ditampilkan di tabel perbandingan sebagai verifikasi resmi. */
  const actCal = ev ? parseNum(ev.actual) : null;
  const act = actCal != null ? actCal : ev ? parseNum(ev.actualOfficial) : null;
  const fc = ev ? parseNum(ev.forecast) : null;
  const unit = UNIT[focus] || 0.15;
  const react = ev ? reactionOf(ev, d.m5 && d.m5.rows, d.m15.rows) : null;
  const mk = marketScore(d, tv);
  let score = mk.score;
  /* ---------- pra-rilis: apakah kita berada di T-3 menit? ---------- */
  const mins = ev && ev.ts ? Math.round((ev.ts - Date.now()) / 6000) / 10 : null;
  const preWindow = mins != null && mins > 0 && mins <= 3;
  const armed = mins != null && mins > 0 && mins <= 10;
  const preReasons = [];
  let preScore = 0;
  const preAdd = (w, why) => {
    const n = Number(w);
    if (!isFinite(n) || Math.abs(n) < 0.03) return;
    preScore += n;
    preReasons.push({ w: P(n), why });
  };
  if (d.m5 && d.m5.rows.length > 13) {
    const c = d.m5.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 13];
    const dp = Math.round((last - ref) / 0.1);
    if (isFinite(dp) && Math.abs(dp) <= 3000) preAdd(C.clip(dp / 220, -1, 1), 'Posisi emas 1 jam sebelum rilis: ' + (dp > 0 ? '+' : '') + dp + ' pip (momentum pra-rilis)');
  }
  if (d.dxyTv && d.dxyTv.rows.length > 5) {
    const c = d.dxyTv.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 5];
    if (ref) {
      const ch = (last / ref - 1) * 100;
      preAdd(C.clip(-ch * 2.2, -1.1, 1.1), 'DXY M15 1 jam: ' + (ch > 0 ? '+' : '') + P(ch) + '% → ' + (ch > 0 ? 'tekanan turun emas' : 'dukungan naik emas'));
    }
  }
  if (d.us10Tv && d.us10Tv.rows.length > 5) {
    const c = d.us10Tv.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 5];
    if (ref) {
      const ch = last - ref;
      preAdd(C.clip(-ch * 2.5, -0.9, 0.9), 'Yield 10Y M15 1 jam: ' + (ch > 0 ? '+' : '') + P(ch) + ' pp → ' + (ch > 0 ? 'tekanan turun emas' : 'dukungan naik emas'));
    }
  }
  if (tv && tv.ok) preAdd(C.clip(tv.weighted * 1.8, -1.3, 1.3), 'TradingView gabungan ' + tv.biasLabel + ' (' + tv.strength + '%)');
  let nowcast = null;
  if (focus === 'NFP' && official && official.ok) {
    const ov = Number(official.value), ofc = ev ? parseNum(ev.forecast) : null;
    if (isFinite(ov) && ofc != null) {
      const gap = P(ov - ofc);
      nowcast = { last: ov, forecast: ofc, gap, hot: gap > 0, note: 'NFP terakhir ' + ov + ' ribu vs konsensus sekarang ' + ofc + ' ribu (nowcast momentum, bukan aktual rilis ini)' };
      preAdd(C.clip(-gap / 40, -1.3, 1.3), nowcast.note + ' → ' + (gap > 0 ? 'risiko data panas, emas tertekan' : 'risiko data dingin, emas didukung'));
    }
  }
  preScore = C.clip(P(preScore) || 0, -3.5, 3.5);
  const preDir = preScore >= 0 ? 'BUY' : 'SELL';
  const preConf = Math.round(Math.min(72, 50 + Math.abs(preScore) * 9));
  const hotDir = 'SELL', coldDir = 'BUY';
  const timing = {
    minutes: mins, status: mins == null ? 'TANPA JADWAL' : mins <= 0 ? 'SUDAH TERBIT' : preWindow ? 'PRA-RILIS T-3' : armed ? 'SIAP-SIAGA T-10' : 'MENUNGGU',
    preWindow, armed, dir: preDir, confidence: preConf, score: preScore, reasons: preReasons.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
    nowcast,
    playbook: [
      'Jangan buka posisi sebelum rilis; spread dan likuiditas buruk di detik pertama.',
      'T-3 menit: kunci bias pra-rilis ' + preDir + ' (' + preConf + '%) dari DXY, yield, TV, dan momentum emas — ini prakiraan, bukan kepastian.',
      'Setelah angka keluar: aktual > konsensus → ' + hotDir + ' emas; aktual < konsensus → ' + coldDir + ' emas; sama dengan konsensus → tunggu reaksi 5 menit.',
      'Entry hanya setelah candle M5 pertama pasca-rilis close searah; SL 30 pip; TP1 ke likuiditas terdekat, TPmax ke swing/PDH-PDL.'
    ],
    caveat: preWindow ? 'Jendela 2–3 menit sebelum rilis: angka aktual belum ada, jadi ini prakiraan berbasis posisi pasar — bukan hasil rilis.' : 'Prediksi pra-rilis hanya aktif pada 3 menit terakhir sebelum jadwal; di luar itu statusnya perencanaan.'
  };
  const evidence = mk.evidence.slice();
  let surprise = null;
  if (act != null && fc != null) {
    /* Rilis index-level (mis. CPI 337,5) dibandingkan sebagai % perubahan
       terhadap previous, bukan selisih level mentah. */
    const prevNum = parseNum(ev.previous);
    const isIndex = focus === 'CPI' && !ev.unit && act > 100 && fc > 100 && prevNum > 0;
    const diff = isIndex ? ((act / prevNum - 1) - (fc / prevNum - 1)) * 100 : act - fc;
    const u = isIndex ? 0.1 : unit;
    const hot = diff > 0;
    const w = C.clip(-(Math.abs(diff) / u) * 1.8, -2.4, 2.4) * (hot ? 1 : -1);
    score += w;
    surprise = { actual: act, forecast: fc, previous: prevNum, diff: P(diff), unit: isIndex ? 'pp (perubahan dari previous)' : (ev.unit || ''), hot, weight: P(w) };
    evidence.push({ w: P(w), why: focus + ' aktual ' + act + (isIndex ? ' (indeks, setara ' + P((act / prevNum - 1) * 100) + '% vs previous)' : '') + ' vs konsensus ' + fc + ' → ' + (hot ? 'lebih panas/kuat (tekanan turun emas)' : 'lebih dingin/lemah (dukungan naik emas)') });
  }
  if (react && react.dir !== 'DUA ARAH') {
    const w = C.clip(react.netPips / 45, -3, 3);
    score += w;
    evidence.push({ w: P(w), why: 'Reaksi nyata emas 45 menit setelah rilis: ' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip → ' + react.dir });
  }
  /* Pra-rilis: arah harus berasal dari skor pra-rilis yang sama dengan kartu
     timing. Jangan menampilkan arah mesin lain yang membuat dua kesimpulan. */
  const preOnly = act == null && !react;
  if (preOnly) {
    score = P(mk.score * 0.35 + preScore * 0.65) || 0;
    preReasons.forEach(x => evidence.push({ w: x.w, why: 'Pra-rilis: ' + x.why }));
  }
  score = P(score) || 0;
  let dir = score >= 0 ? 'BUY' : 'SELL';
  let source = preOnly ? 'pra-rilis (DXY, yield, TV, momentum emas)' : 'skor data pasar';
  if (react && react.dir !== 'DUA ARAH' && Math.abs(react.netPips) >= 20) { dir = react.dir; source = 'reaksi rilis terukur'; }
  else if (Math.abs(score) >= 3.5) source = preOnly ? 'pra-rilis (skor kuat)' : 'skor data pasar';
  else if (tv && tv.ok && tv.bias !== 0) { dir = tv.bias > 0 ? 'BUY' : 'SELL'; source = preOnly ? 'pra-rilis + TradingView live' : 'TradingView live'; }
  const base = BASE_PIPS[focus] || 220;
  const atrPips = d.m15 ? Math.round((C.atr(d.m15.rows, 14) || 3) / 0.1) : null;
  const scale = C.clip((atrPips || 30) / 30, 0.6, 1.8);
  let spike;
  if (react) {
    const likely = react.rangePips >= Math.round(base * scale * 0.45);
    spike = {
      likely, measured: true, sizePips: { min: Math.min(react.rangePips, Math.round(base * scale * 2)), max: Math.max(react.rangePips, Math.round(base * scale * 1.2)) },
      windowMin: 45, firstDir: react.firstDir, reaction: react,
      why: 'Terukur dari candle live: rentang ' + react.rangePips + ' pip dalam 45 menit setelah rilis (naik ' + react.upPips + ' / turun ' + react.downPips + '), net ' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip.'
    };
  } else {
        const past = ev.released || ev.derived;
    spike = {
      likely: !past, measured: false, sizePips: { min: Math.round(base * scale * 0.7), max: Math.round(base * scale * 1.35) },
      windowMin: focus === 'FOMC' ? 35 : 25, firstDir: 'DUA ARAH',
      why: past
        ? 'Rilis sudah lewat lebih dari 24 jam, jadi jendela spike tidak bisa diukur dari candle live. Status spike TIDAK diklaim; rentang di bawah hanya proyeksi kelas rilis ' + focus + ' + ATR live.'
        : 'Belum terbit: rentang diperkirakan dari kelas rilis ' + focus + ' + ATR live ' + (atrPips == null ? '—' : atrPips + ' pip') + '. Ini perkiraan berbasis data, bukan hasil terukur.'
    };
  }
  if (preOnly) {
    timing.dir = dir;
    timing.score = score;
    timing.confidence = Math.max(timing.confidence, Math.min(80, Math.round(50 + Math.abs(score) * 8)));
    timing.playbook[1] = 'T-3 menit: kunci bias pra-rilis ' + dir + ' (' + timing.confidence + '%) dari DXY, yield, TV, dan momentum emas — satu arah dengan putusan mesin.';
  }
  return { dir, source, score, evidence: evidence.slice(0, 10), surprise, reaction: react, spike, timing, officialOk: !!official.ok };
}

const cache = new Map();

function sanitizeDoc(o) {
  o = o && typeof o === 'object' ? o : {};
  const arr = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f).filter(Boolean) : []);
  const s = (v, n) => C.cut(v == null ? '' : v, n || 400);
  return {
    headline: s(o.headline, 160),
    summary: s(o.summary, 1600),
    focus_what: s(o.focus_what, 700),
    why_gold: s(o.why_gold, 900),
    why_valid: s(o.why_valid, 900),
    prediction_2_3m: s(o.prediction_2_3m, 600),
    confidence: isFinite(Number(o.confidence)) ? Math.max(0, Math.min(100, Number(o.confidence))) : null,
    fact_vs_inference: s(o.fact_vs_inference, 500),
    youtube_read: s(o.youtube_read, 500),
    data_chain: arr(o.data_chain, 6, x => ({ source: s(x && x.source, 60), fact: s(x && x.fact, 180), weight: s(x && x.weight, 40) })),
    bull_case: s(o.bull_case, 600), bear_case: s(o.bear_case, 600),
    comparison: arr(o.comparison, 8, x => ({ metric: s(x && x.metric, 70), latest: s(x && x.latest, 28), previous: s(x && x.previous, 28), change: s(x && x.change, 56), source: s(x && x.source, 50) })),
    concurrent: arr(o.concurrent, 8, x => ({ title: s(x && x.title, 120), when: s(x && x.when, 40), impact: s(x && x.impact, 12), gold_effect: s(x && x.gold_effect, 260) })),
    scenarios: arr(o.scenarios, 4, x => ({ name: s(x && x.name, 50), if: s(x && x.if, 220), then: s(x && x.then, 260) })),
    risks: arr(o.risks, 6, x => s(x, 220)),
    validity: arr(o.validity, 8, x => s(x, 240)),
    sources: arr(o.sources, 8, x => s(x, 160))
  };
}

async function build(focus) {
  const calRaw = await C.calendar();
  const cal = calRaw.filter(x => x.cur === 'USD').map(x => ({ ...x, tag: C.calTag(x.title), ts: Date.parse(x.date) }));
  const official = await officialActual(focus);
  const ev0 = eventOf(cal, focus, official);
  if (!ev0) throw new Error('Jadwal dan data resmi ' + focus + ' belum terbaca. Coba lagi beberapa saat lagi.');
  const d = await C.candles();
  const sp = await C.spot().catch(() => null);
  const tv = await C.tvRead();
      const [us, yt, offNews, macroBoard] = await Promise.all([
      C.usNews(focus + ' OR gold OR XAUUSD OR "Federal Reserve"').catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) })),
      C.youtube(focus).catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) })),
      officialNews(focus).catch(() => ({ ok: false, items: [] })),
      C.fredBoard().catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) }))
    ]);
  const concurrent = ev0.ts ? cal.filter(x => x.ts !== ev0.ts && Math.abs(x.ts - ev0.ts) <= 120 * 60000 && /high|medium/i.test(x.impact || '')).sort((a, b) => a.ts - b.ts) : [];
  /* Angka FRED hanya boleh dianggap "aktual rilis ini" bila periodenya cocok
     dengan jadwal rilis (NFP/CPI/PPI: periode bulan lalu; FOMC: efek beberapa
     hari setelah keputusan). Kalau tidak cocok, itu data lama — jangan dicampur. */
  const periodic = (() => {
    if (!official.ok || !official.period) return false;
    if (!ev0.ts) return true;
    const p = Date.parse(official.period);
    if (!isFinite(p)) return false;
    const diff = ev0.ts - p;
    if (!(diff >= 0 && diff <= 46 * 86400000)) return false;
    /* Skala harus sebanding: CPI kalender memakai level indeks (337,5),
       FRED menyajikan % YoY (4,08). Jangan pasang 4,08 sebagai "aktual rilis". */
    const a = parseNum(ev0.actual), v = Number(official.value);
    if (a != null && isFinite(v)) {
      const gap = Math.abs(a - v), lim = Math.max(Math.abs(a), Math.abs(v)) * 0.5 + 1;
      if (gap > lim) return false;
    }
    return true;
  })();
  const ev = { ...ev0, actualOfficial: periodic ? official.value : null, actualSource: periodic ? official.source : '', officialPeriod: official.ok ? official.period : (ev0.period || '') };
  const pack = analyse(focus, { ev, official, cal: calRaw, d, tv });
  const price = tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : d.m15.last.c;
  const priceSource = tv && tv.ok ? 'chart TradingView ' + C.TV_SYMBOL : sp && sp.ok ? 'spot gold-api' : 'candle ' + C.Y_SYM;
  return {
    ok: true, focus, name: NAME[focus], generatedAt: new Date().toISOString(),
    price, priceSource, tv: tv && tv.ok ? { price: tv.price, bias: tv.bias, label: tv.biasLabel, strength: tv.strength, tf: tv.tf, at: new Date(tv.at).toISOString(), symbol: tv.symbol } : { ok: false, error: (tv && tv.error) || 'TradingView tidak tersedia' },
    spot: sp && sp.ok ? sp.price : null,
    event: {
      tag: ev.tag, title: ev.title, ts: ev.ts || null, when: ev.ts ? new Date(ev.ts).toISOString() : null,
      whenLabel: ev.ts ? null : 'data terakhir FRED · periode ' + (ev.officialPeriod || (official.ok ? official.period : '—')),
      derived: !!ev.derived, impact: ev.impact || 'High',
      forecast: ev.forecast, previous: ev.previous, actual: ev.actual || '', unit: ev.unit || '', period: ev.period || '',
      actualOfficial: ev.actualOfficial, actualSource: ev.actualSource, officialPeriod: ev.officialPeriod,
      verified: ev.verified || 'kalender', released: ev.ts ? ev.ts <= Date.now() : true
    },
    official,
    concurrent: concurrent.map(x => ({ tag: x.tag || '', title: x.title, ts: x.ts, when: new Date(x.ts).toISOString(), impact: x.impact, forecast: x.forecast, previous: x.previous, actual: x.actual })),
    direction: pack.dir, directionSource: pack.source, score: pack.score, evidence: pack.evidence,
    surprise: pack.surprise, reaction: pack.reaction, spike: pack.spike,
    timing: pack.timing,
    aiDirection: null,
    us, yt, officialNews: offNews, macroBoard, marketContext: marketContext(d, tv),
    market: { gold: d.d1 ? { last: P(d.d1.last.c), chg1d: null } : null, tv: tv && tv.ok ? { bias: tv.biasLabel, strength: tv.strength } : null },
    sources: [
      { name: 'TradingView Economic Calendar (cadangan: FairEconomy)', ok: true },
      { name: 'FRED / BLS (angka resmi)', ok: !!official.ok },
      { name: 'TradingView live ' + C.TV_SYMBOL, ok: !!(tv && tv.ok) },
      { name: 'gold-api.com spot', ok: !!(sp && sp.ok) },
      { name: 'Yahoo Finance candle ' + C.Y_SYM, ok: !!d.m15 },
      { name: 'Google News RSS media AS + finansial global', ok: !!us.ok },
      { name: 'YouTube (judul, kanal, umur, kecenderungan)', ok: !!yt.ok },
      { name: 'YouTube transkrip resmi (Bloomberg/Reuters/CNBC)', ok: !!(yt.transcripts && yt.transcripts.ok) },
      { name: 'Pembacaan video resmi (Gemini, tanpa angka)', ok: !!(yt.videoRead && yt.videoRead.ok) },
      { name: 'Papan makro FRED (yield, riil, dolar, breakeven)', ok: !!(macroBoard && macroBoard.ok) }
    ]
  };
}

/* Panel beberapa AI independen: setiap panelis hanya membaca rilis yang dipilih.
   Urutan penyedia dirotasi agar tidak semuanya memakai provider yang sama bila
   key lain tersedia. Hasil panel tidak mengubah arah mesin; ia menjadi bukti
   pembanding dan bahan sintesis. */
async function aiPanel(pack) {
  const orders = [
    ['gemini', 'zai', 'groq', 'nvidia', 'mistral', 'openrouter', 'sambanova', 'cloudflare'],
    ['groq', 'nvidia', 'zai', 'gemini', 'sambanova', 'mistral', 'openrouter', 'cloudflare'],
    ['groq', 'gemini', 'zai', 'mistral', 'openrouter', 'cloudflare', 'sambanova', 'nvidia']
  ];
  const sys = `Kamu salah satu panelis analis makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
FOKUS TUNGGAL: rilis ${pack.focus} (${pack.name}). Jangan menganalisis rilis lain sebagai arah utama; rilis bersamaan hanya boleh disebut sebagai risiko gabungan.
Tugas: baca DATA, lalu beri prakiraan arah emas dan alasan yang bisa diaudit.
ATURAN:
1. Semua angka harus ada di DATA. Jangan mengarang angka, jam, atau level.
2. Bedakan FAKTA (angka/sumber) dari INFERENSI (tafsiran).
3. Bila rilis belum terbit, sebut ini prakiraan pra-rilis, bukan hasil.
4. Jika sinyal saling bertentangan, turunkan confidence; jangan memaksa yakin.
5. Transkrip YouTube adalah caption mentah (bisa auto-caption). Jangan mengambil angka harga/level dari transkrip; hanya untuk konteks naratif.
6. Bahasa Indonesia, padat.
Balas HANYA JSON valid:
{"direction":"BUY" atau "SELL","confidence":0-100,"focus_read":"apa yang diukur rilis ini dan mengapa penting","reasons":["alasan berbasis angka, maks 4"],"data_used":["sumber + angka yang dipakai, maks 4"],"why_valid":"mengapa data ini valid/akurat dan apa keterbatasannya","invalidation":"kondisi yang membatalkan arah","pre_event_plan":"langkah 2-3 menit sebelum dan sesudah rilis"}`;
  const brief = {
    fokus: pack.focus, nama: pack.name,
    jadwal: pack.event.when, menitKeRilis: pack.timing ? pack.timing.minutes : null, status: pack.timing ? pack.timing.status : '',
    dampak: pack.event.impact, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, periodeResmi: pack.event.officialPeriod,
    mesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, praRilis: pack.timing ? { arah: pack.timing.dir, confidence: pack.timing.confidence, alasan: pack.timing.reasons, nowcast: pack.timing.nowcast } : null, bukti: pack.evidence.slice(0, 7), spike: pack.spike },
    makro: pack.macroBoard ? pack.macroBoard.items : [],
    konteksPasar: pack.marketContext,
    tradingview: pack.tv && pack.tv.price ? { harga: pack.tv.price, bias: pack.tv.label, strength: pack.tv.strength } : 'tidak tersedia',
    rilisBersamaan: pack.concurrent.slice(0, 6).map(x => ({ judul: x.title, waktu: x.when, dampak: x.impact })),
    beritaResmi: (pack.officialNews && pack.officialNews.items || []).slice(0, 6).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    mediaAS: pack.us.items.slice(0, 8).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    youtube: pack.yt.items.slice(0, 8).map(x => ({ judul: x.title, kanal: x.channel, resmi: x.trusted || '', umurJam: x.ageH, stance: x.stance })),
    transkripYouTube: ((pack.yt.transcripts && pack.yt.transcripts.items) || []).map(t => ({ judul: t.title, kanal: t.channel, durasi: t.durationLabel, auto: t.auto, teks: t.text.slice(0, 1400) }))
  };
  const q = 'Data untuk rilis fokus ' + pack.focus + ':\n' + JSON.stringify(brief).slice(0, 15000);
  const errs = [];
  const rs = await Promise.all(orders.map((order, i) => Promise.resolve()
    .then(() => (i === 2 ? new Promise(r => setTimeout(r, 6000)) : null))
    .then(() => C.ai(sys, q, { field: 'xau', temp: 0.12 + i * 0.03, maxTok: 1100, deadlineMs: 22000, order }))
    .then(out => {
      const j = C.parseJson(out.text);
      if (!j) return null;
      const s = (v, n) => C.cut(v == null ? '' : v, n || 300);
      const dir = String(j.direction || '').toUpperCase() === 'BUY' ? 'BUY' : String(j.direction || '').toUpperCase() === 'SELL' ? 'SELL' : null;
      if (!dir) return null;
      const conf = Number(j.confidence);
      return {
        id: 'AI-' + (i + 1), provider: out.provider, model: out.model, direction: dir,
        confidence: isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : null,
        focus_read: s(j.focus_read, 400),
        reasons: (Array.isArray(j.reasons) ? j.reasons : []).slice(0, 4).map(x => s(x, 220)).filter(Boolean),
        data_used: (Array.isArray(j.data_used) ? j.data_used : []).slice(0, 4).map(x => s(x, 180)).filter(Boolean),
        why_valid: s(j.why_valid, 400), invalidation: s(j.invalidation, 260), pre_event_plan: s(j.pre_event_plan, 320)
      };
    })
    .catch(e => { errs.push('AI-' + (i + 1) + ': ' + C.cut(e && e.message || e, 140)); return null; })));
  const items = rs.filter(Boolean);
  const votes = { BUY: 0, SELL: 0 };
  items.forEach(x => { votes[x.direction]++; });
  const confs = items.map(x => x.confidence).filter(v => v != null);
  return {
    ok: items.length > 0, items, votes,
    total: items.length,
    consensus: items.length ? (votes.BUY === votes.SELL ? 'SPLIT' : votes.BUY > votes.SELL ? 'BUY' : 'SELL') : null,
    agreement: items.length ? Math.round(Math.max(votes.BUY, votes.SELL) / items.length * 100) : 0,
    avgConfidence: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
    distinctProviders: [...new Set(items.map(x => x.provider).filter(Boolean))].length,
    errors: errs,
    note: 'Tiap panelis memakai urutan penyedia berbeda dan hanya menerima data rilis fokus. Panel tidak mengubah arah mesin.'
  };
}

async function aiDocument(pack, opts) {
  const sys = `Kamu analis makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
Tugas: SATU dokumen ringkasan untuk rilis ${pack.focus} (${pack.name}) dan rilis lain yang muncul bersamaan. Fokus hanya pada ${pack.focus}; rilis lain hanya dibahas sebagai efek gabungan.
ATURAN KERAS:
1. Jangan mengarang angka, tanggal, jam, konsensus, atau level. Semua angka WAJIB dari data di bawah dan sebut sumbernya.
2. Arah final dan status spike SUDAH dihitung mesin dan tidak boleh diubah. Jelaskan alasannya memakai bukti.
3. Bandingkan data terbaru dengan data sebelumnya (bulan/rilis lalu) memakai angka yang tersedia di [RESMI]/[KALENDER]/[MAKRO].
4. [US] dan [YT] hanya konteks narasi; dilarang mengutip harga/level dari judul. Transkrip YouTube resmi hanya konteks kata-kata; jangan memakai angka dari transkrip dan sebut bila caption otomatis.
5. Bahasa Indonesia, padat, tanpa markdown.
6. FOKUS HANYA rilis ${pack.focus}. Jangan mencampur arah dari rilis lain; rilis bersamaan hanya risiko gabungan.
7. Panel AI berisi pendapat independen. Jika panel terbelah, jelaskan perbedaannya dan tetap ikuti arah mesin; jangan membuat arah kedua.
8. Jelaskan mengapa data valid/akurat: sumber resmi vs agregator, tanggal observasi, kesegaran, dan triangulasi. Pisahkan fakta dari inferensi.
9. Untuk prediksi 2-3 menit sebelum rilis, tulis prakiraan bersyarat dan confidence; jangan menyebutnya hasil aktual.
10. Ringkasan video resmi (Gemini) hanya konteks argumen dan memang dilarang memuat angka; jangan menambahkan angka dari sana. Jika videoResmi ada, WAJIB ringkas poinnya di youtube_read dan sebut ini bacaan video, bukan transkrip.
Balas HANYA JSON valid dengan bentuk:
{"headline":"...","summary":"...","focus_what":"apa yang diukur dan mengapa penting untuk emas","why_gold":"rantai sebab-akibat: data -> USD/yield riil -> emas","why_valid":"mengapa data ini valid dan di mana keterbatasannya","prediction_2_3m":"prakiraan pra-rilis + skenario aktual di atas/di bawah konsensus","confidence":0-100,"fact_vs_inference":"mana fakta, mana tafsiran","youtube_read":"apa yang bisa dan tidak bisa disimpulkan dari YouTube","data_chain":[{"source":"...","fact":"...","weight":"utama/pendukung/konteks"}],"bull_case":"...","bear_case":"...","comparison":[{"metric":"...","latest":"...","previous":"...","change":"...","source":"..."}],"concurrent":[{"title":"...","when":"...","impact":"...","gold_effect":"..."}],"scenarios":[{"name":"...","if":"...","then":"..."}],"risks":["..."],"validity":["..."],"sources":["..."]}`;
  const data = {
    fokus: { tag: pack.event.tag, judul: pack.event.title, jadwal: pack.event.when, dampak: pack.event.impact, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, sumberResmi: pack.event.actualSource, periodeResmi: pack.event.officialPeriod, sudahTerbit: pack.event.released },
    arahMesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, kejutan: pack.surprise, reaksi: pack.reaction, spike: pack.spike, bukti: pack.evidence.slice(0, 8) },
    timing: pack.timing,
    panelAI: pack.aiPanel ? { votes: pack.aiPanel.votes, consensus: pack.aiPanel.consensus, agreement: pack.aiPanel.agreement, avgConfidence: pack.aiPanel.avgConfidence, providers: pack.aiPanel.distinctProviders, pendapat: pack.aiPanel.items.map(x => ({ arah: x.direction, confidence: x.confidence, alasan: x.reasons, valid: x.why_valid })) } : null,
    resmi: { ...pack.official, dipakaiSebagaiAktual: pack.event.actualOfficial != null, catatan: pack.event.actualOfficial != null ? 'angka resmi cocok dengan periode rilis' : 'angka FRED terbaru hanya konteks historis; JANGAN disebut sebagai aktual rilis ini' },
    makroFRED: pack.macroBoard ? pack.macroBoard.items : [],
    harga: { xau: pack.price, sumber: pack.priceSource, spot: pack.spot, tradingview: pack.tv && pack.tv.price ? { harga: pack.tv.price, bias: pack.tv.label, rekomendasi: pack.tv.tf } : 'tidak tersedia' },
    rilisBersamaan: pack.concurrent.slice(0, 8),
    konteksPasar: pack.marketContext,
    beritaResmi: (pack.officialNews && pack.officialNews.items || []).slice(0, 6).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    beritaMediaAS: pack.us.items.slice(0, 8).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    youtube: pack.yt.items.slice(0, 8).map(x => ({ judul: x.title, kanal: x.channel, resmi: x.trusted || '', umurJam: x.ageH, stance: x.stance })),
    transkripYouTube: ((pack.yt.transcripts && pack.yt.transcripts.items) || []).map(t => ({ judul: t.title, kanal: t.channel, durasi: t.durationLabel, auto: t.auto, chars: t.chars, teks: t.text })),
    videoResmi: pack.yt.videoRead || null,
    youtubeRingkas: { total: pack.yt.items.length, tally: pack.yt.tally || null, transkrip: pack.yt.transcripts ? pack.yt.transcripts.note : 'tidak tersedia' },
    sumber: pack.sources
  };
  const out = await C.ai(sys, 'Susun dokumen news sekarang dari data ini:\n' + JSON.stringify(data).slice(0, 24000), { field: 'xau', temp: 0.15, maxTok: 6500, deadlineMs: (opts && opts.deadlineMs) || 40000 });
  const j = C.parseJson(out.text);
  if (!j) throw new Error('Balasan AI bukan JSON valid');
  return { doc: sanitizeDoc(j), provider: out.provider, model: out.model };
}

/* Audit AI kedua: memeriksa apakah dokumen memakai angka yang benar-benar ada
   di data. Hasilnya tidak mengubah arah; hanya menandai ketidakcocokan. */
async function aiAudit(pack, opts) {
  const sys = `Kamu auditor data makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
Periksa dokumen ringkasan di bawah terhadap DATA. Tugasmu HANYA memeriksa kesesuaian angka dan sumber, bukan mengubah arah.
Aturan: setiap angka di dokumen harus ada di data (konsensus, aktual kalender, angka resmi FRED, papan makro, reaksi, spike, harga). Tandai angka yang tidak ada atau berbeda.
JANGAN mengaudit harga pasar XAU, level entry, TP, angka turunan harga, atau skor confidence/keyakinan — semuanya penilaian mesin/AI. Fokus HANYA pada angka rilis: konsensus, aktual kalender, angka resmi FRED/BLS, dan papan makro. Jangan menandai perbedaan pembulatan.
Balas HANYA JSON: {"consistent":true|false,"issues":["masalah konkret maks 160 karakter"],"confidence":0-100}`;
  const data = {
    fokus: { tag: pack.event.tag, judul: pack.event.title, jadwal: pack.event.when, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, periodeResmi: pack.event.officialPeriod },
    resmiFRED: { ...pack.official, dipakaiSebagaiAktual: pack.event.actualOfficial != null }, reaksi: pack.reaction, spike: pack.spike, arahMesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, bukti: pack.evidence },
    harga: { xau: pack.price, sumber: pack.priceSource },
    panel: pack.aiPanel ? { votes: pack.aiPanel.votes, agreement: pack.aiPanel.agreement, avgConfidence: pack.aiPanel.avgConfidence } : null,
    dokumen: { headline: pack.doc.headline, summary: pack.doc.summary, why_gold: pack.doc.why_gold, why_valid: pack.doc.why_valid, prediction_2_3m: pack.doc.prediction_2_3m, data_chain: pack.doc.data_chain, comparison: pack.doc.comparison, scenarios: pack.doc.scenarios }
  };
  const out = await C.ai(sys, 'Audit dokumen ini:\n' + JSON.stringify(data).slice(0, 14000), { field: 'xau-audit', temp: 0, maxTok: 900, deadlineMs: (opts && opts.deadlineMs) || 20000 });
  const j = C.parseJson(out.text);
  if (!j) throw new Error('Audit AI bukan JSON');
  return {
    consistent: j.consistent === true,
    issues: (Array.isArray(j.issues) ? j.issues : []).slice(0, 5).map(x => C.cut(x, 180)),
    confidence: isFinite(Number(j.confidence)) ? Math.max(0, Math.min(100, Number(j.confidence))) : null,
    provider: out.provider, model: out.model
  };
}

/* Cadangan saat caption YouTube diblokir dari IP server: minta Gemini membaca
   video resmi. Output dilarang memuat angka; hanya ringkasan argumen. */
async function videoFallback(pack) {
  if (pack.yt && pack.yt.transcripts && pack.yt.transcripts.ok) return null;
  const exact = /^(bloomberg television|bloomberg news|reuters|cnbc|cnbc television)$/i;
  const rel = /gold|xau|bullion|emas|precious|\bnfp\b|payroll|inflation|\bcpi\b|\bppi\b|\bfomc\b|\bfed\b|dollar|yield|\brate\b|market/i;
  const gold = /gold|xau|bullion|emas|precious/i;
  const pick = (pack.yt.items || []).filter(x => exact.test(String(x.channel || '')) && rel.test(String(x.title || '')) && x.lengthSec >= 30 && x.lengthSec <= 1200 && (x.ageH == null || x.ageH <= 96))
    .sort((a, b) => (gold.test(String(b.title)) ? 1 : 0) - (gold.test(String(a.title)) ? 1 : 0) || (a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH))[0];
  if (!pick) return { ok: false, error: 'Tidak ada video resmi <=20 menit dalam 96 jam terakhir.' };
  const r = await C.videoRead(pick.id, pick.title);
  if (!r.ok) return r;
  const j = C.parseJson(r.text) || {};
  return {
    ok: true, title: pick.title, channel: pick.channel, url: pick.url, durationLabel: pick.lengthLabel, durationSec: pick.lengthSec,
    model: r.model, topik: C.cut(j.topik || '', 180),
    poin: (Array.isArray(j.poin) ? j.poin : []).slice(0, 8).map(x => C.cut(x, 260)).filter(Boolean),
    kecenderungan: /bullish|bearish|netral/i.test(String(j.kecenderungan || '')) ? String(j.kecenderungan).toLowerCase() : 'netral',
    catatan: C.cut(j.catatan || '', 400),
    note: 'Ringkasan isi video oleh Gemini, tanpa angka. Bukan transkrip verbatim; caption YouTube tidak dapat diakses dari server.'
  };
}

async function newsHandler(req, res) {
  const b = (req && req.body) || {};
  const focus = TAGS.includes(String(b.focus || '').toUpperCase()) ? String(b.focus).toUpperCase() : 'NFP';
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = 'news:' + focus;
    const t0 = Date.now();
    let pack = !b.fresh ? cache.get(key) : null;
    if (pack && Date.now() - pack.t < 30000) return res.status(200).json({ ...pack.v, cached: true });
    const v = await build(focus);
    const checks = [
        { k: 'Jadwal rilis terbaca', ok: !!v.event && (!!v.event.when || !!v.event.derived) },
        { k: 'Konsensus tersedia', ok: !!v.event && !!v.event.forecast },
        { k: 'Angka resmi FRED/BLS', ok: !!(v.official && v.official.ok) },
        { k: 'Papan makro global', ok: !!(v.macroBoard && v.macroBoard.ok) },
        { k: 'Harga & candle live', ok: !!(v.tv && v.tv.price) && !!v.marketContext },
        { k: 'Media global terpercaya', ok: !!(v.us && v.us.ok) },
        { k: 'YouTube metadata', ok: !!(v.yt && v.yt.ok) }
    ];
    v.dataQuality = {
      score: Math.round(checks.filter(x => x.ok).length / checks.length * 100),
      ok: checks.filter(x => x.ok).length, total: checks.length, checks,
      note: 'Skor = pemeriksaan data yang lolos / total pemeriksaan. Angka resmi tetap dipisahkan dari judul berita.'
    };
    /* Panel dan pembacaan video resmi berjalan paralel; dokumen memakai keduanya. */
    const [panel, video] = await Promise.all([
      aiPanel(v).catch(e => ({ ok: false, items: [], error: C.cut(e && e.message || e, 160) })),
      videoFallback(v).catch(e => ({ ok: false, error: C.cut(e && e.message || e, 140) }))
    ]);
    if (video && video.ok) v.yt.videoRead = video;
    v.aiPanel = panel;
    let ai = null, aiErr = '';
    const left = () => 57000 - (Date.now() - t0);
    try {
      if (left() < 14000) throw new Error('waktu server hampir habis untuk sintesis');
      const r = await aiDocument(v, { deadlineMs: Math.max(10000, Math.min(26000, left() - 7000)) });
      ai = r;
    } catch (e) { aiErr = C.cut(e && e.message || e, 220); }
    v.doc = ai ? ai.doc : null;
    v.ai = ai ? { ok: true, provider: ai.provider, model: ai.model } : { ok: false, error: aiErr };
    v.ai.panel = { ok: !!panel && panel.ok, total: panel ? panel.total : 0, consensus: panel ? panel.consensus : null, agreement: panel ? panel.agreement : 0 };
    if (v.doc && left() > 9000) {
      try {
        const audit = await aiAudit(v, { deadlineMs: Math.min(9000, left() - 2000) });
        v.ai.audit = audit;
        if (audit.issues.length) v.doc.validity = [...(v.doc.validity || []), ...audit.issues.map(x => 'Audit AI: ' + x)].slice(0, 10);
      } catch (e) { v.ai.audit = { ok: false, error: C.cut(e && e.message || e, 120) }; }
    }
    v.aiDirection = ai && ai.doc ? (v.doc ? v.direction : null) : null;
    if (ai && ai.doc && ai.doc.headline && v.doc && !v.doc.headline) v.doc.headline = v.name;
    const out = { ...v, notes: [] };
    cache.set(key, { t: Date.now(), v: out });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ ok: false, focus, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = { newsHandler, build, TAGS, NAME, analyse, eventOf, reactionOf, officialActual };
