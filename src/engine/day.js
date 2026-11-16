// The day-by-day state machine. S.phase names the next step; a step either changes the phase or asks the player
// something (a pending is pushed on S.queue and shown by advance()). answer() validates the payload, runs the
// handler for the pending's tag, then advance() runs steps until the next pending exists.
import { DORMS, DORM_DAY, MONEY } from '../config.js';
import { calendar } from './util.js';
import { evaluateEvening } from '../evening.js';
import { monthlyAllowance, askParents, resetAsks } from '../money.js';
import { E, R } from './config.js';
import { clamp, hhmm, nf, seasonOf, DOW_KEYS } from './util.js';
import { shops, pickEvent, restoreEvent, subjectOf, clubById, TASK_ITEMS } from './adapters.js';
import { cellAt, roommates } from './world.js';
import { calOf, say, applyFx, wakeUp, finishDay, viewStats, addTrust, spend } from './player.js';
import { rcAdd, buildRecap, weekNo } from './recap.js';
import { planDay, freeSlots, dayLabel } from './dayplan.js';
import { npcSchoolDay, npcWeekend, npcHome, npcLineDay, npcTermStart } from './npc.js';
import { assignTasks, resolveNpcTasks, playerTasks, missingItems } from './tasks.js';
import { scene, opt, shopP, classPlanP, planP, termStartP, lineOrderP, periodInfo, parentsInfo, mk, needElective } from './pending.js';
import { runBlock } from './blocks.js';
import { queueBeat, answerCScene } from './scenes.js';
import { answerConduct, conductDaily, cond } from './conduct.js';
import { validate, defaultPayload as makeDefault } from './payloads.js';
import { tableFor } from './actions.js';
import { closeTerm, gateScene, gateResultScene, endGame, promoteAll, newYearScene, setupTermPlayer } from './term.js';
import { moodOf } from './teachers.js';
import { routinePayload, AUTO_TAGS, focusP, moneyScene } from './routine.js';
import { dayKind, getPlan, morningPeriods, afternoonPeriods } from './plan.js';
import { bindIO, enterAct, actStep, answerMg, answerActScene, answerCompanion, answerRole, roleScene, awardApplies } from './festival.js';
import { defaultSatGroup } from './pending.js';
import { bumpFriend, friendOf, termFriends, crushScene, answerCrush, answerBreakup, answerCheckin, checkinScene, breakupRoll, doDate } from './friends.js';
import { ACT } from './adapters.js';

// routine mode: an ordinary pending is answered by the routine and never shown (see routine.js AUTO_TAGS)
function autoAnswer(G, p) {
  const payload = routinePayload(G, p);
  let v = validate(G, p, payload);
  if (!v.ok) {
    v = validate(G, p, makeDefault(G, p));
    if (!v.ok) throw new Error(`routine answer rejected for ${p.tag}: ${v.error}`);
  }
  ANSWERS[p.tag](G, v.payload, p);
  if (p.kind === 'shop' && p.mode === 'meal' && v.payload.cart && v.payload.cart.length) applyFx(G, R.FOOD_MEAL_FX[G.S.routine.food]);
}
// the choice scenes inside festivals: answered by the routine when the player chose "auto" mini games
const ACT_AUTO_TAGS = new Set(['companion', 'fair_choice', 'fair_own', 'fair_contest', 'show_role']);
const ask = (G, p) => {
  if (G.S.mode === 'routine' && (AUTO_TAGS.has(p.tag) || (G.S.miniGames === 'auto' && ACT_AUTO_TAGS.has(p.tag)))) return autoAnswer(G, p);
  G.S.queue.push(p);
  G.S.phase = 'await';
};
// a pending that does not stop the day (queued, shown before the next step); the routine answers the ordinary ones
const queueOrAuto = (G, p) => {
  if (G.S.mode === 'routine' && (AUTO_TAGS.has(p.tag) || (G.S.miniGames === 'auto' && ACT_AUTO_TAGS.has(p.tag)))) autoAnswer(G, p);
  else G.S.queue.push(p);
};
const go = (G, phase) => { G.S.phase = phase; };
const dormOf = (G) => DORMS[G.me.dorm];
// what follows the afternoon classes: the hall (lecture days), the trip home (last Friday), free time
const afterNoon = (G) => (dayKind(G).hall ? 'hall' : calOf(G).lastSchoolDay ? 'tripbegin' : 'free');

// ---------------- the loop ----------------
export function advance(G) {
  const S = G.S;
  let guard = 0;
  while (!S.pending) {
    if (S.queue.length) { S.pending = S.queue.shift(); break; }
    if (++guard > 300) throw new Error('engine loop: phase ' + S.phase);
    const step = STEPS[S.phase];
    if (!step) throw new Error('unknown phase ' + S.phase);
    step(G);
  }
}

// Routine mode: run the school forward by up to `days` days (S.day counts them) or until a pending needs the player.
// With untilDecision = false the pending is answered with the default payload and the run goes on.
export function advanceDays(G, days = 1, untilDecision = true) {
  const S = G.S;
  const start = S.day;
  for (;;) {
    if (!S.pending && S.queue.length) S.pending = S.queue.shift();
    if (S.pending) {
      if (untilDecision || S.pending.final) break;
      const r = answer(G, makeDefault(G, S.pending));
      if (!r.ok) throw new Error('default answer rejected: ' + r.error);
      continue;
    }
    if (S.day - start >= days) break;
    stepBlock(G);
  }
  return S.day - start;
}

export function answer(G, payload) {
  const S = G.S;
  const pd = S.pending;
  if (!pd) return { ok: false, error: 'ตอนนี้ไม่มีเรื่องให้ตัดสินใจ เรียก advance() ให้โรงเรียนเดินต่อ' };
  if (pd.final) return { ok: true, noop: true };
  const v = validate(G, pd, payload);
  if (!v.ok) return v;
  S.pending = null;
  const h = ANSWERS[pd.tag];
  if (!h) throw new Error('no answer handler for ' + pd.tag);
  h(G, v.payload, pd);
  if (S.mode === 'routine') {
    S.pl.cnt.pendings += 1;
    if (!S.pending && S.queue.length) S.pending = S.queue.shift();
  } else advance(G);
  return { ok: true };
}

// ---------------- events ----------------
function phaseOf(cal) {
  if (cal.cycleInTerm === E.MIDTERM_CYCLE) return 'midterm';
  if (cal.lastCycleOfTerm) return 'final';
  if (cal.cycleInTerm === 1 && cal.dayInCycle <= 5) return 'results';
  return undefined;
}

function eventCtx(G, place, ev) {
  const S = G.S;
  const me = G.me;
  const cal = calOf(G);
  const mates = roommates(G, me).map((m) => m.name);
  const ctx = { grade: me.grade, place, stats: viewStats(G), day: S.day, phase: phaseOf(cal), recent: S.pl.recentEvents, friendNames: mates.length >= 2 ? mates : undefined, teacherName: undefined };
  if (ev) ctx.vars = ev.vars;
  return ctx;
}

// routine mode: events are planned once a day (planEventForDay) and fire right after their block (force = true)
function maybeEvent(G, place, force = false, after = null) {
  const S = G.S;
  if (S.mode === 'routine' && !force) return;
  // most story beats are the new choice scenes with a % on every option; the old events fill the rest
  if (G.rng.chance(E.BEAT.SCENE_SHARE) && (force || G.rng.chance(E.EVENT_CHANCE[place] || 0)) && queueBeat(G, place, after)) return;
  const ctx = eventCtx(G, place);
  ctx.eventChance = force ? 1 : E.EVENT_CHANCE[place];
  const ev = pickEvent(ctx, G.rng);
  if (!ev) return;
  S.pl.cnt.events += 1;
  S.pl.recentEvents.push(ev.id);
  if (S.pl.recentEvents.length > 8) S.pl.recentEvents.shift();
  S.queue.push(scene(G, {
    tag: 'event', title: ev.title, text: ev.text(ctx),
    options: ev.options.map((o) => opt(o.id, o.label, o.sub)),
    data: { id: ev.id, vars: ev.vars, place },
  }));
  if (after) {
    const q = S.queue[S.queue.length - 1];
    q.after = { id: after.id, what: after.what, place: after.place, from: after.from, to: after.to }; // where in the day it happened
  }
}

