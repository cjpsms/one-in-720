// Landing page: dot picture of the school, ON AIR chip, pitch, odds, sticky bottom buttons.
import { h, getPrefs, setPref, reducedMotion } from './dom.js';
import { icon } from './icons.js';
import { mountDots } from './dots.js';
import { schoolMapFor } from './mock-routine.js';

export function showLanding(env) {
  const { view: root, bar } = env.els;
  root.textContent = '';
  const map = schoolMapFor(null);
  const mapWrap = h('div', { class: 'map-wrap' });
  const dots = mountDots(mapWrap, { schoolMap: map, hasMe: false, padTop: 44, padBottom: 40 });
  const themeBtn = h('button', { type: 'button', class: 'round-btn', 'aria-label': 'สลับโหมดสว่าง / มืด (คมชัด)', onclick: () => { setPref('theme', getPrefs().theme === 'light' ? 'dark' : 'light'); dots.redraw(); } }, icon('contrast', 22));
  const menuBtn = h('button', { type: 'button', class: 'round-btn', 'aria-label': 'เมนู', onclick: () => env.openMenu() }, icon('dots', 22));
  mapWrap.append(h('div', { class: 'top-tools' }, themeBtn, menuBtn));

  const count = h('b', { text: '720' });
  const onair = h('div', { class: 'onair' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'tag', text: 'ON AIR' }),
    h('span', { class: 'live' }, 'ตอนนี้มีนักเรียน ', count, ' คนในโรงเรียนนี้'));
  if (!reducedMotion()) { // counter counts up once, like a live number
    const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / 1100); count.textContent = String(Math.round(720 * (1 - (1 - k) ** 3))); if (k < 1 && count.isConnected) requestAnimationFrame(step); };
    count.textContent = '0'; requestAnimationFrame(step);
  }

  const keepCount = env.keepCount();
  const keepBtn = h('button', { type: 'button', class: 'btn teal', onclick: () => env.openKeep() }, icon('image', 20), 'ของที่ระลึก', keepCount ? ` (${keepCount})` : '', icon('chevron', 16));

  const grade1 = (map.grades[0] && map.grades[0].rooms) || [30, 30, 30, 30];
  const total1 = grade1.reduce((a, b) => a + b, 0);
  const oddsRows = grade1.map((n, i) => {
    const p = Math.round((n / total1) * 1000) / 10;
    return h('div', { class: 'orow' }, h('span', { text: `ม.1/${i + 1}` }), h('div', { class: 'ob', 'aria-hidden': 'true' }, h('i', { style: `width:${p * 3}%` })), h('span', { class: 'pc', text: `${p}%` }));
  });
  const p1 = Math.round((grade1[0] / total1) * 100);

  const modeBtns = [['routine', 'กิจวัตร (แนะนำ)'], ['detailed', 'ละเอียด']].map(([v, t]) => {
    const b = h('button', { type: 'button', text: t, 'aria-pressed': String(getPrefs().mode === v), onclick: () => { setPref('mode', v); modeBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(i === (v === 'routine' ? 0 : 1)))); } });
    return b;
  });
  const meta = env.last();
  const resume = h('section', { class: 'resume-panel', hidden: true, role: 'alert' },
    h('p', { text: meta ? `ชีวิตของ ${meta.name} (${meta.label}) ยังเล่นอยู่ ถ้าเริ่มใหม่ ชีวิตนั้นจะหายไป` : 'มีชีวิตที่ยังเล่นไม่จบ ถ้าเริ่มใหม่ ชีวิตนั้นจะหายไป' }),
    h('button', { type: 'button', class: 'btn primary block', onclick: () => env.continueLife() }, 'กลับไปชีวิตนั้น'),
    h('button', { type: 'button', class: 'btn block', onclick: () => env.startNew() }, 'เริ่มใหม่อยู่ดี'));

  root.append(h('div', { class: 'landing' },
    mapWrap, onair,
    h('div', { class: 'row-keep' }, keepBtn),
    h('div', { class: 'land-body' },
      h('p', { class: 'eyebrow', text: 'v0.1 ทดลอง · เกมจำลองชีวิตโรงเรียนประจำ · เล่นฟรี · เซฟเก็บในเครื่องนี้เท่านั้น' }),
      h('h1', { class: 'title' }, h('span', { class: 'one', text: '1' }), ' ใน 720'),
      h('p', { class: 'pitch', text: 'โรงเรียนประจำแห่งนี้มีนักเรียน 720 คน คุณจะเกิดใหม่เป็นหนึ่งในนั้น แล้วใช้ชีวิตหกปีเต็มตั้งแต่ ม.1 ถึง ม.6 ตื่นเช้า เข้าแถว เรียน กินข้าวโรงอาหาร ไปจนถึงไฟดับในหอ จะได้ห้องไหน อยู่ห้องนอนกับใคร ครอบครัวมีเงินแค่ไหน คุณเลือกไม่ได้ เหมือนที่เราเลือกไม่ได้จริงๆ' }),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('b', { text: '720' }), h('span', { text: 'นักเรียนในโรงเรียน' })),
        h('div', { class: 'fact' }, h('b', { text: '6' }), h('span', { text: 'ปี ตั้งแต่ ม.1 ถึง ม.6' })),
        h('div', { class: 'fact' }, h('b', { text: `${p1}%` }), h('span', { text: 'โอกาสเกิดห้อง ม.1/1' })),
        h('div', { class: 'fact' }, h('b', { text: '10 วินาที' }), h('span', { text: 'ต่อหนึ่งวันในโรงเรียน ที่ความเร็ว 1× เร่งหรือข้ามได้' }))),
      h('section', { class: 'card odds-card' },
        h('h2', { text: 'ถ้าคุณเป็นเด็ก ม.1 ที่เพิ่งเข้าโรงเรียน' }),
        h('p', { class: 'sub', text: 'ห้องแรกสุ่มตามจำนวนนักเรียนในห้อง หลังจากนั้นห้องจะถูกจัดใหม่ทุกปีตามเกรดเฉลี่ย' }),
        oddsRows),
      h('section', { class: 'card odds-card' },
        h('h2', { text: 'ตั้งกิจวัตร แล้วดูชีวิตเดินไป' }),
        h('p', { class: 'sub', text: 'คุณตั้ง "โฟกัสของเทอม" ว่าจะเรียนแค่ไหน กินแบบไหน ค่ำนี้ทำอะไร แล้วนั่งดูโรงเรียนเดินไปทีละวัน หยุดถามเฉพาะเรื่องที่สำคัญ เช่น เพื่อนขอยืมเงิน ครูสลิ้งแตก หรือประตูขึ้น ม.4 ที่ไม่ใช่ทุกคนจะผ่าน' })),
      h('section', { class: 'card odds-card' },
        h('h2', { text: 'เลือกวิธีเล่น' }),
        h('p', { class: 'sub', text: 'โหมดกิจวัตร: ตั้งโฟกัสแล้วนั่งดูทีละวัน ตื่น กินข้าว เข้าเรียน ค่ำที่หอ มีช่วงพักสรุปทุกสัปดาห์ เร่งหรือข้ามได้ โหมดละเอียด: เลือกเองทุกมื้อ ทุกคาบ ทุกค่ำ ใช้กับชีวิตใหม่' }),
        h('div', { class: 'seg-row', role: 'group', 'aria-label': 'โหมดการเล่น' }, modeBtns)),
      h('p', { class: 'disclaimer', text: 'ตัวละครและเหตุการณ์ในเกมเป็นเรื่องสมมติ ตัวเลขบางอย่างเป็นค่าทดลองที่ยังปรับอยู่ ไม่มีรูปหรือฟอนต์จากภายนอก ทุกภาพวาดด้วยโค้ดในหน้านี้' }))));

  bar.textContent = '';
  const hasSave = env.hasSave();
  if (hasSave) bar.append(h('button', { type: 'button', class: 'btn', onclick: () => env.continueLife() }, h('span', { class: 'two' }, 'เล่นต่อ', meta && meta.label ? h('small', { text: `${meta.name} · ${meta.label}` }) : null)));
  bar.append(h('button', { type: 'button', class: 'btn primary', onclick: () => { if (hasSave) { resume.hidden = false; resume.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); } else env.startNew(); } }, 'เริ่มชีวิต'));
  bar.hidden = false;
  // resume panel sits above the pitch so it is seen on "start"
  root.querySelector('.landing').insertBefore(resume, root.querySelector('.row-keep'));
  return { destroy() { dots.destroy(); } };
}
