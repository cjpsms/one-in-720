// Focus screen: the routine of the term (study / food / evening / snack). Answer: act({ routine }).
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

export function render(container, pending, ctx) {
  container.textContent = '';
  const fields = Array.isArray(pending.fields) ? pending.fields : [];
  const routine = { ...(pending.current || {}) };
  const subs = {};

  const groups = fields.map((f) => {
    const sub = h('p', { class: 'fsub' });
    subs[f.key] = sub;
    const btns = (f.choices || []).map((c) => {
      const b = h('button', { type: 'button', class: 'fchoice', 'aria-pressed': String(routine[f.key] === c.value), 'data-value': c.value, text: c.label });
      b.addEventListener('click', () => {
        routine[f.key] = c.value;
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        sub.textContent = c.sub || '';
      });
      return b;
    });
    const cur = (f.choices || []).find((c) => c.value === routine[f.key]);
    sub.textContent = cur ? cur.sub || '' : '';
    return h('div', { class: 'fgroup' }, h('div', { class: 'fl', text: f.label }), h('div', { class: 'fchoices', role: 'group', 'aria-label': f.label }, btns), sub);
  });

  container.append(h('section', { class: 'scene focus-sheet', 'aria-labelledby': 'focus-title' },
    pending.clock ? h('p', { class: 'scene-clock', text: pending.clock }) : null,
    h('h2', { id: 'focus-title', class: 'scene-title', text: pending.title || 'โฟกัสของเทอมนี้' }),
    pending.text ? h('p', { class: 'scene-text', text: pending.text }) : null,
    pending.hint ? h('div', { class: 'scene-box' }, h('p', { class: 'scene-text', text: pending.hint })) : null,
    groups,
    h('div', { class: 'sticky-act' },
      h('button', { type: 'button', class: 'btn primary block', onclick: (ev) => { ev.currentTarget.disabled = true; ctx.act({ routine }); } }, 'ยืนยันโฟกัส'))));
}
