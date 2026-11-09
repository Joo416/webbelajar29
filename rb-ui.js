/* ==========================================================================
   RUANG BELAJAR V27 — desain baru, menu 3 garis, tema, panduan lengkap
   Dimuat setelah rb-content.js. Tidak mengubah mesin latihan/peringkat.
   ========================================================================== */

document.head.insertAdjacentHTML('beforeend', '<style id="rb27css">'
  + 'body{font-family:"Manrope",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:-.005em}'
  + 'h1,h2,h3,.btn,.tabs button,.stabs button,.rb-dhead b,.rb-gbody h2,.rb-gbody h3{font-family:"Sora","Manrope",ui-sans-serif,sans-serif}'
  + '.wrap{max-width:1040px;padding:20px 20px 120px}'
  + '.topbar{align-items:center;margin-bottom:16px;gap:12px}'
  + '.topbar h1{display:flex;align-items:center;gap:11px;font-size:clamp(1.16rem,4.2vw,1.52rem);letter-spacing:-.035em;margin:0}'
  + '.logo{width:42px;height:42px;border-radius:14px;margin:0;font-size:1.08rem;background:linear-gradient(145deg,var(--accent),var(--accent2));box-shadow:0 14px 26px -18px rgba(125,150,255,.95);display:inline-grid;place-items:center}'
  + '.sub{font-size:.7rem;letter-spacing:.05em;margin:4px 0 0;color:var(--mut);font-weight:600}'
  + '.rb-topmenu{flex:0 0 auto;margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:13px;border:1px solid var(--line);background:var(--card);color:var(--tx);font:inherit;font-weight:800;font-size:.85rem;cursor:pointer;box-shadow:var(--shadow);transition:background .15s}'
  + '.rb-topmenu:hover{background:var(--card2)}'
  + '.rb-topmenu[hidden]{display:none}'
  + 'h1,h2,h3{text-wrap:balance}'
  + 'p,.mut,.small,.sub{text-wrap:pretty}'
  + '.card,.rb-gbody section{overflow-wrap:anywhere}'
  + '.card p,.card li,.msg,.hint,.exp{line-height:1.65}'
  + '.tabs button{white-space:nowrap}'
  + '.theme-btn{flex:0 0 auto;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:1.12rem;background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--tx);transition:transform .15s,background .15s,border-color .15s}'
  + '.theme-btn:hover{background:var(--card2);border-color:var(--line2)}'
  + '.theme-btn:active{transform:scale(.95)}'
  + '#v21theme{display:none!important}'
  + '.card{background:linear-gradient(172deg,var(--card2) 0%,var(--card) 48%);border-radius:20px;padding:18px;border:1px solid var(--line);box-shadow:var(--shadow);transition:border-color .18s}'
  + '@media(hover:hover){.card:hover{border-color:var(--line2)}}'
  + 'html[data-theme=light] .card{background:linear-gradient(172deg,#ffffff,#fbfcff)}'
  + '.card h3{font-size:1rem;letter-spacing:-.015em;margin:0 0 10px;line-height:1.4}'
  + 'h2{font-family:"Sora",sans-serif;font-size:1.22rem;letter-spacing:-.03em;line-height:1.25;margin:0 0 8px}'
  + '.btn{border-radius:14px;min-height:46px;color:#fff;background:linear-gradient(155deg,var(--accent),var(--accent2));box-shadow:0 14px 28px -20px rgba(125,150,255,.95);font-family:"Sora",sans-serif;font-weight:650;letter-spacing:-.01em}'
  + '.btn.alt,.btn.red{background:var(--card2);color:var(--tx);border:1px solid var(--line);box-shadow:none}'
  + '.btn.alt:hover{background:var(--field);border-color:var(--line2)}'
  + '.btn.red{background:var(--no-soft);color:var(--no);border-color:var(--no-soft)}'
  + 'select,textarea,input{border-radius:13px;border-color:var(--line);background:var(--field)}'
  + 'select:focus,textarea:focus,input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}'
  + '.tabs{border-radius:18px;box-shadow:0 18px 36px -30px rgba(0,0,0,.9)}'
  + '.tabs button.on,.stabs button.on{background:linear-gradient(160deg,var(--accent),var(--accent2));color:#fff;border-radius:13px}'
  + '.stabs{margin-bottom:12px;padding:5px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}'
  + '.stabs::-webkit-scrollbar{display:none}'
  + '.stabs button{flex:0 0 auto;white-space:nowrap;padding:9px 13px;border-radius:12px;font-size:.8rem;min-height:38px}'
  + '.chip{border-radius:999px;font-size:.72rem}'
  + '.msg{border-radius:16px}'
  + '.msg.assistant{background:var(--card2)}'
  + '.exp,.warn,.hint{border-radius:14px}'
  + '.rb-achg{display:flex;gap:6px;overflow-x:auto;padding:2px 0 7px;margin:0 0 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}'
  + '.rb-achg::-webkit-scrollbar{display:none}'
  + '.rb-achg button{flex:0 0 auto;padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}'
  + '.rb-achg button:hover{color:var(--tx);border-color:var(--line2)}'
  + '.rb-achg button.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}'
  + '.rb-achg .n{opacity:.62;font-weight:600;margin-left:4px}'
  + '.rb-hero-alch{background:linear-gradient(150deg,var(--card2),var(--card) 62%)}'
  + '.rb-hero-alch .rb-note{max-width:62ch}'
  + '.rb-kpi b{font-family:"Sora",sans-serif}'
  + '.rb-drawer .rb-mi span{width:22px;text-align:center}'
  + '.rb-scrim{position:fixed;inset:0;z-index:200;background:rgba(4,6,12,.58);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .2s}'
  + '.rb-scrim.on{opacity:1;pointer-events:auto}'
  + '.rb-drawer{position:fixed;top:0;right:0;bottom:0;z-index:201;width:min(370px,92vw);display:flex;flex-direction:column;gap:14px;padding:18px 18px calc(18px + env(safe-area-inset-bottom));background:var(--card);border-left:1px solid var(--line);box-shadow:-24px 0 60px -40px #000;transform:translateX(103%);transition:transform .26s cubic-bezier(.4,0,.2,1);overflow:auto;overscroll-behavior:contain}'
  + '.rb-drawer.on{transform:none}'
  + '.rb-dhead{display:flex;align-items:center;justify-content:space-between;gap:10px}'
  + '.rb-dhead b{font-size:1.05rem;letter-spacing:-.02em}'
  + '.rb-lab{font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:0 0 7px}'
  + '.rb-acct{display:flex;align-items:center;gap:11px;padding:12px;border-radius:16px;background:var(--field);border:1px solid var(--line)}'
  + '.rb-acct img,.rb-av{width:42px;height:42px;border-radius:50%;flex:0 0 auto;object-fit:cover;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-size:1.1rem}'
  + '.rb-acct .nm{font-weight:700;font-size:.9rem;line-height:1.3;overflow-wrap:anywhere}'
  + '.rb-acct .em{font-size:.74rem;color:var(--mut);overflow-wrap:anywhere}'
  + '.rb-theme{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:5px;border-radius:14px;background:var(--field);border:1px solid var(--line)}'
  + '.rb-theme button{min-height:42px;border:0;border-radius:10px;background:transparent;color:var(--mut);font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:background .15s,color .15s}'
  + '.rb-theme button.on{background:var(--card);color:var(--tx);box-shadow:var(--shadow)}'
  + '.rb-mi{display:flex;align-items:center;gap:11px;width:100%;min-height:46px;padding:10px 12px;border-radius:12px;border:1px solid transparent;background:transparent;color:var(--tx);font:inherit;font-size:.9rem;font-weight:600;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}'
  + '.rb-mi:hover{background:var(--field);border-color:var(--line)}'
  + '.rb-sec{display:flex;flex-direction:column;gap:4px}'
  + '.rb-dfoot{margin-top:auto;padding-top:6px}'
  + '.rb-guide{position:fixed;inset:0;z-index:300;background:var(--bg);overflow:auto;opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .2s,transform .2s;overscroll-behavior:contain}'
  + '.rb-guide.on{opacity:1;pointer-events:auto;transform:none}'
  + '.rb-gbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;background:var(--nav);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}'
  + '.rb-gbar b{font-size:1rem;letter-spacing:-.02em;font-family:"Sora",sans-serif}'
  + '.rb-gwrap{max-width:860px;margin:0 auto;padding:16px 18px calc(40px + env(safe-area-inset-bottom))}'
  + '.rb-gtoc{display:flex;gap:6px;overflow-x:auto;padding:2px 0 12px;position:sticky;top:57px;z-index:1;background:var(--bg);scrollbar-width:none}'
  + '.rb-gtoc::-webkit-scrollbar{display:none}'
  + '.rb-gtoc button{flex:0 0 auto;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:.76rem;font-weight:650;cursor:pointer;white-space:nowrap}'
  + '.rb-gtoc button:hover{color:var(--tx);border-color:var(--line2)}'
  + '.rb-gbody section{margin-bottom:18px;padding:16px 17px;border-radius:18px;background:var(--card);border:1px solid var(--line);scroll-margin-top:120px}'
  + '.rb-gbody h2{font-size:1.02rem;margin:0 0 8px;display:flex;align-items:center;gap:8px}'
  + '.rb-gbody h3{font-size:.86rem;margin:14px 0 6px;letter-spacing:-.01em;color:var(--tx)}'
  + '.rb-gbody ul,.rb-gbody ol{margin:6px 0 0;padding-left:19px;font-size:.86rem;line-height:1.7;color:var(--mut)}'
  + '.rb-gbody li{margin-bottom:4px}'
  + '.rb-gbody b,.rb-gbody strong{color:var(--tx)}'
  + '.rb-gbody p{font-size:.86rem;line-height:1.7;color:var(--mut);margin:6px 0 0}'
  + '.rb-gtip{margin-top:10px;padding:11px 13px;border-radius:12px;background:var(--accent-soft);border:1px solid var(--line);font-size:.82rem;line-height:1.6;color:var(--tx)}'
  + '.rb-gwarn{margin-top:10px;padding:11px 13px;border-radius:12px;background:var(--warn-soft);border:1px solid var(--warn-line);font-size:.82rem;line-height:1.6;color:var(--tx)}'
  + '.rb-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}'
  + '.rb-kv>div{padding:10px 12px;border-radius:12px;background:var(--field);border:1px solid var(--line);font-size:.8rem}'
  + '.rb-kv b{display:block;font-size:.95rem;margin-top:2px}'
  + '.rb-calc-out{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:12px}'
  + '.rb-calc-out>div{padding:11px 12px;border-radius:13px;background:var(--field);border:1px solid var(--line)}'
  + '.rb-calc-out span{display:block;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);font-weight:700}'
  + '.rb-calc-out b{display:block;font-family:"Sora",sans-serif;font-size:1rem;margin-top:3px}'
  + '.rb-plan{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8rem;line-height:1.65;min-height:320px}'
  + 'html[data-theme=light] .rb-scrim{background:rgba(20,26,38,.4)}'
  + '@media(max-width:640px){'
  + '.wrap{padding:14px 13px calc(106px + env(safe-area-inset-bottom))}'
  + '.topbar{margin-bottom:13px}'
  + '.logo{width:38px;height:38px;border-radius:13px}'
  + '.theme-btn{width:44px;height:44px;border-radius:14px}'
  + '.card{padding:15px;border-radius:18px}'
  + '.rb-gwrap{padding:12px 13px calc(34px + env(safe-area-inset-bottom))}'
  + '.rb-gbar{padding:12px 13px}'
  + '.rb-gtoc{top:53px}'
  + '.rb-gbody section{padding:14px;border-radius:16px}'
  + '.stabs button{font-size:.76rem;padding:8px 11px}'
  + '}'
  + '@media(prefers-reduced-motion:reduce){.rb-drawer,.rb-guide,.rb-scrim{transition:none}}'
  + '</style>');

