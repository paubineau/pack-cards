/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
export const STRIP_VS = `
attribute vec2 aGrid;
uniform vec2 uCanvas;
uniform vec4 uPack;      // packX, packY, packW, packH (css px)
uniform float uStripH;   // strip band height px = (STRIP_RATIO+EDGE_AMP)*packH
uniform float uProgress; // 0..1 tear progress
uniform float uCurlR;    // curl radius px (tightens with progress)
// Flutter phase, pre-wrapped to [0, 2π) CPU-side. Deliberately NOT named
// uTime: the fragment stage declares uTime at mediump, and GLSL ES refuses
// to link a program whose stages share a uniform at different precisions
// (vertex default is highp) — ANGLE/Metal rejected exactly that.
uniform float uFlutterPhase;
uniform vec4 uFly;       // fly-off: dx, dy, rot(rad), unused
varying vec2 vGrid;
varying float vTheta;
void main(){
  // Tear travels LEFT → RIGHT: the frontier starts at the left edge and the
  // freed foil behind it (to its left) wraps around the moving roll.
  float frontierU = uProgress;
  float flatX = uPack.x + aGrid.x * uPack.z;
  float flatY = uPack.y + aGrid.y * uStripH;
  float frontierX = uPack.x + frontierU * uPack.z;
  float d = max(0.0, frontierU - aGrid.x) * uPack.z;
  float theta = d / uCurlR;
  // freed foil wraps around a vertical-axis cylinder at the frontier; the
  // (1-cos) term is depth toward the viewer, projected as upward lift.
  float x = d > 0.0 ? frontierX - sin(theta) * uCurlR : flatX;
  float lift = (1.0 - cos(theta)) * uCurlR;
  float freed = clamp(theta / 0.8, 0.0, 1.0);
  float y = flatY - lift * 0.55
          + sin(uFlutterPhase + aGrid.x * 14.0) * uPack.w * 0.012 * freed;
  // fly-off rigid transform about the finished roll (right edge, mid-strip)
  vec2 pivot = vec2(uPack.x + uPack.z, uPack.y + uStripH * 0.5);
  vec2 p = vec2(x, y) - pivot;
  float c = cos(uFly.z);
  float s = sin(uFly.z);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + pivot + uFly.xy;
  vGrid = aGrid;
  vTheta = theta;
  gl_Position = vec4(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0, 0.0, 1.0);
}`

// Foil strip: pack art masked below the jag, flat tone IDENTICAL to the DOM
// art (shade = 1.0 at theta = 0) so the idle seam is invisible; curl adds a
// facet shade, a specular band, and a thin-film iridescent ramp. Output is
// PREMULTIPLIED alpha. uGeom = (STRIP_RATIO, EDGE_AMP, DOM_CLIP_RATIO, aa).
export const STRIP_FS = `
precision mediump float;
varying vec2 vGrid;
varying float vTheta;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform float uTime;
uniform vec4 uGeom;
uniform float uFade;
uniform vec2 uHint;
uniform float uWhiteout;
void main(){
  float artY = vGrid.y * (uGeom.x + uGeom.y);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  vec4 base = texture2D(uTex, uv);
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float a = base.a * (1.0 - smoothstep(-uGeom.w, uGeom.w, artY - edgeY));
  float sgn = sin(vTheta);
  float shade = 1.0 + 0.4 * max(0.0, sgn) - 0.3 * max(0.0, -sgn);
  float specBand = pow(max(0.0, cos(vTheta - 1.1)), 24.0);
  float sweep = fract(vGrid.x * 0.85 - uTime * 0.05);
  float sheen = pow(max(0.0, 1.0 - abs(sweep * 2.0 - 1.0) * 2.2), 10.0) * 0.4;
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vTheta * 0.45 + vGrid.x * 1.4) + vec3(0.0, 2.094, 4.188));
  // A soft travelling catch follows the sealed edge only while idle.
  float glow = (0.8 * exp(-pow(abs(vGrid.x - uHint.x) / 0.13, 2.0)) + 0.3 * exp(-pow(abs(vGrid.x - uHint.x + 0.1) / 0.22, 2.0))) * exp(-abs(artY - mix(uGeom.x, edgeY, 0.2)) * 110.0) * uHint.y;
  vec3 col = base.rgb * shade + irid * (specBand * 0.55 + sheen * 0.25) + vec3(1.0) * specBand * 0.18
           + vec3(1.0, 0.84, 0.45) * glow;
  // climax white-out: the flung strip burns to white before it fades, so the
  // detaching foil reads as a streak of light, not a dark scrap.
  col = mix(col, vec3(1.0), uWhiteout);
  float outA = a * uFade;
  gl_FragColor = vec4(col * outA, outA);
}`

export const FLAT_VS = `
attribute vec2 aGrid;
uniform vec2 uCanvas;
uniform vec4 uRect;      // x, y, w, h in css px
varying vec2 vGrid;
void main(){
  vGrid = aGrid;
  vec2 px = uRect.xy + aGrid * uRect.zw;
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);
}`

