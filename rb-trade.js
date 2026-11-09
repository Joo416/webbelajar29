/* ==========================================================================
   RUANG BELAJAR V31 — TRADING BESAR (dimuat paling akhir)
   1. News Analisis XAUUSD : NFP · CPI · PPI · FOMC + berita di waktu yang sama,
      validitas tiap data (sumber, periode, kesegaran) + prediksi jalur emas.
   2. Signal Entry         : 5–10 sinyal Alchemist, SL ≥30 pip, TP1 ≥100 pip,
      TP2 ≥200 pip, TPmax dari struktur/global; sinyal bertahan sampai SL/TP,
      otomatis ambil data + nilai ulang AI setiap 5 menit (selalu aktif).
   3. Jurnal               : kalkulator lot akurat untuk akun USD / Cent / IDR
      dengan ukuran lot yang benar-benar akan dipakai.
   4. Alchemist            : istilah + timeframe pemakaian, peta timeframe,
      playbook konfirmasi M5 (model yang paling banyak dipakai trader pro).
   Modul ini menimpa fungsi tampilan lama; mesin latihan/peringkat tidak diubah.
   ========================================================================== */

const RB31_PAIRS = {
  XAUUSD: { usd: 10, note: '1 lot = 100 oz → $10 per pip 0,1' },
  EURUSD: { usd: 10, note: '1 lot = 100.000 unit → $10 per pip 0,0001' },
  GBPUSD: { usd: 10, note: '1 lot = 100.000 unit → $10 per pip 0,0001' },
  AUDUSD: { usd: 10, note: '1 lot = 100.000 unit → $10 per pip 0,0001' },
  NZDUSD: { usd: 10, note: '1 lot = 100.000 unit → $10 per pip 0,0001' }
};
const rb31n = v => { const n = Number(v); return isFinite(n) ? n : null; };
const rb31pip = v => (v == null ? '—' : v + ' pip');
const rb31pct = v => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%');

/* =====================================================================
   1. NEWS ANALISIS XAUUSD
   ===================================================================== */
function pXauNews() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem('xau_last') || 'null'); } catch (e) { }
  $('pane').innerHTML = '<div class="card rb-hero-alch"><div class="rb-hero-main"><div class="rb-hero-copy">'
    + '<div class="rb-eyebrow">Trading · berita global XAUUSD</div><h2>📰 News Analisis — NFP · CPI · PPI · FOMC</h2>'
    + '<div class="rb-note">Fokus tunggal XAUUSD. Mesin menarik <b>semua berita yang menyentuh emas</b>: NFP, CPI, PPI, FOMC, plus rilis lain yang jatuh di waktu yang sama (±48 jam). Sumber: jadwal resmi <b>BLS</b> &amp; <b>federalreserve.gov</b>, angka resmi BLS/FRED, EFFR NY Fed, yield Treasury &amp; yield riil, DXY, CFTC, dan kantor berita besar (Reuters/Bloomberg/CNBC/WSJ). Setiap analisis wajib menyebut <b>mengapa datanya valid</b> (sumber + periode + kesegaran + verifikasi silang) dan <b>ke mana XAUUSD bergerak</b> menjelang serta saat rilis.</div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">NFP</span><span class="rb-pill y">CPI</span><span class="rb-pill y">PPI</span><span class="rb-pill y">FOMC</span><span class="rb-pill">+ berita bersamaan</span></div>'
    + '</div><div class="ring" style="--p:100"><div class="ring-in"><b>AU</b><span>XAUUSD</span></div></div></div>'
    + '<div class="rb-actions"><button class="btn" type="button" id="xbtn" onclick="runXau()">📡 Ambil data global terbaru &amp; analisis</button>'
    + '<button class="btn alt" type="button" onclick="retryXauAI()">🤖 Nilai ulang AI</button>'
    + '<button class="btn alt" type="button" onclick="xauHistPaint()">🕘 Riwayat</button></div>'
    + '<div class="small mut" style="margin-top:8px">Setiap klik mengambil ulang data tanpa cache. Data resmi ditampilkan lebih dulu; AI menyusun arah setelahnya.</div></div>'
    + '<div id="xmsg" class="mut small" style="margin:0 0 10px"></div>'
    + '<div id="xhist"></div><div id="xres"></div>';
  xauHistPaint();
  if (c) renderXau(c, true);
}

/* Pembungkus renderXau: tampilan lama tetap, lalu tambah kartu validitas & prediksi. */
const RB31_RENDER_XAU = window.renderXau;
window.renderXau = function renderXau(j, stale) {
  if (typeof RB31_RENDER_XAU === 'function') { try { RB31_RENDER_XAU(j, stale); } catch (e) { console.warn('renderXau:', e); } }
  const box = $('xres');
  if (!box || !j || !j.xai) return;
  let add = '';
  const x = j.xai, evs = x.events || [];
  const t = j.fetchedAt ? new Date(j.fetchedAt) : null;
  const ageMin = t ? Math.max(0, Math.round((Date.now() - t.getTime()) / 60000)) : null;
  const fresh = ageMin != null ? (ageMin <= 15 ? '✅ sangat baru (' + ageMin + ' menit)' : ageMin <= 60 ? '🟡 ' + ageMin + ' menit' : '⚠️ ' + ageMin + ' menit — ambil ulang') : '—';

  const validRows = [];
  evs.forEach(function (e) {
    if (!e || !e.tag) return;
    validRows.push('<div class="exp" style="color:var(--tx);margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(e.tag) + ' — ' + esc(e.title || '') + '</b><span class="small mut">keyakinan ' + esc(e.confidence || '—') + '</span></div>'
      + (e.validity ? '<div class="small" style="margin-top:4px"> <b>Validitas:</b> ' + esc(e.validity) + '</div>' : '<div class="small mut" style="margin-top:4px">AI belum menulis alasan validitas khusus; pakai kartu kualitas data & sumber di bawah.</div>')
      + '<div class="small mut" style="margin-top:2px">Forecast: ' + esc(e.forecast || 'konsensus tidak ditemukan') + (e.previous ? ' · Previous: ' + esc(e.previous) : '') + '</div></div>');
  });
  const srcRows = (j.sources || []).slice(0, 8).map(function (s) {
    return '<div class="item"><span><a href="' + esc(s.uri) + '" target="_blank" rel="noopener" style="color:var(--b)">' + esc(s.title || s.domain || 'sumber') + '</a><div class="small mut">' + esc(s.domain || '') + (s.tier ? ' · tingkat ' + esc(String(s.tier)) : '') + (s.ageH != null ? ' · ' + (s.ageH < 48 ? s.ageH + ' jam' : Math.round(s.ageH / 24) + ' hari') + ' lalu' : '') + '</div></span><span class="small mut">' + (s.official ? ' resmi' : '') + '</span></div>';
  }).join('');

  add += '<div class="card"><div class="rb-card-head"><h3>✅ Mengapa data ini valid</h3><span class="rb-pill">' + esc(fresh) + '</span></div>'
    + '<div class="rb-note">Validitas = sumber resmi/tepercaya + periode data jelas + kesegaran + verifikasi silang. Ini yang dipakai untuk memprediksi arah emas, bukan opini.</div>'
    + (validRows.length ? validRows.join('') : '<div class="mut small">AI belum mengirim validitas per rilis.</div>')
    + ((x.validity || []).length ? '<div class="exp" style="color:var(--tx)"><b>Ringkasan validitas data:</b>' + x.validity.map(function (v) { return '<div class="small" style="margin-top:3px">• ' + esc(v) + '</div>'; }).join('') + '</div>' : '')
    + '<div class="small mut" style="margin-top:8px">Kesegaran paket data: ' + esc(fresh) + (j.cached ? ' · dari cache server' : '') + '. Tekan “Ambil data global terbaru” untuk membuang cache.</div>'
    + (srcRows ? '<div style="margin-top:8px"><b class="small">Sumber yang dipakai</b>' + srcRows + '</div>' : '')
    + '</div>';

  add += '<div class="card"><h3>📈 Prediksi jalur XAUUSD</h3>'
    + (x.gold_path ? '<div class="exp" style="color:var(--tx);line-height:1.6">' + fmtMd(x.gold_path) + '</div>'
      : '<div class="mut small">AI belum mengirim jalur harga ringkas. Lihat skenario per rilis di atas: setiap rilis sudah memuat skenario naik &amp; turun.</div>')
    + '<div class="small mut" style="margin-top:8px">Prediksi ini bersyarat pada angka rilis dan reaksi yield riil/USD. Bukan jaminan dan bukan saran finansial.</div></div>';

  box.insertAdjacentHTML('beforeend', add);
};

