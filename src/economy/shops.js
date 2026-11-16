// Shop logic for "1 ใน 720": listing, buying, the LINE shop, the crepe subplot, co-op and print room.
// All state is plain JSON (createShopState). Nothing here changes student.money: the engine does that
// from the returned price. Randomness only through the Rng that is passed in.
import {
  SHOP_CONFIG as C,
  LINE_CAUGHT_CHANCE,
  SHOPS,
  ITEMS,
  LINE_ITEMS,
  LINE_SHOP,
  LINE_SPARE_IDS,
  COOP_ITEMS,
  COOP_SHOP,
  PRINT_ITEM,
  PRINT_SHOP,
  INVENTORY_ITEM_IDS,
} from '../data/shops.js';

// inventory item ids a teacher may require (see data/shops.js INVENTORY_ITEM_IDS)
export const COOP_ITEM_IDS = INVENTORY_ITEM_IDS;

const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const SHOP_BY_ID = Object.fromEntries(SHOPS.map((s) => [s.id, s]));
const SPARE_ITEMS = LINE_ITEMS.filter((i) => i.spare);

// ---------------- state ----------------
export function createShopState(rng) {
  const st = {
    v: 1,
    day: 0, // the school day the shops are on (set by nightly)
    crepe: { status: 'none', invested: 0, weeks: 0, startDay: null, lastTick: null, freeReady: false },
    // status: none | funding | rich | failed
    line: { orders: [], nextId: 1, rolledThrough: -1 },
    coop: { stock: 'unlimited' },
  };
  rollNpcCancels(st, 1, rng); // NPC students who ordered then cancelled, for day 0 and day 1
  return st;
}

// NPC students order and cancel: that is where the spare stock of pickled egg / pickled salmon /
// instant noodles comes from. Spare stock exists ONLY as cancelled orders.
function rollNpcCancels(st, upToDay, rng) {
  for (let d = st.line.rolledThrough + 1; d <= upToDay; d++) {
    for (const item of SPARE_ITEMS) {
      if (rng.chance(C.line.npcCancelChance)) {
        const n = rng.int(C.line.npcCancelQty[0], C.line.npcCancelQty[1]);
        for (let k = 0; k < n; k++) {
          st.line.orders.push({ id: `o${st.line.nextId++}`, itemId: item.id, by: 'npc', forDay: d, status: 'cancelled', price: item.price });
        }
      }
    }
    st.line.rolledThrough = d;
  }
}

// ---------------- small helpers ----------------
function mealOf(ctx) {
  if (ctx.meal) return ctx.meal;
  if (typeof ctx.minute === 'number') {
    if (ctx.minute < 600) return 'breakfast'; // before 10:00
    if (ctx.minute < 900) return 'lunch'; // before 15:00
    return 'dinner'; // after school and the evening
  }
  return undefined;
}

function invQty(inv, id) {
  if (!inv) return 0;
  if (Array.isArray(inv)) {
    let n = 0;
    for (const e of inv) {
      if (typeof e === 'string') n += e === id ? 1 : 0;
      else if (e && (e.itemId === id || e.id === id)) n += e.qty ?? 1;
    }
    return n;
  }
  return inv[id] ?? 0;
}

const sidOf = (student) => (student && (student.id ?? student.sid)) ?? 'me';

function uiOptions(item) {
  if (!item.options) return undefined;
  return item.options.map((o) => ({
    key: o.key,
    label: o.label,
    multi: !!o.multi,
    ...(o.max ? { max: o.max } : {}),
    default: o.multi ? [] : o.choices[0].value,
    choices: o.choices.map((c) => ({ value: c.value, label: c.label, priceDelta: c.priceDelta })),
  }));
}

function unitPrice(st, item, extra = 0) {
  const base = item.price + extra;
  if (item.shopId === 'crepe' && st.crepe.status === 'failed') {
    return Math.max(1, Math.round(base * (1 - C.crepe.failDiscount)));
  }
  return base;
}

