import {recapAppearanceDefaults,normalizeRecapAppearance} from '../appearance.js';
import {applyRecapBackAppearance,mountRecapFoil,mountRecapBackFoil} from './motion.js';
import {createRecapPackFlight} from './flight.js';

export function mountRecapPack(context,container,r,channel,total,artwork,onOpen,appearance=recapAppearanceDefaults,options={}) {
  const {el,labels,formatLabel,formatNumber,loadRenderer,recapCardBack,recapPackArtwork}=context;
  const document=container.ownerDocument || globalThis.document;
  const window=document?.defaultView || globalThis.window;
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
  const disposeFoil=mountRecapFoil(context,motion,packAppearance);
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
    if (timer) window.clearTimeout(timer);
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
    if (!valid()) return;
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
    if (!valid()) return;
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
    rendererDispose=mountRecapBackFoil(context,deck,appearance);
    if (focus) first.focus({preventScroll:true});
  }
  pack.onclick=() => {
    if (pack.disabled || !active()) return;
    notifyOpening();
    if (!active()) return;
    dismissPreview();
    // Disabling a focused fallback button otherwise sends focus to the body.
    if (scene.contains(document.activeElement)) { scene.tabIndex=-1; scene.focus({preventScroll:true}); }
    pack.disabled=true;
    stack.style.opacity='';
    clearMotion();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { showDeck(); return; }
    scene.className+=' recap-pack-opening';
    timer=window.setTimeout(showDeck,1600);
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
      let previewImage=null;
      if (options.description) {
        const previewSrc=recapPackArtwork(r,channel,artwork,hideRecipient,title,options.description);
        let loaded=false,hovered=false,focused=stack.contains(document.activeElement) && document.activeElement.matches(':focus-visible'),dismissed=false;
        const update=() => {
          if (!active()) return;
          const preview=loaded && !dismissed && !pack.disabled && !scene.classList.contains('recap-pack-torn') && (hovered || focused);
          stack.classList.toggle('recap-pack-preview',preview);
          stack.classList.toggle('recap-pack-preview-dismissed',dismissed);
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
        // Layer the decoded print over the original so hover can fade in and out.
        previewImage=el('img',null,'recap-pack-description'); previewImage.src=previewSrc;
        previewImage.alt=''; previewImage.draggable=false;
        pack.append(previewImage);
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
      const cancelResize=() => { if (resizeTimer) window.clearTimeout(resizeTimer); resizeTimer=0; };
      rendererDispose=() => {
        version++; observer?.disconnect(); cancelResize();
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
              const style=window.getComputedStyle(parent),bounds=parent.getBoundingClientRect();
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
              flight=createRecapPackFlight(context,scene,stack,motion,viewport,artwork,packAppearance,releaseNative);
              handingOff=true;
              try { Promise.resolve(onOpen(flight.arrival)).then(()=>flight.discard(),()=>flight.dispose()); }
              catch (error) { flight.dispose(); throw error; }
              finally { handingOff=false; }
            }
          },
          onComplete:() => {
            if (!active() || current!==version) return;
            // Leave the renderer callback before disposing its resources.
            timer=window.setTimeout(showDeck,0);
          }});
        if (previewImage) host.append(previewImage.cloneNode());
      }
      const changed=rect => rect.width>0 && rect.height>0 &&
        (!size || Math.abs(rect.width-size.width)>=1 || Math.abs(rect.height-size.height)>=1);
      const rect=stack.getBoundingClientRect();
      if (changed(rect)) mountAtSize(rect);
      if (typeof window.ResizeObserver!=='undefined') {
        observer=new window.ResizeObserver(() => {
          if (!active() || torn || !changed(stack.getBoundingClientRect())) return;
          cancelResize();
          // Coalesce window/fullscreen resizing instead of rebuilding on every pixel.
          resizeTimer=window.setTimeout(() => {
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