/* Kartu rencana pada tab News memakai TP berjenjang yang sama dengan mesin. */
function xauPlanHtml(sig) {
  if (!sig || sig.error) return '';
  const dir = sig.direction || 'WAIT';
  const col = dir === 'BUY' ? 'var(--ok)' : dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const p = sig.plan || null;
  const ok = (sig.checklist || []).filter(function (c) { return c.ok; }).length, n = (sig.checklist || []).length;
  let levels = '';
  if (p) {
    const sgn = dir === 'BUY' ? 1 : -1;
    const slPips = p.slPips != null ? p.slPips : 30;
    const e = rb31n(p.entry) != null ? p.entry : sig.price;
    const tp1 = rb31n(p.tp1) != null ? p.tp1 : rb31n(p.tp) != null ? p.tp : null;
    const tp2 = rb31n(p.tp2) != null ? p.tp2 : (e != null ? e + sgn * 200 * 0.1 : null);
    const tpM = rb31n(p.tpMax) != null ? p.tpMax : (e != null ? e + sgn * 300 * 0.1 : null);
    const pip = 0.1;
    const pips = (v) => (e != null && v != null) ? Math.round(Math.abs(v - e) / pip) + ' pip' : '';
    levels = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin-top:8px">'
      + '<div class="exp" style="color:var(--tx)"><div class="small mut">' + (p.entryType === 'LIMIT POI' ? 'Entry limit (POI)' : 'Entry') + '</div><div style="font-weight:800">' + sigNum(e) + '</div></div>'
      + '<div class="exp" style="color:var(--tx)"><div class="small mut">SL · ' + slPips + ' pip</div><div style="font-weight:800;color:var(--no)">' + sigNum(p.sl) + '</div></div>'
      + '<div class="exp" style="color:var(--tx)"><div class="small mut">TP1 · ' + (p.tp1Pips != null ? p.tp1Pips : pips(tp1)) + '</div><div style="font-weight:800;color:var(--ok)">' + sigNum(tp1) + '</div></div>'
      + '<div class="exp" style="color:var(--tx)"><div class="small mut">TP2 · ' + (p.tp2Pips != null ? p.tp2Pips : pips(tp2)) + '</div><div style="font-weight:800;color:var(--ok)">' + sigNum(tp2) + '</div></div>'
      + '<div class="exp" style="color:var(--tx)"><div class="small mut">TPmax · ' + (p.tpMaxPips != null ? p.tpMaxPips : pips(tpM)) + '</div><div style="font-weight:800;color:var(--ok)">' + sigNum(tpM) + '</div></div>'
      + '</div>';
  }
  return '<div class="card" style="border-left:5px solid ' + col + '">'
    + '<div class="rb-card-head"><h3>🎯 Rencana entry dari data global (mesin)</h3><span class="rb-pill">SL ≥30 · TP1 ≥100 · TP2 ≥200</span></div>'
    + '<div style="font-weight:900;font-size:1.2rem;color:' + col + ';letter-spacing:-.02em">'
    + (dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — belum ada konfluensi') + '</div>'
    + (levels || '<div class="small" style="margin-top:6px">Mesin menolak memaksa entry. ' + ((sig.gates || []).length ? 'Ditahan karena: ' + sig.gates.map(esc).join(' · ') + '.' : 'Tunggu checklist terpenuhi.') + '</div>')
    + '<div class="small mut" style="margin-top:8px">Keyakinan ' + sig.confidence + '% · skor ' + sig.score + ' · checklist ' + ok + '/' + n + ' OK · konfirmasi ' + (sig.confirms == null ? '—' : sig.confirms + '/6') + ' · ' + esc(sig.timeframe || 'M15') + ' · harga ' + sigNum(sig.price) + (sig.news && sig.news.length ? ' · ⚠️ rilis ≤90 menit' : '') + '</div>'
    + '<div class="small mut" style="margin-top:4px">Level dari mesin deterministik. TPmax mengikuti target struktur/global (range, high/low 20 hari, range Asia).</div>'
    + '<button class="btn alt full" type="button" style="margin-top:8px" onclick="S.sec=\'trading\';S.tab=\'signal\';home()">Buka tab  Signal Entry</button>'
    + '</div>';
}

/* =====================================================================
   2. SIGNAL ENTRY — 5–10 sinyal, bertahan sampai SL/TP, auto 5 menit
   ===================================================================== */
const RB31_TRK = 'rb31_sig_active_v1', RB31_CLOSED = 'rb31_sig_closed_v1';
const RB31_MAX = 10, RB31_MIN = 5, RB31_COOLDOWN = 20 * 60000;

function rb31Read(key, fb) {
  try { const a = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(a) ? a : fb; } catch (e) { return fb; }
}
function rb31Write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } }
function rb31Active() { return rb31Read(RB31_TRK, []).filter(function (s) { return s && s.id && s.entry != null && s.sl != null && s.tp1 != null; }); }
function rb31Closed() { return rb31Read(RB31_CLOSED, []).filter(function (s) { return s && s.id && s.closedAt; }); }
function rb31SigKey(s) { return String(s.id || s.method || 'x').replace(/[^a-zA-Z0-9_]+/g, '-') + '|' + s.dir; }
function rb31SigRecord(s, now) {
  const e = rb31n(s.entry), sl = rb31n(s.sl), tp1 = rb31n(s.tp1 != null ? s.tp1 : s.tp);
  const tp2 = rb31n(s.tp2 != null ? s.tp2 : s.tp1 != null ? s.tp1 : s.tp);
  const tpM = rb31n(s.tpMax != null ? s.tpMax : s.tp2 != null ? s.tp2 : s.tp);
  if (e == null || sl == null || tp1 == null) return null;
  const pip = 0.1;
  return {
    id: rb31SigKey(s), method: s.method || 'Alchemist', dir: s.dir, entry: e, sl: sl,
    tp1: tp1, tp2: tp2 != null ? tp2 : tp1, tpMax: tpM != null ? tpM : (tp2 != null ? tp2 : tp1),
    slPips: rb31n(s.slPips) || Math.round(Math.abs(e - sl) / pip),
    tp1Pips: rb31n(s.tpPips) || Math.round(Math.abs(tp1 - e) / pip),
    tp2Pips: rb31n(s.tp2Pips) || (tp2 != null ? Math.round(Math.abs(tp2 - e) / pip) : null),
    tpMaxPips: rb31n(s.tpMaxPips) || (tpM != null ? Math.round(Math.abs(tpM - e) / pip) : null),
    rr: rb31n(s.rr), score: rb31n(s.score), valid: !!s.valid, why: s.why || '', need: s.need || '',
    openedAt: (s.openedAt || now), status: 'OPEN', at: now
  };
}
/* Sinkronkan sinyal aktif dengan harga: SL → LOSS, TP1 → partial, TP2/TPmax → WIN.
   Sinyal TIDAK dihapus sampai terkena SL/TP. Setelah selesai, slot diisi sinyal baru. */
