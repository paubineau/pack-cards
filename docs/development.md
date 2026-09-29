# Development

[Back to the README](../README.md)

Clone the repository and run the tests:

```sh
git clone https://github.com/paubineau/pack-cards.git
cd pack-cards
npm test
```

The unit and package-consumer tests run without installing root development
dependencies. Browser tests use Playwright as a development-only dependency:

```sh
npm ci --ignore-scripts
npx playwright install chromium --only-shell
npm run test:browser
```

These exercise actual WebGL, pointer/keyboard opening, spring-back, fallback
paths, artwork updates, cleanup, visibility changes, and the first-card handoff.
The example checks also exercise the served showcase, editor, piles, snapshots,
PNG/GIF export, and starter integration.
The renderer uses maintained source in [`renderer/`](../renderer/README.md), with
separate shaders, physics, textures, and a DOM lifecycle. The presentation facade
delegates internally to artwork, pack, flight, deck, and motion modules in
`presentation/`; those internal files are not additional public APIs.

To try the examples, start the included local server (no dependency install or
build is needed):

```sh
npm run demo
# Choose another port if needed:
npm run demo -- --port 8081
```

Open [the feature showcase](http://127.0.0.1:8080/examples/) or
[the starter](http://127.0.0.1:8080/examples/minimal.html). The server binds
only to the local machine and sends the JavaScript MIME types needed by module
workers. Another static server works too if it serves `.js` and `.mjs` as JavaScript.

The renderer is checked in and ready to use. Rebuild it only when changing its
source or dependencies:

```sh
npm --prefix renderer ci --ignore-scripts
npm run build:renderer
```

Include the generated `renderer.js` and `THIRD_PARTY_LICENSES.txt` when committing
a renderer update. For a package change, check the TypeScript consumer fixture
and inspect the distributable:

```sh
npm exec --yes --package=typescript@5.9.3 -- tsc --noEmit --strict --module NodeNext --target ES2022 tests/types.test.ts
npm pack --dry-run
```

For local integration work, install this directory in a consumer with
`npm install ../pack-cards`. Restore the pinned GitHub dependency before
committing the consumer's manifest and lockfile.

See the [API reference](api.md#entry-points) for public entry points and the
[license notes](credits.md) before redistributing code.
