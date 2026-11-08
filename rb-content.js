/* ==========================================================================
   RUANG BELAJAR — V26 CONTENT
   1. 📚 Belajar Soal  : belajar & melatih soal yang sudah kamu buat, dibantu AI
   2. ⚗️ Strategi Alchemist : kurikulum lengkap MSNR + SMC/CRT (istilah, level,
      storyline, model entry, sesi, risiko, checklist, studi kasus, kuis)
   ========================================================================== */

/* ==========================================================================
   1. BELAJAR SOAL
   ========================================================================== */
const BSO = { bank: [], view: 'daftar', q: '', lv: '', type: '', open: {}, sel: {}, flash: 0, flip: false, loaded: false, loading: false };

function bsoTag(t) {
  if (!t) return 'Pilihan ganda';
  return ({ pg: 'Pilihan ganda', bs: 'Benar/Salah', multi: 'Pilih semua', essay: 'Essay' })[t] || 'Pilihan ganda';
}
function bsoKeyHtml(q) {
  if (!q) return '';
  if (q.tipe === 'essay') return '<div class="rb-q-body"><b>Kunci jawaban:</b><div style="margin-top:4px">' + fmt(String(q.k || '—')) + '</div>'
    + ((q.kw || []).length ? '<div class="rb-note" style="margin-top:6px">Kata kunci: ' + rb26Safe((q.kw || []).join(', ')) + '</div>' : '')
    + (q.e ? '<div style="margin-top:6px"><b>Rubrik:</b> ' + fmt(q.e) + '</div>' : '') + '</div>';
  const opts = (q.o || []).map(function (o, i) {
    const right = Array.isArray(q.a) ? q.a.indexOf(i) >= 0 : i === q.a;
    return '<div style="padding:3px 0;color:' + (right ? 'var(--ok)' : 'var(--mut)') + '">' + (right ? '✔ ' : '• ') + rb26Safe(String.fromCharCode(65 + i) + '. ' + o) + '</div>';
  }).join('');
  return '<div class="rb-q-body"><div><b>Kunci:</b></div>' + opts + (q.e ? '<div class="exp" style="margin-top:8px">💡 ' + fmt(q.e) + '</div>' : '') + '</div>';
}
function pSoal() {
  if (typeof isUmum === 'function' && isUmum()) {
    $('pane').innerHTML = '<div class="card"><h3>📚 Belajar Soal</h3><div class="rb-muted-box">Mapel <b>Umum (Trivia Dunia)</b> membuat soal otomatis dari data global, jadi tidak punya bank soal sendiri. Pilih pelajaran lain di atas untuk belajar dari soal yang kamu buat.</div></div>';
    return;
  }
  $('pane').innerHTML = '<div class="card"><div class="rb-card-head"><h3>📚 Belajar Soal — ' + rb26Safe(S.mapel) + '</h3>'
    + '<div class="rb-mode"><button type="button" class="' + (BSO.view === 'daftar' ? 'on' : '') + '" onclick="bsoSetView(\'daftar\')">📖 Daftar</button>'
    + '<button type="button" class="' + (BSO.view === 'kartu' ? 'on' : '') + '" onclick="bsoSetView(\'kartu\')">🎴 Kartu</button></div></div>'
    + '<div class="rb-note">Semua soal yang kamu buat di tab <b>✨ Buat Soal</b> muncul di sini. Baca pembahasannya, minta penjelasan AI, lalu latih hanya soal yang kamu pilih.</div>'
    + '<div class="row" style="margin-top:10px"><div style="flex:2 1 220px"><label style="margin-top:0">Cari soal</label><input id="bsoq" placeholder="kata kunci..." autocomplete="off" oninput="BSO.q=this.value;bsoRender()" value="' + rb26Safe(BSO.q) + '"></div>'
    + '<div><label style="margin-top:0">Tingkat</label><select id="bsolv" onchange="BSO.lv=this.value;bsoRender()"><option value="">Semua tingkat</option>'
    + (typeof lvOptions === 'function' ? lvOptions() : []).map(function (l) { return '<option ' + (BSO.lv === l ? 'selected' : '') + '>' + rb26Safe(l) + '</option>'; }).join('')
    + '</select></div>'
    + '<div><label style="margin-top:0">Jenis</label><select id="bsoty" onchange="BSO.type=this.value;bsoRender()">'
    + [['', 'Semua jenis'], ['pg', 'Pilihan ganda'], ['bs', 'Benar/Salah'], ['multi', 'Pilih semua'], ['essay', 'Essay']].map(function (x) { return '<option value="' + x[0] + '" ' + (BSO.type === x[0] ? 'selected' : '') + '>' + x[1] + '</option>'; }).join('')
    + '</select></div></div>'
    + '<div class="rb-toolbar"><button class="btn" type="button" onclick="bsoTrainSel()">🎯 Latih soal terpilih</button>'
    + '<button class="btn alt" type="button" onclick="bsoRandom()">🎲 Acak 10 soal</button>'
    + '<button class="btn alt" type="button" onclick="bsoGen()">✨ Buat soal baru (AI)</button></div>'
    + '<div id="bsoact" class="rb-note"></div></div>'
    + '<div class="card"><div class="rb-card-head"><h3>✨ Buat soal dengan AI</h3><button class="x" type="button" onclick="bsoGen()">Generator lengkap ›</button></div>'
      + '<div class="rb-note">Buat soal latihan tambahan langsung dari tab ini. Soal yang jadi otomatis masuk bank dan daftar di bawah.</div>'
      + '<div class="row" style="margin-top:10px"><div style="flex:2 1 200px"><label style="margin-top:0">Topik</label><input id="bsotopic" placeholder="kosong = acak sesuai tingkat" autocomplete="off"></div>'
      + '<div><label style="margin-top:0">Jumlah</label><select id="bson"><option>5</option><option selected>10</option><option>15</option></select></div></div>'
      + '<button class="btn full" type="button" id="bsogenbtn" onclick="bsoGenInline()">Buat soal ✨</button>'
      + '<div id="bsogen" class="rb-note" style="margin-top:9px"></div></div>'
    + '<div id="bsolist"><div class="card mut small">Memuat soal...</div></div>';
  bsoLoad();
}
async function bsoLoad() {
  if (!user) { const box = $('bsolist'); if (box) box.innerHTML = '<div class="card warn">Masuk dulu untuk memuat bank soalmu.</div>'; return; }
  BSO.loading = true;
  try {
    const s = await db.collection('soal').where('uid', '==', user.uid).where('kategori', '==', S.sec).where('mapel', '==', S.mapel).limit(600).get();
    BSO.bank = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    BSO.loaded = true;
  } catch (e) {
    BSO.bank = []; BSO.loaded = true;
    const box = $('bsolist');
    if (box) box.innerHTML = '<div class="card warn">Bank soal belum bisa dimuat: ' + rb26Safe(e && e.message || e) + '</div>';
    return;
  } finally { BSO.loading = false; }
  bsoRender();
}
function bsoRows() {
  const q = rb26Norm(BSO.q);
  return BSO.bank.filter(function (x) {
    if (q && rb26Norm(x.q).indexOf(q) < 0) return false;
    if (BSO.lv && String(x.tingkat || '') !== BSO.lv) return false;
    if (BSO.type && String(x.tipe || 'pg') !== BSO.type) return false;
    return true;
  });
}
function bsoCountSel() { return Object.keys(BSO.sel).filter(function (k) { return BSO.sel[k]; }).length; }
function bsoRender() {
  const box = $('bsolist');
  if (!box) return;
  if (!BSO.loaded) { box.innerHTML = '<div class="card mut small">Memuat soal...</div>'; return; }
  const rows = bsoRows(), n = bsoCountSel();
  const act = $('bsoact');
  if (act) act.innerHTML = BSO.bank.length
    ? rb26Num(rows.length) + ' dari ' + rb26Num(BSO.bank.length) + ' soal ditampilkan • <b>' + n + '</b> dipilih'
    : '';
  if (!BSO.bank.length) {
    box.innerHTML = '<div class="card"><div class="rb-muted-box">Belum ada soal untuk <b>' + rb26Safe(S.mapel) + '</b>. Buat dulu dengan AI di tab <b>✨ Buat Soal</b> — soalnya otomatis muncul di sini.</div>'
      + '<button class="btn full" onclick="bsoGen()">✨ Buat soal sekarang</button></div>';
    return;
  }
  if (BSO.view === 'kartu') return bsoRenderCard(box, rows);
  if (!rows.length) { box.innerHTML = '<div class="card mut small">Tidak ada soal yang cocok dengan filter.</div>'; return; }
  box.innerHTML = '<div class="card"><div class="rb-card-head"><h3 style="font-size:.94rem">' + rb26Num(rows.length) + ' soal</h3>'
    + '<div class="rb-actions-inline"><button class="x" type="button" onclick="bsoAll(true)">Pilih semua</button><button class="x" type="button" onclick="bsoAll(false)">Kosongkan</button></div></div>'
    + rows.map(bsoItemHtml).join('') + '</div>';
}
function bsoItemHtml(x) {
  const id = x.id || '';
  const open = !!BSO.open[id], sel = !!BSO.sel[id];
  const tip = x.tipe || 'pg';
  return '<div class="rb-q' + (sel ? ' on' : '') + '" style="' + (sel ? 'border-color:var(--accent);background:var(--accent-soft)' : '') + '">'
    + '<div class="rb-q-top"><input class="rb-check" type="checkbox" ' + (sel ? 'checked' : '') + ' onchange="bsoSel(\'' + rb26Safe(id) + '\',this.checked)" aria-label="Pilih soal">'
    + '<div class="rb-q-main"><div class="rb-q-t" onclick="bsoOpen(\'' + rb26Safe(id) + '\')" style="cursor:pointer">' + rb26Safe(String(x.q || '').slice(0, 300)) + '</div>'
    + '<div class="rb-q-meta"><span class="rb-tag">' + bsoTag(tip) + '</span>'
    + (x.tingkat ? '<span class="rb-tag">🎓 ' + rb26Safe(x.tingkat) + '</span>' : '')
    + (x.teks ? '<span class="rb-tag">📖 bacaan</span>' : '')
    + (x.sub ? '<span class="rb-tag">🏷 ' + rb26Safe(x.sub) + '</span>' : '')
    + (x.sumber === 'ai' ? '<span class="rb-tag warn">🤖 AI</span>' : '')
    + '</div></div>'
    + '<button class="x" type="button" onclick="bsoOpen(\'' + rb26Safe(id) + '\')">' + (open ? '▲' : '▼') + '</button></div>'
    + (open ? '<div id="bsob_' + rb26Safe(id) + '">'
      + (x.teks ? '<div class="exp" style="margin-bottom:8px">📖 ' + fmt(x.teks) + '</div>' : '')
      + bsoKeyHtml(x)
      + '<div class="rb-toolbar" style="margin-bottom:0"><button class="btn alt" type="button" onclick="bsoExplain(\'' + rb26Safe(id) + '\')">🤖 Jelaskan & cara berpikir</button>'
      + '<button class="btn alt" type="button" onclick="bsoAskTutor(\'' + rb26Safe(id) + '\')">💬 Tanya Tutor</button></div>'
      + '<div id="bsoai_' + rb26Safe(id) + '"></div></div>' : '') + '</div>';
}
function bsoRenderCard(box, rows) {
  if (!rows.length) { box.innerHTML = '<div class="card mut small">Tidak ada soal untuk filter ini.</div>'; return; }
  if (BSO.flash >= rows.length) BSO.flash = 0;
  const x = rows[BSO.flash];
  box.innerHTML = '<div class="card"><div class="rb-card-head"><h3 style="font-size:.94rem">🎴 Kartu ' + (BSO.flash + 1) + ' / ' + rows.length + '</h3>'
    + '<span class="rb-tag">' + bsoTag(x.tipe) + '</span></div>'
    + (x.teks ? '<details style="margin-bottom:10px"><summary class="rb-note" style="cursor:pointer">📖 Lihat teks bacaan</summary><div class="exp" style="margin-top:8px">' + fmt(x.teks) + '</div></details>' : '')
    + '<div class="q">' + fmt(String(x.q || '')) + '</div>'
    + (BSO.flip ? bsoKeyHtml(x) + '<button class="btn alt full" style="margin-top:8px" type="button" onclick="bsoExplainCard(\'' + rb26Safe(x.id) + '\')">🤖 Penjelasan langkah demi langkah</button><div id="bsoai_card"></div>' : '<div class="rb-muted-box">Pikirkan jawabanmu dulu, lalu buka kunci.</div>')
    + '<div class="rb-toolbar" style="margin-top:12px"><button class="btn alt" type="button" onclick="bsoFlash(-1)">← Sebelumnya</button>'
    + '<button class="btn" type="button" onclick="bsoFlipCard()">' + (BSO.flip ? '🙈 Sembunyikan kunci' : '👁 Buka kunci') + '</button>'
    + '<button class="btn alt" type="button" onclick="bsoFlash(1)">Berikutnya →</button></div>'
    + (x.tipe === 'pg' || x.tipe === 'multi' || x.tipe === 'bs' ? '<button class="btn alt full" type="button" onclick="bsoPracticeOne(\'' + rb26Safe(x.id) + '\')">🎯 Latih soal ini saja</button>' : '')
    + '</div>';
}
function bsoSetView(v) {
  BSO.view = v === 'kartu' ? 'kartu' : 'daftar';
  BSO.flash = 0; BSO.flip = false;
  pSoal();
}
function bsoOpen(id) { BSO.open[id] = !BSO.open[id]; bsoRender(); }
function bsoSel(id, on) { BSO.sel[id] = !!on; bsoRender(); }
function bsoAll(on) { bsoRows().forEach(function (x) { BSO.sel[x.id] = !!on; }); bsoRender(); }
function bsoFlash(d) {
  const rows = bsoRows();
  if (!rows.length) return;
  BSO.flash = (BSO.flash + d + rows.length) % rows.length;
  BSO.flip = false;
  bsoRender();
}
function bsoFlipCard() { BSO.flip = !BSO.flip; bsoRender(); }
function bsoExplain(id) {
  const q = BSO.bank.find(function (x) { return x.id === id; });
  if (!q) return;
  const box = $('bsoai_' + id);
  if (!box) return;
  box.innerHTML = '<div class="exp" style="margin-top:9px">' + fmt(rb26ExplainQuestion(q, null)) + '</div>';
}
async function bsoExplainCard(id) {
  const q = BSO.bank.find(function (x) { return x.id === id; });
  const box = $('bsoai_card');
  if (!q || !box) return;
  box.innerHTML = '<div class="exp" style="margin-top:9px">⏳ Menyusun penjelasan...</div>';
  try {
    const text = await explainAI('Jelaskan soal ini langkah demi langkah dan kenapa kunci jawabannya benar.\nSoal: ' + q.q + '\nPilihan: ' + (q.o || []).map(function (o, i) { return String.fromCharCode(65 + i) + '. ' + o; }).join(' | ') + '\nKunci: ' + rb26AnswerKey(q));
    box.innerHTML = '<div class="exp" style="margin-top:9px">🤖 ' + fmt(text) + '</div>';
  } catch (e) {
    box.innerHTML = '<div class="exp" style="margin-top:9px">' + fmt(rb26ExplainQuestion(q, null)) + '</div>';
  }
}
function bsoAskTutor(id) {
  const q = BSO.bank.find(function (x) { return x.id === id; });
  if (!q) return;
  S.tab = 'tutor'; home();
  setTimeout(function () {
    const inp = $('ci');
    if (inp) { inp.value = 'Jelaskan langkah penyelesaian soal ini: ' + String(q.q || '').slice(0, 220); }
  }, 60);
}
function bsoNormalize(list) {
  const out = [];
  list.forEach(function (x) {
    const t = x.tipe || 'pg';
    if (t === 'pg' || t === 'bs') {
      if (!Array.isArray(x.o) || x.o.length < 2 || typeof x.a !== 'number') return;
      const o = (typeof shuffle === 'function' ? shuffle(x.o) : x.o.slice());
      const key = x.o[x.a];
      out.push(Object.assign({}, x, { tipe: t, o: o, a: o.indexOf(key) }));
    } else if (t === 'multi') {
      if (!Array.isArray(x.o) || !Array.isArray(x.a)) return;
      const o = (typeof shuffle === 'function' ? shuffle(x.o) : x.o.slice());
      const keys = x.a.map(function (i) { return x.o[i]; });
      out.push(Object.assign({}, x, { tipe: 'multi', o: o, a: keys.map(function (k) { return o.indexOf(k); }).filter(function (i) { return i >= 0; }).sort(function (a, b) { return a - b; }) }));
    } else if (t === 'essay') {
      if (!x.k) return;
      out.push(Object.assign({}, x, { o: [], a: 0 }));
    }
  });
  return out;
}
function bsoPracticeOne(id) {
  const q = BSO.bank.find(function (x) { return x.id === id; });
  if (!q) return;
  const list = bsoNormalize([q]);
  if (!list.length) return alert('Soal ini tidak lengkap.');
  S.sub = ''; S.jenis = ''; S.lvl = ''; S.fresh = false;
  initRun(list, false, false);
}
function bsoTrainSel() {
  const sel = BSO.bank.filter(function (x) { return BSO.sel[x.id]; });
  if (!sel.length) return alert('Pilih minimal satu soal (centang di kiri).');
  const list = bsoNormalize(sel);
  if (!list.length) return alert('Soal terpilih tidak lengkap.');
  S.sub = ''; S.jenis = ''; S.lvl = ''; S.fresh = false;
  initRun(list, false, false);
}
function bsoRandom() {
  const pool = bsoRows();
  if (!pool.length) return alert('Belum ada soal.');
  const picked = (typeof shuffle === 'function' ? shuffle(pool) : pool.slice()).slice(0, 10);
  const list = bsoNormalize(picked);
  if (!list.length) return alert('Soal tidak lengkap.');
  S.sub = ''; S.jenis = ''; S.lvl = ''; S.fresh = false;
  initRun(list, false, false);
}
function bsoGen() {
  S.tab = 'buat'; home();
  setTimeout(function () {
    const q = BSO.bank[0];
    const inp = $('gt');
    if (inp && !inp.value) inp.value = q ? String(q.sub || q.q || '').slice(0, 60) : '';
  }, 80);
}
async function bsoGenInline() {
  const btn = $('bsogenbtn'), box = $('bsogen');
  if (!user) { if (box) box.innerHTML = 'Masuk dulu untuk membuat soal dengan AI.'; return; }
  const topic = ((($('bsotopic') || {}).value) || '').trim();
  const n = Math.max(1, Math.min(15, +((($('bson') || {}).value) || 5)));
  const lvs = (typeof lvOptions === 'function' ? lvOptions() : ['Umum']);
  const lv = BSO.lv || lvs[Math.min(3, lvs.length - 1)] || 'Umum';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Membuat soal...'; }
  if (box) box.innerHTML = '⏳ AI menyusun ' + n + ' soal ' + rb26Safe(S.mapel) + '...';
  const sys = 'Kamu pembuat soal untuk siswa Indonesia. Jawab HANYA dengan array JSON valid tanpa penjelasan, tanpa markdown.';
  const ask = 'Mata pelajaran: ' + S.mapel + '\nTingkat: ' + lv + '\nTopik: ' + (topic || 'pilih topik penting yang sesuai tingkat') + '\nJumlah soal: ' + n
    + '\nFormat tiap objek: {"q":"pertanyaan","o":["pilihan A","pilihan B","pilihan C","pilihan D"],"a":0,"e":"pembahasan singkat kenapa jawaban itu benar"}'
    + '\nAturan: tepat 4 pilihan, hanya satu jawaban benar (a = indeks 0-3), bahasa Indonesia baku, pengecoh masuk akal, jangan mengulang soal yang sudah umum.';
  try {
    if (typeof ai !== 'function') throw new Error('Fitur AI tidak tersedia');
    const t = await ai(sys, [{ role: 'user', content: ask }], false, false, '', (typeof catFor === 'function' ? catFor() : 'sekolah'), { json: 'array', temp: 0.45 });
    const m = String(t || '').match(/\[[\s\S]*\]/);
    if (!m) throw new Error('Jawaban AI tidak berformat JSON');
    let arr;
    try { arr = JSON.parse(typeof fixJ === 'function' ? fixJ(m[0]) : m[0]); }
    catch (e) { throw new Error('JSON soal tidak bisa dibaca'); }
    if (!Array.isArray(arr) || !arr.length) throw new Error('AI tidak mengembalikan soal');
    const saved = [];
    for (const raw of arr.slice(0, n)) {
      const norm = (typeof normQ === 'function' ? normQ(raw) : null);
      if (!norm || !norm.q || !Array.isArray(norm.o) || norm.o.length < 2) continue;
      const doc = Object.assign({}, norm, { uid: user.uid, kategori: S.sec, mapel: S.mapel, tingkat: lv, sumber: 'ai', sub: topic || 'AI' });
      if (typeof firebase !== 'undefined' && firebase.firestore) doc.waktu = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('soal').add(doc);
      saved.push(Object.assign({ id: ref.id }, norm));
    }
    if (!saved.length) throw new Error('Tidak ada soal valid yang bisa disimpan');
    BSO.bank = saved.concat(BSO.bank);
    BSO.loaded = true;
    bsoRender();
    if (box) box.innerHTML = '✅ ' + saved.length + ' soal tersimpan dan siap dipelajari.';
    if (typeof v21Toast === 'function') v21Toast(saved.length + ' soal baru ditambahkan');
  } catch (e) {
    if (box) box.innerHTML = '⚠️ ' + rb26Safe((e && e.message) || e) + '. AI server belum bisa dipakai saat ini. Kamu tetap bisa memakai <b>Generator lengkap</b> atau belajar dari ' + BSO.bank.length + ' soal yang sudah ada.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Buat soal ✨'; }
  }
}

