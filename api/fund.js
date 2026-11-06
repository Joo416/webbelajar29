// /api/fund — sumber gratis untuk inflasi NZD & CHF dalam format yang dibaca FUND_JSON_URL.
// NZD: Stats NZ, indeks CPI All Groups (CPIQ.SE9A) → YoY dihitung dari 4 kuartal.
// CHF: SNB, cube plkopr (LD2010100) → YoY dihitung dari 12 bulan.
// Pengangguran NZD/CHF hanya terisi bila FUND_UPSTREAM_URL diatur (vendor berbayar).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CAT = 'https://www.stats.govt.nz/large-datasets/csv-files-for-download/';
const SNB = 'https://data.snb.ch/api/cube/plkopr/data/csv/en';
const SHEETS = ['NZD', 'CHF', 'USD', 'EUR', 'AUD', 'GBP', 'CAD', 'JPY'];
const MON = { 3: 'March', 6: 'June', 9: 'September', 12: 'December' };
const NAMES = { january: 3, february: 3, march: 3, april: 6, may: 6, june: 6, july: 9, august: 9, september: 9, october: 12, november: 12, december: 12 };
const r2 = n => Math.round(n * 100) / 100;
// akhir periode: (2026, 9) -> 2026-09-30
const qEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

const get = async (u, ms = 45000, h = {}) => {
  const r = await fetch(u, { headers: { 'User-Agent': UA, ...h }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(new URL(u).host + ' HTTP ' + r.status);
  return r;
};
const txt = async (u, ms, h) => (await get(u, ms, h)).text();

// empat kuartal CPI terakhir (Mar/Jun/Sep/Des), terbaru dulu
const quarters = (n = 4) => {
  const out = [], d = new Date();
  let y = d.getUTCFullYear(), m = [3, 6, 9, 12].filter(x => x <= d.getUTCMonth() + 1).pop();
  if (!m) { y -= 1; m = 12; }
  for (let i = 0; i < n; i++) { out.push([y, m]); m -= 3; if (m <= 0) { m += 12; y -= 1; } }
  return out;
};
const cpiUrl = (y, m) => 'https://www.stats.govt.nz/assets/Uploads/Consumers-price-index/Consumers-price-index-' +
  MON[m] + '-' + y + '-quarter/Download-data/consumers-price-index-' + MON[m].toLowerCase() + '-' + y + '-quarter-index-numbers.csv';

const parseNz = csv => {
  const map = {};
  csv.split(/\r?\n/).forEach(line => {
    if (!line.includes('CPIQ.SE9A')) return;
    const a = line.split(','), p = (a[1] || '').replace(/"/g, '').trim(), v = parseFloat(a[2]);
    if (/^\d{4}\.\d{2}$/.test(p) && isFinite(v) && v > 0) map[p] = v;
  });
  const ks = Object.keys(map).sort();
  if (ks.length < 5) throw new Error('baris CPIQ.SE9A tidak ditemukan');
  const now = ks[ks.length - 1], [y, m] = now.split('.').map(Number);
  const prev = (y - 1) + '.' + String(m).padStart(2, '0');
  if (!map[prev]) throw new Error('pembanding setahun lalu tidak ada (' + prev + ')');
  return { v: r2((map[now] / map[prev] - 1) * 100), date: qEnd(y, m), src: 'Stats NZ CPIQ.SE9A (YoY dihitung)' };
};

// jalur cepat: cukup ekor CSV (blok CPIQ.SE9A ada di akhir berkas)
async function nzRange(u, size = 120000) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Range: 'bytes=-' + size }, signal: AbortSignal.timeout(20000) });
  if (r.status !== 206) throw new Error('Range tidak didukung (' + r.status + ')');
  return r.text();
}

