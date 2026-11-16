// Screen for pending.kind === 'minigame' (docs/CONTRACT3.md sections 4 and 8): place scene + title + the game itself,
// a "ให้ระบบเล่นให้" button (the system plays with the game's bot score) and, for hall lectures, a skip button.
// Payload: { score, stats?, auto? } or { skip:true }.
import { h } from '../dom.js';
import { Rng } from '../../rng.js';
import { loadGame } from '../minigames/index.js';
import { makeSceneCard } from '../parts.js';
import { onRemoved, tierOf, pct, botScore } from '../minigames/kit.js';

const SCENE_OF = { infirmary: 'infirmary', hall: 'hall', fair: 'fair', stage: 'stage', lab: 'class', classroom: 'class', activity: 'class', canteen: 'canteen' };
const DEFAULT_HOUR = { hall: 14, fair: 18.6, stage: 20, lab: 10, classroom: 10, activity: 15 };

function hourOf(pending) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(pending.clock || ''));
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  return DEFAULT_HOUR[pending.placeKind] || 12;
}

export function render(container, pending, ctx) {
  container.textContent = '';
  let sent = false; let game = null; let mod = null; let alive = true; let autoShown = false;
  const spec = pending;

  const scene = makeSceneCard();
  const xmas = pending.placeKind === 'hall' && /xmas|คริสต์มาส|ซานต้า/i.test(`${(pending.context && pending.context.eventId) || ''}${pending.title || ''}`);
  const sports = /^sport/.test(String((pending.context && pending.context.eventId) || pending.tag || ''));
  scene.set({ kind: xmas ? 'hallxmas' : sports ? 'sports' : (SCENE_OF[pending.placeKind] || 'yard'), hour: hourOf(pending), seed: (Number(pending.seed) || 1) >>> 0, title: pending.title || '', sub: pending.clock || '' });
  const area = h('div', { class: 'mg-area', 'aria-live': 'polite' }, h('p', { class: 'muted small mg-loading', text: 'กำลังเตรียมเกม...' }));
  const how = h('p', { class: 'mg-how', text: '' });
  const send = (payload) => {
    if (sent) return;
    sent = true;
    container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    ctx.act(payload);
  };
  const autoBtn = h('button', { type: 'button', class: 'btn block mg-auto', 'data-mg-auto': '', onclick: () => autoPlay() }, 'ให้ระบบเล่นให้');
  const skipBtn = pending.canSkip ? h('button', { type: 'button', class: 'btn block mg-skip', onclick: () => send({ skip: true }) }, pending.skipLabel || 'ข้ามไป') : null;
  const actions = h('div', { class: 'mg-actions' }, autoBtn, skipBtn);
  const head = h('div', { class: 'mg-head' },
    pending.clock ? h('p', { class: 'scene-clock', text: pending.clock }) : null,
    h('h2', { class: 'mg-title', text: pending.title || 'มินิเกม' }),
    pending.text ? h('p', { class: 'mg-text', text: pending.text }) : null);
  const root = h('section', { class: 'mg-screen', 'data-game': pending.game || '' }, h('div', { class: 'mg-intro-card' }, scene.el), head, how, area, actions);
  container.append(root);
  root.addEventListener('mg:start', () => root.classList.add('is-playing'));

  function teardown() {
    alive = false;
    if (game && game.destroy) { try { game.destroy(); } catch (e) { console.warn(e); } }
    game = null;
    scene.destroy();
  }
  onRemoved(root, teardown);

  function autoScore() {
    try { if (mod && typeof mod.bot === 'function') { const v = Number(mod.bot(spec, new Rng(((Number(spec.seed) | 0) ^ 0x2a2a) >>> 0 || 1))); if (Number.isFinite(v)) return Math.max(0, Math.min(1, v)); } } catch (e) { console.warn(e); }
    return botScore(spec, new Rng(((Number(spec.seed) | 0) ^ 0x2a2a) >>> 0 || 1));
  }
  function autoPlay() {
    if (sent || autoShown) return;
    autoShown = true;
    const score = autoScore();
    if (game && game.destroy) { try { game.destroy(); } catch { /* ignore */ } game = null; }
    const t = tierOf(score);
    const next = h('button', { type: 'button', class: 'btn primary', onclick: () => send({ auto: true, score, stats: {} }) }, 'ต่อไป');
    area.replaceChildren(h('div', { class: 'mg mg-autores' }, h('div', { class: 'mg-res', role: 'status' },
      h('div', { class: 'label', text: 'ระบบเล่นให้' }), h('div', { class: `mg-tier t-${t.id}`, text: t.th }), h('div', { class: 'mg-pct', text: `${pct(score)}%` }), next)));
    root.classList.add('is-playing'); autoBtn.hidden = true;
    try { next.focus({ preventScroll: true }); } catch { /* ignore */ }
  }

  loadGame(pending.game).then((m) => {
    if (!alive || sent) return;
    mod = m;
    area.replaceChildren();
    if (!m) {
      area.append(h('div', { class: 'mg-missing' }, h('p', { class: 'muted', text: 'เกมนี้ยังโหลดไม่ได้ ให้ระบบเล่นให้แทนได้เลย' })));
      autoBtn.classList.add('primary');
      return;
    }
    how.textContent = m.INFO && m.INFO.how ? m.INFO.how : '';
    try {
      game = m.play(area, spec, (r) => {
        const res = r || {};
        send({ score: Number.isFinite(res.score) ? Math.max(0, Math.min(1, res.score)) : 0, stats: res.stats || {}, ...(res.auto ? { auto: true } : {}) });
      });
    } catch (e) {
      console.warn('[one-in-720] mini game failed to start', e);
      area.replaceChildren(h('p', { class: 'muted', text: 'เริ่มเกมไม่สำเร็จ ให้ระบบเล่นให้แทนได้เลย' }));
      autoBtn.classList.add('primary');
      return;
    }
    if (area.querySelector('.mg-intro') || (how.textContent && area.textContent.includes(how.textContent.slice(0, 14)))) how.textContent = ''; // the game's own start overlay already says it
    // a game that draws its own auto-play button: hide ours
    if ([...area.querySelectorAll('button')].some((b) => /ให้ระบบเล่นให้/.test(b.textContent))) autoBtn.hidden = true;
  });
}
