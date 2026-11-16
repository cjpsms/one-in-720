// Shop data for "1 ใน 720": 10 canteen shops, the LINE shop, the co-op and the print room.
// Every number lives in SHOP_CONFIG (or LINE_CAUGHT_CHANCE). "cj" = given by cj in DESIGN.md,
// PLACEHOLDER = my guess, meant to be tuned. Pure data, no logic, no randomness.

// cj (round 16): each LINE-shop purchase in class has a 10% chance of being caught
export const LINE_CAUGHT_CHANCE = 0.1;

export const SHOP_CONFIG = {
  maxQty: 10, // PLACEHOLDER: most pieces of one item in one purchase
  energyPerFill: 0.1, // PLACEHOLDER: a meal gives energy = fill x this (unless the item sets its own)

  // 1. smoothie / drinks
  smoothie: {
    steps: [25, 30, 35, 40, 45], // cj: price 25-45 in steps of 5, blended or not costs the same
    energy: 8, // PLACEHOLDER: "gives energy" (cj), the size of it is a guess
    fill: 6, // PLACEHOLDER
    speakingIntro: 1, // PLACEHOLDER: speaking-skill points for an introvert (cj: introverts only)
    warmPrice: 15, // cj: warm drinks 15 in the cold season
    warmFill: 5, // PLACEHOLDER
    warmStress: -2, // PLACEHOLDER
  },

  // 2. fruit and ice cream
  fruit: {
    fruit: 20, // cj
    cup: 25, // cj ice cream cup
    cone: 15, // cj cone 15 (or 20)
    coneBig: 20, // cj
    banana: 20, // cj per piece
    mochi: 49, // cj, evening only
    mochiWithIce: 59, // cj (49 + 10)
  },

  // 3. chicken rice
  chicken: { plain: 30, crispy: 35, spicy: 35, porkLeg: 50, special: 60 }, // cj: 30+, pork leg 50, special 60 (crispy/spicy 35 is PLACEHOLDER)

  // 4. curry rice
  curry: { base: 30, extraDish: 5, soy: 30, khanomjeen: 30, extraDishFill: 6 }, // cj: from 30, +5 per extra dish; khao soi / khanom jeen 30

  // 5. fried food
  fried: {
    skewerLow: 10, // cj: skewers 10-15
    skewerHigh: 15, // cj
    fatChicken: 10, // cj: the "ไก่อ้วน" skewer is 10, two fill you up
    fatChickenFill: 18, // PLACEHOLDER: two give about a full meal (36)
    skewerFill: 9, // PLACEHOLDER
    cheeseFill: 4, // PLACEHOLDER: free cheese fills you more (cj)
    cheeseHealth: 1, // PLACEHOLDER: and counts as a good choice (cj)
    cheeseStress: -1, // PLACEHOLDER
  },

  // 6 + 10. made-to-order shops (same name, two owners)
  tamsang: { noodlePack: 25, noodleEgg: 5 }, // PLACEHOLDER
  tamsang2: { priceDelta: 10, fillFactor: 0.8 }, // cj: 10 baht more, less filling (0.8 is a guess)

  // 7. noodles
  noodle: { bowl: 35, special: 45 }, // PLACEHOLDER: "normal, nothing special" (cj)

  // 8. yam / steak / malatang shop
  yam: {
    sticky: 10, // PLACEHOLDER base sticky rice
    stickySide: 15, // PLACEHOLDER each side
    yamBase: 35, // PLACEHOLDER
    steak: 40, // PLACEHOLDER fish / chicken / pork steak
    steakCheeseBall: 15, // PLACEHOLDER the round chicken-cheese ball "ไก่ชีส"
    extraCheese: 5, // cj: extra cheese +5
    bowl: 20, // PLACEHOLDER malatang / suki base
    skewer: 5, // PLACEHOLDER each skewer
    skewerFill: 7, // PLACEHOLDER
    maxSkewers: 8, // PLACEHOLDER
  },

  // 9. crepes + the 85% subplot
  crepe: {
    chaoKuay: 15, // cj: เฉาก๊วยนมสด 15
    piece: 5, // cj: crepe 5 per piece
    batter: 10, // cj: batter 10
    minDay: 14, // PLACEHOLDER: you must have been around a while ("if you have been around a while")
    minFund: 50, // PLACEHOLDER
    maxFund: 500, // PLACEHOLDER
    weeksToResolve: 4, // PLACEHOLDER: weekly ticks until the shop becomes rich or not
    richChance: 0.85, // cj: 85% chance of becoming rich
    failDiscount: 0.3, // PLACEHOLDER: permanent discount at the shop if it does not get rich (cj says there is one)
    richTeacherTrust: 5, // PLACEHOLDER: teachers like you more when the shop gets rich (cj)
    richPeerOnBecome: 3, // PLACEHOLDER: friends are happier
    richPeerPerBuy: 1, // PLACEHOLDER: friends get free crepes -> peer up on each purchase when rich
    freePerWeek: 1, // cj: eat free once a week when rich
  },

  // 11. the LINE shop ("สั่งของจากมิ้ว"), run from room 222
  line: {
    eligibleRooms: ['221', '223'], // cj: only when the class is in a room next to 222
    minAheadDays: 1, // everything must be ordered in advance (cj)
    maxAheadDays: 14, // PLACEHOLDER
    maxOrdersPerDay: 3, // PLACEHOLDER per student per delivery day
    npcCancelChance: 0.35, // PLACEHOLDER: per spare-able item per day, an NPC orders then cancels
    npcCancelQty: [1, 2], // PLACEHOLDER
    buffPeriods: 1, // PLACEHOLDER: the buff lasts this many periods
    caughtPenalty: { teacherTrust: -15, scoreBands: -1, teacherPressure: 20 }, // PLACEHOLDER (cj gave the idea, not the numbers)
  },

  // co-op (all prices PLACEHOLDER until cj gives them)
  coop: {},

  // print room
  print: { perPage: 2 }, // cj: 2 baht per page, paper must be bought first
};

