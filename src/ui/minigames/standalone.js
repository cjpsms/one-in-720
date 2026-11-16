// `?mg=<game>` test page: one mini game alone with a fixed seed (`&seed=N` changes it, `&place=hall|fair|stage|lab`, `&d=0..1`
// sets the difficulty). Loaded by src/ui/registry.js. It takes over #view and keeps it, because the app boots to the landing
// page a moment later. The result goes to window.__mgResult and is printed on the page.
import { h } from '../dom.js';
import { mockSpec, MOCK_GAME_IDS } from '../mock-activities.js';
import { render } from '../screens/minigame.js';

const q = new URLSearchParams(location.search);
const game = MOCK_GAME_IDS.includes(q.get('mg')) ? q.get('mg') : 'watch';
const seed = /^\d+$/.test(q.get('seed') || '') ? Number(q.get('seed')) >>> 0 : 20261111;
const PLACE = { watch: 'hall', serve: 'fair', craft: 'fair', pattern: 'activity', dash: 'fair', timing: 'fair', rhythm: 'stage', track: 'stage', sequence: 'stage', steps: 'lab' };

let attempt = 0;
const result = h('pre', { class: 'mg-sa-result', 'aria-live': 'polite' });
const host = h('div', { class: 'mg-sa-host' });
const page = h('main', { class: 'mg-sa card' },
  h('div', { class: 'label', text: 'ทดสอบมินิเกม' }),
  h('nav', { class: 'chips mg-sa-nav', 'aria-label': 'เลือกเกม' }, MOCK_GAME_IDS.map((id) => h('a', { class: 'chip', href: `?mg=${id}&seed=${seed}`, 'aria-current': id === game ? 'page' : null, text: id }))),
  host, result,
  h('button', { type: 'button', class: 'btn block', onclick: () => run() }, 'เล่นอีกครั้ง (ใช้ seed เดิม)'));

function run() {
  attempt++;
  const place = q.get('place') || PLACE[game];
  const difficulty = q.get('d') != null ? Number(q.get('d')) : 0.35;
  const s = mockSpec(game, seed, { difficulty });
  const pending = {
    id: attempt, kind: 'minigame', tag: 'test', game, title: `ทดสอบ ${game}`, text: 'หน้าทดสอบมินิเกม ใช้ข้อมูลจำลอง', clock: 'วันเสาร์ 15:00', seed, difficulty,
    durationSec: s.durationSec, params: s.params, canSkip: q.get('skip') === '1', skipLabel: 'แอบหนีไปนอน', context: { eventId: 'test', stage: 0 }, placeKind: place,
  };
  result.textContent = '';
  host.textContent = '';
  render(host, pending, { view: {}, toast: () => {}, act: (payload) => {
    window.__mgResult = payload;
    result.textContent = `ส่งให้เอนจิน: ${JSON.stringify(payload)}`;
    host.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  } });
}

function takeOver() {
  const view = document.getElementById('view');
  if (!view) return;
  const bar = document.getElementById('bar'); if (bar) bar.hidden = true;
  if (!view.contains(page)) { view.replaceChildren(page); }
}
const start = () => {
  const view = document.getElementById('view');
  takeOver();
  // this observer must exist before the game mounts, so it re-inserts the page before the game's own cleanup check runs
  new MutationObserver(() => { if (!view.contains(page)) takeOver(); }).observe(view, { childList: true });
  run();
  window.__mgReady = true;
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
