/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
import type { RendererOptions, RendererDisposer } from '../renderer.js'
import { mulberry32 } from './random.js'
import {
  CANNED_TEAR_MS, DOM_CLIP_RATIO, EDGE_AMP, FLYOFF_MS, SPRINGBACK_MS,
  STRIP_RATIO, TEAR_SNAP_MS, TRAVEL_RATIO, bakeTearEdge, clamp01,
  dragProgress, easeInOutQuad, easeOutCubic, glowColor, glowRamp,
  resistanceInverse, tearIntensityForCount, ghostStackForCount, tearTransition,
  tierGlow, velocityFrom, type PointerSample, type TearPhase,
} from './physics.js'
import { getDeviceTier, maxDprForTier, glowEnabledForTier, idleFpsForTier } from './device.js'
import { STRIP_VS, STRIP_FS, FLAT_VS, REMAINDER_FS, INTERIOR_FS, FLECK_VS, FLECK_FS, GLOW_FS } from './shaders.js'
import { bakeStripTexture, bakeInnerFallback, edgeToCanvas } from './textures.js'
import { FLECK_COUNT, MAX_FLECKS, spawnFlecks, spawnSparks, type Fleck } from './particles.js'

const DEFAULT_LABELS = { open: 'Open pack', swipe: 'Swipe right to open', tap: 'Tap to open' }
const PAD_X_RATIO = 0.62
const PAD_TOP_RATIO = 0.82
const MESH_COLS = 48
const MESH_ROWS = 8
const noop = () => {}
type Callback = 'onReady' | 'onInteract' | 'onRest' | 'onTorn' | 'onComplete'

// Let a removed canvas leave the compositor before invalidating its GPU storage.
// The timer also releases resources when a hidden document suspends frame delivery.
function releaseAfterRemoval(window: Window, release: () => void) {
  let released = false
  let frame = 0
  let timer = 0
  const finish = () => {
    if (released) return
    released = true
    window.cancelAnimationFrame(frame)
    window.clearTimeout(timer)
    release()
  }
  frame = window.requestAnimationFrame(finish)
  timer = window.setTimeout(finish, 100)
}

