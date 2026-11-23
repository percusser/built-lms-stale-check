import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

const OWNER = { email: 'tyler@builtlms.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const flag = {
  factId: 'f1', moduleId: 'm1', verdict: 'changed', oldValue: '30 days', newValue: '14 days', quote: 'Returns within 14 days',
  origin: 'iphone', inferenceSource: 'ON_DEVICE', createdAt: 1, status: 'open',
};
const fix = { changeSummary: 'Window is 14 days', blocks: [], quizQuestions: [] };

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-stale-check', firestore: { rules: await readFile('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'flags/existing'), flag);
    await setDoc(doc(ctx.firestore(), 'learners/l1'), { name: 'Dana' });
    await setDoc(doc(ctx.firestore(), 'completions/c1'), { learnerId: 'l1', moduleId: 'm1', completedAt: 1 });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const owner = () => env.authenticatedContext('owner', OWNER).firestore();
const stranger = () => env.authenticatedContext('other', { ...OWNER, email: 'someone@example.com' }).firestore();

test('devices can create flags and check for new ids without signing in', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'flags/new')));
  await assertSucceeds(setDoc(doc(anon(), 'flags/new'), flag));
});

test('signed-out and other accounts cannot read flags, learners or completions', async () => {
  for (const db of [anon(), stranger()]) {
    await assertFails(getDoc(doc(db, 'flags/existing')));
    await assertFails(getDocs(collection(db, 'flags')));
    await assertFails(getDocs(collection(db, 'learners')));
    await assertFails(getDocs(collection(db, 'completions')));
  }
});

test('only the owner can approve a fix', async () => {
  const approval = { status: 'approved', approvedAt: 2, fix };
  await assertFails(updateDoc(doc(anon(), 'flags/existing'), approval));
  await assertFails(updateDoc(doc(stranger(), 'flags/existing'), { ...approval, approvedBy: 'someone@example.com' }));
  await assertFails(updateDoc(doc(owner(), 'flags/existing'), { ...approval, approvedBy: 'someone@example.com' }));
  await assertSucceeds(updateDoc(doc(owner(), 'flags/existing'), { ...approval, approvedBy: OWNER.email }));
});

test('the owner can read the roster', async () => {
  await assertSucceeds(getDocs(collection(owner(), 'flags')));
  await assertSucceeds(getDocs(collection(owner(), 'learners')));
  await assertSucceeds(getDocs(collection(owner(), 'completions')));
});

test('a source link must be http or https', async () => {
  await assertFails(setDoc(doc(anon(), 'flags/bad'), { ...flag, sourceUrl: 'javascript:alert(1)' }));
  await assertSucceeds(setDoc(doc(anon(), 'flags/good'), { ...flag, sourceUrl: 'https://example.com/returns' }));
});
