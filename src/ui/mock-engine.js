// Mock engine: same API as CONTRACT.md section 3, canned but varied data for all six pending kinds.
// Used for UI development (?mock=1) and as a fallback when the real engine is missing.
// State is plain JSON; the pending is rebuilt from the state, so save/load is trivial.
import { Rng } from '../rng.js';
import { createRoutineMock, loadRoutineMock, schoolMapFor, ROUTINE_DEFAULT, DAYS_PER_YEAR } from './mock-routine.js';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const TOTAL_DAYS = 4; // the mock life lasts 4 days, then the ending scene
const STEPS_PER_DAY = 9;
const FIRST_DAY_STEP = 2;

const TEACHERS = ['ครูมินท์', 'ครูเอก', 'ครูฝน', 'ครูบัว', 'ครูต้น', 'ครูแพร'];
const MOODS = ['calm', 'tense', 'snapping'];
const SUBJECTS = [
  { code: 'ค21102', name: 'คณิตศาสตร์', loc: '218' },
  { code: 'ท21102', name: 'ภาษาไทย', loc: '213' },
  { code: 'ว21102', name: 'วิทยาศาสตร์', loc: '221', line: true },
  { code: 'อ21102', name: 'ภาษาอังกฤษ', loc: '232' },
  { code: 'ส21102', name: 'สังคมศึกษา', loc: '242' },
  { code: 'ว21203', name: 'วิทยาศาสตร์เพิ่มเติม', loc: '223', line: true },
  { code: 'พ21104', name: 'พลศึกษา', loc: 'สนาม 2' },
];

const MEAL_TIMES = [
  { meal: 'breakfast', minute: 6 * 60 + 25, place: 'โรงอาหาร', name: 'มื้อเช้า' },
  { meal: 'lunch', minute: 12 * 60 + 5, place: 'โรงอาหาร', name: 'มื้อกลางวัน' },
];