function answerEvent(G, payload, pd) {
  const ev = restoreEvent(pd.data.id, pd.data.vars);
  const o = ev && ev.options.find((x) => x.id === payload.optionId);
  if (!o) return;
  const r = o.apply(eventCtx(G, pd.data.place, ev), G.rng);
  applyFx(G, r.fx);
  const bad = (r.fx.stress || 0) > 0 || (r.fx.health || 0) < 0 || (r.fx.money || 0) < 0;
  say(G, r.log, bad ? 'bad' : 'good');
}

// ---------------- shop and plan helpers ----------------
export function applyCart(G, pd, payload) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  if (payload.skip) {
    if (G.S.mode !== 'routine') say(G, pd.mode === 'meal' ? `ข้าม${pd.title}` : 'ไม่ซื้ออะไร', 'neutral');
    return;
  }
  const ctx = { mode: pd.mode, meal: pd.meal, minute: S.minute, season: seasonOf(calOf(G)), day: S.day, inventory: pl.inv };
  for (const c of payload.cart) {
    const r = shops.buy(S.shop, me, c, ctx, G.rng);
    if (!r.ok) { say(G, `ซื้อไม่ได้: ${r.reason}`, 'bad'); continue; }
    me.money = Math.max(0, me.money - r.price);
    spend(G, r.price);
    applyFx(G, r.fx);
    for (const g of r.giveItems || []) pl.inv[g.itemId] = (pl.inv[g.itemId] || 0) + g.qty;
    for (const t of r.takeItems || []) pl.inv[t.itemId] = Math.max(0, (pl.inv[t.itemId] || 0) - t.qty);
    const shop = pd.shops.find((s) => s.id === c.shopId);
    const item = shop && shop.items.find((i) => i.id === c.itemId);
    say(G, `ซื้อ ${item ? item.name : c.itemId}${c.qty > 1 ? ' x' + c.qty : ''} ${r.price} บาท`, 'neutral', true);
    for (const n of r.notes || []) say(G, n, 'neutral', true);
  }
}

function nextSchoolDayFrom(G, d) {
  for (let i = d + 1; i < d + 15; i++) if (calOf({ S: { day: i } }).schoolDay) return i;
  return d + 1;
}

function applyLineOrder(G, payload) {
  const S = G.S;
  const pl = S.pl;
  const forDay = nextSchoolDayFrom(G, S.day);
  for (const id of payload.cancel) {
    const r = shops.cancelOrder(S.shop, id);
    const o = pl.orders.find((x) => x.id === id);
    if (r && r.ok && o) { o.status = 'cancelled'; say(G, `ยกเลิกออเดอร์ ${o.itemName}`, 'neutral'); }
  }
  for (const itemId of payload.place) {
    const r = shops.placeOrder(S.shop, G.me, itemId, forDay);
    if (r && r.ok) {
      pl.orders.push({ id: r.id, itemId, itemName: r.itemName, forDay, status: 'placed' });
      say(G, `สั่ง ${r.itemName} จากมิ้ว ไว้สำหรับวันที่ ${forDay}`, 'neutral', true);
    } else say(G, `สั่งไม่ได้: ${r ? r.reason : ''}`, 'bad');
  }
  if (pl.orders.length > 30) pl.orders = pl.orders.slice(-30);
}

// the actions of a free-time / weekend plan; returns the list of extra shop pendings to open afterwards
function applyPlan(G, ids, kind) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const table = tableFor(kind);
  const extras = [];
  const sum = {};
  const friendIds = pl.friends.map((f) => f.id);
  for (const id of ids) {
    const a = table[id];
    if (!a) continue;
    for (const [k, v] of Object.entries(a.fx || {})) sum[k] = (sum[k] || 0) + v;
    if (a.shop && !extras.includes(a.shop)) extras.push(a.shop);
    if (a.lineOrder && !extras.includes('line')) extras.push('line');
    if (a.parents) callParents(G);
    if (a.date) doDate(G);
    if (id === 'chat' && friendIds.length) {
      bumpFriend(G, friendIds[G.rng.int(0, friendIds.length - 1)], 2);
    }
  }
  applyFx(G, sum, true);
  const order = { coop: 0, print: 1, canteen: 2, line: 3 };
  extras.sort((x, y) => order[x] - order[y]);
  return extras;
}

function callParents(G) {
  const me = G.me;
  const r = askParents(me, G.rng);
  if (r.ok) say(G, `โทรหาพ่อแม่ ขอเงินได้ ${r.amount} บาท`, 'good');
  else say(G, `โทรหาพ่อแม่ ${r.reason}`, 'bad');
}

const LABEL = {
  study: { focus: 'จริงจัง', normal: 'พอดีๆ', relax: 'สบายๆ' },
  food: { cheap: 'ประหยัด', normal: 'ปกติ', treat: 'จัดเต็ม' },
  evening: { study: 'อ่านหนังสือ', balanced: 'สมดุล', social: 'เพื่อน', rest: 'พักผ่อน' },
  snack: { none: 'ไม่กิน', sometimes: 'บางครั้ง', often: 'บ่อย' },
};

// routine mode, start of every day: parents asked when money is low, the money emergency, the mid-term check
function routineDayChecks(G, cal) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const pc = parentsInfo(G);
  if (me.money < E.PARENT_CALL_BELOW && pc.canAsk) callParents(G);
  else if (me.money < E.MONEY_EMERGENCY_BELOW && !pc.canAsk && S.day - pl.cnt.lastEmergency >= E.MONEY_EMERGENCY_GAP) {
    pl.cnt.lastEmergency = S.day;
    pl.cnt.emergencies += 1;
    S.queue.push(moneyScene(G));
  }
  const key = cal.year * 2 + cal.term;
  if (cal.cycleInTerm === E.MIDTERM_CYCLE && cal.dayInCycle === 1 && key - pl.cnt.midCheck >= 2) {
    pl.cnt.midCheck = key;
    const st = viewStats(G);
    const bits = [];
    if (st.health < E.MID_CHECK_HEALTH) bits.push('สุขภาพทรุดลงมาก');
    if (st.stress > E.MID_CHECK_STRESS) bits.push('เครียดสูงจนน่าห่วง');
    if (st.knowledge < E.MID_CHECK_KNOWLEDGE) bits.push('ความรู้ยังตามไม่ทัน กลางเทอมแล้ว');
    if (bits.length) S.queue.push(focusP(G, `กลางเทอมแล้ว ${bits.join(' / ')} ลองปรับโฟกัสไหม`, 'ทบทวนโฟกัสกลางเทอม', true));
  }
}

// role pick of the night show, the crush confession, the partner check-in and the breakup roll (queued after the wake block)
function dayBeginActs(G, cal) {
  const S = G.S;
  const pl = S.pl;
  const k = dayKind(G);
  if (cal.firstDayOfTerm) { const b = breakupRoll(G); if (b) S.queue.push(b); }
  if (pl.partner && cal.cycleInTerm === 4 && cal.dayInCycle === 2 && !S.queue.length && !getPlan(G).playDays[S.day]) S.queue.push(checkinScene(G));
  if (k.rolepick && !S.queue.length) queueOrAuto(G, roleScene(G));
  const sc = crushScene(G, false);
  if (sc) S.queue.push(sc);
}