// availability: hidden items are not on the menu at all, unavailable ones are shown greyed with a reason
function availability(st, item, ctx) {
  if (item.seasons && ctx.season && !item.seasons.includes(ctx.season)) {
    return { hidden: true, available: false, reason: 'ไม่มีขายในหน้านี้' };
  }
  const meal = mealOf(ctx);
  if (item.mealsAvailable && meal && !item.mealsAvailable.includes(meal)) {
    const shop = SHOP_BY_ID[item.shopId];
    const reason = item.mealReason ?? 'ไม่ขายในมื้อนี้';
    return { hidden: !!(shop && shop.menuByMeal), available: false, reason };
  }
  if (item.shopId === 'print') {
    const sheets = invQty(ctx.inventory, 'a4_sheet');
    if (sheets < 1) return { hidden: false, available: false, reason: 'ต้องซื้อกระดาษ A4 ก่อน' };
  }
  return { hidden: false, available: true };
}

function dynamicNote(st, item, student) {
  const parts = [];
  if (item.note) parts.push(item.note);
  if (item.tags && item.tags.includes('smoothie') && student && student.trait === 'intro') parts.push('ช่วยฝึกพูดให้เก่งขึ้น');
  if (item.shopId === 'fried') parts.push('ชีสฟรี');
  if (item.shopId === 'crepe') {
    const c = st.crepe;
    if (c.status === 'failed') parts.push(`ส่วนลดประจำ ${Math.round(C.crepe.failDiscount * 100)}%`);
    if (c.status === 'rich' && item.id === 'crepe.crepe' && c.freeReady) parts.push('ฟรี 1 ชิ้นสัปดาห์นี้');
  }
  return parts.join(' / ');
}

function toUiItem(st, item, ctx, student) {
  const av = availability(st, item, ctx);
  return {
    id: item.id,
    name: item.name,
    price: unitPrice(st, item),
    fill: item.fill,
    note: dynamicNote(st, item, student),
    available: av.available,
    ...(av.available ? {} : { reason: av.reason }),
    ...(item.options ? { options: uiOptions(item) } : {}),
    _hidden: av.hidden,
  };
}

function cleanItems(list) {
  return list.filter((i) => !i._hidden).map(({ _hidden, ...rest }) => rest);
}

// ---------------- listing ----------------
// mode: 'meal' | 'canteen' (the 10 shops), 'coop', 'print'
export function listShop(st, ctx = {}) {
  const { mode = 'meal', student } = ctx;
  if (mode === 'coop') {
    const list = COOP_ITEMS.map((i) => {
      const ui = toUiItem(st, i, ctx, student);
      const have = i.give && i.give[0] ? invQty(ctx.inventory, i.give[0].itemId) : 0;
      if (have > 0 && i.kind === 'stationery') ui.note = (ui.note ? ui.note + ' / ' : '') + `มีอยู่ ${have}`;
      return ui;
    });
    return [{ id: COOP_SHOP.id, name: COOP_SHOP.name, items: cleanItems(list) }];
  }
  if (mode === 'print') {
    const ui = toUiItem(st, PRINT_ITEM, ctx, student);
    const sheets = invQty(ctx.inventory, 'a4_sheet');
    ui.note = `กระดาษ A4 ที่มี ${sheets} แผ่น`;
    return [{ id: PRINT_SHOP.id, name: PRINT_SHOP.name, items: cleanItems([ui]) }];
  }
  // canteen: the 10 shops, always open
  return SHOPS.map((shop) => {
    const list = ITEMS.filter((i) => i.shopId === shop.id).map((i) => toUiItem(st, i, ctx, student));
    const out = { id: shop.id, name: shop.name, no: shop.no, items: cleanItems(list) };
    if (shop.id === 'crepe') {
      const c = st.crepe;
      out.meta = {
        crepe: {
          status: c.status,
          invested: c.invested,
          canFund: (c.status === 'none' || c.status === 'funding') && st.day >= C.crepe.minDay && c.invested < C.crepe.maxFund,
          minFund: C.crepe.minFund,
          maxFund: C.crepe.maxFund,
        },
      };
    }
    return out;
  });
}

