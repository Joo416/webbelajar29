/* ===== DATA: kamus verb Inggris (arti Indonesia) ===== */
/* Format: v1=arti; dipisah titik koma. Dipakai bersama IRR bawaan aplikasi. */
const LB_EN_ARTI = `arise=mengalami, timbul;awake=terbangun;be=adalah, menjadi;bear=menanggung, melahirkan;beat=mengalahkan, memukul;become=menjadi;begin=memulai;bend=membengkokkan;bet=bertaruh;bid=menawar;bind=mengikat;bite=menggigit;bleed=berdarah;blow=meniup;break=memecahkan;breed=berkembang biak;bring=membawa;broadcast=menyiarkan;build=membangun;burn=membakar;burst=meletus;buy=membeli;cast=melempar, memilih peran;catch=menangkap;choose=memilih;cling=berpegang erat;come=datang;cost=berharga;creep=merangkak;cut=memotong;deal=berurusan, membagikan;dig=menggali;do=melakukan;draw=menggambar, menarik;dream=bermimpi;drink=minum;drive=mengemudi;eat=makan;fall=jatuh;feed=memberi makan;feel=merasa;fight=bertarung;find=menemukan;fit=pas;flee=melarikan diri;fling=melempar;fly=terbang;forbid=melarang;forecast=meramalkan;foresee=memperkirakan;forget=lupa;forgive=memaafkan;freeze=membeku;get=mendapat;give=memberi;go=pergi;grind=menggiling;grow=tumbuh;hang=menggantung;have=memiliki;hear=mendengar;hide=bersembunyi, menyembunyikan;hit=memukul;hold=memegang;hurt=melukai;keep=menjaga;keep=menyimpan;kneel=berlutut;know=tahu, mengenal;lay=meletakkan;lead=memimpin;lean=bersandar;leap=melompat;learn=belajar;leave=pergi, meninggalkan;lend=meminjamkan;let=membiarkan;lie=berbaring;light=menyalakan;lose=kehilangan;make=membuat;mean=berarti;meet=bertemu;mistake=mengira salah;overcome=mengatasi;oversee=mengawasi;pay=membayar;put=meletakkan;quit=berhenti;read=membaca;rebuild=membangun ulang;redo=mengulangi;ride=mengendarai;ring=berdering;rise=naik;run=berlari;say=berkata;see=melihat;seek=mencari;sell=menjual;send=mengirim;set=mengatur;sew=menjahit;shake=mengguncang;shed=menumpahkan;shine=bersinar;shoot=menembak;show=menunjukkan;shrink=menyusut;shut=menutup;sing=bernyanyi;sink=tenggelam;sit=duduk;slay=membunuh;sleep=tidur;slide=meluncur;smell=mencium bau;speak=berbicara;speed=mempercepat;spell=mengeja;spend=menghabiskan;spill=menumpahkan;spin=berputar;spit=meludah;split=membelah;spoil=merusak;spread=menyebarkan;spring=melompat;stand=berdiri;steal=mencuri;stick=merekat;sting=menyengat;stink=berbau;stride=melangkah;strike=memukul;strive=berusaha keras;swear=bersumpah;sweep=menyapu;swim=berenang;swing=mengayun;take=mengambil;teach=mengajar;tear=merobek;tell=memberitahu;think=berpikir;throw=melempar;thrive=berkembang;understand=memahami;undergo=menjalani;undo=membatalkan;upset=membuat kesal;wake=bangun;wear=memakai;weave=menenun;weep=menangis;wet=membasahi;win=menang;wind=memutar;withdraw=menarik;withhold=menahan;withstand=bertahan;write=menulis`;

