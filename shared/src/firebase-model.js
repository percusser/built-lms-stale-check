import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';

const CLOUD_MODEL = 'gemini-3.5-flash-lite';
const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
const RESPONSE_RESERVE_TOKENS = 512;

export function createFirebaseModel(app, { label = 'Gemini via Firebase AI Logic' } = {}) {
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true });
  const models = new Map();

  function modelFor(schema, mode) {
    const key = `${mode}:${JSON.stringify(schema)}`;
    if (!models.has(key)) {
      models.set(
        key,
        getGenerativeModel(ai, {
          mode,
          inCloudParams: {
            model: CLOUD_MODEL,
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
          },
          onDeviceParams: {
            createOptions: LANGUAGE_OPTIONS,
            promptOptions: { responseConstraint: schema },
          },
        }),
      );
    }
    return models.get(key);
  }

  async function tooLongForDevice(prompt, schema) {
    const LM = globalThis.LanguageModel;
    if (!LM) return false;
    try {
      if ((await LM.availability(LANGUAGE_OPTIONS)) !== 'available') return false;
      const s = await LM.create(LANGUAGE_OPTIONS);
      try {
        const window = s.contextWindow ?? s.inputQuota;
        const measure = (s.measureContextUsage ?? s.measureInputUsage)?.bind(s);
        if (!window || !measure) return false;
        return (await measure(prompt, { responseConstraint: schema })) > window - RESPONSE_RESERVE_TOKENS;
      } finally {
        s.destroy();
      }
    } catch {
      return false;
    }
  }

  async function run(mode, prompt, schema) {
    const { response } = await modelFor(schema, mode).generateContent(prompt);
    return {
      result: JSON.parse(response.text()),
      inferenceSource: String(response.inferenceSource ?? (mode === InferenceMode.ONLY_IN_CLOUD ? 'IN_CLOUD' : 'ON_DEVICE')).toUpperCase(),
    };
  }

  return {
    id: 'firebase',
    label,
    async status() {
      const LM = globalThis.LanguageModel;
      const device = LM ? await LM.availability(LANGUAGE_OPTIONS).catch(() => 'unavailable') : 'unavailable';
      return { state: 'available', device };
    },
    async prepare() {},
    async generate({ prompt, schema, meta }) {
      let reason = meta?.needsCloud ? 'needs_cloud' : (await tooLongForDevice(prompt, schema)) ? 'too_long' : undefined;
      if (!reason) {
        try {
          return await run(InferenceMode.PREFER_ON_DEVICE, prompt, schema);
        } catch {
          reason = 'model_error';
        }
      }
      try {
        return { ...(await run(InferenceMode.ONLY_IN_CLOUD, prompt, schema)), reason };
      } catch (err) {
        return { reason: 'model_error', detail: err?.message, inferenceSource: 'IN_CLOUD' };
      }
    },
  };
}