const C = SHOP_CONFIG;
const ALL_MEALS = ['breakfast', 'lunch', 'dinner'];

// ---------------- helpers (build items in the contract shape) ----------------
const ch = (value, label, priceDelta = 0, fillDelta = 0) => ({ value, label, priceDelta, fillDelta });
const opt = (key, label, choices, extra = {}) => ({ key, label, choices, ...extra });

function it(shopId, key, name, price, fill, o = {}) {
  const energy = o.energy ?? Math.round(fill * C.energyPerFill);
  const fx = { fullness: fill, energy, health: o.health ?? 0, stress: o.stress ?? 0 };
  if (o.speaking) fx.speaking = o.speaking;
  const item = {
    id: `${shopId}.${key}`,
    shopId,
    name,
    price,
    fill,
    mealsAvailable: o.meals ?? ALL_MEALS,
    fx,
    tags: o.tags ?? [],
  };
  if (o.energy !== undefined) item.energy = o.energy;
  if (o.seasons) item.seasons = o.seasons;
  if (o.options) item.options = o.options;
  if (o.note) item.note = o.note;
  if (o.mealReason) item.mealReason = o.mealReason;
  if (o.give) item.give = o.give; // co-op: what goes into the inventory per unit
  if (o.kind) item.kind = o.kind;
  if (o.maxQty) item.maxQty = o.maxQty;
  if (o.buff) item.buff = o.buff;
  if (o.spare) item.spare = true;
  return item;
}

// ---------------- the 10 canteen shops ----------------
export const SHOPS = [
  { id: 'smoothie', no: 1, name: 'ร้านน้ำปั่น' },
  { id: 'fruit', no: 2, name: 'ร้านผลไม้และไอศกรีม' },
  { id: 'chicken', no: 3, name: 'ร้านข้าวมันไก่' },
  { id: 'curry', no: 4, name: 'ร้านข้าวแกง' },
  { id: 'fried', no: 5, name: 'ร้านของทอด' },
  { id: 'tamsang', no: 6, name: 'ร้านตามสั่ง (เจ้าซ้าย)' },
  { id: 'noodle', no: 7, name: 'ร้านก๋วยเตี๋ยว' },
  { id: 'yam', no: 8, name: 'ร้านยำ สเต็ก หม่าล่า', menuByMeal: true },
  { id: 'crepe', no: 9, name: 'ร้านเครป' },
  { id: 'tamsang2', no: 10, name: 'ร้านตามสั่ง (เจ้าขวา)' },
];

