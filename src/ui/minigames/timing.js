// Mini game "timing" (CONTRACT3 section 5): a marker sweeps over a track, stop it in the green zone.
// 3 tries, the zone gets narrower each time. Used for floating the krathong (also titration in the lab).
// This file also exports `kit`, the small shared shell used by rhythm / track / sequence / steps (all owned by U5).
import { Rng } from '../../rng.js';

export const INFO = {
  id: 'timing',
  title: 'จังหวะปล่อย',
  how: 'ตัวเลื่อนวิ่งไปมา แตะปุ่ม "ปล่อย" (หรือกดเว้นวรรค) ตอนที่มันอยู่ในแถบสีเขียว 3 ครั้ง แถบจะแคบลงทุกครั้ง',
};

// ---------------------------------------------------------------- shared kit
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function tierOf(score) {
  if (score >= 0.85) return { id: 'great', th: 'ยอดเยี่ยม' };
  if (score >= 0.65) return { id: 'good', th: 'ดี' };
  if (score >= 0.4) return { id: 'ok', th: 'พอใช้' };
  return { id: 'bad', th: 'ยังต้องฝึก' };
}

export function prefersReduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// Seeded rng for building content, and a second stream for the bot so playing never shifts the content.
export const rngFor = (spec, salt = 0) => new Rng(((spec && spec.seed) | 0) ^ salt);

