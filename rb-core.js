/* ==========================================================================
   RUANG BELAJAR — V26 CORE
   - Sistem visual responsif (HP kecil, HP besar, tablet, laptop, desktop)
   - Beranda terpadu: streak, target, kalender real-time dunia, papan peringkat
   - Perbaikan kategori peringkat (soal sekolah tidak lagi masuk TKA)
   - Tutor AI fokus pelajaran + mesin lokal cadangan (selalu bisa dipakai)
   Semua fungsi lama tetap dipakai; modul ini hanya menimpa yang perlu.
   ========================================================================== */
document.head.insertAdjacentHTML('beforeend', `<style>
/* ---------- 1. Kerangka & tipografi fluid ---------- */
:root{--rb-max:1120px;--rb-radius:20px;--rb-gap:14px}
html{-webkit-text-size-adjust:100%;scrollbar-gutter:stable}
body{overflow-x:clip;font-size:clamp(14.5px,1.55vw,16px)}
.wrap{width:100%;max-width:var(--rb-max);margin:0 auto;padding:clamp(14px,2vw,26px) clamp(12px,2.4vw,24px) calc(120px + env(safe-area-inset-bottom))}
img,svg,video,canvas{max-width:100%;height:auto}
.card,.msg,.exp,.item,.gi,.q,.opt,.warn,.hint,.note,td,th,.v21-nm{min-width:0}
p,li,.small,.mut,.exp,.note{overflow-wrap:anywhere}
.card{border-radius:var(--rb-radius);padding:clamp(14px,2vw,20px);margin-bottom:var(--rb-gap)}
.card>h3{letter-spacing:-.02em}
h1{font-size:clamp(1.15rem,2.6vw,1.45rem)}
h2{font-size:clamp(1.05rem,2.2vw,1.25rem)}
h3{font-size:clamp(.96rem,1.7vw,1.04rem)}
label{margin-top:10px}
.row{gap:10px;flex-wrap:wrap}
.row>*{flex:1 1 130px;min-width:0}
.btn,.x,.tabs button,.stabs button,.v21-cats button,.opt,.nb{min-width:0}
.btn{white-space:normal;line-height:1.3}
button,.btn,.opt,.x{-webkit-tap-highlight-color:transparent}
:where(button,a,input,select,textarea):focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- 2. Navigasi utama ---------- */
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
.tabs button{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:44px}
.tabs button.on{box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 10px 24px -20px rgba(79,95,232,.8)}
@media(max-width:640px){
  .tabs{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:60;
    padding:5px;border-radius:18px;background:var(--nav);border:1px solid var(--line);
    box-shadow:0 -10px 34px -22px rgba(0,0,0,.9);grid-template-columns:repeat(4,minmax(0,1fr))}
  .tabs button{min-height:52px;font-size:.66rem;padding:6px 1px;line-height:1.2;border-radius:14px}
  .tabs button.on{background:linear-gradient(150deg,var(--action),var(--action2));color:#fff}
  .stabs{position:sticky;top:calc(4px + env(safe-area-inset-top));z-index:50;overflow-x:auto;flex-wrap:nowrap;
    scrollbar-width:none;scroll-snap-type:x proximity;padding:5px;border-radius:15px;background:var(--nav);margin-bottom:12px}
  .stabs::-webkit-scrollbar{display:none}
  .stabs button{flex:0 0 auto;scroll-snap-align:center;min-height:40px;padding:8px 12px;font-size:.76rem}
  .v21-fab{right:10px;bottom:calc(96px + env(safe-area-inset-bottom));width:40px;height:40px;z-index:59}
  .v22-top{left:10px;bottom:calc(150px + env(safe-area-inset-bottom));width:38px;height:38px}
  .v21-toast{bottom:calc(92px + env(safe-area-inset-bottom))}
}
@media(min-width:641px){.tabs{grid-template-columns:repeat(4,minmax(0,1fr))}.tabs button{min-height:46px;font-size:.88rem}}

/* ---------- 3. Beranda ---------- */
.rb-hero{position:relative;overflow:hidden;background:
  radial-gradient(560px 220px at 92% -30%,var(--accent-soft),transparent 70%),
  linear-gradient(160deg,var(--card2),var(--card) 62%);border-color:var(--line)}
.rb-hero:after{content:'';position:absolute;inset:auto -60px -120px auto;width:240px;height:240px;border-radius:50%;
  background:radial-gradient(circle,rgba(94,234,212,.16),transparent 62%);pointer-events:none}
.rb-hero-main{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.rb-hero-copy{flex:1 1 240px;min-width:0;position:relative;z-index:1}
.rb-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.rb-hero h2{margin:0 0 8px;font-size:clamp(1.1rem,2.6vw,1.42rem);line-height:1.24;letter-spacing:-.03em}
.rb-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
.rb-kpi{padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--field) 78%,transparent);min-width:0}
.rb-kpi b{display:block;font-size:1.05rem;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.25}
.rb-kpi span{font-size:.7rem;color:var(--mut);font-weight:650}
.rb-hero .ring{width:clamp(78px,16vw,96px);height:clamp(78px,16vw,96px)}
.rb-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}
.rb-actions .btn{margin-top:0;min-height:44px;font-size:.86rem;padding:10px 12px}
@media(min-width:520px){.rb-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.rb-actions{grid-template-columns:repeat(4,minmax(0,1fr))}}
.rb-grid{display:grid;grid-template-columns:1fr;gap:var(--rb-gap);align-items:start}
.rb-grid>*{min-width:0}
@media(min-width:920px){
  .rb-grid{grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr)}
  .rb-grid>.rb-span{grid-column:1/-1}
}
.rb-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.rb-card-head h3{margin:0}
.rb-actions-inline{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.rb-note{font-size:.78rem;color:var(--mut);line-height:1.55}

/* kalender */
.rb-calwrap{min-width:0}
.rb-calhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0 10px;flex-wrap:wrap}
.rb-caltitle{font-weight:800;letter-spacing:-.02em;font-size:.98rem}
.rb-calnav{display:flex;gap:5px;align-items:center}
.rb-calnav .x{min-width:34px;min-height:34px;padding:4px 9px}
.rb-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.rb-calh{text-align:center;font-size:.64rem;font-weight:800;color:var(--mut);letter-spacing:.06em;text-transform:uppercase;padding:2px 0}
.rb-day{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  height:clamp(38px,5.2vw,54px);min-height:38px;width:100%;padding:0;border-radius:10px;border:1px solid var(--line);
  background:var(--field);color:var(--tx);font:inherit;font-size:.74rem;cursor:pointer;transition:background .15s,border-color .15s,transform .12s}
.rb-day:hover{border-color:var(--line2);transform:translateY(-1px)}
.rb-day .rb-dn{font-variant-numeric:tabular-nums;font-weight:700;line-height:1}
.rb-day .rb-dl{font-size:.56rem;color:inherit;opacity:.72;line-height:1}
.rb-day.out{opacity:.32;cursor:default}
.rb-day.future{opacity:.4;cursor:default}
.rb-day.today{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.rb-day.sel{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 2px var(--accent-soft)}
.rb-day.l1{background:rgba(139,157,255,.14);border-color:rgba(139,157,255,.35)}
.rb-day.l2{background:rgba(139,157,255,.24);border-color:rgba(139,157,255,.5)}
.rb-day.l3{background:rgba(139,157,255,.36);border-color:rgba(139,157,255,.65)}
.rb-day.l4{background:rgba(139,157,255,.5);border-color:var(--accent)}
html[data-theme=light] .rb-day.l1{background:rgba(79,95,232,.1)}
html[data-theme=light] .rb-day.l2{background:rgba(79,95,232,.18)}
html[data-theme=light] .rb-day.l3{background:rgba(79,95,232,.26)}
html[data-theme=light] .rb-day.l4{background:rgba(79,95,232,.34)}
.rb-callegend{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px;font-size:.7rem;color:var(--mut)}
.rb-callegend i{width:12px;height:12px;border-radius:4px;border:1px solid var(--line);display:inline-block}
.rb-callegend i.a{background:rgba(139,157,255,.14)}.rb-callegend i.b{background:rgba(139,157,255,.28)}.rb-callegend i.c{background:rgba(139,157,255,.5)}
.rb-caldetail{margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--field);font-size:.8rem;line-height:1.55}

/* jam dunia */
.rb-clocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:8px}
.rb-clock{padding:9px 11px;border-radius:13px;border:1px solid var(--line);background:var(--field);min-width:0}
.rb-clock span{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:.68rem;color:var(--mut);font-weight:700;letter-spacing:.03em}
.rb-clock b{display:block;font-size:1.02rem;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:1px}
.rb-clock em{font-style:normal;font-size:.62rem;color:var(--mut);font-variant-numeric:tabular-nums}
.rb-live{display:inline-flex;align-items:center;gap:5px;font-size:.68rem;color:var(--ok);font-weight:700}
.rb-live:before{content:'';width:6px;height:6px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(74,222,157,.18);animation:rbpulse 1.9s infinite}
@keyframes rbpulse{0%,100%{opacity:1}50%{opacity:.35}}

/* ---------- 4. Papan peringkat ---------- */
.rb-board-note{margin:2px 0 8px}
.rb-ranklist{margin-top:10px}
.v21-rank.me{outline:1px solid var(--accent);outline-offset:-1px}
.v21-xp{font-size:.8rem}
@media(max-width:420px){
  .v21-rank{gap:8px;font-size:.82rem}
  .v21-pos{width:20px}
  .v21-stat{font-size:.68rem;gap:3px 7px}
}

/* ---------- 5. Tutor ---------- */
.rb-focus{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.rb-focus .chip{font-size:.7rem}
#chat{max-height:min(58vh,500px);scroll-behavior:smooth;overscroll-behavior:contain}
@media(max-width:640px){#chat{max-height:46vh}}
.msg{max-width:100%;overflow-wrap:anywhere}
.msg.assistant table{display:block;overflow-x:auto}
.rb-chatbar{display:flex;gap:8px;margin-top:12px;align-items:stretch}
.rb-chatbar input{flex:1 1 auto;min-width:0}
.rb-chatbar .btn{flex:0 0 auto;min-height:46px}
@media(max-width:420px){.rb-chatbar .btn{padding:10px 14px}}
.rb-suggest{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.rb-suggest button{text-align:left;max-width:100%}
.rb-ai-note{font-size:.74rem;color:var(--mut);margin-top:8px;line-height:1.55}
.rb-offline{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);border:1px solid var(--warn-line);color:var(--tx);font-size:.66rem;font-weight:700}

/* ---------- 6. Belajar soal ---------- */
.rb-q{border:1px solid var(--line);border-radius:16px;background:var(--field);padding:12px 14px;margin-bottom:9px;min-width:0}
.rb-q-top{display:flex;gap:10px;align-items:flex-start}
.rb-q-main{flex:1;min-width:0}
.rb-q-t{font-weight:650;line-height:1.5;font-size:.9rem;overflow-wrap:anywhere}
.rb-q-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.rb-tag{font-size:.64rem;font-weight:700;padding:2px 7px;border-radius:999px;background:var(--card2);border:1px solid var(--line);color:var(--mut)}
.rb-tag.ok{background:var(--ok-soft);border-color:var(--ok-soft);color:var(--ok)}
.rb-tag.warn{background:var(--warn-soft);border-color:var(--warn-line);color:var(--tx)}
.rb-check{width:20px;height:20px;margin-top:3px;flex:0 0 auto;accent-color:var(--accent)}
.rb-q-body{margin-top:10px;border-top:1px solid var(--line);padding-top:10px;font-size:.85rem;line-height:1.6}
.rb-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.rb-toolbar .btn{margin-top:0;flex:1 1 150px;min-height:42px;font-size:.84rem;padding:9px 12px}
.rb-toolbar .btn.alt{background:var(--card2)}
.rb-mode{display:flex;gap:5px;background:var(--card2);padding:4px;border-radius:12px;border:1px solid var(--line)}
.rb-mode button{flex:1;border:0;background:transparent;color:var(--mut);font:inherit;font-size:.78rem;font-weight:700;padding:7px 8px;border-radius:9px;cursor:pointer}
.rb-mode button.on{background:var(--accent);color:#fff}

/* ---------- 7. Alchemist ---------- */
.rb-hero-alch{background:radial-gradient(620px 240px at 88% -30%,rgba(94,234,212,.14),transparent 70%),linear-gradient(160deg,var(--card2),var(--card) 62%)}
.rb-terms{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
@media(min-width:720px){.rb-terms{grid-template-columns:1fr 1fr}}
.rb-term{border:1px solid var(--line);border-radius:14px;background:var(--field);padding:11px 13px;min-width:0}
.rb-term b{display:block;font-size:.84rem;letter-spacing:-.01em}
.rb-term .rb-term-abbr{color:var(--accent);font-weight:800;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase}
.rb-term p{margin:5px 0 0;font-size:.78rem;line-height:1.55;color:var(--mut)}
.rb-term .rb-term-use{margin-top:5px;font-size:.74rem;color:var(--tx);opacity:.9}
.rb-flow{display:grid;grid-template-columns:1fr;gap:8px;counter-reset:flow}
@media(min-width:720px){.rb-flow{grid-template-columns:1fr 1fr}}
.rb-step{position:relative;padding:11px 13px 11px 44px;border:1px solid var(--line);border-radius:14px;background:var(--field);font-size:.84rem;line-height:1.55}
.rb-step:before{counter-increment:flow;content:counter(flow);position:absolute;left:11px;top:11px;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-size:.72rem;font-weight:800;background:var(--accent-soft);color:var(--accent);border:1px solid var(--line)}
.rb-step b{display:block;margin-bottom:2px}
.rb-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.rb-table{width:100%;border-collapse:collapse;font-size:.8rem;min-width:480px}
.rb-table th,.rb-table td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.rb-table th{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);background:var(--card2);position:sticky;top:0}
.rb-table tr:last-child td{border-bottom:0}
.rb-accordion{border:1px solid var(--line);border-radius:14px;background:var(--field);margin-bottom:8px;overflow:hidden}
.rb-accordion>summary{cursor:pointer;padding:12px 14px;font-weight:700;font-size:.88rem;list-style:none;display:flex;justify-content:space-between;gap:10px;align-items:center}
.rb-accordion>summary::-webkit-details-marker{display:none}
.rb-accordion>summary:after{content:'+';font-weight:800;color:var(--accent);font-size:1.05rem;line-height:1}
.rb-accordion[open]>summary:after{content:'−'}
.rb-accordion .rb-acc-body{padding:0 14px 13px;font-size:.85rem;line-height:1.62}
.rb-acc-body ul{margin:6px 0 0;padding-left:19px}
.rb-acc-body li{margin:3px 0}
.rb-callout{padding:11px 13px;border-radius:13px;border:1px solid var(--line);background:var(--card2);font-size:.82rem;line-height:1.6;margin:9px 0}
.rb-callout.warn{background:var(--warn-soft);border-color:var(--warn-line)}
.rb-callout.ok{background:var(--ok-soft);border-color:var(--ok-soft)}
.rb-callout b{color:var(--tx)}
.rb-pill-row{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.rb-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:.68rem;font-weight:700;background:var(--card2);border:1px solid var(--line);color:var(--mut)}
.rb-pill.g{color:var(--ok);background:var(--ok-soft);border-color:var(--ok-soft)}
.rb-pill.r{color:var(--no);background:var(--no-soft);border-color:var(--no-soft)}
.rb-pill.y{color:var(--tx);background:var(--warn-soft);border-color:var(--warn-line)}
.rb-quiz{border:1px solid var(--line);border-radius:14px;background:var(--field);padding:12px 14px;margin-bottom:9px}
.rb-quiz .rb-opt{display:block;width:100%;text-align:left;margin-top:6px;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--tx);font:inherit;font-size:.82rem;cursor:pointer}
.rb-quiz .rb-opt.ok{border-color:var(--ok);background:var(--ok-soft)}
.rb-quiz .rb-opt.no{border-color:var(--no);background:var(--no-soft)}
.rb-checklist{display:grid;gap:7px;margin-top:8px}
.rb-cl-item{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border-radius:11px;border:1px solid var(--line);background:var(--field);font-size:.83rem;line-height:1.5;cursor:pointer}
.rb-cl-item input{margin-top:2px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--accent)}
.rb-cl-item.on{border-color:var(--ok);background:var(--ok-soft)}
.rb-chart{width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:var(--field)}
.rb-src{display:grid;gap:6px;margin-top:8px}
.rb-src a{font-size:.78rem;line-height:1.45}
.rb-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:.7rem;color:var(--mut);margin-top:6px}
.rb-legend i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:4px;vertical-align:-1px}

/* ---------- 8. Umum ---------- */
.rb-stack{display:grid;gap:9px}
.rb-between{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.rb-muted-box{padding:10px 12px;border-radius:12px;border:1px dashed var(--line2);background:transparent;font-size:.8rem;color:var(--mut);line-height:1.55}
@media(prefers-reduced-motion:reduce){.rb-live:before{animation:none}.rb-day{transition:none}}
</style>`);

