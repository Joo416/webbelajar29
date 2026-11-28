/* =====================================================================
   NEWS ANALISIS — ditulis ulang dari nol.
   Isi: 4 rilis inti (NFP, CPI, PPI, FOMC) + rilis lain yang muncul
   bersamaan. Arah BUY/SELL dan status spike TIDAK ditebak AI: dihitung
   dari reaksi harga nyata, kejutan aktual vs konsensus, dan data pasar.
   AI hanya merangkum seluruh sumber menjadi satu dokumen.
   ===================================================================== */
'use strict';
const C = require('./xau-core');
const L = require('./learn');
const K = require('./knowledge');
const S = require('./smc');
const W = require('./goldwire');

const TAGS = ['NFP', 'CPI', 'PPI', 'FOMC'];
const NAME = {
  NFP: 'Non-Farm Payrolls', CPI: 'Consumer Price Index', PPI: 'Producer Price Index',
  FOMC: 'FOMC — Federal Funds Rate & Statement'
};
/* Penjelasan fokus dipakai UI dan ringkasan deterministik. Isinya hanya
   definisi/transmisi, bukan angka yang bisa berubah. */
const FOCUS_META = {
  NFP: {
    measures: 'Perubahan jumlah tenaga kerja non-pertanian AS; mengukur kekuatan pasar kerja dan tekanan upah.',
    gold: 'Data lebih panas dari konsensus biasanya menguatkan USD/yield dan menekan emas; data lebih dingin melemahkan USD dan mendukung emas.',
    primary: 'aktual NFP vs konsensus, lalu reaksi XAUUSD 15 menit'
  },
  CPI: {
    measures: 'Inflasi harga konsumen AS, terutama CPI dan core CPI; mengukur tekanan inflasi yang dihadapi The Fed.',
    gold: 'CPI lebih panas menaikkan ekspektasi suku bunga/yield riil dan menekan emas; CPI lebih dingin menurunkan tekanan itu dan mendukung emas.',
    primary: 'aktual CPI vs konsensus, lalu reaksi XAUUSD 15 menit'
  },
  PPI: {
    measures: 'Inflasi harga produsen AS (final demand); indikator awal tekanan harga di rantai produksi.',
    gold: 'PPI lebih panas dapat menaikkan ekspektasi inflasi/yield dan menekan emas; PPI lebih dingin memberi ruang dukungan untuk emas.',
    primary: 'aktual PPI vs konsensus, lalu reaksi XAUUSD 15 menit'
  },
  FOMC: {
    measures: 'Keputusan Federal Funds Rate, statement, dan proyeksi/komunikasi The Fed; mengukur arah kebijakan moneter AS.',
    gold: 'Fed lebih hawkish (rate/guidance lebih tinggi) menaikkan yield riil dan menekan emas; Fed lebih dovish menurunkan yield riil dan mendukung emas.',
    primary: 'keputusan Fed dan perubahan guidance vs ekspektasi, lalu reaksi XAUUSD 15 menit'
  }
};
/* ------------------------------------------------------------------
   PANDUAN RILIS — bahan audit untuk mesin dan AI.
   Isinya definisi komponen, proxy pra-rilis, cara pasar harus mengonfirmasi,
   dan sumber primer. Semua ANGKA tetap diambil dari FRED/BLS/kalender di
   bawah; blok ini tidak pernah menambah angka sendiri.
   ------------------------------------------------------------------ */
