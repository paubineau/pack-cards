import assert from 'node:assert/strict';
import test from 'node:test';
import {createPackView, createAppearanceSettings, resolveAppearance} from '../index.js';
import {installDOM} from './dom-fixture.mjs';

function setup(t, options={}, reduced=true) {
  const dom=installDOM(t,{reduced});
  const host=dom.host();
  const view=createPackView(host,options);
  dom.cleanup(view.dispose);
  return {...dom,host,view,face:()=>dom.document.createElement('article')};
}

test('a managed card resolves versionless rarity settings and disposes the previous mount', t=>{
  const dom=setup(t,{artwork:{accent:'#abcdef',tint:'#112233'},appearance:{motion:'still',
    rarities:{rare:{stock:'metal',coating:'matte',foil:'none'}}}});
  const first=dom.face();
  dom.view.showCard(first,{identity:'orbit',rarity:'rare',onNavigate:()=>{}});
  assert.equal(first.getAttribute('data-stock'),'metal');
  assert.equal(first.getAttribute('data-motion'),'still');
  assert.equal(first.getAttribute('data-foil'),'none');
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--recap-tint'),'#112233');
  assert.equal(first.listenerCount('click'),1);
  const next=dom.face();
  first.focus();
  dom.view.showCard(next);
  assert.equal(first.listenerCount('click'),0);
  assert.equal(dom.host.querySelector('.recap-card'),next);
  assert.equal(dom.document.activeElement,next);
  dom.view.dispose();
  dom.view.dispose();
  dom.view.showCard(dom.face());
  dom.view.open();
  assert.equal(dom.host.children.length,0);
});

test('instant opening returns before rendering and mounts its card exactly once', async t=>{
  const dom=setup(t,{appearance:{opening:'instant'}});
  const events=[];
  const face=dom.face();
  dom.view.showPack({count:3,onOpening:()=>events.push('opening'),
    renderCard:()=>{events.push('render');return {face,identity:'prism',rarity:'super_rare'};},
    onReveal:card=>{assert.equal(card.face,face);events.push('revealed');}});
  assert.deepEqual(events,['opening']);
  dom.view.open();
  await dom.settle();
  assert.deepEqual(events,['opening','render','revealed']);
  assert.equal(dom.host.querySelector('.recap-card'),face);
  assert.equal(dom.host.querySelectorAll('.recap-deck-under').length,2);
  assert.equal(face.getAttribute('data-foil'),'holographic');
});

test('manual reveal, skip and keyboard focus stay usable with reduced motion', async t=>{
  const dom=setup(t);
  let renders=0;
  const renderCard=()=>{renders++;return {face:dom.face()};};
  dom.view.showPack({renderCard,autoRevealFirst:false});
  dom.host.querySelector('.recap-pack').focus();
  dom.view.open();
  const ready=dom.host.querySelector('.recap-ready-card');
  assert.ok(ready);
  await dom.settle();
  assert.equal(renders,0);
  ready.click();
  await dom.settle();
  assert.equal(renders,1);
  assert.equal(dom.document.activeElement,dom.host.querySelector('.recap-card'));
  dom.view.showPack({renderCard});
  dom.host.querySelector('.recap-pack-skip').click();
  await dom.settle();
  assert.equal(renders,2);
});

test('fallback opening completes and a replaced animation cannot deliver a card', async t=>{
  const dom=setup(t,{loadRenderer:async()=>{throw new Error('Unavailable');}},false);
  let renders=0;
  dom.view.showPack({renderCard:()=>{renders++;return {face:dom.face()};}});
  await dom.settle();
  dom.view.open();
  assert.equal(dom.timers.size,1);
  const queued=[...dom.timers.values()][0].callback;
  const current=dom.face();
  dom.view.showCard(current);
  queued();
  await dom.settle();
  assert.equal(renders,0);
  assert.equal(dom.host.querySelector('.recap-card'),current);
  dom.view.showPack({renderCard:()=>{renders++;return {face:dom.face()};}});
  await dom.settle();
  dom.view.open();
  dom.runTimers();
  await dom.settle();
  assert.equal(renders,1);
});

test('pending render results and errors are ignored after replacement or disposal', async t=>{
  const dom=setup(t,{appearance:{opening:'instant'}});
  let complete, reject, revealed=0, errors=0;
  dom.view.showPack({renderCard:()=>new Promise(resolve=>{complete=resolve;}),onReveal:()=>revealed++});
  await dom.settle();
  const current=dom.face();
  dom.view.showCard(current);
  complete({face:dom.face()});
  await dom.settle();
  assert.equal(dom.host.querySelector('.recap-card'),current);
  assert.equal(revealed,0);
  dom.view.showPack({renderCard:()=>new Promise((resolve,fail)=>{reject=fail;}),onError:()=>errors++});
  await dom.settle();
  dom.view.dispose();
  reject(new Error('Late network failure'));
  await dom.settle();
  assert.equal(errors,0);
  assert.equal(dom.host.children.length,0);
});