/* ==========================================================================
   2. STRATEGI ALCHEMIST
   Kerangka: Malaysian SNR (MSNR) + SMC/ICT + CRT + Quasimodo.
   Materi edukasi; bukan sinyal atau saran finansial.
   ========================================================================== */
const ALCH = {
  tab: 'mulai', term: '', quiz: {}, check: {}
};
const ALCH_CHECK = [
  'Arah storyline HTF (D1/W1/MN) sudah jelas dan dibaca dari body, bukan wick.',
  'Level/zona sudah ditandai: fresh, sudah dipakai, atau SBR/RBS.',
  'Ada rejection di level HTF, lalu breakout LTF sebagai konfirmasi.',
  'Sapuan likuiditas (sweep high/low) sudah terjadi sebelum entry.',
  'Perubahan struktur (MSS/CHoCH) terlihat di TF entry (H1/M15).',
  'Entry berada di POI: OCL/level, FVG, order block, atau QML.',
  'RR minimal 1:2 dan stop di luar struktur, bukan di dalam noise.',
  'Ukuran lot dihitung dari risiko maksimal 1% ekuitas.',
  'Tidak ada rilis berita besar dalam 30 menit sebelum/sesudah entry.',
  'Sesi aktif: London atau New York (bukan sesi Asia sepi).',
  'Target akhir wajar: level HTF berikutnya atau external liquidity.',
  'Rencana sudah ditulis: entry, SL, TP, invalidasi, dan alasan.'
];
const ALCH_QUIZ = [
  { q: 'Dalam MSNR, level ditandai dari …', o: ['Wick tertinggi dan terendah candle', 'Pertemuan close candle dan open candle berikutnya', 'Moving average 200', 'Titik tengah body candle'], a: 1, e: 'MSNR mengabaikan wick. Level dibuat dari pertemuan close satu candle dengan open candle berikutnya; bila ada jarak, jarak itu disebut gap/OCL.' },
  { q: 'Apa arti "miss" pada sebuah level?', o: ['Harga menembus level lalu kembali', 'Harga berbalik sebelum menyentuh level', 'Level dihapus dari chart', 'Harga menyentuh level tiga kali'], a: 1, e: 'Miss = harga mendekat lalu berbalik sebelum menyentuh level. Likuiditas di level itu belum terambil, sehingga level tetap dianggap valid dan kuat.' },
  { q: 'Storyline MSNR diawali oleh …', o: ['Breakout pada TF rendah', 'Rejection: close kembali di bawah resistance atau di atas support', 'Golden cross', 'Berita ekonomi'], a: 1, e: 'Storyline dimulai dari rejection di level HTF, lalu dikonfirmasi breakout di TF lebih rendah (internal atau external breakout).' },
  { q: 'SBR berarti …', o: ['Support menjadi resistance', 'Resistance menjadi support', 'Stop buy reversal', 'Supply block rejection'], a: 0, e: 'SBR = Support Become Resistance. Level yang ditembus tidak hilang, tetapi berubah peran dan tetap menyimpan riwayat sentuhan.' },
  { q: 'Order block yang benar adalah …', o: ['Candle yang melakukan pergerakan impulsif', 'Candle berlawanan terakhir sebelum pergerakan impulsif', 'Candle dengan volume terkecil', 'Candle doji'], a: 1, e: 'Order block adalah candle berlawanan terakhir sebelum impuls, karena di situlah order pihak lain masih tertinggal.' },
  { q: 'Pada QM bullish, entry diambil dari …', o: ['Head (lowest low)', 'Level left shoulder', 'Apex', 'Titik tengah range'], a: 1, e: 'Quasimodo bullish: head lebih rendah dari left shoulder. Level yang diperdagangkan adalah left shoulder, bukan head.' },
  { q: 'Candle Range Theory (CRT) memakai …', o: ['Range high/low candle periode sebelumnya', 'Fibonacci 78,6%', 'RSI 70/30', 'Jumlah candle hijau'], a: 0, e: 'CRT menandai high dan low candle acuan (mis. D1). Sapuan salah satu sisi range lalu konfirmasi LTF menjadi dasar entry menuju sisi sebaliknya.' },
  { q: 'Roadblock dalam MSNR adalah …', o: ['Target profit', 'Level berlawanan arah storyline tempat pullback biasanya berhenti', 'Sinyal entry', 'Zona istirahat'], a: 1, e: 'Roadblock/obstacle adalah level yang melawan storyline. Fungsinya mengingatkan bahwa pullback wajar berhenti di sana, bukan sinyal reversal otomatis.' }
];
const ALCH_TERMS = [
  ['MSNR', 'Malaysian Support & Resistance', 'Metode level dari pertemuan close candle dan open candle berikutnya (wick diabaikan).', 'Dipakai untuk membangun semua level dan storyline.'],
  ['Storyline', 'Arah utama', 'Bias/arah yang ditentukan level TF tinggi: bullish, bearish, atau range.', 'Menentukan level mana yang layak ditradingkan dan mana yang roadblock.'],
  ['HTF / LTF', 'Higher / Lower Timeframe', 'TF acuan arah (D1/W1/MN) dan TF eksekusi (H1/M15/M5).', 'Arah dari HTF, waktu entry dari LTF.'],
  ['POI', 'Point of Interest', 'Area yang diperkirakan memicu reaksi: level, OCL, FVG, OB, QML.', 'Tanpa POI, sentuhan level bukan trade.'],
  ['OCL', 'Open-Close Level', 'Level atau gap antara close dan open candle berikutnya.', 'Level utama dalam MSNR sekaligus zona entry.'],
  ['Band level', 'Area level', 'Level bukan garis tipis: sentuhan sah di salah satu tepi band.', 'Break baru sah bila close melewati tepi jauh.'],
  ['Touch', 'Sentuhan', 'Harga keluar dari level, kembali, lalu ditolak.', 'Menambah bobot level.'],
  ['Miss', 'Meleset', 'Harga berbalik sebelum menyentuh level.', 'Likuiditas di level masih utuh, level tetap fresh/kuat.'],
  ['Fresh', 'Belum dipakai', 'Level/zona yang belum diuji sejak terbentuk.', 'Zona fresh adalah zona yang layak ditradingkan.'],
  ['Unfresh', 'Sudah dipakai', 'Level yang sudah pernah diuji atau ditembus.', 'Kekuatan menurun; jangan dijadikan entry utama.'],
  ['SBR', 'Support Become Resistance', 'Support yang ditembus berubah menjadi resistance.', 'Dipakai sebagai level entry short setelah retest.'],
  ['RBS', 'Resistance Become Support', 'Resistance yang ditembus berubah menjadi support.', 'Dipakai sebagai level entry long setelah retest.'],
  ['Roadblock', 'Obstacle', 'Level yang melawan storyline.', 'Tempat pullback biasanya berhenti; jangan dipakai entry melawan arah.'],
  ['Rejection', 'Penolakan', 'Close kembali di bawah resistance atau di atas support.', 'Langkah pertama pembentukan storyline.'],
  ['Breakout internal', 'Internal break', 'Menembus level yang terbentuk setelah rejection.', 'Konfirmasi storyline yang lebih cepat.'],
  ['Breakout external', 'External break', 'Menembus level yang sudah ada sebelumnya.', 'Konfirmasi storyline yang lebih kuat.'],
  ['CRT', 'Candle Range Theory', 'Kerangka yang memakai high/low candle acuan sebagai area manipulasi dan target.', 'Sapuan range lalu konfirmasi LTF.'],
  ['Sweep', 'Liquidity grab', 'Sapuan stop di atas high atau di bawah low yang jelas.', 'Menandakanlikuiditas diambil sebelum arah sebenarnya.'],
  ['Internal liquidity', 'Likuiditas dalam range', 'Likuiditas di dalam range, misalnya FVG atau high/low minor.', 'Target antara sebelum external liquidity.'],
  ['External liquidity', 'Likuiditas luar range', 'High/low terluar dari sebuah range.', 'Target akhir yang wajar.'],
  ['MSS', 'Market Structure Shift', 'Perubahan struktur pasar dari lower high/lower low ke higher high/higher low (atau sebaliknya).', 'Konfirmasi paling penting sebelum entry.'],
  ['CHoCH', 'Change of Character', 'Sinyal awal perubahan karakter tren.', 'Sering muncul sebelum MSS; butuh konfirmasi.'],
  ['BOS', 'Break of Structure', 'Penembusan struktur searah tren.', 'Menandakan tren berlanjut, bukan reversal.'],
  ['Engulfing zone', 'Zona engulfing', 'Candle yang menelan candle sebelumnya; zona dibuat dari candle yang ditelan.', 'Bila gagal (close melewati), zona dibaca terbalik; dua kali gagal dibuang.'],
  ['Order block', 'OB', 'Candle berlawanan terakhir sebelum impuls.', 'Zona entry utama dalam SMC.'],
  ['FVG', 'Fair Value Gap / imbalance', 'Celah tiga candle karena harga bergerak terlalu cepat.', 'Zona rebalance untuk entry lanjutan.'],
  ['QM / QML', 'Quasimodo & level', 'Pola shoulder–head–return; entry di level left shoulder setelah struktur pecah.', 'Model reversal dengan stop relatif ketat.'],
  ['Apex', 'Puncak QM', 'Titik swing tertinggi/terendah pada pola QM.', 'Batas invalidasi pola.'],
  ['Third touch', 'Sentuhan ketiga', 'Entry pada sentuhan ketiga level, idealnya searah storyline dan berkonfluensi POI HTF.', 'Model entry klasik MSNR.'],
  ['Break & retest', 'Tembus lalu uji ulang', 'Harga menembus trendline/level lalu kembali mengujinya.', 'Entry pada retest, bukan pada breakout pertama.'],
  ['Confluence', 'Konfluensi', 'Beberapa alasan independen menunjuk area yang sama.', 'Semakin banyak konfluensi, semakin layak setup.'],
  ['Killzone', 'Jam aktif', 'Jendela waktu dengan likuiditas dan volatilitas tinggi.', 'London 14.00–17.00 WIB, New York 19.00–22.00 WIB.'],
  ['A+ setup', 'Setup terbaik', 'Setup yang memenuhi seluruh checklist, bukan sekadar arah benar.', 'Jika bukan A+, lewati.'],
  ['Risk per trade', 'Risiko per transaksi', 'Persentase ekuitas yang bersedia hilang bila stop kena.', 'Umumnya 0,5–2%.'],
  ['R multiple', 'Kelipatan risiko', 'Laba/rugi diukur dalam satuan risiko (1R = risiko awal).', 'Dipakai untuk mengevaluasi, bukan nominal uang.'],
  ['Expectancy', 'Ekspektasi', '(Win rate × rata-rata menang) − (Loss rate × rata-rata kalah).', 'Menentukan apakah sistem layak dijalankan.'],
  ['Drawdown', 'Penurunan ekuitas', 'Penurunan dari puncak ekuitas.', 'Dibatasi lewat ukuran posisi dan batas harian.'],
  ['Lot & pip', 'Satuan transaksi', 'Lot adalah ukuran kontrak; pip adalah satuan pergerakan harga.', 'Menentukan nilai per pip untuk hitung lot.'],
  ['Spread & slippage', 'Biaya transaksi', 'Selisih bid/ask dan selisih harga eksekusi.', 'Menyempitkan RR; hitung sebelum entry.'],
  ['Partial & BE', 'Ambil sebagian & break even', 'Menutup sebagian posisi dan memindahkan stop ke titik entry.', 'Mengunci risiko setelah harga bergerak.'],
  ['Journal', 'Jurnal trading', 'Catatan terstruktur setiap trade dan alasannya.', 'Alat utama perbaikan konsistensi.'],
  ['Revenge trading', 'Balas dendam pasar', 'Entry impulsif setelah rugi untuk cepat balik modal.', 'Penyebab utama drawdown besar.'],
  ['Confirmation bias', 'Bias konfirmasi', 'Hanya mencari bukti yang mendukung pendapat sendiri.', 'Lawan dengan checklist dan invalidasi tertulis.']
];
const ALCH_MODELS = [
  {
    name: '1. Third touch + konfluensi HTF',
    ctx: 'Level MSNR yang sudah diuji dua kali, searah storyline, dan bertemu POI HTF lain.',
    cond: ['Storyline HTF jelas.', 'Sentuhan pertama dan kedua idealnya berupa engulfing/reaksi kuat.', 'Sentuhan ketiga berada di POI HTF (level lain, OCL, atau zona SBR/RBS).', 'Level masih fresh atau baru sekali dipakai.'],
    entry: 'Entry setelah candle reaksi di sentuhan ketiga (close kembali menjauh dari level).',
    sl: 'Di luar band level ditambah buffer ATR (bukan di dalam band).',
    tp: 'External liquidity terdekat, level HTF berikutnya, atau RR minimal 1:2.',
    inval: 'Close melewati tepi jauh level, atau storyline HTF berubah.'
  },
  {
    name: '2. Break & retest',
    ctx: 'Trendline atau level ditembus dengan close, lalu diuji ulang.',
    cond: ['Break memakai close, bukan wick.', 'Retest datang ke level/trendline yang sama.', 'Ada POI di titik retest (fresh level, OCL, FVG).'],
    entry: 'Entry saat retest ditolak, bukan saat breakout pertama.',
    sl: 'Di sisi lain level/trendline dengan buffer.',
    tp: 'Swing berikutnya searah breakout.',
    inval: 'Close kembali melewati level ke sisi semula (failed break).'
  },
  {
    name: '3. Quasimodo (QM)',
    ctx: 'Reversal setelah pola shoulder–head–return pada TF H1/H4.',
    cond: ['Head melewati left shoulder (lowest low untuk bullish).', 'Ada structure break sebelum pola diterima.', 'Level left shoulder masih fresh.'],
    entry: 'Entry di level left shoulder (QML) setelah harga kembali.',
    sl: 'Di luar head/apex.',
    tp: 'Level HTF berikutnya atau external liquidity.',
    inval: 'Harga membuat high/low baru melewati apex.'
  },
  {
    name: '4. CRT (Candle Range Theory)',
    ctx: 'Sapuan range candle acuan (D1/H4) lalu konfirmasi di LTF.',
    cond: ['Tandai high/low candle acuan.', 'Salah satu sisi range disapu.', 'MSS/CHoCH di M15–M5 setelah sapuan.', 'Ada FVG/OB yang tertinggal dari impuls konfirmasi.'],
    entry: 'Entry di FVG/OB dari impuls konfirmasi, bukan di titik sapuan.',
    sl: 'Di luar ekstrem sapuan.',
    tp: 'Sisi berlawanan range acuan; partial di internal liquidity.',
    inval: 'Harga close di luar range ke arah sapuan dan bertahan.'
  },
  {
    name: '5. Sweep + OB/FVG (SMC)',
    ctx: 'Likuiditas diambil, struktur berubah, lalu harga kembali ke zona institusional.',
    cond: ['Sweep high/low yang terlihat jelas.', 'MSS pada TF entry.', 'Zona OB/FVG belum terpakai.'],
    entry: 'Limit/setelah reaksi di 50% OB atau tepi FVG.',
    sl: 'Di luar zona dan swing pelindung.',
    tp: 'Likuiditas berlawanan berikutnya.',
    inval: 'Zona ditembus dengan close dan tidak ada reaksi.'
  }
];
const ALCH_SESSIONS = [
  ['Sydney', '04.00 – 13.00', 'Likuiditas tipis, cocok untuk membentuk range, kurang untuk breakout.'],
  ['Tokyo', '06.00 – 15.00', 'Range Asia; sering menjadi acuan CRT untuk sesi London.'],
  ['London', '14.00 – 23.00', 'Volatilitas tinggi; killzone 14.00–17.00. Sering menyapu range Asia.'],
  ['New York', '19.00 – 04.00', 'Killzone 19.00–22.00; rilis data AS (NFP/CPI) 19.30–21.30 WIB.'],
  ['Overlap London–NY', '19.00 – 23.00', 'Likuiditas tertinggi; peluang target besar, tetapi spread bisa melebar saat berita.']
];