const SRC = {
  blsCal: ['BLS Release Calendar', 'https://www.bls.gov/schedule/news_release/'],
  blsCpi: ['BLS CPI', 'https://www.bls.gov/cpi/'],
  blsEmp: ['BLS Employment Situation', 'https://www.bls.gov/news.release/empsit.toc.htm'],
  blsPpi: ['BLS PPI', 'https://www.bls.gov/ppi/'],
  fed: ['Federal Reserve — FOMC calendar, statement, SEP', 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'],
  fedWatch: ['CME FedWatch', 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html'],
  cot: ['CFTC Commitments of Traders', 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm'],
  wgc: ['World Gold Council / Goldhub', 'https://www.gold.org/goldhub'],
  cmeGold: ['CME Gold Futures', 'https://www.cmegroup.com/markets/metals/precious/gold.html'],
  fredReal: ['FRED DFII10 — yield riil 10Y', 'https://fred.stlouisfed.org/series/DFII10'],
  fred10: ['FRED DGS10 — yield Treasury 10Y', 'https://fred.stlouisfed.org/series/DGS10'],
  te: ['Trading Economics calendar', 'https://tradingeconomics.com/calendar'],
  tvCal: ['TradingView Economic Calendar', 'https://www.tradingview.com/economic-calendar/']
};
const src = (x, use) => ({ name: x[0], url: x[1], use });
const RELEASE_GUIDE = {
  CPI: {
    read: [
      'CPI headline: MoM dan YoY.',
      'CPI core: MoM dan YoY.',
      'Komponen: shelter dan jasa; energi sebagai konteks.',
      'Apakah kenaikan tersebar (breadth) atau hanya satu komponen?',
      'Aktual vs konsensus vs bulan sebelumnya.',
      'Tabel komponen resmi BLS (termasuk revisi/perubahan metodologi).'
    ],
    rules: [
      'CPI lebih panas dari konsensus → ekspektasi kebijakan lebih ketat, yield/USD naik, emas tertekan.',
      'CPI lebih lunak → dukungan untuk emas, tetapi reaksi harga dan yield harus mengonfirmasi.',
      'Headline dan core bisa berbeda arah; jangan menyimpulkan dari satu komponen saja.'
    ],
    reaction: ['XAUUSD 15 menit pertama', 'Indeks USD (DXY)', 'Yield Treasury nominal 10Y', 'Yield riil TIPS 10Y (DFII10)'],
    sources: [src(SRC.blsCal, 'Jadwal resmi CPI/NFP/PPI; jadwal bisa berubah, cek lagi mendekati tanggal.'), src(SRC.blsCpi, 'Rilis resmi dan tabel komponen CPI.'), src(SRC.fredReal, 'Yield riil harian untuk konteks kebijakan.'), src(SRC.fred10, 'Yield nominal harian.'), src(SRC.tvCal, 'Kalender dan konsensus untuk pemantauan; cocokkan aktual dengan BLS.')]
  },
  NFP: {
    read: [
      'Payrolls (survei perusahaan).',
      'Tingkat pengangguran (survei rumah tangga).',
      'Upah per jam (average hourly earnings).',
      'Jam kerja (average weekly hours).',
      'Sektor pekerjaan dan komponen Employment PMI/ISM sebagai konteks.',
      'Revisi dua bulan sebelumnya — payrolls dapat direvisi.',
      'Bandingkan survei perusahaan (payrolls) dengan survei rumah tangga (pengangguran).'
    ],
    rules: [
      'Pasar kerja atau upah lebih kuat dari perkiraan → ekspektasi suku bunga/yield naik, emas tertekan.',
      'Data lebih lemah → dukungan emas, tetapi reaksi risk-off atau pembacaan campuran dapat membalik arah.',
      'Payrolls dan tingkat pengangguran berasal dari survei berbeda; konflik keduanya adalah alasan menurunkan keyakinan.'
    ],
    reaction: ['XAUUSD 15 menit pertama', 'DXY', 'Yield Treasury nominal 10Y', 'Yield riil TIPS 10Y'],
    sources: [src(SRC.blsCal, 'Jadwal resmi Employment Situation.'), src(SRC.blsEmp, 'Rilis resmi payrolls, pengangguran, upah, jam kerja, revisi.'), src(SRC.fed, 'Konteks kebijakan dan reaksi Fed.'), src(SRC.fredReal, 'Yield riil harian.'), src(SRC.cot, 'Posisi futures mingguan; data Selasa, rilis Jumat — bukan trigger intraday.')]
  },
  PPI: {
    read: [
      'PPI final demand: MoM dan YoY.',
      'Komponen barang dan jasa, bobot, serta kontribusinya.',
      'Perubahan bulanan dan revisi indeks.',
      'Perbandingan dengan konsensus dan bulan sebelumnya.',
      'Ingat: cakupan PPI berbeda dari CPI; PPI bukan prediksi pasti CPI.'
    ],
    rules: [
      'PPI dapat memberi petunjuk tekanan harga, tetapi bukan ramalan pasti CPI.',
      'PPI tidak otomatis menentukan arah emas; konfirmasi dengan yield/USD dan reaksi XAUUSD.',
      'Komponen barang dan jasa bisa berlawanan; jangan memakai satu komponen sebagai arah final.'
    ],
    reaction: ['XAUUSD 15 menit pertama', 'DXY', 'Yield 10Y', 'Yield riil 10Y'],
    sources: [src(SRC.blsCal, 'Jadwal resmi PPI.'), src(SRC.blsPpi, 'Rilis resmi dan tabel PPI final demand/komponen.'), src(SRC.fredReal, 'Yield riil harian.'), src(SRC.fred10, 'Yield nominal harian.'), src(SRC.te, 'Kalender dan konsensus sekunder.')]
  },
  FOMC: {
    read: [
      'Keputusan suku bunga dibanding ekspektasi.',
      'Pernyataan (statement) dan apa yang berubah dari rapat sebelumnya.',
      'Proyeksi ekonomi / SEP dan dot plot bila diterbitkan.',
      'Konferensi pers: nada, penekanan, dan tanya jawab.',
      'Minutes setelah rapat (bila sudah terbit) dan perubahan guidance/jalur suku bunga.',
      'Bandingkan keputusan dengan probabilitas FedWatch — probabilitas tersirat, bukan kepastian.'
    ],
    rules: [
      'Nada lebih hawkish dari perkiraan → yield/USD naik, emas tertekan.',
      'Nada lebih dovish → dukungan emas, terutama bila yield riil turun.',
      'Komentar Fed dan risiko geopolitik dapat mengubah respons awal; arah awal bukan jaminan arah sesi.'
    ],
    reaction: ['XAUUSD 15 menit pertama', 'DXY', 'Yield nominal 10Y', 'Yield riil TIPS 10Y', 'Perubahan probabilitas FedWatch'],
    sources: [src(SRC.fed, 'Kalender rapat, statement, konferensi pers, notulen, proyeksi/SEP.'), src(SRC.fedWatch, 'Probabilitas tersirat dari harga futures Fed Funds; bukan jaminan keputusan Fed.'), src(SRC.fredReal, 'Yield riil harian.'), src(SRC.fred10, 'Yield nominal harian.'), src(SRC.wgc, 'Konteks makro emas, ETF flows, permintaan bank sentral — bukan trigger M5.')]
  }
};
/* ------------------------------------------------------------------
   RUJUKAN JADWAL, SUMBER, DAN SKENARIO PASAR
   Bagian ini menjawab tiga kesalahan yang paling sering terjadi saat
   membaca news:
   1) mencampur satuan/periode (CPI headline MoM vs core YoY),
   2) memakai konsensus kalender sekunder tanpa mencocokkan angka resmi,
   3) menganggap "data panas = emas turun" sebagai hukum, padahal bisa
      sudah priced in, bertentangan antarkomponen, atau ada safe-haven.
   Semua angka tetap berasal dari kalender/FRED/BLS; blok ini hanya
   menyusun cara membaca dan skenario bersyarat.
   ------------------------------------------------------------------ */
const REFERENCE = {
  checked: '2026-11-23',
  note: 'Jadwal resmi yang dilaporkan per 23 Nov 2026. Kalender dapat berubah; cek ulang BLS/Fed sebelum rilis. Waktu resmi BLS memakai Eastern Time (ET).',
  schedule: [
    { tag: 'PCE', title: 'Personal Income and Outlays — PCE Oktober 2026', at: '2026-11-25T13:30:00Z', label: '25 Nov 2026 · 08:30 ET', role: 'Pelengkap inflasi menjelang FOMC; bukan CPI/NFP/PPI.' },
    { tag: 'NFP', title: 'Employment Situation November 2026', at: '2026-12-04T13:30:00Z', label: '4 Des 2026 · 08:30 ET', role: 'Payrolls, pengangguran, upah, jam kerja, revisi.' },
    { tag: 'FOMC', title: 'FOMC Meeting 8–9 Desember 2026', at: '2026-12-09T19:00:00Z', label: 'Rapat 8–9 Des 2026 · statement 9 Des 14:00 ET', role: 'Keputusan rate, statement, SEP/dot plot, konferensi pers.' },
    { tag: 'CPI', title: 'CPI November 2026', at: '2026-12-10T13:30:00Z', label: '10 Des 2026 · 08:30 ET', role: 'Headline/core MoM-YoY, shelter, jasa, energi.' },
    { tag: 'PPI', title: 'PPI November 2026', at: '2026-12-15T13:30:00Z', label: '15 Des 2026 · 08:30 ET', role: 'Final demand, barang/jasa, komponen.' }
  ],
  latest: [
    { tag: 'NFP', metric: 'Payrolls', value: '+165 ribu', period: 'Okt 2026', source: 'BLS' },
    { tag: 'NFP', metric: 'Tingkat pengangguran', value: '4,1%', period: 'Okt 2026', source: 'BLS' },
    { tag: 'CPI', metric: 'Headline CPI MoM', value: '+0,4%', period: 'Okt 2026', source: 'BLS' },
    { tag: 'CPI', metric: 'Core CPI MoM', value: '+0,3%', period: 'Okt 2026', source: 'BLS' },
    { tag: 'PPI', metric: 'Final demand MoM', value: '+0,3%', period: 'Okt 2026', source: 'BLS' }
  ],
  latestNote: 'Angka terbaru yang tersedia di rujukan ini BUKAN forecast untuk rilis berikutnya. Selalu bandingkan dengan konsensus yang tercatat di kalender dan angka resmi saat rilis.'
};

/* Sumber dikelompokkan menurut fungsi, bukan menurut "paling populer". */
const SOURCE_MATRIX = {
  primary: [
    { need: 'Jadwal CPI/NFP/PPI', name: 'BLS Release Calendar', url: 'https://www.bls.gov/schedule/news_release/', use: 'Tanggal dan waktu rilis resmi; BLS menyatakan kalender memakai Eastern Time.' },
    { need: 'CPI', name: 'BLS CPI — News Releases, Historical Data, Databases', url: 'https://www.bls.gov/cpi/', use: 'Rilis, tabel komponen, data historis, dan seri CPI.' },
    { need: 'NFP', name: 'BLS Employment Situation', url: 'https://www.bls.gov/news.release/empsit.toc.htm', use: 'Payrolls, pengangguran, upah, jam kerja, revisi, tabel A/B; survei rumah tangga dan perusahaan.' },
    { need: 'PPI', name: 'BLS PPI — News Releases, Detailed Report, Tables', url: 'https://www.bls.gov/ppi/', use: 'Final demand, barang/jasa, komponen, bobot, data historis.' },
    { need: 'PCE', name: 'BEA Personal Income and Outlays / PCE', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index', use: 'Indeks harga PCE dan konsumsi; pelengkap inflasi, bukan pengganti CPI.' },
    { need: 'FOMC', name: 'Federal Reserve FOMC Calendar & Materials', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', use: 'Jadwal, statement, minutes, SEP/dot plot, konferensi pers.' },
    { need: 'Nowcast inflasi', name: 'Cleveland Fed Inflation Nowcasting', url: 'https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting', use: 'Model nowcast CPI/PCE sebelum rilis; perkiraan, bukan data aktual, dan bisa meleset.' },
    { need: 'Yield nominal/riil', name: 'U.S. Treasury + FRED DGS10/DFII10', url: 'https://fred.stlouisfed.org/series/DFII10', use: 'Yield Treasury nominal dan TIPS 10Y; kanal utama kebijakan ke emas.' },
    { need: 'Posisi futures emas', name: 'CFTC Commitments of Traders', url: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', use: 'Posisi mingguan (data Selasa, terbit Jumat); tertinggal, bukan pemicu intraday.' },
    { need: 'Volume/open interest futures', name: 'CME Gold Futures — Volume & Open Interest', url: 'https://www.cmegroup.com/markets/metals/precious/gold.html', use: 'Data kontrak COMEX; futures tidak identik dengan CFD XAUUSD broker.' }
  ],
  secondary: [
    { name: 'Trading Economics', url: 'https://tradingeconomics.com/calendar', use: 'Kalender, forecast/previous/actual, filter dampak; cocokkan actual ke rilis resmi.' },
    { name: 'Investing.com Economic Calendar', url: 'https://www.investing.com/economic-calendar/', use: 'Kalender pembanding; konsensus dapat berbeda dari BLS/CME.' },
    { name: 'FXStreet Calendar', url: 'https://www.fxstreet.com/economic-calendar', use: 'Kalender + komentar; bukan sumber angka resmi.' },
    { name: 'TradingView Economic Calendar', url: 'https://www.tradingview.com/economic-calendar/', use: 'Kalender yang dipakai panel ini untuk jadwal/konsensus; cadangan FairEconomy.' },
    { name: 'Forex Factory', url: 'https://www.forexfactory.com/calendar', use: 'Kalender dan filter dampak; periksa zona waktu.' },
    { name: 'FinancialJuice', url: 'https://www.financialjuice.com/', use: 'Feed headline/kalender untuk pemantauan cepat, bukan pengganti data primer.' }
  ],
  nfpContext: [
    { name: 'ADP Research', url: 'https://adpemploymentreport.com/', use: 'Laporan privat; metodologi berbeda dari BLS dan sering tidak sejalan.' },
    { name: 'JOLTS / BLS', url: 'https://www.bls.gov/jlt/', use: 'Lowongan, perekrutan, pemisahan kerja; resmi tetapi tertinggal satu bulan.' },
    { name: 'DOL Weekly Claims', url: 'https://www.dol.gov/ui/data.pdf', use: 'Klaim pengangguran mingguan; berisik dan bukan NFP.' },
    { name: 'ISM PMI Reports', url: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/', use: 'Komponen employment PMI; konteks, bukan prediksi NFP.' }
  ],
  youtube: {
    CPI: ['BLS CPI news release explained', 'BLS CPI data tables tutorial', 'Federal Reserve inflation data explained', 'Cleveland Fed Inflation Nowcasting explained'],
    NFP: ['BLS Employment Situation tables', 'BLS Employment Situation explained', 'ADP employment report vs BLS', 'JOLTS job openings explained', 'US weekly jobless claims explained'],
    PPI: ['BLS Producer Price Index explained', 'BLS PPI news release', 'PPI vs CPI difference BLS'],
    FOMC: ['FOMC press conference official', 'Federal Reserve monetary policy statement', 'SEP dot plot explained', 'CME FedWatch tutorial', 'Understanding the FOMC Report', 'COMEX gold futures volume open interest'],
    ALCHEMIST: ['Bam FX Alchemist storyline IDM Major BOS', 'Alchemist XAUUSD IDM valid high low', 'Alchemist trading strategy storyline POI trigger']
  },
  youtubeNote: 'Cari kanal resmi/edukasi. Untuk video Alchemist, periksa apakah kreator mendefinisikan IDM, valid high/low, dan syarat BOS secara konsisten serta menunjukkan pengujian — bukan hanya screenshot trade berhasil. Tidak ada bukti bahwa satu kanal mewakili semua profesional.'
};

const UNIT_WARNING = {
  CPI: 'Headline CPI MoM, core CPI MoM, headline YoY, dan core YoY adalah empat metrik berbeda. Jangan membandingkan angka MoM dengan YoY, atau headline dengan core, tanpa label satuan dan periode.',
  NFP: 'Payrolls (ribu), tingkat pengangguran (%), upah per jam (% MoM), dan jam kerja (jam) memakai satuan berbeda. Revisi payrolls adalah perubahan pada data terbit sebelumnya, bukan perubahan bulan ini.',
  PPI: 'PPI final demand, komponen barang, dan komponen jasa bisa bergerak berbeda. PPI bukan prediksi pasti CPI karena cakupannya berbeda.',
  FOMC: 'Keputusan rate (rentang %), statement/guidance, SEP/dot plot, dan probabilitas FedWatch adalah empat hal berbeda. FedWatch adalah probabilitas tersirat dari harga futures, bukan kepastian keputusan.'
};

/* Skenario bersyarat. "hot" berarti angka lebih panas/kuat dari konsensus. */
const SCENARIO_MAP = {
  CPI: {
    focus: 'Inflasi konsumen AS: headline/core MoM-YoY, shelter, jasa, energi, dan sebaran kenaikan.',
    hot: 'CPI lebih panas → ekspektasi kebijakan lebih ketat, yield nominal/riil dan USD naik → tekanan turun emas.',
    cold: 'CPI lebih dingin → ekspektasi yield/USD turun → dukungan naik emas, terutama bila yield riil turun.',
    inline: 'CPI sesuai konsensus → arah tergantung reaksi yield/USD dan apakah angka sudah priced in; tunggu 15 menit.',
    conflict: 'Headline dan core bisa berlawanan. Jika headline panas tetapi core dingin (atau sebaliknya), jangan memilih arah dari satu komponen; turunkan keyakinan dan tunggu konfirmasi yield.',
    watch: ['Aktual headline/core vs konsensus', 'Shelter dan jasa (lengket)', 'Energi sebagai konteks', 'DXY dan yield 10Y', 'Yield riil TIPS 10Y (DFII10)'],
    invalidation: 'Arah data dibatalkan bila reaksi XAUUSD 15 menit ≥30 pip berlawanan, atau headline/core bertentangan tanpa konfirmasi yield.'
  },
  NFP: {
    focus: 'Pasar kerja AS: payrolls, pengangguran, upah per jam, jam kerja, sektor, dan revisi dua bulan.',
    hot: 'Payrolls/upah lebih kuat → ekspektasi suku bunga dan yield naik → tekanan turun emas.',
    cold: 'Payrolls/upah lebih lemah → yield/USD turun → dukungan naik emas, kecuali risk-off mendorong safe-haven.',
    inline: 'Sesuai konsensus → fokus pada revisi, upah, dan tingkat pengangguran; arah menunggu reaksi.',
    conflict: 'Payrolls (survei perusahaan) dan pengangguran (survei rumah tangga) bisa berbeda arah. Konflik keduanya adalah alasan menurunkan keyakinan, bukan memilih salah satu.',
    watch: ['Payrolls vs konsensus', 'Revisi dua bulan sebelumnya', 'Tingkat pengangguran', 'Average hourly earnings', 'Jam kerja dan sektor', 'DXY/yield 10Y'],
    invalidation: 'Bias data dibatalkan bila reaksi 15 menit ≥30 pip berlawanan atau payrolls/pengangguran memberi sinyal bertentangan.'
  },
  PPI: {
    focus: 'Harga produsen AS: final demand, barang, jasa, dan komponen; bukan prediksi pasti CPI.',
    hot: 'PPI lebih panas → ekspektasi inflasi/yield naik → tekanan turun emas, tetapi efeknya biasanya lebih kecil dari CPI.',
    cold: 'PPI lebih dingin → tekanan inflasi mereda → dukungan terbatas untuk emas bila yield ikut turun.',
    inline: 'Sesuai konsensus → pasar biasanya menunggu CPI; jangan memaksakan arah dari PPI saja.',
    conflict: 'Barang dan jasa bisa berlawanan. BLS menjelaskan cakupan PPI dan CPI berbeda, jadi PPI tidak otomatis menentukan CPI atau arah emas.',
    watch: ['PPI final demand MoM/YoY', 'Komponen barang', 'Komponen jasa', 'Revisi indeks', 'DXY/yield 10Y'],
    invalidation: 'Bias PPI dibatalkan bila reaksi 15 menit ≥30 pip berlawanan atau yield/USD tidak mengonfirmasi.'
  },
  FOMC: {
    focus: 'Keputusan Fed, statement, SEP/dot plot, konferensi pers, dan perubahan guidance.',
    hot: 'Fed lebih hawkish dari ekspektasi → yield riil/USD naik → tekanan turun emas.',
    cold: 'Fed lebih dovish → yield riil/USD turun → dukungan naik emas.',
    inline: 'Keputusan sesuai ekspektasi → arah ditentukan statement, dot plot, dan konferensi pers; cek apakah sudah priced in.',
    conflict: 'Keputusan bisa sesuai ekspektasi tetapi dot plot/konferensi pers hawkish. Baca statement dan proyeksi, bukan hanya angka rate.',
    watch: ['Keputusan vs ekspektasi FedWatch', 'Perubahan kalimat statement', 'SEP/dot plot', 'Nada konferensi pers', 'Yield nominal/riil', 'DXY'],
    invalidation: 'Bias Fed dibatalkan bila reaksi 15 menit ≥30 pip berlawanan atau statement/konferensi pers memberi sinyal sebaliknya.'
  }
};

function numOf(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : null;
}

function refFor(focus) {
  const future = REFERENCE.schedule.filter(x => x.at && Date.parse(x.at) > Date.now() - 3600000);
  const next = future[0] || null;
  return {
    checked: REFERENCE.checked,
    stale: !future.length,
    note: future.length ? REFERENCE.note : 'Semua tanggal rujukan sudah lewat. Jadwal ini tidak lagi menjadi jadwal terdekat; buka BLS Release Calendar dan FOMC Calendar untuk tanggal terbaru.',
    next,
    nextFocus: future.find(x => x.tag === focus) || null,
    schedule: REFERENCE.schedule.map(x => ({ ...x })),
    latest: REFERENCE.latest.filter(x => x.tag === focus).length ? REFERENCE.latest.filter(x => x.tag === focus) : REFERENCE.latest.slice(0, 4),
    latestNote: REFERENCE.latestNote + ' Data rujukan diperiksa ' + REFERENCE.checked + '; setelah ada rilis baru, angka pada checklist komponen di atas yang menjadi acuan.'
  };
}

function calendarAudit(ev, cal) {
  const list = Array.isArray(cal) ? cal : [];
  const same = ev && ev.ts ? list.filter(x => x && x.ts === ev.ts) : [];
  const a = numOf(ev && ev.actual), o = ev && ev.actualOfficial != null ? Number(ev.actualOfficial) : null;
  const gap = a != null && o != null && isFinite(o) ? Math.abs(a - o) : null;
  const scale = a != null && o != null && isFinite(o) ? Math.max(Math.abs(a), Math.abs(o)) : 0;
  const matched = o != null && (gap == null || gap <= Math.max(0.2, scale * 0.25));
  return {
    used: 'TradingView Economic Calendar (cadangan: FairEconomy)',
    alternatives: ['Trading Economics', 'Investing.com', 'FXStreet', 'Forex Factory', 'FinancialJuice'],
    events: list.length,
    sameSlot: same.map(x => ({ title: x.title, forecast: x.forecast || '', previous: x.previous || '', impact: x.impact || '' })),
    officialSource: ev && ev.actualSource ? ev.actualSource : '',
    officialPeriod: ev && ev.officialPeriod ? ev.officialPeriod : '',
    officialValue: o,
    calendarValue: a,
    gap: gap == null ? null : P(gap),
    matched,
    note: matched
      ? 'Angka kalender dan angka resmi sejalan pada skala yang sama. Tetap catat kalender yang dipakai karena konsensus antarpenyedia bisa berbeda.'
      : o == null
        ? 'Angka resmi belum terbaca atau belum cocok periodenya. Jangan menyebut aktual kalender sebagai angka resmi BLS/Fed.'
        : 'Angka kalender dan angka resmi berbeda skala/nilai. Cocokkan manual ke rilis BLS/Fed sebelum dipakai; kalender sekunder dapat memakai satuan berbeda.'
  };
}

/* Tabel perbandingan yang memisahkan satuan, periode, dan sumber. */
function compareRows(focus, ev, release, official) {
  const rows = [];
  const push = (o) => { if (o && (o.metric || o.actual != null || o.previous != null)) rows.push(o); };
  const e = ev || {};
  push({
    metric: focus + ' — kalender', actual: e.actual == null || e.actual === '' ? null : e.actual,
    forecast: e.forecast || null, previous: e.previous || null, change: null, revision: null,
    unit: e.unit || '', period: e.period || '', source: 'Kalender (TradingView/FairEconomy)',
    comparable: false, note: 'Konsensus kalender; belum tentu sama dengan rilis resmi.'
  });
  const releasedNow = !!(e.released && (!e.ts || e.ts <= Date.now()));
  if (official && official.ok) {
    push({
      metric: (official.label || (focus + ' — resmi')) + ' — data resmi terakhir', actual: official.value, forecast: null,
      previous: official.prev == null ? null : official.prev, change: null, revision: null,
      unit: official.unit || '', period: official.period || '', source: official.source || 'FRED',
      comparable: releasedNow,
      note: releasedNow
        ? 'Angka resmi berperiode. Revisi resmi hanya dari tabel BLS/BEA; panel ini tidak mengarangnya.'
        : 'Data resmi terakhir untuk periode ' + (official.period || '—') + '; BUKAN aktual rilis yang belum terbit.'
    });
    if (focus === 'NFP' && official.prev2 != null) push({
      metric: 'Payrolls dua bulan lalu (basis revisi)', actual: official.prev2, forecast: null,
      previous: null, change: null, revision: null,
      unit: official.unit || 'ribu', period: 'bulan ke-2 data terbit', source: official.source || 'FRED',
      comparable: true, note: 'Perubahan bulan ke-2 pada data terbit sekarang — bukan revisi resmi terhadap rilis lama.'
    });
    (official.extra || []).forEach(x => push({
      metric: x.metric, actual: x.latest, forecast: null, previous: x.previous,
      change: null, revision: null, unit: x.unit || '', period: x.period || '', source: x.source || official.source || 'FRED',
      comparable: true, note: 'Komponen resmi; satuan mengikuti baris ini.'
    }));
  }
  ((release && release.components) || []).forEach(c => push({
    metric: c.k, actual: c.ok ? c.value : null, forecast: null,
    previous: c.ok ? c.prev : null, change: c.ok ? c.change : null, revision: null,
    unit: c.unit || '', period: c.period || '', source: c.source || 'FRED',
    comparable: !!c.ok,
    note: c.ok ? (c.kind === 'yoy' ? 'YoY memakai seri NSA; jangan dicampur dengan MoM SA.' : c.kind === 'mom' ? 'MoM memakai seri SA; bukan YoY.' : 'Perubahan terhadap observasi sebelumnya, bukan revisi resmi.') : 'Belum terbaca; jangan diisi angka sendiri.'
  }));
  const units = [...new Set(rows.map(x => String(x.unit || '').trim()).filter(Boolean))];
  return {
    tag: focus, rows: rows.slice(0, 14), units,
    unitWarning: UNIT_WARNING[focus] || 'Periksa satuan dan periode sebelum membandingkan dua angka.',
    revisionNote: focus === 'NFP'
      ? 'Revisi resmi payrolls hanya terlihat dari data vintage BLS/ALFRED. Kolom "revision" di sini adalah perubahan terhadap observasi sebelumnya, bukan revisi rilis.'
      : 'Kolom "revision" adalah perubahan terhadap observasi sebelumnya. Revisi resmi harus dibaca dari tabel BLS/BEA, bukan disimpulkan dari panel.',
    note: 'Baris dengan satuan/periode berbeda tidak boleh dibandingkan langsung. Cocokkan aktual ke rilis resmi sebelum menyimpulkan arah.'
  };
}

function compOf(release, id, kind) {
  return (((release && release.components) || []).find(c => c && c.id === id && (!kind || c.kind === kind))) || null;
}

function mixedOf(focus, release, official) {
  const out = [];
  if (focus === 'CPI') {
    const h = compOf(release, 'CPIAUCSL', 'mom'), c = compOf(release, 'CPILFESL', 'mom');
    if (h && c && h.ok && c.ok && h.value != null && c.value != null && Math.sign(h.value) !== Math.sign(c.value)) {
      out.push('Headline MoM ' + h.value + '% vs core MoM ' + c.value + '% bergerak berlawanan.');
    }
    const hy = compOf(release, 'CPIAUCNS', 'yoy'), cy = compOf(release, 'CPILFENS', 'yoy');
    if (hy && cy && hy.ok && cy.ok && hy.value != null && cy.value != null && Math.sign(hy.value) !== Math.sign(cy.value)) {
      out.push('Headline YoY dan core YoY berbeda arah.');
    }
  } else if (focus === 'NFP') {
    const p = compOf(release, 'PAYEMS', 'diff'), u = compOf(release, 'UNRATE', 'level');
    if (p && u && p.ok && u.ok && p.value != null && u.change != null && ((p.value > 0 && u.change > 0) || (p.value < 0 && u.change < 0))) {
      out.push('Payrolls ' + (p.value > 0 ? 'naik' : 'turun') + ' tetapi pengangguran ' + (u.change > 0 ? 'naik' : 'turun') + ' — survei perusahaan dan rumah tangga tidak sejalan.');
    }
  } else if (focus === 'PPI') {
    const f = compOf(release, 'PPIFIS', 'mom'), g = compOf(release, 'WPSFD49207', 'mom');
    if (f && g && f.ok && g.ok && f.value != null && g.value != null && Math.sign(f.value) !== Math.sign(g.value)) {
      out.push('PPI final demand dan komponen barang bergerak berlawanan.');
    }
  } else if (focus === 'FOMC' && official && official.ok && official.prev != null) {
    const r = compOf(release, 'DFII10', 'level');
    if (Number(official.value) === Number(official.prev) && r && r.ok && r.change != null && Math.abs(r.change) >= 0.05) {
      out.push('Rate tidak berubah, tetapi yield riil bergerak ' + (r.change > 0 ? '+' : '') + r.change + ' pp — pasar menilai guidance, bukan hanya keputusan.');
    }
  }
  return out;
}

function scenarioOf(focus, ev, release, surprise, react, official) {
  const map = SCENARIO_MAP[focus] || SCENARIO_MAP.CPI;
  const dataBias = surprise ? (surprise.hot ? 'SELL' : 'BUY') : null;
  const reactionBias = react && react.dir !== 'DUA ARAH' && Math.abs(react.netPips) >= 30 ? react.dir : null;
  const mixed = mixedOf(focus, release, official);
  const pricedIn = !!(dataBias && reactionBias && dataBias !== reactionBias);
  const unconfirmed = !!(dataBias && !reactionBias);
  const inline = !!(surprise && Math.abs(Number(surprise.diff) || 0) < 0.0001);
  const state = !surprise ? 'BELUM TERBIT' : inline ? 'SESUAI KONSENSUS' : surprise.hot ? 'LEBIH PANAS' : 'LEBIH DINGIN';
  const where = !surprise
    ? 'Aktual belum terbit. Skenario: ' + map.hot + ' ' + map.cold + ' ' + map.inline
    : mixed.length
      ? 'Angka saling bertentangan (' + mixed.join(' ') + '). Arah data ' + (dataBias || '—') + ' belum bisa dipakai sendirian; tunggu reaksi yield/USD dan konfirmasi chart.'
      : pricedIn
        ? 'Data ' + (surprise.hot ? 'lebih panas' : 'lebih dingin') + ' (bias ' + dataBias + '), tetapi reaksi 15 menit ' + reactionBias + ' berlawanan. Kemungkinan sudah priced in, ada safe-haven, atau pasar membaca detail lain. Jangan memaksa arah data; ikuti reaksi terukur dan tunggu konfirmasi.'
        : unconfirmed
          ? 'Data ' + (surprise.hot ? 'lebih panas' : 'lebih dingin') + ' memberi bias ' + dataBias + ', tetapi reaksi 15 menit belum ≥30 pip. Arah belum terkonfirmasi; tunggu candle M5 close dan yield/USD.'
          : 'Data ' + (surprise.hot ? 'lebih panas' : 'lebih dingin') + ' dan reaksi 15 menit ' + (reactionBias || '—') + ' searah → skenario ' + dataBias + ' lebih kuat. Tetap cek yield/USD; satu indikator tidak cukup.';
  return {
    tag: focus, state, dataBias, reactionBias, mixed, pricedIn, unconfirmed, inline,
    focus: map.focus, where, watch: map.watch, invalidation: map.invalidation,
    branches: [
      { name: 'Lebih panas / kuat', if: 'Aktual > konsensus (setelah satuan & periode cocok)', then: map.hot, gold: 'SELL', confirm: 'DXY/yield naik; XAUUSD gagal bertahan di high.' },
      { name: 'Lebih dingin / lemah', if: 'Aktual < konsensus', then: map.cold, gold: 'BUY', confirm: 'DXY/yield turun; XAUUSD bertahan di atas low.' },
      { name: 'Sesuai konsensus', if: 'Aktual = konsensus', then: map.inline, gold: 'NETRAL', confirm: 'Tunggu reaksi 15 menit; jangan paksa entry.' },
      { name: 'Bertentangan / priced in', if: 'Komponen saling bertentangan, atau reaksi berlawanan dengan arah data', then: map.conflict + ' ' + (pricedIn ? 'Reaksi nyata berlawanan dengan bias data.' : ''), gold: 'IKUTI REAKSI', confirm: 'Yield nominal/riil dan DXY harus searah reaksi.' }
    ],
    note: 'Skenario awal, bukan hukum harga. Data kuat dapat menekan emas lewat yield/USD, tetapi angka yang bertentangan, sudah priced in, atau safe-haven dapat membalik respons. Baca news untuk skenario, chart untuk lokasi dan pemicu.'
  };
}

function playbookOf(focus, ev, compare, scenario, audit) {
  return {
    tag: focus, scenario, compare, audit,
    unitRule: UNIT_WARNING[focus] || '',
    calendarRule: 'Catat kalender yang dipakai (' + audit.used + '). Konsensus antarpenyedia dapat berbeda; cocokkan actual dengan rilis resmi BLS/Fed sebelum menyimpulkan arah.',
    checklist: [
      { k: 'Actual vs Forecast/Consensus', ok: !!(ev && (ev.actual || ev.actualOfficial) && ev.forecast), d: ev && ev.forecast ? 'Konsensus ' + ev.forecast + (ev.unit ? ' ' + ev.unit : '') + (ev.actual || ev.actualOfficial ? '; aktual ' + (ev.actual || ev.actualOfficial) : '; aktual belum terbit') : 'Konsensus belum terbaca' },
      { k: 'Previous & revisi', ok: !!(ev && (ev.previous || (compare.rows || []).some(r => r.change != null))), d: compare.revisionNote },
      { k: 'Satuan & periode cocok', ok: !!(compare.rows || []).every(r => !r.comparable || r.unit || r.period), d: compare.unitWarning },
      { k: 'Kalender vs angka resmi', ok: !!audit.matched, d: audit.note },
      { k: 'Reaksi pasar dikonfirmasi', ok: !!(scenario.reactionBias || scenario.state === 'BELUM TERBIT'), d: scenario.where }
    ],
    sources: {
      primary: SOURCE_MATRIX.primary,
      secondary: SOURCE_MATRIX.secondary,
      context: focus === 'NFP' ? SOURCE_MATRIX.nfpContext : [],
      youtube: SOURCE_MATRIX.youtube[focus] || [],
      youtubeNote: SOURCE_MATRIX.youtubeNote
    },
    reference: refFor(focus),
    entryRule: 'Setelah rilis: tunggu candle M5 pertama close dan spread normal. Entry hanya LIMIT di POI dengan CHoCH/BOS M5 searah; SL 30 pip; TP2 minimal 200 pip ke likuiditas berikutnya. Jangan mengejar candle pertama.',
    coreRule: 'Baca news untuk membuat skenario, bukan menebak arah pasti; baca chart untuk lokasi dan pemicu, bukan sekadar label zona.'
  };
}

/* Seri FRED per rilis. kind: level | mom | yoy | diff. diff dipakai untuk
   payrolls karena PAYEMS sudah dalam satuan ribu, sehingga selisihnya adalah
   perubahan bulanan dalam ribu. */
const SERIES_GUIDE = {
  NFP: [
    ['PAYEMS', 'Payrolls non-farm', 'ribu', 'diff'],
    ['PAYEMS', 'Payrolls dua bulan lalu (basis revisi)', 'ribu', 'diff2'],
    ['USPRIV', 'Payrolls swasta', 'ribu', 'diff'],
    ['UNRATE', 'Tingkat pengangguran', '%', 'level'],
    ['CES0500000003', 'Upah per jam (AHE)', '% MoM', 'mom'],
    ['AWHAETP', 'Jam kerja mingguan', 'jam', 'level'],
    ['JTSJOL', 'JOLTS lowongan kerja', 'ribu', 'level'],
    ['ICSA', 'Klaim pengangguran awal', 'ribu', 'level', 1000],
    ['ADPMNUSNERSA', 'ADP employment swasta', 'ribu', 'diff', 1000]
  ],
  CPI: [
    /* YoY resmi memakai seri NSA (CPIAUCNS/CPILFENS); MoM resmi memakai seri
       SA (CPIAUCSL/CPILFESL). Mencampur keduanya membuat angka tidak sama
       dengan rilis BLS. */
    ['CPIAUCNS', 'CPI headline', '% YoY (NSA)', 'yoy'],
    ['CPIAUCSL', 'CPI headline', '% MoM (SA)', 'mom'],
    ['CPILFENS', 'CPI core', '% YoY (NSA)', 'yoy'],
    ['CPILFESL', 'CPI core', '% MoM (SA)', 'mom'],
    ['CUUR0000SAH1', 'Shelter', '% YoY (NSA)', 'yoy'],
    ['CPIENGNS', 'Energi', '% YoY (NSA)', 'yoy'],
    ['CUUR0000SASLE', 'Jasa', '% YoY (NSA)', 'yoy']
  ],
  PPI: [
    ['PPIFIS', 'PPI final demand', '% MoM', 'mom'],
    ['PPIFIS', 'PPI final demand', '% YoY', 'yoy'],
    ['WPSFD49207', 'PPI final demand — barang jadi', '% MoM', 'mom'],
    ['WPSFD49207', 'PPI final demand — barang jadi', '% YoY', 'yoy']
  ],
  FOMC: [
    ['DFEDTARU', 'Fed funds target atas', '%', 'level'],
    ['DFEDTARL', 'Fed funds target bawah', '%', 'level'],
    ['DFII10', 'Yield riil 10Y', '%', 'level'],
    ['DGS10', 'Yield Treasury 10Y', '%', 'level'],
    ['T10YIE', 'Breakeven inflasi 10Y', '%', 'level']
  ]
};

function seriesCalc(rows, kind, div) {
  const n = Array.isArray(rows) ? rows.length : 0;
  if (n < 2) return null;
  const v = i => (rows[i] && isFinite(Number(rows[i].v)) ? Number(rows[i].v) : null);
  const last = v(n - 1), prev = v(n - 2);
  if (last == null || prev == null) return null;
  const d = Number(div) > 0 ? Number(div) : 1;
  const out = (o) => {
    if (d !== 1) {
      if (o.value != null) o.value = P(o.value / d);
      if (o.prev != null) o.prev = P(o.prev / d);
      if (o.change != null) o.change = P(o.change / d);
    }
    return o;
  };
  if (kind === 'level') return out({ value: P(last), prev: P(prev), change: P(last - prev), period: rows[n - 1].d });
  if (kind === 'diff') {
    const p2 = n >= 3 ? v(n - 3) : null;
    return out({ value: P(last - prev), prev: p2 == null ? null : P(prev - p2), change: p2 == null ? null : P((last - prev) - (prev - p2)), period: rows[n - 1].d });
  }
  if (kind === 'diff2') {
    const p2 = n >= 3 ? v(n - 3) : null, p3 = n >= 4 ? v(n - 4) : null;
    if (p2 == null) return null;
    return out({ value: P(prev - p2), prev: p3 == null ? null : P(p2 - p3), change: null, period: rows[n - 2].d });
  }
  if (kind === 'mom') {
    const p2 = n >= 3 ? v(n - 3) : null;
    if (!prev || !last) return null;
    return out({ value: P((last / prev - 1) * 100), prev: p2 && prev ? P((prev / p2 - 1) * 100) : null, change: null, period: rows[n - 1].d });
  }
  if (kind === 'yoy') {
    const base = n >= 13 ? v(n - 13) : null;
    const basePrev = n >= 14 ? v(n - 14) : null;
    if (!base || !basePrev || !last || !prev) return null;
    return out({ value: P((last / base - 1) * 100), prev: P((prev / basePrev - 1) * 100), change: null, period: rows[n - 1].d });
  }
  return null;
}

/* Checklist komponen rilis, proxy pra-rilis, dan respons pasar. Semua baris
   membawa status ok/gagal secara eksplisit supaya panel tidak pernah tampak
   lengkap padahal seri resminya tidak terbaca. */
async function releaseOf(tag, ev, board) {
  const specs = SERIES_GUIDE[tag] || [];
  const ids = [...new Set(specs.map(x => x[0]))];
  const settled = await Promise.allSettled(ids.map(id => C.fred(id)));
  const data = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.rows) && r.value.rows.length >= 2) data[ids[i]] = r.value;
  });
  const components = specs.map(([id, k, unit, kind, div]) => {
    const c = data[id] ? seriesCalc(data[id].rows, kind, div) : null;
    return {
      id, k, unit, kind,
      value: c ? c.value : null, prev: c ? c.prev : null, change: c ? c.change : null,
      period: c ? c.period : null, source: 'FRED · ' + id, ok: !!c
    };
  });
  const pick = (id, unit) => components.find(c => c.id === id && (!unit || c.unit === unit)) || null;
  const pre = [];
  const addPre = (k, c, note) => pre.push({
    k, ok: !!(c && c.ok), source: c && c.ok ? c.source : '—',
    d: c && c.ok ? c.value + (c.unit || '') + ' · periode ' + c.period + ' — ' + note : 'belum terbaca dari feed; cek sumber resmi. ' + note
  });
  if (tag === 'NFP') {
    addPre('JOLTS lowongan kerja', pick('JTSJOL'), 'Petunjuk permintaan tenaga kerja; bukan pengganti NFP dan bukan prediksi pasti.');
    addPre('Klaim pengangguran mingguan', pick('ICSA'), 'Petunjuk awal pasar kerja; mingguan dan bisa berisik.');
    addPre('ADP employment swasta', pick('ADPMNUSNERSA'), 'Pembanding swasta; metodologi berbeda dari BLS dan sering tidak sejalan.');
    pre.push({ k: 'Rincian sektor pekerjaan', ok: true, source: SRC.blsEmp[0], manual: true, url: SRC.blsEmp[1], d: 'Sektor barang/jasa, pemerintah, dan rincian industri ada di tabel Employment Situation BLS; panel hanya menghitung payrolls total dan swasta.' });
    pre.push({ k: 'Komponen Employment PMI/ISM', ok: true, source: 'ISM PMI Reports', manual: true, url: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/', d: 'Konteks permintaan tenaga kerja dari PMI; bukan NFP dan tidak boleh dianggap prediksi pasti.' });
    const rev = components.find(c => c.id === 'PAYEMS' && c.kind === 'diff2') || null;
    pre.push({ k: 'Revisi dua bulan sebelumnya', ok: !!(rev && rev.ok), source: SRC.blsEmp[0], manual: true, url: SRC.blsEmp[1], d: 'Revisi resmi hanya terlihat dari data vintage BLS/ALFRED; baris “dua bulan lalu” di atas adalah perubahan bulan ke-2 pada data terbit sekarang, bukan revisi.' });
  } else if (tag === 'CPI') {
    addPre('Riwayat shelter', pick('CUUR0000SAH1'), 'Shelter adalah komponen besar dan bergerak lambat; gunakan sebagai konteks, bukan tebakan seluruh CPI.');
    addPre('Harga energi', pick('CUSR0000SA0E'), 'Energi dapat menjelaskan sebagian CPI, tetapi tidak cukup untuk menebak seluruh CPI.');
    pre.push({ k: 'Sebaran kenaikan (breadth)', ok: true, source: SRC.blsCpi[0], manual: true, url: SRC.blsCpi[1], d: 'Periksa apakah kenaikan tersebar di banyak komponen atau hanya shelter/energi. Breadth hanya ada di tabel rinci BLS, tidak dihitung dari satu seri FRED.' });
    pre.push({ k: 'Tabel komponen resmi BLS', ok: true, source: SRC.blsCpi[0], manual: true, url: SRC.blsCpi[1], d: 'Buka tabel komponen CPI BLS untuk rincian shelter/jasa dan revisi; panel ini memakai seri FRED sebagai ringkasan.' });
  } else if (tag === 'PPI') {
    addPre('PPI final demand', pick('PPIFIS', '% MoM'), 'Ukuran utama rilis PPI; cek juga komponen barang/jasa.');
    addPre('PPI final demand — barang jadi', pick('WPSFD49207', '% MoM'), 'Komponen barang jadi; bisa bergerak berbeda dari jasa.');
    pre.push({ k: 'Tabel PPI final demand & komponen jasa', ok: true, source: SRC.blsPpi[0], manual: true, url: SRC.blsPpi[1], d: 'Rincian jasa final demand dan revisi hanya ada di tabel BLS; feed FRED yang dipakai tidak memisahkan jasa.' });
    pre.push({ k: 'Kalender rilis PPI', ok: !!(ev && (ev.when || ev.derived)), source: SRC.blsCal[0], d: ev && ev.when ? 'Jadwal fokus: ' + ev.when : 'Jadwal belum terbaca; cek kalender BLS.' });
  } else {
    addPre('Yield riil 10Y', pick('DFII10'), 'Yield riil adalah kanal utama kebijakan Fed ke emas.');
    addPre('Yield nominal 10Y', pick('DGS10'), 'Konfirmasi arah yield setelah statement/konferensi pers.');
    pre.push({ k: 'Statement, SEP/dot plot, konferensi pers', ok: true, source: SRC.fed[0], manual: true, url: SRC.fed[1], d: 'Baca perubahan dari rapat sebelumnya: kalimat statement, proyeksi/SEP dan dot plot bila terbit, lalu nada konferensi pers. Teks ini tidak diambil otomatis oleh panel.' });
    pre.push({ k: 'Probabilitas CME FedWatch', ok: false, source: SRC.fedWatch[0], manual: true, url: SRC.fedWatch[1], d: 'Probabilitas tersirat tidak tersedia dari API publik; buka CME FedWatch dan bandingkan dengan 1 minggu/1 bulan sebelumnya. Ini bukan jaminan keputusan Fed.' });
  }
  const guide = RELEASE_GUIDE[tag] || RELEASE_GUIDE.CPI;
  const okN = components.filter(c => c.ok).length;
  return {
    tag, guide, components, pre,
    coverage: { ok: okN, total: components.length, pct: components.length ? Math.round(okN / components.length * 100) : 0 },
    delayed: components.filter(c => !c.ok).map(c => c.k),
    sources: guide.sources,
    note: 'Checklist ini hanya membaca komponen rilis ' + tag + '. Angka dari FRED/BLS; komponen yang tidak terbaca ditandai, bukan dikarang.'
  };
}

/* Respons pasar setelah rilis: XAUUSD, DXY, yield nominal, yield riil.
   Korelasi bisa berubah, jadi status konfirmasi hanya konteks keyakinan. */
function watchOf(d, board, ev, dir) {
  const m5 = (d && d.m5 && d.m5.rows) || [];
  const d1 = (d && d.d1 && d.d1.rows) || [];
  const dxy = (d && d.dxyTv && d.dxyTv.rows) || (d && d.dxy && d.dxy.rows) || [];
  const tnx = (d && d.us10Tv && d.us10Tv.rows) || (d && d.tnx && d.tnx.rows) || [];
  const item = id => ((board && board.items) || []).find(x => x && x.id === id) || null;
  const pct = (rows, n) => rows.length > n && rows[rows.length - 1 - n].c ? P((rows[rows.length - 1].c / rows[rows.length - 1 - n].c - 1) * 100) : null;
  const gold1h = m5.length > 13 ? Math.round((m5[m5.length - 1].c - m5[m5.length - 13].c) / 0.1) : null;
  const gold1d = d1.length > 1 ? P((d1[d1.length - 1].c / d1[d1.length - 2].c - 1) * 100) : null;
  const dxy1h = pct(dxy, 4);
  const dxy5d = pct(dxy, Math.max(1, Math.min(dxy.length - 1, dxy.length > 80 ? 5 : 4)));
  const us1h = tnx.length > 4 ? P(tnx[tnx.length - 1].c - tnx[tnx.length - 5].c) : null;
  const us5d = tnx.length > 5 ? P(tnx[tnx.length - 1].c - tnx[tnx.length - 6].c) : null;
  const real = item('DFII10'), be = item('T10YIE');
  const lastT = m5.length ? Number(m5[m5.length - 1].t) : null;
  const ageMin = lastT ? Math.round((Date.now() - lastT) / 60000) : null;
  const stale = ageMin == null || ageMin > 20;
  const sign = dir === 'BUY' ? 1 : dir === 'SELL' ? -1 : 0;
  let support = 0, oppose = 0;
  const vote = (v, good, bad) => { const n = Number(v); if (!isFinite(n) || Math.abs(n) < 0.01) return; if (n * sign > 0) support++; else oppose++; };
  if (sign) {
    if (gold1h != null) vote(gold1h, 1, 1);
    if (dxy1h != null) vote(-dxy1h, 1, 1);
    if (us1h != null) vote(-us1h, 1, 1);
    if (real && real.chg5 != null) vote(-real.chg5, 1, 1);
  }
  const state = stale ? 'DATA TERTUNDA' : !sign ? 'BELUM CUKUP' : (support + oppose) === 0 ? 'BELUM CUKUP' : support > oppose ? 'MENDUKUNG' : oppose > support ? 'MELAWAN' : 'CAMPURAN';
  return {
    ok: gold1h != null || dxy1h != null || us1h != null || !!(real && real.value != null),
    at: new Date().toISOString(), dir: dir || null, state,
    candleAgeMin: ageMin, stale,
    gold: { h1Pips: gold1h, d1Pct: gold1d },
    dxy: { h1Pct: dxy1h, d5Pct: dxy5d },
    us10: { h1Pp: us1h, d5Pp: us5d },
    real: real ? { value: real.value, chg5: real.chg5, date: real.date, source: real.source } : null,
    breakeven: be ? { value: be.value, chg5: be.chg5, date: be.date, source: be.source } : null,
    support, oppose,
    note: (stale ? 'Candle M5 terakhir ' + (ageMin == null ? 'tidak terbaca' : ageMin + ' menit lalu') + '; angka 1 jam di bawah adalah jam terakhir sebelum data berhenti, bukan respons live. ' : '') + 'Respons pasar: emas 1 jam ' + (gold1h == null ? '—' : (gold1h > 0 ? '+' : '') + gold1h + ' pip') + ' · DXY 1 jam ' + (dxy1h == null ? '—' : (dxy1h > 0 ? '+' : '') + dxy1h + '%') + ' · yield 10Y 1 jam ' + (us1h == null ? '—' : (us1h > 0 ? '+' : '') + us1h + ' pp') + ' · yield riil 5 observasi ' + (real && real.chg5 != null ? (real.chg5 > 0 ? '+' : '') + real.chg5 + ' pp' : '—') + '. Korelasi emas dengan yield/dolar bisa berubah; jangan mengandalkan satu indikator.'
  };
}

const BASE_PIPS = { NFP: 260, CPI: 230, PPI: 175, FOMC: 360 };
const UNIT = { NFP: 75, CPI: 0.15, PPI: 0.15, FOMC: 0.25 };
const P = C.r2;

function aiJson(text) {
  try {
    return C.parseJsonInfo ? C.parseJsonInfo(text) : { value: C.parseJson(text), repaired: false, error: '' };
  } catch (e) {
    return { value: null, repaired: false, error: C.cut(e && e.message || e, 120) };
  }
}

const HEAD_SCORE = (tag, t) => {
  const s = String(t || '');
  if (tag === 'NFP') return /^non[ -]?farm payrolls$/i.test(s) ? 3 : /payroll/i.test(s) && !/private|government|manufactur/i.test(s) ? 1 : 0;
  if (tag === 'CPI') return /cleveland|philly|regional|ny fed/i.test(s) ? 0 : /^cpi$/i.test(s) ? 3 : /^cpi (mom|m\/m|yoy|y\/y)$/i.test(s) ? 3 : /cpi|consumer price index/i.test(s) ? (/core/i.test(s) ? 1 : 2) : 0;
  if (tag === 'PPI') return /^ppi mo(m)?$/i.test(s) ? 3 : /^ppi yoy$/i.test(s) ? 2 : /ppi|producer price/i.test(s) ? (/core|ex food/i.test(s) ? 1 : 1.5) : 0;
  return /^interest rate$/i.test(s) || /(interest rate decision|fomc statement)/i.test(s) ? 3 : /fomc|federal funds/i.test(s) ? 1 : 0;
};

function eventOf(cal, tag, official) {
  const now = Date.now();
  let list = cal.filter(e => e.tag === tag && HEAD_SCORE(tag, e.title) > 0);
  if (!list.length) list = cal.filter(e => e.tag === tag);
  const max = Math.max(...list.map(e => HEAD_SCORE(tag, e.title)));
  if (isFinite(max)) list = list.filter(e => HEAD_SCORE(tag, e.title) === max);
  const releasedList = list.filter(e => e.ts <= now).sort((a, b) => b.ts - a.ts);
  const nextList = list.filter(e => e.ts > now).sort((a, b) => a.ts - b.ts);
  const latest = releasedList[0] || null;
  const previous = releasedList[1] || null;
  const next = nextList[0] || null;
  /* Rilis yang baru lewat 48 jam tetap menjadi fokus (datanya sudah nyata).
     Jika tidak ada rilis terbaru, pakai jadwal berikutnya tetapi JANGAN
     menganggap angka rilis lama sebagai aktual jadwal berikutnya. */
  let cand = null;
  if (latest && now - latest.ts <= 48 * 3600000) cand = { ...latest, released: true };
  else if (next) cand = { ...next, released: false };
  else if (latest) cand = { ...latest, released: true };
  if (cand) return {
    ...cand,
    lastRelease: latest ? { ...latest, released: true } : null,
    previousRelease: previous ? { ...previous, released: true } : null,
    nextRelease: next ? { ...next, released: false } : null
  };
  /* Kalender dua minggu tidak memuat rilis ini (mis. NFP awal bulan depan).
     Jangan mengarang tanggal: pakai DATA TERAKHIR dari FRED dan beri label
     periode resminya. Reaksi candle tidak dihitung karena jendelanya lewat. */
  if (official && official.ok) {
    return {
      tag, title: NAME[tag] + ' — data terakhir', ts: null, derived: true, released: true,
      forecast: '', previous: official.prev == null ? '' : String(official.prev), actual: '',
      actualOfficial: official.value, verified: 'fred', period: official.period, impact: 'High'
    };
  }
  return null;
}

function officialActual(tag) {
  return C.memo('official:' + tag, 900000, async () => {
    try {
      if (tag === 'NFP') {
        const [pay, un] = await Promise.all([C.fred('PAYEMS'), C.fred('UNRATE').catch(() => null)]);
        const r = pay.rows, n = r.length;
        const d = i => (i >= 1 ? Math.round((r[n - i].v - r[n - i - 1].v) * 10) / 10 : null);
        return {
          ok: true, label: 'Perubahan payrolls (FRED PAYEMS)', value: d(1), prev: d(2), prev2: d(3),
          period: r[n - 1].d, unit: 'ribu', source: 'FRED · PAYEMS',
          extra: un ? [{ metric: 'Unemployment rate', latest: un.last.v + '%', previous: un.prev.v + '%', period: un.last.d, source: 'FRED · UNRATE' }] : []
        };
      }
      if (tag === 'CPI') {
        const [cpi, core] = await Promise.all([C.fred('CPIAUCSL'), C.fred('CPILFESL').catch(() => null)]);
        const rows = cpi.rows, n = rows.length;
        const mom = i => (i >= 1 && rows[n - i - 1].v ? Math.round((rows[n - i].v / rows[n - i - 1].v - 1) * 10000) / 100 : null);
        const yoy = i => (n - i - 12 >= 0 && rows[n - i - 12].v ? Math.round((rows[n - i].v / rows[n - i - 12].v - 1) * 10000) / 100 : null);
        const crows = core ? core.rows : [], cn = crows.length;
        const cyoy = cn > 12 ? Math.round((crows[cn - 1].v / crows[cn - 13].v - 1) * 10000) / 100 : null;
        return {
          ok: true, label: 'CPI (FRED CPIAUCSL)', value: yoy(1), prev: yoy(2), unit: '% YoY', period: rows[n - 1].d, source: 'FRED · CPIAUCSL',
          extra: [
            { metric: 'CPI MoM', latest: mom(1), previous: mom(2), unit: '%', period: rows[n - 1].d, source: 'FRED · CPIAUCSL' },
            ...(cyoy == null ? [] : [{ metric: 'Core CPI YoY', latest: cyoy, unit: '%', period: crows[cn - 1].d, source: 'FRED · CPILFESL' }])
          ]
        };
      }
      if (tag === 'PPI') {
        /* Hanya PPI final demand (WPSFD4). Jangan fallback ke PPIACO:
           itu indeks semua komoditas, metriknya berbeda dari rilis PPI. */
        const ppi = await C.fred('WPSFD4');
        const rows = ppi.rows, n = rows.length;
        const mom = i => (n - i - 1 >= 0 && rows[n - i - 1].v ? Math.round((rows[n - i].v / rows[n - i - 1].v - 1) * 10000) / 100 : null);
        const yoy = i => (n - i - 12 >= 0 && rows[n - i - 12].v ? Math.round((rows[n - i].v / rows[n - i - 12].v - 1) * 10000) / 100 : null);
        return {
          ok: true, label: 'PPI final demand MoM (FRED ' + ppi.id + ')', value: mom(1), prev: mom(2), unit: '% MoM', period: rows[n - 1].d, source: 'FRED · ' + ppi.id,
          extra: [{ metric: 'PPI YoY', latest: yoy(1), previous: yoy(2), unit: '%', period: rows[n - 1].d, source: 'FRED · ' + ppi.id }]
        };
      }
      const [up, low] = await Promise.all([C.fred('DFEDTARU'), C.fred('DFEDTARL').catch(() => null)]);
      return {
        ok: true, label: 'Fed funds target (upper)', value: up.last.v, prev: up.prev.v, unit: '%', period: up.last.d, source: 'FRED · DFEDTARU',
        extra: low ? [{ metric: 'Fed funds target (lower)', latest: low.last.v, previous: low.prev.v, unit: '%', period: low.last.d, source: 'FRED · DFEDTARL' }] : []
      };
    } catch (e) { return { ok: false, error: C.cut(e && e.message || e, 140) }; }
  });
}

function parseNum(s) { const m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; }

function reactionOf(ev, m5, m15) {
  if (!ev || !ev.ts || ev.ts > Date.now()) return null;
  if (Date.now() - ev.ts > 24 * 3600000) return null; // reaksi hanya dihitung maksimal 24 jam setelah rilis
  const m5ok = Array.isArray(m5) && m5.length > 12 && m5[0].t <= ev.ts;
  const rows = m5ok ? m5 : (Array.isArray(m15) ? m15 : []);
  /* Bar yang dibuka tepat pada detik rilis Sudah memuat pergerakan pasca-
     rilis, jadi masuk ke jendela post. Bar sebelumnya adalah anchor. */
  const pre = rows.filter(r => r.t < ev.ts), post = rows.filter(r => r.t >= ev.ts);
  if (!pre.length || post.length < 2) return null;
  const anchor = pre[pre.length - 1].c;
  /* Hanya jendela reaksi 45 menit setelah rilis. Jangan memakai drift harga
     berjam-jam kemudian sebagai "reaksi berita" — itu sumber arah keliru. */
  const win = post.filter(r => r.t <= ev.ts + 45 * 60000);
  if (win.length < 2) return null;
  const w = win;
  /* Arah berita dinilai dari reaksi pendek 15 menit lebih dulu; 45 menit
     tetap disimpan sebagai konteks spike. */
  const w15 = w.filter(r => r.t <= ev.ts + 15 * 60000);
  const last = w[w.length - 1].c;
  if (!(anchor > 0) || !(last > 0)) return null;
  const last15 = (w15.length >= 2 ? w15[w15.length - 1] : w[w.length - 1]).c;
  const netPips = Math.round((last15 - anchor) / 0.1);
  const net45Pips = Math.round((last - anchor) / 0.1);
  /* Jaring pengaman: reaksi XAUUSD dalam 45 menit tidak masuk akal melebihi
     10.000 pip (1.000 USD). Kalau terjadi, data candle rusak -> jangan klaim. */
  if (!isFinite(netPips) || Math.abs(netPips) > 10000) return null;
  const firstBars = post.slice(0, 3);
  const firstPips = Math.round((firstBars[firstBars.length - 1].c - anchor) / 0.1);
  const hi = Math.max(...w.map(r => r.h)), lo = Math.min(...w.map(r => r.l));
  if (!(hi > 0) || !(lo > 0) || !isFinite(hi) || !isFinite(lo)) return null;
  return {
    tag: ev.tag, releasedAt: new Date(ev.ts).toISOString(), agoMin: Math.round((Date.now() - ev.ts) / 60000),
    anchor: P(anchor), last: P(last), last15: P(last15), netPips, net45Pips, firstPips,
    rangePips: Math.round((hi - lo) / 0.1), upPips: Math.round((hi - anchor) / 0.1), downPips: Math.round((anchor - lo) / 0.1),
    dir: Math.abs(netPips) < 12 ? 'DUA ARAH' : netPips > 0 ? 'BUY' : 'SELL',
    dir45: Math.abs(net45Pips) < 12 ? 'DUA ARAH' : net45Pips > 0 ? 'BUY' : 'SELL',
    firstDir: Math.abs(firstPips) < 12 ? 'DUA ARAH' : firstPips > 0 ? 'BUY' : 'SELL',
    windowMin: 15, bar: m5ok ? 'M5' : 'M15', source: 'candle live mesin'
  };
}

function marketContext(d, tv) {
  const pct = (a, b) => (b ? Math.round((a / b - 1) * 10000) / 100 : null);
  const g = d.d1 ? d.d1.rows.map(r => r.c) : [];
  const dxy = d.dxy ? d.dxy.rows.map(r => r.c) : [];
  const tnx = d.tnx ? d.tnx.rows.map(r => r.c) : [];
  return {
    gold1d: g.length > 1 ? pct(g[g.length - 1], g[g.length - 2]) : null,
    gold5d: g.length > 5 ? pct(g[g.length - 1], g[g.length - 6]) : null,
    dxy5d: dxy.length > 5 ? pct(dxy[dxy.length - 1], dxy[dxy.length - 6]) : null,
    yield10_5d: tnx.length > 5 ? Math.round((tnx[tnx.length - 1] - tnx[tnx.length - 6]) * 100) / 100 : null,
    tv: tv && tv.ok ? { bias: tv.biasLabel, strength: tv.strength, weighted: tv.weighted, price: tv.price, at: new Date(tv.at).toISOString(), symbol: tv.symbol } : null,
    candle: d.m5 ? { source: d.m5.source || d.source, at: d.m5.last ? new Date(d.m5.last.t).toISOString() : null, last: d.m5.last ? d.m5.last.c : null } : null
  };
}

/* Rilis pers resmi: Federal Reserve & BLS. Konteks tambahan, bukan pengganti angka. */
const OFFICIAL_FEEDS = [
  ['Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml'],
  ['BLS', 'https://www.bls.gov/feed/bls_latest.rss'],
  ['BEA', 'https://apps.bea.gov/rss/rss.xml'],
  ['US Treasury', 'https://home.treasury.gov/rss/press.xml']
];
const officialNews = (focus) => C.memo('offnews:' + focus, 180000, async () => {
  const key = focus === 'FOMC' ? /fomc|federal|rate|monetary|statement|powell/i
    : focus === 'NFP' ? /payroll|employment|job|unemployment|labou?r/i
      : focus === 'CPI' ? /consumer price|inflation|cpi/i : /producer price|ppi|wholesale/i;
  const all = [];
  for (const [src, url] of OFFICIAL_FEEDS) {
    try {
      const xml = await C.get(url, { text: true, timeout: 12000 });
      C.rssItems(xml).slice(0, 20).forEach(x => {
        const at = x.at && isFinite(x.at.getTime()) ? x.at : null;
        all.push({ title: x.title, url: x.url, source: src, at: at ? at.toISOString() : null, ageH: at ? Math.round((Date.now() - at.getTime()) / 3600000) : null });
      });
    } catch (e) { }
  }
  const rel = all.filter(x => key.test(x.title)).sort((a, b) => (a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH));
  const items = (rel.length ? rel : all).slice(0, 6);
  return { ok: items.length > 0, items, at: new Date().toISOString() };
});

function marketScore(d, tv) {
  let score = 0;
  const ev = [];
  const add = (w, why) => { const n = Number(w); if (!isFinite(n) || Math.abs(n) < 0.05) return; score += n; ev.push({ w: Math.round(n * 100) / 100, why }); };
  if (d.d1) {
    const c = d.d1.rows.map(r => r.c), last = c[c.length - 1], p1 = c[c.length - 2];
    const chg1 = p1 ? (last / p1 - 1) * 100 : null, chg5 = c.length > 5 ? (last / c[c.length - 6] - 1) * 100 : null;
    const s20 = C.sma(c, 20), s50 = C.sma(c, 50);
    if (chg1 != null) add(C.clip(chg1 * 0.5, -1.2, 1.2), 'Emas 1 hari ' + (chg1 > 0 ? '+' : '') + P(chg1) + '%');
    if (chg5 != null) add(C.clip(chg5 * 0.8, -2, 2), 'Emas 5 hari ' + (chg5 > 0 ? '+' : '') + P(chg5) + '%');
    if (s20 && s50) add(last > s20 && s20 > s50 ? 0.6 : last < s20 && s20 < s50 ? -0.6 : 0, 'Tren harian emas (SMA20 vs SMA50)');
  }
  if (d.dxy) {
    const c = d.dxy.rows.map(r => r.c), last = c[c.length - 1], p5 = c.length > 5 ? c[c.length - 6] : null;
    if (p5) { const chg = (last / p5 - 1) * 100; add(C.clip(-chg * 0.9, -1.8, 1.8), 'DXY 5 hari ' + (chg > 0 ? '+' : '') + P(chg) + '%'); }
  }
  if (d.tnx) {
    const c = d.tnx.rows.map(r => r.c), last = c[c.length - 1], p5 = c.length > 5 ? c[c.length - 6] : null;
    if (p5) { const dpp = last - p5; add(C.clip(-dpp * 3, -1.6, 1.6), 'Yield 10Y 5 hari ' + (dpp > 0 ? '+' : '') + P(dpp) + 'pp'); }
  }
  if (tv && tv.ok) add(C.clip(tv.weighted * 2.2, -2, 2), 'TradingView gabungan ' + tv.biasLabel + ' (' + tv.strength + '%)');
  return { score: Math.round(score * 100) / 100, evidence: ev.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)) };
}

/* Fundamental global XAUUSD untuk horizon berita: wire emas/USD, FRED
   (yield riil, dolar broad, breakeven), dan perubahan 1 jam DXY/yield/emas.
   Skor ini hanya dipakai pra-rilis; saat rilis sudah terbit, aktual vs
   konsensus + reaksi nyata tetap menjadi arah utama. */
function fundamentalOf(wire, board, d, tv, cal) {
  const rows5 = (d.m5 && d.m5.rows) || [];
  const pctChg = (rows, n) => rows && rows.length > n ? (rows[rows.length - 1].c / rows[rows.length - 1 - n].c - 1) * 100 : null;
  const item = (id) => ((board && board.items) || []).find(x => x && x.id === id) || null;
  const real = item('DFII10'), broad = item('DTWEXBGS'), be = item('T10YIE');
  let score = 0;
  const ev = [];
  const add = (w, why) => {
    const n = Number(w);
    if (!isFinite(n) || Math.abs(n) < .05) return;
    score += n;
    ev.push({ w: P(n), why });
  };
  const tone = wire && wire.ok ? wire.tone : null;
  if (tone) add(C.clip(tone.score / 24, -1.3, 1.3), 'Wire emas/USD: ' + tone.note + (wire.coverage ? ' (' + wire.coverage.items + ' judul, ' + wire.coverage.distinctSources + ' sumber, ' + wire.coverage.fresh24h + ' dalam 24 jam).' : ''));
  if (real && real.chg5 != null) add(C.clip(-real.chg5 * 6, -1.1, 1.1), 'Yield riil 10Y FRED ' + (real.chg5 > 0 ? '+' : '') + real.chg5 + ' pp (5 observasi ' + real.date + '); yield riil naik menekan emas.');
  if (broad && broad.chg5 != null) add(C.clip(-broad.chg5 * 1.2, -1.0, 1.0), 'Dollar broad index FRED ' + (broad.chg5 > 0 ? '+' : '') + broad.chg5 + ' poin (5 observasi ' + broad.date + '); dolar menguat menekan emas.');
  if (be && be.chg5 != null) add(C.clip(be.chg5 * 2.2, -0.7, 0.7), 'Breakeven inflasi 10Y FRED ' + (be.chg5 > 0 ? '+' : '') + be.chg5 + ' pp (5 observasi ' + be.date + '); ekspektasi inflasi naik mendukung emas.');
  const dxy1h = pctChg(d.dxyTv && d.dxyTv.rows, 4);
  const y1h = d.us10Tv && d.us10Tv.rows.length > 4 ? P(d.us10Tv.rows[d.us10Tv.rows.length - 1].c - d.us10Tv.rows[d.us10Tv.rows.length - 5].c) : null;
  const gold1hPips = rows5.length > 12 ? Math.round((rows5[rows5.length - 1].c - rows5[rows5.length - 13].c) / 0.1) : null;
  const tsOf = (x) => isFinite(Number(x && x.ts)) ? Number(x.ts) : Date.parse(String(x && x.date || ''));
  const nextCal = (cal || []).filter(x => x && x.cur === 'USD' && /high/i.test(x.impact || '') && isFinite(tsOf(x)) && tsOf(x) > Date.now())
    .sort((a, b) => tsOf(a) - tsOf(b)).slice(0, 5)
    .map(x => { const ts = tsOf(x); return { title: x.title, ts, when: new Date(ts).toISOString(), minutes: Math.round((ts - Date.now()) / 60000), impact: x.impact }; });
  return {
    ok: !!(tone || (board && board.ok) || dxy1h != null || y1h != null),
    wire: tone ? {
      score: tone.score, label: tone.label, goldBias: tone.goldBias, note: tone.note, bull: tone.bull, bear: tone.bear, at: wire.at,
      coverage: wire.coverage || null,
      top: (wire.items || []).slice(0, 10).map(x => ({ title: x.title, source: x.source, topic: x.topic, lean: x.lean, ageH: x.ageH, at: x.at, url: x.url }))
    } : null,
    macro: (board && board.items || []).map(x => ({ id: x.id, label: x.label, value: x.value, unit: x.unit, chg: x.chg, chg5: x.chg5, date: x.date, source: x.source })),
    fx: { dxy1h: dxy1h == null ? null : P(dxy1h), yield10_1h: y1h, gold1hPips },
    calendar: nextCal,
    score: P(C.clip(score, -2.2, 2.2)), evidence: ev,
    note: 'Fundamental global: ' + (tone ? 'wire ' + tone.label + ' (' + tone.score + ')' : 'wire tidak tersedia') + (real ? ' · yield riil ' + real.value + '%' : '') + (broad ? ' · dolar broad ' + broad.value : '') + ' · DXY 1 jam ' + (dxy1h == null ? '—' : (dxy1h > 0 ? '+' : '') + P(dxy1h) + '%') + ' · yield 10Y 1 jam ' + (y1h == null ? '—' : (y1h > 0 ? '+' : '') + y1h + ' pp') + '.'
  };
}

function analyse(focus, pack) {
  const { ev, official, cal, d, tv } = pack;
  const fundamental = pack.fundamental || null;
  const smc = pack.smc;
  /* Konteks teknikal SMC/AMD: dipakai sebagai bukti tambahan dan pengurang
     keyakinan, bukan untuk membalik arah data rilis. */
  const tech = (() => {
    if (!smc || !smc.ok) return null;
    const sc = C.clip((smc.bias || 0) * 0.9
      + (smc.liq && smc.liq.sweep ? (smc.liq.sweep.kind === 'low' ? 0.4 : -0.4) : 0)
      + (smc.pd ? C.clip((50 - smc.pd.pos) / 100, -0.5, 0.5) : 0), -1.8, 1.8);
    return {
      score: P(sc), dir: sc > 0.15 ? 'BUY' : sc < -0.15 ? 'SELL' : null,
      note: smc.note + (smc.killzone && smc.killzone.active ? ' · Kill zone aktif: ' + smc.killzone.name : smc.killzone && smc.killzone.next ? ' · Kill zone berikutnya ' + smc.killzone.next.name + ' dalam ' + smc.killzone.next.inMin + ' menit' : '')
    };
  })();
  /* Pakai angka kalender sebagai aktual rilis ini (satu skala dengan forecast).
     Angka FRED tetap ditampilkan di tabel perbandingan sebagai verifikasi resmi. */
  /* Aktual hanya boleh dipakai bila rilis benar-benar sudah terbit. Angka
     FRED periode lalu tidak boleh menjadi "aktual" untuk rilis mendatang. */
  const isReleased = !!(ev && ev.released && (!ev.ts || ev.ts <= Date.now()));
  const mk = marketScore(d, tv);
  /* Berita yang sudah terbit dinilai dari data rilis + reaksi pasar. Struktur
     teknikal tetap ditampilkan sebagai konteks, tetapi tidak boleh menjadi
     arah utama saat aktual/konsensus sudah tersedia. */
  let score = mk.score + (isReleased ? 0 : (tech ? tech.score : 0));
  const actCal = isReleased && ev ? parseNum(ev.actual) : null;
  const act = actCal != null ? actCal : isReleased && ev ? parseNum(ev.actualOfficial) : null;
  const fc = ev ? parseNum(ev.forecast) : null;
  const unit = UNIT[focus] || 0.15;
  const react = ev ? reactionOf(ev, d.m5 && d.m5.rows, d.m15.rows) : null;
  /* ---------- pra-rilis: apakah kita berada di T-3 menit? ---------- */
  const mins = ev && ev.ts ? Math.round((ev.ts - Date.now()) / 6000) / 10 : null;
  const preWindow = mins != null && mins > 0 && mins <= 3;
  const armed = mins != null && mins > 0 && mins <= 10;
  const preReasons = [];
  let preScore = 0;
  const preAdd = (w, why) => {
    const n = Number(w);
    if (!isFinite(n) || Math.abs(n) < 0.03) return;
    preScore += n;
    preReasons.push({ w: P(n), why });
  };
  if (d.m5 && d.m5.rows.length > 13) {
    const c = d.m5.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 13];
    const dp = Math.round((last - ref) / 0.1);
    if (isFinite(dp) && Math.abs(dp) <= 3000) preAdd(C.clip(dp / 220, -1, 1), 'Posisi emas 1 jam sebelum rilis: ' + (dp > 0 ? '+' : '') + dp + ' pip (momentum pra-rilis)');
  }
  if (d.dxyTv && d.dxyTv.rows.length > 5) {
    const c = d.dxyTv.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 5];
    if (ref) {
      const ch = (last / ref - 1) * 100;
      preAdd(C.clip(-ch * 2.2, -1.1, 1.1), 'DXY M15 1 jam: ' + (ch > 0 ? '+' : '') + P(ch) + '% → ' + (ch > 0 ? 'tekanan turun emas' : 'dukungan naik emas'));
    }
  }
  if (d.us10Tv && d.us10Tv.rows.length > 5) {
    const c = d.us10Tv.rows.map(r => r.c), last = c[c.length - 1], ref = c[c.length - 5];
    if (ref) {
      const ch = last - ref;
      preAdd(C.clip(-ch * 2.5, -0.9, 0.9), 'Yield 10Y M15 1 jam: ' + (ch > 0 ? '+' : '') + P(ch) + ' pp → ' + (ch > 0 ? 'tekanan turun emas' : 'dukungan naik emas'));
    }
  }
  if (tv && tv.ok) preAdd(C.clip(tv.weighted * 1.8, -1.3, 1.3), 'TradingView gabungan ' + tv.biasLabel + ' (' + tv.strength + '%)');
  if (tech) preAdd(C.clip(tech.score * 0.8, -1.2, 1.2), 'Teknikal SMC: ' + tech.note);
  if (fundamental && fundamental.score) preAdd(C.clip(fundamental.score * 0.75, -1.6, 1.6), 'Fundamental global XAUUSD: ' + fundamental.note);
  let nowcast = null;
  if (focus === 'NFP' && official && official.ok) {
    const ov = Number(official.value), ofc = ev ? parseNum(ev.forecast) : null;
    if (isFinite(ov) && ofc != null) {
      const gap = P(ov - ofc);
      nowcast = { last: ov, forecast: ofc, gap, hot: gap > 0, note: 'NFP terakhir ' + ov + ' ribu vs konsensus sekarang ' + ofc + ' ribu (nowcast momentum, bukan aktual rilis ini)' };
      preAdd(C.clip(-gap / 40, -1.3, 1.3), nowcast.note + ' → ' + (gap > 0 ? 'risiko data panas, emas tertekan' : 'risiko data dingin, emas didukung'));
    }
  }
  preScore = C.clip(P(preScore) || 0, -3.5, 3.5);
  const preDir = preScore >= 0 ? 'BUY' : 'SELL';
  const preConf = Math.round(Math.min(72, 50 + Math.abs(preScore) * 9));
  const hotDir = 'SELL', coldDir = 'BUY';
  const timing = {
    minutes: mins, status: mins == null ? 'TANPA JADWAL' : mins <= 0 ? 'SUDAH TERBIT' : preWindow ? 'PRA-RILIS T-3' : armed ? 'SIAP-SIAGA T-10' : 'MENUNGGU',
    preWindow, armed, dir: preDir, confidence: preConf, score: preScore, reasons: preReasons.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)),
    nowcast,
    playbook: [
      'Jangan buka posisi sebelum rilis; spread dan likuiditas buruk di detik pertama.',
      'T-3 menit: kunci bias pra-rilis ' + preDir + ' (' + preConf + '%) dari DXY, yield, TV, dan momentum emas — ini prakiraan, bukan kepastian.',
      'Setelah angka keluar: aktual > konsensus → ' + hotDir + ' emas; aktual < konsensus → ' + coldDir + ' emas; sama dengan konsensus → tunggu reaksi 5 menit.',
      'Entry hanya setelah candle M5 pertama pasca-rilis close searah; SL 30 pip; TP2 minimal 200 pip, TPmax ke swing/PDH-PDL.'
    ],
    caveat: isReleased
      ? (act != null && fc != null
        ? 'Rilis sudah terbit. Arah memakai aktual vs konsensus dan reaksi nyata; bukan lagi prakiraan pra-rilis.'
        : 'Rilis sudah terbit tetapi aktual/konsensus belum lengkap. Arah ditahan NETRAL sampai data atau reaksi ≥30 pip cukup; struktur SMC hanya konteks, bukan arah berita.')
      : preWindow
        ? 'Jendela 2–3 menit sebelum rilis: angka aktual belum ada, jadi ini prakiraan berbasis posisi pasar — bukan hasil rilis.'
        : 'Prediksi pra-rilis hanya aktif pada 3 menit terakhir sebelum jadwal; di luar itu statusnya perencanaan.'
  };
  const evidence = mk.evidence.slice();
  if (tech && Math.abs(tech.score) >= 0.05) evidence.push({ w: isReleased ? 0 : tech.score, why: 'Teknikal SMC (konteks, bukan arah berita): ' + tech.note });
  if (fundamental && fundamental.evidence && fundamental.evidence.length) {
    fundamental.evidence.forEach(x => evidence.push({ w: P(isReleased ? 0 : x.w * 0.6), why: 'Fundamental global (konteks): ' + x.why }));
  }
  let surprise = null;
  let lastW = 0;
  if (act != null && fc != null) {
    /* Rilis index-level (mis. CPI 337,5) dibandingkan sebagai % perubahan
       terhadap previous, bukan selisih level mentah. */
    const prevNum = parseNum(ev.previous);
    const isIndex = focus === 'CPI' && !ev.unit && act > 100 && fc > 100 && prevNum > 0;
    const diff = isIndex ? ((act / prevNum - 1) - (fc / prevNum - 1)) * 100 : act - fc;
    const u = isIndex ? 0.1 : unit;
    const hot = diff > 0;
    const w = C.clip(-(Math.abs(diff) / u) * 1.8, -2.4, 2.4) * (hot ? 1 : -1);
    score += w;
    surprise = { actual: act, forecast: fc, previous: prevNum, diff: P(diff), unit: isIndex ? 'pp (perubahan dari previous)' : (ev.unit || ''), hot, weight: P(w) };
    evidence.push({ w: P(w), why: focus + ' aktual ' + act + (isIndex ? ' (indeks, setara ' + P((act / prevNum - 1) * 100) + '% vs previous)' : '') + ' vs konsensus ' + fc + ' → ' + (hot ? 'lebih panas/kuat (tekanan turun emas)' : 'lebih dingin/lemah (dukungan naik emas)') });
  }
  if (react && react.dir !== 'DUA ARAH' && Math.abs(react.netPips) >= 30) {
    const w = C.clip(react.netPips / 45, -3, 3);
    score += w;
    evidence.push({ w: P(w), why: 'Reaksi nyata emas 15 menit setelah rilis: ' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip → ' + react.dir });
  } else if (react) {
    /* Reaksi <30 pip atau dua arah adalah noise spread, bukan arah berita.
       Catat sebagai konteks tanpa memberi bobot arah. */
    evidence.push({ w: 0, why: 'Reaksi awal 15 menit ' + react.dir + ' (' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip) belum cukup kuat; tidak dipakai menentukan arah.' });
  }
  /* Rilis terakhir tetap menjadi bukti data terbaru saat rilis berikutnya
     belum terbit. Ini bukan aktual rilis mendatang dan bobotnya dibatasi. */
  if (!isReleased && ev.lastRelease && ev.lastRelease.actual != null) {
    const la = parseNum(ev.lastRelease.actual), lf = parseNum(ev.lastRelease.forecast);
    if (la != null && lf != null) {
      const dLast = la - lf;
      const wLast = C.clip(-(Math.abs(dLast) / unit) * 0.9, -1.2, 1.2) * (dLast > 0 ? 1 : -1);
      score += wLast;
      lastW = wLast;
      evidence.push({
        w: P(wLast),
        why: 'Rilis terakhir ' + (ev.lastRelease.tag || focus) + ' aktual ' + la + ' vs konsensus ' + lf + ' → ' + (dLast > 0 ? 'data lebih panas, bias SELL' : 'data lebih dingin, bias BUY') + ' (bukti terakhir, bukan aktual rilis mendatang).'
      });
    }
  }
  /* Satu arah, satu skor. Kejutan rilis terakhir hanya menjadi bukti dengan
     bobot terbatas; ia tidak lagi membalik arah pasar yang lebih kuat. */
  const preOnly = !isReleased && act == null && !react;
  if (preOnly) {
    score = P(mk.score * 0.30 + preScore * 0.70 + lastW * 0.9) || 0;
    preReasons.forEach(x => evidence.push({ w: x.w, why: 'Pra-rilis: ' + x.why }));
  }
  score = P(score) || 0;
  /* Prioritas arah: reaksi nyata > skor data + teknikal > TradingView live >
     struktur SMC. Skor akhir SELALU searah dengan putusan. */
  let dir, source;
  const strongReact = !!(react && react.dir !== 'DUA ARAH' && Math.abs(react.netPips) >= 30);
  const strongSurprise = !!(isReleased && surprise && Math.abs(surprise.weight) >= 0.8);
  if (strongReact) {
    dir = react.dir;
    source = 'reaksi rilis terukur (15 menit)';
    score = (dir === 'BUY' ? 1 : -1) * Math.max(0.8, Math.abs(score));
  } else if (strongSurprise) {
    /* Data rilis yang jelas panas/dingin adalah fakta utama berita; jangan
       dibalik oleh tren harga yang sudah berjalan sebelum rilis. Reaksi nyata
       ≥30 pip tetap menjadi override di atas. */
    dir = surprise.hot ? 'SELL' : 'BUY';
    source = 'data rilis (aktual vs konsensus)';
    score = (dir === 'BUY' ? 1 : -1) * Math.max(0.8, Math.abs(score));
  } else if (Math.abs(score) >= 0.9) {
    dir = score > 0 ? 'BUY' : 'SELL';
    source = preOnly ? 'pra-rilis (fundamental wire/FRED, DXY, yield, TV, momentum, SMC)' : 'skor data rilis + pasar';
  } else if (!isReleased && tv && tv.ok && tv.bias !== 0) {
    dir = tv.bias > 0 ? 'BUY' : 'SELL';
    source = preOnly ? 'pra-rilis + TradingView live' : 'TradingView live';
  } else if (!isReleased && tech && tech.score) {
    dir = tech.score > 0 ? 'BUY' : 'SELL';
    source = 'struktur teknikal SMC';
  } else {
    dir = score >= 0 ? 'BUY' : 'SELL';
    source = preOnly ? 'pra-rilis (skor lemah)' : isReleased ? 'skor data rilis + pasar (lemah)' : 'skor data pasar (lemah)';
  }
  /* Rilis yang sudah lewat tanpa aktual/konsensus yang bisa dibandingkan
     tidak boleh diarahkan oleh teknikal saja. */
  if (isReleased && !strongReact && !surprise) {
    dir = 'NETRAL';
    source = 'aktual rilis belum tersedia; menunggu data/reaksi';
    score = 0;
  } else if (isReleased && !strongReact && surprise && Math.abs(surprise.weight) < 0.25) {
    dir = 'NETRAL';
    source = 'aktual sesuai konsensus; reaksi belum cukup kuat';
    score = 0;
  } else if (!strongReact && !strongSurprise && Math.abs(score) < 0.6) {
    /* Jangan memaksa BUY hanya karena skor nol/lemah. Ini yang membuat arah
       berita terlihat yakin padahal data belum cukup. */
    dir = 'NETRAL';
    source = 'data belum cukup untuk arah';
    score = 0;
  }
  if (dir !== 'NETRAL') {
    if ((dir === 'BUY') !== (score >= 0)) score = -score;
    if (Math.abs(score) < 0.6) score = dir === 'BUY' ? 0.6 : -0.6;
  }
  score = P(score);
  const base = BASE_PIPS[focus] || 220;
  const atrPips = d.m15 ? Math.round((C.atr(d.m15.rows, 14) || 3) / 0.1) : null;
  const scale = C.clip((atrPips || 30) / 30, 0.6, 1.8);
  let spike;
  if (react) {
    const likely = react.rangePips >= Math.round(base * scale * 0.45);
    spike = {
      likely, measured: true, sizePips: { min: Math.min(react.rangePips, Math.round(base * scale * 2)), max: Math.max(react.rangePips, Math.round(base * scale * 1.2)) },
      windowMin: 45, firstDir: react.firstDir, reaction: react,
      why: 'Terukur dari candle live: rentang ' + react.rangePips + ' pip dalam 45 menit setelah rilis (naik ' + react.upPips + ' / turun ' + react.downPips + '), net 15 menit ' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip dan net 45 menit ' + (react.net45Pips > 0 ? '+' : '') + react.net45Pips + ' pip.'
    };
  } else {
        const past = ev.released || ev.derived;
    spike = {
      likely: !past, measured: false, sizePips: { min: Math.round(base * scale * 0.7), max: Math.round(base * scale * 1.35) },
      windowMin: focus === 'FOMC' ? 35 : 25, firstDir: 'DUA ARAH',
      why: past
        ? 'Rilis sudah lewat lebih dari 24 jam, jadi jendela spike tidak bisa diukur dari candle live. Status spike TIDAK diklaim; rentang di bawah hanya proyeksi kelas rilis ' + focus + ' + ATR live.'
        : 'Belum terbit: rentang diperkirakan dari kelas rilis ' + focus + ' + ATR live ' + (atrPips == null ? '—' : atrPips + ' pip') + '. Ini perkiraan berbasis data, bukan hasil terukur.'
    };
  }
  /* Timing memakai arah final yang sama dengan verdict — tidak ada lagi dua
     arah berbeda antara kartu timing dan putusan mesin. */
  const phase = isReleased ? 'pasca-rilis' : preWindow ? 'pra-rilis T-3' : armed ? 'siaga T-10' : 'menunggu';
  const techNote = tech ? tech.note : 'Konteks SMC tidak tersedia.';
  timing.phase = phase;
  timing.preDir = preDir;
  timing.dir = dir;
  timing.score = score;
  timing.technical = techNote;
  timing.dataBias = surprise ? (surprise.hot ? 'SELL' : 'BUY') : null;
  timing.status = mins == null ? 'TANPA JADWAL' : isReleased ? 'SUDAH TERBIT' : preWindow ? 'PRA-RILIS T-3' : armed ? 'SIAP-SIAGA T-10' : 'MENUNGGU';
  if (dir === 'NETRAL') {
    timing.status = isReleased ? 'SUDAH TERBIT · ARAH BELUM CUKUP' : 'MENUNGGU BUKTI';
  }
  timing.playbook = isReleased ? [
    'Rilis sudah terbit. Jangan kejar candle pertama; tunggu spread normal dan candle M5 close.',
    'Aktual vs konsensus: ' + (surprise ? surprise.actual + ' vs ' + surprise.forecast + ' → ' + (surprise.hot ? 'lebih panas' : 'lebih dingin') + ' (bias data ' + (surprise.hot ? 'SELL' : 'BUY') + ')' : 'angka aktual belum lengkap') + (react && react.dir !== 'DUA ARAH' && Math.abs(react.netPips) >= 30 ? '; reaksi nyata ' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip → ' + react.dir + '. Arah mengikuti reaksi terukur.' : react ? '; reaksi ' + react.dir + ' (' + (react.netPips > 0 ? '+' : '') + react.netPips + ' pip) belum cukup kuat. Arah mesin ' + dir + ' dari data rilis + pasar; teknikal hanya konteks.' : '. Arah mesin ' + dir + ' dari data rilis + pasar; teknikal hanya konteks.'),
    'Entry hanya jika CHoCH/BOS M5 searah + FVG/OB unmitigated, di ' + (smc && smc.killzone && smc.killzone.active ? smc.killzone.name : 'kill zone London/New York') + '.',
    'SL 30 pip; TP2 minimal 200 pip ke likuiditas berikutnya. Di luar kill zone: tunggu, jangan paksa entry.'
  ] : [
    'Jangan buka posisi sebelum rilis; spread dan likuiditas buruk di detik pertama.',
    'T-' + (preWindow ? '3' : '10') + ' menit: kunci bias ' + dir + ' (' + preConf + '%) dari DXY, yield, TV, momentum emas, dan SMC. Ini prakiraan pra-rilis, bukan aktual.',
    'Setelah angka keluar: aktual > konsensus → SELL emas; aktual < konsensus → BUY emas; sama dengan konsensus → tunggu reaksi 5 menit.',
    'Entry hanya setelah candle M5 pertama pasca-rilis close searah + CHoCH/BOS di POI; SL 30 pip; TP2 minimal 200 pip.'
  ];
  if (preOnly) timing.confidence = Math.max(timing.confidence, Math.min(80, Math.round(50 + Math.abs(score) * 8)));
  else if (isReleased) timing.confidence = C.clip(Math.round(45 + Math.abs(score) * 6 + (react ? Math.min(12, Math.abs(react.netPips) / 30) : 0)), 35, 90);
  if (dir === 'NETRAL') {
    timing.confidence = Math.min(timing.confidence, 40);
    timing.reasons = evidence.filter(x => x.w !== 0).slice(0, 5);
    timing.playbook[1] = isReleased
      ? 'Aktual/konsensus dan reaksi 15 menit belum memberi arah yang cukup kuat. Tunggu candle M5 close berikutnya; jangan paksa entry.'
      : 'Belum ada bias pra-rilis yang cukup kuat. Tunggu data pasar atau aktual rilis; jangan menganggap NETRAL sebagai sinyal entry.';
  } else {
      timing.reasons = isReleased ? evidence.slice(0, 5) : preReasons;
  }
  timing.preReasons = preReasons;
  const technicalConflict = !!(dir !== 'NETRAL' && tech && tech.dir && (tech.dir === 'BUY') !== (dir === 'BUY'));
  if (technicalConflict) {
    timing.confidence = Math.max(20, timing.confidence - 6);
    timing.caveat = (timing.caveat ? timing.caveat + ' ' : '') + 'Arah berita bertentangan dengan struktur SMC live (' + tech.note + '); keyakinan diturunkan 6 poin, arah tidak diubah.';
  }
  return { dir, source, score, evidence: evidence.slice(0, 12), surprise, reaction: react, spike, timing, officialOk: !!official.ok, technical: tech, technicalConflict, fundamental };
}

const cache = new Map();

function sanitizeDoc(o) {
  o = o && typeof o === 'object' ? o : {};
  const arr = (v, n, f) => (Array.isArray(v) ? v.slice(0, n).map(f).filter(Boolean) : []);
  const s = (v, n) => C.cut(v == null ? '' : v, n || 400);
  return {
    headline: s(o.headline, 160),
    summary: s(o.summary, 1600),
    focus_what: s(o.focus_what, 700),
    why_gold: s(o.why_gold, 900),
    why_valid: s(o.why_valid, 900),
    prediction_2_3m: s(o.prediction_2_3m, 600),
    confidence: isFinite(Number(o.confidence)) ? Math.max(0, Math.min(100, Number(o.confidence))) : null,
    fact_vs_inference: s(o.fact_vs_inference, 500),
    youtube_read: s(o.youtube_read, 500),
    technical_read: s(o.technical_read, 900),
    entry_plan: s(o.entry_plan, 800),
    data_chain: arr(o.data_chain, 6, x => ({ source: s(x && x.source, 60), fact: s(x && x.fact, 180), weight: s(x && x.weight, 40) })),
    bull_case: s(o.bull_case, 600), bear_case: s(o.bear_case, 600),
    comparison: arr(o.comparison, 8, x => ({ metric: s(x && x.metric, 70), latest: s(x && x.latest, 28), previous: s(x && x.previous, 28), change: s(x && x.change, 56), source: s(x && x.source, 50) })),
    concurrent: arr(o.concurrent, 8, x => ({ title: s(x && x.title, 120), when: s(x && x.when, 40), impact: s(x && x.impact, 12), gold_effect: s(x && x.gold_effect, 260) })),
    scenarios: arr(o.scenarios, 4, x => ({ name: s(x && x.name, 50), if: s(x && x.if, 220), then: s(x && x.then, 260) })),
    risks: arr(o.risks, 6, x => s(x, 220)),
    validity: arr(o.validity, 8, x => s(x, 240)),
    sources: arr(o.sources, 8, x => s(x, 160)),
    fallback: o.fallback === true,
    fallback_reason: s(o.fallback_reason, 300)
  };
}

/* Ringkasan deterministik saat AI tidak mengembalikan JSON valid. Semua angka
   diambil dari pack mesin; tidak ada angka baru dan tidak ada arah kedua. */
function fallbackDoc(pack, panel, aiError) {
  const meta = FOCUS_META[pack.focus] || FOCUS_META.CPI;
  const ev = pack.event || {};
  const t = pack.timing || {};
  const dq = pack.dataQuality || {};
  const failed = (dq.checks || []).filter(x => !x.ok).map(x => x.k);
  const panelOk = panel && panel.total ? panel : null;
  const dir = pack.direction || 'NETRAL';
  const f = pack.fundamental || {};
  const macro = (f.macro || []).filter(x => /DFII10|DTWEXBGS|T10YIE|DGS10/.test(String(x.id))).slice(0, 4);
  const rel = pack.release || {};
  const cmp = [];
  if (ev.forecast || ev.previous || ev.actual) cmp.push({ metric: pack.focus + ' — rilis fokus', latest: ev.actual || ev.actualOfficial || 'belum terbit', previous: ev.forecast || '—', change: 'Konsensus ' + (ev.forecast || '—') + '; previous ' + (ev.previous || '—'), source: ev.actualOfficial != null ? (ev.actualSource || 'FRED/BLS') : 'Kalender ekonomi' });
  if (ev.lastRelease) cmp.push({ metric: pack.focus + ' — rilis terakhir', latest: ev.lastRelease.actual || '—', previous: ev.lastRelease.forecast || '—', change: 'Rilis sebelumnya; bukan aktual rilis fokus ini', source: ev.lastRelease.source || 'Kalender' });
  (rel.components || []).filter(c => c.ok).slice(0, 7).forEach(c => cmp.push({
    metric: c.k, latest: String(c.value) + (c.unit || ''), previous: c.prev == null ? '—' : String(c.prev) + (c.unit || ''),
    change: c.change == null ? 'periode ' + (c.period || '—') : 'Δ ' + (c.change > 0 ? '+' : '') + c.change + (c.unit || ''),
    source: c.source
  }));
  macro.forEach(x => cmp.push({ metric: x.label, latest: String(x.value) + (x.unit || ''), previous: x.chg5 == null ? '—' : (x.chg5 > 0 ? '+' : '') + x.chg5 + (x.unit || '') + ' / 5 observasi', change: x.date, source: x.source }));
  const evidence = (pack.evidence || []).filter(x => x.w !== 0).slice(0, 6);
  return sanitizeDoc({
    headline: 'Fokus ' + pack.focus + ': ' + (ev.title || pack.name) + ' — arah mesin ' + dir,
    summary: 'Ringkasan ini disusun mesin dari data fokus ' + pack.focus + ' karena AI tidak mengembalikan JSON valid. Arah final ' + dir + ' berasal dari ' + (pack.directionSource || 'skor data') + ' dengan skor ' + (pack.score == null ? '—' : pack.score) + '. Panel AI ' + (panelOk ? panelOk.total + ' panelis valid (' + panelOk.consensus + ')' : 'tidak memberi suara valid') + '. Data quality ' + (dq.score == null ? '—' : dq.score + '%') + '.' ,
    focus_what: meta.measures + ' Yang dipakai untuk arah: ' + meta.primary + '.',
    why_gold: meta.gold,
    why_valid: 'Fakta diambil dari kalender ekonomi, FRED/BLS/BEA/Treasury, dan candle TradingView. ' + (dq.ok != null ? dq.ok + '/' + dq.total + ' pemeriksaan data lolos. ' : '') + (failed.length ? 'Pemeriksaan yang belum lolos: ' + failed.slice(0, 5).join(', ') + '. ' : '') + 'Judul media/YouTube hanya konteks, bukan sumber angka. ' + (aiError ? 'Kegagalan AI: ' + aiError + '. ' : ''),
    prediction_2_3m: (t.caveat || 'Status timing belum tersedia.') + ' ' + (t.playbook || []).slice(0, 2).join(' '),
    confidence: t.confidence == null ? null : t.confidence,
    fact_vs_inference: 'Fakta: angka aktual/konsensus, tanggal observasi, sumber, dan candle. Inferensi: arah, skenario, dan entry. Semua angka di ringkasan ini berasal dari panel data di bawah, bukan dari judul berita.',
    youtube_read: (pack.yt && pack.yt.items ? pack.yt.items.length + ' video relevan; ' : '') + (pack.yt && pack.yt.transcripts && pack.yt.transcripts.ok ? 'transkrip resmi tersedia untuk konteks naratif. ' : 'transkrip resmi tidak tersedia. ') + 'Video tidak dipakai sebagai sumber angka atau level.',
    technical_read: (pack.technical && pack.technical.note) || 'Konteks teknikal SMC tidak tersedia.',
    entry_plan: 'Tunggu gate 1D–4H, 1H–15m, dan 5m–1m selaras. Entry hanya LIMIT di POI yang sudah dihitung mesin, bukan market chase; SL 30 pip; TP2 minimal 200 pip ke likuiditas berikutnya. Status ' + (t.status || '—') + '.',
    data_chain: [
      ...evidence.map(x => ({ source: 'Mesin XAUUSD', fact: x.why, weight: Math.abs(Number(x.w) || 0) >= 1 ? 'utama' : 'pendukung' })),
      ...((rel.components || []).filter(c => c.ok).slice(0, 3).map(c => ({ source: c.source, fact: c.k + ' ' + c.value + (c.unit || '') + ' · periode ' + c.period, weight: 'utama' })))
    ].slice(0, 8),
    bull_case: 'Aktual lebih dingin dari konsensus, DXY/yield riil turun, dan harga mempertahankan demand → bias BUY.',
    bear_case: 'Aktual lebih panas dari konsensus, DXY/yield riil naik, dan supply menolak harga → bias SELL.',
    comparison: cmp.slice(0, 8),
    concurrent: (pack.concurrent || []).slice(0, 8).map(x => ({ title: x.title, when: x.when, impact: x.impact, gold_effect: 'Risiko gabungan; bukan fokus utama dan tidak boleh membalik arah ' + pack.focus + '.' })),
    scenarios: [
      { name: 'Data lebih panas', if: 'Aktual > konsensus', then: 'Bias SELL; tunggu reaksi 15 menit dan konfirmasi M5.' },
      { name: 'Data lebih dingin', if: 'Aktual < konsensus', then: 'Bias BUY; tunggu reaksi 15 menit dan konfirmasi M5.' },
      { name: 'Sesuai konsensus', if: 'Aktual = konsensus', then: 'NETRAL sampai reaksi ≥30 pip; jangan paksa entry.' }
    ],
    risks: ['AI gagal memberi JSON valid: ' + (aiError || 'penyedia tidak tersedia') + '. Ringkasan ini deterministik, bukan opini AI.', ...failed.slice(0, 3).map(x => 'Pemeriksaan data belum lolos: ' + x + '.'), ...((rel.delayed || []).slice(0, 3).map(x => 'Komponen ' + x + ' belum terbaca; jangan diisi angka sendiri.')), 'Rilis bersamaan dan spread dapat mengubah reaksi harga.'],
    validity: [
      (rel.coverage ? 'Checklist ' + pack.focus + ': ' + rel.coverage.ok + '/' + rel.coverage.total + ' komponen terbaca.' : ''),
      (rel.watch ? 'Respons pasar: ' + rel.watch.state + ' — ' + rel.watch.note : ''),
      ...(rel.pre || []).map(x => (x.ok ? 'OK' : 'BELUM') + ' — proxy ' + x.k + (x.d ? ': ' + x.d : '')).slice(0, 4),
      ...(dq.checks || []).map(x => (x.ok ? 'OK' : 'BELUM') + ' — ' + x.k + (x.d ? ': ' + x.d : ''))
    ].filter(Boolean).slice(0, 10),
    sources: (pack.sources || []).filter(x => x.ok).map(x => x.name).slice(0, 8),
    fallback: true,
    fallback_reason: C.cut(aiError || 'AI tidak mengembalikan JSON valid', 300)
  });
}

async function build(focus) {
  const calRaw = await C.calendar();
  const cal = calRaw.filter(x => x.cur === 'USD').map(x => ({ ...x, tag: C.calTag(x.title), ts: Date.parse(x.date) }));
  const official = await officialActual(focus);
  const ev0 = eventOf(cal, focus, official);
  if (!ev0) throw new Error('Jadwal dan data resmi ' + focus + ' belum terbaca. Coba lagi beberapa saat lagi.');
  const d = await C.candles();
  const sp = await C.spot().catch(() => null);
  const tv = await C.tvRead();
  /* Mesin SMC/AMD live: struktur, POI, likuiditas, kill zone, AMD, fib. */
  const smc = (() => {
    try {
      return S.build({
        m5: d.m5 && d.m5.rows, m15: d.m15 && d.m15.rows,
        h1: d.h1 && d.h1.rows, h4: d.h4 && d.h4.rows, d1: d.d1 && d.d1.rows,
        price: tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : null, now: Date.now()
      });
    } catch (e) { return { ok: false, note: 'Mesin SMC gagal: ' + C.cut(e && e.message || e, 160) }; }
  })();
      const [us, yt, offNews, macroBoard, wire] = await Promise.all([
      C.usNews(focus + ' OR gold OR XAUUSD OR "Federal Reserve"').catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) })),
      C.youtube(focus).catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) })),
      officialNews(focus).catch(() => ({ ok: false, items: [] })),
      C.fredBoard().catch(e => ({ ok: false, items: [], error: C.cut(e.message, 120) })),
      W.build().catch(e => ({ ok: false, items: [], tone: null, coverage: null, sources: [], error: C.cut(e && e.message || e, 160) }))
    ]);
  const concurrent = ev0.ts ? cal.filter(x => x.ts !== ev0.ts && Math.abs(x.ts - ev0.ts) <= 120 * 60000 && /high|medium/i.test(x.impact || '')).sort((a, b) => a.ts - b.ts) : [];
  /* Angka FRED hanya boleh dianggap "aktual rilis ini" bila periodenya cocok
     dengan jadwal rilis (NFP/CPI/PPI: periode bulan lalu; FOMC: efek beberapa
     hari setelah keputusan). Kalau tidak cocok, itu data lama — jangan dicampur. */
  const periodic = (() => {
    if (!official.ok || !official.period) return false;
    if (!ev0.ts) return true;
    /* Jangan memasang angka FRED lama sebagai aktual rilis yang belum terbit. */
    if (!ev0.released || ev0.ts > Date.now()) return false;
    const p = Date.parse(official.period);
    if (!isFinite(p)) return false;
    const diff = ev0.ts - p;
    if (!(diff >= 0 && diff <= 46 * 86400000)) return false;
    /* Skala harus sebanding: CPI kalender memakai level indeks (337,5),
       FRED menyajikan % YoY (4,08). Jangan pasang 4,08 sebagai "aktual rilis". */
    const a = parseNum(ev0.actual), v = Number(official.value);
    if (a != null && isFinite(v)) {
      const gap = Math.abs(a - v), lim = Math.max(Math.abs(a), Math.abs(v)) * 0.5 + 1;
      if (gap > lim) return false;
    }
    return true;
  })();
  const ev = { ...ev0, actualOfficial: periodic ? official.value : null, actualSource: periodic ? official.source : '', officialPeriod: official.ok ? official.period : (ev0.period || '') };
  /* Hanya rilis dengan tag fokus yang benar-benar dipakai untuk arah. Rilis
     lain pada jam yang sama ditampilkan sebagai risiko gabungan, bukan fokus
     kedua. Ini menjaga pertanyaan "PPI" tidak berubah menjadi analisis CPI. */
  ev.related = ev.ts ? cal.filter(x => x.tag === focus && x.ts === ev.ts && x.title !== ev.title)
    .map(x => ({ title: x.title, when: new Date(x.ts).toISOString(), impact: x.impact, forecast: x.forecast, previous: x.previous, actual: x.actual }))
    .slice(0, 6) : [];
  const fundamental = fundamentalOf(wire, macroBoard, d, tv, calRaw);
  fundamental.focus = {
    tag: focus, title: ev.title, when: ev.ts ? new Date(ev.ts).toISOString() : null,
    note: 'Data global di panel ini adalah konteks untuk fokus ' + focus + '; bukan arah rilis lain.'
  };
  const pack = analyse(focus, { ev, official, cal: calRaw, d, tv, smc, fundamental });
  /* Checklist komponen + proxy pra-rilis + respons pasar. Gagal membaca
     checklist tidak boleh menggagalkan analisis; statusnya ditandai jujur. */
  const release = await releaseOf(focus, ev, macroBoard).catch(e => ({
    tag: focus, guide: RELEASE_GUIDE[focus] || RELEASE_GUIDE.CPI, components: [], pre: [],
    coverage: { ok: 0, total: 0, pct: 0 }, delayed: [], sources: (RELEASE_GUIDE[focus] || RELEASE_GUIDE.CPI).sources,
    note: 'Checklist rilis gagal dibaca: ' + C.cut(e && e.message || e, 140)
  }));
  release.watch = watchOf(d, macroBoard, ev, pack.dir);
  release.focus = { tag: focus, title: ev.title, when: ev.ts ? new Date(ev.ts).toISOString() : null };
  /* Tiga lapisan baru: tabel banding bersatuan, skenario pasar bersyarat,
     dan audit kalender vs angka resmi. Tidak ada angka baru di sini. */
  const compare = compareRows(focus, ev, release, official);
  const scenario = scenarioOf(focus, ev, release, pack.surprise, pack.reaction, official);
  const calendar = calendarAudit(ev, cal);
  const playbook = playbookOf(focus, ev, compare, scenario, calendar);
  const price = tv && tv.ok ? tv.price : sp && sp.ok ? sp.price : d.m15.last.c;
  const priceSource = tv && tv.ok ? 'chart TradingView ' + C.TV_SYMBOL : sp && sp.ok ? 'spot gold-api' : 'candle ' + C.Y_SYM;
  const candle = d.m5 || d.m15;
  const priceAudit = {
    tv: tv && tv.ok ? { price: tv.price, at: new Date(tv.at).toISOString(), symbol: tv.symbol } : null,
    spot: sp && sp.ok ? { price: sp.price, at: new Date(sp.at).toISOString() } : null,
    differencePips: tv && tv.ok && sp && sp.ok ? Math.round(Math.abs(tv.price - sp.price) / 0.1) : null,
    candle: candle && candle.last ? { source: candle.source || d.source, at: new Date(candle.last.t).toISOString(), price: candle.last.c } : null,
    freshMinutes: candle && candle.last ? Math.round((Date.now() - candle.last.t) / 60000) : null,
    brokerNote: 'HFM/Exness tidak menyediakan API publik real-time untuk retail. Harga/candle di sini berasal dari TradingView FOREXCOM:XAUUSD dan spot gold-api; quote MT5 broker dapat berbeda beberapa pip karena feed dan spread.'
  };
  return {
    schema: 2, ok: true, focus, name: NAME[focus], generatedAt: new Date().toISOString(),
    price, priceSource, priceAudit, tv: tv && tv.ok ? { price: tv.price, bias: tv.bias, label: tv.biasLabel, strength: tv.strength, tf: tv.tf, at: new Date(tv.at).toISOString(), symbol: tv.symbol } : { ok: false, error: (tv && tv.error) || 'TradingView tidak tersedia' },
    spot: sp && sp.ok ? sp.price : null,
    event: {
      tag: ev.tag, title: ev.title, ts: ev.ts || null, when: ev.ts ? new Date(ev.ts).toISOString() : null,
      whenLabel: ev.ts ? null : 'data terakhir FRED · periode ' + (ev.officialPeriod || (official.ok ? official.period : '—')),
      derived: !!ev.derived, impact: ev.impact || 'High',
      forecast: ev.forecast, previous: ev.previous, actual: ev.actual || '', unit: ev.unit || '', period: ev.period || '',
      actualOfficial: ev.actualOfficial, actualSource: ev.actualSource, officialPeriod: ev.officialPeriod,
      actualPending: !!ev.released && parseNum(ev.actual) == null && ev.actualOfficial == null,
      related: ev.related || [],
      lastRelease: ev.lastRelease ? {
        tag: ev.lastRelease.tag, title: ev.lastRelease.title, ts: ev.lastRelease.ts || null,
        when: ev.lastRelease.ts ? new Date(ev.lastRelease.ts).toISOString() : null,
        actual: ev.lastRelease.actual || '', forecast: ev.lastRelease.forecast || '', previous: ev.lastRelease.previous || '',
        unit: ev.lastRelease.unit || '', source: ev.lastRelease.source || ev.lastRelease.verified || 'calendar', released: true
      } : null,
      previousRelease: ev.previousRelease ? {
        tag: ev.previousRelease.tag, title: ev.previousRelease.title, ts: ev.previousRelease.ts || null,
        when: ev.previousRelease.ts ? new Date(ev.previousRelease.ts).toISOString() : null,
        actual: ev.previousRelease.actual || '', forecast: ev.previousRelease.forecast || '', previous: ev.previousRelease.previous || '',
        unit: ev.previousRelease.unit || '', source: ev.previousRelease.source || ev.previousRelease.verified || 'calendar', released: true
      } : null,
      nextRelease: ev.nextRelease ? {
        tag: ev.nextRelease.tag, title: ev.nextRelease.title, ts: ev.nextRelease.ts || null,
        when: ev.nextRelease.ts ? new Date(ev.nextRelease.ts).toISOString() : null,
        forecast: ev.nextRelease.forecast || '', previous: ev.nextRelease.previous || '', impact: ev.nextRelease.impact || 'High'
      } : null,
      verified: ev.verified || 'kalender', released: !!ev.released
    },
    official,
    concurrent: concurrent.map(x => ({ tag: x.tag || '', title: x.title, ts: x.ts, when: new Date(x.ts).toISOString(), impact: x.impact, forecast: x.forecast, previous: x.previous, actual: x.actual })),
    direction: pack.dir, directionSource: pack.source, score: pack.score, evidence: pack.evidence,
    surprise: pack.surprise, reaction: pack.reaction, spike: pack.spike,
    timing: pack.timing, technical: pack.technical, technicalConflict: pack.technicalConflict,
    focusMeta: FOCUS_META[focus] || null,
    fundamental: pack.fundamental || null,
    release,
    playbook,
    compare,
    scenario,
    calendarAudit: calendar,
    reference: playbook.reference,
    sourcesMatrix: playbook.sources,
    goldWire: wire,
    aiDirection: null,
    us, yt, officialNews: offNews, macroBoard, marketContext: marketContext(d, tv),
    market: { gold: d.d1 ? { last: P(d.d1.last.c), chg1d: null } : null, tv: tv && tv.ok ? { bias: tv.biasLabel, strength: tv.strength } : null },
    sources: [
      { name: 'TradingView Economic Calendar (cadangan: FairEconomy)', url: 'https://www.tradingview.com/economic-calendar/', ok: cal.length > 0, why: 'Jadwal dan konsensus/previous dari kalender ekonomi; agregator, jadi angka aktual tetap dicek ke FRED/BLS.' },
      { name: 'FRED / BLS (angka resmi)', url: 'https://fred.stlouisfed.org/', ok: !!official.ok, why: 'FRED adalah basis data resmi Federal Reserve St. Louis; BLS adalah lembaga statistik AS. Angka resmi berperiode jelas dan bisa diaudit, sehingga dipakai sebagai aktual utama.' },
      { name: 'TradingView live ' + C.TV_SYMBOL, url: 'https://www.tradingview.com/symbols/FOREXCOM-XAUUSD/', ok: !!(tv && tv.ok), why: 'Harga dan candle XAUUSD dari feed publik TradingView. Hanya candle M5 yang sudah close dipakai untuk mengukur reaksi, jadi tidak repaint.' },
      { name: 'gold-api.com spot', url: 'https://www.gold-api.com/', ok: !!(sp && sp.ok), why: 'Spot XAU independen untuk memeriksa selisih harga dengan TradingView; bukan quote broker dan tidak dipakai sebagai angka rilis.' },
      { name: 'Yahoo Finance candle ' + C.Y_SYM, url: 'https://finance.yahoo.com/quote/GC=F/', ok: !!d.m15, why: 'Candle cadangan GC=F untuk struktur bila feed TradingView tertunda. Sumber publik, bukan angka resmi rilis.' },
      { name: 'Google News RSS media AS + finansial global', url: 'https://news.google.com/', ok: !!us.ok, why: 'Hanya media besar (Reuters, AP, Bloomberg, CNBC, WSJ, FT, MarketWatch, Fox Business) yang diizinkan. Judul dipakai untuk konteks dan triangulasi; angka tetap dari kalender/FRED.' },
      { name: 'YouTube (judul, kanal, umur, kecenderungan)', url: 'https://www.youtube.com/', ok: !!yt.ok, why: 'Video resmi (Bloomberg, Reuters, CNBC, Yahoo Finance, Kitco, The Fed) ditandai dan diprioritaskan. Judul/kecenderungan hanya konteks; bukan sumber angka.' },
      { name: 'YouTube transkrip resmi (Bloomberg/Reuters/CNBC)', url: 'https://www.youtube.com/', ok: !!(yt.transcripts && yt.transcripts.ok), why: 'Caption resmi dari kanal terverifikasi, maksimal 20 menit/video. Caption bisa auto-caption dan salah kata, jadi tidak dipakai untuk angka harga/level.' },
      { name: 'Pembacaan video resmi (Gemini, tanpa angka)', url: 'https://www.youtube.com/', ok: !!(yt.videoRead && yt.videoRead.ok), why: 'Ringkasan isi video oleh model, dengan aturan keras tanpa angka/tanggal/level. Fungsinya menjelaskan narasi pembicara, bukan menambah data.' },
      { name: 'Papan makro FRED (yield, riil, dolar, breakeven)', url: 'https://fred.stlouisfed.org/', ok: !!(macroBoard && macroBoard.ok), why: 'Seri resmi harian FRED (yield riil, dolar broad, breakeven). Frekuensinya harian, jadi dipakai sebagai konteks fundamental — bukan pengganti aktual rilis.' },
      { name: 'Mesin SMC/ICT/AMD (struktur, FVG/OB, likuiditas, kill zone, AMD, fib)', url: 'https://www.tradingview.com/', ok: !!(smc && smc.ok), why: 'Dihitung deterministik dari candle OHLC, bukan opini. Dipakai untuk menilai apakah pasar mendukung arah rilis, tanpa mengubah arah data.' },
      { name: 'BLS Release Calendar / CPI / Employment Situation / PPI', url: 'https://www.bls.gov/schedule/news_release/', ok: !!(release && (release.sources || []).length), why: 'Sumber primer jadwal, komponen, payrolls, pengangguran, upah, jam kerja, dan revisi. Angka resmi BLS/FRED dipakai sebagai aktual; kalender agregator hanya untuk jadwal/konsensus.' },
      { name: 'Federal Reserve (feed press) + CME FedWatch (manual)', url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', ok: !!(offNews && offNews.ok) || focus === 'FOMC', why: 'Feed press Fed dipantau untuk statement/rilis resmi; probabilitas FedWatch dibaca manual karena tidak ada API publik. Untuk CPI/NFP/PPI ini konteks kebijakan, bukan sumber angka rilis.' },
      { name: 'FRED DFII10 / DGS10 / T10YIE', url: 'https://fred.stlouisfed.org/series/DFII10', ok: !!(macroBoard && macroBoard.ok), why: 'Seri resmi harian untuk yield riil, yield nominal, dan breakeven. Dipakai sebagai konfirmasi kanal kebijakan, dengan tanggal observasi apa adanya.' },
      { name: 'Wire emas & pair USD (FXStreet, ForexLive, Investing, Yahoo GC=F, CNBC, Mining.com, Google News semua situs)', url: 'https://news.google.com/', ok: !!(wire && wire.ok), role: wire && wire.coverage ? wire.coverage.items + ' judul · ' + wire.coverage.distinctSources + ' sumber · ' + wire.coverage.fresh24h + ' dalam 24 jam' : 'tidak tersedia', why: 'Banyak judul disaring hanya untuk emas/dolar/USD. Nada judul dipakai bila beberapa sumber independen searah; tidak ada angka rilis yang diambil dari judul.' },
      { name: 'Feed global terpercaya (resmi, emas, media, YouTube resmi)', url: 'https://news.google.com/', ok: false, why: 'Kumpulan feed resmi/industri/media/YouTube. Bobot akurasi hanya diberikan setelah sumber punya riwayat hasil minimal 4; selebihnya hanya konteks.' }
    ]
  };
}

