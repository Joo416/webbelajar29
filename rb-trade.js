/* ==========================================================================
   RUANG BELAJAR V31 — TRADING BESAR (dimuat paling akhir)
   1. News Analisis XAUUSD : NFP · CPI · PPI · FOMC + berita di waktu yang sama,
      validitas tiap data (sumber, periode, kesegaran) + prediksi jalur emas.
   2. Signal Entry         : 3–10 sinyal Alchemist satu arah, SL tepat 30 pip, TP1 ≥100, TP2 ≥200, TPmax konfluensi global, refresh 15 menit;
      TP2 ≥200 pip, TPmax dari struktur/global; sinyal bertahan sampai SL/TP,
      otomatis ambil data + nilai ulang AI setiap 15 menit (selalu aktif).
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
const XAU_FOCUS = {
  nfp: { tag: 'NFP', label: 'NFP', name: 'Non-Farm Payrolls', icon: '👷', sub: 'tenaga kerja', src: 'bls.gov', desc: 'Perubahan lapangan kerja, pengangguran, dan upah AS — pemicu utama arah USD & emas.' },
  cpi: { tag: 'CPI', label: 'CPI', name: 'Consumer Price Index', icon: '🛒', sub: 'inflasi', src: 'bls.gov', desc: 'Inflasi konsumen AS — menentukan ekspektasi suku bunga The Fed.' },
  ppi: { tag: 'PPI', label: 'PPI', name: 'Producer Price Index', icon: '🏭', sub: 'harga produsen', src: 'bls.gov', desc: 'Inflasi produsen AS — indikator awal tekanan harga ke konsumen.' },
  fomc: { tag: 'FOMC', label: 'FOMC', name: 'FOMC / suku bunga The Fed', icon: '🏛️', sub: 'suku bunga', src: 'federalreserve.gov', desc: 'Keputusan suku bunga, statement, dan dot plot The Fed — penggerak terbesar emas.' },
  pce: { tag: 'PCE', label: 'PCE', name: 'Core PCE Price Index', icon: '📉', sub: 'inflasi Fed', src: 'bea.gov + FRED', desc: 'Ukuran inflasi favorit The Fed — penentu arah kebijakan suku bunga berikutnya.' },
  retail: { tag: 'RETAIL', label: 'Retail', name: 'Retail Sales', icon: '🛍️', sub: 'konsumsi', src: 'census.gov', desc: 'Belanja konsumen AS (headline & control group) — pembaca kekuatan ekonomi riil.' },
  gdp: { tag: 'GDP', label: 'GDP', name: 'Gross Domestic Product', icon: '📊', sub: 'pertumbuhan', src: 'bea.gov', desc: 'Pertumbuhan ekonomi AS kuartalan beserta deflator — konteks besar untuk yield & dolar.' },
  claims: { tag: 'CLAIMS', label: 'Claims', name: 'Unemployment Claims', icon: '🧾', sub: 'klaim kerja', src: 'dol.gov', desc: 'Klaim pengangguran mingguan — indikator paling cepat perubahan pasar tenaga kerja.' },
  adp: { tag: 'ADP', label: 'ADP', name: 'ADP Employment Change', icon: '🏢', sub: 'payroll swasta', src: 'ADP Research', desc: 'Perkiraan lapangan kerja swasta dari ADP — pratinjau NFP yang sering menggerakkan emas.' },
  ism: { tag: 'ISM', label: 'ISM', name: 'ISM Manufacturing & Services PMI', icon: '🏗️', sub: 'aktivitas', src: 'ismworld.org', desc: 'Aktivitas manufaktur & jasa AS termasuk harga yang dibayar — sinyal awal inflasi.' }
};
function xauFocusGet() {
  try { const k = localStorage.getItem('xau_focus_v1'); return XAU_FOCUS[k] ? k : 'nfp'; } catch (e) { return 'nfp'; }
}
function xauFocusCached(k) {
  try { const c = JSON.parse(localStorage.getItem('xau_last_' + k) || 'null'); return c && c.xai ? c : null; } catch (e) { return null; }
}
function xauFocusSet(k) {
  if (!XAU_FOCUS[k]) return;
  try { localStorage.setItem('xau_focus_v1', k); } catch (e) { }
  XR.cur = xauFocusCached(k);
  pXauNews();
}
/* ---------- News real-time: auto ambil ulang 5 menit + tick spot 15 detik ---------- */
const RB31_NEWS = { timer: 0, tick: 0, running: false };
function rb31NewsStop() {
  if (RB31_NEWS.timer) { clearInterval(RB31_NEWS.timer); RB31_NEWS.timer = 0; }
  if (RB31_NEWS.tick) { clearInterval(RB31_NEWS.tick); RB31_NEWS.tick = 0; }
}
function rb31NewsTick() {
  if (!document.getElementById('xres')) { rb31NewsStop(); return; }
  tcall({ action: 'xauSignal', phase: 'tick' }).then(function (r) {
    const el = document.getElementById('xauLive');
    if (!el) return;
    const t = r && r.tick;
    el.innerHTML = t && t.price
      ? 'live XAUUSD <b>' + sigNum(t.price) + '</b> · ' + esc(new Date(t.at).toLocaleTimeString('id-ID')) + ' · ' + esc(t.source || '')
      : 'live: —';
  }).catch(function () { });
}
function rb31NewsStart() {
  rb31NewsStop();
  RB31_NEWS.timer = setInterval(function () {
    if (!document.getElementById('xres')) { rb31NewsStop(); return; }
    const btn = document.getElementById('xbtn');
    if (RB31_NEWS.running || (btn && btn.disabled)) return;
    RB31_NEWS.running = true;
    Promise.resolve(runXau()).catch(function () { }).then(function () { RB31_NEWS.running = false; });
  }, 5 * 60000);
  RB31_NEWS.tick = setInterval(rb31NewsTick, 15000);
  rb31NewsTick();
}
function pXauNews() {
  const F = xauFocusGet(), FX = XAU_FOCUS[F], c = xauFocusCached(F);
  const bucket = c && c.xau && c.xau.focus ? c.xau.focus.filter(function (b) { return b.tag === FX.tag; })[0] : null;
  const ev = bucket && bucket.events ? bucket.events[0] : null;
  const tabs = Object.keys(XAU_FOCUS).map(function (k) {
    const x = XAU_FOCUS[k], on = k === F;
    const sub = x.sub || 'rilis AS';
    return '<button type="button" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="xauFocusSet(\'' + k + '\')">'
      + '<em>' + x.icon + '</em>' + x.label + '<small>' + sub + '</small></button>';
  }).join('');
  const sched = ev
    ? 'Jadwal: ' + esc(new Date(ev.ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))
    : 'Jadwal belum ada di cache — tekan tombol ambil data.';
  $('pane').innerHTML =
    '<div class="rb-trade-hero">'
    + '<div class="rb-hero-top"><div style="min-width:0;flex:1">'
    + '<div class="rb-eyebrow">Trading · rilis global XAUUSD</div>'
    + '<h2>📰 News Analisis XAUUSD</h2>'
    + '<div class="rb-note">Pilih <b>satu</b> rilis. Semua model AI fokus pada rilis itu saja: jadwal resmi <b>BLS</b> (NFP · CPI · PPI) &amp; <b>federalreserve.gov</b> (FOMC), angka aktual BLS/FRED, EFFR NY Fed, yield Treasury &amp; yield riil, DXY, posisi CFTC, dan berita Reuters/Bloomberg/CNBC/FXStreet. Hasilnya satu jawaban <b>BUY</b> atau <b>SELL</b> XAUUSD plus status <b>spike</b> (besar &amp; arah pertamanya) — tanpa WAIT.</div>'
    + '</div>'
    + '<div class="rb-live-chip"><span class="rb-live-dot"></span><span id="xauLive">live: —</span></div></div>'
    + '<div class="rb-rel-tabs">' + tabs + '</div>'
    + '<div class="rb-release"><div class="rb-release-head"><div class="rb-release-title">' + FX.icon + ' ' + FX.label + ' — ' + esc(FX.name) + '</div>'
    + '<span class="rb-pill y">fokus tunggal</span></div>'
    + '<div class="small mut" style="margin-top:5px">' + esc(FX.desc) + '</div>'
    + '<div class="small" style="margin-top:6px"><b>' + esc(sched) + '</b> · sumber: ' + esc(FX.src || (FX.tag === 'FOMC' ? 'federalreserve.gov' : 'bls.gov')) + '</div></div>'
    + '<div class="rb-actions">'
    + '<button class="btn" type="button" id="xbtn" onclick="runXau()">' + FX.icon + ' Ambil data ' + FX.label + ' &amp; analisis</button>'
    + '<button class="btn alt" type="button" onclick="retryXauAI()">🤖 Nilai ulang AI</button>'
    + '<button class="btn alt" type="button" onclick="xauHistPaint()">🕘 Riwayat</button>'
    + '<button class="btn alt" type="button" onclick="saveXauNews()">💾 Simpan ringkasan</button></div>'
    + '<div class="small mut" style="margin-top:8px">Auto ambil ulang tiap <b>5 menit</b> selama halaman terbuka · data resmi ditampilkan lebih dulu, AI menyusun arah setelahnya.</div></div>'
    + '<div id="xscan" class="rb-ai-scan" hidden></div>'
    + '<div id="xmsg" class="mut small" style="margin:0 0 10px"></div>'
    + '<div id="xhist"></div><div id="xres">' + (c ? '' : '<div class="card"><div class="mut small">Belum ada analisis <b>' + FX.label + '</b> di perangkat ini. Tekan tombol di atas untuk mengambil data global terbaru khusus rilis ini.</div></div>') + '</div>'
    + '<div class="card"><div class="rb-tv-head"><h3>📐 TradingView — Technical Analysis</h3><span class="rb-pill" id="xTvPill">TA · 15m</span></div>'
    + '<div class="rb-note">Gauge &amp; rekomendasi resmi TradingView untuk OANDA:XAUUSD (dihitung TradingView, bukan aplikasi). Ini pembanding visual untuk struktur, momentum, dan level mesin.</div>'
    + '<div class="rb-tf-chips" style="margin:8px 0">'
    + ['1', '5', '15', '60', '240', 'D'].map(function (n) { return '<button class="x" type="button" onclick="xauTvInt(\'' + n + '\')">' + (n === 'D' ? '1D' : n === '60' ? '1H' : n === '240' ? '4H' : n + 'm') + '</button>'; }).join('')
    + '</div>'
    + '<div id="xTvTa" class="rb-tv-note" style="padding:14px;border:1px dashed var(--line);border-radius:12px">Technical Analysis belum dimuat — tekan tombol agar halaman tetap ringan di HP.</div>'
    + '<button class="btn alt full" type="button" onclick="xauTvTa(xauTvNow())">📐 Muat Technical Analysis TradingView</button></div>'
    + '<div class="card"><div class="rb-tv-head"><h3>📈 Chart XAUUSD — live</h3><span class="rb-pill">TradingView</span></div>'
    + '<div class="rb-note">Chart resmi TradingView; level entry/SL/TP mesin digambar di tab Signal Entry.</div>'
    + '<div id="xTvChart" class="rb-tv-note" style="padding:14px;border:1px dashed var(--line);border-radius:12px">Chart belum dimuat — tekan tombol di bawah.</div>'
    + '<button class="btn alt full" type="button" onclick="xauTvChart(xauTvNow())">📈 Muat chart TradingView</button></div>';
  xauHistPaint();
  if (c) renderXau(c, true);
  rb31NewsStart();
}
function xauTvNow() {
  try { const v = localStorage.getItem('xau_tv_int_v1'); return v || '15'; } catch (e) { return '15'; }
}
/* TradingView dimuat sesuai permintaan (bukan saat halaman dibuka) supaya HP
   kelas bawah tidak berat: dua widget sekaligus bisa memblokir render. */
