import {recapAppearanceDefaults,normalizeRecapAppearance,resolveRecapAppearance,recapFoilColors} from '../appearance.js';

export function applyRecapPalette(node,palette) {
  node.style.setProperty('--accent',palette.accent);
  node.style.setProperty('--recap-tint',palette.tint);
  node.style.setProperty('--foil-channel-colors',recapFoilColors(palette.accent));
}

export function applyRecapBackAppearance(node,value=recapAppearanceDefaults) {
  const appearance=resolveRecapAppearance(value);
  // Card-stock edges stay neutral; the printed reverse follows the shared palette.
  node.setAttribute('data-back-palette','neutral');
  node.setAttribute('data-pack-zoom',String(appearance.pack_zoom));
  node.style.setProperty('--recap-back-accent',{silver:'#a0b5c8',spectrum:'#b6b9cf',ice:'#94bacd',amber:'#cfa866',rose:'#bc99bf'}[appearance.palette] || 'var(--accent,#e8c477)');
}

export function mountRecapBackFoil(context,deck,appearance=recapAppearanceDefaults) {
  applyRecapBackAppearance(deck,appearance);
  appearance=normalizeRecapAppearance(appearance);
  const dispose=mountRecapFoil(context,deck,appearance);
  return () => { dispose(); deck.style.removeProperty('--recap-back-accent'); };
}

export function mountRecapFoil(context,deck,appearance=recapAppearanceDefaults) {
  // Registered CSS properties interpolate all optical layers together, without an idle loop.
  const {el,labels}=context;
  const page=deck.ownerDocument || globalThis.document;
  const window=page?.defaultView || globalThis.window;
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
