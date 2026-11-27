import { normalizeForMatch, tokenize } from '@stale-check/shared';

function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

export function createStandInModel({ fail = false } = {}) {
  return {
    id: 'stand-in',
    label: 'Test stand-in',
    async status() {
      return { state: 'available' };
    },
    async prepare() {},
    async generate({ meta: { fact, pageText } }) {
      if (fail) return { reason: 'needs_cloud', inferenceSource: 'IN_CLOUD' };
      const all = sentences(pageText);
      const holding = all.find((s) => normalizeForMatch(s).includes(normalizeForMatch(fact.value)));
      if (holding) return { result: { quote: holding, newValue: '', verdict: 'still_true' }, inferenceSource: 'ON_DEVICE' };
      const want = new Set(tokenize(fact.statement));
      const scored = all
        .map((s) => ({ s, hits: tokenize(s).filter((w) => want.has(w)).length }))
        .sort((a, b) => b.hits - a.hits);
      const best = scored[0];
      if (!best || best.hits < 4) return { result: { quote: '', newValue: '', verdict: 'removed' }, inferenceSource: 'ON_DEVICE' };
      const number = best.s.match(/\$?\d[\d,]*(?:\s+(?:to\s+\d+\s+)?(?:business\s+)?(?:days?|hours?))?/i)?.[0];
      if (!number) return { result: { quote: best.s, newValue: '', verdict: 'still_true' }, inferenceSource: 'ON_DEVICE' };
      return { result: { quote: best.s, newValue: number, verdict: 'changed' }, inferenceSource: 'ON_DEVICE' };
    },
  };
}
