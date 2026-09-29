import assert from 'node:assert/strict';
import test from 'node:test';
import {createCardPile} from '../collection.js';
import {installDOM} from './dom-fixture.mjs';

function fixture(t,options={}) {
  const dom=installDOM(t,options),host=dom.host();
  const calls=[];
  const pile=createCardPile({count:2,placements:[{x:1,y:2,rotation:3},{x:-1,y:0,rotation:-2}],
    renderBack:()=>dom.document.createElement('span'),onPrevious:()=>calls.push('previous'),
    previousLabel:index=>'Card '+index});
  host.append(pile.element);dom.cleanup(pile.dispose);
  return {...dom,host,pile,calls};
}

test('pile preserves supplied poses and dimensions, navigation and empty state',t=>{
  const {pile,calls}=fixture(t),seen=new Map([[0,{width:180,height:250}],[1,{width:200,height:270}]]);
  const button=pile.element.querySelector('button');
  assert.equal(button.disabled,true);button.click();assert.deepEqual(calls,[]);
  pile.update(2,seen);
  assert.equal(pile.visual.children.length,2);
  assert.equal(pile.visual.children[0].style.getPropertyValue('--pile-card-width'),'180');
  assert.equal(button.style.getPropertyValue('--pile-rotation'),'-2deg');
  assert.equal(button.getAttribute('aria-label'),'Card 2');button.click();assert.deepEqual(calls,['previous']);
  pile.update(0,seen);assert.equal(pile.visual.children.length,0);assert.equal(button.disabled,true);
  assert.throws(()=>pile.update(-1),RangeError);
  pile.dispose();pile.dispose();button.click();assert.deepEqual(calls,['previous']);
  assert.equal(pile.element.isConnected,false);
});

test('dealing settles once on timer or motion change and restores current card',t=>{
  const {pile,host,document,window,timers,runTimers}=fixture(t);
  pile.update(1,new Map([[0,{width:180,height:250}]]));
  const turn=document.createElement('div'),deck=document.createElement('div'),current=document.createElement('article');
  host.append(deck);deck.append(turn);turn.append(current);current.focus();
  let finished=0;
  const options={container:host,direction:1,face:document.createElement('article'),
    bounds:{left:20,top:30,width:180,height:250},turn,deck,current,onFinish:()=>finished++};
  const cancel=pile.animate(options);
  assert.ok(host.querySelector('.recap-card-flight'));assert.equal(turn.inert,true);
  document.activeElement=document.body;runTimers();
  assert.equal(finished,1);assert.equal(document.activeElement,current);
  assert.equal(host.querySelector('.recap-card-flight'),null);assert.equal(turn.inert,false);
  cancel();assert.equal(finished,1);assert.equal(timers.size,0);
  pile.animate({...options,face:document.createElement('article')});
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.matches=true;preference.emit('change');
  assert.equal(finished,2);assert.equal(timers.size,0);assert.equal(preference.listenerCount('change'),0);
});

test('backward deals and disposal restore visibility and cannot steal focus',t=>{
  const {pile,host,document,timers,runTimers}=fixture(t);
  const turn=document.createElement('div'),deck=document.createElement('div'),current=document.createElement('article');
  host.append(deck);deck.append(turn);turn.append(current);current.focus();
  let finished=0;
  pile.animate({container:host,direction:-1,face:document.createElement('article'),current,turn,deck,
    bounds:{left:30,top:30,width:180,height:250},origin:{left:0,top:0,width:72,height:100},onFinish:()=>finished++});
  assert.equal(turn.style.visibility,'hidden');assert.ok(host.querySelector('.recap-card-flight-back'));
  const other=document.createElement('button');host.append(other);other.focus();
  pile.dispose();assert.equal(document.activeElement,other);assert.equal(turn.style.visibility,'');
  assert.equal(timers.size,0);runTimers();assert.equal(finished,1);
  assert.equal(pile.animate({}),null);
});

test('reduced motion skips a deal without pending effects',t=>{
  const {pile,host,document,timers}=fixture(t,{reduced:true});
  let finished=0;
  assert.equal(pile.animate({container:host,direction:1,face:document.createElement('article'),
    bounds:{left:0,top:0,width:180,height:250},onFinish:()=>finished++}),null);
  assert.equal(timers.size,0);assert.equal(finished,0);
});

test('pile deals use the containing document for motion, timers and focus',t=>{
  const primary=installDOM(t),embedded=installDOM(t,{reduced:true,installGlobals:false}),host=embedded.host();
  const createElement=(tag,text,className)=>{
    const node=embedded.document.createElement(tag);
    if(text!=null)node.textContent=text;
    if(className)node.className=className;
    return node;
  };
  const pile=createCardPile({count:1,createElement,renderBack:()=>createElement('span')});
  host.append(pile.element);embedded.cleanup(pile.dispose);
  pile.update(1,new Map([[0,{width:180,height:250}]]));
  const current=createElement('article');host.append(current);current.focus();
  const options={container:host,direction:1,face:createElement('article'),current,bounds:{left:0,top:0,width:180,height:250}};
  assert.equal(pile.animate(options),null);
  const preference=embedded.window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.matches=false;
  pile.animate(options);
  assert.equal(embedded.timers.size,1);
  assert.equal(primary.timers.size,0);
  assert.equal(host.querySelector('.recap-card-flight').ownerDocument,embedded.document);
  embedded.document.activeElement=embedded.document.body;
  embedded.runTimers();
  assert.equal(embedded.document.activeElement,current);
  assert.equal(primary.document.activeElement,null);
  assert.equal(preference.listenerCount('change'),0);
  assert.equal(primary.media.size,0);
});
