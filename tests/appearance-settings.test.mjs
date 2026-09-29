import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appearanceDefaults, createAppearanceSettings, normalizeAppearance,
  normalizeRecapAppearance, resolveAppearance,
} from '../index.js';
import * as appearance from '../appearance.js';

test('settings creation accepts versionless pack and rarity overrides', () => {
  const settings = createAppearanceSettings({
    motion: 'still', opening: 'instant', pack_zoom: false,
    rarities: {rare: {coating: 'pearl', foil: 'none'}},
  });
  assert.equal(settings.version, 5);
  assert.equal(settings.motion, 'still');
  assert.equal(settings.opening, 'instant');
  assert.equal(settings.pack_zoom, false);
  assert.equal(settings.rarities.rare.coating, 'pearl');
  assert.equal(settings.rarities.rare.foil, 'none');
  assert.equal(settings.rarities.rare.coverage, 'none');
  assert.equal(settings.rarities.rare.pattern, 'none');
  assert.deepEqual(settings.rarities.legendary, appearanceDefaults.rarities.legendary);
  assert.equal(resolveAppearance(settings, {}, 'test-card', 'rare').motion, 'still');
});

test('settings creation accepts frozen overrides and does not share mutable profiles', () => {
  const pattern = Object.freeze(['dots', 'facets']);
  const options = Object.freeze({
    card: Object.freeze({foil: 'holographic', pattern}),
    rarities: Object.freeze({rare: Object.freeze({pattern})}),
  });
  const first = createAppearanceSettings(options);
  const second = createAppearanceSettings(options);
  assert.notEqual(first.card, second.card);
  assert.notEqual(first.card.pattern, pattern);
  assert.notEqual(first.rarities.rare.pattern, pattern);
  first.card.pattern.push('brushed');
  first.rarities.rare.pattern.push('stardust');
  first.rarities.legendary.engraving.push('none');
  assert.deepEqual(second, createAppearanceSettings(options));
  assert.deepEqual(pattern, ['dots', 'facets']);
  assert.deepEqual(createAppearanceSettings(), normalizeAppearance());
  assert.ok(Object.isFrozen(appearanceDefaults.card));
});

test('settings creation preserves parser fallback for explicitly incompatible versions', () => {
  assert.deepEqual(createAppearanceSettings({version: 4, motion: 'still'}), normalizeAppearance());
  assert.deepEqual(createAppearanceSettings({version: 99, opening: 'instant'}), normalizeAppearance());
});

test('friendly and legacy parsers keep their saved-settings behavior and identity', () => {
  assert.equal(normalizeAppearance, normalizeRecapAppearance);
  assert.equal(normalizeAppearance, appearance.normalizeAppearance);
  assert.equal(createAppearanceSettings, appearance.createAppearanceSettings);
  assert.deepEqual(normalizeAppearance({motion: 'still'}), normalizeAppearance());
  assert.equal(normalizeAppearance({version: 5, motion: 'still'}).motion, 'still');
});
