// Screen for pending.kind === 'shop' (modes: meal, coop, print, canteen).
// Payload: { skip:true } or { cart:[{ shopId, itemId, qty, options }] } (see docs/CONTRACT.md section 3).
// Prices shown here are an estimate (item price + option deltas); the engine/shops module has the final say.

const MODE_TITLE = { meal: 'เลือกอาหาร', canteen: 'โรงอาหาร', coop: 'สหกรณ์', print: 'ห้องปริ้นท์' };
const MEAL_TH = { breakfast: 'มื้อเช้า', lunch: 'มื้อกลางวัน', dinner: 'มื้อเย็น', evening: 'มื้อเย็น' };
const MAX_QTY = 20;

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
const signed = (n) => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(n);

function defaultSel(item) {
  const sel = {};
  for (const o of item.options || []) sel[o.key] = o.multi ? [] : (o.choices && o.choices[0] ? o.choices[0].value : null);
  return sel;
}

function priceOf(item, sel) {
  let p = Number(item.price) || 0;
  for (const o of item.options || []) {
    const v = sel[o.key];
    const vals = o.multi ? v || [] : v == null ? [] : [v];
    for (const val of vals) {
      const c = (o.choices || []).find((x) => x.value === val);
      if (c) p += Number(c.priceDelta) || 0;
    }
  }
  return p;
}

function labelOf(item, sel) {
  const parts = [];
  for (const o of item.options || []) {
    const v = sel[o.key];
    const vals = o.multi ? v || [] : v == null ? [] : [v];
    for (const val of vals) {
      const c = (o.choices || []).find((x) => x.value === val);
      if (c) parts.push(c.label || String(c.value));
    }
  }
  return parts.join(', ');
}

// options object for the payload: single -> value, multi -> array; empty multi is left out
function payloadOptions(sel) {
  const out = {};
  for (const [k, v] of Object.entries(sel)) {
    if (Array.isArray(v)) {
      if (v.length) out[k] = v.slice();
    } else if (v != null) out[k] = v;
  }
  return out;
}

