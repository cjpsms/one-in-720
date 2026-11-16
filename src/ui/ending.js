// Ending page: life summary in the same registration-card style, best / worst moments, share PNG, new life.
import { h, shortYear } from './dom.js';
import { mountDots } from './dots.js';
import { drawEndingCard, downloadCanvas } from './cards.js';

function pickMoments(record, view) {
  const starred = record.starredOfLife().map((k) => ({ label: k.yearLabel, text: k.text, tone: k.tone, star: true }));
  const lines = record.lines.map((l) => ({ label: l.yearLabel, text: l.text, tone: l.tone }));
  const good = lines.filter((l) => l.tone === 'good').slice(-40);
  const bad = lines.filter((l) => l.tone === 'bad').slice(-40);
  const pickSpread = (arr, n) => (arr.length <= n ? arr : Array.from({ length: n }, (_, i) => arr[Math.floor((i * arr.length) / n)]));
  const out = [...starred.slice(0, 4)];
  const have = new Set(out.map((m) => m.text));
  for (const m of [...pickSpread(good, 2), ...pickSpread(bad, 2)]) if (out.length < 4 && !have.has(m.text)) { out.push(m); have.add(m.text); }
  return out;
}

export function showEnding(env, view, pending) {
  const { view: root, bar } = env.els;
  const me = view.me || {};
  const st = view.stats || {};
  const rooms = env.meta.rooms || {};
  const roomText = Object.keys(rooms).sort().map((g) => rooms[g]).join(' → ') || `ม.${me.grade || 1}/${me.room || 1}`;
  const rows = [
    ['เกรดเฉลี่ยสะสม', st.gpax ? Number(st.gpax).toFixed(2) : '-'],
    ['อันดับล่าสุด', me.rank && me.rankSize ? `${me.rank} จาก ${me.rankSize}` : '-'],
    ['ห้องแต่ละปี', roomText],
    ['เงินคงเหลือ', `${Math.round(st.money || 0).toLocaleString('en-US')} บาท`],
  ];
  const card = pending && pending.card && Array.isArray(pending.card.rows) ? pending.card.rows.map(([l, v]) => [String(l), String(v)]) : [];
  if (card.length) {
    rows.length = 0;
    rows.push(...card);
    if (!card.some((r) => /ห้อง/.test(r[0]))) rows.push(['ห้องแต่ละปี', roomText]);
    if (!card.some((r) => /เกรด/.test(r[0])) && st.gpax) rows.unshift(['เกรดเฉลี่ยสะสม', Number(st.gpax).toFixed(2)]);
  }
  const moments = pickMoments(env.record, view);
  const regNo = (view.birth && view.birth.regNo) || '';
  const title = (pending && pending.title) || 'จบชีวิตนักเรียน';
  const sub = (pending && pending.text) || '';
  const dotsBox = h('div', { class: 'reg-dots' });

  root.textContent = '';
  root.append(h('div', { class: 'page' },
    h('div', { class: 'label', text: 'ตอนจบ' }),
    h('h1', { class: 'end-title', text: title }),
    sub ? h('p', { class: 'end-sub', text: sub }) : null,
    h('section', { class: 'reg', 'aria-label': 'สรุปชีวิต' },
      h('div', { class: 'reg-head teal' }, h('h2', { text: 'บันทึกสุดท้าย' }), h('div', { class: 'no', text: `${me.name || ''}${regNo ? ' · ' + regNo : ''}` })),
      h('div', { class: 'reg-body' },
        h('dl', { class: 'reg-grid' }, rows.map(([l, v]) => h('div', { class: v.length > 22 ? 'wide' : '' }, h('dt', { text: l }), h('dd', { text: v })))),
        dotsBox)),
    h('section', { class: 'end-block' },
      h('h3', { text: 'ช่วงเวลาที่จำได้' }),
      moments.length
        ? h('ol', { class: 'moments' }, moments.map((m) => h('li', { class: `tone-${m.tone || 'neutral'}` }, h('span', { class: 'mk', text: shortYear(m.label) }), h('span', { text: m.text }))))
        : h('p', { class: 'muted', text: 'ยังไม่มีบรรทัดที่ติดดาวไว้ ครั้งหน้าลองแตะบรรทัดในบันทึกชีวิตเพื่อเก็บเป็นของที่ระลึก' }))));
  const dots = mountDots(dotsBox, { schoolMap: view.schoolMap, me, hasMe: true, padTop: 14, padBottom: 4 });

  bar.textContent = '';
  const shareBtn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    shareBtn.disabled = true;
    try {
      const c = drawEndingCard({ name: me.name, title, sentence: sub, rows, moments, schoolMap: view.schoolMap, me });
      const ok = await downloadCanvas(c, `1-in-720-ending-${regNo || 'card'}.png`);
      env.toast(ok ? 'บันทึกการ์ดจบชีวิตเป็นรูป PNG แล้ว' : 'สร้างรูปการ์ดไม่สำเร็จ');
    } catch (e) { console.warn(e); env.toast('สร้างรูปการ์ดไม่สำเร็จ'); }
    shareBtn.disabled = false;
  } }, 'แชร์การ์ดจบชีวิต');
  bar.append(shareBtn, h('button', { type: 'button', class: 'btn primary', onclick: () => env.startNew({ confirmed: true }) }, 'เริ่มชีวิตใหม่'));
  bar.hidden = false;
  window.scrollTo(0, 0);
  return { destroy() { dots.destroy(); } };
}
