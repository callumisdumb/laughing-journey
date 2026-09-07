// Static server for the export with .html resolution and index fallback, for Playwright and manual preview.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'out');
const port = Number(process.env.PORT ?? 3100);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain', '.map': 'application/json' };

function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(root, clean), join(root, `${clean}.html`), join(root, clean, 'index.html')];
  for (const c of candidates) if (existsSync(c) && statSync(c).isFile()) return c;
  return join(root, 'index.html');
}

createServer((req, res) => {
  const file = resolvePath(req.url ?? '/');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
