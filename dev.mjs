// Local preview: builds the site, serves dist/ on http://localhost:4321 and rebuilds
// whenever a source file changes. No extra packages. Run: npm run dev
// Watches the whole folder (editors replace files on save), skipping the build output.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 4321;
const ROOT = path.resolve('dist');
const IGNORE = /^(dist|node_modules|\.git)(\/|$)|\.DS_Store$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon',
};

const build = () => spawnSync('node', ['build.mjs'], { stdio: 'inherit' });
build();

createServer(async (req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(file);
    const target = s.isDirectory() ? path.join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}`));

let timer;
watch('.', { recursive: true }, (_, file) => {
  if (!file || IGNORE.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(() => { console.log(`\n${file} changed, rebuilding…`); build(); }, 100);
});
