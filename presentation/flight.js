import {applyRecapPalette,applyRecapBackAppearance} from './motion.js';

export function createRecapPackFlight(context,scene,stack,motion,viewport,artwork,appearance,releaseNative) {
  const {el}=context;
  const document=scene.ownerDocument || globalThis.document;
  const window=document?.defaultView || globalThis.window;
  const source=motion.querySelector('.recap-pack-back'),sourceStyle=window.getComputedStyle(source);
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
    if (raf) window.cancelAnimationFrame(raf);
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
    raf=window.requestAnimationFrame(()=>{
      raf=0;
      if (!stage.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dispose(); return; }
      const target=deck.getBoundingClientRect(),width=deck.offsetWidth,height=deck.offsetHeight;
      if (!width || !height || !target.width || !target.height) { dispose(); return; }
      const space=el('div'),flight=el('div',null,'recap-pack-flight-deck');
      space.setAttribute('aria-hidden','true'); space.style.width=width+'px'; space.style.height=height+'px';
      const original=Object.fromEntries(['width','height','maxWidth','transform','transition'].map(key=>[key,deck.style[key]]));
      const readingStyle=window.getComputedStyle(deck);
      flight.style.textAlign=readingStyle.textAlign;
      flight.style.setProperty('--recap-back-accent',readingStyle.getPropertyValue('--recap-back-accent'));
      const focus=deck.contains(document.activeElement) ? document.activeElement : viewport.contains(document.activeElement) ? turn.lastElementChild : null;
      const backs=[...deck.querySelectorAll('.recap-deck-under')],spread=backs.map(back=>window.getComputedStyle(back).transform);
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
