// Vercel Serverless Function: /api/chat
// Gemini (banyak key, rotasi otomatis, Google Search) -> cadangan Groq.
// Env: GEMINI_API_KEYS="key1,key2,key3,key4,key5" (atau GEMINI_API_KEY_1.._10), GROQ_API_KEY, GEMINI_MODEL, GROQ_MODEL
function geminiKeys() {
  const raw = [process.env.GEMINI_API_KEYS || '', process.env.GEMINI_API_KEY || '',
    ...Array.from({ length: 10 }, (_, i) => process.env['GEMINI_API_KEY_' + (i + 1)] || '')].join(',');
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

async function callGemini(key, system, messages, max, search) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })),
    generationConfig: { maxOutputTokens: max }
  };
  if (search) body.tools = [{ google_search: {} }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.CALL_TIMEOUT_MS || 20000))
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || String(r.status));
  const cand = j.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error('jawaban kosong');
  const sources = (cand?.groundingMetadata?.groundingChunks || []).filter(c => c.web?.uri).map(c => ({ title: c.web.title || 'sumber', uri: c.web.uri }));
  return { text, sources, provider: 'gemini' };
}

async function gemini(system, messages, max, search) {
  const keys = geminiKeys();
  if (!keys.length) throw new Error('Gemini: belum ada key');
  const start = Math.floor(Math.random() * keys.length);
  const errs = [], deadline = Date.now() + 40000;
  const msg = e => (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'timeout (Gemini terlalu lama menjawab)' : e.message;
  for (let i = 0; i < keys.length && Date.now() < deadline; i++) {
    const key = keys[(start + i) % keys.length];
    try { return await callGemini(key, system, messages, max, search); }
    catch (e) {
      errs.push(msg(e));
      if (search && Date.now() < deadline && !/timeout/.test(msg(e))) {
        try { return await callGemini(key, system, messages, max, false); } catch (e2) { errs.push(msg(e2)); }
      }
    }
  }
  throw new Error('Gemini gagal: ' + [...new Set(errs)].join(' | ').slice(0, 300));
}

async function groq(system, messages, max) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      max_tokens: max,
      messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: String(m.content) }))]
    }),
    signal: AbortSignal.timeout(15000)
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Groq: ' + (j.error?.message || r.status));
  const t = j.choices?.[0]?.message?.content || '';
  if (!t) throw new Error('Groq: jawaban kosong');
  return { text: t, sources: [], provider: 'groq' };
}

async function verify(req) {
  const h = req.headers.authorization || '';
  const tk = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tk) return null;
  const key = process.env.FIREBASE_API_KEY || 'AIzaSyDKv_cb50KmpAPv8qxVGspsFQPWPT7Ym2w';
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + key, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tk })
  });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.users && j.users[0] && j.users[0].localId) || 'x';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya POST' });
  if (!(await verify(req))) return res.status(401).json({ error: 'Silakan login dulu' });
  const { system = '', messages = [], big = false, search = false } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || JSON.stringify(messages).length > 30000)
    return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });

  const providers = [];
  if (geminiKeys().length) providers.push(gemini);
  if (process.env.GROQ_API_KEY) providers.push(groq);
  if (!providers.length) return res.status(500).json({ error: 'API key belum diatur di Vercel (GEMINI_API_KEYS atau GROQ_API_KEY)' });

  const errors = [];
  for (const p of providers) {
    try { return res.status(200).json(await p(system, messages, big ? 8000 : 2000, !!search)); }
    catch (e) { errors.push(e.message); }
  }
  res.status(500).json({ error: errors.join(' | ') });
};