/* Verb beraturan yang sering dipakai: v1=arti. V2/V3 dibuat otomatis dari aturan ejaan. */
const LB_EN_REG = `accept=menerima;add=menambahkan;agree=setuju;allow=mengizinkan;answer=menjawab;appear=muncul;arrive=tiba;ask=bertanya;believe=percaya;belong=milik;borrow=meminjam;call=memanggil, menelepon;change=mengubah;clean=membersihkan;climb=memanjat;close=menutup;collect=mengumpulkan;compare=membandingkan;cook=memasak;copy=menyalin;count=menghitung;cover=menutupi;create=menciptakan;cry=menangis;dance=menari;decide=memutuskan;deliver=mengantar;describe=menjelaskan;die=meninggal;discover=menemukan;discuss=berdiskusi;divide=membagi;drop=menjatuhkan;earn=menghasilkan;enjoy=menikmati;enter=masuk;explain=menjelaskan;fill=mengisi;finish=menyelesaikan;follow=mengikuti;happen=terjadi;help=menolong;hope=berharap;improve=memperbaiki;include=termasuk;increase=meningkatkan;invite=mengundang;join=bergabung;jump=melompat;kill=membunuh;laugh=tertawa;listen=mendengarkan;live=hidup, tinggal;look=melihat;love=mencintai;manage=mengelola;marry=menikah;move=bergerak;paint=melukis;pass=melewati;plan=merencanakan;play=bermain;practice=berlatih;prefer=lebih suka;prepare=menyiapkan;protect=melindungi;pull=menarik;push=mendorong;rain=hujan;reach=mencapai;receive=menerima;remember=mengingat;repeat=mengulang;reply=membalas;report=melaporkan;rest=beristirahat;return=kembali;save=menyelamatkan, menyimpan;share=berbagi;shop=berbelanja;sign=menandatangani;smile=tersenyum;start=memulai;stay=tinggal;stop=berhenti;study=belajar;talk=berbicara;travel=bepergian;try=mencoba;turn=berbelok, mengubah;use=menggunakan;visit=mengunjungi;wait=menunggu;walk=berjalan;want=ingin;wash=mencuci;watch=menonton;work=bekerja;worry=khawatir;yell=berteriak`;

/* Contoh siap pakai (tanpa AI) untuk verb paling sering dipakai. */
const LB_EN_EX = {
  go: [['I go to school every day.', 'Saya pergi ke sekolah setiap hari.'], ['I went to Bandung last week.', 'Saya pergi ke Bandung minggu lalu.'], ['I have gone there twice.', 'Saya sudah pergi ke sana dua kali.']],
  eat: [['They eat rice every morning.', 'Mereka makan nasi setiap pagi.'], ['She ate breakfast at seven.', 'Dia makan pagi pukul tujuh.'], ['We have eaten already.', 'Kami sudah makan.']],
  drink: [['I drink water after running.', 'Saya minum air setelah berlari.'], ['He drank two glasses of milk.', 'Dia minum dua gelas susu.'], ['They have drunk all the juice.', 'Mereka sudah menghabiskan seluruh jusnya.']],
  study: [['I study English every night.', 'Saya belajar bahasa Inggris setiap malam.'], ['She studied hard for the test.', 'Dia belajar keras untuk ujian.'], ['We have studied this chapter.', 'Kami sudah mempelajari bab ini.']],
  work: [['My father works in a bank.', 'Ayah saya bekerja di bank.'], ['He worked here last year.', 'Dia bekerja di sini tahun lalu.'], ['They have worked together for years.', 'Mereka sudah bekerja bersama selama bertahun-tahun.']],
  sleep: [['Babies sleep a lot.', 'Bayi banyak tidur.'], ['I slept early last night.', 'Saya tidur lebih awal tadi malam.'], ['She has slept for ten hours.', 'Dia sudah tidur selama sepuluh jam.']],
  write: [['I write a journal every week.', 'Saya menulis jurnal setiap minggu.'], ['He wrote a letter to his teacher.', 'Dia menulis surat kepada gurunya.'], ['She has written three books.', 'Dia sudah menulis tiga buku.']],
  read: [['We read the news every morning.', 'Kami membaca berita setiap pagi.'], ['I read that novel last month.', 'Saya membaca novel itu bulan lalu.'], ['He has read the whole report.', 'Dia sudah membaca seluruh laporan.']],
  speak: [['They speak English at work.', 'Mereka berbicara bahasa Inggris di tempat kerja.'], ['She spoke to the principal yesterday.', 'Dia berbicara dengan kepala sekolah kemarin.'], ['I have spoken to him about it.', 'Saya sudah membicarakannya dengannya.']],
  take: [['I take the bus to campus.', 'Saya naik bus ke kampus.'], ['He took my umbrella by mistake.', 'Dia tidak sengaja mengambil payung saya.'], ['She has taken the test twice.', 'Dia sudah mengikuti tes itu dua kali.']],
  make: [['My mother makes delicious cakes.', 'Ibu saya membuat kue yang lezat.'], ['He made a mistake in the exam.', 'Dia membuat kesalahan dalam ujian.'], ['They have made a decision.', 'Mereka sudah mengambil keputusan.']],
  see: [['I see a rainbow outside.', 'Saya melihat pelangi di luar.'], ['We saw the movie last night.', 'Kami menonton film itu tadi malam.'], ['She has seen that place before.', 'Dia sudah pernah melihat tempat itu sebelumnya.']]
};

