// Mock of the routine-mode engine API (docs/CONTRACT2.md sections 1 and 2): canned but varied data so the UI
// can be built and played without the real engine. 1 school year = 252 days, 6 years, a few decisions a year.
// State is plain JSON; everything is deterministic from the seed.
import { Rng } from '../rng.js';
import { mockSpec } from './mock-activities.js';

export const DAYS_PER_YEAR = 252;
const DAYS_PER_TERM = 126;
const YEARS = 6;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const TEACHER_NAMES = ['มินท์', 'เอก', 'ฝน', 'บัว', 'ต้น', 'แพร'];
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const DOW = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const GRADE_ROOMS = [4, 4, 4, 6, 6, 6];
const ROOM_SIZE = [30, 30, 30, 20, 20, 20];

import { FOCUS_FIELDS, ROUTINE_DEFAULT } from './focus-data.js';
export { FOCUS_FIELDS, ROUTINE_DEFAULT };

const NAMES_M = ['ณัฐ', 'ต้นกล้า', 'ภูมิ', 'กวิน', 'ธีร์', 'ปัน'];
const NAMES_F = ['พิมพ์', 'ใบเตย', 'แพรว', 'มะปราง', 'ขวัญ', 'อุ้ม'];
const DORM_NAMES = ['หอพักจุฬาพิลาส', 'หอพักภูมิพัฒน์', 'หอพักสิรินธร'];

const ROUTINE_LINES = [
  ['เพื่อนในห้องชวนเล่นหมากรุกตอนพักเที่ยง คุณชนะไปหนึ่งตา', 'good'],
  ['ฝนตกหนักตอนเย็น ต้องวิ่งจากโรงอาหารกลับหอ', 'neutral'],
  ['ส่งงานวิทยาศาสตร์ทันเส้นตายแบบเฉียดฉิว', 'neutral'],
  ['เที่ยงนี้ไข่ดองหมดก่อนถึงคิวคุณ', 'bad'],
  ['ครูชมงานกลุ่มหน้าห้อง ทั้งกลุ่มยิ้มกันใหญ่', 'good'],
  ['ไฟหอดับตอนสองทุ่ม ทุกคนออกมานั่งเล่นหน้าห้อง', 'neutral'],
  ['หลับในคาบบ่ายครั้งหนึ่ง ครูแค่มองแล้วเดินผ่านไป', 'bad'],
  ['ได้ขนมจากเพื่อนร่วมห้องนอน แบ่งกันกินคนละครึ่ง', 'good'],
  ['คุณตื่นสายจนต้องวิ่งไปเข้าแถว', 'bad'],
  ['ซ้อมกีฬาสีตอนเย็น เหงื่อท่วมแต่สนุก', 'good'],
  ['โทรหาแม่สิบนาที เล่าเรื่องในห้องให้ฟัง', 'good'],
  ['คาบว่างได้นั่งอ่านการ์ตูนในห้องสมุดจนหมดชั่วโมง', 'neutral'],
];

const EVENTS = [
  () => ({
    title: 'เพื่อนขอยืมเงิน', text: 'ต้นกล้าเพื่อนห้องเดียวกันเดินมาหาตอนพักเย็น "ขอยืม 50 ได้ไหม พรุ่งนี้คืน" ใกล้สิ้นเดือนแล้ว ในกระเป๋าคุณเองก็ไม่ได้เยอะ',
    options: [
      { id: 'lend', label: 'ให้ยืม 50 บาท', sub: 'เพื่อนจะชอบคุณขึ้น แต่เงินหายไปก่อน', tone: 'good' },
      { id: 'refuse', label: 'ปฏิเสธ', sub: 'เก็บเงินไว้ แต่บรรยากาศอาจเงียบไปหน่อย', tone: 'bad' } ],
  }),
  () => ({
    title: 'ครูสลิ้งแตก', text: 'ครูวิทยาศาสตร์วางปากกาลงบนโต๊ะแรงๆ "งานที่สั่งไป ใครยังไม่ส่งยกมือ" ทั้งห้องเงียบ ตาครูมองมาทางแถวคุณ',
    card: { rows: [['วิชา', 'วิทยาศาสตร์'], ['ห้อง', '221'], ['งานค้าง', '1 ชิ้น']] },
    options: [
      { id: 'confess', label: 'ยกมือรับ แล้วขอส่งพรุ่งนี้', sub: 'ครูอาจเอ็ด แต่ความไว้ใจไม่หาย', tone: 'good' },
      { id: 'hide', label: 'นั่งนิ่งๆ', sub: 'เสี่ยงโดนเรียกชื่อ', tone: 'bad' } ],
  }),
  () => ({
    title: 'ผลสอบกลางภาค', text: 'ประกาศผลติดบอร์ดหน้าห้อง คุณยืนอ่านชื่อตัวเองในแถวที่เจ็ด',
    card: { rows: [['คณิตศาสตร์', '18 / 25'], ['ภาษาไทย', '21 / 25'], ['วิทยาศาสตร์', '15 / 25']] },
    options: [
      { id: 'tryharder', label: 'ถอนหายใจ แล้วตั้งใจใหม่', tone: 'good' },
      { id: 'dontcare', label: 'ช่างมัน', tone: 'bad' } ],
  }),
  () => ({
    title: 'ไข้หวัดระบาดในหอ', text: 'เพื่อนห้องข้างๆ ไอกันทั้งแถว พยาบาลเดินตรวจทุกห้อง คุณเริ่มคอแห้งนิดหน่อย',
    options: [
      { id: 'rest', label: 'ไปนอนพักที่ห้องพยาบาล', sub: 'ขาดเรียนหนึ่งวัน แต่หายไว', tone: 'good' },
      { id: 'push', label: 'ฝืนไปเรียนต่อ', sub: 'เสี่ยงป่วยหนัก', tone: 'bad' } ],
  }),
  () => ({
    title: 'ถูกล้อเรื่องชื่อเล่น', text: 'เพื่อนต่างห้องตั้งชื่อเล่นให้คุณใหม่และเรียกกันทั้งโรงอาหาร ทุกคนหัวเราะ',
    options: [
      { id: 'laugh', label: 'หัวเราะไปด้วย', sub: 'ถ้าไม่ซีเรียส เรื่องก็จบเร็ว', tone: 'good' },
      { id: 'angry', label: 'บอกให้เลิกเรียก', sub: 'อาจทะเลาะ', tone: 'bad' } ],
  }),
  () => ({
    title: 'ได้กลับบ้านสุดสัปดาห์', text: 'เลิกเรียนวันศุกร์ รถของพ่อมารอหน้าโรงเรียน นี่คือจุดบันทึกเกม มีเวลาพักสองวันก่อนกลับหอวันอาทิตย์',
    options: [
      { id: 'home', label: 'ขึ้นรถกลับบ้าน', sub: 'บันทึกเกมอัตโนมัติ', tone: 'good' } ],
  }),
];

const EVENT_FX = {
  lend: { lines: [['ให้เพื่อนยืมเงิน 50 บาท', 'good']], fx: { money: -50, bonds: 6 } },
  refuse: { lines: [['ปฏิเสธเพื่อน บรรยากาศเงียบไปครู่หนึ่ง', 'bad']], fx: { bonds: -3 } },
  confess: { lines: [['ครูเอ็ดสั้นๆ แต่ยอมให้ส่งพรุ่งนี้', 'good']], fx: { bonds: 3, happy: -3 } },
  hide: { lines: [['ครูเรียกชื่อคุณหน้าห้อง ทั้งห้องหันมามอง', 'bad']], fx: { bonds: -4, happy: -8 } },
  tryharder: { lines: [['ตั้งใจจะอ่านหนังสือมากขึ้น', 'good']], fx: { know: 4, happy: -2 } },
  dontcare: { lines: [['เก็บความรู้สึกไว้ในใจ แล้วเดินไปกินข้าว', 'bad']], fx: { happy: -3 } },
  rest: { lines: [['นอนพักที่ห้องพยาบาลหนึ่งวัน ไข้ลดลง', 'good']], fx: { health: 8, know: -1 } },
  push: { lines: [['ฝืนเรียนต่อ ไอไปทั้งคาบ', 'bad']], fx: { health: -10, happy: -4 } },
  laugh: { lines: [['หัวเราะไปกับเพื่อน เรื่องจบเร็วกว่าที่คิด', 'good']], fx: { bonds: 3 } },
  angry: { lines: [['พูดขึ้นเสียงกลางโรงอาหาร ทุกคนเงียบ', 'bad']], fx: { bonds: -5, happy: -5 } },
  home: { lines: [['ขึ้นรถกลับบ้าน นอนยาวสองวัน', 'good']], fx: { health: 6, happy: 8 } },
  ask: { lines: [['โทรขอเงินพ่อแม่ ได้มา 800 บาท', 'good']], fx: { money: 800, happy: -2 } },
  skipmeals: { lines: [['ประหยัดโดยข้ามมื้อเย็นไปหลายวัน', 'bad']], fx: { money: 300, health: -6 } },
  clubok: { lines: [], fx: {} },
};

