import assert from 'node:assert/strict';
import test from 'node:test';
import { createPackCards } from '../index.js';
import { installDOM } from './dom-fixture.mjs';

test('reduced-motion manual opening waits for the first-card reveal', async t => {
  const dom = installDOM(t, { reduced: true });
  const host = dom.host();
  const events = [];
  let rendererLoads = 0;
  const component = createPackCards({ loadRenderer: async () => { rendererLoads++; throw new Error('Unavailable renderer'); } });
  const dispose = component.mountPack(host, {
    label: 'Collection', count: 3, onOpening: () => events.push('opening'), onOpen: () => events.push('open')
  });
  dom.cleanup(dispose);
  dispose.open();
  dispose.open();
  assert.deepEqual(events, ['opening']);
  assert.equal(dom.timers.size, 0);
  const ready = host.querySelector('.recap-ready-card');
  const deck = host.querySelector('.recap-deck');
  assert.ok(ready);
  assert.equal(ready.getAttribute('aria-label'), 'Reveal the first card');
  assert.equal(deck.listenerCount('pointermove'), 1);
  ready.click();
  ready.click();
  assert.deepEqual(events, ['opening', 'open']);
  assert.equal(deck.listenerCount('pointermove'), 0);
  await dom.settle();
  assert.equal(rendererLoads, 0);
});

test('reduced-motion automatic opening reveals once without an intermediate deck', async t => {
  const dom = installDOM(t, { reduced: true });
  const host = dom.host();
  const events = [];
  const dispose = createPackCards().mountPack(host, {
    count: 2, autoRevealFirst: true,
    onOpening: () => events.push('opening'), onOpen: arrival => events.push(['open', arrival])
  });
  dom.cleanup(dispose);
  dispose.open();
  dispose.open();
  host.querySelector('.recap-pack-skip').click();
  assert.deepEqual(events, ['opening', ['open', null]]);
  assert.equal(host.querySelector('.recap-ready-card'), null);
  assert.equal(dom.timers.size, 0);
  await dom.settle();
});

test('disposed pack controls cannot start work or invoke callbacks', async t => {
  const dom = installDOM(t, { reduced: true });
  const host = dom.host();
  const events = [];
  const dispose = createPackCards().mountPack(host, {
    autoRevealFirst: true, onOpening: () => events.push('opening'), onOpen: () => events.push('open')
  });
  const pack = host.querySelector('.recap-pack');
  const skip = host.querySelector('.recap-pack-skip');
  const motion = host.querySelector('.recap-pack-motion');
  dispose();
  dispose();
  dispose.open();
  pack.click();
  skip.click();
  await dom.settle();
  assert.deepEqual(events, []);
  assert.equal(dom.timers.size, 0);
  assert.equal(motion.listenerCount('pointermove'), 0);
  assert.equal(dom.document.listenerCount('visibilitychange'), 0);
});

test('rejected optional renderer retains a usable ordinary pack opening', async t => {
  const dom = installDOM(t);
  const host = dom.host();
  let rendererLoads = 0;
  const events = [];
  const dispose = createPackCards({ loadRenderer: async () => {
    rendererLoads++;
    throw new Error('WebGL renderer could not load');
  } }).mountPack(host, {
    count: 2, autoRevealFirst: true,
    onOpening: () => events.push('opening'), onOpen: () => events.push('open')
  });
  dom.cleanup(dispose);
  await dom.settle();
  assert.equal(rendererLoads, 1);
  assert.equal(host.querySelector('.recap-pack').hidden, false);
  assert.equal(host.querySelector('.recap-pack-stack').style.opacity, '');
  dispose.open();
  assert.deepEqual(events, ['opening']);
  assert.equal(dom.timers.size, 1);
  dom.runTimers();
  assert.deepEqual(events, ['opening', 'open']);
  assert.equal(dom.timers.size, 0);
});

test('disposing an animated opening cancels its timer and ignores a queued completion', async t => {
  const dom = installDOM(t);
  const host = dom.host();
  const events = [];
  const dispose = createPackCards({ loadRenderer: async () => { throw new Error('Unavailable'); } }).mountPack(host, {
    autoRevealFirst: true, onOpening: () => events.push('opening'), onOpen: () => events.push('open')
  });
  dom.cleanup(dispose);
  await dom.settle();
  dispose.open();
  const [{ callback }] = [...dom.timers.values()];
  assert.equal(typeof callback, 'function');
  dispose();
  assert.equal(dom.timers.size, 0);
  callback();
  dispose.open();
  assert.deepEqual(events, ['opening']);
});