/* ==========================================================================
   UTIL
   ========================================================================== */
const RB26 = {
  clockTimer: 0,
  calY: (new Date()).getFullYear(),
  calM: (new Date()).getMonth(),
  calSel: '',
  boardCat: 's',
  online: null
};
function rb26$id(id) { return document.getElementById(id); }
function rb26Safe(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function rb26Store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, String(v)); } catch (e) { } return null; }
function rb26Num(n) { return new Intl.NumberFormat('id-ID').format(Number(n) || 0); }
function rb26DayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rb26ParseKey(k) { const p = String(k).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function rb26Act() { return (typeof v21Act === 'function') ? v21Act() : { days: {}, xp: 0 }; }
function rb26UserName() { return ((window.user && (user.displayName || user.email)) || 'Siswa'); }
function rb26FirstName() { return String(rb26UserName()).split(' ')[0]; }

/* ==========================================================================
   KATEGORI PERINGKAT — PERBAIKAN BUG
   Sebelumnya mode ujian/tryout otomatis dicap "TKA", sehingga soal sekolah
   masuk ke papan TKA. Sekarang kategori murni mengikuti bagian & mapel soal.
   ========================================================================== */
function v21Kind(x) {
  if (!x) return '';
  const sec = String(x.kategori || x.sec || '').toLowerCase().trim();
  const mapel = String(x.mapel || '').trim();
  if (sec === 'trading' || /^trading$/i.test(mapel)) return '';
  if (sec === 'umum' || /^umum/i.test(mapel)) return 'u';
  if (sec === 'tka' || /^(tka|utbk)\b/i.test(mapel)) return 't';
  if (sec === 'sekolah' || sec === 'bahasa') return 's';
  return '';
}

/* label kategori lebih jelas */
try {
  if (typeof V21_CATS !== 'undefined' && Array.isArray(V21_CATS)) {
    V21_CATS[0][1] = ' Sekolah';
    V21_CATS[1][1] = ' TKA / UTBK';
    V21_CATS[2][1] = ' Umum';
  }
} catch (e) { }

/* sinkronisasi ulang total dari riwayat `hasil` (memperbaiki data lama yang salah kategori) */
async function v21BackfillStats() {
  if (!db || !user) return false;
  const key = 'rb26_stats_' + user.uid;
  const last = +(rb26Store(key) || 0);
  if (Date.now() - last < 12 * 3600000) return true;
  try {
    const hs = await db.collection('hasil').where('uid', '==', user.uid).limit(1500).get();
    const agg = { s: { b: 0, s: 0, t: 0 }, t: { b: 0, s: 0, t: 0 }, u: { b: 0, s: 0, t: 0 } };
    hs.docs.forEach(doc => {
      const x = doc.data() || {}, k = v21Kind(x);
      if (!agg[k]) return;
      const ok = Math.max(0, Math.round(+x.skor || 0)), total = Math.max(0, Math.round(+x.total || 0));
      agg[k].b += ok; agg[k].s += Math.max(0, total - ok); agg[k].t += total;
    });
    const ref = db.collection('papan').doc(user.uid);
    const done = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const patch = { uid: user.uid };
      ['s', 't', 'u'].forEach(k => {
        patch[k + 'Benar'] = agg[k].b;
        patch[k + 'Salah'] = agg[k].s;
        patch[k + 'Total'] = agg[k].t;
      });
      tx.set(ref, patch, { merge: true });
      return true;
    });
    if (!done) return false;
    rb26Store(key, Date.now());
    return true;
  } catch (e) {
    console.warn('V26 rekap peringkat:', e && e.message);
    return false;
  }
}

/* ==========================================================================
   NAVIGASI
   ========================================================================== */
