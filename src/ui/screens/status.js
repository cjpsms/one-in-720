// Status component: compact header (used by app.js on every screen) and the full status panel.
// render(container, null|pending, ctx) draws the full panel from ctx.view.

// PLACEHOLDER: the engine has not told us the scale of health/energy/stress/fullness; assume 0..100.
// If view.statMax is given by the engine it wins.
export const STAT_MAX = 100;

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
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

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pct = (v, max) => Math.max(0, Math.min(100, ((Number(v) || 0) / max) * 100));

// kind: 'good' = high is good, 'bad' = high is bad (stress)
const BARS = [
  { key: 'health', label: 'สุขภาพ', kind: 'good' },
  { key: 'energy', label: 'พลังงาน', kind: 'good' },
  { key: 'stress', label: 'เครียด', kind: 'bad' },
  { key: 'fullness', label: 'อิ่ม', kind: 'good' },
];

function bar(value, max) {
  return h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${pct(value, max).toFixed(0)}%` }));
}

function statChip(def, stats, max) {
  const v = stats[def.key];
  const frac = pct(v, max);
  const cls = ['stat'];
  if (def.kind === 'good' && frac < 25) cls.push('low');
  if (def.kind === 'bad' && frac > 70) cls.push('high-bad');
  return h('li', { class: cls.join(' '), role: 'img', 'aria-label': `${def.label} ${Math.round(Number(v) || 0)} จาก ${max}` },
    h('div', { class: 'stat-top' }, h('span', { text: def.label }), h('b', { text: Math.round(Number(v) || 0) })),
    bar(v, max));
}

function plainChip(label, value) {
  return h('li', { class: 'stat plain' }, h('div', { class: 'stat-top' }, h('span', { text: label }), h('b', { text: value })));
}

// Draws the always-visible header into `el`.
// handlers: { openStatus, openLog, openMenu }
export function renderHeader(el, view, handlers = {}) {
  el.textContent = '';
  if (!view) {
    el.append(h('div', { class: 'hdr-top' }, h('div', { class: 'hdr-clock', text: '1 ใน 720' })));
    return;
  }
  const s = view.stats || {};
  const max = view.statMax || STAT_MAX;
  el.append(
    h('div', { class: 'hdr-top' },
      h('div', { class: 'hdr-clock', text: view.clock ? view.clock.label : '' }),
      h('button', { type: 'button', class: 'hdr-btn', onclick: handlers.openStatus, 'aria-label': 'ดูสถานะเต็ม' }, 'สถานะ'),
      h('button', { type: 'button', class: 'hdr-btn', onclick: handlers.openLog, 'aria-label': 'ดูบันทึกเหตุการณ์' }, 'บันทึก'),
      h('button', { type: 'button', class: 'hdr-btn', onclick: handlers.openMenu, 'aria-label': 'เมนู' }, 'เมนู')),
    h('p', { class: 'hdr-place', text: view.place || '' }),
    h('ul', { class: 'stats' },
      statChip(BARS[0], s, max), statChip(BARS[1], s, max), statChip(BARS[2], s, max),
      statChip(BARS[3], s, max),
      plainChip('เงิน', `${fmtInt(s.money)} บาท`),
      plainChip('เกรด', Number(s.gpa || 0).toFixed(2))));
}

const TRAIT = { extrovert: 'ชอบเข้าสังคม', introvert: 'ชอบอยู่เงียบๆ' };
const TIER = { normal: 'ปกติ', spoiled: 'สปอยล์', rich: 'รวย' };

function detailRow(label, value) {
  return h('div', null, h('dt', { text: label }), h('dd', { text: value }));
}

// colour team (view().me.color = { id, th }): a coloured dot and the name, e.g. สีแดง
function colorRow(me) {
  const c = me && me.color;
  if (!c || !c.id) return null;
  return h('div', null, h('dt', { text: 'สีกีฬาสี' }), h('dd', null, h('span', { class: `clr-chip clr-${c.id}`, style: 'margin:0' }, h('i'), /^สี/.test(c.th || '') ? c.th : `สี${c.th || c.id}`)));
}

// friends (view().friends, top 8 by closeness) and the partner (view().me.partner); nothing when the engine sends neither
function friendsCard(view) {
  const friends = Array.isArray(view.friends) ? view.friends : [];
  const partner = view.me && view.me.partner;
  if (!friends.length && !partner) return null;
  const pname = partner && (partner.name || partner);
  return h('section', { class: 'card' },
    h('h3', { text: 'เพื่อนและคนสำคัญ' }),
    partner ? h('p', { class: 'partner-note' }, `แฟน: ${pname}`, partner.since != null ? ` · คบกันมาตั้งแต่วันที่ ${partner.since}` : '', h('br'), 'มีแฟนอยู่: ถ้าไม่เน้นเรียนเกรดจะตก') : null,
    friends.length ? h('ul', { class: 'friend-list' }, friends.map((f) => {
      const c = Math.max(0, Math.min(100, Number(f.closeness) || 0));
      return h('li', null,
        h('span', { class: 'fn' }, f.name, f.partner ? h('span', { class: 'partner-chip', text: 'แฟน' }) : null, h('small', { text: [f.sex, f.grade ? `ม.${f.grade}${f.room ? '/' + f.room : ''}` : ''].filter(Boolean).join(' · ') })),
        h('div', { class: 'mg-bar', role: 'img', 'aria-label': `ความสนิท ${Math.round(c)} จาก 100` }, h('i', { style: `width:${c}%;background:var(--c-bonds)` })),
        h('b', { text: String(Math.round(c)) }));
    })) : null);
}

// Full status panel. Works as a screen module: render(container, pending, ctx).
export function render(container, _pending, ctx) {
  container.textContent = '';
  const view = ctx && ctx.view;
  if (!view) { container.append(h('p', { class: 'muted', text: 'ยังไม่มีข้อมูลสถานะ' })); return; }
  const s = view.stats || {};
  const me = view.me || {};
  const max = view.statMax || STAT_MAX;

  const meRows = [
    ['ชื่อ', me.name], ['เพศ', me.sex], ['นิสัย', TRAIT[me.trait] || me.trait],
    ['ชั้น', me.grade ? `ม.${me.grade}${me.room ? '/' + me.room : ''}` : null],
    ['อันดับในชั้น', me.rank && me.rankSize ? `${me.rank} จาก ${me.rankSize}` : null],
    ['หอพัก', [me.dormName, me.dormRoom].filter(Boolean).join(' ') || null],
    ['ฐานะครอบครัว', TIER[me.tier] || me.tier],
  ].filter((r) => r[1] != null && r[1] !== '');

  const bars = [
    ...BARS.map((d) => ({ ...d })),
    { key: 'knowledge', label: 'ความรู้', kind: 'good' },
    { key: 'peer', label: 'เพื่อน', kind: 'good' },
    { key: 'teacherTrust', label: 'ครูไว้ใจ', kind: 'good' },
  ].filter((d) => s[d.key] != null);

  container.append(
    h('div', { class: 'stack' },
      h('p', { class: 'muted', text: `${view.clock ? view.clock.label : ''}${view.place ? ' · ' + view.place : ''}` }),
      h('section', { class: 'card' }, h('h3', { text: 'ตัวคุณ' }), h('dl', { class: 'rows list' }, meRows.map(([l, v]) => detailRow(l, String(v))), colorRow(me))),
      h('section', { class: 'card' },
        h('h3', { text: 'ค่าสถานะ' }),
        h('ul', { class: 'stat-list' },
          bars.map((d) => {
            const frac = pct(s[d.key], max);
            const cls = ['stat'];
            if (d.kind === 'bad' && frac > 70) cls.push('high-bad');
            if (d.kind === 'good' && frac < 25) cls.push('low');
            return h('li', { class: cls.join(' ') }, h('div', { class: 'stat-top' }, h('span', { text: d.label }), h('b', { text: Math.round(s[d.key]) })), bar(s[d.key], max));
          })),
        h('dl', { class: 'rows list' },
          detailRow('เงิน', `${fmtInt(s.money)} บาท`),
          detailRow('เกรดเทอมนี้', Number(s.gpa || 0).toFixed(2)),
          detailRow('เกรดเฉลี่ยสะสม', Number(s.gpax || 0).toFixed(2)),
          view.askParents ? detailRow('ขอเงินพ่อแม่', view.askParents.available ? `ได้ (ครั้งหน้า ${fmtInt(view.askParents.nextAmount)} บาท)` : 'ขอไม่ได้ตอนนี้') : null)),
      friendsCard(view),
      view.today && view.today.length
        ? h('section', { class: 'card' }, h('h3', { text: 'ตารางวันนี้' }),
          h('ul', { class: 'today' }, view.today.map((t) =>
            h('li', { class: t.done ? 'done' : '' },
              h('span', { class: 'tm', text: `${t.from}-${t.to}` }),
              h('span', { text: [t.title, t.loc, t.teacher].filter(Boolean).join(' · ') })))))
        : null,
      view.notes && view.notes.length
        ? h('section', { class: 'card' }, h('h3', { text: 'หมายเหตุ' }), h('ul', { class: 'today' }, view.notes.map((n) => h('li', { text: n }))))
        : null));
}
