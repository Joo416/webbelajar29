'use strict';
/* Uji jalur penuh tanpa jaringan: semua feed dan AI diganti mock.
   Tujuan: membuktikan Tutor, News, Signal, Radar, failover provider, candle
   segar, dan kajian SL 30 menit berjalan di satu proses. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const C = require(path.join(ROOT, 'lib/xau-core.js'));
const S = require(path.join(ROOT, 'lib/signal.js'));
const N = require(path.join(ROOT, 'lib/news.js'));
const R = require(path.join(ROOT, 'lib/radar.js'));
const W = require(path.join(ROOT, 'lib/goldwire.js'));
const K = require(path.join(ROOT, 'lib/knowledge.js'));
const CHAT = require(path.join(ROOT, 'api/chat.js'));
const T = CHAT.__test;

const NOW = Date.now();
const M5 = 300000, M15 = 900000, H1 = 3600000, H4 = 14400000, D1 = 86400000;
function iso(t) { return new Date(t).toISOString(); }
function r2(x) { return Math.round(x * 100) / 100; }
function series(step, n, base, drift, wobble, lastClosed) {
  const out = [];
  let p = base;
  for (let i = 0; i < n; i++) {
    const t = lastClosed - (n - 1 - i) * step;
    const o = p;
    const c = o + drift + Math.sin(i / 5.5) * wobble + Math.cos(i / 2.7) * wobble * .28;
    const h = Math.max(o, c) + Math.abs(Math.sin(i / 3.1)) * wobble * .45 + .12;
    const l = Math.min(o, c) - Math.abs(Math.cos(i / 4.2)) * wobble * .45 - .12;
    out.push({ t, o: r2(o), h: r2(h), l: r2(l), c: r2(c) });
    p = c;
  }
  return out;
}
const m5 = series(M5, 420, 3542, -.045, .95, Math.floor(NOW / M5) * M5 - M5);
const m15 = series(M15, 260, 3546, -.10, 1.8, Math.floor(NOW / M15) * M15 - M15);
const h1 = series(H1, 240, 3550, -.18, 3.2, Math.floor(NOW / H1) * H1 - H1);
const h4 = series(H4, 180, 3560, -.32, 5.5, Math.floor(NOW / H4) * H4 - H4);
const d1 = series(D1, 210, 3570, -.22, 8, Math.floor(NOW / D1) * D1 - D1);
const dxy = series(H1, 220, 104.2, .006, .09, Math.floor(NOW / H1) * H1 - H1);
const us10 = series(H1, 220, 4.11, .002, .012, Math.floor(NOW / H1) * H1 - H1);
const last = m5[m5.length - 1];

function candlePack() {
  return {
    m5: { rows: m5, last, source: 'mock M5', ok: true },
    m15: { rows: m15, last: m15[m15.length - 1], source: 'mock M15', ok: true },
    h1: { rows: h1, last: h1[h1.length - 1], source: 'mock H1', ok: true },
    h4: { rows: h4, last: h4[h4.length - 1], source: 'mock H4', ok: true },
    d1: { rows: d1, last: d1[d1.length - 1], source: 'mock D1', ok: true },
    dxy: { rows: dxy, source: 'mock DXY', ok: true },
    dxyTv: { rows: dxy, source: 'mock DXY', ok: true },
    tnx: { rows: us10, source: 'mock US10Y', ok: true },
    us10Tv: { rows: us10, source: 'mock US10Y', ok: true },
    source: 'mock candle pack', live: true
  };
}
function tvRead() {
  const tf = {};
  ['1', '5', '15', '60', '240', 'D', 'W'].forEach(k => {
    tf[k] = { rec: -.62, recLabel: 'SELL', rsi: 41, value: 12, ema20: last.c + 1, ema50: last.c + 2 };
  });
  return { ok: true, symbol: 'FOREXCOM:XAUUSD', price: last.c, at: NOW, tf, weighted: -.62, bias: -1, biasLabel: 'SELL', strength: 64, source: 'mock scanner' };
}
function spot() { return { ok: true, price: last.c - .18, at: NOW, source: 'mock spot' }; }
function calendar() {
  const events = [
    { title: 'CPI m/m', cur: 'USD', impact: 'High', date: iso(NOW + 6 * H1), forecast: '0.3', previous: '0.2' },
    { title: 'Nonfarm Payrolls', cur: 'USD', impact: 'High', date: iso(NOW + 3 * D1), forecast: '150K', previous: '175K' },
    { title: 'FOMC Statement', cur: 'USD', impact: 'High', date: iso(NOW + 7 * D1), forecast: '', previous: '' }
  ];
  events.ok = true; events.source = 'mock calendar'; events.at = NOW; events.events = events;
  return events;
}
function fred(id) {
  const n = 48, base = id === 'CPIAUCSL' ? 320 : id === 'CPILFESL' ? 326 : id === 'PCEPILFE' ? 128 : 100;
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ d: iso(NOW - (n - 1 - i) * 30 * D1).slice(0, 10), v: r2(base + i * .55 + Math.sin(i / 3) * .12) });
  return { id, ok: true, rows, last: rows[rows.length - 1].v, prev: rows[rows.length - 2].v, source: 'FRED · ' + id, at: NOW };
}
function fredBoard() {
  return {
    ok: true, at: NOW, source: 'mock FRED Board',
    items: [
      { id: 'DFII10', label: 'Yield riil 10Y', value: 1.78, prev: 1.8, chg: -.02, chg5: -.08, date: iso(NOW - D1).slice(0, 10), unit: '%', source: 'FRED · DFII10' },
      { id: 'DTWEXBGS', label: 'Dollar broad', value: 121.4, prev: 121.1, chg: .3, chg5: .9, date: iso(NOW - D1).slice(0, 10), unit: 'poin', source: 'FRED · DTWEXBGS' },
      { id: 'T10YIE', label: 'Breakeven 10Y', value: 2.28, prev: 2.3, chg: -.02, chg5: -.05, date: iso(NOW - D1).slice(0, 10), unit: '%', source: 'FRED · T10YIE' },
      { id: 'DGS10', label: 'Yield 10Y', value: 4.18, prev: 4.17, chg: .01, chg5: -.04, date: iso(NOW - D1).slice(0, 10), unit: '%', source: 'FRED · DGS10' }
    ]
  };
}
function wire() {
  const item = { title: 'Gold slips as dollar firms, CPI in focus', source: 'Reuters', topic: 'emas', lean: -1, ageH: 2, at: iso(NOW - 2 * H1), url: 'https://www.reuters.com/markets/commodities/gold-cpi' };
  return {
    ok: true, at: NOW, items: [item], sources: [{ name: 'Reuters', ok: true, count: 1 }],
    tone: { score: -18, label: 'bearish ringan', goldBias: 'bearish', note: '2 judul emas/USD condong bearish.', bull: 0, bear: 1 },
    coverage: { items: 1, distinctSources: 1, fresh24h: 1 }
  };
}
function youtube() {
  const item = {
    id: 'abc123DEF45', title: 'Gold CPI preview: levels and risk', channel: 'Reuters', trusted: 'Reuters',
    stance: 'bearish', ageH: 3, url: 'https://www.youtube.com/watch?v=abc123DEF45', published: iso(NOW - 3 * H1)
  };
  return {
    ok: true, at: NOW, items: [item], trusted: 1,
    tally: { bullish: 0, bearish: 1, netral: 0 }, notes: [],
    transcripts: { ok: true, items: [{ id: item.id, text: 'Analis membahas CPI dan level gold.', chars: 35 }], note: 'mock transcript' }
  };
}
function knowledgeView() {
  return {
    ok: true, total: 3, measured: 2, at: NOW,
    items: [
      { src: 'Reuters', sid: 'reuters', title: 'Gold slips as dollar firms', url: 'https://www.reuters.com/markets/commodities/gold-cpi', ageH: 2, lean: -1, sourceAccuracy: 62 },
      { src: 'BLS', sid: 'bls', title: 'CPI release schedule', url: 'https://www.bls.gov/cpi/', ageH: 5, lean: 0, sourceAccuracy: 80 }
    ],
    sources: [{ name: 'Reuters', ok: true, count: 1 }, { name: 'BLS', ok: true, count: 1 }],
    bias: { delta: -1.8, note: 'Sumber terukur condong bearish ringan.' },
    learning: { n: 0, note: 'Belum ada hasil terukur.' }
  };
}

/* AI palsu: bentuk jawaban berbeda per peran, seperti provider nyata. */
const panelJson = {
  direction: 'SELL', confidence: 68,
  focus_read: 'CPI panas + dolar kuat menekan emas jangka pendek.',
  reasons: ['Yield riil naik', 'DXY menguat', 'Harga di bawah EMA H1'],
  data_used: ['FRED DFII10', 'TradingView DXY', 'Kalender CPI'],
  why_valid: 'Tiga sumber independen searah; angka berasal dari FRED dan feed harga.',
  invalidation: 'CPI jauh di bawah forecast dan DXY melemah.',
  pre_event_plan: 'Tunggu 15 menit setelah rilis; jangan entry saat spread melebar.'
};
const docJson = {
  headline: 'CPI AS dan arah XAUUSD jangka pendek',
  summary: 'CPI menjadi pemicu utama; dolar dan yield riil masih menekan emas.',
  focus_what: 'CPI m/m dan core CPI menentukan ekspektasi Fed.',
  why_gold: 'Inflasi lebih tinggi menaikkan yield riil dan menekan emas.',
  why_valid: 'Data resmi BLS/FRED, wire beberapa sumber, dan candle TradingView.',
  prediction_2_3m: 'Bila CPI panas, SELL berlanjut; bila dingin, BUY jangka pendek.',
  confidence: 68,
  fact_vs_inference: 'Angka CPI = fakta; arah 2-3 bulan = inferensi.',
  youtube_read: 'Video dipakai sebagai konteks, bukan bukti angka.',
  technical_read: 'H1 bearish, M15 di bawah EMA50, M5 membuat lower high.',
  entry_plan: 'Entry M5 di supply, SL 30 pip, TP2 minimal 200 pip.',
  data_chain: [{ source: 'BLS', fact: 'CPI dirilis', weight: 'utama' }, { source: 'FRED', fact: 'Yield riil 1.78%', weight: 'pendukung' }],
  bull_case: 'CPI dingin + DXY turun.',
  bear_case: 'CPI panas + yield naik.',
  comparison: [{ item: 'CPI', official: '0.3%', forecast: '0.3%', gap: 'sesuai' }],
  concurrent: [{ event: 'FOMC', date: iso(NOW + 7 * D1), note: 'risiko minggu depan' }],
  scenarios: [{ if: 'CPI > 0.3%', then: 'SELL', probability: 'sedang' }],
  risks: ['Spread melebar saat rilis', 'Revisi data'],
  validity: ['Data resmi', 'Triangulasi sumber'],
  sources: ['BLS', 'FRED', 'Reuters']
};
function fakeAi(system, user, opts) {
  const s = String(system || '');
  let body;
  if (/perutean pertanyaan/.test(s)) {
    body = { on_topic: false, redirect: 'IPS', kind: 'fact', needs_search: true, lang: 'id', standalone: 'Ibu kota Jepang', queries: ['ibu kota Jepang', 'capital of Japan'], countries: [], market: false };
  } else if (/panelis analis makro/.test(s)) {
    body = panelJson;
  } else if (/SATU dokumen ringkasan/.test(s)) {
    body = docJson;
  } else if (/auditor data makro/.test(s)) {
    body = { consistent: true, issues: [], confidence: 82 };
  } else if (/periksa tanda chart M5/.test(s)) {
    let id = 'm1';
    try {
      const payload = JSON.parse(String(user || '').replace(/^[^\n]*\n/, ''));
      if (payload && payload.tanda && payload.tanda[0] && payload.tanda[0].id) id = String(payload.tanda[0].id);
    } catch (e) { }
    body = { bias: 'SELL', summary: 'Struktur bearish; tiga rencana limit menunggu trigger.', marks: [{ id, note: 'Supply M5 searah bias.', confidence: 'SEDANG' }], confluence: ['H1 bearish', 'DXY kuat'], invalidation: 'M5 close di atas zona.' };
  } else {
    body = 'Mock jawaban [1]';
  }
  return { text: typeof body === 'string' ? body : JSON.stringify(body), provider: 'mock-ai', model: 'mock-1', ms: 1 };
}
C.setDeps({ llm: fakeAi });
C.candles = async () => candlePack();
C.tvRead = async () => tvRead();
C.spot = async () => spot();
C.calendar = async () => calendar();
C.fred = async id => fred(id);
C.fredBoard = async () => fredBoard();
C.usNews = async () => ({ ok: true, items: [], sources: [], at: NOW });
C.youtube = async () => youtube();
C.videoRead = async () => ({ ok: true, text: 'Transkrip mock: CPI dan level gold.', model: 'mock-video' });
W.build = async () => wire();
K.load = async () => ({ ok: true, items: [], sources: [] });
K.view = () => knowledgeView();

function mkRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = n => { res.statusCode = n; return res; };
  res.json = j => { res.body = j; return res; };
  return res;
}
async function call(handler, body) {
  const res = mkRes();
  await handler({ body: body || {}, headers: {} }, res);
  return res;
}

test('Tutor lintas bidang: web + Wikipedia + YouTube, Gemini/Groq mati dilewati ke Cerebras', async () => {
  const saved = { fetch: global.fetch, env: { ...process.env } };
  const providerEnv = ['GEMINI', 'GROQ', 'CEREBRAS', 'NVIDIA', 'ZAI', 'MISTRAL', 'GITHUB', 'CLOUDFLARE', 'OPENROUTER', 'SAMBANOVA', 'COHERE', 'SERPER', 'TAVILY', 'BRAVE', 'EXA', 'JINA'];
  providerEnv.forEach(p => {
    for (let i = 0; i <= 5; i++) delete process.env[p + '_API_KEY' + (i ? '_' + i : '')];
    delete process.env[p + '_API_KEYS']; delete process.env[p + '_MODELS'];
  });
  process.env.GEMINI_API_KEY_1 = 'test-gemini';
  process.env.GROQ_API_KEY_1 = 'test-groq';
  process.env.CEREBRAS_API_KEY_1 = 'test-cerebras';
  process.env.CEREBRAS_MODELS = 'gpt-oss-120b';
  process.env.SERPER_API_KEY_1 = 'test-serper';
  T.resetProviderState();

  const calls = [];
  global.fetch = async (url, opts) => {
    const u = String(url), body = (() => { try { return JSON.parse((opts && opts.body) || '{}'); } catch (e) { return {}; } })();
    calls.push(u);
    if (/generativelanguage\.googleapis\.com/.test(u)) return new Response('{"error":{"message":"down"}}', { status: 500, headers: { 'content-type': 'application/json' } });
    if (/api\.groq\.com/.test(u)) return new Response('{"error":{"message":"down"}}', { status: 500, headers: { 'content-type': 'application/json' } });
    if (/api\.cerebras\.ai/.test(u)) {
      const sys = String((body.messages && body.messages[0] && body.messages[0].content) || '');
      let text = 'Tokyo adalah ibu kota Jepang. [1]';
      if (/perutean pertanyaan/.test(sys)) text = JSON.stringify({ on_topic: false, redirect: 'IPS', kind: 'fact', needs_search: true, lang: 'id', standalone: 'Ibu kota Jepang', queries: ['ibu kota Jepang', 'capital of Japan'], countries: [], market: false });
      if (/pemeriksa fakta/.test(sys)) text = JSON.stringify({ verdict: 'ok', issues: [], final: '' });
      return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (/google\.serper\.dev\/search/.test(u)) return new Response(JSON.stringify({ organic: [{ title: 'Tokyo | Britannica', link: 'https://www.britannica.com/place/Tokyo', snippet: 'Tokyo is the capital of Japan.' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/google\.serper\.dev\/videos/.test(u)) return new Response(JSON.stringify({ videos: [{ title: 'Tokyo city guide', link: 'https://www.youtube.com/watch?v=abc123DEF45', snippet: 'Tokyo guide', source: 'YouTube' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/wikipedia\.org\/w\/api\.php/.test(u)) {
      const lang = /id\.wikipedia/.test(u) ? 'id' : 'en';
      return new Response(JSON.stringify({ query: { pages: { '1': { pageid: 1, title: 'Tokyo', extract: lang === 'id' ? 'Tokyo adalah ibu kota Jepang.' : 'Tokyo is the capital of Japan.', fullurl: 'https://' + lang + '.wikipedia.org/wiki/Tokyo' } } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (/britannica\.com/.test(u)) return new Response('<html><body>Tokyo is the capital and largest city of Japan.</body></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    throw new Error('mock network tidak dikenal: ' + u);
  };
  try {
    const res = await call(T.tutorHandler, {
      mapel: 'Matematika', level: 'SMP', mode: 'chat', verify: true,
      messages: [{ role: 'user', content: 'Apa ibu kota Jepang? Jelaskan singkat.' }]
    });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.match(String(res.body.text), /Tokyo/i);
    assert.equal(res.body.provider, 'cerebras', 'Gemini/Groq harus dilewati dan Cerebras dipakai');
    assert.ok(res.body.sources.some(s => /wikipedia\.org/i.test(s.uri || '')), 'Wikipedia harus masuk sumber');
    assert.ok(res.body.sources.some(s => s.type === 'video'), 'YouTube harus tetap punya slot');
    assert.ok(calls.some(u => /generativelanguage/.test(u)), 'Gemini dicoba lalu mati');
    assert.ok(calls.some(u => /api\.groq\.com/.test(u)), 'Groq dicoba lalu mati');
  } finally {
    global.fetch = saved.fetch;
    for (const k of Object.keys(process.env)) if (!(k in saved.env)) delete process.env[k];
    Object.keys(saved.env).forEach(k => { process.env[k] = saved.env[k]; });
  }
});

test('News: fokus CPI memakai kalender, FRED, wire, YouTube, dan 8 panelis mock', async () => {
  const savedFetch = global.fetch;
  global.fetch = async () => { throw new Error('mock news network'); };
  try {
  const res = await call(N.newsHandler, { focus: 'CPI', fresh: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 800));
  const j = res.body;
  assert.equal(j.ok, true);
  assert.equal(j.focus, 'CPI');
  assert.equal(j.event && j.event.tag, 'CPI');
  assert.ok(j.doc && /CPI/i.test(j.doc.headline));
  assert.equal(j.ai && j.ai.ok, true);
  assert.ok(j.aiPanel && j.aiPanel.total === 8, 'delapan panelis AI harus terisi');
  assert.ok(Array.isArray(j.sources) && j.sources.length > 0);
  assert.ok(j.sources.every(s => s.why && String(s.why).length > 12), 'setiap sumber wajib punya alasan validitas');
  assert.ok(j.yt && j.yt.items && j.yt.items.length > 0, 'YouTube harus masuk');
  assert.equal(j.fundamental && j.fundamental.ok, true);
  assert.ok(j.fundamental.macro.length >= 3, 'FRED harus masuk fundamental');
  assert.ok(j.fundamental.calendar.length >= 1, 'kalender harus masuk fundamental');
  } finally { global.fetch = savedFetch; }
});

test('Signal: chart semua TF + rencana entry SMC/Fibonacci, SL 30, TP2 >=200', async () => {
  const res = await call(S.signalHandler, { fresh: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 800));
  const j = res.body;
  assert.ok(['BUY', 'SELL'].includes(j.direction), 'arah final tidak boleh WAIT');
  assert.ok(Array.isArray(j.setups) && j.setups.length >= 1, 'minimal satu rencana entry harus muncul');
  ['m5', 'm15', 'h1', 'h4', 'd1', 'w1'].forEach(tf => {
    assert.ok(j.chart && Array.isArray(j.chart[tf]) && j.chart[tf].length > 0, 'chart.' + tf + ' harus ada');
  });
  assert.ok(Array.isArray(j.chart.m1), 'chart.m1 harus berupa array (boleh kosong bila feed M1 gagal)');
  assert.ok(j.mtf && j.mtf.htf && j.mtf.mid && j.mtf.ltf && j.mtf.gate, 'peta multi-TF wajib lengkap');
  assert.ok(Array.isArray(j.mtf.htf.supplyDemand.zones), 'HTF harus menghitung supply/demand');
  assert.ok(Array.isArray(j.mtf.mid.breaks) && Array.isArray(j.mtf.mid.reversals), 'MTF harus menghitung break/reversal');
  assert.equal(typeof j.mtf.ltf.m1Available, 'boolean', 'status ketersediaan M1 wajib jujur');
  j.setups.forEach(s => {
    assert.equal(s.type, 'LIMIT', s.style + ' wajib LIMIT');
    assert.equal(s.order, s.dir === 'BUY' ? 'LIMIT BUY' : 'LIMIT SELL', s.style + ' harus punya arah limit');
    assert.equal(s.slPips, 30, s.style + ' SL wajib 30 pip');
    assert.ok(s.tp2Pips >= 200, s.style + ' TP2 wajib minimal 200 pip');
    assert.ok(['SIAP', 'PENDING', 'TUNGGU'].includes(s.status));
    assert.ok(Array.isArray(s.entrySteps) && s.entrySteps.length > 0, 'langkah entry wajib ada');
    assert.ok(s.mtf && s.mtf.gate, 'setiap setup wajib membawa gate multi-TF');
    assert.equal(s.status === 'SIAP', !!s.mtf.gate.ok, 'SIAP hanya boleh bila gate multi-TF lengkap');
    assert.ok(/1D–4H/.test(s.entrySteps.join(' ')) && /5m–1m/.test(s.entrySteps.join(' ')), 'langkah entry wajib memuat urutan 1D–4H dan 5m–1m');
  });
  assert.ok(j.ai && j.ai.ok, 'catatan AI harus terpasang');
  assert.ok(j.ai.annotated > 0, 'AI harus menganotasi minimal satu tanda');
  assert.ok(j.markers.some(m => m.ai && m.ai.note), 'catatan tanda harus menempel');
});

test('Radar: horizon 30 menit, sumber beralasan, arah dari fundamental', async () => {
  const res = await call(R.radarHandler, { fresh: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 800));
  const j = res.body;
  assert.equal(j.horizonMin, 30);
  assert.equal(j.refreshMin, 30);
  assert.ok(['BUY', 'SELL', 'WAIT'].includes(j.direction));
  assert.ok(j.sources.length > 0 && j.sources.every(s => s.why && String(s.why).length > 12));
  assert.ok(j.fundamental && j.fundamental.score && j.fundamental.note);
  assert.ok(j.factors.length > 0);
  assert.ok(j.smc && j.smc.ok);
  assert.ok(j.method && /30 menit/i.test(j.method));
});

test('Candle handler: candle M5 segar dari seam TradingView', async () => {
  C.setDeps({ llm: fakeAi, tvCandles: async () => m5 });
  const res = await call(S.candlesHandler, {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.rows.length >= 100);
  assert.equal(res.body.rows[res.body.rows.length - 1].t, m5[m5.length - 1].t);
});

test('Route /api: action xauCandles diteruskan ke handler candle', async () => {
  const savedFetch = global.fetch, savedAccess = process.env.ACCESS_CONTROL;
  const original = S.candlesHandler;
  process.env.ACCESS_CONTROL = 'off';
  global.fetch = async (url) => {
    if (/identitytoolkit\.googleapis\.com/.test(String(url))) return new Response(JSON.stringify({ users: [{ email: 'route@example.com' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error('mock route network: ' + url);
  };
  S.candlesHandler = async (req, res) => res.status(200).json({ ok: true, routed: 'xauCandles' });
  try {
    const res = mkRes();
    await CHAT({ method: 'POST', headers: { authorization: 'Bearer mock' }, body: { action: 'xauCandles' } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.routed, 'xauCandles');
  } finally {
    S.candlesHandler = original;
    global.fetch = savedFetch;
    if (savedAccess == null) delete process.env.ACCESS_CONTROL; else process.env.ACCESS_CONTROL = savedAccess;
  }
});

test('Failover: setiap provider AI yang punya key bisa menjawab', async () => {
  const savedFetch = global.fetch;
  const providerEnv = ['GEMINI', 'GROQ', 'CEREBRAS', 'NVIDIA', 'ZAI', 'MISTRAL', 'GITHUB', 'CLOUDFLARE', 'OPENROUTER', 'SAMBANOVA', 'COHERE'];
  const table = [
    { id: 'gemini', env: 'GEMINI', key: 'GEMINI_API_KEY_1', modelEnv: 'GEMINI_MODELS', model: 'gemini-3.5-flash-lite' },
    { id: 'groq', env: 'GROQ', key: 'GROQ_API_KEY_1', modelEnv: 'GROQ_MODEL', model: 'openai/gpt-oss-120b' },
    { id: 'cerebras', env: 'CEREBRAS', key: 'CEREBRAS_API_KEY_1', modelEnv: 'CEREBRAS_MODELS', model: 'gpt-oss-120b' },
    { id: 'nvidia', env: 'NVIDIA', key: 'NVIDIA_API_KEY_1', modelEnv: 'NVIDIA_MODELS', model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
    { id: 'zai', env: 'ZAI', key: 'ZAI_API_KEY_1', modelEnv: 'ZAI_MODELS', model: 'glm-4.6' },
    { id: 'mistral', env: 'MISTRAL', key: 'MISTRAL_API_KEY_1', modelEnv: 'MISTRAL_MODELS', model: 'mistral-medium-latest' },
    { id: 'github', env: 'GITHUB', key: 'GITHUB_API_KEY_1', modelEnv: 'GITHUB_MODELS', model: 'openai/gpt-4.1-mini' },
    { id: 'cloudflare', env: 'CLOUDFLARE', key: 'CLOUDFLARE_API_KEY_1', modelEnv: 'CLOUDFLARE_MODELS', model: '@cf/meta/llama-3.1-8b-instruct' },
    { id: 'openrouter', env: 'OPENROUTER', key: 'OPENROUTER_API_KEY_1', modelEnv: 'OPENROUTER_MODELS', model: 'google/gemini-2.5-flash' },
    { id: 'sambanova', env: 'SAMBANOVA', key: 'SAMBANOVA_API_KEY_1', modelEnv: 'SAMBANOVA_MODELS', model: 'Meta-Llama-3.3-70B-Instruct' },
    { id: 'cohere', env: 'COHERE', key: 'COHERE_API_KEY_1', modelEnv: 'COHERE_MODELS', model: 'command-r-plus-08-2024' }
  ];
  const clear = () => providerEnv.forEach(p => {
    for (let i = 0; i <= 5; i++) delete process.env[p + '_API_KEY' + (i ? '_' + i : '')];
    delete process.env[p + '_API_KEYS']; delete process.env[p + '_MODELS'];
  });
  try {
    for (const p of table) {
      clear();
      process.env[p.key] = 'test-' + p.id;
      process.env[p.modelEnv] = p.model;
      process.env.CLOUDFLARE_ACCOUNT_ID_1 = 'acct-test';
      T.resetProviderState();
      global.fetch = async (url, opts) => {
        const u = String(url);
        if (p.id === 'gemini') {
          if (!/generativelanguage\.googleapis\.com/.test(u)) throw new Error('url gemini salah: ' + u);
          return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok-gemini' }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (p.id === 'groq' && !/api\.groq\.com/.test(u)) throw new Error('url groq salah: ' + u);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok-' + p.id } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      const out = await T.llm('system test', [{ role: 'user', content: 'jawab ok' }], 128, [], Date.now() + 15000, { field: 'general', temp: 0 }, { order: [p.id] });
      assert.ok(out, p.id + ' harus menghasilkan jawaban');
      assert.equal(out.provider, p.id, p.id + ' harus jadi provider yang dipakai');
      assert.match(String(out.text), new RegExp('ok-' + p.id));
    }
  } finally {
    global.fetch = savedFetch;
    clear();
  }
});

test('Firestore fallback: hasil sukses terakhir dipakai saat Firestore 429', async () => {
  const savedFetch = global.fetch;
  const savedAccess = process.env.ACCESS_CONTROL;
  delete process.env.ACCESS_CONTROL;
  T.accessCache.clear(); T.tradeCache.clear();
  const email = 'fallback@example.com';
  let firestore429 = false;
  global.fetch = async (url) => {
    const u = String(url);
    if (/identitytoolkit\.googleapis\.com/.test(u)) return new Response(JSON.stringify({ users: [{ email }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (/firestore\.googleapis\.com/.test(u)) {
      if (firestore429) return new Response('{"error":{"code":429}}', { status: 429, headers: { 'content-type': 'application/json' } });
      if (/pengguna\//.test(u)) return new Response(JSON.stringify({ fields: { status: { stringValue: 'aktif' }, admin: { booleanValue: false } } }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (/izin_trading\//.test(u)) return new Response(JSON.stringify({ fields: { status: { stringValue: 'disetujui' } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error('mock auth network: ' + u);
  };
  try {
    const first = await T.authorize({ headers: { authorization: 'Bearer mock' } });
    assert.equal(first.ok, true);
    assert.equal(first.trade, true);
    T.accessCache.set(email, { t: Date.now() - 11 * 60000, ok: true, txt: '', admin: false, trade: true });
    firestore429 = true;
    const second = await T.authorize({ headers: { authorization: 'Bearer mock' } });
    assert.equal(second.ok, true, 'gangguan 429 tidak boleh mengunci akun yang valid');
    assert.equal(second.stale, true, 'hasil sukses terakhir harus dipakai sebagai fallback');
    assert.equal(second.trade, true);
  } finally {
    global.fetch = savedFetch;
    if (savedAccess == null) delete process.env.ACCESS_CONTROL; else process.env.ACCESS_CONTROL = savedAccess;
    T.accessCache.clear(); T.tradeCache.clear();
  }
});

test('Kajian SL: selesai 30 menit memakai candle M5 segar, bukan payload sinyal lama', () => {
  const store = {};
  const histKey = 'rb_xau_sig_hist_v2';
  const record = {
    key: 'test|DAY|BUY|3500', style: 'DAY', dir: 'BUY', entry: 3500, sl: 3497, tp1: 3510, tp2: 3520, tpMax: 3530,
    createdAt: iso(NOW - 60 * 60000), hitAt: iso(NOW - 50 * 60000), entryHit: true,
    status: 'AKTIF', shadow: false, paper: false, tp1Hit: false, tp2Hit: false, maxHit: false,
    closedAt: null, pips: null, updatedAt: NOW, ctx: {}, patternKeys: []
  };
  store[histKey] = JSON.stringify([record]);
  const ctx = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    Date, Math, JSON, Intl, URL, URLSearchParams, TextEncoder, TextDecoder,
    localStorage: { getItem: k => store[k] == null ? null : store[k], setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, addEventListener: () => {}, visibilityState: 'visible' },
    fetch: async () => { throw new Error('no network'); },
    user: null,
    window: null
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.__RB_TEST__ = true;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'rb-xau.js'), 'utf8'), ctx, { filename: 'rb-xau.js' });
  const H = ctx.window.__rbTest;
  assert.ok(H && H.histUpdate, 'hook uji riwayat harus tersedia');

  /* Candle segar: entry 50 menit lalu, SL 40 menit lalu, TP2 tersentuh setelah SL. */
  const rows = [];
  for (let i = 0; i < 13; i++) {
    const t = Math.floor((NOW - 65 * 60000) / M5) * M5 + i * M5;
    let o = 3501, h = 3504, l = 3499, c = 3502;
    if (t >= NOW - 40 * 60000 && t < NOW - 35 * 60000) { o = 3500; h = 3501; l = 3496.4; c = 3497.2; }
    else if (t >= NOW - 35 * 60000) { o = 3505; h = 3521; l = 3503; c = 3519; }
    rows.push({ t, o, h, l, c });
  }
  const j = { generatedAt: iso(NOW - 65 * 60000), chart: { m5: [] }, setups: [] };
  H.histUpdate(j, rows);
  const h = H.histLoad()[0];
  assert.equal(h.status, 'SL', 'SL harus terdeteksi dari candle segar');
  assert.ok(h.closedAt, 'waktu SL harus tercatat');
  assert.equal(h.review && h.review.status, 'selesai', 'kajian harus selesai setelah 30 menit');
  assert.ok(h.review.barsPost > 0, 'harus ada candle setelah SL');
  assert.equal(h.review.reachedTp2AfterSl, true, 'TP2 setelah SL harus tercatat');
  assert.ok(h.review.postSlMfePips >= 200, 'MFE setelah SL dihitung dari candle segar');
  assert.match(H.histOutcomeHtml(h), /Kajian 30 menit selesai/i);
});
