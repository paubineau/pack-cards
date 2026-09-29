# Integration guide

[Back to the README](../README.md) · [API reference](api.md)

## Choose a mounting API

Use `createPackView(host, options)` for a host that displays one pack or card at
a time. It replaces the current mount, applies artwork colors, resolves card
materials, and owns the opening animation's handoff. Your application still
chooses the content and which card comes next.

```js
import {createPackView} from 'pack-cards';
import 'pack-cards/styles.css';

const view = createPackView(host, {
  label: 'Field notes',
  artwork: {accent: '#9dd8dc', tint: '#20363c'},
  appearance: {opening: 'animated'},
});

// createFace() is your function returning a fresh card-face element.
view.showPack({
  renderCard: () => ({face: createFace(), identity: 'compass', rarity: 'rare'}),
});

// Use the same view for subsequent cards selected by your application.
// view.showCard(createNextFace(), {identity: 'sun', rarity: 'legendary'});
// view.dispose(); // Release the view when its host is unmounted.
```

`renderCard` may return a promise. Replacing or disposing the view makes a pending
result inactive, so it cannot overwrite newer content. The library does not
cancel your fetches or other application work; cancel those when appropriate.
Use `onReveal` to update application UI after the card mounts. Rendering failures
display a generic alert in the host; `onError` receives the error for your own
reporting or recovery.

The view defaults to `autoRevealFirst: true` and `focus: false`. Set
`autoRevealFirst: false` for a face-down reveal step during animated opening;
instant opening goes directly to the card. Provide accessible buttons alongside
gesture navigation, and manage focus according to your page's flow.

See the [starter](../examples/minimal.html) and its
[source](../examples/minimal.js) for a complete integration with restart and
cleanup. See [the API reference](api.md) for configuration and callbacks.

## Low-level mounting

Use `createPackCards` when you need direct control over individual mounts, deck
elements, and the opening handoff. Existing integrations can continue using it.
Unlike a view, this API returns DOM nodes and disposers for your app to manage.

This example assumes a browser bundler that supports CSS imports and dynamic
imports. Add a host element to your page and run the JavaScript after it exists:

```html
<div id="cards" class="pack-cards"></div>
```

```js
import {
  createPackCards,
  createAppearanceSettings,
  resolveAppearance,
} from 'pack-cards';
import 'pack-cards/styles.css';

const host = document.getElementById('cards');
const cards = createPackCards();
const artwork = {accent: '#9dd8dc', tint: '#20363c'};
const settings = createAppearanceSettings({motion: 'interactive'});
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

### Handle a pack-to-card transition manually

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

## Frameworks and cleanup

Mount after the host DOM element exists. In a framework, create the view in a
mount/effect hook and call `view.dispose()` from that hook's cleanup. Give it a
dedicated host whose children the framework does not also render. The view
removes its owned DOM and releases listeners, sensors, timers, and animations.
Disposal is terminal: create a new view if that component mounts again.

With the low-level API, call the current disposer during cleanup and guard
pending asynchronous work, as the manual example shows. Your app replaces or
removes the mounted DOM. For ordinary card navigation, dispose the outgoing card
before mounting its replacement; the pack arrival handoff uses the specific
order above.

For a plain page, `pagehide` is a useful cleanup point. If the page can return
from the back/forward cache, recreate its view on a persisted `pageshow`, as the
starter does. Also dispose optional helpers and cancel application-owned work.

Core and optional helper modules are safe to import during server rendering;
DOM/canvas operations belong in the browser. `gif-worker.js` is a dedicated
worker entry and must not be imported into server or window code. TypeScript
consumers should use `bundler`, `node16`, or `nodenext` module resolution.

## Bundlers and direct browser imports

With a bundler, import JavaScript from `pack-cards` or a documented subpath and
import the corresponding CSS. The renderer's dynamic import and CSS asset URLs
must be included in your build. The package uses ES modules; there is no CommonJS
build. Node.js 22.12 or later is required for installation and tooling, not as a
browser runtime.

Without a bundler, serve the root JavaScript files, the `presentation/` directory,
`styles.css`, `base.css`, `theme.css`, and `assets/` together, preserving relative
paths. Link the stylesheet in HTML and import
`createPackView` from your served `index.js`. Include the optional module's CSS
and `vendor/` files when using it. A custom build can locate package files with
Node's `import.meta.resolve('pack-cards')` and the exported subpaths. Serve over
HTTP rather than opening files with `file:` URLs.

```html
<link rel="stylesheet" href="/vendor/pack-cards/styles.css">
<script type="module">
  import {createPackView} from '/vendor/pack-cards/index.js';
  // Create the view once its host exists, as in the quick start.
</script>
```

The [showcase](../examples/index.html) demonstrates this direct-browser setup.
Its [guide](../examples/README.md) maps each optional feature to its source.