/* ---------- markup drawer ---------- */
document.body.insertAdjacentHTML('beforeend',
  '<div id="rbScrim" class="rb-scrim" onclick="rbDrawer(false)"></div>'
  + '<aside id="rbDrawer" class="rb-drawer" aria-hidden="true" aria-label="Menu akun dan tampilan">'
  + '<div class="rb-dhead"><b>Menu</b><button type="button" class="x" onclick="rbDrawer(false)" aria-label="Tutup menu">Tutup</button></div>'
  + '<div class="rb-sec"><div class="rb-lab">Tampilan</div><div class="rb-theme">'
  + '<button type="button" data-rbtheme="light" onclick="rbThemeSet(\'light\')"> Terang</button>'
  + '<button type="button" data-rbtheme="dark" onclick="rbThemeSet(\'dark\')"> Gelap</button>'
  + '</div></div>'
  + '<div class="rb-sec"><div class="rb-lab">Bantuan</div>'
  + '<button type="button" class="rb-mi" onclick="rbGuide(true)"><span></span>Panduan pemakaian lengkap</button>'
  + '</div>'
  + '<div class="rb-dfoot"><button type="button" class="btn red full" id="rbLogout" onclick="rbLogout()">Keluar dari akun</button></div>'
  + '</aside>');

/* ---------- panduan ---------- */
var RB_GUIDE = [
  ['mulai', ' Mulai cepat',
    '<p>Ruang Belajar menyatukan latihan soal sekolah, bahasa Inggris/Jepang, dan edukasi trading dalam satu akun.</p>'
    + '<h3>Langkah pertama</h3><ol>'
    + '<li>Tekan <b>Masuk dengan Google</b>. Akun baru menunggu persetujuan admin; bila sudah disetujui tetapi masih tertahan, tekan <b>Cek lagi</b>.</li>'
    + '<li>Pilih seksi di tab bawah: <b>Beranda</b>, <b>Belajar</b>, <b>Bahasa</b>, atau <b>Trading</b>.</li>'
    + '<li>Di Belajar, pilih pelajaran lewat dropdown, lalu mulai dari <b>Latihan</b>.</li>'
    + '<li>Semua hasil, soal, catatan, dan riwayat tersimpan di akunmu.</li></ol>'
    + '<div class="rb-gtip"> Tombol <b>Menu</b> ada di kanan atas dan hanya berisi tiga hal: mode terang/gelap, panduan ini, dan keluar dari akun. Halaman masuk tidak lagi menampilkan tautan tema/panduan.</div>'],
  ['beranda', ' Beranda & konsistensi',
    '<h3>Angka di atas</h3><ul>'
    + '<li><b>Menit belajar</b>, <b>soal dikerjakan</b>, <b>akurasi</b>, dan <b>streak</b> dihitung dari aktivitasmu.</li>'
    + '<li><b>Target harian</b> bisa diubah. Angka ini dipakai untuk cincin progres dan pengingat.</li></ul>'
    + '<h3>Kalender & jam dunia</h3><ul>'
    + '<li>Setiap tanggal yang berwarna berarti ada aktivitas belajar. Makin gelap, makin banyak.</li>'
    + '<li>Klik tanggal untuk melihat rincian; panah di atas kalender untuk pindah bulan.</li>'
    + '<li>Tujuh jam dunia membantu mengatur waktu belajar atau sesi trading (WIB, Singapura, Tokyo, Dubai, London, New York, Sydney).</li></ul>'
    + '<h3>Peringkat</h3><ul>'
    + '<li>Pilih kategori <b>Sekolah</b>, <b>TKA</b>, atau <b>Umum</b>. Kategori ditentukan dari jenis soal yang kamu jawab, bukan dari menu yang terbuka.</li>'
    + '<li>Hanya jawaban benar yang menambah poin. Data lama dirapikan otomatis saat kamu membuka peringkat.</li></ul>'],
  ['belajar', ' Belajar',
    '<h3>Tab di dalam Belajar</h3><ul>'
    + '<li><b>Latihan</b> — jawab soal, lihat pembahasan, dan ulangi yang salah.</li>'
    + '<li><b>Tryout</b> — berwaktu, dengan navigasi nomor dan tombol ragu-ragu.</li>'
    + '<li><b>Tutor</b> — tanya materi; jawaban fokus pada pelajaran yang dipilih.</li>'
    + '<li><b>Belajar Soal</b> — kumpulan soal yang sudah kamu buat, lengkap dengan pencarian, filter, latihan terpilih, dan acak 10.</li>'
    + '<li><b>Buat Soal</b> — buat soal baru dengan bantuan AI.</li>'
    + '<li><b>Bank</b> — kelola semua soalmu.</li></ul>'
    + '<h3>Tips latihan</h3><ul>'
    + '<li>Mulai dari 10 soal. Setelah benar ≥ 80%, naikkan jumlah atau tingkat.</li>'
    + '<li>Baca pembahasan walau jawaban benar — sering ada trik yang lebih cepat.</li>'
    + '<li>Soal salah otomatis masuk antrean ulang pada sesi berikutnya.</li></ul>'],
  ['tutor', ' Tutor & AI',
    '<h3>Cara kerja</h3><ul>'
    + '<li>Tutor hanya membahas mapel yang dipilih. Di Trading, ia membahas konsep, sesi, dan strategi — bukan sinyal.</li>'
    + '<li>Atur <b>tingkat penjelasan</b> (SD sampai Umum) dan <b>pemeriksaan jawaban</b> (teliti/cepat).</li>'
    + '<li>Tombol cepat: <b>Ringkas materi</b>, <b>Contoh soal</b>, <b>Langkah penyelesaian</b>.</li></ul>'
    + '<h3>Jika server AI belum aktif</h3><ul>'
    + '<li>Tutor tetap menjawab dari materi dan bank soal di aplikasi (badge <b>Tutor lokal</b>).</li>'
    + '<li>Jawaban essay juga dinilai secara lokal bila server tidak tersedia.</li></ul>'
    + '<div class="rb-gwarn">⚠️ AI bisa keliru. Untuk soal hitungan, periksa langkahnya; untuk fakta, cek sumber yang ditampilkan.</div>'],
  ['soal', ' Belajar Soal & pembuatan soal',
    '<p>Tab <b>Belajar Soal</b> ada di samping Tutor dan dipakai untuk mempelajari soal yang sudah kamu buat.</p>'
    + '<h3>Yang bisa dilakukan</h3><ul>'
    + '<li>Cari soal, filter tingkat dan jenis, lalu buka kartu untuk melihat kunci dan pembahasan.</li>'
    + '<li>Centang beberapa soal lalu <b>Latih terpilih</b>, atau <b>Acak 10</b> untuk sesi cepat.</li>'
    + '<li>Tombol <b>Penjelasan AI</b> membedah soal itu; <b>Tanya tutor</b> membuka tutor dengan soal sebagai konteks.</li></ul>'
    + '<h3>Buat soal dengan AI di tab ini</h3><ul>'
    + '<li>Isi topik (boleh kosong) dan jumlah soal, lalu tekan <b>Buat soal </b>.</li>'
    + '<li>Soal yang dihasilkan langsung tersimpan ke bank dan muncul di daftar.</li>'
    + '<li>Butuh <b>Generator lengkap</b>? Tombolnya ada di kanan judul kartu.</li></ul>'],
  ['bahasa', ' Bahasa',
    '<h3>English Coach & Sakura Sensei</h3><ul>'
    + '<li>Dua tutor khusus: Inggris dan Jepang. Riwayat percakapan tersimpan di perangkat.</li>'
    + '<li>Gunakan chip pertanyaan cepat atau tulis sendiri; Enter mengirim, Shift+Enter membuat baris baru.</li></ul>'
    + '<h3>Materi</h3><ul>'
    + '<li><b>Kosakata</b>: cari kata, filter kategori, dengar pelafalan, dan simpan favorit.</li>'
    + '<li><b>Verb</b>: V1–V2–V3, contoh kalimat, dan audio.</li>'
    + '<li><b>Flashcard</b> dan kuis untuk mengulang kata lemah.</li>'
    + '<li><b>Jepang</b>: hiragana, katakana, kanji N5–N4, kosakata, dan pola kalimat.</li></ul>'
    + '<div class="rb-gtip"> Progres bahasa disimpan di perangkat ini, bukan di server. Reset lewat pengaturan di halaman progres.</div>'],
  ['trading', ' Trading & Alchemist',
    '<h3>Tab Trading</h3><ul>'
    + '<li><b>News</b> — kalender dan analisis berita; ringkasan bisa disalin.</li>'
    + '<li><b>Signal Entry</b> — sinyal XAUUSD real-time (SL 30 pip, TP 1:2) dari candle M15 + konfirmasi M5/M1, H1/D1, DXY, yield, spot emas, dan kalender; entry MARKET atau LIMIT di POI; chart TradingView gratis.</li>'
    + '<li><b>Alchemist</b> — kurikulum lengkap dari pemula sampai mahir.</li>'
    + '<li><b>Tutor</b> — tanya konsep, model entry, atau manajemen risiko.</li>'
    + '<li><b>Jurnal</b> — catatan trade dan kalkulator lot.</li></ul>'
    + '<h3>Urutan belajar Alchemist</h3><ol>'
    + '<li><b>Pemula</b>: Mulai → Dasar pasar → Roadmap → Istilah → Storyline → Level.</li>'
    + '<li><b>Analisa</b>: Top-down → Sesi → Playbook entry → Studi kasus.</li>'
    + '<li><b>Eksekusi</b>: Manajemen posisi → Risiko → Kalkulator → Checklist.</li>'
    + '<li><b>Mahir</b>: Psikologi → Backtest → Rencana trading.</li>'
    + '<li><b>Uji</b>: kuis untuk memastikan pemahaman.</li></ol>'
    + '<div class="rb-gwarn">⚠️ Semua materi trading adalah edukasi, bukan sinyal atau saran finansial. Uji di akun demo dan batasi risiko.</div>'],
  ['menu', ' Menu, tema, dan akun',
    '<ul>'
    + '<li>Tombol <b>Menu</b> ada di <b>kanan atas</b>. Isinya hanya: mode <b>Terang/Gelap</b>, <b>Panduan</b>, dan <b>Keluar dari akun</b>.</li>'
    + '<li>Tidak ada lagi tombol <b>Keluar</b> di samping Menu dan tidak ada navigasi lain di dalam menu.</li>'
    + '<li><b>Terang/Gelap</b> langsung berubah dan diingat di perangkat ini.</li>'
    + '<li><b>Keluar dari akun</b> hanya mengakhiri sesi. Soal, riwayat, dan catatan tetap tersimpan di akun.</li>'
    + '<li>Tekan <b>Esc</b> atau area gelap untuk menutup menu/panduan.</li></ul>'],
  ['data', ' Data & privasi',
    '<ul>'
    + '<li>Soal, hasil latihan, peringkat, catatan, dan riwayat chat disimpan di Firestore pada akunmu sendiri.</li>'
    + '<li>Progres bahasa dan tema disimpan di perangkat (localStorage).</li>'
    + '<li>Jangan memakai akun bersama: data latihan dan peringkat akan tercampur.</li>'
    + '<li>Peringkat hanya menampilkan nama dan poin, bukan jawaban atau catatanmu.</li></ul>'],
  ['masalah', ' Jika ada masalah',
    '<h3>AI lambat atau gagal</h3><ul><li>Coba lagi; server punya batas waktu. Tanpa konfigurasi server, tutor lokal tetap aktif.</li>'
    + '<li>Jika jawaban terasa aneh, minta tutor menjelaskan ulang atau gunakan tombol langkah penyelesaian.</li></ul>'
    + '<h3>Soal tidak muncul</h3><ul><li>Periksa pelajaran, kategori, dan filter tingkat/jenis. Soal lama dengan nama pelajaran berbeda tidak terbaca.</li></ul>'
    + '<h3>Peringkat kosong atau salah kategori</h3><ul><li>Jawab minimal satu latihan. Data lama akan dirapikan otomatis saat peringkat dibuka.</li></ul>'
    + '<h3>Login gagal</h3><ul><li>Izinkan popup Google, lalu ulangi. Bila akun belum disetujui, hubungi admin.</li></ul>'
    + '<h3>Tampilan sempit</h3><ul><li>Pastikan zoom browser 100%. Tombol Menu tetap tersedia di semua ukuran layar.</li></ul>']
];

