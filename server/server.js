// Builder Check storage backend. No dependencies. Stores submissions on disk (a Railway volume).
// Contract (same as the page expects):
//   POST /exec  {action:"submit", id,name,contact,region,mins,code,answers}  -> {ok:true}
//   POST /exec  {action:"mark", key,id,marks:["0-3"x3]}                       -> {ok:true}
//   GET  /exec?action=list&key=KEY                                            -> {ok:true,rows:[...]}
//   GET  /export.csv?key=KEY                                                  -> readable CSV
//   GET  /health
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const KEY = process.env.REVIEW_KEY || '';
const PORT = process.env.PORT || 8080;
const MAX_BODY = 200 * 1024;
fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, 'store.json');
const LOG = path.join(DIR, 'submissions.log'); // append-only copy of every accepted submission

let store = { rows: {} };
try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ }
if (!store.rows) store.rows = {};
function save() { const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(store)); fs.renameSync(t, FILE); }

const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
function keyOk(k) {
  if (!KEY || typeof k !== 'string') return false;
  const a = Buffer.from(k), b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 40;
}
function send(res, code, obj, type) {
  const body = type ? obj : JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function handleSubmit(d) {
  if (typeof d.code === 'string' && d.code.length > 60000) return { ok: false, error: 'too large' };
  const id = str(d.id, 80), code = str(d.code, 60000), name = str(d.name, 200), contact = str(d.contact, 200);
  if (!id || !code || !name || !contact) return { ok: false, error: 'missing fields' };
  const answers = d.answers && typeof d.answers === 'object' && !Array.isArray(d.answers) ? d.answers : {};
  const clean = {};
  Object.keys(answers).slice(0, 60).forEach(k => { clean[str(k, 60)] = typeof answers[k] === 'number' ? answers[k] : str(String(answers[k]), 2000); });
  const old = store.rows[id];
  if (old && old.marks) return { ok: true }; // already marked: keep the reviewed attempt
  store.rows[id] = {
    id, ts: new Date().toISOString(), name, contact, region: str(d.region, 200),
    mins: Number(d.mins) || 0, code, answers: clean, marks: old ? old.marks : null,
  };
  fs.appendFileSync(LOG, JSON.stringify(store.rows[id]) + '\n');
  save();
  return { ok: true };
}
function handleMark(d) {
  if (!keyOk(d.key)) return { ok: false, error: 'key' };
  const ok = Array.isArray(d.marks) && d.marks.length === 3 &&
    d.marks.every(m => m === '' || m === '0' || m === '1' || m === '2' || m === '3');
  const r = store.rows[String(d.id)];
  if (!ok || !r) return { ok: false, error: 'bad mark' };
  r.marks = d.marks.every(m => m === '') ? null : d.marks; save();
  return { ok: true };
}
function rowsOut() {
  return Object.values(store.rows).sort((a, b) => a.ts < b.ts ? 1 : -1)
    .map(r => ({ id: r.id, ts: r.ts, name: r.name, contact: r.contact, code: r.code, marks: r.marks }));
}
function csvOut() {
  const rows = Object.values(store.rows).sort((a, b) => a.ts < b.ts ? -1 : 1);
  const akeys = []; rows.forEach(r => Object.keys(r.answers || {}).forEach(k => { if (akeys.indexOf(k) < 0) akeys.push(k); }));
  const head = ['received_utc', 'name', 'contact', 'region', 'minutes'].concat(akeys, ['mark_brief', 'mark_wrong', 'mark_helped', 'backup_code']);
  const lines = [head.map(csvCell).join(',')];
  rows.forEach(r => {
    const m = r.marks || ['', '', ''];
    lines.push([r.ts, r.name, r.contact, r.region, r.mins].concat(akeys.map(k => (r.answers || {})[k]), m, [r.code]).map(csvCell).join(','));
  });
  return '﻿' + lines.join('\n');
}

http.createServer((req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');
  if (u.pathname === '/health') return send(res, 200, { ok: true, rows: Object.keys(store.rows).length });
  if (limited(ip)) return send(res, 429, { ok: false, error: 'slow down' });
  try {
    if (req.method === 'GET' && u.pathname === '/exec') {
      if (u.searchParams.get('action') !== 'list' || !keyOk(u.searchParams.get('key'))) return send(res, 200, { ok: false });
      return send(res, 200, { ok: true, rows: rowsOut() });
    }
    if (req.method === 'GET' && u.pathname === '/export.csv') {
      if (!keyOk(u.searchParams.get('key'))) return send(res, 401, 'Wrong key', 'text/plain');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="builder-check.csv"', 'Cache-Control': 'no-store' });
      return res.end(csvOut());
    }
    if (req.method === 'POST' && u.pathname === '/exec') {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        let d;
        try { d = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return send(res, 200, { ok: false, error: 'bad request' }); }
        if (!d || typeof d !== 'object') return send(res, 200, { ok: false, error: 'bad request' });
        if (d.action === 'submit') return send(res, 200, handleSubmit(d));
        if (d.action === 'mark') return send(res, 200, handleMark(d));
        send(res, 200, { ok: false, error: 'unknown action' });
      });
      return;
    }
    send(res, 404, { ok: false });
  } catch (e) { send(res, 200, { ok: false, error: 'server error' }); }
}).listen(PORT, () => console.log('builder-check backend on ' + PORT + ', rows: ' + Object.keys(store.rows).length));
