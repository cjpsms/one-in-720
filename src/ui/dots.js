// The dot picture: 720 pink dots laid out as the school (6 grade blocks, one cluster per room) instead of a world map.
// Drawn on a canvas, no image files. Your own dot pulses once you have a life.
import { hashRand, reducedMotion } from './dom.js';

const DEFAULT_MAP = {
  grades: [1, 2, 3, 4, 5, 6].map((g) => ({ grade: g, rooms: Array.from({ length: g <= 3 ? 4 : 6 }, () => (g <= 3 ? 30 : 20)) })),
  meRoom: null,
};

function cssVar(name, fallback) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
}

function parseMe(schoolMap, me) {
  let g = null; let r = null;
  const m = (schoolMap && schoolMap.meRoom) || me;
  if (m && typeof m === 'object') { g = Number(m.grade) || null; r = Number(m.room) || null; }
  else if (typeof m === 'string') { const x = m.match(/(\d)\s*\/\s*(\d)/); if (x) { g = Number(x[1]); r = Number(x[2]); } }
  else if (typeof m === 'number') { r = m; g = 1; }
  if (me && typeof me === 'object' && !g) { g = Number(me.grade) || null; r = Number(me.room) || null; }
  return g && r ? { grade: g, room: r } : null;
}

// layout: positions in CSS pixels for a W x H area. Deterministic, so the picture never jumps.
export function layoutDots(schoolMap, W, H, opts = {}) {
  const map = schoolMap && schoolMap.grades && schoolMap.grades.length ? schoolMap : DEFAULT_MAP;
  const padX = opts.padX ?? 14; const padTop = opts.padTop ?? 18; const padBottom = opts.padBottom ?? 14; const gap = opts.gap ?? 10;
  const cols = 3; const rowsN = 2;
  const bw = (W - 2 * padX - (cols - 1) * gap) / cols;
  const bh = (H - padTop - padBottom - (rowsN - 1) * gap) / rowsN;
  const rnd = hashRand(720);
  const dots = []; const blocks = [];
  const meta = parseMe(map, opts.me);
  let meIndex = -1;
  map.grades.forEach((gr, gi) => {
    const col = gi % cols; const row = Math.floor(gi / cols);
    const bx = padX + col * (bw + gap) + (rnd() - 0.5) * 3;
    const by = padTop + row * (bh + gap) + (rnd() - 0.5) * 3;
    blocks.push({ x: bx, y: by, w: bw, h: bh, grade: gr.grade });
    const n = gr.rooms.length;
    const rc = n <= 4 ? 2 : 3; const rr = Math.ceil(n / rc);
    const cw = bw / rc; const ch = (bh - 12) / rr;
    gr.rooms.forEach((count, ri) => {
      const cx = bx + (ri % rc + 0.5) * cw + (rnd() - 0.5) * 2;
      const cy = by + 12 + (Math.floor(ri / rc) + 0.5) * ch + (rnd() - 0.5) * 2;
      const R = Math.max(2, Math.min(cw, ch) / 2 * 0.94);
      const rBase = (R / Math.sqrt(count)) * 0.6;
      const start = dots.length;
      for (let i = 0; i < count; i++) {
        const rad = R * Math.sqrt((i + 0.5) / count);
        const ang = i * 2.399963 + ri;
        dots.push({
          x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, r: Math.max(0.4, rBase * (0.55 + rnd() * 1.0)), phase: rnd() * 6.28,
          tw: rnd() < 0.35, grade: gr.grade, room: ri + 1,
        });
      }
      if (meta && meta.grade === gr.grade && meta.room === ri + 1) meIndex = start + Math.floor(rnd() * count);
    });
  });
  return { dots, blocks, meIndex, W, H };
}

