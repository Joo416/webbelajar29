/* =====================================================================
   SIGNAL ENTRY — ditulis ulang dari nol.
   Teknikal Alchemist lengkap dihitung dari candle live, harga & rekomendasi
   TradingView real-time, lalu AI memberi catatan pada setiap tanda chart
   (BOS, CHoCH, sweep, FVG, OB, SNR, SND, OTE). Level tidak boleh diubah AI:
   SL tepat 30 pip, TP per mode dari likuiditas nyata (Scalp/Day/Swing).
   ===================================================================== */
'use strict';
const C = require('./xau-core');

const PIP = 0.1;
const SL_PIPS = 30;
const TP1_PIPS = 100;
const TP2_PIPS = 200;
const TPMAX_MAX = 600;

const freshLevel = (rows, atrV) => (atrV ? C.r2(atrV * 0.25) : 1);

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
      if (Math.abs(a[i].p - a[j].p) <= tol) out.push({ price: C.r2((a[i].p + a[j].p) / 2), first: a[i].t, last: a[j].t });
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
  return {
    asia: asia.length >= 6 ? { hi: C.r2(hi), lo: C.r2(lo), bars: asia.length } : null,
    dayOpen: open == null ? null : C.r2(open),
    weekOpen: weekOpen ? C.r2(weekOpen.o) : null,
    judas: (() => {
      if (!asia.length || asia.length < 6) return null;
      const after = rows.filter(r => r.t > asia[asia.length - 1].t);
      if (!after.length) return null;
      const c = rows[rows.length - 1].c;
      const maxH = Math.max(...after.map(r => r.h)), minL = Math.min(...after.map(r => r.l));
      if (maxH > hi && c < hi) return { side: 'high', level: C.r2(hi), why: 'Judas swing: high Asia ' + C.r2(hi) + ' disapu lalu harga kembali di bawahnya.' };
      if (minL < lo && c > lo) return { side: 'low', level: C.r2(lo), why: 'Judas swing: low Asia ' + C.r2(lo) + ' disapu lalu harga kembali di atasnya.' };
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
    return { dir: bull ? 'BULLISH' : 'BEARISH', lo: C.r2(Math.min(p.o, p.c)), hi: C.r2(Math.max(p.o, p.c)), why: 'Mitigation block: candle ' + (bull ? 'turun' : 'naik') + ' terakhir sebelum impuls ' + (bull ? 'naik' : 'turun') + '.' };
  }
  return null;
}

/* Supply/Demand (SND) dari order block dan swing terakhir. */
function sndOf(rows, ob, atrV) {
  const out = [], a = atrV || 1;
  if (ob) out.push({ kind: ob.dir === 'BULLISH' ? 'demand' : 'supply', lo: C.r2(ob.lo), hi: C.r2(ob.hi), why: 'Zona ' + (ob.dir === 'BULLISH' ? 'demand' : 'supply') + ' dari order block M15.' });
  const sw = C.swing(rows, 2);
  const h = sw.hi.slice(-1)[0], l = sw.lo.slice(-1)[0];
  if (h) out.push({ kind: 'supply', lo: C.r2(h.p - a * 0.1), hi: C.r2(h.p + a * 0.35), why: 'Supply di swing high ' + C.r2(h.p) + '.' });
  if (l) out.push({ kind: 'demand', lo: C.r2(l.p - a * 0.35), hi: C.r2(l.p + a * 0.1), why: 'Demand di swing low ' + C.r2(l.p) + '.' });
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
  return { hi: C.r2(hi), lo: C.r2(lo), pos, zone: pos >= 70 ? 'premium' : pos <= 30 ? 'discount' : 'equilibrium' };
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
  if (pack.pd && pack.pd.pos <= 30) push(0.4, 'harga di discount');
  if (pack.pd && pack.pd.pos >= 70) push(-0.4, 'harga di premium');
  if (pack.judas) push(pack.judas.side === 'low' ? 0.9 : -0.9, 'Judas swing sisi ' + pack.judas.side);
  if (pack.mitigation) push(pack.mitigation.dir === 'BULLISH' ? 0.7 : -0.7, 'Mitigation block ' + pack.mitigation.dir);
  if (pack.eq) {
    if ((pack.eq.highs || []).length) push(-0.3, 'Equal highs (likuiditas atas)');
    if ((pack.eq.lows || []).length) push(0.3, 'Equal lows (likuiditas bawah)');
  }
  const sum = v.reduce((a, x) => a + x.w, 0), tot = v.reduce((a, x) => a + Math.abs(x.w), 0) || 1;
  return { dir: sum >= 0 ? 'BUY' : 'SELL', strength: Math.round(Math.abs(sum) / tot * 100), votes: v };
}

function markersOf(pack) {
  const m = [];
  const add = (type, label, price, why, extra) => m.push({ id: 'm' + (m.length + 1), type, label, price: C.r2(price), why, ...(extra || {}) });
  /* ---------- M5: dasar entry (candle M5 yang sudah close) ---------- */
  if (pack.m5bos) add('BOS', 'M5 Break of Structure', pack.m5bos.level, 'M5 close menembus swing ' + (pack.m5bos.dir === 'BULLISH' ? 'high' : 'low') + ' → trigger M5 ' + pack.m5bos.dir + '.', { tf: 'M5' });
  if (pack.m5sweep) add('SWEEP', 'M5 liquidity sweep', pack.m5sweep.level, 'Sapuan likuiditas M5: ' + pack.m5sweep.why, { tf: 'M5' });
  (pack.m5fvgs || []).slice(-3).forEach(z => add('FVG', 'M5 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG M5 ' + z.lo + '–' + z.hi + ' — area retest entry M5.', { zone: [z.lo, z.hi], side: z.kind, tf: 'M5' }));
  if (pack.m5ob) add('OB', 'M5 Order Block ' + (pack.m5ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.m5ob.dir === 'BULLISH' ? pack.m5ob.lo : pack.m5ob.hi, 'Order block M5 dari candle impuls terakhir (' + pack.m5ob.strength + '× ATR M5).', { zone: [pack.m5ob.lo, pack.m5ob.hi], side: pack.m5ob.dir.toLowerCase(), tf: 'M5' });
  if (pack.m5structure && pack.m5structure.lastHi != null) add('SNR', 'M5 swing high', pack.m5structure.lastHi, 'Swing high M5 terakhir — resistance mikro untuk entry M5.', { tf: 'M5' });
  if (pack.m5structure && pack.m5structure.lastLo != null) add('SNR', 'M5 swing low', pack.m5structure.lastLo, 'Swing low M5 terakhir — support mikro untuk entry M5.', { tf: 'M5' });
  (pack.m5eq && pack.m5eq.highs || []).slice(-2).forEach(x => add('EQH', 'M5 equal highs', x.price, 'Dua swing high M5 berdekatan — likuiditas mikro di atas.', { tf: 'M5' }));
  (pack.m5eq && pack.m5eq.lows || []).slice(-2).forEach(x => add('EQL', 'M5 equal lows', x.price, 'Dua swing low M5 berdekatan — likuiditas mikro di bawah.', { tf: 'M5' }));
  /* ---------- M15 / D1: konteks & POI ---------- */
  if (pack.bos) add('BOS', 'M15 Break of Structure', pack.bos.level, 'M15 close menembus swing ' + (pack.bos.dir === 'BULLISH' ? 'high' : 'low') + ' terakhir → struktur ' + pack.bos.dir + '.', { tf: 'M15' });
  if (pack.choch) add('CHoCH', 'M5 Change of Character', pack.choch.level, 'Struktur M5 berbalik dari ' + pack.choch.from + ' ke ' + pack.choch.to + '.', { tf: 'M5' });
  if (pack.sweep) add('SWEEP', 'M15 liquidity sweep', pack.sweep.level, pack.sweep.why, { tf: 'M15' });
  (pack.fvgs || []).forEach(z => add('FVG', 'M15 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'Gap M15 ' + (z.kind === 'bull' ? 'naik' : 'turun') + ' ' + z.lo + '–' + z.hi + ' — POI retest.', { zone: [z.lo, z.hi], side: z.kind, tf: 'M15' }));
  if (pack.ob) add('OB', 'M15 Order Block ' + (pack.ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.ob.dir === 'BULLISH' ? pack.ob.lo : pack.ob.hi, 'Candle impuls M15 terakhir ' + pack.ob.dir.toLowerCase() + ' (body ' + pack.ob.strength + '× ATR).', { zone: [pack.ob.lo, pack.ob.hi], side: pack.ob.dir.toLowerCase(), tf: 'M15' });
  if (pack.structure.lastLo) add('SNR', 'M15 support (swing low)', pack.structure.lastLo, 'Swing low M15 terakhir — area pantulan/reaksi.', { tf: 'M15' });
  if (pack.structure.lastHi) add('SNR', 'M15 resistance (swing high)', pack.structure.lastHi, 'Swing high M15 terakhir — area penolakan.', { tf: 'M15' });
  if (pack.ote) add('OTE', 'M15 Optimal Trade Entry', pack.ote.long[1], 'Zona 62–79% retracement M15 (long ' + pack.ote.long[0] + '–' + pack.ote.long[1] + ', short ' + pack.ote.short[0] + '–' + pack.ote.short[1] + ').', { tf: 'M15' });
  /* ---------- H1/H4: konteks top-down untuk Day & Swing ---------- */
  if (pack.h1bos) add('BOS', 'H1 Break of Structure', pack.h1bos.level, 'H1 close menembus swing ' + (pack.h1bos.dir === 'BULLISH' ? 'high' : 'low') + ' → bias H1 ' + pack.h1bos.dir + '.', { tf: 'H1' });
  if (pack.h4bos) add('BOS', 'H4 Break of Structure', pack.h4bos.level, 'H4 close menembus swing ' + (pack.h4bos.dir === 'BULLISH' ? 'high' : 'low') + ' → bias H4 ' + pack.h4bos.dir + '.', { tf: 'H4' });
  (pack.h1fvgs || []).slice(-2).forEach(z => add('FVG', 'H1 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG H1 ' + z.lo + '–' + z.hi + ' — POI Day.', { zone: [z.lo, z.hi], side: z.kind, tf: 'H1' }));
  (pack.h4fvgs || []).slice(-2).forEach(z => add('FVG', 'H4 Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'FVG H4 ' + z.lo + '–' + z.hi + ' — POI Swing.', { zone: [z.lo, z.hi], side: z.kind, tf: 'H4' }));
  if (pack.h1ob) add('OB', 'H1 Order Block ' + (pack.h1ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.h1ob.dir === 'BULLISH' ? pack.h1ob.lo : pack.h1ob.hi, 'Order block H1 — POI untuk mode Day.', { zone: [pack.h1ob.lo, pack.h1ob.hi], side: pack.h1ob.dir.toLowerCase(), tf: 'H1' });
  if (pack.h4ob) add('OB', 'H4 Order Block ' + (pack.h4ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.h4ob.dir === 'BULLISH' ? pack.h4ob.lo : pack.h4ob.hi, 'Order block H4 — POI untuk mode Swing.', { zone: [pack.h4ob.lo, pack.h4ob.hi], side: pack.h4ob.dir.toLowerCase(), tf: 'H4' });
  if (pack.h1structure && pack.h1structure.lastLo) add('SNR', 'H1 swing low', pack.h1structure.lastLo, 'Swing low H1 — support struktural.', { tf: 'H1' });
  if (pack.h1structure && pack.h1structure.lastHi) add('SNR', 'H1 swing high', pack.h1structure.lastHi, 'Swing high H1 — resistance struktural.', { tf: 'H1' });
  if (pack.h4structure && pack.h4structure.lastLo) add('SNR', 'H4 swing low', pack.h4structure.lastLo, 'Swing low H4 — support utama.', { tf: 'H4' });
  if (pack.h4structure && pack.h4structure.lastHi) add('SNR', 'H4 swing high', pack.h4structure.lastHi, 'Swing high H4 — resistance utama.', { tf: 'H4' });
  /* POI setup aktif diberi penanda khusus agar yang digambar chart = yang dipakai entry. */
  (pack.setups || []).forEach(s => {
    if (!s || s.status === 'LEWAT') return;
    add('POI', 'POI ' + s.style + ' · ' + s.poiTf, s.entry, s.why, { tf: s.poiTf, style: s.style, zone: s.zone, side: s.dir === 'BUY' ? 'demand' : 'supply', active: true });
  });
  if (pack.pdh != null) add('PDH', 'Previous Day High', pack.pdh, 'High hari sebelumnya — target likuiditas.', { tf: 'D1' });
  if (pack.pdl != null) add('PDL', 'Previous Day Low', pack.pdl, 'Low hari sebelumnya — target likuiditas.', { tf: 'D1' });
  if (pack.pools) {
    (pack.pools.highs || []).slice(0, 2).forEach(p => add('LIQ', 'Liquidity high', p, 'Titik stop buy/sell-side liquidity di atas harga.'));
    (pack.pools.lows || []).slice(0, 2).forEach(p => add('LIQ', 'Liquidity low', p, 'Titik stop buy/sell-side liquidity di bawah harga.'));
  }
  (pack.snd || []).forEach(z => add('SND', z.kind === 'demand' ? 'Demand zone' : 'Supply zone', z.kind === 'demand' ? z.hi : z.lo, z.why, { zone: [z.lo, z.hi], side: z.kind }));
  if (pack.mitigation) add('MB', 'Mitigation block', pack.mitigation.dir === 'BULLISH' ? pack.mitigation.hi : pack.mitigation.lo, pack.mitigation.why, { zone: [pack.mitigation.lo, pack.mitigation.hi], side: pack.mitigation.dir.toLowerCase() });
  (pack.eq && pack.eq.highs || []).slice(0, 2).forEach(x => add('EQH', 'Equal highs', x.price, 'Dua swing high berdekatan dalam toleransi ATR — likuiditas di atas.'));
  (pack.eq && pack.eq.lows || []).slice(0, 2).forEach(x => add('EQL', 'Equal lows', x.price, 'Dua swing low berdekatan dalam toleransi ATR — likuiditas di bawah.'));
  if (pack.sessionLevels && pack.sessionLevels.judas) add('JUDAS', 'Judas swing', pack.sessionLevels.judas.level, pack.sessionLevels.judas.why);
  if (pack.sessionLevels && pack.sessionLevels.asia) add('ASIA', 'Asian range high', pack.sessionLevels.asia.hi, 'High sesi Asia — target sweep pertama.');
  if (pack.sessionLevels && pack.sessionLevels.dayOpen != null) add('DO', 'Daily open', pack.sessionLevels.dayOpen, 'Open hari ini (00:00 UTC) — bias intraday.');
  if (pack.sessionLevels && pack.sessionLevels.weekOpen != null) add('WO', 'Weekly open', pack.sessionLevels.weekOpen, 'Open minggu ini — magnet likuiditas mingguan.', { tf: 'W1' });
  /* Buang duplikat (jenis + harga dalam 5 pip) supaya chart tidak menumpuk. */
  const seen = new Set();
  return m.filter(x => { const k = x.type + ':' + Math.round(x.price / 0.5); if (seen.has(k)) return false; seen.add(k); return true; });
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
  const recOk = items.every(x => x.rec != null && x.rec * sign >= -0.12);
  const structOk = items.every(x => {
    const ts = x.trend === 'naik' || x.trend === 'BULLISH' ? 1 : x.trend === 'turun' || x.trend === 'BEARISH' ? -1 : 0;
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
  const add = (tf, kind, lo, hi, src, why) => {
    if (lo == null || hi == null || !(hi >= lo)) return;
    if (bull ? kind !== 'demand' : kind !== 'supply') return;
    out.push({ tf, kind, lo: C.r2(lo), hi: C.r2(hi), entry: C.r2(bull ? hi : lo), src, why });
  };
  const fv = (arr, tf) => (arr || []).filter(z => z.kind === (bull ? 'bull' : 'bear')).slice(-2).forEach(z => add(tf, bull ? 'demand' : 'supply', z.lo, z.hi, 'FVG ' + tf, 'Fair Value Gap ' + tf + ' ' + z.lo + '–' + z.hi));
  const ob = (o, tf) => { if (o && o.dir === (bull ? 'BULLISH' : 'BEARISH')) add(tf, bull ? 'demand' : 'supply', o.lo, o.hi, 'OB ' + tf, 'Order block ' + tf + ' (' + (o.strength || '—') + '× ATR)'); };
  if (style === 'SCALPING') {
    fv(pack.m5fvgs, 'M5'); ob(pack.m5ob, 'M5'); fv(pack.fvgs, 'M15'); ob(pack.ob, 'M15');
  } else if (style === 'DAY') {
    fv(pack.fvgs, 'M15'); ob(pack.ob, 'M15'); fv(pack.h1fvgs, 'H1'); ob(pack.h1ob, 'H1');
  } else {
    fv(pack.h4fvgs, 'H4'); ob(pack.h4ob, 'H4'); fv(pack.h1fvgs, 'H1'); ob(pack.h1ob, 'H1');
  }
  (pack.snd || []).forEach(z => add(style === 'SWING' ? 'H4' : 'M15', z.kind, z.lo, z.hi, 'SND ' + (style === 'SWING' ? 'H4' : 'M15'), z.why));
  if (pack.ote) {
    const z = bull ? pack.ote.long : pack.ote.short;
    add(style === 'SWING' ? 'H4' : 'M15', bull ? 'demand' : 'supply', z[0], z[1], 'OTE', 'Optimal Trade Entry 62–79%');
  }
  return out;
}

function buildModeSetups(pack, dir) {
  const sign = dir === 'BUY' ? 1 : -1;
  const atr = pack.atr5 || 2.5;
  const trigger = (() => {
    if (pack.m5bos && (pack.m5bos.dir === 'BULLISH') === (dir === 'BUY')) return { ok: true, why: 'BOS M5 ' + pack.m5bos.dir + ' @ ' + pack.m5bos.level };
    if (pack.m5sweep && ((pack.m5sweep.kind === 'low') === (dir === 'BUY'))) return { ok: true, why: 'sweep likuiditas M5 sisi ' + pack.m5sweep.kind + ' @ ' + pack.m5sweep.level };
    const z = (pack.m5fvgs || []).filter(x => x.kind === (dir === 'BUY' ? 'bull' : 'bear')).slice(-1)[0];
    if (z) return { ok: true, why: 'FVG M5 ' + z.lo + '–' + z.hi };
    if (pack.m5ob && (pack.m5ob.dir === 'BULLISH') === (dir === 'BUY')) return { ok: true, why: 'OB M5 ' + pack.m5ob.dir };
    return { ok: false, why: 'belum ada BOS/sweep/FVG/OB M5 searah ' + dir };
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
    if (z) usedEntries.push(z.entry);
    if (!z) return;
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
    let tpMax = pool[pool.length - 1];
    if (tpMax.pips <= tp2.pips && maxPips > tp2.pips + 30) {
      const pm = Math.min(maxPips, Math.max(tp2.pips + 60, Math.round((pack.atr5Pips || 30) * 9)));
      if (pm > tp2.pips) tpMax = { price: C.r2(z.entry + sign * pm * PIP), pips: pm, src: ['proyeksi ATR M5'], strength: 1 };
    }
    const allTargets = [...pool];
    if (!allTargets.some(t => Math.abs(t.price - tp2.price) < 0.01)) allTargets.push(tp2);
    if (!allTargets.some(t => Math.abs(t.price - tpMax.price) < 0.01)) allTargets.push(tpMax);
    allTargets.sort((a, b) => a.pips - b.pips);
    const dist = Math.abs(pack.price - z.entry);
    const live = pack.marketOpen !== false && pack.freshness && pack.freshness.candleAgeMin != null && pack.freshness.candleAgeMin <= 20;
    const status = !live ? 'TUNGGU' : !trigger.ok ? 'TUNGGU' : dist <= atr * 0.55 ? 'SIAP' : dist <= atr * 3 ? 'TUNGGU' : 'LEWAT';
    const type = dist <= atr * 0.2 && trigger.ok ? 'MARKET' : 'LIMIT';
    const conf = Math.max(30, Math.min(96,
      52 + (bias.ok ? 10 : 0) + (trigger.ok ? 14 : 0) + (z.tf === 'M15' || z.tf === 'H1' || z.tf === 'H4' ? 8 : 3) + (tp1.pips >= SL_PIPS * 2 ? 8 : 3)
    ));
    const sl = C.r2(z.entry - sign * SL_PIPS * PIP);
    out.push({
      style, dir, entryTf: 'M5', poiTf: z.tf, entry: z.entry, zone: [z.lo, z.hi], sl, tp1: tp1.price, tp2: tp2.price, tpMax: tpMax.price,
      slPips: SL_PIPS, tpPips: tp1.pips, tp2Pips: tp2.pips, tpMaxPips: tpMax.pips,
      rr: Math.round(tp1.pips / SL_PIPS * 10) / 10,
      targets: allTargets.slice(0, 5).map(t => ({ price: t.price, pips: t.pips, src: t.src.join(' + '), strength: t.strength })),
      status, type, conf, bias: bias.items, trigger: trigger.why, poi: z.src,
      why: style + ' ' + dir + ' — ' + biasLabel + ' bias (' + bias.why + '); POI ' + z.tf + ' ' + z.src + ' @ ' + z.entry + ' (' + z.why + '); trigger: ' + trigger.why + '; TP dari likuiditas nyata (' + tp1.src.join(' + ') + ').',
      invalidation: 'M5 close di luar zona ' + z.tf + ' atau menembus SL ' + sl + '.',
      valid: status !== 'LEWAT', risk: 3
    });
  });
  const rank = { SIAP: 0, TUNGGU: 1, LEWAT: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || b.conf - a.conf).slice(0, 3);
}

async function aiMarks(pack) {
  const sys = `Kamu trader XAUUSD profesional metode Alchemist. Waktu UTC: ${new Date().toUTCString()}.
Tugas: periksa tanda chart M5/M15 yang SUDAH dihitung mesin, lalu beri catatan profesional pada tiap tanda. Jangan membuat harga/level baru; hanya boleh memakai id dan harga yang ada.
KONTEKS: semua entry memakai timeframe M5, SL tepat 30 pip, TP dari likuiditas nyata (swing H1/H4, EQH/EQL, PDH/PDL, sesi, ADR). Setiap mode punya POI berbeda: Scalping M5/M15, Day M15/H1, Swing H4/H1. Jangan mengubah entry, SL, atau TP.
ATURAN WAJIB: arahMesin adalah arah FINAL satu-satunya. Field "bias" WAJIB sama dengan arahMesin; jangan pernah menyarankan BUY dan SELL sekaligus. Bila kamu tidak setuju, tetap pakai arahMesin dan tulis risikonya di "invalidation". Untuk setiap setup, jelaskan apakah POI, trigger M5, dan TP memang searah; jangan mengarang data baru.
Balas HANYA JSON: {"bias":"BUY|SELL","summary":"2-4 kalimat","marks":[{"id":"m1","note":"kenapa tanda ini penting (maks 180 karakter)","confidence":"TINGGI|SEDANG|RENDAH"}],"confluence":["..."],"invalidation":"kondisi yang membatalkan bias"}`;
  const data = {
    /* tanda diletakkan paling depan supaya tidak pernah terpotong saat payload panjang */
    tanda: pack.markers.map(m => ({ id: m.id, tf: m.tf || '', type: m.type, label: m.label, price: m.price, why: m.why })),
    jumlahTanda: pack.markers.length,
    harga: pack.price, sumberHarga: pack.priceSource, arahMesin: pack.direction, kekuatan: pack.directionStrength, entryTf: 'M5',
    matriksTF: (pack.tfMatrix || []).map(x => ({ tf: x.tf, rec: x.rec, value: x.value })),
    m5: { struktur: pack.m5structure, bos: pack.m5bos, sweep: pack.m5sweep, fvg: (pack.m5fvgs || []).slice(-3), ob: pack.m5ob, eq: pack.m5eq, pd: pack.m5pd, atr5: pack.atr5, rsi5: pack.rsi5 },
    m15: { struktur: pack.structure, bos: pack.bos, choch: pack.choch, sweep: pack.sweep, fvg: (pack.fvgs || []).slice(-3), ob: pack.ob, snd: pack.snd, ote: pack.ote, pd: pack.pd, pdh: pack.pdh, pdl: pack.pdl, atr: pack.atr, rsi: pack.rsi, ema20: pack.ema20, ema50: pack.ema50, sesi: pack.session, adr: pack.adr },
    h1: { struktur: pack.h1structure, bos: pack.h1bos, sweep: pack.h1sweep, fvg: (pack.h1fvgs || []).slice(-2), ob: pack.h1ob, eq: pack.h1eq, atr: pack.atr1 },
    h4: { struktur: pack.h4structure, bos: pack.h4bos, sweep: pack.h4sweep, fvg: (pack.h4fvgs || []).slice(-2), ob: pack.h4ob, eq: pack.h4eq, atr: pack.atr4 },
    setup: (pack.setups || []).map(s => ({ style: s.style, dir: s.dir, status: s.status, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2, tpMax: s.tpMax, poi: s.poiTf, trigger: s.trigger, why: s.why, rr: s.rr, conf: s.conf })),
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
  const anchor = tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : last.c;
  const shift = priceShift(last.c, anchor);
  const dailyRows = d.d1 ? d.d1.rows : null;
  const dcloses = dailyRows ? dailyRows.map(r => r.c) : [];
  const atr14 = C.atr(rows, 14), atr5 = m5a ? C.atr(m5a, 14) : null;
  const h1a = d.h1 && d.h1.rows ? d.h1.rows : [];
  const h4a = d.h4 && d.h4.rows ? d.h4.rows : [];
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
    if (gch > 0.5 && dch < 0) return { dir: 1, tf, why: 'SMT ' + tf + ': emas naik sementara DXY turun — konfirmasi risk-on untuk emas' };
    if (gch < -0.5 && dch > 0) return { dir: -1, tf, why: 'SMT ' + tf + ': emas turun sementara DXY naik — tekanan turun' };
    return { dir: 0, tf, why: 'SMT ' + tf + ' netral (emas dan DXY bergerak searah/tidak jelas)' };
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
    asia: sessRaw.asia ? { hi: C.r2(sessRaw.asia.hi + shift), lo: C.r2(sessRaw.asia.lo + shift), bars: sessRaw.asia.bars } : null,
    dayOpen: sessRaw.dayOpen == null ? null : C.r2(sessRaw.dayOpen + shift),
    weekOpen: sessRaw.weekOpen == null ? null : C.r2(sessRaw.weekOpen + shift),
    judas: sessRaw.judas ? { ...sessRaw.judas, level: C.r2(sessRaw.judas.level + shift) } : null
  };
  const mitRaw = mitigationOf(rows, atr14);
  const mit = mitRaw ? { ...mitRaw, lo: C.r2(mitRaw.lo + shift), hi: C.r2(mitRaw.hi + shift) } : null;
  const sndRaw = sndOf(rows, ob, atr14);
  const snd = sndRaw.map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) }));
  const calList = await C.calendar().catch(() => []);
  const packRaw = {
    price: C.r2(anchor), tvSymbol: (tv && tv.ok && tv.symbol) || C.TV_SYMBOL, priceSource: tv && tv.ok ? 'chart TradingView ' + (tv.symbol || C.TV_SYMBOL) : sp && sp.ok ? 'spot gold-api' : 'candle ' + C.Y_SYM,
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
    m5: st5 ? { trend: st5.trend, lastHi: st5.lastHi == null ? null : C.r2(st5.lastHi + shift), lastLo: st5.lastLo == null ? null : C.r2(st5.lastLo + shift) } : null,
    m5structure: st5 ? { trend: st5.trend, lastHi: st5.lastHi == null ? null : C.r2(st5.lastHi + shift), lastLo: st5.lastLo == null ? null : C.r2(st5.lastLo + shift), hi: (st5.hi || []).map(x => C.r2(x + shift)), lo: (st5.lo || []).map(x => C.r2(x + shift)) } : null,
    m5bos: st5 && st5.bos ? { ...st5.bos, level: C.r2(st5.bos.level + shift) } : null,
    m5sweep: sw5 ? { ...sw5, level: C.r2(sw5.level + shift) } : null,
    m5fvgs: fvg5,
    m5ob: ob5,
    m5eq: eq5,
    m5pd: pd5 ? { hi: C.r2(pd5.hi + shift), lo: C.r2(pd5.lo + shift), pos: pd5.pos, zone: pd5.zone } : null,
    entryTf: 'M5',
    bos: st.bos ? { ...st.bos, level: C.r2(st.bos.level + shift) } : null,
    choch: st5 && st5.trend !== 'RANGE' && st.trend !== st5.trend
      ? { level: C.r2((st5.trend === 'BEARISH' ? st5.lastLo : st5.lastHi) + shift), from: st.trend, to: st5.trend }
      : null,
    sweep: sw ? { ...sw, level: C.r2(sw.level + shift) } : null,
    fvgs, ob: ob ? { ...ob, lo: C.r2(ob.lo + shift), hi: C.r2(ob.hi + shift) } : null,
    ote: C.ote(rows), pd, pdh: prevDay ? C.r2(prevDay.h + shift) : null, pdl: prevDay ? C.r2(prevDay.l + shift) : null,
    atr: C.r2(atr14), atr5: C.r2(atr5), atr5Pips: atr5 ? Math.round(atr5 / PIP) : null, atrPips: atr14 ? Math.round(atr14 / PIP) : null, rsi: C.r2(C.rsi(rows.map(r => r.c), 14)), rsi5: m5a ? C.r2(C.rsi(m5a.map(r => r.c), 14)) : null,
    ema20: C.r2(ema20), ema50: C.r2(ema50), daily: dailyStatus, smt, session: C.sessionInfo(), pdRange: { hi: C.r2(pd.hi + shift), lo: C.r2(pd.lo + shift), pos: pd.pos, zone: pd.zone },
    pools: { highs: [...rows.slice(-80).map(r => C.r2(r.h + shift))].sort((a, b) => b - a).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3), lows: [...rows.slice(-80).map(r => C.r2(r.l + shift))].sort((a, b) => a - b).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) },
    eq, sessionLevels: sess, mitigation: mit, snd, adr: adrOf(dailyRows), tfMatrix: tfMatrix(tv), eventRisk: eventRiskOf(calList),
    macro: {
      dxy5d: d.dxy ? C.r2((d.dxy.rows[d.dxy.rows.length - 1].c / d.dxy.rows[Math.max(0, d.dxy.rows.length - 6)].c - 1) * 100) : null,
      yield10_5d: d.tnx ? C.r2(d.tnx.rows[d.tnx.rows.length - 1].c - d.tnx.rows[Math.max(0, d.tnx.rows.length - 6)].c) : (d.us10Tv ? C.r2(d.us10Tv.rows[d.us10Tv.rows.length - 1].c - d.us10Tv.rows[Math.max(0, d.us10Tv.rows.length - 6)].c) : null),
      dxy15m: d.dxyTv ? C.r2((d.dxyTv.rows[d.dxyTv.rows.length - 1].c / d.dxyTv.rows[Math.max(0, d.dxyTv.rows.length - 6)].c - 1) * 100) : null,
      us10y15m: d.us10Tv ? C.r2(d.us10Tv.rows[d.us10Tv.rows.length - 1].c - d.us10Tv.rows[Math.max(0, d.us10Tv.rows.length - 6)].c) : null,
      gold1d: dcloses.length > 1 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 2] - 1) * 100) : null,
      gold5d: dcloses.length > 5 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 6] - 1) * 100) : null
    },
    chart: { rows: rows.slice(-160), m15: rows.slice(-160), m5: m5 ? m5.slice(-300) : null, h1: h1a.slice(-160), h4: h4a.slice(-160), d1: dailyRows ? dailyRows.slice(-40) : null, pip: PIP, anchor: C.r2(anchor), shift: C.r2(shift), entryTf: 'M5', tvSymbol: (tv && tv.ok && tv.symbol) || C.TV_SYMBOL },
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
  const dv = directionVote(packRaw);
  packRaw.direction = dv.dir; packRaw.directionStrength = dv.strength; packRaw.votes = dv.votes;
  packRaw.setups = buildModeSetups(packRaw, dv.dir);
  packRaw.markers = markersOf(packRaw);
  return packRaw;
}