function v21Go(tab) {
  if (tab === 'papan' || tab === 'kalender') { S.sec = 'beranda'; S.tab = tab; return home(); }
  S.sec = 'sekolah'; S.tab = tab; home();
}
function homeBase() {
  if (S.sec === 'admin') return adminView();
  if (S.sec === 'kamus') return kamusView();
  if (typeof v21MarkTabs === 'function') v21MarkTabs();
  if (S.sec === 'beranda') {
    if (['beranda', 'papan', 'kalender'].indexOf(S.tab) < 0) S.tab = 'beranda';
    $('app').innerHTML = '<div id="pane"></div>';
    return pane();
  }
  if (S.sec === 'trading') {
    S.mapel = 'Trading';
    if (['xau', 'signal', 'alchemist', 'tutor', 'jurnal'].indexOf(S.tab) < 0) S.tab = 'xau';
    const T = [['xau', ' News Analisis'], ['signal', ' Signal Entry'], ['alchemist', ' Strategi Alchemist'], ['tutor', ' Tutor'], ['jurnal', ' Jurnal']];
    $('app').innerHTML = '<div class="stabs">' + T.map(function (x) {
      return '<button class="' + (S.tab === x[0] ? 'on' : '') + '" onclick="S.tab=\'' + x[0] + '\';home()">' + x[1] + '</button>';
    }).join('') + '</div><div id="pane"></div>';
    return pane();
  }
  if (S.mapel === 'Trading') S.mapel = (MAPEL.sekolah && MAPEL.sekolah[0]) || 'Bahasa Indonesia';
  if (['latihan', 'tryout', 'tutor', 'soal', 'buat', 'bank'].indexOf(S.tab) < 0) S.tab = 'latihan';
  const T = [['latihan', ' Latihan'], ['tryout', ' Tryout'], ['tutor', ' Tutor'], ['soal', ' Belajar Soal'], ['buat', ' Buat Soal'], ['bank', ' Bank']];
  $('app').innerHTML = '<div class="card v21-pick"><label style="margin-top:0">Pelajaran / topik</label>'
    + '<select onchange="S.mapel=this.value;S.gen=[];S.sub=\'\';pane()">' + mapelOptions() + '</select></div>'
    + '<div class="stabs">' + T.map(function (x) {
      return '<button class="' + (S.tab === x[0] ? 'on' : '') + '" onclick="S.tab=\'' + x[0] + '\';home()">' + x[1] + '</button>';
    }).join('') + '</div><div id="pane"></div>';
  pane();
}
function pane() {
  const map = {
    beranda: pBeranda, papan: pPapan, kalender: pKalender,
    latihan: pLatihan, tryout: pTryout, tutor: pTutor,
    soal: (typeof pSoal === 'function' ? pSoal : pLatihan),
    buat: pBuat, bank: pBank, jurnal: pJurnal, xau: pXauNews,
    signal: (typeof pSignalEntry === 'function' ? pSignalEntry : pXauNews),
    alchemist: (typeof pAlchemist === 'function' ? pAlchemist : pXauNews)
  };
  const f = map[S.tab];
  if (f) return f();
  S.tab = 'latihan';
  return pLatihan();
}

/* ==========================================================================
   BERANDA
   ========================================================================== */
function rb26ClocksHtml() {
  const zones = [
    ['', 'Jakarta', 'Asia/Jakarta'],
    ['', 'Singapura', 'Asia/Singapore'],
    ['', 'Tokyo', 'Asia/Tokyo'],
    ['', 'Dubai', 'Asia/Dubai'],
    ['', 'London', 'Europe/London'],
    ['', 'New York', 'America/New_York'],
    ['', 'Sydney', 'Australia/Sydney']
  ];
  return '<div class="rb-clocks">' + zones.map(function (z) {
    return '<div class="rb-clock"><span>' + z[0] + ' ' + z[1] + ' <em data-rbzday="' + z[2] + '"></em></span>'
      + '<b data-rbz="' + z[2] + '">--:--:--</b></div>';
  }).join('') + '</div>';
}
function rb26StartClocks() {
  clearInterval(RB26.clockTimer);
  const tick = function () {
    const els = document.querySelectorAll('[data-rbz]');
    if (!els.length) { clearInterval(RB26.clockTimer); RB26.clockTimer = 0; return; }
    const now = new Date(), localKey = rb26DayKey(now);
    els.forEach(function (el) {
      const tz = el.getAttribute('data-rbz');
      try {
        el.textContent = new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
        const dayEl = document.querySelector('[data-rbzday="' + tz + '"]');
        if (dayEl) {
          const zk = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
          const diff = Math.round((rb26ParseKey(zk) - rb26ParseKey(localKey)) / 86400000);
          dayEl.textContent = diff === 0 ? 'hari ini' : diff > 0 ? '+' + diff + ' hari' : diff + ' hari';
        }
      } catch (e) { el.textContent = '—'; }
    });
  };
  tick();
  RB26.clockTimer = setInterval(tick, 1000);
}

/* kalender konsistensi belajar */
function rb26CalData() {
  const a = rb26Act(), days = a.days || {};
  const y = RB26.calY, m = RB26.calM;
  const first = new Date(y, m, 1), start = (first.getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const prevTotal = new Date(y, m, 0).getDate();
  const cells = [], todayKey = rb26DayKey(new Date());
  for (let i = 0; i < start; i++) cells.push({ out: true, d: prevTotal - start + i + 1 });
  for (let d = 1; d <= total; d++) {
    const k = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const x = days[k] || { n: 0, ok: 0 };
    cells.push({ out: false, d: d, k: k, n: +x.n || 0, ok: +x.ok || 0, today: k === todayKey, future: k > todayKey });
  }
  let tail = 1;
  while (cells.length % 7 !== 0) cells.push({ out: true, d: tail++ });
  const monthKeys = Object.keys(days).filter(function (k) { return k.indexOf(y + '-' + String(m + 1).padStart(2, '0')) === 0 && days[k] && days[k].n > 0; });
  const n = monthKeys.reduce(function (s, k) { return s + (+days[k].n || 0); }, 0);
  const ok = monthKeys.reduce(function (s, k) { return s + (+days[k].ok || 0); }, 0);
  return { cells: cells, n: n, ok: ok, active: monthKeys.length, total: total };
}
function rb26Level(n) { return n <= 0 ? 0 : n >= 40 ? 4 : n >= 20 ? 3 : n >= 10 ? 2 : 1; }
function rb26MonthName(y, m) {
  try { return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1)); }
  catch (e) { return (m + 1) + '/' + y; }
}
function rb26CalHtml() {
  const d = rb26CalData();
  const head = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(function (x) { return '<div class="rb-calh">' + x + '</div>'; }).join('');
  const cells = d.cells.map(function (c) {
    if (c.out) return '<div class="rb-day out"><span class="rb-dn">' + c.d + '</span></div>';
    const lv = rb26Level(c.n);
    const title = c.k + ' • ' + c.n + ' soal • ' + c.ok + ' benar';
    return '<button type="button" class="rb-day ' + (lv ? 'l' + lv : '') + (c.today ? ' today' : '') + (RB26.calSel === c.k ? ' sel' : '') + (c.future ? ' future' : '') + '" '
      + 'title="' + title + '" aria-label="' + title + '" onclick="rb26CalPick(\'' + c.k + '\')">'
      + '<span class="rb-dn">' + c.d + '</span>' + (c.n ? '<span class="rb-dl">' + c.n + '</span>' : '') + '</button>';
  }).join('');
  return '<div class="rb-calhead"><div><div class="rb-caltitle">' + rb26MonthName(RB26.calY, RB26.calM) + '</div>'
    + '<div class="rb-note">' + d.active + ' hari aktif • ' + rb26Num(d.n) + ' soal • ' + (d.n ? Math.round(d.ok / d.n * 100) : 0) + '% benar</div></div>'
    + '<div class="rb-calnav"><button class="x" type="button" onclick="rb26CalMove(-1)" aria-label="Bulan sebelumnya">‹</button>'
    + '<button class="x" type="button" onclick="rb26CalToday()">Hari ini</button>'
    + '<button class="x" type="button" onclick="rb26CalMove(1)" aria-label="Bulan berikutnya">›</button></div></div>'
    + '<div class="rb-cal">' + head + cells + '</div>'
    + '<div class="rb-callegend"><span>Sedikit</span><i class="a"></i><i class="b"></i><i class="c"></i><span>Banyak</span>'
    + '<span style="margin-left:auto">Angka kecil = jumlah soal</span></div>'
    + '<div id="rbcaldetail" class="rb-caldetail">' + rb26CalDetailHtml() + '</div>';
}
function rb26CalDetailHtml() {
  const a = rb26Act(), days = a.days || {};
  if (!RB26.calSel) return 'Ketuk tanggal untuk melihat rincian belajar hari itu.';
  const x = days[RB26.calSel] || { n: 0, ok: 0 };
  let dt = RB26.calSel;
  try { dt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(rb26ParseKey(RB26.calSel)); } catch (e) { }
  if (!x.n) return '<b>' + rb26Safe(dt) + '</b><br>Belum ada latihan tercatat. Mulai 5 soal hari ini untuk menjaga rantai belajar.';
  return '<b>' + rb26Safe(dt) + '</b><br>' + x.n + ' soal dikerjakan • ' + x.ok + ' benar • ' + Math.round(x.ok / x.n * 100) + '% akurasi';
}
function rb26CalMove(d) {
  const nd = new Date(RB26.calY, RB26.calM + d, 1);
  RB26.calY = nd.getFullYear(); RB26.calM = nd.getMonth(); RB26.calSel = '';
  const box = rb26$id('rbcal');
  if (box) box.innerHTML = rb26CalHtml();
  else if (typeof pKalender === 'function') pKalender();
}
function rb26CalToday() {
  const n = new Date(); RB26.calY = n.getFullYear(); RB26.calM = n.getMonth(); RB26.calSel = rb26DayKey(n);
  const box = rb26$id('rbcal'); if (box) box.innerHTML = rb26CalHtml();
}
function rb26CalPick(k) {
  RB26.calSel = k;
  const box = rb26$id('rbcal'); if (box) box.innerHTML = rb26CalHtml();
}

function rb26WeekBars() {
  const a = rb26Act(), w = (typeof v21Week === 'function' ? v21Week(a) : []);
  const max = Math.max(1, ...w.map(function (x) { return x.n; }));
  return w.map(function (x) {
    const h = Math.max(4, Math.round(x.n / max * 100));
    return '<div class="v21-bar" title="' + x.n + ' soal"><i style="height:' + h + '%"></i><span>' + x.lbl + '</span></div>';
  }).join('');
}

