// Content types shared by the dev server and the local dist server.
// ES modules only load when .js is served as JavaScript.

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeFor(path) {
  const dot = path.lastIndexOf('.');
  return MIME[path.slice(dot).toLowerCase()] || 'application/octet-stream';
}