function alSet(tab) { ALCH.tab = tab; pAlchemist(); }
function alTerm(v) { ALCH.term = v; const box = $('alchterms'); if (box) box.innerHTML = alTermsHtml(); }
function alCheck(i, on) {
  ALCH.check[i] = !!on;
  const row = $('alchcl_' + i);
  if (row) row.classList.toggle('on', !!on);
  alCheckScore();
}
function alCheckScore() {
  const n = ALCH_CHECK.filter(function (_, i) { return ALCH.check[i]; }).length;
  const el = $('alchclscore');
  if (el) el.innerHTML = '<b>' + n + ' / ' + ALCH_CHECK.length + '</b> terpenuhi' + (n === ALCH_CHECK.length ? ' — siap eksekusi ✅' : n >= 9 ? ' — hampir siap' : ' — belum layak entry');
}
function alQuizPick(i, k) {
  ALCH.quiz[i] = k;
  pAlchemist();
}
function alTermsHtml() {
  const q = rb26Norm(ALCH.term);
  const rows = ALCH_TERMS.filter(function (x) {
    return !q || rb26Norm(x[0] + ' ' + x[1] + ' ' + x[2] + ' ' + x[3]).indexOf(q) >= 0;
  });
  return '<input placeholder="Cari istilah (mis. FVG, QML, SBR)..." autocomplete="off" value="' + rb26Safe(ALCH.term) + '" oninput="alTerm(this.value)" style="margin-bottom:10px">'
    + '<div class="rb-note" style="margin-bottom:6px">' + rows.length + ' istilah</div>'
    + '<div class="rb-terms">' + (rows.length ? rows.map(function (x) {
      return '<div class="rb-term"><span class="rb-term-abbr">' + rb26Safe(x[1]) + '</span><b>' + rb26Safe(x[0]) + '</b>'
        + '<p>' + rb26Safe(x[2]) + '</p><div class="rb-term-use"><b>Dipakai:</b> ' + rb26Safe(x[3]) + '</div></div>';
    }).join('') : '<div class="rb-muted-box">Istilah tidak ditemukan.</div>') + '</div>';
}
function alStudyCaseSvg() {
  return '<svg class="rb-chart" viewBox="0 0 720 340" role="img" aria-label="Skema entry Alchemist: range harian, sapuan low, perubahan struktur, FVG, stop loss dan target">'
    + '<defs><linearGradient id="alchBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(139,157,255,.10)"/><stop offset="1" stop-color="rgba(139,157,255,0)"/></linearGradient></defs>'
    + '<rect x="0" y="0" width="720" height="340" fill="url(#alchBg)"/>'
    + '<rect x="52" y="72" width="612" height="188" rx="8" fill="none" stroke="#8b9dff" stroke-opacity=".55" stroke-dasharray="6 5"/>'
    + '<text x="60" y="66" fill="#8b9dff" font-size="12" font-family="sans-serif">Range candle acuan (D1) — high</text>'
    + '<text x="60" y="278" fill="#8b9dff" font-size="12" font-family="sans-serif">Range candle acuan — low</text>'
    + '<line x1="52" y1="72" x2="664" y2="72" stroke="#8b9dff" stroke-opacity=".35"/>'
    + '<line x1="52" y1="260" x2="664" y2="260" stroke="#8b9dff" stroke-opacity=".35"/>'
    /* candles: decline */
    + '<g stroke="#ff7b8a" fill="#ff7b8a" stroke-width="1.2">'
    + '<line x1="96" y1="120" x2="96" y2="176"/><rect x="90" y="128" width="12" height="38" rx="2" fill="#ff7b8a"/>'
    + '<line x1="120" y1="150" x2="120" y2="206"/><rect x="114" y="158" width="12" height="40" rx="2" fill="#ff7b8a"/>'
    + '<line x1="144" y1="182" x2="144" y2="238"/><rect x="138" y="190" width="12" height="40" rx="2" fill="#ff7b8a"/>'
    + '<line x1="168" y1="206" x2="168" y2="268"/><rect x="162" y="214" width="12" height="42" rx="2" fill="#ff7b8a"/>'
    + '</g>'
    /* sweep low wick */
    + '<line x1="192" y1="228" x2="192" y2="292" stroke="#ff7b8a" stroke-width="1.4"/>'
    + '<rect x="186" y="236" width="12" height="36" rx="2" fill="#ff7b8a"/>'
    + '<text x="176" y="312" fill="#ff7b8a" font-size="11" font-family="sans-serif">sweep low</text>'
    /* bullish MSS candle */
    + '<line x1="222" y1="196" x2="222" y2="288" stroke="#4ade9d" stroke-width="1.4"/>'
    + '<rect x="216" y="204" width="12" height="76" rx="2" fill="#4ade9d"/>'
    + '<text x="204" y="190" fill="#4ade9d" font-size="11" font-family="sans-serif">MSS bullish</text>'
    /* FVG zone */
    + '<rect x="248" y="188" width="150" height="26" rx="4" fill="rgba(94,234,212,.18)" stroke="#5eead4" stroke-opacity=".7" stroke-dasharray="4 4"/>'
    + '<text x="254" y="205" fill="#5eead4" font-size="11" font-family="sans-serif">FVG / imbalance</text>'
    /* retrace candles */
    + '<g stroke="#ff7b8a" fill="#ff7b8a" stroke-width="1.1">'
    + '<line x1="286" y1="170" x2="286" y2="222"/><rect x="280" y="178" width="12" height="34" rx="2" fill="#ff7b8a"/>'
    + '<line x1="310" y1="176" x2="310" y2="226"/><rect x="304" y="184" width="12" height="32" rx="2" fill="#ff7b8a"/>'
    + '</g>'
    /* entry arrow and lines */
    + '<line x1="322" y1="200" x2="640" y2="200" stroke="#8b9dff" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="568" y="194" fill="#8b9dff" font-size="11" font-family="sans-serif">entry</text>'
    + '<line x1="322" y1="268" x2="640" y2="268" stroke="#ff7b8a" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="576" y="284" fill="#ff7b8a" font-size="11" font-family="sans-serif">stop loss</text>'
    + '<line x1="322" y1="92" x2="640" y2="92" stroke="#4ade9d" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="584" y="86" fill="#4ade9d" font-size="11" font-family="sans-serif">target</text>'
    /* rally candles */
    + '<g stroke="#4ade9d" fill="#4ade9d" stroke-width="1.1">'
    + '<line x1="352" y1="162" x2="352" y2="216"/><rect x="346" y="170" width="12" height="38" rx="2" fill="#4ade9d"/>'
    + '<line x1="382" y1="132" x2="382" y2="196"/><rect x="376" y="140" width="12" height="44" rx="2" fill="#4ade9d"/>'
    + '<line x1="412" y1="116" x2="412" y2="172"/><rect x="406" y="124" width="12" height="36" rx="2" fill="#4ade9d"/>'
    + '<line x1="442" y1="104" x2="442" y2="160"/><rect x="436" y="112" width="12" height="36" rx="2" fill="#4ade9d"/>'
    + '<line x1="472" y1="96" x2="472" y2="148"/><rect x="466" y="102" width="12" height="34" rx="2" fill="#4ade9d"/>'
    + '</g>'
    + '<circle cx="322" cy="200" r="4" fill="#8b9dff"/>'
    + '<text x="52" y="328" fill="#95a3b7" font-size="11" font-family="sans-serif">Urutan: range → sapuan likuiditas → MSS → entry di FVG → target sisi berlawanan range.</text>'
    + '</svg>';
}

