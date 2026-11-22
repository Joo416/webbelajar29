/* =====================================================================
   SIGNAL ENTRY — ditulis ulang dari nol.
   Teknikal Alchemist lengkap dihitung dari candle live, harga & rekomendasi
   TradingView real-time, lalu AI memberi catatan pada setiap tanda chart
   (BOS, CHoCH, sweep, FVG, OB, SNR, SND, OTE). Level tidak boleh diubah AI:
   SL tepat 30 pip, TP per mode dari likuiditas nyata (Scalp/Day/Swing).
   ===================================================================== */
'use strict';
const C = require('./xau-core');
const L = require('./learn');
const K = require('./knowledge');
const S = require('./smc');

const PIP = 0.1;
const SL_PIPS = 30;
const TP2_PIPS = 200;
const TPMAX_MAX = 600;
/* Jarak minimum entry dari harga live supaya setup masih bisa dieksekusi,
   bukan entry MARKET yang menempel di candle berjalan. */
const MIN_ENTRY_PIPS = 30;

const freshLevel = (rows, atrV) => (atrV ? C.r2(atrV * 0.25) : 1);
const isoAt = (t) => (t == null ? null : new Date(t).toISOString());

function tfMatrix(tv) {
  if (!tv || !tv.ok) return [];
  const order = [['D', '1D'], ['240', '4H'], ['60', '1H'], ['15', '15m'], ['5', '5m'], ['1', '1m']];
  return order.map(([k, label]) => {
    const x = tv.tf && tv.tf[k];
    if (!x) return null;
    return { tf: label, rec: x.recLabel || 'netral', value: x.rec, strength: x.rec == null ? 0 : Math.round(Math.min(100, Math.abs(x.rec) * 100)), rsi: x.rsi, ema20: x.ema20, ema50: x.ema50 };
  }).filter(Boolean);
}

function equalLevels(rows, atrV) {
  const sw = C.swing(rows, 2), tol = Math.max(0.6, (atrV || 3) * 0.15);
  const pick = (arr) => {
    const a = arr.slice(-8), out = [];
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      if (Math.abs(a[i].p - a[j].p) <= tol) out.push({ price: C.r2((a[i].p + a[j].p) / 2), first: a[i].t, last: a[j].t, at: isoAt(a[j].t) });
    }
    const seen = new Set();
    return out.filter(x => { const k = x.price.toFixed(1); if (seen.has(k)) return false; seen.add(k); return true; }).slice(-3);
  };
  return { highs: pick(sw.hi), lows: pick(sw.lo) };
}

/* Range sesi Asia hari terakhir + open harian/mingguan + Judas swing. */
function sessionLevels(rows) {
  const day = new Date(rows[rows.length - 1].t).toISOString().slice(0, 10);
  const sameDay = (r) => new Date(r.t).toISOString().slice(0, 10) === day;
  const dayRows = rows.filter(sameDay);
  const asia = dayRows.filter(r => new Date(r.t).getUTCHours() < 7);
  const open = dayRows[0] ? dayRows[0].o : null;
  const lt = new Date(rows[rows.length - 1].t);
  const dow = lt.getUTCDay(), monday = new Date(Date.UTC(lt.getUTCFullYear(), lt.getUTCMonth(), lt.getUTCDate() - ((dow + 6) % 7))).getTime();
  const weekOpen = rows.filter(r => r.t >= monday)[0];
  const hi = asia.length ? Math.max(...asia.map(r => r.h)) : null;
  const lo = asia.length ? Math.min(...asia.map(r => r.l)) : null;
  const hiRow = asia.find(r => r.h === hi), loRow = asia.find(r => r.l === lo);
  return {
    asia: asia.length >= 6 ? { hi: C.r2(hi), lo: C.r2(lo), bars: asia.length, hiAt: hiRow ? isoAt(hiRow.t) : null, loAt: loRow ? isoAt(loRow.t) : null } : null,
    dayOpen: open == null ? null : C.r2(open), dayOpenAt: dayRows[0] ? isoAt(dayRows[0].t) : null,
    weekOpen: weekOpen ? C.r2(weekOpen.o) : null, weekOpenAt: weekOpen ? isoAt(weekOpen.t) : null,
    judas: (() => {
      if (!asia.length || asia.length < 6) return null;
      const after = rows.filter(r => r.t > asia[asia.length - 1].t);
      if (!after.length) return null;
      const c = rows[rows.length - 1].c;
      const maxH = Math.max(...after.map(r => r.h)), minL = Math.min(...after.map(r => r.l));
      const hiSweep = after.find(r => r.h === maxH), loSweep = after.find(r => r.l === minL);
      if (maxH > hi && c < hi) return { side: 'high', level: C.r2(hi), at: hiSweep ? isoAt(hiSweep.t) : isoAt(after[after.length - 1].t), why: 'Judas swing: high Asia ' + C.r2(hi) + ' disapu lalu harga kembali di bawahnya.' };
      if (minL < lo && c > lo) return { side: 'low', level: C.r2(lo), at: loSweep ? isoAt(loSweep.t) : isoAt(after[after.length - 1].t), why: 'Judas swing: low Asia ' + C.r2(lo) + ' disapu lalu harga kembali di atasnya.' };
      return null;
    })()
  };
}

/* Mitigation block: candle berlawanan terakhir sebelum candle impuls. */
function mitigationOf(rows, atrV) {
  const a = atrV || 1;
  for (let i = rows.length - 2; i > Math.max(0, rows.length - 24); i--) {
    const r = rows[i];
    if (Math.abs(r.c - r.o) <= a * 1.05) continue;
    const p = rows[i - 1];
    if (!p) return null;
    const bull = r.c > r.o;
    if (bull ? p.c >= p.o : p.c <= p.o) continue;
    return { dir: bull ? 'BULLISH' : 'BEARISH', lo: C.r2(Math.min(p.o, p.c)), hi: C.r2(Math.max(p.o, p.c)), at: isoAt(p.t), why: 'Mitigation block: candle ' + (bull ? 'turun' : 'naik') + ' terakhir sebelum impuls ' + (bull ? 'naik' : 'turun') + '.' };
  }
  return null;
}

/* Supply/Demand (SND) dari order block dan swing terakhir. */
function sndOf(rows, ob, atrV) {
  const out = [], a = atrV || 1;
  if (ob) out.push({ kind: ob.dir === 'BULLISH' ? 'demand' : 'supply', lo: C.r2(ob.lo), hi: C.r2(ob.hi), at: ob.at || isoAt(ob.t), why: 'Zona ' + (ob.dir === 'BULLISH' ? 'demand' : 'supply') + ' dari order block M15.' });
  const sw = C.swing(rows, 2);
  const h = sw.hi.slice(-1)[0], l = sw.lo.slice(-1)[0];
  if (h) out.push({ kind: 'supply', lo: C.r2(h.p - a * 0.1), hi: C.r2(h.p + a * 0.35), at: isoAt(h.t), why: 'Supply di swing high ' + C.r2(h.p) + '.' });
  if (l) out.push({ kind: 'demand', lo: C.r2(l.p - a * 0.35), hi: C.r2(l.p + a * 0.1), at: isoAt(l.t), why: 'Demand di swing low ' + C.r2(l.p) + '.' });
  return out;
}

function adrOf(dailyRows) {
  if (!dailyRows || dailyRows.length < 6) return null;
  const r = dailyRows.slice(-14);
  const avg = r.reduce((s, x) => s + (x.h - x.l), 0) / r.length;
  const today = dailyRows[dailyRows.length - 1];
  const used = today.h - today.l;
  return { avgPips: Math.round(avg / PIP), todayPips: Math.round(used / PIP), remainingPips: Math.max(0, Math.round((avg - used) / PIP)) };
}

/* Weekly OHLC dari candle harian. Chart punya tab W1, jadi data W1 harus
   benar-benar ada di payload — bukan hanya level weekly open. */
function weeklyRows(dailyRows) {
  const map = new Map();
  (dailyRows || []).forEach(r => {
    if (!r || !isFinite(r.t) || !isFinite(r.o)) return;
    const d = new Date(r.t), day = (d.getUTCDay() + 6) % 7;
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
    const w = map.get(key);
    if (!w) map.set(key, { t: key, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 });
    else { w.h = Math.max(w.h, r.h); w.l = Math.min(w.l, r.l); w.c = r.c; w.v += r.v || 0; }
  });
  return [...map.values()].sort((a, b) => a.t - b.t);
}

function eventRiskOf(cal) {
  const now = Date.now();
  const items = (cal || []).filter(e => e.cur === 'USD' && /high/i.test(e.impact || '') && isFinite(e.ts))
    .map(e => ({ title: e.title, when: new Date(e.ts).toISOString(), min: Math.round((e.ts - now) / 60000) }))
    .filter(x => Math.abs(x.min) <= 90)
    .sort((a, b) => Math.abs(a.min) - Math.abs(b.min));
  if (!items.length) return { level: 'RENDAH', items: [], note: 'Tidak ada rilis USD high-impact dalam ±90 menit.' };
  const near = items[0];
  return {
    level: Math.abs(near.min) <= 30 ? 'TINGGI' : 'SEDANG', items: items.slice(0, 4),
    note: Math.abs(near.min) <= 30
      ? 'Rilis ' + near.title + ' dalam ' + (near.min >= 0 ? near.min + ' menit' : Math.abs(near.min) + ' menit lalu') + ' — spread bisa melebar.'
      : 'Ada rilis high-impact dalam ±90 menit (' + near.title + ').'
  };
}

function premiumDiscount(rows) {
  const w = rows.slice(-60), hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  const pos = hi > lo ? Math.round((rows[rows.length - 1].c - lo) / (hi - lo) * 100) : 50;
  return { hi: C.r2(hi), lo: C.r2(lo), pos, zone: pos > 50 ? 'premium' : pos < 50 ? 'discount' : 'equilibrium' };
}

/* ================== PETA MULTI-TIMEFRAME 1D → 1m ==================
   Mengikuti urutan pada materi: 1D–4H memberi arah + likuiditas + supply/
   demand; 1H–15m memberi tren, breakout, reversal, OB, FVG, likuiditas;
   5m–1m memberi konfirmasi dan entry. Ini hanya gerbang validitas — level
   entry, SL 30, dan TP2 tetap dihitung buildModeSetups. */
const sideOfTrend = (t) => t === 'BULLISH' ? 'BUY' : t === 'BEARISH' ? 'SELL' : null;
const sideAligned = (side, dir) => !!side && side === dir;
function zoneSide(z, dir) {
  const want = dir === 'BUY' ? 'BULLISH' : 'BEARISH';
  return !!z && (z.dir === want || (dir === 'BUY' ? z.kind === 'bull' : z.kind === 'bear'));
}
function zoneOf(z, tf) {
  return { tf, lo: C.r2(z.lo), hi: C.r2(z.hi), at: z.at || isoAt(z.t), unmitigated: z.unmitigated !== false };
}
function uniqueZones(list) {
  const seen = new Set();
  return (list || []).filter(z => {
    const key = z.tf + '|' + z.lo + '|' + z.hi + '|' + (z.at || '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function eventOf(e, tf, kind) {
  if (!e) return null;
  return { tf, kind, dir: e.dir, level: e.level, at: e.at || isoAt(e.t), note: e.note || '' };
}
function latestEvent(list) {
  return (list || []).slice().sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))[0] || null;
}

function multiTfOf(pack) {
  const dir = pack.direction === 'SELL' ? 'SELL' : 'BUY';
  const sm = pack.smc || {}, flow = sm.flow || {};
  const d1 = flow.d1 || {}, h4 = flow.h4 || {}, h1 = flow.h1 || {}, m15 = flow.m15 || {};

  /* ---------- HTF 1D–4H: direction, liquidity, supply/demand ---------- */
  const d1Side = sideOfTrend(d1.trend), h4Side = sideOfTrend(h4.trend);
  const htfAligned = [d1Side, h4Side].filter(x => sideAligned(x, dir));
  const htfOpposed = [d1Side, h4Side].filter(x => x && x !== dir);
  const directionOk = htfAligned.length >= 1 && htfOpposed.length === 0;
  const htfAbove = pack.h4structure && pack.h4structure.lastHi != null ? pack.h4structure.lastHi
    : pack.h4eq && pack.h4eq.highs && pack.h4eq.highs[0] ? pack.h4eq.highs[0].price : null;
  const htfBelow = pack.h4structure && pack.h4structure.lastLo != null ? pack.h4structure.lastLo
    : pack.h4eq && pack.h4eq.lows && pack.h4eq.lows[0] ? pack.h4eq.lows[0].price : null;
  const liqTarget = dir === 'BUY' ? htfAbove : htfBelow;
  const htfSweep = pack.h4sweep && ((dir === 'BUY' && pack.h4sweep.kind === 'low') || (dir === 'SELL' && pack.h4sweep.kind === 'high')) ? pack.h4sweep : null;
  const liquidityOk = liqTarget != null || !!htfSweep;
  const htfZones = uniqueZones([
    ...(sm.obs.h4 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'H4')),
    ...(sm.fvg.h4 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'H4')),
    ...(sm.obs.d1 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'D1')),
    ...(sm.fvg.d1 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'D1'))
  ]).slice(-5);
  const supplyDemandOk = htfZones.length > 0;
  const htfOk = directionOk && liquidityOk && supplyDemandOk;

  /* ---------- MTF 1H–15m: trend, break, reversal, OB/FVG, liquidity ---------- */
  const h1Side = sideOfTrend(h1.trend), m15Side = sideOfTrend(m15.trend);
  const midAligned = [h1Side, m15Side].filter(x => sideAligned(x, dir));
  const midOpposed = [h1Side, m15Side].filter(x => x && x !== dir);
  const trendOk = midAligned.length >= 1 && midOpposed.length === 0;
  const breaks = [eventOf(h1.bos, 'H1', 'BOS'), eventOf(m15.bos, 'M15', 'BOS')]
    .filter(e => e && sideAligned(e.dir === 'BULLISH' ? 'BUY' : 'SELL', dir));
  const reversals = [eventOf(h1.choch, 'H1', 'CHoCH'), eventOf(m15.choch, 'M15', 'CHoCH')]
    .filter(e => e && sideAligned(e.dir === 'BULLISH' ? 'BUY' : 'SELL', dir));
  const midZones = uniqueZones([
    ...(sm.obs.h1 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'H1')),
    ...(sm.obs.m15 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'M15')),
    ...(sm.fvg.h1 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'H1')),
    ...(sm.fvg.m15 || []).filter(z => zoneSide(z, dir) && z.unmitigated).map(z => zoneOf(z, 'M15'))
  ]).slice(-6);
  const poiOk = midZones.length > 0;
  const midLiq = dir === 'BUY'
    ? (pack.h1structure && pack.h1structure.lastHi != null ? pack.h1structure.lastHi : pack.structure && pack.structure.lastHi)
    : (pack.h1structure && pack.h1structure.lastLo != null ? pack.h1structure.lastLo : pack.structure && pack.structure.lastLo);
  const midSweep = sm.liq && sm.liq.sweep && ((dir === 'BUY' && sm.liq.sweep.kind === 'low') || (dir === 'SELL' && sm.liq.sweep.kind === 'high')) ? sm.liq.sweep : null;
  const midLiqOk = midLiq != null || !!midSweep;
  const midOk = trendOk && (breaks.length > 0 || reversals.length > 0) && poiOk && midLiqOk;

  /* ---------- LTF 5m–1m: confirmation + entry ---------- */
  const m1Rows = pack.chart && Array.isArray(pack.chart.m1) ? pack.chart.m1 : [];
  const m1Available = m1Rows.length >= 5;
  const addConfirm = (src, type, e, label, why, at, price) => {
    if (!e || !price) return;
    confirmations.push({ src, type, label: label || type + ' ' + src, at: at || e.at || null, price: C.r2(price), why: why || e.note || '' });
  };
  const confirmations = [];
  const m5Side = pack.m5 && sideOfTrend(pack.m5.trend);
  if (m1Available) {
    if (pack.m1bos && sideAligned(pack.m1bos.dir === 'BULLISH' ? 'BUY' : 'SELL', dir)) addConfirm('M1', 'BOS', pack.m1bos, 'BOS M1', pack.m1bos.note, pack.m1bos.at, pack.m1bos.level);
    if (pack.m1sweep && ((dir === 'BUY' && pack.m1sweep.kind === 'low') || (dir === 'SELL' && pack.m1sweep.kind === 'high'))) addConfirm('M1', 'SWEEP', pack.m1sweep, 'sweep M1', pack.m1sweep.why || pack.m1sweep.note, pack.m1sweep.at, pack.m1sweep.level);
    (pack.m1fvgs || []).filter(z => zoneSide(z, dir) && z.unmitigated).slice(-1).forEach(z => addConfirm('M1', 'FVG', z, 'FVG M1 ' + (z.label || ''), z.note, z.at, dir === 'BUY' ? z.lo : z.hi));
    if (pack.m1ob && zoneSide(pack.m1ob, dir) && pack.m1ob.unmitigated) addConfirm('M1', 'OB', pack.m1ob, 'OB M1 ' + (pack.m1ob.kind || ''), pack.m1ob.note, pack.m1ob.at, dir === 'BUY' ? pack.m1ob.lo : pack.m1ob.hi);
  }
  if (pack.m5bos && sideAligned(pack.m5bos.dir === 'BULLISH' ? 'BUY' : 'SELL', dir)) addConfirm('M5', 'BOS', pack.m5bos, 'BOS M5', '', pack.m5bos.at, pack.m5bos.level);
  if (pack.m5sweep && ((dir === 'BUY' && pack.m5sweep.kind === 'low') || (dir === 'SELL' && pack.m5sweep.kind === 'high'))) addConfirm('M5', 'SWEEP', pack.m5sweep, 'sweep M5', pack.m5sweep.why, pack.m5sweep.at, pack.m5sweep.level);
  (pack.m5fvgs || []).filter(z => zoneSide(z, dir) && z.unmitigated).slice(-1).forEach(z => addConfirm('M5', 'FVG', z, 'FVG M5 ' + (z.label || ''), z.note, z.at, dir === 'BUY' ? z.lo : z.hi));
  if (pack.m5ob && zoneSide(pack.m5ob, dir) && pack.m5ob.unmitigated) addConfirm('M5', 'OB', pack.m5ob, 'OB M5 ' + (pack.m5ob.kind || ''), pack.m5ob.note, pack.m5ob.at, dir === 'BUY' ? pack.m5ob.lo : pack.m5ob.hi);
  if (sm.displacement && ((dir === 'BUY' && sm.displacement.dir === 'BULLISH') || (dir === 'SELL' && sm.displacement.dir === 'BEARISH'))) addConfirm('M5', 'DISP', sm.displacement, 'displacement M5', sm.displacement.note, sm.displacement.at, pack.price);
  if (sm.engulf && sm.engulf.m15 && ((dir === 'BUY' && sm.engulf.m15.dir === 'BULLISH') || (dir === 'SELL' && sm.engulf.m15.dir === 'BEARISH'))) addConfirm('M15', 'ENGULF', sm.engulf.m15, 'engulfing M15', sm.engulf.m15.note, sm.engulf.m15.at, sm.engulf.m15.level);
  const m1Confirms = confirmations.filter(x => x.src === 'M1');
  const m5Confirms = confirmations.filter(x => x.src === 'M5' || x.src === 'M15');
  const m5TrendOk = sideAligned(m5Side, dir);
  /* M1 adalah konfirmasi tambahan, bukan syarat mutlak: bila feed M1 hidup
     tetapi belum ada setup M1, sweep/BOS M5 + tren M5 searah tetap merupakan
     konfirmasi LTF. Dua konfirmasi M5 juga sah tanpa M1. */
  const ltfOk = m1Available
    ? (m1Confirms.length >= 1 && m5Confirms.length >= 1) || (m5Confirms.length >= 1 && m5TrendOk)
    : (m5Confirms.length >= 1 && m5TrendOk);
  const marker = latestEvent(m1Confirms) || latestEvent(m5Confirms);
  const ltfNote = (m1Available ? 'M1 nyata tersedia' : 'M1 tidak tersedia dari feed — konfirmasi memakai M5') + ': ' + (confirmations.length ? confirmations.map(x => x.label).join(' · ') : 'belum ada konfirmasi searah') + (m5TrendOk ? ' · tren M5 ' + (m5Side === 'BUY' ? 'bullish' : 'bearish') : ' · tren M5 belum searah');

  const missing = [];
  if (!directionOk) missing.push('HTF direction D1/H4');
  if (!liquidityOk) missing.push('HTF liquidity');
  if (!supplyDemandOk) missing.push('HTF supply/demand');
  if (!trendOk) missing.push('MTF trend H1/M15');
  if (!(breaks.length > 0 || reversals.length > 0)) missing.push('MTF break/reversal');
  if (!poiOk) missing.push('MTF OB/FVG');
  if (!midLiqOk) missing.push('MTF liquidity');
  if (!ltfOk) missing.push('LTF confirmation M5/M1');
  const gateOk = htfOk && midOk && ltfOk;
  return {
    at: pack.at || new Date().toISOString(), dir,
    htf: { tfs: '1D–4H', ok: htfOk, direction: { ok: directionOk, d1: d1.trend || '—', h4: h4.trend || '—', aligned: htfAligned.length, note: 'D1 ' + (d1.trend || '—') + ' · H4 ' + (h4.trend || '—') + ' → ' + (directionOk ? 'searah ' + dir : 'belum sepakat') },
      liquidity: { ok: liquidityOk, above: htfAbove, below: htfBelow, target: liqTarget, sweep: htfSweep, note: 'Target likuiditas ' + (dir === 'BUY' ? 'atas' : 'bawah') + ' ' + (liqTarget == null ? '—' : liqTarget) + (htfSweep ? '; sweep H4 ' + htfSweep.kind : '') },
      supplyDemand: { ok: supplyDemandOk, zones: htfZones, note: htfZones.length ? htfZones.map(z => z.tf + ' ' + z.lo + '–' + z.hi).join(' · ') : 'belum ada zona ' + (dir === 'BUY' ? 'demand' : 'supply') + ' H4/D1' } },
    mid: { tfs: '1H–15m', ok: midOk, trend: { ok: trendOk, h1: h1.trend || '—', m15: m15.trend || '—', note: 'H1 ' + (h1.trend || '—') + ' · M15 ' + (m15.trend || '—') },
      breaks, reversals, poi: { ok: poiOk, zones: midZones, note: midZones.length ? midZones.map(z => z.tf + ' ' + z.lo + '–' + z.hi).join(' · ') : 'belum ada OB/FVG H1/M15 searah' },
      liquidity: { ok: midLiqOk, level: midLiq, sweep: midSweep, note: 'Liquidity ' + (midLiq == null ? '—' : midLiq) + (midSweep ? '; sweep ' + midSweep.pool : '') } },
    ltf: { tfs: '5m–1m', ok: ltfOk, m1Available, trendOk: m5TrendOk, confirmations, marker, entry: { tf: 'M5', order: dir === 'BUY' ? 'LIMIT BUY' : 'LIMIT SELL', note: 'Konfirmasi final di M5/M1; entry tetap limit di POI, bukan market chase.' }, note: ltfNote },
    gate: { ok: gateOk, htf: htfOk, mid: midOk, ltf: ltfOk, missing, note: gateOk ? 'HTF + MTF + LTF selaras; entry limit valid.' : 'Belum valid penuh: ' + missing.join(', ') + '.' },
    blueprint: [
      { layer: 'HTF', tfs: '1D–4H', items: ['Direction', 'Liquidity', 'Supply & Demand'] },
      { layer: 'MTF', tfs: '1H–15m', items: ['Trend', 'Breakout', 'Reversal', 'Order Block', 'FVG', 'Liquidity'] },
      { layer: 'LTF', tfs: '5m–1m', items: ['Confirmation', 'Entry'] }
    ],
    note: '1D–4H ' + (directionOk ? dir : 'belum sepakat') + ' · 1H–15m ' + (midOk ? 'struktur/POI lengkap' : 'belum lengkap') + ' · 5m–1m ' + (ltfOk ? 'konfirmasi lengkap' : 'belum konfirmasi')
  };
}

