/* =====================================================================
   SIGNAL ENTRY — ditulis ulang dari nol.
   Teknikal Alchemist lengkap dihitung dari candle live, harga & rekomendasi
   TradingView real-time, lalu AI memberi catatan pada setiap tanda chart
   (BOS, CHoCH, sweep, FVG, OB, SNR, SND, OTE). Level tidak boleh diubah AI:
   SL tepat 30 pip, TP1 >=100, TP2 >=200, TPmax dari konfluensi.
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
  if (tv && tv.ok) {
    push(tv.tf.D.rec ? tv.tf.D.rec * 1.6 : 0, 'TradingView 1D ' + tv.tf.D.recLabel);
    push(tv.tf['240'].rec ? tv.tf['240'].rec * 1.4 : 0, 'TradingView 4H ' + tv.tf['240'].recLabel);
    push(tv.tf['60'].rec ? tv.tf['60'].rec * 1.1 : 0, 'TradingView 1H ' + tv.tf['60'].recLabel);
    push(tv.tf['15'].rec ? tv.tf['15'].rec * 0.9 : 0, 'TradingView 15m ' + tv.tf['15'].recLabel);
  }
  const st = pack.structure;
  if (st.trend !== 'RANGE') push(st.trend === 'BULLISH' ? 2 : -2, 'struktur M15 ' + st.trend);
  if (pack.m5 && pack.m5.trend !== 'RANGE') push(pack.m5.trend === 'BULLISH' ? 1 : -1, 'struktur M5 ' + pack.m5.trend);
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
  if (pack.bos) add('BOS', 'Break of Structure', pack.bos.level, 'Harga menembus swing ' + (pack.bos.dir === 'BULLISH' ? 'high' : 'low') + ' terakhir → struktur ' + pack.bos.dir + '.');
  if (pack.choch) add('CHoCH', 'Change of Character', pack.choch.level, 'Struktur berbalik dari ' + pack.choch.from + ' ke ' + pack.choch.to + '.');
  if (pack.sweep) add('SWEEP', 'Liquidity sweep', pack.sweep.level, pack.sweep.why);
  (pack.fvgs || []).forEach(z => add('FVG', 'Fair Value Gap ' + (z.kind === 'bull' ? 'bullish' : 'bearish'), z.kind === 'bull' ? z.lo : z.hi, 'Gap ' + (z.kind === 'bull' ? 'naik' : 'turun') + ' ' + z.lo + '–' + z.hi + ' belum terisi penuh.', { zone: [z.lo, z.hi], side: z.kind }));
  if (pack.ob) add('OB', 'Order Block ' + (pack.ob.dir === 'BULLISH' ? 'demand' : 'supply'), pack.ob.dir === 'BULLISH' ? pack.ob.lo : pack.ob.hi, 'Candle impuls terakhir ' + pack.ob.dir.toLowerCase() + ' (body ' + pack.ob.strength + '× ATR).', { zone: [pack.ob.lo, pack.ob.hi], side: pack.ob.dir.toLowerCase() });
  if (pack.structure.lastLo) add('SNR', 'Support (swing low)', pack.structure.lastLo, 'Swing low M15 terakhir — area pantulan/reaksi.');
  if (pack.structure.lastHi) add('SNR', 'Resistance (swing high)', pack.structure.lastHi, 'Swing high M15 terakhir — area penolakan.');
  if (pack.ote) add('OTE', 'Optimal Trade Entry', pack.ote.long[1], 'Zona 62–79% retracement (long ' + pack.ote.long[0] + '–' + pack.ote.long[1] + ', short ' + pack.ote.short[0] + '–' + pack.ote.short[1] + ').');
  if (pack.pdh != null) add('PDH', 'Previous Day High', pack.pdh, 'High hari sebelumnya — target likuiditas.');
  if (pack.pdl != null) add('PDL', 'Previous Day Low', pack.pdl, 'Low hari sebelumnya — target likuiditas.');
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
  if (pack.sessionLevels && pack.sessionLevels.weekOpen != null) add('WO', 'Weekly open', pack.sessionLevels.weekOpen, 'Open minggu ini — magnet likuiditas mingguan.');
  return m;
}

function priceShift(raw, anchor) { return raw && anchor ? C.r2(anchor - raw) : 0; }

function buildSetups(pack, dir, sim) {
  const d = dir === 'BUY' ? 1 : -1;
  const price = pack.price;
  const atr = pack.atr || 3;
  const cand = [];
  const mk = (style, entry, why, conf) => {
    if (entry == null || !isFinite(entry)) return;
    const sl = C.r2(entry - d * SL_PIPS * PIP);
    const tp1 = C.r2(entry + d * TP1_PIPS * PIP);
    const tp2 = C.r2(entry + d * TP2_PIPS * PIP);
    const liq = bull
      ? (pack.eq && pack.eq.highs && pack.eq.highs[0] && pack.eq.highs[0].price) || (pack.pools && Math.max(...(pack.pools.highs || [price])))
      : (pack.eq && pack.eq.lows && pack.eq.lows[0] && pack.eq.lows[0].price) || (pack.pools && Math.min(...(pack.pools.lows || [price])));
    const target = liq && isFinite(liq) && Math.abs(liq - price) > atr ? liq : price + d * atr * 3;
    const tpMaxPips = Math.round(Math.min(TPMAX_MAX, Math.max(TP2_PIPS + 60, Math.abs(target - entry) / PIP)));
    const tpMax = C.r2(entry + d * tpMaxPips * PIP);
    const dist = Math.abs(price - entry);
    const status = dist <= atr * 0.6 ? 'SIAP' : dist <= atr * 2.2 ? 'TUNGGU' : 'LEWAT';
    cand.push({
      style, dir, entry: C.r2(entry), sl, tp1, tp2, tpMax, slPips: SL_PIPS, tpPips: TP1_PIPS, tp2Pips: TP2_PIPS, tpMaxPips,
      rr: 2.5, type: entry === price ? 'MARKET' : 'LIMIT', status, why, conf,
      valid: status !== 'LEWAT', risk: C.r2(Math.abs(entry - sl))
    });
  };
  const bull = dir === 'BUY';
  const fvgNear = (pack.fvgs || []).filter(z => (bull ? z.kind === 'bull' : z.kind === 'bear')).slice(-1)[0];
  const sndNear = (pack.snd || []).find(z => z.kind === (bull ? 'demand' : 'supply'));
  const obZone = pack.ob && pack.ob.dir === (bull ? 'BULLISH' : 'BEARISH') ? pack.ob : null;
  const oteZone = pack.ote ? (bull ? pack.ote.long : pack.ote.short) : null;
  if (fvgNear) mk('SCALPING', bull ? fvgNear.lo : fvgNear.hi, 'Retest FVG ' + (bull ? 'bullish' : 'bearish') + ' searah arah tunggal ' + dir + '.', 2);
  mk('SCALPING', C.r2(price - d * Math.min(atr * 0.5, 2.5)), 'Pullback ringan ' + (bull ? 'di bawah' : 'di atas') + ' harga live (momentum M5 searah).', 1);
  if (obZone) mk('DAY', bull ? obZone.lo : obZone.hi, 'Retest order block ' + (bull ? 'demand' : 'supply') + ' M15 — POI utama Alchemist.', 2);
  if (sndNear) mk('DAY', bull ? sndNear.hi : sndNear.lo, 'Retest zona ' + sndNear.kind + ' Alchemist searah ' + dir + '.', 2);
  if (oteZone) mk('DAY', bull ? oteZone[1] : oteZone[0], 'Zona OTE 62–79% retracement searah bias.', 2);
  if (pack.pd) mk('SWING', bull ? C.r2(pack.pd.lo + (pack.pd.hi - pack.pd.lo) * 0.382) : C.r2(pack.pd.lo + (pack.pd.hi - pack.pd.lo) * 0.618), 'Retest dalam zona ' + (bull ? 'discount 38,2%' : 'premium 61,8%') + ' dealing range.', 1);
  if (pack.structure.lastLo && bull) mk('SWING', pack.structure.lastLo, 'Retest swing low M15 (support) searah tren D1.', 1);
  if (pack.structure.lastHi && !bull) mk('SWING', pack.structure.lastHi, 'Retest swing high M15 (resistance) searah tren D1.', 1);
  // Setiap mode wajib punya satu rencana searah, walau POI belum terbentuk.
  if (!cand.some(s => s.style === 'DAY')) mk('DAY', C.r2(price - d * atr * 0.8), 'Pullback ' + atr.toFixed(1) + ' USD searah bias; POI belum terbentuk, tunggu reaksi.', 1);
  if (!cand.some(s => s.style === 'SWING')) mk('SWING', C.r2(price - d * atr * 1.6), 'Retest struktur lebih dalam (' + (atr * 1.6).toFixed(1) + ' USD) searah bias D1.', 1);
  const out = [];
  const seen = new Set();
  cand.forEach(s => { const k = s.style + ':' + s.entry; if (seen.has(k)) return; seen.add(k); out.push(s); });
  const order = { SIAP: 0, TUNGGU: 1, LEWAT: 2 };
  out.sort((a, b) => (order[a.status] - order[b.status]) || (b.conf - a.conf) || (Math.abs(price - a.entry) - Math.abs(price - b.entry)));
  const picked = [];
  ['SCALPING', 'DAY', 'SWING'].forEach(st => { const x = out.find(s => s.style === st && s.status !== 'LEWAT'); if (x) picked.push(x); });
  out.forEach(s => { if (picked.length < 6 && !picked.includes(s)) picked.push(s); });
  return picked.slice(0, 6);
}

async function aiMarks(pack) {
  const sys = `Kamu trader XAUUSD profesional metode Alchemist. Waktu UTC: ${new Date().toUTCString()}.
Tugas: periksa tanda chart yang SUDAH dihitung mesin, lalu beri catatan profesional pada tiap tanda. Jangan membuat harga/level baru; hanya boleh memakai id dan harga yang ada.
ATURAN WAJIB: arahMesin adalah arah FINAL satu-satunya. Field "bias" WAJIB sama dengan arahMesin; jangan pernah menyarankan BUY dan SELL sekaligus. Bila kamu tidak setuju, tetap pakai arahMesin dan tulis risikonya di "invalidation".
Balas HANYA JSON: {"bias":"BUY|SELL","summary":"2-4 kalimat","marks":[{"id":"m1","note":"kenapa tanda ini penting (maks 180 karakter)","confidence":"TINGGI|SEDANG|RENDAH"}],"confluence":["..."],"invalidation":"kondisi yang membatalkan bias"}`;
  const data = {
    harga: pack.price, sumberHarga: pack.priceSource, arahMesin: pack.direction, kekuatan: pack.directionStrength,
    tf: pack.tv && pack.tv.tf ? pack.tv.tf : null,
    matriksTF: pack.tfMatrix,
    teknikal: { struktur: pack.structure, bos: pack.bos, choch: pack.choch, sweep: pack.sweep, fvg: pack.fvgs, ob: pack.ob, snd: pack.snd, mitigation: pack.mitigation, eq: pack.eq, ote: pack.ote, premiumDiscount: pack.pd, pdh: pack.pdh, pdl: pack.pdl, atr: pack.atr, rsi: pack.rsi, ema20: pack.ema20, ema50: pack.ema50, sesi: pack.session, smt: pack.smt, sessionLevels: pack.sessionLevels, adr: pack.adr },
    risikoRilis: pack.eventRisk,
    makro: pack.macro,
    tanda: pack.markers.map(m => ({ id: m.id, type: m.type, label: m.label, price: m.price, why: m.why }))
  };
  const out = await C.ai(sys, 'Periksa chart ini:\n' + JSON.stringify(data).slice(0, 16000), { field: 'signal', temp: 0.2, maxTok: 2600, deadlineMs: 26000 });
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
  const last = rows[rows.length - 1];
  const anchor = tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : last.c;
  const shift = priceShift(last.c, anchor);
  const dailyRows = d.d1 ? d.d1.rows : null;
  const dcloses = dailyRows ? dailyRows.map(r => r.c) : [];
  const atr14 = C.atr(rows, 14), atr5 = m5 ? C.atr(m5, 14) : null;
  const st = C.structure(rows), st5 = m5 ? C.structure(m5) : null;
  const sw = C.sweep(rows);
  const fvgs = C.fvg(rows).map(z => ({ ...z, lo: C.r2(z.lo + shift), hi: C.r2(z.hi + shift) }));
  const ob = C.orderBlock(rows, atr14);
  const prevDay = dailyRows && dailyRows.length > 1 ? dailyRows[dailyRows.length - 2] : null;
  const dayRows = rows.filter(r => new Date(r.t).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));
  const rangeHi = Math.max(...rows.slice(-80).map(r => r.h)), rangeLo = Math.min(...rows.slice(-80).map(r => r.l));
  const pd = premiumDiscount(rows);
  const smt = d.dxy && d.dxy.rows.length > 6 ? (() => {
    const gc = rows.slice(-20).map(r => r.c), dc = d.dxy.rows.slice(-20).map(r => r.c);
    const gch = gc[gc.length - 1] - gc[0], dch = dc[dc.length - 1] - dc[0];
    if (gch > 0.5 && dch < 0) return { dir: 1, why: 'SMT: emas naik sementara DXY turun — konfirmasi risk-on untuk emas' };
    if (gch < -0.5 && dch > 0) return { dir: -1, why: 'SMT: emas turun sementara DXY naik — tekanan turun' };
    return { dir: 0, why: 'SMT netral (emas dan DXY bergerak searah/tidak jelas)' };
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
    price: C.r2(anchor), priceSource: tv && tv.ok ? 'chart TradingView ' + C.TV_SYMBOL : sp && sp.ok ? 'spot gold-api' : 'candle ' + C.Y_SYM,
    tv, spot: sp, structure: { ...st, lastHi: st.lastHi == null ? null : C.r2(st.lastHi + shift), lastLo: st.lastLo == null ? null : C.r2(st.lastLo + shift) },
    m5: st5 ? { trend: st5.trend } : null,
    bos: st.bos ? { ...st.bos, level: C.r2(st.bos.level + shift) } : null,
    choch: st5 && st5.trend !== 'RANGE' && st.trend !== st5.trend ? { level: C.r2(anchor), from: st.trend, to: st5.trend } : null,
    sweep: sw ? { ...sw, level: C.r2(sw.level + shift) } : null,
    fvgs, ob: ob ? { ...ob, lo: C.r2(ob.lo + shift), hi: C.r2(ob.hi + shift) } : null,
    ote: C.ote(rows), pd, pdh: prevDay ? C.r2(prevDay.h + shift) : null, pdl: prevDay ? C.r2(prevDay.l + shift) : null,
    atr: C.r2(atr14), atr5: C.r2(atr5), atrPips: atr14 ? Math.round(atr14 / PIP) : null, rsi: C.r2(C.rsi(rows.map(r => r.c), 14)),
    ema20: C.r2(ema20), ema50: C.r2(ema50), daily: dailyStatus, smt, session: C.sessionInfo(), pdRange: { hi: C.r2(pd.hi + shift), lo: C.r2(pd.lo + shift), pos: pd.pos, zone: pd.zone },
    pools: { highs: [...rows.slice(-80).map(r => C.r2(r.h + shift))].sort((a, b) => b - a).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3), lows: [...rows.slice(-80).map(r => C.r2(r.l + shift))].sort((a, b) => a - b).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3) },
    eq, sessionLevels: sess, mitigation: mit, snd, adr: adrOf(dailyRows), tfMatrix: tfMatrix(tv), eventRisk: eventRiskOf(calList),
    macro: {
      dxy5d: d.dxy ? C.r2((d.dxy.rows[d.dxy.rows.length - 1].c / d.dxy.rows[Math.max(0, d.dxy.rows.length - 6)].c - 1) * 100) : null,
      yield10_5d: d.tnx ? C.r2(d.tnx.rows[d.tnx.rows.length - 1].c - d.tnx.rows[Math.max(0, d.tnx.rows.length - 6)].c) : null,
      gold1d: dcloses.length > 1 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 2] - 1) * 100) : null,
      gold5d: dcloses.length > 5 ? C.r2((dcloses[dcloses.length - 1] / dcloses[dcloses.length - 6] - 1) * 100) : null
    },
    chart: { rows: rows.slice(-140), m5: m5 ? m5.slice(-100) : null, d1: dailyRows ? dailyRows.slice(-40) : null, pip: PIP, anchor: C.r2(anchor), shift: C.r2(shift) }
  };
  const dv = directionVote(packRaw);
  packRaw.direction = dv.dir; packRaw.directionStrength = dv.strength; packRaw.votes = dv.votes;
  packRaw.markers = markersOf(packRaw);
  packRaw.setups = buildSetups(packRaw, dv.dir, shift);
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
    pack.plan = pack.setups.find(s => s.status === 'SIAP' && s.style === 'DAY')
      || pack.setups.find(s => s.status === 'SIAP') || pack.setups[0] || null;
    pack.sources = [
      { name: 'TradingView chart & TA real-time ' + C.TV_SYMBOL, ok: !!(pack.tv && pack.tv.ok) },
      { name: 'Yahoo Finance candle ' + C.Y_SYM + ' (M1/M5/M15/D1)', ok: true },
      { name: 'gold-api.com spot', ok: !!(pack.spot && pack.spot.ok) },
      { name: 'DXY & yield 10Y (Yahoo)', ok: !!pack.macro },
      { name: 'Kalender ekonomi USD (risiko rilis)', ok: !!(pack.eventRisk && pack.eventRisk.items) },
      { name: 'AI multi-provider (fallback otomatis)', ok: !!(pack.ai && pack.ai.ok) }
    ];
    pack.validation = [
      { k: 'Harga acuan', ok: true, d: pack.priceSource + ' · ' + pack.price },
      { k: 'Candle live', ok: pack.chart.rows.length > 60, d: pack.chart.rows.length + ' candle M15' },
      { k: 'Struktur & likuiditas', ok: !!(pack.structure && pack.markers.length >= 3), d: pack.markers.length + ' tanda chart' },
      { k: 'Matriks timeframe', ok: (pack.tfMatrix || []).length >= 4, d: (pack.tfMatrix || []).map(x => x.tf + ' ' + x.rec).join(' · ') },
      { k: 'Risiko rilis', ok: pack.eventRisk && pack.eventRisk.level !== 'TINGGI', d: pack.eventRisk ? pack.eventRisk.note : 'kalender tidak tersedia' },
      { k: 'Anotasi AI', ok: !!(pack.ai && pack.ai.ok), d: pack.ai && pack.ai.ok ? pack.ai.annotated + ' tanda diberi catatan' : (pack.ai && pack.ai.error) || 'AI tidak tersedia' }
    ];
    pack.quality = pack.validation.filter(x => x.ok).length / pack.validation.length * 100;
    cache = { t: Date.now(), v: pack };
    return res.status(200).json(pack);
  } catch (e) {
    return res.status(200).json({ ok: false, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = { signalHandler, build, markersOf, directionVote, buildSetups };