// ---------- festival / hall / lab mini games (docs/CONTRACT3.md): which game, texts, results ----------
const SAT_SUBJECTS = ['คณิตศาสตร์เสริม', 'วิทยาศาสตร์เสริม', 'ภาษาอังกฤษเสริม', 'คอมพิวเตอร์เสริม'];
const MG_INFO = {
  hall_lecture: { game: 'watch', place: 'hall', title: 'บรรยายพิเศษในหอประชุม', text: 'วิทยากรขึ้นเวที ไฟในหอประชุมหรี่ลง เก้าอี้นุ่มจนเปลือกตาเริ่มหนัก', canSkip: true },
  hall_special: { game: 'watch', place: 'hall', title: 'วันสำคัญของโรงเรียน', text: 'ทั้งโรงเรียนนั่งรวมกันในหอประชุมเพื่อฟังเรื่องเล่าของวันนี้', canSkip: true },
  hall_award: { game: 'watch', place: 'hall', title: 'พิธีมอบรางวัลเกรด 4.00', text: 'เสียงปรบมือดังทั่วหอประชุม ผู้ที่ได้เกรด 4.00 ขึ้นรับรางวัลบนเวที' },
  hall_farewell: { game: 'watch', place: 'hall', title: 'ส่งครูท่านหนึ่ง', text: 'ครูท่านหนึ่งจะจากโรงเรียนไป ทั้งโรงเรียนมาร่วมกล่าวลาในหอประชุม' },
  fresher_hall: { game: 'watch', place: 'hall', title: 'รับน้อง: ฟังรุ่นพี่เล่าเรื่อง', text: 'ในหอประชุม รุ่นพี่ขึ้นเวทีเล่าเรื่องชีวิตในโรงเรียนประจำ' },
  fresher_craft: { game: 'pattern', place: 'hall', title: 'รับน้อง: ร้อยกำไลกับพี่', text: 'พี่ๆ แจกลูกปัดให้ทุกคนร้อยกำไลข้อมือเป็นของที่ระลึก' },
  fresher_dash: { game: 'dash', place: 'hall', title: 'รับน้อง: เกมแต่งตัวเร็ว', text: 'แข่งหยิบเสื้อผ้าตามลำดับที่พี่ๆ ประกาศ' },
  fresher_stall: { game: 'serve', place: 'hall', title: 'รับน้อง: เกมร้านค้าจำลอง', text: 'เล่นเป็นพ่อค้าแม่ค้า รับออร์เดอร์ให้ทันก่อนลูกค้าเดินหนี' },
  stall_setup: { game: 'dash', place: 'fair', title: 'งานลอยกระทง: จัดร้านให้ทัน', text: 'เช้าวันงาน หอพักของคุณต้องจัดร้านให้เสร็จก่อนบ่าย แข่งกันหยิบของขึ้นร้านตามลำดับ' },
  loy_stall: { game: 'serve', place: 'fair', title: 'งานลอยกระทง: ขายของ', text: 'ลูกค้าเริ่มต่อคิว ถึงตาคุณรับออร์เดอร์แล้ว' },
  krathong_creative: { game: 'craft', place: 'fair', kind: 'krathong', title: 'ประกวดกระทงสร้างสรรค์', text: 'ตกแต่งกระทงให้ตรงธีมของกรรมการ มีเวลาจำกัด' },
  dress_fast: { game: 'dash', place: 'fair', title: 'ประกวดแต่งตัวเร็ว', text: 'ผู้ประกาศอ่านลำดับเครื่องแต่งกาย แตะให้ถูกและให้เร็วที่สุด' },
  costume_beauty: { game: 'craft', place: 'fair', kind: 'costume', title: 'ประกวดชุดสวยงาม', text: 'เลือกชิ้นส่วนมาแต่งชุดให้ตรงธีม' },
  loy_float: { game: 'timing', place: 'fair', title: 'ลอยกระทง', text: 'ถือกระทงริมสระ รอจังหวะลมแล้วปล่อยให้ลอยออกไป' },
  show_act: { game: 'rhythm', place: 'stage', title: 'งานราตรี: แสดงบนเวที', text: 'ไฟเวทีสว่าง ได้เวลาของคุณแล้ว' },
  show_camera: { game: 'track', place: 'stage', mode: 'camera', title: 'งานราตรี: ถ่ายภาพ', text: 'ประคองกล้องให้นักแสดงอยู่ในกรอบตลอดการแสดง' },
  show_sound: { game: 'track', place: 'stage', mode: 'sound', title: 'งานราตรี: คุมเสียง', text: 'ดูแลเข็มระดับเสียงให้อยู่ในช่วงที่พอดี' },
  show_edit: { game: 'sequence', place: 'stage', title: 'งานราตรี: ตัดต่อวิดีโอ', text: 'เรียงคลิปให้เป็นเรื่องราวก่อนขึ้นจอใหญ่' },
  science_lab: { game: 'steps', place: 'lab', title: 'ทดลองในห้องปฏิบัติการ', text: 'ครูแจกใบงานการทดลอง ทำตามขั้นตอนให้ถูกต้องและปลอดภัย' },
  club_craft: { game: 'pattern', place: 'activity', title: 'ชุมนุม: ร้อยกำไลข้อมือ', text: 'วันนี้ชุมนุมนัดทำงานฝีมือ' },
};
MG_INFO.sport_sprint = { game: 'dash', place: 'activity', title: 'กีฬาสี: วิ่ง 100 เมตร', text: 'ยืนที่เส้นสตาร์ตในสีของคุณ ผู้ตัดสินยกธง' };
MG_INFO.sport_tug = { game: 'timing', place: 'activity', sport: true, title: 'กีฬาสี: ชักเย่อ', text: 'ทั้งสีจับเชือกเส้นเดียวกัน ออกแรงให้ตรงจังหวะกับสัญญาณ' };
MG_INFO.sport_cheer = { game: 'rhythm', place: 'activity', sport: true, title: 'กีฬาสี: เชียร์ลีดเดอร์', text: 'ทีมเชียร์ลีดเดอร์ของสีขึ้นลาน ถึงตาโชว์ท่าหลัก' };
MG_INFO.sport_stand = { game: 'rhythm', place: 'activity', sport: true, title: 'กีฬาสี: แสตนด์เชียร์', text: 'ทั้งสีนั่งแสตนด์ ยกการ์ดสตั๊นท์ตามจังหวะกลองให้ตรงกัน' };
MG_INFO.xmas_tree = { game: 'craft', place: 'hall', xmas: true, title: 'คริสต์มาส: ตกแต่งต้นไม้', text: 'เช้าวันคริสต์มาส ทั้งโรงเรียนช่วยกันประดับต้นคริสต์มาสต้นใหญ่' };
MG_INFO.xmas_catch = { game: 'timing', place: 'hall', xmas: true, title: 'คริสต์มาส: ปาร์ตี้ในหอประชุม', text: 'ซานต้าขึ้นเวทีแล้วโยนลูกอมลงมาให้ทั้งหอประชุม' };
const MG_RESULT = {
  sport_sprint: (sc) => ({ fx: { happy: 3, bonds: 3, energy: -5 }, log: `วิ่ง 100 เมตรให้สี ได้ที่ ${sc > 0.8 ? '1' : sc > 0.5 ? '3' : '5'} ในรอบนี้`, tone: sc > 0.5 ? 'good' : 'neutral' }),
  sport_tug: (sc) => ({ fx: { happy: 4, bonds: 4 }, log: 'ชักเย่อกับทั้งสี เสียงเชียร์ดังลั่นสนาม', tone: 'good' }),
  sport_cheer: (sc) => ({ fx: { happy: 4, bonds: 5 }, log: 'เต้นเชียร์ลีดเดอร์ท่าหลักให้สีได้ครบทุกจังหวะ', tone: 'good' }),
  sport_stand: (sc) => ({ fx: { happy: 3, bonds: 5 }, log: `ยกการ์ดสตั๊นท์ในแสตนด์สี ${sc > 0.6 ? 'ภาพออกมาเรียบร้อยสวยงาม' : 'มีบางแถวยกพลาด แต่ทุกคนหัวเราะ'}`, tone: 'good' }),
  xmas_tree: (sc) => ({ fx: { happy: 3, bonds: 2 }, log: 'ช่วยกันประดับต้นคริสต์มาสต้นใหญ่ในหอประชุม', tone: 'good' }),
  xmas_catch: (sc) => ({ fx: { happy: 4 }, log: sc > 0.6 ? 'รับลูกอมของซานต้าได้หลายเม็ด' : 'ลูกอมหล่นเกือบหมด รับได้แค่เม็ดเดียว', tone: 'good' }),
  hall_lecture: (sc) => ({ fx: { know: Math.round(sc * 3), happy: -2 }, log: sc > 0.6 ? 'นั่งฟังบรรยายจนจบ จำเรื่องที่ครูเล่าได้หลายอย่าง' : 'หลับในหอประชุมไปหลายรอบ ฟังไม่รู้เรื่อง', tone: sc > 0.6 ? 'good' : 'bad' }),
  hall_special: (sc) => ({ fx: { bonds: Math.round(sc * 2) }, log: 'นั่งฟังเรื่องเล่าของวันสำคัญจนจบ', tone: 'neutral' }),
  hall_award: (sc) => ({ fx: { happy: 2 }, log: 'ปรบมือให้เพื่อนที่ได้เกรด 4.00 ขึ้นรับรางวัล', tone: 'neutral' }),
  hall_farewell: (sc) => ({ fx: { bonds: 2 }, log: 'ร่วมกล่าวลาครูในหอประชุม', tone: 'neutral' }),
  fresher_hall: (sc) => ({ fx: { bonds: 2 }, log: 'ฟังรุ่นพี่เล่าเรื่องจนจบ ใจเริ่มคลายกังวล', tone: 'good' }),
  fresher_craft: (sc) => ({ fx: { bonds: 3, happy: 2 }, log: `ร้อยกำไลได้ ${Math.round(2 + sc * 8)} เม็ด ได้ของที่ระลึกจากรุ่นพี่`, tone: 'good' }),
  fresher_dash: (sc) => ({ fx: { bonds: 2, happy: 3 }, log: 'แข่งแต่งตัวเร็ว ทีมหัวเราะกันลั่น', tone: 'good' }),
  fresher_stall: (sc) => ({ fx: { bonds: 3 }, log: 'เล่นเกมร้านค้าจำลองกับเพื่อนใหม่', tone: 'good' }),
  stall_setup: (sc) => ({ fx: { bonds: 2, energy: -3 }, log: sc > 0.6 ? 'ช่วยหอจัดร้านเสร็จก่อนเวลา' : 'จัดร้านเสร็จช้ากว่าที่คิดแต่ทันเปิด', tone: 'good' }),
  loy_stall: (sc, st, o) => { const n = Math.round(4 + sc * 14); const pay = o && o.own ? Math.round(n * 12 - 150) : 30 + n * 5; return { fx: { money: pay, bonds: 2, happy: 3 }, log: o && o.own ? `ขายของในร้านตัวเองได้ ${n} จาน ${pay >= 0 ? 'กำไร' : 'ขาดทุน'} ${Math.abs(pay)} บาท` : `ช่วยร้าน${(o && o.stallName) || ''}ขายได้ ${n} จาน ได้ค่าแรง ${pay} บาท`, tone: pay >= 0 ? 'good' : 'bad' }; },
  krathong_creative: (sc) => ({ fx: { money: sc > 0.8 ? 100 : 0, happy: 3 }, log: `กระทงของคุณได้คะแนนประกวดสร้างสรรค์ ${Math.round(sc * 100)} เต็ม 100`, tone: sc > 0.65 ? 'good' : 'neutral' }),
  dress_fast: (sc) => ({ fx: { happy: 2, bonds: 1 }, log: `แข่งแต่งตัวเร็วได้อันดับ ${sc > 0.8 ? 'ต้นๆ' : sc > 0.5 ? 'กลางตาราง' : 'ท้ายๆ'}`, tone: sc > 0.5 ? 'good' : 'neutral' }),
  costume_beauty: (sc) => ({ fx: { happy: 3, bonds: 2 }, log: `ชุดของคุณได้คะแนนความงาม ${Math.round(sc * 100)} เต็ม 100`, tone: sc > 0.65 ? 'good' : 'neutral' }),
  loy_float: (sc) => ({ fx: { happy: 5 }, log: sc > 0.6 ? 'ปล่อยกระทงถูกจังหวะ ลอยออกไปไกลพร้อมแสงเทียน' : 'กระทงวนอยู่ริมสระครู่หนึ่งก่อนค่อยๆ ลอยไป', tone: 'good' }),
  show_act: (sc) => ({ fx: { bonds: 3, happy: 4 }, log: sc > 0.6 ? 'ขึ้นแสดงบนเวทีได้ดี เสียงปรบมือดังท้ายเพลง' : 'ลืมจังหวะไปบางช่วง แต่ก็แสดงจนจบ', tone: sc > 0.6 ? 'good' : 'neutral' }),
  show_camera: (sc) => ({ fx: { bonds: 2 }, log: 'ถ่ายภาพการแสดงจนจบ ได้รูปสวยหลายใบ', tone: 'good' }),
  show_sound: (sc) => ({ fx: { bonds: 2 }, log: 'คุมเสียงตลอดการแสดง ไม่มีเสียงแตกให้ได้ยิน', tone: 'good' }),
  show_edit: (sc) => ({ fx: { bonds: 2, know: 1 }, log: 'วิดีโอที่ตัดต่อฉายบนจอใหญ่ทั้งหอประชุม', tone: 'good' }),
  science_lab: (sc) => ({ fx: { know: Math.round(1 + sc * 4) }, log: sc > 0.6 ? 'ทำการทดลองสำเร็จ ผลตรงกับที่ครูบอก' : 'ผลการทดลองคลาดเคลื่อนไปนิด ครูให้ทำซ้ำที่บ้าน', tone: sc > 0.6 ? 'good' : 'neutral' }),
  club_craft: (sc) => ({ fx: { happy: 3, bonds: 1 }, log: `ร้อยกำไลข้อมือเสร็จ ${sc > 0.6 ? 'สวยจนเพื่อนขอไปใส่' : 'ลายเพี้ยนไปบ้างแต่ก็น่ารัก'}`, tone: 'good' }),
};
const SHOW_ROLES = [['act', 'แสดงบนเวที', 'show_act'], ['camera', 'ถ่ายภาพ', 'show_camera'], ['sound', 'คุมเสียง', 'show_sound'], ['edit', 'ตัดต่อวิดีโอ', 'show_edit']];

export function schoolMapFor(me) {
  return {
    grades: GRADE_ROOMS.map((n, i) => ({ grade: i + 1, rooms: Array.from({ length: n }, () => ROOM_SIZE[i]) })),
    meRoom: me ? { grade: me.grade, room: me.room } : null,
  };
}

