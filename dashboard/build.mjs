import { build, context } from 'esbuild';
import { cp, rm } from 'node:fs/promises';
import { loadFirebaseConfig } from '../shared/scripts/load-config.mjs';

const serve = process.argv.includes('--serve');
const outdir = 'dist';
const loaded = process.argv.includes('--sample') ? null : await loadFirebaseConfig();
const config = loaded && { ...loaded, appCheckDebugToken: serve ? loaded.appCheckDebugToken : undefined };
const options = {
  entryPoints: ['src/app.js', 'src/bridge.js'],
  outdir,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  loader: { '.md': 'text' },
  define: { FIREBASE_CONFIG: JSON.stringify(config), DEBUG_APP_CHECK: String(serve) },
  minify: !serve,
  logLevel: 'warning',
};

await rm(outdir, { recursive: true, force: true });
await cp('static', outdir, { recursive: true });
if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: Number(process.env.PORT ?? 5070) });
  console.log(`Dashboard on http://localhost:${port}`);
} else {
  await build(options);
  console.log(`Built ${outdir}/`);
}
