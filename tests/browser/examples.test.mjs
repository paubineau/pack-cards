import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
let browser, server, origin;

before(async () => {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['examples/serve.mjs', '--port', String(port)], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Demo server did not start: ${output}`)), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Demo server exited ${code}: ${output}`)); });
    server.stderr.on('data', data => { output += data; });
    server.stdout.on('data', data => {
      output += data;
      if (output.includes(`Pack Cards examples: ${origin}/examples/`)) { clearTimeout(timer); resolve(); }
    });
  });
  browser = await chromium.launch({headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
});

after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
});

async function pageFor(t, {reduced = true, mobile = false, starter = false} = {}) {
  const context = await browser.newContext({reducedMotion: reduced ? 'reduce' : 'no-preference',
    viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 900},
    isMobile: mobile, hasTouch: mobile});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requestFailed = request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
    }
  };
  page.on('requestfailed', requestFailed);
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  t.after(async () => {
    page.off('requestfailed', requestFailed);
    await context.close();
    assert.deepEqual(errors, [], 'examples should have no script errors or failed assets');
  });
  await page.goto(origin + (starter ? '/examples/minimal.html' : '/examples/'));
  if (starter) await page.locator('#stage .recap-pack').waitFor();
  else await page.waitForFunction(() => document.querySelector('#material-stage article')
    && document.querySelector('#snapshot-source article')
    && document.querySelector('#export-card').options.length === 6);
  return page;
}

const position = (page, value) => page.waitForFunction(expected =>
  document.querySelector('#position').textContent === expected, value);
const settings = page => page.locator('#editor-settings').evaluate(element => JSON.parse(element.textContent));

test('showcase opens an animated pack manually, deals cards, and ignores a restarted opening', {timeout: 60000}, async t => {
  const page = await pageFor(t, {reduced: false});
  await page.waitForFunction(() => document.querySelector('#stage .recap-webgl-pack canvas')
    && !document.querySelector('#stage .recap-webgl-pack').inert);
  await page.locator('#open').click();
  await page.waitForFunction(() => document.querySelector('#events').textContent.includes('onOpening'));
  await page.locator('#reset').click();
  assert.equal(await page.locator('#navigation').isVisible(), false);
  await page.locator('#open').click();
  await page.locator('#stage .recap-ready-card').waitFor();
  assert.equal(await page.locator('#navigation').isVisible(), false, 'manual reveal waits for the card back');
  await page.locator('#stage .recap-ready-card').click();
  await position(page, '1 / 6');
  assert.equal(await page.locator('#previous').isDisabled(), true);
  await page.locator('#next').click();
  await position(page, '2 / 6');
  assert.equal(await page.locator('#pile-slot .recap-pile-layer').count(), 1);
  await page.locator('.recap-card-flight').waitFor({state: 'detached'});
  await page.locator('#pile-slot').getByRole('button', {name: 'Review card 1'}).click();
  await position(page, '1 / 6');
  assert.equal(await page.locator('#pile-slot .recap-pile-layer').count(), 0);
  assert.equal(await page.locator('#events li').filter({hasText: 'onOpen ·'}).count(), 1);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#navigation').isVisible(), false);
  assert.equal(await page.locator('.recap-card-flight').count(), 0);
  assert.equal(await page.locator('#stage article').count(), 0);
});

test('mobile reduced-motion, instant opening, and unavailable renderer remain usable without overflow', {timeout: 60000}, async t => {
  const page = await pageFor(t, {mobile: true});
  assert.match(await page.locator('#motion-note').textContent(), /Reduced motion is active/);
  await page.locator('#opening').selectOption('instant');
  await position(page, '1 / 6');
  for (let index = 2; index <= 6; index++) {
    await page.locator('#next').click();
    await position(page, `${index} / 6`);
  }
  assert.equal(await page.locator('#next').isDisabled(), true);
  assert.equal(await page.locator('#pile-slot .recap-pile-layer').count(), 5);
  assert.equal(await page.locator('.recap-card-flight').count(), 0);
  await page.locator('#opening').selectOption('animated');
  await page.locator('#reveal').selectOption('auto');
  await page.locator('#renderer-mode').selectOption('fallback');
  await page.locator('#open').click();
  await position(page, '1 / 6');
  for (const id of ['packs', 'materials', 'snapshots', 'exports']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      `${id} should fit the mobile viewport`);
  }
});

