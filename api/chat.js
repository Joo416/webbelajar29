// Vercel Serverless Function: /api/chat  (khusus Gemini + Google Search)
// Env di Vercel: GEMINI_API_KEY_1, GEMINI_API_KEY_2 (atau GEMINI_API_KEYS="k1,k2"), GEMINI_MODEL=gemini-3.8-flash
// Opsional: GEMINI_THINKING (LOW/MEDIUM), CALL_TIMEOUT_MS
function geminiKeys() {
  const raw = [process.env.GEMINI_API_KEYS || '', process.env.GEMINI_API_KEY || '',
    ...Array.from({ length: 10 }, (_, i) => process.env['GEMINI_API_KEY_' + (i + 1)] || '')].join(',');
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

const cooldown = new Map(); // key -> waktu (ms) sampai boleh dipakai lagi setelah kena limit

async function callGemini(key, system, messages, max, search, think) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })),
    generationConfig: { maxOutputTokens: max }
  };
  if (search) body.tools = [{ google_search: {} }];
  if (think && /^gemini-3\.[678]-flash$/.test(model))
    body.generationConfig.thinkingConfig = { thinkingLevel: process.env.GEMINI_THINKING || 'LOW' };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.CALL_TIMEOUT_MS || 28000))
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error(j.error?.message || String(r.status)); e.status = r.status; throw e; }
  const cand = j.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error('jawaban kosong');
  const sources = (cand?.groundingMetadata?.groundingChunks || []).filter(c => c.web?.uri).map(c => ({ title: c.web.title || 'sumber', uri: c.web.uri }));
  return { text, sources, provider: 'gemini', grounded: !!search };
}

async function gemini(system, messages, max) {
  const all = geminiKeys();
  if (!all.length) throw new Error('Belum ada key Gemini di Vercel (GEMINI_API_KEY_1 dan GEMINI_API_KEY_2)');
  const now = Date.now();
  const keys = all.map(k => [k, Math.random()]).sort((a, b) => ((cooldown.get(a[0]) > now) - (cooldown.get(b[0]) > now)) || a[1] - b[1]).map(x => x[0]);
  const errs = [], deadline = now + 50000;
  const msg = e => (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'timeout (Gemini terlalu lama menjawab)' : e.message;
  for (let i = 0; i < keys.length && Date.now() < deadline; i++) {
    const key = keys[i], tag = 'key ' + (all.indexOf(key) + 1);
    try {
      try { return await callGemini(key, system, messages, max, true, true); }
      catch (e0) {
        if (/think/i.test(e0.message)) return await callGemini(key, system, messages, max, true, false);
        if (e0.status === 400 && /tool|search|grounding/i.test(e0.message)) return { ...(await callGemini(key, system, messages, max, false, true)), grounded: false };
        throw e0;
      }
    } catch (e) {
      errs.push(tag + ': ' + msg(e));
      if (e.status === 429 || /quota|exhaust/i.test(e.message)) cooldown.set(key, Date.now() + 60000);
    }
  }
  throw new Error('Gemini gagal: ' + errs.join(' | ').slice(0, 400));
}

async function verify(req) {
  const h = req.headers.authorization || '';
  const tk = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tk) return null;
  const key = process.env.FIREBASE_API_KEY || 'AIzaSyDKv_cb50KmpAPv8qxVGspsFQPWPT7Ym2w';
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + key, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tk })
  });
  return r.ok ? 'ok' : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya POST' });
  if (!(await verify(req))) return res.status(401).json({ error: 'Silakan login dulu' });
  const { system = '', messages = [], big = false } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || JSON.stringify(messages).length > 30000)
    return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });
  try {
    res.status(200).json(await gemini(system, messages, big ? 8000 : 2500));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