/* Pembatas biaya AI: satu panel = 8 panggilan. Panel untuk fokus yang sama
   dipakai ulang (default 10 menit) dan ada kuota panel per jendela waktu,
   sehingga refresh data boleh sering tanpa menggandakan panggilan AI. */
const PANEL_CACHE = new Map();
const PANEL_BUDGET = { start: 0, used: 0 };
const PANEL_REUSE_MS = Math.max(0, Number(process.env.NEWS_PANEL_REUSE_MS || 10 * 60000));
const PANEL_MAX = Math.max(1, Number(process.env.NEWS_PANEL_MAX || 6));
const PANEL_WINDOW_MS = 10 * 60000;
function panelBudgetOk() {
  const now = Date.now();
  if (now - PANEL_BUDGET.start > PANEL_WINDOW_MS) { PANEL_BUDGET.start = now; PANEL_BUDGET.used = 0; }
  return PANEL_BUDGET.used < PANEL_MAX;
}
async function aiPanelLimited(pack) {
  const key = String(pack.focus || '') + '|' + String(pack.event && pack.event.ts || '');
  const hit = PANEL_CACHE.get(key);
  if (hit && PANEL_REUSE_MS > 0 && Date.now() - hit.t < PANEL_REUSE_MS) {
    return { ...hit.v, reused: true, reusedAt: new Date(hit.t).toISOString() };
  }
  if (!panelBudgetOk()) {
    if (hit) return { ...hit.v, reused: true, reusedAt: new Date(hit.t).toISOString(), throttle: 'kuota panel AI per 10 menit tercapai' };
    return { ok: false, items: [], total: 0, attempts: 0, errors: ['Kuota panel AI per 10 menit tercapai; analisis mesin tetap dipakai.'], note: 'Panel AI dilewati untuk menghemat biaya. Data, arah mesin, dan analisis dokumen tidak berubah.' };
  }
  PANEL_BUDGET.used++;
  const out = await aiPanel(pack);
  if (out && out.ok) PANEL_CACHE.set(key, { t: Date.now(), v: out });
  return out;
}