const items = [];

// 1. smoothie: each drink sits on one of the 5 price steps; blended or not is the same price (cj)
const SMOOTHIES = [
  ['orange', 'น้ำส้มปั่น', 25],
  ['banana', 'กล้วยปั่น', 25],
  ['mango', 'มะม่วงปั่น', 30],
  ['greentea', 'ชาเขียวปั่น', 30],
  ['strawberry', 'สตรอว์เบอร์รีปั่น', 35],
  ['thaitea', 'ชาไทยปั่น', 35],
  ['cocoa', 'โกโก้ปั่น', 40],
  ['avocado', 'อะโวคาโดปั่น', 40],
  ['kiwi', 'กีวีปั่นโยเกิร์ต', 45],
  ['premium', 'โกโก้เข้มข้นพรีเมียม', 45],
];
for (const [key, name, price] of SMOOTHIES) {
  items.push(
    it('smoothie', key, name, price, C.smoothie.fill, {
      energy: C.smoothie.energy,
      tags: ['drink', 'smoothie', 'energy'],
      note: 'ให้พลังงาน',
      options: [opt('style', 'แบบ', [ch('blend', 'ปั่น'), ch('plain', 'ไม่ปั่น')])],
    }),
  );
}
const WARM = [
  ['hotcocoa', 'โกโก้ร้อน'],
  ['hotmilk', 'นมสดร้อน'],
  ['hotmilo', 'ไมโลร้อน'],
  ['hotthaitea', 'ชาไทยร้อน'],
];
for (const [key, name] of WARM) {
  items.push(
    it('smoothie', key, name, C.smoothie.warmPrice, C.smoothie.warmFill, {
      energy: 3,
      stress: C.smoothie.warmStress,
      seasons: ['cold'],
      tags: ['drink', 'warm'],
      note: 'เครื่องดื่มร้อน ขายหน้าหนาว',
    }),
  );
}

// 2. fruit and ice cream
items.push(
  it('fruit', 'fruit', 'ผลไม้จานเล็ก', C.fruit.fruit, 8, { health: 2, tags: ['fruit'] }),
  it('fruit', 'banana', 'กล้วย (ชิ้นละ)', C.fruit.banana, 8, { health: 1, tags: ['fruit'], note: 'คิดเป็นชิ้น' }),
  it('fruit', 'icecup', 'ไอศกรีมถ้วย', C.fruit.cup, 6, { stress: -3, tags: ['dessert'] }),
  it('fruit', 'cone', 'ไอศกรีมโคน', C.fruit.cone, 5, {
    stress: -3,
    tags: ['dessert'],
    options: [opt('size', 'ขนาด', [ch('small', 'เล็ก'), ch('big', 'ใหญ่', C.fruit.coneBig - C.fruit.cone, 2)])],
  }),
  it('fruit', 'mochi', 'โมจิ', C.fruit.mochi, 10, {
    meals: ['dinner'],
    stress: -4,
    tags: ['dessert', 'evening'],
    mealReason: 'ขายเฉพาะตอนเย็น',
    options: [opt('icecream', 'ไอศกรีม', [ch('none', 'ไม่ใส่'), ch('icecream', 'ใส่ไอศกรีม', C.fruit.mochiWithIce - C.fruit.mochi, 3)])],
  }),
);

