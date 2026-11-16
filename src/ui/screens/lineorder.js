// Screen for pending.kind === 'lineOrder': order from the LINE shop ahead of time, cancel old orders.
// Payload: { place:[itemId], cancel:[orderId] } (see docs/CONTRACT.md section 3).

const STATUS_TH = {
  pending: 'รอรับของ',
  ordered: 'รอรับของ',
  placed: 'รอรับของ',
  ready: 'พร้อมรับ',
  done: 'รับแล้ว',
  delivered: 'รับแล้ว',
  picked: 'รับแล้ว',
  consumed: 'กินแล้ว',
  cancelled: 'ยกเลิกแล้ว',
  canceled: 'ยกเลิกแล้ว',
  expired: 'หมดอายุ',
};
const FINAL = new Set(['done', 'delivered', 'picked', 'consumed', 'cancelled', 'canceled', 'expired']);
const MAX_QTY = 9;

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

const baht = (n) => '฿' + Math.round(n * 100) / 100;

export function render(container, pending, ctx) {
  const menu = pending.menu || [];
  const orders = pending.orders || [];
  const money = Number(pending.money) || 0;
  const qty = new Map(); // itemId -> count
  const cancel = new Set(); // orderId
  let sent = false;

  const root = h('div', { class: 'scr scr-line-shop' });
  container.replaceChildren(root);
  root.appendChild(
    h(
      'header',
      { class: 'scr-head' },
      h('h2', { class: 'scr-title' }, pending.title || 'สั่งของจากร้านไลน์'),
      pending.text ? h('p', { class: 'scr-text' }, pending.text) : null,
      h('div', { class: 'scr-chips' }, h('span', { class: 'scr-stat' }, 'เงิน ', h('b', {}, baht(money)))),
      h('p', { class: 'scr-hint' }, 'ของส่วนใหญ่ต้องสั่งล่วงหน้า (ไข่ดอง แซลมอนดอง มาม่า อาจซื้อหน้าห้อง 222 ได้ถ้ามีคนยกเลิก)')
    )
  );

  const menuEl = h('ul', { class: 'scr-items' });
  const ordersEl = h('ul', { class: 'scr-items' });
  root.appendChild(h('section', { class: 'scr-block' }, h('h3', { class: 'scr-sub' }, 'เมนู'), menu.length ? menuEl : h('p', { class: 'scr-empty' }, 'ตอนนี้ไม่มีเมนู')));
  root.appendChild(h('section', { class: 'scr-block' }, h('h3', { class: 'scr-sub' }, 'ออเดอร์ที่สั่งไว้'), orders.length ? ordersEl : h('p', { class: 'scr-empty' }, 'ยังไม่มีออเดอร์')));

  const warn = h('div', { class: 'scr-warn', role: 'alert', hidden: true });
  const sum = h('div', { class: 'scr-summary' });
  const confirmBtn = h('button', { class: 'scr-btn scr-btn-primary scr-btn-wide', type: 'button' }, 'ยืนยัน');
  root.appendChild(h('div', { class: 'scr-bar' }, warn, sum, h('div', { class: 'scr-bar-act' }, confirmBtn)));

  const total = () => menu.reduce((s, m) => s + (qty.get(m.id) || 0) * (Number(m.price) || 0), 0);
  const count = () => [...qty.values()].reduce((a, b) => a + b, 0);

  function drawMenu() {
    menuEl.replaceChildren();
    for (const m of menu) {
      const q = qty.get(m.id) || 0;
      const off = m.available === false;
      const set = (v) => { qty.set(m.id, Math.max(0, Math.min(MAX_QTY, v))); drawMenu(); drawBar(); };
      menuEl.appendChild(
        h(
          'li',
          { class: 'scr-item' + (off ? ' is-off' : '') },
          h(
            'div',
            { class: 'scr-item-row' },
            h('div', { class: 'scr-item-info' }, h('div', { class: 'scr-item-name' }, m.name), h('div', { class: 'scr-item-meta' }, h('span', { class: 'scr-price' }, baht(m.price)), m.note ? h('span', { class: 'scr-note' }, m.note) : null)),
            off
              ? h('span', { class: 'scr-muted' }, 'หมด')
              : q > 0
                ? h(
                    'div',
                    { class: 'scr-step' },
                    h('button', { class: 'scr-step-btn', type: 'button', 'aria-label': `ลด ${m.name}`, onclick: () => set(q - 1) }, '−'),
                    h('span', { class: 'scr-step-n' }, String(q)),
                    h('button', { class: 'scr-step-btn', type: 'button', 'aria-label': `เพิ่ม ${m.name}`, disabled: q >= MAX_QTY, onclick: () => set(q + 1) }, '+')
                  )
                : h('button', { class: 'scr-btn', type: 'button', onclick: () => set(1) }, 'สั่ง')
          )
        )
      );
    }
  }

  function drawOrders() {
    ordersEl.replaceChildren();
    for (const o of orders) {
      const st = String(o.status || '');
      const canCancel = !FINAL.has(st);
      const marked = cancel.has(o.id);
      const day = o.forDay == null ? '' : typeof o.forDay === 'number' ? `สำหรับวันที่ ${o.forDay}` : `สำหรับ ${o.forDay}`;
      ordersEl.appendChild(
        h(
          'li',
          { class: 'scr-item' + (marked || !canCancel ? ' is-off' : '') },
          h(
            'div',
            { class: 'scr-item-row' },
            h('div', { class: 'scr-item-info' }, h('div', { class: 'scr-item-name' + (marked ? ' is-struck' : '') }, o.itemName), h('div', { class: 'scr-item-meta' }, day ? h('span', { class: 'scr-muted' }, day) : null, h('span', { class: 'scr-tag' + (marked ? ' is-bad' : '') }, marked ? 'จะยกเลิก' : STATUS_TH[st] || st || '-'))),
            canCancel
              ? h('button', { class: 'scr-btn' + (marked ? ' scr-btn-on' : ''), type: 'button', 'aria-pressed': String(marked), onclick: () => { if (marked) cancel.delete(o.id); else cancel.add(o.id); drawOrders(); drawBar(); } }, marked ? 'ไม่ยกเลิก' : 'ยกเลิก')
              : null
          )
        )
      );
    }
  }

  function drawBar() {
    const t = total();
    const over = t - money;
    warn.hidden = over <= 0;
    warn.textContent = over > 0 ? `เงินไม่พอ เกินอยู่ ${baht(over)}` : '';
    const parts = [];
    parts.push(h('div', { class: 'scr-sum-main' + (over > 0 ? ' is-bad' : '') }, count() ? `สั่งใหม่ ${count()} ชิ้น รวม ${baht(t)} จากเงิน ${baht(money)}` : 'ยังไม่ได้สั่งอะไรเพิ่ม'));
    if (cancel.size) parts.push(h('div', { class: 'scr-sum-sub' }, `ยกเลิก ${cancel.size} ออเดอร์`));
    sum.replaceChildren(...parts);
    confirmBtn.textContent = count() || cancel.size ? 'ยืนยัน' : 'ไม่สั่งอะไร ไปต่อ';
    confirmBtn.disabled = sent || over > 0;
  }

  confirmBtn.addEventListener('click', () => {
    if (sent || total() > money) return;
    sent = true;
    confirmBtn.disabled = true;
    const place = [];
    for (const m of menu) for (let i = 0; i < (qty.get(m.id) || 0); i++) place.push(m.id);
    ctx.act({ place, cancel: [...cancel] });
  });

  drawMenu();
  drawOrders();
  drawBar();
}