function pAlchemist() {
  const tabs = [['mulai', '🚀 Mulai'], ['istilah', '📖 Istilah'], ['story', '🧭 Storyline'], ['level', '📐 Level & Zona'], ['entry', '🎯 Model Entry'], ['sesi', '⏰ Sesi'], ['risiko', '🛡 Risiko'], ['cek', '✅ Checklist'], ['kasus', '🔍 Studi Kasus'], ['kuis', '🎓 Kuis']];
  const body = ALCH.tab === 'istilah' ? '<div id="alchterms">' + alTermsHtml() + '</div>'
    : ALCH.tab === 'story' ? alStoryHtml()
      : ALCH.tab === 'level' ? alLevelHtml()
        : ALCH.tab === 'entry' ? alEntryHtml()
          : ALCH.tab === 'sesi' ? alSessionHtml()
            : ALCH.tab === 'risiko' ? alRiskHtml()
              : ALCH.tab === 'cek' ? alCheckHtml()
                : ALCH.tab === 'kasus' ? alCaseHtml()
                  : ALCH.tab === 'kuis' ? alQuizHtml()
                    : alStartHtml();

  $('pane').innerHTML = '<div class="card rb-hero-alch"><div class="rb-hero-main"><div class="rb-hero-copy">'
    + '<div class="rb-eyebrow">Trading · kurikulum</div><h2>⚗️ Strategi Alchemist</h2>'
    + '<div class="rb-note">Gabungan Malaysian SNR (MSNR), SMC/ICT, Candle Range Theory, dan Quasimodo: cara membaca storyline, menandai level, menentukan entry, lalu mengeksekusi dengan risiko terkendali.</div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">Edukasi</span><span class="rb-pill">MSNR</span><span class="rb-pill">SMC / ICT</span><span class="rb-pill">CRT</span><span class="rb-pill">QM</span></div>'
    + '</div><div class="ring" style="--p:100"><div class="ring-in"><b>10</b><span>modul</span></div></div></div></div>'
    + '<div class="stabs" style="margin-bottom:12px">' + tabs.map(function (x) {
      return '<button type="button" class="' + (ALCH.tab === x[0] ? 'on' : '') + '" onclick="alSet(\'' + x[0] + '\')">' + x[1] + '</button>';
    }).join('') + '</div>'
    + '<div>' + body + '</div>'
    + '<div class="card"><h3>⚖️ Batas &amp; etika</h3><div class="rb-note">Materi ini edukasi, bukan sinyal atau saran finansial. Tidak ada strategi yang selalu benar: setiap level bisa gagal. Uji di akun demo, catat di jurnal, dan batasi risiko per trade. Sumber konsep: material publik MSNR/Alchemist, ICT/SMC, dan Candle Range Theory (lihat tautan di modul Mulai).</div></div>';
}
function alStartHtml() {
  return '<div class="rb-grid">'
    + '<div class="card"><h3>Apa itu "Alchemist"?</h3>'
      + '<div class="rb-note">Alchemist bukan indikator ajaib, melainkan kerangka kerja yang menyatukan beberapa konsep price action yang sudah lama dipakai trader profesional. Intinya: <b>arah dulu, level kedua, entry terakhir</b>.</div>'
      + '<div class="rb-callout"><b>3 pertanyaan sebelum entry</b><br>1. Storyline HTF sedang apa?<br>2. Apakah harga sudah menyapu likuiditas dan mengubah struktur?<br>3. Apakah ada POI fresh untuk entry dengan RR minimal 1:2?</div>'
      + '<div class="rb-flow" style="margin-top:10px">'
        + '<div class="rb-step"><b>Top-down</b>Baca D1/W1/MN untuk arah; pakai H1/H4 untuk level; M15/M5 untuk timing.</div>'
        + '<div class="rb-step"><b>Tandai level</b>Close–open (OCL), fresh/unfresh, SBR/RBS, dan roadblock.</div>'
        + '<div class="rb-step"><b>Tunggu bukti</b>Rejection → breakout LTF → sweep → MSS.</div>'
        + '<div class="rb-step"><b>Eksekusi</b>Entry di POI, stop di luar struktur, target external liquidity.</div>'
      + '</div>'
      + '<div class="rb-callout warn"><b>Kesalahan pemula:</b> entry karena harga "sudah turun banyak", memasang stop terlalu rapat, dan menambah posisi saat rugi. Alchemist menekankan bukti struktur, bukan feeling.</div>'
      + '</div>'
    + '<div class="card"><h3>Cara memakai modul ini</h3>'
      + '<div class="rb-accordion"><details><summary>Urutan belajar yang disarankan</summary><div class="rb-acc-body"><ul>'
        + '<li>Hari 1–2: <b>Istilah</b> + <b>Storyline</b>.</li><li>Hari 3–4: <b>Level &amp; Zona</b> + <b>Model Entry</b>.</li>'
        + '<li>Hari 5: <b>Sesi</b> dan <b>Risiko</b>.</li><li>Hari 6: <b>Studi Kasus</b> lalu ulangi 20 chart historis.</li>'
        + '<li>Hari 7: <b>Checklist</b> + <b>Kuis</b>, lalu evaluasi jurnal.</li></ul></div></details></div>'
      + '<div class="rb-accordion"><details><summary>Alat yang perlu disiapkan</summary><div class="rb-acc-body"><ul>'
        + '<li>Chart dengan TF D1, H4, H1, M15, M5.</li><li>Alat gambar: kotak/zona, garis horizontal, dan pengukur risiko.</li>'
        + '<li>Jurnal: tanggal, pair, sesi, model entry, RR rencana vs hasil, kesalahan.</li>'
        + '<li>Kalkulator lot di tab 📒 Jurnal untuk ukuran posisi.</li></ul></div></details></div>'
      + '<div class="rb-accordion"><details><summary>Sumber konsep (global)</summary><div class="rb-acc-body"><div class="rb-src">'
        + '<a href="https://www.tradingview.com/script/ANCSINu0-Wonra-Alchemist-SNR-Engine" target="_blank" rel="noopener noreferrer">Wonra Alchemist SNR Engine — aturan MSNR, storyline, SBR/RBS, QM, OCL (TradingView)</a>'
        + '<a href="https://glasp.co/youtube/dPlIsJ-YYKU" target="_blank" rel="noopener noreferrer">Komepips — Alchemist (MSNR) step by step: D1 → H4 → M30/H1, FVG, CRT</a>'
        + '<a href="https://unrollnow.com/status/1913681992538804450" target="_blank" rel="noopener noreferrer">Thread edukasi MSNR × SMC (Alchemist): CRT, QM, entry</a>'
        + '<a href="https://alchemymarkets.com/education/guides/smart-money-concept" target="_blank" rel="noopener noreferrer">Smart Money Concept: PD arrays, order block, FVG, likuiditas</a>'
        + '<a href="https://www.babypips.com/learn/forex/what-is-forex-trading" target="_blank" rel="noopener noreferrer">BabyPips — dasar forex, sesi, dan manajemen risiko</a>'
      + '</div><div class="rb-note" style="margin-top:8px">Konsep berasal dari material edukasi publik; aplikasi ini tidak berafiliasi dengan penjual kursus mana pun.</div></div></details></div>'
      + '</div>'
    + '</div>';
}
function alStoryHtml() {
  return '<div class="card"><h3>🧭 Storyline — arah sebelum segalanya</h3>'
    + '<div class="rb-note">Storyline adalah "cerita" yang diceritakan level TF tinggi. Tanpa storyline, level hanya garis tanpa arti.</div>'
    + '<div class="rb-flow" style="margin-top:10px">'
      + '<div class="rb-step"><b>1. Baca level HTF dari body</b>Gunakan close candle, bukan ujung wick. Tandai S/R pada D1, W1, lalu MN.</div>'
      + '<div class="rb-step"><b>2. Tunggu rejection</b>Storyline dimulai saat close kembali di bawah resistance (bearish) atau di atas support (bullish).</div>'
      + '<div class="rb-step"><b>3. Konfirmasi breakout LTF</b>Breakout internal = level yang terbentuk setelah rejection. External = level yang sudah ada sebelumnya.</div>'
      + '<div class="rb-step"><b>4. Tandai roadblock</b>Level melawan arah adalah tempat pullback wajar berhenti. Bukan sinyal reversal.</div>'
    + '</div>'
    + '<div class="rb-callout ok"><b>Contoh bullish:</b> D1 menolak support → close di atas resistance minor (breakout LTF) → storyline naik. Pullback ke level fresh = peluang beli, kecuali ada roadblock tebal di antaranya.</div>'
    + '<div class="rb-callout warn"><b>Contoh gagal:</b> Breakout terjadi tetapi close berikutnya kembali di bawah level → failed breakout. Storyline belum sah; tunggu bukti baru.</div>'
    + '<div class="rb-card-head" style="margin-top:12px"><h3 style="font-size:.94rem">Latihan storyline</h3><button class="x" onclick="alSet(\'kasus\')">Lihat studi kasus ›</button></div>'
    + '<div class="rb-note">Buka 5 chart historis. Untuk setiap chart tulis satu kalimat: "Storyline D1 bullish karena …". Kalau tidak bisa menulis alasannya, berarti belum ada storyline.</div>'
    + '</div>';
}
function alLevelHtml() {
  return '<div class="card"><h3>📐 Level &amp; zona ala MSNR</h3>'
    + '<div class="rb-note">Bedanya MSNR dengan S/R biasa: level dibuat dari pertemuan <b>close</b> satu candle dan <b>open</b> candle berikutnya; wick diabaikan.</div>'
    + '<div class="rb-flow" style="margin-top:10px">'
      + '<div class="rb-step"><b>1. Tandai close–open</b>Bila close dan open berbeda, jaraknya adalah band level (OCL/gap). Sentuhan sah di tepi mana pun.</div>'
      + '<div class="rb-step"><b>2. Tentuka bobot</b>Touch (keluar–kembali–ditolak) dan miss (berbalik sebelum menyentuh) sama-sama menguatkan level.</div>'
      + '<div class="rb-step"><b>3. Fresh vs unfresh</b>Level yang belum diuji = fresh. Zona fresh yang layak entry; zona terpakai hanya konteks.</div>'
      + '<div class="rb-step"><b>4. Role flip</b>Support ditembus → resistance (SBR). Resistance ditembus → support (RBS). Riwayatnya tetap.</div>'
    + '</div>'
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>Kondisi</th><th>Tindakan</th></tr></thead><tbody>'
      + '<tr><td>Level fresh searah storyline</td><td>Kandidat POI utama.</td></tr>'
      + '<tr><td>Level sudah 2–3 kali dipakai</td><td>Turunkan prioritas; cari POI lain.</td></tr>'
      + '<tr><td>Level ditembus dengan close</td><td>Baca sebagai SBR/RBS, bukan dihapus.</td></tr>'
      + '<tr><td>Level melawan storyline</td><td>Roadblock: perkirakan pullback berhenti, jangan entry melawan.</td></tr>'
      + '<tr><td>Harga berbalik sebelum menyentuh</td><td>Miss: likuiditas masih utuh, level tetap kuat.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout"><b>Latihan:</b> ambil satu pair, tandai 10 level terakhir pada D1. Beri label F (fresh), U (used), atau RB (roadblock). Ulangi tanpa melihat hasil sampai konsisten.</div>'
    + '</div>';
}
function alEntryHtml() {
  return ALCH_MODELS.map(function (m) {
    return '<div class="card"><h3>' + rb26Safe(m.name) + '</h3>'
      + '<div class="rb-note">' + rb26Safe(m.ctx) + '</div>'
      + '<div class="rb-pill-row"><span class="rb-pill g">Syarat</span><span class="rb-pill r">Invalidasi</span></div>'
      + '<div class="rb-accordion"><details open><summary>Checklist syarat</summary><div class="rb-acc-body"><ul>' + m.cond.map(function (c) { return '<li>' + rb26Safe(c) + '</li>'; }).join('') + '</ul></div></details></div>'
      + '<div class="rb-acc-body" style="padding:0;font-size:.85rem;line-height:1.62">'
      + '<div class="item"><span>Entry</span><b style="text-align:right;max-width:62%">' + rb26Safe(m.entry) + '</b></div>'
      + '<div class="item"><span>Stop loss</span><b style="text-align:right;max-width:62%">' + rb26Safe(m.sl) + '</b></div>'
      + '<div class="item"><span>Target</span><b style="text-align:right;max-width:62%">' + rb26Safe(m.tp) + '</b></div>'
      + '<div class="item"><span>Batal jika</span><b style="text-align:right;max-width:62%">' + rb26Safe(m.inval) + '</b></div>'
      + '</div></div>';
  }).join('') + '<div class="rb-callout warn"><b>Catatan eksekusi:</b> tidak semua model cocok di semua kondisi. Pilih satu model, ulangi 50 kali di demo, baru evaluasi. Menumpuk banyak model sekaligus biasanya berakhir dengan entry paksa.</div>';
}
function alSessionHtml() {
  return '<div class="card"><h3>⏰ Sesi &amp; killzone (WIB)</h3>'
    + '<div class="rb-scroll"><table class="rb-table"><thead><tr><th>Sesi</th><th>Jam (WIB)</th><th>Karakter</th></tr></thead><tbody>'
    + ALCH_SESSIONS.map(function (s) { return '<tr><td><b>' + rb26Safe(s[0]) + '</b></td><td>' + rb26Safe(s[1]) + '</td><td>' + rb26Safe(s[2]) + '</td></tr>'; }).join('')
    + '</tbody></table></div>'
    + '<div class="rb-callout" style="margin-top:12px"><b>Alur harian Alchemist:</b> sesi Asia membentuk range → London menyapu salah satu sisi → cari MSS M15 → entry di POI → target sisi berlawanan range atau level HTF berikutnya.</div>'
    + '<div class="rb-callout warn"><b>Hindari:</b> 15 menit sebelum dan sesudah rilis data besar (NFP, CPI, FOMC). Spread melebar dan stop bisa tersentuh sebelum arah terbentuk. Cek kalender di tab 🎯 News Analisis.</div>'
    + '<div class="rb-card-head" style="margin-top:6px"><h3 style="font-size:.94rem">Jam dunia</h3><button class="x" onclick="pKalender()">Buka kalender ›</button></div>'
    + '<div class="rb-note">Sesi di atas memakai WIB (UTC+7). Saat DST (musim panas), London/New York bergeser 1 jam lebih awal.</div>'
    + '</div>';
}
function alRiskHtml() {
  return '<div class="card"><h3>🛡 Manajemen risiko &amp; ukuran posisi</h3>'
    + '<div class="rb-flow" style="margin-top:8px">'
      + '<div class="rb-step"><b>1. Tentukan risiko</b>0,5–1% ekuitas per trade. Contoh: ekuitas $1.000 → risiko $10.</div>'
      + '<div class="rb-step"><b>2. Ukur stop</b>Jarak entry ke stop dalam pip/poin. Letakkan di luar struktur/zona, bukan di dalam noise.</div>'
      + '<div class="rb-step"><b>3. Hitung lot</b>Lot = risiko ÷ (stop × nilai per pip per lot). Bulatkan ke bawah sesuai langkah broker.</div>'
      + '<div class="rb-step"><b>4. Tetapkan batas</b>Maksimal 2–3 trade per hari dan stop setelah −3% ekuitas harian.</div>'
    + '</div>'
    + '<div class="rb-callout"><b>Contoh XAUUSD:</b> risiko $10, stop 250 poin ($0,01 × 100 oz per lot → $2,5/poin per lot? gunakan nilai kontrak broker) — selalu pakai kalkulator lot di tab 📒 Jurnal agar angka mengikuti spesifikasi broker.</div>'
    + '<div class="rb-scroll" style="margin-top:10px"><table class="rb-table"><thead><tr><th>RR</th><th>Win rate yang dibutuhkan agar BEP</th><th>Catatan</th></tr></thead><tbody>'
      + '<tr><td>1 : 1</td><td>50%</td><td>Rentan biaya spread.</td></tr>'
      + '<tr><td>1 : 2</td><td>33,4%</td><td>Titik awal yang sehat.</td></tr>'
      + '<tr><td>1 : 3</td><td>25%</td><td>Butuh kesabaran; banyak trade dilewati.</td></tr>'
      + '<tr><td>1 : 5</td><td>16,7%</td><td>Drawdown panjang; psikologi berat.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout warn"><b>Jangan:</b> menambah lot setelah rugi (martingale), memindahkan stop menjauh, atau membuka banyak posisi searah yang saling mengunci risiko.</div>'
    + '</div>';
}
function alCheckHtml() {
  const n = ALCH_CHECK.filter(function (_, i) { return ALCH.check[i]; }).length;
  return '<div class="card"><div class="rb-card-head"><h3>✅ Checklist eksekusi</h3><span class="rb-pill" id="alchclscore"><b>' + n + ' / ' + ALCH_CHECK.length + '</b> terpenuhi</span></div>'
    + '<div class="rb-note">Centang hanya bila benar-benar terpenuhi. Aturan sederhana: kurang dari 10 centang = tidak entry.</div>'
    + '<div class="rb-checklist">' + ALCH_CHECK.map(function (c, i) {
      return '<label class="rb-cl-item ' + (ALCH.check[i] ? 'on' : '') + '" id="alchcl_' + i + '"><input type="checkbox" ' + (ALCH.check[i] ? 'checked' : '') + ' onchange="alCheck(' + i + ',this.checked)"><span>' + rb26Safe(c) + '</span></label>';
    }).join('') + '</div>'
    + '<button class="btn alt full" type="button" onclick="ALCH.check={};pAlchemist()">Reset checklist</button>'
    + '<div class="rb-callout" style="margin-top:10px"><b>Kebiasaan:</b> simpan screenshot sebelum entry, tulis checklist di jurnal. Setelah 20 trade, lihat mana syarat yang paling sering dilanggar.</div>'
    + '</div>';
}
function alCaseHtml() {
  return '<div class="card"><h3>🔍 Studi kasus: CRT bullish + FVG</h3>'
    + '<div class="rb-note">Skenario edukasi pada XAUUSD H1. Perhatikan urutannya, bukan angka pastinya.</div>'
    + alStudyCaseSvg()
    + '<div class="rb-flow" style="margin-top:12px">'
      + '<div class="rb-step"><b>Konteks</b>D1 membentuk range. Storyline belum jelas; tunggu manipulasi.</div>'
      + '<div class="rb-step"><b>Sapuan</b>Harga menyapu low range (sweep) lalu close kembali di dalam range.</div>'
      + '<div class="rb-step"><b>Konfirmasi</b>M15 membentuk MSS bullish dan meninggalkan FVG.</div>'
      + '<div class="rb-step"><b>Entry</b>Limit di tepi FVG; stop di bawah low sapuan; target high range.</div>'
    + '</div>'
    + '<div class="rb-callout ok"><b>Kenapa masuk akal:</b> likuiditas diambil, struktur berubah, entry dekat dengan invalidasi sehingga RR besar.</div>'
    + '<div class="rb-callout warn"><b>Kenapa bisa gagal:</b> berita besar tiba-tiba, FVG dilewati tanpa reaksi, atau storyline D1 ternyata bearish kuat sehingga high range tidak tercapai.</div>'
    + '<div class="rb-card-head" style="margin-top:6px"><h3 style="font-size:.94rem">Uji pemahaman</h3><button class="x" onclick="alSet(\'kuis\')">Kerjakan kuis ›</button></div>'
    + '</div>';
}
function alQuizHtml() {
  const done = Object.keys(ALCH.quiz).length;
  const right = ALCH_QUIZ.filter(function (q, i) { return ALCH.quiz[i] === q.a; }).length;
  return '<div class="card"><div class="rb-card-head"><h3>🎓 Kuis Alchemist</h3><span class="rb-pill">' + right + '/' + ALCH_QUIZ.length + ' benar</span></div>'
    + '<div class="rb-note">Jawab semua pertanyaan. Pembahasan muncul langsung setelah memilih.</div>'
    + '<div style="margin-top:10px">' + ALCH_QUIZ.map(function (q, i) {
      const pick = ALCH.quiz[i];
      const answered = pick != null;
      return '<div class="rb-quiz"><div style="font-weight:700;font-size:.86rem;line-height:1.5">' + (i + 1) + '. ' + rb26Safe(q.q) + '</div>'
        + q.o.map(function (o, k) {
          const cls = answered ? (k === q.a ? 'ok' : k === pick ? 'no' : '') : '';
          return '<button type="button" class="rb-opt ' + cls + '" ' + (answered ? 'disabled' : '') + ' onclick="alQuizPick(' + i + ',' + k + ')">' + String.fromCharCode(65 + k) + '. ' + rb26Safe(o) + '</button>';
        }).join('')
        + (answered ? '<div class="rb-callout ' + (pick === q.a ? 'ok' : 'warn') + '" style="margin:8px 0 0">' + (pick === q.a ? '✅ Benar. ' : '❌ Belum tepat. ') + rb26Safe(q.e) + '</div>' : '')
        + '</div>';
    }).join('') + '</div>'
    + '<button class="btn alt full" type="button" onclick="ALCH.quiz={};pAlchemist()">Ulangi kuis</button>'
    + (done === ALCH_QUIZ.length ? '<div class="rb-callout ' + (right >= 6 ? 'ok' : 'warn') + '"><b>Skor akhir: ' + right + '/' + ALCH_QUIZ.length + '.</b> ' + (right >= 6 ? 'Lanjut ke latihan chart historis.' : 'Baca ulang modul Istilah dan Level sebelum lanjut.') + '</div>' : '')
    + '</div>';
}

/* tombol pintas dari tab lain */
function rb26OpenAlch() {
  if (S.sec !== 'trading') {
    if (!S.admin && !S.trading) { if (typeof v21Toast === 'function') v21Toast('Fitur Trading khusus admin'); return; }
    S.sec = 'trading'; S.mapel = 'Trading';
  }
  S.tab = 'alchemist';
  if (typeof home === 'function') home();
}
