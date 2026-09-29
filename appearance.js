/* Shared v5 profiles. Each component has one fixed choice or a balanced assortment. */
'use strict';
const recapRarityCodes={common:'C',uncommon:'U',rare:'R',super_rare:'SR',epic:'E',legendary:'L'};
const recapAppearanceChoices={
  stock:['paper','metal'],coating:['matte','satin','gloss','pearl'],foil:['none','metallic','holographic'],
  coverage:['none','border','full'],pattern:['none','brushed','guilloche','dots','stardust','facets'],
  engraving:['none','radial','contour','facets'],decoration:['none','frame','lettering','frame-lettering'],
  palette:['channel','silver','spectrum','ice','amber','rose'],lighting:['soft','studio']
};
const recapAppearanceVariableComponents=Object.freeze(Object.keys(recapAppearanceChoices));
const recapRarityAppearanceDefaults={
  common:{stock:'paper',coating:'matte',foil:'none',coverage:'none',pattern:'none',engraving:'none',decoration:'none',palette:'channel',lighting:'soft'},
  uncommon:{stock:'paper',coating:'gloss',foil:'metallic',coverage:'full',pattern:'none',engraving:'none',decoration:'none',palette:'channel',lighting:'studio'},
  rare:{stock:'paper',coating:'gloss',foil:'metallic',coverage:'full',pattern:['brushed','guilloche','dots','stardust','facets'],engraving:'none',decoration:'lettering',palette:'channel',lighting:'studio'},
  super_rare:{stock:'paper',coating:'gloss',foil:'holographic',coverage:'full',pattern:['brushed','guilloche','dots','stardust','facets'],engraving:'none',decoration:'frame-lettering',palette:'channel',lighting:'studio'},
  epic:{stock:'paper',coating:'pearl',foil:'holographic',coverage:'full',pattern:'none',engraving:'none',decoration:'frame-lettering',palette:'channel',lighting:'studio'},
  legendary:{stock:'paper',coating:'gloss',foil:'holographic',coverage:'full',pattern:'none',engraving:['radial','contour','facets'],decoration:'frame-lettering',palette:'channel',lighting:'studio'}
};
const recapAppearanceDefaults={version:5,opening:'animated',glow:'gold',pack_zoom:true,motion:'interactive',
  card:{...Object.fromEntries(Object.entries(recapAppearanceChoices).map(([key,choices])=>[key,[...choices]])),
    coating:['matte','satin','gloss'],foil:['metallic','holographic'],coverage:'full',pattern:['brushed','guilloche','dots','stardust','facets'],engraving:'none',palette:'channel',lighting:'studio'},rarities:recapRarityAppearanceDefaults};
