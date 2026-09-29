import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPack } from '../renderer.js';
import { installDOM } from './dom-fixture.mjs';

function rendererDOM(t, { reduced = true } = {}) {
  const dom = installDOM(t, { reduced, installGlobals: false });
  Object.assign(dom.window, { performance, queueMicrotask });
  const createElement = dom.document.createElement;
  dom.document.createElement = tag => {
    const node = createElement(tag);
    node.appendChild = child => { node.append(child); return child; };
    if (tag === 'canvas') node.getContext = () => null;
    return node;
  };
  return dom;
}

test('renderer uses its host document and an operable reduced-motion fallback', async t => {
  const dom = rendererDOM(t);
  const host = dom.host();
  const events = [];
  const dispose = mountPack(host, {
    artSrc: '/pack.svg', width: 240, height: 320, labels: { open: 'Ouvrir' },
    onReady: () => events.push('ready'), onInteract: () => events.push('interact'),
    onTorn: () => events.push('torn'), onComplete: () => events.push('complete')
  });
  dom.cleanup(dispose);
  await dom.settle();
  const button = host.querySelector('button');
  assert.equal(button.ownerDocument, dom.document);
  assert.equal(button.getAttribute('aria-label'), 'Ouvrir');
  button.click();
  button.click();
  assert.deepEqual(events, ['ready', 'interact']);
  assert.deepEqual([...dom.timers.values()].map(timer => timer.delay), [60, 360]);
  dom.runTimers();
  assert.deepEqual(events, ['ready', 'interact', 'torn', 'complete']);
  dispose();
  dispose();
  button.click();
  assert.equal(host.children.length, 0);
  assert.equal(dom.timers.size, 0);
  assert.deepEqual(events, ['ready', 'interact', 'torn', 'complete']);
});

test('renderer disposal before fallback readiness suppresses queued callbacks', async t => {
  const dom = rendererDOM(t);
  const host = dom.host();
  let ready = 0;
  const dispose = mountPack(host, { artSrc: '/pack.svg', width: 240, height: 320, onReady: () => ready++ });
  dispose();
  await dom.settle();
  assert.equal(ready, 0);
  assert.equal(host.children.length, 0);
});

test('renderer supports synchronous disposal from interaction callbacks', async t => {
  const dom = rendererDOM(t);
  const host = dom.host();
  const events = [];
  const dispose = mountPack(host, {
    artSrc: '/pack.svg', width: 240, height: 320,
    onInteract: () => { events.push('interact'); dispose(); },
    onTorn: () => events.push('torn'), onComplete: () => events.push('complete')
  });
  await dom.settle();
  host.querySelector('button').click();
  dom.runTimers();
  assert.deepEqual(events, ['interact']);
  assert.equal(dom.timers.size, 0);
  assert.equal(host.children.length, 0);
});

test('body-artwork updates preserve mounted controls and pending fallback timing', async t => {
  const dom = rendererDOM(t);
  const host = dom.host();
  let ready = 0;
  const dispose = mountPack(host, { artSrc: '/pack.svg', width: 240, height: 320, onReady: () => ready++ });
  dom.cleanup(dispose);
  await dom.settle();
  const button = host.querySelector('button');
  const images = host.querySelectorAll('img');
  button.click();
  dispose.setBodyArtwork('/preview.svg');
  assert.equal(host.querySelector('button'), button);
  assert.deepEqual(host.querySelectorAll('img'), images);
  assert.ok(images.every(image => image.src === '/preview.svg'));
  assert.deepEqual([...dom.timers.values()].map(timer => timer.delay), [60, 360]);
  assert.equal(ready, 1);
});

test('unavailable WebGL falls back and removes rear ghost images on disposal', async t => {
  const dom = rendererDOM(t, { reduced: false });
  t.mock.method(console, 'warn', () => {});
  const host = dom.host();
  const backLayer = dom.host();
  const dispose = mountPack(host, { artSrc: '/pack.svg', width: 240, height: 320, packCount: 3, backLayer });
  assert.equal(backLayer.children.length, 2);
  await dom.settle();
  assert.ok(host.querySelector('button'));
  assert.equal(backLayer.children.length, 0);
  dispose();
  assert.equal(host.children.length, 0);
  assert.equal(dom.document.listenerCount('visibilitychange'), 0);
});
