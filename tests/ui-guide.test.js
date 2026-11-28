'use strict';
/* ==========================================================================
   Tes permanen untuk tab Belajar:
   - Panduan menulis ke #pane (bug lama: pPanduan hanya `return` string,
     sedangkan pane() memanggil fungsi tanpa memakai nilai kembalian).
   - Tab "Belajar Soal" sudah dihapus dan diganti Kurikulum.
   - Kurikulum merender peta topik + rencana 4 minggu.
   - Pelajaran spesial (Psikologi/Sosiologi) hanya terbuka untuk admin atau
     akun yang diizinkan; mapel terkunci tidak muncul di menu pelajaran.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const CORE = fs.readFileSync(path.join(ROOT, 'rb-core.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

/* Ambil satu fungsi dari teks sumber dengan menghitung kurung kurawal. */
function extractFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'fungsi ' + name + ' harus ada di sumber');
  let depth = 0, str = null, esc = false;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === str) str = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('fungsi ' + name + ' tidak lengkap');
}

function coreSandbox() {
  const pane = { innerHTML: '' };
  const app = { innerHTML: '' };
  const store = {};
  const sandbox = {
    console, Math, Date, Intl, JSON, Number, String, Array, Object, Boolean, isFinite,
    parseInt, parseFloat, setTimeout, clearTimeout, setInterval, clearInterval, Promise, RegExp, Error,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    $: id => (id === 'pane' ? pane : id === 'app' ? app : null),
    document: {
      getElementById: id => (id === 'pane' ? pane : id === 'app' ? app : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => { },
      head: { insertAdjacentHTML: () => { }, appendChild: () => { } },
      body: { appendChild: () => { }, insertAdjacentHTML: () => { } },
      createElement: () => ({ style: {}, setAttribute: () => { }, appendChild: () => { } })
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CORE, sandbox, { filename: 'rb-core.js' });
  return { sandbox, pane, app };
}

test('Panduan Belajar menulis ke #pane (tidak lagi kosong)', () => {
  const { sandbox, pane } = coreSandbox();
  sandbox.S = { sec: 'sekolah', tab: 'panduan', mapel: 'Matematika' };
  const html = sandbox.pPanduan();
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 800, 'HTML panduan harus berisi, bukan string kosong');
  assert.ok(pane.innerHTML.length > 800, '#pane harus diisi langsung oleh pPanduan');
  assert.match(pane.innerHTML, /Alur 7 langkah/);
  assert.match(pane.innerHTML, /Cara progres dihitung/);
  assert.match(pane.innerHTML, /Data hilang setelah ganti perangkat/);
});

test('Panduan tidak lagi menawarkan tab Belajar Soal dan menyebut Kurikulum', () => {
  const { sandbox, pane } = coreSandbox();
  sandbox.S = { sec: 'sekolah', tab: 'panduan', mapel: 'IPA' };
  sandbox.pPanduan();
  assert.doesNotMatch(pane.innerHTML, /Belajar Soal/, 'istilah Belajar Soal harus hilang');
  assert.match(pane.innerHTML, /Kurikulum/);
  assert.match(pane.innerHTML, /pelajaran spesial/i);
});

test('Deretan tab Belajar: tanpa "Belajar Soal", ada Panduan + Kurikulum', () => {
  const { sandbox, app } = coreSandbox();
  sandbox.MAPEL = { sekolah: ['Matematika', 'IPA'] };
  sandbox.SMK_FIELD = {};
  sandbox.S = { sec: 'sekolah', tab: 'latihan', mapel: 'Matematika' };
  sandbox.mapelOptions = () => '<option>Matematika</option>';
  sandbox.pane = () => { };
  sandbox.rbCanSpecial = () => true;
  sandbox.home = () => { };
  sandbox.homeBase();
  const html = app.innerHTML;
  assert.doesNotMatch(html, /Belajar Soal/);
  assert.match(html, /Kurikulum/);
  assert.match(html, /Panduan/);
  assert.doesNotMatch(html, /S\.tab='soal'/, 'tidak boleh ada tombol yang membuka tab soal');
});

/* ---------------- kurikulum + pelajaran spesial ---------------- */
function kurikulumCtx(opts) {
  const o = opts || {};
  const pane = { innerHTML: '' };
  const ctx = {
    console, Math, Date, Intl, JSON, Number, String, Array, Object, Boolean, Set,
    encodeURIComponent, decodeURIComponent,
    document: { getElementById: id => (id === 'pane' ? pane : null) },
    $: id => (id === 'pane' ? pane : null),
    S: { mapel: o.mapel || 'Matematika', admin: !!o.admin, akses: o.akses || [] },
    SPECIAL_MAPEL: ['Psikologi', 'Sosiologi'],
    TOPICS: { Matematika: ['pecahan', 'aljabar'], Psikologi: ['persepsi', 'memori'], Sosiologi: ['interaksi', 'stratifikasi'] },
    MAPEL: { sekolah: ['Matematika', 'Psikologi', 'Sosiologi'] },
    SMK_FIELD: {}, SMK_GROUPS: [],
    RB_SPECIAL_INFO: {
      Psikologi: { ico: '🧠', desc: 'Ilmu perilaku', pakai: 'Siswa SMA' },
      Sosiologi: { ico: '🏙️', desc: 'Ilmu masyarakat', pakai: 'Siswa SMA' }
    },
    topicList: lv => (/SMA/.test(String(lv)) ? ['pecahan', 'aljabar', 'geometri', 'statistika'] : []),
    kurLatLevel: () => o.level || 'SMA Kelas 10',
    isUmum: () => false,
    esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    kurLatFetch: () => { },
    home: () => { },
    localStorage: { getItem: () => null, setItem: () => { } }
  };
  vm.createContext(ctx);
  ['rbCanSpecial', 'rbSpecialAll', 'rbSubStart', 'pKurikulum', 'mapelOptions'].forEach(name => {
    vm.runInContext(extractFn(INDEX, name), ctx, { filename: name + ' (index.html)' });
  });
  return { ctx, pane };
}

test('Kurikulum merender rencana belajar dan peta topik', () => {
  const { ctx, pane } = kurikulumCtx({});
  ctx.pKurikulum();
  assert.ok(pane.innerHTML.length > 900, 'isi kurikulum harus dirender ke #pane');
  assert.match(pane.innerHTML, /Rencana 4 minggu/);
  assert.match(pane.innerHTML, /Peta topik/);
  assert.match(pane.innerHTML, /Materi acuan real-time/);
  assert.match(pane.innerHTML, /rbSubStart\(/, 'topik harus bisa diklik untuk latihan');
});

test('Admin melihat Psikologi + Sosiologi sebagai izin aktif', () => {
  const { ctx, pane } = kurikulumCtx({ admin: true });
  ctx.pKurikulum();
  assert.equal(ctx.rbCanSpecial('Psikologi'), true);
  assert.equal(ctx.rbCanSpecial('Sosiologi'), true);
  assert.match(pane.innerHTML, /izin aktif/);
  assert.doesNotMatch(pane.innerHTML, /terkunci/);
  const opts = ctx.mapelOptions();
  assert.match(opts, /Psikologi/);
  assert.match(opts, /Sosiologi/);
});

test('Pengguna tanpa izin: pelajaran spesial terkunci dan tidak ada di menu', () => {
  const { ctx, pane } = kurikulumCtx({ admin: false, akses: [] });
  ctx.pKurikulum();
  assert.equal(ctx.rbCanSpecial('Psikologi'), false);
  assert.equal(ctx.rbCanSpecial('Sosiologi'), false);
  assert.match(pane.innerHTML, /terkunci/);
  assert.doesNotMatch(pane.innerHTML, /izin aktif/);
  const opts = ctx.mapelOptions();
  assert.doesNotMatch(opts, /Psikologi/, 'mapel terkunci tidak boleh muncul di menu');
  assert.doesNotMatch(opts, /Sosiologi/);
  assert.match(opts, /Matematika/, 'pelajaran biasa tetap tampil');
});

test('Izin per pelajaran hanya membuka pelajaran yang diberikan', () => {
  const { ctx, pane } = kurikulumCtx({ admin: false, akses: ['Psikologi'] });
  ctx.pKurikulum();
  assert.equal(ctx.rbCanSpecial('Psikologi'), true);
  assert.equal(ctx.rbCanSpecial('Sosiologi'), false);
  const opts = ctx.mapelOptions();
  assert.match(opts, /Psikologi/);
  assert.doesNotMatch(opts, /Sosiologi/);
  assert.match(pane.innerHTML, /izin aktif/);
  assert.match(pane.innerHTML, /terkunci/);
});

test('Akses "semua" membuka kedua pelajaran spesial', () => {
  const { ctx } = kurikulumCtx({ admin: false, akses: ['semua'] });
  assert.deepEqual(ctx.rbSpecialAll(), ['Psikologi', 'Sosiologi']);
});

test('rbSubStart menerima topik ter-encode dan membuka latihan', () => {
  const { ctx } = kurikulumCtx({});
  const sub = 'pecahan & desimal';
  ctx.rbSubStart(encodeURIComponent(sub), 'latihan');
  assert.equal(ctx.S.sub, sub);
  assert.equal(ctx.S.tab, 'latihan');
});
