# Optional modules

[Back to the README](../README.md) · [Working examples](../examples/README.md)

Import these entry points only when needed. Collection, editor, snapshots, and
GIF modules are separate from the core and include TypeScript declarations.

| Import | Provides | Styles |
| --- | --- | --- |
| `pack-cards/collection` | Viewed-card piles and dealing animations | `pack-cards/styles.css` |
| `pack-cards/editor` | Appearance and rarity controls | `pack-cards/editor.css` |
| `pack-cards/snapshots` | Visual card copies and drag previews | Core CSS; add `pack-cards/snapshots.css` for previews |
| `pack-cards/gif` | Synchronous RGBA-to-GIF encoding | None |
| `pack-cards/gif-worker.js` | Dedicated GIF worker entry | None |

## Viewed-card piles

Use `createCardPile` with your container, collection size, and navigation
callback:

```js
import {createPackCards} from 'pack-cards';
import {createCardPile} from 'pack-cards/collection';

const cards = createPackCards();
const artwork = {accent: '#9dd8dc', tint: '#20363c'};

function mountViewedPile(container, count, onPrevious) {
  const pile = createCardPile({
    count,
    renderBack: () => cards.renderBack('Field notes', artwork),
    onPrevious,
    previousLabel: position => `Review card ${position}`,
  });
  container.append(pile.element);
  return pile;
}
```

Call `pile.update(position, seen)` after navigation, where `position` is the
number of viewed cards and `seen` is a `Map<cardIndex, {width, height}>` of their
measured sizes. Reuse `pile.placements` when restoring a collection to preserve
the pile's layout.

`pile.animate({container, direction, face, bounds, origin, ...})` animates a deal:
for forward navigation, capture a snapshot and its bounds before replacing the
old card; for backward navigation, capture the old pile bounds as `origin` and
use a snapshot of the newly mounted face with its bounds. Both directions take
a disposable copy: the animation removes that copy on completion. Update the
pile before starting the animation.
The return value is a cancellation function, or `null` when motion is skipped.
`pile.dispose()` cancels animation and removes the pile. Your app retains card
order and navigation. See [`collection.d.ts`](../collection.d.ts) for geometry,
focus, and lifetime options.

## Appearance editor

Given a container `settingsHost` and your `updatePreview` callback:

```js
import {createAppearanceSettings} from 'pack-cards';
import {createAppearanceEditor} from 'pack-cards/editor';
import 'pack-cards/editor.css';

const editor = createAppearanceEditor(settingsHost, {
  initial: createAppearanceSettings({motion: 'interactive'}),
  labels: {target: 'Appearance to edit', reset: 'Reset'},
  onChange: (settings, target) => updatePreview(settings, target),
});
```

The editor covers material choices, rarity profiles, reset rules, motion,
opening, glow, and zoom. `onChange` supplies an independent normalized settings
object. Read `editor.getSettings()` when saving; `editor.setSettings(value)`
replaces settings without emitting a change. Call `editor.dispose()` on unmount.
Your app provides persistence and preview content.

Labels support partial nested overrides. `showSettings: false` hides the global
pack controls; `sharedControls` can instead bind existing select/checkbox
controls. See [`editor.d.ts`](../editor.d.ts).

## Snapshots and drag previews

`snapshotCard(face, {prepareClone?})` copies the card's canvas pixels, material
variables, and scroll position into an inert, hidden-from-accessibility clone.
It strips duplicate IDs and does not copy event listeners. Insert the returned
node synchronously so its scroll position can be restored after attachment.

In your pointer handler, with the visible card as `face` and pointer event as
`event`:

```js
import {createCardDragPreview} from 'pack-cards/snapshots';
import 'pack-cards/snapshots.css';

const drag = createCardDragPreview(face, event.clientX, event.clientY);
document.body.append(drag.preview);
drag.preview.style.transform =
  `translate(${event.clientX - drag.grabX}px, ${event.clientY - drag.grabY}px)`;
// Update this position as the pointer moves; call drag.dispose() on drop/cancel.
```

The helper owns appearance, sizing, pickup animation, and cleanup. Your app owns
pointer tracking and drop behavior. Options include `maxWidth`, `maxScale`,
`reducedMotion`, and a `prepareClone` hook; see
[`snapshots.d.ts`](../snapshots.d.ts).

## Canvas rendering

The root module and `pack-cards/export-material` export `createExportCard`,
`drawExportStock`, and `drawExportMaterial`. They use a **1080 × 1440** coordinate
system. Resolve the appearance once and share it with the displayed card when
the export should match that card:

```js
import {createAppearanceSettings, resolveAppearance, createExportCard} from 'pack-cards';

const artwork = {accent: '#9dd8dc', tint: '#20363c'};
const settings = createAppearanceSettings();
const appearance = resolveAppearance(settings, artwork, 'compass', 'rare');
const canvas = document.createElement('canvas');
canvas.width = 1080;
canvas.height = 1440;
const frame = createExportCard(canvas, artwork, {
  appearance, heading: 'FIELD NOTES', footer: 'A fictional collection',
});
frame.ctx.fillStyle = frame.ink;
frame.ctx.font = '64px sans-serif';
frame.ctx.fillText('The Compass', frame.left, frame.top + 80, frame.width);
```

The returned frame includes `ctx`, `accent`, `ink`, `left`, `width`, `top`, and
`bottom` for drawing your own content. This draws materials and a print frame;
it does not capture arbitrary DOM. Use canvas APIs to encode or download the
result. See [`export-material.d.ts`](../export-material.d.ts).

## GIF encoding

Given a canvas `ctx` containing a composed frame:

```js
import {createGifEncoder} from 'pack-cards/gif';

const gif = createGifEncoder({repeat: 0}); // Loop forever; -1 disables looping.
const {width, height} = ctx.canvas;
const pixels = ctx.getImageData(0, 0, width, height).data;
gif.writeFrame({pixels, width, height, delay: 1500});
// Draw and write more frames before finishing.
const bytes = gif.finish(); // Uint8Array
```

Frames accept RGBA data as `Uint8Array`, `Uint8ClampedArray`, or `ArrayBuffer`
and must have identical dimensions. Alpha below 128 is transparent. Delays are
milliseconds, rounded to GIF's 10 ms precision. Input buffers are not mutated.
Encoding is synchronous and works in Node as well as the browser; see
[`gif.d.ts`](../gif.d.ts).

For browser work off the main thread, serve `gif-worker.js` with `gif.js` and
`vendor/gifenc/` at their relative paths, or bundle it as a module worker entry.
The worker sends `{ready: true}` initially and after each accepted frame.
Send frames in the format above, then `{finish: true}` to receive `{bytes}`;
errors return `{error: true}`. Create a new worker per export and terminate it
on completion or cancellation. The worker loops GIFs forever. Your app composes
the frames, captions, and download UI.
