# Pack Cards examples

Start with [minimal.html](./minimal.html) and [minimal.js](./minimal.js) for a complete pack-to-card integration. The HTML supplies one card's content, and the JavaScript mounts its wrapper, resolves a rarity appearance, hands off the opening animation, and releases each controller. It uses only the core entry point and `styles.css`, with a small inline page layout.

Open [index.html](./index.html) for the interactive feature showcase. Each section has controls, an observable result, and a link to its implementation. These examples use fictional content and public library APIs. They have no backend, account, database, or settings persistence.

## Run locally

From the repository root:

```sh
npm run demo
```

Visit <http://127.0.0.1:8080/examples/> or <http://127.0.0.1:8080/examples/minimal.html>. To choose another port:

```sh
npm run demo -- --port 8081
```

Serve the repository over HTTP. Opening the HTML through `file://` does not reliably support ES modules or the GIF worker. The examples consume the committed browser modules directly, so no frontend build or framework is required. When copying a starter into an installed-package project, replace the relative imports with the corresponding `pack-cards` package entry points and arrange for your bundler or server to serve the library styles and assets.

## Find an integration

| Source | What it demonstrates | Library entry points |
| --- | --- | --- |
| [minimal.js](./minimal.js) | One pack opening directly into one custom card; restart and cleanup | Core `index.js`, `styles.css` |
| [demo.js](./demo.js) | Animated and instant opening, manual or automatic reveal, settings, renderer fallback, navigation, viewed-card piles and dealing | Core, `collection.js`, `snapshots.js` |
| [materials-demo.js](./materials-demo.js) | Live material editing, ordinary and rarity profiles, resolved appearance, normalized settings | Core, `editor.js`, `editor.css` |
| [tools-demo.js](./tools-demo.js) | Inert snapshots, a pointer-driven drag preview, a keyboard-accessible copy action | Core, `snapshots.js`, `snapshots.css` |
| [export-demo.js](./export-demo.js) | Consumer-composed canvas cards, PNG download, cancellable GIF encoding in a module worker | `appearance.js`, `export-material.js`, `gif-worker.js` |
| [shared.js](./shared.js) | Six fictional records, artwork colors, and example-owned card DOM | No additional API |
| [demo.css](./demo.css) | Showcase page layout and custom front-face content styles | Uses the library's existing classes |

The four showcase sections are independent: editing a material profile does not silently change the other examples. The material editor displays its normalized settings so you can pass them into your own pack or card. `styles.css` combines structural/material styles with the default content theme; consumers that provide their own content layout can use `base.css` instead.

## Ownership and cleanup

Your application owns card records, rendered front-face content, selection, navigation, saving, and export composition. The library owns the controllers you mount. Keep their disposers and call them when replacing the corresponding UI or unmounting a page.

The starter deliberately shows two less obvious parts of the pack-to-card handoff:

- `onOpen` may run synchronously for instant opening. Deferring the callback by one microtask lets `mountPack` return its disposer first.
- Pass the received `arrival` object unchanged to `mountCard` before disposing the pack. This lets the new card claim the animation. A generation guard ignores callbacks queued before Restart or `pagehide`.

For optional modules, also dispose pile and drag controllers, terminate GIF workers, and revoke object URLs when finished. The examples release work on `pagehide`; the starter remounts on a persisted `pageshow` after a back/forward-cache restore. These lifecycle details also apply to framework component unmounts.

## Try the interactions

- **Desktop:** drag across the wrapper, activate its button with Enter or Space, inspect the card's pointer lighting, move through the collection, and revisit a viewed card from its pile.
- **Mobile:** use touch to open and navigate. Drag previews use the dedicated handle so ordinary page scrolling and card interaction remain available. Device tilt may require a permission button on supported devices.
- **Keyboard:** use the opening and navigation buttons, the material controls, and Copy to tray. Dragging is optional.
- **Reduced motion:** enable your system preference and repeat the opening and dealing flow. The library reduces these animations automatically. The Still setting independently disables interactive card tilt.
- **Fallback:** choose the simulated unavailable renderer in the pack section. The retained opening UI still gives access to the cards.

## Snapshots, PNGs, and GIFs

A `snapshotCard` result is an inert DOM copy. It preserves material variables, canvas pixels, and scroll positions, but does not copy event listeners. `createCardDragPreview` provides that appearance in a sized preview; your app supplies pointer tracking and drop behavior. Neither helper captures arbitrary HTML as an image.

Canvas export is separate: `createExportCard` draws the stock and material frame, and the example draws its own symbols, headings, and captions with the canvas context. The PNG download is 1080 × 1440 pixels. If you supply remote images, they must be decoded and permit canvas access through CORS before export.

The GIF example composes six 270 × 360 frames at 800 ms per card and encodes them in a dedicated worker. It sends one frame per acknowledgement to bound pending frame data, supports cancellation, and terminates the worker afterward. This is a slideshow of supplied frames, not a recording of the interactive WebGL pack or DOM animations.

GIF encoding reduces each frame to a limited palette and has one-bit transparency: alpha below 128 is transparent. Frame dimensions must match, and delays are rounded to GIF's 10 ms precision. Larger frames or longer sequences cost more memory and encoding time. The synchronous `createGifEncoder` entry point is also available when your own environment already manages background work; the example uses the worker to keep the page responsive.

For installation, configuration, API signatures, and library licensing, see the [main README](../README.md).
