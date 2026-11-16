// Mini game "steps" (CONTRACT3 section 5): a lab procedure. Pick the correct next step among 3,
// plus one timed pour / heat hold with a gauge. Score = (steps right + hold accuracy) / (steps + 1).
import { shell, el, clamp, keyOk, rngFor } from './timing.js';

export const INFO = {
  id: 'steps',
  title: 'ทำตามขั้นตอนการทดลอง',
  how: 'เลือกขั้นตอนถัดไปที่ถูกต้องจาก 3 ตัวเลือก (กดเลข 1-3 ได้) และตอนเท/ให้ความร้อน ให้กดค้างแล้วปล่อยตอนระดับถึงเส้นเป้าหมาย',
};

const DEFAULT = {
  title: 'ทดลองเตรียมสารละลาย',
  hazard: 'สารเคมีกระเด็น',
  steps: [
    { prompt: 'ก่อนเริ่มทดลอง ต้องทำอะไรเป็นอย่างแรก', choices: ['สวมแว่นตาและเสื้อกาวน์', 'เทสารลงบีกเกอร์ทันที', 'ชิมสารดูว่าเป็นอะไร'], answer: 0 },
    { prompt: 'จะตวงน้ำกลั่นให้ได้ปริมาตรแม่นยำ ใช้อะไร', choices: ['แท่งแก้วคน', 'กระบอกตวง', 'จุกยาง'], answer: 1 },
    { prompt: 'เทน้ำกลั่นลงบีกเกอร์ให้ถึงขีดที่กำหนด', choices: ['ค่อยๆ เท'], answer: 0, hold: { kind: 'pour', label: 'เทน้ำกลั่น' } },
    { prompt: 'เมื่อทดลองเสร็จ สารที่เหลือต้องทำอย่างไร', choices: ['เทลงอ่างล้างมือทั้งหมด', 'ใส่ภาชนะเก็บของเสียตามที่ครูกำหนด', 'ทิ้งไว้บนโต๊ะ'], answer: 1 },
  ],
};

function readSpec(spec) {
  const p = (spec && spec.params) || {};
  const src = Array.isArray(p.steps) && p.steps.length ? p : DEFAULT;
  const rng = rngFor(spec, 0x57e9);
  let holdIdx = -1;
  const steps = src.steps.slice(0, 8).map((s, i) => {
    let choices = Array.isArray(s.choices) && s.choices.length ? s.choices.map(String).slice(0, 4) : ['ทำต่อ'];
    let ans = typeof s.answer === 'number' ? s.answer : choices.indexOf(s.answer);
    if (!(ans >= 0 && ans < choices.length)) ans = 0;
    const right = choices[ans];
    // deterministic shuffle of the display order, the answer follows its text
    const order = rng.shuffle(choices.map((_, k) => k));
    const shown = order.map((k) => choices[k]);
    if (s.hold && holdIdx < 0) holdIdx = i;
    return { prompt: String(s.prompt || `ขั้นที่ ${i + 1}`), choices: shown, answer: shown.indexOf(right), right, hold: s.hold || null };
  });
  if (holdIdx < 0) { holdIdx = steps.length - 1; steps[holdIdx].hold = true; } // there is always one hold
  steps.forEach((s, i) => { if (i !== holdIdx) s.hold = null; });
  const h = steps[holdIdx].hold;
  const hs = typeof h === 'object' && h ? h : {};
  const text = `${src.title || ''} ${steps[holdIdx].prompt} ${hs.label || ''}`;
  const kind = hs.kind === 'heat' || hs.kind === 'pour' ? hs.kind : /ร้อน|อุ่น|ต้ม|เผา|ไฟ|ตะเกียง|ความร้อน/.test(text) ? 'heat' : 'pour';
  const hold = {
    idx: holdIdx,
    kind,
    label: hs.label || (kind === 'heat' ? 'ให้ความร้อน' : 'เทสาร'),
    target: clamp(Number.isFinite(hs.target) ? hs.target : 0.55 + rng.float() * 0.25, 0.3, 0.9),
    tol: clamp(Number.isFinite(hs.tolerance) ? hs.tolerance : 0.09, 0.04, 0.2),
    rate: kind === 'heat' ? 0.24 : 0.3,
  };
  return { title: src.title || 'การทดลอง', hazard: src.hazard || '', steps, hold };
}

export function holdScore(level, target, tol) {
  const d = Math.abs(level - target);
  return d <= tol ? 1 - 0.15 * (d / tol) : 0.85 * Math.max(0, 1 - (d - tol) / 0.3);
}

