/* ===== DATA: kana Jepang (hiragana & katakana) ===== */
/* Satu baris = satu kelompok bunyi. Katakana dibuat otomatis dari hiragana. */
const LB_KANA_ROWS = [
  ['Vokal', 'あ い う え お', 'a i u e o'],
  ['K', 'か き く け こ', 'ka ki ku ke ko'],
  ['S', 'さ し す せ そ', 'sa shi su se so'],
  ['T', 'た ち つ て と', 'ta chi tsu te to'],
  ['N', 'な に ぬ ね の', 'na ni nu ne no'],
  ['H', 'は ひ ふ へ ほ', 'ha hi fu he ho'],
  ['M', 'ま み む め も', 'ma mi mu me mo'],
  ['Y', 'や ゆ よ', 'ya yu yo'],
  ['R', 'ら り る れ ろ', 'ra ri ru re ro'],
  ['W', 'わ を ん', 'wa wo n'],
  ['Dakuten G', 'が ぎ ぐ げ ご', 'ga gi gu ge go'],
  ['Dakuten Z', 'ざ じ ず ぜ ぞ', 'za ji zu ze zo'],
  ['Dakuten D', 'だ ぢ づ で ど', 'da ji zu de do'],
  ['Dakuten B', 'ば び ぶ べ ぼ', 'ba bi bu be bo'],
  ['Handakuten P', 'ぱ ぴ ぷ ぺ ぽ', 'pa pi pu pe po'],
  ['Youon K', 'きゃ きゅ きょ', 'kya kyu kyo'],
  ['Youon S', 'しゃ しゅ しょ', 'sha shu sho'],
  ['Youon T', 'ちゃ ちゅ ちょ', 'cha chu cho'],
  ['Youon N', 'にゃ にゅ にょ', 'nya nyu nyo'],
  ['Youon H', 'ひゃ ひゅ ひょ', 'hya hyu hyo'],
  ['Youon M', 'みゃ みゅ みょ', 'mya myu myo'],
  ['Youon R', 'りゃ りゅ りょ', 'rya ryu ryo'],
  ['Youon G', 'ぎゃ ぎゅ ぎょ', 'gya gyu gyo'],
  ['Youon J', 'じゃ じゅ じょ', 'ja ju jo'],
  ['Youon B', 'びゃ びゅ びょ', 'bya byu byo'],
  ['Youon P', 'ぴゃ ぴゅ ぴょ', 'pya pyu pyo']
];

/* hiragana -> katakana: ぁ..ゖ bergeser 0x60 */
function lbToKatakana(s) {
  return Array.from(String(s)).map(function (c) {
    var p = c.charCodeAt(0);
    return (p >= 0x3041 && p <= 0x3096) ? String.fromCharCode(p + 0x60) : c;
  }).join('');
}