document.body.insertAdjacentHTML('beforeend',
  '<div id="rbGuide" class="rb-guide" role="dialog" aria-modal="true" aria-label="Panduan pemakaian">'
  + '<div class="rb-gbar"><b> Panduan pemakaian</b><button type="button" class="x" onclick="rbGuide(false)">Tutup</button></div>'
  + '<div class="rb-gwrap"><div class="rb-gtoc" id="rbGtoc"></div><div class="rb-gbody" id="rbGbody"></div></div>'
  + '</div>');

(function () {
  var toc = document.getElementById('rbGtoc'), body = document.getElementById('rbGbody');
  if (!toc || !body) return;
  toc.innerHTML = RB_GUIDE.map(function (s, i) {
    return '<button type="button" onclick="rbGuideTo(\'g-' + s[0] + '\')">' + s[1] + '</button>';
  }).join('');
  body.innerHTML = RB_GUIDE.map(function (s) {
    return '<section id="g-' + s[0] + '"><h2>' + s[1] + '</h2>' + s[2] + '</section>';
  }).join('');
})();

/* ---------- state & helper ---------- */
var rbDrawerOpen = false, rbGuideOpen = false;

function rbLockScroll() {
  document.documentElement.style.overflow = (rbDrawerOpen || rbGuideOpen) ? 'hidden' : '';
}
function rbAcctHtml() {
  var u = (typeof user !== 'undefined') ? user : null;
  if (!u) {
    return '<div class="rb-acct"><div class="rb-av"></div><div><div class="nm">Belum masuk</div><div class="em">Masuk untuk menyimpan progres</div></div></div>'
      + '<button type="button" class="btn full" style="margin-top:9px" onclick="rbDrawer(false);if(typeof login===\'function\')login()"> Masuk dengan Google</button>';
  }
  var nm = u.displayName || u.email || 'Pengguna';
  var em = u.email || '';
  var esc = (typeof window.rb26Safe === 'function') ? window.rb26Safe : function (x) { return String(x == null ? '' : x); };
  return '<div class="rb-acct">'
    + (u.photoURL ? '<img src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer">' : '<div class="rb-av"></div>')
    + '<div style="min-width:0"><div class="nm">' + esc(nm) + '</div><div class="em">' + esc(em) + '</div></div></div>';
}
function rbThemeSync() {
  var t = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  var bs = document.querySelectorAll('[data-rbtheme]');
  for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-rbtheme') === t);
}
function rbThemeSet(mode) {
  var t = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('rb21_theme', t); } catch (e) { }
  var meta = document.getElementById('v22tc');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f6f7fa' : '#0b0d11');
  rbThemeSync();
  try { if (typeof sigTv === 'function' && document.getElementById('sigTV')) sigTv(); } catch (e) { }
  if (typeof v21Toast === 'function') v21Toast(t === 'light' ? 'Mode terang aktif' : 'Mode gelap aktif');
}
function rbDrawer(open) {
  var d = document.getElementById('rbDrawer'), s = document.getElementById('rbScrim'), b = document.getElementById('rbMenuBtn');
  if (!d || !s) return;
  rbDrawerOpen = !!open;
  d.classList.toggle('on', rbDrawerOpen);
  s.classList.toggle('on', rbDrawerOpen);
  d.setAttribute('aria-hidden', rbDrawerOpen ? 'false' : 'true');
  if (b) b.setAttribute('aria-expanded', rbDrawerOpen ? 'true' : 'false');
  if (rbDrawerOpen) {
    var a = document.getElementById('rbAcct');
    if (a) a.innerHTML = rbAcctHtml();
    var lo = document.getElementById('rbLogout');
    if (lo) lo.style.display = (typeof user !== 'undefined' && user) ? '' : 'none';
    rbThemeSync();
  }
  rbLockScroll();
}
function rbGuide(open) {
  var g = document.getElementById('rbGuide');
  if (!g) return;
  rbGuideOpen = !!open;
  g.classList.toggle('on', rbGuideOpen);
  if (rbGuideOpen) {
    rbDrawer(false);
    g.scrollTop = 0;
  }
  rbLockScroll();
}
function rbGuideTo(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function rbGo(where) {
  rbDrawer(false);
  try {
    if (where === 'alchemist') {
      if (typeof rb26OpenAlch === 'function') { rb26OpenAlch(); return; }
      where = 'trading';
    }
    if (where === 'beranda') {
      if (typeof v21Home === 'function') { v21Home(); return; }
    }
    if (typeof setSec === 'function') setSec(where);
  } catch (e) { }
}
function rbLogout() {
  if (!confirm('Keluar dari akun? Data tetap tersimpan dan bisa dibuka lagi setelah masuk.')) return;
  rbDrawer(false);
  try { if (typeof auth !== 'undefined' && auth) auth.signOut(); } catch (e) { }
}
function rbOpenGuide() { rbGuide(true); }

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (rbGuideOpen) { rbGuide(false); return; }
  if (rbDrawerOpen) rbDrawer(false);
});
rbThemeSync();

