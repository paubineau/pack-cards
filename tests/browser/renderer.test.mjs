import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = resolve(process.env.PACK_CARDS_BROWSER_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const fixture = fileURLToPath(new URL('renderer.html', import.meta.url));
let browser, server, origin;
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml'};

before(async () => {
  server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = pathname === '/fixture' ? fixture : resolve(root, pathname.replace(/^\/library\//, ''));
      if (file !== fixture && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
});

async function pageFor(t, {reduced = false, mobile = false, noGL = false, query = ''} = {}) {
  const context = await browser.newContext({reducedMotion: reduced ? 'reduce' : 'no-preference',
    viewport: mobile ? {width: 390, height: 844} : {width: 1000, height: 850},
    isMobile: mobile, hasTouch: mobile});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  if (noGL) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto(origin + '/fixture' + query);
  await page.waitForFunction(() => window.events?.includes('ready'));
  return page;
}

const button = page => page.getByRole('button', {name: 'Open pack', exact: true});
const events = page => page.evaluate(() => [...window.events]);
const complete = page => page.waitForFunction(() => window.events.includes('complete'));

for (const mobile of [false, true]) {
  test(`WebGL ${mobile ? 'mobile' : 'desktop'} draws and keyboard opening commits once`, {timeout: 20000}, async t => {
    const page = await pageFor(t, {mobile});
    assert.equal(await page.locator('#host canvas').count(), 1);
    assert.equal(await page.locator('#host canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl');
      return !gl.isContextLost() && gl.getError() === gl.NO_ERROR;
    }), true);
    await button(page).press('Enter');
    await button(page).press('Enter');
    await complete(page);
    assert.deepEqual(await events(page), ['ready', 'interact', 'torn', 'complete']);
  });
}

test('short drag springs back; re-grabbing commits and preserves the rear lining', {timeout: 20000}, async t => {
  const page = await pageFor(t);
  const box = await button(page).boundingBox();
  const x = box.x + 10, y = box.y + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 55, y, {steps: 12});
  await page.waitForTimeout(180);
  await page.mouse.up();
  await page.waitForFunction(() => window.events.includes('rest'));
  assert.deepEqual(await events(page), ['ready', 'interact', 'rest']);
  assert.equal(await page.locator('#back canvas').count(), 1);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 215, y, {steps: 20});
  await page.mouse.up();
  await complete(page);
  assert.deepEqual(await events(page), ['ready', 'interact', 'rest', 'interact', 'torn', 'complete']);
});

test('click-only assistive activation opens once', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await button(page).dispatchEvent('click', {detail: 0});
  await button(page).dispatchEvent('click', {detail: 0});
  await complete(page);
  assert.deepEqual(await events(page), ['ready', 'interact', 'torn', 'complete']);
});

test('ordinary pointer click does not commit a tear', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await button(page).click();
  await page.waitForTimeout(800);
  assert.equal((await events(page)).includes('torn'), false);
  assert.equal((await events(page)).includes('complete'), false);
});

for (const mode of ['reduced', 'noGL', 'broken', 'context-loss']) {
  test(`${mode} retains an operable fallback`, {timeout: 15000}, async t => {
    const page = await pageFor(t, {reduced: mode === 'reduced', noGL: mode === 'noGL',
      query: mode === 'broken' ? '?broken' : ''});
    if (mode === 'context-loss') await page.locator('#host canvas').evaluate(canvas => {
      canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
    });
    await page.waitForFunction(() => !document.querySelector('#host canvas'));
    await button(page).press('Space');
    await complete(page);
    assert.deepEqual((await events(page)).filter(event => event !== 'ready'), ['interact', 'torn', 'complete']);
  });
}

test('body artwork updates preserve the GL canvas and readiness', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => { window.savedCanvas = document.querySelector('#host canvas'); window.control.preview(); });
  await page.waitForFunction(() => [...document.querySelectorAll('#host img')].some(image => image.src === window.control.art('#68334d')));
  assert.equal(await page.evaluate(() => window.savedCanvas === document.querySelector('#host canvas')), true);
  assert.deepEqual(await events(page), ['ready']);
  await button(page).press('Enter');
  await complete(page);
});

