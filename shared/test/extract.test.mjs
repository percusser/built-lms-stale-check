import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { acceptExtractedFacts } from '../src/index.js';

const root = new URL('../fixtures/returns-101/', import.meta.url);
const golden = JSON.parse(await readFile(new URL('facts.golden.json', root)));
const moduleId = '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a12';
const blocksResponse = JSON.parse(await readFile(new URL(`modules/${moduleId}.blocks.json`, root)));
const lessonFacts = golden.facts.filter((f) => f.moduleId === moduleId);

test('keeps facts whose value is in their block and drops invented ones', () => {
  const { facts, rejected } = acceptExtractedFacts(
    {
      facts: [
        ...lessonFacts,
        { ...lessonFacts[0], value: '90 days', statement: 'Returns are accepted for 90 days.' },
        { ...lessonFacts[0], blockId: 'ParagraphBlock-nope' },
        { ...lessonFacts[0], quizQuestionIds: ['q-invented'] },
      ],
    },
    { moduleId, blocksResponse },
  );
  assert.equal(facts.length, lessonFacts.length + 1);
  assert.deepEqual(rejected.map((r) => r.problem), ['value_not_in_block', 'unknown_block']);
  assert.ok(facts.every((f) => f.moduleId === moduleId && !f.quizQuestionIds.includes('q-invented')));
  assert.equal(new Set(facts.map((f) => f.id)).size, facts.length);
});
