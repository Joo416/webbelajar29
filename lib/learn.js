/* =====================================================================
   UNIFIED LEARNING ENGINE
   Satu mesin belajar deterministik untuk semua bagian web:
   - Signal entry : belajar dari setiap hasil SL/TP (bukan hanya pola persis,
                    tetapi juga sifat teknikal: sesi, trigger, POI, makro, TF,
                    risiko rilis, dan tingkat konfluensi metode).
   - News         : belajar dari akurasi arah pra-rilis vs reaksi nyata.
   - Radar        : belajar dari akurasi arah 30 menit vs harga berikutnya.

   Prinsip:
   - Tidak ada angka atau hasil yang dikarang. Semua statistik dihitung dari
     catatan hasil yang dikirim klien dan sudah tervalidasi candle M5.
   - Arah mesin TIDAK pernah dibalik oleh pembelajaran. Pembelajaran hanya
     menurunkan keyakinan dan menahan entry bila bukti cukup kuat.
   - Tidak terkunci permanen: catatan lebih tua dari 60 hari diabaikan, blokir
     hanya berlaku bila kerugian terakhir lebih baru dari kemenangan terakhir
     (maksimal 21 hari), sehingga pola bisa pulih sendiri.
   ===================================================================== */
'use strict';
const C = require('./xau-core');

const DAY = 86400000;
const WINDOW_MS = 60 * DAY;
const RECENT_MS = 21 * DAY;
const MAX_RECORDS = 240;
const MAX_NEWS = 100;
const MAX_RADAR = 160;
const MAX_SOURCES = 300;

const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 24);
const norm = (v) => txt(v, 24).toUpperCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function confBand(v) {
  const n = Number(v);
  if (!isFinite(n)) return '';
  return n >= 75 ? 'tinggi' : n >= 55 ? 'sedang' : 'rendah';
}

function normalizeRecord(x) {
  if (!x || typeof x !== 'object') return null;
  const r = norm(x.r);
  if (r !== 'SL' && r !== 'TP') return null;
  const dir = /^(BUY|SELL)$/.test(norm(x.dir)) ? norm(x.dir) : '';
  if (!dir) return null;
  const at = Number(x.at);
  const conf = Number(x.conf);
  const result = r === 'SL' ? 'SL' : ['TP2', 'TPMAX', 'TP1'].includes(norm(x.result)) ? norm(x.result) : 'TP';
  return {
    r, result, dir,
    /* Observasi yang tidak pernah dieksekusi hanya boleh menurunkan
       keyakinan, bukan memblokir entry. */
    paper: x.paper === true,
    style: norm(x.style),
    poi: norm(x.poi),
    trigger: norm(x.trigger),
    session: txt(x.session, 20),
    macro: txt(x.macro, 12).toLowerCase(),
    risk: norm(x.risk),
    htf: txt(x.htf, 12).toLowerCase(),
    news: txt(x.news, 12).toLowerCase(),
    method: txt(x.method, 12).toLowerCase(),
    target: txt(x.target, 24),
    smc: norm(x.smc),
    phase: txt(x.phase, 16).toLowerCase(),
    kill: txt(x.kill, 5).toLowerCase(),
    pd: txt(x.pd, 12).toLowerCase(),
    conf: isFinite(conf) ? clamp(Math.round(conf), 0, 100) : null,
    at: isFinite(at) && at > 0 ? at : 0
  };
}

/* Sifat teknikal yang bisa digeneralisasi. Arah murni (BUY/SELL) sengaja
   tidak dipakai supaya mesin tidak menghukum satu sisi pasar terus-menerus. */
