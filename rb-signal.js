/* ==========================================================================
   RUANG BELAJAR V30 — Trading → ⚡ Signal Entry (XAUUSD)
   - Mesin Alchemist deterministik di server: M15 struktur, M5 konfirmasi,
     M1 tick, H1/D1 bias, DXY, yield 10Y, spot emas live, kalender rilis.
   - SL 30 pip, TP 1:2, entry MARKET / LIMIT POI, checklist + gerbang disiplin.
   - AI hanya menilai kualitas setup; level tidak boleh diubah AI.
   - Chart TradingView gratis (widget resmi, tanpa login).
   Tidak mengubah mesin latihan/peringkat.
   ========================================================================== */

const SIG_ST = {
  data: null, ai: null, aiNotes: [], meta: null, tick: null, loading: false, loadingAI: false,
  auto: false, timer: 0, tickTimer: 0, pip: 0.1, slMode: 'fixed', bal: '1000', risk: '1', err: '', msg: '',
  tvInt: (function () { try { var v = localStorage.getItem('rb_sig_tv'); return ['1', '5', '15'].indexOf(v) >= 0 ? v : '5'; } catch (e) { return '5'; } })()
};
const SIG_CACHE = 'rb_sig_last_v2', SIG_HIST = 'rb_sig_hist_v2';

function sigNum(v, d) {
  const n = Number(v);
  return isFinite(n) ? n.toFixed(d == null ? 2 : d) : '—';
}
function sigTime(iso) {
  try { return new Date(iso).toLocaleString('id-ID'); } catch (e) { return '—'; }
}
function sigHist() {
  try {
    const a = JSON.parse(localStorage.getItem(SIG_HIST) || '[]');
    return Array.isArray(a) ? a.filter(x => x && x.at).slice(0, 12) : [];
  } catch (e) { return []; }
}
function sigHistSave() {
  const d = SIG_ST.data;
  if (!d || !d.generatedAt) return;
  const row = {
    at: d.generatedAt, dir: d.direction, price: d.price, conf: d.confidence,
    sl: d.plan ? d.plan.sl : null, tp: d.plan ? d.plan.tp : null, tf: d.timeframe,
    entryType: d.entryType || (d.plan ? d.plan.entryType : null)
  };
  const h = sigHist().filter(x => x.at !== row.at);
  h.unshift(row);
  try { localStorage.setItem(SIG_HIST, JSON.stringify(h.slice(0, 12))); } catch (e) { }
}
function sigCacheSave(d) {
  try { localStorage.setItem(SIG_CACHE, JSON.stringify(d)); } catch (e) { }
}
function sigCacheGet() {
  try {
    const d = JSON.parse(localStorage.getItem(SIG_CACHE) || 'null');
    return d && d.generatedAt && d.price ? d : null;
  } catch (e) { return null; }
}
function sigPip() { return SIG_ST.pip > 0 ? SIG_ST.pip : 0.1; }
function sigLevels() {
  const d = SIG_ST.data;
  if (!d || !d.price || !d.direction || d.direction === 'WAIT') return null;
  const pip = sigPip(), s = d.direction === 'BUY' ? 1 : -1;
  const atr = Number(d.atr) > 0 ? Number(d.atr) : 0;
  const base = 30 * pip;
  const slDist = SIG_ST.slMode === 'atr' ? Math.max(base, +(atr * 1.15).toFixed(2)) : base;
  const tpDist = slDist * (d.rr || 2);
  const entry = Number(d.plan && d.plan.entry) || d.price;
  return {
    dir: d.direction, pip, entry, mode: SIG_ST.slMode,
    entryType: (d.plan && d.plan.entryType) || d.entryType || 'MARKET',
    sl: +(entry - s * slDist).toFixed(2), tp: +(entry + s * tpDist).toFixed(2),
    slDist: +slDist.toFixed(2), tpDist: +tpDist.toFixed(2),
    slPips: Math.round(slDist / pip), tpPips: Math.round(tpDist / pip), riskPerLot: +(100 * slDist).toFixed(2)
  };
}

