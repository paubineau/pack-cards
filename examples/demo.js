import { createPackCards, normalizeAppearance, resolveAppearances } from '../index.js';

const elements = Object.fromEntries(
  ['stage', 'motion', 'opening', 'zoom', 'open', 'reset', 'navigation', 'previous', 'next', 'position', 'status']
    .map(id => [id, document.getElementById(id)])
);
const cards = [
  { id: 'seed', rarity: 'common', name: 'The Seed', symbol: '✧', description: 'Quiet beginnings, printed on matte paper.' },
  { id: 'compass', rarity: 'uncommon', name: 'The Compass', symbol: '⌖', description: 'A smooth metallic reflection points the way.' },
  { id: 'orbit', rarity: 'rare', name: 'The Orbit', symbol: '◎', description: 'Fine texture catches the light as the card moves.' },
  { id: 'prism', rarity: 'super_rare', name: 'The Prism', symbol: '◇', description: 'Holographic foil shifts through a family of colours.' },
  { id: 'moon', rarity: 'epic', name: 'The Moon', symbol: '☽', description: 'A pearlescent coating adds a broad, soft sheen.' },
  { id: 'sun', rarity: 'legendary', name: 'The Sun', symbol: '✺', description: 'Engraved linework and reflective print finish the collection.' }
];
const artwork = { accent: '#9dd8dc', tint: '#20363c' };
const collection = createPackCards();
collection.applyPalette(elements.stage, artwork);
let disposeCurrent = () => {};
let appearances = [];
let settings;
let position = -1;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderCard(index, arrival = null) {
  if (index < 0 || index >= cards.length) return;
  disposeCurrent();
  const backwards = position > index;
  position = index;
  const data = cards[index];
  const card = node('article', undefined, 'recap-card recap-collectible demo-card');
  card.setAttribute('aria-label', data.name);
  const header = node('header', undefined, 'recap-card-header');
  header.append(node('span', 'FIELD NOTES'), node('span', data.rarity.replaceAll('_', ' ').toUpperCase()));
  const content = node('div', undefined, 'recap-card-content');
  const symbol = node('span', data.symbol, 'demo-symbol');
  symbol.setAttribute('aria-hidden', 'true');
  const heading = node('h2', data.name);
  heading.setAttribute('data-foil-text', '');
  content.append(symbol, heading, node('p', data.description));
  const footer = node('footer', undefined, 'recap-card-footer');
  footer.append(node('span', 'A fictional collection'), node('span', `${index + 1} / ${cards.length}`));
  card.append(header, content, footer);
  const mounted = collection.mountCard(card, {
    label: 'Field notes', remaining: cards.length - index - 1, artwork,
    appearance: appearances[index], backwards, arrival,
    onNavigate: direction => renderCard(position + direction)
  });
  elements.stage.replaceChildren(mounted.stage);
  disposeCurrent = mounted.dispose;
  elements.navigation.hidden = false;
  elements.previous.disabled = index === 0;
  elements.next.disabled = index === cards.length - 1;
  elements.position.textContent = `${index + 1} / ${cards.length}`;
  elements.open.disabled = true;
  const material = appearances[index];
  elements.status.textContent = `${data.name}: ${material.stock}, ${material.coating}, ${material.foil} foil, ${material.pattern} pattern.`;
}

function reset() {
  disposeCurrent();
  disposeCurrent = () => {};
  position = -1;
  settings = normalizeAppearance();
  settings.motion = elements.motion.value;
  settings.opening = elements.opening.value;
  settings.pack_zoom = elements.zoom.value === 'true';
  appearances = resolveAppearances(settings, artwork,
    cards.map(card => ({ identity: card.id, rarity: card.rarity })), 'field-notes');
  elements.navigation.hidden = true;
  elements.open.disabled = false;
  elements.status.textContent = 'Your collection is ready to open.';
  let opened = false;
  const pack = collection.mountPack(elements.stage, {
    label: 'Field notes', title: 'A small collection', count: cards.length,
    artwork, appearance: settings, autoRevealFirst: true, focus: false,
    onOpening: () => {
      elements.open.disabled = true;
      elements.status.textContent = 'Opening your collection…';
    },
    onOpen: arrival => { opened = true; renderCard(0, arrival); }
  });
  // Instant opening may mount the first card before mountPack returns.
  if (opened) pack();
  else disposeCurrent = pack;
}

elements.open.addEventListener('click', () => disposeCurrent.open?.());
elements.reset.addEventListener('click', reset);
elements.previous.addEventListener('click', () => renderCard(position - 1));
elements.next.addEventListener('click', () => renderCard(position + 1));
for (const select of [elements.motion, elements.opening, elements.zoom]) select.addEventListener('change', reset);
window.addEventListener('pagehide', () => disposeCurrent());
reset();
