# Pack Cards

Framework-independent collectible cards and pack opening for the browser. The
core is plain JavaScript and CSS with no runtime dependencies. An optional,
lazy-loaded WebGL renderer includes React internally; consumers do not need React.

This repository is self-contained and can also be consumed as a local package.
It does not call a backend, require application globals, load
Twitch assets, or store user data. The package name is provisional; registry
availability has not been checked. Original-source licensing is awaiting the
owner's choice (`UNLICENSED` in package.json); select a license before publishing.
Dependency notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## Try it

From this directory, using Node 22.12+ for tests/builds:

```sh
npm test
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/examples/`. The demo uses only this directory: fictional
cards, six materials, opening, navigation, and motion/size controls. Serve over
HTTP; ES modules cannot reliably load from `file:` URLs.

The checked-in `renderer.js` already works. Rebuild it only when changing the
optional renderer or its dependencies:

```sh
npm --prefix renderer ci --ignore-scripts
npm run build:renderer
```

## Use it

Load `styles.css` once, alongside your own page styles. Relative `assets/` URLs
must remain beside it. With a bundler, import `pack-cards/styles.css`; with native
modules, use a stylesheet link and import `./index.js` from your served copy.

```html
<link rel="stylesheet" href="./pack-cards/styles.css">
<div id="collection" class="pack-cards"></div>
<script type="module">
  import {createPackCards, normalizeAppearance, resolveAppearance}
    from './pack-cards/index.js';

  const host=document.querySelector('#collection');
  const cards=createPackCards({labels:{title:'Field notes',open:'Open collection'}});
  const artwork={accent:'#9dd8dc',tint:'#20363c'};
  const settings=normalizeAppearance({version:5,motion:'interactive'});
  cards.applyPalette(host,artwork);
  let dispose=()=>{},opened=false;
  const pack=cards.mountPack(host,{
    label:'Field notes',count:1,artwork,appearance:settings,autoRevealFirst:true,
    onOpen(arrival) {
      opened=true;
      dispose();
      const face=document.createElement('article');
      face.className='recap-card recap-collectible';
      const content=document.createElement('div');
      content.className='recap-card-content';
      const title=document.createElement('h3');
      title.textContent='The Compass';
      title.setAttribute('data-foil-text','');
      content.append(title); face.append(content);
      const deck=cards.mountCard(face,{
        label:'Field notes',artwork,arrival,
        appearance:resolveAppearance(settings,artwork,'compass','rare')
      });
      host.replaceChildren(deck.stage);
      dispose=deck.dispose;
    }
  });
  // Instant opening can call onOpen before mountPack returns.
  if (opened) pack(); else dispose=pack;
  window.addEventListener('pagehide',()=>dispose(),{once:true});
</script>
```

Cards are real DOM elements supplied by the consumer. The component wraps them
in a deck and adds material layers; it does not interpret card data or HTML.
Create a fresh face when mounting a new deck. Dispose the previous mount before
replacing it. `dispose` cancels listeners, sensors, pending callbacks and motion;
the caller owns removing/replacing the containing DOM.

## Features and boundaries

- Animated packs, skip/instant opening, optional mystery packs, stack counts,
  decoded artwork previews, native fallback, resize handling and first-card arrival.
- Face-down ready decks, reveal flips, card backs/depth, click/swipe navigation,
  backward/answer transitions and guarded asynchronous cleanup.
- Pointer tilt, device orientation with permission controls where needed,
  reduced-motion support and still mode.
- Paper/metal stock; matte/satin/gloss/pearl coatings; metallic/holographic foil;
  border/full coverage; authored textures, engraving, frames and reflective text.
- Deterministic material choices per identity, balanced assortments per collection,
  six configurable rarity profiles and canvas rendering of the same materials.

Collection progression, previously viewed-card piles, quiz/content rendering,
ranking/drag-and-drop games, persistence, fetching, login and complete PNG/GIF
story composition belong to the consumer. The original app retains those features
and calls this package for presentation. The canvas module renders stock/materials
and a configurable print frame, not arbitrary DOM screenshots.

