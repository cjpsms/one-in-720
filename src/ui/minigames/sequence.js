// Mini game "sequence" (CONTRACT3 section 5): put story clips in the right order (video editing, stall menu order).
// Drag a card, or tap one card then another to swap them, or use the keyboard (Enter picks up, arrows move).
// Score = share of clips in the correct position.
import { shell, el, clamp, keyOk, rngFor } from './timing.js';

export const INFO = {
  id: 'sequence',
  title: 'เรียงคลิปให้เป็นเรื่อง',
  how: 'เรียงคลิปจากต้นเรื่องไปท้ายเรื่อง ลากการ์ดไปวาง หรือแตะการ์ดสองใบเพื่อสลับกัน (คีย์บอร์ด: Enter หยิบ แล้วกดลูกศรเลื่อน) เสร็จแล้วกดส่งงาน',
};

const DEFAULT_CLIPS = [
  { id: 'c1', label: 'ฉากเปิด: ป้ายชื่อรุ่นขึ้นจอ', order: 1 },
  { id: 'c2', label: 'เพื่อนๆ เดินเข้าห้องซ้อม', order: 2 },
  { id: 'c3', label: 'ซ้อมบทครั้งแรก ผิดพลาดตลก', order: 3 },
  { id: 'c4', label: 'ช่วยกันแก้ฉากหลังเวที', order: 4 },
  { id: 'c5', label: 'คืนแสดงจริง ผู้ชมปรบมือ', order: 5 },
  { id: 'c6', label: 'ฉากปิด: ถ่ายรูปหมู่ร่วมกัน', order: 6 },
];
const ROW = 62; // card height 54 + gap 8

function readClips(spec) {
  const p = (spec && spec.params) || {};
  let clips = Array.isArray(p.clips) && p.clips.length >= 2 ? p.clips : DEFAULT_CLIPS;
  clips = clips.slice(0, 8).map((c, i) => ({ id: String(c.id != null ? c.id : `c${i}`), label: String(c.label || `คลิป ${i + 1}`), order: Number.isFinite(c.order) ? c.order : i + 1, i }));
  const sorted = clips.slice().sort((a, b) => a.order - b.order || a.i - b.i);
  const rank = {};
  sorted.forEach((c, i) => { rank[c.id] = i; });
  return { clips, rank, label: p.label || 'ตัดต่อวิดีโอ' };
}

const correctCount = (arr, rank) => arr.reduce((n, c, i) => n + (rank[c.id] === i ? 1 : 0), 0);

function shuffled(spec, clips, rank) {
  const rng = rngFor(spec, 0x5e9);
  let arr = clips.slice();
  for (let tries = 0; tries < 20; tries++) {
    arr = rng.shuffle(clips.slice());
    if (correctCount(arr, rank) <= Math.floor(clips.length / 3)) break;
  }
  return arr;
}

export function bot(spec, rng) {
  const { clips } = readClips(spec);
  const n = clips.length;
  const d = clamp(spec && spec.difficulty != null ? spec.difficulty : 0.5);
  const s = clamp(0.84 - 0.34 * d + rng.gauss() * 0.1, 0.05, 1);
  return clamp(Math.round(s * n) / n);
}

