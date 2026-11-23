import { readFile } from 'node:fs/promises';

export async function loadFirebaseConfig() {
  try {
    return JSON.parse(await readFile(new URL('../../firebase-config.local.json', import.meta.url), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
