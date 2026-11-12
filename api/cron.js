/* =====================================================================
   CRON — analisis Alchemist terjadwal (tetap jalan walau web ditutup)
   Dipanggil penjadwal (Vercel Cron / cron-job.org / uptime service) tiap
   15 menit, lalu mengirim ringkasan sinyal ke kanal push ntfy.
   Otorisasi: header cron Vercel, Authorization: Bearer CRON_SECRET, atau
   ?key=<cronKey> yang diturunkan dari rahasia yang sudah ada.
   ===================================================================== */
const chat = require('./chat.js');

const SITE = String(process.env.RB_SITE_URL || 'https://belajarforme29.vercel.app').replace(/\/+$/, '');

function fmt(v) { return v == null || !isFinite(Number(v)) ? '—' : Number(v).toFixed(2); }

/* Ringkasan teks: 3–10 sinyal satu arah, SL 30–40, TP1 ≥100, TP2 ≥200, TP3 struktur. */
function buildDigest(pack) {
  const arr = (pack && Array.isArray(pack.setups) ? pack.setups : []).filter(s => s && s.dir);
  const dir = (pack && (pack.singleDirection || pack.biasDirection)) || (arr[0] && arr[0].dir) || '—';
  const anyReady = arr.some(s => s.status === 'SIAP' && s.valid !== false);
  const head = 'XAUUSD ' + fmt(pack && pack.price) + ' · arah tunggal ' + dir + ' · ' + arr.length + ' sinyal';
  const lines = arr.map((s, i) => {
    const tp3 = s.tp3 != null ? s.tp3 : s.tpMax, tp3p = s.tp3Pips != null ? s.tp3Pips : s.tpMaxPips;
    return (i + 1) + ') ' + s.dir + ' · ' + String(s.method || 'Alchemist').slice(0, 58)
      + ' · entry ' + fmt(s.entry) + ' (' + (s.type || 'LIMIT') + ')'
      + ' · SL ' + fmt(s.sl) + ' (' + (s.slPips == null ? '—' : s.slPips) + ' pip)'
      + ' · TP1 ' + fmt(s.tp1 != null ? s.tp1 : s.tp) + ' (' + (s.tpPips == null ? '—' : s.tpPips) + ')'
      + ' · TP2 ' + fmt(s.tp2) + ' (' + (s.tp2Pips == null ? '—' : s.tp2Pips) + ')'
      + ' · TP3 ' + fmt(tp3) + ' (' + (tp3p == null ? '—' : tp3p) + ')'
      + ' · ' + (s.status || '—');
  });
  const when = pack && pack.generatedAt ? new Date(pack.generatedAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const msg = [head].concat(lines).concat(['Siklus ' + when + ' · Alchemist + data global live · 1 pip = 0,1', 'Edukasi, bukan saran finansial.']).join('\n').slice(0, 3900);
  return {
    dir, count: arr.length, anyReady, when,
    title: (anyReady ? '🎯 ' : '📊 ') + arr.length + ' sinyal XAUUSD · ' + dir + ' · ' + when.slice(11, 16),
    message: msg,
    priority: anyReady ? 4 : 3,
    tags: anyReady ? ['dart', 'chart_with_upwards_trend'] : ['chart_with_upwards_trend']
  };
}

async function publish(topic, d) {
  const body = { topic, title: d.title, message: d.message, priority: d.priority, tags: d.tags, click: SITE + '/#trading' };
  const r = await fetch('https://ntfy.sh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'RuangBelajar-Signal/1.0' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000)
  });
  return { ok: r.ok, status: r.status };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = (req && req.query) || {}, h = (req && req.headers) || {};
  const secret = process.env.CRON_SECRET || '';
  const auth = String(h.authorization || '');
  const isVercelCron = String(h['x-vercel-cron'] || '') !== '';
  const ok = (secret && auth === 'Bearer ' + secret) || isVercelCron || (!!q.key && String(q.key) === chat.cronKey());
  if (!ok) return res.status(401).json({ error: 'Tidak berizin' });
  if (q.dry === '1') {
    try {
      const pack = await chat.xauSignalPack();
      const tgc = chat.tgConf();
      return res.status(200).json({ ok: true, dry: true, digest: buildDigest(pack), topic: chat.pushTopic(), telegram: { enabled: tgc.ok, chats: tgc.ids.length } });
    } catch (e) {
      return res.status(200).json({ ok: false, error: String((e && e.message) || e).slice(0, 200) });
    }
  }
  let pack;
  try { pack = await chat.xauSignalPack(); }
  catch (e) { return res.status(200).json({ ok: false, error: 'Mesin sinyal gagal: ' + String((e && e.message) || e).slice(0, 180) }); }
  const d = buildDigest(pack);
  let sent = { ok: false, status: 0 };
  try { sent = await publish(chat.pushTopic(), d); }
  catch (e) { sent = { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 180) }; }
  let tg = { ok: false, skipped: true, sent: 0, total: 0 };
  try { tg = await chat.notifyTelegram(d.message); }
  catch (e) { tg = { ok: false, sent: 0, total: 0, error: String((e && e.message) || e).slice(0, 180) }; }
  return res.status(200).json({
    ok: true, pushed: sent.ok, pushStatus: sent.status, cycle: pack.generatedAt,
    dir: d.dir, count: d.count, ready: d.anyReady, title: d.title,
    topic: chat.pushTopic(), telegram: tg, preview: d.message.slice(0, 400)
  });
};

module.exports.buildDigest = buildDigest;
