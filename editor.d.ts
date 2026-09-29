import type {AppearanceSettings, AppearanceSettingsInput, DeepReadonly, MaterialComponent, MaterialComponents, Rarity} from './appearance.js';

export type AppearanceTarget = 'card' | Rarity;
export interface AppearanceEditorLabels {
  target?: string;
  card?: string;
  rarities?: Partial<Record<Rarity,string>>;
  components?: Partial<Record<MaterialComponent,string>>;
  choices?: {[K in MaterialComponent]?: Partial<Record<MaterialComponents[K],string>>};
  groups?: Partial<Record<'surface' | 'foil' | 'details' | 'color',string>>;
  instructions?: string;
  lastChoice?: string;
  fixedChoice?: string;
  choiceCount?: (count: number) => string;
  requiresFoil?: string;
  requiresLighting?: string;
  noLighting?: string;
  noFoil?: string;
  hasFoil?: string;
  reset?: string;
  settingsTitle?: string;
  settings?: Partial<Record<keyof AppearanceSettingControls,string>>;
  settingChoices?: {
    motion?: Partial<Record<AppearanceSettings['motion'],string>>;
    opening?: Partial<Record<AppearanceSettings['opening'],string>>;
    glow?: Partial<Record<AppearanceSettings['glow'],string>>;
  };
  settingsHelp?: string;
}
export interface AppearanceSettingControls {
  motion: HTMLSelectElement;
  opening: HTMLSelectElement;
  glow: HTMLSelectElement;
  pack_zoom: HTMLInputElement;
}
export interface AppearanceEditorOptions {
  initial?: AppearanceSettingsInput | DeepReadonly<AppearanceSettings>;
  labels?: AppearanceEditorLabels;
  /** Called for user edits and target selection; the supplied settings are a copy. */
  onChange?: (settings: AppearanceSettings, target: AppearanceTarget) => void;
  /** Defaults to a unique prefix per mounted editor. Supply a unique value if overriding. */
  idPrefix?: string;
  /** Render motion/opening/glow/zoom controls. Defaults to true. */
  showSettings?: boolean;
  /** Bind existing controls instead of rendering the shared settings section. */
  sharedControls?: Partial<AppearanceSettingControls>;
  /** Defaults to the container's ownerDocument. */
  document?: Pick<Document,'createElement'>;
}
export interface AppearanceEditor {
  root: HTMLDivElement;
  controls: Record<MaterialComponent,HTMLFieldSetElement> & Partial<AppearanceSettingControls> & {
    target: HTMLSelectElement;
    reset: HTMLButtonElement;
    choices: {[K in MaterialComponent]: Partial<Record<MaterialComponents[K],HTMLInputElement>>};
  };
  getSettings(): AppearanceSettings;
  getTarget(): AppearanceTarget;
  /** Replace settings without emitting onChange. */
  setSettings(value: AppearanceSettingsInput | DeepReadonly<AppearanceSettings>): void;
  /** Remove only this editor's generated elements and event handlers; safe to call twice. */
  dispose(): void;
}
export function createAppearanceEditor(container: HTMLElement, options?: AppearanceEditorOptions): AppearanceEditor;