function directionVote(pack) {
  const v = [];
  const push = (w, why) => { if (w) v.push({ w, why }); };
  const tv = pack.tv;
  if (tv && tv.ok && tv.tf) {
    const rec = k => tv.tf[k] && tv.tf[k].rec != null ? tv.tf[k] : null;
    const d1 = rec('D'), h4 = rec('240'), h1 = rec('60'), m15 = rec('15');
    if (d1) push(d1.rec * 1.6, 'TradingView 1D ' + d1.recLabel);
    if (h4) push(h4.rec * 1.4, 'TradingView 4H ' + h4.recLabel);
    if (h1) push(h1.rec * 1.1, 'TradingView 1H ' + h1.recLabel);
    if (m15) push(m15.rec * 0.9, 'TradingView 15m ' + m15.recLabel);
  }
  if (pack.h4structure && pack.h4structure.trend !== 'RANGE') push(pack.h4structure.trend === 'BULLISH' ? 1.6 : -1.6, 'struktur H4 ' + pack.h4structure.trend);
  if (pack.h1structure && pack.h1structure.trend !== 'RANGE') push(pack.h1structure.trend === 'BULLISH' ? 1.2 : -1.2, 'struktur H1 ' + pack.h1structure.trend);
  if (pack.h4bos) push(pack.h4bos.dir === 'BULLISH' ? 0.8 : -0.8, 'BOS H4 ' + pack.h4bos.dir);
  const st = pack.structure;
  if (st.trend !== 'RANGE') push(st.trend === 'BULLISH' ? 2 : -2, 'struktur M15 ' + st.trend);
  if (pack.m5 && pack.m5.trend !== 'RANGE') push(pack.m5.trend === 'BULLISH' ? 0.9 : -0.9, 'struktur M5 ' + pack.m5.trend);
  if (pack.m5bos) push(pack.m5bos.dir === 'BULLISH' ? 1 : -1, 'BOS M5 ' + pack.m5bos.dir);
  if (pack.m5sweep) push(pack.m5sweep.kind === 'low' ? 0.7 : -0.7, 'sweep M5 sisi ' + pack.m5sweep.kind);
  if (pack.bos) push(pack.bos.dir === 'BULLISH' ? 1.2 : -1.2, 'BOS ' + pack.bos.dir);
  if (pack.ema20 != null && pack.ema50 != null) push(pack.ema20 > pack.ema50 ? 1 : -1, 'EMA20/50 M15');
  if (pack.daily && pack.daily.trend !== 'campuran') push(pack.daily.trend === 'naik' ? 2 : -2, 'tren D1 ' + pack.daily.trend);
  if (pack.sweep) push(pack.sweep.kind === 'low' ? 0.8 : -0.8, 'sapuan likuiditas sisi ' + pack.sweep.kind);
  if (pack.smt) push(pack.smt.dir, pack.smt.why);
  if (pack.pd && pack.pd.pos < 50) push(0.4, 'harga di discount (<50%)');
  if (pack.pd && pack.pd.pos > 50) push(-0.4, 'harga di premium (>50%)');
  /* Mesin SMC/AMD: struktur, sweep, fase, dan premium/discount ikut menimbang
     arah. Entry tetap dari trigger M5; ini hanya bobot keyakinan. */
  if (pack.smc && pack.smc.ok) {
    const sm = pack.smc;
    if (sm.htf && sm.htf.score) push(C.clip(sm.htf.score * 0.35, -1.2, 1.2), 'SMC HTF ' + sm.htf.note);
    if (sm.flow && sm.flow.m15) {
      const e = sm.flow.m15;
      if (e.choch) push((e.choch.dir === 'BULLISH' ? 1 : -1) * 0.7, 'CHoCH M15 ' + e.choch.dir);
      else if (e.bos) push((e.bos.dir === 'BULLISH' ? 1 : -1) * 0.5, 'BOS M15 ' + e.bos.dir);
    }
    if (sm.liq && sm.liq.sweep) push(sm.liq.sweep.kind === 'low' ? 0.8 : -0.8, 'SMC sweep ' + sm.liq.sweep.pool);
    if (sm.amd && sm.amd.bias) push(C.clip(sm.amd.bias * 0.6, -0.9, 0.9), 'AMD ' + sm.amd.phase);
    if (sm.pd) push(C.clip((50 - sm.pd.pos) / 80, -0.5, 0.5), 'SMC ' + sm.pd.zone);
  }
  /* Data makro global real-time: DXY/yield naik menekan emas. */
  const mac = pack.macro || {};
  if (mac.dxy15m != null) push(C.clip(-mac.dxy15m * 0.35, -1.1, 1.1), 'DXY 15m ' + mac.dxy15m + '%');
  if (mac.us10y15m != null) push(C.clip(-mac.us10y15m * 2, -0.9, 0.9), 'Yield 10Y 15m ' + mac.us10y15m + ' pp');
  if (mac.dxy5d != null) push(C.clip(-mac.dxy5d * 0.25, -1.1, 1.1), 'DXY 5 hari ' + mac.dxy5d + '%');
  if (mac.yield10_5d != null) push(C.clip(-mac.yield10_5d * 0.8, -1.2, 1.2), 'Yield 10Y 5 hari ' + mac.yield10_5d + ' pp');
  if (pack.judas) push(pack.judas.side === 'low' ? 0.9 : -0.9, 'Judas swing sisi ' + pack.judas.side);
  if (pack.mitigation) push(pack.mitigation.dir === 'BULLISH' ? 0.7 : -0.7, 'Mitigation block ' + pack.mitigation.dir);
  if (pack.eq) {
    if ((pack.eq.highs || []).length) push(-0.3, 'Equal highs (likuiditas atas)');
    if ((pack.eq.lows || []).length) push(0.3, 'Equal lows (likuiditas bawah)');
  }
  const sum = v.reduce((a, x) => a + x.w, 0), tot = v.reduce((a, x) => a + Math.abs(x.w), 0) || 1;
  return { dir: sum >= 0 ? 'BUY' : 'SELL', strength: Math.round(Math.abs(sum) / tot * 100), votes: v };
}

/* ================== ADAPTIVE LEARNING ==================
   Profil berasal dari hasil riwayat akun yang dikirim klien. Server hanya
   memakai pola yang sudah tervalidasi candle M5; tidak ada data hasil yang
   dikarang. Profil hanya boleh menurunkan status/conf, bukan membalik arah. */
function learnMacroSide(macro, dir) {
  const m = macro || {};
  let score = 0;
  const add = (v, w) => { const n = Number(v); if (isFinite(n)) score += n * w; };
  add(m.dxy15m, -0.35); add(m.us10y15m, -2); add(m.dxy5d, -0.25); add(m.yield10_5d, -0.8);
  if (Math.abs(score) < 0.15) return 'netral';
  return score * (dir === 'BUY' ? 1 : -1) >= 0.15 ? 'mendukung' : 'melawan';
}
function learnTfSide(tfMatrix, dir) {
  let aligned = 0, opposed = 0;
  (tfMatrix || []).slice(0, 6).forEach(x => {
    const v = Number(x && x.value);
    if (!isFinite(v) || Math.abs(v) < 0.05) return;
    if (v * (dir === 'BUY' ? 1 : -1) > 0) aligned++; else opposed++;
  });
  return aligned === opposed ? 'campuran' : aligned > opposed ? 'mendukung' : 'melawan';
}
function learnTriggerKind(v) {
  const t = String(v || '');
  if (/\bBOS\b/i.test(t)) return 'BOS';
  if (/sweep|sapuan/i.test(t)) return 'SWEEP';
  if (/FVG/i.test(t)) return 'FVG';
  if (/\bOB\b|order block/i.test(t)) return 'OB';
  if (/engulf/i.test(t)) return 'ENGULF';
  return 'TRIGGER';
}
function learnPatternKeys(s, pack) {
  const style = String((s && s.style) || '?'), dir = String((s && s.dir) || '?');
  const poi = String((s && (s.poiTf || s.poi)) || '?');
  const trig = learnTriggerKind((s && s.trigger) || (s && s.why));
  const sess = String((pack && pack.session && pack.session.name) || '?');
  const macro = learnMacroSide(pack && pack.macro, dir);
  const risk = String((pack && pack.eventRisk && pack.eventRisk.level) || '?');
  const htf = learnTfSide(pack && pack.tfMatrix, dir);
  const smc = (s && s.smc) || {};
  const grade = String(smc.grade || '?').toUpperCase();
  const phase = String(smc.phase || '?').toUpperCase();
  const kill = smc.killzone && smc.killzone.active ? 'YA' : 'TIDAK';
  const pd = String(smc.pd && smc.pd.zone || '?').toUpperCase();
  return [...new Set([
    [style, dir, poi, trig, sess, macro, risk, htf, grade, phase, kill, pd].join('|'),
    [style, dir, poi, trig, sess, macro, risk, htf].join('|'),
    [style, dir, poi, trig, macro, risk].join('|'),
    [style, dir, risk].join('|'),
    [style, dir].join('|')
  ])];
}
/* ============ KONFLUENSI SEMUA METODE TEKNIKAL ============
   Setiap kelompok metode memberi suara sendiri. Arah entry tetap dari trigger
   M5; matriks ini dipakai untuk mengukur dukungan (konfluensi) dan menahan
   entry yang hanya didukung satu metode. Tidak ada skor yang dikarang: semua
   berasal dari struktur, FVG/OB, likuiditas, tren, momentum, dan makro. */
function methodMatrix(pack) {
  const dir = pack.direction === 'SELL' ? 'SELL' : 'BUY';
  const sign = dir === 'BUY' ? 1 : -1;
  const out = [];
  const add = (name, score, why) => {
    const n = Number(score);
    if (!isFinite(n) || Math.abs(n) < 0.01) return;
    out.push({ name, score: C.r2(n), side: n * sign >= 0 ? 'searah' : 'melawan', why });
  };
  /* 1. SMC / ICT: struktur, sweep, FVG, order block. */
  let smc = 0;
  const smcWhy = [];
  if (pack.m5bos) { smc += pack.m5bos.dir === 'BULLISH' ? 1 : -1; smcWhy.push('BOS M5 ' + pack.m5bos.dir); }
  if (pack.m5sweep) { smc += pack.m5sweep.kind === 'low' ? 0.8 : -0.8; smcWhy.push('sweep M5 ' + pack.m5sweep.kind); }
  if (pack.m5ob) { smc += pack.m5ob.dir === 'BULLISH' ? 0.8 : -0.8; smcWhy.push('OB M5 ' + pack.m5ob.dir); }
  if (pack.bos) { smc += pack.bos.dir === 'BULLISH' ? 1 : -1; smcWhy.push('BOS M15 ' + pack.bos.dir); }
  if (pack.sweep) { smc += pack.sweep.kind === 'low' ? 0.8 : -0.8; smcWhy.push('sweep M15 ' + pack.sweep.kind); }
  if (pack.ob) { smc += pack.ob.dir === 'BULLISH' ? 0.7 : -0.7; smcWhy.push('OB M15 ' + pack.ob.dir); }
  if (pack.choch) { smc += pack.choch.to === 'BULLISH' ? 0.6 : -0.6; smcWhy.push('CHoCH ' + pack.choch.to); }
  [...(pack.m5fvgs || []), ...(pack.fvgs || [])].slice(-4).forEach(z => { smc += z.kind === 'bull' ? 0.25 : -0.25; smcWhy.push('FVG ' + z.kind); });
  if (pack.smc && pack.smc.ok) {
    if (pack.smc.pd) { smc += C.clip((50 - pack.smc.pd.pos) / 100, -0.5, 0.5); smcWhy.push('PD ' + pack.smc.pd.zone); }
    if (pack.smc.displacement) { smc += pack.smc.displacement.dir === 'BULLISH' ? 0.4 : -0.4; smcWhy.push('displacement ' + pack.smc.displacement.dir); }
    if (pack.smc.amd && pack.smc.amd.bias) { smc += C.clip(pack.smc.amd.bias * 0.5, -0.6, 0.6); smcWhy.push('AMD ' + pack.smc.amd.phase); }
    if (pack.smc.rejection) { smc += pack.smc.rejection.dir === 'BULLISH' ? 0.35 : -0.35; smcWhy.push('rejection ' + pack.smc.rejection.dir); }
    if (pack.smc.bpr) smcWhy.push('BPR ' + pack.smc.bpr.lo + '–' + pack.smc.bpr.hi);
    (pack.smc.ifvg || []).slice(-1).forEach(z => { smc += z.kind === 'bull' ? 0.25 : -0.25; smcWhy.push('IFVG ' + z.kind); });
  }
  add('SMC/ICT', smc, smcWhy.join(' · ') || 'tidak ada sinyal SMC');
  /* 2. Struktur HTF. */
  let htf = 0;
  const htfWhy = [];
  if (pack.h4structure && pack.h4structure.trend !== 'RANGE') { htf += pack.h4structure.trend === 'BULLISH' ? 1.4 : -1.4; htfWhy.push('H4 ' + pack.h4structure.trend); }
  if (pack.h1structure && pack.h1structure.trend !== 'RANGE') { htf += pack.h1structure.trend === 'BULLISH' ? 1.1 : -1.1; htfWhy.push('H1 ' + pack.h1structure.trend); }
  if (pack.structure && pack.structure.trend !== 'RANGE') { htf += pack.structure.trend === 'BULLISH' ? 0.9 : -0.9; htfWhy.push('M15 ' + pack.structure.trend); }
  if (pack.daily && pack.daily.trend !== 'campuran') { htf += pack.daily.trend === 'naik' ? 1.1 : -1.1; htfWhy.push('D1 ' + pack.daily.trend); }
  add('Struktur HTF', htf, htfWhy.join(' · ') || 'struktur belum jelas');
  /* 3. Tren & momentum (EMA, RSI, candle). */
  let trend = 0;
  const trendWhy = [];
  if (pack.ema20 != null && pack.ema50 != null) { trend += pack.ema20 > pack.ema50 ? 0.9 : -0.9; trendWhy.push('EMA20/50 M15'); }
  if (pack.rsi != null) { trend += C.clip((pack.rsi - 50) / 45, -0.6, 0.6); trendWhy.push('RSI14 M15 ' + pack.rsi); }
  if (pack.m5 && pack.m5.trend !== 'RANGE') { trend += pack.m5.trend === 'BULLISH' ? 0.5 : -0.5; trendWhy.push('M5 ' + pack.m5.trend); }
  add('Tren & momentum', trend, trendWhy.join(' · ') || 'momentum netral');
  /* 4. Likuiditas: equal highs/lows, PDH/PDL, premium/discount. */
  let liq = 0;
  const liqWhy = [];
  if (pack.eq && (pack.eq.highs || []).length) { liq -= 0.35; liqWhy.push('equal highs'); }
  if (pack.eq && (pack.eq.lows || []).length) { liq += 0.35; liqWhy.push('equal lows'); }
  if (pack.pd) { liq += C.clip((50 - pack.pd.pos) / 60, -0.5, 0.5); liqWhy.push('zona ' + pack.pd.zone); }
  add('Likuiditas', liq, liqWhy.join(' · ') || 'likuiditas netral');
  /* 5. Makro global (DXY/yield). */
  const mac = pack.macro || {};
  let macro = 0;
  if (mac.dxy15m != null) macro += C.clip(-mac.dxy15m * 0.35, -1.1, 1.1);
  if (mac.us10y15m != null) macro += C.clip(-mac.us10y15m * 2, -0.9, 0.9);
  if (mac.dxy5d != null) macro += C.clip(-mac.dxy5d * 0.25, -1.1, 1.1);
  if (mac.yield10_5d != null) macro += C.clip(-mac.yield10_5d * 0.8, -1.2, 1.2);
  add('Makro global', macro, 'DXY 15m ' + (mac.dxy15m == null ? '—' : mac.dxy15m + '%') + ' · yield 10Y 15m ' + (mac.us10y15m == null ? '—' : mac.us10y15m + ' pp'));
  /* 6. TradingView multi-TF sebagai konfirmasi eksternal. */
  let tvs = 0;
  (pack.tfMatrix || []).slice(0, 6).forEach(x => { if (x.value != null) tvs += C.clip(Number(x.value) * 0.5, -0.8, 0.8); });
  add('TradingView multi-TF', tvs, 'Gabungan rekomendasi TF');
  const net = out.reduce((a, x) => a + x.score, 0);
  const tot = out.reduce((a, x) => a + Math.abs(x.score), 0) || 1;
  const agree = out.filter(x => x.side === 'searah').length;
  const against = out.filter(x => x.side === 'melawan');
  return {
    dir, score: C.r2(net), agreement: Math.round(Math.abs(net) / tot * 100),
    agree, total: out.length, methods: out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)),
    against: against.map(x => x.name).slice(0, 4),
    note: out.length ? agree + '/' + out.length + ' metode searah ' + dir + '; konfluensi ' + Math.round(Math.abs(net) / tot * 100) + '%' : 'Metode teknikal belum cukup data'
  };
}

