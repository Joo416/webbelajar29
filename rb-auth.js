/* ==========================================================================
   RB AUTH — satu sumber logika pemeriksaan akses.
   Dipakai login.html (halaman masuk) dan index.html (isi aplikasi) supaya
   aturan izin tidak pernah berbeda antara kedua halaman:
   - admin resmi / field admin=true selalu boleh masuk;
   - status 'aktif' boleh masuk;
   - status lain ditolak dengan alasan yang bisa ditampilkan;
   - kegagalan menulis penanda admin TIDAK memblokir akses.
   Modul ini tidak menyimpan sesi dan tidak mengubah arah aplikasi; pemanggil
   yang memutuskan redirect atau tampilan.
   ========================================================================== */
(function () {
  'use strict';

  var ADMIN_EMAIL = 'amoraarik6@gmail.com';
  var COLLECTION = 'pengguna';

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function mailOf(user) {
    var em = norm(user && user.email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : '';
  }
  function isAdmin(email, data) {
    return norm(email) === norm(ADMIN_EMAIL) || !!(data && data.admin === true);
  }
  function serverTime() {
    try { return window.firebase.firestore.FieldValue.serverTimestamp(); }
    catch (e) { return Date.now(); }
  }
  function errorText(e) {
    var m = String((e && e.message) || e || '');
    if (/melebihi/i.test(m)) return 'Server izin tidak menjawab dalam batas waktu. Jaringanmu mungkin memblokir Firestore; ganti jaringan atau matikan VPN lalu tekan Cek lagi.';
    if (/permission|insufficient/i.test(m)) return 'Izin Firestore menolak pembacaan status. Hubungi admin agar aturan akses dipasang.';
    if (/network|offline|unavailable|failed to get/i.test(m)) return 'Koneksi ke server gagal. Periksa internet lalu tekan Cek lagi.';
    return m ? m.slice(0, 220) : 'Status akses tidak dapat dibaca.';
  }
  /* Firestore bisa menggantung tanpa batas ketika jaringan memblokir
     firestore.googleapis.com. Tanpa batas waktu, halaman masuk berhenti
     selamanya di "Memeriksa izin akses…". */
  function guard(p, ms) {
    return Promise.race([
      p,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('Pemeriksaan izin melebihi ' + Math.round(ms / 1000) + ' detik')); }, ms);
      })
    ]);
  }

  /* Hasil:
     { ok:true, admin:boolean, email, data }
     { ok:false, status:'menunggu'|'diblokir'|'error', message, email, data } */
  async function check(user, opts) {
    var db = (opts && opts.db) || null;
    if (!db) return { ok: false, status: 'error', message: 'Database belum siap. Muat ulang halaman.' };
    var email = mailOf(user);
    if (!email) {
      return { ok: false, status: 'error', message: 'Akun Google ini tidak memiliki email.', email: '' };
    }
    try {
      var ref = db.collection(COLLECTION).doc(email);
      var base = {
        email: email,
        nama: (user && user.displayName) || '',
        foto: (user && user.photoURL) || '',
        uid: (user && user.uid) || ''
      };
      var snap = await guard(ref.get(), 18000);
      if (!snap.exists) {
        await guard(ref.set({ ...base, status: 'menunggu', dibuat: serverTime() }), 12000);
        snap = await guard(ref.get(), 12000);
      }
      var data = (snap && snap.data()) || {};
      if (isAdmin(email, data)) {
        /* Admin boleh menulis statusnya sendiri. Bila aturan Firestore belum
           mengizinkan update, akses tetap diberikan: penanda admin tetap sah. */
        try {
          await guard(ref.set({
            ...base,
            nama: (user && user.displayName) || data.nama || '',
            foto: (user && user.photoURL) || data.foto || '',
            status: 'aktif', admin: true, terakhir: serverTime()
          }, { merge: true }), 12000);
        } catch (e) { }
        return { ok: true, admin: true, email: email, data: data };
      }
      if (data.status === 'aktif') return { ok: true, admin: false, email: email, data: data };
      return {
        ok: false, email: email, data: data,
        status: data.status === 'diblokir' ? 'diblokir' : 'menunggu'
      };
    } catch (e) {
      return { ok: false, status: 'error', message: errorText(e), email: email };
    }
  }

  window.RBAuth = {
    ADMIN_EMAIL: ADMIN_EMAIL,
    mailOf: mailOf,
    isAdmin: isAdmin,
    errorText: errorText,
    check: check
  };
})();
