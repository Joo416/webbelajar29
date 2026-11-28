/* ==========================================================================
   PANEL MUSIK YOUTUBE — diputar langsung dari web memakai IFrame Player API
   resmi YouTube. Fitur: cari video, tempel tautan, antrean, putar/jeda,
   hentikan, sebelumnya/berikutnya, volume, minimize, dan layar penuh.
   Login aplikasi tetap wajib; tombol YouTube disediakan untuk playlist
   pribadi yang memang memerlukan akun YouTube di browser ini.
   ========================================================================== */
(function () {
  'use strict';

  var RBM = {
    panel: null, player: null, ready: false, apiLoading: false,
    queue: [], index: -1, playing: false, pending: null,
    muted: false, volume: 70, timer: 0, results: [],
    minimized: false, full: false
  };
  var DEF = { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio — beats to relax/study to' };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem('rbm_' + k); localStorage.setItem('rbm_' + k, String(v)); } catch (e) { } return null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  function build() {
    if (RBM.panel) return;
    var wrap = document.createElement('div');
    wrap.id = 'rbMusicPanel';
    wrap.className = 'rbm';
    wrap.setAttribute('aria-label', 'Pemutar musik YouTube');
    wrap.innerHTML =
      '<div class="rbm-head">' +
        '<div class="rbm-brand"><span>🎵</span><div><b>Musik Belajar</b><small id="rbm-now">Belum ada lagu</small></div></div>' +
        '<div class="rbm-win">' +
          '<button type="button" class="rbm-ico" onclick="rbMusicMin()" aria-label="Minimize" title="Minimize">—</button>' +
          '<button type="button" class="rbm-ico" id="rbm-fsbtn" onclick="rbMusicFull()" aria-label="Layar penuh" title="Layar penuh">⛶</button>' +
          '<button type="button" class="rbm-ico" onclick="rbMusicClose()" aria-label="Tutup" title="Tutup">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="rbm-body">' +
        '<div class="rbm-screen" id="rbm-screen"><div id="rbm-player"></div><div class="rbm-loading" id="rbm-loading">Menyiapkan pemutar YouTube…</div></div>' +
        '<div class="rbm-meta"><b id="rbm-title">Pilih lagu untuk mulai</b><span id="rbm-sub">Cari atau tempel tautan YouTube</span></div>' +
        '<div class="rbm-seek"><span id="rbm-cur">0:00</span><input id="rbm-seek" type="range" min="0" max="100" value="0" step="1" aria-label="Posisi lagu"><span id="rbm-dur">0:00</span></div>' +
        '<div class="rbm-ctrl">' +
          '<button type="button" class="rbm-btn" onclick="rbMusicPrev()" aria-label="Sebelumnya">⏮</button>' +
          '<button type="button" class="rbm-btn main" id="rbm-play" onclick="rbMusicToggle()" aria-label="Putar atau jeda">▶</button>' +
          '<button type="button" class="rbm-btn" onclick="rbMusicNext()" aria-label="Berikutnya">⏭</button>' +
          '<button type="button" class="rbm-btn" onclick="rbMusicStop()" aria-label="Hentikan">⏹</button>' +
          '<div class="rbm-vol"><span>🔊</span><input id="rbm-vol" type="range" min="0" max="100" value="70" aria-label="Volume"></div>' +
        '</div>' +
        '<div class="rbm-search"><input id="rbm-q" type="search" autocomplete="off" placeholder="Cari lagu atau tempel tautan YouTube…" onkeydown="if(event.key===\'Enter\')rbMusicSearch()"><button type="button" class="btn" onclick="rbMusicSearch()">Cari</button></div>' +
        '<div class="rbm-note" id="rbm-note">Masuk dengan akun ini aktif. Untuk playlist pribadi, buka <a href="https://accounts.google.com/ServiceLogin?service=youtube" target="_blank" rel="noopener">login YouTube</a> di browser yang sama.</div>' +
        '<div class="rbm-results" id="rbm-results"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    RBM.panel = wrap;
    var vol = $('rbm-vol');
    if (vol) {
      var v = parseInt(store('vol') || '70', 10); RBM.volume = isFinite(v) ? v : 70; vol.value = RBM.volume;
      vol.addEventListener('input', function () { RBM.volume = +this.value; store('vol', this.value); if (RBM.player && RBM.player.setVolume) RBM.player.setVolume(RBM.volume); });
    }
    var seek = $('rbm-seek');
    if (seek) seek.addEventListener('input', function () {
      if (!RBM.player || !RBM.player.getDuration) return;
      var d = RBM.player.getDuration();
      if (d) RBM.player.seekTo(d * (+this.value) / 100, true);
    });
  }

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (RBM.apiLoading) return new Promise(function (res) { var t = setInterval(function () { if (window.YT && window.YT.Player) { clearInterval(t); res(); } }, 120); setTimeout(function () { clearInterval(t); res(); }, 9000); });
    RBM.apiLoading = true;
    return new Promise(function (res) {
      window.onYouTubeIframeAPIReady = function () { res(); };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = function () { res(); };
      document.head.appendChild(s);
      setTimeout(res, 9000);
    });
  }

  function mount() {
    build();
    loadApi().then(function () {
      if (!(window.YT && window.YT.Player)) return;
      if (RBM.player) return;
      RBM.player = new window.YT.Player('rbm-player', {
        height: '100%', width: '100%', videoId: '',
        playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin },
        events: {
          onReady: function () {
            RBM.ready = true;
            RBM.player.setVolume(RBM.volume);
            hideLoading();
            if (RBM.pending) { var p = RBM.pending; RBM.pending = null; play(p.id, p.title); }
          },
          onStateChange: function (e) {
            var st = e.data;
            RBM.playing = st === 1;
            var b = $('rbm-play'); if (b) b.textContent = RBM.playing ? '⏸' : '▶';
            if (st === 1) { hideLoading(); syncMeta(); startTimer(); }
            if (st === 0) { stopTimer(); rbMusicNext(); }
          },
          onError: function () {
            hideLoading();
            note('Video ini tidak bisa diputar di web (mungkin dibatasi pemiliknya). Coba hasil lain.');
            var b = $('rbm-play'); if (b) b.textContent = '▶';
          }
        }
      });
    });
  }

  function hideLoading() { var l = $('rbm-loading'); if (l) l.style.display = 'none'; }
  function showLoading(t) { var l = $('rbm-loading'); if (l) { l.textContent = t || 'Memuat video…'; l.style.display = 'grid'; } }
  function note(t) { var n = $('rbm-note'); if (n) n.textContent = t; }
  function syncMeta() {
    if (!RBM.player || !RBM.player.getVideoData) return;
    var d = RBM.player.getVideoData() || {};
    var t = d.title || (RBM.queue[RBM.index] && RBM.queue[RBM.index].title) || 'Musik YouTube';
    var a = d.author || '';
    var te = $('rbm-title'); if (te) te.textContent = t;
    var su = $('rbm-sub'); if (su) su.textContent = a || 'YouTube';
    var now = $('rbm-now'); if (now) now.textContent = t;
  }
  function fmtTime(s) { s = Math.max(0, Math.floor(Number(s) || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function startTimer() {
    stopTimer();
    RBM.timer = setInterval(function () {
      if (!RBM.player || !RBM.player.getCurrentTime) return;
      var c = RBM.player.getCurrentTime() || 0, d = RBM.player.getDuration() || 0;
      var cur = $('rbm-cur'), dur = $('rbm-dur'), sk = $('rbm-seek');
      if (cur) cur.textContent = fmtTime(c);
      if (dur) dur.textContent = fmtTime(d);
      if (sk && d) { sk.value = String(Math.round(c / d * 100)); }
    }, 700);
  }
  function stopTimer() { if (RBM.timer) { clearInterval(RBM.timer); RBM.timer = 0; } }

  function play(id, title) {
    if (!id) return;
    build(); open();
    if (!RBM.ready) { RBM.pending = { id: id, title: title }; mount(); showLoading(); return; }
    showLoading('Memuat ' + (title || 'video') + '…');
    try { RBM.player.loadVideoById(id); } catch (e) { note('Pemutar belum siap. Coba lagi.'); return; }
    $('rbm-title').textContent = title || 'Musik YouTube';
    $('rbm-sub').textContent = 'YouTube';
    $('rbm-now').textContent = title || 'Musik YouTube';
    store('lastId', id); store('lastTitle', title || '');
    var b = $('rbm-play'); if (b) b.textContent = '⏸';
    setTimeout(function () { if (RBM.player && RBM.player.playVideo) RBM.player.playVideo(); }, 250);
  }

  function open() {
    if (!RBM.panel) build();
    RBM.panel.classList.add('on');
    RBM.panel.classList.remove('min');
    RBM.minimized = false;
    if (window.user) {
      var nama = window.user.displayName || window.user.email || 'Akun ini';
      var n = $('rbm-note');
      if (n) n.innerHTML = 'Masuk sebagai <b>' + esc(nama) + '</b>. Untuk playlist pribadi, buka <a href="https://accounts.google.com/ServiceLogin?service=youtube" target="_blank" rel="noopener">login YouTube</a> di browser yang sama.';
    }
    if (!RBM.player) mount();
  }

  function parseId(s) {
    s = String(s || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    var m = /(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(s);
    return m ? m[1] : '';
  }

  function renderResults(items) {
    RBM.results = items || [];
    var box = $('rbm-results'); if (!box) return;
    if (!RBM.results.length) { box.innerHTML = '<div class="rbm-empty">Belum ada hasil. Cari lagu atau tempel tautan YouTube.</div>'; return; }
    box.innerHTML = RBM.results.map(function (x, i) {
      return '<button type="button" class="rbm-item" onclick="rbMusicPlayIdx(' + i + ')">' +
        '<img src="' + esc(x.thumb || ('https://i.ytimg.com/vi/' + x.id + '/mqdefault.jpg')) + '" alt="" loading="lazy">' +
        '<span><b>' + esc(x.title) + '</b><small>' + esc(x.channel || 'YouTube') + '</small></span>' +
        '<i>▶</i></button>';
    }).join('');
  }

  window.rbMusicOpen = function () { build(); open(); };
  window.rbMusicClose = function () { if (RBM.panel) RBM.panel.classList.remove('on'); if (RBM.full) window.rbMusicFull(); };
  window.rbMusicMin = function () {
    if (!RBM.panel) return;
    RBM.minimized = !RBM.minimized;
    RBM.panel.classList.toggle('min', RBM.minimized);
  };
  window.rbMusicFull = function () {
    if (!RBM.panel) return;
    RBM.full = !RBM.full;
    RBM.panel.classList.toggle('full', RBM.full);
    var b = $('rbm-fsbtn'); if (b) b.textContent = RBM.full ? '⤡' : '⛶';
    if (RBM.full) {
      try { if (RBM.panel.requestFullscreen) RBM.panel.requestFullscreen(); } catch (e) { }
    } else {
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { }
    }
  };
  window.rbMusicToggle = function () {
    if (!RBM.player) { build(); mount(); return; }
    if (RBM.playing) { RBM.player.pauseVideo(); RBM.playing = false; $('rbm-play').textContent = '▶'; }
    else { RBM.player.playVideo(); RBM.playing = true; $('rbm-play').textContent = '⏸'; }
  };
  window.rbMusicStop = function () {
    if (RBM.player && RBM.player.stopVideo) RBM.player.stopVideo();
    RBM.playing = false; stopTimer();
    var b = $('rbm-play'); if (b) b.textContent = '▶';
    var c = $('rbm-cur'); if (c) c.textContent = '0:00';
    var s = $('rbm-seek'); if (s) s.value = 0;
    note('Diputar berhenti.');
  };
  window.rbMusicNext = function () {
    if (!RBM.queue.length) { note('Antrean kosong. Cari lagu dulu.'); return; }
    if (RBM.queue.length === 1) { window.rbMusicStop(); note('Daftar hanya berisi satu lagu. Cari lagu lain untuk melanjutkan.'); return; }
    RBM.index = (RBM.index + 1) % RBM.queue.length;
    var x = RBM.queue[RBM.index]; play(x.id, x.title);
  };
  window.rbMusicPrev = function () {
    if (!RBM.queue.length) { note('Antrean kosong. Cari lagu dulu.'); return; }
    if (RBM.queue.length === 1) { note('Daftar hanya berisi satu lagu.'); return; }
    RBM.index = (RBM.index - 1 + RBM.queue.length) % RBM.queue.length;
    var x = RBM.queue[RBM.index]; play(x.id, x.title);
  };
  window.rbMusicPlayIdx = function (i) {
    var x = RBM.results[i]; if (!x) return;
    RBM.queue = RBM.results.slice(); RBM.index = i;
    play(x.id, x.title);
  };
  window.rbMusicSearch = function () {
    if (!window.user) { note('Masuk dulu untuk memutar musik.'); return; }
    var inp = $('rbm-q'); if (!inp) return;
    var q = String(inp.value || '').trim();
    if (!q) { note('Tulis judul lagu atau tempel tautan YouTube.'); return; }
    var id = parseId(q);
    if (id) { RBM.queue = [{ id: id, title: 'Video YouTube' }]; RBM.index = 0; play(id, 'Video YouTube'); note('Memutar tautan langsung.'); return; }
    note('Mencari “' + q + '”…');
    var box = $('rbm-results'); if (box) box.innerHTML = '<div class="rbm-empty">Mencari…</div>';
    fetch('/api/yt?q=' + encodeURIComponent(q)).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (!x.ok || !x.j.ok) throw new Error((x.j && x.j.error) || 'Pencarian gagal');
      renderResults(x.j.items || []);
      note((x.j.source === 'youtube-api' ? 'Hasil dari YouTube Data API' : 'Hasil pencarian publik YouTube') + ' · ' + (x.j.items || []).length + ' video. Tekan salah satu untuk memutar.');
    }).catch(function (e) {
      renderResults([]);
      note('Pencarian gagal: ' + e.message + '. Tempel tautan video langsung, atau buka pencarian YouTube.');
      var box2 = $('rbm-results'); if (box2) box2.innerHTML = '<a class="rbm-ext" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">Buka hasil pencarian di YouTube ↗</a>';
    });
  };

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && RBM.full) { RBM.full = false; if (RBM.panel) RBM.panel.classList.remove('full'); var b = $('rbm-fsbtn'); if (b) b.textContent = '⛶'; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && RBM.full) window.rbMusicFull();
  });

  document.addEventListener('DOMContentLoaded', function () {
    build();
    var last = store('lastId');
    if (last) { RBM.queue = [{ id: last, title: store('lastTitle') || 'Terakhir diputar' }]; RBM.index = 0; }
    renderResults([]);
    var te = $('rbm-title'); if (te && last) te.textContent = store('lastTitle') || 'Terakhir diputar';
  });
})();