import { createPackCards, normalizeAppearance, resolveAppearance } from '../index.js';
import { createAppearanceEditor } from '../editor.js';
import { cards, artwork, createFace, node } from './shared.js';

const stage = document.getElementById('material-stage');
const controls = document.getElementById('editor-controls');
const status = document.getElementById('material-status');
const output = document.getElementById('editor-settings');
const rarity = document.getElementById('material-rarity');
const reset = document.getElementById('material-reset');
const presentation = createPackCards();
const labels = { card: 'Ordinary / unclassified' };

for (const card of cards) {
  const name = card.rarity.replaceAll('_', ' ');
  labels[card.rarity] = name[0].toUpperCase() + name.slice(1);
}
for (const [value, label] of Object.entries(labels)) {
  const option = node('option', label);
  option.value = value;
  rarity.append(option);
}

let settings = normalizeAppearance();
let target = 'rare';
let editor = null;
let mounted = null;

function renderPreview() {
  const focused = document.activeElement;
  const index = Math.max(0, cards.findIndex(card => card.rarity === target));
  const data = cards[index];
  const face = createFace(index);
  if (target === 'card') {
    // The ordinary profile applies when the consumer supplies no known rarity.
    face.querySelector('.recap-card-header').lastElementChild.textContent = 'ORDINARY';
  }
  const appearance = resolveAppearance(settings, artwork, data.id, target === 'card' ? null : target);
  mounted?.dispose();
  mounted = presentation.mountCard(face, { label: 'Field notes', artwork, appearance });
  stage.replaceChildren(mounted.stage);
  rarity.value = target;

  status.textContent = `${labels[target]}: ${appearance.stock} stock, ${appearance.coating} coating, ` +
    `${appearance.foil} foil, ${appearance.coverage} coverage, ${appearance.pattern} pattern. ` +
    (appearance.motion === 'still' ? 'Fixed lighting is selected.' :
      'Move your pointer over the card to explore the surface; reduced motion is respected.');
  output.textContent = JSON.stringify({ target, resolvedAppearance: appearance, settings }, null, 2);
  // Updating a preview must not take keyboard focus from the editor controls.
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

function selectTarget(value) {
  if (!editor) return;
  // The editor exposes its controls publicly; its change event also refreshes
  // component availability and emits the normalized settings to onChange.
  editor.controls.target.value = value;
  editor.controls.target.dispatchEvent(new Event('change', { bubbles: true }));
}

function start() {
  if (editor) return;
  presentation.applyPalette(stage, artwork);
  editor = createAppearanceEditor(controls, {
    initial: settings,
    idPrefix: 'materials-editor',
    labels: { card: labels.card },
    onChange(value, selectedTarget) {
      settings = value;
      target = selectedTarget;
      renderPreview();
    }
  });
  selectTarget(target);
}

rarity.addEventListener('change', () => selectTarget(rarity.value));
reset.addEventListener('click', () => {
  if (!editor) return;
  settings = normalizeAppearance();
  editor.setSettings(settings);
  renderPreview();
});

window.addEventListener('pagehide', () => {
  mounted?.dispose();
  mounted = null;
  editor?.dispose();
  editor = null;
});
// A page restored from the back/forward cache keeps its edits, but must mount
// fresh controllers after pagehide released their event listeners.
window.addEventListener('pageshow', event => { if (event.persisted) start(); });
start();
