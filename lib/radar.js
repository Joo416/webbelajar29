/* =====================================================================
   RADAR 10M — arah XAUUSD 10 menit ke depan dari data yang bisa diaudit.
   Tidak memakai angka karangan: setiap faktor berasal dari TradingView,
   candle live, FRED, kalender, DXY/yield, atau spot emas. Sinyal ini adalah
   probabilitas/konteks, bukan jaminan arah atau jaminan bebas SL.
   ===================================================================== */
'use strict';
const C = require('./xau-core');
const L = require('./learn');
const K = require('./knowledge');
const S = require('./smc');

const PIP = 0.1;
const r2 = C.r2;
const iso = (t) => (t == null || !isFinite(t) ? null : new Date(t).toISOString());
const pct = (a, b) => (a == null || b == null || !b ? null : r2((a / b - 1) * 100));
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

function eventRisk(cal) {
  const now = Date.now();
  const high = (cal || []).filter(e => e.cur === 'USD' && /high/i.test(e.impact || '') && isFinite(e.ts))
    .map(e => ({ title: e.title, at: iso(e.ts), minutes: Math.round((e.ts - now) / 60000) }))
    .filter(e => e.minutes >= -10 && e.minutes <= 45)
    .sort((a, b) => Math.abs(a.minutes) - Math.abs(b.minutes));
  return { level: high.length ? (Math.abs(high[0].minutes) <= 20 ? 'TINGGI' : 'SEDANG') : 'RENDAH', items: high.slice(0, 3), note: high.length ? 'Ada rilis USD high-impact dalam 45 menit; radar menurunkan keyakinan.' : 'Tidak ada rilis USD high-impact dalam 45 menit.' };
}

