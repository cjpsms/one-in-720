// Routine mode (docs/CONTRACT2.md): the player sets a routine (study / food / evening / snack) and the school runs by
// itself. This file holds the routine object, the `focus` pending, and the payload builders that answer every
// ordinary pending (meals, class blocks, free time, evenings, home trips) from the routine instead of asking.
import { DORMS, DORM_DAY } from '../config.js';
import { E, R } from './config.js';
import { clamp, calendar } from './util.js';
import { calOf } from './player.js';
import { mk, scene, opt } from './pending.js';
import { playerTasks } from './tasks.js';
import { neededItems, defaultCart, defaultPayload } from './payloads.js';
import { cellAt } from './world.js';
import { friendAvg } from './friends.js';

export const ROUTINE_KEYS = ['study', 'food', 'evening', 'snack'];

// the choices the focus pending shows (label + sub in Thai)
export const FOCUS_FIELDS = [
  { key: 'study', label: 'การเรียน', choices: [
    { value: 'focus', label: 'จริงจัง', sub: 'ตั้งใจทุกคาบ ทำการบ้านครบ เหนื่อยกว่า' },
    { value: 'normal', label: 'พอดีๆ', sub: 'เรียนตามปกติ ทำการบ้านเป็นส่วนใหญ่' },
    { value: 'relax', label: 'สบายๆ', sub: 'ไม่เครียด แต่คะแนนจะหลุดและอาจโดดคาบ' },
  ] },
  { key: 'food', label: 'ค่าอาหาร', choices: [
    { value: 'cheap', label: 'ประหยัด', sub: 'ราว 90 บาทต่อวัน อิ่มน้อยลงหน่อย' },
    { value: 'normal', label: 'ปกติ', sub: 'ราว 135 บาทต่อวัน เท่าค่าขนม' },
    { value: 'treat', label: 'จัดเต็ม', sub: 'ราว 190 บาทต่อวัน สดชื่นกว่า แต่เงินหมดเร็ว' },
  ] },
  { key: 'evening', label: 'ค่ำที่หอ', choices: [
    { value: 'study', label: 'อ่านหนังสือ', sub: 'ความรู้ขึ้น แต่นอนน้อยและเหนื่อย' },
    { value: 'balanced', label: 'สมดุล', sub: 'อ่านบ้าง คุยบ้าง ออกกำลังกาย นอนพอ' },
    { value: 'social', label: 'เพื่อนและความสุข', sub: 'คุยเล่นกับเพื่อน เครียดลด แต่ความรู้ไม่ขึ้น' },
    { value: 'rest', label: 'พักผ่อน', sub: 'นอนเร็ว สุขภาพดี' },
  ] },
  { key: 'snack', label: 'แอบกินของจากมิ้ว (LINE)', choices: [
    { value: 'none', label: 'ไม่กิน', sub: 'ปลอดภัย' },
    { value: 'sometimes', label: 'บางครั้ง', sub: 'อิ่มใจนิดหน่อย เสี่ยงโดนครูจับ 10% ต่อครั้ง' },
    { value: 'often', label: 'บ่อย', sub: 'โดนจับบ่อยขึ้น ครูโกรธและคะแนนลด' },
  ] },
];

const VALID = Object.fromEntries(FOCUS_FIELDS.map((f) => [f.key, f.choices.map((c) => c.value)]));

// returns { ok, routine } or { ok:false, error }. `partial` may hold any subset of the four keys.
export function mergeRoutine(partial, base) {
  if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) return { ok: false, error: 'routine ต้องเป็นอ็อบเจ็กต์' };
  const out = { ...R.DEFAULT, ...(base || {}) };
  for (const [k, v] of Object.entries(partial)) {
    if (!VALID[k]) return { ok: false, error: `ไม่มีช่อง ${k} ใน routine` };
    if (!VALID[k].includes(v)) return { ok: false, error: `ค่า ${String(v)} ใช้กับ ${k} ไม่ได้` };
    out[k] = v;
  }
  return { ok: true, routine: { study: out.study, food: out.food, evening: out.evening, snack: out.snack } };
}