## API

`createPackCards(config)` returns an independent instance. No mutable global
configuration is shared between instances. All configuration is optional:

| Option | Contract |
| --- | --- |
| `labels` | Override keys from exported `defaultLabels`; English by default. `recipient` uses `{recipient}`. |
| `formatNumber(number)` | Formats the remaining-pack count. |
| `formatLabel(label)` | Formats the label on the emergency pack face. Custom artwork/back hooks own their own text. |
| `renderBack(label, artwork)` | Return a fresh DOM node each time; receives the collection label and supplied artwork. |
| `renderPackArtwork(data, collective, artwork, hideRecipient, title, description)` | Return an image URL; `data` contains `label` and `recipient`. Keep preview silhouette and upper 30% identical to the normal image for the tear. |
| `loadRenderer()` | Async loader returning `{mountPack}`. Defaults to the adjacent `renderer.js`. A rejected load retains the ordinary opening button. |
| `createElement(tag, text, className)` | Optional element factory; ordinary browser DOM by default. |

`mountPack(host, options)` replaces the host's children and returns a callable
disposer with `.open()` for programmatic activation. Options:

- `label`, `recipient`, `title`, `description`, `count` (cards in this pack; a positive safe integer, otherwise `RangeError`),
  `packCount` (wrappers in the stack), `artwork`, `appearance`.
- `mystery`, `hideRecipient`, `autoRevealFirst`, `focus`, `measureArrival`,
  `isActive()` for consumer-owned lifetime guards.
- `onOpening()` fires once when opening commits, including skip/instant paths;
  `onOpen(arrival)` fires once on reveal; `onInteract()` and `onRest()` track
  native tear interaction and spring-back.

By default, opening stops at a face-down first card. `autoRevealFirst:true`
continues directly. Forward `arrival` to `mountCard` to retain the live handoff.
If card data loads asynchronously, return that promise from `onOpen` and mount
the card before it resolves. Mystery mode conceals the recipient and retains its
opening step even when `opening:'instant'` is configured. `packCount` is fixed for
a mounted pack; mount a new one when the count changes.

`mountCard(face, {label, remaining, artwork, appearance, backwards, answer,
onNavigate, arrival})` returns `{stage, dispose, cancelArrival}`. Append `stage`
to the page. `onNavigate(direction)` receives `1` or `-1`; the consumer decides
what card comes next. Links, buttons, summaries, text selection and vertical touch
scrolling retain their normal behavior. Provide accessible previous/next controls
as in the example. `cancelArrival()` settles an incoming card without disposing it.

`mountReadyDeck({label, remaining, artwork, appearance, autoReveal, onReveal})`
returns `{stage, dispose}`. It waits for a click by default. `autoReveal:true`
reveals on the next timer turn after the caller attaches the stage.

Lower-level helpers: `mountFoil(element, appearance)` returns a disposer with
`pauseTilt()` / `resumeTilt()`; `mountBackFoil`, `applyPalette`,
`applyBackAppearance`, `renderBack`, and `renderPackArtwork` are also available.
Legacy `recap*` exports/positional methods exist for the original app adapter;
new integrations should use the named API above.

## Appearance and artwork

`normalizeAppearance(value)` returns independent, complete schema-v5 settings.
Include `version:5` when supplying overrides; absent or unknown versions reset to defaults.
It validates values and removes incompatible choices. `appearanceDefaults` and
`appearanceChoices` are frozen. Each material component accepts one string or an
array of choices:

| Component | Choices |
| --- | --- |
| `stock` | `paper`, `metal` |
| `coating` | `matte`, `satin`, `gloss`, `pearl` |
| `foil` | `none`, `metallic`, `holographic` |
| `coverage` | `none`, `border`, `full` |
| `pattern` | `none`, `brushed`, `guilloche`, `dots`, `stardust`, `facets` |
| `engraving` | `none`, `radial`, `contour`, `facets` |
| `decoration` | `none`, `frame`, `lettering`, `frame-lettering` |
| `palette` | `channel` (supplied accent), `silver`, `spectrum`, `ice`, `amber`, `rose` |
| `lighting` | `soft`, `studio` |

