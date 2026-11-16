// Checking the payload of every pending kind (returns an error text instead of throwing) and the
// "just do the sensible thing" default payloads used by defaultPayload() and fastForward().
import { DORMS, DORM_DAY } from '../config.js';
import { E } from './config.js';
import { calOf } from './player.js';
import { shops, TASK_ITEMS } from './adapters.js';
import { playerTasks, missingItems } from './tasks.js';
import { tableFor } from './actions.js';
import { parentsInfo, needElective, defaultSatGroup } from './pending.js';
import { clamp as clampN } from './util.js';
import { expectedFor, mgStats, cleanStats } from './minigame.js';
import { mergeRoutine } from './routine.js';

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const isInt = (x) => Number.isInteger(x);
const bad = (error) => ({ ok: false, error });
const good = (payload) => ({ ok: true, payload });

export function validate(G, pd, payload) {
  if (!isObj(payload)) return bad('payload ต้องเป็นอ็อบเจ็กต์');
  switch (pd.kind) {
    case 'scene': {
      if (pd.final) return good({});
      if (typeof payload.optionId !== 'string') return bad('ต้องมี optionId');
      const o = pd.options.find((x) => x.id === payload.optionId);
      if (!o) return bad('ไม่มีตัวเลือกนี้');
      if (o.disabled) return bad(o.reason || 'ตัวเลือกนี้ใช้ไม่ได้');
      return good({ optionId: o.id });
    }
    case 'shop': {
      if (payload.skip === true) return good({ skip: true });
      if (!Array.isArray(payload.cart)) return bad('ต้องมี skip:true หรือ cart เป็นอาร์เรย์');
      if (payload.cart.length > 20) return bad('ตะกร้ายาวเกินไป');
      const cart = [];
      for (const c of payload.cart) {
        if (!isObj(c) || typeof c.shopId !== 'string' || typeof c.itemId !== 'string') return bad('รายการในตะกร้าไม่ถูกต้อง');
        const shop = pd.shops.find((s) => s.id === c.shopId);
        const item = shop && shop.items.find((i) => i.id === c.itemId);
        if (!item) return bad('ไม่มีสินค้านี้ในร้าน');
        const qty = c.qty === undefined ? 1 : c.qty;
        if (!isInt(qty) || qty < 1 || qty > 20) return bad('จำนวนไม่ถูกต้อง');
        if (c.options !== undefined && !isObj(c.options)) return bad('options ไม่ถูกต้อง');
        cart.push({ shopId: c.shopId, itemId: c.itemId, qty, options: c.options || {} });
      }
      return good({ cart });
    }
    case 'classPlan': {
      const stance = payload.stance === undefined ? 'normal' : payload.stance;
      if (!['focus', 'normal', 'relax'].includes(stance)) return bad('stance ต้องเป็น focus, normal หรือ relax');
      const skip = payload.skipPeriods === undefined ? [] : payload.skipPeriods;
      if (!Array.isArray(skip) || skip.some((p) => !isInt(p))) return bad('skipPeriods ต้องเป็นอาร์เรย์ของเลขคาบ');
      for (const p of skip) {
        const q = pd.periods.find((x) => x.p === p);
        if (!q || q.kind === 'free') return bad(`คาบ ${p} โดดไม่ได้`);
      }
      const line = payload.line === undefined ? [] : payload.line;
      if (!Array.isArray(line) || line.length > 8) return bad('line ไม่ถูกต้อง');
      const lines = [];
      for (const l of line) {
        if (!isObj(l) || !isInt(l.p) || typeof l.itemId !== 'string') return bad('รายการ line ไม่ถูกต้อง');
        const q = pd.periods.find((x) => x.p === l.p);
        if (!q || !q.lineShop || !q.lineShop.eligible) return bad(`คาบ ${l.p} สั่งของจากมิ้วไม่ได้`);
        if (skip.includes(l.p)) return bad('โดดคาบแล้วกินในคาบไม่ได้');
        const it = q.lineShop.items.find((i) => i.id === l.itemId);
        if (!it) return bad('ไม่มีของนี้');
        if (!it.available) return bad(it.reason || 'ของนี้ยังไม่พร้อม');
        lines.push({ p: l.p, itemId: l.itemId });
      }
      return good({ stance, skipPeriods: [...new Set(skip)], line: lines });
    }
    case 'plan': {
      if (!Array.isArray(payload.plan)) return bad('ต้องมี plan เป็นอาร์เรย์');
      if (payload.plan.length > pd.slots) return bad(`plan ยาวเกิน ${pd.slots} ช่อง`);
      const ids = new Set(pd.actions.map((a) => a.id));
      for (const a of payload.plan) if (typeof a !== 'string' || !ids.has(a)) return bad('ไม่มีกิจกรรมนี้');
      return good({ plan: payload.plan.slice() });
    }
    case 'termStart': {
      const sg = payload.satGroup === undefined ? null : payload.satGroup;
      if (sg !== null && !(pd.satGroups || []).some((g) => g.id === sg)) return bad('ไม่มีกลุ่มเรียนวันเสาร์นี้');
      if (payload.keep === true) {
        if (!pd.canKeep) return bad('เก็บชุมนุมและวิชาเลือกเดิมไม่ได้ในเทอมนี้');
        return good({ clubId: pd.previous.clubId, electiveId: pd.previous.electiveId, satGroup: sg || (pd.previous.satGroup && (pd.satGroups || []).some((g) => g.id === pd.previous.satGroup) ? pd.previous.satGroup : null) });
      }
      const clubId = payload.clubId === undefined ? null : payload.clubId;
      const electiveId = payload.electiveId === undefined ? null : payload.electiveId;
      if (clubId !== null) {
        const c = pd.clubs.find((x) => x.id === clubId);
        if (!c) return bad('ไม่มีชุมนุมนี้');
        if (c.seatsLeft <= 0) return bad('ชุมนุมนี้เต็มแล้ว');
      }
      if (electiveId !== null && !pd.electives.some((e) => e.id === electiveId)) return bad('ไม่มีวิชาเลือกนี้');
      if (pd.needElective && electiveId === null) return bad('ต้องเลือกวิชาเลือก (พก.)');
      return good({ clubId, electiveId, satGroup: sg });
    }
    case 'lineOrder': {
      const place = payload.place === undefined ? [] : payload.place;
      const cancel = payload.cancel === undefined ? [] : payload.cancel;
      if (!Array.isArray(place) || !Array.isArray(cancel) || place.length > 3 || cancel.length > 10) return bad('place/cancel ไม่ถูกต้อง');
      for (const id of place) if (!pd.menu.some((m) => m.id === id)) return bad('ไม่มีของนี้ในเมนู');
      for (const id of cancel) if (!pd.orders.some((o) => o.id === id && o.status === 'placed')) return bad('ยกเลิกออเดอร์นี้ไม่ได้');
      return good({ place, cancel });
    }
    case 'minigame': {
      if (payload.skip === true) {
        if (!pd.canSkip) return bad('ข้ามมินิเกมนี้ไม่ได้');
        return good({ skip: true });
      }
      const sc = Number(payload.score);
      if (payload.score === undefined || payload.score === null || !Number.isFinite(sc)) return bad('ต้องมี score เป็นตัวเลข 0 ถึง 1 หรือ skip:true');
      return good({ score: clampN(sc, 0, 1), auto: payload.auto === true, stats: cleanStats(payload.stats) });
    }
    case 'focus': {
      if (payload.routine === undefined) return good({ routine: { ...G.S.routine } });
      const m = mergeRoutine(payload.routine, pd.current || G.S.routine);
      return m.ok ? good({ routine: m.routine }) : bad(m.error);
    }
    default:
      return bad('ไม่รู้จักชนิดของ pending');
  }
}

