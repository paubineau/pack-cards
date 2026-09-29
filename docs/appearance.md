# Appearance and styling

[Back to the README](../README.md) · [Appearance declarations](../appearance.d.ts)

## Create settings

Pass partial settings directly to `createPackView`:

```js
const view = createPackView(host, {
  appearance: {motion: 'still', opening: 'instant'},
});
```

For reusable settings, an editor's initial value, or low-level mounting, use
`createAppearanceSettings`. It fills defaults and records the current settings
version for you. Import helpers from **`pack-cards`** or
**`pack-cards/appearance`**:

```js
import {createAppearanceSettings, resolveAppearances} from 'pack-cards';

const settings = createAppearanceSettings({
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

`appearanceDefaults` and `appearanceChoices` are exported for building your own
controls. Normalization validates choices and resolves incompatible settings.

### Save and restore settings

Save the complete settings object, including its `version`, using your own
persistence. Use `normalizeAppearance(savedValue)` to validate data when loading
it. This parser is intentionally strict: missing or unsupported versions reset
to defaults. Current saved settings use **`version: 5`**.

Use `createAppearanceSettings({...})` for settings authored in code and
`normalizeAppearance(value)` for previously saved data. The strict parser's
behavior is retained for existing consumers.

## Material profiles

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

## Resolve card materials

The view resolves individual cards from their `identity` and `rarity`
automatically. Use the following functions for low-level mounts, shared export
appearances, or balanced collection allocation.

`resolveAppearance(settings, artwork, identity, rarity?)` resolves one card.
`resolveAppearances(...)` balances choices across a collection and keeps identity
assignments stable when entries are reordered. Resolve once and retain the
returned appearances for rendering and export. For streaming draws,
`createRarityAppearanceResolver(settings, artwork, collectionId)` returns a
`(rarity, identity) => appearance` function; allocation follows first draw order.
See [`appearance.d.ts`](../appearance.d.ts) for the complete settings schema.

## Artwork

Artwork accepts `{accent, tint, avatar?, logo?}`. Images must be decoded
`HTMLImageElement`s; load them before mounting. Canvas artwork requires
same-origin or CORS-enabled images. The library does not fetch branding for you.

## CSS and custom themes

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
