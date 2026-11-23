import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { stripHtml } from '@stale-check/shared';

const out = join(await mkdtemp(join(tmpdir(), 'stale-check-')), 'bundle.mjs');
await build({
  stdin: { contents: "export * from './src/check.js'; export { createStandInModel } from './src/models/stand-in.js'; export { factsForUrl } from './src/facts.js';", resolveDir: '.', loader: 'js' },
  outfile: out, bundle: true, format: 'esm', platform: 'node', loader: { '.md': 'text' }, logLevel: 'error',
});
const { chunkPage, checkFact, mergeChunkVerdicts, createStandInModel, factsForUrl } = await import(out);

const wiki = (file) => readFile(new URL(`../../demo-wiki/${file}`, import.meta.url), 'utf8').then(stripHtml);
const refundFacts = factsForUrl('http://localhost:5050/refunds.html');

async function verdicts(file) {
  const text = await wiki(file);
  const model = createStandInModel();
  const results = {};
  for (const fact of refundFacts) results[fact.id] = (await checkFact(model, fact, text)).verdict;
  return results;
}

test('original refunds page: every fact still true', async () => {
  assert.deepEqual(new Set(Object.values(await verdicts('refunds.html'))), new Set(['still_true']));
});

test('14-day page: only the refund window is flagged, as changed', async () => {
  const v = await verdicts('variants/refunds-v2-14-days.html');
  assert.equal(v['f-refund-window'], 'changed');
  assert.deepEqual(Object.entries(v).filter(([, x]) => x !== 'still_true').map(([id]) => id), ['f-refund-window']);
});

test('a changed verdict whose quote is not on the page is not a flag', async () => {
  const fact = refundFacts.find((f) => f.id === 'f-refund-window');
  const liar = { async generate() { return { result: { quote: 'Returns are accepted for 90 days.', newValue: '90 days', verdict: 'changed' }, inferenceSource: 'ON_DEVICE' }; } };
  assert.equal((await checkFact(liar, fact, await wiki('refunds.html'))).verdict, 'unverified');
});

test('a removed verdict is rejected while the value is still on the page', async () => {
  const fact = refundFacts.find((f) => f.id === 'f-refund-window');
  const liar = { async generate() { return { result: { quote: '', newValue: '', verdict: 'removed' }, inferenceSource: 'ON_DEVICE' }; } };
  assert.equal((await checkFact(liar, fact, await wiki('refunds.html'))).verdict, 'unverified');
});

test('a long page is split, and the fact is found in whichever part holds it', async () => {
  const filler = Array.from({ length: 400 }, (_, i) => `Unrelated store note number ${i} about opening hours and parking.`).join('\n');
  const text = `${filler}\n${await wiki('variants/refunds-v2-14-days.html')}\n${filler}`;
  assert.ok(chunkPage(text).length > 1);
  const fact = refundFacts.find((f) => f.id === 'f-refund-window');
  assert.equal((await checkFact(createStandInModel(), fact, text)).verdict, 'changed');
});

test('a part with no answer from the model does not turn into a flag', () => {
  const merged = mergeChunkVerdicts([{ reason: 'too_long', accepted: false, inferenceSource: 'ON_DEVICE' }]);
  assert.equal(merged.verdict, 'not_checked');
  assert.equal(merged.reason, 'too_long');
});