async function build() {
  const [d, tv, sp, cal] = await Promise.all([
    C.candles(),
    C.tvRead().catch(() => null),
    C.spot().catch(() => null),
    C.calendar().catch(() => [])
  ]);
  const rows5 = ((d.m5 && d.m5.rows) || []).filter(r => r && isFinite(r.c));
  const rows15 = ((d.m15 && d.m15.rows) || []).filter(r => r && isFinite(r.c));
  if (!rows5.length && !rows15.length) throw new Error('Candle XAUUSD live tidak tersedia');
  const price = C.r2(tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : (rows5.length ? rows5[rows5.length - 1].c : rows15[rows15.length - 1].c));
  const atr5 = C.atr(rows5, 14), atr15 = C.atr(rows15, 14);
  const m5 = rows5.length >= 30 ? C.structure(rows5) : null;
  const m15 = rows15.length >= 30 ? C.structure(rows15) : null;
  const ema20 = rows5.length ? C.ema(rows5.map(r => r.c), 20) : null;
  const ema50 = rows5.length ? C.ema(rows5.map(r => r.c), 50) : null;
  const rsi5 = rows5.length ? C.rsi(rows5.map(r => r.c), 14) : null;
  /* Mesin SMC/AMD: struktur, sweep, premium/discount, fase, kill zone. */
  const smc = (() => {
    try {
      return S.build({
        m5: rows5, m15: rows15, h1: d.h1 && d.h1.rows, h4: d.h4 && d.h4.rows, d1: d.d1 && d.d1.rows,
        price, atr5, atr15, atr1: d.h1 ? C.atr(d.h1.rows, 14) : null, atr4: d.h4 ? C.atr(d.h4.rows, 14) : null, now: Date.now()
      });
    } catch (e) { return { ok: false, note: 'Mesin SMC gagal: ' + C.cut(e && e.message || e, 140) }; }
  })();
  const factors = [];
  const add = (name, score, why, source, at) => {
    const n = Number(score);
    if (!isFinite(n) || Math.abs(n) < .01) return;
    factors.push({ name, score: r2(n), why, source, at: at || null });
  };

  /* 1. Rekomendasi TradingView per TF, dengan bobot inti 1M/5M/15M/1H/4H/1D. */
  if (tv && tv.ok && tv.tf) {
    const weights = { D: 1.25, '240': 1.15, '60': 1.0, '15': .95, '5': .85, '1': .55 };
    Object.keys(weights).forEach(k => {
      const x = tv.tf[k];
      if (!x || x.rec == null) return;
      add('TV ' + ({ D: '1D', '240': '4H', '60': '1H', '15': '15m', '5': '5m', '1': '1m' }[k]), x.rec * weights[k], 'Rekomendasi TradingView ' + (x.recLabel || '—') + ' · RSI ' + (x.rsi == null ? '—' : x.rsi), 'TradingView Scanner', iso(tv.at));
    });
  }
  /* 2. Struktur candle live (bukan rekomendasi). */
  add('Struktur M5', structureDir(m5) * 1.4, m5 ? 'Struktur M5 ' + m5.trend : 'Struktur M5 tidak cukup', d.m5 && d.m5.source, rows5.length ? iso(rows5[rows5.length - 1].t) : null);
  add('Struktur M15', structureDir(m15) * 1.0, m15 ? 'Struktur M15 ' + m15.trend : 'Struktur M15 tidak cukup', d.m15 && d.m15.source, rows15.length ? iso(rows15[rows15.length - 1].t) : null);
  /* SMC/AMD: hanya faktor yang terukur candle; tidak ada tebakan. */
  if (smc && smc.ok) {
    const e5 = smc.flow && smc.flow.m5;
    if (e5 && e5.choch) add('SMC CHoCH M5', e5.choch.dir === 'BULLISH' ? 0.9 : -0.9, e5.choch.note, d.m5 && d.m5.source, e5.choch.at);
    else if (e5 && e5.bos) add('SMC BOS M5', e5.bos.dir === 'BULLISH' ? 0.6 : -0.6, e5.bos.note, d.m5 && d.m5.source, e5.bos.at);
    if (smc.liq && smc.liq.sweep) add('SMC sweep ' + smc.liq.sweep.pool, smc.liq.sweep.kind === 'low' ? 0.8 : -0.8, smc.liq.sweep.note, d.m15 && d.m15.source, smc.liq.sweep.at);
    if (smc.pd) add('SMC premium/discount', C.clip((50 - smc.pd.pos) / 70, -0.6, 0.6), smc.pd.note, d.m15 && d.m15.source, rows15.length ? iso(rows15[rows15.length - 1].t) : null);
    if (smc.amd && smc.amd.bias) add('AMD ' + smc.amd.phase, C.clip(smc.amd.bias * 0.6, -0.8, 0.8), smc.amd.note, d.m15 && d.m15.source, smc.amd.sweep ? smc.amd.sweep.at : null);
    if (smc.displacement) add('Displacement ' + smc.displacement.dir, smc.displacement.dir === 'BULLISH' ? 0.5 : -0.5, smc.displacement.note, d.m5 && d.m5.source, smc.displacement.at);
  }
  /* 3. Momentum 10 menit: dua candle M5 terakhir vs 20 candle sebelumnya. */
  if (rows5.length >= 6) {
    const c = rows5.map(r => r.c);
    const last = c[c.length - 1], p2 = c[c.length - 3], p6 = c[c.length - 6];
    const mom2 = (last - p2) / PIP, mom6 = (last - p6) / PIP;
    add('Momentum 10m', C.clip(mom2 / 12, -1.3, 1.3), 'Perubahan 2 candle M5 ' + (mom2 > 0 ? '+' : '') + Math.round(mom2) + ' pip; 6 candle ' + (mom6 > 0 ? '+' : '') + Math.round(mom6) + ' pip.', d.m5 && d.m5.source, iso(rows5[rows5.length - 1].t));
  }
  /* 4. EMA/RSI M5 sebagai filter arah jangka pendek. */
  if (ema20 != null && ema50 != null) add('EMA20/50 M5', ema20 > ema50 ? .55 : -.55, 'EMA20 ' + r2(ema20) + ' vs EMA50 ' + r2(ema50) + ' pada M5.', 'Candle M5', rows5.length ? iso(rows5[rows5.length - 1].t) : null);
  if (rsi5 != null) add('RSI M5', rsi5 >= 70 ? -.35 : rsi5 <= 30 ? .35 : (rsi5 - 50) / 100, 'RSI14 M5 ' + r2(rsi5) + ' (ekstrem = risiko pullback).', 'Candle M5', rows5.length ? iso(rows5[rows5.length - 1].t) : null);
  /* 5. DXY/yield 15m: korelasi makro jangka pendek. */
  const macro = d.dxyTv && d.dxyTv.rows ? d.dxyTv.rows : null;
  const tnx = d.us10Tv && d.us10Tv.rows ? d.us10Tv.rows : null;
  const chg15 = (rows) => rows && rows.length > 6 ? (rows[rows.length - 1].c / rows[rows.length - 6].c - 1) * 100 : null;
  const dxy15 = chg15(macro), y15 = tnx && tnx.length > 6 ? r2(tnx[tnx.length - 1].c - tnx[tnx.length - 6].c) : null;
  if (dxy15 != null) add('DXY 15m', C.clip(-dxy15 * .45, -1.2, 1.2), 'DXY berubah ' + (dxy15 > 0 ? '+' : '') + dxy15 + '% dalam 15m; dolar naik biasanya menekan emas.', 'TradingView TVC:DXY', iso(macro[macro.length - 1].t));
  if (y15 != null) add('Yield 10Y 15m', C.clip(-y15 * 1.6, -.9, .9), 'Yield 10Y berubah ' + (y15 > 0 ? '+' : '') + y15 + ' pp dalam 15m.', 'TradingView TVC:US10Y', iso(tnx[tnx.length - 1].t));
  /* 6. Risiko rilis: bukan arah, tetapi mengurangi keyakinan. */
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
  const expected = Math.max(8, Math.round((atr5 || atr15 || 2.5) / PIP * .8));
  const priceDiff = sp && sp.ok && tv && tv.ok ? pips(tv.price, sp.price) : null;
  const sources = [
    { name: 'TradingView Scanner · ' + ((tv && tv.symbol) || C.TV_SYMBOL), url: 'https://www.tradingview.com/symbols/' + encodeURIComponent(((tv && tv.symbol) || C.TV_SYMBOL).replace(':', '-')), ok: !!(tv && tv.ok), at: tv && tv.at ? iso(tv.at) : null, role: 'Harga, rekomendasi multi-TF, RSI/EMA/ATR' },
    { name: 'Candle live TradingView/Yahoo · M5/M15', url: 'https://www.tradingview.com/chart/?symbol=FOREXCOM%3AXAUUSD&interval=5', ok: !!(d.m5 || d.m15), at: rows5.length ? iso(rows5[rows5.length - 1].t) : null, role: 'Struktur, momentum, EMA, RSI, ATR, SMC/AMD' },
    { name: 'gold-api.com · spot XAU', url: 'https://www.gold-api.com/', ok: !!(sp && sp.ok), at: sp && sp.at ? iso(sp.at) : null, role: 'Pembanding harga spot, bukan feed MT5' },
    { name: 'TradingView TVC:DXY', url: 'https://www.tradingview.com/symbols/TVC-DXY/', ok: !!(macro && macro.length), at: macro && macro.length ? iso(macro[macro.length - 1].t) : null, role: 'Tekanan dolar 15 menit' },
    { name: 'TradingView TVC:US10Y', url: 'https://www.tradingview.com/symbols/TVC-US10Y/', ok: !!(tnx && tnx.length), at: tnx && tnx.length ? iso(tnx[tnx.length - 1].t) : null, role: 'Yield riil/nominal 15 menit' },
    { name: 'TradingView Economic Calendar', url: 'https://www.tradingview.com/economic-calendar/', ok: true, at: new Date().toISOString(), role: 'Risiko rilis USD high-impact' }
  ];
  return {
    ok: true, generatedAt: new Date().toISOString(), horizonMin: 10, validUntil: new Date(Date.now() + 10 * 60000).toISOString(),
    symbol: (tv && tv.symbol) || C.TV_SYMBOL, price, priceSource: tv && tv.ok ? 'TradingView Scanner' : sp && sp.ok ? 'gold-api spot' : 'candle live',
    priceAt: tv && tv.at ? iso(tv.at) : sp && sp.at ? iso(sp.at) : rows5.length ? iso(rows5[rows5.length - 1].t) : null,
    spot: sp && sp.ok ? sp.price : null, priceDifferencePips: priceDiff,
    direction, confidence, score: r2(rawScore), agreement, expectedRangePips: expected,
    risk, factors: factors.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)), sources,
    smc: S.summary(smc), smcConflict, smcPdConflict,
    structure: { m5: m5 ? { trend: m5.trend, lastHi: m5.lastHi, lastLo: m5.lastLo } : null, m15: m15 ? { trend: m15.trend, lastHi: m15.lastHi, lastLo: m15.lastLo } : null },
    candles: rows5.slice(-90).map(r => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c })),
    method: 'Radar deterministik: rekomendasi TradingView berbobot + struktur candle M5/M15 + mesin SMC/AMD (CHoCH/BOS, sweep BSL/SSL, premium/discount, fase AMD, displacement) + momentum 10 menit + EMA/RSI + DXY/yield 15m, dikurangi penalti risiko rilis dan bonus kill zone. Tidak memakai AI untuk mengarang harga.',
    brokerNote: 'HFM/Exness tidak menyediakan API publik real-time untuk retail. Radar memakai feed publik TradingView FOREXCOM:XAUUSD dan spot gold-api; selisih dengan MT5 broker bisa beberapa pip karena spread/quote feed. Gunakan harga MT5 sendiri untuk eksekusi.',
    limitation: 'Arah 10 menit adalah probabilitas dari data saat ini, bukan jaminan. Berita mendadak, spread melebar, dan slippage dapat membatalkan sinyal. Tidak ada sistem yang menjamin bebas SL.'
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
    if (!hasLearn && cache && Date.now() - cache.t < 12000) return res.status(200).json({ ...cache.v, cached: true });
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

module.exports = { build, radarHandler };