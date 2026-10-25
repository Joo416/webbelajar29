// Vercel Serverless Function: /api/chat
// Kunci API disimpan di Environment Variables Vercel (bukan di kode).
// Pakai salah satu: GROQ_API_KEY (gratis), GEMINI_API_KEY (tier gratis), atau ANTHROPIC_API_KEY (Claude).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Hanya POST' });
  const { system = '', messages = [], big = false } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || JSON.stringify(messages).length > 30000)
    return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });

  const maxTokens = big ? 4000 : 1200;
  try {
    let text = '';
    if (process.env.GROQ_API_KEY) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: String(m.content) }))]
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Groq error');
      text = j.choices?.[0]?.message?.content || '';
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })),
          generationConfig: { maxOutputTokens: maxTokens }
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Gemini error');
      text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text).join('');
    } else if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
          max_tokens: maxTokens,
          system,
          messages: messages.map(m => ({ role: m.role, content: String(m.content) }))
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || 'Claude error');
      text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    } else {
      return res.status(500).json({ error: 'API key belum diatur di Vercel (GROQ_API_KEY, GEMINI_API_KEY, atau ANTHROPIC_API_KEY)' });
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
