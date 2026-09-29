/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
/** Pure gesture, geometry, and phase-transition logic for the pack tear. */

// ---- geometry (fractions of the pack box height H) --------------------------

/** Nominal jagged tear line, measured down from the pack top. */
export const STRIP_RATIO = 0.22
/** Edge raggedness amplitude around the tear line — small angular facets. */
export const EDGE_AMP = 0.016
/** Straight line where the GL overlay hands off to the DOM pack-body img. */
export const DOM_CLIP_RATIO = 0.3

// ---- gesture tuning ----------------------------------------------------------

/** A full tear is this fraction of the strip width of rightward travel. */
export const TRAVEL_RATIO = 0.85
/** Raw-travel fraction that resists before the foil "gives". */
export const STIFF_ZONE = 0.12
/** Progress gain inside the stiff zone (slope; <1 = resists). */
export const STIFF_GAIN = 0.4
/** Release at/past this progress → the tear completes. */
export const COMMIT_PROGRESS = 0.55
/** A flick (in the tear direction) at/above this progress/second tears early… */
export const FLICK_VELOCITY = 1.6
/** …but a sub-6%-travel twitch never tears. */
export const MIN_FLICK_PROGRESS = 0.06
/** Pointer samples older than this are ignored for velocity. */
export const VELOCITY_WINDOW_MS = 120

// ---- animation timing (ms) ----------------------------------------------------

export const SPRINGBACK_MS = 250
export const TEAR_SNAP_MS = 320
export const CANNED_TEAR_MS = 600
/**
 * Torn top-strip fly-off duration. Extended from 900ms so the falling strip is
 * unmistakable before the deck opens — the strip's fade-out is keyed off this
 * (fade begins at ~55% of the fly), so a longer fly means a longer visible
 * fall, not just a longer wait.
 */
export const FLYOFF_MS = 1500

export const EDGE_SAMPLES = 256

// ---- small math ----------------------------------------------------------------

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Ease-out cubic — springback settle. */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t)
  return 1 - u * u * u
}

/** Ease-in-out quad — tear snap / canned tear. */
export function easeInOutQuad(t: number): number {
  const u = clamp01(t)
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
}

// ---- gesture maths ---------------------------------------------------------------

/**
 * Foil resistance: stiff for the first STIFF_ZONE of raw travel, then linear
 * to 1. Continuous (the two pieces meet at the knee) and monotonic.
 */
export function applyResistance(raw: number): number {
  const r = clamp01(raw)
  if (r <= STIFF_ZONE) return r * STIFF_GAIN
  const knee = STIFF_ZONE * STIFF_GAIN
  return knee + (r - STIFF_ZONE) * ((1 - knee) / (1 - STIFF_ZONE))
}

/** Exact inverse of applyResistance — used to re-grab mid-springback. */
export function resistanceInverse(progress: number): number {
  const p = clamp01(progress)
  const knee = STIFF_ZONE * STIFF_GAIN
  if (p <= knee) return p / STIFF_GAIN
  return STIFF_ZONE + (p - knee) * ((1 - STIFF_ZONE) / (1 - knee))
}

/** Tear progress [0,1] for a left-to-right drag from startX to currentX. */
export function dragProgress(startX: number, currentX: number, stripWidth: number): number {
  if (stripWidth <= 0) return 0 // also guards negative (invalid) widths
  return applyResistance((currentX - startX) / (stripWidth * TRAVEL_RATIO))
}

export type PointerSample = { t: number; p: number }

/**
 * Tear velocity in progress/second (positive = toward completion): oldest
 * in-window sample vs the newest. 0 when fewer than two samples land inside
 * VELOCITY_WINDOW_MS.
 * Samples must be ordered oldest-first (the component appends in move order).
 */
export function velocityFrom(samples: PointerSample[], now: number): number {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS)
  if (recent.length < 2) return 0
  const a = recent[0]
  const b = recent[recent.length - 1]
  if (b.t <= a.t) return 0
  return ((b.p - a.p) / (b.t - a.t)) * 1000
}

/** What releasing the pointer does at this progress/velocity. */
export function releaseDecision(progress: number, velocity: number): 'tear' | 'springback' {
  if (progress >= COMMIT_PROGRESS) return 'tear'
  if (velocity >= FLICK_VELOCITY && progress >= MIN_FLICK_PROGRESS) return 'tear'
  return 'springback'
}

// ---- inner glow -------------------------------------------------------------

/** Inner glow starts leaking out of the pack at this progress… */
export const GLOW_START_PROGRESS = 0.1
/** …and maxes out at the commit threshold (the critical tear point). */
export const GLOW_MAX_PROGRESS = COMMIT_PROGRESS