// ---------------- options ----------------
function resolveOptions(item, picked = {}) {
  let priceDelta = 0;
  let fillDelta = 0;
  const labels = [];
  const values = {};
  for (const o of item.options ?? []) {
    let want = picked[o.key];
    if (o.multi) {
      if (want === undefined || want === null) want = [];
      if (!Array.isArray(want)) want = [want];
      if (o.max && want.length > o.max) return { ok: false, reason: `เลือก ${o.label} ได้ไม่เกิน ${o.max}` };
      for (const v of want) {
        const c = o.choices.find((x) => x.value === v);
        if (!c) return { ok: false, reason: 'ตัวเลือกไม่ถูกต้อง' };
        priceDelta += c.priceDelta;
        fillDelta += c.fillDelta ?? 0;
        labels.push(c.label);
      }
      values[o.key] = want;
    } else {
      if (want === undefined || want === null) want = o.choices[0].value;
      const c = o.choices.find((x) => x.value === want);
      if (!c) return { ok: false, reason: 'ตัวเลือกไม่ถูกต้อง' };
      priceDelta += c.priceDelta;
      fillDelta += c.fillDelta ?? 0;
      values[o.key] = want;
      if (c.priceDelta !== 0 || c.fillDelta) labels.push(c.label);
    }
  }
  return { ok: true, priceDelta, fillDelta, labels, values };
}

// ---------------- buying ----------------
// req: { shopId, itemId, qty?, options? }; ctx: { meal?, minute?, season?, day?, inventory? }
export function buy(st, student, req, ctx = {}, rng) {
  const fail = (reason) => ({ ok: false, reason, price: 0, fx: {}, notes: [] });
  const item = ITEM_BY_ID[req.itemId];
  if (!item || item.shopId !== req.shopId || item.shopId === 'line') return fail('ไม่มีสินค้านี้');
  const qty = req.qty === undefined ? 1 : Math.floor(req.qty);
  const maxQty = item.maxQty ?? C.maxQty;
  if (!(qty >= 1)) return fail('จำนวนไม่ถูกต้อง');
  if (qty > maxQty) return fail(`ซื้อได้ครั้งละไม่เกิน ${maxQty}`);

  const av = availability(st, item, ctx);
  if (!av.available) return fail(av.reason);

  const opts = resolveOptions(item, req.options);
  if (!opts.ok) return fail(opts.reason);

  const notes = [];
  const unit = unitPrice(st, item, opts.priceDelta);
  let price = unit * qty;
  let fullness = (item.fx.fullness + opts.fillDelta) * qty;
  let energy = item.fx.energy * qty;
  let health = item.fx.health * qty;
  let stress = item.fx.stress * qty;
  let speaking = 0;
  let peer = 0;
  const giveItems = [];
  const takeItems = [];

  // --- special rules ---
  if (item.shopId === 'smoothie' && item.tags.includes('smoothie') && student && student.trait === 'intro') {
    speaking = C.smoothie.speakingIntro * qty;
    notes.push('ดื่มแล้วกล้าพูดมากขึ้น');
  }
  if (item.shopId === 'fried' && opts.values.cheese === 'cheese') {
    fullness += C.fried.cheeseFill * qty;
    health += C.fried.cheeseHealth * qty;
    stress += C.fried.cheeseStress * qty;
    notes.push('ใส่ชีสฟรี อิ่มขึ้น ถือว่าเลือกดี');
  }
  if (item.shopId === 'crepe') {
    const c = st.crepe;
    if (c.status === 'failed') notes.push(`ได้ส่วนลดประจำ ${Math.round(C.crepe.failDiscount * 100)}%`);
    if (c.status === 'rich') {
      if (item.id === 'crepe.crepe' && c.freeReady) {
        price -= unit * C.crepe.freePerWeek;
        c.freeReady = false;
        notes.push('เครปฟรีประจำสัปดาห์');
      }
      peer = C.crepe.richPeerPerBuy;
      notes.push('เพื่อนได้กินเครปฟรีด้วย เพื่อนชอบ');
    }
  }
  if (item.shopId === 'tamsang2') notes.push('ร้านธรรมดา ไม่มีเมนูเด็ด');
  if (item.id === 'tamsang.mama') notes.push('มาม่าไม่ค่อยดีต่อสุขภาพ');

  if (item.shopId === 'print') {
    const sheets = invQty(ctx.inventory, 'a4_sheet');
    if (sheets < qty) return fail(sheets < 1 ? 'ต้องซื้อกระดาษ A4 ก่อน' : 'กระดาษ A4 ไม่พอ');
    takeItems.push({ itemId: 'a4_sheet', qty });
  }
  for (const g of item.give ?? []) giveItems.push({ itemId: g.itemId, qty: g.qty * qty });

  if (student && typeof student.money === 'number' && student.money < price) {
    return { ok: false, reason: 'เงินไม่พอ', price, fx: {}, notes: [] };
  }

  const fx = { fullness, energy, health, stress };
  if (speaking) fx.speaking = speaking;
  if (peer) fx.peer = peer;
  const res = { ok: true, price, fx, notes };
  if (giveItems.length) res.giveItems = giveItems;
  if (takeItems.length) res.takeItems = takeItems;
  return res;
}