async function signalHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const b = (req && req.body) || {};
    if (!b.fresh && cache && Date.now() - cache.t < 20000) return res.status(200).json({ ...cache.v, cached: true });
    const pack = await build();
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
    pack.generatedAt = new Date().toISOString();
    pack.direction = pack.setups.length ? pack.setups[0].dir : pack.direction;
    const sign = pack.direction === 'BUY' ? 1 : -1;
    const htf = pack.tv && pack.tv.tf ? ['D', '240', '60'].map(k => pack.tv.tf[k] && pack.tv.tf[k].rec).filter(v => v != null) : [];
    pack.plan = pack.setups.find(s => s.status === 'SIAP' && s.style === 'DAY')
      || pack.setups.find(s => s.status === 'SIAP')
      || pack.setups.find(s => s.style === 'DAY')
      || pack.setups[0] || null;
    pack.checklist = [
      { k: 'Bias D1/H4/H1 searah', ok: htf.length >= 2 && htf.every(v => v * sign >= -0.1), d: (pack.tfMatrix || []).slice(0, 3).map(x => x.tf + ' ' + x.rec).join(' · ') || 'TF global tidak lengkap' },
      { k: 'POI M15 tersedia', ok: !!(pack.ob || (pack.snd || []).length || pack.ote), d: pack.ob ? 'Order block M15 + zona SND/OTE' : 'POI dari struktur M15' },
      { k: 'Trigger M5 valid', ok: !!(pack.m5bos || pack.m5sweep || (pack.m5fvgs || []).length || pack.m5ob), d: (pack.m5bos ? 'BOS M5 · ' : '') + (pack.m5sweep ? 'sweep M5 · ' : '') + ((pack.m5fvgs || []).length ? (pack.m5fvgs || []).length + ' FVG M5' : 'struktur M5') },
      { k: 'RR TP1 minimal 1:2', ok: !!(pack.plan && pack.plan.rr >= 2), d: pack.plan ? 'TP1 ' + pack.plan.tpPips + ' pip / SL 30 pip = 1:' + pack.plan.rr : 'belum ada setup' },
      { k: 'Risiko rilis aman', ok: pack.eventRisk && pack.eventRisk.level !== 'TINGGI', d: pack.eventRisk ? pack.eventRisk.note : 'kalender tidak tersedia' },
      { k: 'Ruang ADR cukup', ok: !!(pack.adr && pack.adr.remainingPips > 60), d: pack.adr ? 'sisa ' + pack.adr.remainingPips + ' pip dari ADR ' + pack.adr.avgPips + ' pip' : 'ADR tidak tersedia' }
    ];
    pack.sources = [
      { name: 'TradingView chart & TA real-time ' + C.TV_SYMBOL, ok: !!(pack.tv && pack.tv.ok) },
      { name: 'Candle ' + (pack.freshness && pack.freshness.candleSource || 'TradingView') + ' M5/M15/D1', ok: !!(pack.chart && pack.chart.m5) },
      { name: 'gold-api.com spot', ok: !!(pack.spot && pack.spot.ok) },
      { name: 'DXY & yield 10Y (Yahoo)', ok: !!pack.macro },
      { name: 'Kalender ekonomi USD (risiko rilis)', ok: !!(pack.eventRisk && pack.eventRisk.items) },
      { name: 'AI multi-provider (fallback otomatis)', ok: !!(pack.ai && pack.ai.ok) }
    ];
    pack.validation = [
      { k: 'Harga acuan', ok: true, d: pack.priceSource + ' · ' + pack.price },
      { k: 'Candle M5 entry', ok: !!(pack.chart.m5 && pack.chart.m5.length >= 60) && pack.marketOpen !== false, d: (pack.chart.m5 || []).length + ' candle M5 · ' + (pack.freshness && pack.freshness.candleAgeMin != null ? pack.freshness.candleAgeMin + ' menit lalu' : 'waktu tidak diketahui') + (pack.marketOpen === false ? ' · pasar tutup/data tertunda' : '') },
      { k: 'Entry & TP', ok: !!(pack.plan && (pack.plan.targets || []).length >= 1), d: pack.plan ? 'Entry M5 · SL 30 pip · TP1 ' + pack.plan.tpPips + ' pip · TPmax ' + pack.plan.tpMaxPips + ' pip' : 'belum ada setup' },
      { k: 'Struktur & likuiditas', ok: !!(pack.structure && pack.markers.length >= 3), d: pack.markers.length + ' tanda chart (M5/M15/D1)' },
      { k: 'Matriks timeframe', ok: (pack.tfMatrix || []).length >= 4, d: (pack.tfMatrix || []).map(x => x.tf + ' ' + x.rec).join(' · ') },
      { k: 'Risiko rilis', ok: pack.eventRisk && pack.eventRisk.level !== 'TINGGI', d: pack.eventRisk ? pack.eventRisk.note : 'kalender tidak tersedia' },
      { k: 'Anotasi AI', ok: !!(pack.ai && pack.ai.ok), d: pack.ai && pack.ai.ok ? pack.ai.annotated + ' tanda diberi catatan' : (pack.ai && pack.ai.error) || 'AI tidak tersedia' }
    ];
    pack.quality = pack.validation.filter(x => x.ok).length / pack.validation.length * 100;
    pack.checkScore = Math.round(pack.checklist.filter(x => x.ok).length / pack.checklist.length * 100);
    cache = { t: Date.now(), v: pack };
    return res.status(200).json(pack);
  } catch (e) {
    return res.status(200).json({ ok: false, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = { signalHandler, build, markersOf, directionVote, buildModeSetups };
