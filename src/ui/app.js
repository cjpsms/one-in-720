// App shell: boot, landing / birth / life / ending views, save + continue, menu. Engine API: docs/CONTRACT.md + CONTRACT2.md.
import { getEngine } from './api.js';
import { h, applyTheme, getPrefs, lsSet, lsGetJson } from './dom.js';
import { createRecord, loadKeep } from './record.js';
import { createSheet } from './sheet.js';
import { showLanding } from './landing.js';
import { playRoll, showBirthCard } from './birth.js';
import { mountLife } from './life.js';
import { mountDetailed } from './detailed.js';
import { showEnding } from './ending.js';
import { openMenu, openLog, openStatus, openKeep } from './menu.js';

const SAVE_KEY = 'one-in-720-save-v2';
const $ = (id) => document.getElementById(id);
const els = {
  view: $('view'), bar: $('bar'), toast: $('toast'), sheetDlg: $('dlg-sheet'), sheetBody: $('sheet-body'),
  dlgMenu: $('dlg-menu'), menuBody: $('menu-body'), dlgLog: $('dlg-log'), logList: $('log-list'),
  dlgStatus: $('dlg-status'), statusBody: $('status-body'), dlgKeep: $('dlg-keep'), keepBody: $('keep-body'),
};

let api = null;
let game = null;
let kind = 'real'; // 'real' | 'mock' (which engine made the current life)
let mode = 'routine';
let meta = { rooms: {}, name: '', label: '', lifeId: '' };
let record = createRecord('none');
let note = '';
let current = null; // the mounted view controller ({ destroy, ... })
let ending = false;
let toastTimer = 0;
let saveWarned = false;
const sheet = createSheet(els.sheetDlg, els.sheetBody);

applyTheme();

// ---------- toast / errors ----------
function toast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function showError(message, detail) {
  console.warn('[one-in-720]', message, detail || '');
  teardown();
  els.bar.hidden = true;
  els.view.textContent = '';
  els.view.append(h('section', { class: 'card err', role: 'alert' },
    h('h2', { text: 'มีบางอย่างผิดพลาด' }),
    h('p', { text: message }),
    detail ? h('pre', { text: String(detail && detail.message ? detail.message : detail).slice(0, 300) }) : null,
    h('div', { class: 'stack' },
      game ? h('button', { type: 'button', class: 'btn primary block', onclick: () => enterLife() }, 'ลองแสดงหน้านี้ใหม่') : null,
      hasSave() ? h('button', { type: 'button', class: 'btn block', onclick: () => continueLife() }, 'โหลดเซฟล่าสุด') : null,
      h('button', { type: 'button', class: 'btn danger block', onclick: () => goLanding(false) }, 'กลับหน้าแรก'))));
}
window.addEventListener('error', (ev) => showError('เกิดข้อผิดพลาดที่ไม่คาดคิดในหน้าเว็บ', ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => showError('เกิดข้อผิดพลาดที่ไม่คาดคิดในหน้าเว็บ', ev.reason));

// ---------- save / load ----------
function readWrap() {
  const w = lsGetJson(SAVE_KEY, null);
  return w && typeof w.save === 'string' ? w : null;
}
function hasSave() { return !!readWrap(); }
function save() {
  if (!game) return false;
  let text;
  try { text = game.save(); } catch (e) { console.warn('[one-in-720] save failed', e); return false; }
  const ok = lsSet(SAVE_KEY, JSON.stringify({ v: 2, kind, mode, save: text, meta, ts: Date.now() }));
  if (!ok && !saveWarned) { saveWarned = true; toast('เก็บเซฟในเบราว์เซอร์ไม่ได้ (พื้นที่เต็มหรือถูกปิดไว้)'); }
  return ok;
}

// ---------- view plumbing ----------
function teardown() {
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.warn(e); } }
  current = null;
  sheet.close();
}
function newSeed() {
  const q = new URLSearchParams(location.search).get('seed');
  if (q && /^\d+$/.test(q)) return Number(q) >>> 0;
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return (Date.now() >>> 0); }
}

