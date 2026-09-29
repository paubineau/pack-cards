// A recording composition of the real library, using the example's fictional faces.
import {createPackCards, createAppearanceSettings, resolveAppearances} from '../index.js';
import {createCardPile} from '../collection.js';
import {snapshotCard} from '../snapshots.js';
import {cards, artwork, createFace} from '../examples/shared.js';

const stage = document.getElementById('showcase-stage');
const pileHost = document.getElementById('showcase-pile');
const order = [2, 3, 5]; // The Orbit, The Prism, and the legendary Sun.
const settings = createAppearanceSettings({
  opening: 'animated', motion: 'interactive', pack_zoom: true, glow: 'gold',
  rarities: {legendary: {engraving: 'radial', foil: 'holographic', palette: 'amber'}},
});
const presentation = createPackCards({labels: {title: 'FIELD NOTES'}});
const appearances = resolveAppearances(settings, artwork,
  order.map(index => ({identity: cards[index].id, rarity: cards[index].rarity})), 'showcase');
presentation.applyPalette(stage, artwork);
presentation.applyPalette(pileHost, artwork);
const pile = createCardPile({
  count: order.length,
  placements: [{rotation: -9, x: -5, y: 0}, {rotation: 8, x: 5, y: -3}, {rotation: 0, x: 0, y: 0}],
  renderBack: () => presentation.renderBack('Field notes', artwork),
  onPrevious: () => showCard(position - 1),
});
pileHost.replaceChildren(pile.element);
const seen = new Map();
let position = -1, face = null, disposed = false;
let disposeCurrent = () => {};
let cancelDeal = null;

function showCard(index, arrival = null) {
  if (disposed || index < 0 || index >= order.length) return;
  cancelDeal?.();
  cancelDeal = null;
  const previous = position;
  const direction = previous > index ? -1 : 1;
  const outgoingBounds = face?.getBoundingClientRect();
  const outgoing = previous >= 0 && direction > 0 ? snapshotCard(face) : null;
  const origin = pile.visual.getBoundingClientRect();
  if (outgoingBounds) seen.set(previous, {width: outgoingBounds.width, height: outgoingBounds.height});
  const oldDispose = disposeCurrent;
  if (!arrival) oldDispose();
  face = createFace(order[index]);
  face.dataset.rarity = cards[order[index]].rarity;
  const mounted = presentation.mountCard(face, {
    label: 'Field notes', remaining: order.length - index - 1, artwork,
    appearance: appearances[index], backwards: direction < 0, arrival,
    onNavigate: step => showCard(position + step),
  });
  // Claim the opening flight before releasing its pack controller.
  if (arrival) oldDispose();
  stage.replaceChildren(mounted.stage);
  disposeCurrent = mounted.dispose;
  position = index;
  const bounds = face.getBoundingClientRect();
  seen.set(index, {width: bounds.width, height: bounds.height});
  pile.update(index, seen);
  if (previous >= 0) {
    cancelDeal = pile.animate({
      container: document.body, direction,
      face: direction > 0 ? outgoing : snapshotCard(face),
      bounds: direction > 0 ? outgoingBounds : bounds, origin,
      turn: mounted.stage.querySelector('.recap-card-turn'),
      deck: mounted.stage.querySelector('.recap-deck'),
    });
  }
  document.body.dataset.card = cards[order[index]].id;
  document.body.dataset.cardName = cards[order[index]].name;
}

disposeCurrent = presentation.mountPack(stage, {
  label: 'Field notes', title: 'FIELD NOTES', count: order.length, packCount: 1,
  artwork, appearance: settings, autoRevealFirst: true, focus: false,
  isActive: () => !disposed,
  async onOpen(arrival) {
    await Promise.resolve();
    if (!disposed) showCard(0, arrival);
  },
});
window.addEventListener('pagehide', () => {
  disposed = true;
  cancelDeal?.();
  disposeCurrent();
  pile.dispose();
});
