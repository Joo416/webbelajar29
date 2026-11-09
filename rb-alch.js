/* ==========================================================================
   RUANG BELAJAR V28 — Strategi Alchemist lengkap (pemula → mahir)
   Melengkapi modul di rb-content.js tanpa menghapus materi lama.
   ========================================================================== */

const ALCH_LABELS = {
  mulai: ' Mulai', dasar: ' Dasar Pasar', roadmap: ' Roadmap', istilah: ' Istilah',
  story: ' Storyline', level: ' Level', topdown: ' Top-down', sesi: ' Sesi',
  entry: ' Playbook', kasus: ' Studi Kasus', posisi: ' Manajemen Posisi',
  tfmap: ' Peta Timeframe', m5: ' Konfirmasi M5', risiko: ' Risiko', kalkulator: ' Kalkulator', cek: '✅ Checklist',
  psiko: ' Psikologi', backtest: ' Backtest', rencana: ' Rencana', kuis: ' Kuis'
};
const ALCH_GROUPS = [
  { id: 'pemula', label: ' Pemula', tabs: ['mulai', 'dasar', 'roadmap', 'istilah', 'story', 'level'] },
  { id: 'analisa', label: ' Analisa', tabs: ['topdown', 'sesi', 'entry', 'kasus'] },
  { id: 'eksekusi', label: ' Eksekusi', tabs: ['tfmap', 'm5', 'posisi', 'risiko', 'kalkulator', 'cek'] },
  { id: 'mahir', label: ' Mahir', tabs: ['psiko', 'backtest', 'rencana'] },
  { id: 'uji', label: ' Uji', tabs: ['kuis'] }
];

/* ---------- tambahan istilah ---------- */
ALCH_TERMS.push(
  ['Bid / Ask', 'Harga beli & jual', 'Bid = harga yang ditawarkan pembeli; ask = harga penjual. Selisihnya spread.', 'Menentukan biaya masuk dan kualitas eksekusi.'],
  ['Pip', 'Satuan gerak harga', 'Pip adalah satuan pergerakan harga. EURUSD 1 pip = 0,0001; XAUUSD umumnya 0,1.', 'Dipakai untuk menghitung SL, TP, dan ukuran lot.'],
  ['Point', 'Pip kecil', 'Pada banyak broker 1 pip = 10 point (digit tambahan).', 'Cek spesifikasi broker sebelum menghitung.'],
  ['Lot', 'Ukuran kontrak', '1 lot standar = 100.000 unit mata uang; emas 100 oz; mini 0,1; micro 0,01.', 'Menentukan nilai per pip dan risiko.'],
  ['Leverage', 'Daya ungkit', 'Rasio posisi terhadap margin yang disetor, mis. 1:100.', 'Memperbesar untung sekaligus rugi; bukan izin risiko besar.'],
  ['Margin', 'Jaminan posisi', 'Dana yang dikunci broker untuk membuka posisi.', 'Margin habis = margin call, bukan stop loss.'],
  ['Margin call', 'Peringatan ekuitas', 'Broker menutup posisi paksa saat ekuitas tidak cukup.', 'Hindari dengan lot kecil dan stop loss.'],
  ['Swap', 'Bunga inap', 'Biaya atau kredit karena posisi menginap.', 'Penting untuk swing trading, bukan intraday.'],
  ['Market order', 'Order pasar', 'Eksekusi langsung pada harga terbaik saat itu.', 'Cepat, tetapi bisa slippage.'],
  ['Limit order', 'Order batas', 'Eksekusi hanya pada harga yang diminta atau lebih baik.', 'Cocok untuk entry di POI.'],
  ['Stop order', 'Order henti', 'Aktif setelah harga melewati level tertentu.', 'Dipakai untuk breakout, bukan retest.'],
  ['Trailing stop', 'Stop bergerak', 'Stop mengikuti harga saat posisi untung.', 'Mengunci profit, tetapi bisa keluar terlalu cepat.'],
  ['Partial close', 'Tutup sebagian', 'Menutup sebagian posisi di target antara.', 'Menurunkan tekanan psikologis.'],
  ['Break even (BE)', 'Stop di titik entry', 'Memindahkan stop ke harga masuk setelah untung.', 'Menghilangkan risiko, tetapi mengurangi ruang napas.'],
  ['Time stop', 'Batas waktu', 'Menutup posisi bila setup tidak bergerak dalam waktu tertentu.', 'Mencegah modal tertahan di ide yang salah.'],
  ['Position sizing', 'Ukuran posisi', 'Menghitung lot dari risiko, bukan dari keinginan untung.', 'Inti bertahan hidup di pasar.'],
  ['Premium / Discount', 'Mahal / murah', 'Harga di atas 50% range = premium; di bawah = discount.', 'Beli di discount, jual di premium dalam trend.'],
  ['PD array', 'Kumpulan zona', 'Order block, FVG, breaker, mitigation, dan likuiditas.', 'Kosakata untuk memilih POI.'],
  ['Inducement', 'Jebakan likuiditas', 'Level kecil yang memancing entry sebelum level utama diuji.', 'Jangan entry sebelum inducement disapu.'],
  ['Displacement', 'Impuls kuat', 'Pergerakan cepat dengan body besar yang meninggalkan FVG.', 'Bukti niat institusional, bukan sekadar koreksi.'],
  ['Liquidity void', 'Kekosongan likuiditas', 'Area yang dilewati terlalu cepat sehingga tipis transaksi.', 'Harga sering kembali mengisi area ini.'],
  ['Breaker block', 'Blok gagal', 'Order block yang gagal lalu dipakai dari arah berlawanan.', 'Zona entry setelah struktur berubah.'],
  ['Mitigation block', 'Blok mitigasi', 'Zona tempat institusi menutup posisi lama.', 'Sering menjadi tempat retest sebelum lanjut.'],
  ['Equal highs / lows', 'High/low sejajar', 'Dua high atau low hampir sama; menyimpan stop trader.', 'Target sapuan likuiditas yang jelas.'],
  ['Asian range', 'Range Asia', 'Range yang terbentuk pada sesi Tokyo.', 'Acuan klasik untuk sapuan sesi London.'],
  ['Judas swing', 'Gerakan palsu awal', 'Gerakan awal sesi yang menjebak sebelum arah sebenarnya.', 'Sering menyapu range Asia lalu berbalik.'],
  ['SMT divergence', 'Divergensi antar pasar', 'Satu pair membuat high baru, pair berkorelasi tidak.', 'Petunjuk kelemahan gerakan.'],
  ['DXY', 'Indeks dolar', 'Indeks kekuatan USD terhadap sekeranjang mata uang.', 'Konteks makro untuk pair USD dan emas.'],
  ['Korelasi', 'Hubungan pair', 'Dua instrumen bergerak searah atau berlawanan.', 'Jangan menumpuk risiko pada posisi yang sama arahnya.'],
  ['Profit factor', 'Rasio untung/rugi', 'Total untung dibagi total rugi.', 'Di atas 1,3 mulai sehat untuk sistem sederhana.'],
  ['Risk of ruin', 'Risiko bangkrut', 'Peluang kehilangan modal karena ukuran risiko terlalu besar.', 'Turun drastis dengan risiko 1% per trade.'],
  ['Win rate', 'Persentase menang', 'Jumlah trade menang dibagi total trade.', 'Tidak berarti tanpa RR dan expectancy.'],
  ['Over-trading', 'Terlalu banyak entry', 'Membuka posisi melebihi rencana karena bosan atau balas dendam.', 'Musuh utama konsistensi.'],
  ['FOMO', 'Takut ketinggalan', 'Entry setelah harga bergerak jauh karena takut kehilangan momen.', 'Entry menjadi jauh dari invalidasi.'],
  ['Slippage', 'Selisih eksekusi', 'Harga eksekusi berbeda dari harga yang diminta.', 'Membesar saat berita dan pasar tipis.']
);

