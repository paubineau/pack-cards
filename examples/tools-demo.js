import {createPackCards, normalizeAppearance, resolveAppearance} from '../index.js';
import {snapshotCard, createCardDragPreview} from '../snapshots.js';
import {artwork, cards, createFace} from './shared.js';

const source = document.getElementById('snapshot-source');
const tray = document.getElementById('snapshot-copy');
const capture = document.getElementById('snapshot-capture');
const handle = document.getElementById('drag-handle');
const dropZone = document.getElementById('drop-zone');
const status = document.getElementById('snapshot-status');
const presentation = createPackCards();
const index = 4;
const data = cards[index];
const appearance = resolveAppearance(normalizeAppearance(), artwork, data.id, data.rarity);
presentation.applyPalette(source, artwork);
presentation.applyPalette(tray, artwork);
let face = null;
let mounted = null;
let drag = null;

function mountSource() {
  if (mounted) return;
  face = createFace(index);
  mounted = presentation.mountCard(face, {label: 'Field notes', artwork, appearance});
  source.replaceChildren(mounted.stage);
}

function copyToTray() {
  if (!mounted) return;
  // The clone keeps canvas pixels and the current foil lighting without a second controller.
  tray.replaceChildren(snapshotCard(face));
  status.textContent = `${data.name} copied to the tray. Move over the original to compare its live reflection.`;
}

function isOverTray(event) {
  const bounds = dropZone.getBoundingClientRect();
  return event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
}

function movePreview(event) {
  drag.preview.style.transform =
    `translate(${event.clientX - drag.grabX}px, ${event.clientY - drag.grabY}px)`;
  dropZone.classList.toggle('is-over', isOverTray(event));
}

function endDrag() {
  if (!drag) return;
  const previous = drag;
  drag = null;
  previous.dispose();
  if (handle.hasPointerCapture(previous.pointerId)) handle.releasePointerCapture(previous.pointerId);
  dropZone.classList.remove('is-dragging', 'is-over');
}

capture.addEventListener('click', copyToTray);
// The separate handle leaves card tilt and navigation gestures available on the source.
handle.style.touchAction = 'none';
handle.addEventListener('pointerdown', event => {
  if (!mounted || !event.isPrimary || event.button !== 0 || drag) return;
  event.preventDefault();
  // The helper respects prefers-reduced-motion unless explicitly overridden.
  drag = {...createCardDragPreview(face, event.clientX, event.clientY), pointerId: event.pointerId};
  document.body.append(drag.preview);
  handle.setPointerCapture(event.pointerId);
  dropZone.classList.add('is-dragging');
  movePreview(event);
  status.textContent = 'Drag into the tray and release. Press Escape to cancel.';
});
handle.addEventListener('pointermove', event => {
  if (drag?.pointerId === event.pointerId) movePreview(event);
});
handle.addEventListener('pointerup', event => {
  if (drag?.pointerId !== event.pointerId) return;
  const dropped = isOverTray(event);
  endDrag();
  if (dropped) copyToTray();
  else status.textContent = 'Drag cancelled. The original card stays in place.';
});
for (const type of ['pointercancel', 'lostpointercapture']) {
  handle.addEventListener(type, event => {
    if (drag?.pointerId !== event.pointerId) return;
    endDrag();
    status.textContent = 'Drag cancelled. Use Copy to tray to make a snapshot.';
  });
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !drag) return;
  endDrag();
  status.textContent = 'Drag cancelled. The original card stays in place.';
});
window.addEventListener('pagehide', () => {
  endDrag();
  mounted?.dispose();
  mounted = null;
  face = null;
});
// The page keeps its controls in the back/forward cache; remount only the card controller.
window.addEventListener('pageshow', event => { if (event.persisted) mountSource(); });
mountSource();
