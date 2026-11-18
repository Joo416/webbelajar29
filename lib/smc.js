/* =====================================================================
   SMC / ICT / AMD ENGINE — deterministik, tanpa angka karangan.
   Menggabungkan materi yang diminta:
   1. AMD (Accumulation – Manipulation – Distribution) per sesi.
   2. Struktur: BOS (boleh body/wick) dan CHoCH (body wajib tembus area
      candle sebelumnya) + Higher High/Higher Low.
   3. Fair Value Gap 3-candle (celah wick candle 1 ke wick candle 3),
      BISI/SIBI, unmitigated vs mitigated.
   4. Order Block: candle berlawanan terakhir sebelum displacement,
      unmitigated, IDM (inducement) sudah disapu atau belum.
   5. Likuiditas: EQH/EQL, BSL/SSL, liquidity sweep + rejection.
   6. Premium/Discount 50%, dealing range, OTE 61.8–78.6 (sweet spot 70.5).
   7. Kill zone London 14.00–17.00 WIB, New York 19.00–22.00 WIB.
   8. Displacement (body panjang + FVG).
   9. Fib golden ratio + candle momentum H1/H4 → refine M5 → SL di
      liquidity sweep HTF.
   Semua level berasal dari candle nyata. Tidak ada AI di modul ini.
   ===================================================================== */
'use strict';
const C = require('./xau-core');

const PIP = 0.1;
const r2 = C.r2;
const iso = (t) => (t == null || !isFinite(t) ? null : new Date(t).toISOString());
const bodyOf = (r) => Math.abs(r.c - r.o);
const rangeOf = (r) => r.h - r.l;
const signOf = (r) => (r.c > r.o ? 1 : r.c < r.o ? -1 : 0);
const pipsOf = (a, b) => (a == null || b == null || !isFinite(a) || !isFinite(b) ? null : Math.round(Math.abs(a - b) / PIP));

/* ---------------- 1. Kill zone (WIB = UTC+7, tanpa DST) ---------------- */
const KILL_ZONES = [
  { key: 'london', name: 'London Kill Zone', fromUTC: 7, toUTC: 10, wib: '14.00–17.00 WIB', utc: '07.00–10.00 UTC' },
  { key: 'newyork', name: 'New York Kill Zone', fromUTC: 12, toUTC: 15, wib: '19.00–22.00 WIB', utc: '12.00–15.00 UTC' }
];
function killZone(now) {
  const t = now == null ? Date.now() : Number(now);
  const d = new Date(t);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const day = d.getUTCDay();
  const weekend = day === 6 || (day === 5 && h >= 21) || (day === 0 && h < 22);
  const active = weekend ? null : (KILL_ZONES.find(z => h >= z.fromUTC && h < z.toUTC) || null);
  const next = (() => {
    if (weekend) return null;
    const cand = KILL_ZONES.map(z => ({ ...z, inMin: Math.round(((z.fromUTC - h + 24) % 24) * 60) }))
      .filter(z => z.inMin > 0).sort((a, b) => a.inMin - b.inMin)[0];
    return cand || null;
  })();
  return {
    active: !!active,
    name: active ? active.name : 'Di luar kill zone',
    wib: active ? active.wib : 'London 14.00–17.00 WIB · New York 19.00–22.00 WIB',
    utc: active ? active.utc : '07.00–10.00 / 12.00–15.00 UTC',
    weekend,
    next: next ? { name: next.name, wib: next.wib, inMin: next.inMin } : null,
    note: weekend
      ? 'Pasar tutup akhir pekan; sinyal eksekusi tidak valid sampai sesi dibuka.'
      : active
        ? active.name + ' aktif (' + active.wib + '). Volume institusi sedang tinggi.'
        : 'Di luar kill zone. Sinyal M15 hanya valid di London/New York kill zone; tunggu jendela berikutnya.'
  };
}