/* ---------- istilah lanjutan + timeframe pemakaian (V31) ---------- */
ALCH_TERMS.push(
  ['Turtle soup', 'Sapuan stop', 'Sapuan high/low lama lalu harga balik cepat; jebakan breakout.', 'Entry reversal setelah sweep + MSS M5.', 'M15 · M5'],
  ['Power of Three', 'AMD', 'Accumulation–Manipulation–Distribution: range harian, lalu sapuan, lalu distribusi.', 'Menentukan kapan sweep harian biasanya terjadi.', 'D1 · H4 · M15'],
  ['IPDA', 'Interbank Price Delivery Algorithm', 'Kerangka pengiriman harga antarbank dengan siklus 20/40/60 hari untuk likuiditas.', 'Menentukan target waktu dan draw on liquidity.', 'MN · W1 · D1'],
  ['Draw on liquidity', 'DOL', 'Level likuiditas yang sedang dituju harga.', 'Menentukan arah storyline dan TPmax.', 'D1 · H4'],
  ['Dealing range', 'Range kerja', 'Range swing terakhir antara high dan low yang relevan.', 'Membagi premium/discount untuk memilih POI.', 'H4 · H1'],
  ['Premium / discount', 'PD', 'Harga di atas 50% dealing range = premium; di bawah = discount.', 'Beli di discount, jual di premium saat trend.', 'H4 · H1 · M15'],
  ['PD array', 'Kumpulan zona', 'Order block, FVG, breaker, mitigation, dan liquidity void.', 'Memilih POI yang paling logis, bukan semua zona.', 'H1 · M15 · M5'],
  ['Break of Structure', 'BOS', 'Penembusan struktur searah tren.', 'Konfirmasi tren berlanjut, bukan reversal.', 'M15 · M5'],
  ['Market Structure Shift', 'MSS', 'Penembusan struktur melawan tren yang disertai displacement.', 'Pemicu entry utama setelah sapuan likuiditas.', 'M15 · M5'],
  ['Change of Character', 'CHoCH', 'Sinyal awal perubahan karakter tren sebelum MSS penuh.', 'Peringatan dini; butuh konfirmasi displacement.', 'M15 · M5'],
  ['Displacement', 'Impuls', 'Candle body besar di atas ATR yang meninggalkan imbalance.', 'Bukti niat institusional; syarat FVG valid.', 'M5 · M15'],
  ['Fair Value Gap', 'FVG', 'Celah tiga candle akibat displacement yang belum diisi.', 'Zona entry di 50% (consequent encroachment).', 'M5 · M15'],
  ['Consequent encroachment', 'CE 50%', 'Titik tengah FVG yang sering menjadi lokasi entry presisi.', 'Limit entry dengan stop lebih ketat.', 'M5'],
  ['Order block', 'OB', 'Candle berlawanan terakhir sebelum pergerakan impulsif.', 'Zona retest institusional untuk entry.', 'H1 · M15 · M5'],
  ['Breaker block', 'BB', 'Order block yang gagal lalu dipakai dari arah berlawanan.', 'Zona entry setelah struktur berubah.', 'H1 · M15'],
  ['Mitigation block', 'MB', 'Zona tempat posisi lama ditutup sebelum harga lanjut.', 'Retest sebelum melanjutkan tren.', 'H1 · M15'],
  ['Liquidity void', 'LV', 'Area yang dilewati terlalu cepat sehingga tipis transaksi.', 'Target rebalance atau TP antara.', 'M15 · M5'],
  ['Equal highs / lows', 'EQH / EQL', 'Dua high atau low hampir sama tempat stop trader berkumpul.', 'Target sapuan sebelum entry.', 'H1 · M15'],
  ['Optimal Trade Entry', 'OTE', 'Zona retracement 62–79% dari impuls terakhir.', 'Entry lanjutan dengan RR besar.', 'M15 · M5'],
  ['Killzone', 'Jam aktif', 'Jendela likuiditas tinggi: London 07–10 UTC, New York 12–15 UTC.', 'Waktu terbaik untuk eksekusi.', 'M15 · M5 (jam)'],
  ['Silver bullet', 'SB', 'Jendela 10–11 dan 14–15 UTC dengan setup FVG di M5.', 'Model intraday populer di kalangan trader ICT.', 'M5'],
  ['Judas swing', 'Sapuan sesi', 'Gerakan palsu awal sesi yang menyapu range Asia lalu berbalik.', 'Entry reversal setelah sapuan.', 'M15 · M5'],
  ['SMT divergence', 'Divergensi', 'Emas dan DXY/yield tidak saling mengonfirmasi ekstrem baru.', 'Petunjuk kelemahan gerakan.', 'M15 · H1'],
  ['Real yield', 'Yield riil', 'Yield nominal dikurangi inflasi; lawan utama harga emas.', 'Konteks makro XAUUSD.', 'D1 · W1'],
  ['DXY', 'Indeks dolar', 'Kekuatan USD terhadap sekeranjang mata uang utama.', 'Korelasi terbalik dengan emas.', 'H1 · D1'],
  ['COT report', 'Posisi spekulan', 'Laporan CFTC posisi managed money pada emas.', 'Konteks mingguan, bukan sinyal timing.', 'W1'],
  ['News blackout', 'Zona larangan berita', 'Tidak entry 30 menit sebelum/sesudah rilis High impact.', 'Melindungi dari spread melebar dan slippage.', 'Kalender (semua TF)'],
  ['Risk of ruin', 'Risiko bangkrut', 'Peluang kehilangan modal karena risiko per trade terlalu besar.', 'Dasar batas risiko 0,5–1% per trade.', 'Manajemen (semua TF)'],
  ['TP ladder', 'TP berjenjang', 'TP1/TP2/TPmax dengan partial dan runner.', 'Mengunci profit tanpa memotong tren.', 'Eksekusi (semua TF)'],
  ['Backtest sample', 'Sampel uji', 'Minimal 100 trade satu model agar statistik valid.', 'Membuktikan edge sebelum uang riil.', 'Manajemen (semua TF)'],
  ['Session liquidity', 'Likuiditas sesi', 'Volume berbeda tiap sesi: Asia tipis, London/New York tebal.', 'Menentukan besar target yang realistis.', 'M15 · M5 (jam)'],
  ['Multi-timeframe alignment', 'Konfluensi TF', 'Semua timeframe menunjuk arah dan zona yang sama.', 'Filter agar hanya mengambil setup A+.', 'D1 · H4 · H1 · M15 · M5']
);

/* ---------- tambahan model entry ---------- */
ALCH_MODELS.push(
  {
    name: '6. OCL retest (MSNR murni)',
    ctx: 'Level close–open yang fresh diuji ulang searah storyline, tanpa perlu pola tambahan.',
    cond: ['Level OCL fresh dan searah storyline HTF.', 'Sentuhan pertama atau kedua, bukan ketiga yang lelah.', 'Ada reaksi jelas: close kembali menjauh dari band.'],
    entry: 'Setelah candle menyentuh band lalu close kembali ke arah storyline.',
    sl: 'Di luar tepi jauh band + buffer ATR.',
    tp: 'OCL berikutnya atau external liquidity.',
    inval: 'Close melewati tepi jauh band selama dua candle.'
  },
  {
    name: '7. FVG continuation',
    ctx: 'Trend sudah berjalan, harga kembali mengisi imbalance sebelum lanjut.',
    cond: ['Ada displacement yang meninggalkan FVG.', 'Struktur masih searah (BOS terakhir searah).', 'FVG belum pernah diisi.'],
    entry: 'Limit di 50% FVG atau tepi pertama saat harga masuk.',
    sl: 'Di luar FVG dan swing pelindung.',
    tp: 'High/low terakhir, lalu external liquidity.',
    inval: 'FVG ditembus close dan struktur entry berubah.'
  },
  {
    name: '8. Order block mitigation',
    ctx: 'Harga kembali ke order block yang menciptakan impuls terakhir.',
    cond: ['OB fresh dan berada di premium/discount yang benar.', 'Ada BOS/MSS yang mengonfirmasi arah.', 'Tidak ada roadblock tebal sebelum target.'],
    entry: 'Limit di 50% OB atau setelah reaksi pertama di tepi OB.',
    sl: 'Di luar OB dengan buffer.',
    tp: 'Likuiditas berikutnya atau level HTF.',
    inval: 'OB ditembus close tanpa reaksi.'
  },
  {
    name: '9. Engulfing reversal di SBR/RBS',
    ctx: 'Level role-flip diuji, lalu candle engulfing menolak level tersebut.',
    cond: ['Level SBR/RBS sudah terbentuk dari break sebelumnya.', 'Candle engulfing menutup di sisi yang benar.', 'Level masih dalam area premium/discount yang logis.'],
    entry: 'Setelah candle engulfing close, atau retest 50% candle tersebut.',
    sl: 'Di luar level role-flip.',
    tp: 'Swing berikutnya searah engulfing.',
    inval: 'Candle berikutnya menelan balik engulfing (dua kali gagal = buang).'
  },
  {
    name: '10. Sapuan range Asia (Judas swing)',
    ctx: 'Sesi London menyapu high/low range Asia lalu berbalik dengan MSS.',
    cond: ['Range Asia sudah terbentuk dan jelas.', 'Salah satu sisi disapu pada pembukaan London.', 'MSS di M15/M5 setelah sapuan.', 'Ada FVG/OB dari impuls balik.'],
    entry: 'Entry di FVG/OB setelah MSS, bukan di titik sapuan.',
    sl: 'Di luar ekstrem sapuan.',
    tp: 'Sisi berlawanan range Asia, lalu level HTF.',
    inval: 'Harga bertahan di luar range dan membuat struktur baru searah sapuan.'
  }
);

