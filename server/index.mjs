// Minimal auth + score API for the treasure game.
// Uses only Node built-ins: node:http, node:sqlite (Node >= 22.5) and node:crypto.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT) || 3001;
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'game.db'));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const stmt = {
  insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  userByName: db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  userByToken: db.prepare(
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ),
  insertScore: db.prepare('INSERT INTO scores (user_id, score) VALUES (?, ?)'),
  recentScores: db.prepare(
    'SELECT score, played_at FROM scores WHERE user_id = ? ORDER BY id DESC LIMIT 5'
  ),
  scoreStats: db.prepare(
    'SELECT MAX(score) AS best, COUNT(*) AS games FROM scores WHERE user_id = ?'
  ),
};

// Passwords are stored as "salt:hash" using scrypt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(expected, actual);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  stmt.insertSession.run(token, userId);
  return token;
}

function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function currentUser(req) {
  const token = getToken(req);
  return token ? stmt.userByToken.get(token) : undefined;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('Body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function validateCredentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    return { error: 'Username must be 3-20 letters, numbers or underscores' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  return { username, password };
}

const routes = {
  'POST /api/signup': async (req, res) => {
    const creds = validateCredentials(await readJson(req));
    if (creds.error) return send(res, 400, { error: creds.error });
    if (stmt.userByName.get(creds.username)) {
      return send(res, 409, { error: 'Username is already taken' });
    }
    const { lastInsertRowid } = stmt.insertUser.run(creds.username, hashPassword(creds.password));
    send(res, 201, { token: createSession(lastInsertRowid), username: creds.username });
  },

  'POST /api/signin': async (req, res) => {
    const body = await readJson(req);
    const user = typeof body.username === 'string' && stmt.userByName.get(body.username.trim());
    if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.password_hash)) {
      return send(res, 401, { error: 'Invalid username or password' });
    }
    send(res, 200, { token: createSession(user.id), username: user.username });
  },

  'POST /api/signout': async (req, res) => {
    const token = getToken(req);
    if (token) stmt.deleteSession.run(token);
    send(res, 200, { ok: true });
  },

  'GET /api/me': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { username: user.username });
  },

  'POST /api/scores': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    const { score } = await readJson(req);
    if (!Number.isInteger(score)) return send(res, 400, { error: 'Score must be an integer' });
    stmt.insertScore.run(user.id, score);
    send(res, 201, { ok: true });
  },

  'GET /api/scores': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    const { best, games } = stmt.scoreStats.get(user.id);
    send(res, 200, { best, games, recent: stmt.recentScores.all(user.id) });
  },
};

const server = http.createServer(async (req, res) => {
  const route = routes[`${req.method} ${new URL(req.url, 'http://localhost').pathname}`];
  if (!route) return send(res, 404, { error: 'Not found' });
  try {
    await route(req, res);
  } catch (err) {
    console.error(err);
    send(res, err instanceof SyntaxError ? 400 : 500, { error: 'Request failed' });
  }
});

server.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