export function play(container, spec, done) {
  const g = shell(container, spec, INFO, bot, done);
  const { clips, rank, label } = readClips(spec);
  const n = clips.length;
  const dur = clamp(Number.isFinite(spec && spec.durationSec) ? spec.durationSec : 30, 15, 40);
  g.root.querySelector('.mg2-label').textContent = label;
  let arr = shuffled(spec, clips, rank);
  let selected = null; // clip id picked up
  let locked = false;
  let drag = null;
  let t = 0;
  let stop = null;

  const stage = el('div', 'mg2-sq');
  const hud = el('div', 'mg2-sq-hud');
  const hint = el('span', 'mg2-sq-hint', 'ต้นเรื่อง');
  const timeEl = el('span', 'mg2-sq-time', `${dur} วินาที`);
  hud.append(hint, timeEl);
  const bar = el('div', 'mg2-sq-bar');
  const barFill = el('i');
  bar.appendChild(barFill);
  const list = el('div', 'mg2-sq-list');
  list.setAttribute('role', 'list');
  list.style.height = `${n * ROW - 8}px`;
  const tail = el('div', 'mg2-sq-tail', 'ท้ายเรื่อง');
  const submit = el('button', 'btn primary mg2-sq-submit', 'ส่งงานตัดต่อ');
  submit.type = 'button';
  stage.append(hud, bar, list, tail, submit);
  g.body.appendChild(stage);

  const cards = new Map();
  clips.forEach((c, k) => {
    const card = el('div', 'mg2-sq-card');
    card.setAttribute('role', 'listitem');
    card.tabIndex = 0;
    card.dataset.id = c.id;
    const hue = (k * 67 + (((spec && spec.seed) | 0) % 360) + 360) % 360;
    const num = el('span', 'mg2-sq-num', '');
    const thumb = el('span', 'mg2-sq-thumb');
    thumb.style.background = `linear-gradient(135deg, hsl(${hue} 45% 32%), hsl(${(hue + 50) % 360} 50% 22%))`;
    thumb.appendChild(el('i', 'mg2-sq-play'));
    const txt = el('span', 'mg2-sq-txt', c.label);
    const grip = el('span', 'mg2-sq-grip');
    grip.setAttribute('aria-hidden', 'true');
    card.append(num, thumb, txt, grip);
    list.appendChild(card);
    cards.set(c.id, { card, num });
  });

  function render() {
    arr.forEach((c, i) => {
      const o = cards.get(c.id);
      o.num.textContent = String(i + 1);
      o.card.setAttribute('aria-label', `ลำดับที่ ${i + 1} ${c.label}${selected === c.id ? ' กำลังหยิบ' : ''}`);
      o.card.classList.toggle('is-sel', selected === c.id);
      if (!(drag && drag.id === c.id && drag.moved)) o.card.style.transform = `translateY(${i * ROW}px)`;
    });
  }
  function swap(a, b) {
    const i = arr.findIndex((c) => c.id === a);
    const j = arr.findIndex((c) => c.id === b);
    if (i < 0 || j < 0) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  function moveTo(id, to) {
    const i = arr.findIndex((c) => c.id === id);
    if (i < 0 || to === i) return;
    const [c] = arr.splice(i, 1);
    arr.splice(clamp(to, 0, n - 1), 0, c);
  }

  // ---- pointer: drag or tap-to-swap
  g.on(list, 'pointerdown', (e) => {
    if (!g.started || locked) return;
    const card = e.target.closest('.mg2-sq-card');
    if (!card) return;
    const id = card.dataset.id;
    const i = arr.findIndex((c) => c.id === id);
    drag = { id, card, pid: e.pointerId, y0: e.clientY, top0: i * ROW, moved: false };
    try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });
  g.on(list, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; drag.card.classList.add('is-drag'); }
    if (!drag.moved) return;
    const top = clamp(drag.top0 + dy, 0, (n - 1) * ROW);
    drag.card.style.transform = `translateY(${top}px)`;
    const to = clamp(Math.round(top / ROW), 0, n - 1);
    const cur = arr.findIndex((c) => c.id === drag.id);
    if (to !== cur) { moveTo(drag.id, to); render(); }
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag;
    drag = null;
    d.card.classList.remove('is-drag');
    if (!d.moved) {
      // a tap: pick up, put down, or swap with the picked card
      if (selected == null) selected = d.id;
      else if (selected === d.id) selected = null;
      else { swap(selected, d.id); selected = null; }
    } else selected = null;
    render();
    g.say(`ลำดับตอนนี้ ${arr.map((c) => c.label).join(', ')}`);
  };
  g.on(list, 'pointerup', end);
  g.on(list, 'pointercancel', end);

  // ---- keyboard
  g.on(list, 'keydown', (e) => {
    if (!g.started || locked || !keyOk(g, e)) return;
    const card = e.target.closest && e.target.closest('.mg2-sq-card');
    if (!card) return;
    const id = card.dataset.id;
    const i = arr.findIndex((c) => c.id === id);
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (selected == null) selected = id;
      else if (selected === id) selected = null;
      else { swap(selected, id); selected = null; }
      render();
    } else if (e.code === 'Escape') {
      selected = null; render();
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const to = clamp(i + (e.code === 'ArrowUp' ? -1 : 1), 0, n - 1);
      if (selected === id) { moveTo(id, to); render(); g.say(`ย้ายไปลำดับที่ ${to + 1}`); }
      else { const nid = arr[to].id; cards.get(nid).card.focus({ preventScroll: true }); }
    }
  });

  function doSubmit(timeout) {
    if (locked || g.finished) return;
    locked = true;
    selected = null;
    if (stop) stop();
    const ok = correctCount(arr, rank);
    // reveal: right or wrong per card
    arr.forEach((c, i) => cards.get(c.id).card.classList.add(rank[c.id] === i ? 'is-right' : 'is-wrong'));
    render();
    submit.disabled = true;
    hint.textContent = (timeout ? 'หมดเวลา ' : '') + `ถูก ${ok} จาก ${n}`;
    g.later(() => g.finish(ok / n, { correct: ok, total: n }), g.reduced ? 800 : 1200);
  }
  g.on(submit, 'click', () => doSubmit(false));

  render();
  g.onStart(() => {
    const first = cards.get(arr[0].id).card;
    first.focus({ preventScroll: true });
    stop = g.loop((dt) => {
      t += dt;
      const left = Math.max(0, dur - t);
      timeEl.textContent = `${Math.ceil(left)} วินาที`;
      barFill.style.width = `${(1 - left / dur) * 100}%`;
      if (left <= 0) doSubmit(true);
    });
  });
  const inner = g.destroy;
  g.destroy = () => { if (stop) stop(); inner(); };
  return { destroy: () => g.destroy() };
}