// 3. chicken rice
items.push(
  it('chicken', 'plain', 'ข้าวมันไก่', C.chicken.plain, 30, { tags: ['meal'] }),
  it('chicken', 'crispy', 'ข้าวมันไก่ทอดกรอบ', C.chicken.crispy, 32, { tags: ['meal'] }),
  it('chicken', 'spicy', 'ข้าวไก่ทอดเผ็ด', C.chicken.spicy, 32, { tags: ['meal'] }),
  it('chicken', 'porkleg', 'ข้าวขาหมู', C.chicken.porkLeg, 40, { tags: ['meal'] }),
  it('chicken', 'special', 'ข้าวมันไก่พิเศษ', C.chicken.special, 45, { tags: ['meal'], note: 'ไก่เยอะ ข้าวเยอะ' }),
);

// 4. curry rice: from 30, +5 per extra dish; khao soi and khanom jeen 30 each (two sauces)
const CURRY_DISHES = ['แกงเขียวหวาน', 'ผัดผัก', 'ไข่พะโล้', 'ต้มจืด', 'ปลาทอด'];
items.push(
  it('curry', 'rice', 'ข้าวแกง', C.curry.base, 28, {
    tags: ['meal'],
    options: [
      opt('extras', 'เพิ่มกับข้าว', CURRY_DISHES.map((d, i) => ch(`d${i}`, d, C.curry.extraDish, C.curry.extraDishFill)), { multi: true, max: 4 }),
    ],
  }),
  it('curry', 'khaosoi', 'ข้าวซอย', C.curry.soy, 30, {
    tags: ['meal'],
    options: [opt('sauce', 'น้ำแกง', [ch('chicken', 'ไก่'), ch('beef', 'เนื้อ')])],
  }),
  it('curry', 'khanomjeen', 'ขนมจีน', C.curry.khanomjeen, 28, {
    tags: ['meal'],
    options: [opt('sauce', 'น้ำยา', [ch('namya', 'น้ำยา'), ch('namprik', 'น้ำพริก')])],
  }),
);

// 5. fried food: the cheese is free at the whole shop, adds fill, counts as a good choice
const CHEESE_OPT = opt('cheese', 'ชีส (ฟรี)', [ch('none', 'ไม่ใส่'), ch('cheese', 'ใส่ชีส')]);
const SKEWERS = [
  ['nugget', 'นักเก็ตไม้', C.fried.skewerLow],
  ['sausage', 'ไส้กรอกทอด', C.fried.skewerLow],
  ['banana', 'กล้วยทอด', C.fried.skewerLow],
  ['meatball', 'ลูกชิ้นทอด', C.fried.skewerLow],
  ['chickenstick', 'ไก่ทอดไม้', C.fried.skewerHigh],
  ['porkstick', 'หมูทอดไม้', C.fried.skewerHigh],
];
for (const [key, name, price] of SKEWERS) {
  items.push(it('fried', key, name, price, C.fried.skewerFill, { tags: ['snack', 'fried'], options: [CHEESE_OPT] }));
}
items.push(
  it('fried', 'fatchicken', 'ไก่อ้วน (ไม้ละ)', C.fried.fatChicken, C.fried.fatChickenFill, {
    tags: ['snack', 'fried', 'special'],
    note: 'กินสองไม้อิ่มเลย',
    options: [CHEESE_OPT],
  }),
);