const XTV = { ta: false, chart: false, int: '15' };
function xauTvLabel(v) { return v === 'D' ? '1D' : v === '60' ? '1H' : v === '240' ? '4H' : v + 'm'; }
function xauTvTa(n) {
  const v = ['1', '5', '15', '60', '240', 'D'].indexOf(String(n)) >= 0 ? String(n) : '15';
  XTV.int = v; XTV.ta = true;
  try { localStorage.setItem('xau_tv_int_v1', v); } catch (e) { }
  if (window.rb33Tv) window.rb33Tv.ta('xTvTa', v);
  const pill = document.getElementById('xTvPill');
  if (pill) pill.textContent = 'TA · ' + xauTvLabel(v);
}
function xauTvChart(n) {
  const v = ['1', '5', '15', '60', '240', 'D'].indexOf(String(n)) >= 0 ? String(n) : '15';
  XTV.int = v; XTV.chart = true;
  try { localStorage.setItem('xau_tv_int_v1', v); } catch (e) { }
  if (window.rb33Tv) window.rb33Tv.chart('xTvChart', v);
  const pill = document.getElementById('xTvPill');
  if (pill) pill.textContent = 'Chart · ' + xauTvLabel(v);
}
function xauTvInt(n, silent) {
  const v = ['1', '5', '15', '60', '240', 'D'].indexOf(String(n)) >= 0 ? String(n) : '15';
  XTV.int = v;
  if (XTV.ta) xauTvTa(v);
  if (XTV.chart) xauTvChart(v);
  if (!silent && !XTV.ta && !XTV.chart && window.rb33Tv) xauTvTa(v);
  if (!silent && typeof v21Toast === 'function') v21Toast('TradingView: ' + xauTvLabel(v));
}

function xauFocusCard(j) {
  const f = j.xau || {}, x = j.xai || {}, tags = f.focusTags || [], tag = tags.length === 1 ? tags[0] : '';
  const bucket = (f.focus || []).filter(function (b) { return b.tag === tag; })[0];
  const ev = bucket && bucket.events ? bucket.events[0] : null;
  const sp = x.spike || {}, act = x.action === 'SELL' ? 'SELL' : 'BUY';
  const mk = x.market || {};
  const mdir = (x.action_source === 'reaksi rilis' && x.reaction && x.reaction.dir && x.reaction.dir !== 'DUA ARAH')
    ? (x.reaction.dir === 'BUY' ? 'BULLISH' : 'BEARISH')
    : (mk.bias || (act === 'BUY' ? 'BULLISH' : 'BEARISH'));
  const mcol = mdir === 'BULLISH' ? 'var(--ok)' : mdir === 'BEARISH' ? 'var(--no)' : 'var(--warn)';
  const mev = (Array.isArray(mk.evidence) ? mk.evidence : []).slice(0, 5);
  const label = f.focusName || (tags.length ? tags.join(' · ') : 'Gabungan');
  const spPlan = j.spikePlan || null;
  const spMin = sp.size_pips && sp.size_pips.min != null ? sp.size_pips.min : (spPlan && spPlan.sizePips ? spPlan.sizePips.min : null);
  const spMax = sp.size_pips && sp.size_pips.max != null ? sp.size_pips.max : (spPlan && spPlan.sizePips ? spPlan.sizePips.max : null);
  const spWin = sp.window_min != null ? sp.window_min : (spPlan ? spPlan.windowMin : null);
  const spFirst = sp.first_dir || (spPlan ? spPlan.firstDir : '');
  const spWhy = sp.why || (spPlan ? spPlan.why : '');
  const rx = (sp.reaction || (spPlan && spPlan.reaction)) || null;
  const spYes = sp.likely === true || !!(spPlan && spPlan.likely);
  const srcLabel = x.action_source === 'reaksi rilis' ? 'Putusan mesin · reaksi rilis' : x.action_source === 'mesin' ? 'Putusan mesin' : 'Putusan AI';
  const verdict = '<div class="rb-verdict ' + (act === 'BUY' ? 'buy' : 'sell') + '">'
    + '<div class="rb-verdict-label">' + esc(srcLabel) + ' · ' + esc(label) + '</div>'
    + '<div class="rb-verdict-main">' + act + '</div>'
    + '<div class="rb-verdict-sub">XAUUSD — satu arah, tanpa WAIT</div>'
    + '<div class="rb-verdict-spike' + (spYes ? '' : ' no') + '">' + (spYes ? '⚡ Ada spike' : 'Tidak ada spike')
    + (spMin != null ? ' · ' + esc(String(spMin)) + '–' + esc(String(spMax)) + ' pip' : '')
    + (spWin != null ? ' · jendela ±' + esc(String(spWin)) + ' menit' : '')
    + (spFirst ? ' · arah pertama ' + esc(spFirst) : '') + '</div></div>';
  const rxn = x.reaction || j.reaction || null;
  const rCol = rxn && rxn.dir === 'BUY' ? 'var(--ok)' : rxn && rxn.dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const reactBlock = rxn ? '<div class="exp" style="margin-top:8px;color:var(--tx);border-color:' + rCol + '">'
    + '<b>📈 Reaksi NYATA setelah ' + esc(rxn.tag) + ' terbit:</b> <b style="color:' + rCol + '">' + (rxn.netPips > 0 ? '+' : '') + esc(String(rxn.netPips)) + ' pip → ' + esc(rxn.dir) + '</b>'
    + '<div class="small mut" style="margin-top:4px">' + esc(String(rxn.agoMin)) + ' menit lalu · ' + sigNum(rxn.anchor) + ' → ' + sigNum(rxn.last) + ' · arah pertama ' + esc(rxn.firstDir || '—') + ' · rentang ' + esc(String(rxn.rangePips)) + ' pip (' + esc(rxn.bar) + ') · ' + esc(rxn.source) + '</div>'
    + (rxn.dir !== 'DUA ARAH' && x.action && rxn.dir !== x.action ? '<div class="small" style="margin-top:4px;color:var(--warn)">⚠️ Arah final ' + esc(x.action) + ' berbeda dari reaksi nyata ' + esc(rxn.dir) + ' — periksa ulang sebelum entry.</div>' : '')
    + '</div>' : '';
  const staleRel = !!(j.spikePlan && j.spikePlan.released && j.spikePlan.ts && j.fetchedAt && Date.parse(j.fetchedAt) < j.spikePlan.ts && !x.reaction);
  const staleBlock = staleRel ? '<div class="warn" style="margin-top:8px">⏱️ Data ini diambil SEBELUM rilis terbit, jadi belum memuat reaksi harga. Tekan “Ambil data global terbaru” supaya putusan memakai harga sesudah rilis.</div>' : '';
  return '<div class="card" style="border-left:5px solid var(--accent)"><div class="rb-card-head"><h3>📌 Fokus analisis: ' + esc(label) + '</h3><span class="rb-dir ' + (act === 'BUY' ? 'buy' : 'sell') + '">' + act + ' XAUUSD</span></div>'
    + staleBlock
    + verdict
    + reactBlock
    + (ev ? '<div class="rb-release"><div class="rb-release-head"><div class="rb-release-title">' + esc(ev.title || ev.tag) + '</div>'
      + '<span class="rb-pill ' + (ev.verified === 'official' ? 'y' : '') + '">' + (ev.verified === 'official' ? '✅ jadwal resmi' : 'jadwal kalender') + '</span></div>'
      + '<div class="rb-release-meta">'
      + '<div><span>Jadwal (WIB)</span><b>' + esc(new Date(ev.ts).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })) + '</b></div>'
      + '<div><span>Konsensus</span><b>' + esc(ev.forecast || 'tidak ada') + '</b></div>'
      + '<div><span>Previous</span><b>' + esc(ev.previous || '—') + '</b></div>'
      + '</div>'
      + '<div class="small" style="margin-top:7px">' + (ev.actualOfficial != null
        ? '<span style="color:var(--ok)">✅ Angka resmi ' + esc(ev.actualOfficialLabel || '') + ': <b>' + esc(String(ev.actualOfficial)) + '</b></span> <span class="mut">· ' + esc(ev.actualSource || 'BLS/FRED') + '</span>'
        : '<span class="mut">Angka resmi BLS/FRED belum terbit untuk rilis ini — analisis memakai jadwal resmi + konsensus + reaksi pasar.</span>')
      + (ev.actual ? ' <span class="mut">· Aktual kalender: ' + esc(ev.actual) + '</span>' : '') + '</div></div>'
      : '<div class="warn">Jadwal rilis ini belum terbaca. Tekan “Ambil data” untuk memuat jadwal resmi BLS/The Fed.</div>')
    + '<div class="exp" style="margin-top:8px;color:var(--tx);border-color:' + (spYes ? 'var(--warn)' : 'var(--line2)') + '"><b>⚡ Spike pada rilis ini:</b> <b style="color:' + (spYes ? 'var(--warn)' : 'var(--mut)') + '">' + (spYes ? 'YA' : 'TIDAK') + '</b>'
    + (spMin != null ? ' · perkiraan <b>' + esc(String(spMin)) + '–' + esc(String(spMax)) + ' pip</b>' : '')
    + (spWin != null ? ' · jendela ±' + esc(String(spWin)) + ' menit' : '')
    + (spFirst ? ' · arah pertama <b>' + esc(spFirst) + '</b>' : '')
    + (spWhy ? '<div class="small mut" style="margin-top:4px">' + esc(spWhy) + '</div>' : '')
    + (rx ? '<div class="small" style="margin-top:5px;color:var(--ok)">📈 Reaksi nyata (' + esc(rx.window) + ', ' + esc(rx.bar) + '): rentang <b>' + esc(String(rx.rangePips)) + ' pip</b> · naik ' + esc(String(rx.upPips)) + ' / turun ' + esc(String(rx.downPips)) + ' · net ' + (rx.netPips > 0 ? '+' : '') + esc(String(rx.netPips)) + ' pip → ' + esc(rx.firstDir) + '</div>' : '')
    + '</div>'
    + '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>🧭 Kenapa arah ' + act + ':</b> <b style="color:' + mcol + '">' + esc(mdir) + '</b>' + (x.action_source === 'reaksi rilis' ? ' · dasar: reaksi harga sesudah rilis' : (mk.score != null ? ' · skor ' + esc(String(mk.score)) : '') + (mk.strong ? ' · bukti kuat' : ' · bukti belum dominan')) + '</div>'
    + (mev.length || x.action_reason ? '<div style="margin-top:4px">' + mev.map(function (e, i) { return '<div class="small mut">' + (i + 1) + '. ' + esc(e.why) + ' (' + (e.w > 0 ? '+' : '') + esc(String(e.w)) + ')</div>'; }).join('') + (x.action_reason ? '<div class="small" style="margin-top:5px;line-height:1.55">' + esc(x.action_reason) + '</div>' : '') + '</div>' : '<div class="small mut" style="margin-top:4px">Belum ada data pasar yang cukup untuk mengoreksi arah AI; keyakinan dibatasi.</div>')
    + '<div class="small mut" style="margin-top:6px">Analisis di bawah hanya untuk rilis ini; AI tetap memakai seluruh data global untuk satu keputusan akhir. ' + (x.action_source === 'reaksi rilis' ? 'Arah final mengikuti reaksi harga NYATA sesudah rilis, karena gerak harga lebih kuat daripada skor makro lambat (DXY/yield 5–20 hari).' : x.action_overridden ? 'Arah AI dikoreksi mesin karena bertentangan dengan harga/DXY/yield/kejutan rilis.' : x.action_forced ? 'Arah final dipilih mesin karena AI netral/WAIT.' : 'Arah final berasal dari AI dan sudah dicek terhadap data pasar.') + '</div></div>';
}

/* Sumber tambahan: YouTube (kanal resmi & komunitas) + media AS terpercaya.
   Semua hanya konteks arah; angka harga tetap dari candle + kalender resmi. */
