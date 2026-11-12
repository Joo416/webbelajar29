/* =====================================================================
   TELEGRAM WEBHOOK — perintah /sinyal, /status, /help dari chat
   Dipanggil Telegram setiap ada pesan ke bot (setWebhook ke /api/telegram).
   Aman: header secret token dicek, dan hanya chat id terdaftar yang dilayani.
   ===================================================================== */
const chat = require('./chat.js');
const cron = require('./cron.js');

const SITE = String(process.env.RB_SITE_URL || 'https://belajarforme29.vercel.app').replace(/\/+$/, '');

function allowedChats() {
  return String(process.env.TELEGRAM_ALLOWED_CHATS || process.env.TELEGRAM_CHAT_ID || '')
    .split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

function statusText(pack) {
  const arr = (pack && Array.isArray(pack.setups)) ? pack.setups : [];
  const ready = arr.filter(s => s && s.status === 'SIAP' && s.valid !== false).length;
  const age = pack && pack.ageMin != null ? pack.ageMin : (pack && pack.candleAt ? Math.round((Date.now() - Date.parse(pack.candleAt)) / 60000) : null);
  const lock = (pack && pack.directionLock) || {};
  return [
    '📊 STATUS RUANG BELAJAR',
    'Waktu server: ' + new Date().toUTCString(),
    'Harga XAUUSD: ' + (pack && pack.price != null ? pack.price : '—'),
    'Arah tunggal: ' + ((pack && (pack.singleDirection || pack.biasDirection)) || '—') + (lock.strength != null ? ' (kekuatan ' + lock.strength + '%)' : ''),
    'Sinyal: ' + arr.length + ' · ' + ready + ' SIAP',
    'Candle: ' + (pack && pack.candleAt ? new Date(pack.candleAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—') + (age != null ? ' (' + age + ' menit lalu)' : ''),
    'Data valid: ' + (pack && pack.dataValid ? 'ya' : 'terbatas'),
    'Sumber harga: ' + ((pack && pack.priceSource) || '—'),
    'Jadwal server: */15 * * * * (/api/cron)',
    '',
    'Ketik /sinyal untuk daftar entry, SL, TP1–TP3.'
  ].join('\n');
}

const HELP = [
  '🤖 BOT RUANG BELAJAR — XAUUSD',
  '',
  '/sinyal — 3–10 sinyal Alchemist terbaru (entry, SL, TP1–TP3, status)',
  '/status — harga, arah tunggal, kesegaran data, jadwal server',
  '/help — bantuan ini',
  '',
  'Data: candle live M15/M5/M1, bias H1/D1, DXY, yield 10Y, spot emas, kalender rilis.',
  'Edukasi, bukan saran finansial.'
].join('\n');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ ok: true, endpoint: 'telegram-webhook', site: SITE });
  const secret = chat.tgHookSecret ? chat.tgHookSecret() : '';
  const got = String((req.headers || {})['x-telegram-bot-api-secret-token'] || '');
  if (secret && got !== secret) return res.status(401).json({ ok: false, error: 'secret tidak cocok' });

  const upd = (req.body && typeof req.body === 'object') ? req.body : {};
  const msg = upd.message || upd.edited_message || upd.channel_post || null;
  if (!msg || !msg.text) return res.status(200).json({ ok: true, ignored: true });

  const chatId = String((msg.chat && msg.chat.id) || '');
  const allowed = allowedChats();
  if (!allowed.length) return res.status(200).json({ ok: true, denied: true, reason: 'TELEGRAM_CHAT_ID belum diisi' });
  if (!allowed.includes(chatId)) return res.status(200).json({ ok: true, denied: true });

  const text = String(msg.text).trim();
  const cmd = (text.split(/\s+/)[0] || '').toLowerCase().replace(/@[a-z0-9_]+$/i, '');
  const reply = async t => {
    const r = await chat.tgSendTo(chatId, t);
    return res.status(200).json({ ok: true, command: cmd, sent: !!r.ok, error: r.ok ? undefined : (r.description || r.reason || 'gagal mengirim') });
  };

  if (cmd === '/help' || cmd === '/start') return reply(HELP);

  if (cmd === '/sinyal' || cmd === '/signal' || cmd === '/xau') {
    try {
      const pack = await chat.xauSignalPack();
      const d = cron.buildDigest(pack);
      const when = pack && pack.generatedAt ? new Date(pack.generatedAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—';
      return reply('🎯 SINYAL XAUUSD (diminta manual)\nSiklus: ' + when + '\n\n' + d.message.slice(0, 3600));
    } catch (e) {
      return reply('⚠️ Gagal mengambil sinyal: ' + String((e && e.message) || e).slice(0, 200));
    }
  }

  if (cmd === '/status') {
    try {
      const pack = await chat.xauSignalPack();
      return reply(statusText(pack));
    } catch (e) {
      return reply('⚠️ Gagal membaca status: ' + String((e && e.message) || e).slice(0, 200));
    }
  }

  return reply('Perintah tidak dikenal.\n\n' + HELP);
};

module.exports.statusText = statusText;
