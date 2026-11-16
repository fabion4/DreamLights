#!/usr/bin/env node
'use strict';
/*
 * Stanza Infinita II - server opzionale, senza dipendenze.
 * Serve la pagina e tiene la classifica condivisa (stanze pubblicate e voti) in data/db.json.
 *
 *   node server.js            -> http://localhost:8080
 *   PORT=3000 node server.js  -> altra porta
 *   DATA_DIR=/var/lib/stanza  -> altra cartella per i dati
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const MAX_BODY = 400 * 1024;
const MAX_CREATIONS = 500;
const MAX_VOTES = 5;
const MAX_ITEMS = 60;

/* only these files are ever served */
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/vendor/three.min.js': ['vendor/three.min.js', 'text/javascript; charset=utf-8'],
  '/versione-1/': ['versione-1/index.html', 'text/html; charset=utf-8'],
  '/versione-1/index.html': ['versione-1/index.html', 'text/html; charset=utf-8']
};

let db = { rev: 1, creations: {}, votes: {} };
try {
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (raw && typeof raw === 'object') {
    db.rev = Number(raw.rev) || 1;
    db.creations = raw.creations && typeof raw.creations === 'object' ? raw.creations : {};
    db.votes = raw.votes && typeof raw.votes === 'object' ? raw.votes : {};
  }
} catch (e) { /* first run: empty gallery */ }

let saveTimer = null;
function persist() {
  db.rev++;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('Salvataggio non riuscito:', e.message); }
  }, 300);
}

/* the browser keeps a secret token; everyone else only ever sees the id derived from it */
function publicId(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{32}$/.test(token)) return null;
  return 'u' + crypto.createHash('sha256').update('stanza:' + token).digest('hex').slice(0, 16);
}
const validTarget = id => typeof id === 'string' &&
  (/^k-[a-z0-9-]{1,24}$/.test(id) || Object.prototype.hasOwnProperty.call(db.creations, id));

function counts() {
  const out = {};
  for (const voter of Object.keys(db.votes)) {
    let n = 0;
    for (const id of db.votes[voter]) {
      if (id === voter || !validTarget(id)) continue;
      if (++n > MAX_VOTES) break;
      out[id] = (out[id] || 0) + 1;
    }
  }
  return out;
}
function state(pid) {
  return {
    ok: true,
    rev: db.rev,
    creations: Object.keys(db.creations).map(id => Object.assign({ id }, db.creations[id])),
    counts: counts(),
    me: { id: pid, picks: (pid && db.votes[pid]) || [] }
  };
}

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
function cleanCreation(b) {
  if (!b || typeof b !== 'object') return null;
  const title = text(b.title, 32);
  if (title.length < 2) return null;
  const sc = b.scene;
  if (!sc || typeof sc !== 'object' || !Array.isArray(sc.items) || !sc.items.length || sc.items.length > MAX_ITEMS) return null;
  if (!sc.room || typeof sc.room !== 'object') return null;
  if (JSON.stringify(sc).length > 200000) return null;
  let thumb = '';
  if (typeof b.thumb === 'string' && b.thumb.length < 140000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.thumb)) thumb = b.thumb;
  return { v: 2, title, author: text(b.author, 24), thumb, scene: { room: sc.room, items: sc.items }, updatedAt: Date.now() };
}

/* light protection against scripted floods: 40 writes per minute per address */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.t > 60000) { h = { t: now, n: 0 }; hits.set(ip, h); }
  if (hits.size > 5000) hits.clear();
  return ++h.n > 40;
}

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, {
    'content-type': type || 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': type ? 'public, max-age=300' : 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  res.end(buf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const pid = publicId(req.headers['x-stanza-token']);
  const route = req.method + ' ' + url.pathname;

  if (route === 'GET /api/state') {
    if (url.searchParams.get('rev') === String(db.rev)) return send(res, 200, { ok: true, rev: db.rev, unchanged: true });
    return send(res, 200, state(pid));
  }
  if (!pid) return send(res, 401, { ok: false, error: 'token' });
  const ip = req.socket.remoteAddress || '';
  if (limited(ip)) return send(res, 429, { ok: false, error: 'slow_down' });

  if (route === 'PUT /api/creation') {
    const doc = cleanCreation(await readBody(req));
    if (!doc) return send(res, 400, { ok: false, error: 'invalid' });
    if (!db.creations[pid] && Object.keys(db.creations).length >= MAX_CREATIONS) return send(res, 409, { ok: false, error: 'full' });
    db.creations[pid] = doc;
    persist();
    return send(res, 200, state(pid));
  }
  if (route === 'DELETE /api/creation') {
    if (db.creations[pid]) { delete db.creations[pid]; persist(); }
    return send(res, 200, state(pid));
  }
  if (route === 'POST /api/vote') {
    const b = await readBody(req);
    const id = b && b.id;
    if (!validTarget(id) || id === pid) return send(res, 400, { ok: false, error: 'invalid' });
    const picks = (db.votes[pid] || []).filter(x => x !== id && validTarget(x));
    if (b.on === true) {
      if (picks.length >= MAX_VOTES) return send(res, 409, { ok: false, error: 'no_votes_left' });
      picks.push(id);
    }
    db.votes[pid] = picks;
    persist();
    return send(res, 200, state(pid));
  }
  return send(res, 404, { ok: false, error: 'not_found' });
}

http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, { ok: false, error: 'bad_url' }); }
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(e => {
      if (!res.headersSent) send(res, e.message === 'too_large' ? 413 : 400, { ok: false, error: e.message || 'error' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method' });
  if (url.pathname === '/versione-1') { res.writeHead(302, { location: '/versione-1/' }); return res.end(); }
  const hit = STATIC[url.pathname];
  if (!hit) return send(res, 404, 'Non trovato', 'text/plain; charset=utf-8');
  fs.readFile(path.join(ROOT, hit[0]), (err, buf) => {
    if (err) return send(res, 404, 'Non trovato', 'text/plain; charset=utf-8');
    send(res, 200, buf, hit[1]);
  });
}).listen(PORT, () => {
  console.log('Stanza Infinita II su http://localhost:' + PORT + '  (dati in ' + DB_FILE + ')');
});