let landCache = null;
function landTexture(layout, dpr, fg) {
  const key = `${layout.W}x${layout.H}x${dpr}x${fg}`;
  if (landCache && landCache.key === key) return landCache.canvas;
  const c = document.createElement('canvas');
  c.width = Math.round(layout.W * dpr); c.height = Math.round(layout.H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = fg;
  for (const b of layout.blocks) {
    const x0 = b.x - 4; const y0 = b.y - 3; const x1 = b.x + b.w + 4; const y1 = b.y + b.h + 3;
    for (let y = y0; y < y1; y += 5) for (let x = x0; x < x1; x += 5) {
      // soft rounded edge: skip some dots near the corners
      const dx = Math.min(x - x0, x1 - x) / 14; const dy = Math.min(y - y0, y1 - y) / 14;
      if (Math.min(dx, dy) < 1 && ((x * 7 + y * 13) % 5) / 5 > Math.min(dx, dy) + 0.15) continue;
      g.fillRect(x, y, 1.2, 1.2);
    }
  }
  landCache = { key, canvas: c };
  return c;
}

// draw one frame onto ctx (already scaled to CSS pixels). t = ms.
export function drawDots(ctx, layout, t, o = {}) {
  const dpr = o.dpr || 1;
  const accent = o.accent || cssVar('--accent', '#e8688a');
  const fg = o.fg || cssVar('--fg', '#e8ece9');
  const muted = o.muted || cssVar('--muted', '#8a989c');
  const light = document.documentElement.dataset.theme === 'light';
  ctx.clearRect(0, 0, layout.W, layout.H);
  const land = landTexture(layout, dpr, light ? 'rgba(0,0,0,0.16)' : 'rgba(232,236,233,0.11)');
  ctx.drawImage(land, 0, 0, layout.W, layout.H);
  ctx.font = '600 9px ui-monospace, "DejaVu Sans Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = muted;
  for (const b of layout.blocks) ctx.fillText(`ม.${b.grade}`, b.x + 1, b.y - 1);
  const animate = !!o.animate;
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 0.8;
  const dots = layout.dots;
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i];
    if (i === layout.meIndex && o.hasMe) continue;
    const a = animate && d.tw ? 0.62 + 0.3 * Math.sin(t * 0.0016 + d.phase) : 0.82;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * 0.25;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 1.6, 0, 6.2832); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (o.hasMe && layout.meIndex >= 0) {
    const d = dots[layout.meIndex];
    const ph = animate ? ((t % 1800) / 1800) : 0.4;
    ctx.fillStyle = accent; ctx.strokeStyle = accent;
    ctx.globalAlpha = 1 - ph;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 2 + ph * 16, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(d.x, d.y, Math.max(d.r, 3.2), 0, 6.2832); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(d.x, d.y, Math.max(d.r, 3.2) + 2.4, 0, 6.2832); ctx.stroke();
  }
}

// Mount an animated dot picture that fills `container` (position: relative, with a size).
export function mountDots(container, { schoolMap, me, hasMe = false, padTop, padBottom, animate = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'ภาพจุด 720 จุดแทนนักเรียนทั้งโรงเรียน แบ่งเป็นหกชั้นและห้องเรียน');
  container.append(canvas);
  const ctx = canvas.getContext('2d');
  let layout = null; let dpr = 1; let raf = 0; let alive = true; let last = 0;
  const motion = animate && !reducedMotion();
  let state = { schoolMap, me, hasMe };

  const resize = () => {
    const r = container.getBoundingClientRect();
    if (r.width < 60 || r.height < 40) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = layoutDots(state.schoolMap, r.width, r.height, { me: state.me, padTop, padBottom });
    frame(performance.now(), true);
  };
  const frame = (t, force) => {
    if (!alive || !layout) return;
    if (!force && t - last < 33) { raf = requestAnimationFrame(frame); return; }
    last = t;
    drawDots(ctx, layout, t, { animate: motion, hasMe: state.hasMe, dpr });
    if (motion) raf = requestAnimationFrame(frame);
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', resize);
  resize();
  return {
    setMe(next) { state = { ...state, ...next }; if (layout) { resize(); } },
    redraw() { frame(performance.now(), true); },
    destroy() { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); canvas.remove(); },
  };
}

// static render for the share cards: draws into a given 2d context region
export function drawDotsInto(ctx, x, y, W, H, schoolMap, me, colors) {
  const layout = layoutDots(schoolMap, W, H, { me, padTop: 16, padBottom: 6, padX: 8, gap: 8 });
  const off = document.createElement('canvas');
  off.width = Math.round(W); off.height = Math.round(H);
  const g = off.getContext('2d');
  drawDots(g, layout, 0, { animate: false, hasMe: layout.meIndex >= 0, dpr: 1, accent: colors.accent, fg: colors.fg, muted: colors.muted });
  ctx.drawImage(off, x, y);
}