/* Panel beberapa AI independen: setiap panelis hanya membaca rilis yang dipilih.
   Urutan penyedia dirotasi agar tidak semuanya memakai provider yang sama bila
   key lain tersedia. Hasil panel tidak mengubah arah mesin; ia menjadi bukti
   pembanding dan bahan sintesis. */
async function aiPanel(pack) {
  /* Satu panelis per penyedia; urutan fallback tetap lengkap. Jadi semua AI
     yang punya key benar-benar dipanggil, bukan hanya tiga yang kebetulan
     tersedia lebih dulu. */
  /* Delapan panelis, tetapi setiap urutan fallback memuat SEMUA penyedia yang
     didukung. Dulu cerebras/github/cohere tidak pernah dicoba, sehingga hanya
     AI tertentu yang benar-benar bekerja saat penyedia utama tidak punya key. */
  const PANEL_PRIMARY = ['gemini', 'zai', 'groq', 'nvidia', 'mistral', 'openrouter', 'sambanova', 'cloudflare'];
  const PANEL_ALL = ['gemini', 'zai', 'groq', 'nvidia', 'mistral', 'cerebras', 'openrouter', 'sambanova', 'github', 'cloudflare', 'cohere'];
  const orders = PANEL_PRIMARY.map(function (first, i) {
    const rest = PANEL_ALL.filter(function (p) { return p !== first; });
    /* Rotasi agar panelis ke-i tidak memakai urutan cadangan yang sama. */
    const rot = rest.slice(i % rest.length).concat(rest.slice(0, i % rest.length));
    return [first].concat(rot);
  });
  const sys = `Kamu salah satu panelis analis makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
FOKUS TUNGGAL: rilis ${pack.focus} (${pack.name}). Jangan menganalisis rilis lain sebagai arah utama; rilis bersamaan hanya boleh disebut sebagai risiko gabungan.
Tugas: baca DATA, lalu beri prakiraan arah emas dan alasan yang bisa diaudit.
ATURAN:
1. Semua angka harus ada di DATA. Jangan mengarang angka, jam, atau level.
2. Bedakan FAKTA (angka/sumber) dari INFERENSI (tafsiran).
3. Bila rilis belum terbit, sebut ini prakiraan pra-rilis, bukan hasil.
4. Jika sinyal saling bertentangan, turunkan confidence; jangan memaksa yakin.
5. Transkrip YouTube adalah caption mentah (bisa auto-caption). Jangan mengambil angka harga/level dari transkrip; hanya untuk konteks naratif.
6. Bahasa Indonesia, padat.
7. Bandingkan angka rilis terakhir dan rilis sebelumnya (jika ada) dengan konsensus; arah rilis berikutnya tetap pra-rilis sampai aktualnya terbit. Jangan mengarang tanggal/angka.
8. "teknikalSMC" adalah konteks struktur live (BOS/CHoCH, FVG/OB, sweep, premium/discount, AMD, kill zone, fib). Pakai hanya untuk menilai apakah pasar mendukung arah; jangan mengubah arah data dan jangan mengarang level.
9. Jika arah data bertentangan dengan struktur SMC, sebut konfliknya dan turunkan confidence; jangan membuat arah kedua.
9b. "wireEmasUSD" adalah kumpulan judul berita emas/dolar/USD dari banyak situs. Pakai hanya untuk konteks naratif dan triangulasi; JANGAN mengutip angka harga/level dari judul dan jangan memakai berita di luar emas/USD.
9c. "fundamentalGlobal" merangkum wire, FRED (yield riil, dolar broad, breakeven), DXY/yield 1 jam, dan kalender USD. Pakai sebagai konteks keyakinan; arah rilis tetap dari aktual vs konsensus dan reaksi nyata. Jangan mengarang angka yang tidak ada.
9d. "panduanRilis" dan "checklistRilis" adalah kerangka resmi untuk rilis ini. Baca komponen sesuai urutan panduan (CPI: headline/core MoM-YoY, shelter, jasa; NFP: payrolls, pengangguran, upah, jam kerja, sektor, revisi 2 bulan; PPI: final demand, barang/jasa, MoM, komponen, revisi; FOMC: keputusan, statement, SEP/dot plot, konferensi pers, perubahan dari rapat lalu). Komponen yang berstatus ok=false TIDAK boleh diisi angka; sebut belum tersedia. "responsPasar" (XAUUSD, DXY, yield nominal, yield riil) hanya konfirmasi — korelasi bisa berubah.
9e. "perbandinganRilis" memisahkan satuan dan periode. Jangan menyamakan CPI headline MoM dengan core YoY, payrolls (ribu) dengan pengangguran (%), atau rate (%) dengan FedWatch (probabilitas). Jika "kalenderAudit.matched"=false, jangan sebut aktual kalender sebagai angka resmi.
9f. "skenarioPasar" adalah skenario awal, bukan hukum harga. Bila pricedIn=true atau "mixed" tidak kosong, sebut bahwa emas bisa bergerak berlawanan karena sudah priced in, komponen bertentangan, atau safe-haven; jangan memaksa arah data.
TEKNIKAL WAJIB UNTUK KONTEKS ENTRY: ${S.DOCTRINE}
Balas HANYA JSON valid:
{"direction":"BUY" atau "SELL","confidence":0-100,"focus_read":"apa yang diukur rilis ini dan mengapa penting","reasons":["alasan berbasis angka, maks 4"],"data_used":["sumber + angka yang dipakai, maks 4"],"why_valid":"mengapa data ini valid/akurat dan apa keterbatasannya","invalidation":"kondisi yang membatalkan arah","pre_event_plan":"langkah 2-3 menit sebelum dan sesudah rilis"}`;
  const brief = {
    fokus: pack.focus, nama: pack.name, definisiFokus: pack.focusMeta || null, komponenFokus: pack.event.related || [],
    /* Checklist diletakkan paling depan supaya tidak terpotong saat payload
       panjang; AI harus membaca komponen rilis sebelum narasi lain. */
    panduanRilis: pack.release && pack.release.guide ? { baca: pack.release.guide.read, aturan: pack.release.guide.rules, reaksi: pack.release.guide.reaction } : null,
    checklistRilis: pack.release ? {
      cakupan: pack.release.coverage, komponen: (pack.release.components || []).map(c => ({ k: c.k, nilai: c.value, sebelumnya: c.prev, perubahan: c.change, unit: c.unit, periode: c.period, ok: c.ok })),
      praRilis: (pack.release.pre || []).map(x => ({ k: x.k, ok: x.ok, nilai: x.d })), belumTerbaca: pack.release.delayed
    } : null,
    responsPasar: pack.release ? pack.release.watch : null,
    perbandinganRilis: pack.compare ? { baris: (pack.compare.rows || []).slice(0, 10).map(x => ({ metrik: x.metric, aktual: x.actual, konsensus: x.forecast, previous: x.previous, perubahan: x.change, revisi: x.revision, unit: x.unit, periode: x.period, sumber: x.source, catatan: x.note })), satuan: pack.compare.units, peringatan: pack.compare.unitWarning } : null,
    skenarioPasar: pack.scenario ? { status: pack.scenario.state, biasData: pack.scenario.dataBias, biasReaksi: pack.scenario.reactionBias, pricedIn: pack.scenario.pricedIn, mixed: pack.scenario.mixed, diMana: pack.scenario.where, pantau: pack.scenario.watch, invalidasi: pack.scenario.invalidation } : null,
    kalenderAudit: pack.calendarAudit || null,
    jadwal: pack.event.when, menitKeRilis: pack.timing ? pack.timing.minutes : null, status: pack.timing ? pack.timing.status : '',
    dampak: pack.event.impact, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, periodeResmi: pack.event.officialPeriod,
    rilisTerakhir: pack.event.lastRelease ? { waktu: pack.event.lastRelease.ts ? new Date(pack.event.lastRelease.ts).toISOString() : null, aktual: pack.event.lastRelease.actual, konsensus: pack.event.lastRelease.forecast, sebelumnya: pack.event.lastRelease.previous } : null,
    rilisSebelumnya: pack.event.previousRelease ? { waktu: pack.event.previousRelease.ts ? new Date(pack.event.previousRelease.ts).toISOString() : null, aktual: pack.event.previousRelease.actual, konsensus: pack.event.previousRelease.forecast, sebelumnya: pack.event.previousRelease.previous } : null,
    rilisBerikutnya: pack.event.nextRelease ? { waktu: pack.event.nextRelease.ts ? new Date(pack.event.nextRelease.ts).toISOString() : null, konsensus: pack.event.nextRelease.forecast, sebelumnya: pack.event.nextRelease.previous } : null,
    mesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, praRilis: pack.timing ? { arah: pack.timing.dir, confidence: pack.timing.confidence, alasan: pack.timing.reasons, nowcast: pack.timing.nowcast } : null, bukti: pack.evidence.slice(0, 7), spike: pack.spike },
    pembelajaran: pack.learning ? { akurasi: pack.learning.accuracy, jumlah: pack.learning.n, catatan: pack.learning.note } : null,
    buktiGlobal: (pack.knowledge && pack.knowledge.items || []).slice(0, 10).map(x => ({ sumber: x.src, judul: x.title, umurJam: x.ageH, kecenderungan: x.lean || 'netral', akurasiSumber: x.sourceAccuracy })),
    wireEmasUSD: pack.goldWire && pack.goldWire.items ? {
      nada: pack.goldWire.tone, cakupan: pack.goldWire.coverage,
      judul: pack.goldWire.items.slice(0, 14).map(x => ({ topik: x.topic, sumber: x.source, umurJam: x.ageH, kecenderungan: x.lean > 0 ? 'naik' : x.lean < 0 ? 'turun' : 'netral', judul: x.title }))
    } : 'tidak tersedia',
    makro: pack.macroBoard ? pack.macroBoard.items : [],
    fundamentalGlobal: pack.fundamental ? {
      wire: pack.fundamental.wire ? { nada: pack.fundamental.wire.label, skor: pack.fundamental.wire.score, cakupan: pack.fundamental.wire.coverage, bias: pack.fundamental.wire.goldBias } : 'tidak tersedia',
      fx: pack.fundamental.fx, kalender: pack.fundamental.calendar, skor: pack.fundamental.score, catatan: pack.fundamental.note
    } : 'tidak tersedia',
    teknikalSMC: pack.technical || null,
    fundamentalGlobal: pack.fundamental || null,
    konteksPasar: pack.marketContext,
    tradingview: pack.tv && pack.tv.price ? { harga: pack.tv.price, bias: pack.tv.label, strength: pack.tv.strength } : 'tidak tersedia',
    rilisBersamaan: pack.concurrent.slice(0, 6).map(x => ({ judul: x.title, waktu: x.when, dampak: x.impact })),
    beritaResmi: (pack.officialNews && pack.officialNews.items || []).slice(0, 6).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    mediaAS: pack.us.items.slice(0, 8).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    youtube: pack.yt.items.slice(0, 8).map(x => ({ judul: x.title, kanal: x.channel, resmi: x.trusted || '', umurJam: x.ageH, stance: x.stance })),
    transkripYouTube: ((pack.yt.transcripts && pack.yt.transcripts.items) || []).map(t => ({ judul: t.title, kanal: t.channel, durasi: t.durationLabel, auto: t.auto, teks: t.text.slice(0, 1400) }))
  };
  const q = 'Data untuk rilis fokus ' + pack.focus + ':\n' + JSON.stringify(brief).slice(0, 15000);
  const errs = [];
  const rs = await Promise.all(orders.map((order, i) => Promise.resolve()
    .then(() => (i === 2 ? new Promise(r => setTimeout(r, 6000)) : null))
    .then(() => C.ai(sys, q, { field: 'xau', temp: 0.12 + i * 0.03, maxTok: 1100, deadlineMs: 22000, order }))
    .then(out => {
      const pj = aiJson(out.text);
      const j = pj.value;
      if (!j) { errs.push('AI-' + (i + 1) + ': JSON tidak valid (' + pj.error + ')'); return null; }
      const s = (v, n) => C.cut(v == null ? '' : v, n || 300);
      const dir = String(j.direction || '').toUpperCase() === 'BUY' ? 'BUY' : String(j.direction || '').toUpperCase() === 'SELL' ? 'SELL' : null;
      if (!dir) return null;
      const conf = Number(j.confidence);
      return {
        id: 'AI-' + (i + 1), provider: out.provider, model: out.model, direction: dir,
        confidence: isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : null,
        focus_read: s(j.focus_read, 400),
        reasons: (Array.isArray(j.reasons) ? j.reasons : []).slice(0, 4).map(x => s(x, 220)).filter(Boolean),
        data_used: (Array.isArray(j.data_used) ? j.data_used : []).slice(0, 4).map(x => s(x, 180)).filter(Boolean),
        why_valid: s(j.why_valid, 400), invalidation: s(j.invalidation, 260), pre_event_plan: s(j.pre_event_plan, 320),
        parse: pj.repaired ? 'repaired' : 'clean'
      };
    })
    .catch(e => { errs.push('AI-' + (i + 1) + ': ' + C.cut(e && e.message || e, 140)); return null; })));
  const items = rs.filter(Boolean);
  const votes = { BUY: 0, SELL: 0 };
  items.forEach(x => { votes[x.direction]++; });
  const confs = items.map(x => x.confidence).filter(v => v != null);
  return {
    ok: items.length > 0, items, votes, attempts: orders.length, invalid: orders.length - items.length,
    total: items.length,
    consensus: items.length ? (votes.BUY === votes.SELL ? 'SPLIT' : votes.BUY > votes.SELL ? 'BUY' : 'SELL') : null,
    agreement: items.length ? Math.round(Math.max(votes.BUY, votes.SELL) / items.length * 100) : 0,
    avgConfidence: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null,
    distinctProviders: [...new Set(items.map(x => x.provider).filter(Boolean))].length,
    errors: errs.slice(0, 8),
    note: 'Tiap panelis memakai urutan penyedia berbeda dan hanya menerima data rilis fokus. Panel tidak mengubah arah mesin.'
  };
}

