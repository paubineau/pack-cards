import type {Appearance, AppearanceSettingsOptions, Artwork} from './appearance.js';
import type {CardOptions, PackCardsConfig, PackOptions} from './presentation.js';

/** Versionless programmatic settings, saved settings, or a resolved material. */
export type ViewAppearance = AppearanceSettingsOptions | Appearance;
export interface PackViewOptions extends PackCardsConfig {
  label?: string;
  artwork?: Artwork;
  appearance?: ViewAppearance;
}
export interface ViewCardOptions extends Omit<CardOptions, 'appearance' | 'arrival'> {
  identity?: unknown;
  /** Unknown rarity names select the ordinary card profile. */
  rarity?: string | null;
  appearance?: ViewAppearance;
}
export interface RenderedCard extends ViewCardOptions {face: HTMLElement}
export interface ViewPackOptions extends Omit<PackOptions, 'onOpen' | 'isActive' | 'appearance'> {
  /** Return a fresh face. Pending results are ignored after replacement/disposal. */
  renderCard: () => RenderedCard | Promise<RenderedCard>;
  /** Called after the returned card has been mounted. */
  onReveal?: (card: RenderedCard) => void;
  /** Rendering failures also display a generic alert in the host. */
  onError?: (error: unknown) => void;
  appearance?: ViewAppearance;
}
export interface PackView {
  /** Replace the current presentation; rarity resolution and cleanup are automatic. */
  showCard(face: HTMLElement, options?: ViewCardOptions): void;
  /** Defaults: one card, automatic first reveal, no initial focus movement. */
  showPack(options: ViewPackOptions): void;
  open(): void;
  /** Terminal and idempotent. Later show/open calls do nothing. Removes only owned DOM. */
  dispose(): void;
}
/** Own a single host's presentation without owning application data or navigation. */
export function createPackView(host: HTMLElement, options?: PackViewOptions): Readonly<PackView>;