/* ---------- halaman ---------- */
function pSignalEntry() {
  if (!SIG_ST.data) SIG_ST.data = sigCacheGet();
  const fresh = SIG_ST.data && SIG_ST.data.generatedAt && (Date.now() - Date.parse(SIG_ST.data.generatedAt) < 150000);
  const stale = SIG_ST.data && SIG_ST.data.generatedAt ? '<span class="mut small">Data tersimpan ' + esc(sigTime(SIG_ST.data.generatedAt)) + '</span>' : '';
  $('pane').innerHTML =
    '<div class="card rb-hero-alch"><div class="rb-hero-main"><div class="rb-hero-copy">'
    + '<div class="rb-eyebrow">Trading · sinyal eksekusi</div><h2>⚡ Signal Entry XAUUSD</h2>'
    + '<div class="rb-note">Mesin Alchemist membaca <b>M15 (struktur) + M5 (konfirmasi) + M1 (tick)</b>, bias H1/D1, lalu dikonfirmasi DXY, yield 10Y, <b>spot emas live + validasi silang PAXG</b>, dan kalender rilis global. Aturan tetap: <b>risiko 30 pip</b>, <b>TP 1:2</b>. Entry dipilih MARKET atau LIMIT di POI; entry ditahan bila data usang atau quote global tidak konsisten. AI hanya menilai kualitas setup — level tidak boleh diubah AI.</div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">SL 30 pip</span><span class="rb-pill">TP 1:2</span><span class="rb-pill">M15 · M5 · M1</span><span class="rb-pill">XAUUSD saja</span></div>'
    + '</div><div class="ring" style="--p:100"><div class="ring-in"><b>AU</b><span>XAUUSD</span></div></div></div>'
    + '<div class="rb-actions"><button class="btn" type="button" onclick="sigLoad(false)">🔄 Ambil data terbaru</button>'
    + '<button class="btn alt" type="button" onclick="sigRunAI()">🤖 Nilai ulang AI</button>'
    + '<button class="btn alt" type="button" id="sigAutoBtn" onclick="sigAuto()">⏱ Auto 60 dtk: mati</button>'
    + '<button class="btn alt" type="button" onclick="sigCopy(this)">📋 Salin sinyal</button></div>'
    + '<div class="small mut" style="margin-top:8px">' + stale + '</div></div>'
    + '<div id="sigMsg" class="card" style="padding:10px 14px;display:none"></div>'
    + '<div id="sigBox"></div>'
    + '<div class="card"><div class="rb-card-head"><h3>📈 Chart XAUUSD — real-time</h3><span class="rb-pill" id="sigTvPill">LIVE · M5</span></div>'
    + '<div class="rb-note" style="margin-bottom:8px">Chart TradingView resmi (tanpa login, bukan akun TradingView-mu). Pilih timeframe sesuai gaya entry; chart tetap sinkron dengan mesin: <b>M15 struktur, M5 konfirmasi, M1 tick</b>.</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'
    + '<button class="x sig-tv-int" data-sigtv="1" type="button" onclick="sigTvInt(1)">1m</button>'
    + '<button class="x sig-tv-int" data-sigtv="5" type="button" onclick="sigTvInt(5)">5m</button>'
    + '<button class="x sig-tv-int" data-sigtv="15" type="button" onclick="sigTvInt(15)">15m</button>'
    + '<button class="x" type="button" onclick="sigTv()">🔄 Muat ulang chart</button>'
    + '</div>'
    + '<div style="border-radius:14px;overflow:hidden;height:clamp(300px,54vh,460px);border:1px solid var(--line)" id="sigTV"></div>'
    + '<div class="small mut" style="margin-top:6px"><a href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD" target="_blank" rel="noopener" style="color:var(--b)">Buka chart penuh di TradingView ↗</a></div></div>'
    + '<div id="sigHist"></div>'
    + '<div class="card"><h3>⚖️ Batas</h3><div class="rb-note">Sinyal ini edukasi berbasis data publik, bukan saran finansial. Pasar bisa gap saat berita, spread melebar, dan stop 30 pip bisa tersentuh noise. Uji di demo, catat di Jurnal, maksimal 1% risiko per trade.</div></div>';
  sigTv();
  sigPaint();
  sigTickStart();
  if (!fresh && !SIG_ST.loading) setTimeout(function () { sigLoad(true); }, 60);
}
function sigTv() {
  const el = $('sigTV');
  if (!el) return;
  const intv = ['1', '5', '15'].indexOf(String(SIG_ST.tvInt)) >= 0 ? String(SIG_ST.tvInt) : '5';
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const u = 'https://s.tradingview.com/widgetembed/?symbol=OANDA%3AXAUUSD&interval=' + intv + '&hidesidetoolbar=0&symboledit=1&saveimage=0'
    + '&toolbarbg=' + (theme === 'light' ? 'ffffff' : '0d1117') + '&studies=%5B%5D&theme=' + theme
    + '&style=1&timezone=Asia%2FJakarta&locale=id&withdateranges=1&hide_side_toolbar=0&allow_symbol_change=1&details=1';
  el.innerHTML = '<iframe src="' + u + '" style="width:100%;height:100%;border:0" frameborder="0" allowtransparency="true" loading="lazy" title="Chart XAUUSD TradingView"></iframe>';
  const pill = $('sigTvPill');
  if (pill) pill.textContent = 'LIVE · ' + (intv === '1' ? 'M1' : intv === '15' ? 'M15' : 'M5');
  const bs = document.querySelectorAll('[data-sigtv]');
  for (let i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-sigtv') === intv);
}
function sigTvInt(n) {
  SIG_ST.tvInt = String(n) === '1' || String(n) === '15' ? String(n) : '5';
  try { localStorage.setItem('rb_sig_tv', SIG_ST.tvInt); } catch (e) { }
  sigTv();
}
function sigMsgBox() {
  const el = $('sigMsg');
  if (!el) return;
  const on = !!(SIG_ST.msg || SIG_ST.err);
  el.style.display = on ? '' : 'none';
  el.innerHTML = SIG_ST.err
    ? '<div class="warn" style="margin:0">⚠️ ' + esc(SIG_ST.err) + '</div>'
    : '<div class="small mut">' + (SIG_ST.loading || SIG_ST.loadingAI ? '⏳ ' : '') + esc(SIG_ST.msg) + '</div>';
}
function sigKv(label, value, sub) {
  return '<div class="exp" style="color:var(--tx)"><div class="small mut">' + esc(label) + '</div><div style="font-weight:800">' + value + '</div>' + (sub ? '<div class="small mut">' + esc(sub) + '</div>' : '') + '</div>';
}
function sigPaint() {
  const box = $('sigBox');
  sigMsgBox();
  if (!box) return;
  const d = SIG_ST.data;
  if (!d) {
    box.innerHTML = '<div class="card"><div class="warn">Belum ada data sinyal. Tekan <b>Ambil data terbaru</b> untuk membaca candle XAUUSD (M15/M5/M1), DXY, yield 10Y, spot emas, dan kalender rilis.</div></div>';
    sigHistPaint();
    return;
  }
  if (d.error) {
    box.innerHTML = '<div class="card"><div class="warn">' + esc(d.error) + '</div><button class="btn alt full" type="button" onclick="sigLoad(false)">Coba lagi</button></div>';
    sigHistPaint();
    return;
  }
  const lv = sigLevels(), dir = d.direction || 'WAIT';
  const col = dir === 'BUY' ? 'var(--ok)' : dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const lbl = dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — konfluensi belum cukup';
  const planCard = lv
    ? '<div class="card" style="border-left:5px solid ' + col + '">'
      + '<div class="mut small">Rencana entry mesin Alchemist · ' + esc(d.timeframe || 'M15') + ' · <b>' + esc(lv.entryType || 'MARKET') + '</b> · ' + (d.dataValid ? '<span style="color:var(--ok)">✅ data valid</span>' : '<span style="color:var(--warn)">⚠️ data terbatas</span>') + '</div>'
      + '<div style="font-size:1.5rem;font-weight:900;color:' + col + ';letter-spacing:-.02em;margin:2px 0 6px">' + lbl + '</div>'
      + '<div class="small mut" id="sigLive">live: —</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:8px">'
      + sigKv(lv.entryType === 'LIMIT POI' ? 'Entry limit (POI)' : 'Entry (market)', sigNum(lv.entry))
      + sigKv('Stop loss · ' + lv.slPips + ' pip', '<span style="color:var(--no)">' + sigNum(lv.sl) + '</span>', (lv.dir === 'BUY' ? '−' : '+') + lv.slDist + ' harga')
      + sigKv('Take profit · 1:' + (d.rr || 2), '<span style="color:var(--ok)">' + sigNum(lv.tp) + '</span>', lv.tpPips + ' pip')
      + sigKv('Risiko / 1.00 lot', '$' + sigNum(lv.riskPerLot), '1 pip = ' + lv.pip + ' harga')
      + '</div>'
      + '<div class="small mut" style="margin-top:8px">Keyakinan mesin <b>' + d.confidence + '%</b> · skor ' + d.score + ' · konfirmasi Alchemist <b>' + (d.confirms == null ? '—' : d.confirms + '/6') + '</b> · pakai kalkulator di bawah untuk lot sesuai saldo.</div>'
      + '<div class="small mut" style="margin-top:6px">Mode SL: <button class="x" type="button" onclick="SIG_ST.slMode=\'fixed\';sigPaint()" style="' + (lv.mode === 'fixed' ? 'border-color:var(--accent);color:var(--accent)' : '') + '">30 pip (permintaan)</button> <button class="x" type="button" onclick="SIG_ST.slMode=\'atr\';sigPaint()" style="' + (lv.mode === 'atr' ? 'border-color:var(--accent);color:var(--accent)' : '') + '">ATR-safe (disarankan)</button></div>'
      + (lv.mode === 'fixed' && d.plan && d.plan.tight ? '<div class="warn" style="margin-top:8px">SL 30 pip lebih rapat dari 1×ATR (' + sigNum(d.atr) + '). Risiko tersentuh noise tinggi; kurangi lot atau pilih mode ATR-safe.</div>' : '')
      + '</div>'
    : '<div class="card" style="border-left:5px solid ' + col + '"><div class="mut small">Rencana entry mesin Alchemist · ' + (d.dataValid ? '<span style="color:var(--ok)">✅ data valid</span>' : '<span style="color:var(--warn)">⚠️ data terbatas</span>') + '</div><div style="font-size:1.35rem;font-weight:900;color:' + col + ';margin:2px 0 6px">' + lbl + '</div><div class="small mut" id="sigLive">live: —</div>'
      + '<div class="small" style="margin-top:6px">Skor ' + d.score + ' (ambang ±2,0) · keyakinan ' + d.confidence + '%. Mesin menolak memaksa entry saat struktur, sweep, displacement, dan makro belum searah. Tunggu checklist terpenuhi.</div>'
      + ((d.gates || []).length ? '<div class="warn" style="margin-top:8px">Entry ditahan: ' + d.gates.map(esc).join(' · ') + '</div>' : '')
      + (d.watch ? '<div class="small mut" style="margin-top:6px">Zona tunggu — BUY ' + d.watch.zoneBuy[0] + '–' + d.watch.zoneBuy[1] + ' · SELL ' + d.watch.zoneSell[0] + '–' + d.watch.zoneSell[1] + '</div>' : '')
      + (d.poi ? '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>POI terdekat:</b> FVG ' + (d.poi.kind === 'bull' ? 'bullish' : 'bearish') + ' ' + d.poi.lo + '–' + d.poi.hi + ' (mid ' + d.poi.mid + ')</div>' : '')
      + '</div>';

  const ctx = '<div class="card"><div class="rb-card-head"><h3>🧭 Konteks pasar yang dibaca mesin</h3><span class="rb-pill">' + esc(d.timeframe || 'M15') + ' · M5 · M1</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:8px">'
    + sigKv('Harga', sigNum(d.price), d.candleAt ? sigTime(d.candleAt) : '')
    + sigKv('Struktur M15', esc(d.structure), d.bos ? d.bos.kind + ' ' + d.bos.dir : 'belum BOS')
    + sigKv('Struktur M5', d.m5 ? esc(d.m5.trend) : '—', d.m5 && d.m5.sweep ? 'sweep ' + d.m5.sweep.kind : 'konfirmasi entry')
    + sigKv('ATR14', sigNum(d.atr), d.atrPips == null ? '' : d.atrPips + ' pip')
    + sigKv('RSI14', d.rsi == null ? '—' : d.rsi)
    + sigKv('Posisi range', d.position == null ? '—' : d.position + '%', d.position == null ? '' : (d.position < 50 ? 'discount' : 'premium'))
    + sigKv('Sesi', d.session ? esc(d.session.ses) : '—', d.session && d.session.kill ? d.session.kill : 'di luar killzone')
    + sigKv('Sapuan likuiditas', d.sweep ? (d.sweep.kind === 'bull' ? 'bawah' : 'atas') : '—', d.sweep ? '@' + d.sweep.level : 'tidak terdeteksi')
    + sigKv('Displacement', d.displacement ? (d.displacement.kind === 'bull' ? 'naik' : 'turun') : '—', d.displacement ? 'body ' + d.displacement.body : 'tidak ada impuls')
    + sigKv('Order block', d.ob ? (d.ob.kind === 'bull' ? 'bullish' : 'bearish') : '—', d.ob ? d.ob.lo + '–' + d.ob.hi : 'tidak ada')
    + sigKv('SMT / DXY', d.smt ? d.smt.kind : '—', d.smt ? 'divergensi' : 'tidak terdeteksi')
    + sigKv('Range Asia', d.asia ? d.asia.lo + '–' + d.asia.hi : '—', d.asia && d.asia.judas ? 'judas ' + d.asia.judas : 'belum disapu')
    + sigKv('OCL harian', d.ocl ? sigNum(d.ocl.close) : '—', d.ocl ? 'open ' + sigNum(d.ocl.open) : 'tidak terbaca')
    + sigKv('Validasi silang', d.cross ? (d.cross.ok ? 'cocok' : 'selisih') : '—', d.cross ? d.cross.src + ' ' + sigNum(d.cross.price) + ' (' + d.cross.diffPct + '%)' : 'PAXG tidak terbaca')
    + '</div>'
    + (d.macro ? '<div class="small mut" style="margin-top:8px">Sumber harga: ' + esc(d.priceSource || '—') + ' · DXY ' + d.macro.dxy + ' (10 hari ' + (d.macro.dxyChg10d > 0 ? '+' : '') + d.macro.dxyChg10d + '%) · Yield 10Y ' + d.macro.us10y + '% (10 hari ' + (d.macro.us10yChg10d > 0 ? '+' : '') + d.macro.us10yChg10d + '%)' + (d.daily ? ' · Tren harian ' + d.daily.trend + ' (per ' + d.daily.asOf + ')' : '') + '</div>' : '')
    + (d.news && d.news.length ? '<div class="warn" style="margin-top:8px">⚠️ Rilis High impact ≤90 menit: ' + d.news.map(n => esc(n.title) + ' (' + n.inMin + ' menit)').join(' · ') + '</div>' : '<div class="small mut" style="margin-top:8px">✅ Tidak ada rilis USD High impact dalam 90 menit.</div>')
    + '</div>';

  const calc = '<div class="card"><h3>🧮 Ukuran lot (risiko ' + (lv ? lv.slPips : 30) + ' pip)</h3>'
    + '<div class="row" style="margin-top:6px"><div><label style="margin-top:0">Saldo (USD)</label><input id="sigBal" inputmode="decimal" value="' + esc(SIG_ST.bal) + '" oninput="SIG_ST.bal=this.value;sigCalc()"></div>'
    + '<div><label style="margin-top:0">Risiko per trade (%)</label><input id="sigRisk" inputmode="decimal" value="' + esc(SIG_ST.risk) + '" oninput="SIG_ST.risk=this.value;sigCalc()"></div>'
    + '<div><label style="margin-top:0">Pip XAUUSD</label><select id="sigPip" onchange="SIG_ST.pip=parseFloat(this.value)||0.1;sigPaint()">'
    + '<option value="0.1"' + (SIG_ST.pip === 0.1 ? ' selected' : '') + '>0,1 (standar)</option>'
    + '<option value="0.01"' + (SIG_ST.pip === 0.01 ? ' selected' : '') + '>0,01 (3 digit)</option>'
    + '<option value="1"' + (SIG_ST.pip === 1 ? ' selected' : '') + '>1 (1 dolar)</option>'
    + '</select></div></div>'
    + '<div class="rb-calc-out" id="sigCalcOut" style="margin-top:10px"></div>'
    + '<div class="small mut" style="margin-top:8px">Rumus: lot = risiko USD ÷ (jarak SL × nilai per pip per lot). Emas 1.00 lot = 100 oz → $10 per pip 0,1. Catatan: nilai pip bisa beda per broker — cocokkan sebelum eksekusi.</div></div>';

  const cek = '<div class="card"><div class="rb-card-head"><h3>✅ Checklist Alchemist lengkap</h3><span class="rb-pill">' + (d.checklist || []).filter(c => c.ok).length + '/' + (d.checklist || []).length + ' OK</span></div>'
    + '<div>' + (d.checklist || []).map(c => '<div class="item"><span>' + (c.ok ? '✅' : '⬜') + ' ' + esc(c.s) + '</span><span class="mut small" style="text-align:right">' + esc(c.n || '') + '</span></div>').join('') + '</div>'
    + '<div class="small mut" style="margin-top:6px">Entry hanya sah bila arah mesin bukan WAIT, minimal 2 konfirmasi Alchemist, dan tidak ada syarat inti yang gagal. Syarat gagal = alasan melewati setup.</div></div>';

  const ai = SIG_ST.ai;
  const aiCard = '<div class="card"><div class="rb-card-head"><h3>🤖 Penilaian AI</h3>'
    + (SIG_ST.loadingAI ? '<span class="rb-pill">menganalisis…</span>' : ai ? '<span class="rb-pill" style="color:' + (ai.verdict === 'CONFIRM' ? 'var(--ok)' : ai.verdict === 'REJECT' ? 'var(--no)' : 'var(--warn)') + '">' + esc(ai.verdict) + '</span>' : '<span class="rb-pill">belum ada</span>')
    + '</div>'
    + (ai
      ? '<div class="exp" style="color:var(--tx);line-height:1.6">' + fmtMd(ai.summary || '') + '</div>'
        + (ai.alchemist && ai.alchemist.length ? '<div style="margin-top:8px">' + ai.alchemist.map(x => '<div class="small" style="margin:3px 0">' + (x.ok ? '✅' : '⚠️') + ' <b>' + esc(x.step) + '</b> — ' + esc(x.note) + '</div>').join('') + '</div>' : '')
        + ((ai.reasons || []).length ? '<div style="margin-top:8px"><b class="small">Alasan</b>' + ai.reasons.map(x => '<div class="small" style="margin:2px 0">• ' + esc(x) + '</div>').join('') + '</div>' : '')
        + ((ai.warnings || []).length ? '<div class="warn" style="margin-top:8px">' + ai.warnings.map(x => '⚠️ ' + esc(x)).join('<br>') + '</div>' : '')
        + ((ai.management || []).length ? '<div style="margin-top:8px"><b class="small">Manajemen</b>' + ai.management.map(x => '<div class="small" style="margin:2px 0">• ' + esc(x) + '</div>').join('') + '</div>' : '')
        + (ai.invalidation ? '<div class="exp" style="margin-top:8px;color:var(--tx)"><b>Sinyal batal bila:</b> ' + esc(ai.invalidation) + '</div>' : '')
        + '<div class="small mut" style="margin-top:6px">Dinilai oleh ' + esc((SIG_ST.meta && SIG_ST.meta.provider) || 'AI') + (SIG_ST.meta && SIG_ST.meta.model ? ' · ' + esc(String(SIG_ST.meta.model).slice(0, 32)) : '') + '. AI tidak mengubah level entry/SL/TP.</div>'
      : '<div class="mut small">' + (SIG_ST.loadingAI ? 'AI sedang menilai checklist, struktur, dan risiko rilis…' : 'Tekan “Nilai ulang AI” untuk penilaian kualitas setup. Sinyal dan level tetap bisa dipakai tanpa AI.') + (SIG_ST.aiNotes && SIG_ST.aiNotes.length ? ' Catatan: ' + esc(SIG_ST.aiNotes.join(' | ')) : '') + '</div>')
    + '</div>';

  const basis = (d.basis || []).length ? '<div class="card"><h3>📊 Dasar skor (transparan)</h3>' + d.basis.map(b => '<div class="item"><span>' + (b.w > 0 ? '🟢 +' : '🔴 ') + b.w + ' · ' + esc(b.why) + '</span></div>').join('') + '<div class="small mut">Skor = jumlah bobot. ≥ +2,0 → BUY; ≤ −2,0 → SELL; selain itu WAIT. Tidak ada angka yang dikarang.</div></div>' : '';

  const qual = '<div class="card"><h3>🧪 Kualitas data</h3>' + (d.quality || []).map(q => '<div class="item"><span>' + (q.ok ? '✅' : '⚠️') + ' ' + esc(q.k) + '</span><span class="mut small">' + esc(q.d || 'tidak tersedia') + '</span></div>').join('')
    + ((d.validation || []).length ? '<div class="small mut" style="margin-top:8px">Validasi: ' + d.validation.map(v => (v.ok ? '✅ ' : '⚠️ ') + esc(v.k) + ' — ' + esc(v.d) + '').join(' · ') + '</div>' : '')
    + (d.notes && d.notes.length ? '<div class="warn" style="margin-top:8px">' + d.notes.map(x => esc(x)).join('<br>') + '</div>' : '')
    + '<div class="small mut" style="margin-top:8px">Sumber: ' + (d.sources || []).map(s => (s.ok ? '✅ ' : '⚠️ ') + esc(s.name)).join(' · ') + '</div></div>';

  box.innerHTML = planCard + ctx + calc + cek + aiCard + basis + qual;
  sigHistPaint();
  sigCalc();
  sigLivePaint();
}
function sigHistPaint() {
  const el = $('sigHist');
  if (!el) return;
  const h = sigHist();
  el.innerHTML = '<div class="card"><div class="rb-card-head"><h3>🗂 Riwayat sinyal</h3><button class="x" type="button" onclick="sigHistClear()">Hapus</button></div>'
    + '<div class="mut small" style="margin-bottom:6px">Maks 12 sinyal terakhir di perangkat ini. Level disimpan apa adanya saat dibuat.</div>'
    + (h.length ? h.map(x => '<div class="item" style="align-items:center;gap:8px"><div style="min-width:0"><div><b>' + (x.dir === 'BUY' ? '🟢 BUY' : x.dir === 'SELL' ? '🔴 SELL' : '🟡 WAIT') + '</b> <span class="mut small">' + esc(sigTime(x.at)) + ' · ' + esc(x.tf || '') + (x.entryType ? ' · ' + esc(x.entryType) : '') + '</span></div><div class="small mut">harga ' + sigNum(x.price) + ' · keyakinan ' + (x.conf == null ? '—' : x.conf + '%') + (x.sl != null ? ' · SL ' + sigNum(x.sl) + ' · TP ' + sigNum(x.tp) : '') + '</div></div></div>').join('')
      : '<div class="mut small">Belum ada riwayat.</div>')
    + '</div>';
}
function sigHistClear() {
  if (!sigHist().length) return;
  if (!confirm('Hapus riwayat sinyal di perangkat ini?')) return;
  try { localStorage.removeItem(SIG_HIST); } catch (e) { }
  sigHistPaint();
  if (typeof v21Toast === 'function') v21Toast('Riwayat sinyal dihapus');
}
function sigCalc() {
  const out = $('sigCalcOut');
  if (!out) return;
  const lv = sigLevels();
  if (!lv) { out.innerHTML = '<div><span>Status</span><b style="font-size:.86rem">Rencana WAIT — belum ada level untuk dihitung.</b></div>'; return; }
  const bal = parseFloat(String(SIG_ST.bal).replace(',', '.'));
  const rp = parseFloat(String(SIG_ST.risk).replace(',', '.'));
  if (!(bal > 0) || !(rp > 0)) { out.innerHTML = '<div><span>Status</span><b style="font-size:.86rem">Isi saldo dan risiko per trade.</b></div>'; return; }
  const riskUsd = bal * rp / 100;
  const raw = riskUsd / lv.riskPerLot;
  const lot = Math.floor(raw * 100 + 1e-9) / 100;
  const used = Math.max(0.01, lot);
  const real = used * lv.riskPerLot;
  out.innerHTML = '<div><span>Risiko</span><b>$' + riskUsd.toFixed(2) + '</b></div>'
    + '<div><span>Lot</span><b>' + (lot > 0 ? lot.toFixed(2) : '0,01 (min)') + '</b></div>'
    + '<div><span>Risiko aktual</span><b>$' + real.toFixed(2) + '</b></div>'
    + '<div><span>Potensi TP</span><b>$' + (real * (lv.tpPips / lv.slPips)).toFixed(2) + '</b></div>';
}
async function sigLoad(dataOnly) {
  if (SIG_ST.loading) return;
  if (typeof user === 'undefined' || !user) {
    SIG_ST.err = 'Masuk dengan akun Google dulu untuk memakai fitur trading.';
    SIG_ST.msg = '';
    sigPaint();
    return;
  }
  SIG_ST.loading = true; SIG_ST.err = '';
  SIG_ST.msg = 'Mengambil candle XAUUSD (M15/M5/M1/H1/D1), DXY, yield 10Y, spot emas live, dan kalender rilis…';
  sigPaint();
  try {
    const r = await tcall({ action: 'xauSignal', phase: 'data' });
    if (r && r.error) throw new Error(r.error);
    if (!r || !r.signal) throw new Error('Server tidak mengirim data sinyal.');
    SIG_ST.data = r.signal; SIG_ST.ai = null; SIG_ST.aiNotes = []; SIG_ST.meta = null;
    SIG_ST.msg = '✅ Data diperbarui ' + new Date().toLocaleTimeString('id-ID') + ' · arah ' + (r.signal.direction || 'WAIT') + ' · konfirmasi ' + (r.signal.confirms == null ? '—' : r.signal.confirms + '/6') + ' · ' + (r.signal.dataValid ? 'data valid' : 'data terbatas');
    sigCacheSave(r.signal); sigHistSave();
  } catch (e) {
    SIG_ST.err = 'Gagal mengambil data sinyal: ' + ((e && e.message) || e);
    SIG_ST.msg = '';
  }
  SIG_ST.loading = false;
  sigPaint();
  if (!dataOnly && !SIG_ST.err && SIG_ST.data) sigRunAI();
}
async function sigRunAI() {
  if (SIG_ST.loadingAI) return;
  if (!SIG_ST.data) { SIG_ST.err = 'Ambil data sinyal dulu sebelum meminta penilaian AI.'; sigPaint(); return; }
  if (typeof user === 'undefined' || !user) { SIG_ST.err = 'Masuk dengan akun Google dulu.'; sigPaint(); return; }
  SIG_ST.loadingAI = true; SIG_ST.err = ''; SIG_ST.aiNotes = [];
  SIG_ST.msg = 'AI menilai checklist, struktur, dan risiko rilis (level tidak diubah)…';
  sigPaint();
  try {
    const r = await tcall({ action: 'xauSignal', phase: 'ai' });
    if (r && r.error) throw new Error(r.error);
    if (r && r.signal) SIG_ST.data = r.signal;
    SIG_ST.ai = (r && r.ai) || null;
    SIG_ST.meta = r ? { provider: r.provider, model: r.model } : null;
    SIG_ST.aiNotes = (r && r.aiNotes) || [];
    SIG_ST.msg = SIG_ST.ai ? '✅ Penilaian AI selesai.' : 'AI tidak memberi format valid; sinyal mesin tetap berlaku.';
  } catch (e) {
    SIG_ST.aiNotes = [String((e && e.message) || e)];
    SIG_ST.msg = 'Penilaian AI gagal; sinyal mesin tetap bisa dipakai.';
  }
  SIG_ST.loadingAI = false;
  sigPaint();
}
async function sigTick() {
  if (typeof user === 'undefined' || !user) return;
  try {
    const r = await tcall({ action: 'xauSignal', phase: 'tick' });
    if (r && r.tick) { SIG_ST.tick = r.tick; sigLivePaint(); }
  } catch (e) { }
}
function sigLivePaint() {
  const el = $('sigLive');
  if (!el) return;
  const t = SIG_ST.tick;
  if (!t || !t.price) { el.textContent = 'live: —'; return; }
  const lv = sigLevels();
  let extra = '';
  if (lv) {
    const drift = Math.abs(t.price - lv.entry) / lv.pip;
    extra = ' · selisih entry ' + drift.toFixed(0) + ' pip' + (drift > 5 ? ' (muat ulang data)' : '');
  }
  el.innerHTML = '🔴 live <b>' + sigNum(t.price) + '</b> · ' + esc(new Date(t.at).toLocaleTimeString('id-ID')) + extra;
}
function sigTickStart() {
  if (SIG_ST.tickTimer) clearInterval(SIG_ST.tickTimer);
  SIG_ST.tickTimer = setInterval(function () {
    if (!document.getElementById('sigBox')) { clearInterval(SIG_ST.tickTimer); SIG_ST.tickTimer = 0; return; }
    if (!SIG_ST.loading && !SIG_ST.loadingAI) sigTick();
  }, 15000);
  sigTick();
}
function sigAuto() {
  const btn = $('sigAutoBtn');
  if (SIG_ST.timer) { clearInterval(SIG_ST.timer); SIG_ST.timer = 0; SIG_ST.auto = false; }
  else {
    SIG_ST.auto = true;
    SIG_ST.timer = setInterval(function () {
      if (!document.getElementById('sigBox')) { clearInterval(SIG_ST.timer); SIG_ST.timer = 0; SIG_ST.auto = false; return; }
      if (!SIG_ST.loading && !SIG_ST.loadingAI) sigLoad(true);
    }, 60000);
  }
  if (btn) btn.textContent = '⏱ Auto 60 dtk: ' + (SIG_ST.auto ? 'aktif' : 'mati');
  if (typeof v21Toast === 'function') v21Toast(SIG_ST.auto ? 'Auto-refresh 60 detik aktif' : 'Auto-refresh dimatikan');
}
function sigCopy(btn) {
  const d = SIG_ST.data, lv = sigLevels();
  if (!d) return alert('Belum ada sinyal untuk disalin.');
  const txt = 'SIGNAL ENTRY XAUUSD — ' + sigTime(d.generatedAt) + '\n'
    + 'Arah: ' + d.direction + ' · keyakinan ' + d.confidence + '% · skor ' + d.score + ' · ' + d.timeframe + ' · konfirmasi ' + (d.confirms == null ? '—' : d.confirms + '/6') + '\n'
    + (lv ? 'Entry ' + lv.entry + ' (' + lv.entryType + ') | SL ' + lv.sl + ' (' + lv.slPips + ' pip) | TP ' + lv.tp + ' (' + lv.tpPips + ' pip, 1:' + (d.rr || 2) + ')\n' : 'Rencana: WAIT' + ((d.gates || []).length ? ' — ' + d.gates.join('; ') : '') + '\n')
    + 'Struktur M15: ' + d.structure + (d.m5 ? ' · M5 ' + d.m5.trend : '') + (d.sweep ? ' · sweep ' + d.sweep.kind : '') + '\n'
    + (d.ob ? 'Order block: ' + d.ob.kind + ' ' + d.ob.lo + '-' + d.ob.hi + '\n' : '')
    + (d.poi ? 'POI: FVG ' + d.poi.kind + ' ' + d.poi.lo + '-' + d.poi.hi + '\n' : '')
    + 'Sesi: ' + (d.session ? d.session.ses + (d.session.kill ? ' / ' + d.session.kill : '') : '—') + '\n'
    + 'Checklist: ' + (d.checklist || []).filter(c => c.ok).length + '/' + (d.checklist || []).length + ' OK\n'
    + 'Edukasi, bukan saran finansial.';
  const done = function () {
    if (btn) { const o = btn.textContent; btn.textContent = '✅ Tersalin'; setTimeout(function () { btn.textContent = o; }, 1600); }
    else if (typeof v21Toast === 'function') v21Toast('Tersalin');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { sigCopyFallback(txt, done); });
    else sigCopyFallback(txt, done);
  } catch (e) { sigCopyFallback(txt, done); }
}
function sigCopyFallback(t, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { if (typeof v21Toast === 'function') v21Toast('Gagal menyalin'); }
}

