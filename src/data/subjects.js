// Subject catalog for the timetable codes (ค21102, ว22202, ...).
// Decode table: DESIGN.md "Subject decode". cj's answers are guess:false, everything else is my guess (guess:true).
//
// Code shape: <letter><level><year><type><nn>
//   level 2 = ม.ต้น, 3 = ม.ปลาย; year 1..3 inside the stage (0 = every grade);
//   type 1 = core, 2 = extra; nn = running number.
//   e.g. ค21102 = maths, ม.1, core, #02; ม.4 physics ว31202.

export const KINDS = [
  'thai', 'math', 'science', 'physics', 'chemistry', 'biology', 'earth', 'computer', 'social',
  'history', 'religion', 'english', 'foreignlang', 'art', 'music', 'dance', 'health', 'pe', 'work',
  'guidance', 'project', 'other',
];

// What kind of room a subject is taught in (see also roomKindOfLoc for the printed room text).
const ROOM_KIND = {
  thai: 'thai', math: 'math', science: 'science', physics: 'science', chemistry: 'science',
  biology: 'science', earth: 'science', computer: 'computer', social: 'social', history: 'social',
  religion: 'social', english: 'english', foreignlang: 'english', art: 'art', music: 'music',
  dance: 'dance', health: 'health', pe: 'sport', work: 'workshop', guidance: 'guidance',
  project: 'lab', other: 'generic',
};

const KIND_TH = {
  thai: 'ภาษาไทย', math: 'คณิตศาสตร์', science: 'วิทยาศาสตร์', physics: 'ฟิสิกส์', chemistry: 'เคมี',
  biology: 'ชีววิทยา', earth: 'โลกและอวกาศ', computer: 'คอมพิวเตอร์', social: 'สังคมศึกษา',
  history: 'ประวัติศาสตร์', religion: 'ศาสนาและศีลธรรม', english: 'ภาษาอังกฤษ', foreignlang: 'ภาษาต่างประเทศ',
  art: 'ศิลปะ', music: 'ดนตรี', dance: 'นาฏศิลป์', health: 'สุขศึกษา', pe: 'พลศึกษา', work: 'การงานอาชีพ',
  guidance: 'แนะแนว', project: 'โครงงาน', other: 'วิชาอื่น',
};

const KIND_SHORT = {
  thai: 'ไทย', math: 'คณิต', science: 'วิทย์', physics: 'ฟิสิกส์', chemistry: 'เคมี', biology: 'ชีวะ',
  earth: 'โลก', computer: 'คอมฯ', social: 'สังคม', history: 'ประวัติ', religion: 'ศาสนา', english: 'อังกฤษ',
  foreignlang: 'ภาษา', art: 'ศิลปะ', music: 'ดนตรี', dance: 'นาฏ', health: 'สุข', pe: 'พละ', work: 'การงาน',
  guidance: 'แนะแนว', project: 'โครงงาน', other: 'อื่นๆ',
};

// First letter -> kind, for codes nobody has decoded (guess:true).
const LETTER_KIND = {
  'ท': 'thai', 'ค': 'math', 'ว': 'science', 'ส': 'social', 'พ': 'pe', 'ศ': 'art', 'ง': 'work', 'อ': 'english',
  'จ': 'foreignlang', 'ญ': 'foreignlang', 'ฝ': 'foreignlang', 'ย': 'foreignlang', 'I': 'project',
};

const FOREIGN_NAME = { 'จ': 'ภาษาจีน', 'ญ': 'ภาษาญี่ปุ่น', 'ฝ': 'ภาษาฝรั่งเศส', 'ย': 'ภาษาเยอรมัน' };

const CODE_RE = /^([ก-ฮA-Za-z]*)(\d)(\d)(\d)(\d{2})$/;