function xauSrcCard(j) {
  const yt = j.yt || {}, us = j.us || {};
  const yi = Array.isArray(yt.items) ? yt.items.slice(0, 10) : [];
  const ui = Array.isArray(us.items) ? us.items.slice(0, 8) : [];
  if (!yi.length && !ui.length) return '';
  const age = h => (h == null ? '' : h < 48 ? h + ' jam lalu' : Math.round(h / 24) + ' hari lalu');
  const uRows = ui.map(function (x) {
    return '<div class="item"><span><a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:var(--b)">' + esc(x.title) + '</a>'
      + '<div class="small mut">' + esc(x.source || 'media AS') + (x.ageH != null ? ' · ' + esc(age(x.ageH)) : '') + '</div></span></div>';
  }).join('');
  const yRows = yi.map(function (x) {
    return '<div class="item"><span><a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:var(--b)">' + esc(x.title) + '</a>'
      + '<div class="small mut">' + (x.trusted ? '✅ ' + esc(x.trusted) : '👤 komunitas') + ' · ' + esc(x.channel || '') + (x.ageH != null ? ' · ' + esc(age(x.ageH)) : '') + '</div></span></div>';
  }).join('');
  return '<div class="card"><div class="rb-card-head"><h3>📺 YouTube &amp; media AS terpercaya</h3><span class="rb-pill">' + yi.length + ' video · ' + ui.length + ' berita</span></div>'
    + '<div class="rb-note">YouTube dibaca dari judul, kanal, dan umur unggahan; media AS dari Google News RSS (Reuters, AP, Bloomberg, CNBC, WSJ, FT, MarketWatch, Fox Business). Keduanya dipakai sebagai <b>konteks arah</b> — bukan sumber angka harga. Angka tetap dari candle live, [P], dan kalender resmi.</div>'
    + (ui.length ? '<div style="margin-top:8px"><b class="small">📰 Media AS · berita emas &amp; Fed</b>' + uRows + '</div>' : '')
    + (yi.length ? '<div style="margin-top:8px"><b class="small">▶️ YouTube · pergerakan XAUUSD</b>' + yRows + '</div>' : '')
    + '<div class="small mut" style="margin-top:8px">' + esc((yt && yt.note) || '') + '</div></div>';
}

