import type {Appearance, Artwork} from './appearance.js';
import type {mountPack as mountRendererPack} from './renderer.js';

export interface Labels {
  title: string;
  backCaption: string;
  open: string;
  swipe: string;
  tap: string;
  collectionEyebrow: string;
  personalEyebrow: string;
  mysteryEyebrow: string;
  collectionHeading: string;
  personalHeading: string;
  mysteryHeading: string;
  instruction: string;
  mysteryInstruction: string;
  skip: string;
  recipient: string;
  packCountOne: string;
  packCountMany: string;
  revealFirst: string;
  reveal: string;
  ready: string;
  mysteryReady: string;
  enableTilt: string;
  tiltUnavailable: string;
}
export const defaultLabels: Readonly<Labels>;
export interface PackData {label: string; recipient?: string}
export type RenderBack = (label: string, artwork: Artwork) => HTMLElement;
export type RenderPackArtwork = (data: PackData, collective: boolean, artwork: Artwork, hideRecipient?: boolean, title?: string, description?: string) => string;
export interface PackCardsConfig {
  labels?: Partial<Labels>;
  formatNumber?: (value: number) => string;
  formatLabel?: (label: string) => string;
  renderBack?: RenderBack;
  renderPackArtwork?: RenderPackArtwork;
  loadRenderer?: () => Promise<{mountPack: typeof mountRendererPack}>;
  createElement?: <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string | null, className?: string) => HTMLElementTagNameMap[K];
}
export type Dispose = () => void;
export interface PackDisposer {(): void; open(): void}
export interface FoilDisposer {(): void; pauseTilt(): void; resumeTilt(): void}
/** Forward the received arrival object unchanged to mountCard. */
export interface Arrival {
  left: number;
  top: number;
  width: number;
  height: number;
  finished?: Promise<void>;
  animate?: (stage: HTMLElement, deck: HTMLElement, turn: HTMLElement) => {cancel(): void} | null;
}
export type OnOpen = (arrival?: Arrival | null) => void | Promise<unknown>;
export interface PackOptions {
  label?: string;
  recipient?: string;
  /** Positive safe integer; defaults to one. */
  count?: number;
  packCount?: number;
  artwork?: Artwork;
  appearance?: Appearance;
  title?: string;
  description?: string;
  openLabel?: string;
  mystery?: boolean;
  hideRecipient?: boolean;
  autoRevealFirst?: boolean;
  focus?: boolean;
  measureArrival?: boolean;
  isActive?: () => boolean;
  onOpening?: () => void;
  /** Can run synchronously for instant opening, before mountPack returns. */
  onOpen?: OnOpen;
  onInteract?: () => void;
  onRest?: () => void;
}
export interface CardOptions {
  label?: string;
  remaining?: number;
  artwork?: Artwork;
  appearance?: Appearance;
  backwards?: boolean;
  answer?: boolean;
  onNavigate?: ((direction: 1 | -1) => void) | null;
  arrival?: Arrival | null;
}
export interface ReadyDeckOptions {
  label?: string;
  remaining?: number;
  artwork?: Artwork;
  appearance?: Appearance;
  autoReveal?: boolean;
  onReveal?: () => void;
}
export interface MountedCard {stage: HTMLElement; dispose: Dispose; cancelArrival: Dispose}
export interface MountedReadyDeck {stage: HTMLElement; card: HTMLButtonElement; dispose: Dispose}
export interface PackCards {
  mountPack(host: HTMLElement, options?: PackOptions): PackDisposer;
  mountCard(card: HTMLElement, options?: CardOptions): MountedCard;
  mountReadyDeck(options?: ReadyDeckOptions): MountedReadyDeck;
  mountFoil(element: HTMLElement, appearance?: Appearance): FoilDisposer;
  mountBackFoil(element: HTMLElement, appearance?: Appearance): Dispose;
  renderBack: RenderBack;
  renderPackArtwork: RenderPackArtwork;
  applyPalette(element: HTMLElement, artwork: Artwork): void;
  applyBackAppearance(element: HTMLElement, appearance?: Appearance): void;
  /** Legacy positional APIs; prefer the named-option methods above. */
  mountRecapPack(host: HTMLElement, data: PackData, collective: boolean, count: number, artwork: Artwork, onOpen: OnOpen, appearance?: Appearance, options?: PackOptions): PackDisposer;
  mountRecapCardDeck(card: HTMLElement, label: string, remaining: number, artwork: Artwork, options?: CardOptions): MountedCard;
  mountRecapReadyDeck(label: string, remaining: number, artwork: Artwork, onReveal: () => void, options?: ReadyDeckOptions): MountedReadyDeck;
  mountRecapFoil: PackCards['mountFoil'];
  mountRecapBackFoil: PackCards['mountBackFoil'];
}
/** Safe to import during SSR. Call DOM/canvas methods only in the browser. */
export function createPackCards(config?: PackCardsConfig): Readonly<PackCards>;
