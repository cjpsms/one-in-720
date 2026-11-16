// Reusable pieces of the life screen: scene card, four stat bars, life record, focus card.
import { h, fmtInt, clamp, shortYear } from './dom.js';
import { icon } from './icons.js';
import { mountScene, SCENE_W, SCENE_H } from './pixelscene.js';
import { FOCUS_FIELDS } from './focus-data.js';

export const STAT4 = [
  { key: 'health', label: 'สุขภาพ', color: 'var(--c-health)' },
  { key: 'happy', label: 'ความสุข', color: 'var(--c-happy)' },
  { key: 'know', label: 'ความรู้', color: 'var(--c-know)' },
  { key: 'bonds', label: 'เพื่อน', color: 'var(--c-bonds)' },
];

export function stats4Of(view) {
  if (view && view.stats4) return view.stats4;
  const s = (view && view.stats) || {};
  return { health: s.health || 0, happy: 100 - (s.stress || 0), know: s.knowledge || 0, bonds: ((s.peer || 0) + (s.teacherTrust || 0)) / 2 };
}
export function labelOf(view) {
  if (view && view.label) return view.label;
  const me = (view && view.me) || {}; const ck = (view && view.clock) || {};
  return `ม.${me.grade || ck.year || 1} เทอม ${ck.term || 1}`;
}

// ---------- scene card ----------
export function makeSceneCard() {
  const canvas = h('canvas', { width: SCENE_W, height: SCENE_H, role: 'img', 'aria-label': 'ภาพฉากโรงเรียนตอนนี้' });
  const cap = h('div', { class: 'scene-cap' });
  const el = h('section', { class: 'card scene-card' }, canvas, cap);
  const scene = mountScene(canvas);
  return {
    el,
    set({ kind, hour, seed, title, sub }) {
      scene.set({ kind, hour, seed: seed || 1 });
      cap.textContent = '';
      cap.append(title || '', sub ? h('small', { text: sub }) : null);
      canvas.setAttribute('aria-label', `ภาพฉาก ${title || ''}`);
    },
    destroy() { scene.destroy(); },
  };
}

// small floating +/- on a value (CSS animation; with reduced motion it just appears and is removed)
function floatDelta(el, delta, money) {
  const d = h('span', { class: `dl ${delta > 0 ? 'up' : 'down'}`, 'aria-hidden': 'true', text: `${delta > 0 ? '+' : '\u2212'}${Math.abs(delta)}` });
  el.append(d);
  setTimeout(() => d.remove(), 1400);
}

// ---------- day timeline ----------
export function makeDayCard() {
  const list = h('ol', { class: 'tl', 'aria-label': 'ตารางวันนี้' });
  const story = h('div', { class: 'tl-story', hidden: true, role: 'status' });
  const title = h('span', { class: 'label', text: '' });
  const el = h('section', { class: 'card day-card' }, h('div', { class: 'rec-head' }, h('h2', { text: 'วันนี้' }), title), list, story);
  return {
    el,
    update(view) {
      const day = view && view.day;
      if (!day || !Array.isArray(day.blocks)) { el.hidden = true; return; }
      el.hidden = false;
      title.textContent = day.label || '';
      list.textContent = '';
      let cur = null;
      day.blocks.forEach((b) => {
        const cls = b.current ? 'current' : b.done ? 'done' : 'next';
        const li = h('li', { class: `tl-item ${cls}${b.tone ? ' tone-' + b.tone : ''}`, 'aria-current': b.current ? 'step' : null },
          h('span', { class: 'tl-t', text: b.from }),
          h('div', { class: 'tl-b' }, h('div', { class: 'tl-w', text: b.what }), h('div', { class: 'tl-p', text: b.place }), b.done && b.detail ? h('div', { class: 'tl-d', text: b.detail }) : null));
        if (b.current) cur = li;
        list.append(li);
      });
      if (cur) list.scrollTop = Math.max(0, cur.offsetTop - 70);
    },
    setStory(text) { story.textContent = text; story.hidden = !text; },
  };
}

// ---------- stats ----------
export function makeStats() {
  const cells = STAT4.map((d) => {
    const v = h('div', { class: 'sv', text: '0' });
    const bar = h('i', { style: `width:0;background:${d.color}` });
    return { d, v, bar, el: h('div', { class: 'sbar', role: 'img', 'aria-label': d.label }, h('div', { class: 'sl', text: d.label }), v, h('div', { class: 'sb' }, bar)) };
  });
  const moneyChip = h('span', { class: 'chip' }, 'เงิน ', h('b', { text: '0' }), ' บาท');
  const gpaChip = h('span', { class: 'chip' }, 'เกรด ', h('b', { text: '-' }));
  const gpaxChip = h('span', { class: 'chip' }, 'สะสม ', h('b', { text: '-' }));
  const el = h('section', { class: 'card stats-card', style: 'padding:0' },
    h('div', { class: 'stats4' }, cells.map((c) => c.el)),
    h('div', { class: 'stat-chips' }, moneyChip, gpaChip, gpaxChip));
  // sticky mini strip inside the head
  const mini = STAT4.map((d) => {
    const v = h('div', { class: 'mv', text: '0' }); const bar = h('i', { style: `width:0;background:${d.color}` });
    return { d, v, bar, el: h('div', null, h('div', { class: 'ml', text: d.label }), v, h('div', { class: 'mb' }, bar)) };
  });
  const miniEl = h('div', { class: 'mini-stats', 'aria-hidden': 'true' }, mini.map((m) => m.el));
  return {
    el, miniEl,
    update(view, opts = {}) {
      const s4 = stats4Of(view);
      for (const list of [cells, mini]) list.forEach((c) => {
        const v = clamp(Math.round(s4[c.d.key] || 0), 0, 100);
        const before = c.last;
        c.last = v;
        c.v.textContent = String(v); c.bar.style.width = `${v}%`;
        if (opts.animate && list === cells && before != null && v !== before) floatDelta(c.el, v - before);
      });
      const mNow = Math.round((view.stats || {}).money || 0);
      if (opts.animate && this._money != null && mNow !== this._money) floatDelta(moneyChip, mNow - this._money, true);
      this._money = mNow;
      cells.forEach((c) => c.el.setAttribute('aria-label', `${c.d.label} ${c.v.textContent} จาก 100`));
      const st = view.stats || {};
      moneyChip.querySelector('b').textContent = fmtInt(st.money);
      gpaChip.querySelector('b').textContent = st.gpa ? Number(st.gpa).toFixed(2) : '-';
      gpaxChip.querySelector('b').textContent = st.gpax ? Number(st.gpax).toFixed(2) : '-';
    },
  };
}

