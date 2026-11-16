// Checks for the shops. Run: node test/shops.test.js (exit code 1 on failure)
import { Rng } from '../src/rng.js';
import { LINE_CAUGHT_CHANCE, SHOP_CONFIG, ITEMS, LINE_ITEMS } from '../src/data/shops.js';
import {
  createShopState,
  listShop,
  buy,
  lineMenu,
  placeOrder,
  cancelOrder,
  lineConsume,
  crepeFund,
  nightly,
  coopItems,
  printCost,
  printCheck,
  COOP_ITEM_IDS,
} from '../src/economy/shops.js';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failed += 1;
}

const extro = { id: 's1', trait: 'extro', money: 1000 };
const intro = { id: 's2', trait: 'intro', money: 1000 };
const lunch = { meal: 'lunch', season: 'hot', day: 20 };
const dinner = { meal: 'dinner', season: 'hot', day: 20 };

function price(st, student, shopId, key, ctx = lunch, options, qty) {
  const r = buy(st, student, { shopId, itemId: `${shopId}.${key}`, options, qty }, ctx, new Rng(1));
  return r.ok ? r.price : `FAIL(${r.reason})`;
}

const st = createShopState(new Rng(5));

// ---------- prices from DESIGN.md ----------
check('chicken rice 30, pork leg 50, special 60', price(st, extro, 'chicken', 'plain') === 30 && price(st, extro, 'chicken', 'porkleg') === 50 && price(st, extro, 'chicken', 'special') === 60);
check('banana 20, fruit 20, ice cream cup 25', price(st, extro, 'fruit', 'banana') === 20 && price(st, extro, 'fruit', 'fruit') === 20 && price(st, extro, 'fruit', 'icecup') === 25);
check('ice cream cone 15 or 20', price(st, extro, 'fruit', 'cone', lunch, { size: 'small' }) === 15 && price(st, extro, 'fruit', 'cone', lunch, { size: 'big' }) === 20);
check('mochi 49, with ice cream 59 (evening)', price(st, extro, 'fruit', 'mochi', dinner) === 49 && price(st, extro, 'fruit', 'mochi', dinner, { icecream: 'icecream' }) === 59);
check('mochi is evening only', !buy(st, extro, { shopId: 'fruit', itemId: 'fruit.mochi' }, lunch, new Rng(1)).ok);
check('curry rice 30, +5 per extra dish', price(st, extro, 'curry', 'rice') === 30 && price(st, extro, 'curry', 'rice', lunch, { extras: ['d0', 'd1'] }) === 40);
check('khao soi and khanom jeen 30', price(st, extro, 'curry', 'khaosoi') === 30 && price(st, extro, 'curry', 'khanomjeen') === 30);
check('fat chicken skewer 10, skewers 10-15', price(st, extro, 'fried', 'fatchicken') === 10 && price(st, extro, 'fried', 'nugget') === 10 && price(st, extro, 'fried', 'chickenstick') === 15);
check('crepe 5 per piece, batter 10, chao kuay 15', price(st, extro, 'crepe', 'crepe') === 5 && price(st, extro, 'crepe', 'batter') === 10 && price(st, extro, 'crepe', 'chaokuay') === 15);
check('qty multiplies the price (3 crepes = 15)', price(st, extro, 'crepe', 'crepe', lunch, undefined, 3) === 15);
check('extra cheese +5 at the steak stall', price(st, extro, 'yam', 'steakchicken') === 40 && price(st, extro, 'yam', 'steakchicken', lunch, { extraCheese: '1' }) === 45);

// smoothie steps
const smoothies = ITEMS.filter((i) => i.shopId === 'smoothie' && i.tags.includes('smoothie'));
check('smoothies only at 25/30/35/40/45', smoothies.every((i) => SHOP_CONFIG.smoothie.steps.includes(i.price)) && new Set(smoothies.map((i) => i.price)).size === 5);
const sm = smoothies[0];
check('blended or not costs the same', price(st, extro, 'smoothie', sm.id.split('.')[1], lunch, { style: 'blend' }) === price(st, extro, 'smoothie', sm.id.split('.')[1], lunch, { style: 'plain' }));

