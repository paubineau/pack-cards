# README showcase

The showcase is a short, silent recording of the real library: opening a pack,
moving over The Orbit and The Prism, then lingering on **The Sun (legendary)**
with two cards in the viewed pile.

The README centers `showcase.gif` as a looping preview at 432 × 324 pixels and
50 frames per second, preserving every captured frame in about 4.7 MB. The clip
lasts about 11 seconds. It also links to `showcase.mp4` for a full-quality download:
H.264, 960 × 720 pixels, and 50 frames per second. `showcase.jpg` provides an
optional still of the final frame. Neither these media files nor the recording
tools are included in the library package.

## Record again

Install Node.js 22.12+, FFmpeg (on `PATH`), and the development dependencies:

```sh
npm ci --ignore-scripts
npx playwright install chromium --only-shell
node tools/record-showcase.mjs
```

The recorder starts a temporary loopback server and Chromium's headless shell,
then sends native mouse input to tear the pack, tilt the cards, and advance them.
It advances browser time and the compositor in exact 20 ms steps, saving each
fully rendered frame. This avoids the repeated-frame pauses of real-time screen
recording, even on a slow machine. The library's JavaScript, CSS and WebGL
animations run at their normal speed in the finished clip; no motion interpolation
is used. Chromium's headless shell is required for explicit frame control.

The recorder checks for browser errors, the legendary card, and the two-card pile.
FFmpeg encodes the same PNG frames as MP4 and GIF, with a short final pause before looping.
The still preview and raw PNG frames are also retained; the command prints their
locations. Recording takes longer than the resulting clip because each frame
finishes rendering before the next one begins.

To regenerate only the GIF from the existing MP4, run from the repository root:

```sh
ffmpeg -y -i media/showcase.mp4 -filter_complex "fps=50,scale=432:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 media/showcase.gif
```

The composition lives in [`tools/showcase.html`](../tools/showcase.html) and
[`tools/showcase.js`](../tools/showcase.js). It uses the library's public APIs and
the fictional faces from [`examples/shared.js`](../examples/shared.js), with
fixed material choices and pile placements for a consistent recording.

Credit for the renderer and card-effect inspirations remains in the
[acknowledgements](../README.md#acknowledgements).
