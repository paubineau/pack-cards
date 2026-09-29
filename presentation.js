import {recapAppearanceDefaults} from './appearance.js';
import {createArtwork} from './presentation/artwork.js';
import {mountRecapPack as mountPack} from './presentation/pack.js';
import {mountRecapReadyDeck as mountReadyDeck,mountRecapCardDeck as mountCardDeck} from './presentation/deck.js';
import {applyRecapPalette,applyRecapBackAppearance,mountRecapFoil as mountFoil,mountRecapBackFoil as mountBackFoil} from './presentation/motion.js';

export const defaultLabels=Object.freeze({
  title:'Card collection',backCaption:'COLLECT & DISCOVER',open:'Open pack',swipe:'Swipe right to open',tap:'Tap to open',
  collectionEyebrow:'Collection',personalEyebrow:'Your collection',mysteryEyebrow:'Mystery pack',
  collectionHeading:'Your pack is ready.',personalHeading:'Your pack is ready.',mysteryHeading:'What is inside?',
  instruction:'Open your pack',mysteryInstruction:'Open the pack to discover a card',skip:'Skip opening',
  recipient:'For {recipient}',packCountOne:'pack in the stack',packCountMany:'packs in the stack',
  revealFirst:'Reveal the first card',reveal:'Reveal card',ready:'Tap to reveal your first card.',
  mysteryReady:'Reveal your mystery card.',enableTilt:'Enable device tilt',tiltUnavailable:'Device tilt unavailable'
});

// Each factory owns its configuration. Importing this module never touches the DOM.
export function createPackCards(config={}) {
  config={...config};
  const labels={...defaultLabels,...config.labels};
  const formatLabel=config.formatLabel || (value=>value);
  const formatNumber=config.formatNumber || (value=>new Intl.NumberFormat('en').format(value));
  const loadRenderer=config.loadRenderer || (()=>import('./renderer.js'));
  const context=node=>({...createArtwork(config,labels,node),formatLabel,formatNumber,loadRenderer});
  const mountRecapPack=(host,...args)=>mountPack(context(host),host,...args);
  const mountRecapCardDeck=(card,...args)=>mountCardDeck(context(card),card,...args);
  const mountRecapReadyDeck=(...args)=>mountReadyDeck(context(),...args);
  const mountRecapFoil=(deck,...args)=>mountFoil(context(deck),deck,...args);
  const mountRecapBackFoil=(deck,...args)=>mountBackFoil(context(deck),deck,...args);
  const recapCardBack=config.renderBack || ((...args)=>context().recapCardBack(...args));
  const recapPackArtwork=config.renderPackArtwork || ((...args)=>context().recapPackArtwork(...args));
  return Object.freeze({
    mountPack(host,{label='',recipient='',count=1,artwork={},appearance=recapAppearanceDefaults,onOpen=()=>{},...options}={}) {
      if (!Number.isSafeInteger(count) || count<1) throw new RangeError('count must be a positive safe integer');
      return mountRecapPack(host,{label,recipient},!recipient && !options.mystery,count,artwork,onOpen,appearance,options);
    },
    mountCard(card,{label='',remaining=0,artwork={},...options}={}) {
      card.classList.add('recap-card','recap-collectible');
      return mountRecapCardDeck(card,label,remaining,artwork,options);
    },
    mountReadyDeck({label='',remaining=0,artwork={},onReveal=()=>{},...options}={}) {
      return mountRecapReadyDeck(label,remaining,artwork,onReveal,options);
    },
    mountFoil:mountRecapFoil, mountBackFoil:mountRecapBackFoil,
    renderBack:recapCardBack, renderPackArtwork:recapPackArtwork,
    applyPalette:applyRecapPalette, applyBackAppearance:applyRecapBackAppearance,
    // Compatibility surface for existing positional consumers during migration.
    mountRecapPack, mountRecapCardDeck, mountRecapReadyDeck, mountRecapFoil, mountRecapBackFoil
  });
}
