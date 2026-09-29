export interface SnapshotOptions {
  /** Apply app-specific text or other visual adjustments to the copied face. */
  prepareClone?: (copy: HTMLElement, source: HTMLElement) => void;
}
/**
 * Copy canvas pixels, current material variables and scroll positions into an inert face.
 * Insert the result synchronously; scroll positions are restored again in a microtask
 * because detached elements do not have a scroll box. Event listeners are not copied.
 */
export function snapshotCard<T extends HTMLElement>(card: T, options?: SnapshotOptions): T;

export interface CardDragPreviewOptions extends SnapshotOptions {
  /** Additional CSS classes on the preview container. */
  className?: string;
  /** Additional CSS classes on the full-size inner face. */
  faceClassName?: string;
  /** Maximum preview width in CSS pixels. Default: 190. */
  maxWidth?: number;
  /** Maximum scale relative to the visible card width. Default: 0.9. */
  maxScale?: number;
  /** Vertical viewport space reserved on each side in CSS pixels. Default: 16. */
  viewportPadding?: number;
  /** Defaults to the card document's prefers-reduced-motion setting. */
  reducedMotion?: boolean;
}
export interface CardDragPreview {
  preview: HTMLDivElement;
  width: number;
  height: number;
  grabX: number;
  grabY: number;
  /** Cancel the pickup animation and remove the preview; safe to call repeatedly. */
  dispose(): void;
}
/**
 * Requires a visible card and snapshots.css. Append preview, then place it at
 * (clientX - grabX, clientY - grabY). The caller owns dragging and drop handling.
 */
export function createCardDragPreview(card: HTMLElement, clientX: number, clientY: number,
  options?: CardDragPreviewOptions): CardDragPreview;