test('disposal cancels an opening and releases its WebGL context', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => { window.savedGL = document.querySelector('#host canvas').getContext('webgl'); });
  await button(page).press('Enter');
  await page.evaluate(() => { window.control.dispose(); window.control.dispose(); });
  await page.waitForFunction(() => window.savedGL.isContextLost());
  assert.equal(await page.locator('#host canvas').count(), 0);
  const before = await events(page);
  await page.waitForTimeout(1000);
  assert.deepEqual(await events(page), before);
  assert.equal(before.includes('complete'), false);
});

test('disposal from readiness and repeated mounting leave no stale callbacks', {timeout: 15000}, async t => {
  const page = await pageFor(t, {query: '?disposeOn=ready'});
  await page.waitForFunction(() => !document.querySelector('#host canvas'));
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.control.mount());
    await page.waitForFunction(() => window.events.includes('ready') && !document.querySelector('#host canvas'));
  }
  await page.waitForTimeout(400);
  assert.deepEqual(await events(page), ['ready']);
  assert.equal(await page.locator('#back canvas').count(), 0);
});

test('visibility changes pause rendering and preserve an operable tear', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await button(page).press('Enter');
  await complete(page);
  assert.deepEqual(await events(page), ['ready', 'interact', 'torn', 'complete']);
});

test('complete pack-to-card handoff still works after resize', {timeout: 25000}, async t => {
  const page = await pageFor(t);
  await page.goto(origin + '/library/examples/');
  await page.waitForSelector('.recap-pack-enhanced');
  await page.setViewportSize({width: 740, height: 850});
  await page.waitForTimeout(500);
  await page.locator('.recap-webgl-pack').getByRole('button', {name: 'Open pack', exact: true}).press('Enter');
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('The Seed'));
  await page.waitForSelector('.recap-pack-flight', {state: 'detached'});
  assert.equal(await page.locator('.recap-card-flight').count(), 0);
  await page.getByRole('button', {name: 'Next', exact: true}).click();
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('The Compass'));
  await page.getByRole('button', {name: 'Reset collection', exact: true}).click();
  await page.waitForSelector('.recap-pack-enhanced');
});

test('a renderer imported in the parent works and cleans up inside an iframe', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    window.control.dispose();
    const iframe = document.createElement('iframe');
    iframe.id = 'embedded';
    iframe.style.cssText = 'width:500px;height:650px;border:0';
    iframe.srcdoc = '<link rel="stylesheet" href="/library/styles.css"><div id="mount" style="margin:150px 100px"></div>';
    document.body.prepend(iframe);
  });
  const frame = page.frameLocator('#embedded');
  await frame.locator('#mount').waitFor({state: 'attached'});
  await page.evaluate(() => {
    const iframe = document.getElementById('embedded');
    window.embeddedEvents = [];
    const host = iframe.contentDocument.getElementById('mount');
    window.disposeEmbedded = window.control.mountInto(host, {
      artSrc: window.control.art('#20363c'), width: 270, height: 360,
      onReady: () => window.embeddedEvents.push('ready'),
      onTorn: () => window.embeddedEvents.push('torn'),
      onComplete: () => window.embeddedEvents.push('complete'),
    });
  });
  await page.waitForFunction(() => window.embeddedEvents.includes('ready'));
  assert.equal(await frame.locator('canvas').evaluate(canvas => canvas.ownerDocument !== window.parent.document), true);
  await frame.getByRole('button', {name: 'Open pack', exact: true}).press('Enter');
  await page.waitForFunction(() => window.embeddedEvents.includes('complete'));
  assert.deepEqual(await page.evaluate(() => window.embeddedEvents), ['ready', 'torn', 'complete']);
  await page.evaluate(() => {
    window.embeddedGL = document.getElementById('embedded').contentDocument.querySelector('canvas').getContext('webgl');
    window.disposeEmbedded();
  });
  await page.waitForFunction(() => window.embeddedGL.isContextLost());
  assert.equal(await frame.locator('canvas').count(), 0);
});
