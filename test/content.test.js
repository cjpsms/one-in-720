// Tests for the content owner's files. Run: node test/content.test.js (exit code 1 on failure)
import { Rng } from '../src/rng.js';
import { SUBJECTS, subjectOf, ACTIVITY_NAMES, creditsFor, roomKindOfLoc, KINDS } from '../src/data/subjects.js';
import { CLUBS, clubsFor } from '../src/data/clubs.js';
import { ELECTIVES, electivesFor } from '../src/data/electives.js';
import { makeTeachers, ARCHETYPES, TRAITS } from '../src/data/teachers.js';
import { EVENTS, pickEvent, restoreEvent, FX_KEYS } from '../src/content/events.js';
import { makeTask, REQUIRED_ITEM_IDS, REQUIRED_ITEM_NAMES } from '../src/content/tasks.js';

let failed = 0;
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  }
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const EMOJI = /\p{Extended_Pictographic}/u;
const noEmoji = (s, where) => ok(!EMOJI.test(String(s)), `emoji in ${where}`);

// ---- subjects
{
  eq(subjectOf('ค21102').kind, 'math', 'ค21102 math');
  eq(subjectOf('ค21202').kind, 'math', 'ค21202 math');
  eq(subjectOf('ท21101').kind, 'thai', 'ท21101 thai');
  eq(subjectOf('ว21202').kind, 'computer', 'ว21202 computer (ม.1)');
  eq(subjectOf('ว22203').kind, 'computer', 'ว22203 computer (ม.2)');
  eq(subjectOf('ว23202').kind, 'computer', 'ว23202 computer (ม.3)');
  eq(subjectOf('ว22202').kind, 'project', 'ว22202 science project');
  eq(subjectOf('ว21102').kind, 'science', 'ว21102 science');
  eq(subjectOf('ศ21103').kind, 'dance', 'ศ21103 dance');
  eq(subjectOf('ศ21102').kind, 'art', 'ศ21102 art');
  eq(subjectOf('พ21102').kind, 'health', 'พ21102 health');
  eq(subjectOf('พ21104').kind, 'pe', 'พ21104 pe');
  eq(subjectOf('ง21101').kind, 'work', 'ง21101 work');
  eq(subjectOf('อ21102').kind, 'english', 'อ21102 english');
  eq(subjectOf('ส21102').kind, 'social', 'ส21102 social');
  eq(subjectOf('ว31202').kind, 'physics', 'ว31202 physics');
  eq(subjectOf('ว31222').kind, 'chemistry', 'ว31222 chemistry');
  eq(subjectOf('ว31242').kind, 'biology', 'ว31242 biology');
  eq(subjectOf('ว31162').kind, 'earth', 'ว31162 earth');
  eq(subjectOf('ว31283').kind, 'project', 'ว31283 project');
  eq(subjectOf('ว31284').kind, 'computer', 'ว31284 computer');
  eq(subjectOf('ว33101').kind, 'physics', 'ว33101 physics');
  eq(subjectOf('ว33121').kind, 'chemistry', 'ว33121 chemistry');
  eq(subjectOf('ว33141').kind, 'biology', 'ว33141 biology');
  eq(subjectOf('แนะแนว').kind, 'guidance', 'guidance');
  eq(subjectOf('ค33999').grade, 6, 'grade from code');
  // unknown codes never throw and fall back by first letter with guess:true
  const u = subjectOf('ค99999');
  ok(u && u.kind === 'math' && u.guess === true, 'unknown ค code falls back to math with guess');
  const z = subjectOf('ฟ12345');
  ok(z && z.kind === 'other' && z.guess === true, 'unknown letter falls back to other with guess');
  ok(subjectOf('???') && subjectOf('???').guess === true, 'garbage code does not throw');
  ok(subjectOf('ค21102').guess === false, 'confirmed code is guess:false');
  for (const [code, s] of Object.entries(SUBJECTS)) {
    ok(typeof s.th === 'string' && s.th.length > 0, `subject ${code} th`);
    ok(KINDS.includes(s.kind), `subject ${code} kind ${s.kind}`);
    ok(typeof s.roomKind === 'string' && typeof s.short === 'string', `subject ${code} roomKind/short`);
    noEmoji(s.th, `subject ${code}`);
  }
  ok(Object.keys(SUBJECTS).length > 150, 'subject catalog has plenty of codes');
  for (const k of ['ลส/ยว', 'ชุมนุม', 'ส.การอ่าน', 'ชน./นศท.', 'บพ./นศท.', 'พก. 2', 'ภาษาที่ 2']) ok(typeof ACTIVITY_NAMES[k] === 'string', `ACTIVITY_NAMES ${k}`);
  eq(creditsFor(3), 1.5, 'creditsFor(3)');
  eq(creditsFor(0), 0, 'creditsFor(0)');
  eq(roomKindOfLoc('COM3'), 'computer', 'loc COM3');
  eq(roomKindOfLoc('ศ.กีฬา 4'), 'art', 'loc art room');
  eq(roomKindOfLoc('218'), 'math', 'loc 218');
  eq(roomKindOfLoc('221'), 'science', 'loc 221');
}

