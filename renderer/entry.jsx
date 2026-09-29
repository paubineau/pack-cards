import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PackTearEffect } from 'cardpack-webgl/src/PackTearEffect.tsx';

const DEFAULT_LABELS={open:'Open pack',swipe:'Swipe right to open',tap:'Tap to open'};

// React is confined to the temporary pack; the host application can use plain DOM.
export function mountPack(host,{artSrc,bodyArtSrc=artSrc,backLayer,width,height,glowTier='gold',packCount=1,labels={},onReady,onInteract,onRest,onTorn,onComplete}) {
  const root=createRoot(host);
  let active=true;
  const dispose=() => { if (!active) return; active=false; root.unmount(); };
  const render=() => {
    flushSync(() => root.render(<PackTearEffect artSrc={artSrc} bodyArtSrc={bodyArtSrc} backLayer={backLayer} width={width} height={height}
      glowTier={glowTier} packCount={packCount} keepBody hapticsEnabled={false}
      labels={{...DEFAULT_LABELS,...labels}}
      onReady={() => { if (active) onReady?.(); }}
      onInteract={() => { if (active) onInteract?.(); }}
      onRest={() => { if (active) onRest?.(); }}
      onTorn={() => { if (active) onTorn?.(); }}
      onComplete={() => { if (active) onComplete?.(); }} />));
  };
  dispose.setBodyArtwork=nextSrc => {
    if (!active || nextSrc===bodyArtSrc) return;
    bodyArtSrc=nextSrc; render();
  };
  try { render(); } catch (error) { dispose(); throw error; }
  return dispose;
}
