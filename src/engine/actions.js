// Plan actions: the evening ones come from src/evening.js, the free-time and weekend ones are defined here.
// fx numbers are small (like evening.js) and are scaled by E.FX_SCALE when applied. PLACEHOLDER numbers.
import { ACTIONS as EVENING } from '../evening.js';

const pick = (id) => EVENING[id];

export const FREE_ACTIONS = {
  study_alone: pick('study_alone'),
  study_group: pick('study_group'),
  homework: pick('homework'),
  chat: pick('chat'),
  phone: pick('phone'),
  call_parents: pick('call_parents'),
  exercise: pick('exercise'),
  rest: { th: 'พักผ่อน นั่งเล่น', fx: { stress: -0.3, energy: 0.4 } },
  talk_teacher: { th: 'ไปคุยกับครู ถามการบ้าน', fx: { teacherTrust: 0.8, stress: 0.1, knowledge: 0.2 } },
  snack: { th: 'ไปโรงอาหาร ซื้อของกิน', fx: { stress: -0.1 }, shop: 'canteen' },
  coop: { th: 'ไปสหกรณ์', fx: {}, shop: 'coop' },
  print: { th: 'ไปห้องปริ้น', fx: {}, shop: 'print' },
  line_order: { th: 'สั่งของจากมิ้ว (LINE)', fx: {}, lineOrder: true },
  date: { th: 'เดตกับแฟน', fx: { stress: -0.3 }, date: true },
};
export const WEEKEND_ACTIONS = {
  ...FREE_ACTIONS,
  sleep_in: { th: 'นอนต่อ งีบ', fx: { energy: 1.5, health: 0.2, stress: -0.2 } },
};
export const FREE_ORDER = ['date', 'rest', 'study_alone', 'study_group', 'homework', 'talk_teacher', 'chat', 'exercise', 'phone', 'snack', 'coop', 'print', 'line_order', 'call_parents'];
export const WEEKEND_ORDER = [...FREE_ORDER, 'sleep_in'];

const WORDS = { knowledge: 'ความรู้', stress: 'เครียด', peer: 'เพื่อน', health: 'สุขภาพ', energy: 'พลัง', teacherTrust: 'ครู', work: 'งานที่ครูสั่ง' };

export function hintOf(a) {
  const bits = [];
  for (const [k, v] of Object.entries(a.fx || {})) {
    if (!WORDS[k] || !v) continue;
    const good = k === 'stress' ? v < 0 : v > 0;
    bits.push(`${WORDS[k]} ${v > 0 ? 'เพิ่ม' : 'ลด'}${good ? '' : ' (ไม่ดี)'}`);
  }
  if (a.shop) bits.push('เปิดหน้าร้าน');
  if (a.lineOrder) bits.push('เปิดหน้าสั่งของ');
  if (a.parents) bits.push('ขอเงินพ่อแม่ได้');
  return bits.join(', ');
}

function list(table, order) {
  return order.map((id) => ({ id, label: table[id].th, hint: hintOf(table[id]) }));
}

export function actionList(kind) {
  if (kind === 'evening') {
    return Object.keys(EVENING).map((id) => {
      const a = EVENING[id];
      const o = { id, label: a.th, hint: hintOf(a) };
      if (a.lightsOut && id !== 'sleep') o.quietOnly = true;
      return o;
    });
  }
  if (kind === 'weekend') return list(WEEKEND_ACTIONS, WEEKEND_ORDER);
  return list(FREE_ACTIONS, FREE_ORDER);
}

export const tableFor = (kind) => (kind === 'weekend' ? WEEKEND_ACTIONS : kind === 'evening' ? EVENING : FREE_ACTIONS);
