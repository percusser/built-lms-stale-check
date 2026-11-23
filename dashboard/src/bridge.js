import { createFirebaseModel } from '@stale-check/shared/firebase-model';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase.js';

const FLAG_FIELDS = ['factId', 'moduleId', 'courseId', 'verdict', 'oldValue', 'newValue', 'quote', 'origin', 'inferenceSource', 'createdAt', 'createdBy', 'changedAt', 'sourceUrl', 'sourceLabel'];

async function saveFlags(flags) {
  const db = getFirestore(app);
  let saved = 0;
  for (const flag of flags ?? []) {
    const data = Object.fromEntries(FLAG_FIELDS.filter((k) => flag[k] !== undefined && flag[k] !== null).map((k) => [k, flag[k]]));
    try {
      const ref = doc(db, 'flags', String(flag.id));
      if ((await getDoc(ref)).exists()) continue;
      await setDoc(ref, { ...data, origin: 'extension', status: 'open' });
      saved++;
    } catch {}
  }
  return { saved };
}

const allowed = new Set((FIREBASE_CONFIG?.extensionIds ?? []).map((id) => `chrome-extension://${id}`));
const app = firebaseApp();
const model = app && createFirebaseModel(app);

addEventListener('message', async (event) => {
  if (!allowed.has(event.origin) || event.source !== parent) return;
  const { id, type, request } = event.data ?? {};
  let out;
  if (!model) out = { reason: 'needs_cloud' };
  else try {
    if (type === 'status') out = await model.status();
    else if (type === 'generate') out = await model.generate(request);
    else if (type === 'saveFlags') out = await saveFlags(request?.flags);
    else return;
  } catch (err) {
    out = { reason: 'model_error', detail: err?.message };
  }
  parent.postMessage({ id, out }, event.origin);
});

parent.postMessage({ type: 'ready' }, '*');