export function render(container, pending, ctx) {
  const shops = pending.shops || [];
  const money = Number(pending.money) || 0;
  const cart = []; // { key, shop, item, sel, qty, unit, label }
  const openShops = new Set(shops.length <= 2 ? shops.map((s) => s.id) : []);
  const itemViews = []; // { shopId, itemId, refresh }
  const shopViews = new Map(); // shopId -> { section, body, badge, toggle }
  let query = '';
  let cartOpen = false;
  let sent = false;

  const root = h('div', { class: 'scr scr-shop' });
  container.replaceChildren(root);

  // ---------- header ----------
  const modeTitle = MODE_TITLE[pending.mode] || 'ร้านค้า';
  const mealTh = pending.meal ? MEAL_TH[pending.meal] || pending.meal : '';
  root.appendChild(
    h(
      'header',
      { class: 'scr-head' },
      h('h2', { class: 'scr-title' }, pending.title || (mealTh ? `${modeTitle} ${mealTh}` : modeTitle)),
      pending.text ? h('p', { class: 'scr-text' }, pending.text) : null,
      h(
        'div',
        { class: 'scr-chips' },
        h('span', { class: 'scr-stat' }, 'เงิน ', h('b', {}, baht(money))),
        pending.fullness != null ? h('span', { class: 'scr-stat' }, 'อิ่มตอนนี้ ', h('b', {}, String(Math.round(pending.fullness * 10) / 10))) : null,
        mealTh ? h('span', { class: 'scr-stat' }, mealTh) : null
      )
    )
  );

  // ---------- search + expand all ----------
  const search = h('input', {
    class: 'scr-input',
    type: 'search',
    placeholder: 'ค้นหาเมนูหรือร้าน',
    'aria-label': 'ค้นหาเมนูหรือร้าน',
    autocomplete: 'off',
  });
  const expandBtn = h('button', { class: 'scr-btn scr-btn-ghost', type: 'button' }, 'เปิดทั้งหมด');
  root.appendChild(h('div', { class: 'scr-toolbar' }, search, shops.length > 2 ? expandBtn : null));

  const list = h('div', { class: 'scr-shops' });
  root.appendChild(list);
  const emptyNote = h('p', { class: 'scr-empty', hidden: true }, 'ไม่พบเมนูที่ค้นหา');
  root.appendChild(emptyNote);

  // ---------- cart bar ----------
  const cartPanel = h('div', { class: 'scr-cart-panel', hidden: true });
  const cartSummary = h('button', { class: 'scr-cart-sum', type: 'button', 'aria-expanded': 'false' });
  const warn = h('div', { class: 'scr-warn', role: 'alert', hidden: true });
  const confirmBtn = h('button', { class: 'scr-btn scr-btn-primary', type: 'button' }, 'ซื้อ');
  const skipBtn = pending.canSkip ? h('button', { class: 'scr-btn', type: 'button' }, 'ไม่ซื้ออะไร') : null;
  const bar = h('div', { class: 'scr-bar' }, cartPanel, warn, cartSummary, h('div', { class: 'scr-bar-act' }, skipBtn, confirmBtn));
  root.appendChild(bar);

  const totals = () => {
    let total = 0, fill = 0, count = 0;
    for (const l of cart) {
      total += l.unit * l.qty;
      fill += (Number(l.item.fill) || 0) * l.qty;
      count += l.qty;
    }
    return { total, fill, count };
  };

  function qtyOf(shopId, itemId) {
    let n = 0;
    for (const l of cart) if (l.shop.id === shopId && l.item.id === itemId) n += l.qty;
    return n;
  }

  function addToCart(shop, item, sel, qty) {
    const opts = payloadOptions(sel);
    const key = `${shop.id}|${item.id}|${JSON.stringify(Object.keys(opts).sort().map((k) => [k, opts[k]]))}`;
    const line = cart.find((l) => l.key === key);
    if (line) line.qty = Math.min(MAX_QTY, line.qty + qty);
    else cart.push({ key, shop, item, sel: JSON.parse(JSON.stringify(sel)), qty: Math.min(MAX_QTY, qty), unit: priceOf(item, sel), label: labelOf(item, sel) });
    cartChanged();
  }

  function changeLine(line, d) {
    line.qty += d;
    if (line.qty <= 0) cart.splice(cart.indexOf(line), 1);
    else if (line.qty > MAX_QTY) line.qty = MAX_QTY;
    cartChanged();
  }

  function stepper(qty, onMinus, onPlus, name) {
    return h(
      'div',
      { class: 'scr-step' },
      h('button', { class: 'scr-step-btn', type: 'button', 'aria-label': `ลด ${name}`, onclick: onMinus }, '−'),
      h('span', { class: 'scr-step-n', 'aria-live': 'polite' }, String(qty)),
      h('button', { class: 'scr-step-btn', type: 'button', 'aria-label': `เพิ่ม ${name}`, onclick: onPlus, disabled: qty >= MAX_QTY }, '+')
    );
  }

  function cartChanged() {
    const { total, fill, count } = totals();
    const over = total - money;
    // summary
    cartSummary.replaceChildren(
      h('span', { class: 'scr-cart-count' }, count ? `ตะกร้า ${count} ชิ้น` : 'ตะกร้าว่าง'),
      h('span', { class: 'scr-cart-total' + (over > 0 ? ' is-bad' : '') }, `${baht(total)} / ${baht(money)}`),
      h('span', { class: 'scr-cart-caret', 'aria-hidden': 'true' }, cartOpen ? '▾' : '▴')
    );
    cartSummary.setAttribute('aria-expanded', String(cartOpen));
    // panel
    cartPanel.hidden = !cartOpen || !count;
    cartPanel.replaceChildren();
    for (const l of cart) {
      cartPanel.appendChild(
        h(
          'div',
          { class: 'scr-line' },
          h(
            'div',
            { class: 'scr-line-info' },
            h('div', { class: 'scr-line-name' }, l.item.name),
            h('div', { class: 'scr-line-sub' }, [l.shop.name, l.label].filter(Boolean).join(' / '))
          ),
          stepper(l.qty, () => changeLine(l, -1), () => changeLine(l, 1), l.item.name),
          h('div', { class: 'scr-line-price' }, baht(l.unit * l.qty))
        )
      );
    }
    if (count && fill) cartPanel.appendChild(h('div', { class: 'scr-line-sub scr-fillnote' }, `อิ่มรวมประมาณ +${Math.round(fill * 10) / 10}`));
    // warning + buttons
    warn.hidden = over <= 0;
    warn.textContent = over > 0 ? `เงินไม่พอ เกินอยู่ ${baht(over)} เอาของออกก่อน` : '';
    confirmBtn.disabled = sent || count === 0 || over > 0;
    confirmBtn.textContent = count ? `ซื้อ ${baht(total)}` : 'ซื้อ';
    if (skipBtn) skipBtn.disabled = sent;
    // badges + rows
    const perShop = new Map();
    for (const l of cart) perShop.set(l.shop.id, (perShop.get(l.shop.id) || 0) + l.qty);
    for (const [id, v] of shopViews) {
      const n = perShop.get(id) || 0;
      v.badge.textContent = n ? `${n}` : '';
      v.badge.hidden = !n;
    }
    for (const iv of itemViews) iv.refresh();
  }

  cartSummary.addEventListener('click', () => {
    cartOpen = !cartOpen;
    cartChanged();
  });
  confirmBtn.addEventListener('click', () => {
    if (sent || !cart.length) return;
    const { total } = totals();
    if (total > money) return;
    sent = true;
    cartChanged();
    ctx.act({
      cart: cart.map((l) => {
        const o = { shopId: l.shop.id, itemId: l.item.id, qty: l.qty };
        const po = payloadOptions(l.sel);
        if (Object.keys(po).length) o.options = po;
        return o;
      }),
    });
  });
  if (skipBtn)
    skipBtn.addEventListener('click', () => {
      if (sent) return;
      sent = true;
      cartChanged();
      ctx.act({ skip: true });
    });

  // ---------- item rows ----------
  function buildItem(shop, item) {
    const hasOpts = (item.options || []).length > 0;
    const off = item.available === false;
    const li = h('li', { class: 'scr-item' + (off ? ' is-off' : '') });
    const act = h('div', { class: 'scr-item-act' });
    const panel = h('div', { class: 'scr-opts', hidden: true });
    let sel = defaultSel(item);
    let pq = 1;
    let panelOpen = false;

    const meta = [];
    meta.push(h('span', { class: 'scr-price' }, baht(Number(item.price) || 0) + (hasOpts ? '+' : '')));
    if (item.fill != null && item.fill !== '') meta.push(h('span', { class: 'scr-fill' }, `อิ่ม +${item.fill}`));
    if (item.note) meta.push(h('span', { class: 'scr-note' }, item.note));
    const info = h(
      'div',
      { class: 'scr-item-info' },
      h('div', { class: 'scr-item-name' }, item.name),
      h('div', { class: 'scr-item-meta' }, meta),
      off && item.reason ? h('div', { class: 'scr-reason' }, item.reason) : null
    );
    li.append(h('div', { class: 'scr-item-row' }, info, act), panel);

    function renderPanel() {
      panel.replaceChildren();
      for (const o of item.options || []) {
        const cur = sel[o.key];
        const chosen = o.multi ? cur || [] : [cur];
        const full = o.multi && o.max && chosen.length >= o.max;
        panel.appendChild(
          h(
            'div',
            { class: 'scr-optgroup' },
            h('div', { class: 'scr-optlabel' }, o.label || o.key, o.multi && o.max ? h('span', { class: 'scr-muted' }, ` (เลือกได้ไม่เกิน ${o.max}, เลือกแล้ว ${chosen.length})`) : o.multi ? h('span', { class: 'scr-muted' }, ' (เลือกได้หลายอย่าง)') : null),
            h(
              'div',
              { class: 'scr-choices', role: o.multi ? 'group' : 'radiogroup', 'aria-label': o.label || o.key },
              (o.choices || []).map((c) => {
                const on = chosen.includes(c.value);
                const dis = o.multi && !on && full;
                const d = Number(c.priceDelta) || 0;
                return h(
                  'button',
                  {
                    class: 'scr-choice' + (on ? ' is-on' : ''),
                    type: 'button',
                    role: o.multi ? 'checkbox' : 'radio',
                    'aria-checked': String(on),
                    disabled: dis,
                    onclick: () => {
                      if (o.multi) {
                        const arr = (sel[o.key] || []).slice();
                        const i = arr.indexOf(c.value);
                        if (i >= 0) arr.splice(i, 1);
                        else arr.push(c.value);
                        sel[o.key] = arr;
                      } else sel[o.key] = c.value;
                      renderPanel();
                    },
                  },
                  c.label || String(c.value),
                  d ? h('span', { class: 'scr-delta' }, ` ${signed(d)}`) : null
                );
              })
            )
          )
        );
      }
      const unit = priceOf(item, sel);
      panel.appendChild(
        h(
          'div',
          { class: 'scr-opts-foot' },
          h('div', { class: 'scr-opts-price' }, baht(unit * pq)),
          stepper(pq, () => { pq = Math.max(1, pq - 1); renderPanel(); }, () => { pq = Math.min(MAX_QTY, pq + 1); renderPanel(); }, item.name),
          h(
            'button',
            {
              class: 'scr-btn scr-btn-primary',
              type: 'button',
              onclick: () => {
                addToCart(shop, item, sel, pq);
                ctx.toast && ctx.toast(`เพิ่ม ${item.name} แล้ว`);
                panelOpen = false;
                pq = 1;
                sel = defaultSel(item);
                panel.hidden = true;
                refresh();
              },
            },
            'ใส่ตะกร้า'
          )
        )
      );
    }

    function refresh() {
      act.replaceChildren();
      if (off) {
        act.appendChild(h('span', { class: 'scr-muted' }, 'หมด'));
        return;
      }
      const q = qtyOf(shop.id, item.id);
      if (hasOpts) {
        act.appendChild(
          h(
            'button',
            {
              class: 'scr-btn' + (panelOpen ? ' scr-btn-on' : ''),
              type: 'button',
              'aria-expanded': String(panelOpen),
              onclick: () => {
                panelOpen = !panelOpen;
                if (panelOpen) renderPanel();
                panel.hidden = !panelOpen;
                refresh();
              },
            },
            panelOpen ? 'ปิด' : 'เลือก',
            q ? h('span', { class: 'scr-qty-badge' }, ` x${q}`) : null
          )
        );
      } else if (q > 0) {
        const line = cart.find((l) => l.shop.id === shop.id && l.item.id === item.id);
        act.appendChild(stepper(q, () => changeLine(line, -1), () => changeLine(line, 1), item.name));
      } else {
        act.appendChild(h('button', { class: 'scr-btn', type: 'button', onclick: () => addToCart(shop, item, {}, 1) }, 'เพิ่ม'));
      }
    }

    itemViews.push({ shopId: shop.id, itemId: item.id, refresh });
    refresh();
    li.dataset.name = String(item.name || '').toLowerCase();
    return li;
  }

  // ---------- shop cards ----------
  function shopOpen(id) {
    return openShops.has(id) || query !== '';
  }
  function applyOpen(shop) {
    const v = shopViews.get(shop.id);
    const o = shopOpen(shop.id);
    v.body.hidden = !o;
    v.toggle.setAttribute('aria-expanded', String(o));
    v.caret.textContent = o ? '▾' : '▸';
  }

  for (const shop of shops) {
    const badge = h('span', { class: 'scr-badge', hidden: true });
    const caret = h('span', { class: 'scr-caret', 'aria-hidden': 'true' }, '▸');
    const avail = (shop.items || []).filter((i) => i.available !== false).length;
    const toggle = h(
      'button',
      {
        class: 'scr-shop-head',
        type: 'button',
        'aria-expanded': 'false',
        onclick: () => {
          if (openShops.has(shop.id)) openShops.delete(shop.id);
          else openShops.add(shop.id);
          applyOpen(shop);
        },
      },
      caret,
      h('span', { class: 'scr-shop-name' }, shop.name),
      h('span', { class: 'scr-muted scr-shop-count' }, `${avail}/${(shop.items || []).length} เมนู`),
      badge
    );
    const ul = h('ul', { class: 'scr-items' }, (shop.items || []).map((it) => buildItem(shop, it)));
    const body = h('div', { class: 'scr-shop-body', hidden: true }, shop.note ? h('p', { class: 'scr-text' }, shop.note) : null, ul, !(shop.items || []).length ? h('p', { class: 'scr-empty' }, 'ไม่มีของขายตอนนี้') : null);
    const section = h('section', { class: 'scr-shop-card' }, toggle, body);
    shopViews.set(shop.id, { section, body, badge, toggle, caret, ul, shop });
    list.appendChild(section);
    applyOpen(shop);
  }

  function applyFilter() {
    query = search.value.trim().toLowerCase();
    let any = false;
    for (const [, v] of shopViews) {
      const shopMatch = query && String(v.shop.name || '').toLowerCase().includes(query);
      let n = 0;
      for (const li of v.ul.children) {
        const m = !query || shopMatch || (li.dataset.name || '').includes(query);
        li.hidden = !m;
        if (m) n++;
      }
      v.section.hidden = !!query && n === 0;
      if (!v.section.hidden) any = true;
      applyOpen(v.shop);
    }
    emptyNote.hidden = any || !shops.length;
  }
  search.addEventListener('input', applyFilter);
  expandBtn.addEventListener('click', () => {
    const allOpen = shops.every((s) => openShops.has(s.id));
    if (allOpen) openShops.clear();
    else shops.forEach((s) => openShops.add(s.id));
    expandBtn.textContent = allOpen ? 'เปิดทั้งหมด' : 'ปิดทั้งหมด';
    shops.forEach(applyOpen);
  });

  if (!shops.length) root.insertBefore(h('p', { class: 'scr-empty' }, 'ตอนนี้ไม่มีร้านเปิด'), bar);
  cartChanged();
}
