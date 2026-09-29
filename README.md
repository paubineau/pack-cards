# Pack Cards

A JavaScript library for collectible cards and interactive pack opening. Supply
card content as DOM elements, choose the materials, and mount the result in your
app. Works with plain JavaScript or alongside a UI framework; TypeScript
declarations are included.

- **Packs:** animated WebGL tearing, skip and instant opening, mystery packs,
  wrapper stacks, and a continuous transition into the first card.
- **Cards:** reveal flips, card backs, click/swipe navigation, pointer and device
  tilt, and reduced-motion support.
- **Materials:** paper and metal stock, coatings, holographic foil, textures,
  engraving, reflective lettering, and six configurable rarity profiles.
- **Optional tools:** viewed-card piles and dealing animations, an appearance
  editor, card snapshots, drag previews, canvas rendering, and GIF encoding.

The browser library is plain JavaScript and CSS with no framework runtime or
external runtime dependencies. The optional native WebGL renderer loads on
demand. You own the card data, navigation, branding,
persistence, and export content.

[Installation](#installation) · [Quick start](#quick-start) ·
[API](#core-api) · [Appearance](#appearance-and-styling) ·
[Optional modules](#optional-modules) · [Development](#development)

## Installation

Install directly from GitHub:

```sh
npm install "git+https://github.com/paubineau/pack-cards.git"
```

Commit your `package.json` and lockfile. For an explicitly pinned dependency,
append `#<full-commit-sha>` to the Git URL. Update that reference deliberately and
use `npm ci` for reproducible CI and Docker installs.

There is no npm release. The package uses `private: true` to prevent registry
publication; installation from this public GitHub repository still works. See
[license status](#license-and-credits) before redistributing original code.

Use Node.js **22.12 or later** for installation, tests, and build tooling. The
browser library uses ES modules and modern DOM/CSS APIs. It has no CommonJS build.

## Quick start

This example assumes a browser bundler that supports CSS imports and dynamic
imports. Add a host element to your page and run the JavaScript after it exists:

```html
<div id="cards" class="pack-cards"></div>
```

```js
import {
  createPackCards,
  normalizeAppearance,
  resolveAppearance,
} from 'pack-cards';
import 'pack-cards/styles.css';

const host = document.getElementById('cards');
const cards = createPackCards();
const artwork = {accent: '#9dd8dc', tint: '#20363c'};
const settings = normalizeAppearance({version: 5, motion: 'interactive'});
const appearance = resolveAppearance(settings, artwork, 'compass', 'rare');
cards.applyPalette(host, artwork);

function createFace() {
  const face = document.createElement('article');
  const content = document.createElement('div');
  content.className = 'recap-card-content';
  const title = document.createElement('h2');
  title.textContent = 'The Compass';
  title.setAttribute('data-foil-text', '');
  const description = document.createElement('p');
  description.textContent = 'Find your own direction.';
  content.append(title, description);
  face.append(content);
  return face;
}

const mounted = cards.mountCard(createFace(), {
  label: 'Field notes', artwork, appearance,
});
host.replaceChildren(mounted.stage);
window.addEventListener('pagehide', mounted.dispose, {once: true});
```

A card face is an ordinary DOM element. The library adds the deck, material
layers, and interaction. Create a fresh face for each mount; use your own layout
and content inside it.

### Open a pack first

Keep the setup and `createFace()` above, and replace the final `mountCard` block
and its `pagehide` handler with:

```js
let disposed = false;
let dispose = () => {};

dispose = cards.mountPack(host, {
  label: 'Field notes',
  count: 1,
  artwork,
  appearance: settings,
  autoRevealFirst: true,
  async onOpen(arrival) {
    // Instant opening can call onOpen before mountPack returns its disposer.
    await Promise.resolve();
    if (disposed) return;

    // Claim the incoming card animation before disposing the pack.
    const mounted = cards.mountCard(createFace(), {
      label: 'Field notes', artwork, appearance, arrival,
    });
    dispose();
    host.replaceChildren(mounted.stage);
    dispose = mounted.dispose;
  },
});

window.addEventListener('pagehide', () => {
  disposed = true;
  dispose();
}, {once: true});
```

`autoRevealFirst: true` goes straight to the face-up card. With animated opening,
omit it to stop at a face-down card that the user reveals; instant opening skips
that step. `onOpen` can return a promise when you need
to load content; mount the card with the unchanged `arrival` value before that
promise resolves. Keep the handoff order shown above when disposing the pack.

For a full collection with previous/next buttons, see the
[standalone demo](examples/index.html) and its [source](examples/demo.js).

### Frameworks, cleanup, and serving assets

Mount after the host DOM element exists. In a framework, call the current
disposer from the component's cleanup hook and guard any pending asynchronous
work, as above. Disposal releases listeners, sensors, timers, and animations;
the host app owns replacing or removing the mounted DOM. For ordinary card
navigation, dispose the outgoing card before mounting its replacement.

Core and optional helper modules are safe to import during server rendering;
DOM/canvas operations belong in the browser. `gif-worker.js` is a dedicated
worker entry and must not be imported into server or window code. TypeScript
consumers should use `bundler`, `node16`, or `nodenext` module resolution.

Without a bundler, serve the root JavaScript files, the `presentation/` directory,
`styles.css`, `base.css`, `theme.css`, and `assets/` together, preserving relative
paths. Link the stylesheet in HTML and import
`createPackCards` from your served `index.js`. Include the optional module's CSS
and `vendor/` files when using it. A custom build can locate package files with
Node's `import.meta.resolve('pack-cards')` and the exported subpaths. Serve over
HTTP rather than opening files with `file:` URLs.

## Core API

`createPackCards(config?)` creates an independent presentation instance. All
configuration is optional; English labels and neutral artwork are supplied.

| Configuration | Purpose |
| --- | --- |
| `labels` | Partial overrides of [`defaultLabels`](presentation.d.ts); `recipient` uses `{recipient}`. |
| `formatNumber(number)` | Format the remaining-pack count. |
| `formatLabel(label)` | Format the label on the fallback pack face. |
| `renderBack(label, artwork)` | Supply a fresh card-back DOM element on each call. |
| `renderPackArtwork(data, collective, artwork, hideRecipient, title, description)` | Supply an image URL for the pack artwork. `data` contains `label` and `recipient`. |
| `loadRenderer()` | Load a renderer exposing `mountPack`; defaults to the bundled `renderer.js`. |

Custom pack artwork should keep its silhouette and upper 30% consistent between
normal and preview images so the tear aligns. See the full callback types in
[`PackCardsConfig`](presentation.d.ts).

| Method | Returns | Use |
| --- | --- | --- |
| `mountPack(host, options)` | A callable disposer with `.open()` | Show and optionally open a pack programmatically. |
| `mountCard(face, options)` | `{stage, dispose, cancelArrival}` | Wrap a supplied face; append `stage` to the page. |
| `mountReadyDeck(options)` | `{stage, card, dispose}` | Show a face-down deck with an `onReveal` callback. |
| `mountFoil(element, appearance)` | A disposer with `pauseTilt()` / `resumeTilt()` | Drive reflection and tilt on an already styled element. |
| `mountBackFoil(element, appearance)` | A disposer | Add material treatment to a card back. |
| `applyPalette(element, artwork)` | — | Set artwork colors on an element. |
| `applyBackAppearance(element, appearance)` | — | Apply card-back material settings. |
| `renderBack(...)`, `renderPackArtwork(...)` | DOM element / image URL | Use the instance's artwork renderers directly. |

### Pack options

- `label`, `recipient`, `title`, `description`, `openLabel`, `artwork`, `appearance`:
  content and presentation.
- `count`: cards in this pack, a positive safe integer; defaults to `1`.
- `packCount`: wrappers shown in the stack. Remount when this count changes.
- `mystery`, `hideRecipient`, `autoRevealFirst`: opening and reveal behavior.
  Mystery packs conceal the recipient and retain an opening step in instant mode.
- `onOpening()`: called once when opening commits; `onOpen(arrival)`: called once
  when the first card is revealed. Skip and instant paths also invoke these hooks.
- `onInteract()` / `onRest()`: native tear interaction and spring-back callbacks.
- `focus`, `measureArrival`, `isActive()`: focus, handoff measurement, and an
  optional consumer-owned lifetime guard.

If the WebGL renderer cannot load, the ordinary opening button remains usable.
The renderer is not required for standalone cards or instant opening.

### Card and ready-deck options

`mountCard` accepts `label`, `remaining`, `artwork`, `appearance`, `backwards`,
`answer`, `onNavigate`, and `arrival`. `onNavigate(direction)` receives `1` or
`-1`; your app chooses and mounts the next card. `cancelArrival()` settles an
incoming card without disposing the mount.

Card interaction preserves nested links/buttons, text selection, and vertical
touch scrolling. Supply accessible previous/next controls alongside gesture
navigation, as the demo does.

`mountReadyDeck` accepts `label`, `remaining`, `artwork`, `appearance`,
`autoReveal`, and `onReveal`. It waits for a click by default;
`autoReveal: true` reveals on the next timer turn, so attach the stage immediately.

See [`presentation.d.ts`](presentation.d.ts) for all signatures. The methods
above and the documented appearance, canvas, and optional-module helpers are
the supported starting points for new integrations. Existing `recap*` helpers
and positional methods remain available for compatibility; application code
should prefer the named API rather than depending on those implementation helpers.

## Appearance and styling

Import appearance helpers from **`pack-cards`** or **`pack-cards/appearance`**:

```js
import {normalizeAppearance, resolveAppearances} from 'pack-cards';

const settings = normalizeAppearance({
  version: 5,
  opening: 'animated',
  motion: 'interactive',
  glow: 'gold',
  pack_zoom: true,
  rarities: {
    rare: {foil: 'holographic', coverage: 'full', palette: ['ice', 'rose']},
  },
});

const artwork = {accent: '#9dd8dc', tint: '#20363c'};
const appearances = resolveAppearances(settings, artwork, [
  {identity: 'compass', rarity: 'rare'},
  {identity: 'sun', rarity: 'legendary'},
], 'field-notes');
```

Include **`version: 5`** when providing settings; missing or unsupported versions
reset to defaults. `normalizeAppearance` fills missing values, validates choices,
and resolves incompatible settings. `appearanceDefaults` and
`appearanceChoices` are exported for building your own controls.

Use `card` for the base material profile and `rarities` for `common`, `uncommon`,
`rare`, `super_rare`, `epic`, and `legendary`. Unknown rarity names use `card`.
Each material field accepts a string or an array of allowed choices:

| Field | Choices |
| --- | --- |
| `stock` | `paper`, `metal` |
| `coating` | `matte`, `satin`, `gloss`, `pearl` |
| `foil` | `none`, `metallic`, `holographic` |
| `coverage` | `none`, `border`, `full` |
| `pattern` | `none`, `brushed`, `guilloche`, `dots`, `stardust`, `facets` |
| `engraving` | `none`, `radial`, `contour`, `facets` |
| `decoration` | `none`, `frame`, `lettering`, `frame-lettering` |
| `palette` | `channel` (artwork accent), `silver`, `spectrum`, `ice`, `amber`, `rose` |
| `lighting` | `soft`, `studio` |

Global settings support `opening: 'animated' | 'instant'`,
`motion: 'interactive' | 'still'`, a boolean `pack_zoom`, and `glow` values
`bronze`, `silver`, `gold`, `platinum`, `diamond`, or `random`.

`resolveAppearance(settings, artwork, identity, rarity?)` resolves one card.
`resolveAppearances(...)` balances choices across a collection and keeps identity
assignments stable when entries are reordered. Resolve once and retain the
returned appearances for rendering and export. For streaming draws,
`createRarityAppearanceResolver(settings, artwork, collectionId)` returns a
`(rarity, identity) => appearance` function; allocation follows first draw order.
See [`appearance.d.ts`](appearance.d.ts) for the complete settings schema.

Artwork accepts `{accent, tint, avatar?, logo?}`. Images must be decoded
`HTMLImageElement`s; load them before mounting. Canvas artwork requires
same-origin or CORS-enabled images. The library does not fetch branding for you.

Load `pack-cards/styles.css` once and preserve its relative asset URLs. This
compatibility stylesheet includes `base.css` (structure, interaction, materials)
and `theme.css` (the default card content layout and typography). To supply your
own card theme, import only `pack-cards/base.css`; add your content styles after
it. Both files are separately exported and the combined stylesheet preserves
the default appearance. Within a
face, use `recap-card-content` and optionally `recap-card-header` /
`recap-card-footer`. `data-foil-text` enables reflective print on text;
`data-foil-line` marks rules. The `recap-*` class names are part of the existing
styling contract.

Theme with `--accent`, `--recap-tint`, `--text`, `--muted`, `--pack-cards-font`,
and `--recap-nozoom-card-width`. Styles are scoped to library elements; no
page-wide reset is applied. Motion respects `prefers-reduced-motion`. Device
tilt requires a secure context and supported sensors, with permission controls
where the browser requires them.

## Optional modules

Import these entry points only when needed. Collection, editor, snapshots, and
GIF modules are separate from the core and include TypeScript declarations.

| Import | Provides | Styles |
| --- | --- | --- |
| `pack-cards/collection` | Viewed-card piles and dealing animations | `pack-cards/styles.css` |
| `pack-cards/editor` | Appearance and rarity controls | `pack-cards/editor.css` |
| `pack-cards/snapshots` | Visual card copies and drag previews | Core CSS; add `pack-cards/snapshots.css` for previews |
| `pack-cards/gif` | Synchronous RGBA-to-GIF encoding | None |
| `pack-cards/gif-worker.js` | Dedicated GIF worker entry | None |

### Viewed-card piles

Use `createCardPile` with your container, collection size, and navigation
callback. This helper reuses `cards` and `artwork` from the quick start:

```js
import {createCardPile} from 'pack-cards/collection';

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
order and navigation. See [`collection.d.ts`](collection.d.ts) for geometry,
focus, and lifetime options.

### Appearance editor

Given a container `settingsHost` and your `updatePreview` callback:

```js
import {createAppearanceEditor} from 'pack-cards/editor';
import 'pack-cards/editor.css';

const editor = createAppearanceEditor(settingsHost, {
  initial: settings,
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
controls. See [`editor.d.ts`](editor.d.ts).

### Snapshots and drag previews

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
[`snapshots.d.ts`](snapshots.d.ts).

### Canvas rendering

The root module and `pack-cards/export-material` export `createExportCard`,
`drawExportStock`, and `drawExportMaterial`. They use a **1080 × 1440** coordinate
system. Reuse the
resolved `appearance` and `artwork` from the quick start:

```js
import {createExportCard} from 'pack-cards';

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
result. See [`export-material.d.ts`](export-material.d.ts).

### GIF encoding

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
[`gif.d.ts`](gif.d.ts).

For browser work off the main thread, serve `gif-worker.js` with `gif.js` and
`vendor/gifenc/` at their relative paths, or bundle it as a module worker entry.
The worker sends `{ready: true}` initially and after each accepted frame.
Send frames in the format above, then `{finish: true}` to receive `{bytes}`;
errors return `{error: true}`. Create a new worker per export and terminate it
on completion or cancellation. The worker loops GIFs forever. Your app composes
the frames, captions, and download UI.

## Development

Clone the repository and run the tests:

```sh
git clone https://github.com/paubineau/pack-cards.git
cd pack-cards
npm test
```

The unit and package-consumer tests run without installing root development
dependencies. Browser tests use Playwright as a development-only dependency:

```sh
npm ci --ignore-scripts
npx playwright install chromium --only-shell
npm run test:browser
```

These exercise actual WebGL, pointer/keyboard opening, spring-back, fallback
paths, artwork updates, cleanup, visibility changes, and the first-card handoff.
The renderer uses maintained source in [`renderer/`](renderer/README.md), with
separate shaders, physics, textures, and a DOM lifecycle. The presentation facade
delegates internally to artwork, pack, flight, deck, and motion modules in
`presentation/`; those internal files are not additional public APIs.

To try the demo, serve
the repository with any local HTTP server, for example with Python installed:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/examples/` for a six-card collection with opening,
navigation, materials, and motion controls.

The renderer is checked in and ready to use. Rebuild it only when changing its
source or dependencies:

```sh
npm --prefix renderer ci --ignore-scripts
npm run build:renderer
```

Include the generated `renderer.js` and `THIRD_PARTY_LICENSES.txt` when committing
a renderer update. For a package change, check the TypeScript consumer fixture
and inspect the distributable:

```sh
npm exec --yes --package=typescript@5.9.3 -- tsc --noEmit --strict --module NodeNext --target ES2022 tests/types.test.ts
npm pack --dry-run
```

For local integration work, install this directory in a consumer with
`npm install ../pack-cards`. Restore the pinned GitHub dependency before
committing the consumer's manifest and lockfile.

The root also exports `pack-cards/appearance`, `pack-cards/presentation`,
`pack-cards/export-material`, `pack-cards/renderer`, and `pack-cards/assets/*`
for custom integrations. Friendly aliases such as `normalizeAppearance` and
`createExportCard` are available from both `pack-cards` and their focused
subpaths. Original `recap*` export names remain aliases for compatibility.
The optional renderer's direct
contract is documented in [`renderer.d.ts`](renderer.d.ts).

## License and credits

**Original code is currently `UNLICENSED`.** A license has not yet been selected;
the public repository does not currently grant an open-source license for that
code.

The WebGL tear is adapted from `cardpack-webgl` at revision
`d3243641b53b2679902c9263554bfdcdef4e4c3d`. Its adapted source and MIT license live
in [`renderer/`](renderer/README.md); the distributed notice is in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). GIF encoding includes
[gifenc 1.0.3](vendor/gifenc/README.md) under its
[MIT license](vendor/gifenc/LICENSE.md). Keep these notices with redistributed
third-party code.

Card CSS and SVG textures are local implementations informed by Simon Goellner's
`pokemon-cards-css` (`acb1197633e749a1fba4412231db2f6581586d00`) and
`pokemon-cards-151` (`98030f941cdc4919b648457200277e29b60d5f5a`), without copying
their source or assets. The demo uses fictional cards and neutral artwork.
