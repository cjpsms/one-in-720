// Screen for pending.kind === 'plan': vertical slot planner (free time, dorm evening, weekend).
// Payload: { plan:[actionId x slots] } (see docs/CONTRACT.md section 3).
// Interpretation: after lightsOutMinute a slot only accepts actions flagged quietOnly (plus 'sleep').

const WAKE_GUESS = 6 * 60; // PLACEHOLDER: wake-up minute used only for the sleep estimate (real value is in the engine)
const KIND_TITLE = { free: 'วางแผนเวลาว่าง', evening: 'วางแผนช่วงค่ำที่หอ', weekend: 'วางแผนวันหยุด' };

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

const fmt = (m) => {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const baht = (n) => '฿' + Math.round(n);

export function render(container, pending, ctx) {
  const start = Number(pending.startMinute) || 0;
  const step = Number(pending.slotMinutes) || 30;
  const n = Number(pending.slots) || 0;
  const actions = pending.actions || [];
  const byId = new Map(actions.map((a) => [a.id, a]));
  const lights = pending.lightsOutMinute != null ? Number(pending.lightsOutMinute) : null;
  const parents = pending.parents || { canAsk: false };
  const money = Number(pending.money) || 0;
  const kind = pending.planKind || 'free';

  const slotStart = (i) => start + i * step;
  const locked = (i) => lights != null && slotStart(i) >= lights;
  const allowed = (a, i) => !locked(i) || a.quietOnly === true || a.id === 'sleep';
  const fallbackAction = () => (byId.has('sleep') ? 'sleep' : actions[0] ? actions[0].id : null);

  const plan = [];
  for (let i = 0; i < n; i++) plan.push(locked(i) && byId.has('sleep') ? 'sleep' : null);
  let openSlot = -1;
  let sent = false;

  const root = h('div', { class: 'scr scr-plan' });
  container.replaceChildren(root);

  // ---------- header ----------
  root.appendChild(
    h(
      'header',
      { class: 'scr-head' },
      h('h2', { class: 'scr-title' }, pending.title || KIND_TITLE[kind] || 'วางแผน'),
      pending.text ? h('p', { class: 'scr-text' }, pending.text) : null,
      h(
        'div',
        { class: 'scr-chips' },
        h('span', { class: 'scr-stat' }, `${fmt(start)} - ${fmt(start + n * step)}`),
        h('span', { class: 'scr-stat' }, 'เงิน ', h('b', {}, baht(money))),
        lights != null ? h('span', { class: 'scr-stat' }, `ปิดไฟ ${fmt(lights)}`) : null
      )
    )
  );

  if (parents.canAsk) {
    root.appendChild(
      h(
        'p',
        { class: 'scr-hint' },
        'โทรขอเงินพ่อแม่: ',
        parents.nextAmount != null ? `ครั้งนี้ได้ประมาณ ${baht(parents.nextAmount)} ` : '',
        byId.has('call_parents') ? '(ใส่ช่อง "โทรหาพ่อแม่" ในแผน)' : ''
      )
    );
  } else if (parents.canAsk === false && byId.has('call_parents')) {
    root.appendChild(h('p', { class: 'scr-hint scr-muted' }, 'ตอนนี้ขอเงินพ่อแม่ไม่ได้ (ขอไปแล้ว หรือยังไม่ถึงเวลา) โทรไปคุยได้อย่างเดียว'));
  }

  // ---------- quick fill ----------
  const quickSel = h(
    'select',
    { class: 'scr-input', 'aria-label': 'เลือกกิจกรรมเพื่อเติมทั้งหมด' },
    actions.map((a) => h('option', { value: a.id }, a.label))
  );
  if (byId.has('study_alone')) quickSel.value = 'study_alone';
  const fillAll = h('button', { class: 'scr-btn', type: 'button' }, 'เติมทั้งหมดด้วยอันเดียว');
  const fillEmpty = h('button', { class: 'scr-btn', type: 'button' }, 'เติมเฉพาะช่องว่าง');
  const clearBtn = h('button', { class: 'scr-btn scr-btn-ghost', type: 'button' }, 'ล้าง');
  root.appendChild(h('div', { class: 'scr-quick' }, quickSel, h('div', { class: 'scr-quick-btns' }, fillAll, fillEmpty, clearBtn)));

  fillAll.addEventListener('click', () => fillWith(quickSel.value, false));
  fillEmpty.addEventListener('click', () => fillWith(quickSel.value, true));
  clearBtn.addEventListener('click', () => {
    for (let i = 0; i < n; i++) if (!locked(i)) plan[i] = null;
    redraw();
  });

  function fillWith(id, onlyEmpty, from = 0) {
    const a = byId.get(id);
    if (!a) return;
    for (let i = from; i < n; i++) {
      if (!allowed(a, i)) continue;
      if (onlyEmpty && plan[i]) continue;
      plan[i] = id;
    }
    redraw();
  }

  // ---------- slot list ----------
  const listEl = h('ol', { class: 'scr-slots' });
  root.appendChild(listEl);

  // ---------- summary + confirm ----------
  const summary = h('div', { class: 'scr-summary' });
  const confirmBtn = h('button', { class: 'scr-btn scr-btn-primary scr-btn-wide', type: 'button' }, 'ยืนยันแผน');
  const bar = h('div', { class: 'scr-bar' }, summary, h('div', { class: 'scr-bar-act' }, confirmBtn));
  root.appendChild(bar);

  confirmBtn.addEventListener('click', () => {
    if (sent) return;
    sent = true;
    confirmBtn.disabled = true;
    const fb = fallbackAction();
    ctx.act({ plan: plan.map((p) => p || fb) });
  });

  function drawSlots() {
    listEl.replaceChildren();
    let lightsShown = false;
    for (let i = 0; i < n; i++) {
      if (lights != null && !lightsShown && slotStart(i) >= lights) {
        lightsShown = true;
        listEl.appendChild(h('li', { class: 'scr-lights', 'aria-hidden': 'true' }, `ปิดไฟ ${fmt(lights)}: หลังจากนี้ทำได้เฉพาะกิจกรรมเงียบ`));
      }
      const a = plan[i] ? byId.get(plan[i]) : null;
      const isLocked = locked(i);
      const isOpen = openSlot === i;
      const row = h(
        'button',
        {
          class: 'scr-slot' + (a ? '' : ' is-empty') + (isLocked ? ' is-locked' : '') + (isOpen ? ' is-open' : ''),
          type: 'button',
          'aria-expanded': String(isOpen),
          onclick: () => {
            openSlot = isOpen ? -1 : i;
            drawSlots();
          },
        },
        h('span', { class: 'scr-slot-time' }, `${fmt(slotStart(i))}`, h('span', { class: 'scr-slot-to' }, `ถึง ${fmt(slotStart(i) + step)}`)),
        h('span', { class: 'scr-slot-act' }, a ? a.label : 'ยังไม่ได้เลือก'),
        isLocked ? h('span', { class: 'scr-tag' }, 'หลังปิดไฟ') : null,
        h('span', { class: 'scr-caret', 'aria-hidden': 'true' }, isOpen ? '▾' : '▸')
      );
      const li = h('li', { class: 'scr-slot-item' }, row);
      if (isOpen) {
        const grid = h('div', { class: 'scr-picks' });
        const ordered = isLocked ? [...actions.filter((x) => allowed(x, i)), ...actions.filter((x) => !allowed(x, i))] : actions;
        for (const act of ordered) {
          const ok = allowed(act, i);
          grid.appendChild(
            h(
              'button',
              {
                class: 'scr-pick' + (plan[i] === act.id ? ' is-on' : ''),
                type: 'button',
                disabled: !ok,
                'aria-pressed': String(plan[i] === act.id),
                onclick: () => {
                  plan[i] = act.id;
                  openSlot = -1;
                  redraw();
                },
              },
              h('span', { class: 'scr-pick-label' }, act.label),
              act.quietOnly ? h('span', { class: 'scr-tag' }, 'เงียบ') : null,
              !ok ? h('span', { class: 'scr-pick-hint' }, 'ทำไม่ได้หลังปิดไฟ') : act.hint ? h('span', { class: 'scr-pick-hint' }, act.hint) : null
            )
          );
        }
        const rest = plan[i]
          ? h('button', { class: 'scr-btn scr-btn-ghost', type: 'button', onclick: () => { openSlot = -1; fillWith(plan[i], false, i); } }, 'ใช้อันนี้กับช่องที่เหลือทั้งหมด')
          : null;
        li.appendChild(h('div', { class: 'scr-picker' }, grid, rest));
      }
      listEl.appendChild(li);
    }
  }

  function drawSummary() {
    const fb = fallbackAction();
    const final = plan.map((p) => p || fb);
    const empty = plan.filter((p) => !p).length;
    let lastAwake = start;
    let sleepSlots = 0;
    const counts = new Map();
    final.forEach((id, i) => {
      if (id === 'sleep') sleepSlots++;
      else lastAwake = slotStart(i) + step;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    const wake = pending.wakeMinute != null ? Number(pending.wakeMinute) : WAKE_GUESS;
    const parts = [];
    if (kind === 'evening') {
      let wakeAbs = wake;
      while (wakeAbs <= lastAwake) wakeAbs += 1440;
      const hrs = Math.max(0, Math.min(9.5, (wakeAbs - lastAwake) / 60));
      const tone = hrs < 6 ? 'is-bad' : hrs >= 7 ? 'is-good' : '';
      parts.push(h('div', { class: 'scr-sum-main ' + tone }, `นอนประมาณ ${hrs.toFixed(1)} ชั่วโมง`, h('span', { class: 'scr-muted' }, ` (หลับตั้งแต่ ${fmt(lastAwake)} ถึง ${fmt(wakeAbs)})`)));
      if (hrs < 6) parts.push(h('div', { class: 'scr-sum-sub' }, 'นอนน้อยไป พรุ่งนี้สุขภาพและสมาธิจะแย่'));
    } else {
      parts.push(h('div', { class: 'scr-sum-main' }, sleepSlots ? `พัก/นอนในแผน ${((sleepSlots * step) / 60).toFixed(1)} ชั่วโมง` : `ทำกิจกรรม ${n} ช่อง`));
    }
    const chips = [];
    for (const [id, c] of counts) {
      const a = byId.get(id);
      if (a) chips.push(h('span', { class: 'scr-mini' }, `${a.label} x${c}`));
    }
    parts.push(h('div', { class: 'scr-minis' }, chips));
    if (empty) parts.push(h('div', { class: 'scr-sum-sub' }, `ยังว่าง ${empty} ช่อง จะนับเป็น "${byId.get(fb) ? byId.get(fb).label : '-'}"`));
    summary.replaceChildren(...parts);
  }

  function redraw() {
    drawSlots();
    drawSummary();
  }
  if (!n || !actions.length) root.insertBefore(h('p', { class: 'scr-empty' }, 'ไม่มีช่องให้วางแผน กดยืนยันเพื่อไปต่อ'), listEl);
  redraw();
}