/* Pembungkus renderXau: tampilan lama tetap, lalu tambah kartu validitas & prediksi. */
const RB31_RENDER_XAU = window.renderXau;
window.renderXau = function renderXau(j, stale) {
  if (typeof xauFocusGet === 'function' && j && j.focus && j.focus !== xauFocusGet()) return;
  if (typeof RB31_RENDER_XAU === 'function') { try { RB31_RENDER_XAU(j, stale); } catch (e) { console.warn('renderXau:', e); } }
  const box = $('xres');
  if (!box || !j || !j.xai) return;
  let add = typeof xauFocusCard === 'function' ? xauFocusCard(j) : '';
  const x = j.xai, evs = x.events || [];
  const t = j.fetchedAt ? new Date(j.fetchedAt) : null;
  const ageMin = t ? Math.max(0, Math.round((Date.now() - t.getTime()) / 60000)) : null;
  const fresh = ageMin != null ? (ageMin <= 15 ? '✅ sangat baru (' + ageMin + ' menit)' : ageMin <= 60 ? '🟡 ' + ageMin + ' menit' : '⚠️ ' + ageMin + ' menit — ambil ulang') : '—';

  const validRows = [];
  evs.forEach(function (e) {
    if (!e || !e.tag) return;
    validRows.push('<div class="exp" style="color:var(--tx);margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + esc(e.tag) + ' — ' + esc(e.title || '') + '</b><span class="small mut">keyakinan ' + esc(e.confidence || '—') + '</span></div>'
      + (e.spike ? '<div class="small" style="margin-top:4px;color:var(--warn)">⚡ <b>Spike:</b> ' + esc(e.spike) + '</div>' : '')
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

  add += xauSrcCard(j);

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
    + '<div class="rb-card-head"><h3>🎯 Rencana entry dari data global (mesin)</h3><span class="rb-pill">SL tepat 30 · TP1 ≥100 · TP2 ≥200 · TPmax target maksimal</span></div>'
    + '<div style="font-weight:900;font-size:1.2rem;color:' + col + ';letter-spacing:-.02em">'
    + (dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — belum ada konfluensi') + '</div>'
    + (levels || '<div class="small" style="margin-top:6px">Mesin menolak memaksa entry. ' + ((sig.gates || []).length ? 'Ditahan karena: ' + sig.gates.map(esc).join(' · ') + '.' : 'Tunggu checklist terpenuhi.') + '</div>')
    + (sig.tv && sig.tv.ok ? '<div class="small" style="margin-top:8px">📺 Chart TradingView real-time: <b style="color:' + (sig.tv.bias === 1 ? 'var(--ok)' : sig.tv.bias === -1 ? 'var(--no)' : 'var(--mut)') + '">' + esc(sig.tv.biasLabel) + '</b> · M15 ' + esc(((sig.tv.tf || {})['15'] || {}).recLabel || '—') + ' · D1 ' + esc(((sig.tv.tf || {}).D || {}).recLabel || '—') + (sig.tvSync ? ' · level mengikuti chart ' + sigNum(sig.tvSync.price) + (sig.tvSync.spotGapPips != null ? ' · spot beda ' + esc(String(sig.tvSync.spotGapPips)) + ' pip' : '') : '') + '</div>' : '<div class="small mut" style="margin-top:8px">📺 Chart TradingView belum terbaca — rencana memakai candle mesin.</div>')
    + '<div class="small mut" style="margin-top:8px">Keyakinan ' + sig.confidence + '% · skor ' + sig.score + ' · checklist ' + ok + '/' + n + ' OK · konfirmasi ' + (sig.confirms == null ? '—' : sig.confirms + '/6') + ' · ' + esc(sig.timeframe || 'M15') + ' · harga ' + sigNum(sig.price) + (sig.news && sig.news.length ? ' · ⚠️ rilis ≤90 menit' : '') + '</div>'
    + '<div class="small mut" style="margin-top:4px">Level dari mesin deterministik. TPmax = konfluensi struktur, likuiditas (PDH/PDL, pool, range H4/D1/Asia), ATR D1/mingguan, measured move, Fib, dan level psikologis.</div>'
    + '<button class="btn alt full" type="button" style="margin-top:8px" onclick="S.sec=\'trading\';S.tab=\'signal\';home()">Buka tab  Signal Entry</button>'
    + '</div>';
}

/* =====================================================================
   2. SIGNAL ENTRY — 3–10 sinyal satu arah, SL tepat 30 pip, TP1 ≥100 / TP2 ≥200 / TPmax konfluensi global, auto 15 menit
   ===================================================================== */
const RB31_TRK = 'rb31_sig_active_v1', RB31_CLOSED = 'rb31_sig_closed_v1';
const RB31_MAX = 10, RB31_MIN = 3, RB31_COOLDOWN = 20 * 60000;
const RB31_STYLE_LABEL = { SCALPING: 'Scalping', DAY: 'Day Trading', SWING: 'Swing Trading' };
const RB31_STYLE_ORDER = ['SCALPING', 'DAY', 'SWING'];
const RB31_MEM = { active: null, closed: null };
function rb31Style(s) {
  const v = String((s && s.style) || 'DAY').toUpperCase();
  return RB31_STYLE_LABEL[v] ? v : 'DAY';
}
function rb31StyleLabel(v) { return RB31_STYLE_LABEL[rb31Style({ style: v })]; }
function rb31StyleNow() {
  if (SIG_ST.style === 'ALL' || RB31_STYLE_LABEL[SIG_ST.style]) return SIG_ST.style;
  try {
    const v = localStorage.getItem('rb31_style_v1');
    if (v === 'ALL' || RB31_STYLE_LABEL[v]) SIG_ST.style = v;
  } catch (e) { }
  return SIG_ST.style || 'ALL';
}
function rb31StyleSet(v) {
  SIG_ST.style = v === 'ALL' || RB31_STYLE_LABEL[v] ? v : 'ALL';
  try { localStorage.setItem('rb31_style_v1', SIG_ST.style); } catch (e) { }
  sigPaint();
}

/* Baca/tulis dengan cadangan memori: kartu Sinyal aktif tidak boleh kosong hanya
   karena localStorage penuh atau diblokir browser. */
function rb31Read(key, fb) {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { }
  const mem = key === RB31_TRK ? RB31_MEM.active : key === RB31_CLOSED ? RB31_MEM.closed : null;
  if (Array.isArray(a) && (a.length || !Array.isArray(mem))) return a;
  return Array.isArray(mem) ? mem : fb;
}
function rb31Write(key, v) {
  const a = Array.isArray(v) ? v.slice() : [];
  if (key === RB31_TRK) RB31_MEM.active = a;
  if (key === RB31_CLOSED) RB31_MEM.closed = a;
  try { localStorage.setItem(key, JSON.stringify(a)); } catch (e) { }
}
function rb31Active() {
  const a = rb31Read(RB31_TRK, []).filter(function (s) { return s && s.id && s.entry != null && s.sl != null && s.tp1 != null; });
  /* Satu sinyal aktif per gaya (Scalping / Day Trading / Swing Trading) DAN
     hanya satu arah pada satu waktu. BUY dan SELL tidak pernah berjalan
     bersamaan; sinyal berlawanan ditutup sebagai BATAL oleh rb31TrackSync. */
  const picked = {};
  a.forEach(function (s) {
    const st = rb31Style(s), old = picked[st];
    if (!old || (s.openedAt || 0) > (old.openedAt || 0)) picked[st] = s;
  });
  const list = RB31_STYLE_ORDER.map(function (st) { return picked[st]; }).filter(Boolean);
  if (list.length < 2) return list;
  const newest = list.slice().sort(function (x, y) { return (y.openedAt || 0) - (x.openedAt || 0); })[0];
  return list.filter(function (s) { return s.dir === newest.dir; });
}
function rb31Closed() { return rb31Read(RB31_CLOSED, []).filter(function (s) { return s && s.id && s.closedAt; }); }
function rb31SigKey(s) { return String(s.id || s.method || 'x').replace(/[^a-zA-Z0-9_]+/g, '-') + '|' + s.dir; }
function rb31SigRecord(s, now) {
  const e = rb31n(s.entry), sl = rb31n(s.sl), tp1 = rb31n(s.tp1 != null ? s.tp1 : s.tp);
  const tp2 = rb31n(s.tp2 != null ? s.tp2 : s.tp1 != null ? s.tp1 : s.tp);
  const tpM = rb31n(s.tpMax != null ? s.tpMax : s.tp2 != null ? s.tp2 : s.tp);
  if (e == null || sl == null || tp1 == null) return null;
  const pip = 0.1;
  return {
    id: rb31SigKey(s), method: s.method || 'Alchemist', dir: s.dir, style: rb31Style(s),
    styleWhy: s.styleWhy || '', globalWhy: s.globalWhy || '', entry: e, sl: sl,
    tp1: tp1, tp2: tp2 != null ? tp2 : tp1, tpMax: tpM != null ? tpM : (tp2 != null ? tp2 : tp1),
    slPips: rb31n(s.slPips) || Math.round(Math.abs(e - sl) / pip),
    tp1Pips: rb31n(s.tpPips) || Math.round(Math.abs(tp1 - e) / pip),
    tp2Pips: rb31n(s.tp2Pips) || (tp2 != null ? Math.round(Math.abs(tp2 - e) / pip) : null),
    tpMaxPips: rb31n(s.tpMaxPips) || (tpM != null ? Math.round(Math.abs(tpM - e) / pip) : null),
    rr: rb31n(s.rr), score: rb31n(s.score), valid: !!s.valid, why: s.why || '', need: s.need || '',
    entryWhy: s.entryWhy || '', slWhy: s.slWhy || '', tpWhy: s.tpWhy || '', confluence: s.confluence || '',
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
  const lockDir = (d.direction === 'BUY' || d.direction === 'SELL') ? d.direction : null;
  const canOpen = !!lockDir;
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
  /* Kunci arah: bila mesin membalik arah, sinyal lama yang berlawanan ditutup
     BATAL (0R). Ini mencegah portofolio berisi BUY dan SELL sekaligus. */
  if (lockDir) {
    act.forEach(function (s) {
      if (s.dir === lockDir || s.status === 'SL' || s.status === 'TP2' || s.status === 'MAX' || s.status === 'BATAL') return;
      s.status = 'BATAL'; s.result = 'BATAL'; s.r = 0;
      s.closePrice = (px && px > 0) ? px : (s.lastPrice || s.entry); s.closedAt = now; changed = true;
    });
  }
  const done = act.filter(function (s) { return s.status === 'SL' || s.status === 'TP2' || s.status === 'MAX' || s.status === 'BATAL'; });
  if (done.length) {
    const doneIds = {};
    done.forEach(function (s) { doneIds[s.id] = s.closedAt || now; });
    closed = done.concat(closed).sort(function (a, b) { return (b.closedAt || 0) - (a.closedAt || 0); }).slice(0, 30);
    act = act.filter(function (s) { return !doneIds[s.id]; });
    changed = true;
  }
  if (!canOpen) {
    if (changed) { rb31Write(RB31_TRK, act.slice(0, RB31_MAX)); rb31Write(RB31_CLOSED, closed); }
    return changed;
  }
  const pool = (d.setups || []).slice().sort(function (a, b) {
    return ((b.valid ? 1 : 0) - (a.valid ? 1 : 0)) || ((rb31n(b.score) || 0) - (rb31n(a.score) || 0));
  });
  pool.forEach(function (s) {
    if (act.length >= RB31_MAX) return;
    if (!s || s.status === 'LEWAT' || !s.dir || s.entry == null) return;
    if (s.dir !== lockDir) return;
    /* Satu setup aktif per gaya; setup lain tetap tampil di daftar kandidat. */
    if (act.some(function (x) { return rb31Style(x) === rb31Style(s); })) return;
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
  const buy = s.dir === 'BUY', style = rb31StyleLabel(s.style);
  const st = s.status === 'TP1' ? '<span class="rb-pill" style="color:var(--ok);border-color:var(--ok)">🟢 TP1 tercapai — lanjut TP2</span>'
    : '<span class="rb-pill" style="color:var(--warn)">⏳ AKTIF — tunggu SL/TP</span>';
  const to = (v) => price && v != null ? Math.round(Math.abs(v - price) / 0.1) + ' pip' : '—';
  return '<div class="exp" style="margin-bottom:8px;color:var(--tx);border-color:' + (s.status === 'TP1' ? 'var(--ok)' : 'var(--line2)') + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<b>' + (buy ? '🟢 BUY' : '🔴 SELL') + ' · ' + esc(s.method) + '</b><span class="rb-pill">' + esc(style) + '</span>'
    + '<span class="small mut">dibuka ' + esc(new Date(s.openedAt).toLocaleTimeString('id-ID')) + ' · skor ' + (s.score == null ? '—' : s.score) + '/5</span></div>'
    + (s.styleWhy ? '<div class="small" style="margin-top:4px;color:var(--b)">' + esc(s.styleWhy) + '</div>' : '')
    + (s.globalWhy ? '<div class="small mut" style="margin-top:3px"><b>Global:</b> ' + esc(s.globalWhy) + '</div>' : '')
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;margin-top:7px">'
    + sigMini('Entry', sigNum(s.entry))
    + sigMini('SL · ' + s.slPips + ' pip', '<span style="color:var(--no)">' + sigNum(s.sl) + '</span>')
    + sigMini('TP1 · ' + s.tp1Pips + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tp1) + '</span>')
    + sigMini('TP2 · ' + (s.tp2Pips == null ? '—' : s.tp2Pips) + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tp2) + '</span>')
    + sigMini('TP3 (max) · ' + (s.tpMaxPips == null ? '—' : s.tpMaxPips) + ' pip', '<span style="color:var(--ok)">' + sigNum(s.tpMax) + '</span>')
    + '</div>'
    + '<div class="small mut" style="margin-top:5px">Jarak dari harga: TP1 ' + to(s.tp1) + ' · TP2 ' + to(s.tp2) + ' · TPmax ' + to(s.tpMax) + ' · SL ' + to(s.sl) + '</div>'
    + '<div class="small" style="margin-top:5px">' + st + '</div>'
    + (s.why ? '<div class="small mut" style="margin-top:4px">' + esc(s.why) + '</div>' : '')
    + (s.entryWhy ? '<div class="small mut" style="margin-top:3px"><b>Entry:</b> ' + esc(s.entryWhy) + '</div>' : '')
    + (s.slWhy ? '<div class="small mut" style="margin-top:2px"><b>SL:</b> ' + esc(s.slWhy) + '</div>' : '')
    + (s.tpWhy ? '<div class="small mut" style="margin-top:2px"><b>TP:</b> ' + esc(s.tpWhy) + '</div>' : '')
    + (s.confluence ? '<div class="small" style="margin-top:2px;color:var(--b)">' + esc(s.confluence) + '</div>' : '')
    + (s.valid ? '' : '<div class="small" style="margin-top:3px;color:var(--warn)">⚠️ ' + esc(s.need || 'syarat belum lengkap') + '</div>')
    + '</div>';
}
function rb31ActiveHtml(price, d) {
  const sf = rb31StyleNow();
  const act = rb31Active().filter(function (s) { return sf === 'ALL' || rb31Style(s) === sf; });
  const pool = ((d && d.setups) || []).filter(function (s) { return s && (sf === 'ALL' || rb31Style(s) === sf); });
  const nReady = pool.filter(function (s) { return s && s.status === 'SIAP'; }).length;
  const nWait = pool.filter(function (s) { return s && s.status === 'TUNGGU'; }).length;
  const nLate = pool.filter(function (s) { return s && s.status === 'LEWAT'; }).length;
  const nBad = pool.filter(function (s) { return s && !s.valid && s.status !== 'LEWAT'; }).length;
  const sorted = act.slice().sort(function (a, b) { return (a.status === 'TP1' ? 0 : 1) - (b.status === 'TP1' ? 0 : 1) || (b.openedAt || 0) - (a.openedAt || 0); });
  const emptyWhy = pool.length
    ? '<div class="warn">Belum ada sinyal aktif. Kandidat terbaru: <b>' + pool.length + '</b> — ' + nReady + ' SIAP, ' + nWait + ' TUNGGU, ' + nLate + ' LEWAT, ' + nBad + ' belum valid. Sinyal hanya dicatat jika belum melewati entry/TP/SL dan tidak dalam cooldown 20 menit setelah selesai.</div>'
    : '<div class="warn">Belum ada sinyal aktif dan mesin belum menghasilkan kandidat. Tekan “Ambil data terbaru” untuk membaca candle XAUUSD live.</div>';
  return '<div class="card"><div class="rb-card-head"><h3>🟢 Sinyal aktif · ' + esc(sf === 'ALL' ? 'semua gaya' : rb31StyleLabel(sf)) + ' (' + act.length + '/' + RB31_STYLE_ORDER.length + ' gaya)</h3>'
    + '<span class="rb-pill">' + (act.length ? '✅ ' + act.length + ' sinyal · arah ' + esc(act[0].dir) : '⏳ menunggu sinyal baru') + '</span></div>'
    + (act.length ? '<div class="rb-pill-row" style="margin-bottom:8px"><span class="rb-pill y">🔒 Arah tunggal: ' + esc(act[0].dir) + '</span><span class="rb-pill">BUY &amp; SELL tidak bersamaan</span></div>' : '')
    + '<div class="rb-note">Maksimal <b>satu sinyal aktif per gaya</b>: Scalping, Day Trading, Swing Trading — semuanya mengikuti <b>satu arah mesin</b> pada satu waktu. BUY dan SELL tidak pernah tampil bersamaan; bila arah berbalik, sinyal lama ditutup <b>BATAL</b> lalu diganti. Sinyal bertahan sampai SL/TP1/TP2/TPmax. Data + AI diperbarui otomatis tiap <b>15 menit</b>.</div>'
    + (act.length ? sorted.map(function (s) { return rb31Card(s, price); }).join('') : emptyWhy)
    + '</div>';
}
function rb31ClosedPaint() {
  const el = $('sigHist');
  if (!el) return;
  const done = rb31Closed().slice(0, 6);
  el.innerHTML = '<div class="card"><div class="rb-card-head"><h3>🏁 Sinyal selesai (SL/TP)</h3>'
    + (done.length ? '<button class="x" type="button" onclick="rb31ClearClosed()">Hapus riwayat</button>' : '') + '</div>'
    + (done.length ? done.map(function (s) {
      const win = s.result === 'WIN', cancel = s.result === 'BATAL';
      return '<div class="item" style="align-items:flex-start"><span><b>' + (s.dir === 'BUY' ? '🟢 BUY' : '🔴 SELL') + ' · ' + esc(s.method) + '</b> <span class="rb-pill">' + esc(rb31StyleLabel(s.style)) + '</span><div class="small mut">' + esc(new Date(s.closedAt).toLocaleString('id-ID')) + ' · entry ' + sigNum(s.entry) + ' → ' + esc(s.status) + ' @' + sigNum(s.closePrice) + '</div></div><span style="white-space:nowrap;color:' + (win ? 'var(--ok)' : cancel ? 'var(--mut)' : 'var(--no)') + ';font-weight:800">' + (win ? '✅ ' : cancel ? '⏹ ' : '❌ ') + (cancel ? 'BATAL 0R' : s.r != null ? (s.r > 0 ? '+' : '') + s.r + 'R' : s.status) + '</span></div>';
    }).join('') : '<div class="mut small">Belum ada sinyal yang selesai. Sinyal dicatat otomatis saat kena SL/TP atau dibatalkan karena arah mesin berbalik.</div>')
    + '</div>';
}
function rb31ClearClosed() {
  if (!confirm('Hapus riwayat sinyal yang sudah selesai?')) return;
  rb31Write(RB31_CLOSED, []);
  rb31ClosedPaint();
}

/* Daftar 3–10 sinyal siap pakai dari mesin: satu arah, SL tepat 30 pip,
   TP1 ≥100 pip, TP2 ≥200 pip, TPmax dari konfluensi global. Diperbarui tiap 15 menit. */
/* ---------- Notifikasi: browser + kanal push server (tetap jalan saat web ditutup) ---------- */
function rb31NotifMode() {
  try { return localStorage.getItem('rb31_notif_mode_v1') === 'summary' ? 'summary' : 'each'; } catch (e) { return 'each'; }
}
function rb31NotifSet(m) {
  try { localStorage.setItem('rb31_notif_mode_v1', m === 'summary' ? 'summary' : 'each'); } catch (e) { }
  rb31PushPaint();
}
function rb31CopyTxt(txt, btn) {
  const done = function () {
    if (btn) { const o = btn.textContent; btn.textContent = '✅ Tersalin'; setTimeout(function () { btn.textContent = o; }, 1500); }
    else if (typeof v21Toast === 'function') v21Toast('Tersalin');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
    else done();
  } catch (e) { done(); }
}
function rb31PushLoad() {
  if (SIG_ST.push && SIG_ST.push.topic && Date.now() - (SIG_ST.push.at || 0) < 30 * 60000) return;
  if (SIG_ST.push && SIG_ST.push.loading) return;
  SIG_ST.push = { loading: true, at: Date.now() };
  Promise.resolve(tcall({ action: 'xauSignal', phase: 'push' })).then(function (r) {
    if (r && r.topic) SIG_ST.push = { topic: r.topic, channel: r.channel || ('https://ntfy.sh/' + r.topic), cronKey: r.cronKey || '', schedule: r.cronSchedule || '*/15 * * * *', telegram: r.telegram || null, site: r.site || '', refreshSec: r.refreshSec || 900, at: Date.now() };
    else SIG_ST.push = { error: 'Topik push tidak tersedia dari server.', at: Date.now() };
    rb31PushPaint();
  }).catch(function () {
    SIG_ST.push = { error: 'Gagal memuat topik push. Periksa koneksi lalu coba lagi.', at: Date.now() };
    rb31PushPaint();
  });
}
function rb31PushTest(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengirim…'; }
  const reset = function () { if (btn) { btn.disabled = false; btn.textContent = '📨 Kirim tes Telegram'; } };
  Promise.resolve(tcall({ action: 'xauSignal', phase: 'pushTest' })).then(function (r) {
    const t = (r && r.telegram) || {};
    const msg = t.ok ? '✅ Tes Telegram terkirim ke ' + t.sent + ' chat' : '⚠️ ' + (t.error || t.reason || 'gagal mengirim');
    if (typeof v21Toast === 'function') v21Toast(msg);
    reset();
  }).catch(function () {
    if (typeof v21Toast === 'function') v21Toast('Tes gagal: jaringan');
    reset();
  });
}
function rb31TgHook(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Menghubungkan…'; }
  const reset = function () { if (btn) { btn.disabled = false; btn.textContent = '🔗 Hubungkan bot'; } };
  Promise.resolve(tcall({ action: 'xauSignal', phase: 'tgHook' })).then(function (r) {
    const msg = r && r.ok ? '✅ Bot terhubung — coba kirim /sinyal' : '⚠️ ' + ((r && (r.description || r.error)) || 'gagal menghubungkan');
    if (typeof v21Toast === 'function') v21Toast(msg);
    SIG_ST.push = null; rb31PushLoad(); reset();
  }).catch(function () {
    if (typeof v21Toast === 'function') v21Toast('Gagal menghubungkan: jaringan');
    reset();
  });
}
function rb31TgInfo(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memeriksa…'; }
  const reset = function () { if (btn) { btn.disabled = false; btn.textContent = 'ℹ️ Cek webhook'; } };
  Promise.resolve(tcall({ action: 'xauSignal', phase: 'tgInfo' })).then(function (r) {
    const msg = r && r.ok
      ? 'Webhook: ' + (r.url ? 'aktif' : 'belum diset') + ' · antrean ' + (r.pending || 0) + ' pesan' + (r.lastError ? ' · error: ' + String(r.lastError).slice(0, 60) : '')
      : '⚠️ ' + ((r && r.error) || 'gagal memeriksa webhook');
    if (typeof v21Toast === 'function') v21Toast(msg);
    reset();
  }).catch(function () {
    if (typeof v21Toast === 'function') v21Toast('Gagal memeriksa: jaringan');
    reset();
  });
}
function rb31PushCard() {
  const p = SIG_ST.push || {}, perm = sigNotifPerm(), mode = rb31NotifMode(), on = perm === 'granted';
  const tg = p.telegram || {};
  const origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
  const cron = p.topic ? (origin + '/api/cron?key=' + (p.cronKey || '')) : '';
  return '<div class="card"><div class="rb-card-head"><h3>🔔 Notifikasi setiap sinyal</h3>'
    + '<span class="rb-pill" style="color:' + (on ? 'var(--ok)' : 'var(--warn)') + ';border-color:' + (on ? 'var(--ok)' : 'var(--warn)') + '">' + (on ? '✅ browser aktif' : '⏳ browser belum aktif') + '</span></div>'
    + '<div class="rb-note">Mesin Alchemist + data global tetap <b>dianalisis server tiap 15 menit</b> lewat <code>/api/cron</code> — tidak bergantung pada tab yang terbuka. Notifikasi ke HP/desktop dikirim ke kanal <b>ntfy</b> (gratis, tanpa akun): buka tautan topik di aplikasi ntfy atau browser, lalu izinkan notifikasinya. Notifikasi browser di bawah menangkap setiap sinyal selama halaman ini terbuka.</div>'
    + '<div class="rb-pill-row" style="margin:8px 0"><button class="x" type="button" onclick="sigNotifAsk()">' + esc(sigNotifLabel()) + '</button>'
    + '<button class="x" type="button" onclick="rb31NotifSet(\'each\')" style="' + (mode === 'each' ? 'border-color:var(--accent);color:var(--accent);font-weight:800' : '') + '">Per sinyal</button>'
    + '<button class="x" type="button" onclick="rb31NotifSet(\'summary\')" style="' + (mode === 'summary' ? 'border-color:var(--accent);color:var(--accent);font-weight:800' : '') + '">Ringkasan siklus</button></div>'
    + (p.topic
      ? '<div class="exp" style="color:var(--tx)"><div class="small mut">Topik push server (rahasia, jangan dibagikan)</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><b style="word-break:break-all">' + esc(p.topic) + '</b>'
        + '<button class="x" type="button" onclick="rb31CopyTxt(\'' + esc(p.topic) + '\',this)">📋 Salin topik</button>'
        + '<a class="x" href="' + esc(p.channel) + '" target="_blank" rel="noopener" style="text-decoration:none">Subscribe ntfy ↗</a></div>'
        + '<div class="small mut" style="margin-top:6px">Site server: <b>' + esc(p.site || (typeof location !== 'undefined' ? location.origin : '—')) + '</b> · jadwal <b>' + esc(p.schedule) + '</b> · URL penjadwal (simpan rahasia):<br><span style="word-break:break-all">' + esc(cron) + '</span> '
        + '<button class="x" type="button" style="margin-top:4px" onclick="rb31CopyTxt(\'' + esc(cron) + '\',this)">📋 Salin URL cron</button></div>'
        + '<div class="small mut" style="margin-top:6px">Di Vercel Hobby, cron 15 menit butuh paket Pro. Alternatif gratis: tempel URL di atas ke cron-job.org atau uptime service, interval 15 menit.</div>'
        + '<div class="small" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line2)"><b>Kanal Telegram:</b> ' + (tg.enabled
          ? '<span style="color:var(--ok)">✅ aktif · ' + esc(String(tg.chats || 0)) + ' chat</span>'
          : '<span style="color:var(--warn)">⏳ belum diisi</span> — set env <b>TELEGRAM_BOT_TOKEN</b> + <b>TELEGRAM_CHAT_ID</b> di Vercel (chat id boleh dipisah koma), lalu deploy ulang.') + '</div>'
        + (tg.enabled ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="x" type="button" onclick="rb31PushTest(this)">📨 Kirim tes Telegram</button><button class="x" type="button" onclick="rb31TgHook(this)">🔗 Hubungkan bot</button><button class="x" type="button" onclick="rb31TgInfo(this)">ℹ️ Cek webhook</button></div>' : '')
        + (tg.enabled && tg.webhook ? '<div class="small mut" style="margin-top:4px">Webhook: <span style="word-break:break-all">' + esc(tg.webhook) + '</span><br>Perintah bot: <b>/sinyal</b> · <b>/status</b> · <b>/help</b></div>' : '')
        + '</div>'
      : (p.loading ? '<div class="small mut">Memuat topik push…</div>' : '<div class="warn" style="margin:0">' + esc(p.error || 'Topik push belum dimuat.') + ' <button class="x" type="button" onclick="rb31PushLoad()">Coba lagi</button></div>'))
    + '</div>';
}
function rb31PushPaint() {
  const el = $('sigPush');
  if (el) el.innerHTML = rb31PushCard();
}
/* Notifikasi lokal: satu per sinyal (atau satu ringkasan per siklus), di-dedupe
   per siklus analisis supaya tidak berbunyi berulang pada data yang sama. */
function rb31Notify(d) {
  if (!d || d.error || sigNotifPerm() !== 'granted') return 0;
  const key = 'rb31_notified_v2';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { seen = {}; }
  const now = Date.now(), cyc = String(d.generatedAt || ''), arr = Array.isArray(d.setups) ? d.setups : [];
  const mode = rb31NotifMode();
  let n = 0;
  if (mode === 'summary') {
    const k = 'sum|' + cyc;
    if (arr.length && !seen[k]) {
      seen[k] = now;
      try {
        const nt = new Notification('🎯 ' + arr.length + ' sinyal XAUUSD · ' + (d.singleDirection || d.direction || '—'), {
          body: arr.map(function (s) { return (s.dir === 'BUY' ? '🟢' : '🔴') + ' ' + (s.method || 'Alchemist') + ' · E' + sigNum(s.entry) + ' SL' + sigNum(s.sl) + ' TP1 ' + sigNum(s.tp1 != null ? s.tp1 : s.tp); }).join('\n').slice(0, 900),
          tag: k
        });
        nt.onclick = function () { try { window.focus(); } catch (e) { } try { nt.close(); } catch (e) { } };
        n++;
      } catch (e) { }
    }
  } else {
    arr.forEach(function (s) {
      const k = cyc + '|' + (s.id || s.method) + '|' + s.dir + '|' + s.entry;
      if (seen[k]) return;
      seen[k] = now;
      try {
        const nt = new Notification((s.dir === 'BUY' ? '🟢 BUY' : '🔴 SELL') + ' XAUUSD · ' + (s.method || 'Alchemist'), {
          body: 'Entry ' + sigNum(s.entry) + ' (' + (s.type || 'LIMIT') + ')\nSL ' + sigNum(s.sl) + ' (' + s.slPips + ' pip)\nTP1 ' + sigNum(s.tp1 != null ? s.tp1 : s.tp) + ' (' + s.tpPips + ' pip)\nTP2 ' + sigNum(s.tp2) + '\nTPmax ' + sigNum(s.tp3 != null ? s.tp3 : s.tpMax) + '\nStatus: ' + (s.status || '—'),
          tag: k
        });
        nt.onclick = function () { try { window.focus(); } catch (e) { } try { nt.close(); } catch (e) { } };
        n++;
      } catch (e) { }
    });
  }
  Object.keys(seen).forEach(function (k) { if (now - seen[k] > 3 * 86400000) delete seen[k]; });
  try { localStorage.setItem(key, JSON.stringify(seen)); } catch (e) { }
  return n;
}

/* Chart analisis real-time: candle yang benar-benar dipakai mesin (M15 + M5)
   digambar bersama level entry/SL/TP1/TP2/TP3 dan zona FVG. Widget TradingView
   di bawah tetap dipakai untuk verifikasi visual; isi iframe tidak bisa dibaca
   lintas-domain, jadi level dihitung dari feed harga yang sama dengan chart itu. */
/* Kartu bacaan chart TradingView real-time: angka yang benar-benar dipakai
   mesin (harga, rekomendasi 6 timeframe, RSI) + status sinkron harga. */
function rb31TvCard(d) {
  const t = (d && d.tv) || null, s = (d && d.tvSync) || null, ok = !!(t && t.ok);
  const tcol = v => (v === 1 ? 'var(--ok)' : v === -1 ? 'var(--no)' : 'var(--mut)');
  const tfs = [['D', '1D'], ['240', '4H'], ['60', '1H'], ['15', '15m'], ['5', '5m'], ['1', '1m']];
  const cells = tfs.map(function (x) {
    const f = (ok && t.tf && t.tf[x[0]]) || {};
    const dir = f.rec == null ? 0 : f.rec >= 0.1 ? 1 : f.rec <= -0.1 ? -1 : 0;
    return '<div class="rb-lv"><span>' + x[1] + '</span><b style="color:' + tcol(dir) + '">' + esc(f.recLabel || '—') + '</b>'
      + (f.rsi != null ? '<div class="small mut" style="margin-top:2px">RSI ' + esc(String(f.rsi)) + '</div>' : '') + '</div>';
  }).join('');
  const strength = ok && t.strength != null ? Math.max(0, Math.min(100, Number(t.strength))) : 0;
  const chg = ok && t.changePct != null ? Number(t.changePct) : null;
  const chgCol = chg == null ? 'var(--mut)' : chg > 0 ? 'var(--ok)' : chg < 0 ? 'var(--no)' : 'var(--mut)';
  const syncTxt = s
    ? 'Level entry/SL/TP mengikuti <b>chart TradingView ' + sigNum(s.price) + '</b>'
      + (s.spotGapPips != null ? ' · spot emas beda ' + esc(String(s.spotGapPips)) + ' pip (' + esc(String(s.spotGapPct)) + '%) sebagai pembanding' : '')
      + ' · ' + (s.ok ? '<span style="color:var(--ok)">✅ level dan chart satu acuan</span>' : '<span style="color:var(--warn)">⚠️ acuan level bukan chart</span>')
    : 'acuan harga chart belum terbaca';
  return '<div class="card"><div class="rb-card-head"><h3>📺 Chart TradingView — dibaca mesin</h3>'
    + '<span class="rb-pill" style="color:' + (ok ? 'var(--ok)' : 'var(--warn)') + ';border-color:' + (ok ? 'var(--ok)' : 'var(--warn)') + '">' + (ok ? '● LIVE ' + esc(t.symbol) : '⚠️ TIDAK TERSEDIA') + '</span></div>'
            + '<div class="rb-note">Harga, rekomendasi 6 timeframe, RSI, EMA, dan ATR di bawah diambil langsung dari TradingView (simbol <b>OANDA:XAUUSD</b>), bukan dari iframe dan bukan tebakan. Harga chart ini menjadi <b>acuan level</b>: entry, SL, dan TP digeser dengan kalibrasi yang sama, jadi tidak ada level yang melayang dari chart yang kamu lihat. Rekomendasi TradingView juga ikut menilai setiap setup Alchemist.</div>'
    + (ok
      ? '<div class="exp" style="margin-top:10px;color:var(--tx)"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap">'
        + '<div><div class="small mut">Harga chart TradingView</div><div style="font-family:var(--font-display);font-size:1.55rem;font-weight:700;letter-spacing:-.01em;line-height:1.2">' + sigNum(t.price) + '</div></div>'
        + '<div style="text-align:right"><div class="small mut">Perubahan hari ini</div><div style="font-weight:700;color:' + chgCol + '">' + (chg == null ? '—' : (chg > 0 ? '+' : '') + chg.toFixed(2) + '%') + (t.changeAbs != null ? ' · ' + (t.changeAbs > 0 ? '+' : '') + Number(t.changeAbs).toFixed(2) : '') + '</div></div></div>'
        + '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:.82rem"><span>Bias gabungan</span><b style="color:' + tcol(t.bias) + '">' + esc(t.biasLabel) + ' · ' + esc(String(t.strength)) + '%</b></div>'
        + '<div class="rb-meter" style="margin-top:5px"><i style="flex:' + Math.max(1, strength) + ';background:' + tcol(t.bias) + '"></i><i style="flex:' + Math.max(1, 100 - strength) + ';background:var(--line2)"></i></div></div>'
        + '<div class="rb-lv-grid" style="margin-top:10px">' + cells + '</div>'
        + '<div class="small mut" style="margin-top:8px">' + syncTxt + '</div>'
        + '<div class="small mut" style="margin-top:4px">Diambil ' + esc(new Date(t.at).toLocaleTimeString('id-ID')) + ' · ' + esc(t.source) + ' · RSI 15m ' + esc(String((t.tf['15'] || {}).rsi == null ? '—' : (t.tf['15'] || {}).rsi)) + ' · ATR 15m ' + esc(String((t.tf['15'] || {}).atr == null ? '—' : (t.tf['15'] || {}).atr)) + '</div>'
      : '<div class="warn" style="margin-top:10px">Chart TradingView belum bisa dibaca: <b>' + esc((t && t.error) || 'jaringan') + '</b>. Mesin tetap berjalan dengan candle live Yahoo + spot emas, dan setiap setup ditandai belum terkonfirmasi chart TradingView — tidak ada angka chart yang dikarang.</div>')
    + '</div>';
}
function rb31ChartHtml(d) {
  const ch = d && d.chart;
  if (!ch || !Array.isArray(ch.rows) || ch.rows.length < 12) return '';
  const rows = ch.rows.slice(-96);
  const W = 760, H = 300, padL = 6, padR = 88, padT = 10, padB = 22;
  const plan0 = d.plan || (Array.isArray(d.setups) && d.setups[0]) || null;
  const lv = [];
  if (plan0) {
    [['Entry', plan0.entry, 'var(--accent)'], ['SL', plan0.sl, 'var(--no)'],
      ['TP1', plan0.tp1 != null ? plan0.tp1 : plan0.tp, 'var(--ok)'],
      ['TP2', plan0.tp2, '#4ade80'], ['TPmax', plan0.tp3 != null ? plan0.tp3 : plan0.tpMax, '#22c55e']]
      .forEach(function (x) { const v = Number(x[1]); if (x[1] != null && isFinite(v)) lv.push({ k: x[0], v: v, c: x[2] }); });
  }
  const lo0 = Math.min.apply(null, rows.map(function (r) { return r.l; }));
  const hi0 = Math.max.apply(null, rows.map(function (r) { return r.h; }));
  const span0 = Math.max(hi0 - lo0, 1);
  const near = lv.filter(function (x) { return x.v >= lo0 - span0 * 0.8 && x.v <= hi0 + span0 * 0.8; });
  const lo = Math.min.apply(null, [lo0].concat(near.map(function (x) { return x.v; })));
  const hi = Math.max.apply(null, [hi0].concat(near.map(function (x) { return x.v; })));
  const pad = Math.max((hi - lo) * 0.08, 0.5), y0 = lo - pad, y1 = hi + pad;
  const xAt = function (i) { return padL + (i + 0.5) * ((W - padL - padR) / rows.length); };
  const bw = Math.max(2, ((W - padL - padR) / rows.length) * 0.62);
  const yAt = function (v) { return padT + (y1 - v) / (y1 - y0) * (H - padT - padB); };
  const fx = function (v) { return v == null || !isFinite(Number(v)) ? '' : Number(v).toFixed(2); };
  let svg = '';
  (ch.zones || []).slice(-8).forEach(function (z) {
    if (z.lo == null || z.hi == null) return;
    const top = yAt(Math.min(z.hi, y1)), bot = yAt(Math.max(z.lo, y0));
    if (bot - top < 1) return;
    svg += '<rect x="' + padL + '" y="' + (top - 2).toFixed(1) + '" width="' + (W - padL - padR) + '" height="' + (bot - top + 4).toFixed(1) + '" fill="' + (z.kind === 'bull' ? '#16a34a' : '#dc2626') + '" opacity="0.10"/>';
  });
  rows.forEach(function (r, i) {
    const up = r.c >= r.o, col = up ? '#22c55e' : '#ef4444', x = xAt(i);
    svg += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + yAt(r.h).toFixed(1) + '" y2="' + yAt(r.l).toFixed(1) + '" stroke="' + col + '" stroke-width="1"/>'
      + '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + yAt(Math.max(r.o, r.c)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, yAt(Math.min(r.o, r.c)) - yAt(Math.max(r.o, r.c))).toFixed(1) + '" fill="' + col + '"/>';
  });
  lv.forEach(function (x) {
    const yy = Math.max(padT, Math.min(H - padB, yAt(x.v)));
    const off = x.v > y1 ? ' ▲' : x.v < y0 ? ' ▼' : '';
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="' + x.c + '" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.9"/>'
      + '<text x="' + (W - padR + 4) + '" y="' + (yy + 3.5).toFixed(1) + '" fill="' + x.c + '" font-size="11" font-weight="700">' + x.k + ' ' + fx(x.v) + off + '</text>';
  });
  const last = rows[rows.length - 1].c, yl = yAt(last);
  svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yl.toFixed(1) + '" y2="' + yl.toFixed(1) + '" stroke="#e5e7eb" stroke-width="1" opacity="0.5"/>'
    + '<text x="' + (W - padR + 4) + '" y="' + (yl + 3.5).toFixed(1) + '" fill="#e5e7eb" font-size="11" font-weight="800">' + fx(last) + '</text>'
    + '<text x="' + padL + '" y="' + (H - 6) + '" fill="#94a3b8" font-size="10">' + esc(ch.tf || 'M15') + ' · ' + rows.length + ' candle live · 1 pip = 0,1 · zona = FVG</text>';
  const dir = d.direction === 'BUY' ? 'var(--ok)' : d.direction === 'SELL' ? 'var(--no)' : 'var(--warn)';
  return '<div class="card"><div class="rb-card-head"><h3>📊 Chart analisis real-time (candle mesin)</h3><span class="rb-pill" style="color:' + dir + ';border-color:' + dir + '">' + esc(d.direction || 'WAIT') + ' · ' + esc(ch.tf || 'M15') + '</span></div>'
    + '<div class="rb-note" style="margin-bottom:8px">Candle <b>live</b> yang dipakai mesin untuk struktur, FVG/OB, sapuan, dan level entry — sumbernya sama dengan harga di TradingView (spot emas + M15/M5). Garis: entry, SL, TP1, TP2, TPmax. TradingView di bawah untuk verifikasi visual.</div>'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:12px;background:var(--bg2,#0d1117)" role="img" aria-label="Chart XAUUSD live dengan level mesin">' + svg + '</svg>'
    + '<div class="small mut" style="margin-top:6px">Terakhir: ' + esc(sigTime(d.candleAt)) + ' · harga ' + sigNum(d.price) + ' · ' + esc(d.structure || '—') + (d.m5 ? ' · M5 ' + esc(d.m5.trend) : '') + '</div></div>';
}
function rb31ListHtml(price, d) {
  const sf = rb31StyleNow();
  const all = ((d && d.setups) || []).filter(function (s) { return s && (s.dir === 'BUY' || s.dir === 'SELL'); });
  const list = all.filter(function (s) { return sf === 'ALL' || rb31Style(s) === sf; });
  const dir = (d && (d.singleDirection || d.biasDirection)) || (all[0] && all[0].dir) || '—';
  const dcls = dir === 'BUY' ? 'buy' : dir === 'SELL' ? 'sell' : 'wait';
  const head = '<div class="card"><div class="rb-card-head"><h3>🎯 ' + list.length + ' sinyal · satu arah</h3>'
    + '<span class="rb-dir ' + dcls + '">' + (dir === 'BUY' ? '🟢 BUY' : dir === 'SELL' ? '🔴 SELL' : '🟡 WAIT') + ' XAUUSD</span></div>'
    + '<div class="rb-pill-row" style="margin-bottom:8px"><span class="rb-pill y">⏱️ refresh 15 menit · <b id="sigNext">—</b></span>'
    + '<span class="rb-pill">SL tepat 30 pips</span><span class="rb-pill">TP1 ≥100</span><span class="rb-pill">TP2 ≥200</span><span class="rb-pill">TPmax target maksimal</span></div>'
    + (d && d.tfBias && window.rb33Tv ? window.rb33Tv.tfChips(d.tfBias) : '')
    + (d && d.tpMaxEngine && d.tpMaxEngine.why ? '<div class="small mut" style="margin:2px 0 8px"><b>TPmax:</b> ' + esc(d.tpMaxEngine.why) + '</div>' : '');
  if (!list.length) return head + '<div class="warn" style="margin:0">Mesin belum mengeluarkan sinyal pada siklus ini. Tekan “Ambil data terbaru” atau tunggu refresh 15 menit berikutnya.</div></div>';
  return head + list.map(function (s, i) {
    const buy = s.dir === 'BUY', st = s.status || 'TUNGGU';
    const stc = s.valid ? 'var(--ok)' : st === 'LEWAT' ? 'var(--mut)' : 'var(--warn)';
    const tp1 = s.tp1 != null ? s.tp1 : s.tp;
    const tp3 = s.tp3 != null ? s.tp3 : s.tpMax;
    const p3 = s.tp3Pips != null ? s.tp3Pips : s.tpMaxPips;
    const p1 = s.tp1Pips != null ? s.tp1Pips : s.tpPips;
    const dist = function (v) { return (price && v != null) ? Math.round(Math.abs(v - price) / 0.1) + ' pip' : '—'; };
    const tf = { SCALPING: 'M5 · M1', DAY: 'M15 · M5', SWING: 'H1 · D1' }[rb31Style(s)] || 'M15';
    const riskText = s.riskPerLot != null ? '$' + sigNum(s.riskPerLot) + ' / 1 lot' : '—';
    return '<div class="rb-sig ' + (buy ? 'buy' : 'sell') + (i === 0 ? ' top' : '') + '">'
      + '<div class="rb-sig-head"><div style="min-width:0"><div class="rb-sig-title">' + (buy ? '🟢 BUY' : '🔴 SELL') + ' #' + (i + 1) + ' · ' + esc(s.method) + '</div>'
      + '<div class="rb-sig-sub">' + esc(tf) + ' · ' + esc(s.type || 'LIMIT') + ' · risiko ' + riskText + '</div></div>'
      + '<div style="display:flex;gap:5px;flex-wrap:wrap"><span class="rb-pill y">' + esc(rb31StyleLabel(s.style)) + '</span>'
      + '<span class="rb-pill">pro ' + esc(String(s.pro != null ? s.pro : s.score)) + '/9</span>'
      + '<span class="rb-pill" style="color:' + stc + ';border-color:' + stc + '">' + esc(st) + '</span></div></div>'
      + '<div class="rb-lv-grid">'
      + '<div class="rb-lv"><span>Entry</span><b>' + sigNum(s.entry) + '</b></div>'
      + '<div class="rb-lv sl"><span>SL · 30 pip</span><b>' + sigNum(s.sl) + '</b></div>'
      + '<div class="rb-lv tp"><span>TP1 · ' + (p1 == null ? '—' : p1) + '</span><b>' + sigNum(tp1) + '</b></div>'
      + '<div class="rb-lv tp"><span>TP2 · ' + (s.tp2Pips == null ? '—' : s.tp2Pips) + '</span><b>' + sigNum(s.tp2) + '</b></div>'
      + '<div class="rb-lv tp"><span>TPmax · ' + (p3 == null ? '—' : p3) + '</span><b>' + sigNum(tp3) + '</b></div>'
      + '<div class="rb-lv"><span>RR TP1</span><b>1:' + (s.rr == null ? '—' : s.rr) + '</b></div>'
      + '</div>'
      + '<div class="rb-meter" aria-hidden="true"><i class="m1" style="flex:' + Math.max(1, Math.round(30 * 0.4)) + '"></i><i class="m2" style="flex:' + Math.max(2, Math.round(((p1 || 100) - 30) * 0.4)) + '"></i><i class="m3" style="flex:' + Math.max(2, Math.round(Math.max(0, (p3 || 300) - (p1 || 100)) * 0.4)) + '"></i></div>'
      + '<div class="small mut" style="margin-top:7px">Jarak dari harga: entry <b>' + dist(s.entry) + '</b> · SL <b>' + dist(s.sl) + '</b> · TP1 <b>' + dist(tp1) + '</b> · TP2 <b>' + dist(s.tp2) + '</b> · TPmax <b>' + dist(tp3) + '</b></div>'
      + (s.why ? '<div class="small" style="margin-top:5px">' + esc(s.why) + '</div>' : '')
      + (s.globalWhy ? '<div class="small mut" style="margin-top:3px"><b>Data global:</b> ' + esc(s.globalWhy) + '</div>' : '')
      + '<details style="margin-top:7px"><summary class="small" style="color:var(--accent)">🧠 Detail Alchemist + alasan level</summary>'
      + '<div class="small mut" style="margin-top:5px"><b>Storyline:</b> ' + esc(s.storyline || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Model:</b> ' + esc(s.model || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Trigger entry:</b> ' + esc(s.trigger || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Invalidasi:</b> ' + esc(s.invalidation || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Manajemen:</b> ' + esc(s.management || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Alasan SL:</b> ' + esc(s.slWhy || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Alasan TPmax:</b> ' + esc(s.tpMaxWhy || s.tpWhy || '—') + '</div>'
      + '<div class="small mut" style="margin-top:3px"><b>Konfluensi:</b> ' + esc(s.confluence || '—') + '</div></details>'
      + '<div class="small" style="margin-top:5px;color:' + (s.valid ? 'var(--ok)' : 'var(--warn)') + '">' + (s.valid ? '✅ Level valid & siap dipakai' : '⚠️ ' + esc(s.need || 'tunggu konfirmasi')) + '</div>'
      + '</div>';
  }).join('') + '</div>';
}

function pSignalEntry() {
  if (!SIG_ST.data) SIG_ST.data = sigCacheGet();
  SIG_ST.auto = true;
  try { localStorage.setItem('rb_sig_auto', '1'); } catch (e) { }
  const d = SIG_ST.data;
  const fresh = d && d.generatedAt && (Date.now() - Date.parse(d.generatedAt) < 15 * 60000);
  const stale = d && d.generatedAt ? '<span class="mut small">Data tersimpan ' + esc(sigTime(d.generatedAt)) + '</span>' : '';
  const styles = [['ALL', 'Semua'], ['SCALPING', 'Scalping'], ['DAY', 'Day'], ['SWING', 'Swing']];
  const filter = styles.map(function (x) {
    const on = rb31StyleNow() === x[0];
    return '<button class="x' + (on ? ' on' : '') + '" type="button" onclick="rb31StyleSet(\'' + x[0] + '\')" aria-pressed="' + on + '">' + x[1] + '</button>';
  }).join('');
  $('pane').innerHTML =
    '<div class="rb-trade-hero">'
    + '<div class="rb-hero-top"><div style="min-width:0;flex:1">'
    + '<div class="rb-eyebrow">Trading · eksekusi XAUUSD</div>'
    + '<h2>🎯 Signal Entry Alchemist</h2>'
    + '<div class="rb-note">Mesin membaca <b>candle live</b> M1 · M5 · M15 · H1 · D1, seluruh teknikal Alchemist (struktur, BOS/MSS, FVG, order block, OTE, sapuan likuiditas, premium/discount, CRT, SMT), DXY, yield 10Y, spot emas (validasi PAXG), berita global terbaru, dan kalender rilis. Hasilnya <b>3–10 setup satu arah</b> berlabel <b>Scalping</b>, <b>Day</b>, atau <b>Swing</b>. Semua setup memakai <b>SL tepat 30 pips</b>; TP1 ≥100 pip, TP2 ≥200 pip, dan <b>TPmax</b> adalah target <b>maksimal</b> dari konfluensi seluruh analisis Alchemist + data terbaru (likuiditas, ATR, measured move). Level tidak boleh diubah AI.</div>'
    + '</div>'
    + '<div class="rb-live-chip"><span class="rb-live-dot"></span><span id="sigTopLive">live: —</span></div></div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">SL tepat 30 pips</span><span class="rb-pill">TPmax = target maksimal</span><span class="rb-pill">Chart TradingView real-time</span><span class="rb-pill">Scalping · Day · Swing</span><span class="rb-pill">3–10 sinyal satu arah</span><span class="rb-pill">Auto 15 menit</span></div>'
    + '<div class="rb-actions">'
    + '<button class="btn" type="button" onclick="sigLoad(false)">📡 Ambil data terbaru</button>'
    + '<button class="btn alt" type="button" onclick="sigRunAI()">🤖 Nilai ulang AI</button>'
    + '<button class="btn alt" type="button" onclick="sigCopy(this)">📋 Salin sinyal</button>'
    + '<button class="btn alt" type="button" onclick="sigNotifAsk()">' + esc(sigNotifLabel()) + '</button></div>'
    + '<div class="small mut" style="margin-top:8px">Auto-refresh <b>15 menit</b> selalu aktif · ' + stale + '</div></div>'
    + '<div id="sigScan" class="rb-ai-scan" hidden></div>'
    + '<div class="card"><div class="rb-card-head"><h3>🎛️ Gaya trading</h3><span class="rb-pill">filter tampilan</span></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + filter + '</div>'
    + '<div class="small mut" style="margin-top:6px">Scalping memakai konfirmasi M5/M1, Day memakai M15/M5, Swing memakai H1/D1. Filter hanya mengubah tampilan — level &amp; arah mesin tetap sama.</div></div>'
    + '<div id="sigPush"></div>'
    + '<div id="sigMsg" class="card" style="padding:10px 14px;display:none"></div>'
    + '<div id="sigBox"></div>'
    + '<div class="card"><div class="rb-tv-head"><h3>📈 TradingView XAUUSD</h3><span class="rb-pill" id="sigTvPill">LIVE · 15m</span></div>'
    + '<div class="rb-note">Chart &amp; <b>Technical Analysis resmi TradingView</b> (tanpa login). Gunakan untuk memverifikasi sapuan, MSS, FVG/OB, dan momentum. Level mesin digambar pada chart analisis di atas.</div>'
    + '<div class="rb-tf-chips" style="margin:8px 0">'
    + '<button class="x" type="button" data-sigmode="chart" onclick="sigTvMode(\'chart\')">Chart</button>'
    + '<button class="x" type="button" data-sigmode="ta" onclick="sigTvMode(\'ta\')">TA gauge</button>'
    + ['1', '5', '15', '60', '240'].map(function (n) { return '<button class="x" type="button" data-sigtv="' + n + '" onclick="sigTvInt(' + n + ')">' + n + 'm</button>'; }).join('')
    + '</div>'
    + '<div id="sigTV"></div>'
    + '<div class="small mut" style="margin-top:6px"><a href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD" target="_blank" rel="noopener" style="color:var(--b)">Buka chart penuh di TradingView ↗</a></div></div>'
    + '<div id="sigHist"></div>';
  sigTv();
  sigAutoStart();
  sigPaint();
  sigTickStart();
  rb31PushLoad();
  rb31PushPaint();
  if (!fresh && !SIG_ST.loading) setTimeout(function () { sigLoad(false); }, 80);
}

function sigAutoStart() {
  if (SIG_ST.timer) clearInterval(SIG_ST.timer);
  SIG_ST.auto = true;
  SIG_ST.nextAt = Date.now() + 15 * 60000;
  try { localStorage.setItem('rb_sig_auto', '1'); } catch (e) { }
  SIG_ST.timer = setInterval(function () {
    if (!document.getElementById('sigBox')) { clearInterval(SIG_ST.timer); SIG_ST.timer = 0; return; }
    SIG_ST.nextAt = Date.now() + 15 * 60000;
    if (!SIG_ST.loading && !SIG_ST.loadingAI) sigLoad(false);
  }, 15 * 60000);
}
/* Hitung mundur siklus 15 menit yang tampil di kartu daftar sinyal. */
function rb31NextPaint() {
  const nx = $('sigNext');
  if (!nx) return;
  if (!SIG_ST.nextAt) { nx.textContent = '—'; return; }
  const s = Math.max(0, Math.round((SIG_ST.nextAt - Date.now()) / 1000));
  nx.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function sigAutoStop() { /* refresh otomatis 15 menit tidak bisa dimatikan (permintaan) */ }
function sigAuto() { if (typeof v21Toast === 'function') v21Toast('Auto-refresh 15 menit selalu aktif'); sigAutoStart(); }
function sigLivePaint() {
  rb31NextPaint();
  const t = SIG_ST.tick;
  if (t && t.price && SIG_ST.data && rb31TrackSync(SIG_ST.data, t.price) && !rb31Painting) { sigPaint(); return; }
  const el = $('sigLive');
  if (!el) return;
  if (!t || !t.price) { el.textContent = 'live: —'; return; }
  const lv = rb31PlanOf(SIG_ST.data);
  let extra = '';
  if (lv) extra = ' · selisih entry ' + Math.round(Math.abs(t.price - lv.entry) / 0.1) + ' pip';
  const tv = t.tv && t.tv.price ? t.tv : null;
  el.innerHTML = '🔴 live <b>' + sigNum(t.price) + '</b> · ' + esc(new Date(t.at).toLocaleTimeString('id-ID')) + extra
    + (tv ? ' · <span class="rb-pill" style="margin-left:4px">📺 TV <b>' + sigNum(tv.price) + '</b> ' + esc(tv.label || '') + '</span>' : '');
  const top = $('sigTopLive');
  if (top) top.innerHTML = (tv ? '📺 <b>' + sigNum(tv.price) + '</b> ' + esc(tv.label || '') + ' · ' : '') + '<b>' + sigNum(t.price) + '</b> · ' + esc(new Date(t.at).toLocaleTimeString('id-ID'));
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
    box.innerHTML = '<div class="card"><div class="warn">Belum ada data sinyal. Tekan <b>Ambil data terbaru</b> untuk membaca chart XAUUSD live, DXY, yield 10Y, spot emas, dan kalender rilis.</div></div>' + rb31ActiveHtml(0, null);
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
  rb31Notify(d);
  const lv = rb31PlanOf(d);
  const dir = d.direction || 'WAIT';
  const col = dir === 'BUY' ? 'var(--ok)' : dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const lbl = dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — konfluensi belum cukup';
  const planCard = '<div class="card" style="border-left:5px solid ' + col + '">'
    + '<div class="rb-card-head"><h3>🗺️ Rencana mesin</h3><span class="rb-pill">' + esc(d.timeframe || 'M15') + ' · M5 · M1</span></div>'
    + '<div style="font-size:1.35rem;font-weight:900;color:' + col + ';letter-spacing:-.02em;margin:2px 0 6px">' + lbl + '</div>'
    + '<div class="small mut" id="sigLive">live: —</div>'
    + '<div class="rb-pill-row" style="margin-top:6px"><span class="rb-pill y">🔒 Arah tunggal: ' + esc(d.biasDirection || d.singleDirection || '—') + '</span><span class="rb-pill">' + (d.directionLock && d.directionLock.strength != null ? 'kekuatan ' + d.directionLock.strength + '%' : 'semua setup searah') + '</span>' + (d.directionLock && d.directionLock.oppositeDropped ? '<span class="rb-pill">' + d.directionLock.oppositeDropped + ' setup berlawanan dibuang</span>' : '') + '</div>'
    + (d.directionLock && d.directionLock.note ? '<div class="small mut" style="margin-top:4px">' + esc(d.directionLock.note) + '</div>' : '')
    + (d.tfBias && window.rb33Tv ? window.rb33Tv.tfChips(d.tfBias) : '')
    + (lv ? '<div class="rb-lv-grid" style="margin-top:8px">'
      + '<div class="rb-lv"><span>' + (lv.entryType === 'LIMIT POI' ? 'Entry limit (POI)' : 'Entry') + '</span><b>' + sigNum(lv.entry) + '</b></div>'
      + '<div class="rb-lv sl"><span>SL · ' + lv.slPips + ' pip</span><b>' + sigNum(lv.sl) + '</b></div>'
      + '<div class="rb-lv tp"><span>TP1 · ' + lv.tp1Pips + ' pip</span><b>' + sigNum(lv.tp1) + '</b></div>'
      + '<div class="rb-lv tp"><span>TP2 · ' + lv.tp2Pips + ' pip</span><b>' + sigNum(lv.tp2) + '</b></div>'
      + '<div class="rb-lv tp"><span>TPmax · ' + lv.tpMaxPips + ' pip</span><b>' + sigNum(lv.tpMax) + '</b></div>'
      + '<div class="rb-lv"><span>RR TP1</span><b>1:' + (lv.rr == null ? '—' : lv.rr) + '</b></div>'
      + '</div><div class="small mut" style="margin-top:6px">' + (d.tpMaxEngine && d.tpMaxEngine.why ? esc(d.tpMaxEngine.why) : 'TPmax = konfluensi struktur, likuiditas, dan ATR global. Setelah TP1 tercapai sinyal berjalan sampai TP2/TPmax/SL.') + '</div>'
      : '<div class="small" style="margin-top:6px">Skor ' + d.score + ' (ambang ±2,0) · keyakinan ' + d.confidence + '%. Mesin menolak memaksa entry saat struktur, sweep, displacement, dan makro belum searah.</div>'
      + ((d.gates || []).length ? '<div class="warn" style="margin-top:8px">Entry ditahan: ' + d.gates.map(esc).join(' · ') + '</div>' : '')
      + (d.poi ? '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>POI terdekat:</b> FVG ' + (d.poi.kind === 'bull' ? 'bullish' : 'bearish') + ' ' + d.poi.lo + '–' + d.poi.hi + '</div>' : ''))
    + '</div>';

  const styleFilter = rb31StyleNow();
  const pool = (d.setups || []).filter(function (s) { return s && (styleFilter === 'ALL' || rb31Style(s) === styleFilter); });


  const ctx = '<div class="card"><div class="rb-card-head"><h3>🌍 Konteks pasar</h3><span class="rb-pill">live spot + candle</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px">'
    + sigKv('Harga', sigNum(d.price), d.candleAt ? sigTime(d.candleAt) : '')
    + sigKv('Struktur M15', esc(d.structure || '—'), d.bos ? d.bos.kind + ' ' + d.bos.dir : 'belum BOS')
    + sigKv('Bias H4', d.h4 ? (d.h4.dir > 0 ? 'naik' : 'turun') : '—', d.h4 ? 'EMA20 ' + sigNum(d.h4.ema20) + ' vs EMA50 ' + sigNum(d.h4.ema50) + ' · ' + esc(d.h4.trend) + ' · posisi ' + (d.h4.pos == null ? '—' : d.h4.pos + '%') : 'H4 tidak terbaca')
    + sigKv('PDH / PDL', d.pdh == null ? '—' : sigNum(d.pdh) + ' / ' + sigNum(d.pdl), d.pdo == null ? 'open harian tidak terbaca' : 'open harian ' + sigNum(d.pdo))
    + sigKv('Liquidity pools', d.pools ? String((d.pools.highs || []).length + (d.pools.lows || []).length) : '0', d.pools ? 'high ' + ((d.pools.highs || []).slice(0, 2).join(', ') || '—') + ' · low ' + ((d.pools.lows || []).slice(0, 2).join(', ') || '—') : 'tidak terdeteksi')
    + sigKv('Intermarket', d.intermarket ? esc(d.intermarket.aligned) : '—', d.intermarket ? 'emas 10D ' + sigNum(d.intermarket.gold10d) + '% · yield ' + sigNum(d.intermarket.yield10d) + 'pp · DXY ' + sigNum(d.intermarket.dxy10d) + '%' : 'tidak terbaca')
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
    + (d.macro && (d.macro.dxy != null || d.macro.us10y != null) ? '<div class="small mut" style="margin-top:8px">Sumber harga: ' + esc(d.priceSource || '—') + ' · DXY ' + (d.macro.dxy == null ? '—' : d.macro.dxy) + ' (10 hari ' + (d.macro.dxyChg10d == null ? '—' : d.macro.dxyChg10d) + '%) · Yield 10Y ' + (d.macro.us10y == null ? '—' : d.macro.us10y) + '% (10 hari ' + (d.macro.us10yChg10d == null ? '—' : d.macro.us10yChg10d) + '%)' + (d.daily ? ' · Tren harian ' + d.daily.trend : '') + '</div>' : '')
    + (d.news && d.news.length ? '<div class="warn" style="margin-top:8px">⚠️ Rilis High impact ≤90 menit: ' + d.news.map(function (n) { return esc(n.title) + ' (' + n.inMin + ' menit)'; }).join(' · ') + '</div>' : '<div class="small mut" style="margin-top:8px">✅ Tidak ada rilis USD High impact dalam 90 menit.</div>')
    + '</div>';

  const globalCard = '<div class="card"><div class="rb-card-head"><h3>🌍 Data global yang dipakai</h3><span class="rb-pill">' + (d.dataValid ? '✅ valid' : '⚠️ terbatas') + '</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px">'
    + sigKv('DXY', d.macro && d.macro.dxy != null ? esc(String(d.macro.dxy)) : '—', d.macro && d.macro.dxyChg10d != null ? '10 hari ' + d.macro.dxyChg10d + '%' : 'tidak terbaca')
    + sigKv('Yield 10Y', d.macro && d.macro.us10y != null ? esc(String(d.macro.us10y)) + '%' : '—', d.macro && d.macro.us10yChg10d != null ? '10 hari ' + d.macro.us10yChg10d + '%' : 'tidak terbaca')
    + sigKv('Tren harian', d.daily ? esc(d.daily.trend || '—') : '—', d.daily ? 'RSI ' + (d.daily.rsi == null ? '—' : d.daily.rsi) : 'data harian tidak ada')
    + sigKv('Rilis ≤90 menit', d.news && d.news.length ? String(d.news.length) : '0', d.news && d.news.length ? '⚠️ hindari entry baru' : '✅ aman')
    + sigKv('Validasi', (d.validation || []).filter(function (v) { return v.ok; }).length + '/' + (d.validation || []).length, 'spot + candle + kalender')
    + '</div><div class="small mut" style="margin-top:8px">Harga ' + sigNum(d.price) + ' · sumber ' + esc(d.priceSource || '—') + ' · ' + ((d.sources || []).map(function (s) { return (s.ok ? '✅ ' : '⚠️ ') + esc(s.name); }).join(' · ')) + '</div></div>';

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

  box.innerHTML = planCard + rb31TvCard(d) + rb31ChartHtml(d) + rb31ListHtml(price, d) + rb31ActiveHtml(price, d) + ctx + globalCard + cek + aiCard + basis + qual;
  rb31ClosedPaint();
  sigLivePaint();
}
function sigCopy(btn) {
  const d = SIG_ST.data, lv = rb31PlanOf(d), act = rb31Active();
  if (!d) return alert('Belum ada sinyal untuk disalin.');
  let txt = 'SIGNAL ENTRY XAUUSD — ' + sigTime(d.generatedAt) + '\n'
    + 'Arah mesin: ' + d.direction + ' · keyakinan ' + d.confidence + '% · skor ' + d.score + ' · ' + d.timeframe + ' · konfirmasi ' + (d.confirms == null ? '—' : d.confirms + '/6') + '\n';
  if (lv) txt += 'Entry ' + lv.entry + ' (' + lv.entryType + ') | SL ' + lv.sl + ' (' + lv.slPips + ' pip) | TP1 ' + lv.tp1 + ' (' + lv.tp1Pips + ' pip) | TP2 ' + lv.tp2 + ' (' + lv.tp2Pips + ' pip) | TPmax ' + lv.tpMax + ' (' + lv.tpMaxPips + ' pip)\n';
  if ((d.setups || []).length) txt += 'SINYAL MESIN (' + d.setups.length + ', satu arah ' + (d.singleDirection || d.biasDirection || d.direction) + '):\n' + d.setups.map(function (s, i) {
    return '• #' + (i + 1) + ' [' + rb31StyleLabel(s.style) + '] ' + s.method + ' ' + s.dir + ' | E ' + s.entry + ' (' + (s.type || 'LIMIT') + ') | SL ' + s.sl + ' (' + s.slPips + ' pip) | TP1 ' + (s.tp1 != null ? s.tp1 : s.tp) + ' (' + s.tpPips + ' pip) | TP2 ' + s.tp2 + ' (' + (s.tp2Pips == null ? '—' : s.tp2Pips) + ' pip) | TPmax ' + (s.tp3 != null ? s.tp3 : s.tpMax) + ' (' + (s.tp3Pips != null ? s.tp3Pips : s.tpMaxPips) + ' pip) | ' + s.status;
  }).join('\n') + '\n';
  else txt += 'Rencana: WAIT' + ((d.gates || []).length ? ' — ' + d.gates.join('; ') : '') + '\n';
  txt += 'Struktur M15: ' + d.structure + (d.m5 ? ' · M5 ' + d.m5.trend : '') + (d.sweep ? ' · sweep ' + d.sweep.kind : '') + '\n'
    + 'Sesi: ' + (d.session ? d.session.ses + (d.session.kill ? ' / ' + d.session.kill : '') : '—') + '\n'
    + 'Checklist: ' + (d.checklist || []).filter(function (c) { return c.ok; }).length + '/' + (d.checklist || []).length + ' OK\n';
  if (act.length) txt += 'SINYAL AKTIF (' + act.length + '):\n' + act.map(function (s) { return '• [' + rb31StyleLabel(s.style) + '] ' + s.method + ' ' + s.dir + ' E' + s.entry + ' SL' + s.sl + ' TP1 ' + s.tp1 + ' TP2 ' + s.tp2 + ' TPmax ' + s.tpMax + ' [' + s.status + ']'; }).join('\n') + '\n';
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