/* Aturan pemakaian tiap bentuk (dipakai panel detail verb). */
const LB_EN_USE = {
  v1: ['V1 — bentuk dasar', 'Present simple untuk I/you/we/they + V1, infinitive (to + V1), kalimat perintah, dan setelah modal (can, will, must, should) atau do/does/did.', 'I / you / we / they + V1  •  to + V1  •  modal + V1'],
  v2: ['V2 — bentuk lampau (past simple)', 'Kejadian yang selesai di masa lampau, biasanya dengan yesterday, last week, ago, in 2020. Juga untuk pengandaian tidak nyata: If I + V2, I would ...', 'Subject + V2'],
  v3: ['V3 — past participle', 'Setelah have/has (present perfect: sudah/pernah), had (past perfect), dan bentuk pasif (be + V3). Bisa juga berfungsi sebagai kata sifat.', 'have/has/had + V3  •  be + V3'],
  ing: ['V-ing — bentuk berlangsung', 'Continuous tense (be + V-ing: sedang melakukan), gerund (kegiatan sebagai subjek/objek: Swimming is fun), setelah preposisi, dan setelah verba seperti enjoy, finish, avoid.', 'am / is / are / was / were + V-ing'],
  s: ['V-s / V-es — orang ketiga', 'Present simple untuk subjek he/she/it: He goes, she works. Perhatikan penambahan -es dan perubahan -y menjadi -ies.', 'he / she / it + V-s/es']
};

/* Verb intransitif: contoh pola tidak memakai objek "it". */
const LB_EN_INTR = {
  arise: 1, awake: 1, agree: 1, appear: 1, arrive: 1, bleed: 1, breed: 1, burst: 1, cling: 1,
  creep: 1, cry: 1, dance: 1, dream: 1, fall: 1, flee: 1, fly: 1, grow: 1, hang: 1, jump: 1,
  kneel: 1, laugh: 1, lean: 1, leap: 1, lie: 1, listen: 1, look: 1, move: 1, quit: 1, rest: 1,
  return: 1, rise: 1, run: 1, shine: 1, shrink: 1, sink: 1, sit: 1, sleep: 1, slide: 1, smile: 1,
  speak: 1, spin: 1, stay: 1, stop: 1, talk: 1, travel: 1, wait: 1, walk: 1, work: 1, worry: 1, yell: 1
};

/* Arti yang dipakai untuk kalimat pola agar bunyinya wajar. */
const LB_EN_ARTIFIX = {
  say: 'mengatakan', know: 'mengenal', want: 'menginginkan', hope: 'mengharapkan',
  speak: 'berbicara', look: 'melihat', wait: 'menunggu', agree: 'setuju', appear: 'muncul',
  arrive: 'tiba', sleep: 'tidur', dream: 'bermimpi', rain: 'turun hujan', happen: 'terjadi',
  die: 'meninggal', live: 'tinggal', cost: 'berharga', fit: 'cocok', hurt: 'terasa sakit',
  belong: 'milik', mean: 'berarti'
};