/** Inner-glow intensity [0,1] — 0 until GLOW_START_PROGRESS, 1 at GLOW_MAX_PROGRESS. */
export function glowRamp(progress: number): number {
  return clamp01((progress - GLOW_START_PROGRESS) / (GLOW_MAX_PROGRESS - GLOW_START_PROGRESS)) ** 1.4
}

/** Named glow presets, independent of application data models. */
export type TearGlowTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export type TierGlow = { color: [number, number, number]; strength: number }

const TIER_GLOW: Record<TearGlowTier, TierGlow | null> = {
  // commons keep their secret — no light leaks from a bronze pack
  bronze: null,
  silver: { color: [0.78, 0.8, 0.88], strength: 0.45 },
  gold: { color: [1.0, 0.78, 0.35], strength: 0.75 },
  platinum: { color: [0.5, 0.86, 1.0], strength: 0.9 },
  diamond: { color: [0.78, 0.55, 1.0], strength: 1 },
}

/**
 * Rarity-gated glow: each tier has a signature color and strength (the glow
 * IS the rarity tell). Returns null for tiers that don't glow at all.
 */
export function tierGlow(tier: TearGlowTier): TierGlow | null {
  return TIER_GLOW[tier]
}

/** Random vivid glow color (hsl(h, 0.9, 0.62) → rgb), deterministic under rand. */
export function glowColor(rand: () => number): [number, number, number] {
  const h = rand() * 360
  const s = 0.9
  const l = 0.62
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m]
}

// ---- multi-pack intensity --------------------------------------------------

/**
 * Ritual intensity multiplier [1,2] from pack count — scales fleck count and
 * glow strength so a 10-pack rip reads as "more" without a second gesture.
 */
export function tearIntensityForCount(count: number): number {
  if (count <= 1) return 1
  return Math.min(2, 1 + (count - 1) / 9)
}

/** How many ghost packs to stack behind the torn pack (0 for a single pack). */
export function ghostStackForCount(count: number): number {
  return Math.max(0, Math.min(4, Math.floor(count) - 1))
}

// ---- jagged tear edge --------------------------------------------------------------

/**
 * 1D torn-edge profile: two octaves of value noise interpolated LINEARLY
 * (control points every 12 and every 3 samples), normalized to exactly
 * [0,1]. Linear segments give the small angular facets of real torn mylar —
 * smoothstep here reads as rounded "dripping" bumps, not a tear. The strip's
 * bottom edge and the remainder's top edge sample this SAME array with
 * complementary masks, so the torn edges partition every pixel.
 */
export function bakeTearEdge(rand: () => number, n: number = EDGE_SAMPLES): Float32Array {
  const out = new Float32Array(n)
  const layer = (step: number, amp: number) => {
    const points: number[] = []
    for (let i = 0; i <= Math.ceil(n / step) + 1; i++) points.push(rand())
    for (let i = 0; i < n; i++) {
      const x = i / step
      const i0 = Math.floor(x)
      const f = x - i0
      out[i] += amp * (points[i0] * (1 - f) + points[i0 + 1] * f)
    }
  }
  layer(12, 1)
  layer(3, 0.35)
  let mn = Infinity
  let mx = -Infinity
  for (const v of out) {
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  const span = mx - mn || 1
  for (let i = 0; i < n; i++) out[i] = (out[i] - mn) / span
  return out
}

// ---- phase reducer --------------------------------------------------------------------

export type TearPhase = 'idle' | 'grabbing' | 'springback' | 'tearing' | 'torn' | 'flyoff' | 'done'

export type TearEvent =
  | { type: 'grab' }
  | { type: 'release'; progress: number; velocity: number }
  | { type: 'canned-tear' }
  | { type: 'springback-done' }
  | { type: 'tear-done' }
  | { type: 'flyoff-start' }
  | { type: 'flyoff-done' }

/**
 * Phase transitions for the tear ritual. Events that don't apply to the
 * current phase are ignored — a pointerup after the tear committed, a second
 * keydown mid-flyoff, etc. simply return the phase unchanged.
 */
export function tearTransition(phase: TearPhase, ev: TearEvent): TearPhase {
  switch (ev.type) {
    case 'grab':
      return phase === 'idle' || phase === 'springback' ? 'grabbing' : phase
    case 'release':
      if (phase !== 'grabbing') return phase
      return releaseDecision(ev.progress, ev.velocity) === 'tear' ? 'tearing' : 'springback'
    case 'canned-tear':
      return phase === 'idle' || phase === 'springback' ? 'tearing' : phase
    case 'springback-done':
      return phase === 'springback' ? 'idle' : phase
    case 'tear-done':
      return phase === 'tearing' ? 'torn' : phase
    case 'flyoff-start':
      return phase === 'torn' ? 'flyoff' : phase
    case 'flyoff-done':
      return phase === 'flyoff' ? 'done' : phase
  }
}