// 6 + 10. made-to-order. Same plain dishes at both shops; the left one also has signature dishes and instant noodles.
const TAMSANG_PLAIN = [
  ['khaikhon', 'ข้าวไข่ข้น', 35, 28],
  ['kapraopork', 'ผัดกะเพราหมูไข่ดาว', 40, 32],
  ['kapraochicken', 'ผัดกะเพราไก่ไข่ดาว', 40, 32],
  ['friedricepork', 'ข้าวผัดหมู', 40, 32],
  ['garlicpork', 'ข้าวหมูทอดกระเทียม', 40, 32],
  ['friedriceshrimp', 'ข้าวผัดกุ้ง', 50, 34],
];
const TAMSANG_SIGNATURE = [
  ['sig_shrimp', 'ข้าวไข่ข้นกุ้ง (เมนูเด็ด)', 55, 40],
  ['sig_pork', 'ข้าวไข่ข้นหมูสับ (เมนูเด็ด)', 45, 36],
  ['sig_chicken', 'ข้าวไข่ข้นไก่ (เมนูเด็ด)', 45, 36],
];
for (const [key, name, price, fill] of TAMSANG_SIGNATURE) {
  items.push(it('tamsang', key, name, price, fill, { tags: ['meal', 'signature'], note: 'เมนูเด็ดของร้าน อิ่ม อร่อย' }));
}
for (const [key, name, price, fill] of TAMSANG_PLAIN) {
  items.push(it('tamsang', key, name, price, fill, { tags: ['meal'] }));
  items.push(
    it('tamsang2', key, name, price + C.tamsang2.priceDelta, Math.round(fill * C.tamsang2.fillFactor), {
      tags: ['meal', 'plain'],
      note: 'ธรรมดา อิ่มน้อยกว่า',
    }),
  );
}
items.push(
  it('tamsang', 'mama', 'มาม่าต้ม', C.tamsang.noodlePack, 22, {
    tags: ['meal', 'instant'],
    health: -1,
    options: [
      opt('pack', 'ซอง', [ch('red', 'แดง (ต้มยำ)'), ch('white', 'ขาว (หมูสับ)'), ch('black', 'ดำ (ผัดขี้เมา)')]),
      opt('egg', 'ไข่', [ch('none', 'ไม่ใส่'), ch('egg', 'ใส่ไข่', C.tamsang.noodleEgg, 3)]),
    ],
  }),
);

// 7. noodles (normal, nothing special)
items.push(
  it('noodle', 'bowl', 'ก๋วยเตี๋ยว', C.noodle.bowl, 26, {
    tags: ['meal'],
    options: [
      opt('noodle', 'เส้น', [ch('small', 'เส้นเล็ก'), ch('big', 'เส้นใหญ่'), ch('wheat', 'บะหมี่'), ch('vermicelli', 'วุ้นเส้น')]),
      opt('soup', 'น้ำ', [ch('clear', 'น้ำใส'), ch('tomyum', 'ต้มยำ'), ch('dry', 'แห้ง')]),
      opt('size', 'ขนาด', [ch('normal', 'ธรรมดา'), ch('special', 'พิเศษ', C.noodle.special - C.noodle.bowl, 8)]),
    ],
  }),
);

