/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
import { DOM_CLIP_RATIO } from './physics.js'
import { mulberry32 } from './random.js'

/** Top DOM_CLIP_RATIO slice of the pack art at 2×, stretched to the box. */
export function bakeStripTexture(document: Document, img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const scale = 2
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width * scale))
  c.height = Math.max(1, Math.round(height * DOM_CLIP_RATIO * scale))
  const x = c.getContext('2d')
  if (!x) return c
  x.drawImage(
    img,
    0, 0, img.naturalWidth, img.naturalHeight * DOM_CLIP_RATIO,
    0, 0, c.width, c.height,
  )
  return c
}

/** Small seeded brushed-foil lining, independent of external assets. */
export function bakeInnerFallback(document: Document): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const x = c.getContext('2d')
  if (!x) return c
  const rand = mulberry32(42)
  const data = x.createImageData(c.width, c.height)
  for (let y = 0; y < c.height; y++) {
    const grain = rand() * 14
    for (let col = 0; col < c.width; col++) {
      const i = (y * c.width + col) * 4
      const shade = 55 + grain + 24 * Math.sin(col / 55) + rand() * 5
      data.data[i] = shade
      data.data[i + 1] = shade
      data.data[i + 2] = shade + 8
      data.data[i + 3] = 255
    }
  }
  x.putImageData(data, 0, 0)
  return c
}

/** 1D jag → 256×1 grayscale canvas for the edge texture. */
export function edgeToCanvas(document: Document, edge: Float32Array): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = edge.length
  c.height = 1
  const x = c.getContext('2d')
  if (!x) return c
  const data = x.createImageData(edge.length, 1)
  for (let i = 0; i < edge.length; i++) {
    const b = Math.round(edge[i] * 255)
    data.data[i * 4] = b
    data.data[i * 4 + 1] = b
    data.data[i * 4 + 2] = b
    data.data[i * 4 + 3] = 255
  }
  x.putImageData(data, 0, 0)
  return c
}
