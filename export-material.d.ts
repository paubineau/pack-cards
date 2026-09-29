import type {Appearance, Artwork, ResolvedAppearance} from './appearance.js';

export interface ExportCardOptions {
  appearance?: Appearance;
  heading?: string;
  footer?: string;
  label?: string;
  drawBadge?: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  /** Skip drawing the stock/material background. */
  live?: boolean;
}
export interface ExportCardFrame {
  ctx: CanvasRenderingContext2D;
  accent: string;
  ink: string | CanvasGradient;
  left: number;
  width: number;
  top: number;
  bottom: number;
}
export function recapExportMaterialColors(accent: string | undefined, appearance: ResolvedAppearance): string[];
export function recapExportMaterialGradient(ctx: CanvasRenderingContext2D, accent: string | undefined, appearance: ResolvedAppearance): CanvasGradient;
export function drawRecapExportMaterial(ctx: CanvasRenderingContext2D, artwork?: Artwork, appearance?: Appearance): void;
export function recapExportInk(ctx: CanvasRenderingContext2D, accent: string, appearance?: Appearance): string | CanvasGradient;
export function drawRecapExportStock(ctx: CanvasRenderingContext2D, artwork?: Artwork, appearance?: Appearance): void;
/** Draws in 1080 by 1440 coordinates; requires an available 2D canvas context. */
export function recapExportCard(canvas: HTMLCanvasElement, artwork?: Artwork, options?: ExportCardOptions): ExportCardFrame;