// ---------------- steps ----------------
const STEPS = {
  intro(G) {
    const S = G.S;
    const me = G.me;
    const mates = roommates(G, me);
    const d = dormOf(G);
    const tier = { normal: 'ครอบครัวปกติ', spoiled: 'พ่อแม่ตามใจ (สปอยล์)', rich: 'พ่อแม่รวยมาก' }[me.tier];
    S.minute = E.HOMEROOM;
    S.place = 'หอพัก';
    ask(G, scene(G, {
      tag: 'intro', title: 'เด็กใหม่ ม.1', text: 'เราเป็น 1 ใน 720 คนของโรงเรียนประจำแห่งนี้ ชีวิตหกปีเริ่มต้นวันนี้',
      card: [
        ['เพศ', me.sex === 'M' ? 'ชาย' : 'หญิง'],
        ['นิสัย', me.trait === 'extro' ? 'ชอบเข้าสังคม (extrovert)' : 'ชอบอยู่เงียบๆ (introvert)'],
        ['ห้องเรียน', `ม.1/${me.room}`],
        ['ครอบครัว', tier],
        ['เงินที่พ่อแม่ให้วันแรก', `${nf(me.startMoney)} บาท`],
        ['ค่าขนมรายเดือน', `${nf(monthlyAllowance(30))} บาท`],
        ['หอพัก', `${d.name} ห้อง ${me.dormRoom}`],
        ['เพื่อนร่วมห้องนอน', mates.map((m) => m.name).join(', ')],
      ],
      options: [opt('start', 'เริ่มชีวิตที่โรงเรียน')],
    }));
  },

  termstart(G) {
    const S = G.S;
    S.minute = E.HOMEROOM - 15;
    S.place = 'หน้าห้องเรียน';
    npcTermStart(G);
    ask(G, termStartP(G, 'termstart'));
  },

  daybegin(G) {
    const S = G.S;
    const me = G.me;
    const pl = S.pl;
    const cal = calOf(G);
    S.stat.daysRun += 1;
    S.sickDay = false;
    S.donePeriod = 0;
    const month = Math.floor((S.day - 1) / E.ALLOWANCE_EVERY);
    S.minute = dormOf(G).outBy - DORM_DAY.getReady;
    S.place = `${dormOf(G).name} ห้อง ${me.dormRoom}`;
    if (month > S.lastAllow) {
      me.money += monthlyAllowance(30);
      say(G, `ค่าขนมประจำเดือนเข้าแล้ว ${nf(monthlyAllowance(30))} บาท`, 'good', true);
    }
    for (const o of pl.orders) if (o.status === 'placed' && o.forDay < S.day) o.status = 'expired';
    if (cal.schoolDay) {
      npcSchoolDay(G, cal);
      assignTasks(G, cal);
      resolveNpcTasks(G);
    } else npcWeekend(G);
    npcLineDay(G, cal);
    wakeUp(G);
    me.abs = 0;
    if (pl.stress > E.STRESS_SNAP) {
      queueOrAuto(G, scene(G, {
        tag: 'meltdown', title: 'สลิ้งแตก', text: 'ความเครียดสะสมมาจนเต็ม เราสลิ้งแตกขึ้นมาตอนเช้า',
        options: [opt('cry', 'ร้องไห้ในห้องน้ำหอ', 'เหนื่อยแต่โล่ง'), opt('vent', 'ระบายใส่เพื่อนร่วมห้อง', 'โล่งขึ้นแต่เสียเพื่อน', 'bad'), opt('hide', 'ซุกตัวใต้ผ้าห่มทั้งเช้า', 'ไม่ได้ไปเรียนคาบแรก', 'bad')],
      }));
    }
    if (pl.sick > 0) {
      queueOrAuto(G, scene(G, {
        tag: 'sick', title: 'ไม่สบาย', text: 'ตื่นมาตัวร้อนและปวดหัว',
        options: [opt('rest', 'ไปนอนพักที่ห้องพยาบาล', 'ไม่ได้เข้าเรียนวันนี้'), opt('push', 'ฝืนไปเรียน', 'พลังและสุขภาพลด', 'bad')],
      }));
    }
    maybeEvent(G, cal.schoolDay ? 'dorm' : 'weekend');
    dayBeginActs(G, cal);
    if (S.mode === 'routine') routineDayChecks(G, cal);
    go(G, cal.schoolDay ? 'borrow' : 'wk_breakfast');
  },

  borrow(G) {
    const S = G.S;
    const pl = S.pl;
    const me = G.me;
    const cal = calOf(G);
    if (S.sickDay) return go(G, 'breakfast');
    const todayTk = new Set();
    for (let p = 1; p <= 8; p++) { const c = cellAt(G, me.grade, me.room, cal.dow, p); if (c && c.tk) todayTk.add(c.tk); }
    let need = null;
    for (const t of playerTasks(G)) {
      if (t.due > S.day || !todayTk.has(t.tk)) continue;
      const m = missingItems(G, t).find((x) => !pl.d.borrowTried.includes(x.inv));
      if (m) { need = { t, m }; break; }
    }
    if (!need) return go(G, 'breakfast');
    const fc = (id) => { const f = friendOf(pl, id); return f ? f.closeness : 0; };
    const mates = roommates(G, me).sort((a, b) => fc(b.id) - fc(a.id)).slice(0, 3);
    const options = mates.map((x) => opt(`m${x.id}`, `ยืม${need.m.name}จาก${x.name}`, `สนิทกัน ${Math.round(fc(x.id))}`));
    options.push(opt('none', 'ไม่ยืม ไปเสี่ยงเอา', null, 'bad'));
    ask(G, scene(G, {
      tag: 'borrow', title: 'ของไม่ครบ ก่อนออกจากหอ',
      text: `วันนี้ต้องส่ง "${need.t.name}" แต่เรายังไม่มี ${need.m.name} ออกจากหอไปแล้วกลับเข้ามาไม่ได้ ยืมเพื่อนร่วมห้องตอนนี้เลยไหม`,
      options, data: { inv: need.m.inv, need: need.m.need },
    }));
  },

  breakfast(G) {
    const S = G.S;
    S.minute = dormOf(G).outBy;
    S.place = 'โรงอาหาร';
    ask(G, shopP(G, 'meal', 'breakfast', 'meal_breakfast'));
  },

  homeroom(G) {
    const S = G.S;
    S.minute = E.HOMEROOM;
    S.place = 'โฮมรูม';
    maybeEvent(G, 'class');
    go(G, dayKind(G).fresher ? 'fr_am' : 'morning');
  },

  morning(G) { classBlock(G, 'morning', 'lunch', 'morning'); },
  lunch(G) {
    const S = G.S;
    S.minute = 720;
    S.place = 'โรงอาหาร';
    maybeEvent(G, 'canteen');
    ask(G, shopP(G, 'meal', 'lunch', 'meal_lunch'));
  },
  afternoon(G) { classBlock(G, 'afternoon', afterNoon(G), 'afternoon'); },

  free(G) {
    const S = G.S;
    let end = 780;
    for (let p = 1; p <= 8; p++) if (periodInfo(G, p).kind !== 'free') end = Math.max(end, E.PERIODS[p - 1][1]);
    const start = Math.ceil(end / 30) * 30;
    const slots = Math.floor((18 * 60 - start) / 30);
    if (slots <= 0) return go(G, 'dinner');
    S.minute = start;
    S.place = 'หลังเลิกเรียน';
    ask(G, planP(G, 'free', start, slots, 'ช่วงว่างหลังเลิกเรียน', 'ก่อนเช็คชื่อเข้าหอ 18:00 ใช้เวลาอย่างไรดี', 'free'));
  },

  extras(G) {
    const S = G.S;
    const next = S.extras.shift();
    if (!next) return go(G, S.afterExtras);
    if (next === 'line') ask(G, lineOrderP(G, 'extra_line'));
    else ask(G, shopP(G, next, null, 'extra_shop'));
  },

  dinner(G) {
    const S = G.S;
    S.minute = 17 * 60 + 30;
    S.place = 'โรงอาหาร';
    ask(G, shopP(G, 'meal', 'dinner', 'meal_dinner'));
  },

  checkin(G) {
    const S = G.S;
    S.minute = DORM_DAY.checkIn;
    S.place = `${dormOf(G).name} ห้อง ${G.me.dormRoom}`;
    if (S.mode !== 'routine') say(G, 'เช็คชื่อเข้าหอ 18:00 ครบ', 'neutral');
    S.minute = DORM_DAY.assembly;
    if (S.mode !== 'routine') say(G, 'รวมหอ 19:00 แล้วลงไปห้องอ่านหนังสือชั้นล่าง', 'neutral');
    go(G, eveningPhase(G));
  },

  evening(G) {
    const S = G.S;
    S.minute = DORM_DAY.eveningStart;
    ask(G, planP(G, 'evening', DORM_DAY.eveningStart, 10, 'ค่ำที่หอพัก', 'ตั้งแต่ 19:00 ถึงเที่ยงคืน ทำอะไรก็ได้ แต่หลังไฟดับทำได้แค่เรื่องเงียบๆ', 'evening'));
  },

  night(G) {
    const S = G.S;
    finishDay(G, calOf(G));
    S.day += 1;
    go(G, 'daybegin');
  },

  wk_breakfast(G) {
    const S = G.S;
    S.minute = 8 * 60;
    S.place = 'โรงอาหาร';
    ask(G, shopP(G, 'meal', 'breakfast', 'wk_breakfast'));
  },
  wk_am(G) {
    const S = G.S;
    S.minute = 8 * 60 + 30;
    S.place = 'วันหยุดที่โรงเรียน';
    ask(G, planP(G, 'weekend', S.minute, 7, 'เช้าวันหยุด', 'ไม่มีเรียน ใช้เวลาอย่างไรดี', 'wk_am'));
  },
  wk_lunch(G) {
    const S = G.S;
    S.minute = 12 * 60;
    S.place = 'โรงอาหาร';
    maybeEvent(G, 'canteen');
    ask(G, shopP(G, 'meal', 'lunch', 'wk_lunch'));
  },
  wk_pm(G) {
    const S = G.S;
    S.minute = 13 * 60;
    S.place = 'วันหยุดที่โรงเรียน';
    ask(G, planP(G, 'weekend', S.minute, 10, 'บ่ายวันหยุด', 'ต้องกลับเข้าหอก่อน 18:00', 'wk_pm'));
  },
  wk_dinner(G) {
    const S = G.S;
    S.minute = 17 * 60 + 30;
    S.place = 'โรงอาหาร';
    ask(G, shopP(G, 'meal', 'dinner', 'wk_dinner'));
  },

  // Friday after the last class of the second week: term end (if it is one), then the trip home
  tripbegin(G) {
    const S = G.S;
    const cal = calOf(G);
    S.minute = 16 * 60 + 30;
    finishDay(G, cal, true);
    if (cal.lastCycleOfTerm) {
      const rep = closeTerm(G);
      if (S.mode === 'routine' && !S.yearPending) {
        ANSWERS.report(G, { optionId: 'next' }, rep); // the term result is in the record and the term recap
        S.recap = buildRecap(G, 'term', cal, G.me.grade);
        S.flags.term = true;
        S.flags.weekSkip = true;
      } else {
        S.queue.push(rep);
        S.phase = 'await';
      }
    } else go(G, 'trip');
  },

  trip(G) {
    const S = G.S;
    const cal = calOf(G);
    S.minute = 17 * 60;
    S.place = 'บ้าน';
    maybeEvent(G, 'home');
    const holiday = S.yearPending;
    const barred = cond(G).noHome > 0 && !holiday; // a dorm punishment or a suspension: no trip home this time
    ask(G, scene(G, {
      tag: 'trip', title: holiday ? 'ปิดเทอม กลับบ้าน' : barred ? 'โดนงดกลับบ้านรอบนี้' : 'กลับบ้าน (จุดเซฟ)',
      text: holiday ? 'จบปีการศึกษาแล้ว ได้กลับบ้านยาวๆ ก่อนขึ้นชั้นใหม่' : barred ? 'เลิกเรียนวันศุกร์ เพื่อนๆ ทยอยกลับบ้านกันหมด แต่เราถูกงดกลับบ้านรอบนี้ตามโทษของหอพัก ต้องอยู่หอสองวัน ระบบเซฟให้ตอนนี้' : 'เลิกเรียนวันศุกร์ ได้กลับบ้านสองวัน เสาร์อาทิตย์ แล้วกลับหอตอน 18:00 วันอาทิตย์ ระบบเซฟให้ตอนนี้',
      card: [['เงินที่มี', `${nf(G.me.money)} บาท`], ['เทอม', `${cal.term} ปี ${cal.year}`]],
      options: barred ? [
        opt('rest', 'อยู่หอพักผ่อน', 'เครียดลดน้อยกว่าที่บ้าน'),
        opt('study', 'อยู่หออ่านหนังสือ', 'ความรู้ขึ้นนิดหน่อย'),
        opt('quit', 'ลาออก', `ค่าธรรมเนียม ${nf(E.QUIT_FEE_PER_TERM)} บาทต่อเทอม`, 'bad'),
      ] : [
        opt('rest', 'พักผ่อนอยู่บ้านเงียบๆ', 'นอนเยอะ เครียดลด', 'good'),
        opt('study', 'ทำงานและอ่านหนังสือที่บ้าน', 'ความรู้ขึ้นนิดหน่อย'),
        opt('out', 'ไปเที่ยวกับครอบครัวหรือเพื่อน', 'สนุกแต่เสียเงิน 300 บาท'),
        opt('quit', 'ลาออก', `ค่าธรรมเนียม ${nf(E.QUIT_FEE_PER_TERM)} บาทต่อเทอม`, 'bad'),
      ],
    }));
  },

  newyear(G) {
    promoteAll(G);
    G.S.pl.sleepHours = 8;
    ask(G, newYearScene(G));
  },

  focus(G) {
    G.S.pl.cnt.focus += 1;
    ask(G, focusP(G, G.S.pl.hint));
  },

  ended() {},

  // ---- activities (CONTRACT3): each phase starts an act, the phase 'act' runs it ----
  act(G) { actStep(G); },
  fr_am(G) { enterAct(G, 'fresher', { day: dayKind(G).fresher - 1, i: 0, end: 1, next: 'lunch', blockId: 'fr1' }); },
  fr_pm(G) { enterAct(G, 'fresher', { day: dayKind(G).fresher - 1, i: 2, end: 2, next: 'free', blockId: 'fr3' }); },
  hall(G) { enterAct(G, 'hall', { kind: dayKind(G).hall, blockId: 'hall', next: 'free' }); },
  award(G) { enterAct(G, 'award', { blockId: 'award', next: 'trip' }); },
  sat(G) { enterAct(G, 'sat', { i: 0, next: 'wk_lunch' }); },
  fair_am(G) { enterAct(G, 'fair_am', { blockId: 'fair_morning', next: 'wk_lunch' }); },
  fair_pm(G) { enterAct(G, 'fair_pm', { blockId: 'fair_afternoon', next: 'wk_dinner' }); },
  fair_ev(G) { enterAct(G, 'fair_ev', { blockId: 'fair_evening', next: 'night' }); },
  rehearsal(G) { enterAct(G, 'rehearsal', { blockId: 'rehearsal', n: dayKind(G).rehearsal, next: 'wk_dinner' }); },
  show(G) { enterAct(G, 'show', { blockId: 'show', next: 'night' }); },
};

