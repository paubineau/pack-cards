// Advance the real browser frame by frame so expensive effects cannot drop frames.
// Requires the repository's Playwright dev dependency, Chromium, and FFmpeg.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'media');
const raw = await mkdtemp(resolve(tmpdir(), 'pack-cards-showcase-'));
const size = {width: 960, height: 720};
const fps = 50, interval = 1000 / fps;
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
let browser, context, page, cdp;
const errors = [];
let frameTime, frames = 0;
let pointer = {x: 0, y: 0, down: false};

// Dispatch native input directly: Playwright's HTML drag detection adds timers
// that would otherwise require extra frames between every drag position.
async function mouse(type, x = pointer.x, y = pointer.y) {
  if (type === 'mousePressed') pointer.down = true;
  if (type === 'mouseReleased') pointer.down = false;
  pointer = {...pointer, x, y};
  await cdp.send('Input.dispatchMouseEvent', {
    type, x, y, button: pointer.down || type === 'mouseReleased' ? 'left' : 'none',
    buttons: pointer.down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1,
  });
}

// Virtual time drives timers and physics; BeginFrame also advances CSS animations
// and waits for the compositor before capturing. No wall-clock gaps enter the clip.
async function frame(capture = true) {
  const expired = new Promise(done => cdp.once('Emulation.virtualTimeBudgetExpired', done));
  await cdp.send('Emulation.setVirtualTimePolicy', {
    policy: 'advance', budget: interval, maxVirtualTimeTaskStarvationCount: 100,
  });
  await expired;
  frameTime += interval;
  const result = await cdp.send('HeadlessExperimental.beginFrame', {
    frameTimeTicks: frameTime, interval, ...(capture ? {screenshot: {format: 'png'}} : {}),
  });
  if (!capture) return;
  assert.ok(result.screenshotData, 'Every output frame must be rendered');
  await writeFile(resolve(raw, `frame-${String(frames++).padStart(5, '0')}.png`),
    Buffer.from(result.screenshotData, 'base64'));
  if (frames % fps === 0) console.log(`Captured ${frames / fps}s (${frames} frames).`);
}

async function hold(milliseconds) {
  for (let i = 0; i < Math.round(milliseconds / interval); i++) await frame();
}

async function until(ready, description, capture = true) {
  for (let i = 0; i < 5 * fps; i++) {
    if (await ready()) return;
    await frame(capture);
  }
  assert.fail(`Timed out waiting for ${description}`);
}

// Mouse acknowledgements can wait for a compositor frame in headless shell.
async function input(action) {
  let done = false, failure;
  const pending = action().then(() => {done = true;}, error => {failure = error; done = true;});
  await until(() => done, 'mouse input');
  await pending;
  if (failure) throw failure;
}

// Ease one continuous curve, without stopping at the middle control point.
// Mouse input still goes through the library's actual interaction handlers.
async function sweep(points, milliseconds) {
  const steps = Math.round(milliseconds / interval);
  for (let i = 1; i <= steps; i++) {
    const t = (1 - Math.cos(Math.PI * i / steps)) / 2;
    const position = [0, 1].map(axis => points.length === 2
      ? points[0][axis] * (1 - t) + points[1][axis] * t
      : points[0][axis] * (1 - t) ** 2 + 2 * points[1][axis] * (1 - t) * t + points[2][axis] * t ** 2);
    const moving = mouse('mouseMoved', ...position);
    await frame();
    await moving;
  }
}

try {
  // Chromium's headless shell supports explicit compositor frame control.
  // Even software rendering is smooth here: capture waits for every frame.
  browser = await chromium.launch({headless: true, args: [
    '--enable-begin-frame-control', '--run-all-compositor-stages-before-draw',
    '--disable-threaded-animation', '--disable-threaded-scrolling',
  ]});
  context = await browser.newContext({viewport: size, deviceScaleFactor: 1,
    reducedMotion: 'no-preference'});
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/showcase.html`, {waitUntil: 'networkidle'});
  cdp = await context.newCDPSession(page);
  const clock = await cdp.send('Emulation.setVirtualTimePolicy', {policy: 'pause'});
  frameTime = clock.virtualTimeTicksBase;
  await until(() => page.locator('.recap-pack-enhanced').isVisible(), 'the native pack renderer', false);
  for (let i = 0; i < 20; i++) await frame(false);
  await hold(700);

  const pack = await page.locator('.recap-webgl-pack [role="button"]').boundingBox();
  assert.ok(pack, 'The native pack renderer must be ready');
  const grab = [pack.x + 20, pack.y + 35];
  await input(() => mouse('mouseMoved', ...grab));
  await input(() => mouse('mousePressed'));
  await sweep([grab, [grab[0] + pack.width * .9, grab[1] - 6]], 660);
  await input(() => mouse('mouseReleased'));
  await until(async () => await page.locator('body[data-card="orbit"]').count(), 'the first card');
  await until(async () => !await page.locator('.recap-pack-flight').count(), 'the opening flight');
  await hold(240);

  for (const [id, dwell] of [['orbit', 1200], ['prism', 1200], ['sun', 2600]]) {
    assert.equal(await page.locator(`body[data-card="${id}"]`).count(), 1);
    const face = page.locator('#showcase-stage .demo-card');
    const box = await face.boundingBox();
    assert.ok(box && box.width > 300 && box.height > 400, 'The card must fill the capture');
    const points = [[box.x + box.width * .25, box.y + box.height * .3],
      [box.x + box.width * .75, box.y + box.height * .55],
      [box.x + box.width * .4, box.y + box.height * .75]];
    await input(() => mouse('mouseMoved', ...points[0]));
    await sweep(points, dwell);
    if (id !== 'sun') {
      await input(() => mouse('mouseMoved', box.x + box.width * .55, box.y + box.height * .55));
      await input(() => mouse('mousePressed'));
      await input(() => mouse('mouseReleased'));
      await hold(800);
    }
  }
  assert.equal(await page.locator('#showcase-stage [data-rarity="legendary"]').count(), 1);
  assert.equal(await page.locator('.recap-pile-layer').count(), 2);
  await input(() => mouse('mouseMoved', 860, 620));
  await hold(700);
  await mkdir(output, {recursive: true});
  assert.deepEqual(errors, [], 'Capture must have no browser errors');
} finally {
  await context?.close();
  await browser?.close();
  await new Promise(done => server.close(done));
}

const still = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', resolve(raw, `frame-${String(frames - 1).padStart(5, '0')}.png`),
  '-frames:v', '1', '-q:v', '2', resolve(output, 'showcase.jpg')], {stdio: 'inherit'});
if (still.error) throw still.error;
assert.equal(still.status, 0, 'FFmpeg must encode the final still');
const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(fps), '-i', resolve(raw, 'frame-%05d.png'), '-an',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', resolve(output, 'showcase.mp4')], {stdio: 'inherit'});
if (encoded.error) throw encoded.error;
assert.equal(encoded.status, 0, 'FFmpeg must encode the showcase');
const gif = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(fps), '-i', resolve(raw, 'frame-%05d.png'), '-filter_complex',
  'fps=50,scale=432:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  '-loop', '0', resolve(output, 'showcase.gif')], {stdio: 'inherit'});
if (gif.error) throw gif.error;
assert.equal(gif.status, 0, 'FFmpeg must encode the README preview');
console.log(`Recorded ${frames} frames at ${size.width}×${size.height}, ${fps} fps (${frames / fps}s).`);
console.log(`Video: ${resolve(output, 'showcase.mp4')}`);
console.log(`README preview: ${resolve(output, 'showcase.gif')}`);
console.log(`Original frames retained in: ${raw}`);
