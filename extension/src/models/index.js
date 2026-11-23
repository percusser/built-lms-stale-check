import { createBridgeModel } from './bridge.js';
import { createHybridModel } from './hybrid.js';
import { createPromptApiModel } from './prompt-api.js';
import { createStandInModel } from './stand-in.js';

export function selectModel(options = {}) {
  if (TEST_BUILD && new URLSearchParams(location.search).get('model') === 'stand-in') return createStandInModel();
  if (BRIDGE_URL) return createHybridModel(createPromptApiModel(options), createBridgeModel(BRIDGE_URL));
  return createPromptApiModel(options);
}
