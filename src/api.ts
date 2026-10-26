// Thin client for the SQLite-backed API in server/index.mjs (proxied via /api in dev)
const TOKEN_KEY = 'treasure-game-token';

export interface ScoreSummary {
  best: number | null;
  games: number;
  recent: { score: number; played_at: string }[];
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the session just won't survive a reload
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the server. Is `npm run server` running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export async function signUp(username: string, password: string) {
  const data = await request<{ token: string; username: string }>('POST', '/api/signup', { username, password });
  setToken(data.token);
  return data.username;
}

export async function signIn(username: string, password: string) {
  const data = await request<{ token: string; username: string }>('POST', '/api/signin', { username, password });
  setToken(data.token);
  return data.username;
}

export async function signOut() {
  try {
    await request('POST', '/api/signout');
  } finally {
    setToken(null);
  }
}

export async function fetchMe() {
  if (!getToken()) return null;
  try {
    const data = await request<{ username: string }>('GET', '/api/me');
    return data.username;
  } catch {
    setToken(null);
    return null;
  }
}

export function saveScore(score: number) {
  return request('POST', '/api/scores', { score });
}

export function fetchScores() {
  return request<ScoreSummary>('GET', '/api/scores');
}
