import { createPackCards, normalizeAppearance, resolveAppearance } from '../index.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const template = document.getElementById('card-face');
const open = document.getElementById('open');
const presentation = createPackCards();
const artwork = { accent: '#a8dbcb', tint: '#213b38' };
const settings = normalizeAppearance(); // Try settings.opening = 'instant'.
const appearance = resolveAppearance(settings, artwork, 'orbit', 'rare');
let dispose = () => {};
let generation = 0;

function clear() {
  generation += 1; // Ignore a queued callback from an earlier opening.
  dispose();
  dispose = () => {};
}

function restart() {
  clear();
  const current = generation;
  stage.replaceChildren();
  presentation.applyPalette(stage, artwork);
  open.disabled = false;
  status.textContent = 'Your pack is ready. Open it to discover a card.';
  dispose = presentation.mountPack(stage, {
    label: 'Field notes', count: 1, artwork, appearance: settings,
    autoRevealFirst: true, focus: false,
    isActive: () => current === generation,
    onOpening: () => { open.disabled = true; status.textContent = 'Opening your pack…'; },
    // Instant opening calls onOpen before mountPack returns. Deferring lets us
    // retain the pack disposer and also handles the animated arrival correctly.
    onOpen: arrival => Promise.resolve().then(() => {
      if (current !== generation) return;
      const focusCard = stage.contains(document.activeElement);
      const face = template.content.firstElementChild.cloneNode(true);
      const card = presentation.mountCard(face, {
        label: 'Field notes', artwork, appearance, arrival,
      });
      dispose(); // mountCard claims the arrival before releasing the pack.
      stage.replaceChildren(card.stage);
      dispose = card.dispose;
      if (focusCard) face.focus({ preventScroll: true });
      status.textContent = 'The Orbit revealed. Move over the card to explore its material.';
    }),
  });
}

open.addEventListener('click', () => dispose.open?.());
document.getElementById('restart').addEventListener('click', restart);
window.addEventListener('pagehide', clear);
window.addEventListener('pageshow', event => { if (event.persisted) restart(); });
restart();
