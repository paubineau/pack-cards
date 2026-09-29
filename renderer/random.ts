/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
/** Deterministic 32-bit RNG; only the seeded generator is needed by the tear. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