function hash2(a, b) { return (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 0x7f4a7c15, 40503)) >>> 0; }

export function freshRoutineState(seed, mode = 'routine') {
  const rng = new Rng(seed);
  const male = rng.chance(0.5);
  const name = rng.pick(male ? NAMES_M : NAMES_F);
  const room = rng.int(1, 4);
  const tiers = ['normal', 'normal', 'normal', 'spoiled', 'rich'];
  const tier = rng.pick(tiers);
  const money = tier === 'rich' ? rng.int(10000, 20000) : tier === 'spoiled' ? rng.int(2000, 9000) : rng.int(800, 2000);
  return {
    mock: 'routine', mode, seed: seed >>> 0, d: 0, intro: true, queue: [], ended: false, askCount: 0, miniGames: 'play', satGroup: null, companion: null, partner: null, friends: mockFriends(rng, name), crush: crushDays(rng),
    routine: { ...ROUTINE_DEFAULT },
    me: {
      name, no: rng.int(1, 24), sex: male ? 'ชาย' : 'หญิง', trait: rng.chance(0.5) ? 'extrovert' : 'introvert', grade: 1, room, rank: 12, rankSize: 120,
      dormName: rng.pick(DORM_NAMES), dormRoom: `ห้อง ${rng.int(101, 320)}`, tier, startMoney: money,
      roommates: [rng.pick(NAMES_M) + 'ชัย', rng.pick(NAMES_F).replace(/.$/, '') + 'นภา'],
    },
    stats: { health: 82, happy: 68, know: 30, bonds: 40, gpa: 0, gpax: 0, money, energy: 70, stress: 22, fullness: 50 },
    gpas: [], hint: null, pending: null, record: [], termLog: [],
  };
}

const FRIEND_NAMES = ['ตั้ม', 'มิน', 'ปลาย', 'เฟิร์น', 'บอส', 'น้ำใส', 'กานต์', 'พลอย', 'ภูผา', 'ใหม่', 'ฟ้าใส', 'ไผ่'];
function mockFriends(rng, me) {
  return rng.shuffle(FRIEND_NAMES.filter((n) => n !== me).slice()).slice(0, 9).map((name, i) => ({ id: 1000 + i, name, grade: 1 + (i % 2), room: 1 + (i % 4), closeness: 70 - i * 6 + rng.int(0, 5) }));
}
// cj: a confession comes with probability 0.8 per 2-year window; its day is random in the window (?crush=N forces window 1 to day N, for UI checks)
function crushDays(rng) {
  const out = [0, 1, 2].map((w) => (rng.chance(0.8) ? rng.int(w * 504 + 20, w * 504 + 480) : null));
  try { const q = new URLSearchParams(location.search).get('crush'); if (/^\d+$/.test(q || '')) out[0] = Number(q); } catch { /* node */ }
  return out;
}
const MG_SCENES = new Set(['signup', 'ranking', 'who', 'stall', 'role', 'crush', 'crush2', 'santa', 'epidemic', 'exam_missed']);
const CRUSHERS = [['พิมพ์ชนก', 'หญิง'], ['กฤตภาส', 'ชาย'], ['ณิชา', 'หญิง'], ['ธีรวัฒน์', 'ชาย']];

export class RoutineMock {
  constructor(state) {
    this.state = state;
    this.pending = state.pending;
    this.buf = [];
    if (!this.pending && state.intro) this.pending = this._intro();
    state.pending = this.pending;
  }