// ====================================================================================================
// Block stepping (routine mode, CONTRACT2 5.1). Every routine step either runs silently or plays one block of the
// player's day and calls emit(); stepBlock() runs steps until a block was played or a decision is open.
// ====================================================================================================
const snapOf = (G) => ({ health: G.S.pl.health, energy: G.S.pl.energy, stress: G.S.pl.stress, fullness: G.S.pl.fullness, peer: G.S.pl.peer, money: G.me.money });

function ensureDay(G) {
  const S = G.S;
  if (!S.dayB || S.dayB.day !== S.day) S.dayB = { day: S.day, blocks: planDay(G).map((b) => ({ ...b, done: false })) };
}

const TAGS = [['สลิ้งแตกใน', 'teacherSnap'], ['แอบกิน', 'lineShop'], ['โดดคาบ', 'skip'], ['ถูกหัก', 'taskFail'], ['ส่ง "', 'task'], ['ไม่สบาย', 'sick'], ['ร้องไห้', 'meltdown'], ['ของหาย', 'lostItem'], ['โทรหาพ่อแม่', 'parents']];

// o: { detail?, tone?, place?, placeKind?, tags? }
function emit(G, id, o = {}) {
  const S = G.S;
  ensureDay(G);
  let pb = S.dayB.blocks.find((b) => b.id === id && !b.done);
  if (!pb && ['award'].includes(id)) {
    // a block that only exists once the day has played out (the 4.00 award after the term report): put it before the trip
    const at = S.dayB.blocks.findIndex((b) => b.id === 'trip');
    const nb = { id, from: hhmm(S.minute), to: hhmm(S.minute + 60), minute: S.minute, end: S.minute + 60, place: 'หอประชุม', placeKind: 'stage', what: 'พิธีมอบรางวัลเกียรตินิยม 4.00', done: false };
    S.dayB.blocks.splice(at < 0 ? S.dayB.blocks.length : at, 0, nb);
    pb = nb;
  }
  const base = pb
    ? { id: pb.id, from: pb.from, to: pb.to, minute: pb.minute, place: pb.place, placeKind: pb.placeKind, what: pb.what }
    : { id, from: hhmm(S.minute), to: hhmm(S.minute), minute: S.minute, place: S.place, placeKind: 'walk', what: id };
  const notes = S.blkNotes || [];
  const text = notes.map((n) => n.text).join(' · ');
  const detail = o.detail !== undefined ? [o.detail, o.addNotes ? text : ''].filter(Boolean).join(' · ') : text;
  const tone = o.tone || (notes.some((n) => n.tone === 'bad') ? 'bad' : notes.some((n) => n.tone === 'good') ? 'good' : 'neutral');
  const tags = o.tags ? o.tags.slice() : [];
  for (const [needle, tag] of TAGS) if (notes.some((n) => n.text.includes(needle)) && !tags.includes(tag)) tags.push(tag);
  const now = snapOf(G);
  const was = G.snap || now;
  const fx = {};
  for (const k of Object.keys(now)) {
    const d = Math.round((now[k] - was[k]) * 10) / 10;
    if (d) fx[k] = d;
  }
  const b = { ...base, ...(o.what ? { what: o.what } : {}), ...(o.place ? { place: o.place } : {}), ...(o.placeKind ? { placeKind: o.placeKind } : {}), detail, tone, spend: Math.round(S.bspend || 0), fx, tags };
  if (pb) { pb.done = true; pb.detail = detail; if (o.what) pb.what = o.what; if (o.place) pb.place = o.place; if (o.placeKind) pb.placeKind = o.placeKind; S.minute = pb.end % 1440; } // the clock moves block by block
  G.blk = b;
  S.blkNotes = [];
  S.bspend = 0;
  G.snap = snapOf(G);
  // the day's one random event comes right after its block
  if (S.evPlan && S.evPlan.after === id) {
    const ep = S.evPlan;
    S.evPlan = null;
    if (S.stopDay !== S.day && !S.pending && !S.queue.length) maybeEvent(G, ep.place, true, b);
  }
}

