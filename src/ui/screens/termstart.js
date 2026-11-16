// Screen for pending.kind === 'termStart': pick one club and (if needElective) one elective.
// Payload: { clubId, electiveId|null } (see docs/CONTRACT.md section 3).

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

const AREA_TH = {
  science: 'วิทยาศาสตร์', math: 'คณิตศาสตร์', computer: 'คอมพิวเตอร์', language: 'ภาษา', social: 'สังคม',
  art: 'ศิลปะ', music: 'ดนตรี', dance: 'นาฏศิลป์', health: 'สุขภาพ', work: 'การงาน', skills: 'ทักษะชีวิต',
  sport: 'กีฬา', reading: 'การอ่าน', military: 'ทหาร', service: 'บริการ',
};
const areaTh = (a) => AREA_TH[a] || a || '';

// One filterable single-choice list. getState() -> selected id; onPick(id).
function picker({ label, items, areaOf, getSelected, onPick, extraFilters, renderMeta, isDisabled, disabledReason }) {
  const state = { q: '', area: '', extra: '' };
  const areas = [...new Set(items.map(areaOf).filter(Boolean))].sort((a, b) => areaTh(a).localeCompare(areaTh(b), 'th'));
  const search = h('input', { class: 'scr-input', type: 'search', placeholder: `ค้นหา${label}`, 'aria-label': `ค้นหา${label}`, autocomplete: 'off' });
  const chipBox = h('div', { class: 'scr-filter', role: 'group', 'aria-label': `กรอง${label}` });
  const listEl = h('div', { class: 'scr-pick-list', role: 'radiogroup', 'aria-label': label });
  const count = h('div', { class: 'scr-muted scr-count' });
  const root = h('div', { class: 'scr-picker-box' }, search, chipBox, count, listEl);

  function chip(text, on, fn) {
    return h('button', { class: 'scr-chip' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': String(on), onclick: fn }, text);
  }
  function drawChips() {
    chipBox.replaceChildren();
    if (areas.length) {
      chipBox.appendChild(chip('ทุกสาย', !state.area, () => { state.area = ''; drawChips(); drawList(); }));
      for (const a of areas) chipBox.appendChild(chip(areaTh(a), state.area === a, () => { state.area = state.area === a ? '' : a; drawChips(); drawList(); }));
    }
    for (const f of extraFilters || []) chipBox.appendChild(chip(f.label, state.extra === f.id, () => { state.extra = state.extra === f.id ? '' : f.id; drawChips(); drawList(); }));
    chipBox.hidden = !chipBox.childNodes.length;
  }
  function drawList() {
    const q = state.q.toLowerCase();
    const sel = getSelected();
    const shown = items.filter((it) => {
      if (q && !String(it.name || '').toLowerCase().includes(q)) return false;
      if (state.area && areaOf(it) !== state.area) return false;
      if (state.extra) {
        const f = (extraFilters || []).find((x) => x.id === state.extra);
        if (f && !f.test(it)) return false;
      }
      return true;
    });
    count.textContent = `แสดง ${shown.length} จาก ${items.length}`;
    listEl.replaceChildren();
    if (!shown.length) listEl.appendChild(h('p', { class: 'scr-empty' }, 'ไม่พบรายการที่ตรงกับตัวกรอง'));
    for (const it of shown) {
      const dis = isDisabled ? isDisabled(it) : false;
      const on = sel === it.id;
      listEl.appendChild(
        h(
          'button',
          {
            class: 'scr-opt' + (on ? ' is-on' : '') + (dis ? ' is-off' : ''),
            type: 'button',
            role: 'radio',
            'aria-checked': String(on),
            disabled: dis,
            onclick: () => { onPick(on ? null : it.id); drawList(); },
          },
          h('span', { class: 'scr-radio', 'aria-hidden': 'true' }),
          h('span', { class: 'scr-opt-main' }, h('span', { class: 'scr-opt-name' }, it.name), h('span', { class: 'scr-opt-meta' }, renderMeta(it, dis, disabledReason)))
        )
      );
    }
  }
  search.addEventListener('input', () => { state.q = search.value.trim(); drawList(); });
  drawChips();
  drawList();
  return { el: root, redraw: drawList };
}

export function render(container, pending, ctx) {
  const clubs = pending.clubs || [];
  const electives = pending.electives || [];
  const needElective = !!pending.needElective;
  let clubId = null;
  let electiveId = null;
  let satGroup = (pending.previous && pending.previous.satGroup) || null;
  let sent = false;
  const satGroups = Array.isArray(pending.satGroups) ? pending.satGroups : [];

  const root = h('div', { class: 'scr scr-term' });
  container.replaceChildren(root);
  root.appendChild(
    h(
      'header',
      { class: 'scr-head' },
      h('h2', { class: 'scr-title' }, pending.title || 'เลือกชุมนุมและวิชาเลือก'),
      pending.text ? h('p', { class: 'scr-text' }, pending.text) : null
    )
  );

  if (pending.hint) root.appendChild(h('div', { class: 'hint-box', role: 'note' }, pending.hint));

  if (pending.canKeep) {
    const prev = pending.previous || {};
    const pc = clubs.find((c) => c.id === prev.clubId);
    const pe = electives.find((e) => e.id === prev.electiveId);
    root.appendChild(h('div', { class: 'scr-block' },
      h('button', { class: 'scr-btn scr-btn-primary scr-btn-wide', type: 'button', style: 'width:100%;min-height:56px', onclick: (ev) => { if (sent) return; sent = true; ev.currentTarget.disabled = true; ctx.act({ keep: true }); } }, 'ใช้ชุมนุมและวิชาเลือกเดิม'),
      h('p', { class: 'scr-muted', style: 'margin-top:6px' }, [pc ? `ชุมนุม ${pc.name}` : null, pe ? `วิชาเลือก ${pe.name}` : null].filter(Boolean).join(' · ') || 'ใช้ตามที่เลือกไว้เมื่อเทอมก่อน'),
      h('p', { class: 'scr-muted' }, 'หรือเลือกใหม่ด้านล่าง')));
  }

  const selClub = h('div', { class: 'scr-sel' });
  const selElec = h('div', { class: 'scr-sel' });
  const confirmBtn = h('button', { class: 'scr-btn scr-btn-primary scr-btn-wide', type: 'button' }, 'ยืนยัน');
  const need = h('div', { class: 'scr-sum-sub' });

  function status() {
    const c = clubs.find((x) => x.id === clubId);
    const e = electives.find((x) => x.id === electiveId);
    selClub.replaceChildren(h('span', { class: 'scr-muted' }, 'ชุมนุม '), h('b', {}, c ? c.name : 'ยังไม่เลือก'));
    selElec.replaceChildren(h('span', { class: 'scr-muted' }, 'วิชาเลือก '), h('b', {}, needElective ? (e ? e.name : 'ยังไม่เลือก') : 'ปีนี้ไม่มี'));
    const missing = [];
    if (clubId == null && clubs.length) missing.push('ชุมนุม');
    if (needElective && electiveId == null && electives.length) missing.push('วิชาเลือก');
    need.textContent = missing.length ? `ยังต้องเลือก: ${missing.join(' และ ')}` : '';
    confirmBtn.disabled = sent || missing.length > 0;
  }

  // ---- clubs ----
  const clubPicker = picker({
    label: 'ชุมนุม',
    items: clubs,
    areaOf: (c) => c.area || '',
    extraFilters: [
      { id: 'student', label: 'นักเรียนจัดเอง', test: (c) => !!c.studentRun },
      { id: 'free', label: 'ยังมีที่ว่าง', test: (c) => (c.seatsLeft == null ? true : c.seatsLeft > 0) },
    ],
    getSelected: () => clubId,
    onPick: (id) => { clubId = id; status(); },
    isDisabled: (c) => c.seatsLeft != null && c.seatsLeft <= 0,
    renderMeta: (c) => [
      c.seatsLeft == null ? null : c.seatsLeft <= 0 ? h('span', { class: 'scr-tag is-bad' }, 'เต็ม') : h('span', { class: 'scr-muted' }, `ที่ว่าง ${c.seatsLeft}`),
      c.studentRun ? h('span', { class: 'scr-tag' }, 'นักเรียนจัด') : null,
      c.area ? h('span', { class: 'scr-muted' }, areaTh(c.area)) : null,
    ],
  });
  root.appendChild(h('section', { class: 'scr-block' }, h('h3', { class: 'scr-sub' }, 'ชุมนุม (เลือก 1)'), clubs.length ? clubPicker.el : h('p', { class: 'scr-empty' }, 'ไม่มีชุมนุมให้เลือก')));

  // ---- electives ----
  root.appendChild(
    needElective
      ? h(
          'section',
          { class: 'scr-block' },
          h('h3', { class: 'scr-sub' }, 'วิชาเลือก พก. (เลือก 1)'),
          electives.length
            ? picker({
                label: 'วิชาเลือก',
                items: electives,
                areaOf: (e) => e.area || '',
                getSelected: () => electiveId,
                onPick: (id) => { electiveId = id; status(); },
                renderMeta: (e) => [e.area ? h('span', { class: 'scr-muted' }, areaTh(e.area)) : null],
              }).el
            : h('p', { class: 'scr-empty' }, 'ไม่มีวิชาเลือกให้เลือก')
        )
      : h('section', { class: 'scr-block' }, h('p', { class: 'scr-hint' }, 'ปีนี้ยังไม่มีวิชาเลือก (พก.) เลือกแค่ชุมนุม'))
  );

  // ---- Saturday lessons (CONTRACT3 section 3): group A-D (4 periods, 08:30-12:00) or the chill Saturday club ----
  if (satGroups.length) {
    const subjName = (x) => (typeof x === 'string' ? x : (x && (x.short || x.name)) || '');
    const satList = h('div', { class: 'scr-pick-list', role: 'radiogroup', 'aria-label': 'เรียนวันเสาร์' });
    const drawSat = () => {
      satList.replaceChildren(...[...satGroups.map((gr) => ({ id: gr.id, name: gr.name || `กลุ่ม ${gr.id}`, meta: (gr.subjects || []).map(subjName).filter(Boolean).join(' · ') })),
        ...(satGroups.some((gr) => gr.id === 'club') ? [] : [{ id: 'club', name: 'ชุมนุมวันเสาร์ (ชิลๆ)', meta: 'ไม่เรียน นั่งเล่นในชุมนุม เครียดลด เพื่อนเพิ่ม' }])].map((it) => {
        const on = satGroup === it.id;
        return h('button', { class: 'scr-opt' + (on ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), onclick: () => { satGroup = on ? null : it.id; drawSat(); } },
          h('span', { class: 'scr-radio', 'aria-hidden': 'true' }),
          h('span', { class: 'scr-opt-main' }, h('span', { class: 'scr-opt-name' }, it.name), h('span', { class: 'scr-opt-meta' }, h('span', { class: 'scr-muted' }, it.meta))));
      }));
    };
    drawSat();
    root.appendChild(h('section', { class: 'scr-block' }, h('h3', { class: 'scr-sub' }, 'เรียนวันเสาร์ (ไม่เลือก = ให้ระบบเลือกให้)'), satList));
  }

  const bar = h('div', { class: 'scr-bar' }, h('div', { class: 'scr-summary' }, selClub, selElec, need), h('div', { class: 'scr-bar-act' }, confirmBtn));
  root.appendChild(bar);
  confirmBtn.addEventListener('click', () => {
    if (sent) return;
    sent = true;
    confirmBtn.disabled = true;
    ctx.act({ clubId, electiveId: needElective ? electiveId : null, ...(satGroup ? { satGroup } : {}) });
  });
  status();
}
