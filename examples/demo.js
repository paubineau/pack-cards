import {createPackCards, normalizeAppearance, resolveAppearances} from '../index.js';
import {createCardPile} from '../collection.js';
import {snapshotCard} from '../snapshots.js';
import {cards, artwork, createFace, node} from './shared.js';

const elements = Object.fromEntries([
  'stage', 'motion', 'opening', 'zoom', 'pack-count', 'glow', 'reveal', 'mystery',
  'renderer-mode', 'open', 'reset', 'navigation', 'previous', 'next', 'position',
  'status', 'pile-slot', 'pile-caption', 'events', 'pack-config', 'motion-note',
].map(id => [id, document.getElementById(id)]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let presentation, settings, appearances, pile, face;
let disposeCurrent = () => {};
let cancelDeal = null;
let position = -1;
let generation = 0;
const seen = new Map();

function log(message) {
  elements.events.append(node('li', message));
  while (elements.events.children.length > 6) elements.events.firstElementChild.remove();
}

function showCard(index, arrival = null) {
  if (index < 0 || index >= cards.length) return;
  cancelDeal?.();
  cancelDeal = null;
  const focusCard = elements.stage.contains(document.activeElement) || pile.element.contains(document.activeElement);
  const previous = position;
  const direction = previous > index ? -1 : 1;
  const outgoingBounds = face?.getBoundingClientRect();
  const outgoing = previous >= 0 && direction > 0 ? snapshotCard(face) : null;
  const origin = pile.visual.getBoundingClientRect();
  if (outgoingBounds) seen.set(previous, {width: outgoingBounds.width, height: outgoingBounds.height});
  const oldDispose = disposeCurrent;
  // An arrival must be claimed by mountCard before the pack is disposed.
  // Ordinary card navigation disposes the old controller before mounting.
  if (!arrival) oldDispose();
  face = createFace(index);
  const mounted = presentation.mountCard(face, {
    label: 'Field notes', remaining: cards.length - index - 1, artwork,
    appearance: appearances[index], backwards: direction < 0, arrival,
    onNavigate: step => showCard(position + step),
  });
  if (arrival) oldDispose();
  elements.stage.replaceChildren(mounted.stage);
  disposeCurrent = mounted.dispose;
  if (focusCard) face.focus({preventScroll: true});
  position = index;
  const bounds = face.getBoundingClientRect();
  seen.set(index, {width: bounds.width, height: bounds.height});
  pile.update(index, seen);
  // The consumer supplies a disposable face; the pile owns only the animation.
  if (previous >= 0 && settings.motion !== 'still') {
    cancelDeal = pile.animate({
      container: document.body, direction,
      face: direction > 0 ? outgoing : snapshotCard(face),
      bounds: direction > 0 ? outgoingBounds : bounds, origin,
      turn: mounted.stage.querySelector('.recap-card-turn'),
      deck: mounted.stage.querySelector('.recap-deck'),
    });
  }
  elements.navigation.hidden = false;
  elements.previous.disabled = index === 0;
  elements.next.disabled = index === cards.length - 1;
  elements.position.textContent = `${index + 1} / ${cards.length}`;
  elements.open.disabled = true;
  elements['pile-caption'].textContent = index
    ? `${index} viewed ${index === 1 ? 'card' : 'cards'}. Click the pile to go back.`
    : 'Your viewed cards will collect here.';
  const material = appearances[index];
  elements.status.textContent = `${cards[index].name} · ${cards[index].rarity.replaceAll('_', ' ')} · ${material.coating} / ${material.foil} foil`;
  log(`card ${index + 1} / ${cards.length} · ${cards[index].name}`);
}

function stop() {
  generation++;
  cancelDeal?.();
  cancelDeal = null;
  disposeCurrent();
  disposeCurrent = () => {};
  pile?.dispose();
  pile = null;
  face = null;
}

function reset() {
  stop();
  const current = generation;
  position = -1;
  seen.clear();
  elements.events.replaceChildren();
  settings = normalizeAppearance({
    version: 5, motion: elements.motion.value, opening: elements.opening.value,
    pack_zoom: elements.zoom.value === 'true', glow: elements.glow.value,
  });
  presentation = createPackCards({
    labels: {title: 'FIELD NOTES', personalHeading: 'A little discovery awaits.', mysteryHeading: 'Who is this pack for?'},
    ...(elements['renderer-mode'].value === 'fallback' ? {
      loadRenderer: () => {
        log('renderer unavailable → ordinary opening');
        return Promise.reject(new Error('Example: optional renderer unavailable'));
      },
    } : {}),
  });
  presentation.applyPalette(elements.stage, artwork);
  presentation.applyPalette(elements['pile-slot'], artwork);
  appearances = resolveAppearances(settings, artwork,
    cards.map(card => ({identity: card.id, rarity: card.rarity})), 'field-notes');
  pile = createCardPile({
    count: cards.length,
    renderBack: () => presentation.renderBack('Field notes', artwork),
    onPrevious: () => showCard(position - 1),
  });
  elements['pile-slot'].replaceChildren(pile.element);
  elements.navigation.hidden = true;
  elements.open.disabled = false;
  elements.status.textContent = 'Tear the wrapper, or select Open pack.';
  elements['pile-caption'].textContent = 'Your viewed cards will collect here.';
  const options = {
    label: 'Field notes', recipient: 'Explorer', title: 'FIELD NOTES', count: cards.length,
    packCount: Number(elements['pack-count'].value), artwork, appearance: settings,
    mystery: elements.mystery.checked, autoRevealFirst: elements.reveal.value === 'auto',
    focus: false, isActive: () => generation === current,
    onInteract: () => log('onInteract · tear started'),
    onRest: () => log('onRest · wrapper settled'),
    onOpening: () => {
      elements.open.disabled = true;
      elements.status.textContent = elements.reveal.value === 'auto'
        ? 'Opening your collection…'
        : 'Opening… then select the card back to reveal the first card.';
      log('onOpening · opening committed');
    },
    async onOpen(arrival) {
      // Instant opening invokes this before mountPack returns its disposer.
      await Promise.resolve();
      if (generation !== current) return;
      log('onOpen · first card revealed');
      showCard(0, arrival);
    },
  };
  elements['pack-config'].textContent = JSON.stringify({
    count: options.count, packCount: options.packCount, mystery: options.mystery,
    autoRevealFirst: options.autoRevealFirst, appearance: {
      version: settings.version, opening: settings.opening, motion: settings.motion,
      pack_zoom: settings.pack_zoom, glow: settings.glow,
    },
  }, null, 2);
  log('mountPack · ready');
  disposeCurrent = presentation.mountPack(elements.stage, options);
}

function reportMotion() {
  elements['motion-note'].textContent = reducedMotion.matches ? 'Reduced motion is active' : 'Respects reduced motion';
}
elements.open.addEventListener('click', () => disposeCurrent.open?.());
elements.reset.addEventListener('click', reset);
elements.previous.addEventListener('click', () => showCard(position - 1));
elements.next.addEventListener('click', () => showCard(position + 1));
for (const id of ['motion', 'opening', 'zoom', 'pack-count', 'glow', 'reveal', 'mystery', 'renderer-mode']) {
  elements[id].addEventListener('change', reset);
}
reducedMotion.addEventListener('change', reportMotion);
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
reportMotion();
reset();
