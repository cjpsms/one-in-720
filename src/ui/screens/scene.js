// Generic scene (decision card): clock label, serif title, text, optional card rows, option buttons.
// Used inside the bottom sheet (routine mode) and inline (detailed mode). `final` scenes are shown by the ending page.
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

const COLORS = [['แดง', 'red'], ['เหลือง', 'yellow'], ['ม่วง', 'purple'], ['ฟ้า', 'blue']];
const colorOfLabel = (l) => { const f = COLORS.find(([th]) => String(l).includes(th)); return f ? f[1] : null; };

// colour ranking card (CONTRACT3 section 12): used when at least 3 card rows are named after the colour teams; a coloured bar per team
function scoreBoard(rows) {
  const items = rows.map(([l, v]) => ({ l, v, c: colorOfLabel(l), n: parseFloat(String(v).replace(/[^\d.]/g, '')) }));
  if (items.filter((x) => x.c && Number.isFinite(x.n)).length < 3) return null;
  const max = Math.max(1, ...items.map((x) => (x.c && Number.isFinite(x.n) ? x.n : 0)));
  const best = Math.max(...items.filter((x) => x.c).map((x) => x.n));
  return h('div', { class: 'score-board', role: 'table', 'aria-label': 'คะแนนกีฬาสี' }, items.map((x) => h('div', { class: `sb-row${x.n === best ? ' first' : ''} ${x.c ? 'clr-' + x.c : ''}`, role: 'row' },
    h('span', { class: 'sb-name' }, x.c ? h('i') : null, x.l),
    h('div', { class: 'sb-bar' }, h('i', { style: `width:${Number.isFinite(x.n) ? Math.round((x.n / max) * 100) : 0}%` })),
    h('b', { class: 'sb-val', text: String(x.v == null ? '' : x.v) }))));
}

const TONE_TEXT = { good: 'ผลดี', bad: 'เสี่ยง' };

// option sub line: "45 บาท · สำเร็จ ~85% (+ครูไว้ใจ −ครูตึง)" -> a cost chip, a chance chip with a small bar, the reasons as small text
function subLine(sub) {
  const parts = String(sub).split(' · ');
  const box = h('span', { class: 'opt-sub' });
  for (const part of parts) {
    const m = /^(.*?)~(\d+)%\s*(?:\((.*)\))?$/.exec(part);
    if (m) {
      const n = Number(m[2]);
      box.append(h('span', { class: 'chance', role: 'img', 'aria-label': `${m[1].trim() || 'โอกาส'} ${n} เปอร์เซ็นต์` },
        h('span', { class: 'chance-n', text: `${m[1].trim() || 'โอกาส'} ${n}%` }),
        h('span', { class: 'chance-bar' }, h('i', { style: `width:${n}%` }))));
      if (m[3]) box.append(h('span', { class: 'chance-why', text: m[3] }));
    } else if (/บาท$/.test(part)) box.append(h('span', { class: 'cost-chip', text: part }));
    else box.append(h('span', { class: 'sub-text', text: part }));
  }
  return box;
}

// person card (CONTRACT3 section 10): name, grade/room and a closeness bar, when the scene carries card.person
function personCard(p) {
  const c = Math.max(0, Math.min(100, Number(p.closeness) || 0));
  const initial = String(p.name || '?').trim().charAt(0);
  return h('div', { class: 'person-card' },
    h('div', { class: 'pc-av', 'aria-hidden': 'true', text: initial }),
    h('div', { class: 'pc-body' },
      h('div', { class: 'pc-name', text: p.name || '' }),
      h('div', { class: 'pc-sub', text: [p.sex || null, p.grade ? `ม.${p.grade}${p.room ? '/' + p.room : ''}` : null, p.note].filter(Boolean).join(' · ') }),
      h('div', { class: 'pc-bar', role: 'img', 'aria-label': `ความสนิท ${Math.round(c)} จาก 100` }, h('span', { class: 'label', text: 'ความสนิท' }), h('div', { class: 'mg-bar' }, h('i', { style: `width:${c}%;background:var(--c-bonds)` })), h('b', { class: 'mono', text: String(Math.round(c)) }))));
}

export function render(container, pending, ctx) {
  container.textContent = '';
  const options = Array.isArray(pending.options) ? pending.options : [];
  const rows = pending.card && Array.isArray(pending.card.rows) ? pending.card.rows : [];

  const optButtons = options.map((o) => {
    const tone = o.tone === 'good' || o.tone === 'bad' ? o.tone : 'neutral';
    const btn = h('button', { type: 'button', class: `opt tone-${tone}`, disabled: !!o.disabled, 'data-option': o.id },
      h('span', { class: 'opt-label' }, o.label, TONE_TEXT[tone] ? h('span', { class: 'opt-tone', text: TONE_TEXT[tone] }) : null),
      o.sub ? subLine(o.sub) : null,
      o.disabled && o.reason ? h('span', { class: 'opt-reason', text: o.reason }) : null);
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      ctx.act({ optionId: o.id });
    });
    return btn;
  });

  container.append(h('section', { class: `scene${pending.final ? ' final' : ''}`, 'aria-labelledby': 'scene-title' },
    pending.clock && !pending.final ? h('p', { class: 'scene-clock', text: pending.clock }) : null,
    h('h2', { id: 'scene-title', class: 'scene-title', text: pending.title || '' }),
    pending.text ? h('p', { class: 'scene-text', text: pending.text }) : null,
    pending.card && pending.card.person ? personCard(pending.card.person) : null,
    rows.length && scoreBoard(rows) ? scoreBoard(rows) : rows.length
      ? h('div', { class: 'scene-box' }, h('dl', { class: 'rows' }, rows.map(([l, v]) => h('div', null, h('dt', { text: l }), h('dd', { text: v == null ? '' : String(v) })))))
      : null,
    optButtons.length ? h('div', { class: 'opts' }, optButtons) : null));
}