function rb31TrackSync(d, price) {
  if (!d || d.error) return false;
  const px = rb31n(price);
  const now = Date.now();
  let act = rb31Active(), closed = rb31Closed(), changed = false;
  if (px && px > 0) {
    act.forEach(function (s) {
      if (s.status === 'SL' || s.status === 'TP2' || s.status === 'MAX') return;
      const buy = s.dir === 'BUY';
      const sign = buy ? 1 : -1;
      const hitSL = buy ? px <= s.sl : px >= s.sl;
      const hitM = buy ? px >= s.tpMax : px <= s.tpMax;
      const hit2 = buy ? px >= s.tp2 : px <= s.tp2;
      const hit1 = buy ? px >= s.tp1 : px <= s.tp1;
      if (hitSL) { s.status = 'SL'; s.result = 'LOSS'; s.r = -1; s.closePrice = s.sl; s.closedAt = now; changed = true; }
      else if (hitM) { s.status = 'MAX'; s.result = 'WIN'; s.r = s.slPips ? +((s.tpMaxPips || 0) / s.slPips).toFixed(2) : null; s.closePrice = s.tpMax; s.closedAt = now; changed = true; }
      else if (hit2) { s.status = 'TP2'; s.result = 'WIN'; s.r = s.slPips ? +((s.tp2Pips || 0) / s.slPips).toFixed(2) : null; s.closePrice = s.tp2; s.closedAt = now; changed = true; }
      else if (hit1 && s.status === 'OPEN') { s.status = 'TP1'; s.tp1At = now; changed = true; }
      s.lastPrice = px; s.lastAt = now;
    });
  }
  const done = act.filter(function (s) { return s.status === 'SL' || s.status === 'TP2' || s.status === 'MAX'; });
  if (done.length) {
    const doneIds = {};
    done.forEach(function (s) { doneIds[s.id] = s.closedAt || now; });
    closed = done.concat(closed).sort(function (a, b) { return (b.closedAt || 0) - (a.closedAt || 0); }).slice(0, 30);
    act = act.filter(function (s) { return !doneIds[s.id]; });
    changed = true;
  }
  const pool = (d.setups || []).slice().sort(function (a, b) {
    return ((b.valid ? 1 : 0) - (a.valid ? 1 : 0)) || ((rb31n(b.score) || 0) - (rb31n(a.score) || 0));
  });
  pool.forEach(function (s) {
    if (act.length >= RB31_MAX) return;
    if (!s || s.status === 'LEWAT' || !s.dir || s.entry == null) return;
    const key = rb31SigKey(s);
    if (act.some(function (x) { return x.id === key; })) return;
    if (closed.some(function (x) { return x.id === key && now - (x.closedAt || 0) < RB31_COOLDOWN; })) return;
    const rec = rb31SigRecord(s, now);
    if (!rec) return;
    if (px && px > 0) {
      const buy = rec.dir === 'BUY';
      if (buy ? (px >= rec.tp1 || px <= rec.sl) : (px <= rec.tp1 || px >= rec.sl)) return;
    }
    act.push(rec);
    changed = true;
  });
  if (changed) { rb31Write(RB31_TRK, act.slice(0, RB31_MAX)); rb31Write(RB31_CLOSED, closed); }
  return changed;
}
function rb31PlanOf(d) {
  if (!d || !d.plan) return null;
  const p = d.plan, dir = d.direction || p.dir;
  if (dir !== 'BUY' && dir !== 'SELL') return null;
  const pip = 0.1, s = dir === 'BUY' ? 1 : -1;
  const entry = rb31n(p.entry) != null ? rb31n(p.entry) : rb31n(d.price);
  if (entry == null) return null;
  const slPips = rb31n(p.slPips) || 30;
  const sl = rb31n(p.sl) != null ? rb31n(p.sl) : entry - s * slPips * pip;
  const tp1 = rb31n(p.tp1) != null ? rb31n(p.tp1) : rb31n(p.tp) != null ? rb31n(p.tp) : entry + s * 100 * pip;
  const tp2 = rb31n(p.tp2) != null ? rb31n(p.tp2) : entry + s * 200 * pip;
  const tpMax = rb31n(p.tpMax) != null ? rb31n(p.tpMax) : entry + s * 300 * pip;
  return {
    dir: dir, entryType: p.entryType || d.entryType || 'MARKET', entry: entry, sl: sl,
    tp1: tp1, tp2: tp2, tpMax: tpMax,
    slPips: Math.round(Math.abs(entry - sl) / pip), tp1Pips: Math.round(Math.abs(tp1 - entry) / pip),
    tp2Pips: Math.round(Math.abs(tp2 - entry) / pip), tpMaxPips: Math.round(Math.abs(tpMax - entry) / pip),
    rr: rb31n(p.rr)
  };
}
function rb31Card(s, price) {
  const buy = s.dir === 'BUY';
  const st = s.status === 'TP1' ? '<span class="rb-pill" style="color:var(--ok);border-color:var(--ok)">🟢 TP1 tercapai — lanjut TP2</span>'
    : '<span class="rb-pill" style="color:var(--warn)">⏳ AKTIF — tunggu SL/TP</span>';
  const to = (v) => price && v != null ? Math.round(Math.abs(v - price) / 0.1) + ' pip' : '—';
  return '<div class="exp" style="margin-bottom:8px;color:var(--tx);border-color:' + (s.status === 'TP1' ? 'var(--ok)' : 'var(--line2)') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<b>' + (buy ? '🟢 BUY' : '🔴 SELL') + ' · ' + esc(s.method) + '</b>'
    + '<span class="small mut">dibuka ' + esc(new Date(s.openedAt).toLocaleTimeString('id-ID')) + ' · skor ' + (s.score == null ? '—' : s.score) + '/5</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;margin-top:7px">'
    + sigMini('Entry', sigNum(s.entry))
    + sigMini('SL · ' + s.slPips + ' pip', '<span style="color:var(--no)">' + sigNum(s.sl) + '</span>')
    + sigMini('TP1 · ' + s.tp1Pips + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tp1) + '</span>')
    + sigMini('TP2 · ' + (s.tp2Pips == null ? '—' : s.tp2Pips) + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tp2) + '</span>')
    + sigMini('TPmax · ' + (s.tpMaxPips == null ? '—' : s.tpMaxPips) + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tpMax) + '</span>')
    + '</div>'
    + '<div class="small mut" style="margin-top:5px">Jarak dari harga: TP1 ' + to(s.tp1) + ' · TP2 ' + to(s.tp2) + ' · TPmax ' + to(s.tpMax) + ' · SL ' + to(s.sl) + '</div>'
    + '<div class="small" style="margin-top:5px">' + st + '</div>'
    + (s.why ? '<div class="small mut" style="margin-top:4px">' + esc(s.why) + '</div>' : '')
    + (s.valid ? '' : '<div class="small" style="margin-top:3px;color:var(--warn)">⚠️ ' + esc(s.need || 'syarat belum lengkap') + '</div>')
    + '</div>';
}
function rb31ActiveHtml(price) {
  const act = rb31Active();
  const sorted = act.slice().sort(function (a, b) { return (a.status === 'TP1' ? 0 : 1) - (b.status === 'TP1' ? 0 : 1) || (b.openedAt || 0) - (a.openedAt || 0); });
  return '<div class="card"><div class="rb-card-head"><h3>🟢 Sinyal aktif (' + act.length + '/' + RB31_MAX + ')</h3>'
    + '<span class="rb-pill">' + (act.length >= RB31_MIN ? '✅ ' + act.length + ' sinyal berjalan' : '⏳ menunggu sinyal baru') + '</span></div>'
    + '<div class="rb-note">Sinyal <b>tidak diganti</b> selama belum terkena SL/TP. Setelah selesai (SL/TP1/TP2/TPmax), mesin mencari sinyal baru pada refresh berikutnya. Tidak ada tombol mematikan refresh: data + AI diperbarui otomatis tiap 5 menit.</div>'
    + (act.length ? sorted.map(function (s) { return rb31Card(s, price); }).join('')
      : '<div class="warn">Belum ada sinyal aktif. Mesin memilih 5–10 setup terbaik dari struktur M15/M5 + harga spot live. Tunggu refresh otomatis atau tekan “Ambil data terbaru”.</div>')
    + '</div>';
}
function rb31ClosedPaint() {
  const el = $('sigHist');
  if (!el) return;
  const done = rb31Closed().slice(0, 6);
  el.innerHTML = '<div class="card"><div class="rb-card-head"><h3>🏁 Sinyal selesai (SL/TP)</h3>'
    + (done.length ? '<button class="x" type="button" onclick="rb31ClearClosed()">Hapus riwayat</button>' : '') + '</div>'
    + (done.length ? done.map(function (s) {
      const win = s.result === 'WIN';
      return '<div class="item" style="align-items:flex-start"><span><b>' + (s.dir === 'BUY' ? '🟢 BUY' : '🔴 SELL') + ' · ' + esc(s.method) + '</b><div class="small mut">' + esc(new Date(s.closedAt).toLocaleString('id-ID')) + ' · entry ' + sigNum(s.entry) + ' → ' + esc(s.status) + ' @' + sigNum(s.closePrice) + '</div></div><span style="white-space:nowrap;color:' + (win ? 'var(--ok)' : 'var(--no)') + ';font-weight:800">' + (win ? '✅ ' : '❌ ') + (s.r != null ? (s.r > 0 ? '+' : '') + s.r + 'R' : s.status) + '</span></div>';
    }).join('') : '<div class="mut small">Belum ada sinyal yang selesai. Sinyal dicatat otomatis saat kena SL/TP.</div>')
    + '</div>';
}
function rb31ClearClosed() {
  if (!confirm('Hapus riwayat sinyal yang sudah selesai?')) return;
  rb31Write(RB31_CLOSED, []);
  rb31ClosedPaint();
}

