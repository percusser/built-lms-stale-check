import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
await copyWiki(`${outdir}/wiki`);
if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: Number(process.env.PORT ?? 5070) });
  console.log(`Dashboard on http://localhost:${port}`);
} else {
  await build(options);
  console.log(`Built ${outdir}/`);
}

async function copyWiki(dest) {
  const src = '../demo-wiki';
  await mkdir(dest, { recursive: true });
  await cp(`${src}/assets`, `${dest}/assets`, { recursive: true });
  for (const page of ['index.html', 'exchanges.html', 'escalation.html']) await cp(`${src}/${page}`, `${dest}/${page}`);
  const variant = async (name) => (await readFile(`${src}/variants/${name}`, 'utf8')).replaceAll('href="../', 'href="');
  await writeFile(`${dest}/refunds.html`, await variant('refunds-v2-14-days.html'));
  await writeFile(`${dest}/refunds-reworded.html`, await variant('refunds-reworded.html'));
}
