// The decision sheet: a modal bottom sheet that hosts any pending screen (scene, focus, termStart, snaps, gate, report ...).
import { SCREENS } from './registry.js';
import { h } from './dom.js';
import { render as renderRecap } from './screens/recap.js';

export function createSheet(dialog, body) {
  dialog.addEventListener('cancel', (ev) => ev.preventDefault()); // a decision cannot be dismissed with Esc
  let token = 0;
  let cleanup = null;
  const runCleanup = () => { if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; } };
  return {
    get isOpen() { return dialog.open; },
    showRecap(recap, ctx) {
      token++; runCleanup();
      cleanup = renderRecap(body, recap, ctx);
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
    },
    async show(pending, ctx) {
      const my = ++token;
      runCleanup();
      let mod = null;
      try {
        const loader = SCREENS[pending.kind];
        if (!loader) throw new Error(`ไม่รู้จักหน้าจอชนิด ${pending.kind}`);
        mod = await loader();
      } catch (e) {
        if (my !== token) return;
        body.textContent = '';
        body.append(h('section', { class: 'scene' },
          h('h2', { class: 'scene-title', text: pending.title || 'หน้าจอยังไม่พร้อม' }),
          pending.text ? h('p', { class: 'scene-text', text: pending.text }) : null,
          h('p', { class: 'muted small', text: `หน้าจอ "${pending.kind}" โหลดไม่ได้ (${e && e.message ? e.message : e})` }),
          h('button', { type: 'button', class: 'btn primary block', onclick: () => ctx.act(ctx.defaultPayload()) }, 'ใช้ค่าเริ่มต้นแล้วไปต่อ')));
        if (!dialog.open) dialog.showModal();
        return;
      }
      if (my !== token) return;
      body.textContent = '';
      mod.render(body, pending, ctx);
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = 0;
      const first = body.querySelector('button, [tabindex]');
      if (first && first.focus) first.focus({ preventScroll: true });
    },
    close() { token++; runCleanup(); if (dialog.open) dialog.close(); body.textContent = ''; },
  };
}