// ---------- seasons: warm drinks ----------
const names = (list, shopId) => list.find((s) => s.id === shopId).items.map((i) => i.name);
const hotMenu = listShop(st, { mode: 'meal', meal: 'lunch', season: 'hot', student: extro });
const coolMenu = listShop(st, { mode: 'meal', meal: 'lunch', season: 'cool', student: extro });
const coldMenu = listShop(st, { mode: 'meal', meal: 'lunch', season: 'cold', student: extro });
check('warm drinks (15) only in the cold season', !names(hotMenu, 'smoothie').includes('โกโก้ร้อน') && !names(coolMenu, 'smoothie').includes('โกโก้ร้อน') && names(coldMenu, 'smoothie').includes('โกโก้ร้อน'));
check('warm drink costs 15 in cold, refused in hot', price(st, extro, 'smoothie', 'hotcocoa', { meal: 'lunch', season: 'cold' }) === 15 && !buy(st, extro, { shopId: 'smoothie', itemId: 'smoothie.hotcocoa' }, lunch, new Rng(1)).ok);
check('listShop gives 10 canteen shops', hotMenu.length === 10);
const item0 = hotMenu[0].items[0];
check('ui item shape (id,name,price,fill,note,available)', ['id', 'name', 'price', 'fill', 'note', 'available'].every((k) => k in item0) && item0.options && item0.options[0].choices[0].priceDelta === 0);

// ---------- smoothie energy + introvert speaking ----------
const k = sm.id.split('.')[1];
const rIntro = buy(st, intro, { shopId: 'smoothie', itemId: sm.id }, lunch, new Rng(1));
const rExtro = buy(st, extro, { shopId: 'smoothie', itemId: sm.id }, lunch, new Rng(1));
check('smoothie gives energy', rExtro.fx.energy >= 8);
check('introvert gets a speaking bonus, extrovert does not', rIntro.fx.speaking > 0 && !rExtro.fx.speaking, k);

// ---------- fried: free cheese ----------
const f0 = buy(st, extro, { shopId: 'fried', itemId: 'fried.nugget', options: { cheese: 'none' } }, lunch, new Rng(1));
const f1 = buy(st, extro, { shopId: 'fried', itemId: 'fried.nugget', options: { cheese: 'cheese' } }, lunch, new Rng(1));
check('cheese is free', f0.price === f1.price && f1.price === 10);
check('cheese fills more and is a good choice', f1.fx.fullness > f0.fx.fullness && f1.fx.health > f0.fx.health);

// ---------- made-to-order shops ----------
const t1 = ITEMS.filter((i) => i.shopId === 'tamsang');
const t2 = ITEMS.filter((i) => i.shopId === 'tamsang2');
const plainIds = t2.map((i) => i.id.split('.')[1]);
check('shop 10 is +10 baht and less filling for the same plain dishes', plainIds.every((key) => { const a = ITEMS.find((i) => i.id === `tamsang.${key}`); const b = ITEMS.find((i) => i.id === `tamsang2.${key}`); return b.price === a.price + 10 && b.fill < a.fill; }));
check('shop 10 has no noodles and no signature dish; shop 6 has both', !t2.some((i) => i.tags.includes('instant') || i.tags.includes('signature')) && t1.some((i) => i.tags.includes('instant')) && t1.some((i) => i.tags.includes('signature')));
check('instant noodle pack red/white/black', ITEMS.find((i) => i.id === 'tamsang.mama').options[0].choices.map((c) => c.value).join() === 'red,white,black');