function applyLearning(pack, learn) {
  const raw = learn && Array.isArray(learn.patterns) ? learn.patterns : [];
  const map = new Map();
  raw.slice(0, 120).forEach(x => {
    if (!x || typeof x.key !== 'string' || x.key.length > 240) return;
    const n = Math.max(0, Math.min(999, Math.round(Number(x.n) || 0)));
    const w = Math.max(0, Math.min(n, Math.round(Number(x.w) || 0)));
    const l = Math.max(0, Math.min(n - w, Math.round(Number(x.l) || 0)));
    const last = Math.max(0, Math.min(Date.now() + 86400000, Number(x.last) || 0));
    if (n) map.set(x.key, { n, w, l, last });
  });
  /* Pelajaran sifat teknikal dari SEMUA hasil (SL/TP), bukan hanya pola persis. */
  const engine = L.buildLessons(learn || {});
  if (!map.size && !engine.records) return pack;
  let blocked = 0, warned = 0, penalized = 0;
  (pack.setups || []).forEach(s => {
    if (!s || s.status === 'LEWAT') return;
    const keys = learnPatternKeys(s, pack);
    const exact = map.get(keys[0]) || null;
    let best = null, bestKey = '';
    keys.forEach(k => {
      const st = map.get(k);
      if (st && (!best || st.n > best.n || (st.n === best.n && st.l > best.l))) { best = st; bestKey = k; }
    });
    const recent = st => !!st && st.last > 0 && Date.now() - st.last < 7 * 86400000;
    /* Satu SL tidak langsung menahan pola: butuh minimal 2 SL nyata pada pola
       yang sama (atau 3 hasil semuanya SL) agar mesin tidak terkunci dini.
       Observasi paper tetap dihitung sebagai peringatan, bukan blokir. */
    const patternStop = !!((exact && exact.l >= 2 && exact.w === 0 && recent(exact)) || (best && best.n >= 3 && best.l >= 2 && best.w === 0 && recent(best)) || (best && best.n >= 4 && best.l / best.n >= 0.75 && best.w === 0 && recent(best)));
    const patternWarn = !!(!patternStop && best && best.l > 0);
    const lessons = L.evaluateSetup({
      style: s.style, dir: s.dir, poi: s.poiTf || s.poi,
      trigger: learnTriggerKind(s.trigger || s.why),
      session: pack.session && pack.session.name,
      macro: learnMacroSide(pack.macro, s.dir),
      risk: pack.eventRisk && pack.eventRisk.level,
      htf: learnTfSide(pack.tfMatrix, s.dir),
      smc: s.smc && s.smc.grade,
      phase: s.smc && s.smc.phase,
      kill: s.smc && s.smc.killzone && s.smc.killzone.active ? 'ya' : 'tidak',
      pd: s.smc && s.smc.pd && s.smc.pd.zone,
      method: pack.methods && pack.methods.agreement >= 70 ? 'tinggi' : pack.methods && pack.methods.agreement >= 50 ? 'sedang' : 'rendah',
      target: ((s.targets || []).filter(t => Number(t.pips) >= TP2_PIPS).slice(-1)[0] || {}).src || '',
      conf: s.conf
    }, engine);
    const stop = patternStop || lessons.blocked;
    const warn = !stop && (patternWarn || lessons.warn);
    const reasons = lessons.reasons.slice(0, 3);
    if (patternStop && best) reasons.unshift('Pola persis: ' + best.l + ' SL / ' + best.w + ' TP');
    s.learning = (stop || warn) ? {
      blocked: stop, warn,
      n: best ? best.n : lessons.n,
      wins: best ? best.w : lessons.wins,
      losses: best ? best.l : lessons.losses,
      key: bestKey || keys[0],
      label: lessons.reasons[0] || (bestKey ? bestKey.replace(/\|/g, ' · ') : 'Sifat teknikal berisiko'),
      penalty: lessons.penalty,
      reasons: reasons.slice(0, 3),
      note: stop
        ? 'Bukti SL berulang dari riwayat akun masih segar; entry ditahan sementara sampai pola/sifat ini pulih.'
        : 'Sifat teknikal ini pernah SL; keyakinan diturunkan dan konfirmasi ekstra wajib sebelum entry.'
    } : null;
    if (stop) {
      blocked++; s.conf = Math.max(30, Number(s.conf || 0) - 12);
      if (s.status === 'SIAP' || s.status === 'PENDING') s.status = 'TUNGGU';
      s.statusWhy = '[Pembelajaran server] ' + s.learning.note + ' ' + reasons.join('; ') + (s.statusWhy ? ' — ' + s.statusWhy : '');
    } else if (warn) {
      warned++;
      if (lessons.penalty) penalized++;
      s.conf = Math.max(30, Number(s.conf || 0) - Math.max(4, Math.min(10, lessons.penalty || 4)));
    }
  });
  pack.learning = {
    patterns: map.size, records: engine.records, blocked, warned, penalized,
    outcomes: engine.outcomes || { sl: 0, tp: 0, tp1: 0, tp2: 0, tpmax: 0 },
    traits: engine.traits.length, top: L.topRiskyTraits(engine, 4),
    source: 'semua hasil SL/TP tervalidasi candle M5 (pola persis + sifat teknikal)'
  };
  return pack;
}