  // ---------- helpers ----------
  _yearIdx() { return Math.min(YEARS - 1, Math.floor(this.state.d / DAYS_PER_YEAR)); }
  _label() { const s = this.state; return `ม.${this._yearIdx() + 1} เทอม ${Math.floor((s.d % DAYS_PER_YEAR) / DAYS_PER_TERM) + 1}`; }
  _say(text, tone = 'neutral') {
    const s = this.state;
    const line = { t: this._clockLabel(), text, tone, day: s.d + 1, yearLabel: `ม.${this._yearIdx() + 1}` };
    this.buf.push(line);
    s.record.push(line);
    if (s.record.length > 200) s.record.shift();
  }
  _clockLabel() { const s = this.state; return `วัน${DOW[(s.d % 7) + 1]} ${hhmm(6 * 60 + 30)}`; }
  _fx(fx) {
    const st = this.state.stats;
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'money') st.money = Math.max(0, st.money + v);
      else st[k] = clamp((st[k] || 0) + v, 0, 100);
    }
  }
  _mk(extra) { const s = this.state; s.pid = (s.pid || 0) + 1; return { id: s.pid, clock: this._clockLabel(), ...extra }; }

  _intro() {
    const m = this.state.me;
    return this._mk({
      kind: 'scene', tag: 'intro', title: 'เด็กใหม่ ม.1',
      text: 'เราเป็น 1 ใน 720 คนของโรงเรียนประจำแห่งนี้ ชีวิตหกปีเริ่มต้นวันนี้',
      card: { rows: [
        ['เพศ', m.sex], ['นิสัย', m.trait === 'extrovert' ? 'ชอบเข้าสังคม' : 'ชอบอยู่เงียบๆ'], ['ห้องเรียน', `ม.1/${m.room}`],
        ['ครอบครัว', { normal: 'ครอบครัวปกติ', spoiled: 'พ่อแม่ตามใจ', rich: 'พ่อแม่รวยมาก' }[m.tier]],
        ['เงินวันแรก', `${m.startMoney.toLocaleString('en-US')} บาท`], ['ค่าขนมรายเดือน', '4,200 บาท'],
        ['หอพัก', `${m.dormName} ${m.dormRoom}`], ['เพื่อนร่วมห้องนอน', m.roommates.join(', ')] ] },
      options: [{ id: 'start', label: 'เริ่มชีวิตที่โรงเรียน' }],
    });
  }

  _satGroups() {
    const g = this.state.me.grade || 1;
    return ['A', 'B', 'C', 'D'].map((id, gi) => ({ id, name: `กลุ่ม ${id}`, subjects: Array.from({ length: 4 }, (_, k) => { const n = SAT_SUBJECTS[(gi + k + g) % SAT_SUBJECTS.length]; return { name: `${n} ม.${g}`, short: n.replace('เสริม', '') }; }) }));
  }
  _satBlocks(rng) {
    const s = this.state; const id = s.satGroup;
    const slots = [['08:30', '09:15'], ['09:20', '10:05'], ['10:10', '10:55'], ['11:00', '11:45']];
    const T = (from, to, place, placeKind, what, type, extra) => ({ from, to, minute: toMin(from), place, placeKind, what, type, ...extra });
    if (!id || id === 'club') return slots.map(([a, b], k) => T(a, b, 'ห้องชุมนุม', 'activity', k === 0 ? 'ชุมนุมวันเสาร์ (ชิลๆ)' : 'ชุมนุมวันเสาร์ ต่อ', 'sat', { club: true }));
    const grp = this._satGroups().find((x) => x.id === id) || this._satGroups()[0];
    return slots.map(([a, b], k) => T(a, b, `ห้อง ${rng.pick(['218', '213', '232'])}`, 'classroom', `เรียนวันเสาร์ ${grp.name}: ${grp.subjects[k].short}`, 'sat'));
  }

  _termStart() {
    return this._mk({
      kind: 'termStart', title: 'เลือกชุมนุมและวิชาเลือก',
      text: 'ต้นภาคเรียน เลือกชุมนุมวันอังคาร และวิชา พก. 1 วิชา ที่นั่งมีจำกัด',
      clubs: [
        { id: 'thai-music', name: 'ดนตรีไทย', seatsLeft: 4, studentRun: false },
        { id: 'math-goal', name: 'คณิตศาสตร์เพื่อเป้าหมาย', seatsLeft: 7, studentRun: false },
        { id: 'english-fun', name: 'English for fun', seatsLeft: 0, studentRun: true },
        { id: 'sci-exercise', name: 'วิทยาศาสตร์การออกกำลังกาย', seatsLeft: 2, studentRun: false } ],
      electives: [
        { id: 'el-multimedia', name: 'มัลติมีเดียเบื้องต้น', area: 'คอมพิวเตอร์' },
        { id: 'el-math-game', name: 'คณิตศาสตร์ในเกมกระดาน', area: 'คณิตศาสตร์' },
        { id: 'el-sci-kitchen', name: 'วิทย์ในครัว', area: 'วิทยาศาสตร์' } ],
      needElective: true,
      satGroups: this._satGroups(),
      ...(this.state.partner ? { hint: 'มีแฟนอยู่: ถ้าไม่เน้นเรียนเกรดจะตก ลองตั้งโฟกัสเป็นเน้นเรียน' } : {}),
      ...(this.state.lastTerm ? { canKeep: true, previous: { ...this.state.lastTerm } } : {}),
    });
  }

  _focus() {
    const s = this.state;
    return this._mk({
      kind: 'focus', title: 'โฟกัสของเทอมนี้',
      text: 'ตั้งกิจวัตรของเทอมนี้ โรงเรียนจะเดินไปเองตามที่ตั้งไว้ และหยุดถามเมื่อมีเรื่องสำคัญ เปลี่ยนได้ทุกเมื่อ',
      fields: FOCUS_FIELDS.map((f) => ({ ...f, choices: f.choices.map((c) => ({ ...c })) })),
      current: { ...s.routine }, hint: [s.hint, s.partner ? 'มีแฟนอยู่: ถ้าไม่เน้นเรียนเกรดจะตก' : null].filter(Boolean).join('\n') || undefined,
    });
  }

  _setPending(p) { this.state.pending = p; this.pending = p; return p; }

  // ---------- the day as blocks (CONTRACT2 5.1) ----------
  _subjects() { return ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'ภาษาอังกฤษ', 'สังคมศึกษา', 'พลศึกษา', 'คอมพิวเตอร์']; }
  _plan(d) {
    const dow = (d % 7) + 1;
    const rng = new Rng(hash2(this.state.seed, d + 99));
    const T = (from, to, place, placeKind, what, type, extra) => ({ from, to, minute: toMin(from), place, placeKind, what, type, ...extra });
    const dInYear = d % DAYS_PER_YEAR; const term = Math.floor(dInYear / DAYS_PER_TERM); const dt = dInYear % DAYS_PER_TERM;
    const cyc = Math.floor(dt / 14); const dc = d % 14; const yearIdx = Math.floor(d / DAYS_PER_YEAR);
    const ent = this.state.sportsEntered || [];
    const sportsDay = term === 0 && dt === 75 && dow === 6; const standFri = term === 0 && dt === 74;
    const xmasDay = term === 1 && cyc === 3 && dc === 2 && dow <= 5; // CONTRACT3 section 11: Christmas in term 2, cycle 4
    const xmasHit = xmasDay && new Rng(hash2(this.state.seed, d * 13 + 7)).chance(0.3); // cj: 30% hit by Santa's candy
    const lunchW = T('12:00', '13:00', 'โรงอาหาร', 'canteen', 'มื้อกลางวัน', 'meal', { meal: 'lunch' });
    if (dow >= 6) {
      const home = Math.floor(d / 7) % 2 === 1;
      if (home) return [
        T('09:00', '11:30', 'บ้าน', 'home', 'ตื่นสายที่บ้าน', 'home'), T('12:00', '13:00', 'บ้าน', 'home', 'กินข้าวกับครอบครัว', 'meal', { meal: 'lunch' }),
        T('13:30', '17:00', 'บ้าน', 'home', 'พักผ่อนช่วงบ่าย', 'home'), T('18:00', '21:00', 'บ้าน', 'home', 'ค่ำที่บ้าน', 'home'), T('22:00', '23:59', 'บ้าน', 'home', 'นอน', 'sleep'),
      ];
      if (dow === 6 && term === 1 && dt === 19) return [ // Loy Krathong fair (CONTRACT3 section 11: term 2, cycle 2, mid November)
        T('08:30', '11:30', 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: ช่วยหอจัดร้าน', 'fair', { mgs: [['mg', 'stall_setup']] }), lunchW,
        T('14:00', '17:00', 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: ไปกับใคร เลือกร้านที่จะช่วย', 'fair', { mgs: [['sc', 'who']] }),
        T('18:00', '22:00', 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: ประกวดและลอยกระทง', 'fair', { mgs: [['mg', 'krathong_creative'], ['mg', 'dress_fast'], ['mg', 'costume_beauty'], ['mg', 'loy_float']] }),
        T('22:00', '23:59', 'หอพัก', 'dorm', 'นอน', 'sleep'),
      ];
      if (sportsDay) return [
        T('08:30', '11:30', 'สนามกีฬา', 'field', ent.length ? 'กีฬาสี: แข่งรอบแรกให้สี' : 'กีฬาสี: นั่งเชียร์สีในแสตนด์', 'fair', { mgs: ent.filter((e) => e !== 'stand').map((e) => ['mg', `sport_${e}`]) }), lunchW,
        T('14:00', '17:00', 'สนามกีฬา', 'field', 'กีฬาสี: รอบชิงและประกาศผลคะแนนสี', 'fair', { mgs: [...(ent.includes('stand') ? [['mg', 'sport_stand']] : []), ['sc', 'ranking']] }),
        T('19:00', '22:00', 'ห้องอ่านหนังสือ หอพัก', 'dormStudy', 'ค่ำที่หอ', 'evening'), T('22:00', '23:59', 'หอพัก', 'dorm', 'นอน', 'sleep')];
      const sat = dow === 6 ? this._satBlocks(rng) : [T('08:30', '11:30', 'หอพัก', 'dorm', 'เช้าวันหยุดที่หอ', 'free')];
      const night = dow === 6 && term === 1 && dt === 103;
      return [...sat, lunchW,
        T('14:00', '17:00', 'สนามกีฬา', 'field', 'บ่ายวันหยุด', 'free'),
        night ? T('18:30', '21:30', 'เวทีหอประชุม', 'stage', 'งานราตรี: ส่งรุ่นพี่', 'show', { mgs: [['sc', 'role']] }) : T('19:00', '22:00', 'ห้องอ่านหนังสือ หอพัก', 'dormStudy', 'ค่ำที่หอ', 'evening'),
        T('22:00', '23:59', 'หอพัก', 'dorm', 'นอน', 'sleep'),
      ];
    }
    const subj = this._subjects();
    const cls = (from, to, i) => {
      const nm = subj[(i + d * 3 + dow) % subj.length];
      const kind = nm === 'พลศึกษา' ? 'field' : nm === 'คอมพิวเตอร์' ? 'computer' : nm === 'วิทยาศาสตร์' ? 'lab' : 'classroom';
      const place = kind === 'field' ? 'สนาม 2' : kind === 'computer' ? 'COM 2' : kind === 'lab' ? `ห้อง ${rng.pick(['221', '223'])}` : `ห้อง ${rng.pick(['218', '213', '232', '242'])}`;
      return T(from, to, place, kind, `${nm} กับครู${TEACHER_NAMES[(i + d) % TEACHER_NAMES.length]}`, 'class', { subject: nm });
    };
    const list = [
      T('06:30', '07:00', 'หอพัก', 'dorm', 'ตื่นนอน', 'wake'), T('07:00', '07:30', 'โรงอาหาร', 'canteen', 'มื้อเช้า', 'meal', { meal: 'breakfast' }),
      T('07:45', '08:30', 'ลานหน้าอาคารเรียน', 'activity', dow === 2 ? 'เข้าแถวและโฮมรูม' : 'เข้าแถวและโฮมรูม', 'activity'),
      cls('08:30', '09:20', 0), cls('09:20', '10:10', 1), cls('10:20', '11:10', 2), cls('11:10', '12:00', 3),
      T('12:00', '13:00', 'โรงอาหาร', 'canteen', 'มื้อกลางวัน', 'meal', { meal: 'lunch' }),
      cls('13:00', '13:50', 4), cls('13:50', '14:40', 5),
      dow === 2 ? T('14:50', '15:40', 'ห้องชุมนุม', 'activity', 'ชุมนุมวันอังคาร', 'activity') : cls('14:50', '15:40', 6),
      T('15:40', '18:00', rng.chance(0.5) ? 'สนามกีฬา' : 'สหกรณ์โรงเรียน', rng.chance(0.5) ? 'field' : 'coop', 'เวลาว่างหลังเลิกเรียน', 'free'),
      T('18:00', '18:45', 'โรงอาหาร', 'canteen', 'มื้อเย็น', 'meal', { meal: 'dinner' }),
      T('19:00', '22:00', 'ห้องอ่านหนังสือ หอพัก', 'dormStudy', 'ค่ำที่หอ', 'evening'), T('22:00', '23:59', 'หอพัก', 'dorm', 'นอน', 'sleep'),
    ];
    const swap = (from, blk) => { const i = list.findIndex((x) => x.from === from); if (i >= 0) list[i] = blk; };
    const drop = (...froms) => froms.forEach((f) => { const i = list.findIndex((x) => x.from === f); if (i >= 0) list.splice(i, 1); });
    const hall = (from, to, what, ev, extra) => T(from, to, 'หอประชุม', 'hall', what, 'hall', { mgs: [['mg', ev]], ...extra });
    if (this._epi(d).suspended) {
      return [T('06:30', '07:00', 'หอพัก', 'dorm', 'ตื่นนอน', 'wake'), T('08:30', '11:30', 'หอพัก', 'dorm', 'หยุดเรียน: พักที่หอ', 'free'), lunchW,
        T('14:00', '17:00', 'หอพัก', 'dorm', 'หยุดเรียน: นอนพักและอ่านหนังสือเบาๆ', 'free'), T('19:00', '22:00', 'หอพัก', 'dormStudy', 'ค่ำที่หอ', 'evening'), T('22:00', '23:59', 'หอพัก', 'dorm', 'นอน', 'sleep')];
    }
    if (term === 0 && cyc === 2 && dc === 0) swap('15:40', T('15:40', '18:00', 'ลานหน้าอาคารเรียน', 'activity', 'กีฬาสี: รับสมัครลงแข่ง', 'free', { mgs: [['sc', 'signup']] }));
    if (term === 0 && ent.length && ((cyc === 3 && [1, 2, 3].includes(dc)) || (cyc === 4 && [2, 3, 4].includes(dc)))) swap('15:40', T('15:40', '18:00', 'สนามกีฬา', 'field', `ฝึกซ้อมกีฬาสี ${this._color().th}`, 'free', { detail: 'ซ้อมกับเพื่อนในสีเดียวกันจนเหงื่อซก' }));
    if (standFri) { swap('13:00', T('13:00', '15:40', 'สนามกีฬา', 'field', 'กีฬาสี: พาเหรดและแสตนด์เชียร์', 'fair', { mgs: ent.includes('stand') ? [['mg', 'sport_stand']] : [] })); drop('13:50', '14:50'); }
    if (xmasDay) {
      swap('08:30', hall('08:30', '10:10', 'คริสต์มาส: ประดับต้นไม้ในหอประชุม', 'xmas_tree')); drop('09:20');
      swap('10:20', T('10:20', '12:00', 'หอประชุม', 'hall', 'คริสต์มาส: ปาร์ตี้ซานต้าในหอประชุม', 'hall', { mgs: [['mg', 'xmas_catch'], ['sc', 'santa']] })); drop('11:10');
      if (xmasHit) swap('13:00', T('13:00', '14:40', 'ห้องพยาบาล', 'infirmary', 'พักที่ห้องพยาบาลหลังโดนลูกอมซานต้า', 'free', { detail: 'พยาบาลประคบเย็นให้ แล้วให้นอนพักหนึ่งคาบ' })); if (xmasHit) drop('13:50');
    } else if (cyc === 2 && dc === 2) { swap('13:00', hall('13:00', '14:40', 'บรรยายพิเศษในหอประชุม', 'hall_lecture')); drop('13:50'); }
    else if (cyc === 6 && dc === 9) { swap('13:00', hall('13:00', '14:40', 'วันสำคัญ: ฟังบรรยายในหอประชุม', 'hall_special')); drop('13:50'); }
    else if (term === 0 && cyc === 7 && dc === 9) { swap('13:00', hall('13:00', '14:40', 'ส่งครูในหอประชุม', 'hall_farewell')); drop('13:50'); }
    else if (cyc === 3 && dc === 3) swap('09:20', T('09:20', '10:10', 'ห้องปฏิบัติการวิทยาศาสตร์', 'lab', 'ทดลองวิทยาศาสตร์ในห้องแล็บ', 'class', { subject: 'วิทยาศาสตร์', mgs: [['mg', 'science_lab']] }));
    else if (cyc === 4 && dc === 1) swap('14:50', T('14:50', '15:40', 'ห้องชุมนุม', 'activity', 'ชุมนุมวันอังคาร: งานฝีมือ', 'activity', { mgs: [['mg', 'club_craft']] }));
    if (dt === 123) swap('14:50', hall('14:40', '15:40', 'รับรางวัลเกรด 4.00 ในหอประชุม', 'hall_award'));
    if ((yearIdx === 0 || yearIdx === 3) && dInYear < 3) {
      const FR = [[['fresher_hall', 'รับน้อง: ฟังรุ่นพี่เล่าเรื่อง'], ['fresher_craft', 'รับน้อง: ร้อยกำไลกับพี่']], [['fresher_dash', 'รับน้อง: เกมแต่งตัวเร็ว'], ['sc', 'who']], [['fresher_hall', 'รับน้อง: ฟังรุ่นพี่เล่าเรื่อง'], ['fresher_dash', 'รับน้อง: เกมแต่งตัวเร็ว']]][dInYear];
      const mk = (from, to, [ev, what]) => (ev === 'sc' ? hall(from, to, 'รับน้อง: เกมร้านค้าจำลองกับเพื่อน', 'fresher_stall') : hall(from, to, what, ev));
      swap('08:30', mk('08:30', '11:30', FR[0])); drop('09:20', '10:20', '11:10');
      swap('13:00', mk('13:00', '15:40', FR[1])); drop('13:50', '14:50');
    }
    return list;
  }

  _acc() {
    const s = this.state;
    const mk = () => ({ spent: 0, sleep: 0, nights: 0, classes: 0, snacks: 0, d0: s.d, h0: s.stats.happy, m0: s.stats.money });
    s.accW = s.accW || mk(); s.accT = s.accT || mk(); s.accY = s.accY || mk();
    return [s.accW, s.accT, s.accY];
  }

  _drift(frac, rng) {
    const s = this.state; const r = s.routine; const st = s.stats;
    const dk = { focus: 0.075, normal: 0.045, relax: 0.015 }[r.study] + (r.evening === 'study' ? 0.03 : 0);
    const sportDrag = (s.sportsEntered || []).length ? (r.study === 'focus' ? 0.95 : 0.9) : 1; // cj: registered for sports day -> less reading
    const drag = (s.partner ? (r.study === 'focus' ? 0.97 : 0.85) : 1) * sportDrag; // cj: a relationship lowers study unless the focus is study
    st.know = clamp(st.know + dk * drag * frac * (1 - st.know / 95), 0, 100);
    const tHealth = 76 + { rest: 10, balanced: 3, social: 0, study: -8 }[r.evening] + { cheap: -4, normal: 0, treat: 3 }[r.food] + (r.study === 'focus' ? -4 : 0);
    const tHappy = 62 + { social: 12, balanced: 4, rest: 6, study: -10 }[r.evening] + { relax: 6, normal: 0, focus: -8 }[r.study] + { often: 4, sometimes: 1, none: 0 }[r.snack] + (r.food === 'treat' ? 3 : 0);
    const tBonds = 45 + (s.partner ? 8 : 0) + { social: 25, balanced: 10, rest: 2, study: -8 }[r.evening];
    st.health = clamp(st.health + (tHealth - st.health) * 0.015 * frac + rng.gauss() * 0.2 * frac, 0, 100);
    st.happy = clamp(st.happy + (tHappy - st.happy) * 0.015 * frac + rng.gauss() * 0.3 * frac, 0, 100);
    st.bonds = clamp(st.bonds + (tBonds - st.bonds) * 0.012 * frac, 0, 100);
    st.energy = clamp(60 + st.health * 0.2 + rng.gauss() * 2, 0, 100);
    st.stress = clamp(100 - st.happy + (r.study === 'focus' ? 8 : 0), 0, 100);
  }

  _runBlock(t, rng, plan) {
    const s = this.state; const r = s.routine; const st = s.stats;
    const accs = this._acc();
    let detail = ''; let tone = 'neutral'; let spend = 0; const tags = [];
    const study = { focus: 'ตั้งใจเรียน จดละเอียด', normal: 'เรียนตามปกติ', relax: 'นั่งฟังเรื่อยๆ ใจลอยบ้าง' }[r.study];
    if (t.type === 'wake') detail = st.health > 70 ? 'ตื่นมาสดชื่น พับผ้าห่มแล้วรีบอาบน้ำ' : 'ง่วงจนต้องกดนาฬิกาปลุกซ้ำ';
    else if (t.type === 'meal') {
      const cost = { cheap: 90, normal: 135, treat: 190 }[r.food];
      const share = { breakfast: 0.25, lunch: 0.4, dinner: 0.35 }[t.meal];
      spend = t.placeKind === 'home' ? 0 : Math.round((cost * share * (0.85 + rng.float() * 0.3)) / 5) * 5;
      const menu = { breakfast: ['ข้าวต้มหมู', 'โจ๊กหมู', 'ไข่ลวกกับขนมปัง'], lunch: ['ข้าวมันไก่', 'ข้าวกะเพราไข่ดาว', 'ก๋วยเตี๋ยวเรือ'], dinner: ['ข้าวผัดกุ้ง', 'หม่าล่าถัง', 'ข้าวหมูทอด'] }[t.meal];
      detail = spend ? `ซื้อ${rng.pick(menu)} ${spend} บาท` : 'กินข้าวฝีมือแม่ ไม่ต้องจ่ายเงิน';
    } else if (t.type === 'class') {
      detail = study;
      accs.forEach((a) => { a.classes += 1; });
      if (r.snack !== 'none' && t.placeKind === 'lab' && rng.chance(r.snack === 'often' ? 0.6 : 0.25)) {
        spend = rng.pick([15, 20, 25]); tags.push('lineShop'); accs.forEach((a) => { a.snacks += 1; });
        detail = `${study} แอบกินไข่ดองจากร้านมิ้ว ${spend} บาท`;
        if (rng.chance(0.1)) { tone = 'bad'; tags.push('teacherSnap'); detail += ' โดนครูจับได้'; this._say('โดนครูจับได้ว่ากินขนมในคาบ ถูกเรียกชื่อกลางห้อง', 'bad'); this._fx({ happy: -6, bonds: -2 }); }
      }
    } else if (t.type === 'activity') detail = t.what.startsWith('ชุมนุม') ? 'ทำกิจกรรมกับเพื่อนในชุมนุม' : 'ยืนเข้าแถว ฟังประกาศหน้าเสาธง';
    else if (t.type === 'free') {
      if (t.placeKind === 'coop') { spend = rng.pick([0, 15, 30, 45]); detail = spend ? `แวะสหกรณ์ ซื้อของใช้ ${spend} บาท` : 'ดูของในสหกรณ์ ไม่ได้ซื้ออะไร'; }
      else detail = { social: 'เล่นกับเพื่อนจนเหงื่อซก', study: 'นั่งทำการบ้านที่ม้านั่งข้างสนาม', rest: 'เดินเล่นช้าๆ นั่งพัก', balanced: 'เตะบอลกับเพื่อนพักใหญ่' }[r.evening];
    } else if (t.type === 'evening') detail = { study: 'อ่านหนังสือเงียบๆ จนเกือบไฟดับ', balanced: 'อ่านหนังสือครึ่งหนึ่ง คุยกับเพื่อนอีกครึ่ง', social: 'คุยกับเพื่อนร่วมห้องนอนเสียงดังจนโดนเตือน', rest: 'อาบน้ำ ฟังเพลง แล้วเตรียมนอนเร็ว' }[r.evening];
    else if (t.type === 'home') detail = t.what === 'ตื่นสายที่บ้าน' ? 'นอนยาวจนแม่มาเรียก' : 'อยู่กับครอบครัว ไม่ต้องรีบทำอะไร';
    else if (t.type === 'sat') detail = t.club ? 'นั่งเล่นชิลๆ ในชุมนุมวันเสาร์ ไม่มีการบ้าน' : 'ตั้งใจเรียนคาบเสาร์ในกลุ่มที่เลือก';
    else if (t.mgs) detail = 'กำลังเริ่มกิจกรรม';
    else if (t.type === 'sleep') {
      const hrs = { study: 6, balanced: 7.2, social: 6.8, rest: 8.3 }[r.evening] + (rng.float() - 0.5) * 0.8;
      accs.forEach((a) => { a.sleep += hrs; a.nights += 1; });
      detail = `หลับไปราว ${hrs.toFixed(1)} ชั่วโมง`;
    }
    if (spend) { st.money = Math.max(0, st.money - spend); accs.forEach((a) => { a.spent += spend; }); }
    this._drift(1 / plan.length, rng);
    if (t.type !== 'sleep' && t.type !== 'meal' && rng.chance(0.07)) { const l = rng.pick(ROUTINE_LINES); this._say(l[0], l[1]); tone = l[1]; }
    return { detail, tone, spend, tags };
  }

  stepBlock() {
    const s = this.state;
    const none = { dayEnded: false, weekEnded: false, termEnded: false, yearEnded: false };
    this.buf = [];
    if (this.pending || s.ended) return { ok: true, done: !!s.ended, block: null, log: [], pending: this.pending, ...none };
    s.recap = null;
    const plan = this._plan(s.d);
    const i = s.blk || 0;
    const t = plan[i];
    const rng = new Rng(hash2(s.seed, s.d * 40 + i + 5));
    const r = this._runBlock(t, rng, plan);
    s.today = s.today || [];
    s.today.push({ detail: r.detail, tone: r.tone });
    s.blk = i + 1;
    const block = { id: `d${s.d}b${i}`, from: t.from, to: t.to, minute: t.minute, place: t.place, placeKind: t.placeKind, what: t.what, detail: r.detail, tone: r.tone, spend: r.spend, fx: {}, tags: r.tags };
    const flags = { ...none };
    if (t.mgs && t.mgs.length) {
      block.tags.push('minigame');
      s.queue = t.mgs.map(([k, ev]) => `${k}:${ev}:${i}`).concat(s.queue);
      if (!this.pending) this._next();
    }
    if (s.evt && s.evt.at === i && !this.pending) { const p = s.evt.pending; p.clock = `วัน${DOW[(s.d % 7) + 1]} ${t.from}`; s.evt = null; this._setPending(p); }
    if (s.blk >= plan.length) this._endDay(flags);
    return { ok: true, done: !!s.ended, block, log: this.buf, pending: this.pending, ...flags };
  }

  _endDay(flags) {
    const s = this.state; const st = s.stats;
    const rng = new Rng(hash2(s.seed, s.d));
    flags.dayEnded = true;
    s.d += 1; s.blk = 0; s.today = [];
    const di = s.d % DAYS_PER_YEAR;
    if (s.d % 30 === 0) { st.money += 4200; this._say('เงินค่าขนมประจำเดือนเข้าแล้ว', 'good'); }
    let special = false;
    if (s.d >= YEARS * DAYS_PER_YEAR) { this._ending(true); flags.yearEnded = true; special = true; }
    else if (di === 0) { this._yearEnd(); flags.yearEnded = true; special = true; }
    else if (di % DAYS_PER_TERM === 0) { this._termEnd(); s.queue.push('termStart', 'focus'); this._next(); flags.termEnded = true; special = true; }
    else if (st.money < 40 && !s.moneyAsked) { s.moneyAsked = true; this._setPending(this._moneyEmergency()); special = true; }
    if (st.money > 400) s.moneyAsked = false;
    if (s.d % 7 === 0 && !flags.yearEnded && !flags.termEnded) flags.weekEnded = true;
    if (flags.yearEnded) s.recap = this._recap('year', s.accY);
    else if (flags.termEnded) s.recap = this._recap('term', s.accT);
    else if (flags.weekEnded) s.recap = this._recap('week', s.accW);
    if (flags.weekEnded || flags.termEnded || flags.yearEnded) { s.accW = null; if (flags.termEnded || flags.yearEnded) s.accT = null; if (flags.yearEnded) s.accY = null; this._acc(); }
    const plan2 = this._plan(s.d);
    const mgDay = plan2.some((x) => x.mgs);
    const w = Math.floor(s.d / 504);
    const dY = s.d % DAYS_PER_YEAR; const yi = Math.floor(s.d / DAYS_PER_YEAR);
    if (!special && !mgDay && yi % 2 === 0 && dY === 66) s.evt = { at: 1, pending: this._mk({ kind: 'scene', tag: 'epidemic', title: 'โรงเรียนประกาศหยุดเรียน', text: 'ไข้หวัดใหญ่ระบาดในหอพักและห้องเรียน เด็กป่วยเกินหนึ่งในสี่ของโรงเรียน ครูใหญ่ประกาศหยุดเรียนสี่วัน ให้พักอยู่ที่หอหรือกลับบ้าน', card: { rows: [['โรค', 'ไข้หวัดใหญ่'], ['นักเรียนป่วย', '27%'], ['หยุดเรียน', '4 วัน']] }, options: [{ id: 'ok', label: 'รับทราบ พักที่หอ', tone: 'good' }] }) };
    else if (!special && !mgDay && yi % 2 === 0 && dY === 63) s.evt = { at: 2, pending: this._mk({ kind: 'scene', tag: 'exam_missed', title: 'ขาดสอบเพราะป่วย', text: 'เช้านี้คุณมีไข้สูงจนลุกไม่ไหว ห้องพยาบาลไม่อนุญาตให้เข้าสอบ คะแนนสอบวิชานี้นับเพียงบางส่วนและไม่มีสอบซ่อม', card: { rows: [['วิชา', 'วิทยาศาสตร์'], ['คะแนนที่นับ', '40% ของที่ควรได้']] }, options: [{ id: 'ok', label: 'รับทราบ', tone: 'bad' }] }) };
    else if (!special && !mgDay && s.crush && s.crush[w] === s.d) s.evt = { at: 5, pending: this._crushScene(false) };
    else if (!special && !mgDay && s.crushAgain && s.crushAgain.d === s.d) { s.evt = { at: 5, pending: this._crushScene(true) }; s.crushAgain = null; }
    else if (!special && !mgDay && !s.evt && rng.chance(1 / 34)) s.evt = { at: rng.int(3, 11), pending: this._event(rng) };
  }

  _recap(kind, a) {
    const s = this.state; const st = s.stats;
    const days = Math.max(1, s.d - a.d0);
    const wk = Math.floor(((s.d - 1) % DAYS_PER_YEAR % DAYS_PER_TERM) / 7) + 1;
    const label = kind === 'week' ? `สัปดาห์ที่ ${wk} · ${this._labelAt(s.d - 1)}` : kind === 'term' ? `สรุปเทอม · ${this._labelAt(s.d - 1)}` : `สรุปปีการศึกษา ม.${Math.max(1, Math.min(6, Math.floor((s.d - 1) / DAYS_PER_YEAR) + 1))}`;
    const lines = s.record.filter((l) => l.day > a.d0 && l.tone !== 'neutral').slice(-5).map((l) => l.text);
    const generic = ['อาทิตย์นี้ผ่านไปเรื่อยๆ ไม่มีอะไรหวือหวา', 'ได้กินข้าวครบทุกมื้อ', 'เพื่อนร่วมห้องนอนยังคุยกันเสียงดังเหมือนเดิม'];
    const highlights = [...lines, ...generic].slice(0, Math.max(3, lines.length));
    const sleepAvg = a.nights ? Math.round((a.sleep / a.nights) * 10) / 10 : 0;
    const dh = st.happy - a.h0;
    const rows = [['เงินที่ใช้', `${Math.round(a.spent).toLocaleString('en-US')} บาท`], ['เงินคงเหลือ', `${Math.round(st.money).toLocaleString('en-US')} บาท`], ['เข้าเรียน', `${a.classes} คาบ`], ['นอนเฉลี่ย', `${sleepAvg} ชม.`], ['ขนมใน LINE', `${a.snacks} ครั้ง`]];
    const rc = { kind, label, rows, highlights, money: { spent: Math.round(a.spent), left: Math.round(st.money), perDay: Math.round(a.spent / days) }, sleepAvg, classesAttended: a.classes, snacks: a.snacks, mood: dh > 1.5 ? 'up' : dh < -1.5 ? 'down' : 'flat' };
    if (kind !== 'week') { rc.gpa = Math.round(st.gpa * 100) / 100; rows.push(['เกรดเทอมนี้', st.gpa.toFixed(2)], ['เกรดสะสม', st.gpax.toFixed(2)]); }
    if (kind === 'year' && s.report) { rc.rank = `${s.report.rank} จาก ${s.report.size}`; rc.roomNext = s.report.room; rows.push(['อันดับในชั้น', rc.rank], ['ห้องปีหน้า', rc.roomNext]); }
    return rc;
  }
  _labelAt(d) { return `ม.${Math.min(6, Math.floor(d / DAYS_PER_YEAR) + 1)} เทอม ${Math.floor((d % DAYS_PER_YEAR) / DAYS_PER_TERM) + 1}`; }

  _event(rng) {
    const mk = rng.pick(EVENTS)();
    const p = this._mk({ kind: 'scene', tag: 'event', title: mk.title, text: mk.text, options: mk.options });
    if (mk.card) p.card = mk.card;
    return p;
  }

  _moneyEmergency() {
    return this._mk({
      kind: 'scene', tag: 'money', title: 'เงินในกระเป๋าเกือบหมด', text: 'เหลือเงินติดตัวไม่ถึงสี่สิบบาท ทั้งที่ยังไม่ถึงวันที่ค่าขนมเข้า',
      options: [
        { id: 'ask', label: 'โทรขอเงินพ่อแม่', sub: 'ได้ราว 800 บาท แต่ถูกบ่นนิดหน่อย', tone: 'good' },
        { id: 'skipmeals', label: 'ประหยัดโดยข้ามมื้อเย็น', sub: 'ได้เงินคืนบ้าง แต่สุขภาพเสีย', tone: 'bad' } ],
    });
  }

  _termEnd() {
    const s = this.state;
    const g = clamp(1 + s.stats.know / 100 * 3 + (s.stats.happy - 50) / 100, 0, 4);
    s.gpas.push(g);
    s.stats.gpa = g;
    s.stats.gpax = s.gpas.reduce((a, b) => a + b, 0) / s.gpas.length;
    s.hint = g >= 3.2 ? `เทอมที่แล้วไปได้ดี เกรด ${g.toFixed(2)}` : g < 2.2 ? `เทอมที่แล้วเกรดตก ${g.toFixed(2)} ลองตั้งใจเรียนมากขึ้น` : `เทอมที่แล้วเกรด ${g.toFixed(2)}`;
    this._say(`ผลสอบปลายภาคออกแล้ว เกรดเทอมนี้ ${g.toFixed(2)}`, g >= 3 ? 'good' : g < 2.2 ? 'bad' : 'neutral');
  }

  _next() {
    const s = this.state;
    const k = s.queue.shift();
    if (typeof k === 'string' && (k.startsWith('mg:') || k.startsWith('sc:'))) {
      const [kind, a, b] = k.split(':'); const blk = Number(k.split(':').pop());
      if (kind === 'mg') {
        const ev = a;
        if (s.miniGames === 'auto') { this._autoMg(ev, blk); this._next(); return; }
        this._setPending(this._mgPending(ev, blk)); return;
      }
      const sp = this._sceneFor(a, blk);
      if (!sp) { this._next(); return; }
      if (s.miniGames === 'auto') { const o = sp.options.find((x) => !x.disabled); this._sceneChoice(sp, o.id); this._next(); return; }
      this._setPending(sp); return;
    }
    if (k === 'termStart') this._setPending(this._termStart());
    else if (k === 'focus') this._setPending(this._focus());
    else if (k && k.startsWith('scene:')) this._setPending(this._reportOrGate(k));
    else this._setPending(null);
  }

  _yearEnd() {
    const s = this.state;
    this._termEnd();
    const y = this._yearIdx(); // new year index (already incremented)
    const done = y; // number of finished years
    const know = s.stats.know;
    const size = GRADE_ROOMS[done - 1] * ROOM_SIZE[done - 1];
    const rank = clamp(Math.round(size * (1 - (know + (s.stats.gpax - 2) * 8 + 10) / 130)), 1, size);
    s.me.rank = rank; s.me.rankSize = size;
    const nextGrade = Math.min(6, done + 1);
    const rooms = GRADE_ROOMS[nextGrade - 1];
    s.me.grade = nextGrade;
    s.me.room = clamp(Math.ceil((rank / size) * rooms), 1, rooms);
    s.report = { year: done, rank, size, room: `ม.${nextGrade}/${s.me.room}`, gpax: s.stats.gpax };
    if (done === 3) s.queue.push('scene:gate');
    s.queue.unshift('scene:report');
    s.queue.push('termStart', 'focus');
    this._next();
  }

  _reportOrGate(k) {
    const s = this.state;
    const r = s.report;
    if (k === 'scene:gate') {
      const pass = Math.min(0.97, 0.08 + s.stats.know / 100 * 0.95 + (s.stats.gpax - 2) * 0.1);
      const rng = new Rng(hash2(s.seed, 777));
      s.gatePass = rng.chance(pass);
      return this._mk({
        kind: 'scene', tag: 'gate', title: 'ประตูขึ้น ม.4',
        text: 'ผลจับสลากและเกณฑ์เกรดออกแล้ว ใครไม่ผ่านต้องย้ายไปเรียนที่อื่น',
        card: { rows: [['เกรดเฉลี่ยสะสม', s.stats.gpax.toFixed(2)], ['โอกาสผ่านประตู', `${Math.round(pass * 100)}%`]] },
        options: [{ id: s.gatePass ? 'gate-pass' : 'gate-fail', label: s.gatePass ? 'ดูผลประกาศ' : 'ดูผลประกาศ', tone: 'neutral' }],
      });
    }
    return this._mk({
      kind: 'scene', tag: 'report', title: `สรุปปี ม.${r.year}`,
      text: r.year >= 6 ? 'ปีสุดท้ายผ่านไปแล้ว' : `ปีการศึกษาจบลง ห้องใหม่ของคุณคือ ${r.room}`,
      card: { rows: [['เกรดเฉลี่ยสะสม', r.gpax.toFixed(2)], ['อันดับในชั้น', `${r.rank} จาก ${r.size}`], ['ห้องปีหน้า', r.room], ['เงินคงเหลือ', `${Math.round(s.stats.money).toLocaleString('en-US')} บาท`]] },
      options: [{ id: 'next-year', label: `ขึ้น ม.${Math.min(6, r.year + 1)}`, tone: 'good' }],
    });
  }

  _ending(graduated) {
    const s = this.state;
    s.ended = true;
    const y = this._yearIdx() + 1;
    this._termEnd();
    this._setPending(this._mk({
      kind: 'scene', tag: 'ending', final: true,
      title: graduated ? 'จบ ม.6 แล้ว' : `ออกจากโรงเรียนตอน ม.${Math.min(3, y)}`,
      text: graduated ? 'หกปีผ่านไปเร็วกว่าที่คิด วันรับประกาศนียบัตร เพื่อนร่วมห้องนอนกอดคอกันถ่ายรูป' : 'คุณไม่ผ่านประตูขึ้น ม.4 และต้องย้ายไปเรียนต่อที่อื่น เรื่องราวในโรงเรียนนี้จบลงตรงนี้',
      card: { rows: [['เกรดเฉลี่ยสะสม', s.stats.gpax.toFixed(2)], ['อันดับสุดท้าย', `${s.me.rank} จาก ${s.me.rankSize}`], ['เงินคงเหลือ', `${Math.round(s.stats.money).toLocaleString('en-US')} บาท`]] },
      options: [],
    }));
  }

  // ---------- mini games, scenes between them, confession (CONTRACT3 sections 4 and 10) ----------
  setMiniGames(mode) {
    if (mode !== 'play' && mode !== 'auto') return { ok: false, error: 'โหมดมินิเกมต้องเป็น play หรือ auto' };
    this.state.miniGames = mode;
    return { ok: true, miniGames: mode };
  }
  _mgPending(ev, blk) {
    const s = this.state; const info = MG_INFO[ev] || MG_INFO.hall_special;
    s.mgN = (s.mgN || 0) + 1;
    const seed = hash2(s.seed, s.mgN * 131 + s.d);
    const difficulty = Math.round(clamp(0.6 - s.stats.health / 400 - s.stats.know / 500, 0.15, 0.7) * 100) / 100;
    const over = s.mgOver && s.mgOver.ev === ev ? s.mgOver : {};
    const sp = mockSpec(info.game, seed, { difficulty, kind: info.kind, mode: info.mode, own: over.own, stallName: over.stallName, xmas: info.xmas });
    const who = s.companion ? s.companion.name : undefined;
    return this._mk({
      kind: 'minigame', clock: this._clockAt(blk), tag: ev, game: info.game, title: info.title, text: info.text, seed, difficulty, durationSec: sp.durationSec, params: sp.params,
      canSkip: !!info.canSkip, ...(info.canSkip ? { skipLabel: 'แอบหนีไปนอน' } : {}),
      context: { eventId: ev, stage: 0, blk, ...(who ? { who } : {}), ...(over.own ? { own: true } : {}), ...(over.stallName ? { stallName: over.stallName } : {}) }, placeKind: info.place,
    });
  }
  _clockAt(blk) {
    const s = this.state; const t = this._plan(s.d)[blk];
    return t ? `วัน${DOW[(s.d % 7) + 1]} ${t.from}` : this._clockLabel();
  }
  // a mock outbreak in the first term of every other year (CONTRACT3 section 11): days 56-74 of the year, classes closed on 66, 67, 70, 71
  _epi(d) {
    const y = Math.floor(d / DAYS_PER_YEAR); const di = d % DAYS_PER_YEAR;
    if (y % 2 !== 0 || di < 56 || di > 74) return { active: false, suspended: false, share: 0 };
    const share = di <= 66 ? 0.02 + (di - 56) * 0.025 : Math.max(0.03, 0.27 - (di - 67) * 0.03);
    return { active: true, suspended: [66, 67, 70, 71].includes(di), share };
  }
  // cj: colours go by the student number in order, 1 red, 2 yellow, 3 purple, 4 blue, 5 red ...
  _color() { const no = this.state.me.no || 1; const c = [['red', 'แดง'], ['yellow', 'เหลือง'], ['purple', 'ม่วง'], ['blue', 'ฟ้า']][(no - 1) % 4]; return { id: c[0], th: `สี${c[1]}` }; }
  _setDetail(blk, text) { const s = this.state; if (s.today && s.today[blk]) s.today[blk].detail = text; }
  _finishMg(ctxo, score, auto) {
    const s = this.state; const ev = ctxo.eventId; const R = MG_RESULT[ev] || MG_RESULT.hall_special;
    const sc = clamp(Number(score) || 0, 0, 1);
    const o = R(sc, s.stats, ctxo);
    this._fx(o.fx);
    let text = o.log;
    if (ev === 'loy_float' && ctxo.who) { text = `ลอยกระทงกับ${ctxo.who} ${o.log}`; const f = (s.friends || []).find((x) => x.name === ctxo.who); if (f) f.closeness = Math.min(100, f.closeness + 4); }
    this._say(`${auto ? 'เล่นอัตโนมัติ: ' : ''}${text}`, o.tone);
    this._setDetail(ctxo.blk, text);
    if (ev === 'loy_float') s.companion = null;
  }
  _autoMg(ev, blk) {
    const s = this.state; const rng = new Rng(hash2(s.seed, s.d * 977 + blk));
    this._finishMg({ eventId: ev, blk, who: s.companion ? s.companion.name : undefined }, clamp(0.62 + rng.gauss() * 0.1, 0.2, 0.95), true);
  }
  _actMg(p, payload) {
    const s = this.state; const c = p.context || {};
    if (payload.skip) {
      if (!p.canSkip) throw new Error('ข้ามมินิเกมนี้ไม่ได้');
      const rng = new Rng(hash2(s.seed, s.d * 31 + (c.blk || 0)));
      if (rng.chance(0.5)) { // cj: 50% you are caught and made to go anyway, trust with teachers drops
        this._say('โดนครูจับได้ว่าแอบหนีออกจากหอประชุม ต้องกลับไปนั่งฟังต่อ ครูไว้ใจน้อยลง', 'bad'); this._fx({ bonds: -3 });
        const q = { ...p, canSkip: false, text: 'ครูเดินมาเจอตอนคุณกำลังแอบหนี ต้องกลับไปนั่งฟังต่อให้จบ' }; delete q.id; delete q.clock; delete q.skipLabel;
        this._setPending(this._mk(q));
        return;
      }
      this._say('แอบไปนอนที่หอสำเร็จ ไม่มีใครรู้', 'good'); this._fx({ happy: 3, know: -1 }); this._setDetail(c.blk, 'แอบหนีไปนอนที่หอ');
      this._next(); return;
    }
    this._finishMg(c, payload.score, !!payload.auto);
    this._next();
  }
  _sceneFor(kind, blk) {
    const s = this.state;
    if (kind === 'who') {
      const fr = [...s.friends].sort((a, b) => b.closeness - a.closeness).slice(0, 4);
      const opts = [];
      if (s.partner) opts.push({ id: 'with:partner', label: `ไปกับ${s.partner.name} (แฟน)`, sub: 'ใกล้ชิดกันมากขึ้น', tone: 'good' });
      fr.forEach((f) => opts.push({ id: `with:${f.id}`, label: `ไปกับ${f.name}`, sub: `ม.${f.grade}/${f.room} สนิท ${f.closeness}`, tone: 'good' }));
      opts.push({ id: 'alone', label: 'เดินคนเดียว', sub: 'สบายๆ อาจได้เจอคนใหม่' }, { id: 'group', label: 'ไปกับห้อง/หอ', sub: 'ไปรวมกลุ่มใหญ่' });
      return this._mk({ kind: 'scene', clock: this._clockAt(blk), tag: 'who', title: 'ไปงานกับใคร', text: 'บ่ายแล้ว งานเริ่มคึกคัก ใครจะเดินไปด้วยกัน', options: opts, blk });
    }
    if (kind === 'stall') {
      const own = s.stats.money >= 200;
      return this._mk({
        kind: 'scene', clock: this._clockAt(blk), tag: 'stall', title: 'เลือกร้านที่จะช่วย', text: 'มีร้านของครูและของหอพักหลายร้านอยากได้คนช่วย หรือจะเปิดร้านเองก็ได้', blk,
        options: [
          { id: 'work:ครูเอก', label: 'ช่วยร้านครูเอก', sub: 'ค่าแรงจานละ 5 บาท ครูจะจำหน้าได้', tone: 'good' },
          { id: 'work:หอพักภูมิพัฒน์', label: 'ช่วยร้านหอพักภูมิพัฒน์', sub: 'เหนื่อยกว่า แต่เพื่อนๆ สนุก' },
          { id: 'own', label: 'เปิดร้านของตัวเอง ลงทุน 150 บาท', sub: 'ลูกค้ามากกว่า เสี่ยงขาดทุน', disabled: !own, reason: own ? undefined : 'เงินไม่พอ' },
          { id: 'wander', label: 'เดินเที่ยวซื้อของกิน', sub: 'ใช้เงินราว 60 บาท' }] });
    }
    if (kind === 'signup') {
      const c = this._color();
      return this._mk({ kind: 'scene', clock: this._clockAt(blk), tag: 'signup', title: 'รับสมัครกีฬาสี', text: `ปีนี้คุณอยู่ ${c.th} (ตามเลขที่ ${s.me.no}) สีเลือกเองไม่ได้ ลงได้สูงสุดสองรายการ ถ้าลงแข่งเวลาอ่านหนังสือจะลด แต่เพื่อนในสีจะสนิทกันมากขึ้น`,
        card: { rows: [['สี', c.th], ['เลขที่', String(s.me.no)], ['ลงได้', 'ไม่เกิน 2 รายการ']] },
        options: [{ id: 'none', label: 'ไม่ลงเลย', sub: 'อ่านหนังสือเต็มที่ แล้วไปนั่งเชียร์' }, { id: 'sprint', label: 'วิ่ง 100 เมตร', sub: 'ซ้อมหลังเลิกเรียน เวลาอ่านหนังสือลดลง', tone: 'good' }, { id: 'cheer', label: 'เชียร์ลีดเดอร์', sub: 'ซ้อมเต้นกับทีมสี สนิทกับเพื่อนมากขึ้น', tone: 'good' }, { id: 'both', label: 'วิ่ง 100 เมตร และแสตนด์เชียร์', sub: 'ลงสองรายการ เวลาอ่านหนังสือลดมากที่สุด', tone: 'bad' }], blk });
    }
    if (kind === 'ranking') {
      const rng = new Rng(hash2(s.seed, s.d * 5 + 1)); const mine = this._color();
      const base = [['red', 'สีแดง'], ['yellow', 'สีเหลือง'], ['purple', 'สีม่วง'], ['blue', 'สีฟ้า']].map(([id, th]) => ({ id, th, pts: 70 + rng.int(0, 30) + (id === mine.id ? (s.sportsEntered || []).length * 6 : 0) }));
      s.sportsRanking = base.map((x) => ({ ...x })).sort((a, b) => b.pts - a.pts);
      return this._mk({ kind: 'scene', clock: this._clockAt(blk), tag: 'ranking', title: 'ผลคะแนนกีฬาสี', text: `คะแนนรวมของทั้งสี่สีทั้งโรงเรียน สีที่ได้ที่หนึ่งคือ ${s.sportsRanking[0].th}`,
        card: { rows: base.map((x) => [x.th, `${x.pts} คะแนน`]) }, options: [{ id: 'ok', label: 'ปรบมือให้ทุกสี', tone: 'good' }], blk });
    }
    if (kind === 'santa') {
      if (!new Rng(hash2(s.seed, s.d * 13 + 7)).chance(0.3)) return null;
      return this._mk({ kind: 'scene', clock: this._clockAt(blk), tag: 'santa', title: 'ลูกอมของซานต้าลงหัวเรา', text: 'ซานต้าโยนลูกอมลงมาเต็มหอประชุม เม็ดหนึ่งกระเด้งใส่หัวคุณเข้าเต็มๆ เพื่อนรอบข้างหัวเราะลั่น ครูพาคุณไปห้องพยาบาลให้ประคบเย็น',
        options: [{ id: 'ok', label: 'ไปห้องพยาบาล' }], blk });
    }
    // role
    const y = Math.floor(s.d / DAYS_PER_YEAR);
    const roles = SHOW_ROLES.map((_, i) => SHOW_ROLES[(i + y) % SHOW_ROLES.length]);
    return this._mk({ kind: 'scene', clock: this._clockAt(blk), tag: 'role', title: 'งานราตรี: เลือกหน้าที่', text: 'คืนนี้เป็นงานส่งรุ่นพี่ที่กำลังจะจบ เลือกว่าจะช่วยงานด้านไหน', blk,
      options: [...roles.map(([id, label]) => ({ id: `role:${id}`, label, tone: 'good' })), { id: 'role:none', label: 'นั่งดูเฉยๆ', sub: 'ไม่ต้องรับผิดชอบอะไร' }] });
  }
  _sceneChoice(p, id) {
    const s = this.state; const blk = p.blk;
    if (p.tag === 'who') {
      let who = null;
      if (id === 'with:partner') who = s.partner;
      else if (id.startsWith('with:')) who = s.friends.find((f) => String(f.id) === id.slice(5));
      if (who) { s.companion = { id: who.id, name: who.name }; this._say(`ไปงานกับ${who.name}`, 'good'); this._fx({ bonds: 2, happy: 3 }); const f = s.friends.find((x) => x.id === who.id); if (f) f.closeness = Math.min(100, f.closeness + 5); }
      else { s.companion = null; this._say(id === 'alone' ? 'เดินเล่นในงานคนเดียว สบายใจดี' : 'ไปงานกับเพื่อนในหอเป็นกลุ่มใหญ่', 'neutral'); this._fx({ happy: id === 'alone' ? 3 : 2, bonds: id === 'alone' ? 0 : 2 }); }
      this._setDetail(blk, who ? `ลอยกระทงกับ${who.name}` : 'ไปงานโดยไม่มีใครเป็นพิเศษ');
      s.queue.unshift(`sc:stall:${blk}`);
    } else if (p.tag === 'stall') {
      if (id === 'wander') { this._say('เดินเที่ยวซื้อของกินรอบงาน', 'good'); this._fx({ money: -60, happy: 4 }); }
      else {
        s.mgOver = { ev: 'loy_stall', own: id === 'own', stallName: id.startsWith('work:') ? `ร้าน${id.slice(5)}` : 'ร้านของเรา' };
        if (id === 'own') this._fx({ money: -150 });
        s.queue.unshift(`mg:loy_stall:${blk}`);
      }
    } else if (p.tag === 'role') {
      const r = SHOW_ROLES.find(([rid]) => `role:${rid}` === id);
      if (r) s.queue.unshift(`mg:${r[2]}:${blk}`); else { this._say('นั่งดูการแสดงของรุ่นพี่จนจบ', 'good'); this._fx({ bonds: 2, happy: 3 }); }
    } else if (p.tag === 'signup') {
      s.sportsEntered = id === 'sprint' ? ['sprint'] : id === 'cheer' ? ['cheer'] : id === 'both' ? ['sprint', 'stand'] : [];
      this._say(s.sportsEntered.length ? `ลงแข่งกีฬาสี ${this._color().th} ${s.sportsEntered.length} รายการ` : 'ไม่ลงแข่งกีฬาสี จะไปนั่งเชียร์', 'neutral');
    } else if (p.tag === 'ranking') {
      const top = (s.sportsRanking || [])[0]; const mine = this._color();
      this._say(`ผลกีฬาสี ${top ? top.th : ''}ได้ที่ 1 ${top && top.id === mine.id ? 'สีของคุณชนะ ทั้งสีดีใจกัน' : `${mine.th}ได้ที่ ${1 + (s.sportsRanking || []).findIndex((x) => x.id === mine.id)}`}`, top && top.id === mine.id ? 'good' : 'neutral');
      this._fx({ happy: top && top.id === mine.id ? 6 : 2, bonds: s.sportsEntered && s.sportsEntered.length ? 5 : 2 });
      s.sportsEntered = [];
    } else if (p.tag === 'santa') { this._say('โดนลูกอมซานต้าลงหัว พยาบาลประคบเย็นให้ มีเพื่อนมาเยี่ยมที่ห้องพยาบาล อีกสามคนในหอประชุมโดนเหมือนกัน', 'neutral'); this._fx({ health: -3, happy: 2, bonds: 2 }); this._setDetail(blk, 'พักที่ห้องพยาบาลหลังโดนลูกอมซานต้า');
    } else if (p.tag === 'epidemic') { this._say('โรงเรียนประกาศหยุดเรียนเพราะไข้หวัดใหญ่ระบาด', 'neutral'); this._fx({ happy: 3 });
    } else if (p.tag === 'exam_missed') { this._say('ขาดสอบเพราะป่วย ไม่มีสอบซ่อม คะแนนนับเพียงบางส่วน', 'bad'); this._fx({ know: -2, happy: -5 });
    } else if (p.tag === 'crush' || p.tag === 'crush2') {
      const who = p.card.person;
      if (id === 'accept') {
        s.partner = { id: who.id, name: who.name, since: s.d, closeness: 40 };
        if (!s.friends.some((f) => f.id === who.id)) s.friends.push({ id: who.id, name: who.name, grade: who.grade, room: who.room, closeness: 40 });
        this._say(`ตกลงเป็นแฟนกับ${who.name} เพื่อนและครูดูจะใจดีกับคุณขึ้น`, 'good'); this._fx({ bonds: 6, happy: 8 });
      } else if (id === 'time') { s.crushAgain = { d: s.d + 10, who }; this._say(`ขอเวลาคิดเรื่อง${who.name}`, 'neutral'); }
      else { this._say(`ปฏิเสธ${who.name}อย่างนุ่มนวล ขอเป็นเพื่อนกัน`, 'neutral'); this._fx({ happy: -2 }); }
    }
  }
  _crushScene(again) {
    const s = this.state;
    const rng = new Rng(hash2(s.seed, s.d * 17 + 3));
    const who = again && s.crushAgain ? s.crushAgain.who : (() => {
      const [name, sex] = rng.pick(CRUSHERS); return { id: 5000 + s.d, name, sex, grade: Math.min(6, s.me.grade + rng.int(-1, 1) || 1), room: rng.int(1, 4), closeness: 20 };
    })();
    const opts = [{ id: 'accept', label: 'ตกลง', sub: 'เพื่อนและครูจะสนิทกับคุณขึ้น แต่การเรียนจะลด ต้องกดเน้นเรียน', tone: 'good' }, { id: 'decline', label: 'ขอเป็นเพื่อนกัน', sub: 'ปฏิเสธอย่างนุ่มนวล' }];
    if (!again) opts.push({ id: 'time', label: 'ขอเวลาคิด', sub: 'เรื่องนี้จะกลับมาอีกครั้งในอีกสิบวัน' });
    return this._mk({ kind: 'scene', tag: again ? 'crush2' : 'crush', title: again ? `${who.name} ถามอีกครั้ง` : 'มีคนมาบอกชอบ',
      text: again ? `สิบวันผ่านไป ${who.name} เดินมาหาคุณหลังเลิกเรียน "คิดดูแล้วหรือยัง"` : `${who.name} ยื่นโน้ตให้คุณหน้าหอพัก ข้อความสั้นๆ ว่าชอบคุณมานานแล้ว หัวใจคุณเต้นแรงกว่าตอนสอบเสียอีก`,
      card: { person: { id: who.id, name: who.name, grade: who.grade, room: who.room, closeness: who.closeness }, rows: [['ชั้น', `ม.${who.grade}/${who.room}`]] }, options: opts });
  }

  // ---------- public API ----------
  setRoutine(partial) {
    const s = this.state;
    for (const f of FOCUS_FIELDS) {
      const v = partial && partial[f.key];
      if (v != null && f.choices.some((c) => c.value === v)) s.routine[f.key] = v;
    }
    return { ...s.routine };
  }

  advance({ days = 1, untilDecision = true } = {}) {
    let ran = 0; let log = [];
    const s = this.state;
    while (ran < days && !this.pending && !s.ended) {
      const r = this.stepBlock();
      log = log.concat(r.log);
      if (r.dayEnded) ran += 1;
      if (untilDecision && this.pending) break;
    }
    return { ok: true, days: ran, log, pending: this.pending, progress: this._progress() };
  }

  _progress() {
    const s = this.state;
    const dayInYear = s.d % DAYS_PER_YEAR;
    return {
      yearIndex: this._yearIdx(), termIndex: Math.floor(dayInYear / DAYS_PER_TERM), dayInYear, daysInYear: DAYS_PER_YEAR,
      fraction: Math.min(1, s.d / (YEARS * DAYS_PER_YEAR)),
    };
  }

  view() {
    const s = this.state;
    const me = s.me;
    const dow = (s.d % 7) + 1;
    const st = s.stats;
    const plan = this._plan(s.d);
    const bi = Math.min(s.blk || 0, plan.length - 1);
    const minute = plan[bi].minute;
    const day = {
      label: `วัน${DOW[dow]}ที่ ${s.d + 1}`, dow, schoolDay: dow <= 5,
      blocks: plan.map((t, i) => ({ from: t.from, to: t.to, place: t.place, placeKind: t.placeKind, what: t.what, ...(i < (s.blk || 0) && s.today && s.today[i] ? { detail: s.today[i].detail } : {}), done: i < (s.blk || 0), current: i === (s.blk || 0) })),
    };
    return {
      day, recap: s.recap || null, miniGames: s.miniGames || 'play',
      epidemic: (() => { const e = this._epi(s.d); return e.active ? { name: 'ไข้หวัดใหญ่', sickShare: Math.round(e.share * 100) / 100, suspended: e.suspended } : null; })(),
      friends: [...(s.friends || [])].sort((a, b) => b.closeness - a.closeness).slice(0, 8).map((f) => ({ ...f, partner: !!(s.partner && s.partner.id === f.id) })),
      clock: { label: `วัน${DOW[dow]} ${hhmm(minute)}`, year: this._yearIdx() + 1, term: Math.floor((s.d % DAYS_PER_YEAR) / DAYS_PER_TERM) + 1, cycle: Math.floor(s.d / 14) % 9 + 1, day: s.d + 1, dow, minute, dayInCycle: s.d % 14 + 1, schoolDay: dow <= 5 },
      place: plan[bi].place,
      me: { name: me.name, sex: me.sex, trait: me.trait, grade: me.grade, room: me.room, rank: me.rank, rankSize: me.rankSize, dormName: me.dormName, dormRoom: me.dormRoom, tier: me.tier, partner: s.partner ? { ...s.partner } : null, color: this._color() },
      sports: { color: this._color(), entered: [...(s.sportsEntered || [])], ranking: s.sportsRanking || null },
      stats: { gpa: st.gpa, gpax: st.gpax, health: st.health, energy: st.energy, stress: st.stress, fullness: st.fullness, knowledge: st.know, peer: st.bonds, teacherTrust: st.bonds, money: Math.round(st.money) },
      statMax: 100, today: [], askParents: { available: true, nextAmount: 80 }, notes: ['ใช้ข้อมูลทดลอง (mock) ไม่ใช่เอนจินจริง'],
      routine: { ...s.routine }, progress: this._progress(), label: this._label(),
      stats4: { health: Math.round(st.health), happy: Math.round(st.happy), know: Math.round(st.know), bonds: Math.round(st.bonds) },
      record: s.record.slice(-200),
      birth: {
        regNo: `720-${2569}-${String(100 + (s.seed % 900)).padStart(6, '0')}`,
        sentence: `ในเดือนพฤษภาคม 2569 คุณก้าวเข้าประตูโรงเรียนประจำแห่งหนึ่งในฐานะ${me.sex === 'ชาย' ? 'เด็กชาย' : 'เด็กหญิง'}ชั้น ม.1/${me.room} คุณเป็นหนึ่งใน 720 คน และต้องอยู่ที่นี่หกปีเต็ม ตั้งแต่วันนี้จนถึงวันรับประกาศนียบัตร`,
      },
      schoolMap: schoolMapFor(me),
    };
  }

  defaultPayload() {
    const p = this.pending;
    if (!p) return {};
    if (p.kind === 'focus') return { routine: { ...this.state.routine } };
    if (p.kind === 'minigame') return { auto: true, score: 0.6 };
    if (p.kind === 'termStart') return p.canKeep ? { keep: true } : { clubId: (p.clubs.find((c) => c.seatsLeft > 0) || p.clubs[0]).id, electiveId: p.needElective ? p.electives[0].id : null };
    const o = (p.options || []).find((x) => !x.disabled);
    return { optionId: o ? o.id : 'ok' };
  }

  act(payload) {
    const s = this.state;
    const p = this.pending;
    this.buf = [];
    if (!p) return { log: [], pending: null };
    if (p.final) return { log: [], pending: p };
    payload = payload || {};
    if (p.kind === 'scene') {
      const o = (p.options || []).find((x) => x.id === payload.optionId);
      if (!o || o.disabled) throw new Error(`ตัวเลือกไม่ถูกต้อง: ${payload.optionId}`);
      if (p.tag === 'intro') { s.intro = false; s.queue.push('termStart', 'focus'); this._say('วันแรกที่โรงเรียนประจำ', 'neutral'); this._next(); }
      else if (p.tag === 'gate') {
        if (o.id === 'gate-pass') { this._say('ผ่านประตูขึ้น ม.4 ได้ที่นั่งต่อ', 'good'); this._next(); } else this._ending(false);
      } else if (p.tag === 'report') { this._say(`ขึ้นชั้น ม.${Math.min(6, s.report.year + 1)}`, 'good'); this._next(); }
      else if (MG_SCENES.has(p.tag)) { this._sceneChoice(p, o.id); this._next(); }
      else {
        const r = EVENT_FX[o.id];
        if (r) { r.lines.forEach(([t, tone]) => this._say(t, tone)); this._fx(r.fx); } else this._say(`เลือก: ${o.label}`);
        this._next();
      }
    } else if (p.kind === 'focus') {
      this.setRoutine(payload.routine || {});
      this._say('ตั้งโฟกัสของเทอมใหม่แล้ว', 'neutral');
      this._next();
    } else if (p.kind === 'termStart') {
      const pick = payload.keep && s.lastTerm ? s.lastTerm : { clubId: payload.clubId, electiveId: payload.electiveId };
      const club = p.clubs.find((c) => c.id === pick.clubId);
      if (!club || (club.seatsLeft <= 0 && !payload.keep)) throw new Error('ชุมนุมนี้เต็มแล้ว');
      s.lastTerm = { clubId: pick.clubId, electiveId: pick.electiveId == null ? null : pick.electiveId, satGroup: payload.keep && s.lastTerm ? (s.lastTerm.satGroup || null) : (payload.satGroup || null) };
      s.satGroup = s.lastTerm.satGroup;
      this._say(payload.keep ? `ใช้ชุมนุม ${club.name} และวิชาเลือกเดิมต่อ` : `ได้เข้าชุมนุม ${club.name}`, 'good');
      this._next();
    } else if (p.kind === 'minigame') this._actMg(p, payload);
    else throw new Error(`ไม่รู้จัก pending: ${p.kind}`);
    return { log: this.buf, pending: this.pending };
  }

  fastForward(stopKinds = ['scene', 'termStart'], maxSteps = 2000) {
    const log = [];
    let n = 0;
    while (n < maxSteps && !(this.pending && this.pending.final)) {
      if (!this.pending) { const r0 = this.advance({ days: 3 }); log.push(...r0.log); if (this.state.ended) break; continue; }
      const r = this.act(this.defaultPayload());
      log.push(...r.log);
      n += 1;
      if (this.pending && stopKinds.includes(this.pending.kind)) break;
    }
    return { steps: n, log, pending: this.pending };
  }

  save() { this.state.pending = this.pending; return JSON.stringify(this.state); }
  debug() { return { engine: 'mock-routine', d: this.state.d }; }
}

export function createRoutineMock(seed, mode) { return new RoutineMock(freshRoutineState(seed, mode)); }
export function loadRoutineMock(state) { return new RoutineMock(state); }