/* ---------- model konfirmasi M5 (V31) ---------- */
ALCH_MODELS.push({
  name: '11. M5 sweep → MSS → FVG/OB (konfirmasi baku)',
  ctx: 'Model konfirmasi entry yang paling banyak dipakai trader profesional: likuiditas disapu di M5, struktur berubah, lalu harga kembali ke FVG 50% atau order block.',
  cond: ['Level H4/H1 sudah ditandai dan storyline searah.', 'Sapuan high/low jelas di M5 dengan close kembali ke dalam range.', 'MSS/CHoCH M5 terkonfirmasi dan ada displacement (body di atas ATR M5).', 'FVG/OB dari impuls konfirmasi belum terisi.'],
  entry: 'Limit di 50% FVG atau tepi OB setelah candle konfirmasi close. Market hanya bila harga sudah menyentuh zona dan ditolak.',
  sl: 'Di luar swing pelindung atau ekstrem sapuan ditambah buffer ATR; minimal 30 pip pada XAUUSD.',
  tp: 'TP1 minimal 100 pip (partial), TP2 minimal 200 pip, TPmax ke sisi berlawanan range atau high/low 20 hari.',
  inval: 'FVG ditembus close, MSS gagal, atau harga membuat ekstrem baru searah sapuan.'
});

/* ---------- tambahan kuis ---------- */
ALCH_QUIZ.push(
  { q: 'Nilai 1 pip EURUSD untuk 1 lot standar adalah …', o: ['$0,10', '$1', '$10', '$100'], a: 2, e: '1 lot standar = 100.000 unit. 0,0001 × 100.000 = $10 per pip.', lv: 'Pemula' },
  { q: 'Risiko $10 dengan stop 20 pip pada EURUSD (1 lot = $10/pip) berarti lot maksimal …', o: ['0,05 lot', '0,5 lot', '1 lot', '5 lot'], a: 0, e: 'Lot = risiko ÷ (pip × nilai pip per lot) = 10 ÷ (20 × 10) = 0,05 lot.', lv: 'Pemula' },
  { q: 'Dalam trend naik, area beli yang lebih logis adalah …', o: ['Premium (atas range)', 'Discount (bawah range)', 'Tepat di high', 'Di luar range'], a: 1, e: 'Beli di discount memberi stop lebih dekat dan RR lebih besar.', lv: 'Menengah' },
  { q: 'BOS berbeda dari MSS karena …', o: ['BOS selalu reversal', 'BOS melanjutkan struktur searah tren', 'BOS hanya terjadi di M1', 'BOS tidak butuh close'], a: 1, e: 'Break of Structure meneruskan tren; Market Structure Shift menandakan perubahan arah.', lv: 'Menengah' },
  { q: 'Inducement sebaiknya …', o: ['Diabaikan sepenuhnya', 'Disapu dulu sebelum entry di level utama', 'Dijadikan target utama', 'Dipakai sebagai stop loss'], a: 1, e: 'Inducement adalah likuiditas jebakan; menunggu disapu membuat entry di level utama lebih aman.', lv: 'Menengah' },
  { q: 'Time stop berarti …', o: ['Stop loss dipindah mengikuti waktu', 'Menutup posisi bila setup tidak bergerak dalam batas waktu', 'Menunggu berita', 'Menambah lot tiap jam'], a: 1, e: 'Time stop membebaskan modal dari ide yang tidak bekerja.', lv: 'Mahir' },
  { q: 'Profit factor 1,5 artinya …', o: ['Win rate 150%', 'Total untung 1,5× total rugi', 'Risiko 1,5% per trade', 'RR 1:1,5'], a: 1, e: 'Profit factor = total untung ÷ total rugi.', lv: 'Mahir' },
  { q: 'Expectancy positif berarti …', o: ['Pasti untung setiap trade', 'Rata-rata hasil per trade positif dalam sampel cukup', 'Tidak pernah kena stop', 'Win rate di atas 90%'], a: 1, e: 'Expectancy mengukur rata-rata hasil per trade, bukan kepastian tiap trade.', lv: 'Mahir' },
  { q: 'Menambah lot setelah rugi (martingale) berbahaya karena …', o: ['Spread mengecil', 'Risiko tumbuh eksponensial dan satu rugi bisa menghapus banyak profit', 'Tidak bisa ditutup', 'Selalu melanggar hukum'], a: 1, e: 'Ukuran posisi yang tumbuh setelah rugi mempercepat drawdown besar.', lv: 'Eksekusi' },
  { q: 'Sebelum entry di FVG, syarat paling penting adalah …', o: ['FVG terlihat besar', 'Ada displacement dan struktur searah', 'FVG berada di tengah chart', 'Sudah ada tiga candle'], a: 1, e: 'FVG tanpa displacement dan struktur hanyalah celah biasa.', lv: 'Menengah' }
);

/* ---------- roadmap 8 minggu ---------- */
const ALCH_ROADMAP = [
  { w: 'Minggu 1', lv: 'Pemula', t: 'Bahasa pasar', f: 'Pair, pip, lot, leverage, spread, order type, dan cara membaca candle.', d: 'Buka 3 chart, tulis spesifikasi kontrak dan nilai pip tiap instrumen.', p: 'Satu halaman catatan istilah + screenshot chart beranotasi.' },
  { w: 'Minggu 2', lv: 'Pemula', t: 'Level MSNR', f: 'Close–open level, band, fresh/unfresh, SBR/RBS, roadblock.', d: 'Tandai 20 level D1 pada satu pair, beri label F/U/RB.', p: '20 level benar tanpa melihat kunci.' },
  { w: 'Minggu 3', lv: 'Menengah', t: 'Storyline & top-down', f: 'MN/W/D1 → H4 → H1 → M15. Rejection, breakout, roadblock.', d: 'Tulis storyline satu kalimat untuk 10 chart historis.', p: '10 storyline dengan alasannya.' },
  { w: 'Minggu 4', lv: 'Menengah', t: 'POI & entry', f: 'OCL, FVG, OB, QML; memilih satu model dan entry di POI.', d: 'Backtest 20 trade dengan satu model saja.', p: 'Jurnal 20 trade + RR rata-rata.' },
  { w: 'Minggu 5', lv: 'Menengah', t: 'Manajemen posisi', f: 'Partial, BE, trailing, time stop, korelasi.', d: 'Ulangi 20 trade dengan aturan partial 50% di 1R.', p: 'Perbandingan hasil dengan/tanpa partial.' },
  { w: 'Minggu 6', lv: 'Mahir', t: 'Risiko & psikologi', f: 'Position sizing, batas harian, tilt, revenge trading.', d: 'Tetapkan aturan keras dan jalankan 1 minggu di demo.', p: 'Tidak ada pelanggaran aturan selama 5 hari.' },
  { w: 'Minggu 7', lv: 'Mahir', t: 'Backtest 100 trade', f: 'Win rate, expectancy, profit factor, max drawdown.', d: 'Kumpulkan 100 trade dengan satu model dan satu sesi.', p: 'Statistik lengkap + kurva ekuitas.' },
  { w: 'Minggu 8', lv: 'Mahir', t: 'Rencana & evaluasi', f: 'Trading plan tertulis, review mingguan, perbaikan proses.', d: 'Tulis rencana final dan review 10 trade terakhir.', p: 'Rencana siap dijalankan + daftar 3 perbaikan.' }
];

