import { acceptPageVerdict, renderPrompt } from '@stale-check/shared';
import checkPageTemplate from '@stale-check/shared/prompts/check-page.md';
import checkPageSchema from '@stale-check/shared/schemas/check-page.response.schema.json';

export const MAX_CHUNK_CHARS = 12000;

export function chunkPage(text, max = MAX_CHUNK_CHARS) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const pieces = line.length > max ? line.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g')) : [line];
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > max) {
        chunks.push(current);
        current = '';
      }
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [''];
}

export function checkPrompt(fact, pageText) {
  return renderPrompt(checkPageTemplate, { statement: fact.statement, value: fact.value, pageText });
}

export function mergeChunkVerdicts(verdicts) {
  const accepted = verdicts.filter((v) => v.accepted);
  const changed = accepted.find((v) => v.verdict === 'changed');
  if (changed) return changed;
  const stillTrue = accepted.find((v) => v.verdict === 'still_true');
  if (stillTrue) return stillTrue;
  const failed = verdicts.find((v) => v.reason);
  if (failed && accepted.length === 0) return { verdict: 'not_checked', newValue: '', quote: '', reason: failed.reason, inferenceSource: failed.inferenceSource };
  if (accepted.length === verdicts.length) return accepted[0];
  return { verdict: 'unverified', newValue: '', quote: '', inferenceSource: verdicts[0]?.inferenceSource };
}

export async function checkFact(model, fact, pageText) {
  const verdicts = [];
  for (const chunk of chunkPage(pageText)) {
    const out = await model.generate({ prompt: checkPrompt(fact, chunk), schema: checkPageSchema, meta: { fact, pageText: chunk } });
    if (!out.result) {
      verdicts.push({ reason: out.reason ?? 'model_error', inferenceSource: out.inferenceSource, accepted: false });
      continue;
    }
    verdicts.push({ ...acceptPageVerdict(out.result, chunk, fact), inferenceSource: out.inferenceSource });
  }
  const merged = mergeChunkVerdicts(verdicts);
  return { factId: fact.id, ...merged, accepted: undefined };
}

export function isFlag(result) {
  return result.verdict === 'changed' || result.verdict === 'removed';
}
