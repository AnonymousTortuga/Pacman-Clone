#!/usr/bin/env node
// Development server: serves the working copy unbundled (native ES modules)
// and reloads open browser tabs when a file under src/, data/ or the page changes.
//
//   npm run dev            -> http://localhost:8080
//   PORT=9000 npm run dev

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mimeFor } from './mime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const RELOAD_SNIPPET =
  '<script>new EventSource("/__reload").onmessage = () => location.reload();</script>';
const clients = new Set();

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.resolve(ROOT, `.${decoded}`);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) return null;
  for (const blocked of ['node_modules', '.svn', 'dist', 'test-results']) {
    if (resolved.includes(`${path.sep}${blocked}`)) return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let file = safePath(req.url === '/' ? '/index.html' : req.url);
  if (!file) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (readErr, body) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      const headers = { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-store' };
      if (file.endsWith('index.html')) body = Buffer.from(String(body).replace('</body>', `${RELOAD_SNIPPET}</body>`));
      res.writeHead(200, headers).end(body);
    });
  });
});

let pending = null;
function notify(changed) {
  clearTimeout(pending);
  pending = setTimeout(() => {
    console.log(`changed: ${changed} -> reloading ${clients.size} tab(s)`);
    for (const c of clients) c.write('data: reload\n\n');
  }, 80);
}
for (const target of ['src', 'data', 'index.html', 'style.css']) {
  const full = path.join(ROOT, target);
  if (!fs.existsSync(full)) continue;
  fs.watch(full, { recursive: fs.statSync(full).isDirectory() }, (_evt, name) => notify(name || target));
}

server.listen(PORT, HOST, () => {
  console.log(`Mazemunch dev server: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
