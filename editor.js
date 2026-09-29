import {normalizeRecapAppearance, recapAppearanceDefaults, recapAppearanceChoices, recapAppearanceSettingChoices,
  recapProfileChoices, recapProfileComponentEnabled} from './appearance.js';

const defaultLabels={
  target:'Appearance to edit',card:'Ordinary cards · Varied',
  rarities:{common:'Common',uncommon:'Uncommon',rare:'Rare',super_rare:'Super rare',epic:'Epic',legendary:'Legendary'},
  components:{stock:'Stock',coating:'Coating',foil:'Foil treatment',coverage:'Foil coverage',pattern:'Foil pattern',engraving:'Engraving',decoration:'Metallic decoration',palette:'Palette',lighting:'Reflection intensity'},
  choices:{stock:{paper:'Paper',metal:'Metal'},coating:{matte:'Matte',satin:'Satin',gloss:'Gloss',pearl:'Pearl'},foil:{none:'None',metallic:'Metallic',holographic:'Holographic'},coverage:{none:'None',border:'Border',full:'Full surface'},pattern:{none:'None',brushed:'Brushed',guilloche:'Guilloche',dots:'Microdots',stardust:'Stardust',facets:'Facets'},engraving:{none:'None',radial:'Circles',contour:'Contours',facets:'Facets'},decoration:{none:'None',frame:'Frame',lettering:'Lettering','frame-lettering':'Frame and lettering'},palette:{channel:'Artwork colors',silver:'Silver',spectrum:'Spectrum',ice:'Ice',amber:'Amber',rose:'Rose'},lighting:{soft:'Soft',studio:'Strong'}},
  groups:{surface:'Stock and coating',foil:'Foil',details:'Details',color:'Colors and reflections'},
  instructions:'Select one fixed option or several options balanced among cards of this appearance. Components are distributed separately, so combinations can repeat. Only cards where a component is active take part in its distribution.',
  lastChoice:'Keep at least one option. Select another before removing this one.',
  fixedChoice:'One fixed option. Select several for variety.',
  choiceCount:count=>`${count} options balanced among cards where this component is active.`,
  requiresFoil:'Available with foil.',requiresLighting:'Available when a surface reacts to light.',
  noLighting:'No surface reacts to light: add a coating, foil, engraving or frame to adjust its lighting.',
  noFoil:'Without foil, its coverage and pattern are disabled. Coating, engraving and decoration remain independent.',
  hasFoil:'Coverage and pattern are distributed only among cards with foil.',reset:'Reset this appearance',
  settingsTitle:'Motion and pack opening',
  settings:{motion:'Card motion',opening:'Pack opening',glow:'Opening light',pack_zoom:'Enlarge cards as they leave the pack'},
  settingChoices:{motion:{interactive:'Pointer and device tilt',still:'Fixed light'},opening:{animated:'Tear open the pack',instant:'Show cards directly'},glow:{bronze:'None',silver:'Silver',gold:'Gold',platinum:'Blue',diamond:'Violet',random:'Vary by pack'}},
  settingsHelp:'The device’s reduced-motion preference takes priority.'
};
let nextEditorId=0;

