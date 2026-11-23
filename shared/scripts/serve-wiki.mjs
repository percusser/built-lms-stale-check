import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../demo-wiki/', import.meta.url));
const port = Number(process.env.PORT ?? 5050);
const variants = {
  v2: { '/refunds.html': 'variants/refunds-v2-14-days.html' },
  reworded: { '/refunds.html': 'variants/refunds-reworded.html' },
};
let state = process.env.WIKI_STATE ?? '';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8' };

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const switchTo = path.match(/^\/__state\/(\w*)$/)?.[1];
  if (switchTo !== undefined) {
    state = switchTo in variants ? switchTo : '';
    return res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end(`state: ${state || 'v1'}\n`);
  }
  const route = path === '/' ? '/index.html' : path;
  const swapped = variants[state]?.[route];
  const file = normalize(join(root, swapped ?? route));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    let body = await readFile(file, 'utf8');
    if (swapped) body = body.replaceAll('href="../', 'href="');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Demo wiki on http://localhost:${port} (state: ${process.env.WIKI_STATE || 'v1'})`));