// ---------- defaults ----------
export function neededItems(G, within) {
  const S = G.S;
  const out = [];
  for (const t of playerTasks(G)) {
    if (t.due - S.day > within) continue;
    for (const m of missingItems(G, t)) if (!out.some((o) => o.inv === m.inv)) out.push(m);
  }
  return out;
}

function giveTable() {
  const t = {};
  for (const c of shops.coopItems()) for (const g of c.give || []) if (!t[g.itemId]) t[g.itemId] = { shopId: 'coop', itemId: c.id, per: g.qty, price: c.price };
  return t;
}

export function defaultCart(G, pd) {
  const me = G.me;
  let money = me.money;
  const cart = [];
  if (pd.mode === 'coop') {
    const gt = giveTable();
    for (const m of neededItems(G, 8)) {
      const g = gt[m.inv];
      if (!g) continue;
      const qty = Math.ceil((m.need - m.have) / g.per);
      if (qty > 0 && g.price * qty <= money - 30) { cart.push({ shopId: g.shopId, itemId: g.itemId, qty }); money -= g.price * qty; }
    }
    return cart;
  }
  if (pd.mode === 'print') {
    for (const m of neededItems(G, 8)) {
      if (m.inv !== 'print_page') continue;
      const item = pd.shops.flatMap((s) => s.items.map((i) => ({ s, i }))).find((x) => x.i.id === 'print.page' && x.i.available);
      const qty = Math.min(m.need - m.have, 20);
      if (item && qty > 0 && 2 * qty <= money) cart.push({ shopId: item.s.id, itemId: item.i.id, qty });
    }
    return cart;
  }
  if (pd.mode === 'canteen' && G.S.pl.fullness > 45) return cart;
  // a meal: the most filling item that fits the budget
  const budget = Math.min(E.MEAL_BUDGET[pd.meal] || 40, money * 0.5);
  let best = null;
  for (const s of pd.shops) {
    for (const i of s.items) {
      if (!i.available || i.price > budget || i.price < 10) continue;
      const score = i.fill - 0.05 * i.price;
      if (!best || score > best.score) best = { shopId: s.id, itemId: i.id, score };
    }
  }
  if (best && money >= 15) cart.push({ shopId: best.shopId, itemId: best.itemId, qty: 1 });
  return cart;
}