/* ---------------- 2. Struktur: BOS / CHoCH / HH-HL-LH-LL ---------------- */
function priorTrend(swHi, swLo, idx) {
  const hs = swHi.filter(x => x.i < idx).slice(-2);
  const ls = swLo.filter(x => x.i < idx).slice(-2);
  if (hs.length < 2 || ls.length < 2) return 'RANGE';
  if (hs[1].p > hs[0].p && ls[1].p > ls[0].p) return 'BULLISH';
  if (hs[1].p < hs[0].p && ls[1].p < ls[0].p) return 'BEARISH';
  return 'RANGE';
}
function structureFlow(rows, atrV, k) {
  if (!Array.isArray(rows) || rows.length < 12) return { ok: false, trend: 'RANGE', bias: 0, events: [], choch: null, bos: null, hi: [], lo: [], note: 'candle tidak cukup' };
  const sw = C.swing(rows, k || 2);
  const events = [];
  const seen = new Set();
  const start = Math.max(4, rows.length - 90);
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const hh = sw.hi.filter(x => x.i <= i - 2 && x.i >= i - 70).slice(-1)[0];
    const ll = sw.lo.filter(x => x.i <= i - 2 && x.i >= i - 70).slice(-1)[0];
    const prev = rows[i - 1];
    if (!prev) continue;
    if (hh && r.h > hh.p) {
      const closeBreak = r.c > hh.p;
      const strict = r.c > prev.h;
      const trend = priorTrend(sw.hi, sw.lo, hh.i);
      const kind = trend === 'BEARISH' ? 'CHOCH' : 'BOS';
      const key = kind + ':up:' + hh.p.toFixed(2);
      if (!seen.has(key)) {
        seen.add(key);
        events.push({
          kind, dir: 'BULLISH', level: r2(hh.p), at: iso(r.t), t: r.t, i,
          body: closeBreak, wick: true, strict,
          valid: kind === 'CHOCH' ? (closeBreak && strict) : true,
          note: kind === 'CHOCH'
            ? 'CHoCH bullish: body close ' + (closeBreak ? 'menembus' : 'belum menembus') + ' swing high ' + r2(hh.p) + (strict ? ' dan candle sebelumnya' : ' (butuh body tembus area candle terdekat)') + '.'
            : 'BOS bullish: ' + (closeBreak ? 'body' : 'wick') + ' menembus swing high ' + r2(hh.p) + ' — tren naik berlanjut.'
        });
      }
    }
    if (ll && r.l < ll.p) {
      const closeBreak = r.c < ll.p;
      const strict = r.c < prev.l;
      const trend = priorTrend(sw.hi, sw.lo, ll.i);
      const kind = trend === 'BULLISH' ? 'CHOCH' : 'BOS';
      const key = kind + ':down:' + ll.p.toFixed(2);
      if (!seen.has(key)) {
        seen.add(key);
        events.push({
          kind, dir: 'BEARISH', level: r2(ll.p), at: iso(r.t), t: r.t, i,
          body: closeBreak, wick: true, strict,
          valid: kind === 'CHOCH' ? (closeBreak && strict) : true,
          note: kind === 'CHOCH'
            ? 'CHoCH bearish: body close ' + (closeBreak ? 'menembus' : 'belum menembus') + ' swing low ' + r2(ll.p) + (strict ? ' dan candle sebelumnya' : ' (butuh body tembus area candle terdekat)') + '.'
            : 'BOS bearish: ' + (closeBreak ? 'body' : 'wick') + ' menembus swing low ' + r2(ll.p) + ' — tren turun berlanjut.'
        });
      }
    }
  }
  const valid = events.filter(x => x.valid);
  const last = valid.slice(-1)[0] || null;
  const choch = valid.filter(x => x.kind === 'CHOCH').slice(-1)[0] || null;
  const bos = valid.filter(x => x.kind === 'BOS').slice(-1)[0] || null;
  const hi = sw.hi.slice(-5).map(x => x.p);
  const lo = sw.lo.slice(-5).map(x => x.p);
  const labels = (() => {
    const hs = sw.hi.slice(-4), ls = sw.lo.slice(-4);
    const lab = [];
    for (let i = 1; i < hs.length; i++) lab.push(hs[i].p > hs[i - 1].p ? 'HH' : hs[i].p < hs[i - 1].p ? 'LH' : 'EQH');
    for (let i = 1; i < ls.length; i++) lab.push(ls[i].p > ls[i - 1].p ? 'HL' : ls[i].p < ls[i - 1].p ? 'LL' : 'EQL');
    return lab;
  })();
  const trend = (() => {
    const hs = sw.hi.slice(-2), ls = sw.lo.slice(-2);
    if (hs.length < 2 || ls.length < 2) return 'RANGE';
    return hs[1].p > hs[0].p && ls[1].p > ls[0].p ? 'BULLISH' : hs[1].p < hs[0].p && ls[1].p < ls[0].p ? 'BEARISH' : 'RANGE';
  })();
  const bias = last && rows.length - 1 - last.i <= 12 ? (last.dir === 'BULLISH' ? 1 : -1) : (trend === 'BULLISH' ? 0.6 : trend === 'BEARISH' ? -0.6 : 0);
  return {
    ok: true, trend, bias, labels,
    last, choch, bos, events: valid.slice(-6),
    lastHi: hi.length ? r2(hi[hi.length - 1]) : null,
    lastLo: lo.length ? r2(lo[lo.length - 1]) : null,
    lastHiAt: sw.hi.length ? iso(sw.hi[sw.hi.length - 1].t) : null,
    lastLoAt: sw.lo.length ? iso(sw.lo[sw.lo.length - 1].t) : null,
    hi: hi.map(r2), lo: lo.map(r2),
    note: 'Struktur ' + trend + ' · label ' + (labels.join('/') || '—') + (last ? ' · ' + last.kind + ' ' + last.dir + ' @ ' + last.level : '')
  };
}

/* ---------------- 3. Fair Value Gap 3-candle ---------------- */
function fairValueGaps(rows, atrV) {
  if (!Array.isArray(rows) || rows.length < 3) return [];
  const a = atrV || 1;
  const out = [];
  for (let i = Math.max(2, rows.length - 140); i < rows.length; i++) {
    const c1 = rows[i - 2], c3 = rows[i];
    const gap = c3.l - c1.h;
    if (gap > 0) {
      const later = rows.slice(i + 1);
      const touched = later.some(r => r.l <= c3.l);
      const filled = later.some(r => r.l <= c1.h);
      out.push({
        kind: 'bull', label: 'BISI', lo: r2(c1.h), hi: r2(c3.l), at: iso(c3.t), t: c3.t, i,
        sizePips: Math.round(gap / PIP), touched, filled, unmitigated: !touched,
        strength: r2(gap / a), note: 'FVG bullish (BISI) ' + r2(c1.h) + '–' + r2(c3.l) + ' — celah wick candle 1 ke candle 3.'
      });
    }
    const gap2 = c1.l - c3.h;
    if (gap2 > 0) {
      const later = rows.slice(i + 1);
      const touched = later.some(r => r.h >= c3.h);
      const filled = later.some(r => r.h >= c1.l);
      out.push({
        kind: 'bear', label: 'SIBI', lo: r2(c3.h), hi: r2(c1.l), at: iso(c3.t), t: c3.t, i,
        sizePips: Math.round(gap2 / PIP), touched, filled, unmitigated: !touched,
        strength: r2(gap2 / a), note: 'FVG bearish (SIBI) ' + r2(c3.h) + '–' + r2(c1.l) + ' — celah wick candle 1 ke candle 3.'
      });
    }
  }
  return out.slice(-10);
}

