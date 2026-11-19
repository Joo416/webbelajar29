/* =====================================================================
   RADAR 1H — arah XAUUSD 60 menit ke depan dari data yang bisa diaudit.
   Fokus: fundamental global yang relevan untuk XAUUSD (berita emas/dolar,
   DXY, yield nominal & riil, breakeven inflasi, kalender USD) + konfirmasi
   teknikal (TradingView multi-TF, candle live, SMC/AMD). Tidak memakai
   angka karangan: setiap faktor berasal dari feed publik dan menyertakan
   sumber serta waktu ambil. Sinyal ini adalah probabilitas/konteks, bukan
   jaminan arah atau jaminan bebas SL.
   ===================================================================== */
'use strict';
const C = require('./xau-core');
const L = require('./learn');
const K = require('./knowledge');
const S = require('./smc');
const W = require('./goldwire');

const PIP = 0.1;
const HORIZON_MIN = 60;
const REFRESH_MIN = 30;
const r2 = C.r2;
const iso = (t) => (t == null || !isFinite(t) ? null : new Date(t).toISOString());
const pips = (a, b) => (a == null || b == null ? null : Math.round(Math.abs(a - b) / PIP));

function biasSign(label) {
  const s = String(label || '').toUpperCase();
  if (/STRONG BUY/.test(s)) return 1;
  if (/BUY/.test(s)) return .6;
  if (/STRONG SELL/.test(s)) return -1;
  if (/SELL/.test(s)) return -.6;
  return 0;
}

function structureDir(st) {
  if (!st) return 0;
  return st.trend === 'BULLISH' ? 1 : st.trend === 'BEARISH' ? -1 : 0;
}

/* Risiko rilis untuk horizon 1 jam: rilis high-impact USD dari 10 menit
   lalu sampai 75 menit ke depan. Ini bukan arah; hanya pengurang keyakinan. */
function eventRisk(cal) {
  const now = Date.now();
  const high = (cal || []).filter(e => e.cur === 'USD' && /high/i.test(e.impact || '') && isFinite(e.ts))
    .map(e => ({ title: e.title, at: iso(e.ts), minutes: Math.round((e.ts - now) / 60000) }))
    .filter(e => e.minutes >= -10 && e.minutes <= 75)
    .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes));
  return {
    level: high.length ? (Math.abs(high[0].minutes) <= 25 ? 'TINGGI' : 'SEDANG') : 'RENDAH',
    items: high.slice(0, 3),
    note: high.length
      ? 'Ada rilis USD high-impact dalam horizon 1 jam; radar menurunkan keyakinan.'
      : 'Tidak ada rilis USD high-impact dalam 75 menit.'
  };
}

function boardItem(board, id) {
  return ((board && board.items) || []).find(x => x && x.id === id) || null;
}

