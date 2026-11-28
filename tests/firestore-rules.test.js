'use strict';
/* ==========================================================================
   Validasi statis firestore.rules.

   Tes ini membaca aturan sebagai teks, mengambil blok `match` dengan
   menghitung kurung kurawal, lalu memeriksa hal-hal yang paling mudah salah
   dan paling berbahaya:

   1. Pemilik akun TIDAK bisa menulis status/admin/trading/pelajaran pada
      dokumennya sendiri (whitelist hasOnly hanya profil).
   2. Akun baru tidak bisa lahir dengan hak akses.
   3. Hanya admin yang boleh mengelola pengguna/izin (allow create, update,
      delete: if isAdmin()).
   4. Data belajar & jurnal selalu terikat uid pemilik.
   5. Tidak ada aturan longgar (allow write/read: if true) dan version = '2'.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
/* Buang komentar agar tidak ikut dievaluasi. */
const RULES = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PRIVILEGED = ['status', 'admin', 'trading', 'pelajaran', 'akses'];

/* Ambil blok yang dibuka pada baris yang sama dengan `match ...`.
   Catatan: path seperti /pengguna/{id} juga memakai kurung kurawal, jadi
   pembuka blok diambil dari '{' terakhir pada baris itu. */
function blockAt(src, start) {
  const lineEnd = src.indexOf('\n', start);
  const open = lineEnd < 0 ? src.lastIndexOf('{') : src.lastIndexOf('{', lineEnd);
  assert.ok(open > start, 'blok match harus membuka { pada baris yang sama');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error('blok tidak tertutup');
}
function matchBlock(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, 'blok tidak ditemukan: ' + marker);
  return blockAt(src, start);
}

/* Ambil isi satu klausa `allow ... : if <kondisi>;` (sampai titik koma). */
function clauses(block, kind) {
  const out = [];
  const re = new RegExp('allow\\s+([^:;]+):\\s*if([\\s\\S]*?);', 'g');
  let m;
  while ((m = re.exec(block))) {
    const kinds = m[1].split(',').map(s => s.trim());
    if (kinds.indexOf(kind) >= 0) {
      out.push({ kinds, cond: m[2].replace(/\s+/g, ' ').trim() });
    }
  }
  return out;
}
function arrayIn(cond, fn) {
  const m = new RegExp(fn + '\\(\\[([\\s\\S]*?)\\]\\)').exec(cond);
  if (!m) return [];
  return (m[1].match(/'[^']*'/g) || []).map(s => s.replace(/'/g, ''));
}

const userBlock = matchBlock(RULES, 'match /pengguna/{id}');

test('firestore.rules: versi 2 dan kurung kurawal seimbang', () => {
  assert.match(RULES, /rules_version\s*=\s*'2'/, 'harus memakai rules_version 2');
  let depth = 0;
  for (const ch of RULES) {
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; assert.ok(depth >= 0, 'ada } berlebih'); }
  }
  assert.equal(depth, 0, 'kurung kurawal harus seimbang');
});

test('firestore.rules: tidak ada aturan terbuka (if true)', () => {
  assert.doesNotMatch(RULES, /allow\s+(read|write|read,\s*write)\s*:\s*if\s+true/i);
  assert.doesNotMatch(RULES, /allow\s+write\s*:/i, 'pakai read/create/update/delete yang eksplisit');
});

test('Pemilik tidak bisa memberi dirinya akses pelajaran sendiri', () => {
  const ownerUpdates = clauses(userBlock, 'update').filter(c => /id\s*==\s*mail\(\)/.test(c.cond));
  assert.ok(ownerUpdates.length >= 1, 'harus ada klausa update untuk pemilik (id == mail())');
  const owner = ownerUpdates[0];
  const allowed = arrayIn(owner.cond, 'hasOnly');
  assert.ok(allowed.length > 0, 'update pemilik wajib memakai whitelist hasOnly([...])');
  const forbidden = allowed.filter(f => PRIVILEGED.indexOf(f) >= 0);
  assert.deepEqual(forbidden, [], 'field hak akses tidak boleh ada di whitelist pemilik: ' + forbidden.join(', '));
  assert.deepEqual(allowed.sort(), ['foto', 'nama', 'terakhir', 'uid'], 'pemilik hanya boleh ubah profil');
});

test('Whitelist pemilik benar-benar menolak field sensitif', () => {
  const owner = clauses(userBlock, 'update').filter(c => /id\s*==\s*mail\(\)/.test(c.cond))[0];
  const allowed = arrayIn(owner.cond, 'hasOnly');
  const canWrite = field => allowed.indexOf(field) >= 0;
  PRIVILEGED.forEach(f => assert.equal(canWrite(f), false, 'pemilik tidak boleh menulis ' + f));
  assert.equal(canWrite('nama'), true);
  assert.equal(canWrite('foto'), true);
});

