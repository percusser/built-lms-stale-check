import { build } from 'esbuild';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { loadFirebaseConfig } from '../shared/scripts/load-config.mjs';

const test = process.argv.includes('--test');
const outdir = test ? 'dist-test' : 'dist';
const config = await loadFirebaseConfig();
const bridgeUrl = test ? null : (config?.bridgeUrl ?? null);

await rm(outdir, { recursive: true, force: true });
await cp('static', outdir, { recursive: true });
await build({
  entryPoints: ['src/background.js', 'src/content.js', 'src/sidepanel.js'],
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome138',
  loader: { '.md': 'text' },
  define: { TEST_BUILD: String(test), BRIDGE_URL: JSON.stringify(bridgeUrl) },
  minify: !test,
  logLevel: 'warning',
});
if (bridgeUrl) {
  const manifestPath = `${outdir}/manifest.json`;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.content_security_policy = { extension_pages: `script-src 'self'; object-src 'self'; frame-src ${new URL(bridgeUrl).origin}` };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
console.log(`Built ${outdir}/`);