async function aiDocument(pack, opts) {
  const sys = `Kamu analis makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
Tugas: SATU dokumen ringkasan untuk rilis ${pack.focus} (${pack.name}) dan rilis lain yang muncul bersamaan. Fokus hanya pada ${pack.focus}; rilis lain hanya dibahas sebagai efek gabungan.
ATURAN KERAS:
1. Jangan mengarang angka, tanggal, jam, konsensus, atau level. Semua angka WAJIB dari data di bawah dan sebut sumbernya.
2. Arah final dan status spike SUDAH dihitung mesin dan tidak boleh diubah. Jelaskan alasannya memakai bukti.
3. Bandingkan data terbaru dengan data sebelumnya (bulan/rilis lalu) memakai angka yang tersedia di [RESMI]/[KALENDER]/[MAKRO].
4. [US], [YT], dan [WIRE] hanya konteks narasi; dilarang mengutip harga/level dari judul. Transkrip YouTube resmi hanya konteks kata-kata; jangan memakai angka dari transkrip dan sebut bila caption otomatis. [WIRE] hanya berisi emas/dolar/USD; jangan menambah berita di luar topik itu.
5. Bahasa Indonesia, padat, tanpa markdown.
6. FOKUS HANYA rilis ${pack.focus}. Jangan mencampur arah dari rilis lain; rilis bersamaan hanya risiko gabungan.
7. Panel AI berisi pendapat independen. Jika panel terbelah, jelaskan perbedaannya dan tetap ikuti arah mesin; jangan membuat arah kedua.
8. Jelaskan mengapa data valid/akurat: sumber resmi vs agregator, tanggal observasi, kesegaran, dan triangulasi. Pisahkan fakta dari inferensi.
9. Untuk prediksi 2-3 menit sebelum rilis, tulis prakiraan bersyarat dan confidence; jangan menyebutnya hasil aktual.
10. Ringkasan video resmi (Gemini) hanya konteks argumen dan memang dilarang memuat angka; jangan menambahkan angka dari sana. Jika videoResmi ada, WAJIB ringkas poinnya di youtube_read dan sebut ini bacaan video, bukan transkrip.
11. "pembelajaranBerita" adalah akurasi arah pra-rilis sebelumnya yang dihitung mesin. Sebutkan bila akurasinya rendah dan jelaskan keterbatasannya; JANGAN mengubah arah mesin dan jangan mengarang hasil belajar.
12. "teknikalSMC" adalah konteks struktur live. Tulis "technical_read" dari data itu (bias D1/H4/H1, premium/discount, fase AMD, sweep, kill zone, fib) dan "entry_plan" yang mengikuti mesin: POI + CHoCH/BOS M5 + kill zone + SL 30 pip + TP2 ≥200 pip. Jangan menyarankan arah kedua atau level baru.
12b. WAJIB memakai "panduanRilis" dan "checklistRilis" sesuai rilis fokus: baca komponen yang relevan, bandingkan aktual/konsensus/previous, dan sebut komponen yang belum terbaca sebagai belum tersedia. Jangan mengisi komponen kosong dengan angka. "responsPasar" dipakai untuk menilai konfirmasi XAUUSD/DXY/yield nominal/yield riil, bukan untuk mengganti arah mesin.
12c. "perbandinganRilis" memisahkan setiap metrik dengan satuan dan periodenya. Jangan membandingkan CPI headline MoM dengan core YoY, payrolls (ribu) dengan pengangguran (%), atau rate (%) dengan FedWatch (probabilitas). Jika "satuanBerbeda" atau "skenarioPasar.mixed" berisi konflik, sebut konfliknya dan turunkan confidence. "kalenderAudit" menunjukkan kalender yang dipakai dan apakah angka resmi cocok; jangan menyebut aktual kalender sebagai angka resmi bila belum cocok.
12d. "skenarioPasar" adalah skenario awal, bukan hukum harga. Jika pricedIn=true atau reaksi berlawanan dengan bias data, jelaskan bahwa emas bisa bergerak berlawanan karena sudah priced in/safe-haven, dan jangan memaksa arah data. Jangan menyalin seluruh skenario; ringkas yang relevan.
${S.DOCTRINE}
Balas HANYA JSON valid dengan bentuk:
{"headline":"...","summary":"...","focus_what":"apa yang diukur dan mengapa penting untuk emas","why_gold":"rantai sebab-akibat: data -> USD/yield riil -> emas","why_valid":"mengapa data ini valid dan di mana keterbatasannya","prediction_2_3m":"prakiraan pra-rilis + skenario aktual di atas/di bawah konsensus","confidence":0-100,"fact_vs_inference":"mana fakta, mana tafsiran","youtube_read":"apa yang bisa dan tidak bisa disimpulkan dari YouTube","technical_read":"bias struktur, POI, fase AMD, kill zone","entry_plan":"langkah entry sesuai mesin, bukan arah kedua","data_chain":[{"source":"...","fact":"...","weight":"utama/pendukung/konteks"}],"bull_case":"...","bear_case":"...","comparison":[{"metric":"...","latest":"...","previous":"...","change":"...","source":"..."}],"concurrent":[{"title":"...","when":"...","impact":"...","gold_effect":"..."}],"scenarios":[{"name":"...","if":"...","then":"..."}],"risks":["..."],"validity":["..."],"sources":["..."]}`;
  const data = {
    fokus: { tag: pack.event.tag, judul: pack.event.title, jadwal: pack.event.when, dampak: pack.event.impact, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, sumberResmi: pack.event.actualSource, periodeResmi: pack.event.officialPeriod, sudahTerbit: pack.event.released },
    definisiFokus: pack.focusMeta || null,
    komponenFokus: pack.event.related || [],
    panduanRilis: pack.release && pack.release.guide ? { baca: pack.release.guide.read, aturan: pack.release.guide.rules, reaksi: pack.release.guide.reaction, sumber: pack.release.guide.sources } : null,
    checklistRilis: pack.release ? {
      cakupan: pack.release.coverage, komponen: pack.release.components || [], praRilis: pack.release.pre || [], belumTerbaca: pack.release.delayed
    } : null,
    responsPasar: pack.release ? pack.release.watch : null,
    arahMesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, kejutan: pack.surprise, reaksi: pack.reaction, spike: pack.spike, bukti: pack.evidence.slice(0, 8) },
    timing: pack.timing,
    pembelajaranBerita: pack.learning || null,
    perbandinganRilis: pack.compare || null,
    skenarioPasar: pack.scenario || null,
    kalenderAudit: pack.calendarAudit || null,
    satuanBerbeda: (pack.compare && pack.compare.units || []).length > 1 ? pack.compare.units : [],
    jadwalBerikutnya: pack.reference && (pack.reference.nextFocus || pack.reference.next) ? (pack.reference.nextFocus || pack.reference.next) : null,
    sumberRujukan: pack.sourcesMatrix ? { primer: (pack.sourcesMatrix.primary || []).map(x => x.name), kalender: (pack.sourcesMatrix.secondary || []).map(x => x.name) } : null,
    buktiGlobal: (pack.knowledge && pack.knowledge.items || []).slice(0, 12).map(x => ({ sumber: x.src, judul: x.title, umurJam: x.ageH, kecenderungan: x.lean || 'netral', akurasiSumber: x.sourceAccuracy })),
    penilaianSumber: pack.knowledge ? pack.knowledge.bias : null,
    teknikalSMC: pack.technical || null,
    panelAI: pack.aiPanel ? { votes: pack.aiPanel.votes, consensus: pack.aiPanel.consensus, agreement: pack.aiPanel.agreement, avgConfidence: pack.aiPanel.avgConfidence, providers: pack.aiPanel.distinctProviders, pendapat: pack.aiPanel.items.map(x => ({ arah: x.direction, confidence: x.confidence, alasan: x.reasons, valid: x.why_valid })) } : null,
    resmi: { ...pack.official, dipakaiSebagaiAktual: pack.event.actualOfficial != null, catatan: pack.event.actualOfficial != null ? 'angka resmi cocok dengan periode rilis' : 'angka FRED terbaru hanya konteks historis; JANGAN disebut sebagai aktual rilis ini' },
    makroFRED: pack.macroBoard ? pack.macroBoard.items : [],
    harga: { xau: pack.price, sumber: pack.priceSource, spot: pack.spot, tradingview: pack.tv && pack.tv.price ? { harga: pack.tv.price, bias: pack.tv.label, rekomendasi: pack.tv.tf } : 'tidak tersedia' },
    rilisBersamaan: pack.concurrent.slice(0, 8),
    konteksPasar: pack.marketContext,
    beritaResmi: (pack.officialNews && pack.officialNews.items || []).slice(0, 6).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    beritaMediaAS: pack.us.items.slice(0, 8).map(x => ({ judul: x.title, sumber: x.source, umurJam: x.ageH })),
    wireEmasUSD: pack.goldWire && pack.goldWire.items ? { nada: pack.goldWire.tone, cakupan: pack.goldWire.coverage, judul: pack.goldWire.items.slice(0, 14).map(x => ({ topik: x.topic, sumber: x.source, umurJam: x.ageH, kecenderungan: x.lean > 0 ? 'naik' : x.lean < 0 ? 'turun' : 'netral', judul: x.title })) } : 'tidak tersedia',
    youtube: pack.yt.items.slice(0, 8).map(x => ({ judul: x.title, kanal: x.channel, resmi: x.trusted || '', umurJam: x.ageH, stance: x.stance })),
    transkripYouTube: ((pack.yt.transcripts && pack.yt.transcripts.items) || []).map(t => ({ judul: t.title, kanal: t.channel, durasi: t.durationLabel, auto: t.auto, chars: t.chars, teks: t.text })),
    videoResmi: pack.yt.videoRead || null,
    youtubeRingkas: { total: pack.yt.items.length, tally: pack.yt.tally || null, transkrip: pack.yt.transcripts ? pack.yt.transcripts.note : 'tidak tersedia' },
    sumber: pack.sources
  };
  /* Payload dipangkas dan field dipaksa ringkas. Model yang kehabisan token
     adalah penyebab paling umum JSON terpotong; parser repair tetap menjadi
     jaring kedua, bukan alasan untuk menerima dokumen yang tidak lengkap. */
  const out = await C.ai(sys, 'Susun dokumen news sekarang dari data ini. Ringkas: maks 60 kata per field naratif; jangan ulangi seluruh data:\n' + JSON.stringify(data).slice(0, 17500), { field: 'xau', temp: 0.15, maxTok: 4200, deadlineMs: (opts && opts.deadlineMs) || 40000 });
  const pj = aiJson(out.text);
  const j = pj.value;
  if (!j) throw new Error('Balasan AI bukan JSON valid (' + pj.error + ')');
  const doc = sanitizeDoc(j);
  if (!doc.headline && !doc.summary && !doc.focus_what && !doc.entry_plan) throw new Error('Dokumen AI kosong setelah parsing');
  return { doc, provider: out.provider, model: out.model, repaired: pj.repaired };
}