test('Akun baru tidak bisa dibuat dengan hak akses', () => {
  const create = clauses(userBlock, 'create').filter(c => /status\s*==\s*'menunggu'/.test(c.cond))[0];
  assert.ok(create, 'harus ada create pendaftaran mandiri dengan status menunggu');
  const banned = arrayIn(create.cond, 'hasAny');
  PRIVILEGED.forEach(f => {
    if (f === 'status') return; // status justru wajib 'menunggu'
    assert.ok(banned.indexOf(f) >= 0, 'create harus melarang field ' + f);
  });
  assert.match(create.cond, /id\s*==\s*mail\(\)/);
  assert.match(create.cond, /email\s*==\s*mail\(\)/);
});

test('Hanya admin yang boleh mengelola pengguna dan izin', () => {
  assert.match(userBlock, /allow\s+create,\s*update,\s*delete\s*:\s*if\s+isAdmin\(\)/,
    'admin harus punya klausa penuh di /pengguna');
  const trading = matchBlock(RULES, 'match /izin_trading/{id}');
  assert.match(trading, /allow\s+delete\s*:\s*if\s+isAdmin\(\)/);
  const trUpdate = clauses(trading, 'update');
  assert.ok(trUpdate.some(c => /isAdmin\(\)/.test(c.cond)), 'admin harus bisa menyetujui izin Trading');
  const ownerAsk = trUpdate.filter(c => /id\s*==\s*mail\(\)/.test(c.cond));
  assert.ok(ownerAsk.length >= 1, 'pemilik hanya boleh mengajukan ulang izin');
  assert.match(ownerAsk[0].cond, /resource\.data\.status in \['ditolak', 'dicabut'\]/,
    'pemilik tidak boleh mengubah izin yang masih berlaku');
});

test('isAdmin hanya berbasis email terverifikasi dari daftar admin', () => {
  assert.match(RULES, /function adminEmails\(\)\s*\{\s*return \[[^\]]+\]/);
  assert.match(RULES, /function isAdmin\(\)[\s\S]{0,120}verified\(\)[\s\S]{0,120}mail\(\) in adminEmails\(\)/,
    'isAdmin wajib memeriksa email terverifikasi');
});

test('Data belajar dan jurnal selalu terikat uid pemilik', () => {
  const generic = matchBlock(RULES, 'match /{col}/{docId}');
  const cols = ['soal', 'hasil', 'chat', 'catatan', 'kata'];
  cols.forEach(col => assert.ok(generic.indexOf("'" + col + "'") >= 0, 'koleksi ' + col + ' harus diatur'));
  const read = clauses(generic, 'read')[0];
  assert.match(read.cond, /resource\.data\.uid == request\.auth\.uid/, 'read wajib milik sendiri');
  const create = clauses(generic, 'create')[0];
  assert.match(create.cond, /isOwnerUid\(\)|request\.resource\.data\.uid == request\.auth\.uid/,
    'create wajib menulis uid sendiri');
  const jurnalList = clauses(generic, 'list').filter(c => /jurnal/.test(c.cond))[0];
  assert.ok(jurnalList, 'jurnal harus punya aturan list');
  assert.match(jurnalList.cond, /resource\.data\.uid == request\.auth\.uid/);
  assert.match(jurnalList.cond, /hasTrading\(\)/, 'jurnal hanya untuk akun dengan izin Trading');
});

test('Papan peringkat hanya ditulis pemiliknya', () => {
  const papan = matchBlock(RULES, 'match /papan/{uid}');
  const create = clauses(papan, 'create')[0];
  assert.match(create.cond, /uid == request\.auth\.uid/);
  assert.match(create.cond, /hasOnly\(\[/, 'papan wajib memakai whitelist field');
  assert.match(papan, /allow\s+delete\s*:\s*if\s+isAdmin\(\)/);
});

test('Setiap match block tertutup dan punya minimal satu allow', () => {
  const starts = [];
  const re = /\bmatch\s+\//g;
  let m;
  while ((m = re.exec(RULES))) starts.push(m.index);
  assert.ok(starts.length >= 5, 'harus ada blok pengguna, izin_trading, papan, dan wildcard');
  starts.forEach(start => {
    const head = RULES.slice(start, RULES.indexOf('\n', start)).trim();
    const block = blockAt(RULES, start);
    assert.ok(/\ballow\b/.test(block), 'blok ' + head + ' harus punya minimal satu allow');
  });
});
