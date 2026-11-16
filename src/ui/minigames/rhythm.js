// Mini game "rhythm" (CONTRACT3 section 5): notes fall down 3-4 lanes, tap each lane as a note reaches the line.
// Used for the night show (acting on stage). Score = weighted hit accuracy over all notes.
import { shell, el, clamp, makeCanvas, cssVar, keyOk, rngFor } from './timing.js';

export const INFO = {
  id: 'rhythm',
  title: 'จังหวะบนเวที',
  how: 'โน้ตตกลงมาตามช่อง แตะช่อง (หรือกดปุ่มบนคีย์บอร์ด) ตอนที่โน้ตแตะเส้นสีขาว ยิ่งตรงจังหวะยิ่งได้คะแนน',
};

const W = 360;
const H = 320;
const HIT_Y = 264;
const TOP_Y = -20;
const WIN = { perfect: 0.07, good: 0.13, ok: 0.19 }; // seconds
const WEIGHT = { perfect: 1, good: 0.7, ok: 0.4, miss: 0 };

const KEYS = {
  3: [['KeyD', 'ArrowLeft'], ['KeyF', 'Space', 'ArrowDown'], ['KeyJ', 'ArrowRight']],
  4: [['KeyD', 'ArrowLeft'], ['KeyF', 'ArrowDown'], ['KeyJ', 'ArrowUp'], ['KeyK', 'ArrowRight']],
};
const KEY_HINT = { 3: ['D', 'F', 'J'], 4: ['D', 'F', 'J', 'K'] };

function readParams(spec) {
  const p = (spec && spec.params) || {};
  const lanes = p.lanes === 4 ? 4 : 3;
  const bpm = clamp(Number.isFinite(p.bpm) ? p.bpm : 96, 60, 180);
  const notes = Math.max(8, Math.min(60, Math.round(p.notes || 24)));
  const dur = clamp(Number.isFinite(spec && spec.durationSec) ? spec.durationSec : 24, 15, 40);
  return { lanes, bpm, notes, dur, label: p.label || 'การแสดงบนเวที' };
}

// Chart is rolled from the seed only: [{ t (seconds from start), lane }]
export function makeChart(spec) {
  const P = readParams(spec);
  const rng = rngFor(spec, 0x7a11);
  const beat = 60 / P.bpm;
  const half = beat / 2;
  const free = Math.max(2, P.dur - 4.5);
  const k = clamp(Math.round(free / P.notes / half), 1, 4);
  const lead = 2.4;
  const chart = [];
  let t = lead;
  let lane = rng.int(0, P.lanes - 1);
  let same = 0;
  for (let i = 0; i < P.notes; i++) {
    let next = rng.int(0, P.lanes - 1);
    if (next === lane && same >= 1) next = (next + 1 + rng.int(0, P.lanes - 2)) % P.lanes;
    same = next === lane ? same + 1 : 0;
    lane = next;
    chart.push({ t: Math.round(t * 1000) / 1000, lane });
    // mostly steady gaps, sometimes a quick pair
    const g2 = k > 1 && rng.chance(0.18) ? Math.max(1, k - 1) : k;
    t += g2 * half;
  }
  return { P, chart };
}

export function bot(spec, rng) {
  const { P, chart } = makeChart(spec);
  const d = clamp(spec && spec.difficulty != null ? spec.difficulty : 0.5);
  const sd = (0.045 + 0.05 * d) * (1 + (P.bpm - 90) / 260); // seconds of timing noise
  let sum = 0;
  for (let i = 0; i < chart.length; i++) {
    if (rng.chance(0.04 + 0.11 * d)) continue; // missed note
    const err = Math.abs(rng.gauss()) * sd;
    sum += err <= WIN.perfect ? WEIGHT.perfect : err <= WIN.good ? WEIGHT.good : err <= WIN.ok ? WEIGHT.ok : 0;
  }
  return clamp(sum / chart.length);
}