// ---------------- the LINE shop ----------------
function lineEligibleRoom(loc) {
  const m = String(loc ?? '').match(/\d{3}/);
  return !!m && C.line.eligibleRooms.includes(m[0]);
}

function spareOrders(st, itemId, day) {
  return st.line.orders.filter((o) => o.status === 'cancelled' && !o.taken && o.itemId === itemId && o.forDay === day);
}

// One entry per LINE item. `orderable` = can be ordered ahead; `walkUp` = can be bought on the spot right now;
// `ordered` = how many orders this student has for ctx.day; `available` = can be eaten right now.
export function lineMenu(st, ctx = {}) {
  const sid = ctx.studentId ?? 'me';
  const eligible = ctx.loc === undefined ? true : lineEligibleRoom(ctx.loc);
  return LINE_ITEMS.map((i) => {
    const spare = i.spare ? spareOrders(st, i.id, ctx.day).length : 0;
    const ordered = st.line.orders.filter((o) => o.status === 'placed' && o.by === sid && o.itemId === i.id && o.forDay === ctx.day).length;
    const walkUp = i.spare && spare > 0 && !ctx.afternoonScience && eligible;
    const available = eligible && (ordered > 0 || walkUp);
    let reason;
    if (!available) {
      if (!eligible) reason = 'ห้องเรียนนี้ไม่ติดห้อง 222';
      else if (i.spare && ctx.afternoonScience && ordered === 0) reason = 'คาบวิทย์บ่าย ของเหลือหมดแล้ว';
      else reason = 'ต้องสั่งล่วงหน้า';
    }
    return { id: i.id, name: i.name, price: i.price, fill: i.fill, note: i.note ?? '', orderable: true, spare, walkUp: !!walkUp, ordered, available, ...(available ? {} : { reason }) };
  });
}

export function placeOrder(st, student, itemId, forDay) {
  const item = LINE_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'ไม่มีสินค้านี้' };
  if (!Number.isInteger(forDay)) return { ok: false, reason: 'วันที่ไม่ถูกต้อง' };
  if (forDay < st.day + C.line.minAheadDays) return { ok: false, reason: 'ต้องสั่งล่วงหน้าอย่างน้อย 1 วัน' };
  if (forDay > st.day + C.line.maxAheadDays) return { ok: false, reason: 'สั่งล่วงหน้าได้ไม่เกิน 14 วัน' };
  const sid = sidOf(student);
  const same = st.line.orders.filter((o) => o.by === sid && o.forDay === forDay && o.status === 'placed').length;
  if (same >= C.line.maxOrdersPerDay) return { ok: false, reason: 'สั่งได้ไม่เกิน 3 อย่างต่อวัน' };
  const order = { id: `o${st.line.nextId++}`, itemId, by: sid, forDay, status: 'placed', price: item.price };
  st.line.orders.push(order);
  return { ok: true, ...order, itemName: item.name };
}