/* ---------------- 4. Order Block + displacement + IDM ---------------- */
function orderBlocks(rows, atrV) {
  if (!Array.isArray(rows) || rows.length < 8) return [];
  const a = atrV || 1;
  const out = [];
  for (let i = Math.max(3, rows.length - 100); i < rows.length - 1; i++) {
    const r = rows[i];
    const body = bodyOf(r);
    if (body < a * 1.1 || body < rangeOf(r) * 0.5) continue;
    const up = r.c > r.o;
    let j = -1;
    for (let x = i - 1; x >= Math.max(0, i - 3); x--) {
      if (up ? rows[x].c < rows[x].o : rows[x].c > rows[x].o) { j = x; break; }
    }
    if (j < 0) continue;
    const ob = rows[j];
    const lo = r2(Math.min(ob.o, ob.c)), hi = r2(Math.max(ob.o, ob.c));
    const later = rows.slice(i + 1);
    const touched = later.some(x => up ? x.l <= hi : x.h >= lo);
    const filled = later.some(x => up ? x.l <= lo : x.h >= hi);
    const after = rows.slice(i + 1);
    const swAfter = C.swing(after, 1);
    const idmRaw = up ? (swAfter.lo[0] && swAfter.lo[0].p) : (swAfter.hi[0] && swAfter.hi[0].p);
    const idm = idmRaw == null ? null : r2(idmRaw);
    const idmSwept = idm == null ? null : after.some(x => up ? x.l < idm : x.h > idm);
    out.push({
      dir: up ? 'BULLISH' : 'BEARISH', kind: up ? 'demand' : 'supply',
      lo, hi, at: iso(ob.t), t: ob.t, i: j, impulseAt: iso(r.t),
      strength: r2(body / a), touched, filled, unmitigated: !touched,
      idm, idmSwept, valid: !touched && idmSwept !== false,
      note: 'Order Block ' + (up ? 'demand' : 'supply') + ' ' + lo + '–' + hi + ' (candle ' + (up ? 'turun' : 'naik') + ' terakhir sebelum displacement ' + r2(body / a) + '× ATR)' + (touched ? ' — sudah mitigated' : ' — unmitigated') + (idmSwept === true ? '; IDM ' + idm + ' sudah disapu.' : idmSwept === false ? '; IDM ' + idm + ' belum disapu.' : '.')
    });
  }
  return out.slice(-8);
}

/* Engulfing: body candle sekarang menelan body candle sebelumnya dan
   membalik arah. Dipakai sebagai trigger M15/M5 tambahan. */
function engulfing(rows) {
  if (!Array.isArray(rows) || rows.length < 3) return null;
  for (let i = rows.length - 1; i >= Math.max(1, rows.length - 12); i--) {
    const r = rows[i], p = rows[i - 1];
    const rb = bodyOf(r), pb = bodyOf(p);
    if (rb < pb * 1.05 || rb < rangeOf(r) * 0.5) continue;
    const bull = r.c > r.o;
    if (bull && p.c < p.o && r.o <= p.c && r.c >= p.o) {
      return { dir: 'BULLISH', at: iso(r.t), level: r2(r.c), bodyPips: Math.round(rb / PIP), note: 'Engulfing bullish: body candle menelan candle turun sebelumnya.' };
    }
    if (!bull && p.c > p.o && r.o >= p.c && r.c <= p.o) {
      return { dir: 'BEARISH', at: iso(r.t), level: r2(r.c), bodyPips: Math.round(rb / PIP), note: 'Engulfing bearish: body candle menelan candle naik sebelumnya.' };
    }
  }
  return null;
}

function displacement(rows, atrV) {
  if (!Array.isArray(rows) || rows.length < 5) return null;
  const a = atrV || 1;
  for (let i = rows.length - 1; i >= Math.max(2, rows.length - 12); i--) {
    const r = rows[i], p = rows[i - 1];
    const body = bodyOf(r);
    if (body < a * 1.15 || body < rangeOf(r) * 0.6) continue;
    const dir = r.c > r.o ? 'BULLISH' : 'BEARISH';
    const same = signOf(r) === signOf(p) && bodyOf(p) > a * 0.45;
    const bullGap = r.l > rows[i - 2].h;
    const bearGap = r.h < rows[i - 2].l;
    const fvg = dir === 'BULLISH' ? bullGap : bearGap;
    return {
      dir, at: iso(r.t), t: r.t, bodyPips: Math.round(body / PIP), strength: r2(body / a),
      consecutive: same, fvg,
      note: 'Displacement ' + dir + ': body ' + Math.round(body / PIP) + ' pip (' + r2(body / a) + '× ATR)' + (same ? ', candle sebelumnya searah' : '') + (fvg ? ', meninggalkan FVG.' : ', tanpa FVG.')
    };
  }
  return null;
}

/* ---------------- 5. Likuiditas: EQH/EQL, BSL/SSL, sweep ---------------- */
function liquidity(rows, atrV) {
  if (!Array.isArray(rows) || rows.length < 12) return { eqh: [], eql: [], sweep: null, bsl: [], ssl: [], note: 'candle tidak cukup' };
  const a = atrV || 1;
  const sw = C.swing(rows, 2);
  const tol = Math.max(0.6, a * 0.15);
  const group = (arr, kind) => {
    const src = arr.filter(x => x.i >= rows.length - 80).slice(-10);
    const out = [];
    for (let i = 0; i < src.length; i++) {
      const near = src.filter((x, j) => j !== i && Math.abs(x.p - src[i].p) <= tol);
      if (!near.length) continue;
      const price = r2((src[i].p + near[0].p) / 2);
      if (out.some(x => Math.abs(x.price - price) < tol * 0.6)) continue;
      out.push({
        kind, price, touches: 1 + near.length,
        at: iso(Math.max(src[i].t, near[0].t)),
        note: (kind === 'EQH' ? 'Equal highs' : 'Equal lows') + ' di ' + price + ' — tumpukan ' + (kind === 'EQH' ? 'BSL (stop buy)' : 'SSL (stop sell)') + '.'
      });
    }
    return out.slice(-3);
  };
  const eqh = group(sw.hi, 'EQH'), eql = group(sw.lo, 'EQL');
  let sweep = null;
  /* Sweep bisa terjadi dalam satu candle (wick keluar, close balik) atau dua–
     tiga candle (tembus lalu reclaim). Yang dinilai: level swing tertembus,
     extreme terbaru, dan close terakhir sudah kembali ke dalam range. */
  const lastRow = rows[rows.length - 1];
  const last = lastRow.c;
  const start = rows.length - 5;
  let hiRow = rows[start], loRow = rows[start], hiIdx = start, loIdx = start;
  for (let i = start + 1; i < rows.length; i++) {
    if (rows[i].h > hiRow.h) { hiRow = rows[i]; hiIdx = i; }
    if (rows[i].l < loRow.l) { loRow = rows[i]; loIdx = i; }
  }
  /* Level acuan harus swing yang terbentuk SEBELUM candle extreme, bukan
     swing yang baru lahir sesudah sweep. */
  const hi = sw.hi.filter(x => x.i < hiIdx - 1 && x.i >= rows.length - 70).slice(-1)[0];
  const lo = sw.lo.filter(x => x.i < loIdx - 1 && x.i >= rows.length - 70).slice(-1)[0];
  const hiOk = !!(hi && hiRow.h > hi.p && last < hi.p);
  const loOk = !!(lo && loRow.l < lo.p && last > lo.p);
  if (hiOk && (!loOk || hiRow.t >= loRow.t)) {
    sweep = {
      kind: 'high', pool: 'BSL', level: r2(hi.p), extreme: r2(hiRow.h), at: iso(hiRow.t), t: hiRow.t,
      reclaimedPips: Math.round((hiRow.h - last) / PIP), dir: 'BEARISH',
      note: 'Sapuan BSL: high ' + r2(hi.p) + ' ditembus ke ' + r2(hiRow.h) + ' lalu close kembali di bawah — stop buy retail diambil, bias sell.'
    };
  } else if (loOk) {
    sweep = {
      kind: 'low', pool: 'SSL', level: r2(lo.p), extreme: r2(loRow.l), at: iso(loRow.t), t: loRow.t,
      reclaimedPips: Math.round((last - loRow.l) / PIP), dir: 'BULLISH',
      note: 'Sapuan SSL: low ' + r2(lo.p) + ' ditembus ke ' + r2(loRow.l) + ' lalu close kembali di atas — stop sell retail diambil, bias buy.'
    };
  }
  const bsl = sw.hi.filter(x => x.p > last && x.i >= rows.length - 90).slice(-4).map(x => ({ price: r2(x.p), at: iso(x.t) }));
  const ssl = sw.lo.filter(x => x.p < last && x.i >= rows.length - 90).slice(-4).map(x => ({ price: r2(x.p), at: iso(x.t) }));
  return {
    eqh, eql, sweep, bsl, ssl,
    note: (eqh.length + eql.length ? (eqh.length + ' EQH · ' + eql.length + ' EQL. ') : '') + (sweep ? sweep.note : 'Belum ada sweep terbaru yang valid.')
  };
}

