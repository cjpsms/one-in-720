// Assignments teachers set. PLACEHOLDER: cj will describe real assignments tomorrow; these templates are my guesses.
// Items come from the co-op (DESIGN.md "Co-op and required items"). The ids below are what the shops agent and the
// engine must match: REQUIRED_ITEM_IDS / REQUIRED_ITEM_NAMES. Printed photos are made in the print room
// (buy paper first, then 2 baht per page).
import { subjectOf } from '../data/subjects.js';

export const REQUIRED_ITEM_NAMES = {
  a4_paper_100: 'กระดาษ A4 (100 แผ่น)',
  a3_pound_paper: 'กระดาษปอนด์ A3',
  colored_paper: 'กระดาษสี',
  glue_gun: 'ปืนกาว',
  pen: 'ปากกา',
  scout_gear: 'ชุดลูกเสือ',
  redcross_gear: 'ชุดยุวกาชาด',
  printed_photos: 'รูปถ่ายที่ปริ้นแล้ว',
};

export const REQUIRED_ITEM_IDS = Object.keys(REQUIRED_ITEM_NAMES);

export function requiredItemName(id) {
  return REQUIRED_ITEM_NAMES[id] || id;
}

// kind: worksheet | report | poster | model | presentation | practice | photo | activity
// effort = number of 30-minute evening slots (evening.js SLOT) a typical student needs. dueIn = school days.
// {s} in a name is replaced by the subject's short name.
const T = (name, kind, effort, dueIn, items, weight = 1) => ({ name, kind, effort, dueIn, items, weight });

const GENERIC = [
  T('แบบฝึกหัด {s}', 'worksheet', [1, 2], [2, 4], [], 4),
  T('ใบงาน {s} ส่งพรุ่งนี้', 'worksheet', [1, 1], [1, 1], [], 3),
  T('รายงาน {s} เขียนลงกระดาษ A4', 'report', [3, 5], [5, 8], ['a4_paper_100'], 2),
  T('โปสเตอร์สรุปบทเรียน {s}', 'poster', [3, 5], [5, 8], ['a3_pound_paper', 'colored_paper'], 2),
  T('ทำสื่อนำเสนอ {s} เป็นกลุ่ม', 'presentation', [3, 5], [6, 9], ['a3_pound_paper'], 1),
];

