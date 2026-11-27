import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Set CHROME_PATH to a Chrome for Testing or Chromium binary.');
const extensionPath = resolve('dist-test');
const shots = resolve(process.env.SHOTS_DIR ?? 'test-results');
await mkdir(shots, { recursive: true });

const wiki = spawn(process.execPath, ['../shared/scripts/serve-wiki.mjs'], { stdio: 'pipe' });
await new Promise((ok) => wiki.stdout.once('data', ok));
const setState = (s) => fetch(`http://localhost:5050/__state/${s}`);

const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'stale-check-profile-')), {
  executablePath,
  headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 400, height: 900 },
  deviceScaleFactor: 2,
});

try {
  await setState('v1');
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;

  const wikiPage = await context.newPage();
  await wikiPage.goto('http://localhost:5050/refunds.html');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5050/refunds.html' }))[0].id);

  const panel = await context.newPage();
  const panelUrl = `chrome-extension://${extensionId}/sidepanel.html?tab=${tabId}&model=stand-in`;
  await panel.goto(panelUrl);
  await panel.waitForSelector('[data-fact]');
  await panel.waitForSelector('text=Checked, no change since then');
  const firstRun = await panel.$$eval('[data-fact]', (els) => els.map((e) => e.dataset.verdict));
  assert.ok(firstRun.length === 6 && firstRun.every((v) => v === 'still_true'), `v1 verdicts: ${firstRun}`);
  assert.doesNotMatch(await panel.textContent('body'), /undefined/);
  await panel.screenshot({ path: join(shots, 'extension-v1.png'), fullPage: true });

  await setState('v2');
  await wikiPage.reload();
  await panel.reload();
  await panel.waitForSelector('[data-verdict="changed"]');
  await panel.waitForSelector('text=Checked, no change since then');
  const changed = await panel.$$eval('#results [data-verdict="changed"]', (els) => els.map((e) => e.dataset.fact));
  assert.deepEqual(changed, ['f-refund-window']);
  const flagText = await panel.textContent('#flags');
  assert.match(flagText, /Open flags \(1\)/);
  assert.match(flagText, /30 days → 14 days/);
  const quote = await panel.textContent('[data-fact="f-refund-window"] blockquote');
  assert.match(quote, /14 days/);
  const badge = await worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
  assert.equal(badge, '');
  await panel.screenshot({ path: join(shots, 'extension-v2.png'), fullPage: true });

  await panel.reload();
  await panel.waitForSelector('[data-fact]');
  assert.equal(await panel.$$eval('#flags [data-flag]', (els) => els.length), 1, 'rechecking the same page must not add a second flag');

  await setState('reworded');
  await wikiPage.reload();
  await panel.goto(panelUrl.replace('model=stand-in', 'model=stand-in-fail'));
  await panel.waitForSelector('text=Check did not finish');
  assert.doesNotMatch(await panel.textContent('#page'), /no change since then/);
  assert.match(await panel.textContent('#page'), /could not be checked/);
  assert.equal(await panel.textContent('#check'), 'Try again');
  const failedBadge = await worker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
  assert.equal(failedBadge, '!', 'a failed check must leave the page marked as needing a check');
  await panel.screenshot({ path: join(shots, 'extension-failed.png'), fullPage: true });

  console.log('e2e passed: v1 all still true, v2 flags only the refund window, badge cleared, no duplicate flag, failed check is not reported as checked');
} finally {
  await setState('v1').catch(() => {});
  await context.close();
  wiki.kill();
}