// ---------- yam / steak / malatang menu by meal ----------
const yamNames = (meal) => listShop(st, { mode: 'meal', meal, season: 'hot' }).find((s) => s.id === 'yam').items.map((i) => i.id);
check('shop 8 menu changes by meal', yamNames('breakfast').join() === 'yam.sticky' && yamNames('lunch').includes('yam.yam') && yamNames('lunch').includes('yam.steakfish') && yamNames('dinner').join() === 'yam.malatang,yam.suki');
check('malatang builder: skewers, noodle types, broth black/malatang/ramen', (() => { const m = ITEMS.find((i) => i.id === 'yam.malatang'); return m.options.find((o) => o.key === 'broth').choices.map((c) => c.value).join() === 'black,malatang,ramen' && m.options.find((o) => o.key === 'noodle').choices.length >= 4 && m.options.find((o) => o.key === 'skewers').multi; })());
const mala = buy(st, extro, { shopId: 'yam', itemId: 'yam.malatang', options: { skewers: ['meatball', 'tofu', 'quail'], noodle: 'glass', broth: 'ramen' } }, dinner, new Rng(1));
check('malatang price = bowl + 5 per skewer', mala.ok && mala.price === 20 + 3 * 5, String(mala.price));
check('too many skewers refused', !buy(st, extro, { shopId: 'yam', itemId: 'yam.malatang', options: { skewers: Array(9).fill('tofu') } }, dinner, new Rng(1)).ok);
check('yam uses real instant noodle brands', ['mama', 'nissin', 'yumyum'].every((b) => ITEMS.find((i) => i.id === 'yam.yam').options[0].choices.some((c) => c.value === b)));

// ---------- buy() does not touch money ----------
const rich = { id: 'x', trait: 'intro', money: 500 };
buy(st, rich, { shopId: 'chicken', itemId: 'chicken.plain' }, lunch, new Rng(1));
check('buy does not change student.money', rich.money === 500);
check('not enough money is refused', !buy(st, { id: 'p', money: 5 }, { shopId: 'chicken', itemId: 'chicken.plain' }, lunch, new Rng(1)).ok);

// ---------- crepe subplot: 85% ----------
function crepeRun(seed) {
  const rng = new Rng(seed);
  const s = createShopState(rng);
  s.day = SHOP_CONFIG.crepe.minDay;
  const f = crepeFund(s, extro, 100);
  if (!f.ok) throw new Error(f.reason);
  let rich2 = null;
  let refund = 0;
  let evs = [];
  for (let d = s.day; d < s.day + 60 && rich2 === null; d++) {
    evs = nightly(s, d, rng);
    for (const e of evs) {
      if (e.type === 'crepeRich') { rich2 = true; refund = e.refund; }
      if (e.type === 'crepeFailed') rich2 = false;
    }
  }
  return { s, rich: rich2, refund };
}
let nRich = 0;
const N = 3000;
for (let i = 1; i <= N; i++) if (crepeRun(i).rich) nRich++;
check('crepe becomes rich about 85% of the time', Math.abs(nRich / N - 0.85) < 0.025, (nRich / N).toFixed(3));
check('crepe cannot be funded too early', !crepeFund(createShopState(new Rng(1)), extro, 100).ok);
let richCase = null;
let failCase = null;
for (let i = 1; i < 200 && !(richCase && failCase); i++) {
  const r = crepeRun(i);
  if (r.rich && !richCase) richCase = r;
  if (r.rich === false && !failCase) failCase = r;
}
check('rich crepe: money back', richCase.refund === 100);
const rs = richCase.s;
const free1 = buy(rs, extro, { shopId: 'crepe', itemId: 'crepe.crepe', qty: 2 }, lunch, new Rng(1));
const free2 = buy(rs, extro, { shopId: 'crepe', itemId: 'crepe.crepe', qty: 2 }, lunch, new Rng(1));
check('rich crepe: one free crepe a week, friends like it', free1.price === 5 && free2.price === 10 && free1.fx.peer > 0);
nightly(rs, rs.day + 7, new Rng(2));
check('free crepe comes back after a week', buy(rs, extro, { shopId: 'crepe', itemId: 'crepe.crepe' }, lunch, new Rng(1)).price === 0);
const fs = failCase.s;
check('failed crepe: permanent discount', buy(fs, extro, { shopId: 'crepe', itemId: 'crepe.chaokuay' }, lunch, new Rng(1)).price < 15);

// ---------- LINE shop ----------
const salmon = LINE_ITEMS.find((i) => i.id === 'line.salmonrice');
check('salmon rice 99, pickles 15-25', salmon.price === 99 && LINE_ITEMS.filter((i) => i.tags.includes('pickled') && !i.spare && i.id !== 'line.salmonrice').every((i) => i.price >= 15 && i.price <= 25));
check('Kit Kat 15', LINE_ITEMS.find((i) => i.id === 'line.kitkat').price === 15);
check('LINE_CAUGHT_CHANCE is 0.1', LINE_CAUGHT_CHANCE === 0.1);