function pBeranda() {
  const a = rb26Act();
  const st = (typeof v21Streak === 'function' ? v21Streak(a) : 0);
  const tg = (typeof v21Target === 'function' ? v21Target() : 20);
  const today = (typeof v21Today === 'function' ? v21Today(a) : { n: 0, ok: 0 });
  const days = Object.values(a.days || {});
  const sum = days.reduce(function (s, x) { return s + (+x.n || 0); }, 0);
  const ok = days.reduce(function (s, x) { return s + (+x.ok || 0); }, 0);
  const acc = sum ? Math.round(ok / sum * 100) : 0;
  const pct = Math.min(100, Math.round((today.n || 0) / Math.max(1, tg) * 100));
  const cal = rb26CalData();
  const best = a.best || st;

  $('pane').innerHTML =
    '<div class="card rb-hero"><div class="rb-hero-main">'
      + '<div class="rb-hero-copy"><div class="rb-eyebrow">Beranda</div>'
      + '<h2>' + (today.n >= tg ? 'Target hari ini tercapai ' : 'Selamat datang, ' + rb26Safe(rb26FirstName()) + ' ') + '</h2>'
      + '<div class="rb-note">' + (today.n >= tg ? 'Konsistensi terjaga. Lanjutkan dengan tryout atau ulangi soal yang salah.' : 'Sisakan ' + Math.max(0, tg - today.n) + ' soal lagi untuk menutup target hari ini.') + '</div>'
      + '<div class="rb-kpis">'
        + '<div class="rb-kpi"><b> ' + st + '</b><span>streak hari</span></div>'
        + '<div class="rb-kpi"><b> ' + rb26Num(a.xp || 0) + '</b><span>XP</span></div>'
        + '<div class="rb-kpi"><b> ' + acc + '%</b><span>akurasi total</span></div>'
        + '<div class="rb-kpi"><b> ' + cal.active + '</b><span>hari aktif bulan ini</span></div>'
      + '</div></div>'
      + '<div class="ring" style="--p:' + pct + '" aria-label="Target harian ' + pct + '%"><div class="ring-in"><b>' + today.n + '</b><span>/' + tg + '</span></div></div>'
    + '</div>'
    + '<div class="rb-actions">'
      + '<button class="btn" onclick="v21Go(\'latihan\')">🎯 Latihan</button>'
      + '<button class="btn alt" onclick="v21Go(\'tryout\')">📝 Tryout</button>'
      + '<button class="btn alt" onclick="v21Go(\'soal\')">📘 Belajar Soal</button>'
      + '<button class="btn alt" onclick="v21Go(\'tutor\')">💬 Tutor</button>'
    + '</div>'
    + '<div class="v21-target"><span>Target harian</span><select aria-label="Target harian" onchange="v21SetTarget(this.value)">'
      + [10, 20, 30, 50, 100].map(function (n) { return '<option value="' + n + '"' + (n === tg ? ' selected' : '') + '>' + n + ' soal</option>'; }).join('')
    + '</select><span style="margin-left:auto">terbaik ' + best + ' hari</span></div></div>'

    + '<div class="rb-grid">'
      + '<div class="rb-span card"><div class="rb-card-head"><h3>🗓️ Kalender belajar &amp; jam dunia</h3><span class="rb-live">real time</span></div>'
        + '<div class="rb-note" style="margin-bottom:8px">Riwayat konsistensi dari latihan yang benar-benar kamu kerjakan. Tanggal mengikuti zona waktu perangkatmu.</div>'
        + '<div id="rbcal" class="rb-calwrap">' + rb26CalHtml() + '</div>'
        + '<div style="margin-top:14px"><div class="rb-card-head"><h3 style="font-size:.94rem">🕒 Jam dunia</h3><button class="x" onclick="pKalender()">Detail ›</button></div>' + rb26ClocksHtml() + '</div>'
      + '</div>'

      + '<div class="card"><div class="rb-card-head"><h3> 7 hari terakhir</h3><span class="rb-pill">' + rb26Num((typeof v21WeekSum === 'function' ? v21WeekSum(a) : 0)) + ' soal</span></div>'
        + '<div class="v21-bars">' + rb26WeekBars() + '</div>'
        + '<div class="rb-note" style="margin-top:10px">' + rb26Num(sum) + ' soal total • ' + rb26Num(ok) + ' benar • streak terbaik ' + best + ' hari</div></div>'

      + '<div class="card"><div class="rb-card-head"><h3>🏆 Peringkat</h3><button class="x" onclick="v21Go(\'papan\')">Semua ›</button></div>'
        + (typeof v21CatButtons === 'function' ? v21CatButtons() : '')
        + '<div class="rb-note rb-board-note">Soal sekolah selalu masuk kategori Sekolah, termasuk saat mode tryout.</div>'
        + '<div id="v21mini" class="mut small">Memuat...</div></div>'
    + '</div>';

  if (typeof v21MiniBoard === 'function') v21MiniBoard();
  rb26StartClocks();
}

function pKalender() {
  const a = rb26Act();
  const st = (typeof v21Streak === 'function' ? v21Streak(a) : 0);
  const cal = rb26CalData();
  const days = a.days || {};
  const keys = Object.keys(days).filter(function (k) { return days[k] && days[k].n > 0; }).sort().reverse().slice(0, 14);
  const list = keys.length ? keys.map(function (k) {
    const x = days[k];
    let label = k;
    try { label = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(rb26ParseKey(k)); } catch (e) { }
    return '<div class="item"><span>' + rb26Safe(label) + '</span><span><b>' + x.n + '</b> soal • ' + Math.round(x.ok / x.n * 100) + '%</span></div>';
  }).join('') : '<div class="rb-muted-box">Belum ada riwayat. Kerjakan latihan pertama, kalender akan terisi otomatis.</div>';

  $('pane').innerHTML =
    '<div class="card"><div class="rb-card-head"><h3>🗓️ Kalender konsistensi</h3><div style="display:flex;gap:6px"><button class="x" onclick="v21Home()">← Beranda</button><button class="x" onclick="v21Go(\'papan\')">🏆 Peringkat</button></div></div>'
      + '<div class="rb-note" style="margin-bottom:10px">Setiap kotak adalah satu hari. Warna makin terang berarti makin banyak soal yang dikerjakan.</div>'
      + '<div id="rbcal">' + rb26CalHtml() + '</div>'
      + '<div class="rb-kpis" style="margin-top:12px">'
        + '<div class="rb-kpi"><b>' + st + '</b><span>streak sekarang</span></div>'
        + '<div class="rb-kpi"><b>' + (a.best || st) + '</b><span>streak terbaik</span></div>'
        + '<div class="rb-kpi"><b>' + cal.active + '</b><span>hari aktif bulan ini</span></div>'
        + '<div class="rb-kpi"><b>' + rb26Num(cal.n) + '</b><span>soal bulan ini</span></div>'
      + '</div></div>'
    + '<div class="rb-grid">'
      + '<div class="card"><div class="rb-card-head"><h3>🕒 Jam dunia</h3><span class="rb-live">real time</span></div>' + rb26ClocksHtml()
        + '<div class="rb-note" style="margin-top:9px">Berguna untuk menyelaraskan jadwal belajar dengan sesi pasar (London/New York) atau kelas online.</div></div>'
      + '<div class="card"><div class="rb-card-head"><h3> 14 hari terakhir</h3></div>' + list + '</div>'
    + '</div>';
  rb26StartClocks();
}

/* ==========================================================================
   PAPAN PERINGKAT
   ========================================================================== */
function v21CatButtons() {
  const cats = (typeof V21_CATS !== 'undefined') ? V21_CATS : [['s', ' Sekolah'], ['t', ' TKA / UTBK'], ['u', ' Umum']];
  return '<div class="v21-cats">' + cats.map(function (x) {
    return '<button type="button" class="' + (v21BoardCat === x[0] ? 'on' : '') + '" onclick="v21Cat(\'' + x[0] + '\')">' + x[1] + '</button>';
  }).join('') + '</div>';
}
async function pPapan() {
  const req = ++v21PapanReq;
  const label = (typeof v21CatLabel === 'function' ? v21CatLabel(v21BoardCat) : 'Sekolah');
  $('pane').innerHTML = '<div class="card"><div class="rb-card-head"><h3>🏆 Peringkat ' + rb26Safe(label) + '</h3>'
    + '<div style="display:flex;gap:6px"><button class="x" onclick="v21Home()">← Beranda</button><button class="x" onclick="pPapan()">Tutup</button></div></div>'
    + '<div class="rb-note">Diurutkan dari jumlah jawaban benar. Setiap akun Google aktif otomatis masuk peringkat.</div>'
    + v21CatButtons()
    + '<div id="v21board" class="mut small rb-ranklist">Memuat...</div></div>'
    + '<div class="card"><h3>📊 Statistikku</h3><div id="v21mine" class="mut small">Memuat...</div></div>';

  const a = rb26Act(), st = (typeof v21Streak === 'function' ? v21Streak(a) : 0), t = (typeof v21Today === 'function' ? v21Today(a) : { n: 0, ok: 0 });
  const days = Object.values(a.days || {}), sum = days.reduce(function (s, x) { return s + (+x.n || 0); }, 0), ok = days.reduce(function (s, x) { return s + (+x.ok || 0); }, 0);
  const mine = $('v21mine');
  if (mine) mine.innerHTML = '<div class="item"><span>🔥 Streak</span><b>' + st + ' hari</b></div>'
    + '<div class="item"><span>⚡ XP</span><b>' + rb26Num(a.xp || 0) + '</b></div>'
    + '<div class="item"><span>📅 Hari ini</span><b>' + t.n + ' / ' + (typeof v21Target === 'function' ? v21Target() : 20) + ' soal</b></div>'
    + '<div class="item"><span> 7 hari</span><b>' + (typeof v21WeekSum === 'function' ? v21WeekSum(a) : 0) + ' soal</b></div>'
    + '<div class="item"><span>✅ Akurasi total</span><b>' + (sum ? Math.round(ok / sum * 100) : 0) + '%</b></div>';

  const all = await v21BoardList(250, v21BoardCat), b = $('v21board');
  if (req !== v21PapanReq || !b || !b.isConnected) return;
  if (!all) { b.innerHTML = '<div class="warn">Belum bisa memuat papan peringkat. Pastikan aturan Firestore terbaru sudah dipasang.</div>'; return; }
  const l = all.slice(0, 50), me = user && user.uid, mineRow = all.find(function (x) { return x.uid === me; });
  if (mine && mineRow) {
    const ms = v21Stat(mineRow, v21BoardCat);
    mine.insertAdjacentHTML('afterbegin', '<div class="item"><span>' + rb26Safe(label) + '</span><b>✅ ' + ms.b + ' benar • ❌ ' + ms.s + ' salah</b></div>');
  }
  if (!l.length) { b.innerHTML = '<div class="mut small">Belum ada peserta.</div>'; return; }
  b.innerHTML = l.map(function (x, i) {
    const s = v21Stat(x, v21BoardCat);
    return '<div class="v21-rank ' + (x.uid === me ? 'me' : '') + '"><span class="v21-pos">' + (i < 3 ? ['', '', ''][i] : i + 1) + '</span>'
      + '<div class="v21-nm">' + rb26Safe(x.nama || 'Siswa') + (x.uid === me ? ' <i>(kamu)</i>' : '')
      + '<div class="v21-stat">✅ <b>' + s.b + '</b> benar • ❌ <b>' + s.s + '</b> salah • ' + v21Acc(s) + '%</div>'
      + '<div class="mut small"> ' + (x.streak || 0) + ' hari • ' + (x.minggu || 0) + ' soal/7 hari</div></div>'
      + '<span class="v21-xp">' + rb26Num(x.xp || 0) + '<div class="mut small">XP</div></span></div>';
  }).join('');
}

/* ==========================================================================
   TUTOR AI — FOKUS PELAJARAN
   Mesin lokal selalu tersedia (tanpa server), server AI dipakai lebih dulu
   bila tersedia. Jadi fitur AI tidak pernah "mati".
   ========================================================================== */
