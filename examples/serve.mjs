import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {dirname, extname, isAbsolute, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const port = args.length === 0 ? 8080 : args.length === 2 && args[0] === '--port' ? Number(args[1]) : NaN;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: npm run demo -- --port 8081 (port must be an integer from 1 to 65535).');
  process.exit(1);
}

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4',
};
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {Allow: 'GET, HEAD'}).end('Method not allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(request.url.split(/[?#]/, 1)[0]); }
  catch { response.writeHead(400).end('Invalid path'); return; }
  const parts = pathname.split('/').filter(Boolean);
  if (pathname.includes('\\') || pathname.includes('\0') || parts.some(part =>
    part.startsWith('.') || part.includes(':') || part.toLowerCase() === 'node_modules')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (pathname.endsWith('/')) parts.push('index.html');
  try {
    const file = await realpath(resolve(root, ...parts));
    const location = relative(root, file);
    if (location.startsWith('..') || isAbsolute(location)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream'});
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Try npm run demo -- --port ${port === 65535 ? 8080 : port + 1}.`
    : `Cannot start the demo server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Pack Cards examples: http://127.0.0.1:${port}/examples/`);
  console.log('Press Ctrl+C to stop.');
});
