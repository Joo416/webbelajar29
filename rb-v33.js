/* ==========================================================================
   RUANG BELAJAR V33 — komponen bersama untuk Trading
   - Animasi "AI mencari data" (bukan sekadar spinner): orb, langkah bergilir,
     log sumber, progress bar.
   - Penyemat resmi TradingView: chart advanced + Technical Analysis gauge.
   - Chip bias multi-timeframe dari mesin.
   Tanpa dependensi; aman bila dipanggil saat elemen belum ada.
   ========================================================================== */
(function () {
  'use strict';

  var STEPS = {
    news: [
      'Menyinkronkan jadwal resmi BLS (NFP · CPI · PPI)…',
      'Membaca jadwal FOMC & statement federalreserve.gov…',
      'Menarik angka aktual BLS + FRED (payrolls, CPI, PPI)…',
      'Mengambil EFFR NY Fed, yield Treasury, dan yield riil…',
      'Memeriksa DXY, emas spot, dan posisi spekulan CFTC…',
      'Memindai berita Reuters · Bloomberg · CNBC · FXStreet…',
      'Menghitung kejutan aktual vs konsensus per rilis…',
      'Memverifikasi silang sumber sebelum menulis kesimpulan…',
      'Menyusun skenario arah XAUUSD & peta spike…'
    ],
    signal: [
      'Mengambil candle live XAUUSD M1 · M5 · M15 · H1 · D1…',
      'Mendeteksi struktur, BOS/MSS, dan sapuan likuiditas…',
      'Memetakan FVG, order block, OTE, dan premium/discount…',
      'Membaca DXY, yield 10Y, dan korelasi intermarket…',
      'Mengukur ATR untuk target TPmax & validasi level…',
      'Memvalidasi harga spot emas vs PAXG…',
      'Memeriksa kalender rilis High impact…',
      'Menyusun 3–10 setup Alchemist satu arah…',
      'Meminta AI menilai kualitas setup (level tidak diubah)…'
    ]
  };
  var LOGS = {
    news: ['BLS.gov', 'federalreserve.gov', 'FRED (St. Louis)', 'NY Fed EFFR', 'Treasury.gov', 'CFTC COT', 'Reuters', 'Bloomberg', 'CNBC', 'FXStreet'],
    signal: ['Yahoo M1/M5/M15/H1/D1', 'gold-api spot', 'PAXG Binance', 'DXY', '^TNX 10Y', 'Kalender rilis', 'ATR/struktur', 'Alchemist engine', 'TradingView chart']
  };
  var state = {}, timers = {};

  function el(id) { return document.getElementById(id); }

  function scanHtml(kind) {
    var s = STEPS[kind] || STEPS.signal;
    return '<div class="rb-ai-scan-top">'
      + '<div class="rb-ai-orb" aria-hidden="true"><i></i></div>'
      + '<div class="rb-ai-copy">'
      + '<div class="rb-ai-title"><span class="dot"></span>AI mencari & memverifikasi data <span class="mut" style="font-weight:600;font-size:.76rem">· ' + (kind === 'news' ? 'news global XAUUSD' : 'sinyal XAUUSD') + '</span></div>'
      + '<div class="rb-ai-step" data-step>0% · Menyiapkan…</div>'
      + '</div></div>'
      + '<div class="rb-ai-bar"><i></i></div>'
      + '<div class="rb-ai-log" data-log></div>'
      + '<div class="small mut" style="margin-top:8px;position:relative;z-index:1">' + s.length + ' tahap · data resmi diprioritaskan, angka tidak dikarang.</div>';
  }

  function show(id, kind, title) {
    var box = el(id);
    if (!box) return;
    kind = kind === 'news' ? 'news' : 'signal';
    if (!box.dataset.kind) box.dataset.kind = kind;
    box.className = 'rb-ai-scan';
    box.hidden = false;
    box.innerHTML = scanHtml(kind);
    /* Generasi baru: hasil lama tidak boleh menyembunyikan scan yang baru. */
    state[id + '_gen'] = (state[id + '_gen'] || 0) + 1;
    clearTimeout(timers[id]);
    if (title) {
      var t = box.querySelector('.rb-ai-title');
      if (t) t.firstChild && (t.firstChild.textContent = title + ' ');
    }
    var steps = STEPS[kind], logs = LOGS[kind], i = 0;
    var stepEl = box.querySelector('[data-step]'), logEl = box.querySelector('[data-log]');
    function tick() {
      var pct = Math.min(96, Math.round((i + 1) / (steps.length + 1) * 100));
      if (stepEl) stepEl.textContent = pct + '% · ' + steps[i % steps.length];
      if (logEl) {
        var line = document.createElement('div');
        line.innerHTML = '<b>✓</b> ' + logs[i % logs.length] + ' <span style="opacity:.6">· ' + new Date().toLocaleTimeString('id-ID') + '</span>';
        logEl.appendChild(line);
        while (logEl.children.length > 5) logEl.removeChild(logEl.firstChild);
      }
      i++;
    }
    tick();
    clearInterval(state[id]);
    state[id] = setInterval(tick, 1700);
    try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { }
  }

  function step(id, text) {
    var box = el(id);
    if (!box) return;
    var s = box.querySelector('[data-step]');
    if (s && text) s.textContent = text;
  }

  function done(id, text) {
    var box = el(id);
    if (!box) { hide(id); return; }
    clearInterval(state[id]); state[id] = 0;
    box.classList.add('done');
    var s = box.querySelector('[data-step]');
    if (s) s.textContent = text || '✅ Selesai — data & analisis siap.';
    var bar = box.querySelector('.rb-ai-bar i');
    if (bar) { bar.style.animation = 'none'; bar.style.width = '100%'; }
    var gen = state[id + '_gen'];
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () { if (state[id + '_gen'] === gen) hide(id); }, 1400);
  }

  function fail(id, text) {
    var box = el(id);
    clearInterval(state[id]); state[id] = 0;
    if (!box) return;
    box.classList.remove('done');
    var s = box.querySelector('[data-step]');
    if (s) s.textContent = '⚠️ ' + (text || 'Gagal mengambil data.');
    var gen = state[id + '_gen'];
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () { if (state[id + '_gen'] === gen) hide(id); }, 1800);
  }

  function hide(id) {
    clearInterval(state[id]); state[id] = 0;
    clearTimeout(timers[id]); timers[id] = 0;
    var box = el(id);
    if (!box) return;
    box.hidden = true;
    box.innerHTML = '';
  }

  /* ---------------- TradingView ---------------- */
  function theme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function tvInt(n) { return ['1', '5', '15', '60', '240', 'D'].indexOf(String(n)) >= 0 ? String(n) : '15'; }

  function chart(id, interval, height) {
    var box = el(id);
    if (!box) return;
    var intv = tvInt(interval || 15);
    box.className = 'rb-tv';
    if (height) box.style.height = height;
    box.innerHTML = '<iframe title="Chart XAUUSD TradingView" loading="lazy" allowtransparency="true" frameborder="0"'
      + ' src="https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=' + intv
      + '&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=' + (theme() === 'light' ? 'ffffff' : '0e1219')
      + '&studies=%5B%5D&theme=' + theme() + '&style=1&timezone=Asia%2FJakarta&locale=id'
      + '&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=1&details=1"></iframe>';
  }

  /* Technical Analysis resmi TradingView (gauge + rekomendasi per timeframe).
     Disematkan dengan script resmi agar nilainya dihitung TradingView, bukan
     dikarang aplikasi. */
  function ta(id, interval, height) {
    var box = el(id);
    if (!box) return;
    var intv = tvInt(interval || 15);
    if (intv === 'D') intv = '1D';
    box.className = 'rb-tv rb-tv-ta';
    if (height) box.style.height = height;
    box.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%';
    var inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    wrap.appendChild(inner);
    var sc = document.createElement('script');
    sc.type = 'text/javascript';
    sc.async = true;
    sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    sc.textContent = JSON.stringify({
      interval: intv,
      width: '100%',
      isTransparent: true,
      height: 420,
      symbol: 'OANDA:XAUUSD',
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'id',
      colorTheme: theme()
    });
    wrap.appendChild(sc);
    box.appendChild(wrap);
  }

  /* Chip bias multi-timeframe dari mesin (M1…D1). */
  function tfChips(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return '<div class="rb-tf-chips">' + list.map(function (x) {
      var d = Number(x.dir) || 0;
      var cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      var txt = d > 0 ? 'naik' : d < 0 ? 'turun' : 'range';
      return '<span class="rb-tf ' + cls + '">' + (d > 0 ? '▲' : d < 0 ? '▼' : '◆') + ' ' + (x.label || x.tf) + ' · ' + txt + '</span>';
    }).join('') + '</div>';
  }

  window.rb33Scan = { show: show, step: step, done: done, fail: fail, hide: hide };
  window.rb33Tv = { chart: chart, ta: ta, tfChips: tfChips };
})();
