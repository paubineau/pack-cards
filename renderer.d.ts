import type {Glow} from './appearance.js';

export interface RendererOptions {
  artSrc: string;
  bodyArtSrc?: string;
  backLayer?: HTMLElement;
  width: number;
  height: number;
  glowTier?: Glow;
  packCount?: number;
  labels?: Partial<{open: string; swipe: string; tap: string}>;
  /** May run synchronously before mountPack returns. */
  onReady?: () => void;
  onInteract?: () => void;
  onRest?: () => void;
  onTorn?: () => void;
  onComplete?: () => void;
}
export interface RendererDisposer {(): void; setBodyArtwork(url: string): void}
/** Mount in the browser; defer disposal until outside renderer callbacks. */
export function mountPack(host: HTMLElement, options: RendererOptions): RendererDisposer;