function traitsOf(r) {
  const out = [];
  const add = (k, v) => { const t = txt(v, 20); if (t) out.push(k + '=' + t); };
  add('mode', r.style);
  add('poi', r.poi);
  add('trigger', r.trigger);
  add('sesi', r.session);
  add('makro', r.macro);
  add('risiko', r.risk);
  add('tf', r.htf);
  add('berita', r.news);
  add('metode', r.method);
  add('target', r.target);
  add('smc', r.smc);
  add('fase', r.phase);
  add('kill', r.kill);
  add('pd', r.pd);
  if (r.conf != null) add('conf', confBand(r.conf));
  if (r.style && r.dir) add('modeArah', r.style + '-' + r.dir);
  if (r.macro && r.htf) add('makroTF', r.macro + '/' + r.htf);
  if (r.risk && r.macro) add('risikoMakro', r.risk + '/' + r.macro);
  if (r.trigger && r.session) add('triggerSesi', r.trigger + '/' + r.session);
  if (r.poi && r.trigger) add('poiTrigger', r.poi + '/' + r.trigger);
  if (r.smc && r.pd) add('smcPd', r.smc + '/' + r.pd);
  if (r.smc && r.phase) add('smcFase', r.smc + '/' + r.phase);
  return [...new Set(out)];
}

function traitsOfSetup(s) {
  const dir = norm(s && s.dir);
  return traitsOf({
    dir, style: norm(s && s.style), poi: norm(s && s.poi),
    trigger: norm(s && s.trigger), session: txt(s && s.session, 20),
    macro: txt(s && s.macro, 12).toLowerCase(), risk: norm(s && s.risk),
    htf: txt(s && s.htf, 12).toLowerCase(), news: txt(s && s.news, 12).toLowerCase(),
    method: txt(s && s.method, 12).toLowerCase(),
    target: txt(s && s.target, 24),
    smc: norm(s && s.smc), phase: txt(s && s.phase, 16).toLowerCase(),
    kill: txt(s && s.kill, 5).toLowerCase(), pd: txt(s && s.pd, 12).toLowerCase(),
    conf: s && s.conf == null ? null : Number(s.conf)
  });
}

function labelOf(key) {
  const parts = String(key || '').split('=');
  const names = {
    mode: 'Mode', poi: 'POI', trigger: 'Trigger', sesi: 'Sesi', makro: 'Makro',
    risiko: 'Risiko', tf: 'TF', berita: 'Berita', metode: 'Konfluensi', conf: 'Conf',
    smc: 'SMC', fase: 'Fase AMD', kill: 'Kill zone', pd: 'PD zona', target: 'Sumber TP',
    modeArah: 'Mode/Arah', makroTF: 'Makro/TF', risikoMakro: 'Risiko/Makro',
    triggerSesi: 'Trigger/Sesi', poiTrigger: 'POI/Trigger', smcPd: 'SMC/PD', smcFase: 'SMC/AMD'
  };
  return (names[parts[0]] || parts[0] || '?') + (parts[1] ? ' ' + parts[1] : '');
}

function statsOf(records) {
  const map = new Map();
  const now = Date.now();
  records.forEach(r => {
    if (r.at && now - r.at > WINDOW_MS) return;
    const win = r.r === 'TP';
    traitsOf(r).forEach(k => {
      const o = map.get(k) || { n: 0, w: 0, l: 0, p: 0, last: 0, lastW: 0, lastL: 0 };
      o.n++;
      if (win) { o.w++; o.lastW = Math.max(o.lastW, r.at || 0); }
      else if (r.paper) { o.p++; o.lastL = Math.max(o.lastL, r.at || 0); }
      else { o.l++; o.lastL = Math.max(o.lastL, r.at || 0); }
      o.last = Math.max(o.last, r.at || 0);
      map.set(k, o);
    });
  });
  return map;
}

function buildLessons(raw) {
  const src = raw && Array.isArray(raw.records) ? raw.records : [];
  const records = src.slice(0, MAX_RECORDS).map(normalizeRecord).filter(Boolean);
  const stats = statsOf(records);
  const traits = [...stats.entries()].map(([key, s]) => ({
    key, label: labelOf(key), n: s.n, wins: s.w, losses: s.l,
    paperLosses: s.p || 0, paperWins: 0,
    rate: s.n ? Math.round((s.l + (s.p || 0)) / s.n * 100) : 0,
    last: s.last, lastW: s.lastW, lastL: s.lastL
  }));
  const outcomes = { sl: 0, tp: 0, tp1: 0, tp2: 0, tpmax: 0 };
  records.forEach(x => {
    if (x.r === 'SL') outcomes.sl++;
    else outcomes.tp++;
    if (x.result === 'TP1') outcomes.tp1++;
    else if (x.result === 'TP2') outcomes.tp2++;
    else if (x.result === 'TPMAX') outcomes.tpmax++;
  });
  return { records: records.length, stats, traits, outcomes };
}

