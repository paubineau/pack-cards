# Pack Cards

Framework-independent collectible cards and pack opening for the browser. The
core is plain JavaScript and CSS with no runtime dependencies. An optional,
lazy-loaded WebGL renderer includes React internally; consumers do not need React.

This repository is self-contained and can be installed directly from GitHub.
It does not call a backend, require application globals, load
Twitch assets, or store user data. JavaScript and TypeScript applications use the
same ES module API; declarations are included. The package is intentionally
`private: true` to prevent accidental npm publication; this does not prevent Git
installation or determine GitHub repository visibility. Original-source licensing
is awaiting the owner's choice (`UNLICENSED` in package.json).
Dependency notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

## Install from GitHub

Replace `<commit>` with the full commit SHA you want to consume:

```sh
npm install --save-exact "git+https://github.com/paubineau/pack-cards.git#<commit>"
```

Commit your application's `package.json` and lockfile, then use `npm ci` in CI
and Docker builds. A private GitHub repository requires Git credentials on each
machine that installs it. No npm account or registry publication is needed.
Updates are deliberate: change the pinned commit, refresh the lockfile, rebuild
the app's assets and run its integration checks. The checked-in `renderer.js`
contains its dependencies, so consumers do not install React or rebuild it.

For local library development, a consumer can temporarily install a local path
with `npm install ../pack-cards`. Restore the pinned GitHub dependency before
committing the consumer's manifest and lockfile so CI can reproduce its install.

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

For a browser bundler such as Vite, the library entry is:

```js
import {createPackCards, normalizeAppearance} from 'pack-cards';
import 'pack-cards/styles.css';

const cards = createPackCards();
const appearance = normalizeAppearance({version: 5, motion: 'interactive'});
// Use cards.mountPack(host, {appearance, onOpen}) when the host is mounted.
```

The bundler must handle CSS asset URLs and the dynamic renderer import. Module
subpaths `pack-cards/appearance`, `pack-cards/presentation`,
`pack-cards/export-material` and `pack-cards/renderer` have matching TypeScript
declarations. Use TypeScript's `bundler`, `node16` or `nodenext` module resolution.
The package is ESM; it does not provide a CommonJS build or framework wrapper.

For native browser modules, serve the root `*.js` modules, `styles.css` and the
entire `assets/` directory together, retaining their relative paths. The following
example assumes they are available under `./pack-cards/`; serving `node_modules`
directly is unnecessary. For a custom build that copies assets, Node's
`createRequire(import.meta.url).resolve('pack-cards')` locates the library entry.
CSS, individual `pack-cards/assets/*` files, `pack-cards/renderer`
and `pack-cards/THIRD_PARTY_LICENSES.txt` are also resolvable export paths. These
files are build inputs; browsers do not fetch anything from GitHub at runtime.

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

In a framework, create/mount the instance after the host element exists, and call
the disposer on unmount or before replacing the card or pack. Importing the core
and using appearance helpers is safe during server rendering; DOM and canvas
methods must run in the browser. No application state is stored by the package.

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

Optional modules provide viewed-card piles/dealing, an appearance editor, visual
snapshots/drag previews and GIF encoding. Collection progression, quiz/content
rendering, ranking/drop rules, persistence, fetching, login and complete PNG/GIF
story composition belong to the consumer. The canvas module renders stock/materials
and a configurable print frame; the consumer supplies its content.

## Optional modules

These modules have separate entry points and are not imported by the core.
All have TypeScript declarations. Importing the modules is safe without a DOM;
call editor, collection and snapshot methods after mounting a browser view.

### Viewed-card piles and dealing

```js
import {createCardPile} from 'pack-cards/collection';
import {snapshotCard} from 'pack-cards/snapshots';

const pile=createCardPile({
  count:10,
  renderBack:()=>presentation.renderBack('Collection',artwork),
  onPrevious:()=>navigate(-1),
  previousLabel:position=>`Review card ${position}`
});
container.append(pile.element);
pile.update(position,seen); // Map<card index, {width,height}>
```

The core stylesheet already includes pile and flight styles. `placements` holds
stable poses; pass it into a new instance when restoring a collection. The host
owns navigation, current position and content. Capture the old card's bounds and
`snapshotCard(oldCard)` before a forward navigation; for backward navigation,
capture the pile's old bounds with `pile.visual.getBoundingClientRect()` and use
the newly mounted face. After updating the pile, `pile.animate({container,
direction,face,bounds,origin,turn,deck,current,isActive,onFinish})` animates the
transition. `direction` is `1` or `-1`; `origin` is used for backward deals.
`turn`, `deck` and `current` refer to the mounted card's elements for temporary
interaction/focus handling. It returns a cancellation function, or `null` when
motion/layout/lifetime prevents animation. `dispose()` cancels the flight and
removes the pile. Both cancellation paths restore hidden elements and release timers.