// the order becomes cancelled; for pickled egg / pickled salmon / instant noodles it turns into spare stock for that day
export function cancelOrder(st, orderId) {
  const o = st.line.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, reason: 'ไม่พบออเดอร์' };
  if (o.status !== 'placed') return { ok: false, reason: 'ยกเลิกไม่ได้แล้ว' };
  o.status = 'cancelled';
  return { ok: true, id: o.id, spare: LINE_SPARE_IDS.includes(o.itemId) };
}

// ctx: { day, period, loc, teacherKey, afternoonScience }
export function lineConsume(st, student, req, ctx = {}, rng) {
  const fail = (reason) => ({ ok: false, reason, price: 0, fx: {}, caught: false });
  if (!lineEligibleRoom(ctx.loc)) return fail('ห้องเรียนนี้ไม่ติดห้อง 222 สั่งไม่ได้');
  const sid = sidOf(student);

  let order = null;
  if (req.orderId) {
    order = st.line.orders.find((o) => o.id === req.orderId);
    if (!order || order.by !== sid) return fail('ไม่พบออเดอร์');
    if (order.status !== 'placed') return fail('ออเดอร์นี้ใช้ไม่ได้แล้ว');
    if (order.forDay !== ctx.day) return fail('ออเดอร์นี้ไม่ใช่ของวันนี้');
  } else {
    order = st.line.orders.find((o) => o.status === 'placed' && o.by === sid && o.itemId === req.itemId && o.forDay === ctx.day) ?? null;
  }
  const itemId = order ? order.itemId : req.itemId;
  const item = LINE_ITEMS.find((i) => i.id === itemId);
  if (!item) return fail('ไม่มีสินค้านี้');
  if (req.itemId && order && req.itemId !== order.itemId) return fail('ออเดอร์ไม่ตรงกับสินค้า');

  let spareOrder = null;
  if (!order) {
    // walk-up: only cancelled-order spare stock of pickled egg / pickled salmon / instant noodles
    if (!item.spare) return fail('ของอย่างนี้ต้องสั่งล่วงหน้า');
    if (ctx.afternoonScience) return fail('คาบวิทย์ช่วงบ่าย ของเหลือหมดแล้ว');
    spareOrder = spareOrders(st, item.id, ctx.day)[0];
    if (!spareOrder) return fail('ของหมด ไม่มีใครยกเลิกออเดอร์');
  }

  if (student && typeof student.money === 'number' && student.money < item.price) {
    return { ok: false, reason: 'เงินไม่พอ', price: item.price, fx: {}, caught: false };
  }

  if (order) order.status = 'eaten';
  else spareOrder.taken = true;

  const caught = rng.chance(LINE_CAUGHT_CHANCE);
  const fx = { ...item.fx };
  const res = {
    ok: true,
    price: item.price,
    fx,
    caught,
    bought: order ? 'order' : 'walkup',
    notes: [order ? 'รับของที่สั่งไว้' : 'ซื้อจากของที่มีคนยกเลิก'],
  };
  if (item.buff) res.buff = { ...item.buff };
  if (caught) {
    res.caughtFx = { ...C.line.caughtPenalty };
    res.notes.push('ครูจับได้ว่ากินในคาบ');
  }
  return res;
}

