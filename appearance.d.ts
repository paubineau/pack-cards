export type Rarity = 'common' | 'uncommon' | 'rare' | 'super_rare' | 'epic' | 'legendary';
export type Opening = 'animated' | 'instant';
export type Motion = 'interactive' | 'still';
export type Glow = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'random';

export interface MaterialComponents {
  stock: 'paper' | 'metal';
  coating: 'matte' | 'satin' | 'gloss' | 'pearl';
  foil: 'none' | 'metallic' | 'holographic';
  coverage: 'none' | 'border' | 'full';
  pattern: 'none' | 'brushed' | 'guilloche' | 'dots' | 'stardust' | 'facets';
  engraving: 'none' | 'radial' | 'contour' | 'facets';
  decoration: 'none' | 'frame' | 'lettering' | 'frame-lettering';
  palette: 'channel' | 'silver' | 'spectrum' | 'ice' | 'amber' | 'rose';
  lighting: 'soft' | 'studio';
}
export type MaterialComponent = keyof MaterialComponents;
export type MaterialProfile = {[K in MaterialComponent]: MaterialComponents[K] | MaterialComponents[K][]};
export type DeepReadonly<T> = {readonly [K in keyof T]: DeepReadonly<T[K]>};

export interface Artwork {
  accent?: string;
  tint?: string;
  /** Images must be decoded before mounting; canvas exports require CORS access. */
  avatar?: HTMLImageElement;
  logo?: HTMLImageElement;
}

export interface AppearanceSettings {
  version: 5;
  opening: Opening;
  glow: Glow;
  pack_zoom: boolean;
  motion: Motion;
  card: MaterialProfile;
  rarities: Record<Rarity, MaterialProfile>;
}
export interface AppearanceSettingsInput {
  /** Omitted or unknown versions reset to the defaults. */
  version?: 5;
  opening?: Opening;
  glow?: Glow;
  pack_zoom?: boolean;
  motion?: Motion;
  card?: Partial<DeepReadonly<MaterialProfile>>;
  rarities?: Partial<Record<Rarity, Partial<DeepReadonly<MaterialProfile>>>>;
}
export type ResolvedAppearance = Readonly<MaterialComponents & {
  _resolved: true;
  version: 5;
  opening: Opening;
  glow: Exclude<Glow, 'random'>;
  pack_zoom: boolean;
  motion: Motion;
}>;
export type Appearance = AppearanceSettingsInput | DeepReadonly<AppearanceSettings> | ResolvedAppearance;
export interface AppearanceEntry {
  identity?: unknown;
  /** Unknown rarity names use the ordinary card profile. */
  rarity?: string | null;
}

export const recapRarityCodes: Record<Rarity, string>;
export const recapAppearanceChoices: {readonly [K in MaterialComponent]: readonly MaterialComponents[K][]};
export const recapAppearanceVariableComponents: readonly MaterialComponent[];
export const recapRarityAppearanceDefaults: DeepReadonly<Record<Rarity, MaterialProfile>>;
export const recapAppearanceDefaults: DeepReadonly<AppearanceSettings>;
export const recapAppearanceSettingChoices: {opening: Opening[]; glow: Glow[]; motion: Motion[]};
export function normalizeRecapAppearance(value?: unknown): AppearanceSettings;
export function normalizeRecapProfile(value?: unknown, fallback?: DeepReadonly<MaterialProfile>): MaterialProfile;
export function recapProfileChoices<K extends MaterialComponent>(value: unknown, key: K): MaterialComponents[K][];
export function recapProfileComponentEnabled(value: unknown, key: MaterialComponent): boolean;
export function recapMaterialComponentEnabled(components: Partial<DeepReadonly<MaterialProfile>>, key: MaterialComponent): boolean;
export function createRarityAppearanceResolver(value?: Appearance, artwork?: Artwork, collectionId?: unknown): (rarity: string | null | undefined, identity?: unknown) => ResolvedAppearance;
export function resolveRecapAppearances(value?: Appearance, artwork?: Artwork, entries?: readonly AppearanceEntry[], collectionId?: unknown): ResolvedAppearance[];
export function resolveRecapAppearance(value?: Appearance, artwork?: Artwork, identity?: unknown, rarity?: string | null): ResolvedAppearance;
export function resolveRecapCardAppearances(value?: Appearance, artwork?: Artwork, count?: number, identities?: readonly unknown[], collectionId?: unknown): ResolvedAppearance[];
export function resolveRarityCardAppearances(value?: Appearance, artwork?: Artwork, rarities?: readonly (string | null)[], identities?: readonly unknown[], collectionId?: unknown): ResolvedAppearance[];
export function recapAppearanceHash(identity: unknown): number;
export function recapMaterialPalette(accent: string | undefined, palette: MaterialComponents['palette']): string[];
export function recapAccentHsl(accent?: string): [number, number, number];
export function recapFoilColors(accent?: string): string;

/** Compatibility helpers retained from the original implementation. */
export function recapFreeze<T extends object>(value: T): DeepReadonly<T>;
export function recapObject(value: unknown): Record<string, unknown>;
export function recapChoice<T extends string, F>(value: unknown, choices: readonly T[], fallback: F): T | F;
export function recapAppearanceTarget(settings: DeepReadonly<AppearanceSettings>, rarity: string | null | undefined): Rarity | 'card';
export function resolveRecapProfile(settings: DeepReadonly<AppearanceSettings>, profile: DeepReadonly<MaterialProfile>, identity: unknown, select: <K extends MaterialComponent>(choices: readonly MaterialComponents[K][], axis: K) => MaterialComponents[K]): ResolvedAppearance;
/** Preferred names; recap-prefixed exports remain available for compatibility. */
export {recapAppearanceDefaults as appearanceDefaults, recapAppearanceChoices as appearanceChoices,
  normalizeRecapAppearance as normalizeAppearance, resolveRecapAppearance as resolveAppearance,
  resolveRecapAppearances as resolveAppearances};