/* Contoh lima bentuk untuk verb yang polanya tidak bisa dibuat otomatis. */
const LB_EN_SPECIAL = {
  be: {
    v1: { en: 'They want to be ready.', id: 'Mereka ingin siap.' },
    v2: { en: 'She was tired yesterday.', id: 'Dia lelah kemarin.' },
    v3: { en: 'They have been busy.', id: 'Mereka sudah sibuk.' },
    ing: { en: 'He is being careful.', id: 'Dia sedang berhati-hati.' },
    s: { en: 'She is ready every morning.', id: 'Dia siap setiap pagi.' },
    tip: 'V1 be berubah menjadi am/is/are; bentuk lampau was/were; past participle been.'
  },
  become: {
    v1: { en: 'They become tired every day.', id: 'Mereka menjadi lelah setiap hari.' },
    v2: { en: 'She became a teacher.', id: 'Dia menjadi guru.' },
    v3: { en: 'They have become friends.', id: 'Mereka sudah menjadi teman.' },
    ing: { en: 'He is becoming stronger.', id: 'Dia sedang menjadi lebih kuat.' },
    s: { en: 'She becomes happy every morning.', id: 'Dia menjadi senang setiap pagi.' },
    tip: 'become diikuti kata sifat atau kata benda.'
  },
  cost: {
    v1: { en: 'It can cost a lot.', id: 'Barang itu bisa sangat mahal.' },
    v2: { en: 'It cost a lot yesterday.', id: 'Barang itu mahal kemarin.' },
    v3: { en: 'It has cost a lot.', id: 'Barang itu sudah memakan banyak biaya.' },
    ing: { en: 'It is costing a lot.', id: 'Biayanya sedang membengkak.' },
    s: { en: 'It costs a lot.', id: 'Barang itu mahal.' },
    tip: 'cost tidak berubah pada V2 dan V3.'
  },
  fit: {
    v1: { en: 'It can fit in the bag.', id: 'Itu bisa muat di tas.' },
    v2: { en: 'It fit well yesterday.', id: 'Itu pas kemarin.' },
    v3: { en: 'It has fit well.', id: 'Itu sudah pas.' },
    ing: { en: 'It is fitting well.', id: 'Itu sedang pas.' },
    s: { en: 'It fits well.', id: 'Itu pas.' },
    tip: 'fit sering dipakai untuk ukuran atau pakaian.'
  },
  hurt: {
    v1: { en: 'My arm can hurt after exercise.', id: 'Lenganku bisa sakit setelah olahraga.' },
    v2: { en: 'My arm hurt yesterday.', id: 'Lenganku sakit kemarin.' },
    v3: { en: 'My arm has hurt all day.', id: 'Lenganku sudah sakit sepanjang hari.' },
    ing: { en: 'My arm is hurting now.', id: 'Lenganku sedang sakit sekarang.' },
    s: { en: 'My arm hurts.', id: 'Lenganku sakit.' },
    tip: 'hurt tidak berubah pada V2 dan V3.'
  },
  rain: {
    v1: { en: 'It can rain today.', id: 'Hari ini bisa hujan.' },
    v2: { en: 'It rained yesterday.', id: 'Kemarin hujan.' },
    v3: { en: 'It has rained.', id: 'Sudah hujan.' },
    ing: { en: 'It is raining now.', id: 'Sekarang sedang hujan.' },
    s: { en: 'It rains every afternoon.', id: 'Setiap sore hujan.' },
    tip: 'rain memakai subjek it.'
  },
  happen: {
    v1: { en: 'It can happen to anyone.', id: 'Itu bisa terjadi pada siapa saja.' },
    v2: { en: 'It happened yesterday.', id: 'Itu terjadi kemarin.' },
    v3: { en: 'It has happened before.', id: 'Itu sudah terjadi sebelumnya.' },
    ing: { en: 'It is happening now.', id: 'Itu sedang terjadi sekarang.' },
    s: { en: 'It happens every day.', id: 'Itu terjadi setiap hari.' },
    tip: 'happen tidak memakai objek.'
  },
  belong: {
    v1: { en: 'It can belong to you.', id: 'Itu bisa menjadi milikmu.' },
    v2: { en: 'It belonged to my father.', id: 'Itu milik ayah saya.' },
    v3: { en: 'It has belonged to us.', id: 'Itu sudah menjadi milik kami.' },
    ing: { en: 'Belonging to a club is fun.', id: 'Menjadi anggota klub itu menyenangkan.' },
    s: { en: 'It belongs to me.', id: 'Itu milik saya.' },
    tip: 'belong to = milik; jarang dipakai dalam bentuk continuous.'
  },
  mean: {
    v1: { en: 'I mean it.', id: 'Saya sungguh-sungguh.' },
    v2: { en: 'She meant it.', id: 'Dia sungguh-sungguh.' },
    v3: { en: 'I have meant every word.', id: 'Saya sungguh-sungguh dengan setiap kata.' },
    ing: { en: 'Meaning matters in language.', id: 'Makna penting dalam bahasa.' },
    s: { en: 'It means a lot.', id: 'Itu sangat berarti.' },
    tip: 'mean to = berniat; mean = berarti.'
  },
  die: {
    v1: { en: 'Plants can die without water.', id: 'Tanaman bisa mati tanpa air.' },
    v2: { en: 'The plant died yesterday.', id: 'Tanaman itu mati kemarin.' },
    v3: { en: 'The plant has died.', id: 'Tanaman itu sudah mati.' },
    ing: { en: 'The plant is dying.', id: 'Tanaman itu sedang sekarat.' },
    s: { en: 'The plant dies without water.', id: 'Tanaman itu mati tanpa air.' },
    tip: 'die adalah verb intransitif; tidak memakai objek.'
  },
  go: {
    v1: { en: 'They go to school every day.', id: 'Mereka pergi ke sekolah setiap hari.' },
    v2: { en: 'She went home yesterday.', id: 'Dia pulang kemarin.' },
    v3: { en: 'They have gone to Bali.', id: 'Mereka sudah pergi ke Bali.' },
    ing: { en: 'He is going home now.', id: 'Dia sedang pulang sekarang.' },
    s: { en: 'She goes to work every morning.', id: 'Dia pergi kerja setiap pagi.' },
    tip: 'go to + tempat; go home tanpa to.'
  },
  come: {
    v1: { en: 'They come here every day.', id: 'Mereka datang ke sini setiap hari.' },
    v2: { en: 'She came late yesterday.', id: 'Dia datang terlambat kemarin.' },
    v3: { en: 'They have come back.', id: 'Mereka sudah kembali.' },
    ing: { en: 'He is coming now.', id: 'Dia sedang datang sekarang.' },
    s: { en: 'She comes early every morning.', id: 'Dia datang pagi-pagi setiap hari.' },
    tip: 'come here = datang ke sini; come back = kembali.'
  },
  arrive: {
    v1: { en: 'They arrive at school at seven.', id: 'Mereka tiba di sekolah pukul tujuh.' },
    v2: { en: 'She arrived late yesterday.', id: 'Dia tiba terlambat kemarin.' },
    v3: { en: 'They have arrived.', id: 'Mereka sudah tiba.' },
    ing: { en: 'He is arriving now.', id: 'Dia sedang tiba sekarang.' },
    s: { en: 'She arrives early every morning.', id: 'Dia tiba pagi-pagi setiap hari.' },
    tip: 'arrive at + tempat kecil; arrive in + kota atau negara.'
  },
  live: {
    v1: { en: 'They live in Jakarta.', id: 'Mereka tinggal di Jakarta.' },
    v2: { en: 'She lived there last year.', id: 'Dia tinggal di sana tahun lalu.' },
    v3: { en: 'They have lived here for years.', id: 'Mereka sudah tinggal di sini bertahun-tahun.' },
    ing: { en: 'He is living in Bali now.', id: 'Dia sedang tinggal di Bali sekarang.' },
    s: { en: 'She lives near the school.', id: 'Dia tinggal dekat sekolah.' },
    tip: 'live in + kota/negara; live at + alamat lengkap.'
  }
};
