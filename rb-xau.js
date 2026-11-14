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
  const NEWS_KEY = 'rb_xau_news_v2_';
  let newsFocus = 'NFP', newsData = null, newsBusy = false;
  let sigData = null, sigBusy = false, sigTimer = null, sigRO = null, sigAt = 0;

  function toast(m) { if (typeof v21Toast === 'function') v21Toast(m); }
  function loadCache(k) { try { return JSON.parse(localStorage.getItem(NEWS_KEY + k) || 'null'); } catch (e) { return null; } }
  function saveCache(k, v) { try { localStorage.setItem(NEWS_KEY + k, JSON.stringify(v)); } catch (e) { } }
  function focusNow() { try { const v = localStorage.getItem('rb_xau_focus_v2'); return FOCUS.some(f => f.k === v) ? v : 'NFP'; } catch (e) { return 'NFP'; } }

  /* ---------------- NEWS ---------------- */
  window.pXauNews = function () {
    newsFocus = focusNow();
    newsData = loadCache(newsFocus);
    X$('pane').innerHTML = `
      <div class="card">
        <div class="rb-card-head"><h3>📰 News Analisis XAUUSD</h3><span class="rb-pill">4 rilis inti + rilis bersamaan</span></div>
        <div class="rb-note">Pilih satu rilis. Seluruh AI mencari data rilis itu saja (tanpa bercampur rilis lain), dari TradingView, FRED/BLS, kalender ekonomi, media AS terpercaya, dan YouTube. Arah <b>BUY/SELL</b> dan status <b>spike</b> dihitung dari data — bukan tebakan AI. Rilis lain yang muncul bersamaan tetap ditampilkan sebagai efek gabungan.</div>
        <div class="rb-pill-row" id="xTabRow" style="margin-top:10px">${FOCUS.map(f => `<button class="rb-pill${f.k === newsFocus ? ' y' : ''}" data-k="${f.k}" onclick="pXauFocus('${f.k}')">${f.t} · ${f.s}</button>`).join('')}</div>
        <button class="btn full" id="xNewsBtn" style="margin-top:10px" onclick="pXauRun()">📡 Ambil data & analisis ${newsFocus}</button>
        <div id="xNewsMsg" class="mut small" style="margin-top:8px"></div>
      </div>
      <div id="xNewsOut"></div>`;
    if (newsData) paintNews(newsData, true);
  };
  window.pXauFocus = function (k) {
    newsFocus = FOCUS.some(f => f.k === k) ? k : 'NFP';
    try { localStorage.setItem('rb_xau_focus_v2', newsFocus); } catch (e) { }
    window.pXauNews();
  };
  window.pXauRun = async function () {
    if (newsBusy) return;
    newsBusy = true;
    const btn = X$('xNewsBtn'), msg = X$('xNewsMsg');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Mengumpulkan data & AI…'; }
    if (msg) msg.textContent = 'Mengambil kalender, angka resmi FRED/BLS, TradingView, media AS, YouTube…';
    try {
      const j = await tcall({ action: 'xau', focus: newsFocus, fresh: true });
      newsData = j;
      if (j.ok) saveCache(newsFocus, j);
      paintNews(j, false);
      if (msg) msg.textContent = j.ok ? '✅ Selesai — arah ' + j.direction + ' · spike ' + (j.spike && j.spike.measured ? 'terukur' : j.spike && j.spike.likely ? 'diperkirakan' : 'tidak ada') : '⚠️ ' + (j.error || 'gagal');
    } catch (e) {
      paintNews({ ok: false, error: e.message }, false);
      if (msg) msg.textContent = '⚠️ ' + e.message;
    }
    newsBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = '📡 Ambil data & analisis ' + newsFocus; }
  };

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
      <div class="small mut" style="margin-top:8px">Sumber arah: <b>${XE(j.directionSource || '—')}</b> · skor ${XE(j.score)} · harga ${num(j.price)} (${XE(j.priceSource || '—')})</div>
      ${j.reaction ? `<div class="exp" style="margin-top:8px;color:var(--tx)"><b>📈 Reaksi nyata setelah ${XE(j.reaction.tag)} terbit:</b> <b>${pips(j.reaction.netPips)} pip → ${XE(j.reaction.dir)}</b><div class="small mut">${XE(j.reaction.agoMin)} menit lalu · anchor ${num(j.reaction.anchor)} → ${num(j.reaction.last)} · rentang ${XE(j.reaction.rangePips)} pip (${XE(j.reaction.bar)})</div></div>` : ''}</div>`;
  }

  function eventCard(j) {
    const e = j.event || {};
    const released = e.released;
    return `<div class="card"><div class="rb-card-head"><h3>📌 Rilis fokus: ${XE(e.tag || j.focus)}</h3><span class="rb-pill ${e.verified === 'kalender' ? '' : 'y'}">${e.derived ? 'data terakhir FRED' : e.verified === 'kalender' ? 'jadwal kalender' : 'jadwal resmi'}</span></div>
      <div class="rb-release-title" style="font-weight:700">${XE(e.title || '')}</div>
      <div class="rb-release-meta">
        <div><span>Jadwal (WIB)</span><b>${e.when ? XE(when(e.when)) : XE(e.whenLabel || '—')}</b></div>
        <div><span>Konsensus</span><b>${XE(e.forecast || 'tidak tersedia')}${e.unit ? ' ' + XE(e.unit) : ''}</b></div>
        <div><span>Previous</span><b>${XE(e.previous || '—')}</b></div>
      </div>
      <div class="small" style="margin-top:7px">${e.actualOfficial != null ? `✅ Angka resmi: <b>${XE(e.actualOfficial)}</b> <span class="mut">· ${XE(e.actualSource || 'FRED')} · periode ${XE(e.officialPeriod || '—')}</span>` : released && e.actual ? `Aktual kalender: <b>${XE(e.actual)}</b>${e.period ? ' · periode ' + XE(e.period) : ''}` : '<span class="mut">Belum ada angka aktual resmi untuk rilis ini.</span>'}</div>
      ${j.surprise ? `<div class="small" style="margin-top:4px">Kejutan: aktual <b>${XE(j.surprise.actual)}</b> vs konsensus <b>${XE(j.surprise.forecast)}</b> → <b style="color:${j.surprise.hot ? 'var(--no)' : 'var(--ok)'}">${j.surprise.hot ? 'lebih panas/kuat' : 'lebih dingin/lemah'}</b></div>` : ''}
    </div>`;
  }

  function docCard(j) {
    const d = j.doc;
    if (!d) return `<div class="card"><div class="rb-card-head"><h3>🧠 Ringkasan AI</h3><span class="rb-pill">${j.ai && j.ai.ok ? 'AI siap' : 'AI tidak tersedia'}</span></div><div class="warn">${j.ai && j.ai.ok ? 'AI tidak mengirim dokumen valid.' : 'AI gagal: ' + XE((j.ai && j.ai.error) || 'tidak ada key aktif') + '. Arah & spike tetap dihitung mesin dari data.'}</div></div>`;
    return `<div class="card"><div class="rb-card-head"><h3>🧠 Ringkasan AI</h3><span class="rb-pill">${XE((j.ai && j.ai.provider) || 'AI')}</span></div>
      <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;line-height:1.35;margin-bottom:6px">${XE(d.headline || '')}</div>
      <div class="exp" style="color:var(--tx);line-height:1.6">${XE(d.summary || '')}</div>
      ${d.focus_what ? `<div style="margin-top:8px"><b class="small">Apa yang diukur</b><div class="small" style="line-height:1.55">${XE(d.focus_what)}</div></div>` : ''}
      ${d.why_gold ? `<div style="margin-top:6px"><b class="small">Mengapa penting untuk emas</b><div class="small" style="line-height:1.55">${XE(d.why_gold)}</div></div>` : ''}
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
      ${y.length ? `<div style="margin-top:8px"><b class="small">▶️ YouTube</b>${y.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${x.trusted ? '✅ ' + XE(x.trusted) : '👤 komunitas'} · ${XE(x.channel || '')}${x.ageH != null ? ' · ' + x.ageH + ' jam lalu' : ''}</div></span></div>`).join('')}</div>` : ''}
      ${((j.officialNews && j.officialNews.items) || []).length ? `<div style="margin-top:8px"><b class="small">🏛 Rilis pers resmi (Fed/BLS)</b>${j.officialNews.items.map(x => `<div class="item"><span><a href="${XE(x.url)}" target="_blank" rel="noopener" style="color:var(--b)">${XE(x.title)}</a><div class="small mut">${XE(x.source)}${x.ageH != null ? ' · ' + x.ageH + ' jam lalu' : ''}</div></span></div>`).join('')}</div>` : ''}
      ${(j.concurrent || []).length ? `<div style="margin-top:10px"><b class="small">⏱ Rilis lain di waktu bersamaan</b>${j.concurrent.map(c => `<div class="item"><span>${XE(c.title)}${c.tag ? ' · <b>' + XE(c.tag) + '</b>' : ''}<div class="small mut">${XE(when(c.when))} · ${XE(c.impact)} · konsensus ${XE(c.forecast || '—')}</div></span><span class="small mut">${XE(c.actual || 'belum terbit')}</span></div>`).join('')}</div>` : ''}
    </div>`;
  }

  function dataCard(j) {
    const src = j.sources || [], val = j.official;
    return `<div class="card"><h3>✅ Validitas & sumber</h3>
      <div class="rb-note">Setiap angka punya sumber dan periode. Data resmi (FRED/BLS) dipisahkan dari kalender agregator.</div>
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
    if (!j.ok) { out.innerHTML = `<div class="card"><div class="warn">${XE(j.error || 'Data tidak tersedia')}</div><button class="btn full" style="margin-top:8px" onclick="pXauRun()">Coba lagi</button></div>`; return; }
    out.innerHTML = verdictCard(j) + eventCard(j) + evidenceCard(j) + docCard(j) + marketCard(j) + sourcesCard(j) + dataCard(j) + (cached ? '<div class="small mut" style="margin-top:6px">Data tersimpan di perangkat — tekan ambil data untuk memperbarui.</div>' : '');
  }

  /* ---------------- SIGNAL ---------------- */
  window.pSignalEntry = function () {
    X$('pane').innerHTML = `
      <div class="card">
        <div class="rb-card-head"><h3>⚡ Signal Entry — XAUUSD</h3><span class="rb-pill">Alchemist · TradingView real-time</span></div>
        <div class="rb-note">Teknikal Alchemist lengkap (struktur, BOS/CHoCH, sweep, SND, FVG, order block, mitigation, EQH/EQL, Judas swing, OTE, premium/discount, open harian/mingguan, ADR, SMT, sesi) dari candle live + harga & rekomendasi TradingView. Semua tanda dihitung ulang setiap refresh dan diberi catatan AI. SL tepat 30 pip, TP1 ≥100, TP2 ≥200, TPmax konfluensi.</div>
        <div class="rb-pill-row"><span class="rb-pill y">SL 30 pip</span><span class="rb-pill">TP1 100</span><span class="rb-pill">TP2 200</span><span class="rb-pill">TPmax struktur</span><span class="rb-pill">Auto 5 menit</span></div>
        <button class="btn full" id="sigBtn" style="margin-top:10px" onclick="pSigRun()">🔄 Perbarui tanda sekarang</button>
        <div id="sigMsg" class="mut small" style="margin-top:8px"></div>
      </div>
      <div class="card">
        <div class="rb-card-head"><h3>📺 Chart TradingView — XAUUSD M15</h3><span class="rb-pill" id="tvPrice">real-time</span></div>
        <div id="xTvHost" style="height:420px;border-radius:10px;overflow:hidden;margin-top:8px;background:#0f172a"></div>
        <div class="small mut" style="margin-top:6px">Chart resmi TradingView (iframe, real-time). Tanda Alchemist digambar di chart aplikasi di bawah; posisinya di-anchor ke harga TradingView terbaru.</div>
      </div>
      <div id="sigOut"></div>`;
    if (sigData) paintSignal(sigData);
    xTvMount();
    if (!sigTimer) sigTimer = setInterval(function () { if (document.getElementById('sigOut') && !sigBusy) pSigRun(true); }, 300000);
    if (!window.__sigVis) {
      window.__sigVis = 1;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible' || sigBusy || !X$('sigOut')) return;
        if (!sigData || Date.now() - (sigAt || 0) > 240000) pSigRun(true);
      });
    }
  };
  window.pSigRun = async function (silent) {
    if (sigBusy) return;
    sigBusy = true;
    const btn = X$('sigBtn'), msg = X$('sigMsg');
    if (btn && !silent) { btn.disabled = true; btn.textContent = '⏳ Menghitung…'; }
    if (msg) msg.textContent = 'Membaca candle live, TradingView, struktur Alchemist, lalu AI menandai chart…';
    try {
      const j = await tcall({ action: 'xauSignal', fresh: true });
      sigData = j;
      sigAt = Date.now();
      paintSignal(j);
      if (msg) msg.textContent = j.error ? '⚠️ ' + j.error : '✅ Siap — arah ' + j.direction + ' · ' + (j.setups || []).length + ' setup';
    } catch (e) {
      if (msg) msg.textContent = '⚠️ ' + e.message;
    }
    sigBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = '📡 Ambil analisis terbaru'; }
  };

  function planCard(j) {
    const p = j.plan;
    if (!p) return '';
    const buy = p.dir === 'BUY';
    return `<div class="card" style="border-left:5px solid ${buy ? 'var(--ok)' : 'var(--no)'}">
      <div class="rb-card-head"><h3>🎯 Rencana entry</h3><span class="rb-pill ${p.status === 'SIAP' ? 'y' : ''}">${XE(p.status)} · ${XE(p.style)}</span></div>
      <div class="rb-lv-grid" style="margin-top:8px">
        <div class="rb-lv"><span>Entry</span><b>${num(p.entry)}</b></div>
        <div class="rb-lv"><span>SL · 30 pip</span><b style="color:var(--no)">${num(p.sl)}</b></div>
        <div class="rb-lv"><span>TP1 · 100</span><b style="color:var(--ok)">${num(p.tp1)}</b></div>
        <div class="rb-lv"><span>TP2 · 200</span><b style="color:var(--ok)">${num(p.tp2)}</b></div>
        <div class="rb-lv"><span>TPmax</span><b style="color:var(--ok)">${num(p.tpMax)}</b></div>
        <div class="rb-lv"><span>TPmax pip</span><b>${XE(p.tpMaxPips)}</b></div>
      </div>
      <div class="small mut" style="margin-top:8px">${XE(p.why)} · ${XE(p.type)} · RR 1:2,5 · arah ${XE(p.dir)}</div></div>`;
  }

  function signalVerdict(j) {
    const buy = j.direction === 'BUY';
    return `<div class="card"><div class="rb-card-head"><h3>📊 Arah tunggal</h3><span class="rb-dir ${buy ? 'buy' : 'sell'}">${XE(j.direction)}</span></div>
      <div class="small mut">Kekuatan ${XE(j.directionStrength)}% · harga ${num(j.price)} · ${XE(j.priceSource)} · ${XE(j.markers ? j.markers.length : 0)} tanda chart</div>
      <div class="rb-pill-row" style="margin-top:8px"><span class="rb-pill">ATR ${num(j.atr)}</span><span class="rb-pill">RSI ${num(j.rsi)}</span><span class="rb-pill">${XE(j.session && j.session.name)}</span><span class="rb-pill">${XE(j.daily && j.daily.trend)}</span>${j.adr ? `<span class="rb-pill">ADR ${XE(j.adr.avgPips)} pip</span>` : ''}<span class="rb-pill">Risiko ${XE(j.eventRisk && j.eventRisk.level)}</span></div>
      ${j.eventRisk && j.eventRisk.level !== 'RENDAH' ? `<div class="warn" style="margin-top:8px">⚠️ ${XE(j.eventRisk.note)}</div>` : ''}
      ${j.adr ? `<div class="small mut" style="margin-top:6px">ADR ${XE(j.adr.avgPips)} pip · hari ini ${XE(j.adr.todayPips)} pip · sisa rata-rata ${XE(j.adr.remainingPips)} pip</div>` : ''}
    </div>`;
  }

  function tfCard(j) {
    const t = j.tfMatrix || [];
    if (!t.length) return '';
    return `<div class="card"><div class="rb-card-head"><h3>🧭 Matriks timeframe</h3><span class="rb-pill">TradingView · 6 TF</span></div>
      ${t.map(x => `<div class="item"><span><b>${XE(x.tf)}</b> <span class="small mut">RSI ${num(x.rsi)}</span></span><span style="color:${x.value > 0.05 ? 'var(--ok)' : x.value < -0.05 ? 'var(--no)' : 'var(--mut)'}">${XE(x.rec)} · ${XE(x.strength)}%</span></div>`).join('')}</div>`;
  }

  function chartCard(j) {
    const types = {};
    (j.markers || []).forEach(m => { types[m.type] = (types[m.type] || 0) + 1; });
    return `<div class="card"><div class="rb-card-head"><h3>🏷️ Chart tanda Alchemist</h3><span class="rb-pill" id="sigStamp">${j.generatedAt ? new Date(j.generatedAt).toLocaleTimeString('id-ID') : '—'}</span></div>
      <canvas id="xSigChart" style="width:100%;height:320px;display:block;margin-top:6px"></canvas>
      <div class="rb-pill-row" style="margin-top:8px">${Object.keys(types).map(t => `<span class="rb-pill">${XE(t)} · ${types[t]}</span>`).join('')}</div>
      <div class="small mut" style="margin-top:6px">Tanda dihitung ulang dari candle terbaru setiap refresh, lalu di-anchor ke harga TradingView (${j.chart ? XE(j.chart.anchor) : '—'}). TradingView tidak menyediakan API untuk menulis gambar ke akun pengguna, jadi tanda tampil di chart aplikasi ini.</div></div>`;
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
        <div class="small mut">${XE(s.why)}</div></div>`).join('') || '<div class="warn">Belum ada setup.</div>'}</div>`;
  }

  function aiCard(j) {
    const a = j.ai || {};
    return `<div class="card"><div class="rb-card-head"><h3>🧠 Anotasi AI</h3><span class="rb-pill">${a.ok ? XE(a.model || a.provider || 'AI') : 'AI tidak tersedia'}</span></div>
      ${a.ok ? `<div class="exp" style="color:var(--tx);line-height:1.55">${XE(a.summary)}</div>
        ${a.bias ? `<div class="small" style="margin-top:6px">Bias AI: <b style="color:${a.bias === j.direction ? 'var(--ok)' : 'var(--warn)'}">${XE(a.bias)}</b>${a.bias !== j.direction ? ' · berbeda dari mesin (level tetap mesin)' : ' · searah mesin'}</div>` : ''}
        ${a.note ? `<div class="small" style="color:var(--warn);margin-top:4px">${XE(a.note)}</div>` : ''}
        ${(a.confluence || []).length ? `<div style="margin-top:6px">${a.confluence.map(c => `<div class="small">• ${XE(c)}</div>`).join('')}</div>` : ''}
        ${a.invalidation ? `<div class="small mut" style="margin-top:6px">Batal jika: ${XE(a.invalidation)}</div>` : ''}`
        : `<div class="warn">AI gagal: ${XE(a.error || 'tidak ada key aktif')}. Tanda chart tetap dihitung mesin dan tidak dikarang.</div>`}
      ${(j.validation || []).length ? `<div style="margin-top:8px">${j.validation.map(v => `<div class="item"><span>${v.ok ? '✅' : '⚠️'} ${XE(v.k)}</span><span class="small mut">${XE(v.d)}</span></div>`).join('')}</div>` : ''}
    </div>`;
  }

  function paintSignal(j) {
    const out = X$('sigOut');
    if (!out) return;
    if (!j || j.error) { out.innerHTML = `<div class="card"><div class="warn">${XE((j && j.error) || 'Tidak ada data')}</div></div>`; return; }
    const chip = X$('tvPrice');
    if (chip) chip.textContent = 'harga ' + num(j.price) + ' · ' + new Date(j.generatedAt || Date.now()).toLocaleTimeString('id-ID');
    out.innerHTML = signalVerdict(j) + planCard(j) + tfCard(j) + chartCard(j) + setupsCard(j) + marksCard(j) + aiCard(j);
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
    host.innerHTML = '<div id="tvNote" class="small mut" style="padding:10px">Memuat chart TradingView…</div>';
    const box = document.createElement('div');
    box.className = 'tradingview-widget-container'; box.style.height = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget'; inner.style.height = '100%';
    box.appendChild(inner);
    const sc = document.createElement('script');
    sc.type = 'text/javascript'; sc.async = true;
    sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    sc.innerHTML = JSON.stringify({
      autosize: true, symbol: 'OANDA:XAUUSD', interval: '15', timezone: 'Asia/Jakarta',
      theme: 'dark', style: '1', locale: 'id', hide_side_toolbar: false,
      allow_symbol_change: true, details: true, studies: [], support_host: 'https://www.tradingview.com'
    });
    sc.onerror = function () {
      host.innerHTML = '<div class="warn">Chart TradingView tidak bisa dimuat (jaringan diblokir). Chart tanda di bawah tetap memakai harga TradingView live.</div>';
    };
    box.appendChild(sc);
    host.appendChild(box);
    let tries = 0;
    const watch = setInterval(function () {
      if (!document.getElementById('xTvHost')) { clearInterval(watch); return; }
      if (host.querySelector('iframe')) {
        const note = document.getElementById('tvNote');
        if (note) note.remove();
        clearInterval(watch); return;
      }
      tries += 1;
      if (tries >= 20) {
        clearInterval(watch);
        const note = document.getElementById('tvNote');
        if (note) note.textContent = 'Chart TradingView tidak termuat di jaringan ini (iframe diblokir). Chart tanda di bawah tetap memakai harga TradingView live.';
      }
    }, 800);
  };

  function drawChart(j) {
    const cv = X$('xSigChart');
    if (!cv || !j.chart) return;
    const rows = (j.chart.rows || []).slice(-90);
    if (rows.length < 5) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 720, H = 320;
    if (W < 80) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padR = 62, padL = 8, padT = 14, padB = 18;
    const hi = Math.max(...rows.map(r => r.h)), lo = Math.min(...rows.map(r => r.l));
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
    const mark = (p, color, label, dash) => {
      if (p == null || !isFinite(p)) return;
      g.save();
      g.strokeStyle = color; g.lineWidth = 1; g.setLineDash(dash ? [4, 4] : []);
      g.beginPath(); g.moveTo(padL, y(p)); g.lineTo(W - padR, y(p)); g.stroke();
      g.setLineDash([]);
      g.fillStyle = color; g.font = '600 10px Manrope, sans-serif'; g.textAlign = 'left';
      g.fillText(label, W - padR + 4, Math.max(10, y(p) + 3));
      g.restore();
    };
    const colors = { BOS: '#f59e0b', CHoCH: '#a78bfa', SWEEP: '#38bdf8', FVG: '#34d399', OB: '#fb7185', SNR: '#94a3b8', SND: '#38bdf8', MB: '#c084fc', OTE: '#facc15', PDH: '#f472b6', PDL: '#f472b6', LIQ: '#22d3ee', EQH: '#f97316', EQL: '#f97316', JUDAS: '#e879f9', ASIA: '#64748b', DO: '#e2e8f0', WO: '#e2e8f0' };
    const zoneColor = { FVG: 'rgba(52,211,153,.16)', OB: 'rgba(251,113,133,.16)', SND: 'rgba(56,189,248,.14)', MB: 'rgba(192,132,252,.14)' };
    (j.markers || []).forEach(m => {
      if (!Array.isArray(m.zone)) return;
      const a = y(m.zone[1]), b = y(m.zone[0]);
      g.fillStyle = zoneColor[m.type] || 'rgba(148,163,184,.10)';
      g.fillRect(padL, Math.min(a, b), W - padL - padR, Math.max(1, Math.abs(b - a)));
    });
    (j.markers || []).forEach(m => {
      if (m.price == null) return;
      mark(m.price, colors[m.type] || '#94a3b8', m.type + ' ' + Number(m.price).toFixed(1) + (m.ai ? ' 🧠' : ''), m.type === 'FVG' || m.type === 'OB');
    });
    if (j.plan) {
      mark(j.plan.entry, '#e2e8f0', 'Entry ' + Number(j.plan.entry).toFixed(2), false);
      mark(j.plan.sl, '#ef4444', 'SL ' + Number(j.plan.sl).toFixed(2), false);
      mark(j.plan.tp1, '#22c55e', 'TP1 ' + Number(j.plan.tp1).toFixed(2), true);
      mark(j.plan.tp2, '#22c55e', 'TP2 ' + Number(j.plan.tp2).toFixed(2), true);
    }
  }

  /* pastikan tab signal bisa dibuka walau nama fungsi berbeda */
  window.xauFocusGet = function () { return newsFocus; };
})();
