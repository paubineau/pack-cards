import {createPackCards} from './presentation.js';
import {createAppearanceSettings, resolveAppearance} from './appearance.js';

// A view owns one host's current presentation. Content and navigation stay with
// the consumer; the lower-level factory remains available for custom lifecycles.
export function createPackView(host, {label='', artwork={}, appearance={}, ...config}={}) {
  if (!host?.ownerDocument || typeof host.replaceChildren!=='function') {
    throw new TypeError('createPackView requires a DOM host');
  }
  const presentation=createPackCards(config);
  const settings=value=>value?._resolved===true && value.version===5 ? value : createAppearanceSettings(value);
  const mergeArtwork=(base,overrides)=>({...base,...overrides,
    accent:overrides?.accent ?? base.accent,tint:overrides?.tint ?? base.tint});
  const defaults={label, artwork:mergeArtwork({accent:'#e8c477',tint:'#3a3020'},artwork),
    appearance:settings(appearance)};
  let disposed=false, generation=0, owned=null;
  let release=()=>{}, openCurrent=()=>{};
  const active=token=>!disposed && token===generation;

  function clearMount() {
    const previous=release;
    release=()=>{}; openCurrent=()=>{};
    previous();
  }

  function validateFace(face) {
    if (!face?.ownerDocument || typeof face.classList?.add!=='function' || face===host || face.contains(host)) {
      throw new TypeError('The card face must be a DOM element other than the host or its ancestors');
    }
  }

  function mountCard(face, options, arrival=null) {
    validateFace(face);
    const {identity='card', rarity=null, artwork:overrides, appearance:input=defaults.appearance, ...cardOptions}=options;
    const cardArtwork=mergeArtwork(defaults.artwork,overrides);
    const resolved=resolveAppearance(settings(input),cardArtwork,identity,rarity);
    const focus=owned?.contains(host.ownerDocument.activeElement);
    if (face.ownerDocument!==host.ownerDocument) host.ownerDocument.adoptNode(face);
    const previous=release;
    // Animated arrivals must be claimed before the outgoing pack is released.
    if (!arrival) clearMount();
    const mounted=presentation.mountCard(face,{
      label:defaults.label,...cardOptions,artwork:cardArtwork,appearance:resolved,arrival,
    });
    if (arrival) previous();
    presentation.applyPalette(mounted.stage,cardArtwork);
    host.replaceChildren(mounted.stage);
    owned=mounted.stage; release=mounted.dispose; openCurrent=()=>{};
    if (focus) {
      if (face.getAttribute('tabindex')===null) face.setAttribute('tabindex','-1');
      face.focus({preventScroll:true});
    }
  }

  function showCard(face, options={}) {
    if (disposed) return;
    validateFace(face);
    generation++;
    mountCard(face,options);
  }

  function showPack({renderCard,onReveal,onError,artwork:overrides,appearance:input=defaults.appearance,
    label:packLabel=defaults.label,count=1,autoRevealFirst=true,focus=false,...options}={}) {
    if (disposed) return;
    if (typeof renderCard!=='function') throw new TypeError('showPack requires renderCard');
    if (!Number.isSafeInteger(count) || count<1) throw new RangeError('count must be a positive safe integer');
    const token=++generation;
    const packArtwork=mergeArtwork(defaults.artwork,overrides);
    const packAppearance=settings(input);
    clearMount();
    host.replaceChildren(); owned=null;

    function fail(error) {
      if (!active(token)) return;
      clearMount();
      const message=host.ownerDocument.createElement('p');
      message.setAttribute('role','alert');
      message.textContent='Unable to display this card.';
      host.replaceChildren(message); owned=message;
      onError?.(error);
    }

    async function reveal(arrival) {
      // Instant opening invokes onOpen before mountPack returns its disposer.
      await Promise.resolve();
      if (!active(token)) return;
      let result;
      try {
        result=await renderCard();
        if (!active(token)) return;
        if (!result || typeof result!=='object') throw new TypeError('renderCard must return {face, ...options}');
        const {face,...cardOptions}=result;
        mountCard(face,{label:packLabel,remaining:count-1,appearance:packAppearance,
          ...cardOptions,artwork:mergeArtwork(packArtwork,cardOptions.artwork)},arrival);
      } catch (error) {
        fail(error);
        return;
      }
      onReveal?.(result);
    }

    const pack=presentation.mountPack(host,{
      ...options,label:packLabel,count,autoRevealFirst,focus,
      artwork:packArtwork,appearance:packAppearance,
      isActive:()=>active(token),onOpen:reveal,
    });
    // A synchronous onOpening hook is allowed to replace or dispose this view.
    if (!active(token)) { pack(); return; }
    release=pack; openCurrent=pack.open;
    owned=host.firstElementChild;
    if (owned) presentation.applyPalette(owned,packArtwork);
  }

  function dispose() {
    if (disposed) return;
    disposed=true; generation++;
    clearMount();
    if (owned?.parentElement===host) owned.remove();
    owned=null;
  }

  return Object.freeze({showCard,showPack,open:()=>{if (!disposed) openCurrent();},dispose});
}
