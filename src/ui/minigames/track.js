// Mini game "track" (CONTRACT3 section 5): keep a moving target inside a frame / band for the whole time.
// mode 'camera': drag to move the viewfinder so the performer stays in frame.
// mode 'sound' : hold the button to push the needle up, release to let it fall; keep it in the green band.
// Score = share of the time the target was inside.
import { shell, el, clamp, makeCanvas, cssVar, keyOk, rngFor } from './timing.js';

export const INFO = {
  id: 'track',
  title: 'ตามให้ทัน',
  how: 'โหมดกล้อง: ลากนิ้ว (หรือกดลูกศร) ให้กรอบจับนักแสดงไว้ในภาพ โหมดเสียง: กดปุ่มค้างเพื่อดันเข็ม ปล่อยเพื่อให้ตก ให้เข็มอยู่ในแถบสีเขียว',
};

const W = 360;
const HC = 300;

function readParams(spec) {
  const p = (spec && spec.params) || {};
  const mode = p.mode === 'sound' ? 'sound' : 'camera';
  const speed = clamp(Number.isFinite(p.speed) ? p.speed : 1, 0.4, 2.5);
  const band = clamp(Number.isFinite(p.band) ? p.band : 0.3, 0.12, 0.7);
  const dur = clamp(Number.isFinite(spec && spec.durationSec) ? spec.durationSec : 20, 12, 40);
  return { mode, speed, band, dur };
}

export function bot(spec, rng) {
  const P = readParams(spec);
  const d = clamp(spec && spec.difficulty != null ? spec.difficulty : 0.5);
  const modeAdj = P.mode === 'sound' ? -0.04 : 0;
  const s = 0.58 + 1.0 * (P.band - 0.28) - 0.17 * (P.speed - 1) - 0.18 * d + modeAdj + rng.gauss() * 0.06;
  return clamp(s, 0.08, 0.96);
}

// smooth deterministic wander from the seed
export function wander(spec, speed) {
  const rng = rngFor(spec, 0x51ab);
  const ph = [0, 1, 2, 3, 4, 5].map(() => rng.float() * Math.PI * 2);
  return {
    cam(t) {
      const a = t * speed;
      return {
        x: W / 2 + 92 * Math.sin(0.8 * a + ph[0]) + 48 * Math.sin(1.9 * a + ph[1]),
        y: HC / 2 + 6 + 38 * Math.sin(0.65 * a + ph[2]) + 18 * Math.sin(1.7 * a + ph[3]),
      };
    },
    band(t) { // 0..1 centre of the green band
      const a = t * speed;
      return 0.5 + 0.27 * Math.sin(0.42 * a + ph[4]) + 0.11 * Math.sin(1.15 * a + ph[5]);
    },
    noise(t) {
      return 0.22 * Math.sin(2.9 * t + ph[0]) + 0.17 * Math.sin(5.3 * t + ph[3]);
    },
  };
}