// ---------- life record ----------
export function makeRecordCard(record, who, onAllLines) {
  const list = h('ol', { class: 'rec-list', role: 'log', 'aria-live': 'off', 'aria-relevant': 'additions' });
  const more = h('button', { type: 'button', class: 'btn small rec-more', hidden: true });
  const all = h('button', { type: 'button', class: 'btn small ghost rec-more', hidden: true, onclick: () => onAllLines && onAllLines() }, 'ดูบันทึกทั้งหมด');
  const el = h('section', { class: 'card rec-card' },
    h('div', { class: 'rec-head' }, h('h2', { text: 'บันทึกชีวิต' }), h('span', { class: 'label', text: 'ล่าสุดก่อน · แตะบรรทัดเพื่อติดดาว' })),
    list, h('div', { class: 'row' }, more, all));
  let shown = 20; let lastLen = -1; let newCount = 0;
  const lineEl = (l, isNew) => {
    const starred = record.isStarred(l);
    const btn = h('button', { type: 'button', class: 'star-btn', 'aria-pressed': String(starred), 'aria-label': starred ? 'เอาดาวออก' : 'ติดดาวเก็บเป็นของที่ระลึก' }, icon(starred ? 'starOn' : 'star', 18));
    const li = h('li', { class: `rec-item tone-${l.tone || 'neutral'}${isNew ? ' new' : ''}` },
      h('span', { class: 'rec-yr', text: shortYear(l.yearLabel) }), h('span', { class: 'rec-tx', text: l.text }), btn);
    const toggle = () => {
      const on = record.toggleStar(l, who());
      btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', on ? 'เอาดาวออก' : 'ติดดาวเก็บเป็นของที่ระลึก');
      btn.replaceChildren(icon(on ? 'starOn' : 'star', 18));
    };
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); toggle(); });
    li.addEventListener('click', toggle);
    li.style.cursor = 'pointer';
    return li;
  };
  const render = () => {
    const lines = record.lines;
    list.textContent = '';
    if (!lines.length) { list.append(h('li', { class: 'rec-empty', text: 'ยังไม่มีเหตุการณ์ ปล่อยเวลาเดินแล้วบันทึกจะเริ่มเติมเอง' })); }
    const slice = lines.slice(-shown).reverse();
    slice.forEach((l, i) => list.append(lineEl(l, i < newCount)));
    newCount = 0;
    more.hidden = lines.length <= shown;
    more.textContent = `ดูเพิ่ม (${Math.min(20, lines.length - shown)})`;
    all.hidden = lines.length <= 20;
    lastLen = lines.length;
  };
  more.addEventListener('click', () => { shown += 20; render(); });
  return {
    el,
    render,
    refresh(fresh) { if (record.lines.length !== lastLen) { newCount = fresh ? Math.min(fresh, 5) : 0; render(); } },
    setLive(on) { list.setAttribute('aria-live', on ? 'polite' : 'off'); },
  };
}

// ---------- focus card ----------
export function makeFocusCard(onChange) {
  const subs = {}; const groups = {}; let fields = FOCUS_FIELDS;
  const el = h('section', { class: 'card focus-card' });
  const title = h('h2', { text: 'โฟกัสของเทอมนี้' });
  const sub = h('p', { class: 'sub', text: '' });
  const body = h('div');
  el.append(title, sub, body);
  let current = {};
  const build = () => {
    body.textContent = '';
    fields.forEach((f) => {
      const s = h('p', { class: 'fsub' }); subs[f.key] = s;
      const btns = f.choices.map((c) => {
        const b = h('button', { type: 'button', class: 'fchoice', text: c.label, 'data-value': c.value, 'aria-pressed': 'false' });
        b.addEventListener('click', () => {
          current[f.key] = c.value;
          paint();
          onChange(f.key, c.value);
        });
        return b;
      });
      groups[f.key] = btns;
      body.append(h('div', { class: 'fgroup' }, h('div', { class: 'fl', text: f.label }), h('div', { class: 'fchoices', role: 'group', 'aria-label': f.label }, btns), s));
    });
  };
  const paint = () => {
    fields.forEach((f) => {
      (groups[f.key] || []).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === current[f.key])));
      const c = f.choices.find((x) => x.value === current[f.key]);
      subs[f.key].textContent = c ? c.sub || '' : '';
    });
  };
  build();
  return {
    el,
    update(view) {
      current = { ...(view.routine || current) };
      sub.textContent = `${labelOf(view)} · เปลี่ยนได้ทุกเมื่อ ผลมีต่อวันถัดไปทันที`;
      paint();
    },
  };
}