// Remainder sliver: pack art between the jag and the straight DOM line. Its
// mask is the exact complement of the strip's (same edge texture, mirrored
// smoothstep — the two alphas sum to 1 on every pixel of the jag band).
export const REMAINDER_FS = `
precision mediump float;
uniform float uReveal;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform vec4 uGeom;
uniform vec2 uHint;
uniform float uWhiteout;
void main(){
  float y0 = uGeom.x - uGeom.y;
  float artY = y0 + vGrid.y * (uGeom.z - y0);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  vec4 base = texture2D(uTex, uv);
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float a = base.a * smoothstep(-uGeom.w, uGeom.w, artY - edgeY);
  // Match the strip's catch across the complementary edge masks.
  vec3 col = base.rgb + vec3(1.0, 0.84, 0.45) * ((0.8 * exp(-pow(abs(vGrid.x - uHint.x) / 0.13, 2.0)) + 0.3 * exp(-pow(abs(vGrid.x - uHint.x + 0.1) / 0.22, 2.0))) * exp(-abs(artY - mix(uGeom.x, edgeY, 0.2)) * 110.0) * uHint.y);
  // the torn front lip catches a soft light, lifting it off the interior
  col += vec3(0.18, 0.17, 0.15) * exp(-max(0.0, artY - edgeY) * 90.0) * uReveal;
  // climax white-out: the standing pack body blows out to white as the strip
  // flies, dissolving into the reveal veil (uWhiteout drives both layers).
  col = mix(col, vec3(1.0), uWhiteout);
  gl_FragColor = vec4(col * a, a);
}`

// Pack interior behind the strip — the second layer that makes the opening
// read as a 3D pocket. A real tear rips through BOTH walls, so the lining
// (uInner texture) is only a BAND: the back wall's own softly wavy torn lip
// sits a little below the front's, with open air above it. The front wall
// stands proud and casts a deep shadow onto the recessed lining (the depth
// cue between pack front and inside), plus a contact shadow under the curl
// (uFrontier). Confined to the pack silhouette via the art texture's alpha,
// faded in with uReveal so the idle frame shows no perforation line.
export const INTERIOR_FS = `
precision mediump float;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform sampler2D uInner;
uniform vec4 uGeom;
uniform float uReveal;
uniform float uFrontier;
uniform float uCurlShadow;
uniform vec3 uGlowColor;
uniform float uGlowAmt;
uniform float uWhiteout;
void main(){
  float artY = vGrid.y * (uGeom.x + uGeom.y);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  float packA = texture2D(uTex, uv).a;
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float inside = 1.0 - smoothstep(-uGeom.w, uGeom.w, artY - edgeY);
  // The back wall's own torn lip: same tear character as the front (the
  // edge texture wraps — REPEAT — so this is a phase-shifted copy). Both
  // walls tore TOGETHER at the side seams, so the two paths share their
  // start/end points: the back path is pinned to the front path at x=0 and
  // x=1 and only diverges between them.
  float backRaw = uGeom.x - 0.06 + (texture2D(uEdge, vec2(vGrid.x + 0.37, 0.5)).r - 0.5) * 0.018;
  float pin = smoothstep(0.0, 0.16, vGrid.x) * smoothstep(1.0, 0.84, vGrid.x);
  float backEdge = mix(edgeY, backRaw, pin);
  float backMask = smoothstep(backEdge - uGeom.w * 2.0, backEdge + uGeom.w * 2.0, artY);
  vec3 lining = texture2D(uInner, vGrid).rgb;
  float depth = clamp(artY / uGeom.x, 0.0, 1.0);
  vec3 col = lining * mix(0.7, 1.05, depth);
  col *= mix(0.75, 1.0, sin(3.1416 * vGrid.x));
  // the prize inside lights the lining (shadows below still modulate it)
  col += uGlowColor * (uGlowAmt * 0.3);
  // the back wall's torn lip catches a faint matte sliver, not a gloss
  col += vec3(0.14, 0.135, 0.16) * exp(-max(0.0, artY - backEdge) * 140.0) * backMask;
  // front wall's torn edge casts a soft, wide shadow onto the recessed
  // lining — gentle gradient, not a hard stain
  col *= 1.0 - 0.5 * exp(-max(0.0, edgeY - artY) * 55.0);
  // the curl's contact shadow rides away with the strip (uCurlShadow = fade)
  col *= 1.0 - (0.5 * uCurlShadow) * exp(-abs(vGrid.x - uFrontier) * 12.0);
  // climax white-out: the opened interior floods white in lock-step with the
  // pack body so the whole thing burns out together before the reveal.
  col = mix(col, vec3(1.0), uWhiteout);
  float a = packA * backMask * inside * 0.96 * uReveal;
  gl_FragColor = vec4(col * a, a);
}`

