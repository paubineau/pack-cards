# Pack Cards

Collectible cards and interactive pack opening for the web. Give the library
ordinary DOM elements for your card faces; it adds the wrapper, reveal animation,
materials, and interaction.

**Plain JavaScript and CSS. No React or external runtime dependencies.** Works
with a framework or without one, and includes TypeScript declarations. The
WebGL pack renderer loads only when needed.

- Tear open animated packs, skip the opening, or reveal instantly.
- Explore foil, textures, engraving, six rarity profiles, and pointer/device tilt.
- Navigate cards and animate viewed-card piles, with reduced-motion support.
- Add an appearance editor, drag previews, snapshots, or canvas/GIF export.

Your app supplies card content, card order, navigation, and persistence.

## Try it

```sh
git clone https://github.com/paubineau/pack-cards.git
cd pack-cards
npm run demo
```

Open [the showcase](http://127.0.0.1:8080/examples/) or
[the minimal starter](http://127.0.0.1:8080/examples/minimal.html). No install or
build is required; use Node.js **22.12 or later**. For another port, run
`npm run demo -- --port 8081`.

The [example guide](examples/README.md) maps each feature to readable source.

## Install

Install from GitHub; there is no npm release:

```sh
npm install "git+https://github.com/paubineau/pack-cards.git"
```

Commit your manifest and lockfile. To pin a specific revision, append
`#<full-commit-sha>` to the URL; use `npm ci` in CI and Docker. The package's
`private: true` prevents registry publication, not GitHub installation.

## Open a pack

With a browser bundler, add a host and a template for your card face:

```html
<div id="cards" class="pack-cards"></div>
<template id="card-face">
  <article>
    <div class="recap-card-content">
      <h2 data-foil-text>The Compass</h2>
      <p>Find your own direction.</p>
    </div>
  </article>
</template>
```

Then run this after those elements exist:

```js
import {createPackView} from 'pack-cards';
import 'pack-cards/styles.css';

const host = document.getElementById('cards');
const template = document.getElementById('card-face');
const view = createPackView(host, {
  label: 'Field notes',
  artwork: {accent: '#9dd8dc', tint: '#20363c'},
});

view.showPack({
  renderCard: () => ({
    face: template.content.firstElementChild.cloneNode(true),
    identity: 'compass',
    rarity: 'rare',
  }),
});

window.addEventListener('pagehide', () => view.dispose(), {once: true});
```

The view handles the pack-to-card transition, material selection, replacement,
and cleanup. Return a fresh face from `renderCard`; it can also return a promise
when content needs loading. To show a card directly, call
`view.showCard(face, {identity: 'compass', rarity: 'rare'})`. Call `view.open()`
from your own opening button, and `view.dispose()` when unmounting.

See [integration](docs/integration.md) for plain-browser use, framework lifecycle,
and advanced mounting, or the [API reference](docs/api.md) for options.

## Change the appearance

Pass settings when creating the view; defaults fill anything you omit:

```js
const view = createPackView(host, {
  appearance: {
    motion: 'still',
    rarities: {
      rare: {foil: 'holographic', coverage: 'full', palette: ['ice', 'rose']},
    },
  },
});
```

Use `styles.css` for the default theme, or `base.css` with your own content styles.
The [appearance guide](docs/appearance.md) covers material choices, custom themes,
and saving settings.

## Add only what you need

| Feature | Import |
| --- | --- |
| Viewed-card piles and dealing | `pack-cards/collection` |
| Appearance editor | `pack-cards/editor` |
| Snapshots and drag previews | `pack-cards/snapshots` |
| Canvas material rendering | `pack-cards/export-material` |
| GIF encoding | `pack-cards/gif` or the `pack-cards/gif-worker.js` worker |

See [optional modules](docs/optional-modules.md) for recipes and required styles.
Canvas exports draw content you supply; they do not capture arbitrary HTML.

## Documentation

- [Integration](docs/integration.md): assets, cleanup, frameworks, and manual mounting.
- [API reference](docs/api.md): the view API and lower-level presentation controls.
- [Appearance](docs/appearance.md): materials, rarities, settings, and styling.
- [Optional modules](docs/optional-modules.md): editor, piles, snapshots, and exports.
- [Examples](examples/README.md): runnable integrations and their source.
- [Development](docs/development.md): testing, renderer builds, and packaging.

## License

Original code is currently **UNLICENSED**: the public repository does not yet
grant an open-source license. The adapted WebGL renderer and bundled GIF encoder
carry MIT notices. See [license and credits](docs/credits.md) for details.