### Appearance editor

```js
import {createAppearanceEditor} from 'pack-cards/editor';
import 'pack-cards/editor.css';

const editor=createAppearanceEditor(settingsHost,{
  initial:settings,
  labels:{target:'Appearance to edit',reset:'Reset'},
  onChange:(settings,target)=>updatePreview(settings,target)
});
// Read settings on Save; the library makes no requests.
const saved=editor.getSettings();
editor.setSettings(saved); // Silent replacement.
// On unmount: editor.dispose();
```

The editor covers material choices, six rarity profiles, reset/dependency rules,
motion, opening, glow and zoom. Labels accept partial nested overrides; instances
receive distinct accessible IDs by default. `showSettings:false` omits the global
pack settings, or `sharedControls:{motion,opening,glow,pack_zoom}` can bind existing
select/checkbox elements. `onChange` receives independent normalized settings.
The app owns saving, access control and preview content. Disposal removes only
generated controls and the editor's own handlers.

### Snapshots and drag previews

```js
import {snapshotCard,createCardDragPreview} from 'pack-cards/snapshots';
import 'pack-cards/snapshots.css';

const copy=snapshotCard(face,{prepareClone:copy=>finishAnimatedText(copy)});
container.append(copy);
const drag=createCardDragPreview(face,event.clientX,event.clientY);
container.append(drag.preview);
drag.preview.style.transform=`translate(${event.clientX-drag.grabX}px,${event.clientY-drag.grabY}px)`;
// On drop/cancel: drag.dispose();
```

Snapshots preserve canvas pixels, material variables and scroll position; they
are inert, have no duplicate IDs and do not attach another foil controller.
Insert them synchronously so detached scroll offsets can be restored in a
microtask. Previews support reduced motion, sizing/class options and cleanup.
The host retains pointer tracking, drop targets and game rules.

### GIF encoding

```js
import {createGifEncoder} from 'pack-cards/gif';

const gif=createGifEncoder({repeat:0}); // Loop forever; -1 disables looping.
gif.writeFrame({pixels:rgba,width:1080,height:1440,delay:1500});
const bytes=gif.finish();
```

Supply RGBA bytes as `Uint8Array`, `Uint8ClampedArray` or `ArrayBuffer`; all frames
must have identical dimensions. Alpha below 128 is transparent, delay is in
milliseconds (GIF uses 10 ms precision), and source buffers are not changed.
Encoding is synchronous and also works in Node. For large browser exports, serve
the resolvable `pack-cards/gif-worker.js` module with `gif.js` and its `vendor/`
directory intact, or bundle it as a worker entry. The dedicated worker sends
`{ready:true}` initially and after each frame; send frames as above, then
`{finish:true}` to receive transferred `{bytes}`. Invalid messages return
`{error:true}`. Create a new worker/encoder per export and terminate the worker
on cancellation. The optional encoder includes gifenc 1.0.3; its MIT license and
provenance ship in `vendor/gifenc/`.

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

Run `npm test` and `npm pack --dry-run` before distributing an update. Check the
TypeScript consumer fixture with:

```sh
npm exec --yes --package=typescript@5.9.3 -- tsc --noEmit --strict --module NodeNext --target ES2020 tests/types.test.ts
```

This command downloads a compiler into npm's cache without adding a library
dependency. This repository has no
parent-directory build dependencies. Check in the
renderer output and its notices after rebuilding. No publication or registry
reservation is performed. npm publication remains disabled by `private: true`.

The WebGL tear is adapted from `cardpack-webgl` revision
`d3243641b53b2679902c9263554bfdcdef4e4c3d` (MIT); React, ReactDOM and scheduler are
also included under their notices. The original app's provenance records the CSS
and supplied SVG textures as local implementations, informed by Simon Goellner's
`pokemon-cards-css` revision `acb1197633e749a1fba4412231db2f6581586d00` and
`pokemon-cards-151` revision `98030f941cdc4919b648457200277e29b60d5f5a`, without
copying their source or assets. No PPL, Twitch or Pokémon artwork is distributed
here. Keep dependency notices when redistributing the optional renderer.
