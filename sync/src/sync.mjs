import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeHtml, toPlainText } from './sanitize.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(root + path, 'utf8'));

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const yes = args.has('--yes');
const only = ['completions', 'fixes'].find((c) => args.has(c));

const key = readJson('builtlms-staging.local.json');
const map = readJson('staging-map.local.json');
const firebaseProject = readJson('.firebaserc').projects.default;
const course = readJson('shared/fixtures/returns-101/course.json');

const fixtureBlocks = new Map();
for (const m of course.modules) {
  for (const b of readJson(`shared/fixtures/returns-101/modules/${m.id}.blocks.json`).data) {
    fixtureBlocks.set(b.block_id, { ...b, moduleId: m.id });
  }
}
const fixtureModuleFor = Object.fromEntries(Object.entries(map.modules).map(([fixture, staging]) => [staging, fixture]));

const EDITABLE = {
  ParagraphBlock: { text: 'html' },
  CalloutBlock: { content: 'html', title: 'plain' },
  HeadingBlock: { text: 'plain' },
  ListBlock: { 'items.N.content': 'html' },
};
const MAX_HTML = 4000;

async function api(method, path, body) {
  const res = await fetch(map.host + path, {
    method,
    headers: { authorization: `Bearer ${key.apiKey}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

let db;
function firestore() {
  if (!db) {
    initializeApp({ credential: applicationDefault(), projectId: firebaseProject });
    db = getFirestore();
  }
  return db;
}

async function pullCompletions() {
  const roster = (await api('GET', `/api/v1/courses/${map.courseId}/enrollments?limit=100`)).data;
  const learners = new Map();
  const completions = new Map();

  for (const e of roster) {
    const name = e.user?.display_name || [e.user?.first_name, e.user?.last_name].filter(Boolean).join(' ') || 'Learner';
    learners.set(e.user_id, { name });
    if (!e.progress_percentage) continue;
    const progress = (await api('GET', `/api/v1/course-enrollments/${e.id}/progress`)).data;
    for (const m of progress.modules ?? []) {
      const moduleId = fixtureModuleFor[m.module_id];
      if (!moduleId || m.status !== 'completed' || !m.completed_at) continue;
      completions.set(`${e.id}_${moduleId.slice(-4)}`, {
        moduleId,
        learnerId: e.user_id,
        completedAt: Date.parse(m.completed_at),
        score: typeof m.score === 'number' ? m.score : null,
      });
    }
  }

  console.log(`Roster: ${roster.length} enrolled, ${completions.size} lesson completions.`);
  for (const [id, c] of completions) {
    console.log(`  ${learners.get(c.learnerId).name.padEnd(22)} ${c.moduleId.slice(-4)}  ${new Date(c.completedAt).toISOString()}  (${id.slice(0, 8)})`);
  }
  if (dryRun) return;

  const store = firestore();
  const batch = store.batch();
  const existing = await store.collection('completions').get();
  for (const doc of existing.docs) if (!completions.has(doc.id)) batch.delete(doc.ref);
  const existingLearners = await store.collection('learners').get();
  for (const doc of existingLearners.docs) if (!learners.has(doc.id)) batch.delete(doc.ref);
  for (const [id, c] of completions) batch.set(store.collection('completions').doc(id), c);
  for (const [id, l] of learners) batch.set(store.collection('learners').doc(id), l);
  batch.set(store.collection('meta').doc('sync'), { completionsSyncedAt: Date.now(), source: map.host });
  await batch.commit();
  console.log('Wrote completions and learners to Firestore.');
}

function planBlockChange(change) {
  const fixture = fixtureBlocks.get(change.blockId);
  const stagingBlockId = map.blocks[change.blockId];
  if (!fixture || !stagingBlockId) throw new Error(`unknown block ${change.blockId}`);
  const rules = EDITABLE[fixture.type];
  const pattern = /^items\.(\d+)\.content$/.exec(change.propName);
  const kind = rules?.[pattern ? 'items.N.content' : change.propName];
  if (!kind) throw new Error(`${fixture.type}.${change.propName} is not editable`);
  if (typeof change.html !== 'string' || change.html.length > MAX_HTML) throw new Error(`${change.blockId} html is missing or too long`);
  const value = kind === 'html' ? sanitizeHtml(change.html) : toPlainText(change.html);
  if (!toPlainText(value).trim()) throw new Error(`${change.blockId} would be left empty`);
  return {
    stagingModuleId: map.modules[fixture.moduleId],
    stagingBlockId,
    label: `${fixture.type} ${change.blockId} ${change.propName}`,
    apply(props) {
      if (!pattern) return { patch: { [change.propName]: value }, before: props[change.propName], after: value };
      const index = Number(pattern[1]);
      const items = structuredClone(props.items ?? []);
      if (!items[index]) throw new Error(`${change.blockId} has no item ${index}`);
      const before = items[index].content;
      items[index].content = value;
      return { patch: { items }, before, after: value };
    },
  };
}

function planQuizChange(q) {
  const fixture = fixtureBlocks.get(q.blockId);
  const stagingBlockId = map.blocks[q.blockId];
  if (!fixture || fixture.type !== 'SimpleQuizBlock' || !stagingBlockId) throw new Error(`unknown quiz block ${q.blockId}`);
  const text = (v, max) => {
    if (typeof v !== 'string' || v.length > max) throw new Error(`quiz ${q.id} has a missing or long field`);
    return toPlainText(v).trim();
  };
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) throw new Error(`quiz ${q.id} needs 2 to 8 options`);
  const options = q.options.map((o) => text(o, 300));
  const correctAnswer = text(q.correctAnswer, 300);
  if (!options.includes(correctAnswer)) throw new Error(`quiz ${q.id} correct answer is not one of its options`);
  const next = { question: text(q.question, 1000), options, correctAnswer, feedback: text(q.feedback, 1000) };
  return {
    stagingModuleId: map.modules[fixture.moduleId],
    stagingBlockId,
    label: `Quiz ${q.blockId} question ${q.id}`,
    apply(props) {
      const questions = structuredClone(props.questions ?? []);
      const at = questions.findIndex((x) => x.id === q.id);
      if (at < 0) throw new Error(`quiz question ${q.id} is not on staging`);
      const before = questions[at];
      questions[at] = { ...before, ...next };
      return { patch: { questions }, before: `${before.question} [${before.correctAnswer}]`, after: `${next.question} [${next.correctAnswer}]` };
    },
  };
}

async function confirm(question) {
  if (yes) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

const ADMIN_EMAIL = 'tyler@builtlms.com';

async function pushFixes() {
  const store = firestore();
  const approved = await store.collection('flags').where('status', '==', 'approved').get();
  if (approved.empty) {
    console.log('No approved fixes waiting.');
    return;
  }

  for (const doc of approved.docs) {
    const flag = doc.data();
    console.log(`\nFlag ${doc.id}: "${flag.oldValue}" → "${flag.newValue}"`);
    if (flag.approvedBy !== ADMIN_EMAIL) {
      console.log(`  Skipped: approved by ${flag.approvedBy ?? 'an unknown account'}, not ${ADMIN_EMAIL}.`);
      continue;
    }
    let plan;
    try {
      const fix = flag.fix ?? {};
      if (!Array.isArray(fix.blocks) || !Array.isArray(fix.quizQuestions) || fix.blocks.length + fix.quizQuestions.length === 0) {
        throw new Error('the approved flag carries no fix');
      }
      if (fix.blocks.length + fix.quizQuestions.length > 20) throw new Error('the fix changes too many blocks');
      plan = [...fix.blocks.map(planBlockChange), ...fix.quizQuestions.map(planQuizChange)];
    } catch (err) {
      console.log(`  Rejected: ${err.message}`);
      if (!dryRun) await doc.ref.update({ applyError: err.message });
      continue;
    }

    const blocksByModule = new Map();
    const steps = [];
    for (const step of plan) {
      if (!blocksByModule.has(step.stagingModuleId)) {
        blocksByModule.set(step.stagingModuleId, (await api('GET', `/api/v1/modules/${step.stagingModuleId}/blocks`)).data);
      }
      const current = blocksByModule.get(step.stagingModuleId).find((b) => b.block_id === step.stagingBlockId);
      if (!current) throw new Error(`${step.label}: block is missing on staging`);
      const { patch, before, after } = step.apply(current.props);
      Object.assign(current.props, patch);
      steps.push({ step, patch });
      console.log(`  ${step.label}`);
      console.log(`    before: ${toPlainText(String(before ?? '')).slice(0, 240)}`);
      console.log(`    after:  ${toPlainText(after).slice(0, 240)}`);
    }

    if (dryRun) continue;
    if (!(await confirm(`  Write these ${steps.length} change(s) to Returns 101 on staging? [y/N] `))) {
      console.log('  Skipped.');
      continue;
    }
    try {
      for (const { step, patch } of steps) {
        await api('PATCH', `/api/v1/modules/${step.stagingModuleId}/blocks/${step.stagingBlockId}`, { props: patch });
      }
      await doc.ref.update({ status: 'fixed', fixedAt: Date.now(), appliedBlocks: steps.length, applyError: null });
      console.log('  Written to staging. Flag marked fixed.');
    } catch (err) {
      await doc.ref.update({ applyError: err.message });
      console.log(`  Failed: ${err.message}`);
    }
  }
}

if (dryRun) console.log('Dry run: nothing is written.\n');
if (!only || only === 'completions') await pullCompletions();
if (!only || only === 'fixes') {
  if (dryRun && !only) console.log('\nFixes need Firestore; run "fixes --dry-run" once Firestore access works.');
  else await pushFixes();
}
