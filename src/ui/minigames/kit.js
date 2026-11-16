// Shared helpers for the mini games (written by U4; U5's games may use them too, nothing requires it).
// A game is built with mount(): it gives the game a frame (HUD, stage, "เริ่ม" overlay, result overlay), a timer/listener
// registry that destroy() clears, a requestAnimationFrame loop, and a seeded Rng. Contract: docs/CONTRACT3.md section 5.
import { h, clamp, reducedMotion } from '../dom.js';
import { Rng } from '../../rng.js';

export { h, clamp };

export const pct = (s) => Math.round(clamp(Number.isFinite(s) ? s : 0, 0, 1) * 100);

// grade word for a score 0..1 (the content module has its own scoreTier; this one is only for the result line)
export function tierOf(score) {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 0.85) return { id: 'great', th: 'ยอดเยี่ยม' };
  if (s >= 0.65) return { id: 'good', th: 'ดี' };
  if (s >= 0.4) return { id: 'ok', th: 'พอใช้' };
  return { id: 'bad', th: 'ต้องฝึกอีก' };
}

export const rngFor = (spec, salt = 0) => new Rng(((((spec && spec.seed) | 0) ^ salt) >>> 0) || 1);

// plausible score of an average player (a bit lower when the spec is harder)
export function botScore(spec, rng, base = 0.7, spread = 0.1) {
  const r = rng || rngFor(spec, 0x51ed);
  const d = clamp(Number(spec && spec.difficulty) || 0, 0, 1);
  return clamp(base - 0.25 * d + r.gauss() * spread, 0.05, 0.98);
}

// the same colour for the same id, on any theme (dark or light)
export function hueOf(id) {
  let x = 2166136261;
  const s = String(id);
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0) % 360;
}
export const swatch = (id, l = 46) => `hsl(${hueOf(id)} 58% ${l}%)`;

// run fn once when el has left the document (the sheet was cleared or the screen replaced)
export function onRemoved(el, fn) {
  let seen = el.isConnected; let done = false; let mo = null; let iv = 0;
  const run = () => {
    if (done) return; done = true; clearInterval(iv); if (mo) mo.disconnect();
    try { fn(); } catch (e) { console.warn('[one-in-720] cleanup failed', e); }
  };
  const check = () => { if (el.isConnected) seen = true; else if (seen) run(); };
  if (typeof MutationObserver === 'function') { mo = new MutationObserver(check); mo.observe(document.documentElement, { childList: true, subtree: true }); }
  iv = setInterval(check, 800);
  return run;
}

// hex or rgb() string -> [r,g,b] or null
export function parseColor(c) {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((x) => parseInt(x + x, 16));
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgb\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}
export function colorDist(a, b) {
  const x = parseColor(a); const y = parseColor(b);
  if (!x || !y) return String(a) === String(b) ? 0 : 999;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// ---------- the frame ----------
// setup(api) builds the game into api.stage and calls api.ready(startFn). api.finish(score, stats, line) shows the result;
// done({ score, stats }) is called once, when the player taps "ต่อไป".
export function mount(container, spec, info, done, setup) {
  const reduce = reducedMotion();
  const rng = new Rng(((spec && spec.seed) >>> 0) || 1);
  const timers = new Set(); const offs = [];
  let alive = true; let finished = false; let sent = false; let frameFn = null; let rafId = 0; let last = 0;

  const hudL = h('span', { class: 'hl' }); const hudR = h('span', { class: 'hr' });
  const hud = h('div', { class: 'mg-hud', 'aria-live': 'off' }, hudL, hudR);
  const stage = h('div', { class: 'mg-stage' });
  const veil = h('div', { class: 'mg-veil', hidden: true });
  const root = h('div', { class: `mg mg-${info.id}`, 'data-game': info.id }, hud, stage, veil);
  container.append(root);

  const api = {
    root, stage, rng, spec, reduce,
    params: (spec && spec.params) || {},
    get alive() { return alive && !finished; },
    timeout(fn, ms) {
      const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
      timers.add(id); return id;
    },
    clear(id) { clearTimeout(id); timers.delete(id); },
    on(target, type, fn, opts) { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); },
    loop(fn) {
      frameFn = fn; last = performance.now(); cancelAnimationFrame(rafId);
      const tick = (now) => {
        if (!alive || frameFn !== fn) return;
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
        if (fn(dt, now) === false) { if (frameFn === fn) frameFn = null; return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    },
    stopLoop() { frameFn = null; cancelAnimationFrame(rafId); },
    hud(left, right) { if (left != null) hudL.textContent = left; if (right != null) hudR.textContent = right; },
    ready(startFn, hint) {
      const btn = h('button', { type: 'button', class: 'btn primary', 'data-mg-start': '' }, 'เริ่ม');
      veil.replaceChildren(h('div', { class: 'mg-intro' },
        h('div', { class: 'mg-intro-t', text: info.title }),
        h('p', { class: 'mg-intro-h', text: info.how }),
        hint ? h('p', { class: 'mg-intro-k', text: hint }) : null,
        btn));
      veil.hidden = false;
      btn.addEventListener('click', () => {
        veil.hidden = true; veil.replaceChildren();
        root.dispatchEvent(new CustomEvent('mg:start', { bubbles: true }));
        if (alive) startFn();
      });
      try { btn.focus({ preventScroll: true }); } catch { /* ignore */ }
    },
    finish(score, stats, line) {
      if (finished || !alive) return;
      finished = true; api.stopLoop();
      const sc = clamp(Number.isFinite(score) ? score : 0, 0, 1);
      const t = tierOf(sc);
      const btn = h('button', { type: 'button', class: 'btn primary', 'data-mg-next': '' }, 'ต่อไป');
      veil.replaceChildren(h('div', { class: 'mg-res', role: 'status' },
        h('div', { class: 'label', text: 'ผลของคุณ' }),
        h('div', { class: `mg-tier t-${t.id}`, text: t.th }),
        h('div', { class: 'mg-pct', text: `${pct(sc)}%` }),
        line ? h('p', { class: 'mg-res-l', text: line }) : null,
        btn));
      veil.hidden = false;
      btn.addEventListener('click', () => { if (sent || !alive) return; sent = true; done({ score: sc, stats: stats || {} }); });
      try { btn.focus({ preventScroll: true }); } catch { /* ignore */ }
    },
  };

  const ctl = {
    destroy() {
      alive = false; api.stopLoop();
      timers.forEach((id) => clearTimeout(id)); timers.clear();
      offs.splice(0).forEach((f) => f());
      root.remove();
    },
  };
  onRemoved(root, () => ctl.destroy());
  try { setup(api); } catch (e) { console.warn('[one-in-720] game setup failed', e); ctl.destroy(); throw e; }
  return ctl;
}

// keys: 1..9 style shortcuts. returns the index or -1
export function digitIndex(ev) {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return -1;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(ev.code || '');
  return m ? Number(m[1]) - 1 : -1;
}