async function build() {
  const [d, tv, sp, cal, wire, board] = await Promise.all([
    C.candles(),
    C.tvRead().catch(() => null),
    C.spot().catch(() => null),
    C.calendar().catch(() => []),
    W.build().catch(() => null),
    C.fredBoard().catch(() => null)
  ]);
  const rows5 = ((d.m5 && d.m5.rows) || []).filter(r => r && isFinite(r.c));
  const rows15 = ((d.m15 && d.m15.rows) || []).filter(r => r && isFinite(r.c));
  const rows60 = ((d.h1 && d.h1.rows) || []).filter(r => r && isFinite(r.c));
  if (!rows5.length && !rows15.length) throw new Error('Candle XAUUSD live tidak tersedia');
  const price = C.r2(tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : (rows5.length ? rows5[rows5.length - 1].c : rows15[rows15.length - 1].c));
  const atr5 = C.atr(rows5, 14), atr15 = C.atr(rows15, 14), atr60 = C.atr(rows60, 14);
  const m5 = rows5.length >= 30 ? C.structure(rows5) : null;
  const m15 = rows15.length >= 30 ? C.structure(rows15) : null;
  const h1 = rows60.length >= 30 ? C.structure(rows60) : null;
  const ema20 = rows60.length ? C.ema(rows60.map(r => r.c), 20) : null;
  const ema50 = rows60.length ? C.ema(rows60.map(r => r.c), 50) : null;
  const rsi60 = rows60.length ? C.rsi(rows60.map(r => r.c), 14) : null;
  const rsi15 = rows15.length ? C.rsi(rows15.map(r => r.c), 14) : null;
  /* Mesin SMC/AMD: struktur, sweep, premium/discount, fase, kill zone. */
  const smc = (() => {
    try {
      return S.build({
        m5: rows5, m15: rows15, h1: rows60, h4: d.h4 && d.h4.rows, d1: d.d1 && d.d1.rows,
        price, atr5, atr15, atr1: atr60, atr4: d.h4 ? C.atr(d.h4.rows, 14) : null, now: Date.now()
      });
    } catch (e) { return { ok: false, note: 'Mesin SMC gagal: ' + C.cut(e && e.message || e, 140) }; }
  })();
  const factors = [];
  const add = (name, score, why, source, at, group) => {
    const n = Number(score);
    if (!isFinite(n) || Math.abs(n) < .01) return;
    factors.push({ name, score: r2(n), why, source, at: at || null, group: group || 'teknikal' });
  };

  /* 1. Rekomendasi TradingView per TF. Untuk horizon 1 jam, H1/H4/D1
     diberi bobot paling besar; M5/M1 hanya timing. */
  if (tv && tv.ok && tv.tf) {
    const weights = { D: 1.25, '240': 1.35, '60': 1.45, '15': .85, '5': .4, '1': .2 };
    Object.keys(weights).forEach(k => {
      const x = tv.tf[k];
      if (!x || x.rec == null) return;
      add('TV ' + ({ D: '1D', '240': '4H', '60': '1H', '15': '15m', '5': '5m', '1': '1m' }[k]), x.rec * weights[k],
        'Rekomendasi TradingView ' + (x.recLabel || '—') + ' · RSI ' + (x.rsi == null ? '—' : x.rsi),
        'TradingView Scanner', iso(tv.at), 'teknikal');
    });
  }
  /* 2. Struktur candle live (bukan rekomendasi). */
  add('Struktur H1', structureDir(h1) * 1.6, h1 ? 'Struktur H1 ' + h1.trend : 'Struktur H1 tidak cukup', d.h1 && d.h1.source, rows60.length ? iso(rows60[rows60.length - 1].t) : null, 'teknikal');
  add('Struktur M15', structureDir(m15) * .9, m15 ? 'Struktur M15 ' + m15.trend : 'Struktur M15 tidak cukup', d.m15 && d.m15.source, rows15.length ? iso(rows15[rows15.length - 1].t) : null, 'teknikal');
  add('Struktur M5', structureDir(m5) * .45, m5 ? 'Struktur M5 ' + m5.trend : 'Struktur M5 tidak cukup', d.m5 && d.m5.source, rows5.length ? iso(rows5[rows5.length - 1].t) : null, 'teknikal');
  /* SMC/AMD: hanya faktor yang terukur candle; tidak ada tebakan. */
  if (smc && smc.ok) {
    const e15 = smc.flow && smc.flow.m15;
    const e60 = smc.flow && smc.flow.h1;
    if (e60 && e60.choch) add('SMC CHoCH H1', e60.choch.dir === 'BULLISH' ? 1.0 : -1.0, e60.choch.note, d.h1 && d.h1.source, e60.choch.at, 'teknikal');
    else if (e60 && e60.bos) add('SMC BOS H1', e60.bos.dir === 'BULLISH' ? .8 : -.8, e60.bos.note, d.h1 && d.h1.source, e60.bos.at, 'teknikal');
    else if (e15 && e15.choch) add('SMC CHoCH M15', e15.choch.dir === 'BULLISH' ? .7 : -.7, e15.choch.note, d.m15 && d.m15.source, e15.choch.at, 'teknikal');
    if (smc.liq && smc.liq.sweep) add('SMC sweep ' + smc.liq.sweep.pool, smc.liq.sweep.kind === 'low' ? 0.8 : -0.8, smc.liq.sweep.note, d.m15 && d.m15.source, smc.liq.sweep.at, 'teknikal');
    if (smc.pd) add('SMC premium/discount', C.clip((50 - smc.pd.pos) / 70, -0.6, 0.6), smc.pd.note, d.m15 && d.m15.source, rows15.length ? iso(rows15[rows15.length - 1].t) : null, 'teknikal');
    if (smc.amd && smc.amd.bias) add('AMD ' + smc.amd.phase, C.clip(smc.amd.bias * 0.6, -0.8, 0.8), smc.amd.note, d.m15 && d.m15.source, smc.amd.sweep ? smc.amd.sweep.at : null, 'teknikal');
    if (smc.displacement) add('Displacement ' + smc.displacement.dir, smc.displacement.dir === 'BULLISH' ? 0.5 : -0.5, smc.displacement.note, d.m5 && d.m5.source, smc.displacement.at, 'teknikal');
  }
  /* 3. Momentum 1 jam: perubahan 12 candle M5 dan 4 candle M15. */
  if (rows5.length >= 15) {
    const c = rows5.map(r => r.c);
    const last = c[c.length - 1], p12 = c[c.length - 13], p6 = c[c.length - 7];
    const mom60 = (last - p12) / PIP, mom30 = (last - p6) / PIP;
    add('Momentum 1 jam', C.clip(mom60 / 30, -1.4, 1.4), 'Perubahan 12 candle M5 (1 jam) ' + (mom60 > 0 ? '+' : '') + Math.round(mom60) + ' pip; 30 menit ' + (mom30 > 0 ? '+' : '') + Math.round(mom30) + ' pip.', d.m5 && d.m5.source, iso(rows5[rows5.length - 1].t), 'teknikal');
  }
  /* 4. EMA/RSI H1 sebagai filter arah 1 jam. */
  if (ema20 != null && ema50 != null) add('EMA20/50 H1', ema20 > ema50 ? .65 : -.65, 'EMA20 ' + r2(ema20) + ' vs EMA50 ' + r2(ema50) + ' pada H1.', 'Candle H1', rows60.length ? iso(rows60[rows60.length - 1].t) : null, 'teknikal');
  if (rsi60 != null) add('RSI H1', rsi60 >= 70 ? -.4 : rsi60 <= 30 ? .4 : (rsi60 - 50) / 100, 'RSI14 H1 ' + r2(rsi60) + ' (ekstrem = risiko pullback).', 'Candle H1', rows60.length ? iso(rows60[rows60.length - 1].t) : null, 'teknikal');
  if (rsi15 != null) add('RSI M15', (rsi15 >= 70 ? -.25 : rsi15 <= 30 ? .25 : (rsi15 - 50) / 140), 'RSI14 M15 ' + r2(rsi15) + ' — konfirmasi timing.', 'Candle M15', rows15.length ? iso(rows15[rows15.length - 1].t) : null, 'teknikal');
  /* 5. DXY/yield 1 jam: korelasi makro untuk horizon 60 menit. */
  const macro = d.dxyTv && d.dxyTv.rows ? d.dxyTv.rows : null;
  const tnx = d.us10Tv && d.us10Tv.rows ? d.us10Tv.rows : null;
  const chg = (rows, n) => rows && rows.length > n ? (rows[rows.length - 1].c / rows[rows.length - 1 - n].c - 1) * 100 : null;
  const dxy60 = chg(macro, 4), y60 = tnx && tnx.length > 4 ? r2(tnx[tnx.length - 1].c - tnx[tnx.length - 5].c) : null;
  if (dxy60 != null) add('DXY 1 jam', C.clip(-dxy60 * .9, -1.3, 1.3), 'DXY berubah ' + (dxy60 > 0 ? '+' : '') + dxy60 + '% dalam 1 jam; dolar naik biasanya menekan emas.', 'TradingView TVC:DXY', iso(macro[macro.length - 1].t), 'fundamental');
  if (y60 != null) add('Yield 10Y 1 jam', C.clip(-y60 * 2.0, -1.0, 1.0), 'Yield 10Y berubah ' + (y60 > 0 ? '+' : '') + y60 + ' pp dalam 1 jam.', 'TradingView TVC:US10Y', iso(tnx[tnx.length - 1].t), 'fundamental');
  /* 6. Fundamental resmi FRED: yield riil, dolar broad, breakeven inflasi.
     Perubahan 5 observasi harian; arahnya untuk konteks 1 jam, bukan entry. */
  const real = boardItem(board, 'DFII10'), broad = boardItem(board, 'DTWEXBGS'), be = boardItem(board, 'T10YIE');
  if (real && real.chg5 != null) add('Yield riil 10Y (FRED)', C.clip(-real.chg5 * 6, -1.2, 1.2), 'Yield riil 10Y ' + (real.chg5 > 0 ? '+' : '') + real.chg5 + ' pp (5 observasi, ' + real.date + '); yield riil naik = tekanan turun emas.', real.source, real.date, 'fundamental');
  if (broad && broad.chg5 != null) add('Dollar broad (FRED)', C.clip(-broad.chg5 * 1.2, -1.1, 1.1), 'Dollar broad index ' + (broad.chg5 > 0 ? '+' : '') + broad.chg5 + ' poin (5 observasi, ' + broad.date + '); dolar menguat = tekanan turun emas.', broad.source, broad.date, 'fundamental');
  if (be && be.chg5 != null) add('Breakeven inflasi 10Y', C.clip(be.chg5 * 2.2, -0.8, 0.8), 'Breakeven inflasi 10Y ' + (be.chg5 > 0 ? '+' : '') + be.chg5 + ' pp (5 observasi, ' + be.date + '); ekspektasi inflasi naik = dukungan emas.', be.source, be.date, 'fundamental');
  /* 7. Wire emas & pair USD: nada judul dari banyak situs. Ini faktor
     fundamental tambahan, bukan pengubah harga. */
  const tone = wire && wire.ok ? wire.tone : null;
  if (tone) {
    add('Wire fundamental XAUUSD', C.clip(tone.score / 22, -1.3, 1.3),
      tone.note + (wire.coverage ? ' · ' + wire.coverage.items + ' judul dari ' + wire.coverage.distinctSources + ' sumber (' + wire.coverage.fresh24h + ' dalam 24 jam).' : ''),
      'Wire emas & USD (FXStreet, ForexLive, Investing, Yahoo, CNBC, Mining.com, Google News)',
      wire.at, 'fundamental');
  }
  /* 8. Risiko rilis: bukan arah, tetapi mengurangi keyakinan. */
  const risk = eventRisk(cal);
  const rawScore = factors.reduce((s, f) => s + f.score, 0);
  const totalW = factors.reduce((s, f) => s + Math.abs(f.score), 0) || 1;
  const agreement = Math.round(Math.abs(rawScore) / totalW * 100);
  const riskPenalty = risk.level === 'TINGGI' ? 18 : risk.level === 'SEDANG' ? 8 : 0;
  const direction = Math.abs(rawScore) < .35 ? 'WAIT' : rawScore > 0 ? 'BUY' : 'SELL';
  const smcConflict = !!(smc && smc.ok && direction !== 'WAIT' && smc.htf && smc.htf.score * (direction === 'BUY' ? 1 : -1) < -0.15);
  const smcPdConflict = !!(smc && smc.ok && direction !== 'WAIT' && smc.pd && ((direction === 'SELL' && smc.pd.pos < 50) || (direction === 'BUY' && smc.pd.pos > 50)));
  const killBonus = smc && smc.ok ? (smc.killzone.active ? 4 : -4) : 0;
  const confidence = Math.max(20, Math.min(92, Math.round(42 + agreement * .42 + Math.min(14, Math.abs(rawScore) * 5) - riskPenalty + killBonus - (smcConflict ? 6 : 0) - (smcPdConflict ? 5 : 0))));
  const expected = Math.max(20, Math.round(((atr60 || (atr15 || 2.5) * 4) / PIP) * .85));
  const priceDiff = sp && sp.ok && tv && tv.ok ? pips(tv.price, sp.price) : null;
  const sortedFactors = factors.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const summary = {
    headline: (direction === 'WAIT' ? 'TUNGGU / NETRAL' : direction) + ' XAUUSD · horizon 60 menit · keyakinan ' + confidence + '%',
    fundamental: tone
      ? 'Wire emas/USD ' + tone.label + ' (skor ' + tone.score + ')' + (board && board.ok ? '; FRED: yield riil ' + (real ? real.value + '%' : '—') + ', dolar broad ' + (broad ? broad.value : '—') : '')
      : 'Wire emas/USD tidak tersedia; fundamental memakai FRED dan pasar.',
    technical: 'H1 ' + (h1 ? h1.trend : '—') + ' · M15 ' + (m15 ? m15.trend : '—') + ' · M5 ' + (m5 ? m5.trend : '—') + (smc && smc.ok ? ' · ' + (smc.killzone && smc.killzone.active ? smc.killzone.name : 'di luar kill zone') : ''),
    risk: risk.note,
    points: sortedFactors.slice(0, 4).map(f => f.name + ' ' + (f.score > 0 ? '+' : '') + f.score + ' — ' + f.why),
    conflicts: [smcConflict ? 'Arah radar melawan bias HTF SMC.' : '', smcPdConflict ? 'Arah radar melawan premium/discount 50%.' : ''].filter(Boolean)
  };
  const fundamental = {
    ok: !!(tone || board && board.ok || dxy60 != null || y60 != null),
    wire: tone ? {
      score: tone.score, label: tone.label, goldBias: tone.goldBias, note: tone.note,
      bull: tone.bull, bear: tone.bear, at: wire.at,
      coverage: wire.coverage || null,
      top: (wire.items || []).slice(0, 8).map(x => ({ title: x.title, source: x.source, topic: x.topic, lean: x.lean, ageH: x.ageH, at: x.at, url: x.url }))
    } : null,
    macro: (board && board.items || []).map(x => ({ id: x.id, label: x.label, value: x.value, unit: x.unit, chg: x.chg, chg5: x.chg5, date: x.date, source: x.source })),
    fx: { dxy1h: dxy60, yield10_1h: y60, gold1hPips: rows5.length >= 13 ? Math.round((rows5[rows5.length - 1].c - rows5[rows5.length - 13].c) / PIP) : null },
    calendar: risk,
    note: (tone ? tone.note : 'Wire emas/USD tidak tersedia.') + ' Fundamental dipakai sebagai konteks arah 1 jam; entry tetap dari mesin Signal.'
  };
  const sources = [
    { name: 'TradingView Scanner · ' + ((tv && tv.symbol) || C.TV_SYMBOL), url: 'https://www.tradingview.com/symbols/' + encodeURIComponent(((tv && tv.symbol) || C.TV_SYMBOL).replace(':', '-')), ok: !!(tv && tv.ok), at: tv && tv.at ? iso(tv.at) : null, role: 'Harga, rekomendasi multi-TF, RSI/EMA/ATR' },
    { name: 'Candle live TradingView/Yahoo · M5/M15/H1', url: 'https://www.tradingview.com/chart/?symbol=FOREXCOM%3AXAUUSD&interval=60', ok: !!(d.m5 || d.m15), at: rows5.length ? iso(rows5[rows5.length - 1].t) : null, role: 'Struktur, momentum 1 jam, EMA/RSI, ATR, SMC/AMD' },
    { name: 'gold-api.com · spot XAU', url: 'https://www.gold-api.com/', ok: !!(sp && sp.ok), at: sp && sp.at ? iso(sp.at) : null, role: 'Pembanding harga spot, bukan feed MT5' },
    { name: 'TradingView TVC:DXY', url: 'https://www.tradingview.com/symbols/TVC-DXY/', ok: !!(macro && macro.length), at: macro && macro.length ? iso(macro[macro.length - 1].t) : null, role: 'Tekanan dolar 1 jam' },
    { name: 'TradingView TVC:US10Y', url: 'https://www.tradingview.com/symbols/TVC-US10Y/', ok: !!(tnx && tnx.length), at: tnx && tnx.length ? iso(tnx[tnx.length - 1].t) : null, role: 'Yield nominal 1 jam' },
    { name: 'FRED · yield riil, dolar broad, breakeven', url: 'https://fred.stlouisfed.org/', ok: !!(board && board.ok), at: board && board.at ? iso(board.at) : null, role: 'Fundamental resmi AS (harian)' },
    { name: 'Wire emas & pair USD · FXStreet, ForexLive, Investing, Yahoo GC=F, CNBC, Mining.com, Google News', url: 'https://news.google.com/', ok: !!(wire && wire.ok), at: wire && wire.at ? iso(wire.at) : null, role: wire && wire.coverage ? wire.coverage.items + ' judul · ' + wire.coverage.distinctSources + ' sumber · ' + wire.coverage.fresh24h + ' dalam 24 jam' : 'Berita emas/dolar/USD' },
    { name: 'TradingView Economic Calendar', url: 'https://www.tradingview.com/economic-calendar/', ok: true, at: new Date().toISOString(), role: 'Risiko rilis USD high-impact dalam 75 menit' }
  ];
  return {
    schema: 2, ok: true, generatedAt: new Date().toISOString(), horizonMin: HORIZON_MIN, refreshMin: REFRESH_MIN,
    validUntil: new Date(Date.now() + REFRESH_MIN * 60000).toISOString(),
    symbol: (tv && tv.symbol) || C.TV_SYMBOL, price, priceSource: tv && tv.ok ? 'TradingView Scanner' : sp && sp.ok ? 'gold-api spot' : 'candle live',
    priceAt: tv && tv.at ? iso(tv.at) : sp && sp.at ? iso(sp.at) : rows5.length ? iso(rows5[rows5.length - 1].t) : null,
    spot: sp && sp.ok ? sp.price : null, priceDifferencePips: priceDiff,
    direction, confidence, score: r2(rawScore), agreement, expectedRangePips: expected,
    risk, factors: sortedFactors, summary, sources,
    fundamental,
    smc: S.summary(smc), smcConflict, smcPdConflict,
    structure: { h1: h1 ? { trend: h1.trend, lastHi: h1.lastHi, lastLo: h1.lastLo } : null, m15: m15 ? { trend: m15.trend, lastHi: m15.lastHi, lastLo: m15.lastLo } : null, m5: m5 ? { trend: m5.trend, lastHi: m5.lastHi, lastLo: m5.lastLo } : null },
    candles: rows5.slice(-100).map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c })),
    method: 'Radar 1 jam deterministik: fundamental global XAUUSD (wire emas/dolar, DXY & yield 1 jam, yield riil FRED, dolar broad, breakeven inflasi, kalender USD) + rekomendasi TradingView berbobot H1/H4/D1 + struktur candle H1/M15/M5 + mesin SMC/AMD (CHoCH/BOS, sweep BSL/SSL, premium/discount, fase AMD, displacement) + momentum 1 jam + EMA/RSI. Tidak memakai AI untuk mengarang harga; arah adalah probabilitas dari data saat ini.',
    brokerNote: 'HFM/Exness tidak menyediakan API publik real-time untuk retail. Radar memakai feed publik TradingView FOREXCOM:XAUUSD dan spot gold-api; selisih dengan MT5 broker bisa beberapa pip karena spread/quote feed. Gunakan harga MT5 sendiri untuk eksekusi.',
    limitation: 'Arah 1 jam adalah probabilitas dari data saat ini, bukan jaminan. Berita mendadak, spread melebar, dan slippage dapat membatalkan sinyal. Tidak ada sistem yang menjamin bebas SL.'
  };
}