const RB26_KB = {
  'Matematika': [
    { k: ['pecahan', 'fraksi', 'pembilang', 'penyebut'], t: 'Pecahan', d: 'Pecahan menyatakan bagian dari keseluruhan: a/b berarti a bagian dari b bagian yang sama besar.', s: ['Samakan penyebut sebelum menjumlah atau mengurang.', 'Kalikan pembilang dan penyebut saat mengalikan.', 'Untuk membagi, balik pecahan kedua lalu kalikan.', 'Sederhanakan hasil dengan FPB.'], ex: '3/4 + 1/8 = 6/8 + 1/8 = 7/8.', tip: 'Jebakan tersering: menjumlahkan penyebut (3/4 + 1/8 bukan 4/12).' },
    { k: ['persamaan kuadrat', 'kuadrat', 'diskriminan', 'akar'], t: 'Persamaan kuadrat', d: 'Bentuk ax² + bx + c = 0 dengan a ≠ 0. Penyelesaiannya bisa pemfaktoran, melengkapkan kuadrat, atau rumus abc.', s: ['Susun ke bentuk ax² + bx + c = 0.', 'Coba pemfaktoran (cari dua bilangan berjumlah b dan berkali c).', 'Bila sulit, pakai x = (−b ± √(b² − 4ac)) / 2a.', 'Periksa diskriminan D = b² − 4ac untuk jumlah akar.'], ex: 'x² − 5x + 6 = 0 → (x − 2)(x − 3) = 0 → x = 2 atau x = 3.', tip: 'D > 0 dua akar real, D = 0 satu akar kembar, D < 0 tidak ada akar real.' },
    { k: ['peluang', 'probabilitas', 'kombinasi', 'permutasi'], t: 'Peluang', d: 'Peluang kejadian = banyak hasil yang diinginkan ÷ banyak semua hasil yang mungkin (bila tiap hasil sama mungkin).', s: ['Tentukan ruang sampel dengan cermat.', 'Hitung kejadian yang diminta.', 'Bagi dan sederhanakan.', 'Untuk kejadian saling lepas, jumlahkan peluangnya.'], ex: 'Dua dadu: peluang jumlah 7 = 6/36 = 1/6.', tip: 'Baca kata "atau" (dijumlah) dan "dan" (dikali bila bebas).' },
    { k: ['statistika', 'rata-rata', 'median', 'modus', 'simpangan'], t: 'Statistika dasar', d: 'Rata-rata = jumlah data ÷ banyak data. Median = nilai tengah setelah diurutkan. Modus = data paling sering.', s: ['Urutkan data lebih dulu.', 'Hitung rata-rata bila data lengkap.', 'Median: ambil tengah, atau rata-rata dua tengah untuk data genap.', 'Periksa apakah ada pencilan yang menggeser rata-rata.'], ex: 'Data 2, 4, 4, 6, 9 → rata-rata 5, median 4, modus 4.', tip: 'Rata-rata sensitif terhadap nilai ekstrem; median lebih tahan.' },
    { k: ['fungsi', 'relasi', 'domain', 'kodomain', 'grafik'], t: 'Fungsi', d: 'Fungsi memetakan setiap anggota domain ke tepat satu nilai di kodomain.', s: ['Tentukan domain yang boleh.', 'Substitusikan nilai x.', 'Gambar titik bantu untuk melihat bentuk grafik.', 'Periksa titik potong sumbu dan titik puncak (kuadrat).'], ex: 'f(x) = 2x + 1 → f(3) = 7.', tip: 'Satu x tidak boleh punya dua hasil berbeda.' },
    { k: ['trigonometri', 'sinus', 'cosinus', 'tangens', 'sudut'], t: 'Trigonometri', d: 'Perbandingan sisi segitiga siku-siku: sin = depan/miring, cos = samping/miring, tan = depan/samping.', s: ['Gambar segitiga dan tandai sudut acuan.', 'Pilih perbandingan sesuai sisi yang diketahui dan dicari.', 'Substitusi dan hitung.', 'Periksa kuadran bila sudut > 90°.'], ex: 'Sudut 30°, sisi depan 5 → miring = 5 / sin 30° = 10.', tip: 'Hafalkan sin 30°, 45°, 60° beserta cos dan tan-nya.' }
  ],
  'IPA': [
    { k: ['hukum newton', 'newton', 'gaya', 'gerak'], t: 'Hukum Newton', d: 'Hukum I: benda tetap diam/gerak lurus bila resultan gaya nol. Hukum II: F = m·a. Hukum III: aksi = reaksi.', s: ['Gambar diagram gaya (gaya normal, berat, gesek, tarik).', 'Jumlahkan gaya searah, kurangi yang berlawanan.', 'Gunakan F = m·a dengan satuan SI.', 'Periksa satuan hasil (newton).'], ex: 'm = 2 kg, F = 10 N → a = 5 m/s².', tip: 'Berat (w = m·g) dan massa berbeda; g ≈ 9,8 m/s².' },
    { k: ['energi', 'usaha', 'daya', 'kinetik', 'potensial'], t: 'Energi, usaha, daya', d: 'Usaha = gaya × perpindahan searah. Energi kinetik = ½mv². Energi potensial = mgh. Daya = usaha ÷ waktu.', s: ['Tentukan besaran yang diketahui.', 'Pilih rumus sesuai jenis energi.', 'Substitusi dengan satuan SI.', 'Periksa kekekalan energi bila tanpa gesekan.'], ex: 'm = 1 kg, v = 4 m/s → Ek = 8 J.', tip: 'Satuan usaha dan energi sama (joule).' },
    { k: ['fotosintesis', 'klorofil', 'tumbuhan', 'respirasi'], t: 'Fotosintesis', d: 'Tumbuhan mengubah CO₂ + H₂O + cahaya menjadi glukosa + O₂ dengan bantuan klorofil.', s: ['Tulis persamaan: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.', 'Sebut tempat: kloroplas.', 'Bedakan dengan respirasi sel (kebalikannya).', 'Hubungkan dengan faktor cahaya, suhu, air.'], ex: 'Cahaya rendah → laju fotosintesis turun karena energi tidak cukup.', tip: 'Fotosintesis menyimpan energi; respirasi melepaskannya.' },
    { k: ['tata surya', 'planet', 'matahari', 'bulan', 'rotasi', 'revolusi'], t: 'Tata surya', d: 'Matahari sebagai pusat, delapan planet: Merkurius, Venus, Bumi, Mars, Jupiter, Saturnus, Uranus, Neptunus.', s: ['Urutkan dari Matahari.', 'Bedakan rotasi (berputar pada sumbu) dan revolusi (mengelilingi Matahari).', 'Hubungkan dengan tahun dan hari.', 'Catat ciri khas tiap planet.'], ex: 'Satu revolusi Bumi ≈ 365,25 hari.', tip: 'Pluto bukan planet sejak 2006 (kategori planet katai).' },
    { k: ['sel', 'organel', 'membran', 'mitokondria'], t: 'Sel', d: 'Unit terkecil kehidupan. Bagian utama: membran sel, sitoplasma, inti. Mitokondria tempat respirasi sel.', s: ['Sebutkan bagian sel dan fungsinya.', 'Bedakan sel hewan dan tumbuhan (dinding sel, kloroplas).', 'Hubungkan struktur dengan fungsi.', 'Gunakan istilah baku.'], ex: 'Sel tumbuhan punya dinding sel dan kloroplas; sel hewan tidak.', tip: 'Inti sel menyimpan materi genetik (DNA).' },
    { k: ['listrik', 'ohm', 'arus', 'tegangan', 'hambatan'], t: 'Listrik dasar', d: 'Hukum Ohm: V = I × R. Daya listrik P = V × I.', s: ['Tentukan V, I, atau R yang diketahui.', 'Gunakan V = I·R.', 'Untuk rangkaian seri, R dijumlahkan; paralel pakai 1/Rtotal.', 'Periksa satuannya (volt, ampere, ohm).'], ex: 'V = 12 V, R = 6 Ω → I = 2 A.', tip: 'Jangan menukar arus (A) dengan tegangan (V).' }
  ],
  'IPS': [
    { k: ['proklamasi', 'kemerdekaan', '1945', 'soekarno', 'hatta'], t: 'Proklamasi 17 Agustus 1945', d: 'Dibacakan Soekarno didampingi Hatta di Jalan Pegangsaan Timur 56 Jakarta, sehari setelah Jepang menyerah kepada Sekutu.', s: ['Latar: kekosongan kekuasaan setelah Jepang menyerah.', 'Peristiwa Rengasdengklok mendorong percepatan.', 'Teks disusun di rumah Laksamana Maeda.', 'Makna: titik awal negara merdeka.'], ex: 'Naskah disusun Soekarno, Hatta, dan Ahmad Soebardjo.', tip: 'Bedakan tanggal peristiwa (17 Agustus) dengan pengakuan kedaulatan (1949).' },
    { k: ['pancasila', 'sila', 'ideologi', 'uud'], t: 'Pancasila', d: 'Dasar negara dengan lima sila, disahkan 18 Agustus 1945 bersama UUD 1945.', s: ['Sebut kelima sila berurutan.', 'Hubungkan tiap sila dengan contoh perilaku.', 'Pahami kedudukan sebagai dasar negara dan pandangan hidup.', 'Gunakan istilah resmi.'], ex: 'Sila ke-3: Persatuan Indonesia → gotong royong lintas suku.', tip: 'Pancasila bukan sekadar hafalan; ujian sering meminta penerapan.' },
    { k: ['ekonomi', 'permintaan', 'penawaran', 'inflasi', 'pasar'], t: 'Permintaan & penawaran', d: 'Harga pasar terbentuk saat jumlah barang yang diminta sama dengan yang ditawarkan.', s: ['Gambar kurva permintaan (turun) dan penawaran (naik).', 'Tentukan titik potong.', 'Analisis pergeseran bila ada faktor lain.', 'Hubungkan dengan kelangkaan.'], ex: 'Permintaan naik, penawaran tetap → harga cenderung naik.', tip: 'Bedakan pergerakan sepanjang kurva dan pergeseran kurva.' },
    { k: ['geografi', 'iklim', 'cuaca', 'letak', 'peta'], t: 'Geografi Indonesia', d: 'Indonesia terletak di antara dua benua dan dua samudra, beriklim tropis, dan berada di jalur cincin api.', s: ['Sebut letak astronomis dan geografis.', 'Hubungkan dengan iklim tropis.', 'Jelaskan dampak posisi terhadap perdagangan dan bencana.', 'Gunakan peta untuk menunjukkan lokasi.'], ex: 'Letak geografis → dua musim dan keragaman budaya.', tip: 'Iklim bersifat jangka panjang; cuaca jangka pendek.' },
    { k: ['sosiologi', 'interaksi sosial', 'norma', 'nilai', 'kelompok'], t: 'Interaksi sosial', d: 'Interaksi terjadi bila ada kontak dan komunikasi. Bentuknya kerja sama, akomodasi, persaingan, dan konflik.', s: ['Tentukan bentuk interaksi.', 'Sebut faktor pendorong (imitasi, sugesti, identifikasi, simpati).', 'Hubungkan dengan norma dan nilai.', 'Beri contoh di lingkungan sekitar.'], ex: 'Gotong royong membersihkan kelas = kerja sama.', tip: 'Konflik bukan selalu negatif; bisa memicu perubahan.' },
    { k: ['sejarah dunia', 'perang dunia', 'revolusi industri', 'renaisans'], t: 'Sejarah dunia', d: 'Perang Dunia II (1939–1945) melibatkan blok Sekutu dan Poros; berakhir dengan Jepang menyerah 1945.', s: ['Sebut penyebab jangka panjang dan pemicu.', 'Urutkan peristiwa kunci.', 'Jelaskan dampak politik, ekonomi, sosial.', 'Kaitkan dengan kemerdekaan Indonesia.'], ex: 'Menyerahnya Jepang menciptakan kekosongan kekuasaan di Indonesia.', tip: 'Hafal tahun penting, tapi utamakan hubungan sebab-akibat.' }
  ],
  'Bahasa Indonesia': [
    { k: ['kalimat efektif', 'efektif', 'kalimat'], t: 'Kalimat efektif', d: 'Kalimat efektif menyampaikan gagasan secara tepat, jelas, dan tidak berlebihan.', s: ['Pastikan ada subjek dan predikat.', 'Hindari kata mubazir (para siswa-siswa).', 'Gunakan satu gagasan utama per kalimat.', 'Periksa kesejajaran bentuk.'], ex: 'Salah: "Para siswa-siswa berbaris." Benar: "Para siswa berbaris."', tip: 'Ciri utama: tidak ambigu dan tidak boros kata.' },
    { k: ['ejaan', 'puebi', 'kbbi', 'baku', 'huruf'], t: 'Ejaan & kata baku', d: 'Ejaan mengikuti PUEBI; bentuk kata mengikuti KBBI. Kata baku dipakai dalam tulisan resmi.', s: ['Cek bentuk baku di KBBI.', 'Perhatikan huruf kapital untuk nama tempat/lembaga.', 'Gunakan tanda baca sesuai fungsi.', 'Hindari bentuk percakapan dalam tulisan formal.'], ex: 'Baku: apotek, analisis, frekuensi. Tidak baku: apotik, analisa, frekwensi.', tip: 'Kata serapan sering salah: "praktik" bukan "praktek" (kecuali konteks tertentu).' },
    { k: ['majas', 'gaya bahasa', 'metafora', 'personifikasi', 'hiperbola'], t: 'Majas', d: 'Majas adalah gaya bahasa untuk memperkuat makna: metafora, personifikasi, hiperbola, simile, dan lainnya.', s: ['Cari kata yang dipakai tidak literal.', 'Tentukan jenis majas.', 'Jelaskan makna kiasnya.', 'Hubungkan dengan suasana teks.'], ex: 'Angin berbisik → personifikasi.', tip: 'Simile memakai "seperti/bagai"; metafora langsung.' },
    { k: ['teks', 'struktur', 'paragraf', 'ide pokok', 'eksposisi', 'argumentasi'], t: 'Struktur teks & ide pokok', d: 'Ide pokok adalah gagasan utama paragraf; biasanya ada di kalimat utama (awal/akhir).', s: ['Baca seluruh paragraf.', 'Temukan kalimat umum yang dijelaskan kalimat lain.', 'Ringkas dalam satu kalimat.', 'Periksa apakah kalimat penjelas mendukungnya.'], ex: 'Paragraf tentang manfaat membaca → ide pokok "manfaat membaca".', tip: 'Ide pokok bukan kalimat penjelas yang paling panjang.' },
    { k: ['sastra', 'puisi', 'cerpen', 'novel', 'drama'], t: 'Karya sastra', d: 'Puisi padat dan berirama; cerpen memiliki satu konflik utama; novel lebih luas; drama ditulis untuk dipentaskan.', s: ['Kenali unsur intrinsik: tema, tokoh, alur, latar, amanat.', 'Temukan bukti di teks.', 'Bedakan tokoh utama dan tambahan.', 'Simpulkan amanat, bukan menebak.'], ex: 'Konflik tunggal dan selesai dalam satu bacaan → ciri cerpen.', tip: 'Amanat harus didukung peristiwa, bukan opini pribadi.' },
    { k: ['kata baku', 'imbuhan', 'awalan', 'akhiran', 'gabungan'], t: 'Imbuhan', d: 'Imbuhan mengubah makna kata: me-, ber-, ter-, di-, ke-an, -kan, -nya.', s: ['Tentukan bentuk dasar.', 'Perhatikan perubahan huruf (me- + pukul → memukul).', 'Cek makna setelah diberi imbuhan.', 'Gunakan bentuk yang sesuai kaidah.'], ex: 'me- + tulis → menulis; me- + sapu → menyapu.', tip: 'Imbuhan "di-" sebagai awalan ditulis serangkai; "di" kata depan dipisah.' }
  ],
  'Bahasa Inggris': [
    { k: ['present simple', 'simple present', 'tenses', 'verb'], t: 'Present simple', d: 'Dipakai untuk kebiasaan, fakta, dan jadwal. Pola: S + V1 (he/she/it + V1-s).', s: ['Tentukan subjek (I/you/we/they vs he/she/it).', 'Tambahkan -s/-es untuk orang ketiga tunggal.', 'Bentuk negatif: do/does + not + V1.', 'Bentuk tanya: Do/Does + S + V1?'], ex: 'She studies every night. / They do not play football.', tip: 'Jangan tambah -s dua kali (does studies → salah).' },
    { k: ['past tense', 'simple past', 'verb 2', 'lampau'], t: 'Simple past', d: 'Untuk kejadian selesai di masa lalu. Pola: S + V2 (atau did + V1 untuk negatif/tanya).', s: ['Gunakan V2 untuk kalimat positif.', 'Untuk negatif/tanya gunakan did + V1.', 'Tandai waktu: yesterday, last week, ago.', 'Hafalkan bentuk tak beraturan.'], ex: 'I went home. / I did not go home. / Did you go home?', tip: 'Setelah "did" selalu V1, bukan V2.' },
    { k: ['present perfect', 'have has', 'perfect'], t: 'Present perfect', d: 'Menghubungkan masa lalu dengan sekarang. Pola: S + have/has + V3.', s: ['Gunakan have untuk I/you/we/they; has untuk he/she/it.', 'Gunakan V3.', 'Cocok dengan since, for, already, yet, ever.', 'Bedakan dengan simple past (waktu spesifik).'], ex: 'I have finished my homework. / She has lived here for two years.', tip: '"Yesterday" cocok dengan simple past, bukan present perfect.' },
    { k: ['passive', 'passive voice', 'kalimat pasif'], t: 'Passive voice', d: 'Fokus pada objek: S + be + V3 (+ by agent).', s: ['Tentukan tenses kalimat aktif.', 'Sesuaikan bentuk "be".', 'Gunakan V3.', 'Tambahkan "by ..." bila penting.'], ex: 'Active: The teacher explains the lesson. → Passive: The lesson is explained by the teacher.', tip: 'Passive dipakai bila pelaku tidak penting atau tidak diketahui.' },
    { k: ['conditional', 'if clause', 'pengandaian'], t: 'Conditionals', d: 'Tipe 0 fakta, tipe 1 mungkin, tipe 2 tidak nyata sekarang, tipe 3 penyesalan masa lalu.', s: ['Tentukan apakah kondisinya nyata atau tidak.', 'Tipe 1: if + present, will + V1.', 'Tipe 2: if + past, would + V1.', 'Tipe 3: if + had + V3, would have + V3.'], ex: 'If it rains, I will stay home. / If I had studied, I would have passed.', tip: 'Jangan memakai "will" di klausa if tipe 1.' },
    { k: ['vocabulary', 'kata', 'arti', 'sinonim'], t: 'Vocabulary', d: 'Kuasai kata dalam konteks: arti, kelas kata, kolokasi, dan contoh kalimat.', s: ['Catat kata dalam kalimat utuh.', 'Pelajari bentuk lain (noun/verb/adjective).', 'Ulangi dengan jeda (spaced repetition).', 'Gunakan dalam tulisan sendiri.'], ex: '"improve" (verb) → "improvement" (noun).', tip: 'Menghafal daftar tanpa konteks cepat hilang.' }
  ],
  'Umum (Trivia Dunia)': [
    { k: ['indonesia', 'negara', 'asean', 'ibu kota'], t: 'Pengetahuan negara', d: 'Indonesia adalah negara kepulauan terbesar di dunia, ibu kota Jakarta, anggota ASEAN dan PBB.', s: ['Sebut fakta kunci: ibu kota, mata uang, bahasa, kawasan.', 'Cek tahun data karena jumlah penduduk berubah.', 'Gunakan sumber resmi (PBB, Bank Dunia, BPS).', 'Bedakan negara dan wilayah.'], ex: 'Indonesia berbatasan darat dengan Malaysia, Papua Nugini, dan Timor Leste.', tip: 'Data populasi selalu ditulis "per tahun" agar tidak menyesatkan.' },
    { k: ['tata surya', 'planet', 'antariksa', 'nasa'], t: 'Antariksa', d: 'Tata surya memiliki delapan planet; Matahari adalah bintang deret utama.', s: ['Urutkan objek dari Matahari.', 'Bedakan planet, planet katai, asteroid, komet.', 'Gunakan satuan jarak yang tepat (AU, tahun cahaya).', 'Sebut sumber (NASA/ESA) untuk misi baru.'], ex: 'Jarak Bumi–Matahari ≈ 1 AU ≈ 149,6 juta km.', tip: 'Cahaya Matahari butuh ±8 menit sampai Bumi.' },
    { k: ['pbb', 'un', 'organisasi', 'dunia', 'who'], t: 'Organisasi dunia', d: 'PBB berdiri 1945; WHO menangani kesehatan; UNESCO pendidikan dan budaya; UNICEF anak.', s: ['Sebut nama lengkap dan tahun berdiri.', 'Jelaskan mandat utama.', 'Bedakan organisasi PBB dan organisasi regional.', 'Gunakan sumber resmi.'], ex: 'WHO berpusat di Jenewa, Swiss.', tip: 'Jangan mencampur mandat WHO (kesehatan) dan UNICEF (anak).' },
    { k: ['iklim', 'lingkungan', 'pemanasan global', 'emisi'], t: 'Perubahan iklim', d: 'Pemanasan global disebabkan peningkatan gas rumah kaca, terutama CO₂ dari bahan bakar fosil.', s: ['Bedakan cuaca dan iklim.', 'Sebut penyebab utama dan dampak.', 'Hubungkan dengan sumber energi.', 'Rujuk IPCC/NOAA/WMO untuk angka.'], ex: 'Suhu global rata-rata naik sekitar 1,1–1,3 °C dibanding era praindustri.', tip: 'Gunakan data terbaru; angka iklim diperbarui berkala.' },
    { k: ['sejarah', 'peradaban', 'mesir', 'romawi'], t: 'Peradaban kuno', d: 'Mesir Kuno berkembang di lembah Sungai Nil; Romawi meninggalkan sistem hukum dan infrastruktur.', s: ['Sebut lokasi dan rentang waktu.', 'Hubungkan dengan sumber daya alam (sungai).', 'Sebut peninggalan utama.', 'Jelaskan pengaruhnya sampai sekarang.'], ex: 'Piramida Giza dibangun sebagai makam firaun.', tip: 'Urutkan peradaban berdasarkan periode, bukan hafalan acak.' },
    { k: ['teknologi', 'internet', 'ai', 'kecerdasan buatan'], t: 'Teknologi', d: 'Internet menghubungkan jaringan komputer global; AI adalah sistem yang meniru kemampuan kognitif manusia pada tugas tertentu.', s: ['Definisikan istilah secara tepat.', 'Bedakan AI sempit dan AI umum.', 'Sebut manfaat dan risikonya.', 'Rujuk sumber resmi (IEEE, ISO, UNESCO).'], ex: 'Sistem rekomendasi adalah contoh AI sempit.', tip: 'AI tidak "berpikir" seperti manusia; ia menemukan pola dari data.' }
  ],
  'Trading': [
    { k: ['order block', 'ob', 'blok order'], t: 'Order block (OB)', d: 'Order block adalah candle berlawanan terakhir sebelum pergerakan impulsif yang memecah struktur.', s: ['Tentukan struktur dan arah dulu.', 'Cari candle berlawanan terakhir sebelum impuls.', 'Tandai body candle sebagai zona (bukan hanya wick).', 'Tunggu harga kembali dan bereaksi; jangan entry buta.'], ex: 'OB bullish = candle bearish terakhir sebelum naik impulsif memecah high sebelumnya.', tip: 'OB tanpa penyerapan likuiditas dan tanpa struktur sering gagal.' },
    { k: ['fvg', 'fair value gap', 'imbalance', 'ketidakseimbangan'], t: 'Fair value gap (FVG)', d: 'FVG adalah celah tiga candle karena harga bergerak terlalu cepat sehingga ada area yang tidak diperdagangkan.', s: ['Cari tiga candle dengan celah antara high candle-1 dan low candle-3 (bullish).', 'Tandai celah sebagai zona ketertarikan.', 'Tunggu harga kembali untuk rebalance.', 'Gunakan LTF untuk konfirmasi reaksi.'], ex: 'Celah antara high candle pertama dan low candle ketiga = FVG bullish.', tip: 'FVG di TF besar jauh lebih kuat daripada FVG kecil di M1.' },
    { k: ['likuiditas', 'liquidity', 'sweep', 'stop hunt'], t: 'Likuiditas & sweep', d: 'Likuiditas adalah kumpulan stop dan order di atas high atau di bawah low yang sudah jelas.', s: ['Tandai high/low yang terlihat semua trader.', 'Tunggu harga menyapu level itu (sweep).', 'Cari perubahan struktur setelah sapuan.', 'Entry pada zona POI yang ditinggalkan.'], ex: 'Sapu low Asia lalu naik cepat = liquidity grab bullish.', tip: 'Jangan mengejar harga tepat saat sweep; tunggu konfirmasi.' },
    { k: ['risiko', 'lot', 'position size', 'stop loss', 'rr'], t: 'Manajemen risiko', d: 'Ukuran posisi dihitung dari risiko nominal dibagi jarak stop, bukan dari feeling.', s: ['Tentukan risiko per trade (mis. 1% ekuitas).', 'Ukur jarak stop dalam pip/poin.', 'Hitung lot: risiko ÷ (stop × nilai pip per lot).', 'Pastikan RR minimal 1:2 dan risiko harian dibatasi.'], ex: 'Akun $1.000, risiko 1% = $10; stop 25 pip XAU ≈ $2,5/lot → 0,04 lot.', tip: 'Risiko 1–2% per trade; berhenti setelah 2–3 kerugian beruntun.' },
    { k: ['sesi', 'killzone', 'london', 'new york', 'waktu'], t: 'Sesi pasar', d: 'Likuiditas tertinggi saat sesi London dan New York, terutama saat tumpang tindih.', s: ['Gunakan WIB sebagai acuan.', 'London 14:00–23:00, New York 19:00–04:00.', 'Killzone London 14:00–17:00, New York 19:00–22:00.', 'Hindari entry beberapa menit sebelum rilis berita besar.'], ex: 'Overlap London–New York (19:00–23:00 WIB) = likuiditas tertinggi.', tip: 'Sesi Asia cenderung membentuk range; jangan paksa entry besar.' },
    { k: ['crt', 'candle range', 'range theory'], t: 'Candle Range Theory (CRT)', d: 'CRT memakai range candle periode sebelumnya (high–low) sebagai area manipulasi dan target.', s: ['Tandai high/low candle sebelumnya (D1/H4).', 'Tunggu harga menyapu salah satu sisi range.', 'Cari konfirmasi perubahan struktur di LTF.', 'Target sisi berlawanan dari range.'], ex: 'Sapuan low D1 lalu MSS bullish M15 → target high D1.', tip: 'Range weekend/berita besar kurang valid untuk CRT.' }
  ]
};

