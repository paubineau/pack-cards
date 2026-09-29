import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appearanceDefaults, createPackCards, createRarityAppearanceResolver,
  normalizeAppearance, resolveAppearance, resolveAppearances
} from '../index.js';

test('the package imports without application or browser globals', () => {
  assert.equal(typeof createPackCards, 'function');
  assert.equal(typeof resolveAppearance, 'function');
  assert.equal(typeof globalThis.document, 'undefined');
});

test('normalization returns independent settings and preserves frozen defaults', () => {
  const first = normalizeAppearance();
  const second = normalizeAppearance();
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.card, second.card);
  assert.ok(Object.isFrozen(appearanceDefaults));
  assert.ok(Object.isFrozen(appearanceDefaults.card));
  first.card.stock = 'metal';
  first.rarities.common.coating = 'pearl';
  assert.deepEqual(second, normalizeAppearance());
});

test('normalization removes impossible foil coverage and patterns without mutating input', () => {
  const settings = normalizeAppearance();
  settings.card.foil = 'none';
  settings.card.coverage = 'full';
  settings.card.pattern = 'facets';
  const original = structuredClone(settings);
  const result = normalizeAppearance(settings);
  assert.equal(result.card.foil, 'none');
  assert.equal(result.card.coverage, 'none');
  assert.equal(result.card.pattern, 'none');
  assert.deepEqual(settings, original);
});

test('appearance assignment is stable when collection presentation order changes', () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({ identity: `card-${index}`, rarity: 'rare' }));
  const forward = resolveAppearances(appearanceDefaults, {}, entries, 'demo');
  const reversed = resolveAppearances(appearanceDefaults, {}, [...entries].reverse(), 'demo').reverse();
  assert.deepEqual(forward, reversed);
  assert.ok(forward.every(Object.isFrozen));
});

test('duplicate identities reuse their appearance without consuming an allocation', () => {
  const resolve = createRarityAppearanceResolver(appearanceDefaults, {}, 'demo');
  const first = resolve('rare', 'first');
  assert.equal(resolve('rare', 'first'), first);
  const second = resolve('rare', 'second');
  const fresh = createRarityAppearanceResolver(appearanceDefaults, {}, 'demo');
  fresh('rare', 'first');
  assert.deepEqual(fresh('rare', 'second'), second);
});

test('balanced choices are used once per cycle for eligible cards', () => {
  const settings = normalizeAppearance();
  settings.card.foil = 'holographic';
  settings.card.pattern = ['brushed', 'dots', 'facets'];
  const resolve = createRarityAppearanceResolver(settings, {}, 'balanced');
  const selected = Array.from({ length: 9 }, (_, index) => resolve(null, `card-${index}`).pattern);
  for (let index = 0; index < selected.length; index += 3) {
    assert.deepEqual([...selected.slice(index, index + 3)].sort(), ['brushed', 'dots', 'facets']);
  }
});

test('a resolved appearance can be reused without rerandomization', () => {
  const resolved = resolveAppearance(appearanceDefaults, {}, 'known', 'legendary');
  assert.equal(resolveAppearance(resolved, {}, 'different'), resolved);
  assert.equal(typeof resolved.pattern, 'string');
  assert.equal(typeof resolved.engraving, 'string');
});

test('separate component instances keep configured render hooks independent', () => {
  const first = createPackCards({ renderBack: label => `first:${label}` });
  const second = createPackCards({ renderBack: label => `second:${label}` });
  assert.equal(first.renderBack('collection', {}), 'first:collection');
  assert.equal(second.renderBack('collection', {}), 'second:collection');
  assert.equal(first.renderBack('again', {}), 'first:again');
});

test('instant opening invokes each lifecycle callback once and returns a safe disposer', () => {
  const first = createPackCards({ labels: { open: 'Open first' } });
  const second = createPackCards({ labels: { open: 'Open second' } });
  assert.notEqual(first, second);
  const appearance = normalizeAppearance();
  appearance.opening = 'instant';
  const calls = [];
  const firstDispose = first.mountPack({}, {
    appearance, onOpening: () => calls.push('first:opening'), onOpen: () => calls.push('first:open')
  });
  const secondDispose = second.mountPack({}, {
    appearance, onOpening: () => calls.push('second:opening'), onOpen: () => calls.push('second:open')
  });
  firstDispose();
  firstDispose();
  firstDispose.open();
  secondDispose();
  assert.deepEqual(calls, ['first:opening', 'first:open', 'second:opening', 'second:open']);
});

test('empty or invalid pack counts fail before callbacks or DOM changes', () => {
  const cards = createPackCards();
  for (const count of [0, -1, NaN, Infinity, 1.5, '2']) {
    assert.throws(() => cards.mountPack({}, {
      count, appearance: normalizeAppearance({version:5,opening:'instant'}),
      onOpen: () => assert.fail('Invalid packs must not open')
    }), {name:'RangeError',message:'count must be a positive safe integer'});
  }
});