/* Audit AI kedua: memeriksa apakah dokumen memakai angka yang benar-benar ada
   di data. Hasilnya tidak mengubah arah; hanya menandai ketidakcocokan. */
async function aiAudit(pack, opts) {
  const sys = `Kamu auditor data makro XAUUSD. Waktu UTC: ${new Date().toUTCString()}.
Periksa dokumen ringkasan di bawah terhadap DATA. Tugasmu HANYA memeriksa kesesuaian angka dan sumber, bukan mengubah arah.
Aturan: setiap angka di dokumen harus ada di data (konsensus, aktual kalender, angka resmi FRED, papan makro, reaksi, spike, harga). Tandai angka yang tidak ada atau berbeda.
JANGAN mengaudit harga pasar XAU, level entry, TP, angka turunan harga, atau skor confidence/keyakinan — semuanya penilaian mesin/AI. Fokus HANYA pada angka rilis: konsensus, aktual kalender, angka resmi FRED/BLS, dan papan makro. Jangan menandai perbedaan pembulatan.
Periksa juga arah: jika dokumen menyarankan BUY/SELL yang berlawanan dengan arahMesin, tambahkan issue konkret. Jangan mengubah arah; hanya menandai kontradiksi.
${S.DOCTRINE}
Balas HANYA JSON: {"consistent":true|false,"issues":["masalah konkret maks 160 karakter"],"confidence":0-100}`;
  const data = {
    fokus: { tag: pack.event.tag, judul: pack.event.title, jadwal: pack.event.when, konsensus: pack.event.forecast, previous: pack.event.previous, aktualKalender: pack.event.actual, aktualResmi: pack.event.actualOfficial, periodeResmi: pack.event.officialPeriod },
    resmiFRED: { ...pack.official, dipakaiSebagaiAktual: pack.event.actualOfficial != null }, reaksi: pack.reaction, spike: pack.spike, arahMesin: { arah: pack.direction, sumber: pack.directionSource, skor: pack.score, bukti: pack.evidence },
    harga: { xau: pack.price, sumber: pack.priceSource },
    panel: pack.aiPanel ? { votes: pack.aiPanel.votes, agreement: pack.aiPanel.agreement, avgConfidence: pack.aiPanel.avgConfidence } : null,
    dokumen: { headline: pack.doc.headline, summary: pack.doc.summary, why_gold: pack.doc.why_gold, why_valid: pack.doc.why_valid, prediction_2_3m: pack.doc.prediction_2_3m, technical_read: pack.doc.technical_read, entry_plan: pack.doc.entry_plan, data_chain: pack.doc.data_chain, comparison: pack.doc.comparison, scenarios: pack.doc.scenarios }
  };
  const out = await C.ai(sys, 'Audit dokumen ini:\n' + JSON.stringify(data).slice(0, 14000), { field: 'xau-audit', temp: 0, maxTok: 900, deadlineMs: (opts && opts.deadlineMs) || 20000 });
  const pj = aiJson(out.text);
  const j = pj.value;
  if (!j) throw new Error('Audit AI bukan JSON (' + pj.error + ')');
  return {
    consistent: j.consistent === true,
    issues: (Array.isArray(j.issues) ? j.issues : []).slice(0, 5).map(x => C.cut(x, 180)),
    confidence: isFinite(Number(j.confidence)) ? Math.max(0, Math.min(100, Number(j.confidence))) : null,
    provider: out.provider, model: out.model, repaired: pj.repaired
  };
}

