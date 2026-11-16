// Menu, full record, status and keepsakes dialogs.
import { h, getPrefs, setPref, shortYear } from './dom.js';
import { STATUS_SCREEN } from './registry.js';

function seg(label, options, current, onPick) {
  const btns = options.map(([value, text]) => h('button', { type: 'button', text, 'aria-pressed': String(value === current), onclick: () => {
    onPick(value);
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i][0] === value)));
  } }));
  return h('div', { class: 'menu-sec' }, h('div', { class: 'ml', text: label }), h('div', { class: 'seg-row', role: 'group', 'aria-label': label }, btns));
}

function confirmButton(label, confirmLabel, onConfirm) {
  const btn = h('button', { type: 'button', class: 'btn danger block' }, label);
  let armed = false;
  btn.addEventListener('click', () => {
    if (!armed) { armed = true; btn.textContent = confirmLabel; setTimeout(() => { armed = false; btn.textContent = label; }, 4000); return; }
    onConfirm();
  });
  return btn;
}

// mini games: play them yourself or let the system play (docs/CONTRACT3.md section 4: game.setMiniGames)
function miniGamesSeg(env, prefs) {
  const g = env.game();
  let cur = prefs.miniGames === 'auto' ? 'auto' : 'play';
  try { const v = g && g.view ? g.view().miniGames : null; if (v === 'auto' || v === 'play') cur = v; } catch { /* ignore */ }
  return seg('มินิเกม', [['play', 'เล่นเอง'], ['auto', 'ให้ระบบเล่น']], cur, (v) => {
    setPref('miniGames', v);
    if (g && typeof g.setMiniGames === 'function') {
      try { const r = g.setMiniGames(v); if (r && r.ok === false) env.toast(r.error || 'ตั้งมินิเกมไม่ได้'); else env.save(); } catch (e) { console.warn(e); env.toast('ตั้งมินิเกมไม่ได้'); }
    }
  });
}

export function openMenu(env) {
  const { dlgMenu, menuBody } = env.els;
  const prefs = getPrefs();
  const inLife = !!env.game();
  menuBody.textContent = '';
  const note = env.note();
  menuBody.append(
    note ? h('p', { class: 'muted small', text: note }) : null,
    inLife ? seg('ความเร็วของเวลา', [[1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], prefs.speed > 8 ? 8 : prefs.speed, (v) => { setPref('speed', v); env.setSpeed(v); }) : null,
    seg('โหมดการเล่น (ใช้กับชีวิตใหม่)', [['routine', 'กิจวัตร'], ['detailed', 'ละเอียด']], prefs.mode, (v) => setPref('mode', v)),
    miniGamesSeg(env, prefs),
    inLife ? h('p', { class: 'muted small', text: `ชีวิตนี้เล่นในโหมด${env.mode() === 'detailed' ? 'ละเอียด (ทุกมื้อ ทุกคาบ)' : 'กิจวัตร (ตั้งโฟกัสแล้วเดินเอง)'}` }) : null,
    seg('ความคมชัด', [['dark', 'มืด'], ['light', 'สว่าง คมชัด']], prefs.theme, (v) => { setPref('theme', v); env.themeChanged(); }),
    h('div', { class: 'menu-sec stack' },
      h('div', { class: 'ml', text: 'เซฟ' }),
      inLife ? h('button', { type: 'button', class: 'btn block', onclick: () => env.toast(env.save() ? 'บันทึกเกมแล้ว' : 'บันทึกไม่สำเร็จ (เบราว์เซอร์ไม่ให้เก็บข้อมูล)') }, 'บันทึกตอนนี้') : null,
      h('button', { type: 'button', class: 'btn block', disabled: !env.hasSave(), onclick: () => { dlgMenu.close(); env.continueLife(); } }, 'โหลดเซฟล่าสุด / เล่นต่อ'),
      inLife ? h('button', { type: 'button', class: 'btn block', onclick: () => { dlgMenu.close(); env.openLog(); } }, 'บันทึกชีวิตทั้งหมด') : null,
      inLife ? h('button', { type: 'button', class: 'btn block', onclick: () => { dlgMenu.close(); env.openStatus(); } }, 'สถานะเต็ม') : null,
      h('button', { type: 'button', class: 'btn block', onclick: () => { dlgMenu.close(); env.openKeep(); } }, 'ของที่ระลึก'),
      inLife ? h('button', { type: 'button', class: 'btn block', onclick: () => { dlgMenu.close(); env.goLanding(); } }, 'กลับหน้าแรก (เซฟให้แล้ว)') : null,
      confirmButton('เริ่มชีวิตใหม่', 'กดอีกครั้งเพื่อยืนยัน (ชีวิตเดิมจะหาย)', () => { dlgMenu.close(); env.startNew({ confirmed: true }); })));
  dlgMenu.showModal();
}

export function openLog(env) {
  const { dlgLog, logList } = env.els;
  logList.textContent = '';
  const lines = env.record().lines;
  if (!lines.length) logList.append(h('li', { class: 'muted', text: 'ยังไม่มีเหตุการณ์' }));
  else [...lines].reverse().forEach((l) => logList.append(h('li', { class: l.tone ? `tone-${l.tone}` : '' }, h('span', { class: 't', text: [shortYear(l.yearLabel), l.t].filter(Boolean).join(' · ') }), l.text)));
  dlgLog.showModal();
}

export async function openStatus(env) {
  const g = env.game();
  if (!g) return;
  const { dlgStatus, statusBody } = env.els;
  try {
    const mod = await STATUS_SCREEN();
    mod.render(statusBody, null, { view: g.view(), act: () => {}, toast: env.toast });
    dlgStatus.showModal();
  } catch (e) { console.warn(e); env.toast('แสดงหน้าสถานะไม่ได้'); }
}

export function openKeep(env) {
  const { dlgKeep, keepBody } = env.els;
  keepBody.textContent = '';
  const keep = env.keepAll();
  if (!keep.length) keepBody.append(h('p', { class: 'muted', text: 'ยังไม่มีของที่ระลึก แตะบรรทัดในบันทึกชีวิตเพื่อติดดาว บรรทัดที่ติดดาวจะถูกเก็บไว้ที่นี่ แม้ชีวิตนั้นจะจบไปแล้ว' }));
  else keepBody.append(h('ul', { class: 'keep-list' }, keep.map((k) => h('li', null, h('span', { class: 'rec-yr', text: shortYear(k.yearLabel) }), h('div', null, h('div', { class: `tone-${k.tone}`, text: k.text }), k.life ? h('div', { class: 'label', text: k.life }) : null)))));
  dlgKeep.showModal();
}
