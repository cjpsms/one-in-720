// Rest-break page: week / term / year recap from view().recap (docs/CONTRACT2.md 5.1). Not a pending: the sheet shows it,
// "ต่อ..." continues the clock. Term and year pages also show the dot picture with your room.
import { h } from '../dom.js';
import { mountDots } from '../dots.js';

const MOOD = { up: ['อารมณ์ดีขึ้น', 'good'], flat: ['อารมณ์เท่าเดิม', ''], down: ['อารมณ์ตกลง', 'bad'] };
const NEXT = { week: 'ต่อสัปดาห์หน้า', term: 'ต่อเทอมหน้า', year: 'ต่อปีการศึกษาใหม่' };
const TITLE = { week: 'พักสักครู่', term: 'จบเทอมแล้ว', year: 'จบปีการศึกษา' };

// returns a cleanup function
export function render(container, recap, ctx) {
  container.textContent = '';
  const big = recap.kind !== 'week';
  const mood = MOOD[recap.mood] || MOOD.flat;
  const rows = Array.isArray(recap.rows) ? recap.rows : [];
  const hl = Array.isArray(recap.highlights) ? [...new Set(recap.highlights)] : [];
  const m = recap.money;
  const dotsBox = big ? h('div', { class: 'reg-dots', style: 'height:150px;margin:12px 0' }) : null;
  const go = h('button', { type: 'button', class: 'btn primary block', onclick: (ev) => { ev.currentTarget.disabled = true; ctx.onContinue(); } }, ctx.nextLabel || NEXT[recap.kind] || 'ต่อ');
  container.append(h('section', { class: `scene recap recap-${recap.kind}`, 'aria-labelledby': 'recap-title' },
    h('p', { class: 'scene-clock', text: TITLE[recap.kind] || 'สรุป' }),
    h('h2', { id: 'recap-title', class: 'scene-title', text: recap.label || '' }),
    h('p', null, h('span', { class: `chip mood ${mood[1]}`, text: mood[0] }), recap.gpa != null ? h('span', { class: 'chip', style: 'margin-left:6px' }, 'เกรด ', h('b', { text: Number(recap.gpa).toFixed(2) })) : null, recap.rank ? h('span', { class: 'chip', style: 'margin-left:6px' }, 'อันดับ ', h('b', { text: String(recap.rank) })) : null),
    hl.length ? h('ul', { class: 'recap-hl' }, hl.map((t) => h('li', { text: t }))) : null,
    dotsBox,
    rows.length ? h('div', { class: 'scene-box' }, h('dl', { class: 'rows' }, rows.map(([l, v]) => h('div', null, h('dt', { text: l }), h('dd', { text: v == null ? '' : String(v) }))))) : null,
    m ? h('p', { class: 'muted small', text: `เฉลี่ยวันละ ${Number(m.perDay || 0).toLocaleString('en-US')} บาท · ใช้ไป ${Number(m.spent || 0).toLocaleString('en-US')} บาท · เหลือ ${Number(m.left || 0).toLocaleString('en-US')} บาท` }) : null,
    ctx.autoNote ? h('p', { class: 'muted small', text: ctx.autoNote }) : null,
    h('div', { class: 'sticky-act' }, go)));
  let dots = null;
  if (dotsBox) dots = mountDots(dotsBox, { schoolMap: ctx.schoolMap, me: ctx.me, hasMe: true, padTop: 14, padBottom: 4 });
  return () => { if (dots) dots.destroy(); };
}
