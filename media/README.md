# README showcase

`showcase.mp4` is a short, silent recording of the real library: opening a pack,
moving over The Orbit and The Prism, then lingering on **The Sun (legendary)**
with two cards in the viewed pile. `showcase.jpg` is the final-frame preview.

The README uses a clickable preview so readers can choose when to play the
video. The MP4 uses H.264, 960 × 720 pixels, and 25 frames per second. Neither
these media files nor the recording tools are included in the library package.

## Record again

Install Node.js 22.12+, FFmpeg (on `PATH`), and the development dependencies:

```sh
npm ci --ignore-scripts
npx playwright install chromium --only-shell
node tools/record-showcase.mjs
```

The recorder starts a temporary loopback server and an isolated headless browser,
then uses real mouse input to tear the pack, tilt the cards, and advance them.
It checks for browser errors, the legendary card, and the two-card pile. FFmpeg
trims loading time and encodes the capture; it does not speed up the animations.
Raw recordings are retained in the temporary directory printed by the command.

The composition lives in [`tools/showcase.html`](../tools/showcase.html) and
[`tools/showcase.js`](../tools/showcase.js). It uses the library's public APIs and
the fictional faces from [`examples/shared.js`](../examples/shared.js), with
fixed material choices and pile placements for a consistent recording.

Credit for the renderer and card-effect inspirations remains in the
[acknowledgements](../README.md#acknowledgements).
