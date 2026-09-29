# Core API reference

[Back to the README](../README.md) · [Integration guide](integration.md)

## View API

Import `createPackView` from `pack-cards`. It manages one host's current pack or
card, including replacement, artwork colors, material resolution, and the
opening animation's handoff. Use a dedicated host whose children belong to the
view. Your application retains card records, ordering, navigation, and storage.

```js
const view = createPackView(host, {
  label: 'Field notes',
  artwork: {accent: '#9dd8dc', tint: '#20363c'},
  appearance: {motion: 'interactive'},
});
```

See [`view.d.ts`](../view.d.ts) for the complete view signatures.

All options are optional. `label`, `artwork`, and `appearance` supply defaults
for subsequent cards and packs. Appearance settings can omit `version`; resolved
appearances are also accepted. The view additionally accepts the factory
configuration in the table under [Low-level API](#low-level-api), including
localized labels, custom backs, custom wrapper artwork, and a renderer loader.

| Method | Behavior |
| --- | --- |
| `showCard(face, options?)` | Replace the current mount with a supplied card face. |
| `showPack(options)` | Replace the current mount with a pack that reveals the result of `renderCard`. |
| `open()` | Open the currently displayed pack programmatically. |
| `dispose()` | Release the mount and remove the view's owned DOM. |

Disposal is idempotent and terminal. Calls to `showCard`, `showPack`, and `open`
after disposal do nothing. Create a new view when mounting again.

### `showCard(face, options?)`

Supply a fresh front-face `HTMLElement`. Options are `identity`, `rarity`,
`label`, `remaining`, `artwork`, `appearance`, `backwards`, `answer`, and
`onNavigate`. The view manages `arrival` internally.

`identity` selects a stable material variation; `rarity` selects its profile.
The view resolves the appearance for you. Supply an already resolved
`appearance` when sharing a specific result with canvas export or balancing
material choices across a collection. See [appearance resolution](appearance.md).

`onNavigate(direction)` receives `1` or `-1`. Your application selects the next
record and calls `showCard` again. Provide accessible navigation controls in
addition to the built-in click/swipe behavior.

### `showPack(options)`

The required `renderCard` callback runs when the first card is ready to be shown.
Return an object containing a fresh `face` and any `showCard` options, or a
promise for that object:

```js
view.showPack({
  count: 1,
  renderCard: () => ({
    face: createFace(),
    identity: 'compass',
    rarity: 'rare',
  }),
  onReveal: result => updateStatus(result.identity),
  onError: error => showError(error),
});
```

Here `createFace`, `updateStatus`, and `showError` are application functions.
`onReveal(result)` runs after the returned card has mounted. `onError(error)`
receives rendering failures for application reporting or recovery; the view also
displays a generic alert in the host. Replacing or disposing a view ignores
stale asynchronous results. It does not cancel application-owned requests.

All [pack options](#pack-options) are available except `onOpen` and `isActive`,
which the view owns. `count` defaults to `1`; it describes the pack's card count
but does not create or manage a collection. `autoRevealFirst` defaults to `true`,
and `focus` defaults to `false`. Set `autoRevealFirst: false` to retain the
face-down reveal step during animated opening. Per-pack `label`, `artwork`, and
`appearance` override the view defaults for the pack and its revealed card;
fields returned by `renderCard` take precedence. The first card's `remaining`
defaults to `count - 1`.

## Low-level API

`createPackCards(config?)` creates an independent presentation instance. All
configuration is optional; English labels and neutral artwork are supplied.

| Configuration | Purpose |
| --- | --- |
| `labels` | Partial overrides of [`defaultLabels`](../presentation.d.ts); `recipient` uses `{recipient}`. |
| `formatNumber(number)` | Format the remaining-pack count. |
| `formatLabel(label)` | Format the label on the fallback pack face. |
| `renderBack(label, artwork)` | Supply a fresh card-back DOM element on each call. |
| `renderPackArtwork(data, collective, artwork, hideRecipient, title, description)` | Supply an image URL for the pack artwork. `data` contains `label` and `recipient`. |
| `loadRenderer()` | Load a renderer exposing `mountPack`; defaults to the bundled `renderer.js`. |

Custom pack artwork should keep its silhouette and upper 30% consistent between
normal and preview images so the tear aligns. See the full callback types in
[`PackCardsConfig`](../presentation.d.ts).

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

See [`presentation.d.ts`](../presentation.d.ts) for low-level signatures and
[`index.d.ts`](../index.d.ts) for the root exports. Existing `recap*` helpers and
positional methods remain available for compatibility; new code should prefer
the view or named-option methods. The
[manual integration guide](integration.md#handle-a-pack-to-card-transition-manually)
explains arrival ownership and the low-level disposer lifecycle.

## Entry points

`pack-cards` exports the view, presentation factory, appearance helpers, and
canvas material helpers. Focused imports are available from
`pack-cards/appearance`, `pack-cards/presentation`, and
`pack-cards/export-material`. `pack-cards/renderer` exposes the optional
renderer's [direct contract](../renderer.d.ts), and `pack-cards/assets/*` exposes
its assets. The internal `presentation/` files are not additional public APIs.

Friendly names such as `normalizeAppearance` and `createExportCard` are exported
from the root and their focused subpaths. The original `recap*` names remain
compatible aliases. See [optional modules](optional-modules.md) for collection,
editor, snapshots, and GIF entry points.