/* Cadangan saat caption YouTube diblokir dari IP server: minta Gemini membaca
   video resmi. Output dilarang memuat angka; hanya ringkasan argumen. */
async function videoFallback(pack) {
  if (pack.yt && pack.yt.transcripts && pack.yt.transcripts.ok) return null;
  const exact = /^(bloomberg television|bloomberg news|reuters|cnbc|cnbc television)$/i;
  const rel = /gold|xau|bullion|emas|precious|\bnfp\b|payroll|inflation|\bcpi\b|\bppi\b|\bfomc\b|\bfed\b|dollar|yield|\brate\b|market/i;
  const gold = /gold|xau|bullion|emas|precious/i;
  const pick = (pack.yt.items || []).filter(x => exact.test(String(x.channel || '')) && rel.test(String(x.title || '')) && x.lengthSec >= 30 && x.lengthSec <= 1200 && (x.ageH == null || x.ageH <= 96))
    .sort((a, b) => (gold.test(String(b.title)) ? 1 : 0) - (gold.test(String(a.title)) ? 1 : 0) || (a.ageH == null ? 9999 : a.ageH) - (b.ageH == null ? 9999 : b.ageH))[0];
  if (!pick) return { ok: false, error: 'Tidak ada video resmi <=20 menit dalam 96 jam terakhir.' };
  const r = await C.videoRead(pick.id, pick.title);
  if (!r.ok) return r;
  const j = C.parseJson(r.text) || {};
  return {
    ok: true, title: pick.title, channel: pick.channel, url: pick.url, durationLabel: pick.lengthLabel, durationSec: pick.lengthSec,
    model: r.model, topik: C.cut(j.topik || '', 180),
    poin: (Array.isArray(j.poin) ? j.poin : []).slice(0, 8).map(x => C.cut(x, 260)).filter(Boolean),
    kecenderungan: /bullish|bearish|netral/i.test(String(j.kecenderungan || '')) ? String(j.kecenderungan).toLowerCase() : 'netral',
    catatan: C.cut(j.catatan || '', 400),
    note: 'Ringkasan isi video oleh Gemini, tanpa angka. Bukan transkrip verbatim; caption YouTube tidak dapat diakses dari server.'
  };
}

