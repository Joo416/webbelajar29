/* =====================================================================
   RUANG BELAJAR — News Analisis & Signal Entry (ditulis ulang dari nol).
   News  : 4 rilis inti (NFP/CPI/PPI/FOMC) + rilis bersamaan; hasil BUY/SELL
           + spike dari data; dokumen AI; YouTube & media AS.
   Signal: teknikal Alchemist lengkap, harga TradingView real-time, tanda
           chart (BOS/CHoCH/SWEEP/FVG/OB/SNR/OTE/PDH/PDL) + catatan AI.
   ===================================================================== */
(function () {
  'use strict';
  const XE = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const X$ = (id) => document.getElementById(id);
  const num = (v) => (v == null || !isFinite(Number(v)) ? '—' : Number(v).toFixed(2));
  const when = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const pips = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v);
  const FOCUS = [
    { k: 'NFP', t: 'NFP', s: 'tenaga kerja' },
    { k: 'CPI', t: 'CPI', s: 'inflasi' },
    { k: 'PPI', t: 'PPI', s: 'harga produsen' },
    { k: 'FOMC', t: 'FOMC', s: 'suku bunga' }
  ];
  const NEWS_KEY = 'rb_xau_news_v3_';
  let newsFocus = 'NFP', newsData = null, newsBusy = false, newsClock = null, newsAutoT3 = false;
  const NEWS_REFRESH_MS = 15 * 60000;
  const SIG_REFRESH_MS = 20 * 60000;
  let newsTimer = null, newsAt = 0, newsCd = null;
  let sigData = null, sigBusy = false, sigTimer = null, sigRO = null, sigAt = 0, sigMode = 'DAY', sigChartBars = 100;
  let chartLabelAll = false;
  try { chartLabelAll = localStorage.getItem('rb_xau_chart_labels') === 'all'; } catch (e) { }
  let sigCd = null;
  const SIG_MODES = [['SCALPING', 'Scalping M5'], ['DAY', 'Day M5'], ['SWING', 'Swing M5']];
  const SIG_HIST_KEY = 'rb_xau_sig_hist_v2';
  const SIG_CACHE_KEY = 'rb_xau_signal_v2';
  const SIG_MODE_KEY = 'rb_xau_sig_mode_v2';
  function sigCacheLoad() {
    try {
      const c = JSON.parse(localStorage.getItem(SIG_CACHE_KEY) || 'null');
      if (!c || !c.data || c.data.ok === false || c.data.error) return null;
      return c;
    } catch (e) { return null; }
  }
  function sigCacheSave(j) {
    try {
      const at = Date.parse(j.generatedAt) || Date.now();
      localStorage.setItem(SIG_CACHE_KEY, JSON.stringify({ at, savedAt: Date.now(), data: j }));
    } catch (e) { }
  }
  (function restoreSignalState() {
    const c = sigCacheLoad();
    if (c) { sigData = c.data; sigAt = Number(c.at) || Date.parse(c.data.generatedAt) || 0; }
    try {
      const m = localStorage.getItem(SIG_MODE_KEY);
      if (SIG_MODES.some(x => x[0] === m)) sigMode = m;
    } catch (e) { }
  })();

  /* Riwayat signal disimpan di perangkat. Setiap sinyal SIAP dicatat saat
     terbentuk, lalu SL/TP dievaluasi dari candle M5 TradingView setelahnya.
     Tidak ada hasil yang dikarang: jika belum tersentuh, statusnya AKTIF. */
  function histLoad() { try { const a = JSON.parse(localStorage.getItem(SIG_HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function histSave(a) { try { localStorage.setItem(SIG_HIST_KEY, JSON.stringify(a.slice(0, 60))); } catch (e) { } }
  function histUid() { try { return (typeof user !== 'undefined' && user && user.uid) ? user.uid : null; } catch (e) { return null; } }
  function histDocId(h) { return histUid() + '_sig_' + String(h.key || '').replace(/[\/]/g, '_').slice(0, 900); }
  /* State news/signal disimpan per akun di koleksi jurnal yang sudah diizinkan
     aturan Firestore. Dokumen state memakai jenis khusus agar tidak ikut query
     riwayat signal. Karena memakai doc ID tetap, tidak perlu index komposit. */
  function stateRef(kind, key) {
    const uid = histUid();
    if (!uid || typeof db === 'undefined' || !db) return null;
    const id = uid + '_state_' + kind + (key ? '_' + String(key).replace(/[^A-Za-z0-9_-]/g, '') : '');
    return db.collection('jurnal').doc(id);
  }
  async function stateGet(kind, key) {
    const ref = stateRef(kind, key);
    if (!ref) return null;
    try {
      const snap = await ref.get();
      if (!snap || !snap.exists) return null;
      const d = snap.data() || {};
      if (d.jenis !== 'xau_' + kind + '_state' || !d.data) return null;
      return d;
    } catch (e) { return null; }
  }
  async function statePut(kind, key, data) {
    const ref = stateRef(kind, key);
    if (!ref || !data || !data.generatedAt) return false;
    try {
      await ref.set({ uid: histUid(), jenis: 'xau_' + kind + '_state', at: Date.parse(data.generatedAt) || Date.now(), data, updatedAt: Date.now() }, { merge: true });
      return true;
    } catch (e) { return false; }
  }
  function histClean(h) {
    const out = { ...h, uid: histUid(), jenis: 'signal_history', updatedAt: h.updatedAt || Date.now() };
    delete out._sync;
    Object.keys(out).forEach(k => { if (out[k] === undefined) delete out[k]; });
    return out;
  }
  let histSyncState = 'lokal', histLastSyncAt = 0;
  function histSyncLabel() {
    if (histSyncState === 'akun') return 'tersinkron akun';
    if (histSyncState === 'proses') return 'menyinkronkan…';
    return 'cache lokal';
  }
  async function histPush(h) {
    try {
      if (!h || !histUid() || typeof db === 'undefined' || !db) { histSyncState = 'lokal'; return; }
      /* Memakai koleksi jurnal yang sudah diizinkan aturan Firestore untuk
         pengguna trading. Dokumen diberi jenis khusus agar tidak tampil sebagai
         trade manual di tab Jurnal. */
      histSyncState = 'proses';
      await db.collection('jurnal').doc(histDocId(h)).set(histClean(h), { merge: true });
      histSyncState = 'akun'; histLastSyncAt = Date.now();
      setTimeout(histRender, 250);
    } catch (e) {
      /* offline / permission / rules: jangan mengklaim tersinkron */
      histSyncState = 'lokal';
      setTimeout(histRender, 250);
    }
  }
  let histPulledAt = 0, histPullPromise = null;
  let histRemoteAt = new Map(), histRemoteLoaded = false;
  /* Record yang baru menang dari Firestore. Evaluasi lokal dilewati sekali
     pada siklus ini agar status TP/SL dari perangkat lain tidak turun lagi. */
  let histRemoteNew = new Map();
  async function histPull() {
    if (histPullPromise) return histPullPromise;
    const uid = histUid();
    if (!uid || typeof db === 'undefined' || !db) { histSyncState = 'lokal'; return; }
    if (Date.now() - histPulledAt < 30000) return;
    histPullPromise = (async function () {
      try {
        histSyncState = 'proses'; histRender();
        const snap = await db.collection('jurnal').where('uid', '==', uid).limit(300).get();
        const remote = new Map();
        snap.forEach(doc => {
          const d = doc.data() || {};
          if (d.jenis !== 'signal_history' || !d.key || !d.createdAt) return;
          const h = { ...d };
          delete h.uid; delete h.updatedAt;
          h.updatedAt = Number(d.updatedAt) || 0;
          remote.set(h.key, h);
        });
        const before = new Map(histLoad().map(h => [h.key, h]));
        const local = new Map(before);
        const remoteNew = new Map();
        let changed = false;
        remote.forEach((h, key) => {
          const l = before.get(key);
          const rAt = Number(h.updatedAt) || 0, lAt = Number(l && l.updatedAt) || 0;
          if (!l || rAt > lAt || (rAt === lAt && histRank(h.status) > histRank(l.status))) {
            local.set(key, h); changed = true;
            remoteNew.set(key, rAt);
          }
        });
        const arr = [...local.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 60);
        if (changed) histSave(arr);
        histRemoteAt = new Map([...remote].map(([key, h]) => [key, Number(h.updatedAt) || 0]));
        histRemoteLoaded = true;
        histRemoteNew = remoteNew;
        histSyncState = 'akun'; histLastSyncAt = Date.now();
        histRender();
      } catch (e) {
        /* biarkan cache lokal dan jangan klaim tersinkron; jangan dorong
           data lokal lama sebelum sempat membandingkan dengan Firestore. */
        histRemoteLoaded = false;
        if (histSyncState !== 'akun') histSyncState = 'lokal';
        histRender();
      } finally {
        histPulledAt = Date.now(); histPullPromise = null;
      }
    })();
    return histPullPromise;
  }
  function histPushLocal() {
    if (!histRemoteLoaded || !histUid() || typeof db === 'undefined' || !db) return;
    histLoad().forEach(h => {
      const rAt = Number(histRemoteAt.get(h.key)) || 0;
      if (!rAt || (Number(h.updatedAt) || 0) > rAt + 1000) histPush(h);
    });
  }
  function histRender() {
    const el = X$('sigHist');
    if (!el) return;
    const box = document.createElement('div');
    box.innerHTML = histCard();
    if (box.firstElementChild) el.replaceWith(box.firstElementChild);
  }
  function histKey(s, j) { const day = String(j.generatedAt || new Date().toISOString()).slice(0, 10); return [day, s.style, s.dir, Math.round(s.entry / 0.1), Math.round(s.sl / 0.1)].join('|'); }
  function cacheAt(j) { return j && j.generatedAt ? (Date.parse(j.generatedAt) || 0) : 0; }
  async function sigStatePull() {
    const d = await stateGet('signal');
    if (!d || !d.data || d.data.ok === false || d.data.error) return false;
    const rAt = cacheAt(d.data) || Number(d.at) || 0;
    if (!rAt) return false;
    if (rAt > (sigAt || 0) + 1500) {
      sigData = d.data; sigAt = rAt; sigCacheSave(d.data);
      return true;
    }
    if (sigData && sigAt > rAt + 1500) statePut('signal', null, sigData).catch(() => { });
    return false;
  }
  async function newsStatePull(focus) {
    const d = await stateGet('news', focus);
    if (!d || !d.data || d.data.ok !== true) return null;
    const rAt = cacheAt(d.data) || Number(d.at) || 0;
    const local = loadCache(focus), lAt = cacheAt(local);
    if (rAt > lAt + 1500) {
      saveCache(focus, d.data);
      return { data: d.data, at: rAt };
    }
    if (local && lAt > rAt + 1500) statePut('news', focus, local).catch(() => { });
    return null;
  }
  function histRank(status) { return status === 'TPMAX' ? 3 : status === 'TP2' ? 2 : status === 'TP1' ? 1 : 0; }
  function histRecord(j) {
    const arr = histLoad();
    const fresh = [];
    (j.setups || []).forEach(s => {
      if (s.status !== 'SIAP') return;
      const key = histKey(s, j);
      if (arr.some(h => h.key === key)) return;
      const rec = {
        key, style: s.style, dir: s.dir, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2, tpMax: s.tpMax,
        poi: s.poi || s.poiTf, why: s.why, invalidation: s.invalidation,
        createdAt: j.generatedAt || new Date().toISOString(), createdPrice: j.price,
        status: 'AKTIF', entryHit: s.type === 'MARKET', hitAt: s.type === 'MARKET' ? (j.generatedAt || new Date().toISOString()) : null,
        tp1Hit: false, tp2Hit: false, maxHit: false, closedAt: null, pips: null, updatedAt: Date.now(),
        reason: s.type === 'MARKET' ? 'Entry market saat sinyal SIAP terbentuk.' : 'Menunggu harga menyentuh entry ' + s.entry + '.'
      };
      arr.unshift(rec);
      fresh.push(rec);
    });
    histSave(arr);
    return arr;
  }
  function histUpdate(j) {
    const arr = histRecord(j);
    const before = new Map(arr.map(h => [h.key, JSON.stringify(h)]));
    /* Riwayat hanya dievaluasi dari candle M5. Jangan memakai M15 sebagai
       pengganti karena SL/TP entry M5 bisa terbaca salah. */
    const rows = ((j.chart && j.chart.m5) || []).slice().sort((a, b) => a.t - b.t);
    const chartAt = Date.parse(j.generatedAt) || Date.now();
    let changed = false;
    arr.forEach(h => {
      /* Hasil dari perangkat lain hanya boleh dievaluasi ulang jika candle
         yang dipakai benar-benar lebih baru dari status remote tersebut. */
      const remoteAt = Number(histRemoteAt.get(h.key)) || 0;
      if (histRemoteNew.has(h.key)) return;
      if (remoteAt && remoteAt > chartAt) return;
      if (h.status === 'SL' || h.status === 'TPMAX' || h.closedAt) return;
      const start = Date.parse(h.createdAt) || 0;
      const after = rows.filter(r => r.t >= start - 60000);
      if (!after.length) return;
      if (!h.entryHit) {
        const touch = after.find(r => h.dir === 'BUY' ? r.l <= h.entry + 0.02 : r.h >= h.entry - 0.02);
        if (!touch) return;
        h.entryHit = true; h.hitAt = new Date(touch.t).toISOString(); changed = true;
      }
      const trig = Date.parse(h.hitAt) || start;
      for (const r of after) {
        if (r.t < trig) continue;
        const at = new Date(r.t).toISOString();
        if (h.dir === 'BUY') {
          if (!h.tp2Hit && h.status !== 'TP2' && h.tp1Hit && h.tp1At && r.t >= Date.parse(h.tp1At) && r.l <= h.entry) { h.status = 'TP1'; h.closedAt = at; h.pips = Math.round((h.tp1 - h.entry) / 0.1); h.reason = 'TP1 ' + h.tp1 + ' tercapai, lalu harga kembali ke entry ' + h.entry + '. Hasil dikunci TP1 (' + h.pips + ' pip); sisa posisi tidak dilanjutkan.'; changed = true; break; }
          if (histRank(h.status) === 0 && !h.tp1Hit && r.l <= h.sl) { h.status = 'SL'; h.closedAt = at; h.pips = -Math.round((h.entry - h.sl) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' low ' + Number(r.l).toFixed(2) + ' menembus SL ' + h.sl + '. Entry ' + h.entry + ' gagal; SL 30 pip.'; changed = true; break; }
          if (histRank(h.status) === 0 && !h.tp1Hit && r.h >= h.tp1) { h.tp1Hit = true; h.tp1At = at; h.status = 'TP1'; h.pips = Math.round((h.tp1 - h.entry) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' high ' + Number(r.h).toFixed(2) + ' mencapai TP1 ' + h.tp1 + ' (' + h.pips + ' pip). Sisa posisi dipantau ke TP2/TPmax.'; changed = true; }
          if (h.tp1Hit && h.tp1At && r.t >= Date.parse(h.tp1At) && !h.tp2Hit && h.tp2 !== h.tp1 && r.h >= h.tp2) { h.tp2Hit = true; h.tp2At = at; h.status = 'TP2'; h.pips = Math.round((h.tp2 - h.entry) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' high ' + Number(r.h).toFixed(2) + ' mencapai TP2 ' + h.tp2 + ' (' + h.pips + ' pip). Sisa posisi dipantau ke TPmax.'; changed = true; }
          if (h.tp2Hit && h.tp2At && r.t >= Date.parse(h.tp2At) && h.tpMax !== h.tp2 && r.h >= h.tpMax) { h.maxHit = true; h.status = 'TPMAX'; h.closedAt = at; h.pips = Math.round((h.tpMax - h.entry) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' high ' + Number(r.h).toFixed(2) + ' mencapai TPmax ' + h.tpMax + ' (' + Math.round((h.tpMax - h.entry) / 0.1) + ' pip).'; changed = true; break; }
        } else {
          if (!h.tp2Hit && h.status !== 'TP2' && h.tp1Hit && h.tp1At && r.t >= Date.parse(h.tp1At) && r.h >= h.entry) { h.status = 'TP1'; h.closedAt = at; h.pips = Math.round((h.entry - h.tp1) / 0.1); h.reason = 'TP1 ' + h.tp1 + ' tercapai, lalu harga kembali ke entry ' + h.entry + '. Hasil dikunci TP1 (' + h.pips + ' pip); sisa posisi tidak dilanjutkan.'; changed = true; break; }
          if (histRank(h.status) === 0 && !h.tp1Hit && r.h >= h.sl) { h.status = 'SL'; h.closedAt = at; h.pips = -Math.round((h.sl - h.entry) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' high ' + Number(r.h).toFixed(2) + ' menembus SL ' + h.sl + '. Entry ' + h.entry + ' gagal; SL 30 pip.'; changed = true; break; }
          if (histRank(h.status) === 0 && !h.tp1Hit && r.l <= h.tp1) { h.tp1Hit = true; h.tp1At = at; h.status = 'TP1'; h.pips = Math.round((h.entry - h.tp1) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' low ' + Number(r.l).toFixed(2) + ' mencapai TP1 ' + h.tp1 + ' (' + h.pips + ' pip). Sisa posisi dipantau ke TP2/TPmax.'; changed = true; }
          if (h.tp1Hit && h.tp1At && r.t >= Date.parse(h.tp1At) && !h.tp2Hit && h.tp2 !== h.tp1 && r.l <= h.tp2) { h.tp2Hit = true; h.tp2At = at; h.status = 'TP2'; h.pips = Math.round((h.entry - h.tp2) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' low ' + Number(r.l).toFixed(2) + ' mencapai TP2 ' + h.tp2 + ' (' + h.pips + ' pip). Sisa posisi dipantau ke TPmax.'; changed = true; }
          if (h.tp2Hit && h.tp2At && r.t >= Date.parse(h.tp2At) && h.tpMax !== h.tp2 && r.l <= h.tpMax) { h.maxHit = true; h.status = 'TPMAX'; h.closedAt = at; h.pips = Math.round((h.entry - h.tpMax) / 0.1); h.reason = 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + ' low ' + Number(r.l).toFixed(2) + ' mencapai TPmax ' + h.tpMax + ' (' + Math.round((h.entry - h.tpMax) / 0.1) + ' pip).'; changed = true; break; }
        }
      }
      if (h.entryHit && !h.closedAt && !h.tp1Hit) { h.reason = 'Entry tersentuh ' + (h.hitAt ? new Date(h.hitAt).toLocaleString('id-ID') : '') + '; harga belum mencapai SL ' + h.sl + ' atau TP1 ' + h.tp1 + '.'; changed = true; }
    });
    if (changed) {
      const stamp = Date.now();
      arr.forEach(h => { if (JSON.stringify(h) !== before.get(h.key)) h.updatedAt = stamp; });
      histSave(arr);
    }
    return arr;
  }
  function histCard() {
    const arr = histLoad();
    const open = arr.filter(h => h.status === 'AKTIF' || h.status === 'TP1' || h.status === 'TP2').length;
    const sync = histSyncLabel();
    return `<div class="card" id="sigHist"><div class="rb-card-head"><h3>🗂️ Riwayat Signal Entry</h3><span class="rb-pill ${histSyncState === 'akun' ? 'y' : ''}">${arr.length} tercatat · ${open} aktif · ${XE(sync)}</span></div>
      <div class="small mut">Sinyal dicatat saat berstatus SIAP. SL/TP dievaluasi dari candle M5 TradingView sesudah waktu sinyal; SL didahulukan bila satu candle menyentuh SL dan TP. ${histSyncState === 'akun' ? 'Tersinkron ke akun' + (histLastSyncAt ? ' · terakhir ' + new Date(histLastSyncAt).toLocaleTimeString('id-ID') : '') + '. Dicek ulang tiap refresh 20 menit.' : histSyncState === 'proses' ? 'Menyinkronkan riwayat ke akun…' : 'State disimpan per akun (cache browser + Firestore); perangkat lain memakai timestamp server yang sama dan timer 20 menit yang sama.'}</div>
      ${arr.length ? `<div style="overflow:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;color:var(--mut)"><th>Waktu</th><th>Mode</th><th>Arah</th><th>Entry / SL</th><th>TP</th><th>Hasil</th><th>Pip</th></tr></thead><tbody>${arr.slice(0, 30).map(h => `<tr style="border-top:1px solid var(--line);vertical-align:top"><td style="padding:6px 4px;white-space:nowrap">${new Date(h.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${XE(h.style)}</td><td style="color:${h.dir === 'BUY' ? 'var(--ok)' : 'var(--no)'};font-weight:700">${XE(h.dir)}</td><td>${num(h.entry)} / <span style="color:var(--no)">${num(h.sl)}</span></td><td>${num(h.tp1)} / ${num(h.tpMax)}</td><td style="color:${h.status === 'SL' ? 'var(--no)' : h.status === 'AKTIF' ? 'var(--warn)' : 'var(--ok)'};font-weight:700">${XE(h.status)}</td><td>${h.pips == null ? '—' : pips(h.pips)}</td></tr><tr><td colspan="7" class="small mut" style="padding:0 4px 7px">${XE(h.reason || '')}${h.poi ? ' · POI ' + XE(h.poi) : ''}<br>Alasan awal: ${XE(h.why || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="warn" style="margin-top:8px">Belum ada sinyal SIAP yang tercatat. Riwayat terisi otomatis saat mesin menemukan entry valid, bukan dari sinyal yang dikarang.</div>'}
    </div>`;
  }

  function toast(m) { if (typeof v21Toast === 'function') v21Toast(m); }
  function loadCache(k) { try { return JSON.parse(localStorage.getItem(NEWS_KEY + k) || 'null'); } catch (e) { return null; } }
  function saveCache(k, v) { try { localStorage.setItem(NEWS_KEY + k, JSON.stringify(v)); } catch (e) { } }
  function focusNow() { try { const v = localStorage.getItem('rb_xau_focus_v2'); return FOCUS.some(f => f.k === v) ? v : 'NFP'; } catch (e) { return 'NFP'; } }

  function startNewsClock(iso) {
    if (newsClock) { clearInterval(newsClock); newsClock = null; }
    if (!iso) return;
    const ts = Date.parse(iso);
    if (!isFinite(ts)) return;
    const tick = function () {
      const el = X$('xCd');
      if (!el) { clearInterval(newsClock); newsClock = null; return; }
      const d = ts - Date.now();
      if (d <= 0) { el.textContent = 'Rilis sudah dimulai'; return; }
      const m = Math.floor(d / 60000), s = Math.floor((d % 60000) / 1000);
      el.textContent = d >= 86400000
        ? 'Hitung mundur: ' + Math.floor(d / 86400000) + ' hari ' + Math.floor((d % 86400000) / 3600000) + ' jam'
        : 'Hitung mundur: ' + m + ' menit ' + String(s).padStart(2, '0') + ' detik';
      /* Sekali saja: ambil analisis saat tersisa ~3,5 menit agar hasil panel
         sudah siap 2-3 menit sebelum rilis. */
      if (!newsAutoT3 && d <= 210000 && !newsBusy) {
        newsAutoT3 = true;
        window.pXauRun();
      }
    };
    tick();
    newsClock = setInterval(tick, 1000);
  }

  /* ---------------- NEWS ---------------- */
  window.pXauNews = function () {
    if (newsClock) { clearInterval(newsClock); newsClock = null; }
    if (newsTimer) { clearInterval(newsTimer); newsTimer = null; }
    if (newsCd) { clearInterval(newsCd); newsCd = null; }
    const focus = newsFocus = focusNow();
    newsData = loadCache(focus);
    newsAt = cacheAt(newsData);
    X$('pane').innerHTML = `
      <div class="card">
        <div class="rb-card-head"><h3>📰 News Analisis XAUUSD</h3><span class="rb-pill">4 rilis inti + rilis bersamaan</span></div>
        <div class="rb-note">Pilih satu rilis. <b>Panel beberapa AI independen</b> hanya membaca rilis itu — tanpa bercampur rilis lain — memakai data TradingView, FRED/BLS/BEA/Treasury, kalender ekonomi, media finansial global, dan YouTube. Arah <b>BUY/SELL</b>, status <b>spike</b>, dan prakiraan <b>T-3 menit</b> dihitung dari data; AI menjelaskan mengapa data itu valid dan di mana keterbatasannya. Data diperbarui otomatis, tidak perlu klik tombol.</div>
        <div class="rb-pill-row" id="xTabRow" style="margin-top:10px">${FOCUS.map(f => `<button class="rb-pill${f.k === newsFocus ? ' y' : ''}" data-k="${f.k}" onclick="pXauFocus('${f.k}')">${f.t} · ${f.s}</button>`).join('')}</div>
        <div id="xNewsMsg" class="mut small" style="margin-top:8px"></div>
        <div id="xNewsNext" class="small" style="margin-top:4px;color:var(--warn)"></div>
      </div>
      <div id="xNewsOut"></div>`;
    const boot = (async function () {
      const m0 = X$('xNewsMsg'); if (m0) m0.textContent = 'Menyinkronkan state akun & data tersimpan…';
      let remote = null;
      try { remote = await newsStatePull(focus); } catch (e) { }
      if (focus !== newsFocus || !X$('xNewsOut')) return;
      if (remote) { newsData = remote.data; newsAt = remote.at; }
      if (newsData) paintNews(newsData, true);
      const tick = function () {
        const el = X$('xNewsNext');
        if (!el) { clearInterval(newsCd); newsCd = null; return; }
        if (newsBusy) { el.textContent = '⏳ Mengumpulkan data terbaru & AI…'; return; }
        const left = Math.max(0, NEWS_REFRESH_MS - (Date.now() - (newsAt || Date.now())));
        const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        el.textContent = 'Refresh otomatis dalam ' + m + ':' + String(s).padStart(2, '0') + ' · tanpa tombol';
      };
      tick();
      newsCd = setInterval(tick, 1000);
      if (!newsData || Date.now() - newsAt > NEWS_REFRESH_MS) window.pXauRun(true);
      const loop = function () {
        const wait = Math.max(1000, NEWS_REFRESH_MS - (Date.now() - (newsAt || Date.now())));
        newsTimer = setTimeout(async function () {
          if (!X$('xNewsOut')) return;
          if (newsBusy) { newsTimer = setTimeout(loop, 5000); return; }
          await window.pXauRun(true);
          loop();
        }, wait);
      };
      loop();
    })();
    boot.catch(function (e) { const m0 = X$('xNewsMsg'); if (m0) m0.textContent = '⚠️ ' + e.message; });
  };
  window.pXauFocus = function (k) {
    newsAutoT3 = false;
    newsFocus = FOCUS.some(f => f.k === k) ? k : 'NFP';
    try { localStorage.setItem('rb_xau_focus_v2', newsFocus); } catch (e) { }
    window.pXauNews();
  };
  window.pXauRun = async function (silent) {
    if (newsBusy) return;
    newsBusy = true;
    const focus = newsFocus;
    const msg = X$('xNewsMsg');
    if (msg) msg.textContent = 'Mengambil kalender, angka resmi FRED/BLS, TradingView, media AS, YouTube, lalu panel AI…';
    try {
      const j = await tcall({ action: 'xau', focus, fresh: true });
      if (focus !== newsFocus || !X$('xNewsOut')) {
        if (j && j.ok && !j.error) saveCache(focus, j);
        newsBusy = false; return;
      }
      if (j && j.ok && !j.error) {
        newsData = j;
        newsAt = Date.parse(j.generatedAt) || Date.now();
        saveCache(focus, j);
        statePut('news', focus, j).catch(() => { });
      }
      if (!j || !j.ok || j.error) newsAt = Date.now();
      paintNews(j, false);
      if (msg) msg.textContent = j.ok ? '✅ Selesai — arah ' + j.direction + ' · spike ' + (j.spike && j.spike.measured ? 'terukur' : j.spike && j.spike.likely ? 'diperkirakan' : 'tidak ada') + ' · ' + new Date().toLocaleTimeString('id-ID') : '⚠️ ' + (j.error || 'gagal');
    } catch (e) {
      if (focus === newsFocus) { newsAt = Date.now(); paintNews({ ok: false, error: e.message }, false); }
      if (msg) msg.textContent = '⚠️ ' + e.message;
    }
    newsBusy = false;
  };

  function timingCard(j) {
    const t = j.timing;
    if (!t) return '';
    const hot = t.preWindow;
    const col = t.dir === 'BUY' ? 'var(--ok)' : 'var(--no)';
    return `<div class="card" style="border-left:5px solid ${hot ? 'var(--warn)' : 'var(--line)'}">
      <div class="rb-card-head"><h3>⏱️ Timing & prakiraan pra-rilis</h3><span class="rb-pill ${hot ? 'y' : ''}">${XE(t.status)}</span></div>
      ${j.event && j.event.when ? `<div class="small" style="font-weight:700;margin-top:6px" id="xCd">Hitung mundur…</div>` : `<div class="small mut" style="margin-top:6px">Tidak ada jadwal rilis mendatang — memakai data terakhir.</div>`}
      <div class="exp" style="color:var(--tx);margin-top:8px"><b>Prakiraan pra-rilis: <span style="color:${col}">${XE(t.dir)}</span></b> · keyakinan ${XE(t.confidence)}% · skor ${XE(t.score)}
        <div class="small mut">${XE(t.caveat)}</div></div>
      ${(t.reasons || []).length ? `<div style="margin-top:8px"><b class="small">Bukti pra-rilis</b>${t.reasons.map(x => `<div class="item"><span>${XE(x.why)}</span><b style="color:${x.w >= 0 ? 'var(--ok)' : 'var(--no)'}">${x.w > 0 ? '+' : ''}${XE(x.w)}</b></div>`).join('')}</div>` : ''}
      ${t.nowcast ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>Nowcast NFP:</b> ${XE(t.nowcast.note)} <span class="small" style="color:${t.nowcast.hot ? 'var(--no)' : 'var(--ok)'}">${t.nowcast.hot ? 'cenderung panas' : 'cenderung dingin'}</span></div>` : ''}
      <div style="margin-top:10px"><b class="small">Playbook 2–3 menit sebelum rilis</b>${(t.playbook || []).map(x => `<div class="small" style="margin-top:4px">• ${XE(x)}</div>`).join('')}</div>
    </div>`;
  }

  function panelCard(j) {
    const p = j.aiPanel;
    if (!p || !p.ok) return `<div class="card"><div class="rb-card-head"><h3>🤖 Panel AI</h3><span class="rb-pill">tidak tersedia</span></div><div class="warn">${XE((p && p.error) || 'Panel AI tidak memberi jawaban valid. Arah mesin tetap dipakai.')}</div></div>`;
    return `<div class="card"><div class="rb-card-head"><h3>🤖 Panel ${XE(p.total)} AI independen</h3><span class="rb-pill y">${p.consensus === 'SPLIT' ? 'terbelah' : 'mayoritas ' + XE(p.consensus)} · ${XE(p.agreement)}%</span></div>
      <div class="small mut">${XE(p.note)} ${p.distinctProviders ? '· ' + p.distinctProviders + ' penyedia berbeda' : ''}${p.avgConfidence != null ? ' · rata-rata keyakinan ' + p.avgConfidence + '%' : ''}</div>
      <div class="rb-pill-row" style="margin-top:8px"><span class="rb-pill" style="color:var(--ok)">BUY ${p.votes.BUY}</span><span class="rb-pill" style="color:var(--no)">SELL ${p.votes.SELL}</span></div>
      ${p.total < 8 ? `<div class="small mut" style="margin-top:4px">${p.total} dari 8 panelis menjawab; sisanya tidak tersedia saat ini. Panel tetap menampilkan suara yang valid.</div>` : ''}
      ${p.items.map(x => `<div class="exp" style="margin-top:8px;color:var(--tx)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${XE(x.id)} · <span style="color:${x.direction === 'BUY' ? 'var(--ok)' : 'var(--no)'}">${XE(x.direction)}</span></b><span class="small mut">${XE(x.model || x.provider)} · ${XE(x.confidence)}%</span></div>
        <div class="small" style="margin-top:3px">${XE(x.focus_read)}</div>
        ${(x.reasons || []).map(r => `<div class="small" style="margin-top:2px">• ${XE(r)}</div>`).join('')}
        ${x.why_valid ? `<div class="small mut" style="margin-top:3px">Validitas: ${XE(x.why_valid)}</div>` : ''}
        ${x.pre_event_plan ? `<div class="small" style="color:var(--warn);margin-top:2px">Rencana: ${XE(x.pre_event_plan)}</div>` : ''}</div>`).join('')}
    </div>`;
  }

  function macroCard(j) {
    const m = j.macroBoard;
    if (!m || !m.items || !m.items.length) return '';
    return `<div class="card"><div class="rb-card-head"><h3>🌐 Papan makro global (FRED)</h3><span class="rb-pill">${m.items.length} seri resmi</span></div>
      ${m.items.map(x => `<div class="item"><span>${XE(x.label)} <span class="small mut">${XE(x.date)} · ${XE(x.source)}</span></span><span><b>${XE(x.value)}${XE(x.unit)}</b> <span class="small" style="color:${x.chg == null ? 'var(--mut)' : x.chg >= 0 ? 'var(--ok)' : 'var(--no)'}">${x.chg == null ? '' : (x.chg > 0 ? '+' : '') + x.chg + XE(x.unit)}</span></span></div>`).join('')}
      <div class="small mut" style="margin-top:6px">${XE(m.note)}</div></div>`;
  }

  function verdictCard(j) {
    const buy = j.direction === 'BUY';
    const col = buy ? 'var(--ok)' : 'var(--no)';
    const sp = j.spike || {};
    return `<div class="card" style="border-left:5px solid ${col}">
      <div class="rb-verdict ${buy ? 'buy' : 'sell'}">
        <div class="rb-verdict-label">Putusan mesin · ${XE(j.name || j.focus)}</div>
        <div class="rb-verdict-main">${XE(j.direction)}</div>
        <div class="rb-verdict-sub">XAUUSD — satu arah, tanpa WAIT</div>
        <div class="rb-verdict-spike${sp.likely ? '' : ' no'}">${sp.measured ? '⚡ Spike terukur' : sp.likely ? '⚡ Spike diperkirakan' : 'Tidak ada spike'}
          ${sp.sizePips ? ' · ' + XE(sp.sizePips.min) + '–' + XE(sp.sizePips.max) + ' pip' : ''}${sp.windowMin ? ' · ±' + XE(sp.windowMin) + ' menit' : ''}${sp.firstDir ? ' · arah pertama ' + XE(sp.firstDir) : ''}</div>
      </div>
      <div class="small mut" style="margin-top:8px">Sumber arah: <b>${XE(j.directionSource || '—')}</b> · skor akhir ${XE(j.score)} · harga ${num(j.price)} (${XE(j.priceSource || '—')})</div>
      ${j.directionSource && /rilis terakhir/i.test(j.directionSource) ? `<div class="small" style="margin-top:4px;color:var(--warn)">Arah utama mengikuti data rilis terakhir yang sudah nyata; skor pasar hanya konfirmasi. Aktual rilis berikutnya belum dipakai.</div>` : ''}
      ${j.aiPanel && j.aiPanel.votes && j.aiPanel.votes.BUY + j.aiPanel.votes.SELL > 0 && (j.aiPanel.votes.BUY > j.aiPanel.votes.SELL ? 'BUY' : 'SELL') !== j.direction ? `<div class="small" style="margin-top:4px;color:var(--warn)">Panel AI mayoritas ${XE(j.aiPanel.votes.BUY > j.aiPanel.votes.SELL ? 'BUY' : 'SELL')}; arah final tetap ${XE(j.direction)} dari data terakhir + konfirmasi pasar. Panel hanya konteks, bukan sinyal kedua.</div>` : ''}
      ${j.reaction ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>📈 Reaksi nyata setelah ${XE(j.reaction.tag)} terbit:</b> <b>${pips(j.reaction.netPips)} pip → ${XE(j.reaction.dir)}</b><div class="small mut">${XE(j.reaction.agoMin)} menit lalu · anchor ${num(j.reaction.anchor)} → ${num(j.reaction.last)} · rentang ${XE(j.reaction.rangePips)} pip (${XE(j.reaction.bar)})</div></div>` : ''}</div>`;
  }

  function eventCard(j) {
    const e = j.event || {};
    const released = e.released;
    const lr = e.lastRelease;
    let lrDir = '';
    if (lr && lr.actual != null && lr.actual !== '' && lr.forecast != null && lr.forecast !== '') {
      const a = Number(String(lr.actual).replace(/[^0-9.-]/g, ''));
      const f = Number(String(lr.forecast).replace(/[^0-9.-]/g, ''));
      lrDir = !isFinite(a) || !isFinite(f) ? '' : a > f ? 'lebih panas → tekanan turun emas' : a < f ? 'lebih dingin → dukungan naik emas' : 'sesuai konsensus → netral';
    }
    return `<div class="card"><div class="rb-card-head"><h3>📌 Rilis fokus: ${XE(e.tag || j.focus)}</h3><span class="rb-pill ${e.verified === 'kalender' ? '' : 'y'}">${e.derived ? 'data terakhir FRED' : e.verified === 'kalender' ? 'jadwal kalender' : 'jadwal resmi'}</span></div>
      <div class="rb-release-title" style="font-weight:700">${XE(e.title || '')}</div>
      <div class="rb-release-meta">
        <div><span>Jadwal (WIB)</span><b>${e.when ? XE(when(e.when)) : XE(e.whenLabel || '—')}</b></div>
        <div><span>Konsensus</span><b>${XE(e.forecast || 'tidak tersedia')}${e.unit ? ' ' + XE(e.unit) : ''}</b></div>
        <div><span>Previous</span><b>${XE(e.previous || '—')}</b></div>
      </div>
      <div class="small" style="margin-top:7px">${e.actualOfficial != null ? `✅ Angka resmi: <b>${XE(e.actualOfficial)}</b> <span class="mut">· ${XE(e.actualSource || 'FRED')} · periode ${XE(e.officialPeriod || '—')}</span>` : released && e.actual ? `Aktual kalender: <b>${XE(e.actual)}</b>${e.period ? ' · periode ' + XE(e.period) : ''}` : '<span class="mut">Belum ada angka aktual resmi untuk rilis ini.</span>'}</div>
      ${e.actualPending ? `<div class="warn" style="margin-top:8px">Angka aktual rilis ini belum keluar. Arah di bawah adalah prakiraan pra-rilis dari data terakhir + pasar, bukan hasil rilis.</div>` : ''}
      ${e.lastRelease ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>📊 Data rilis terakhir</b> <span class="small mut">${e.lastRelease.when ? when(e.lastRelease.when) : ''}${e.lastRelease.source ? ' · ' + XE(e.lastRelease.source) : ''}</span>
        <div class="small" style="margin-top:3px">Aktual <b>${XE(e.lastRelease.actual || '—')}</b>${e.lastRelease.unit ? ' ' + XE(e.lastRelease.unit) : ''} · konsensus ${XE(e.lastRelease.forecast || '—')} · sebelumnya ${XE(e.lastRelease.previous || '—')}</div>
        ${lrDir ? `<div class="small mut">Arah data terakhir: ${lrDir} (bukan aktual rilis berikutnya).</div>` : ''}
      </div>` : ''}
      ${e.nextRelease ? `<div class="small" style="margin-top:6px;color:var(--warn)">📅 Rilis berikutnya: ${e.nextRelease.when ? when(e.nextRelease.when) : 'jadwal belum tersedia'} · konsensus ${XE(e.nextRelease.forecast || '—')}</div>` : ''}
      ${j.surprise ? `<div class="small" style="margin-top:4px">Kejutan: aktual <b>${XE(j.surprise.actual)}</b> vs konsensus <b>${XE(j.surprise.forecast)}</b> → <b style="color:${j.surprise.hot ? 'var(--no)' : 'var(--ok)'}">${j.surprise.hot ? 'lebih panas/kuat' : 'lebih dingin/lemah'}</b></div>` : ''}
    </div>`;
  }

  function releaseCompareCard(j) {
    const e = j.event || {}, lr = e.lastRelease, nr = e.nextRelease;
    const numOf = (v) => v == null || v === '' ? NaN : Number(String(v).replace(/[^0-9.-]/g, ''));
    const la = lr ? numOf(lr.actual) : NaN, lf = lr ? numOf(lr.forecast) : NaN;
    const lastBias = !isFinite(la) || !isFinite(lf) ? 'belum ada angka pembanding' : la > lf ? 'lebih panas → tekanan turun emas' : la < lf ? 'lebih dingin → dukungan naik emas' : 'sesuai konsensus → netral';
    const pr = e.previousRelease;
    const pa = pr ? numOf(pr.actual) : NaN, pf = pr ? numOf(pr.forecast) : NaN;
    const prevBias = !isFinite(pa) || !isFinite(pf) ? 'belum ada angka pembanding' : pa > pf ? 'lebih panas → tekanan turun emas' : pa < pf ? 'lebih dingin → dukungan naik emas' : 'sesuai konsensus → netral';
    const prevCard = !pr ? '' : `<div class="exp" style="color:var(--tx)"><b>🕰️ Rilis sebelumnya</b>
          <div class="small mut" style="margin-top:3px">${pr.when ? when(pr.when) : 'arsip'}${pr.source ? ' · ' + XE(pr.source) : ''}</div>
          <div>Aktual <b>${XE(pr.actual || '—')}</b>${pr.unit ? ' ' + XE(pr.unit) : ''} · konsensus ${XE(pr.forecast || '—')}</div>
          <div class="small mut">Previous ${XE(pr.previous || '—')} · ${prevBias}.</div>
          <div class="small" style="margin-top:5px;color:var(--mut)">Data rilis yang lebih tua; pembanding tren, bukan arah rilis baru.</div>
        </div>`;
    return `<div class="card"><div class="rb-card-head"><h3>📊 Data terakhir vs rilis berikutnya</h3><span class="rb-pill">${e.released ? 'rilis fokus sudah terbit' : 'rilis fokus belum terbit'}</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:8px">
        ${prevCard}
        <div class="exp" style="color:var(--tx)"><b>🗂️ Data rilis terakhir</b>
          <div class="small mut" style="margin-top:3px">${lr && lr.when ? when(lr.when) : '—'}${lr && lr.source ? ' · ' + XE(lr.source) : ''}</div>
          <div>Aktual <b>${lr ? XE(lr.actual || '—') : '—'}</b>${lr && lr.unit ? ' ' + XE(lr.unit) : ''} · konsensus ${lr ? XE(lr.forecast || '—') : '—'}</div>
          <div class="small mut">Previous ${lr ? XE(lr.previous || '—') : '—'} · ${lastBias}.</div>
          <div class="small" style="margin-top:5px;color:var(--warn)">Ini data nyata yang sudah terbit, bukan angka rilis berikutnya.</div>
        </div>
        <div class="exp" style="color:var(--tx)"><b>⏭️ Rilis berikutnya / fokus</b>
          <div class="small mut" style="margin-top:3px">${nr && nr.when ? when(nr.when) : (e.when ? when(e.when) : 'jadwal belum tersedia')}</div>
          <div>Konsensus <b>${nr ? XE(nr.forecast || '—') : XE(e.forecast || '—')}</b> · previous ${nr ? XE(nr.previous || '—') : XE(e.previous || '—')}</div>
          <div class="small mut">Aktual: <b>${nr || !e.released ? 'belum terbit' : XE(e.actual || '—')}</b> · status ${XE((j.timing && j.timing.status) || (e.released ? 'SUDAH TERBIT' : 'MENUNGGU'))}</div>
          <div class="small" style="margin-top:5px;color:${j.direction === 'BUY' ? 'var(--ok)' : 'var(--no)'}">Arah mesin: <b>${XE(j.direction || '—')}</b> ${j.timing && j.timing.preWindow ? '· pra-rilis T-3' : ''}</div>
        </div>
      </div>
      <div class="small mut" style="margin-top:7px">Arah rilis berikutnya masih pra-rilis selama aktualnya belum terbit; panel AI dan data resmi tidak boleh dianggap sebagai hasil rilis.</div></div>`;
  }

  function docCard(j) {
    const d = j.doc;
    if (!d) return `<div class="card"><div class="rb-card-head"><h3>🧠 Ringkasan AI</h3><span class="rb-pill">${j.ai && j.ai.ok ? 'AI siap' : 'AI tidak tersedia'}</span></div><div class="warn">${j.ai && j.ai.ok ? 'AI tidak mengirim dokumen valid.' : 'AI gagal: ' + XE((j.ai && j.ai.error) || 'tidak ada key aktif') + '. Arah & spike tetap dihitung mesin dari data.'}</div></div>`;
    return `<div class="card"><div class="rb-card-head"><h3>🧠 Ringkasan AI</h3><span class="rb-pill">${XE((j.ai && j.ai.provider) || 'AI')}</span></div>
      <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;line-height:1.35;margin-bottom:6px">${XE(d.headline || '')}</div>
      <div class="exp" style="color:var(--tx);line-height:1.6">${XE(d.summary || '')}</div>
      ${d.focus_what ? `<div style="margin-top:8px"><b class="small">Apa yang diukur</b><div class="small" style="line-height:1.55">${XE(d.focus_what)}</div></div>` : ''}
      ${d.why_gold ? `<div style="margin-top:6px"><b class="small">Mengapa penting untuk emas</b><div class="small" style="line-height:1.55">${XE(d.why_gold)}</div></div>` : ''}
      ${d.prediction_2_3m ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>⏱️ Prakiraan 2–3 menit sebelum rilis</b><div class="small" style="line-height:1.55">${XE(d.prediction_2_3m)}</div></div>` : ''}
      ${d.why_valid ? `<div style="margin-top:8px"><b class="small">Mengapa data ini valid</b><div class="small" style="line-height:1.55">${XE(d.why_valid)}</div></div>` : ''}
      ${d.fact_vs_inference ? `<div class="small mut" style="margin-top:5px">Fakta vs inferensi: ${XE(d.fact_vs_inference)}</div>` : ''}
      ${(d.data_chain || []).length ? `<div style="margin-top:8px"><b class="small">Rantai data → arah</b>${d.data_chain.map(x => `<div class="item"><span><b>${XE(x.source)}</b> <span class="small mut">${XE(x.weight)}</span><div class="small">${XE(x.fact)}</div></span></div>`).join('')}</div>` : ''}
      ${d.youtube_read ? `<div class="small" style="margin-top:6px">📺 YouTube: ${XE(d.youtube_read)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">
        ${d.bull_case ? `<div class="exp" style="color:var(--tx)"><b>🟢 Skenario naik:</b> ${XE(d.bull_case)}</div>` : ''}
        ${d.bear_case ? `<div class="exp" style="color:var(--tx)"><b>🔴 Skenario turun:</b> ${XE(d.bear_case)}</div>` : ''}
      </div>
      ${(d.comparison || []).length ? `<div style="margin-top:10px"><b class="small">Perbandingan data terbaru vs sebelumnya</b>${d.comparison.map(c => `<div class="item"><span>${XE(c.metric)} <span class="small mut">${XE(c.source)}</span></span><span><b>${XE(c.latest)}</b> <span class="mut small">← ${XE(c.previous)} ${c.change ? '· ' + XE(c.change) : ''}</span></span></div>`).join('')}</div>` : ''}
      ${(d.scenarios || []).length ? `<div style="margin-top:10px"><b class="small">Skenario</b>${d.scenarios.map(s => `<div class="exp" style="margin-top:6px;color:var(--tx)"><b>${XE(s.name)}</b><div class="small">Jika: ${XE(s.if)}</div><div class="small">Maka: ${XE(s.then)}</div></div>`).join('')}</div>` : ''}
      ${(d.concurrent || []).length ? `<div style="margin-top:10px"><b class="small">Rilis bersamaan</b>${d.concurrent.map(c => `<div class="small" style="margin-top:4px">• <b>${XE(c.title)}</b> <span class="mut">${XE(c.when)} · ${XE(c.impact)}</span><br>${XE(c.gold_effect)}</div>`).join('')}</div>` : ''}
      ${(d.risks || []).length ? `<div style="margin-top:10px"><b class="small">Risiko</b>${d.risks.map(r => `<div class="small" style="margin-top:3px">• ${XE(r)}</div>`).join('')}</div>` : ''}
      ${(d.validity || []).length ? `<div style="margin-top:10px"><b class="small">Validitas</b>${d.validity.map(r => `<div class="small" style="margin-top:3px">• ${XE(r)}</div>`).join('')}</div>` : ''}
      ${j.ai && j.ai.audit ? `<div class="exp" style="margin-top:10px;color:var(--tx)"><b>🔎 Audit AI kedua:</b> ${j.ai.audit.consistent ? 'angka dokumen konsisten dengan data.' : 'ada angka yang perlu dicek.'}${j.ai.audit.confidence != null ? ' <span class="small mut">keyakinan ' + XE(j.ai.audit.confidence) + '%</span>' : ''}${(j.ai.audit.issues || []).length ? '<div class="small" style="color:var(--warn)">' + j.ai.audit.issues.map(x => '• ' + XE(x)).join('<br>') + '</div>' : ''}</div>` : ''}
    </div>`;
  }

  function evidenceCard(j) {
    const ev = j.evidence || [];
    return `<div class="card"><h3>🧮 Bukti arah (dihitung mesin)</h3>
      ${ev.length ? ev.map((x, i) => `<div class="item"><span>${i + 1}. ${XE(x.why)}</span><b style="color:${x.w >= 0 ? 'var(--ok)' : 'var(--no)'}">${x.w > 0 ? '+' : ''}${XE(x.w)}</b></div>`).join('') : '<div class="mut small">Belum ada bukti pasar yang cukup.</div>'}
      ${j.spike ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>⚡ ${j.spike.measured ? 'Spike terukur' : 'Spike tidak diklaim terukur'}</b><div class="small" style="margin-top:3px">${XE(j.spike.why)}</div></div>` : ''}
    </div>`;
  }

  function sourcesCard(j) {
    const yt = j.yt || {}, us = j.us || {};
    const y = (yt.items || []).slice(0, 8), u = (us.items || []).slice(0, 8);
    return `<div class="card"><div class="rb-card-head"><h3>📺 YouTube & media AS</h3><span class="rb-pill">${y.length} video · ${u.length} berita</span></div>
      <div class="rb-note">YouTube: judul + kanal + umur (kanal resmi ditandai). Media AS: Google News RSS (Reuters, AP, Bloomberg, CNBC, WSJ, FT, MarketWatch, Fox Business). Hanya konteks — angka tetap dari kalender & FRED.</div>
      ${u.length ? `<div style="margin-top:8px"><b class="small">📰 Media AS</b>${u.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${XE(x.source || '')}${x.ageH != null ? ' · ' + x.ageH + ' jam lalu' : ''}</div></span></div>`).join('')}</div>` : ''}
      ${y.length ? `<div style="margin-top:8px"><b class="small">▶️ YouTube</b>${yt.tally ? `<span class="small mut"> · ${XE(yt.tally.bullish)} bullish / ${XE(yt.tally.bearish)} bearish / ${XE(yt.tally.netral)} netral (dari judul)</span>` : ''}${y.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${x.trusted ? (String(x.trusted).toLowerCase() === String(x.channel || '').toLowerCase() ? '✅ ' : '✅ ' + XE(x.trusted) + ' · ') : '👤 komunitas · '}${XE(x.channel || '')}${x.ageH != null ? ' · ' + x.ageH + ' jam lalu' : ''}${x.views ? ' · ' + XE(x.views) : ''}${x.stance ? ' · ' + XE(x.stance) : ''}</div></span></div>`).join('')}</div>` : ''}
      ${((yt.transcripts && yt.transcripts.items) || []).length ? `<div style="margin-top:8px"><b class="small">📝 Transkrip resmi Bloomberg/Reuters/CNBC</b>${yt.transcripts.items.map(t => `<details class="exp" style="margin-top:6px;color:var(--tx)"><summary><b>${XE(t.title)}</b> <span class="small mut">${XE(t.channel)} · ${XE(t.durationLabel)} · ${XE(t.auto ? 'caption otomatis' : 'caption')} · ${XE(t.chars)} karakter</span></summary><div class="small" style="margin-top:6px;line-height:1.55">${XE(String(t.text || '').slice(0, 600))}${t.text && t.text.length > 600 ? '…' : ''}</div><div class="small mut">Kutipan caption mentah — bukan angka acuan; bisa salah kata.</div></details>`).join('')}</div>` : `<div class="small mut" style="margin-top:6px">${XE((yt.transcripts && yt.transcripts.note) || 'Transkrip resmi tidak tersedia.')}</div>`}
      ${yt.videoRead && yt.videoRead.ok ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>🎬 Isi video resmi: ${XE(yt.videoRead.title)}</b><div class="small mut">${XE(yt.videoRead.channel)} · ${XE(yt.videoRead.durationLabel)} · dibaca ${XE(yt.videoRead.model)} · kecenderungan ${XE(yt.videoRead.kecenderungan)}</div>${yt.videoRead.topik ? `<div class="small" style="margin-top:4px"><b>Topik:</b> ${XE(yt.videoRead.topik)}</div>` : ''}${(yt.videoRead.poin || []).map(x => `<div class="small" style="margin-top:2px">• ${XE(x)}</div>`).join('')}${yt.videoRead.catatan ? `<div class="small mut" style="margin-top:4px">${XE(yt.videoRead.catatan)}</div>` : ''}<div class="small mut">${XE(yt.videoRead.note)}</div></div>` : ''}
      ${((j.officialNews && j.officialNews.items) || []).length ? `<div style="margin-top:8px"><b class="small">🏛 Rilis pers resmi (Fed/BLS)</b>${j.officialNews.items.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${XE(x.source)}${x.ageH != null ? ' · ' + x.ageH + ' jam lalu' : ''}</div></span></div>`).join('')}</div>` : ''}
      ${(j.concurrent || []).length ? `<div style="margin-top:10px"><b class="small">⏱ Rilis lain di waktu bersamaan</b>${j.concurrent.map(c => `<div class="item"><span>${XE(c.title)}${c.tag ? ' · <b>' + XE(c.tag) + '</b>' : ''}<div class="small mut">${XE(when(c.when))} · ${XE(c.impact)} · konsensus ${XE(c.forecast || '—')}</div></span><span class="small mut">${XE(c.actual || 'belum terbit')}</span></div>`).join('')}</div>` : ''}
    </div>`;
  }

  function dataCard(j) {
    const src = j.sources || [], val = j.official;
    const q = j.dataQuality;
    return `<div class="card"><div class="rb-card-head"><h3>✅ Validitas & sumber</h3>${q ? `<span class="rb-pill ${q.score >= 80 ? 'y' : ''}">${XE(q.score)}% sumber siap</span>` : ''}</div>
      <div class="rb-note">Setiap angka punya sumber dan periode. Data resmi (FRED/BLS/BEA/Treasury) dipisahkan dari kalender agregator.</div>
      ${q ? `<div style="margin-top:6px">${q.checks.map(c => `<div class="item"><span>${c.ok ? '✅' : '⚠️'} ${XE(c.k)}</span></div>`).join('')}</div>` : ''}
      ${val && val.ok ? `<div class="exp" style="color:var(--tx);margin-top:6px"><b>${XE(val.label)}</b> · nilai <b>${XE(val.value)}</b>${val.prev != null ? ' · sebelumnya ' + XE(val.prev) : ''} · periode ${XE(val.period)} <div class="small mut">${XE(val.source)}</div>${(val.extra || []).map(x => `<div class="small mut">${XE(x.metric)}: ${XE(x.latest)}${x.previous != null ? ' (sebelumnya ' + XE(x.previous) + ')' : ''}</div>`).join('')}</div>` : `<div class="warn" style="margin-top:6px">Angka resmi FRED belum terbaca: ${XE((val && val.error) || '—')}</div>`}
      <div style="margin-top:8px">${src.map(s => `<div class="item"><span>${s.ok ? '✅' : '⚠️'} ${XE(s.name)}</span></div>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Diambil ${XE(when(j.generatedAt))}${j.cached ? ' · cache server' : ''}${j.ai ? ' · AI: ' + XE((j.ai.model || j.ai.provider || '—')) : ''}</div>
    </div>`;
  }

  function marketCard(j) {
    const m = j.marketContext || {};
    const row = (label, v, unit) => `<div class="item"><span>${XE(label)}</span><b style="color:${v == null ? 'var(--mut)' : v >= 0 ? 'var(--ok)' : 'var(--no)'}">${v == null ? '—' : (v > 0 ? '+' : '') + v + XE(unit || '')}</b></div>`;
    return `<div class="card"><div class="rb-card-head"><h3>🌍 Konteks pasar (terukur)</h3><span class="rb-pill">${XE((m.tv && m.tv.bias) || 'TV tidak tersedia')}</span></div>
      ${row('Emas 1 hari', m.gold1d, '%')}${row('Emas 5 hari', m.gold5d, '%')}${row('DXY 5 hari', m.dxy5d, '%')}${row('Yield 10Y 5 hari', m.yield10_5d, ' pp')}
      <div class="small mut" style="margin-top:6px">Dipakai sebagai bukti arah di skor mesin, bukan angka dari AI.${m.tv ? ' TradingView gabungan ' + XE(m.tv.strength) + '% · harga ' + num(m.tv.price) : ''}</div></div>`;
  }

  function paintNews(j, cached) {
    const out = X$('xNewsOut');
    if (!out) return;
    if (!j) { out.innerHTML = ''; return; }
    if (!j.ok) { out.innerHTML = `<div class="card"><div class="warn">${XE(j.error || 'Data tidak tersedia')}</div><div class="small mut" style="margin-top:6px">Akan dicoba ulang otomatis pada siklus 15 menit berikutnya.</div></div>`; return; }
    out.innerHTML = verdictCard(j) + timingCard(j) + releaseCompareCard(j) + eventCard(j) + panelCard(j) + evidenceCard(j) + docCard(j) + macroCard(j) + marketCard(j) + sourcesCard(j) + dataCard(j) + (cached ? '<div class="small mut" style="margin-top:6px">Data tersimpan di perangkat — refresh otomatis berjalan tiap 15 menit.</div>' : '');
    startNewsClock(j.event && j.event.when);
  }

  /* ---------------- SIGNAL ---------------- */
  window.pSignalEntry = function () {
    if (sigTimer) { clearInterval(sigTimer); sigTimer = null; }
    if (sigCd) { clearInterval(sigCd); sigCd = null; }
    X$('pane').innerHTML = `
      <div class="card">
        <div class="rb-card-head"><h3>⚡ Signal Entry — XAUUSD</h3><span class="rb-pill">Alchemist · TradingView real-time</span></div>
        <div class="rb-note">Entry M5 ala Alchemist: bias top-down (D1/H4/H1 sesuai mode), POI per mode, trigger candle M5 yang sudah close (BOS/CHoCH, sweep, FVG, order block, EQH/EQL), lalu SL 30 pip dan TP bertingkat ke likuiditas nyata (swing H1/H4, PDH/PDL, sesi, ADR). Scalping memakai POI M5/M15, Day memakai M15/H1, Swing memakai H4/H1 — bukan satu setup yang dipakai untuk semua mode.</div>
        <div class="rb-pill-row"><span class="rb-pill y">Entry M5</span><span class="rb-pill">SL 30 pip</span><span class="rb-pill">TP likuiditas</span><span class="rb-pill">Scalp / Day / Swing terpisah</span><span class="rb-pill y">Auto-refresh 20 menit</span><span class="rb-pill">State per akun</span></div>
        <div id="sigMsg" class="mut small" style="margin-top:8px"></div>
        <div id="sigNext" class="small" style="margin-top:4px;color:var(--warn)"></div>
      </div>
      <div class="card">
        <div class="rb-card-head"><h3>📺 Chart TradingView — XAUUSD M5</h3><span class="rb-pill" id="tvPrice">real-time</span></div>
        <div id="xTvHost" style="height:420px;border-radius:10px;overflow:hidden;margin-top:8px;background:#0f172a"></div>
        <div class="small mut" style="margin-top:6px">Chart TradingView live memakai feed publik yang benar-benar tersedia: FOREXCOM:XAUUSD. HFM:XAUUSD dan EXNESS:XAUUSD tidak tersedia di feed publik TradingView (scanner mengembalikan data kosong), jadi tidak dipakai sebagai klaim palsu. Candle, harga, struktur, dan tanda Alchemist dihitung dari feed live yang sama; chart di bawah bukan gambar statis.</div>
      </div>
      <div id="sigOut"></div>`;
    xTvMount();
    const boot = (async function () {
      const m0 = X$('sigMsg'); if (m0) m0.textContent = 'Menyinkronkan state akun & hasil tersimpan…';
      try { await sigStatePull(); } catch (e) { }
      if (!X$('sigOut')) return;
      if (sigData) {
        await histSync(sigData);
        const msg = X$('sigMsg');
        if (msg) msg.textContent = '💾 Hasil akun dibuka kembali · diperbarui ' + new Date(sigAt || Date.now()).toLocaleString('id-ID') + ' · refresh berikutnya mengikuti jadwal 20 menit.';
      }
      const tick = function () {
        const el = X$('sigNext');
        if (!el) { clearInterval(sigCd); sigCd = null; return; }
        if (sigBusy) { el.textContent = '⏳ Menghitung ulang dari candle terbaru…'; return; }
        const left = Math.max(0, SIG_REFRESH_MS - (Date.now() - (sigAt || Date.now())));
        const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        el.textContent = 'Refresh otomatis dalam ' + m + ':' + String(s).padStart(2, '0') + ' · tanpa tombol';
      };
      tick();
      sigCd = setInterval(tick, 1000);
      if (!sigData || Date.now() - (sigAt || 0) > SIG_REFRESH_MS) pSigRun(true);
      const loop = function () {
        const wait = Math.max(1000, SIG_REFRESH_MS - (Date.now() - (sigAt || Date.now())));
        sigTimer = setTimeout(async function () {
          if (!X$('sigOut')) return;
          if (sigBusy) { sigTimer = setTimeout(loop, 5000); return; }
          await pSigRun(true);
          loop();
        }, wait);
      };
      loop();
      if (!window.__sigVis) {
        window.__sigVis = 1;
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState !== 'visible' || sigBusy || !X$('sigOut')) return;
          if (!sigData || Date.now() - (sigAt || 0) > SIG_REFRESH_MS) pSigRun(true);
        });
      }
    })();
    boot.catch(function (e) { const m0 = X$('sigMsg'); if (m0) m0.textContent = '⚠️ ' + e.message; });
  };
  window.pSigRun = async function (silent) {
    if (sigBusy) return;
    sigBusy = true;
    const msg = X$('sigMsg');
    if (msg) msg.textContent = 'Membaca candle live, TradingView, struktur Alchemist, lalu AI menandai chart…';
    try {
      const j = await tcall({ action: 'xauSignal', fresh: true });
      if (j && j.ok !== false && !j.error) {
        sigData = j;
        sigAt = Date.parse(j.generatedAt) || Date.now();
        sigCacheSave(j);
        /* Tarik + merge Firestore dulu, baru evaluasi/paint, lalu dorong lokal. */
        await histSync(j);
        statePut('signal', null, j).catch(() => { });
        if (msg) msg.textContent = '✅ Siap — arah ' + j.direction + ' · ' + (j.setups || []).length + ' setup · diperbarui ' + new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID');
      } else {
        /* Jangan timpa hasil valid yang tersimpan; jika belum ada cache,
           tampilkan error dan jadwalkan percobaan berikutnya. */
        sigAt = Date.now();
        if (!sigData) paintSignal(j || { ok: false, error: 'Data signal tidak tersedia' });
        if (msg) msg.textContent = '⚠️ ' + ((j && (j.error || 'gagal')) || 'gagal');
      }
    } catch (e) {
      sigAt = Date.now();
      if (msg) msg.textContent = '⚠️ ' + e.message;
    }
    sigBusy = false;
    /* timer tetap berjalan; status dihitung ulang dari sigAt */
  };

  function modeOf(j, m) {
    const ss = j.setups || [];
    return ss.find(s => s.style === m) || (m === sigMode ? j.plan : null) || null;
  }
  window.xSetMode = function (m) {
    if (!SIG_MODES.some(x => x[0] === m)) return;
    sigMode = m;
    try { localStorage.setItem(SIG_MODE_KEY, m); } catch (e) { }
    if (sigData) paintSignal(sigData);
  };
  window.xSigZoom = function (delta) {
    if (delta === 0) sigChartBars = 100;
    else sigChartBars = Math.max(30, Math.min(240, sigChartBars + delta * 20));
    const el = X$('sigZoomLabel');
    if (el) el.textContent = sigChartBars + ' candle';
    if (sigData) drawChart(sigData);
  };
  window.pChartLabels = function () {
    chartLabelAll = !chartLabelAll;
    try { localStorage.setItem('rb_xau_chart_labels', chartLabelAll ? 'all' : 'ringkas'); } catch (e) { }
    const b = X$('sigLabelToggle');
    if (b) b.textContent = chartLabelAll ? '🙈 Label ringkas' : '🏷️ Semua label';
    const n = X$('sigLabelNote');
    if (n && sigData) n.textContent = chartLabelAll
      ? 'Semua ' + (sigData.markers || []).length + ' label ditampilkan; pada chart padat beberapa label bisa berdekatan.'
      : 'Menampilkan ' + chartLabelShown(sigData) + ' dari ' + (sigData.markers || []).length + ' label terdekat + POI aktif agar terbaca. Tombol Semua label membuka seluruhnya.';
    if (sigData) drawChart(sigData);
  };

  function planCard(j) {
    const p = modeOf(j, sigMode) || j.plan;
    if (!p) return '';
    const buy = p.dir === 'BUY';
    const modes = SIG_MODES.map(([k, l]) => {
      const s = (j.setups || []).find(x => x.style === k);
      return `<button class="btn ${k === sigMode ? '' : 'alt'}" style="flex:1;min-width:96px;min-height:38px;font-size:12px;padding:7px 8px" onclick="xSetMode('${k}')">${l}<div class="small" style="opacity:.85">${s ? XE(s.status) : 'tidak ada'}</div></button>`;
    }).join('');
    const tg = (p.targets || []).map((t, i) => `<div class="item"><span><b>TP${i + 1}</b> ${num(t.price)} <span class="small mut">${XE(t.pips)} pip · ${XE(t.src)}</span></span><span class="small" style="color:var(--ok)">${t.strength > 1 ? 'konfluensi ' + t.strength : 'likuiditas'}</span></div>`).join('');
    return `<div class="card" style="border-left:5px solid ${buy ? 'var(--ok)' : 'var(--no)'}">
      <div class="rb-card-head"><h3>🎯 Rencana entry M5</h3><span class="rb-pill ${p.status === 'SIAP' ? 'y' : ''}">${XE(p.status)} · ${XE(p.style)}</span></div>
      <div class="rb-pill-row" style="margin-top:8px">${modes}</div>
      <div class="rb-pill-row" style="margin-top:6px"><span class="rb-pill y">Entry M5</span><span class="rb-pill">SL 30 pip</span><span class="rb-pill">RR 1:${XE(p.rr)}</span><span class="rb-pill">${XE(p.type)}</span>${p.entryDistancePips != null ? `<span class="rb-pill ${p.tooClose ? '' : 'y'}">Jarak ${XE(p.entryDistancePips)} pip${p.minEntryPips != null ? ' · min ' + XE(p.minEntryPips) : ''}</span>` : ''}</div>
      <div class="rb-lv-grid" style="margin-top:8px">
        <div class="rb-lv"><span>Entry</span><b>${num(p.entry)}</b></div>
        <div class="rb-lv"><span>SL · 30 pip</span><b style="color:var(--no)">${num(p.sl)}</b></div>
        <div class="rb-lv"><span>TP1 · ${XE(p.tpPips)} pip</span><b style="color:var(--ok)">${num(p.tp1)}</b></div>
        <div class="rb-lv"><span>TP2 · ${XE(p.tp2Pips)} pip</span><b style="color:var(--ok)">${num(p.tp2)}</b></div>
        <div class="rb-lv"><span>TPmax · ${XE(p.tpMaxPips)} pip</span><b style="color:var(--ok)">${num(p.tpMax)}</b></div>
        <div class="rb-lv"><span>Arah</span><b style="color:${buy ? 'var(--ok)' : 'var(--no)'}">${XE(p.dir)}</b></div>
      </div>
      ${tg ? `<div style="margin-top:8px"><div class="small mut" style="margin-bottom:2px">Tangga TP dari likuiditas nyata:</div>${tg}</div>` : ''}
      ${p.statusWhy ? `<div class="small" style="color:${p.tooClose ? 'var(--warn)' : 'var(--mut)'};margin-top:8px">${XE(p.statusWhy)}</div>` : ''}
      <div class="small mut" style="margin-top:8px">${XE(p.why)}</div>
      ${p.invalidation ? `<div class="small" style="color:var(--warn);margin-top:4px">Batal: ${XE(p.invalidation)}</div>` : ''}</div>`;
  }

  function signalVerdict(j) {
    const buy = j.direction === 'BUY';
    return `<div class="card"><div class="rb-card-head"><h3>📊 Arah tunggal</h3><span class="rb-dir ${buy ? 'buy' : 'sell'}">${XE(j.direction)}</span></div>
      <div class="small mut">Kekuatan ${XE(j.directionStrength)}% · harga ${num(j.price)} · ${XE(j.priceSource)} · ${XE(j.markers ? j.markers.length : 0)} tanda chart</div>
      <div class="rb-pill-row" style="margin-top:8px"><span class="rb-pill y">Entry M5</span>${j.freshness && j.freshness.dataLive ? '<span class="rb-pill y">Candle TradingView real-time</span>' : '<span class="rb-pill">Candle cadangan</span>'}<span class="rb-pill">ATR5 ${num(j.atr5)}</span><span class="rb-pill">RSI5 ${num(j.rsi5)}</span><span class="rb-pill">${XE(j.session && j.session.name)}</span><span class="rb-pill">${XE(j.daily && j.daily.trend)}</span>${j.adr ? `<span class="rb-pill">ADR ${XE(j.adr.avgPips)} pip</span>` : ''}<span class="rb-pill">Risiko ${XE(j.eventRisk && j.eventRisk.level)}</span></div>
      ${j.freshness ? `<div class="small mut" style="margin-top:6px">Harga ${j.freshness.priceAt ? new Date(j.freshness.priceAt).toLocaleTimeString('id-ID') : '—'} · candle M5 ${j.freshness.candleAgeMin != null ? (j.freshness.candleAgeMin > 120 ? Math.round(j.freshness.candleAgeMin / 60) + ' jam' : j.freshness.candleAgeMin + ' menit') : '—'} lalu · ${XE(j.freshness.candleSource)}</div>` : ''}
      ${j.marketOpen === false ? `<div class="warn" style="margin-top:8px">⚠️ Pasar tutup atau candle M5 tertunda. Semua setup berstatus TUNGGU sampai candle M5 baru muncul — bukan sinyal untuk entry sekarang.</div>` : ''}
      ${j.eventRisk && j.eventRisk.level !== 'RENDAH' ? `<div class="warn" style="margin-top:8px">⚠️ ${XE(j.eventRisk.note)}</div>` : ''}
      ${j.adr ? `<div class="small mut" style="margin-top:6px">ADR ${XE(j.adr.avgPips)} pip · hari ini ${XE(j.adr.todayPips)} pip · sisa rata-rata ${XE(j.adr.remainingPips)} pip</div>` : ''}
    </div>`;
  }

  function globalCard(j) {
    const m = j.macro || {};
    const row = (label, v, unit) => v == null ? '' : `<div class="item"><span>${XE(label)}</span><b style="color:${v > 0 ? 'var(--ok)' : v < 0 ? 'var(--no)' : 'var(--mut)'}">${v > 0 ? '+' : ''}${XE(v)}${XE(unit || '')}</b></div>`;
    const rows = row('Emas 1 hari', m.gold1d, '%') + row('Emas 5 hari', m.gold5d, '%') + row('DXY 15 menit', m.dxy15m, '%') + row('DXY 5 hari', m.dxy5d, '%') + row('Yield 10Y 15 menit', m.us10y15m, ' pp') + row('Yield 10Y 5 hari', m.yield10_5d, ' pp');
    return `<div class="card"><div class="rb-card-head"><h3>🌍 Data global real-time</h3><span class="rb-pill">ikut arah entry</span></div>
      ${rows || '<div class="small mut">Data DXY/yield belum tersedia; arah memakai struktur chart.</div>'}
      <div class="small mut" style="margin-top:6px">DXY/yield dari TradingView live/Yahoo; emas dari candle live. Naiknya DXY/yield = tekanan turun emas; datanya masuk ke skor arah mesin, bukan hanya hiasan.</div></div>`;
  }

  function checklistCard(j) {
    if (!j.checklist || !j.checklist.length) return '';
    return `<div class="card"><div class="rb-card-head"><h3>✅ Checklist Alchemist M5</h3><span class="rb-pill ${j.checkScore >= 80 ? 'y' : ''}">${XE(j.checkScore)}%</span></div>
      ${j.checklist.map(x => `<div class="item"><span>${x.ok ? '✅' : '⚠️'} ${XE(x.k)}</span><span class="small mut" style="text-align:right">${XE(x.d)}</span></div>`).join('')}</div>`;
  }

  function tfCard(j) {
    const t = j.tfMatrix || [];
    if (!t.length) return '';
    const dir = j.direction;
    return `<div class="card"><div class="rb-card-head"><h3>🧭 Matriks timeframe</h3><span class="rb-pill">final ${XE(dir)}</span></div>
      <div class="small mut" style="margin-bottom:6px">Konteks, bukan sinyal kedua. TF yang melawan arah final hanya pullback timing — tetap satu arah entry.</div>
      ${t.map(x => { const opp = (x.value > 0.05 && dir === 'SELL') || (x.value < -0.05 && dir === 'BUY'); return `<div class="item"><span><b>${XE(x.tf)}</b> <span class="small mut">RSI ${num(x.rsi)}</span></span><span style="color:${x.value > 0.05 ? 'var(--ok)' : x.value < -0.05 ? 'var(--no)' : 'var(--mut)'}">${XE(x.rec)} · ${XE(x.strength)}%${opp ? ' <span class="mut">(pullback)</span>' : ''}</span></div>`; }).join('')}</div>`;
  }

  function chartLabelShown(j) {
    const all = j.markers || [];
    if (chartLabelAll) return all.length;
    return Math.min(all.length, Math.max(all.filter(m => m.active).length, 14));
  }
  function chartCard(j) {
    const types = {};
    (j.markers || []).forEach(m => { types[m.type] = (types[m.type] || 0) + 1; });
    const nAll = (j.markers || []).length, nShow = chartLabelShown(j);
    return `<div class="card"><div class="rb-card-head"><h3>🏷️ Chart tanda M5 + POI H1/H4</h3><span class="rb-pill" id="sigStamp">${j.generatedAt ? new Date(j.generatedAt).toLocaleTimeString('id-ID') : '—'}</span></div>
      <canvas id="xSigChart" title="Gulir untuk zoom, atau pakai tombol di bawah" style="width:100%;height:380px;display:block;margin-top:6px"></canvas>
      <div class="rb-pill-row" style="margin-top:8px;align-items:center"><button class="x" type="button" onclick="xSigZoom(-1)">🔍 Perbesar</button><span class="rb-pill" id="sigZoomLabel">${sigChartBars} candle</span><button class="x" type="button" onclick="xSigZoom(1)">🔍 Perkecil</button><button class="x" type="button" onclick="xSigZoom(0)">Reset</button><button class="x" type="button" id="sigLabelToggle" onclick="pChartLabels()">${chartLabelAll ? '🙈 Label ringkas' : '🏷️ Semua label'}</button></div>
      <div class="small mut" id="sigLabelNote" style="margin-top:6px">${chartLabelAll ? 'Semua ' + nAll + ' label ditampilkan; pada chart padat beberapa label bisa berdekatan.' : 'Menampilkan ' + nShow + ' dari ' + nAll + ' label terdekat + POI aktif agar terbaca. Tombol <b>Semua label</b> membuka seluruhnya.'}</div>
      <div class="rb-pill-row" style="margin-top:8px">${Object.keys(types).map(t => `<span class="rb-pill">${XE(t)} · ${types[t]}</span>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Label ringkas (mis. <b>SND H4</b>, <b>BOS M5</b>, <b>FVG M15</b>) ditempel di candle yang disentuh level itu, dengan garis tipis ke harga. Candle M5 dari ${j.freshness ? XE(j.freshness.candleSource) : 'TradingView'}; POI M5/M15/H1/H4 mengikuti mode. Semua dihitung ulang dari candle terbaru dan di-anchor ke harga TradingView (${j.chart ? XE(j.chart.anchor) : '—'}). TradingView tidak menyediakan API untuk menulis gambar ke akun pengguna.</div></div>`;
  }

  function marksCard(j) {
    const ms = j.markers || [];
    if (!ms.length) return '';
    return `<div class="card"><h3>🏷️ Tanda chart & catatan AI</h3>${ms.map(m => `<div class="item"><span><b>${XE(m.type)}</b> · ${XE(m.label)} <span class="mut small">${num(m.price)}</span><div class="small mut">${XE(m.why)}</div>${m.ai ? `<div class="small" style="color:var(--warn)">🧠 ${XE(m.ai.note)} <span class="mut">(${XE(m.ai.confidence)})</span></div>` : ''}</span></div>`).join('')}</div>`;
  }

  function setupsCard(j) {
    const ss = j.setups || [];
    return `<div class="card"><div class="rb-card-head"><h3>🎯 ${ss.length} setup satu arah (${XE(j.direction)})</h3><span class="rb-pill">SL 30 pip</span></div>
      ${ss.map(s => `<div class="exp" style="color:var(--tx);margin-top:6px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${XE(s.style)} · ${XE(s.dir)}</b><span class="small" style="color:${s.status === 'SIAP' ? 'var(--ok)' : 'var(--mut)'}">${XE(s.status)}</span></div>
        <div class="small">Entry ${num(s.entry)} (${XE(s.type)}) · SL ${num(s.sl)} · TP1 ${num(s.tp1)} · TP2 ${num(s.tp2)} · TPmax ${num(s.tpMax)} (${XE(s.tpMaxPips)} pip)</div>
        ${s.statusWhy ? `<div class="small" style="color:${s.tooClose ? 'var(--warn)' : 'var(--mut)'}">${XE(s.statusWhy)}</div>` : ''}
        <div class="small mut">${XE(s.why)}</div></div>`).join('') || '<div class="warn">Belum ada setup yang lolos filter. Bias HTF, POI, atau trigger M5 belum searah; jangan paksa entry di luar rencana.</div>'}</div>`;
  }

  function aiCard(j) {
    const a = j.ai || {};
    return `<div class="card"><div class="rb-card-head"><h3>🧠 Anotasi AI</h3><span class="rb-pill">${a.ok ? XE(a.model || a.provider || 'AI') : 'AI tidak tersedia'}</span></div>
      ${a.ok ? `<div class="exp" style="color:var(--tx);line-height:1.55">${XE(a.summary)}</div>
        <div class="small" style="margin-top:6px">Arah final tetap <b>${XE(j.direction)}</b>${a.dissent ? ` · AI menandai risiko bias berlawanan (${XE(a.dissent)}) tetapi tidak dipakai sebagai sinyal` : ' · AI sejalan dengan mesin'}</div>
        ${a.note ? `<div class="small" style="color:var(--warn);margin-top:4px">${XE(a.note)}</div>` : ''}
        ${(a.confluence || []).length ? `<div style="margin-top:6px">${a.confluence.map(c => `<div class="small">• ${XE(c)}</div>`).join('')}</div>` : ''}
        ${a.invalidation ? `<div class="small mut" style="margin-top:6px">Batal jika: ${XE(a.invalidation)}</div>` : ''}`
        : `<div class="warn">AI gagal: ${XE(a.error || 'tidak ada key aktif')}. Tanda chart tetap dihitung mesin dan tidak dikarang.</div>`}
      ${(j.validation || []).length ? `<div style="margin-top:8px">${j.validation.map(v => `<div class="item"><span>${v.ok ? '✅' : '⚠️'} ${XE(v.k)}</span><span class="small mut">${XE(v.d)}</span></div>`).join('')}</div>` : ''}
    </div>`;
  }

  /* Urutan refresh: merge remote → evaluasi lokal → render → dorong lokal.
     paintSignal sendiri tidak menarik Firestore agar mode/zoom tidak memicu
     siklus tulis dan tidak menimpa status remote yang lebih baru. */
  async function histSync(j) {
    await histPull();
    try { histUpdate(j); } catch (e) { }
    paintSignal(j);
    histPushLocal();
  }

  function paintSignal(j) {
    const out = X$('sigOut');
    if (!out) return;
    if (!j || j.error) { out.innerHTML = `<div class="card"><div class="warn">${XE((j && j.error) || 'Tidak ada data')}</div><div class="small mut" style="margin-top:6px">Riwayat tetap tersimpan; refresh otomatis dicoba lagi 20 menit berikutnya.</div></div>` + histCard(); return; }
    const chip = X$('tvPrice');
    if (chip) chip.textContent = 'harga ' + num(j.price) + ' · ' + new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID');
    out.innerHTML = signalVerdict(j) + planCard(j) + globalCard(j) + checklistCard(j) + tfCard(j) + chartCard(j) + setupsCard(j) + marksCard(j) + aiCard(j) + histCard();
    drawChart(j);
    if (!sigRO && window.ResizeObserver && X$('xSigChart')) {
      let raf = 0;
      sigRO = new ResizeObserver(function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { if (sigData && X$('xSigChart')) drawChart(sigData); });
      });
      sigRO.observe(X$('xSigChart'));
    }
  }
  window.xTvMount = function () {
    const host = X$('xTvHost');
    if (!host || host.dataset.on) return;
    host.dataset.on = '1';
    const sym = (sigData && sigData.tvSymbol) || 'FOREXCOM:XAUUSD';
    host.innerHTML = '<div id="tvNote" class="small mut" style="padding:10px">Memuat chart TradingView real-time…</div>';
    const f = document.createElement('iframe');
    f.src = 'https://s.tradingview.com/widgetembed/?symbol=' + encodeURIComponent(sym) + '&interval=5&theme=dark&style=1&timezone=Asia%2FJakarta&locale=id&hidesidetoolbar=0&symboledit=1&saveimage=0&withdateranges=1&studies=%5B%5D';
    f.title = 'Chart TradingView XAUUSD M5 real-time · ' + sym;
    f.style.cssText = 'width:100%;height:100%;border:0;display:block';
    f.setAttribute('allowtransparency', 'true');
    f.setAttribute('scrolling', 'no');
    f.onload = function () { const n = document.getElementById('tvNote'); if (n) n.remove(); };
    host.appendChild(f);
    setTimeout(function () {
      const n = document.getElementById('tvNote');
      if (n) n.textContent = 'Chart TradingView belum termuat di jaringan ini (iframe diblokir). Chart tanda di bawah tetap memakai harga TradingView live.';
    }, 9000);
  };

  function drawChart(j) {
    const cv = X$('xSigChart');
    if (!cv || !j.chart) return;
    const allRows = ((j.chart.m5 && j.chart.m5.length ? j.chart.m5 : j.chart.rows) || []);
    const rows = allRows.slice(-Math.max(30, Math.min(240, sigChartBars)));
    if (rows.length < 5) return;
    const ap = modeOf(j, sigMode) || j.plan;
    const lastC = rows[rows.length - 1].c;
    const refs = []
      .concat((j.markers || []).map(m => m.price))
      .concat(ap ? [ap.entry, ap.sl, ap.tp1, ap.tp2, ap.tpMax] : [])
      .filter(p => p != null && isFinite(p) && Math.abs(p - lastC) <= 30);
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 720, H = 380;
    if (W < 80) return;
    cv.width = W * dpr; cv.height = H * dpr;
    if (!cv.dataset.zoomBound) {
      cv.dataset.zoomBound = '1';
      cv.addEventListener('wheel', function (e) {
        if (!sigData) return;
        e.preventDefault();
        window.xSigZoom(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padR = 78, padL = 8, padT = 14, padB = 18;
    const hi = Math.max(...rows.map(r => r.h), ...refs), lo = Math.min(...rows.map(r => r.l), ...refs);
    const y = (p) => padT + (hi - p) / (hi - lo || 1) * (H - padT - padB);
    const x = (i) => padL + i * (W - padL - padR) / rows.length;
    const bw = Math.max(2, (W - padL - padR) / rows.length * 0.62);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.06)';
    for (let k = 1; k <= 4; k++) { const yy = padT + k * (H - padT - padB) / 4; g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke(); }
    rows.forEach((r, i) => {
      const up = r.c >= r.o;
      g.strokeStyle = up ? '#22c55e' : '#ef4444';
      g.fillStyle = up ? '#22c55e' : '#ef4444';
      const xx = x(i) + bw / 2;
      g.beginPath(); g.moveTo(xx, y(r.h)); g.lineTo(xx, y(r.l)); g.stroke();
      const yo = y(r.o), yc = y(r.c);
      g.fillRect(x(i), Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
    });
    const axisBoxes = [];
    const level = (p, color, label, dash) => {
      if (p == null || !isFinite(p) || p > hi || p < lo) return;
      const py = y(p);
      g.save();
      g.strokeStyle = color; g.lineWidth = 1; g.globalAlpha = .85; g.setLineDash(dash ? [4, 4] : []);
      g.beginPath(); g.moveTo(padL, py); g.lineTo(W - padR, py); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      g.textAlign = 'left'; g.font = '700 9px Manrope, sans-serif';
      const tw = Math.min(padR - 6, g.measureText(label).width);
      let ly = py + 3, box = { x: W - padR + 3, y: ly - 8, w: tw + 3, h: 11 };
      for (let k = 0; k < 6; k++) {
        const hit = axisBoxes.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
        if (!hit) break;
        ly += (k % 2 ? 1 : -1) * 11 * Math.ceil((k + 1) / 2);
        ly = Math.max(padT + 8, Math.min(H - padB - 2, ly));
        box = { x: W - padR + 3, y: ly - 8, w: tw + 3, h: 11 };
      }
      axisBoxes.push(box);
      g.fillStyle = 'rgba(15,23,42,.86)'; g.fillRect(box.x, box.y, box.w, box.h);
      g.fillStyle = color; g.fillText(label, box.x + 1, ly);
      g.restore();
    };
    const colors = { BOS: '#f59e0b', CHoCH: '#a78bfa', SWEEP: '#38bdf8', FVG: '#34d399', OB: '#fb7185', SNR: '#94a3b8', SND: '#38bdf8', MB: '#c084fc', OTE: '#facc15', PDH: '#f472b6', PDL: '#f472b6', LIQ: '#22d3ee', EQH: '#f97316', EQL: '#f97316', JUDAS: '#e879f9', ASIA: '#64748b', DO: '#e2e8f0', WO: '#e2e8f0', POI: '#ffffff' };
    const zoneColor = { FVG: 'rgba(52,211,153,.16)', OB: 'rgba(251,113,133,.16)', SND: 'rgba(56,189,248,.14)', MB: 'rgba(192,132,252,.14)' };
    (j.markers || []).forEach(m => {
      if (!Array.isArray(m.zone)) return;
      const za = m.zone[1], zb = m.zone[0];
      if ((za < lo && zb < lo) || (za > hi && zb > hi)) return;
      const a = y(za), b = y(zb);
      g.fillStyle = zoneColor[m.type] || 'rgba(148,163,184,.10)';
      g.fillRect(padL, Math.min(a, b), W - padL - padR, Math.max(1, Math.abs(b - a)));
    });
    /* Marker dibaca dari candle tempat level itu disentuh, bukan ditumpuk
       di sumbu harga kanan. Garis tipis menghubungkan candle ke labelnya. */
    const tagBoxes = [];
    const usedAnchors = {};
    const anchorOf = (m) => {
      const z = Array.isArray(m.zone) ? m.zone : null;
      const zLo = z ? Math.min(z[0], z[1]) : m.price, zHi = z ? Math.max(z[0], z[1]) : m.price;
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.h >= zLo - 0.35 && r.l <= zHi + 0.35) return i;
      }
      return rows.length - 1;
    };
    const markerTag = (m) => {
      if (m.price == null || !isFinite(m.price) || m.price > hi || m.price < lo) return;
      const color = colors[m.type] || '#94a3b8';
      let idx = anchorOf(m);
      /* Sebar label yang jatuh di candle yang sama agar tidak menumpuk. */
      while (usedAnchors[idx] && idx > 0) idx--;
      usedAnchors[idx] = 1;
      const ax = x(idx) + bw / 2, py = y(m.price), r = rows[idx];
      const above = m.price >= lastC;
      const text = String(m.type || '?') + (m.tf ? ' ' + m.tf : '') + ' ' + Number(m.price).toFixed(1) + (m.ai ? ' •' : '');
      g.save();
      g.font = '700 9px Manrope, sans-serif'; g.textAlign = 'left';
      const tw = g.measureText(text).width + 4;
      const offsets = above ? [-4, -15, -26, -37, 8, 19, 30, 41, 52] : [12, 23, 34, 45, 56, -4, -15, -26, -37];
      const xOffsets = [0, -tw - 4, tw + 4, -2 * (tw + 4), 2 * (tw + 4), -3 * (tw + 4), 3 * (tw + 4)];
      let ly = py + offsets[0], bx = Math.max(padL, Math.min(ax + 3, W - padR - tw - 2));
      let placed = false;
      for (let yi = 0; yi < offsets.length && !placed; yi++) {
        for (let xi = 0; xi < xOffsets.length && !placed; xi++) {
          ly = Math.max(padT + 9, Math.min(H - padB - 2, py + offsets[yi]));
          bx = Math.max(padL, Math.min(ax + 3 + xOffsets[xi], W - padR - tw - 2));
          const box = { x: bx - 1, y: ly - 8, w: tw + 2, h: 11 };
          if (!tagBoxes.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) { placed = true; break; }
        }
      }
      tagBoxes.push({ x: bx - 1, y: ly - 8, w: tw + 2, h: 11 });
      /* garis tipis: candle → level → label, tanpa menutupi badan candle */
      g.strokeStyle = color; g.globalAlpha = .38; g.lineWidth = 1; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(ax, above ? y(r.h) : y(r.l)); g.lineTo(ax, py); g.lineTo(W - padR, py); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      g.strokeStyle = color; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(ax, above ? py - 2 : py + 2); g.lineTo(bx + (bx >= ax ? -1 : tw + 1), ly + (ly > py ? -7 : 3)); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(15,23,42,.90)'; g.fillRect(bx - 1, ly - 8, tw + 2, 11);
      g.fillStyle = color; g.fillText(text, bx + 1, ly);
      g.restore();
    };
    const msAll = j.markers || [];
    const msActive = msAll.filter(m => m.active);
    const msRest = msAll.filter(m => !m.active).sort((a, b) => Math.abs(a.price - lastC) - Math.abs(b.price - lastC));
    const msShown = chartLabelAll ? msAll : msActive.concat(msRest).slice(0, 14);
    msShown.forEach(markerTag);
    if (ap) {
      level(ap.entry, '#e2e8f0', 'Entry ' + Number(ap.entry).toFixed(2), false);
      level(ap.sl, '#ef4444', 'SL ' + Number(ap.sl).toFixed(2), false);
      level(ap.tp1, '#22c55e', 'TP1 ' + Number(ap.tp1).toFixed(2), true);
      level(ap.tp2, '#22c55e', 'TP2 ' + Number(ap.tp2).toFixed(2), true);
      if (ap.tpMax && ap.tpMax !== ap.tp2) level(ap.tpMax, '#86efac', 'TPmax ' + Number(ap.tpMax).toFixed(2), true);
    }
  }

  /* ---------- Jurnal trading + kalkulator lot (menggantikan pJurnal yang hilang) ---------- */
  window.pJurnal = function () {
    X$('pane').innerHTML = `
      <div class="card"><div class="rb-card-head"><h3>📒 Jurnal trading & kalkulator lot</h3><span class="rb-pill">XAUUSD · 1 lot = 100 oz</span></div>
        <div class="rb-note">Catat setiap trade (bukan hanya hasil) supaya evaluasi berbasis data. Kalkulator memakai nilai pip XAUUSD $10 per lot; sesuaikan dengan spesifikasi broker bila berbeda.</div></div>
      <div class="card"><h3>🧮 Kalkulator ukuran posisi</h3>
        <div class="rb-lv-grid" style="margin-top:8px">
          <label>Balance (USD)<input id="jBal" type="number" min="1" step="1" value="1000" oninput="xJCalc()"></label>
          <label>Risiko (%)<input id="jRisk" type="number" min="0.1" max="10" step="0.1" value="1" oninput="xJCalc()"></label>
          <label>SL (pip)<input id="jSl" type="number" min="1" step="1" value="30" oninput="xJCalc()"></label>
        </div>
        <div id="jCalcOut" class="exp" style="margin-top:8px;color:var(--tx)"></div></div>
      <div class="card"><h3>➕ Tambah trade</h3>
        <div class="rb-lv-grid" style="margin-top:8px">
          <label>Pair<input id="jPair" value="XAUUSD" autocomplete="off"></label>
          <label>Arah<select id="jDir"><option>BUY</option><option>SELL</option></select></label>
          <label>Setup<input id="jSetup" placeholder="FVG / OB / SND" autocomplete="off"></label>
          <label>Hasil (R)<input id="jR" type="number" step="0.1" placeholder="contoh 1.5 atau -1" ></label>
        </div>
        <textarea id="jNote" placeholder="Alasan entry, kondisi pasar, kesalahan..." maxlength="400" style="width:100%;margin-top:8px"></textarea>
        <button class="btn full" style="margin-top:8px" onclick="xJSave()">💾 Simpan trade</button>
        <div id="jMsg" class="small mut" style="margin-top:6px"></div></div>
      <div class="card"><h3>📊 Riwayat</h3><div id="jlist" class="mut small">Memuat…</div></div>`;
    xJCalc();
    try { loadJ(); } catch (e) { const el = X$('jlist'); if (el) el.textContent = 'Gagal memuat jurnal: ' + e.message; }
  };
  window.xJCalc = function () {
    const bal = +(X$('jBal') && X$('jBal').value) || 0;
    const risk = +(X$('jRisk') && X$('jRisk').value) || 0;
    const sl = +(X$('jSl') && X$('jSl').value) || 0;
    const out = X$('jCalcOut'); if (!out) return;
    if (bal <= 0 || risk <= 0 || sl <= 0) { out.textContent = 'Isi balance, risiko, dan SL dengan angka lebih dari 0.'; return; }
    const usd = bal * risk / 100, lot = Math.max(0.01, Math.round(usd / (sl * 10) * 100) / 100);
    out.innerHTML = `Risiko <b>$${usd.toFixed(2)}</b> · SL <b>${sl} pip</b> · ukuran posisi <b>${lot.toFixed(2)} lot</b><div class="small mut">Perkiraan: $10 per pip per lot. Stop 30 pip dengan risiko $${usd.toFixed(2)} → ${lot.toFixed(2)} lot.</div>`;
  };
  window.xJSave = async function () {
    const msg = X$('jMsg');
    try {
      if (typeof db === 'undefined' || !user) throw new Error('Belum login');
      const pair = String((X$('jPair') || {}).value || 'XAUUSD').trim().toUpperCase().slice(0, 12) || 'XAUUSD';
      const arah = String((X$('jDir') || {}).value || 'BUY');
      const setup = String((X$('jSetup') || {}).value || '').trim().slice(0, 40);
      const rRaw = String((X$('jR') || {}).value || '').trim();
      const r = rRaw === '' ? null : Number(rRaw);
      if (r != null && (!isFinite(r) || Math.abs(r) > 100)) throw new Error('Hasil R harus angka wajar (contoh 1.5 atau -1).');
      const catatan = String((X$('jNote') || {}).value || '').trim().slice(0, 400);
      await db.collection('jurnal').add({ uid: user.uid, pair, arah, setup, r, catatan, waktu: firebase.firestore.FieldValue.serverTimestamp() });
      if (msg) msg.textContent = '✅ Trade tersimpan.';
      if (X$('jNote')) X$('jNote').value = ''; if (X$('jR')) X$('jR').value = '';
      loadJ();
    } catch (e) { if (msg) msg.textContent = '⚠️ ' + (e.message || e); }
  };

  /* pastikan tab signal bisa dibuka walau nama fungsi berbeda */
  window.xauFocusGet = function () { return newsFocus; };
})();
