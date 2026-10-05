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
    count: 6,
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
  const travelling = await page.evaluate(async () => {
    window.travel = document.querySelector('.recap-pack-flight-deck').getAnimations()[0];
    const turn = document.querySelector('.recap-pack-flight-deck .recap-card-turn');
    window.flip = turn.getAnimations()[0];
    await Promise.all([window.travel.ready, window.flip.ready]);
    const sharedStart = window.travel.startTime === window.flip.startTime;
    window.travel.pause();
    window.flip.pause();
    window.travel.currentTime = 1500;
    window.flip.currentTime = 1500;
    const facing = () => new DOMMatrixReadOnly(getComputedStyle(turn).transform).m11;
    const beforeArrival = facing(), duration = Number(window.travel.effect.getTiming().duration);
    window.flip.currentTime = duration;
    const atArrival = facing();
    window.flip.currentTime = duration + 16;
    return {sharedStart, delay: window.flip.effect.getTiming().delay, duration,
      beforeArrival, atArrival, firstFrame: facing()};
  });
  assert.equal(travelling.sharedStart, true, 'movement and reveal use the same animation clock');
  assert.equal(travelling.delay, travelling.duration, 'the reveal starts exactly when the movement finishes');
  assert.equal(travelling.beforeArrival, -1, 'the card back stays facing the viewer during movement');
  assert.equal(travelling.atArrival, -1, 'the card has not turned before reaching its destination');
  assert.ok(travelling.firstFrame > -1 && travelling.firstFrame < 1, 'the first frame after arrival already turns the card');
  await page.evaluate(() => window.travel.finish());
  const revealing = await page.evaluate(() => {
    const turn = document.querySelector('.recap-pack-flight-deck .recap-card-turn');
    const timing = window.flip.effect.getTiming();
    window.flip.currentTime = timing.delay + Number(timing.duration) / 2;
    return new DOMMatrixReadOnly(getComputedStyle(turn).transform).m11;
  });
  assert.ok(revealing > -1 && revealing < 1, 'the card turns after the movement finishes');
  assert.equal(await page.evaluate(() => window.packGL.isContextLost()), false, 'the arrival remains owned until the flip finishes');
  await page.evaluate(() => window.flip.finish());
  await page.locator('.recap-pack-flight').waitFor({state: 'detached'});
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'The Orbit');
  assert.equal(await page.locator('#host article').evaluate(face => document.activeElement === face), true);
  assert.deepEqual(await page.evaluate(() => window.events), ['revealed']);
  await page.evaluate(() => window.view.dispose());
  assert.equal(await page.locator('#host > *').count(), 0);
  assert.equal(await page.locator('.recap-pack-flight, .recap-card-flight').count(), 0);
});

test('a single card keeps its reveal overlapping the native arrival movement', {timeout: 25000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.view.showPack({
    count: 1,
    renderCard: () => ({face: window.createFace('Single card')}),
  }));
  await ready(page);
  await page.evaluate(() => {
    window.packGL = document.querySelector('#host canvas').getContext('webgl');
    window.view.open();
  });
  await page.locator('.recap-pack-flight-deck article').waitFor({state: 'attached'});
  const overlapping = await page.evaluate(() => {
    const flight = document.querySelector('.recap-pack-flight-deck');
    const turn = flight.querySelector('.recap-card-turn'), flip = turn.getAnimations()[0];
    window.travel = flight.getAnimations()[0];
    window.travel.pause();
    window.travel.currentTime = 1500;
    if (!flip) return null;
    flip.pause();
    flip.currentTime = 1500;
    return {movement: window.travel.effect.getComputedTiming().progress,
      facing: new DOMMatrixReadOnly(getComputedStyle(turn).transform).m11};
  });
  assert.ok(overlapping, 'a single card starts its flip alongside the movement');
  assert.ok(overlapping.movement < 1, 'the arrival movement is still in progress');
  assert.ok(overlapping.facing > -1 && overlapping.facing < 1, 'the single card is already turning during movement');
  await page.evaluate(() => window.travel.finish());
  await page.locator('.recap-pack-flight').waitFor({state: 'detached'});
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'Single card');
  await page.evaluate(() => window.view.dispose());
});

