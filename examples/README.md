# Pack Cards examples

Start with [minimal.html](./minimal.html) and [minimal.js](./minimal.js). Supply a card face and its rarity, then call `createPackView(...).showPack(...)`. The view handles the opening animation, appearance, replacement, and cleanup. The starter uses only the core entry point and `styles.css`.

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

Serve the repository over HTTP; `file://` does not reliably support ES modules or the GIF worker. No frontend build or framework is required. To copy an example into your app, follow the [installation and asset setup](../README.md).

## Find an integration

| Source | What it demonstrates | Library entry points |
| --- | --- | --- |
| [minimal.js](./minimal.js) | Recommended starting point: a managed pack-to-card view, restart, and cleanup | Core `index.js`, `styles.css` |
| [demo.js](./demo.js) | Advanced integration: manual controllers, reveal modes, renderer fallback, navigation, viewed-card piles, and dealing | Core, `collection.js`, `snapshots.js` |
| [materials-demo.js](./materials-demo.js) | Live material editing, ordinary and rarity profiles, resolved appearance, normalized settings | Core, `editor.js`, `editor.css` |
| [tools-demo.js](./tools-demo.js) | Inert snapshots, a pointer-driven drag preview, a keyboard-accessible copy action | Core, `snapshots.js`, `snapshots.css` |
| [export-demo.js](./export-demo.js) | Consumer-composed canvas cards, PNG download, cancellable GIF encoding in a module worker | `appearance.js`, `export-material.js`, `gif-worker.js` |
| [shared.js](./shared.js) | Six fictional records, artwork colors, and example-owned card DOM | No additional API |
| [demo.css](./demo.css) | Showcase page layout and custom front-face content styles | Uses the library's existing classes |

The four showcase sections are independent: editing a material profile does not silently change the other examples. The material editor displays its normalized settings so you can pass them into your own pack or card. `styles.css` combines structural/material styles with the default content theme; consumers that provide their own content layout can use `base.css` instead.

## Choose an integration level

The starter uses `createPackView` for a single host element. Call `showPack` again to restart, or `showCard` to replace its content directly. Call `dispose` when the view leaves the page. A disposed view cannot be reused; the starter creates a fresh one after a back/forward-cache restore.

The showcase uses `createPackCards` and the collection module for direct control over pack, card, and pile controllers. This supports custom navigation and dealing sequences, with explicit animation handoff and disposal. See [integration and lifecycle](../docs/integration.md) when building this kind of flow.

Your app owns card records, front-face content, navigation, saving, and export composition in either approach.

## Try the interactions

- **Desktop:** drag across the wrapper, activate its button with Enter or Space, inspect the card's pointer lighting, move through the collection, and revisit a viewed card from its pile.
- **Mobile:** use touch to open and navigate. Drag previews use the dedicated handle so ordinary page scrolling and card interaction remain available. Device tilt may require a permission button on supported devices.
- **Keyboard:** use the opening and navigation buttons, the material controls, and Copy to tray. Dragging is optional.
- **Reduced motion:** enable your system preference and repeat the opening and dealing flow. The library reduces these animations automatically. The Still setting independently disables interactive card tilt.
- **Fallback:** choose the simulated unavailable renderer in the pack section. The retained opening UI still gives access to the cards.

## Snapshots, PNGs, and GIFs

A snapshot is an inert DOM copy that preserves the card's appearance. The drag preview adds a sized wrapper; the example supplies pointer tracking and drop behavior. Neither helper captures arbitrary HTML as an image.

The export example composes cards on a canvas, using `createExportCard` for the stock and material frame and ordinary canvas drawing for content. It downloads a 1080 × 1440 PNG or encodes six 270 × 360 frames as a GIF in a worker. The GIF is a slideshow of supplied frames, not a recording of the interactive pack.

See [optional modules](../docs/optional-modules.md) for snapshot, editor, export, and worker APIs, including their constraints and cleanup requirements.

For installation, configuration, API signatures, and library licensing, see the [main README](../README.md).
