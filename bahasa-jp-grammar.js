/* ===== DATA: tata bahasa Jepang & latihan menyusun kalimat ===== */
const LB_JP_GRAMMAR = [
  { t: 'A は B です', f: 'A は B です', e: 'Pola paling dasar: menerangkan bahwa A adalah B. は dibaca "wa" dan menandai topik.', ex: [['わたしは学生です。', 'Watashi wa gakusei desu.', 'Saya adalah pelajar.'], ['これは本です。', 'Kore wa hon desu.', 'Ini adalah buku.']] },
  { t: 'Kalimat tanya か', f: '... か。', e: 'Tambahkan か di akhir kalimat untuk bertanya. Urutan kata tidak berubah, intonasi naik.', ex: [['あなたは学生ですか。', 'Anata wa gakusei desu ka.', 'Apakah kamu pelajar?'], ['これは何ですか。', 'Kore wa nan desu ka.', 'Ini apa?']] },
  { t: 'Penyangkalan ではありません', f: 'A は B ではありません', e: 'Bentuk sopan untuk menyangkal. Dalam percakapan sehari-hari sering dipendekkan menjadi じゃないです.', ex: [['わたしは先生ではありません。', 'Watashi wa sensei dewa arimasen.', 'Saya bukan guru.'], ['それは私の本じゃないです。', 'Sore wa watashi no hon ja nai desu.', 'Itu bukan buku saya.']] },
  { t: 'Kepemilikan の', f: 'A の B', e: 'の menghubungkan dua kata benda: B milik/mengenai A. Urutannya terbalik dari bahasa Indonesia.', ex: [['わたしの本です。', 'Watashi no hon desu.', 'Itu buku saya.'], ['日本語の先生です。', 'Nihongo no sensei desu.', 'Dia guru bahasa Jepang.']] },
  { t: 'Partikel を (objek)', f: '... を + kata kerja', e: 'を (dibaca "o") menandai objek langsung dari kata kerja.', ex: [['ごはんを食べます。', 'Gohan o tabemasu.', 'Saya makan nasi.'], ['本を読みます。', 'Hon o yomimasu.', 'Saya membaca buku.']] },
  { t: 'Partikel に (waktu/tujuan)', f: 'waktu / tempat に', e: 'に dipakai untuk titik waktu (pukul, tanggal) dan tujuan keberadaan/arah masuk.', ex: [['七時に起きます。', 'Shichi-ji ni okimasu.', 'Saya bangun pukul tujuh.'], ['学校に行きます。', 'Gakkou ni ikimasu.', 'Saya pergi ke sekolah.']] },
  { t: 'Partikel で (tempat/alat)', f: 'tempat で / alat で', e: 'で menandai tempat berlangsungnya aktivitas atau alat yang dipakai.', ex: [['図書館で勉強します。', 'Toshokan de benkyou shimasu.', 'Saya belajar di perpustakaan.'], ['ペンで書きます。', 'Pen de kakimasu.', 'Saya menulis dengan pulpen.']] },
  { t: 'Partikel へ (arah)', f: 'tempat へ', e: 'へ (dibaca "e") menunjukkan arah pergerakan. Bisa diganti に tanpa mengubah arti inti.', ex: [['日本へ行きます。', 'Nihon e ikimasu.', 'Saya pergi ke Jepang.'], ['うちへ帰ります。', 'Uchi e kaerimasu.', 'Saya pulang ke rumah.']] },
  { t: 'Partikel も (juga)', f: 'A も ...', e: 'も menggantikan は/が untuk menyatakan "juga" atau "juga tidak".', ex: [['わたしも学生です。', 'Watashi mo gakusei desu.', 'Saya juga pelajar.'], ['これもください。', 'Kore mo kudasai.', 'Tolong yang ini juga.']] },
  { t: 'Kata kerja sopan ます', f: 'V-ます / V-ません / V-ました', e: 'Bentuk sopan: ます (sekarang/masa depan), ません (menyangkal), ました (lampau), ませんでした (lampau menyangkal).', ex: [['毎日勉強します。', 'Mainichi benkyou shimasu.', 'Saya belajar setiap hari.'], ['昨日は勉強しませんでした。', 'Kinou wa benkyou shimasen deshita.', 'Kemarin saya tidak belajar.']] },
  { t: 'Sedang berlangsung ています', f: 'V-て + います', e: 'Menyatakan aktivitas yang sedang berlangsung atau keadaan yang berlanjut.', ex: [['今、本を読んでいます。', 'Ima, hon o yonde imasu.', 'Sekarang saya sedang membaca buku.'], ['東京に住んでいます。', 'Toukyou ni sunde imasu.', 'Saya tinggal di Tokyo.']] },
  { t: 'Ingin melakukan たいです', f: 'V-ます (tanpa ます) + たいです', e: 'Menyatakan keinginan pembicara sendiri. Untuk orang lain gunakan たがっています.', ex: [['日本に行きたいです。', 'Nihon ni ikitai desu.', 'Saya ingin pergi ke Jepang.'], ['水が飲みたいです。', 'Mizu ga nomitai desu.', 'Saya ingin minum air.']] },
  { t: 'Meminta てください', f: 'V-て + ください', e: 'Permintaan sopan: "tolong lakukan ...".', ex: [['ゆっくり話してください。', 'Yukkuri hanashite kudasai.', 'Tolong bicara pelan-pelan.'], ['名前を書いてください。', 'Namae o kaite kudasai.', 'Tolong tulis nama Anda.']] },
  { t: 'Boleh てもいいです', f: 'V-て + もいいです', e: 'Memberi atau meminta izin. Untuk bertanya: てもいいですか。', ex: [['ここに座ってもいいですか。', 'Koko ni suwatte mo ii desu ka.', 'Bolehkah saya duduk di sini?'], ['入ってもいいです。', 'Haitte mo ii desu.', 'Silakan masuk.']] },
  { t: 'Dilarang てはいけません', f: 'V-て + は + いけません', e: 'Menyatakan larangan yang tegas.', ex: [['ここで写真を撮ってはいけません。', 'Koko de shashin o totte wa ikemasen.', 'Dilarang memotret di sini.'], ['遅れてはいけません。', 'Okurete wa ikemasen.', 'Jangan terlambat.']] },
  { t: 'Perbandingan より / のほうが', f: 'A より B のほうが ...', e: 'Membandingkan dua hal: B lebih ... daripada A.', ex: [['電車はバスより速いです。', 'Densha wa basu yori hayai desu.', 'Kereta lebih cepat daripada bus.'], ['夏より冬のほうが好きです。', 'Natsu yori fuyu no hou ga suki desu.', 'Saya lebih suka musim dingin daripada musim panas.']] },
  { t: 'Bisa ことができます', f: 'V (bentuk kamus) + ことができます', e: 'Menyatakan kemampuan atau kemungkinan melakukan sesuatu.', ex: [['日本語を話すことができます。', 'Nihongo o hanasu koto ga dekimasu.', 'Saya bisa berbicara bahasa Jepang.'], ['ここで写真を撮ることができますか。', 'Koko de shashin o toru koto ga dekimasu ka.', 'Bisakah memotret di sini?']] },
  { t: 'Ajakan ましょう', f: 'V-ます (tanpa ます) + ましょう', e: 'Mengajak melakukan sesuatu bersama: "mari ...".', ex: [['一緒に行きましょう。', 'Issho ni ikimashou.', 'Mari pergi bersama.'], ['昼ごはんを食べましょう。', 'Hirugohan o tabemashou.', 'Mari makan siang.']] },
  { t: 'Ada あります / います', f: 'tempat に benda が あります/います', e: 'あります untuk benda tak bernyawa, います untuk manusia dan hewan.', ex: [['机の上に本があります。', 'Tsukue no ue ni hon ga arimasu.', 'Di atas meja ada buku.'], ['教室に学生がいます。', 'Kyoushitsu ni gakusei ga imasu.', 'Di kelas ada siswa.']] },
  { t: 'Kata sifat い dan な', f: 'い-keiyoushi / な-keiyoushi', e: 'Kata sifat い mengubah akhiran い (高い → 高くない, 高かった). Kata sifat な memakai です (きれいです, きれいじゃないです).', ex: [['この本は高いです。', 'Kono hon wa takai desu.', 'Buku ini mahal.'], ['きれいな花ですね。', 'Kirei na hana desu ne.', 'Bunganya indah, ya.']] }
];