test('rectangle arrivals hold the flip until movement finishes and release it on cancellation', {timeout: 15000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(async () => {
    const {createPackCards} = await import('/library/presentation.js');
    const presentation = createPackCards();
    window.mountArrival = () => {
      window.arrivingCard = presentation.mountCard(window.createFace('Rectangle arrival'), {
        remaining: 5,
        arrival: {left: 20, top: 30, width: 160, height: 220},
      });
      document.getElementById('host').replaceChildren(window.arrivingCard.stage);
    };
    window.mountArrival();
  });
  await page.waitForFunction(() => window.arrivingCard.stage.getAnimations().length === 1);
  await page.evaluate(() => {
    window.travel = window.arrivingCard.stage.getAnimations()[0];
    window.travel.pause();
    window.travel.currentTime = 160;
  });
  await page.waitForTimeout(450);
  const travelling = await page.locator('.recap-card-turn').evaluate(turn => ({
    state: turn.getAnimations()[0].playState,
    facing: new DOMMatrixReadOnly(getComputedStyle(turn).transform).m33,
  }));
  assert.equal(travelling.state, 'paused', 'elapsed time alone must not begin the reveal');
  assert.equal(travelling.facing, -1);
  await page.evaluate(() => window.travel.finish());
  await page.waitForFunction(() => document.querySelector('.recap-card-turn').getAnimations()[0].playState === 'running');
  const revealing = await page.locator('.recap-card-turn').evaluate(turn => {
    const flip = turn.getAnimations()[0];
    flip.pause();
    const facing = () => new DOMMatrixReadOnly(getComputedStyle(turn).transform).m33;
    flip.currentTime = 0;
    const atArrival = facing();
    flip.currentTime = 16;
    const firstFrame = facing();
    flip.currentTime = Number(flip.effect.getTiming().duration) / 2;
    return {atArrival, firstFrame, halfway: facing()};
  });
  assert.equal(revealing.atArrival, -1);
  assert.ok(revealing.firstFrame > -1 && revealing.firstFrame < 1, 'the rectangle arrival has no extra hold before turning');
  assert.ok(revealing.halfway > -1 && revealing.halfway < 1);
  await page.evaluate(() => {
    window.arrivingCard.dispose();
    window.mountArrival();
  });
  await page.waitForFunction(() => window.arrivingCard.stage.getAnimations().length === 1);
  const canceled = await page.evaluate(() => {
    const stage = window.arrivingCard.stage, turn = stage.querySelector('.recap-card-turn');
    const travel = stage.getAnimations()[0];
    travel.pause();
    window.arrivingCard.cancelArrival();
    return {travel: travel.playState, flip: turn.getAnimations()[0].playState,
      opacity: stage.style.opacity, playState: turn.style.animationPlayState};
  });
  assert.deepEqual(canceled, {travel: 'idle', flip: 'running', opacity: '', playState: ''});
  await page.evaluate(() => window.arrivingCard.dispose());
});

test('reduced motion during the delayed native flip settles the card and releases the context', {timeout: 25000}, async t => {
  const page = await pageFor(t);
  await page.evaluate(() => window.view.showPack({
    count: 6,
    renderCard: () => ({face: window.createFace('Settled card')}),
  }));
  await ready(page);
  await page.evaluate(() => {
    window.packGL = document.querySelector('#host canvas').getContext('webgl');
    window.view.open();
  });
  await page.locator('.recap-pack-flight-deck article').waitFor({state: 'attached'});
  await page.evaluate(() => document.querySelector('.recap-pack-flight-deck').getAnimations()[0].finish());
  await page.evaluate(() => {
    const flip = document.querySelector('.recap-pack-flight-deck .recap-card-turn').getAnimations()[0];
    flip.pause();
    flip.currentTime = flip.effect.getTiming().delay + 16;
  });
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.locator('.recap-pack-flight').waitFor({state: 'detached'});
  await page.waitForFunction(() => window.packGL.isContextLost());
  assert.equal(await page.locator('#host article').getAttribute('aria-label'), 'Settled card');
  assert.equal(await page.locator('#host .recap-card-turn').evaluate(turn => getComputedStyle(turn).transform), 'none');
  await page.evaluate(() => window.view.dispose());
  assert.equal(await page.locator('#host > *, .recap-pack-flight, .recap-card-flight').count(), 0);
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
