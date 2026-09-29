// Record the actual browser rendering; FFmpeg only trims and encodes the video.
// Requires the repository's Playwright dev dependency, Chromium, and FFmpeg.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'media');
const raw = await mkdtemp(resolve(tmpdir(), 'pack-cards-showcase-'));
const size = {width: 960, height: 720};
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml'};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) || pathname.includes('/node_modules/')) {
      response.writeHead(403).end(); return;
    }
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser, context, page;
const errors = [];
let start, duration, video;

// A slow, real mouse movement lets the library's own reflection and tilt respond.
async function sweep(points, milliseconds) {
  for (let segment = 1; segment < points.length; segment++) {
    const [x0, y0] = points[segment - 1], [x1, y1] = points[segment];
    const began = performance.now(), length = milliseconds / (points.length - 1);
    while (performance.now() - began < length) {
      const progress = Math.min(1, (performance.now() - began) / length);
      const t = (1 - Math.cos(Math.PI * progress)) / 2;
      await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      await page.waitForTimeout(20);
    }
    await page.mouse.move(x1, y1);
  }
}

try {
  browser = await chromium.launch({headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  context = await browser.newContext({viewport: size, deviceScaleFactor: 1,
    reducedMotion: 'no-preference', recordVideo: {dir: raw, size}});
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  const videoStart = Date.now();
  video = page.video();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/showcase.html`);
  await page.locator('.recap-pack-enhanced').waitFor();
  await page.waitForTimeout(350);
  start = (Date.now() - videoStart) / 1000;
  await page.waitForTimeout(900);

  const pack = await page.locator('.recap-webgl-pack [role="button"]').boundingBox();
  assert.ok(pack, 'The native pack renderer must be ready');
  const grab = [pack.x + 20, pack.y + 35];
  await page.mouse.move(...grab);
  await page.mouse.down();
  await sweep([grab, [grab[0] + pack.width * .9, grab[1] - 6]], 650);
  await page.mouse.up();
  await page.locator('body[data-card="orbit"]').waitFor();
  await page.locator('.recap-pack-flight').waitFor({state: 'detached'});
  await page.waitForTimeout(250);

  for (const [id, dwell] of [['orbit', 950], ['prism', 900], ['sun', 3100]]) {
    await page.locator(`body[data-card="${id}"]`).waitFor();
    const face = page.locator('#showcase-stage .demo-card');
    const box = await face.boundingBox();
    assert.ok(box && box.width > 300 && box.height > 400, 'The card must fill the capture');
    const points = [[box.x + box.width * .25, box.y + box.height * .3],
      [box.x + box.width * .75, box.y + box.height * .55],
      [box.x + box.width * .4, box.y + box.height * .75]];
    await page.mouse.move(...points[0]);
    await sweep(points, dwell);
    if (id !== 'sun') {
      await page.mouse.click(box.x + box.width * .55, box.y + box.height * .55);
      await page.waitForTimeout(850);
    }
  }
  assert.equal(await page.locator('#showcase-stage [data-rarity="legendary"]').count(), 1);
  assert.equal(await page.locator('.recap-pile-layer').count(), 2);
  await page.mouse.move(860, 620);
  await page.waitForTimeout(500);
  await mkdir(output, {recursive: true});
  await page.screenshot({path: resolve(output, 'showcase.jpg'), type: 'jpeg', quality: 90});
  await page.waitForTimeout(Math.max(850, 14500 - (Date.now() - videoStart - start * 1000)));
  duration = (Date.now() - videoStart) / 1000 - start;
  assert.deepEqual(errors, [], 'Capture must have no browser errors');
} finally {
  await context?.close();
  await browser?.close();
  await new Promise(done => server.close(done));
}

const source = await video.path();
const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
  '-ss', start.toFixed(3), '-i', source, '-t', duration.toFixed(3), '-an',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', resolve(output, 'showcase.mp4')], {stdio: 'inherit'});
if (encoded.error) throw encoded.error;
assert.equal(encoded.status, 0, 'FFmpeg must encode the showcase');
console.log(`Recorded the showcase at ${size.width}×${size.height}.`);
console.log(`Video: ${resolve(output, 'showcase.mp4')}`);
console.log(`Original capture retained in: ${raw}`);