/* ---------------- 6. Dealing range / premium-discount / OTE ---------------- */
function dealingRange(rows, price, lookback) {
  if (!Array.isArray(rows) || rows.length < 10) return null;
  const w = rows.slice(-(lookback || 80));
  const hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  const rng = hi - lo;
  if (!(rng > 0)) return null;
  const p = price == null ? w[w.length - 1].c : price;
  const pos = C.clip(Math.round((p - lo) / rng * 100), 0, 100);
  const zone = pos < 50 ? 'discount' : pos > 50 ? 'premium' : 'equilibrium';
  return {
    hi: r2(hi), lo: r2(lo), pos, zone, equilibrium: r2(lo + rng * 0.5),
    oteLong: [r2(hi - rng * 0.786), r2(hi - rng * 0.618)],
    oteShort: [r2(lo + rng * 0.618), r2(lo + rng * 0.786)],
    sweetLong: r2(hi - rng * 0.705), sweetShort: r2(lo + rng * 0.705),
    note: 'Harga di ' + zone + ' (' + pos + '% dari dealing range ' + r2(lo) + '–' + r2(hi) + '). BUY hanya di bawah 50%, SELL hanya di atas 50%.'
  };
}

/* ---------------- 7. AMD per sesi Asia → London/New York ---------------- */
function amdPhase(rows, atrV, now) {
  if (!Array.isArray(rows) || rows.length < 10) return null;
  const t = now == null ? Date.now() : Number(now);
  const day = new Date(t).toISOString().slice(0, 10);
  const dayRows = rows.filter(r => new Date(r.t).toISOString().slice(0, 10) === day);
  const asia = dayRows.filter(r => new Date(r.t).getUTCHours() < 7);
  if (asia.length < 4) return { ok: false, phase: 'tidak jelas', bias: 0, note: 'Range Asia hari ini belum terbentuk.' };
  const hi = Math.max(...asia.map(r => r.h)), lo = Math.min(...asia.map(r => r.l));
  const hiAt = asia.find(r => r.h === hi), loAt = asia.find(r => r.l === lo);
  const after = dayRows.filter(r => r.t > asia[asia.length - 1].t);
  const nowH = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
  const sweepHigh = after.filter(r => r.h > hi && r.c < hi).slice(-1)[0] || null;
  const sweepLow = after.filter(r => r.l < lo && r.c > lo).slice(-1)[0] || null;
  const a = atrV || 1;
  const disp = after.slice().reverse().find(r => bodyOf(r) >= a * 0.9 && bodyOf(r) >= rangeOf(r) * 0.55) || null;
  const dispDir = disp ? (disp.c > disp.o ? 'BULLISH' : 'BEARISH') : null;
  const brokeUp = after.some(r => r.c > hi), brokeDown = after.some(r => r.c < lo);
  const phase = nowH < 7
    ? 'akumulasi'
    : (sweepHigh || sweepLow) && (brokeUp || brokeDown || disp)
      ? 'distribusi'
      : (sweepHigh || sweepLow) ? 'manipulasi' : after.length < 4 ? 'akumulasi' : 'transisi';
  const bias = (() => {
    if (dispDir === 'BULLISH') return sweepLow ? 1 : 0.7;
    if (dispDir === 'BEARISH') return sweepHigh ? -1 : -0.7;
    if (sweepLow) return 0.6;
    if (sweepHigh) return -0.6;
    if (brokeUp) return 0.4;
    if (brokeDown) return -0.4;
    return 0;
  })();
  return {
    ok: true, phase, bias,
    asia: { hi: r2(hi), lo: r2(lo), widthPips: Math.round((hi - lo) / PIP), hiAt: hiAt ? iso(hiAt.t) : null, loAt: loAt ? iso(loAt.t) : null },
    sweep: sweepHigh
      ? { side: 'high', level: r2(hi), extreme: r2(sweepHigh.h), at: iso(sweepHigh.t), note: 'Manipulasi ke atas high Asia lalu kembali masuk range (Judas swing).' }
      : sweepLow
        ? { side: 'low', level: r2(lo), extreme: r2(sweepLow.l), at: iso(sweepLow.t), note: 'Manipulasi ke bawah low Asia lalu kembali masuk range (Judas swing).' }
        : null,
    displacement: disp ? { dir: dispDir, at: iso(disp.t), bodyPips: Math.round(bodyOf(disp) / PIP) } : null,
    note: 'AMD fase ' + phase + '. Range Asia ' + r2(lo) + '–' + r2(hi) + ' (' + Math.round((hi - lo) / PIP) + ' pip)' + (sweepHigh ? '; high disapu ke ' + r2(sweepHigh.h) : sweepLow ? '; low disapu ke ' + r2(sweepLow.l) : '') + (disp ? '; displacement ' + dispDir + ' ' + Math.round(bodyOf(disp) / PIP) + ' pip' : '') + '.'
  };
}