/* ---------- helper ---------- */
function alCard(title, body) { return '<div class="card"><h3>' + title + '</h3>' + body + '</div>'; }
function alList(items) { return '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
function alSteps(items) { return '<div class="rb-flow" style="margin-top:10px">' + items.map(function (x) { return '<div class="rb-step"><b>' + x[0] + '</b>' + x[1] + '</div>'; }).join('') + '</div>'; }

/* ---------- modul baru ---------- */
function alDasarHtml() {
  return alCard(' Dasar pasar yang wajib dipahami',
    '<div class="rb-note">Sebelum belajar entry, pahami dulu apa yang sebenarnya kamu beli dan jual. Sebagian besar kerugian pemula berasal dari salah ukuran posisi, bukan salah arah.</div>'
    + alSteps([
      ['Pair & quote', 'EURUSD berarti nilai EUR diukur dalam USD. XAUUSD adalah emas terhadap USD. Base = yang diperdagangkan, quote = mata uang pembanding.'],
      ['Long / short', 'Long untung saat harga naik; short untung saat harga turun. Di forex kamu selalu membeli satu mata uang dan menjual yang lain.'],
      ['Pip & point', 'Pip adalah satuan gerak. EURUSD 0,0001; USDJPY 0,01; XAUUSD umumnya 0,1. Point bisa 1/10 pip tergantung broker.'],
      ['Lot & nilai pip', '1 lot standar EURUSD = 100.000 unit → ±$10 per pip. Emas 1 lot = 100 oz → ±$10 per 0,1 gerak.'],
      ['Leverage & margin', 'Leverage memperbesar daya beli, margin adalah jaminan. Leverage tinggi tidak menambah edge, hanya mempercepat kerugian bila lot salah.']
    ])
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>Istilah</th><th>Arti singkat</th><th>Pengaruh ke trade</th></tr></thead><tbody>'
    + '<tr><td><b>Spread</b></td><td>Selisih bid–ask</td><td>Biaya langsung; RR mengecil.</td></tr>'
    + '<tr><td><b>Komisi</b></td><td>Biaya broker per lot</td><td>Hitung ke biaya per trade.</td></tr>'
    + '<tr><td><b>Swap</b></td><td>Bunga inap</td><td>Relevan untuk posisi berhari-hari.</td></tr>'
    + '<tr><td><b>Slippage</b></td><td>Selisih harga eksekusi</td><td>Membesar saat berita.</td></tr>'
    + '<tr><td><b>Margin call</b></td><td>Ekuitas tidak cukup</td><td>Posisi ditutup paksa; hindari dengan stop.</td></tr>'
    + '<tr><td><b>Order</b></td><td>Market, limit, stop</td><td>Menentukan cara masuk dan kualitas harga.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout"><b>Contoh hitung cepat:</b> saldo $1.000, risiko 1% = $10. Stop 20 pip EURUSD. Lot = 10 ÷ (20 × 10) = 0,05 lot. Bukan 0,5 lot.</div>'
    + '<div class="rb-callout warn"><b>Aturan pemula:</b> demo minimal 30 hari, maksimal 1% risiko per trade, dan satu model entry saja sampai konsisten.</div>'
    + '<button class="btn alt full" type="button" onclick="alSet(\'kalkulator\')">🧮 Buka kalkulator risiko</button>');
}

function alRoadmapHtml() {
  return alCard(' Roadmap 8 minggu: pemula → mahir',
    '<div class="rb-note">Ikuti berurutan. Jangan lompat ke strategi mahir sebelum 20 trade satu model tercatat di jurnal. Setiap minggu punya bukti belajar yang bisa diperiksa.</div>'
    + '<div class="rb-accordion">' + ALCH_ROADMAP.map(function (r, i) {
      return '<details' + (i === 0 ? ' open' : '') + '><summary>' + r.w + ' · ' + r.t + ' <span class="rb-pill" style="margin-left:6px">' + r.lv + '</span></summary>'
        + '<div class="rb-acc-body"><div class="small"><b>Fokus:</b> ' + r.f + '</div>'
        + '<div class="small" style="margin-top:6px"><b>Latihan:</b> ' + r.d + '</div>'
        + '<div class="small" style="margin-top:6px"><b>Bukti lulus:</b> ' + r.p + '</div></div></details>';
    }).join('') + '</div>'
    + '<div class="rb-callout ok"><b>Aturan naik level:</b> 50 trade demo dengan satu model, expectancy positif, dan max drawdown di bawah 10%. Bila belum, ulangi minggu yang sama.</div>');
}

function alTopdownHtml() {
  return alCard(' Analisis top-down (kerangka kerja harian)',
    '<div class="rb-note">Alchemist selalu dari besar ke kecil. Arah dari HTF, level dari H4/H1, pemicu dari M15/M5. Jangan pernah entry hanya karena TF kecil terlihat bagus.</div>'
    + alSteps([
      ['1. Konteks MN/W', 'Tren besar atau range? Di mana harga terhadap range tahunan? Ini menentukan apakah layak mencari buy atau sell.'],
      ['2. Storyline D1', 'Cari rejection di level HTF, lalu breakout internal/external. Tulis satu kalimat: "D1 bullish karena …".'],
      ['3. Level H4/H1', 'Tandai OCL, SBR/RBS, roadblock, dan zona premium/discount. Pilih 2–3 level yang paling fresh.'],
      ['4. POI H1', 'Pilih satu POI: FVG, OB, QML, atau level OCL. Tandai batas atas–bawahnya, bukan satu garis.'],
      ['5. Pemicu M15/M5', 'Tunggu sweep likuiditas + MSS/CHoCH + displacement. Tanpa ini, POI hanya area, bukan entry.'],
      ['6. Eksekusi', 'Entry di POI, stop di luar struktur, target likuiditas berikutnya. Catat RR sebelum menekan tombol.']
    ])
    + '<div class="rb-callout"><b>Premium & discount:</b> ambil range swing terakhir. Di atas 50% = premium (mahal untuk buy), di bawah 50% = discount (murah untuk buy). Trend naik: beli di discount. Trend turun: jual di premium.</div>'
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>Yang terlihat</th><th>Keputusan</th></tr></thead><tbody>'
    + '<tr><td>D1 bullish, harga di discount, POI fresh</td><td>Cari buy; tunggu MSS bullish.</td></tr>'
    + '<tr><td>D1 bullish, harga di premium</td><td>Jangan buy; tunggu pullback ke discount.</td></tr>'
    + '<tr><td>D1 range, harga di tepi atas</td><td>Cari sell menuju sisi bawah, atau tunggu breakout valid.</td></tr>'
    + '<tr><td>Roadblock tebal sebelum target</td><td>Kecilkan target atau lewati setup.</td></tr>'
    + '<tr><td>Tidak ada POI fresh</td><td>Tidak ada trade. Ini keputusan yang benar.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-card-head" style="margin-top:12px"><h3 style="font-size:.94rem">Template analisis</h3><button class="x" type="button" onclick="alCopyText(alTopdownTemplate(),this)">📋 Salin</button></div>'
    + '<textarea class="rb-plan" id="alTdText" style="min-height:190px">' + rb26Safe(alTopdownTemplate()) + '</textarea>'
    + '<div class="rb-note">Salin ke jurnal sebelum entry. Bila ada kolom yang tidak bisa diisi, berarti setup belum siap.</div>');
}
function alTopdownTemplate() {
  return 'ANALISIS TOP-DOWN\n'
    + 'Tanggal / sesi   : \nPair             : \nKonteks MN/W     : \nStoryline D1     : \nRange & premium  : \nPOI H1           : \nLikuiditas target: \nPemicu M15       : \nEntry            : \nStop loss        : \nTarget           : \nRR               : \nInvalidasi       : \nAlasan entry     : ';
}

function alPosisiHtml() {
  return alCard(' Manajemen posisi setelah entry',
    '<div class="rb-note">Entry yang benar bisa menjadi rugi bila posisi dikelola buruk. Aturan di bawah harus ditulis sebelum entry, bukan diputuskan saat harga bergerak.</div>'
    + alSteps([
      ['Partial 50% di 1R', 'Ambil separuh posisi saat untung 1× risiko. Sisa posisi dibiarkan mengejar target utama.'],
      ['BE setelah 1R', 'Pindahkan stop ke entry hanya setelah harga benar-benar meninggalkan zona. Terlalu cepat = sering kena noise.'],
      ['Trailing dengan struktur', 'Geser stop ke swing terakhir atau di belakang FVG, bukan tiap candle.'],
      ['Time stop', 'Bila 60–90 menit setup tidak bergerak dan sesi mulai sepi, tutup atau kurangi posisi.'],
      ['Tidak menambah saat rugi', 'Scaling in hanya boleh saat posisi sudah untung dan struktur baru terbentuk.'],
      ['Korelasi', 'EURUSD buy + GBPUSD buy + XAUUSD buy = satu taruhan USD. Hitung total risiko gabungan.']
    ])
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>Situasi</th><th>Tindakan</th></tr></thead><tbody>'
    + '<tr><td>Harga +1R</td><td>Tutup 50%, stop sisa ke BE.</td></tr>'
    + '<tr><td>Harga +2R, ada FVG baru</td><td>Trailing stop di bawah FVG.</td></tr>'
    + '<tr><td>Harga kembali ke entry setelah partial</td><td>Stop BE kena; trade selesai, tidak revenge.</td></tr>'
    + '<tr><td>Setup diam 90 menit</td><td>Time stop; modal kembali.</td></tr>'
    + '<tr><td>Dua posisi searah USD</td><td>Kurangi lot atau pilih satu.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout warn"><b>Jangan:</b> memindahkan stop menjauh, menambah lot untuk "menyelamatkan" posisi, atau menutup profit terlalu cepat karena takut.</div>');
}

function alPsikoHtml() {
  return alCard(' Psikologi & disiplin eksekusi',
    '<div class="rb-note">Strategi yang sama bisa menghasilkan hasil berbeda tergantung siapa yang menjalankannya. Kelola diri seperti mengelola risiko.</div>'
    + '<div class="rb-scroll"><table class="rb-table"><thead><tr><th>Masalah</th><th>Tanda</th><th>Penawar</th></tr></thead><tbody>'
    + '<tr><td><b>FOMO</b></td><td>Entry setelah harga jauh bergerak</td><td>Aturan: hanya entry di POI; bila terlewat, tunggu setup berikutnya.</td></tr>'
    + '<tr><td><b>Revenge trading</b></td><td>Langsung entry setelah rugi</td><td>Wajib jeda 30 menit; maksimal 2 rugi per hari.</td></tr>'
    + '<tr><td><b>Overconfidence</b></td><td>Lot naik setelah 3 kali menang</td><td>Lot tetap dari rumus risiko, bukan dari emosi.</td></tr>'
    + '<tr><td><b>Loss aversion</b></td><td>Stop dipindah agar tidak kena</td><td>Stop ditetapkan sebelum entry dan tidak diubah.</td></tr>'
    + '<tr><td><b>Analysis paralysis</b></td><td>Terlalu banyak indikator, tidak pernah entry</td><td>Satu model, tiga level, satu keputusan.</td></tr>'
    + '<tr><td><b>Bosan</b></td><td>Entry di luar sesi karena ingin aktif</td><td>Batasi 2–3 trade per hari; lebih baik tidak trade.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout"><b>Rutinitas 10 menit:</b> 3 menit cek kalender & berita, 4 menit tandai level, 2 menit tulis rencana, 1 menit atur alarm sesi. Setelah sesi: 5 menit review dan screenshot.</div>'
    + '<div class="rb-callout warn"><b>Aturan keras:</b> stop harian −3%, maksimal 2 rugi beruntun, tidak trade saat emosi, dan tidak mengejar kerugian di hari yang sama.</div>');
}

function alBacktestHtml() {
  return alCard(' Backtest & ukur sistemmu',
    '<div class="rb-note">Backtest bukan mencari masa lalu yang sempurna, tetapi mengumpulkan bukti apakah aturanmu punya edge. Lakukan manual dulu agar mata terlatih.</div>'
    + alSteps([
      ['Pilih 1 model', 'Contoh: CRT bullish + FVG, hanya sesi London. Jangan campur 5 model.'],
      ['Tentukan sampel', '100 trade atau 3 bulan chart. Ambil pair yang sama setiap kali.'],
      ['Ikuti aturan ketat', 'Entry hanya bila checklist terpenuhi. Catat trade yang dilewati juga.'],
      ['Catat 8 kolom', 'Tanggal, pair, sesi, arah, entry, SL, TP, hasil R, dan kesalahan.'],
      ['Hitung statistik', 'Win rate, rata-rata R, expectancy, profit factor, max drawdown, losing streak.'],
      ['Perbaiki satu variabel', 'Ubah satu hal per 50 trade, lalu bandingkan. Jangan mengubah semuanya sekaligus.']
    ])
    + '<div class="rb-scroll" style="margin-top:12px"><table class="rb-table"><thead><tr><th>Metrik</th><th>Rumus</th><th>Target awal</th></tr></thead><tbody>'
    + '<tr><td>Win rate</td><td>Menang ÷ total</td><td>40–55% (dengan RR 1:2)</td></tr>'
    + '<tr><td>Rata-rata R</td><td>Total R ÷ total trade</td><td>&gt; 0,2R</td></tr>'
    + '<tr><td>Expectancy</td><td>(WR × avg win) − (LR × avg loss)</td><td>Positif</td></tr>'
    + '<tr><td>Profit factor</td><td>Total untung ÷ total rugi</td><td>&gt; 1,3</td></tr>'
    + '<tr><td>Max drawdown</td><td>Penurunan puncak ekuitas</td><td>&lt; 10%</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout ok"><b>Tantangan 30 trade:</b> satu model, satu sesi, risiko tetap. Setelah 30 trade, baru lihat statistik. Bila expectancy negatif, periksa konsistensi aturan sebelum menyalahkan strategi.</div>'
    + '<div class="rb-note">Jurnal trade tersedia di tab <b>📒 Jurnal</b>. Isi alasan entry dan kesalahan, bukan hanya hasil.</div>'
    + '<button class="btn alt full" type="button" onclick="alSet(\'rencana\')">▶️ Lanjut ke rencana trading</button>');
}

const ALC_PAIRS = {
  XAUUSD: { pip: 0.1, pv: 10, label: 'XAUUSD (emas, 1 lot = 100 oz)' },
  EURUSD: { pip: 0.0001, pv: 10, label: 'EURUSD (1 lot = 100.000)' },
  GBPUSD: { pip: 0.0001, pv: 10, label: 'GBPUSD (1 lot = 100.000)' },
  USDJPY: { pip: 0.01, pv: 6.7, label: 'USDJPY (perkiraan)' },
  BTCUSD: { pip: 1, pv: 1, label: 'BTCUSD (1 lot = 1 BTC)' },
  US30: { pip: 1, pv: 1, label: 'US30 (perkiraan)' }
};
function alCalcHtml() {
  const opts = Object.keys(ALC_PAIRS).map(function (k) { return '<option value="' + k + '">' + ALC_PAIRS[k].label + '</option>'; }).join('');
  return alCard(' Kalkulator risiko & ukuran lot',
    '<div class="rb-note">Hitung lot dari risiko yang kamu terima, bukan dari target profit. Nilai pip adalah perkiraan; cocokkan dengan spesifikasi broker sebelum eksekusi.</div>'
    + '<div class="row" style="margin-top:10px"><div><label style="margin-top:0">Saldo (USD)</label><input id="alcBal" inputmode="decimal" value="1000" oninput="alCalc()"></div>'
    + '<div><label style="margin-top:0">Risiko per trade (%)</label><input id="alcRisk" inputmode="decimal" value="1" oninput="alCalc()"></div></div>'
    + '<div style="margin-top:8px"><label style="margin-top:0">Instrumen</label><select id="alcPair" onchange="alCalc()">' + opts + '</select></div>'
    + '<div class="row" style="margin-top:8px"><div><label style="margin-top:0">Harga entry</label><input id="alcEntry" inputmode="decimal" value="2400" oninput="alCalc()"></div>'
    + '<div><label style="margin-top:0">Stop loss</label><input id="alcSL" inputmode="decimal" value="2395" oninput="alCalc()"></div></div>'
    + '<div style="margin-top:8px"><label style="margin-top:0">Target (opsional)</label><input id="alcTP" inputmode="decimal" value="2410" oninput="alCalc()"></div>'
    + '<div id="alcOut" class="rb-calc-out"></div><div id="alcWarn" class="rb-callout warn" style="display:none"></div>'
    + '<div class="rb-note" style="margin-top:10px">Rumus: <b>lot = (saldo × risiko%) ÷ (jarak SL dalam pip × nilai pip per lot)</b>. Bulatkan ke bawah sesuai langkah lot broker.</div>');
}
function alCalcNum(id) { const el = document.getElementById(id); const v = el ? parseFloat(String(el.value).replace(',', '.')) : NaN; return isFinite(v) ? v : NaN; }
function alCalc() {
  const out = document.getElementById('alcOut'), warn = document.getElementById('alcWarn');
  if (!out) return;
  const bal = alCalcNum('alcBal'), rp = alCalcNum('alcRisk');
  const entry = alCalcNum('alcEntry'), sl = alCalcNum('alcSL'), tp = alCalcNum('alcTP');
  const sel = document.getElementById('alcPair');
  const p = ALC_PAIRS[(sel && sel.value) || 'XAUUSD'] || ALC_PAIRS.XAUUSD;
  if (!(bal > 0) || !(rp > 0) || !isFinite(entry) || !isFinite(sl)) {
    out.innerHTML = '<div style="grid-column:1/-1"><span>Status</span><b style="font-size:.85rem">Isi saldo, risiko, entry, dan stop loss.</b></div>';
    if (warn) warn.style.display = 'none';
    return;
  }
  const dist = Math.abs(entry - sl);
  if (!(dist > 0)) {
    out.innerHTML = '<div style="grid-column:1/-1"><span>Status</span><b style="font-size:.85rem">Entry dan stop loss tidak boleh sama.</b></div>';
    if (warn) warn.style.display = 'none';
    return;
  }
  const riskUsd = bal * rp / 100;
  const pips = dist / p.pip;
  const raw = riskUsd / (pips * p.pv);
  const lot = Math.floor(raw * 100 + 1e-9) / 100;
  const used = lot < 0.01 ? 0.01 : lot;
  const realRisk = used * pips * p.pv;
  const rr = isFinite(tp) ? Math.abs(tp - entry) / dist : 0;
  const profit = rr > 0 ? realRisk * rr : 0;
  out.innerHTML =
    '<div><span>Risiko</span><b>$' + riskUsd.toFixed(2) + '</b></div>'
    + '<div><span>Ukuran lot</span><b>' + (lot > 0 ? lot.toFixed(2) : '0,01 (min)') + '</b></div>'
    + '<div><span>Jarak SL</span><b>' + pips.toFixed(1) + ' pip</b></div>'
    + '<div><span>Rasio RR</span><b>' + (rr > 0 ? '1 : ' + rr.toFixed(2) : '—') + '</b></div>'
    + '<div><span>Risiko aktual</span><b>$' + realRisk.toFixed(2) + '</b></div>'
    + '<div><span>Potensi profit</span><b>' + (rr > 0 ? '$' + profit.toFixed(2) : '—') + '</b></div>';
  if (warn) {
    if (lot < 0.01) {
      warn.style.display = '';
      warn.innerHTML = '<b>Lot minimum 0,01.</b> Risiko aktual $' + realRisk.toFixed(2) + ' lebih besar dari target $' + riskUsd.toFixed(2) + '. Perkecil stop atau tambah saldo, jangan paksa lot minimum.';
    } else if (realRisk > riskUsd * 1.05) {
      warn.style.display = '';
      warn.innerHTML = '<b>Risiko melebihi target.</b> Turunkan lot atau perlebar jarak stop dengan hitungan ulang.';
    } else {
      warn.style.display = 'none';
    }
  }
}

function alPlanDefault() {
  return 'RENCANA TRADING — [nama]\n'
    + '================================\n'
    + '1. Instrumen  : XAUUSD / EURUSD (pilih maksimal 2)\n'
    + '2. Sesi       : London 14.00–17.00 WIB / New York 19.00–22.00 WIB\n'
    + '3. Model      : CRT + FVG (satu model utama)\n'
    + '4. Risiko     : maksimal 1% ekuitas per trade\n'
    + '5. Batas harian: maksimal 2 trade, stop setelah -3% atau 2 rugi\n'
    + '6. Checklist  : storyline, level fresh, sweep, MSS, POI, RR >= 1:2\n'
    + '7. Manajemen  : partial 50% di 1R, sisa trailing struktur\n'
    + '8. Larangan   : tidak entry saat berita besar, tidak revenge, tidak geser stop\n'
    + '9. Review     : screenshot sebelum entry, isi jurnal, review tiap Jumat\n\n'
    + 'CATATAN MINGGU INI:\n- \n- \n';
}
function alPlanHtml() {
  let txt = '';
  try { txt = localStorage.getItem('rb_alch_plan') || ''; } catch (e) { }
  if (!txt) txt = alPlanDefault();
  return alCard(' Rencana trading & rutinitas',
    '<div class="rb-note">Rencana yang tidak ditulis hanyalah niat. Isi template ini, simpan, lalu jalankan minimal 20 trade sebelum mengubah aturan.</div>'
    + '<div class="rb-accordion"><details open><summary>Template rencana (bisa diedit)</summary><div class="rb-acc-body">'
    + '<textarea id="alPlanText" class="rb-plan" oninput="alPlanSave(this.value)">' + rb26Safe(txt) + '</textarea>'
    + '<div class="row" style="margin-top:8px"><button class="btn alt" type="button" onclick="alPlanCopy(this)">📋 Salin rencana</button><button class="btn alt" type="button" onclick="alPlanReset()">↺ Kembalikan template</button></div>'
    + '<div class="small mut" id="alPlanStat" style="margin-top:8px">Tersimpan otomatis di perangkat ini.</div>'
    + '</div></details></div>'
    + '<div class="rb-card-head" style="margin-top:10px"><h3 style="font-size:.94rem">Rutinitas harian</h3></div>'
    + '<div class="rb-scroll"><table class="rb-table"><thead><tr><th>Waktu</th><th>Aktivitas</th></tr></thead><tbody>'
    + '<tr><td>Sebelum sesi</td><td>Cek kalender berita, tandai level D1/H4, tulis bias dan invalidasi.</td></tr>'
    + '<tr><td>30 menit pertama</td><td>Amati sapuan likuiditas; jangan langsung entry.</td></tr>'
    + '<tr><td>Sesi aktif</td><td>Entry hanya bila checklist terpenuhi; maksimal 2 trade.</td></tr>'
    + '<tr><td>Setelah sesi</td><td>Catat jurnal, screenshot, nilai kepatuhan aturan (bukan hanya profit).</td></tr>'
    + '<tr><td>Jumat</td><td>Review 10 trade, cari satu perbaikan proses untuk minggu depan.</td></tr>'
    + '</tbody></table></div>'
    + '<div class="rb-callout warn"><b>Berhenti bila:</b> dua rugi beruntun, emosi tidak stabil, atau sudah mencapai batas harian. Menutup chart adalah bagian dari strategi.</div>');
}
function alPlanSave(v) {
  try { localStorage.setItem('rb_alch_plan', String(v)); } catch (e) { }
  const s = document.getElementById('alPlanStat');
  if (s) s.textContent = 'Tersimpan otomatis · ' + new Date().toLocaleTimeString('id-ID');
}
function alPlanReset() {
  if (!confirm('Kembalikan template rencana? Tulisanmu akan diganti.')) return;
  try { localStorage.removeItem('rb_alch_plan'); } catch (e) { }
  pAlchemist();
}
function alPlanCopy(btn) {
  const el = document.getElementById('alPlanText');
  if (el) alCopyText(el.value, btn);
}
function alCopyText(t, btn) {
  const done = function () {
    if (btn) { const old = btn.textContent; btn.textContent = '✅ Tersalin'; setTimeout(function () { btn.textContent = old; }, 1600); }
    else if (typeof v21Toast === 'function') v21Toast('Tersalin');
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(t)).then(done, function () { alCopyFallback(t, done); });
    } else alCopyFallback(t, done);
  } catch (e) { alCopyFallback(t, done); }
}
function alCopyFallback(t, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = String(t); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    done();
  } catch (e) { if (typeof v21Toast === 'function') v21Toast('Gagal menyalin'); }
}