/** Imperative pack renderer. Its visual state is independent of any UI framework. */
export function mountPack(host: HTMLElement, options: RendererOptions): RendererDisposer {
  const document = host.ownerDocument
  const view = document.defaultView
  if (!view) throw new TypeError('mountPack requires a document with a window.')
  const window = view
  const { artSrc, backLayer, width, height, glowTier = 'gold', packCount = 1 } = options
  let bodyArtSrc = options.bodyArtSrc ?? artSrc
  const text = { ...DEFAULT_LABELS, ...options.labels }
  const performance = window.performance
  const requestAnimationFrame = window.requestAnimationFrame.bind(window)
  const cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  const intensity = tearIntensityForCount(packCount)
  const ghosts = ghostStackForCount(packCount)
  const padX = Math.round(width * PAD_X_RATIO)
  const padTop = Math.round(height * PAD_TOP_RATIO)
  const glH = Math.round(height * DOM_CLIP_RATIO)
  const cssW = width + padX * 2
  const cssH = padTop + glH
  let active = true
  let fallback = false
  let fallbackQueued = false
  let stopWebGL: () => void = noop
  let phase: TearPhase = 'idle'
  let tearProgress = 0
  let grab: { startX: number; samples: PointerSample[]; pointerId: number } | null = null
  let animationState: { kind: 'springback' | 'tearing'; t0: number; from: number; dur: number } | null = null
  let flyState: { t0: number } | null = null
  let tornFired = false
  let completeFired = false
  let fallbackOpened = false
  const timers = new Set<number>()
  const listeners: (() => void)[] = []
  const rearImages: HTMLImageElement[] = []
  let body: HTMLImageElement
  let strip: HTMLImageElement | null = null
  let control: HTMLElement
  let hint: HTMLParagraphElement
  let glHost: HTMLDivElement

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration> = {}): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    Object.assign(node.style, style)
    return node
  }
  const root = element('div', { position: 'relative', isolation: 'isolate', width: `${width}px`, height: `${height}px` })
  function artwork(src: string) {
    const image = element('img', { display: 'block', width: `${width}px`, height: `${height}px` })
    image.src = src
    image.alt = ''
    image.width = width
    image.height = height
    image.draggable = false
    return image
  }
  function listen(node: HTMLElement, type: string, listener: EventListener) {
    node.addEventListener(type, listener)
    listeners.push(() => node.removeEventListener(type, listener))
  }
  function notify(name: Callback) {
    if (!active) return
    if (name === 'onTorn') {
      if (tornFired) return
      tornFired = true
    }
    if (name === 'onComplete') {
      if (completeFired) return
      completeFired = true
    }
    options[name]?.()
  }
  function after(delay: number, callback: () => void) {
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      if (active) callback()
    }, delay)
    timers.add(timer)
  }
  function releasePointer() {
    if (grab) {
      try { control?.releasePointerCapture(grab.pointerId) } catch { /* Capture may already be released. */ }
    }
    grab = null
  }
  function clearSurface() {
    releasePointer()
    for (const remove of listeners.splice(0)) remove()
    for (const image of rearImages.splice(0)) image.remove()
    root.replaceChildren()
  }
  function instruction(label: string) {
    hint = element('p')
    hint.className = 'recap-pack-instruction'
    hint.setAttribute('aria-hidden', 'true')
    hint.textContent = label
    root.append(hint)
  }
  function queueFallback() {
    if (!active || fallback || fallbackQueued) return
    fallbackQueued = true
    window.queueMicrotask(() => {
      fallbackQueued = false
      if (!active || fallback) return
      fallback = true
      fallbackOpened = tornFired || ['torn', 'flyoff', 'done'].includes(phase)
      const cleanup = stopWebGL
      stopWebGL = noop
      cleanup()
      if (!active) return
      clearSurface()
      body = artwork(bodyArtSrc)
      Object.assign(body.style, { clipPath: `inset(${STRIP_RATIO * 100}% 0 0 0)`, position: 'relative' })
      strip = artwork(bodyArtSrc)
      Object.assign(strip.style, {
        position: 'absolute', left: '0', top: '0',
        clipPath: `inset(0 0 ${(1 - STRIP_RATIO) * 100}% 0)`,
        transition: 'opacity 240ms ease', opacity: fallbackOpened ? '0' : '1',
      })
      const button = element('button', { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer' })
      button.type = 'button'
      button.setAttribute('aria-label', text.open)
      control = button
      listen(button, 'click', () => {
        if (!active || fallbackOpened) return
        fallbackOpened = true
        notify('onInteract')
        if (!active) return
        strip!.style.opacity = '0'
        hint?.remove()
        after(60, () => notify('onTorn'))
        after(360, () => notify('onComplete'))
      })
      root.append(body, strip, button)
      if (!fallbackOpened) instruction(text.tap)
      notify('onReady')
    })
  }
  function beginTearing(from: number, dur: number) {
    animationState = { kind: 'tearing', t0: performance.now(), from, dur }
  }
  function cannedTear() {
    if (!active || fallback || (phase !== 'idle' && phase !== 'springback')) return
    notify('onInteract')
    if (!active) return
    phase = tearTransition(phase, { type: 'canned-tear' })
    hint.remove()
    beginTearing(tearProgress, CANNED_TEAR_MS)
  }
  function onPointerDown(event: PointerEvent) {
    if (!active || fallback || grab || event.button !== 0 || (phase !== 'idle' && phase !== 'springback')) return
    notify('onInteract')
    if (!active) return
    const before = phase
    phase = tearTransition(phase, { type: 'grab' })
    control.setPointerCapture(event.pointerId)
    const baseRaw = before === 'springback' ? resistanceInverse(tearProgress) : 0
    grab = {
      startX: event.clientX - baseRaw * width * TRAVEL_RATIO,
      samples: [{ t: performance.now(), p: tearProgress }], pointerId: event.pointerId,
    }
    animationState = null
    hint.remove()
  }
  function onPointerMove(event: PointerEvent) {
    if (!active || phase !== 'grabbing' || !grab || grab.pointerId !== event.pointerId) return
    tearProgress = dragProgress(grab.startX, event.clientX, width)
    grab.samples.push({ t: performance.now(), p: tearProgress })
    while (grab.samples.length > 24) grab.samples.shift()
  }
  function onPointerUp(event: PointerEvent) {
    if (!active || phase !== 'grabbing' || !grab || grab.pointerId !== event.pointerId) return
    const now = performance.now()
    const velocity = velocityFrom(grab.samples, now)
    phase = tearTransition(phase, { type: 'release', progress: tearProgress, velocity })
    releasePointer()
    if (phase === 'springback') animationState = { kind: 'springback', t0: now, from: tearProgress, dur: SPRINGBACK_MS }
    else if (phase === 'tearing') beginTearing(tearProgress, Math.max(120, (1 - tearProgress) * TEAR_SNAP_MS))
  }
  function renderSurface() {
    for (let i = 0; i < ghosts; i++) {
      const depth = i + 1
      const image = artwork(artSrc)
      image.setAttribute('aria-hidden', 'true')
      Object.assign(image.style, {
        position: 'absolute', left: '0', top: '0', zIndex: '-1',
        transform: `translate(${depth * 7}px, ${depth * 9}px) rotate(${(i % 2 === 0 ? 1 : -1) * (1.5 + depth)}deg) scale(${1 - depth * 0.015})`,
        filter: `brightness(${1 - depth * 0.12})`, opacity: String(1 - depth * 0.08),
      })
      ;(backLayer ?? root).append(image)
      rearImages.push(image)
    }
    body = artwork(bodyArtSrc)
    body.style.clipPath = `inset(${DOM_CLIP_RATIO * 100 - 0.3}% 0 0 0)`
    glHost = element('div', { position: 'absolute', left: `${-padX}px`, top: `${-padTop}px`, width: `${cssW}px`, height: `${cssH}px`, pointerEvents: 'none' })
    glHost.setAttribute('aria-hidden', 'true')
    control = element('div', { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' })
    control.setAttribute('role', 'button')
    control.tabIndex = 0
    control.setAttribute('aria-label', text.open)
    listen(control, 'pointerdown', onPointerDown as EventListener)
    listen(control, 'pointermove', onPointerMove as EventListener)
    listen(control, 'pointerup', onPointerUp as EventListener)
    listen(control, 'pointercancel', onPointerUp as EventListener)
    listen(control, 'keydown', ((event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      cannedTear()
    }) as EventListener)
    listen(control, 'click', ((event: MouseEvent) => {
      if (event.detail !== 0 || event.target !== event.currentTarget || ('pointerType' in event && event.pointerType)) return
      cannedTear()
    }) as EventListener)
    root.append(body, glHost, control)
    instruction(text.swipe)
    host.replaceChildren(root)
  }

  function startWebGL() {
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    glHost.appendChild(canvas)
    let gl: WebGLRenderingContext | null = null
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
    } catch { /* Context creation can throw on restricted devices. */ }
    if (!gl) {
      console.warn('[pack-cards] webgl context creation failed — using DOM fallback')
      canvas.remove()
      queueFallback()
      return
    }

    let disposed = false
    let raf = 0
    let hidden = document.hidden
    let flyStarted = false
    let completeFiredEver = false
    const shaders: WebGLShader[] = []
    const programs: WebGLProgram[] = []
    const textures: WebGLTexture[] = []
    const buffers: WebGLBuffer[] = []
    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (!disposed) queueFallback()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)

    // Adaptive quality: low-power devices render a smaller framebuffer, skip the
    // additive god-ray glow pass, and idle at a lower redraw rate. Resolved once
    // per mount — the tier never changes within a session.
    const tier = getDeviceTier(window.navigator)
    const renderGlow = glowEnabledForTier(tier)
    const idleInterval = 1000 / idleFpsForTier(tier)
    const dpr = Math.min(window.devicePixelRatio || 1, maxDprForTier(tier))
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)

    const packX = padX
    const packY = padTop
    const stripH = (STRIP_RATIO + EDGE_AMP) * height
    const aa = 1.0 / height

    let liningCanvas: HTMLCanvasElement | null = null
    let liningCaptured = false
    let liningAttempted = false
    let onVisibility: (() => void) | null = null

    function start(img: HTMLImageElement) {
      if (!gl) return
      const sh = (type: number, source: string) => {
        const s = gl.createShader(type)
        if (!s) throw new Error('createShader')
        shaders.push(s)
        gl.shaderSource(s, source)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile')
        }
        return s
      }
      const mkProg = (vs: string, fs: string) => {
        const p = gl.createProgram()
        if (!p) throw new Error('createProgram')
        programs.push(p)
        gl.attachShader(p, sh(gl.VERTEX_SHADER, vs))
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs))
        gl.linkProgram(p)
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(p) ?? 'program link')
        }
        return p
      }
      const makeTex = (srcCanvas: HTMLCanvasElement, wrapMode: number) => {
        const t = gl.createTexture()
        if (!t) throw new Error('createTexture')
        textures.push(t)
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        return t
      }

      let stripProg: WebGLProgram
      let remainderProg: WebGLProgram
      let interiorProg: WebGLProgram
      let fleckProg: WebGLProgram
      let glowProg: WebGLProgram
      try {
        stripProg = mkProg(STRIP_VS, STRIP_FS)
        remainderProg = mkProg(FLAT_VS, REMAINDER_FS)
        interiorProg = mkProg(FLAT_VS, INTERIOR_FS)
        fleckProg = mkProg(FLECK_VS, FLECK_FS)
        glowProg = mkProg(FLAT_VS, GLOW_FS)
      } catch (err) {
        // Never swallow this silently: a shader compile/link failure is a
        // shipped bug (e.g. cross-stage uniform precision), not a device quirk.
        console.warn('[pack-cards] shader compile/link failed — using DOM fallback:', err)
        canvas.remove()
        queueFallback()
        return
      }

      const rand = mulberry32(Math.floor(Math.random() * 2 ** 31))
      const edge = bakeTearEdge(rand)
      const glow = glowTier === 'random' ? { color: glowColor(rand), strength: 1 } : tierGlow(glowTier)
      const glowRGB = glow?.color ?? [0, 0, 0]
      const glowStrength = Math.min(1, (glow?.strength ?? 0) * intensity)
      const artTex = makeTex(bakeStripTexture(document, img, width, height), gl.CLAMP_TO_EDGE)
      const edgeTex = makeTex(edgeToCanvas(document, edge), gl.REPEAT)
      const innerTex = makeTex(bakeInnerFallback(document), gl.CLAMP_TO_EDGE)

      // Strip mesh: (MESH_COLS+1)×(MESH_ROWS+1) grid of aGrid coords, indexed.
      const verts = new Float32Array((MESH_COLS + 1) * (MESH_ROWS + 1) * 2)
      let k = 0
      for (let r = 0; r <= MESH_ROWS; r++) {
        for (let c = 0; c <= MESH_COLS; c++) {
          verts[k++] = c / MESH_COLS
          verts[k++] = r / MESH_ROWS
        }
      }
      const idx = new Uint16Array(MESH_COLS * MESH_ROWS * 6)
      let n = 0
      for (let r = 0; r < MESH_ROWS; r++) {
        for (let c = 0; c < MESH_COLS; c++) {
          const i0 = r * (MESH_COLS + 1) + c
          const i1 = i0 + 1
          const i2 = i0 + (MESH_COLS + 1)
          const i3 = i2 + 1
          idx[n++] = i0
          idx[n++] = i1
          idx[n++] = i2
          idx[n++] = i1
          idx[n++] = i3
          idx[n++] = i2
        }
      }
      const meshBuf = gl.createBuffer()
      if (!meshBuf) throw new Error('createBuffer')
      buffers.push(meshBuf)
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf)
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
      const meshIdx = gl.createBuffer()
      if (!meshIdx) throw new Error('createBuffer')
      buffers.push(meshIdx)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIdx)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)

      const quadBuf = gl.createBuffer()
      if (!quadBuf) throw new Error('createBuffer')
      buffers.push(quadBuf)
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
        gl.STATIC_DRAW,
      )

      const fleckBuf = gl.createBuffer()
      if (!fleckBuf) throw new Error('createBuffer')
      buffers.push(fleckBuf)
      // Sized for the live-rip spark pool (MAX_FLECKS), not just the completion
      // burst — the per-frame writer indexes by flecks.length, so the buffer
      // must cover the worst case or it overruns.
      const fleckArr = new Float32Array(MAX_FLECKS * 7)
      let flecks: Fleck[] = []
      // Spark emission from the moving tear frontier: emit a steady number of
      // sparks per unit of progress crossed (accumulator carries the fractional
      // remainder), but only while the rip is actively advancing.
      let sparkProgress = 0
      let sparkAccum = 0
      const SPARK_RATE = 70

      const geom = [STRIP_RATIO, EDGE_AMP, DOM_CLIP_RATIO, aa] as const

      const setGeomUniforms = (prog: WebGLProgram) => {
        gl.useProgram(prog)
        gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0)
        gl.uniform1i(gl.getUniformLocation(prog, 'uEdge'), 1)
        gl.uniform4f(gl.getUniformLocation(prog, 'uGeom'), geom[0], geom[1], geom[2], geom[3])
      }
      setGeomUniforms(stripProg)
      setGeomUniforms(remainderProg)
      setGeomUniforms(interiorProg)
      gl.useProgram(stripProg)
      gl.uniform2f(gl.getUniformLocation(stripProg, 'uCanvas'), cssW, cssH)
      gl.uniform4f(gl.getUniformLocation(stripProg, 'uPack'), packX, packY, width, height)
      gl.uniform1f(gl.getUniformLocation(stripProg, 'uStripH'), stripH)
      gl.useProgram(remainderProg)
      gl.uniform2f(gl.getUniformLocation(remainderProg, 'uCanvas'), cssW, cssH)
      gl.uniform4f(
        gl.getUniformLocation(remainderProg, 'uRect'),
        packX,
        packY + (STRIP_RATIO - EDGE_AMP) * height,
        width,
        (DOM_CLIP_RATIO - STRIP_RATIO + EDGE_AMP) * height,
      )
      gl.useProgram(interiorProg)
      gl.uniform2f(gl.getUniformLocation(interiorProg, 'uCanvas'), cssW, cssH)
      gl.uniform4f(gl.getUniformLocation(interiorProg, 'uRect'), packX, packY, width, stripH)
      gl.uniform1i(gl.getUniformLocation(interiorProg, 'uInner'), 2)
      gl.uniform3f(gl.getUniformLocation(interiorProg, 'uGlowColor'), glowRGB[0], glowRGB[1], glowRGB[2])
      gl.useProgram(fleckProg)
      gl.uniform2f(gl.getUniformLocation(fleckProg, 'uCanvas'), cssW, cssH)
      setGeomUniforms(glowProg)
      gl.uniform2f(gl.getUniformLocation(glowProg, 'uCanvas'), cssW, cssH)
      gl.uniform4f(gl.getUniformLocation(glowProg, 'uRect'), 0, 0, cssW, cssH)
      gl.uniform2f(gl.getUniformLocation(glowProg, 'uCanvasPx'), cssW, cssH)
      gl.uniform4f(gl.getUniformLocation(glowProg, 'uPack'), packX, packY, width, height)
      gl.uniform3f(gl.getUniformLocation(glowProg, 'uGlowColor'), glowRGB[0], glowRGB[1], glowRGB[2])
      gl.uniform2f(
        gl.getUniformLocation(glowProg, 'uGlowCenter'),
        (packX + width / 2) / cssW,
        (packY + STRIP_RATIO * height * 0.8) / cssH,
      )
      // energy envelope sized to fade out before the canvas top — the cone
      // masks shape it into the stacked V-beams
      const glowR = width * 0.9
      gl.uniform2f(gl.getUniformLocation(glowProg, 'uGlowScale'), cssW / glowR, cssH / glowR)

      // Resolve every per-frame uniform / attribute location ONCE here, after
      // the programs are linked, rather than re-looking them up ~20× each frame
      // in frame(). getUniformLocation / getAttribLocation are stable for the
      // life of a linked program, so caching them is safe and removes a steady
      // stream of GL round-trips from the rAF loop.
      const uni = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name)
      const loc = {
        interior: {
          uReveal: uni(interiorProg, 'uReveal'),
          uFrontier: uni(interiorProg, 'uFrontier'),
          uCurlShadow: uni(interiorProg, 'uCurlShadow'),
          uGlowAmt: uni(interiorProg, 'uGlowAmt'),
          uWhiteout: uni(interiorProg, 'uWhiteout'),
        },
        remainder: {
          uHint: uni(remainderProg, 'uHint'),
          uReveal: uni(remainderProg, 'uReveal'),
          uWhiteout: uni(remainderProg, 'uWhiteout'),
        },
        glow: {
          uGlowAmt: uni(glowProg, 'uGlowAmt'),
        },
        strip: {
          uProgress: uni(stripProg, 'uProgress'),
          uCurlR: uni(stripProg, 'uCurlR'),
          uTime: uni(stripProg, 'uTime'),
          uFlutterPhase: uni(stripProg, 'uFlutterPhase'),
          uHint: uni(stripProg, 'uHint'),
          uFly: uni(stripProg, 'uFly'),
          uFade: uni(stripProg, 'uFade'),
          uWhiteout: uni(stripProg, 'uWhiteout'),
          aGrid: gl.getAttribLocation(stripProg, 'aGrid'),
        },
        fleck: {
          aPos: gl.getAttribLocation(fleckProg, 'aPos'),
          aSize: gl.getAttribLocation(fleckProg, 'aSize'),
          aCol: gl.getAttribLocation(fleckProg, 'aCol'),
        },
      }
      // aGrid attribute location per quad-drawing program (drawQuad runs every
      // frame for interior / remainder / glow).
      const quadAGrid = new Map<WebGLProgram, number>([
        [interiorProg, gl.getAttribLocation(interiorProg, 'aGrid')],
        [remainderProg, gl.getAttribLocation(remainderProg, 'aGrid')],
        [glowProg, gl.getAttribLocation(glowProg, 'aGrid')],
      ])

      const drawQuad = (prog: WebGLProgram) => {
        gl.useProgram(prog)
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
        const aGrid = quadAGrid.get(prog) ?? gl.getAttribLocation(prog, 'aGrid')
        gl.enableVertexAttribArray(aGrid)
        gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 8, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.disableVertexAttribArray(aGrid)
      }

      // Effect-local clock: absolute performance.now() would overflow mediump
      // fp16 in the shader's sin() after long page sessions on mobile GPUs.
      const epoch = performance.now()
      let lastFrame = performance.now()
      let lastDraw = 0
      let readyFired = false

      const frame = (now: number) => {
        if (disposed || gl.isContextLost()) return
        // Idle throttle: before the first grab (and after a full spring-back),
        // the ONLY thing animating is the directional foil hint — redraw it at
        // idleFps instead of the full 60, sparing weak GPUs a constant 5-pass
        // churn while the pack just waits to be touched. Every active phase
        // (grab / tear / spring-back / fly-off) and any live flecks bypass this
        // and run full-rate for responsiveness.
        if (phase === 'idle' && flecks.length === 0 && now - lastDraw < idleInterval) {
          raf = requestAnimationFrame(frame)
          return
        }
        lastDraw = now
        const dt = Math.min(0.05, (now - lastFrame) / 1000)
        lastFrame = now
        const timeSec = ((now - epoch) / 1000) % 360

        // ---- advance phase animations (CPU side) ----
        const animation = animationState
        if (animation) {
          const t = (now - animation.t0) / animation.dur
          if (animation.kind === 'springback') {
            tearProgress = animation.from * (1 - easeOutCubic(t))
            if (t >= 1) {
              tearProgress = 0
              animationState = null
              phase = tearTransition(phase, { type: 'springback-done' })
              notify('onRest')
              if (disposed) return
            }
          } else {
            tearProgress = animation.from + (1 - animation.from) * easeInOutQuad(t)
            if (t >= 1) {
              tearProgress = 1
              animationState = null
              phase = tearTransition(phase, { type: 'tear-done' })
              if (phase === 'torn') {
                flecks = spawnFlecks(packX + width * 0.9, packY + stripH * 0.5, Math.random, Math.round(FLECK_COUNT * intensity))
                flyState = { t0: now }
                flyStarted = true
                phase = tearTransition(phase, { type: 'flyoff-start' })
                // Mark detachment before notifying a parent that may synchronously unmount.
                notify('onTorn')
                if (disposed) return
              }
            }
          }
        }

        let flyX = 0
        let flyY = 0
        let flyRot = 0
        let fade = 1
        const whiteout = 0 // The public renderer keeps the torn sleeve solid.
        const fly = flyState
        if (fly && phase !== 'done') {
          const ft = Math.min(1, (now - fly.t0) / FLYOFF_MS)
          flyX = width * (0.4 * ft + 1.1 * ft * ft)
          flyY = -height * 0.5 * ft + height * 0.65 * ft * ft
          flyRot = 0.5 * ft
          fade = 1 - clamp01((ft - 0.5) / 0.45)
          if (ft >= 1) {
            phase = tearTransition(phase, { type: 'flyoff-done' })
            if (!completeFiredEver && phase === 'done') {
              completeFiredEver = true
              notify('onComplete')
              if (disposed) return
            }
          }
        } else if (phase === 'done') {
          fade = 0
        }


        const progress = tearProgress
        const curlR = Math.max(24, (0.3 - 0.18 * progress) * width)
        const reveal = Math.min(1, progress * 4)

        // ---- live-rip sparks: shed foil from the advancing tear frontier ----
        if (
          (phase === 'grabbing' || phase === 'tearing') &&
          progress > sparkProgress
        ) {
          sparkAccum += (progress - sparkProgress) * SPARK_RATE
          const n = Math.min(8, Math.floor(sparkAccum))
          if (n > 0) {
            sparkAccum -= Math.floor(sparkAccum)
            const fx = packX + progress * width
            const fy = packY + STRIP_RATIO * height
            flecks.push(...spawnSparks(fx, fy, Math.random, n))
            if (flecks.length > MAX_FLECKS) flecks = flecks.slice(flecks.length - MAX_FLECKS)
          }
        }
        sparkProgress = progress

        flecks = flecks.filter((f) => {
          f.age += dt
          if (f.age >= f.life) return false
          f.x += f.vx * dt
          f.y += f.vy * dt
          f.vy += 700 * dt
          return true
        })
        // Sweep for two seconds, with a quiet pause before the next invitation.
        const hintProgress = Math.max(0, Math.min(1, (timeSec % 4.8 - 0.8) / 2))
        const hintX = -0.08 + hintProgress * 1.16
        const hint = phase === 'idle' ? Math.sin(hintProgress * Math.PI) * 0.6 : 0
        const glowAmt = glowRamp(progress) * glowStrength
        // ---- draw ----
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, artTex)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, edgeTex)
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, innerTex)

        if (!liningCaptured) {
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
        if (liningCaptured) gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(remainderProg)
        gl.uniform2f(loc.remainder.uHint, hintX, hint)
        gl.uniform1f(loc.remainder.uWhiteout, whiteout)
        gl.uniform1f(loc.remainder.uReveal, reveal)
        drawQuad(remainderProg)
        if (renderGlow && glowAmt > 0) {
          // additive bloom leaking out of the opening (strip still occludes it).
          // Skipped on the low tier (the single most expensive full-canvas pass);
          // the interior lining still picks up the glow color, so the rarity tell
          // survives — just without the big god-ray beam.
          gl.useProgram(glowProg)
          gl.uniform1f(loc.glow.uGlowAmt, glowAmt)
          gl.blendFunc(gl.ONE, gl.ONE)
          drawQuad(glowProg)
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        }

        gl.useProgram(stripProg)
        gl.uniform1f(loc.strip.uProgress, progress)
        gl.uniform1f(loc.strip.uCurlR, curlR)
        gl.uniform1f(loc.strip.uTime, timeSec)
        gl.uniform1f(loc.strip.uFlutterPhase, (timeSec * 7) % (Math.PI * 2))
        gl.uniform2f(loc.strip.uHint, hintX, hint)
        gl.uniform4f(loc.strip.uFly, flyX, flyY, flyRot, 0)
        gl.uniform1f(loc.strip.uFade, fade)
        gl.uniform1f(loc.strip.uWhiteout, whiteout)
        gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIdx)
        const aGrid = loc.strip.aGrid
        gl.enableVertexAttribArray(aGrid)
        gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 8, 0)
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
        gl.disableVertexAttribArray(aGrid)

        if (flecks.length) {
          for (let i = 0; i < flecks.length; i++) {
            const f = flecks[i]
            const t = f.age / f.life
            const j = i * 7
            fleckArr[j] = f.x
            fleckArr[j + 1] = f.y
            fleckArr[j + 2] = f.size * dpr
            fleckArr[j + 3] = f.col[0]
            fleckArr[j + 4] = f.col[1]
            fleckArr[j + 5] = f.col[2]
            fleckArr[j + 6] = 1 - t
          }
          gl.useProgram(fleckProg)
          gl.bindBuffer(gl.ARRAY_BUFFER, fleckBuf)
          gl.bufferData(gl.ARRAY_BUFFER, fleckArr.subarray(0, flecks.length * 7), gl.DYNAMIC_DRAW)
          const aPos = loc.fleck.aPos
          const aSize = loc.fleck.aSize
          const aCol = loc.fleck.aCol
          gl.enableVertexAttribArray(aPos)
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 28, 0)
          gl.enableVertexAttribArray(aSize)
          gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 28, 8)
          gl.enableVertexAttribArray(aCol)
          gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12)
          gl.blendFunc(gl.ONE, gl.ONE)
          gl.drawArrays(gl.POINTS, 0, flecks.length)
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
          gl.disableVertexAttribArray(aPos)
          gl.disableVertexAttribArray(aSize)
          gl.disableVertexAttribArray(aCol)
        }

        gl.disable(gl.BLEND)

        if (!readyFired) {
          readyFired = true
          notify('onReady')
          if (disposed) return
        }
        // Stop the loop once everything is over and the last fleck is gone.
        if (phase === 'done' && flecks.length === 0) return
        if (!hidden) raf = requestAnimationFrame(frame)
      }
      if (!hidden) raf = requestAnimationFrame(frame)

      onVisibility = () => {
        hidden = document.hidden
        if (hidden) {
          cancelAnimationFrame(raf)
        } else if (!disposed) {
          lastFrame = performance.now()
          raf = requestAnimationFrame(frame)
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
    }

    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.src = artSrc
    img.decode()
      .then(() => {
        if (!disposed) start(img)
      })
      .catch((err) => {
        // The pack art failing to decode is exceptional — fall back to the
        // DOM path so the flow never blocks.
        if (!disposed) {
          console.warn('[pack-cards] artwork or renderer initialization failed; using DOM fallback:', err)
          canvas.remove()
          queueFallback()
        }
      })

    return () => {
      if (disposed) return
      disposed = true
      img.removeAttribute('src')
      liningCanvas?.remove()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      cancelAnimationFrame(raf)
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
      // The parent may unmount in response to onTorn/onComplete timing; if the
      // fly-off was cut short by teardown, still deliver the terminal callback.
      if (flyStarted && !completeFiredEver) {
        completeFiredEver = true
        notify('onComplete')
      }
      // Detach the canvas, then drop the GL context ON THE NEXT FRAME — not
      // synchronously here. canvas.remove() only reaches the compositor at the
      // next commit, but loseContext() invalidates the GPU backing store right
      // away; in that gap a compositor frame can still paint the not-yet-removed
      // layer from its now-invalid backing, flashing a white rectangle the size
      // of the padded canvas. Waiting one rAF
      // lets the removal composite first, so by the time we lose the context the
      // layer is already gone and there's nothing left to paint white.
      canvas.remove()
      releaseAfterRemoval(window, () => {
        for (const buffer of buffers) gl.deleteBuffer(buffer)
        for (const texture of textures) gl.deleteTexture(texture)
        for (const program of programs) gl.deleteProgram(program)
        for (const shader of shaders) gl.deleteShader(shader)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      })
    }
  }

  const dispose = (() => {
    if (!active) return
    active = false
    for (const timer of timers) window.clearTimeout(timer)
    timers.clear()
    stopWebGL()
    stopWebGL = noop
    clearSurface()
    root.remove()
  }) as RendererDisposer
  dispose.setBodyArtwork = nextSrc => {
    if (!active || nextSrc === bodyArtSrc) return
    bodyArtSrc = nextSrc
    body.src = nextSrc
    if (strip) strip.src = nextSrc
  }
  try {
    renderSurface()
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) queueFallback()
    else stopWebGL = startWebGL() ?? noop
  } catch (error) {
    dispose()
    throw error
  }
  return dispose
}
