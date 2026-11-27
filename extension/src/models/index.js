import { createBridgeModel } from './bridge.js';
import { createHybridModel } from './hybrid.js';
import { createPromptApiModel } from './prompt-api.js';
import { createStandInModel } from './stand-in.js';

export function selectModel(options = {}) {
  const testModel = TEST_BUILD && new URLSearchParams(location.search).get('model');
  if (testModel === 'stand-in') return createStandInModel();
  if (testModel === 'stand-in-fail') return createStandInModel({ fail: true });
  if (BRIDGE_URL) return createHybridModel(createPromptApiModel(options), createBridgeModel(BRIDGE_URL));
  return createPromptApiModel(options);
}