/* ---------- studi kasus tambahan ---------- */
function alBearSvg() {
  return '<svg class="rb-chart" viewBox="0 0 720 340" role="img" aria-label="Skema entry bearish: range harian, sapuan high, MSS bearish, FVG, stop loss dan target">'
    + '<defs><linearGradient id="alchBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,123,138,.10)"/><stop offset="1" stop-color="rgba(255,123,138,0)"/></linearGradient></defs>'
    + '<rect x="0" y="0" width="720" height="340" fill="url(#alchBg2)"/>'
    + '<rect x="52" y="72" width="612" height="188" rx="8" fill="none" stroke="#8b9dff" stroke-opacity=".5" stroke-dasharray="6 5"/>'
    + '<text x="60" y="66" fill="#8b9dff" font-size="12" font-family="sans-serif">Range acuan — high</text>'
    + '<text x="60" y="278" fill="#8b9dff" font-size="12" font-family="sans-serif">Range acuan — low</text>'
    + '<g stroke="#4ade9d" fill="#4ade9d" stroke-width="1.2">'
    + '<line x1="96" y1="150" x2="96" y2="212"/><rect x="90" y="160" width="12" height="40" rx="2"/>'
    + '<line x1="120" y1="126" x2="120" y2="188"/><rect x="114" y="134" width="12" height="42" rx="2"/>'
    + '<line x1="144" y1="102" x2="144" y2="164"/><rect x="138" y="110" width="12" height="42" rx="2"/>'
    + '<line x1="168" y1="86" x2="168" y2="148"/><rect x="162" y="94" width="12" height="42" rx="2"/>'
    + '</g>'
    + '<line x1="192" y1="52" x2="192" y2="124" stroke="#4ade9d" stroke-width="1.4"/>'
    + '<rect x="186" y="60" width="12" height="38" rx="2" fill="#4ade9d"/>'
    + '<text x="172" y="44" fill="#4ade9d" font-size="11" font-family="sans-serif">sweep high</text>'
    + '<line x1="222" y1="70" x2="222" y2="166" stroke="#ff7b8a" stroke-width="1.4"/>'
    + '<rect x="216" y="78" width="12" height="78" rx="2" fill="#ff7b8a"/>'
    + '<text x="206" y="182" fill="#ff7b8a" font-size="11" font-family="sans-serif">MSS bearish</text>'
    + '<rect x="248" y="140" width="150" height="26" rx="4" fill="rgba(94,234,212,.16)" stroke="#5eead4" stroke-opacity=".7" stroke-dasharray="4 4"/>'
    + '<text x="254" y="157" fill="#5eead4" font-size="11" font-family="sans-serif">FVG / imbalance</text>'
    + '<g stroke="#4ade9d" fill="#4ade9d" stroke-width="1.1">'
    + '<line x1="286" y1="126" x2="286" y2="178"/><rect x="280" y="134" width="12" height="34" rx="2"/>'
    + '<line x1="310" y1="122" x2="310" y2="172"/><rect x="304" y="130" width="12" height="32" rx="2"/>'
    + '</g>'
    + '<line x1="322" y1="152" x2="640" y2="152" stroke="#8b9dff" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="576" y="146" fill="#8b9dff" font-size="11" font-family="sans-serif">entry short</text>'
    + '<line x1="322" y1="84" x2="640" y2="84" stroke="#ff7b8a" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="580" y="78" fill="#ff7b8a" font-size="11" font-family="sans-serif">stop loss</text>'
    + '<line x1="322" y1="258" x2="640" y2="258" stroke="#4ade9d" stroke-width="1.2" stroke-dasharray="5 4"/>'
    + '<text x="584" y="274" fill="#4ade9d" font-size="11" font-family="sans-serif">target</text>'
    + '<g stroke="#ff7b8a" fill="#ff7b8a" stroke-width="1.1">'
    + '<line x1="352" y1="168" x2="352" y2="224"/><rect x="346" y="176" width="12" height="38" rx="2"/>'
    + '<line x1="382" y1="188" x2="382" y2="240"/><rect x="376" y="196" width="12" height="36" rx="2"/>'
    + '<line x1="412" y1="176" x2="412" y2="232"/><rect x="406" y="184" width="12" height="40" rx="2"/>'
    + '<line x1="442" y1="200" x2="442" y2="250"/><rect x="436" y="208" width="12" height="34" rx="2"/>'
    + '<line x1="472" y1="216" x2="472" y2="262"/><rect x="466" y="224" width="12" height="30" rx="2"/>'
    + '</g>'
    + '<circle cx="322" cy="152" r="4" fill="#8b9dff"/>'
    + '<text x="52" y="328" fill="#95a3b7" font-size="11" font-family="sans-serif">Urutan: range → sapuan high → MSS bearish → entry di FVG → target low range.</text>'
    + '</svg>';
}
function alCasePick(n) { ALCH.caseN = n; pAlchemist(); }
function alCaseHtml() {
  const n = ALCH.caseN || 1;
  const pill = function (i, label) { return '<button type="button" class="x" style="' + (n === i ? 'border-color:var(--accent);color:var(--accent);background:var(--accent-soft)' : '') + '" onclick="alCasePick(' + i + ')">' + label + '</button>'; };
  const head = '<div class="card"><div class="rb-card-head"><h3>🔬 Studi kasus</h3><span class="rb-pill">Edukasi</span></div>'
    + '<div class="rb-note">Tiga skenario untuk melatih mata: satu berhasil, satu berhasil dari sisi jual, satu gagal. Perhatikan urutannya, bukan angka pastinya.</div>'
    + '<div class="rb-pill-row" style="gap:6px">' + pill(1, 'Bullish CRT') + pill(2, 'Bearish CRT') + pill(3, 'Gagal') + '</div></div>';
  if (n === 2) {
    return head + '<div class="card"><h3>Bearish: sapuan high lalu distribusi</h3>'
      + '<div class="rb-note">Skenario pada XAUUSD H1 dalam range D1. Storyline bearish setelah gagal bertahan di atas high.</div>'
      + alBearSvg()
      + alSteps([
        ['Konteks', 'D1 berada di premium range dan gagal membuat close di atas high sebelumnya.'],
        ['Sapuan', 'Harga menyapu high range, tetapi close kembali di dalam range.'],
        ['Konfirmasi', 'M15 membentuk MSS bearish dan meninggalkan FVG.'],
        ['Entry', 'Limit di FVG setelah retest; stop di atas high sapuan; target low range.']
      ])
      + '<div class="rb-callout ok"><b>Kekuatan setup:</b> sweep + MSS + FVG + target jelas, dengan stop relatif dekat.</div>'
      + '<div class="rb-callout warn"><b>Risiko:</b> berita AS dapat membalik arah; kurangi lot bila kalender padat.</div></div>';
  }
  if (n === 3) {
    return head + '<div class="card"><h3>Gagal: MSS tanpa displacement</h3>'
      + '<div class="rb-note">Contoh setup yang terlihat benar tetapi tidak layak dieksekusi. Belajar menghindari trade buruk sama pentingnya dengan menemukan trade baik.</div>'
      + alSteps([
        ['Tampilan awal', 'Harga menyapu low range, seolah siap reversal bullish.'],
        ['MSS lemah', 'Struktur berubah, tetapi candle kecil dan tanpa FVG yang jelas.'],
        ['Entry dipaksa', 'Entry di tengah range karena takut ketinggalan.'],
        ['Hasil', 'Harga kembali menyapu low, stop kena. Tidak ada kesalahan arah pasar; kesalahan ada di kualitas setup.']
      ])
      + '<div class="rb-scroll" style="margin-top:10px"><table class="rb-table"><thead><tr><th>Kesalahan</th><th>Seharusnya</th></tr></thead><tbody>'
      + '<tr><td>MSS tanpa displacement</td><td>Tunggu impuls dengan body besar dan FVG.</td></tr>'
      + '<tr><td>Entry di tengah range</td><td>Entry hanya di POI dengan invalidasi jelas.</td></tr>'
      + '<tr><td>Stop terlalu rapat</td><td>Stop di luar struktur, bukan di dalam noise.</td></tr>'
      + '<tr><td>Tidak cek berita</td><td>Lewati 30 menit sebelum/sesudah rilis besar.</td></tr>'
      + '</tbody></table></div>'
      + '<div class="rb-callout warn"><b>Pelajaran:</b> sweep bukan sinyal entry. Entry baru sah setelah struktur berubah dengan displacement dan ada POI.</div></div>';
  }
  return head + '<div class="card"><h3>Bullish: CRT + FVG</h3>'
    + '<div class="rb-note">Skenario edukasi pada XAUUSD H1. Perhatikan urutannya, bukan angka pastinya.</div>'
    + alStudyCaseSvg()
    + alSteps([
      ['Konteks', 'D1 membentuk range. Storyline belum jelas; tunggu manipulasi.'],
      ['Sapuan', 'Harga menyapu low range lalu close kembali di dalam range.'],
      ['Konfirmasi', 'M15 membentuk MSS bullish dan meninggalkan FVG.'],
      ['Entry', 'Limit di tepi FVG; stop di bawah low sapuan; target high range.']
    ])
    + '<div class="rb-callout ok"><b>Kenapa masuk akal:</b> likuiditas diambil, struktur berubah, entry dekat invalidasi sehingga RR besar.</div>'
    + '<div class="rb-callout warn"><b>Kenapa bisa gagal:</b> berita besar, FVG dilewati tanpa reaksi, atau storyline D1 ternyata bearish kuat.</div></div>';
}

