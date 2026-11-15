/* =====================================================================
   Candle real-time dari websocket chart TradingView.
   Sumber yang sama dengan widget OANDA:XAUUSD, jadi struktur M5/M15
   tidak lagi memakai data Yahoo yang tertunda.
   ===================================================================== */
'use strict';
const WebSocket = require('ws');

const TV_WS = 'wss://data.tradingview.com/socket.io/websocket';
const rnd = () => Math.random().toString(36).slice(2, 10);

function frame(method, params) {
  const payload = JSON.stringify({ m: method, p: params });
  return '~m~' + Buffer.byteLength(payload) + '~m~' + payload;
}

function parseFrames(input) {
  const out = [];
  let s = String(input || '');
  while (s.length) {
    const head = /^~m~(\d+)~m~/.exec(s);
    if (!head) break;
    const len = Number(head[1]);
    const start = head[0].length;
    const payload = s.slice(start, start + len);
    s = s.slice(start + len);
    if (!payload || payload.startsWith('~h~')) continue;
    try { out.push(JSON.parse(payload)); } catch (e) {}
  }
  return out;
}

/* Ambil candle dari TradingView. timeoutMs ketat supaya API tidak menggantung. */
function tvCandles(symbol, resolution, count, timeoutMs) {
  const sym = symbol || 'OANDA:XAUUSD';
  const res = String(resolution || '5');
  const bars = Math.max(50, Math.min(800, count || 220));
  const limit = timeoutMs || 12000;
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(TV_WS, {
        handshakeTimeout: 6000,
        headers: {
          Origin: 'https://www.tradingview.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'
        }
      });
    } catch (e) { return reject(e); }
    const cs = 'cs_' + rnd();
    let done = false;
    let series = [];
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) {}
      if (err && !series.length) return reject(err);
      resolve(series);
    };
    const timer = setTimeout(() => finish(new Error('TradingView candle timeout')), limit);
    ws.on('open', () => {
      try {
        ws.send(frame('set_auth_token', ['unauthorized_user_token']));
        ws.send(frame('chart_create_session', [cs, '']));
        ws.send(frame('resolve_symbol', [cs, 'sds_sym_1', '={"symbol":"' + sym + '","adjustment":"splits"}']));
        ws.send(frame('create_series', [cs, 'sds_1', 's1', 'sds_sym_1', res, bars, '']));
      } catch (e) { finish(e); }
    });
    ws.on('message', (buf) => {
      for (const msg of parseFrames(buf)) {
        if (msg.m === 'symbol_error' || msg.m === 'series_error' || msg.m === 'critical_error') {
          return finish(new Error('TradingView ' + msg.m));
        }
        if (msg.m !== 'timescale_update' && msg.m !== 'du') continue;
        const data = (msg.p && msg.p[1]) || {};
        const s = data.sds_1 || data.sds_sym_1;
        const arr = s && s.s;
        if (!Array.isArray(arr) || !arr.length) continue;
        series = arr.map(x => {
          const v = x && x.v;
          if (!Array.isArray(v) || v.length < 5) return null;
          return { t: v[0] * 1000, o: +v[1], h: +v[2], l: +v[3], c: +v[4], v: +v[5] || 0 };
        }).filter(x => x && x.o > 0 && x.h >= x.l).sort((a, b) => a.t - b.t);
        series = series.filter((r, i) => i === 0 || r.t !== series[i - 1].t);
        if (msg.m === 'timescale_update' && series.length >= 20) return finish(null);
      }
    });
    ws.on('error', (e) => finish(e));
    ws.on('close', () => { if (series.length) finish(null); });
  });
}

module.exports = { tvCandles, parseFrames };