const ls = createShopState(new Rng(11));
ls.line.orders = ls.line.orders.filter((o) => o.by !== 'npc'); // no NPC cancels for this test
const me = { id: 'me1', money: 1000 };
const bad = placeOrder(ls, me, 'line.salmonrice', ls.day);
check('must order ahead: same day refused', !bad.ok);
const o1 = placeOrder(ls, me, 'line.salmonrice', ls.day + 2);
check('order ahead accepted', o1.ok && o1.status === 'placed' && o1.forDay === ls.day + 2);
const D = ls.day + 2;
const inRoom = { day: D, period: 5, loc: '221', teacherKey: 'm1-A', afternoonScience: false };
check('cannot eat an order before its day', !lineConsume(ls, me, { orderId: o1.id }, { ...inRoom, day: ls.day + 1 }, new Rng(1)).ok);
check('cannot eat it in a room not next to 222', !lineConsume(ls, me, { orderId: o1.id }, { ...inRoom, loc: '218' }, new Rng(1)).ok);
check('walk-up of salmon rice never works (not spare-able)', !lineConsume(ls, { id: 'other', money: 1000 }, { itemId: 'line.salmonrice' }, inRoom, new Rng(1)).ok);
const eat = lineConsume(ls, me, { orderId: o1.id }, { ...inRoom, loc: '223' }, new Rng(1));
check('ordered item eaten in room 223', eat.ok && eat.price === 99 && eat.fx.fullness > 0 && !!eat.buff);
check('an order is used only once', !lineConsume(ls, me, { orderId: o1.id }, inRoom, new Rng(1)).ok);

// spare stock only from cancelled orders
const walk = (student, itemId, ctx) => lineConsume(ls, student, { itemId }, ctx, new Rng(3));
check('no spare stock without a cancelled order', !walk(me, 'line.pickledegg', inRoom).ok);
const o2 = placeOrder(ls, { id: 'friend', money: 10 }, 'line.pickledegg', D);
check('spare stock is not there while the order stands', !walk(me, 'line.pickledegg', inRoom).ok);
check('cancel works', cancelOrder(ls, o2.id).ok && !cancelOrder(ls, o2.id).ok);
check('lineMenu shows walk-up for the cancelled egg', lineMenu(ls, { ...inRoom, studentId: 'me1' }).find((i) => i.id === 'line.pickledegg').walkUp === true);
check('no spare in afternoon science periods', !walk(me, 'line.pickledegg', { ...inRoom, afternoonScience: true }).ok);
check('no spare in a room not next to 222', !walk(me, 'line.pickledegg', { ...inRoom, loc: '232' }).ok);
const w = walk(me, 'line.pickledegg', inRoom);
check('spare egg bought on the spot after a cancel', w.ok && w.bought === 'walkup' && w.price === 20);
check('the spare stock is used up', !walk(me, 'line.pickledegg', inRoom).ok);
const o3 = placeOrder(ls, { id: 'friend', money: 10 }, 'line.hokkaidomilk', D);
cancelOrder(ls, o3.id);
check('cancelled non-spare item gives no walk-up (hokkaido milk)', !walk(me, 'line.hokkaidomilk', inRoom).ok);
const o4 = placeOrder(ls, { id: 'friend', money: 10 }, 'line.instantnoodle', D + 1);
cancelOrder(ls, o4.id);
check('spare is per day: cancelled for D+1 is not there on D', !walk(me, 'line.instantnoodle', inRoom).ok && walk(me, 'line.instantnoodle', { ...inRoom, day: D + 1 }).ok);
// spare stock resets every night
const ls2 = createShopState(new Rng(3));
let someSpare = false;
for (let d = 0; d < 30; d++) { nightly(ls2, d, new Rng(100 + d)); if (lineMenu(ls2, { day: ls2.day, loc: '221' }).some((i) => i.spare > 0)) someSpare = true; }
check('NPC cancels give spare stock on some days (from orders), not every day', someSpare);
check('all spare stock is backed by cancelled orders', LINE_ITEMS.filter((i) => i.spare).every((i) => lineMenu(ls2, { day: ls2.day, loc: '221' }).find((m) => m.id === i.id).spare === ls2.line.orders.filter((o) => o.status === 'cancelled' && !o.taken && o.itemId === i.id && o.forDay === ls2.day).length));