// -> { kind, th?, guess } for one parsed code.
function decode(letter, level, year, type, num) {
  const n3 = type * 100 + num;
  const lower = level === 2;
  switch (letter) {
    case 'ท':
      return { kind: 'thai', th: type === 2 ? 'ภาษาไทยเพิ่มเติม' : null, guess: n3 > 202 };
    case 'ค':
      return { kind: 'math', th: type === 2 ? 'คณิตศาสตร์เพิ่มเติม' : null, guess: !(n3 === 102 || n3 === 202) };
    case 'ว':
      return lower ? decodeScienceLower(year, n3) : decodeScienceUpper(year, n3);
    case 'ส':
      if (lower && n3 === 102) return { kind: 'social', guess: false };
      if (lower && n3 === 104) return { kind: 'religion', guess: true }; // cj: 104/106 are history and religion, unknown which
      if (lower && n3 === 106) return { kind: 'history', guess: true };
      if (n3 === 209) return { kind: 'social', th: 'สังคมเพิ่มเติม', guess: true }; // ส20209, room 243
      if (!lower && num === 2) return { kind: 'history', guess: true };
      return { kind: 'social', guess: true };
    case 'ศ':
      // cj: ศ...102 art, ศ...103 dance. 101 (music) is a guess.
      if (num === 1) return { kind: 'music', guess: true };
      if (num === 3) return { kind: 'dance', guess: false };
      if (num === 2) return { kind: 'art', guess: false };
      return { kind: 'art', guess: true };
    case 'พ':
      // cj: พ...102 health, พ...104 PE
      if (num === 1 || num === 2) return { kind: 'health', guess: num !== 2 };
      return { kind: 'pe', guess: num !== 4 };
    case 'ง':
      return { kind: 'work', guess: n3 !== 101 };
    case 'อ':
      if (type === 2) return { kind: 'english', th: 'ภาษาอังกฤษ (สนทนา)', guess: n3 !== 202 };
      return { kind: 'english', guess: n3 !== 102 };
    case 'จ': case 'ญ': case 'ฝ': case 'ย':
      return { kind: 'foreignlang', th: FOREIGN_NAME[letter], guess: true };
    case 'I':
      return { kind: 'project', th: 'การศึกษาค้นคว้าด้วยตนเอง (IS)', guess: true };
    case '':
      // bare "20271": a 1-period project (ม.2 room 228, ม.3 room 223, cj unsure)
      return { kind: 'project', th: 'โครงงาน', guess: true };
    default:
      return { kind: LETTER_KIND[letter] || 'other', guess: true };
  }
}

function decodeScienceLower(year, n3) {
  if (n3 === 102) return { kind: 'science', guess: false };
  if (n3 === 202 && year === 2) return { kind: 'project', th: 'โครงงานวิทยาศาสตร์', guess: false }; // ว22202, room 111
  if (n3 === 202) return { kind: 'computer', guess: false }; // ว21202, ว23202
  if (n3 === 203 && year === 2) return { kind: 'computer', guess: false }; // ว22203
  if (n3 === 203) return { kind: 'science', th: 'วิทยาศาสตร์เพิ่มเติม', guess: true }; // ว21203, room 111, unsure
  return { kind: 'science', guess: true };
}

function decodeScienceUpper(year, n3) {
  const r = (lo, hi) => n3 >= lo && n3 <= hi;
  if (r(100, 119) || r(200, 219)) return { kind: 'physics', guess: true };
  if (r(120, 139) || r(220, 239)) return { kind: 'chemistry', guess: true };
  if (r(140, 159) || r(240, 259)) return { kind: 'biology', guess: true };
  if (r(160, 179) || r(260, 279)) return { kind: 'earth', guess: true };
  if (n3 === 281) return year === 0 ? { kind: 'project', th: 'โครงงานวิทยาศาสตร์', guess: true } : { kind: 'computer', guess: true };
  if (n3 === 282 || n3 === 283) return { kind: 'project', th: 'โครงงานวิทยาศาสตร์', guess: true };
  if (n3 >= 284) return { kind: 'computer', guess: true };
  return { kind: 'science', guess: true };
}

function gradeOf(level, year) {
  if (year === 0) return null;
  return level === 3 ? year + 3 : year;
}

// Parse and decode any code. Never throws; unknown shapes fall back by first letter with guess:true.
function build(code) {
  const raw = String(code);
  if (raw === 'แนะแนว') {
    return { code: raw, th: 'แนะแนว', kind: 'guidance', roomKind: 'guidance', short: 'แนะแนว', grade: null, guess: false };
  }
  const m = CODE_RE.exec(raw);
  if (!m) {
    const letter = raw.charAt(0);
    const kind = LETTER_KIND[letter] || 'other';
    return { code: raw, th: KIND_TH[kind], kind, roomKind: ROOM_KIND[kind], short: KIND_SHORT[kind], grade: null, guess: true };
  }
  const [, letter, lv, yr, ty, nn] = m;
  const level = +lv;
  const year = +yr;
  const d = decode(letter, level, year, +ty, +nn);
  const grade = gradeOf(level, year);
  return {
    code: raw,
    th: d.th || KIND_TH[d.kind],
    kind: d.kind,
    roomKind: ROOM_KIND[d.kind],
    short: KIND_SHORT[d.kind],
    grade,
    guess: !!d.guess,
  };
}

