// Tiny static server for the game (ES modules need http, not file://). Run: node serve.js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 4026; // using port 4026, 127.0.0.1 only, run by hand
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const full = normalize(join(root, p));
      if (!full.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const data = await readFile(full);
      res.writeHead(200, {
        'content-type': TYPES[extname(full)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