function rb26Norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function rb26Topic(mapel, q) {
  let list = RB26_KB[mapel];
  if (!list && mapel === 'Trading') list = RB26_KB['Trading'];
  if (!list) list = RB26_KB['Umum (Trivia Dunia)'];
  const t = ' ' + rb26Norm(q) + ' ';
  let best = null, score = 0;
  list.forEach(function (x) {
    let s = 0;
    x.k.forEach(function (k) { if (t.indexOf(' ' + rb26Norm(k)) >= 0) s += k.length > 5 ? 3 : 2; });
    if (s > score) { score = s; best = x; }
  });
  return best;
}
function rb26BankMatch(mapel, q) {
  const bank = (S && Array.isArray(S.bank)) ? S.bank : [];
  if (!bank.length) return null;
  const words = rb26Norm(q).split(' ').filter(function (w) { return w.length > 3; }).slice(0, 8);
  if (!words.length) return null;
  let best = null, score = 0;
  bank.forEach(function (x) {
    const tx = rb26Norm(x.q);
    let s = 0; words.forEach(function (w) { if (tx.indexOf(w) >= 0) s++; });
    if (s > score) { score = s; best = x; }
  });
  return score >= 2 ? best : null;
}
function rb26AnswerKey(x) {
  if (!x) return '';
  if (x.tipe === 'essay') return String(x.k || '').slice(0, 400);
  if (Array.isArray(x.a)) return x.a.map(function (i) { return String.fromCharCode(65 + i) + '. ' + (x.o[i] || ''); }).join(' | ');
  if (typeof x.a === 'number') return String.fromCharCode(65 + x.a) + '. ' + ((x.o && x.o[x.a]) || '');
  return '';
}
function rb26LocalAnswer(mapel, question, reason) {
  const q = String(question || '').trim();
  const out = [];
  if (!q) return 'Tulis pertanyaanmu dulu.';
  if (/^(hi|hai|halo|hello|pagi|siang|malam|assalam|salam)\b/i.test(q) && q.length < 40) {
    return 'Halo! Aku **Tutor ' + rb26Safe(mapel) + '**. Tanyakan materi yang sedang kamu pelajari, minta contoh soal, atau minta langkah penyelesaiannya. Fokusku hanya pada ' + rb26Safe(mapel) + '.';
  }
  const top = rb26Topic(mapel, q);
  const bank = rb26BankMatch(mapel, q);
  const offline = '<div class="rb-offline"> mode lokal</div>';
  void offline;

  if (bank) {
    out.push('**Soal serupa dari bank soalmu**');
    out.push('> ' + String(bank.q || '').slice(0, 500));
    const key = rb26AnswerKey(bank);
    if (key) out.push('**Kunci:** ' + key);
    if (bank.e) out.push('**Pembahasan tersimpan:** ' + String(bank.e).slice(0, 900));
    out.push('');
  }
  if (top) {
    out.push('**' + top.t + '**');
    out.push(top.d);
    out.push('**Langkah belajar:**');
    top.s.forEach(function (x, i) { out.push((i + 1) + '. ' + x); });
    out.push('**Contoh:** ' + top.ex);
    out.push('**Tips:** ' + top.tip);
  }
  if (!top && !bank) {
    out.push('**Fokus: ' + rb26Safe(mapel) + '**');
    out.push('Pertanyaanmu belum cocok dengan topik yang ada di materi lokal. Supaya tetap produktif, pakai alur ini:');
    out.push('1. Tuliskan apa yang sudah diketahui dan apa yang dicari.');
    out.push('2. Sebutkan rumus/kaidah yang mungkin dipakai.');
    out.push('3. Kerjakan satu langkah, lalu periksa ulang.');
    out.push('4. Bandingkan dengan pembahasan soal serupa di tab ** Belajar Soal**.');
    out.push('');
    out.push('Kamu juga bisa memilih topik cepat: ' + ((RB26_KB[mapel] || RB26_KB['Umum (Trivia Dunia)']).slice(0, 4).map(function (x) { return '**' + x.t + '**'; }).join(', ')) + '.');
  }
  if (reason) out.push('\n_AI server belum bisa dihubungi (' + String(reason).slice(0, 140) + '). Jawaban ini disusun dari materi Ruang Belajar, bukan dari internet._');
  return out.join('\n');
}
function rb26ExplainQuestion(q, pick) {
  const mapel = (q && q.mapel) || S.mapel;
  const parts = [];
  const top = q ? rb26Topic(mapel, (q.q || '') + ' ' + (q.teks || '')) : null;
  if (top) {
    parts.push('**Konsep: ' + top.t + '**');
    parts.push(top.d);
    parts.push('**Cara berpikir:**');
    top.s.forEach(function (x, i) { parts.push((i + 1) + '. ' + x); });
  }
  if (q) {
    const key = rb26AnswerKey(q);
    if (key) parts.push('**Kunci jawaban:** ' + key);
    if (q.e) parts.push('**Pembahasan:** ' + q.e);
    if (pick != null && pick !== '' && !Array.isArray(pick)) {
      const idx = typeof pick === 'number' ? pick : -1;
      if (idx >= 0 && q.o && q.o[idx] != null) {
        const isRight = Array.isArray(q.a) ? q.a.indexOf(idx) >= 0 : idx === q.a;
        parts.push('**Jawabanmu:** ' + String.fromCharCode(65 + idx) + '. ' + q.o[idx] + (isRight ? ' — sudah benar.' : ' — belum tepat.'));
      }
    }
    if (q.teks) parts.push('_Baca ulang teksnya, lalu hubungkan gagasan utama dengan pilihan jawaban._');
  }
  if (!parts.length) return rb26LocalAnswer(mapel, S.qs && S.qs[S.i] ? S.qs[S.i].q : '');
  parts.push('_Dijelaskan dari materi Ruang Belajar._');
  return parts.join('\n');
}
function rb26LocalGrade(q, text, reason) {
  const t = rb26Norm(text), kws = (q.kw || []).map(rb26Norm).filter(Boolean);
  let hit = 0;
  kws.forEach(function (k) { if (k && t.indexOf(k) >= 0) hit++; });
  const base = kws.length ? Math.round(hit / kws.length * 100) : (t.length > 60 ? 55 : 35);
  const lenBonus = Math.min(15, Math.floor(t.split(' ').length / 12));
  const sc = Math.max(0, Math.min(100, base + lenBonus));
  const missing = (q.kw || []).filter(function (k) { return t.indexOf(rb26Norm(k)) < 0; });
  let fb = 'Penilaian lokal (tanpa server). ';
  if (sc >= 80) fb += 'Jawaban memuat hampir semua gagasan kunci.';
  else if (sc >= 60) fb += 'Gagasan utama sudah ada, tetapi beberapa bagian perlu dilengkapi.';
  else fb += 'Jawaban belum memuat cukup gagasan kunci.';
  if (missing.length) fb += '\nBelum disebut: ' + missing.slice(0, 5).join(', ') + '.';
  if (q.k) fb += '\nAcuan kunci: ' + String(q.k).slice(0, 500);
  if (reason) fb += '\n_Catatan: ' + String(reason).slice(0, 120) + '_';
  return { sc: sc, fb: fb };
}