// 8. yam / steak / malatang: the menu changes by meal
const STICKY_SIDES = [
  ['friedspicy', 'ไก่ทอดเผ็ด'],
  ['sweetpork', 'หมูหวาน'],
  ['grillpork', 'หมูย่าง'],
  ['grillchicken', 'ไก่ย่าง'],
  ['floss', 'หมูหยอง'],
  ['sausage', 'ไส้กรอก'],
];
items.push(
  it('yam', 'sticky', 'ข้าวเหนียวกับข้าง', C.yam.sticky, 14, {
    meals: ['breakfast'],
    tags: ['meal', 'breakfast'],
    options: [opt('sides', 'เลือกกับ', STICKY_SIDES.map(([v, l]) => ch(v, l, C.yam.stickySide, 8)), { multi: true, max: 3 })],
  }),
);
const YAM_BRANDS = [
  ch('mama', 'มาม่า'),
  ch('nissin', 'นิสชิน'),
  ch('yumyum', 'ยำยำ'),
  ch('wai', 'ไวไว'),
  ch('koreanramen', 'บะหมี่เกาหลี', 5),
];
const YAM_FLAVOURS = [ch('spicy', 'แซ่บเผ็ด'), ch('tomyum', 'ต้มยำ'), ch('seafood', 'ซีฟู้ด'), ch('sweetsour', 'เปรี้ยวหวาน')];
const YAM_TOPS = [ch('egg', 'ไข่ต้ม', 5, 3), ch('pork', 'หมูสับ', 10, 5), ch('shrimp', 'กุ้ง', 15, 5), ch('crabstick', 'ปูอัด', 10, 4), ch('vegetable', 'ผักรวม', 5, 2)];
items.push(
  it('yam', 'yam', 'ยำ (เลือกรสเอง)', C.yam.yamBase, 28, {
    meals: ['lunch'],
    tags: ['meal', 'yam', 'builder'],
    options: [
      opt('brand', 'ยี่ห้อเส้น', YAM_BRANDS),
      opt('flavour', 'รสชาติ', YAM_FLAVOURS),
      opt('toppings', 'ท็อปปิ้ง', YAM_TOPS, { multi: true, max: 3 }),
    ],
  }),
);
const EXTRA_CHEESE = opt('extraCheese', 'ชีสเพิ่ม', [
  ch('0', 'ไม่เพิ่ม'),
  ch('1', 'เพิ่มชีส 1', C.yam.extraCheese, 3),
  ch('2', 'เพิ่มชีส 2', C.yam.extraCheese * 2, 6),
]);
for (const [key, name] of [
  ['steakfish', 'สเต็กปลา'],
  ['steakchicken', 'สเต็กไก่'],
  ['steakpork', 'สเต็กหมู'],
]) {
  items.push(it('yam', key, name, C.yam.steak, 28, { meals: ['lunch'], tags: ['meal', 'steak'], options: [EXTRA_CHEESE] }));
}
items.push(
  it('yam', 'steakcheeseball', 'ไก่ชีส (ลูกกลม)', C.yam.steakCheeseBall, 10, {
    meals: ['lunch'],
    tags: ['snack', 'steak'],
    note: 'สั่งหลายลูกได้',
    options: [EXTRA_CHEESE],
  }),
);
const SKEWER_CHOICES = [
  ch('meatball', 'ลูกชิ้นปลา', C.yam.skewer, C.yam.skewerFill),
  ch('mushroom', 'เห็ด', C.yam.skewer, C.yam.skewerFill),
  ch('cabbage', 'ผักกาด', C.yam.skewer, C.yam.skewerFill - 3),
  ch('pork', 'หมูสไลซ์', C.yam.skewer, C.yam.skewerFill),
  ch('sausage', 'ไส้กรอก', C.yam.skewer, C.yam.skewerFill),
  ch('tofu', 'เต้าหู้', C.yam.skewer, C.yam.skewerFill),
  ch('crabstick', 'ปูอัด', C.yam.skewer, C.yam.skewerFill),
  ch('quail', 'ไข่นกกระทา', C.yam.skewer, C.yam.skewerFill),
];
const NOODLE_TYPES = [
  ch('glass', 'วุ้นเส้น'),
  ch('mama', 'มาม่า'),
  ch('riceNoodle', 'เส้นหมี่ขาว'),
  ch('wide', 'เส้นแบน'),
  ch('egg', 'บะหมี่ไข่', 5, 2),
];
const BROTHS = [ch('black', 'ซุปดำ'), ch('malatang', 'หม่าล่า'), ch('ramen', 'ราเมน')];
for (const [key, name] of [
  ['malatang', 'หม่าล่า (เลือกไม้)'],
  ['suki', 'สุกี้ (เลือกไม้)'],
]) {
  items.push(
    it('yam', key, name, C.yam.bowl, 14, {
      meals: ['dinner'],
      tags: ['meal', 'builder', 'evening'],
      options: [
        opt('skewers', 'เลือกไม้', SKEWER_CHOICES, { multi: true, max: C.yam.maxSkewers }),
        opt('noodle', 'เส้น', NOODLE_TYPES),
        opt('broth', 'น้ำซุป', BROTHS),
      ],
    }),
  );
}

// 9. crepes (very cheap, few customers; the 85% subplot lives in economy/shops.js)
items.push(
  it('crepe', 'chaokuay', 'เฉาก๊วยนมสด', C.crepe.chaoKuay, 8, { tags: ['dessert', 'drink'] }),
  it('crepe', 'crepe', 'เครป (ชิ้นละ)', C.crepe.piece, 4, { tags: ['dessert', 'crepe'], note: 'คิดเป็นชิ้น' }),
  // the name "แป้งเครป" is my guess (cj only said "batter 10")
  it('crepe', 'batter', 'แป้งเครป', C.crepe.batter, 6, { tags: ['dessert', 'crepe'] }),
);

