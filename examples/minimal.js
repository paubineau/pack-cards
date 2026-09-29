import { createPackView } from '../index.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const template = document.getElementById('card-face');
const open = document.getElementById('open');
const artwork = { accent: '#a8dbcb', tint: '#213b38' };
let view = createView();

function createView() {
  return createPackView(stage, {
    label: 'Field notes', artwork,
    appearance: { opening: 'animated' }, // Try 'instant'.
  });
}

function restart() {
  open.disabled = false;
  status.textContent = 'Your pack is ready. Open it to discover a card.';
  view.showPack({
    count: 1,
    onOpening: () => { open.disabled = true; status.textContent = 'Opening your pack…'; },
    renderCard: () => ({
      face: template.content.firstElementChild.cloneNode(true),
      identity: 'orbit', rarity: 'rare',
    }),
    onReveal: () => {
      status.textContent = 'The Orbit revealed. Move over the card to explore its material.';
    },
    onError: () => { status.textContent = 'The card could not be shown. Restart to try again.'; },
  });
}

open.addEventListener('click', () => view.open());
document.getElementById('restart').addEventListener('click', restart);
window.addEventListener('pagehide', () => view.dispose());
window.addEventListener('pageshow', event => {
  if (event.persisted) { view = createView(); restart(); }
});
restart();
