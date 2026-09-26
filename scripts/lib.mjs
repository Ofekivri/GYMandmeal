// Shared helpers for the Claude Code → GYMandmeal data scripts.
// Auth: Firebase email/password REST sign-in, then the refresh token lives in
// ~/.config/gymandmeal/credentials.json (0600, outside every repo). Writes go
// through the Firestore REST API as that user, so the normal security rules
// apply (the admin can write any trainee's data; nobody else can).
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const CRED_PATH = path.join(homedir(), '.config', 'gymandmeal', 'credentials.json');

export const norm = t => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Same public web config the app is built with.
export function firebaseConfig() {
  const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const get = key => (env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const cfg = { apiKey: get('VITE_FIREBASE_API_KEY'), projectId: get('VITE_FIREBASE_PROJECT_ID') };
  if (!cfg.apiKey || !cfg.projectId) throw new Error('Missing VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID in .env.local');
  return cfg;
}

async function postJson(url, body, form = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
}

export async function signIn(email, password) {
  const { apiKey } = firebaseConfig();
  const data = await postJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    { email, password, returnSecureToken: true });
  return { idToken: data.idToken, refreshToken: data.refreshToken, uid: data.localId, email: data.email };
}

export function saveCredentials(creds) {
  mkdirSync(path.dirname(CRED_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  chmodSync(CRED_PATH, 0o600);
}

// Fresh ID token from the stored refresh token.
export async function session() {
  if (!existsSync(CRED_PATH)) throw new Error(`Not signed in. Run: node ${path.join('scripts', 'login.mjs')}`);
  const creds = JSON.parse(readFileSync(CRED_PATH, 'utf8'));
  const { apiKey, projectId } = firebaseConfig();
  const data = await postJson(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    { grant_type: 'refresh_token', refresh_token: creds.refreshToken }, true);
  if (data.refresh_token && data.refresh_token !== creds.refreshToken) saveCredentials({ ...creds, refreshToken: data.refresh_token });
  return { idToken: data.id_token, uid: data.user_id, email: creds.email, projectId };
}

// ─── Firestore REST value encoding ─────────────────────────────────────────
export function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(toValue) } : {} };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error(`Unsupported value: ${v}`);
}
export const toFields = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

export function fromValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return undefined;
}
export const fromFields = fields => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromValue(v)]));

// ─── Firestore REST calls ──────────────────────────────────────────────────
const base = s => `https://firestore.googleapis.com/v1/projects/${s.projectId}/databases/(default)/documents`;

async function call(s, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${s.idToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url.split('/documents/')[1] || url}: ${data.error?.status || res.status} ${data.error?.message || ''}`);
  return data;
}

// All docs of a collection path like "trainees" or "trainees/UID/workouts".
export async function listDocs(s, collectionPath) {
  const out = [];
  let pageToken = '';
  do {
    const data = await call(s, 'GET', `${base(s)}/${collectionPath}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const d of data.documents || []) out.push({ id: d.name.split('/').pop(), ...fromFields(d.fields) });
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function getDoc(s, docPath) {
  try {
    const d = await call(s, 'GET', `${base(s)}/${docPath}`);
    return fromFields(d.fields);
  } catch (err) {
    if (String(err.message).includes('NOT_FOUND')) return null;
    throw err;
  }
}

export async function createDoc(s, collectionPath, data) {
  const d = await call(s, 'POST', `${base(s)}/${collectionPath}`, { fields: toFields(data) });
  return d.name.split('/').pop();
}

// Docs of a sub-collection (plan, meals, logs) whose `date` is in [from, to],
// so reads don't grow with the whole history. parentPath: "trainees/UID".
export async function listByDate(s, parentPath, collectionId, from, to) {
  const f = (op, value) => ({ fieldFilter: { field: { fieldPath: 'date' }, op, value: toValue(value) } });
  const rows = await call(s, 'POST', `${base(s)}/${parentPath}:runQuery`, {
    structuredQuery: {
      from: [{ collectionId }],
      where: { compositeFilter: { op: 'AND', filters: [f('GREATER_THAN_OR_EQUAL', from), f('LESS_THAN_OR_EQUAL', to)] } },
    },
  });
  return rows.filter(r => r.document).map(r => ({ id: r.document.name.split('/').pop(), ...fromFields(r.document.fields) }));
}

// Several writes in one atomic commit: [{ update: docPath, data }, { delete: docPath }].
// An update fails if the doc is gone, like the SDK's updateDoc.
export async function commit(s, writes) {
  const name = p => `projects/${s.projectId}/databases/(default)/documents/${p}`;
  await call(s, 'POST', `${base(s)}:commit`, {
    writes: writes.map(w => w.delete ? { delete: name(w.delete) } : {
      update: { name: name(w.update), fields: toFields(w.data) },
      updateMask: { fieldPaths: Object.keys(w.data) },
      currentDocument: { exists: true },
    }),
  });
}

// Signed-in session + the one trainee matching a name (or part of it) or email.
export async function openTrainee(query) {
  const s = await session();
  const settings = await getDoc(s, 'config/settings');
  if (settings?.adminEmail !== s.email) console.warn(`! ${s.email} is not the admin in config/settings; other trainees' data will be denied.`);
  const trainees = await listDocs(s, 'trainees');
  const q = norm(query);
  const matches = trainees.filter(t => norm(t.email) === q || norm(t.name).includes(q));
  if (matches.length !== 1) {
    throw new Error(`Trainee "${query}" matched ${matches.length}: ${trainees.map(t => `${t.name} <${t.email}>`).join(', ') || '(no trainees)'}`);
  }
  return { s, trainee: matches[0], root: `trainees/${matches[0].id}`, trainees };
}

// Overwrites only the given fields.
export async function updateDoc(s, docPath, data) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  await call(s, 'PATCH', `${base(s)}/${docPath}?${mask}`, { fields: toFields(data) });
}