/** Mount optional, framework-independent material and pack-setting controls. */
export function createAppearanceEditor(container,options={}) {
  const document=options.document || container.ownerDocument || globalThis.document;
  const labels={...defaultLabels,...options.labels};
  for (const key of ['rarities','components','groups','settings']) labels[key]={...defaultLabels[key],...options.labels?.[key]};
  for (const key of ['choices','settingChoices']) labels[key]=Object.fromEntries(Object.entries(defaultLabels[key]).map(([component,values])=>[component,{...values,...options.labels?.[key]?.[component]}]));
  const prefix=options.idPrefix || `pack-cards-editor-${++nextEditorId}`;
  const create=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined && text!==null)node.textContent=text;if(className)node.className=className;return node;};
  const root=create('div',null,'pack-cards-editor'),controls={choices:{}},choiceHelp={},release=[];
  let settings=normalizeRecapAppearance(options.initial),target='card',disposed=false;
  function notify() {if(!disposed)options.onChange?.(normalizeRecapAppearance(settings),target);}
  function handler(node,key,callback) {
    const guarded=(...args)=>{if(!disposed)callback(...args);};
    node[key]=guarded;release.push(()=>{if(node[key]===guarded)node[key]=null;});
  }
  const targetField=create('div'),targetLabel=create('label',labels.target),targetControl=create('select');
  targetControl.id=prefix+'-target';targetLabel.htmlFor=targetControl.id;controls.target=targetControl;
  for (const [value,label] of Object.entries({card:labels.card,...labels.rarities})) {
    const option=create('option',label);option.value=value;targetControl.append(option);
  }
  targetField.append(targetLabel,targetControl);root.append(targetField,create('p',labels.instructions,'fine'));
  function profile() {return target==='card' ? settings.card : settings.rarities[target];}
  function setProfile(value) {
    if(target==='card')settings.card=value;else settings.rarities[target]=value;
    settings=normalizeRecapAppearance(settings);refresh();notify();
  }
  function assortment(key,parent) {
    const group=create('fieldset',null,'appearance-choice-set');group.id=prefix+'-'+key;
    group.append(create('legend',labels.components[key]));
    const grid=create('div',null,'appearance-choice-grid'),help=create('p','','fine appearance-choice-help');
    help.id=prefix+'-'+key+'-help';help.setAttribute('aria-live','polite');
    controls[key]=group;controls.choices[key]={};choiceHelp[key]=help;
    for (const value of recapAppearanceChoices[key].filter(value=>key!=='coverage' || value!=='none')) {
      const label=create('label',null,'appearance-component-option'),checkbox=create('input');
      checkbox.type='checkbox';checkbox.value=value;checkbox.id=prefix+'-'+key+'-'+value;
      checkbox.setAttribute('aria-describedby',help.id);label.htmlFor=checkbox.id;
      label.append(checkbox,create('span',labels.choices[key][value]));grid.append(label);controls.choices[key][value]=checkbox;
      handler(checkbox,'onchange',()=>{
        if(group.disabled){refresh();return;}
        const selected=recapProfileChoices(profile(),key);
        if(!checkbox.checked && selected.length===1){checkbox.checked=true;help.textContent=labels.lastChoice;return;}
        const choices=checkbox.checked ? [...selected,value] : selected.filter(choice=>choice!==value);
        const valueProfile={...profile(),[key]:choices};
        if(key==='foil' && choices.some(choice=>choice!=='none') && recapProfileChoices(profile(),'coverage').every(choice=>choice==='none'))valueProfile.coverage='border';
        setProfile(valueProfile);
      });
    }
    group.append(grid,help);parent.append(group);
  }
  for (const [title,keys] of [[labels.groups.surface,['stock','coating']],[labels.groups.foil,['foil','coverage','pattern']],[labels.groups.details,['engraving','decoration']],[labels.groups.color,['palette','lighting']]]) {
    const group=create('fieldset',null,'appearance-component-group');group.append(create('legend',title));
    const grid=create('div',null,'appearance-grid');group.append(grid);root.append(group);
    for(const key of keys)assortment(key,grid);
  }
  const dependency=create('p','','fine');dependency.id=prefix+'-foil-dependency-help';dependency.setAttribute('aria-live','polite');root.append(dependency);
  controls.coverage.setAttribute('aria-describedby',dependency.id);controls.pattern.setAttribute('aria-describedby',dependency.id);
  const lightingHelp=create('p','','fine');lightingHelp.id=prefix+'-lighting-dependency-help';lightingHelp.setAttribute('aria-live','polite');root.append(lightingHelp);
  controls.lighting.setAttribute('aria-describedby',lightingHelp.id);
  const reset=create('button',labels.reset,'text-button');reset.id=prefix+'-profile-reset';reset.type='button';root.append(reset);controls.reset=reset;
  const shared=options.sharedControls ? {...options.sharedControls} : {};
  if(!options.sharedControls && options.showSettings!==false) {
    const section=create('details',null,'appearance-pack-details'),grid=create('div',null,'appearance-grid');
    section.append(create('summary',labels.settingsTitle),grid);
    for(const key of ['motion','opening','glow']) {
      const field=create('div'),label=create('label',labels.settings[key]),select=create('select');
      select.id=prefix+'-'+key;label.htmlFor=select.id;
      for(const value of recapAppearanceSettingChoices[key]){const option=create('option',labels.settingChoices[key][value]);option.value=value;select.append(option);}
      shared[key]=select;field.append(label,select);grid.append(field);
    }
    const label=create('label',null,'check-label'),checkbox=create('input');checkbox.type='checkbox';checkbox.id=prefix+'-pack_zoom';label.htmlFor=checkbox.id;
    label.append(checkbox,create('span',labels.settings.pack_zoom));shared.pack_zoom=checkbox;
    section.append(label,create('p',labels.settingsHelp,'fine'));root.append(section);
  }
  for(const key of ['motion','opening','glow','pack_zoom']) {
    const control=shared[key];if(!control)continue;controls[key]=control;
    const change=()=>{if(disposed)return;settings=normalizeRecapAppearance({...settings,[key]:key==='pack_zoom' ? control.checked : control.value});refresh();notify();};
    control.addEventListener('change',change);release.push(()=>control.removeEventListener?.('change',change));
  }
  function refresh() {
    const value=profile();controls.target.value=target;
    for (const key of Object.keys(recapAppearanceChoices)) {
      const selected=recapProfileChoices(value,key),unavailable=!recapProfileComponentEnabled(value,key);
      controls[key].disabled=unavailable;
      for (const [choice,checkbox] of Object.entries(controls.choices[key])) {checkbox.checked=selected.includes(choice);checkbox.disabled=unavailable || (checkbox.checked && selected.length===1);}
      choiceHelp[key].textContent=unavailable ? (key==='lighting' ? labels.requiresLighting : labels.requiresFoil) : selected.length===1 ? labels.fixedChoice : labels.choiceCount(selected.length);
    }
    const noFoil=!recapProfileComponentEnabled(value,'coverage'),noLighting=!recapProfileComponentEnabled(value,'lighting');
    lightingHelp.hidden=!noLighting;lightingHelp.textContent=noLighting ? labels.noLighting : '';
    dependency.textContent=noFoil ? labels.noFoil : labels.hasFoil;
    for(const key of ['motion','opening','glow','pack_zoom'])if(shared[key]){if(key==='pack_zoom')shared[key].checked=settings[key];else shared[key].value=settings[key];}
  }
  handler(controls.target,'onchange',()=>{const value=controls.target.value;if(value==='card' || Object.hasOwn(settings.rarities,value))target=value;refresh();notify();});
  handler(reset,'onclick',()=>setProfile(target==='card' ? recapAppearanceDefaults.card : recapAppearanceDefaults.rarities[target]));
  container.append(root);refresh();
  return {root,controls,getSettings:()=>normalizeRecapAppearance(settings),getTarget:()=>target,
    setSettings:value=>{if(!disposed){settings=normalizeRecapAppearance(value);refresh();}},
    dispose:()=>{if(disposed)return;disposed=true;release.forEach(dispose=>dispose());root.remove();}};
}
