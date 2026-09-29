import {
  appearanceDefaults, appearanceChoices, createPackCards, normalizeAppearance,
  resolveAppearance, resolveAppearances, createRarityAppearanceResolver,
  createExportCard, drawExportMaterial, drawExportStock,
  type AppearanceSettings, type ResolvedAppearance, type Artwork, type PackCardsConfig
} from 'pack-cards';
import {normalizeRecapProfile, recapProfileChoices, resolveRecapProfile} from 'pack-cards/appearance';
import {createPackCards as createPresentation} from 'pack-cards/presentation';
import {recapExportCard} from 'pack-cards/export-material';
import {mountPack as mountRendererPack} from 'pack-cards/renderer';
import 'pack-cards/styles.css';

const settings: AppearanceSettings = normalizeAppearance({version: 5});
settings.card.pattern = ['dots', 'facets'];
settings.rarities.rare.foil = 'holographic';
const artwork: Artwork = {accent: '#abcdef', tint: '#112233'};
const appearance: ResolvedAppearance = resolveAppearance(settings, artwork, 'card', 'rare');
const profile = normalizeRecapProfile({stock: 'paper'});
const choices: ('paper' | 'metal')[] = recapProfileChoices(profile, 'stock');
resolveRecapProfile(settings, profile, 'card', choices => choices[0]);
resolveAppearances(appearanceDefaults, artwork, [{identity: 1, rarity: 'custom'}] as const);
createRarityAppearanceResolver(settings)(null, 'card');

const config: PackCardsConfig = {
  labels: {open: 'Discover'},
  renderBack: label => {
    const back = document.createElement('div');
    back.textContent = label;
    return back;
  },
  createElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text ?? '';
    element.className = className ?? '';
    return element;
  },
  loadRenderer: () => import('pack-cards/renderer')
};
const cards = createPackCards(config);
const host = document.createElement('div');
const pack = cards.mountPack(host, {
  artwork, appearance: {version: 5, card: {stock: 'metal'}},
  async onOpen(arrival) {
    const card = cards.mountCard(document.createElement('article'), {
      artwork, appearance, arrival,
      onNavigate(direction) { const next: 1 | -1 = direction; void next; }
    });
    host.replaceChildren(card.stage);
    card.cancelArrival();
    card.dispose();
  }
});
pack.open();
pack();
const ready = cards.mountReadyDeck({onReveal() {}, autoReveal: true});
ready.card.disabled = true;
ready.dispose();
const foil = cards.mountFoil(host, settings);
foil.pauseTilt();
foil.resumeTilt();
foil();
cards.mountBackFoil(host)();
cards.applyPalette(host, artwork);
cards.applyBackAppearance(host, appearance);
cards.renderBack('collection', artwork);
cards.renderPackArtwork({label: 'collection'}, true, artwork);
cards.mountRecapPack(host, {label: 'collection'}, true, 1, artwork, () => {})();
cards.mountRecapCardDeck(document.createElement('article'), 'collection', 0, artwork).dispose();
cards.mountRecapReadyDeck('collection', 0, artwork, () => {}).dispose();
createPresentation();

const canvas = document.createElement('canvas');
const frame = createExportCard(canvas, artwork, {appearance, drawBadge(ctx, x, y) { ctx.fillText('*', x, y); }});
drawExportStock(frame.ctx, artwork, appearance);
drawExportMaterial(frame.ctx, artwork, appearance);
recapExportCard(canvas);
const renderer = mountRendererPack(host, {artSrc: '/pack.svg', width: 300, height: 400, glowTier: 'gold'});
renderer.setBodyArtwork('/preview.svg');
renderer();

// @ts-expect-error Normalized settings reject unknown stock values.
settings.card.stock = 'wood';
// @ts-expect-error Resolved materials are frozen and cannot be changed.
appearance.stock = 'paper';
// @ts-expect-error Defaults are deeply immutable.
appearanceDefaults.card.stock = 'paper';
// @ts-expect-error Choice lists are immutable.
appearanceChoices.stock.push('paper');
// @ts-expect-error The mount API requires a DOM host.
cards.mountPack('collection');
// @ts-expect-error Unsupported options are caught at the public boundary.
cards.mountCard(host, {appearance: {version: 5, motion: 'fast'}});
// @ts-expect-error The renderer requires dimensions.
mountRendererPack(host, {artSrc: '/pack.svg'});
void choices;