test('unavailable optional renderer follows the ordinary animated opening path', {timeout: 60000}, async t => {
  const page = await pageFor(t, {reduced: false});
  await page.locator('#renderer-mode').selectOption('fallback');
  await page.waitForFunction(() => document.querySelector('#events').textContent.includes('renderer unavailable'));
  assert.equal(await page.locator('#stage .recap-webgl-pack canvas').count(), 0);
  await page.locator('#open').click();
  await page.locator('#stage .recap-ready-card').click();
  await position(page, '1 / 6');
});

test('appearance editor previews the selected profile and restores exported settings', {timeout: 60000}, async t => {
  const page = await pageFor(t);
  const initial = (await settings(page)).settings;
  await page.locator('#material-rarity').selectOption('common');
  await page.waitForFunction(() => JSON.parse(document.querySelector('#editor-settings').textContent).target === 'common');
  await page.locator('#materials-editor-stock-metal').check();
  await page.locator('#materials-editor-stock-paper').uncheck();
  assert.equal((await settings(page)).resolvedAppearance.stock, 'metal');
  assert.match(await page.locator('#material-status').textContent(), /Common: metal stock/);
  assert.equal(await page.locator('#material-stage article').getAttribute('aria-label'), 'The Seed');
  assert.equal(await page.locator('#materials-editor-stock-metal').isDisabled(), true, 'the final selected material cannot be removed');
  await page.locator('#material-rarity').selectOption('legendary');
  assert.equal((await settings(page)).target, 'legendary');
  assert.equal(await page.locator('#material-stage article').getAttribute('aria-label'), 'The Sun');
  await page.locator('#material-reset').click();
  assert.deepEqual((await settings(page)).settings, initial);
});

async function dragIntoTray(page, {cancel = false} = {}) {
  await page.locator('#drop-zone').scrollIntoViewIfNeeded();
  const handle = await page.locator('#drag-handle').boundingBox();
  const tray = await page.locator('#drop-zone').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.locator('.pack-cards-drag-preview').waitFor();
  await page.mouse.move(tray.x + tray.width / 2, tray.y + tray.height / 2, {steps: 8});
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.locator('.pack-cards-drag-preview').waitFor({state: 'detached'});
}

test('snapshot copy preserves material and real pointer dragging cleans up after drop or cancellation', {timeout: 60000}, async t => {
  const page = await pageFor(t);
  await page.locator('#snapshot-capture').click();
  assert.equal(await page.locator('#snapshot-copy article').evaluate(face => face.inert), true);
  assert.equal(await page.locator('#snapshot-copy article').getAttribute('aria-hidden'), 'true');
  const [source, copy] = await page.evaluate(() => ['#snapshot-source article', '#snapshot-copy article'].map(selector => {
    const face = document.querySelector(selector);
    return [face.textContent, getComputedStyle(face).getPropertyValue('--material-colors')];
  }));
  assert.deepEqual(copy, source);
  await dragIntoTray(page);
  assert.match(await page.locator('#snapshot-status').textContent(), /copied to the tray/);
  assert.equal(await page.locator('#snapshot-copy article').count(), 1);
  await dragIntoTray(page, {cancel: true});
  assert.match(await page.locator('#snapshot-status').textContent(), /cancelled/);
  assert.equal(await page.locator('#drop-zone').evaluate(node => node.classList.contains('is-dragging') || node.classList.contains('is-over')), false);
  assert.equal(await page.locator('#snapshot-source article').count(), 1);
});

function gifFrames(bytes) {
  let offset = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let frames = 0;
  const delays = [];
  function skipBlocks() {
    while (offset < bytes.length) {
      const size = bytes[offset++];
      if (size === 0) return;
      offset += size;
    }
    assert.fail('GIF data blocks have no terminator');
  }
  while (offset < bytes.length) {
    const type = bytes[offset++];
    if (type === 0x3b) return {frames, delays};
    if (type === 0x21) {
      const extension = bytes[offset++];
      if (extension === 0xf9) delays.push(bytes.readUInt16LE(offset + 2) * 10);
      skipBlocks();
    } else if (type === 0x2c) {
      frames++;
      const packed = bytes[offset + 8];
      offset += 9 + ((packed & 128) ? 3 * 2 ** ((packed & 7) + 1) : 0);
      offset++; // LZW minimum code size.
      skipBlocks();
    } else assert.fail(`Unexpected GIF block ${type}`);
  }
  assert.fail('GIF has no trailer');
}

