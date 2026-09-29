import {recapMaterialPalette,resolveRecapAppearance} from './appearance.js';
'use strict';

function recapExportMaterialColors(accent,appearance) {
  return recapMaterialPalette(accent,appearance.palette);
}

function recapExportMaterialGradient(ctx,accent,appearance) {
  const gradient=ctx.createLinearGradient(40,80,1040,1340);
  recapExportMaterialColors(accent,appearance).forEach((color,index)=>gradient.addColorStop(index/4,color));
  return gradient;
}

// Keep the original fixed grazing light and drawing geometry. Components decide
// which layers are present; exporting never samples pointer state or randomness.
function drawRecapExportMaterial(ctx,artwork={},appearance) {
  if (!appearance) return;
  const material=resolveRecapAppearance(appearance,artwork);
  const {foil,coverage,pattern,engraving,decoration,coating}=material;
  const strength=material.lighting==='studio' ? 1 : .68;
  const colors=recapExportMaterialGradient(ctx,artwork.accent,material);
  const edgeLight=(x,y)=>.16+.84*Math.pow(Math.max(0,1-Math.min(x-31,1049-x,y-27,1413-y)/310),1.4);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(31,27,1018,1386,34); ctx.clip();
  ctx.globalCompositeOperation='screen';

  if (material.stock==='metal') {
    const light=ctx.createRadialGradient(840,290,20,710,390,1050);
    light.addColorStop(0,'#edf4ff'); light.addColorStop(.4,'#bac6d4'); light.addColorStop(1,'#808080');
    ctx.save(); ctx.globalCompositeOperation='soft-light'; ctx.globalAlpha=strength*.06;
    ctx.fillStyle=light; ctx.fillRect(31,27,1018,1386); ctx.restore();
  }

  if (foil!=='none' && coverage!=='none') {
    ctx.save();
    if (coverage==='border') {
      ctx.beginPath(); ctx.rect(31,27,1018,1386); ctx.rect(108,150,864,1152); ctx.clip('evenodd');
    }
    ctx.fillStyle=colors; ctx.strokeStyle=colors;
    ctx.globalAlpha=strength*(foil==='metallic' ? .075 : .025);
    ctx.fillRect(31,27,1018,1386);
    if (pattern==='stardust') {
      // The original low-discrepancy sequence repeats exactly on every export.
      for (let i=0;i<640;i++) {
        const x=32+(i*617%1016),y=28+(i*941%1384),size=i%17===0 ? 3 : 1+i%3*.45;
        ctx.globalAlpha=strength*edgeLight(x,y)*(.22+i%5*.055);
        ctx.beginPath(); ctx.arc(x,y,size,0,Math.PI*2); ctx.fill();
        if (i%53===0) {
          ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x-7,y); ctx.lineTo(x+7,y);
          ctx.moveTo(x,y-7); ctx.lineTo(x,y+7); ctx.stroke();
        }
      }
    } else if (pattern==='facets') {
      for (let row=-1;row<9;row++) for (let column=-1;column<7;column++) {
        const x=column*200+(row%2)*100,y=row*190;
        ctx.globalAlpha=strength*(.015+((row+column+14)%3)*.016);
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+200,y+190); ctx.lineTo(x-100,y+190); ctx.closePath(); ctx.fill();
        ctx.globalAlpha=strength*.09; ctx.lineWidth=1; ctx.stroke();
      }
    } else {
      // Fine grain is intrinsic to foil; the selected pattern adds microtooling.
      for (let i=0;i<1800;i++) {
        const x=32+(i*617%1016),y=28+(i*941%1384);
        ctx.globalAlpha=strength*edgeLight(x,y)*(coverage==='border' ? .035 : .10);
        ctx.fillRect(x,y,foil==='metallic' ? 8+i%15 : 1.2,1);
      }
    }
    ctx.globalAlpha=strength*.07; ctx.lineWidth=1.1;
    if (pattern==='brushed' || pattern==='guilloche') {
      ctx.beginPath();
      for (let y=-400;y<1800;y+=pattern==='brushed' ? 12 : 26) {
        ctx.moveTo(31,y);
        if (pattern==='brushed') ctx.lineTo(1049,y+260);
        else for (let x=39;x<=1055;x+=8) ctx.lineTo(x,y+Math.sin(x/55)*30);
      }
      ctx.stroke();
    } else if (pattern==='dots') {
      for (let y=42;y<1413;y+=21) for (let x=42;x<1049;x+=21) {
        ctx.globalAlpha=strength*edgeLight(x,y)*.19;
        ctx.beginPath(); ctx.arc(x,y,1.3,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // The clear coating uses the original broad catch, independently of the foil.
  const gloss=coating==='gloss' || coating==='pearl' ? 1 : coating==='satin' ? .6 : 0;
  if (gloss) {
    const light=ctx.createRadialGradient(840,290,20,710,390,1050);
    light.addColorStop(0,'#edf4ff'); light.addColorStop(.5,'#a9bdcc80'); light.addColorStop(1,'#8299ac00');
    ctx.fillStyle=light; ctx.globalAlpha=strength*gloss*.075; ctx.fillRect(31,27,1018,1386);
  }

  // Stamped rails stay outside the original printed column (82..998).
  if (decoration.includes('frame')) {
    ctx.globalAlpha=strength*(pattern==='stardust' || pattern==='facets' ? .3 : .6);
    ctx.strokeStyle=colors; ctx.lineWidth=2;
    for (const side of [1,-1]) {
      const point=(x,y)=>[side===1 ? x : 1080-x,y];
      const move=(x,y)=>ctx.moveTo(...point(x,y)),line=(x,y)=>ctx.lineTo(...point(x,y));
      ctx.beginPath(); move(61,256); line(61,540); line(48,596); line(48,844); line(61,900); line(61,1184);
      move(73,650); line(73,790); ctx.stroke();
    }
  }

  if (coating==='pearl') {
    // Restore the original smooth pearl catch without requiring foil or engraving.
    const palette=recapExportMaterialColors(artwork.accent,material);
    const pearl=[palette[1],palette[3]].map(color=>{
      const rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
      return rgb.map((value,index)=>Math.round(value*.25+[234,243,255][index]*.75)).join(',');
    });
    const sheen=ctx.createLinearGradient(40,160,1040,1260);
    for (const [stop,color,alpha] of [[0,pearl[0],0],[.22,pearl[0],0],[.43,pearl[0],.55],
      [.54,pearl[1],1],[.78,pearl[1],0],[1,pearl[1],0]]) sheen.addColorStop(stop,`rgba(${color},${alpha})`);
    ctx.globalAlpha=strength*.1; ctx.fillStyle=sheen; ctx.fillRect(31,27,1018,1386);
  }

  if (engraving!=='none') {
    // Preserve the original incised highlight and adjacent shadow, also on matte stock.
    function tooling() {
      ctx.beginPath();
      if (engraving==='radial' || engraving==='contour') {
        const x=engraving==='contour' ? 800 : 190,y=engraving==='contour' ? 990 : 865;
        for (let radius=25;radius<1600;radius+=18) {
          ctx.moveTo(x+radius,y); ctx.ellipse(x,y,radius,radius*(engraving==='contour' ? .72 : 1),0,0,Math.PI*2);
        }
      } else if (engraving==='facets') {
        const x=330,y=365;
        for (let i=0;i<180;i++) {
          const angle=i*Math.PI/90,radius=20+(i%6)*25;
          ctx.moveTo(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius);
          ctx.lineTo(x+Math.cos(angle)*1800,y+Math.sin(angle)*1800);
        }
        for (let radius=140;radius<1800;radius+=95) for (let i=0;i<=12;i++) {
          const angle=i*Math.PI/6,px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius;
          if (!i) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
      }
      ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=strength*.24;
    ctx.strokeStyle='#020611'; ctx.lineWidth=2; ctx.translate(1.5,1.5); tooling(); ctx.restore();
    ctx.globalAlpha=strength*.14; ctx.strokeStyle=colors; ctx.lineWidth=1.2; tooling();
  }
  ctx.restore();
}

function recapExportInk(ctx,accent,appearance) {
  if (!appearance) return accent;
  const material=resolveRecapAppearance(appearance,{accent});
  if (!material.decoration.includes('lettering')) return accent;
  const colors=recapExportMaterialColors(accent,material),gradient=ctx.createLinearGradient(82,100,998,1340);
  const strength=material.lighting==='studio' ? .95 : .7;
  const wash=material.engraving!=='none' ? .82-strength*.24 : material.coating==='pearl' ? .94-strength*.1 : .94-strength*.14;
  function printed(color) {
    const rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
    return `rgb(${rgb.map((value,index)=>Math.round(value*(1-wash)+[234,243,255][index]*wash)).join(',')})`;
  }
  // The original pale print wash preserves legibility for every palette.
  for (const [stop,color] of [[0,printed(colors[1])],[.38,'#edf4ff'],[.5,printed(colors[3])],[.62,'#ffffff'],[1,printed(colors[1])]]) gradient.addColorStop(stop,color);
  return gradient;
}

function drawRecapExportStock(ctx,artwork={},appearance) {
  const material=resolveRecapAppearance(appearance,artwork),accent=artwork.accent || '#e8c477';
  ctx.save();
  let edge='#e9e5db';
  if (material.stock==='metal' || material.foil!=='none') {
    edge=ctx.createLinearGradient(20,20,1060,1420);
    recapMaterialPalette(accent,material.palette).forEach((color,index)=>edge.addColorStop(index/4,color));
  }
  ctx.fillStyle=edge; ctx.beginPath(); ctx.roundRect(20,16,1040,1408,44); ctx.fill();
  let face='#141e2e';
  if (material.stock==='metal' || material.foil!=='none') {
    face=ctx.createLinearGradient(36,32,1044,1408);
    if (material.stock==='paper') {
      face.addColorStop(0,'#182438'); face.addColorStop(.55,'#0f1828'); face.addColorStop(1,artwork.tint || '#3a3020');
    } else if (material.palette==='silver') {
      face.addColorStop(0,'#273344'); face.addColorStop(1,'#151d2c');
    } else {
      const tones={spectrum:'#b6b9cf',ice:'#94bacd',amber:'#cfa866',rose:'#bc99bf'};
      const tone=tones[material.palette] || (/^#[0-9a-f]{6}$/i.test(accent) ? accent : '#e8c477');
      const rgb=[1,3,5].map((offset,index)=>Math.round(parseInt(tone.slice(offset,offset+2),16)*.12+[27,36,48][index]*.88));
      face.addColorStop(0,`rgb(${rgb.join(',')})`); face.addColorStop(1,'#151d2a');
    }
  }
  ctx.fillStyle=face; ctx.beginPath(); ctx.roundRect(31,27,1018,1386,34); ctx.fill();
  drawRecapExportMaterial(ctx,artwork,material);
  if (material.decoration.includes('frame')) {
    ctx.strokeStyle='#ffffff30'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.roundRect(46,42,988,1356,23); ctx.stroke();
  }
  ctx.restore();
}

function recapExportCard(canvas,artwork={},options={}) {
  const ctx=canvas.getContext('2d'),channelAccent=artwork.accent || '#e8c477';
  const appearance=resolveRecapAppearance(options.appearance,artwork);
  const accent=appearance.palette==='channel' ? channelAccent : recapMaterialPalette(channelAccent,appearance.palette)[1];
  ctx.save();
  if (!options.live) drawRecapExportStock(ctx,artwork,appearance);
  const ink=appearance.decoration.includes('lettering') ? recapExportInk(ctx,channelAccent,appearance) : accent;
  ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  ctx.font='700 23px sans-serif'; ctx.fillStyle=(appearance.engraving!=='none' || appearance.coating==='pearl') && appearance.decoration.includes('lettering') ? ink : '#c2ccda'; ctx.fillText(options.heading || '',82,94);
  if (options.drawBadge) options.drawBadge(ctx,998,94);
  else if (options.label) { ctx.textAlign='right'; ctx.fillStyle=accent; ctx.fillText(options.label,998,94,630); }
  ctx.strokeStyle='#ffffff30'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(82,122); ctx.lineTo(998,122); ctx.moveTo(82,1352); ctx.lineTo(998,1352); ctx.stroke();
  ctx.fillStyle=accent; ctx.fillRect(82,120,54,3);
  ctx.fillStyle=ink; ctx.textAlign='left'; ctx.font='600 21px sans-serif'; ctx.fillText(options.footer || '',82,1385,820);
  if (artwork.logo) ctx.drawImage(artwork.logo,942,1363,36,36);
  ctx.restore();
  return {ctx,accent,ink,left:82,width:916,top:158,bottom:1310};
}

export {recapExportMaterialColors, recapExportMaterialGradient, drawRecapExportMaterial, recapExportInk, drawRecapExportStock, recapExportCard};
// Stable names for consumers of the focused canvas entry point.
export {recapExportCard as createExportCard, drawRecapExportStock as drawExportStock,
  drawRecapExportMaterial as drawExportMaterial};