const env = {
  els, toast, save, hasSave,
  get meta() { return meta; },
  get record() { return record; },
  get sheet() { return sheet; },
  last: () => { const w = readWrap(); return w && w.meta ? { name: w.meta.name, label: w.meta.label } : null; },
  game: () => game,
  mode: () => mode,
  note: () => note,
  keepCount: () => loadKeep().length,
  keepAll: () => { record.reloadKeep(); return record.keep; },
  startNew: (o) => startNew(o),
  continueLife: () => continueLife(),
  goLanding: () => goLanding(true),
  onEnding: () => goEnding(),
  openMenu: () => openMenu(menuEnv),
  openLog: () => openLog(menuEnv),
  openStatus: () => openStatus(menuEnv),
  openKeep: () => openKeep(menuEnv),
  setSpeed: (n) => { if (current && current.setSpeed) current.setSpeed(n); },
  themeChanged: () => { if (current && current.redraw) current.redraw(); },
};
const menuEnv = {
  els, toast, save, hasSave, game: env.game, mode: env.mode, note: env.note, record: () => record, keepAll: env.keepAll,
  startNew: env.startNew, continueLife: env.continueLife, goLanding: env.goLanding, openLog: env.openLog, openStatus: env.openStatus, openKeep: env.openKeep,
  setSpeed: env.setSpeed, themeChanged: env.themeChanged,
};

// ---------- flows ----------
function goLanding(saveFirst = true) {
  if (saveFirst && game) save();
  teardown();
  game = null; ending = false;
  els.view.textContent = '';
  els.bar.hidden = true;
  current = showLanding(env);
}

async function startNew() {
  teardown();
  els.bar.hidden = true;
  const m = getPrefs().mode === 'detailed' ? 'detailed' : 'routine';
  let made;
  try { made = await api.createGame({ seed: newSeed(), mode: m, miniGames: getPrefs().miniGames === 'auto' ? 'auto' : 'play' }); } catch (e) { showError('เริ่มชีวิตใหม่ไม่ได้', e); return; }
  game = made.game; kind = made.kind; mode = m; note = made.note || ''; ending = false;
  const v0 = game.view();
  meta = { rooms: {}, name: v0.me ? v0.me.name : '', label: '', lifeId: `${Date.now().toString(36)}-${v0.me ? v0.me.name : ''}` };
  record = createRecord(meta.lifeId);
  record.reset(v0.record);
  save();
  els.view.textContent = '';
  try { await playRoll(v0); } catch (e) { console.warn(e); }
  teardown();
  current = showBirthCard(env, v0, game.pending, onBegin);
}

function onBegin() {
  const p = game.pending;
  if (p && p.kind === 'scene' && !p.final && (p.tag === 'intro' || (p.options && p.options.length === 1))) {
    try {
      const res = game.act(game.defaultPayload());
      if (res && res.ok === false) toast(res.error || 'เริ่มไม่ได้');
      record.add(res && res.log);
    } catch (e) { showError('เริ่มชีวิตไม่ได้', e); return; }
  }
  save();
  enterLife();
}

function enterLife() {
  teardown();
  els.view.textContent = '';
  els.bar.hidden = true;
  if (!game) { goLanding(false); return; }
  if (game.pending && game.pending.final) { goEnding(); return; }
  try {
    current = mode === 'detailed' ? mountDetailed(els.view, env) : mountLife(els.view, env);
  } catch (e) { showError('แสดงหน้าชีวิตไม่ได้', e); return; }
  window.scrollTo(0, 0);
}

function goEnding() {
  if (ending) return;
  ending = true;
  teardown();
  els.view.textContent = '';
  save();
  try { current = showEnding(env, game.view(), game.pending); } catch (e) { ending = false; showError('แสดงหน้าตอนจบไม่ได้', e); }
}

async function continueLife() {
  const w = readWrap();
  if (!w) { toast('ไม่พบเซฟ'); return; }
  teardown();
  try {
    game = await api.loadGame(w.kind === 'mock' ? 'mock' : 'real', w.save);
  } catch (e) { game = null; showError('โหลดเซฟไม่ได้ (ไฟล์เซฟอาจเสีย หรือมาจากเวอร์ชันอื่น)', e); return; }
  kind = w.kind === 'mock' ? 'mock' : 'real'; mode = w.mode === 'detailed' ? 'detailed' : 'routine'; ending = false;
  meta = { rooms: {}, name: '', label: '', lifeId: 'x', ...(w.meta || {}) };
  note = kind === 'mock' ? 'ใช้ข้อมูลทดลอง (mock)' : '';
  record = createRecord(meta.lifeId || 'x');
  record.reset(game.view().record);
  enterLife();
  toast('โหลดเซฟแล้ว');
}

// ---------- dialogs ----------
document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog.sheet').forEach((d) => {
  if (d.id === 'dlg-sheet') return;
  d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
});

// ---------- boot ----------
async function boot() {
  try { api = await getEngine(); } catch (e) { showError('เริ่มเกมไม่ได้ (โหลดเอนจินไม่สำเร็จ)', e); return; }
  const q = new URLSearchParams(location.search);
  if (q.get('mg')) return; // ?mg=<game>: the mini game test page (src/ui/minigames/standalone.js, loaded by registry.js) owns the page
  if (q.get('new') === '1') { startNew(); return; }
  goLanding(false);
}
boot();