/* Latihan menyusun kalimat: bagian diacak, pengguna menyusun ulang. */
const LB_JP_BUILD = [
  { jp: 'わたしは学生です', parts: ['わたし', 'は', '学生', 'です'], id: 'Saya adalah pelajar.', note: 'A は B です = A adalah B.' },
  { jp: 'これは本です', parts: ['これ', 'は', '本', 'です'], id: 'Ini adalah buku.', note: 'これ = ini.' },
  { jp: 'ごはんを食べます', parts: ['ごはん', 'を', '食べます'], id: 'Saya makan nasi.', note: 'を menandai objek.' },
  { jp: '学校に行きます', parts: ['学校', 'に', '行きます'], id: 'Saya pergi ke sekolah.', note: 'に = tujuan.' },
  { jp: '図書館で勉強します', parts: ['図書館', 'で', '勉強します'], id: 'Saya belajar di perpustakaan.', note: 'で = tempat aktivitas.' },
  { jp: '日本へ行きたいです', parts: ['日本', 'へ', '行きたいです'], id: 'Saya ingin pergi ke Jepang.', note: 'たいです = ingin.' },
  { jp: 'ゆっくり話してください', parts: ['ゆっくり', '話して', 'ください'], id: 'Tolong bicara pelan-pelan.', note: 'てください = tolong lakukan.' },
  { jp: 'わたしも学生です', parts: ['わたし', 'も', '学生', 'です'], id: 'Saya juga pelajar.', note: 'も = juga.' },
  { jp: '今、本を読んでいます', parts: ['今', '本', 'を', '読んで', 'います'], id: 'Sekarang saya sedang membaca buku.', note: 'ています = sedang berlangsung.' },
  { jp: '電車はバスより速いです', parts: ['電車', 'は', 'バス', 'より', '速いです'], id: 'Kereta lebih cepat daripada bus.', note: 'A は B より ... = A lebih ... daripada B.' },
  { jp: 'ここに座ってもいいですか', parts: ['ここ', 'に', '座って', 'も', 'いいですか'], id: 'Bolehkah saya duduk di sini?', note: 'てもいいですか = bolehkah.' },
  { jp: '机の上に本があります', parts: ['机', 'の', '上', 'に', '本', 'が', 'あります'], id: 'Di atas meja ada buku.', note: 'あります untuk benda.' }
];