/* Evaluasi satu setup terhadap pelajaran. Blokir butuh bukti kuat:
   minimal 2 sifat bermasalah yang total penaltinya >= 12, atau satu sifat
   dengan >= 9 hasil dan >= 72% SL yang masih segar. */
function evaluateSetup(setup, engine) {
  if (!engine || !engine.stats || !engine.stats.size) return { blocked: false, warn: false, penalty: 0, n: 0, wins: 0, losses: 0, reasons: [], traits: 0 };
  const keys = traitsOfSetup(setup);
  const now = Date.now();
  let penalty = 0, hits = 0, severe = false, peak = null;
  const reasons = [];
  keys.forEach(k => {
    const s = engine.stats.get(k);
    if (!s || s.n < 2) return;
    const totalLoss = s.l + (s.p || 0);
    const rate = totalLoss / s.n;
    /* Blokir memakai kerugian nyata; observasi paper hanya menambah penalti. */
    const realRate = s.l / s.n;
    const fresh = s.lastL > 0 && (!s.lastW || s.lastL >= s.lastW) && now - s.lastL <= RECENT_MS;
    if (!peak || s.n > peak.n || (s.n === peak.n && totalLoss > (peak.l + (peak.p || 0)))) peak = s;
    const p = s.n >= 5 && rate >= 0.6 ? 8 : s.n >= 3 && rate >= 0.66 ? 6 : rate >= 0.75 ? 4 : 0;
    if (p) { penalty += p; reasons.push(labelOf(k) + ': ' + totalLoss + ' SL / ' + s.w + ' TP' + (s.p ? ' (' + s.p + ' observasi)' : '')); }
    const blocky = fresh && s.l >= 1 && ((s.n >= 6 && s.l >= 4 && realRate >= 0.66) || (s.n >= 4 && realRate >= 0.75) || (s.n >= 3 && s.l === s.n));
    if (blocky) hits++;
    if (fresh && s.l >= 2 && s.n >= 9 && realRate >= 0.72) severe = true;
  });
  reasons.sort((a, b) => b.length - a.length);
  return {
    blocked: severe || (hits >= 2 && penalty >= 12),
    warn: !severe && penalty >= 4,
    penalty: clamp(penalty, 0, 15), hits,
    n: peak ? peak.n : 0, wins: peak ? peak.w : 0, losses: peak ? peak.l : 0,
    paperLosses: peak ? (peak.p || 0) : 0,
    reasons: reasons.slice(0, 3),
    traits: keys.length
  };
}

function topRiskyTraits(engine, limit) {
  if (!engine || !Array.isArray(engine.traits)) return [];
  return engine.traits
    .filter(x => x.n >= 3 && x.losses > 0 && x.rate >= 33)
    .sort((a, b) => ((b.key.indexOf('/') >= 0 ? 1 : 0) - (a.key.indexOf('/') >= 0 ? 1 : 0)) || b.rate - a.rate || b.losses - a.losses)
    .slice(0, limit || 4)
    .map(x => ({ key: x.key, label: x.label, n: x.n, wins: x.wins, losses: x.losses, rate: x.rate }));
}

