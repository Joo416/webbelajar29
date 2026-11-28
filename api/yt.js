/* =====================================================================
   PENCARIAN YOUTUBE — dipakai panel musik di halaman utama.
   Memakai YouTube Data API bila YOUTUBE_API_KEY tersedia. Tanpa key,
   endpoint membaca halaman hasil pencarian publik YouTube dan mengambil
   videoId + judul. Tidak ada video yang diunduh; pemutaran tetap lewat
   IFrame Player resmi YouTube di browser pengguna.
   ===================================================================== */
'use strict';

async function official(q, key) {
  const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&hl=id&q='
    + encodeURIComponent(q) + '&key=' + encodeURIComponent(key);
  const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('YouTube API membalas ' + r.status);
  const j = await r.json();
  return (j.items || []).map(function (x) {
    const id = x.id && x.id.videoId;
    if (!id) return null;
    const sn = x.snippet || {};
    return {
      id: id,
      title: String(sn.title || 'Video YouTube').slice(0, 140),
      channel: String(sn.channelTitle || '').slice(0, 80),
      thumb: sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.default) ? (sn.thumbnails.medium || sn.thumbnails.default).url : ('https://i.ytimg.com/vi/' + id + '/mqdefault.jpg')
    };
  }).filter(Boolean);
}

async function scrape(q) {
  const u = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&hl=id&gl=ID';
  const r = await fetch(u, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.7'
    }
  });
  if (!r.ok) throw new Error('YouTube membalas ' + r.status);
  const html = await r.text();
  const out = [], seen = {};
  const re = /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,4000}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const id = m[1];
    if (seen[id]) continue;
    seen[id] = 1;
    let title = '';
    try { title = JSON.parse('"' + m[2] + '"'); } catch (e) { title = m[2]; }
    out.push({ id: id, title: String(title || 'Video YouTube').slice(0, 140), channel: '', thumb: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' });
  }
  if (!out.length) throw new Error('Hasil pencarian YouTube tidak bisa dibaca. Tempel tautan video langsung.');
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  const q = String((req.query && req.query.q) || '').trim().slice(0, 90);
  if (!q) return res.status(400).json({ ok: false, error: 'Kata kunci kosong.' });
  try {
    const key = process.env.YOUTUBE_API_KEY;
    let items = [];
    let source = 'youtube-api';
    if (key) {
      try { items = await official(q, key); } catch (e) { items = []; }
    }
    if (!items.length) { items = await scrape(q); source = 'youtube-public'; }
    if (!items.length) return res.status(404).json({ ok: false, error: 'Tidak ada video yang cocok.' });
    return res.status(200).json({ ok: true, source: source, query: q, items: items });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String((e && e.message) || e).slice(0, 220) });
  }
};