/* ---------- kartu rencana untuk tab News Analisis ---------- */
function xauPlanHtml(sig) {
  if (!sig || sig.error) return '';
  const lv = sig.plan ? { entry: sig.plan.entry, sl: sig.plan.sl, tp: sig.plan.tp, type: sig.plan.entryType || 'MARKET' } : null;
  const dir = sig.direction || 'WAIT';
  const col = dir === 'BUY' ? 'var(--ok)' : dir === 'SELL' ? 'var(--no)' : 'var(--warn)';
  const ok = (sig.checklist || []).filter(c => c.ok).length, n = (sig.checklist || []).length;
  return '<div class="card" style="border-left:5px solid ' + col + '">'
    + '<div class="rb-card-head"><h3>⚡ Rencana entry dari data global (mesin)</h3><span class="rb-pill">SL 30 pip · TP 1:2</span></div>'
    + '<div style="font-weight:900;font-size:1.2rem;color:' + col + ';letter-spacing:-.02em">'
    + (dir === 'BUY' ? '🟢 BUY XAUUSD' : dir === 'SELL' ? '🔴 SELL XAUUSD' : '🟡 WAIT — belum ada konfluensi') + '</div>'
    + (lv
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin-top:8px">'
        + '<div class="exp" style="color:var(--tx)"><div class="small mut">' + (lv.type === 'LIMIT POI' ? 'Entry limit (POI)' : 'Entry market') + '</div><div style="font-weight:800">' + sigNum(lv.entry) + '</div></div>'
        + '<div class="exp" style="color:var(--tx)"><div class="small mut">Stop loss (30 pip)</div><div style="font-weight:800;color:var(--no)">' + sigNum(lv.sl) + '</div></div>'
        + '<div class="exp" style="color:var(--tx)"><div class="small mut">Take profit (1:2)</div><div style="font-weight:800;color:var(--ok)">' + sigNum(lv.tp) + '</div></div>'
        + '</div>'
      : '<div class="small" style="margin-top:6px">Mesin menolak memaksa entry. POI terdekat: ' + (sig.poi ? 'FVG ' + sig.poi.kind + ' ' + sig.poi.lo + '–' + sig.poi.hi : 'tidak ada') + '.' + ((sig.gates || []).length ? ' Ditahan karena: ' + sig.gates.map(esc).join(' · ') + '.' : '') + (sig.watch ? ' Zona tunggu BUY ' + sig.watch.zoneBuy[0] + '–' + sig.watch.zoneBuy[1] + ' / SELL ' + sig.watch.zoneSell[0] + '–' + sig.watch.zoneSell[1] + '.' : '') + '</div>')
    + '<div class="small mut" style="margin-top:8px">Keyakinan ' + sig.confidence + '% · skor ' + sig.score + ' · checklist ' + ok + '/' + n + ' OK · konfirmasi ' + (sig.confirms == null ? '—' : sig.confirms + '/6') + ' · ' + esc(sig.timeframe || 'M15') + ' · harga ' + sigNum(sig.price) + (sig.news && sig.news.length ? ' · ⚠️ rilis ≤90 menit' : '') + '</div>'
    + '<div class="small mut" style="margin-top:4px">Level dari mesin deterministik (bukan karangan AI). AI pada tab News hanya menyusun arah/skenario dan tidak mengubah level.</div>'
    + '<button class="btn alt full" type="button" style="margin-top:8px" onclick="S.sec=\'trading\';S.tab=\'signal\';home()">Buka tab ⚡ Signal Entry</button>'
    + '</div>';
}