function pSignalEntry() {
  if (!SIG_ST.data) SIG_ST.data = sigCacheGet();
  SIG_ST.auto = true;
  try { localStorage.setItem('rb_sig_auto', '1'); } catch (e) { }
  const d = SIG_ST.data;
  const fresh = d && d.generatedAt && (Date.now() - Date.parse(d.generatedAt) < 150000);
  const stale = d && d.generatedAt ? '<span class="mut small">Data tersimpan ' + esc(sigTime(d.generatedAt)) + '</span>' : '';
  $('pane').innerHTML =
    '<div class="card rb-hero-alch"><div class="rb-hero-main"><div class="rb-hero-copy">'
    + '<div class="rb-eyebrow">Trading · sinyal eksekusi XAUUSD</div><h2>🎯 Signal Entry Alchemist</h2>'
    + '<div class="rb-note">Mesin membaca chart <b>live</b> (spot emas + candle M15 struktur, M5 konfirmasi, M1 tick, bias H1/D1), lalu memilih <b>5–10 setup</b> paling akurat. Konfirmasi entry memakai model Alchemist yang paling banyak dipakai trader profesional: <b>sapuan likuiditas → MSS/CHoCH → entry di FVG 50%, order block, atau OTE 62–79% M5</b>. Aturan level: <b>SL minimal 30 pip</b>, <b>TP1 minimal 100 pip</b>, <b>TP2 minimal 200 pip</b>, <b>TPmax</b> mengikuti target struktur/global (range, high/low 20 hari, range Asia). Sinyal bertahan sampai SL/TP, lalu diganti sinyal baru. Data + AI diperbarui otomatis <b>setiap 5 menit</b>.</div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">SL ≥30 pip</span><span class="rb-pill y">TP1 ≥100 pip</span><span class="rb-pill y">TP2 ≥200 pip</span><span class="rb-pill">5–10 sinyal</span><span class="rb-pill">Auto 5 menit</span></div>'
    + '</div><div class="ring" style="--p:100"><div class="ring-in"><b>AU</b><span>XAUUSD</span></div></div></div>'
    + '<div class="rb-actions"><button class="btn" type="button" onclick="sigLoad(false)">📡 Ambil data terbaru</button>'
    + '<button class="btn alt" type="button" onclick="sigRunAI()">🤖 Nilai ulang AI</button>'
    + '<button class="btn alt" type="button" onclick="sigCopy(this)">📋 Salin sinyal</button>'
    + '<button class="btn alt" type="button" onclick="sigNotifAsk()">' + esc(sigNotifLabel()) + '</button></div>'
    + '<div class="small mut" style="margin-top:8px"> Auto-refresh <b>5 menit</b>: selalu aktif (ambil data terbaru → nilai ulang AI). ' + stale + '</div></div>'
    + '<div id="sigMsg" class="card" style="padding:10px 14px;display:none"></div>'
    + '<div id="sigBox"></div>'
    + '<div class="card"><div class="rb-card-head"><h3>📈 Chart XAUUSD — TradingView real-time</h3><span class="rb-pill" id="sigTvPill">LIVE · M5</span></div>'
    + '<div class="rb-note" style="margin-bottom:8px">Chart resmi TradingView (tanpa login). Pakai untuk <b>memverifikasi</b> level mesin: sapuan, MSS, FVG/OB. Sinyal dihitung dari data harga live + candle server, jadi tetap sinkron walau chart diganti timeframe.</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
    + '<button class="x" type="button" data-sigtv="1" onclick="sigTvInt(1)">1m</button>'
    + '<button class="x" type="button" data-sigtv="5" onclick="sigTvInt(5)">5m</button>'
    + '<button class="x" type="button" data-sigtv="15" onclick="sigTvInt(15)">15m</button>'
    + '<button class="x" type="button" onclick="sigTv()">🔄 Muat ulang chart</button></div>'
    + '<div style="border-radius:14px;overflow:hidden;height:clamp(300px,54vh,460px);border:1px solid var(--line)" id="sigTV"></div>'
    + '<div class="small mut" style="margin-top:6px"><a href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD" target="_blank" rel="noopener" style="color:var(--b)">Buka chart penuh di TradingView ↗</a></div></div>'
    + '<div id="sigHist"></div>';
  sigTv();
  sigPaint();
  sigTickStart();
  sigAutoStart();
  if (!fresh && !SIG_ST.loading) setTimeout(function () { sigLoad(false); }, 80);
}
function sigAutoStart() {
  if (SIG_ST.timer) clearInterval(SIG_ST.timer);
  SIG_ST.auto = true;
  try { localStorage.setItem('rb_sig_auto', '1'); } catch (e) { }
  SIG_ST.timer = setInterval(function () {
    if (!document.getElementById('sigBox')) { clearInterval(SIG_ST.timer); SIG_ST.timer = 0; return; }
    if (!SIG_ST.loading && !SIG_ST.loadingAI) sigLoad(false);
  }, 5 * 60000);
}
function sigAutoStop() { /* refresh otomatis 5 menit tidak bisa dimatikan (permintaan) */ }
function sigAuto() { if (typeof v21Toast === 'function') v21Toast('Auto-refresh 5 menit selalu aktif'); sigAutoStart(); }
function sigLivePaint() {
  const t = SIG_ST.tick;
  if (t && t.price && SIG_ST.data && rb31TrackSync(SIG_ST.data, t.price) && !rb31Painting) { sigPaint(); return; }
  const el = $('sigLive');
  if (!el) return;
  if (!t || !t.price) { el.textContent = 'live: —'; return; }
  const lv = rb31PlanOf(SIG_ST.data);
  let extra = '';
  if (lv) extra = ' · selisih entry ' + Math.round(Math.abs(t.price - lv.entry) / 0.1) + ' pip';
  el.innerHTML = '🔴 live <b>' + sigNum(t.price) + '</b> · ' + esc(new Date(t.at).toLocaleTimeString('id-ID')) + extra;
}
let rb31Painting = false;
function sigPaint() {
  if (rb31Painting) return;
  rb31Painting = true;
  try { rb31PaintNow(); } finally { rb31Painting = false; }
}
function rb31PaintNow() {
  const box = $('sigBox');
  if (typeof sigMsgBox === 'function') sigMsgBox();
  if (!box) return;
  const d = SIG_ST.data;
  if (!d) {
    box.innerHTML = '<div class="card"><div class="warn">Belum ada data sinyal. Tekan <b>Ambil data terbaru</b> untuk membaca chart XAUUSD live, DXY, yield 10Y, spot emas, dan kalender rilis.</div></div>' + rb31ActiveHtml(0);
    rb31ClosedPaint();
    return;
  }
  if (d.error) {
    box.innerHTML = '<div class="card"><div class="warn">' + esc(d.error) + '</div><button class="btn alt full" type="button" onclick="sigLoad(false)">Coba lagi</button></div>';
    rb31ClosedPaint();
    return;
  }
  const price = rb31n(d.price) || rb31n(SIG_ST.tick && SIG_ST.tick.price) || 0;
  rb31TrackSync(d, price);
  const lv = rb31PlanOf(d);
  const dir = d.direction || 'WAIT';
  const col = dir === 'BUY' ? 'var(--ok)' : dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const lbl = dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — konfluensi belum cukup';
  const planCard = '<div class="card" style="border-left:5px solid ' + col + '">'
    + '<div class="rb-card-head"><h3>🗺️ Rencana mesin</h3><span class="rb-pill">' + esc(d.timeframe || 'M15') + ' · M5 · M1</span></div>'
    + '<div style="font-size:1.35rem;font-weight:900;color:' + col + ';letter-spacing:-.02em;margin:2px 0 6px">' + lbl + '</div>'
    + '<div class="small mut" id="sigLive">live: —</div>'
    + (lv ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(102px,1fr));gap:8px;margin-top:8px">'
      + sigKv(lv.entryType === 'LIMIT POI' ? 'Entry limit (POI)' : 'Entry', sigNum(lv.entry))
      + sigKv('SL · ' + lv.slPips + ' pip', '<span style="color:var(--no)">' + sigNum(lv.sl) + '</span>')
      + sigKv('TP1 · ' + lv.tp1Pips + ' pip', '<span style="color:var(--ok)">' + sigNum(lv.tp1) + '</span>')
      + sigKv('TP2 · ' + lv.tp2Pips + ' pip', '<span style="color:var(--ok)">' + sigNum(lv.tp2) + '</span>')
      + sigKv('TPmax · ' + lv.tpMaxPips + ' pip', '<span style="color:var(--ok)">' + sigNum(lv.tpMax) + '</span>')
      + '</div><div class="small mut" style="margin-top:6px">TPmax = target struktur/global terjauh yang masih logis. Setelah TP1 tercapai sinyal tetap berjalan sampai TP2/TPmax/SL.</div>'
      : '<div class="small" style="margin-top:6px">Skor ' + d.score + ' (ambang ±2,0) · keyakinan ' + d.confidence + '%. Mesin menolak memaksa entry saat struktur, sweep, displacement, dan makro belum searah.</div>'
      + ((d.gates || []).length ? '<div class="warn" style="margin-top:8px">Entry ditahan: ' + d.gates.map(esc).join(' · ') + '</div>' : '')
      + (d.poi ? '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>POI terdekat:</b> FVG ' + (d.poi.kind === 'bull' ? 'bullish' : 'bearish') + ' ' + d.poi.lo + '–' + d.poi.hi + '</div>' : ''))
    + '</div>';

  const pool = (d.setups || []);
  const cand = '<div class="card"><div class="rb-card-head"><h3>🎯 Kandidat sinyal terbaru (' + pool.length + ')</h3><span class="rb-pill">' + (d.dataValid ? '✅ data valid' : '⚠️ data terbatas') + '</span></div>'
    + '<details><summary class="small" style="cursor:pointer;color:var(--b)">Lihat semua kandidat, level, dan alasannya</summary>'
    + (pool.length ? pool.map(function (s) {
      const buy = s.dir === 'BUY';
      return '<div class="exp" style="margin-top:8px;color:var(--tx)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + (buy ? '🟢 BUY' : '🔴 SELL') + ' · ' + esc(s.method) + '</b><span class="rb-pill">' + esc(s.status) + ' · skor ' + s.score + '/5</span></div>'
        + '<div class="small mut" style="margin-top:4px">Entry ' + sigNum(s.entry) + ' · SL ' + sigNum(s.sl) + ' (' + s.slPips + ' pip) · TP1 ' + sigNum(s.tp1 != null ? s.tp1 : s.tp) + ' (' + s.tpPips + ' pip) · TP2 ' + sigNum(s.tp2) + ' (' + (s.tp2Pips == null ? '—' : s.tp2Pips) + ' pip) · TPmax ' + sigNum(s.tpMax) + ' (' + (s.tpMaxPips == null ? '—' : s.tpMaxPips) + ' pip)</div>'
        + '<div class="small" style="margin-top:3px">' + esc(s.why || '') + '</div>'
        + '<div class="small" style="margin-top:2px;color:' + (s.valid ? 'var(--ok)' : 'var(--warn)') + '">' + (s.valid ? '✅ valid' : '⚠️ ' + esc(s.need || 'belum valid')) + '</div></div>';
    }).join('') : '<div class="mut small" style="margin-top:8px">Mesin belum memberi setup.</div>')
    + '</details></div>';

  const ctx = '<div class="card"><div class="rb-card-head"><h3>🌍 Konteks pasar</h3><span class="rb-pill">live spot + candle</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px">'
    + sigKv('Harga', sigNum(d.price), d.candleAt ? sigTime(d.candleAt) : '')
    + sigKv('Struktur M15', esc(d.structure || '—'), d.bos ? d.bos.kind + ' ' + d.bos.dir : 'belum BOS')
    + sigKv('Konfirmasi M5', d.m5 ? esc(d.m5.trend) : '—', d.m5 && d.m5.sweep ? 'sweep ' + d.m5.sweep.kind : 'MSS + FVG/OB')
    + sigKv('ATR14', sigNum(d.atr), d.atrPips == null ? '' : d.atrPips + ' pip')
    + sigKv('RSI14', d.rsi == null ? '—' : d.rsi)
    + sigKv('Posisi range', d.position == null ? '—' : d.position + '%', d.position == null ? '' : (d.position < 50 ? 'discount' : 'premium'))
    + sigKv('Sesi', d.session ? esc(d.session.ses) : '—', d.session && d.session.kill ? d.session.kill : 'di luar killzone')
    + sigKv('Sapuan likuiditas', d.sweep ? (d.sweep.kind === 'bull' ? 'bawah' : 'atas') : '—', d.sweep ? '@' + d.sweep.level : 'tidak terdeteksi')
    + sigKv('Displacement', d.displacement ? (d.displacement.kind === 'bull' ? 'naik' : 'turun') : '—', d.displacement ? 'body ' + d.displacement.body : 'tidak ada impuls')
    + sigKv('Order block', d.ob ? (d.ob.kind === 'bull' ? 'bullish' : 'bearish') : '—', d.ob ? d.ob.lo + '–' + d.ob.hi : 'tidak ada')
    + sigKv('SMT / DXY', d.smt ? d.smt.kind : '—', d.smt ? 'divergensi' : 'tidak ada')
    + sigKv('Range Asia', d.asia ? d.asia.lo + '–' + d.asia.hi : '—', d.asia && d.asia.judas ? 'judas ' + d.asia.judas : 'belum disapu')
    + sigKv('OCL harian', d.ocl ? sigNum(d.ocl.close) : '—', d.ocl ? 'open ' + sigNum(d.ocl.open) : 'tidak terbaca')
    + sigKv('Validasi silang', d.cross ? (d.cross.ok ? 'cocok' : 'selisih') : '—', d.cross ? d.cross.src + ' ' + sigNum(d.cross.price) + ' (' + d.cross.diffPct + '%)' : 'PAXG tidak terbaca')
    + '</div>'
    + (d.macro ? '<div class="small mut" style="margin-top:8px">Sumber harga: ' + esc(d.priceSource || '—') + ' · DXY ' + d.macro.dxy + ' (10 hari ' + d.macro.dxyChg10d + '%) · Yield 10Y ' + d.macro.us10y + '% (10 hari ' + d.macro.us10yChg10d + '%)' + (d.daily ? ' · Tren harian ' + d.daily.trend : '') + '</div>' : '')
    + (d.news && d.news.length ? '<div class="warn" style="margin-top:8px">⚠️ Rilis High impact ≤90 menit: ' + d.news.map(function (n) { return esc(n.title) + ' (' + n.inMin + ' menit)'; }).join(' · ') + '</div>' : '<div class="small mut" style="margin-top:8px">✅ Tidak ada rilis USD High impact dalam 90 menit.</div>')
    + '</div>';

  const cek = '<div class="card"><div class="rb-card-head"><h3>✅ Checklist Alchemist</h3><span class="rb-pill">' + (d.checklist || []).filter(function (c) { return c.ok; }).length + '/' + (d.checklist || []).length + ' OK</span></div>'
    + (d.checklist || []).map(function (c) { return '<div class="item"><span>' + (c.ok ? '✅' : '') + ' ' + esc(c.s) + '</span><span class="mut small" style="text-align:right">' + esc(c.n || '') + '</span></div>'; }).join('')
    + '</div>';

  const ai = SIG_ST.ai;
  const aiCard = '<div class="card"><div class="rb-card-head"><h3>🤖 Penilaian AI</h3>'
    + (SIG_ST.loadingAI ? '<span class="rb-pill">menganalisis…</span>' : ai ? '<span class="rb-pill" style="color:' + (ai.verdict === 'CONFIRM' ? 'var(--ok)' : ai.verdict === 'REJECT' ? 'var(--no)' : 'var(--warn)') + '">' + esc(ai.verdict) + '</span>' : '<span class="rb-pill">belum ada</span>')
    + '</div>'
    + (ai ? '<div class="exp" style="color:var(--tx);line-height:1.6">' + fmtMd(ai.summary || '') + '</div>'
      + (ai.alchemist && ai.alchemist.length ? '<div style="margin-top:8px">' + ai.alchemist.map(function (x) { return '<div class="small" style="margin:3px 0">' + (x.ok ? '✅' : '⚠️') + ' <b>' + esc(x.step) + '</b> — ' + esc(x.note) + '</div>'; }).join('') + '</div>' : '')
      + ((ai.reasons || []).length ? '<div style="margin-top:8px"><b class="small">Alasan</b>' + ai.reasons.map(function (x) { return '<div class="small" style="margin:2px 0">• ' + esc(x) + '</div>'; }).join('') + '</div>' : '')
      + ((ai.warnings || []).length ? '<div class="warn" style="margin-top:8px">' + ai.warnings.map(function (x) { return '⚠️ ' + esc(x); }).join('<br>') + '</div>' : '')
      + ((ai.management || []).length ? '<div style="margin-top:8px"><b class="small">Manajemen TP1/TP2/TPmax</b>' + ai.management.map(function (x) { return '<div class="small" style="margin:2px 0">• ' + esc(x) + '</div>'; }).join('') + '</div>' : '')
      + (ai.invalidation ? '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>Sinyal batal bila:</b> ' + esc(ai.invalidation) + '</div>' : '')
      + '<div class="small mut" style="margin-top:6px">' + esc((SIG_ST.meta && SIG_ST.meta.provider) || 'AI') + (SIG_ST.meta && SIG_ST.meta.model ? ' · ' + esc(String(SIG_ST.meta.model).slice(0, 32)) : '') + '. AI tidak mengubah level entry/SL/TP.</div>'
      : '<div class="mut small">' + (SIG_ST.loadingAI ? 'AI menilai checklist, konfirmasi M5, dan risiko rilis…' : 'Tekan “Nilai ulang AI” untuk penilaian kualitas. Sinyal dan level tetap bisa dipakai tanpa AI.') + '</div>')
    + '</div>';

  const basis = (d.basis || []).length ? '<div class="card"><h3>📊 Dasar skor (transparan)</h3>' + d.basis.map(function (b) { return '<div class="item"><span>' + (b.w > 0 ? '🟢 +' : '🔴 ') + b.w + ' · ' + esc(b.why) + '</span></div>'; }).join('') + '<div class="small mut">≥ +2,0 → BUY; ≤ −2,0 → SELL; selain itu WAIT.</div></div>' : '';

  const qual = '<div class="card"><h3>✅ Kualitas &amp; validitas data</h3>' + (d.quality || []).map(function (q) { return '<div class="item"><span>' + (q.ok ? '✅' : '⚠️') + ' ' + esc(q.k) + '</span><span class="mut small">' + esc(q.d || 'tidak tersedia') + '</span></div>'; }).join('')
    + ((d.validation || []).length ? '<div class="small mut" style="margin-top:8px">Validasi: ' + d.validation.map(function (v) { return (v.ok ? '✅ ' : '⚠️ ') + esc(v.k) + ' — ' + esc(v.d); }).join(' · ') + '</div>' : '')
    + '<div class="small mut" style="margin-top:8px">Sumber: ' + (d.sources || []).map(function (s) { return (s.ok ? '✅ ' : '⚠️ ') + esc(s.name); }).join(' · ') + '</div></div>';

  box.innerHTML = planCard + rb31ActiveHtml(price) + cand + ctx + cek + aiCard + basis + qual;
  rb31ClosedPaint();
  sigLivePaint();
}
function sigCopy(btn) {
  const d = SIG_ST.data, lv = rb31PlanOf(d), act = rb31Active();
  if (!d) return alert('Belum ada sinyal untuk disalin.');
  let txt = 'SIGNAL ENTRY XAUUSD — ' + sigTime(d.generatedAt) + '\n'
    + 'Arah mesin: ' + d.direction + ' · keyakinan ' + d.confidence + '% · skor ' + d.score + ' · ' + d.timeframe + ' · konfirmasi ' + (d.confirms == null ? '—' : d.confirms + '/6') + '\n';
  if (lv) txt += 'Entry ' + lv.entry + ' (' + lv.entryType + ') | SL ' + lv.sl + ' (' + lv.slPips + ' pip) | TP1 ' + lv.tp1 + ' (' + lv.tp1Pips + ' pip) | TP2 ' + lv.tp2 + ' (' + lv.tp2Pips + ' pip) | TPmax ' + lv.tpMax + ' (' + lv.tpMaxPips + ' pip)\n';
  else txt += 'Rencana: WAIT' + ((d.gates || []).length ? ' — ' + d.gates.join('; ') : '') + '\n';
  txt += 'Struktur M15: ' + d.structure + (d.m5 ? ' · M5 ' + d.m5.trend : '') + (d.sweep ? ' · sweep ' + d.sweep.kind : '') + '\n'
    + 'Sesi: ' + (d.session ? d.session.ses + (d.session.kill ? ' / ' + d.session.kill : '') : '—') + '\n'
    + 'Checklist: ' + (d.checklist || []).filter(function (c) { return c.ok; }).length + '/' + (d.checklist || []).length + ' OK\n';
  if (act.length) txt += 'SINYAL AKTIF (' + act.length + '):\n' + act.map(function (s) { return '• ' + s.method + ' ' + s.dir + ' E' + s.entry + ' SL' + s.sl + ' TP1 ' + s.tp1 + ' TP2 ' + s.tp2 + ' TPmax ' + s.tpMax + ' [' + s.status + ']'; }).join('\n') + '\n';
  txt += 'Edukasi, bukan saran finansial.';
  const done = function () {
    if (btn) { const o = btn.textContent; btn.textContent = '✅ Tersalin'; setTimeout(function () { btn.textContent = o; }, 1600); }
    else if (typeof v21Toast === 'function') v21Toast('Tersalin');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { sigCopyFallback(txt, done); });
    else sigCopyFallback(txt, done);
  } catch (e) { sigCopyFallback(txt, done); }
}

