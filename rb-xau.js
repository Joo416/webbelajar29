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
  const xcut = (v, n) => String(v == null ? '' : v).slice(0, n || 240);
  const FOCUS = [
    { k: 'NFP', t: 'NFP', s: 'tenaga kerja' },
    { k: 'CPI', t: 'CPI', s: 'inflasi' },
    { k: 'PPI', t: 'PPI', s: 'harga produsen' },
    { k: 'FOMC', t: 'FOMC', s: 'suku bunga' }
  ];
  const NEWS_KEY = 'rb_xau_news_v4_';
  let newsFocus = 'NFP', newsData = null, newsBusy = false, newsClock = null, newsAutoT3 = false, newsGen = 0;
  /* Analisis News/Signal di-refresh tiap 20 menit. State hasilnya disimpan
     per akun (UID) di cache lokal + dokumen state Firestore yang sama. */
  const NEWS_REFRESH_MS = 20 * 60000;
  const SIG_REFRESH_MS = 20 * 60000;
  let newsTimer = null, newsAt = 0, newsCd = null, newsRetryAt = 0;
  function newsTransient(e) {
    const s = Number(e && e.status) || 0;
    return s === 429 || s === 503 || s === 502 || s === 500 || s === 504 || /429|firestore|izin akses|timeout|terlalu lama/i.test(String(e && e.message || ''));
  }
  let sigData = null, sigBusy = false, sigTimer = null, sigRO = null, sigAt = 0, sigMode = 'DAY', sigChartBars = 100, sigHistAt = 0;
  let sigRetryAt = 0, sigWake = false;
  let chartLabelAll = false, chartTF = 'ALL';
  try { chartLabelAll = localStorage.getItem('rb_xau_chart_labels') === 'all'; } catch (e) { }
  try { const tf = localStorage.getItem('rb_xau_chart_tf'); if (['ALL', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'].includes(tf)) chartTF = tf; } catch (e) { }
  let sigCd = null;
  const SIG_MODES = [['SCALPING', 'Scalping M5'], ['DAY', 'Day M5'], ['SWING', 'Swing M5']];
  const SIG_HIST_KEY = 'rb_xau_sig_hist_v2'; // cache lama tanpa akun (dimigrasi ke key per akun)
  const SIG_DEL_KEY = 'rb_xau_sig_del_v1';
  const SIG_CACHE_KEY = 'rb_xau_signal_v3';
  const SIG_MODE_KEY = 'rb_xau_sig_mode_v2';
  function sigCacheKey() { const u = histUid(); return SIG_CACHE_KEY + (u ? '_' + u : ''); }
  function sigCacheLoad() {
    try {
      const c = JSON.parse(localStorage.getItem(sigCacheKey()) || 'null');
      if (!c || !c.data || c.data.ok === false || c.data.error) return null;
      return c;
    } catch (e) { return null; }
  }
  function sigCacheSave(j) {
    try {
      const at = Date.parse(j.generatedAt) || Date.now();
      localStorage.setItem(sigCacheKey(), JSON.stringify({ at, savedAt: Date.now(), data: j }));
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
  function histUid() { try { return (typeof user !== 'undefined' && user && user.uid) ? user.uid : null; } catch (e) { return null; } }
  function histStoreKey() { const u = histUid(); return SIG_HIST_KEY + (u ? '_' + u : ''); }
  function histDelStoreKey() { const u = histUid(); return SIG_DEL_KEY + (u ? '_' + u : ''); }
  function histLoad() {
    try {
      const raw = localStorage.getItem(histStoreKey());
      if (raw) { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; }
      /* Migrasi sekali: riwayat lama tersimpan tanpa akun (per device).
         Setelah login, riwayat itu dipindah ke cache akun ini dan langsung
         disinkronkan ke Firestore, jadi data mengikuti akun, bukan perangkat. */
      if (histUid()) {
        const legacy = JSON.parse(localStorage.getItem(SIG_HIST_KEY) || '[]');
        if (Array.isArray(legacy) && legacy.length) {
          const arr = legacy.slice(0, 60);
          try { localStorage.setItem(histStoreKey(), JSON.stringify(arr)); localStorage.removeItem(SIG_HIST_KEY); } catch (e) { }
          return arr;
        }
      }
      return [];
    } catch (e) { return []; }
  }
  function histSave(a) { try { localStorage.setItem(histStoreKey(), JSON.stringify(a.slice(0, 60))); } catch (e) { } }
  function histDeletedLoad() { try { const a = JSON.parse(localStorage.getItem(histDelStoreKey()) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (e) { return []; } }
  function histDeletedSave(a) { try { localStorage.setItem(histDelStoreKey(), JSON.stringify([...new Set(a)].slice(0, 200))); } catch (e) { } }
  function histDeletedSet() { return new Set(histDeletedLoad()); }
  function histDocId(h) { return histUid() + '_sig_' + String(h.key || '').replace(/[\/]/g, '_').slice(0, 900); }
  function histTombDocId(key) { return histUid() + '_del_' + String(key || '').replace(/[\/]/g, '_').slice(0, 900); }
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
    const raw = { ...h, uid: histUid(), jenis: 'signal_history', updatedAt: h.updatedAt || Date.now() };
    delete raw._sync;
    Object.keys(raw).forEach(k => { if (raw[k] === undefined) delete raw[k]; });
    /* Firestore menolak field undefined bersarang; buang lewat JSON agar
       ctx/patternKeys yang tidak lengkap tidak membuat transaksi gagal. */
    try { return JSON.parse(JSON.stringify(raw)); } catch (e) { return raw; }
  }
  let histSyncState = 'lokal', histLastSyncAt = 0, histFilter = 'ALL';
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
      const ref = db.collection('jurnal').doc(histDocId(h));
      /* Transaksi membaca dokumen dulu. Ini menutup celah race: device lain
         yang baru mencapai TP/SL tidak ditimpa oleh cache lokal yang telat. */
      await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        const remote = snap && snap.exists ? (snap.data() || null) : null;
        if (remote && remote.jenis === 'signal_history' && histBetter(remote, h)) return;
        tx.set(ref, histClean(h), { merge: true });
      });
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
  let histRemoteStatus = new Map();
  let histRemoteUid = null;
  function histStatusRank(status) {
    const s = String(status || '').toUpperCase();
    /* TPMAX > TP2 > TP1 > SL: hasil profit yang lebih jauh tidak boleh
       ditimpa status SL lama dari perangkat lain. SL vs TPMAX tetap
       dibandingkan lewat closedAt di histBetter. */
    return s === 'TPMAX' ? 5 : s === 'TP2' ? 4 : s === 'TP1' ? 3 : s === 'SL' ? 2 : s === 'AKTIF' ? 1 : 0;
  }
  /* Remote menang bila statusnya lebih maju. Timestamp hanya dipakai untuk
     status yang sama; ini mencegah perangkat dengan jam lebih baru menimpa
     status TP/SL yang sudah tercapai di perangkat lain. */
  function histBetter(a, b) {
    if (!a) return false;
    if (!b) return true;
    const at = a.status === 'SL' || a.status === 'TPMAX';
    const bt = b.status === 'SL' || b.status === 'TPMAX';
    if (at && bt) {
      const ac = Date.parse(a.closedAt || '') || 0, bc = Date.parse(b.closedAt || '') || 0;
      if (ac !== bc) return ac > bc;
    }
    const ar = histStatusRank(a.status), br = histStatusRank(b.status);
    if (ar !== br) return ar > br;
    const au = Number(a.updatedAt) || 0, bu = Number(b.updatedAt) || 0;
    if (au !== bu) return au > bu;
    return (Date.parse(a.closedAt || '') || 0) > (Date.parse(b.closedAt || '') || 0);
  }
  /* Record yang baru menang dari Firestore. Evaluasi lokal dilewati sekali
     pada siklus ini agar status TP/SL dari perangkat lain tidak turun lagi. */
  let histRemoteNew = new Map();
  async function histPull() {
    if (histPullPromise) return histPullPromise;
    const uid = histUid();
    if (!uid || typeof db === 'undefined' || !db) { histSyncState = 'lokal'; return; }
    if (histRemoteUid !== uid) {
      histPulledAt = 0; histRemoteAt = new Map(); histRemoteStatus = new Map();
      histRemoteLoaded = false; histRemoteUid = uid;
    }
    if (Date.now() - histPulledAt < 30000) return;
    histPullPromise = (async function () {
      try {
        histSyncState = 'proses'; histRender();
        const snap = await db.collection('jurnal').where('uid', '==', uid).limit(300).get();
        const remote = new Map(), remoteDeleted = new Set(), remoteStatus = new Map(), tombLocal = histDeletedSet();
        snap.forEach(doc => {
          const d = doc.data() || {};
          if (d.jenis === 'signal_history_deleted' && d.key) { remoteDeleted.add(d.key); return; }
          if (d.jenis !== 'signal_history' || !d.key || !d.createdAt) return;
          if (tombLocal.has(d.key)) return;
          const h = { ...d };
          delete h.uid; delete h.updatedAt;
          h.updatedAt = Number(d.updatedAt) || 0;
          remote.set(h.key, h);
          remoteStatus.set(h.key, h.status);
        });
        const tomb = new Set([...tombLocal, ...remoteDeleted]);
        if (remoteDeleted.size) histDeletedSave([...tomb]);
        const rawBefore = histLoad();
        const before = new Map(rawBefore.filter(h => !tomb.has(h.key)).map(h => [h.key, h]));
        const local = new Map(before);
        const remoteNew = new Map();
        let changed = before.size !== rawBefore.length;
        remote.forEach((h, key) => {
          const l = before.get(key);
          const rAt = Number(h.updatedAt) || 0, lAt = Number(l && l.updatedAt) || 0;
          if (!l || histBetter(h, l)) {
            local.set(key, h); changed = true;
            remoteNew.set(key, rAt);
          }
        });
        const arr = [...local.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 60);
        if (changed) histSave(arr);
        histRemoteAt = new Map([...remote].map(([key, h]) => [key, Number(h.updatedAt) || 0]));
        histRemoteStatus = remoteStatus;
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
    if (!histRemoteLoaded || !histUid() || histRemoteUid !== histUid() || typeof db === 'undefined' || !db) return;
    const deleted = histDeletedSet();
    histLoad().forEach(h => {
      if (deleted.has(h.key)) return;
      const rAt = Number(histRemoteAt.get(h.key)) || 0;
      const rStatus = histRemoteStatus.get(h.key);
      const localAt = Number(h.updatedAt) || 0;
      const remoteTerminal = rStatus === 'SL' || rStatus === 'TPMAX';
      const localTerminal = h.status === 'SL' || h.status === 'TPMAX';
      const terminalConflict = !!(remoteTerminal && localTerminal && rStatus !== h.status);
      /* Jangan pernah mendorong status yang lebih rendah dari remote. */
      if (rStatus && !terminalConflict && histStatusRank(rStatus) > histStatusRank(h.status)) return;
      if (!rAt || terminalConflict || (rStatus === h.status && localAt > rAt + 1000) || (rStatus && histStatusRank(h.status) > histStatusRank(rStatus))) histPush(h);
    });
  }
  /* Tombstone per akun: penghapusan harus menang atas cache perangkat lain,
     bukan sekadar menghapus localStorage di perangkat ini. */
  async function histPushDeleted() {
    if (!histUid() || typeof db === 'undefined' || !db) return;
    const keys = histDeletedLoad();
    if (!keys.length) return;
    try {
      histSyncState = 'proses';
      for (const key of keys) {
        await db.collection('jurnal').doc(histTombDocId(key)).set({ uid: histUid(), jenis: 'signal_history_deleted', key, at: Date.now(), updatedAt: Date.now() }, { merge: true });
      }
      histSyncState = 'akun'; histLastSyncAt = Date.now(); histRender();
    } catch (e) {
      histSyncState = 'lokal'; histRender();
    }
  }
  async function histDelete(key) {
    if (!key) return;
    const decoded = (function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } })(key);
    const arr = histLoad().filter(h => h.key !== decoded);
    histSave(arr);
    const tom = histDeletedLoad(); if (!tom.includes(decoded)) tom.push(decoded); histDeletedSave(tom);
    histRemoteAt.delete(decoded); histRemoteNew.delete(decoded); histRemoteStatus.delete(decoded);
    histRender();
    toast('🗑️ Riwayat dihapus dari perangkat ini; menyinkronkan ke akun…');
    if (!histUid() || typeof db === 'undefined' || !db) return;
    try {
      await db.collection('jurnal').doc(histTombDocId(decoded)).set({ uid: histUid(), jenis: 'signal_history_deleted', key: decoded, at: Date.now(), updatedAt: Date.now() }, { merge: true });
      await db.collection('jurnal').doc(histDocId({ key: decoded })).delete();
      histSyncState = 'akun'; histLastSyncAt = Date.now(); histRender();
      toast('✅ Riwayat dihapus dari database akun.');
    } catch (e) {
      histSyncState = 'lokal'; histRender();
      toast('⚠️ Terhapus lokal; sinkron hapus akan dicoba lagi saat refresh.');
    }
  }
  window.pHistDelete = function (key) {
    if (!window.confirm('Hapus satu riwayat ini dari akun dan database? Tindakan ini tidak bisa dibatalkan.')) return;
    histDelete(key);
  };
  window.pHistFilter = function (f) {
    histFilter = ['ALL', 'ACTIVE', 'TP', 'SL', 'SHADOW'].includes(f) ? f : 'ALL';
    histRender();
  };
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
  async function radarStatePull() {
    const d = await stateGet('radar');
    if (!d || !d.data || d.data.ok === false || d.data.error) return false;
    const rAt = cacheAt(d.data) || Number(d.at) || 0;
    if (!rAt) return false;
    if (rAt > (radarAt || 0) + 1500) {
      radarData = d.data; radarAt = rAt; radarSavedAt = rAt; radarCacheSave(d.data);
      return true;
    }
    if (radarData && radarAt > rAt + 1500) {
      statePut('radar', null, radarData).then(ok => { if (ok) radarSavedAt = radarAt; }).catch(() => { });
    }
    return false;
  }
  /* Konteks yang disimpan saat entry. Ini bukti yang dipakai untuk
     menjelaskan TP/SL dan untuk pembelajaran pola, bukan narasi karangan. */
  function histCtx(j, s) {
    const setup = s || {};
    const macro = j && j.macro ? {
      dxy15m: j.macro.dxy15m, us10y15m: j.macro.us10y15m,
      dxy5d: j.macro.dxy5d, yield10_5d: j.macro.yield10_5d,
      gold1d: j.macro.gold1d, gold5d: j.macro.gold5d
    } : null;
    const tf = (j && j.tfMatrix ? j.tfMatrix : []).slice(0, 6).map(x => ({ tf: x.tf, rec: x.rec, value: x.value }));
    const risk = j && j.eventRisk ? { level: j.eventRisk.level || '', note: xcut(j.eventRisk.note, 180) } : null;
    const adr = j && j.adr ? { avgPips: j.adr.avgPips, todayPips: j.adr.todayPips, remainingPips: j.adr.remainingPips } : null;
    const ai = j && j.ai && j.ai.ok ? {
      model: xcut(j.ai.model || j.ai.provider || 'AI', 60),
      summary: xcut(j.ai.summary, 500),
      confluence: (j.ai.confluence || []).slice(0, 3).map(x => xcut(x, 140))
    } : null;
    return {
      price: j && j.price != null ? j.price : null,
      strength: j && j.directionStrength != null ? j.directionStrength : null,
      session: j && j.session && j.session.name ? j.session.name : '',
      daily: j && j.daily && j.daily.trend ? j.daily.trend : '',
      macro, risk, adr, tf,
      trigger: xcut(setup.trigger, 180), poi: setup.poiTf || setup.poi || '',
      bias: (setup.bias || []).slice(0, 4).map(x => x.tf + ' ' + x.rec + (x.trend ? '/' + x.trend : '')),
      targets: (setup.targets || []).slice(0, 4).map(t => ({ pips: t.pips, src: xcut(t.src, 90) })),
      check: j && j.checkScore != null ? j.checkScore : null,
      rr: setup.rr != null ? setup.rr : null,
      conf: setup.conf != null ? setup.conf : null,
      methods: j && j.methods ? {
        agreement: j.methods.agreement, agree: j.methods.agree, total: j.methods.total,
        against: (j.methods.against || []).slice(0, 4)
      } : null,
      learn: setup.learning ? { blocked: !!setup.learning.blocked, reasons: (setup.learning.reasons || []).slice(0, 3) } : null,
      smc: setup.smc ? {
        grade: setup.smc.grade || '', score: setup.smc.score,
        phase: setup.smc.phase || '', kill: !!(setup.smc.killzone && setup.smc.killzone.active),
        pd: setup.smc.pd && setup.smc.pd.zone || '',
        sweep: setup.smc.sweep && setup.smc.sweep.pool || '',
        fib: !!(setup.smc.fib && setup.smc.fib.ok),
        refined: setup.smc.refined ? setup.smc.refined.src : ''
      } : null,
      ai,
      sources: (j && j.sources ? j.sources : []).slice(0, 6).map(x => x.name + (x.ok === false ? ' (gagal)' : ''))
    };
  }
  function histMacroSide(ctx, dir) {
    const m = (ctx && ctx.macro) || {};
    let score = 0;
    const add = (v, w) => { const n = Number(v); if (isFinite(n)) score += n * w; };
    add(m.dxy15m, -0.35); add(m.us10y15m, -2); add(m.dxy5d, -0.25); add(m.yield10_5d, -0.8);
    if (Math.abs(score) < 0.15) return 'netral';
    return score * (dir === 'BUY' ? 1 : -1) >= 0.15 ? 'mendukung' : 'melawan';
  }
  function histTfSide(ctx, dir) {
    const sign = dir === 'BUY' ? 1 : -1;
    let aligned = 0, opposed = 0;
    (ctx && ctx.tf || []).forEach(x => {
      const v = Number(x.value);
      if (!isFinite(v) || Math.abs(v) < 0.05) return;
      if (v * sign > 0) aligned++; else opposed++;
    });
    return aligned === opposed ? 'campuran' : aligned > opposed ? 'mendukung' : 'melawan';
  }
  function histTriggerKind(v) {
    const t = String(v || '');
    if (/\bBOS\b/i.test(t)) return 'BOS';
    if (/sweep|sapuan/i.test(t)) return 'SWEEP';
    if (/FVG/i.test(t)) return 'FVG';
    if (/\bOB\b|order block/i.test(t)) return 'OB';
    if (/engulf/i.test(t)) return 'ENGULF';
    return 'TRIGGER';
  }
  function histPatternKeys(h) {
    const ctx = (h && h.ctx) || {};
    const style = String((h && h.style) || '?');
    const dir = String((h && h.dir) || '?');
    const poi = String(ctx.poi || (h && h.poi) || '?');
    const trig = histTriggerKind(ctx.trigger || (h && h.trigger) || (h && h.why));
    const sess = String(ctx.session || '?');
    const macro = histMacroSide(ctx, dir);
    const risk = String(ctx.risk && ctx.risk.level || '?');
    const htf = histTfSide(ctx, dir);
    const smc = ctx.smc || {};
    const grade = String(smc.grade || '?').toUpperCase();
    const phase = String(smc.phase || '?').toUpperCase();
    const kill = smc.kill ? 'YA' : 'TIDAK';
    const pd = String(smc.pd || '?').toUpperCase();
    return [...new Set([
      [style, dir, poi, trig, sess, macro, risk, htf, grade, phase, kill, pd].join('|'),
      [style, dir, poi, trig, sess, macro, risk, htf].join('|'),
      [style, dir, poi, trig, macro, risk].join('|'),
      [style, dir, risk].join('|'),
      [style, dir].join('|')
    ])];
  }
  function histDateKey(iso) {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return '0000-00-00';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function histDateLabel(iso) {
    const key = histDateKey(iso);
    const now = new Date();
    const today = histDateKey(now.toISOString());
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (key === today) return 'Hari ini';
    if (key === histDateKey(y.toISOString())) return 'Kemarin';
    const d = new Date(iso);
    return isFinite(d.getTime()) ? d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanggal tidak diketahui';
  }
  function histMacroText(ctx) {
    if (!ctx || !ctx.macro) return 'Konteks makro tidak tersimpan untuk entry lama.';
    const m = ctx.macro, out = [];
    if (m.dxy15m != null) out.push('DXY 15m ' + Number(m.dxy15m).toFixed(2) + '%');
    if (m.us10y15m != null) out.push('yield 10Y 15m ' + Number(m.us10y15m).toFixed(2) + ' pp');
    if (m.dxy5d != null) out.push('DXY 5d ' + Number(m.dxy5d).toFixed(2) + '%');
    if (m.yield10_5d != null) out.push('yield 10Y 5d ' + Number(m.yield10_5d).toFixed(2) + ' pp');
    if (m.gold1d != null) out.push('emas 1d ' + Number(m.gold1d).toFixed(2) + '%');
    return out.length ? out.join(' · ') : 'Data makro tersimpan tetapi nilainya kosong.';
  }
  function histFailure(h) {
    const ctx = h.ctx || {};
    const out = [];
    if (histMacroSide(ctx, h.dir) === 'melawan') out.push('DXY/yield bergerak melawan arah entry saat entry dibuka.');
    if (histTfSide(ctx, h.dir) === 'melawan') out.push('Matriks TF saat entry lebih banyak melawan arah ' + h.dir + '.');
    if (ctx.methods && (ctx.methods.against || []).length) out.push('Metode ' + ctx.methods.against.join(', ') + ' melawan arah entry saat sinyal.');
    if (ctx.methods && ctx.methods.agreement != null && ctx.methods.agreement < 40) out.push('Konfluensi metode hanya ' + ctx.methods.agreement + '% (' + (ctx.methods.agree || 0) + '/' + (ctx.methods.total || 0) + ' searah).');
    if (ctx.learn && Array.isArray(ctx.learn.reasons) && ctx.learn.reasons.length) out.push('Pelajaran saat entry: ' + ctx.learn.reasons.join('; ') + '.');
    if (ctx.risk && ctx.risk.level === 'TINGGI') out.push('Risiko rilis tinggi: ' + (ctx.risk.note || 'spread/volatilitas dapat melebarkan SL.'));
    if (ctx.adr && Number(ctx.adr.remainingPips) < 60) out.push('Sisa ruang ADR hanya ' + ctx.adr.remainingPips + ' pip saat entry.');
    if (ctx.smc && ctx.smc.kill === false) out.push('Entry diambil di luar kill zone London/New York.');
    if (ctx.smc && ctx.smc.pd && ((h.dir === 'SELL' && ctx.smc.pd === 'discount') || (h.dir === 'BUY' && ctx.smc.pd === 'premium'))) out.push('Arah ' + h.dir + ' diambil di zona ' + ctx.smc.pd + ' (melawan aturan premium/discount 50%).');
    if (ctx.smc && ctx.smc.grade === 'D') out.push('SMC saat entry grade D: syarat wajib belum lengkap.');
    if (ctx.poi) out.push('POI ' + ctx.poi + ' tidak bertahan; harga menembus SL 30 pip.');
    const tgt = (ctx.targets || []).filter(t => Number(t.pips) >= 200).slice(-1)[0];
    if (tgt) out.push('Target TP2 ' + (tgt.src || (tgt.pips + ' pip')) + ' tidak tercapai. Jangan turunkan TP2 di bawah 200 pip; pelajari sumber target ini lalu pilih likuiditas yang lebih dekat/valid pada setup berikutnya.');
    if (!out.length) out.push('Tidak ada faktor global yang tersimpan sebagai penyebab tunggal; SL ini murni invalidasi teknikal 30 pip.');
    return out;
  }
  function histSuccess(h) {
    const ctx = h.ctx || {};
    const out = [];
    if (histMacroSide(ctx, h.dir) === 'mendukung') out.push('DXY/yield mendukung arah ' + h.dir + ' saat entry.');
    if (histTfSide(ctx, h.dir) === 'mendukung') out.push('Matriks TF mayoritas searah ' + h.dir + '.');
    if (ctx.methods && ctx.methods.agreement != null) out.push('Konfluensi ' + ctx.methods.agreement + '% (' + (ctx.methods.agree || 0) + '/' + (ctx.methods.total || 0) + ' metode searah).');
    const tgt = (ctx.targets || []).filter(t => Number(t.pips) >= 200).slice(-1)[0];
    if (tgt) out.push('TP diambil dari likuiditas/proyeksi: ' + (tgt.src || (tgt.pips + ' pip')) + '.');
    if (ctx.rr != null) out.push('RR ' + ctx.rr + ':1 dengan SL 30 pip.');
    if (ctx.smc && (ctx.smc.grade === 'A+' || ctx.smc.grade === 'A')) out.push('SMC ' + ctx.smc.grade + ' · PD ' + (ctx.smc.pd || '—') + ' · fase AMD ' + (ctx.smc.phase || '—') + (ctx.smc.refined ? ' · refine ' + ctx.smc.refined : '') + '.');
    if (ctx.ai && ctx.ai.confluence && ctx.ai.confluence.length) out.push('Konfluensi: ' + ctx.ai.confluence.join('; ') + '.');
    if (!out.length) out.push('TP tercapai dari level yang tercatat saat entry; tidak ada klaim sebab tambahan tanpa data.');
    return out;
  }
  function learningProfile() {
    const map = new Map();
    const deleted = histDeletedSet();
    histLoad().filter(h => !deleted.has(h.key)).forEach(h => {
      const st = String(h.status || '');
      if (!['SL', 'TP1', 'TP2', 'TPMAX'].includes(st)) return;
      const win = st !== 'SL';
      /* Observasi yang belum dieksekusi (paper) dipisah: hasilnya boleh
         menurunkan keyakinan, tetapi tidak boleh memblokir entry sendirian.
         Blokir hanya dari trade nyata (SIAP) agar mesin tidak terkunci oleh
         rencana yang memang belum pernah dieksekusi. */
      const paper = !!h.paper;
      (Array.isArray(h.patternKeys) && h.patternKeys.length ? h.patternKeys : histPatternKeys(h)).forEach(k => {
        const o = map.get(k) || { n: 0, w: 0, l: 0, pl: 0, last: 0 };
        o.n++;
        if (win) o.w++; else if (paper) o.pl++; else o.l++;
        o.last = Math.max(o.last, Date.parse(h.closedAt || '') || Number(h.updatedAt) || 0);
        map.set(k, o);
      });
    });
    return map;
  }
  /* Catatan hasil mentah (SL/TP) untuk mesin belajar bersama. Server yang
     menghitung statistiknya, jadi tidak ada angka hasil yang dikarang klien. */
  function learnRecords() {
    const deleted = histDeletedSet();
    return histLoad()
      .filter(h => !deleted.has(h.key) && ['SL', 'TP1', 'TP2', 'TPMAX'].includes(String(h.status || '')))
      .sort((a, b) => (Date.parse(b.closedAt || '') || Number(b.updatedAt) || 0) - (Date.parse(a.closedAt || '') || Number(a.updatedAt) || 0))
      .slice(0, 200)
      .map(h => {
        const ctx = h.ctx || {};
        const conf = Number(ctx.conf);
        const ma = Number(ctx.methods && ctx.methods.agreement);
        const outcome = h.status === 'TPMAX' ? 'TPMAX' : h.status === 'TP2' ? 'TP2' : h.status === 'TP1' ? 'TP1' : 'SL';
        return {
          r: outcome === 'SL' ? 'SL' : 'TP',
          result: outcome, paper: !!h.paper,
          dir: h.dir, style: h.style,
          poi: ctx.poi || h.poi || '',
          trigger: histTriggerKind(ctx.trigger || h.trigger || h.why),
          session: ctx.session || '',
          macro: histMacroSide(ctx, h.dir),
          risk: (ctx.risk && ctx.risk.level) || '',
          htf: histTfSide(ctx, h.dir),
          smc: (ctx.smc && ctx.smc.grade) || '',
          phase: (ctx.smc && ctx.smc.phase) || '',
          kill: ctx.smc && ctx.smc.kill ? 'ya' : 'tidak',
          pd: (ctx.smc && ctx.smc.pd) || '',
          method: isFinite(ma) ? (ma >= 70 ? 'tinggi' : ma >= 50 ? 'sedang' : 'rendah') : '',
          target: ((ctx.targets || []).filter(t => Number(t.pips) >= 200).slice(-1)[0] || {}).src || '',
          conf: isFinite(conf) ? conf : null,
          at: Date.parse(h.closedAt || '') || Number(h.updatedAt) || 0
        };
      });
  }

  /* ---------- Pembelajaran news & radar (otomatis, per akun) ---------- */
  const NEWS_LEARN_KEY = 'rb_xau_news_learn_v1';
  const RADAR_LEARN_KEY = 'rb_xau_radar_learn_v1';
  function newsLearnStoreKey() { const u = histUid(); return NEWS_LEARN_KEY + (u ? '_' + u : ''); }
  function newsLearnLoad() { try { const a = JSON.parse(localStorage.getItem(newsLearnStoreKey()) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.f && x.ts) : []; } catch (e) { return []; } }
  function newsLearnSave(a) { try { localStorage.setItem(newsLearnStoreKey(), JSON.stringify(a.slice(0, 80))); } catch (e) { } }
  function newsLearnRecords() {
    return newsLearnLoad().map(x => ({
      f: x.f, ts: x.ts, p: x.p || '', a: x.a || '', pc: x.pc || '',
      ok: typeof x.ok === 'boolean' ? x.ok : null,
      pok: typeof x.pok === 'boolean' ? x.pok : null,
      at: Number(x.at) || Number(x.ts) || 0
    }));
  }
  function newsLearnSync(j) {
    if (!j || j.ok === false || !j.focus || !j.event) return;
    const ts = j.event.ts ? Date.parse(j.event.ts) : NaN;
    if (!isFinite(ts)) return;
    const arr = newsLearnLoad();
    const i = arr.findIndex(x => x.f === j.focus && Number(x.ts) === ts);
    const cur = i >= 0 ? arr[i] : null;
    const t = j.timing || {};
    const pred = /^(BUY|SELL)$/.test(String(t.dir || '')) ? String(t.dir) : '';
    const now = Date.now();
    /* 1) Simpan prakiraan pra-rilis sebagai bukti, sekali per event. */
    if (pred && now < ts && (t.preWindow || /PRA-RILIS|SIAP-SIAGA|MENUNGGU/.test(String(t.status || '')))) {
      if (!cur || cur.ok == null) {
        const rec = {
          f: j.focus, ts, p: pred, a: '', ok: null,
          pc: j.aiPanel && /^(BUY|SELL)$/.test(String(j.aiPanel.consensus || '')) ? j.aiPanel.consensus : '',
          at: Date.parse(j.generatedAt) || now, c: Number(t.confidence) || null
        };
        if (i >= 0) arr[i] = rec; else arr.unshift(rec);
        newsLearnSave(arr);
        learnDirty.news = true;
        learnPush('news').catch(function () { });
      }
      return;
    }
    /* 2) Setelah rilis: bandingkan prakiraan dengan reaksi nyata, bukan tebakan. */
    if (now < ts + 5 * 60000 || !cur || !cur.p || cur.ok != null) return;
    const react = j.reaction;
    const actual = react && /^(BUY|SELL)$/.test(String(react.dir || '')) ? react.dir : '';
    if (!actual) return;
    cur.a = actual;
    cur.ok = actual === cur.p;
    if (cur.pc === 'BUY' || cur.pc === 'SELL') cur.pok = cur.pc === actual;
    cur.eAt = now;
    newsLearnSave(arr);
    learnDirty.news = true;
    learnPush('news').catch(function () { });
  }
  function radarLearnStoreKey() { const u = histUid(); return RADAR_LEARN_KEY + (u ? '_' + u : ''); }
  function radarLearnLoad() { try { const a = JSON.parse(localStorage.getItem(radarLearnStoreKey()) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.dir && x.at) : []; } catch (e) { return []; } }
  function radarLearnSave(a) { try { localStorage.setItem(radarLearnStoreKey(), JSON.stringify(a.slice(0, 160))); } catch (e) { } }
  function radarLearnRecords() {
    return radarLearnLoad().map(x => ({ dir: x.dir, ok: typeof x.ok === 'boolean' ? x.ok : null, ag: x.ag == null ? null : x.ag, at: Number(x.at) || 0 }));
  }
  function radarLearnSync(j) {
    if (!j || j.ok === false) return;
    const arr = radarLearnLoad();
    const beforeSig = JSON.stringify(arr);
    const now = Date.now(), px = Number(j.price);
    /* Evaluasi prakiraan yang horizonnya sudah lewat dengan harga radar baru. */
    arr.forEach(x => {
      if (!x || x.ok != null || !x.due || now < x.due) return;
      /* Jangan menilai prakiraan yang sudah lewat jauh dari horizon: harga
         saat itu bukan harga 10 menit, jadi hasilnya bisa keliru. */
      if (now > x.due + 15 * 60000) return;
      if (!(px > 0) || !(Number(x.price) > 0)) return;
      x.actual = px > x.price ? 'BUY' : px < x.price ? 'SELL' : 'FLAT';
      x.ok = x.actual === x.dir;
      x.eAt = now;
    });
    const dir = String(j.direction || '').toUpperCase();
    /* Satu sampel radar per 10 menit. Refresh 60 detik tetap berjalan untuk
       tampilan, tetapi prakiraan yang tumpang tindih tidak dicatat berulang. */
    const lastRadarRec = arr.reduce((m, x) => Math.max(m, Number(x.at) || 0), 0);
    if ((dir === 'BUY' || dir === 'SELL') && Number(j.confidence) >= 55 && j.generatedAt
      && (!lastRadarRec || now - lastRadarRec >= 10 * 60000)
      && !arr.some(x => x.gen === j.generatedAt)) {
      arr.unshift({ dir, c: Number(j.confidence), ag: Number(j.agreement) || null, price: px, at: now, due: now + 10 * 60000, gen: j.generatedAt, ok: null });
    }
    const next = arr.filter(x => {
      if (!x || !(Number(x.at) > now - 30 * 86400000)) return false;
      /* Buang yang tidak sempat dievaluasi tepat waktu, jangan diklaim. */
      if (x.ok == null && x.due && now > x.due + 15 * 60000) return false;
      return true;
    });
    radarLearnSave(next);
    if (JSON.stringify(next) !== beforeSig) learnDirty.radar = true;
    if (learnDirty.radar) learnPush('radar').catch(function () { });
  }

  /* ---------- Pembelajaran sumber global (web/YouTube terpercaya) ----------
     Setiap judul yang punya kecenderungan arah dicatat sekali beserta harga
     saat itu. Setelah 60 menit arahnya dibandingkan dengan harga nyata, jadi
     server bisa menimbang sumber mana yang berulang benar. Arah sinyal tidak
     pernah diubah oleh pencatatan ini; hanya keyakinan yang boleh bergeser. */
  const SOURCE_LEARN_KEY = 'rb_xau_source_learn_v1';
  const SOURCE_HORIZON_MS = 60 * 60000;
  function sourceLearnStoreKey() { const u = histUid(); return SOURCE_LEARN_KEY + (u ? '_' + u : ''); }
  function sourceLearnLoad() { try { const a = JSON.parse(localStorage.getItem(sourceLearnStoreKey()) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.id && x.s && x.p && x.at) : []; } catch (e) { return []; } }
  function sourceLearnSave(a) { try { localStorage.setItem(sourceLearnStoreKey(), JSON.stringify(a.slice(0, 300))); } catch (e) { } }
  function sourceLearnRecords() {
    return sourceLearnLoad().map(x => ({ s: x.s, p: x.p, ok: typeof x.ok === 'boolean' ? x.ok : null, at: Number(x.at) || 0 }));
  }
  function sourceLearnSync(j) {
    if (!j || j.ok === false) return;
    const arr = sourceLearnLoad();
    const before = JSON.stringify(arr);
    const now = Date.now(), px = Number(j.price);
    /* Evaluasi hanya bila horizon sudah lewat dan harga masih dekat horizon. */
    arr.forEach(x => {
      if (!x || x.ok != null || !x.due || now < x.due) return;
      if (now > x.due + 120 * 60000) return;
      if (!(px > 0) || !(Number(x.price) > 0)) return;
      x.actual = px > x.price ? 'BUY' : px < x.price ? 'SELL' : 'FLAT';
      x.ok = x.actual === x.p;
      x.eAt = now;
    });
    /* Catat judul yang benar-benar dikirim mesin, bukan judul dari daftar lain. */
    ((j.knowledge && Array.isArray(j.knowledge.items)) ? j.knowledge.items : []).forEach(it => {
      if (!it || !it.id || !it.sid || !(px > 0)) return;
      const lean = String(it.lean || '').toLowerCase();
      const p = lean === 'bullish' ? 'BUY' : lean === 'bearish' ? 'SELL' : '';
      if (!p) return;
      if (arr.some(x => x && x.id === it.id)) return;
      arr.unshift({ id: String(it.id), s: String(it.sid), p, price: px, at: now, due: now + SOURCE_HORIZON_MS, ok: null });
    });
    const next = arr.filter(x => x && Number(x.at) > now - 60 * 86400000 && !(x.ok == null && x.due && now > x.due + 120 * 60000)).slice(0, 300);
    sourceLearnSave(next);
    if (JSON.stringify(next) !== before) learnDirty.source = true;
    if (learnDirty.source) learnPush('source').catch(function () { });
  }

  /* ---------- Sinkronisasi catatan belajar news/radar/sumber ke akun ----------
     Disimpan di koleksi jurnal (diizinkan aturan Firestore) sebagai dokumen
     state per akun. Tidak menyentuh arah sinyal: catatan ini hanya dipakai
     server untuk menyesuaikan keyakinan. Penggabungan memakai transaksi agar
     dua perangkat tidak saling menimpa catatan yang sudah dievaluasi. */
  const LEARN_SYNC_MS = 30000;
  let learnPullAt = { news: 0, radar: 0, source: 0 }, learnPullBusy = { news: null, radar: null, source: null }, learnPushedAt = { news: 0, radar: 0, source: 0 };
  const learnDirty = { news: false, radar: false, source: false };
  function learnStore(kind) {
    if (kind === 'news') return { load: newsLearnLoad, save: newsLearnSave, max: 80 };
    if (kind === 'radar') return { load: radarLearnLoad, save: radarLearnSave, max: 160 };
    return { load: sourceLearnLoad, save: sourceLearnSave, max: 300 };
  }
  function learnRef(kind) {
    const uid = histUid();
    if (!uid || typeof db === 'undefined' || !db) return null;
    return db.collection('jurnal').doc(uid + '_state_' + kind + 'learn');
  }
  function learnClean(a) { try { return JSON.parse(JSON.stringify(a)); } catch (e) { return a; } }
  function learnKey(kind, x) {
    if (kind === 'news') return String(x && x.f || '') + '|' + String(x && x.ts || '');
    if (kind === 'source') return String(x && x.s || '') + '|' + String(x && x.id || '');
    return String(x && x.gen || '') || (String(x && x.dir || '') + '|' + String(x && x.at || ''));
  }
  function learnBetter(kind, a, b) {
    if (!a) return false;
    if (!b) return true;
    const ae = typeof a.ok === 'boolean', be = typeof b.ok === 'boolean';
    if (ae !== be) return ae;
    const ax = Number(a.eAt) || 0, bx = Number(b.eAt) || 0;
    if (ax !== bx) return ax > bx;
    return (Number(a.at) || 0) > (Number(b.at) || 0);
  }
  function learnMerge(kind, local, remote) {
    const map = new Map();
    (Array.isArray(remote) ? remote : []).forEach(x => { if (x && typeof x === 'object') map.set(learnKey(kind, x), x); });
    (Array.isArray(local) ? local : []).forEach(x => {
      if (!x || typeof x !== 'object') return;
      const k = learnKey(kind, x), r = map.get(k);
      if (!r || learnBetter(kind, x, r)) map.set(k, x);
    });
    return [...map.values()]
      .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
      .slice(0, learnStore(kind).max);
  }
  async function learnPull(kind) {
    const ref = learnRef(kind);
    if (!ref) return null;
    if (learnPullBusy[kind]) return learnPullBusy[kind];
    if (Date.now() - (learnPullAt[kind] || 0) < LEARN_SYNC_MS) return null;
    const load = learnStore(kind).load;
    const save = learnStore(kind).save;
    learnPullBusy[kind] = (async function () {
      try {
        const snap = await ref.get();
        const d = snap && snap.exists ? (snap.data() || {}) : {};
        if (d.jenis && d.jenis !== 'xau_' + kind + 'learn_state') return null;
        const remote = Array.isArray(d.data) ? d.data : [];
        const merged = learnMerge(kind, load(), remote);
        save(merged);
        learnPullAt[kind] = Date.now();
        if (JSON.stringify(merged) !== JSON.stringify(remote)) learnPush(kind, true).catch(function () { });
        return merged;
      } catch (e) {
        learnPullAt[kind] = Date.now();
        return null;
      } finally {
        learnPullBusy[kind] = null;
      }
    })();
    return learnPullBusy[kind];
  }
  async function learnPush(kind, force) {
    const ref = learnRef(kind);
    if (!ref) return false;
    const load = learnStore(kind).load;
    const save = learnStore(kind).save;
    if (!load().length) return false;
    if (!force && !learnDirty[kind]) return false;
    if (!force && Date.now() - (learnPushedAt[kind] || 0) < 4000) return false;
    learnPushedAt[kind] = Date.now();
    let out = null;
    try {
      await db.runTransaction(async function (tx) {
        const snap = await tx.get(ref);
        const d = snap && snap.exists ? (snap.data() || {}) : {};
        if (d.jenis && d.jenis !== 'xau_' + kind + 'learn_state') return;
        const merged = learnMerge(kind, load(), Array.isArray(d.data) ? d.data : []);
        tx.set(ref, {
          uid: histUid(), jenis: 'xau_' + kind + 'learn_state',
          data: learnClean(merged), at: Date.now(), updatedAt: Date.now()
        }, { merge: true });
        out = merged;
      });
      if (out) save(out);
      learnDirty[kind] = false;
      return true;
    } catch (e) { return false; }
  }
  function learnPullSafe(kind) {
    return Promise.race([
      learnPull(kind),
      new Promise(function (r) { setTimeout(function () { r(null); }, 6000); })
    ]).catch(function () { return null; });
  }
  function learnForNews() {
    const news = newsLearnRecords(), radar = radarLearnRecords(), sources = sourceLearnRecords();
    return news.length || radar.length || sources.length ? { version: 3, news, radar, sources } : null;
  }
  function learnForRadar() {
    const radar = radarLearnRecords(), news = newsLearnRecords(), sources = sourceLearnRecords();
    return radar.length || news.length || sources.length ? { version: 3, radar, news, sources } : null;
  }
  function learnPayload() {
    const patterns = [...learningProfile().entries()]
      .filter(([key, s]) => s.n >= 1 && String(key).split('|').length >= 2)
      .sort((a, b) => (b[1].last || 0) - (a[1].last || 0) || b[1].n - a[1].n)
      .slice(0, 120)
      .map(([key, s]) => ({ key, n: s.n, w: s.w, l: s.l, last: s.last || 0 }));
    const records = learnRecords(), news = newsLearnRecords(), radar = radarLearnRecords(), sources = sourceLearnRecords();
    if (!patterns.length && !records.length && !news.length && !radar.length && !sources.length) return null;
    return { version: 3, patterns, records, news, radar, sources };
  }
  function histPatternLabel(k) {
    const p = String(k || '').split('|');
    return [p[0], p[1], p[2] ? 'POI ' + p[2] : '', p[3], p[4] ? 'sesi ' + p[4] : '', p[5] ? 'makro ' + p[5] : '', p[6] ? 'risiko ' + p[6] : '', p[7] ? 'TF ' + p[7] : ''].filter(Boolean).join(' · ');
  }
  function learnApply(j) {
    if (!j || !Array.isArray(j.setups)) return j;
    const profile = learningProfile();
    let blocked = 0, warned = 0;
    j.setups.forEach(s => {
      if (!s || s.status === 'LEWAT') return;
      const serverLearn = s.learning || null;
      const serverBlocked = !!(serverLearn && serverLearn.blocked);
      const ctx = histCtx(j, s);
      const keys = histPatternKeys({ style: s.style, dir: s.dir, poi: s.poiTf, trigger: s.trigger, ctx });
      const exact = profile.get(keys[0]) || null;
      let best = null, bestKey = '';
      keys.forEach(k => { const st = profile.get(k); if (st && (!best || st.n > best.n || (st.n === best.n && st.l > best.l))) { best = st; bestKey = k; } });
      const recent = (st) => !!st && st.last > 0 && Date.now() - st.last < 7 * 86400000;
      const stop = serverBlocked || !!((exact && exact.l >= 1 && exact.w === 0 && recent(exact)) || (best && best.n >= 2 && best.l >= 2 && best.w === 0 && recent(best)) || (best && best.n >= 3 && best.l / best.n >= 0.6 && best.w === 0 && recent(best)));
      const warn = !!(!stop && best && (best.l > 0 || best.pl > 0));
      const wasReady = s.status === 'SIAP';
      s.learning = stop || warn ? {
        blocked: stop, warn,
        n: best ? best.n : Number(serverLearn && serverLearn.n) || 0,
        wins: best ? best.w : Number(serverLearn && serverLearn.wins) || 0,
        losses: best ? best.l : Number(serverLearn && serverLearn.losses) || 0,
        key: bestKey || keys[0],
        label: serverBlocked && serverLearn && serverLearn.label ? serverLearn.label : histPatternLabel(bestKey || keys[0]),
        reasons: serverLearn && Array.isArray(serverLearn.reasons) ? serverLearn.reasons.slice(0, 3) : [],
        note: stop ? (serverBlocked && serverLearn.note ? serverLearn.note : 'Pola ini SL dalam 7 hari terakhir; entry ditahan sementara. Evaluasi ulang setelah konteks berubah atau 7 hari.') : 'Pola ini pernah SL; konfirmasi ekstra wajib sebelum entry.'
      } : null;
      if (stop) {
        blocked++;
        if (wasReady) {
          s.status = 'TUNGGU';
          s.conf = Math.max(30, Number(s.conf || 0) - 12);
          s.statusWhy = '[Pembelajaran otomatis] ' + s.learning.note + (s.statusWhy ? ' ' + s.statusWhy : '');
        }
      } else if (warn && wasReady) {
        warned++;
        s.conf = Math.max(30, Number(s.conf || 0) - 4);
      }
    });
    const deleted = histDeletedSet();
    const serverSummary = j.learning || {};
    j.learning = { ...serverSummary, total: histLoad().filter(h => !deleted.has(h.key) && ['SL', 'TP1', 'TP2', 'TPMAX'].includes(h.status)).length, blocked: Math.max(blocked, Number(serverSummary.blocked) || 0), warned: Math.max(warned, Number(serverSummary.warned) || 0), patterns: Math.max(Number(serverSummary.patterns) || 0, learningProfile().size) };
    return j;
  }
  function histRecord(j) {
    const arr = histLoad();
    const deleted = histDeletedSet();
    const fresh = [];
    (j.setups || []).forEach(s => {
      /* Observasi: setup TUNGGU yang levelnya sudah valid tetap dipantau tanpa
         dieksekusi. Tanpa ini mesin tidak punya data untuk belajar dan
         status bisa TUNGGU selamanya. Hasil observasi dinilai candle M5 dan
         masuk ke pembelajaran sebagai bukti, bukan sebagai trade nyata. */
      const blockedObs = !!(s.learning && s.learning.blocked);
      const paper = !blockedObs && s.status === 'TUNGGU' && s.entry != null && s.sl != null && s.tp2 != null;
      const shadow = blockedObs || paper;
      if (s.status !== 'SIAP' && !shadow) return;
      const tp2Pips = Number(s.tp2Pips != null ? s.tp2Pips : Math.round(Math.abs(Number(s.tp2) - Number(s.entry)) / 0.1));
      if (!(tp2Pips >= 200)) return;
      const key = histKey(s, j) + (shadow ? '|S' : '');
      if (deleted.has(key)) return;
      const existing = arr.find(h => h.key === key);
      if (existing) {
        /* Observasi yang sudah ditahan bisa dipromosikan menjadi entry nyata
           setelah pola pulih; hasil yang sudah final tidak diubah. */
        if (!shadow && existing.shadow && !['SL', 'TP1', 'TP2', 'TPMAX'].includes(existing.status)) {
          existing.shadow = false; existing.status = 'AKTIF'; existing.why = String(existing.why || '').replace(/^\[Observasi pembelajaran\]\s*/, ''); existing.reason = 'Pola pulih dari pembelajaran; entry kembali aktif.'; existing.updatedAt = Date.now();
        }
        return;
      }
      const rec = {
        key, style: s.style, dir: s.dir, entry: s.entry, sl: s.sl, tp1: s.tp1, tp2: s.tp2, tpMax: s.tpMax,
        poi: s.poiTf || s.poi, why: (blockedObs ? '[Observasi pembelajaran] ' : paper ? '[Observasi belajar · belum tereksekusi] ' : '') + s.why, invalidation: s.invalidation,
        createdAt: j.generatedAt || new Date().toISOString(), createdPrice: j.price,
        status: shadow ? 'SHADOW' : 'AKTIF', shadow, paper,
        entryHit: s.type === 'MARKET', hitAt: s.type === 'MARKET' ? (j.generatedAt || new Date().toISOString()) : null,
        tp1Hit: false, tp2Hit: false, maxHit: false, closedAt: null, pips: null, updatedAt: Date.now(),
        reason: blockedObs ? 'Observasi: pola pernah SL; entry tidak dieksekusi tetapi hasilnya tetap dipantau untuk pembelajaran.' : paper ? 'Observasi belajar: setup belum lolos syarat eksekusi (' + String(s.statusWhy || '').slice(0, 120) + '). Level tetap diuji candle M5 agar mesin punya data.' : s.type === 'MARKET' ? 'Entry market saat sinyal SIAP terbentuk.' : 'Menunggu harga menyentuh entry ' + s.entry + '.'
      };
      rec.ctx = histCtx(j, s);
      rec.patternKeys = histPatternKeys(rec);
      arr.unshift(rec);
      /* Jangan biarkan observasi memenuhi seluruh riwayat 60 record. */
      const shadows = arr.filter(h => h.shadow);
      if (shadow && shadows.length > 16) shadows.slice(16).forEach(h => { const i = arr.indexOf(h); if (i >= 0) arr.splice(i, 1); });
      fresh.push(rec);
    });
    histSave(arr);
    return arr;
  }
  function histUpdate(j) {
    const arr = histRecord(j);
    const deleted = histDeletedSet();
    const before = new Map(arr.map(h => [h.key, JSON.stringify(h)]));
    /* Riwayat hanya dievaluasi dari candle M5. Jangan memakai M15 sebagai
       pengganti karena SL/TP entry M5 bisa terbaca salah. */
    const rows = ((j.chart && j.chart.m5) || []).slice().sort((a, b) => a.t - b.t);
    const chartAt = Date.parse(j.generatedAt) || Date.now();
    let changed = false;
    arr.forEach(h => {
      if (deleted.has(h.key)) return;
      /* Hasil dari perangkat lain hanya boleh dievaluasi ulang jika candle
         yang dipakai benar-benar lebih baru dari status remote tersebut. */
      const remoteAt = Number(histRemoteAt.get(h.key)) || 0;
      if (histRemoteNew.has(h.key)) return;
      const remoteStatus = histRemoteStatus.get(h.key);
      if (remoteStatus && histStatusRank(remoteStatus) > histStatusRank(h.status)) return;
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
        const buy = h.dir === 'BUY';
        const hitSl = buy ? r.l <= h.sl : r.h >= h.sl;
        const hitTp2 = buy ? r.h >= h.tp2 : r.l <= h.tp2;
        const hitMax = h.tpMax != null && h.tpMax !== h.tp2 && (buy ? r.h >= h.tpMax : r.l <= h.tpMax);
        /* TP2 adalah target pertama yang ditampilkan setelah TP1 dihapus.
           Setelah TP2 kena, runner tetap dipantau sampai TPmax. */
        if (!h.tp2Hit && hitSl) {
          h.status = 'SL'; h.closedAt = at; h.pips = -Math.round(Math.abs(h.entry - h.sl) / 0.1);
          h.reason = (h.shadow ? 'Observasi (tidak dieksekusi): ' : '') + 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + (buy ? ' low ' + Number(r.l).toFixed(2) : ' high ' + Number(r.h).toFixed(2)) + ' menembus SL ' + h.sl + '. Entry ' + h.entry + ' gagal; SL 30 pip.';
          h.lesson = histFailure(h); changed = true; break;
        }
        if (!h.tp2Hit && hitTp2) {
          h.tp2Hit = true; h.tp2At = at; h.status = 'TP2';
          h.pips = Math.round(Math.abs(h.tp2 - h.entry) / 0.1);
          h.reason = (h.shadow ? 'Observasi (tidak dieksekusi): ' : '') + 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + (buy ? ' high ' + Number(r.h).toFixed(2) : ' low ' + Number(r.l).toFixed(2)) + ' mencapai TP2 ' + h.tp2 + ' (' + h.pips + ' pip). Runner dipantau ke TPmax ' + h.tpMax + '.';
          h.tpWhy = histSuccess(h); changed = true;
        }
        if (h.tp2Hit && !h.maxHit && hitMax) {
          h.maxHit = true; h.status = 'TPMAX'; h.closedAt = at; h.maxAt = at;
          h.pips = Math.round(Math.abs(h.tpMax - h.entry) / 0.1);
          h.reason = (h.shadow ? 'Observasi (tidak dieksekusi): ' : '') + 'Candle M5 ' + new Date(r.t).toLocaleTimeString('id-ID') + (buy ? ' high ' + Number(r.h).toFixed(2) : ' low ' + Number(r.l).toFixed(2)) + ' mencapai TPmax ' + h.tpMax + ' (' + h.pips + ' pip).';
          h.tpWhy = histSuccess(h); changed = true; break;
        }
      }
      if (h.entryHit && !h.closedAt && !h.tp2Hit && !h.maxHit) { h.reason = 'Entry tersentuh ' + (h.hitAt ? new Date(h.hitAt).toLocaleString('id-ID') : '') + '; harga belum mencapai SL ' + h.sl + ' atau TP2 ' + h.tp2 + '.'; changed = true; }
    });
    if (changed) {
      const stamp = Date.now();
      arr.forEach(h => { if (JSON.stringify(h) !== before.get(h.key)) h.updatedAt = stamp; });
      histSave(arr);
    }
    return arr;
  }
  function histOutcomeHtml(h) {
    const shadow = !!h.shadow;
    const st = shadow && (h.status === 'AKTIF' || h.status === 'SHADOW') ? 'AMATI' : h.status === 'TP1' ? 'TP2' : String(h.status || '—');
    const isSl = st === 'SL' || String(st).indexOf('SL') === 0;
    const isActive = st === 'AKTIF' || st === 'AMATI' || st === 'SHADOW';
    const factors = isActive
      ? [shadow ? 'Observasi masih dipantau; tidak dieksekusi, tetapi hasil candle M5 tetap dicatat untuk pembelajaran.' : 'Entry masih dipantau; belum ada SL/TP2 yang tervalidasi candle M5.']
      : isSl ? (Array.isArray(h.lesson) ? h.lesson : histFailure(h)) : (Array.isArray(h.tpWhy) ? h.tpWhy : histSuccess(h));
    const ctx = h.ctx || {};
    const tf = (ctx.tf || []).map(x => x.tf + ' ' + (x.rec || '—')).slice(0, 6).join(' · ') || 'tidak tersimpan';
    const bias = (ctx.bias || []).join(' · ') || 'tidak tersimpan';
    const risk = ctx.risk ? (ctx.risk.level || '—') + (ctx.risk.note ? ' · ' + ctx.risk.note : '') : 'tidak tersimpan';
    const adr = ctx.adr ? 'sisa ADR ' + (ctx.adr.remainingPips == null ? '—' : ctx.adr.remainingPips) + ' pip' : 'ADR tidak tersimpan';
    const whyText = String(h.why || '—').replace(/TP1/g, 'TP2');
    const reasonText = String(h.reason || '—').replace(/TP1/g, 'TP2');
    return `<div class="small" style="max-width:500px;line-height:1.55">
      <div><b>Kenapa entry:</b> ${XE(whyText)}</div>
      <div style="margin-top:4px"><b>Teknikal saat entry:</b> ${XE(bias)}</div>
      <div><b>Matriks TF:</b> ${XE(tf)}</div>
      ${ctx.methods ? `<div><b>Konfluensi metode:</b> ${XE(ctx.methods.agreement + '% · ' + (ctx.methods.agree || 0) + '/' + (ctx.methods.total || 0) + ' searah' + ((ctx.methods.against || []).length ? ' · melawan: ' + ctx.methods.against.join(', ') : ''))}</div>` : ''}
      <div><b>Global:</b> ${XE(histMacroText(ctx))}${ctx.session ? ' · sesi ' + XE(ctx.session) : ''}${ctx.daily ? ' · D1 ' + XE(ctx.daily) : ''} · ${XE(adr)}</div>
      <div><b>Risiko rilis:</b> ${XE(risk)}</div>
      <div style="margin-top:4px"><b>${isActive ? (shadow ? 'Status observasi' : 'Status saat ini') : 'Kenapa ' + XE(st)}:</b> ${XE(reasonText)}</div>
      <div style="margin-top:4px;color:${isActive ? 'var(--warn)' : isSl ? 'var(--warn)' : 'var(--ok)'}"><b>${isActive ? 'Yang dipantau' : isSl ? 'Pelajaran otomatis' : 'Bukti TP'}:</b> ${factors.map(x => '• ' + XE(x)).join('<br>')}</div>
      ${ctx.ai && ctx.ai.summary ? `<div class="mut" style="margin-top:4px">Catatan AI saat entry: ${XE(ctx.ai.summary)}</div>` : ''}
      ${(ctx.sources || []).length ? `<div class="mut" style="margin-top:3px">Sumber: ${XE(ctx.sources.join(' · '))}</div>` : ''}
    </div>`;
  }
  /* Ringkasan bukti global: judul, sumber, umur, dan penilaian keyakinan.
     Tidak menampilkan klaim arah baru; hanya konteks yang dipakai mesin. */
  function knowledgeNote(k, title) {
    if (!k) return '';
    const items = (k.items || []).slice(0, 4);
    const bias = k.bias || {};
    return `<div class="small" style="margin-top:6px;color:${Number(bias.delta) < 0 ? 'var(--warn)' : 'var(--mut)'}"><b>${XE(title || 'Bukti global terpercaya')}:</b> ${XE(bias.note || k.note || '')}</div>`
      + (items.length ? `<div class="small mut" style="margin-top:2px">${items.map(x => '• ' + XE(x.src) + ' — ' + (x.url && /^https?:\/\//i.test(x.url) ? `<a href="${XE(x.url)}" target="_blank" rel="noopener">${XE(x.title)}</a>` : XE(x.title)) + (x.ageH == null ? '' : ' (' + XE(x.ageH) + ' jam)') + (x.sourceAccuracy == null ? '' : ' · akurasi sumber ' + XE(x.sourceAccuracy) + '%')).join('<br>')}</div>` : '');
  }
  /* Daftar bukti global lengkap untuk Radar: situs resmi, media, YouTube,
     dan akademi/komunitas emas. Tautan + umur + status feed, tanpa klaim
     bahwa semua judul benar atau bahwa arah dijamin. */
  function knowledgeCard(k, title) {
    if (!k || !Array.isArray(k.items) || !k.items.length) return '';
    const items = k.items.slice(0, 12);
    const sources = (k.sources || []).slice(0, 16);
    const linked = x => x.url && /^https?:\/\//i.test(x.url)
      ? `<a href="${XE(x.url)}" target="_blank" rel="noopener">${XE(x.title)}</a>` : XE(x.title);
    return `<div class="card"><div class="rb-card-head"><h3>🌐 ${XE(title || 'Bukti global terpercaya')}</h3><span class="rb-pill">${items.length} judul · ${sources.filter(x => x.ok).length}/${sources.length} feed${k.at ? ' · ' + XE(new Date(k.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) : ''}</span></div>
      <div class="small mut">${XE((k.bias && k.bias.note) || k.note || '')}</div>
      <div class="exp" style="margin-top:8px;color:var(--tx)">${items.map(x => `<div class="item"><span><b>${XE(x.src)}</b> ${x.tier ? `<span class="rb-pill" style="margin-left:4px">${XE(x.tier)}</span>` : ''}<br>${linked(x)}<div class="small mut">${x.ageH == null ? 'waktu tidak tersedia' : XE(x.ageH) + ' jam lalu'}${x.lean ? ' · kecenderungan judul ' + XE(x.lean) : ''}${x.sourceAccuracy == null ? '' : ' · akurasi sumber ' + XE(x.sourceAccuracy) + '%'}</div></span></div>`).join('')}</div>
      ${sources.length ? `<div style="margin-top:8px"><b class="small">Status feed</b><div class="rb-pill-row">${sources.map(x => `<span class="rb-pill ${x.ok ? 'g' : ''}" title="${XE(x.error || '')}">${XE(x.name)} · ${XE(x.count || 0)}</span>`).join('')}</div></div>` : ''}
      <div class="small mut" style="margin-top:6px">Bukti ini hanya konteks keyakinan; arah mesin tetap dihitung dari data rilis/harga/candle/SMC dan tidak diubah oleh judul berita. Akademi/komunitas tidak diberi bobot sampai punya riwayat akurasi minimal 4 hasil.</div></div>`;
  }
  /* Playbook gabungan (AMD + SMC/ICT + Fibonacci candle momentum) yang
     benar-benar dipakai mesin. Ditampilkan supaya cara entry bisa diaudit. */
  function methodCard(j) {
    const p = (j && j.smc && Array.isArray(j.smc.playbook)) ? j.smc.playbook : null;
    const m = j && j.methods;
    if ((!p || !p.length) && !m) return '';
    const rows = (m && Array.isArray(m.methods)) ? m.methods : [];
    const matrix = rows.length ? `<div style="margin-top:8px"><b class="small">🔗 Konfluensi semua metode (arah ${XE(m.dir)})</b>
      <div class="small mut" style="margin-top:2px">${XE(m.note)}${(m.against || []).length ? ' · melawan: ' + XE((m.against || []).join(', ')) : ''}</div>
      ${rows.map(x => `<div class="item"><span>${XE(x.name)} <span class="small mut">${XE(x.why)}</span></span><b class="small" style="color:${x.side === 'searah' ? 'var(--ok)' : 'var(--no)'}">${x.side === 'searah' ? '✅ searah' : '⚠️ melawan'} ${XE(x.score)}</b></div>`).join('')}</div>` : '';
    return `<div class="card"><div class="rb-card-head"><h3>📐 Metode gabungan & cara entry</h3><span class="rb-pill ${m && m.agreement >= 60 ? 'y' : ''}">${m ? XE(m.agreement) + '% konfluensi · ' + XE(m.agree) + '/' + XE(m.total) + ' metode' : (p ? p.length + ' langkah' : '—')}</span></div>
      <div class="small mut">Urutan ini yang dihitung mesin setiap refresh: AMD → likuiditas → premium/discount & OTE → POI → IDM/MSS → fib momentum → kill zone → LIMIT → SL 30 / TP2 ≥ 200.</div>
      ${matrix}
      ${p && p.length ? `<details class="exp" style="margin-top:8px;color:var(--tx)"><summary style="cursor:pointer"><b>Buka 10 langkah entry</b></summary>${p.map(x => `<div class="small" style="margin-top:4px">${XE(x)}</div>`).join('')}</details>` : ''}</div>`;
  }
  function learningCard(j) {
    const deleted = histDeletedSet();
    const arr = histLoad().filter(h => !deleted.has(h.key));
    const settled = arr.filter(h => ['SL', 'TP1', 'TP2', 'TPMAX'].includes(String(h.status || '')));
    const sl = settled.filter(h => h.status === 'SL');
    const tp = settled.filter(h => h.status !== 'SL');
    const tp2 = settled.filter(h => h.status === 'TP2').length;
    const tpmax = settled.filter(h => h.status === 'TPMAX').length;
    const obs = arr.filter(h => !!h.shadow).length;
    const profile = learningProfile();
    const patterns = [...profile.entries()]
      .filter(([k, s]) => s.n >= 2 && s.l > 0 && String(k).split('|').length >= 4)
      .sort((a, b) => (b[1].l / b[1].n) - (a[1].l / a[1].n) || b[1].l - a[1].l)
      .slice(0, 4);
    const current = ((j && j.setups) || []).filter(s => s.learning && (s.learning.blocked || s.learning.warn));
    const traits = (j && j.learning && Array.isArray(j.learning.top)) ? j.learning.top : [];
    const latest = sl.slice().sort((a, b) => (Date.parse(b.closedAt || '') || Number(b.updatedAt) || 0) - (Date.parse(a.closedAt || '') || Number(a.updatedAt) || 0))[0];
    return `<div class="card" id="learnCard"><div class="rb-card-head"><h3>🧪 Pembelajaran otomatis dari SL & observasi</h3><span class="rb-pill ${j && j.learning && j.learning.blocked ? 'y' : ''}">${settled.length} hasil · ${sl.length} SL${obs ? ' · ' + obs + ' amati' : ''}</span></div>
      <div class="small mut">Mesin mencatat pola persis + sifat teknikal (mode, POI, trigger, sesi, makro, TF, risiko rilis, konfluensi metode, sumber TP) untuk setiap entry SIAP dan setiap setup TUNGGU yang levelnya sudah valid. Setup TUNGGU dicatat sebagai <b>observasi</b>: tidak dieksekusi, tetapi SL/TP-nya tetap dinilai candle M5, sehingga mesin punya data untuk belajar walau belum ada trade nyata. Hasil observasi hanya menurunkan keyakinan; yang boleh menahan entry adalah SL dari trade nyata. News dan radar juga mencatat akurasi arahnya sendiri.</div>
      <div class="rb-kpis" style="margin-top:8px"><div><span>TP</span><b style="color:var(--ok)">${tp.length}</b><small>TP2 ${tp2} · TPmax ${tpmax}</small></div><div><span>SL</span><b style="color:var(--no)">${sl.length}</b><small>evaluasi M5</small></div><div><span>Pola dipelajari</span><b>${patterns.length}</b><small>minimal 2 hasil</small></div><div><span>Ditahan sekarang</span><b style="color:var(--warn)">${current.filter(s => s.learning.blocked).length}</b><small>setup TUNGGU</small></div></div>
      ${latest ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>Pelajaran SL terakhir</b> <span class="small mut">${XE(latest.entry + ' · ' + latest.style + ' ' + latest.dir)}</span><div class="small" style="margin-top:3px">${(Array.isArray(latest.lesson) ? latest.lesson : histFailure(latest)).map(x => '• ' + XE(x)).join('<br>')}</div></div>` : '<div class="small mut" style="margin-top:8px">Belum ada SL yang bisa dipelajari. Setelah ada hasil, pelajaran muncul di sini.</div>'}
      ${patterns.length ? `<div style="margin-top:8px"><b class="small">Pola yang perlu diwaspadai</b>${patterns.map(([k, s]) => `<div class="item"><span class="small">${XE(histPatternLabel(k))}</span><b class="small" style="color:${s.w ? 'var(--warn)' : 'var(--no)'}">${s.l} SL / ${s.w} TP</b></div>`).join('')}</div>` : ''}
      ${traits.length ? `<div style="margin-top:8px"><b class="small">Sifat teknikal yang paling sering SL</b>${traits.map(t => `<div class="item"><span class="small">${XE(t.label)}</span><b class="small" style="color:var(--no)">${XE(t.losses)} SL / ${XE(t.wins)} TP · ${XE(t.rate)}%</b></div>`).join('')}</div>` : ''}
      ${current.length ? `<div class="small" style="margin-top:8px;color:var(--warn)">${current.map(s => '• ' + XE(s.style + ' ' + s.dir) + ': ' + XE(s.learning.note) + ((s.learning.reasons || []).length ? ' (' + XE((s.learning.reasons || []).join('; ')) + ')' : '')).join('<br>')}</div>` : ''}
      ${j && j.learning ? `<div class="small mut" style="margin-top:6px">Profil belajar: ${XE(j.learning.patterns || 0)} pola · ${XE(j.learning.records || 0)} hasil · ${XE(j.learning.traits || 0)} sifat teknikal · ${XE(j.learning.blocked || 0)} ditahan · ${XE(j.learning.warned || 0)} peringatan${j.learning.outcomes ? ' · outcome TP2 ' + XE(j.learning.outcomes.tp2 || 0) + ' / TPmax ' + XE(j.learning.outcomes.tpmax || 0) : ''}. ${XE(j.learning.source || '')}</div>` : ''}
      ${knowledgeNote(j && j.knowledge, 'Belajar dari sumber global (web, YouTube resmi & akademi emas)')}
      <div class="small mut" style="margin-top:6px">Ambang: pola yang sudah SL tanpa TP ditahan; pola dengan ≥2 SL tanpa TP juga ditahan. Pola yang sudah punya TP hanya diberi peringatan, bukan diblokir permanen. Cooldown 7 hari lalu dievaluasi ulang, dan hasil observasi ikut dihitung agar mesin tidak terkunci permanen. Data historis terbatas; tetap cek berita dan risiko.</div></div>`;
  }
  function histCard() {
    const deleted = histDeletedSet();
    const arr = histLoad().filter(h => !deleted.has(h.key));
    const actual = arr.filter(h => !h.shadow);
    const active = actual.filter(h => h.status === 'AKTIF');
    const tp = actual.filter(h => h.status === 'TP1' || h.status === 'TP2' || h.status === 'TPMAX');
    const sl = actual.filter(h => h.status === 'SL');
    const shadow = arr.filter(h => !!h.shadow);
    const running = actual.filter(h => h.status === 'AKTIF' || ((h.status === 'TP1' || h.status === 'TP2') && !h.closedAt)).length;
    const sync = histSyncLabel();
    const row = (h) => {
      const isShadow = !!h.shadow;
      const stColor = h.status === 'SL' ? 'var(--no)' : h.status === 'AKTIF' || h.status === 'SHADOW' ? 'var(--warn)' : isShadow ? 'var(--b)' : 'var(--ok)';
      const key = encodeURIComponent(h.key || '').replace(/'/g, '%27');
      const st = isShadow ? (h.status === 'TP1' ? 'TP2 · amati' : h.status === 'AKTIF' || h.status === 'SHADOW' ? 'AMATI' : h.status + ' · amati') : h.status === 'TP1' ? 'TP2' : h.status;
      return `<tr style="border-top:1px solid var(--line);vertical-align:top">
        <td style="padding:6px 4px;white-space:nowrap">${new Date(h.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${XE(h.style)}</td>
        <td style="color:${h.dir === 'BUY' ? 'var(--ok)' : 'var(--no)'};font-weight:700">${XE(h.dir)}</td>
        <td>${num(h.entry)} / <span style="color:var(--no)">${num(h.sl)}</span></td>
        <td>${num(h.tp2)} / ${num(h.tpMax)}</td>
        <td style="color:${stColor};font-weight:700"><details><summary style="cursor:pointer">${XE(st)} <span class="mut" style="font-weight:400">· detail</span></summary>${histOutcomeHtml(h)}</details></td>
        <td>${h.pips == null ? '—' : pips(h.pips)}</td>
        <td style="text-align:right"><button class="x" type="button" onclick="pHistDelete('${key}')" title="Hapus dari akun dan database" style="padding:2px 6px;color:var(--no)">🗑️</button></td>
      </tr>`;
    };
    const table = (list) => `<div style="overflow:auto;margin-top:4px"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:760px"><thead><tr style="text-align:left;color:var(--mut)"><th>Waktu</th><th>Mode</th><th>Arah</th><th>Entry / SL</th><th>TP2 / TPmax</th><th>Hasil</th><th>Pip</th><th></th></tr></thead><tbody>${list.slice(0, 60).map(row).join('')}</tbody></table></div>`;
    const dateSections = (list) => {
      const groups = new Map();
      list.forEach(h => {
        const k = histDateKey(h.createdAt);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(h);
      });
      return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, rows]) => {
        const sorted = rows.slice().sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
        const t = sorted.filter(h => !h.shadow && h.status !== 'SL' && h.status !== 'AKTIF').length;
        const l = sorted.filter(h => !h.shadow && h.status === 'SL').length;
        const o = sorted.filter(h => !!h.shadow).length;
        return `<div style="margin-top:10px"><div class="small" style="font-weight:700;color:var(--tx);border-left:3px solid var(--b);padding-left:7px">${XE(histDateLabel(sorted[0].createdAt))} <span class="mut" style="font-weight:400">· ${t} TP · ${l} SL${o ? ' · ' + o + ' amati' : ''}</span></div>${table(sorted)}</div>`;
      });
    };
    const selected = histFilter === 'ACTIVE' ? active : histFilter === 'TP' ? tp : histFilter === 'SL' ? sl : histFilter === 'SHADOW' ? shadow : arr;
    const selectedTitle = histFilter === 'ACTIVE' ? 'Aktif / berjalan' : histFilter === 'TP' ? 'Kena TP' : histFilter === 'SL' ? 'Kena SL' : histFilter === 'SHADOW' ? 'Observasi pembelajaran (tidak dieksekusi)' : 'Semua riwayat';
    return `<div class="card" id="sigHist"><div class="rb-card-head"><h3>🗂️ Riwayat Signal Entry</h3><span class="rb-pill ${histSyncState === 'akun' ? 'y' : ''}">${actual.length} entry${shadow.length ? ' · ' + shadow.length + ' amati' : ''} · ${running} berjalan · ${XE(sync)}</span></div>
      <div class="small mut">Dikelompokkan per tanggal entry (waktu perangkat); TP2 minimal 200 pip. Entry aktif hari ini ada di grup <b>Hari ini</b>; tanggal mendatang belum punya riwayat karena entry belum terbentuk. Buka <b>detail</b> di kolom Hasil untuk melihat alasan entry, bukti teknikal/global, penyebab TP atau SL, dan pelajaran otomatisnya. SL/TP dievaluasi dari candle M5 TradingView sesudah waktu sinyal; SL didahulukan bila satu candle menyentuh SL dan TP. Setup yang ditahan pembelajaran tetap dicatat sebagai <b>observasi</b> agar mesin bisa menguji keputusannya tanpa mengeksekusi entry.</div>
      <div class="rb-pill-row" style="margin-top:8px;align-items:center">
        <button class="x" type="button" onclick="pHistFilter('ALL')" style="${histFilter === 'ALL' ? 'border-color:var(--b);color:var(--b)' : ''}">Semua · ${arr.length}</button>
        <button class="x" type="button" onclick="pHistFilter('ACTIVE')" style="${histFilter === 'ACTIVE' ? 'border-color:var(--b);color:var(--b)' : ''}">Aktif · ${active.length}</button>
        <button class="x" type="button" onclick="pHistFilter('TP')" style="${histFilter === 'TP' ? 'border-color:var(--ok);color:var(--ok)' : ''}">TP · ${tp.length}</button>
        <button class="x" type="button" onclick="pHistFilter('SL')" style="${histFilter === 'SL' ? 'border-color:var(--no);color:var(--no)' : ''}">SL · ${sl.length}</button>
        <button class="x" type="button" onclick="pHistFilter('SHADOW')" style="${histFilter === 'SHADOW' ? 'border-color:var(--b);color:var(--b)' : ''}">Amati · ${shadow.length}</button>
      </div>
      ${arr.length ? (selected.length ? `<div style="margin-top:6px"><div class="small" style="font-weight:700;color:${histFilter === 'SL' ? 'var(--no)' : histFilter === 'TP' ? 'var(--ok)' : 'var(--warn)'}">${XE(selectedTitle)} · ${selected.length}</div>${dateSections(selected).join('')}</div>` : '<div class="small mut" style="margin-top:8px">Tidak ada riwayat pada filter ini.</div>') : '<div class="warn" style="margin-top:8px">Belum ada sinyal SIAP yang tercatat. Riwayat terisi otomatis saat mesin menemukan entry valid, bukan dari sinyal yang dikarang.</div>'}
    </div>`;
  }

  function toast(m) { if (typeof v21Toast === 'function') v21Toast(m); }
  function newsCacheKey(k) { const u = histUid(); return NEWS_KEY + k + (u ? '_' + u : ''); }
  function loadCache(k) { try { return JSON.parse(localStorage.getItem(newsCacheKey(k)) || 'null'); } catch (e) { return null; } }
  function saveCache(k, v) { try { localStorage.setItem(newsCacheKey(k), JSON.stringify(v)); } catch (e) { } }
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
    if (newsTimer) { clearTimeout(newsTimer); newsTimer = null; }
    if (newsCd) { clearInterval(newsCd); newsCd = null; }
    /* Generasi mencegah loop lama menghidupkan timer baru setelah tab/ganti
       rilis. Ini yang membuat auto-refresh tidak berjalan dobel. */
    const gen = ++newsGen;
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
      if (gen !== newsGen || focus !== newsFocus || !X$('xNewsOut')) return;
      if (remote) { newsData = remote.data; newsAt = remote.at; }
      if (newsData) { paintNews(newsData, true); try { newsLearnSync(newsData); } catch (e) { } }
      const tick = function () {
        const el = X$('xNewsNext');
        if (!el) { clearInterval(newsCd); newsCd = null; return; }
        if (newsBusy) { el.textContent = '⏳ Mengumpulkan data terbaru & AI…'; return; }
        const retry = Math.max(0, (newsRetryAt || 0) - Date.now());
        const left = retry || Math.max(0, NEWS_REFRESH_MS - (Date.now() - (newsAt || Date.now())));
        const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        el.textContent = (retry ? 'Mencoba lagi dalam ' : 'Refresh otomatis dalam ') + m + ':' + String(s).padStart(2, '0') + (retry ? ' · data tersimpan tetap ditampilkan' : ' · tanpa tombol');
      };
      tick();
      newsCd = setInterval(tick, 1000);
      const loop = function () {
        if (gen !== newsGen || !X$('xNewsOut')) return;
        if (newsBusy) { newsTimer = setTimeout(loop, 5000); return; }
        const remain = Math.max(1000, NEWS_REFRESH_MS - (Date.now() - (newsAt || Date.now())));
        const retry = Math.max(0, (newsRetryAt || 0) - Date.now());
        const wait = retry ? Math.min(remain, retry) : remain;
        newsTimer = setTimeout(async function () {
          if (gen !== newsGen || !X$('xNewsOut')) return;
          if (newsBusy) { newsTimer = setTimeout(loop, 5000); return; }
          await window.pXauRun(true);
          if (gen === newsGen) loop();
        }, wait);
      };
      /* Jangan menjadwalkan loop sebelum run awal selesai; jika tidak, timer
         pertama langsung habis dan memicu run kedua yang tidak perlu. */
      (async function () {
        if (!newsData || Date.now() - newsAt > NEWS_REFRESH_MS) await window.pXauRun(true);
        if (gen === newsGen) loop();
      })();
    })();
    boot.catch(function (e) { const m0 = X$('xNewsMsg'); if (m0) m0.textContent = '⚠️ ' + e.message; });
  };
  window.pXauFocus = function (k) {
    newsAutoT3 = false;
    newsRetryAt = 0;
    newsFocus = FOCUS.some(f => f.k === k) ? k : 'NFP';
    try { localStorage.setItem('rb_xau_focus_v2', newsFocus); } catch (e) { }
    window.pXauNews();
  };
  window.pXauRun = async function (silent) {
    if (newsBusy) return;
    newsBusy = true;
    const gen = newsGen;
    const focus = newsFocus;
    const msg = X$('xNewsMsg');
    if (msg) msg.textContent = 'Mengambil kalender, angka resmi FRED/BLS, TradingView, media AS, YouTube, lalu panel AI…';
    try {
      await Promise.all([learnPullSafe('news'), learnPullSafe('source')]);
      const j = await tcall({ action: 'xau', focus, fresh: true, learn: learnForNews() });
      if (gen !== newsGen || focus !== newsFocus || !X$('xNewsOut')) {
        if (j && j.ok && !j.error) saveCache(focus, j);
        newsBusy = false; return;
      }
      if (j && j.ok && !j.error) {
        newsData = j;
        newsAt = Date.parse(j.generatedAt) || Date.now();
        newsRetryAt = 0;
        /* Catat prakiraan pra-rilis / evaluasi reaksi nyata untuk pembelajaran. */
        try { newsLearnSync(j); } catch (e) { }
        try { sourceLearnSync(j); } catch (e) { }
        saveCache(focus, j);
        statePut('news', focus, j).catch(() => { });
      }
      if (!j || !j.ok || j.error) {
        const transient = newsTransient(j) || /429|firestore|izin akses/i.test(String(j && j.error || ''));
        if (transient) newsRetryAt = Date.now() + Math.max(60000, (Number(j && j.retryAfter) || 0) * 1000);
        if (newsData && transient) {
          paintNews(newsData, true);
          if (msg) msg.textContent = '⚠️ ' + (j.error || 'Data baru belum tersedia') + ' — data tersimpan tetap ditampilkan; mencoba lagi otomatis.';
        } else {
          newsAt = Date.now();
          paintNews(j, false);
          if (msg) msg.textContent = '⚠️ ' + ((j && j.error) || 'gagal');
        }
      } else {
        paintNews(j, false);
        if (msg) msg.textContent = '✅ Selesai — arah ' + j.direction + ' · spike ' + (j.spike && j.spike.measured ? 'terukur' : j.spike && j.spike.likely ? 'diperkirakan' : 'tidak ada') + ' · ' + new Date().toLocaleTimeString('id-ID');
      }
    } catch (e) {
      if (gen === newsGen && focus === newsFocus && X$('xNewsOut')) {
        const transient = newsTransient(e);
        if (transient) newsRetryAt = Date.now() + 60000;
        if (newsData && transient) paintNews(newsData, true);
        else { newsAt = Date.now(); paintNews({ ok: false, error: e.message }, false); }
      }
      if (msg) msg.textContent = '⚠️ ' + e.message + (newsData ? ' — data tersimpan tetap ditampilkan.' : '');
    }
    newsBusy = false;
  };

  /* ---------------- RADAR 10M ---------------- */
  const RADAR_CACHE_KEY = 'rb_xau_radar_v1';
  let radarData = null, radarAt = 0, radarBusy = false, radarTimer = null, radarCd = null, radarGen = 0, radarSavedAt = 0;
  function radarCacheKey() { const u = histUid(); return RADAR_CACHE_KEY + (u ? '_' + u : ''); }
  function radarCacheLoad() { try { const c = JSON.parse(localStorage.getItem(radarCacheKey()) || 'null'); return c && c.data ? c : null; } catch (e) { return null; } }
  function radarCacheSave(j) { try { localStorage.setItem(radarCacheKey(), JSON.stringify({ at: Date.now(), data: j })); } catch (e) { } }
  function radarDirClass(d) { return d === 'BUY' ? 'ok' : d === 'SELL' ? 'no' : 'warn'; }
  function radarCard(j) {
    if (!j || j.ok === false) return `<div class="card"><div class="warn">${XE((j && j.error) || 'Radar belum tersedia.')}</div><div class="small mut" style="margin-top:6px">Data tidak ditampilkan sebagai angka palsu. Coba lagi saat koneksi pasar tersedia.</div></div>`;
    const dir = String(j.direction || 'WAIT').toUpperCase();
    const cls = radarDirClass(dir);
    const until = j.validUntil ? Date.parse(j.validUntil) : (Date.parse(j.generatedAt) || Date.now()) + 10 * 60000;
    return `<div class="card radar-hero">
      <div class="rb-card-head"><h3>🛰️ Radar arah 10 menit — XAUUSD</h3><span class="rb-pill ${dir === 'WAIT' ? '' : 'y'}">${XE(j.symbol || 'XAUUSD')} · ${new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID')}</span></div>
      <div class="radar-top">
        <div class="radar-big ${cls}">${XE(dir)}</div>
        <div class="radar-meta"><b>Keyakinan ${XE(j.confidence)}%</b><div class="small mut">Skor ${XE(j.score)} · agreement ${XE(j.agreement)}% · horizon ${XE(j.horizonMin)} menit${j.baseConfidence != null ? ' · dasar ' + XE(j.baseConfidence) + '%' : ''}</div>${j.learning ? `<div class="small" style="color:${j.learning.delta < 0 ? 'var(--warn)' : 'var(--mut)'}">${XE(j.learning.note)}</div>` : ''}${knowledgeNote(j.knowledge, 'Bukti global')}<div class="small" id="radarCountdown" data-until="${until}">Berlaku sampai ${new Date(until).toLocaleTimeString('id-ID')}</div></div>
      </div>
      <div class="radar-kpis"><div><span>Harga</span><b>${num(j.price)}</b><small>${XE(j.priceSource || '—')}</small></div><div><span>Spot pembanding</span><b>${j.spot == null ? '—' : num(j.spot)}</b><small>${j.priceDifferencePips == null ? 'tidak tersedia' : j.priceDifferencePips + ' pip dari TV'}</small></div><div><span>Rentang 10m</span><b>${j.expectedRangePips == null ? '—' : j.expectedRangePips + ' pip'}</b><small>dari ATR live</small></div><div><span>Risiko rilis</span><b style="color:${j.risk && j.risk.level === 'TINGGI' ? 'var(--no)' : j.risk && j.risk.level === 'SEDANG' ? 'var(--warn)' : 'var(--ok)'}">${XE((j.risk && j.risk.level) || '—')}</b><small>${XE((j.risk && j.risk.note) || '')}</small></div></div>
      <div class="small mut" style="margin-top:8px">${XE(j.method || '')}</div>
      ${j.smc && j.smc.ok ? `<div class="small" style="margin-top:6px"><b>SMC/AMD:</b> ${XE(j.smc.note)}${j.smcPdConflict ? ' · <span style="color:var(--warn)">arah radar melawan premium/discount 50%; keyakinan diturunkan.</span>' : ''}</div>` : ''}
      ${(j.factors || []).length ? `<div class="radar-factors">${j.factors.map(f => `<div class="radar-factor ${f.score >= 0 ? 'up' : 'down'}"><b>${XE(f.name)}</b><span>${f.score > 0 ? '+' : ''}${XE(f.score)}</span><div class="small mut">${XE(f.why)}<br><span>${XE(f.source || '')}${f.at ? ' · ' + new Date(f.at).toLocaleTimeString('id-ID') : ''}</span></div></div>`).join('')}</div>` : ''}
      <div class="small" style="margin-top:10px;color:var(--warn)">${XE(j.limitation || '')}</div>
      <div class="small mut" style="margin-top:4px">${XE(j.brokerNote || '')}</div>
    </div>
    <div class="card"><div class="rb-card-head"><h3>🔗 Sumber & waktu data radar</h3><span class="rb-pill">${(j.sources || []).filter(x => x.ok).length}/${(j.sources || []).length} aktif</span></div>
      <div class="source-list">${(j.sources || []).map(x => `<div class="source-row"><span class="source-dot ${x.ok ? 'ok' : 'no'}"></span><div><b>${x.url ? `<a href="${XE(x.url)}" target="_blank" rel="noopener">${XE(x.name)}</a>` : XE(x.name)}</b><div class="small mut">${XE(x.role || '')}${x.at ? ' · diambil ' + new Date(x.at).toLocaleString('id-ID') : ''}</div></div><span class="small ${x.ok ? '' : 'warn'}">${x.ok ? 'aktif' : 'gagal'}</span></div>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Tidak ada feed MT5 HFM/Exness publik untuk retail; selisih quote bisa berbeda dari TradingView/spot. Untuk eksekusi, salin level dari radar lalu cocokkan dengan harga MT5 broker.</div>
    </div>` + knowledgeCard(j.knowledge, 'Bukti global: situs resmi, media, YouTube & akademi emas');
  }
  window.pRadar = function () {
    if (radarTimer) { clearInterval(radarTimer); radarTimer = null; }
    if (radarCd) { clearInterval(radarCd); radarCd = null; }
    const gen = ++radarGen;
    const c = radarCacheLoad();
    if (c) { radarData = c.data; radarAt = c.at; }
    X$('pane').innerHTML = `<div class="card radar-intro"><div class="rb-card-head"><h3>🛰️ Radar 10M — arah XAUUSD</h3><span class="rb-pill y">real-time · auto 60 detik</span></div><div class="rb-note">Radar deterministik untuk horizon <b>10 menit</b>: gabungan harga/candle TradingView real-time, struktur M5/M15, momentum 10 menit, EMA/RSI, DXY/yield 15 menit, SMC/AMD, dan risiko rilis. Di bawahnya ada bukti terbaru dari situs resmi/industri/media terpercaya, YouTube resmi, serta akademi/komunitas emas—hanya konteks keyakinan, bukan angka harga atau pengubah arah. Tidak ada angka karangan; setiap faktor dan feed menampilkan sumber serta waktu ambil/status.</div><div id="radarMsg" class="small mut" style="margin-top:8px"></div><div id="radarOut" style="margin-top:10px">${radarData ? radarCard(radarData) : ''}</div></div>`;
    const tick = function () {
      const el = X$('radarCountdown');
      if (!el) {
        /* Saat data pertama belum ada, elemen countdown belum dibuat; jangan
           matikan interval. Baru matikan bila halaman radar sudah ditinggalkan. */
        if (!X$('radarOut')) { clearInterval(radarCd); radarCd = null; }
        return;
      }
      const left = Math.max(0, (Number(el.dataset.until) || Date.now()) - Date.now());
      el.textContent = left ? 'Berlaku ' + Math.ceil(left / 60000) + ' menit lagi · auto-refresh 60 detik' : 'Horizon 10 menit habis — menghitung ulang…';
    };
    tick(); radarCd = setInterval(tick, 1000);
    /* Ambil state akun dulu; jangan langsung menembak feed baru bila perangkat
       lain sudah punya hasil radar yang lebih baru. */
    (async function () {
      try { await radarStatePull(); } catch (e) { }
      if (gen !== radarGen || !X$('radarOut')) return;
      if (radarData) { const out = X$('radarOut'); if (out) out.innerHTML = radarCard(radarData); }
      if (!radarData || Date.now() - (radarAt || 0) > 60000) radarRun(true);
    })();
    radarTimer = setInterval(function () { if (X$('radarOut')) radarRun(true); else { clearInterval(radarTimer); radarTimer = null; } }, 60000);
    if (!window.__radarVis) { window.__radarVis = 1; document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && X$('radarOut') && Date.now() - (radarAt || 0) > 60000) radarRun(true); }); }
  };
  async function radarRun(silent) {
    if (radarBusy) return;
    radarBusy = true;
    const gen = radarGen;
    const msg = X$('radarMsg'); if (msg) msg.textContent = 'Mengambil TradingView, candle live, DXY/yield, spot, kalender, situs resmi, media, YouTube, dan akademi emas…';
    try {
      await Promise.all([learnPullSafe('radar'), learnPullSafe('source')]);
      const j = await tcall({ action: 'xauRadar', fresh: true, learn: learnForRadar() });
      if (gen !== radarGen) { radarBusy = false; return; }
      if (j && j.ok !== false && !j.error) {
        radarData = j; radarAt = Date.now();
        try { radarLearnSync(j); } catch (e) { }
        try { sourceLearnSync(j); } catch (e) { }
        radarCacheSave(j);
        /* Simpan state akun maksimal sekali per 20 menit; radar tetap
           dihitung lokal tiap 60 detik untuk horizon 10 menitnya. */
        if (!radarSavedAt || Date.now() - radarSavedAt >= 20 * 60000) {
          statePut('radar', null, j).then(ok => { if (ok) radarSavedAt = Date.now(); }).catch(() => { });
        }
      }
      const out = X$('radarOut'); if (out) out.innerHTML = radarCard(j);
      if (msg) msg.textContent = j && j.ok !== false && !j.error ? '✅ Radar diperbarui ' + new Date().toLocaleTimeString('id-ID') + ' · data tidak dijamin bebas SL.' : '⚠️ ' + ((j && j.error) || 'gagal');
    } catch (e) { if (msg) msg.textContent = '⚠️ ' + e.message; }
    radarBusy = false;
  }

  function timingCard(j) {
    const t = j.timing;
    if (!t) return '';
    const hot = t.preWindow;
    const col = t.dir === 'BUY' ? 'var(--ok)' : t.dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
    return `<div class="card" style="border-left:5px solid ${hot ? 'var(--warn)' : 'var(--line)'}">
      <div class="rb-card-head"><h3>⏱️ Timing & arah rilis</h3><span class="rb-pill ${hot ? 'y' : ''}">${XE(t.status)}</span></div>
      ${j.event && j.event.when ? `<div class="small" style="font-weight:700;margin-top:6px" id="xCd">Hitung mundur…</div>` : `<div class="small mut" style="margin-top:6px">Tidak ada jadwal rilis mendatang — memakai data terakhir.</div>`}
      <div class="exp" style="color:var(--tx);margin-top:8px"><b>${t.phase === 'pasca-rilis' ? 'Arah pasca-rilis' : 'Prakiraan pra-rilis'}: <span style="color:${col}">${XE(t.dir)}</span></b> · keyakinan ${XE(t.confidence)}% · skor ${XE(t.score)}
        <div class="small mut">${XE(t.caveat)}</div></div>
      ${t.dataBias ? `<div class="small" style="margin-top:3px">Bias data aktual: <b style="color:${t.dataBias === 'BUY' ? 'var(--ok)' : 'var(--no)'}">${XE(t.dataBias)}</b>${j.reaction ? ' · reaksi nyata <b>' + XE(j.reaction.dir) + '</b> (' + XE(j.reaction.netPips) + ' pip)' : ''}. Arah mesin mengikuti reaksi terukur bila ≥30 pip.</div>` : ''}
      ${(t.reasons || []).length ? `<div style="margin-top:8px"><b class="small">Bukti arah</b>${t.reasons.map(x => `<div class="item"><span>${XE(x.why)}</span><b style="color:${x.w >= 0 ? 'var(--ok)' : 'var(--no)'}">${x.w > 0 ? '+' : ''}${XE(x.w)}</b></div>`).join('')}</div>` : ''}
      ${t.technical ? `<div class="small mut" style="margin-top:6px"><b>Teknikal SMC:</b> ${XE(t.technical)}</div>` : ''}
      ${j.technicalConflict ? `<div class="small" style="margin-top:4px;color:var(--warn)">Arah data bertentangan dengan struktur SMC live; keyakinan diturunkan, arah tidak diubah. Entry tetap menunggu konfirmasi M5.</div>` : ''}
      ${t.nowcast ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>Nowcast NFP:</b> ${XE(t.nowcast.note)} <span class="small" style="color:${t.nowcast.hot ? 'var(--no)' : 'var(--ok)'}">${t.nowcast.hot ? 'cenderung panas' : 'cenderung dingin'}</span></div>` : ''}
      <div style="margin-top:10px"><b class="small">${t.phase === 'pasca-rilis' ? 'Playbook setelah rilis' : 'Playbook 2–3 menit sebelum rilis'}</b>${(t.playbook || []).map(x => `<div class="small" style="margin-top:4px">• ${XE(x)}</div>`).join('')}</div>
      ${j.learning ? `<div class="small" style="margin-top:8px;color:${j.learning.delta < 0 ? 'var(--warn)' : 'var(--mut)'}"><b>Pembelajaran berita:</b> ${XE(j.learning.note)}</div>` : ''}
      ${knowledgeNote(j.knowledge, 'Bukti global terpercaya')}
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
    const buy = j.direction === 'BUY', neutral = j.direction === 'NETRAL';
    const col = neutral ? 'var(--warn)' : buy ? 'var(--ok)' : 'var(--no)';
    const sp = j.spike || {};
    return `<div class="card" style="border-left:5px solid ${col}">
      <div class="rb-verdict ${neutral ? 'neutral' : buy ? 'buy' : 'sell'}"${neutral ? ' style="color:var(--warn)"' : ''}>
        <div class="rb-verdict-label">Putusan mesin · ${XE(j.name || j.focus)}</div>
        <div class="rb-verdict-main"${neutral ? ' style="color:var(--warn)"' : ''}>${XE(j.direction)}</div>
        <div class="rb-verdict-sub">XAUUSD — ${neutral ? 'belum ada arah yang cukup; tunggu bukti' : 'satu arah final'}</div>
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
          <div class="small" style="margin-top:5px;color:${j.direction === 'BUY' ? 'var(--ok)' : j.direction === 'SELL' ? 'var(--no)' : 'var(--warn)'}">Arah mesin: <b>${XE(j.direction || '—')}</b> ${j.timing && j.timing.preWindow ? '· pra-rilis T-3' : ''}</div>
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
      ${d.technical_read ? `<div style="margin-top:8px"><b class="small">🧭 Bacaan teknikal SMC</b><div class="small" style="line-height:1.55">${XE(d.technical_read)}</div></div>` : ''}
      ${d.entry_plan ? `<div class="exp" style="margin-top:6px;color:var(--tx)"><b>Cara entry (mengikuti mesin):</b><div class="small" style="line-height:1.55">${XE(d.entry_plan)}</div></div>` : ''}
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
    const y = yt.items || [], u = us.items || [];
    const tr = (yt.transcripts && yt.transcripts.items) || [];
    return `<div class="card"><div class="rb-card-head"><h3>📺 YouTube & media AS</h3><span class="rb-pill">${y.length} video · ${u.length} berita · ${tr.length} transkrip</span></div>
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
    const pa = j.priceAudit || {};
    return `<div class="card"><div class="rb-card-head"><h3>✅ Validitas & sumber</h3>${q ? `<span class="rb-pill ${q.score >= 80 ? 'y' : ''}">${XE(q.score)}% sumber siap</span>` : ''}</div>
      <div class="rb-note">Setiap angka punya sumber dan periode. Data resmi (FRED/BLS/BEA/Treasury) dipisahkan dari kalender agregator.</div>
      ${q ? `<div style="margin-top:6px">${q.checks.map(c => `<div class="item"><span>${c.ok ? '✅' : '⚠️'} ${XE(c.k)}</span></div>`).join('')}</div>` : ''}
      <div class="price-audit"><div><span>Harga acuan</span><b>${num(j.price)}</b><small>${XE(j.priceSource || '—')}</small></div><div><span>TradingView</span><b>${pa.tv ? num(pa.tv.price) : '—'}</b><small>${pa.tv ? new Date(pa.tv.at).toLocaleString('id-ID') : 'tidak tersedia'}</small></div><div><span>Spot gold-api</span><b>${pa.spot ? num(pa.spot.price) : '—'}</b><small>${pa.differencePips == null ? 'pembanding tidak tersedia' : pa.differencePips + ' pip dari TV'}</small></div><div><span>Candle</span><b>${pa.candle ? XE(pa.candle.source || '—') : '—'}</b><small>${pa.freshMinutes == null ? 'waktu tidak tersedia' : pa.freshMinutes + ' menit lalu'}</small></div></div>
      <div class="small mut" style="margin-top:6px">${XE(pa.brokerNote || '')}</div>
      ${val && val.ok ? `<div class="exp" style="color:var(--tx);margin-top:6px"><b>${XE(val.label)}</b> · nilai <b>${XE(val.value)}</b>${val.prev != null ? ' · sebelumnya ' + XE(val.prev) : ''} · periode ${XE(val.period)} <div class="small mut">${XE(val.source)}</div>${(val.extra || []).map(x => `<div class="small mut">${XE(x.metric)}: ${XE(x.latest)}${x.previous != null ? ' (sebelumnya ' + XE(x.previous) + ')' : ''}</div>`).join('')}</div>` : `<div class="warn" style="margin-top:6px">Angka resmi FRED belum terbaca: ${XE((val && val.error) || '—')}</div>`}
      <div class="source-list" style="margin-top:8px">${src.map(s => `<div class="source-row"><span class="source-dot ${s.ok ? 'ok' : 'no'}"></span><div><b>${s.url ? `<a href="${XE(s.url)}" target="_blank" rel="noopener">${XE(s.name)}</a>` : XE(s.name)}</b></div><span class="small ${s.ok ? '' : 'warn'}">${s.ok ? 'aktif' : 'gagal'}</span></div>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Diambil ${XE(when(j.generatedAt))}${j.cached ? ' · cache server' : ''}${j.ai ? ' · AI: ' + XE((j.ai.model || j.ai.provider || '—')) : ''}</div>
    </div>`;
  }

  function marketCard(j) {
    const m = j.marketContext || {};
    const pa = j.priceAudit || {};
    const row = (label, v, unit) => `<div class="item"><span>${XE(label)}</span><b style="color:${v == null ? 'var(--mut)' : v >= 0 ? 'var(--ok)' : 'var(--no)'}">${v == null ? '—' : (v > 0 ? '+' : '') + v + XE(unit || '')}</b></div>`;
    return `<div class="card"><div class="rb-card-head"><h3>🌍 Konteks pasar (terukur)</h3><span class="rb-pill">${XE((m.tv && m.tv.bias) || 'TV tidak tersedia')}</span></div>
      ${row('Emas 1 hari', m.gold1d, '%')}${row('Emas 5 hari', m.gold5d, '%')}${row('DXY 5 hari', m.dxy5d, '%')}${row('Yield 10Y 5 hari', m.yield10_5d, ' pp')}
      <div class="exp" style="margin-top:8px;color:var(--tx)"><b>🔗 Hubungan data terbaru → chart XAUUSD</b>
        <div class="small" style="margin-top:3px">Harga acuan <b>${num(j.price)}</b> · ${XE(j.priceSource || '—')} · ${pa.freshMinutes == null ? 'waktu candle tidak tersedia' : pa.freshMinutes + ' menit setelah candle terakhir'}. ${j.event && j.event.released ? 'Rilis ' + XE(j.event.title || j.event.tag) + ' sudah terbit; reaksi harga dihitung dari candle ' + XE((j.reaction && j.reaction.bar) || 'M5') + ' dan arah mesin ' + XE(j.direction || '—') + '.' : 'Rilis belum terbit; angka aktual tidak boleh dianggap sudah keluar.'}</div>
        <div class="small mut" style="margin-top:3px">Bandingkan dengan MT5 HFM/Exness: quote broker dapat berbeda dari TradingView/spot karena feed, spread, dan jam server. Jangan samakan harga acuan panel ini dengan harga eksekusi MT5; salin level lalu cek quote broker.</div>
      </div>
      <div class="small mut" style="margin-top:6px">Dipakai sebagai bukti arah di skor mesin, bukan angka dari AI.${m.tv ? ' TradingView gabungan ' + XE(m.tv.strength) + '% · harga ' + num(m.tv.price) + (m.tv.at ? ' · ' + new Date(m.tv.at).toLocaleTimeString('id-ID') : '') : ''}</div></div>`;
  }

  /* Wire emas & pair USD: kumpulan judul dari banyak situs, sudah disaring
     server supaya hanya topik emas/dolar/USD. Bukan angka, bukan sinyal. */
  function wireCard(j) {
    const w = j.goldWire;
    if (!w || !w.items || !w.items.length) return '';
    const c = w.coverage || {}, t = w.tone || {};
    const col = t.goldBias === 'BULLISH' ? 'var(--ok)' : t.goldBias === 'BEARISH' ? 'var(--no)' : 'var(--warn)';
    const rows = w.items.slice(0, 14);
    return `<div class="card"><div class="rb-card-head"><h3>📡 Wire emas & pair USD</h3><span class="rb-pill">${XE(c.items || rows.length)} judul · ${XE(c.distinctSources || 0)} sumber</span></div>
      <div class="small" style="margin-top:4px;color:${col}"><b>Nada berita: ${XE(t.label || 'netral')}</b> ${t.score == null ? '' : '(' + (t.score > 0 ? '+' : '') + XE(t.score) + ')'} · ${XE(t.note || '')}</div>
      <div class="small mut" style="margin-top:2px">${XE(c.fresh24h || 0)} judul ≤24 jam · ${XE(c.feedsActive || 0)}/${XE(c.feedsTotal || 0)} feed aktif + ${XE(c.queries || 0)} kueri Google News. Disaring server: hanya emas, dolar/DXY, pair USD, dan makro USD — topik lain (olahraga, hiburan, kripto) dibuang.</div>
      ${rows.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${XE(x.source || '')}${x.ageH != null ? ' · ' + XE(x.ageH) + ' jam lalu' : ''} · ${XE(x.topic)}${x.lean ? ' · ' + (x.lean > 0 ? '🟢 naik emas' : '🔴 turun emas') : ''}</div></span></div>`).join('')}
      ${w.items.length > rows.length ? `<div class="small mut" style="margin-top:4px">+${XE(w.items.length - rows.length)} judul lain tersimpan di data mesin/AI.</div>` : ''}
      <div class="small mut" style="margin-top:6px">Wire ini menjadi bahan konteks AI dan pemeriksaan kualitas data. Angka rilis tetap dari kalender & FRED; entry tetap dari mesin Signal.</div></div>`;
  }

  function paintNews(j, cached) {
    const out = X$('xNewsOut');
    if (!out) return;
    if (!j) { out.innerHTML = ''; return; }
    if (!j.ok) { out.innerHTML = `<div class="card"><div class="warn">${XE(j.error || 'Data tidak tersedia')}</div><div class="small mut" style="margin-top:6px">Server mencoba ulang otomatis; data tersimpan per akun tetap dipertahankan bila sudah ada.</div></div>`; return; }
    out.innerHTML = verdictCard(j) + timingCard(j) + releaseCompareCard(j) + eventCard(j) + panelCard(j) + evidenceCard(j) + docCard(j) + macroCard(j) + marketCard(j) + wireCard(j) + sourcesCard(j) + dataCard(j) + knowledgeCard(j.knowledge, 'Bukti global terpercaya: situs resmi, industri, media, YouTube & akademi emas') + (cached ? '<div class="small mut" style="margin-top:6px">Data tersimpan per akun — refresh otomatis berjalan tiap 20 menit.</div>' : '');
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
        <div class="rb-pill-row"><span class="rb-pill y">Entry M5</span><span class="rb-pill">SL 30 pip</span><span class="rb-pill">TP minimum 200 pip</span><span class="rb-pill">Scalp / Day / Swing terpisah</span><span class="rb-pill y">Auto-refresh 20 menit</span><span class="rb-pill">Belajar dari SL</span><span class="rb-pill">State per akun</span></div>
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
      /* Cache lokal juga per akun; jangan bawa hasil akun lain ke layar. */
      try { const c = sigCacheLoad(); if (c) { sigData = c.data; sigAt = Number(c.at) || Date.parse(c.data.generatedAt) || 0; } } catch (e) { }
      try { await sigStatePull(); } catch (e) { }
      if (!X$('sigOut')) return;
      if (sigData) {
        await histSync(sigData);
        const msg = X$('sigMsg');
        if (msg) msg.textContent = '💾 Hasil akun dibuka kembali · diperbarui ' + new Date(sigAt || Date.now()).toLocaleString('id-ID') + ' · refresh otomatis 20 menit.';
      }
      const tick = function () {
        const el = X$('sigNext');
        if (!el) { clearInterval(sigCd); sigCd = null; return; }
        if (sigBusy) { el.textContent = '⏳ Menghitung ulang dari candle terbaru…'; return; }
        const now = Date.now();
        const retry = sigRetryAt > now ? sigRetryAt - now : 0;
        const scheduled = Math.max(0, SIG_REFRESH_MS - (now - (sigAt || now)));
        const left = retry || scheduled;
        const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
        el.textContent = (retry ? 'Koneksi gagal · mencoba lagi dalam ' : 'Refresh otomatis dalam ') + m + ':' + String(s).padStart(2, '0') + ' · tanpa tombol';
      };
      tick();
      sigCd = setInterval(tick, 1000);
      requestSigRefresh(false);
      /* Watchdog: jangan bergantung pada satu setTimeout yang bisa dibekukan
         browser saat tab tidur. Cek tiap 15 detik + refresh saat tab aktif. */
      sigTimer = setInterval(function () {
        if (!X$('sigOut')) { clearInterval(sigTimer); sigTimer = null; return; }
        if (!sigBusy && Date.now() >= (sigRetryAt || 0) && (!sigData || Date.now() - (sigAt || 0) >= SIG_REFRESH_MS)) pSigRun(true);
        if (sigData && Date.now() - sigHistAt > 60000) { sigHistAt = Date.now(); try { histSync(sigData); } catch (e) { } }
      }, 15000);
      if (!window.__sigVis) {
        window.__sigVis = 1;
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState !== 'visible' || !X$('sigOut')) return;
          requestSigRefresh(false);
        });
      }
      if (!window.__sigPage) {
        window.__sigPage = 1;
        window.addEventListener('pageshow', function () { if (X$('sigOut')) requestSigRefresh(false); });
        window.addEventListener('online', function () { if (X$('sigOut')) requestSigRefresh(true); });
        window.addEventListener('focus', function () { if (X$('sigOut')) requestSigRefresh(false); });
      }
    })();
    boot.catch(function (e) { const m0 = X$('sigMsg'); if (m0) m0.textContent = '⚠️ ' + e.message; });
  };
  function requestSigRefresh(force) {
    if (!X$('sigOut')) return;
    if (force) { sigRetryAt = 0; if (sigData) syncHistoryNow(); }
    if (sigBusy) { sigWake = true; return; }
    if (Date.now() < sigRetryAt) return syncHistoryNow();
    if (force || !sigData || Date.now() - (sigAt || 0) >= SIG_REFRESH_MS) pSigRun(true);
    else syncHistoryNow();
  }
  function syncHistoryNow() {
    if (!sigData || !X$('sigOut')) return;
    sigHistAt = Date.now();
    histSync(sigData).catch(function () { });
  }
  window.pSigRun = async function (silent) {
    if (sigBusy) { sigWake = true; return; }
    if (Date.now() < sigRetryAt) return;
    sigBusy = true; sigWake = false;
    const msg = X$('sigMsg');
    if (msg) msg.textContent = 'Membaca candle live, TradingView, struktur Alchemist, lalu AI menandai chart…';
    try {
      /* Tarik catatan belajar akun dulu agar perangkat baru memakai hasil
         belajar yang sama. Gagal sinkron tidak menghalangi sinyal. */
      await Promise.all([learnPullSafe('news'), learnPullSafe('radar'), learnPullSafe('source')]);
      const j = await tcall({ action: 'xauSignal', fresh: true, learn: learnPayload() });
      if (j && j.ok !== false && !j.error) {
        sigData = j;
        sigAt = Date.parse(j.generatedAt) || Date.now();
        sigRetryAt = 0;
        sigCacheSave(j);
        /* Tarik + merge Firestore dulu, baru evaluasi/paint, lalu dorong lokal. */
        await histSync(j);
        try { sourceLearnSync(j); } catch (e) { }
        statePut('signal', null, j).catch(() => { });
        if (msg) msg.textContent = '✅ Siap — arah ' + j.direction + ' · ' + (j.setups || []).length + ' setup · diperbarui ' + new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID');
      } else {
        /* Jangan timpa hasil valid yang tersimpan; jika belum ada cache,
           tampilkan error dan jadwalkan percobaan berikutnya. */
        if (!sigData) sigAt = 0;
        sigRetryAt = Date.now() + 60000;
        if (!sigData) paintSignal(j || { ok: false, error: 'Data signal tidak tersedia' });
        if (msg) msg.textContent = '⚠️ ' + ((j && (j.error || 'gagal')) || 'gagal');
      }
    } catch (e) {
      if (!sigData) sigAt = 0;
      sigRetryAt = Date.now() + 60000;
      if (msg) msg.textContent = '⚠️ ' + e.message;
    }
    sigBusy = false;
    if (sigWake) {
      sigWake = false;
      if (Date.now() >= sigRetryAt) setTimeout(function () { if (X$('sigOut')) pSigRun(true); }, 0);
    }
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
  window.pChartTF = function (tf) {
    chartTF = ['ALL', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'].includes(tf) ? tf : 'ALL';
    try { localStorage.setItem('rb_xau_chart_tf', chartTF); } catch (e) { }
    if (sigData) paintSignal(sigData);
  };
  window.pChartLabels = function () {
    chartLabelAll = !chartLabelAll;
    try { localStorage.setItem('rb_xau_chart_labels', chartLabelAll ? 'all' : 'ringkas'); } catch (e) { }
    const b = X$('sigLabelToggle');
    if (b) b.textContent = chartLabelAll ? '🙈 Label ringkas' : '🏷️ Semua label';
    const n = X$('sigLabelNote');
    if (n && sigData) { const allTf = (sigData.markers || []).filter(m => chartTF === 'ALL' || m.tf === chartTF).length; n.textContent = chartLabelAll
      ? 'Semua ' + allTf + ' label ditampilkan; pada chart padat beberapa label bisa berdekatan.'
      : 'Menampilkan ' + chartLabelShown(sigData) + ' dari ' + allTf + ' label: satu per istilah + TF (maks 32), lalu yang terdekat. Tombol Semua label membuka seluruhnya.'; }
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
    const tg = (p.targets || []).filter(t => Number(t.pips) >= 200).map((t, i, a) => `<div class="item"><span><b>${i === a.length - 1 ? 'TPmax' : 'TP2'}</b> ${num(t.price)} <span class="small mut">${XE(t.pips)} pip · ${XE(t.src)}</span></span><span class="small" style="color:var(--ok)">${t.strength > 1 ? 'konfluensi ' + t.strength : 'likuiditas'}</span></div>`).join('');
    return `<div class="card" style="border-left:5px solid ${buy ? 'var(--ok)' : 'var(--no)'}">
      <div class="rb-card-head"><h3>🎯 Rencana entry M5</h3><span class="rb-pill ${p.status === 'SIAP' ? 'y' : ''}">${XE(p.status)} · ${XE(p.style)}</span></div>
      <div class="rb-pill-row" style="margin-top:8px">${modes}</div>
      <div class="rb-pill-row" style="margin-top:6px"><span class="rb-pill y">Entry M5</span><span class="rb-pill">SL 30 pip</span><span class="rb-pill">RR 1:${XE(p.rr)}</span><span class="rb-pill">${XE(p.type)}</span>${p.entryDistancePips != null ? `<span class="rb-pill ${p.tooClose ? '' : 'y'}">Jarak ${XE(p.entryDistancePips)} pip${p.minEntryPips != null ? ' · min ' + XE(p.minEntryPips) : ''}</span>` : ''}</div>
      <div class="rb-lv-grid" style="margin-top:8px">
        <div class="rb-lv"><span>Entry</span><b>${num(p.entry)}</b></div>
        <div class="rb-lv"><span>SL · 30 pip</span><b style="color:var(--no)">${num(p.sl)}</b></div>
        <div class="rb-lv"><span>TP2 · ${XE(p.tp2Pips)} pip</span><b style="color:var(--ok)">${num(p.tp2)}</b></div>
        <div class="rb-lv"><span>TPmax · ${XE(p.tpMaxPips)} pip</span><b style="color:var(--ok)">${num(p.tpMax)}</b></div>
        <div class="rb-lv"><span>Arah</span><b style="color:${buy ? 'var(--ok)' : 'var(--no)'}">${XE(p.dir)}</b></div>
      </div>
      ${tg ? `<div style="margin-top:8px"><div class="small mut" style="margin-bottom:2px">Tangga TP dari likuiditas nyata:</div>${tg}</div>` : ''}
      ${p.statusWhy ? `<div class="small" style="color:${p.tooClose ? 'var(--warn)' : 'var(--mut)'};margin-top:8px">${XE(p.statusWhy)}</div>` : ''}
      ${p.learning ? `<div class="small" style="color:${p.learning.blocked ? 'var(--no)' : 'var(--warn)'};margin-top:6px"><b>${p.learning.blocked ? '⛔ Ditahan pembelajaran' : '⚠️ Pola pernah SL'}:</b> ${XE(p.learning.label)} · ${XE(p.learning.losses)} SL / ${XE(p.learning.wins)} TP</div>` : ''}
      <div class="small mut" style="margin-top:8px">${XE(p.why)}</div>
      ${p.invalidation ? `<div class="small" style="color:var(--warn);margin-top:4px">Batal: ${XE(p.invalidation)}</div>` : ''}</div>`;
  }

  function signalVerdict(j) {
    const buy = j.direction === 'BUY';
    return `<div class="card"><div class="rb-card-head"><h3>📊 Arah tunggal</h3><span class="rb-dir ${buy ? 'buy' : 'sell'}">${XE(j.direction)}</span></div>
      <div class="small mut">Kekuatan ${XE(j.directionStrength)}% · harga ${num(j.price)} · ${XE(j.priceSource)} · ${XE(j.markers ? j.markers.length : 0)} tanda chart</div>
      <div class="rb-pill-row" style="margin-top:8px"><span class="rb-pill y">Entry M5</span>${j.freshness && j.freshness.dataLive ? `<span class="rb-pill ${j.freshness.candleAgeMin != null && j.freshness.candleAgeMin <= 10 ? 'y' : ''}">${j.freshness.candleAgeMin != null && j.freshness.candleAgeMin > 10 ? 'Candle tertunda ' + XE(j.freshness.candleAgeMin) + ' mnt' : 'Candle TradingView real-time'}</span>` : '<span class="rb-pill">Candle cadangan</span>'}<span class="rb-pill">ATR5 ${num(j.atr5)}</span><span class="rb-pill">RSI5 ${num(j.rsi5)}</span><span class="rb-pill">${XE(j.session && j.session.name)}</span><span class="rb-pill">${XE(j.daily && j.daily.trend)}</span>${j.adr ? `<span class="rb-pill">ADR ${XE(j.adr.avgPips)} pip</span>` : ''}<span class="rb-pill">Risiko ${XE(j.eventRisk && j.eventRisk.level)}</span></div>
      ${j.freshness ? `<div class="small mut" style="margin-top:6px">Harga ${j.freshness.priceAt ? new Date(j.freshness.priceAt).toLocaleTimeString('id-ID') : '—'} · candle M5 ${j.freshness.candleAgeMin != null ? (j.freshness.candleAgeMin > 120 ? Math.round(j.freshness.candleAgeMin / 60) + ' jam' : j.freshness.candleAgeMin + ' menit') : '—'} lalu · ${XE(j.freshness.candleSource)}</div>` : ''}
      ${j.biasConflict ? `<div class="warn" style="margin-top:8px">⚠️ Skor HTF dan trigger M5 berbeda. Arah final dipaksa mengikuti trigger M5 (${XE(j.m5TriggerDir || '—')}); setup yang melawan trigger tidak diaktifkan. Ini mencegah entry SELL saat candle M5 baru BOS BUY.</div>` : ''}
      ${j.marketOpen === false ? `<div class="warn" style="margin-top:8px">⚠️ Pasar tutup atau candle M5 tertunda. Semua setup berstatus TUNGGU sampai candle M5 baru muncul — bukan sinyal untuk entry sekarang.</div>` : ''}
      ${j.smcGate ? `<div class="${j.smcGate.ok ? 'small' : 'warn'}" style="margin-top:8px">${j.smcGate.ok ? '✅' : '⛔'} <b>SMC:</b> ${XE(j.smcGate.note)}${j.smcGate.ok && !j.smcGate.executable ? ' Entry belum aktif sampai syarat eksekusi terpenuhi.' : ''}</div>` : ''}
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

  function chartPick(j) {
    const all = (j.markers || []).filter(m => chartTF === 'ALL' || m.tf === chartTF);
    if (chartLabelAll) return all;
    const sorted = all.slice().sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || Math.abs(a.price - (j.price || 0)) - Math.abs(b.price - (j.price || 0)));
    const out = [], seen = new Set();
    /* Satu label per istilah + TF, supaya semua istilah Alchemist terwakili. */
    sorted.forEach(m => {
      const k = String(m.type || '') + '|' + String(m.tf || '');
      if (seen.has(k) || out.length >= 32) return;
      seen.add(k); out.push(m);
    });
    for (const m of sorted) { if (out.length >= 32) break; if (!out.includes(m)) out.push(m); }
    return out;
  }
  function chartLabelShown(j) { return chartPick(j).length; }
  function pineEsc(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' '); }
  function pineColor(t) {
    return ({ BOS: '#f59e0b', CHoCH: '#a78bfa', CHOCH: '#a78bfa', SWEEP: '#38bdf8', FVG: '#34d399', OB: '#fb7185', SNR: '#94a3b8', SND: '#38bdf8', MB: '#c084fc', OTE: '#facc15', PDH: '#f472b6', PDL: '#f472b6', LIQ: '#22d3ee', EQH: '#f97316', EQL: '#f97316', JUDAS: '#e879f9', ASIA: '#64748b', DO: '#e2e8f0', WO: '#e2e8f0', PD: '#fbbf24', SMT: '#f43f5e', POI: '#ffffff', WICK: '#fde047', FVG50: '#fbbf24', BPR: '#22d3ee', REJECT: '#fb7185', IFVG: '#2dd4bf', ERL: '#818cf8', DISP: '#f59e0b', ENGULF: '#c084fc', IDM: '#fbbf24', AMD: '#f59e0b', FIB: '#facc15' }[t] || '#94a3b8');
  }
  /* Ekspor statis dari sinyal aktif. TradingView tidak punya API publik untuk
     menulis drawing ke akun pengguna; Pine Script adalah jalur resmi agar
     penanda bisa dipasang dan disimpan sendiri di akun TradingView. */
  function buildPine(j) {
    if (!j || j.ok === false || j.error) return '';
    const ap = modeOf(j, sigMode) || j.plan;
    const plans = (j.setups || []).filter(s => s && s.status === 'SIAP' && s.entry != null);
    if (!plans.length && ap) plans.push(ap);
    const markers = (j.markers || []).filter(m => m && m.price != null && isFinite(m.price));
    const out = [];
    const add = (s) => out.push(s);
    add('//@version=5');
    add('// Alchemist XAUUSD — sinyal aktif ' + pineEsc(j.generatedAt || ''));
    add('// Setiap label memakai waktu candle asal marker; entry tetap M5.');
    add('// Chart: ' + pineEsc(j.tvSymbol || 'FOREXCOM:XAUUSD') + ' · arah ' + pineEsc(j.direction || '—') + ' · mode ' + pineEsc(sigMode));
    add('// Tempel di Pine Editor TradingView, Add to chart, lalu Save agar tersimpan di akun.');
    add('indicator("Alchemist XAUUSD — signal aktif", overlay=true, max_lines_count=500, max_labels_count=500, max_boxes_count=500)');
    add('showLabels = input.bool(true, "Tampilkan label")');
    add('labelMode = input.string("Ringkas", "Label", options=["Ringkas", "Semua"])');
    add('extendRight = input.int(8, "Bars ke kanan", minval=0, maxval=100)');
    add('var bool drawnOnce = false');
    add('var table sigTable = table.new(position.top_right, 2, 7, bgcolor=color.new(#0f172a, 10), border_color=color.new(#64748b, 60), border_width=1)');
    add('if barstate.islast and not drawnOnce');
    add('    drawnOnce := true');
    add('    table.cell(sigTable, 0, 0, "XAUUSD", text_color=#e2e8f0, text_size=size.small)');
    add('    table.cell(sigTable, 0, 1, "Arah", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 1, ' + JSON.stringify(String(j.direction || '—')) + ', text_color=' + (j.direction === 'BUY' ? '#22c55e' : '#ef4444') + ', text_size=size.small)');
    add('    table.cell(sigTable, 0, 2, "Mode", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 2, ' + JSON.stringify(String(sigMode)) + ', text_color=#e2e8f0, text_size=size.tiny)');
    add('    table.cell(sigTable, 0, 3, "Harga", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 3, ' + JSON.stringify(String(j.price == null ? '—' : Number(j.price).toFixed(2))) + ', text_color=#e2e8f0, text_size=size.tiny)');
    add('    table.cell(sigTable, 0, 4, "Sumber", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 4, ' + JSON.stringify(String(j.tvSymbol || 'FOREXCOM:XAUUSD')) + ', text_color=#e2e8f0, text_size=size.tiny)');
    add('    table.cell(sigTable, 0, 5, "Label", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 5, labelMode, text_color=#e2e8f0, text_size=size.tiny)');
    add('    table.cell(sigTable, 0, 6, "Entry", text_color=#94a3b8, text_size=size.tiny)');
    add('    table.cell(sigTable, 1, 6, "M5 · LIMIT", text_color=#e2e8f0, text_size=size.tiny)');
    const rows = ((j.chart && j.chart.m5) || []).slice(-120);
    const rh = rows.length ? Math.max(...rows.map(r => r.h)) : null;
    const rl = rows.length ? Math.min(...rows.map(r => r.l)) : null;
    const span = rh != null && rl != null ? Math.max(2, Math.min(40, rh - rl)) : 8;
    const items = [];
    const addItem = (price, text, color, priority, at) => {
      if (price == null || !isFinite(price)) return;
      const ts = at ? Date.parse(at) : NaN;
      items.push({ price: Number(price), text: String(text || ''), color, priority: priority || 1, at: isFinite(ts) ? ts : null });
    };
    const lane = (list, maxLabels) => {
      const arr = list.slice(0, maxLabels).sort((a, b) => a.price - b.price);
      if (!arr.length) return [];
      /* Label dari candle/waktu berbeda tidak perlu ditumpuk: taruh dekat
         harga aslinya. Hanya label pada waktu yang sama yang diberi lane. */
      const groups = new Map();
      arr.forEach(it => { const k = it.at || 'last'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
      const out = [];
      groups.forEach(g => {
        g.sort((a, b) => a.price - b.price);
        const gap = Math.max(0.25, Math.min(1.5, span / 30));
        let last = -Infinity;
        g.forEach(it => {
          const labelY = Math.max(it.price + gap * 0.12, last + gap);
          last = labelY;
          out.push({ ...it, labelY });
        });
      });
      return out;
    };
    const drawLine = (price, text, color, style, priority, at) => {
      if (!isFinite(price)) return;
      add('    line.new(x1=bar_index - 120, y1=' + Number(price).toFixed(2) + ', x2=bar_index + extendRight, y2=' + Number(price).toFixed(2) + ', xloc=xloc.bar_index, color=' + color + ', style=' + (style || 'line.style_dashed') + ', width=1)');
      if (text) addItem(price, text, color, priority || 1, at);
    };
    markers.forEach(m => {
      const price = Number(m.price);
      addItem(price, String(m.type || '?') + (m.tf ? ' ' + m.tf : '') + ' ' + price.toFixed(1), pineColor(m.type), m.active ? 2 : 1, m.at);
    });
    const seenPlan = new Set();
    plans.forEach(s => {
      const style = String(s.style || 'PLAN'), sig = [style, s.entry, s.sl].join('|');
      if (seenPlan.has(sig)) return; seenPlan.add(sig);
      drawLine(Number(s.entry), style + ' M5 ENTRY ' + Number(s.entry).toFixed(2), '#e2e8f0', 'line.style_solid', 2);
      drawLine(Number(s.sl), style + ' M5 SL ' + Number(s.sl).toFixed(2), '#ef4444', 'line.style_solid', 2);
      drawLine(Number(s.tp2), style + ' M5 TP2 ' + Number(s.tp2).toFixed(2), '#22c55e', null, 2);
      if (s.tpMax && s.tpMax !== s.tp2) drawLine(Number(s.tpMax), style + ' M5 TPMAX ' + Number(s.tpMax).toFixed(2), '#86efac', null, 2);
    });
    /* Label tidak lagi semua di satu titik. Mode Ringkas (default) memakai
       maksimal 12 prioritas; mode Semua memakai lane harga terpisah agar
       label multi-timeframe tidak bertumpuk. */
    const anchor = j.price == null ? items.reduce((a, x) => a + x.price, 0) / Math.max(1, items.length) : Number(j.price);
    const compact = items.slice().sort((a, b) => (b.priority - a.priority) || (Math.abs(a.price - anchor) - Math.abs(b.price - anchor))).slice(0, 12);
    const labelBlock = (list, mode) => {
      if (!list.length) return;
      add('    if labelMode == "' + mode + '" and showLabels');
      lane(list, mode === 'Ringkas' ? 12 : 200).forEach(it => {
        const p = Number(it.price).toFixed(2);
        /* Label TF yang levelnya jauh dari harga M5 tetap ditampilkan di rail
           atas/bawah chart. Teks tetap memuat harga asli, jadi tidak salah baca. */
        const rail = Math.max(2, span * .95);
        const far = it.price > anchor + rail || it.price < anchor - rail;
        const lyNum = far ? (it.price > anchor ? anchor + rail : anchor - rail) : it.labelY;
        const ly = Number(lyNum).toFixed(2);
        const text = String(it.text) + (far ? (it.price > anchor ? ' ↑ ' : ' ↓ ') + 'rail' : '');
        if (it.at) {
          add('        line.new(x1=' + it.at + ', y1=' + p + ', x2=' + it.at + ', y2=' + ly + ', xloc=xloc.bar_time, color=' + it.color + ', style=line.style_dotted, width=1)');
          add('        label.new(x=' + it.at + ', y=' + p + ', text="•", xloc=xloc.bar_time, style=label.style_label_center, color=color.new(#0f172a, 100), textcolor=' + it.color + ', size=size.tiny)');
          add('        label.new(x=' + it.at + ', y=' + ly + ', text=' + JSON.stringify(text) + ', xloc=xloc.bar_time, style=label.style_label_left, color=color.new(#0f172a, 12), textcolor=' + it.color + ', size=size.tiny)');
        } else {
          add('        line.new(x1=bar_index + 2, y1=' + p + ', x2=bar_index + 2, y2=' + ly + ', xloc=xloc.bar_index, color=' + it.color + ', style=line.style_dotted, width=1)');
          add('        label.new(x=bar_index + 4, y=' + ly + ', text=' + JSON.stringify(text) + ', xloc=xloc.bar_index, style=label.style_label_left, color=color.new(#0f172a, 12), textcolor=' + it.color + ', size=size.tiny)');
        }
      });
    };
    labelBlock(compact, 'Ringkas');
    labelBlock(items, 'Semua');
    return out.join('\n') + '\n';
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  function currentPine() {
    if (!sigData) { toast('Belum ada sinyal aktif untuk diekspor.'); return ''; }
    const s = buildPine(sigData);
    if (!s) { toast('Sinyal aktif belum lengkap; coba refresh sinyal.'); return ''; }
    return s;
  }
  window.pPineCopy = async function () {
    const s = currentPine(); if (!s) return;
    const ok = await copyText(s);
    toast(ok ? '📋 Pine Script disalin. Tempel di TradingView → Pine Editor → Add to chart → Save.' : '⚠️ Clipboard tidak tersedia; gunakan tombol Unduh .pine.');
  };
  window.pPineDownload = function () {
    const s = currentPine(); if (!s) return;
    try {
      const blob = new Blob([s], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'alchemist-xau-' + String(sigMode).toLowerCase() + '-' + new Date().toISOString().slice(0, 10) + '.pine';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('⬇️ File .pine diunduh. Pasang di Pine Editor TradingView lalu Save.');
    } catch (e) { toast('⚠️ Gagal mengunduh: ' + e.message); }
  };

  function chartCard(j) {
    const types = {};
    (j.markers || []).forEach(m => { types[m.type] = (types[m.type] || 0) + 1; });
    const nAll = (j.markers || []).filter(m => chartTF === 'ALL' || m.tf === chartTF).length, nShow = chartLabelShown(j);
    return `<div class="card"><div class="rb-card-head"><h3>🏷️ Chart live M5 + layer multi-timeframe</h3><span class="rb-pill" id="sigStamp">${j.generatedAt ? new Date(j.generatedAt).toLocaleTimeString('id-ID') : '—'}</span></div>
      <canvas id="xSigChart" title="Gulir untuk zoom, atau pakai tombol di bawah" style="width:100%;height:380px;display:block;margin-top:6px"></canvas>
      <div class="rb-pill-row" style="margin-top:8px;align-items:center"><button class="x" type="button" onclick="xSigZoom(-1)">🔍 Perbesar</button><span class="rb-pill" id="sigZoomLabel">${sigChartBars} candle</span><button class="x" type="button" onclick="xSigZoom(1)">🔍 Perkecil</button><button class="x" type="button" onclick="xSigZoom(0)">Reset</button><button class="x" type="button" id="sigLabelToggle" onclick="pChartLabels()">${chartLabelAll ? '🙈 Label ringkas' : '🏷️ Semua label'}</button></div>
      <div class="rb-pill-row" style="margin-top:6px;align-items:center"><span class="small mut">Layer TF:</span>${['ALL', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'].map(tf => `<button class="x" type="button" onclick="pChartTF('${tf}')" style="${chartTF === tf ? 'border-color:var(--b);color:var(--b)' : ''}">${tf}</button>`).join('')}<a class="x" href="https://www.tradingview.com/chart/?symbol=FOREXCOM%3AXAUUSD&interval=${chartTF === 'M15' ? '15' : chartTF === 'H1' ? '60' : chartTF === 'H4' ? '240' : chartTF === 'D1' ? 'D' : chartTF === 'W1' ? 'W' : '5'}" target="_blank" rel="noopener" style="text-decoration:none">🔗 Buka TradingView</a></div>
      <div class="small mut" id="sigLabelNote" style="margin-top:6px">${chartLabelAll ? 'Semua ' + nAll + ' label ditampilkan; pada chart padat beberapa label bisa berdekatan.' : 'Menampilkan ' + nShow + ' dari ' + nAll + ' label: satu per istilah + TF (maks 32), lalu yang terdekat. Tombol <b>Semua label</b> membuka seluruhnya.'} Label TF lama yang di luar window M5 tampil di tepi kanan sebagai label level, bukan ditempel ke candle palsu.</div>
      <div class="rb-pill-row" style="margin-top:8px;align-items:center"><button class="x" type="button" onclick="pPineCopy()">📋 Salin Pine Script</button><button class="x" type="button" onclick="pPineDownload()">⬇️ Unduh .pine</button><span class="small mut">Pine: label Ringkas (default) / Semua</span></div>
      <div class="rb-pill-row" style="margin-top:8px">${Object.keys(types).map(t => `<span class="rb-pill">${XE(t)} · ${types[t]}</span>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Setiap istilah membawa TF asalnya (mis. <b>BOS M5</b>, <b>FVG M15</b>, <b>OB H4</b>, <b>PDH D1</b>, <b>WO W1</b>) dan titik penanda memakai timestamp candle asal dari server—bukan candle terdekat yang kebetulan menyentuh harga. Eksekusi tetap <b>entry M5</b>; HTF hanya konteks/POI. Candle M5 dari ${j.freshness ? XE(j.freshness.candleSource) : 'TradingView'}; semua dihitung ulang dari candle terbaru dan di-anchor ke harga TradingView (${j.chart ? XE(j.chart.anchor) : '—'}). TradingView tidak menyediakan API publik untuk menulis gambar ke akun pengguna; gunakan <b>Pine Script</b> di atas, tempel di Pine Editor, Add to chart, lalu Save agar penanda tersimpan di layout akun TradingView.</div></div>`;
  }

  function marksCard(j) {
    const ms = j.markers || [];
    if (!ms.length) return '';
    return `<div class="card"><h3>🏷️ Tanda chart & catatan AI</h3>${ms.map(m => `<div class="item"><span><b>${XE(m.type)} · ${XE(m.tf || '—')}</b> · ${XE(m.label)} <span class="mut small">${num(m.price)}${m.at ? ' · ' + XE(new Date(m.at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })) : ''}</span><div class="small mut">${XE(m.why)} · entry ${XE(m.entryTf || 'M5')}</div>${m.ai ? `<div class="small" style="color:var(--warn)">🧠 ${XE(m.ai.note)} <span class="mut">(${XE(m.ai.confidence)})</span></div>` : ''}</span></div>`).join('')}</div>`;
  }

  function setupsCard(j) {
    const ss = j.setups || [];
    return `<div class="card"><div class="rb-card-head"><h3>🎯 ${ss.length} setup satu arah (${XE(j.direction)})</h3><span class="rb-pill">SL 30 pip</span></div>
      ${ss.map(s => `<div class="exp" style="color:var(--tx);margin-top:6px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${XE(s.style)} · ${XE(s.dir)}</b><span class="small" style="color:${s.status === 'SIAP' ? 'var(--ok)' : 'var(--mut)'}">${XE(s.status)}</span></div>
        <div class="small">Entry ${XE(s.entryTf || 'M5')} ${num(s.entry)} (${XE(s.type)}${s.entryMode === 'WICK' ? ' · pucuk wick' : s.entryMode === 'FVG50' ? ' · FVG 50%' : ''}) · POI ${XE(s.poiTf || '—')} · SL ${num(s.sl)} · TP2 ${num(s.tp2)} · TPmax ${num(s.tpMax)} (${XE(s.tpMaxPips)} pip)</div>
        ${s.pattern ? `<div class="small" style="color:var(--ok)">🧩 ${XE(s.pattern.label)}</div>` : ''}
        ${(s.confluence || []).length ? `<div class="small mut">🔗 Konfluensi: ${XE((s.confluence || []).join(' · '))}</div>` : ''}
        ${s.wick ? `<div class="small" style="color:var(--warn)">📍 ${XE(s.wick.note)}</div>` : s.fvg50 ? `<div class="small" style="color:var(--warn)">📍 ${XE(s.fvg50.note)}</div>` : ''}
        ${s.statusWhy ? `<div class="small" style="color:${s.tooClose ? 'var(--warn)' : 'var(--mut)'}">${XE(s.statusWhy)}</div>` : ''}
        ${s.smc ? `<div class="small" style="color:${s.smc.grade === 'A+' || s.smc.grade === 'A' ? 'var(--ok)' : s.smc.grade === 'D' ? 'var(--warn)' : 'var(--mut)'}"><b>SMC ${XE(s.smc.grade)}</b> · fase ${XE(s.smc.phase || '—')} · ${s.smc.killzone && s.smc.killzone.active ? 'kill zone aktif' : 'di luar kill zone'} · PD ${XE(s.smc.pd && s.smc.pd.zone || '—')} · sweep ${XE(s.smc.sweep && s.smc.sweep.pool || '—')} · fib ${s.smc.fib && s.smc.fib.ok ? 'siap' : 'belum'} · ${XE(s.smc.optional || 0)}/${XE(s.smc.optionalTotal || 0)} konfirmasi</div>` : ''}
        ${(s.entrySteps || []).length ? `<div class="small" style="margin-top:4px;color:var(--tx)"><b>Cara entry:</b>${s.entrySteps.map(x => `<div style="margin-top:2px">${XE(x)}</div>`).join('')}</div>` : ''}
        ${s.learning ? `<div class="small" style="color:${s.learning.blocked ? 'var(--no)' : 'var(--warn)'}"><b>${s.learning.blocked ? '⛔ Pembelajaran menahan entry' : '⚠️ Pola berisiko'}:</b> ${XE(s.learning.label)} · ${XE(s.learning.losses)} SL / ${XE(s.learning.wins)} TP${(s.learning.reasons || []).length ? ' · ' + XE((s.learning.reasons || []).join('; ')) : ''}</div>` : ''}
        <div class="small mut">${XE(s.why)}</div></div>`).join('') || '<div class="warn">Belum ada setup yang lolos filter. Bias HTF, POI, atau trigger M5 belum searah; jangan paksa entry di luar rencana.</div>'}</div>`;
  }

  function smcCard(j) {
    const s = j.smc;
    if (!s || s.ok === false) return `<div class="card"><div class="rb-card-head"><h3>🧭 Mesin SMC / AMD</h3><span class="rb-pill">tidak tersedia</span></div><div class="warn">${XE((s && s.note) || 'Mesin SMC tidak tersedia.')}</div></div>`;
    const k = s.killzone || {}, pd = s.pd || {}, amd = s.amd || {}, htf = s.htf || {}, flow = s.flow || {};
    const rows = [
      ['Bias HTF', htf.note || '—'],
      ['Struktur M5', flow.m5 ? flow.m5.note : '—'],
      ['Struktur M15', flow.m15 ? flow.m15.note : '—'],
      ['Likuiditas', (s.sweep ? s.sweep.note : 'Belum ada sweep valid') + (s.eq && (s.eq.highs.length || s.eq.lows.length) ? ' · EQH ' + s.eq.highs.length + ' / EQL ' + s.eq.lows.length : '')],
      ['Premium/Discount', pd.note || '—'],
      ['AMD', amd.note || '—'],
      ['Engulfing M15', s.engulf && s.engulf.m15 ? s.engulf.m15.note : 'belum ada'],
      ['IDM', s.idm ? s.idm.note : 'belum terbaca'],
      ['BPR', s.bpr ? s.bpr.note : 'belum ada dua FVG bertumpuk'],
      ['IFVG', (s.ifvg || []).length ? s.ifvg.map(x => x.note).join(' · ') : 'belum ada FVG yang terbalik'],
      ['Rejection', s.rejection ? s.rejection.note : 'belum ada wick dominan'],
      ['Breaker / mitigation', s.breaker ? s.breaker.note : 'belum ada OB gagal yang ditembus'],
      ['Pattern ABC / flip', s.flip ? s.flip.note : 'belum terbaca'],
      ['Liquidity grab', s.grab ? s.grab.note : 'belum ada stop hunt 3 candle terakhir'],
      ['IPDA', s.ipda ? s.ipda.note : 'butuh minimal 12 candle D1/H4 untuk rentang IPDA (label 20/40/60 hari hanya dipakai bila cakupannya nyata)'],
      ['IRL/ERL', s.irlErl ? s.irlErl.note : 'belum terbaca'],
      ['PD array', (s.pdArray || []).length ? s.pdArray.map(x => x.type + ' ' + x.lo + '–' + x.hi + (x.pd ? ' (' + x.pd + ')' : '')).join(' · ') : 'belum ada zona dekat'],
      ['Kill zone', k.note || '—']
    ];
    const z = (arr) => (arr || []).slice(-2).map(x => (x.src || '') + ' ' + x.lo + '–' + x.hi).join(' · ') || '—';
    return `<div class="card"><div class="rb-card-head"><h3>🧭 Mesin SMC / AMD</h3><span class="rb-pill ${k.active ? 'y' : ''}">${XE(k.active ? k.name : 'di luar kill zone')}</span></div>
      <div class="small" style="margin-top:6px;font-weight:700">${XE(s.note || '')}</div>
      ${rows.map(x => `<div class="item"><span>${XE(x[0])}</span><span class="small mut" style="text-align:right">${XE(x[1])}</span></div>`).join('')}
      <div class="small" style="margin-top:8px"><b>POI M5 unmitigated:</b> ${XE(z(s.fvg && s.fvg.m5))}${s.ob && s.ob.m5 && s.ob.m5.length ? ' · OB ' + XE(z(s.ob.m5)) : ''}</div>
      ${s.fib ? `<div style="margin-top:8px"><b class="small">Fib golden ratio + candle momentum (${XE(s.fib.tf)} ${XE(s.fib.dir)})</b>${(s.fib.steps || []).map(x => `<div class="small" style="margin-top:2px">• ${XE(x)}</div>`).join('')}</div>` : ''}
      <div class="small mut" style="margin-top:6px">Level dihitung dari candle nyata; tidak ada angka karangan. Entry hanya valid bila bias HTF, PD 50%, POI, CHoCH/BOS + displacement/engulfing, sweep, fib OTE, kill zone, dan SL 30 pip terpenuhi.</div>
    </div>`;
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
  let histSyncBusy = false, histSyncPending = null;
  async function histSync(j) {
    if (histSyncBusy) { histSyncPending = j; return; }
    histSyncBusy = true;
    try {
      await histPull();
      learnApply(j);
      try { histUpdate(j); } catch (e) { }
      paintSignal(j);
      histPushLocal();
      histPushDeleted().catch(function () { });
    } finally {
      histSyncBusy = false;
      if (histSyncPending) { const n = histSyncPending; histSyncPending = null; setTimeout(function () { histSync(n); }, 0); }
    }
  }

  function paintSignal(j) {
    const out = X$('sigOut');
    if (!out) return;
    if (!j || j.error) { out.innerHTML = `<div class="card"><div class="warn">${XE((j && j.error) || 'Tidak ada data')}</div><div class="small mut" style="margin-top:6px">Riwayat tetap tersimpan; refresh otomatis dicoba lagi dalam 60 detik dan saat tab/koneksi aktif kembali.</div></div>` + learningCard({ setups: [] }) + histCard(); return; }
    const chip = X$('tvPrice');
    if (chip) chip.textContent = 'harga ' + num(j.price) + ' · ' + new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID');
    learnApply(j);
    out.innerHTML = signalVerdict(j) + planCard(j) + globalCard(j) + checklistCard(j) + smcCard(j) + methodCard(j) + tfCard(j) + chartCard(j) + setupsCard(j) + marksCard(j) + aiCard(j) + learningCard(j) + histCard();
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
      if (p == null || !isFinite(p)) return;
      const outside = p > hi || p < lo;
      const py = outside ? (p > hi ? padT + 10 : H - padB - 4) : y(p);
      const text = outside ? label + (p > hi ? ' ↑' : ' ↓') : label;
      g.save();
      g.strokeStyle = color; g.lineWidth = 1; g.globalAlpha = .85; g.setLineDash(dash ? [4, 4] : []);
      g.beginPath(); g.moveTo(padL, py); g.lineTo(W - padR, py); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      g.textAlign = 'left'; g.font = '700 9px Manrope, sans-serif';
      const tw = Math.min(padR - 6, g.measureText(text).width);
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
      g.fillStyle = color; g.fillText(text, box.x + 1, ly);
      g.restore();
    };
    const colors = { BOS: '#f59e0b', CHoCH: '#a78bfa', CHOCH: '#a78bfa', SWEEP: '#38bdf8', FVG: '#34d399', OB: '#fb7185', SNR: '#94a3b8', SND: '#38bdf8', MB: '#c084fc', OTE: '#facc15', PDH: '#f472b6', PDL: '#f472b6', LIQ: '#22d3ee', EQH: '#f97316', EQL: '#f97316', JUDAS: '#e879f9', ASIA: '#64748b', DO: '#e2e8f0', WO: '#e2e8f0', PD: '#fbbf24', SMT: '#f43f5e', POI: '#ffffff', WICK: '#fde047', FVG50: '#fbbf24', BPR: '#22d3ee', REJECT: '#fb7185', IFVG: '#2dd4bf', ERL: '#818cf8', DISP: '#f59e0b', ENGULF: '#c084fc', IDM: '#fbbf24', AMD: '#f59e0b', FIB: '#facc15' };
    /* Hanya label + teks + titik penanda. Titik memakai timestamp candle asal
       dari server (m.at); fallback ke candle yang menyentuh level hanya bila
       candle asal berada di luar window chart. */
    const tagBoxes = [];
    const anchorOf = (m) => {
      const at = m.at ? Date.parse(m.at) : NaN;
      if (isFinite(at)) {
        /* Jangan menempelkan label HTF kuno ke candle pertama yang terlihat:
           itu membuat penanda salah posisi. Marker di luar window digambar
           di tepi kanan sebagai label level, tanpa titik candle palsu. */
        if (at < rows[0].t - 300000 || at > rows[rows.length - 1].t + 300000) return -1;
        let best = rows.length - 1, bd = Infinity;
        rows.forEach((r, i) => { const d = Math.abs(r.t - at); if (d < bd) { bd = d; best = i; } });
        return best;
      }
      const z = Array.isArray(m.zone) ? m.zone : null;
      const zLo = z ? Math.min(z[0], z[1]) : m.price, zHi = z ? Math.max(z[0], z[1]) : m.price;
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.h >= zLo - 0.35 && r.l <= zHi + 0.35) return i;
      }
      return rows.length - 1;
    };
    const markerTag = (m) => {
      if (m.price == null || !isFinite(m.price)) return;
      const color = colors[m.type] || '#94a3b8';
      const outside = m.price > hi || m.price < lo;
      const idx = outside ? -1 : anchorOf(m);
      const off = idx < 0;
      const ax = off ? W - padR - 5 : x(idx) + bw / 2;
      const py = outside ? (m.price > hi ? padT + 10 : H - padB - 4) : y(m.price);
      const r = off ? null : rows[idx];
      const above = outside ? m.price > hi : m.price >= lastC;
      const text = String(m.type || '?') + (m.tf ? ' ' + m.tf : '') + ' ' + Number(m.price).toFixed(1) + (m.ai ? ' •' : '') + (outside ? (m.price > hi ? ' ↑' : ' ↓') : '');
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
      /* Titik tepat di candle asal + garis tipis ke label. */
      g.strokeStyle = color; g.globalAlpha = .38; g.lineWidth = 1; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(ax, off ? py : (above ? y(r.h) : y(r.l))); g.lineTo(ax, py); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      g.fillStyle = color;
      g.beginPath(); g.arc(ax, off ? py : (above ? y(r.h) : y(r.l)), off ? 1.6 : 2.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = color; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(ax, above ? py - 2 : py + 2); g.lineTo(bx + (bx >= ax ? -1 : tw + 1), ly + (ly > py ? -7 : 3)); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(15,23,42,.90)'; g.fillRect(bx - 1, ly - 8, tw + 2, 11);
      g.fillStyle = color; g.fillText(text, bx + 1, ly);
      g.restore();
    };
    const msShown = chartPick(j);
    msShown.forEach(markerTag);
    if (ap) {
      level(ap.entry, '#e2e8f0', 'Entry ' + Number(ap.entry).toFixed(2), false);
      level(ap.sl, '#ef4444', 'SL ' + Number(ap.sl).toFixed(2), false);
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
  /* Dipakai oleh skrip validasi lokal; tidak mengubah alur UI. */
  window.__pineExport = function (data, mode) { if (mode) sigMode = mode; return buildPine(data); };
})();
