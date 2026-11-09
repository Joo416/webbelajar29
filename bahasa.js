/* ===== RUANG BAHASA: modul belajar Inggris & Jepang ===== */
/* Dimuat setelah index.html; memakai util global: $, esc, fmt, shuffle, ai, user, IRR, verbForms */

const LB = { lang: 'en', tabEn: 'verbs', tabJp: 'kana', eq: '', eFilter: 'all', ePage: 1, eDetail: -1, fc: null, q: null, jq: null, jcat: 'Semua', jqKanji: '', chat: {}, build: null };

function lbStore(k, v) { try { if (v === undefined) return localStorage.getItem('lb_' + k); localStorage.setItem('lb_' + k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { return null; } }
function lbLoad(k, d) { try { const v = localStorage.getItem('lb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lbEsc(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function lbText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(lbText).filter(function (x) { return String(x).trim() !== ''; }).join('\n');
  if (typeof v === 'object') return lbText(v.text || v.content || v.answer || v.message || v.reply || '');
  return String(v);
}
function lbFmt(s) { const t = lbText(s); return typeof fmt === 'function' ? fmt(t) : lbEsc(t); }
function lbShuffle(a) { return typeof shuffle === 'function' ? shuffle(a) : a.slice(); }
function lbToast(t) { if (typeof v21Toast === 'function') v21Toast(t); }

/* ---------- bahasa aktif ---------- */
function lbCurLang() { const l = lbStore('lang'); return l === 'jp' || l === 'en' ? l : 'en'; }
function lbCurTab() { return LB.lang === 'jp' ? LB.tabJp : LB.tabEn; }

/* ---------- XP, streak, penguasaan ---------- */
function lbStats(lang) {
  const d = lbLoad('stats_' + lang, null) || { xp: 0, tries: 0, ok: 0, days: {}, last: '', streak: 0 };
  return d;
}
function lbSaveStats(lang, d) { lbStore('stats_' + lang, d); }
function lbToday() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function lbAward(lang, xp, ok) {
  const s = lbStats(lang);
  s.xp = (s.xp || 0) + (xp || 0);
  if (ok != null) { s.tries = (s.tries || 0) + 1; if (ok) s.ok = (s.ok || 0) + 1; }
  const t = lbToday();
  s.days = s.days || {};
  s.days[t] = (s.days[t] || 0) + (xp || 0);
  if (s.last !== t) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    s.streak = s.last === yk ? (s.streak || 0) + 1 : 1;
    s.last = t;
  }
  lbSaveStats(lang, s);
  return s;
}
function lbMastery(lang) { return lbLoad('mastery_' + lang, {}); }
function lbMarkMastery(lang, key, ok) {
  const m = lbMastery(lang);
  const cur = m[key] || { box: 0, seen: 0, ok: 0 };
  cur.seen++; if (ok) cur.ok++;
  cur.box = ok ? Math.min(5, (cur.box || 0) + 1) : 0;
  m[key] = cur; lbStore('mastery_' + lang, m); return cur;
}
function lbFavs(lang) { return lbLoad('fav_' + lang, []); }
function lbIsFav(lang, key) { return lbFavs(lang).indexOf(key) >= 0; }
function lbToggleFav(lang, key) {
  let f = lbFavs(lang);
  if (f.indexOf(key) >= 0) f = f.filter(function (x) { return x !== key; }); else f.push(key);
  lbStore('fav_' + lang, f);
  return f.indexOf(key) >= 0;
}

/* ---------- audio ---------- */
function lbSay(text, lang) {
  try {
    if (!('speechSynthesis' in window)) { lbToast('Browser ini tidak mendukung suara.'); return; }
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang === 'jp' ? 'ja-JP' : 'en-US';
    u.rate = lang === 'jp' ? 0.85 : 0.92;
    const vs = speechSynthesis.getVoices() || [];
    const v = vs.filter(function (x) { return (x.lang || '').toLowerCase().indexOf(lang === 'jp' ? 'ja' : 'en') === 0; })[0];
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { lbToast('Suara tidak tersedia: ' + e.message); }
}
function lbSayEl(el) { lbSay(el.getAttribute('data-w'), el.getAttribute('data-l')); }
function lbSayAll(i) {
  const v = LB_VERBS[i]; if (!v) return;
  try {
    if (!('speechSynthesis' in window)) { lbToast('Browser ini tidak mendukung suara.'); return; }
    speechSynthesis.cancel();
    const vs = speechSynthesis.getVoices() || [];
    const vv = vs.filter(function (x) { return (x.lang || '').toLowerCase().indexOf('en') === 0; })[0];
    [v.v1, String(v.v2).split('/')[0], String(v.v3).split('/')[0], v.ing, v.s].forEach(function (w) {
      const u = new SpeechSynthesisUtterance(String(w));
      u.lang = 'en-US'; u.rate = 0.9; if (vv) u.voice = vv;
      speechSynthesis.speak(u);
    });
  } catch (e) { lbToast('Suara tidak tersedia: ' + e.message); }
}
function lbAudioBtn(w, lang, cls) {
  return '<button type="button" class="lb-audio ' + (cls || '') + '" data-w="' + lbEsc(w) + '" data-l="' + lang + '" onclick="event.stopPropagation();lbSayEl(this)" aria-label="Dengarkan" title="Dengarkan"></button>';
}

/* ---------- kamus verb Inggris ---------- */
const LB_ARTI = {};
LB_EN_ARTI.split(';').forEach(function (p) { const q = p.split('='); if (q[0]) LB_ARTI[q[0]] = q.slice(1).join('='); });

function lbVerbForms(v1) {
  if (typeof verbForms === 'function') {
    const f = verbForms(v1);
    return { v1: f.v1, v2: f.v2, v3: f.v3, ing: f.ing, s: f.s };
  }
  return { v1: v1, v2: v1 + 'ed', v3: v1 + 'ed', ing: v1 + 'ing', s: v1 + 's' };
}

const LB_VERBS = (function () {
  const out = [], seen = {};
  const irr = (typeof IRR !== 'undefined' && Array.isArray(IRR)) ? IRR : [];
  irr.forEach(function (r) {
    if (!r || !r[0] || seen[r[0]]) return;
    seen[r[0]] = 1;
    const f = lbVerbForms(r[0]);
    out.push({ v1: r[0], v2: r[1], v3: r[2], ing: f.ing, s: f.s, arti: LB_ARTI[r[0]] || '', irr: true });
  });
  LB_EN_REG.split(';').forEach(function (p) {
    const q = p.split('='), w = q[0];
    if (!w || seen[w]) return;
    seen[w] = 1;
    const f = lbVerbForms(w);
    out.push({ v1: w, v2: f.v2, v3: f.v3, ing: f.ing, s: f.s, arti: q.slice(1).join('=') || '', irr: false });
  });
  out.sort(function (a, b) { return a.v1.localeCompare(b.v1); });
  return out;
})();

function lbNeed(lang) {
  return '<div class="card lb-empty"><div class="lb-empty-ico"></div><b>Data belum termuat</b><div class="mut small">Muat ulang halaman untuk memuat kamus bahasa.</div></div>';
}

/* ---------- header + navigasi ---------- */
function langHome() {
  if (typeof v21MarkTabs === 'function') v21MarkTabs();
  const lang = lbCurLang();
  LB.lang = lang;
  const s = lbStats(lang);
  const m = lbMastery(lang);
  const mastered = Object.keys(m).filter(function (k) { return m[k].box >= 4; }).length;
  const T = {
    en: { flag: '', name: 'Bahasa Inggris', sub: 'Verb 1-2-3, pelafalan IPA, contoh, flashcard, kuis.' },
    jp: { flag: '', name: 'Bahasa Jepang', sub: 'Hiragana, katakana, kanji, kosakata, tata bahasa, kuis.' }
  }[lang];
  const nav = lang === 'en'
    ? [['verbs', ' Kamus Verb'], ['flash', ' Flashcard'], ['quiz', ' Latihan'], ['ai', ' AI Inggris'], ['stats', ' Progres']]
    : [['kana', 'あ Kana'], ['kanji', '漢 Kanji'], ['vocab', ' Kosakata'], ['grammar', ' Tata Bahasa'], ['quiz', ' Latihan'], ['ai', ' AI Jepang']];
  const app = $('app');
  app.innerHTML =
    '<div class="lb-hero">' +
      '<div class="lb-hero-top">' +
        '<div class="lb-hero-ico"></div>' +
        '<div class="lb-hero-copy"><div class="lb-eyebrow">Ruang Bahasa</div><h2>Belajar bahasa tanpa terburu-buru</h2><p>' + lbEsc(T.sub) + '</p></div>' +
      '</div>' +
      '<div class="lb-switch" role="tablist" aria-label="Pilih bahasa">' +
        ['en', 'jp'].map(function (k) {
          const z = { en: ['', 'Inggris'], jp: ['', 'Jepang'] }[k];
          return '<button type="button" role="tab" aria-selected="' + (lang === k) + '" class="' + (lang === k ? 'on' : '') + '" onclick="lbSetLang(\'' + k + '\')">' + z[0] + ' ' + z[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="lb-stats">' +
        '<span><b>' + (s.xp || 0) + '</b> XP</span>' +
        '<span><b>' + (s.streak || 0) + '</b> hari beruntun</span>' +
        '<span><b>' + mastered + '</b> dikuasai</span>' +
        '<span><b>' + (s.tries ? Math.round(s.ok / s.tries * 100) : 0) + '%</b> akurasi</span>' +
      '</div>' +
    '</div>' +
    '<div class="lb-nav" role="tablist">' + nav.map(function (x) {
      return '<button type="button" role="tab" data-lbtab="' + x[0] + '" class="' + (lbCurTab() === x[0] ? 'on' : '') + '" onclick="lbTabClick(\'' + x[0] + '\')">' + x[1] + '</button>';
    }).join('') + '</div>' +
    '<div id="lbmain"></div>';
  lbRender();
}

function lbSetLang(l) {
  LB.lang = l; lbStore('lang', l);
  langHome();
}
function lbTabClick(k) {
  if (LB.lang === 'en') LB.tabEn = k; else LB.tabJp = k;
  if (k !== 'verbs') LB.eDetail = -1;
  lbRender();
  const n = document.querySelector('.lb-nav .on'); if (n) n.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function lbRender() {
  const box = $('lbmain'); if (!box) return;
  const lang = LB.lang, tab = lbCurTab();
  const V = {
    en: { verbs: lbEnVerbs, flash: lbEnFlash, quiz: lbEnQuiz, ai: lbEnAI, stats: lbEnStats },
    jp: { kana: lbJpKana, kanji: lbJpKanji, vocab: lbJpVocab, grammar: lbJpGrammar, quiz: lbJpQuiz, ai: lbJpAI, stats: lbJpStats }
  }[lang];
  const f = V && V[tab];
  box.innerHTML = f ? f() : lbNeed(lang);
  document.querySelectorAll('[data-lbtab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lbtab') === tab); });
  if (lang === 'en' && tab === 'verbs' && LB.eDetail >= 0) { lbEnIPA(LB.eDetail); lbEnEx(LB.eDetail); }
}

/* ---------- LATIHAN JEPANG ---------- */
const LB_JP_MODES = [['kana', 'Kana'], ['kanji', 'Kanji'], ['vocab', 'Kosakata'], ['build', 'Susun kalimat'], ['mix', 'Campur']];
function lbJpQuiz() {
  const q = LB.jq;
  const head = '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Latihan</div><h3>Uji kemampuan Jepangmu</h3></div><span class="lb-count">' + (q ? q.n + ' soal' : 'siap') + '</span></div>' +
    '<div class="lb-seg lb-seg-wrap">' + LB_JP_MODES.map(function (m) { return '<button type="button" class="' + (q && (q.mix ? m[0] === 'mix' : q.mode === m[0]) ? 'on' : '') + '" onclick="lbJpStartQuiz(\'' + m[0] + '\')">' + m[1] + '</button>'; }).join('') + '</div>' +
    (q ? '<div class="lb-quiz-meta"><span>Benar <b>' + q.score + '</b>/' + q.n + '</span><span class="mut">' + lbEsc(q.label) + '</span></div>' : '<div class="mut small" style="margin-top:10px">Pilih jenis latihan. Kana, kanji, dan kosakata memakai pilihan ganda; susun kalimat memakai potongan kata.</div>') +
    '</div>';
  if (!q) return head + '<div class="card lb-empty"><div class="lb-empty-ico"></div><b>Mulai latihan</b><div class="mut small">Ketuk salah satu jenis di atas.</div></div>';
  return head + lbJqBox();
}
function lbJpStartQuiz(mode) {
  if (mode === 'build') { LB.tabJp = 'grammar'; lbBuildStart(); return; }
  const mix = mode === 'mix';
  if (mix) mode = ['kana', 'kanji', 'vocab'][Math.floor(Math.random() * 3)];
  const prev = LB.jq || { n: 0, score: 0 };
  const q = { mode: mode, mix: mix, label: mix ? 'Campur' : { kana: 'Baca kana', kanji: 'Arti & baca kanji', vocab: 'Arti kosakata' }[mode], n: (prev.n || 0) + 1, score: prev.score || 0, done: false, ok: false };
  if (mode === 'kana') {
    const pool = lbKanaFlat(LB.ks === 'kata' ? 'kata' : 'hira');
    const uniq = [], seen = {};
    pool.forEach(function (x) { if (!seen[x.r]) { seen[x.r] = 1; uniq.push(x); } });
    const item = uniq[Math.floor(Math.random() * uniq.length)];
    const others = lbShuffle(uniq.filter(function (x) { return x.r !== item.r; })).slice(0, 3).map(function (x) { return x.r; });
    q.item = item; q.prompt = item.k; q.options = lbShuffle(others.concat([item.r])); q.answer = q.options.indexOf(item.r);
  } else if (mode === 'kanji') {
    const item = LB_KANJI[Math.floor(Math.random() * LB_KANJI.length)];
    const others = lbShuffle(LB_KANJI.filter(function (x) { return x.arti !== item.arti; })).slice(0, 3).map(function (x) { return x.arti; });
    q.item = item; q.prompt = item.k; q.options = lbShuffle(others.concat([item.arti])); q.answer = q.options.indexOf(item.arti);
  } else {
    const item = LB_JP_VOCAB[Math.floor(Math.random() * LB_JP_VOCAB.length)];
    const others = lbShuffle(LB_JP_VOCAB.filter(function (x) { return x.k !== item.k; })).slice(0, 3).map(function (x) { return x.k; });
    q.item = item; q.prompt = item.a; q.options = lbShuffle(others.concat([item.k])); q.answer = q.options.indexOf(item.k);
  }
  LB.jq = q;
  LB.tabJp = 'quiz';
  lbRender();
}
function lbJqBox() {
  const q = LB.jq, it = q.item;
  const prompt = q.mode === 'kana' ? '<div class="lb-jp-prompt">' + lbEsc(q.prompt) + '</div><div class="mut small" style="margin-bottom:10px">Bagaimana cara membaca kana ini?</div>'
    : q.mode === 'kanji' ? '<div class="lb-jp-prompt lb-kanji-prompt">' + lbEsc(q.prompt) + '</div><div class="mut small" style="margin-bottom:10px">Apa arti kanji ini?</div>'
    : '<div class="lb-quiz-prompt">Bahasa Jepang dari <b>' + lbEsc(q.prompt) + '</b> adalah …</div>';
  return '<div class="card lb-quiz">' + prompt +
    q.options.map(function (o, k) {
      let cls = 'opt';
      if (q.done) { if (k === q.answer) cls += ' ok'; else if (k === q.pick) cls += ' no'; }
      return '<button type="button" class="' + cls + '" ' + (q.done ? 'disabled' : '') + ' onclick="lbJqPick(' + k + ')">' + lbEsc(o) + '</button>';
    }).join('') +
    (q.done ? '<div class="lb-feedback ' + (q.ok ? 'ok' : 'no') + '"><b>' + (q.ok ? '✅ Benar!' : '❌ Belum tepat') + '</b>' +
      '<div class="small" style="margin-top:4px">' + (q.mode === 'kanji' ? 'On\'yomi: ' + lbEsc(it.on) + ' · Kun\'yomi: ' + lbEsc(it.kun) : q.mode === 'vocab' ? lbEsc(it.k) + ' · ' + lbEsc(it.r) : lbEsc(it.k) + ' · ' + lbEsc(it.r)) + '</div>' +
      '<div class="lb-gex-jp" style="margin-top:6px">' + lbAudioBtn(q.mode === 'kanji' ? it.k : it.k, 'jp') + '</div>' +
      '<button class="btn full" style="margin-top:10px" onclick="lbJqNext()">Soal berikutnya ▶</button></div>' : '') +
  '</div>';
}
function lbJqPick(k) {
  const q = LB.jq; if (!q || q.done) return;
  q.pick = k; q.ok = k === q.answer; q.done = true;
  if (q.ok) q.score = (q.score || 0) + 1;
  lbAward('jp', q.ok ? 10 : 2, q.ok);
  lbMarkMastery('jp', q.mode + ':' + (q.mode === 'kanji' ? q.item.k : q.mode === 'vocab' ? q.item.k : q.item.k), q.ok);
  lbRender();
}
function lbJqNext() {
  const q = LB.jq; if (!q) return;
  const st = { n: q.n, score: q.score };
  const mix = q.mix;
  LB.jq = { n: st.n, score: st.score };
  lbJpStartQuiz(mix ? 'mix' : q.mode);
  LB.jq.n = st.n + 1; LB.jq.score = st.score; LB.jq.mix = mix;
  lbRender();
}
function lbJpAI() { return lbChatView('jp', ' Sakura Sensei', 'AI ini hanya membahas bahasa Jepang: kana, kanji, partikel, dan percakapan.', LB_STARTERS.jp); }

function lbJpStats() {
  const s = lbStats('jp'), m = lbMastery('jp'), keys = Object.keys(m);
  const mastered = keys.filter(function (k) { return m[k].box >= 4; }).length;
  const learn = keys.filter(function (k) { return m[k].box > 0 && m[k].box < 4; }).length;
  return lbGoal('jp') + '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Progres</div><h3>Perjalanan bahasa Jepangmu</h3></div><span class="lb-count">' + (s.xp || 0) + ' XP</span></div>' +
    '<div class="lb-statgrid">' +
      '<div class="lb-stat"><b>' + (s.streak || 0) + '</b><span>hari beruntun</span></div>' +
      '<div class="lb-stat"><b>' + (s.tries ? Math.round(s.ok / s.tries * 100) : 0) + '%</b><span>akurasi</span></div>' +
      '<div class="lb-stat"><b>' + mastered + '</b><span>item dikuasai</span></div>' +
      '<div class="lb-stat"><b>' + learn + '</b><span>sedang dipelajari</span></div>' +
    '</div>' +
    '<div class="lb-statgrid" style="margin-top:10px">' +
      '<div class="lb-stat"><b>' + lbKanaFlat('hira').length + '</b><span>kana (hira + kata)</span></div>' +
      '<div class="lb-stat"><b>' + LB_KANJI.length + '</b><span>kanji N5</span></div>' +
      '<div class="lb-stat"><b>' + LB_JP_VOCAB.length + '</b><span>kosakata</span></div>' +
      '<div class="lb-stat"><b>' + LB_JP_GRAMMAR.length + '</b><span>pola kalimat</span></div>' +
    '</div>' +
    '<div class="lb-bars">' + (function () {
      const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); days.push({ k: k, v: (s.days || {})[k] || 0, l: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()] }); }
      const mx = Math.max.apply(null, days.map(function (x) { return x.v; }).concat([10]));
      return days.map(function (x) { return '<div class="lb-bar"><i style="height:' + Math.round(x.v / mx * 100) + '%" title="' + x.v + ' XP"></i><span>' + x.l + '</span></div>'; }).join('');
    })() + '</div>' +
    '<div class="mut small" style="margin-top:8px">XP harian 7 hari terakhir.</div>' +
  '</div>' +
  '<div class="card lb-panel"><div class="lb-panel-head"><h3>Pengaturan</h3></div><div class="mut small">Data progres disimpan di perangkat ini.</div><button class="btn red full" onclick="lbReset(\'jp\')">Reset progres Jepang</button></div>';
}

/* ---------- gaya modul ---------- */
(function () {
  const css = `
.lb-hero{position:relative;overflow:hidden;background:linear-gradient(150deg,rgba(124,140,255,.16),rgba(94,234,212,.07) 55%,transparent 85%),var(--card);border:1px solid var(--line);border-radius:24px;padding:22px;margin-bottom:14px;box-shadow:var(--shadow)}
.lb-hero:after{content:'';position:absolute;right:-70px;top:-90px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(124,140,255,.28),transparent 68%);pointer-events:none}
.lb-hero-top{display:flex;gap:14px;align-items:center;position:relative;z-index:1}
.lb-hero-ico{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-size:1.6rem;background:linear-gradient(145deg,var(--accent),var(--accent2));color:#08111a;box-shadow:0 12px 30px -18px rgba(124,140,255,.9);flex:0 0 auto}
.lb-eyebrow{font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.lb-hero-copy h2{margin:0 0 4px;font-size:clamp(1.2rem,3.2vw,1.5rem);letter-spacing:-.04em}
.lb-hero-copy p{margin:0;color:var(--mut);font-size:.86rem;line-height:1.55;max-width:52ch}
.lb-switch{display:inline-flex;gap:4px;padding:5px;border-radius:16px;background:rgba(0,0,0,.22);border:1px solid var(--line);margin-top:16px;position:relative;z-index:1}
html[data-theme=light] .lb-switch{background:var(--field)}
.lb-switch button{border:0;background:transparent;color:var(--mut);font:inherit;font-size:.82rem;font-weight:700;padding:9px 16px;border-radius:12px;cursor:pointer;transition:.16s}
.lb-switch button.on{background:linear-gradient(145deg,var(--accent),var(--accent2));color:#08111a;box-shadow:0 8px 18px -14px rgba(124,140,255,.9)}
.lb-stats{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;position:relative;z-index:1}
.lb-stats span{display:inline-flex;align-items:baseline;gap:5px;padding:6px 11px;border-radius:999px;background:var(--field);border:1px solid var(--line);font-size:.72rem;color:var(--mut)}
.lb-stats b{color:var(--tx);font-size:.86rem;font-weight:800}
.lb-nav{display:flex;gap:5px;overflow-x:auto;padding:5px;margin-bottom:14px;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);scrollbar-width:none}
.lb-nav::-webkit-scrollbar{display:none}
.lb-nav button{flex:0 0 auto;border:0;background:transparent;color:var(--mut);font:inherit;font-size:.79rem;font-weight:700;padding:10px 13px;border-radius:13px;cursor:pointer;white-space:nowrap;transition:.16s}
.lb-nav button:hover{background:var(--card2);color:var(--tx)}
.lb-nav button.on{background:var(--accent-soft);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(124,140,255,.3)}
.lb-panel h3{margin:0;font-size:1.02rem}
.lb-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
.lb-count{font-size:.7rem;font-weight:700;color:var(--mut);background:var(--field);border:1px solid var(--line);padding:5px 10px;border-radius:999px;white-space:nowrap}
.lb-seg{display:flex;gap:4px;padding:4px;background:var(--field);border:1px solid var(--line);border-radius:14px;margin:6px 0 10px;overflow-x:auto;scrollbar-width:none}
.lb-seg::-webkit-scrollbar{display:none}
.lb-seg button{flex:1;min-width:max-content;border:0;background:transparent;color:var(--mut);font:inherit;font-size:.76rem;font-weight:700;padding:9px 12px;border-radius:10px;cursor:pointer;transition:.15s}
.lb-seg button:hover{color:var(--tx)}
.lb-seg button.on{background:var(--card);color:var(--tx);box-shadow:var(--shadow)}
.lb-seg-wrap button{flex:0 0 auto}
.lb-search{display:flex;align-items:center;gap:8px;background:var(--field);border:1px solid var(--line);border-radius:14px;padding:0 12px;margin:8px 0 12px;transition:border-color .15s,box-shadow .15s}
.lb-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.lb-search span{font-size:.9rem;opacity:.8}
.lb-search input{border:0;background:transparent;box-shadow:none;padding:12px 0;min-height:44px;font-size:.9rem}
.lb-search input:focus{box-shadow:none}
.lb-vhead{display:grid;grid-template-columns:1fr 1fr 1fr 1.5fr;gap:8px;padding:0 10px 6px;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.lb-vrow{display:grid;grid-template-columns:1fr 1fr 1fr 1.5fr;gap:8px;align-items:center;padding:10px;border-radius:12px;border:1px solid transparent;cursor:pointer;transition:background .14s,border-color .14s;font-size:.86rem}
.lb-vrow:hover{background:var(--card2);border-color:var(--line)}
.lb-vrow:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.lb-vcell{min-width:0;overflow:hidden;text-overflow:ellipsis}
.lb-vcell b{font-weight:700}
.lb-arti-cell{display:flex;align-items:center;gap:5px;color:var(--mut);font-size:.8rem}
.lb-arti-cell>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-tag{font-style:normal;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);border:1px solid var(--warn-line);background:var(--warn-soft);padding:2px 5px;border-radius:5px}
.lb-audio{border:1px solid var(--line);background:var(--card2);color:var(--tx);border-radius:10px;width:30px;height:30px;display:grid;place-items:center;font-size:.78rem;cursor:pointer;flex:0 0 auto;transition:.14s}
.lb-audio:hover{background:var(--field);border-color:var(--line2)}
.lb-audio.lg{width:42px;height:42px;border-radius:13px;font-size:1rem}
.lb-detail{border-radius:22px;background:linear-gradient(160deg,var(--card2),var(--card) 70%)}
.lb-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.lb-detail-title{margin:0;font-size:2rem;letter-spacing:-.05em;line-height:1.1}
.lb-kanji-big{font-size:3rem}
.lb-arti{color:var(--mut);font-size:.92rem;margin-top:2px}
.lb-detail-actions{display:flex;gap:6px;align-items:center}
.lb-fav{border:1px solid var(--line);background:var(--card);color:var(--mut);width:38px;height:38px;border-radius:12px;font-size:1.05rem;cursor:pointer}
.lb-fav.on{color:var(--warn);border-color:var(--warn-line);background:var(--warn-soft)}
.lb-close{border:1px solid var(--line);background:var(--card);color:var(--mut);width:38px;height:38px;border-radius:12px;cursor:pointer}
.lb-forms{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:14px 0}
.lb-form{position:relative;background:var(--field);border:1px solid var(--line);border-radius:14px;padding:10px 12px;padding-right:38px}
.lb-form span{display:block;font-size:.64rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--accent)}
.lb-form b{display:block;font-size:1rem;margin:2px 0}
.lb-form em{display:block;font-style:normal;font-size:.76rem;color:var(--mut);min-height:1em;font-family:var(--font-mono)}
.lb-form .lb-audio{position:absolute;right:8px;top:50%;transform:translateY(-50%)}
.lb-use{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.lb-use-item{border:1px solid var(--line);border-radius:12px;background:var(--field);padding:9px 12px}
.lb-use-item summary{cursor:pointer;font-size:.82rem;font-weight:700}
.lb-use-item p{margin:8px 0 6px;font-size:.82rem;color:var(--mut);line-height:1.6}
.lb-use-item code{display:block;font-size:.76rem;color:var(--accent);background:var(--accent-soft);border-radius:8px;padding:6px 8px}
.lb-ex-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:18px 0 8px}
.lb-ex-box{display:flex;flex-direction:column;gap:8px}
.lb-ex{display:flex;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:var(--field)}
.lb-ex-tag{font-size:.62rem;font-weight:800;letter-spacing:.06em;color:var(--accent);text-transform:uppercase;padding-top:3px;flex:0 0 40px}
.lb-ex-en{font-size:.88rem;font-weight:600;line-height:1.5}
.lb-ex-id{font-size:.78rem;color:var(--mut)}
.lb-ex .lb-audio{display:inline-grid;vertical-align:middle;width:24px;height:24px;font-size:.7rem;margin-left:4px}
.lb-respell{display:block;font-size:.68rem;color:var(--accent2);min-height:1em;margin-top:1px}
.lb-note{font-size:.72rem;color:var(--mut);padding:5px 2px}
.lb-sayall{white-space:nowrap;font-size:.72rem}
.lb-goal .lb-progress{margin-top:6px}
.lb-tip{margin-top:10px;padding:10px 12px;border-radius:12px;background:var(--warn-soft);border:1px solid var(--warn-line);font-size:.8rem;line-height:1.55}
.lb-skel{height:14px;border-radius:8px;background:linear-gradient(90deg,var(--card2),var(--field),var(--card2));background-size:200% 100%;animation:lbsh 1.1s infinite;margin:6px 0}
.lb-skel.sh{width:70%}
@keyframes lbsh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.lb-error{padding:12px;border-radius:12px;background:var(--no-soft);border:1px solid var(--no);font-size:.84rem}
.lb-empty{text-align:center;padding:26px 16px;color:var(--mut);font-size:.86rem;display:flex;flex-direction:column;gap:6px;align-items:center}
.lb-empty-ico{font-size:1.8rem;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:var(--accent-soft);border:1px solid var(--line)}
.lb-empty b{color:var(--tx)}
.lb-foot{text-align:center;margin:10px 0 0}
.lb-chip{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:var(--field);border:1px solid var(--line);font-size:.72rem;font-weight:700;color:var(--mut)}
.lb-chip-btn{cursor:pointer;transition:.15s;text-align:left;font:inherit;font-size:.78rem}
.lb-chip-btn:hover{border-color:var(--accent);color:var(--tx)}
.lb-chip-btn.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.lb-cats{gap:6px;margin-bottom:12px}
.lb-chips{display:flex;flex-wrap:wrap;gap:6px}
.lb-flash{max-width:560px;margin-left:auto;margin-right:auto}
.lb-flash-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.lb-progress{height:6px;border-radius:99px;background:var(--field);overflow:hidden;margin-bottom:16px;border:1px solid var(--line)}
.lb-progress i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .3s}
.lb-card-face{position:relative;min-height:190px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(160deg,var(--card2),var(--field));display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;cursor:pointer;transition:border-color .18s,transform .18s}
.lb-card-face:hover{border-color:var(--line2);transform:translateY(-1px)}
.lb-face-front,.lb-face-back{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}
.lb-flash-word{font-size:2.1rem;font-weight:800;letter-spacing:-.04em;line-height:1.15}
.lb-jpword{font-size:2.4rem}
.lb-flash-arti{font-size:1.3rem;font-weight:800;letter-spacing:-.02em}
.lb-flash-forms{font-size:1rem;font-weight:600;color:var(--b,var(--tx))}
.lb-flash-hint{font-size:.72rem;color:var(--mut);margin-top:6px}
.lb-flash-actions{display:flex;gap:8px;margin-top:14px}
.lb-flash-actions .btn{flex:1}
.lb-flash-result{text-align:center;max-width:520px;margin-left:auto;margin-right:auto}
.lb-big-ring{width:110px;height:110px;margin:4px auto 14px;border-radius:50%;display:grid;place-items:center;align-content:center;background:conic-gradient(var(--accent) 82%,var(--card2) 0);position:relative}
.lb-big-ring:before{content:'';position:absolute;inset:8px;border-radius:50%;background:var(--card)}
.lb-big-ring b,.lb-big-ring span{position:relative;z-index:1;display:block}
.lb-big-ring b{font-size:1.5rem;letter-spacing:-.03em}
.lb-big-ring span{font-size:.66rem;color:var(--mut);text-transform:uppercase;letter-spacing:.1em}
.lb-quiz-meta{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;color:var(--mut);background:var(--field);border:1px solid var(--line);border-radius:11px;padding:8px 11px;margin-top:4px}
.lb-quiz-prompt{font-size:1rem;font-weight:600;line-height:1.55;margin:6px 0 14px}
.lb-quiz-verb{font-size:1.2rem;font-weight:800;color:var(--accent);letter-spacing:-.02em}
.lb-jp-prompt{font-size:3rem;text-align:center;font-weight:700;margin:10px 0 4px;line-height:1.1}
.lb-kanji-prompt{font-size:4rem}
.lb-feedback{margin-top:14px;padding:13px 14px;border-radius:14px;border:1px solid var(--line);background:var(--field);font-size:.86rem}
.lb-feedback.ok{border-color:var(--ok);background:var(--ok-soft)}
.lb-feedback.no{border-color:var(--no);background:var(--no-soft)}
.lb-chat{max-height:min(52vh,430px);overflow:auto;display:flex;flex-direction:column;gap:10px;padding:2px}
.lb-chat-empty{text-align:center;padding:26px 14px;color:var(--mut);font-size:.85rem;display:flex;flex-direction:column;gap:6px;align-items:center}
.lb-starters{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.lb-compose{display:flex;gap:8px;align-items:flex-end}
.lb-compose textarea{flex:1;min-height:52px;max-height:140px;border-radius:14px;resize:vertical;font-size:.9rem}
.lb-compose .btn{flex:0 0 auto;min-width:84px;height:52px}
.lb-chat-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}
.lb-live{font-size:.68rem;font-weight:700;color:var(--ok);background:var(--ok-soft);border:1px solid var(--ok);padding:4px 9px;border-radius:999px;white-space:nowrap}
.lb-statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.lb-stat{background:var(--field);border:1px solid var(--line);border-radius:14px;padding:12px 10px;text-align:center}
.lb-stat b{display:block;font-size:1.3rem;letter-spacing:-.03em;line-height:1.2}
.lb-stat span{font-size:.66rem;color:var(--mut);line-height:1.3;display:block;margin-top:2px}
.lb-bars{display:flex;align-items:flex-end;gap:7px;height:104px;margin-top:16px}
.lb-bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;height:100%}
.lb-bar i{display:block;width:100%;max-width:30px;min-height:5px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--accent2),var(--accent));transition:height .3s}
.lb-bar span{font-size:.64rem;color:var(--mut);font-weight:700}
.lb-kana-cards{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.lb-kana-row{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:13px;padding:7px 9px;background:var(--field)}
.lb-kana-rowname{flex:0 0 74px;font-size:.65rem;font-weight:800;color:var(--mut);letter-spacing:.03em}
.lb-kana-cells{display:flex;flex-wrap:wrap;gap:5px}
.lb-kana{border:1px solid var(--line);background:var(--card);border-radius:10px;min-width:52px;padding:6px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;color:var(--tx);transition:.14s}
.lb-kana:hover{border-color:var(--accent);background:var(--accent-soft)}
.lb-kana b{font-size:1.15rem;line-height:1.15}
.lb-kana span{font-size:.6rem;color:var(--mut)}
.lb-kana-tips{display:grid;gap:8px}
.lb-kana-tips>div{display:flex;gap:10px;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:8px;font-size:.8rem;color:var(--mut)}
.lb-kana-tips b{flex:0 0 120px;color:var(--tx);font-size:.78rem}
.lb-kanji-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin-top:4px}
.lb-kanji{border:1px solid var(--line);background:var(--field);border-radius:12px;padding:9px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--tx);transition:.14s}
.lb-kanji:hover{border-color:var(--accent);background:var(--accent-soft)}
.lb-kanji.on{border-color:var(--accent);background:var(--accent-soft)}
.lb-kanji b{font-size:1.5rem;line-height:1.15}
.lb-kanji span{font-size:.6rem;color:var(--mut);text-align:center;line-height:1.2;overflow:hidden;max-height:2.4em}
.lb-kanji-read{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.lb-kanji-read div{background:var(--field);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.lb-kanji-read span{display:block;font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:800}
.lb-kanji-read b{font-size:.9rem}
.lb-word-list{display:flex;flex-direction:column;gap:6px}
.lb-word{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;background:var(--field);padding:8px 10px}
.lb-word>div{flex:1;min-width:0}
.lb-word b{font-size:1rem;margin-right:6px}
.lb-word span{font-size:.78rem;color:var(--accent)}
.lb-word em{display:block;font-style:normal;font-size:.76rem;color:var(--mut)}
.lb-vocab-list{display:flex;flex-direction:column;gap:5px;max-height:520px;overflow:auto;padding-right:2px}
.lb-vocab{display:flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:11px;padding:8px 10px;background:var(--field)}
.lb-vocab-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.lb-vocab-main b{font-size:1rem}
.lb-vocab-main span{font-size:.74rem;color:var(--accent)}
.lb-vocab-main em{font-style:normal;font-size:.8rem;color:var(--mut)}
.lb-grammar{display:flex;flex-direction:column;gap:7px}
.lb-gram{border:1px solid var(--line);border-radius:13px;background:var(--field);padding:10px 12px}
.lb-gram summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}
.lb-gram summary b{font-size:.88rem}
.lb-gram summary code{font-size:.74rem;color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:2px 6px}
.lb-gram p{font-size:.82rem;color:var(--mut);line-height:1.6;margin:8px 0}
.lb-gex{border-left:2px solid var(--accent);padding-left:10px;margin:8px 0}
.lb-gex-jp{font-size:.95rem;font-weight:600}
.lb-gex-r{font-size:.78rem;color:var(--accent)}
.lb-gex-id{font-size:.78rem;color:var(--mut)}
.lb-builder .lb-built{min-height:60px;border:1px dashed var(--line2);border-radius:14px;padding:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--field);margin-bottom:10px}
.lb-pool{display:flex;flex-wrap:wrap;gap:6px}
.lb-token{border:1px solid var(--line2);background:var(--card2);color:var(--tx);border-radius:11px;padding:8px 12px;font:inherit;font-size:.92rem;cursor:pointer;transition:.14s}
.lb-token:hover{border-color:var(--accent);background:var(--accent-soft)}
.lb-token.in{background:var(--accent-soft);border-color:var(--accent)}
.lb-cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.lb-cta-row .btn{flex:1 1 170px}
.lb-center{display:block;margin-left:auto;margin-right:auto}
@media(max-width:640px){
.lb-hero{padding:17px;border-radius:20px}
.lb-hero-ico{width:48px;height:48px;border-radius:15px;font-size:1.35rem}
.lb-switch{display:flex;width:100%}
.lb-switch button{flex:1;padding:10px 8px}
.lb-stats span{font-size:.68rem;padding:5px 9px}
.lb-nav{flex-wrap:wrap;overflow:visible;margin-left:-2px;margin-right:-2px}
.lb-nav button{flex:1 1 auto;text-align:center;padding:9px 10px;font-size:.75rem}
.lb-vhead{grid-template-columns:1fr 1fr 1fr;font-size:.6rem}
.lb-vrow{grid-template-columns:1fr 1fr 1fr;row-gap:4px;font-size:.8rem}
.lb-vcell:nth-child(3),.lb-vhead span:nth-child(3){display:none}
.lb-arti-cell{grid-column:1/-1;border-top:1px dashed var(--line);padding-top:4px;margin-top:2px}
.lb-statgrid{grid-template-columns:1fr 1fr}
.lb-kanji-grid{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}
.lb-kanji b{font-size:1.3rem}
.lb-kanji-read{grid-template-columns:1fr}
.lb-flash-word{font-size:1.8rem}
.lb-compose{flex-direction:column;align-items:stretch}
.lb-compose .btn{width:100%}
}
@media(prefers-reduced-motion:reduce){.lb-skel{animation:none}}
`;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

/* ---------- KAMUS VERB (Inggris) ---------- */
function lbEnFiltered() {
  const q = LB.eq.trim().toLowerCase();
  return LB_VERBS.map(function (v, i) { return { v: v, i: i }; }).filter(function (x) {
    const v = x.v;
    if (LB.eFilter === 'irr' && !v.irr) return false;
    if (LB.eFilter === 'reg' && v.irr) return false;
    if (LB.eFilter === 'fav' && !lbIsFav('en', v.v1)) return false;
    if (!q) return true;
    return (v.v1 + ' ' + v.v2 + ' ' + v.v3 + ' ' + v.arti).toLowerCase().indexOf(q) >= 0;
  });
}
function lbEnVerbs() {
  if (!LB_VERBS.length) return lbNeed('en');
  const list = lbEnFiltered();
  const rows = list.slice(0, LB.ePage * 60);
  return '<div id="lben-detail">' + (LB.eDetail >= 0 ? lbEnDetailHtml(LB.eDetail) : '') + '</div>' +
    '<div class="card lb-panel">' +
      '<div class="lb-panel-head"><div><div class="lb-eyebrow">Kamus</div><h3>Verb 1 · 2 · 3</h3></div><span class="lb-count" id="lben-count">' + list.length + ' verb</span></div>' +
      '<div class="lb-seg" role="group" aria-label="Filter verb">' +
        [['all', 'Semua'], ['irr', 'Irregular'], ['reg', 'Regular'], ['fav', ' Favorit']].map(function (x) {
          return '<button type="button" class="' + (LB.eFilter === x[0] ? 'on' : '') + '" onclick="lbEnFilter(\'' + x[0] + '\')">' + x[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="lb-search"><span></span><input id="lben-q" type="search" autocomplete="off" placeholder="Cari verb atau arti: go, pergi, written..." value="' + lbEsc(LB.eq) + '" oninput="lbEnSearch(this.value)" onkeydown="if(event.key===\'Escape\'){this.value=\'\';lbEnSearch(\'\')}"></div>' +
      '<div class="lb-vhead"><span>V1</span><span>V2</span><span>V3</span><span>Arti</span></div>' +
      '<div id="lben-rows">' + lbEnRows(rows) + '</div>' +
      '<div id="lben-more">' + (list.length > rows.length ? '<button class="btn alt full" type="button" onclick="lbEnMore()">Muat ' + (list.length - rows.length) + ' verb lagi</button>' : '') + '</div>' +
    '</div>' +
    '<div class="mut small lb-foot">Ketuk baris untuk melihat aturan pakai, cara penyebutan (IPA), dan contoh kalimat tiap bentuk.</div>';
}
function lbEnRows(rows) {
  if (!rows.length) return '<div class="lb-empty"><div class="lb-empty-ico"></div><b>Tidak ada verb yang cocok</b><div class="mut small">Coba kata lain atau hapus filter.</div></div>';
  return rows.map(function (x) {
    const v = x.v, fav = lbIsFav('en', v.v1);
    return '<div class="lb-vrow" onclick="lbEnDetail(' + x.i + ')" tabindex="0" onkeydown="if(event.key===\'Enter\')lbEnDetail(' + x.i + ')">' +
      '<div class="lb-vcell"><b>' + lbEsc(v.v1) + '</b></div>' +
      '<div class="lb-vcell">' + lbEsc(v.v2) + '</div>' +
      '<div class="lb-vcell">' + lbEsc(v.v3) + '</div>' +
      '<div class="lb-vcell lb-arti-cell"><span>' + (v.arti ? lbEsc(v.arti) : '<i class="mut">—</i>') + '</span>' + (v.irr ? '<em class="lb-tag">irr</em>' : '') + (fav ? ' ' : '') + lbAudioBtn(v.v1, 'en') + '</div>' +
    '</div>';
  }).join('');
}
function lbEnSearch(v) {
  LB.eq = v; LB.ePage = 1;
  const list = lbEnFiltered(), rows = list.slice(0, LB.ePage * 60);
  const r = $('lben-rows'), c = $('lben-count'), m = $('lben-more');
  if (r) r.innerHTML = lbEnRows(rows);
  if (c) c.textContent = list.length + ' verb';
  if (m) m.innerHTML = list.length > rows.length ? '<button class="btn alt full" type="button" onclick="lbEnMore()">Muat ' + (list.length - rows.length) + ' verb lagi</button>' : '';
}
function lbEnFilter(f) { LB.eFilter = f; LB.ePage = 1; LB.eDetail = -1; lbRender(); }
function lbEnMore() { LB.ePage++; const list = lbEnFiltered(), rows = list.slice(0, LB.ePage * 60); const r = $('lben-rows'), m = $('lben-more'); if (r) r.innerHTML = lbEnRows(rows); if (m) m.innerHTML = list.length > rows.length ? '<button class="btn alt full" type="button" onclick="lbEnMore()">Muat ' + (list.length - rows.length) + ' verb lagi</button>' : ''; }

function lbEnDetailHtml(i) {
  const v = LB_VERBS[i]; if (!v) return '';
  const fav = lbIsFav('en', v.v1);
  const forms = [{ k: 'V1', val: v.v1, u: 'v1' }, { k: 'V2', val: v.v2, u: 'v2' }, { k: 'V3', val: v.v3, u: 'v3' }, { k: 'V-ing', val: v.ing, u: 'ing' }, { k: 'V-s', val: v.s, u: 's' }];
  return '<div class="card lb-detail">' +
    '<div class="lb-detail-head">' +
      '<div><div class="lb-eyebrow">' + (v.irr ? 'Irregular verb' : 'Regular verb') + '</div><h2 class="lb-detail-title">' + lbEsc(v.v1) + '</h2>' +
      '<div class="lb-arti">' + (v.arti ? lbEsc(v.arti) : '<span class="mut">arti belum tersedia</span>') + '</div></div>' +
      '<div class="lb-detail-actions">' + lbAudioBtn(v.v1, 'en', 'lg') +
      '<button type="button" class="x lb-sayall" onclick="lbSayAll(' + i + ')" title="Dengarkan semua bentuk"> Semua</button>' +
      '<button type="button" class="lb-fav ' + (fav ? 'on' : '') + '" onclick="lbEnFav(' + i + ')" aria-label="Simpan ke favorit" title="Favorit">' + (fav ? '' : '') + '</button>' +
      '<button type="button" class="lb-close" onclick="lbEnClose()" aria-label="Tutup">Tutup</button></div>' +
    '</div>' +
    '<div class="lb-forms">' + forms.map(function (f, k) {
      return '<div class="lb-form"><span>' + f.k + '</span><b>' + lbEsc(f.val) + '</b><em id="lbipa' + k + '">…</em><span class="lb-respell" id="lbresp' + k + '"></span>' + lbAudioBtn(String(f.val).split('/')[0], 'en') + '</div>';
    }).join('') + '</div>' +
    '<div class="lb-use">' + ['v1', 'v2', 'v3', 'ing', 's'].map(function (k) {
      return '<details class="lb-use-item"><summary>' + lbEsc(LB_EN_USE[k][0]) + '</summary><p>' + lbEsc(LB_EN_USE[k][1]) + '</p><code>' + lbEsc(LB_EN_USE[k][2]) + '</code></details>';
    }).join('') + '</div>' +
    '<div class="lb-ex-head"><div><div class="lb-eyebrow">Contoh</div><b>Kalimat untuk tiap bentuk</b></div><button type="button" class="x" onclick="lbEnEx(' + i + ',true)"> Contoh AI</button></div>' +
    '<div id="lben-ex" class="lb-ex-box"><div class="lb-skel"></div></div>' +
    '<div class="mut small" style="margin-top:8px">Contoh pola tersedia luring untuk semua verb. Contoh AI memakai AI khusus bahasa Inggris dan disimpan di perangkat ini.</div>' +
  '</div>';
}
function lbEnDetail(i) {
  LB.eDetail = i;
  const box = $('lben-detail');
  if (!box) { lbRender(); return; }
  box.innerHTML = lbEnDetailHtml(i);
  try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { }
  lbEnIPA(i); lbEnEx(i);
}
function lbEnClose() { LB.eDetail = -1; const b = $('lben-detail'); if (b) b.innerHTML = ''; }
function lbEnFav(i) { const v = LB_VERBS[i]; if (!v) return; const on = lbToggleFav('en', v.v1); lbToast(on ? ' Disimpan ke favorit' : 'Dihapus dari favorit'); lbEnDetail(i); }

/* IPA: Datamuse (CORS-friendly) -> dictionaryapi.dev -> cache */
const LB_ARP = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'e', ER: 'ɜr', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
function lbArpToIpa(s) {
  const out = String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map(function (x) {
    return LB_ARP[x.replace(/[0-9]/g, '').toUpperCase()] || '';
  }).join('');
  return out ? '/' + out + '/' : '';
}
function lbRespell(ipa) {
  let s = String(ipa || '').replace(/^\/|\/$/g, '').replace(/[ˈˌ.ːˑ]/g, '');
  [['tʃ', 'c'], ['dʒ', 'j'], ['ʃ', 'sy'], ['ʒ', 'zh'], ['θ', 'th'], ['ð', 'dh'], ['ŋ', 'ng'],
    ['aɪ', 'ai'], ['eɪ', 'ei'], ['ɔɪ', 'oi'], ['aʊ', 'au'], ['oʊ', 'ou'], ['əʊ', 'ou'],
    ['ɪə', 'ir'], ['eə', 'er'], ['ʊə', 'ur'], ['ɜr', 'er'], ['ɜː', 'er']].forEach(function (p) {
    s = s.split(p[0]).join(p[1]);
  });
  const M = { ɑ: 'a', æ: 'e', ʌ: 'a', ɒ: 'o', ɔ: 'o', ə: 'e', ɜ: 'e', ɛ: 'e', ɪ: 'i', i: 'i', ʊ: 'u', u: 'u', e: 'e', o: 'o', a: 'a', ɡ: 'g', j: 'y', w: 'w', r: 'r', l: 'l', m: 'm', n: 'n', b: 'b', p: 'p', t: 't', d: 'd', k: 'k', f: 'f', v: 'v', s: 's', z: 'z', h: 'h', x: 'ks' };
  let out = '';
  for (const ch of s) { if (M[ch] !== undefined) out += M[ch]; else if (/[a-z ]/.test(ch)) out += ch; }
  return out.replace(/\s+/g, ' ').trim();
}
function lbIpaLookup(word) {
  const key = 'ipa_' + word;
  const c = lbLoad(key, null); if (c && c.t) return Promise.resolve(c);
  const dm = function () {
    return fetch('https://api.datamuse.com/words?sp=' + encodeURIComponent(word) + '&md=r&max=1')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        const tag = ((Array.isArray(j) && j[0] && j[0].tags) || []).filter(function (x) { return String(x).indexOf('pron:') === 0; })[0];
        const t = tag ? lbArpToIpa(String(tag).slice(5)) : '';
        const out = { t: t, a: '' };
        if (t) lbStore(key, out);
        return out;
      }).catch(function () { return { t: '', a: '' }; });
  };
  const dict = function () {
    return fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        let t = '', a = '';
        (Array.isArray(j) ? j : []).forEach(function (e) {
          (e.phonetics || []).forEach(function (p) { if (!t && p.text) t = p.text; if (!a && p.audio) a = p.audio; });
          if (!t && e.phonetic) t = e.phonetic;
        });
        const out = { t: t, a: a };
        if (t) lbStore(key, out);
        return out;
      }).catch(function () { return { t: '', a: '' }; });
  };
  return dm().then(function (o) { return o.t ? o : dict(); });
}
function lbEnIPA(i) {
  const v = LB_VERBS[i]; if (!v) return;
  [v.v1, String(v.v2).split('/')[0], String(v.v3).split('/')[0], v.ing, v.s].forEach(function (w, k) {
    const timeout = new Promise(function (r) { setTimeout(function () { r({ t: '', a: '' }); }, 4500); });
    Promise.race([lbIpaLookup(w), timeout]).then(function (p) {
      const el = $('lbipa' + k), rs = $('lbresp' + k);
      if (el) el.textContent = p && p.t ? p.t : '—';
      if (rs) rs.textContent = p && p.t ? 'dibaca: ' + lbRespell(p.t) : 'klik  untuk dengar';
    });
  });
}

function lbExHtml(v, d, tip) {
  if (!d) return '';
  const rows = [['v1', 'V1'], ['v2', 'V2'], ['v3', 'V3'], ['ing', 'V-ing'], ['s', 'V-s']].map(function (x) {
    const e = d[x[0]];
    if (!e || !e.en) return '<div class="lb-ex"><span class="lb-ex-tag">' + x[1] + '</span><div><div class="lb-ex-en mut">Contoh belum tersedia.</div></div></div>';
    return '<div class="lb-ex"><span class="lb-ex-tag">' + x[1] + '</span><div><div class="lb-ex-en">' + lbEsc(e.en) + ' ' + lbAudioBtn(e.en, 'en') + '</div><div class="lb-ex-id">' + lbEsc(e.id || '') + '</div></div></div>';
  }).join('');
  const t = tip || (d && d.tip);
  return rows + (t ? '<div class="lb-tip"> ' + lbEsc(t) + '</div>' : '');
}
function lbExValid(d) {
  if (!d || typeof d !== 'object') return false;
  return ['v1', 'v2', 'v3', 'ing', 's'].filter(function (k) { return d[k] && d[k].en; }).length >= 5;
}
function lbAutoEx(v) {
  const fix = (typeof LB_EN_ARTIFIX !== 'undefined' && LB_EN_ARTIFIX[v.v1]) || String(v.arti || '').split(/[,;]/)[0].trim() || 'melakukannya';
  const intr = (typeof LB_EN_INTR !== 'undefined') && LB_EN_INTR[v.v1];
  const me = /^me/i.test(fix);
  const obj = intr ? '' : (me ? ' it' : ' something');
  const idObj = intr ? '' : (me ? 'nya' : ' sesuatu');
  const v2 = String(v.v2).split('/')[0], v3 = String(v.v3).split('/')[0];
  return {
    v1: { en: 'They ' + v.v1 + obj + ' every day.', id: 'Mereka ' + fix + idObj + ' setiap hari.' },
    v2: { en: 'She ' + v2 + obj + ' yesterday.', id: 'Dia ' + fix + idObj + ' kemarin.' },
    v3: { en: 'They have ' + v3 + obj + '.', id: 'Mereka sudah ' + fix + idObj + '.' },
    ing: { en: 'He is ' + v.ing + obj + ' right now.', id: 'Dia sedang ' + fix + idObj + ' sekarang.' },
    s: { en: 'She ' + v.s + obj + ' every morning.', id: 'Dia ' + fix + idObj + ' setiap pagi.' },
    tip: 'Contoh pola otomatis untuk memperlihatkan setiap bentuk. Tekan  Contoh AI untuk kalimat yang lebih natural.'
  };
}
function lbLocalEx(v) {
  if (typeof LB_EN_SPECIAL !== 'undefined' && LB_EN_SPECIAL[v.v1]) return LB_EN_SPECIAL[v.v1];
  const auto = lbAutoEx(v);
  const b = (typeof LB_EN_EX !== 'undefined') && LB_EN_EX[v.v1];
  if (!b) return auto;
  return {
    v1: { en: b[0][0], id: b[0][1] }, v2: { en: b[1][0], id: b[1][1] }, v3: { en: b[2][0], id: b[2][1] },
    ing: auto.ing, s: auto.s,
    tip: 'Contoh V1–V3 pilihan; V-ing dan V-s memakai pola otomatis. Tekan  Contoh AI untuk kelima bentuk versi AI.'
  };
}
function lbEnEx(i, force) {
  const v = LB_VERBS[i], box = $('lben-ex');
  if (!v || !box) return;
  const local = lbLocalEx(v);
  const cached = lbLoad('ex_' + v.v1, null);
  const show = function (d, tip) { if (LB.eDetail === i && $('lben-ex')) $('lben-ex').innerHTML = lbExHtml(v, d, tip); };
  if (cached && lbExValid(cached) && !force) { show(cached); return; }
  show(local);
  if (typeof ai !== 'function') return;
  if (typeof user === 'undefined' || !user) { if (force) lbToast('Masuk dulu untuk memakai contoh AI.'); return; }
  const failKey = 'exfail_' + v.v1, failed = lbLoad(failKey, 0);
  if (!force && failed && Date.now() - failed < 3600000) return;
  LB.exBusy = LB.exBusy || {};
  if (LB.exBusy[v.v1]) return;
  LB.exBusy[v.v1] = 1;
  const forms = { v1: v.v1, v2: String(v.v2).split('/')[0], v3: String(v.v3).split('/')[0], ing: v.ing, s: v.s };
  const sys = 'You are an accurate English grammar teacher for Indonesian learners. Output ONLY valid JSON, no markdown.';
  const ask = 'Verb: "' + v.v1 + '" (meaning: ' + (v.arti || '-') + '). Forms: V1="' + forms.v1 + '", V2="' + forms.v2 + '", V3="' + forms.v3 + '", V-ing="' + forms.ing + '", V-s="' + forms.s + '". For EACH form write ONE natural example sentence (level A2-B1) that uses that exact form correctly (V1: present simple or after a modal; V2: past simple; V3: present perfect or passive; V-ing: continuous; V-s: he/she/it). Add a natural Indonesian translation. Also add a short "tip" in Indonesian about a common mistake with this verb. JSON: {"v1":{"en":"","id":""},"v2":{"en":"","id":""},"v3":{"en":"","id":""},"ing":{"en":"","id":""},"s":{"en":"","id":""},"tip":""}';
  const note = document.createElement('div');
  note.className = 'lb-note';
  note.textContent = ' Menyempurnakan contoh dengan AI…';
  box.appendChild(note);
  ai(sys, [{ role: 'user', content: ask }], false, false, '', 'inggris', { temp: 0.4, json: 'object' })
    .then(function (t) {
      const m = String(t).match(/\{[\s\S]*\}/);
      let d = null;
      if (m) { try { d = JSON.parse(typeof fixJ === 'function' ? fixJ(m[0]) : m[0]); } catch (e) { d = null; } }
      if (!lbExValid(d)) throw new Error('Format contoh belum lengkap');
      lbStore('ex_' + v.v1, d);
      delete LB.exBusy[v.v1];
      show(d);
    })
    .catch(function (e) {
      delete LB.exBusy[v.v1];
      lbStore(failKey, Date.now());
      show(local, (local.tip || '') + ' (AI belum tersedia: ' + String(e.message || 'gagal').slice(0, 90) + ')');
      if (force) lbToast('Contoh AI gagal; contoh pola tetap ditampilkan.');
    });
}

/* ---------- FLASHCARD INGGRIS ---------- */
function lbEnFlash() {
  if (!LB.fc || LB.fc.lang !== 'en') LB.fc = { lang: 'en', deck: 'all', list: [], i: 0, show: false, ok: 0, done: false };
  const F = LB.fc;
  if (!F.list.length) return '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Hafalan</div><h3>Flashcard verb</h3></div><span class="lb-count">maks 20 kartu</span></div>' +
    '<div class="mut small" style="margin-bottom:10px">Pilih deck. Kartu menampilkan V1; balik untuk melihat arti dan V2/V3. Nilai "hafal" menaikkan tingkat penguasaan.</div>' +
    '<button class="btn full" onclick="lbFlashDeck(\'all\')"> Semua verb (' + LB_VERBS.length + ')</button>' +
    '<button class="btn alt full" onclick="lbFlashDeck(\'weak\')"> Perlu diulang</button>' +
    '<button class="btn alt full" onclick="lbFlashDeck(\'fav\')"> Favorit (' + lbFavs('en').length + ')</button></div>';
  if (F.i >= F.list.length) {
    const p = Math.round(F.ok / Math.max(1, F.list.length) * 100);
    return '<div class="card lb-flash-result"><div class="lb-big-ring"><b>' + p + '%</b><span>hafal</span></div><h3>Sesi selesai</h3><div class="mut small">' + F.ok + ' dari ' + F.list.length + ' kartu dijawab "hafal".</div><button class="btn full" onclick="lbEnFlashStart()"> Sesi baru</button><button class="btn alt full" onclick="lbFlashDeck(\'fav\')"> Deck favorit</button></div>';
  }
  const v = F.list[F.i];
  return '<div class="card lb-flash">' +
    '<div class="lb-flash-top"><span class="mut small">Kartu ' + (F.i + 1) + '/' + F.list.length + '</span><span class="lb-chip">' + (F.deck === 'fav' ? ' Favorit' : F.deck === 'weak' ? ' Perlu diulang' : ' Semua verb') + '</span></div>' +
    '<div class="lb-progress"><i style="width:' + Math.round(F.i / F.list.length * 100) + '%"></i></div>' +
    '<div class="lb-card-face ' + (F.show ? 'flipped' : '') + '" onclick="lbEnFlip()" tabindex="0" onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();lbEnFlip()}">' +
      (F.show
        ? '<div class="lb-face-back"><div class="lb-flash-arti">' + (v.arti ? lbEsc(v.arti) : '—') + '</div><div class="lb-flash-forms">' + lbEsc(v.v2) + ' · ' + lbEsc(v.v3) + '</div><div class="mut small">V-ing ' + lbEsc(v.ing) + ' · V-s ' + lbEsc(v.s) + '</div><div class="lb-flash-hint">ketuk untuk membalik</div></div>'
        : '<div class="lb-face-front"><div class="lb-flash-word">' + lbEsc(v.v1) + '</div>' + lbAudioBtn(v.v1, 'en', 'lg') + '<div class="lb-flash-hint">tebak artinya, lalu ketuk</div></div>') +
    '</div>' +
    '<div class="lb-flash-actions">' +
      (F.show
        ? '<button class="btn alt" onclick="lbEnRate(false)">Belum hafal</button><button class="btn" onclick="lbEnRate(true)">Hafal </button>'
        : '<button class="btn full" onclick="lbEnFlip()">Tampilkan arti</button>') +
    '</div>' +
    '<button class="x lb-center" style="margin-top:12px" onclick="lbEnFlashStart()">Ulangi dari awal</button>' +
  '</div>';
}
function lbEnFlashStart() {
  const deck = (LB.fc && LB.fc.deck) || 'all';
  lbFlashDeck(deck);
}
function lbFlashDeck(deck) {
  const st = lbStats('en'), m = lbMastery('en');
  let list = LB_VERBS.slice();
  if (deck === 'fav') list = list.filter(function (v) { return lbIsFav('en', v.v1); });
  if (deck === 'weak') list = list.filter(function (v) { return !m[v.v1] || m[v.v1].box < 3; });
  if (!list.length) { lbToast('Deck ini kosong.'); return; }
  LB.fc = { lang: 'en', deck: deck, list: lbShuffle(list).slice(0, 20), i: 0, show: false, ok: 0, done: false };
  lbRender();
}
function lbEnFlip() { if (!LB.fc || !LB.fc.list.length) return; LB.fc.show = !LB.fc.show; lbRender(); }
function lbEnRate(ok) {
  const F = LB.fc; if (!F || !F.list[F.i]) return;
  const v = F.list[F.i];
  if (ok) F.ok++;
  lbMarkMastery('en', v.v1, ok);
  lbAward('en', ok ? 6 : 2, ok);
  F.i++; F.show = false;
  lbRender();
}

/* ---------- LATIHAN INGGRIS ---------- */
const LB_EN_MODES = [['v2', 'Isi V2'], ['v3', 'Isi V3'], ['arti', 'Arti'], ['dengar', 'Listening'], ['mix', 'Campur']];
function lbEnQuiz() {
  const q = LB.q;
  const head = '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Latihan</div><h3>Uji pemahaman verb</h3></div>' +
    '<span class="lb-count">' + (q ? q.n + ' soal' : 'siap') + '</span></div>' +
    '<div class="lb-seg">' + LB_EN_MODES.map(function (m) { return '<button type="button" class="' + (q && (q.mix ? m[0] === 'mix' : q.mode === m[0]) ? 'on' : '') + '" onclick="lbEnStart(\'' + m[0] + '\')">' + m[1] + '</button>'; }).join('') + '</div>' +
    (q ? '<div class="lb-quiz-meta"><span>Benar <b>' + q.score + '</b>/' + q.n + '</span><span class="mut">' + lbEsc(q.modeLabel) + '</span></div>' : '<div class="mut small" style="margin-top:10px">Pilih jenis latihan. Setiap jawaban menambah XP dan memperbarui penguasaan verb.</div>') +
    '</div>';
  if (!q) return head + '<div class="card lb-empty"><div class="lb-empty-ico"></div><b>Mulai latihan</b><div class="mut small">Ketuk salah satu jenis di atas.</div></div>';
  return head + lbEnQBox();
}
function lbEnStart(mode) {
  LB.tabEn = 'quiz';
  const mix = mode === 'mix';
  if (mix) mode = ['v2', 'v3', 'arti', 'dengar'][Math.floor(Math.random() * 4)];
  const v = LB_VERBS[Math.floor(Math.random() * LB_VERBS.length)];
  const q = { mode: mode, mix: mix, modeLabel: { v2: 'Isi bentuk V2', v3: 'Isi bentuk V3', arti: 'Pilih arti yang tepat', dengar: 'Dengarkan lalu pilih verb' }[mode], v: v, n: (LB.q && LB.q.n) || 1, score: (LB.q && LB.q.score) || 0, done: false, ok: false, val: '' };
  if (mode === 'arti') {
    const pool = lbShuffle(LB_VERBS.filter(function (x) { return x.arti && x.arti !== v.arti; })).slice(0, 3).map(function (x) { return x.arti; });
    q.options = lbShuffle(pool.concat([v.arti]));
    q.answer = q.options.indexOf(v.arti);
  } else if (mode === 'dengar') {
    const pool = lbShuffle(LB_VERBS.filter(function (x) { return x.v1 !== v.v1; })).slice(0, 3).map(function (x) { return x.v1; });
    q.options = lbShuffle(pool.concat([v.v1]));
    q.answer = q.options.indexOf(v.v1);
    setTimeout(function () { lbSay(v.v1, 'en'); }, 220);
  } else {
    q.answers = String(mode === 'v2' ? v.v2 : v.v3).split('/');
  }
  LB.q = q;
  lbRender();
}
function lbEnQBox() {
  const q = LB.q, v = q.v;
  let body = '';
  if (q.mode === 'v2' || q.mode === 'v3') {
    body = '<div class="lb-quiz-prompt">Bentuk <b>' + (q.mode === 'v2' ? 'V2 (past simple)' : 'V3 (past participle)') + '</b> dari <span class="lb-quiz-verb">' + lbEsc(v.v1) + '</span> adalah …</div>' +
      '<div class="lb-search"><span></span><input id="lbqinput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ketik jawaban..." value="' + lbEsc(q.done ? q.val : '') + '" ' + (q.done ? 'disabled' : '') + ' onkeydown="if(event.key===\'Enter\')lbEnCheck()"></div>' +
      (q.done ? '' : '<button class="btn full" onclick="lbEnCheck()">Periksa</button>');
  } else {
    body = '<div class="lb-quiz-prompt">' + (q.mode === 'dengar' ? 'Dengarkan bunyinya, lalu pilih verb yang benar.' : 'Apa arti <span class="lb-quiz-verb">' + lbEsc(v.v1) + '</span>?') + '</div>' +
      (q.mode === 'dengar' ? '<div style="text-align:center;margin:6px 0 14px">' + lbAudioBtn(v.v1, 'en', 'lg') + '</div>' : '') +
      q.options.map(function (o, k) {
        let cls = 'opt';
        if (q.done) { if (k === q.answer) cls += ' ok'; else if (k === q.pick) cls += ' no'; }
        return '<button type="button" class="' + cls + '" ' + (q.done ? 'disabled' : '') + ' onclick="lbEnPick(' + k + ')">' + lbEsc(o) + '</button>';
      }).join('');
  }
  const fb = q.done ? '<div class="lb-feedback ' + (q.ok ? 'ok' : 'no') + '">' +
    '<b>' + (q.ok ? '✅ Benar!' : '❌ Belum tepat') + '</b>' +
    (q.ok ? '' : '<div class="small">Jawaban benar: <b>' + lbEsc(q.mode === 'v2' ? v.v2 : q.mode === 'v3' ? v.v3 : q.mode === 'arti' ? v.arti : v.v1) + '</b></div>') +
    '<div class="small mut" style="margin-top:4px">' + lbEsc(v.v1) + ' — ' + lbEsc(v.arti || '') + ' · V2 ' + lbEsc(v.v2) + ' · V3 ' + lbEsc(v.v3) + '</div>' +
    '<button class="btn full" style="margin-top:10px" onclick="lbEnNext()">Soal berikutnya ▶</button></div>' : '';
  return '<div class="card lb-quiz">' + body + fb + '</div>';
}
function lbEnCheck() {
  const q = LB.q; if (!q || q.done) return;
  const el = $('lbqinput'); const val = el ? el.value : '';
  if (!String(val).trim()) { lbToast('Tulis jawaban dulu.'); return; }
  const norm = function (s) { return String(s).toLowerCase().trim().replace(/\s+/g, ' '); };
  q.val = val;
  q.ok = (q.answers || []).some(function (a) { return norm(a) === norm(val); });
  lbEnFinishQ();
}
function lbEnPick(k) {
  const q = LB.q; if (!q || q.done) return;
  q.pick = k; q.ok = k === q.answer;
  lbEnFinishQ();
}
function lbEnFinishQ() {
  const q = LB.q;
  q.done = true; q.n = (q.n || 1);
  if (q.ok) q.score = (q.score || 0) + 1;
  lbMarkMastery('en', q.v.v1 + ':' + q.mode, q.ok);
  lbAward('en', q.ok ? 10 : 2, q.ok);
  lbRender();
}
function lbEnNext() {
  const q = LB.q; if (!q) return;
  const keep = { n: q.n + 1, score: q.score };
  const mix = q.mix;
  const mode = mix ? ['v2', 'v3', 'arti', 'dengar'][Math.floor(Math.random() * 4)] : q.mode;
  LB.q = null;
  const v = LB_VERBS[Math.floor(Math.random() * LB_VERBS.length)];
  LB.q = { mode: mode, mix: mix, modeLabel: { v2: 'Isi bentuk V2', v3: 'Isi bentuk V3', arti: 'Pilih arti yang tepat', dengar: 'Dengarkan lalu pilih verb' }[mode], v: v, n: keep.n, score: keep.score, done: false, ok: false, val: '' };
  if (mode === 'arti') {
    const pool = lbShuffle(LB_VERBS.filter(function (x) { return x.arti && x.arti !== v.arti; })).slice(0, 3).map(function (x) { return x.arti; });
    LB.q.options = lbShuffle(pool.concat([v.arti]));
    LB.q.answer = LB.q.options.indexOf(v.arti);
  } else if (mode === 'dengar') {
    const pool = lbShuffle(LB_VERBS.filter(function (x) { return x.v1 !== v.v1; })).slice(0, 3).map(function (x) { return x.v1; });
    LB.q.options = lbShuffle(pool.concat([v.v1]));
    LB.q.answer = LB.q.options.indexOf(v.v1);
    setTimeout(function () { lbSay(v.v1, 'en'); }, 220);
  } else {
    LB.q.answers = String(mode === 'v2' ? v.v2 : v.v3).split('/');
  }
  lbRender();
}

/* ---------- AI KHUSUS BAHASA ---------- */
const LB_SYS = {
  en: 'Kamu "English Coach", tutor bahasa Inggris khusus untuk pelajar Indonesia di aplikasi Ruang Belajar. Fokus HANYA pada bahasa Inggris: kosakata, verb 1-2-3, tata bahasa, pelafalan (IPA), ejaan, menulis, membaca, listening, dan persiapan TOEFL/IELTS dasar. Gaya: jawab inti langsung di awal, lalu penjelasan singkat berpoin, lalu 2-3 contoh kalimat dengan terjemahan Indonesia. Sebutkan IPA dalam / / untuk kata sulit. Jika pengguna salah, koreksi dengan sopan dan tunjukkan bentuk yang benar. Gunakan bahasa Indonesia sebagai bahasa penjelas. Jangan membahas topik di luar bahasa Inggris; arahkan kembali dengan singkat. Jangan mengarang aturan; bila ragu, katakan ragu. Format rapi, tanpa tabel lebar.',
  jp: 'Kamu "Sakura Sensei", tutor bahasa Jepang khusus untuk pelajar Indonesia di aplikasi Ruang Belajar. Fokus HANYA pada bahasa Jepang: hiragana, katakana, kanji N5-N4, kosakata, partikel, pola kalimat, percakapan, pelafalan, dan budaya yang menempel pada bahasa. Selalu tulis kalimat Jepang dalam tulisan asli, lalu romaji, lalu terjemahan Indonesia. Jelaskan partikel dan urutan kata SOV. Beri 2-3 contoh pendek. Koreksi kesalahan dengan sopan. Gunakan bahasa Indonesia sebagai bahasa penjelas. Jangan membahas topik di luar bahasa Jepang. Jangan mengarang bacaan kanji; bila ragu, katakan ragu. Format rapi, tanpa tabel lebar.'
};
const LB_STARTERS = {
  en: ['Jelaskan perbedaan V2 dan V3 dengan contoh', 'Buat 5 kalimat present perfect', 'Kapan pakai have been vs had been?', 'Perbaiki kalimat saya: I am go to school yesterday'],
  jp: ['Jelaskan partikel は dan が', 'Buat perkenalan diri dalam bahasa Jepang', 'Apa beda に dan で?', 'Latih saya percakapan di restoran']
};
function lbChat(lang) {
  if (!LB.chat[lang]) {
    LB.chat[lang] = lbLoad('chat_' + lang, []);
    if (!Array.isArray(LB.chat[lang])) LB.chat[lang] = [];
  }
  return LB.chat[lang];
}
function lbChatSave(lang) { lbStore('chat_' + lang, lbChat(lang).slice(-30)); }
function lbChatHtml(lang) {
  const c = lbChat(lang);
  if (!c.length) return '<div class="lb-chat-empty"><div class="lb-empty-ico">' + (lang === 'jp' ? '' : '') + '</div><b>' + (lang === 'jp' ? 'Sakura Sensei' : 'English Coach') + ' siap membantu</b><div class="mut small">Tanyakan kosakata, tata bahasa, pelafalan, atau minta latihan.</div></div>';
  return c.map(function (m) {
    const txt = lbText(m.content);
    if (m.role === 'user') return '<div class="msg user">' + lbEsc(txt) + '</div>';
    const pending = /^⏳/.test(txt);
    return '<div class="msg assistant ' + (pending ? 'pending' : '') + '">' + (pending ? lbEsc(txt) : lbFmt(txt)) + '</div>';
  }).join('');
}
function lbChatDraw(lang) {
  const box = $('lbchat'); if (!box) return;
  box.innerHTML = lbChatHtml(lang);
  box.scrollTop = box.scrollHeight;
}
function lbQuick(text) {
  const el = $('lbci'); if (el) el.value = text;
  lbSend(LB.lang);
}
async function lbSend(lang) {
  const inp = $('lbci'); if (!inp) return;
  const v = inp.value.trim(); if (!v) return;
  inp.value = '';
  const c = lbChat(lang);
  c.push({ role: 'user', content: v }, { role: 'assistant', content: '⏳ Menyusun jawaban...' });
  lbChatSave(lang); lbChatDraw(lang);
  const hist = c.slice(0, -1).filter(function (m) { return !/^⏳/.test(lbText(m.content)); }).slice(-8).map(function (m) { return { role: m.role, content: lbText(m.content) }; });
  try {
    if (typeof ai !== 'function') throw new Error('AI belum siap');
    // Kedua tutor memakai jalur umum yang sama; batasan materi sudah dijaga oleh LB_SYS.
    // Sebelumnya 'inggris' memakai routing penyedia berbeda yang bisa gagal total.
    const t = await ai(LB_SYS[lang], hist, false, false, '', 'sekolah', { temp: 0.5 });
    const out = lbText(t).trim();
    if (!out) throw new Error('Jawaban kosong dari server AI');
    c[c.length - 1].content = out;
    lbAward(lang, 2, null);
  } catch (e) {
    c[c.length - 1].content = '⚠️ ' + (e.message || 'AI gagal menjawab');
  }
  lbChatSave(lang);
  if (LB.lang === lang) lbChatDraw(lang);
}
function lbClearChat() {
  const lang = LB.lang;
  if (!confirm('Hapus seluruh percakapan ' + (lang === 'jp' ? 'Jepang' : 'Inggris') + '?')) return;
  LB.chat[lang] = []; lbChatSave(lang); lbChatDraw(lang);
}
function lbChatView(lang, title, sub, starters) {
  return '<div class="card lb-panel lb-ai">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">AI khusus</div><h3>' + title + '</h3></div><span class="lb-live">● aktif</span></div>' +
    '<div class="mut small" style="margin-bottom:10px">' + sub + '</div>' +
    '<div id="lbchat" class="lb-chat">' + lbChatHtml(lang) + '</div>' +
    '<div class="lb-starters">' + starters.map(function (s) { return '<button type="button" class="lb-chip lb-chip-btn" onclick="lbQuick(' + JSON.stringify(s).replace(/"/g, '&quot;') + ')">' + lbEsc(s) + '</button>'; }).join('') + '</div>' +
    '<div class="lb-compose"><textarea id="lbci" rows="2" placeholder="Tulis pertanyaanmu..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();lbSend(\'' + lang + '\'\').then(function(){var e=document.getElementById(\'lbci\');if(e)e.focus()})}"></textarea><button type="button" class="btn" onclick="lbSend(\'' + lang + '\')">Kirim</button></div>' +
    '<div class="lb-chat-foot"><span class="mut small">Jawaban bisa keliru — periksa ulang.</span><button type="button" class="x" onclick="lbClearChat()">Hapus percakapan</button></div>' +
  '</div>';
}
function lbEnAI() { return lbChatView('en', ' English Coach', 'AI ini hanya membahas bahasa Inggris: grammar, verb, pelafalan, dan latihan menulis.', LB_STARTERS.en); }
function lbGoal(lang) {
  const s = lbStats(lang), x = (s.days || {})[lbToday()] || 0, goal = 30, p = Math.min(100, Math.round(x / goal * 100));
  return '<div class="card lb-panel lb-goal"><div class="lb-panel-head"><div><div class="lb-eyebrow">Target hari ini</div><h3>' + x + ' / ' + goal + ' XP</h3></div><span class="lb-count">' + p + '%</span></div><div class="lb-progress"><i style="width:' + p + '%"></i></div><div class="mut small" style="margin-top:8px">' + (x >= goal ? ' Target tercapai! Jaga streak dengan satu sesi kecil lagi.' : 'Kurang ' + (goal - x) + ' XP lagi — sekitar ' + Math.ceil((goal - x) / 10) + ' soal atau ' + Math.ceil((goal - x) / 6) + ' kartu.') + '</div></div>';
}

/* ---------- PROGRES INGGRIS ---------- */
function lbEnStats() {
  const s = lbStats('en'), m = lbMastery('en'), keys = Object.keys(m);
  const mastered = keys.filter(function (k) { return m[k].box >= 4; }).length;
  const learn = keys.filter(function (k) { return m[k].box > 0 && m[k].box < 4; }).length;
  const weak = keys.filter(function (k) { return m[k].seen >= 2 && m[k].box < 2; }).slice(0, 8).map(function (k) { return k.split(':')[0]; });
  return lbGoal('en') + '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Progres</div><h3>Perjalanan bahasa Inggrismu</h3></div><span class="lb-count">' + (s.xp || 0) + ' XP</span></div>' +
    '<div class="lb-statgrid">' +
      '<div class="lb-stat"><b>' + (s.streak || 0) + '</b><span>hari beruntun</span></div>' +
      '<div class="lb-stat"><b>' + (s.tries ? Math.round(s.ok / s.tries * 100) : 0) + '%</b><span>akurasi</span></div>' +
      '<div class="lb-stat"><b>' + mastered + '</b><span>verb dikuasai</span></div>' +
      '<div class="lb-stat"><b>' + learn + '</b><span>sedang dipelajari</span></div>' +
    '</div>' +
    '<div class="lb-bars">' + (function () {
      const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); days.push({ k: k, v: (s.days || {})[k] || 0, l: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()] }); }
      const mx = Math.max.apply(null, days.map(function (x) { return x.v; }).concat([10]));
      return days.map(function (x) { return '<div class="lb-bar"><i style="height:' + Math.round(x.v / mx * 100) + '%" title="' + x.v + ' XP"></i><span>' + x.l + '</span></div>'; }).join('');
    })() + '</div>' +
    '<div class="mut small" style="margin-top:8px">XP harian 7 hari terakhir. Belajar sedikit tapi rutin lebih efektif.</div>' +
  '</div>' +
  (weak.length ? '<div class="card lb-panel"><h3> Perlu diulang</h3><div class="lb-chips">' + weak.map(function (w) { return '<button type="button" class="lb-chip lb-chip-btn" onclick="lbEnFind(\'' + w.replace(/'/g, '') + '\')">' + lbEsc(w) + '</button>'; }).join('') + '</div><button class="btn alt full" onclick="lbFlashDeck(\'weak\')"> Flashcard yang lemah</button></div>' : '') +
    '<div class="card lb-panel"><div class="lb-panel-head"><h3>Pengaturan</h3></div><div class="mut small">Data progres disimpan di perangkat ini, bukan di server.</div><button class="btn red full" onclick="lbReset(\'en\')">Reset progres Inggris</button></div>';
}
function lbEnFind(w) {
  LB.eq = w; LB.eFilter = 'all'; LB.ePage = 1; LB.tabEn = 'verbs';
  const idx = LB_VERBS.findIndex(function (v) { return v.v1 === w; });
  LB.eDetail = idx;
  lbRender();
  const b = $('lben-detail'); if (b) { try { b.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }
}
function lbReset(lang) {
  if (!confirm('Reset semua progres dan penguasaan ' + (lang === 'jp' ? 'Jepang' : 'Inggris') + '?')) return;
  try { localStorage.removeItem('lb_stats_' + lang); localStorage.removeItem('lb_mastery_' + lang); } catch (e) { }
  lbToast('Progres direset'); lbRender();
}

/* ================= BAHASA JEPANG ================= */
function lbJpKana() {
  const script = LB.ks || 'hira';
  const conv = script === 'kata' ? lbToKatakana : function (x) { return x; };
  return '<div class="card lb-panel">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">Tulisan dasar</div><h3>Hiragana & Katakana</h3></div><span class="lb-count">' + (LB_KANA_ROWS.length) + ' kelompok</span></div>' +
    '<div class="lb-seg" role="group" aria-label="Pilih aksara">' +
      '<button type="button" class="' + (script === 'hira' ? 'on' : '') + '" onclick="lbKanaSet(\'hira\')">あ Hiragana</button>' +
      '<button type="button" class="' + (script === 'kata' ? 'on' : '') + '" onclick="lbKanaSet(\'kata\')">ア Katakana</button>' +
    '</div>' +
    '<div class="mut small" style="margin:8px 0 4px">Ketuk huruf untuk mendengar bunyinya. Baris dakuten (゛) mengubah bunyi, handakuten (゜) membuat bunyi p, dan youon menggabungkan huruf kecil ゃゅょ.</div>' +
    '<div class="lb-kana-cards">' + LB_KANA_ROWS.map(function (r) {
      const ks = r[1].split(' '), rs = r[2].split(' ');
      return '<div class="lb-kana-row"><div class="lb-kana-rowname">' + lbEsc(r[0]) + '</div><div class="lb-kana-cells">' + ks.map(function (k, i) {
        const ch = conv(k);
        return '<button type="button" class="lb-kana" data-w="' + lbEsc(ch) + '" data-l="jp" onclick="lbSayEl(this)"><b>' + lbEsc(ch) + '</b><span>' + lbEsc(rs[i]) + '</span></button>';
      }).join('') + '</div></div>';
    }).join('') + '</div>' +
    '<div class="lb-cta-row"><button class="btn" onclick="lbJpStartQuiz(\'kana\')"> Latihan kana</button><button class="btn alt" onclick="lbJpStartQuiz(\'kanji\')">漢 Latihan kanji</button></div>' +
  '</div>' +
  '<div class="card lb-panel"><h3>Tabel cepat</h3><div class="lb-kana-tips"><div><b>Dakuten ゛</b><span>か→が, さ→ざ, た→だ, は→ば</span></div><div><b>Handakuten ゜</b><span>は→ぱ (hanya baris h)</span></div><div><b>Youon</b><span>き + ゃ = きゃ (kya)</span></div><div><b>ッ (tsu kecil)</b><span>menandai jeda/hentakan: がっこう (gakkou)</span></div><div><b>ー</b><span>memperpanjang vokal pada katakana: コーヒー (koohii)</span></div></div></div>';
}
function lbKanaSet(s) { LB.ks = s; lbRender(); }

function lbJpKanji() {
  const q = (LB.jqKanji || '').toLowerCase().trim();
  const list = LB_KANJI.filter(function (x) {
    return !q || (x.k + ' ' + x.on + ' ' + x.kun + ' ' + x.arti + ' ' + x.words.map(function (w) { return w.w + w.r + w.a; }).join(' ')).toLowerCase().indexOf(q) >= 0;
  });
  const sel = list.filter(function (x) { return x.k === LB.kSel; })[0] || null;
  return '<div class="card lb-panel">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">Kanji dasar</div><h3>' + LB_KANJI.length + ' kanji N5</h3></div><span class="lb-count">' + list.length + ' tampil</span></div>' +
    '<div class="lb-search"><span></span><input type="search" autocomplete="off" placeholder="Cari kanji, cara baca, atau arti..." value="' + lbEsc(LB.jqKanji || '') + '" oninput="lbKanjiSearch(this.value)"></div>' +
    '<div class="lb-kanji-grid">' + (list.length ? list.map(function (x) {
      return '<button type="button" class="lb-kanji ' + (LB.kSel === x.k ? 'on' : '') + '" onclick="lbKanjiOpen(\'' + lbEsc(x.k) + '\')"><b>' + lbEsc(x.k) + '</b><span>' + lbEsc(x.arti) + '</span></button>';
    }).join('') : '<div class="mut small">Tidak ada kanji yang cocok.</div>') + '</div>' +
  '</div>' +
  (sel ? lbKanjiDetail(sel) : '<div class="card lb-panel mut small">Ketuk kanji untuk melihat on\'yomi, kun\'yomi, contoh kata, dan cara membacanya.</div>') +
  '<div class="card lb-panel"><div class="lb-panel-head"><h3>Latihan kanji</h3></div><div class="mut small">Uji arti dan cara baca kanji yang sudah kamu lihat.</div><button class="btn full" onclick="lbJpStartQuiz(\'kanji\')"> Mulai kuis kanji</button></div>';
}
function lbKanjiSearch(v) {
  LB.jqKanji = v;
  const box = $('lbmain'); if (!box) return;
  box.innerHTML = lbJpKanji();
  const inp = box.querySelector('input[type=search]'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function lbKanjiOpen(k) { LB.kSel = LB.kSel === k ? '' : k; lbRender(); }
/* ---------- KOSAKATA JEPANG ---------- */
function lbVocabCats() { const c = []; LB_JP_VOCAB.forEach(function (v) { if (c.indexOf(v.cat) < 0) c.push(v.cat); }); return c; }
function lbVocabList() {
  const q = (LB.vq || '').toLowerCase().trim(), cat = LB.jcat || 'Semua';
  return LB_JP_VOCAB.filter(function (v) {
    if (cat !== 'Semua' && v.cat !== cat) return false;
    return !q || (v.k + ' ' + v.r + ' ' + v.a).toLowerCase().indexOf(q) >= 0;
  });
}
function lbJpVocab() {
  const list = lbVocabList();
  if (LB.vf && LB.vf.on) return lbVocabFlashView();
  return '<div class="card lb-panel">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">Kosakata</div><h3>' + LB_JP_VOCAB.length + ' kata sehari-hari</h3></div><span class="lb-count">' + list.length + ' tampil</span></div>' +
    '<div class="lb-search"><span></span><input type="search" autocomplete="off" placeholder="Cari kata, romaji, atau arti..." value="' + lbEsc(LB.vq || '') + '" oninput="lbVocabSearch(this.value)"></div>' +
    '<div class="lb-chips lb-cats">' + ['Semua'].concat(lbVocabCats()).map(function (c) {
      return '<button type="button" class="lb-chip lb-chip-btn ' + ((LB.jcat || 'Semua') === c ? 'on' : '') + '" onclick="lbVocabCat(\'' + lbEsc(c) + '\')">' + lbEsc(c) + '</button>';
    }).join('') + '</div>' +
    '<div class="lb-vocab-list">' + (list.length ? list.map(function (v, i) {
      return '<div class="lb-vocab"><div class="lb-vocab-main"><b>' + lbEsc(v.k) + '</b><span>' + lbEsc(v.r) + '</span><em>' + lbEsc(v.a) + '</em></div>' + lbAudioBtn(v.k, 'jp') + '</div>';
    }).join('') : '<div class="mut small">Tidak ada kata yang cocok.</div>') + '</div>' +
    '<div class="lb-cta-row"><button class="btn" onclick="lbVocabFlashStart()"> Flashcard</button><button class="btn alt" onclick="lbJpStartQuiz(\'vocab\')"> Kuis kosakata</button></div>' +
  '</div>';
}
function lbVocabSearch(v) {
  LB.vq = v; const box = $('lbmain'); if (!box) return;
  box.innerHTML = lbJpVocab();
  const inp = box.querySelector('input[type=search]'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function lbVocabCat(c) { LB.jcat = c; const box = $('lbmain'); if (box) box.innerHTML = lbJpVocab(); }
function lbVocabFlashStart() {
  const list = lbVocabList();
  if (!list.length) { lbToast('Tidak ada kata untuk deck ini.'); return; }
  LB.vf = { on: true, list: lbShuffle(list).slice(0, 20), i: 0, show: false, ok: 0 };
  lbRender();
}
function lbVocabFlashView() {
  const F = LB.vf;
  if (F.i >= F.list.length) {
    const p = Math.round(F.ok / Math.max(1, F.list.length) * 100);
    return '<div class="card lb-flash-result"><div class="lb-big-ring"><b>' + p + '%</b><span>hafal</span></div><h3>Sesi selesai</h3><div class="mut small">' + F.ok + ' dari ' + F.list.length + ' kartu dijawab hafal.</div><button class="btn full" onclick="lbVocabFlashStart()"> Sesi baru</button><button class="btn alt full" onclick="lbVocabFlashStop()">Kembali ke daftar</button></div>';
  }
  const v = F.list[F.i];
  return '<div class="card lb-flash">' +
    '<div class="lb-flash-top"><span class="mut small">Kartu ' + (F.i + 1) + '/' + F.list.length + '</span><span class="lb-chip">' + lbEsc(v.cat) + '</span></div>' +
    '<div class="lb-progress"><i style="width:' + Math.round(F.i / F.list.length * 100) + '%"></i></div>' +
    '<div class="lb-card-face ' + (F.show ? 'flipped' : '') + '" onclick="lbVocabFlip()" tabindex="0" onkeydown="if(event.key===\'Enter\')lbVocabFlip()">' +
      (F.show ? '<div class="lb-face-back"><div class="lb-flash-arti">' + lbEsc(v.a) + '</div><div class="lb-flash-forms">' + lbEsc(v.k) + '</div><div class="mut small">' + lbEsc(v.r) + '</div><div class="lb-flash-hint">ketuk untuk membalik</div></div>'
        : '<div class="lb-face-front"><div class="lb-flash-word lb-jpword">' + lbEsc(v.k) + '</div>' + lbAudioBtn(v.k, 'jp', 'lg') + '<div class="lb-flash-hint">tebak artinya, lalu ketuk</div></div>') +
    '</div>' +
    '<div class="lb-flash-actions">' + (F.show
      ? '<button class="btn alt" onclick="lbVocabRate(false)">Belum hafal</button><button class="btn" onclick="lbVocabRate(true)">Hafal </button>'
      : '<button class="btn full" onclick="lbVocabFlip()">Tampilkan arti</button>') + '</div>' +
    '<button class="x lb-center" style="margin-top:12px" onclick="lbVocabFlashStop()">Keluar dari flashcard</button>' +
  '</div>';
}
function lbVocabFlip() { if (!LB.vf) return; LB.vf.show = !LB.vf.show; lbRender(); }
function lbVocabRate(ok) {
  const F = LB.vf; if (!F || !F.list[F.i]) return;
  if (ok) F.ok++;
  lbAward('jp', ok ? 6 : 2, ok);
  lbMarkMastery('jp', F.list[F.i].k, ok);
  F.i++; F.show = false; lbRender();
}
function lbVocabFlashStop() { LB.vf = null; lbRender(); }

/* ---------- TATA BAHASA JEPANG ---------- */
function lbJpGrammar() {
  return '<div class="card lb-panel">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">Pola kalimat</div><h3>' + LB_JP_GRAMMAR.length + ' pola wajib</h3></div><span class="lb-count">N5–N4</span></div>' +
    '<div class="mut small" style="margin-bottom:6px">Urutan kalimat Jepang: SOV (subjek–objek–kata kerja). Partikel menandai peran tiap kata.</div>' +
    '<div class="lb-grammar">' + LB_JP_GRAMMAR.map(function (g, i) {
      return '<details class="lb-gram"><summary><b>' + lbEsc(g.t) + '</b><code>' + lbEsc(g.f) + '</code></summary>' +
        '<p>' + lbEsc(g.e) + '</p>' +
        g.ex.map(function (e) {
          return '<div class="lb-gex"><div class="lb-gex-jp">' + lbEsc(e[0]) + ' ' + lbAudioBtn(e[0], 'jp') + '</div><div class="lb-gex-r">' + lbEsc(e[1]) + '</div><div class="lb-gex-id">' + lbEsc(e[2]) + '</div></div>';
        }).join('') + '</details>';
    }).join('') + '</div>' +
  '</div>' +
  lbBuilderView();
}
function lbBuilderView() {
  if (!LB.bld) return '<div class="card lb-panel"><div class="lb-panel-head"><div><div class="lb-eyebrow">Latihan aktif</div><h3>Susun kalimat</h3></div></div><div class="mut small">Susun potongan kalimat Jepang menjadi kalimat yang benar.</div><button class="btn full" onclick="lbBuildStart()">▶ Mulai menyusun</button></div>';
  const b = LB.bld, it = b.item;
  const picked = b.picked.map(function (id) { return b.pool.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
  return '<div class="card lb-panel lb-builder">' +
    '<div class="lb-panel-head"><div><div class="lb-eyebrow">Susun kalimat</div><h3>Arti: ' + lbEsc(it.id) + '</h3></div><button class="x" onclick="lbBuildStart()">Soal lain</button></div>' +
    '<div class="lb-built">' + (picked.length ? picked.map(function (p) { return '<button type="button" class="lb-token in" onclick="lbBuildRemove(' + p.id + ')">' + lbEsc(p.text) + '</button>'; }).join('') : '<span class="mut small">Ketuk potongan di bawah…</span>') + '</div>' +
    '<div class="lb-pool">' + b.pool.map(function (p) {
      if (b.picked.indexOf(p.id) >= 0) return '';
      return '<button type="button" class="lb-token" onclick="lbBuildPick(' + p.id + ')">' + lbEsc(p.text) + '</button>';
    }).join('') + '</div>' +
    (b.done ? '<div class="lb-feedback ' + (b.ok ? 'ok' : 'no') + '"><b>' + (b.ok ? '✅ Kalimat benar!' : '❌ Belum tepat') + '</b><div class="lb-gex-jp" style="margin-top:6px">' + lbEsc(it.jp) + ' ' + lbAudioBtn(it.jp, 'jp') + '</div><div class="small mut">' + lbEsc(it.note) + '</div><button class="btn full" style="margin-top:10px" onclick="lbBuildStart()">Soal berikutnya ▶</button></div>'
      : '<div class="lb-cta-row"><button class="btn" onclick="lbBuildCheck()" ' + (picked.length ? '' : 'disabled') + '>Periksa susunan</button><button class="btn alt" onclick="lbBuildReset()">Ulangi</button></div>') +
  '</div>';
}
function lbBuildStart() {
  const it = LB_JP_BUILD[Math.floor(Math.random() * LB_JP_BUILD.length)];
  const pool = it.parts.map(function (t, i) { return { id: i, text: t }; });
  LB.bld = { item: it, pool: lbShuffle(pool), picked: [], done: false, ok: false };
  lbRender();
}
function lbBuildPick(id) { const b = LB.bld; if (!b || b.done) return; b.picked.push(id); lbRender(); }
function lbBuildRemove(id) { const b = LB.bld; if (!b || b.done) return; b.picked = b.picked.filter(function (x) { return x !== id; }); lbRender(); }
function lbBuildReset() { const b = LB.bld; if (!b) return; b.picked = []; b.done = false; lbRender(); }
function lbBuildCheck() {
  const b = LB.bld; if (!b || !b.picked.length) return;
  const made = b.picked.map(function (id) { return b.pool.filter(function (p) { return p.id === id; })[0].text; }).join('');
  b.done = true; b.ok = made === b.item.jp;
  lbAward('jp', b.ok ? 10 : 2, b.ok);
  lbMarkMastery('jp', 'build:' + b.item.jp, b.ok);
  lbRender();
}

function lbKanjiDetail(x) {
  return '<div class="card lb-detail">' +
    '<div class="lb-detail-head"><div><div class="lb-eyebrow">Kanji</div><h2 class="lb-detail-title lb-kanji-big">' + lbEsc(x.k) + '</h2><div class="lb-arti">' + lbEsc(x.arti) + '</div></div><div class="lb-detail-actions">' + lbAudioBtn(x.k, 'jp', 'lg') + '<button type="button" class="lb-close" onclick="lbKanjiOpen(\'' + lbEsc(x.k) + '\')">Tutup</button></div></div>' +
    '<div class="lb-kanji-read"><div><span>On\'yomi</span><b>' + lbEsc(x.on) + '</b></div><div><span>Kun\'yomi</span><b>' + lbEsc(x.kun) + '</b></div></div>' +
    '<div class="lb-word-list">' + x.words.map(function (w) {
      return '<div class="lb-word"><div><b>' + lbEsc(w.w) + '</b><span>' + lbEsc(w.r) + '</span><em>' + lbEsc(w.a) + '</em></div>' + lbAudioBtn(w.w, 'jp') + '</div>';
    }).join('') + '</div>' +
    '<div class="lb-tip"> On\'yomi dipakai dalam kata gabungan (mis. 日本), kun\'yomi dipakai saat kanji berdiri sendiri atau diikuti hiragana (mis. 日にち).</div>' +
  '</div>';
}

