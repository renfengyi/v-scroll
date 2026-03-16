let injected = false;

export function injectTheme() {
  if (injected) return;
  injected = true;
  (async () => {
    const m = await import('$/v-scroll.js');
    const css = m.default;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  })();
}
