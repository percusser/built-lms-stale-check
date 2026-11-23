import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Set CHROME_PATH to a Chrome for Testing or Chromium binary.');
const extensionPath = resolve('dist');
const shots = resolve(process.env.SHOTS_DIR ?? 'test-results');
await mkdir(shots, { recursive: true });

const running = await fetch('http://localhost:5050/__state/v2').then((r) => r.ok, () => false);
const wiki = running ? null : spawn(process.execPath, ['../shared/scripts/serve-wiki.mjs'], { stdio: 'pipe', env: { ...process.env, WIKI_STATE: 'v2' } });
if (wiki) await new Promise((ok) => wiki.stdout.once('data', ok));

const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'stale-check-live-')), {
  executablePath,
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--headless=new'],
  viewport: { width: 400, height: 900 },
  deviceScaleFactor: 2,
});

try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const wikiPage = await context.newPage();
  await wikiPage.goto('http://localhost:5050/refunds.html');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5050/refunds.html' }))[0].id);

  context.on('response', (r) => r.status() >= 400 && console.error('http', r.status(), r.request().method(), r.url().slice(0, 160)));
  const panel = await context.newPage();
  panel.on('console', (m) => m.type() === 'error' && console.error('panel:', m.text()));
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}`);
  await panel.waitForSelector('#flags [data-flag]', { timeout: Number(process.env.WAIT_MS ?? 300000) }).catch(async (err) => {
    console.error(await panel.textContent('body'));
    throw err;
  });
  await panel.waitForSelector('#check:has-text("Check again")', { timeout: 120000 });
  const flagText = await panel.textContent('#flags');
  assert.match(flagText, /14 days/);
  await panel.screenshot({ path: join(shots, 'extension-live.png'), fullPage: true });
  if (process.env.DUMP) console.log(JSON.stringify(await worker.evaluate(() => chrome.storage.local.get('flags'))));
  console.log(`live passed: extension ${extensionId} flagged the refund window through the hosted bridge`);
} finally {
  await context.close();
  if (wiki) wiki.kill();
  else await fetch('http://localhost:5050/__state/v1').catch(() => {});
}