/* ---------------- NEWS: akurasi arah pra-rilis ---------------- */
function normalizeNews(x) {
  if (!x || typeof x !== 'object') return null;
  const at = Number(x.at);
  const p = /^(BUY|SELL)$/.test(norm(x.p)) ? norm(x.p) : '';
  const a = /^(BUY|SELL)$/.test(norm(x.a)) ? norm(x.a) : '';
  const pc = /^(BUY|SELL)$/.test(norm(x.pc)) ? norm(x.pc) : '';
  const ok = typeof x.ok === 'boolean' ? x.ok : p && a ? p === a : null;
  const pok = typeof x.pok === 'boolean' ? x.pok : pc && a ? pc === a : null;
  return { f: txt(x.f, 8).toUpperCase(), p, a, pc, ok, pok, at: isFinite(at) && at > 0 ? at : 0 };
}

function newsLearning(raw) {
  const arr = (Array.isArray(raw) ? raw : []).slice(0, MAX_NEWS).map(normalizeNews).filter(Boolean);
  const now = Date.now();
  const done = arr.filter(x => x.ok !== null && (!x.at || now - x.at <= 180 * DAY));
  const correct = done.filter(x => x.ok).length;
  const recent = done.filter(x => x.at && now - x.at <= 14 * DAY);
  const recentCorrect = recent.filter(x => x.ok).length;
  const panelDone = done.filter(x => x.pok !== null);
  const panelCorrect = panelDone.filter(x => x.pok).length;
  const panelAccuracy = panelDone.length ? Math.round(panelCorrect / panelDone.length * 100) : null;
  const n = done.length;
  const accuracy = n ? Math.round(correct / n * 100) : null;
  const recentAccuracy = recent.length ? Math.round(recentCorrect / recent.length * 100) : null;
  const delta = n >= 4 ? clamp(Math.round(((recent.length >= 3 ? recentAccuracy : accuracy) - 50) / 6), -8, 6) : 0;
  return {
    n, correct, accuracy, recentN: recent.length, recentAccuracy,
    panelN: panelDone.length, panelCorrect, panelAccuracy, delta,
    note: n
      ? 'Pembelajaran berita: ' + correct + '/' + n + ' prakiraan arah benar' + (accuracy != null ? ' (' + accuracy + '%)' : '') + (recent.length ? '; 14 hari terakhir ' + recentCorrect + '/' + recent.length : '') + (panelDone.length ? '; panel AI ' + panelCorrect + '/' + panelDone.length + (panelAccuracy != null ? ' (' + panelAccuracy + '%)' : '') : '') + '. Keyakinan disesuaikan ' + (delta >= 0 ? '+' : '') + delta + ' poin, arah tidak diubah.'
      : 'Belum ada prakiraan berita yang tervalidasi. Setelah rilis, arah pra-rilis dibandingkan dengan reaksi nyata dan hasilnya dipakai otomatis.'
  };
}

/* ---------------- RADAR: akurasi arah 30 menit ---------------- */
function normalizeRadar(x) {
  if (!x || typeof x !== 'object') return null;
  const at = Number(x.at);
  const dir = /^(BUY|SELL|WAIT)$/.test(norm(x.dir)) ? norm(x.dir) : '';
  if (!dir) return null;
  return {
    dir,
    ok: typeof x.ok === 'boolean' ? x.ok : null,
    ag: isFinite(Number(x.ag)) ? clamp(Math.round(Number(x.ag)), 0, 100) : null,
    at: isFinite(at) && at > 0 ? at : 0
  };
}

function radarLearning(raw, dir, agreement) {
  const arr = (Array.isArray(raw) ? raw : []).slice(0, MAX_RADAR).map(normalizeRadar).filter(Boolean);
  const now = Date.now();
  const done = arr.filter(x => x.ok !== null && (!x.at || now - x.at <= 90 * DAY));
  const pick = d => done.filter(x => x.dir === d);
  const acc = list => list.length ? Math.round(list.filter(x => x.ok).length / list.length * 100) : null;
  const all = acc(done), own = dir === 'BUY' || dir === 'SELL' ? acc(pick(dir)) : null;
  const n = done.length;
  /* Pakai akurasi arah yang sama bila cukup sampel; jika tidak, akurasi total. */
  const basis = own != null && pick(dir).length >= 4 ? own : all;
  const delta = n >= 6 && basis != null ? clamp(Math.round((basis - 50) / 5), -8, 6) : 0;
  return {
    n, accuracy: all, directionAccuracy: own, directionN: dir ? pick(dir).length : 0, delta,
    agreement: isFinite(Number(agreement)) ? Math.round(Number(agreement)) : null,
    note: n
      ? 'Pembelajaran radar: ' + done.filter(x => x.ok).length + '/' + n + ' arah 30 menit benar (' + all + '%)' + (own != null ? '; arah ' + dir + ' ' + own + '%' : '') + '. Keyakinan disesuaikan ' + (delta >= 0 ? '+' : '') + delta + ' poin.'
      : 'Belum ada prakiraan radar yang tervalidasi. Setiap arah 30 menit dicatat dan dibandingkan dengan harga 30 menit kemudian secara otomatis.'
  };
}