function planEventForDay(G) {
  const S = G.S;
  const cal = calOf(G);
  S.evPlan = null;
  if (cal.lastSchoolDay && cal.lastCycleOfTerm) return; // the term report is today's stop
  conductDaily(G);
  const gap = S.day - (S.pl.lastBeat || 0);
  const B = E.BEAT;
  const chance = (cal.schoolDay ? B.SCHOOL : B.WEEKEND) + (gap >= B.CATCHUP_AFTER ? (gap - B.CATCHUP_AFTER + 1) * B.CATCHUP_STEP : 0);
  if (!G.rng.chance(Math.min(0.95, chance))) return;
  if (getPlan(G).playDays[S.day]) return; // a day with a play is a day with its own stop
  const dk = dayKind(G);
  const all = cal.schoolDay
    ? [['wake', 'dorm'], ['p2', 'class'], ['p3', 'class'], ['p6', 'class'], ['p7', 'class'], ['lunch', 'canteen'], ['checkin', 'dorm']]
    : [['morning', 'weekend'], ['sat2', 'weekend'], ['sat4', 'weekend'], ['afternoon', 'weekend'], ['lunch', 'canteen']];
  if (dk.fresher || dk.fair || dk.show) return;
  const ids = new Set(planDay(G).map((b) => b.id));
  const opts = all.filter(([id]) => ids.has(id));
  if (!opts.length) return;
  const [after, place] = opts[G.rng.int(0, opts.length - 1)];
  S.evPlan = { after, place };
}

const STANCE_TH = { focus: 'ตั้งใจเรียน', normal: 'เรียนตามปกติ', relax: 'เรียนสบายๆ' };
const MOOD_TH = { calm: 'ครูอารมณ์ดี', tense: 'ครูเริ่มตึง', snapping: 'ครูหัวร้อน' };

function planSummary(G) {
  const lp = G.lastPlan;
  if (!lp) return '';
  const table = tableFor(lp.kind);
  const cnt = {};
  for (const id of lp.ids) if (id !== 'sleep' && table[id]) cnt[id] = (cnt[id] || 0) + 1;
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => table[id].th).join(', ');
}

function mealDetail(G) {
  const buys = (G.S.blkNotes || []).filter((n) => n.text.startsWith('ซื้อ'));
  return buys.length ? '' : 'ไม่ได้ซื้ออะไร';
}

function runExtras(G) {
  let guard = 0;
  while (G.S.phase === 'extras' && ++guard < 20) STEPS.extras(G);
}

function classBlockR(G, block, nextPhase, tag) {
  const S = G.S;
  const me = G.me;
  const ps = block === 'morning' ? morningPeriods(G) : afternoonPeriods(G);
  if (!ps.length) return go(G, nextPhase);
  S.minute = E.PERIODS[ps[0] - 1][0];
  S.place = 'ห้องเรียน';
  const { pending, has } = classPlanP(G, block, tag);
  let input = { stance: 'normal', skipPeriods: [], line: [] };
  if (has) {
    if (S.sickDay || me.abs === 1) input = { stance: 'relax', skipPeriods: pending.periods.filter((q) => q.kind !== 'free').map((q) => q.p), line: [] };
    else {
      const pay = routinePayload(G, pending);
      const v = validate(G, pending, pay);
      input = v.ok ? v.payload : makeDefault(G, pending);
    }
  }
  S.bp = { ps, input, i: 0, next: nextPhase };
  go(G, 'period');
  periodStep(G);
}