function markersOf(pack) {
  const m = [];
  const fallbackAt = { M5: pack.m5At, M15: pack.m15At, H1: pack.h1At, H4: pack.h4At, D1: pack.d1At, W1: pack.weekOpenAt };
  const add = (type, label, price, why, extra) => {
    const x = extra || {}, tf = x.tf || 'M15';
    const at = x.at || fallbackAt[tf] || pack.m15At || null;
    m.push({ id: 'm' + (m.length + 1), type, label, price: C.r2(price), why, entryTf: 'M5', ...x, tf, at });
  };
  /* ---------- M5: dasar entry (candle M5 yang sudah close) ---------- */
  if (pack.m5bos) add('BOS', 'M5 Break of Structure', pack.m5bos.level, 'M5 close menembus swing ' + (pack.m5bos.dir === 'BULLISH' ? 'high' : 'low') + ' → trigger M5 ' + pack.m5bos.dir + '.', { tf: 'M5', at: pack.m5bos.at });
  if (pack.m5sweep) add('SWEEP', 'M5 liquidity sweep', pack.m5sweep.level, 'Sapuan likuiditas M5: ' + pack.m5sweep.why, { tf: 'M5', at: pack.m5sweep.at });
  (pack.m5fvgs || []).slice(-3).forEach(z => add('FVG', 'M5 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG M5 ' + z.lo + '–' + z.hi + ' — area retest entry M5.', { zone: [z.lo, z.hi], side: z.kind, tf: 'M5', at: z.at }));
  if (pack.m5ob) add('OB', 'M5 Order Block ' + (pack.m5ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.m5ob.dir === 'BULLISH' ? pack.m5ob.lo : pack.m5ob.hi, 'Order block M5 dari candle impuls terakhir (' + pack.m5ob.strength + '× ATR M5).', { zone: [pack.m5ob.lo, pack.m5ob.hi], side: pack.m5ob.dir.toLowerCase(), tf: 'M5', at: pack.m5ob.at });
  if (pack.m5structure && pack.m5structure.lastHi != null) add('SNR', 'M5 swing high', pack.m5structure.lastHi, 'Swing high M5 terakhir — resistance mikro untuk entry M5.', { tf: 'M5', at: pack.m5structure.lastHiAt });
  if (pack.m5structure && pack.m5structure.lastLo != null) add('SNR', 'M5 swing low', pack.m5structure.lastLo, 'Swing low M5 terakhir — support mikro untuk entry M5.', { tf: 'M5', at: pack.m5structure.lastLoAt });
  (pack.m5eq && pack.m5eq.highs || []).slice(-2).forEach(x => add('EQH', 'M5 equal highs', x.price, 'Dua swing high M5 berdekatan — likuiditas mikro di atas.', { tf: 'M5', at: x.at || isoAt(x.last) }));
  (pack.m5eq && pack.m5eq.lows || []).slice(-2).forEach(x => add('EQL', 'M5 equal lows', x.price, 'Dua swing low M5 berdekatan — likuiditas mikro di bawah.', { tf: 'M5', at: x.at || isoAt(x.last) }));
  /* ---------- M15 / D1: konteks & POI ---------- */
  if (pack.bos) add('BOS', 'M15 Break of Structure', pack.bos.level, 'M15 close menembus swing ' + (pack.bos.dir === 'BULLISH' ? 'high' : 'low') + ' terakhir → struktur ' + pack.bos.dir + '.', { tf: 'M15', at: pack.bos.at });
  if (pack.choch) add('CHoCH', 'M5 Change of Character', pack.choch.level, 'Struktur M5 berbalik dari ' + pack.choch.from + ' ke ' + pack.choch.to + '.', { tf: 'M5', at: pack.choch.at });
  if (pack.sweep) add('SWEEP', 'M15 liquidity sweep', pack.sweep.level, pack.sweep.why, { tf: 'M15', at: pack.sweep.at });
  (pack.fvgs || []).forEach(z => add('FVG', 'M15 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'Gap M15 ' + (z.kind === 'bull' ? 'naik' : 'turun') + ' ' + z.lo + '–' + z.hi + ' — POI retest.', { zone: [z.lo, z.hi], side: z.kind, tf: 'M15', at: z.at }));
  if (pack.ob) add('OB', 'M15 Order Block ' + (pack.ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.ob.dir === 'BULLISH' ? pack.ob.lo : pack.ob.hi, 'Candle impuls M15 terakhir ' + pack.ob.dir.toLowerCase() + ' (body ' + pack.ob.strength + '× ATR).', { zone: [pack.ob.lo, pack.ob.hi], side: pack.ob.dir.toLowerCase(), tf: 'M15', at: pack.ob.at });
  if (pack.structure.lastLo) add('SNR', 'M15 support (swing low)', pack.structure.lastLo, 'Swing low M15 terakhir — area pantulan/reaksi.', { tf: 'M15', at: pack.structure.lastLoAt });
  if (pack.structure.lastHi) add('SNR', 'M15 resistance (swing high)', pack.structure.lastHi, 'Swing high M15 terakhir — area penolakan.', { tf: 'M15', at: pack.structure.lastHiAt });
  if (pack.ote) add('OTE', 'M15 Optimal Trade Entry', pack.direction === 'BUY' ? pack.ote.long[1] : pack.ote.short[0], 'Zona 62–79% retracement M15 (long ' + pack.ote.long[0] + '–' + pack.ote.long[1] + ', short ' + pack.ote.short[0] + '–' + pack.ote.short[1] + ').', { tf: 'M15', at: pack.ote.at, zone: pack.direction === 'BUY' ? pack.ote.long : pack.ote.short });
  /* ---------- H1/H4: konteks top-down untuk Day & Swing ---------- */
  if (pack.h1bos) add('BOS', 'H1 Break of Structure', pack.h1bos.level, 'H1 close menembus swing ' + (pack.h1bos.dir === 'BULLISH' ? 'high' : 'low') + ' → bias H1 ' + pack.h1bos.dir + '.', { tf: 'H1', at: pack.h1bos.at });
  if (pack.h4bos) add('BOS', 'H4 Break of Structure', pack.h4bos.level, 'H4 close menembus swing ' + (pack.h4bos.dir === 'BULLISH' ? 'high' : 'low') + ' → bias H4 ' + pack.h4bos.dir + '.', { tf: 'H4', at: pack.h4bos.at });
  if (pack.h1sweep) add('SWEEP', 'H1 liquidity sweep', pack.h1sweep.level, pack.h1sweep.why, { tf: 'H1', at: pack.h1sweep.at });
  if (pack.h4sweep) add('SWEEP', 'H4 liquidity sweep', pack.h4sweep.level, pack.h4sweep.why, { tf: 'H4', at: pack.h4sweep.at });
  (pack.h1fvgs || []).slice(-2).forEach(z => add('FVG', 'H1 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG H1 ' + z.lo + '–' + z.hi + ' — POI Day.', { zone: [z.lo, z.hi], side: z.kind, tf: 'H1', at: z.at }));
  (pack.h4fvgs || []).slice(-2).forEach(z => add('FVG', 'H4 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG H4 ' + z.lo + '–' + z.hi + ' — POI Swing.', { zone: [z.lo, z.hi], side: z.kind, tf: 'H4', at: z.at }));
  if (pack.h1ob) add('OB', 'H1 Order Block ' + (pack.h1ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.h1ob.dir === 'BULLISH' ? pack.h1ob.lo : pack.h1ob.hi, 'Order block H1 — POI untuk mode Day.', { zone: [pack.h1ob.lo, pack.h1ob.hi], side: pack.h1ob.dir.toLowerCase(), tf: 'H1', at: pack.h1ob.at });
  if (pack.h4ob) add('OB', 'H4 Order Block ' + (pack.h4ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.h4ob.dir === 'BULLISH' ? pack.h4ob.lo : pack.h4ob.hi, 'Order block H4 — POI untuk mode Swing.', { zone: [pack.h4ob.lo, pack.h4ob.hi], side: pack.h4ob.dir.toLowerCase(), tf: 'H4', at: pack.h4ob.at });
  if (pack.h1structure && pack.h1structure.lastLo) add('SNR', 'H1 swing low', pack.h1structure.lastLo, 'Swing low H1 — support struktural.', { tf: 'H1', at: pack.h1structure.lastLoAt });
  if (pack.h1structure && pack.h1structure.lastHi) add('SNR', 'H1 swing high', pack.h1structure.lastHi, 'Swing high H1 — resistance struktural.', { tf: 'H1', at: pack.h1structure.lastHiAt });
  if (pack.h4structure && pack.h4structure.lastLo) add('SNR', 'H4 swing low', pack.h4structure.lastLo, 'Swing low H4 — support utama.', { tf: 'H4', at: pack.h4structure.lastLoAt });
  if (pack.h4structure && pack.h4structure.lastHi) add('SNR', 'H4 swing high', pack.h4structure.lastHi, 'Swing high H4 — resistance utama.', { tf: 'H4', at: pack.h4structure.lastHiAt });
  (pack.h1eq && pack.h1eq.highs || []).slice(0, 2).forEach(x => add('EQH', 'H1 equal highs', x.price, 'Dua swing high H1 berdekatan — likuiditas di atas.', { tf: 'H1', at: x.at || isoAt(x.last) }));
  (pack.h1eq && pack.h1eq.lows || []).slice(0, 2).forEach(x => add('EQL', 'H1 equal lows', x.price, 'Dua swing low H1 berdekatan — likuiditas di bawah.', { tf: 'H1', at: x.at || isoAt(x.last) }));
  (pack.h4eq && pack.h4eq.highs || []).slice(0, 2).forEach(x => add('EQH', 'H4 equal highs', x.price, 'Dua swing high H4 berdekatan — likuiditas utama di atas.', { tf: 'H4', at: x.at || isoAt(x.last) }));
  (pack.h4eq && pack.h4eq.lows || []).slice(0, 2).forEach(x => add('EQL', 'H4 equal lows', x.price, 'Dua swing low H4 berdekatan — likuiditas utama di bawah.', { tf: 'H4', at: x.at || isoAt(x.last) }));
  /* ---------- Lapisan HTF 1D–4H + LTF 5m–1m ---------- */
  if (pack.mtf && pack.mtf.htf) {
    const h = pack.mtf.htf;
    add('HTF', 'HTF 1D–4H · ' + pack.direction, pack.price,
      'Direction ' + (h.direction ? h.direction.note : '—') + '; ' + (h.liquidity ? h.liquidity.note : '—') + '; ' + (h.supplyDemand ? h.supplyDemand.note : '—') + '. HTF hanya memberi arah/POI; entry tetap LIMIT di M5.',
      { tf: 'H4', at: pack.h4At, entryTf: 'M5', layer: 'HTF' });
    if (h.liquidity && h.liquidity.target != null) add('LIQ', 'HTF liquidity target', h.liquidity.target, h.liquidity.note, { tf: 'H4', at: pack.h4At });
  }
  if (pack.mtf && pack.mtf.ltf && pack.mtf.ltf.marker) {
    const c = pack.mtf.ltf.marker;
    add('CONFIRM', 'LTF ' + (c.src || 'M5') + ' confirmation · ' + c.label, c.price, c.why || c.label, { tf: c.src === 'M1' ? 'M1' : 'M5', at: c.at, entryTf: 'M5', layer: 'LTF' });
  }
  if (pack.smc && pack.smc.ok) {
    const smz = pack.smc;
    (smz.obs && smz.obs.d1 || []).filter(z => z.unmitigated).slice(-2).forEach(z => add('OB', 'D1 Order Block ' + (z.dir === 'BULLISH' ? 'demand' : 'supply'), z.dir === 'BULLISH' ? z.lo : z.hi, z.note, { zone: [z.lo, z.hi], side: z.dir.toLowerCase(), tf: 'D1', at: z.at }));
    (smz.fvg && smz.fvg.d1 || []).filter(z => z.unmitigated).slice(-2).forEach(z => add('FVG', 'D1 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, z.note, { zone: [z.lo, z.hi], side: z.kind, tf: 'D1', at: z.at }));
    if (smz.flow && smz.flow.h1 && smz.flow.h1.choch) add('CHoCH', 'H1 CHoCH/MSS ' + smz.flow.h1.choch.dir, smz.flow.h1.choch.level, smz.flow.h1.choch.note, { tf: 'H1', at: smz.flow.h1.choch.at });
    if (smz.flow && smz.flow.h4 && smz.flow.h4.choch) add('CHoCH', 'H4 CHoCH/MSS ' + smz.flow.h4.choch.dir, smz.flow.h4.choch.level, smz.flow.h4.choch.note, { tf: 'H4', at: smz.flow.h4.choch.at });
  }
  /* POI setup aktif diberi penanda khusus agar yang digambar chart = yang dipakai entry. */
  (pack.setups || []).forEach(s => {
    if (!s || s.status === 'LEWAT') return;
    add('POI', (s.order || ('LIMIT ' + s.dir)) + ' · ' + s.style + ' · ' + s.poiTf, s.entry, s.why, { tf: s.poiTf, at: s.poiAt, style: s.style, zone: s.zone, side: s.dir === 'BUY' ? 'demand' : 'supply', active: true, entryTf: s.entryTf || 'M5' });
    if (s.wick) add('WICK', 'Wick Entry ' + s.style + ' · ' + s.dir, s.wick.entry, s.wick.note + ' Entry LIMIT, bukan market chase.', { tf: 'M5', at: s.wick.at, style: s.style, zone: s.zone, side: s.dir === 'BUY' ? 'demand' : 'supply', active: true, entryTf: 'M5' });
    if (s.fvg50) add('FVG50', 'FVG 50% ' + s.style + ' · ' + s.dir, s.fvg50.entry, s.fvg50.note, { tf: 'M5', at: s.fvg50.at, style: s.style, zone: [s.fvg50.lo, s.fvg50.hi], side: s.dir === 'BUY' ? 'demand' : 'supply', active: true, entryTf: 'M5' });
  });
  if (pack.pdh != null) add('PDH', 'Previous Day High', pack.pdh, 'High hari sebelumnya — target likuiditas.', { tf: 'D1', at: pack.pdhAt });
  if (pack.pdl != null) add('PDL', 'Previous Day Low', pack.pdl, 'Low hari sebelumnya — target likuiditas.', { tf: 'D1', at: pack.pdlAt });
  if (pack.pools) {
    (pack.pools.highs || []).slice(0, 2).forEach(p => add('LIQ', 'Liquidity high', p, 'Titik stop buy/sell-side liquidity di atas harga.', { tf: 'M15', at: pack.pools.highAt && pack.pools.highAt[p] }));
    (pack.pools.lows || []).slice(0, 2).forEach(p => add('LIQ', 'Liquidity low', p, 'Titik stop buy/sell-side liquidity di bawah harga.', { tf: 'M15', at: pack.pools.lowAt && pack.pools.lowAt[p] }));
  }
  (pack.snd || []).forEach(z => add('SND', z.kind === 'demand' ? 'Demand zone' : 'Supply zone', z.kind === 'demand' ? z.hi : z.lo, z.why, { zone: [z.lo, z.hi], side: z.kind, tf: 'M15', at: z.at }));
  if (pack.mitigation) add('MB', 'Mitigation block', pack.mitigation.dir === 'BULLISH' ? pack.mitigation.hi : pack.mitigation.lo, pack.mitigation.why, { zone: [pack.mitigation.lo, pack.mitigation.hi], side: pack.mitigation.dir.toLowerCase(), tf: 'M15', at: pack.mitigation.at });
  (pack.eq && pack.eq.highs || []).slice(0, 2).forEach(x => add('EQH', 'Equal highs', x.price, 'Dua swing high berdekatan dalam toleransi ATR — likuiditas di atas.', { tf: 'M15', at: x.at || isoAt(x.last) }));
  (pack.eq && pack.eq.lows || []).slice(0, 2).forEach(x => add('EQL', 'Equal lows', x.price, 'Dua swing low berdekatan dalam toleransi ATR — likuiditas di bawah.', { tf: 'M15', at: x.at || isoAt(x.last) }));
  if (pack.sessionLevels && pack.sessionLevels.judas) add('JUDAS', 'Judas swing', pack.sessionLevels.judas.level, pack.sessionLevels.judas.why, { tf: 'M15', at: pack.sessionLevels.judas.at });
  if (pack.sessionLevels && pack.sessionLevels.asia) {
    add('ASIA', 'Asian range high', pack.sessionLevels.asia.hi, 'High sesi Asia — target sweep pertama.', { tf: 'M15', at: pack.sessionLevels.asia.hiAt });
    add('ASIA', 'Asian range low', pack.sessionLevels.asia.lo, 'Low sesi Asia — target sweep sisi bawah.', { tf: 'M15', at: pack.sessionLevels.asia.loAt });
  }
  if (pack.sessionLevels && pack.sessionLevels.dayOpen != null) add('DO', 'Daily open', pack.sessionLevels.dayOpen, 'Open hari ini (00:00 UTC) — bias intraday.', { tf: 'D1', at: pack.sessionLevels.dayOpenAt });
  if (pack.sessionLevels && pack.sessionLevels.weekOpen != null) add('WO', 'Weekly open', pack.sessionLevels.weekOpen, 'Open minggu ini — magnet likuiditas mingguan.', { tf: 'W1', at: pack.sessionLevels.weekOpenAt });
  if (pack.pdRange) add('PD', 'Premium/Discount · ' + pack.pdRange.zone, pack.pdRange.pos > 50 ? pack.pdRange.hi : pack.pdRange.pos < 50 ? pack.pdRange.lo : C.r2((pack.pdRange.hi + pack.pdRange.lo) / 2), 'Harga di ' + pack.pdRange.zone + ' (' + pack.pdRange.pos + '% dari range M15); gunakan retest untuk entry M5.', { tf: 'M15', at: pack.m15At, zone: [pack.pdRange.lo, pack.pdRange.hi] });
  if (pack.smt && pack.smt.dir) add('SMT', (pack.smt.tf || 'M15') + ' SMT divergence', pack.price, pack.smt.why, { tf: pack.smt.tf || 'M15', at: pack.smt.tf === 'D1' ? pack.d1At : pack.m15At });
  /* ---------- Mesin SMC/AMD: struktur, sweep, IDM, displacement, fib ---------- */
  if (pack.smc && pack.smc.ok) {
    const sm = pack.smc;
    if (sm.flow.m5.choch) add('CHoCH', 'M5 CHoCH/MSS ' + sm.flow.m5.choch.dir, sm.flow.m5.choch.level, sm.flow.m5.choch.note, { tf: 'M5', at: sm.flow.m5.choch.at });
    if (sm.flow.m15.choch) add('CHoCH', 'M15 CHoCH/MSS ' + sm.flow.m15.choch.dir, sm.flow.m15.choch.level, sm.flow.m15.choch.note, { tf: 'M15', at: sm.flow.m15.choch.at });
    if (sm.displacement) add('DISP', 'Displacement ' + sm.displacement.dir, pack.price, sm.displacement.note, { tf: 'M5', at: sm.displacement.at });
    if (sm.engulf && sm.engulf.m15) add('ENGULF', 'Engulfing M15 ' + sm.engulf.m15.dir, sm.engulf.m15.level, sm.engulf.m15.note, { tf: 'M15', at: sm.engulf.m15.at });
    if (sm.idm && sm.idm.idm != null) add('IDM', 'Inducement ' + (sm.idm.idmSwept === true ? 'sudah disapu' : sm.idm.idmSwept === false ? 'belum disapu' : 'terbaca'), sm.idm.idm, sm.idm.note, { tf: 'M5', at: sm.idm.at });
    if (sm.liq && sm.liq.sweep) add('SWEEP', 'SMC sweep ' + sm.liq.sweep.pool, sm.liq.sweep.level, sm.liq.sweep.note, { tf: 'M15', at: sm.liq.sweep.at });
    if (sm.amd && sm.amd.sweep) add('AMD', 'AMD ' + sm.amd.phase, sm.amd.sweep.level, sm.amd.note, { tf: 'M15', at: sm.amd.sweep.at });
    if (sm.bpr) add('BPR', 'Balanced Price Range', sm.bpr.lo, sm.bpr.note, { zone: [sm.bpr.lo, sm.bpr.hi], tf: 'M5', at: sm.bpr.at });
    if (sm.rejection) add('REJECT', 'Rejection block ' + (sm.rejection.dir === 'BULLISH' ? 'bullish' : 'bearish'), sm.rejection.mid, sm.rejection.note, { zone: [sm.rejection.lo, sm.rejection.hi], side: sm.rejection.dir.toLowerCase(), tf: 'M15', at: sm.rejection.at });
    (sm.ifvg || []).slice(-2).forEach(z => add('IFVG', 'Inversion FVG ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, z.note, { zone: [z.lo, z.hi], side: z.kind, tf: 'M5', at: z.at }));
    if (sm.irlErl && sm.irlErl.erlHigh != null) add('ERL', 'External range liquidity high', sm.irlErl.erlHigh, sm.irlErl.note, { tf: 'M15', at: pack.m15At });
    if (sm.irlErl && sm.irlErl.erlLow != null) add('ERL', 'External range liquidity low', sm.irlErl.erlLow, sm.irlErl.note, { tf: 'M15', at: pack.m15At });
    if (sm.fib && sm.fib.ok) add('FIB', 'Fib golden ' + sm.fib.tf + ' ' + sm.fib.dir, sm.fib.entry, sm.fib.steps.join(' '), { tf: sm.fib.tf, at: sm.fib.candle.at, zone: sm.fib.golden });
  }
  /* Buang duplikat (jenis + harga dalam 5 pip) supaya chart tidak menumpuk. */
  const seen = new Set();
  return m.filter(x => { const k = x.type + ':' + x.tf + ':' + Math.round(x.price / 0.5); if (seen.has(k)) return false; seen.add(k); return true; }).map((x, i) => ({ ...x, id: 'm' + (i + 1) }));
}

function priceShift(raw, anchor) { return raw && anchor ? C.r2(anchor - raw) : 0; }

/* ================== ENTRY M5 + TP KE LIKUIDITAS NYATA ================== */
/* Kumpulkan level likuiditas di sisi entry, kelompokkan yang berdekatan,
   lalu jadikan tangga TP. Tidak ada angka TP yang dikarang: semua dari
   swing M5/M15, EQH/EQL, PDH/PDL, sesi, pools, atau proyeksi ADR. */
function targetPool(pack, dir, entry) {
  const d = dir === 'BUY' ? 1 : -1;
  const raw = [];
  const add = (p, src) => {
    const n = Number(p);
    if (!isFinite(n)) return;
    const dist = (n - entry) * d;
    if (dist < 20 * PIP || dist > 700 * PIP) return;
    raw.push({ p: n, src });
  };
  const m5 = pack.m5structure || {};
  (m5.hi || []).slice(-5).forEach(p => add(p, 'swing high M5'));
  (m5.lo || []).slice(-5).forEach(p => add(p, 'swing low M5'));
  if (pack.structure) { add(pack.structure.lastHi, 'swing high M15'); add(pack.structure.lastLo, 'swing low M15'); }
  (pack.eq5 && pack.eq5.highs || []).forEach(x => add(x.price, 'EQH M5'));
  (pack.eq5 && pack.eq5.lows || []).forEach(x => add(x.price, 'EQL M5'));
  (pack.eq && pack.eq.highs || []).forEach(x => add(x.price, 'EQH M15'));
  (pack.eq && pack.eq.lows || []).forEach(x => add(x.price, 'EQL M15'));
  if (pack.pdh != null) add(pack.pdh, 'PDH');
  if (pack.pdl != null) add(pack.pdl, 'PDL');
  /* Likuiditas HTF: swing H1/H4 dan zona HTF. Ini yang membuat TP swing
     berbeda dari TP scalping, bukan sekadar batas angka. */
  if (pack.h1structure) { add(pack.h1structure.lastHi, 'swing high H1'); add(pack.h1structure.lastLo, 'swing low H1'); }
  if (pack.h4structure) { add(pack.h4structure.lastHi, 'swing high H4'); add(pack.h4structure.lastLo, 'swing low H4'); }
  if (pack.h1ob && pack.h1ob.dir === (dir === 'BUY' ? 'BULLISH' : 'BEARISH')) add(dir === 'BUY' ? pack.h1ob.hi : pack.h1ob.lo, 'OB H1');
  if (pack.h4ob && pack.h4ob.dir === (dir === 'BUY' ? 'BULLISH' : 'BEARISH')) add(dir === 'BUY' ? pack.h4ob.hi : pack.h4ob.lo, 'OB H4');
  (pack.h1eq && pack.h1eq.highs || []).forEach(x => add(x.price, 'EQH H1'));
  (pack.h1eq && pack.h1eq.lows || []).forEach(x => add(x.price, 'EQL H1'));
  (pack.h4eq && pack.h4eq.highs || []).forEach(x => add(x.price, 'EQH H4'));
  (pack.h4eq && pack.h4eq.lows || []).forEach(x => add(x.price, 'EQL H4'));
  if (pack.sessionLevels) {
    if (pack.sessionLevels.asia) { add(pack.sessionLevels.asia.hi, 'high Asia'); add(pack.sessionLevels.asia.lo, 'low Asia'); }
    if (pack.sessionLevels.dayOpen != null) add(pack.sessionLevels.dayOpen, 'daily open');
    if (pack.sessionLevels.weekOpen != null) add(pack.sessionLevels.weekOpen, 'weekly open');
  }
  (pack.pools && pack.pools.highs || []).forEach(p => add(p, 'liquidity high'));
  (pack.pools && pack.pools.lows || []).forEach(p => add(p, 'liquidity low'));
  if (pack.ote) { add(dir === 'BUY' ? pack.ote.long[1] : pack.ote.short[0], 'OTE M15'); }
  if (pack.pdRange) {
    const rng = pack.pdRange.hi - pack.pdRange.lo;
    add(dir === 'BUY' ? pack.pdRange.lo + rng * 0.5 : pack.pdRange.lo + rng * 0.5, 'equilibrium M15');
  }
  const rem = pack.adr && pack.adr.remainingPips;
  if (rem && rem >= 60) add(entry + d * Math.min(600, Math.max(60, rem)) * PIP, 'proyeksi ADR sisa ' + rem + ' pip');
  if (!raw.length) return [];
  raw.sort((a, b) => a.p - b.p);
  const clusters = [];
  raw.forEach(x => {
    const c = clusters[clusters.length - 1];
    if (c && Math.abs(c.sum / c.n - x.p) <= 1.2) { c.sum += x.p; c.n++; c.src.push(x.src); }
    else clusters.push({ sum: x.p, n: 1, src: [x.src] });
  });
  const out = clusters.map(c => {
    const price = c.sum / c.n;
    const pips = Math.round(Math.abs(price - entry) / PIP);
    const src = [...new Set(c.src)];
    return { price: C.r2(price), pips, src: src.slice(0, 3), strength: src.length };
  }).filter(x => x.pips >= 25 && x.pips <= 700).sort((a, b) => a.pips - b.pips);
  /* Jaminan minimal 2 target terukur (ATR M5), bukan angka acak. */
  const a = pack.atr5Pips || 30;
  if (!out.length) {
    const pips = Math.max(60, Math.min(300, a * 4));
    out.push({ price: C.r2(entry + d * pips * PIP), pips, src: ['proyeksi 4×ATR M5'], strength: 1 });
  }
  if (out.length === 1) {
    const pips = Math.max(out[0].pips + 120, Math.min(680, a * 8));
    out.push({ price: C.r2(entry + d * pips * PIP), pips, src: ['proyeksi 8×ATR M5'], strength: 1 });
  }
  return out.sort((x, y) => x.pips - y.pips);
}

/* ================== SETUP PER MODE (top-down Alchemist) ==================
   SCALPING : H1/M15 bias + POI M5 + trigger M5, target 45–220 pip.
   DAY      : H4/H1/M15 bias + POI M15 + trigger M5, target 90–450 pip.
   SWING    : D1/H4 bias + POI H4/H1 + trigger M5, target 150–650 pip.
   Semua entry tetap M5, SL 30 pip. Mode yang HTF-nya tidak searah tidak
   dipaksakan; lebih baik tidak ada setup daripada entry melawan bias. */
function modeBias(pack, style, sign) {
  const rec = k => pack.tv && pack.tv.tf && pack.tv.tf[k] ? pack.tv.tf[k].rec : null;
  const struct = k => k === 'D1' ? (pack.daily ? pack.daily.trend : null)
    : k === 'H4' ? (pack.h4structure ? pack.h4structure.trend : null)
      : k === 'H1' ? (pack.h1structure ? pack.h1structure.trend : null) : null;
  const tfFor = k => k === 'D1' ? 'D' : k === 'H4' ? '240' : k === 'H1' ? '60' : '15';
  const need = style === 'SWING' ? ['D1', 'H4'] : style === 'DAY' ? ['H4', 'H1'] : ['H1'];
  const items = need.map(k => ({ tf: k, rec: rec(tfFor(k)), trend: struct(k) }));
  const trendSign = t => t === 'naik' || t === 'BULLISH' ? 1 : t === 'turun' || t === 'BEARISH' ? -1 : 0;
  /* Bila rekomendasi TradingView tidak tersedia, struktur candle HTF yang
     searah masih boleh menjadi bias. Dulu rec null langsung mematikan semua
     setup, sehingga gangguan scanner membuat tab tidak punya sinyal sama
     sekali meski candle dan SMC valid. */
  const recOk = items.every(x => x.rec != null ? x.rec * sign >= -0.12 : trendSign(x.trend) * sign > 0);
  const structOk = items.every(x => {
    const ts = trendSign(x.trend);
    return !x.trend || x.trend === 'RANGE' || ts * sign > 0;
  });
  const ok = recOk && structOk;
  return {
    ok, items,
    why: items.map(x => x.tf + ' ' + (x.rec == null ? '—' : x.rec.toFixed(2)) + (x.trend ? '/' + x.trend : '')).join(' · ')
  };
}

function modeZones(pack, style, dir) {
  const bull = dir === 'BUY', out = [];
  const add = (tf, kind, lo, hi, src, why, at) => {
    if (lo == null || hi == null || !(hi >= lo)) return;
    if (bull ? kind !== 'demand' : kind !== 'supply') return;
    out.push({ tf, kind, lo: C.r2(lo), hi: C.r2(hi), entry: C.r2(bull ? hi : lo), src, why, at: at || null });
  };
  const fv = (arr, tf) => (arr || []).filter(z => z.kind === (bull ? 'bull' : 'bear')).slice(-2).forEach(z => add(tf, bull ? 'demand' : 'supply', z.lo, z.hi, 'FVG ' + tf, 'Fair Value Gap ' + tf + ' ' + z.lo + '–' + z.hi, z.at));
  const ob = (o, tf) => { if (o && o.dir === (bull ? 'BULLISH' : 'BEARISH')) add(tf, bull ? 'demand' : 'supply', o.lo, o.hi, 'OB ' + tf, 'Order block ' + tf + ' (' + (o.strength || '—') + '× ATR)', o.at); };
  if (style === 'SCALPING') {
    fv(pack.m5fvgs, 'M5'); ob(pack.m5ob, 'M5'); fv(pack.fvgs, 'M15'); ob(pack.ob, 'M15');
  } else if (style === 'DAY') {
    fv(pack.fvgs, 'M15'); ob(pack.ob, 'M15'); fv(pack.h1fvgs, 'H1'); ob(pack.h1ob, 'H1');
  } else {
    fv(pack.h4fvgs, 'H4'); ob(pack.h4ob, 'H4'); fv(pack.h1fvgs, 'H1'); ob(pack.h1ob, 'H1');
  }
  (pack.snd || []).forEach(z => add(style === 'SWING' ? 'H4' : 'M15', z.kind, z.lo, z.hi, 'SND ' + (style === 'SWING' ? 'H4' : 'M15'), z.why, z.at));
  if (pack.ote) {
    const z = bull ? pack.ote.long : pack.ote.short;
    add(style === 'SWING' ? 'H4' : 'M15', bull ? 'demand' : 'supply', z[0], z[1], 'OTE', 'Optimal Trade Entry 62–79%', pack.ote.at);
  }
  return out;
}

/* Langkah entry yang bisa diaudit. Semua angka berasal dari zona, sweep,
   dan target yang sudah dihitung mesin — bukan narasi karangan. */
function entrySteps(pack, z, chk, stopRef, tgt) {
  const dir = pack.direction === 'SELL' ? 'SELL' : 'BUY';
  const buy = dir === 'BUY';
  const limitOrder = buy ? 'LIMIT BUY' : 'LIMIT SELL';
  const sm = pack.smc || {};
  const sl = C.r2(z.entry - (buy ? 1 : -1) * SL_PIPS * PIP);
  const optional = [];
  if (sm.grab) optional.push('liquidity grab ' + sm.grab.dir);
  if (sm.breaker) optional.push(sm.breaker.kind + ' ' + sm.breaker.lo + '–' + sm.breaker.hi);
  if (sm.flip && sm.flip.dir !== 'RANGE') optional.push(sm.flip.pattern);
  if (sm.idm && sm.idm.idmSwept) optional.push('IDM ' + sm.idm.idm + ' sudah disapu');
  const mtf = pack.mtf || {}, htf = mtf.htf || {}, mid = mtf.mid || {}, ltf = mtf.ltf || {}, gate = mtf.gate || {};
  return [
    '1. HTF 1D–4H (direction, liquidity, supply/demand): ' + (htf.direction ? htf.direction.note : (sm.htf ? sm.htf.note : 'struktur HTF belum terbaca')) + '; likuiditas ' + (htf.liquidity ? htf.liquidity.note : '—') + '; zona ' + (htf.supplyDemand ? htf.supplyDemand.note : '—') + '. Selama HTF ' + (buy ? 'tidak bearish' : 'tidak bullish') + ', hanya cari ' + dir + '.',
    '2. MTF 1H–15m (trend, break, reversal, OB/FVG, liquidity): ' + (mid.trend ? mid.trend.note : '—') + '; break ' + ((mid.breaks || []).map(x => x.tf + ' ' + x.kind).join(' / ') || '—') + '; reversal ' + ((mid.reversals || []).map(x => x.tf + ' ' + x.kind).join(' / ') || '—') + '; POI ' + (mid.poi ? mid.poi.note : '—') + '; ' + (mid.liquidity ? mid.liquidity.note : '—') + '. AMD fase ' + (sm.amd ? sm.amd.phase : '—') + '.',
    '3. Dealing range/PD: harga ' + (sm.pd ? sm.pd.zone + ' ' + sm.pd.pos + '% dari ' + sm.pd.lo + '–' + sm.pd.hi : '—') + '; ' + (buy ? 'BUY wajib di discount, OTE long ' + (sm.pd ? sm.pd.oteLong.join('–') : '61.8–78.6%') : 'SELL wajib di premium, OTE short ' + (sm.pd ? sm.pd.oteShort.join('–') : '61.8–78.6%')) + '.',
    '4. POI terpilih: ' + z.src + ' ' + z.lo + '–' + z.hi + ' (' + z.tf + ')' + (z.pattern ? '; pola ' + z.pattern.label : '') + (z.wick ? '; pucuk wick M5 ' + z.wick.entry + ' (' + z.wick.wickPips + ' pip, close kembali)' : z.fvg50 ? '; 50% FVG ' + z.fvg50.entry + ' (' + z.fvg50.lo + '–' + z.fvg50.hi + ')' : '') + (stopRef ? '; likuiditas struktur ' + stopRef.level + ' (' + stopRef.pips + ' pip dari entry)' : '') + '.',
    '5. Inducement & MSS: IDM ' + (sm.idm ? (sm.idm.idmSwept === true ? 'sudah disapu' : sm.idm.idmSwept === false ? 'belum disapu — tunggu' : 'terbaca') : 'belum terbaca') + '; konfirmasi CHoCH/BOS/MSS M5 (body tembus area candle terdekat) + displacement/FVG, atau engulfing M15 yang dikonfirmasi M5. Jangan entry sebelum candle M5 close.',
    '6. Fib momentum: ' + (sm.fib ? (sm.fib.ok ? 'candle terpanjang ' + sm.fib.tf + ', golden ' + sm.fib.golden.join('–') + ', zona M5 ' + (sm.fib.m5zone ? sm.fib.m5zone.lo + '–' + sm.fib.m5zone.hi : '—') + ', sweep ' + (sm.fib.sweepLevel == null ? '—' : sm.fib.sweepLevel) : 'belum ada candle momentum valid — fib hanya referensi') : 'mesin fib tidak tersedia') + '. Setting fib: limit 70, SL 100, TP -15.',
    '7. Waktu: ' + (sm.killzone && sm.killzone.active ? sm.killzone.name + ' aktif (' + sm.killzone.wib + ')' : 'di luar kill zone — jalur eksekusi memakai fib OTE; ' + (chk.timingOk ? 'terpenuhi' : 'belum terpenuhi')) + '.',
    '8. Konfluensi aktif: ' + [...chk.checks.filter(c => c.ok).map(c => c.label), ...optional].slice(0, 10).join('; ') + '.',
    '9. Konfirmasi LTF 5m–1m: ' + (ltf.note || '—') + '. Eksekusi ' + (z.wick ? 'PENDING ' : z.fvg50 ? 'PENDING ' : '') + limitOrder + ' di ' + z.entry + ' · ' + (z.wick ? 'pucuk wick M5 yang sudah close; ' : z.fvg50 ? '50% FVG M5; ' : 'tepi zona POI/M5; ') + 'bukan market chase · SL ' + sl + ' (30 pip) · TP2 ' + (tgt ? tgt.price + ' (' + tgt.pips + ' pip)' : '≥200 pip') + ' · TPmax di likuiditas berikutnya.',
    '10. Batal: M5 close di luar zona, sweep ' + (stopRef ? stopRef.level : '—') + ' dilanggar, atau harga sudah >3 ATR dari POI. Gerbang MTF: ' + (gate.note || '—') + ' Status SMC: ' + chk.grade + ' (' + chk.optional + '/' + chk.optionalTotal + ' konfirmasi).'
  ];
}

/* Entry di pucuk/wick candle rejection M5: hanya dipakai bila candle sudah
   close kembali ke dalam range dan masih berada dekat POI. Ini bukan chase:
   entry tetap LIMIT di harga wick, bukan MARKET setelah candle lari. */
function wickEntryOf(pack, dir, zone) {
  const allRows = (pack && pack.chart && pack.chart.m5) || [];
  /* Hanya candle M5 yang sudah CLOSE. Candle berjalan bisa berubah wick dan
     membuat entry pucuk tidak valid; jangan memakai repaint. */
  const rows = allRows.filter(r => r && isFinite(Number(r.t)) && Number(r.t) + 300000 <= Date.now());
  if (rows.length < 8 || !zone) return null;
  const shift = Number(pack.chart && pack.chart.shift) || 0;
  const atr = Number(pack.atr5) || 1;
  const price = Number(pack.price);
  const buy = dir === 'BUY';
  if (!(price > 0)) return null;
  const zLo = Math.min(Number(zone.lo), Number(zone.hi));
  const zHi = Math.max(Number(zone.lo), Number(zone.hi));
  if (!isFinite(zLo) || !isFinite(zHi)) return null;
  for (let i = rows.length - 1; i >= Math.max(1, rows.length - 6); i--) {
    const raw = rows[i];
    if (!raw || !isFinite(raw.h) || !isFinite(raw.l)) continue;
    const r = { ...raw, o: raw.o + shift, h: raw.h + shift, l: raw.l + shift, c: raw.c + shift };
    const body = Math.abs(r.c - r.o), rng = r.h - r.l;
    if (!(rng > 0)) continue;
    const upper = r.h - Math.max(r.o, r.c), lower = Math.min(r.o, r.c) - r.l;
    const near = r.h >= zLo - atr * 1.2 && r.l <= zHi + atr * 1.2;
    if (!near) continue;
    if (buy) {
      const wick = lower;
      if (!(wick >= Math.max(body * 1.8, atr * 0.55))) continue;
      if (!(r.c >= r.l + rng * 0.45)) continue;
      if (!(r.l <= price + 0.2)) continue;
      if (Math.abs(price - r.l) > Math.max(3, atr * 3)) continue;
      return {
        entry: C.r2(r.l), level: C.r2(r.l), at: isoAt(r.t), kind: 'WICK', side: 'low',
        wickPips: Math.round(wick / PIP), candlePips: Math.round(rng / PIP),
        note: 'Wick bawah M5 ' + C.r2(r.l) + ' (' + Math.round(wick / PIP) + ' pip) close kembali di ' + C.r2(r.c) + '; LIMIT BUY di pucuk wick, bukan chase.'
      };
    }
    const wick = upper;
    if (!(wick >= Math.max(body * 1.8, atr * 0.55))) continue;
    if (!(r.c <= r.h - rng * 0.45)) continue;
    if (!(r.h >= price - 0.2)) continue;
    if (Math.abs(price - r.h) > Math.max(3, atr * 3)) continue;
    return {
      entry: C.r2(r.h), level: C.r2(r.h), at: isoAt(r.t), kind: 'WICK', side: 'high',
      wickPips: Math.round(wick / PIP), candlePips: Math.round(rng / PIP),
      note: 'Wick atas M5 ' + C.r2(r.h) + ' (' + Math.round(wick / PIP) + ' pip) close kembali di ' + C.r2(r.c) + '; LIMIT SELL di pucuk wick, bukan chase.'
    };
  }
  return null;
}

/* Entry alternatif di 50% FVG (equilibrium) setelah sweep + MSS/BOS.
   Dipakai hanya bila tidak ada rejection wick yang sudah close; bukan chase. */
function fvg50Of(pack, dir, zone) {
  if (!pack || !zone) return null;
  const buy = dir === 'BUY';
  const list = [...(pack.m5fvgs || []), ...((pack.smc && pack.smc.fvg && pack.smc.fvg.m5) || [])]
    .filter(z => z && isFinite(Number(z.lo)) && isFinite(Number(z.hi)) && Number(z.hi) >= Number(z.lo))
    .filter(z => z.kind === (buy ? 'bull' : 'bear'))
    .map(z => ({ ...z, mid: C.r2((Number(z.lo) + Number(z.hi)) / 2) }));
  if (!list.length) return null;
  const target = Number(zone.entry);
  const zLo = Math.min(Number(zone.lo), Number(zone.hi)), zHi = Math.max(Number(zone.lo), Number(zone.hi));
  list.sort((a, b) => {
    const aOverlap = a.hi >= zLo - 0.2 && a.lo <= zHi + 0.2 ? 0 : 1;
    const bOverlap = b.hi >= zLo - 0.2 && b.lo <= zHi + 0.2 ? 0 : 1;
    return aOverlap - bOverlap || Math.abs(a.mid - target) - Math.abs(b.mid - target);
  });
  const f = list[0];
  const atr = Number(pack.atr5) || 1;
  if (!(f.mid > 0) || Math.abs(Number(pack.price) - f.mid) > Math.max(3, atr * 4)) return null;
  if (f.mid < zLo - atr * 0.6 || f.mid > zHi + atr * 0.6) return null;
  return {
    entry: f.mid, lo: C.r2(f.lo), hi: C.r2(f.hi), mid: f.mid, kind: 'FVG50',
    at: f.at || null,
    note: 'FVG ' + (buy ? 'bullish' : 'bearish') + ' ' + f.lo + '–' + f.hi + '; entry di 50% (equilibrium) ' + f.mid + '. Limit, bukan chase.'
  };
}

function patternOf(pack, dir, zone, wick, fvg50) {
  const buy = dir === 'BUY';
  const aligned = x => !!x && ((buy && x.dir === 'BULLISH') || (!buy && x.dir === 'BEARISH'));
  const sweep = (pack.m5sweep && ((buy && pack.m5sweep.kind === 'low') || (!buy && pack.m5sweep.kind === 'high'))) ? pack.m5sweep
    : (pack.smc && pack.smc.liq && pack.smc.liq.sweep && ((buy && pack.smc.liq.sweep.kind === 'low') || (!buy && pack.smc.liq.sweep.kind === 'high'))) ? pack.smc.liq.sweep : null;
  const mss = aligned(pack.m5bos) ? pack.m5bos
    : (pack.smc && pack.smc.flow && pack.smc.flow.m5 && aligned(pack.smc.flow.m5.choch)) ? pack.smc.flow.m5.choch : null;
  const fvg = fvg50 || (pack.m5fvgs || []).filter(z => z && z.kind === (buy ? 'bull' : 'bear')).slice(-1)[0] || null;
  if (!sweep || !mss || !fvg) return null;
  const label = 'M5 sweep → MSS → FVG 50%';
  return {
    label,
    sweep: { level: sweep.level, kind: sweep.kind, note: sweep.note || sweep.why || '' },
    mss: { level: mss.level, dir: mss.dir, kind: mss.kind || 'MSS', note: mss.note || '' },
    fvg: fvg50 ? { lo: fvg50.lo, hi: fvg50.hi, mid: fvg50.mid } : { lo: fvg.lo, hi: fvg.hi },
    entry50: fvg50 ? fvg50.entry : null,
    note: label + (fvg50 ? '; FVG ' + fvg50.lo + '–' + fvg50.hi + ', 50% ' + fvg50.entry : '') + '; entry final ' + (wick ? 'di pucuk wick ' + wick.entry : zone.entry) + '.'
  };
}

function buildModeSetups(pack, dir) {
  if (dir !== 'BUY' && dir !== 'SELL') return [];
  const sign = dir === 'BUY' ? 1 : -1;
  const atr = pack.atr5 || 2.5;
  const trigger = (() => {
    if (pack.m5bos && (pack.m5bos.dir === 'BULLISH') === (dir === 'BUY')) return { ok: true, why: 'BOS M5 ' + pack.m5bos.dir + ' @ ' + pack.m5bos.level };
    if (pack.m5sweep && ((pack.m5sweep.kind === 'low') === (dir === 'BUY'))) return { ok: true, why: 'sweep likuiditas M5 sisi ' + pack.m5sweep.kind + ' @ ' + pack.m5sweep.level };
    const z = (pack.m5fvgs || []).filter(x => x.kind === (dir === 'BUY' ? 'bull' : 'bear')).slice(-1)[0];
    if (z) return { ok: true, why: 'FVG M5 ' + z.lo + '–' + z.hi };
    if (pack.m5ob && (pack.m5ob.dir === 'BULLISH') === (dir === 'BUY')) return { ok: true, why: 'OB M5 ' + pack.m5ob.dir };
    if (pack.smc && pack.smc.engulf && pack.smc.engulf.m15 && (pack.smc.engulf.m15.dir === 'BULLISH') === (dir === 'BUY')) return { ok: true, why: 'Engulfing M15 ' + pack.smc.engulf.m15.dir + ' @ ' + pack.smc.engulf.m15.level };
    return { ok: false, why: 'belum ada BOS/sweep/FVG/OB/engulfing M5-M15 searah ' + dir };
  })();
  const modes = [
    ['SCALPING', 45, 220, 'H1/M15'],
    ['DAY', 90, 450, 'H4/H1/M15'],
    ['SWING', 150, 650, 'D1/H4']
  ];
  const out = [];
  const usedEntries = [];
  const pref = style => style === 'SCALPING' ? { M5: 0, M15: 1, H1: 2, H4: 3 }
    : style === 'DAY' ? { M15: 0, H1: 1, M5: 2, H4: 3 }
      : { H4: 0, H1: 1, M15: 2, M5: 3 };
  modes.forEach(([style, minPips, maxPips, biasLabel]) => {
    const bias = modeBias(pack, style, sign);
    if (!bias.ok) return;
    const rank = pref(style);
    const zones = modeZones(pack, style, dir)
      .filter(z => {
        const dist = (pack.price - z.entry) * sign;
        return dist >= -0.2 * atr && dist <= 4 * atr;
      })
      .sort((a, b) => ((rank[a.tf] || 0) - (rank[b.tf] || 0)) * atr * 0.8 + Math.abs(pack.price - a.entry)
        - (((rank[b.tf] || 0) - (rank[a.tf] || 0)) * atr * 0.8 + Math.abs(pack.price - b.entry)));
    const z = zones.find(x => !usedEntries.some(u => Math.abs(u - x.entry) < 0.5)) || zones[0];
    if (!z) return;
    usedEntries.push(z.entry);
    /* Refinement: POI HTF diperkecil ke OB/FVG M5 di dalamnya. */
    const refined = S.refineZone(pack.smc, dir, z);
    if (refined) {
      z.lo = refined.lo; z.hi = refined.hi; z.entry = refined.entry;
      z.tf = refined.tf; z.src = z.src + ' → ' + refined.src;
      z.why = z.why + ' (' + refined.note + ')';
    }
    /* Prioritaskan rejection wick M5 yang sudah close di dalam POI. Bila tidak
       ada, pakai 50% FVG (equilibrium) bila pola sweep + MSS tersedia; selain
       itu tetap tepi zona. Tipe tetap LIMIT dan arah tidak berubah. */
    const fvg50 = fvg50Of(pack, dir, z);
    const wick = wickEntryOf(pack, dir, z);
    /* Pola harus lengkap (sweep + MSS/BOS + FVG) sebelum 50% FVG boleh
       menggantikan tepi zona. Tanpa pola, FVG 50% hanya referensi visual. */
    const pattern = patternOf(pack, dir, z, wick, fvg50);
    if (wick) {
      z.entry = wick.entry; z.wick = wick;
      if (fvg50 && pattern) z.fvg50 = fvg50;
      z.why = z.why + '; ' + wick.note + (pattern && fvg50 ? ' Referensi FVG 50% ' + fvg50.entry + '.' : '');
    } else if (fvg50 && pattern) {
      z.entry = fvg50.entry; z.fvg50 = fvg50;
      z.why = z.why + '; ' + fvg50.note;
    }
    z.pattern = pattern;
    const stopRef = S.stopReference(pack.smc, dir, z.entry);
    const fresh = pack.marketOpen !== false && pack.freshness && pack.freshness.candleAgeMin != null && pack.freshness.candleAgeMin <= 10;
    const chk = S.assess(pack.smc, dir, {
      price: pack.price, entry: z.entry, zone: z,
      eventRisk: pack.eventRisk, fresh, stopPips: stopRef ? stopRef.pips : null
    });
    const pool = targetPool(pack, dir, z.entry)
      .filter(t => t.pips >= Math.max(minPips, Math.ceil(SL_PIPS * 1.5)) && t.pips <= maxPips)
      .sort((a, b) => a.pips - b.pips);
    if (!pool.length) return;
    const tp1 = pool[0];
    /* Jika likuiditas nyata berikutnya belum ada di dalam batas mode, jangan
       menampilkan TP2 = TP1. Pakai proyeksi ATR yang diberi label eksplisit. */
    let tp2 = pool.find(t => t.pips >= tp1.pips + 60);
    if (!tp2 && maxPips >= tp1.pips + 60) {
      const p2 = Math.min(maxPips - 60, Math.max(tp1.pips + 60, Math.round((pack.atr5Pips || 30) * 6)));
      if (p2 > tp1.pips) tp2 = { price: C.r2(z.entry + sign * p2 * PIP), pips: p2, src: ['proyeksi ATR M5'], strength: 1 };
    }
    if (!tp2) tp2 = tp1;
    const MIN_TP2_PIPS = TP2_PIPS;
    if (tp2.pips < MIN_TP2_PIPS) {
      tp2 = { price: C.r2(z.entry + sign * MIN_TP2_PIPS * PIP), pips: MIN_TP2_PIPS, src: ['minimum TP2 200 pip'], strength: 1 };
    }
    /* Jangan pernah mengunci lebih awal di TP1 < 200 pip. */
    tp1.price = tp2.price; tp1.pips = tp2.pips; tp1.src = tp2.src; tp1.strength = tp2.strength;
    let tpMax = pool[pool.length - 1];
    if (tpMax.pips <= tp2.pips && maxPips > tp2.pips + 30) {
      const pm = Math.min(maxPips, Math.max(tp2.pips + 60, Math.round((pack.atr5Pips || 30) * 9)));
      if (pm > tp2.pips) tpMax = { price: C.r2(z.entry + sign * pm * PIP), pips: pm, src: ['proyeksi ATR M5'], strength: 1 };
    }
    /* TP pertama yang ditampilkan adalah TP2 minimal 200 pip. Field tp1
       internal dipakai evaluasi riwayat, tetapi UI tidak menampilkan TP1. */
    const primary = { ...tp2 };
    const allTargets = [...pool.filter(t => t.pips >= MIN_TP2_PIPS), primary];
    if (tpMax.pips <= tp2.pips) tpMax = { price: C.r2(tp2.price + sign * 60 * PIP), pips: tp2.pips + 60, src: ['proyeksi 60 pip setelah TP2'], strength: 1 };
    if (!allTargets.some(t => Math.abs(t.price - tp2.price) < 0.01)) allTargets.push(tp2);
    if (!allTargets.some(t => Math.abs(t.price - tpMax.price) < 0.01)) allTargets.push(tpMax);
    allTargets.sort((a, b) => a.pips - b.pips);
    const dedupedTargets = allTargets.filter((t, i, a) => a.findIndex(x => Math.abs(Number(x.pips) - Number(t.pips)) < 1) === i);
    const dist = Math.abs(pack.price - z.entry);
    const distPips = Math.round(dist / PIP);
    const minEntryPrice = Math.max(MIN_ENTRY_PIPS * PIP, atr * 0.9);
    const minEntryPips = Math.max(MIN_ENTRY_PIPS, Math.round(minEntryPrice / PIP));
    const tooClose = dist < minEntryPrice;
    /* Konfluensi semua metode: entry tidak boleh SIAP hanya karena satu sinyal. */
    const confluenceOk = !pack.methods || (Number(pack.methods.agreement) >= 40 && Number(pack.methods.agree) >= 2);
    /* Level entry/SL/TP yang valid tetap ditampilkan sebagai rencana LIMIT
       (PENDING), bukan disembunyikan sebagai "tunggu". Status TUNGGU hanya
       dipakai bila levelnya memang tidak layak dieksekusi. */
    /* Rencana LIMIT tetap ditampilkan bila minimal 2 metode searah, meskipun
       konfluensi berbobot rendah. Statusnya PENDING (bukan SIAP) dan alasannya
       ditulis jujur; menyembunyikannya membuat tab terlihat "tidak ada sinyal"
       padahal level entry/SL/TP sudah valid. */
    const closed = pack.marketOpen === false;
    /* Saat market tutup, level tetap boleh tampil sebagai PENDING untuk
       pembukaan berikutnya. Sebelumnya semua rencana dipaksa TUNGGU hanya
       karena candle terakhir berasal dari sesi yang sudah selesai. */
    const planValid = (fresh || closed) && dist <= atr * 4 && (confluenceOk || (pack.methods && Number(pack.methods.agree) >= 2));
    const mtfGate = pack.mtf && pack.mtf.gate ? pack.mtf.gate : null;
    const mtfReady = !mtfGate || mtfGate.ok === true;
    /* Level boleh tetap ditampilkan sebagai rencana, tetapi status SIAP hanya
       diberikan bila HTF 1D–4H, MTF 1H–15m, dan LTF 5m–1m semuanya selaras. */
    const status = !planValid || !mtfReady ? 'TUNGGU' : fresh && chk.executable && !tooClose ? 'SIAP' : 'PENDING';
    /* Entry selalu pending LIMIT. Tidak ada MARKET yang mengejar candle live. */
    const type = 'LIMIT';
    let statusWhy;
    const planBase = 'Rencana level LIMIT di ' + z.tf + ' ' + z.entry + ' (SL 30 pip, TP2 ' + tp2.pips + ' pip).';
    if (!mtfReady) {
      statusWhy = planBase + ' Gerbang multi-TF belum lengkap: ' + (mtfGate.missing || []).join(', ') + '. Level limit tetap boleh dipantau, tetapi jangan dieksekusi sebelum arah 1D–4H, struktur 1H–15m, dan konfirmasi 5m–1m selaras.';
    } else if (!fresh) {
      statusWhy = closed
        ? (status === 'PENDING' ? planBase + ' Market sedang tutup; ini rencana LIMIT untuk pembukaan berikutnya, bukan entry saat ini. Validasi ulang candle M5 saat market buka.' : 'Market sedang tutup dan level belum layak; tunggu candle pembukaan sebelum menyusun limit.')
        : 'Candle M5 belum segar; rencana belum bisa dipakai sampai candle baru muncul.';
    } else if (status === 'SIAP') {
      statusWhy = (wick ? 'Entry LIMIT di pucuk wick ' + wick.entry + ' (wick ' + wick.wickPips + ' pip, sudah close kembali); ' : fvg50 ? 'Entry LIMIT di 50% FVG ' + fvg50.entry + '; ' : 'Entry LIMIT ') + distPips + ' pip dari harga (minimal ' + minEntryPips + ' pip) — HTF/MTF/LTF selaras dan syarat eksekusi lengkap. SMC ' + chk.grade + (z.pattern ? ' · ' + z.pattern.label : '') + '.';
    } else if (status === 'PENDING') {
      if (!trigger.ok) statusWhy = planBase + ' Trigger M5 belum searah (' + trigger.why + '); pasang limit di zona atau tunggu candle konfirmasi.';
      else if (!confluenceOk) statusWhy = planBase + ' Konfluensi metode rendah: ' + (pack.methods ? pack.methods.note : 'metode belum lengkap') + '. Ini rencana limit berisiko; tunggu minimal 2 metode searah sebelum eksekusi.';
      else if (tooClose) statusWhy = planBase + ' Entry hanya ' + distPips + ' pip dari harga (minimal ' + minEntryPips + ' pip); pasang limit di zona atau tunggu pullback, jangan chase.';
      else if (!chk.ready) statusWhy = planBase + ' Menunggu konfirmasi SMC ' + chk.grade + ': ' + chk.missing.slice(0, 4).join(', ') + '. ' + chk.note;
      else statusWhy = planBase + ' Syarat SMC ' + chk.grade + ' sudah siap, tetapi eksekusi menunggu: ' + chk.blockers.join('; ') + '. Jalur ' + (chk.path || '—') + '.';
    } else if (!trigger.ok) {
      statusWhy = 'Trigger M5 belum searah; ' + trigger.why + '.';
    } else if (!confluenceOk) {
      statusWhy = 'Konfluensi metode belum cukup: ' + (pack.methods ? pack.methods.note : 'metode teknikal tidak lengkap') + '. Rencana belum ditampilkan sebagai entry.';
    } else {
      statusWhy = 'Harga sudah ' + distPips + ' pip dari zona; setup tidak lagi dekat POI.';
    }
    let conf = Math.max(30, Math.min(96,
      50 + (bias.ok ? 8 : 0) + (trigger.ok ? 12 : 0) + (z.tf === 'M15' || z.tf === 'H1' || z.tf === 'H4' ? 8 : 3) + (tp1.pips >= TP2_PIPS ? 8 : 3) + (confluenceOk ? 3 : 0) +
      (chk.grade === 'A+' ? 9 : chk.grade === 'A' ? 6 : chk.grade === 'B' ? 2 : -4) + Math.min(4, chk.optional)
    ));
    /* Keyakinan tidak boleh tinggi bila syarat wajib SMC belum lengkap atau
       konfluensi metode masih rendah. PENDING tetap tampil, tetapi angkanya
       jujur supaya tidak terbaca seperti sinyal berkualitas tinggi. */
    if (!confluenceOk) conf = Math.min(conf, 45);
    else if (!chk.ready) conf = Math.min(conf, 55);
    else if (!chk.executable) conf = Math.min(conf, 68);
    if (!mtfReady) conf = Math.min(conf, 48);
    const sl = C.r2(z.entry - sign * SL_PIPS * PIP);
    const order = dir === 'BUY' ? 'LIMIT BUY' : 'LIMIT SELL';
    out.push({
      style, dir, entryTf: 'M5', poiTf: z.tf, poiAt: z.at || null, entry: z.entry, zone: [z.lo, z.hi], sl, tp1: tp1.price, tp2: tp2.price, tpMax: tpMax.price,
      order, execution: 'LIMIT', entryAt: z.at || null,
      entryMode: wick ? 'WICK' : z.fvg50 ? 'FVG50' : 'ZONE', wick: wick || null, fvg50: z.fvg50 || null,
      pattern: z.pattern || null,
      timing: chk.timingOk, confluence: chk.checks.filter(c => c.ok).map(c => c.label),
      slPips: SL_PIPS, tpPips: tp1.pips, tp2Pips: tp2.pips, tpMaxPips: tpMax.pips,
      entryDistancePips: distPips, minEntryPips, tooClose, statusWhy,
      rr: Math.round(tp1.pips / SL_PIPS * 10) / 10,
      targets: dedupedTargets.slice(0, 5).map(t => ({ price: t.price, pips: t.pips, src: t.src.join(' + '), strength: t.strength })),
      status, type, conf, bias: bias.items, trigger: trigger.why, poi: z.src,
      why: style + ' ' + dir + ' — ' + biasLabel + ' bias (' + bias.why + '); POI ' + z.tf + ' ' + z.src + ' @ ' + z.entry + ' (' + z.why + '); trigger: ' + trigger.why + '; ' + (z.pattern ? 'pola ' + z.pattern.label + '; ' : '') + 'SMC ' + chk.grade + ' (' + chk.optional + '/' + chk.optionalTotal + ' konfirmasi); ' + (wick ? 'entry di pucuk wick M5 yang sudah close, ' : fvg50 ? 'entry di 50% FVG, ' : 'entry di tepi zona, ') + 'TP2/TPmax minimal 200 pip dari likuiditas/proyeksi yang dilabeli (' + tp1.src.join(' + ') + '); ' + statusWhy,
      invalidation: 'M5 close di luar zona ' + z.tf + ' atau menembus SL ' + sl + '. Batal juga bila sweep ' + (stopRef ? stopRef.level : '—') + ' ditembus.',
      valid: status !== 'TUNGGU', risk: 3,
      smc: {
        grade: chk.grade, score: chk.score, ready: chk.ready, executable: chk.executable,
        optional: chk.optional, optionalTotal: chk.optionalTotal,
        checks: chk.checks, missing: chk.missing, blockers: chk.blockers, note: chk.note,
        path: chk.path, stopWide: chk.stopWide,
        phase: pack.smc && pack.smc.amd ? pack.smc.amd.phase : '',
        killzone: pack.smc ? pack.smc.killzone : null,
        pd: pack.smc ? pack.smc.pd : null,
        sweep: pack.smc && pack.smc.liq ? pack.smc.liq.sweep : null,
        idm: pack.smc ? pack.smc.idm : null,
        fib: pack.smc ? pack.smc.fib : null,
        refined: refined || null, stopRef: stopRef || null
      },
      mtf: pack.mtf ? {
        ok: mtfReady,
        htf: pack.mtf.htf, mid: pack.mtf.mid, ltf: pack.mtf.ltf, gate: pack.mtf.gate
      } : null,
      entrySteps: entrySteps(pack, z, chk, stopRef, { price: tp2.price, pips: tp2.pips })
    });
  });
  const rank = { SIAP: 0, PENDING: 1, TUNGGU: 2, LEWAT: 3 };
  return out.sort((a, b) => (rank[a.status] == null ? 9 : rank[a.status]) - (rank[b.status] == null ? 9 : rank[b.status]) || b.conf - a.conf).slice(0, 3);
}

async function aiMarks(pack) {
  const sys = `Kamu trader XAUUSD profesional metode Alchemist. Waktu UTC: ${new Date().toUTCString()}.
Tugas: periksa tanda chart M5/M15/H1/H4/D1/W1 yang SUDAH dihitung mesin, lalu beri catatan profesional pada tiap tanda. Setiap tanda membawa tf asal dan at (waktu candle asal); jangan mengubah tf/at/harga. Jangan membuat harga/level baru; hanya boleh memakai id dan harga yang ada.
KONTEKS: semua entry memakai timeframe M5, SL tepat 30 pip, TP2/TPmax minimal 200 pip dari likuiditas atau proyeksi ATR yang diberi label. Setiap mode punya POI berbeda: Scalping M5/M15, Day M15/H1, Swing H4/H1. Bila setup memakai entryMode WICK, entry LIMIT berada di pucuk wick candle M5 yang sudah close kembali ke POI; itu bukan chase dan jangan digeser ke market. Jangan mengubah entry, SL, atau TP.
PETA MULTI-TF: "mtf" adalah urutan wajib dari materi: HTF 1D–4H = direction + liquidity + supply/demand; MTF 1H–15m = trend + breakout + reversal + OB/FVG + liquidity; LTF 5m–1m = confirmation + entry. Setup dengan mtf.ok=false/status TUNGGU belum valid untuk dieksekusi walau levelnya tampil. Jangan mengaktifkan gate yang belum lengkap, jangan mengarang konfirmasi M1, dan sebutkan bila mtf.ltf.m1Available=false (feed M1 tidak tersedia).
METODE: patuhi matriks "metode" dan mesin SMC/AMD. ${S.DOCTRINE}
Jika salah satu syarat wajib tidak ada, jelaskan sebagai risiko; jangan mengarang level atau metode baru. Hormati "entrySteps" yang sudah dihitung mesin.
BUKTI GLOBAL: "buktiGlobal" adalah judul berita/analisis dari sumber terpercaya beserta waktu dan kecenderungan judul. Pakai hanya sebagai konteks regime pasar; jangan mengubah arah, entry, SL, atau TP, dan jangan mengarang angka atau kutipan baru dari judul.
ATURAN WAJIB: arahMesin adalah arah FINAL satu-satunya. Field "bias" WAJIB sama dengan arahMesin; jangan pernah menyarankan BUY dan SELL sekaligus. Bila kamu tidak setuju, tetap pakai arahMesin dan tulis risikonya di "invalidation". Untuk setiap setup, jelaskan apakah POI, trigger M5, dan TP memang searah; jangan mengarang data baru. Status PENDING berarti rencana LIMIT sudah valid (entry/SL 30/TP2 ≥200) dan menunggu trigger/waktu; itu sinyal yang bisa dipasang sebagai limit, bukan "tidak ada sinyal". Status TUNGGU hanya dipakai bila level belum layak atau ditahan pembelajaran. Jika ada "pembelajaran" atau setup TUNGGU karena pola SL berulang, hormati penahanan itu dan jelaskan risikonya; jangan mengaktifkan kembali entry yang ditahan.
Balas HANYA JSON: {"bias":"BUY|SELL","summary":"2-4 kalimat","marks":[{"id":"m1","note":"kenapa tanda ini penting (maks 180 karakter)","confidence":"TINGGI|SEDANG|RENDAH"}],"confluence":["..."],"invalidation":"kondisi yang membatalkan bias"}`;
  const data = {
    /* tanda diletakkan paling depan supaya tidak pernah terpotong saat payload panjang */
    tanda: pack.markers.map(m => ({ id: m.id, tf: m.tf || '', at: m.at || null, entryTf: m.entryTf || 'M5', type: m.type, label: m.label, price: m.price, why: m.why })),
    jumlahTanda: pack.markers.length,
    harga: pack.price, sumberHarga: pack.priceSource, arahMesin: pack.direction, kekuatan: pack.directionStrength, entryTf: 'M5',
    matriksTF: (pack.tfMatrix || []).map(x => ({ tf: x.tf, rec: x.rec, value: x.value })),
    m5: { struktur: pack.m5structure, bos: pack.m5bos, sweep: pack.m5sweep, fvg: (pack.m5fvgs || []).slice(-3), ob: pack.m5ob, eq: pack.m5eq, pd: pack.m5pd, atr5: pack.atr5, rsi5: pack.rsi5 },
    m15: { struktur: pack.structure, bos: pack.bos, choch: pack.choch, sweep: pack.sweep, fvg: (pack.fvgs || []).slice(-3), ob: pack.ob, snd: pack.snd, ote: pack.ote, pd: pack.pd, pdh: pack.pdh, pdl: pack.pdl, atr: pack.atr, rsi: pack.rsi, ema20: pack.ema20, ema50: pack.ema50, sesi: pack.session, adr: pack.adr },
    h1: { struktur: pack.h1structure, bos: pack.h1bos, sweep: pack.h1sweep, fvg: (pack.h1fvgs || []).slice(-2), ob: pack.h1ob, eq: pack.h1eq, atr: pack.atr1 },
    h4: { struktur: pack.h4structure, bos: pack.h4bos, sweep: pack.h4sweep, fvg: (pack.h4fvgs || []).slice(-2), ob: pack.h4ob, eq: pack.h4eq, atr: pack.atr4 },
    pembelajaran: pack.learning || null,
    mtf: pack.mtf || null,
    metode: pack.methods || null,
    smc: S.summary(pack.smc),
    langkahEntry: (pack.setups || []).slice(0, 2).map(s => ({ style: s.style, status: s.status, smc: s.smc ? { grade: s.smc.grade, phase: s.smc.phase, pd: s.smc.pd && s.smc.pd.zone, checks: (s.smc.checks || []).map(c => ({ k: c.k, ok: c.ok, d: c.d })) } : null, steps: s.entrySteps || [] })),
    buktiGlobal: (pack.knowledge && pack.knowledge.items || []).slice(0, 10).map(x => ({ sumber: x.src, judul: x.title, umurJam: x.ageH, kecenderungan: x.lean || 'netral', akurasiSumber: x.sourceAccuracy })),
    penilaianSumber: pack.knowledge ? pack.knowledge.bias : null,
    setup: (pack.setups || []).map(s => ({ style: s.style, dir: s.dir, status: s.status, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2, tpMax: s.tpMax, poi: s.poiTf, trigger: s.trigger, entryMode: s.entryMode || 'ZONE', wick: s.wick ? { entry: s.wick.entry, wickPips: s.wick.wickPips, note: s.wick.note } : null, fvg50: s.fvg50 ? { entry: s.fvg50.entry, lo: s.fvg50.lo, hi: s.fvg50.hi, note: s.fvg50.note } : null, pattern: s.pattern ? { label: s.pattern.label, note: s.pattern.note } : null, why: s.why, rr: s.rr, conf: s.conf, learning: s.learning || null })),
    risikoRilis: pack.eventRisk,
    makro: pack.macro
  };
  const out = await C.ai(sys, 'Periksa chart ini:\n' + JSON.stringify(data), { field: 'signal', temp: 0.2, maxTok: 4200, deadlineMs: 30000 });
  const j = C.parseJson(out.text);
  if (!j) throw new Error('AI tidak mengembalikan JSON');
  return { j, provider: out.provider, model: out.model };
}

function applyAi(pack, ai) {
  const j = ai.j || {};
  const notes = new Map();
  (Array.isArray(j.marks) ? j.marks : []).slice(0, 40).forEach(x => {
    if (!x || !x.id) return;
    notes.set(String(x.id), { note: C.cut(x.note, 200), confidence: /^(tinggi|sedang|rendah)$/i.test(String(x.confidence || '')) ? String(x.confidence).toUpperCase() : 'SEDANG' });
  });
  pack.markers = pack.markers.map(m => ({ ...m, ai: notes.get(m.id) || null }));
  const rawBias = /^(buy|sell)$/i.test(String(j.bias || '')) ? String(j.bias).toUpperCase() : null;
  const dissent = rawBias && rawBias !== pack.direction ? rawBias : null;
  pack.ai = {
    ok: true, provider: ai.provider, model: ai.model, bias: pack.direction, dissent,
    summary: C.cut(j.summary, 900),
    confluence: (Array.isArray(j.confluence) ? j.confluence : []).slice(0, 6).map(x => C.cut(x, 180)),
    invalidation: C.cut(j.invalidation, 300),
    annotated: pack.markers.filter(m => m.ai).length
  };
}

let cache = null;

async function build() {
  const d = await C.candles();
  const tv = await C.tvRead();
  const sp = await C.spot().catch(() => null);
  const rows = d.m15.rows;
  const m5 = d.m5 ? d.m5.rows : null;
  /* Entry M5: analisis struktur memakai candle M5 yang SUDAH CLOSE saja.
     Candle berjalan tetap ditampilkan di chart, tetapi tidak dipakai untuk
     BOS/CHoCH supaya tanda tidak berubah-ubah (repaint). */
  const m5closed = m5 ? m5.filter(r => r.t + 300000 <= Date.now()) : null;
  const m5a = m5closed && m5closed.length >= 40 ? m5closed : m5;
  const last = rows[rows.length - 1];
  /* Skala chart mengikuti candle M5 terbaru (termasuk bar berjalan) supaya
     harga terakhir di chart sama dengan quote TradingView. Entry/struktur
     tetap dihitung dari candle M5 yang sudah close; shift hanya menyamakan
     skala tampilan dan evaluasi, bukan mengubah sinyal. */
  const lastExec = m5 && m5.length ? m5[m5.length - 1] : last;
  const anchor = tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : lastExec.c;
  const shift = priceShift(lastExec.c, anchor);
  const dailyRows = d.d1 ? d.d1.rows : null;
  const dcloses = dailyRows ? dailyRows.map(r => r.c) : [];
  const atr14 = C.atr(rows, 14), atr5 = m5a ? C.atr(m5a, 14) : null;
  const h1a = d.h1 && d.h1.rows ? d.h1.rows : [];
  const h4a = d.h4 && d.h4.rows ? d.h4.rows : [];
  const m1raw = d.m1 && d.m1.rows ? d.m1.rows : [];
  /* Hanya candle M1 yang sudah close untuk konfirmasi; candle berjalan tetap
     ditampilkan di chart M1 tetapi tidak dipakai sebagai trigger. */
  const m1closed = m1raw.filter(r => r && isFinite(r.t) && r.t + 60000 <= Date.now());
  const m1a = m1closed.length >= 40 ? m1closed : m1raw;
  const atr1m = m1a.length ? C.atr(m1a, 14) : null;
  const st1m = m1a.length >= 30 ? C.structure(m1a) : null;
  const sw1m = m1a.length ? C.sweep(m1a) : null;
  const fvg1m = m1a.length ? C.fvg(m1a) : [];
  const ob1m = m1a.length ? C.orderBlock(m1a, atr1m) : null;
  const pd1m = m1a.length ? premiumDiscount(m1a) : null;
  const atr1 = h1a.length ? C.atr(h1a, 14) : null, atr4 = h4a.length ? C.atr(h4a, 14) : null;
  const st1 = h1a.length >= 30 ? C.structure(h1a) : null;
  const st4 = h4a.length >= 30 ? C.structure(h4a) : null;
  const sw1 = h1a.length ? C.sweep(h1a) : null, sw4 = h4a.length ? C.sweep(h4a) : null;
  const fvg1 = h1a.length ? C.fvg(h1a) : [], fvg4 = h4a.length ? C.fvg(h4a) : [];
  const ob1r = h1a.length ? C.orderBlock(h1a, atr1) : null, ob4r = h4a.length ? C.orderBlock(h4a, atr4) : null;
  const eq1r = h1a.length ? equalLevels(h1a, atr1) : { highs: [], lows: [] };
  const eq4r = h4a.length ? equalLevels(h4a, atr4) : { highs: [], lows: [] };
  const st = C.structure(rows), st5 = m5a ? C.structure(m5a) : null;
  const sw = C.sweep(rows), sw5 = m5a ? C.sweep(m5a) : null;
  const fvgs = C.fvg(rows).map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) }));
  const ob = C.orderBlock(rows, atr14);
  const prevDay = dailyRows && dailyRows.length > 1 ? dailyRows[dailyRows.length - 2] : null;
  const dayRows = rows.filter(r => new Date(r.t).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));
  const rangeHi = Math.max(...rows.slice(-80).map(r => r.h)), rangeLo = Math.min(...rows.slice(-80).map(r => r.l));
  const pd = premiumDiscount(rows), pd5 = m5a ? premiumDiscount(m5a) : null;
  const fvg5 = (m5a ? C.fvg(m5a) : []).map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) }));
  const ob5raw = m5a ? C.orderBlock(m5a, atr5) : null;
  const ob5 = ob5raw ? { ...ob5raw, lo: C.r2(ob5raw.lo + shift), hi: C.r2(ob5raw.hi + shift) } : null;
  const eq5raw = m5a ? equalLevels(m5a, atr5) : { highs: [], lows: [] };
  const eq5 = {
    highs: eq5raw.highs.map(x => ({ ...x, price: C.r2(x.price + shift) })),
    lows: eq5raw.lows.map(x => ({ ...x, price: C.r2(x.price + shift) }))
  };
  const smt = (d.dxyTv || d.dxy) ? (() => {
    const dr = (d.dxyTv && d.dxyTv.rows) || d.dxy.rows;
    const n = Math.min(20, m5a ? m5a.length : rows.length, dr.length);
    const gc = (m5a || rows).slice(-n).map(r => r.c), dc = dr.slice(-n).map(r => r.c);
    const gch = gc[gc.length - 1] - gc[0], dch = dc[dc.length - 1] - dc[0];
    const tf = d.dxyTv ? 'M15' : 'D1';
    const at = isoAt((m5a || rows)[(m5a || rows).length - 1].t);
    if (gch > 0.5 && dch < 0) return { dir: 1, tf, at, why: 'SMT ' + tf + ': emas naik sementara DXY turun — konfirmasi risk-on untuk emas' };
    if (gch < -0.5 && dch > 0) return { dir: -1, tf, at, why: 'SMT ' + tf + ': emas turun sementara DXY naik — tekanan turun' };
    return { dir: 0, tf, at, why: 'SMT ' + tf + ' netral (emas dan DXY bergerak searah/tidak jelas)' };
  })() : null;
  const ema20 = C.ema(rows.map(r => r.c), 20), ema50 = C.ema(rows.map(r => r.c), 50);
  const dailyStatus = dailyRows && dailyRows.length > 50 ? {
    last: C.r2(dailyRows[dailyRows.length - 1].c),
    trend: (() => { const s20 = C.sma(dcloses, 20), s50 = C.sma(dcloses, 50), l = dcloses[dcloses.length - 1]; return s20 && s50 ? (l > s20 && s20 > s50 ? 'naik' : l < s20 && s20 < s50 ? 'turun' : 'campuran') : 'campuran'; })()
  } : null;
  const eqRaw = equalLevels(rows, atr14);
  const eq = {
    highs: eqRaw.highs.map(x => ({ ...x, price: C.r2(x.price + shift) })),
    lows: eqRaw.lows.map(x => ({ ...x, price: C.r2(x.price + shift) }))
  };
  const sessRaw = sessionLevels(rows);
  const sess = {
    asia: sessRaw.asia ? { hi: C.r2(sessRaw.asia.hi + shift), lo: C.r2(sessRaw.asia.lo + shift), bars: sessRaw.asia.bars, hiAt: sessRaw.asia.hiAt, loAt: sessRaw.asia.loAt } : null,
    dayOpen: sessRaw.dayOpen == null ? null : C.r2(sessRaw.dayOpen + shift), dayOpenAt: sessRaw.dayOpenAt,
    weekOpen: sessRaw.weekOpen == null ? null : C.r2(sessRaw.weekOpen + shift), weekOpenAt: sessRaw.weekOpenAt,
    judas: sessRaw.judas ? { ...sessRaw.judas, level: C.r2(sessRaw.judas.level + shift) } : null
  };
  const mitRaw = mitigationOf(rows, atr14);
  const mit = mitRaw ? { ...mitRaw, lo: C.r2(mitRaw.lo + shift), hi: C.r2(mitRaw.hi + shift) } : null;
  const sndRaw = sndOf(rows, ob, atr14);
  const snd = sndRaw.map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) }));
  const calList = await C.calendar().catch(() => []);
  const poolHiRows = rows.slice(-80).map(r => ({ price: C.r2(r.h + shift), at: isoAt(r.t) })).sort((a, b) => b.price - a.price).filter((v, i, a) => a.findIndex(x => x.price === v.price) === i).slice(0, 3);
  const poolLoRows = rows.slice(-80).map(r => ({ price: C.r2(r.l + shift), at: isoAt(r.t) })).sort((a, b) => a.price - b.price).filter((v, i, a) => a.findIndex(x => x.price === v.price) === i).slice(0, 3);
  const poolHighAt = Object.fromEntries(poolHiRows.map(x => [x.price, x.at]));
  const poolLowAt = Object.fromEntries(poolLoRows.map(x => [x.price, x.at]));
  /* Chart, marker, entry, dan evaluasi SL/TP wajib memakai skala harga yang
     sama. Sebelumnya candle chart tetap mentah sementara level digeser ke
     harga TradingView, sehingga label bisa tampak meleset beberapa pip dan
     evaluasi SL/TP membandingkan dua skala berbeda. */
  const shiftRows = (rs) => (rs || []).map(r => ({ ...r, o: r.o + shift, h: r.h + shift, l: r.l + shift, c: r.c + shift }));
  const oteRaw = C.ote(rows);
  const ote = oteRaw ? {
    ...oteRaw,
    hi: C.r2(oteRaw.hi + shift), lo: C.r2(oteRaw.lo + shift),
    long: (oteRaw.long || []).map(x => C.r2(x + shift)),
    short: (oteRaw.short || []).map(x => C.r2(x + shift))
  } : null;
  const packRaw = {
    price: C.r2(anchor), tvSymbol: (tv && tv.ok && tv.symbol) || C.TV_SYMBOL, priceSource: tv && tv.ok ? 'chart TradingView ' + (tv.symbol || C.TV_SYMBOL) : sp && sp.ok ? 'spot gold-api' : 'candle ' + C.Y_SYM,
    m5At: m5a && m5a.length ? isoAt(m5a[m5a.length - 1].t) : null, weekOpenAt: sess.weekOpenAt,
    m1At: m1a.length ? isoAt(m1a[m1a.length - 1].t) : null,
    m15At: rows.length ? isoAt(rows[rows.length - 1].t) : null,
    h1At: h1a.length ? isoAt(h1a[h1a.length - 1].t) : null,
    h4At: h4a.length ? isoAt(h4a[h4a.length - 1].t) : null,
    d1At: dailyRows && dailyRows.length ? isoAt(dailyRows[dailyRows.length - 1].t) : null,
    h1structure: st1 ? { ...st1, lastHi: st1.lastHi == null ? null : C.r2(st1.lastHi + shift), lastLo: st1.lastLo == null ? null : C.r2(st1.lastLo + shift), hi: (st1.hi || []).map(x => C.r2(x + shift)), lo: (st1.lo || []).map(x => C.r2(x + shift)) } : null,
    h4structure: st4 ? { ...st4, lastHi: st4.lastHi == null ? null : C.r2(st4.lastHi + shift), lastLo: st4.lastLo == null ? null : C.r2(st4.lastLo + shift), hi: (st4.hi || []).map(x => C.r2(x + shift)), lo: (st4.lo || []).map(x => C.r2(x + shift)) } : null,
    h1bos: st1 && st1.bos ? { ...st1.bos, level: C.r2(st1.bos.level + shift) } : null,
    h4bos: st4 && st4.bos ? { ...st4.bos, level: C.r2(st4.bos.level + shift) } : null,
    h1sweep: sw1 ? { ...sw1, level: C.r2(sw1.level + shift) } : null,
    h4sweep: sw4 ? { ...sw4, level: C.r2(sw4.level + shift) } : null,
    h1fvgs: fvg1.map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) })),
    h4fvgs: fvg4.map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) })),
    h1ob: ob1r ? { ...ob1r, lo: C.r2(ob1r.lo + shift), hi: C.r2(ob1r.hi + shift) } : null,
    h4ob: ob4r ? { ...ob4r, lo: C.r2(ob4r.lo + shift), hi: C.r2(ob4r.hi + shift) } : null,
    h1eq: { highs: eq1r.highs.map(x => ({ ...x, price: C.r2(x.price + shift) })), lows: eq1r.lows.map(x => ({ ...x, price: C.r2(x.price + shift) })) },
    h4eq: { highs: eq4r.highs.map(x => ({ ...x, price: C.r2(x.price + shift) })), lows: eq4r.lows.map(x => ({ ...x, price: C.r2(x.price + shift) })) },
    atr1: C.r2(atr1), atr4: C.r2(atr4),
    tv, spot: sp, structure: { ...st, lastHi: st.lastHi == null ? null : C.r2(st.lastHi + shift), lastLo: st.lastLo == null ? null : C.r2(st.lastLo + shift) },
    m5: st5 ? { trend: st5.trend, lastHi: st5.lastHi == null ? null : C.r2(st5.lastHi + shift), lastLo: st5.lastLo == null ? null : C.r2(st5.lastLo + shift), lastHiAt: st5.lastHiAt, lastLoAt: st5.lastLoAt } : null,
    m5structure: st5 ? { trend: st5.trend, lastHi: st5.lastHi == null ? null : C.r2(st5.lastHi + shift), lastLo: st5.lastLo == null ? null : C.r2(st5.lastLo + shift), lastHiAt: st5.lastHiAt, lastLoAt: st5.lastLoAt, hi: (st5.hi || []).map(x => C.r2(x + shift)), lo: (st5.lo || []).map(x => C.r2(x + shift)) } : null,
    m5bos: st5 && st5.bos ? { ...st5.bos, level: C.r2(st5.bos.level + shift) } : null,
    m5sweep: sw5 ? { ...sw5, level: C.r2(sw5.level + shift) } : null,
    m5fvgs: fvg5,
    m5ob: ob5,
    m5eq: eq5,
    m5pd: pd5 ? { hi: C.r2(pd5.hi + shift), lo: C.r2(pd5.lo + shift), pos: pd5.pos, zone: pd5.zone } : null,
    m1structure: st1m ? { trend: st1m.trend, lastHi: st1m.lastHi == null ? null : C.r2(st1m.lastHi + shift), lastLo: st1m.lastLo == null ? null : C.r2(st1m.lastLo + shift), lastHiAt: st1m.lastHiAt, lastLoAt: st1m.lastLoAt, hi: (st1m.hi || []).map(x => C.r2(x + shift)), lo: (st1m.lo || []).map(x => C.r2(x + shift)) } : null,
    m1bos: st1m && st1m.bos ? { ...st1m.bos, level: C.r2(st1m.bos.level + shift) } : null,
    m1sweep: sw1m ? { ...sw1m, level: C.r2(sw1m.level + shift) } : null,
    m1fvgs: fvg1m.map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) })),
    m1ob: ob1m ? { ...ob1m, lo: C.r2(ob1m.lo + shift), hi: C.r2(ob1m.hi + shift) } : null,
    m1pd: pd1m ? { hi: C.r2(pd1m.hi + shift), lo: C.r2(pd1m.lo + shift), pos: pd1m.pos, zone: pd1m.zone } : null,
    entryTf: 'M5',
    bos: st.bos ? { ...st.bos, level: C.r2(st.bos.level + shift) } : null,
    choch: st5 && st5.trend !== 'RANGE' && st.trend !== st5.trend
      ? { level: C.r2((st5.trend === 'BEARISH' ? st5.lastLo : st5.lastHi) + shift), from: st.trend, to: st5.trend, at: st5.trend === 'BEARISH' ? st5.lastLoAt : st5.lastHiAt }
      : null,
    sweep: sw ? { ...sw, level: C.r2(sw.level + shift) } : null,
    fvgs, ob: ob ? { ...ob, lo: C.r2(ob.lo + shift), hi: C.r2(ob.hi + shift) } : null,
    ote, pd, pdh: prevDay ? C.r2(prevDay.h + shift) : null, pdl: prevDay ? C.r2(prevDay.l + shift) : null,
    pdhAt: prevDay ? isoAt(prevDay.t) : null, pdlAt: prevDay ? isoAt(prevDay.t) : null,
    atr: C.r2(atr14), atr5: C.r2(atr5), atr5Pips: atr5 ? Math.round(atr5 / PIP) : null, atrPips: atr14 ? Math.round(atr14 / PIP) : null, rsi: C.r2(C.rsi(rows.map(r => r.c), 14)), rsi5: m5a ? C.r2(C.rsi(m5a.map(r => r.c), 14)) : null,
    ema20: C.r2(ema20), ema50: C.r2(ema50), daily: dailyStatus, smt, session: C.sessionInfo(), pdRange: { hi: C.r2(pd.hi + shift), lo: C.r2(pd.lo + shift), pos: pd.pos, zone: pd.zone },
    pools: { highs: poolHiRows.map(x => x.price), lows: poolLoRows.map(x => x.price), highAt: poolHighAt, lowAt: poolLowAt },
    eq, sessionLevels: sess, mitigation: mit, snd, adr: adrOf(dailyRows), tfMatrix: tfMatrix(tv), eventRisk: eventRiskOf(calList),
    macro: {
      dxy5d: d.dxy ? C.r2((d.dxy.rows[d.dxy.rows.length - 1].c / d.dxy.rows[Math.max(0, d.dxy.rows.length - 6)].c - 1) * 100) : null,
      yield10_5d: d.tnx ? C.r2(d.tnx.rows[d.tnx.rows.length - 1].c - d.tnx.rows[Math.max(0, d.tnx.rows.length - 6)].c) : (d.us10Tv ? C.r2(d.us10Tv.rows[d.us10Tv.rows.length - 1].c - d.us10Tv.rows[Math.max(0, d.us10Tv.rows.length - 6)].c) : null),
      dxy15m: d.dxyTv ? C.r2((d.dxyTv.rows[d.dxyTv.rows.length - 1].c / d.dxyTv.rows[Math.max(0, d.dxyTv.rows.length - 6)].c - 1) * 100) : null,
      us10y15m: d.us10Tv ? C.r2(d.us10Tv.rows[d.us10Tv.rows.length - 1].c - d.us10Tv.rows[Math.max(0, d.us10Tv.rows.length - 6)].c) : null,
      gold1d: dcloses.length > 1 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 2] - 1) * 100) : null,
      gold5d: dcloses.length > 5 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 6] - 1) * 100) : null
    },
    chart: { rows: shiftRows(rows.slice(-160)), m15: shiftRows(rows.slice(-160)), m5: m5 ? shiftRows(m5.slice(-300)) : null, m1: m1raw.length ? shiftRows(m1raw.slice(-240)) : [], h1: shiftRows(h1a.slice(-160)), h4: shiftRows(h4a.slice(-160)), d1: shiftRows((dailyRows || []).slice(-40)), w1: shiftRows(weeklyRows(dailyRows || []).slice(-16)), pip: PIP, anchor: C.r2(anchor), shift: C.r2(shift), entryTf: 'M5', tvSymbol: (tv && tv.ok && tv.symbol) || C.TV_SYMBOL },
    marketOpen: !!(m5a && m5a.length && (Date.now() - m5a[m5a.length - 1].t) <= 20 * 60000),
    freshness: {
      priceAt: tv && tv.ok && tv.at ? new Date(tv.at).toISOString() : sp && sp.at ? new Date(sp.at).toISOString() : null,
      candleAt: m5a && m5a.length ? new Date(m5a[m5a.length - 1].t).toISOString() : null,
      candleAgeMin: m5a && m5a.length ? Math.round((Date.now() - m5a[m5a.length - 1].t) / 60000) : null,
      tvAgeSec: tv && tv.at ? Math.round((Date.now() - tv.at) / 1000) : null,
      spotAgeSec: sp && sp.at ? Math.round((Date.now() - sp.at) / 1000) : null,
      candleSource: (d.m5 && d.m5.source) || d.source || ('Yahoo ' + C.Y_SYM + ' M5'),
      dataLive: !!d.live,
      candleCount: m5a ? m5a.length : 0
    }
  };
  /* Mesin SMC/AMD dihitung dari candle yang sudah digeser ke harga acuan,
     supaya level chart, entry, dan SL memakai skala harga yang sama. */
  try {
    packRaw.smc = S.build({
      m5: shiftRows(m5a), m15: shiftRows(rows), h1: shiftRows(h1a), h4: shiftRows(h4a), d1: shiftRows(dailyRows || []),
      price: anchor, atr5, atr15: atr14, atr1, atr4, now: Date.now()
    });
  } catch (e) {
    packRaw.smc = { ok: false, note: 'Mesin SMC gagal: ' + C.cut(e && e.message || e, 160) };
  }
  const dv = directionVote(packRaw);
  /* Trigger M5 diambil dari event TERBARU, bukan selalu BOS. Dulu BOS lama
     menang atas sweep baru, sehingga arah konflik dengan trigger yang benar-
     benar dipakai setup. */
  const m5TriggerDir = (() => {
    const cands = [];
    const atOf = (x) => Date.parse(x && x.at ? x.at : '') || 0;
    if (st5 && st5.bos) cands.push({ dir: st5.bos.dir === 'BULLISH' ? 'BUY' : 'SELL', at: atOf(st5.bos), pri: 4, kind: 'BOS' });
    if (sw5) cands.push({ dir: sw5.kind === 'low' ? 'BUY' : 'SELL', at: atOf(sw5), pri: 3, kind: 'SWEEP' });
    const lastFvg = (fvg5 || []).filter(z => z.kind === 'bull' || z.kind === 'bear').slice(-1)[0];
    if (lastFvg) cands.push({ dir: lastFvg.kind === 'bull' ? 'BUY' : 'SELL', at: atOf(lastFvg), pri: 2, kind: 'FVG' });
    if (ob5) cands.push({ dir: ob5.dir === 'BULLISH' ? 'BUY' : 'SELL', at: atOf(ob5), pri: 1, kind: 'OB' });
    cands.sort((a, b) => b.at - a.at || b.pri - a.pri);
    return cands.length ? cands[0].dir : null;
  })();
  packRaw.rawDirection = dv.dir;
  packRaw.m5TriggerDir = m5TriggerDir;
  const smcBias = packRaw.smc && packRaw.smc.ok && packRaw.smc.htf ? packRaw.smc.htf.bias : null;
  const smcDir = smcBias === 'BULLISH' ? 'BUY' : smcBias === 'BEARISH' ? 'SELL' : null;
  /* Arah final mengikuti bias dominan (HTF + metode), bukan dipaksa oleh satu
     trigger M5. Dulu trigger M5 yang melawan HTF membalik arah final, lalu
     modeBias menolak semua mode sehingga setups kosong dan tab hanya menampilkan
     "tunggu". Sekarang trigger hanya dipakai bila searah; bila melawan, arah
     tetap bias dominan dan setup ditandai konflik (PENDING/TUNGGU), bukan
     entry melawan tren. */
  packRaw.direction = dv.dir === 'WAIT' ? (m5TriggerDir || smcDir || dv.dir) : (m5TriggerDir === dv.dir ? m5TriggerDir : dv.dir);
  packRaw.methods = methodMatrix(packRaw);
  packRaw.biasConflict = !!(m5TriggerDir && dv.dir !== 'WAIT' && dv.dir !== m5TriggerDir);
  packRaw.directionStrength = packRaw.biasConflict ? Math.min(dv.strength, 55) : dv.strength;
  packRaw.votes = dv.votes;
  /* Peta 1D→4H→1H→15m→5m→1m dihitung dari candle yang sama dengan level.
     Status setup hanya SIAP bila ketiga lapisan sepakat. */
  packRaw.mtf = multiTfOf(packRaw);
  packRaw.setups = buildModeSetups(packRaw, packRaw.direction);
  packRaw.markers = markersOf(packRaw);
  packRaw.generatedAt = new Date().toISOString();
  return packRaw;
}