async function nzCpi() {
  let last = null;
  for (const [y, m] of quarters(3)) {
    try { return parseNz(await nzRange(cpiUrl(y, m))); } catch (e) { last = e; }
  }
  for (const [y, m] of quarters(3)) {
    try { return parseNz(await txt(cpiUrl(y, m), 45000)); } catch (e) { last = e; }
  }
  try { // kuartal tak terduga: baca katalog internal halaman bulk
    const html = (await txt(CAT, 25000)).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\\\//g, '/');
    const urls = [...new Set(html.match(/\/assets\/Uploads\/Consumers-price-index\/[^"'\s,]+index-numbers\.csv/gi) || [])].map(u => ({ u, m: u.match(/index-([a-z]+)-(\d{4})-quarter/i) }))
      .filter(x => x.m && NAMES[x.m[1].toLowerCase()]).sort((a, b) => (b.m[2] * 100 + NAMES[b.m[1].toLowerCase()]) - (a.m[2] * 100 + NAMES[a.m[1].toLowerCase()]));
    for (const it of urls.slice(0, 3)) { try { return parseNz(await txt('https://www.stats.govt.nz' + it.u, 45000)); } catch (e) { last = e; } }
  } catch (e) { last = last || e; }
  throw new Error('Stats NZ: ' + (last ? last.message : 'CSV CPI tidak tersedia'));
}

async function chCpi() {
  const csv = await txt(SNB, 25000);
  const map = {};
  csv.split(/\r?\n/).forEach(line => {
    const a = line.split(';').map(x => x.replace(/"/g, '').trim());
    if (a.length !== 3 || !/^\d{4}-\d{2}$/.test(a[0]) || a[1] !== 'LD2010100') return;
    const v = parseFloat(a[2]);
    if (isFinite(v) && v > 0) map[a[0]] = v;
  });
  const ks = Object.keys(map).sort();
  if (ks.length < 13) throw new Error('SNB: seri LD2010100 terlalu pendek');
  const now = ks[ks.length - 1], [y, m] = now.split('-');
  const prev = (Number(y) - 1) + '-' + m;
  if (!map[prev]) throw new Error('SNB: pembanding setahun lalu tidak ada (' + prev + ')');
  return { v: r2((map[now] / map[prev] - 1) * 100), date: qEnd(Number(y), +m), src: 'SNB plkopr LD2010100 (YoY dihitung)' };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Hanya GET' });
  const out = {}, gaps = [];
  const [nz, ch] = await Promise.all([
    nzCpi().catch(e => ({ err: e.message })),
    chCpi().catch(e => ({ err: e.message }))
  ]);
  if (nz.v) out.NZD = { cpi: nz }; else gaps.push('NZD cpi: ' + nz.err);
  if (ch.v) out.CHF = { cpi: ch }; else gaps.push('CHF cpi: ' + ch.err);

  const up = String(process.env.FUND_UPSTREAM_URL || '').trim();
  let upState = up ? 'tidak dipakai' : 'belum diatur';
  if (up) {
    try {
      const tok = String(process.env.FUND_UPSTREAM_TOKEN || '').trim();
      const j = await (await get(up, 15000, tok ? { Authorization: 'Bearer ' + tok } : {})).json();
      upState = 'ok';
      SHEETS.forEach(c => ['cpi', 'ur'].forEach(k => {
        const v = j && j[c] && j[c][k];
        if (!v || !isFinite(parseFloat(v.v)) || !v.date) return;
        out[c] = out[c] || {};
        if (out[c][k]) return; // sumber gratis diutamakan
        out[c][k] = { v: r2(parseFloat(v.v)), date: String(v.date).slice(0, 10), src: v.src || 'FUND_UPSTREAM_URL' };
      }));
    } catch (e) { upState = e.message.slice(0, 120); }
  }
  ['NZD', 'CHF'].forEach(c => ['cpi', 'ur'].forEach(k => {
    if (!(out[c] && out[c][k])) gaps.push(c + ' ' + k + ': ' + ((out[c] && out[c].cpi) ? 'butuh FUND_UPSTREAM_URL' : 'sumber gagal'));
  }));
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  res.status(200).json({
    ...out,
    _meta: {
      generated: new Date().toISOString(),
      sources: { 'NZD.cpi': 'Stats NZ', 'CHF.cpi': 'SNB', upstream: upState },
      missing: [...new Set(gaps)]
    }
  });
};