function periodStep(G) {
  const S = G.S;
  const me = G.me;
  const bp = S.bp;
  const p = bp.ps[bp.i];
  const info = periodInfo(G, p);
  const skipped = bp.input.skipPeriods.includes(p);
  const sickDay = S.sickDay || me.abs === 1;
  const mood = info.kind === 'class' ? moodOf(G, info.tk) : null;
  runBlock(G, [p], { stance: bp.input.stance, skipPeriods: skipped ? [p] : [], line: bp.input.line.filter((l) => l.p === p) });
  bp.i += 1;
  if (bp.i >= bp.ps.length) { S.bp = null; go(G, bp.next); }
  let detail;
  if (info.kind === 'class') {
    detail = sickDay ? 'พักที่ห้องพยาบาล ไม่ได้เข้าเรียน' : skipped ? 'โดดคาบ' : `${STANCE_TH[bp.input.stance]} ${MOOD_TH[mood]}`;
  } else if (info.kind === 'activity') detail = sickDay || skipped ? 'ไม่ได้เข้าร่วม' : `เข้าร่วม${info.name}`;
  else detail = 'คาบว่าง พักผ่อน';
  // a planned lab or club-craft play for this period (CONTRACT3 section 4): the block is emitted when the play is done
  const fill = dayKind(G).fill;
  if (fill && fill.where === 'p' && fill.p === p && !skipped && !sickDay && ((fill.game === 'lab' && info.kind === 'class') || (fill.game === 'club' && info.kind === 'activity'))) {
    const notes = (S.blkNotes || []).map((n) => n.text).join(' · ');
    enterAct(G, 'filler', { game: fill.game, blockId: 'p' + p, detail: [detail, notes].filter(Boolean).join(' · '), tone: 'neutral', next: S.phase });
    return;
  }
  emit(G, 'p' + p, { detail, addNotes: true, tone: skipped && !sickDay ? 'bad' : undefined });
}

const HOME_SEQ = ['sleep', 'h_morning', 'h_lunch', 'h_afternoon', 'h_evening', 'sleep', 'h_morning', 'h_lunch', 'h_afternoon', 'h_evening', 'sleep'];
const HOME_TEXT = {
  stay: { h_morning: 'อยู่หอ นอนตื่นสาย', h_lunch: 'กินข้าวที่โรงอาหารเกือบว่างเปล่า', h_afternoon: 'นั่งเงียบๆ ในหอพัก เพื่อนๆ กลับบ้านกันหมด', h_evening: 'ค่ำที่หอพักเงียบๆ' },
  rest: { h_morning: 'นอนตื่นสายที่บ้าน', h_lunch: 'กินข้าวฝีมือแม่', h_afternoon: 'ดูทีวี พักผ่อนเงียบๆ', h_evening: 'ค่ำที่บ้านเงียบๆ' },
  study: { h_morning: 'อ่านหนังสือที่บ้าน', h_lunch: 'กินข้าวกับครอบครัว', h_afternoon: 'ทำงานที่ครูสั่ง', h_evening: 'ทบทวนบทเรียน' },
  out: { h_morning: 'ออกไปเที่ยวกับครอบครัวและเพื่อน', h_lunch: 'กินข้าวนอกบ้าน', h_afternoon: 'เดินเล่น ซื้อของ', h_evening: 'กลับบ้านเหนื่อยแต่สนุก' },
};

const RSTEPS = {
  daybegin(G) {
    STEPS.daybegin(G);
    planEventForDay(G);
    const S = G.S;
    const notes = (S.blkNotes || []).map((n) => n.text).join(' · ');
    emit(G, 'wake', { detail: `ตื่น ${hhmm(S.minute)} พลัง ${Math.round(S.pl.energy)}${notes ? ' · ' + notes : ''}` });
  },
  breakfast(G) { STEPS.breakfast(G); emit(G, 'breakfast', { detail: mealDetail(G), addNotes: true }); },
  wk_breakfast(G) { STEPS.wk_breakfast(G); emit(G, 'breakfast', { detail: mealDetail(G), addNotes: true }); },
  lunch(G) { STEPS.lunch(G); emit(G, 'lunch', { detail: mealDetail(G), addNotes: true }); },
  wk_lunch(G) { STEPS.wk_lunch(G); emit(G, 'lunch', { detail: mealDetail(G), addNotes: true }); },
  dinner(G) { STEPS.dinner(G); emit(G, 'dinner', { detail: mealDetail(G), addNotes: true }); },
  wk_dinner(G) { STEPS.wk_dinner(G); emit(G, 'dinner', { detail: mealDetail(G), addNotes: true }); },
  morning(G) { classBlockR(G, 'morning', 'lunch', 'morning'); },
  afternoon(G) { classBlockR(G, 'afternoon', afterNoon(G), 'afternoon'); },
  period(G) { periodStep(G); },
  free(G) {
    const had = freeSlots(G).slots > 0;
    STEPS.free(G);
    runExtras(G);
    if (had) emit(G, 'free', { detail: planSummary(G) || 'พักผ่อน', addNotes: true });
  },
  wk_am(G) { STEPS.wk_am(G); runExtras(G); emit(G, 'morning', { detail: planSummary(G) || 'พักผ่อน', addNotes: true }); },
  wk_pm(G) { STEPS.wk_pm(G); runExtras(G); emit(G, 'afternoon', { detail: planSummary(G) || 'พักผ่อน', addNotes: true }); },
  checkin(G) {
    STEPS.checkin(G);
    if (calOf(G).schoolDay) emit(G, 'checkin', { detail: 'เช็คชื่อ 18:00 ครบ รวมหอ 19:00' });
  },
  evening(G) { STEPS.evening(G); emit(G, 'evening', { detail: planSummary(G) || 'พักผ่อน', addNotes: true }); },
  night(G) {
    const S = G.S;
    finishDay(G, calOf(G));
    emit(G, 'sleep', { detail: `หลับประมาณ ${S.pl.sleepHours.toFixed(1)} ชั่วโมง`, addNotes: true });
    S.day += 1;
    go(G, 'daybegin');
  },
  trip(G) {
    STEPS.trip(G);
    if (G.S.phase === 'home') {
      const why = { stay: 'อยู่หอ ถูกงดกลับบ้าน', rest: 'พักผ่อนที่บ้านเต็มที่', study: 'ตั้งใจอ่านหนังสือที่บ้าน', out: 'ไปเที่ยวกับครอบครัวและเพื่อน' }[G.lastTrip] || 'กลับบ้าน';
      emit(G, 'trip', { detail: G.lastTrip === 'stay' ? `ไม่ได้กลับบ้านสองคืน ${why}` : `กลับบ้านสองคืน ${why}` });
    }
  },
  home(G) {
    const S = G.S;
    const k = S.home.k;
    const id = HOME_SEQ[k];
    const mode = G.lastTrip || 'rest';
    if (k === 1 || k === 6) {
      S.evPlan = G.rng.chance(E.EVENT_DAY.home) ? { after: 'h_afternoon', place: 'home' } : null;
    }
    let detail;
    if (id === 'sleep') detail = k === 0 ? 'นอนที่บ้าน' : 'หลับสบาย';
    else if (id === 'h_evening' && k === 9) detail = 'กลับถึงหอ 18:00 แล้วค่ำที่หอ';
    else detail = (HOME_TEXT[mode] || HOME_TEXT.rest)[id];
    emit(G, id, { detail });
    if (id === 'sleep') {
      if (k === 5 || k === 10) shops.nightly(S.shop, S.day, G.rng);
      S.day += 1;
    }
    S.home.k += 1;
    if (S.home.k >= HOME_SEQ.length) {
      S.home = null;
      const next = calOf(G);
      if (S.yearPending) {
        const calBefore = calendar(S.day - 1, E.TERM_CYCLES);
        const gradeBefore = G.me.grade;
        STEPS.newyear(G);
        S.recap = buildRecap(G, 'year', calBefore, gradeBefore);
        S.flags.year = true;
      } else if (next.firstDayOfTerm) go(G, 'termstart');
      else go(G, 'daybegin');
    }
  },
};

