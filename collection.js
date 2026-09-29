// Viewed-card piles are visual state; the consumer owns card order and navigation.
export function createCardPile({count=0,placements,renderBack,onPrevious=()=>{},
  previousLabel=position=>`Review card ${position}`,emptyLabel='No viewed cards',
  createElement}={}) {
  let element;
  createElement ||= (tag,text,className)=>{
    const node=(element?.ownerDocument || globalThis.document).createElement(tag);
    if(text!=null)node.textContent=text;
    if(className)node.className=className;
    return node;
  };
  if(!Number.isSafeInteger(count)||count<0)throw new RangeError('count must be a non-negative safe integer');
  if(typeof renderBack!=='function')throw new TypeError('renderBack must return a fresh card back');
  const poses=placements || Array.from({length:count},()=>({rotation:(Math.random()-.5)*16,x:(Math.random()-.5)*4,y:(Math.random()-.5)*4}));
  element=createElement('div',null,'recap-collection');
  const visual=createElement('div',null,'recap-pile-visual');
  visual.setAttribute('aria-hidden','true'); visual.inert=true;
  const previous=createElement('button',null,'recap-pile-button'); previous.type='button';
  let position=0,disposed=false,cancelAnimation=null;
  previous.onclick=()=>{if(!disposed && position>0)onPrevious();};
  element.append(visual,previous);
  const pose=index=>poses[index] || {rotation:0,x:0,y:0};
  function update(next,seen=new Map()) {
    if(disposed)return;
    if(!Number.isSafeInteger(next)||next<0)throw new RangeError('position must be a non-negative safe integer');
    position=next;
    visual.replaceChildren(); previous.disabled=position===0;
    previous.setAttribute('aria-label',position ? previousLabel(position) : emptyLabel);
    const top=pose(position-1);
    previous.style.setProperty('--pile-rotation',`${top.rotation}deg`);
    previous.style.setProperty('--pile-x',`${top.x}px`); previous.style.setProperty('--pile-y',`${top.y}px`);
    element.className='recap-collection'+(position===0 ? ' recap-collection-empty' : '');
    for(let index=0;index<position;index++) {
      const stored=seen.get(index); if(!stored)continue;
      const placement=pose(index),layer=createElement('div',null,'recap-pile-layer');
      layer.style.setProperty('--pile-card-width',stored.width); layer.style.setProperty('--pile-card-height',stored.height);
      layer.style.setProperty('--pile-rotation',`${placement.rotation}deg`);
      layer.style.setProperty('--pile-x',`${placement.x}px`); layer.style.setProperty('--pile-y',`${placement.y}px`);
      const back=createElement('div',null,'recap-card-reverse'); back.append(renderBack());
      layer.append(back); visual.append(layer);
    }
  }
  // Face and bounds are captured before replacing the old card for a forward deal,
  // or from the newly mounted card for a backward deal. No card data is inspected.
  function animate({container,direction,face,bounds,origin,turn,deck,current,
    isActive=()=>true,onFinish=()=>{}}) {
    cancelAnimation?.();
    if(disposed)return null;
    const doc=container.ownerDocument || element.ownerDocument || globalThis.document;
    const window=doc?.defaultView || globalThis.window;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const destination=direction>0 ? visual.getBoundingClientRect() : origin;
    if(preference.matches || !isActive() || !face || !bounds?.width || !bounds.height || !destination?.width)return null;
    const landing=direction>0 ? visual.lastElementChild : null;
    const restoreFocus=doc.activeElement===current;
    const turnInert=turn?.inert,turnVisibility=turn?.style.visibility,landingVisibility=landing?.style.visibility;
    if(landing)landing.style.visibility='hidden';
    if(turn){turn.inert=true;if(direction<0)turn.style.visibility='hidden';}
    if(deck)deck.classList.add('recap-deck-dealing');
    const flight=createElement('div',null,'recap-card-flight'+(direction<0 ? ' recap-card-flight-back' : ''));
    flight.setAttribute('aria-hidden','true');flight.inert=true;
    flight.style.left=bounds.left+'px';flight.style.top=bounds.top+'px';
    flight.style.width=bounds.width+'px';flight.style.height=bounds.height+'px';
    const placement=pose(direction>0 ? position-1 : position);
    flight.style.setProperty('--deal-x',`${destination.left+destination.width/2+placement.x-bounds.left-bounds.width/2}px`);
    flight.style.setProperty('--deal-y',`${destination.top+destination.height/2+placement.y-bounds.top-bounds.height/2}px`);
    flight.style.setProperty('--deal-rotation',`${placement.rotation}deg`);
    flight.style.setProperty('--deal-scale',Math.min(destination.width/bounds.width,destination.height/bounds.height));
    const rotation=createElement('div',null,'recap-card-flight-turn'),back=createElement('div',null,'recap-card-reverse');
    back.append(renderBack());rotation.append(back,face);flight.append(rotation);container.append(flight);
    let finished=false,timer;
    const cancel=()=>{
      if(finished)return;
      finished=true;window.clearTimeout(timer);preference.removeEventListener?.('change',preferenceChanged);
      if(cancelAnimation===cancel)cancelAnimation=null;
      flight.remove();
      if(landing)landing.style.visibility=landingVisibility || '';
      if(turn){turn.inert=!!turnInert;turn.style.visibility=turnVisibility || '';}
      deck?.classList.remove('recap-deck-dealing');
      if(!disposed && restoreFocus && isActive() && doc.activeElement===doc.body && current?.isConnected)current.focus({preventScroll:true});
      onFinish();
    };
    function preferenceChanged(){if(preference.matches)cancel();}
    cancelAnimation=cancel;
    timer=window.setTimeout(cancel,680);
    preference.addEventListener?.('change',preferenceChanged);
    return cancel;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;cancelAnimation?.();previous.onclick=null;element.remove();
  }
  update(0);
  return {element,visual,placements:poses,update,animate,dispose};
}
