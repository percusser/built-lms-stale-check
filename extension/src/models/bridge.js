const TIMEOUT_MS = 120000;

export function createBridgeModel(bridgeUrl) {
  const origin = new URL(bridgeUrl).origin;
  const pending = new Map();
  let nextId = 0;
  let frame;

  const ready = new Promise((resolve, reject) => {
    frame = document.createElement('iframe');
    frame.src = bridgeUrl;
    frame.hidden = true;
    frame.title = 'Firebase bridge';
    const timer = setTimeout(() => reject(new Error('The cloud bridge did not load.')), 20000);
    addEventListener('message', (event) => {
      if (event.origin !== origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'ready') {
        clearTimeout(timer);
        resolve();
        return;
      }
      const entry = pending.get(event.data?.id);
      if (!entry) return;
      pending.delete(event.data.id);
      clearTimeout(entry.timer);
      entry.resolve(event.data.out);
    });
    document.body.append(frame);
  });

  async function call(type, request) {
    await ready;
    const id = ++nextId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ reason: 'model_error', detail: 'The model took too long to answer.' });
      }, TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      frame.contentWindow.postMessage({ id, type, request }, origin);
    });
  }

  return {
    id: 'firebase-bridge',
    label: 'Gemini via Firebase AI Logic',
    async status() {
      try {
        return await call('status');
      } catch (err) {
        return { state: 'unavailable', detail: err.message };
      }
    },
    async prepare() {
      await ready;
    },
    async saveFlags(flags) {
      try {
        return await call('saveFlags', { flags });
      } catch (err) {
        return { reason: 'model_error', detail: err.message };
      }
    },
    generate(request) {
      return call('generate', { prompt: request.prompt, schema: request.schema, meta: { needsCloud: request.meta?.needsCloud } });
    },
  };
}