// ---- clubs
{
  for (let g = 1; g <= 6; g++) ok(clubsFor(g).length >= 8, `clubsFor(${g}) >= 8 (got ${clubsFor(g).length})`);
  const ids = new Set();
  for (const c of CLUBS) {
    ok(!ids.has(c.id), `duplicate club id ${c.id}`);
    ids.add(c.id);
    ok(c.name && Array.isArray(c.grades) && c.grades.length > 0, `club ${c.id} shape`);
    ok(c.grades.every((g) => g >= 1 && g <= 6), `club ${c.id} grades`);
    ok(Number.isInteger(c.seats) && c.seats >= 5 && c.seats <= 28, `club ${c.id} seats ${c.seats}`);
    ok(typeof c.studentRun === 'boolean' && typeof c.area === 'string', `club ${c.id} studentRun/area`);
    noEmoji(c.name, `club ${c.id}`);
  }
  const band = CLUBS.find((c) => c.name.startsWith('วงโยธวาทิต'));
  ok(band && band.seats === 28 && band.grades.length === 6, 'band: 28 seats, all grades');
  const lib = CLUBS.find((c) => c.name === 'Library Club 1');
  ok(lib && lib.seats === 15 && lib.grades.join() === '4,5,6', 'Library Club 1: grades 4-6, 15 seats');
  ok(CLUBS.some((c) => c.seats === 24 && c.grades.join() === '4,5,6'), 'a 24-seat club for grades 4-6 only');
  ok(clubsFor(1).every((c) => c.id !== 'library1'), 'no Library Club 1 for ม.1');
  ok(CLUBS.filter((c) => c.studentRun).length >= 20, 'student-run clubs exist');
}

// ---- electives
{
  eq(ELECTIVES.length, 100, 'electives = 100');
  eq(new Set(ELECTIVES.map((e) => e.id)).size, 100, 'unique elective ids');
  eq(new Set(ELECTIVES.map((e) => e.name)).size, 100, 'unique elective names');
  for (const e of ELECTIVES) {
    ok(e.id && e.name && e.area && ['low', 'high', 'any'].includes(e.level), `elective ${e.id} shape`);
    noEmoji(e.name, `elective ${e.id}`);
  }
  eq(electivesFor(3), [], 'ม.3 has no electives');
  for (const g of [1, 2, 4, 5, 6]) ok(electivesFor(g).length >= 40, `electivesFor(${g}) has plenty`);
  ok(electivesFor(1).every((e) => e.level !== 'high'), 'ม.1 gets no ปลาย electives');
  ok(electivesFor(5).every((e) => e.level !== 'low'), 'ม.5 gets no ต้น electives');
  ok(ELECTIVES.find((e) => e.name === 'มัลติมีเดีย').level === 'any', 'ทุก = any');
}

// ---- teachers
{
  const keys = { 'm1-A': { codes: [], foreign: false }, 'm1-B': { codes: [], foreign: true }, 'm1-C': { codes: [], foreign: false }, 'm2-A': { codes: [], foreign: false } };
  const a = makeTeachers(new Rng(7), keys);
  const b = makeTeachers(new Rng(7), keys);
  eq(a, b, 'makeTeachers deterministic');
  eq(makeTeachers(new Rng(7), Object.keys(keys)), makeTeachers(new Rng(7), Object.keys(keys).reverse()), 'key order does not matter');
  ok(JSON.stringify(a) !== JSON.stringify(makeTeachers(new Rng(8), keys)), 'different seed, different teachers');
  eq(Object.keys(a).sort(), Object.keys(keys).sort(), 'one teacher per key');
  const archIds = ARCHETYPES.map((x) => x.id);
  for (const [k, t] of Object.entries(a)) {
    ok(t.key === k && t.name && ['M', 'F'].includes(t.sex) && typeof t.foreign === 'boolean', `teacher ${k} shape`);
    ok(archIds.includes(t.archetype), `teacher ${k} archetype`);
    for (const tr of TRAITS) ok(Number.isInteger(t.personality[tr]) && t.personality[tr] >= 0 && t.personality[tr] <= 100, `teacher ${k} ${tr}`);
  }
  ok(a['m1-B'].foreign && /^(Mr|Ms)\. [A-Za-z]+$/.test(a['m1-B'].name), 'foreign teacher has an English name');
  ok(!a['m1-A'].foreign && a['m1-A'].name.startsWith('ครู'), 'Thai teacher is ครู + nickname');
  // many teachers: names stay unique
  const many = [];
  for (let g = 1; g <= 6; g++) for (let i = 0; i < 20; i++) many.push(`m${g}-${String.fromCharCode(65 + i)}`);
  const t120 = makeTeachers(new Rng(3), many);
  eq(Object.keys(t120).length, 120, '120 teachers');
  eq(new Set(Object.values(t120).map((t) => t.name)).size, 120, '120 unique teacher names');
  ok(JSON.parse(JSON.stringify(t120)) && JSON.stringify(JSON.parse(JSON.stringify(t120))) === JSON.stringify(t120), 'teachers are JSON');
}