export function focusP(G, hint, title, mid = false) {
  const S = G.S;
  const cal = calOf(G);
  const p = mk(G, 'focus', {
    tag: 'focus',
    title: title || `โฟกัสของเทอม ${cal.term} ม.${G.me.grade}`,
    text: 'ตั้งแนวทางของเทอมนี้ แล้วโรงเรียนจะเดินไปเอง เปลี่ยนได้ทุกเมื่อ',
    fields: FOCUS_FIELDS.map((f) => ({ key: f.key, label: f.label, choices: f.choices.map((c) => ({ ...c })) })),
    current: { ...S.routine },
    mid,
  });
  if (hint) p.hint = hint;
  return p;
}

export const moneyScene = (G) => scene(G, {
  tag: 'money', title: 'เงินใกล้หมด',
  text: 'เงินเหลือน้อยกว่าค่าข้าวหนึ่งวัน และโทรขอพ่อแม่ได้อีกไม่ได้แล้ว ต้องทำอะไรสักอย่างจนกว่าค่าขนมเดือนหน้าจะเข้า',
  options: [
    opt('loan', 'ยืมเงินเพื่อนร่วมห้อง', `ได้ ${E.MONEY_EMERGENCY_LOAN} บาท แต่เกรงใจและเครียดขึ้น`),
    opt('save', 'ประหยัดเต็มที่ กินแต่ของถูก', 'ปรับค่าอาหารเป็นประหยัด'),
  ],
});

// ---------------- numbers for the view ----------------
export function happyOf(G) {
  const pl = G.S.pl;
  const fr = friendAvg(pl);
  return clamp(80 + (pl.partner ? 4 : 0) - 0.55 * pl.stress + 4.5 * (pl.sleepHours - 7.5) + 0.12 * (pl.peer - 25) + 0.15 * (fr - 25) + 0.1 * (pl.health - 75), 0, 100);
}

// ---------------- small helpers ----------------
const eligibleLoc = (loc) => {
  const m = String(loc || '').match(/\d{3}/);
  return !!m && (m[0] === '221' || m[0] === '223');
};

function lineClassesOn(G, dow) {
  const me = G.me;
  let n = 0;
  for (let p = 1; p <= 8; p++) {
    const c = cellAt(G, me.grade, me.room, dow, p);
    if (c && c.code && eligibleLoc(c.loc)) n++;
  }
  return n;
}

function nextSchoolDay(G) {
  const d0 = G.S.day;
  for (let d = d0 + 1; d < d0 + 15; d++) if (calendar(d, E.TERM_CYCLES).schoolDay) return d;
  return d0 + 1;
}

const placedFor = (pl, day) => pl.orders.some((o) => o.status === 'placed' && o.forDay === day);

function homeworkSlots(G, cap) {
  const S = G.S;
  const pl = S.pl;
  let need = 0;
  for (const t of playerTasks(G)) if (t.due - S.day <= 4) need += Math.max(0, t.effort - (pl.prog[t.id] || 0));
  need = Math.min(cap, Math.ceil(need));
  if (need > 0 && !G.rng.chance(R.STUDY_HOMEWORK[S.routine.study])) need = 0;
  return need;
}

// ---------------- meals ----------------
const flat = (pd) => pd.shops.flatMap((s) => s.items.map((i) => ({ s, i })));

function mealCart(G, pd) {
  const S = G.S;
  const me = G.me;
  const rng = G.rng;
  const food = S.routine.food;
  if (me.money < 12) return [];
  const budget = Math.min(R.FOOD_BUDGET[food] * R.MEAL_SPLIT[pd.meal || 'lunch'], me.money * 0.6);
  const items = flat(pd).filter((x) => x.i.available && x.i.price >= 10 && x.i.price <= budget && !(x.i.options && x.i.options.some((o) => o.choices.some((c) => c.priceDelta < 0))));
  const mains = items.filter((x) => x.i.fill >= 18);
  const cart = [];
  let left = budget;
  if (mains.length) {
    let pool;
    if (food === 'cheap') pool = mains.slice().sort((a, b) => b.i.fill / b.i.price - a.i.fill / a.i.price);
    else if (food === 'treat') pool = mains.filter((x) => x.i.price <= budget * 0.8).sort((a, b) => b.i.price - a.i.price);
    else pool = mains.slice().sort((a, b) => b.i.fill - a.i.fill);
    if (!pool.length) pool = mains.slice().sort((a, b) => b.i.fill - a.i.fill);
    const pick = pool[rng.int(0, Math.min(2, pool.length - 1))];
    cart.push({ shopId: pick.s.id, itemId: pick.i.id, qty: 1 });
    left -= pick.i.price;
  }
  // a side: fruit, a drink, a dessert
  const sides = items.filter((x) => x.i.fill < 18 && x.i.price <= left && !x.i.id.startsWith('crepe') && x.i.id !== 'fruit.mochi');
  const want = food === 'treat' ? 2 : food === 'normal' ? (rng.chance(0.6) ? 1 : 0) : rng.chance(0.35) ? 1 : 0;
  for (let k = 0; k < want && sides.length; k++) {
    const pool = sides.filter((x) => x.i.price <= left);
    if (!pool.length) break;
    const pick = food === 'cheap' ? pool.slice().sort((a, b) => a.i.price - b.i.price)[0] : pool[rng.int(0, pool.length - 1)];
    cart.push({ shopId: pick.s.id, itemId: pick.i.id, qty: 1 });
    left -= pick.i.price;
  }
  return cart;
}