export function play(container, spec, done) {
  const g = shell(container, spec, INFO, bot, done);
  const P = readParams(spec);
  const speed = P.speed * (g.reduced ? 0.6 : 1);
  const bandW = clamp(P.band * (g.reduced ? 1.2 : 1), 0.12, 0.8);
  const W2 = wander(spec, speed);
  const accent = cssVar('--accent', '#e8688a');
  const teal = cssVar('--teal', '#4fc3a1');

  const stage = el('div', `mg2-tr mg2-tr-${P.mode}`);
  const hud = el('div', 'mg2-tr-hud');
  const shareEl = el('span', 'mg2-tr-share', 'ในกรอบ 0%');
  const timeEl = el('span', 'mg2-tr-time', `${Math.ceil(P.dur)} วินาที`);
  hud.append(shareEl, timeEl);
  const bar = el('div', 'mg2-tr-bar');
  const barFill = el('i');
  bar.appendChild(barFill);

  const isCam = P.mode === 'camera';
  const { c, ctx } = makeCanvas(W, isCam ? HC : 250, 'mg2-canvas mg2-tr-canvas');
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', isCam ? 'จอกล้อง ลากเพื่อเลื่อนกรอบ' : 'มาตรวัดเสียง');
  stage.append(hud, bar, c);

  let holdBtn = null;
  if (!isCam) {
    holdBtn = el('button', 'btn primary mg2-tr-hold', 'กดค้างเพื่อดันเสียง');
    holdBtn.type = 'button';
    holdBtn.setAttribute('aria-keyshortcuts', 'Space ArrowUp');
    stage.appendChild(holdBtn);
  } else {
    stage.appendChild(el('div', 'mg2-tr-tip', 'ลากบนจอเพื่อเลื่อนกรอบ'));
  }
  g.body.appendChild(stage);

  // state
  const fw = Math.round(bandW * W);
  const fh = Math.round(fw * 0.72);
  const frame = { x: W / 2, y: HC / 2 };
  let needle = 0.2;
  let vel = 0;
  let holding = false;
  let t = 0;
  let inTime = 0;
  let wasIn = false;
  const keys = { l: 0, r: 0, u: 0, d: 0 };
  const trail = [];
  let stop = null;

  // ---- input
  if (isCam) {
    let last = null;
    g.on(c, 'pointerdown', (e) => {
      if (!g.started) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      last = c.toLogical(e);
    });
    g.on(c, 'pointermove', (e) => {
      if (!last || !g.started) return;
      const p = c.toLogical(e);
      frame.x += p.x - last.x;
      frame.y += p.y - last.y;
      last = p;
      frame.x = clamp(frame.x, fw / 2, W - fw / 2);
      frame.y = clamp(frame.y, fh / 2, HC - fh / 2);
    });
    const up = () => { last = null; };
    g.on(c, 'pointerup', up);
    g.on(c, 'pointercancel', up);
    g.on(c, 'lostpointercapture', up);
  } else {
    const on = (e) => { if (!g.started) return; e.preventDefault(); holding = true; holdBtn.classList.add('on'); try { holdBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
    const off = () => { holding = false; holdBtn.classList.remove('on'); };
    g.on(holdBtn, 'pointerdown', on);
    g.on(holdBtn, 'pointerup', off);
    g.on(holdBtn, 'pointercancel', off);
    g.on(holdBtn, 'lostpointercapture', off);
    g.on(holdBtn, 'contextmenu', (e) => e.preventDefault());
  }
  const keyMap = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd' };
  g.on(document, 'keydown', (e) => {
    if (!g.started || !keyOk(g, e)) return;
    if (isCam && keyMap[e.code]) { keys[keyMap[e.code]] = 1; e.preventDefault(); }
    if (!isCam && (e.code === 'Space' || e.code === 'ArrowUp')) { holding = true; holdBtn.classList.add('on'); e.preventDefault(); }
  });
  g.on(document, 'keyup', (e) => {
    if (isCam && keyMap[e.code]) keys[keyMap[e.code]] = 0;
    if (!isCam && (e.code === 'Space' || e.code === 'ArrowUp')) { holding = false; holdBtn.classList.remove('on'); }
  });

  // ---- drawing
  function drawCamera(sub, inside) {
    const bg = ctx.createLinearGradient(0, 0, 0, HC);
    bg.addColorStop(0, '#171027');
    bg.addColorStop(0.7, '#241636');
    bg.addColorStop(1, '#0f0a18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, HC);
    // curtains
    for (const [x0, dir] of [[0, 1], [W, -1]]) {
      const cg = ctx.createLinearGradient(x0, 0, x0 + dir * 70, 0);
      cg.addColorStop(0, '#5a1428');
      cg.addColorStop(1, 'rgba(90,20,40,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(dir > 0 ? 0 : W - 70, 0, 70, HC);
    }
    // stage floor
    ctx.fillStyle = '#2c1d3d';
    ctx.fillRect(0, HC - 52, W, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, HC - 52 + i * 9, W, 1);
    // spot on the performer
    const sg = ctx.createRadialGradient(sub.x, sub.y + 20, 6, sub.x, sub.y + 20, 110);
    sg.addColorStop(0, 'rgba(255,235,200,0.30)');
    sg.addColorStop(1, 'rgba(255,235,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, HC);
    // performer
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(sub.x, sub.y + 22, 17, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d2b8';
    ctx.beginPath(); ctx.arc(sub.x, sub.y - 14, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a1a';
    ctx.beginPath(); ctx.arc(sub.x, sub.y - 18, 12, Math.PI, Math.PI * 2); ctx.fill();
    const arm = g.reduced ? 0 : Math.sin(t * 5) * 8;
    ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sub.x - 14, sub.y + 6); ctx.lineTo(sub.x - 28, sub.y + 20 + arm); ctx.moveTo(sub.x + 14, sub.y + 6); ctx.lineTo(sub.x + 28, sub.y + 20 - arm); ctx.stroke();
    // dim outside the frame
    const fx0 = frame.x - fw / 2;
    const fy0 = frame.y - fh / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, fy0);
    ctx.fillRect(0, fy0 + fh, W, HC - fy0 - fh);
    ctx.fillRect(0, fy0, fx0, fh);
    ctx.fillRect(fx0 + fw, fy0, W - fx0 - fw, fh);
    // viewfinder
    const col = inside ? teal : '#f08b7e';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.strokeRect(fx0, fy0, fw, fh);
    ctx.lineWidth = 4;
    const L = 14;
    for (const [cx, cy, sx, sy] of [[fx0, fy0, 1, 1], [fx0 + fw, fy0, -1, 1], [fx0, fy0 + fh, 1, -1], [fx0 + fw, fy0 + fh, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.moveTo(frame.x - 6, frame.y); ctx.lineTo(frame.x + 6, frame.y); ctx.moveTo(frame.x, frame.y - 6); ctx.lineTo(frame.x, frame.y + 6); ctx.stroke();
    ctx.globalAlpha = 1;
    // REC tag
    const blink = g.reduced || Math.floor(t * 2) % 2 === 0;
    ctx.fillStyle = col;
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(inside ? 'REC' : 'หลุดเฟรม', fx0 + 8, fy0 + 17);
    if (inside && blink) { ctx.beginPath(); ctx.arc(fx0 + 44, fy0 + 13, 4, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawSound(bc, inside) {
    const Hh = 250;
    const bg = ctx.createLinearGradient(0, 0, 0, Hh);
    bg.addColorStop(0, '#1a1426');
    bg.addColorStop(1, '#0f0b18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, Hh);
    // equaliser bars
    const bars = 24;
    for (let i = 0; i < bars; i++) {
      const hh = 8 + (g.reduced ? 0.4 : 0.5 + 0.5 * Math.sin(t * 6 + i * 1.3)) * (10 + needle * 60);
      ctx.fillStyle = (inside ? teal : accent) + '33';
      ctx.fillRect(10 + i * 14.3, Hh - 12 - hh, 9, hh);
    }
    // gauge
    const cx = W / 2;
    const cy = 196;
    const R = 150;
    const a0 = Math.PI * 1.1;
    const a1 = Math.PI * 1.9;
    const ang = (v) => a0 + (a1 - a0) * v;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    ctx.strokeStyle = inside ? teal : '#3f8f78';
    ctx.beginPath(); ctx.arc(cx, cy, R, ang(clamp(bc - bandW / 2)), ang(clamp(bc + bandW / 2))); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i <= 10; i++) {
      const a = ang(i / 10);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18)); ctx.lineTo(cx + Math.cos(a) * (R + (i % 5 === 0 ? 28 : 23)), cy + Math.sin(a) * (R + (i % 5 === 0 ? 28 : 23))); ctx.stroke();
    }
    // needle
    const na = ang(needle);
    ctx.strokeStyle = inside ? '#ffffff' : '#f08b7e';
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (R + 12), cy + Math.sin(na) * (R + 12)); ctx.stroke();
    ctx.fillStyle = '#e8ece9';
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = inside ? teal : '#f08b7e';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(inside ? 'เสียงพอดี' : needle > bc ? 'เสียงดังเกิน' : 'เสียงเบาไป', cx, cy + 36);
  }

  function step(dt) {
    t += dt;
    let inside;
    if (isCam) {
      const kv = 190 * dt;
      frame.x = clamp(frame.x + (keys.r - keys.l) * kv, fw / 2, W - fw / 2);
      frame.y = clamp(frame.y + (keys.d - keys.u) * kv, fh / 2, HC - fh / 2);
      const sub = W2.cam(t);
      inside = Math.abs(sub.x - frame.x) <= fw / 2 && Math.abs(sub.y - frame.y) <= fh / 2;
      drawCamera(sub, inside);
    } else {
      const k = Math.min(1, 6 * dt);
      vel += ((holding ? 0.78 : -0.78) - vel) * k;
      needle = clamp(needle + (vel + W2.noise(t) * 0.45 * speed) * dt);
      const bc = W2.band(t);
      inside = Math.abs(needle - bc) <= bandW / 2;
      drawSound(bc, inside);
    }
    if (inside) inTime += dt;
    if (inside !== wasIn) { wasIn = inside; g.say(inside ? 'ในกรอบ' : 'หลุด'); }
    const left = Math.max(0, P.dur - t);
    shareEl.textContent = `ในกรอบ ${Math.round((inTime / Math.max(t, 0.5)) * 100)}%`;
    shareEl.classList.toggle('is-in', inside);
    timeEl.textContent = `${Math.ceil(left)} วินาที`;
    barFill.style.width = `${(1 - left / P.dur) * 100}%`;
    if (t >= P.dur) {
      if (stop) stop();
      g.finish(inTime / P.dur, { inFrame: Math.round(inTime * 10) / 10, seconds: P.dur, mode: P.mode });
    }
  }

  // idle picture behind the intro card
  if (isCam) drawCamera(W2.cam(0), true); else drawSound(W2.band(0), true);
  g.onStart(() => {
    if (isCam) { c.focus({ preventScroll: true }); } else { holdBtn.focus({ preventScroll: true }); }
    stop = g.loop(step);
  });
  const inner = g.destroy;
  g.destroy = () => { if (stop) stop(); inner(); };
  return { destroy: () => g.destroy() };
}
