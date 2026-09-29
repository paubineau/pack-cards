import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('view.html', import.meta.url));
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml'};
let browser, server, origin;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = pathname === '/fixture' ? fixture : resolve(root, pathname.replace(/^\/library\//, ''));
      if (file !== fixture && !file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
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

async function pageFor(t, {reduced = false} = {}) {
  const context = await browser.newContext({reducedMotion: reduced ? 'reduce' : 'no-preference',
    viewport: {width: 1000, height: 850}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'view should have no errors or missing assets'); });
  await page.goto(origin + '/fixture');
  await page.waitForFunction(() => window.view);
  return page;
}

const ready = page => page.waitForFunction(() => document.querySelector('#host .recap-webgl-pack canvas')
  && !document.querySelector('#host .recap-webgl-pack').inert);

test('disposing from a native opening callback leaves no detached arrival', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.view.showPack({
    onOpening: () => { window.view.dispose(); window.events.push('disposed'); },
    renderCard: () => { window.events.push('unexpected render'); return {face: window.createFace('Unexpected')}; },
  }));
  await ready(page);
  await page.evaluate(() => {
    window.packGL = document.querySelector('#host canvas').getContext('webgl');
    window.view.open();
  });
  await page.waitForFunction(() => window.events.includes('disposed'));
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('#host > *, .recap-pack-flight, .recap-card-flight').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.events), ['disposed']);
});

test('managed WebGL opening holds an asynchronous arrival, transfers keyboard focus, and releases its context', {timeout: 25000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.view.showPack({
    renderCard: () => new Promise(resolve => { window.finishCard = resolve; }),
    onReveal: () => window.events.push('revealed'),
  }));
  await ready(page);
  await page.evaluate(() => { window.packGL = document.querySelector('#host canvas').getContext('webgl'); });
  await page.locator('#host .recap-webgl-pack').getByRole('button', {name: 'Open pack', exact: true}).press('Enter');
  await page.waitForFunction(() => typeof window.finishCard === 'function');
  assert.equal(await page.locator('.recap-pack-flight.recap-pack-pending').count(), 1);
  assert.equal(await page.evaluate(() => window.packGL.isContextLost()), false);
  await page.evaluate(() => window.finishCard({face: window.createFace('The Orbit'), identity: 'orbit', rarity: 'rare'}));
  await page.locator('.recap-pack-flight-deck article').waitFor({state: 'attached'});
  await page.locator('.recap-pack-flight').waitFor({state: 'detached'});
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'The Orbit');
  assert.equal(await page.locator('#host article').evaluate(face => document.activeElement === face), true);
  assert.deepEqual(await page.evaluate(() => window.events), ['revealed']);
  await page.evaluate(() => window.view.dispose());
  assert.equal(await page.locator('#host > *').count(), 0);
  assert.equal(await page.locator('.recap-pack-flight, .recap-card-flight').count(), 0);
});

test('reduced and instant views discard deferred cards after replacement and disposal', {timeout: 20000}, async t => {
  const page = await pageFor(t, {reduced: true});
  for (const opening of ['animated', 'instant']) {
    await page.evaluate(opening => {
      window.view = window.createView();
      window.events = [];
      window.finishCard = null;
      window.view.showPack({appearance: {opening},
        renderCard: () => new Promise(resolve => { window.finishCard = resolve; }),
        onReveal: () => window.events.push('stale reveal'),
      });
      window.view.open();
    }, opening);
    await page.waitForFunction(() => typeof window.finishCard === 'function');
    await page.evaluate(async () => {
      window.view.showCard(window.createFace('Replacement'), {rarity: 'rare'});
      window.finishCard({face: window.createFace('Stale')});
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'Replacement');
    assert.deepEqual(await page.evaluate(() => window.events), []);
    await page.evaluate(opening => {
      window.finishCard = null;
      window.view.showPack({appearance: {opening},
        renderCard: () => new Promise(resolve => { window.finishCard = resolve; }),
        onReveal: () => window.events.push('stale reveal'),
      });
      window.view.open();
    }, opening);
    await page.waitForFunction(() => typeof window.finishCard === 'function');
    await page.evaluate(async () => {
      window.view.dispose();
      window.view.dispose();
      window.finishCard({face: window.createFace('Stale')});
      window.view.showCard(window.createFace('Ignored'));
      window.view.open();
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator('#host > *').count(), 0);
    assert.equal(await page.locator('.recap-pack-flight, .recap-card-flight').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.events), []);
  }
});

test('rendering rejection removes the native arrival, reports the error, and permits recovery', {timeout: 25000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.view.showPack({
    renderCard: async () => { throw new Error('Card unavailable'); },
    onReveal: () => window.events.push('unexpected reveal'),
    onError: error => window.events.push(error.message),
  }));
  await ready(page);
  await page.evaluate(() => {
    window.packGL = document.querySelector('#host canvas').getContext('webgl');
    window.view.open();
  });
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('alert').textContent(), 'Unable to display this card.');
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('.recap-pack-flight, #host canvas').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.events), ['Card unavailable']);
  await page.evaluate(() => window.view.showCard(window.createFace('Recovered')));
  assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'Recovered');
  assert.equal(await page.getByRole('alert').count(), 0);
});

test('a parent-imported managed view uses an iframe host and adopts the supplied face', {timeout: 20000}, async t => {
  const page = await pageFor(t, {reduced: true});
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'embedded';
    iframe.style.cssText = 'width:650px;height:700px;border:0';
    iframe.srcdoc = '<link rel="stylesheet" href="/library/styles.css"><div id="host" class="pack-cards" style="min-height:660px"></div>';
    document.body.prepend(iframe);
  });
  const frame = page.frameLocator('#embedded');
  await frame.locator('#host').waitFor({state: 'attached'});
  await page.evaluate(() => {
    const iframe = document.getElementById('embedded');
    const host = iframe.contentDocument.getElementById('host');
    window.mediaQueries = {parent: 0, embedded: 0};
    for (const [name, owner] of [['parent', window], ['embedded', iframe.contentWindow]]) {
      const matchMedia = owner.matchMedia.bind(owner);
      owner.matchMedia = query => { window.mediaQueries[name]++; return matchMedia(query); };
    }
    window.embeddedView = window.createView(host);
    window.parentFace = window.createFace('Embedded card');
    window.embeddedView.showPack({renderCard: () => ({face: window.parentFace, identity: 'embedded', rarity: 'rare'})});
  });
  await frame.locator('.recap-pack').press('Enter');
  await frame.locator('#host article').waitFor();
  assert.equal(await frame.locator('#host article').evaluate(face => face.ownerDocument === document), true);
  assert.equal(await frame.locator('#host article').evaluate(face => document.activeElement === face), true,
    await frame.locator('body').evaluate(body => `Active element: ${body.ownerDocument.activeElement.outerHTML.slice(0, 300)}`));
  assert.equal(await page.evaluate(() => window.parentFace.ownerDocument === document.getElementById('embedded').contentDocument), true);
  assert.equal(await page.evaluate(() => window.mediaQueries.parent), 0);
  assert.ok(await page.evaluate(() => window.mediaQueries.embedded > 0));
  assert.equal(await page.locator('#host > *').count(), 0);
  await page.evaluate(() => window.embeddedView.dispose());
  assert.equal(await frame.locator('#host > *').count(), 0);
  assert.equal(await frame.locator('.recap-pack-flight, .recap-card-flight').count(), 0);
});
