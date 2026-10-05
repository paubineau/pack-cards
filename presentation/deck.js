import {recapAppearanceDefaults,normalizeRecapAppearance,resolveRecapAppearance,recapMaterialPalette,recapFoilColors} from '../appearance.js';
import {mountRecapBackFoil,mountRecapFoil} from './motion.js';

export function mountRecapReadyDeck(context,channel,remaining,artwork,onReveal,{autoReveal=false,appearance=recapAppearanceDefaults}={}) {
  const {el,labels,recapCardBack}=context;
  const stage=el('div',null,'recap-deck-stage recap-ready-scene'),deck=el('div',null,'recap-deck');
  const window=stage.ownerDocument?.defaultView || globalThis.window;
  stage.setAttribute('data-pack-zoom',String(normalizeRecapAppearance(appearance).pack_zoom));
  for (let i=0;i<Math.min(remaining,2);i++) {
    const back=el('div',null,'recap-deck-under'); back.setAttribute('aria-hidden','true');
    back.append(recapCardBack(channel,artwork)); deck.append(back);
  }
  const card=el('button',null,'recap-ready-card'); card.type='button';
  card.setAttribute('aria-label',labels.reveal);
  const print=recapCardBack(channel,artwork); print.setAttribute('aria-hidden','true'); card.append(print);
  deck.append(card); stage.append(deck);
  const disposeFoil=mountRecapBackFoil(context,deck,appearance);
  let disposed=false,revealed=false,timer=0;
  function reveal() {
    if (disposed || revealed || !stage.isConnected) return;
    revealed=true; window.clearTimeout(timer); timer=0;
    onReveal();
  }
  card.onclick=reveal;
  // Let the caller attach the stage and keep its disposer, without a cosmetic pause.
  if (autoReveal===true) timer=window.setTimeout(reveal,0);
  return {stage,card,dispose:() => {
    disposed=true; window.clearTimeout(timer); timer=0;
    card.onclick=null; disposeFoil();
  }};
}

