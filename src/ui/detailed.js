// Detailed mode: every meal, class block and evening is a pending screen (the old flow), restyled to the same look.
import { h } from './dom.js';
import { SCREENS, STOP_KINDS } from './registry.js';
import { renderHeader } from './screens/status.js';
import { makeSceneCard, labelOf } from './parts.js';
import { classifyPlace } from './pixelscene.js';
import { hashStr } from './dom.js';

const NOTICE_MAX = 6;

export function mountDetailed(root, env) {
  const game = env.game(); const record = env.record;
  let busy = false; let alive = true; let token = 0;
  const header = h('header', { class: 'detail-head' });
  const notice = h('div', { class: 'notice', role: 'status', 'aria-live': 'polite', hidden: true });
  const screen = h('div', { class: 'screen-host' });
  const dock = h('div', { class: 'dock', hidden: true });
  const sceneCard = makeSceneCard();
  const main = h('main', { class: 'detail-main', tabindex: '-1' }, sceneCard.el, notice, screen);
  root.append(h('div', { class: 'detailed' }, header, main, dock));

  function showNotice(lines) {
    notice.textContent = '';
    if (!lines.length) { notice.hidden = true; return; }
    const shown = lines.slice(-NOTICE_MAX);
    notice.append(h('ul', null, shown.map((l) => h('li', { class: l.tone ? `tone-${l.tone}` : '', text: l.text }))));
    if (lines.length > shown.length) notice.append(h('div', { class: 'more', text: `และอีก ${lines.length - shown.length} เหตุการณ์ก่อนหน้า (ดูในบันทึก)` }));
    notice.hidden = false;
  }

  async function render() {
    if (!alive) return;
    const my = ++token;
    const view = game.view(); const pending = game.pending;
    env.meta.name = view.me ? view.me.name : env.meta.name;
    env.meta.label = labelOf(view);
    if (view.me && view.me.grade) (env.meta.rooms || (env.meta.rooms = {}))[view.me.grade] = `ม.${view.me.grade}/${view.me.room}`;
    renderHeader(header, view, { openStatus: env.openStatus, openLog: env.openLog, openMenu: env.openMenu });
    const minute = view.clock ? view.clock.minute : 480;
    sceneCard.set({ kind: classifyPlace(view.place, minute), hour: (minute || 0) / 60, seed: hashStr((view.me && view.me.name) || 'x'), title: view.place || '', sub: view.clock ? view.clock.label : '' });
    if (!pending) { screen.textContent = ''; return; }
    if (pending.final) { env.onEnding(); return; }
    let mod = null;
    try {
      const loader = SCREENS[pending.kind];
      if (!loader) throw new Error(`ไม่รู้จักหน้าจอชนิด ${pending.kind}`);
      mod = await loader();
    } catch (e) {
      if (my !== token) return;
      screen.textContent = '';
      screen.append(h('section', { class: 'card' }, h('h2', { text: pending.title || 'หน้าจอยังไม่พร้อม' }), pending.text ? h('p', { text: pending.text }) : null,
        h('button', { type: 'button', class: 'btn primary block', onclick: () => act(game.defaultPayload()) }, 'ใช้ค่าเริ่มต้นแล้วไปต่อ')));
      return;
    }
    if (my !== token) return;
    screen.textContent = '';
    mod.render(screen, pending, { view, act, toast: env.toast, restart: env.startNew });
    dock.textContent = '';
    const canSkip = !STOP_KINDS.includes(pending.kind);
    if (canSkip) dock.append(h('button', { type: 'button', class: 'btn block', onclick: fastForward }, 'ข้ามไปจนถึงการตัดสินใจถัดไป'));
    dock.hidden = !canSkip;
    window.scrollTo(0, 0);
  }

  async function act(payload) {
    if (busy) return;
    busy = true;
    let res = null;
    try { res = game.act(payload); } catch (e) { busy = false; env.toast(`ส่งคำตอบไม่ได้: ${e && e.message ? e.message : e}`); await render(); return; }
    if (res && res.ok === false) { busy = false; env.toast(res.error || 'ตอบไม่ได้'); await render(); return; }
    record.add(res && res.log);
    showNotice((res && res.log) || []);
    env.save();
    busy = false;
    await render();
  }

  async function fastForward() {
    if (busy) return;
    busy = true;
    const btn = dock.querySelector('button');
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังข้ามเวลา...'; }
    await new Promise((r) => setTimeout(r, 30));
    let res = null;
    try { res = game.fastForward(STOP_KINDS); } catch (e) { env.toast(`ข้ามเวลาไม่สำเร็จ: ${e && e.message ? e.message : e}`); }
    const lines = (res && res.log) || [];
    record.add(lines);
    showNotice(lines.length ? lines : [{ text: 'ข้ามเวลามาจนถึงการตัดสินใจถัดไป', tone: 'neutral' }]);
    env.save();
    busy = false;
    await render();
  }

  render();
  return {
    destroy() { alive = false; sceneCard.destroy(); },
    pause() {},
    refresh() { render(); },
  };
}
