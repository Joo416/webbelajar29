// Vercel Serverless Function: /api/chat
// Urutan AI: Gemini (GEMINI_API_KEY) -> Groq (GROQ_API_KEY). Jika satu gagal, pakai berikutnya.
async function gemini(system, messages, max) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })),
      generationConfig: { maxOutputTokens: max }
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Gemini: ' + (j.error?.message || r.status));
  const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!t) throw new Error('Gemini: jawaban kosong');
  return t;
}

async function groq(system, messages, max) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      max_tokens: max,
      messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: String(m.content) }))]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Groq: ' + (j.error?.message || r.status));
  const t = j.choices?.[0]?.message?.content || '';
  if (!t) throw new Error('Groq: jawaban kosong');
  return t;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya POST' });
  const { system = '', messages = [], big = false } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || JSON.stringify(messages).length > 30000)
    return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });

  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push(gemini);
  if (process.env.GROQ_API_KEY) providers.push(groq);
  if (!providers.length) return res.status(500).json({ error: 'API key belum diatur di Vercel (GEMINI_API_KEY atau GROQ_API_KEY)' });

  const errors = [];
  for (const p of providers) {
    try {
      const text = await p(system, messages, big ? 8000 : 2000);
      return res.status(200).json({ text });
    } catch (e) {
      errors.push(e.message);
    }
  }
  res.status(500).json({ error: errors.join(' | ') });
};
