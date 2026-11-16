// Fictional teachers for the game. The real teachers in the timetable PDF are never stored anywhere.
// PLACEHOLDER: cj will describe each teacher's personality tomorrow. Until then every teacher gets a random
// archetype from ARCHETYPES (one data table: edit or add rows here, nothing else needs to change).
// personality numbers are 0-100: patience, strictness, warmth, humor, forgiveness.

// range = [lo, hi] for each trait, drawn uniformly then jittered a little. weight = how common the archetype is.
export const ARCHETYPES = [
  { id: 'strict', th: 'เข้มงวด', weight: 3, range: { patience: [25, 50], strictness: [75, 95], warmth: [20, 45], humor: [10, 35], forgiveness: [15, 40] } },
  { id: 'warm', th: 'ใจดีอบอุ่น', weight: 4, range: { patience: [65, 90], strictness: [25, 50], warmth: [75, 95], humor: [40, 70], forgiveness: [65, 90] } },
  { id: 'funny', th: 'ตลก', weight: 3, range: { patience: [50, 75], strictness: [25, 50], warmth: [55, 80], humor: [75, 95], forgiveness: [55, 80] } },
  { id: 'tired', th: 'เหนื่อยล้า', weight: 3, range: { patience: [15, 40], strictness: [35, 60], warmth: [30, 55], humor: [20, 45], forgiveness: [35, 60] } },
  { id: 'perfectionist', th: 'จุกจิกเป๊ะ', weight: 2, range: { patience: [30, 55], strictness: [70, 92], warmth: [30, 55], humor: [15, 40], forgiveness: [10, 35] } },
  { id: 'chill', th: 'สบายๆ', weight: 3, range: { patience: [70, 95], strictness: [10, 35], warmth: [50, 75], humor: [45, 75], forgiveness: [75, 95] } },
  { id: 'anxious', th: 'ขี้กังวล', weight: 2, range: { patience: [20, 45], strictness: [45, 70], warmth: [50, 75], humor: [25, 50], forgiveness: [45, 70] } },
];

export const TRAITS = ['patience', 'strictness', 'warmth', 'humor', 'forgiveness'];

// Fictional nicknames (invented, plain Thai nickname style). Used as "ครู" + nickname.
const MALE = [
  'เอก', 'ต้น', 'ภพ', 'นนท์', 'บอม', 'ปอ', 'ชัช', 'กอล์ฟ', 'โอ๊ต', 'เติ้ล', 'ก้อง', 'ฟิล์ม', 'พีท', 'ธีร์', 'ภูมิ',
  'นัท', 'เจต', 'ต๊ะ', 'อาร์ม', 'โก้', 'แบงค์', 'ทัช', 'เมฆ', 'ไผ่', 'กัน', 'ปั้น', 'บิ๊ก', 'ตูน', 'หมู่', 'ท็อป',
  'เพชร', 'วิน', 'ไนท์', 'ฮั่น', 'ปุ้ม', 'เนม', 'ชาติ', 'อ๋อง', 'เบน', 'ต่อ', 'ดอม', 'ซี', 'นิว', 'แทน', 'พัด',
  'โจ้', 'ตั้ม', 'ป๊อก', 'เฟิร์ส', 'ลีโอ', 'หลิน', 'ณัฐ', 'ก๊อต', 'ไอซ์', 'อู๋', 'ปอนด์', 'แมน', 'ฟ้าใส', 'ภีม', 'ออม',
];
const FEMALE = [
  'มินท์', 'ฟ้า', 'ปุ้ย', 'แพร', 'นุ่น', 'ขวัญ', 'พลอย', 'แอม', 'ฝน', 'เจน', 'บัว', 'ไอรีน', 'อ้อ', 'ตาล', 'หญิง',
  'น้ำ', 'ใบเตย', 'แพท', 'กิ๊ฟ', 'จอย', 'มุก', 'เฟิร์น', 'ปลา', 'หมิว', 'นิ่ม', 'โบว์', 'พิม', 'แตงกวา', 'ฟองเบียร์', 'ครีม',
  'ลูกปลา', 'ข้าวฟ่าง', 'มะนาว', 'เมจิ', 'จิ๊บ', 'ก้อย', 'ปาย', 'มายด์', 'ใหม่', 'วาว', 'เปรี้ยว', 'ส้ม', 'ลูกหว้า', 'ต้นข้าว', 'อิ่ม',
  'ปริม', 'ฟิน', 'ภัทร', 'ชมพู่', 'เกด', 'แนน', 'ดาว', 'ไข่มุก', 'น้ำตาล', 'ใบบัว', 'กุ้ง', 'หนูนา', 'เอ๋', 'ธัญ', 'พั้นช์',
];
const FOREIGN_MALE = ['Tom', 'Ryan', 'Mark', 'Daniel', 'Peter', 'James', 'Luke', 'Adam', 'Chris', 'Owen', 'Ian', 'Neil'];
const FOREIGN_FEMALE = ['Anna', 'Emma', 'Julia', 'Rachel', 'Hannah', 'Sophie', 'Claire', 'Megan', 'Laura', 'Grace', 'Nora', 'Iris'];