// ---------------- 11. the LINE shop ----------------
// cj: salmon rice 99, ordinary pickles 15-25. Everything else PLACEHOLDER (DESIGN.md placeholders).
// spare: true = may be bought on the spot from the stock of a cancelled order (cj: pickled egg, pickled salmon, instant noodles)
const LINE_BUFF = { label: 'อิ่มใจ ตั้งใจเรียน', periods: C.line.buffPeriods, focus: 1, stress: -3 }; // PLACEHOLDER
export const LINE_ITEMS = [
  it('line', 'salmonrice', 'ข้าวแซลมอนดอง', 99, 40, { stress: -4, buff: LINE_BUFF, tags: ['meal', 'pickled'], note: 'ต้องสั่งล่วงหน้า' }),
  it('line', 'picklemango', 'มะม่วงดอง', 15, 4, { buff: LINE_BUFF, tags: ['pickled'], note: 'ของดอง' }),
  it('line', 'picklecucumber', 'แตงกวาดอง', 15, 4, { buff: LINE_BUFF, tags: ['pickled'], note: 'ของดอง' }),
  it('line', 'pickleradish', 'ผักกาดดอง', 20, 4, { buff: LINE_BUFF, tags: ['pickled'], note: 'ของดอง' }),
  it('line', 'picklekimchi', 'กิมจิ', 25, 5, { buff: LINE_BUFF, tags: ['pickled'], note: 'ของดอง' }),
  it('line', 'pickledegg', 'ไข่ดอง', 20, 8, { buff: LINE_BUFF, tags: ['pickled'], spare: true, note: 'ไข่ดอง (ซื้อหน้าห้องได้ถ้ามีคนยกเลิก)' }),
  it('line', 'pickledsalmon', 'แซลมอนดอง', 59, 15, { buff: LINE_BUFF, tags: ['pickled'], spare: true, note: 'แซลมอนดอง (ซื้อหน้าห้องได้ถ้ามีคนยกเลิก)' }),
  it('line', 'hokkaidomilk', 'นมฮอกไกโด', 25, 8, { energy: 5, buff: LINE_BUFF, tags: ['drink'] }),
  it('line', 'friedrice', 'ข้าวผัด', 30, 28, { buff: LINE_BUFF, tags: ['meal'] }),
  it('line', 'instantnoodle', 'มาม่าถ้วย', 20, 18, { health: -1, buff: LINE_BUFF, tags: ['instant'], spare: true, note: 'มาม่า (ซื้อหน้าห้องได้ถ้ามีคนยกเลิก)' }),
  it('line', 'kitkat', 'คิทแคท', 15, 5, { stress: -2, buff: LINE_BUFF, tags: ['snack'] }),
];
export const LINE_SPARE_IDS = LINE_ITEMS.filter((i) => i.spare).map((i) => i.id);