/* Endpoint ringan untuk kajian SL: hanya candle M5 terbaru, tanpa menunggu
   refresh sinyal 15 menit dan tanpa memanggil AI. Satu request websocket
   TradingView per panggilan; dipakai watchdog 60 detik saat ada review aktif. */
async function candlesHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const tv = await C.tvChart(C.TV_SYMBOL, '5', 500);
    const rows = ((tv && tv.rows) || []).filter(r => r && isFinite(r.t) && isFinite(r.c)).slice(-400);
    if (rows.length < 20) throw new Error('Candle M5 terbaru belum cukup');
    return res.status(200).json({
      ok: true, rows, source: tv.source || ('TradingView ' + C.TV_SYMBOL + ' M5'),
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: C.cut(e && e.message || e, 220), generatedAt: new Date().toISOString() });
  }
}

async function signalHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const b = (req && req.body) || {};
    const learn = b.learn && typeof b.learn === 'object' ? b.learn : null;
    const hasLearn = !!(learn && ((learn.patterns || []).length || (learn.records || []).length || (learn.news || []).length || (learn.radar || []).length || (learn.sources || []).length));
    /* Cache global tidak boleh mencampur status belajar akun yang berbeda. */
    const cachedPack = !hasLearn && !b.fresh && cache && Date.now() - cache.t < 20000 ? cache.v : null;
    let kb = null;
    try { kb = await K.load(); } catch (e) { kb = null; }
    const knowledgeFor = (dir) => {
      try { return K.view(kb, learn, 5, dir); }
      catch (e) { return { ok: false, total: 0, measured: 0, items: [], sources: [], bias: { delta: 0, note: 'Pengetahuan global tidak dapat dibaca: ' + C.cut(e && e.message || e, 120) }, note: 'tidak tersedia' }; }
    };
    if (cachedPack) return res.status(200).json({ ...cachedPack, knowledge: knowledgeFor(cachedPack.direction), cached: true });
    const pack = await build();
    if (hasLearn) {
      /* Pembelajaran tidak boleh menjatuhkan sinyal utama. */
      try { applyLearning(pack, learn); }
      catch (e) { pack.learning = { patterns: 0, records: 0, blocked: 0, warned: 0, traits: 0, top: [], error: C.cut(e && e.message || e, 160), source: 'pembelajaran gagal dibaca' }; }
    }
    /* Bukti global terpercaya: hanya keyakinan yang boleh disesuaikan. Status,
       entry, SL, TP, dan arah tidak disentuh. */
    pack.knowledge = knowledgeFor(pack.direction);
    if (!pack.learning) pack.learning = {};
    pack.learning.sources = pack.knowledge.learning || { n: 0 };
    pack.learning.knowledge = pack.knowledge.bias ? pack.knowledge.bias.note : '';
    if (pack.knowledge.bias && pack.knowledge.bias.delta) {
      pack.setups.forEach(s => {
        if (!s) return;
        s.conf = Math.max(30, Math.min(96, Math.round(Number(s.conf) || 0) + pack.knowledge.bias.delta));
      });
    }
    try {
      const ai = await aiMarks(pack);
      applyAi(pack, ai);
    } catch (e) {
      pack.ai = { ok: false, error: C.cut(e && e.message || e, 180), annotated: 0 };
    }
    if (pack.ai && pack.ai.dissent) {
      pack.ai.conflict = true;
      pack.ai.note = 'AI menilai ada risiko bias ' + pack.ai.dissent + ', tetapi arah final tetap ' + pack.direction + '; AI tidak boleh memberi sinyal kedua.';
    }
    const topSetup = pack.setups[0] || null;
    const topSmc = topSetup && topSetup.smc ? topSetup.smc : null;
    let gateNote = 'belum ada setup yang bisa dinilai SMC';
    if (topSmc) {
      gateNote = topSmc.ready
        ? 'SMC ' + topSmc.grade + ' siap; ' + (topSmc.executable ? 'syarat eksekusi lengkap.' : 'tunggu ' + (topSmc.blockers || []).join('; '))
        : 'SMC ' + topSmc.grade + ' — ' + (topSmc.missing || []).slice(0, 3).join(', ');
    }
    pack.smcGate = { ok: !!(topSmc && topSmc.ready), executable: !!(topSmc && topSmc.executable), note: gateNote };
    if (pack.smc) pack.smc = S.summary(pack.smc);
    pack.generatedAt = new Date().toISOString();
    pack.direction = pack.setups.length ? pack.setups[0].dir : pack.direction;
    const sign = pack.direction === 'BUY' ? 1 : -1;
    const htf = pack.tv && pack.tv.tf ? ['D', '240', '60'].map(k => pack.tv.tf[k] && pack.tv.tf[k].rec).filter(v => v != null) : [];
    pack.plan = pack.setups.find(s => s.status === 'SIAP' && s.style === 'DAY')
      || pack.setups.find(s => s.status === 'SIAP')
      || pack.setups.find(s => s.status === 'PENDING' && s.style === 'DAY')
      || pack.setups.find(s => s.status === 'PENDING')
      || pack.setups.find(s => s.style === 'DAY')
      || pack.setups[0] || null;
    const smcPlan = pack.plan && pack.plan.smc || (pack.setups[0] && pack.setups[0].smc) || null;
    pack.checklist = [
      { k: 'Bias D1/H4/H1 searah', ok: htf.length >= 2 && htf.every(v => v * sign >= -0.1), d: (pack.tfMatrix || []).slice(0, 3).map(x => x.tf + ' ' + x.rec).join(' · ') || 'TF global tidak lengkap' },
      { k: 'POI M15 tersedia', ok: !!(pack.ob || (pack.snd || []).length || pack.ote), d: pack.ob ? 'Order block M15 + zona SND/OTE' : 'POI dari struktur M15' },
      { k: 'Trigger M5 valid', ok: !!(pack.m5bos || pack.m5sweep || (pack.m5fvgs || []).length || pack.m5ob), d: (pack.m5bos ? 'BOS M5 · ' : '') + (pack.m5sweep ? 'sweep M5 · ' : '') + ((pack.m5fvgs || []).length ? (pack.m5fvgs || []).length + ' FVG M5' : 'struktur M5') },
      { k: 'RR TP2 minimal 1:2', ok: !!(pack.plan && pack.plan.rr >= 2), d: pack.plan ? 'TP2 ' + pack.plan.tp2Pips + ' pip / SL 30 pip = 1:' + pack.plan.rr : 'belum ada setup' },
      { k: 'Jarak entry dapat dieksekusi', ok: !!(pack.plan && pack.plan.entryDistancePips != null && !pack.plan.tooClose), d: pack.plan && pack.plan.entryDistancePips != null ? pack.plan.entryDistancePips + ' pip dari harga · minimum ' + pack.plan.minEntryPips + ' pip' : 'entry belum tersedia' },
      { k: 'Risiko rilis aman', ok: pack.eventRisk && pack.eventRisk.level !== 'TINGGI', d: pack.eventRisk ? pack.eventRisk.note : 'kalender tidak tersedia' },
      { k: 'Ruang ADR cukup', ok: !!(pack.adr && pack.adr.remainingPips > 60), d: pack.adr ? 'sisa ' + pack.adr.remainingPips + ' pip dari ADR ' + pack.adr.avgPips + ' pip' : 'ADR tidak tersedia' },
      { k: 'Konfluensi metode teknikal ≥ 40%', ok: !!(pack.methods && pack.methods.agreement >= 40 && pack.methods.agree >= 2), d: pack.methods ? pack.methods.note + (pack.methods.against.length ? ' · melawan: ' + pack.methods.against.join(', ') : '') : 'metode belum tersedia' },
      { k: 'SMC: bias + POI + CHoCH/BOS + premium/discount', ok: !!(smcPlan && smcPlan.ready), d: smcPlan ? smcPlan.note : 'mesin SMC tidak tersedia' },
      { k: 'Kill zone London/New York', ok: !!(pack.smc && pack.smc.killzone && pack.smc.killzone.active), d: pack.smc && pack.smc.killzone ? pack.smc.killzone.note : 'kill zone tidak tersedia' },
      { k: 'Sapuan likuiditas + IDM + displacement', ok: !!(pack.smc && pack.smc.ok && (smcPlan && smcPlan.optional >= 2)), d: pack.smc && pack.smc.ok ? (pack.smc.sweep ? pack.smc.sweep.note : 'belum ada sweep') + (pack.smc.displacement ? ' · ' + pack.smc.displacement.note : '') : 'SMC tidak tersedia' },
      { k: 'Fib golden ratio + candle momentum', ok: !!(pack.smc && pack.smc.fib && pack.smc.fib.ok), d: pack.smc && pack.smc.fib ? pack.smc.fib.note : 'belum ada candle momentum H1/H4' },
      { k: 'Pembelajaran tidak menahan entry', ok: !pack.learning || !pack.learning.blocked, d: pack.learning ? pack.learning.blocked + ' setup ditahan · ' + (pack.learning.records || 0) + ' hasil dipelajari · ' + (pack.learning.traits || 0) + ' sifat teknikal' : 'belum ada profil pembelajaran' },
      { k: 'Bukti sumber global terpercaya', ok: !!(pack.knowledge && pack.knowledge.total > 0), d: pack.knowledge ? pack.knowledge.bias.note : 'pengetahuan global tidak tersedia' }
    ];
    pack.sources = [
      { name: 'TradingView chart & TA real-time ' + C.TV_SYMBOL, ok: !!(pack.tv && pack.tv.ok) },
      { name: 'Candle ' + (pack.freshness && pack.freshness.candleSource || 'TradingView') + ' M5/M15/D1', ok: !!(pack.chart && pack.chart.m5) },
      { name: 'gold-api.com spot', ok: !!(pack.spot && pack.spot.ok) },
      { name: 'DXY & yield 10Y (Yahoo)', ok: !!pack.macro },
      { name: 'Kalender ekonomi USD (risiko rilis)', ok: !!(pack.eventRisk && pack.eventRisk.items) },
      { name: 'AI multi-provider (fallback otomatis)', ok: !!(pack.ai && pack.ai.ok) },
      { name: 'Mesin SMC/ICT/AMD: struktur, FVG, OB, likuiditas, kill zone, fib momentum', ok: !!(pack.smc && pack.smc.ok) },
      { name: 'Feed global terpercaya (resmi, emas, media, YouTube resmi)', ok: !!(pack.knowledge && pack.knowledge.total > 0) }
    ];
    pack.validation = [
      { k: 'Harga acuan', ok: true, d: pack.priceSource + ' · ' + pack.price },
      { k: 'Candle M5 entry', ok: !!(pack.chart.m5 && pack.chart.m5.length >= 60) && pack.marketOpen !== false, d: (pack.chart.m5 || []).length + ' candle M5 · ' + (pack.freshness && pack.freshness.candleAgeMin != null ? pack.freshness.candleAgeMin + ' menit lalu' : 'waktu tidak diketahui') + (pack.marketOpen === false ? ' · pasar tutup/data tertunda' : '') },
      { k: 'Entry & TP', ok: !!(pack.plan && (pack.plan.targets || []).length >= 1), d: pack.plan ? 'Entry M5 · SL 30 pip · TP2 ' + pack.plan.tp2Pips + ' pip · TPmax ' + pack.plan.tpMaxPips + ' pip' : 'belum ada setup' },
      { k: 'Struktur & likuiditas', ok: !!(pack.structure && pack.markers.length >= 3), d: pack.markers.length + ' tanda chart (M5/M15/H1/H4/D1/W1)' },
      { k: 'Matriks timeframe', ok: (pack.tfMatrix || []).length >= 4, d: (pack.tfMatrix || []).map(x => x.tf + ' ' + x.rec).join(' · ') },
      { k: 'Risiko rilis', ok: pack.eventRisk && pack.eventRisk.level !== 'TINGGI', d: pack.eventRisk ? pack.eventRisk.note : 'kalender tidak tersedia' },
      { k: 'Anotasi AI', ok: !!(pack.ai && pack.ai.ok), d: pack.ai && pack.ai.ok ? pack.ai.annotated + ' tanda diberi catatan' : (pack.ai && pack.ai.error) || 'AI tidak tersedia' },
      { k: 'Konfluensi metode', ok: !!(pack.methods && pack.methods.agreement >= 40), d: pack.methods ? pack.methods.note : 'metode belum tersedia' },
      { k: 'Mesin SMC/AMD', ok: !!(pack.smc && pack.smc.ok), d: pack.smc && pack.smc.ok ? pack.smc.note : (pack.smc && pack.smc.note) || 'tidak tersedia' },
      { k: 'Pembelajaran', ok: !pack.learning || !pack.learning.blocked, d: pack.learning ? pack.learning.blocked + ' ditahan · ' + pack.learning.warned + ' peringatan · ' + (pack.learning.records || 0) + ' hasil' : 'profil belajar belum dikirim' },
      { k: 'Bukti global', ok: !!(pack.knowledge && pack.knowledge.total > 0), d: pack.knowledge ? pack.knowledge.total + ' judul · ' + pack.knowledge.measured + ' sumber terukur · delta keyakinan ' + (pack.knowledge.bias.delta >= 0 ? '+' : '') + pack.knowledge.bias.delta : 'tidak tersedia' }
    ];
    pack.quality = pack.validation.filter(x => x.ok).length / pack.validation.length * 100;
    pack.checkScore = Math.round(pack.checklist.filter(x => x.ok).length / pack.checklist.length * 100);
    pack.schema = 2;
    if (!hasLearn) cache = { t: Date.now(), v: pack };
    return res.status(200).json(pack);
  } catch (e) {
    return res.status(200).json({ ok: false, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = { signalHandler, candlesHandler, build, markersOf, directionVote, buildModeSetups, applyLearning, learnPatternKeys, methodMatrix };
