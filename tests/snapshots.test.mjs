import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotCard, createCardDragPreview } from '../snapshots.js';

// The fixture models detached scroll boxes and canvas bitmap loss on cloning.
// Layout and pointer rectangles are supplied explicitly rather than simulated.
function fixture({ reducedMotion = false } = {}) {
  const document = { documentElement: { clientHeight: 900 }, defaultView: {
    matchMedia: () => ({ matches: reducedMotion }),
    getComputedStyle: node => ({ getPropertyValue(key) {
      for (let current = node; current; current = current.parentElement) {
        const value = current.style.getPropertyValue(key);
        if (value) return value;
      }
      return '';
    } })
  } };
  class Element {
    constructor(tag) {
      Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: document, children: [], attributes: new Map(),
        className: '', parentElement: null, animations: [], offsetWidth: 420, offsetHeight: 588,
        rect: { left: 700, top: 120, width: 320, height: 448 }, width: 1080, height: 1440,
        pixels: null, _scrollTop: 0, _scrollLeft: 0 });
      this.style = { setProperty(key, value) { this[key] = String(value); }, getPropertyValue(key) { return this[key] || ''; } };
    }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    get scrollTop() { return this._scrollTop; }
    set scrollTop(value) { this._scrollTop = this.isConnected ? value : 0; }
    get scrollLeft() { return this._scrollLeft; }
    set scrollLeft(value) { this._scrollLeft = this.isConnected ? value : 0; }
    get classList() { return { remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); } }; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    append(...nodes) {
      for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); }
    }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
      this.parentElement = null;
    }
    cloneNode(deep) {
      const copy = new Element(this.tagName);
      copy.className = this.className;
      copy.attributes = new Map(this.attributes);
      Object.assign(copy.style, this.style);
      if (deep) copy.append(...this.children.map(child => child.cloneNode(true)));
      return copy;
    }
    getContext(type) {
      assert.equal(type, '2d');
      return { drawImage: (source, x, y) => { assert.equal(x, 0); assert.equal(y, 0); this.pixels = source.pixels; } };
    }
    getBoundingClientRect() { return this.rect; }
    animate(frames, options) {
      const animation = { frames, options, cancelCalls: 0, cancel() { this.cancelCalls++; } };
      this.animations.push(animation);
      return animation;
    }
  }
  document.createElement = tag => new Element(tag);
  document.body = new Element('body');
  const card = new Element('article');
  card.className = 'recap-card recap-collectible rarity-reveal';
  document.body.append(card);
  return { document, card, element: tag => new Element(tag) };
}

test('snapshot preserves canvas pixels, scroll and inherited material without changing the source', async () => {
  const { document, card, element } = fixture();
  const content = element('section'), canvas = element('canvas');
  card.append(content); content.append(canvas);
  card.setAttribute('id', 'original-card'); card.setAttribute('data-card-id', 'card-7');
  content.setAttribute('id', 'content');
  content.scrollTop = 32; content.scrollLeft = 12;
  card.scrollTop = 4;
  canvas.width = 240; canvas.height = 320; canvas.pixels = 'printed card';
  document.body.style.setProperty('--foil-x', '72%');
  document.body.style.setProperty('--foil-catch', '.81');
  document.body.style.setProperty('--accent', '#abcdef');
  card.style.setProperty('--material-colors', '#123 0%, #abc 100%');
  let prepared = false;
  const copy = snapshotCard(card, { prepareClone(clone, source) {
    assert.equal(source, card);
    assert.equal(clone.children[0].children[0].pixels, 'printed card');
    clone.setAttribute('data-prepared', 'yes'); prepared = true;
  } });
  assert.ok(prepared);
  assert.equal(copy.getAttribute('id'), null); assert.equal(copy.getAttribute('data-card-id'), null);
  assert.equal(copy.children[0].getAttribute('id'), null);
  assert.equal(copy.getAttribute('aria-hidden'), 'true'); assert.equal(copy.inert, true); assert.equal(copy.draggable, false);
  assert.equal(copy.className.includes('rarity-reveal'), false);
  const copiedCanvas = copy.children[0].children[0];
  assert.equal(copiedCanvas.width, 240); assert.equal(copiedCanvas.height, 320);
  assert.equal(copiedCanvas.pixels, 'printed card');
  document.body.append(copy);
  document.body.style.setProperty('--foil-x', '50%');
  await Promise.resolve();
  assert.equal(copy.scrollTop, 4); assert.equal(copy.children[0].scrollTop, 32); assert.equal(copy.children[0].scrollLeft, 12);
  assert.equal(copy.style.getPropertyValue('--foil-x'), '72%');
  assert.equal(copy.style.getPropertyValue('--foil-catch'), '.81');
  assert.equal(copy.style.getPropertyValue('--accent'), '#abcdef');
  assert.equal(copy.style.getPropertyValue('--material-colors'), '#123 0%, #abc 100%');
  assert.equal(card.getAttribute('id'), 'original-card'); assert.equal(card.className.includes('rarity-reveal'), true);
  assert.equal(content.scrollTop, 32); assert.equal(canvas.pixels, 'printed card');
});