/* ---------------- SUMBER GLOBAL: akurasi kecenderungan per sumber ----------------
   Klien mencatat kecenderungan judul (bullish/bearish) beserta harga saat itu,
   lalu membandingkannya dengan harga setelah horizon. Yang dinilai hanya arah
   kecenderungan sumber, bukan "kebenaran" artikel secara keseluruhan. */
function normalizeSource(x) {
  if (!x || typeof x !== 'object') return null;
  const s = txt(x.s, 24).toLowerCase();
  const p = /^(BUY|SELL)$/.test(norm(x.p)) ? norm(x.p) : '';
  if (!s || !p) return null;
  const at = Number(x.at);
  return { s, p, ok: typeof x.ok === 'boolean' ? x.ok : null, at: isFinite(at) && at > 0 ? at : 0 };
}

function sourceLearning(raw) {
  const arr = (Array.isArray(raw) ? raw : []).slice(0, MAX_SOURCES).map(normalizeSource).filter(Boolean);
  const now = Date.now();
  const map = new Map(), list = [];
  arr.forEach(x => {
    if (x.at && now - x.at > 45 * DAY) return;
    const o = map.get(x.s) || { s: x.s, n: 0, correct: 0, last: 0 };
    o.n++;
    if (x.ok) o.correct++;
    o.last = Math.max(o.last, x.at || 0);
    map.set(x.s, o);
  });
  let n = 0, correct = 0;
  map.forEach(o => {
    n += o.n; correct += o.correct;
    list.push({
      s: o.s, n: o.n, correct: o.correct,
      accuracy: o.n ? Math.round(o.correct / o.n * 100) : null,
      weight: o.n >= 4 ? clamp(0.6 + o.correct / o.n * 0.7, 0.6, 1.3) : 1,
      last: o.last
    });
  });
  list.sort((a, b) => b.n - a.n || (b.accuracy || 0) - (a.accuracy || 0));
  const accuracy = n ? Math.round(correct / n * 100) : null;
  const measured = list.filter(x => x.n >= 4 && x.accuracy != null);
  return {
    n, correct, accuracy, sources: list, map, measured: measured.length,
    note: n
      ? 'Pembelajaran sumber global: ' + correct + '/' + n + ' kecenderungan arah benar' + (accuracy != null ? ' (' + accuracy + '%)' : '') + ' dari ' + list.length + ' sumber; ' + measured.length + ' sumber sudah cukup sampel untuk menimbang bukti.'
      : 'Belum ada kecenderungan sumber yang tervalidasi. Setiap judul yang dipakai dicatat dan dibandingkan dengan harga setelah 30 menit, lalu sumber yang berulang benar dipakai lebih kuat.'
  };
}

function normalizeLearn(raw) {
  return {
    records: raw && Array.isArray(raw.records) ? raw.records : [],
    news: raw && Array.isArray(raw.news) ? raw.news : [],
    radar: raw && Array.isArray(raw.radar) ? raw.radar : [],
    sources: raw && Array.isArray(raw.sources) ? raw.sources : []
  };
}

module.exports = {
  normalizeLearn, buildLessons, evaluateSetup, topRiskyTraits,
  newsLearning, radarLearning, sourceLearning, labelOf, traitsOf
};
