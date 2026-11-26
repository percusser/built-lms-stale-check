import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { loadFirebaseConfig } from '../../shared/scripts/load-config.mjs';
import { completions, drafts, flags, learners, org } from '../../dashboard/src/data/sample.js';

const projectId = (await loadFirebaseConfig())?.firebase?.projectId;
if (!projectId) throw new Error('firebase-config.local.json needs firebase.projectId.');
const wiki = `https://${projectId}.web.app/wiki/`;
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const root = db.collection('demo').doc(org.id);
const batch = db.batch();
batch.set(root, { name: org.name, fictional: true });
for (const { id, ...flag } of flags) {
  if (flag.sourceUrl) flag.sourceUrl = flag.sourceUrl.replace('http://localhost:5050/', wiki).replace(/\.html$/, '');
  batch.set(root.collection('flags').doc(id), flag);
}
for (const l of learners) batch.set(root.collection('learners').doc(l.id), l);
for (const c of completions) batch.set(root.collection('completions').doc(`${c.learnerId}-${c.moduleId.slice(-2)}`), c);
for (const [id, d] of Object.entries(drafts)) batch.set(root.collection('drafts').doc(id.replace(/[:/]/g, '_')), d);
await batch.commit();
const counts = await Promise.all(['flags', 'learners', 'completions', 'drafts'].map(async (n) => `${n} ${(await root.collection(n).count().get()).data().count}`));
console.log(`Seeded demo/${org.id}: ${counts.join(', ')}`);
