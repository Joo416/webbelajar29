/* ==========================================================================
   PANEL MUSIK YOUTUBE — diputar langsung dari web memakai IFrame Player API
   resmi YouTube. Fitur: cari video (lewat /api/yt yang dijaga token Firebase),
   tempel tautan, antrean, putar/jeda, hentikan, sebelumnya/berikutnya, volume,
   seek, minimize (tidak menutupi halaman), dan layar penuh.

   Login aplikasi wajib. Token Firebase dikirim di header Authorization setiap
   pencarian; tanpa token, pencarian ditolak server. Tombol YouTube disediakan
   hanya untuk playlist pribadi yang memang butuh akun YouTube di browser ini.
   ========================================================================== */
(function () {
  'use strict';

  var RBM = {
    panel: null, player: null, ready: false, apiLoading: false, apiFailed: false,
    queue: [], index: -1, playing: false, pending: null,
    volume: 70, muted: false, timer: 0, results: [], note: '',
    minimized: false, full: false, searchBusy: false, wantPlay: false
  };
  var DEF_ID = 'jfKfPfyJRdk';
  var CHIPS = ['Lofi', 'Jazz santai', 'Piano fokus', 'Suara hujan', 'The 1975', 'Musik tidur'];

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem('rbm_' + k);
      if (v === null) localStorage.removeItem('rbm_' + k); else localStorage.setItem('rbm_' + k, String(v));
    } catch (e) { }
    return null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function setText(id, t) { var e = $(id); if (e) e.textContent = t; }

  /* ---------- sesi ---------- */
  function curUser() {
    if (window.rbUser && window.rbUser.uid) return window.rbUser;
    if (window.user && window.user.uid) return window.user;
    try { if (window.firebase && window.firebase.auth) return window.firebase.auth().currentUser || null; } catch (e) { }
    return null;
  }
  function token() {
    return new Promise(function (resolve, reject) {
      var u = curUser();
      if (!u || typeof u.getIdToken !== 'function') {
        reject(new Error('Kamu belum masuk. Muat ulang halaman lalu masuk dengan akun Google.'));
        return;
      }
      u.getIdToken(false).then(function (t) { resolve(t); }, function () {
        u.getIdToken(true).then(function (t) { resolve(t); }, function (e) {
          reject(new Error('Sesi login tidak bisa dibaca: ' + ((e && e.message) || e)));
        });
      });
    });
  }
  function userName() {
    var u = curUser();
    return (u && (u.displayName || u.email)) || '';
  }

  /* ---------- kerangka panel ---------- */
  function build() {
    if (RBM.panel) return;
    var wrap = document.createElement('section');
    wrap.id = 'rbMusicPanel';
    wrap.className = 'rbm';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Pemutar musik YouTube');
    wrap.innerHTML =
      '<header class="rbm-head">' +
        '<div class="rbm-logo" aria-hidden="true">♪</div>' +
        '<div class="rbm-now">' +
          '<b id="rbm-title">Musik Belajar</b>' +
          '<span id="rbm-sub">Cari lagu untuk mulai</span>' +
        '</div>' +
        '<div class="rbm-win">' +
          '<button type="button" class="rbm-mini-play" id="rbm-miniplay" onclick="rbMusicToggle()" aria-label="Putar atau jeda" title="Putar / jeda">▶</button>' +
          '<button type="button" class="rbm-ico" onclick="rbMusicMin()" aria-label="Minimize" title="Kecilkan">—</button>' +
          '<button type="button" class="rbm-ico" id="rbm-fsbtn" onclick="rbMusicFull()" aria-label="Layar penuh" title="Layar penuh">⛶</button>' +
          '<button type="button" class="rbm-ico danger" onclick="rbMusicClose()" aria-label="Tutup" title="Tutup">✕</button>' +
        '</div>' +
      '</header>' +
      '<div class="rbm-body">' +
        '<div class="rbm-stage">' +
          '<div class="rbm-frame"><div id="rbm-player"></div>' +
            '<div class="rbm-skel" id="rbm-loading"><i class="rbm-spin"></i><em>Menyiapkan pemutar…</em></div>' +
          '</div>' +
          '<span class="rbm-tag" id="rbm-badge">YouTube</span>' +
        '</div>' +
        '<div class="rbm-progress">' +
          '<input id="rbm-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Posisi lagu">' +
          '<div class="rbm-times"><span id="rbm-cur">0:00</span><span id="rbm-dur">0:00</span></div>' +
        '</div>' +
        '<div class="rbm-row">' +
          '<div class="rbm-transport">' +
            '<button type="button" class="rbm-btn" onclick="rbMusicPrev()" aria-label="Sebelumnya" title="Sebelumnya">⏮</button>' +
            '<button type="button" class="rbm-btn main" id="rbm-play" onclick="rbMusicToggle()" aria-label="Putar atau jeda" title="Putar / jeda">▶</button>' +
            '<button type="button" class="rbm-btn" onclick="rbMusicNext()" aria-label="Berikutnya" title="Berikutnya">⏭</button>' +
            '<button type="button" class="rbm-btn" onclick="rbMusicStop()" aria-label="Hentikan" title="Hentikan">⏹</button>' +
          '</div>' +
          '<div class="rbm-vol">' +
            '<button type="button" class="rbm-vol-ico" id="rbm-mute" onclick="rbMusicMute()" aria-label="Bisukan" title="Bisukan">🔊</button>' +
            '<input id="rbm-vol" type="range" min="0" max="100" value="70" aria-label="Volume">' +
          '</div>' +
        '</div>' +
        '<form class="rbm-find" onsubmit="rbMusicSearch();return false">' +
          '<input id="rbm-q" type="search" autocomplete="off" spellcheck="false" placeholder="Cari lagu, artis, atau tempel tautan YouTube">' +
          '<button type="submit" class="rbm-go" aria-label="Cari lagu">Cari</button>' +
        '</form>' +
        '<div class="rbm-chips" id="rbm-chips"></div>' +
        '<div class="rbm-list" id="rbm-results"></div>' +
        '<div class="rbm-foot" id="rbm-note"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    RBM.panel = wrap;

    var vol = $('rbm-vol');
    if (vol) {
      var v = parseInt(store('vol') || '70', 10);
      RBM.volume = isFinite(v) ? Math.max(0, Math.min(100, v)) : 70;
      vol.value = RBM.volume;
      vol.addEventListener('input', function () {
        RBM.volume = +this.value;
        RBM.muted = RBM.volume === 0;
        store('vol', RBM.volume);
        applyVolume();
      });
    }
    var seek = $('rbm-seek');
    if (seek) {
      seek.addEventListener('input', function () {
        if (!RBM.player || !RBM.player.getDuration) return;
        var d = RBM.player.getDuration();
        if (d) RBM.player.seekTo(d * (+this.value) / 1000, true);
      });
    }

    var chips = $('rbm-chips');
    if (chips) {
      chips.innerHTML = CHIPS.map(function (c) {
        return '<button type="button" class="rbm-chip" data-q="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
      chips.addEventListener('click', function (e) {
        var b = e.target.closest('.rbm-chip');
        if (!b) return;
        var q = $('rbm-q');
        if (q) q.value = b.getAttribute('data-q');
        window.rbMusicSearch();
      });
    }
    renderResults([]);
    paintNote();
  }

  function applyVolume() {
    if (!RBM.player) return;
    try {
      if (RBM.muted) { if (RBM.player.mute) RBM.player.mute(); }
      else { if (RBM.player.unMute) RBM.player.unMute(); if (RBM.player.setVolume) RBM.player.setVolume(RBM.volume); }
    } catch (e) { }
    var b = $('rbm-mute');
    if (b) b.textContent = RBM.muted ? '🔇' : RBM.volume > 55 ? '🔊' : '🔉';
    var s = $('rbm-vol');
    if (s && +s.value !== RBM.volume) s.value = RBM.volume;
  }

  /* ---------- API YouTube ---------- */
  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(true);
    if (RBM.apiLoading) {
      return new Promise(function (resolve) {
        var waited = 0;
        var t = setInterval(function () {
          waited += 120;
          if (window.YT && window.YT.Player) { clearInterval(t); resolve(true); }
          else if (waited > 9000) { clearInterval(t); resolve(false); }
        }, 120);
      });
    }
    RBM.apiLoading = true;
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (ok) { if (done) return; done = true; resolve(ok); };
      window.onYouTubeIframeAPIReady = function () { finish(true); };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { RBM.apiFailed = true; finish(false); };
      document.head.appendChild(s);
      setTimeout(function () { finish(!!(window.YT && window.YT.Player)); }, 9000);
    });
  }

  function mount() {
    build();
    return loadApi().then(function (ok) {
      if (!ok || !(window.YT && window.YT.Player)) {
        showLoading('Pemutar YouTube tidak bisa dimuat. Periksa koneksi atau pemblokir iklan, lalu tekan 🔄 di bawah.');
        note('Pemutar YouTube gagal dimuat. <button type="button" class="rbm-link" onclick="rbMusicReload()">Muat ulang pemutar</button> atau buka <a href="https://www.youtube.com" target="_blank" rel="noopener">youtube.com</a>.');
        return;
      }
      if (RBM.player) return;
      try {
        RBM.player = new window.YT.Player('rbm-player', {
          height: '100%', width: '100%', videoId: '',
          playerVars: {
            autoplay: 0, controls: 0, rel: 0, playsinline: 1,
            modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, origin: location.origin
          },
          events: {
            onReady: function () {
              RBM.ready = true;
              applyVolume();
              hideLoading();
              var p = RBM.pending;
              RBM.pending = null;
              if (p) play(p.id, p.title);
            },
            onStateChange: function (e) {
              var st = e.data;
              RBM.playing = st === 1;
              paintPlay();
              if (st === 1) { hideLoading(); syncMeta(); startTimer(); }
              if (st === 2) { stopTimer(); }
              if (st === 0) { stopTimer(); window.rbMusicNext(); }
              if (st === 5) { showLoading('Memuat video…'); }
            },
            onError: function (e) {
              hideLoading();
              stopTimer();
              RBM.playing = false;
              paintPlay();
              var code = e && e.data;
              var msg = code === 101 || code === 150
                ? 'Video ini melarang pemutaran di luar YouTube. Pilih hasil lain.'
                : code === 100 ? 'Video tidak tersedia atau sudah dihapus.'
                  : 'Video ini tidak bisa diputar di web. Pilih hasil lain atau tempel tautan yang berbeda.';
              note(msg);
            }
          }
        });
      } catch (e) {
        note('Pemutar tidak bisa dibuat: ' + esc((e && e.message) || e));
      }
    });
  }

  function hideLoading() { var l = $('rbm-loading'); if (l) l.style.display = 'none'; }
  function showLoading(t) {
    var l = $('rbm-loading');
    if (l) { l.innerHTML = '<i class="rbm-spin"></i><em>' + esc(t || 'Memuat video…') + '</em>'; l.style.display = 'grid'; }
  }
  function note(html) { RBM.note = html; paintNote(); }
  function paintNote() {
    var n = $('rbm-note');
    if (!n) return;
    if (RBM.note) { n.innerHTML = RBM.note; return; }
    var u = userName();
    n.innerHTML = (u ? 'Masuk sebagai <b>' + esc(u) + '</b>. ' : '') +
      'Pencarian dijaga token akun. Untuk playlist pribadi, buka ' +
      '<a href="https://accounts.google.com/ServiceLogin?service=youtube" target="_blank" rel="noopener">login YouTube</a> di browser ini.';
  }
  function paintPlay() {
    var label = RBM.playing ? '⏸' : '▶';
    setText('rbm-play', label);
    setText('rbm-miniplay', label);
    var b = $('rbm-play');
    if (b) b.setAttribute('aria-label', RBM.playing ? 'Jeda' : 'Putar');
  }
  function syncMeta() {
    if (!RBM.player || !RBM.player.getVideoData) return;
    var d = RBM.player.getVideoData() || {};
    var cur = RBM.queue[RBM.index] || {};
    var t = d.title || cur.title || 'Musik YouTube';
    setText('rbm-title', t);
    setText('rbm-sub', d.author || cur.channel || 'YouTube');
    setText('rbm-badge', d.video_id ? 'YouTube · ' + String(d.video_id).slice(0, 11) : 'YouTube');
    document.title = RBM.playing ? t + ' · Ruang Belajar' : 'Ruang Belajar';
  }
  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
  }
  function startTimer() {
    stopTimer();
    RBM.timer = setInterval(function () {
      if (!RBM.player || !RBM.player.getCurrentTime) return;
      var c = 0, d = 0;
      try { c = RBM.player.getCurrentTime() || 0; d = RBM.player.getDuration() || 0; } catch (e) { return; }
      setText('rbm-cur', fmtTime(c));
      setText('rbm-dur', fmtTime(d));
      var sk = $('rbm-seek');
      if (sk && d && document.activeElement !== sk) sk.value = String(Math.round(c / d * 1000));
    }, 800);
  }
  function stopTimer() { if (RBM.timer) { clearInterval(RBM.timer); RBM.timer = 0; } }

  /* ---------- pemutaran ---------- */
  function play(id, title) {
    if (!id) return;
    build();
    open();
    RBM.wantPlay = true;
    if (!RBM.ready) {
      RBM.pending = { id: id, title: title };
      showLoading('Menyiapkan ' + (title || 'video') + '…');
      mount();
      setText('rbm-title', title || 'Musik YouTube');
      return;
    }
    showLoading('Memuat ' + (title || 'video') + '…');
    setText('rbm-title', title || 'Musik YouTube');
    setText('rbm-sub', 'Menyiapkan…');
    try {
      RBM.player.loadVideoById(id);
    } catch (e) {
      note('Pemutar belum siap. Coba tekan putar lagi.');
      return;
    }
    store('lastId', id);
    store('lastTitle', title || '');
    RBM.playing = true;
    paintPlay();
    setTimeout(function () {
      try { if (RBM.player && RBM.player.playVideo) RBM.player.playVideo(); } catch (e) { }
    }, 260);
  }

  function open() {
    build();
    RBM.panel.classList.add('on');
    RBM.panel.classList.remove('min');
    RBM.minimized = false;
    paintNote();
    if (!RBM.player) mount();
  }

  function parseId(s) {
    s = String(s || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var m = /(?:youtu\.be\/|v=|vi=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/.exec(s);
    return m ? m[1] : '';
  }

  function renderResults(items) {
    RBM.results = items || [];
    var box = $('rbm-results');
    if (!box) return;
    if (!RBM.results.length) {
      box.innerHTML = '<div class="rbm-empty">Belum ada hasil. Ketik judul lagu, pilih salah satu pintasan di atas, atau tempel tautan YouTube.</div>';
      return;
    }
    box.innerHTML = RBM.results.map(function (x, i) {
      return '<button type="button" class="rbm-item" onclick="rbMusicPlayIdx(' + i + ')" title="' + esc(x.title) + '">' +
        '<img src="' + esc(x.thumb || ('https://i.ytimg.com/vi/' + x.id + '/mqdefault.jpg')) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">' +
        '<span class="rbm-item-txt"><b>' + esc(x.title) + '</b><small>' + esc(x.channel || 'YouTube') + (x.duration ? ' · ' + esc(x.duration) : '') + '</small></span>' +
        '<i aria-hidden="true">▶</i></button>';
    }).join('');
    box.scrollTop = 0;
  }

  function searchError(q, msg) {
    renderResults([]);
    var box = $('rbm-results');
    if (box) {
      box.innerHTML = '<div class="rbm-empty">' + esc(msg) + '</div>' +
        '<a class="rbm-ext" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">Buka pencarian “' + esc(q) + '” di YouTube ↗</a>';
    }
    note(esc(msg));
  }

  /* ---------- jendela ---------- */
  window.rbMusicOpen = function () { open(); };
  window.rbMusicClose = function () {
    if (!RBM.panel) return;
    RBM.panel.classList.remove('on');
    if (RBM.full) window.rbMusicFull();
  };
  window.rbMusicMin = function () {
    if (!RBM.panel) return;
    RBM.minimized = !RBM.minimized;
    RBM.panel.classList.toggle('min', RBM.minimized);
    var b = RBM.panel.querySelector('.rbm-ico[onclick="rbMusicMin()"]');
    if (b) {
      b.textContent = RBM.minimized ? '⤢' : '—';
      b.setAttribute('title', RBM.minimized ? 'Besarkan' : 'Kecilkan');
    }
  };
  window.rbMusicFull = function () {
    if (!RBM.panel) return;
    RBM.full = !RBM.full;
    RBM.panel.classList.toggle('full', RBM.full);
    var b = $('rbm-fsbtn');
    if (b) { b.textContent = RBM.full ? '⤡' : '⛶'; b.setAttribute('title', RBM.full ? 'Keluar layar penuh' : 'Layar penuh'); }
    try {
      if (RBM.full) { if (RBM.panel.requestFullscreen) RBM.panel.requestFullscreen().catch(function () { }); }
      else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () { });
    } catch (e) { }
  };
  window.rbMusicReload = function () {
    try { if (RBM.player && RBM.player.destroy) RBM.player.destroy(); } catch (e) { }
    RBM.player = null; RBM.ready = false;
    var host = $('rbm-player');
    if (host) host.innerHTML = '';
    showLoading('Menyiapkan pemutar…');
    mount();
  };

  /* ---------- kontrol ---------- */
  window.rbMusicToggle = function () {
    if (!RBM.player || !RBM.ready) { build(); mount(); return; }
    try {
      if (RBM.playing) { RBM.player.pauseVideo(); RBM.playing = false; }
      else { RBM.player.playVideo(); RBM.playing = true; }
    } catch (e) { note('Pemutar belum siap.'); }
    paintPlay();
  };
  window.rbMusicStop = function () {
    try { if (RBM.player && RBM.player.stopVideo) RBM.player.stopVideo(); } catch (e) { }
    RBM.playing = false;
    RBM.wantPlay = false;
    stopTimer();
    paintPlay();
    setText('rbm-cur', '0:00');
    setText('rbm-dur', '0:00');
    var s = $('rbm-seek'); if (s) s.value = 0;
    hideLoading();
    document.title = 'Ruang Belajar';
    note('Musik dihentikan.');
  };
  window.rbMusicNext = function () {
    if (!RBM.queue.length) { note('Daftar lagu masih kosong. Cari lagu dulu.'); return; }
    if (RBM.queue.length === 1) { window.rbMusicStop(); note('Daftar hanya berisi satu lagu. Cari lagu lain untuk melanjutkan.'); return; }
    RBM.index = (RBM.index + 1) % RBM.queue.length;
    var x = RBM.queue[RBM.index];
    play(x.id, x.title);
  };
  window.rbMusicPrev = function () {
    if (!RBM.queue.length) { note('Daftar lagu masih kosong. Cari lagu dulu.'); return; }
    if (RBM.queue.length === 1) { note('Daftar hanya berisi satu lagu.'); return; }
    RBM.index = (RBM.index - 1 + RBM.queue.length) % RBM.queue.length;
    var x = RBM.queue[RBM.index];
    play(x.id, x.title);
  };
  window.rbMusicPlayIdx = function (i) {
    var x = RBM.results[i];
    if (!x) return;
    RBM.queue = RBM.results.slice();
    RBM.index = i;
    play(x.id, x.title);
  };
  window.rbMusicMute = function () {
    RBM.muted = !RBM.muted;
    applyVolume();
  };

  window.rbMusicSearch = function () {
    var inp = $('rbm-q');
    if (!inp) return;
    var q = String(inp.value || '').trim();
    if (!q) { note('Tulis judul lagu atau tempel tautan YouTube.'); inp.focus(); return; }
    var id = parseId(q);
    if (id) {
      RBM.queue = [{ id: id, title: 'Video YouTube', channel: '' }];
      RBM.index = 0;
      play(id, 'Video YouTube');
      note('Memutar tautan langsung.');
      return;
    }
    if (RBM.searchBusy) return;
    RBM.searchBusy = true;
    note('Mencari “' + esc(q) + '”…');
    var box = $('rbm-results');
    if (box) box.innerHTML = '<div class="rbm-empty"><i class="rbm-spin"></i> Mencari di YouTube…</div>';

    token().then(function (tk) {
      return fetch('/api/yt?q=' + encodeURIComponent(q), {
        headers: { Authorization: 'Bearer ' + tk },
        credentials: 'same-origin'
      }).then(function (r) {
        return r.text().then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { }
          return { status: r.status, j: j, txt: txt };
        });
      });
    }).then(function (res) {
      RBM.searchBusy = false;
      if (res.status === 401 || res.status === 403) {
        searchError(q, (res.j && res.j.error) || 'Sesi login tidak valid. Muat ulang halaman lalu masuk lagi.');
        return;
      }
      if (!res.j) {
        searchError(q, 'Server pencarian tidak menjawab dengan benar (HTTP ' + res.status + ').');
        return;
      }
      if (!res.j.ok) {
        searchError(q, res.j.error || 'Pencarian gagal.');
        return;
      }
      renderResults(res.j.items || []);
      if (!(res.j.items || []).length) { searchError(q, 'Tidak ada video yang cocok.'); return; }
      store('lastQuery', q);
      note((res.j.source === 'youtube-api' ? 'Hasil YouTube Data API' : 'Hasil pencarian YouTube') +
        ' · ' + res.j.items.length + ' video. Tekan salah satu untuk memutar.');
    }).catch(function (e) {
      RBM.searchBusy = false;
      var m = String((e && e.message) || e);
      if (/belum masuk/i.test(m)) searchError(q, m);
      else searchError(q, 'Pencarian gagal: ' + m);
    });
  };

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && RBM.full) {
      RBM.full = false;
      if (RBM.panel) RBM.panel.classList.remove('full');
      var b = $('rbm-fsbtn'); if (b) b.textContent = '⛶';
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && RBM.full) { e.preventDefault(); window.rbMusicFull(); }
  });

  document.addEventListener('DOMContentLoaded', function () {
    build();
    var last = store('lastId');
    if (last && /^[A-Za-z0-9_-]{11}$/.test(last)) {
      RBM.queue = [{ id: last, title: store('lastTitle') || 'Terakhir diputar', channel: '' }];
      RBM.index = 0;
      setText('rbm-title', store('lastTitle') || 'Terakhir diputar');
      setText('rbm-sub', 'Tekan ▶ untuk melanjutkan');
    }
    var q = store('lastQuery');
    if (q) { var f = $('rbm-q'); if (f) f.value = q; }
    renderResults([]);
  });
})();