/* ---- jembatan server AI: gagal → mesin lokal ---- */
async function tutorCall18(mapel, messages, o) {
  o = o || {};
  if (!user) { const e = new Error('Belum login'); e.rbLocal = true; throw e; }
  const tk = await user.getIdToken(), ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 75000);
  let r;
  const level = S.sec === 'trading' ? 'Umum' : (o.level || (typeof tutorLevel18 === 'function' ? tutorLevel18() : 'Umum'));
  try {
    r = await fetch('/api/chat', {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ action: 'tutor', mapel: mapel, level: level, mode: o.mode || 'chat', verify: o.verify !== false, messages: messages.slice(-12).map(function (m) { return { role: m.role, content: m.content }; }) })
    });
  } catch (e) {
    const er = new Error(e && e.name === 'AbortError' ? 'waktu habis' : String(e && e.message || e));
    er.rbLocal = true; throw er;
  } finally { clearTimeout(to); }
  let j = null;
  try { j = await r.json(); } catch (e) { }
  if (!r.ok || !j || !j.text) {
    const er = new Error((j && j.error) || ('server membalas ' + r.status));
    er.rbLocal = true; throw er;
  }
  return j;
}
async function send() {
  const inp = $('ci');
  const v = ((inp || {}).value || '').trim();
  if (!v) return;
  if (inp) inp.value = '';
  const c = S.chat[S.mapel] = S.chat[S.mapel] || [];
  c.push({ role: 'user', content: v }, { role: 'assistant', content: '⏳ Menyiapkan jawaban untuk ' + S.mapel + '...' });
  drawChat();
  let h = c.slice(0, -1).filter(function (m) { return !/^(⚠️|⏳)/.test(m.content); }).slice(-12);
  while (h.length && h[0].role !== 'user') h.shift();
  const slot = c[c.length - 1];
  try {
    const j = await tutorCall18(S.mapel, h, { verify: (typeof tutorVerify18 === 'function' ? tutorVerify18() : true) });
    slot.content = j.text;
    slot.meta = (typeof metaOf18 === 'function' ? metaOf18(j) : null);
    RB26.online = true;
  } catch (e) {
    slot.content = rb26LocalAnswer(S.mapel, v, e && e.message);
    slot.meta = { local: true };
    RB26.online = false;
  }
  if ($('chat')) drawChat();
  try { if (user && typeof saveChat === 'function') await saveChat(); } catch (e) { }
}
async function explainAI(prompt) {
  try {
    const j = await tutorCall18(S.mapel, [{ role: 'user', content: String(prompt) }], { mode: 'explain', verify: true });
    let t = j.text;
    const cs = (j.sources || []).filter(function (s) { return (j.cited || []).indexOf(s.n) >= 0 && /^https?:\/\//.test(s.uri); }).slice(0, 3);
    if (cs.length) t += '\n\n Sumber: ' + cs.map(function (s) { return '[[' + String(s.title).replace(/[|\]]/g, ' ').slice(0, 60) + '|' + s.uri + ']]'; }).join(' • ');
    return t;
  } catch (e) {
    const q = S.qs && S.qs[S.i];
    return rb26ExplainQuestion(q, S.sel ? S.sel[S.i] : null) + '\n\n_AI server tidak tersedia (' + String(e && e.message || e).slice(0, 120) + '). Penjelasan disusun dari materi dan pembahasan yang tersimpan._';
  }
}
async function gradeEssay(q, text) {
  const clean = String(text || '').trim();
  if (!clean) return { sc: 0, fb: 'Tidak ada jawaban.' };
  try {
    const t = await ai('Kamu penilai essay ' + S.mapel + '. ' + (isEng() ? 'Write the feedback in English.' : 'Tulis umpan balik dalam Bahasa Indonesia.') + ' Nilai jawaban siswa terhadap kunci dan kata kunci; jawaban benar dengan kata berbeda tetap diterima. Format WAJIB:\nSKOR: <angka 0-100>\nSudah tepat: ...\nKurang/keliru: ...\nSaran: ...',
      [{ role: 'user', content: 'Soal: ' + q.q + '\n' + (q.teks ? 'Teks: ' + q.teks.slice(0, 1500) + '\n' : '') + 'Kunci jawaban: ' + q.k + '\nKata kunci: ' + (q.kw || []).join(', ') + '\nRubrik: ' + (q.e || '-') + '\nJawaban siswa: ' + clean }], false, false, '', undefined, { temp: 0.2 });
    const m = t.match(/SKOR:\s*(\d{1,3})/i);
    return { sc: m ? Math.min(100, +m[1]) : 0, fb: t.replace(/SKOR:\s*\d{1,3}/i, '').trim() };
  } catch (e) {
    return rb26LocalGrade(q, clean, e && e.message);
  }
}
function drawChat() {
  const box = $('chat');
  if (!box) return;
  const c = S.chat[S.mapel] || [];
  const st = (typeof STARTERS18 !== 'undefined' && STARTERS18[S.mapel]) || (typeof TOPICS !== 'undefined' && TOPICS[S.mapel] && TOPICS[S.mapel].length ? TOPICS[S.mapel].slice(0, 3).map(function (t) { return 'Jelaskan ' + t + ' dengan contoh praktik'; }) : ['Jelaskan konsep dasar materi ini dengan contoh']);
  box.innerHTML = c.length ? c.map(function (m) {
    let meta = '';
    if (m.role === 'assistant' && m.meta) {
      meta = m.meta.local
        ? '<div class="small mut" style="margin-top:8px">💬 Tutor lokal · materi &amp; bank soalmu</div>'
        : (typeof metaHtml18 === 'function' ? metaHtml18(m.meta) : '');
    }
    return '<div class="msg ' + m.role + '">' + fmt(m.content) + meta + '</div>';
  }).join('') : '<div class="mut small">Tanyakan apa saja tentang <b>' + rb26Safe(S.mapel) + '</b>. Tutor menjawab dengan sumber tepercaya dan memeriksa jawabannya.</div>'
    + '<div class="rb-suggest">' + st.map(function (t, i) {
      return '<button class="x" type="button" style="text-align:left" onclick="starter18(' + i + ')">' + rb26Safe(t) + '</button>';
    }).join('') + '</div>';
  box.scrollTop = 1e9;
}
async function pTutor() {
  const trade = S.sec === 'trading';
  const lv = (typeof tutorLevel18 === 'function' ? tutorLevel18() : 'Umum');
  const vf = (typeof tutorVerify18 === 'function' ? tutorVerify18() : true);
  const verSel = '<div><label>Pemeriksaan jawaban</label><select onchange="tverSet18(this.value)"><option value="1" ' + (vf ? 'selected' : '') + '>Teliti (periksa silang)</option><option value="0" ' + (vf ? '' : 'selected') + '>Cepat</option></select></div>';
  const lvSel = trade ? '' : '<div><label>Tingkat penjelasan</label><select onchange="tlvSet18(this.value)">' + (typeof LV18 !== 'undefined' ? LV18 : ['SD', 'SMP', 'SMA', 'TKA / UTBK', 'Umum']).map(function (x) { return '<option ' + (x === lv ? 'selected' : '') + '>' + rb26Safe(x) + '</option>'; }).join('') + '</select></div>';
  const alch = trade ? '<button class="btn alt" style="margin-top:8px" onclick="S.tab=\'alchemist\';home()">📘 Buka materi Strategi Alchemist</button>' : '';
  $('pane').innerHTML = '<div class="card"><h3>💬 Tutor ' + rb26Safe(S.mapel) + '</h3>'
    + '<div class="rb-focus"><span class="chip"> Fokus: ' + rb26Safe(S.mapel) + '</span><span class="chip"> Materi + bank soal</span><span class="chip"> Server AI bila tersedia</span></div>'
    + '<div class="row">' + lvSel + verSel + '</div>'
    + '<div id="chat" style="margin-top:10px"></div>'
    + '<div class="rb-chatbar"><input id="ci" placeholder="' + (trade ? 'Tanya konsep trading, sesi, atau strategi...' : 'Tanya materi, minta contoh, atau minta langkah penyelesaian...') + '" onkeydown="if(event.key===\'Enter\')send2()"><button class="btn" onclick="send2()">Kirim</button></div>'
    + '<div class="rb-suggest" style="margin-top:8px"><button class="x" type="button" onclick="rb26Quick(\'ringkas\')">✨ Ringkas materi</button><button class="x" type="button" onclick="rb26Quick(\'contoh\')"> Contoh soal</button><button class="x" type="button" onclick="rb26Quick(\'langkah\')">🧭 Langkah penyelesaian</button></div>'
    + alch
    + '<button class="btn alt full" style="margin-top:8px" onclick="S.chat[S.mapel]=[];drawChat();if(user)saveChat()">🗑️ Hapus percakapan</button>'
    + '<div class="rb-ai-note">' + (trade
      ? 'Tutor Trading memakai data pasar tervalidasi bila server AI aktif. Bila server belum dikonfigurasi, tutor menjawab dari materi Alchemist/risiko di aplikasi ini. Edukasi, bukan saran finansial.'
      : 'Tutor fokus pada ' + rb26Safe(S.mapel) + '. Jika server AI belum aktif, jawaban disusun dari materi Ruang Belajar dan bank soalmu sehingga fitur tetap bisa dipakai.')
    + '</div></div>';
  if (!S.chat[S.mapel]) {
    S.chat[S.mapel] = [];
    try {
      const d = await db.collection('chat').doc(chatId()).get();
      if (d.exists) S.chat[S.mapel] = d.data().msgs || [];
    } catch (e) { }
  }
  if ($('chat')) drawChat();
}
function rb26Quick(kind) {
  const mapel = S.mapel;
  const topics = (RB26_KB[mapel] || RB26_KB['Umum (Trivia Dunia)']).slice(0, 5).map(function (x) { return x.t; });
  const name = topics[0] || 'materi ini';
  const q = kind === 'contoh' ? 'Buatkan contoh soal dan pembahasan tentang ' + name
    : kind === 'langkah' ? 'Jelaskan langkah penyelesaian ' + name + ' dari awal'
      : 'Ringkas materi ' + name + ' dalam poin-poin penting';
  const inp = $('ci');
  if (inp) { inp.value = q; send2(); }
}
