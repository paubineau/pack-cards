import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppearanceEditor} from '../editor.js';
import {normalizeRecapAppearance, recapProfileChoices} from '../appearance.js';
import {installDOM} from './dom-fixture.mjs';

const bare={stock:'paper',coating:'matte',foil:'none',coverage:'none',pattern:'none',engraving:'none',decoration:'none',palette:'channel',lighting:'soft'};
const all=node=>[node,...node.children.flatMap(all)];
function choose(editor,key,value,checked) {const control=editor.controls.choices[key][value];control.checked=checked;control.onchange();}

test('editors use unique accessible IDs, partial labels, and isolated normalized settings',t=>{
  const dom=installDOM(t),host=dom.host();
  const first=createAppearanceEditor(host,{initial:{version:5,card:bare},labels:{target:'Style',choices:{stock:{metal:'Steel'}}}});
  const second=createAppearanceEditor(host);
  const nodes=all(host),ids=nodes.map(node=>node.id).filter(Boolean);
  assert.equal(ids.length,new Set(ids).size,'Every target, checkbox and description has a unique ID across instances.');
  for(const node of nodes) {
    if(node.htmlFor)assert.ok(ids.includes(node.htmlFor));
    const described=node.getAttribute('aria-describedby');if(described)assert.ok(ids.includes(described));
  }
  assert.equal(first.root.children[0].children[0].textContent,'Style');
  assert.equal(first.controls.choices.stock.metal.parentElement.children[1].textContent,'Steel');
  choose(first,'stock','metal',true);
  assert.deepEqual(recapProfileChoices(first.getSettings().card,'stock'),['paper','metal']);
  assert.equal(second.getSettings().card.coating.length,3);
  const copy=first.getSettings();copy.card.foil='holographic';assert.equal(first.getSettings().card.foil,'none');
  first.dispose();assert.equal(host.children.length,1);assert.equal(host.children[0],second.root);
  second.dispose();
});

test('component dependencies, last-choice guards, rarity resets and callback copies preserve editor state',t=>{
  const dom=installDOM(t),changes=[];
  const editor=createAppearanceEditor(dom.host(),{initial:{version:5,card:bare},showSettings:false,
    onChange:(settings,target)=>{changes.push({settings,target});settings.card.stock='metal';}});
  assert.equal(editor.controls.motion,undefined);
  choose(editor,'stock','paper',false);
  assert.equal(editor.controls.choices.stock.paper.checked,true);assert.equal(changes.length,0);
  choose(editor,'pattern','dots',true);assert.equal(changes.length,0);
  assert.equal(editor.getSettings().card.pattern,'none');
  choose(editor,'foil','holographic',true);
  assert.deepEqual(editor.getSettings().card.foil,['none','holographic']);assert.equal(editor.getSettings().card.coverage,'border');
  assert.equal(editor.controls.coverage.disabled,false);assert.equal(editor.controls.lighting.disabled,false);
  assert.equal(editor.getSettings().card.stock,'paper','Callbacks receive a copy, not mutable editor state.');
  const card=editor.getSettings().card;
  editor.controls.target.value='legendary';editor.controls.target.onchange();
  assert.equal(changes.at(-1).target,'legendary');
  choose(editor,'palette','rose',true);assert.deepEqual(editor.getSettings().rarities.legendary.palette,['channel','rose']);
  editor.controls.reset.onclick();assert.deepEqual(editor.getSettings().rarities.legendary,normalizeRecapAppearance({}).rarities.legendary);
  assert.deepEqual(editor.getSettings().card,card);
  editor.controls.target.value='unknown';editor.controls.target.onchange();assert.equal(editor.getTarget(),'legendary');
  editor.dispose();
});

test('generated shared controls round-trip settings and programmatic replacement remains silent',t=>{
  const dom=installDOM(t),changes=[];
  const editor=createAppearanceEditor(dom.host(),{onChange:settings=>changes.push(settings)});
  for(const [key,value] of [['motion','still'],['opening','instant'],['glow','diamond']]) {
    editor.controls[key].value=value;editor.controls[key].emit('change');assert.equal(editor.getSettings()[key],value);
  }
  editor.controls.pack_zoom.checked=false;editor.controls.pack_zoom.emit('change');assert.equal(editor.getSettings().pack_zoom,false);
  assert.equal(changes.length,4);
  editor.setSettings({version:5,motion:'interactive',opening:'animated',glow:'silver',pack_zoom:true});
  assert.equal(changes.length,4);assert.equal(editor.controls.motion.value,'interactive');assert.equal(editor.controls.pack_zoom.checked,true);
  const change=editor.controls.choices.stock.paper.onchange;
  editor.dispose();editor.dispose();change();editor.controls.motion.emit('change');
  assert.equal(changes.length,4);assert.equal(editor.controls.motion.listenerCount('change'),0);
  editor.setSettings({version:5,motion:'still'});assert.equal(editor.getSettings().motion,'interactive');
});

test('supplied shared controls keep their DOM and unrelated listeners after disposal',t=>{
  const dom=installDOM(t),host=dom.host(),motion=dom.document.createElement('select'),sibling=dom.document.createElement('p');
  host.append(sibling,motion);let unrelated=0,changes=0;
  motion.addEventListener('change',()=>unrelated++);
  const editor=createAppearanceEditor(host,{initial:{version:5,motion:'still'},sharedControls:{motion},onChange:()=>changes++});
  assert.equal(editor.controls.motion,motion);assert.equal(motion.value,'still');assert.equal(editor.controls.opening,undefined);
  motion.value='interactive';motion.emit('change');assert.equal(editor.getSettings().motion,'interactive');assert.equal(changes,1);
  editor.dispose();assert.deepEqual(host.children,[sibling,motion]);motion.emit('change');
  assert.equal(changes,1);assert.equal(unrelated,2);assert.equal(motion.listenerCount('change'),1);
});
