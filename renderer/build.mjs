import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const rendererDirectory=dirname(fileURLToPath(import.meta.url));

// Both the standalone package and the app adapter use this guarded upstream adaptation.
export async function buildRenderer({
  dependencyDirectory=rendererDirectory,
  outfile=resolve(rendererDirectory,'../renderer.js'),
  licenseFile=resolve(rendererDirectory,'../THIRD_PARTY_LICENSES.txt')
}={}) {
const require=createRequire(resolve(dependencyDirectory,'package.json'));
const { build }=await import(pathToFileURL(require.resolve('esbuild')).href);
const nodeModules=resolve(dependencyDirectory,'node_modules');
// CSP-safe styles live in the package stylesheet; instructions sit below the art.
await build({
  entryPoints:[resolve(rendererDirectory,'entry.jsx')], bundle:true, minify:true, format:'esm', jsx:'automatic',
  nodePaths:[nodeModules],
  alias:{'cardpack-webgl/src/PackTearEffect.tsx':resolve(nodeModules,'cardpack-webgl/src/PackTearEffect.tsx')},
  target:['es2020'], define:{'process.env.NODE_ENV':'"production"'},
  outfile,
  legalComments:'eof',
  plugins:[{name:'pack-cards-presentation',setup(builder) {
    builder.onLoad({filter:/PackTearEffect\.tsx$/},async ({path}) => {
      const source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
      const tags=source.match(/<style>[\s\S]*?<\/style>/g) || [];
      if (tags.length!==3) throw new Error('Upstream style tags changed; review CSP adaptation.');
      const hint=/\/\*\* Floating affordance pill anchored on the tear line\. \*\/\r?\nfunction TearHint\b[\s\S]*?\r?\n}/g;
      if ((source.match(hint) || []).length!==1) throw new Error('Upstream hint changed; review instruction placement.');
      let contents=source.replace(hint,`function TearHint({ label }: { top: number; label: string; sliding?: boolean }) {
  return <p aria-hidden className="recap-pack-instruction">{label}</p>
}`).replace(/<style>[\s\S]*?<\/style>/g,'');
      // A short foil glint shows the swipe direction without flashing the whole seam.
      const hintUniform='uniform float uHint;';
      if (contents.split(hintUniform).length!==3) throw new Error('Upstream hint shaders changed; review the directional glint.');
      contents=contents.replaceAll(hintUniform,'uniform vec2 uHint;');
      const glint='(0.8 * exp(-pow(abs(vGrid.x - uHint.x) / 0.13, 2.0)) + 0.3 * exp(-pow(abs(vGrid.x - uHint.x + 0.1) / 0.22, 2.0))) * exp(-abs(artY - mix(uGeom.x, edgeY, 0.2)) * 110.0) * uHint.y';
      for (const [before,after] of [
        ['const REMAINDER_FS = `\nprecision mediump float;', 'const REMAINDER_FS = `\nprecision mediump float;\nuniform float uReveal;'],
        [`  // pulsing swipe-affordance glow on the nominal tear line — a STRAIGHT
  // guide (uGeom.x), independent of the wavy torn edge (uHint fades with drag)
  float glow = exp(-abs(artY - uGeom.x) * 60.0) * uHint;`,
          `  // A soft travelling catch follows the sealed edge only while idle.
  float glow = ${glint};`],
        [`  // lower half of the straight swipe-guide glow (strip carries the upper half)
  vec3 col = base.rgb + vec3(1.0, 0.84, 0.45) * (exp(-abs(artY - uGeom.x) * 60.0) * uHint);`,
          `  // Match the strip's catch across the complementary edge masks.
  vec3 col = base.rgb + vec3(1.0, 0.84, 0.45) * (${glint});`],
        ['col += vec3(0.18, 0.17, 0.15) * exp(-max(0.0, artY - edgeY) * 90.0);',
          'col += vec3(0.18, 0.17, 0.15) * exp(-max(0.0, artY - edgeY) * 90.0) * uReveal;'],
        [`        // Swipe-affordance glow: pulses while the tear is still grabbable,
        // fades out within the first ~17% of drag, gone once committed.
        const grabbable =
          phaseRef.current === 'idle' || phaseRef.current === 'grabbing' || phaseRef.current === 'springback'
        const hint = grabbable ? Math.max(0, 1 - progress * 6) * (0.55 + 0.45 * Math.sin(timeSec * 2.6)) : 0`,
          `        // Sweep for two seconds, with a quiet pause before the next invitation.
        const hintProgress = Math.max(0, Math.min(1, (timeSec % 4.8 - 0.8) / 2))
        const hintX = -0.08 + hintProgress * 1.16
        const hint = phaseRef.current === 'idle' ? Math.sin(hintProgress * Math.PI) * 0.6 : 0`],
        ['gl.uniform1f(loc.remainder.uHint, hint)', 'gl.uniform2f(loc.remainder.uHint, hintX, hint)'],
        ['gl.uniform1f(loc.strip.uHint, hint)', 'gl.uniform2f(loc.strip.uHint, hintX, hint)'],
        ["uHint: uni(remainderProg, 'uHint'),", "uHint: uni(remainderProg, 'uHint'),\n          uReveal: uni(remainderProg, 'uReveal'),"],
        ['gl.uniform1f(loc.remainder.uWhiteout, whiteout)', 'gl.uniform1f(loc.remainder.uWhiteout, whiteout)\n        gl.uniform1f(loc.remainder.uReveal, reveal)'],
        ['the ONLY thing animating is the swipe-hint pulse', 'the ONLY thing animating is the directional foil hint']
      ]) {
        if (contents.split(before).length!==2) throw new Error('Upstream tear hint changed; review the directional glint.');
        contents=contents.replace(before,after);
      }
      // Enlarge only the input surfaces; the physical tear stays at the top.
      for (const zone of ['height: Math.round(height * GRAB_ZONE_RATIO),','height: `${GRAB_ZONE_RATIO * 100}%`,']) {
        if (contents.split(zone).length!==2) throw new Error('Upstream grab zone changed; review whole-pack interaction.');
        contents=contents.replace(zone,"height: '100%',");
      }
      // Only the lower DOM print changes on hover; the tear texture and its effect stay mounted.
      for (const [before,after] of [
        ['  artSrc: string\n','  artSrc: string\n  bodyArtSrc?: string\n'],
        ['export function PackTearEffect({\n  artSrc,','export function PackTearEffect({\n  artSrc,\n  bodyArtSrc,'],
        ['      <img\n        src={artSrc}\n        alt=""\n        width={width}',
          '      <img\n        src={bodyArtSrc ?? artSrc}\n        alt=""\n        width={width}'],
        ['      <PackTearFallback\n        src={artSrc}',
          '      <PackTearFallback\n        src={bodyArtSrc ?? artSrc}']
      ]) {
        if (contents.split(before).length!==2) throw new Error('Upstream artwork structure changed; review body-only artwork updates.');
        contents=contents.replace(before,after);
      }
      const effectDependencies='}, [artSrc, interiorSrc, width, height, fallback, glowTier, intensity])';
      if (contents.split(effectDependencies).length!==2) throw new Error('Upstream tear effect changed; review body artwork isolation.');
      // Split only the rear lining from the native foreground. The real GL tear
      // still occludes the cards, including its jagged edge, curl and glow.
      const adaptLayers=(before,after) => {
        if (contents.split(before).length!==2) throw new Error('Upstream pack layers changed; review inside-pack composition.');
        contents=contents.replace(before,after);
      };
      adaptLayers("import { useEffect, useRef, useState } from 'react'", "import { useEffect, useRef, useState } from 'react'\nimport { createPortal } from 'react-dom'");
      adaptLayers('  bodyArtSrc?: string\n','  bodyArtSrc?: string\n  backLayer?: HTMLElement\n');
      adaptLayers('  bodyArtSrc,\n','  bodyArtSrc,\n  backLayer,\n');
      adaptLayers(effectDependencies,'}, [artSrc, interiorSrc, width, height, fallback, glowTier, intensity, backLayer])');
      adaptLayers('    let onVisibility: (() => void) | null = null',`    let liningCanvas: HTMLCanvasElement | null = null
    let liningCaptured = false
    let liningAttempted = false
    let onVisibility: (() => void) | null = null`);
      const interiorDraw=`        gl.useProgram(interiorProg)
        gl.uniform1f(loc.interior.uReveal, reveal)
        gl.uniform1f(loc.interior.uFrontier, progress)
        gl.uniform1f(loc.interior.uCurlShadow, fade)
        gl.uniform1f(loc.interior.uGlowAmt, glowAmt)
        gl.uniform1f(loc.interior.uWhiteout, whiteout)
        drawQuad(interiorProg)`;
      adaptLayers(interiorDraw,`        if (!liningCaptured) {
          const captureLining = backLayer && progress > 0 && !liningAttempted
          gl.useProgram(interiorProg)
          gl.uniform1f(loc.interior.uReveal, captureLining ? 1 : reveal)
          gl.uniform1f(loc.interior.uFrontier, progress)
          gl.uniform1f(loc.interior.uCurlShadow, captureLining ? 0 : fade)
          gl.uniform1f(loc.interior.uGlowAmt, glowAmt)
          gl.uniform1f(loc.interior.uWhiteout, whiteout)
          drawQuad(interiorProg)
          if (captureLining) {
            liningAttempted = true
            // Prepare the entire lining on the first peel; the foreground foil
            // reveals and re-covers the tucked cards, including spring-back.
            // Copy once while the GL buffer is valid, with no extra frame loop.
            try {
              liningCanvas = document.createElement('canvas')
              const scaleX = canvas.width / cssW
              const scaleY = canvas.height / cssH
              liningCanvas.width = Math.ceil(width * scaleX)
              liningCanvas.height = Math.ceil(stripH * scaleY)
              const lining = liningCanvas.getContext('2d')
              if (lining) {
                lining.drawImage(canvas, packX * scaleX, packY * scaleY, width * scaleX, stripH * scaleY,
                  0, 0, liningCanvas.width, liningCanvas.height)
                Object.assign(liningCanvas.style, { position: 'absolute', left: '0', top: '0',
                  width: width + 'px', height: stripH + 'px', pointerEvents: 'none' })
                backLayer.appendChild(liningCanvas)
                liningCaptured = true
              }
            } catch { /* Keep the original composed lining if copying is unavailable. */ }
          }
        }
        if (liningCaptured) gl.clear(gl.COLOR_BUFFER_BIT)`);
      adaptLayers('      disposed = true\n      canvas.removeEventListener', '      disposed = true\n      liningCanvas?.remove()\n      canvas.removeEventListener');
      const ghostBlock=contents.match(/      \{ghosts > 0 &&\n[\s\S]*?\n        \}\)\}/g) || [];
      if (ghostBlock.length!==1) throw new Error('Upstream ghost stack changed; review rear layer placement.');
      const ghostExpression=ghostBlock[0].trim().slice(1,-1);
      adaptLayers(ghostBlock[0],'      {backLayer ? createPortal(ghostStack, backLayer) : ghostStack}');
      const packRender="  return (\n    <div style={{ position: 'relative', isolation: 'isolate', width, height }}>";
      adaptLayers(packRender,`  const ghostStack = (${ghostExpression})\n\n${packRender}`);
      // Resume pack tilt only when a cancelled tear has fully settled.
      const adaptInteraction=(before,after) => {
        if (contents.split(before).length!==2) throw new Error('Upstream pack interaction changed; review tilt and spring-back.');
        contents=contents.replace(before,after);
      };
      adaptInteraction('  backLayer?: HTMLElement\n','  backLayer?: HTMLElement\n  onRest?: () => void\n');
      adaptInteraction('  backLayer,\n','  backLayer,\n  onRest,\n');
      adaptInteraction('  const onReadyRef = useRef(onReady)',`  const onRestRef = useRef(onRest)
  onRestRef.current = onRest
  const onReadyRef = useRef(onReady)`);
      const springback="              phaseRef.current = tearTransition(phaseRef.current, { type: 'springback-done' })";
      adaptInteraction(springback,`${springback}
              onRestRef.current?.()
              if (disposed) return`);
      // The shared caller keeps its decoded artwork visible until either renderer is ready.
      const fallbackRender='  if (fallback) {\n    return (';
      if (contents.split(fallbackRender).length!==2) throw new Error('Upstream fallback changed; review pack readiness.');
      contents=contents.replace(fallbackRender,`  useEffect(() => {
    if (fallback) onReadyRef.current?.()
  }, [fallback])

${fallbackRender}`);
      return {contents,loader:'tsx'};
    });
  }}]
});
const licenses=await Promise.all(['cardpack-webgl','react','react-dom','scheduler'].map(async name =>
  `${name}\n${await readFile(resolve(nodeModules,name,'LICENSE'),'utf8')}`));
await writeFile(licenseFile,licenses.join('\n\n'));
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await buildRenderer();
}
