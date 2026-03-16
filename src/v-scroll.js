import { injectTheme } from './v-scroll-theme.js';

const MIN_THUMB = 16;
const BAR_PAD = 3;

const createShadow = (host) => {
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = '[part=scroll]::-webkit-scrollbar{width:0;height:0;display:none}';
  root.appendChild(style);
  const box = document.createElement('div');
  box.style.cssText = 'display:flex;flex-direction:row;height:100%;overflow:hidden;';
  const scroll = document.createElement('div');
  scroll.setAttribute('part', 'scroll');
  scroll.style.cssText = 'flex:1;min-width:0;height:100%;overflow:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;cursor:default;';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:block;min-height:min-content;';
  const slot = document.createElement('slot');
  wrap.appendChild(slot);
  scroll.appendChild(wrap);
  const track = document.createElement('div');
  track.setAttribute('part', 'track');
  track.style.cssText = 'flex-shrink:0;width:14px;position:relative;box-sizing:border-box;background:rgba(0,0,0,0.08);border-radius:7px;';
  const bar = document.createElement('div');
  bar.setAttribute('part', 'bar');
  bar.classList.add('turned');
  bar.style.cssText = 'position:absolute;top:0;right:2px;width:10px;box-sizing:border-box;background:rgba(0,0,0,0.35);border-radius:5px;pointer-events:auto;cursor:grab;touch-action:none;user-select:none;z-index:1;';
  track.appendChild(bar);
  box.append(scroll, track);
  root.appendChild(box);
  return { root, scroll, track, bar };
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const updateBarHeight = (scroll_el, track_el, bar_el) => {
  const ch = scroll_el.scrollHeight, sh = scroll_el.clientHeight;
  if (ch <= sh || sh <= 0) {
    track_el.style.display = 'none';
    bar_el.style.display = 'none';
    bar_el.classList.remove('turned');
    return;
  }
  track_el.style.display = '';
  track_el.style.height = `${sh}px`;
  bar_el.style.display = 'block';
  bar_el.classList.add('turned');
  const ratio = sh / ch;
  const h = Math.max(MIN_THUMB, Math.round(sh * ratio));
  bar_el.style.height = `${h}px`;
  bar_el.style.minHeight = `${MIN_THUMB}px`;
  bar_el.style.opacity = '1';
  bar_el.style.background = 'rgba(0,0,0,0.28)';
  const trackH = sh - BAR_PAD * 2;
  const range = trackH - h;
  const top = range <= 0 ? BAR_PAD : BAR_PAD + (scroll_el.scrollTop / (ch - sh)) * range;
  bar_el.style.setProperty('top', `${top}px`, 'important');
};

const syncBarPosition = (scroll_el, track_el, bar_el) => {
  const ch = scroll_el.scrollHeight, sh = scroll_el.clientHeight;
  if (ch <= sh) return;
  const trackH = Math.max(0, sh - BAR_PAD * 2);
  const h = bar_el.offsetHeight;
  const range = trackH - h;
  const max_scroll = ch - sh;
  const top = range <= 0 ? BAR_PAD : BAR_PAD + (scroll_el.scrollTop / max_scroll) * range;
  bar_el.style.setProperty('top', `${top}px`, 'important');
};

const scrollToThumbPosition = (scroll_el, track_el, bar_el, barTop) => {
  const ch = scroll_el.scrollHeight, sh = scroll_el.clientHeight;
  if (ch <= sh) return;
  const trackH = sh - BAR_PAD * 2;
  const h = bar_el.offsetHeight;
  const range = trackH - h;
  if (range <= 0) return;
  const t = (barTop - BAR_PAD) / range;
  scroll_el.scrollTop = t * (ch - sh);
};

const bindScroll = (scroll_el, track_el, bar_el, cleanupRef) => {
  const sync = () => {
    if (cleanupRef.drag) return;
    syncBarPosition(scroll_el, track_el, bar_el);
  };
  const onWheel = () => requestAnimationFrame(sync);
  const onTouch = () => requestAnimationFrame(sync);
  scroll_el.addEventListener('scroll', sync, { passive: true });
  scroll_el.addEventListener('wheel', onWheel, { passive: true });
  scroll_el.addEventListener('touchmove', onTouch, { passive: true });
  let raf_id = 0;
  const tick = () => {
    sync();
    raf_id = requestAnimationFrame(tick);
  };
  raf_id = requestAnimationFrame(tick);
  return () => {
    scroll_el.removeEventListener('scroll', sync);
    scroll_el.removeEventListener('wheel', onWheel);
    scroll_el.removeEventListener('touchmove', onTouch);
    cancelAnimationFrame(raf_id);
  };
};

const bindResize = (scroll_el, track_el, bar_el, cleanupRef) => {
  const run = () => updateBarHeight(scroll_el, track_el, bar_el);
  const ro = new ResizeObserver(run);
  ro.observe(scroll_el);
  requestAnimationFrame(run);
  setTimeout(run, 0);
  cleanupRef.ro = () => ro.disconnect();
};

const bindCursor = (track_el, bar_el, cleanupRef) => {
  const onLeave = () => document.body.classList.remove('grab-cursor');
  const onEnter = () => document.body.classList.remove('grab-cursor');
  track_el.addEventListener('pointerleave', onLeave);
  track_el.addEventListener('pointerenter', onEnter);
  bar_el.addEventListener('pointerleave', onLeave);
  bar_el.addEventListener('pointerenter', onEnter);
  cleanupRef.cursor = () => {
    track_el.removeEventListener('pointerleave', onLeave);
    track_el.removeEventListener('pointerenter', onEnter);
    bar_el.removeEventListener('pointerleave', onLeave);
    bar_el.removeEventListener('pointerenter', onEnter);
    document.body.classList.remove('grab-cursor');
  };
};

const bindPointer = (scroll_el, track_el, bar_el, cleanupRef) => {
  let start_y = 0, start_top = 0;

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    start_y = e.clientY;
    start_top = parseFloat(bar_el.style.top || '0');
    bar_el.classList.add('drag');
    document.body.classList.add('drag');
    track_el.setPointerCapture(e.pointerId);
    cleanupRef.drag = true;
  };

  const onMove = (e) => {
    if (!cleanupRef.drag) return;
    e.preventDefault();
    const dy = e.clientY - start_y;
    const ch = scroll_el.scrollHeight, sh = scroll_el.clientHeight;
    const trackH = sh - BAR_PAD * 2;
    const h = bar_el.offsetHeight;
    const range = trackH - h;
    const new_top = clamp(start_top + dy, BAR_PAD, BAR_PAD + range);
    bar_el.style.setProperty('top', `${new_top}px`, 'important');
    scrollToThumbPosition(scroll_el, track_el, bar_el, new_top);
  };

  const onUp = (e) => {
    track_el.releasePointerCapture(e.pointerId);
    bar_el.classList.remove('drag');
    document.body.classList.remove('drag');
    cleanupRef.drag = false;
  };

  track_el.addEventListener('pointerdown', onDown);
  track_el.addEventListener('pointermove', onMove);
  track_el.addEventListener('pointerup', onUp);
  track_el.addEventListener('pointercancel', onUp);
  track_el.style.touchAction = 'none';
  cleanupRef.pointer = () => {
    track_el.removeEventListener('pointerdown', onDown);
    track_el.removeEventListener('pointermove', onMove);
    track_el.removeEventListener('pointerup', onUp);
    track_el.removeEventListener('pointercancel', onUp);
  };
};

const runCleanup = (ref) => {
  if (ref.unscroll) ref.unscroll();
  if (ref.ro) ref.ro();
  if (ref.pointer) ref.pointer();
  if (ref.cursor) ref.cursor();
};

class VScroll extends HTMLElement {
  static get observedAttributes() { return []; }

  constructor() {
    super();
    this._cleanup = {};
    this._bound = false;
  }

  connectedCallback() {
    injectTheme();
    if (this._bound) return;
    this._bound = true;
    const { scroll, track, bar } = createShadow(this);
    this._scroll = scroll;
    this._bar = bar;
    this._cleanup.unscroll = bindScroll(scroll, track, bar, this._cleanup);
    bindResize(scroll, track, bar, this._cleanup);
    bindCursor(track, bar, this._cleanup);
    bindPointer(scroll, track, bar, this._cleanup);
    updateBarHeight(scroll, track, bar);
  }

  disconnectedCallback() {
    runCleanup(this._cleanup);
    this._cleanup = {};
    this._bound = false;
  }
}

customElements.define('v-scroll', VScroll);
