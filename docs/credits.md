# License and credits

[Back to the README](../README.md)

## License scope

Pack Cards' original code, documentation, examples, and assets are licensed under
the **[MIT License](../LICENSE)**. It permits use, modification, and redistribution,
including commercial and closed-source use, provided the copyright and license
notices are retained. It does not require publication of source code. The license
includes a warranty and liability disclaimer. See the
[official license text](https://opensource.org/license/mit).

Existing third-party code retains its own license:

| Files | License | Notice |
| --- | --- | --- |
| Original project files, except the components below | MIT | [LICENSE](../LICENSE) |
| Adapted `renderer/` source and generated `renderer.js` | MIT | [Renderer license](../renderer/LICENSE) and [distributed notice](../THIRD_PARTY_LICENSES.txt) |
| Bundled `vendor/gifenc/` encoder | MIT | [gifenc license](../vendor/gifenc/LICENSE.md) |

The package metadata uses the SPDX identifier **`MIT`**. Keep the original
copyright and permission notices when redistributing third-party components;
the root license does not replace those notices or change the licenses of the
reference projects credited below.

## Pack opening: 2manslkh

The WebGL pack-opening renderer is directly adapted from
**[cardpack-webgl](https://github.com/2manslkh/cardpack-webgl)** by
[2manslkh](https://github.com/2manslkh), at revision
[`d3243641b53b2679902c9263554bfdcdef4e4c3d`](https://github.com/2manslkh/cardpack-webgl/tree/d3243641b53b2679902c9263554bfdcdef4e4c3d).
Its shaders, tear physics, textures, particles, and gesture timing form the
foundation of the renderer in this library.

Pack Cards maintains a framework-independent DOM lifecycle and integration
changes around that foundation. The adapted source, modification notes, and
upstream **MIT license** are in [`renderer/`](../renderer/README.md) and
[`renderer/LICENSE`](../renderer/LICENSE). The distributed notice is in
[THIRD_PARTY_LICENSES.txt](../THIRD_PARTY_LICENSES.txt).

## Holographic cards: Simon Goellner

The card materials and interaction are heavily inspired by the work of
**[Simon Goellner (@simeydotme)](https://github.com/simeydotme)**:

- **[pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)** and its
  [holographic card demo](https://poke-holo.simey.me/).
  Reference revision:
  [`acb1197633e749a1fba4412231db2f6581586d00`](https://github.com/simeydotme/pokemon-cards-css/tree/acb1197633e749a1fba4412231db2f6581586d00)
  ([upstream GPL-3.0 license](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/LICENSE)).
- **[pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151)** and its
  [151 card demo](https://poke-151.simey.me/).
  Reference revision:
  [`98030f941cdc4919b648457200277e29b60d5f5a`](https://github.com/simeydotme/pokemon-cards-151/tree/98030f941cdc4919b648457200277e29b60d5f5a)
  ([upstream GPL-3.0 license](https://github.com/simeydotme/pokemon-cards-151/blob/98030f941cdc4919b648457200277e29b60d5f5a/LICENSE)).

Their card components, layered CSS, foil families, and pointer-responsive motion
were substantial visual and technical references. The card CSS and SVG textures
here were implemented locally without copying their source or assets; that does
not diminish the influence of their work. The demo uses fictional cards and
neutral artwork, with no Pokémon artwork or logos.

Thank you to both authors and their contributors for publishing these projects.

## GIF encoding

GIF encoding includes **[gifenc](https://github.com/mattdesl/gifenc) by
Matt DesLauriers**, version [1.0.3](../vendor/gifenc/README.md), under its
[MIT license](../vendor/gifenc/LICENSE.md).

Keep the applicable license and copyright notices with redistributed third-party
code. These acknowledgements do not change the licenses of the upstream projects.