// Builds the common frame: header, body, intro card with "เริ่ม", result line, always-visible auto button.
// Returns g with helpers that track every timer/listener so destroy() is clean.
export function shell(container, spec, info, botFn, done) {
  const rng = rngFor(spec, 0);
  const g = {
    spec, rng, params: (spec && spec.params) || {}, reduced: prefersReduced(),
    finished: false, started: false, destroyed: false,
  };
  const offs = [];
  const timers = new Set();
  const rafs = new Set();

  g.on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };
  g.later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!g.destroyed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  g.every = (fn, ms) => {
    const id = setInterval(() => { if (!g.destroyed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  g.clear = (id) => { clearTimeout(id); clearInterval(id); timers.delete(id); };
  // loop(fn(dtSeconds, nowMs)) runs every animation frame until the returned stop() or destroy().
  g.loop = (fn) => {
    let last = performance.now();
    let id = 0;
    let on = true;
    const tick = (now) => {
      rafs.delete(id);
      if (!on || g.destroyed) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      fn(dt, now);
      if (on && !g.destroyed) { id = requestAnimationFrame(tick); rafs.add(id); }
    };
    id = requestAnimationFrame(tick);
    rafs.add(id);
    return () => { on = false; cancelAnimationFrame(id); rafs.delete(id); };
  };

  const root = el('div', `mg2 mg2-${info.id}`);
  root.setAttribute('data-game', info.id);
  const head = el('div', 'mg2-head');
  const kicker = el('span', 'mg2-kicker', `มินิเกม · ${info.title}`);
  const label = el('span', 'mg2-label', g.params.label || '');
  head.append(kicker, label);
  const body = el('div', 'mg2-body');
  const live = el('div', 'mg2-live sr-only');
  live.setAttribute('aria-live', 'polite');
  const result = el('div', 'mg2-result');
  result.hidden = true;
  const foot = el('div', 'mg2-foot');
  const autoBtn = el('button', 'btn small mg2-auto', 'ให้ระบบเล่นให้');
  autoBtn.type = 'button';
  foot.append(autoBtn);
  root.append(head, body, live, result, foot);
  container.appendChild(root);
  g.root = root; g.body = body; g.live = live; g.autoBtn = autoBtn;

  g.say = (t) => { live.textContent = t; };

  // intro card (how to + start)
  let startFn = null;
  const intro = el('div', 'mg2-intro');
  intro.append(el('div', 'mg2-intro-t', info.title), el('p', 'mg2-intro-how', info.how));
  const startBtn = el('button', 'btn primary mg2-start', 'เริ่ม');
  startBtn.type = 'button';
  intro.append(startBtn);
  body.appendChild(intro);
  g.onStart = (fn) => { startFn = fn; };
  g.begin = () => {
    if (g.started || g.finished) return;
    g.started = true;
    intro.remove();
    if (startFn) startFn();
  };
  g.on(startBtn, 'click', g.begin);
  setTimeout(() => { try { if (!g.destroyed && !g.started) startBtn.focus({ preventScroll: true }); } catch { /* ignore */ } }, 0);

  g.showResult = (score, auto) => {
    const t = tierOf(score);
    result.hidden = false;
    result.className = `mg2-result tier-${t.id}`;
    result.textContent = '';
    const w = el('b', 'mg2-result-tier', t.th);
    const pc = el('span', 'mg2-result-pc', `${Math.round(score * 100)}%`);
    result.append(w, pc);
    if (auto) result.append(el('small', '', 'ระบบเล่นให้'));
    g.say(`${t.th} ${Math.round(score * 100)} เปอร์เซ็นต์`);
    autoBtn.disabled = true;
  };
  g.stopAll = () => {
    for (const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
    for (const id of timers) { clearTimeout(id); clearInterval(id); }
    timers.clear();
  };
  g.finish = (score, stats) => {
    if (g.finished || g.destroyed) return;
    g.finished = true;
    const sc = clamp(Number.isFinite(score) ? score : 0);
    g.stopAll();
    g.showResult(sc, false);
    root.classList.add('is-done');
    const id = setTimeout(() => { timers.delete(id); if (!g.destroyed) done({ score: sc, stats }); }, g.reduced ? 700 : 1300);
    timers.add(id);
  };
  g.auto = () => {
    if (g.finished || g.destroyed) return;
    g.finished = true;
    g.stopAll();
    let sc = 0.5;
    try { sc = clamp(botFn(spec, new Rng((((spec && spec.seed) | 0) ^ 0x9e3779b1) >>> 0))); } catch { /* keep default */ }
    g.showResult(sc, true);
    root.classList.add('is-done');
    done({ auto: true, score: sc });
  };
  g.on(autoBtn, 'click', g.auto);

  g.destroy = () => {
    if (g.destroyed) return;
    g.destroyed = true;
    g.stopAll();
    for (const off of offs) { try { off(); } catch { /* ignore */ } }
    offs.length = 0;
    if (root.parentNode) root.parentNode.removeChild(root);
  };
  return g;
}

// Is a keyboard event for this game? (container still in the page, not typing in a field)
export function keyOk(g, e) {
  if (g.destroyed || !g.root.isConnected) return false;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return false;
  return true;
}

// Canvas with a fixed logical size (CSS scales it; backing store is 2x).
export function makeCanvas(w, h, cls) {
  const c = el('canvas', cls || 'mg2-canvas');
  const k = 2;
  c.width = w * k; c.height = h * k;
  c.style.aspectRatio = `${w} / ${h}`;
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  c.toLogical = (ev) => {
    const r = c.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / (r.width || 1)) * w, y: ((ev.clientY - r.top) / (r.height || 1)) * h };
  };
  return { c, ctx };
}

export function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// ---------------------------------------------------------------- timing game
const triangle = (phase) => { const p = ((phase % 2) + 2) % 2; return p <= 1 ? p : 2 - p; };

// Score of one release. pos and centre are 0..1 on the track, zone is the width of the green band.
export function tryScore(pos, centre, zone) {
  const d = Math.abs(pos - centre);
  const half = zone / 2;
  if (d <= half) return 0.65 + 0.35 * (1 - d / half);
  return 0.5 * Math.max(0, 1 - (d - half) / 0.2);
}

function readParams(spec) {
  const p = (spec && spec.params) || {};
  const tries = Math.max(1, Math.min(5, Math.round(p.tries || 3)));
  const zone = clamp(Number.isFinite(p.zone) ? p.zone : 0.22, 0.05, 0.6);
  const speed = clamp(Number.isFinite(p.speed) ? p.speed : 0.9, 0.3, 2.5);
  const label = p.label || '';
  const mode = p.mode || (/ไทเทรต|สารละลาย|บิวเรต|หยด|ทดลอง/.test(label) ? 'titration' : 'krathong');
  return { tries, zone, speed, label, mode };
}

// Pre-rolls the course of every try so the content depends on the seed only.
function plan(spec, reduced) {
  const P = readParams(spec);
  const rng = rngFor(spec, 0x1f3a);
  const list = [];
  for (let i = 0; i < P.tries; i++) {
    let zone = P.zone * Math.pow(0.7, i);
    if (reduced) zone = Math.min(0.7, zone * 1.25);
    const lo = zone / 2 + 0.06;
    const hi = 1 - zone / 2 - 0.06;
    list.push({
      zone,
      centre: lo + rng.float() * (hi - lo),
      phase: rng.float() * 2,
      speed: P.speed * Math.pow(1.12, i) * (reduced ? 0.55 : 1),
    });
  }
  return { P, list };
}

export function bot(spec, rng) {
  const { P, list } = plan(spec, false);
  const d = clamp(spec && spec.difficulty != null ? spec.difficulty : 0.5);
  let sum = 0;
  for (const t of list) {
    // human aiming error grows with speed and difficulty, shrinks a little with a wide zone
    const sigma = 0.07 + 0.05 * d + 0.035 * (t.speed - 0.5);
    const pos = clamp(t.centre + rng.gauss() * sigma, 0, 1);
    sum += tryScore(pos, t.centre, t.zone);
  }
  return clamp(sum / P.tries);
}

export function play(container, spec, done) {
  const g = shell(container, spec, INFO, bot, done);
  const { P, list } = plan(spec, g.reduced);
  const TRY_LIMIT = 7; // seconds before the marker is released for you

  const stage = el('div', `mg2-tm mg2-tm-${P.mode}`);
  const hud = el('div', 'mg2-tm-hud');
  const tryLbl = el('span', 'mg2-tm-try', '');
  const dots = el('span', 'mg2-tm-dots');
  const dotEls = [];
  for (let i = 0; i < P.tries; i++) { const d = el('i', 'mg2-tm-dot'); dotEls.push(d); dots.appendChild(d); }
  hud.append(tryLbl, dots);

  const track = el('div', 'mg2-tm-track');
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', P.mode === 'krathong' ? 'ทางน้ำ แถบสีเขียวคือจังหวะที่ลมพอดี' : 'หลอดทดลอง แถบสีเขียวคือจุดที่ถูกต้อง');
  const water = el('div', 'mg2-tm-water');
  const zoneEl = el('div', 'mg2-tm-zone');
  zoneEl.appendChild(el('span', 'mg2-tm-zone-t', P.mode === 'krathong' ? 'ลมพอดี' : 'จุดสมดุล'));
  const mark = el('div', 'mg2-tm-mark');
  if (P.mode === 'krathong') {
    mark.append(el('i', 'k-base'), el('i', 'k-petal'), el('i', 'k-petal k2'), el('i', 'k-candle'), el('i', 'k-flame'));
  } else {
    mark.append(el('i', 'd-drop'));
  }
  track.append(water, zoneEl, mark);

  const say = el('div', 'mg2-tm-say', 'พร้อมแล้วแตะ "ปล่อย"');
  const btn = el('button', 'btn primary mg2-tm-btn', P.mode === 'krathong' ? 'ปล่อย' : 'หยด');
  btn.type = 'button';
  btn.setAttribute('aria-keyshortcuts', 'Space');
  const timeBar = el('div', 'mg2-tm-time');
  const timeFill = el('i');
  timeBar.appendChild(timeFill);
  stage.append(hud, track, timeBar, say, btn);
  g.body.appendChild(stage);

  let idx = 0;
  let elapsed = 0;
  let pos = 0;
  let locked = true;
  const scores = [];
  let stop = null;

  function setZone(i) {
    const c = list[i];
    zoneEl.style.left = `${(c.centre - c.zone / 2) * 100}%`;
    zoneEl.style.width = `${c.zone * 100}%`;
    zoneEl.classList.remove('hit', 'miss');
    tryLbl.textContent = `ครั้งที่ ${i + 1} จาก ${P.tries}`;
    say.textContent = i === 0 ? 'จับจังหวะให้ดี' : 'แถบแคบลงแล้ว ระวัง';
    say.className = 'mg2-tm-say';
  }
  function place() {
    mark.style.left = `${pos * 100}%`;
    mark.classList.toggle('in', Math.abs(pos - list[idx].centre) <= list[idx].zone / 2);
  }
  function startTry() {
    elapsed = 0;
    locked = false;
    setZone(idx);
    place();
  }
  function release(forced) {
    if (locked || g.finished) return;
    locked = true;
    const c = list[idx];
    const s = tryScore(pos, c.centre, c.zone);
    scores.push(s);
    const inside = Math.abs(pos - c.centre) <= c.zone / 2;
    zoneEl.classList.add(inside ? 'hit' : 'miss');
    dotEls[idx].className = `mg2-tm-dot ${s >= 0.85 ? 'great' : s >= 0.6 ? 'good' : s >= 0.3 ? 'ok' : 'bad'}`;
    say.className = `mg2-tm-say ${inside ? 'good' : 'bad'}`;
    say.textContent = (forced ? 'หมดเวลา ' : '') + (s >= 0.9 ? 'พอดีเป๊ะ' : inside ? 'อยู่ในแถบ' : s >= 0.2 ? 'เฉียดไปนิด' : 'พลาด');
    g.say(say.textContent);
    idx++;
    if (idx >= P.tries) {
      g.later(() => g.finish(scores.reduce((a, b) => a + b, 0) / P.tries, { tries: scores.map((x) => Math.round(x * 100)) }), 700);
    } else {
      g.later(startTry, g.reduced ? 900 : 800);
    }
  }

  g.on(btn, 'click', () => release(false));
  g.on(track, 'pointerdown', (e) => { e.preventDefault(); release(false); });
  g.on(document, 'keydown', (e) => {
    if (!g.started || !keyOk(g, e)) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      if (e.target && e.target.tagName === 'BUTTON' && e.target !== btn) return;
      if (e.target === btn) return; // the button handles it itself
      e.preventDefault();
      if (!e.repeat) release(false);
    }
  });

  g.onStart(() => {
    startTry();
    btn.focus({ preventScroll: true });
    stop = g.loop((dt) => {
      if (locked) return;
      elapsed += dt;
      const c = list[idx];
      pos = g.reduced
        ? Math.round(triangle(c.phase + elapsed * c.speed) * 16) / 16 // step-based marker
        : triangle(c.phase + elapsed * c.speed);
      place();
      timeFill.style.width = `${clamp(1 - elapsed / TRY_LIMIT) * 100}%`;
      if (elapsed >= TRY_LIMIT) release(true);
    });
  });
  const inner = g.destroy;
  g.destroy = () => { if (stop) stop(); inner(); };
  return { destroy: () => g.destroy() };
}
