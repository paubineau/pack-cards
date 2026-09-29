# README showcase

The showcase is a short, silent recording of the real library: opening a pack,
moving over The Orbit and The Prism, then lingering on **The Sun (legendary)**
with two cards in the viewed pile.

The README centers `showcase.gif` as a looping preview at 432 × 324 pixels and
25 frames per second, preserving every frame of the recording. The smaller
resolution keeps the GIF around 3.8 MB. It also links to `showcase.mp4` for a
full-quality download:
H.264, 960 × 720 pixels, and 25 frames per second. `showcase.jpg` provides an
optional still of the final frame. Neither these media files nor the recording
tools are included in the library package.

## Record again

Install Node.js 22.12+, FFmpeg (on `PATH`), and the development dependencies:

```sh
npm ci --ignore-scripts
npx playwright install chromium --no-shell
node tools/record-showcase.mjs
```

The recorder starts a temporary loopback server and an isolated headless Chromium,
then uses real mouse input to tear the pack, tilt the cards, and advance them.
It checks for browser errors, the legendary card, and the two-card pile. FFmpeg
trims loading time and encodes the capture; it does not speed up the animations.
It also generates the GIF and still preview. Raw recordings are retained in the
temporary directory printed by the command.

Use full Chromium so GPU acceleration is available. Software rendering can drop
frames during the card effects, even when the output file reports 25 fps.

To regenerate only the GIF from the existing MP4, run from the repository root:

```sh
ffmpeg -y -i media/showcase.mp4 -filter_complex "fps=25,scale=432:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 media/showcase.gif
```

The composition lives in [`tools/showcase.html`](../tools/showcase.html) and
[`tools/showcase.js`](../tools/showcase.js). It uses the library's public APIs and
the fictional faces from [`examples/shared.js`](../examples/shared.js), with
fixed material choices and pile placements for a consistent recording.

Credit for the renderer and card-effect inspirations remains in the
[acknowledgements](../README.md#acknowledgements).