/* ---------------- 8. Fib golden ratio + candle momentum ---------------- */
function nearestLevel(rows, dir, ref, maxPips) {
  const sw = C.swing(rows, 2);
  const arr = dir === 'BULLISH' ? sw.lo : sw.hi;
  const cand = arr.filter(x => dir === 'BULLISH' ? x.p <= ref : x.p >= ref)
    .filter(x => Math.abs(x.p - ref) / PIP <= (maxPips || 80))
    .sort((a, b) => Math.abs(a.p - ref) - Math.abs(b.p - ref))[0];
  return cand ? { price: r2(cand.p), at: iso(cand.t), distPips: Math.round(Math.abs(cand.p - ref) / PIP) } : null;
}
function fibMomentum(h1, h4, m5, atr5, price) {
  if (!Array.isArray(m5) || m5.length < 20 || (!Array.isArray(h1) || h1.length < 20) && (!Array.isArray(h4) || h4.length < 20)) return null;
  const pick = (rows, tf) => {
    const a = C.atr(rows, 14) || 1;
    /* Hanya candle terbaru: H1 maksimal 24 jam, H4 maksimal 2 hari. Candle
       momentum lama tidak boleh dipakai sebagai zona entry hari ini. */
    const look = tf === 'H4' ? 12 : 24;
    const cand = rows.slice(-look).map(r => ({ r, tf, a, score: bodyOf(r) / a })).sort((x, y) => y.score - x.score)[0];
    return cand && cand.score >= 1.2 ? cand : null;
  };
  const c1 = pick(h1 || [], 'H1'), c4 = pick(h4 || [], 'H4');
  const best = !c1 ? c4 : !c4 ? c1 : c1.score >= c4.score ? c1 : c4;
  if (!best) return null;
  const r = best.r, bull = r.c > r.o;
  const dir = bull ? 'BULLISH' : 'BEARISH';
  const rng = rangeOf(r);
  if (!(rng > 0)) return null;
  const golden = bull
    ? [r2(r.h - rng * 0.786), r2(r.h - rng * 0.618)]
    : [r2(r.l + rng * 0.618), r2(r.l + rng * 0.786)];
  const sweet = bull ? r2(r.h - rng * 0.705) : r2(r.l + rng * 0.705);
  const mid = (golden[0] + golden[1]) / 2;
  const obs = orderBlocks(m5, C.atr(m5, 14) || 1).filter(z => z.dir === dir && !z.touched);
  const fvgs = fairValueGaps(m5, C.atr(m5, 14) || 1).filter(z => (bull ? z.kind === 'bull' : z.kind === 'bear') && z.unmitigated);
  const zones = [
    ...obs.map(z => ({ lo: z.lo, hi: z.hi, src: 'OB M5', at: z.at })),
    ...fvgs.map(z => ({ lo: z.lo, hi: z.hi, src: 'FVG M5 ' + z.label, at: z.at }))
  ].filter(z => z.lo != null && z.hi != null)
    .map(z => ({ ...z, dist: Math.min(Math.abs(z.lo - mid), Math.abs(z.hi - mid)) / PIP }))
    .sort((a, b) => a.dist - b.dist);
  let m5zone = zones[0] && zones[0].dist <= 45 ? zones[0] : null;
  if (!m5zone) {
    const sw = C.swing(m5, 2);
    const arr = bull ? sw.lo : sw.hi;
    const lvl = arr.filter(x => Math.abs(x.p - mid) / PIP <= 45).sort((a, b) => Math.abs(a.p - mid) - Math.abs(b.p - mid))[0];
    if (lvl) m5zone = { lo: bull ? r2(lvl.p - 0.2) : r2(lvl.p - 0.2), hi: bull ? r2(lvl.p + 0.2) : r2(lvl.p + 0.2), src: bull ? 'SNR demand M5' : 'SNR supply M5', at: iso(lvl.t) };
  }
  const entry = m5zone ? (bull ? m5zone.hi : m5zone.lo) : sweet;
  const htfRows = best.tf === 'H4' ? (h4 || []) : (h1 || []);
  const sweep = nearestLevel(htfRows, dir, entry, 90);
  const atr5v = atr5 || C.atr(m5, 14) || 1;
  const distPips = Math.round(Math.abs((price == null ? m5[m5.length - 1].c : price) - entry) / PIP);
  const ok = !!m5zone && distPips <= Math.round(atr5v * 3 / PIP);
  return {
    ok, tf: best.tf, dir, candle: { o: r2(r.o), h: r2(r.h), l: r2(r.l), c: r2(r.c), at: iso(r.t), bodyPips: Math.round(bodyOf(r) / PIP), strength: r2(best.score) },
    golden, sweet, m5zone, entry: r2(entry), distPips,
    sweepLevel: sweep ? sweep.price : null, sweepAt: sweep ? sweep.at : null,
    slPips: sweep && entry != null ? pipsOf(entry, sweep.price) : null,
    steps: [
      'Tarik Fibonacci di 1 candle terpanjang ' + best.tf + ' (' + iso(r.t) + ', body ' + Math.round(bodyOf(r) / PIP) + ' pip).',
      'Ambil golden ratio 61.8–78.6%: ' + golden[0] + '–' + golden[1] + ' (sweet spot 70.5% = ' + sweet + ').',
      'Perkecil ke M5: ' + (m5zone ? m5zone.src + ' ' + m5zone.lo + '–' + m5zone.hi + ' (buffer 10–20 pip)' : 'belum ada SND M5 dekat golden ratio — tunggu.'),
      'Tutup garis ke liquidity sweep ' + best.tf + ': ' + (sweep ? sweep.price + ' (' + sweep.distPips + ' pip dari entry)' : 'belum ada swing likuiditas terdekat') + '.',
      'Entry LIMIT di ' + (m5zone ? (bull ? 'tepi atas ' : 'tepi bawah ') + 'zona M5 ' : 'golden ratio ') + r2(entry) + '; SL 30 pip (struktur sweep ' + (sweep ? Math.round(Math.abs((sweep.price - entry) / PIP)) + ' pip' : '—') + ').',
      'Batal jika M5 close di luar zona atau harga menembus sweep ' + (sweep ? sweep.price : '—') + '.'
    ],
    note: 'Fib + momentum: candle ' + best.tf + ' ' + dir + ' ' + Math.round(bodyOf(r) / PIP) + ' pip; golden ' + golden[0] + '–' + golden[1] + '; zona M5 ' + (m5zone ? m5zone.lo + '–' + m5zone.hi : '—') + '; sweep ' + (sweep ? sweep.price : '—') + '.'
  };
}