function hhmm(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}
function clockLabel(day, minute) {
  return `วัน${DAYS[day % 7]} ${hhmm(minute)}`;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- canned data ----------
function mealShops(meal, day) {
  const smoothieOptions = [
    { key: 'size', label: 'ขนาด', choices: [{ value: 'm', label: 'กลาง', priceDelta: 0 }, { value: 'l', label: 'ใหญ่', priceDelta: 10 }] },
    { key: 'topping', label: 'ท็อปปิ้ง', multi: true, max: 2, choices: [{ value: 'jelly', label: 'เยลลี่', priceDelta: 5 }, { value: 'pearl', label: 'ไข่มุก', priceDelta: 5 }, { value: 'cream', label: 'วิปครีม', priceDelta: 5 }] },
  ];
  const shops = [
    { id: 'rice', name: 'ข้าวมันไก่', items: [
      { id: 'rice-chicken', name: 'ข้าวมันไก่', price: 30, fill: 45, note: 'อิ่มพอดี' },
      { id: 'rice-leg', name: 'ข้าวขาหมู', price: 50, fill: 60 },
      { id: 'rice-special', name: 'ข้าวมันไก่พิเศษ', price: 60, fill: 70, note: 'อิ่มมาก' },
    ] },
    { id: 'curry', name: 'ข้าวแกง', items: [
      { id: 'curry-1', name: 'ข้าวแกง 1 อย่าง', price: 30, fill: 40 },
      { id: 'curry-2', name: 'ข้าวแกง 2 อย่าง', price: 35, fill: 50 },
      { id: 'khanomjeen', name: 'ขนมจีน น้ำยา', price: 30, fill: 40, options: [{ key: 'sauce', label: 'น้ำ', choices: [{ value: 'kaeng', label: 'น้ำยากะทิ', priceDelta: 0 }, { value: 'nam', label: 'น้ำเงี้ยว', priceDelta: 0 }] }] },
    ] },
    { id: 'smoothie', name: 'ร้านน้ำปั่น', items: [
      { id: 'smoothie-1', name: 'น้ำปั่นผลไม้', price: 30, fill: 10, note: 'ได้พลังงาน', options: smoothieOptions },
      ...(day % 2 === 1 ? [{ id: 'cocoa', name: 'โกโก้ร้อน', price: 15, fill: 5 }] : []),
    ] },
    { id: 'fried', name: 'ของทอด', items: [
      { id: 'skewer-fat', name: 'ไก่อ้วน (ไม้)', price: 10, fill: 20, note: 'กิน 2 ไม้อิ่ม', options: [{ key: 'cheese', label: 'ชีส', choices: [{ value: 'none', label: 'ไม่ใส่', priceDelta: 0 }, { value: 'yes', label: 'ใส่ชีส (ฟรี)', priceDelta: 0 }] }] },
      { id: 'nugget', name: 'นักเก็ต (ไม้)', price: 10, fill: 15 },
    ] },
    { id: 'special', name: 'ตามสั่ง (ร้านดัง)', items: [
      { id: 'khai-khon', name: 'ข้าวไข่ข้น', price: 45, fill: 55, available: meal === 'lunch', reason: meal === 'lunch' ? undefined : 'ขายช่วงกลางวัน' },
      { id: 'mama', name: 'มาม่าต้ม', price: 25, fill: 35, options: [{ key: 'flavor', label: 'รส', choices: [{ value: 'red', label: 'แดง', priceDelta: 0 }, { value: 'white', label: 'ขาว', priceDelta: 0 }, { value: 'black', label: 'ดำ', priceDelta: 5 }] }] },
    ] },
  ];
  return shops.map((s) => ({ ...s, items: s.items.map((it) => ({ available: true, ...it })) }));
}

function coopShops() {
  return [
    { id: 'coop', name: 'สหกรณ์โรงเรียน', items: [
      { id: 'a4', name: 'กระดาษ A4 (100 แผ่น)', price: 85, fill: 0, available: true },
      { id: 'a3', name: 'กระดาษปอนด์ A3', price: 5, fill: 0, available: true },
      { id: 'glue', name: 'ปืนกาว', price: 60, fill: 0, available: true },
      { id: 'scout', name: 'ชุดลูกเสือ', price: 280, fill: 0, available: false, reason: 'เงินไม่พอ' },
      { id: 'sandwich', name: 'แซนด์วิช', price: 25, fill: 30, available: true },
    ] },
  ];
}
function printShops() {
  return [
    { id: 'print', name: 'ห้องปริ้น', items: [
      { id: 'print-bw', name: 'ปริ้นขาวดำ (แผ่นละ 2)', price: 2, fill: 0, available: true, note: 'ต้องซื้อกระดาษก่อน', options: [{ key: 'pages', label: 'จำนวนแผ่น', choices: [{ value: '1', label: '1', priceDelta: 0 }, { value: '5', label: '5', priceDelta: 8 }, { value: '10', label: '10', priceDelta: 18 }] }] },
      { id: 'print-photo', name: 'ปริ้นรูป', price: 2, fill: 0, available: true },
    ] },
  ];
}

function classPeriods(block, day) {
  const base = block === 'morning' ? [1, 2, 3, 4] : [5, 6, 7, 8];
  const times = {
    1: ['08:30', '09:20'], 2: ['09:20', '10:10'], 3: ['10:20', '11:10'], 4: ['11:10', '12:00'],
    5: ['13:00', '13:50'], 6: ['13:50', '14:40'], 7: ['14:50', '15:40'], 8: ['15:40', '16:30'],
  };
  return base.map((p, i) => {
    const [from, to] = times[p];
    if (block === 'afternoon' && p === 5) return { p, from, to, kind: 'activity', name: 'ชุมนุม (ดนตรีไทย)', loc: 'ห้องดนตรี' };
    if (block === 'afternoon' && p === 6) return { p, from, to, kind: 'free', name: 'คาบว่าง' };
    const s = SUBJECTS[(i + day * 3 + (block === 'afternoon' ? 4 : 0)) % SUBJECTS.length];
    const mood = MOODS[(i + day + (block === 'afternoon' ? 1 : 0)) % 3];
    const items = [
      { id: 'egg', name: 'ไข่ดอง', price: 20, available: true },
      { id: 'noodle', name: 'มาม่าถ้วย', price: 20, available: day % 2 === 0 },
      { id: 'kitkat', name: 'Kit Kat', price: 15, available: true },
      { id: 'milk', name: 'นมฮอกไกโด', price: 25, available: true },
    ];
    return {
      p, from, to, kind: 'class', code: s.code, name: s.name, loc: s.loc,
      teacher: { key: `m1-${'ABCDEF'[(i + day) % 6]}`, name: TEACHERS[(i + day) % TEACHERS.length], mood },
      lineShop: { eligible: !!s.line, items: s.line ? items : [] },
    };
  });
}

const EVENT_SCENES = [
  () => ({
    title: 'เพื่อนขอยืมเงิน',
    text: 'ต้นกล้าเพื่อนห้องเดียวกันเดินมาหาตอนพักเย็น "ขอยืม 50 ได้ไหม พรุ่งนี้คืน" ใกล้สิ้นเดือนแล้ว ในกระเป๋าคุณเองก็ไม่ได้เยอะ',
    options: [
      { id: 'lend', label: 'ให้ยืม 50 บาท', sub: 'เพื่อนจะชอบคุณขึ้น แต่เงินหายไปก่อน', tone: 'good' },
      { id: 'half', label: 'ให้ยืม 20 บาท', sub: 'พอช่วยได้นิดหน่อย', tone: 'neutral' },
      { id: 'refuse', label: 'ปฏิเสธ', sub: 'เก็บเงินไว้ แต่บรรยากาศอาจเงียบไปหน่อย', tone: 'bad' },
    ],
  }),
  () => ({
    title: 'ครูสลิ้งแตก',
    text: 'ครูวิทยาศาสตร์วางปากกาลงบนโต๊ะแรงๆ "งานที่สั่งไป ใครยังไม่ส่งยกมือ" ทั้งห้องเงียบ ตาครูมองมาทางแถวคุณ',
    card: { rows: [['วิชา', 'วิทยาศาสตร์'], ['ห้อง', '221'], ['งานค้าง', '1 ชิ้น']] },
    options: [
      { id: 'confess', label: 'ยกมือรับ แล้วขอส่งพรุ่งนี้', sub: 'ครูอาจเอ็ด แต่ความไว้ใจไม่หาย', tone: 'good' },
      { id: 'hide', label: 'นั่งนิ่งๆ', sub: 'เสี่ยงโดนเรียกชื่อ', tone: 'bad' },
      { id: 'sick', label: 'บอกว่าไม่สบาย', sub: 'ต้องไปห้องพยาบาล', tone: 'neutral', disabled: true, reason: 'ตอนนี้คุณสุขภาพดี ครูไม่เชื่อ' },
    ],
  }),
  () => ({
    title: 'ผลสอบกลางภาค',
    text: 'ประกาศผลติดบอร์ดหน้าห้อง คุณยืนอ่านชื่อตัวเองในแถวที่เจ็ด',
    card: { rows: [['คณิตศาสตร์', '18 / 25'], ['ภาษาไทย', '21 / 25'], ['วิทยาศาสตร์', '15 / 25'], ['ลำดับในห้อง', '9 / 24']] },
    options: [
      { id: 'ok', label: 'ถอนหายใจ แล้วตั้งใจใหม่', tone: 'good' },
      { id: 'dont-care', label: 'ช่างมัน', tone: 'bad' },
    ],
  }),
  () => ({
    title: 'ได้กลับบ้านแล้ว',
    text: 'เลิกเรียนวันศุกร์ รถของพ่อมารอหน้าโรงเรียน นี่คือจุดบันทึกเกม จะมีเวลาพักสองวันก่อนกลับหอวันอาทิตย์',
    card: { rows: [['รอบนี้', 'สัปดาห์ที่ 2 ของภาคเรียน'], ['เกรดตอนนี้', '3.62'], ['เงินคงเหลือ', 'ดูที่แถบด้านบน']] },
    options: [
      { id: 'home', label: 'ขึ้นรถกลับบ้าน', sub: 'บันทึกเกมอัตโนมัติ', tone: 'good' },
    ],
  }),
];

const EVENT_RESULTS = {
  lend: { lines: [['ให้เพื่อนยืมเงิน 50 บาท', 'good']], fx: { money: -50, peer: 6 } },
  half: { lines: [['ให้ยืม 20 บาท', 'neutral']], fx: { money: -20, peer: 2 } },
  refuse: { lines: [['ปฏิเสธเพื่อน บรรยากาศเงียบไปครู่หนึ่ง', 'bad']], fx: { peer: -3 } },
  confess: { lines: [['ครูเอ็ดสั้นๆ แต่ยอมให้ส่งพรุ่งนี้', 'good']], fx: { teacherTrust: 3, stress: 5 } },
  hide: { lines: [['ครูเรียกชื่อคุณหน้าห้อง', 'bad']], fx: { teacherTrust: -6, stress: 12 } },
  home: { lines: [['ขึ้นรถกลับบ้าน บันทึกเกมแล้ว', 'good']], fx: { stress: -20, energy: 20 } },
  ok: { lines: [['ตั้งใจจะอ่านหนังสือมากขึ้น', 'good']], fx: { stress: 4, knowledge: 3 } },
  'dont-care': { lines: [['เก็บความรู้สึกไว้ในใจ', 'bad']], fx: { stress: 8 } },
};

// ---------- the game ----------
function freshState(seed) {
  return {
    seed: seed >>> 0,
    step: 0,
    money: 1200,
    stats: { gpa: 3.62, gpax: 3.62, health: 82, energy: 70, stress: 22, fullness: 40, knowledge: 40, peer: 30, teacherTrust: 40 },
    termChoice: null,
    orders: [],
    nextOrderId: 1,
    askCount: 0,
    me: {
      name: 'ณัฐ', sex: 'ชาย', trait: 'extrovert', grade: 1, room: 3, rank: 9, rankSize: 24,
      dormName: 'หอพักจุฬาพิลาส', dormRoom: 'ห้อง 204', tier: 'normal',
    },
    notes: ['ใช้ข้อมูลทดลอง (mock) ไม่ใช่เอนจินจริง'],
  };
}

function dayOf(step) { return step < FIRST_DAY_STEP ? 0 : Math.floor((step - FIRST_DAY_STEP) / STEPS_PER_DAY); }
function kOf(step) { return step < FIRST_DAY_STEP ? -1 : (step - FIRST_DAY_STEP) % STEPS_PER_DAY; }
function isEnding(step) { return step >= FIRST_DAY_STEP + TOTAL_DAYS * STEPS_PER_DAY; }

// minute of day for each k within a day
const K_MINUTE = [6 * 60 + 25, 8 * 60 + 25, 12 * 60 + 5, 12 * 60 + 55, 16 * 60 + 35, 16 * 60 + 50, 19 * 60, 22 * 60 + 15, 22 * 60 + 45];

class MockGame {
  constructor(state) {
    this.state = state;
    this.pending = this._build();
  }

  _clock() {
    const s = this.state.step;
    if (s < FIRST_DAY_STEP) return { day: 0, minute: 6 * 60 + 10 };
    if (isEnding(s)) return { day: 4, minute: 17 * 60 };
    return { day: [0, 1, 2, 4][dayOf(s) % 4], minute: K_MINUTE[kOf(s)] };
  }

  _build() {
    const st = this.state;
    const step = st.step;
    const { day, minute } = this._clock();
    const clock = clockLabel(day, minute);
    const id = `mock-${step}`;
    const base = { id, clock };

    if (step === 0) {
      return {
        ...base, kind: 'scene', title: 'ชีวิตใหม่ ม.1',
        text: 'คุณเป็นนักเรียนคนหนึ่งใน 720 คนของโรงเรียนประจำ วันนี้พ่อแม่ขับรถมาส่งที่หอพัก เหลือเงินติดตัวตามที่ขอพ่อแม่ไว้ แล้วทุกอย่างก็เริ่มต้นขึ้น',
        card: { rows: [
          ['ชื่อ', st.me.name], ['เพศ', st.me.sex], ['นิสัย', st.me.trait === 'extrovert' ? 'ชอบเข้าสังคม' : 'ชอบอยู่เงียบๆ'],
          ['ห้องเรียน', `ม.${st.me.grade}/${st.me.room}`], ['หอพัก', st.me.dormName], ['เงินวันแรก', `${st.money.toLocaleString('en-US')} บาท`],
          ['ฐานะครอบครัว', 'ปกติ'],
        ] },
        options: [{ id: 'begin', label: 'เริ่มชีวิตนักเรียน', sub: 'ขึ้นไปเก็บของที่ห้องนอน', tone: 'good' }],
      };
    }
    if (step === 1) {
      return {
        ...base, kind: 'termStart', title: 'เลือกชุมนุมและวิชาเลือก',
        text: 'ต้นภาคเรียน เลือกชุมนุมวันอังคาร และวิชา พก. 1 วิชา ที่นั่งมีจำกัด',
        clubs: [
          { id: 'thai-music', name: 'ดนตรีไทย', seatsLeft: 4, studentRun: false },
          { id: 'math-goal', name: 'คณิตศาสตร์เพื่อเป้าหมาย', seatsLeft: 7, studentRun: false },
          { id: 'english-fun', name: 'English for fun', seatsLeft: 0, studentRun: true },
          { id: 'sci-exercise', name: 'วิทยาศาสตร์การออกกำลังกาย', seatsLeft: 2, studentRun: false },
        ],
        electives: [
          { id: 'el-multimedia', name: 'มัลติมีเดียเบื้องต้น', area: 'คอมพิวเตอร์' },
          { id: 'el-math-game', name: 'คณิตศาสตร์ในเกมกระดาน', area: 'คณิตศาสตร์' },
          { id: 'el-sci-kitchen', name: 'วิทย์ในครัว', area: 'วิทยาศาสตร์' },
        ],
        needElective: true,
      };
    }
    if (isEnding(step)) {
      return {
        ...base, kind: 'scene', final: true, title: 'จบการทดลอง',
        text: 'นี่คือตอนจบของข้อมูลทดลอง ในเกมจริง ชีวิตนักเรียนจะต่อไปอีกหกปี จนถึงวันรับประกาศนียบัตรที่ ม.6',
        card: { rows: [['เกรดเฉลี่ย', st.stats.gpa.toFixed(2)], ['เงินคงเหลือ', `${st.money.toLocaleString('en-US')} บาท`], ['เพื่อน', `${Math.round(st.stats.peer)} / 100`], ['สรุป', 'นักเรียนที่ผ่านสี่วันแรกไปได้']] },
        options: [],
      };
    }

    const d = dayOf(step);
    const k = kOf(step);
    switch (k) {
      case 0: return { ...base, kind: 'shop', mode: 'meal', meal: 'breakfast', title: 'มื้อเช้า', text: 'ตื่นแต่เช้า ต้องออกจากหอก่อนเวลา', money: st.money, fullness: st.stats.fullness, shops: mealShops('breakfast', d), canSkip: true };
      case 1: return { ...base, kind: 'classPlan', block: 'morning', title: 'คาบเช้า', text: 'เข้าเรียนตามตาราง หรือจะแอบพักบ้าง', periods: classPeriods('morning', d), money: st.money };
      case 2: return { ...base, kind: 'shop', mode: 'meal', meal: 'lunch', title: 'มื้อกลางวัน', text: 'พักเที่ยง 1 ชั่วโมง', money: st.money, fullness: st.stats.fullness, shops: mealShops('lunch', d), canSkip: true };
      case 3: return { ...base, kind: 'classPlan', block: 'afternoon', title: 'คาบบ่าย', text: 'บ่ายง่วงๆ ครูบางคนอารมณ์ไม่ค่อยดี', periods: classPeriods('afternoon', d), money: st.money };
      case 4:
        if (d === 3) return { ...base, kind: 'plan', planKind: 'weekend', title: 'ช่วงเลิกเรียนวันศุกร์ ถึงวันอาทิตย์', text: 'อยู่บ้านสองวัน จัดเวลาเอง', startMinute: 17 * 60, slotMinutes: 30, slots: 8, actions: [
          { id: 'sleep', label: 'นอนพัก' }, { id: 'family', label: 'อยู่กับครอบครัว' }, { id: 'study', label: 'อ่านหนังสือ' }, { id: 'friends', label: 'ไปเจอเพื่อน' }, { id: 'play', label: 'เล่นเกม' },
        ], money: st.money, parents: { canAsk: true, nextAmount: this._askAmount() } };
        return { ...base, kind: 'plan', planKind: 'free', title: 'เลิกเรียนแล้ว', text: 'หอเปิดตอน 15:30 ต้องเข้าหอก่อน 18:00', startMinute: 16 * 60 + 30, slotMinutes: 30, slots: 3, actions: [
          { id: 'canteen', label: 'ไปโรงอาหาร', hint: 'ใช้เงิน' }, { id: 'coop', label: 'แวะสหกรณ์' }, { id: 'friends', label: 'เดินเล่นกับเพื่อน' }, { id: 'rest', label: 'พักที่หอ' },
        ], money: st.money, parents: { canAsk: true, nextAmount: this._askAmount() } };
      case 5: {
        const modes = ['coop', 'print', 'canteen'];
        const mode = modes[d % 3];
        const shops = mode === 'coop' ? coopShops() : mode === 'print' ? printShops() : mealShops('dinner', d);
        const title = mode === 'coop' ? 'สหกรณ์โรงเรียน' : mode === 'print' ? 'ห้องปริ้น' : 'โรงอาหารตอนเย็น';
        return { ...base, kind: 'shop', mode, title, text: mode === 'print' ? 'ครูสั่งให้ปริ้นรูปไปติดงาน ต้องซื้อกระดาษก่อน' : 'ดูของที่ต้องใช้ แล้วค่อยเข้าหอ', meal: mode === 'canteen' ? 'dinner' : undefined, money: st.money, fullness: st.stats.fullness, shops, canSkip: true };
      }
      case 6: return { ...base, kind: 'plan', planKind: 'evening', title: 'ค่ำที่หอ', text: 'ตั้งแต่ 19:00 ถึงเที่ยงคืน ไฟดับ 22:00', startMinute: 19 * 60, slotMinutes: 30, slots: 10, lightsOutMinute: 22 * 60, actions: [
        { id: 'study_alone', label: 'อ่านหนังสือคนเดียว' }, { id: 'study_group', label: 'อ่านกับเพื่อน' }, { id: 'homework', label: 'ทำงานที่ครูสั่ง' }, { id: 'chat', label: 'คุยกับเพื่อนร่วมห้อง' },
        { id: 'phone', label: 'เล่นมือถือ/เกม' }, { id: 'call_parents', label: 'โทรหาพ่อแม่' }, { id: 'exercise', label: 'ออกกำลังกาย' }, { id: 'sleep', label: 'นอน' },
        { id: 'whisper_chat', label: 'กระซิบคุยกันบนเตียง', hint: 'ได้หลังไฟดับ', quietOnly: true }, { id: 'phone_secret', label: 'แอบเล่นมือถือ', hint: 'ได้หลังไฟดับ', quietOnly: true },
      ], money: st.money, parents: { canAsk: true, nextAmount: this._askAmount() } };
      case 7: return { ...base, kind: 'lineOrder', title: 'สั่งของจากมิ้ว', text: 'สั่งล่วงหน้าได้ จะได้ของในวันที่เลือก', money: st.money,
        menu: [{ id: 'egg', name: 'ไข่ดอง', price: 20 }, { id: 'salmon-rice', name: 'ข้าวแซลมอนดอง', price: 99 }, { id: 'milk', name: 'นมฮอกไกโด', price: 25 }, { id: 'kitkat', name: 'Kit Kat', price: 15 }, { id: 'fried-rice', name: 'ข้าวผัด', price: 30 }],
        orders: st.orders.map((o) => ({ ...o })) };
      case 8: return { ...base, kind: 'scene', ...EVENT_SCENES[d % EVENT_SCENES.length]() };
      default: return { ...base, kind: 'scene', title: '...', text: '', options: [{ id: 'ok', label: 'ต่อ' }] };
    }
  }

  _askAmount() { return Math.max(0, Math.round(80 / 2 ** this.state.askCount)); }

  view() {
    const st = this.state;
    const { day, minute } = this._clock();
    const k = kOf(st.step);
    const placeByK = ['โรงอาหาร', 'ห้อง 218 (คณิตศาสตร์)', 'โรงอาหาร', 'ห้อง 221 (วิทยาศาสตร์)', 'หน้าหอพัก', 'สหกรณ์', 'ห้องเรียนรวมชั้นล่าง หอพัก', 'หน้าห้องสั่งของ 222', 'หอพัก'];
    const place = st.step < FIRST_DAY_STEP ? 'หอพักจุฬาพิลาส' : isEnding(st.step) ? 'ลานหน้าโรงเรียน' : placeByK[k];
    const periods = classPeriods('morning', dayOf(st.step)).concat(classPeriods('afternoon', dayOf(st.step)));
    return {
      clock: { label: clockLabel(day, minute), year: 1, term: 1, cycle: 1, day: dayOf(st.step) + 1, dow: (day % 7) + 1, minute, dayInCycle: dayOf(st.step) + 1, schoolDay: true },
      place,
      me: { ...st.me },
      stats: { ...st.stats, money: st.money },
      today: periods.map((p) => ({ from: p.from, to: p.to, title: p.name, loc: p.loc || '', teacher: p.teacher ? p.teacher.name : '', done: minute >= toMin(p.to) })),
      askParents: { available: true, nextAmount: this._askAmount() },
      notes: st.notes.slice(),
      // routine-mode fields (detailed mock only fills the display ones)
      routine: { ...ROUTINE_DEFAULT },
      progress: { yearIndex: 0, termIndex: 0, dayInYear: dayOf(st.step), daysInYear: DAYS_PER_YEAR, fraction: Math.min(1, dayOf(st.step) / DAYS_PER_YEAR / 6) },
      label: 'ม.1 เทอม 1',
      stats4: { health: Math.round(st.stats.health), happy: Math.round(100 - st.stats.stress), know: Math.round(st.stats.knowledge), bonds: Math.round((st.stats.peer + st.stats.teacherTrust) / 2) },
      record: [],
      birth: { regNo: '720-2569-000123', sentence: 'คุณเป็นหนึ่งใน 720 คนของโรงเรียนประจำ' },
      schoolMap: schoolMapFor(st.me),
    };
  }

  setRoutine(partial) { return { ...ROUTINE_DEFAULT, ...(partial || {}) }; }
  advance() { const r = this.fastForward(); return { days: 0, log: r.log, pending: this.pending, progress: this.view().progress }; }

  defaultPayload() {
    const p = this.pending;
    switch (p.kind) {
      case 'scene': { const o = (p.options || []).find((x) => !x.disabled); return { optionId: o ? o.id : 'ok' }; }
      case 'shop': return { skip: true };
      case 'classPlan': return { stance: 'normal', skipPeriods: [], line: [] };
      case 'plan': return { plan: Array.from({ length: p.slots }, (_, i) => (p.planKind === 'evening' ? (i < 7 ? (i < 4 ? 'study_alone' : 'chat') : 'sleep') : p.actions[i % p.actions.length].id)) };
      case 'termStart': return { clubId: (p.clubs.find((c) => c.seatsLeft > 0) || p.clubs[0]).id, electiveId: p.needElective ? p.electives[0].id : null };
      case 'lineOrder': return { place: [], cancel: [] };
      default: return {};
    }
  }

  act(payload) {
    const st = this.state;
    const p = this.pending;
    if (p.final) return { log: [], pending: this.pending };
    payload = payload || {};
    const rng = new Rng((st.seed * 2654435761 + st.step * 97) >>> 0);
    const log = [];
    const say = (text, tone = 'neutral') => log.push({ t: p.clock, text, tone });
    const fx = (o) => {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'money') st.money = Math.max(0, st.money + v);
        else if (k === 'gpa') st.stats.gpa = clamp(st.stats.gpa + v, 0, 4);
        else st.stats[k] = clamp((st.stats[k] || 0) + v, 0, 100);
      }
    };

    switch (p.kind) {
      case 'scene': {
        const opt = (p.options || []).find((o) => o.id === payload.optionId);
        if (!opt || opt.disabled) throw new Error(`ตัวเลือกไม่ถูกต้อง: ${payload.optionId}`);
        const r = EVENT_RESULTS[opt.id];
        if (r) { r.lines.forEach(([t, tone]) => say(t, tone)); fx(r.fx); } else say(`เลือก: ${opt.label}`);
        break;
      }
      case 'shop': {
        if (payload.skip || !payload.cart || !payload.cart.length) { say(p.mode === 'meal' ? 'ข้ามมื้อนี้ ประหยัดเงินแต่ท้องร้อง' : 'ไม่ได้ซื้ออะไร', p.mode === 'meal' ? 'bad' : 'neutral'); if (p.mode === 'meal') fx({ fullness: -5, energy: -4, health: -1 }); break; }
        let total = 0; let fill = 0;
        for (const line of payload.cart) {
          const shop = p.shops.find((s) => s.id === line.shopId);
          const it = shop && shop.items.find((i) => i.id === line.itemId);
          if (!it || !it.available) throw new Error(`ซื้อของไม่ได้: ${line.itemId}`);
          const qty = line.qty || 1;
          let unit = it.price;
          for (const opt of it.options || []) {
            const v = line.options && line.options[opt.key];
            const picks = Array.isArray(v) ? v : v != null ? [v] : [];
            for (const pv of picks) { const ch = opt.choices.find((c) => c.value === pv); if (ch) unit += ch.priceDelta; }
          }
          total += unit * qty; fill += it.fill * qty;
          say(`ซื้อ ${it.name}${qty > 1 ? ` x${qty}` : ''} ${unit * qty} บาท`);
        }
        if (total > st.money) throw new Error('เงินไม่พอ');
        fx({ money: -total, fullness: Math.round(fill / 2), energy: 3 + rng.int(0, 4), stress: -1 });
        break;
      }
      case 'classPlan': {
        const stance = payload.stance || 'normal';
        const skip = payload.skipPeriods || [];
        const k = { focus: { knowledge: 3, stress: 3, energy: -5 }, normal: { knowledge: 2, energy: -3 }, relax: { knowledge: 0, stress: -3, energy: -1 } }[stance];
        if (!k) throw new Error('stance ไม่ถูกต้อง');
        say(`เรียน${stance === 'focus' ? 'อย่างตั้งใจ' : stance === 'relax' ? 'แบบผ่อนๆ' : 'ตามปกติ'}${skip.length ? ` (ข้าม ${skip.length} คาบ)` : ''}`, skip.length ? 'bad' : 'neutral');
        fx(k);
        for (const l of payload.line || []) {
          const per = p.periods.find((x) => x.p === l.p);
          const it = per && per.lineShop && per.lineShop.items.find((i) => i.id === l.itemId);
          if (!it) continue;
          fx({ money: -it.price, fullness: 8 });
          if (rng.chance(0.3)) { say(`โดนครู${per.teacher ? per.teacher.name.replace('ครู', '') : ''}จับได้ว่ากินในคาบ`, 'bad'); fx({ teacherTrust: -8, stress: 6 }); } else say(`แอบกิน${it.name}ในคาบ ${l.p} รอดมาได้`, 'good');
        }
        if (skip.length) fx({ teacherTrust: -2 * skip.length, knowledge: -skip.length });
        break;
      }
      case 'plan': {
        const plan = payload.plan;
        if (!Array.isArray(plan) || plan.length !== p.slots) throw new Error('แผนต้องมีให้ครบทุกช่วง');
        const counts = {};
        plan.forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
        const label = (id) => (p.actions.find((a) => a.id === id) || { label: id }).label;
        say(`วางแผน: ${Object.entries(counts).map(([a, n]) => `${label(a)} x${n}`).join(', ')}`);
        fx({ knowledge: (counts.study_alone || 0) + (counts.study || 0), stress: -(counts.chat || 0) - (counts.rest || 0), energy: (counts.sleep || 0) * 2 });
        if (counts.call_parents || counts.family) { st.askCount = 0; }
        break;
      }
      case 'termStart': {
        const club = p.clubs.find((c) => c.id === payload.clubId);
        if (!club || club.seatsLeft <= 0) throw new Error('ชุมนุมนี้เต็มแล้ว');
        st.termChoice = { clubId: payload.clubId, electiveId: payload.electiveId };
        say(`ได้เข้าชุมนุม ${club.name}`, 'good');
        break;
      }
      case 'lineOrder': {
        for (const id of payload.cancel || []) st.orders = st.orders.filter((o) => o.id !== id);
        for (const itemId of payload.place || []) {
          const it = p.menu.find((m) => m.id === itemId);
          if (it) { st.orders.push({ id: `o${st.nextOrderId++}`, itemName: it.name, forDay: dayOf(st.step) + 2, status: 'waiting' }); say(`สั่ง ${it.name} ผ่าน LINE (จ่ายตอนรับของ)`); }
        }
        if (!(payload.place || []).length && !(payload.cancel || []).length) say('ไม่ได้สั่งของวันนี้');
        break;
      }
      default: throw new Error(`ไม่รู้จัก pending: ${p.kind}`);
    }

    // the world moves on a little every step
    fx({ fullness: -4 });
    if (st.stats.fullness < 15) fx({ health: -1 });
    st.step += 1;
    if (kOf(st.step) === 0 && st.step > FIRST_DAY_STEP) { st.stats.fullness = clamp(st.stats.fullness - 10, 0, 100); say('เริ่มวันใหม่', 'neutral'); }
    this.pending = this._build();
    return { log, pending: this.pending };
  }

  fastForward(stopKinds = ['scene', 'termStart'], maxSteps = 2000) {
    const log = [];
    let n = 0;
    while (n < maxSteps && !this.pending.final && !stopKinds.includes(this.pending.kind)) {
      const r = this.act(this.defaultPayload());
      log.push(...r.log);
      n += 1;
    }
    return { steps: n, log, pending: this.pending };
  }

  save() { return JSON.stringify(this.state); }
  debug() { return { engine: 'mock', step: this.state.step }; }
}

function toMin(hhmmStr) { const [h, m] = hhmmStr.split(':').map(Number); return h * 60 + m; }

export function createGame({ seed = 1, mode = 'routine' } = {}) {
  if (mode === 'detailed') { const g = new MockGame(freshState(seed)); g.state.mode = 'detailed'; return g; }
  return createRoutineMock(seed, mode);
}
export function loadGame(json) {
  const state = JSON.parse(json);
  if (state && state.mock === 'routine') return loadRoutineMock(state);
  if (!state || typeof state.step !== 'number' || !state.stats) throw new Error('ไฟล์เซฟไม่ใช่ของโหมดทดลอง');
  return new MockGame(state);
}