/* =====================================================================
   3. JURNAL — kalkulator lot USD / Cent / IDR + ukuran lot
   ===================================================================== */
function pJurnal() {
  const brOpts = Object.keys(BROKERS).map(function (k) { return '<option value="' + k + '"' + (k === 'exness' ? ' selected' : '') + '>' + esc(BROKERS[k].n) + '</option>'; }).join('');
  const pairOpts = Object.keys(RB31_PAIRS).map(function (p) { return '<option' + (p === 'XAUUSD' ? ' selected' : '') + '>' + p + '</option>'; }).join('');
  $('pane').innerHTML = '<div class="card"><div class="rb-card-head"><h3>🧮 Kalkulator lot akurat</h3><span class="rb-pill">USD · Cent · IDR</span></div>'
    + '<div class="rb-note">Hitung ukuran lot dari risiko, atau masukkan lot yang benar-benar akan kamu pakai untuk melihat risiko aktualnya. Nilai pip emas 1 lot = $10 per 0,1 (100 oz), sesuai kontrak standar.</div>'
    + '<div class="row"><div><label>Broker</label><select id="rb31br" onchange="rb31Calc()">' + brOpts + '</select></div>'
    + '<div><label>Jenis akun</label><select id="rb31cur" onchange="rb31Calc()"><option value="usd">USD ($)</option><option value="cent">Cent (¢)</option><option value="idr">IDR (Rp)</option></select></div></div>'
    + '<div class="row"><div><label>Pair</label><select id="rb31pair" onchange="rb31Calc()">' + pairOpts + '</select></div>'
    + '<div><label>Saldo akun</label><input id="rb31bal" type="number" step="any" value="1000" oninput="rb31Calc()"></div></div>'
    + '<div class="row"><div><label>Risiko per trade (%)</label><input id="rb31risk" type="number" step="0.1" value="1" oninput="rb31Calc()"></div>'
    + '<div><label>Stop loss (pips)</label><input id="rb31sl" type="number" step="1" value="30" oninput="rb31Calc()"></div></div>'
    + '<div class="row"><div><label><b>Ukuran lot yang akan dipakai</b></label><input id="rb31lot" type="number" step="0.01" value="0.01" oninput="rb31Calc()"></div>'
    + '<div><label>TP1 (pips)</label><input id="rb31tp1" type="number" step="1" value="100" oninput="rb31Calc()"></div>'
    + '<div><label>TP2 (pips)</label><input id="rb31tp2" type="number" step="1" value="200" oninput="rb31Calc()"></div></div>'
    + '<div class="exp" id="rb31kout" style="color:var(--tx);margin-top:12px">Menghitung…</div>'
    + '<div class="small mut" style="margin-top:8px">Rumus: lot maks = risiko akun ÷ (SL pip × nilai pip per lot). Untuk akun Cent, saldo dalam sen (1/100 USD); untuk IDR dipakai kurs USD/IDR live. Nilai pip tiap broker bisa sedikit berbeda — cocokkan kontrak sebelum order.</div></div>'

    + '<div class="card"><div class="rb-card-head"><h3>📒 Jurnal trade</h3><span class="rb-pill">riwayat tersimpan</span></div><div id="jlist" class="mut">Memuat...</div></div>'

    + '<div class="card"><h3>📝 Catatan news</h3><div class="mut small">Ringkasan NFP/CPI/PPI/FOMC, berita pasar, dan analisis XAUUSD.</div><textarea id="catn" style="margin-top:10px" placeholder="Contoh: NFP lebih kuat, yield naik, XAUUSD SELL..."></textarea><button class="btn alt full" onclick="saveNote(\'news\')">Simpan catatan news</button><div id="notesNews" class="mut small" style="margin-top:10px"></div></div>';
  rb31Calc();
  loadJ();
  loadNotes();
}
async function rb31Calc() {
  const out = $('rb31kout');
  if (!out) return;
  const br = BROKERS[($('rb31br') || {}).value] || BROKERS.exness;
  const cur = ($('rb31cur') || {}).value || 'usd';
  const pair = ($('rb31pair') || {}).value || 'XAUUSD';
  const bal = rb31n(($('rb31bal') || {}).value);
  const rp = rb31n(($('rb31risk') || {}).value);
  const sl = rb31n(($('rb31sl') || {}).value);
  const lotIn = rb31n(($('rb31lot') || {}).value);
  const tp1 = rb31n(($('rb31tp1') || {}).value);
  const tp2 = rb31n(($('rb31tp2') || {}).value);
  if (!(bal > 0) || !(rp > 0) || !(sl > 0)) { out.textContent = 'Isi saldo, risiko, dan stop loss dengan angka lebih dari 0.'; return; }
  const info = RB31_PAIRS[pair] || RB31_PAIRS.XAUUSD;
  let rate = 1, src = '';
  if (cur === 'idr') {
    try { const x = await usdIdr(); rate = x.v; src = x.src; } catch (e) { rate = 16500; src = 'perkiraan'; }
  }
  const pipAcct = cur === 'idr' ? info.usd * rate : cur === 'cent' ? info.usd * 100 : info.usd;
  const riskTarget = bal * rp / 100;
  const raw = riskTarget / (sl * pipAcct);
  const min = br.min || 0.01, step = br.step || 0.01, max = br.max || 100;
  let maxLot = Math.floor(raw / step + 1e-9) * step;
  let note = '';
  if (raw > max) { maxLot = max; note = 'Target risiko melebihi batas maksimum broker; lot dibatasi ' + max + '.'; }
  if (raw < min) { maxLot = min; note = 'Target risiko di bawah lot minimum; lot minimum dipakai sehingga risiko aktual lebih besar.'; }
  const lotUse = Math.max(min, Math.min(lotIn || min, max));
  const snapped = Math.round(lotUse / step) * step;
  const pipPerLot = pipAcct;
  const riskAt = snapped * sl * pipPerLot;
  const pctAt = riskAt / bal * 100;
  const tp1Money = tp1 ? snapped * tp1 * pipPerLot : null;
  const tp2Money = tp2 ? snapped * tp2 * pipPerLot : null;
  const cs = cur === 'usd' ? '$' : cur === 'cent' ? '¢' : 'Rp';
  const fmtv = function (v) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v); };
  const usdEq = function (v) { return cur === 'usd' ? '' : ' (≈ $' + fmtv(cur === 'idr' ? v / rate : v / 100) + ')'; };
  const warn = [];
  if (raw < min) warn.push('Risiko target terlalu kecil untuk lot minimum ' + min + '.');
  if (riskAt / bal > 0.02) warn.push('Risiko aktual ' + pctAt.toFixed(2) + '% melebihi anjuran 2% per trade.');
  if (Math.abs(snapped - (lotIn || min)) > 1e-9) warn.push('Lot disesuaikan ke langkah broker ' + step + ' (menjadi ' + snapped.toFixed(2) + ').');
  if (snapped > max) warn.push('Lot melebihi maksimum broker ' + max + '.');
  if (cur === 'cent') warn.push('Akun Cent: saldo & hasil dalam sen. 1 lot standar = 100 oz; nilai pip 0,1 = 1.000¢ per lot.');
  out.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">'
    + '<div><div class="small mut">Risiko target</div><b>' + cs + fmtv(riskTarget) + '</b>' + usdEq(riskTarget) + '</div>'
    + '<div><div class="small mut">Lot maks untuk risiko itu</div><b>' + Math.max(min, maxLot).toFixed(2) + ' lot</b></div>'
    + '<div><div class="small mut">Nilai pip per lot</div><b>' + cs + fmtv(pipPerLot) + '</b>' + usdEq(pipPerLot) + '</div>'
    + '<div><div class="small mut">Lot yang dipakai</div><b>' + snapped.toFixed(2) + ' lot</b></div>'
    + '<div><div class="small mut">Risiko aktual</div><b style="color:var(--no)">' + cs + fmtv(riskAt) + '</b><div class="small mut">' + pctAt.toFixed(2) + '% saldo</div></div>'
    + '<div><div class="small mut">SL ' + sl + ' pip</div><b>' + cs + fmtv(snapped * sl * pipPerLot) + '</b></div>'
    + (tp1Money != null ? '<div><div class="small mut">Potensi TP1 (' + tp1 + ' pip)</div><b style="color:var(--ok)">' + cs + fmtv(tp1Money) + '</b></div>' : '')
    + (tp2Money != null ? '<div><div class="small mut">Potensi TP2 (' + tp2 + ' pip)</div><b style="color:var(--ok)">' + cs + fmtv(tp2Money) + '</b></div>' : '')
    + '</div>'
    + '<div class="small mut" style="margin-top:10px">' + esc(br.n) + ' · ' + pair + ' · akun ' + cur.toUpperCase() + (cur === 'idr' ? ' · kurs USD/IDR ' + fmtv(rate) + ' (' + esc(src) + ')' : '') + ' · ' + esc(info.note) + ' · min ' + min + ' / langkah ' + step + ' / maks ' + max + ' lot.</div>'
    + (note ? '<div class="warn" style="margin-top:8px">' + esc(note) + '</div>' : '')
    + (warn.length ? '<div class="warn" style="margin-top:8px">' + warn.map(esc).join('<br>') + '</div>' : '');
}

