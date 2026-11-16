// Birth flow: the room roll (flipping value), then the birth registration card with a share-PNG button.
import { h, reducedMotion } from './dom.js';
import { mountDots } from './dots.js';
import { drawBirthCard, downloadCanvas } from './cards.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function playRoll(view) {
  const me = view.me || {};
  const grade = me.grade || 1;
  const grades = (view.schoolMap && view.schoolMap.grades) || [];
  const rooms = (grades.find((g) => g.grade === grade) || { rooms: [30, 30, 30, 30] }).rooms;
  const total = rooms.reduce((a, b) => a + b, 0);
  const odds = view.birth && view.birth.roomOdds ? view.birth.roomOdds * 100 : ((rooms[(me.room || 1) - 1] || rooms[0]) / total) * 100;
  const big = h('div', { class: 'big', 'aria-live': 'off' });
  const oddsEl = h('div', { class: 'odds' });
  const overlay = h('div', { class: 'roll', role: 'status', 'aria-label': 'กำลังสุ่มห้องเรียนของคุณ' },
    h('div', null, h('div', { class: 'label', text: 'กำลังสุ่มห้องเรียนของคุณ' }), big, oddsEl));
  document.body.append(overlay);
  const final = `ม.${grade}/${me.room || 1}`;
  if (reducedMotion()) {
    big.textContent = final; oddsEl.textContent = `โอกาส: ${odds.toFixed(1)}%`;
    await sleep(900);
  } else {
    // flip through the rooms, slowing down, then land on the real one
    let wait = 60; let i = (me.room || 1) + 1;
    const steps = 22;
    for (let s = 0; s < steps; s++) {
      const r = s === steps - 1 ? (me.room || 1) : (i++ % rooms.length) + 1;
      big.textContent = `ม.${grade}/${r}`;
      const rr = rooms[r - 1] || rooms[0];
      oddsEl.textContent = `โอกาส: ${((rr / total) * 100).toFixed(1)}%`;
      await sleep(wait);
      wait = Math.min(260, wait * 1.12);
    }
    oddsEl.textContent = `โอกาส: ${odds.toFixed(1)}%`;
    await sleep(900);
  }
  overlay.remove();
}

const LATIN = 'ABCDEFGHJKLMNPRSTUVWXYZ';
function mrz(reg, view) {
  const me = view.me || {};
  const pad = (s) => (s + '<'.repeat(36)).slice(0, 36);
  const digits = String(reg || '').replace(/\D/g, '');
  let a = 0; for (const ch of digits) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  const letters = Array.from({ length: 8 }, (_, i) => LATIN[(a >>> (i * 3)) % LATIN.length]).join('');
  return [pad(`R<720<<${letters}<<${digits.slice(-6)}`), pad(`${digits.slice(-4)}<${me.grade || 1}${me.room || 1}${me.sex === 'ชาย' ? 'M' : 'F'}<720<<${digits}`)];
}

export function showBirthCard(env, view, introPending, onStart) {
  const { view: root, bar } = env.els;
  const me = view.me || {};
  const birth = view.birth || {};
  const rows = introPending && introPending.card && Array.isArray(introPending.card.rows) && introPending.card.rows.length
    ? introPending.card.rows.map(([l, v]) => [String(l), String(v)])
    : [['เพศ', me.sex || '-'], ['ห้องเรียน', `ม.${me.grade || 1}/${me.room || 1}`], ['หอพัก', [me.dormName, me.dormRoom].filter(Boolean).join(' ') || '-']];
  const wide = new Set(['หอพัก', 'เพื่อนร่วมห้องนอน']);
  const dl = h('dl', { class: 'reg-grid' }, rows.map(([l, v]) => h('div', { class: wide.has(l) ? 'wide' : '' }, h('dt', { text: l }), h('dd', { text: v }))));
  const m = mrz(birth.regNo, view);
  const dotsBox = h('div', { class: 'reg-dots' });
  root.textContent = '';
  root.append(h('div', { class: 'page' },
    h('section', { class: 'reg', 'aria-labelledby': 'reg-title' },
      h('div', { class: 'reg-head' }, h('h2', { id: 'reg-title', text: 'ทะเบียนแรกเข้า' }), h('div', { class: 'no', text: `No. ${birth.regNo || '720-0000-000000'}` })),
      h('div', { class: 'reg-body' },
        h('div', { class: 'label', text: 'ชื่อ' }),
        h('div', { class: 'reg-name', text: me.name || '' }),
        h('p', { class: 'reg-sentence', text: birth.sentence || 'คุณเป็นหนึ่งใน 720 คนของโรงเรียนประจำแห่งนี้' }),
        h('p', { class: 'reg-note', text: 'หนึ่งวันในโรงเรียนใช้เวลาราว 10 วินาที (ที่ความเร็ว 1×) เร่งความเร็วหรือข้ามวันได้ หากปิดหน้านี้ ชีวิตจะถูกเก็บไว้ในเบราว์เซอร์นี้และเล่นต่อได้' }),
        dl,
        dotsBox,
        h('div', { class: 'reg-mrz', 'aria-hidden': 'true' }, h('div', { text: m[0] }), h('div', { text: m[1] }))))));
  const dots = mountDots(dotsBox, { schoolMap: view.schoolMap, me, hasMe: true, padTop: 14, padBottom: 4 });

  bar.textContent = '';
  const shareBtn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    shareBtn.disabled = true;
    try {
      const c = drawBirthCard({ name: me.name, regNo: birth.regNo, sentence: birth.sentence, rows, schoolMap: view.schoolMap, me });
      const ok = await downloadCanvas(c, `1-in-720-${birth.regNo || 'card'}.png`);
      env.toast(ok ? 'บันทึกการ์ดเป็นรูป PNG แล้ว' : 'สร้างรูปการ์ดไม่สำเร็จ');
    } catch (e) { console.warn(e); env.toast('สร้างรูปการ์ดไม่สำเร็จ'); }
    shareBtn.disabled = false;
  } }, 'แชร์การ์ด');
  const startBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { startBtn.disabled = true; onStart(); } }, 'เริ่มชีวิตนี้');
  bar.append(shareBtn, startBtn);
  bar.hidden = false;
  window.scrollTo(0, 0);
  return { destroy() { dots.destroy(); } };
}