function snackCart(G, pd) {
  const me = G.me;
  if (me.money < 150) return [];
  const pool = flat(pd).filter((x) => x.i.available && x.i.price >= 15 && x.i.price <= 25 && x.i.fill < 18 && !x.i.id.startsWith('crepe') && !(x.i.options && x.i.options.length));
  if (!pool.length) return [];
  const pick = pool[G.rng.int(0, pool.length - 1)];
  return [{ shopId: pick.s.id, itemId: pick.i.id, qty: 1 }];
}

// ---------------- class blocks ----------------
function classPayload(G, pd) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const study = S.routine.study;
  const skip = [];
  const skipP = R.STUDY_SKIP[study];
  if (skipP > 0) for (const q of pd.periods) if (q.kind === 'class' && G.rng.chance(skipP)) skip.push(q.p);
  const line = [];
  if (S.routine.snack !== 'none') {
    for (const q of pd.periods) {
      if (!q.lineShop || !q.lineShop.eligible || skip.includes(q.p) || line.length >= 1) continue;
      const it = q.lineShop.items.find((i) => i.available && i.price <= me.money - 100 && pl.orders.some((o) => o.status === 'placed' && o.forDay === S.day && o.itemId === i.id));
      if (it) line.push({ p: q.p, itemId: it.id });
    }
  }
  return { stance: R.STUDY_STANCE[study], skipPeriods: skip, line };
}

// ---------------- plans ----------------
const FREE_PROFILE = {
  focus: ['study_alone', 'homework', 'exercise', 'study_group', 'study_alone', 'rest'],
  normal: ['rest', 'study_alone', 'exercise', 'chat', 'study_alone', 'chat'],
  relax: ['rest', 'chat', 'exercise', 'phone', 'chat', 'phone'],
};
const EVENING_PROFILE = {
  study: ['study_alone', 'study_alone', 'study_group', 'study_alone', 'study_group', 'chat'],
  balanced: ['study_alone', 'study_alone', 'chat', 'exercise', 'study_group', 'chat', 'study_alone'],
  social: ['chat', 'phone', 'chat', 'study_alone', 'chat', 'phone'],
  rest: ['exercise', 'chat', 'study_alone', 'chat'],
};
const AFTER_BED = { study_alone: 'study_light', study_group: 'study_light', chat: 'whisper_chat', phone: 'phone_secret' };

function planPayload(G, pd) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const rng = G.rng;
  const ids = new Set(pd.actions.map((a) => a.id));
  const n = pd.slots;
  const study = S.routine.study;
  const plan = [];
  const push = (id, limit = n) => { if (plan.length < limit && ids.has(id)) plan.push(id); };
  const idle = (id) => ((id === 'study_alone' || id === 'study_group') && rng.chance(R.STUDY_IDLE[study]) ? 'phone' : id);
  if (pd.planKind === 'evening') {
    const dorm = DORMS[me.dorm];
    const bedSlot = Math.round((dorm.bed - DORM_DAY.eveningStart) / 30);
    const awake = clamp(bedSlot + R.EVENING_AWAKE[S.routine.evening], 0, n);
    let hw = homeworkSlots(G, 3);
    while (hw-- > 0) push('homework', awake);
    const prof = EVENING_PROFILE[S.routine.evening];
    for (let k = 0; plan.length < awake; k++) {
      let id = idle(prof[k % prof.length]);
      if (plan.length >= bedSlot && AFTER_BED[id]) id = AFTER_BED[id];
      push(id, awake);
    }
    while (plan.length < n) push('sleep');
    return plan;
  }
  const weekend = pd.planKind === 'weekend';
  const needs = neededItems(G, 6);
  if (needs.length && (weekend ? pd.startMinute < 12 * 60 : true)) {
    push('coop');
    if (needs.some((m) => m.inv === 'print_page')) push('print');
  }
  if (pl.partner && ids.has('date') && rng.chance({ focus: 0.12, normal: 0.35, relax: 0.6 }[study])) push('date');
  const snack = S.routine.snack;
  if (!weekend && snack !== 'none') {
    const nd = nextSchoolDay(G);
    const cal2 = calendar(nd, E.TERM_CYCLES);
    if (lineClassesOn(G, cal2.dow) > 0) {
      if (!placedFor(pl, nd) && rng.chance(R.SNACK_RATE[snack] * 2) && me.money > 300) push('line_order');
    } else if (rng.chance(R.SNACK_CANTEEN_RATE[snack])) push('snack');
  }
  if (weekend && pd.startMinute < 12 * 60 && study !== 'focus') push('sleep_in');
  let hw = homeworkSlots(G, 3);
  while (hw-- > 0) push('homework');
  const prof = FREE_PROFILE[study];
  for (let k = 0; plan.length < n; k++) push(idle(prof[k % prof.length]));
  return plan;
}