/* ---------------- 9. Ringkasan + checklist eksekusi ---------------- */
function build(o) {
  const opts = o || {};
  const now = opts.now || Date.now();
  const m5 = (opts.m5 || []).filter(r => r && isFinite(r.c));
  const m15 = (opts.m15 || []).filter(r => r && isFinite(r.c));
  const h1 = (opts.h1 || []).filter(r => r && isFinite(r.c));
  const h4 = (opts.h4 || []).filter(r => r && isFinite(r.c));
  const d1 = (opts.d1 || []).filter(r => r && isFinite(r.c));
  if (m5.length < 20 && m15.length < 20) return { ok: false, at: new Date(now).toISOString(), note: 'Candle M5/M15 tidak cukup untuk mesin SMC.' };
  const atr5 = opts.atr5 || C.atr(m5, 14) || 1;
  const atr15 = opts.atr15 || C.atr(m15, 14) || 1;
  const atr1 = opts.atr1 || C.atr(h1, 14) || 1;
  const atr4 = opts.atr4 || C.atr(h4, 14) || 1;
  const price = opts.price != null ? Number(opts.price) : (m5.length ? m5[m5.length - 1].c : m15[m15.length - 1].c);
  const flow = {
    m5: structureFlow(m5, atr5), m15: structureFlow(m15, atr15),
    h1: structureFlow(h1, atr1), h4: structureFlow(h4, atr4), d1: structureFlow(d1, C.atr(d1, 14) || 1)
  };
  const fvg = { m5: fairValueGaps(m5, atr5), m15: fairValueGaps(m15, atr15), h1: fairValueGaps(h1, atr1), h4: fairValueGaps(h4, atr4) };
  const obs = { m5: orderBlocks(m5, atr5), m15: orderBlocks(m15, atr15), h1: orderBlocks(h1, atr1), h4: orderBlocks(h4, atr4) };
  const liq = liquidity(m15.length >= 30 ? m15 : m5, m15.length >= 30 ? atr15 : atr5);
  const pd = dealingRange(m15.length >= 20 ? m15 : m5, price);
  const amd = amdPhase(m15.length >= 20 ? m15 : m5, atr15, now);
  const disp = displacement(m5, atr5) || displacement(m15, atr15);
  const engulf = { m5: engulfing(m5), m15: engulfing(m15) };
  const fib = fibMomentum(h1, h4, m5, atr5, price);
  const kz = killZone(now);
  const htfScore = C.clip((flow.d1.bias || 0) * 1.2 + (flow.h4.bias || 0) * 1.2 + (flow.h1.bias || 0) * 0.8, -3, 3);
  const bias = Math.abs(htfScore) > 0.15
    ? htfScore
    : flow.h4.trend === 'BULLISH' || flow.h1.trend === 'BULLISH' ? 0.6
      : flow.h4.trend === 'BEARISH' || flow.h1.trend === 'BEARISH' ? -0.6 : 0;
  const idm = [...obs.m15, ...obs.m5].filter(z => z.idm != null).slice(-1)[0] || null;
  return {
    ok: true, at: new Date(now).toISOString(), price: r2(price),
    killzone: kz, htf: {
      d1: flow.d1.trend, h4: flow.h4.trend, h1: flow.h1.trend, m15: flow.m15.trend, m5: flow.m5.trend,
      bias: bias > 0.15 ? 'BULLISH' : bias < -0.15 ? 'BEARISH' : 'RANGE', score: r2(bias),
      note: 'D1 ' + flow.d1.trend + ' · H4 ' + flow.h4.trend + ' · H1 ' + flow.h1.trend + ' · M15 ' + flow.m15.trend + ' · M5 ' + flow.m5.trend
        + ' · sinyal ' + [flow.d1.last, flow.h4.last, flow.h1.last].map(e => e ? e.kind.slice(0, 2) + ' ' + e.dir[0] : '—').join('/')
    },
    flow, fvg, obs, liq, pd, amd, displacement: disp, engulf, fib, idm,
    bias: bias > 0.15 ? 1 : bias < -0.15 ? -1 : 0,
    note: 'SMC: ' + (kz.active ? kz.name : 'di luar kill zone') + ' · PD ' + (pd ? pd.zone + ' ' + pd.pos + '%' : '—') + ' · AMD ' + (amd ? amd.phase : '—') + ' · ' + (liq.sweep ? 'sweep ' + liq.sweep.pool : 'belum ada sweep') + (engulf.m15 ? ' · engulf M15 ' + engulf.m15.dir : '') + (fib && fib.ok ? ' · fib ' + fib.tf + ' ' + fib.dir : '')
  };
}