export function bot(spec, rng) {
  const S = readSpec(spec);
  const d = clamp(spec && spec.difficulty != null ? spec.difficulty : 0.5);
  let sum = 0;
  for (let i = 0; i < S.steps.length; i++) if (rng.chance(clamp(0.93 - 0.38 * d + rng.gauss() * 0.04, 0.2, 0.98))) sum++;
  sum += clamp(0.8 - 0.35 * d + rng.gauss() * 0.12);
  return clamp(sum / (S.steps.length + 1));
}

export function play(container, spec, done) {
  const g = shell(container, spec, INFO, bot, done);
  const S = readSpec(spec);
  const n = S.steps.length;
  g.root.querySelector('.mg2-label').textContent = S.title;

  const stage = el('div', 'mg2-st');
  const top = el('div', 'mg2-st-top');
  const stepLbl = el('span', 'mg2-st-step', '');
  const hazard = el('span', 'mg2-st-hazard', S.hazard ? `ระวัง: ${S.hazard}` : '');
  top.append(stepLbl, hazard);
  const dots = el('div', 'mg2-st-dots');
  const dotEls = [];
  for (let i = 0; i < n; i++) { const d = el('i', 'mg2-st-dot'); dotEls.push(d); dots.appendChild(d); }
  const card = el('div', 'mg2-st-card');
  const prompt = el('h3', 'mg2-st-prompt', '');
  const choicesEl = el('div', 'mg2-st-choices');
  const note = el('div', 'mg2-st-note', '');
  note.setAttribute('aria-live', 'polite');
  card.append(prompt, choicesEl, note);
  const holdBox = el('div', 'mg2-st-hold');
  holdBox.hidden = true;
  stage.append(top, dots, card, holdBox);
  g.body.appendChild(stage);

  let i = 0;
  let right = 0;
  let wrong = 0;
  let holdAcc = 0;
  let phase = 'idle'; // choose | hold | wait
  let stop = null;

  function showStep() {
    const s = S.steps[i];
    phase = 'choose';
    stepLbl.textContent = `ขั้นที่ ${i + 1} จาก ${n}`;
    dotEls.forEach((d, k) => d.classList.toggle('now', k === i));
    prompt.textContent = s.prompt;
    note.textContent = '';
    note.className = 'mg2-st-note';
    choicesEl.textContent = '';
    holdBox.hidden = true;
    card.hidden = false;
    s.choices.forEach((txt, k) => {
      const b = el('button', 'mg2-st-choice');
      b.type = 'button';
      b.append(el('span', 'mg2-st-key', String(k + 1)), el('span', 'mg2-st-ct', txt));
      b.setAttribute('aria-keyshortcuts', String(k + 1));
      g.on(b, 'click', () => choose(k));
      choicesEl.appendChild(b);
    });
    g.say(`ขั้นที่ ${i + 1} ${s.prompt}`);
  }

  function choose(k) {
    if (phase !== 'choose' || g.finished) return;
    phase = 'wait';
    const s = S.steps[i];
    const ok = k === s.answer;
    const btns = choicesEl.querySelectorAll('.mg2-st-choice');
    btns.forEach((b, idx) => {
      b.disabled = true;
      if (idx === s.answer) b.classList.add('is-right');
      else if (idx === k) b.classList.add('is-wrong');
    });
    if (ok) right++; else wrong++;
    dotEls[i].classList.remove('now');
    dotEls[i].classList.add(ok ? 'ok' : 'bad');
    note.className = `mg2-st-note ${ok ? 'good' : 'bad'}`;
    note.textContent = ok ? 'ถูกต้อง' : `ผิด ขั้นที่ถูกคือ "${s.right}"`;
    if (!ok && S.hazard) hazard.classList.add('hot');
    g.say(note.textContent);
    g.later(() => {
      if (i === S.hold.idx) startHold(); else next();
    }, ok ? (g.reduced ? 800 : 700) : 1500);
  }

  function next() {
    i++;
    if (i >= n) return finishAll();
    showStep();
  }

  function startHold() {
    phase = 'hold';
    const H = S.hold;
    card.hidden = true;
    holdBox.hidden = false;
    holdBox.textContent = '';
    holdBox.className = `mg2-st-hold ${H.kind}`;
    const ttl = el('div', 'mg2-st-hold-t', H.kind === 'heat' ? `${H.label}: กดค้างเพื่อเพิ่มความร้อน` : `${H.label}: กดค้างเพื่อเท`);
    const sub = el('div', 'mg2-st-hold-s', 'ปล่อยเมื่อระดับถึงเส้นเป้าหมาย');
    const gauge = el('div', 'mg2-st-gauge');
    gauge.setAttribute('role', 'img');
    gauge.setAttribute('aria-label', 'หลอดวัดระดับ เส้นเป้าหมายอยู่ประมาณ ' + Math.round(H.target * 100) + ' เปอร์เซ็นต์');
    const liquid = el('div', 'mg2-st-liquid');
    const zone = el('div', 'mg2-st-target');
    zone.style.bottom = `${(H.target - H.tol) * 100}%`;
    zone.style.height = `${H.tol * 2 * 100}%`;
    const line = el('div', 'mg2-st-line');
    line.style.bottom = `${H.target * 100}%`;
    const fx = el('div', 'mg2-st-fx');
    gauge.append(liquid, zone, line, fx);
    const val = el('div', 'mg2-st-val', '0%');
    const btn = el('button', 'btn primary mg2-st-hbtn', H.kind === 'heat' ? 'กดค้างเพื่อให้ความร้อน' : 'กดค้างเพื่อเท');
    btn.type = 'button';
    btn.setAttribute('aria-keyshortcuts', 'Space');
    const left = el('div', 'mg2-st-hold-time');
    const leftFill = el('i');
    left.appendChild(leftFill);
    holdBox.append(ttl, sub, el('div', 'mg2-st-hold-row', ''), left, btn);
    const row = holdBox.querySelector('.mg2-st-hold-row');
    row.append(gauge, val);

    let level = 0;
    let holding = false;
    let started = false;
    let idle = 0;
    let t = 0;
    const IDLE_LIMIT = 8;

    const finishHold = (forced) => {
      if (phase !== 'hold') return;
      phase = 'wait';
      holding = false;
      stopH();
      btn.disabled = true;
      holdAcc = holdScore(level, H.target, H.tol);
      const inside = Math.abs(level - H.target) <= H.tol;
      ttl.textContent = level >= 1 ? 'ล้นแล้ว!' : forced && !started ? 'หมดเวลา ยังไม่ได้เริ่ม' : inside ? 'ได้ระดับพอดี' : level < H.target ? 'ยังไม่ถึงเส้น' : 'เกินเส้นไป';
      sub.textContent = `แม่นยำ ${Math.round(holdAcc * 100)}%`;
      holdBox.classList.add(inside ? 'is-good' : 'is-bad');
      g.say(ttl.textContent);
      g.later(() => { holdBox.hidden = true; next(); }, g.reduced ? 1000 : 1300);
    };
    const press = () => { if (phase !== 'hold') return; holding = true; started = true; idle = 0; btn.classList.add('on'); holdBox.classList.add('active'); };
    const release = () => {
      if (!holding || phase !== 'hold') return;
      holding = false; btn.classList.remove('on'); holdBox.classList.remove('active');
      finishHold(false);
    };
    g.on(btn, 'pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ } press(); });
    g.on(btn, 'pointerup', release);
    g.on(btn, 'pointercancel', release);
    g.on(btn, 'lostpointercapture', release);
    g.on(btn, 'contextmenu', (e) => e.preventDefault());
    const kd = (e) => { if (e.code === 'Space' && keyOk(g, e) && phase === 'hold') { e.preventDefault(); if (!e.repeat) press(); } };
    const ku = (e) => { if (e.code === 'Space' && phase === 'hold') { e.preventDefault(); release(); } };
    g.on(document, 'keydown', kd);
    g.on(document, 'keyup', ku);

    const stopH = g.loop((dt) => {
      t += dt;
      if (holding) {
        // pours speed up a little as the level rises, which is what makes it tricky
        level = Math.min(1, level + dt * H.rate * (1 + 0.5 * level));
        if (level >= 1) { finishHold(false); return; }
      } else if (!started) {
        idle += dt;
        leftFill.style.width = `${(1 - idle / IDLE_LIMIT) * 100}%`;
        if (idle >= IDLE_LIMIT) finishHold(true);
      }
      liquid.style.height = `${level * 100}%`;
      val.textContent = `${Math.round(level * 100)}%`;
      if (started) leftFill.style.width = '100%';
    });
    void t;
  }

  function finishAll() {
    if (stop) stop();
    const score = (right + holdAcc) / (n + 1);
    g.finish(score, { right, wrong, steps: n, hold: Math.round(holdAcc * 100) });
  }

  g.onStart(() => { showStep(); });
  const inner = g.destroy;
  g.destroy = () => { if (stop) stop(); inner(); };
  g.on(document, 'keydown', (e) => {
    if (!g.started || phase !== 'choose' || !keyOk(g, e)) return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (m) { const k = Number(m[1]) - 1; if (k < S.steps[i].choices.length) { e.preventDefault(); choose(k); } }
  });
  return { destroy: () => g.destroy() };
}