/* ---------- kuis dengan ambang lulus proporsional ---------- */
function alQuizHtml() {
  const done = Object.keys(ALCH.quiz).length;
  const right = ALCH_QUIZ.filter(function (q, i) { return ALCH.quiz[i] === q.a; }).length;
  const pass = Math.ceil(ALCH_QUIZ.length * 0.75);
  return '<div class="card"><div class="rb-card-head"><h3>🧠 Kuis Alchemist</h3><span class="rb-pill">' + right + '/' + ALCH_QUIZ.length + ' benar</span></div>'
    + '<div class="rb-note">' + ALCH_QUIZ.length + ' pertanyaan dari pemula sampai mahir. Pembahasan muncul setelah memilih. Ambang lulus: ' + pass + '/' + ALCH_QUIZ.length + '.</div>'
    + '<div style="margin-top:10px">' + ALCH_QUIZ.map(function (q, i) {
      const pick = ALCH.quiz[i];
      const answered = pick != null;
      return '<div class="rb-quiz"><div style="font-weight:700;font-size:.86rem;line-height:1.5">' + (i + 1) + '. ' + rb26Safe(q.q) + (q.lv ? ' <span class="rb-pill" style="font-size:.64rem">' + rb26Safe(q.lv) + '</span>' : '') + '</div>'
        + q.o.map(function (o, k) {
          const cls = answered ? (k === q.a ? 'ok' : k === pick ? 'no' : '') : '';
          return '<button type="button" class="rb-opt ' + cls + '" ' + (answered ? 'disabled' : '') + ' onclick="alQuizPick(' + i + ',' + k + ')">' + String.fromCharCode(65 + k) + '. ' + rb26Safe(o) + '</button>';
        }).join('')
        + (answered ? '<div class="rb-callout ' + (pick === q.a ? 'ok' : 'warn') + '" style="margin:8px 0 0">' + (pick === q.a ? '✅ Benar. ' : '❌ Belum tepat. ') + rb26Safe(q.e) + '</div>' : '')
        + '</div>';
    }).join('') + '</div>'
    + '<button class="btn alt full" type="button" onclick="ALCH.quiz={};pAlchemist()">Ulangi kuis</button>'
    + (done === ALCH_QUIZ.length ? '<div class="rb-callout ' + (right >= pass ? 'ok' : 'warn') + '"><b>Skor akhir: ' + right + '/' + ALCH_QUIZ.length + '.</b> ' + (right >= pass ? 'Lanjut ke backtest 100 trade dan jalankan rencana.' : 'Baca ulang kelompok Pemula dan Analisa sebelum mengulang kuis.') + '</div>' : '')
    + '</div>';
}

