// Fictional content belongs to the example, not to the library.
export const cards = [
  {id: 'seed', rarity: 'common', name: 'The Seed', symbol: '✧', description: 'Every collection begins with a little possibility.'},
  {id: 'compass', rarity: 'uncommon', name: 'The Compass', symbol: '⌖', description: 'For the routes that have not been drawn yet.'},
  {id: 'orbit', rarity: 'rare', name: 'The Orbit', symbol: '◎', description: 'Some things are better discovered in motion.'},
  {id: 'prism', rarity: 'super_rare', name: 'The Prism', symbol: '◇', description: 'One point of view. A whole spectrum of possibilities.'},
  {id: 'moon', rarity: 'epic', name: 'The Moon', symbol: '☽', description: 'A small reminder to look a little closer.'},
  {id: 'sun', rarity: 'legendary', name: 'The Sun', symbol: '✺', description: 'Keep a little of the extraordinary with you.'},
];
export const artwork = {accent: '#a8dbcb', tint: '#213b38'};

export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function createFace(index) {
  const data = cards[index];
  const face = node('article', null, 'recap-card recap-collectible demo-card');
  face.setAttribute('aria-label', data.name);
  face.tabIndex = -1;
  const header = node('header', null, 'recap-card-header');
  header.append(node('span', 'FIELD NOTES'), node('span', data.rarity.replaceAll('_', ' ')));
  const content = node('div', null, 'recap-card-content');
  const symbol = node('span', data.symbol, 'demo-symbol');
  symbol.setAttribute('aria-hidden', 'true');
  const heading = node('h2', data.name);
  heading.setAttribute('data-foil-text', '');
  content.append(symbol, heading, node('p', data.description));
  const footer = node('footer', null, 'recap-card-footer');
  footer.append(node('span', 'An imagined collection'), node('span', `${String(index + 1).padStart(2, '0')} / 06`));
  face.append(header, content, footer);
  return face;
}