const BY_KIND = {
  thai: [
    T('เรียงความหัวข้อที่ครูกำหนด', 'report', [2, 4], [4, 7], ['a4_paper_100'], 3),
    T('สรุปวรรณคดีลงกระดาษรายงาน', 'report', [2, 4], [5, 8], ['a4_paper_100', 'pen'], 2),
    T('โปสเตอร์รณรงค์รักษาภาษาไทย', 'poster', [3, 5], [6, 9], ['a3_pound_paper', 'colored_paper'], 2),
    T('ฝึกคัดลายมือหนึ่งหน้า', 'practice', [1, 1], [1, 2], ['pen'], 2),
  ],
  math: [
    T('การบ้านโจทย์ชุดใหญ่', 'worksheet', [2, 4], [2, 4], [], 5),
    T('ใบงานสรุปสูตร', 'worksheet', [1, 2], [1, 3], ['a4_paper_100'], 2),
    T('โปสเตอร์เรขาคณิตรอบตัว', 'poster', [3, 5], [6, 9], ['a3_pound_paper', 'colored_paper'], 1),
  ],
  science: [
    T('รายงานผลการทดลอง', 'report', [3, 5], [4, 7], ['a4_paper_100'], 3),
    T('ทำแบบจำลองจากวัสดุที่ครูกำหนด', 'model', [4, 6], [6, 10], ['glue_gun', 'colored_paper'], 2),
    T('โปสเตอร์สรุปบทเรียนวิทยาศาสตร์', 'poster', [3, 5], [5, 8], ['a3_pound_paper', 'colored_paper'], 2),
    T('ใบงานก่อนเข้าห้องแล็บ', 'worksheet', [1, 2], [1, 3], [], 3),
  ],
  social: [
    T('โปสเตอร์แผนที่และสถานที่สำคัญ', 'poster', [3, 5], [5, 8], ['a3_pound_paper', 'colored_paper', 'printed_photos'], 2),
    T('สรุปเหตุการณ์สำคัญลงกระดาษ A4', 'report', [2, 4], [4, 7], ['a4_paper_100'], 3),
    T('รายงานกลุ่มพร้อมรูปประกอบ', 'report', [3, 5], [6, 9], ['a4_paper_100', 'printed_photos'], 2),
  ],
  english: [
    T('ท่องศัพท์และเขียนประโยคตัวอย่าง', 'worksheet', [1, 2], [2, 4], [], 4),
    T('เตรียมพรีเซนต์สั้นๆ เป็นภาษาอังกฤษ', 'presentation', [3, 5], [5, 8], ['a3_pound_paper'], 2),
    T('สมุดภาพศัพท์ทำมือ', 'model', [3, 5], [6, 9], ['a4_paper_100', 'colored_paper', 'glue_gun'], 1),
  ],
  art: [
    T('วาดภาพตามโจทย์ลงกระดาษปอนด์', 'practice', [3, 5], [5, 8], ['a3_pound_paper'], 4),
    T('งานตัดปะกระดาษสี', 'model', [3, 5], [5, 8], ['colored_paper', 'glue_gun'], 2),
  ],
  work: [
    T('ประดิษฐ์ชิ้นงานด้วยปืนกาว', 'model', [3, 6], [6, 10], ['glue_gun', 'colored_paper'], 4),
    T('สรุปขั้นตอนทำงานลงกระดาษ A4', 'report', [2, 3], [4, 7], ['a4_paper_100'], 2),
  ],
  computer: [
    T('ปริ้นรูปประกอบงานที่ครูให้หา', 'photo', [1, 2], [3, 5], ['a4_paper_100', 'printed_photos'], 2),
    T('ใบงานโปรแกรมที่ทำในห้องคอม', 'worksheet', [1, 3], [2, 4], [], 3),
  ],
  health: [
    T('บันทึกการออกกำลังกายหนึ่งสัปดาห์', 'practice', [1, 2], [5, 7], ['pen'], 3),
    T('โปสเตอร์ดูแลสุขภาพ', 'poster', [3, 4], [5, 8], ['a3_pound_paper', 'colored_paper'], 1),
  ],
  pe: [
    T('บันทึกผลทดสอบสมรรถภาพ', 'practice', [1, 1], [3, 5], ['pen'], 3),
  ],
  music: [
    T('ฝึกเล่นเพลงที่ครูกำหนดเพื่อสอบปฏิบัติ', 'practice', [3, 5], [5, 8], [], 3),
  ],
  dance: [
    T('ซ้อมท่ารำเพื่อสอบปฏิบัติ', 'practice', [3, 5], [5, 8], [], 3),
  ],
  guidance: [
    T('เขียนสะท้อนตัวเองและเป้าหมายลงกระดาษ A4', 'report', [1, 2], [4, 7], ['a4_paper_100'], 3),
  ],
  project: [
    T('ความคืบหน้าโครงงานส่งครู', 'report', [3, 5], [5, 8], ['a4_paper_100'], 3),
    T('โปสเตอร์โครงงานสำหรับนำเสนอ', 'poster', [4, 6], [8, 12], ['a3_pound_paper', 'colored_paper', 'printed_photos'], 2),
  ],
};
BY_KIND.physics = BY_KIND.science;
BY_KIND.chemistry = BY_KIND.science;
BY_KIND.biology = BY_KIND.science;
BY_KIND.earth = BY_KIND.science;
BY_KIND.history = BY_KIND.social;
BY_KIND.religion = BY_KIND.social;
BY_KIND.foreignlang = BY_KIND.english;

// Activity blocks have their own assignments (come in uniform, bring gear).
const ACTIVITY = {
  'ลส/ยว': [
    T('แต่งชุดลูกเสือมาให้ครบตามที่ครูสั่ง', 'activity', [0, 0], [1, 3], ['scout_gear'], 3),
    T('แต่งชุดยุวกาชาดมาให้ครบตามที่ครูสั่ง', 'activity', [0, 0], [1, 3], ['redcross_gear'], 2),
  ],
};

function pickWeighted(rng, list) {
  const total = list.reduce((s, t) => s + t.weight, 0);
  let r = rng.float() * total;
  for (const t of list) {
    r -= t.weight;
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

const range = (rng, [lo, hi]) => (lo === hi ? lo : rng.int(lo, hi));

// subject: a code ("ค21102") or an activity name ("ลส/ยว"); teacher: a teacher object or key (optional).
// A stricter teacher asks for more work and gives less time.
export function makeTask(rng, { teacher, subject, grade, day } = {}) {
  const code = typeof subject === 'object' && subject ? subject.code : subject;
  const sub = subjectOf(code);
  const list = ACTIVITY[code] || BY_KIND[sub.kind] || GENERIC;
  const t = pickWeighted(rng, list);
  const strict = teacher && typeof teacher === 'object' && teacher.personality ? teacher.personality.strictness : 50;
  let effort = range(rng, t.effort);
  let dueIn = range(rng, t.dueIn);
  if (strict >= 75 && t.effort[1] > 0) effort += 1;
  if (strict >= 75 && dueIn > 1) dueIn -= 1;
  if (strict <= 30 && dueIn < 14) dueIn += 1;
  const tk = typeof teacher === 'string' ? teacher : teacher && teacher.key ? teacher.key : 'x';
  return {
    id: `task-${day ?? 0}-${tk}-${rng.int(1000, 9999)}`,
    name: t.name.replace('{s}', sub.short),
    kind: t.kind,
    dueIn,
    effort,
    requiredItems: t.items.slice(),
    subject: code,
    teacher: tk,
    grade: grade ?? null,
    day: day ?? 0,
  };
}