test('snapshot also copies a canvas used as the card root', () => {
  const { element } = fixture();
  const canvas = element('canvas'); canvas.pixels = 'root bitmap';
  assert.equal(snapshotCard(canvas).pixels, 'root bitmap');
});

test('drag preview preserves pointer anchor, full-size layout and material, and cleans up once', () => {
  const { document, card } = fixture();
  card.style.setProperty('--foil-x', '72%');
  const result = createCardDragPreview(card, 780, 232, { className: 'custom-preview', faceClassName: 'custom-face' });
  document.body.append(result.preview);
  const face = result.preview.children[0];
  assert.ok(result.preview.className.includes('pack-cards-drag-preview custom-preview'));
  assert.ok(face.className.includes('custom-face'));
  assert.equal(result.width, 190); assert.equal(result.height, 266);
  assert.equal(result.grabX, result.width / 4); assert.equal(result.grabY, result.height / 4);
  assert.equal(face.style.width, '420px'); assert.equal(face.style.height, '588px');
  assert.equal(face.style.transformOrigin, '105px 147px');
  assert.equal(face.animations.length, 1); assert.equal(face.animations[0].options.duration, 140);
  card.style.setProperty('--foil-x', '50%');
  assert.equal(result.preview.style.getPropertyValue('--foil-x'), '72%');
  assert.equal(face.children[0].style.getPropertyValue('--foil-x'), '72%');
  result.dispose(); result.dispose();
  assert.equal(result.preview.parentElement, null); assert.equal(face.animations[0].cancelCalls, 1);
  assert.equal(card.parentElement, document.body);
});

test('reduced motion suppresses pickup rotation and animation; explicit override is supported', () => {
  const { card } = fixture({ reducedMotion: true });
  const reduced = createCardDragPreview(card, 780, 232);
  const face = reduced.preview.children[0];
  assert.equal(face.animations.length, 0); assert.ok(face.style.transform.endsWith('rotate(0deg)'));
  reduced.dispose();
  const animated = createCardDragPreview(card, 780, 232, { reducedMotion: false });
  assert.equal(animated.preview.children[0].animations.length, 1);
  animated.dispose();
});

test('viewport cap, custom width and pointers outside the face produce bounded geometry', () => {
  const { document, card } = fixture();
  document.documentElement.clientHeight = 200;
  const small = createCardDragPreview(card, 650, 800, { maxWidth: 100, viewportPadding: 40 });
  assert.equal(small.height, 120); assert.equal(small.grabX, 0); assert.equal(small.grabY, small.height);
  small.dispose();
  document.documentElement.clientHeight = 900;
  const wide = createCardDragPreview(card, 700, 120, { maxWidth: 300, maxScale: .5 });
  assert.equal(wide.width, 160);
  wide.dispose();
});

test('hidden cards and invalid dimensions fail before creating a broken preview', () => {
  const { card } = fixture();
  for (const options of [{ maxWidth: 0 }, { maxScale: -1 }, { viewportPadding: -1 }]) {
    assert.throws(() => createCardDragPreview(card, 780, 232, options), RangeError);
  }
  assert.throws(() => createCardDragPreview(card, NaN, 232), RangeError);
  card.rect.width = 0;
  assert.throws(() => createCardDragPreview(card, 780, 232), RangeError);
});