// ---------------- crepe subplot ----------------
// The player chips in; the engine takes `amount` from student.money. After weeksToResolve weekly ticks the shop
// becomes rich with 85% (money back, free crepe a week, teachers and friends like you more) or not (money lost,
// permanent discount instead).
export function crepeFund(st, student, amount) {
  const c = st.crepe;
  if (c.status === 'rich') return { ok: false, reason: 'ร้านเครปรวยแล้ว ไม่ต้องช่วยแล้ว' };
  if (c.status === 'failed') return { ok: false, reason: 'ร้านเครปเลิกรับเงินช่วยแล้ว' };
  if (st.day < C.crepe.minDay) return { ok: false, reason: 'ยังไม่สนิทกับร้านพอ ไว้แวะมาซื้อบ่อยๆก่อน' };
  if (!Number.isFinite(amount) || amount < C.crepe.minFund) return { ok: false, reason: `ช่วยขั้นต่ำ ${C.crepe.minFund} บาท` };
  amount = Math.floor(amount);
  if (c.invested + amount > C.crepe.maxFund) return { ok: false, reason: `ร้านรับเงินช่วยรวมไม่เกิน ${C.crepe.maxFund} บาท` };
  if (student && typeof student.money === 'number' && student.money < amount) return { ok: false, reason: 'เงินไม่พอ' };
  if (c.status === 'none') {
    c.status = 'funding';
    c.startDay = st.day;
    c.lastTick = st.day;
    c.weeks = 0;
  }
  c.invested += amount;
  return { ok: true, amount, invested: c.invested, notes: ['เจ้าของร้านเครปขอบคุณมาก จะพยายามทำให้ร้านรอด'] };
}

// ---------------- nightly ----------------
// Call once at the end of every day with the day that just ended. Returns events the engine should apply:
//   { type:'crepeRich', refund, fx:{teacherTrust,peer}, text } | { type:'crepeFailed', text } | { type:'crepeTick', week }
export function nightly(st, day, rng) {
  const events = [];
  st.day = day + 1;
  rollNpcCancels(st, st.day, rng); // spare stock resets: new day = new cancelled orders only

  // old orders: not picked up -> expired, then forgotten
  for (const o of st.line.orders) if (o.status === 'placed' && o.forDay < st.day) o.status = 'expired';
  st.line.orders = st.line.orders.filter((o) => o.forDay >= st.day - 3);

  const c = st.crepe;
  while ((c.status === 'funding' || c.status === 'rich') && day - c.lastTick >= 7) {
    c.lastTick += 7;
    if (c.status === 'rich') {
      c.freeReady = true; // weekly free crepe
      continue;
    }
    c.weeks += 1;
    if (c.weeks < C.crepe.weeksToResolve) {
      events.push({ type: 'crepeTick', week: c.weeks, text: 'ร้านเครปมีลูกค้าเพิ่มขึ้นนิดหน่อย' });
      continue;
    }
    if (rng.chance(C.crepe.richChance)) {
      c.status = 'rich';
      c.freeReady = true;
      events.push({
        type: 'crepeRich',
        refund: c.invested,
        fx: { teacherTrust: C.crepe.richTeacherTrust, peer: C.crepe.richPeerOnBecome },
        text: 'ร้านเครปรวยแล้ว! ได้เงินที่ช่วยคืน ครูเอ็นดู เพื่อนๆได้กินเครปฟรี',
      });
    } else {
      c.status = 'failed';
      events.push({ type: 'crepeFailed', text: 'ร้านเครปไม่รอด เงินที่ช่วยไปหายหมด แต่ซื้อที่ร้านได้ส่วนลดตลอด' });
    }
  }
  return events;
}

// ---------------- co-op and print ----------------
export function coopItems() {
  return COOP_ITEMS.map((i) => ({
    id: i.id,
    name: i.name,
    price: i.price,
    kind: i.kind,
    fill: i.fill,
    give: i.give ? i.give.map((g) => ({ ...g })) : [],
    fx: { ...i.fx },
  }));
}

// 2 baht per page (cj). Paper must be bought first: use printCheck to include that rule.
export function printCost(pages) {
  return Math.max(0, Math.floor(pages)) * C.print.perPage;
}

export function printCheck(pages, inventory) {
  const cost = printCost(pages);
  const sheets = invQty(inventory, 'a4_sheet');
  if (sheets < 1) return { ok: false, cost, reason: 'ต้องซื้อกระดาษ A4 ก่อน' };
  if (sheets < pages) return { ok: false, cost, reason: 'กระดาษ A4 ไม่พอ' };
  return { ok: true, cost };
}

export { LINE_CAUGHT_CHANCE, LINE_SHOP };