// Every code that appears (or very likely appears) in the timetable, built from templates for ม.1-6.
const LOWER_TEMPLATES = [
  'ท2Y101', 'ท2Y102', 'ท2Y201', 'ท2Y202',
  'ค2Y101', 'ค2Y102', 'ค2Y201', 'ค2Y202',
  'ว2Y101', 'ว2Y102', 'ว2Y202', 'ว2Y203',
  'ส2Y101', 'ส2Y102', 'ส2Y103', 'ส2Y104', 'ส2Y105', 'ส2Y106', 'ส2Y201',
  'ศ2Y101', 'ศ2Y102', 'ศ2Y103',
  'พ2Y101', 'พ2Y102', 'พ2Y103', 'พ2Y104',
  'ง2Y101', 'ง2Y102',
  'อ2Y101', 'อ2Y102', 'อ2Y201', 'อ2Y202',
  'จ2Y201', 'ญ2Y201',
];
const UPPER_TEMPLATES = [
  'ท3Y101', 'ท3Y102', 'ท3Y201', 'ท3Y202',
  'ค3Y101', 'ค3Y102', 'ค3Y201', 'ค3Y202',
  'ว3Y101', 'ว3Y121', 'ว3Y141', 'ว3Y162', 'ว3Y202', 'ว3Y222', 'ว3Y242', 'ว3Y281', 'ว3Y283', 'ว3Y284',
  'ส3Y101', 'ส3Y102', 'ส3Y103', 'ส3Y104', 'ส3Y105', 'ส3Y106',
  'ศ3Y101', 'ศ3Y102', 'ศ3Y103',
  'พ3Y101', 'พ3Y102', 'พ3Y103', 'พ3Y104',
  'ง3Y101', 'ง3Y102',
  'อ3Y101', 'อ3Y102', 'อ3Y201', 'อ3Y202',
  'จ3Y201', 'ญ3Y201', 'ฝ3Y201', 'ย3Y201',
];
const EXTRA_CODES = ['ส20209', 'ว30281', '20271', 'I20201', 'I30201', 'แนะแนว'];

export const SUBJECTS = {};
for (const y of [1, 2, 3]) {
  for (const t of LOWER_TEMPLATES) SUBJECTS[t.replace('Y', y)] = build(t.replace('Y', y));
  for (const t of UPPER_TEMPLATES) SUBJECTS[t.replace('Y', y)] = build(t.replace('Y', y));
}
for (const c of EXTRA_CODES) SUBJECTS[c] = build(c);

// Never returns null. Unlisted codes are decoded by the same rules (guess:true when unsure),
// completely unknown ones fall back by first letter.
export function subjectOf(code) {
  const hit = SUBJECTS[code];
  if (hit) return hit;
  return build(code);
}

export const ACTIVITY_NAMES = {
  'ลส/ยว': 'ลูกเสือ / ยุวกาชาด',
  'ชุมนุม': 'ชุมนุม',
  'ส.การอ่าน': 'ส่งเสริมการอ่าน',
  'ชน./นศท.': 'ชุมนุม / นักศึกษาวิชาทหาร (นศท.)',
  'บพ./นศท.': 'บำเพ็ญประโยชน์ / นักศึกษาวิชาทหาร (นศท.)',
  'พก. 2': 'วิชาเลือก (พก.)',
  'ภาษาที่ 2': 'ภาษาที่ 2 (ตามกลุ่ม)',
};

// 0.5 credit per period per week per term.
export function creditsFor(periodsPerWeek) {
  return periodsPerWeek * 0.5;
}

// The room text printed under the teacher name (loc) -> a room kind (same values as subject.roomKind).
export function roomKindOfLoc(loc) {
  const s = String(loc || '').trim();
  if (!s) return 'generic';
  if (/^COM/i.test(s)) return 'computer';
  if (s.startsWith('ศ.กีฬา')) {
    const n = +(s.match(/\d+/) || [0])[0];
    return n === 4 ? 'art' : n === 5 ? 'music' : 'health';
  }
  if (s.startsWith('สนาม')) return 'sport';
  if (s.startsWith('นาฏศิลป์')) return 'dance';
  if (s.startsWith('ฝึกงาน')) return 'workshop';
  if (s.startsWith('แนะแนว')) return 'guidance';
  const n = +s;
  if (!Number.isFinite(n) || n <= 0) return 'generic';
  if (n === 221 || n === 223) return 'science';
  if (n === 222) return 'science';
  if (n < 200) return 'science'; // 111 and the ม.ปลาย science rooms (guess)
  if (n >= 211 && n <= 215) return 'thai';
  if (n >= 216 && n <= 228) return 'math';
  if (n >= 231 && n <= 238) return 'english';
  if (n >= 241 && n <= 249) return 'social';
  return 'generic';
}
