import { readFile } from 'node:fs/promises';
import { blockText, quizQuestions, stripHtml, normalizeForMatch, prefilterFacts, lessonPromptInput, renderPrompt } from '../src/index.js';

const root = new URL('../../', import.meta.url);
const read = async (p) => readFile(new URL(p, root), 'utf8');
const json = async (p) => JSON.parse(await read(p));
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

const course = await json('shared/fixtures/returns-101/course.json');
const { facts } = await json('shared/fixtures/returns-101/facts.golden.json');
const { messages } = await json('shared/fixtures/messages.json');
const blocks = new Map();
const questions = new Map();
for (const m of course.modules) {
  const res = await json(`shared/fixtures/returns-101/${m.blocks}`);
  check(res.meta.total === res.data.length, `${m.title}: meta.total mismatch`);
  for (const b of res.data) blocks.set(b.block_id, { ...b, moduleId: m.id });
  for (const q of quizQuestions(res.data)) {
    questions.set(q.id, q);
    check(q.options.includes(q.correctAnswer), `${q.id}: correctAnswer is not an option`);
  }
  const prompt = renderPrompt(await read('shared/prompts/extract-facts.md'), { lessonTitle: m.title, ...lessonPromptInput(res) });
  check(!prompt.includes('{{'), `${m.title}: unrendered prompt variable`);
}

const pageText = async (p) => stripHtml((await read(p)).replace(/[\s\S]*<main>/, '').replace(/<\/main>[\s\S]*/, ''));
const pages = {
  'refunds.html': await pageText('demo-wiki/refunds.html'),
  'exchanges.html': await pageText('demo-wiki/exchanges.html'),
  'escalation.html': await pageText('demo-wiki/escalation.html'),
};
const v2 = await pageText('demo-wiki/variants/refunds-v2-14-days.html');
const reworded = await pageText('demo-wiki/variants/refunds-reworded.html');
const has = (text, needle) => normalizeForMatch(text).includes(normalizeForMatch(needle));

for (const f of facts) {
  const block = blocks.get(f.blockId);
  check(block, `${f.id}: block ${f.blockId} missing`);
  if (block) check(block.moduleId === f.moduleId, `${f.id}: moduleId does not match block`);
  for (const q of f.quizQuestionIds) check(questions.has(q), `${f.id}: quiz question ${q} missing`);
  const page = pages[f.sourceUrl.split('/').pop()];
  check(page, `${f.id}: no wiki page for ${f.sourceUrl}`);
  const firstValuePart = f.value.split(/[,/]/)[0].trim();
  if (block && !f.value.includes('/') && !f.value.includes(',')) check(has(blockText(block), f.value), `${f.id}: value "${f.value}" not in block text`);
  if (page) check(has(page, firstValuePart) || f.id === 'f-exchange-price-difference' || f.id === 'f-escalation-steps', `${f.id}: "${firstValuePart}" not on ${f.sourceUrl}`);
}

check(has(v2, '14 days') && !has(v2, '30 days'), 'v2 refunds page should say 14 days and not 30 days');
check(has(reworded, '30 days') && !has(reworded, '14 days'), 'reworded refunds page should keep 30 days');

for (const m of messages) {
  const shortlist = prefilterFacts(m.text, facts);
  for (const e of m.expect) check(shortlist.some((f) => f.id === e.factId), `${m.id}: prefilter dropped ${e.factId}`);
}

const studentBlocks = [...blocks.values()].filter((b) => b.type !== 'SimpleQuizBlock').length;
console.log(`${course.modules.length} lessons, ${blocks.size} blocks (${studentBlocks} content), ${questions.size} quiz questions, ${facts.length} golden facts, ${messages.length} sample messages`);
if (problems.length) { console.error(problems.map((p) => `✗ ${p}`).join('\n')); process.exit(1); }
console.log('✓ fixtures consistent');