// teacherKeys may be: an array of keys, an array of { key, foreign }, or the timetable's
// `teachers` object ({ 'm1-A': { codes, foreign } }). Order does not matter (keys are sorted first).
function normalize(teacherKeys) {
  const out = [];
  if (Array.isArray(teacherKeys)) {
    for (const t of teacherKeys) {
      if (typeof t === 'string') out.push({ key: t, foreign: false });
      else if (t && t.key) out.push({ key: t.key, foreign: !!t.foreign });
    }
  } else if (teacherKeys && typeof teacherKeys === 'object') {
    for (const k of Object.keys(teacherKeys)) out.push({ key: k, foreign: !!(teacherKeys[k] && teacherKeys[k].foreign) });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

function pickArchetype(rng) {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let r = rng.float() * total;
  for (const a of ARCHETYPES) {
    r -= a.weight;
    if (r < 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

const clamp100 = (x) => Math.max(0, Math.min(100, Math.round(x)));

function rollPersonality(rng, archetype) {
  const p = {};
  for (const t of TRAITS) {
    const [lo, hi] = archetype.range[t];
    p[t] = clamp100(lo + rng.float() * (hi - lo) + rng.gauss() * 3);
  }
  return p;
}

// Returns { [key]: { key, name, sex, foreign, archetype, personality } }. Deterministic for the same rng state and keys.
export function makeTeachers(rng, teacherKeys) {
  const list = normalize(teacherKeys);
  const poolM = rng.shuffle(MALE.slice());
  const poolF = rng.shuffle(FEMALE.slice());
  const poolFM = rng.shuffle(FOREIGN_MALE.slice());
  const poolFF = rng.shuffle(FOREIGN_FEMALE.slice());
  const usedBy = {};
  const out = {};
  for (const { key, foreign } of list) {
    const sex = rng.chance(0.5) ? 'M' : 'F';
    const pool = foreign ? (sex === 'M' ? poolFM : poolFF) : sex === 'M' ? poolM : poolF;
    let first = pool.pop();
    if (first === undefined) {
      // pool used up: reuse a name with a number so nicknames stay unique
      const base = foreign ? (sex === 'M' ? FOREIGN_MALE : FOREIGN_FEMALE) : sex === 'M' ? MALE : FEMALE;
      const b = base[rng.int(0, base.length - 1)];
      usedBy[b] = (usedBy[b] || 1) + 1;
      first = `${b} ${usedBy[b]}`;
    }
    const archetype = pickArchetype(rng);
    out[key] = {
      key,
      name: foreign ? (sex === 'M' ? `Mr. ${first}` : `Ms. ${first}`) : `ครู${first}`,
      sex,
      foreign,
      archetype: archetype.id,
      personality: rollPersonality(rng, archetype),
    };
  }
  return out;
}

export function archetypeInfo(id) {
  return ARCHETYPES.find((a) => a.id === id) || null;
}
