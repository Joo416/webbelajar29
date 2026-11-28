/* ==========================================================================
   RUANG BELAJAR — panel admin rapi (dimuat paling akhir)
   Menimpa drawAdmin/drawAdList/trCard16 lama dengan kartu member yang ringkas:
   statistik, filter, pencarian, badge status, dan aksi per akun.
   ========================================================================== */

function rbAdInitial(x) {
  const s = String((x && (x.nama || x.email || x.id)) || '?').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}
function rbAdTradeChip(x, tr) {
  if (x.admin) return '<span class="badge b-admin">Admin</span>';
  if (tr === 'disetujui') return '<span class="badge b-aktif">Trading aktif</span>';
  if (tr === 'menunggu') return '<span class="badge b-menunggu">Menunggu Trading</span>';
  return '<span class="badge b-off">Tanpa Trading</span>';
}
function rbAdTradeLabel(tr) {
  if (tr === 'disetujui') return 'Cabut Trading';
  return 'Beri Trading';
}

/* ---------- akses pelajaran spesial (Psikologi / Sosiologi) ---------- */
function rbAdSpecialList(x) {
  const a = x && Array.isArray(x.pelajaran) ? x.pelajaran : [];
  return a.filter(function (m) { return m === 'semua' || SPECIAL_MAPEL.indexOf(m) >= 0; });
}
function rbAdSpecialChips(x) {
  if (x && x.admin) return '<span class="badge b-admin">Semua pelajaran</span>';
  const a = rbAdSpecialList(x);
  if (!a.length) return '';
  if (a.indexOf('semua') >= 0) return '<span class="badge b-aktif">Psikologi + Sosiologi</span>';
  return a.map(function (m) { return '<span class="badge b-aktif">' + esc(m) + '</span>'; }).join(' ');
}
function rbAdSpecialBtns(x) {
  if (!x || x.admin) return '';
  const a = rbAdSpecialList(x);
  const all = a.indexOf('semua') >= 0;
  return SPECIAL_MAPEL.map(function (m) {
    const on = all || a.indexOf(m) >= 0;
    return '<button class="ad-act ' + (on ? 'warn' : '') + '" type="button" data-id="' + esc(x.id) + '" data-m="' + esc(m) + '" data-on="' + (on ? '1' : '0') + '" onclick="adSpecial(this)">'
      + (on ? 'Cabut ' : 'Beri ') + esc(m) + '</button>';
  }).join('');
}
async function adSpecial(el) {
  const id = el && el.dataset ? el.dataset.id : '';
  const m = el && el.dataset ? el.dataset.m : '';
  const on = el && el.dataset ? el.dataset.on === '1' : false;
  if (!id || !m) return;
  try {
    const ref = db.collection('pengguna').doc(id);
    const snap = await ref.get();
    const cur = (snap.exists && Array.isArray(snap.data().pelajaran)) ? snap.data().pelajaran.slice() : [];
    const next = on ? cur.filter(function (x) { return x !== m; }) : Array.from(new Set(cur.concat([m])));
    await ref.set({ pelajaran: next }, { merge: true });
    const row = (AD.list || []).find(function (x) { return x.id === id; });
    if (row) row.pelajaran = next;
    drawAdmin();
  } catch (e) {
    alert('Gagal menyimpan akses pelajaran: ' + ((e && e.message) || e) + '\nPastikan aturan Firestore terbaru sudah dipasang.');
  }
}
async function adSpecialEmail() {
  const em = String(($('adesp') || {}).value || '').trim().toLowerCase();
  const m = String(($('adspec') || {}).value || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return alert('Format email tidak valid');
  const ref = db.collection('pengguna').doc(em);
  try {
    const snap = await ref.get();
    const cur = (snap.exists && Array.isArray(snap.data().pelajaran)) ? snap.data().pelajaran.slice() : [];
    const next = Array.from(new Set(cur.concat([m])));
    await ref.set({ email: em, pelajaran: next }, { merge: true });
    const row = (AD.list || []).find(function (x) { return x.id === em; });
    if (row) row.pelajaran = next;
    $('adesp').value = '';
    drawAdmin();
  } catch (e) {
    alert('Gagal memberi akses: ' + ((e && e.message) || e));
  }
}

function drawAdmin() {
  if (!S.admin) { $('app').innerHTML = '<div class="card">Halaman ini hanya untuk admin.</div>'; return; }
  const L = (AD.list || []), n = k => L.filter(x => x.status === k).length;
  const TR = Object.values(AD.tr || {});
  const trOk = TR.filter(function (x) { return x.status === 'disetujui'; }).length;
  const trPend = TR.filter(function (x) { return x.status === 'menunggu'; }).length;
  $('app').innerHTML = trCard16()
    + '<div class="card">'
    + '<div class="ad-head"><div><h3>Kelola pengguna</h3>'
    + '<div class="mut small">Setujui akun baru, blokir akses, dan atur izin Trading per pengguna.</div></div>'
    + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
    + '<span class="rb-pill">' + L.length + ' akun</span>'
    + '<button class="x" type="button" onclick="adminView()">Muat ulang</button></div></div>'
    + '<div class="ad-sum">'
    + [['aktif', 'Aktif'], ['menunggu', 'Menunggu'], ['diblokir', 'Diblokir']].map(function (s) {
      return '<div class="ad-stat"><b>' + n(s[0]) + '</b><span>' + s[1] + '</span></div>';
    }).join('')
    + '<div class="ad-stat"><b>' + trOk + '</b><span>Trading aktif</span></div>'
    + '<div class="ad-stat"><b>' + trPend + '</b><span>Permintaan Trading</span></div>'
    + '</div>'
    + '<div class="ad-toolbar">'
    + '<div class="ad-filter">'
    + ['semua', 'menunggu', 'aktif', 'diblokir'].map(function (k) {
      return '<button type="button" class="' + (AD.f === k ? 'on' : '') + '" onclick="AD.f=\'' + k + '\';drawAdmin()">'
        + k.charAt(0).toUpperCase() + k.slice(1) + '</button>';
    }).join('')
    + '</div>'
    + '<input id="adq" placeholder="Cari nama atau email" autocomplete="off" value="' + esc(AD.q) + '" oninput="adSearch(this.value)">'
    + '</div>'
    + '<div id="adlist"></div>'
    + '</div>'
    + '<div class="card"><h3>Izinkan email tertentu</h3>'
    + '<div class="mut small" style="margin-bottom:10px">Daftarkan email sebelum orangnya masuk. Akun langsung berstatus aktif.</div>'
    + '<div class="ad-add"><input id="adem" type="email" placeholder="nama@gmail.com" autocomplete="off">'
    + '<button class="btn" type="button" onclick="adAdd()">Izinkan</button></div></div>'
    + '<div class="card"><div class="rb-card-head"><h3>🎓 Akses pelajaran spesial</h3><span class="rb-pill">Psikologi · Sosiologi</span></div>'
    + '<div class="mut small" style="margin-bottom:10px">Dua pelajaran ini tidak tampil di menu pelajaran sampai admin memberi izin per akun. Admin selalu bisa membuka. Akses ikut terbaca saat pengguna memuat ulang halaman.</div>'
    + '<div class="ad-add"><input id="adesp" type="email" placeholder="nama@gmail.com" autocomplete="off">'
    + '<select id="adspec" aria-label="Pilih pelajaran">' + SPECIAL_MAPEL.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>'
    + '<button class="btn" type="button" onclick="adSpecialEmail()">Beri akses</button></div>'
    + '<div class="rb-note" style="margin-top:8px">Cabut akses lewat tombol di daftar pengguna (Beri/Cabut Psikologi atau Sosiologi).</div></div>'
    + '<div class="card"><div class="rb-card-head"><h3>Alur kerja admin</h3></div>'
    + '<div class="item"><span>1. Setujui akun baru</span><b>Izinkan</b></div>'
    + '<div class="item"><span>2. Beri akses Trading bila perlu</span><b>Beri Trading</b></div>'
    + '<div class="item"><span>3. Uji key AI setelah mengubah env Vercel</span><b>Uji semua key</b></div>'
    + '<div class="rb-note" style="margin-top:10px">Perubahan izin berlaku maksimal satu menit setelah disimpan. Blokir dan hapus tidak menghapus riwayat belajar pengguna.</div></div>';
  drawAdList();
}

function drawAdList() {
  const me = String((user && user.email) || '').toLowerCase();
  const q = String(AD.q || '').toLowerCase().trim();
  const rows = (AD.list || []).filter(function (x) {
    return (AD.f === 'semua' || x.status === AD.f)
      && (!q || ((x.email || '') + ' ' + (x.nama || '')).toLowerCase().indexOf(q) >= 0);
  }).sort(function (a, b) {
    return ((ST_ORD[a.status] == null ? 3 : ST_ORD[a.status]) - (ST_ORD[b.status] == null ? 3 : ST_ORD[b.status]))
      || String(a.email || '').localeCompare(String(b.email || ''));
  });
  const box = $('adlist');
  if (!box) return;
  if (!rows.length) {
    box.innerHTML = '<div class="ad-count">0 dari ' + (AD.list || []).length + ' akun</div>'
      + '<div class="ad-empty">Tidak ada akun yang cocok dengan filter atau pencarian.</div>';
    return;
  }
  box.innerHTML = '<div class="ad-count">' + rows.length + ' dari ' + (AD.list || []).length + ' akun</div>'
    + rows.map(function (x) {
      const self = x.email === me;
      const id = esc(x.id);
      const tr = (AD.tr && AD.tr[x.id] || {}).status;
      const acts = self ? '<span class="small mut">Akun kamu</span>'
        : (x.status !== 'aktif' ? '<button class="ad-act ok" type="button" data-id="' + id + '" onclick="adSet(this,\'aktif\')">Izinkan</button>' : '')
        + (x.status !== 'diblokir' ? '<button class="ad-act danger" type="button" data-id="' + id + '" onclick="adSet(this,\'diblokir\')">Blokir</button>' : '')
        + (x.admin ? '' : '<button class="ad-act ' + (tr === 'disetujui' ? 'warn' : '') + '" type="button" data-id="' + id + '" onclick="adTrade(this,\'' + (tr === 'disetujui' ? 'dicabut' : 'disetujui') + '\')">' + rbAdTradeLabel(tr) + '</button>')
        + rbAdSpecialBtns(x)
        + '<button class="ad-act danger" type="button" data-id="' + id + '" onclick="adDel(this)">Hapus</button>';
      const av = x.foto
        ? '<img src="' + esc(x.foto) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
        : esc(rbAdInitial(x));
      return '<div class="ad-row">'
        + '<div class="ad-av">' + av + '</div>'
        + '<div><div class="ad-top"><div>'
        + '<div class="ad-name">' + esc(x.nama || '(belum ada nama)') + '</div>'
        + '<div class="ad-mail">' + esc(x.email || x.id) + '</div>'
        + '</div><span class="badge b-' + esc(x.status) + '">' + esc(x.status) + '</span></div>'
        + '<div class="ad-tags">' + rbAdTradeChip(x, tr) + rbAdSpecialChips(x) + '</div>'
        + '<div class="ad-acts">' + acts + '</div>'
        + '</div></div>';
    }).join('');
}

function trCard16() {
  let body;
  if (AD.trErr) {
    body = '<div class="card"><h3>Izin Trading</h3><div class="warn">Koleksi "izin_trading" belum bisa dibaca ('
      + esc(AD.trErr) + '). Pasang aturan Firestore terbaru agar izin Trading bisa diberikan dan diminta.</div></div>';
  } else {
    const L = Object.values(AD.tr || {});
    const pend = L.filter(function (x) { return x.status === 'menunggu'; });
    const okn = L.filter(function (x) { return x.status === 'disetujui'; }).length;
    body = '<div class="card"><div class="ad-head"><div><h3>Izin Trading</h3>'
      + '<div class="mut small">Permintaan akses tab Trading. Perubahan berlaku maksimal satu menit.</div></div>'
      + '<span class="rb-pill">' + okn + ' disetujui</span></div>'
      + (pend.length ? pend.map(function (x) {
        return '<div class="ad-req"><div class="ad-top"><div>'
          + '<div class="ad-name">' + esc(x.email || x.id) + '</div>'
          + '<div class="ad-mail">' + esc(x.pesan || '(tanpa pesan)') + '</div></div></div>'
          + '<div class="ad-acts"><button class="ad-act ok" type="button" data-id="' + esc(x.id) + '" onclick="adTrade(this,\'disetujui\')">Setujui</button>'
          + '<button class="ad-act danger" type="button" data-id="' + esc(x.id) + '" onclick="adTrade(this,\'ditolak\')">Tolak</button></div></div>';
      }).join('') : '<div class="ad-empty">Tidak ada permintaan baru.</div>')
      + '</div>';
  }
  return (typeof aiCard19 === 'function' ? aiCard19() : '') + body;
}
