/** RGBA data is read synchronously and never mutated or retained. */
export interface GifFrame {
  pixels: Uint8Array | Uint8ClampedArray | ArrayBuffer;
  /** Integer dimensions in the GIF range 1–65535; identical for every frame. */
  width: number;
  height: number;
  /** Milliseconds, rounded to GIF's 10 ms precision. Defaults to 0. */
  delay?: number;
}

export interface GifEncoderOptions {
  /** 0 loops forever (default), -1 disables looping; otherwise 1–65535 repeats. */
  repeat?: number;
}

export interface GifEncoder {
  /** Add one complete frame. Alpha below 128 is transparent. Throws after finish. */
  writeFrame(frame: GifFrame): void;
  /** Complete the GIF and return owned bytes. Requires a frame; safe to call again. */
  finish(): Uint8Array;
}

/** Optional synchronous encoder; usable in Node, browsers, and dedicated workers. */
export function createGifEncoder(options?: GifEncoderOptions): GifEncoder;
