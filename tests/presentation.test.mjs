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