// 10% caught rate
let caught = 0;
const T = 20000;
const rngC = new Rng(77);
for (let i = 0; i < T; i++) {
  const s = createShopState(rngC);
  const pl = { id: 'p' + i, money: 500 };
  const o = placeOrder(s, pl, 'line.kitkat', s.day + 1);
  const r = lineConsume(s, pl, { orderId: o.id }, { day: s.day + 1, period: 3, loc: '221', afternoonScience: false }, rngC);
  if (r.caught) caught++;
}
check('LINE shop: caught about 10% of the time', Math.abs(caught / T - 0.1) < 0.01, (caught / T).toFixed(4));

// ---------- co-op and print ----------
const coop = listShop(st, { mode: 'coop', inventory: {} })[0].items;
check('co-op sells the stationery list', ['กระดาษ A4', 'กระดาษปอนด์ A3', 'กระดาษสี', 'ปืนกาว', 'ชุดลูกเสือ', 'ปากกา'].every((n) => coop.some((i) => i.name.includes(n))));
check('co-op also sells 7-Eleven style food', coop.filter((i) => i.fill > 0).length >= 6);
const a4 = buy(st, extro, { shopId: 'coop', itemId: 'coop.a4' }, {}, new Rng(1));
check('A4 pack gives 100 sheets in the inventory', a4.ok && a4.giveItems[0].itemId === 'a4_sheet' && a4.giveItems[0].qty === 100);
check('coopItems gives items with give lists; all inventory ids known', coopItems().every((i) => i.kind) && coopItems().flatMap((i) => i.give.map((g) => g.itemId)).every((id) => COOP_ITEM_IDS.includes(id)));
check('print: 2 baht per page', printCost(10) === 20 && printCost(1) === 2 && printCost(0) === 0);
check('print: paper must be bought first', !printCheck(3, {}).ok && printCheck(3, { a4_sheet: 5 }).ok && !printCheck(6, { a4_sheet: 5 }).ok);
check('print shop shows unavailable without paper', listShop(st, { mode: 'print', inventory: {} })[0].items[0].available === false && listShop(st, { mode: 'print', inventory: { a4_sheet: 10 } })[0].items[0].available === true);
check('buy print without paper refused', !buy(st, extro, { shopId: 'print', itemId: 'print.page', qty: 3 }, { inventory: {} }, new Rng(1)).ok);
const pr = buy(st, extro, { shopId: 'print', itemId: 'print.page', qty: 3 }, { inventory: { a4_sheet: 100 } }, new Rng(1));
check('buy print: 6 baht, uses 3 sheets, gives 3 print pages', pr.ok && pr.price === 6 && pr.takeItems[0].qty === 3 && pr.giveItems[0].itemId === 'print_page' && pr.giveItems[0].qty === 3);

// ---------- JSON state and determinism ----------
const js = JSON.stringify(ls);
check('state is plain JSON', JSON.stringify(JSON.parse(js)) === js);
function script(seed) {
  const rng = new Rng(seed);
  const s = createShopState(rng);
  const log = [];
  const st1 = { id: 'd', trait: 'intro', money: 999 };
  for (let d = 0; d < 40; d++) {
    log.push(buy(s, st1, { shopId: 'smoothie', itemId: 'smoothie.mango' }, { meal: 'lunch', season: 'cold', day: d }, rng));
    if (d === 15) log.push(crepeFund(s, st1, 100));
    if (d % 5 === 0) log.push(placeOrder(s, st1, 'line.pickledegg', d + 2));
    log.push(lineConsume(s, st1, { itemId: 'line.pickledegg' }, { day: d, loc: '223' }, rng));
    log.push(nightly(s, d, rng));
  }
  return JSON.stringify([s, log]);
}
check('deterministic with the same seed', script(9) === script(9) && script(9) !== script(10));

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall shop checks passed');
process.exit(failed ? 1 : 0);