export function mountRecapCardDeck(context,card,channel,remaining,artwork,{backwards=false,answer=false,onNavigate=null,appearance=recapAppearanceDefaults,arrival=null}={}) {
  const {el,recapCardBack}=context;
  const window=card.ownerDocument?.defaultView || globalThis.window;
  appearance=resolveRecapAppearance(appearance,artwork);
  for (const key of ['stock','coating','foil','coverage','pattern','engraving','decoration','palette','lighting','motion'])
    card.setAttribute('data-'+key,appearance[key]);
  const lettering=appearance.decoration.includes('lettering'),engraved=appearance.engraving!=='none',pearl=appearance.coating==='pearl';
  card.setAttribute('data-effect',engraved ? lettering ? 'engraved-lettering' : 'engraved' : lettering ? pearl ? 'pearl-lettering' : 'lettering' : 'off');
  const colors=recapMaterialPalette(artwork.accent,appearance.palette);
  card.style.setProperty('--foil-channel-colors',recapFoilColors(artwork.accent));
  // Metallic foil uses tonal highlights; holographic foil keeps the original palette sweep.
  if (appearance.foil==='metallic')
    card.style.setProperty('--foil-colors',colors.map((color,index)=>`${color} ${index*25}%`).join(','));
  card.style.setProperty('--foil-strength',appearance.lighting==='soft' ? '.7' : '.95');
  card.style.setProperty('--foil-glare-strength',appearance.lighting==='soft' ? '.14' : '.23');
  card.style.setProperty('--foil-gloss',String({matte:0,satin:.6,gloss:1,pearl:1}[appearance.coating]));
  // Keep the palette visible in ordinary print, including cards without foil.
  card.style.setProperty('--accent',appearance.palette==='channel' ? artwork.accent || '#e8c477' : colors[1]);
  if (appearance.stock==='metal') {
    const stock=el('span',null,'recap-foil-stock'); stock.setAttribute('aria-hidden','true'); card.append(stock);
  }
  const framed=appearance.decoration.includes('frame');
  if (appearance.foil!=='none' || framed) {
    const foil=el('span',null,'recap-foil-surface'); foil.setAttribute('aria-hidden','true');
    if (appearance.foil!=='none') {
      foil.append(el('span',null,'recap-foil-texture'));
      if (['brushed','guilloche','dots'].includes(appearance.pattern)) foil.append(el('span',null,'recap-foil-pattern'));
    }
    if (framed) foil.append(el('span',null,'recap-foil-details'));
    card.append(foil);
  }
  if (appearance.coating!=='matte') {
    const glare=el('span',null,'recap-foil-glare'); glare.setAttribute('aria-hidden','true'); card.append(glare);
  }
  if (pearl) {
    const sheen=el('span',null,'recap-foil-pearl'); sheen.setAttribute('aria-hidden','true');
    for (const layer of ['texture','gleam','sweep']) sheen.append(el('span',null,'recap-pearl-'+layer));
    card.append(sheen);
  }
  if (engraved) {
    const foil=el('span',null,'recap-foil-effect'); foil.setAttribute('aria-hidden','true');
    for (const layer of ['relief','texture','gleam','sweep']) foil.append(el('span',null,'recap-effect-'+layer));
    card.append(foil);
  }
  const stage=el('div',null,'recap-deck-stage');
  stage.setAttribute('data-pack-zoom',String(appearance.pack_zoom));
  stage.setAttribute('data-motion',appearance.motion);
  const deck=el('div',null,'recap-deck');
  for (let i=0;i<Math.min(remaining,2);i++) {
    const back=el('div',null,'recap-deck-under'); back.setAttribute('aria-hidden','true');
    back.append(recapCardBack(channel,artwork)); deck.append(back);
  }
  const turn=el('div',null,'recap-card-turn'+(backwards ? ' recap-turn-backwards' : '')+(answer ? ' recap-turn-answer' : ''));
  const back=el('div',null,'recap-card-reverse'); back.setAttribute('aria-hidden','true');
  back.append(recapCardBack(channel,artwork));
  turn.append(back,card); deck.append(turn); stage.append(deck);
  const disposeMaterial=mountRecapFoil(context,deck,appearance);
  const arrivalPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let arrivalFrame=0,arrivalMotion=null;
  if (typeof arrival?.animate==='function') arrivalMotion=arrival.animate(stage,deck,turn);
  else if (arrival?.width>0 && arrival.height>0 && typeof stage.animate==='function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Measure after the caller has mounted and positioned the real deck. Move its
    // outer stage once. Hold a stack's reveal until arrival; keep single-card timing.
    stage.style.opacity='0';
    if (remaining>0) { turn.classList.add('recap-turn-arriving'); turn.style.animationPlayState='paused'; }
    else turn.style.animationDelay='320ms';
    arrivalFrame=window.requestAnimationFrame(()=>{
      arrivalFrame=0; stage.style.opacity='';
      const target=deck.getBoundingClientRect(),frame=stage.getBoundingClientRect();
      if (!stage.isConnected || !target.width || !target.height || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        turn.style.animationPlayState=''; turn.style.animationDelay=''; return;
      }
      // A caller may keep a background deck scaled down. Preserve that placement
      // rather than overriding its transform for an opening in the background.
      const transform=window.getComputedStyle(stage).transform;
      if (transform && transform!=='none') { turn.style.animationPlayState=''; turn.style.animationDelay=''; return; }
      stage.style.transformOrigin=`${target.left+target.width/2-frame.left}px ${target.top+target.height/2-frame.top}px`;
      const x=arrival.left+arrival.width/2-target.left-target.width/2,y=arrival.top+arrival.height/2-target.top-target.height/2;
      const scale=appearance.pack_zoom ? ` scale(${arrival.width/target.width},${arrival.height/target.height})` : '';
      arrivalMotion=stage.animate([
        {transform:`translate(${x}px,${y}px)${scale}`},
        {transform:'none'}
      ],{duration:320,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'});
      arrivalMotion.onfinish=()=>{turn.style.animationPlayState='';};
    });
  }
  const disposeFoil=()=>{
    disposeMaterial();
    arrivalPreference.removeEventListener?.('change',arrivalPreferenceChanged);
    if (arrivalFrame) window.cancelAnimationFrame(arrivalFrame);
    if (arrivalMotion?.onfinish) arrivalMotion.onfinish=null;
    arrivalFrame=0; arrivalMotion?.cancel(); arrivalMotion=null;
    stage.style.opacity=''; stage.style.transformOrigin=''; turn.style.animationPlayState=''; turn.style.animationDelay='';
  };
  const cancelArrival=()=>{
    arrivalPreference.removeEventListener?.('change',arrivalPreferenceChanged);
    if (arrivalFrame) window.cancelAnimationFrame(arrivalFrame);
    if (arrivalMotion?.onfinish) arrivalMotion.onfinish=null;
    arrivalFrame=0; arrivalMotion?.cancel(); arrivalMotion=null;
    stage.style.opacity=''; stage.style.transformOrigin=''; turn.style.animationPlayState=''; turn.style.animationDelay='';
  };
  function arrivalPreferenceChanged() { if (arrivalPreference.matches) cancelArrival(); }
  if (arrivalFrame || arrivalMotion) arrivalPreference.addEventListener?.('change',arrivalPreferenceChanged);
  if (!onNavigate) return {stage,dispose:disposeFoil,cancelArrival};
  // Card taps and swipes leave links, answers, text selection and page scrolling alone.
  let touch=null, suppressClick=false;
  const childControl=target => {
    const control=target.closest('a,button,summary');
    return control && control!==card;
  };
  const click=event => {
    if ((suppressClick && event.detail!==0) || childControl(event.target) || window.getSelection()?.isCollapsed===false) return;
    onNavigate(1);
  };
  const mouseDown=event => {
    // Repeated clicks navigate; a first press still allows drag-to-select text.
    if (event.button===0 && event.detail>1 && !childControl(event.target)) event.preventDefault();
  };
  const down=event => {
    suppressClick=false;
    touch=event.isPrimary && event.pointerType==='touch' && !childControl(event.target)
      ? {id:event.pointerId,x:event.clientX,y:event.clientY} : null;
  };
  const cancel=() => { touch=null; suppressClick=true; };
  const up=event => {
    const start=touch; touch=null;
    if (!start || start.id!==event.pointerId) return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    suppressClick=Math.abs(dx)>10 || Math.abs(dy)>10;
    if (Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.5) onNavigate(dx<0 ? 1 : -1);
  };
  card.addEventListener('click',click);
  // The stage also receives clicks while the incoming card is inert during a deal.
  stage.addEventListener('mousedown',mouseDown);
  stage.addEventListener('pointerdown',down);
  stage.addEventListener('pointercancel',cancel);
  stage.addEventListener('pointerup',up);
  return {stage,cancelArrival,dispose:() => {
    disposeFoil(); touch=null;
    card.removeEventListener('click',click);
    stage.removeEventListener('mousedown',mouseDown);
    stage.removeEventListener('pointerdown',down);
    stage.removeEventListener('pointercancel',cancel);
    stage.removeEventListener('pointerup',up);
  }};
}