function linePayload(G, pd) {
  const S = G.S;
  const me = G.me;
  if (S.routine.snack === 'none' || me.money < 200) return { place: [], cancel: [] };
  const pool = pd.menu.filter((m) => m.price <= 40);
  if (!pool.length) return { place: [], cancel: [] };
  return { place: [pool[G.rng.int(0, pool.length - 1)].id], cancel: [] };
}

// ---------------- the entry point ----------------
// Tags the routine answers by itself (never shown). Everything else stops the game for the player.
export const AUTO_TAGS = new Set([
  'borrow', 'meal_breakfast', 'meal_lunch', 'meal_dinner', 'wk_breakfast', 'wk_lunch', 'wk_dinner',
  'morning', 'afternoon', 'free', 'wk_am', 'wk_pm', 'extra_shop', 'extra_line', 'evening', 'meltdown', 'sick', 'trip', 'newyear',
]);

export function routinePayload(G, pd) {
  const S = G.S;
  const me = G.me;
  switch (pd.kind) {
    case 'shop':
      if (pd.mode === 'meal') { const cart = mealCart(G, pd); return cart.length ? { cart } : { skip: true }; }
      if (pd.mode === 'canteen') { const cart = snackCart(G, pd); return cart.length ? { cart } : { skip: true }; }
      { const cart = defaultCart(G, pd); return cart.length ? { cart } : { skip: true }; }
    case 'classPlan': return classPayload(G, pd);
    case 'plan': return { plan: planPayload(G, pd) };
    case 'lineOrder': return linePayload(G, pd);
    case 'focus': return { routine: { ...S.routine } };
    case 'termStart': return pd.canKeep ? { keep: true } : defaultPayload(G, pd);
    case 'scene':
      switch (pd.tag) {
        case 'companion': {
          const f = pd.options.find((o) => o.id === 'partner') || pd.options.find((o) => o.id.startsWith('friend:'));
          return { optionId: f ? f.id : 'alone' };
        }
        case 'fair_choice': {
          const w = pd.options.find((o) => o.id.startsWith('work:')) || pd.options.find((o) => o.id === 'wander');
          return { optionId: (w || pd.options[0]).id };
        }
        case 'fair_own': return { optionId: pd.options[0].id };
        case 'fair_contest': return { optionId: pd.options[0].id };
        case 'show_role': {
          const ids = pd.options.map((o) => o.id).filter((x) => x !== 'none' && x !== 'director');
          const pick = me.trait === 'extro' ? 'act' : ids.filter((x) => x !== 'act')[G.rng.int(0, ids.length - 2)];
          return { optionId: pick || 'none' };
        }
        case 'borrow': return { optionId: (pd.options.find((o) => o.id !== 'none') || pd.options[0]).id };
        case 'meltdown': return { optionId: 'cry' };
        case 'sick': return { optionId: 'rest' };
        case 'trip': {
          const ev = S.routine.evening;
          return { optionId: ev === 'study' ? 'study' : ev === 'social' && me.money >= 800 ? 'out' : 'rest' };
        }
        default: return { optionId: (pd.options.find((o) => !o.disabled) || pd.options[0] || {}).id };
      }
    default: return {};
  }
}
