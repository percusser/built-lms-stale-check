const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
const RESPONSE_RESERVE_TOKENS = 512;

export function createPromptApiModel({ onDownloadProgress } = {}) {
  const LM = globalThis.LanguageModel;
  let base;

  async function session() {
    base ??= LM.create({
      ...LANGUAGE_OPTIONS,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onDownloadProgress?.(e.loaded));
      },
    }).catch((err) => {
      base = undefined;
      throw err;
    });
    return base;
  }

  return {
    id: 'prompt-api',
    label: 'Gemini Nano in Chrome',
    async status() {
      if (!LM) return { state: 'unavailable', detail: 'This Chrome has no built-in AI.' };
      try {
        return { state: await LM.availability(LANGUAGE_OPTIONS) };
      } catch (err) {
        return { state: 'unavailable', detail: err.message };
      }
    },
    async prepare() {
      await session();
    },
    async generate({ prompt, schema }) {
      const s = await (await session()).clone();
      try {
        const window = s.contextWindow ?? s.inputQuota;
        const measure = (s.measureContextUsage ?? s.measureInputUsage)?.bind(s);
        if (window && measure) {
          const used = await measure(prompt, { responseConstraint: schema });
          if (used > window - RESPONSE_RESERVE_TOKENS) return { reason: 'too_long', inferenceSource: 'ON_DEVICE' };
        }
        const text = await s.prompt(prompt, { responseConstraint: schema });
        return { result: JSON.parse(text), inferenceSource: 'ON_DEVICE' };
      } catch (err) {
        if (err?.name === 'QuotaExceededError') return { reason: 'too_long', inferenceSource: 'ON_DEVICE' };
        return { reason: 'model_error', detail: err?.message, inferenceSource: 'ON_DEVICE' };
      } finally {
        s.destroy();
      }
    },
  };
}