test('canvas PNG and worker GIF downloads are valid, and a cancelled GIF can restart', {timeout: 60000}, async t => {
  const page = await pageFor(t);
  await page.locator('#export-card').selectOption('orbit');
  const pngDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const png = await pngDownload;
  assert.equal(png.suggestedFilename(), 'field-notes-orbit.png');
  const pngBytes = await readFile(await png.path());
  assert.deepEqual([...pngBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(pngBytes.readUInt32BE(16), 1080);
  assert.equal(pngBytes.readUInt32BE(20), 1440);
  // Cancel before the worker's first acknowledgement, then start a real export.
  await page.evaluate(() => {
    document.querySelector('#export-gif').click();
    document.querySelector('#export-cancel').click();
  });
  assert.match(await page.locator('#export-status').textContent(), /cancelled/);
  assert.equal(await page.locator('#export-gif').isDisabled(), false);
  assert.equal(await page.locator('#export-cancel').isVisible(), false);
  await page.locator('#export-gif').click();
  await page.locator('#gif-download').waitFor();
  await page.waitForFunction(() => document.querySelector('#gif-preview').naturalWidth === 270);
  assert.equal(await page.locator('#gif-preview').evaluate(image => image.naturalHeight), 360);
  const gifDownload = page.waitForEvent('download');
  await page.locator('#gif-download').click();
  const gif = await gifDownload;
  assert.equal(gif.suggestedFilename(), 'field-notes-collection.gif');
  const gifBytes = await readFile(await gif.path());
  assert.equal(gifBytes.subarray(0, 6).toString(), 'GIF89a');
  assert.equal(gifBytes.readUInt16LE(6), 270);
  assert.equal(gifBytes.readUInt16LE(8), 360);
  assert.deepEqual(gifFrames(gifBytes), {frames: 6, delays: Array(6).fill(800)});
  assert.match(await page.locator('#export-status').textContent(), /GIF ready: 6 cards/);
});

test('starter example opens a card and restarts without stale content', {timeout: 60000}, async t => {
  const page = await pageFor(t, {starter: true});
  await page.locator('#stage .recap-pack').press('Enter');
  await page.locator('#stage article').waitFor();
  assert.equal(await page.locator('#stage article').getAttribute('aria-label'), 'The Orbit');
  assert.match(await page.locator('#status').textContent(), /The Orbit revealed/);
  await page.locator('#restart').click();
  await page.locator('#stage .recap-pack').waitFor();
  assert.equal(await page.locator('#stage article').count(), 0);
  await page.locator('#stage .recap-pack').press('Enter');
  await page.locator('#stage article').waitFor();
  assert.equal(await page.locator('#stage article').count(), 1);
});

test('page-cache lifecycle restores snapshot and export controls while discarding an old PNG callback', {timeout: 60000}, async t => {
  const page = await pageFor(t);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.locator('#export-card').selectOption('compass');
  // Hold the asynchronous PNG result across pagehide, as a browser may do when
  // freezing the page. The old callback must not initiate a restored-page download.
  await page.evaluate(() => {
    const canvas = document.querySelector('#export-canvas');
    const toBlob = canvas.toBlob;
    canvas.toBlob = (callback, ...args) => toBlob.call(canvas, blob => {
      window.delayedPNG = () => callback(blob);
    }, ...args);
  });
  await page.locator('#export-png').click();
  await page.waitForFunction(() => typeof window.delayedPNG === 'function');
  await page.evaluate(() => {
    document.querySelector('#export-gif').click();
    window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
    window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
    window.delayedPNG();
    delete document.querySelector('#export-canvas').toBlob;
  });
  assert.equal(downloads, 0);
  assert.equal(await page.locator('#export-png').isDisabled(), false);
  assert.equal(await page.locator('#export-gif').isDisabled(), false);
  assert.equal(await page.locator('#export-cancel').isVisible(), false);
  assert.equal(await page.locator('#export-card').inputValue(), 'compass');
  await page.locator('#snapshot-capture').click();
  assert.equal(await page.locator('#snapshot-copy article').count(), 1);
  await dragIntoTray(page);
  assert.match(await page.locator('#snapshot-status').textContent(), /copied to the tray/);
  const pngDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  assert.equal((await pngDownload).suggestedFilename(), 'field-notes-compass.png');
  await page.locator('#export-gif').click();
  await page.locator('#gif-download').waitFor();
  assert.match(await page.locator('#export-status').textContent(), /GIF ready: 6 cards/);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}));
    window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
  });
  assert.equal(await page.locator('#gif-preview').isVisible(), false);
  assert.equal(await page.locator('#gif-preview').getAttribute('src'), null);
  assert.equal(await page.locator('#gif-download').getAttribute('href'), null);
  await page.locator('#snapshot-capture').click();
  assert.equal(await page.locator('#snapshot-source article').count(), 1);
});