const recapAppearanceSettingChoices={opening:['animated','instant'],glow:['bronze','silver','gold','platinum','diamond','random'],motion:['interactive','still']};
function recapFreeze(value) {
  Object.values(value).forEach(item=>{if(item && typeof item==='object')recapFreeze(item);});
  return Object.freeze(value);
}
recapFreeze(recapAppearanceChoices);recapFreeze(recapAppearanceDefaults);
function recapObject(value) {return value && typeof value==='object' && !Array.isArray(value) ? value : {};}
function recapChoice(value,choices,fallback) {return typeof value==='string' && choices.includes(value) ? value : fallback;}
function recapMaterialComponentEnabled(components,key) {
  const some=(axis,test)=>[components[axis]].flat().some(test);
  if(key==='coverage' || key==='pattern')return some('foil',value=>value!=='none');
  if(key==='lighting')return some('stock',value=>value==='metal') || some('coating',value=>value!=='matte') ||
    some('foil',value=>value!=='none') || some('engraving',value=>value!=='none') || some('decoration',value=>value!=='none');
  return true;
}
function normalizeRecapProfile(value,fallback=recapAppearanceDefaults.card) {
  value=recapObject(value);
  const components=Object.fromEntries(Object.entries(recapAppearanceChoices).map(([key,choices])=>{
    const option=value[key];
    if(Array.isArray(option)) {
      const selected=choices.filter(choice=>option.includes(choice));
      if(selected.length)return [key,selected.length===1 ? selected[0] : selected];
    }
    const selected=recapChoice(option,choices,fallback[key]);
    return [key,Array.isArray(selected) ? [...selected] : selected];
  }));
  if(Array.isArray(components.coverage)) {
    const active=components.coverage.filter(option=>option!=='none');
    components.coverage=active.length===1 ? active[0] : active;
  }
  if(components.foil==='none' || components.coverage==='none')Object.assign(components,{foil:'none',coverage:'none',pattern:'none'});
  if(!recapMaterialComponentEnabled(components,'lighting'))components.lighting='soft';
  return components;
}
function recapProfileChoices(value,key) {
  const option=normalizeRecapProfile(value)[key];
  return Array.isArray(option) ? [...option] : option===undefined ? [] : [option];
}
function recapProfileComponentEnabled(value,key) {
  return recapMaterialComponentEnabled(normalizeRecapProfile(value),key);
}
function normalizeRecapAppearance(value) {
  value=recapObject(value);
  const result=JSON.parse(JSON.stringify(recapAppearanceDefaults));
  if(value.version!==5)return result;
  for(const [key,choices] of Object.entries(recapAppearanceSettingChoices))result[key]=recapChoice(value[key],choices,result[key]);
  if(typeof value.pack_zoom==='boolean')result.pack_zoom=value.pack_zoom;
  result.card=normalizeRecapProfile(value.card,recapAppearanceDefaults.card);
  const profiles=recapObject(value.rarities);
  result.rarities=Object.fromEntries(Object.entries(recapRarityAppearanceDefaults).map(([rarity,fallback])=>[
    rarity,normalizeRecapProfile(profiles[rarity],fallback)
  ]));
  return result;
}
function recapAppearanceHash(identity) {
  let hash=2166136261;
  for(const character of String(identity)) {hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}
function resolveRecapProfile(settings,profile,identity,select) {
  const components={};
  // Foil precedes its dependent choices; lighting follows every reactive surface.
  for(const axis of recapAppearanceVariableComponents)components[axis]=recapMaterialComponentEnabled(components,axis) ?
    select(Array.isArray(profile[axis]) ? profile[axis] : [profile[axis]],axis) : axis==='lighting' ? 'soft' : 'none';
  const glowChoices=recapAppearanceSettingChoices.glow.filter(choice=>choice!=='random');
  const glow=settings.glow==='random' ? glowChoices[recapAppearanceHash(`${identity}:glow`)%glowChoices.length] : settings.glow;
  return Object.freeze({_resolved:true,version:5,...components,motion:settings.motion,
    opening:settings.opening,glow,pack_zoom:settings.pack_zoom});
}
function recapAppearanceTarget(settings,rarity) {return Object.hasOwn(settings.rarities,rarity) ? rarity : 'card';}
function createRarityAppearanceResolver(value,artwork={},collectionId='') {
  const settings=normalizeRecapAppearance(value),bags=new Map(),resolved=new Map();
  const select=(choices,scope)=>{
    if(choices.length===1)return choices[0];
    const key=JSON.stringify(scope);
    let state=bags.get(key);
    if(!state) {state={cycle:0,bag:[]};bags.set(key,state);}
    if(!state.bag.length) {
      state.bag=[...choices];
      let seed=recapAppearanceHash(JSON.stringify([String(collectionId),...scope,state.cycle++])) || 1;
      for(let index=state.bag.length-1;index>0;index--) {
        seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
        const other=(seed>>>0)%(index+1);
        [state.bag[index],state.bag[other]]=[state.bag[other],state.bag[index]];
      }
    }
    return state.bag.shift();
  };
  return (rarity,identity='card')=>{
    const target=recapAppearanceTarget(settings,rarity),key=JSON.stringify([target,String(identity)]);
    if(resolved.has(key))return resolved.get(key);
    const profile=target==='card' ? settings.card : settings.rarities[target];
    const appearance=resolveRecapProfile(settings,profile,String(identity),(choices,axis)=>select(choices,[target,axis]));
    resolved.set(key,appearance);
    return appearance;
  };
}
function resolveRecapAppearances(value,artwork={},entries=[],collectionId='') {
  if(value?._resolved===true && value.version===5) {
    const appearance=Object.isFrozen(value) ? value : Object.freeze(value);
    return entries.map(()=>appearance);
  }
  const settings=normalizeRecapAppearance(value);
  const keys=entries.map(entry=>JSON.stringify([recapAppearanceTarget(settings,entry.rarity),String(entry.identity ?? 'card')]));
  const unique=[...new Set(keys)].sort();
  // Finite collections allocate in canonical identity order; streaming uses accepted draw order.
  const resolve=createRarityAppearanceResolver(settings,artwork,collectionId || JSON.stringify(unique));
  const appearances=new Map(unique.map(key=>{const [target,identity]=JSON.parse(key);return [key,resolve(target,identity)];}));
  return keys.map(key=>appearances.get(key));
}
function resolveRecapAppearance(value,artwork={},identity='card',rarity=null) {
  return resolveRecapAppearances(value,artwork,[{identity,rarity}])[0];
}
function resolveRecapCardAppearances(value,artwork={},count=0,identities=[],collectionId='') {
  return resolveRecapAppearances(value,artwork,Array.from({length:count},(_,index)=>({identity:identities[index] ?? `card:${index}`,rarity:null})),collectionId);
}
function resolveRarityCardAppearances(value,artwork={},rarities=[],identities=[],collectionId='') {
  return resolveRecapAppearances(value,artwork,rarities.map((rarity,index)=>({identity:identities[index] ?? `card:${index}`,rarity})),collectionId);
}
function recapMaterialPalette(accent,palette) {
  const palettes={
    spectrum:['#ef91dc','#ab9aff','#74e3f5','#8ce5b1','#f3d899'],silver:['#8da4b8','#eaf8ff','#a0b5c8','#ffffff','#8da4b8'],
    ice:['#548bac','#becdda','#76d1db','#8b94be','#548bac'],amber:['#895123','#e7c98c','#ba824f','#f6d8a7','#895123'],
    rose:['#885e9a','#d7a1c0','#8b91cb','#e4bbaa','#885e9a']
  };
  if(Object.hasOwn(palettes,palette))return [...palettes[palette]];
  const hex=typeof accent==='string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#e8c477';
  const rgb=[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
  return [.05,.72,.3,.84,.05].map(amount=>'#'+rgb.map(value=>Math.round(value+(255-value)*amount).toString(16).padStart(2,'0')).join(''));
}
function recapAccentHsl(accent) {
  const hex=typeof accent==='string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#e8c477';
  const [r,g,b]=[1,3,5].map(offset => parseInt(hex.slice(offset,offset+2),16)/255);
  const high=Math.max(r,g,b),low=Math.min(r,g,b),delta=high-low,light=(high+low)/2;
  const hue=delta===0 ? 0 : high===r ? ((g-b)/delta+6)%6 : high===g ? (b-r)/delta+2 : (r-g)/delta+4;
  return [hue*60,delta===0 ? 0 : delta/(1-Math.abs(2*light-1))*100,light*100];
}
function recapFoilColors(accent) {
  const [hue,saturation]=recapAccentHsl(accent),sat=Math.min(58,saturation*.7);
  // Nearby hues and restrained chroma keep the reflection related to the printed card.
  return [[-20,sat,38,0],[4,sat*.55,76,16],[24,sat,54,30],[-6,sat*.4,82,44],[-20,sat,38,60]]
    .map(([shift,s,l,stop]) => `hsl(${Math.round((hue+shift+360)%360)} ${Math.round(s)}% ${l}%) ${stop}%`).join(',');
}

export {
  recapRarityCodes,
  recapAppearanceChoices,
  recapAppearanceVariableComponents,
  recapRarityAppearanceDefaults,
  recapAppearanceDefaults,
  recapAppearanceSettingChoices,
  recapFreeze,
  recapObject,
  recapChoice,
  recapMaterialComponentEnabled,
  normalizeRecapProfile,
  recapProfileChoices,
  recapProfileComponentEnabled,
  normalizeRecapAppearance,
  recapAppearanceHash,
  resolveRecapProfile,
  recapAppearanceTarget,
  createRarityAppearanceResolver,
  resolveRecapAppearances,
  resolveRecapAppearance,
  resolveRecapCardAppearances,
  resolveRarityCardAppearances,
  recapMaterialPalette,
  recapAccentHsl,
  recapFoilColors
};
// Stable names for consumers of the focused appearance entry point.
export {recapAppearanceDefaults as appearanceDefaults, recapAppearanceChoices as appearanceChoices,
  normalizeRecapAppearance as normalizeAppearance, resolveRecapAppearance as resolveAppearance,
  resolveRecapAppearances as resolveAppearances};