function assess(smc, dir, ctx) {
  const buy = dir === 'BUY';
  const sign = buy ? 1 : -1;
  const empty = {
    grade: 'D', ready: false, executable: false, requiredOk: false, optional: 0, optionalTotal: 0, score: 0,
    checks: [], missing: ['mesin SMC tidak tersedia'], blockers: ['mesin SMC tidak tersedia'], note: 'SMC tidak dapat dihitung.'
  };
  if (!smc || !smc.ok) return empty;
  const flow = smc.flow || {};
  const m5 = flow.m5 || {}, m15 = flow.m15 || {}, h1 = flow.h1 || {}, h4 = flow.h4 || {}, d1 = flow.d1 || {};
  const aligned = (e) => !!e && ((buy && e.dir === 'BULLISH') || (!buy && e.dir === 'BEARISH'));
  const shift = aligned(m5.choch) || aligned(m5.bos) || aligned(m15.choch) || aligned(m15.bos);
  const htfOk = !!smc.htf && smc.htf.score * sign > 0.15;
  const poiOk = !!(ctx && ctx.zone) && ((buy && ctx.zone.kind === 'demand') || (!buy && ctx.zone.kind === 'supply'));
  const pdOk = !!smc.pd && (buy ? smc.pd.pos < 50 : smc.pd.pos > 50);
  const sweepOk = !!smc.liq && !!smc.liq.sweep && ((buy && smc.liq.sweep.kind === 'low') || (!buy && smc.liq.sweep.kind === 'high'));
  const dispOk = !!smc.displacement && ((buy && smc.displacement.dir === 'BULLISH') || (!buy && smc.displacement.dir === 'BEARISH'));
  const engulfOk = !!(smc.engulf && smc.engulf.m15 && ((buy && smc.engulf.m15.dir === 'BULLISH') || (!buy && smc.engulf.m15.dir === 'BEARISH')));
  const idmOk = !!(smc.idm && smc.idm.idmSwept === true && ((buy && smc.idm.dir === 'BULLISH') || (!buy && smc.idm.dir === 'BEARISH')));
  const amdOk = !!smc.amd && ((buy && smc.amd.bias > 0) || (!buy && smc.amd.bias < 0));
  const killOk = !!(smc.killzone && smc.killzone.active);
  const stopOk = !!(ctx && ctx.stopPips != null && ctx.stopPips > 0 && ctx.stopPips <= 30);
  const newsOk = !ctx || !ctx.eventRisk || ctx.eventRisk.level !== 'TINGGI';
  const freshOk = !ctx || ctx.fresh !== false;
  const fibOk = !!(smc.fib && smc.fib.ok && ((buy && smc.fib.dir === 'BULLISH') || (!buy && smc.fib.dir === 'BEARISH')));
  const checks = [
    { k: 'bias', label: 'Bias HTF D1/H4/H1 searah', ok: htfOk, need: true, d: smc.htf ? smc.htf.note : '—' },
    { k: 'poi', label: 'POI ' + (buy ? 'demand' : 'supply') + ' unmitigated', ok: poiOk, need: true, d: ctx && ctx.zone ? ctx.zone.src + ' ' + ctx.zone.lo + '–' + ctx.zone.hi : 'belum ada zona' },
    { k: 'shift', label: 'CHoCH/BOS M5–M15 searah', ok: shift, need: true, d: [m5.choch && m5.choch.kind + ' M5 ' + m5.choch.dir, m5.bos && 'BOS M5 ' + m5.bos.dir, m15.choch && 'CHoCH M15 ' + m15.choch.dir].filter(Boolean).join(' · ') || 'belum ada shift' },
    { k: 'pd', label: 'Premium/Discount 50%', ok: pdOk, need: true, d: smc.pd ? smc.pd.note : '—' },
    { k: 'sweep', label: 'Sapuan likuiditas BSL/SSL', ok: sweepOk, need: false, d: smc.liq && smc.liq.sweep ? smc.liq.sweep.note : 'belum ada sweep searah' },
    { k: 'displacement', label: 'Displacement + FVG', ok: dispOk, need: false, d: smc.displacement ? smc.displacement.note : 'belum ada displacement' },
    { k: 'engulf', label: 'Engulfing M15 searah', ok: engulfOk, need: false, d: smc.engulf && smc.engulf.m15 ? smc.engulf.m15.note : 'belum ada engulfing M15' },
    { k: 'idm', label: 'IDM sudah disapu', ok: idmOk, need: false, d: smc.idm ? smc.idm.note : 'IDM belum terbaca' },
    { k: 'amd', label: 'AMD fase manipulasi/distribusi', ok: amdOk, need: false, d: smc.amd ? smc.amd.note : '—' },
    { k: 'kill', label: 'Kill zone London/New York', ok: killOk, need: false, d: smc.killzone ? smc.killzone.note : '—' },
    { k: 'stop', label: 'Sweep struktur ≤ 30 pip dari entry', ok: stopOk, need: false, d: ctx && ctx.stopPips != null ? 'jarak sweep ' + ctx.stopPips + ' pip' : 'sweep belum terukur' },
    { k: 'fib', label: 'Fib golden ratio + momentum', ok: fibOk, need: false, d: smc.fib ? smc.fib.note : 'belum ada candle momentum' },
    { k: 'news', label: 'Tidak ada rilis high-impact dekat', ok: newsOk, need: false, d: ctx && ctx.eventRisk ? ctx.eventRisk.note : 'kalender tidak tersedia' },
    { k: 'fresh', label: 'Candle M5 segar', ok: freshOk, need: false, d: ctx && ctx.fresh != null ? (ctx.fresh ? 'candle baru' : 'candle tertunda') : '—' }
  ];
  const required = checks.filter(x => x.need);
  const requiredOk = required.every(x => x.ok);
  const optional = checks.filter(x => !x.need && x.ok).length;
  const optionalTotal = checks.filter(x => !x.need).length;
  const grade = requiredOk ? (optional >= optionalTotal - 1 ? 'A+' : optional >= 5 ? 'A' : optional >= 3 ? 'B' : 'C') : 'D';
  const ready = requiredOk && optional >= 2;
  const blockers = checks.filter(x => !x.ok && ['kill', 'stop', 'sweep', 'fib', 'news', 'fresh'].includes(x.k)).map(x => x.label);
  if (!(dispOk || engulfOk)) blockers.push('Displacement/engulfing searah');
  const missing = checks.filter(x => !x.ok).map(x => x.label);
  return {
    /* Eksekusi butuh kill zone, sweep yang terjangkau SL 30 pip, OTE fib,
       displacement/engulfing, dan tidak ada rilis high-impact dekat. */
    grade, ready, executable: ready && killOk && stopOk && sweepOk && fibOk && (dispOk || engulfOk) && newsOk && freshOk,
    requiredOk, optional, optionalTotal,
    score: Math.round((required.filter(x => x.ok).length / Math.max(1, required.length)) * 60 + (optional / Math.max(1, optionalTotal)) * 40),
    checks, missing, blockers,
    note: 'SMC ' + grade + ': ' + required.filter(x => x.ok).length + '/' + required.length + ' syarat wajib, ' + optional + '/' + optionalTotal + ' konfirmasi tambahan' + (missing.length ? '; kurang: ' + missing.slice(0, 4).join(', ') : '') + '.'
  };
}

