/* ===== DATA: kosakata Jepang sehari-hari ===== */
/* kana|romaji|arti|kategori */
const LB_JP_VOCAB_RAW = `
おはよう|ohayou|selamat pagi|Sapaan
こんにちは|konnichiwa|selamat siang|Sapaan
こんばんは|konbanwa|selamat malam|Sapaan
おやすみなさい|oyasuminasai|selamat tidur|Sapaan
ありがとう|arigatou|terima kasih|Sapaan
すみません|sumimasen|maaf, permisi|Sapaan
はい|hai|iya|Sapaan
いいえ|iie|tidak|Sapaan
さようなら|sayounara|selamat tinggal|Sapaan
お願いします|onegaishimasu|tolong|Sapaan
はじめまして|hajimemashite|senang berkenalan|Sapaan
どうぞよろしく|douzo yoroshiku|mohon bantuannya|Sapaan
いち|ichi|satu|Angka
に|ni|dua|Angka
さん|san|tiga|Angka
よん|yon|empat|Angka
ご|go|lima|Angka
ろく|roku|enam|Angka
なな|nana|tujuh|Angka
はち|hachi|delapan|Angka
きゅう|kyuu|sembilan|Angka
じゅう|juu|sepuluh|Angka
ひゃく|hyaku|seratus|Angka
せん|sen|seribu|Angka
まん|man|sepuluh ribu|Angka
いま|ima|sekarang|Waktu
きょう|kyou|hari ini|Waktu
あした|ashita|besok|Waktu
きのう|kinou|kemarin|Waktu
あさ|asa|pagi|Waktu
ひる|hiru|siang|Waktu
よる|yoru|malam|Waktu
じかん|jikan|waktu, jam|Waktu
ふん|fun|menit|Waktu
なんじ|nanji|jam berapa|Waktu
げつようび|getsuyoubi|Senin|Waktu
にちようび|nichiyoubi|Minggu|Waktu
せんしゅう|senshuu|minggu lalu|Waktu
らいしゅう|raishuu|minggu depan|Waktu
かぞく|kazoku|keluarga|Keluarga
ちち|chichi|ayah|Keluarga
はは|haha|ibu|Keluarga
あに|ani|kakak laki-laki|Keluarga
あね|ane|kakak perempuan|Keluarga
おとうと|otouto|adik laki-laki|Keluarga
いもうと|imouto|adik perempuan|Keluarga
こども|kodomo|anak|Keluarga
そふ|sofu|kakek|Keluarga
そぼ|sobo|nenek|Keluarga
おっと|otto|suami|Keluarga
つま|tsuma|istri|Keluarga
ごはん|gohan|nasi, makanan|Makanan
みず|mizu|air|Makanan
おちゃ|ocha|teh|Makanan
コーヒー|koohii|kopi|Makanan
パン|pan|roti|Makanan
にく|niku|daging|Makanan
さかな|sakana|ikan|Makanan
やさい|yasai|sayur|Makanan
くだもの|kudamono|buah|Makanan
たまご|tamago|telur|Makanan
ぎゅうにゅう|gyuunyuu|susu sapi|Makanan
ラーメン|raamen|ramen|Makanan
がっこう|gakkou|sekolah|Tempat
いえ|ie|rumah|Tempat
えき|eki|stasiun|Tempat
みせ|mise|toko|Tempat
びょういん|byouin|rumah sakit|Tempat
としょかん|toshokan|perpustakaan|Tempat
こうえん|kouen|taman|Tempat
レストラン|resutoran|restoran|Tempat
ぎんこう|ginkou|bank|Tempat
ゆうびんきょく|yuubinkyoku|kantor pos|Tempat
くうこう|kuukou|bandara|Tempat
ホテル|hoteru|hotel|Tempat
たべる|taberu|makan|Kata kerja
のむ|nomu|minum|Kata kerja
いく|iku|pergi|Kata kerja
くる|kuru|datang|Kata kerja
みる|miru|melihat|Kata kerja
きく|kiku|mendengar, bertanya|Kata kerja
はなす|hanasu|berbicara|Kata kerja
よむ|yomu|membaca|Kata kerja
かく|kaku|menulis|Kata kerja
かう|kau|membeli|Kata kerja
うる|uru|menjual|Kata kerja
する|suru|melakukan|Kata kerja
ねる|neru|tidur|Kata kerja
おきる|okiru|bangun tidur|Kata kerja
べんきょうする|benkyou suru|belajar|Kata kerja
はたらく|hataraku|bekerja|Kata kerja
はしる|hashiru|berlari|Kata kerja
あるく|aruku|berjalan|Kata kerja
まつ|matsu|menunggu|Kata kerja
わかる|wakaru|mengerti|Kata kerja
おおきい|ookii|besar|Kata sifat
ちいさい|chiisai|kecil|Kata sifat
たかい|takai|tinggi, mahal|Kata sifat
やすい|yasui|murah|Kata sifat
あたらしい|atarashii|baru|Kata sifat
ふるい|furui|lama|Kata sifat
ながい|nagai|panjang|Kata sifat
みじかい|mijikai|pendek|Kata sifat
あつい|atsui|panas|Kata sifat
さむい|samui|dingin|Kata sifat
おいしい|oishii|lezat|Kata sifat
たのしい|tanoshii|menyenangkan|Kata sifat
むずかしい|muzukashii|sulit|Kata sifat
かんたん|kantan|mudah|Kata sifat
きれい|kirei|indah, bersih|Kata sifat
げんき|genki|sehat, bersemangat|Kata sifat
あたま|atama|kepala|Tubuh
かお|kao|wajah|Tubuh
め|me|mata|Tubuh
みみ|mimi|telinga|Tubuh
はな|hana|hidung, bunga|Tubuh
くち|kuchi|mulut|Tubuh
て|te|tangan|Tubuh
あし|ashi|kaki|Tubuh
からだ|karada|tubuh|Tubuh
こころ|kokoro|hati, perasaan|Tubuh
おなか|onaka|perut|Tubuh
かみ|kami|rambut|Tubuh
てんき|tenki|cuaca|Cuaca & alam
あめ|ame|hujan|Cuaca & alam
ゆき|yuki|salju|Cuaca & alam
かぜ|kaze|angin, flu|Cuaca & alam
くもり|kumori|mendung|Cuaca & alam
はれ|hare|cerah|Cuaca & alam
そら|sora|langit|Cuaca & alam
やま|yama|gunung|Cuaca & alam
かわ|kawa|sungai|Cuaca & alam
うみ|umi|laut|Cuaca & alam
はな|hana|bunga|Cuaca & alam
もり|mori|hutan|Cuaca & alam
わたし|watashi|saya|Kata ganti & tanya
あなた|anata|kamu|Kata ganti & tanya
かれ|kare|dia (laki-laki)|Kata ganti & tanya
かのじょ|kanojo|dia (perempuan)|Kata ganti & tanya
これ|kore|ini|Kata ganti & tanya
それ|sore|itu|Kata ganti & tanya
あれ|are|itu (jauh)|Kata ganti & tanya
どこ|doko|di mana|Kata ganti & tanya
なに|nani|apa|Kata ganti & tanya
だれ|dare|siapa|Kata ganti & tanya
いつ|itsu|kapan|Kata ganti & tanya
どうして|doushite|mengapa|Kata ganti & tanya
いくら|ikura|berapa harganya|Kata ganti & tanya
いくつ|ikutsu|berapa banyak|Kata ganti & tanya
でんしゃ|densha|kereta listrik|Transport & benda
くるま|kuruma|mobil|Transport & benda
バス|basu|bus|Transport & benda
じてんしゃ|jitensha|sepeda|Transport & benda
ひこうき|hikouki|pesawat|Transport & benda
でんわ|denwa|telepon|Transport & benda
かさ|kasa|payung|Transport & benda
かぎ|kagi|kunci|Transport & benda
さいふ|saifu|dompet|Transport & benda
とけい|tokei|jam|Transport & benda
ほん|hon|buku|Transport & benda
ペン|pen|pulpen|Transport & benda
`;

const LB_JP_VOCAB = LB_JP_VOCAB_RAW.trim().split('\n').map(function (line) {
  var p = line.split('|');
  return { k: p[0], r: p[1] || '', a: p[2] || '', cat: p[3] || 'Lainnya' };
});