// Inner glow: a soft elliptical bloom centered on the torn opening, drawn
// ADDITIVELY between the interior/remainder and the strip. Light only
// escapes through the opening: wherever the front wall still stands (below
// its torn edge, inside the pack silhouette) the bloom is occluded
// in-shader, so the glow never sits in front of the pack face. The strip
// occludes the rest by draw order. Color is random per mount (rarity
// mapping comes later); intensity ramps with glowRamp().
// NOTE: the canvas-size uniform is uCanvasPx, NOT uCanvas — FLAT_VS already
// declares uCanvas at vertex-default highp and sharing the name from this
// mediump fragment stage would fail to link (see the uTime lesson).
export const GLOW_FS = `
precision mediump float;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform vec3 uGlowColor;
uniform float uGlowAmt;
uniform vec2 uGlowCenter;
uniform vec2 uGlowScale;
uniform vec2 uCanvasPx;
uniform vec4 uPack;
uniform vec4 uGeom;
void main(){
  vec2 d = (vGrid - uGlowCenter) * uGlowScale;
  d.y *= d.y > 0.0 ? 1.6 : 1.0;
  float fall = exp(-dot(d, d) * 2.2);
  vec2 px = vGrid * uCanvasPx;
  vec2 packUV = vec2((px.x - uPack.x) / uPack.z, (px.y - uPack.y) / uPack.w);
  vec2 puv = clamp(packUV, vec2(0.0), vec2(1.0, uGeom.z));
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(puv.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float artA = texture2D(uTex, vec2(puv.x, 1.0 - puv.y / uGeom.z)).a;
  float inPack = step(0.0, packUV.x) * step(packUV.x, 1.0) * step(0.0, packUV.y) * step(packUV.y, uGeom.z);
  // Soft front-wall occlusion for the glow (wide, not a 1px edge) so the beam
  // fades out gradually below the tear line instead of a hard horizontal cut.
  float front = smoothstep(-0.06, 0.06, packUV.y - edgeY);
  float cover = inPack * front * artA;
  // Stacked V-beams from one apex DEEP inside the pack (~62% down): a
  // narrow bright core cone (slope 0.6) plus a wider, fainter halo cone
  // (slope 1.15 at 40%) — the layered god-ray look. Below the apex: nothing.
  float dyUp = 0.62 - packUV.y;
  float lat = abs(packUV.x - 0.5);
  float halfW = 0.6 * dyUp;
  float coneCore = dyUp > 0.0 ? 1.0 - smoothstep(halfW * 0.2, halfW * 1.1, lat) : 0.0;
  float halfW2 = 1.15 * dyUp;
  float coneHalo = dyUp > 0.0 ? 1.0 - smoothstep(halfW2 * 0.35, halfW2 * 1.0, lat) : 0.0;
  // Blend the core + halo into ONE soft falloff (no hard bright-core/faint-halo
  // step) so it reads as a single god-ray, not two stacked beams.
  float cone = clamp(coneCore * 0.75 + coneHalo * 0.5, 0.0, 1.0);
  // Inside the pack the aperture still pinches closed at the side seams
  // (same pin profile as the back lip); above the pack top the cone is free
  // to widen past the pack edges.
  float pin = smoothstep(0.0, 0.16, packUV.x) * smoothstep(1.0, 0.84, packUV.x);
  // Soft (not stepped) transition from the pinched in-pack aperture to the free,
  // wider beam above the pack top — a hard step here left a hard horizontal cut at
  // the pack edge, splitting the glow into two distinct bands.
  float pinned = mix(1.0, pin, smoothstep(-0.12, 0.06, packUV.y));
  // Canvas-edge vignette (vGrid spans the whole glow quad 0..1): the god-ray
  // must reach zero BEFORE any canvas edge or additive blending leaves a hard
  // rectangular seam — the "boxed / cut-off glow" dogfood bug. The upward beam
  // approaches the top edge (vGrid.y→0), so that side gets the widest feather.
  float vig = smoothstep(0.0, 0.18, vGrid.x) * smoothstep(1.0, 0.82, vGrid.x)
            * smoothstep(0.0, 0.30, vGrid.y) * smoothstep(1.0, 0.90, vGrid.y);
  float a = uGlowAmt * fall * cone * pinned * (1.0 - cover) * vig;
  gl_FragColor = vec4(uGlowColor * a * 0.55, a * 0.18);
}`

export const FLECK_VS = `
attribute vec2 aPos;
attribute float aSize;
attribute vec4 aCol;
uniform vec2 uCanvas;
varying vec4 vCol;
void main(){
  vCol = aCol;
  gl_PointSize = aSize;
  gl_Position = vec4(aPos.x / uCanvas.x * 2.0 - 1.0, 1.0 - aPos.y / uCanvas.y * 2.0, 0.0, 1.0);
}`

export const FLECK_FS = `
precision mediump float;
varying vec4 vCol;
void main(){
  vec2 pc = gl_PointCoord - vec2(0.5);
  float a = smoothstep(0.5, 0.1, length(pc)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`