// plays exactly one block of the player's day (see CONTRACT2 5.1)
export function stepBlock(G) {
  const S = G.S;
  const res = { ok: true, done: false, block: null, log: [], pending: null, dayEnded: false, weekEnded: false, termEnded: false, yearEnded: false, ended: false };
  S.recap = null;
  S.flags.term = false;
  S.flags.year = false;
  if (!S.pending && S.queue.length) S.pending = S.queue.shift();
  if (S.pending) {
    res.pending = S.pending;
    res.ended = !!S.pending.final;
    return res;
  }
  ensureDay(G);
  const day0 = S.day;
  G.snap = snapOf(G);
  G.blk = null;
  let guard = 0;
  while (!S.pending && !G.blk) {
    if (S.queue.length) { S.pending = S.queue.shift(); break; }
    if (++guard > 400) throw new Error('engine loop: phase ' + S.phase);
    const step = RSTEPS[S.phase] || STEPS[S.phase];
    if (!step) throw new Error('unknown phase ' + S.phase);
    step(G);
    if (S.pending || S.queue.length) S.stopDay = S.day;
  }
  if (!S.pending && S.queue.length) S.pending = S.queue.shift();
  if (S.pending) S.stopDay = S.day;
  res.pending = S.pending;
  res.ended = !!(S.pending && S.pending.final);
  res.block = G.blk;
  res.done = !!G.blk;
  G.blk = null;
  res.termEnded = S.flags.term;
  res.yearEnded = S.flags.year;
  if (S.day !== day0) {
    res.dayEnded = true;
    const last = calendar(day0, E.TERM_CYCLES);
    if (calOf(G).dow === 1 && S.day > day0) {
      res.weekEnded = true;
      if (S.flags.weekSkip || res.termEnded || res.yearEnded) {
        S.flags.weekSkip = false; // a term / year recap already told this week
        res.weekEnded = false;
      } else {
        S.recap = buildRecap(G, 'week', last);
        const m = S.recap.money;
        say(G, `สัปดาห์ที่ ${weekNo(last)}: ใช้เงิน ${nf(m.spent)} บาท${S.recap.sleepAvg !== null ? ` นอนเฉลี่ย ${S.recap.sleepAvg.toFixed(1)} ชม.` : ''}`, S.recap.mood === 'up' ? 'good' : S.recap.mood === 'down' ? 'bad' : 'neutral');
        S.blkNotes.pop(); // a record line, not a note of the next block
      }
    }
  }
  if (res.termEnded && !S.recap) res.termEnded = false;
  res.recap = S.recap;
  return res;
}

function classBlock(G, block, nextPhase, tag) {
  const S = G.S;
  const me = G.me;
  const ps = block === 'morning' ? morningPeriods(G) : afternoonPeriods(G);
  if (!ps.length) return go(G, nextPhase); // a day with no classes in this block (freshers' day, sport Friday)
  S.minute = E.PERIODS[ps[0] - 1][0];
  S.place = 'ห้องเรียน';
  const { pending, has } = classPlanP(G, block, tag);
  if (!has) return go(G, nextPhase);
  if (S.sickDay || me.abs === 1) {
    const all = pending.periods.filter((q) => q.kind !== 'free').map((q) => q.p);
    runBlock(G, ps, { stance: 'relax', skipPeriods: all, line: [] });
    return go(G, nextPhase);
  }
  S.afterBlock = nextPhase;
  ask(G, pending);
}

// ---------------- answers ----------------
const meal = (next) => (G, payload, pd) => { applyCart(G, pd, payload); go(G, typeof next === 'function' ? next(G) : next); };
const wkMorning = (G) => { const k = dayKind(G); return k.fair ? 'fair_am' : k.sat ? 'sat' : 'wk_am'; };
const wkAfternoon = (G) => { const k = dayKind(G); return k.fair ? 'fair_pm' : k.rehearsal ? 'rehearsal' : 'wk_pm'; };
const eveningPhase = (G) => { const k = dayKind(G); return k.fair ? 'fair_ev' : k.show ? 'show' : 'evening'; };
const lunchNext = (G) => (dayKind(G).fresher ? 'fr_pm' : 'afternoon');
const block = () => (G, payload, pd) => {
  runBlock(G, pd.data.ps, payload);
  go(G, G.S.afterBlock);
};

