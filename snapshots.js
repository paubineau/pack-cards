const materialProperties = ['--foil-x', '--foil-y', '--foil-angle', '--foil-catch', '--foil-channel-colors',
  '--foil-colors', '--foil-strength', '--foil-glare-strength', '--foil-gloss', '--material-colors', '--accent', '--recap-tint'];

function viewFor(node) {
  return node.ownerDocument?.defaultView || globalThis.window;
}

function copyMaterial(source, target) {
  const material = viewFor(source)?.getComputedStyle(source);
  if (!material) return;
  for (const key of materialProperties) {
    const value = material.getPropertyValue(key);
    if (value) target.style.setProperty(key, value);
  }
}

/** Create a visual, non-interactive copy without attaching another material controller. */
export function snapshotCard(card, { prepareClone } = {}) {
  const copy = card.cloneNode(true);
  const scroll = [];
  function preserve(source, target) {
    target.removeAttribute('id');
    target.removeAttribute('data-card-id');
    target.draggable = false;
    if ((source.tagName || source.tag)?.toLowerCase() === 'canvas') {
      target.width = source.width;
      target.height = source.height;
      target.getContext('2d')?.drawImage(source, 0, 0);
    }
    if (source.scrollTop || source.scrollLeft) {
      scroll.push([target, source.scrollTop || 0, source.scrollLeft || 0]);
    }
    const sources = [...source.children].filter(node => typeof node.cloneNode === 'function');
    const targets = [...target.children].filter(node => typeof node.cloneNode === 'function');
    sources.forEach((node, index) => preserve(node, targets[index]));
  }
  preserve(card, copy);
  copy.classList.remove('rarity-reveal');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  copyMaterial(card, copy);
  prepareClone?.(copy, card);
  const restoreScroll = () => {
    for (const [node, top, left] of scroll) {
      node.scrollTop = top;
      node.scrollLeft = left;
    }
  };
  restoreScroll();
  // Detached elements have no scroll box. Apply again after a synchronous mount.
  Promise.resolve().then(restoreScroll);
  return copy;
}

/** Build a pointer-anchored card face. The caller places it and owns drag/drop events. */
export function createCardDragPreview(card, clientX, clientY, options = {}) {
  const doc = card.ownerDocument;
  const view = viewFor(card);
  const { maxWidth = 190, maxScale = .9, viewportPadding = 16,
    className = '', faceClassName = '', prepareClone,
    reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false } = options;
  const bounds = card.getBoundingClientRect();
  const width = card.offsetWidth || bounds.width;
  const height = card.offsetHeight || bounds.height;
  if (![width, height, bounds.width, bounds.height, maxWidth, maxScale].every(value => Number.isFinite(value) && value > 0)
    || ![clientX, clientY, viewportPadding].every(Number.isFinite) || viewportPadding < 0) {
    throw new RangeError('Drag previews require a visible card, finite pointer coordinates and positive dimensions.');
  }
  const scale = Math.min(1, maxWidth / width, bounds.width * maxScale / width,
    Math.max(1, doc.documentElement.clientHeight - viewportPadding * 2) / height);
  const anchorX = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * width;
  const anchorY = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)) * height;
  const preview = doc.createElement('div');
  preview.className = ['pack-cards-drag-preview', className].filter(Boolean).join(' ');
  preview.setAttribute('aria-hidden', 'true');
  preview.inert = true;
  copyMaterial(card, preview);
  preview.style.width = width * scale + 'px';
  preview.style.height = height * scale + 'px';
  const face = doc.createElement('div');
  face.className = ['recap-card-turn pack-cards-drag-face', faceClassName].filter(Boolean).join(' ');
  face.style.width = width + 'px';
  face.style.height = height + 'px';
  face.style.left = anchorX * (scale - 1) + 'px';
  face.style.top = anchorY * (scale - 1) + 'px';
  face.style.transformOrigin = `${anchorX}px ${anchorY}px`;
  const transform = `scale(${scale}) rotate(${reducedMotion ? 0 : -3}deg)`;
  face.style.transform = transform;
  face.append(snapshotCard(card, { prepareClone }));
  preview.append(face);
  const animation = !reducedMotion && face.animate?.([
    { transform: `scale(${bounds.width / width}) rotate(0deg)` }, { transform }
  ], { duration: 140, easing: 'cubic-bezier(.2,.7,.3,1)' });
  let disposed = false;
  return {
    preview, width: width * scale, height: height * scale, grabX: anchorX * scale, grabY: anchorY * scale,
    dispose() {
      if (disposed) return;
      disposed = true;
      animation?.cancel?.();
      preview.remove();
    }
  };
}
