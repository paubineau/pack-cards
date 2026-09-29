# Pack renderer source

This directory contains the framework-independent source for the optional WebGL
pack-opening renderer. `pack.ts` owns DOM elements, pointer and keyboard input,
animation, fallbacks, and cleanup. The shaders, texture generation, particles,
device quality settings, and tear physics live in adjacent modules.

The implementation is adapted from
[`cardpack-webgl`](https://github.com/2manslkh/cardpack-webgl), revision
`d3243641b53b2679902c9263554bfdcdef4e4c3d`, copyright 2026 2manslkh, under the
[MIT license](LICENSE). The original shader math and gesture timings are retained.
Pack-cards maintains its own DOM lifecycle, rear lining composition, whole-pack
input surface, directional foil hint, body-artwork updates, and callback contract.
This source is maintained directly; the build does not patch upstream files.

From the package root:

```sh
npm --prefix renderer ci --ignore-scripts
npm run build:renderer
```

The build writes `renderer.js` and `THIRD_PARTY_LICENSES.txt` at the package root.
Consumers use the committed browser module and do not need a build tool or React.
