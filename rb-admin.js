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

function drawAdmin() {
  if (!S.admin) { $('app').innerHTML = '<div class="card">Halaman ini hanya untuk admin.</div>'; return; }
  const L = (AD.list || []), n = k => L.filter(x => x.status === k).length;
  $('app').innerHTML = trCard16()
    + '<div class="card">'
    + '<div class="ad-head"><div><h3>Kelola pengguna</h3>'
    + '<div class="mut small">Setujui akun baru, blokir akses, dan atur izin Trading per pengguna.</div></div>'
    + '<span class="rb-pill">' + L.length + ' akun</span></div>'
    + '<div class="ad-sum">'
    + [['aktif', 'Aktif'], ['menunggu', 'Menunggu'], ['diblokir', 'Diblokir']].map(function (s) {
      return '<div class="ad-stat"><b>' + n(s[0]) + '</b><span>' + s[1] + '</span></div>';
    }).join('')
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
    + '<button class="btn" type="button" onclick="adAdd()">Izinkan</button></div></div>';
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
        + '<div class="ad-tags">' + rbAdTradeChip(x, tr) + '</div>'
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