let cache = null;
async function radarHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const b = (req && req.body) || {};
    const learn = b.learn && typeof b.learn === 'object' ? L.normalizeLearn(b.learn) : null;
    const hasLearn = !!(learn && (learn.radar.length || learn.news.length || learn.records.length || learn.sources.length));
    /* Cache global tidak boleh mencampur keyakinan hasil belajar akun lain. */
    if (!hasLearn && !b.fresh && cache && Date.now() - cache.t < 12000) return res.status(200).json({ ...cache.v, cached: true });
    const v = await build();
    if (hasLearn) {
      try {
        const rl = L.radarLearning(learn.radar, v.direction, v.agreement);
        v.baseConfidence = v.confidence;
        v.confidence = Math.max(20, Math.min(95, v.confidence + rl.delta));
        v.learning = rl;
      } catch (e) {
        v.learning = { n: 0, delta: 0, note: 'Pembelajaran radar tidak dapat dibaca: ' + C.cut(e && e.message || e, 120) };
      }
    }
    /* Bukti global: hanya keyakinan yang boleh bergeser, arah tetap. */
    try {
      const kb = await K.load();
      v.knowledge = K.view(kb, learn, 12, v.direction);
      if (v.knowledge.bias.delta) {
        v.baseConfidence = v.confidence;
        v.confidence = Math.max(20, Math.min(95, v.confidence + v.knowledge.bias.delta));
      }
      const sg = { name: 'Feed global terpercaya (resmi, emas, media, YouTube, akademi/komunitas emas)', url: 'https://news.google.com/', ok: v.knowledge.total > 0, at: v.knowledge.at, role: v.knowledge.total + ' judul · delta keyakinan ' + (v.knowledge.bias.delta >= 0 ? '+' : '') + v.knowledge.bias.delta };
      v.sources = [...(v.sources || []), sg];
      v.learning = { ...(v.learning || { n: 0, delta: 0 }), knowledge: v.knowledge.bias.note };
    } catch (e) {
      v.knowledge = { ok: false, total: 0, items: [], measured: 0, bias: { delta: 0, note: 'Pengetahuan global tidak dapat dibaca: ' + C.cut(e && e.message || e, 120) } };
    }
    if (!hasLearn) cache = { t: Date.now(), v };
    return res.status(200).json(v);
  } catch (e) {
    return res.status(200).json({ ok: false, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = { build, radarHandler, HORIZON_MIN, REFRESH_MIN };
