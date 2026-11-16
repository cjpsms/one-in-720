// classPlan: the morning / afternoon block. Stance, skip toggles, optional LINE-shop order per period.
// payload: { stance:'focus'|'normal'|'relax', skipPeriods:[p], line:[{ p, itemId }] }
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

const STANCES = [
  { id: 'focus', label: 'ตั้งใจ', hint: 'ได้ความรู้มาก เหนื่อยและเครียดขึ้น' },
  { id: 'normal', label: 'ปกติ', hint: 'เรียนตามปกติ' },
  { id: 'relax', label: 'ผ่อน', hint: 'พักใจ ได้ความรู้น้อยลง' },
];
const MOOD = { calm: 'ใจเย็น', tense: 'ตึงๆ', snapping: 'จะสลิ้งแตก' };
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

export function render(container, pending, ctx) {
  const periods = Array.isArray(pending.periods) ? pending.periods : [];
  const money = Number(pending.money) || 0;
  const state = { stance: 'normal', skip: new Set(), line: new Map() }; // line: p -> itemId

  const periodNodes = new Map();
  const summaryEl = h('p', { class: 'summary', 'aria-live': 'polite' });
  const confirmBtn = h('button', { type: 'button', class: 'btn primary block' }, 'ยืนยันแผนคาบเรียน');
  const stanceBtns = [];

  function lineCost() {
    let sum = 0;
    for (const [p, itemId] of state.line) {
      const per = periods.find((x) => x.p === p);
      const it = per && per.lineShop && per.lineShop.items.find((i) => i.id === itemId);
      if (it) sum += Number(it.price) || 0;
    }
    return sum;
  }

  function refresh() {
    stanceBtns.forEach(([id, b]) => b.setAttribute('aria-pressed', String(state.stance === id)));
    for (const per of periods) {
      const n = periodNodes.get(per.p);
      if (!n) continue;
      const skipped = state.skip.has(per.p);
      n.card.classList.toggle('skipped', skipped);
      if (n.toggle) {
        n.toggle.setAttribute('aria-pressed', String(skipped));
        n.toggle.textContent = skipped ? 'ข้ามคาบนี้อยู่ (กดเพื่อยกเลิก)' : 'ข้ามคาบนี้';
      }
      if (n.lineBtns) {
        const sel = state.line.get(per.p) || null;
        n.lineBtns.forEach(([itemId, b]) => {
          b.setAttribute('aria-pressed', String(sel === itemId));
          if (itemId !== null) b.disabled = skipped || !!b.dataset.unavailable;
          else b.disabled = skipped;
        });
      }
    }
    const cost = lineCost();
    const skipN = state.skip.size;
    const parts = [];
    parts.push(skipN ? `ข้าม ${skipN} คาบ` : 'เข้าเรียนครบ');
    parts.push(state.line.size ? `สั่งของ ${state.line.size} รายการ รวม ${fmt(cost)} บาท` : 'ไม่สั่งของ');
    summaryEl.textContent = parts.join(' · ');
    const tooPoor = cost > money;
    if (tooPoor) summaryEl.append(' ', h('span', { class: 'bad', text: `เงินไม่พอ (มี ${fmt(money)} บาท)` }));
    confirmBtn.disabled = tooPoor;
  }

  const periodCard = (per) => {
    const isClass = per.kind === 'class';
    const info = h('div', null,
      h('div', { class: 'pname', text: per.name || (per.kind === 'free' ? 'คาบว่าง' : '') }),
      h('div', { class: 'pmeta' },
        per.loc ? h('span', { text: `ห้อง ${per.loc}` }) : null,
        per.kind === 'activity' ? h('span', { class: 'chip', text: 'กิจกรรม' }) : null,
        per.kind === 'free' ? h('span', { class: 'chip', text: 'ว่าง' }) : null,
        per.teacher ? h('span', { text: per.teacher.name }) : null,
        per.teacher && MOOD[per.teacher.mood]
          ? h('span', { class: `badge ${per.teacher.mood}`, text: MOOD[per.teacher.mood], 'aria-label': `อารมณ์ครู ${MOOD[per.teacher.mood]}` })
          : null));

    const entry = {};
    const actions = h('div', { class: 'pactions' });
    if (isClass || per.kind === 'activity') {
      entry.toggle = h('button', { type: 'button', class: 'toggle', 'aria-pressed': 'false' }, 'ข้ามคาบนี้');
      entry.toggle.addEventListener('click', () => {
        if (state.skip.has(per.p)) state.skip.delete(per.p);
        else { state.skip.add(per.p); state.line.delete(per.p); }
        refresh();
      });
      actions.append(entry.toggle);
    }
    info.append(actions);

    if (per.lineShop && per.lineShop.eligible && per.lineShop.items && per.lineShop.items.length) {
      const btns = [];
      const mk = (itemId, label, unavailable) => {
        const b = h('button', { type: 'button', 'aria-pressed': 'false' }, label);
        if (unavailable) b.dataset.unavailable = '1';
        b.addEventListener('click', () => {
          if (itemId === null) state.line.delete(per.p);
          else if (state.line.get(per.p) === itemId) state.line.delete(per.p);
          else state.line.set(per.p, itemId);
          refresh();
        });
        btns.push([itemId, b]);
        return b;
      };
      entry.lineBtns = btns;
      info.append(h('div', { class: 'line-pick', role: 'group', 'aria-label': `สั่งของจากร้าน LINE ในคาบ ${per.p}` },
        h('div', { class: 'lp-title', text: 'ห้องนี้อยู่ติดห้อง 222 สั่งของจากมิ้วกินในคาบได้ (เสี่ยงโดนครูจับ)' }),
        h('div', { class: 'chips' },
          mk(null, 'ไม่สั่ง', false),
          per.lineShop.items.map((it) => mk(it.id, `${it.name} ${fmt(it.price)}${it.available === false ? ' (หมด)' : ''}`, it.available === false)))));
      btns.forEach(([, b]) => { if (b.dataset.unavailable) b.disabled = true; });
    }

    const card = h('li', { class: 'card period' },
      h('div', { class: 'ptime' }, h('b', { text: `คาบ ${per.p}` }), h('span', { text: `${per.from}` }), h('span', { text: `${per.to}` })),
      info);
    entry.card = card;
    periodNodes.set(per.p, entry);
    return card;
  };

  container.textContent = '';
  container.append(h('section', { class: 'cp', 'aria-labelledby': 'cp-title' },
    pending.clock ? h('p', { class: 'scene-clock muted', text: pending.clock }) : null,
    h('h2', { id: 'cp-title', text: pending.title || (pending.block === 'afternoon' ? 'คาบบ่าย' : 'คาบเช้า') }),
    pending.text ? h('p', { text: pending.text }) : null,
    h('h3', { text: 'ท่าทีในการเรียน' }),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'ท่าทีในการเรียน' },
      STANCES.map((s) => {
        const b = h('button', { type: 'button', 'aria-pressed': 'false' }, h('b', { text: s.label }), h('span', { text: s.hint }));
        b.addEventListener('click', () => { state.stance = s.id; refresh(); });
        stanceBtns.push([s.id, b]);
        return b;
      })),
    h('ol', { class: 'periods' }, periods.map(periodCard)),
    summaryEl,
    confirmBtn));

  confirmBtn.addEventListener('click', () => {
    container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    ctx.act({
      stance: state.stance,
      skipPeriods: [...state.skip].sort((a, b) => a - b),
      line: [...state.line].map(([p, itemId]) => ({ p, itemId })),
    });
  });
  refresh();
}
