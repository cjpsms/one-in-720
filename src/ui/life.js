// The watch-the-days life screen (routine mode, docs/CONTRACT2.md 5): the school runs block by block on a timer
// (game.stepBlock), the day timeline fills in, the pixel scene follows the block's place and the clock, and the game
// rests on week / term / year recap pages. Events appear as a story line, then as the decision sheet.
import { h, setPref, getPrefs, hashStr } from './dom.js';
import { icon } from './icons.js';
import { makeSceneCard, makeStats, makeRecordCard, makeFocusCard, makeDayCard, labelOf } from './parts.js';

export const SPEEDS = [1, 2, 4, 8];
const BLOCK_MS = 700; // 1x: about 0.7 s per block, so a school day (about 15 blocks) takes about 10 s
const LOG_EXTRA_MS = 350; // a block with a log line stays a little longer
const STORY_MS = 1100; // the pause between "something happened" and the options
const AUTO_RECAP_MS = 2000;

const SCENE_OF = { classroom: 'class', lab: 'class', computer: 'class', canteen: 'canteen', coop: 'coop', dorm: 'dorm', dormStudy: 'dorm', field: 'field', gym: 'field', activity: 'assembly', home: 'home', walk: 'yard', hall: 'hall', fair: 'fair', stage: 'stage', infirmary: 'infirmary' };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function mountLife(root, env) {
  const game = env.game(); const record = env.record;
  const prefs = getPrefs();
  let speed = SPEEDS.includes(prefs.speed) ? prefs.speed : (prefs.speed > 8 ? 8 : 1);
  let paused = false;
  let sheetOpen = false; let recapOpen = false; let storyWait = false;
  let busy = false; let alive = true; let skipping = false;
  let lastSave = performance.now();
  let view = game.view();
  let lastBlock = null;
  let timer = 0; let autoTimer = 0;

  // ---------- DOM ----------
  const label = h('div', { class: 'age-label', 'aria-live': 'polite' });
  const dateLine = h('div', { class: 'date-line' });
  const progFill = h('i');
  const prog = h('div', { class: 'yprog', role: 'progressbar', 'aria-label': 'ความคืบหน้าของปีการศึกษา', 'aria-valuemin': '0', 'aria-valuemax': '100' }, progFill);
  const pauseBtn = h('button', { type: 'button', onclick: () => togglePause() });
  const speedBtns = SPEEDS.map((n) => h('button', { type: 'button', text: `${n}×`, 'aria-label': `ความเร็ว ${n} เท่า`, onclick: () => setSpeed(n) }));
  const menuBtn = h('button', { type: 'button', 'aria-label': 'เมนู', onclick: () => env.openMenu() }, icon('dots', 20));
  const speedRow = h('div', { class: 'speed-row', role: 'group', 'aria-label': 'ความเร็วของเวลา' }, pauseBtn, speedBtns, menuBtn);
  const dayBtn = h('button', { type: 'button', text: 'ข้ามวัน', 'aria-label': 'ข้ามไปจบวันนี้', onclick: () => skip('day') });
  const weekBtn = h('button', { type: 'button', text: 'ข้ามสัปดาห์', 'aria-label': 'ข้ามไปสรุปสัปดาห์', onclick: () => skip('week') });
  const nextBtn = h('button', { type: 'button', text: 'ถึงเรื่องถัดไป »', 'aria-label': 'ข้ามไปถึงการตัดสินใจถัดไป', onclick: () => skip('decision') });
  const skipRow = h('div', { class: 'speed-row skip-row', role: 'group', 'aria-label': 'ข้ามเวลา' }, dayBtn, weekBtn, nextBtn);
  const stats = makeStats();
  const clrChip = h('div', { class: 'clr-chip', hidden: true });
  const epiChip = h('div', { class: 'epi-chip', role: 'status', hidden: true });
  const closedBanner = h('div', { class: 'closed-banner', role: 'status', hidden: true }, 'หยุดเรียน โรงเรียนปิดชั่วคราวเพราะโรคระบาด');
  const head = h('header', { class: 'life-head' }, h('div', { class: 'age-row' }, label, dateLine), prog, h('div', { class: 'chip-row' }, clrChip, epiChip), closedBanner, speedRow, skipRow, stats.miniEl);
  const sceneCard = makeSceneCard();
  const dayCard = makeDayCard();
  const recCard = makeRecordCard(record, () => (view && view.me ? view.me.name : ''), () => env.openLog());
  const focusCard = makeFocusCard((key, value) => {
    try {
      const r = game.setRoutine({ [key]: value });
      if (r && r.ok === false) { env.toast(r.error || 'ตั้งโฟกัสไม่ได้'); focusCard.update(game.view()); return; }
      env.toast('บันทึกโฟกัสแล้ว'); env.save();
    } catch (e) { env.toast('ตั้งโฟกัสไม่ได้'); console.warn(e); }
  });
  const main = h('div', { class: 'life-main' }, sceneCard.el, dayCard.el, stats.el, focusCard.el, recCard.el);
  root.append(h('div', { class: 'life' }, head, main));

  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((es) => { const e = es[0]; head.classList.toggle('scrolled', !e.isIntersecting && e.boundingClientRect.top < 0); }, { threshold: 0 });
    io.observe(stats.el);
  }

  // ---------- painting ----------
  function paintSpeed() {
    pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause', 18));
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'เล่นต่อ (เว้นวรรค)' : 'หยุดเวลา (เว้นวรรค)');
    speedBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(!paused && SPEEDS[i] === speed)));
    [dayBtn, weekBtn, nextBtn].forEach((b) => { b.disabled = skipping; });
    recCard.setLive(paused);
  }
  function currentBlock() {
    const bl = view.day && view.day.blocks;
    return bl ? (bl.find((b) => b.current) || bl[bl.length - 1]) : null;
  }
  function paintScene() {
    const me = view.me || {};
    let b = lastBlock; let kindSrc = lastBlock;
    if (!b) { const c = currentBlock(); b = c; kindSrc = c; }
    let kind = 'yard'; let hour = (view.clock && view.clock.minute != null ? view.clock.minute : 480) / 60; let title = view.place || ''; let sub = view.clock ? view.clock.label : '';
    if (b) {
      kind = SCENE_OF[b.placeKind] || 'yard';
      const m = b.minute != null ? b.minute : (() => { const [a, c] = String(b.from).split(':').map(Number); return a * 60 + c; })();
      hour = m / 60; title = b.place || title;
      sub = `${b.from || ''} · ${b.what || ''}`;
      if ((kind === 'field' || kind === 'yard' || kind === 'assembly') && /กีฬาสี|แสตน|เชียร์/.test(`${b.what || ''}${b.place || ''}`)) kind = 'sports';
      if (kind === 'hall' && /คริสต์มาส|ซานต้า/.test(`${b.what || ''}${b.place || ''}`)) kind = 'hallxmas';
      if (kind === 'assembly' && hour > 8.6) kind = b.placeKind === 'activity' ? 'class' : 'yard';
    }
    sceneCard.set({ kind, hour, seed: hashStr(me.name || 'x'), title, sub });
  }
  function paintHead() {
    const p = view.progress || {}; const me = view.me || {};
    label.textContent = labelOf(view);
    const t = lastBlock ? lastBlock.from : (currentBlock() ? currentBlock().from : '');
    dateLine.textContent = `${view.day ? view.day.label : ''}${t ? ' · ' + t : ''} · ${me.name || ''} ม.${me.grade || 1}/${me.room || 1}`;
    const frac = p.daysInYear ? Math.max(0, Math.min(1, (p.dayInYear || 0) / p.daysInYear)) : 0;
    progFill.style.width = `${(frac * 100).toFixed(1)}%`;
    // colour team chip (view().me.color = { id, th })
    const col = me.color;
    if (col && col.id) { clrChip.className = `clr-chip clr-${col.id}`; clrChip.replaceChildren(h('i'), /^สี/.test(col.th || '') ? col.th : `สี${col.th || col.id}`); clrChip.hidden = false; } else clrChip.hidden = true;
    // epidemic chip + closed-school banner (view().epidemic = { name, sickShare, suspended } or null; CONTRACT3 section 11)
    const ep = view.epidemic;
    if (ep && ep.name) {
      const share = Number(ep.sickShare) || 0; const pc = Math.round(share > 1 ? share : share * 100);
      epiChip.textContent = `โรคระบาด: ${ep.name} ${pc}%`; epiChip.hidden = false;
      epiChip.classList.toggle('hot', !!ep.suspended || pc >= 20);
      closedBanner.hidden = !ep.suspended;
    } else { epiChip.hidden = true; closedBanner.hidden = true; }
    prog.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  }
  function refreshUi(freshCount, live) {
    view = game.view();
    if (view.me && view.me.grade) (env.meta.rooms || (env.meta.rooms = {}))[view.me.grade] = `ม.${view.me.grade}/${view.me.room}`;
    env.meta.name = view.me ? view.me.name : env.meta.name;
    env.meta.label = labelOf(view);
    paintHead(); paintScene(); dayCard.update(view); markPlaces(); stats.update(view, { animate: !!live }); focusCard.update(view); recCard.refresh(freshCount);
  }

  // festival places get a coloured edge on the timeline (css: .pk-hall / .pk-fair / .pk-stage)
  function markPlaces() {
    const bl = (view.day && view.day.blocks) || [];
    dayCard.el.querySelectorAll('.tl-item').forEach((li, i) => { const k = bl[i] && bl[i].placeKind; if (k === 'hall' || k === 'fair' || k === 'stage' || k === 'infirmary') li.classList.add(`pk-${k}`); if (/กีฬาสี/.test(`${bl[i] && bl[i].what}`) && view.me && view.me.color) li.classList.add('pk-sports', `clr-${view.me.color.id}`); });
  }
  function setSpeed(n) { speed = n; paused = false; setPref('speed', n); paintSpeed(); kick(); }
  function togglePause() { paused = !paused; paintSpeed(); if (paused) env.save(); else kick(); }
  function blocked() { return paused || sheetOpen || recapOpen || storyWait || busy || skipping || !!document.querySelector('dialog[open]'); }

  // ---------- decisions, stories, recaps ----------
  async function openDecision() {
    const p = game.pending;
    if (!p) return;
    if (p.final) { sheetOpen = false; env.sheet.close(); env.onEnding(); return; }
    sheetOpen = true;
    await env.sheet.show(p, { view, act: answer, toast: env.toast, defaultPayload: () => game.defaultPayload() });
  }
  function announce() {
    const p = game.pending;
    if (!p) return false;
    if (p.final || (p.kind !== 'scene' && p.kind !== 'minigame')) { storyWait = true; setTimeout(() => { storyWait = false; openDecision(); }, 350); return true; }
    storyWait = true;
    dayCard.setStory(`${p.kind === 'minigame' ? 'ถึงเวลา' : 'เกิดเรื่องขึ้น'} · ${p.title || ''}`);
    setTimeout(() => { dayCard.setStory(''); storyWait = false; openDecision(); }, STORY_MS);
    return true;
  }
  async function answer(payload) {
    if (busy) return;
    busy = true;
    let res = null;
    try { res = game.act(payload); } catch (e) { busy = false; env.toast(`ตอบไม่ได้: ${e && e.message ? e.message : e}`); await openDecision(); return; }
    if (res && res.ok === false) { busy = false; env.toast(res.error || 'ตอบไม่ได้'); await openDecision(); return; }
    const fresh = record.add(res && res.log);
    env.save();
    busy = false;
    refreshUi(fresh.length, true);
    if (game.pending) { await openDecision(); return; }
    sheetOpen = false; env.sheet.close(); kick();
  }
  function showRecap(recap) {
    recapOpen = true;
    const auto = speed >= 8 && recap.kind === 'week';
    env.sheet.showRecap(recap, {
      schoolMap: view.schoolMap, me: view.me, autoNote: auto ? 'ไปต่ออัตโนมัติใน 2 วินาที' : '',
      onContinue: () => { clearTimeout(autoTimer); env.sheet.close(); recapOpen = false; if (game.pending) announce(); else kick(); },
    });
    if (auto) autoTimer = setTimeout(() => { if (recapOpen) { const b = document.querySelector('#sheet-body .recap .btn.primary'); if (b) b.click(); } }, AUTO_RECAP_MS);
  }
  // after any step (single or skipped): record lines, UI, then the recap page / the story / nothing
  function afterStep(res, live) {
    const fresh = record.add(res.log);
    if (res.block) lastBlock = res.block;
    refreshUi(fresh.length, live);
    const rc = (res.weekEnded || res.termEnded || res.yearEnded) ? (view.recap || { kind: res.yearEnded ? 'year' : res.termEnded ? 'term' : 'week', label: labelOf(view), rows: [], highlights: [] }) : null;
    if (rc) {
      if (rc.kind === 'week') record.add([{ text: `${(rc.label || '').split(' · ')[0] || 'สัปดาห์'} จบแล้ว`, tone: 'neutral', day: view.clock ? view.clock.day : null, yearLabel: view.me ? `ม.${view.me.grade}` : '' }]);
      recCard.refresh(1);
      env.save();
      showRecap(rc);
      return true;
    }
    if (game.pending) { announce(); return true; }
    return false;
  }

  // ---------- the clock ----------
  function kick() { clearTimeout(timer); timer = setTimeout(loop, 60); }
  function loop() {
    if (!alive) return;
    if (blocked()) { timer = setTimeout(loop, 150); return; }
    let res = null;
    try { res = game.stepBlock(); } catch (e) { console.warn(e); paused = true; paintSpeed(); env.toast(`เดินเวลาไม่ได้: ${e && e.message ? e.message : e}`); timer = setTimeout(loop, 300); return; }
    if (!res || res.ok === false) { paused = true; paintSpeed(); env.toast((res && res.error) || 'เดินเวลาไม่ได้'); timer = setTimeout(loop, 300); return; }
    const stopped = afterStep(res, true);
    const now = performance.now();
    if (now - lastSave > 8000 || res.dayEnded && now - lastSave > 3000) { lastSave = now; env.save(); }
    const extra = res.log && res.log.length ? LOG_EXTRA_MS : 0;
    timer = setTimeout(loop, stopped ? 150 : (BLOCK_MS + extra) / speed);
  }

  async function skip(what) {
    if (skipping || sheetOpen || recapOpen || storyWait || busy || document.querySelector('dialog[open]')) return;
    skipping = true; paintSpeed();
    await new Promise((r) => setTimeout(r, 20));
    const agg = { log: [], block: null, weekEnded: false, termEnded: false, yearEnded: false, dayEnded: false };
    let guard = 0;
    try {
      while (alive && guard++ < 6000) {
        const r = game.stepBlock();
        if (!r || r.ok === false) { env.toast((r && r.error) || 'ข้ามเวลาไม่สำเร็จ'); break; }
        if (r.log) agg.log = agg.log.concat(r.log);
        if (r.block) agg.block = r.block;
        for (const k of ['weekEnded', 'termEnded', 'yearEnded', 'dayEnded']) agg[k] = agg[k] || !!r[k];
        if (r.pending || r.weekEnded || r.termEnded || r.yearEnded) break;
        if (what === 'day' && r.dayEnded) break;
        if (guard % 60 === 0) await new Promise((x) => setTimeout(x, 0));
      }
    } catch (e) { env.toast(`ข้ามเวลาไม่สำเร็จ: ${e && e.message ? e.message : e}`); }
    skipping = false; paintSpeed();
    if (!alive) return;
    env.save();
    if (!afterStep(agg, false)) kick();
  }

  const onKey = (ev) => {
    if (ev.code !== 'Space' || ev.repeat) return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    ev.preventDefault(); togglePause();
  };
  const onVis = () => { if (document.hidden) env.save(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);

  // ---------- start ----------
  // the menu's mini game choice (play / auto) is a preference; apply it to this life
  if (typeof game.setMiniGames === 'function' && (prefs.miniGames === 'auto' || prefs.miniGames === 'play') && view.miniGames && view.miniGames !== prefs.miniGames) {
    try { game.setMiniGames(prefs.miniGames); } catch (e) { console.warn(e); }
  }
  paintSpeed();
  refreshUi(0, false);
  recCard.render();
  if (game.pending) announce(); else kick();

  return {
    destroy() { alive = false; clearTimeout(timer); clearTimeout(autoTimer); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); if (io) io.disconnect(); sceneCard.destroy(); },
    pause() { paused = true; paintSpeed(); },
    setSpeed(n) { if (SPEEDS.includes(n)) { speed = n; paintSpeed(); } },
    refresh() { refreshUi(0, false); recCard.render(); },
    get view() { return view; },
  };
}
