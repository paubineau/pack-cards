function De(t){let o=t>>>0;return function(){o=o+1831565813>>>0;let r=o;return r=Math.imul(r^r>>>15,r|1),r^=r+Math.imul(r^r>>>7,r|61),((r^r>>>14)>>>0)/4294967296}}function re(t){return t<0?0:t>1?1:t}function Ut(t){let o=1-re(t);return 1-o*o*o}function Nt(t){let o=re(t);return o<.5?2*o*o:1-(-2*o+2)**2/2}function Ir(t){let o=re(t);if(o<=.12)return o*.4;let r=.12*.4;return r+(o-.12)*((1-r)/(1-.12))}function Wt(t){let o=re(t),r=.12*.4;return o<=r?o/.4:.12+(o-r)*((1-.12)/(1-r))}function Yt(t,o,r){return r<=0?0:Ir((o-t)/(r*.85))}function Bt(t,o){let r=t.filter(s=>o-s.t<=120);if(r.length<2)return 0;let f=r[0],a=r[r.length-1];return a.t<=f.t?0:(a.p-f.p)/(a.t-f.t)*1e3}function Mr(t,o){return t>=.55||o>=1.6&&t>=.06?"tear":"springback"}var Dt=.1,Or=.55;function Ht(t){return re((t-Dt)/(Or-Dt))**1.4}var Dr={bronze:null,silver:{color:[.78,.8,.88],strength:.45},gold:{color:[1,.78,.35],strength:.75},platinum:{color:[.5,.86,1],strength:.9},diamond:{color:[.78,.55,1],strength:1}};function Vt(t){return Dr[t]}function Xt(t){let o=t()*360,r=.9,f=.62,a=(1-Math.abs(2*f-1))*r,s=a*(1-Math.abs(o/60%2-1)),b=f-a/2,[i,p,F]=o<60?[a,s,0]:o<120?[s,a,0]:o<180?[0,a,s]:o<240?[0,s,a]:o<300?[s,0,a]:[a,0,s];return[i+b,p+b,F+b]}function zt(t){return t<=1?1:Math.min(2,1+(t-1)/9)}function Kt(t){return Math.max(0,Math.min(4,Math.floor(t)-1))}function $t(t,o=256){let r=new Float32Array(o),f=(i,p)=>{let F=[];for(let L=0;L<=Math.ceil(o/i)+1;L++)F.push(t());for(let L=0;L<o;L++){let W=L/i,Y=Math.floor(W),I=W-Y;r[L]+=p*(F[Y]*(1-I)+F[Y+1]*I)}};f(12,1),f(3,.35);let a=1/0,s=-1/0;for(let i of r)i<a&&(a=i),i>s&&(s=i);let b=s-a||1;for(let i=0;i<o;i++)r[i]=(r[i]-a)/b;return r}function $(t,o){switch(o.type){case"grab":return t==="idle"||t==="springback"?"grabbing":t;case"release":return t!=="grabbing"?t:Mr(o.progress,o.velocity)==="tear"?"tearing":"springback";case"canned-tear":return t==="idle"||t==="springback"?"tearing":t;case"springback-done":return t==="springback"?"idle":t;case"tear-done":return t==="tearing"?"torn":t;case"flyoff-start":return t==="torn"?"flyoff":t;case"flyoff-done":return t==="flyoff"?"done":t}}function Ur(t){return t.saveData||typeof t.deviceMemory=="number"&&t.deviceMemory<=4||typeof t.hardwareConcurrency=="number"&&t.hardwareConcurrency<=2?"low":"normal"}var jt=new WeakMap;function qt(t){let o=jt.get(t);if(o)return o;let r=t,f=Ur({deviceMemory:r.deviceMemory,hardwareConcurrency:r.hardwareConcurrency,saveData:r.connection?.saveData});return jt.set(t,f),f}function Zt(t){return t==="low"?1.5:2}function Qt(t){return t!=="low"}function Jt(t){return t==="low"?20:30}var er=`
attribute vec2 aGrid;
uniform vec2 uCanvas;
uniform vec4 uPack;      // packX, packY, packW, packH (css px)
uniform float uStripH;   // strip band height px = (STRIP_RATIO+EDGE_AMP)*packH
uniform float uProgress; // 0..1 tear progress
uniform float uCurlR;    // curl radius px (tightens with progress)
// Flutter phase, pre-wrapped to [0, 2\u03C0) CPU-side. Deliberately NOT named
// uTime: the fragment stage declares uTime at mediump, and GLSL ES refuses
// to link a program whose stages share a uniform at different precisions
// (vertex default is highp) \u2014 ANGLE/Metal rejected exactly that.
uniform float uFlutterPhase;
uniform vec4 uFly;       // fly-off: dx, dy, rot(rad), unused
varying vec2 vGrid;
varying float vTheta;
void main(){
  // Tear travels LEFT \u2192 RIGHT: the frontier starts at the left edge and the
  // freed foil behind it (to its left) wraps around the moving roll.
  float frontierU = uProgress;
  float flatX = uPack.x + aGrid.x * uPack.z;
  float flatY = uPack.y + aGrid.y * uStripH;
  float frontierX = uPack.x + frontierU * uPack.z;
  float d = max(0.0, frontierU - aGrid.x) * uPack.z;
  float theta = d / uCurlR;
  // freed foil wraps around a vertical-axis cylinder at the frontier; the
  // (1-cos) term is depth toward the viewer, projected as upward lift.
  float x = d > 0.0 ? frontierX - sin(theta) * uCurlR : flatX;
  float lift = (1.0 - cos(theta)) * uCurlR;
  float freed = clamp(theta / 0.8, 0.0, 1.0);
  float y = flatY - lift * 0.55
          + sin(uFlutterPhase + aGrid.x * 14.0) * uPack.w * 0.012 * freed;
  // fly-off rigid transform about the finished roll (right edge, mid-strip)
  vec2 pivot = vec2(uPack.x + uPack.z, uPack.y + uStripH * 0.5);
  vec2 p = vec2(x, y) - pivot;
  float c = cos(uFly.z);
  float s = sin(uFly.z);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + pivot + uFly.xy;
  vGrid = aGrid;
  vTheta = theta;
  gl_Position = vec4(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0, 0.0, 1.0);
}`,tr=`
precision mediump float;
varying vec2 vGrid;
varying float vTheta;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform float uTime;
uniform vec4 uGeom;
uniform float uFade;
uniform vec2 uHint;
uniform float uWhiteout;
void main(){
  float artY = vGrid.y * (uGeom.x + uGeom.y);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  vec4 base = texture2D(uTex, uv);
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float a = base.a * (1.0 - smoothstep(-uGeom.w, uGeom.w, artY - edgeY));
  float sgn = sin(vTheta);
  float shade = 1.0 + 0.4 * max(0.0, sgn) - 0.3 * max(0.0, -sgn);
  float specBand = pow(max(0.0, cos(vTheta - 1.1)), 24.0);
  float sweep = fract(vGrid.x * 0.85 - uTime * 0.05);
  float sheen = pow(max(0.0, 1.0 - abs(sweep * 2.0 - 1.0) * 2.2), 10.0) * 0.4;
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vTheta * 0.45 + vGrid.x * 1.4) + vec3(0.0, 2.094, 4.188));
  // A soft travelling catch follows the sealed edge only while idle.
  float glow = (0.8 * exp(-pow(abs(vGrid.x - uHint.x) / 0.13, 2.0)) + 0.3 * exp(-pow(abs(vGrid.x - uHint.x + 0.1) / 0.22, 2.0))) * exp(-abs(artY - mix(uGeom.x, edgeY, 0.2)) * 110.0) * uHint.y;
  vec3 col = base.rgb * shade + irid * (specBand * 0.55 + sheen * 0.25) + vec3(1.0) * specBand * 0.18
           + vec3(1.0, 0.84, 0.45) * glow;
  // climax white-out: the flung strip burns to white before it fades, so the
  // detaching foil reads as a streak of light, not a dark scrap.
  col = mix(col, vec3(1.0), uWhiteout);
  float outA = a * uFade;
  gl_FragColor = vec4(col * outA, outA);
}`,Ue=`
attribute vec2 aGrid;
uniform vec2 uCanvas;
uniform vec4 uRect;      // x, y, w, h in css px
varying vec2 vGrid;
void main(){
  vGrid = aGrid;
  vec2 px = uRect.xy + aGrid * uRect.zw;
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);
}`,rr=`
precision mediump float;
uniform float uReveal;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform vec4 uGeom;
uniform vec2 uHint;
uniform float uWhiteout;
void main(){
  float y0 = uGeom.x - uGeom.y;
  float artY = y0 + vGrid.y * (uGeom.z - y0);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  vec4 base = texture2D(uTex, uv);
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float a = base.a * smoothstep(-uGeom.w, uGeom.w, artY - edgeY);
  // Match the strip's catch across the complementary edge masks.
  vec3 col = base.rgb + vec3(1.0, 0.84, 0.45) * ((0.8 * exp(-pow(abs(vGrid.x - uHint.x) / 0.13, 2.0)) + 0.3 * exp(-pow(abs(vGrid.x - uHint.x + 0.1) / 0.22, 2.0))) * exp(-abs(artY - mix(uGeom.x, edgeY, 0.2)) * 110.0) * uHint.y);
  // the torn front lip catches a soft light, lifting it off the interior
  col += vec3(0.18, 0.17, 0.15) * exp(-max(0.0, artY - edgeY) * 90.0) * uReveal;
  // climax white-out: the standing pack body blows out to white as the strip
  // flies, dissolving into the reveal veil (uWhiteout drives both layers).
  col = mix(col, vec3(1.0), uWhiteout);
  gl_FragColor = vec4(col * a, a);
}`,or=`
precision mediump float;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform sampler2D uInner;
uniform vec4 uGeom;
uniform float uReveal;
uniform float uFrontier;
uniform float uCurlShadow;
uniform vec3 uGlowColor;
uniform float uGlowAmt;
uniform float uWhiteout;
void main(){
  float artY = vGrid.y * (uGeom.x + uGeom.y);
  vec2 uv = vec2(vGrid.x, 1.0 - artY / uGeom.z);
  float packA = texture2D(uTex, uv).a;
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(vGrid.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float inside = 1.0 - smoothstep(-uGeom.w, uGeom.w, artY - edgeY);
  // The back wall's own torn lip: same tear character as the front (the
  // edge texture wraps \u2014 REPEAT \u2014 so this is a phase-shifted copy). Both
  // walls tore TOGETHER at the side seams, so the two paths share their
  // start/end points: the back path is pinned to the front path at x=0 and
  // x=1 and only diverges between them.
  float backRaw = uGeom.x - 0.06 + (texture2D(uEdge, vec2(vGrid.x + 0.37, 0.5)).r - 0.5) * 0.018;
  float pin = smoothstep(0.0, 0.16, vGrid.x) * smoothstep(1.0, 0.84, vGrid.x);
  float backEdge = mix(edgeY, backRaw, pin);
  float backMask = smoothstep(backEdge - uGeom.w * 2.0, backEdge + uGeom.w * 2.0, artY);
  vec3 lining = texture2D(uInner, vGrid).rgb;
  float depth = clamp(artY / uGeom.x, 0.0, 1.0);
  vec3 col = lining * mix(0.7, 1.05, depth);
  col *= mix(0.75, 1.0, sin(3.1416 * vGrid.x));
  // the prize inside lights the lining (shadows below still modulate it)
  col += uGlowColor * (uGlowAmt * 0.3);
  // the back wall's torn lip catches a faint matte sliver, not a gloss
  col += vec3(0.14, 0.135, 0.16) * exp(-max(0.0, artY - backEdge) * 140.0) * backMask;
  // front wall's torn edge casts a soft, wide shadow onto the recessed
  // lining \u2014 gentle gradient, not a hard stain
  col *= 1.0 - 0.5 * exp(-max(0.0, edgeY - artY) * 55.0);
  // the curl's contact shadow rides away with the strip (uCurlShadow = fade)
  col *= 1.0 - (0.5 * uCurlShadow) * exp(-abs(vGrid.x - uFrontier) * 12.0);
  // climax white-out: the opened interior floods white in lock-step with the
  // pack body so the whole thing burns out together before the reveal.
  col = mix(col, vec3(1.0), uWhiteout);
  float a = packA * backMask * inside * 0.96 * uReveal;
  gl_FragColor = vec4(col * a, a);
}`,nr=`
precision mediump float;
varying vec2 vGrid;
uniform sampler2D uTex;
uniform sampler2D uEdge;
uniform vec3 uGlowColor;
uniform float uGlowAmt;
uniform vec2 uGlowCenter;
uniform vec2 uGlowScale;
uniform vec2 uCanvasPx;
uniform vec4 uPack;
uniform vec4 uGeom;
void main(){
  vec2 d = (vGrid - uGlowCenter) * uGlowScale;
  d.y *= d.y > 0.0 ? 1.6 : 1.0;
  float fall = exp(-dot(d, d) * 2.2);
  vec2 px = vGrid * uCanvasPx;
  vec2 packUV = vec2((px.x - uPack.x) / uPack.z, (px.y - uPack.y) / uPack.w);
  vec2 puv = clamp(packUV, vec2(0.0), vec2(1.0, uGeom.z));
  float edgeY = uGeom.x + (texture2D(uEdge, vec2(puv.x, 0.5)).r * 2.0 - 1.0) * uGeom.y;
  float artA = texture2D(uTex, vec2(puv.x, 1.0 - puv.y / uGeom.z)).a;
  float inPack = step(0.0, packUV.x) * step(packUV.x, 1.0) * step(0.0, packUV.y) * step(packUV.y, uGeom.z);
  // Soft front-wall occlusion for the glow (wide, not a 1px edge) so the beam
  // fades out gradually below the tear line instead of a hard horizontal cut.
  float front = smoothstep(-0.06, 0.06, packUV.y - edgeY);
  float cover = inPack * front * artA;
  // Stacked V-beams from one apex DEEP inside the pack (~62% down): a
  // narrow bright core cone (slope 0.6) plus a wider, fainter halo cone
  // (slope 1.15 at 40%) \u2014 the layered god-ray look. Below the apex: nothing.
  float dyUp = 0.62 - packUV.y;
  float lat = abs(packUV.x - 0.5);
  float halfW = 0.6 * dyUp;
  float coneCore = dyUp > 0.0 ? 1.0 - smoothstep(halfW * 0.2, halfW * 1.1, lat) : 0.0;
  float halfW2 = 1.15 * dyUp;
  float coneHalo = dyUp > 0.0 ? 1.0 - smoothstep(halfW2 * 0.35, halfW2 * 1.0, lat) : 0.0;
  // Blend the core + halo into ONE soft falloff (no hard bright-core/faint-halo
  // step) so it reads as a single god-ray, not two stacked beams.
  float cone = clamp(coneCore * 0.75 + coneHalo * 0.5, 0.0, 1.0);
  // Inside the pack the aperture still pinches closed at the side seams
  // (same pin profile as the back lip); above the pack top the cone is free
  // to widen past the pack edges.
  float pin = smoothstep(0.0, 0.16, packUV.x) * smoothstep(1.0, 0.84, packUV.x);
  // Soft (not stepped) transition from the pinched in-pack aperture to the free,
  // wider beam above the pack top \u2014 a hard step here left a hard horizontal cut at
  // the pack edge, splitting the glow into two distinct bands.
  float pinned = mix(1.0, pin, smoothstep(-0.12, 0.06, packUV.y));
  // Canvas-edge vignette (vGrid spans the whole glow quad 0..1): the god-ray
  // must reach zero BEFORE any canvas edge or additive blending leaves a hard
  // rectangular seam \u2014 the "boxed / cut-off glow" dogfood bug. The upward beam
  // approaches the top edge (vGrid.y\u21920), so that side gets the widest feather.
  float vig = smoothstep(0.0, 0.18, vGrid.x) * smoothstep(1.0, 0.82, vGrid.x)
            * smoothstep(0.0, 0.30, vGrid.y) * smoothstep(1.0, 0.90, vGrid.y);
  float a = uGlowAmt * fall * cone * pinned * (1.0 - cover) * vig;
  gl_FragColor = vec4(uGlowColor * a * 0.55, a * 0.18);
}`,ar=`
attribute vec2 aPos;
attribute float aSize;
attribute vec4 aCol;
uniform vec2 uCanvas;
varying vec4 vCol;
void main(){
  vCol = aCol;
  gl_PointSize = aSize;
  gl_Position = vec4(aPos.x / uCanvas.x * 2.0 - 1.0, 1.0 - aPos.y / uCanvas.y * 2.0, 0.0, 1.0);
}`,ir=`
precision mediump float;
varying vec4 vCol;
void main(){
  vec2 pc = gl_PointCoord - vec2(0.5);
  float a = smoothstep(0.5, 0.1, length(pc)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;function sr(t,o,r,f){let s=t.createElement("canvas");s.width=Math.max(1,Math.round(r*2)),s.height=Math.max(1,Math.round(f*.3*2));let b=s.getContext("2d");return b&&b.drawImage(o,0,0,o.naturalWidth,o.naturalHeight*.3,0,0,s.width,s.height),s}function lr(t){let o=t.createElement("canvas");o.width=512,o.height=256;let r=o.getContext("2d");if(!r)return o;let f=De(42),a=r.createImageData(o.width,o.height);for(let s=0;s<o.height;s++){let b=f()*14;for(let i=0;i<o.width;i++){let p=(s*o.width+i)*4,F=55+b+24*Math.sin(i/55)+f()*5;a.data[p]=F,a.data[p+1]=F,a.data[p+2]=F+8,a.data[p+3]=255}}return r.putImageData(a,0,0),o}function ur(t,o){let r=t.createElement("canvas");r.width=o.length,r.height=1;let f=r.getContext("2d");if(!f)return r;let a=f.createImageData(o.length,1);for(let s=0;s<o.length;s++){let b=Math.round(o[s]*255);a.data[s*4]=b,a.data[s*4+1]=b,a.data[s*4+2]=b,a.data[s*4+3]=255}return f.putImageData(a,0,0),r}var cr=[[1,.85,.95],[.8,.95,1],[.95,1,.85],[1,.95,.75]];function mr(t,o,r,f=12){return Array.from({length:f},()=>({x:t+(r()-.5)*30,y:o+(r()-.5)*16,vx:60+r()*160,vy:-(120+r()*200),age:0,life:.4+r()*.5,size:3+r()*4,col:cr[Math.floor(r()*cr.length)]}))}var fr=[[1,.92,.62],[1,.82,.42],[1,.98,.86],[1,.7,.32]];function dr(t,o,r,f){return Array.from({length:f},()=>({x:t+(r()-.5)*16,y:o+(r()-.5)*10,vx:(r()-.5)*360,vy:-(120+r()*260),age:0,life:.22+r()*.38,size:2+r()*3,col:fr[Math.floor(r()*fr.length)]}))}var Xr={open:"Open pack",swipe:"Swipe right to open",tap:"Tap to open"},zr=.62,Kr=.82,ne=48,Te=8,We=()=>{};function $r(t,o){let r=!1,f=0,a=0,s=()=>{r||(r=!0,t.cancelAnimationFrame(f),t.clearTimeout(a),o())};f=t.requestAnimationFrame(s),a=t.setTimeout(s,100)}function uo(t,o){let r=t.ownerDocument,f=r.defaultView;if(!f)throw new TypeError("mountPack requires a document with a window.");let a=f,{artSrc:s,backLayer:b,width:i,height:p,glowTier:F="gold",packCount:L=1}=o,W=o.bodyArtSrc??s,Y={...Xr,...o.labels},I=a.performance,Ee=a.requestAnimationFrame.bind(a),at=a.cancelAnimationFrame.bind(a),it=zt(L),pr=Kt(L),Ye=Math.round(i*zr),Be=Math.round(p*Kr),hr=Math.round(p*.3),P=i+Ye*2,k=Be+hr,x=!0,de=!1,He=!1,pe=We,c="idle",w=0,A=null,ae=null,st=null,Ve=!1,lt=!1,he=!1,ye=new Set,ut=[],ct=[],q,ie=null,R,B,we;function se(n,e={}){let m=r.createElement(n);return Object.assign(m.style,e),m}let Z=se("div",{position:"relative",isolation:"isolate",width:`${i}px`,height:`${p}px`});function Ae(n){let e=se("img",{display:"block",width:`${i}px`,height:`${p}px`});return e.src=n,e.alt="",e.width=i,e.height=p,e.draggable=!1,e}function Q(n,e,m){n.addEventListener(e,m),ut.push(()=>n.removeEventListener(e,m))}function C(n){if(x){if(n==="onTorn"){if(Ve)return;Ve=!0}if(n==="onComplete"){if(lt)return;lt=!0}o[n]?.()}}function ft(n,e){let m=a.setTimeout(()=>{ye.delete(m),x&&e()},n);ye.add(m)}function mt(){if(A)try{R?.releasePointerCapture(A.pointerId)}catch{}A=null}function dt(){mt();for(let n of ut.splice(0))n();for(let n of ct.splice(0))n.remove();Z.replaceChildren()}function pt(n){B=se("p"),B.className="recap-pack-instruction",B.setAttribute("aria-hidden","true"),B.textContent=n,Z.append(B)}function ge(){!x||de||He||(He=!0,a.queueMicrotask(()=>{if(He=!1,!x||de)return;de=!0,he=Ve||["torn","flyoff","done"].includes(c);let n=pe;if(pe=We,n(),!x)return;dt(),q=Ae(W),Object.assign(q.style,{clipPath:`inset(${.22*100}% 0 0 0)`,position:"relative"}),ie=Ae(W),Object.assign(ie.style,{position:"absolute",left:"0",top:"0",clipPath:`inset(0 0 ${(1-.22)*100}% 0)`,transition:"opacity 240ms ease",opacity:he?"0":"1"});let e=se("button",{position:"absolute",left:"0",top:"0",width:"100%",height:"100%",background:"transparent",border:"none",cursor:"pointer"});e.type="button",e.setAttribute("aria-label",Y.open),R=e,Q(e,"click",()=>{!x||he||(he=!0,C("onInteract"),x&&(ie.style.opacity="0",B?.remove(),ft(60,()=>C("onTorn")),ft(360,()=>C("onComplete"))))}),Z.append(q,ie,e),he||pt(Y.tap),C("onReady")}))}function ht(n,e){ae={kind:"tearing",t0:I.now(),from:n,dur:e}}function gt(){!x||de||c!=="idle"&&c!=="springback"||(C("onInteract"),x&&(c=$(c,{type:"canned-tear"}),B.remove(),ht(w,600)))}function gr(n){if(!x||de||A||n.button!==0||c!=="idle"&&c!=="springback"||(C("onInteract"),!x))return;let e=c;c=$(c,{type:"grab"}),R.setPointerCapture(n.pointerId);let m=e==="springback"?Wt(w):0;A={startX:n.clientX-m*i*.85,samples:[{t:I.now(),p:w}],pointerId:n.pointerId},ae=null,B.remove()}function br(n){if(!(!x||c!=="grabbing"||!A||A.pointerId!==n.pointerId))for(w=Yt(A.startX,n.clientX,i),A.samples.push({t:I.now(),p:w});A.samples.length>24;)A.samples.shift()}function bt(n){if(!x||c!=="grabbing"||!A||A.pointerId!==n.pointerId)return;let e=I.now(),m=Bt(A.samples,e);c=$(c,{type:"release",progress:w,velocity:m}),mt(),c==="springback"?ae={kind:"springback",t0:e,from:w,dur:250}:c==="tearing"&&ht(w,Math.max(120,(1-w)*320))}function vr(){for(let n=0;n<pr;n++){let e=n+1,m=Ae(s);m.setAttribute("aria-hidden","true"),Object.assign(m.style,{position:"absolute",left:"0",top:"0",zIndex:"-1",transform:`translate(${e*7}px, ${e*9}px) rotate(${(n%2===0?1:-1)*(1.5+e)}deg) scale(${1-e*.015})`,filter:`brightness(${1-e*.12})`,opacity:String(1-e*.08)}),(b??Z).append(m),ct.push(m)}q=Ae(W),q.style.clipPath=`inset(${.3*100-.3}% 0 0 0)`,we=se("div",{position:"absolute",left:`${-Ye}px`,top:`${-Be}px`,width:`${P}px`,height:`${k}px`,pointerEvents:"none"}),we.setAttribute("aria-hidden","true"),R=se("div",{position:"absolute",left:"0",top:"0",width:"100%",height:"100%",touchAction:"none",cursor:"grab"}),R.setAttribute("role","button"),R.tabIndex=0,R.setAttribute("aria-label",Y.open),Q(R,"pointerdown",gr),Q(R,"pointermove",br),Q(R,"pointerup",bt),Q(R,"pointercancel",bt),Q(R,"keydown",(n=>{n.key!=="Enter"&&n.key!==" "||(n.preventDefault(),gt())})),Q(R,"click",(n=>{n.detail!==0||n.target!==n.currentTarget||"pointerType"in n&&n.pointerType||gt()})),Z.append(q,we,R),pt(Y.swipe),t.replaceChildren(Z)}function xr(){let n=r.createElement("canvas");n.style.width="100%",n.style.height="100%",n.style.display="block",we.appendChild(n);let e=null;try{e=n.getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!0})}catch{}if(!e){console.warn("[pack-cards] webgl context creation failed \u2014 using DOM fallback"),n.remove(),ge();return}let m=!1,le=0,Re=r.hidden,vt=!1,Ge=!1,xt=[],Tt=[],Et=[],be=[],yt=_=>{_.preventDefault(),m||ge()};n.addEventListener("webglcontextlost",yt);let ze=qt(a.navigator),Tr=Qt(ze),Er=1e3/Jt(ze),Ke=Math.min(a.devicePixelRatio||1,Zt(ze));n.width=Math.round(P*Ke),n.height=Math.round(k*Ke);let H=Ye,V=Be,ue=(.22+.016)*p,yr=1/p,D=null,$e=!1,wt=!1,_e=null;function wr(_){if(!e)return;let At=(l,h)=>{let d=e.createShader(l);if(!d)throw new Error("createShader");if(xt.push(d),e.shaderSource(d,h),e.compileShader(d),!e.getShaderParameter(d,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(d)??"shader compile");return d},xe=(l,h)=>{let d=e.createProgram();if(!d)throw new Error("createProgram");if(Tt.push(d),e.attachShader(d,At(e.VERTEX_SHADER,l)),e.attachShader(d,At(e.FRAGMENT_SHADER,h)),e.linkProgram(d),!e.getProgramParameter(d,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(d)??"program link");return d},je=(l,h)=>{let d=e.createTexture();if(!d)throw new Error("createTexture");return Et.push(d),e.bindTexture(e.TEXTURE_2D,d),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!0),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,l),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,h),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,h),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),d},T,S,E,J,G;try{T=xe(er,tr),S=xe(Ue,rr),E=xe(Ue,or),J=xe(ar,ir),G=xe(Ue,nr)}catch(l){console.warn("[pack-cards] shader compile/link failed \u2014 using DOM fallback:",l),n.remove(),ge();return}let Rt=De(Math.floor(Math.random()*2**31)),Ar=$t(Rt),Gt=F==="random"?{color:Xt(Rt),strength:1}:Vt(F),ce=Gt?.color??[0,0,0],Rr=Math.min(1,(Gt?.strength??0)*it),Gr=je(sr(r,_,i,p),e.CLAMP_TO_EDGE),_r=je(ur(r,Ar),e.REPEAT),Fr=je(lr(r),e.CLAMP_TO_EDGE),qe=new Float32Array((ne+1)*(Te+1)*2),_t=0;for(let l=0;l<=Te;l++)for(let h=0;h<=ne;h++)qe[_t++]=h/ne,qe[_t++]=l/Te;let X=new Uint16Array(ne*Te*6),fe=0;for(let l=0;l<Te;l++)for(let h=0;h<ne;h++){let d=l*(ne+1)+h,M=d+1,me=d+(ne+1),Me=me+1;X[fe++]=d,X[fe++]=M,X[fe++]=me,X[fe++]=M,X[fe++]=Me,X[fe++]=me}let Fe=e.createBuffer();if(!Fe)throw new Error("createBuffer");be.push(Fe),e.bindBuffer(e.ARRAY_BUFFER,Fe),e.bufferData(e.ARRAY_BUFFER,qe,e.STATIC_DRAW);let Pe=e.createBuffer();if(!Pe)throw new Error("createBuffer");be.push(Pe),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,Pe),e.bufferData(e.ELEMENT_ARRAY_BUFFER,X,e.STATIC_DRAW);let ke=e.createBuffer();if(!ke)throw new Error("createBuffer");be.push(ke),e.bindBuffer(e.ARRAY_BUFFER,ke),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,0,1,1,0,1]),e.STATIC_DRAW);let Ze=e.createBuffer();if(!Ze)throw new Error("createBuffer");be.push(Ze);let z=new Float32Array(672),y=[],Qe=0,Se=0,Pr=70,Ce=[.22,.016,.3,yr],Le=l=>{e.useProgram(l),e.uniform1i(e.getUniformLocation(l,"uTex"),0),e.uniform1i(e.getUniformLocation(l,"uEdge"),1),e.uniform4f(e.getUniformLocation(l,"uGeom"),Ce[0],Ce[1],Ce[2],Ce[3])};Le(T),Le(S),Le(E),e.useProgram(T),e.uniform2f(e.getUniformLocation(T,"uCanvas"),P,k),e.uniform4f(e.getUniformLocation(T,"uPack"),H,V,i,p),e.uniform1f(e.getUniformLocation(T,"uStripH"),ue),e.useProgram(S),e.uniform2f(e.getUniformLocation(S,"uCanvas"),P,k),e.uniform4f(e.getUniformLocation(S,"uRect"),H,V+(.22-.016)*p,i,(.3-.22+.016)*p),e.useProgram(E),e.uniform2f(e.getUniformLocation(E,"uCanvas"),P,k),e.uniform4f(e.getUniformLocation(E,"uRect"),H,V,i,ue),e.uniform1i(e.getUniformLocation(E,"uInner"),2),e.uniform3f(e.getUniformLocation(E,"uGlowColor"),ce[0],ce[1],ce[2]),e.useProgram(J),e.uniform2f(e.getUniformLocation(J,"uCanvas"),P,k),Le(G),e.uniform2f(e.getUniformLocation(G,"uCanvas"),P,k),e.uniform4f(e.getUniformLocation(G,"uRect"),0,0,P,k),e.uniform2f(e.getUniformLocation(G,"uCanvasPx"),P,k),e.uniform4f(e.getUniformLocation(G,"uPack"),H,V,i,p),e.uniform3f(e.getUniformLocation(G,"uGlowColor"),ce[0],ce[1],ce[2]),e.uniform2f(e.getUniformLocation(G,"uGlowCenter"),(H+i/2)/P,(V+.22*p*.8)/k);let Ft=i*.9;e.uniform2f(e.getUniformLocation(G,"uGlowScale"),P/Ft,k/Ft);let v=(l,h)=>e.getUniformLocation(l,h),g={interior:{uReveal:v(E,"uReveal"),uFrontier:v(E,"uFrontier"),uCurlShadow:v(E,"uCurlShadow"),uGlowAmt:v(E,"uGlowAmt"),uWhiteout:v(E,"uWhiteout")},remainder:{uHint:v(S,"uHint"),uReveal:v(S,"uReveal"),uWhiteout:v(S,"uWhiteout")},glow:{uGlowAmt:v(G,"uGlowAmt")},strip:{uProgress:v(T,"uProgress"),uCurlR:v(T,"uCurlR"),uTime:v(T,"uTime"),uFlutterPhase:v(T,"uFlutterPhase"),uHint:v(T,"uHint"),uFly:v(T,"uFly"),uFade:v(T,"uFade"),uWhiteout:v(T,"uWhiteout"),aGrid:e.getAttribLocation(T,"aGrid")},fleck:{aPos:e.getAttribLocation(J,"aPos"),aSize:e.getAttribLocation(J,"aSize"),aCol:e.getAttribLocation(J,"aCol")}},kr=new Map([[E,e.getAttribLocation(E,"aGrid")],[S,e.getAttribLocation(S,"aGrid")],[G,e.getAttribLocation(G,"aGrid")]]),Je=l=>{e.useProgram(l),e.bindBuffer(e.ARRAY_BUFFER,ke);let h=kr.get(l)??e.getAttribLocation(l,"aGrid");e.enableVertexAttribArray(h),e.vertexAttribPointer(h,2,e.FLOAT,!1,8,0),e.drawArrays(e.TRIANGLES,0,6),e.disableVertexAttribArray(h)},Sr=I.now(),et=I.now(),Pt=0,kt=!1,Ie=l=>{if(m||e.isContextLost())return;if(c==="idle"&&y.length===0&&l-Pt<Er){le=Ee(Ie);return}Pt=l;let h=Math.min(.05,(l-et)/1e3);et=l;let d=(l-Sr)/1e3%360,M=ae;if(M){let u=(l-M.t0)/M.dur;if(M.kind==="springback"){if(w=M.from*(1-Ut(u)),u>=1&&(w=0,ae=null,c=$(c,{type:"springback-done"}),C("onRest"),m))return}else if(w=M.from+(1-M.from)*Nt(u),u>=1&&(w=1,ae=null,c=$(c,{type:"tear-done"}),c==="torn"&&(y=mr(H+i*.9,V+ue*.5,Math.random,Math.round(12*it)),st={t0:l},vt=!0,c=$(c,{type:"flyoff-start"}),C("onTorn"),m)))return}let me=0,Me=0,St=0,Oe=1,tt=0,Ct=st;if(Ct&&c!=="done"){let u=Math.min(1,(l-Ct.t0)/1500);if(me=i*(.4*u+1.1*u*u),Me=-p*.5*u+p*.65*u*u,St=.5*u,Oe=1-re((u-.5)/.45),u>=1&&(c=$(c,{type:"flyoff-done"}),!Ge&&c==="done"&&(Ge=!0,C("onComplete"),m)))return}else c==="done"&&(Oe=0);let O=w,Cr=Math.max(24,(.3-.18*O)*i),Lt=Math.min(1,O*4);if((c==="grabbing"||c==="tearing")&&O>Qe){Se+=(O-Qe)*Pr;let u=Math.min(8,Math.floor(Se));if(u>0){Se-=Math.floor(Se);let U=H+O*i,N=V+.22*p;y.push(...dr(U,N,Math.random,u)),y.length>96&&(y=y.slice(y.length-96))}}Qe=O,y=y.filter(u=>(u.age+=h,u.age>=u.life?!1:(u.x+=u.vx*h,u.y+=u.vy*h,u.vy+=700*h,!0)));let It=Math.max(0,Math.min(1,(d%4.8-.8)/2)),Mt=-.08+It*1.16,Ot=c==="idle"?Math.sin(It*Math.PI)*.6:0,rt=Ht(O)*Rr;if(e.viewport(0,0,n.width,n.height),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,Gr),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,_r),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,Fr),!$e){let u=b&&O>0&&!wt;if(e.useProgram(E),e.uniform1f(g.interior.uReveal,u?1:Lt),e.uniform1f(g.interior.uFrontier,O),e.uniform1f(g.interior.uCurlShadow,u?0:Oe),e.uniform1f(g.interior.uGlowAmt,rt),e.uniform1f(g.interior.uWhiteout,tt),Je(E),u){wt=!0;try{D=r.createElement("canvas");let U=n.width/P,N=n.height/k;D.width=Math.ceil(i*U),D.height=Math.ceil(ue*N);let ee=D.getContext("2d");ee&&(ee.drawImage(n,H*U,V*N,i*U,ue*N,0,0,D.width,D.height),Object.assign(D.style,{position:"absolute",left:"0",top:"0",width:i+"px",height:ue+"px",pointerEvents:"none"}),b.appendChild(D),$e=!0)}catch{}}}$e&&e.clear(e.COLOR_BUFFER_BIT),e.useProgram(S),e.uniform2f(g.remainder.uHint,Mt,Ot),e.uniform1f(g.remainder.uWhiteout,tt),e.uniform1f(g.remainder.uReveal,Lt),Je(S),Tr&&rt>0&&(e.useProgram(G),e.uniform1f(g.glow.uGlowAmt,rt),e.blendFunc(e.ONE,e.ONE),Je(G),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA)),e.useProgram(T),e.uniform1f(g.strip.uProgress,O),e.uniform1f(g.strip.uCurlR,Cr),e.uniform1f(g.strip.uTime,d),e.uniform1f(g.strip.uFlutterPhase,d*7%(Math.PI*2)),e.uniform2f(g.strip.uHint,Mt,Ot),e.uniform4f(g.strip.uFly,me,Me,St,0),e.uniform1f(g.strip.uFade,Oe),e.uniform1f(g.strip.uWhiteout,tt),e.bindBuffer(e.ARRAY_BUFFER,Fe),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,Pe);let ot=g.strip.aGrid;if(e.enableVertexAttribArray(ot),e.vertexAttribPointer(ot,2,e.FLOAT,!1,8,0),e.drawElements(e.TRIANGLES,X.length,e.UNSIGNED_SHORT,0),e.disableVertexAttribArray(ot),y.length){for(let ee=0;ee<y.length;ee++){let K=y[ee],Lr=K.age/K.life,te=ee*7;z[te]=K.x,z[te+1]=K.y,z[te+2]=K.size*Ke,z[te+3]=K.col[0],z[te+4]=K.col[1],z[te+5]=K.col[2],z[te+6]=1-Lr}e.useProgram(J),e.bindBuffer(e.ARRAY_BUFFER,Ze),e.bufferData(e.ARRAY_BUFFER,z.subarray(0,y.length*7),e.DYNAMIC_DRAW);let u=g.fleck.aPos,U=g.fleck.aSize,N=g.fleck.aCol;e.enableVertexAttribArray(u),e.vertexAttribPointer(u,2,e.FLOAT,!1,28,0),e.enableVertexAttribArray(U),e.vertexAttribPointer(U,1,e.FLOAT,!1,28,8),e.enableVertexAttribArray(N),e.vertexAttribPointer(N,4,e.FLOAT,!1,28,12),e.blendFunc(e.ONE,e.ONE),e.drawArrays(e.POINTS,0,y.length),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.disableVertexAttribArray(u),e.disableVertexAttribArray(U),e.disableVertexAttribArray(N)}e.disable(e.BLEND),!(!kt&&(kt=!0,C("onReady"),m))&&(c==="done"&&y.length===0||Re||(le=Ee(Ie)))};Re||(le=Ee(Ie)),_e=()=>{Re=r.hidden,Re?at(le):m||(et=I.now(),le=Ee(Ie))},r.addEventListener("visibilitychange",_e)}let ve=r.createElement("img");return ve.crossOrigin="anonymous",ve.src=s,ve.decode().then(()=>{m||wr(ve)}).catch(_=>{m||(console.warn("[pack-cards] artwork or renderer initialization failed; using DOM fallback:",_),n.remove(),ge())}),()=>{m||(m=!0,ve.removeAttribute("src"),D?.remove(),n.removeEventListener("webglcontextlost",yt),at(le),_e&&r.removeEventListener("visibilitychange",_e),vt&&!Ge&&(Ge=!0,C("onComplete")),n.remove(),$r(a,()=>{for(let _ of be)e.deleteBuffer(_);for(let _ of Et)e.deleteTexture(_);for(let _ of Tt)e.deleteProgram(_);for(let _ of xt)e.deleteShader(_);e.getExtension("WEBGL_lose_context")?.loseContext()}))}}let Xe=(()=>{if(x){x=!1;for(let n of ye)a.clearTimeout(n);ye.clear(),pe(),pe=We,dt(),Z.remove()}});Xe.setBodyArtwork=n=>{!x||n===W||(W=n,q.src=n,ie&&(ie.src=n))};try{vr(),a.matchMedia?.("(prefers-reduced-motion: reduce)").matches?ge():pe=xr()??We}catch(n){throw Xe(),n}return Xe}export{uo as mountPack};
