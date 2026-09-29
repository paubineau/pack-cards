import {recapAppearanceDefaults, normalizeRecapAppearance, resolveRecapAppearance, recapMaterialPalette, recapFoilColors} from './appearance.js';

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
  const labels={...defaultLabels,...config.labels};
  const formatLabel=config.formatLabel || (value=>value);
  const formatNumber=config.formatNumber || (value=>new Intl.NumberFormat('en').format(value));
  const el=config.createElement || ((tag,text,className)=>{
    const node=document.createElement(tag);
    if (text!=null) node.textContent=text;
    if (className) node.className=className;
    return node;
  });
  const loadRenderer=config.loadRenderer || (()=>import('./renderer.js'));
  const recapCardBack=config.renderBack || defaultCardBack;
  const recapPackArtwork=config.renderPackArtwork || defaultPackArtwork;
function applyRecapPalette(node,palette) {
  node.style.setProperty('--accent',palette.accent);
  node.style.setProperty('--recap-tint',palette.tint);
  node.style.setProperty('--foil-channel-colors',recapFoilColors(palette.accent));
}

function applyRecapBackAppearance(node,value=recapAppearanceDefaults) {
  const appearance=resolveRecapAppearance(value);
  // Card-stock edges stay neutral; the printed reverse follows the shared palette.
  node.setAttribute('data-back-palette','neutral');
  node.setAttribute('data-pack-zoom',String(appearance.pack_zoom));
  node.style.setProperty('--recap-back-accent',{silver:'#a0b5c8',spectrum:'#b6b9cf',ice:'#94bacd',amber:'#cfa866',rose:'#bc99bf'}[appearance.palette] || 'var(--accent,#e8c477)');
}

function defaultCardBack(channel,artwork) {
  const print=el('div',null,'recap-card-print');
  const seal=el('span',null,'recap-print-seal');
  const identity=artwork.avatar || artwork.logo;
  if (identity) { const logo=identity.cloneNode(); logo.alt=''; if (artwork.avatar) logo.className='recap-channel-logo'; seal.append(logo); }
  else seal.append(el('span','✦'));
  print.append(el('span',channel,'recap-print-channel'),seal,el('span',labels.backCaption,'recap-print-edition'));
  if (artwork.avatar && artwork.logo) { const credit=artwork.logo.cloneNode(); credit.alt=''; credit.className='recap-print-credit'; print.append(credit); }
  return print;
}

