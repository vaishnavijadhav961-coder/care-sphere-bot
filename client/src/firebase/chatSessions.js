import { db } from './config';
import { ref, get, set, remove, child } from 'firebase/database';
import { snapshotToArray } from './utils';

const PATH = 'chatSessions';

export function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `session_${ts}_${rand}`;
}

export async function getSessions(uid) {
  if (!uid) return [];
  try {
    const snap = await get(child(ref(db), `${PATH}/${uid}`));
    if (!snap.exists()) return [];
    const result = snapshotToArray(snap).map(({ id, preview, updatedAt }) => ({
      id, preview: preview || '', updatedAt: updatedAt || ''
    }));
    result.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return result;
  } catch (err) {
    console.error('[chatSessions] getSessions error:', err);
    return [];
  }
}

export async function getSession(uid, sessionId) {
  if (!uid || !sessionId) return null;
  try {
    const snap = await get(child(ref(db), `${PATH}/${uid}/${sessionId}`));
    if (!snap.exists()) return null;
    return snap.val();
  } catch (err) {
    console.error('[chatSessions] getSession error:', err);
    return null;
  }
}

export async function saveSession(uid, sessionId, messages) {
  if (!uid || !sessionId) return;
  try {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const preview = lastMsg?.parts?.[0]?.text?.slice(0, 60) || '';
    const now = new Date().toISOString();
    const existingSnap = await get(child(ref(db), `${PATH}/${uid}/${sessionId}`));
    const existing = existingSnap.exists() ? existingSnap.val() : {};
    await set(child(ref(db), `${PATH}/${uid}/${sessionId}`), {
      ...existing,
      messages,
      preview,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    });
  } catch (err) {
    console.error('[chatSessions] saveSession error:', err);
  }
}

export async function deleteSession(uid, sessionId) {
  if (!uid || !sessionId) return;
  try {
    await remove(child(ref(db), `${PATH}/${uid}/${sessionId}`));
  } catch (err) {
    console.error('[chatSessions] deleteSession error:', err);
  }
}