// ---- events
{
  ok(EVENTS.length >= 30, `events >= 30 (got ${EVENTS.length})`);
  const ids = new Set();
  const places = new Set();
  for (const e of EVENTS) {
    ok(!ids.has(e.id), `duplicate event id ${e.id}`);
    ids.add(e.id);
    ok(e.title && Array.isArray(e.grades) && e.grades.length === 2 && Array.isArray(e.places) && e.places.length > 0, `event ${e.id} shape`);
    for (const p of e.places) {
      ok(['dorm', 'class', 'canteen', 'home', 'weekend'].includes(p), `event ${e.id} place ${p}`);
      places.add(p);
    }
    ok(Array.isArray(e.options) && e.options.length >= 2, `event ${e.id} has options`);
    noEmoji(e.title, `event ${e.id} title`);
    for (const grade of [e.grades[0], e.grades[1]]) {
      for (const place of e.places) {
        const ctx = { grade, place, day: 10, stats: { health: 60, energy: 60, stress: 60, knowledge: 60, peer: 60, teacherTrust: 60, money: 200, fullness: 50, gpa: 3.5, gpax: 3.5 } };
        ok(typeof e.weight(ctx) === 'number', `event ${e.id} weight number`);
        const text = e.text(ctx);
        ok(typeof text === 'string' && text.length > 10, `event ${e.id} text`);
        noEmoji(text, `event ${e.id} text`);
        const seen = new Set();
        for (const o of e.options) {
          ok(o.id && !seen.has(o.id) && typeof o.apply === 'function', `event ${e.id} option ${o.id} shape`);
          seen.add(o.id);
          const label = typeof o.label === 'function' ? o.label(ctx) : o.label;
          ok(typeof label === 'string' && label.length > 0, `event ${e.id}/${o.id} label`);
          noEmoji(label, `event ${e.id}/${o.id} label`);
          for (let s = 1; s <= 5; s++) {
            const r = o.apply(ctx, new Rng(s * 31));
            ok(r && typeof r.fx === 'object' && r.fx !== null && typeof r.log === 'string' && r.log.length > 3, `event ${e.id}/${o.id} apply shape`);
            for (const [k, v] of Object.entries(r.fx)) ok(FX_KEYS.includes(k) && Number.isFinite(v), `event ${e.id}/${o.id} fx key ${k}`);
            ok(!('ending' in r) || typeof r.ending === 'string', `event ${e.id}/${o.id} ending`);
            noEmoji(r.log, `event ${e.id}/${o.id} log`);
            // purity: same ctx and same seed -> same result
            eq(o.apply(ctx, new Rng(s * 31)), r, `event ${e.id}/${o.id} deterministic`);
          }
        }
      }
    }
  }
  for (const p of ['dorm', 'class', 'canteen', 'home', 'weekend']) ok(places.has(p), `some event for place ${p}`);
  // money never goes below 0
  for (const e of EVENTS) {
    for (const o of e.options) {
      const r = o.apply({ grade: e.grades[0], place: e.places[0], stats: { money: 5 } }, new Rng(1));
      ok(!(r.fx.money < -5), `event ${e.id}/${o.id} money capped by wallet`);
    }
  }
  // pickEvent
  const base = { grade: 2, place: 'dorm', day: 5, stats: { health: 50, energy: 50, stress: 50, knowledge: 50, peer: 50, teacherTrust: 50, money: 300 }, eventChance: 1 };
  const e1 = pickEvent(base, new Rng(99));
  const e2 = pickEvent(base, new Rng(99));
  ok(e1 && e2 && e1.id === e2.id && JSON.stringify(e1.vars) === JSON.stringify(e2.vars), 'pickEvent deterministic for a seed');
  eq(e1.text(base), e2.text(base), 'picked event text deterministic');
  ok(e1.places.includes('dorm') && e1.grades[0] <= 2 && e1.grades[1] >= 2, 'pickEvent respects grade and place');
  ok(e1.options.every((o) => typeof o.label === 'string'), 'picked event has string labels');
  const none = pickEvent({ ...base, eventChance: 0 }, new Rng(1));
  eq(none, null, 'eventChance 0 gives null');
  eq(pickEvent({ ...base, place: 'nowhere' }, new Rng(1)), null, 'no event for an unknown place');
  // restore after a save: id + vars rebuild the same text
  const back = restoreEvent(e1.id, JSON.parse(JSON.stringify(e1.vars)));
  eq(back.text(base), e1.text(base), 'restoreEvent gives the same text');
  eq(back.options[0].apply(base, new Rng(4)), e1.options[0].apply(base, new Rng(4)), 'restoreEvent gives the same result');
  // every grade/place pair can produce something
  for (let g = 1; g <= 6; g++) for (const p of ['dorm', 'class', 'canteen', 'home', 'weekend']) {
    ok(pickEvent({ ...base, grade: g, place: p }, new Rng(5)) !== null, `an event exists for grade ${g} at ${p}`);
  }
  // spread: all picks over many seeds are valid and varied
  const seenIds = new Set();
  for (let s = 0; s < 400; s++) {
    const ctx = { ...base, place: ['dorm', 'class', 'canteen', 'weekend', 'home'][s % 5], grade: 1 + (s % 6) };
    const e = pickEvent(ctx, new Rng(s));
    ok(e && e.options.length >= 2, 'pickEvent always returns a full event with eventChance 1');
    seenIds.add(e.id);
  }
  ok(seenIds.size >= 25, `many different events appear (got ${seenIds.size})`);
  // stress drives the meltdown (สลิ้งแตก)
  const melt = EVENTS.find((e) => e.id === 'meltdown');
  ok(melt.weight({ ...base, stats: { ...base.stats, stress: 95 } }) > 0 && melt.weight({ ...base, stats: { ...base.stats, stress: 20 } }) === 0, 'meltdown needs high stress');
  ok(melt.title === 'สลิ้งแตก', 'meltdown is written as สลิ้งแตก');
  // recent events are damped
  const flu = EVENTS.find((e) => e.id === 'flu_dorm');
  ok(flu.weight({ ...base, recent: ['flu_dorm'] }) < flu.weight(base), 'recent events get a lower weight');
}

