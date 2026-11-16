// Mini game "pattern": watch a row of beads appear, then rebuild it from memory; each cleared round adds a bead
// (CONTRACT3 section 5).
import { mount, h, clamp, botScore, digitIndex } from './kit.js';

export const INFO = {
  id: 'pattern',
  title: 'ร้อยลูกปัด',
  how: 'ดูลูกปัดที่ปรากฏทีละเม็ด จำลำดับให้ได้ แล้วแตะสีให้ตรงตามลำดับ ผ่านแต่ละรอบจะยาวขึ้นหนึ่งเม็ด',
};

export function bot(spec, rng) { return botScore(spec, rng, 0.68, 0.12); }

const SHAPES = ['circle', 'square', 'diamond', 'tri', 'hex', 'star'];
const FALL = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0', '#b07ad8'];

function norm(p) {
  p = p || {};
  const beads = (Array.isArray(p.beads) && p.beads.length >= 3 ? p.beads : FALL).slice(0, 6).map(String);
  return { beads, rounds: clamp(Math.round(Number(p.rounds) || 4), 1, 8), startLen: clamp(Math.round(Number(p.startLen) || 3), 2, 6), label: String(p.label || 'ร้อยกำไลข้อมือ') };
}

export function play(container, spec, done) {
  const P = norm(spec && spec.params);
  return mount(container, spec, INFO, done, (g) => {
    const beadEl = (i, c) => h('i', { class: `mg-p-bead sh-${SHAPES[i % SHAPES.length]}${c ? '' : ' empty'}`, style: c ? `--c:${P.beads[i]}` : '' });
    const row = h('div', { class: 'mg-p-row', 'aria-hidden': 'true' });
    const msg = h('div', { class: 'mg-p-msg', 'aria-live': 'polite' });
    const pal = h('div', { class: 'mg-p-pal', role: 'group', 'aria-label': 'สีลูกปัด' }, P.beads.map((c, i) => h('button', {
      type: 'button', class: 'mg-p-pick', 'aria-label': `ลูกปัดสีที่ ${i + 1}`, disabled: true, onclick: () => tap(i),
    }, beadEl(i, true), h('small', { class: 'mono', text: String(i + 1) }))));
    g.stage.append(h('div', { class: 'mg-p-label', text: P.label }), row, msg, pal);

    let round = 0; let cleared = 0; let len = P.startLen; let seq = []; let pos = 0; let mode = 'idle';
    const picks = [...pal.querySelectorAll('button')];

    function slots(n) { row.replaceChildren(...Array.from({ length: n }, () => h('span', { class: 'mg-p-slot' }))); }
    function setBead(i, ci, cls) {
      const slot = row.children[i]; if (!slot) return;
      slot.replaceChildren(beadEl(ci, true)); slot.className = `mg-p-slot full${cls ? ' ' + cls : ''}`;
    }
    function enable(on) { picks.forEach((b) => { b.disabled = !on; }); }

    function newRound() {
      round++;
      seq = Array.from({ length: len }, () => g.rng.int(0, P.beads.length - 1));
      pos = 0; mode = 'show'; enable(false); slots(len);
      g.hud(`รอบ ${round} / ${P.rounds}`, `ผ่านแล้ว ${cleared}`);
      msg.textContent = 'ดูให้ดี';
      let i = 0;
      const step = () => {
        if (!g.alive) return;
        if (i < len) { setBead(i, seq[i], 'pop'); i++; g.timeout(step, 620); return; }
        g.timeout(() => { slots(len); mode = 'input'; msg.textContent = 'ถึงตาคุณแล้ว ใส่ลูกปัดตามลำดับ'; enable(true); }, 700);
      };
      g.timeout(step, 500);
    }
    function nextOrEnd(ok) {
      if (ok) { cleared++; len++; }
      if (round >= P.rounds) { g.timeout(end, 600); return; }
      g.timeout(newRound, 900);
    }
    function tap(ci) {
      if (mode !== 'input' || !g.alive) return;
      if (ci === seq[pos]) {
        setBead(pos, ci, 'pop'); pos++;
        if (pos >= len) { mode = 'done'; enable(false); msg.textContent = 'ถูกต้อง สร้อยยาวขึ้นอีกเม็ด'; msg.className = 'mg-p-msg good'; nextOrEnd(true); }
      } else {
        mode = 'done'; enable(false); msg.textContent = 'ผิดลำดับ ดูลำดับที่ถูกต้อง'; msg.className = 'mg-p-msg bad';
        const slot = row.children[pos]; if (slot) { slot.replaceChildren(beadEl(ci, true)); slot.className = 'mg-p-slot full wrong'; }
        g.timeout(() => { seq.forEach((c, i) => setBead(i, c, i === pos ? 'right' : '')); }, 700);
        nextOrEnd(false);
        return;
      }
      msg.className = 'mg-p-msg';
    }
    function end() {
      const score = clamp(cleared / P.rounds, 0, 1);
      g.finish(score, { cleared, rounds: P.rounds, longest: cleared ? P.startLen + cleared - 1 : 0 }, `ผ่าน ${cleared} จาก ${P.rounds} รอบ สร้อยยาวที่สุดที่ทำได้ ${cleared ? P.startLen + cleared - 1 : 0} เม็ด`);
    }
    g.on(document, 'keydown', (e) => { const i = digitIndex(e); if (i >= 0 && i < P.beads.length) { e.preventDefault(); tap(i); } });
    slots(P.startLen);
    g.hud(`รอบ 1 / ${P.rounds}`, 'ผ่านแล้ว 0');
    g.ready(() => { msg.className = 'mg-p-msg'; newRound(); }, 'คีย์บอร์ด: เลข 1-5 = สีลูกปัด');
  });
}