const ANSWERS = {
  intro(G) { go(G, 'termstart'); },
  termstart(G, payload) {
    const S = G.S;
    const pl = S.pl;
    pl.clubId = payload.clubId;
    pl.electiveId = payload.electiveId;
    pl.satGroup = payload.satGroup || defaultSatGroup(G);
    pl.prev = { clubId: payload.clubId, electiveId: payload.electiveId, satGroup: pl.satGroup };
    if (payload.clubId) S.clubTaken[payload.clubId] = (S.clubTaken[payload.clubId] || 0) + 1;
    const groups = [];
    for (const dk of DOW_KEYS) for (const c of S.tt[G.me.grade].rooms[G.me.room][dk]) if (c && c.act && c.act.startsWith('พก.') && c.group && c.group !== 'all' && !groups.includes(c.group)) groups.push(c.group);
    pl.elGroup = groups.length ? groups.sort()[G.rng.int(0, groups.length - 1)] : 'all';
    setupTermPlayer(G);
    termFriends(G);
    const club = payload.clubId ? clubById(payload.clubId) : null;
    say(G, club ? `เข้าชุมนุม ${club.name}` : 'เทอมนี้ไม่ได้ชุมนุม', 'neutral');
    S.blkNotes = [];
    go(G, S.mode === 'routine' ? 'focus' : 'daybegin');
  },
  focus(G, payload, pd) {
    const S = G.S;
    S.routine = { ...payload.routine };
    say(G, `ตั้งโฟกัส: เรียน${LABEL.study[S.routine.study]} อาหาร${LABEL.food[S.routine.food]} ค่ำ${LABEL.evening[S.routine.evening]} ของกิน${LABEL.snack[S.routine.snack]}`, 'neutral');
    S.blkNotes = [];
    if (!pd.mid) go(G, 'daybegin');
  },
  money(G, payload) {
    const pl = G.S.pl;
    if (payload.optionId === 'loan') {
      G.me.money += E.MONEY_EMERGENCY_LOAN;
      pl.stress = clamp(pl.stress + 3, 0, 100);
      pl.peer = clamp(pl.peer - 2, 0, 100);
      say(G, `ยืมเงินเพื่อนร่วมห้อง ${E.MONEY_EMERGENCY_LOAN} บาท`, 'neutral');
    } else {
      G.S.routine.food = 'cheap';
      say(G, 'ประหยัดเต็มที่ ปรับค่าอาหารเป็นประหยัด', 'neutral');
    }
  },
  event: answerEvent,
  cscene: answerCScene,
  conduct: answerConduct,
  act_mg: (G, payload) => answerMg(G, payload),
  fair_choice: (G, payload) => answerActScene(G, payload),
  fair_own: (G, payload) => answerActScene(G, payload),
  fair_contest: (G, payload) => answerActScene(G, payload),
  companion: (G, payload, pd) => answerCompanion(G, payload, pd),
  show_role: (G, payload) => answerRole(G, payload),
  crush: (G, payload, pd) => answerCrush(G, payload, pd),
  breakup: (G, payload, pd) => answerBreakup(G, payload, pd),
  partner_check: (G, payload) => answerCheckin(G, payload),
  meltdown(G, payload) {
    const pl = G.S.pl;
    const set = { cry: [-35, -5, 0], vent: [-30, 0, -8], hide: [-40, 5, 0] }[payload.optionId];
    pl.stress = clamp(pl.stress + set[0], 0, 100);
    pl.energy = clamp(pl.energy + set[1], 0, 100);
    pl.peer = clamp(pl.peer + set[2], 0, 100);
    say(G, { cry: 'ร้องไห้จนโล่ง', vent: 'ระบายใส่เพื่อนร่วมห้อง เสียงดังไปหน่อย', hide: 'ซุกตัวใต้ผ้าห่มอยู่นาน' }[payload.optionId], 'neutral');
  },
  sick(G, payload) {
    const S = G.S;
    const pl = S.pl;
    if (payload.optionId === 'rest') {
      S.sickDay = true;
      G.me.abs = 1;
      pl.health = clamp(pl.health + 8, 0, 100);
      pl.stress = clamp(pl.stress - 5, 0, 100);
      pl.sick = 0;
      say(G, 'นอนพักที่ห้องพยาบาลทั้งวัน', 'neutral');
    } else {
      pl.energy = clamp(pl.energy - 20, 0, 100);
      pl.health = clamp(pl.health - 3, 0, 100);
      say(G, 'ฝืนไปเรียนทั้งที่ไม่สบาย', 'bad');
    }
  },
  borrow(G, payload, pd) {
    const pl = G.S.pl;
    go(G, 'borrow');
    pl.d.borrowTried.push(pd.data.inv);
    if (payload.optionId === 'none') return say(G, 'ไม่ได้ยืมของ ออกจากหอไปเสี่ยงเอา', 'neutral');
    const id = Number(payload.optionId.slice(1));
    const mate = G.byId.get(id);
    const close = (friendOf(pl, id) || { closeness: 0 }).closeness;
    if (G.rng.chance(0.3 + 0.5 * (close / 100))) {
      pl.inv[pd.data.inv] = Math.max(pl.inv[pd.data.inv] || 0, pd.data.need);
      bumpFriend(G, id, 3);
      say(G, `${mate ? mate.name : 'เพื่อน'}ให้ยืมของ`, 'good');
    } else say(G, `${mate ? mate.name : 'เพื่อน'}ก็ไม่มีของที่ต้องการ`, 'bad');
  },
  meal_breakfast: meal('homeroom'),
  meal_lunch: meal(lunchNext),
  meal_dinner: meal('checkin'),
  wk_breakfast: meal(wkMorning),
  wk_lunch: meal(wkAfternoon),
  wk_dinner: meal('checkin'),
  morning: block(),
  afternoon: block(),
  free(G, payload) {
    const S = G.S;
    G.lastPlan = { kind: 'free', ids: payload.plan };
    S.extras = applyPlan(G, payload.plan, 'free');
    S.afterExtras = 'dinner';
    go(G, 'extras');
  },
  wk_am(G, payload) {
    const S = G.S;
    G.lastPlan = { kind: 'weekend', ids: payload.plan };
    S.extras = applyPlan(G, payload.plan, 'weekend');
    S.afterExtras = 'wk_lunch';
    go(G, 'extras');
  },
  wk_pm(G, payload) {
    const S = G.S;
    G.lastPlan = { kind: 'weekend', ids: payload.plan };
    S.extras = applyPlan(G, payload.plan, 'weekend');
    S.afterExtras = 'wk_dinner';
    go(G, 'extras');
  },
  extra_shop(G, payload, pd) { applyCart(G, pd, payload); go(G, 'extras'); },
  extra_line(G, payload) { applyLineOrder(G, payload); go(G, 'extras'); },
  evening(G, payload) {
    const S = G.S;
    const pl = S.pl;
    const ev = evaluateEvening(dormOf(G), payload.plan);
    pl.sleepHours = ev.sleepHours;
    G.lastPlan = { kind: 'evening', ids: ev.plan };
    rcAdd(G, 'sleepSum', ev.sleepHours);
    rcAdd(G, 'sleepN');
    applyFx(G, ev.fx, true);
    const friendIds = pl.friends.map((f) => f.id);
    for (const id of ev.plan) {
      if (id === 'chat' && friendIds.length) bumpFriend(G, friendIds[G.rng.int(0, friendIds.length - 1)], 2);
    }
    for (let i = 0; i < ev.parentCalls; i++) callParents(G);
    if (S.mode !== 'routine') say(G, `หลับประมาณ ${ev.sleepHours.toFixed(1)} ชั่วโมง`, ev.sleepHours < 6.5 ? 'bad' : 'neutral');
    go(G, 'night');
  },
  report(G) {
    const S = G.S;
    const cal = calOf(G);
    const after = awardApplies(G) ? 'award' : 'trip';
    if (!S.yearPending) return go(G, after);
    if (G.me.grade === 6) return endGame(G, 'graduated');
    if (G.me.grade === 3) { S.queue.push(gateScene(G)); S.phase = 'await'; return; }
    go(G, after);
  },
  gate1(G, payload) {
    const S = G.S;
    if (payload.optionId === 'exam') { S.queue.push(gateResultScene(G)); return; }
    endGame(G, 'left_elite', ` (${{ mwit: 'MWIT', kvis: 'KVIS', wmw: 'วมว.' }[payload.optionId]})`);
  },
  gate2(G) { go(G, awardApplies(G) ? 'award' : 'trip'); },
  gate3(G, payload) { endGame(G, payload.optionId === 'smurf' ? 'failed_gate_smurf' : 'failed_gate_stop'); },
  trip(G, payload) {
    const S = G.S;
    const pl = S.pl;
    const me = G.me;
    if (payload.optionId === 'quit') {
      S.queue.push(scene(G, {
        tag: 'quit', title: 'แน่ใจหรือ', text: `ลาออกต้องจ่าย ${nf(E.QUIT_FEE_PER_TERM)} บาทต่อเทอม (ปีละ ${nf(E.QUIT_FEE_PER_TERM * 2)} บาท) และเรื่องราวทั้งหมดจะจบตรงนี้`,
        options: [opt('stay', 'ยังไม่ลาออก', null, 'good'), opt('quit', 'ลาออกจริงๆ', null, 'bad')],
      }));
      return go(G, 'trip');
    }
    const cdn = cond(G);
    const barred = cdn.noHome > 0 && !S.yearPending;
    if (barred) {
      cdn.noHome = 0; // the punishment is served
      if (payload.optionId === 'rest') applyFx(G, { stress: -8, energy: 10 });
      else { applyFx(G, { stress: 2 }); pl.bonusZ += 0.01; }
      applyFx(G, { stress: 8, peer: -2 });
    } else if (payload.optionId === 'rest') applyFx(G, { stress: -25, health: 5, energy: 10 });
    else if (payload.optionId === 'study') { applyFx(G, { stress: -8, health: 1 }); pl.bonusZ += 0.01; } else applyFx(G, { stress: -30, peer: 6, money: -300 });
    if (S.mode === 'routine' && barred) say(G, 'ถูกงดกลับบ้านรอบนี้ อยู่หอสองวัน (โทษของหอพักจบแล้ว)', 'bad');
    else if (S.mode === 'routine') say(G, { rest: 'กลับบ้านสุดสัปดาห์ นอนพักเต็มที่', study: 'กลับบ้านสุดสัปดาห์ อ่านหนังสือและทำงาน', out: 'กลับบ้านสุดสัปดาห์ ไปเที่ยวกับครอบครัวและเพื่อน' }[payload.optionId] || 'กลับบ้านสุดสัปดาห์', 'neutral');
    else say(G, 'กลับถึงหอวันอาทิตย์ 18:00', 'neutral');
    resetAsks(me);
    npcHome(G);
    if (S.mode === 'routine') {
      // the two nights at home are played day by day (phase 'home'); nothing else to do here
      G.lastTrip = barred ? 'stay' : payload.optionId;
      if (payload.optionId === 'out') spend(G, 300);
      for (const T of Object.values(S.ts)) T.p *= E.NIGHT_DECAY;
      S.home = { k: 0 };
      return go(G, 'home');
    }
    const cal = calOf(G);
    for (let d = S.day + 1; d <= S.day + 2; d++) shops.nightly(S.shop, d, G.rng);
    S.day += 3;
    for (const T of Object.values(S.ts)) T.p *= E.NIGHT_DECAY;
    const next = calOf(G);
    if (S.yearPending) go(G, 'newyear');
    else if (next.firstDayOfTerm) go(G, 'termstart');
    else go(G, 'daybegin');
  },
  quit(G, payload) {
    if (payload.optionId === 'quit') endGame(G, 'quit');
    // 'stay': the trip scene is asked again by the phase
  },
  newyear(G) { go(G, 'termstart'); },
  final() {},
};

bindIO({ ask, go, emit: (G, id, o) => { if (G.S.mode === 'routine') emit(G, id, o); } });