// ---- tasks
{
  ok(REQUIRED_ITEM_IDS.length >= 6, 'required item ids');
  for (const id of REQUIRED_ITEM_IDS) ok(typeof REQUIRED_ITEM_NAMES[id] === 'string' && REQUIRED_ITEM_NAMES[id].length > 0, `item name for ${id}`);
  const teachers = makeTeachers(new Rng(1), ['m1-A', 'm1-B']);
  const codes = ['ท21101', 'ค21102', 'ว21102', 'ส21102', 'อ21102', 'ศ21102', 'ง21101', 'ว21202', 'พ21104', 'แนะแนว', 'ว31202', 'ลส/ยว', 'ว22202'];
  let usedItems = new Set();
  for (const code of codes) {
    for (let s = 1; s <= 40; s++) {
      const rng = new Rng(s);
      const t = makeTask(rng, { teacher: teachers['m1-A'], subject: code, grade: 1, day: s });
      ok(t.id && t.name && t.kind, `task ${code} shape`);
      ok(Number.isInteger(t.dueIn) && t.dueIn >= 1, `task ${code} dueIn ${t.dueIn}`);
      ok(Number.isInteger(t.effort) && t.effort >= 0, `task ${code} effort`);
      ok(Array.isArray(t.requiredItems) && t.requiredItems.every((i) => REQUIRED_ITEM_IDS.includes(i)), `task ${code} items are in REQUIRED_ITEM_IDS`);
      for (const i of t.requiredItems) usedItems.add(i);
      noEmoji(t.name, `task ${code}`);
      eq(makeTask(new Rng(s), { teacher: teachers['m1-A'], subject: code, grade: 1, day: s }), t, `task ${code} deterministic`);
    }
  }
  ok(usedItems.size >= 6, `tasks use most required items (${[...usedItems].join(',')})`);
  ok(makeTask(new Rng(2), { teacher: 'm1-B', subject: 'ลส/ยว', grade: 1, day: 1 }).requiredItems.length > 0, 'scout task needs gear');
  const strict = { key: 's', personality: { strictness: 90 } };
  const chill = { key: 'c', personality: { strictness: 10 } };
  let d1 = 0;
  let d2 = 0;
  for (let s = 1; s <= 200; s++) {
    d1 += makeTask(new Rng(s), { teacher: strict, subject: 'ค21102', grade: 1, day: 1 }).dueIn;
    d2 += makeTask(new Rng(s), { teacher: chill, subject: 'ค21102', grade: 1, day: 1 }).dueIn;
  }
  ok(d1 < d2, 'strict teachers give less time');
}

if (failed) {
  console.error(`\n${failed} of ${checks} checks FAILED`);
  process.exit(1);
}
console.log(`content tests passed (${checks} checks)`);