/* ---------- kerangka halaman ---------- */
function alGroup(g) {
  const G = ALCH_GROUPS.filter(function (x) { return x.id === g; })[0];
  if (!G) return;
  ALCH.group = g;
  ALCH.tab = G.tabs[0];
  pAlchemist();
}
function alSet(tab) {
  ALCH.tab = tab;
  const G = ALCH_GROUPS.filter(function (x) { return x.tabs.indexOf(tab) >= 0; })[0];
  if (G) ALCH.group = G.id;
  pAlchemist();
}
function pAlchemist() {
  const total = ALCH_GROUPS.reduce(function (n, g) { return n + g.tabs.length; }, 0);
  let G = ALCH_GROUPS.filter(function (g) { return g.id === ALCH.group; })[0];
  if (!G || G.tabs.indexOf(ALCH.tab) < 0) {
    G = ALCH_GROUPS.filter(function (g) { return g.tabs.indexOf(ALCH.tab) >= 0; })[0] || ALCH_GROUPS[0];
    ALCH.group = G.id;
  }
  if (G.tabs.indexOf(ALCH.tab) < 0) ALCH.tab = G.tabs[0];
  const B = {
    mulai: alStartHtml, dasar: alDasarHtml, roadmap: alRoadmapHtml, istilah: function () { return '<div id="alchterms">' + alTermsHtml() + '</div>'; },
    story: alStoryHtml, level: alLevelHtml, topdown: alTopdownHtml, sesi: alSessionHtml, entry: alEntryHtml,
    kasus: alCaseHtml, posisi: alPosisiHtml, risiko: alRiskHtml, kalkulator: alCalcHtml, cek: alCheckHtml,
    psiko: alPsikoHtml, backtest: alBacktestHtml, rencana: alPlanHtml, kuis: alQuizHtml,
    tfmap: alTfMapHtml, m5: alM5Html
  };
  const body = (B[ALCH.tab] || alStartHtml)();
  const groups = ALCH_GROUPS.map(function (g) {
    return '<button type="button" class="' + (g.id === G.id ? 'on' : '') + '" onclick="alGroup(\'' + g.id + '\')">' + g.label + '<span class="n">' + g.tabs.length + '</span></button>';
  }).join('');
  const tabs = G.tabs.map(function (id) {
    return '<button type="button" class="' + (ALCH.tab === id ? 'on' : '') + '" onclick="alSet(\'' + id + '\')">' + (ALCH_LABELS[id] || id) + '</button>';
  }).join('');
  $('pane').innerHTML = '<div class="card rb-hero-alch"><div class="rb-hero-main"><div class="rb-hero-copy">'
    + '<div class="rb-eyebrow">Trading · kurikulum</div><h2> Strategi Alchemist</h2>'
    + '<div class="rb-note">Jalur lengkap dari pemula sampai mahir: dasar pasar, storyline MSNR, level, playbook entry, manajemen posisi, risiko, psikologi, backtest, dan rencana eksekusi.</div>'
    + '<div class="rb-pill-row"><span class="rb-pill y">Edukasi</span><span class="rb-pill">MSNR</span><span class="rb-pill">SMC / ICT</span><span class="rb-pill">CRT</span><span class="rb-pill">QM</span></div>'
    + '</div><div class="ring" style="--p:100"><div class="ring-in"><b>' + total + '</b><span>modul</span></div></div></div></div>'
    + '<div class="rb-achg">' + groups + '</div>'
    + '<div class="stabs" style="margin-bottom:12px">' + tabs + '</div>'
    + '<div>' + body + '</div>'
    + '<div class="card"><h3>⚠️ Batas &amp; etika</h3><div class="rb-note">Materi ini edukasi, bukan sinyal atau saran finansial. Tidak ada strategi yang selalu benar: setiap level bisa gagal. Uji di akun demo, catat di jurnal, dan batasi risiko per trade. Sumber konsep: material publik MSNR/Alchemist, ICT/SMC, Candle Range Theory, dan Quasimodo.</div></div>';
  if (ALCH.tab === 'kalkulator' && typeof alCalc === 'function') setTimeout(alCalc, 0);
}
