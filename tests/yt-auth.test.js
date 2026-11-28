'use strict';
/* Uji keamanan /api/yt: pencarian YouTube wajib memakai Firebase ID token.
   Tanpa token, dengan token rusak, atau dengan email belum terverifikasi,
   endpoint harus menolak dan TIDAK memanggil YouTube sama sekali. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const handler = require(path.join(ROOT, 'api/yt.js'));

function mkRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = v; };
  res.status = n => { res.statusCode = n; return res; };
  res.json = j => { res.body = j; return res; };
  return res;
}
function mkReq(q, token) {
  return {
    method: 'GET',
    headers: token ? { authorization: 'Bearer ' + token } : {},
    query: q ? { q } : {}
  };
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
const innertubeBody = {
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [{
            itemSectionRenderer: {
              contents: [{
                videoRenderer: {
                  videoId: 'jfKfPfyJRdk',
                  title: { runs: [{ text: 'lofi hip hop radio' }] },
                  ownerText: { runs: [{ text: 'Lofi Girl' }] },
                  lengthText: { simpleText: 'LIVE' }
                }
              }]
            }
          }]
        }
      }
    }
  }
};

test('api/yt: tanpa token ditolak 401 dan YouTube tidak dipanggil', async () => {
  const saved = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return json({}); };
  try {
    const res = mkRes();
    await handler(mkReq('lofi'), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.ok, false);
    assert.match(String(res.body.error), /Token login/i);
    assert.equal(calls, 0, 'tanpa token tidak boleh ada permintaan keluar');
  } finally { global.fetch = saved; }
});

test('api/yt: token tidak valid ditolak 401 tanpa mencari video', async () => {
  const saved = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    if (/identitytoolkit/.test(String(url))) return json({ error: { message: 'INVALID_ID_TOKEN' } }, 400);
    throw new Error('YouTube tidak boleh dipanggil: ' + url);
  };
  try {
    const res = mkRes();
    await handler(mkReq('lofi', 'token-rusak-1'), res);
    assert.equal(res.statusCode, 401);
    assert.match(String(res.body.error), /tidak valid|kedaluwarsa/i);
    assert.ok(!urls.some(u => /youtube/.test(u)), 'pencarian YouTube tidak boleh jalan');
  } finally { global.fetch = saved; }
});

test('api/yt: email belum diverifikasi ditolak 403', async () => {
  const saved = global.fetch;
  global.fetch = async (url) => {
    if (/identitytoolkit/.test(String(url))) {
      return json({ users: [{ localId: 'uid-2', email: 'baru@example.com', emailVerified: false }] });
    }
    throw new Error('YouTube tidak boleh dipanggil: ' + url);
  };
  try {
    const res = mkRes();
    await handler(mkReq('lofi', 'token-unverified'), res);
    assert.equal(res.statusCode, 403);
    assert.match(String(res.body.error), /verifikasi/i);
  } finally { global.fetch = saved; }
});

test('api/yt: token sah mengembalikan hasil pencarian (InnerTube)', async () => {
  const saved = global.fetch;
  const urls = [];
  global.fetch = async (url, opts) => {
    const u = String(url);
    urls.push(u);
    if (/identitytoolkit/.test(u)) {
      const body = JSON.parse(String((opts && opts.body) || '{}'));
      assert.ok(body.idToken, 'idToken wajib dikirim ke Firebase');
      return json({ users: [{ localId: 'uid-3', email: 'siswa@example.com', emailVerified: true }] });
    }
    if (/youtubei\/v1\/search/.test(u)) return json(innertubeBody);
    if (/youtube\.com\/results/.test(u)) return new Response('<html></html>', { status: 200 });
    throw new Error('URL tak terduga: ' + u);
  };
  try {
    const res = mkRes();
    await handler(mkReq('lofi', 'token-sah-abc'), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.items) && res.body.items.length >= 1, 'minimal satu video');
    const v = res.body.items[0];
    assert.equal(v.id, 'jfKfPfyJRdk');
    assert.match(v.title, /lofi/i);
    assert.equal(v.channel, 'Lofi Girl');
    assert.match(String(res.headers['cache-control'] || ''), /private/, 'cache tidak boleh publik untuk respons ber-token');
  } finally { global.fetch = saved; }
});

test('api/yt: kata kunci kosong ditolak 400 setelah token sah', async () => {
  const saved = global.fetch;
  global.fetch = async (url) => {
    if (/identitytoolkit/.test(String(url))) {
      return json({ users: [{ localId: 'uid-4', email: 'siswa2@example.com', emailVerified: true }] });
    }
    throw new Error('YouTube tidak boleh dipanggil: ' + url);
  };
  try {
    const res = mkRes();
    await handler(mkReq('', 'token-sah-kosong'), res);
    assert.equal(res.statusCode, 400);
    assert.match(String(res.body.error), /kosong/i);
  } finally { global.fetch = saved; }
});