test('renderer loading that completes after disposal cannot mount stale content', async t => {
  const dom = installDOM(t);
  const host = dom.host();
  let resolveRenderer;
  let mounts = 0;
  const loading = new Promise(resolve => { resolveRenderer = resolve; });
  const dispose = createPackCards({ loadRenderer: () => loading }).mountPack(host, {});
  dom.cleanup(dispose);
  await dom.settle();
  dispose();
  resolveRenderer({ mountPack: () => { mounts++; return () => {}; } });
  await dom.settle();
  assert.equal(mounts, 0);
  assert.equal(host.querySelector('.recap-webgl-pack'), null);
  assert.equal(dom.timers.size, 0);
});

test('different label configurations and pack lifetimes coexist', async t => {
  const dom = installDOM(t, { reduced: true });
  const firstHost = dom.host();
  const secondHost = dom.host();
  const revealed = [];
  const first = createPackCards({ labels: { open: 'Ouvrir', revealFirst: 'Révéler', backCaption: 'PREMIÈRE' } });
  const second = createPackCards({ labels: { open: 'Abrir', revealFirst: 'Revelar', backCaption: 'SEGUNDA' } });
  const firstDispose = first.mountPack(firstHost, { count: 2, onOpen: () => revealed.push('first') });
  const secondDispose = second.mountPack(secondHost, { count: 2, onOpen: () => revealed.push('second') });
  dom.cleanup(firstDispose);
  dom.cleanup(secondDispose);
  assert.equal(firstHost.querySelector('.recap-pack').getAttribute('aria-label'), 'Ouvrir');
  assert.equal(secondHost.querySelector('.recap-pack').getAttribute('aria-label'), 'Abrir');
  assert.equal(firstHost.querySelector('.recap-print-edition').textContent, 'PREMIÈRE');
  assert.equal(secondHost.querySelector('.recap-print-edition').textContent, 'SEGUNDA');
  firstDispose.open();
  secondDispose.open();
  assert.equal(firstHost.querySelector('.recap-ready-card').getAttribute('aria-label'), 'Révéler');
  assert.equal(secondHost.querySelector('.recap-ready-card').getAttribute('aria-label'), 'Revelar');
  firstDispose();
  firstHost.querySelector('.recap-ready-card').click();
  secondHost.querySelector('.recap-ready-card').click();
  assert.deepEqual(revealed, ['second']);
  await dom.settle();
});

test('card disposal removes navigation, pointer and document listeners', t => {
  const dom = installDOM(t);
  const host = dom.host();
  const card = dom.document.createElement('article');
  const navigations = [];
  const mounted = createPackCards().mountCard(card, { onNavigate: direction => navigations.push(direction) });
  dom.cleanup(mounted.dispose);
  assert.ok(card.classList.contains('recap-card'), 'Plain consumer elements receive the base class required by package CSS.');
  assert.ok(card.classList.contains('recap-collectible'));
  host.append(mounted.stage);
  const deck = mounted.stage.querySelector('.recap-deck');
  card.click();
  assert.deepEqual(navigations, [1]);
  deck.emit('pointermove', { target: card, pointerType: 'mouse', clientX: 240, clientY: 0 });
  assert.equal(deck.style.getPropertyValue('--tilt-y'), '7deg');
  assert.equal(dom.document.listenerCount('visibilitychange'), 1);
  mounted.dispose();
  mounted.dispose();
  card.click();
  deck.emit('pointermove', { target: card, pointerType: 'mouse', clientX: 0, clientY: 320 });
  assert.deepEqual(navigations, [1]);
  assert.equal(deck.style.getPropertyValue('--tilt-y'), '');
  assert.equal(card.listenerCount('click'), 0);
  for (const type of ['mousedown', 'pointerdown', 'pointercancel', 'pointerup']) assert.equal(mounted.stage.listenerCount(type), 0);
  for (const type of ['pointermove', 'pointerleave', 'pointercancel']) assert.equal(deck.listenerCount(type), 0);
  assert.equal(dom.document.listenerCount('visibilitychange'), 0);
  for (const query of dom.media.values()) assert.equal(query.listenerCount('change'), 0);
});

