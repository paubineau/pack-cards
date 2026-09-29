// Artwork defaults are bound to a mount's document, without touching the DOM on import.
export function createArtwork(config,labels,node) {
  const document=node?.ownerDocument || globalThis.document;
  const el=config.createElement || ((tag,text,className)=>{
    const element=document.createElement(tag);
    if (text!=null) element.textContent=text;
    if (className) element.className=className;
    return element;
  });
function defaultCardBack(channel,artwork) {
  const print=el('div',null,'recap-card-print');
  const seal=el('span',null,'recap-print-seal');
  const identity=artwork.avatar || artwork.logo;
  if (identity) { const logo=identity.cloneNode(); logo.alt=''; if (artwork.avatar) logo.className='recap-channel-logo'; seal.append(logo); }
  else seal.append(el('span','✦'));
  print.append(el('span',channel,'recap-print-channel'),seal,el('span',labels.backCaption,'recap-print-edition'));
  if (artwork.avatar && artwork.logo) { const credit=artwork.logo.cloneNode(); credit.alt=''; credit.className='recap-print-credit'; print.append(credit); }
  return print;
}

function defaultPackArtwork(r,channel,artwork,hideRecipient=false,title=labels.title,description='') {
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const accent=escape(artwork.accent || '#e8c477');
  // Keep text and lines vector until the renderer draws them at the pack's display size.
  const svg=['<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">',
    '<defs><linearGradient id="foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="768" y2="170">',
    ...[[0,'#172132'],[.13,'#425165'],[.2,'#182334'],[.52,'#101827'],[.8,'#344356'],[.87,'#79818b'],[1,'#1b2637']].map(([at,color])=>`<stop offset="${at}" stop-color="${color}"/>`),
    '</linearGradient><pattern id="grain" width="9" height="1" patternUnits="userSpaceOnUse"><path d="M0 0h1v1H0z" fill="#fff" fill-opacity=".0314"/><path d="M3 0h1v1H3zM6 0h1v1H6z" fill="#000" fill-opacity=".0431"/></pattern>',
    '<pattern id="crimp" width="8" height="42" patternUnits="userSpaceOnUse"><path d="M0 0h2v42H0z" fill="#c8d1da" fill-opacity=".251"/></pattern></defs>',
    '<path d="M0 0h768v1024H0z" fill="url(#foil)"/><path d="M0 0h768v1024H0z" fill="url(#grain)"/>',
    '<path d="M20 0h3v1024h-3zM741 0h4v1024h-4z" fill="#fff" fill-opacity=".0471"/>',
    '<path d="M0 0h768v42H0zM0 982h768v42H0z" fill="#060c16" fill-opacity=".502"/><path d="M0 0h768v42H0zM0 982h768v42H0z" fill="url(#crimp)"/>',
    '<rect x="34" y="263" width="700" height="690" fill="none" stroke="#fff" stroke-opacity=".2196"/>',
    `<path d="M34 263h700v5H34z" fill="${accent}"/>`];
  function text(value,y,size,color='#edf1f8',weight=700) {
    ctx.font=`${weight} ${size}px sans-serif`;
    const fit=ctx.measureText(value).width>650 ? ' textLength="650" lengthAdjust="spacingAndGlyphs"' : '';
    svg.push(`<text x="384" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${escape(color)}"${fit}>${escape(value)}</text>`);
  }
  function image(art,x,y,size,attributes='') {
    canvas.width=art.naturalWidth || size; canvas.height=art.naturalHeight || size;
    ctx.drawImage(art,0,0,canvas.width,canvas.height);
    svg.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="${escape(canvas.toDataURL('image/png'))}"${attributes}/>`);
  }
  text(title,162,36,'#dce1e9');
  text(r.label,388,34,'#dce1e9',600);
  if (description) {
    const words=description.trim().split(/\s+/);
    ctx.font='600 44px sans-serif';
    const wrap=width=>{
      const lines=[]; let line='';
      for (const word of words) {
        const next=line ? line+' '+word : word;
        if (line && ctx.measureText(next).width>width) { lines.push(line); line=word; }
        else line=next;
      }
      if (line) lines.push(line);
      return lines;
    };
    let lines=wrap(560);
    // Balance the short print without leaving a single word beneath two long lines.
    for (let width=540;width>=280;width-=20) {
      const balanced=wrap(width);
      if (balanced.length>lines.length) break;
      lines=balanced;
    }
    lines.forEach((value,index)=>text(value,614+(index-(lines.length-1)/2)*56,44,'#edf1f8',600));
  } else {
    svg.push(`<g transform="translate(384 600) rotate(45)" fill="none" stroke-width="2"><rect x="-92" y="-92" width="184" height="184" stroke="${accent}"/><rect x="-103" y="-103" width="206" height="206" stroke="#f8e4ad" stroke-opacity=".2588"/></g>`);
    if (artwork.avatar) {
      svg.push('<defs><clipPath id="channel-logo"><circle cx="384" cy="600" r="76"/></clipPath></defs>');
      image(artwork.avatar,308,524,152,' clip-path="url(#channel-logo)" preserveAspectRatio="xMidYMid slice"');
    } else if (artwork.logo) image(artwork.logo,318,534,132);
    else text('✦',629,80,artwork.accent || '#e8c477');
  }
  if (!channel && !hideRecipient) text(labels.recipient.replace('{recipient}',r.recipient || ''),849,34);
  if (artwork.avatar && artwork.logo) image(artwork.logo,638,865,64);
  svg.push('</svg>');
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.join(''));
}
  return {labels,el,recapCardBack:config.renderBack || defaultCardBack,recapPackArtwork:config.renderPackArtwork || defaultPackArtwork};
}