/* Navigasi utama: selalu menempel di atas, ukuran fluid untuk semua lebar HP. */
document.head.insertAdjacentHTML('beforeend', '<style id="rbNavTop">'
  + '.tabs{position:sticky;top:0;left:auto;right:auto;bottom:auto;z-index:90;display:flex;gap:4px;margin:0 0 14px;padding:6px;border:1px solid var(--line);border-top:0;border-radius:0 0 16px 16px;background:var(--nav);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 30px -26px rgba(0,0,0,.9);overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}'
  + '.tabs::-webkit-scrollbar{display:none}'
  + '.tabs button{flex:1 0 auto;min-width:0;min-height:44px;padding:8px clamp(4px,1.5vw,12px);font-size:clamp(.72rem,2.6vw,.92rem)!important;line-height:1.15;border-radius:10px}'
  + '.tabs .tb-ico{font-size:1.05em;line-height:1}'
  + '@media(max-width:640px){.tabs{padding:5px;border-radius:0 0 14px 14px}.tabs button{min-height:46px;padding:7px 5px}.stabs{top:calc(58px + env(safe-area-inset-top))}#app{scroll-margin-top:66px}}'
  + '@media(max-width:520px){.tabs .tb-ico{display:none}.tabs button{font-size:clamp(.76rem,3.5vw,1rem)!important;padding:7px 4px!important}}'
  + '@media(min-width:641px){.tabs button{min-height:44px}}'
  + '.topbar{position:static;top:auto}'
  + '.sig-tv-int.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}'
  + '</style>');

/* Emoji tab dipisah ke span agar bisa disembunyikan di HP sempit; label tetap besar. */
function rbTabIcons() {
  var tabs = document.querySelector('.tabs');
  if (!tabs) return;
  var bs = tabs.querySelectorAll('button');
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (b.querySelector('.tb-ico')) continue;
    var t = (b.textContent || '').trim(), m = t.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    var ico = false;
    var cs = Array.from ? Array.from(m[1]) : m[1].split('');
    for (var j = 0; j < cs.length; j++) if (cs[j].codePointAt(0) > 0x2100) ico = true;
    if (ico) b.innerHTML = '<span class="tb-ico" aria-hidden="true">' + m[1] + '</span> ' + m[2];
  }
}
rbTabIcons();
try {
  if (typeof MutationObserver !== 'undefined') {
    var rbTabEl = document.querySelector('.tabs');
    if (rbTabEl) new MutationObserver(rbTabIcons).observe(rbTabEl, { childList: true, subtree: true });
  }
} catch (e) { }
window.addEventListener('resize', rbTabIcons);
