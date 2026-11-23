import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Set CHROME_PATH to a Chrome for Testing or Chromium binary.');
const shots = resolve(process.env.SHOTS_DIR ?? 'test-results');
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    const body = await readFile(join('dist', path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(5071);

const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const [name, viewport] of [['desktop', { width: 1200, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:5071/');
    await page.waitForSelector('[data-flag]');
    assert.equal(await page.locator('.flag-list [data-flag]').count(), 3, 'three open flags');
    assert.doesNotMatch(await page.textContent('main'), /undefined|NaN/);
    await page.screenshot({ path: join(shots, `dashboard-list-${name}.png`), fullPage: true });

    await page.click('[data-flag="f-refund-window:7d41c0aa92be"]');
    await page.waitForSelector('text=People trained on the old version (9)');
    assert.match(await page.textContent('main'), /Customers can return most items for a full refund within 14 days/);
    await page.screenshot({ path: join(shots, `dashboard-flag-${name}.png`), fullPage: true });

    await page.click('text=Draft fix');
    await page.waitForSelector('[data-block="ParagraphBlock-l2-window"]');
    assert.equal(await page.textContent('[data-block="ParagraphBlock-l2-window"] ins'), '14');
    assert.match(await page.textContent('[data-question="q-l2-window"]'), /The correct answer changes to “The return window has closed”/);
    await page.screenshot({ path: join(shots, `dashboard-fix-${name}.png`), fullPage: true });

    await page.click('#approve');
    await page.waitForSelector('text=Lesson corrected');
    assert.match(await page.textContent('main'), /For 9 people/);
    await page.goto('http://localhost:5071/#/');
    await page.waitForSelector('.flag-list');
    assert.equal(await page.locator('.flag-list [data-flag]').count(), 2, 'fixed flag leaves the open list');
    assert.deepEqual(errors, []);
    await page.evaluate(() => localStorage.clear());
    await page.close();
  }
  console.log('dashboard e2e passed on desktop and mobile');
} finally {
  await browser.close();
  server.close();
}