Settings have `{version:5, card:{...}, rarities:{common:{...},uncommon:{...},
rare:{...},super_rare:{...},epic:{...},legendary:{...}}, opening:'animated',
glow:'gold', pack_zoom:true, motion:'interactive'}`. Opening also accepts `instant`;
motion accepts `still`; glow accepts `bronze`, `silver`, `gold`, `platinum`,
`diamond`, `random`. These profile names preserve the original schema; unknown
rarities use the ordinary `card` profile.

`resolveAppearance(settings, artwork, identity, rarity)` resolves one card.
For balanced collections, use `resolveAppearances(settings, artwork,
[{identity,rarity},...], collectionId)` once and keep the returned frozen values.
Identity assignments survive reordering. For streaming draws, use
`createRarityAppearanceResolver(settings, artwork, collectionId)` and call the
returned function with `(rarity, identity)`. Streaming allocation follows first
draw order. Pass the same resolved appearance into browser and canvas rendering.

Artwork is `{accent, tint, avatar?, logo?}`. Optional images must already be decoded
HTML image elements. Hosts own URL validation/loading/CORS; same-origin or
CORS-enabled images are needed for canvas pack artwork. The package loads no
branding itself. The default seal is a neutral star.

Styling retains `recap-*` class names to preserve compatibility. Use
`recap-card-content`, optionally `recap-card-header` and `recap-card-footer`, within
your face. `data-foil-text` marks text for reflective lettering;
`data-foil-line` marks rules. Theme through `--accent`, `--recap-tint`, `--text`,
`--muted`, `--pack-cards-font`, and `--recap-nozoom-card-width`. No document-wide
reset is applied. See the example for a complete shell.

## Canvas and optional renderer

`createExportCard(canvas, artwork, {appearance, heading, footer, label,
drawBadge(ctx,x,y), live})` draws a frame and returns
`{ctx, accent, ink, left, width, top, bottom}` for caller-drawn content. Use a
1080×1440 canvas. `drawExportStock(ctx, artwork, appearance)` and
`drawExportMaterial(ctx, artwork, appearance)` draw individual layers with the
same fixed coordinate system. Encoding/downloading is the consumer's choice.

The optional renderer's `mountPack(host, options)` accepts `artSrc`, `bodyArtSrc`,
`backLayer`, `width`, `height`, `glowTier`, `packCount`, `labels` (`open`, `swipe`,
`tap`) and `onReady`, `onInteract`, `onRest`, `onTorn`, `onComplete` callbacks.
Its disposer has `.setBodyArtwork(url)`. `onReady` may fire synchronously before
the disposer is returned. Defer disposal until outside a React callback; the
high-level package already does this. Source and guarded adaptations are in
`renderer/`; its dependencies are pinned in its lockfile.

## Publication and provenance

Run `npm test` and `npm pack --dry-run` before publishing. This repository has no
parent-directory build dependencies. Check in the
renderer output and its notices after rebuilding. No publication or registry
reservation is performed by this extraction.

The WebGL tear is adapted from `cardpack-webgl` revision
`d3243641b53b2679902c9263554bfdcdef4e4c3d` (MIT); React, ReactDOM and scheduler are
also included under their notices. The original app's provenance records the CSS
and supplied SVG textures as local implementations, informed by Simon Goellner's
`pokemon-cards-css` revision `acb1197633e749a1fba4412231db2f6581586d00` and
`pokemon-cards-151` revision `98030f941cdc4919b648457200277e29b60d5f5a`, without
copying their source or assets. No PPL, Twitch or Pokémon artwork is distributed
here. Keep dependency notices when redistributing the optional renderer.