function defaultPackArtwork(r,channel,artwork,hideRecipient=false,title=labels.title,description='') {
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const accent=escape(artwork.accent || '#e8c477');
  // Keep text and lines vector until the renderer draws them at the pack's display size.
  const svg=['<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">',
    '<defs><linearGradient id="foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="768" y2="170">',
    ...[[0,'#172132'],[.13,'#425165'],[.2,'#182334'],[.52,'#101827'],[.8,'#344356'],[.87,'#79818b'],[1,'#1b2637']].map(([at,color])=>`<stop offset="${at}" stop-color="${color}"/>`),
    '</linearGradient><pattern id="grain" width="9" height="1" patternUnits="userSpaceOnUse"><path d="M0 0h1v1H0z" fill="#fff" fill-opacity=".0314"/><path d="M3 0h1v1H3zM6 0h1v1H6z" fill="#000" fill-opacity=".0431"/></pattern>',
    '<pattern id="crimp" width="8" height="42" patternUnits="userSpaceOnUse"><path d="M0 0h2v42H0z" fill="#c8d1da" fill-opacity=".251"/></pattern></defs>',
    '<path d="M0 0h768v1024H0z" fill="url(#foil)"/><path d="M0 0h768v1024H0z" fill="url(#grain)"/>',
    '<path d="M20 0h3v1024h-3zM741 0h4v1024h-4z" fill="#fff" fill-opacity=".0471"/>',
    '<path d="M0 0h768v42H0zM0 982h768v42H0z" fill="#060c16" fill-opacity=".502"/><path d="M0 0h768v42H0zM0 982h768v42H0z" fill="url(#crimp)"/>',
    '<rect x="34" y="263" width="700" height="690" fill="none" stroke="#fff" stroke-opacity=".2196"/>',
    `<path d="M34 263h700v5H34z" fill="${accent}"/>`];
  function text(value,y,size,color='#edf1f8',weight=700) {
    ctx.font=`${weight} ${size}px sans-serif`;
    const fit=ctx.measureText(value).width>650 ? ' textLength="650" lengthAdjust="spacingAndGlyphs"' : '';
    svg.push(`<text x="384" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${escape(color)}"${fit}>${escape(value)}</text>`);
  }
  function image(art,x,y,size,attributes='') {
    canvas.width=art.naturalWidth || size; canvas.height=art.naturalHeight || size;
    ctx.drawImage(art,0,0,canvas.width,canvas.height);
    svg.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="${escape(canvas.toDataURL('image/png'))}"${attributes}/>`);
  }
  text(title,162,36,'#dce1e9');
  text(r.label,388,34,'#dce1e9',600);
  if (description) {
    const words=description.trim().split(/\s+/);
    ctx.font='600 44px sans-serif';
    const wrap=width=>{
      const lines=[]; let line='';
      for (const word of words) {
        const next=line ? line+' '+word : word;
        if (line && ctx.measureText(next).width>width) { lines.push(line); line=word; }
        else line=next;
      }
      if (line) lines.push(line);
      return lines;
    };
    let lines=wrap(560);
    // Balance the short print without leaving a single word beneath two long lines.
    for (let width=540;width>=280;width-=20) {
      const balanced=wrap(width);
      if (balanced.length>lines.length) break;
      lines=balanced;
    }
    lines.forEach((value,index)=>text(value,614+(index-(lines.length-1)/2)*56,44,'#edf1f8',600));
  } else {
    svg.push(`<g transform="translate(384 600) rotate(45)" fill="none" stroke-width="2"><rect x="-92" y="-92" width="184" height="184" stroke="${accent}"/><rect x="-103" y="-103" width="206" height="206" stroke="#f8e4ad" stroke-opacity=".2588"/></g>`);
    if (artwork.avatar) {
      svg.push('<defs><clipPath id="channel-logo"><circle cx="384" cy="600" r="76"/></clipPath></defs>');
      image(artwork.avatar,308,524,152,' clip-path="url(#channel-logo)" preserveAspectRatio="xMidYMid slice"');
    } else if (artwork.logo) image(artwork.logo,318,534,132);
    else text('✦',629,80,artwork.accent || '#e8c477');
  }
  if (!channel && !hideRecipient) text(labels.recipient.replace('{recipient}',r.recipient || ''),849,34);
  if (artwork.avatar && artwork.logo) image(artwork.logo,638,865,64);
  svg.push('</svg>');
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.join(''));
}

function createRecapPackFlight(scene,stack,motion,viewport,artwork,appearance,releaseNative) {
  const source=motion.querySelector('.recap-pack-back'),sourceStyle=getComputedStyle(source);
  const origin=source.getBoundingClientRect(),frame=stack.getBoundingClientRect(),clip=viewport.getBoundingClientRect();
  const sourceWidth=source.offsetWidth,sourceHeight=source.offsetHeight,sourceTop=source.offsetTop;
  const angle=parseFloat(sourceStyle.getPropertyValue('--recap-pack-angle')) || 0,pose=motion.style.transform || 'none';
  const duration=1750,clearAt=scene.classList.contains('recap-pack-quick') ? 300 : appearance.pack_zoom ? 900 : 1000;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let claimed=false,disposed=false,raf=0,restore=()=>{},finish;
  const finished=new Promise(resolve=>{finish=resolve;});
  const animations=[];
  // Retain the real sleeve outside the host that the caller is about to replace.
  // Its fall waits for asynchronous card data; no identity is needed before tearing.
  viewport.className=scene.className+' recap-pack-viewport recap-pack-flight recap-pack-pending';
  viewport.style.left=clip.left+'px'; viewport.style.top=clip.top+'px';
  applyRecapPalette(viewport,artwork); applyRecapBackAppearance(viewport,appearance);
  viewport.style.setProperty('--recap-pack-angle',angle+'deg');
  for (const back of motion.querySelectorAll('.recap-pack-back')) {
    Object.assign(back.style,{width:sourceWidth+'px',height:sourceHeight+'px',animation:'none',transform:sourceStyle.transform});
  }
  (scene.closest('dialog') || document.body).append(viewport);
  function dispose() {
    if (disposed) return;
    disposed=true;
    if (raf) cancelAnimationFrame(raf);
    animations.forEach(animation=>{animation.onfinish=null;animation.cancel();});
    restore(); viewport.remove();
    finish();
    window.removeEventListener('resize',dispose);
    window.removeEventListener('pagehide',dispose);
    preference.removeEventListener?.('change',preferenceChanged);
    // A consumer may cancel while still inside the native tear callback.
    Promise.resolve().then(releaseNative);
  }
  function preferenceChanged() { if (preference.matches) dispose(); }
  window.addEventListener('resize',dispose);
  window.addEventListener('pagehide',dispose);
  preference.addEventListener?.('change',preferenceChanged);
  return {dispose,discard:()=>{if(!claimed)dispose();},arrival:{...origin,finished,animate(stage,deck,turn) {
    if (disposed || claimed) return null;
    claimed=true;
    stage.style.opacity='0'; turn.style.animation='none'; turn.style.transform='rotateY(180deg)';
    restore=()=>{stage.style.opacity='';turn.style.transform='none';};
    raf=requestAnimationFrame(()=>{
      raf=0;
      if (!stage.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dispose(); return; }
      const target=deck.getBoundingClientRect(),width=deck.offsetWidth,height=deck.offsetHeight;
      if (!width || !height || !target.width || !target.height) { dispose(); return; }
      const space=el('div'),flight=el('div',null,'recap-pack-flight-deck');
      space.setAttribute('aria-hidden','true'); space.style.width=width+'px'; space.style.height=height+'px';
      const original=Object.fromEntries(['width','height','maxWidth','transform','transition'].map(key=>[key,deck.style[key]]));
      const readingStyle=getComputedStyle(deck);
      flight.style.textAlign=readingStyle.textAlign;
      flight.style.setProperty('--recap-back-accent',readingStyle.getPropertyValue('--recap-back-accent'));
      const focus=deck.contains(document.activeElement) ? document.activeElement : viewport.contains(document.activeElement) ? turn.lastElementChild : null;
      const backs=[...deck.querySelectorAll('.recap-deck-under')],spread=backs.map(back=>getComputedStyle(back).transform);
      const centerX=target.left+target.width/2-frame.left,centerY=target.top+target.height/2-frame.top;
      Object.assign(flight.style,{left:(centerX-width/2)+'px',top:(centerY-height/2)+'px',width:width+'px',height:height+'px'});
      stage.insertBefore(space,deck); flight.append(deck); motion.append(flight);
      Object.assign(deck.style,{width:'100%',height:'100%',maxWidth:'none',transform:'none',transition:'none'});
      restore=()=>{
        if (space.parentElement===stage) { stage.insertBefore(deck,space); space.remove(); }
        Object.assign(deck.style,original); stage.style.opacity=''; turn.style.transform='none';
        if (focus && stage.isConnected && (!document.activeElement || document.activeElement===document.body || deck.contains(document.activeElement) || viewport.contains(document.activeElement))) focus.focus({preventScroll:true});
      };
      for (const back of motion.querySelectorAll('.recap-pack-back')) back.style.visibility='hidden';
      viewport.classList.remove('recap-pack-pending');
      stage.style.opacity='';
      const x=frame.width/2-centerX,y=sourceTop+sourceHeight/2-centerY;
      const packed=appearance.pack_zoom ? .84 : 1,sx=sourceWidth*packed/width,sy=sourceHeight*packed/height;
      const endX=target.width/width,endY=target.height/height,lift=Math.min(82,height*.21),radians=angle*Math.PI/180;
      const ease=t=>t*t*t*(t*(6*t-15)+10);
      // One path, with continuous velocity. Until clearance, travel follows the
      // pack's own axis and keeps its size and angle, including tilted home packs.
      const frames=Array.from({length:91},(_,index)=>{
        const t=index/90,p=ease(t),released=ease(Math.max(0,(t*duration-clearAt)/(duration-clearAt))),q=1-released;
        const px=(x+Math.sin(radians)*lift*p)*q,py=(y-Math.cos(radians)*lift*p)*q;
        const initialY=appearance.pack_zoom ? sourceHeight*.03 : 0;
        return {offset:t,transform:`translate(${px}px,${py}px) rotate(${angle*q}deg) translateY(${initialY*q}px) scale(${sx+(endX-sx)*released},${sy+(endY-sy)*released})`};
      });
      const travel=flight.animate(frames,{duration,easing:'linear',fill:'both'});
      const options={delay:clearAt,duration:duration-clearAt,easing:'cubic-bezier(.3,0,.2,1)',fill:'both'};
      animations.push(travel,turn.animate([{transform:'rotateY(180deg)'},{transform:'rotateY(0deg)'}],options),
        motion.animate([{transform:pose},{transform:'none'}],options),
        ...backs.map((back,index)=>back.animate([{transform:'none'},{transform:spread[index]}],options)));
      travel.onfinish=dispose;
    });
    return {cancel:dispose};
  }}};
}

function mountRecapPack(container,r,channel,total,artwork,onOpen,appearance=recapAppearanceDefaults,options={}) {
  appearance=normalizeRecapAppearance(appearance);
  const mystery=!!options.mystery && !channel;
  const autoRevealFirst=options.autoRevealFirst===true;
  const hideRecipient=mystery || options.hideRecipient===true;
  const title=options.title || labels.title;
  const openLabel=options.openLabel || labels.open;
  const packCount=Number.isSafeInteger(options.packCount) && options.packCount>0 ? options.packCount : 1;
  // Live openings keep the pack-opening step even when personal recaps open instantly.
  if (appearance.opening==='instant' && !mystery) {
    options.onOpening?.(); onOpen();
    const dispose=()=>{}; dispose.open=()=>{}; return dispose;
  }
  const scene=el('section',null,'recap-pack-scene'+(mystery ? ' recap-pack-mystery' : ''));
  applyRecapBackAppearance(scene,appearance);
  scene.append(el('p',mystery ? labels.mysteryEyebrow : channel ? labels.collectionEyebrow : labels.personalEyebrow,'eyebrow'),
    el('h3',mystery ? labels.mysteryHeading : channel ? labels.collectionHeading : labels.personalHeading,'recap-pack-title'));
  const stack=el('div',null,'recap-pack-stack');
  const motion=el('div',null,'recap-pack-motion');
  const packAppearance=normalizeRecapAppearance(appearance);
  motion.setAttribute('data-active','true');
  stack.append(motion);
  for (let i=0;i<Math.min(total,2);i++) {
    const back=el('div',null,'recap-pack-back'); back.setAttribute('aria-hidden','true');
    back.append(recapCardBack(r.label,artwork)); motion.append(back);
  }
  const pack=el('button',null,'recap-pack'); pack.type='button'; pack.setAttribute('aria-label',openLabel);
  const cap=el('span',title,'recap-pack-seal'); cap.setAttribute('aria-hidden','true');
  const face=el('span',null,'recap-pack-face'); face.setAttribute('aria-hidden','true');
  face.append(el('span',formatLabel(r.label),'recap-pack-channel'));
  const emblem=el('span',null,'recap-pack-emblem');
  const identity=artwork.avatar || artwork.logo;
  if (identity) { const logo=identity.cloneNode(); logo.alt=''; if (artwork.avatar) logo.className='recap-channel-logo'; emblem.append(logo); }
  else emblem.append(el('span','✦'));
  face.append(emblem);
  if (!channel && !hideRecipient) face.append(el('span',labels.recipient.replace('{recipient}',r.recipient || ''),'recap-pack-edition'));
  if (artwork.avatar && artwork.logo) { const credit=artwork.logo.cloneNode(); credit.alt=''; credit.className='recap-pack-credit'; face.append(credit); }
  const instruction=el('p',mystery ? labels.mysteryInstruction : labels.instruction,'recap-pack-instruction'); instruction.setAttribute('aria-hidden','true');
  pack.append(cap,face); motion.append(pack,instruction); scene.append(stack);
  const skip=el('button',labels.skip,'recap-pack-skip'); skip.type='button'; scene.append(skip);
  if (mystery) scene.append(el('p',`${formatNumber(packCount)} ${packCount===1 ? labels.packCountOne : labels.packCountMany}`,'recap-pack-count fine'));
  let finished=false,ready=false,disposed=false,openingStarted=false,openRequested=false,timer=0,rendererDispose=null,dismissPreview=()=>{},disposePreview=()=>{};
  let flight=null,handingOff=false;
  const valid=() => !disposed && scene.isConnected && (!options.isActive || options.isActive());
  const active=() => !finished && !ready && valid();
  const disposeFoil=mountRecapFoil(motion,packAppearance);
  // Keep the current pose steady while the native renderer owns a peel.
  function pauseFoil() {
    if (!active() || motion.getAttribute('data-interacting')==='true') return;
    const transform=window.getComputedStyle?.(motion).transform;
    if (transform) motion.style.transform=transform;
    motion.setAttribute('data-interacting','true');
    disposeFoil.pauseTilt();
  }
  function resumeFoil() {
    if (!active() || openingStarted) return;
    motion.style.transform='';
    motion.removeAttribute('data-interacting');
    disposeFoil.resumeTilt();
  }
  function stopFoil() {
    motion.setAttribute('data-active','false');
    motion.style.transform='';
    motion.removeAttribute('data-interacting');
    disposeFoil();
  }
  function notifyOpening() {
    if (openingStarted || finished || !valid()) return;
    pauseFoil();
    openingStarted=true; options.onOpening?.();
  }
  function clearMotion() {
    if (timer) clearTimeout(timer);
    timer=0;
    const dispose=rendererDispose; rendererDispose=null;
    if (dispose) dispose();
  }
  function dispose() {
    disposed=true;
    if (!handingOff) flight?.discard();
    if (!flight) stopFoil();
    disposePreview();
    clearMotion();
  }
  function reveal() {
    if (finished || !valid()) return;
    notifyOpening();
    const arrival=!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (scene.classList.contains('recap-pack-torn') || scene.classList.contains('recap-pack-opening'))
      ? stack.querySelector('.recap-pack-back')?.getBoundingClientRect() : null;
    finished=true;
    stopFoil();
    // Keep focus inside the pack while its native button unmounts, so callers
    // can transfer it to the revealed card without stealing focus from elsewhere.
    if (scene.contains?.(document.activeElement)) { scene.tabIndex=-1; scene.focus({preventScroll:true}); }
    disposePreview();
    clearMotion();
    onOpen(arrival);
  }
  function showDeck() {
    if (finished || ready || !valid()) return;
    notifyOpening();
    // The caller mounts the actual deck in its final layout and owns its reveal flip.
    // A temporary ready deck here would send it through a different position and size.
    if (autoRevealFirst) { reveal(); return; }
    const focus=options.focus!==false || scene.contains?.(document.activeElement);
    const emerging=(mystery || options.measureArrival) && (scene.classList.contains('recap-pack-torn') || scene.classList.contains('recap-pack-opening')) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? stack.querySelector('.recap-pack-back')?.getBoundingClientRect() : null;
    ready=true;
    stopFoil();
    disposePreview();
    clearMotion();
    const stage=el('div',null,'recap-deck-stage'), deck=el('div',null,'recap-deck');
    stage.setAttribute('data-pack-zoom',String(packAppearance.pack_zoom));
    for (let i=0;i<Math.min(total-1,2);i++) {
      const underneath=el('div',null,'recap-deck-under'); underneath.setAttribute('aria-hidden','true');
      underneath.append(recapCardBack(r.label,artwork)); deck.append(underneath);
    }
    const first=el('button',null,'recap-ready-card'); first.type='button';
    first.setAttribute('aria-label',labels.revealFirst);
    const print=recapCardBack(r.label,artwork); print.setAttribute('aria-hidden','true'); first.append(print);
    first.onclick=reveal; deck.append(first); stage.append(deck);
    if (emerging) deck.style.animation='none';
    scene.className='recap-ready-scene';
    const hint=mystery ? labels.mysteryReady : labels.ready;
    scene.replaceChildren(stage,el('p',hint,'recap-ready-hint'));
    if (emerging) {
      // The game wrapper scales independently of the deck; carry its last visible card into the handoff.
      const target=deck.getBoundingClientRect();
      if (emerging.width>0 && target.width>0) {
        deck.style.setProperty('--recap-arrive-x',`${emerging.left+emerging.width/2-target.left-target.width/2}px`);
        deck.style.setProperty('--recap-arrive-y',`${emerging.top+emerging.height/2-target.top-target.height/2}px`);
        deck.style.setProperty('--recap-arrive-scale',packAppearance.pack_zoom ? emerging.width/target.width : 1);
        if (options.measureArrival && target.height>0) deck.style.setProperty('--recap-arrive-scale-y',packAppearance.pack_zoom ? emerging.height/target.height : 1);
      }
      deck.style.animation='';
    }
    rendererDispose=mountRecapBackFoil(deck,appearance);
    if (focus) first.focus({preventScroll:true});
  }
  pack.onclick=() => {
    if (pack.disabled || !active()) return;
    notifyOpening();
    dismissPreview();
    pack.disabled=true;
    stack.style.opacity='';
    clearMotion();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { showDeck(); return; }
    scene.className+=' recap-pack-opening';
    timer=setTimeout(showDeck,1600);
  };
  skip.onclick=mystery ? showDeck : reveal;
  dispose.open=() => {
    if (!active() || openingStarted || openRequested || pack.disabled) return;
    const native=stack.querySelector('.recap-webgl-pack');
    const control=pack.hidden && native && !native.inert && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? native.querySelector('[role="button"],button') : null;
    openRequested=true;
    // Native AT activation runs the same tear as the pack's keyboard control.
    // Before it is ready, the retained button still provides the normal fallback.
    if (control) control.click();
    else { pack.hidden=false; pack.click(); }
  };
  container.replaceChildren(scene);
  if (options.focus!==false) pack.focus({preventScroll:true});
  enhance();
  return dispose;

  async function enhance() {
    // Keep the ordinary opening usable while the optional module loads (or fails).
    if (typeof document==='undefined') return;
    // Reserve the frame without flashing the differently styled emergency fallback.
    stack.style.opacity='0';
    try {
      const artSrc=recapPackArtwork(r,channel,artwork,hideRecipient,title);
      const image=el('img'); image.src=artSrc; image.alt=''; image.draggable=false;
      await image.decode();
      if (!active() || pack.disabled) return;
      pack.replaceChildren(image); pack.className+=' recap-pack-illustrated';
      stack.style.opacity='';
      let updateNativeArtwork=null;
      if (options.description) {
        const previewSrc=recapPackArtwork(r,channel,artwork,hideRecipient,title,options.description);
        let loaded=false,hovered=false,focused=stack.contains(document.activeElement) && document.activeElement.matches(':focus-visible'),dismissed=false;
        const update=() => {
          if (!active()) return;
          const preview=loaded && !dismissed && !pack.disabled && !scene.classList.contains('recap-pack-torn') && (hovered || focused);
          const src=preview ? previewSrc : artSrc;
          if (image.src!==src) image.src=src;
          updateNativeArtwork?.(src);
        };
        dismissPreview=()=>{dismissed=true;update();};
        const listeners=[
          ['pointerenter',event=>{hovered=event.pointerType==='mouse' || event.pointerType==='pen';update();}],
          ['pointerleave',()=>{hovered=false;if (!focused) dismissed=false;update();}],
          ['focusin',event=>{focused=event.target.matches(':focus-visible');update();}],
          ['focusout',event=>{if (stack.contains(event.relatedTarget)) return;focused=false;if (!hovered) dismissed=false;update();}],
          ['pointerdown',dismissPreview,true],
          ['click',dismissPreview,true],
          ['keydown',event=>{if (event.key==='Enter' || event.key===' ') dismissPreview();},true]
        ];
        for (const [type,handler,capture] of listeners) stack.addEventListener(type,handler,capture);
        disposePreview=()=>{for (const [type,handler,capture] of listeners) stack.removeEventListener(type,handler,capture);};
        // Decode once before swapping the print, keeping the foil visible on the first hover.
        const previewImage=el('img'); previewImage.src=previewSrc;
        previewImage.decode().then(()=>{loaded=true;update();}).catch(()=>{});
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const {mountPack}=await loadRenderer();
      if (!active() || pack.disabled) return;
      const host=el('div',null,'recap-webgl-pack');
      const backLayer=el('div',null,'recap-pack-lining'); backLayer.setAttribute('aria-hidden','true');
      host.style.visibility='hidden'; host.inert=true;
      backLayer.style.visibility='hidden';
      motion.append(backLayer,host);
      let torn=false,version=0,nativeDispose=null,observer=null,resizeTimer=0,size=null;
      const cancelResize=() => { if (resizeTimer) clearTimeout(resizeTimer); resizeTimer=0; };
      rendererDispose=() => {
        version++; observer?.disconnect(); cancelResize();
        updateNativeArtwork=null;
        const dispose=nativeDispose; nativeDispose=null;
        if (dispose) dispose();
        resumeFoil();
        host.remove(); backLayer.remove();
      };
      function mountAtSize(rect) {
        const current=++version,focus=pack===document.activeElement || host.contains?.(document.activeElement);
        host.style.visibility='hidden'; host.inert=true;
        backLayer.style.visibility='hidden';
        pack.hidden=false;
        scene.className=scene.className.replace(' recap-pack-enhanced','');
        if (focus) pack.focus({preventScroll:true});
        const dispose=nativeDispose; nativeDispose=null;
        if (dispose) dispose();
        resumeFoil();
        size={width:rect.width,height:rect.height};
        let presented=false;
        nativeDispose=mountPack(host,{artSrc,backLayer,width:rect.width,height:rect.height,glowTier:appearance.glow,packCount,
          labels:{open:openLabel,swipe:labels.swipe,tap:labels.tap},
          onInteract:() => { if (active() && current===version && !torn) { pauseFoil(); options.onInteract?.(); } },
          onRest:() => { if (active() && current===version && !torn) { resumeFoil(); options.onRest?.(); } },
          onReady:() => {
            if (!active() || pack.disabled || current!==version || presented) return;
            presented=true;
            // The top of the native pack exists only after its first WebGL frame.
            const focus=pack===document.activeElement;
            host.style.visibility=''; host.inert=false;
            backLayer.style.visibility='';
            pack.hidden=true;
            scene.className+=' recap-pack-enhanced';
            const control=host.querySelector('[role="button"],button');
            control?.setAttribute('aria-label',openLabel);
            if (focus) control?.focus({preventScroll:true});
          },
          onTorn:() => {
            if (!active() || current!==version || torn) return;
            notifyOpening();
            dismissPreview();
            if (!host.querySelector('canvas')) scene.className+=' recap-pack-quick';
            // Let the sleeve leave the viewport without extending the page's scroll area.
            const rect=stack.getBoundingClientRect(),viewport=el('div',null,'recap-pack-viewport'),frame=el('div',null,'recap-pack-frame');
            let left=0,top=0,right=document.documentElement.clientWidth,bottom=document.documentElement.clientHeight;
            // A modal or embedded scrollport can have a smaller visible area than the window.
            for (let parent=stack.parentElement;parent;parent=parent.parentElement) {
              const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
              if (style.overflowX!=='visible') { left=Math.max(left,bounds.left+parent.clientLeft); right=Math.min(right,bounds.left+parent.clientLeft+parent.clientWidth); }
              if (style.overflowY!=='visible') { top=Math.max(top,bounds.top+parent.clientTop); bottom=Math.min(bottom,bounds.top+parent.clientTop+parent.clientHeight); }
            }
            viewport.style.left=`${left-rect.left}px`; viewport.style.top=`${top-rect.top}px`;
            viewport.style.width=`${Math.max(0,right-left)}px`; viewport.style.height=`${Math.max(0,bottom-top)}px`;
            frame.style.left=`${rect.left-left}px`; frame.style.top=`${rect.top-top}px`;
            frame.style.width=`${rect.width}px`; frame.style.height=`${rect.height}px`;
            const focus=document.activeElement;
            frame.append(motion); viewport.append(frame); stack.append(viewport);
            if (frame.contains(focus)) focus.focus({preventScroll:true});
            torn=true; observer?.disconnect(); cancelResize(); scene.className+=' recap-pack-torn';
            if (autoRevealFirst && typeof motion.animate==='function' && document.body &&
                !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              finished=true;
              if (scene.contains(document.activeElement)) { scene.tabIndex=-1; scene.focus({preventScroll:true}); }
              const pose=motion.style.transform;
              stopFoil(); motion.style.transform=pose;
              disposePreview();
              const releaseNative=rendererDispose; rendererDispose=null;
              flight=createRecapPackFlight(scene,stack,motion,viewport,artwork,packAppearance,releaseNative);
              handingOff=true;
              try { Promise.resolve(onOpen(flight.arrival)).then(()=>flight.discard(),()=>flight.dispose()); }
              catch (error) { flight.dispose(); throw error; }
              finally { handingOff=false; }
            }
          },
          onComplete:() => {
            if (!active() || current!==version) return;
            // Leave React's callback before unmounting its root.
            timer=setTimeout(showDeck,0);
          }});
        updateNativeArtwork=src=>nativeDispose?.setBodyArtwork?.(src);
        updateNativeArtwork(image.src);
      }
      const changed=rect => rect.width>0 && rect.height>0 &&
        (!size || Math.abs(rect.width-size.width)>=1 || Math.abs(rect.height-size.height)>=1);
      const rect=stack.getBoundingClientRect();
      if (changed(rect)) mountAtSize(rect);
      if (typeof ResizeObserver!=='undefined') {
        observer=new ResizeObserver(() => {
          if (!active() || torn || !changed(stack.getBoundingClientRect())) return;
          cancelResize();
          // Coalesce window/fullscreen resizing instead of rebuilding on every pixel.
          resizeTimer=setTimeout(() => {
            resizeTimer=0;
            if (!active() || torn) return;
            const rect=stack.getBoundingClientRect();
            if (!changed(rect)) return;
            try { mountAtSize(rect); }
            catch { clearMotion(); pack.hidden=false; }
          },80);
        });
        observer.observe(stack);
      }
    } catch {
      if (!active()) return;
      clearMotion();
      stack.querySelector('.recap-webgl-pack')?.remove();
      // A failed optional effect must never prevent access to the wrapped.
      pack.hidden=false;
    } finally {
      stack.style.opacity='';
    }
  }
}

function mountRecapReadyDeck(channel,remaining,artwork,onReveal,{autoReveal=false,appearance=recapAppearanceDefaults}={}) {
  const stage=el('div',null,'recap-deck-stage recap-ready-scene'),deck=el('div',null,'recap-deck');
  stage.setAttribute('data-pack-zoom',String(normalizeRecapAppearance(appearance).pack_zoom));
  for (let i=0;i<Math.min(remaining,2);i++) {
    const back=el('div',null,'recap-deck-under'); back.setAttribute('aria-hidden','true');
    back.append(recapCardBack(channel,artwork)); deck.append(back);
  }
  const card=el('button',null,'recap-ready-card'); card.type='button';
  card.setAttribute('aria-label',labels.reveal);
  const print=recapCardBack(channel,artwork); print.setAttribute('aria-hidden','true'); card.append(print);
  deck.append(card); stage.append(deck);
  const disposeFoil=mountRecapBackFoil(deck,appearance);
  let disposed=false,revealed=false,timer=0;
  function reveal() {
    if (disposed || revealed || !stage.isConnected) return;
    revealed=true; clearTimeout(timer); timer=0;
    onReveal();
  }
  card.onclick=reveal;
  // Let the caller attach the stage and keep its disposer, without a cosmetic pause.
  if (autoReveal===true) timer=setTimeout(reveal,0);
  return {stage,card,dispose:() => {
    disposed=true; clearTimeout(timer); timer=0;
    card.onclick=null; disposeFoil();
  }};
}

function mountRecapCardDeck(card,channel,remaining,artwork,{backwards=false,answer=false,onNavigate=null,appearance=recapAppearanceDefaults,arrival=null}={}) {
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
  const disposeMaterial=mountRecapFoil(deck,appearance);
  const arrivalPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let arrivalFrame=0,arrivalMotion=null;
  if (typeof arrival?.animate==='function') arrivalMotion=arrival.animate(stage,deck,turn);
  else if (arrival?.width>0 && arrival.height>0 && typeof stage.animate==='function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Measure after the caller has mounted and positioned the real deck. Move its
    // outer stage once, leaving the shared tilt and reveal flip independent.
    stage.style.opacity='0'; turn.style.animationDelay='320ms';
    arrivalFrame=requestAnimationFrame(()=>{
      arrivalFrame=0; stage.style.opacity='';
      const target=deck.getBoundingClientRect(),frame=stage.getBoundingClientRect();
      if (!stage.isConnected || !target.width || !target.height || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        turn.style.animationDelay=''; return;
      }
      // A caller may keep a background deck scaled down. Preserve that placement
      // rather than overriding its transform for an opening in the background.
      const transform=getComputedStyle(stage).transform;
      if (transform && transform!=='none') { turn.style.animationDelay=''; return; }
      stage.style.transformOrigin=`${target.left+target.width/2-frame.left}px ${target.top+target.height/2-frame.top}px`;
      const x=arrival.left+arrival.width/2-target.left-target.width/2,y=arrival.top+arrival.height/2-target.top-target.height/2;
      const scale=appearance.pack_zoom ? ` scale(${arrival.width/target.width},${arrival.height/target.height})` : '';
      arrivalMotion=stage.animate([
        {transform:`translate(${x}px,${y}px)${scale}`},
        {transform:'none'}
      ],{duration:320,easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'});
    });
  }
  const disposeFoil=()=>{
    disposeMaterial();
    arrivalPreference.removeEventListener?.('change',arrivalPreferenceChanged);
    if (arrivalFrame) cancelAnimationFrame(arrivalFrame);
    arrivalFrame=0; arrivalMotion?.cancel(); arrivalMotion=null;
    stage.style.opacity=''; stage.style.transformOrigin=''; turn.style.animationDelay='';
  };
  const cancelArrival=()=>{
    arrivalPreference.removeEventListener?.('change',arrivalPreferenceChanged);
    if (arrivalFrame) cancelAnimationFrame(arrivalFrame);
    arrivalFrame=0; arrivalMotion?.cancel(); arrivalMotion=null;
    stage.style.opacity=''; stage.style.transformOrigin=''; turn.style.animationDelay='';
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

function mountRecapBackFoil(deck,appearance=recapAppearanceDefaults) {
  applyRecapBackAppearance(deck,appearance);
  appearance=normalizeRecapAppearance(appearance);
  const dispose=mountRecapFoil(deck,appearance);
  return () => { dispose(); deck.style.removeProperty('--recap-back-accent'); };
}

function mountRecapFoil(deck,appearance=recapAppearanceDefaults) {
  // Registered CSS properties interpolate all optical layers together, without an idle loop.
  const page=deck.ownerDocument || globalThis.document;
  const preference=window.matchMedia('(prefers-reduced-motion: no-preference)');
  const interactive=appearance.motion==='interactive';
  const hasSensors=interactive && window.isSecureContext && typeof window.DeviceOrientationEvent!=='undefined' &&
    (window.matchMedia('(any-pointer: coarse)').matches || window.navigator?.maxTouchPoints>0);
  let disposed=false,pointerActive=false,baseline=null,tiltPaused=false,lastPose=null,permissionButton=null,permissionGranted=false;
  const clamp=value=>Math.max(-.5,Math.min(.5,value));
  const canMove=()=>interactive && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  function clearInput() { pointerActive=false; baseline=null; lastPose=null; }
  function acceptsInput() {
    let inactive=page?.hidden || deck.isConnected===false;
    for (let node=deck;node && !inactive;node=node.parentElement)
      inactive=node.inert || node.hidden || (node.tagName==='DIALOG' && !node.open);
    if (inactive) clearInput();
    return !inactive;
  }
  function bounds() {
    // Measure the unrotated stage: the tilted deck would feed its own motion back into the pointer mapping.
    const stage=deck.parentElement,rect=stage?.getBoundingClientRect();
    if (!rect) return deck.getBoundingClientRect();
    // Shelf previews scale the stage; offsets and dimensions are still in layout pixels.
    const scaleX=stage.offsetWidth ? rect.width/stage.offsetWidth : 1,scaleY=stage.offsetHeight ? rect.height/stage.offsetHeight : 1;
    return {left:rect.left+deck.offsetLeft*scaleX,top:rect.top+deck.offsetTop*scaleY,width:deck.offsetWidth*scaleX,height:deck.offsetHeight*scaleY};
  }
  function applyPose(x,y,tiltScale=1) {
    if (disposed || !canMove() || !acceptsInput()) return;
    const poseX=clamp(x),poseY=clamp(y);
    lastPose=[poseX,poseY,tiltScale];
    deck.style.setProperty('--foil-x',`${(poseX+.5)*100}%`); deck.style.setProperty('--foil-y',`${(poseY+.5)*100}%`);
    deck.style.setProperty('--foil-angle',`${(poseX-poseY)*8}deg`);
    // One pose drives the original card tilt and reflective layers.
    deck.style.setProperty('--foil-catch',String(.5+Math.min(1,Math.hypot(poseX,poseY)*Math.SQRT2)*.5));
    if (interactive && !tiltPaused) {
      deck.style.setProperty('--tilt-x',`${-poseY*10*tiltScale}deg`); deck.style.setProperty('--tilt-y',`${poseX*14*tiltScale}deg`);
    }
  }
  function reset() {
    for (const key of ['--foil-x','--foil-y','--foil-angle','--foil-catch','--tilt-x','--tilt-y']) deck.style.removeProperty(key);
  }
  function reflect(event) {
    const control=event.target?.closest('a,button,summary');
    if (disposed || !['mouse','pen'].includes(event.pointerType) || (control && !control.classList?.contains('recap-ready-card') && !control.classList?.contains('recap-summary-card') && !deck.classList?.contains('recap-pack-motion')) || !canMove() || !acceptsInput()) return;
    const rect=bounds(); if (!rect.width || !rect.height) return;
    pointerActive=true; baseline=null;
    applyPose((event.clientX-rect.left)/rect.width-.5,(event.clientY-rect.top)/rect.height-.5);
  }
  function endPointer(event) {
    if (event.pointerType==='touch') return;
    pointerActive=false; baseline=null;
    if (!tiltPaused) reset();
  }
  function stopSensor() {
    window.removeEventListener?.('deviceorientation',orient);
    baseline=null;
  }
  function orient(event) {
    if (disposed || !canMove() || !acceptsInput() || pointerActive || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    permissionGranted=true;
    if (permissionButton) permissionButton.hidden=true;
    const angle=window.screen?.orientation?.angle ?? Number(window.orientation ?? 0);
    if (!baseline || baseline.angle!==angle) {
      baseline={beta:event.beta,gamma:event.gamma,angle};
      if (!tiltPaused) reset();
      return;
    }
    // Relative to how the phone is held, rotated into the screen's current orientation.
    const beta=(event.beta-baseline.beta+540)%360-180,gamma=event.gamma-baseline.gamma,radians=angle*Math.PI/180;
    const tiltScale=deck.classList?.contains('recap-deck') ? 2 : 1;
    applyPose((gamma*Math.cos(radians)+beta*Math.sin(radians))/45,(beta*Math.cos(radians)-gamma*Math.sin(radians))/45,tiltScale);
  }
  function preferenceChanged() {
    pointerActive=false; reset(); stopSensor();
    if (permissionButton) permissionButton.hidden=!canMove() || permissionGranted;
    // Existing grants work immediately; browsers requiring consent get an explicit control.
    if (!disposed && hasSensors && canMove()) window.addEventListener('deviceorientation',orient);
  }
  if (hasSensors && typeof window.DeviceOrientationEvent.requestPermission==='function') {
    permissionButton=el('button',labels.enableTilt,'secondary recap-motion-permission');
    permissionButton.type='button';
    permissionButton.onclick=async event=>{
      event?.stopPropagation?.();
      permissionButton.disabled=true;
      try {
        const granted=await window.DeviceOrientationEvent.requestPermission();
        if (disposed) return;
        if (granted==='granted') { permissionGranted=true; permissionButton.hidden=true; baseline=null; }
        else permissionButton.textContent=labels.tiltUnavailable;
      } catch {
        if (!disposed) permissionButton.textContent=labels.tiltUnavailable;
      }
    };
    deck.parentElement?.append(permissionButton);
  }
  preferenceChanged();
  preference.addEventListener?.('change',preferenceChanged);
  page?.addEventListener?.('visibilitychange',clearInput);
  deck.addEventListener('pointermove',reflect);
  deck.addEventListener('pointerleave',endPointer);
  deck.addEventListener('pointercancel',endPointer);
  const dispose=() => {
    disposed=true; stopSensor(); reset();
    if (permissionButton) { permissionButton.onclick=null; permissionButton.remove(); }
    preference.removeEventListener?.('change',preferenceChanged);
    page?.removeEventListener?.('visibilitychange',clearInput);
    deck.removeEventListener('pointermove',reflect);
    deck.removeEventListener('pointerleave',endPointer);
    deck.removeEventListener('pointercancel',endPointer);
  };
  dispose.pauseTilt=() => { if (!disposed) tiltPaused=true; };
  dispose.resumeTilt=() => {
    if (disposed) return;
    tiltPaused=false;
    if (pointerActive && lastPose) applyPose(...lastPose);
    else reset();
  };
  return dispose;
}

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
