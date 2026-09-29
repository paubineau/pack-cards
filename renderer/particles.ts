/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
export const FLECK_COUNT = 12
export const MAX_FLECKS = 96

export type Fleck = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  col: [number, number, number]
}

const FLECK_COLORS: Array<[number, number, number]> = [
  [1.0, 0.85, 0.95],
  [0.8, 0.95, 1.0],
  [0.95, 1.0, 0.85],
  [1.0, 0.95, 0.75],
]

export function spawnFlecks(cx: number, cy: number, rand: () => number, count: number = FLECK_COUNT): Fleck[] {
  return Array.from({ length: count }, () => ({
    x: cx + (rand() - 0.5) * 30,
    y: cy + (rand() - 0.5) * 16,
    vx: 60 + rand() * 160,
    vy: -(120 + rand() * 200),
    age: 0,
    life: 0.4 + rand() * 0.5,
    size: 3 + rand() * 4,
    col: FLECK_COLORS[Math.floor(rand() * FLECK_COLORS.length)],
  }))
}

// Warm foil sparks shed from the LIVE tear frontier as the finger drags. Hotter
// and shorter-lived than the cool completion flecks — they spit up and out from
// the rip line, then gravity arcs them back down.
const SPARK_COLORS: Array<[number, number, number]> = [
  [1.0, 0.92, 0.62],
  [1.0, 0.82, 0.42],
  [1.0, 0.98, 0.86],
  [1.0, 0.7, 0.32],
]

export function spawnSparks(cx: number, cy: number, rand: () => number, count: number): Fleck[] {
  return Array.from({ length: count }, () => ({
    x: cx + (rand() - 0.5) * 16,
    y: cy + (rand() - 0.5) * 10,
    vx: (rand() - 0.5) * 360,
    vy: -(120 + rand() * 260),
    age: 0,
    life: 0.22 + rand() * 0.38,
    size: 2 + rand() * 3,
    col: SPARK_COLORS[Math.floor(rand() * SPARK_COLORS.length)],
  }))
}
