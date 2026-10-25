// Vercel Serverless Function: /api/chat
// Kunci API disimpan di Environment Variables Vercel (bukan di kode).
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
    } else {
      return res.status(500).json({ error: 'GROQ_API_KEY belum diatur di Vercel' });
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
