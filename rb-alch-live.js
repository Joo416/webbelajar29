/* ==========================================================================
   RUANG BELAJAR — chart istilah Alchemist dari candle TradingView
   Setiap istilah mendapat penanda yang dihitung dari candle XAUUSD nyata.
   Yang digambar ulang adalah candle + penanda; sumber harganya TradingView.
   Tidak ada garis yang dikarang: bila pola tidak ada, statusnya "area pantau".
   ========================================================================== */
(function () {
  'use strict';
  const COL = {
    entry: '#8b9dff', sl: '#ff7b8a', tp: '#4ade9d', zone: '#5eead4',
    struct: '#f59e0b', sweep: '#f472b6', watch: '#facc15', mut: '#94a3b8'
  };
  const LIVE = { rows: {}, pending: {}, ttl: 4 * 60 * 1000, modal: null, seq: 0 };
  const MARK_KEY = {
    'FVG': 'fvg', 'Fair Value Gap': 'fvg', 'Consequent encroachment': 'fvg',
    'Liquidity void': 'fvg', 'PD array': 'fvg', 'POI': 'fvg', 'Point of Interest': 'fvg',
    'Displacement': 'displacement',
    'Order block': 'ob', 'OB': 'ob',
    'BOS': 'bos', 'Break of Structure': 'bos', 'Storyline': 'bos', 'Break & retest': 'bos',
    'SBR': 'bos', 'RBS': 'bos', 'Breakout internal': 'bos', 'Breakout external': 'bos',
    'MSS': 'choch', 'Market Structure Shift': 'choch', 'CHoCH': 'choch', 'Change of Character': 'choch',
    'EQH': 'eq', 'EQL': 'eq', 'Equal highs / lows': 'eq', 'BSL': 'eq', 'SSL': 'eq',
    'Liquidity': 'eq', 'Liquidity pool': 'eq', 'Inducement': 'sweep',
    'Premium / discount': 'range', 'Premium / Discount': 'range', 'Dealing range': 'range', 'EQ': 'range',
    'HTF / LTF': 'range', 'Roadblock': 'range',
    'OTE': 'ote', 'Optimal Trade Entry': 'ote',
    'Engulfing zone': 'engulf', 'Rejection': 'engulf',
    'Breaker block': 'breaker', 'Mitigation block': 'breaker',
    'Third touch': 'third',
    'OCL': 'ocl', 'Band level': 'ocl', 'Touch': 'ocl', 'Miss': 'ocl', 'Fresh': 'ocl',
    'Unfresh': 'ocl', 'MSNR': 'ocl',
    'PDH': 'pdh', 'PDL': 'pdl', 'PWH': 'pwh', 'PWL': 'pwl',
    'CRT': 'crt', 'Candle Range Theory': 'crt',
    'AMD': 'amd', 'Power of Three': 'amd', 'IPDA': 'amd', 'Draw on liquidity': 'amd',
    'Judas swing': 'session', 'Asian range': 'session', 'Killzone': 'killzone',
    'Silver bullet': 'session', 'Session liquidity': 'session',
    'SMT divergence': 'smt', 'SMT': 'smt',
    'QM': 'qm', 'QM / QML': 'qm', 'Quasimodo': 'qm', 'Apex': 'qm',
    'Risk per trade': 'risk', 'Position sizing': 'risk', 'R multiple': 'risk', 'Expectancy': 'risk',
    'Drawdown': 'risk', 'Lot & pip': 'risk', 'Profit factor': 'risk', 'Win rate': 'risk',
    'Risk of ruin': 'risk', 'Time stop': 'risk', 'TP ladder': 'risk',
    'Spread & slippage': 'execution', 'Bid / Ask': 'execution', 'Pip': 'execution',
    'Point': 'execution', 'Lot': 'execution', 'Leverage': 'execution', 'Margin': 'execution',
    'Margin call': 'execution', 'Swap': 'execution', 'Market order': 'execution',
    'Limit order': 'execution', 'Stop order': 'execution', 'Trailing stop': 'execution',
    'Partial close': 'execution', 'Break even (BE)': 'execution', 'Slippage': 'execution',
    'Real yield': 'macro', 'DXY': 'macro', 'COT report': 'macro', 'Korelasi': 'macro',
    'News blackout': 'news',
    'A+ setup': 'concept', 'Confluence': 'concept', 'Multi-timeframe alignment': 'concept',
    'Journal': 'concept', 'Revenge trading': 'concept', 'Confirmation bias': 'concept',
    'FOMO': 'concept', 'Over-trading': 'concept', 'Backtest sample': 'concept'
  };

  function n(v) { const x = Number(v); return isFinite(x) ? x : null; }
  function rowsOk(rows) {
    return (Array.isArray(rows) ? rows : []).filter(r => r && isFinite(r.t) && isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c))
      .slice().sort((a, b) => a.t - b.t);
  }
  function f(v, d) { const x = n(v); return x == null ? '—' : x.toFixed(d == null ? 2 : d); }
  function tm(ts) {
    const x = n(ts); if (x == null) return '—';
    try { return new Date(x).toISOString().slice(5, 16).replace('T', ' ') + ' UTC'; } catch (e) { return '—'; }
  }
  function tfKeyOf(tf) {
    const s = String(tf || '').toUpperCase();
    if (s.indexOf('M15') >= 0) return 'M15';
    if (s.indexOf('M5') >= 0) return 'M5';
    if (s.indexOf('M1') >= 0) return 'M1';
    if (s.indexOf('H4') >= 0) return 'H4';
    if (s.indexOf('H1') >= 0) return 'H1';
    if (s.indexOf('D1') >= 0) return 'D1';
    return 'M15';
  }
  function atr(rows, len) {
    const k = Math.min(len || 14, rows.length - 1);
    if (k < 1) return 0.5;
    let sum = 0;
    for (let i = rows.length - k; i < rows.length; i++) {
      const r = rows[i], p = rows[i - 1] || r;
      sum += Math.max(r.h - r.l, Math.abs(r.h - p.c), Math.abs(r.l - p.c));
    }
    return (sum / k) || 0.5;
  }
  function swings(rows, k) {
    k = k || 2;
    const out = [];
    for (let i = k; i < rows.length - k; i++) {
      let hi = true, lo = true;
      for (let j = 1; j <= k; j++) {
        if (rows[i].h <= rows[i - j].h || rows[i].h < rows[i + j].h) hi = false;
        if (rows[i].l >= rows[i - j].l || rows[i].l > rows[i + j].l) lo = false;
      }
      if (hi) out.push({ i: i, type: 'H', p: rows[i].h, t: rows[i].t });
      if (lo) out.push({ i: i, type: 'L', p: rows[i].l, t: rows[i].t });
    }
    return out;
  }
  function maxH(rows) { let v = -Infinity; rows.forEach(r => { if (r.h > v) v = r.h; }); return v; }
  function minL(rows) { let v = Infinity; rows.forEach(r => { if (r.l < v) v = r.l; }); return v; }
  function line(i, p, label, color, dash) { return { kind: 'line', i: i, p: p, label: label, color: color || COL.struct, dash: dash !== false }; }
  function zone(i, j, a, b, label, color) {
    return { kind: 'zone', i: i, j: j, p1: Math.min(a, b), p2: Math.max(a, b), label: label, color: color || COL.zone };
  }
  function point(i, p, label, color) { return { kind: 'point', i: i, p: p, label: label, color: color || COL.struct }; }
  function okMark(m, len) {
    if (!m || !isFinite(m.i) || m.i < 0 || m.i >= len) return false;
    return m.kind === 'zone' ? isFinite(m.p1) && isFinite(m.p2) : isFinite(m.p);
  }
  function watch(rows, name, why) {
    const last = rows[rows.length - 1], sw = swings(rows, 2);
    const h = sw.filter(s => s.type === 'H').slice(-1)[0];
    const l = sw.filter(s => s.type === 'L').slice(-1)[0];
    const marks = [];
    if (h) marks.push(line(h.i, h.p, 'swing high terakhir', COL.mut));
    if (l) marks.push(line(l.i, l.p, 'swing low terakhir', COL.mut));
    marks.push(point(rows.length - 1, last.c, 'harga terakhir', COL.entry));
    return {
      found: false, marks: marks,
      why: why || ('Belum ada pola ' + name + ' yang memenuhi aturan pada candle terakhir. Area yang ditandai adalah swing/level terdekat yang sedang dipantau, bukan pola yang sudah jadi.'),
      rule: 'Area pantau: swing high/low terakhir dari data candle yang tersedia; tidak ada klaim pola sebelum syaratnya terpenuhi.',
      check: 'Di TradingView, cari swing yang sama pada TF ini lalu tunggu close candle yang benar-benar menembus/menolak level.'
    };
  }

  /* ---------- detektor pola (semua memakai index + harga candle asli) ---------- */
  function findSweep(rows) {
    const len = rows.length, a = atr(rows, 14);
    for (let i = len - 1; i >= Math.max(20, len - 90); i--) {
      const prev = rows.slice(i - 20, i);
      const ph = maxH(prev), pl = minL(prev);
      if (rows[i].h > ph + Math.max(0.05, a * 0.1) && rows[i].c < ph - 0.01) {
        return {
          found: true, side: 'sell',
          marks: [line(i, ph, 'high 20 candle disapu', COL.sweep), point(i, rows[i].h, 'wick sweep', COL.sweep), point(i, rows[i].c, 'close balik di bawah', COL.entry)],
          why: 'Candle ' + tm(rows[i].t) + ' menyapu high 20 candle sebelumnya di ' + f(ph) + ' (wick ' + f(rows[i].h) + ') lalu close kembali di ' + f(rows[i].c) + '. Stop trader di atas high itu terambil; entry tidak di titik sweep.',
          rule: 'Sweep bearish: high candle > high tertinggi 20 candle sebelumnya + buffer, tetapi close < high tersebut.',
          invalid: 'Close berikutnya bertahan di atas high yang disapu; sweep berubah menjadi breakout.'
        };
      }
      if (rows[i].l < pl - Math.max(0.05, a * 0.1) && rows[i].c > pl + 0.01) {
        return {
          found: true, side: 'buy',
          marks: [line(i, pl, 'low 20 candle disapu', COL.sweep), point(i, rows[i].l, 'wick sweep', COL.sweep), point(i, rows[i].c, 'close balik di atas', COL.entry)],
          why: 'Candle ' + tm(rows[i].t) + ' menyapu low 20 candle sebelumnya di ' + f(pl) + ' (wick ' + f(rows[i].l) + ') lalu close kembali di ' + f(rows[i].c) + '. Stop di bawah low itu terambil; entry menunggu konfirmasi, bukan di wick sweep.',
          rule: 'Sweep bullish: low candle < low terendah 20 candle sebelumnya - buffer, tetapi close > low tersebut.',
          invalid: 'Close berikutnya bertahan di bawah low yang disapu; sweep berubah menjadi breakdown.'
        };
      }
    }
    return watch(rows, 'sweep');
  }

  function findBOS(rows) {
    const len = rows.length, sw = swings(rows, 2);
    const hs = sw.filter(s => s.type === 'H'), ls = sw.filter(s => s.type === 'L');
    for (let k = hs.length - 1; k >= 0; k--) {
      const s = hs[k];
      let j = -1;
      for (let x = s.i + 1; x < len; x++) { if (rows[x].c > s.p + 0.02) { j = x; break; } }
      if (j < 0) continue;
      const retest = rows.slice(j + 1).findIndex(r => r.l <= s.p + 0.06 && r.c > s.p);
      const marks = [line(s.i, s.p, 'swing high yang di-break', COL.struct), point(j, rows[j].c, 'close BOS', COL.struct)];
      if (retest >= 0) marks.push(point(j + 1 + retest, s.p, 'retest level', COL.entry));
      return {
        found: true, side: 'buy', level: s.p,
        marks: marks,
        why: 'Close candle ' + tm(rows[j].t) + ' = ' + f(rows[j].c) + ' melewati swing high ' + tm(s.t) + ' = ' + f(s.p) + '. Itu BOS bullish. ' + (retest >= 0 ? 'Retest pertama terjadi di ' + tm(rows[j + 1 + retest].t) + ' pada level ' + f(s.p) + '.' : 'Belum ada retest; mengejar breakout pertama bukan entry retest.'),
        rule: 'BOS bullish: close candle menembus swing high terakhir; retest dicari setelah break, bukan candle breakout itu sendiri.',
        invalid: 'Close kembali di bawah level BOS (failed break).'
      };
    }
    for (let k = ls.length - 1; k >= 0; k--) {
      const s = ls[k];
      let j = -1;
      for (let x = s.i + 1; x < len; x++) { if (rows[x].c < s.p - 0.02) { j = x; break; } }
      if (j < 0) continue;
      const retest = rows.slice(j + 1).findIndex(r => r.h >= s.p - 0.06 && r.c < s.p);
      const marks = [line(s.i, s.p, 'swing low yang di-break', COL.struct), point(j, rows[j].c, 'close BOS', COL.struct)];
      if (retest >= 0) marks.push(point(j + 1 + retest, s.p, 'retest level', COL.entry));
      return {
        found: true, side: 'sell', level: s.p,
        marks: marks,
        why: 'Close candle ' + tm(rows[j].t) + ' = ' + f(rows[j].c) + ' melewati swing low ' + tm(s.t) + ' = ' + f(s.p) + '. Itu BOS bearish. ' + (retest >= 0 ? 'Retest pertama di ' + tm(rows[j + 1 + retest].t) + ' pada ' + f(s.p) + '.' : 'Belum ada retest; jangan mengejar candle breakout.'),
        rule: 'BOS bearish: close candle menembus swing low terakhir; retest dicari setelah break.',
        invalid: 'Close kembali di atas level BOS (failed break).'
      };
    }
    return watch(rows, 'BOS');
  }

  function trendBefore(sw, before) {
    const hs = sw.filter(s => s.type === 'H' && s.i < before).slice(-2);
    const ls = sw.filter(s => s.type === 'L' && s.i < before).slice(-2);
    if (hs.length < 2 || ls.length < 2) return null;
    if (hs[1].p > hs[0].p && ls[1].p > ls[0].p) return 'up';
    if (hs[1].p < hs[0].p && ls[1].p < ls[0].p) return 'down';
    return null;
  }
  function findChoch(rows) {
    const len = rows.length, sw = swings(rows, 2), a = atr(rows, 14);
    for (let i = len - 1; i >= Math.max(20, len - 90); i--) {
      /* Close menembus swing tanpa displacement bukan CHoCH yang sah. */
      const body = Math.abs(rows[i].c - rows[i].o);
      if (a > 0 && body < a * 0.9) continue;
      const low = sw.filter(s => s.type === 'L' && s.i <= i - 2).slice(-1)[0];
      if (low && rows[i].c < low.p - 0.02 && trendBefore(sw, i) === 'up') {
        return {
          found: true, side: 'sell',
          marks: [line(low.i, low.p, 'swing low berubah', COL.struct), point(i, rows[i].c, 'close CHoCH', COL.sl), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
          why: 'Tren sebelumnya higher high/higher low. Close ' + tm(rows[i].t) + ' = ' + f(rows[i].c) + ' (body ' + f(body) + ' = ' + f(a > 0 ? body / a : 0, 2) + '× ATR) menembus swing low ' + f(low.p) + '; itu CHoCH/MSS bearish dengan displacement. Entry menunggu retest FVG/OB, bukan di candle break.',
          rule: 'CHoCH bearish: tren naik lalu close menembus swing low terakhir dengan body ≥0,9× ATR; harus ada displacement, bukan sekadar wick.',
          invalid: 'Harga kembali membuat higher high di atas swing high sebelumnya.'
        };
      }
      const high = sw.filter(s => s.type === 'H' && s.i <= i - 2).slice(-1)[0];
      if (high && rows[i].c > high.p + 0.02 && trendBefore(sw, i) === 'down') {
        return {
          found: true, side: 'buy',
          marks: [line(high.i, high.p, 'swing high berubah', COL.struct), point(i, rows[i].c, 'close CHoCH', COL.tp), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
          why: 'Tren sebelumnya lower high/lower low. Close ' + tm(rows[i].t) + ' = ' + f(rows[i].c) + ' (body ' + f(body) + ' = ' + f(a > 0 ? body / a : 0, 2) + '× ATR) menembus swing high ' + f(high.p) + '; itu CHoCH/MSS bullish dengan displacement. Entry menunggu retest FVG/OB.',
          rule: 'CHoCH bullish: tren turun lalu close menembus swing high terakhir dengan body ≥0,9× ATR; butuh displacement untuk valid.',
          invalid: 'Harga kembali membuat lower low di bawah swing low sebelumnya.'
        };
      }
    }
    const b = findBOS(rows);
    if (b.found) {
      return {
        found: false, marks: b.marks,
        why: 'Belum ada CHoCH valid: yang terdeteksi masih BOS ' + b.side + ' pada ' + f(b.level) + '. CHoCH butuh close yang mematahkan swing berlawanan setelah tren jelas; jangan memberi label CHoCH pada BOS biasa.',
        rule: 'CHoCH hanya diberi label bila close mematahkan swing berlawanan arah setelah rangkaian HH/HL atau LH/LL.',
        invalid: 'BOS berlanjut searah tren; belum ada perubahan karakter.'
      };
    }
    return watch(rows, 'CHoCH');
  }

  function findFVG(rows) {
    const len = rows.length;
    let last = null;
    for (let i = len - 1; i >= Math.max(2, len - 110); i--) {
      const a = rows[i - 2], c = rows[i];
      if (c.l > a.h + 0.05) {
        const gap = { side: 'buy', i0: i - 2, i1: i, low: a.h, high: c.l, ce: (a.h + c.l) / 2, at: c.t };
        const filled = rows.slice(i + 1).some(r => r.l <= a.h + 0.01);
        if (!last) last = { gap: gap, filled: filled };
        if (!filled) {
          return {
            found: true, side: 'buy',
            marks: [zone(i - 2, i, a.h, c.l, 'FVG bullish ' + f(a.h) + '–' + f(c.l), COL.zone), line(i, gap.ce, 'CE 50% = ' + f(gap.ce), COL.entry), point(i, c.l, 'candle displacement', COL.tp)],
            why: 'Low candle ' + tm(c.t) + ' = ' + f(c.l) + ' tidak menutup high candle ' + tm(a.t) + ' = ' + f(a.h) + '. Gap ' + f(a.h) + '–' + f(c.l) + ' belum terisi; CE 50% = ' + f(gap.ce) + '. Entry limit di CE setelah displacement, bukan di tengah candle impuls.',
            rule: 'FVG bullish: low candle ke-3 > high candle ke-1; zona = high candle ke-1 sampai low candle ke-3; dianggap terisi bila ada low yang menyentuh batas bawah.',
            invalid: 'Low berikutnya menutup seluruh gap (di bawah ' + f(a.h) + '); FVG batal.'
          };
        }
      }
      if (c.h < a.l - 0.05) {
        const gap = { side: 'sell', i0: i - 2, i1: i, low: c.h, high: a.l, ce: (c.h + a.l) / 2, at: c.t };
        const filled = rows.slice(i + 1).some(r => r.h >= a.l - 0.01);
        if (!last) last = { gap: gap, filled: filled };
        if (!filled) {
          return {
            found: true, side: 'sell',
            marks: [zone(i - 2, i, c.h, a.l, 'FVG bearish ' + f(c.h) + '–' + f(a.l), COL.zone), line(i, gap.ce, 'CE 50% = ' + f(gap.ce), COL.entry), point(i, c.h, 'candle displacement', COL.sl)],
            why: 'High candle ' + tm(c.t) + ' = ' + f(c.h) + ' tidak menutup low candle ' + tm(a.t) + ' = ' + f(a.l) + '. Gap ' + f(c.h) + '–' + f(a.l) + ' belum terisi; CE 50% = ' + f(gap.ce) + '. Entry limit di CE setelah displacement.',
            rule: 'FVG bearish: high candle ke-3 < low candle ke-1; zona = high candle ke-3 sampai low candle ke-1.',
            invalid: 'High berikutnya menutup seluruh gap (di atas ' + f(a.l) + '); FVG batal.'
          };
        }
      }
    }
    if (last) {
      const g = last.gap;
      return {
        found: false,
        marks: [zone(g.i0, g.i1, g.low, g.high, 'FVG ' + (g.side === 'buy' ? 'bullish' : 'bearish') + ' (sudah terisi)', COL.mut)],
        why: 'FVG terakhir ' + (g.side === 'buy' ? 'bullish' : 'bearish') + ' di ' + f(g.low) + '–' + f(g.high) + ' sudah terisi oleh harga berikutnya. Zona yang sudah terisi bukan lokasi entry baru; tunggu FVG baru dari displacement berikutnya.',
        rule: 'FVG dianggap terisi bila harga menyentuh/menutup batas jauh zona.',
        invalid: 'FVG yang sudah terisi tidak dipakai lagi sebagai entry utama.'
      };
    }
    return watch(rows, 'FVG');
  }

  function findOB(rows) {
    const len = rows.length, a = atr(rows, 14);
    for (let i = len - 1; i >= Math.max(10, len - 100); i--) {
      const r = rows[i], body = Math.abs(r.c - r.o);
      if (body < Math.max(0.8, a * 1.15)) continue;
      const bull = r.c > r.o;
      let k = i - 1, guard = 0;
      while (k > 0 && guard < 8 && (bull ? rows[k].c >= rows[k].o : rows[k].c <= rows[k].o)) { k--; guard++; }
      if (k <= 0 || guard >= 8) continue;
      if (bull && rows[k].c >= rows[k].o) continue;
      if (!bull && rows[k].c <= rows[k].o) continue;
      const lo = Math.min(rows[k].o, rows[k].c), hi = Math.max(rows[k].o, rows[k].c);
      if (bull && r.c <= hi) continue;
      if (!bull && r.c >= lo) continue;
      const ce = (lo + hi) / 2;
      const marks = [zone(k, k + 2, lo, hi, 'OB ' + (bull ? 'bullish' : 'bearish') + ' ' + f(lo) + '–' + f(hi), COL.zone), line(k, ce, 'entry 50% = ' + f(ce), COL.entry), point(i, r.c, 'displacement ' + f(body) + ' (' + f(body / a, 2) + '×ATR)', bull ? COL.tp : COL.sl)];
      return {
        found: true, side: bull ? 'buy' : 'sell', zone: [lo, hi], legI: i, ce: ce,
        marks: marks,
        why: 'Candle ' + (bull ? 'bearish' : 'bullish') + ' terakhir sebelum impuls ada di ' + tm(rows[k].t) + ' (' + f(lo) + '–' + f(hi) + '). Impuls ' + tm(r.t) + ' body ' + f(body) + ' = ' + f(body / a, 2) + '× ATR menembus zona itu, jadi OB dianggap belum selesai. Entry di 50% = ' + f(ce) + ', SL 30 pip di luar zona.',
        rule: 'OB: candle berlawanan terakhir sebelum candle impuls yang body-nya ≥1,15× ATR dan close-nya melewati sisi jauh candle tersebut.',
        invalid: 'Close melewati sisi jauh OB tanpa reaksi; OB gagal dan berubah menjadi breaker.'
      };
    }
    return watch(rows, 'order block');
  }

  function findEQ(rows) {
    const len = rows.length, sw = swings(rows, 2), a = atr(rows, 14);
    const tol = Math.max(0.6, a * 0.35);
    ['H', 'L'].forEach(type => {
      const list = sw.filter(s => s.type === type).slice(-8);
      for (let i = list.length - 1; i > 0; i--) {
        for (let j = i - 1; j >= 0; j--) {
          if (list[i].i - list[j].i < 3) continue;
          if (Math.abs(list[i].p - list[j].p) <= tol) {
            const p = (list[i].p + list[j].p) / 2;
            return {
              found: true,
              marks: [line(list[j].i, p, (type === 'H' ? 'EQH' : 'EQL') + ' ' + f(p), COL.sweep), point(list[j].i, list[j].p, 'sentuhan 1', COL.sweep), point(list[i].i, list[i].p, 'sentuhan 2', COL.sweep), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
              why: 'Dua swing ' + (type === 'H' ? 'high' : 'low') + ' di ' + tm(list[j].t) + ' (' + f(list[j].p) + ') dan ' + tm(list[i].t) + ' (' + f(list[i].p) + ') hanya berbeda ' + f(Math.abs(list[i].p - list[j].p)) + ', di bawah toleransi ' + f(tol) + '. Area ini disebut ' + (type === 'H' ? 'EQH' : 'EQL') + ' dan menjadi target sapuan, bukan entry otomatis.',
              rule: 'EQH/EQL: dua swing sejenis berjarak ≤ 0,35× ATR; level = rata-rata keduanya.',
              invalid: 'Salah satu swing ditembus close dengan tegas; level equal tidak berlaku lagi.'
            };
          }
        }
      }
    });
    return watch(rows, 'equal high/low');
  }

  function findRange(rows) {
    const len = rows.length, win = rows.slice(-100);
    const hi = maxH(win), lo = minL(win), eq = (hi + lo) / 2, px = rows[len - 1].c;
    const state = px > eq ? 'premium' : 'discount';
    return {
      found: true,
      marks: [line(len - 1, hi, 'range high ' + f(hi), COL.mut), line(len - 1, eq, 'EQ 50% ' + f(eq), COL.struct), line(len - 1, lo, 'range low ' + f(lo), COL.mut), point(len - 1, px, state + ' ' + f(px), state === 'premium' ? COL.sl : COL.tp)],
      why: 'Dealing range 100 candle terakhir: high ' + f(hi) + ', low ' + f(lo) + ', EQ ' + f(eq) + '. Harga ' + f(px) + ' berada di ' + state + ' (' + (px > eq ? '>' : '<') + ' 50%). Untuk BUY, cari discount; untuk SELL, cari premium — searah storyline, bukan otomatis reversal.',
      rule: 'Premium/discount: high–low 100 candle terakhir dibagi 50%; bukan level resmi dan bukan sinyal reversal.',
      invalid: 'Range ditembus close dan terbentuk dealing range baru; EQ lama tidak dipakai.'
    };
  }

  function findOTE(rows) {
    const len = rows.length, sw = swings(rows, 2), px = rows[len - 1].c;
    let best = null;
    for (let i = 0; i < sw.length; i++) {
      const s = sw[i];
      if (s.type !== 'L') continue;
      const h = sw.slice(i + 1).filter(x => x.type === 'H' && x.p > s.p + 0.5 && x.i > s.i + 3).slice(-1)[0];
      if (h && (!best || h.i > best.h.i)) best = { side: 'buy', l: s, h: h };
    }
    for (let i = 0; i < sw.length; i++) {
      const s = sw[i];
      if (s.type !== 'H') continue;
      const l = sw.slice(i + 1).filter(x => x.type === 'L' && x.p < s.p - 0.5 && x.i > s.i + 3).slice(-1)[0];
      if (l && (!best || l.i > best.l.i)) best = { side: 'sell', l: l, h: s };
    }
    if (!best) return watch(rows, 'OTE');
    const lo = Math.min(best.l.p, best.h.p), hi = Math.max(best.l.p, best.h.p);
    /* Retracement bullish dihitung turun dari high; bearish dihitung naik dari low. */
    const z1 = best.side === 'buy' ? hi - (hi - lo) * 0.79 : lo + (hi - lo) * 0.62;
    const z2 = best.side === 'buy' ? hi - (hi - lo) * 0.62 : lo + (hi - lo) * 0.79;
    const inside = px >= z1 && px <= z2;
    return {
      found: inside,
      marks: [zone(best.h.i, len - 1, z1, z2, 'OTE 62–79% ' + f(z1) + '–' + f(z2), COL.zone), line(best.l.i, lo, 'awal leg ' + f(lo), COL.mut), line(best.h.i, hi, 'akhir leg ' + f(hi), COL.struct), point(len - 1, px, 'harga ' + f(px), inside ? COL.entry : COL.mut)],
      why: 'Leg ' + (best.side === 'buy' ? 'naik' : 'turun') + ' dari ' + f(lo) + ' ke ' + f(hi) + '. Retracement 62–79% = ' + f(z1) + '–' + f(z2) + '. Harga sekarang ' + f(px) + ' ' + (inside ? 'berada di dalam zona OTE' : 'belum masuk zona OTE') + '; entry tetap menunggu reaksi/konfirmasi, bukan limit buta.',
      rule: 'OTE: retracement 62%–79% dari leg swing terakhir; bukan level Fibonacci resmi tunggal.',
      invalid: 'Harga melewati 100% leg (di bawah ' + f(lo) + ' untuk bullish) atau struktur leg berubah.'
    };
  }

  function findEngulf(rows) {
    const len = rows.length;
    for (let i = len - 1; i >= Math.max(1, len - 70); i--) {
      const p = rows[i - 1], r = rows[i];
      const bull = r.c > r.o && p.c < p.o && r.o <= p.c && r.c >= p.o && (r.c - r.o) > (p.o - p.c) * 1.1;
      const bear = r.c < r.o && p.c > p.o && r.o >= p.c && r.c <= p.o && (r.o - r.c) > (p.c - p.o) * 1.1;
      if (bull || bear) {
        const lo = Math.min(p.o, p.c), hi = Math.max(p.o, p.c), ce = (lo + hi) / 2;
        return {
          found: true, side: bull ? 'buy' : 'sell',
          marks: [zone(i - 1, i, lo, hi, 'engulfing zone ' + f(lo) + '–' + f(hi), COL.zone), line(i, ce, 'retest 50% = ' + f(ce), COL.entry), point(i, bull ? r.c : r.c, bull ? 'close engulfing' : 'close engulfing', bull ? COL.tp : COL.sl)],
          why: 'Candle ' + tm(r.t) + ' ' + (bull ? 'bullish' : 'bearish') + ' menelan body candle sebelumnya (' + f(lo) + '–' + f(hi) + '). Zona engulfing = body candle yang ditelan; entry di retest 50% = ' + f(ce) + ', SL 30 pip di luar level, bukan di tengah candle.',
          rule: 'Engulfing: body candle menutup seluruh body candle sebelumnya dan ukurannya >1,1× body tersebut.',
          invalid: 'Candle berikutnya menelan balik; dua kegagalan di zona yang sama = zona dibuang.'
        };
      }
    }
    return watch(rows, 'engulfing');
  }

  function findOCL(rows) {
    const len = rows.length;
    for (let i = len - 2; i >= Math.max(1, len - 100); i--) {
      const c = rows[i].c, o = rows[i + 1].o;
      if (Math.abs(c - o) < 0.05) continue;
      const lo = Math.min(c, o), hi = Math.max(c, o), mid = (lo + hi) / 2;
      const later = rows.slice(i + 2);
      const touches = later.filter(r => r.l <= hi + 0.02 && r.h >= lo - 0.02);
      const broken = later.some(r => r.c < lo - 0.05 || r.c > hi + 0.05);
      if (!broken && touches.length) {
        const marks = [zone(i, len - 1, lo, hi, 'band OCL ' + f(lo) + '–' + f(hi), COL.zone), line(i, mid, 'level ' + f(mid), COL.entry), point(i, c, 'close–open', COL.struct)];
        touches.slice(0, 2).forEach((r, k) => marks.push(point(rows.indexOf(r), mid, 'touch ' + (k + 1), COL.tp)));
        return {
          found: true,
          marks: marks,
          why: 'Close candle ' + tm(rows[i].t) + ' = ' + f(c) + ' dan open candle berikutnya = ' + f(o) + ' membuat band ' + f(lo) + '–' + f(hi) + '. Harga sudah menyentuh band ' + touches.length + '× tanpa close menembus tepi jauh; level ini disebut OCL/MSNR.',
          rule: 'OCL/MSNR: pertemuan close candle dan open candle berikutnya; band = kedua harga; break baru sah bila close melewati tepi jauh.',
          invalid: 'Close melewati tepi jauh band; level berubah peran atau tidak berlaku.'
        };
      }
    }
    const last = rows[len - 1], prev = rows[len - 2] || last;
    return {
      found: false,
      marks: [zone(len - 2, len - 1, Math.min(prev.c, last.o), Math.max(prev.c, last.o), 'OCL terakhir ' + f(Math.min(prev.c, last.o)) + '–' + f(Math.max(prev.c, last.o)), COL.mut), point(len - 1, last.c, 'harga', COL.entry)],
      why: 'Belum ada OCL yang diuji tanpa ditembus. Band terakhir dari close/open = ' + f(Math.min(prev.c, last.o)) + '–' + f(Math.max(prev.c, last.o)) + '; ini area pantau, bukan level entry yang sudah terbukti.',
      rule: 'OCL dianggap teruji bila harga menyentuh band lalu close kembali menjauh, tanpa close melewati tepi jauh.',
      invalid: 'Close melewati tepi jauh band.'
    };
  }

  function dayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }
  function prevDay(rows) {
    const len = rows.length; if (len < 3) return null;
    const cur = dayKey(rows[len - 1].t);
    let key = null;
    for (let i = len - 1; i >= 0; i--) { const k = dayKey(rows[i].t); if (k !== cur) { key = k; break; } }
    if (!key) return null;
    const rs = rows.filter(r => dayKey(r.t) === key);
    if (rs.length < 3) return null;
    return { key: key, hi: maxH(rs), lo: minL(rs), first: rs[0], last: rs[rs.length - 1] };
  }
  function findPD(rows, kind) {
    const p = prevDay(rows); if (!p) return watch(rows, kind.toUpperCase());
    const level = kind === 'pdl' ? p.lo : p.hi;
    const len = rows.length, px = rows[len - 1].c;
    const swept = rows.slice(rows.indexOf(p.last) + 1).find(r => kind === 'pdl' ? (r.l < level - 0.02 && r.c > level) : (r.h > level + 0.02 && r.c < level));
    const marks = [line(len - 1, level, kind.toUpperCase() + ' ' + f(level) + ' (' + p.key + ')', COL.sweep), point(len - 1, px, 'harga ' + f(px), COL.entry)];
    if (swept) marks.push(point(rows.indexOf(swept), kind === 'pdl' ? swept.l : swept.h, 'sweep ' + tm(swept.t), COL.sweep));
    return {
      found: !!swept,
      marks: marks,
      why: 'Hari sebelumnya (' + p.key + ' UTC) high ' + f(p.hi) + ', low ' + f(p.lo) + '. ' + kind.toUpperCase() + ' = ' + f(level) + '. ' + (swept ? 'Level ini sudah disapu di ' + tm(swept.t) + ' lalu close kembali; itu sweep, bukan breakout.' : 'Harga sekarang ' + f(px) + ' belum menyapu level ini; level tetap acuan likuiditas.'),
      rule: 'PDH/PDL: high/low hari kalender UTC sebelumnya; bukan high/low sesi broker.',
      invalid: 'Close bertahan di luar PDH/PDL; level berubah menjadi breakout.'
    };
  }
  function weekKey(ts) {
    const d = new Date(ts), day = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
  }
  function findPW(rows, kind) {
    const map = new Map();
    rows.forEach(r => { const k = weekKey(r.t); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    const keys = [...map.keys()].sort();
    if (keys.length < 2) return watch(rows, kind.toUpperCase());
    const key = keys[keys.length - 2], rs = map.get(key);
    const level = kind === 'pwl' ? minL(rs) : maxH(rs);
    const len = rows.length, px = rows[len - 1].c;
    return {
      found: false,
      marks: [line(len - 1, level, kind.toUpperCase() + ' ' + f(level) + ' (' + key + ')', COL.sweep), line(len - 1, maxH(rs), 'high minggu ' + f(maxH(rs)), COL.mut), line(len - 1, minL(rs), 'low minggu ' + f(minL(rs)), COL.mut), point(len - 1, px, 'harga ' + f(px), COL.entry)],
      why: 'Minggu sebelumnya (' + key + ' UTC): high ' + f(maxH(rs)) + ', low ' + f(minL(rs)) + '. ' + kind.toUpperCase() + ' = ' + f(level) + '. Harga ' + f(px) + ' belum tentu menyapu level ini; ini acuan likuiditas mingguan, bukan sinyal.',
      rule: 'PWH/PWL: high/low minggu kalender UTC sebelumnya (Senin–Minggu).',
      invalid: 'Close minggu berjalan di luar level; level berubah peran.'
    };
  }

  function findCRT(rows) {
    const p = prevDay(rows); if (!p) return watch(rows, 'CRT');
    const len = rows.length, px = rows[len - 1].c;
    const cur = rows.filter(r => dayKey(r.t) === dayKey(rows[len - 1].t));
    const sw = cur.find(r => r.h > p.hi + 0.02 && r.c < p.hi) || cur.find(r => r.l < p.lo - 0.02 && r.c > p.lo);
    const marks = [zone(rows.indexOf(p.first), rows.indexOf(p.last), p.lo, p.hi, 'range acuan ' + p.key + ' ' + f(p.lo) + '–' + f(p.hi), COL.zone), point(len - 1, px, 'harga ' + f(px), COL.entry)];
    if (sw) marks.push(point(rows.indexOf(sw), sw.h > p.hi ? sw.h : sw.l, 'sapuan ' + tm(sw.t), COL.sweep));
    return {
      found: !!sw,
      marks: marks,
      why: 'Candle acuan hari ' + p.key + ' UTC: high ' + f(p.hi) + ', low ' + f(p.lo) + '. ' + (sw ? 'Sisi ' + (sw.h > p.hi ? 'atas' : 'bawah') + ' disapu di ' + tm(sw.t) + ' lalu close kembali; tunggu MSS/CHoCH LTF, entry di FVG/OB.' : 'Belum ada sapuan range acuan; jangan entry hanya karena harga menyentuh tepi range.'),
      rule: 'CRT: high/low candle acuan (hari sebelumnya); sapuan dianggap sah bila wick melewati level tetapi close kembali di dalam range.',
      invalid: 'Close di luar range dan bertahan; itu breakout, bukan sapuan CRT.'
    };
  }

  function findAMD(rows) {
    const p = prevDay(rows); if (!p) return watch(rows, 'AMD');
    const len = rows.length, px = rows[len - 1].c;
    const cur = rows.filter(r => dayKey(r.t) === dayKey(rows[len - 1].t));
    const sw = cur.find(r => r.h > p.hi + 0.02 && r.c < p.hi) || cur.find(r => r.l < p.lo - 0.02 && r.c > p.lo);
    const marks = [zone(rows.indexOf(p.first), rows.indexOf(p.last), p.lo, p.hi, 'accumulation ' + p.key + ' ' + f(p.lo) + '–' + f(p.hi), COL.zone), point(len - 1, px, px > (p.hi + p.lo) / 2 ? 'distribution atas' : 'distribution bawah', COL.entry)];
    if (sw) marks.push(point(rows.indexOf(sw), sw.h > p.hi ? sw.h : sw.l, 'manipulation ' + tm(sw.t), COL.sweep));
    return {
      found: !!sw,
      marks: marks,
      why: 'Range hari sebelumnya ' + f(p.lo) + '–' + f(p.hi) + ' adalah accumulation. ' + (sw ? 'Sisi ' + (sw.h > p.hi ? 'atas' : 'bawah') + ' dimanipulasi di ' + tm(sw.t) + ' lalu close kembali; distribusi diarahkan ke sisi berlawanan.' : 'Belum ada manipulation yang jelas; harga ' + f(px) + ' masih di dalam/mendekati range.'),
      rule: 'AMD/Power of Three: range acuan → sapuan salah satu sisi → distribusi ke likuiditas seberang.',
      invalid: 'Harga bertahan di luar range; manipulasi berubah menjadi tren baru.'
    };
  }

  function findSession(rows, name) {
    const len = rows.length, last = rows[len - 1], d = dayKey(last.t);
    const day = rows.filter(r => dayKey(r.t) === d);
    const hour = r => new Date(r.t).getUTCHours();
    const silver = /silver/i.test(name || '');
    if (silver) {
      const win = day.filter(r => hour(r) === 10 || hour(r) === 14);
      if (!win.length) return watch(rows, 'Silver Bullet');
      const hi = maxH(win), lo = minL(win), px = last.c;
      return {
        found: true,
        marks: [zone(rows.indexOf(win[0]), rows.indexOf(win[win.length - 1]), lo, hi, 'window 10–11 / 14–15 UTC ' + f(lo) + '–' + f(hi), COL.zone), point(len - 1, px, 'harga ' + f(px), COL.entry)],
        why: 'Candle dalam jendela Silver Bullet (10–11 atau 14–15 UTC): high ' + f(hi) + ', low ' + f(lo) + '. Jendela waktu hanya filter; entry tetap butuh FVG M5 + displacement, bukan otomatis buy/sell.',
        rule: 'Silver Bullet: jendela waktu 10–11/14–15 UTC; bukan level harga dan bukan jaminan arah.',
        invalid: 'Jendela berakhir tanpa displacement/FVG; tidak ada setup.'
      };
    }
    const asia = day.filter(r => hour(r) < 7);
    if (!asia.length) return watch(rows, 'Asian range');
    const hi = maxH(asia), lo = minL(asia), px = last.c;
    const london = day.filter(r => hour(r) >= 7 && hour(r) < 11);
    const sw = london.find(r => r.h > hi + 0.02 && r.c < hi) || london.find(r => r.l < lo - 0.02 && r.c > lo);
    const marks = [zone(rows.indexOf(asia[0]), rows.indexOf(asia[asia.length - 1]), lo, hi, 'range Asia ' + f(lo) + '–' + f(hi), COL.zone), point(len - 1, px, 'harga ' + f(px), COL.entry)];
    if (sw) marks.push(point(rows.indexOf(sw), sw.h > hi ? sw.h : sw.l, 'sapuan London ' + tm(sw.t), COL.sweep));
    return {
      found: !!sw,
      marks: marks,
      why: 'Range Asia 00–07 UTC: high ' + f(hi) + ', low ' + f(lo) + '. ' + (sw ? 'London menyapu sisi ' + (sw.h > hi ? 'atas' : 'bawah') + ' di ' + tm(sw.t) + ' lalu close kembali; ini Judas swing yang perlu konfirmasi MSS M5.' : 'London belum menyapu range Asia; jangan menganggap range Asia pasti dijebak.'),
      rule: 'Asian range: high/low 00–07 UTC; Judas: sapuan salah satu sisi pada London lalu close kembali ke dalam range.',
      invalid: 'London close di luar range Asia dan bertahan; bukan Judas, melainkan breakout.'
    };
  }

  function findDisplacement(rows) {
    const len = rows.length, a = atr(rows, 14);
    for (let i = len - 1; i >= Math.max(5, len - 60); i--) {
      const r = rows[i], body = Math.abs(r.c - r.o);
      if (body < a * 1.4) continue;
      const up = r.c > r.o, lo = Math.min(r.o, r.c), hi = Math.max(r.o, r.c);
      return {
        found: true,
        marks: [zone(i, i, lo, hi, 'body displacement ' + f(body) + ' (' + f(body / a, 2) + '×ATR)', up ? COL.tp : COL.sl), point(i, r.c, 'close ' + f(r.c), up ? COL.tp : COL.sl), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
        why: 'Candle ' + tm(r.t) + ' punya body ' + f(body) + ' = ' + f(body / a, 2) + '× ATR, close ' + (up ? 'naik' : 'turun') + ' di ' + f(r.c) + '. Itu displacement, bukan candle biasa; FVG/OB yang ditinggalkan candle ini yang dipakai untuk entry.',
        rule: 'Displacement: body candle ≥1,4× ATR(14); arah mengikuti close candle tersebut.',
        invalid: 'Candle berikutnya menelan seluruh body tanpa kelanjutan; displacement gagal.'
      };
    }
    return watch(rows, 'displacement');
  }

  function findNews(rows) {
    const len = rows.length, px = rows[len - 1].c;
    return {
      found: false, timeRule: true, proxy: false,
      marks: [point(len - 1, px, 'harga saat ini ' + f(px), COL.watch), line(len - 1, px, 'cek kalender rilis', COL.watch)],
      why: 'News blackout adalah aturan waktu, bukan level harga. Chart ini hanya menunjukkan harga terakhir ' + f(px) + '. Zona larangan 30 menit sebelum/sesudah CPI/NFP/PPI/FOMC tidak bisa digambar sebagai level; cek kalender resmi dan waktu rilis.',
      rule: 'News blackout: tidak entry 30 menit sebelum/sesudah rilis high-impact; bukan pola chart dan bukan level support/resistance.',
      check: 'Buka kalender BLS/The Fed atau TradingView Economic Calendar; bandingkan jam rilis dengan timestamp candle terakhir.',
      invalid: 'Ada rilis high-impact dalam 30 menit; batalkan entry meskipun chart terlihat bagus.'
    };
  }

  function findConcept(rows, name) {
    const len = rows.length, px = rows[len - 1].c, sw = swings(rows, 2);
    const h = sw.filter(s => s.type === 'H').slice(-1)[0], l = sw.filter(s => s.type === 'L').slice(-1)[0];
    const marks = [];
    if (h) marks.push(line(h.i, h.p, 'swing high', COL.mut));
    if (l) marks.push(line(l.i, l.p, 'swing low', COL.mut));
    marks.push(point(len - 1, px, 'harga ' + f(px), COL.entry));
    return {
      found: false, concept: true, proxy: false, marks: marks,
      why: 'Istilah “' + name + '” adalah filter/checklist, bukan pola geometri tunggal. Penanda hanya menunjukkan harga terakhir ' + f(px) + ' dan swing terdekat; terapkan istilah ini saat menilai setup, bukan sebagai sinyal dari satu candle.',
      rule: 'Istilah meta/psikologi tidak punya bentuk chart tunggal; tidak ada level entry yang dikarang untuknya.',
      invalid: 'Checklist tidak terpenuhi; setup dibatalkan walau arah terlihat benar.'
    };
  }

  function findKillzone(rows) {
    const len = rows.length, last = rows[len - 1], d = dayKey(last.t);
    const day = rows.filter(r => dayKey(r.t) === d);
    const hour = r => new Date(r.t).getUTCHours();
    const win = day.filter(r => (hour(r) >= 7 && hour(r) < 10) || (hour(r) >= 12 && hour(r) < 15));
    if (!win.length) {
      return {
        found: false, timeRule: true, proxy: false,
        marks: [point(len - 1, last.c, 'harga ' + f(last.c), COL.entry)],
        why: 'Killzone adalah jendela waktu London 07–10 UTC atau New York 12–15 UTC. Belum ada candle hari ini di jendela itu; chart hanya menunjukkan harga terakhir. Ini bukan level harga.',
        rule: 'Killzone: jendela waktu, bukan support/resistance. Jam bergeser mengikuti daylight saving dan zona waktu platform.',
        check: 'Bandingkan timestamp candle (UTC) dengan jam killzone di TradingView; jangan menganggap semua candle di luar jendela tidak valid.',
        invalid: 'Di luar killzone, likuiditas biasanya lebih tipis; setup tetap butuh struktur, bukan hanya jam.'
      };
    }
    const hi = maxH(win), lo = minL(win);
    return {
      found: true, timeRule: true, proxy: false,
      marks: [zone(rows.indexOf(win[0]), rows.indexOf(win[win.length - 1]), lo, hi, 'killzone ' + f(lo) + '–' + f(hi), COL.zone), point(len - 1, last.c, 'harga ' + f(last.c), COL.entry)],
      why: 'Candle di jendela killzone (London 07–10 UTC / New York 12–15 UTC) membentuk high ' + f(hi) + ' dan low ' + f(lo) + '. Zona ini menunjukkan waktu likuiditas tinggi, bukan level entry otomatis; entry tetap butuh POI + MSS.',
      rule: 'Killzone: London 07–10 UTC, New York 12–15 UTC; zona = high/low candle di dalam jendela.',
      check: 'Cek timestamp UTC candle dan jam killzone di platform; WIB = UTC+7, jadi London 14.00–17.00 WIB.',
      invalid: 'Jendela berakhir tanpa struktur; jangan memaksakan entry hanya karena berada di killzone.'
    };
  }

  function findSMT(rows) {
    const len = rows.length, sw = swings(rows, 2);
    const h = sw.filter(s => s.type === 'H').slice(-1)[0];
    const l = sw.filter(s => s.type === 'L').slice(-1)[0];
    const marks = [];
    if (h) marks.push(line(h.i, h.p, 'high emas ' + f(h.p), COL.sweep));
    if (l) marks.push(line(l.i, l.p, 'low emas ' + f(l.p), COL.sweep));
    marks.push(point(len - 1, rows[len - 1].c, 'harga ' + f(rows[len - 1].c), COL.entry));
    return {
      found: false, proxy: true, marks: marks,
      why: 'SMT membandingkan emas dengan DXY/yield. Endpoint candle ini hanya berisi XAUUSD, jadi tidak ada garis DXY palsu. Yang ditandai adalah swing emas yang harus dibandingkan pada timestamp yang sama di chart DXY/yield.',
      rule: 'SMT: emas membuat high/low baru, pembanding tidak mengonfirmasi. Tanpa data pembanding, statusnya area pantau — bukan klaim divergensi.',
      check: 'Buka DXY (TVC:DXY) atau US10Y di TradingView pada TF dan timestamp yang sama, lalu bandingkan swing-nya. Jangan menyimpulkan SMT dari chart emas saja.'
    };
  }

  function findQM(rows) {
    const len = rows.length, sw = swings(rows, 2);
    const lows = sw.filter(s => s.type === 'L'), highs = sw.filter(s => s.type === 'H');
    for (let i = lows.length - 1; i >= 2; i--) {
      const l1 = lows[i - 2], l2 = lows[i - 1], l3 = lows[i];
      if (!(l2.p < l1.p - 0.05 && l3.p > l2.p + 0.05)) continue;
      const neck = highs.filter(h => h.i > l2.i && h.i < l3.i).slice(-1)[0] || highs.filter(h => h.i > l2.i).slice(-1)[0];
      if (!neck) continue;
      const broke = rows.slice(neck.i + 1).some(r => r.c > neck.p + 0.02);
      const back = rows.slice(neck.i + 1).some(r => r.l <= l1.p + 0.1 && r.c > l1.p);
      return {
        found: !!(broke && back),
        marks: [line(l1.i, l1.p, 'QML left shoulder ' + f(l1.p), COL.zone), point(l2.i, l2.p, 'head ' + f(l2.p), COL.sl), line(neck.i, neck.p, 'neckline ' + f(neck.p), COL.struct), point(l3.i, l3.p, 'right shoulder ' + f(l3.p), COL.entry), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
        why: 'Pola: left shoulder ' + f(l1.p) + ', head ' + f(l2.p) + ', neckline ' + f(neck.p) + ', right shoulder ' + f(l3.p) + '. ' + (broke && back ? 'Neckline sudah di-break dan harga kembali ke QML; kandidat QM valid.' : 'Neckline belum di-break atau harga belum kembali ke QML; ini kandidat, bukan setup jadi.'),
        rule: 'QM bullish: head < left shoulder, harga menembus neckline, lalu kembali ke level left shoulder (QML).',
        invalid: 'Harga membuat low baru melewati head/apex; pola batal.'
      };
    }
    for (let i = highs.length - 1; i >= 2; i--) {
      const h1 = highs[i - 2], h2 = highs[i - 1], h3 = highs[i];
      if (!(h2.p > h1.p + 0.05 && h3.p < h2.p - 0.05)) continue;
      const neck = lows.filter(l => l.i > h2.i && l.i < h3.i).slice(-1)[0] || lows.filter(l => l.i > h2.i).slice(-1)[0];
      if (!neck) continue;
      const broke = rows.slice(neck.i + 1).some(r => r.c < neck.p - 0.02);
      const back = rows.slice(neck.i + 1).some(r => r.h >= h1.p - 0.1 && r.c < h1.p);
      return {
        found: !!(broke && back), side: 'sell',
        marks: [line(h1.i, h1.p, 'QML left shoulder ' + f(h1.p), COL.zone), point(h2.i, h2.p, 'head ' + f(h2.p), COL.sl), line(neck.i, neck.p, 'neckline ' + f(neck.p), COL.struct), point(h3.i, h3.p, 'right shoulder ' + f(h3.p), COL.entry), point(len - 1, rows[len - 1].c, 'harga', COL.entry)],
        why: 'Pola bearish: left shoulder ' + f(h1.p) + ', head ' + f(h2.p) + ', neckline ' + f(neck.p) + ', right shoulder ' + f(h3.p) + '. ' + (broke && back ? 'Neckline sudah di-break dan harga kembali ke QML; kandidat QM valid.' : 'Neckline belum di-break atau harga belum kembali ke QML; ini kandidat, bukan setup jadi.'),
        rule: 'QM bearish: head > left shoulder, harga menembus neckline ke bawah, lalu kembali ke level left shoulder (QML).',
        invalid: 'Harga membuat high baru melewati head/apex; pola batal.'
      };
    }
    return watch(rows, 'Quasimodo');
  }

  function findThird(rows) {
    const len = rows.length, sw = swings(rows, 2), a = atr(rows, 14);
    const tol = Math.max(0.5, a * 0.3), levels = [];
    sw.forEach(s => {
      let hit = null;
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].type === s.type && Math.abs(levels[i].p - s.p) <= tol) { hit = levels[i]; break; }
      }
      if (!hit) { hit = { type: s.type, p: s.p, pts: [] }; levels.push(hit); }
      hit.pts.push(s);
      hit.p = hit.pts.reduce((v, x) => v + x.p, 0) / hit.pts.length;
    });
    const best = levels.filter(x => x.pts.length >= 2).sort((a, b) => b.pts[b.pts.length - 1].i - a.pts[a.pts.length - 1].i)[0];
    if (!best) return watch(rows, 'third touch');
    const marks = [line(best.pts[0].i, best.p, 'level ' + f(best.p), COL.zone)];
    best.pts.slice(0, 3).forEach((s, k) => marks.push(point(s.i, s.p, 'touch ' + (k + 1), COL.entry)));
    marks.push(point(len - 1, rows[len - 1].c, 'harga', COL.entry));
    return {
      found: best.pts.length >= 3,
      marks: marks,
      why: 'Level ' + f(best.p) + ' sudah disentuh ' + best.pts.length + '× (' + best.pts.slice(0, 3).map(s => tm(s.t)).join(', ') + '). ' + (best.pts.length >= 3 ? 'Sentuhan ketiga searah storyline adalah kandidat entry; SL 30 pip di luar band, TP likuiditas luar.' : 'Baru ' + best.pts.length + ' sentuhan; belum memenuhi model third touch.'),
      rule: 'Third touch: minimal tiga swing menyentuh level dalam toleransi 0,3× ATR.',
      invalid: 'Close melewati tepi jauh level; level tidak lagi menahan.'
    };
  }

  function findBreaker(rows) {
    const ob = findOB(rows);
    if (ob.found && ob.zone) {
      const z = ob.zone, side = ob.side, after = rows.slice(ob.legI + 1);
      const failed = after.some(r => side === 'buy' ? r.c < z[0] - 0.02 : r.c > z[1] + 0.02);
      if (failed) {
        const idx = after.findIndex(r => side === 'buy' ? r.h >= z[0] - 0.02 : r.l <= z[1] + 0.02);
        const marks = [zone(ob.legI - 1, ob.legI + 1, z[0], z[1], 'breaker ' + f(z[0]) + '–' + f(z[1]), COL.zone), point(ob.legI, side === 'buy' ? rows[ob.legI].l : rows[ob.legI].h, 'OB gagal', COL.sl)];
        if (idx >= 0) marks.push(point(ob.legI + 1 + idx, z[0], 'retest breaker', COL.entry));
        return {
          found: idx >= 0,
          marks: marks,
          why: 'OB ' + (side === 'buy' ? 'bullish' : 'bearish') + ' di ' + f(z[0]) + '–' + f(z[1]) + ' gagal: harga close melewati sisi jauhnya. Zona itu berubah peran menjadi breaker; ' + (idx >= 0 ? 'retest terjadi di ' + tm(rows[ob.legI + 1 + idx].t) + '.' : 'retest belum terjadi.'),
          rule: 'Breaker: OB yang ditembus close lalu diuji ulang dari sisi berlawanan.',
          invalid: 'Harga kembali melewati breaker ke sisi lama dengan close kuat.'
        };
      }
    }
    return watch(rows, 'breaker');
  }

  function findRisk(rows) {
    const len = rows.length, px = rows[len - 1].c, entry = px, sl = px - 3.0, tp = px + 20.0;
    return {
      found: true, example: true,
      marks: [line(0, tp, 'TP2 +200 pip = ' + f(tp), COL.tp), line(0, entry, 'entry contoh = ' + f(entry), COL.entry), line(0, sl, 'SL 30 pip = ' + f(sl), COL.sl), zone(0, len - 1, sl, entry, 'risiko 30 pip', COL.sl)],
      why: 'Contoh penerapan pada harga terakhir ' + f(px) + ': BUY, SL ' + f(sl) + ' (30 pip), TP2 ' + f(tp) + ' (200 pip). Lot dihitung dari risiko akun ÷ (30 pip × nilai pip per lot), bukan dari target.',
      rule: 'Risiko: jarak SL 30 pip dan TP2 200 pip adalah aturan mesin; level ini contoh penerapan pada candle terakhir, bukan sinyal entry.',
      invalid: 'Jika risiko aktual melebihi batas harian, setup dibatalkan meskipun arah terlihat bagus.'
    };
  }
  function findExecution(rows) {
    const len = rows.length, px = rows[len - 1].c, spread = 0.2;
    return {
      found: true, example: true,
      marks: [zone(0, len - 1, px - spread / 2, px + spread / 2, 'contoh spread ' + f(spread), COL.zone), line(0, px, 'mid ' + f(px), COL.entry), line(0, px + 20, 'TP2 +200 pip', COL.tp), line(0, px - 3, 'SL 30 pip', COL.sl)],
      why: 'Contoh biaya pada harga ' + f(px) + ': spread ' + f(spread) + ' (contoh, bukan spread broker kamu) membuat ask/bid berbeda. Entry market membayar spread; limit di POI mengurangi slippage. SL 30 pip dan TP2 200 pip dihitung dari entry.',
      rule: 'Eksekusi: spread/slippage bukan pola chart; angka spread di sini contoh 0,20 dan harus dicek di platform masing-masing.',
      invalid: 'Spread melebar saat rilis atau slippage membuat entry jauh dari rencana; batalkan order.'
    };
  }
  function findMacro(rows) {
    const len = rows.length, px = rows[len - 1].c, win = rows.slice(-100);
    const hi = maxH(win), lo = minL(win);
    return {
      found: false, proxy: true,
      marks: [line(len - 1, hi, 'high 100 candle ' + f(hi), COL.mut), line(len - 1, lo, 'low 100 candle ' + f(lo), COL.mut), point(len - 1, px, 'harga ' + f(px), COL.entry)],
      why: 'Konteks makro tidak digambar sebagai garis palsu di chart emas. Harga ' + f(px) + ' berada dalam range ' + f(lo) + '–' + f(hi) + '. Arah makro harus dibaca dari DXY/yield riil dan kalender, lalu dipakai untuk memfilter setup — bukan sebagai entry.',
      rule: 'Makro: DXY, yield riil, dan berita adalah data terpisah; chart XAU hanya menunjukkan lokasi harga.',
      check: 'Buka TVC:DXY dan TVC:US10Y di TradingView pada TF yang sama; bandingkan arah dan timestamp, lalu cek kalender rilis.',
      invalid: 'Rilis high-impact ≤30 menit atau perubahan nada The Fed membatalkan rencana intraday.'
    };
  }

  const DETECTORS = {
    sweep: findSweep, bos: findBOS, choch: findChoch, fvg: findFVG, ob: findOB,
    eq: findEQ, range: findRange, ote: findOTE, engulf: findEngulf, ocl: findOCL,
    pdh: r => findPD(r, 'pdh'), pdl: r => findPD(r, 'pdl'),
    pwh: r => findPW(r, 'pwh'), pwl: r => findPW(r, 'pwl'),
    crt: findCRT, amd: findAMD, session: findSession, smt: findSMT, qm: findQM,
    third: findThird, breaker: findBreaker, risk: findRisk, execution: findExecution,
    macro: findMacro, displacement: findDisplacement, news: findNews, concept: findConcept,
    killzone: findKillzone, watch: watch
  };

  function termWhy(name, key, why, tf) {
    if (key === 'displacement') return why;
    if (key === 'news') return why;
    if (key === 'concept') return why;
    if (name === 'HTF / LTF') return 'TF besar (D1/H4) menentukan arah dan level; TF kecil (M15/M5) hanya mempertajam entry. ' + why + ' Chart ini memakai ' + tf + '; baca TF yang lebih besar di TradingView sebelum menyimpulkan arah.';
    if (name === 'Roadblock') return 'Roadblock adalah level yang melawan storyline, bukan target. ' + why + ' Sisi range yang berlawanan arah entry adalah roadblock; jangan entry melawannya.';
    if (name === 'SBR' || name === 'RBS') return 'SBR/RBS adalah level yang ditembus lalu diuji ulang dari sisi baru. ' + why + ' Retest pada level BOS di atas adalah lokasi role-flip; jangan entry pada breakout pertama.';
    if (name === 'Inducement') return 'Inducement adalah likuiditas kecil sebelum POI utama. ' + why + ' Sweep ini menunjukkan inducement diambil; entry utama tetap menunggu POI besar dan MSS.';
    if (name === 'Internal liquidity' || name === 'External liquidity') return 'Istilah ini membedakan likuiditas di dalam range vs high/low terluar. ' + why + ' Level yang ditandai adalah salah satu kolam likuiditas; target akhir biasanya external liquidity.';
    if (name === 'Touch' || name === 'Miss' || name === 'Fresh' || name === 'Unfresh' || name === 'Band level' || name === 'MSNR') return 'Istilah “' + name + '” menjelaskan cara membaca band close–open. ' + why + ' Sentuhan sah di tepi band; break baru sah bila close melewati tepi jauh.';
    if (name === 'Rejection') return 'Rejection adalah close kembali ke sisi level setelah gagal menembus. ' + why + ' Candle engulfing/rejection yang menandai penolakan; entry menunggu retest, bukan candle penolakan itu sendiri.';
    if (name === 'Turtle soup') return 'Turtle soup adalah sapuan high/low lama yang gagal breakout. ' + why + ' Sweep ini adalah inti turtle soup; entry reversal tetap butuh MSS/CHoCH.';
    if (name === 'Mitigation block') return 'Mitigation block adalah zona tempat posisi lama ditutup sebelum harga lanjut. ' + why + ' Zona yang ditandai adalah OB gagal yang diuji ulang; jangan entry sebelum reaksi.';
    if (name === 'BSL' || name === 'SSL' || name === 'Liquidity' || name === 'Liquidity pool') return 'Istilah “' + name + '” merujuk pada kolam likuiditas di high/low. ' + why + ' Level ini adalah target sapuan, bukan entry otomatis.';
    const extra = 'Pip' === name ? '1 pip XAUUSD = 0,10 harga; 30 pip = 3,00 dan 200 pip = 20,00. '
      : 'Point' === name ? '1 point = 0,01 harga; 1 pip = 10 point. '
      : 'Lot' === name ? '1,00 lot emas = 100 oz; nilai 1 pip = $10 per lot. '
      : 'Lot & pip' === name ? '1,00 lot emas = 100 oz; 1 pip = $10 per lot. '
      : 'Position sizing' === name ? 'Contoh: risiko 1% dari akun $10.000 = $100; SL 30 pip = $3/oz; lot = 100 ÷ (3 × 100) = 0,33 lot. '
      : 'Risk per trade' === name ? 'Risiko 0,5–2% ekuitas per trade; SL 30 pip menjadi dasar ukuran lot. '
      : 'R multiple' === name ? '1R = 30 pip; TP2 200 pip = 6,67R. '
      : 'Time stop' === name ? 'Ini batas waktu, bukan garis harga: batalkan bila belum trigger dalam jumlah candle yang direncanakan. '
      : 'TP ladder' === name ? 'TP1/TP2/TPmax adalah rencana keluar; TP2 minimal 200 pip. '
      : 'Bid / Ask' === name ? 'Ask = bid + spread; chart memakai harga terakhir/mid, bukan harga ask broker. '
      : 'Spread & slippage' === name ? 'Spread 0,20 = 2 pip pada contoh; biaya nyata cek platform. '
      : 'Market order' === name ? 'Entry sekarang membayar spread; limit di POI lebih terkendali. '
      : 'Limit order' === name ? 'Order hanya aktif bila harga menyentuh level; bukan chase. '
      : 'Stop order' === name ? 'Order aktif setelah level ditembus; waspada slippage. '
      : 'Trailing stop' === name ? 'SL mengikuti harga; garis SL awal tetap 30 pip. '
      : 'Partial close' === name ? 'Tutup sebagian di TP1, sisanya ke TP2; TP2 tetap minimal 200 pip. '
      : 'Break even (BE)' === name ? 'SL dipindah ke entry setelah untung; risiko awal tetap 30 pip. '
      : 'Leverage' === name ? 'Leverage memperbesar notional, bukan risiko per trade; risiko tetap ditentukan SL. '
      : 'Margin' === name ? 'Margin = notional ÷ leverage; margin call bukan level chart. '
      : 'Swap' === name ? 'Biaya inap, bukan level chart. ' : '';
    if (key === 'risk') return 'Untuk “' + name + '”: ' + extra + why + ' Angka entry/SL/TP di chart adalah contoh penerapan aturan, bukan sinyal entry.';
    if (key === 'execution') return 'Untuk “' + name + '”: ' + extra + why + ' Penanda spread/level ini contoh biaya eksekusi, bukan pola arah.';
    if (key === 'macro') return 'Untuk “' + name + '”: ' + why + ' Chart emas tidak membuktikan arah DXY/yield; bandingkan di chart terpisah.';
    return why;
  }

  function analysis(name, group, rows, tf) {
    rows = rowsOk(rows);
    if (rows.length < 10) {
      return { name: name, key: group, found: false, marks: [], why: 'Candle belum cukup untuk menandai ' + name + '.', rule: 'Minimal 10 candle.', invalid: '—', check: 'Muat ulang candle.', tf: tf || 'M15', at: rows.length ? rows[rows.length - 1].t : 0 };
    }
    const key = MARK_KEY[name] || MARK_KEY[group] || group;
    const fn = DETECTORS[key] || DETECTORS[group] || DETECTORS.watch;
    let a;
    try { a = fn(rows, name) || {}; } catch (e) { a = { found: false, marks: [], why: 'Analisis gagal: ' + String(e && e.message || e) }; }
    const marks = (a.marks || []).filter(m => okMark(m, rows.length)).slice(0, 7);
    if (!marks.length && rows.length) marks.push(point(rows.length - 1, rows[rows.length - 1].c, 'harga terakhir', COL.mut));
    const base = (typeof ALCH_CHART_CASES !== 'undefined' && ALCH_CHART_CASES[group]) || {};
    return {
      name: name, key: key, found: !!a.found, marks: marks,
      why: termWhy(name, key, a.why || 'Penanda dihitung dari candle terakhir; belum ada pola yang memenuhi aturan.', tf || 'M15'),
      rule: a.rule || 'Penanda mengikuti aturan pola pada data candle; tidak ada garis yang dikarang.',
      invalid: a.invalid || base.invalid || 'Struktur berubah; penanda tidak lagi berlaku.',
      check: a.check || 'Cocokkan candle, timestamp, dan level pada TradingView TF ini. Pola SMC adalah interpretasi aturan, bukan objek resmi.',
      caution: a.caution || '', example: !!a.example, proxy: !!a.proxy,
      concept: !!a.concept, timeRule: !!a.timeRule,
      tf: tf || 'M15', at: rows.length ? rows[rows.length - 1].t : 0
    };
  }

  /* ---------- SVG: candle + penanda presisi ---------- */
  function svg(rows, a, opts) {
    opts = opts || {};
    rows = rowsOk(rows);
    if (!rows.length) return '<div class="rb-live-err">Belum ada candle untuk digambar.</div>';
    /* Pastikan penanda tertua tetap masuk chart; jangan menampilkan legenda
       untuk level yang tidak tergambar. */
    let need = opts.bars || 70;
    (a.marks || []).forEach(m => {
      const mi = Math.min(m.i, m.j == null ? m.i : m.j);
      if (isFinite(mi)) need = Math.max(need, rows.length - mi + 5);
    });
    const bars = Math.min(rows.length, Math.max(opts.bars || 70, Math.min(180, need))), off = rows.length - bars;
    const view = rows.slice(off);
    const H = opts.h || 240, W = 720, mini = !!opts.mini;
    const padL = 8, padR = mini ? 10 : 94, padT = 12, padB = 20;
    const marks = (a.marks || []).map(m => Object.assign({}, m, { i: m.i - off, j: (m.j == null ? m.i : m.j) - off }))
      .filter(m => m.i >= -1 && m.i <= bars + 1);
    let hi = -Infinity, lo = Infinity;
    view.forEach(r => { if (r.h > hi) hi = r.h; if (r.l < lo) lo = r.l; });
    marks.forEach(m => {
      const ps = m.kind === 'zone' ? [m.p1, m.p2] : [m.p];
      ps.forEach(p => { if (p > hi) hi = p; if (p < lo) lo = p; });
    });
    if (!isFinite(hi) || !isFinite(lo)) { hi = 1; lo = 0; }
    const range = hi - lo || 1, pad = range * 0.08;
    hi += pad; lo -= pad;
    const y = p => padT + (hi - p) / (hi - lo || 1) * (H - padT - padB);
    const x = i => padL + (Math.max(0, Math.min(bars - 1, i)) / Math.max(1, bars - 1)) * (W - padL - padR);
    const bw = Math.max(1.5, (W - padL - padR) / Math.max(1, bars) * 0.62);
    let out = '<svg class="rb-live-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chart XAUUSD berpenanda">';
    out += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0f172a"/>';
    for (let k = 1; k <= 3; k++) {
      const yy = padT + k * (H - padT - padB) / 4;
      out += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="rgba(255,255,255,.06)"/>';
    }
    view.forEach((r, i) => {
      const up = r.c >= r.o, col = up ? '#22c55e' : '#ef4444', xx = x(i) + bw / 2;
      out += '<line x1="' + xx + '" y1="' + y(r.h) + '" x2="' + xx + '" y2="' + y(r.l) + '" stroke="' + col + '" stroke-width="1"/>';
      const yo = y(r.o), yc = y(r.c);
      out += '<rect x="' + (x(i)) + '" y="' + Math.min(yo, yc) + '" width="' + bw + '" height="' + Math.max(1, Math.abs(yc - yo)) + '" fill="' + col + '"/>';
    });
    marks.filter(m => m.kind === 'zone').forEach(m => {
      const x1 = x(m.i), x2 = x(m.j == null || m.j <= m.i ? Math.min(bars - 1, m.i + 6) : m.j);
      out += '<rect x="' + x1 + '" y="' + y(m.p2) + '" width="' + Math.max(2, x2 - x1) + '" height="' + Math.max(2, y(m.p1) - y(m.p2)) + '" fill="' + m.color + '" fill-opacity=".13" stroke="' + m.color + '" stroke-opacity=".75" stroke-dasharray="4 4"/>';
      if (!mini) out += '<text x="' + (x1 + 2) + '" y="' + (y(m.p2) - 3) + '" fill="' + m.color + '" font-size="10" font-family="sans-serif">' + alEsc(String(m.label).slice(0, 26)) + '</text>';
    });
    marks.filter(m => m.kind === 'line').forEach(m => {
      const yy = y(m.p);
      /* Level yang ditambatkan di candle terakhir (PDH/PDL, range, risk)
         digambar penuh; level swing tetap mulai dari candle swing-nya. */
      const x1 = m.i >= bars - 2 ? padL : x(m.i);
      out += '<line x1="' + x1 + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="' + m.color + '" stroke-width="1.3" stroke-dasharray="' + (m.dash ? '5 4' : '') + '"/>';
      if (!mini) {
        const lab = String(m.label), show = /\d/.test(lab) ? lab : lab + ' · ' + f(m.p);
        out += '<text x="' + (W - padR + 4) + '" y="' + (yy + 4) + '" fill="' + m.color + '" font-size="10" font-family="sans-serif">' + alEsc(show.slice(0, 26)) + '</text>';
      }
    });
    marks.filter(m => m.kind === 'point').forEach((m, k) => {
      const xx = x(m.i), yy = y(m.p);
      out += '<circle cx="' + xx + '" cy="' + yy + '" r="7.5" fill="' + m.color + '"/>';
      out += '<text x="' + xx + '" y="' + (yy + 3.5) + '" fill="#08101c" font-size="9.5" font-weight="700" text-anchor="middle" font-family="sans-serif">' + (k + 1) + '</text>';
    });
    if (!mini) {
      [hi - pad, (hi + lo) / 2, lo + pad].forEach(p => {
        out += '<text x="' + (W - padR + 4) + '" y="' + (y(p) + 3) + '" fill="#94a3b8" font-size="10" font-family="sans-serif">' + f(p) + '</text>';
      });
    }
    out += '<text x="' + padL + '" y="' + (H - 5) + '" fill="#94a3b8" font-size="10" font-family="sans-serif">' + alEsc(tm(view[0].t)) + ' → ' + alEsc(tm(view[view.length - 1].t)) + '</text>';
    out += '</svg>';
    return out;
  }

  function liveHtml(i, t, tc, a, rows, opts) {
    opts = opts || {};
    const modal = opts.mode === 'modal', tf = tc.tfKey || 'M15';
    const where = (a.marks || []).slice(0, 4).map((m, k) => {
      const price = m.kind === 'zone' ? f(m.p1) + '–' + f(m.p2) : f(m.p);
      const at = rows[m.i] ? tm(rows[m.i].t) : '—';
      return '<span class="rb-live-mk"><b>' + (k + 1) + '</b> ' + alEsc(m.label) + ' ' + price + ' <span class="mut">(' + alEsc(at) + ')</span></span>';
    }).join('');
    return '<div class="rb-live' + (modal ? ' rb-live-modal' : '') + '">'
      + '<div class="rb-live-top"><span class="rb-pill ' + (a.found ? 'g' : '') + '">' + (a.concept ? '📘 Bukan pola chart' : a.timeRule ? (a.found ? '🗓️ Jendela waktu' : '🗓️ Aturan waktu') : a.found ? '✅ Penanda terdeteksi' : a.proxy ? '👁️ Data pembanding terpisah' : '👁️ Area pantau') + '</span><span class="small mut">' + alEsc(tf) + ' · ' + (rows.length || 0) + ' candle · sampai ' + alEsc(tm(a.at)) + '</span></div>'
      + '<div class="rb-live-chart">' + svg(rows, a, { h: modal ? 340 : 190, bars: modal ? 110 : 64, mini: !modal }) + '</div>'
      + '<div class="rb-live-why"><b>Di mana:</b> ' + where + '<br><b>Kenapa di situ:</b> ' + alEsc(a.why) + '</div>'
      + (modal ? '<div class="rb-live-rule"><b>Aturan deteksi:</b> ' + alEsc(a.rule) + '</div><div class="rb-live-rule"><b>Invalidasi:</b> ' + alEsc(a.invalid) + '</div><div class="rb-live-rule"><b>Cek di TradingView:</b> ' + alEsc(a.check) + '</div>' : '')
      + '<div class="rb-live-src">' + alEsc('TradingView · FOREXCOM:XAUUSD · ' + tf) + ' · hanya candle yang sudah close; digambar ulang agar koordinat penanda presisi, bukan screenshot.' + (a.example ? ' Angka risiko ini contoh penerapan, bukan sinyal.' : '') + (a.proxy ? ' Tidak ada data pembanding di endpoint ini; tidak ada klaim divergensi.' : '') + (a.concept ? ' Istilah meta/psikologi tidak punya bentuk chart tunggal.' : '') + (a.timeRule ? ' Ini aturan waktu, bukan level harga.' : '') + '</div>'
      + (modal ? '' : '<button class="x rb-live-btn" type="button" onclick="alTermChart(' + i + ')">🔎 Chart besar + TradingView</button>')
      + '</div>';
  }

  function slotHtml(i, t, tc) {
    const tf = tc.tfKey || 'M15';
    return '<div class="rb-live-slot" data-alch-live="' + i + '" data-tf="' + alEsc(tf) + '"><div class="rb-live-load">Memuat candle TradingView ' + alEsc(tf) + '…</div></div>';
  }

  function loadRows(tf) {
    const key = tfKeyOf(tf);
    const now = Date.now();
    if (LIVE.rows[key] && now - LIVE.rows[key].at < LIVE.ttl) return Promise.resolve(LIVE.rows[key].rows);
    if (LIVE.pending[key]) return LIVE.pending[key];
    if (typeof window.tcall !== 'function') return Promise.reject(new Error('Fungsi data belum siap. Muat ulang halaman atau buka tab Signal sekali.'));
    LIVE.pending[key] = window.tcall({ action: 'xauCandles', tf: key, limit: 320 }).then(function (j) {
      if (!j || j.ok === false || !Array.isArray(j.rows) || !j.rows.length) throw new Error((j && j.error) || 'Candle ' + key + ' kosong');
      const all = rowsOk(j.rows);
      /* Hanya candle yang sudah close. Candle berjalan bisa membentuk pola
         sementara lalu berubah; penanda harus memakai candle final. */
      const tfMs = { M1: 60000, M5: 300000, M15: 900000, H1: 3600000, H4: 14400000, D1: 86400000 };
      const cut = all.filter(r => r.t + (tfMs[key] || 900000) <= Date.now() + 60000);
      const rows = cut.length >= 20 ? cut : all;
      if (rows.length < 20) throw new Error('Candle ' + key + ' belum cukup');
      LIVE.rows[key] = { at: Date.now(), rows: rows, source: j.source || '' };
      return rows;
    }).finally(function () { LIVE.pending[key] = null; });
    return LIVE.pending[key];
  }

  function drawSlot(el) {
    if (!el || el.getAttribute('data-alch-live-on')) return;
    el.setAttribute('data-alch-live-on', '1');
    const i = Number(el.getAttribute('data-alch-live'));
    const t = (typeof ALCH_TERMS !== 'undefined') ? ALCH_TERMS[i] : null;
    if (!t) return;
    const tc = alTermCase(t), tf = tc.tfKey || 'M15';
    el.innerHTML = '<div class="rb-live-load">Memuat candle TradingView ' + alEsc(tf) + '…</div>';
    loadRows(tf).then(function (rows) {
      if (!document.body.contains(el)) return;
      const a = analysis(t[0], tc.key, rows, tf);
      el.innerHTML = liveHtml(i, t, tc, a, rows, { mode: 'mini' });
      el.removeAttribute('aria-busy');
    }).catch(function (e) {
      const msg = String(e && e.message || e).slice(0, 180);
      el.innerHTML = '<div class="rb-live-err"><b>Chart live belum tersedia.</b> ' + alEsc(msg) + '</div>'
        + (typeof alCaseSvg === 'function' ? alCaseSvg(tc.key) : '')
        + '<div class="small mut">Skema di atas anatomi, bukan data live. Chart live kembali saat koneksi/izin tersedia.</div>'
        + '<button class="x" type="button" onclick="alLiveRetry(' + i + ')">Coba lagi</button>';
    });
  }

  function paint() {
    if (!document.querySelectorAll) return;
    const vh = window.innerHeight || 800;
    const nodes = document.querySelectorAll('[data-alch-live]:not([data-alch-live-on])');
    Array.prototype.forEach.call(nodes, function (el) {
      const r = el.getBoundingClientRect();
      if (r.bottom > -320 && r.top < vh + 320) drawSlot(el);
    });
  }

  function retry(i) {
    const el = document.querySelector('[data-alch-live="' + i + '"]');
    if (!el) return;
    el.removeAttribute('data-alch-live-on');
    drawSlot(el);
  }

  function tvUrl(tf) {
    const map = { M5: '5', M15: '15', H1: '60', H4: '240', D1: 'D' };
    return 'https://s.tradingview.com/widgetembed/?symbol=FOREXCOM%3AXAUUSD&interval=' + (map[tf] || '15') + '&theme=dark&style=1&timezone=Etc%2FUTC&locale=id&hidesidetoolbar=1&symboledit=0&saveimage=0&withdateranges=1&studies=%5B%5D';
  }

  function modalShell(i, t, tc, tf) {
    return '<div class="rb-chart-sheet" onclick="event.stopPropagation()">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div><div class="small mut">TradingView · XAUUSD · penanda dari candle nyata</div><h3>' + alEsc(t[0]) + ' — ' + alEsc(tf) + '</h3></div><button class="x rb-chart-close" type="button" onclick="alTermChartClose()" aria-label="Tutup">✕</button></div>'
      + '<div class="small mut" style="margin-top:4px"><b>' + alEsc(t[1]) + '</b> · ' + alEsc(t[2]) + '</div>'
      + '<div class="rb-live-tf">' + ['M5', 'M15', 'H1', 'H4', 'D1'].map(k => '<button type="button" class="x ' + (k === tf ? 'on' : '') + '" onclick="alTermTf(' + i + ',\'' + k + '\')">' + k + '</button>').join('') + '</div>'
      + '<div id="rbAlchLiveBody"><div class="rb-live-load">Memuat candle TradingView ' + alEsc(tf) + '…</div></div>'
      + '</div>';
  }

  function renderModal() {
    const st = LIVE.modal; if (!st) return;
    const t = ALCH_TERMS[st.i]; if (!t) return;
    const tc = alTermCase(t), tf = st.tf || tc.tfKey || 'M15';
    let box = document.getElementById('rbAlchChart');
    if (!box) {
      box = document.createElement('div');
      box.id = 'rbAlchChart';
      box.className = 'rb-chart-modal';
      box.hidden = true;
      box.onclick = function (e) { if (e.target === box) alTermChartClose(); };
      document.body.appendChild(box);
    }
    box.innerHTML = modalShell(st.i, t, tc, tf);
    box.hidden = false;
    document.body.classList.add('rb-chart-open');
    const body = document.getElementById('rbAlchLiveBody');
    loadRows(tf).then(function (rows) {
      if (!body || !document.body.contains(body)) return;
      const a = analysis(t[0], tc.key, rows, tf);
      body.innerHTML = liveHtml(st.i, t, tc, a, rows, { mode: 'modal' })
        + '<details class="rb-live-tv" style="margin-top:10px"><summary style="cursor:pointer"><b>Buka chart TradingView interaktif</b> <span class="mut small">(iframe; garis penanda tidak bisa ditanam di iframe)</span></summary>'
        + '<div class="rb-chart-frame"><iframe src="' + alEsc(tvUrl(tf)) + '" title="TradingView XAUUSD ' + alEsc(t[0]) + '" loading="lazy" allowtransparency="true" scrolling="no"></iframe></div>'
        + '<div class="small mut" style="margin-top:6px">Chart iframe dipakai untuk verifikasi mandiri. Penanda presisi ada di chart candle di atas karena widget TradingView tidak menerima gambar kustom dari luar.</div></details>'
        + '<div class="small mut" style="margin-top:6px"><a href="https://www.tradingview.com/chart/?symbol=FOREXCOM%3AXAUUSD" target="_blank" rel="noopener" style="color:var(--b)">Buka chart penuh ↗</a></div>';
    }).catch(function (e) {
      if (!body) return;
      body.innerHTML = '<div class="rb-live-err"><b>Data candle belum tersedia.</b> ' + alEsc(String(e && e.message || e).slice(0, 200)) + '</div>'
        + (typeof alCaseSvg === 'function' ? alCaseSvg(tc.key) : '')
        + '<div class="small mut">Skema anatomi di atas bukan data live.</div>'
        + '<button class="x" type="button" onclick="alTermTf(' + st.i + ',\'' + tf + '\')">Coba lagi</button>';
    });
  }

  function open(i) {
    const t = ALCH_TERMS[i]; if (!t) return;
    const tc = alTermCase(t);
    LIVE.modal = { i: i, tf: tc.tfKey || 'M15' };
    renderModal();
  }
  function setTf(i, tf) {
    if (!LIVE.modal || LIVE.modal.i !== i) return;
    LIVE.modal.tf = tfKeyOf(tf);
    renderModal();
  }

  window.alLivePaint = paint;
  window.alLiveRetry = retry;
  window.alLiveSlotHtml = slotHtml;
  window.alTermTf = setTf;
  window.alTermChart = open;
  window.__alchTest = {
    alTermAnalysis: analysis, alLiveSvg: svg, alLiveHtml: liveHtml,
    alLiveSlotHtml: slotHtml, alTfKey: tfKeyOf, alLoadRows: loadRows,
    alDetectors: Object.keys(DETECTORS)
  };
})();