test('pack mounts use their host document for elements, focus and animation timers', async t => {
  const primary = installDOM(t, { reduced: true });
  const embedded = installDOM(t, { installGlobals: false });
  const host = embedded.host();
  let opened = 0;
  const dispose = createPackCards({ loadRenderer: async () => { throw new Error('Fallback'); } })
    .mountPack(host, { count: 2, onOpen: () => opened++ });
  embedded.cleanup(dispose);
  await embedded.settle();
  const pack = host.querySelector('.recap-pack');
  assert.equal(pack.ownerDocument, embedded.document);
  assert.equal(embedded.document.activeElement, pack);
  assert.equal(primary.document.activeElement, null);
  dispose.open();
  assert.equal(embedded.timers.size, 1, 'The embedded window owns the animated opening.');
  assert.equal(primary.timers.size, 0);
  assert.equal(host.querySelector('.recap-ready-card'), null, 'The parent window reduced-motion preference is unrelated.');
  embedded.runTimers();
  const ready = host.querySelector('.recap-ready-card');
  assert.equal(ready.ownerDocument, embedded.document);
  assert.equal(embedded.document.activeElement, ready);
  ready.click();
  assert.equal(opened, 1);
  dispose();
  assert.equal(embedded.document.listenerCount('visibilitychange'), 0);
  assert.equal(primary.media.size, 0);
});

test('default pack artwork uses its document canvas independently of the element hook', async t => {
  const primary = installDOM(t);
  const embedded = installDOM(t, { reduced: true, installGlobals: false });
  let canvases = 0;
  const createElement = embedded.document.createElement;
  embedded.document.createElement = tag => {
    if (tag === 'canvas') canvases++;
    return createElement(tag);
  };
  primary.document.createElement = () => assert.fail('Artwork must use the mounted pack document.');
  const cards = createPackCards({ createElement(tag, text, className) {
    assert.notEqual(tag, 'canvas', 'The existing element hook does not own internal canvas allocation.');
    const node = createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  } });
  const host = embedded.host();
  const dispose = cards.mountPack(host);
  embedded.cleanup(dispose);
  await embedded.settle();
  assert.equal(canvases, 1);
  assert.ok(host.querySelector('.recap-pack').classList.contains('recap-pack-illustrated'));
});

test('cards use their own window for selection, sensors and arrival cancellation', t => {
  const primary = installDOM(t, { reduced: true });
  const embedded = installDOM(t, { installGlobals: false });
  embedded.window.isSecureContext = true;
  embedded.window.navigator.maxTouchPoints = 1;
  embedded.window.DeviceOrientationEvent = class {};
  embedded.window.getSelection = () => ({ isCollapsed: false });
  const createElement = embedded.document.createElement;
  embedded.document.createElement = tag => {
    const node = createElement(tag);
    node.animate = () => ({ cancel() {} });
    return node;
  };
  const face = embedded.document.createElement('article');
  const navigations = [];
  const mounted = createPackCards().mountCard(face, {
    onNavigate: direction => navigations.push(direction), arrival: { left: 0, top: 0, width: 180, height: 250 }
  });
  embedded.host().append(mounted.stage);
  embedded.cleanup(mounted.dispose);
  assert.equal(mounted.stage.ownerDocument, embedded.document);
  assert.equal(embedded.frames.size, 1);
  assert.equal(primary.frames.size, 0);
  assert.equal(embedded.window.listenerCount('deviceorientation'), 1);
  assert.equal(primary.window.listenerCount('deviceorientation'), 0);
  face.click();
  assert.deepEqual(navigations, [], 'Text selected in the card document prevents navigation.');
  embedded.window.getSelection = () => ({ isCollapsed: true });
  face.click();
  assert.deepEqual(navigations, [1]);
  const preference = embedded.window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.matches = true;
  preference.emit('change');
  assert.equal(embedded.frames.size, 0);
  assert.equal(mounted.stage.style.opacity, '');
  mounted.dispose();
  assert.equal(embedded.window.listenerCount('deviceorientation'), 0);
  assert.equal(embedded.document.listenerCount('visibilitychange'), 0);
});

test('ready decks created with a foreign element factory schedule in that window', t => {
  const primary = installDOM(t);
  const embedded = installDOM(t, { installGlobals: false });
  const createElement = (tag, text, className) => {
    const node = embedded.document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let revealed = 0;
  const ready = createPackCards({ createElement }).mountReadyDeck({ autoReveal: true, onReveal: () => revealed++ });
  embedded.host().append(ready.stage);
  embedded.cleanup(ready.dispose);
  assert.equal(embedded.timers.size, 1);
  assert.equal(primary.timers.size, 0);
  embedded.runTimers();
  assert.equal(revealed, 1);
  ready.dispose();
  assert.equal(embedded.document.listenerCount('visibilitychange'), 0);
});