/* ===== Kanji N5 (dasar) ===== */
/* kanji|on'yomi|kun'yomi|arti|kata=かき=arti;kata2=かき=arti (dipisah ;) */
const LB_KANJI_RAW = `
日|ニチ, ジツ|ひ, -び|hari, matahari|日本=にほん=Jepang;日曜日=にちようび=Minggu
一|イチ, イツ|ひと-|satu|一つ=ひとつ=satu buah;一月=いちがつ=Januari
二|ニ|ふた-|dua|二つ=ふたつ=dua buah;二月=にがつ=Februari
三|サン|みっ-|tiga|三つ=みっつ=tiga buah;三月=さんがつ=Maret
四|シ|よん, よ, よっ-|empat|四つ=よっつ=empat buah;四月=しがつ=April
五|ゴ|いつ-|lima|五つ=いつつ=lima buah;五月=ごがつ=Mei
六|ロク|むっ-|enam|六つ=むっつ=enam buah;六月=ろくがつ=Juni
七|シチ|なな, ななっ-|tujuh|七つ=ななつ=tujuh buah;七月=しちがつ=Juli
八|ハチ|やっ-|delapan|八つ=やっつ=delapan buah;八月=はちがつ=Agustus
九|キュウ, ク|ここの-|sembilan|九つ=ここのつ=sembilan buah;九月=くがつ=September
十|ジュウ|とお|sepuluh|十=じゅう=sepuluh;十月=じゅうがつ=Oktober
百|ヒャク|もも|seratus|百円=ひゃくえん=100 yen;三百=さんびゃく=tiga ratus
千|セン|ち|seribu|千円=せんえん=1.000 yen;三千=さんぜん=tiga ribu
万|マン|よろず|sepuluh ribu|一万=いちまん=10.000;万円=まんえん=uang yen
円|エン|まる|yen, bulat|百円=ひゃくえん=100 yen;円い=まるい=bulat
人|ジン, ニン|ひと|orang|日本人=にほんじん=orang Jepang;一人=ひとり=satu orang
大|ダイ, タイ|おお-|besar|大きい=おおきい=besar;大学=だいがく=universitas
小|ショウ|ちい-|kecil|小さい=ちいさい=kecil;小学校=しょうがっこう=SD
中|チュウ|なか|tengah, dalam|中=なか=dalam;中国=ちゅうごく=Tiongkok
上|ジョウ|うえ, あ-|atas|上=うえ=atas;上手=じょうず=pandai
下|カ, ゲ|した, さ-|bawah|下=した=bawah;地下鉄=ちかてつ=kereta bawah tanah
左|サ|ひだり|kiri|左=ひだり=kiri;左手=ひだりて=tangan kiri
右|ウ, ユウ|みぎ|kanan|右=みぎ=kanan;右手=みぎて=tangan kanan
前|ゼン|まえ|depan, sebelum|前=まえ=depan;午前=ごぜん=pagi
後|ゴ, コウ|あと, うし-|belakang, setelah|後=あと=setelah;午後=ごご=sore
内|ナイ|うち|dalam|内=うち=dalam;案内=あんない=panduan
外|ガイ, ゲ|そと|luar|外=そと=luar;外国=がいこく=luar negeri
東|トウ|ひがし|timur|東=ひがし=timur;東京=とうきょう=Tokyo
西|セイ, サイ|にし|barat|西=にし=barat;関西=かんさい=Kansai
南|ナン|みなみ|selatan|南=みなみ=selatan;南口=みなみぐち=gerbang selatan
北|ホク|きた|utara|北=きた=utara;北海道=ほっかいどう=Hokkaido
月|ゲツ, ガツ|つき|bulan|月曜日=げつようび=Senin;一月=いちがつ=Januari
火|カ|ひ|api|火曜日=かようび=Selasa;火山=かざん=gunung berapi
水|スイ|みず|air|水曜日=すいようび=Rabu;水=みず=air
木|モク, ボク|き|pohon|木曜日=もくようび=Kamis;木=き=pohon
金|キン, コン|かね|emas, uang|金曜日=きんようび=Jumat;お金=おかね=uang
土|ド, ト|つち|tanah|土曜日=どようび=Sabtu;土地=とち=tanah
年|ネン|とし|tahun|今年=ことし=tahun ini;年生=ねんせい=kelas
時|ジ|とき|waktu, jam|時間=じかん=waktu;三時=さんじ=pukul tiga
分|フン, ブン|わ-|menit, membagi|五分=ごふん=lima menit;分かる=わかる=mengerti
半|ハン|なか-|setengah|半分=はんぶん=setengah;二時半=にじはん=pukul 2.30
今|コン, キン|いま|sekarang|今日=きょう=hari ini;今=いま=sekarang
何|カ|なに, なん|apa|何時=なんじ=jam berapa;何=なに=apa
毎|マイ|ごと|setiap|毎日=まいにち=setiap hari;毎週=まいしゅう=setiap minggu
週|シュウ|-|minggu|今週=こんしゅう=minggu ini;週末=しゅうまつ=akhir pekan
曜|ヨウ|-|hari (dalam sepekan)|曜日=ようび=hari;日曜日=にちようび=Minggu
間|カン, ケン|あいだ|antara, ruang|時間=じかん=waktu;人間=にんげん=manusia
午|ゴ|-|siang|午前=ごぜん=pagi;午後=ごご=sore
名|メイ, ミョウ|な|nama|名前=なまえ=nama;有名=ゆうめい=terkenal
女|ジョ, ニョ|おんな|perempuan|女=おんな=perempuan;女性=じょせい=wanita
男|ダン, ナン|おとこ|laki-laki|男=おとこ=laki-laki;男性=だんせい=pria
子|シ|こ|anak|子供=こども=anak;女の子=おんなのこ=anak perempuan
父|フ|ちち|ayah|父=ちち=ayah;お父さん=おとうさん=ayah (sopan)
母|ボ|はは|ibu|母=はは=ibu;お母さん=おかあさん=ibu (sopan)
友|ユウ|とも|teman|友達=ともだち=teman;友人=ゆうじん=sahabat
先|セン|さき|dahulu, ujung|先生=せんせい=guru;先週=せんしゅう=minggu lalu
生|セイ, ショウ|い-, う-, なま|hidup, lahir|学生=がくせい=pelajar;生まれる=うまれる=lahir
学|ガク|まな-|belajar|学校=がっこう=sekolah;大学=だいがく=universitas
校|コウ|-|sekolah|学校=がっこう=sekolah;高校=こうこう=SMA
本|ホン|もと|buku, asal|本=ほん=buku;日本=にほん=Jepang
語|ゴ|かた-|bahasa|日本語=にほんご=bahasa Jepang;英語=えいご=bahasa Inggris
国|コク|くに|negara|国=くに=negara;外国=がいこく=luar negeri
気|キ, ケ|-|semangat, udara|元気=げんき=sehat;天気=てんき=cuaca
天|テン|あめ|langit|天気=てんき=cuaca;天国=てんごく=sorga
雨|ウ|あめ|hujan|雨=あめ=hujan;大雨=おおあめ=hujan lebat
空|クウ|そら, あ-|langit, kosong|空=そら=langit;空気=くうき=udara
山|サン|やま|gunung|山=やま=gunung;富士山=ふじさん=Gunung Fuji
川|セン|かわ|sungai|川=かわ=sungai;小川=おがわ=anak sungai
海|カイ|うみ|laut|海=うみ=laut;海外=かいがい=luar negeri
花|カ|はな|bunga|花=はな=bunga;花見=はなみ=hanami
犬|ケン|いぬ|anjing|犬=いぬ=anjing;子犬=こいぬ=anak anjing
猫|ビョウ|ねこ|kucing|猫=ねこ=kucing;子猫=こねこ=anak kucing
魚|ギョ|さかな|ikan|魚=さかな=ikan;金魚=きんぎょ=ikan mas
鳥|チョウ|とり|burung|鳥=とり=burung;小鳥=ことり=burung kecil
食|ショク|た-|makan|食べる=たべる=makan;食堂=しょくどう=kantin
飲|イン|の-|minum|飲む=のむ=minum;飲み物=のみもの=minuman
見|ケン|み-|melihat|見る=みる=melihat;花見=はなみ=hanami
聞|ブン|き-|mendengar, bertanya|聞く=きく=mendengar;新聞=しんぶん=surat kabar
話|ワ|はな-|berbicara|話す=はなす=berbicara;電話=でんわ=telepon
読|ドク|よ-|membaca|読む=よむ=membaca;読書=どくしょ=membaca buku
書|ショ|か-|menulis|書く=かく=menulis;辞書=じしょ=kamus
行|コウ|い-, ゆ-|pergi|行く=いく=pergi;銀行=ぎんこう=bank
来|ライ|く-|datang|来る=くる=datang;来週=らいしゅう=minggu depan
出|シュツ|で-|keluar|出る=でる=keluar;出口=でぐち=pintu keluar
入|ニュウ|はい-|masuk|入る=はいる=masuk;入口=いりぐち=pintu masuk
立|リツ|た-|berdiri|立つ=たつ=berdiri;国立=こくりつ=negeri
座|ザ|すわ-|duduk|座る=すわる=duduk;座席=ざせき=kursi
買|バイ|か-|membeli|買う=かう=membeli;買い物=かいもの=belanja
教|キョウ|おし-|mengajar|教える=おしえる=mengajar;教室=きょうしつ=kelas
休|キュウ|やす-|istirahat|休む=やすむ=istirahat;休み=やすみ=libur
言|ゲン, ゴン|い-|berkata|言う=いう=berkata;言葉=ことば=kata
高|コウ|たか-|tinggi, mahal|高い=たかい=tinggi;高校=こうこう=SMA
安|アン|やす-|murah, aman|安い=やすい=murah;安心=あんしん=tenang
新|シン|あたら-, あら-|baru|新しい=あたらしい=baru;新聞=しんぶん=surat kabar
古|コ|ふる-|lama, tua|古い=ふるい=lama;中古=ちゅうこ=bekas
長|チョウ|なが-|panjang|長い=ながい=panjang;社長=しゃちょう=direktur
短|タン|みじか-|pendek|短い=みじかい=pendek;短所=たんしょ=kekurangan
多|タ|おお-|banyak|多い=おおい=banyak;多分=たぶん=mungkin
少|ショウ|すこ-, すく-|sedikit|少ない=すくない=sedikit;少し=すこし=sedikit
白|ハク, ビャク|しろ, しら-|putih|白い=しろい=putih;白=しろ=putih
黒|コク|くろ|hitam|黒い=くろい=hitam;黒=くろ=hitam
赤|セキ|あか|merah|赤い=あかい=merah;赤=あか=merah
青|セイ|あお|biru|青い=あおい=biru;青=あお=biru
電|デン|-|listrik|電車=でんしゃ=kereta;電話=でんわ=telepon
車|シャ|くるま|kendaraan|車=くるま=mobil;電車=でんしゃ=kereta
駅|エキ|-|stasiun|駅=えき=stasiun;駅前=えきまえ=depan stasiun
道|ドウ|みち|jalan|道=みち=jalan;道路=どうろ=jalan raya
店|テン|みせ|toko|店=みせ=toko;喫茶店=きっさてん=kafe
家|カ, ケ|いえ, や|rumah|家=いえ=rumah;家族=かぞく=keluarga
室|シツ|-|ruangan|教室=きょうしつ=kelas;会議室=かいぎしつ=ruang rapat
銀|ギン|-|perak|銀行=ぎんこう=bank;銀=ぎん=perak
病|ビョウ|やまい|sakit|病院=びょういん=rumah sakit;病気=びょうき=penyakit
院|イン|-|institusi|病院=びょういん=rumah sakit;大学院=だいがくいん=pascasarjana
手|シュ|て|tangan|手=て=tangan;手紙=てがみ=surat
足|ソク|あし, た-|kaki, cukup|足=あし=kaki;足りる=たりる=cukup
目|モク|め|mata|目=め=mata;目的=もくてき=tujuan
口|コウ|くち|mulut|口=くち=mulut;入口=いりぐち=pintu masuk
耳|ジ|みみ|telinga|耳=みみ=telinga;耳鼻科=じびか=klinik THT
力|リョク, リキ|ちから|tenaga|力=ちから=tenaga;体力=たいりょく=kebugaran
好|コウ|す-, この-|suka|好き=すき=suka;好物=こうぶつ=makanan kesukaan
明|メイ, ミョウ|あか-, あき-|terang|明るい=あかるい=terang;明日=あした=besok
早|ソウ|はや-|cepat, pagi|早い=はやい=cepat;早起き=はやおき=bangun pagi
牛|ギュウ|うし|sapi|牛=うし=sapi;牛肉=ぎゅうにく=daging sapi
豚|トン|ぶた|babi|豚=ぶた=babi;豚肉=ぶたにく=daging babi
肉|ニク|-|daging|肉=にく=daging;牛肉=ぎゅうにく=daging sapi
果|カ|-|buah, hasil|果物=くだもの=buah;結果=けっか=hasil
物|ブツ, モツ|もの|benda|物=もの=benda;食べ物=たべもの=makanan
米|ベイ|こめ|beras|米=こめ=beras;米国=べいこく=AS
茶|チャ|-|teh|お茶=おちゃ=teh;茶色=ちゃいろ=coklat
酒|シュ|さけ|sake, alkohol|酒=さけ=sake;日本酒=にほんしゅ=sake Jepang
石|セキ|いし|batu|石=いし=batu;石鹸=せっけん=sabun
田|デン|た|sawah|田んぼ=たんぼ=sawah;田中=たなか=Tanaka
町|チョウ|まち|kota kecil|町=まち=kota;町長=ちょうちょう=wali kota
村|ソン|むら|desa|村=むら=desa;村人=むらびと=penduduk desa
森|シン|もり|hutan|森=もり=hutan;森林=しんりん=hutan
林|リン|はやし|hutan kecil|林=はやし=hutan;小林=こばやし=Kobayashi
王|オウ|-|raja|王=おう=raja;王国=おうこく=kerajaan
玉|ギョク|たま|bola, permata|玉=たま=bola;目玉=めだま=biji mata
糸|シ|いと|benang|糸=いと=benang;毛糸=けいと=benang wol
貝|バイ|かい|kerang|貝=かい=kerang;貝殻=かいがら=cangkang
虫|チュウ|むし|serangga|虫=むし=serangga;昆虫=こんちゅう=serangga
毛|モウ|け|rambut, bulu|毛=け=bulu;毛糸=けいと=benang wol
竹|チク|たけ|bambu|竹=たけ=bambu;竹林=ちくりん=rumpun bambu
草|ソウ|くさ|rumput|草=くさ=rumput;草花=くさばな=bunga liar
葉|ヨウ|は|daun|葉=は=daun;言葉=ことば=kata
根|コン|ね|akar|根=ね=akar;大根=だいこん=lobak
音|オン|おと, ね|suara|音=おと=suara;音楽=おんがく=musik
楽|ガク, ラク|たの-|musik, nyaman|楽しい=たのしい=menyenangkan;音楽=おんがく=musik
歌|カ|うた|lagu|歌=うた=lagu;歌手=かしゅ=penyanyi
絵|カイ, エ|え|gambar|絵=え=gambar;絵画=かいが=lukisan
映|エイ|うつ-|memantul, film|映画=えいが=film;映る=うつる=terpantul
画|ガ, カク|-|gambar|映画=えいが=film;漫画=まんが=komik
英|エイ|-|Inggris|英語=えいご=bahasa Inggris;英国=えいこく=Inggris
漢|カン|-|Tiongkok (kanji)|漢字=かんじ=kanji;漢方=かんぽう=obat herbal
字|ジ|-|huruf|漢字=かんじ=kanji;字=じ=huruf
文|ブン, モン|ふみ|kalimat, sastra|文=ぶん=kalimat;文化=ぶんか=budaya
化|カ, ケ|-|berubah|文化=ぶんか=budaya;化学=かがく=kimia
地|チ, ジ|-|tanah, bumi|地図=ちず=peta;地球=ちきゅう=bumi
図|ズ, ト|はか-|peta, gambar|地図=ちず=peta;図書館=としょかん=perpustakaan
館|カン|-|gedung|図書館=としょかん=perpustakaan;映画館=えいがかん=bioskop
社|シャ|やしろ|perusahaan, kuil|会社=かいしゃ=perusahaan;神社=じんじゃ=kuil
会|カイ, エ|あ-|bertemu, perkumpulan|会社=かいしゃ=perusahaan;会う=あう=bertemu
同|ドウ|おな-|sama|同じ=おなじ=sama;同時=どうじ=bersamaan
違|イ|ちが-|berbeda|違う=ちがう=berbeda;間違い=まちがい=kesalahan
`;

/* Ubah teks di atas menjadi objek kanji */
const LB_KANJI = LB_KANJI_RAW.trim().split('\n').map(function (line) {
  var p = line.split('|');
  return {
    k: p[0], on: p[1] || '-', kun: p[2] || '-', arti: p[3] || '',
    words: (p[4] || '').split(';').filter(Boolean).map(function (w) {
      var q = w.split('=');
      return { w: q[0], r: q[1] || '', a: q[2] || '' };
    })
  };
});

/* Daftar datar untuk kuis & pencarian */
function lbKanaFlat(script) {
  var out = [];
  LB_KANA_ROWS.forEach(function (row) {
    var ks = row[1].split(' '), rs = row[2].split(' ');
    ks.forEach(function (k, i) {
      var ch = script === 'kata' ? lbToKatakana(k) : k;
      out.push({ k: ch, r: rs[i], row: row[0], script: script });
    });
  });
  return out;
}