export function play(container, spec, done) {
  const g = shell(container, spec, INFO, bot, done);
  const { P, chart } = makeChart(spec);
  const lanes = P.lanes;
  const scale = g.reduced ? 1.3 : 1;
  const win = { perfect: WIN.perfect * scale, good: WIN.good * scale, ok: WIN.ok * scale };
  const fall = g.reduced ? 2.6 : 1.7; // seconds from the top to the line
  const laneW = (W - 40) / lanes;
  const laneX = (i) => 20 + i * laneW;
  const colors = [cssVar('--accent', '#e8688a'), cssVar('--teal', '#4fc3a1'), cssVar('--warn', '#e6b94d'), '#7aa7ff'];

  const stage = el('div', 'mg2-rh');
  const hud = el('div', 'mg2-rh-hud');
  const comboEl = el('span', 'mg2-rh-combo', 'คอมโบ 0');
  const accEl = el('span', 'mg2-rh-acc', 'แม่น --');
  hud.append(comboEl, accEl);
  const { c, ctx } = makeCanvas(W, H, 'mg2-canvas mg2-rh-canvas');
  const pads = el('div', 'mg2-rh-pads');
  pads.style.gridTemplateColumns = `repeat(${lanes}, 1fr)`;
  const padEls = [];
  for (let i = 0; i < lanes; i++) {
    const b = el('button', 'mg2-rh-pad');
    b.type = 'button';
    b.style.setProperty('--lane', colors[i % colors.length]);
    b.setAttribute('aria-label', `ช่อง ${i + 1}`);
    b.append(el('span', 'mg2-rh-pad-k', KEY_HINT[lanes][i]));
    pads.appendChild(b);
    padEls.push(b);
  }
  stage.append(hud, c, pads);
  g.body.appendChild(stage);

  const notes = chart.map((n) => ({ ...n, state: 'wait', at: 0 }));
  let tStart = 0;
  let combo = 0;
  let best = 0;
  let sumW = 0;
  let judged = 0;
  const counts = { perfect: 0, good: 0, ok: 0, miss: 0 };
  const fx = []; // hit rings and judgement texts
  const press = new Array(lanes).fill(0);
  let stop = null;
  const endAt = chart[chart.length - 1].t + 0.9;

  const now = () => (performance.now() - tStart) / 1000;

  function judge(n, kind, t) {
    n.state = kind;
    n.at = t;
    counts[kind]++;
    sumW += WEIGHT[kind];
    judged++;
    if (kind === 'miss') combo = 0; else { combo++; best = Math.max(best, combo); }
    comboEl.textContent = `คอมโบ ${combo}`;
    accEl.textContent = `แม่น ${Math.round((sumW / judged) * 100)}%`;
    fx.push({ lane: n.lane, kind, t, born: t });
  }

  function hit(lane) {
    if (!g.started || g.finished) return;
    const t = now();
    press[lane] = t;
    padEls[lane].classList.add('on');
    g.later(() => padEls[lane] && padEls[lane].classList.remove('on'), 90);
    let target = null;
    for (const n of notes) {
      if (n.lane !== lane || n.state !== 'wait') continue;
      const dt = Math.abs(n.t - t);
      if (dt <= win.ok && (!target || dt < Math.abs(target.t - t))) target = n;
    }
    if (!target) return; // stray tap, no penalty
    const dt = Math.abs(target.t - t);
    judge(target, dt <= win.perfect ? 'perfect' : dt <= win.good ? 'good' : 'ok', t);
  }

  padEls.forEach((b, i) => {
    g.on(b, 'pointerdown', (e) => { e.preventDefault(); hit(i); });
    g.on(b, 'keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); });
  });
  g.on(c, 'pointerdown', (e) => {
    e.preventDefault();
    const p = c.toLogical(e);
    const lane = Math.floor((p.x - 20) / laneW);
    if (lane >= 0 && lane < lanes) hit(lane);
  });
  g.on(document, 'keydown', (e) => {
    if (!g.started || e.repeat || !keyOk(g, e)) return;
    const km = KEYS[lanes];
    for (let i = 0; i < lanes; i++) {
      if (km[i].includes(e.code)) { e.preventDefault(); hit(i); return; }
    }
  });

  function draw(t) {
    // stage backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#120c1c');
    bg.addColorStop(1, '#1d1230');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // spotlights
    if (!g.reduced) {
      const sw = Math.sin(t * 0.9) * 40;
      for (const sx of [70 + sw, 290 - sw]) {
        const lg = ctx.createRadialGradient(sx, 0, 4, sx, 0, 260);
        lg.addColorStop(0, 'rgba(255,230,190,0.16)');
        lg.addColorStop(1, 'rgba(255,230,190,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(sx - 6, 0); ctx.lineTo(sx + 6, 0); ctx.lineTo(sx + 120, H); ctx.lineTo(sx - 120, H); ctx.fill();
      }
    }
    // lanes
    for (let i = 0; i < lanes; i++) {
      const x = laneX(i);
      const col = colors[i % colors.length];
      const lg = ctx.createLinearGradient(0, TOP_Y, 0, HIT_Y);
      lg.addColorStop(0, 'rgba(255,255,255,0.02)');
      lg.addColorStop(1, 'rgba(255,255,255,0.07)');
      ctx.fillStyle = lg;
      ctx.fillRect(x + 2, 0, laneW - 4, H);
      ctx.fillStyle = col + '22';
      if (t - press[i] < 0.12) ctx.fillRect(x + 2, 0, laneW - 4, HIT_Y + 20);
    }
    // hit line
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(20, HIT_Y - 1.5, W - 40, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(20, HIT_Y - 9, W - 40, 18);
    // notes
    for (const n of notes) {
      if (n.state === 'perfect' || n.state === 'good' || n.state === 'ok') continue;
      const y = HIT_Y - ((n.t - t) / fall) * (HIT_Y - TOP_Y);
      if (y < TOP_Y - 20 || y > H + 20) continue;
      const x = laneX(n.lane) + 6;
      const w = laneW - 12;
      const col = colors[n.lane % colors.length];
      ctx.globalAlpha = n.state === 'miss' ? clamp(1 - (t - n.at) * 2.5) * 0.7 : 1;
      ctx.fillStyle = n.state === 'miss' ? '#f08b7e' : col;
      roundRect(ctx, x, y - 11, w, 22, 6);
      ctx.fill();
      if (n.state !== 'miss') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(ctx, x + 4, y - 8, w - 8, 5, 3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // hit effects
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const age = t - f.born;
      if (age > 0.6) { fx.splice(i, 1); continue; }
      const cx = laneX(f.lane) + laneW / 2;
      if (f.kind !== 'miss' && !g.reduced) {
        ctx.strokeStyle = colors[f.lane % colors.length];
        ctx.globalAlpha = clamp(1 - age / 0.4);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, HIT_Y, 10 + age * 80, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = clamp(1 - age / 0.6);
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.kind === 'perfect' ? '#ffe28a' : f.kind === 'good' ? '#7fe0c0' : f.kind === 'ok' ? '#cfd6d8' : '#f08b7e';
      ctx.fillText(f.kind === 'perfect' ? 'เป๊ะ' : f.kind === 'good' ? 'ดี' : f.kind === 'ok' ? 'พอใช้' : 'พลาด', cx, HIT_Y - 26 - (g.reduced ? 0 : age * 26));
      ctx.globalAlpha = 1;
    }
    // countdown at the start
    if (t < 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '700 40px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(-t)), W / 2, 140);
    }
  }

  g.onStart(() => {
    tStart = performance.now() + 1500; // 1.5 s "3 2 1" before time 0
    // the chart starts at lead 2.4 s so the first notes are already visible while counting
    stop = g.loop(() => {
      const t = now();
      for (const n of notes) {
        if (n.state === 'wait' && t - n.t > win.ok) judge(n, 'miss', t);
      }
      draw(t);
      if (t > endAt && judged >= notes.length) {
        if (stop) stop();
        g.finish(sumW / notes.length, { perfect: counts.perfect, good: counts.good, ok: counts.ok, miss: counts.miss, combo: best });
      }
    });
  });
  draw(-1.5);
  const inner = g.destroy;
  g.destroy = () => { if (stop) stop(); inner(); };
  return { destroy: () => g.destroy() };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