/* =====================================================================
   4. ALCHEMIST — istilah + timeframe, peta timeframe, playbook M5
   ===================================================================== */
function rb31TfOf(t) {
  if (t[4]) return t[4];
  const s = String(t[0] + ' ' + t[2]).toLowerCase();
  if (/storyline|rejection|breakout|sbr|rbs|roadblock|level|fresh|unfresh|band|touch|miss|swing|drawdown|weekly|monthly/.test(s)) return 'MN · W1 · D1';
  if (/killzone|sesi|asia|judas|silver bullet|session/.test(s)) return 'M15 · M5 (jam)';
  if (/risk|lot|pip|leverage|margin|swap|spread|slippage|expectancy|profit factor|r multiple|journal|revenge|confirmation bias|position sizing|partial|break even|time stop|drawdown|backtest/.test(s)) return 'Manajemen (semua TF)';
  return 'H4 · H1 · M15 · M5';
}
function alTermsHtml() {
  const q = rb26Norm(ALCH.term);
  const rows = ALCH_TERMS.filter(function (x) {
    return !q || rb26Norm(x[0] + ' ' + x[1] + ' ' + x[2] + ' ' + x[3] + ' ' + (x[4] || '')).indexOf(q) >= 0;
  });
  return '<input placeholder="Cari istilah (mis. FVG, MSS, OTE, IPDA)..." autocomplete="off" value="' + rb26Safe(ALCH.term) + '" oninput="alTerm(this.value)" style="margin-bottom:10px">'
    + '<div class="rb-note" style="margin-bottom:6px">' + rows.length + ' istilah · setiap istilah memuat arti, cara pakai, dan timeframe pemakaiannya.</div>'
    + '<div class="rb-terms">' + (rows.length ? rows.map(function (x) {
      return '<div class="rb-term"><span class="rb-term-abbr">' + rb26Safe(x[1]) + '</span><b>' + rb26Safe(x[0]) + '</b>'
        + '<p>' + rb26Safe(x[2]) + '</p><div class="rb-term-use"><b>Dipakai:</b> ' + rb26Safe(x[3]) + '</div>'
        + '<div class="rb-term-use" style="color:var(--accent)"><b>Timeframe:</b> ' + rb26Safe(rb31TfOf(x)) + '</div></div>';
    }).join('') : '<div class="rb-muted-box">Istilah tidak ditemukan.</div>') + '</div>';
}
function alTfMapHtml() {
  const rows = [
    ['MN / W1', 'Arah besar & dealing range makro', 'Storyline, level MSNR, premium/discount makro, external liquidity', 'Layak buy atau sell sepanjang bulan?'],
    ['D1', 'Bias harian & range acuan', 'Storyline D1, OCL harian, CRT (high/low D1), roadblock, SMT', 'Hari ini cerita pasar ke mana?'],
    ['H4 / H1', 'Peta POI & level eksekusi', 'Order block, FVG, breaker, mitigation, QM/QML, dealing range', 'Di harga berapa saya mau masuk?'],
    ['M15', 'Struktur & pemicu', 'MSS/BOS, sweep likuiditas, displacement, FVG/OB M15, range Asia', 'Apakah struktur sudah berubah?'],
    ['M5', 'Konfirmasi entry (utama)', 'MSS + FVG 50%, OB retest, turtle soup, OTE 62–79%, silver bullet', 'Apakah entry saya sudah terkonfirmasi?'],
    ['M1', 'Eksekusi presisi', 'Timing limit/market, spread, slippage, partial', 'Kapan tepatnya menekan tombol?']
  ];
  return alCard(' Peta timeframe — istilah dipakai di TF mana',
    '<div class="rb-note">Alchemist selalu top-down. Arah dari TF besar, level dari TF menengah, pemicu &amp; konfirmasi dari TF kecil. Memakai istilah di TF yang salah adalah penyebab utama entry palsu.</div>'
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>TF</th><th>Fungsi</th><th>Istilah yang dipakai</th><th>Pertanyaan yang dijawab</th></tr></thead><tbody>'
    + rows.map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('')
    + '</tbody></table></div>'
    + '<div class="rb-callout"><b>Aturan tiga layar:</b> D1/H4 menentukan arah → H1/M15 menentukan zona → M5 memicu entry. Jangan pernah membalik urutannya.</div>'
    + '<div class="rb-callout warn"><b>Salah TF = salah kesimpulan:</b> FVG M1 bukan POI institusional; sweep M1 bukan sapuan likuiditas harian. Gunakan M5 hanya untuk konfirmasi, bukan untuk menentukan storyline.</div>'
    + '<div class="rb-card-head" style="margin-top:6px"><h3 style="font-size:.94rem">Lanjut ke playbook</h3><button class="x" onclick="alSet(\'m5\')">Konfirmasi M5 ›</button></div>');
}
function alM5Html() {
  return alCard(' Konfirmasi M5 — model Alchemist paling banyak dipakai trader profesional',
    '<div class="rb-note">Model ini adalah gabungan yang paling sering dipakai desk &amp; trader retail profesional: <b>sapuan likuiditas → Market Structure Shift (MSS/CHoCH) → displacement → entry di FVG 50% atau order block</b>. Semua sinyal di tab  Signal Entry memakai urutan ini, dengan SL/TP berjenjang.</div>'
    + '<div class="rb-flow" style="margin-top:10px">'
    + '<div class="rb-step"><b>1. Tandai level H4/H1</b>Tentukan dealing range dan POI: order block, FVG, breaker, OCL. Tandai high/low yang menyimpan stop (equal high/low, range Asia).</div>'
    + '<div class="rb-step"><b>2. Tunggu sapuan likuiditas</b>Harga menyapu high/low tersebut lalu <b>close kembali</b> ke dalam range. Sapuan tanpa close balik bukan sweep, itu breakout.</div>'
    + '<div class="rb-step"><b>3. Konfirmasi MSS di M5</b>Setelah sapuan, M5 harus mencetak MSS/CHoCH: higher high + higher low (bullish) atau lower high + lower low (bearish). Ini bukti struktur berubah, bukan tebakan.</div>'
    + '<div class="rb-step"><b>4. Wajib ada displacement</b>Candle impuls dengan body jauh di atas ATR M5 yang meninggalkan FVG. Tanpa displacement, MSS hanya koreksi biasa.</div>'
    + '<div class="rb-step"><b>5. Entry di POI, bukan di titik sapuan</b>Limit di <b>50% FVG</b>, tepi order block, atau <b>OTE 62–79%</b> dari leg impuls. Entry di titik sapuan = stop terlalu jauh dan RR buruk.</div>'
    + '<div class="rb-step"><b>6. Stop di luar struktur</b>Di luar swing pelindung / ekstrem sapuan + buffer ATR. Mesin membatasi SL <b>minimal 30 pip</b> agar tidak terkena noise.</div>'
    + '<div class="rb-step"><b>7. TP berjenjang</b>TP1 <b>minimal 100 pip</b> (amankan sebagian), TP2 <b>minimal 200 pip</b>, TPmax mengikuti target struktur: sisi berlawanan range, high/low 20 hari, atau range Asia.</div>'
    + '<div class="rb-step"><b>8. Kelola, jangan pindahkan stop</b>Setelah TP1: stop ke break-even, biarkan sisa berjalan ke TP2/TPmax. Sinyal dianggap selesai hanya saat SL/TP kena.</div>'
    + '</div>'
    + '<div class="rb-callout ok"><b>Checklist cepat M5:</b> sweep ✅ · close balik ke range ✅ · MSS ✅ · displacement + FVG ✅ · entry di 50% FVG/OB ✅ · SL di luar struktur ✅ · RR ke TP1 ≥ 3 ✅</div>'
    + '<div class="rb-callout warn"><b>Jangan entry bila:</b> MSS tanpa displacement, FVG sudah terisi, harga sudah jauh dari POI, ada rilis High impact ≤30 menit, atau arah D1/H4 melawan setup.</div>'
    + '<div class="rb-card-head" style="margin-top:8px"><h3 style="font-size:.94rem">Sumber &amp; referensi</h3></div>'
    + '<div class="rb-src">'
    + '<a href="https://www.tradingview.com/script/ANCSINu0-Wonra-Alchemist-SNR-Engine" target="_blank" rel="noopener noreferrer">Wonra Alchemist SNR Engine — aturan MSNR, storyline, OCL, SBR/RBS, QM (TradingView)</a>'
    + '<a href="https://glasp.co/youtube/dPlIsJ-YYKU" target="_blank" rel="noopener noreferrer">Komepips — Alchemist (MSNR) step by step: D1 → H4 → M30/H1, FVG, CRT</a>'
    + '<a href="https://www.tradingview.com/scripts/smartmoneyconcepts/" target="_blank" rel="noopener noreferrer">Smart Money Concepts — order block, FVG, BOS/MSS, liquidity (TradingView)</a>'
    + '<a href="https://www.babypips.com/learn/forex/what-is-forex-trading" target="_blank" rel="noopener noreferrer">BabyPips — dasar forex, sesi, dan manajemen risiko</a>'
    + '<a href="https://www.cmegroup.com/markets/metals/precious/gold.contractSpecs.html" target="_blank" rel="noopener noreferrer">CME Group — spesifikasi kontrak emas (100 oz per lot)</a>'
    + '</div>'
    + '<div class="rb-note" style="margin-top:8px">Model ini edukasi. Tidak ada model yang selalu benar: yang membuat konsisten adalah aturan risiko, bukan keyakinan arah.</div>');
}