async function newsHandler(req, res) {
  const b = (req && req.body) || {};
  const focus = TAGS.includes(String(b.focus || '').toUpperCase()) ? String(b.focus).toUpperCase() : 'NFP';
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = 'news:' + focus;
    const t0 = Date.now();
    const learn = b.learn && typeof b.learn === 'object' ? L.normalizeLearn(b.learn) : null;
    const hasLearn = !!(learn && (learn.news.length || learn.radar.length || learn.records.length || learn.sources.length));
    /* Cache global tidak boleh mencampur keyakinan hasil belajar akun lain. */
    let pack = !b.fresh && !hasLearn ? cache.get(key) : null;
    if (pack && Date.now() - pack.t < 30000) return res.status(200).json({ ...pack.v, cached: true });
    const v = await build(focus);
    /* Pembelajaran akurasi berita: hanya menyesuaikan keyakinan, bukan arah. */
    let learning;
    try { learning = L.newsLearning(learn ? learn.news : []); }
    catch (e) { learning = { n: 0, accuracy: null, delta: 0, note: 'Pembelajaran berita tidak dapat dibaca: ' + C.cut(e && e.message || e, 120) }; }
    v.learning = learning;
    if (v.timing) {
      v.baseTimingConfidence = v.timing.confidence;
      v.timing.confidence = Math.max(20, Math.min(92, Math.round((Number(v.timing.confidence) || 50) + learning.delta)));
      if (learning.n) v.timing.caveat = (v.timing.caveat ? v.timing.caveat + ' ' : '') + learning.note;
    }
    /* Bukti global terpercaya: hanya menyesuaikan keyakinan, arah tetap. */
    let kb = null;
    try { kb = await K.load(); } catch (e) { kb = null; }
    try {
      v.knowledge = K.view(kb, learn, 12, v.timing ? v.timing.dir : (v.direction || ''));
      if (Array.isArray(v.sources)) {
        const sg = v.sources.find(x => x && /Feed global terpercaya/.test(String(x.name || '')));
        if (sg) {
          sg.ok = v.knowledge.total > 0;
          sg.role = v.knowledge.total + ' judul · ' + v.knowledge.measured + ' sumber terukur · ' + (v.knowledge.sources || []).filter(x => x.ok).length + ' feed aktif';
        }
      }
      v.learning = { ...learning, sources: v.knowledge.learning };
      if (v.timing && v.knowledge.bias.delta) {
        v.timing.confidence = Math.max(20, Math.min(92, Math.round((Number(v.timing.confidence) || 50) + v.knowledge.bias.delta)));
        v.timing.caveat = (v.timing.caveat ? v.timing.caveat + ' ' : '') + v.knowledge.bias.note;
      }
    } catch (e) {
      v.knowledge = { ok: false, total: 0, items: [], measured: 0, bias: { delta: 0, note: 'Pengetahuan global tidak dapat dibaca: ' + C.cut(e && e.message || e, 120) } };
    }
    const candleAgeMin = v.priceAudit && v.priceAudit.freshMinutes != null ? Number(v.priceAudit.freshMinutes) : null;
    const checks = [
        { k: 'Fokus tunggal terpilih', ok: TAGS.includes(focus) && !!v.event, d: 'Hanya ' + focus + ' yang dipakai untuk arah; rilis lain adalah risiko gabungan.' },
        { k: 'Konsensus untuk fokus ' + focus, ok: !!(v.event && v.event.forecast), d: v.event && v.event.title ? v.event.title : 'tidak tersedia' },
        { k: 'Jadwal rilis terbaca', ok: !!v.event && (!!v.event.when || !!v.event.derived) },
        { k: 'Konsensus tersedia', ok: !!v.event && !!v.event.forecast },
        { k: 'Angka resmi FRED/BLS', ok: !!(v.official && v.official.ok) },
        { k: 'Papan makro global', ok: !!(v.macroBoard && v.macroBoard.ok) },
        { k: 'Harga & candle live', ok: !!(v.tv && v.tv.price) && !!v.marketContext && candleAgeMin != null && candleAgeMin <= 20, d: candleAgeMin == null ? 'umur candle tidak diketahui' : candleAgeMin + ' menit sejak candle M5 terakhir' + (candleAgeMin > 20 ? ' — data tertunda, bukan entry live' : '') },
        { k: 'Media global terpercaya', ok: !!(v.us && v.us.ok) },
        { k: 'YouTube metadata', ok: !!(v.yt && v.yt.ok) },
        { k: 'Konteks teknikal SMC/AMD', ok: !!(v.technical), d: v.technical ? v.technical.note : 'mesin SMC tidak tersedia' },
        { k: 'Pembelajaran berita', ok: learning.n > 0, d: learning.note },
        { k: 'Bukti sumber global terpercaya', ok: !!(v.knowledge && v.knowledge.total > 0), d: v.knowledge ? v.knowledge.bias.note : 'pengetahuan global tidak tersedia' },
        { k: 'Bukti global masih segar (≤24 jam)', ok: !!((v.knowledge && v.knowledge.items || []).some(x => x.ageH != null && Number(x.ageH) <= 24)), d: v.knowledge ? (v.knowledge.items || []).slice(0, 3).map(x => x.src + ' ' + (x.ageH == null ? '?' : x.ageH) + 'j').join(' · ') : 'tidak tersedia' },
        { k: 'Triangulasi ≥3 sumber global', ok: !!((new Set((v.knowledge && v.knowledge.items || []).map(x => x.sid).filter(Boolean))).size >= 3), d: v.knowledge ? (new Set((v.knowledge.items || []).map(x => x.sid).filter(Boolean))).size + ' sumber berbeda' : 'tidak tersedia' },
        { k: 'Wire emas & pair USD', ok: !!(v.goldWire && v.goldWire.items && v.goldWire.items.length >= 5), d: v.goldWire ? (v.goldWire.coverage ? v.goldWire.coverage.items + ' judul · ' + v.goldWire.coverage.distinctSources + ' sumber' : (v.goldWire.note || 'tidak tersedia')) : 'tidak tersedia' },
        { k: 'Wire masih segar (≤24 jam)', ok: !!(v.goldWire && v.goldWire.coverage && v.goldWire.coverage.fresh24h >= 3), d: v.goldWire && v.goldWire.coverage ? v.goldWire.coverage.fresh24h + ' dari ' + v.goldWire.coverage.items + ' judul' : 'tidak tersedia' },
        { k: 'Wire hanya topik emas/USD', ok: !!(v.goldWire && v.goldWire.items && v.goldWire.items.every(x => /emas|dolar|pair USD/i.test(String(x.topic || '')))), d: v.goldWire && v.goldWire.tone ? v.goldWire.tone.note : 'tidak tersedia' },
        { k: 'Fundamental global XAUUSD (wire + FRED + DXY/yield)', ok: !!(v.fundamental && v.fundamental.ok), d: v.fundamental ? v.fundamental.note : 'tidak tersedia' },
        { k: 'Checklist komponen ' + focus + ' (FRED/BLS)', ok: !!(v.release && v.release.coverage && v.release.coverage.total && v.release.coverage.ok >= Math.max(2, Math.ceil(v.release.coverage.total * 0.5))), d: v.release && v.release.coverage ? v.release.coverage.ok + '/' + v.release.coverage.total + ' komponen terbaca' + ((v.release.delayed || []).length ? ' · belum: ' + (v.release.delayed || []).slice(0, 4).join(', ') : '') : 'checklist tidak tersedia' },
        { k: 'Proxy pra-rilis ' + focus, ok: !!(v.release && (v.release.pre || []).some(x => x.ok)), d: v.release ? (v.release.pre || []).map(x => (x.ok ? 'OK ' : 'BELUM ') + x.k).slice(0, 4).join(' · ') : 'tidak tersedia' },
        { k: 'Respons pasar XAU/DXY/yield/riil', ok: !!(v.release && v.release.watch && v.release.watch.ok), d: v.release && v.release.watch ? v.release.watch.state + ' — ' + v.release.watch.note : 'tidak tersedia' },
        { k: 'Sumber primer rilis ' + focus, ok: !!(v.release && (v.release.sources || []).length >= 3), d: v.release ? (v.release.sources || []).map(x => x.name).slice(0, 3).join(' · ') : 'tidak tersedia' }
    ];
    v.dataQuality = {
      score: Math.round(checks.filter(x => x.ok).length / checks.length * 100),
      ok: checks.filter(x => x.ok).length, total: checks.length, checks,
      note: 'Skor = pemeriksaan data yang lolos / total pemeriksaan. Angka resmi tetap dipisahkan dari judul berita.'
    };
    /* Panel dan pembacaan video resmi berjalan paralel; dokumen memakai keduanya.
       Keduanya WAJIB dibatasi: tanpa batas, satu penyedia AI yang lambat bisa
       memakai seluruh anggaran 57 detik sehingga sintesis tidak pernah jalan dan
       panel Ringkasan mesin menampilkan "AI gagal memberi JSON valid". */
    const guard = (p, ms, onFail) => Promise.race([
      p.catch(onFail),
      new Promise(resolve => setTimeout(() => resolve(onFail(new Error('batas waktu ' + Math.round(ms / 1000) + ' detik'))), ms))
    ]);
    const [panel, video] = await Promise.all([
      guard(aiPanelLimited(v), 20000, e => ({ ok: false, items: [], total: 0, attempts: 0, invalid: 0, errors: ['Panel: ' + C.cut(e && e.message || e, 160)] })),
      guard(videoFallback(v), 16000, e => ({ ok: false, error: C.cut(e && e.message || e, 140) }))
    ]);
    if (video && video.ok) { if (!v.yt || typeof v.yt !== 'object') v.yt = {}; v.yt.videoRead = video; }
    v.aiPanel = panel;
    let ai = null, aiErr = '', aiWhy = '';
    const left = () => 57000 - (Date.now() - t0);
    try {
      if (left() < 12000) {
        aiWhy = 'budget';
        throw new Error('Batas waktu server tercapai sebelum sintesis AI');
      }
      const r = await aiDocument(v, { deadlineMs: Math.max(9000, Math.min(28000, left() - 6000)) });
      ai = r;
    } catch (e) {
      aiErr = C.cut(e && e.message || e, 220);
      aiWhy = /batas waktu|waktu server|deadline|timeout/i.test(aiErr) ? 'timeout' : 'provider';
    }
    /* Jangan biarkan panel Ringkasan AI kosong saat model gagal. Dokumen mesin
       memakai angka yang sama dan ditandai jelas sebagai fallback. */
    v.doc = ai ? ai.doc : fallbackDoc(v, panel, aiErr || 'AI tidak tersedia');
    v.ai = ai
      ? { ok: true, provider: ai.provider, model: ai.model, repaired: !!ai.repaired, fallback: false }
      : { ok: false, fallback: true, provider: 'mesin', model: 'deterministik', error: aiErr || 'AI tidak tersedia', why: aiWhy || 'provider', repaired: false };
    v.ai.panel = { ok: !!panel && panel.ok, total: panel ? panel.total : 0, consensus: panel ? panel.consensus : null, agreement: panel ? panel.agreement : 0 };
    v.ai.panel.errors = (panel && panel.errors || []).slice(0, 6);
    v.ai.panel.attempts = panel ? panel.attempts : 0;
    v.ai.panel.invalid = panel ? panel.invalid : 0;
    if (v.doc && left() > 9000) {
      try {
        const audit = await aiAudit(v, { deadlineMs: Math.min(9000, left() - 2000) });
        v.ai.audit = audit;
        if (audit.issues.length) v.doc.validity = [...(v.doc.validity || []), ...audit.issues.map(x => 'Audit AI: ' + x)].slice(0, 10);
      } catch (e) { v.ai.audit = { ok: false, error: C.cut(e && e.message || e, 120) }; }
    }
    v.aiDirection = ai && ai.doc ? v.direction : null;
    if (v.doc && !v.doc.headline) v.doc.headline = v.name;
    const out = { ...v, notes: [] };
    if (!hasLearn) cache.set(key, { t: Date.now(), v: out });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ ok: false, focus, error: C.cut(e && e.message || e, 260), generatedAt: new Date().toISOString() });
  }
}

module.exports = {
  newsHandler, build, TAGS, NAME, analyse, eventOf, reactionOf, officialActual,
  REFERENCE, SOURCE_MATRIX, SCENARIO_MAP, UNIT_WARNING,
  compareRows, scenarioOf, calendarAudit, playbookOf
};