test('render failures report an error and the view can show another pack', async t=>{
  const dom=setup(t,{appearance:{opening:'instant'}});
  const failure=new Error('Details are for the application');
  let reported;
  dom.view.showPack({renderCard:async()=>{throw failure;},onError:error=>{reported=error;}});
  await dom.settle();
  assert.equal(reported,failure);
  assert.equal(dom.host.firstElementChild.getAttribute('role'),'alert');
  assert.equal(dom.host.firstElementChild.textContent,'Unable to display this card.');
  dom.view.showPack({renderCard:()=>({face:dom.face()})});
  await dom.settle();
  assert.ok(dom.host.querySelector('.recap-card'));
});

test('synchronous opening hooks may replace or dispose the view safely', async t=>{
  const dom=setup(t,{appearance:{opening:'instant'}});
  const current=dom.face();
  let renders=0;
  dom.view.showPack({onOpening:()=>dom.view.showCard(current),
    renderCard:()=>{renders++;return {face:dom.face()};}});
  await dom.settle();
  assert.equal(dom.host.querySelector('.recap-card'),current);
  assert.equal(renders,0);
  dom.view.showPack({onOpening:dom.view.dispose,renderCard:()=>{renders++;return {face:dom.face()};}});
  await dom.settle();
  assert.equal(dom.host.children.length,0);
  assert.equal(renders,0);
});

test('pack-specific defaults reach the card and a resolved material is reused', async t=>{
  const dom=setup(t,{artwork:{accent:'#abcdef',tint:'#112233'}});
  const resolved=resolveAppearance(createAppearanceSettings({motion:'still'}),{},'sun','legendary');
  const face=dom.face();
  dom.view.showPack({appearance:{opening:'instant'},artwork:{tint:'#445566'},
    renderCard:()=>({face,appearance:resolved})});
  await dom.settle();
  assert.equal(face.getAttribute('data-motion'),'still');
  assert.equal(face.getAttribute('data-engraving'),resolved.engraving);
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--recap-tint'),'#445566');
});

test('invalid arguments fail clearly and disposal does not remove another owner’s DOM', t=>{
  const dom=setup(t);
  assert.throws(()=>createPackView(null),TypeError);
  assert.throws(()=>dom.view.showPack({}),/renderCard/);
  assert.throws(()=>dom.view.showPack({count:0,renderCard:()=>({face:dom.face()})}),RangeError);
  assert.throws(()=>dom.view.showCard(dom.host),TypeError);
  dom.view.showCard(dom.face());
  const other=dom.document.createElement('p');
  dom.host.replaceChildren(other);
  dom.view.dispose();
  assert.equal(dom.host.firstElementChild,other);
});

test('neutral artwork defaults and partial pack/card overrides always produce valid palette values', async t=>{
  const dom=setup(t);
  dom.view.showCard(dom.face());
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--accent'),'#e8c477');
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--recap-tint'),'#3a3020');
  dom.view.showPack({artwork:{accent:'#abcdef'},appearance:{opening:'instant'},
    renderCard:()=>({face:dom.face(),artwork:{tint:'#445566'}})});
  await dom.settle();
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--accent'),'#abcdef');
  assert.equal(dom.host.firstElementChild.style.getPropertyValue('--recap-tint'),'#445566');
});

test('invalid direct card input leaves the previous pack operable', async t=>{
  const dom=setup(t);
  let renders=0;
  dom.view.showPack({renderCard:()=>{renders++;return {face:dom.face()};}});
  assert.throws(()=>dom.view.showCard(null),TypeError);
  dom.view.open();
  await dom.settle();
  assert.equal(renders,1);
});

test('disposal inside a fallback opening callback cannot schedule more animation work', async t=>{
  const dom=setup(t,{loadRenderer:async()=>{throw new Error('Unavailable');}},false);
  let renders=0;
  dom.view.showPack({onOpening:dom.view.dispose,renderCard:()=>{renders++;return {face:dom.face()};}});
  await dom.settle();
  dom.view.open();
  assert.equal(dom.timers.size,0);
  assert.equal(dom.document.listenerCount('visibilitychange'),0);
  await dom.settle();
  assert.equal(renders,0);
});

test('disposal in a mystery skip callback cannot mount a detached ready deck', async t=>{
  const dom=setup(t);
  dom.view.showPack({mystery:true,autoRevealFirst:false,onOpening:dom.view.dispose,
    renderCard:()=>({face:dom.face()})});
  const scene=dom.host.firstElementChild;
  scene.querySelector('.recap-pack-skip').click();
  await dom.settle();
  assert.equal(scene.querySelector('.recap-ready-card'),null);
  assert.equal(dom.document.listenerCount('visibilitychange'),0);
  assert.equal(dom.timers.size,0);
});