export function defaultPayload(G, pd) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  switch (pd.kind) {
    case 'scene':
      if (pd.tag === 'crush') return { optionId: S.crushMode === 'accept' ? 'accept' : 'decline' }; // the default life has no relationship (balance baseline)
      if (pd.tag === 'fair_choice') return { optionId: (pd.options.find((o) => o.id.startsWith('work:')) || pd.options[0]).id };
      if (pd.data && pd.data.defaultId) return { optionId: pd.data.defaultId };
      return pd.final ? {} : { optionId: (pd.options.find((o) => !o.disabled) || pd.options[0] || {}).id };
    case 'shop': {
      const cart = defaultCart(G, pd);
      return cart.length ? { cart } : { skip: true };
    }
    case 'classPlan': {
      const stance = 'normal'; // PLACEHOLDER: the sensible default is not the star student
      const line = [];
      let money = me.money - 200;
      for (const q of pd.periods) {
        if (!q.lineShop || !q.lineShop.eligible) continue;
        const it = q.lineShop.items.find((i) => i.available && i.price <= money);
        if (it && line.length < 1) { line.push({ p: q.p, itemId: it.id }); money -= it.price; }
      }
      return { stance, skipPeriods: [], line };
    }
    case 'plan': return { plan: defaultPlan(G, pd) };
    case 'termStart': {
      if (S.mode === 'routine' && pd.canKeep) return { keep: true };
      const club = pd.clubs.find((c) => c.seatsLeft > 0);
      return { clubId: club ? club.id : null, electiveId: pd.needElective && pd.electives.length ? pd.electives[0].id : null, satGroup: defaultSatGroup(G) };
    }
    case 'minigame': return { auto: true, score: Math.round(expectedFor(G, pd.game, pd.difficulty, pd.data && pd.data.xs) * 1000) / 1000 };
    case 'lineOrder': {
      const placed = pl.orders.some((o) => o.status === 'placed');
      const it = pd.menu.filter((m) => m.price <= 30).sort((a, b) => a.price - b.price)[0];
      return { place: !placed && it && me.money > 500 ? [it.id] : [], cancel: [] };
    }
    case 'focus': return { routine: { ...S.routine } };
    default: return {};
  }
}

function defaultPlan(G, pd) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const n = pd.slots;
  const table = tableFor(pd.planKind);
  const plan = [];
  const push = (id) => { if (plan.length < n && table[id]) plan.push(id); };
  if (pd.planKind === 'evening') {
    const dorm = DORMS[me.dorm];
    const wake = dorm.outBy - DORM_DAY.getReady;
    const awakeEnd = 24 * 60 + wake - 8 * 60; // about 8 hours of sleep
    const awake = Math.max(0, Math.floor((awakeEnd - pd.startMinute) / 30));
    let hw = Math.min(4, Math.ceil(playerTasks(G).filter((t) => t.due - S.day <= 4).reduce((s, t) => s + Math.max(0, t.effort - (pl.prog[t.id] || 0)), 0)));
    const pc = parentsInfo(G);
    if (me.money < E.PARENT_CALL_BELOW && pc.canAsk) push('call_parents');
    while (plan.length < Math.min(awake, n)) {
      if (hw > 0) { push('homework'); hw--; } else if (plan.length === awake - 1) push('chat'); else push('study_alone');
    }
    while (plan.length < n) push('sleep');
    return plan;
  }
  const weekend = pd.planKind === 'weekend';
  const needs = neededItems(G, 6);
  if (!weekend && needs.length) {
    push('coop');
    if (needs.some((m) => m.inv === 'print_page')) push('print');
  }
  if (weekend && needs.length && pd.startMinute < 12 * 60) {
    push('coop');
    if (needs.some((m) => m.inv === 'print_page')) push('print');
  }
  if (S.day % 9 === 0 && me.money > 800 && !weekend) push('line_order');
  let hw = Math.min(3, Math.ceil(playerTasks(G).filter((t) => t.due - S.day <= 4).reduce((s, t) => s + Math.max(0, t.effort - (pl.prog[t.id] || 0)), 0)));
  if (!weekend) push('rest');
  if (pl.health < 70) push('exercise');
  while (plan.length < n) {
    if (hw > 0) { push('homework'); hw--; }
    else if (weekend && plan.length % 4 === 3) push('chat');
    else if (weekend && plan.length % 5 === 4) push('exercise');
    else if (plan.length % 3 === 2) push('chat');
    else push(weekend && plan.length < 2 ? 'rest' : 'study_alone');
  }
  return plan;
}

export { needElective };