function refineZone(smc, dir, zone) {
  if (!smc || !smc.ok || !zone) return null;
  const buy = dir === 'BUY';
  const a = Math.abs(zone.hi - zone.lo) || 0.3;
  const pad = a * 0.5;
  const cand = [
    ...(smc.obs.m5 || []).filter(z => z.dir === (buy ? 'BULLISH' : 'BEARISH') && z.lo <= zone.hi + pad && z.hi >= zone.lo - pad),
    ...(smc.fvg.m5 || []).filter(z => (buy ? z.kind === 'bull' : z.kind === 'bear') && z.lo <= zone.hi + pad && z.hi >= zone.lo - pad)
  ];
  /* Zona yang terlalu tipis (< 2 pip) bukan POI yang bisa dieksekusi. */
  const best = cand.filter(z => z.hi - z.lo >= 0.2).sort((x, y) => (x.hi - x.lo) - (y.hi - y.lo))[0];
  if (!best) return null;
  return {
    tf: 'M5', src: best.kind ? 'FVG M5 ' + (best.label || '') : 'OB M5',
    lo: r2(best.lo), hi: r2(best.hi), entry: r2(buy ? best.hi : best.lo),
    note: 'Refine ' + (best.kind ? 'FVG' : 'OB') + ' M5 ' + best.lo + '–' + best.hi + ' di dalam zona ' + zone.tf + '.'
  };
}

function stopReference(smc, dir, entry) {
  if (!smc || !smc.ok || entry == null) return null;
  const buy = dir === 'BUY';
  const list = [];
  const push = (p, src) => {
    const n = Number(p);
    if (!isFinite(n)) return;
    if (buy ? n >= entry : n <= entry) return;
    const pips = Math.round(Math.abs(entry - n) / PIP);
    if (pips < 3 || pips > 80) return;
    list.push({ level: r2(n), pips, src });
  };
  if (smc.liq) {
    (buy ? smc.liq.ssl : smc.liq.bsl || []).forEach(x => push(x.price, buy ? 'SSL M15' : 'BSL M15'));
    if (smc.liq.sweep) push(smc.liq.sweep.extreme, 'sweep ' + smc.liq.sweep.pool);
  }
  const flow = smc.flow || {};
  (buy ? (flow.m5 && flow.m5.lo || []) : (flow.m5 && flow.m5.hi || [])).forEach(p => push(p, buy ? 'swing low M5' : 'swing high M5'));
  const srcRows = buy ? (flow.m15 && flow.m15.lo || []) : (flow.m15 && flow.m15.hi || []);
  srcRows.forEach(p => push(p, buy ? 'swing low M15' : 'swing high M15'));
  if (smc.fib && smc.fib.sweepLevel != null) push(smc.fib.sweepLevel, 'sweep ' + smc.fib.tf);
  const prio = (x) => /sweep/i.test(x.src) ? 0 : /SSL|BSL/.test(x.src) ? 1 : /fib/i.test(x.src) ? 1 : 2;
  list.sort((a, b) => prio(a) - prio(b) || a.pips - b.pips);
  return list[0] || null;
}

function summary(smc) {
  if (!smc || !smc.ok) return { ok: false, note: smc && smc.note || 'SMC tidak tersedia' };
  const pick = (e) => e ? { kind: e.kind, dir: e.dir, level: e.level, at: e.at, note: e.note } : null;
  const z = (o) => ({
    lo: o.lo, hi: o.hi, at: o.at,
    src: (o.kind === 'bull' || o.kind === 'bear')
      ? (o.kind === 'bull' ? 'FVG bullish' : 'FVG bearish')
      : (o.dir === 'BULLISH' ? 'OB demand' : 'OB supply'),
    unmitigated: o.unmitigated, idm: o.idm, idmSwept: o.idmSwept
  });
  return {
    ok: true, at: smc.at, price: smc.price, bias: smc.bias, note: smc.note,
    killzone: smc.killzone, htf: smc.htf, pd: smc.pd, amd: smc.amd,
    flow: { m5: pick(smc.flow && smc.flow.m5 && smc.flow.m5.last), m15: pick(smc.flow && smc.flow.m15 && smc.flow.m15.last), h1: pick(smc.flow && smc.flow.h1 && smc.flow.h1.last), h4: pick(smc.flow && smc.flow.h4 && smc.flow.h4.last), d1: pick(smc.flow && smc.flow.d1 && smc.flow.d1.last) },
    sweep: smc.liq ? smc.liq.sweep : null,
    eq: smc.liq ? { highs: (smc.liq.eqh || []).slice(0, 3), lows: (smc.liq.eql || []).slice(0, 3) } : { highs: [], lows: [] },
    fvg: { m5: (smc.fvg.m5 || []).filter(x => x.unmitigated).slice(-3).map(z), m15: (smc.fvg.m15 || []).filter(x => x.unmitigated).slice(-3).map(z) },
    ob: { m5: (smc.obs.m5 || []).filter(x => x.unmitigated).slice(-3).map(z), m15: (smc.obs.m15 || []).filter(x => x.unmitigated).slice(-3).map(z) },
    displacement: smc.displacement, engulf: smc.engulf || null, idm: smc.idm,
    fib: smc.fib && (smc.fib.ok || (smc.fib.distPips != null && smc.fib.distPips <= 400)) ? smc.fib : null
  };
}

module.exports = {
  KILL_ZONES, killZone, structureFlow, fairValueGaps, orderBlocks, displacement, engulfing,
  liquidity, dealingRange, amdPhase, fibMomentum, build, assess, refineZone,
  stopReference, summary
};