// ---------------- co-op (7-Eleven style food + stationery) ----------------
// All prices PLACEHOLDER (cj has not given them). `give` = what goes into the player's inventory per unit.
export const COOP_ITEMS = [
  // food and drinks
  it('coop', 'riceBox', 'ข้าวกล่องอุ่นไมโครเวฟ', 40, 32, { tags: ['meal'], kind: 'food' }),
  it('coop', 'sandwich', 'แซนด์วิช', 25, 14, { tags: ['snack'], kind: 'food' }),
  it('coop', 'hotdog', 'ฮอตดอก', 20, 12, { tags: ['snack'], kind: 'food' }),
  it('coop', 'bread', 'ขนมปังไส้ครีม', 12, 8, { tags: ['snack'], kind: 'food' }),
  it('coop', 'chips', 'ขนมถุง', 15, 6, { stress: -1, tags: ['snack'], kind: 'food' }),
  it('coop', 'milk', 'นมกล่อง', 12, 6, { energy: 3, tags: ['drink'], kind: 'food' }),
  it('coop', 'water', 'น้ำเปล่า', 8, 0, { energy: 0, tags: ['drink'], kind: 'food' }),
  it('coop', 'soda', 'น้ำอัดลม', 15, 2, { energy: 4, health: -1, tags: ['drink'], kind: 'food' }),
  it('coop', 'greentea', 'ชาเขียวขวด', 20, 2, { energy: 5, tags: ['drink'], kind: 'food' }),
  it('coop', 'icecream', 'ไอศกรีมแท่ง', 20, 5, { stress: -3, tags: ['dessert'], kind: 'food' }),
  // stationery and gear (go into the inventory)
  it('coop', 'pen', 'ปากกา', 10, 0, { kind: 'stationery', give: [{ itemId: 'pen', qty: 1 }], tags: ['stationery'] }),
  it('coop', 'stationery', 'เครื่องเขียนชุด (ดินสอ ยางลบ ไม้บรรทัด)', 30, 0, { kind: 'stationery', give: [{ itemId: 'stationery', qty: 1 }], tags: ['stationery'] }),
  it('coop', 'a4', 'กระดาษ A4 (100 แผ่น)', 60, 0, { kind: 'stationery', give: [{ itemId: 'a4_sheet', qty: 100 }], tags: ['stationery', 'paper'], note: 'ได้ 100 แผ่น ใช้ปริ้นต้องมีกระดาษก่อน' }),
  it('coop', 'a3', 'กระดาษปอนด์ A3 (แผ่นละ)', 5, 0, { kind: 'stationery', give: [{ itemId: 'a3_paper', qty: 1 }], tags: ['stationery', 'paper'], maxQty: 20 }),
  it('coop', 'colour', 'กระดาษสี (แผ่นละ)', 3, 0, { kind: 'stationery', give: [{ itemId: 'colour_paper', qty: 1 }], tags: ['stationery', 'paper'], maxQty: 20 }),
  it('coop', 'gluegun', 'ปืนกาว', 90, 0, { kind: 'stationery', give: [{ itemId: 'glue_gun', qty: 1 }], tags: ['stationery'], maxQty: 1 }),
  it('coop', 'scout', 'ชุดลูกเสือ/ยุวกาชาด (ผ้าพันคอ ห่วง)', 120, 0, { kind: 'stationery', give: [{ itemId: 'scout_gear', qty: 1 }], tags: ['gear'], note: 'ชุดลูกเสือ ใช้ในคาบ ลส/ยว', maxQty: 1 }),
  it('coop', 'redcross', 'ชุดยุวกาชาด (ป้ายชื่อ เข็มกลัด)', 100, 0, { kind: 'stationery', give: [{ itemId: 'redcross_gear', qty: 1 }], tags: ['gear'], maxQty: 1 }),
];

// inventory item ids that exist in the game (what a teacher can require and what the co-op/print room puts in the bag)
export const INVENTORY_ITEM_IDS = ['pen', 'stationery', 'a4_sheet', 'a3_paper', 'colour_paper', 'glue_gun', 'scout_gear', 'redcross_gear', 'print_page'];

// ---------------- print room ----------------
export const PRINT_ITEM = it('print', 'page', 'พิมพ์ (หน้าละ)', C.print.perPage, 0, {
  tags: ['print'],
  kind: 'print',
  maxQty: 100,
  note: 'ต้องมีกระดาษ A4 ก่อน',
});
PRINT_ITEM.give = [{ itemId: 'print_page', qty: 1 }];
PRINT_ITEM.use = [{ itemId: 'a4_sheet', qty: 1 }]; // one sheet of paper per page

export const COOP_SHOP = { id: 'coop', no: 0, name: 'อาคารร้านค้าสวัสดิการโรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย พิษณุโลก (สหกรณ์)' };
export const PRINT_SHOP = { id: 'print', no: 0, name: 'ห้องปริ้นสหกรณ์' };
export const LINE_SHOP = { id: 'line', no: 11, name: 'สั่งของจากมิ้ว (LINE)' };

export const ITEMS = [...items, ...LINE_ITEMS, ...COOP_ITEMS, PRINT_ITEM];
