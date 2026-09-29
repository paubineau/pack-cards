import { setImmediate } from 'node:timers/promises';

class EventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, event = {}) {
    for (const handler of [...this.listeners.get(type) || []]) handler(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

// Only the DOM operations used by pack/deck lifecycles are represented here.
// This fixture tests events and ownership; browser layout is checked separately.
export function installDOM(t, { reduced = false, installGlobals = true } = {}) {
  const timers = new Map();
  const frames = new Map();
  const media = new Map();
  const cleanup = [];
  let timerId = 0;
  const document = Object.assign(new EventTarget(), { hidden: false, activeElement: null });

  class Node extends EventTarget {
    constructor(tag) {
      super();
      Object.assign(this, {
        tagName: tag.toUpperCase(), ownerDocument: document, className: '', textContent: '',
        children: [], attributes: new Map(), parentElement: null, hidden: false,
        offsetLeft: 0, offsetTop: 0, offsetWidth: 240, offsetHeight: 320
      });
      this.style = {
        setProperty(key, value) { this[key] = String(value); },
        getPropertyValue(key) { return this[key] || ''; },
        removeProperty(key) { delete this[key]; }
      };
    }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    get lastElementChild() { return this.children.at(-1) || null; }
    get classList() {
      return {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); }
      };
    }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parentElement = this;
        this.children.push(node);
      }
    }
    replaceChildren(...nodes) {
      for (const node of this.children) node.parentElement = null;
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
      this.parentElement = null;
    }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        if (part === ':focus-visible') return false;
        if (part.startsWith('.')) return this.classList.contains(part.slice(1));
        if (part === '[role="button"]') return this.getAttribute('role') === 'button';
        return this.tagName.toLowerCase() === part;
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(node => [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    contains(node) {
      for (let current = node; current; current = current.parentElement) if (current === this) return true;
      return false;
    }
    focus() { document.activeElement = this; }
    click() {
      if (this.disabled) return;
      const event = { target: this, currentTarget: this, detail: 0 };
      this.onclick?.(event);
      this.emit('click', event);
    }
    decode() { return Promise.resolve(); }
    cloneNode() { return new Node(this.tagName); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 240, height: 320 }; }
    getContext() { return { measureText: text => ({ width: String(text).length * 12 }) }; }
  }

  document.createElement = tag => new Node(tag);
  document.body = new Node('body');
  document.documentElement = { clientWidth: 1280, clientHeight: 800 };
  const window = Object.assign(new EventTarget(), {
    isSecureContext: false,
    navigator: { maxTouchPoints: 0 },
    getSelection: () => ({ isCollapsed: true }),
    getComputedStyle: node => ({ transform: node.style.transform || 'none', getPropertyValue: key => node.style.getPropertyValue(key) }),
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => { frames.set(++timerId, callback); return timerId; },
    cancelAnimationFrame: id => frames.delete(id),
    matchMedia(query) {
      if (!media.has(query)) media.set(query, Object.assign(new EventTarget(), {
        matches: query.includes('no-preference') ? !reduced : query.includes(': reduce)') ? reduced : false
      }));
      return media.get(query);
    }
  });
  document.defaultView = window;
  const globals = {
    document, window, getComputedStyle: window.getComputedStyle,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  if (installGlobals) for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(async () => {
    await setImmediate();
    try {
      for (const dispose of cleanup) dispose();
    } finally {
      if (installGlobals) for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  return {
    document, window, timers, frames, media, settle: setImmediate,
    cleanup(dispose) { cleanup.push(dispose); },
    host() { const host = new Node('div'); document.body.append(host); return host; },
    runTimers() {
      const pending = [...timers];
      timers.clear();
      for (const [, { callback }] of pending) callback();
    }
  };
}
