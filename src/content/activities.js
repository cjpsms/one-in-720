// School activities: Saturday lessons, freshers, the hall, the Loy Krathong fair, the night show, labs, club crafts.
// Pure data and pure functions (CONTRACT3 section 6). Nothing here keeps state. Randomness only from the passed Rng.
// Every spec/params object is plain JSON (no undefined, NaN, Infinity, functions) and is deterministic from the rng.
// UI text is Thai, no emoji. Names of people are fictional; no real brands.
//
// stat scale: health, energy, stress, knowledge, peer, teacherTrust, diligence are 0-100 (changes are small numbers
// like +2 or -4), money is baht (integer). fx objects only carry the keys that change.
//
// EXPORTS
//   SCHEDULE            calendar numbers for E3 (all PLACEHOLDER unless marked cj).
//   SATURDAY            { [grade 1..6]: { grade, groups:{A,B,C,D}, club } }. group = { id, name, blurb, subjects:[4 x
//                       { code?, name, short, roomKind, kind, teacherKey, foreign? }] }. club = { name, note }.
//   satTeacherKeys()    -> [{ key, foreign }] every Saturday teacher key (feed to makeTeachers).
//   satMood(group, grade?) -> { id, label, difficulty, tone, fx:{stress,energy,knowledge,peer,diligence,teacherTrust} }
//                       for a whole Saturday morning (group object, or 'A'..'D'/'club' with the grade).
//   satGroupForKind(grade, kind) -> 'A'..'D' (the group with the most subjects of that kind, 'A' when none).
//   INGREDIENTS         [{ id, name }] every ingredient a stall can use.
//   makeStalls(rng, { teachers:[{key,name}], dorms:[{key,name}], playerWealth? })
//                       -> 15-25 stalls { id, owner:{kind,key,name}, name, theme, menu:[{id,name,steps,price}],
//                       needHelp, pay:{base,perDish}, trust:'teacher'|null, invest:{min,max}|null }.
//                       Every dorm in `dorms` gets one stall; the rest belong to randomly chosen teachers.
//   serveSpec(rng, stall, { difficulty?, own? }) -> params for the `serve` mini game (CONTRACT3 section 5).
//   investResult(stall, amount, score, rng)  -> { payout, fx, log } (dorm stall investment; fx.money = payout - amount).
//   ownStallOptions(rng, { money }) -> up to 3 { id, name, invest, menu, expected:{min,max} } (invest <= money).
//   ownStallResult(plan, score, rng) -> { income, profit, fx, log } (fx.money = profit, the engine has NOT taken invest yet).
//   CONTESTS            { krathong_creative, krathong_beautiful, dress_fast, costume_beauty } each
//                       { id, title, game, entryNote, specFor(rng, ctx), prize:{ money, peer, tiers:[{maxPlace,label,money,peer,teacherTrust}] } }.
//   rankFromScore(score, rivals, rng) -> { place, of } (rivals = a number or an array of rivals).
//   FLOAT               { texts, wishes, floatSpec(rng), floatResult(score, rng) -> { fx, log, tier, wish } }.
//   HALL                { award:{ spec, result }, lecture:{ topics, spec }, special:[...], farewell:{ reasons, speeches,
//                       spec, text }, fresher:{ sessions, spec }, trustGain:{ chance, texts, roll } } (see each).
//   skipCaught(rng) -> boolean (cj: 50%).   skipOutcome(rng, ctx) -> { caught, fx, log }.
//   hallResult(kind, score, ctx, rng) -> { fx, log, tier }  kind: award|lecture|special|farewell|fresher.
//   SHOW                { themes, roles:[{id,name,game,blurb}], directorPick, showSpec, showResult, roleById }.
//   LAB                 [12 x { id, subject, title, spec(rng) }] + labResult(score, ctx?, rng?) + labById(id).
//                       `steps` params: { title, steps:[{prompt, choices:[3], answer, hold?}], hazard }.
//                       hold (optional, one step) = { label, target:0..1, width:0..1 } (where to stop, how wide the green zone is).
//                       hazard = short Thai warning text shown on the intro card.
//   CLUB_CRAFTS         { [club area]: [ >= 3 x { id, area, title, game, spec(rng) } ] } (areas: math science language computer art
//                       music sport social reading service military) + craftForClub(club, rng?) + clubCraftResult(score, area?, rng?).
//   FRESHER             { days:[3 x { day, title, blocks:[3 x { id, name, what, place, placeKind, play, game, eventId }] }],
//                       titleFor(grade), spec(blockId, rng, ctx) }.  fresherResult(blockId, score, ctx, rng) -> like resolve.
//   COMPANION           who-with scenes: scene(eventId 'fair'|'show'|'fresher'|'date', { friends, partner, acquaintance }) and
//                       companionEffect(eventId, closeness|'alone'|'group', rng, name) (see the block above its code).
//   CRUSH, crushWho, crushScene, resolveCrush   confessions, partner life, check-in, breakups (see the block above its code).
//   XMAS, EPIDEMICS (+ pickEpidemic, epidemicById, epidemicScene, epidemicChip), INFIRMARY, EXAM_SICK   Christmas, outbreaks,
//                       sick-day texts and exam-sickness notices (see the blocks above each).
//   SPORTS, colorOf, sportsResult, colorRanking, colorRankFx   colour sports day (see the block above its code).
//                       COMPANION also has eventId 'sport' (friends filtered to the player's colour, rival line for another colour).
//   expectedScore(game, stats, difficulty) -> 0..1 (deterministic, no noise).   scoreTier(score) -> { id, th }.
//   difficultyFor(game, stats, extra?) -> 0..1 helper for E3.
//   resolve(eventId, game, score, ctx, rng) -> { fx, log, tier }. eventIds:
//     sport_<eventId> (football basketball volleyball takraw sprint relay tug badminton stand cheer) sport_practice
//     xmas_craft xmas_candy (ctx.hit = Santa candy hit the player) xmas_infirmary (ctx.visitor)
//     fresher_hall fresher_game fresher_serve fresher_auto
//     hall_award hall_lecture hall_special hall_farewell hall_fresher
//     loy_stall loy_own loy_float loy_contest_<contestId> loy_prep loy_wander
//     show_act show_camera show_sound show_edit show_director show_watch show_rehearsal
//     science_lab club_craft saturday_club saturday_class
//     ctx keys used: money (never lose more), grade, stall, plan, amount, place, of, contestId, prep, role, labId,
//     area, onStage, closeness (0..1), served, customers, topic.

import { Rng } from '../rng.js';

// ---- small helpers -------------------------------------------------------------------------------------------------

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clamp01 = (x) => clamp(Number.isFinite(x) ? x : 0, 0, 1);
const r1 = (x) => Math.round(x * 10) / 10;
const lerp = (a, b, t) => a + (b - a) * t;
const rint = (rng, [a, b]) => rng.int(a, b);
const copy = (x) => JSON.parse(JSON.stringify(x));

function shuffled(rng, arr) {
  return rng.shuffle(arr.slice());
}

function pickWeighted(rng, items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let r = rng.float() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}

// Remove zero / non-finite entries, round (money to whole baht, the rest to 1 decimal).
function cleanFx(fx) {
  const out = {};
  for (const k of Object.keys(fx)) {
    let v = fx[k];
    if (!Number.isFinite(v)) continue;
    v = k === 'money' ? Math.round(v) : r1(v);
    if (v !== 0) out[k] = v;
  }
  return out;
}

// Scale every key of an fx template: number, or [lo, hi] rolled with rng.
function rollFx(spec, rng) {
  const out = {};
  for (const k of Object.keys(spec)) {
    const s = spec[k];
    out[k] = Array.isArray(s) ? lerp(s[0], s[1], rng.float()) : s;
  }
  return out;
}

function addFx(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + b[k];
  return out;
}

function scaleFx(fx, m) {
  const out = {};
  for (const k of Object.keys(fx)) out[k] = fx[k] * m;
  return out;
}

// ---- scores --------------------------------------------------------------------------------------------------------

export function scoreTier(score) {
  const s = clamp01(score);
  if (s >= 0.8) return { id: 'great', th: 'ยอดเยี่ยม' };
  if (s >= 0.6) return { id: 'good', th: 'ดี' };
  if (s >= 0.4) return { id: 'ok', th: 'พอใช้' };
  return { id: 'bad', th: 'ต้องพยายามอีก' };
}

// Which stats make a student better at which mini game (weights, 0-100 stats, stress counts reversed).
const GAME_STATS = {
  watch: { energy: 0.4, diligence: 0.4, stress: 0.2 },
  serve: { energy: 0.4, peer: 0.3, health: 0.3 },
  craft: { stress: 0.3, peer: 0.2, knowledge: 0.2, energy: 0.3 },
  pattern: { knowledge: 0.3, energy: 0.3, stress: 0.4 },
  dash: { energy: 0.5, health: 0.3, stress: 0.2 },
  timing: { stress: 0.5, energy: 0.3, health: 0.2 },
  rhythm: { energy: 0.3, peer: 0.3, stress: 0.4 },
  track: { energy: 0.4, stress: 0.4, health: 0.2 },
  sequence: { knowledge: 0.5, stress: 0.3, energy: 0.2 },
  steps: { knowledge: 0.6, stress: 0.2, energy: 0.2 },
};
const GAME_BASE = {
  watch: 0.62, serve: 0.6, craft: 0.58, pattern: 0.55, dash: 0.58, timing: 0.52, rhythm: 0.56, track: 0.55, sequence: 0.6, steps: 0.6,
};

// How well an average student with these stats plays (no noise). difficulty 0..1 (0.5 = normal).
export function expectedScore(game, stats, difficulty = 0.5) {
  const w = GAME_STATS[game] || GAME_STATS.watch;
  const st = stats || {};
  let cond = 0;
  let wsum = 0;
  for (const k of Object.keys(w)) {
    const raw = Number.isFinite(st[k]) ? st[k] : 50;
    const v = clamp(raw, 0, 100) / 100;
    cond += (k === 'stress' ? 1 - v : v) * w[k];
    wsum += w[k];
  }
  cond = wsum ? cond / wsum : 0.5;
  const base = GAME_BASE[game] != null ? GAME_BASE[game] : 0.58;
  return clamp(base + 0.3 * (cond - 0.5) - 0.3 * (clamp01(difficulty) - 0.5), 0.05, 0.95);
}

// A difficulty 0..1 from the same stats: tired / stressed / low-knowledge students face a harder game.
export function difficultyFor(game, stats, extra = 0) {
  const w = GAME_STATS[game] || GAME_STATS.watch;
  const st = stats || {};
  let cond = 0;
  let wsum = 0;
  for (const k of Object.keys(w)) {
    const raw = Number.isFinite(st[k]) ? st[k] : 50;
    const v = clamp(raw, 0, 100) / 100;
    cond += (k === 'stress' ? 1 - v : v) * w[k];
    wsum += w[k];
  }
  cond = wsum ? cond / wsum : 0.5;
  return clamp01(0.5 - 0.35 * (cond - 0.5) + extra);
}

// ---- SCHEDULE ------------------------------------------------------------------------------------------------------
// Numbers marked source:'cj' come from cj's own words (round 24). Everything else is PLACEHOLDER.

export const SCHEDULE = {
  saturday: {
    periods: 4, // cj: each group studies 4 periods
    groups: ['A', 'B', 'C', 'D'], // cj
    start: '08:30', // cj: about 08:30-12:00
    end: '12:00',
    periodMinutes: 50, // PLACEHOLDER
    breakMinutes: 10, // PLACEHOLDER
    dayInCycle: 6, // dorm Saturday
    clubMood: 'chill', // cj: "เน้นชิล"
    source: 'cj',
  },
  fresher: {
    days: 3, // cj
    grades: [1, 4], // new entrants of ม.1 and ม.4 (ม.4 mixes with outsiders)
    blocksPerDay: 3, // PLACEHOLDER
    playsTotal: 5, // PLACEHOLDER: about 3-5 real plays over the 3 days, the rest auto
    source: 'cj',
  },
  hall: {
    award: { gpa: 4.0, when: 'termReportFriday', source: 'cj' }, // cj: everyone with 4.00 goes up every term
    lecture: { perTerm: [1, 2], blocks: ['p7', 'p8'], weekday: true }, // PLACEHOLDER numbers
    special: { perYear: 2 }, // PLACEHOLDER
    farewell: { chancePerYear: 0.9, reasons: ['ลาออก', 'เกษียณอายุ 60 ปี'], source: 'cj' }, // chance PLACEHOLDER (about once a year)
    skip: { caughtChance: 0.5, trustDropOnCaught: 6, source: 'cj' }, // cj: 50% caught; trust drop PLACEHOLDER
    trustGainAfterSession: 0.12, // PLACEHOLDER: chance of a "teachers noticed you" item after an attended session
    lectureDiligenceDrop: [0.5, 4], // PLACEHOLDER: min and max drop (cj: you get sleepy, diligence drops)
  },
  fair: {
    term: 2, // moved from term 1 (cj, round 24 later: term 2 = Nov-Mar, so Loy Krathong is mid November)
    cycleInTerm: 2,
    dayInCycle: 6, // the dorm Saturday
    stalls: { min: 15, max: 25, source: 'cj' }, // cj: usually 15-25 stalls
    dormStalls: 1, // cj: each dorm opens 1 stall
    teacherStallChance: 0.4, // PLACEHOLDER: per teacher; makeStalls draws the total count 15-25 first
    ownStallMaxPlans: 3,
    contests: ['krathong_creative', 'krathong_beautiful', 'dress_fast', 'costume_beauty'], // cj
    blocks: ['fair_morning', 'fair_afternoon', 'fair_evening'],
  },
  show: {
    term: 2,
    roleCycle: 3,
    rehearsalCycles: [4, 5, 6, 7],
    showCycle: 8,
    directors: [2, 3], // cj: 2-3 people are directors
    prepPerRehearsal: 0.12, // PLACEHOLDER: pl.showPrep added each rehearsal (0..1 after 4 sessions at ~0.5 = good)
    grades: [1, 2, 3, 4, 5, 6], // cj: one show per grade
    source: 'cj',
  },
  xmas: {
    term: 2,
    cycleInTerm: 4,
    dayInCycle: 3, // PLACEHOLDER: a school day in the middle of the cycle
    hitChance: 0.3, // cj: 30% that Santa's candy hits the player on the head
    blocks: ['xmas_morning', 'xmas_hall'],
    infirmaryPeriods: [1, 2], // PLACEHOLDER
    source: 'cj',
  },
  epidemic: {
    perYearMean: 0.8, // PLACEHOLDER (0-2 outbreaks a year)
    suspendShare: 0.25, // PLACEHOLDER: share of the school sick that closes classes
    suspendDays: [3, 5], // PLACEHOLDER
    recoverDays: [3, 7], // PLACEHOLDER (each disease also has its own range in EPIDEMICS)
  },
  exam: {
    missedCredit: 0.4, // PLACEHOLDER: share of the score a missed exam still counts (E.MISSED_EXAM_CREDIT)
    sickBeforeDays: 3, // cj: sick up to 3 days before an exam = worse score
    sickBeforePenalty: 0.15, // PLACEHOLDER
    sickOnExamDay: 'missed', // cj: sick on the exam day = cannot take it
  },
  sports: {
    term: 1, // PLACEHOLDER
    colors: ['red', 'yellow', 'purple', 'blue'], // cj: แดง เหลือง ม่วง ฟ้า by student number 1,2,3,4,5...
    signupCycle: 3, // PLACEHOLDER
    practiceCycles: [4, 5], // PLACEHOLDER
    practiceBlocks: [6, 8], // PLACEHOLDER
    dayCycle: 6, // PLACEHOLDER: the dorm weekend of cycleInTerm 6
    fridayAfternoon: 'stand', // Friday afternoon: parade and cheer judging (p5-p8 cancelled)
    saturday: 'finals', // Saturday full day
    maxEntries: 2, // cj: up to 2 events, stand counts as one
    studyDrag: 0.9, // PLACEHOLDER (E.SPORT_STUDY_DRAG)
    closenessPractice: 1.5, // PLACEHOLDER
    closenessDay: 5, // PLACEHOLDER
    playerPointsMax: 10, // PLACEHOLDER
    source: 'cj',
  },
  // more plays in term 1 now that the fair, Christmas and the show are all in term 2 (PLACEHOLDER)
  lab: { perYear: [2, 3], preferTerm: 1 },
  clubCraft: { perYear: [2, 3], preferTerm: 1 },
  saturdayPlays: { perYear: [2, 3], preferTerm: 1 },
};

// ---- SATURDAY lessons ----------------------------------------------------------------------------------------------

const ROOM_KIND = {
  thai: 'thai', math: 'math', science: 'science', physics: 'science', chemistry: 'science', biology: 'science', earth: 'science',
  computer: 'computer', social: 'social', history: 'social', religion: 'social', english: 'english', foreignlang: 'english',
  art: 'art', music: 'music', dance: 'dance', health: 'health', pe: 'sport', work: 'workshop', guidance: 'guidance',
  project: 'lab', other: 'generic',
};

// kind-hardness used by satMood (0 easy .. 1 heavy)
const KIND_HARD = {
  physics: 0.82, chemistry: 0.8, math: 0.78, biology: 0.6, science: 0.62, earth: 0.5, computer: 0.62, english: 0.5,
  foreignlang: 0.58, thai: 0.45, social: 0.4, history: 0.4, religion: 0.3, art: 0.2, music: 0.2, dance: 0.25, work: 0.25,
  health: 0.2, pe: 0.3, guidance: 0.25, project: 0.5, other: 0.4,
};

const sub = (kind, name, short, foreign = false) => ({ kind, name, short, foreign });

function buildGroup(grade, id, name, blurb, subs) {
  const subjects = subs.map((s, i) => {
    const tk = s.foreign ? `sat-m${grade}-${id}f` : `sat-m${grade}-${id}${Math.ceil((i + 1) / 2)}`;
    const o = { name: s.name, short: s.short, roomKind: ROOM_KIND[s.kind] || 'generic', kind: s.kind, teacherKey: tk };
    if (s.foreign) o.foreign = true;
    return o;
  });
  return { id, name, blurb, subjects };
}

const CLUB_NOTES = {
  1: 'ชุมนุมวันเสาร์ของน้องเล็ก: เกมกระดาน ร้อยลูกปัด ปั้นดินน้ำมัน นั่งฟังเพลงกับเพื่อน ไม่มีการบ้าน',
  2: 'ชุมนุมวันเสาร์: ซ้อมกีตาร์ใต้ต้นไม้ เล่นกีฬาเบาๆ ถ่ายรูปรอบโรงเรียน ไม่ต้องคิดเลขเลย',
  3: 'ชุมนุมวันเสาร์ก่อนเข้า ม.ปลาย: พักสมองจากการติว เล่นปิงปอง ดูหนังสั้นที่รุ่นพี่ทำ',
  4: 'ชุมนุมวันเสาร์ของเด็ก ม.4: ทำความรู้จักเพื่อนต่างห้อง ซ้อมดนตรี เล่นฟุตซอลเช้าๆ',
  5: 'ชุมนุมวันเสาร์: ชิลก่อนช่วงหนัก ปลูกต้นไม้หน้าตึก ซ้อมวงดนตรี เล่นเกมกระดานยาวๆ',
  6: 'ชุมนุมวันเสาร์ปีสุดท้าย: นั่งเล่นกับเพื่อนก่อนจากกัน เก็บรูปรุ่น เขียนข้อความใส่สมุดเยียร์บุ๊ก',
};

function makeSaturday() {
  const S = {};
  S[1] = {
    A: buildGroup(1, 'A', 'คณิต-วิทย์ปูพื้น', 'เลขคิดเร็ว ปริศนาตรรกะ และทดลองวิทย์ง่ายๆ เหมาะกับคนชอบคิด', [
      sub('math', 'คณิตคิดเร็ว', 'คณิตเร็ว'), sub('science', 'วิทย์รอบตัว', 'วิทย์รอบตัว'),
      sub('math', 'ปริศนาตรรกะและเกมตัวเลข', 'ตรรกะ'), sub('science', 'ทดลองง่ายๆ ในห้องแล็บ', 'ทดลอง'),
    ]),
    B: buildGroup(1, 'B', 'ภาษาและการอ่าน', 'อังกฤษสนุกๆ อ่านจับใจความ เขียนเล่าเรื่อง', [
      sub('english', 'อังกฤษเพื่อการสื่อสาร', 'อังกฤษสื่อสาร'), sub('english', 'ฟังและพูดกับครูต่างชาติ', 'พูดกับครูฝรั่ง', true),
      sub('thai', 'อ่านจับใจความ', 'อ่านจับใจความ'), sub('thai', 'เขียนเล่าเรื่องจากภาพ', 'เขียนเล่าเรื่อง'),
    ]),
    C: buildGroup(1, 'C', 'คอมพิวเตอร์สร้างสรรค์', 'เขียนโปรแกรมแบบบล็อกสี ทำแอนิเมชันสั้น ออกแบบกราฟิก', [
      sub('computer', 'เขียนโปรแกรมแบบบล็อก', 'โปรแกรมบล็อก'), sub('computer', 'ทำแอนิเมชันสั้น', 'แอนิเมชัน'),
      sub('art', 'ออกแบบกราฟิกง่ายๆ', 'กราฟิก'), sub('computer', 'พิมพ์สัมผัสและทำเอกสาร', 'พิมพ์สัมผัส'),
    ]),
    D: buildGroup(1, 'D', 'ศิลป์และดนตรี', 'วาดรูป ดนตรี รำไทยเบื้องต้น และงานประดิษฐ์', [
      sub('art', 'วาดภาพระบายสี', 'วาดภาพ'), sub('music', 'ดนตรีเบื้องต้น', 'ดนตรี'),
      sub('dance', 'นาฏศิลป์ไทยพื้นฐาน', 'รำไทย'), sub('work', 'งานประดิษฐ์จากวัสดุธรรมชาติ', 'งานประดิษฐ์'),
    ]),
  };
  S[2] = {
    A: buildGroup(2, 'A', 'เตรียมคณิตให้แน่น', 'พีชคณิต เรขาคณิต โจทย์ปัญหา สถิติ สำหรับคนที่อยากไปไกลกว่าในห้อง', [
      sub('math', 'พีชคณิตเบื้องต้น', 'พีชคณิต'), sub('math', 'เรขาคณิตมหัศจรรย์', 'เรขาคณิต'),
      sub('math', 'ตะลุยโจทย์ปัญหา', 'โจทย์ปัญหา'), sub('math', 'สถิติรอบตัว', 'สถิติ'),
    ]),
    B: buildGroup(2, 'B', 'วิทยาศาสตร์ลงมือทำ', 'เคมีในครัว แรงและการเคลื่อนที่ ชีวิตในหยดน้ำ และโครงงานชิ้นเล็ก', [
      sub('science', 'เคมีในครัว', 'เคมีในครัว'), sub('physics', 'แรงและการเคลื่อนที่', 'แรงเคลื่อนที่'),
      sub('biology', 'ชีวิตในหยดน้ำ', 'ชีวิตในหยดน้ำ'), sub('project', 'โครงงานวิทย์ชิ้นเล็ก', 'โครงงานวิทย์'),
    ]),
    C: buildGroup(2, 'C', 'อังกฤษ จีน ญี่ปุ่น', 'อ่านพูดอังกฤษ แล้วลองภาษาจีนกับญี่ปุ่นพื้นฐาน', [
      sub('english', 'Reading Club', 'Reading'), sub('english', 'Speaking Lab', 'Speaking', true),
      sub('foreignlang', 'ภาษาจีนพื้นฐาน', 'จีนพื้นฐาน'), sub('foreignlang', 'ภาษาญี่ปุ่นพื้นฐาน', 'ญี่ปุ่นพื้นฐาน'),
    ]),
    D: buildGroup(2, 'D', 'สังคมรอบตัว', 'ภูมิศาสตร์ท้องถิ่น ประวัติศาสตร์เล่าเรื่อง กฎหมายใกล้ตัว และการเงินวัยรุ่น', [
      sub('social', 'ภูมิศาสตร์ท้องถิ่น', 'ภูมิศาสตร์'), sub('history', 'ประวัติศาสตร์เล่าเรื่อง', 'ประวัติเล่าเรื่อง'),
      sub('social', 'กฎหมายใกล้ตัว', 'กฎหมายใกล้ตัว'), sub('social', 'การเงินวัยรุ่น', 'การเงินวัยรุ่น'),
    ]),
  };
  S[3] = {
    A: buildGroup(3, 'A', 'ตะลุยคณิตก่อนด่าน ม.4', 'เลขยกกำลัง กราฟ เรขาคณิตขั้นสูง ความน่าจะเป็น และข้อสอบเก่า', [
      sub('math', 'เลขยกกำลังและกราฟ', 'ยกกำลัง-กราฟ'), sub('math', 'เรขาคณิตขั้นสูง', 'เรขาคณิตสูง'),
      sub('math', 'ความน่าจะเป็น', 'ความน่าจะเป็น'), sub('math', 'ข้อสอบเก่าเข้า ม.4', 'ข้อสอบเก่า'),
    ]),
    B: buildGroup(3, 'B', 'วิทย์ติวเข้ม', 'ฟิสิกส์ เคมี ชีวะเบื้องต้น และติวข้อสอบวิทย์รวม', [
      sub('physics', 'ฟิสิกส์เบื้องต้น', 'ฟิสิกส์เบื้องต้น'), sub('chemistry', 'เคมีพื้นฐาน', 'เคมีพื้นฐาน'),
      sub('biology', 'ชีววิทยาเบื้องต้น', 'ชีวะเบื้องต้น'), sub('science', 'ติวข้อสอบวิทย์รวม', 'ติวข้อสอบวิทย์'),
    ]),
    C: buildGroup(3, 'C', 'ไทย-อังกฤษ ติวสอบ', 'อ่านวิเคราะห์ เขียนเรียงความ ไวยากรณ์อังกฤษ และฝึกฟัง', [
      sub('thai', 'อ่านวิเคราะห์และเขียนเรียงความ', 'อ่าน-เขียนไทย'), sub('thai', 'หลักภาษาไทยเข้ม', 'หลักภาษา'),
      sub('english', 'ไวยากรณ์อังกฤษเข้ม', 'ไวยากรณ์'), sub('english', 'ฝึกฟังและสนทนา', 'ฟัง-สนทนา', true),
    ]),
    D: buildGroup(3, 'D', 'โค้ดดิ้งเริ่มต้น', 'ตัวแปร เงื่อนไข วนซ้ำ อาร์เรย์ แก้โจทย์เล็กๆ ด้วยโปรแกรม', [
      sub('computer', 'ตัวแปรและเงื่อนไข', 'ตัวแปร-เงื่อนไข'), sub('computer', 'การวนซ้ำ', 'วนซ้ำ'),
      sub('computer', 'อาร์เรย์และสตริง', 'อาร์เรย์'), sub('computer', 'แก้โจทย์เล็กด้วยโปรแกรม', 'แก้โจทย์'),
    ]),
  };
  S[4] = {
    A: buildGroup(4, 'A', 'สายวิทย์-คณิต ขั้นแรก', 'กลศาสตร์ อะตอม ฟังก์ชัน และเซลล์', [
      sub('physics', 'ฟิสิกส์ กลศาสตร์เบื้องต้น', 'ฟิสิกส์กลศาสตร์'), sub('chemistry', 'เคมี โครงสร้างอะตอม', 'เคมีอะตอม'),
      sub('math', 'คณิตเพิ่มเติม ฟังก์ชัน', 'คณิตฟังก์ชัน'), sub('biology', 'ชีววิทยา เซลล์', 'ชีวะเซลล์'),
    ]),
    B: buildGroup(4, 'B', 'สายภาษา', 'อังกฤษเชิงวิชาการ จีนสนทนา ญี่ปุ่น และเขียนเชิงวิชาการ', [
      sub('english', 'Academic English', 'Academic Eng'), sub('foreignlang', 'ภาษาจีนสนทนา', 'จีนสนทนา', true),
      sub('foreignlang', 'ภาษาญี่ปุ่นสำหรับเริ่มต้น', 'ญี่ปุ่นเริ่มต้น'), sub('thai', 'การเขียนเชิงวิชาการ', 'เขียนวิชาการ'),
    ]),
    C: buildGroup(4, 'C', 'คอมพิวเตอร์และอัลกอริทึม', 'อัลกอริทึมพื้นฐาน โครงสร้างข้อมูล เว็บเบื้องต้น และเกมเล็กด้วยโค้ด', [
      sub('computer', 'อัลกอริทึมพื้นฐาน', 'อัลกอริทึม'), sub('computer', 'โครงสร้างข้อมูลเบื้องต้น', 'โครงสร้างข้อมูล'),
      sub('computer', 'เว็บเบื้องต้น', 'เว็บเบื้องต้น'), sub('computer', 'ทำเกมเล็กด้วยโค้ด', 'เกมเล็ก'),
    ]),
    D: buildGroup(4, 'D', 'สังคมและศิลป์', 'เศรษฐศาสตร์ ประวัติศาสตร์โลก งานออกแบบ และวรรณคดีเปรียบเทียบ', [
      sub('social', 'เศรษฐศาสตร์เบื้องต้น', 'เศรษฐศาสตร์'), sub('history', 'ประวัติศาสตร์โลก', 'ประวัติโลก'),
      sub('art', 'งานออกแบบสร้างสรรค์', 'ออกแบบ'), sub('thai', 'วรรณคดีเปรียบเทียบ', 'วรรณคดี'),
    ]),
  };
  S[5] = {
    A: buildGroup(5, 'A', 'วิทย์-คณิต เข้มข้น', 'ไฟฟ้าและคลื่น เคมีอินทรีย์ แคลคูลัสเริ่มต้น และพันธุศาสตร์', [
      sub('physics', 'ฟิสิกส์ ไฟฟ้าและคลื่น', 'ฟิสิกส์ไฟฟ้า-คลื่น'), sub('chemistry', 'เคมีอินทรีย์เบื้องต้น', 'เคมีอินทรีย์'),
      sub('math', 'แคลคูลัสเริ่มต้น', 'แคลคูลัส'), sub('biology', 'พันธุศาสตร์', 'พันธุศาสตร์'),
    ]),
    B: buildGroup(5, 'B', 'สายสุขภาพและการแพทย์', 'ร่างกายมนุษย์ เคมีชีวภาพ สถิติสุขภาพ และเตรียมสัมภาษณ์', [
      sub('biology', 'ชีววิทยาร่างกายมนุษย์', 'ชีวะร่างกาย'), sub('chemistry', 'เคมีชีวภาพ', 'เคมีชีวภาพ'),
      sub('math', 'สถิติและงานวิจัยสุขภาพ', 'สถิติสุขภาพ'), sub('guidance', 'เตรียมสัมภาษณ์คณะแพทย์ฯ', 'เตรียมสัมภาษณ์'),
    ]),
    C: buildGroup(5, 'C', 'โปรแกรมมิ่งแข่งขัน', 'อัลกอริทึมแข่งขัน กราฟ ไดนามิกโปรแกรมมิ่ง และซ้อมข้อสอบ', [
      sub('computer', 'อัลกอริทึมแข่งขัน', 'อัลกอริทึมแข่ง'), sub('computer', 'กราฟและการค้นหา', 'กราฟ-ค้นหา'),
      sub('computer', 'ไดนามิกโปรแกรมมิ่ง', 'ไดนามิก'), sub('computer', 'ซ้อมข้อสอบคอมพิวเตอร์โอลิมปิก', 'ซ้อมข้อสอบคอม'),
    ]),
    D: buildGroup(5, 'D', 'ภาษา ธุรกิจ และการนำเสนอ', 'ภาษาธุรกิจ การตลาด การเงิน และโต้วาทีอังกฤษ', [
      sub('english', 'ภาษาอังกฤษเพื่อธุรกิจ', 'อังกฤษธุรกิจ', true), sub('social', 'การตลาดและการเงินเบื้องต้น', 'การตลาด-การเงิน'),
      sub('thai', 'การนำเสนอและการพูดในที่ชุมนุม', 'พูดในที่ชุมนุม'), sub('english', 'English Debate', 'Debate'),
    ]),
  };
  S[6] = {
    A: buildGroup(6, 'A', 'ทบทวนสายวิทย์ก่อนสอบใหญ่', 'ฟิสิกส์ เคมี คณิต ชีวะ ซ้อมข้อสอบสายวิทย์ทั้งชุด', [
      sub('physics', 'ทบทวนฟิสิกส์ทั้งชุด', 'ทบทวนฟิสิกส์'), sub('chemistry', 'ทบทวนเคมีทั้งชุด', 'ทบทวนเคมี'),
      sub('math', 'ทบทวนคณิตทั้งชุด', 'ทบทวนคณิต'), sub('biology', 'ทบทวนชีววิทยาทั้งชุด', 'ทบทวนชีวะ'),
    ]),
    B: buildGroup(6, 'B', 'ภาษาและการอ่านเชิงวิเคราะห์', 'ซ้อมข้อสอบภาษาอังกฤษ ไทย และการอ่านวิเคราะห์', [
      sub('english', 'ซ้อมข้อสอบอังกฤษ', 'ซ้อมสอบอังกฤษ'), sub('english', 'ฟังและตอบแบบเจ้าของภาษา', 'ฟังตอบ', true),
      sub('thai', 'อ่านวิเคราะห์ข้อสอบไทย', 'อ่านวิเคราะห์'), sub('social', 'สังคมและการคิดเชิงวิพากษ์', 'คิดเชิงวิพากษ์'),
    ]),
    C: buildGroup(6, 'C', 'พอร์ตและสัมภาษณ์', 'ทำแฟ้มสะสมงาน เขียนเรียงความสมัครเรียน ซ้อมสัมภาษณ์ และเลือกคณะ', [
      sub('guidance', 'ทำแฟ้มสะสมงาน', 'แฟ้มสะสมงาน'), sub('thai', 'เขียนเรียงความสมัครเรียน', 'เรียงความสมัคร'),
      sub('guidance', 'ซ้อมสัมภาษณ์', 'ซ้อมสัมภาษณ์'), sub('guidance', 'เลือกคณะและสาขา', 'เลือกคณะ'),
    ]),
    D: buildGroup(6, 'D', 'สอบตรงสายคอมพิวเตอร์', 'โจทย์โปรแกรมมิ่ง ตรรกะ คณิตสำหรับคอม และซ้อมสอบตรง', [
      sub('computer', 'โจทย์โปรแกรมมิ่งข้อสอบตรง', 'โจทย์โปรแกรมมิ่ง'), sub('computer', 'ตรรกะและการคิดเชิงคำนวณ', 'ตรรกะคำนวณ'),
      sub('math', 'คณิตสำหรับสายคอมพิวเตอร์', 'คณิตสายคอม'), sub('computer', 'ซ้อมสอบตรงเต็มชุด', 'ซ้อมสอบตรง'),
    ]),
  };
  const out = {};
  for (let g = 1; g <= 6; g++) {
    out[g] = { grade: g, groups: S[g], club: { name: 'ชุมนุมวันเสาร์', note: CLUB_NOTES[g] } };
  }
  return out;
}

export const SATURDAY = makeSaturday();

export function satTeacherKeys() {
  const seen = new Map();
  for (const g of Object.keys(SATURDAY)) {
    for (const grp of Object.values(SATURDAY[g].groups)) {
      for (const s of grp.subjects) if (!seen.has(s.teacherKey)) seen.set(s.teacherKey, !!s.foreign);
    }
  }
  return [...seen.entries()].map(([key, foreign]) => ({ key, foreign }));
}

function groupOf(group, grade) {
  if (group && typeof group === 'object') return group;
  if (group === 'club' || group == null) return null;
  const g = SATURDAY[grade || 1];
  return g ? g.groups[group] || null : null;
}

// What a whole Saturday morning does to the student.
export function satMood(group, grade) {
  const grp = groupOf(group, grade);
  if (!grp) {
    return {
      id: 'club', label: 'ชิล ชุมนุมวันเสาร์', difficulty: 0, tone: 'good',
      fx: { stress: -4, energy: -1, peer: 1.5, knowledge: 0, diligence: 0.3, teacherTrust: 0 },
    };
  }
  let hard = 0;
  for (const s of grp.subjects) hard += KIND_HARD[s.kind] != null ? KIND_HARD[s.kind] : 0.4;
  hard /= grp.subjects.length;
  const gradeAdj = (((grade || Number(String(grp.subjects[0].teacherKey).match(/m(\d)/)?.[1]) || 1) - 1) / 5) * 0.12;
  const difficulty = r1(clamp01(hard + gradeAdj) * 100) / 100;
  const label = difficulty >= 0.75 ? 'หนักและเข้มข้น' : difficulty >= 0.55 ? 'พอเหนื่อย ได้ความรู้' : 'สบายๆ ไม่กดดัน';
  return {
    id: grp.id,
    label,
    difficulty,
    tone: difficulty >= 0.75 ? 'bad' : 'neutral',
    fx: {
      stress: r1(1 + difficulty * 5),
      energy: r1(-2 - difficulty * 4),
      knowledge: r1(1 + difficulty * 2.5),
      peer: 0.5,
      diligence: r1(0.2 + difficulty * 0.8),
      teacherTrust: r1(0.3 + difficulty * 0.4),
    },
  };
}

export function satGroupForKind(grade, kind) {
  const g = SATURDAY[grade];
  if (!g) return 'A';
  let best = 'A';
  let bestN = 0;
  for (const id of SCHEDULE.saturday.groups) {
    const n = g.groups[id].subjects.filter((s) => s.kind === kind).length;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}


// ---- Loy Krathong fair: stalls -------------------------------------------------------------------------------------

export const INGREDIENTS = [
  ['sausage', 'ไส้กรอก'], ['stick', 'ไม้เสียบ'], ['meatball', 'ลูกชิ้น'], ['cheese', 'ชีส'], ['sauce', 'น้ำจิ้ม'],
  ['batter', 'แป้งชุบ'], ['oil', 'น้ำมันร้อน'], ['banana', 'กล้วย'], ['potato', 'มันฝรั่ง'], ['taro', 'เผือก'],
  ['bag', 'ถุงกระดาษ'], ['coconut', 'กะทิ'], ['corn', 'ข้าวโพด'], ['ice', 'น้ำแข็ง'], ['cup', 'แก้ว'],
  ['syrup', 'น้ำหวาน'], ['milk', 'นมสด'], ['butter', 'เนย'], ['sugar', 'น้ำตาล'], ['squid', 'หมึก'],
  ['mayo', 'มายองเนส'], ['bonito', 'ปลาโรย'], ['box', 'กล่องโฟม'], ['tea', 'ชา'], ['pearl', 'ไข่มุก'],
  ['straw', 'หลอด'], ['papaya', 'มะละกอ'], ['chili', 'พริก'], ['lime', 'มะนาว'], ['peanut', 'ถั่วลิสง'],
  ['chicken', 'ไก่'], ['spice', 'ผงปรุงรส'], ['cream', 'วิปครีม'], ['fruit', 'ผลไม้หั่น'], ['chocolate', 'ช็อกโกแลต'],
  ['noodle', 'เส้นจันท์'], ['egg', 'ไข่'], ['shrimp', 'กุ้ง'], ['veg', 'ผัก'], ['dumpling', 'ลูกบัวลอย'],
  ['ginger', 'ขิง'], ['jelly', 'เฉาก๊วย'], ['mango', 'มะม่วง'], ['rice', 'ข้าว'], ['basil', 'ใบกะเพรา'],
  ['pork', 'หมูสับ'], ['bread', 'ขนมปัง'], ['soda', 'โซดา'], ['flour', 'แป้งโรตี'],
].map(([id, name]) => ({ id, name }));

const INGR_NAME = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.name]));

const D = (name, steps, price) => ({ name, steps, price });

// theme: names = funny stall names (invented), dishes = 3-4 dishes: steps are ingredient ids in the order to tap.
const STALL_THEMES = [
  { id: 'grill', names: ['ไส้กรอกไม่มีวันหมด', 'ปิ้งจนควันฟ้า', 'ย่างให้ใจเต้น'],
    dishes: [D('ไส้กรอกย่าง', ['sausage', 'stick', 'sauce'], 15), D('ลูกชิ้นปิ้ง', ['meatball', 'stick', 'sauce'], 10), D('ไส้กรอกชีสยัดไส้', ['sausage', 'cheese', 'stick', 'sauce'], 25)] },
  { id: 'banana', names: ['กล้วยทอดสะท้านภพ', 'ทอดมันส์ทอดมัน', 'ทอดแล้วอย่าทอดทิ้ง'],
    dishes: [D('กล้วยทอด', ['banana', 'batter', 'oil', 'bag'], 15), D('มันทอด', ['potato', 'batter', 'oil', 'bag'], 15), D('เผือกทอด', ['taro', 'batter', 'oil', 'bag'], 20)] },
  { id: 'krok', names: ['ครกนี้มีรัก', 'ขนมครกร้อนๆ ใจร้อนๆ', 'ครกเดียวไม่พอ'],
    dishes: [D('ขนมครกต้นหอม', ['batter', 'coconut', 'box'], 20), D('ขนมครกข้าวโพด', ['batter', 'coconut', 'corn', 'box'], 25), D('ขนมครกไข่เค็ม', ['batter', 'coconut', 'egg', 'box'], 30)] },
  { id: 'ice', names: ['น้ำแข็งใสใจหาย', 'หนาวนี้ต้องมีเธอ', 'ใสๆ ไม่ใส่สี'],
    dishes: [D('น้ำแข็งใสน้ำหวาน', ['cup', 'ice', 'syrup'], 15), D('น้ำแข็งใสนมสด', ['cup', 'ice', 'syrup', 'milk'], 25), D('น้ำแข็งใสข้าวโพด', ['cup', 'ice', 'corn', 'milk'], 25)] },
  { id: 'roti', names: ['โรตีสายไหมสายใย', 'โรตีรักแท้', 'สายไหมไม่ไหลทิ้ง'],
    dishes: [D('โรตีสายไหม', ['flour', 'butter', 'sugar', 'bag'], 20), D('โรตีกล้วยไข่', ['flour', 'butter', 'banana', 'bag'], 30), D('โรตีช็อกโกแลต', ['flour', 'butter', 'chocolate', 'bag'], 30)] },
  { id: 'tako', names: ['ทาโกะยากิกลมกลิ้ง', 'ปลาหมึกหลงทาง', 'ลูกกลมๆ เพื่อนรัก'],
    dishes: [D('ทาโกะยากิ 6 ลูก', ['batter', 'squid', 'mayo', 'bonito', 'box'], 35), D('ทาโกะชีส', ['batter', 'squid', 'cheese', 'mayo', 'box'], 45), D('ทาโกะซอสพิเศษ', ['batter', 'squid', 'sauce', 'box'], 40)] },
  { id: 'tea', names: ['ชานมไข่มุกไม่รู้ดับ', 'ไข่มุกในใจ', 'ชาเย็นเป็นห่วง'],
    dishes: [D('ชานมไข่มุก', ['cup', 'tea', 'milk', 'pearl', 'straw'], 30), D('ชาเย็น', ['cup', 'tea', 'ice', 'straw'], 20), D('ชามะนาว', ['cup', 'tea', 'lime', 'ice'], 20)] },
  { id: 'somtam', names: ['ตำจนมือหงิก', 'ส้มตำนัวนัว', 'ตำแล้วต้องตำอีก'],
    dishes: [D('ส้มตำไทย', ['papaya', 'chili', 'lime', 'peanut', 'box'], 30), D('ตำข้าวโพด', ['corn', 'chili', 'lime', 'box'], 30), D('ตำกุ้งแห้ง', ['papaya', 'shrimp', 'chili', 'lime', 'box'], 35)] },
  { id: 'chicken', names: ['ไก่ทอดไก่เกี่ยว', 'ไก่ทอดกรอบจนใจสั่น', 'ไก่ไม่เล็ก'],
    dishes: [D('ไก่ทอดสามชิ้น', ['chicken', 'batter', 'oil', 'box'], 35), D('ไก่ป๊อป', ['chicken', 'batter', 'oil', 'spice', 'bag'], 30), D('ไก่ทอดซอสเผ็ด', ['chicken', 'batter', 'oil', 'sauce', 'box'], 40)] },
  { id: 'spiral', names: ['มันฝรั่งเกลียวเขย่าใจ', 'เกลียวรักมันฝรั่ง', 'เกลียวเด็ดเสียบไม้'],
    dishes: [D('มันเกลียวผงชีส', ['potato', 'stick', 'oil', 'cheese'], 30), D('มันเกลียวผงปรุง', ['potato', 'stick', 'oil', 'spice'], 25), D('มันเกลียวซอส', ['potato', 'stick', 'oil', 'sauce'], 30)] },
  { id: 'crepe', names: ['เครปบางเบา', 'เครปเราและเธอ', 'พับครึ่งหัวใจ'],
    dishes: [D('เครปผลไม้', ['batter', 'fruit', 'cream', 'bag'], 35), D('เครปช็อกโกแลต', ['batter', 'chocolate', 'cream', 'bag'], 35), D('เครปกล้วยนม', ['batter', 'banana', 'milk', 'bag'], 30)] },
  { id: 'padthai', names: ['ผัดไทยไม่ผัดใจ', 'ผัดไทยไฟแรง', 'เส้นนี้พี่ผัดเอง'],
    dishes: [D('ผัดไทยกุ้งสด', ['noodle', 'egg', 'shrimp', 'peanut', 'box'], 40), D('ผัดไทยไข่ห่อ', ['noodle', 'egg', 'veg', 'box'], 35), D('ผัดไทยเจ', ['noodle', 'veg', 'peanut', 'box'], 30)] },
  { id: 'buloy', names: ['บัวลอยลอยไปไหน', 'บัวลอยไข่หวาน', 'ลูกบัวสีรุ้ง'],
    dishes: [D('บัวลอยไข่หวาน', ['dumpling', 'coconut', 'egg', 'cup'], 25), D('บัวลอยขิง', ['dumpling', 'ginger', 'sugar', 'cup'], 25), D('บัวลอยมะพร้าวอ่อน', ['dumpling', 'coconut', 'sugar', 'cup'], 30)] },
  { id: 'jelly', names: ['ดำสนิทแต่ใจขาว', 'เฉาก๊วยนมสดแสนสุข', 'ดำปี๋แต่ฟิน'],
    dishes: [D('เฉาก๊วยนมสด', ['cup', 'jelly', 'milk', 'ice'], 20), D('เฉาก๊วยน้ำผึ้งมะนาว', ['cup', 'jelly', 'lime', 'ice'], 25), D('เฉาก๊วยชานม', ['cup', 'jelly', 'tea', 'milk'], 25)] },
  { id: 'squid', names: ['หมึกย่างหอมไปสามบ้าน', 'หมึกตัวนี้พี่ย่างเอง', 'หมึกกรุบกรอบ'],
    dishes: [D('หมึกย่างเสียบไม้', ['squid', 'stick', 'sauce'], 25), D('หมึกย่างพริกเกลือ', ['squid', 'stick', 'chili'], 30), D('หมึกย่างน้ำจิ้มซีฟู้ด', ['squid', 'stick', 'sauce', 'lime'], 30)] },
  { id: 'mango', names: ['ข้าวเหนียวมะม่วงมาแล้ว', 'เหนียวแน่นกับมะม่วง', 'มะม่วงสุกใจเหนียว'],
    dishes: [D('ข้าวเหนียวมะม่วง', ['rice', 'coconut', 'mango', 'box'], 45), D('ข้าวเหนียวทุเรียน', ['rice', 'coconut', 'fruit', 'box'], 55), D('ข้าวเหนียวหน้ากะทิ', ['rice', 'coconut', 'sugar', 'box'], 25)] },
  { id: 'soda', names: ['โซดามะนาวซ่าส์ๆ', 'ซ่าสุดซอย', 'เปรี้ยวปากหวานใจ'],
    dishes: [D('น้ำมะนาวโซดา', ['cup', 'lime', 'soda', 'ice'], 20), D('น้ำสตรอว์เบอร์รีโซดา', ['cup', 'syrup', 'soda', 'ice'], 20), D('น้ำขิงมะนาว', ['cup', 'ginger', 'lime', 'sugar'], 20)] },
  { id: 'basil', names: ['กะเพราไข่ดาวสะเทือนใจ', 'กะเพราร้อนๆ ไข่ลอยๆ', 'เผ็ดแล้วต้องมา'],
    dishes: [D('ข้าวกะเพราหมูไข่ดาว', ['rice', 'pork', 'basil', 'egg', 'box'], 35), D('ข้าวกะเพราไก่', ['rice', 'chicken', 'basil', 'box'], 35), D('ข้าวไข่เจียว', ['rice', 'egg', 'sauce', 'box'], 25)] },
  { id: 'toast', names: ['ขนมปังปิ้งนมข้นอาลัย', 'ปิ้งทีเดียวติดใจ', 'นมข้นกู้ชีวิต'],
    dishes: [D('ขนมปังปิ้งนมข้น', ['bread', 'butter', 'milk', 'bag'], 20), D('ขนมปังปิ้งสังขยา', ['bread', 'butter', 'sugar', 'bag'], 20), D('ขนมปังปิ้งช็อกโกแลต', ['bread', 'butter', 'chocolate', 'bag'], 25)] },
  { id: 'corn', names: ['ข้าวโพดเคลือบเนย', 'ฝักข้าวโพดฝักอารมณ์', 'ข้าวโพดใจฟู'],
    dishes: [D('ข้าวโพดต้มเคลือบเนย', ['corn', 'butter', 'cup'], 25), D('ข้าวโพดคั่วรสชีส', ['corn', 'cheese', 'cup'], 25), D('ข้าวโพดหวานตักถ้วย', ['corn', 'milk', 'sugar', 'cup'], 20)] },
];

function threeDishes(rng, theme) {
  const picked = shuffled(rng, theme.dishes).slice(0, 3);
  return picked.map((d, i) => ({ id: `${theme.id}-${i + 1}`, name: d.name, steps: d.steps.slice(), price: d.price }));
}

function stallIngredients(rng, menu, decoys = 3) {
  const used = [];
  for (const m of menu) for (const s of m.steps) if (!used.includes(s)) used.push(s);
  const others = shuffled(rng, INGREDIENTS.map((i) => i.id).filter((id) => !used.includes(id))).slice(0, decoys);
  return shuffled(rng, used.concat(others)).map((id) => ({ id, name: INGR_NAME[id] }));
}

const WEALTH_INVEST = { poor: 60, normal: 100, spoiled: 250, rich: 500 };

function investMax(playerWealth) {
  if (typeof playerWealth === 'number' && Number.isFinite(playerWealth)) return clamp(Math.round((playerWealth * 0.25) / 10) * 10, 50, 500);
  if (typeof playerWealth === 'string' && WEALTH_INVEST[playerWealth]) return WEALTH_INVEST[playerWealth];
  return 100;
}

export function makeStalls(rng, { teachers = [], dorms = [], playerWealth } = {}) {
  const wantTotal = rng.int(SCHEDULE.fair.stalls.min, SCHEDULE.fair.stalls.max);
  const dormList = dorms.map((d) => ({ key: d.key, name: d.name }));
  const total = Math.max(wantTotal, dormList.length);
  const teacherCount = Math.min(Math.max(0, total - dormList.length), teachers.length);
  const teacherList = shuffled(rng, teachers).slice(0, teacherCount).map((t) => ({ key: t.key, name: t.name }));
  const owners = [
    ...dormList.map((o) => ({ kind: 'dorm', ...o })),
    ...teacherList.map((o) => ({ kind: 'teacher', ...o })),
  ];
  const themes = shuffled(rng, STALL_THEMES);
  const usedNames = new Set();
  const stalls = [];
  owners.forEach((owner, i) => {
    const theme = themes[i % themes.length];
    // unique funny name: try the theme's names, then a numbered branch
    const options = shuffled(rng, theme.names);
    let name = options.find((n) => !usedNames.has(n));
    if (!name) {
      let k = 2;
      while (usedNames.has(`${options[0]} สาขา ${k}`)) k++;
      name = `${options[0]} สาขา ${k}`;
    }
    usedNames.add(name);
    const isTeacher = owner.kind === 'teacher';
    stalls.push({
      id: `stall-${i + 1}`,
      owner,
      name,
      theme: theme.id,
      menu: threeDishes(rng, theme),
      needHelp: isTeacher ? rng.chance(0.85) : rng.chance(0.6),
      pay: isTeacher ? { base: rint(rng, [40, 70]), perDish: rint(rng, [2, 4]) } : { base: rint(rng, [10, 30]), perDish: rint(rng, [1, 2]) },
      trust: isTeacher ? 'teacher' : null,
      invest: isTeacher ? null : { min: 20, max: investMax(playerWealth) },
    });
  });
  return shuffled(rng, stalls).map((s, i) => ({ ...s, id: `stall-${i + 1}` }));
}

// Params of the `serve` mini game for a stall (work for it, or run your own).
export function serveSpec(rng, stall, { difficulty = 0.5, own = false } = {}) {
  const d = clamp01(difficulty);
  const customers = own ? rint(rng, [12, 18]) : rint(rng, [8, 12]);
  return {
    stallName: stall.name,
    menu: stall.menu.map((m) => ({ id: m.id, name: m.name, steps: m.steps.slice(), price: m.price })),
    ingredients: stallIngredients(rng, stall.menu, 2 + Math.round(d * 2)),
    customers,
    patience: r1(lerp(9, 5, d)),
  };
}

export function investResult(stall, amount, score, rng) {
  const s = clamp01(score);
  const amt = Math.max(0, Math.round(amount));
  const payout = Math.round(amt * lerp(0.5, 1.6, s) * (0.9 + rng.float() * 0.2));
  const net = payout - amt;
  const nm = stall && stall.name ? stall.name : 'ร้านของหอ';
  const log = net >= 0
    ? `ลงทุนร้าน ${nm} ${amt} บาท ได้คืน ${payout} บาท กำไร ${net} บาท`
    : `ลงทุนร้าน ${nm} ${amt} บาท ได้คืนแค่ ${payout} บาท ขาดทุน ${-net} บาท`;
  return { payout, fx: cleanFx({ money: net, peer: 1 + s * 2, stress: net < 0 ? 2 : -1 }), log };
}

const PLAN_TEMPLATES = [
  { tier: 0, theme: 'toast', title: 'ขนมปังปิ้งนมข้น', invest: [30, 50], mult: [0.7, 1.9] },
  { tier: 0, theme: 'soda', title: 'น้ำมะนาวโซดาเย็นฉ่ำ', invest: [30, 50], mult: [0.6, 2.0] },
  { tier: 0, theme: 'grill', title: 'ลูกชิ้นปิ้งหน้าหอ', invest: [40, 60], mult: [0.6, 2.0] },
  { tier: 1, theme: 'tea', title: 'ชานมไข่มุกเย็น', invest: [100, 160], mult: [0.5, 2.3] },
  { tier: 1, theme: 'tako', title: 'ทาโกะยากิร้อนๆ', invest: [110, 170], mult: [0.5, 2.4] },
  { tier: 1, theme: 'roti', title: 'โรตีสายไหมสีรุ้ง', invest: [90, 140], mult: [0.55, 2.2] },
  { tier: 2, theme: 'chicken', title: 'ไก่ทอดกรอบสะท้านงาน', invest: [200, 300], mult: [0.4, 2.7] },
  { tier: 2, theme: 'crepe', title: 'เครปผลไม้พับครึ่ง', invest: [180, 280], mult: [0.4, 2.6] },
  { tier: 2, theme: 'mango', title: 'ข้าวเหนียวมะม่วงหน้ากะทิ', invest: [220, 320], mult: [0.45, 2.6] },
];

const THEME_BY_ID = Object.fromEntries(STALL_THEMES.map((t) => [t.id, t]));

export function ownStallOptions(rng, { money = 0 } = {}) {
  const m = Math.max(0, Math.floor(money));
  const plans = [];
  for (let tier = 0; tier <= 2; tier++) {
    const pool = shuffled(rng, PLAN_TEMPLATES.filter((p) => p.tier === tier));
    for (const t of pool) {
      let invest = Math.round(rint(rng, t.invest) / 5) * 5;
      if (invest > m) {
        invest = Math.floor(m / 5) * 5;
        if (tier > 0 || invest < 10) continue; // only the cheapest tier is shrunk to fit a small purse
      }
      const theme = THEME_BY_ID[t.theme];
      plans.push({
        id: `own-${t.theme}-${invest}`,
        name: t.title,
        invest,
        menu: threeDishes(rng, theme),
        expected: { min: Math.round(invest * t.mult[0]), max: Math.round(invest * t.mult[1]) },
      });
      break;
    }
  }
  return plans.slice(0, SCHEDULE.fair.ownStallMaxPlans);
}

export function ownStallResult(plan, score, rng) {
  const s = clamp01(score);
  const invest = Math.max(1, plan.invest);
  const lo = plan.expected.min / invest;
  const hi = plan.expected.max / invest;
  let mult = lerp(lo, hi, s) * (0.88 + rng.float() * 0.24);
  const rain = rng.chance(0.08);
  if (rain) mult *= 0.7;
  const income = Math.max(0, Math.round(invest * mult));
  const profit = income - invest;
  const fx = cleanFx({ money: profit, peer: 1.5 + s * 2.5, stress: profit >= 0 ? -2 : 3, energy: -4, diligence: 0.5 });
  const rainNote = rain ? ' (ฝนปรอยทำคนน้อยลง)' : '';
  const log = profit >= 0
    ? `ร้าน ${plan.name} ของคุณขายได้ ${income} บาท กำไร ${profit} บาท${rainNote}`
    : `ร้าน ${plan.name} ขายได้ ${income} บาท ขาดทุน ${-profit} บาท${rainNote}`;
  return { income, profit, fx, log };
}


// ---- contests and the float ----------------------------------------------------------------------------------------

// pieces for the `craft` game. kind: base leaf flower candle ribbon decor (krathong) | top bottom hat accessory shoes cape (costume)
const KRATHONG_THEMES = [
  { name: 'รักษ์โลก ไร้โฟม', palette: ['#4f9d4f', '#c8e6a0', '#8d6e3f', '#f2e6c9'], note: 'ใช้วัสดุธรรมชาติล้วน' },
  { name: 'ใต้ทะเลลึก', palette: ['#1e88b6', '#7fd1e8', '#f6a5b8', '#f3f0d8'], note: 'ปลาและคลื่นใต้น้ำ' },
  { name: 'อวกาศและดวงดาว', palette: ['#2a2f6b', '#8a7fe0', '#f5d84a', '#e8ecf5'], note: 'ดาวหางและดวงจันทร์' },
  { name: 'ป่าฝนมหัศจรรย์', palette: ['#2e7d32', '#76c25a', '#f4b942', '#c0392b'], note: 'ใบไม้ใหญ่ ดอกไม้ป่า' },
  { name: 'ตำนานพญานาค', palette: ['#0d6e6e', '#f2c14e', '#e4572e', '#f7f1e3'], note: 'ลายเกล็ดสีทองเขียว' },
  { name: 'หอพักของเรา', palette: ['#f08a4b', '#f6d55c', '#3caea3', '#faf3dd'], note: 'อบอุ่นเหมือนบ้านหลังที่สอง' },
  { name: 'ไดโนเสาร์ยุคไทย', palette: ['#6b8e23', '#b5651d', '#f0e68c', '#8b4513'], note: 'ใบเฟิร์นและกระดูกยักษ์' },
  { name: 'สายรุ้งหลังฝน', palette: ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db'], note: 'ทุกสีมาอยู่ด้วยกัน' },
  { name: 'ฤดูหนาวในเมืองร้อน', palette: ['#aad4e8', '#ffffff', '#c9b6e4', '#f4e285'], note: 'สีเย็นตาในคืนอุ่น' },
  { name: 'เมืองในนิทาน', palette: ['#d95d8c', '#f7c873', '#6cc5c8', '#f5eddc'], note: 'ปราสาทและกล่องดนตรี' },
];

const KRATHONG_CLASSIC = [
  { name: 'ชมพูหวานละมุน', palette: ['#f48fb1', '#fce4ec', '#81c784', '#fff8e1'], note: 'กุหลาบและบัวหลวง' },
  { name: 'ขาวสะอาดบริสุทธิ์', palette: ['#ffffff', '#e0f2e9', '#a5d6a7', '#fff3c4'], note: 'มะลิและใบตองเขียวอ่อน' },
  { name: 'เหลืองทองมงคล', palette: ['#f9a825', '#ffe082', '#66bb6a', '#fff8e1'], note: 'ดาวเรืองทั้งดวง' },
  { name: 'ม่วงอ่อนหวานละไม', palette: ['#b39ddb', '#e1bee7', '#9ccc65', '#fffde7'], note: 'กล้วยไม้ม่วงลอยน้ำ' },
  { name: 'ส้มพระอาทิตย์ตก', palette: ['#ff8f3a', '#ffcc80', '#8bc34a', '#fff3e0'], note: 'ดอกบานชื่นสีส้ม' },
  { name: 'ฟ้าครามเรียบง่าย', palette: ['#64b5f6', '#e3f2fd', '#81c784', '#ffffff'], note: 'ดอกอัญชันและใบเตย' },
  { name: 'แดงกำมะหยี่', palette: ['#c2185b', '#f8bbd0', '#558b2f', '#fff8e1'], note: 'กุหลาบแดงกลีบซ้อน' },
  { name: 'เขียวธรรมชาติ', palette: ['#2e7d32', '#a5d6a7', '#f9a825', '#fffde7'], note: 'ใบตองพับเป็นชั้นๆ' },
];

const KRATHONG_PIECE_POOL = [
  ['base', 'ฐานกาบกล้วย'], ['base', 'ฐานหยวกกล้วยวงกลม'], ['leaf', 'ใบตองพับกลีบแหลม'], ['leaf', 'ใบตองม้วนกรวย'],
  ['leaf', 'ใบเตยถักเป็นพวง'], ['flower', 'ดอกดาวเรือง'], ['flower', 'ดอกกุหลาบ'], ['flower', 'ดอกบัวหลวง'],
  ['flower', 'ดอกกล้วยไม้'], ['flower', 'ดอกบานชื่น'], ['flower', 'ดอกเบญจมาศ'], ['flower', 'ดอกมะลิร้อยพวง'],
  ['candle', 'เทียนเล่มเล็ก'], ['candle', 'ธูปสามดอก'], ['ribbon', 'ริบบิ้นสายสั้น'], ['ribbon', 'ริบบิ้นผ้าซาติน'],
  ['decor', 'ลูกปัดไม้'], ['decor', 'ขนนกประดับ'], ['decor', 'ใบไม้แห้งตัดแต่ง'], ['decor', 'ลายฉลุจากกระดาษสา'],
];

const COSTUME_THEMES = [
  { name: 'ชุดไทยประยุกต์', palette: ['#b71c1c', '#f9a825', '#1a237e', '#fff8e1'], note: 'ผ้าไหมและลายทอง' },
  { name: 'ชุดจากวัสดุรีไซเคิล', palette: ['#455a64', '#cfd8dc', '#8bc34a', '#ffeb3b'], note: 'ถุงพลาสติกกับกระดาษหนังสือพิมพ์' },
  { name: 'ตัวละครวรรณคดี', palette: ['#6a1b9a', '#ffd54f', '#26a69a', '#fafafa'], note: 'นางเงือกหรือยักษ์ใจดี' },
  { name: 'ชุดสีรุ้ง', palette: ['#e53935', '#fdd835', '#43a047', '#1e88e5'], note: 'ครบทุกสี ไม่ซ้ำกัน' },
  { name: 'ชุดย้อนยุคนักเรียนรุ่นแรก', palette: ['#37474f', '#eceff1', '#8d6e63', '#ffecb3'], note: 'ผ้าขาวกระโปรงดำสมัยก่อน' },
  { name: 'ชุดสัตว์ป่า', palette: ['#ef6c00', '#4e342e', '#a5d6a7', '#fff3e0'], note: 'ลายเสือและหางยาว' },
  { name: 'ชุดจากอวกาศ', palette: ['#283593', '#9fa8da', '#ffee58', '#eceff1'], note: 'หมวกกระจกและแผงดวงดาว' },
  { name: 'ชุดดอกไม้บาน', palette: ['#ec407a', '#ffb74d', '#66bb6a', '#fff9c4'], note: 'กลีบซ้อนเป็นชั้น' },
];

const COSTUME_PIECE_POOL = [
  ['top', 'เสื้อแขนยาวลายดอก'], ['top', 'เสื้อคอกลมสีพื้น'], ['top', 'สไบจับจีบ'], ['bottom', 'ผ้าถุงลายไทย'],
  ['bottom', 'กระโปรงสุ่มไก่'], ['bottom', 'โจงกระเบนสีสด'], ['hat', 'มงกุฎดอกไม้'], ['hat', 'หมวกใบใหญ่'],
  ['accessory', 'สร้อยลูกปัด'], ['accessory', 'กำไลข้อมือ'], ['accessory', 'ต่างหูห้อยยาว'], ['accessory', 'พัดวิเศษ'],
  ['shoes', 'รองเท้าผ้าใบสีขาว'], ['shoes', 'รองเท้าแตะประดับ'], ['cape', 'ผ้าคลุมไหล่โปร่ง'], ['cape', 'ผ้าคลุมยาวสีเข้ม'],
];

function craftPieces(rng, pool, palette, n) {
  const chosen = shuffled(rng, pool).slice(0, n);
  return chosen.map(([kind, name], i) => ({ id: `p${i + 1}`, name, color: palette[(i + rng.int(0, 3)) % palette.length], kind }));
}

function craftSpec(rng, kind, themes, pool, rubricBias) {
  const theme = rng.pick(themes);
  const n = rint(rng, [10, 14]);
  const total = rubricBias.palette + rubricBias.symmetry + rubricBias.variety;
  return {
    kind,
    theme: { name: theme.name, palette: theme.palette.slice() },
    pieces: craftPieces(rng, pool, theme.palette, n),
    slots: rint(rng, [6, 9]),
    rubric: {
      palette: r1(rubricBias.palette / total * 100) / 100,
      symmetry: r1(rubricBias.symmetry / total * 100) / 100,
      variety: r1(rubricBias.variety / total * 100) / 100,
    },
  };
}

const OUTFITS = [
  { name: 'ชุดนักเรียนเต็มยศ', items: ['เสื้อนักเรียน', 'กางเกงนักเรียน', 'เข็มขัด', 'ถุงเท้า', 'รองเท้า', 'ป้ายชื่อ', 'เนกไท', 'หมวก'] },
  { name: 'ชุดลูกเสือ', items: ['เสื้อลูกเสือ', 'กางเกงลูกเสือ', 'ผ้าพันคอ', 'ปลอกผ้าพันคอ', 'เข็มขัดลูกเสือ', 'ถุงเท้า', 'รองเท้า', 'หมวกลูกเสือ'] },
  { name: 'ชุดไทยแต่งเร็ว', items: ['เสื้อแขนกระบอก', 'ผ้าถุง', 'สไบ', 'เข็มกลัด', 'สร้อยคอ', 'ต่างหู', 'รองเท้าแตะ', 'ดอกไม้ทัดหู'] },
  { name: 'ชุดกีฬาสี', items: ['เสื้อกีฬาสี', 'กางเกงขาสั้น', 'ผ้าคาดหัว', 'ถุงเท้า', 'รองเท้าผ้าใบ', 'สายรัดข้อมือ', 'ผ้าพันคอสี', 'ขวดน้ำ'] },
  { name: 'ชุดเดินป่า', items: ['เสื้อแขนยาว', 'กางเกงขายาว', 'รองเท้าบูต', 'หมวกปีกกว้าง', 'กระติกน้ำ', 'เป้สะพายหลัง', 'ผ้าพันคอ', 'ไฟฉาย'] },
];

function dressSpec(rng, difficulty) {
  const outfit = rng.pick(OUTFITS);
  const items = shuffled(rng, outfit.items).map((name, i) => ({ id: `g${i + 1}`, name }));
  const d = clamp01(difficulty == null ? 0.5 : difficulty);
  return { items, sequenceLen: Math.round(lerp(5, 8, d)), timeLimit: Math.round(lerp(26, 18, d)) };
}

const PRIZE_TIERS = (money, peer) => [
  { maxPlace: 1, label: 'ชนะเลิศ', money, peer, teacherTrust: 2 },
  { maxPlace: 3, label: 'รางวัลชมเชย', money: Math.round(money / 2), peer: Math.max(1, Math.round(peer / 2)), teacherTrust: 1 },
  { maxPlace: 99, label: 'ร่วมสนุก', money: 0, peer: 1, teacherTrust: 0 },
];

export const CONTESTS = {
  krathong_creative: {
    id: 'krathong_creative',
    title: 'ประกวดกระทงสร้างสรรค์',
    game: 'craft',
    entryNote: 'ใช้ไอเดียให้เหลือเฟือ ธีมแปลกแค่ไหนก็ได้ ขอให้ตรงโจทย์และไม่ซ้ำใคร',
    specFor: (rng, ctx = {}) => craftSpec(rng, 'krathong', KRATHONG_THEMES, KRATHONG_PIECE_POOL, { palette: 2, symmetry: 2, variety: 4 }),
    prize: { money: 150, peer: 6, tiers: PRIZE_TIERS(150, 6) },
  },
  krathong_beautiful: {
    id: 'krathong_beautiful',
    title: 'ประกวดกระทงสวยงาม',
    game: 'craft',
    entryNote: 'เน้นความประณีต สีกลมกลืน ซ้ายขวาสมดุล',
    specFor: (rng, ctx = {}) => craftSpec(rng, 'krathong', KRATHONG_CLASSIC, KRATHONG_PIECE_POOL, { palette: 4, symmetry: 4, variety: 2 }),
    prize: { money: 150, peer: 6, tiers: PRIZE_TIERS(150, 6) },
  },
  dress_fast: {
    id: 'dress_fast',
    title: 'แข่งแต่งตัวเร็ว',
    game: 'dash',
    entryNote: 'หยิบเสื้อผ้าและของใช้ให้ถูกลำดับให้เร็วที่สุด ผิดแล้วเสียเวลา',
    specFor: (rng, ctx = {}) => dressSpec(rng, ctx.difficulty),
    prize: { money: 100, peer: 5, tiers: PRIZE_TIERS(100, 5) },
  },
  costume_beauty: {
    id: 'costume_beauty',
    title: 'ประกวดการแต่งกายสวยงาม',
    game: 'craft',
    entryNote: 'ประกอบชุดตามธีม คุมโทนสีให้กลมกลืน',
    specFor: (rng, ctx = {}) => craftSpec(rng, 'costume', COSTUME_THEMES, COSTUME_PIECE_POOL, { palette: 4, symmetry: 2, variety: 3 }),
    prize: { money: 150, peer: 6, tiers: PRIZE_TIERS(150, 6) },
  },
};

// Where would this score finish among N rivals (rivals: number or array)? Rival scores ~ N(0.55, 0.17).
export function rankFromScore(score, rivals, rng) {
  const n = Array.isArray(rivals) ? rivals.length : Math.max(0, Math.floor(Number(rivals) || 0));
  let above = 0;
  for (let i = 0; i < n; i++) {
    const v = clamp01(0.55 + 0.17 * rng.gauss());
    if (v > clamp01(score)) above++;
  }
  return { place: above + 1, of: n + 1 };
}

const FLOAT_VARIANTS = [
  { id: 'calm', label: 'ลอยกระทงริมคลอง ลมนิ่ง', zone: 0.3, speed: 1.0 },
  { id: 'breeze', label: 'ลอยกระทงที่สระใหญ่ ลมพัดเบาๆ', zone: 0.26, speed: 1.2 },
  { id: 'slow', label: 'ลอยกระทงที่สระน้ำนิ่ง ปล่อยตอนน้ำนิ่งสนิท', zone: 0.32, speed: 0.9 },
  { id: 'wind', label: 'ลมแรงพัดน้ำเป็นริ้ว ปล่อยให้ถูกจังหวะ', zone: 0.22, speed: 1.6 },
  { id: 'flow', label: 'น้ำไหลช้าข้างสะพาน เลือกจังหวะปล่อย', zone: 0.27, speed: 1.3 },
  { id: 'night', label: 'ปล่อยกระทงยามค่ำ แสงเทียนวูบวาบ', zone: 0.25, speed: 1.4 },
  { id: 'wave', label: 'มีคลื่นเล็กจากเรือท้องแบน ปล่อยตอนคลื่นสงบ', zone: 0.23, speed: 1.7 },
  { id: 'drizzle', label: 'ฝนปรอยๆ ผิวน้ำกระเพื่อม', zone: 0.24, speed: 1.5 },
];

const WISHES = [
  'ขอให้สอบผ่านทุกวิชา', 'ขอให้เพื่อนร่วมห้องไม่กรนคืนนี้', 'ขอให้แม่สบายดี', 'ขอให้ได้อยู่ห้องเดิมเทอมหน้า',
  'ขอให้ข้าวมันไก่ไม่หมดก่อนถึงคิว', 'ขอให้ได้เกรดสี่', 'ขอให้ครูเลื่อนสอบ (แต่ไม่เลื่อน)', 'ขอให้เพื่อนทุกคนผ่านด่านไปด้วยกัน',
  'ขอให้ไม่ถูกเรียกพบในคาบหน้า', 'ขอให้เงินพอใช้ถึงสิ้นเดือน', 'ขอให้ได้กลับบ้านวันศุกร์ทุกสัปดาห์', 'ขอให้ฝันดีและตื่นทันเช้า',
  'ขอให้ติดคณะที่ฝัน', 'ขอให้ทุกอย่างเป็นไปด้วยดี',
];

export const FLOAT = {
  texts: {
    intro: 'ถึงเวลาปล่อยกระทงลงน้ำ ตั้งสมาธิ แล้วปล่อยในจังหวะที่น้ำนิ่งที่สุด',
    great: 'กระทงลอยไปไกลเป็นแนวสวยงาม เทียนไม่ดับ คนข้างๆ ยังหันมาชม',
    good: 'กระทงลอยออกไปได้ดี เอียงนิดหน่อยแต่ไปต่อได้',
    ok: 'กระทงหมุนวนอยู่ใกล้ฝั่งสักพักก่อนค่อยๆ ลอยออกไป',
    bad: 'กระทงเอียงจนเทียนดับ ต้องช่วยกันดันกลับ แต่ก็ยังขำกันทั้งกลุ่ม',
  },
  wishes: WISHES,
  variants: FLOAT_VARIANTS.map((v) => ({ ...v })),
  floatSpec(rng) {
    const v = rng.pick(FLOAT_VARIANTS);
    return { tries: 3, zone: r1(clamp(v.zone + (rng.float() - 0.5) * 0.04, 0.15, 0.4) * 100) / 100, speed: r1(v.speed * 10) / 10, label: v.label };
  },
  floatResult(score, rng) {
    const s = clamp01(score);
    const tier = scoreTier(s);
    const wish = rng.pick(WISHES);
    const fx = cleanFx({ stress: -(2 + s * 5), peer: 1 + s * 2, energy: 0, diligence: s * 0.5, health: 0.3 });
    return { fx, log: `${FLOAT.texts[tier.id]} คุณอธิษฐานว่า "${wish}"`, tier, wish };
  },
};

// ---- the hall (หอประชุม) -------------------------------------------------------------------------------------------
// Every talk has slides (title + one line), keywords that appear in the slide lines (they flash on the screen) and
// 3 questions. In the raw data the correct choice is first; spec() shuffles with the rng and sets `answer`.

const L = (id, title, slides, keywords, qs, extra = {}) => ({
  id,
  title,
  ...extra,
  slides: slides.map(([t, l]) => ({ title: t, line: l })),
  keywords,
  questions: qs.map(([q, c, w1, w2]) => ({ q, choices: [c, w1, w2], answer: 0 })),
});

function buildWatch(rng, talk, extraSlides = []) {
  return {
    slides: extraSlides.concat(talk.slides).map((s) => ({ title: s.title, line: s.line })),
    keywords: talk.keywords.slice(),
    questions: talk.questions.map((q) => {
      const correct = q.choices[q.answer];
      const choices = shuffled(rng, q.choices);
      return { q: q.q, choices, answer: choices.indexOf(correct) };
    }),
    topic: talk.title,
  };
}

const LECTURE_TOPICS = [
  L('sleep', 'นอนให้พอ สมองถึงจะจำ', [
    ['วัยรุ่นต้องการการนอนเท่าไร', 'วัยรุ่นควรนอนประมาณ 8 ถึง 10 ชั่วโมงต่อคืน'],
    ['ตอนหลับสมองทำอะไร', 'ระหว่างหลับสมองจัดเก็บความจำที่เรียนมาในวันนั้น'],
    ['แสงจากหน้าจอ', 'แสงจากหน้าจอตอนกลางคืนทำให้ง่วงช้าลง'],
    ['เคล็ดลับ', 'เข้านอนเวลาเดิมทุกคืน แม้เป็นวันหยุด'],
  ], ['8 ถึง 10 ชั่วโมง', 'จัดเก็บความจำ', 'เวลาเดิม'], [
    ['วัยรุ่นควรนอนประมาณกี่ชั่วโมงต่อคืน', '8 ถึง 10 ชั่วโมง', '4 ถึง 5 ชั่วโมง', '12 ถึง 14 ชั่วโมง'],
    ['ระหว่างหลับ สมองทำอะไรกับความจำ', 'จัดเก็บความจำ', 'ลบความจำทั้งหมด', 'หยุดทำงานเต็มที่'],
    ['เคล็ดลับการนอนที่วิทยากรบอกคืออะไร', 'เข้านอนเวลาเดิมทุกคืน', 'นอนดึกวันหยุดชดเชย', 'ดูหน้าจอจนหลับคาโทรศัพท์'],
  ]),
  L('phone', 'โทรศัพท์กินเวลาเราอย่างไร', [
    ['การแจ้งเตือนคือกับดัก', 'ทุกครั้งที่เด้งแจ้งเตือน ใจเราหลุดจากงานตรงหน้า'],
    ['กฎ 20-20-20', 'ทุก 20 นาที มองไกล 20 ฟุต นาน 20 วินาที เพื่อพักสายตา'],
    ['ตั้งกติกากับตัวเอง', 'วางโทรศัพท์ไว้ห่างมือเวลาอ่านหนังสือ'],
    ['ดูเวลาหน้าจอ', 'ตรวจเวลาหน้าจอรายสัปดาห์ แล้วตั้งเป้าลดลง'],
  ], ['การแจ้งเตือน', '20 วินาที', 'ห่างมือ'], [
    ['กฎ 20-20-20 ใช้พักส่วนใดของร่างกาย', 'สายตา', 'นิ้วมือ', 'หู'],
    ['อะไรทำให้ใจหลุดจากงานตรงหน้า', 'การแจ้งเตือน', 'เสียงนกร้อง', 'แสงแดด'],
    ['ตอนอ่านหนังสือควรวางโทรศัพท์ไว้ที่ไหน', 'ห่างมือ', 'ใต้หมอนข้างหู', 'บนหนังสือ'],
  ]),
  L('food', 'กินอะไรให้เรียนไหว', [
    ['อาหารหลัก 5 หมู่', 'ร่างกายต้องการอาหารครบ 5 หมู่ ไม่ใช่แค่ของทอด'],
    ['น้ำเปล่า', 'ดื่มน้ำเปล่าให้พอ ลดน้ำหวานและน้ำอัดลม'],
    ['อย่าข้ามมื้อเช้า', 'มื้อเช้าช่วยให้มีแรงและสมาธิในคาบเช้า'],
    ['ของหวานแต่พอดี', 'น้ำตาลสูงทำให้ตื่นตัวแล้วเหนื่อยเร็ว'],
  ], ['5 หมู่', 'น้ำเปล่า', 'มื้อเช้า'], [
    ['อาหารที่ร่างกายต้องการมีกี่หมู่', '5 หมู่', '3 หมู่', '9 หมู่'],
    ['เครื่องดื่มที่ควรดื่มให้พอคืออะไร', 'น้ำเปล่า', 'น้ำหวาน', 'น้ำอัดลม'],
    ['มื้อไหนที่ช่วยให้มีสมาธิในคาบเช้า', 'มื้อเช้า', 'มื้อดึก', 'ไม่ต้องกินมื้อไหนเลย'],
  ]),
  L('stress', 'รับมือความเครียดก่อนสอบ', [
    ['ความเครียดไม่ใช่ศัตรูเสมอไป', 'ความเครียดพอดีช่วยให้ตื่นตัว แต่มากไปทำให้คิดไม่ออก'],
    ['หายใจลึกๆ', 'หายใจเข้าช้าๆ สี่วินาที แล้วออกยาวๆ ช่วยให้ใจนิ่งขึ้น'],
    ['แบ่งงานเป็นชิ้นเล็ก', 'เขียนรายการสิ่งที่ต้องอ่านแล้วทำทีละข้อ'],
    ['พูดคุยกับคนใกล้ตัว', 'เล่าให้เพื่อนหรือครูฟัง จะเบาใจกว่าเก็บไว้คนเดียว'],
  ], ['หายใจเข้าช้าๆ', 'ชิ้นเล็ก', 'เล่าให้เพื่อนหรือครูฟัง'], [
    ['วิธีใดช่วยให้ใจนิ่งขึ้นก่อนสอบ', 'หายใจเข้าช้าๆ แล้วออกยาวๆ', 'อดนอนอ่านทั้งคืน', 'ทำเป็นไม่สนใจ'],
    ['งานกองใหญ่ควรทำอย่างไร', 'แบ่งเป็นชิ้นเล็กแล้วทำทีละข้อ', 'ทำทุกอย่างพร้อมกัน', 'รอจนเหลือเวลาน้อยที่สุด'],
    ['เวลาเครียดมากควรทำอะไร', 'เล่าให้เพื่อนหรือครูฟัง', 'เก็บไว้คนเดียว', 'ตัดสินใจเลิกเรียน'],
  ]),
  L('memory', 'จำให้อยู่ด้วยเทคนิคที่ได้ผล', [
    ['อ่านซ้ำอย่างเดียวไม่พอ', 'การอ่านซ้ำหลายรอบทำให้รู้สึกคุ้นแต่ไม่ได้จำจริง'],
    ['ทดสอบตัวเอง', 'ปิดหนังสือแล้วลองเล่าหรือเขียนเท่าที่จำได้'],
    ['ทบทวนเป็นช่วงห่างๆ', 'ทบทวนวันนี้ พรุ่งนี้ อีกสามวัน แล้วอีกสัปดาห์'],
    ['สอนเพื่อน', 'ถ้าอธิบายให้เพื่อนฟังได้ แปลว่าเข้าใจจริง'],
  ], ['ทดสอบตัวเอง', 'ห่างๆ', 'สอนเพื่อน'], [
    ['เทคนิคที่ช่วยให้จำได้จริงคืออะไร', 'ปิดหนังสือแล้วทดสอบตัวเอง', 'อ่านซ้ำผ่านตาอย่างเดียว', 'ไฮไลต์ทุกบรรทัด'],
    ['ควรทบทวนอย่างไรจึงจะจำได้นาน', 'ทบทวนเป็นช่วงห่างๆ', 'ทบทวนครั้งเดียวคืนก่อนสอบ', 'ไม่ต้องทบทวน'],
    ['วิธีตรวจว่าเรา เข้าใจจริง คือ', 'ลองสอนเพื่อน', 'ท่องให้เหมือนตำรา', 'ถามว่าเพื่อนอ่านถึงไหน'],
  ]),
  L('online', 'ปลอดภัยบนโลกออนไลน์', [
    ['รหัสผ่านที่ดี', 'ตั้งรหัสผ่านยาวและไม่ใช้ซ้ำกับบัญชีอื่น'],
    ['ยืนยันตัวตนสองชั้น', 'เปิดการยืนยันสองขั้นตอนทุกครั้งที่ทำได้'],
    ['ลิงก์หลอกลวง', 'ข้อความที่รีบให้กดลิงก์และบอกว่าได้รางวัล มักเป็นการหลอก'],
    ['ข้อมูลส่วนตัว', 'อย่าส่งรูปบัตรหรือรหัสให้ใครทางแชต'],
  ], ['ไม่ใช้ซ้ำ', 'สองขั้นตอน', 'ลิงก์'], [
    ['รหัสผ่านที่ดีควรเป็นอย่างไร', 'ยาวและไม่ใช้ซ้ำ', 'ใช้วันเกิดของตัวเอง', 'ใช้รหัสเดียวทุกที่'],
    ['การยืนยันสองขั้นตอนช่วยอะไร', 'เพิ่มความปลอดภัยของบัญชี', 'ทำให้เน็ตเร็วขึ้น', 'ลดค่าอินเทอร์เน็ต'],
    ['ข้อความบอกว่าได้รางวัลแล้วให้กดลิงก์ มักเป็น', 'การหลอกลวง', 'ของขวัญจากโรงเรียน', 'ข่าวดีจริงแท้'],
  ]),
  L('money', 'ออมเงินสำหรับเด็กหอ', [
    ['วางแผนก่อนใช้', 'จดรายรับรายจ่ายสั้นๆ ทุกสัปดาห์ จะรู้ว่าเงินหายไปไหน'],
    ['กฎ 50-30-20', 'แบ่งเป็นสิ่งจำเป็นห้าสิบ สิ่งอยากได้สามสิบ และออมยี่สิบ'],
    ['ก่อนซื้อของ', 'ถามตัวเองว่าจำเป็นหรืออยากได้ และรอหนึ่งวันก่อนตัดสินใจ'],
    ['อย่าให้ยืมจนหมดตัว', 'ให้ยืมเท่าที่พร้อมจะไม่ได้คืน แล้วมิตรภาพจะไม่เสีย'],
  ], ['จดรายรับรายจ่าย', 'ออมยี่สิบ', 'รอหนึ่งวัน'], [
    ['ตามกฎ 50-30-20 ควรออมกี่ส่วน', 'ยี่สิบส่วน', 'ห้าสิบส่วน', 'ไม่ต้องออม'],
    ['ก่อนซื้อของควรทำอะไร', 'รอหนึ่งวันแล้วค่อยตัดสินใจ', 'ซื้อทันทีกลัวหมด', 'ยืมเพื่อนมาซื้อ'],
    ['จดรายรับรายจ่ายช่วยอะไร', 'รู้ว่าเงินหายไปไหน', 'ทำให้เงินเพิ่มเอง', 'ไม่ต้องไปโรงอาหาร'],
  ]),
  L('vape', 'บุหรี่ไฟฟ้าและยาเสพติด', [
    ['สมองวัยรุ่นยังเติบโต', 'สารเสพติดกระทบสมองที่ยังพัฒนาอยู่มากกว่าผู้ใหญ่'],
    ['บุหรี่ไฟฟ้าไม่ใช่ของปลอดภัย', 'ไอระเหยมีนิโคตินและสารเคมีที่ทำลายปอด'],
    ['เสพติดง่ายเลิกยาก', 'นิโคตินทำให้ติดได้เร็ว และเลิกได้ยากกว่าที่คิด'],
    ['พูดว่าไม่', 'ปฏิเสธเพื่อนอย่างสุภาพ และเดินจากที่นั่นได้เสมอ'],
  ], ['สมอง', 'นิโคติน', 'ปฏิเสธ'], [
    ['บุหรี่ไฟฟ้ามีสารใดที่ทำให้ติด', 'นิโคติน', 'วิตามินซี', 'น้ำตาล'],
    ['สารเสพติดกระทบอวัยวะใดของวัยรุ่นมาก', 'สมองที่ยังพัฒนา', 'เล็บ', 'ผม'],
    ['เมื่อเพื่อนชวนลอง ควรทำอย่างไร', 'ปฏิเสธอย่างสุภาพ', 'ลองแค่ครั้งเดียว', 'เก็บไว้ให้เพื่อน'],
  ]),
  L('firstaid', 'ปฐมพยาบาลเบื้องต้นที่ใครก็ทำได้', [
    ['ตั้งสติก่อน', 'ดูความปลอดภัยรอบตัว แล้วเรียกคนช่วย'],
    ['โทรเรียกรถพยาบาล', 'เหตุฉุกเฉินให้โทร 1669'],
    ['ช่วยฟื้นคืนชีพ', 'กดหน้าอกเร็วๆ ประมาณ 100 ถึง 120 ครั้งต่อนาที'],
    ['แผลเลือดออก', 'ใช้ผ้าสะอาดกดบริเวณแผลไว้แน่นๆ'],
  ], ['1669', '100 ถึง 120 ครั้ง', 'ผ้าสะอาด'], [
    ['เบอร์โทรเรียกรถพยาบาลฉุกเฉินคือ', '1669', '191', '1112'],
    ['กดหน้าอกประมาณกี่ครั้งต่อนาที', '100 ถึง 120 ครั้ง', '10 ถึง 20 ครั้ง', '300 ครั้งขึ้นไป'],
    ['แผลเลือดออกควรทำอย่างไร', 'ใช้ผ้าสะอาดกดแผลไว้แน่นๆ', 'ปล่อยให้เลือดไหล', 'ใช้ยาสีฟันทา'],
  ]),
  L('wash', 'ล้างมือสู้โรคในหอ', [
    ['โรคติดต่อในหอแพร่เร็ว', 'อยู่ใกล้กันมาก ไข้หวัดจึงระบาดเร็ว'],
    ['ล้างมืออย่างถูกวิธี', 'ฟอกสบู่และถูให้ทั่วอย่างน้อย 20 วินาที'],
    ['ไอจามใส่ข้อพับแขน', 'ใช้ข้อพับแขนหรือกระดาษทิชชูปิดปากจมูก'],
    ['ป่วยแล้วพักก่อน', 'ถ้ามีไข้ให้บอกครูและพักผ่อน ไม่ฝืนไปเรียน'],
  ], ['20 วินาที', 'ข้อพับแขน', 'บอกครู'], [
    ['ควรล้างมือด้วยสบู่นานอย่างน้อยเท่าไร', '20 วินาที', '2 วินาที', '5 นาที'],
    ['เวลาไอจามควรปิดด้วยอะไร', 'ข้อพับแขน', 'ฝ่ามือเปล่า', 'ไม่ต้องปิด'],
    ['ถ้ามีไข้ควรทำอย่างไร', 'บอกครูและพักผ่อน', 'ฝืนไปสอบ', 'ไปนอนห้องเพื่อน'],
  ]),
  L('vote', 'พลเมืองและสิทธิหน้าที่', [
    ['ประชาธิปไตยเริ่มจากห้องเรียน', 'ลองเลือกประธานนักเรียน ก็คือการฝึกใช้เสียงของตัวเอง'],
    ['เสียงข้างมากและสิทธิคนส่วนน้อย', 'ตัดสินด้วยเสียงข้างมากแต่ต้องไม่ลืมสิทธิของคนส่วนน้อย'],
    ['อายุ 18 ปีมีสิทธิเลือกตั้ง', 'พลเมืองไทยอายุ 18 ปีบริบูรณ์มีสิทธิออกเสียงเลือกตั้ง'],
    ['หน้าที่พลเมือง', 'เคารพกฎหมาย เสียภาษี และช่วยกันดูแลส่วนรวม'],
  ], ['เสียงของตัวเอง', '18 ปี', 'เคารพกฎหมาย'], [
    ['พลเมืองไทยมีสิทธิเลือกตั้งเมื่ออายุเท่าไร', '18 ปีบริบูรณ์', '15 ปี', '25 ปี'],
    ['การตัดสินด้วยเสียงข้างมากต้องไม่ลืมอะไร', 'สิทธิของคนส่วนน้อย', 'ความสะดวกของครู', 'การโหวตซ้ำ'],
    ['ข้อใดเป็นหน้าที่ของพลเมือง', 'เคารพกฎหมาย', 'ทิ้งขยะข้างทาง', 'เมินเฉยทุกเรื่อง'],
  ]),
  L('climate', 'โลกร้อนและพลังงานสะอาด', [
    ['ก๊าซเรือนกระจก', 'ก๊าซคาร์บอนไดออกไซด์ทำให้โลกอุ่นขึ้นเหมือนผ้าห่ม'],
    ['มาจากไหน', 'การเผาน้ำมัน ถ่านหิน และเผาป่า ปล่อยก๊าซออกมามาก'],
    ['พลังงานสะอาด', 'แสงอาทิตย์และลมให้พลังงานโดยไม่เผาเชื้อเพลิง'],
    ['ทำได้ตั้งแต่วันนี้', 'ปิดไฟเมื่อไม่ใช้ เดินหรือปั่นจักรยานแทนรถ'],
  ], ['คาร์บอนไดออกไซด์', 'แสงอาทิตย์', 'ปิดไฟ'], [
    ['ก๊าซใดทำให้โลกร้อนขึ้น', 'คาร์บอนไดออกไซด์', 'ออกซิเจน', 'ไนโตรเจนล้วน'],
    ['พลังงานสะอาดมาจากอะไร', 'แสงอาทิตย์และลม', 'ถ่านหิน', 'น้ำมันดิบ'],
    ['สิ่งที่ทำได้ทันทีคืออะไร', 'ปิดไฟเมื่อไม่ใช้', 'เปิดไฟทิ้งไว้ทั้งคืน', 'เผาขยะหลังหอ'],
  ]),
  L('waste', 'แยกขยะให้เป็นระบบ', [
    ['ขยะมีหลายสี', 'ขยะเปียก ขยะรีไซเคิล ขยะทั่วไป และขยะอันตราย แยกถังกัน'],
    ['ขยะรีไซเคิล', 'ขวดแก้ว กระป๋อง กระดาษ ล้างให้สะอาดแล้วแยกไว้'],
    ['ขยะอันตราย', 'ถ่านไฟฉายและหลอดไฟไม่ควรทิ้งรวมกับขยะอื่น'],
    ['ลดก่อนทิ้ง', 'ใช้ซ้ำและเลือกของที่ไม่ต้องใช้ถุงพลาสติก'],
  ], ['ขยะรีไซเคิล', 'ถ่านไฟฉาย', 'ใช้ซ้ำ'], [
    ['ขวดแก้วและกระป๋องจัดเป็นขยะประเภทใด', 'ขยะรีไซเคิล', 'ขยะเปียก', 'ขยะอันตราย'],
    ['ถ่านไฟฉายจัดเป็นขยะประเภทใด', 'ขยะอันตราย', 'ขยะเปียก', 'ขยะทั่วไป'],
    ['การลดขยะที่ดีที่สุดคืออะไร', 'ใช้ซ้ำและลดการใช้ถุงพลาสติก', 'ทิ้งให้เร็วที่สุด', 'ฝังไว้หลังหอ'],
  ]),
  L('career', 'เลือกทางเรียน เลือกทางอาชีพ', [
    ['รู้จักตัวเองก่อน', 'ถามตัวเองว่าชอบอะไร ถนัดอะไร และอะไรที่ทำนานๆ แล้วไม่เบื่อ'],
    ['ลองของจริง', 'เข้าค่าย ฝึกงานสั้น ดูวิดีโอจากคนทำงานจริง'],
    ['มีหลายทางไปถึง', 'ไม่มีทางเดียวที่ถูก ปรับเปลี่ยนเส้นทางได้เสมอ'],
    ['เริ่มสะสมแฟ้มผลงาน', 'เก็บผลงานและกิจกรรมที่ภูมิใจไว้ตั้งแต่วันนี้'],
  ], ['ชอบอะไร ถนัดอะไร', 'ฝึกงานสั้น', 'แฟ้มผลงาน'], [
    ['ก่อนเลือกทางเรียนควรทำสิ่งใดเป็นอย่างแรก', 'รู้จักความชอบและความถนัดของตัวเอง', 'ตามเพื่อนไปก่อน', 'เลือกทางที่คนเยอะสุด'],
    ['วิธีรู้ว่าอาชีพเหมาะหรือไม่คือ', 'ลองของจริงเช่นค่ายหรือฝึกงานสั้น', 'อ่านชื่ออาชีพอย่างเดียว', 'เดาดวง'],
    ['เรื่องแฟ้มผลงาน วิทยากรแนะนำว่า', 'เริ่มเก็บไว้ตั้งแต่วันนี้', 'ค่อยทำตอนปิดเทอมสุดท้าย', 'ไม่จำเป็นเลย'],
  ]),
  L('thaichat', 'ภาษาไทยในยุคแชท', [
    ['ภาษาวัยรุ่นสนุกได้', 'คำสแลงทำให้คุยกันสนิทขึ้นในกลุ่มเพื่อน'],
    ['แต่ต้องรู้กาลเทศะ', 'เขียนถึงครูหรือส่งงาน ใช้ภาษาสุภาพและสะกดให้ถูก'],
    ['อ่านเยอะ เขียนแม่น', 'ยิ่งอ่านมาก ยิ่งสะกดถูกโดยไม่ต้องจำกฎ'],
    ['อย่าตัดคำจนสื่อสารเพี้ยน', 'ตัวย่อบางคำคนต่างวัยอาจอ่านไม่เข้าใจ'],
  ], ['กาลเทศะ', 'อ่านมาก', 'ตัวย่อ'], [
    ['เมื่อเขียนถึงครูควรใช้ภาษาแบบใด', 'ภาษาสุภาพ', 'คำสแลงล้วน', 'ตัวย่อทุกคำ'],
    ['อะไรช่วยให้สะกดถูก', 'อ่านมากๆ', 'เดาตามเสียง', 'ไม่ต้องสนใจ'],
    ['ภาษาวัยรุ่นช่วยอะไรได้บ้าง', 'ทำให้คุยกันสนิทขึ้นในกลุ่มเพื่อน', 'ใช้เขียนรายงานได้ทุกฉบับ', 'ทำให้ครูให้คะแนนเพิ่ม'],
  ]),
  L('phitsanulok', 'พิษณุโลก เมืองสองแคว', [
    ['ชื่อเรียกอีกชื่อหนึ่ง', 'พิษณุโลกมีอีกชื่อว่า เมืองสองแคว เพราะอยู่ริมแม่น้ำสองสาย'],
    ['แม่น้ำสำคัญ', 'แม่น้ำน่านไหลผ่านกลางเมืองพิษณุโลก'],
    ['วัดสำคัญ', 'วัดพระศรีรัตนมหาธาตุ เป็นที่ประดิษฐานพระพุทธชินราช'],
    ['กษัตริย์ผู้กล้า', 'เล่ากันว่าสมเด็จพระนเรศวรมหาราชประสูติที่เมืองพิษณุโลก'],
  ], ['เมืองสองแคว', 'แม่น้ำน่าน', 'พระพุทธชินราช'], [
    ['พิษณุโลกมีอีกชื่อว่าอะไร', 'เมืองสองแคว', 'เมืองสามอ่าว', 'เมืองหนึ่งฟ้า'],
    ['แม่น้ำสายใดไหลผ่านกลางเมืองพิษณุโลก', 'แม่น้ำน่าน', 'แม่น้ำโขง', 'แม่น้ำตาปี'],
    ['พระพุทธชินราชประดิษฐานที่ใด', 'วัดพระศรีรัตนมหาธาตุ', 'วัดอรุณ', 'วัดสุทัศน์'],
  ]),
  L('speaking', 'พูดให้คนฟัง', [
    ['ประหม่าคือเรื่องปกติ', 'แม้นักพูดมืออาชีพก็ประหม่า ฝึกบ่อยๆ จะดีขึ้น'],
    ['เปิดให้น่าสนใจ', 'เริ่มด้วยคำถามหรือเรื่องเล่าสั้นๆ ที่ดึงความสนใจ'],
    ['พูดช้าลงอีกนิด', 'คนตื่นเต้นมักพูดเร็วเกินไป ให้หยุดหายใจระหว่างประโยค'],
    ['สบตาคนฟัง', 'มองคนฟังทีละคนจะทำให้เหมือนคุยกันมากกว่าท่องจำ'],
  ], ['ประหม่า', 'พูดช้าลง', 'สบตา'], [
    ['เมื่อตื่นเต้นควรทำอะไร', 'พูดช้าลงและหยุดหายใจ', 'พูดให้เร็วที่สุด', 'ก้มหน้าอ่านอย่างเดียว'],
    ['การเปิดการพูดที่ดีคือ', 'เริ่มด้วยคำถามหรือเรื่องเล่าสั้นๆ', 'ขอโทษที่พูดไม่เก่ง', 'อ่านหัวข้อทีละบรรทัด'],
    ['การสบตาช่วยอะไร', 'ทำให้เหมือนคุยกับคนฟัง', 'ทำให้ลืมบท', 'ทำให้พูดเร็วขึ้น'],
  ]),
  L('dormlife', 'อยู่หอร่วมกันอย่างมีความสุข', [
    ['เวลาเงียบ', 'หลังเวลาเข้านอน เก็บเสียงและปิดไฟให้เพื่อนได้พักผ่อน'],
    ['ของส่วนกลาง', 'ล้างจานและเก็บของเข้าที่ทุกครั้งที่ใช้'],
    ['คุยกันก่อนโกรธ', 'ถ้ามีเรื่องไม่พอใจ ให้พูดสุภาพก่อนจะเก็บไว้จนระเบิด'],
    ['ดูแลกัน', 'ถ้าเพื่อนไม่สบายหรือเงียบผิดปกติ ให้ถามไถ่และบอกครูเวร'],
  ], ['เวลาเงียบ', 'ล้างจาน', 'ครูเวร'], [
    ['หลังเวลาเข้านอนควรทำอย่างไร', 'เก็บเสียงและปิดไฟ', 'เปิดเพลงเบาๆ ต่อ', 'คุยโทรศัพท์เสียงดัง'],
    ['ถ้าไม่พอใจเพื่อนร่วมห้องควรทำอย่างไร', 'พูดกันสุภาพก่อน', 'เก็บไว้จนระเบิด', 'ประกาศในกลุ่มแชต'],
    ['เมื่อเพื่อนไม่สบายควรทำอย่างไร', 'ถามไถ่และบอกครูเวร', 'ปล่อยให้พักเอง', 'ล้อให้ขำ'],
  ]),
  L('moon', 'ดวงจันทร์ของเรา', [
    ['ดวงจันทร์โคจรรอบโลก', 'ดวงจันทร์โคจรรอบโลกหนึ่งรอบประมาณ 27 วัน'],
    ['ข้างขึ้นข้างแรม', 'รูปร่างที่เห็นเปลี่ยนไปตามตำแหน่งที่แสงอาทิตย์ส่องมา'],
    ['จันทร์เพ็ญ', 'วันเพ็ญดวงจันทร์เห็นเต็มดวงตรงข้ามกับดวงอาทิตย์'],
    ['วันลอยกระทง', 'ลอยกระทงตรงกับคืนเดือนเพ็ญเดือนสิบสอง'],
  ], ['27 วัน', 'ข้างขึ้นข้างแรม', 'เดือนเพ็ญ'], [
    ['ดวงจันทร์โคจรรอบโลกหนึ่งรอบประมาณกี่วัน', '27 วัน', '7 วัน', '365 วัน'],
    ['รูปร่างพระจันทร์เปลี่ยนเพราะอะไร', 'ตำแหน่งที่แสงอาทิตย์ส่องมา', 'เงาของเมฆ', 'ดวงจันทร์หดตัว'],
    ['วันลอยกระทงตรงกับคืนใด', 'คืนเดือนเพ็ญเดือนสิบสอง', 'คืนเดือนดับ', 'คืนวันแรม 1 ค่ำ'],
  ]),
  L('mind', 'ใจก็ต้องดูแล', [
    ['สุขภาพใจสำคัญเท่าสุขภาพกาย', 'เหงา เศร้า หรือเครียดต่อเนื่อง ไม่ใช่เรื่องน่าอาย'],
    ['ฟังเพื่อน', 'บางครั้งเพื่อนไม่ต้องการคำแนะนำ แค่มีคนฟังก็พอ'],
    ['ขอความช่วยเหลือ', 'ครูแนะแนวและพยาบาลโรงเรียนพร้อมช่วยเสมอ'],
    ['ดูแลตัวเอง', 'นอนพอ ออกกำลังกาย และทำสิ่งที่ชอบสักหน่อยทุกวัน'],
  ], ['สุขภาพใจ', 'ฟังเพื่อน', 'ครูแนะแนว'], [
    ['เมื่อเพื่อนมาเล่าปัญหา ควรทำอะไรก่อน', 'ตั้งใจฟัง', 'รีบตัดสินว่าใครผิด', 'เปลี่ยนเรื่องคุย'],
    ['ถ้าเครียดเกินรับไหว ขอความช่วยเหลือจากใครได้', 'ครูแนะแนวหรือพยาบาล', 'ไม่มีใครช่วยได้', 'เก็บไว้เอง'],
    ['วิธีดูแลใจตัวเองคือ', 'นอนพอและทำสิ่งที่ชอบ', 'อดข้าวประท้วง', 'ไม่คุยกับใครเลย'],
  ]),
  L('sport', 'ขยับตัวให้เรียนดีขึ้น', [
    ['ออกกำลังกายทุกวัน', 'เด็กและวัยรุ่นควรเคลื่อนไหวอย่างน้อยวันละประมาณ 60 นาที'],
    ['สมองได้ประโยชน์ด้วย', 'การออกกำลังกายช่วยให้สมาธิและอารมณ์ดีขึ้น'],
    ['ไม่ต้องเก่ง', 'เดินเร็ว ปั่นจักรยาน เตะบอล ทุกอย่างนับเป็นการออกกำลัง'],
    ['อบอุ่นร่างกายก่อนเล่น', 'ยืดเหยียดก่อนเล่น ป้องกันกล้ามเนื้อเกร็งและบาดเจ็บ'],
  ], ['60 นาที', 'สมาธิ', 'ยืดเหยียด'], [
    ['วัยรุ่นควรเคลื่อนไหวประมาณกี่นาทีต่อวัน', 'ประมาณ 60 นาที', 'ประมาณ 5 นาที', 'ไม่ต้องเลย'],
    ['การออกกำลังกายช่วยสมองอย่างไร', 'ช่วยให้สมาธิและอารมณ์ดีขึ้น', 'ทำให้ง่วงตลอด', 'ทำให้ลืมสิ่งที่เรียน'],
    ['ก่อนเล่นกีฬาควรทำอะไร', 'ยืดเหยียดอบอุ่นร่างกาย', 'กินจุก', 'นอนก่อนหนึ่งชั่วโมง'],
  ]),
  L('honest', 'ซื่อสัตย์ในห้องสอบและในงาน', [
    ['การลอกคือการขโมย', 'ลอกงานเพื่อนคือการเอาความคิดของคนอื่นมาเป็นของเรา'],
    ['เสียมากกว่าได้', 'ได้คะแนนในวันนี้ แต่เสียความเชื่อใจที่สร้างไม่ง่าย'],
    ['อ้างอิงให้ถูกต้อง', 'ถ้าใช้ข้อมูลของคนอื่น ให้บอกแหล่งที่มา'],
    ['ผิดแล้วแก้ได้', 'ยอมรับตั้งแต่ต้นแล้วทำใหม่ ดีกว่าปิดไว้แล้วถูกจับได้ทีหลัง'],
  ], ['ความเชื่อใจ', 'แหล่งที่มา', 'ยอมรับ'], [
    ['การลอกงานเพื่อนเสียอะไรมากที่สุด', 'ความเชื่อใจ', 'ปากกา', 'เวลาพัก'],
    ['ถ้าใช้ข้อมูลของคนอื่นต้องทำอย่างไร', 'บอกแหล่งที่มา', 'ตัดชื่อออก', 'เปลี่ยนสีตัวอักษร'],
    ['ถ้าทำผิดไปแล้ว ควรทำอย่างไร', 'ยอมรับและแก้ไข', 'ปิดไว้ก่อน', 'โทษเพื่อน'],
  ]),
  L('ai', 'ใช้ AI ให้เป็น', [
    ['AI ช่วยได้มาก', 'ช่วยอธิบายตัวอย่างและตรวจคำผิดได้รวดเร็ว'],
    ['แต่ตอบผิดได้', 'AI อาจตอบมั่นใจแต่ข้อมูลผิด จึงต้องตรวจสอบเสมอ'],
    ['อย่าให้คิดแทนเรา', 'ถ้าให้ AI ทำการบ้านทั้งหมด เราจะไม่ได้ฝึกคิดเลย'],
    ['ตั้งคำถามให้ดี', 'ยิ่งถามชัดเจน ยิ่งได้คำตอบที่ใช้ประโยชน์ได้'],
  ], ['ตรวจสอบ', 'ฝึกคิด', 'ถามชัดเจน'], [
    ['AI อาจเกิดข้อผิดพลาดอย่างไร', 'ตอบมั่นใจแต่ข้อมูลผิด', 'ตอบถูกเสมอ', 'ไม่ตอบอะไรเลย'],
    ['ถ้าให้ AI ทำการบ้านทั้งหมดจะเกิดอะไรขึ้น', 'เราไม่ได้ฝึกคิด', 'ได้เก่งขึ้นเอง', 'ครูให้คะแนนเต็ม'],
    ['วิธีใช้ AI ให้ได้ประโยชน์คือ', 'ถามให้ชัดเจนและตรวจสอบคำตอบ', 'เชื่อทุกคำตอบ', 'ถามสั้นๆ ว่าอะไรก็ได้'],
  ]),
  L('fakenews', 'ข่าวปลอมอยู่รอบตัว', [
    ['ข่าวปลอมแพร่เร็ว', 'เรื่องที่ทำให้ตกใจหรือโกรธ มักถูกแชร์ต่อเร็วกว่าเรื่องจริง'],
    ['ตรวจแหล่งที่มา', 'ดูว่าใครเป็นผู้เผยแพร่และมีหน่วยงานน่าเชื่อถือยืนยันหรือไม่'],
    ['เช็กวันที่', 'ข่าวเก่าที่เอามาแชร์ใหม่ อาจทำให้เข้าใจผิด'],
    ['หยุดก่อนแชร์', 'ถ้าไม่แน่ใจ ให้หยุดและค้นหาข้อมูลเพิ่มก่อนกดแชร์'],
  ], ['แหล่งที่มา', 'วันที่', 'ก่อนแชร์'], [
    ['ข่าวปลอมมักถูกแชร์เร็วเพราะอะไร', 'ทำให้ตกใจหรือโกรธ', 'ตัวอักษรสวย', 'ไม่มีใครสนใจ'],
    ['วิธีแรกที่ควรตรวจคือ', 'แหล่งที่มา', 'จำนวนไลก์', 'ขนาดรูป'],
    ['ถ้าไม่แน่ใจว่าจริงหรือไม่ควรทำอย่างไร', 'หยุดและหาข้อมูลเพิ่มก่อนแชร์', 'แชร์ไปก่อน', 'ลบคนที่ส่งมา'],
  ]),
  L('mathfun', 'คณิตศาสตร์อยู่ในชีวิตจริง', [
    ['ทุกที่มีตัวเลข', 'ตั้งแต่ราคาในโรงอาหารจนถึงเวลาในตารางสอน'],
    ['ความน่าจะเป็น', 'โอกาสที่เหรียญออกหัวเท่ากับหนึ่งในสอง'],
    ['ร้อยละและส่วนลด', 'ลดยี่สิบเปอร์เซ็นต์ของร้อยบาท เหลือแปดสิบบาท'],
    ['คิดเป็นขั้นตอน', 'แบ่งโจทย์ยากให้เป็นข้อเล็กๆ ที่ตอบได้'],
  ], ['หนึ่งในสอง', 'ยี่สิบเปอร์เซ็นต์', 'ข้อเล็กๆ'], [
    ['โอกาสที่เหรียญออกหัวคือ', 'หนึ่งในสอง', 'หนึ่งในสิบ', 'เป็นศูนย์'],
    ['ลดยี่สิบเปอร์เซ็นต์ของร้อยบาท เหลือเท่าไร', 'แปดสิบบาท', 'ยี่สิบบาท', 'หนึ่งร้อยยี่สิบบาท'],
    ['เมื่อเจอโจทย์ยากควรทำอย่างไร', 'แบ่งเป็นข้อเล็กๆ', 'ข้ามไปเลย', 'เดาทุกข้อ'],
  ]),
  L('library', 'ห้องสมุดคือขุมทรัพย์', [
    ['หนังสือมีมากกว่าตำรา', 'นิยาย สารคดี และนิตยสารช่วยเปิดโลกได้เหมือนกัน'],
    ['อ่านวันละน้อย', 'วันละสิบหน้า รวมกันหนึ่งปีได้หลายเล่ม'],
    ['ค้นหาอย่างมีกลยุทธ์', 'ใช้สารบัญและดัชนี หาเรื่องที่ต้องการได้เร็วขึ้น'],
    ['ดูแลหนังสือ', 'คืนตรงเวลาและไม่ขีดเขียน เพื่อให้เพื่อนรุ่นต่อไปได้อ่าน'],
  ], ['วันละสิบหน้า', 'สารบัญ', 'คืนตรงเวลา'], [
    ['อ่านวันละสิบหน้าช่วยอย่างไร', 'รวมกันหนึ่งปีได้หลายเล่ม', 'ไม่ช่วยอะไร', 'ทำให้ตาเสีย'],
    ['อะไรช่วยให้ค้นหาเรื่องที่ต้องการได้เร็ว', 'สารบัญและดัชนี', 'ปกหนังสือ', 'เลขหน้าล่าสุด'],
    ['เรื่องการดูแลหนังสือ ควรทำอย่างไร', 'คืนตรงเวลา', 'ขีดเขียนในหนังสือ', 'ซ่อนไว้ไม่ให้ใครยืม'],
  ]),
  L('teamwork', 'ทำงานกลุ่มไม่ให้ทะเลาะ', [
    ['ตกลงบทบาทตั้งแต่แรก', 'ใครหาข้อมูล ใครเขียน ใครนำเสนอ ให้ตกลงกันก่อนเริ่ม'],
    ['กำหนดส่งภายใน', 'ตั้งวันเสร็จของแต่ละส่วนให้เร็วกว่าวันส่งจริง'],
    ['พูดถึงงาน ไม่พูดถึงคน', 'ติแต่เนื้องานเพื่อไม่ให้ใครเสียใจ'],
    ['ช่วยกันตรวจก่อนส่ง', 'อ่านรวมกันอีกครั้งเพื่อให้ทุกส่วนเข้ากัน'],
  ], ['บทบาท', 'วันเสร็จ', 'เนื้องาน'], [
    ['สิ่งที่ควรทำก่อนเริ่มงานกลุ่มคือ', 'ตกลงบทบาทของแต่ละคน', 'รอดูว่าใครทำก่อน', 'ทำคนเดียวทั้งหมด'],
    ['เวลาตำหนิควรพูดถึงอะไร', 'เนื้องาน', 'นิสัยของเพื่อน', 'ครอบครัวเพื่อน'],
    ['ก่อนส่งงานกลุ่มควรทำอะไร', 'ช่วยกันตรวจรวมอีกครั้ง', 'ส่งทันทีที่ใครเสร็จ', 'ไม่ต้องตรวจ'],
  ]),
];

const SPECIAL_DAYS = [
  L('wai_khru', 'พิธีไหว้ครู', [
    ['พานไหว้ครู', 'นักเรียนยกพานดอกไม้ธูปเทียนขึ้นแสดงความเคารพครู'],
    ['ดอกเข็ม', 'ดอกเข็มหมายถึงความเฉลียวฉลาดและความคิดที่แหลมคม'],
    ['หญ้าแพรก', 'หญ้าแพรกงอกงามเร็ว เป็นเครื่องหมายของความเจริญงอกงามทางปัญญา'],
    ['ข้าวตอก', 'ข้าวตอกหมายถึงระเบียบวินัยและการรักษาตัวให้บริสุทธิ์'],
  ], ['ดอกเข็ม', 'หญ้าแพรก', 'ข้าวตอก'], [
    ['ดอกเข็มในพานไหว้ครูหมายถึงอะไร', 'ความเฉลียวฉลาดแหลมคม', 'ความร่ำรวย', 'ความอ่อนโยนเท่านั้น'],
    ['หญ้าแพรกเป็นเครื่องหมายของอะไร', 'ความเจริญงอกงามทางปัญญา', 'ความเงียบสงบ', 'การเดินทางไกล'],
    ['ข้าวตอกหมายถึงอะไร', 'ระเบียบวินัย', 'ความเร็ว', 'ความร่าเริง'],
  ], { month: 6 }),
  L('thai_language_day', 'วันภาษาไทยแห่งชาติ', [
    ['วันที่ 29 กรกฎาคม', 'ทุกวันที่ 29 กรกฎาคมเป็นวันภาษาไทยแห่งชาติ'],
    ['ลายสือไทย', 'เชื่อกันว่าพ่อขุนรามคำแหงมหาราชทรงประดิษฐ์ลายสือไทย'],
    ['ภาษาไทยมีวรรณยุกต์', 'ภาษาไทยมีวรรณยุกต์ห้าเสียง ช่วยให้คำเดียวมีความหมายต่างกันได้'],
    ['ร่วมกันรักษา', 'พูดและเขียนให้ถูกต้อง เป็นการรักษาภาษาของเรา'],
  ], ['29 กรกฎาคม', 'ลายสือไทย', 'วรรณยุกต์ห้าเสียง'], [
    ['วันภาษาไทยแห่งชาติตรงกับวันที่เท่าไร', '29 กรกฎาคม', '12 สิงหาคม', '5 ธันวาคม'],
    ['เชื่อกันว่าใครประดิษฐ์ลายสือไทย', 'พ่อขุนรามคำแหงมหาราช', 'พระนเรศวรมหาราช', 'สุนทรภู่'],
    ['ภาษาไทยมีวรรณยุกต์กี่เสียง', 'ห้าเสียง', 'สามเสียง', 'เก้าเสียง'],
  ], { month: 7 }),
  L('science_day', 'วันวิทยาศาสตร์แห่งชาติ', [
    ['วันที่ 18 สิงหาคม', 'วันที่ 18 สิงหาคมเป็นวันวิทยาศาสตร์แห่งชาติ'],
    ['พระบิดาแห่งวิทยาศาสตร์ไทย', 'ถวายพระเกียรติรัชกาลที่ 4 ผู้ทรงสนพระทัยดาราศาสตร์'],
    ['สุริยุปราคาที่หว้ากอ', 'ทรงคำนวณล่วงหน้าว่าจะเกิดสุริยุปราคาเต็มดวง พ.ศ. 2411'],
    ['วิทยาศาสตร์เริ่มที่คำถาม', 'ทุกการค้นพบเริ่มจากการสังเกตแล้วตั้งคำถามว่าทำไม'],
  ], ['18 สิงหาคม', 'รัชกาลที่ 4', 'ตั้งคำถาม'], [
    ['วันวิทยาศาสตร์แห่งชาติตรงกับวันที่เท่าไร', '18 สิงหาคม', '16 มกราคม', '26 มิถุนายน'],
    ['พระมหากษัตริย์พระองค์ใดทรงเป็นพระบิดาแห่งวิทยาศาสตร์ไทย', 'รัชกาลที่ 4', 'รัชกาลที่ 1', 'พระนเรศวร'],
    ['วิทยาศาสตร์เริ่มต้นจากอะไร', 'การสังเกตและตั้งคำถาม', 'การท่องจำ', 'การเดาแล้วเชื่อเลย'],
  ], { month: 8 }),
  L('mothers_day', 'วันแม่แห่งชาติ', [
    ['วันที่ 12 สิงหาคม', 'วันแม่แห่งชาติตรงกับวันที่ 12 สิงหาคม'],
    ['ดอกมะลิ', 'ดอกมะลิเป็นสัญลักษณ์ของความรักและความบริสุทธิ์ของแม่'],
    ['กราบแม่', 'ลูกๆ กราบแทนความรักและขอบคุณที่แม่เลี้ยงดู'],
    ['พูดตอนนี้เลย', 'โทรบอกแม่ว่าสบายดี คือของขวัญที่ดีที่สุดสำหรับเด็กหอ'],
  ], ['12 สิงหาคม', 'ดอกมะลิ', 'โทรบอกแม่'], [
    ['วันแม่แห่งชาติตรงกับวันที่เท่าไร', '12 สิงหาคม', '5 ธันวาคม', '16 มกราคม'],
    ['สัญลักษณ์ของวันแม่คือดอกอะไร', 'ดอกมะลิ', 'ดอกกุหลาบแดง', 'ดอกบัว'],
    ['ของขวัญที่วิทยากรแนะนำสำหรับเด็กหอคือ', 'โทรบอกแม่ว่าสบายดี', 'ซื้อเครื่องประดับ', 'ส่งการบ้านแทนแม่'],
  ], { month: 8 }),
  L('fathers_day', 'วันพ่อแห่งชาติ', [
    ['วันที่ 5 ธันวาคม', 'วันพ่อแห่งชาติตรงกับวันที่ 5 ธันวาคม'],
    ['ดอกพุทธรักษา', 'ดอกพุทธรักษาเป็นสัญลักษณ์ของวันพ่อ'],
    ['พ่อหลวงของแผ่นดิน', 'วันนี้ตรงกับวันคล้ายวันพระราชสมภพของรัชกาลที่ 9'],
    ['พ่อที่ทำงานหนัก', 'เรียนให้เต็มที่ คือการตอบแทนความเหนื่อยของพ่อ'],
  ], ['5 ธันวาคม', 'ดอกพุทธรักษา', 'รัชกาลที่ 9'], [
    ['วันพ่อแห่งชาติตรงกับวันที่เท่าไร', '5 ธันวาคม', '12 สิงหาคม', '29 กรกฎาคม'],
    ['สัญลักษณ์ของวันพ่อคือดอกอะไร', 'ดอกพุทธรักษา', 'ดอกมะลิ', 'ดอกเข็ม'],
    ['วันพ่อแห่งชาติตรงกับวันคล้ายวันพระราชสมภพของใคร', 'รัชกาลที่ 9', 'รัชกาลที่ 4', 'รัชกาลที่ 5'],
  ], { month: 12 }),
  L('teachers_day', 'วันครู', [
    ['วันที่ 16 มกราคม', 'วันครูตรงกับวันที่ 16 มกราคมของทุกปี'],
    ['ครูคือผู้ให้', 'ครูให้ความรู้ ให้กำลังใจ และเป็นแบบอย่างที่ดี'],
    ['คำขอบคุณเล็กๆ', 'แค่ไหว้และบอกว่าขอบคุณ ก็ทำให้ครูมีกำลังใจ'],
    ['เรียนรู้ได้จากทุกคน', 'เพื่อนรุ่นพี่และคนรอบตัวก็สอนเราได้เหมือนกัน'],
  ], ['16 มกราคม', 'แบบอย่างที่ดี', 'ขอบคุณ'], [
    ['วันครูตรงกับวันที่เท่าไร', '16 มกราคม', '26 มิถุนายน', '5 มิถุนายน'],
    ['คำขอบคุณเล็กๆ ช่วยอะไร', 'ทำให้ครูมีกำลังใจ', 'ทำให้ได้คะแนนเพิ่ม', 'ทำให้ครูไม่สอน'],
    ['เราเรียนรู้ได้จากใครบ้าง', 'ทุกคนรอบตัว', 'เฉพาะครูในห้อง', 'เฉพาะหนังสือ'],
  ], { month: 1 }),
  L('sunthorn_phu', 'วันสุนทรภู่', [
    ['วันที่ 26 มิถุนายน', 'วันสุนทรภู่ตรงกับวันที่ 26 มิถุนายน'],
    ['กวีเอกของไทย', 'สุนทรภู่แต่งนิราศและนิทานคำกลอนหลายเรื่อง'],
    ['พระอภัยมณี', 'พระอภัยมณีเป็นนิทานคำกลอนที่มีทั้งนางเงือก ผีเสื้อสมุทร และพระอภัยมณีที่เป่าปี่'],
    ['กลอนสุภาพ', 'ลองแต่งกลอนสี่บรรทัด สัมผัสคล้องจองกันเอง'],
  ], ['26 มิถุนายน', 'พระอภัยมณี', 'กลอนสี่บรรทัด'], [
    ['วันสุนทรภู่ตรงกับวันที่เท่าไร', '26 มิถุนายน', '29 กรกฎาคม', '12 สิงหาคม'],
    ['วรรณคดีเรื่องใดเป็นผลงานของสุนทรภู่', 'พระอภัยมณี', 'ขุนช้างขุนแผน', 'สังข์ทอง'],
    ['พระอภัยมณีมีของวิเศษคืออะไร', 'ปี่', 'ดาบ', 'ร่ม'],
  ], { month: 6 }),
  L('anti_drug', 'วันต่อต้านยาเสพติด', [
    ['วันที่ 26 มิถุนายน', 'วันต่อต้านยาเสพติดโลกตรงกับวันที่ 26 มิถุนายน'],
    ['ผลเสียต่อชีวิต', 'ยาเสพติดทำลายสุขภาพ การเรียน และความสัมพันธ์ในครอบครัว'],
    ['เพื่อนดีช่วยกันได้', 'ชวนกันทำกิจกรรมดีๆ แทนการรวมกลุ่มเสี่ยง'],
    ['ขอความช่วยเหลือ', 'ถ้าเจอปัญหา ปรึกษาครูและผู้ปกครองได้ทันที'],
  ], ['26 มิถุนายน', 'ทำลายสุขภาพ', 'ปรึกษาครู'], [
    ['วันต่อต้านยาเสพติดโลกตรงกับวันที่เท่าไร', '26 มิถุนายน', '5 มิถุนายน', '18 สิงหาคม'],
    ['ยาเสพติดทำลายสิ่งใดบ้าง', 'สุขภาพ การเรียน และครอบครัว', 'เฉพาะสุขภาพ', 'ไม่ทำลายอะไร'],
    ['ถ้าเจอปัญหาควรทำอย่างไร', 'ปรึกษาครูและผู้ปกครอง', 'ปิดไว้เงียบๆ', 'ลองด้วยตัวเอง'],
  ], { month: 6 }),
  L('childrens_day', 'วันเด็กแห่งชาติ', [
    ['วันเสาร์ที่สองของเดือนมกราคม', 'วันเด็กแห่งชาติตรงกับวันเสาร์ที่สองของเดือนมกราคม'],
    ['คำขวัญวันเด็ก', 'ทุกปีนายกรัฐมนตรีจะมอบคำขวัญวันเด็กเพื่อเตือนใจเด็กๆ'],
    ['สิทธิเด็ก', 'เด็กทุกคนมีสิทธิได้เรียน ได้เล่น และได้รับการปกป้อง'],
    ['เด็กในวันนี้คือผู้ใหญ่ในวันหน้า', 'ตั้งใจเรียนและทำตัวให้เป็นแบบอย่างที่ดี'],
  ], ['เสาร์ที่สอง', 'คำขวัญวันเด็ก', 'ปกป้อง'], [
    ['วันเด็กแห่งชาติตรงกับวันใด', 'วันเสาร์ที่สองของเดือนมกราคม', 'วันที่ 1 เมษายน', 'วันศุกร์แรกของเดือนธันวาคม'],
    ['ใครเป็นผู้มอบคำขวัญวันเด็กทุกปี', 'นายกรัฐมนตรี', 'ผู้อำนวยการโรงเรียน', 'ประธานนักเรียน'],
    ['เด็กทุกคนมีสิทธิอะไรบ้าง', 'ได้เรียน ได้เล่น และได้รับการปกป้อง', 'ไม่ต้องไปโรงเรียน', 'ไม่ต้องรับผิดชอบ'],
  ], { month: 1 }),
  L('environment_day', 'วันสิ่งแวดล้อมโลก', [
    ['วันที่ 5 มิถุนายน', 'วันสิ่งแวดล้อมโลกตรงกับวันที่ 5 มิถุนายน'],
    ['ต้นไม้ช่วยโลก', 'ต้นไม้ดูดคาร์บอนไดออกไซด์และให้ร่มเงา'],
    ['ลดการใช้ครั้งเดียวทิ้ง', 'ใช้กระติกน้ำแทนขวดพลาสติกใหม่ทุกวัน'],
    ['โรงเรียนสีเขียว', 'ช่วยกันปลูกต้นไม้และรักษาความสะอาดรอบหอ'],
  ], ['5 มิถุนายน', 'คาร์บอนไดออกไซด์', 'กระติกน้ำ'], [
    ['วันสิ่งแวดล้อมโลกตรงกับวันที่เท่าไร', '5 มิถุนายน', '26 มิถุนายน', '12 สิงหาคม'],
    ['ต้นไม้ช่วยโลกอย่างไร', 'ดูดคาร์บอนไดออกไซด์และให้ร่มเงา', 'ทำให้โลกร้อน', 'ไม่ช่วยอะไร'],
    ['วิธีลดขยะพลาสติกที่ทำได้ง่ายคือ', 'ใช้กระติกน้ำของตัวเอง', 'ซื้อขวดใหม่ทุกวัน', 'เผาขยะ'],
  ], { month: 6 }),
  L('school_founding', 'วันคล้ายวันสถาปนาโรงเรียน', [
    ['ประวัติโรงเรียนของเรา', 'ผู้อำนวยการเล่าว่าโรงเรียนเริ่มต้นจากอาคารเล็กๆ และนักเรียนไม่กี่ห้อง'],
    ['ธรรมเนียมที่สืบต่อ', 'รุ่นพี่สอนรุ่นน้องร้องเพลงโรงเรียนและรักษาความสะอาดหอพัก'],
    ['ศิษย์เก่าที่เป็นแรงบันดาล', 'ศิษย์เก่าหลายคนกลับมาเล่าว่าความเพียรทำให้เดินทางไกลได้'],
    ['เราคือส่วนหนึ่ง', 'ทุกคนที่อยู่ที่นี่คือผู้สานต่อประวัติศาสตร์ของโรงเรียน'],
  ], ['อาคารเล็กๆ', 'เพลงโรงเรียน', 'ความเพียร'], [
    ['โรงเรียนเริ่มต้นจากอะไร', 'อาคารเล็กๆ และนักเรียนไม่กี่ห้อง', 'ตึกสูงหลายสิบชั้น', 'ค่ายทหาร'],
    ['รุ่นพี่สอนรุ่นน้องเรื่องใด', 'ร้องเพลงโรงเรียนและรักษาความสะอาด', 'วิธีลอกการบ้าน', 'วิธีหนีเรียน'],
    ['ศิษย์เก่าบอกว่าอะไรทำให้เดินทางไกลได้', 'ความเพียร', 'โชคช่วย', 'การนอนทั้งวัน'],
  ], { month: 11 }),
  L('constitution_day', 'วันรัฐธรรมนูญ', [
    ['วันที่ 10 ธันวาคม', 'วันรัฐธรรมนูญตรงกับวันที่ 10 ธันวาคม'],
    ['รัฐธรรมนูญคืออะไร', 'เป็นกฎหมายสูงสุดที่วางหลักการปกครองประเทศ'],
    ['สิทธิและเสรีภาพ', 'ประชาชนทุกคนมีสิทธิและเสรีภาพตามที่กฎหมายรับรอง'],
    ['รู้หน้าที่ด้วย', 'การใช้สิทธิต้องไม่ละเมิดสิทธิของผู้อื่น'],
  ], ['10 ธันวาคม', 'กฎหมายสูงสุด', 'สิทธิและเสรีภาพ'], [
    ['วันรัฐธรรมนูญตรงกับวันที่เท่าไร', '10 ธันวาคม', '5 ธันวาคม', '16 มกราคม'],
    ['รัฐธรรมนูญคืออะไร', 'กฎหมายสูงสุดของประเทศ', 'ระเบียบของหอพัก', 'ตารางสอน'],
    ['การใช้สิทธิต้องระวังเรื่องใด', 'ไม่ละเมิดสิทธิผู้อื่น', 'ไม่ต้องระวังอะไร', 'ใช้ให้มากที่สุด'],
  ], { month: 12 }),
  L('buddhist_lent', 'วันเข้าพรรษา', [
    ['สามเดือนในฤดูฝน', 'พระภิกษุอยู่ประจำที่วัดตลอดฤดูฝนประมาณสามเดือน'],
    ['ถวายเทียนพรรษา', 'ชาวบ้านร่วมกันถวายเทียนพรรษาเพื่อให้มีแสงสว่างในวัด'],
    ['งดอบายมุข', 'หลายคนตั้งใจเลิกนิสัยไม่ดีในช่วงเข้าพรรษา'],
    ['ตั้งเป้าเล็กๆ', 'ลองตั้งเป้าสามเดือน เช่น นอนเร็วขึ้นหรือออกกำลังกายทุกวัน'],
  ], ['สามเดือน', 'เทียนพรรษา', 'ตั้งเป้า'], [
    ['วันเข้าพรรษาพระภิกษุอยู่ประจำที่วัดประมาณกี่เดือน', 'สามเดือน', 'หนึ่งเดือน', 'หนึ่งปี'],
    ['ชาวบ้านถวายอะไรเพื่อให้มีแสงสว่างในวัด', 'เทียนพรรษา', 'ไฟฉาย', 'โคมกระดาษ'],
    ['ช่วงเข้าพรรษาหลายคนตั้งใจทำอะไร', 'เลิกนิสัยไม่ดีหรือฝึกนิสัยดี', 'ไม่ทำอะไรเลย', 'เปลี่ยนห้องนอน'],
  ], { month: 7 }),
];

const AWARD_VARIANTS = [
  L('award_diligence', 'ความขยันชนะพรสวรรค์', [
    ['เสียงจากผู้อำนวยการ', 'ผู้อำนวยการกล่าวว่าความขยันสม่ำเสมอสำคัญกว่าพรสวรรค์'],
    ['เรื่องเล่า', 'รุ่นพี่คนหนึ่งเริ่มจากเกรดสอง แต่ตื่นเช้าอ่านทุกวันจนได้สี่'],
    ['ข้อคิด', 'ทำน้อยๆ ทุกวัน ดีกว่าทำเยอะๆ วันเดียว'],
  ], ['ความขยัน', 'ตื่นเช้า', 'ทุกวัน'], [
    ['ผู้อำนวยการบอกว่าอะไรสำคัญกว่าพรสวรรค์', 'ความขยันสม่ำเสมอ', 'โชคดี', 'ความสูง'],
    ['รุ่นพี่ในเรื่องเล่าทำอะไรจนได้เกรดสี่', 'ตื่นเช้าอ่านทุกวัน', 'อ่านคืนเดียว', 'ลอกเพื่อน'],
    ['ข้อคิดที่ได้คือ', 'ทำน้อยๆ ทุกวัน', 'ทำเยอะวันเดียว', 'รอแรงบันดาลใจ'],
  ]),
  L('award_honest', 'เกรดสี่ที่เกิดจากความซื่อสัตย์', [
    ['ประธานกล่าวต้อนรับ', 'ประธานบอกว่าเกรดที่ได้มาด้วยความซื่อสัตย์มีค่าที่สุด'],
    ['เรื่องเล่า', 'นักเรียนคนหนึ่งยอมรับว่าตอบผิดข้อหนึ่งแม้ครูไม่เห็น'],
    ['ข้อคิด', 'คนที่เชื่อใจได้ คือรางวัลที่ใหญ่กว่าเกียรติบัตร'],
  ], ['ความซื่อสัตย์', 'ยอมรับ', 'เชื่อใจได้'], [
    ['ประธานบอกว่าเกรดแบบใดมีค่าที่สุด', 'เกรดที่ได้ด้วยความซื่อสัตย์', 'เกรดที่ได้เร็วที่สุด', 'เกรดที่ลอกมา'],
    ['นักเรียนในเรื่องเล่าทำอะไร', 'ยอมรับว่าตอบผิดข้อหนึ่ง', 'แอบแก้คำตอบ', 'ไม่เล่าให้ใครฟัง'],
    ['รางวัลที่ใหญ่กว่าเกียรติบัตรคือ', 'การเป็นคนที่เชื่อใจได้', 'ของขวัญ', 'ชื่อบนบอร์ด'],
  ]),
  L('award_kind', 'เก่งแล้วอย่าลืมช่วยเพื่อน', [
    ['ผู้อำนวยการกล่าวชื่นชม', 'ผู้อำนวยการชมว่านักเรียนเก่งหลายคนเป็นผู้ติวให้เพื่อนด้วย'],
    ['เรื่องเล่า', 'นักเรียนห้องหนึ่งช่วยกันติวจนเพื่อนทั้งห้องผ่าน'],
    ['ข้อคิด', 'ความรู้ยิ่งแบ่งยิ่งเพิ่ม'],
  ], ['ติวให้เพื่อน', 'ทั้งห้องผ่าน', 'ยิ่งแบ่งยิ่งเพิ่ม'], [
    ['ผู้อำนวยการชมนักเรียนเก่งเรื่องใดเพิ่มเติม', 'ติวให้เพื่อน', 'นอนเร็ว', 'วิ่งเร็ว'],
    ['ผลของการช่วยกันติวในเรื่องเล่าคืออะไร', 'เพื่อนทั้งห้องผ่าน', 'ห้องอื่นแพ้', 'ครูลาออก'],
    ['ความรู้เป็นอย่างไรเมื่อแบ่งปัน', 'ยิ่งแบ่งยิ่งเพิ่ม', 'ยิ่งแบ่งยิ่งหมด', 'ไม่เปลี่ยน'],
  ]),
  L('award_rise', 'ล้มแล้วลุกขึ้นใหม่', [
    ['ผู้กล่าวรางวัล', 'ผู้กล่าวบอกว่าหลายคนที่ได้สี่เคยสอบตกมาก่อน'],
    ['เรื่องเล่า', 'นักเรียนคนหนึ่งสอบตกวิชาเลขแล้วนั่งทำโจทย์ใหม่ทุกคืน'],
    ['ข้อคิด', 'ความผิดพลาดคือครูที่ดีที่สุดถ้าเรากล้ามองมัน'],
  ], ['สอบตก', 'ทุกคืน', 'ความผิดพลาด'], [
    ['ผู้กล่าวบอกว่าหลายคนที่ได้สี่เคยเป็นอย่างไร', 'เคยสอบตกมาก่อน', 'ไม่เคยอ่านหนังสือ', 'ไม่เคยพลาด'],
    ['นักเรียนในเรื่องเล่าทำอะไรหลังสอบตก', 'ทำโจทย์ใหม่ทุกคืน', 'เลิกเรียนเลข', 'โทษครู'],
    ['ใครคือครูที่ดีที่สุดตามข้อคิด', 'ความผิดพลาด', 'ความโชคดี', 'เสียงเพลง'],
  ]),
  L('award_parents', 'ขอบคุณคนที่ยืนอยู่ข้างหลัง', [
    ['พิธีกรเชิญผู้ปกครอง', 'พิธีกรกล่าวขอบคุณผู้ปกครองที่ส่งลูกมาอยู่หอพัก'],
    ['เรื่องเล่า', 'ผู้ปกครองคนหนึ่งขับรถมาไกลทุกสองสัปดาห์เพื่อรับลูกกลับบ้าน'],
    ['ข้อคิด', 'ทุกรางวัลมีคนอีกหลายคนช่วยเงียบๆ'],
  ], ['ผู้ปกครอง', 'ทุกสองสัปดาห์', 'ช่วยเงียบๆ'], [
    ['พิธีกรกล่าวขอบคุณใคร', 'ผู้ปกครอง', 'ภารโรง', 'ศิษย์เก่า'],
    ['ผู้ปกครองในเรื่องเล่ามารับลูกบ่อยแค่ไหน', 'ทุกสองสัปดาห์', 'ทุกวัน', 'ปีละครั้ง'],
    ['ข้อคิดสุดท้ายคืออะไร', 'ทุกรางวัลมีคนช่วยเงียบๆ', 'ไม่ต้องขอบคุณ', 'ทำคนเดียวได้'],
  ]),
  L('award_learn', 'เรียนรู้ไม่มีวันเสร็จ', [
    ['ผู้อำนวยการกล่าว', 'เกรดสี่คือจุดเริ่มต้น ไม่ใช่เส้นชัย'],
    ['เรื่องเล่า', 'ศิษย์เก่าบอกว่าที่มหาวิทยาลัยต้องเรียนรู้ใหม่ทุกสัปดาห์'],
    ['ข้อคิด', 'ถามให้เยอะ อ่านให้กว้าง และอย่าหยุดอยากรู้'],
  ], ['จุดเริ่มต้น', 'เรียนรู้ใหม่', 'อยากรู้'], [
    ['ผู้อำนวยการเรียกเกรดสี่ว่าอะไร', 'จุดเริ่มต้น', 'เส้นชัย', 'ของขวัญ'],
    ['ศิษย์เก่าบอกว่าที่มหาวิทยาลัยต้องทำอะไร', 'เรียนรู้ใหม่ทุกสัปดาห์', 'ไม่ต้องเรียน', 'นอนทั้งวัน'],
    ['ข้อคิดให้ทำอย่างไร', 'ถามให้เยอะและอย่าหยุดอยากรู้', 'ท่องให้เร็ว', 'เลิกถาม'],
  ]),
];

// farewell: speeches by the leaving teacher. {name} is the teacher's name. keyword = the line the class should remember.
const FAREWELL_SPEECHES = [
  { id: 'f1', open: 'ครูอยู่กับพวกเราที่นี่มาหลายปี วันนี้ถึงเวลาต้องลาแล้ว', memory: 'ครูจำได้ว่าห้องนี้เคยรวมตัวกันเตรียมตัวสอบ แล้วนั่งหัวเราะจนดึก', advice: 'ขอให้ทุกคนอย่ากลัวที่จะถาม', wish: 'ขอให้ทุกคนเจอแต่สิ่งดีๆ', keyword: 'อย่ากลัวที่จะถาม' },
  { id: 'f2', open: 'ครูขอบคุณทุกคนที่ทำให้ห้องเรียนมีชีวิต', memory: 'ครูไม่ลืมวันที่ทุกคนช่วยกันซ่อมกระดานที่หลุด', advice: 'ขอให้ช่วยเหลือกันเหมือนที่เคยทำ', wish: 'ขอให้ได้เจอกันอีก', keyword: 'ช่วยเหลือกัน' },
  { id: 'f3', open: 'ครูพูดไม่เก่งเรื่องลา แต่ขอพูดสั้นๆ ให้ซึ้งที่สุด', memory: 'ครูจะจำเสียงหัวเราะในคาบสุดท้ายของวันศุกร์', advice: 'ขอให้ทำงานทุกอย่างด้วยใจ', wish: 'ขอให้เติบโตเป็นคนที่ภูมิใจในตัวเอง', keyword: 'ด้วยใจ' },
  { id: 'f4', open: 'ครูเดินผ่านห้องนี้ทุกเช้ามานานแล้ว', memory: 'ครูยังจำเสียงทักทายเช้าวันจันทร์ได้เสมอ', advice: 'ขอให้ตื่นเช้าและยิ้มทักทายกัน', wish: 'ขอให้ทุกเช้าของพวกเธอสดใส', keyword: 'ยิ้มทักทาย' },
  { id: 'f5', open: 'ถึงจะลาแล้ว แต่ครูจะส่งใจมาเชียร์พวกเธอเสมอ', memory: 'ครูจำวันที่ทีมห้องนี้ชนะแข่งตอบปัญหาแล้วกอดกันทั้งห้อง', advice: 'ขอให้เชื่อมั่นในทีม', wish: 'ขอให้ไปถึงฝัน', keyword: 'เชื่อมั่นในทีม' },
  { id: 'f6', open: 'การสอนพวกเธอคือสิ่งที่ครูภูมิใจที่สุดในชีวิต', memory: 'ครูเก็บการ์ดที่พวกเธอเขียนให้ไว้ในลิ้นชักทุกใบ', advice: 'ขอให้ไม่เคยหยุดเรียนรู้', wish: 'ขอให้พบแต่ความสุข', keyword: 'ไม่เคยหยุดเรียนรู้' },
  { id: 'f7', open: 'เวลาผ่านไปเร็วจนครูไม่ทันตั้งตัว', memory: 'ครูยังนึกถึงวันที่ฝนตกหนักแล้วทั้งห้องร่วมกันกางร่มเดินไปโรงอาหาร', advice: 'ขอให้ดูแลกันเมื่อลำบาก', wish: 'ขอให้ไม่มีใครต้องเดินคนเดียว', keyword: 'ดูแลกัน' },
  { id: 'f8', open: 'ครูมีของฝากสั้นๆ ก่อนลาจากไป', memory: 'ครูจำได้ว่าเคยเห็นหลายคนตั้งใจจนลืมกินข้าว', advice: 'ขอให้ดูแลสุขภาพให้ดี', wish: 'ขอให้แข็งแรงตลอดไป', keyword: 'ดูแลสุขภาพ' },
];

const FAREWELL_REASON_TEXT = {
  'ลาออก': 'ครูตัดสินใจลาออกไปเริ่มชีวิตใหม่ที่ต่างจังหวัด',
  'เกษียณอายุ 60 ปี': 'ครูครบเกษียณอายุ 60 ปีแล้ว และขอบคุณทุกคนที่อยู่ด้วยกันมาตลอด',
};

const NEW_TEACHER_LINES = [
  'ครูท่านใหม่จะมารับช่วงต่อ ขอให้ทุกคนต้อนรับด้วยน้ำใจ',
  'ตารางเรียนเหมือนเดิม แต่จะมีครูคนใหม่ที่ยังไม่รู้จักพวกเธอ ช่วยแนะนำตัวให้ครูด้วย',
  'คาบหน้าจะได้พบครูท่านใหม่ ขอให้ทุกคนอย่าเพิ่งเอาไปเทียบ',
];

const FRESHER_SESSIONS = [
  L('welcome', 'พิธีต้อนรับน้องใหม่', [
    ['ผู้อำนวยการกล่าวต้อนรับ', 'ขอต้อนรับน้องใหม่ทุกคนสู่บ้านหลังที่สอง'],
    ['ทำความรู้จักโรงเรียน', 'โรงเรียนของเรามีหอพักแยกชายหญิง และมีโรงอาหารเปิดตลอดวัน'],
    ['พี่ๆ ยินดีช่วย', 'ถ้าหลงทางหรือมีปัญหา ถามพี่ได้ทุกคน'],
    ['ตั้งใจเรียน ตั้งใจเล่น', 'ที่นี่มีทั้งเรียน กิจกรรม และเพื่อนใหม่รอคุณอยู่'],
  ], ['บ้านหลังที่สอง', 'โรงอาหาร', 'ถามพี่'], [
    ['ผู้อำนวยการเรียกโรงเรียนว่าอะไร', 'บ้านหลังที่สอง', 'ค่ายฝึก', 'ศูนย์การค้า'],
    ['โรงอาหารของโรงเรียนเป็นอย่างไร', 'เปิดตลอดวัน', 'เปิดเฉพาะเช้า', 'ปิดวันศุกร์'],
    ['ถ้าหลงทางควรทำอย่างไร', 'ถามพี่', 'นั่งรอ', 'กลับบ้านเลย'],
  ]),
  L('dorm_rules', 'กฎหอพักและชีวิตประจำวัน', [
    ['ออกจากหอตามเวลา', 'ทุกเช้าต้องออกจากหอตามเวลาที่กำหนด และห้ามกลับเข้าไป'],
    ['เช็กชื่อตอนเย็น', 'ก่อนหนึ่งทุ่มต้องเข้าหอเช็กชื่อกับครูเวร'],
    ['ไฟดับตามเวลา', 'ถึงเวลานอนต้องขึ้นห้องและปิดไฟ'],
    ['ดูแลของมีค่า', 'เก็บเงินและของสำคัญในที่ปลอดภัย และตั้งชื่อกำกับของทุกชิ้น'],
  ], ['ห้ามกลับเข้าไป', 'ครูเวร', 'ตั้งชื่อกำกับ'], [
    ['หลังออกจากหอตอนเช้าทำอย่างไรได้บ้าง', 'ห้ามกลับเข้าไป', 'กลับไปนอนต่อ', 'ใช้ห้องเพื่อนอื่นนอน'],
    ['ต้องเช็กชื่อกับใครตอนเย็น', 'ครูเวร', 'ภารโรง', 'ศิษย์เก่า'],
    ['เรื่องของมีค่าควรทำอย่างไร', 'ตั้งชื่อกำกับและเก็บในที่ปลอดภัย', 'วางไว้บนโต๊ะ', 'ฝากเพื่อนทุกชิ้น'],
  ]),
  L('school_song', 'ประวัติและเพลงโรงเรียน', [
    ['ประวัติโรงเรียน', 'โรงเรียนเปิดสอนนักเรียนจากหลายจังหวัดให้มาเรียนด้วยกัน'],
    ['เพลงประจำโรงเรียน', 'ทุกเช้าวันจันทร์ ทั้งโรงเรียนร้องเพลงประจำโรงเรียนพร้อมกัน'],
    ['สีประจำโรงเรียน', 'สีประจำโรงเรียนเป็นสีที่ศิษย์เก่าทุกคนจำได้ในใจ'],
    ['ธรรมเนียมการไหว้', 'ทักครูและรุ่นพี่ด้วยการไหว้ ยิ้มสวยแล้วจะมีมิตรเยอะ'],
  ], ['เช้าวันจันทร์', 'สีประจำโรงเรียน', 'ไหว้'], [
    ['ทั้งโรงเรียนร้องเพลงประจำโรงเรียนเมื่อใด', 'เช้าวันจันทร์', 'เย็นวันศุกร์', 'กลางคืน'],
    ['เมื่อพบครูและรุ่นพี่ควรทำอย่างไร', 'ไหว้และยิ้ม', 'เดินผ่านเฉยๆ', 'ทำหน้านิ่ง'],
    ['สีประจำโรงเรียนคือสิ่งใดสำหรับศิษย์เก่า', 'สิ่งที่จำได้ในใจ', 'ของแจก', 'ของต้องห้าม'],
  ]),
  L('study_tips', 'เรียนในโรงเรียนประจำอย่างไรให้รอด', [
    ['จัดเวลาให้เป็น', 'จดงานที่ต้องส่งแล้วทำตามลำดับ ไม่ทำค้างข้ามคืน'],
    ['ถามได้ทุกเมื่อ', 'ไม่เข้าใจให้ถามครูหรือเพื่อนทันที อย่าสะสม'],
    ['ฝึกอ่านทุกวัน', 'อ่านทบทวนวันละครึ่งชั่วโมงดีกว่าอ่านรวบยอด'],
    ['พักบ้าง', 'พักผ่อนและออกกำลังกายช่วยให้เรียนได้ดีขึ้น'],
  ], ['ลำดับ', 'อย่าสะสม', 'วันละครึ่งชั่วโมง'], [
    ['งานที่ต้องส่งควรทำอย่างไร', 'ทำตามลำดับและไม่ค้างข้ามคืน', 'ทำทีเดียวคืนสุดท้าย', 'ไม่ต้องจด'],
    ['เมื่อไม่เข้าใจควรทำอย่างไร', 'ถามทันที', 'สะสมไว้ก่อน', 'ปล่อยผ่าน'],
    ['การอ่านทบทวนที่ดีคือ', 'วันละครึ่งชั่วโมง', 'อ่านรวบยอดคืนก่อนสอบ', 'ไม่อ่านเลย'],
  ]),
  L('canteen_money', 'เงินและโรงอาหาร', [
    ['เงินใช้รายเดือน', 'รับเงินใช้จ่ายเป็นเดือน วางแผนเฉลี่ยเป็นวันก่อน'],
    ['ร้านในโรงอาหาร', 'มีหลายร้านราคาต่างกัน เลือกให้พอดีกับงบ'],
    ['ขอเงินผู้ปกครอง', 'ถ้าเงินหมดให้โทรขอผู้ปกครองตามที่ตกลงกัน'],
    ['อย่ายืมจนเป็นนิสัย', 'ยืมเพื่อนแล้วต้องรีบคืน ไม่งั้นเพื่อนจะเกรงใจ'],
  ], ['เฉลี่ยเป็นวัน', 'หลายร้าน', 'รีบคืน'], [
    ['เงินใช้รายเดือนควรวางแผนอย่างไร', 'เฉลี่ยเป็นวัน', 'ใช้วันแรกให้หมด', 'ไม่ต้องคิด'],
    ['ร้านในโรงอาหารเป็นอย่างไร', 'มีหลายร้านราคาต่างกัน', 'มีร้านเดียว', 'ฟรีทั้งหมด'],
    ['ถ้ายืมเพื่อนควรทำอย่างไร', 'รีบคืน', 'ลืมไว้ก่อน', 'ยืมเพิ่ม'],
  ]),
  L('seniors_talk', 'พี่เล่าให้ฟัง', [
    ['วันแรกที่หอ', 'พี่ ม.ปลายเล่าว่าคืนแรกคิดถึงบ้านจนนอนไม่หลับ'],
    ['เพื่อนหอคือครอบครัว', 'เพื่อนร่วมห้องช่วยกันติวและกินข้าวด้วยกันทุกคืน'],
    ['พลาดก็ไม่เป็นไร', 'หลายคนลืมของ มาสาย ทำของหาย แล้วค่อยเรียนรู้'],
    ['ขอให้สนุก', 'สามปีผ่านไปเร็วกว่าที่คิด เก็บความทรงจำไว้เยอะๆ'],
  ], ['นอนไม่หลับ', 'ครอบครัว', 'ความทรงจำ'], [
    ['พี่เล่าว่าคืนแรกที่หอรู้สึกอย่างไร', 'คิดถึงบ้านจนนอนไม่หลับ', 'หลับสบาย', 'ไม่อยากกลับห้อง'],
    ['เพื่อนร่วมห้องช่วยกันทำอะไร', 'ติวและกินข้าวด้วยกัน', 'แยกกันทำทุกอย่าง', 'แข่งกันนอน'],
    ['พี่บอกว่าเวลาสามปีเป็นอย่างไร', 'ผ่านไปเร็วกว่าที่คิด', 'ช้ามาก', 'หยุดนิ่ง'],
  ]),
  L('safety', 'ความปลอดภัยในโรงเรียน', [
    ['ทางหนีไฟ', 'ดูทางหนีไฟของตึกเรียนและหอพักไว้ตั้งแต่วันแรก'],
    ['เมื่อได้ยินสัญญาณเตือนภัย', 'ออกจากห้องอย่างสงบและไปรวมตัวที่สนาม'],
    ['เจอเรื่องไม่ปลอดภัย', 'รีบบอกครูหรือเจ้าหน้าที่ทันที'],
    ['ระวังตัวเอง', 'ไม่ไปที่เปลี่ยวคนเดียวและดูแลเพื่อนใหม่ด้วย'],
  ], ['ทางหนีไฟ', 'สนาม', 'บอกครู'], [
    ['ควรทำอะไรตั้งแต่วันแรกเกี่ยวกับความปลอดภัย', 'ดูทางหนีไฟ', 'ไม่ต้องสนใจ', 'ปิดทางหนีไฟ'],
    ['ได้ยินสัญญาณเตือนภัยให้ไปที่ไหน', 'รวมตัวที่สนาม', 'กลับเข้าห้อง', 'ขึ้นดาดฟ้า'],
    ['เมื่อเจอเรื่องไม่ปลอดภัยควรทำอย่างไร', 'บอกครูทันที', 'เงียบไว้', 'ถ่ายคลิปโพสต์'],
  ]),
];

const TRUST_TEXTS = [
  'ครูประจำชั้นเห็นคุณตั้งใจฟังจนจบ และพยักหน้าให้หลังเลิก',
  'ครูเวรบอกเพื่อนครูว่านักเรียนคนนี้นั่งเรียบร้อยดี',
  'ครูที่ปรึกษาเดินมากระซิบว่าชมที่ไม่หลับ',
  'ครูฝ่ายปกครองสังเกตเห็นคุณช่วยเพื่อนเก็บเก้าอี้หลังเลิก',
  'ครูวิชาหนึ่งเห็นคุณจดบันทึกเยอะ และขอดูสมุดด้วยรอยยิ้ม',
  'ครูหัวหน้าระดับพูดชื่อคุณในที่ประชุมครู ว่าเป็นตัวอย่างที่ดี',
  'ครูคนหนึ่งกล่าวทักทายคุณหน้าห้องประชุมพร้อมรอยยิ้ม',
  'ผู้อำนวยการมองมาที่แถวของคุณและพยักหน้าเบาๆ',
];

export function skipCaught(rng) {
  return rng.chance(SCHEDULE.hall.skip.caughtChance);
}

// skipping a lecture or special day. caught = made to go anyway (and trust drops), else the time is free.
const SKIP_CAUGHT_TEXTS = [
  'ครูเวรเดินตรวจหลังห้อง เจอคุณที่ใต้ต้นไม้ ถูกพากลับเข้าห้องประชุม',
  'คุณแอบกลับหอได้ไม่ถึงสิบนาที ครูก็โทรตาม ต้องวิ่งกลับไปนั่งแถวหลัง',
  'เพื่อนบอกครูโดยไม่ตั้งใจ ว่าคุณไม่อยู่ ครูจึงมาเรียกตัวไป',
];
const SKIP_FREE_TEXTS = [
  'คุณหลบไปนั่งพักที่หอ ได้งีบสบายๆ ไม่มีใครมาเจอ',
  'คุณแวะโรงอาหาร นั่งกินขนมแล้วกลับเข้าแถวหลังเลิกประชุม ไม่มีใครรู้',
  'คุณนั่งอ่านหนังสือเงียบๆ ที่ใต้ตึกจนครบเวลา',
];

export function skipOutcome(rng, ctx = {}) {
  const caught = skipCaught(rng);
  if (caught) {
    return {
      caught: true,
      fx: cleanFx({ teacherTrust: -SCHEDULE.hall.skip.trustDropOnCaught, stress: 3, diligence: -1 }),
      log: rng.pick(SKIP_CAUGHT_TEXTS),
    };
  }
  return { caught: false, fx: cleanFx({ energy: 3, stress: -2 }), log: rng.pick(SKIP_FREE_TEXTS) };
}

export function hallResult(kind, score, ctx = {}, rng = new Rng(1)) {
  const s = clamp01(score);
  const tier = scoreTier(s);
  const topic = ctx.topic ? `เรื่อง "${ctx.topic}"` : '';
  let fx = {};
  let log = '';
  if (kind === 'lecture') {
    const [lo, hi] = SCHEDULE.hall.lectureDiligenceDrop;
    fx = { diligence: -lerp(hi, lo, s), energy: -2, stress: -0.5, knowledge: 0.5 + s * 2, peer: 0 };
    log = { great: `ฟังบรรยาย${topic}จนจบ ตื่นตลอด และจำได้เกือบทุกอย่าง`, good: `ฟังบรรยาย${topic} ง่วงนิดหน่อยแต่ยังจับใจความได้`, ok: `บรรยาย${topic}ยาวเกินไป หลับๆ ตื่นๆ จำได้บางส่วน`, bad: `หลับไปในห้องประชุม เพื่อนต้องสะกิดตอนใกล้จบ` }[tier.id];
  } else if (kind === 'special') {
    fx = { diligence: -0.5 * (1 - s), energy: -1, knowledge: 0.3 + s * 1.5, peer: 0.5, stress: -1 };
    log = { great: `เข้าร่วมกิจกรรมพิเศษ${topic} ตั้งใจฟังและสนุกกับกิจกรรม`, good: `เข้าร่วมกิจกรรมพิเศษ${topic} ได้ความรู้ติดตัวกลับมา`, ok: `กิจกรรมพิเศษ${topic} ผ่านไปแบบเรื่อยๆ`, bad: `กิจกรรมพิเศษ${topic} คุณเผลอหลับไปครึ่งหนึ่ง` }[tier.id];
  } else if (kind === 'award') {
    const stage = !!ctx.onStage;
    fx = stage
      ? { teacherTrust: 3 + s, peer: 3, diligence: 2, stress: -3, energy: -1, knowledge: s * 0.5 }
      : { teacherTrust: 0.3, peer: 0.5, diligence: 0.5 + s * 0.5, stress: -1, energy: -1 };
    log = stage ? 'ขึ้นรับรางวัลเกรดสี่บนเวที เสียงปรบมือดังก้องหอประชุม' : 'นั่งชมพิธีมอบรางวัลเกรดสี่ และตั้งใจว่าเทอมหน้าจะลองให้ถึง';
  } else if (kind === 'farewell') {
    const c = clamp01(ctx.closeness == null ? 0.4 : ctx.closeness);
    fx = { stress: 1 + c * 4, peer: 1, teacherTrust: 0.5 + s * 1, energy: -1, diligence: 0.2 };
    log = c > 0.6 ? 'ครูที่สนิทกับคุณกล่าวลา คุณกลั้นน้ำตาไว้ไม่อยู่ และกอดเพื่อนข้างๆ' : 'พิธีอำลาครูผ่านไปอย่างอบอุ่น แม้จะไม่สนิทกับครูมากแต่ก็ใจหาย';
  } else {
    fx = { peer: 1.5 + s * 1.5, stress: -3 - s, teacherTrust: 0.5, energy: -2, knowledge: 0.3 + s };
    log = { great: 'ฟังพิธีต้อนรับน้องใหม่ครบ ได้ความรู้และเพื่อนใหม่เพียบ', good: 'ฟังพิธีต้อนรับ ได้ทำความรู้จักเพื่อนข้างๆ', ok: 'ฟังต้อนรับไปบ้าง หลับไปบ้าง', bad: 'เหนื่อยจากการเดินทางจนหลับในห้องประชุม แต่รุ่นพี่ไม่ถือสา' }[tier.id];
  }
  return { fx: cleanFx(fx), log, tier };
}

export const HALL = {
  award: {
    variants: AWARD_VARIANTS,
    // ctx: { onStage?, term?, grade?, awardees? }
    spec(rng, ctx = {}) {
      const v = rng.pick(AWARD_VARIANTS);
      const term = ctx.term === 2 ? 'ภาคเรียนที่ 2' : 'ภาคเรียนที่ 1';
      const n = Number.isFinite(ctx.awardees) ? ctx.awardees : null;
      const first = {
        title: 'พิธีมอบรางวัลผลการเรียนเยี่ยม',
        line: n ? `${term} มีนักเรียนผลการเรียนเฉลี่ย 4.00 จำนวน ${n} คน ขึ้นรับรางวัลบนเวที` : `${term} นักเรียนที่ได้ผลการเรียนเฉลี่ย 4.00 ทุกคนขึ้นรับรางวัลบนเวที`,
      };
      return buildWatch(rng, v, [first]);
    },
    result: (score, ctx, rng) => hallResult('award', score, ctx, rng),
  },
  lecture: {
    topics: LECTURE_TOPICS,
    // ctx: { topicId?, recent?: [topicIds] } -> a topic not seen recently
    spec(rng, ctx = {}) {
      let t = ctx.topicId ? LECTURE_TOPICS.find((x) => x.id === ctx.topicId) : null;
      if (!t) {
        const recent = new Set(ctx.recent || []);
        const pool = LECTURE_TOPICS.filter((x) => !recent.has(x.id));
        t = rng.pick(pool.length ? pool : LECTURE_TOPICS);
      }
      return { ...buildWatch(rng, t), topicId: t.id };
    },
  },
  special: SPECIAL_DAYS.map((d) => ({
    ...d,
    spec(rng) {
      return buildWatch(rng, d);
    },
  })),
  specialSpec(rng, ctx = {}) {
    let d = ctx.id ? SPECIAL_DAYS.find((x) => x.id === ctx.id) : null;
    if (!d) {
      const recent = new Set(ctx.recent || []);
      const pool = SPECIAL_DAYS.filter((x) => !recent.has(x.id) && (ctx.month == null || x.month === ctx.month));
      const pool2 = pool.length ? pool : SPECIAL_DAYS.filter((x) => !recent.has(x.id));
      d = rng.pick(pool2.length ? pool2 : SPECIAL_DAYS);
    }
    return { ...buildWatch(rng, d), topicId: d.id };
  },
  farewell: {
    reasons: SCHEDULE.hall.farewell.reasons.slice(),
    speeches: FAREWELL_SPEECHES,
    newTeacherLines: NEW_TEACHER_LINES,
    // ctx: { teacherName, reason? }
    text(rng, ctx = {}) {
      const reason = ctx.reason && FAREWELL_REASON_TEXT[ctx.reason] ? ctx.reason : rng.pick(SCHEDULE.hall.farewell.reasons);
      const sp = rng.pick(FAREWELL_SPEECHES);
      const name = ctx.teacherName || 'ครู';
      return {
        reason,
        title: `พิธีอำลา ${name}`,
        speechId: sp.id,
        speech: `${sp.open} ${sp.memory} ${sp.advice} ${sp.wish}`,
        newTeacher: rng.pick(NEW_TEACHER_LINES),
      };
    },
    spec(rng, ctx = {}) {
      const name = ctx.teacherName || 'ครู';
      const reason = ctx.reason && FAREWELL_REASON_TEXT[ctx.reason] ? ctx.reason : rng.pick(SCHEDULE.hall.farewell.reasons);
      const sp = rng.pick(FAREWELL_SPEECHES);
      const slides = [
        { title: `อำลา ${name}`, line: FAREWELL_REASON_TEXT[reason] },
        { title: 'คำกล่าวของครู', line: sp.open },
        { title: 'ความทรงจำ', line: sp.memory },
        { title: 'สิ่งที่ฝากไว้', line: sp.advice },
        { title: 'ขอให้', line: sp.wish },
      ];
      const otherReasons = SCHEDULE.hall.farewell.reasons.filter((r) => r !== reason);
      const otherAdvice = shuffled(rng, FAREWELL_SPEECHES.filter((x) => x.id !== sp.id)).slice(0, 2).map((x) => x.advice);
      const otherMem = shuffled(rng, FAREWELL_SPEECHES.filter((x) => x.id !== sp.id)).slice(0, 2).map((x) => x.memory);
      const reasonWrong = ['ย้ายไปสอนที่อื่น', 'ลาป่วยระยะยาว'];
      const qs = [
        ['ครูกล่าวถึงเหตุผลที่ต้องลาจากอย่างไร', reason === 'ลาออก' ? 'ลาออกไปเริ่มชีวิตใหม่' : 'ครบเกษียณอายุ 60 ปี', reason === 'ลาออก' ? 'ครบเกษียณอายุ 60 ปี' : 'ลาออกไปเริ่มชีวิตใหม่', reasonWrong[0]],
        ['ครูฝากอะไรไว้กับนักเรียน', sp.advice, otherAdvice[0], otherAdvice[1]],
        ['ความทรงจำที่ครูเล่าคือเรื่องใด', sp.memory, otherMem[0], otherMem[1]],
      ];
      void otherReasons;
      const questions = qs.map(([q, c, w1, w2]) => {
        const choices = shuffled(rng, [c, w1, w2]);
        return { q, choices, answer: choices.indexOf(c) };
      });
      return { slides, keywords: [sp.keyword], questions, topic: `อำลา ${name}` };
    },
  },
  fresher: {
    sessions: FRESHER_SESSIONS,
    // ctx: { sessionId?, recent? }
    spec(rng, ctx = {}) {
      let t = ctx.sessionId ? FRESHER_SESSIONS.find((x) => x.id === ctx.sessionId) : null;
      if (!t) {
        const recent = new Set(ctx.recent || []);
        const pool = FRESHER_SESSIONS.filter((x) => !recent.has(x.id));
        t = rng.pick(pool.length ? pool : FRESHER_SESSIONS);
      }
      return { ...buildWatch(rng, t), topicId: t.id };
    },
  },
  trustGain: {
    chance: SCHEDULE.hall.trustGainAfterSession,
    texts: TRUST_TEXTS,
    // -> null or { text, fx:{ teacherTrust } }
    roll(rng, ctx = {}) {
      const p = ctx.chance == null ? SCHEDULE.hall.trustGainAfterSession : ctx.chance;
      if (!rng.chance(p)) return null;
      return { text: rng.pick(TRUST_TEXTS), fx: { teacherTrust: r1(lerp(1.5, 4, rng.float())) } };
    },
  },
  skipCaught,
  skipOutcome,
  result: hallResult,
};

// ---- science labs --------------------------------------------------------------------------------------------------
// Each lab: steps [prompt, correct, wrong1, wrong2]; `hold` (optional) = [label, minTarget, maxTarget] for one step
// (a timed pour/heat hold). spec(rng) shuffles the choices and rolls the hold zone.

const LB = (id, subject, title, hazard, steps, holdAt = null) => ({ id, subject, title, hazard, steps, holdAt });

const LAB_DATA = [
  LB('baking_soda', 'chemistry', 'เบกกิ้งโซดากับน้ำส้มสายชู', 'สวมแว่นตา และอย่าปิดฝาขวดให้แน่นเพราะแก๊สจะดันฝา', [
    ['เริ่มต้นการทดลองควรทำอะไรก่อน', 'ใส่แว่นตาและอ่านวิธีทำ', 'เทสารทั้งหมดรวมกัน', 'ชิมสารดู'],
    ['ใส่เบกกิ้งโซดาลงในขวดเปล่า แล้วทำขั้นต่อไป', 'ค่อยๆ เทน้ำส้มสายชูลงไป', 'ปิดฝาก่อนแล้วเขย่า', 'เติมน้ำร้อนจัด'],
    ['ฟองที่เกิดขึ้นคือแก๊สอะไร', 'คาร์บอนไดออกไซด์', 'ออกซิเจน', 'ไฮโดรเจน'],
    ['ถ้าต้องการให้ปฏิกิริยาเกิดช้าลง ควรทำอย่างไร', 'ใช้น้ำส้มสายชูเย็นหรือเจือจาง', 'เพิ่มอุณหภูมิ', 'ขยี้เบกกิ้งโซดาให้ละเอียดมาก'],
  ], [2, 'ค่อยๆ เทน้ำส้มสายชู', 0.35, 0.7]),
  LB('titration', 'chemistry', 'ไทเทรตกรดกับเบส', 'สวมแว่นตา ถุงมือ และระวังกรดกระเด็น', [
    ['ใส่สารละลายใดไว้ในบิวเรต', 'สารละลายมาตรฐานที่รู้ความเข้มข้น', 'น้ำเปล่า', 'สารละลายที่ไม่รู้ว่าคืออะไร'],
    ['หยดอินดิเคเตอร์ฟีนอล์ฟทาลีนลงในกรด สีจะเป็นอย่างไร', 'ไม่มีสี', 'ชมพู', 'น้ำเงิน'],
    ['ปล่อยเบสลงไป ต้องปล่อยอย่างไรใกล้จุดสิ้นสุด', 'หยดทีละหยดช้าๆ', 'เปิดสุดให้เร็วที่สุด', 'ปิดแล้วรอเฉยๆ'],
    ['จุดยุติเห็นได้เมื่อสีเปลี่ยนเป็น', 'ชมพูอ่อนคงอยู่', 'ไม่มีสีเหมือนเดิม', 'เหลืองจัด'],
  ], [2, 'หยดเบกลงทีละน้อย', 0.5, 0.8]),
  LB('iodine_starch', 'biology', 'ทดสอบแป้งด้วยสารละลายไอโอดีน', 'ไอโอดีนทำให้เสื้อเปื้อน ใส่เสื้อกาวน์และอย่ากิน', [
    ['เตรียมอาหาร 3 ชนิดไว้ทดสอบ ควรทำอย่างไร', 'วางแยกคนละจานและเขียนป้ายชื่อ', 'ผสมรวมกันก่อน', 'วางบนมือ'],
    ['หยดไอโอดีนลงบนข้าวสวย สีจะเป็นอย่างไร', 'น้ำเงินเข้มเกือบดำ', 'ใสไม่เปลี่ยน', 'แดง'],
    ['หยดลงบนน้ำตาลทราย สีจะเป็นอย่างไร', 'ไม่เปลี่ยนสี เพราะไม่มีแป้ง', 'น้ำเงินเข้ม', 'เขียว'],
    ['สรุปผลได้ว่า', 'ไอโอดีนใช้ตรวจแป้ง', 'ไอโอดีนใช้ตรวจน้ำตาล', 'ไอโอดีนใช้ตรวจน้ำมัน'],
  ]),
  LB('onion_cell', 'biology', 'ส่องเซลล์หัวหอมด้วยกล้องจุลทรรศน์', 'ระวังสไลด์แตก และอย่าใช้กระจกส่องแสงอาทิตย์ตรงๆ', [
    ['เริ่มส่องด้วยเลนส์ใกล้วัตถุกำลังใด', 'กำลังต่ำสุดก่อน', 'กำลังสูงสุดก่อน', 'ไม่ต้องใช้เลนส์'],
    ['ปรับภาพให้ชัดด้วยอะไร', 'ปุ่มปรับภาพหยาบแล้วปรับภาพละเอียด', 'เลื่อนสไลด์ด้วยนิ้ว', 'เป่าลมใส่เลนส์'],
    ['ลอกเยื่อหัวหอมบางๆ วางบนสไลด์แล้วทำอะไรต่อ', 'หยดสีย้อมและปิดกระจก', 'ทับด้วยหนังสือ', 'ใส่ทั้งหัวเลย'],
    ['เมื่อเห็นเซลล์ จะเห็นสิ่งใดชัดที่สุด', 'ผนังเซลล์และนิวเคลียส', 'ใบไม้', 'ราก'],
  ]),
  LB('circuit', 'physics', 'ต่อวงจรไฟฟ้าอย่างง่าย', 'ไม่ลัดวงจรแบตเตอรี่ และอย่าจับสายที่ร้อนจัด', [
    ['ส่วนประกอบพื้นฐานของวงจรไฟฟ้าอย่างง่ายคืออะไร', 'แบตเตอรี่ สายไฟ หลอดไฟ สวิตช์', 'ไม้ขีดไฟ', 'น้ำเกลือ'],
    ['ต่อหลอดไฟกับสวิตช์อย่างไรให้ถูกต้อง', 'ต่ออนุกรมในวงจรปิด', 'ต่อสายสองปลายเข้าขั้วเดียวกัน', 'ไม่ต่อสายเลย'],
    ['ถ้าไฟไม่ติด สิ่งแรกที่ควรตรวจคือ', 'วงจรปิดหรือไม่', 'สีของหลอด', 'สีของสายไฟ'],
    ['แอมมิเตอร์ต้องต่อแบบใด', 'อนุกรมกับวงจร', 'ขนานกับหลอด', 'วางไว้เฉยๆ'],
  ]),
  LB('density', 'physics', 'ความหนาแน่นของของเหลว', 'ระวังน้ำมันหก พื้นลื่น', [
    ['ของเหลวที่มีความหนาแน่นมากกว่าจะอยู่ตำแหน่งใด', 'ชั้นล่าง', 'ชั้นบน', 'ผสมกันตลอด'],
    ['เทน้ำมันพืชลงในน้ำ น้ำมันจะ', 'ลอยอยู่ด้านบน', 'จมลงล่าง', 'ละลายกลมกลืน'],
    ['ใส่น้ำเชื่อมข้นลงไปก่อนเป็นชั้นล่าง เพราะเหตุใด', 'หนาแน่นกว่าน้ำ', 'เบากว่าน้ำ', 'สีสวย'],
    ['วิธีเทของเหลวให้ซ้อนชั้นสวยคือ', 'เทช้าๆ ตามข้างแก้วหรือช้อน', 'เทแรงๆ จากที่สูง', 'คนให้เข้ากัน'],
  ], [3, 'เทช้าๆ ตามข้างแก้ว', 0.3, 0.65]),
  LB('egg_salt', 'physics', 'ไข่ลอยในน้ำเกลือ', 'ระวังไข่ตก', [
    ['ใส่ไข่ลงในน้ำเปล่า ไข่จะ', 'จมลงก้นแก้ว', 'ลอยทันที', 'ล่องลอยตรงกลาง'],
    ['เติมเกลือลงในน้ำแล้วคน ความหนาแน่นของน้ำจะ', 'เพิ่มขึ้น', 'ลดลง', 'เท่าเดิมเสมอ'],
    ['เมื่อความหนาแน่นของน้ำมากกว่าไข่ ไข่จะ', 'ลอยขึ้น', 'จมลง', 'แตก'],
    ['ทำไมทะเลสาบน้ำเค็มจัดจึงทำให้คนลอยง่าย', 'น้ำเค็มหนาแน่นกว่าน้ำจืด', 'เพราะน้ำร้อน', 'เพราะมีปลาเยอะ'],
  ], [1, 'ใส่ไข่ลงช้าๆ', 0.3, 0.65]),
  LB('filter_salt', 'chemistry', 'กรองและตกผลึกเกลือ', 'ระวังความร้อนจากเตา และอย่าใช้มือจับถ้วยระเหย', [
    ['พับกระดาษกรองแล้วทำอย่างไรต่อ', 'วางในกรวยแล้วทำให้เปียกเล็กน้อย', 'ใช้มือบีบสารผ่านเลย', 'ทิ้งไว้ในแสงแดด'],
    ['เทน้ำเกลือขุ่นลงกรวย ของแข็งที่ค้างบนกระดาษเรียกว่า', 'กาก', 'ตัวทำละลาย', 'สารละลาย'],
    ['เพื่อเอาเกลือกลับมา ต้องทำอย่างไร', 'ระเหยน้ำออกด้วยความร้อน', 'เทลงดิน', 'แช่ตู้เย็นอย่างเดียว'],
    ['เมื่อน้ำเกือบแห้ง ควรทำอย่างไร', 'ลดไฟแล้วปล่อยให้ระเหยจนแห้ง', 'เร่งไฟแรงสุด', 'เติมน้ำเข้าไปอีก'],
  ], [2, 'ทำความร้อนอย่างสม่ำเสมอ', 0.4, 0.75]),
  LB('leaf_starch', 'biology', 'ทดสอบแป้งในใบไม้', 'ห้ามต้มแอลกอฮอล์ด้วยไฟตรงๆ เพราะลุกติดไฟ ใช้ถ้วยน้ำร้อนเท่านั้น', [
    ['เก็บใบไม้ที่ถูกแสงแดดมาทั้งวัน แล้วขั้นแรกคือ', 'ลวกในน้ำร้อนให้เซลล์อ่อนตัว', 'หยดไอโอดีนเลย', 'ตากแห้ง'],
    ['ต้มใบไม้ในแอลกอฮอล์เพื่อทำอะไร', 'ขจัดสีเขียวออกจากใบ', 'ทำให้ใบหวาน', 'ทำให้ใบแข็ง'],
    ['ต้องต้มแอลกอฮอล์อย่างไรจึงปลอดภัย', 'ใช้การต้มแบบแช่ในน้ำร้อน', 'จุดไฟตรงๆ ใต้บีกเกอร์', 'ใช้ไฟแช็กเผา'],
    ['หยดไอโอดีนแล้วใบเปลี่ยนเป็นสีน้ำเงินดำ แสดงว่า', 'ใบมีแป้ง', 'ใบไม่มีอะไร', 'ใบมีน้ำมัน'],
  ], [2, 'ต้มแบบแช่น้ำร้อน', 0.35, 0.7]),
  LB('pendulum', 'physics', 'ลูกตุ้มนาฬิกา', 'ระวังตุ้มแกว่งโดนหน้า', [
    ['ผูกตุ้มกับเชือกแล้วปล่อยให้แกว่ง ควรปล่อยด้วยมุม', 'ไม่เกินประมาณ 15 องศา', 'มากกว่า 90 องศา', 'ออกแรงขว้างลง'],
    ['จับเวลา 10 รอบแล้วหารด้วย 10 เพราะ', 'ลดความคลาดเคลื่อนของการจับเวลา', 'ได้เวลาน้อยลง', 'ไม่มีเหตุผล'],
    ['คาบการแกว่งขึ้นกับสิ่งใดเป็นหลัก', 'ความยาวเชือก', 'มวลของตุ้ม', 'สีของตุ้ม'],
    ['ถ้าเพิ่มความยาวเชือก คาบการแกว่งจะ', 'มากขึ้น', 'น้อยลง', 'เท่าเดิม'],
  ]),
  LB('cabbage', 'chemistry', 'ตัวบ่งชี้กรดเบสจากกะหล่ำม่วง', 'อย่าใช้สารเคมีที่ไม่รู้จัก ใช้ของในครัวเท่านั้น', [
    ['สกัดสีจากกะหล่ำม่วงอย่างไร', 'ต้มหรือแช่น้ำร้อนแล้วกรอง', 'เผาให้เป็นเถ้า', 'ตากแห้งแล้วกิน'],
    ['หยดน้ำมะนาวลงในน้ำกะหล่ำม่วง สีจะเป็นอย่างไร', 'แดงหรือชมพู', 'เขียว', 'ไม่เปลี่ยน'],
    ['หยดน้ำสบู่ที่เป็นเบสลงไป สีจะ', 'เขียวหรือฟ้า', 'แดงเข้ม', 'ใส'],
    ['สรุปว่ากะหล่ำม่วงทำหน้าที่อะไร', 'ตัวบ่งชี้กรดเบส', 'ตัวเร่งปฏิกิริยา', 'ตัวทำละลาย'],
  ]),
  LB('osmosis', 'biology', 'ออสโมซิสของมันฝรั่ง', 'ใช้มีดตัดอย่างระมัดระวัง', [
    ['ตัดมันฝรั่งเป็นแท่งขนาดเท่ากัน เพื่อให้', 'เปรียบเทียบผลได้อย่างยุติธรรม', 'สวยงาม', 'หนักเท่ากัน'],
    ['แช่แท่งหนึ่งในน้ำเกลือเข้มข้น อีกแท่งในน้ำเปล่า แล้วต้องวัดอะไร', 'ความยาวและน้ำหนักก่อนและหลัง', 'สีของน้ำ', 'ชื่อของมันฝรั่ง'],
    ['แท่งในน้ำเกลือเข้มข้นจะเป็นอย่างไร', 'หดและเหี่ยว เพราะเสียน้ำ', 'ใหญ่ขึ้น', 'ไม่เปลี่ยน'],
    ['แท่งในน้ำเปล่าจะเป็นอย่างไร', 'แข็งและใหญ่ขึ้นเล็กน้อย', 'เหี่ยว', 'ละลาย'],
  ]),
  LB('lever', 'physics', 'คานและโมเมนต์', 'อย่าวางน้ำหนักมากเกินที่คานรับได้', [
    ['โมเมนต์ของแรงคำนวณจาก', 'แรง คูณ ระยะห่างจากจุดหมุน', 'แรง บวก ระยะ', 'แรง หาร ระยะ'],
    ['คานสมดุลเมื่อ', 'โมเมนต์ทวนเข็มเท่ากับตามเข็ม', 'น้ำหนักสองข้างต่างกัน', 'วางไว้นิ่งๆ'],
    ['วางน้ำหนัก 2 หน่วยห่างจุดหมุน 3 หน่วย อีกด้านวาง 3 หน่วย ต้องห่างเท่าไรจึงสมดุล', '2 หน่วย', '3 หน่วย', '6 หน่วย'],
    ['ถ้าอยากยกของหนักด้วยแรงน้อย ควรทำอย่างไร', 'ผลักปลายคานที่ไกลจุดหมุน', 'ผลักใกล้จุดหมุน', 'ผลักตรงจุดหมุน'],
  ]),
  LB('boiling', 'physics', 'จุดเดือดของน้ำ', 'ระวังน้ำร้อนลวกและไอน้ำ', [
    ['วางเทอร์มอมิเตอร์ในบีกเกอร์อย่างไร', 'จุ่มในน้ำ ไม่แตะก้นหรือข้างบีกเกอร์', 'วางพิงก้นบีกเกอร์', 'ถือไว้เหนือน้ำ'],
    ['ให้ความร้อนช้าๆ ควรจดอุณหภูมิทุกกี่นาที', 'ทุกหนึ่งนาที', 'จดครั้งเดียว', 'ไม่ต้องจด'],
    ['เมื่อน้ำเดือดเต็มที่ อุณหภูมิจะ', 'คงที่ประมาณ 100 องศาเซลเซียส', 'เพิ่มขึ้นเรื่อยๆ', 'ลดลง'],
    ['พลังงานความร้อนที่ให้ต่อไปใช้ทำอะไร', 'เปลี่ยนน้ำเป็นไอ', 'ทำให้น้ำเย็น', 'ถูกทำลายไป'],
  ], [1, 'ให้ความร้อนสม่ำเสมอ', 0.4, 0.75]),
  LB('solubility', 'chemistry', 'อุณหภูมิกับการละลายของน้ำตาล', 'ระวังน้ำร้อน', [
    ['ตัวแปรที่เราตั้งใจเปลี่ยนในการทดลองนี้คือ', 'อุณหภูมิของน้ำ', 'ชนิดน้ำตาล', 'ขนาดแก้ว'],
    ['ตัวแปรที่ต้องควบคุมให้เหมือนกันคือ', 'ปริมาณน้ำและน้ำตาล', 'สีของแก้ว', 'ผู้ทดลอง'],
    ['น้ำร้อนมักละลายน้ำตาลได้', 'เร็วและมากกว่าน้ำเย็น', 'ช้ากว่า', 'เท่ากัน'],
    ['ถ้าอยากให้น้ำตาลละลายเร็วขึ้นอีก ควรทำอย่างไร', 'คนและบดให้ละเอียด', 'เติมน้ำแข็ง', 'ปิดฝาไว้เฉยๆ'],
  ]),
  LB('reflection', 'physics', 'การสะท้อนแสงของกระจกเงาราบ', 'ระวังกระจกแตกและอย่ามองแสงเลเซอร์ตรงๆ', [
    ['มุมตกกระทบวัดจากอะไร', 'เส้นแนวฉากกับผิวกระจก', 'ขอบโต๊ะ', 'พื้นห้อง'],
    ['กฎการสะท้อนแสงบอกว่า', 'มุมตกกระทบเท่ากับมุมสะท้อน', 'มุมตกกระทบมากกว่าเสมอ', 'แสงหยุดนิ่งที่กระจก'],
    ['ส่องไฟที่มุม 30 องศา แสงจะสะท้อนออกที่มุม', '30 องศา', '60 องศา', '90 องศา'],
    ['เงาในกระจกเงาราบมีลักษณะอย่างไร', 'กลับซ้ายขวาและขนาดเท่าของจริง', 'ใหญ่กว่าของจริง', 'กลับหัวลง'],
  ]),
  LB('magnet', 'physics', 'สนามแม่เหล็กด้วยผงตะไบเหล็ก', 'ระวังผงเหล็กเข้าตาและอย่าให้แม่เหล็กใกล้โทรศัพท์', [
    ['วางกระดาษบนแท่งแม่เหล็ก แล้วทำอะไรต่อ', 'โรยผงตะไบเหล็กลงบางๆ', 'เทน้ำใส่', 'ทับกระดาษด้วยหนังสือ'],
    ['เคาะกระดาษเบาๆ ผงเหล็กจะ', 'เรียงตามแนวเส้นสนามแม่เหล็ก', 'ติดกันเป็นก้อนเดียว', 'ลอยขึ้น'],
    ['ขั้วเหมือนกันของแม่เหล็กเมื่อนำมาใกล้กัน', 'ผลักกัน', 'ดูดกัน', 'ไม่มีผล'],
    ['บริเวณที่ผงเหล็กหนาแน่นที่สุดแสดงว่า', 'สนามแม่เหล็กแรงที่สุด', 'สนามอ่อนที่สุด', 'ไม่มีสนาม'],
  ]),
];

function labSpec(rng, lab) {
  const steps = lab.steps.map(([prompt, c, w1, w2], i) => {
    const choices = shuffled(rng, [c, w1, w2]);
    const o = { prompt, choices, answer: choices.indexOf(c) };
    if (lab.holdAt && lab.holdAt[0] === i) {
      const t = lerp(lab.holdAt[2], lab.holdAt[3], rng.float());
      o.hold = { label: lab.holdAt[1], target: r1(t * 100) / 100, width: r1(lerp(0.16, 0.26, rng.float()) * 100) / 100 };
    }
    return o;
  });
  return { title: lab.title, steps, hazard: lab.hazard };
}

export const LAB = LAB_DATA.map((l) => ({
  id: l.id,
  subject: l.subject,
  title: l.title,
  spec: (rng) => labSpec(rng, l),
}));

export function labById(id) {
  return LAB.find((l) => l.id === id) || null;
}

export function labResult(score, ctx = {}, rng) {
  const s = clamp01(score);
  const tier = scoreTier(s);
  const fx = cleanFx({ knowledge: 1 + s * 3.5, stress: tier.id === 'bad' ? 2 : -1, energy: -2, diligence: 0.3 + s * 0.7, peer: 0.5, teacherTrust: 0.3 + s * 1.2 });
  const t = ctx.title ? `การทดลอง ${ctx.title}` : 'การทดลองในห้องแล็บ';
  const log = { great: `${t} สำเร็จตามขั้นตอน ครูชมว่าแม่นยำ`, good: `${t} ออกมาดี มีผิดพลาดเล็กน้อย`, ok: `${t} ได้ผลบ้าง ต้องแก้บางขั้นตอน`, bad: `${t} พลาดหลายขั้น ผลออกมาไม่ตรงทฤษฎี ต้องทำรายงานเพิ่ม` }[tier.id];
  return { fx, log, tier };
}

// ---- club crafts ---------------------------------------------------------------------------------------------------

const BEAD_COLORS = ['#e4572e', '#f3a712', '#29b6a8', '#4b8bbe', '#8e5bd4', '#e87daa', '#8bc34a', '#f5f5f5'];
const patternCraft = (id, area, title, label, startLen = 3, rounds = [4, 6]) => ({
  id, area, title, game: 'pattern',
  spec: (rng) => ({ beads: shuffled(rng, BEAD_COLORS).slice(0, rint(rng, [4, 6])), rounds: rint(rng, rounds), startLen, label }),
});
const sequenceCraft = (id, area, title, label, beats) => ({
  id, area, title, game: 'sequence',
  spec: (rng) => ({ clips: shuffled(rng, beats.map((l, i) => ({ id: `c${i + 1}`, label: l, order: i }))), label }),
});
const dashCraft = (id, area, title, items, len = [5, 7], limit = [22, 28]) => ({
  id, area, title, game: 'dash',
  spec: (rng) => ({ items: shuffled(rng, items).map((name, i) => ({ id: `d${i + 1}`, name })), sequenceLen: rint(rng, len), timeLimit: rint(rng, limit) }),
});
const timingCraft = (id, area, title, label, zone = [0.2, 0.3], speed = [1.1, 1.6]) => ({
  id, area, title, game: 'timing',
  spec: (rng) => ({ tries: 3, zone: r1(lerp(zone[0], zone[1], rng.float()) * 100) / 100, speed: r1(lerp(speed[0], speed[1], rng.float()) * 10) / 10, label }),
});
const rhythmCraft = (id, area, title, label, lanes = 3, bpm = [80, 110], notes = [16, 24]) => ({
  id, area, title, game: 'rhythm',
  spec: (rng) => ({ lanes, bpm: rint(rng, bpm), notes: rint(rng, notes), label }),
});
const trackCraft = (id, area, title, mode, speed = [0.8, 1.2], band = [0.25, 0.4]) => ({
  id, area, title, game: 'track',
  spec: (rng) => ({ mode, speed: r1(lerp(speed[0], speed[1], rng.float()) * 10) / 10, band: r1(lerp(band[0], band[1], rng.float()) * 100) / 100 }),
});
const labCraft = (id, area, title, labId) => ({ id, area, title, game: 'steps', spec: (rng) => labById(labId).spec(rng) });

export const CLUB_CRAFTS = {
  art: [
    patternCraft('art-bracelet', 'art', 'ร้อยกำไลข้อมือ', 'ร้อยกำไลข้อมือ'),
    patternCraft('art-keychain', 'art', 'ร้อยพวงกุญแจลูกปัด', 'ร้อยพวงกุญแจลูกปัด', 3, [5, 7]),
    trackCraft('art-photo', 'art', 'ถ่ายภาพรอบโรงเรียน', 'camera'),
    sequenceCraft('art-mural', 'art', 'เรียงสีภาพวาดฝาผนัง', 'เรียงขั้นตอนทำภาพวาดฝาผนัง', ['ร่างภาพด้วยดินสอ', 'ลงสีพื้นหลัง', 'ลงสีตัวละครหลัก', 'เก็บรายละเอียดเส้นขอบ', 'ลงชื่อผู้วาด']),
  ],
  music: [
    rhythmCraft('music-drum', 'music', 'ฝึกตีกลอง', 'ตีกลองตามจังหวะ'),
    trackCraft('music-tune', 'music', 'ตั้งสายกีตาร์ให้เสียงตรง', 'sound'),
    sequenceCraft('music-song', 'music', 'เรียงท่อนเพลง', 'เรียงท่อนเพลงให้ถูกลำดับ', ['อินโทร', 'ท่อนแรก', 'ท่อนฮุก', 'ท่อนสอง', 'ท่อนฮุกซ้ำ', 'จบเพลง']),
  ],
  sport: [
    timingCraft('sport-penalty', 'sport', 'ซ้อมยิงลูกจุดโทษ', 'เตะให้ลูกเข้ามุมที่เล็ง'),
    dashCraft('sport-relay', 'sport', 'ซ้อมวิ่งผลัดรับไม้', ['ไม้ผลัด', 'รองเท้าวิ่ง', 'นาฬิกาจับเวลา', 'กระติกน้ำ', 'ผ้าคาดหัว', 'เสื้อทีม', 'เสียงนกหวีด']),
    rhythmCraft('sport-aerobic', 'sport', 'เต้นแอโรบิกให้ถูกจังหวะ', 'ท่าแอโรบิก', 3, [100, 130]),
  ],
  math: [
    sequenceCraft('math-proof', 'math', 'เรียงขั้นตอนการพิสูจน์', 'เรียงขั้นตอนการพิสูจน์ให้ถูกต้อง', ['ตั้งสมมติฐาน', 'แทนค่าตัวแปร', 'จัดรูปสมการ', 'ตรวจเงื่อนไข', 'สรุปผล']),
    patternCraft('math-seq', 'math', 'จำลำดับสีแทนตัวเลข', 'จำลำดับสีแทนตัวเลข', 4),
    dashCraft('math-key', 'math', 'ไขกุญแจตัวเลข', ['1', '3', '5', '8', '13', '21', '34', '55']),
  ],
  science: [
    labCraft('sci-volcano', 'science', 'ทดลองฟองฟู่เบกกิ้งโซดา', 'baking_soda'),
    labCraft('sci-cabbage', 'science', 'ตัวบ่งชี้จากกะหล่ำม่วง', 'cabbage'),
    labCraft('sci-egg', 'science', 'ไข่ลอยไข่จม', 'egg_salt'),
  ],
  language: [
    sequenceCraft('lang-sentence', 'language', 'เรียงประโยคภาษาอังกฤษ', 'เรียงคำให้เป็นประโยค', ['Yesterday', 'we', 'went', 'to', 'the', 'canteen']),
    patternCraft('lang-vocab', 'language', 'จำศัพท์ด้วยสี', 'จำคำศัพท์ที่แทนด้วยสี', 4),
    rhythmCraft('lang-chant', 'language', 'ท่องคำคล้องจองตามจังหวะ', 'ท่องคำคล้องจอง', 3, [70, 95]),
  ],
  computer: [
    sequenceCraft('comp-algo', 'computer', 'เรียงขั้นตอนอัลกอริทึม', 'เรียงขั้นตอนหาค่ามากที่สุด', ['ตั้งค่าเริ่มต้นเป็นตัวแรก', 'อ่านตัวถัดไป', 'เปรียบเทียบกับค่าที่เก็บไว้', 'ถ้ามากกว่าให้แทนที่', 'วนจนครบแล้วแสดงผล']),
    dashCraft('comp-type', 'computer', 'พิมพ์คำสั่งให้เร็ว', ['print', 'for', 'while', 'if', 'else', 'int', 'return', 'main']),
    patternCraft('comp-bits', 'computer', 'จำลำดับบิตสี', 'จำลำดับสีแทนบิต', 4, [5, 7]),
  ],
  social: [
    sequenceCraft('soc-timeline', 'social', 'เรียงเหตุการณ์ตามลำดับเวลา', 'เรียงเหตุการณ์สมมติตามเวลา', ['สร้างเมืองริมแม่น้ำ', 'ตั้งตลาดการค้า', 'สร้างวัดกลางเมือง', 'ขยายเส้นทางคมนาคม', 'เปิดโรงเรียนแห่งแรก']),
    patternCraft('soc-flags', 'social', 'จำลำดับธงและสี', 'จำลำดับสีของธง', 4),
    dashCraft('soc-map', 'social', 'ชี้ที่ตั้งบนแผนที่', ['เหนือ', 'ใต้', 'ตะวันออก', 'ตะวันตก', 'กลางประเทศ', 'ชายฝั่ง', 'ภูเขา']),
  ],
  reading: [
    sequenceCraft('read-story', 'reading', 'เรียงเรื่องเล่า', 'เรียงเรื่องให้ต่อกัน', ['เด็กชายพบแผนที่เก่า', 'ชวนเพื่อนออกเดินทาง', 'เจออุปสรรคกลางทาง', 'ช่วยกันแก้ปัญหา', 'ได้ขุมทรัพย์เป็นมิตรภาพ']),
    patternCraft('read-char', 'reading', 'จำชื่อตัวละครด้วยสี', 'จำลำดับตัวละครในเรื่อง', 4),
    sequenceCraft('read-chapter', 'reading', 'เรียงบทในหนังสือ', 'เรียงบทของหนังสือ', ['คำนำ', 'สารบัญ', 'บทที่หนึ่ง', 'บทที่สอง', 'บทสรุป', 'บรรณานุกรม']),
  ],
  service: [
    dashCraft('serv-firstaid', 'service', 'จัดกระเป๋าปฐมพยาบาล', ['ผ้าก๊อซ', 'สำลี', 'แอลกอฮอล์', 'พลาสเตอร์', 'เทอร์โมมิเตอร์', 'ผ้าพันแผล']),
    sequenceCraft('serv-pack', 'service', 'จัดถุงยังชีพ', 'จัดของใส่ถุงให้ถูกลำดับ', ['วางข้าวสารที่ก้นถุง', 'วางอาหารกระป๋อง', 'วางน้ำดื่ม', 'วางยาสามัญ', 'ผูกปากถุง']),
    dashCraft('serv-trash', 'service', 'แยกขยะให้เร็ว', ['ขวดแก้ว', 'กระป๋อง', 'เปลือกส้ม', 'ถ่านไฟฉาย', 'กระดาษ', 'ถุงพลาสติก']),
  ],
  military: [
    rhythmCraft('mil-march', 'military', 'ซ้อมเดินแถวให้พร้อมเพรียง', 'เดินแถวตามจังหวะ', 3, [90, 115]),
    dashCraft('mil-dress', 'military', 'แต่งเครื่องแบบให้เร็ว', ['หมวก', 'เสื้อ', 'กางเกง', 'เข็มขัด', 'ถุงเท้า', 'รองเท้า']),
    sequenceCraft('mil-knot', 'military', 'ผูกเงื่อนเชือก', 'เรียงขั้นตอนผูกเงื่อน', ['ทำบ่วงที่ปลายเชือก', 'ลอดปลายเชือกผ่านบ่วง', 'อ้อมไปหลังเชือกหลัก', 'ลอดกลับเข้าบ่วงเดิม', 'ดึงให้แน่น']),
  ],
};

// pick a craft for a club ({ id, area }); with an rng a random one of that area, else the first
export function craftForClub(club, rng) {
  const list = CLUB_CRAFTS[(club && club.area) || 'art'] || CLUB_CRAFTS.art;
  return rng ? rng.pick(list) : list[0];
}

export function clubCraftResult(score, area, rng) {
  const s = clamp01(score);
  const tier = scoreTier(s);
  const a = typeof area === 'string' ? area : 'art';
  const stressRelief = ['art', 'music', 'sport', 'reading'].includes(a) ? -2 : -0.5;
  const fx = cleanFx({ peer: 1 + s * 2, stress: stressRelief - s, knowledge: 0.3 + s * 1.2, energy: -1.5, diligence: 0.2 + s * 0.4, teacherTrust: 0.3 + s * 0.7 });
  const log = { great: 'งานชุมนุมออกมาสวยกว่าที่คิด รุ่นพี่ขอถ่ายรูปเก็บไว้', good: 'งานชุมนุมเสร็จเรียบร้อย เพื่อนในชุมนุมช่วยกันชมกันใหญ่', ok: 'งานชุมนุมเสร็จพอใช้ มีผิดพลาดนิดหน่อย แต่สนุกดี', bad: 'งานชุมนุมพังไปครึ่งหนึ่ง แต่ทั้งชุมนุมหัวเราะกันจนท้องแข็ง' }[tier.id];
  return { fx, log, tier };
}

// ---- the night show ------------------------------------------------------------------------------------------------
// One show per grade (cj). Each theme has a title, 5 items (the program, in order) and 6 story beats (for editing).

const SHOW_THEMES = {
  1: { title: 'ราตรีแห่งความหวัง', items: ['ละครสั้น "คืนแรกที่หอ"', 'เต้นหมู่ประกอบเพลงโรงเรียน', 'ร้องเพลงประสานเสียง', 'มายากลของน้องเล็ก', 'ฉากส่งกำลังใจให้พี่ ม.ปลาย'],
    story: ['เด็กใหม่ลากกระเป๋าเข้าหอ', 'คืนแรกที่นอนไม่หลับ', 'เจอเพื่อนร่วมห้องคนแรก', 'วันที่หลงทางไปห้องเรียน', 'ช่วยกันซ่อมเรื่องที่ลืมการบ้าน', 'ทุกคนร้องเพลงโรงเรียนด้วยกัน'] },
  2: { title: 'ราตรีไฟเทียน', items: ['เต้นแสงเทียน', 'บทกวีส่งใจ', 'ร้องเพลงโฟล์กสองคน', 'ละครตลกชีวิตเด็กหอ', 'ฉากจุดเทียนส่งต่อกัน'],
    story: ['แสงเทียนวูบวาบกลางห้องประชุม', 'ผู้เล่าอ่านจดหมายจากพี่ ม.ปลาย', 'เด็กหอนั่งล้อมวงเล่าเรื่องผี', 'ไฟดับกะทันหัน', 'ทุกคนส่งแสงเทียนต่อกัน', 'ไฟสว่างพร้อมเสียงปรบมือ'] },
  3: { title: 'ราตรีส่งพี่ ม.ต้น', items: ['เต้นรวมรุ่นย้อนวัย', 'สไลด์ภาพความทรงจำสามปี', 'ร้องเพลงลาโรงเรียนเดิม', 'ละครสั้นสามปีที่ผ่านมา', 'พิธีมอบดอกไม้ให้ครู'],
    story: ['วันแรกที่เป็นน้องใหม่', 'การสอบกลางภาคครั้งแรก', 'งานลอยกระทงปีหนึ่ง', 'วันที่ทีมห้องชนะแข่งตอบปัญหา', 'ผลสอบด่านสู่ม.ปลาย', 'ก้าวขึ้นเวทีรับดอกไม้ร่วมกัน'] },
  4: { title: 'ราตรีดาวใหม่', items: ['เต้นสไตล์ใหม่ของ ม.ปลาย', 'ร้องเพลงวงเต็มวง', 'ละครสั้นคนต่างโรงเรียนมาเจอกัน', 'สแตนด์อัปตลกหนึ่งนาที', 'ภาพรวมรุ่นใหม่ปิดท้าย'],
    story: ['เด็กจากหลายโรงเรียนมาเจอกัน', 'เรียนห้องใหม่กับเพื่อนแปลกหน้า', 'พี่ ม.ปลายสอนเรื่องการใช้ชีวิต', 'ครั้งแรกที่ได้ทำงานกลุ่มใหญ่', 'ทีมห้องเริ่มสนิทกัน', 'ทุกคนชูไฟโทรศัพท์เป็นดาว'] },
  5: { title: 'ราตรีก่อนวันสุดท้าย', items: ['เต้นคู่แบบเรียบง่าย', 'ละครเวทีเรื่องสั้นความฝัน', 'เพลงอะคูสติก', 'มินิคอนเสิร์ตวงโรงเรียน', 'วิดีโอเสียงจากน้อง ม.ต้น'],
    story: ['เห็นพี่ ม.6 อ่านหนังสือสอบ', 'คืนที่ทีมช่วยกันทำโปรเจกต์ใหญ่', 'ทะเลาะกันเล็กน้อยแล้วคืนดี', 'ความฝันที่เพิ่งกล้าพูดออกมา', 'เสียงเชียร์จากเพื่อนต่างห้อง', 'ถึงเวลาส่งไม้ต่อให้รุ่นต่อไป'] },
  6: { title: 'ราตรีลาจากของพวกเรา', items: ['เต้นรวมรุ่นเป็นครั้งสุดท้าย', 'วิดีโอสามปีของรุ่น', 'เพลงส่งใจร้องพร้อมกันทั้งห้องประชุม', 'ละครเวทีเรื่อง "ห้องสุดท้าย"', 'พิธีมอบเสื้อรุ่นและน้ำตา'],
    story: ['คืนก่อนสอบวันสุดท้าย', 'เปิดกล่องของรำลึกที่ฝังไว้ตอน ม.4', 'ครูเขียนข้อความหลังสมุดรุ่น', 'ทุกคนถ่ายรูปหมู่หน้าตึกเก่า', 'เพลงสุดท้ายที่ร้องด้วยกัน', 'เดินออกจากห้องประชุมพร้อมแสงไฟ'] },
};

const showBeats = (grade) => SHOW_THEMES[clamp(grade || 1, 1, 6)];

const SHOW_ROLES = [
  { id: 'act', name: 'นักแสดงบนเวที', game: 'rhythm', blurb: 'ขึ้นเวทีเต้นหรือแสดง ต้องซ้อมบ่อยๆ จังหวะถึงจะเป๊ะ ตื่นเต้นแต่ได้เสียงปรบมือ' },
  { id: 'camera', name: 'ช่างภาพถ่ายทำ', game: 'track', blurb: 'ถือกล้องตามนักแสดงให้อยู่ในเฟรมตลอดการแสดง ต้องมือนิ่งและตาไว' },
  { id: 'sound', name: 'ฝ่ายเสียง', game: 'track', blurb: 'คุมไมโครโฟนและเสียงดนตรีไม่ให้ดังเกินหรือเบาเกิน ผิดพลาดนิดเดียวทุกคนได้ยิน' },
  { id: 'edit', name: 'ฝ่ายตัดต่อวิดีโอ', game: 'sequence', blurb: 'เรียงคลิปความทรงจำให้เป็นเรื่องที่ซึ้งที่สุด ต้องจำลำดับเหตุการณ์ให้ดี' },
  { id: 'director', name: 'ผู้กำกับการแสดง', game: 'sequence', blurb: 'คุมลำดับและคิวทั้งงาน มีแค่ 2 ถึง 3 คนต่อรุ่น ครูต้องเชื่อใจและต้องซ้อมมาเยอะ' },
  { id: 'none', name: 'ผู้ชมในห้องประชุม', game: 'watch', blurb: 'นั่งชมเฉยๆ ไม่ต้องเหนื่อย แต่พลาดความสนุกหลังเวที' },
];

function showWatch(rng, theme) {
  const slides = [{ title: theme.title, line: `งานราตรีคืนนี้ใช้ชื่อว่า ${theme.title}` }].concat(
    theme.items.map((it, i) => ({ title: `ชุดที่ ${i + 1}`, line: it })),
  );
  const decoy = shuffled(rng, Object.values(SHOW_THEMES).filter((t) => t.title !== theme.title).map((t) => t.title)).slice(0, 2);
  const firstWrong = shuffled(rng, theme.items.slice(1)).slice(0, 2);
  const lastWrong = shuffled(rng, theme.items.slice(0, -1)).slice(0, 2);
  const raw = [
    ['งานราตรีคืนนี้ชื่อว่าอะไร', theme.title, decoy[0], decoy[1]],
    ['ชุดแรกของการแสดงคือชุดใด', theme.items[0], firstWrong[0], firstWrong[1]],
    ['ชุดสุดท้ายของการแสดงคือชุดใด', theme.items[theme.items.length - 1], lastWrong[0], lastWrong[1]],
  ];
  const questions = raw.map(([q, c, w1, w2]) => {
    const choices = shuffled(rng, [c, w1, w2]);
    return { q, choices, answer: choices.indexOf(c) };
  });
  return { slides, keywords: [theme.items[0], theme.items[theme.items.length - 1]], questions, topic: theme.title };
}

export const SHOW = {
  themes: SHOW_THEMES,
  roles: SHOW_ROLES,
  roleById: (id) => SHOW_ROLES.find((r) => r.id === id) || null,
  // candidates: [{ id, trust?, prep? }] (trust and prep 0..100 or 0..1). Returns 2-3 ids.
  directorPick(rng, candidates) {
    const list = (candidates || []).slice();
    const [lo, hi] = SCHEDULE.show.directors;
    const k = Math.min(list.length, rng.int(lo, hi));
    const out = [];
    const pool = list.slice();
    for (let i = 0; i < k; i++) {
      const w = (c) => {
        const t = Number.isFinite(c.trust) ? (c.trust > 1 ? c.trust / 100 : c.trust) : 0.3;
        const p = Number.isFinite(c.prep) ? (c.prep > 1 ? c.prep / 100 : c.prep) : 0.3;
        return 0.2 + 2 * t + 1.5 * p;
      };
      const pick = pickWeighted(rng, pool, w);
      out.push(pick.id);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  },
  // ctx: { grade, prep 0..1, skill 0..1 }
  showSpec(role, rng, ctx = {}) {
    const theme = showBeats(ctx.grade);
    const ease = clamp01(0.6 * clamp01(ctx.prep) + 0.4 * clamp01(ctx.skill == null ? 0.5 : ctx.skill));
    switch (role) {
      case 'act': {
        const item = rng.pick(theme.items);
        return { lanes: (ctx.grade || 1) >= 4 ? 4 : 3, bpm: Math.round(rint(rng, [84, 112]) - ease * 10), notes: rint(rng, [20, 30]), label: `การแสดงบนเวที: ${item}` };
      }
      case 'camera':
        return { mode: 'camera', speed: r1(lerp(1.3, 0.8, ease) * 10) / 10, band: r1(lerp(0.25, 0.42, ease) * 100) / 100 };
      case 'sound':
        return { mode: 'sound', speed: r1(lerp(1.3, 0.8, ease) * 10) / 10, band: r1(lerp(0.25, 0.42, ease) * 100) / 100 };
      case 'edit':
        return { clips: shuffled(rng, theme.story.map((l, i) => ({ id: `c${i + 1}`, label: l, order: i }))), label: `ตัดต่อวิดีโอ: ${theme.title}` };
      case 'director':
        return { clips: shuffled(rng, theme.items.map((l, i) => ({ id: `c${i + 1}`, label: l, order: i }))), label: `กำกับลำดับการแสดง: ${theme.title}` };
      default:
        return showWatch(rng, theme);
    }
  },
  showResult(role, score, prep, rng) {
    const s = clamp01(score);
    const p = clamp01(prep);
    const tier = scoreTier(s);
    const m = 0.6 + 0.8 * s + 0.2 * p;
    const base = {
      act: { peer: 4, stress: -2, energy: -4, teacherTrust: 1, diligence: 0.5, knowledge: 0.3 },
      camera: { peer: 1.5, stress: 1, energy: -3, teacherTrust: 1.5, diligence: 0.7, knowledge: 1.2 },
      sound: { peer: 1.5, stress: 1.5, energy: -3, teacherTrust: 1.5, diligence: 0.7, knowledge: 1.2 },
      edit: { peer: 1.5, stress: 0.5, energy: -2.5, teacherTrust: 1.5, diligence: 0.8, knowledge: 1.5 },
      director: { peer: 3, stress: 3, energy: -4, teacherTrust: 3.5, diligence: 1.2, knowledge: 0.8 },
      none: { peer: 1, stress: -3, energy: -1, teacherTrust: 0, diligence: 0, knowledge: 0.2 },
    }[role] || { peer: 1, stress: -1, energy: -1 };
    let fx = scaleFx(base, role === 'none' ? 1 : m);
    if (tier.id === 'bad' && role !== 'none') fx = addFx(fx, { stress: 2, peer: -1 });
    const logs = {
      act: { great: 'คุณขึ้นเวทีด้วยจังหวะแม่นเป๊ะ ผู้ชมปรบมือยาวจนต้องก้มคำนับสองรอบ', good: 'การแสดงของคุณราบรื่น พลาดนิดเดียวแต่ไม่มีใครสังเกต', ok: 'เต้นพอไปรอด มีก้าวผิดบ้าง แต่เพื่อนบนเวทีช่วยกลบให้', bad: 'คุณลืมท่าไปครึ่งเพลงและยิ้มกลบเกลื่อน ผู้ชมหัวเราะอย่างเอ็นดู' },
      camera: { great: 'ภาพจากกล้องนิ่งสวยมาก ทุกช็อตอยู่ในเฟรมครบ', good: 'ถ่ายได้เกือบครบ หลุดเฟรมแค่สองสามจังหวะ', ok: 'ภาพสั่นบ้างแต่ใช้ได้', bad: 'กล้องหลุดจากนักแสดงหลายช่วง ภาพที่ได้ต้องตัดทิ้งเยอะ' },
      sound: { great: 'เสียงสมดุลตลอดงาน ไม่มีเสียงหอนหรือไมค์ดับสักครั้ง', good: 'เสียงโอเค มีเสียงเบาไปนิดช่วงหนึ่ง', ok: 'เสียงขึ้นลงไม่สม่ำเสมอแต่คนฟังรู้เรื่อง', bad: 'ไมค์หอนในช่วงเงียบของฉากซึ้ง ทุกคนสะดุ้งทั้งห้อง' },
      edit: { great: 'วิดีโอที่คุณตัดต่อลำดับเรื่องเรียบเนียนจนหลายคนน้ำตาซึม', good: 'วิดีโอเรียงดี มีคลิปหนึ่งผิดที่ไปนิด', ok: 'วิดีโอเรียงถูกบ้างผิดบ้าง แต่ภาพที่เห็นก็ทำให้ยิ้มได้', bad: 'คลิปเรียงสลับจนเรื่องงง คนดูต้องเดาเอาเอง' },
      director: { great: 'คุณคุมคิวทั้งงานไม่มีสะดุด ครูเดินมาจับมือหลังจบ', good: 'งานเดินหน้าต่อเนื่อง สะดุดแค่เรื่องเปลี่ยนฉากเล็กน้อย', ok: 'มีคิวผิดสองสามจุด แต่ทุกคนช่วยกันแก้ได้ทัน', bad: 'คิวเลื่อนจนแสงกับเพลงไม่ตรงกัน คุณต้องวิ่งแก้หลังเวทีตลอดคืน' },
      none: { great: 'คุณนั่งดูทั้งงานอย่างเพลิดเพลิน', good: 'คุณนั่งดูทั้งงานอย่างเพลิดเพลิน', ok: 'คุณนั่งดูงานแบบหลับๆ ตื่นๆ', bad: 'คุณหลับไปสองชุดการแสดง' },
    }[role] || { great: 'การแสดงผ่านไปด้วยดี', good: 'การแสดงผ่านไปด้วยดี', ok: 'การแสดงผ่านไป', bad: 'การแสดงมีสะดุดบ้าง' };
    void rng;
    return { fx: cleanFx(fx), log: logs[tier.id], tier };
  },
};

// ---- freshers' welcome ---------------------------------------------------------------------------------------------

const FB = (id, name, what, place, placeKind, play, game, eventId, extra = {}) => ({ id, name, what, place, placeKind, play, game, eventId, ...extra });

const FRESHER_DAYS = [
  { day: 1, title: 'วันแรก: ต้อนรับและทำความรู้จัก', blocks: [
    FB('f1-1', 'พิธีต้อนรับน้องใหม่', 'พิธีต้อนรับน้องใหม่ที่หอประชุม', 'หอประชุม', 'hall', true, 'watch', 'fresher_hall', { sessions: ['welcome', 'school_song'] }),
    FB('f1-2', 'จำชื่อเพื่อนในทีมสี', 'เกมจำชื่อเพื่อนในทีมสี', 'สนามกลาง', 'field', true, 'pattern', 'fresher_game'),
    FB('f1-3', 'ทัวร์โรงเรียนกับพี่ๆ', 'พี่พาเดินดูตึกเรียนและโรงอาหาร', 'รอบโรงเรียน', 'walk', false, null, 'fresher_auto'),
  ] },
  { day: 2, title: 'วันที่สอง: กฎ ชีวิตหอ และเกมทีม', blocks: [
    FB('f2-1', 'ฟังกฎหอพัก', 'ฟังพี่เล่ากฎหอพักและชีวิตประจำวัน', 'หอประชุม', 'hall', false, null, 'fresher_auto', { sessions: ['dorm_rules', 'canteen_money', 'safety'] }),
    FB('f2-2', 'วิ่งเก็บของชุดทีม', 'เกมวิ่งเก็บของชุดทีมให้ครบตามลำดับ', 'สนามกลาง', 'field', true, 'dash', 'fresher_game'),
    FB('f2-3', 'ดูหอและจัดเตียง', 'ย้ายเข้าหอและจัดเตียงกับเพื่อนร่วมห้อง', 'หอพัก', 'dorm', false, null, 'fresher_auto'),
  ] },
  { day: 3, title: 'วันที่สาม: งานเลี้ยงและพิธีปิด', blocks: [
    FB('f3-1', 'ช่วยพี่ขายขนมในงานเลี้ยง', 'ช่วยพี่ขายขนมในงานเลี้ยงต้อนรับ', 'ลานโรงอาหาร', 'canteen', true, 'serve', 'fresher_serve'),
    FB('f3-2', 'เกมทีมสีกลางสนาม', 'แข่งเกมทีมสีกลางสนาม', 'สนามกลาง', 'field', false, null, 'fresher_auto'),
    FB('f3-3', 'พิธีปิดและเพลงโรงเรียน', 'พิธีปิดและร้องเพลงโรงเรียนด้วยกัน', 'หอประชุม', 'hall', true, 'watch', 'fresher_hall', { sessions: ['seniors_talk', 'study_tips'] }),
  ] },
];

const TEAM_COLORS = ['#e4572e', '#f3a712', '#29b6a8', '#4b8bbe', '#8e5bd4', '#e87daa'];
const TEAM_GEAR = ['ผ้าพันคอทีม', 'ธงทีม', 'หมวกสี', 'กระติกน้ำ', 'ถุงขนม', 'ป้ายชื่อ', 'เสื้อทีม', 'สายรัดข้อมือ'];

function fresherBlock(id) {
  for (const d of FRESHER_DAYS) for (const b of d.blocks) if (b.id === id) return b;
  return null;
}

export const FRESHER = {
  days: FRESHER_DAYS,
  titleFor(grade) {
    return grade === 4 ? 'งานรับน้องใหม่ ม.4 (เด็กใหม่ผสมเด็กที่มาจากโรงเรียนอื่น)' : 'งานรับน้องใหม่ ม.1';
  },
  blockById: fresherBlock,
  // params for the mini game of a play block (null for auto blocks). ctx: { grade, difficulty?, recent? }
  spec(blockId, rng, ctx = {}) {
    const b = fresherBlock(blockId);
    if (!b || !b.play) return null;
    const d = clamp01(ctx.difficulty == null ? 0.5 : ctx.difficulty);
    if (b.game === 'watch') return HALL.fresher.spec(rng, { sessionId: rng.pick(b.sessions), recent: ctx.recent });
    if (b.game === 'pattern') {
      return { beads: shuffled(rng, TEAM_COLORS).slice(0, 5), rounds: 4 + Math.round(d), startLen: 3, label: 'จำลำดับสีทีม' };
    }
    if (b.game === 'dash') {
      return { items: shuffled(rng, TEAM_GEAR).map((name, i) => ({ id: `g${i + 1}`, name })), sequenceLen: Math.round(lerp(5, 7, d)), timeLimit: Math.round(lerp(26, 20, d)) };
    }
    const theme = rng.pick(STALL_THEMES);
    const stall = { name: 'ร้านต้อนรับน้องใหม่', menu: threeDishes(rng, theme) };
    return serveSpec(rng, stall, { difficulty: Math.min(0.5, d) });
  },
};

export function fresherResult(blockId, score, ctx = {}, rng = new Rng(1)) {
  const b = fresherBlock(blockId);
  const s = score == null ? 0.6 : clamp01(score);
  const tier = scoreTier(s);
  if (!b) return { fx: {}, log: 'กิจกรรมรับน้องผ่านไป', tier };
  if (b.game === 'watch') return hallResult('fresher', s, ctx, rng);
  const base = b.play
    ? { peer: 2 + s * 2.5, stress: -3 - s * 2, energy: -3, teacherTrust: 0.5, knowledge: 0.2, diligence: 0.3 }
    : { peer: 1.5, stress: -2, energy: -2, teacherTrust: 0.3 };
  const log = b.play
    ? { great: `${b.what} คุณทำได้ยอดเยี่ยม พี่ๆ ชม`, good: `${b.what} ผ่านไปได้ดี ได้เพื่อนใหม่เพิ่ม`, ok: `${b.what} ผ่านไปแบบงงๆ แต่สนุก`, bad: `${b.what} คุณพลาดหลายจุด เพื่อนในทีมหัวเราะแล้วช่วยกันแก้` }[tier.id]
    : `${b.what}`;
  return { fx: cleanFx(base), log, tier };
}

// ---- resolve: the one entry point the engine calls ----------------------------------------------------------------

function finish(out, ctx, score) {
  const fx = cleanFx(out.fx || {});
  const have = Number.isFinite(ctx && ctx.money) ? Math.max(0, ctx.money) : 0;
  if (fx.money != null && fx.money < -have) {
    if (have === 0) delete fx.money;
    else fx.money = -have;
  }
  return { fx, log: out.log, tier: out.tier || scoreTier(score) };
}

export function resolve(eventId, game, score, ctx = {}, rng = new Rng(1)) {
  const s = score == null ? 0.6 : clamp01(score);
  const tier = scoreTier(s);
  const id = String(eventId || '');

  if (id.startsWith('loy_contest_')) {
    const cid = id.slice('loy_contest_'.length);
    const c = CONTESTS[ctx.contestId || cid] || CONTESTS.krathong_beautiful;
    const rank = ctx.place && ctx.of ? { place: ctx.place, of: ctx.of } : rankFromScore(s, ctx.rivals != null ? ctx.rivals : 12, rng);
    const tr = c.prize.tiers.find((t) => rank.place <= t.maxPlace) || c.prize.tiers[c.prize.tiers.length - 1];
    const fx = { money: tr.money, peer: tr.peer, teacherTrust: tr.teacherTrust, stress: rank.place <= 3 ? -2 : -0.5, energy: -2, diligence: 0.2 };
    return finish({ fx, log: `${c.title}: ได้ที่ ${rank.place} จาก ${rank.of} (${tr.label})${tr.money ? ` รับรางวัล ${tr.money} บาท` : ''}`, tier }, ctx, s);
  }

  if (id.startsWith('sport_') && id !== 'sport_practice') return finish(resolveSport(id, s, tier, ctx, rng), ctx, s);

  switch (id) {
    case 'loy_stall': {
      const stall = ctx.stall || {};
      if (ctx.invest > 0 && stall.invest) {
        const r = investResult(stall, ctx.invest, s, rng);
        return finish({ fx: r.fx, log: r.log, tier }, ctx, s);
      }
      const pay = stall.pay || { base: 30, perDish: 2 };
      const served = Number.isFinite(ctx.served) ? ctx.served : Math.round(s * (ctx.customers || 10));
      const money = pay.base + pay.perDish * served;
      const fx = { money, teacherTrust: stall.trust === 'teacher' ? 1 + 2 * s : 0, peer: 1 + s * 1.5, energy: -4, stress: 1 - s * 2, diligence: 0.5 };
      const who = stall.owner && stall.owner.name ? stall.owner.name : 'ร้านนี้';
      return finish({ fx, log: `งานลอยกระทง: ช่วยร้าน ${stall.name || who} ขายได้ ${served} จาน ได้ค่าแรง ${money} บาท`, tier }, ctx, s);
    }
    case 'loy_own': {
      if (!ctx.plan) return finish({ fx: { peer: 1, energy: -3 }, log: 'เปิดร้านของตัวเองในงานลอยกระทง', tier }, ctx, s);
      const r = ownStallResult(ctx.plan, s, rng);
      return finish({ fx: r.fx, log: r.log, tier }, ctx, s);
    }
    case 'loy_float': {
      const r = FLOAT.floatResult(s, rng);
      return finish({ fx: r.fx, log: r.log, tier }, ctx, s);
    }
    case 'loy_prep':
      return finish({ fx: { peer: 1 + s, energy: -3, stress: 0.5, diligence: 0.4 }, log: s >= 0.6 ? 'เช้านี้ช่วยเตรียมร้านงานลอยกระทงทันเวลาและเรียบร้อย' : 'เตรียมร้านงานลอยกระทงช้ากว่าแผน แต่ทุกคนช่วยกันเก็บงานจนทัน', tier }, ctx, s);
    case 'loy_wander': {
      const spend = Math.min(rint(rng, [20, 70]), Math.max(0, Number.isFinite(ctx.money) ? ctx.money : 0));
      return finish({ fx: { money: -spend, peer: 1, stress: -3, energy: -1 }, log: spend ? `เดินเที่ยวงานลอยกระทง ซื้อขนมและของเล่นไป ${spend} บาท` : 'เดินเที่ยวงานลอยกระทงดูของ แต่เงินไม่พอซื้ออะไร', tier }, ctx, s);
    }
    case 'show_act': case 'show_camera': case 'show_sound': case 'show_edit': case 'show_director': case 'show_watch': {
      const role = id === 'show_watch' ? 'none' : id.slice('show_'.length);
      const r = SHOW.showResult(role, s, ctx.prep, rng);
      return finish({ fx: r.fx, log: `งานราตรี: ${r.log}`, tier }, ctx, s);
    }
    case 'show_rehearsal':
      return finish({ fx: { peer: 1.2, stress: 0.8, energy: -2.5, diligence: 0.4, knowledge: 0.3 }, log: 'ซ้อมการแสดงงานราตรี ทุกคนช่วยกันซ้อมจนได้เห็นภาพรวมของงาน', tier }, ctx, s);
    case 'hall_award': case 'hall_lecture': case 'hall_special': case 'hall_farewell': case 'hall_fresher': {
      const r = hallResult(id.slice('hall_'.length), s, ctx, rng);
      return finish({ fx: r.fx, log: r.log, tier: r.tier }, ctx, s);
    }
    case 'fresher_hall': {
      const r = hallResult('fresher', s, ctx, rng);
      return finish({ fx: r.fx, log: r.log, tier: r.tier }, ctx, s);
    }
    case 'fresher_game': case 'fresher_serve': case 'fresher_auto': {
      const fx = id === 'fresher_auto'
        ? { peer: 1.5, stress: -2, energy: -2, teacherTrust: 0.3 }
        : { peer: 2 + s * 2.5, stress: -3 - s * 2, energy: -3, teacherTrust: 0.5, diligence: 0.3 };
      return finish({ fx, log: id === 'fresher_auto' ? 'กิจกรรมรับน้องผ่านไปอย่างอบอุ่น' : `เกมรับน้อง: ${tier.th}`, tier }, ctx, s);
    }
    case 'science_lab': {
      const r = labResult(s, ctx, rng);
      return finish({ fx: r.fx, log: r.log, tier: r.tier }, ctx, s);
    }
    case 'club_craft': {
      const r = clubCraftResult(s, ctx.area, rng);
      return finish({ fx: r.fx, log: r.log, tier: r.tier }, ctx, s);
    }
    case 'sport_practice':
      return finish(resolveSport(id, s, tier, ctx, rng), ctx, s);
    case 'xmas_craft': case 'xmas_candy': case 'xmas_infirmary':
      return finish(resolveXmas(id, s, tier, ctx, rng), ctx, s);
    case 'saturday_club': {
      const m = satMood('club');
      return finish({ fx: m.fx, log: 'วันเสาร์ที่ชุมนุม: ชิลๆ ไม่ต้องคิดอะไร', tier }, ctx, s);
    }
    case 'saturday_class': {
      const m = satMood(ctx.group || 'A', ctx.grade);
      const fx = scaleFx(m.fx, 0.7 + 0.6 * s);
      return finish({ fx, log: `เรียนวันเสาร์ (${m.label})`, tier }, ctx, s);
    }
    default: {
      const fx = { peer: 0.5 + s, stress: -1, energy: -1, knowledge: 0.3 };
      return finish({ fx, log: `กิจกรรมโรงเรียน: ${tier.th}`, tier }, ctx, s);
    }
  }
}

// ---- who you go with (companions) ----------------------------------------------------------------------------------
// COMPANION.scene(eventId, { friends, partner, acquaintance }, rng) -> { title, text, options:[{ id, label, sub, who }] }
//   friends = [{ id, name, grade, room, closeness }], partner = { id, name, closeness } | null, acquaintance = same shape | null.
//   option ids: 'partner', 'friend:<id>', 'acq:<id>', 'alone', 'group'.  who = { kind, id, name, closeness } or null.
// companionEffect(eventId, closeness, rng, name) -> { fx, closenessGain, scoreBonus, metNew, detail, line }
//   closeness: number 0..100 for a person, or 'alone' / 'group'.  scoreBonus 0..0.15 is added to the game score.
// Texts avoid pronouns for the other person, so they work for any sex.

const COMP_EVENTS = {
  fair: { title: 'ลอยกระทงกับใครดี', text: 'คืนนี้ทั้งโรงเรียนจะไปงานลอยกระทง คุณอยากเดินเที่ยวและลอยกระทงกับใคร', verb: 'ลอยกระทงกับ', alone: 'เดินเที่ยวคนเดียวชิลๆ ไม่ต้องรอใคร', group: 'ไปเป็นกลุ่มใหญ่ สนุกแบบรวมๆ' },
  show: { title: 'ดูงานราตรีกับใครดี', text: 'งานราตรีของรุ่นพี่กำลังจะเริ่ม คุณอยากนั่งดูข้างๆ ใคร', verb: 'ดูงานราตรีกับ', alone: 'นั่งดูคนเดียวเงียบๆ ใจเย็นๆ', group: 'นั่งรวมกับห้องหรือหอ ตะโกนเชียร์ได้เต็มที่' },
  fresher: { title: 'จับคู่เล่นเกมต้อนรับกับใครดี', text: 'พี่ๆ ให้จับคู่ก่อนเริ่มเกมรับน้อง คุณอยากอยู่คู่กับใคร', verb: 'เล่นเกมต้อนรับกับ', alone: 'ลุยเดี่ยว ไม่ผูกกับใคร', group: 'เข้ากลุ่มสีรวมกับเพื่อนในทีม' },
  sport: { title: 'นั่งเชียร์สีกับใครดี', text: 'วันกีฬาสีแล้ว สแตนด์ของสีเรามีที่นั่งว่างข้างๆ คุณอยากนั่งเชียร์กับใคร', verb: 'เชียร์สีกับ', alone: 'นั่งเชียร์คนเดียวริมสแตนด์ ดูได้เต็มตา', group: 'นั่งรวมกับเพื่อนสีเดียวกันทั้งแถว' },
  date: { title: 'ไปไหนดี', text: 'ว่างพอดี ชวนไปเดินเล่นหรือนั่งคุยกันไหม', verb: 'เดตกับ', alone: 'พักอยู่หอคนเดียว', group: 'ชวนเพื่อนไปด้วยกันเป็นกลุ่ม' },
};

const COMP_LINES = {
  close: ['ทั้งสองคนยิ้มพร้อมกันตอนเห็นของที่ชอบเหมือนกัน', 'พูดคุยกันได้ยาวไม่มีเงียบ จนเวลาผ่านไปโดยไม่รู้ตัว', 'อธิษฐานเรื่องเดียวกันโดยไม่ได้นัดไว้'],
  mid: ['คุยกันเรื่อยๆ เพลินดี รู้สึกสนิทกันขึ้นอีกนิด', 'แลกขนมกันกินและหัวเราะไปกับเรื่องเล็กๆ', 'ช่วยกันถือของและหาที่นั่งว่างจนเจอ'],
  far: ['เริ่มคุยกันแบบเก้ๆ กังๆ แต่จบด้วยรอยยิ้ม', 'ยังไม่รู้จะคุยอะไร แต่ถึงเวลาแยกก็รู้สึกอยากคุยอีก', 'ได้รู้เรื่องใหม่ๆ เกี่ยวกับอีกฝ่ายที่ไม่เคยรู้'],
  alone: ['เดินคนเดียวฟังเสียงรอบตัว ใจสงบกว่าที่คิด', 'ได้นั่งดูผู้คนเงียบๆ และถ่ายรูปเก็บบรรยากาศไว้', 'ไม่ต้องคอยปรับตัวให้ใคร สบายดี'],
  sport: ['ตะโกนเชียร์ด้วยกันจนเสียงแหบ แล้วหัวเราะกันตอนฟังเสียงของกันและกัน', 'แบ่งน้ำและพัดลมมือถือกัน ระหว่างรอดูรอบต่อไป', 'ช่วยกันถือธงสีและโบกจนแขนล้า'],
  rival: ['เป็นคู่แข่งคนละสี แต่ยังแบ่งขนมกินกันระหว่างพักยก', 'เชียร์คนละฝั่งแล้วแซวกันไปมาแบบขำๆ', 'ตกลงกันว่าสีใครชนะต้องเลี้ยงน้ำอีกฝ่าย'],
  group: ['เสียงหัวเราะดังตลอดทางเพราะมีคนเยอะ', 'ถูกเพื่อนในกลุ่มหยอกจนหัวเราะไม่หยุด', 'ได้ถ่ายรูปหมู่ไว้หลายใบ'],
};

export const COMPANION = {
  events: COMP_EVENTS,
  scene(eventId, ctx = {}, rng) {
    const ev = COMP_EVENTS[eventId] || COMP_EVENTS.fair;
    const options = [];
    const partner = ctx.partner || null;
    if (partner) {
      const rival = eventId === 'sport' && ctx.myColor && partner.color && partner.color !== ctx.myColor;
      options.push({ id: 'partner', label: partner.name, sub: rival ? `แฟน · คนละสี (สี${colorTh(partner.color)}) คู่แข่งสุดน่ารัก` : 'แฟน', who: { kind: 'partner', id: partner.id, name: partner.name, closeness: partner.closeness == null ? 80 : partner.closeness } });
    }
    // sports day: friends are filtered to the player's colour when both sides carry a colour (ctx.myColor, friend.color)
    const sameColor = (f) => eventId !== 'sport' || !ctx.myColor || !f.color || f.color === ctx.myColor;
    const friends = (ctx.friends || []).filter((f) => (!partner || f.id !== partner.id) && sameColor(f)).slice().sort((a, b) => b.closeness - a.closeness);
    const maxFriends = 4 - (partner ? 1 : 0) - (ctx.acquaintance && sameColor(ctx.acquaintance) ? 1 : 0);
    for (const f of friends.slice(0, Math.max(1, maxFriends))) {
      const where = f.grade ? `ม.${f.grade}${f.room ? '/' + f.room : ''} · ` : '';
      options.push({ id: `friend:${f.id}`, label: f.name, sub: `${where}สนิท ${Math.round(f.closeness)}`, who: { kind: 'friend', id: f.id, name: f.name, closeness: f.closeness } });
    }
    if (ctx.acquaintance && sameColor(ctx.acquaintance)) {
      const a = ctx.acquaintance;
      options.push({ id: `acq:${a.id}`, label: a.name, sub: 'เพิ่งรู้จัก ยังไม่ค่อยสนิท', who: { kind: 'acquaintance', id: a.id, name: a.name, closeness: a.closeness == null ? 15 : a.closeness } });
    }
    options.push({ id: 'alone', label: 'เดินคนเดียว', sub: ev.alone, who: null });
    options.push({ id: 'group', label: 'ไปกับห้อง/หอ', sub: ev.group, who: null });
    void rng;
    return { title: ev.title, text: ev.text, options };
  },
};

export function companionEffect(eventId, closeness, rng, name, opts = {}) {
  const ev = COMP_EVENTS[eventId] || COMP_EVENTS.fair;
  if (closeness === 'alone' || closeness == null) {
    return {
      fx: cleanFx({ stress: -2.5, peer: 0, energy: 0, diligence: 0.2 }),
      closenessGain: 0,
      scoreBonus: 0,
      metNew: rng.chance(0.2),
      detail: eventId === 'fair' ? 'เดินเที่ยวงานคนเดียว' : eventId === 'show' ? 'นั่งดูงานคนเดียว' : 'ไปคนเดียว',
      line: rng.pick(COMP_LINES.alone),
    };
  }
  if (closeness === 'group') {
    return {
      fx: cleanFx({ stress: -1.5, peer: 2, energy: -1, diligence: 0 }),
      closenessGain: 1,
      scoreBonus: 0.03,
      metNew: false,
      detail: eventId === 'fair' ? 'ไปงานกับห้อง/หอ' : eventId === 'show' ? 'ดูงานกับห้อง/หอ' : 'ไปกับกลุ่มห้อง/หอ',
      line: rng.pick(COMP_LINES.group),
    };
  }
  const c = clamp01(closeness / 100);
  let pool = c >= 0.65 ? COMP_LINES.close : c >= 0.3 ? COMP_LINES.mid : COMP_LINES.far;
  if (eventId === 'sport') pool = opts.sameColor === false ? COMP_LINES.rival : COMP_LINES.sport.concat(pool);
  return {
    fx: cleanFx({ peer: 1.5 + 3 * c, stress: -(1 + 3 * c), energy: -1, diligence: 0.2 }),
    closenessGain: r1(2 + 3 * (1 - c)),
    scoreBonus: Math.round(0.15 * c * 100) / 100,
    metNew: false,
    detail: `${ev.verb}${name || 'เพื่อน'}`,
    line: rng.pick(pool),
  };
}

// ---- crush: confessions, partner life, breakups -------------------------------------------------------------------
// All texts avoid he/she and gendered speech, so they fit any pair of students. {name} = the other person's nickname.
// CRUSH.config: numbers (0.8 per 2 years = cj, everything else PLACEHOLDER).
// crushWho(rng, pool, opts) -> one entry of the (already filtered) pool, or null.
// crushScene(rng, { who:{name,grade,room}, setting?, second? }) -> { id, setting, title, text, person, options }
// resolveCrush(optionId, ctx, rng) -> { fx, log, record, partner:'start'|'end'|'keep'|null, ask:boolean }
//   optionIds: accept decline wait | checkin_keep checkin_focus checkin_end | date | breakup
//   ctx: { name, money, closeness, second, neglected }
// CRUSH.checkin(rng, { name }) -> { title, text, options }.  CRUSH.breakupText(rng, { name }) -> { reason, text }.
// CRUSH.coupleLine(rng, name) / CRUSH.exLine(rng, name) -> one record line.

const CF = (id, setting, text) => ({ id, setting, text });

const CONFESSIONS = [
  CF('c1', 'locker', 'มีโน้ตพับครึ่งเสียบอยู่ในช่องล็อกเกอร์ ข้างในเขียนว่า "เราชอบเธอมานานแล้ว อ่านจบไม่ต้องรีบตอบ" ลงชื่อ {name}'),
  CF('c2', 'locker', 'ช็อกโกแลตแท่งเล็กวางอยู่บนสมุดของคุณ พร้อมกระดาษโน้ตลายมือเรียบร้อยของ {name} ว่า "ขอเป็นคนที่เธอคุยด้วยได้ไหม"'),
  CF('c3', 'after_class', 'หลังเลิกคาบ {name} เดินมาหยุดหน้าโต๊ะ มือสั่นเล็กน้อย บอกว่ามีเรื่องจะบอก แล้วพูดตรงๆ ว่าชอบคุณ'),
  CF('c4', 'after_class', 'ขณะเก็บของ {name} ตามมาที่หน้าห้อง ขอคุยเป็นการส่วนตัวสองนาที แล้วบอกว่าอยากรู้จักคุยกันมากกว่าเพื่อนธรรมดา'),
  CF('c5', 'dorm_gate', '{name} มารอที่หน้าประตูหอก่อนเวลาเช็กชื่อ บอกว่าคิดมานานว่าจะพูดอย่างไร สุดท้ายเลือกพูดสั้นๆ ว่า "ชอบนะ"'),
  CF('c6', 'dorm_gate', 'ครูเวรหันหลังพอดี {name} จึงรีบยื่นการ์ดใบเล็กให้ แล้วเดินกลับทันที ข้างในมีแต่ข้อความว่า "ถ้าอ่านแล้วยิ้ม บอกกันได้นะ"'),
  CF('c7', 'fair', 'ระหว่างเดินดูร้านในงานลอยกระทง {name} ขอให้ช่วยถือกระทง แล้วเอ่ยว่าอธิษฐานขอให้ได้เป็นมากกว่าเพื่อน'),
  CF('c8', 'fair', 'ข้างริมน้ำหลังปล่อยกระทง {name} บอกว่าอธิษฐานเรื่องเดียวกับสิ่งที่กำลังจะพูดตอนนี้ แล้วบอกความรู้สึกออกมา'),
  CF('c9', 'show', 'หลังม่านปิดงานราตรี {name} มาดักรอหลังเวทีพร้อมดอกไม้กระดาษที่พับเอง และบอกว่าชอบคุณมานานแล้ว'),
  CF('c10', 'show', 'หลังเสียงปรบมือสุดท้าย {name} บอกว่ารอวันนี้มานานเพื่อได้พูดสิ่งนี้ แล้วถามว่าอยากลองเป็นคนพิเศษของกันและกันไหม'),
  CF('c11', 'canteen', 'ที่โรงอาหาร {name} วางน้ำเก๊กฮวยเย็นไว้ตรงหน้าแล้วบอกว่าเลี้ยง ก่อนถามเสียงเบาว่า "เป็นแฟนกันไหม"'),
  CF('c12', 'library', '{name} ส่งกระดาษแผ่นเล็กข้ามโต๊ะในห้องสมุด เขียนไว้ว่า "ชอบนะ ตอบทีหลังก็ได้"'),
  CF('c13', 'field', 'หลังกีฬาสี {name} นั่งลงข้างๆ บอกว่าเชียร์คุณตลอดงาน แล้วบอกว่าจริงๆ อยากบอกอีกเรื่องหนึ่ง'),
  CF('c14', 'club', 'หลังเลิกชุมนุม {name} ขอเดินไปส่งที่หอ ระหว่างทางเงียบกันนาน แล้วบอกตรงๆ ว่าชอบ'),
  CF('c15', 'fresher', 'ในค่ายรับน้อง {name} ขอแยกวงเดินด้วยกันตอนพี่ๆ พักเบรก แล้วพูดเสียงเบาๆ ว่ารู้สึกดีทุกครั้งที่ได้อยู่ใกล้'),
  CF('c16', 'chat', 'ข้อความเด้งขึ้นตอนดึกจาก {name} ว่า "ขอโทษที่ส่งดึก แต่ไม่อยากรอพรุ่งนี้แล้ว เราชอบเธอ"'),
];

const SETTING_TH = { locker: 'ล็อกเกอร์', after_class: 'หลังเลิกคาบ', dorm_gate: 'หน้าประตูหอ', fair: 'งานลอยกระทง', show: 'หลังงานราตรี', canteen: 'โรงอาหาร', library: 'ห้องสมุด', field: 'สนามกีฬา', club: 'ชุมนุม', fresher: 'ค่ายรับน้อง', chat: 'ข้อความแชต' };

const ACCEPT_REPLIES = [
  'คุณพยักหน้า แล้วตอบว่า "ลองดูกัน" {name} ยิ้มกว้างจนทำอะไรไม่ถูก',
  'คุณตอบรับด้วยเสียงเบาๆ {name} หัวเราะแหะๆ แล้วบอกว่าจะไม่ทำให้ผิดหวัง',
  'คุณบอกว่าก็ชอบเหมือนกัน {name} นิ่งไปครู่หนึ่งก่อนยิ้มออกมาทั้งหน้า',
  'คุณตอบตกลง {name} เอามือปิดหน้าด้วยความดีใจ แล้วขอบคุณซ้ำสองรอบ',
];
const DECLINE_REPLIES = [
  'คุณขอบคุณและบอกว่าขอเป็นเพื่อนกันดีกว่า {name} พยักหน้าเข้าใจ แล้วบอกว่าไม่เป็นไร จะยังเป็นเพื่อนที่ดีให้',
  'คุณตอบอย่างอ่อนโยนว่ายังไม่พร้อมกับเรื่องแบบนี้ {name} ยิ้มบางๆ และบอกขอบคุณที่ตอบตรงๆ',
  'คุณปฏิเสธอย่างสุภาพ {name} เงียบไปครู่หนึ่งแล้วบอกว่าโล่งใจที่ได้พูดออกมา',
  'คุณบอกว่าชื่นชมน้ำใจ แต่ขอเป็นเพื่อนกันดีกว่า {name} ยิ้มแล้วบอกว่าเข้าใจดี',
];
const WAIT_REPLIES = [
  'คุณบอกว่าขอเวลาคิดสักหน่อย {name} บอกว่าได้เลย ไม่ต้องรีบ',
  'คุณขอเวลาคิดสักสิบวัน {name} พยักหน้าและบอกว่าจะรอ',
  'คุณยังไม่รู้ว่าตัวเองรู้สึกอย่างไร จึงขอเวลาคิด {name} ยิ้มแล้วบอกว่าเข้าใจ',
  'คุณขอเวลาไปคิดให้ดีก่อน {name} บอกให้ตอบเมื่อพร้อมเท่านั้น',
];
const ASKBACK_TEXTS = [
  '{name} เดินมาหาอีกครั้งหลังผ่านไปหลายวัน และถามเบาๆ ว่าตอนนี้คิดได้หรือยัง',
  'ผ่านมาประมาณสิบวันแล้ว {name} ส่งยิ้มมาให้ แล้วถามว่าคิดเรื่องนั้นเสร็จหรือยัง',
  'วันนี้ {name} รออยู่ที่เดิม บอกว่าไม่เร่งนะ แต่อยากรู้คำตอบสักที',
];

const DATE_OUTCOMES = [
  { id: 'd1', tone: 'good', fx: { stress: -5, peer: 1.5, energy: -1, diligence: -0.4, knowledge: -0.2 }, spend: [30, 90], text: 'นั่งกินขนมที่ลานหน้าตึกกับ {name} คุยกันเรื่องเล็กๆ จนลืมเวลา' },
  { id: 'd2', tone: 'good', fx: { stress: -4, peer: 1, energy: -1, diligence: -0.3, knowledge: 0 }, spend: [40, 120], text: 'ไปแวะร้านในโรงอาหารกับ {name} และแบ่งกันกินจนอิ่ม' },
  { id: 'd3', tone: 'good', fx: { stress: -6, peer: 2, energy: -2, diligence: -0.5, knowledge: -0.2 }, spend: [0, 30], text: 'เดินเล่นรอบสนามตอนเย็นกับ {name} ดูพระอาทิตย์ตกด้วยกัน' },
  { id: 'd4', tone: 'neutral', fx: { stress: -2, peer: 0.5, energy: -1, diligence: -0.4, knowledge: 0.3 }, spend: [0, 20], text: 'นั่งอ่านหนังสือคู่กับ {name} ที่ห้องสมุด ไม่ได้คุยเยอะแต่รู้สึกอบอุ่น' },
  { id: 'd5', tone: 'neutral', fx: { stress: 0, peer: 0, energy: -2, diligence: -0.5, knowledge: -0.5 }, spend: [20, 70], text: 'นัดกับ {name} แต่ทั้งคู่เหนื่อยจากเรียน จึงนั่งเงียบกันนานกว่าที่คิด' },
  { id: 'd6', tone: 'bad', fx: { stress: 3, peer: -0.5, energy: -2, diligence: -0.8, knowledge: -0.5 }, spend: [10, 50], text: 'มีเรื่องเข้าใจผิดกับ {name} เล็กน้อยระหว่างเดต ต้องคุยกันนานกว่าจะดีขึ้น' },
  { id: 'd7', tone: 'good', fx: { stress: -4, peer: 2, energy: -1, diligence: -0.3, knowledge: 0 }, spend: [0, 40], text: 'ช่วย {name} ซ้อมพูดหน้าห้องแล้วหัวเราะกันเรื่องที่ซ้อมแล้วพลาด' },
];

const CHECKIN_TEXTS = [
  'ช่วงนี้เวลาของคุณหมดไปกับการนั่งคุยกับ {name} เพื่อนๆ เริ่มทักว่าหายไปบ่อย และการบ้านก็เริ่มค้างเป็นกอง',
  '{name} ส่งข้อความมาถามว่าวันนี้ว่างไหม คุณมองกองงานแล้วเริ่มลังเลว่าควรทำอย่างไร',
  'ครูประจำชั้นเดินมาถามเบาๆ ว่าช่วงนี้เป็นอย่างไรบ้าง สายตาเหมือนรู้เรื่องของคุณกับ {name}',
  'เพื่อนร่วมห้องบอกว่าเห็นคุณมีความสุขขึ้น แต่คะแนนเก็บของคุณเริ่มตก คุณนั่งคิดถึง {name} กับเรื่องเรียนไปพร้อมกัน',
];

const BREAKUPS = [
  { id: 'b1', reason: 'ห่างกันเพราะไม่มีเวลา', text: '{name} บอกว่าช่วงนี้คุยกันน้อยลงจนเหมือนอยู่คนละโลก ทั้งสองคนเห็นตรงกันว่าห่างกันดีกว่าฝืนอยู่ต่อ' },
  { id: 'b2', reason: 'ทะเลาะเรื่องการเรียน', text: 'คุณกับ {name} ทะเลาะกันเรื่องที่ต้องแบ่งเวลาเรียนกับเวลาอยู่ด้วยกัน ไม่มีใครยอมใคร จนจบด้วยคำว่า "เลิกกันเถอะ"' },
  { id: 'b3', reason: 'ไม่ตรงกัน', text: '{name} บอกว่ารู้สึกว่าต่างกันมากเกินไป ทั้งสองคนยิ้มให้กันครั้งสุดท้ายแล้วแยกกันเดิน' },
  { id: 'b4', reason: 'เข้าใจผิดสะสม', text: 'เรื่องเล็กๆ ที่ไม่ได้พูดกันตรงๆ สะสมจนเต็ม {name} บอกว่าเหนื่อยกับการเดาใจกันแล้ว' },
  { id: 'b5', reason: 'ขอโฟกัสเรียน', text: 'ใกล้สอบ {name} ขอพักความสัมพันธ์เพื่อโฟกัสเรียน คุณเข้าใจและตกลงเลิกกันอย่างสงบ' },
  { id: 'b6', reason: 'ไม่ได้เจอกันบ่อย', text: 'ไม่ได้เจอกันนานเพราะทั้งคู่ติดกิจกรรม {name} บอกว่าความรู้สึกจางลงเอง ไม่มีใครผิด' },
  { id: 'b7', reason: 'เปลี่ยนไป', text: 'หลังเวลาผ่านไป {name} บอกว่าทั้งสองคนเปลี่ยนไปคนละทาง ขอบคุณสำหรับเวลาดีๆ ที่ผ่านมา' },
];

const COUPLE_LINES = [
  'เดินกลับหอกับ {name} คุยกันตลอดทาง',
  'แอบส่งยิ้มให้ {name} ผ่านหน้าต่างห้องเรียน',
  'ช่วย {name} ติวเลขก่อนสอบ แล้วโดนแซวทั้งโต๊ะ',
  'แบ่งขนมให้ {name} กินที่ม้านั่งหน้าตึก',
  'เพื่อนทักว่าช่วงนี้ยิ้มเยอะ เพราะ {name}',
  'โทรหา {name} ก่อนนอน คุยเรื่องไม่เป็นเรื่องจนง่วง',
  'ทำการ์ดเล็กๆ ให้ {name} ในวันเกิด',
  'ชวน {name} ไปงานโรงเรียนด้วยกัน และถูกถ่ายรูปติดกัน',
];

const EX_LINES = [
  'เห็น {name} เดินผ่านที่โรงอาหาร ต่างคนต่างทำเป็นมองไปทางอื่น',
  'เจอ {name} ในห้องสมุดแล้วยิ้มทักกันแบบเขินๆ',
  'เพื่อนถามถึง {name} คุณตอบแค่ว่า "ก็ผ่านไปแล้ว"',
  'ได้ยินเพลงที่เคยฟังกับ {name} แล้วนึกถึงขึ้นมานิดหน่อย',
  'ส่งเสียงเชียร์ในงานกีฬาสี แล้วเหลือบเห็น {name} อยู่ในกลุ่มเพื่อนใหม่ ยิ้มให้กันเบาๆ',
];

const fillName = (t, name) => t.replace(/\{name\}/g, name || 'คนนั้น');

export const CRUSH = {
  config: {
    perWindow: 0.8, // cj: chance that someone confesses in one 2-year window
    windowYears: 2, // cj
    windows: [[1, 2], [3, 4], [5, 6]],
    settingWeights: { locker: 2, after_class: 2, dorm_gate: 2, fair: 4, show: 4, canteen: 1, library: 1, field: 1, club: 1, fresher: 1, chat: 1 }, // PLACEHOLDER
    askBackDays: 10, // PLACEHOLDER
    breakupPerTerm: 0.12, // PLACEHOLDER
    checkinPerTerm: 1, // PLACEHOLDER
  },
  settings: SETTING_TH,
  confessions: CONFESSIONS,
  replies: { accept: ACCEPT_REPLIES, decline: DECLINE_REPLIES, wait: WAIT_REPLIES, askBack: ASKBACK_TEXTS },
  dateOutcomes: DATE_OUTCOMES,
  breakups: BREAKUPS,
  coupleLines: COUPLE_LINES,
  exLines: EX_LINES,
  options: [
    { id: 'accept', label: 'ตกลง', sub: 'เพื่อนและครูจะสนิทขึ้น แต่การเรียนจะแผ่ว ต้องกดเน้นเรียนเอง', tone: 'good' },
    { id: 'decline', label: 'ขอเป็นเพื่อนกัน', sub: 'ปฏิเสธอย่างอ่อนโยน', tone: 'neutral' },
    { id: 'wait', label: 'ขอเวลาคิด', sub: 'อีกประมาณสิบวันจะถูกถามอีกครั้ง', tone: 'neutral' },
  ],
  optionsSecond: [
    { id: 'accept', label: 'ตกลง', sub: 'หลังคิดมาสิบวัน', tone: 'good' },
    { id: 'decline', label: 'ขอเป็นเพื่อนกัน', sub: 'ขอปฏิเสธอย่างสุภาพ', tone: 'neutral' },
  ],
  checkin(rng, ctx = {}) {
    const text = fillName(rng.pick(CHECKIN_TEXTS), ctx.name);
    return {
      title: 'ความสัมพันธ์กับ ' + (ctx.name || 'คนพิเศษ'),
      text,
      options: [
        { id: 'checkin_keep', label: 'ไปต่อแบบเดิม', sub: 'สนิทกันมากขึ้น แต่เรียนจะแผ่ว', tone: 'neutral' },
        { id: 'checkin_focus', label: 'ขอเวลาโฟกัสเรียน', sub: 'คุยกันตรงๆ ว่าต้องเรียนก่อน', tone: 'good' },
        { id: 'checkin_end', label: 'จบความสัมพันธ์', sub: 'เสียใจ แต่เวลาของตัวเองกลับมา', tone: 'bad' },
      ],
    };
  },
  breakupText(rng, ctx = {}) {
    const b = rng.pick(BREAKUPS);
    return { id: b.id, reason: b.reason, text: fillName(b.text, ctx.name) };
  },
  coupleLine(rng, name) {
    return fillName(rng.pick(COUPLE_LINES), name);
  },
  exLine(rng, name) {
    return fillName(rng.pick(EX_LINES), name);
  },
  confession(rng, ctx = {}) {
    const pool = ctx.setting ? CONFESSIONS.filter((c) => c.setting === ctx.setting) : CONFESSIONS;
    const c = rng.pick(pool.length ? pool : CONFESSIONS);
    return { id: c.id, setting: c.setting, text: fillName(c.text, ctx.name) };
  },
};

// the confessor: pool is already filtered by the engine. Prefers someone within 2 grades if ctx.grade is given.
export function crushWho(rng, pool, opts = {}) {
  const list = (pool || []).filter((p) => !(opts.excludeIds || []).includes(p.id));
  if (!list.length) return null;
  const near = Number.isFinite(opts.grade) ? list.filter((p) => Math.abs((p.grade || opts.grade) - opts.grade) <= 2) : list;
  return rng.pick(near.length ? near : list);
}

export function crushScene(rng, ctx = {}) {
  const who = ctx.who || { name: 'ใครบางคน' };
  const person = { name: who.name, grade: who.grade || null, room: who.room || null };
  if (ctx.second) {
    return {
      id: 'ask_back', setting: 'ask_back', title: `${who.name} ถามอีกครั้ง`,
      text: fillName(rng.pick(ASKBACK_TEXTS), who.name), person, options: copy(CRUSH.optionsSecond),
    };
  }
  const settings = Object.keys(CRUSH.config.settingWeights);
  const setting = ctx.setting && settings.includes(ctx.setting) ? ctx.setting : pickWeighted(rng, settings, (s) => CRUSH.config.settingWeights[s]);
  const c = CRUSH.confession(rng, { setting, name: who.name });
  return { id: c.id, setting, title: `${who.name} มาบอกชอบ`, text: c.text, person, options: copy(CRUSH.options) };
}

export function resolveCrush(optionId, ctx = {}, rng = new Rng(1)) {
  const name = ctx.name || 'คนนั้น';
  switch (optionId) {
    case 'accept':
      return {
        fx: cleanFx({ stress: -4, peer: 2.5, teacherTrust: 0.6, diligence: -1.2, knowledge: -0.4 }),
        log: fillName(rng.pick(ACCEPT_REPLIES), name),
        record: `เริ่มคบกับ ${name}`,
        partner: 'start',
        ask: false,
      };
    case 'decline':
      return {
        fx: cleanFx({ stress: 1, peer: 0.5 }),
        log: fillName(rng.pick(DECLINE_REPLIES), name),
        record: `${name} มาบอกชอบ คุณขอเป็นเพื่อนกัน`,
        partner: null,
        ask: false,
      };
    case 'wait':
      return {
        fx: cleanFx({ stress: 1.5 }),
        log: fillName(rng.pick(WAIT_REPLIES), name),
        record: `${name} มาบอกชอบ คุณขอเวลาคิด`,
        partner: null,
        ask: true,
      };
    case 'checkin_keep':
      return {
        fx: cleanFx({ stress: -2, peer: 1, teacherTrust: 0.3, diligence: -0.8 }),
        log: `คุณตัดสินใจไปต่อกับ ${name} โดยไม่เปลี่ยนอะไร`,
        record: `คุยกับ ${name} แล้วยังคบกันต่อ`,
        partner: 'keep',
        ask: false,
      };
    case 'checkin_focus':
      return {
        fx: cleanFx({ stress: 0.5, diligence: 1.5, knowledge: 0.5, peer: -0.3 }),
        log: `คุณบอก ${name} ตรงๆ ว่าช่วงนี้ขอโฟกัสเรียนก่อน ทั้งสองคนตกลงกันได้ ไม่มีใครโกรธ`,
        record: `ขอ ${name} ให้เว้นเวลาไว้เรียน`,
        partner: 'keep',
        ask: false,
      };
    case 'checkin_end': {
      const b = CRUSH.breakupText(rng, { name });
      return {
        fx: cleanFx({ stress: 4, peer: -1, diligence: 0.5 }),
        log: `คุณตัดสินใจจบความสัมพันธ์กับ ${name} ${b.text}`,
        record: `เลิกกับ ${name}`,
        partner: 'end',
        ask: false,
      };
    }
    case 'breakup': {
      const b = CRUSH.breakupText(rng, { name });
      return {
        fx: cleanFx({ stress: 7, peer: -2, diligence: -1, energy: -2 }),
        log: b.text,
        record: `เลิกกับ ${name} (${b.reason})`,
        partner: 'end',
        ask: false,
      };
    }
    case 'date': {
      const d = rng.pick(DATE_OUTCOMES);
      const have = Number.isFinite(ctx.money) ? Math.max(0, ctx.money) : 0;
      const spend = Math.min(rint(rng, d.spend), have);
      return {
        fx: cleanFx({ ...d.fx, money: -spend }),
        log: fillName(d.text, name) + (spend ? ` (จ่ายไป ${spend} บาท)` : ''),
        record: CRUSH.coupleLine(rng, name),
        partner: 'keep',
        ask: false,
      };
    }
    default:
      return { fx: {}, log: '', record: '', partner: null, ask: false };
  }
}

// ---- Christmas (คริสต์มาส) ----------------------------------------------------------------------------------------
// XMAS.craftSpec(rng, ctx)  -> params of the `craft` game with kind 'tree' (decorating the tree; see docs/REQUESTS.md).
// XMAS.candySpec(rng, ctx)  -> params of the `timing` game (catch Santa's candy).
// XMAS.hitRoll(rng)         -> boolean, 30% (cj) that Santa's candy hits the player on the head.
// XMAS.hitScene(rng, { name? }) -> { title, text, options:[{ id:'infirmary'|'shrug', label, sub }] }
// XMAS.npcLine(rng, count)  -> log line about the other students who got hit.
// XMAS.nurseLine / visitLine / noticeLine -> infirmary texts.   resolve('xmas_craft'|'xmas_candy'|'xmas_infirmary', ...).

const TREE_THEMES = [
  { name: 'ต้นคริสต์มาสสีเขียวแดงคลาสสิก', palette: ['#2e7d32', '#c62828', '#ffd54f', '#ffffff'] },
  { name: 'ต้นคริสต์มาสโทนน้ำเงินหิมะ', palette: ['#1565c0', '#bbdefb', '#ffffff', '#ffd54f'] },
  { name: 'ต้นคริสต์มาสสีทองหรู', palette: ['#f9a825', '#ffe082', '#2e7d32', '#ffffff'] },
  { name: 'ต้นคริสต์มาสรักษ์โลก', palette: ['#558b2f', '#a1887f', '#fff3e0', '#c62828'] },
  { name: 'ต้นคริสต์มาสสีชมพูหวาน', palette: ['#ec407a', '#f8bbd0', '#ffffff', '#81c784'] },
];
const TREE_PIECES = [
  ['base', 'ต้นสนพลาสติกต้นเล็ก'], ['decor', 'ลูกบอลสีแดง'], ['decor', 'ลูกบอลสีทอง'], ['decor', 'ไฟกะพริบเส้นยาว'],
  ['decor', 'ดาวยอดต้น'], ['ribbon', 'โบว์ริบบิ้น'], ['decor', 'ถุงเท้าแขวน'], ['decor', 'ลูกสนแห้ง'],
  ['decor', 'ไม้เท้าลูกอม'], ['decor', 'เกล็ดหิมะกระดาษ'], ['decor', 'กล่องของขวัญจิ๋ว'], ['decor', 'นางฟ้ากระดาษ'],
];
const SANTA_LINES = [
  'โฮ่ โฮ่ โฮ่ ใครอยากได้ลูกอมยกมือขึ้น', 'ซานต้าเดินทางมาไกลจากขั้วโลกเหนือ ขอลูกอมแจกเด็กดีทุกคน', 'ใครซนมากโดนลูกอมเม็ดใหญ่ใส่หัวนะ',
  'เด็กหอพักปีนี้เก่งกันทุกคนเลย ซานต้าภูมิใจ', 'จะเริ่มโยนแล้วนะ ระวังหัวด้วยจ้ะ', 'ใครได้ลูกอมรสนมสดสองเม็ด ถือว่าโชคดีมาก',
  'ซานต้าฝากบอกให้ทุกคนนอนเร็วและทำการบ้านให้เสร็จ', 'สุขสันต์วันคริสต์มาสนะเด็กๆ ทุกคน',
];
const HIT_TEXTS = [
  'ลูกอมเม็ดใหญ่ที่ซานต้าโยนมาตกลงบนหัวคุณพอดี เพื่อนรอบข้างหัวเราะก่อนจะรีบถามว่าเจ็บไหม',
  'คุณเงยหน้ามองเวทีพอดีตอนที่ลูกอมถุงใหญ่ลอยมา กุบ เสียงดังจนคนข้างๆ สะดุ้ง',
  'ลูกอมเด้งจากไหล่เพื่อนมาโดนหน้าผากคุณเต็มๆ มึนไปครู่หนึ่งแล้วตาลาย',
];
const NPC_HIT_LINES = [
  'เพื่อนห้องอื่นคนหนึ่งโดนลูกอมเข้าเต็มหน้าผาก ครูเวรพาไปห้องพยาบาลทั้งที่ยังหัวเราะ',
  'รุ่นพี่แถวหลังโดนลูกอมที่ไหล่ แล้วรีบเอามือป้องหัวทุกครั้งที่ซานต้ายกถุง',
  'น้องหน้าใหม่คนหนึ่งยืนนิ่งเกินไป ถูกลูกอมกระเด็นใส่หมวกพอดี',
  'ครูเวรคนหนึ่งโดนลูกอมเข้าที่แว่น นักเรียนทั้งห้องประชุมหัวเราะจนซานต้าต้องหยุดชั่วคราว',
  'เพื่อนในแถวถัดไปแย่งกันเก็บลูกอมจนชนกันเอง สองคนต้องไปประคบเย็นที่ห้องพยาบาล',
  'นักเรียนคนหนึ่งโดนลูกอมเข้ากลางหัว แล้วบอกว่าโชคดีที่ไม่ใช่เม็ดสีแดง',
];
const NURSE_LINES = [
  'พยาบาลเอาถุงเย็นมาประคบให้และบอกให้นั่งพักอย่างน้อยครึ่งชั่วโมง',
  'พยาบาลตรวจดูแผลบนหัวแล้วบอกว่าแค่นูนนิดหน่อย ไม่มีอะไรน่าห่วง',
  'พยาบาลถามว่าเวียนหัวไหม คลื่นไส้หรือเปล่า แล้วจดบันทึกไว้',
  'พยาบาลยื่นน้ำเปล่าแก้วใหญ่ให้พร้อมคำสั่งว่าห้ามลุกเร็ว',
  'พยาบาลยิ้มและบอกว่าปีนี้มานับได้หลายคนแล้ว ซานต้าก็ฝีมือแรงเหมือนกัน',
  'พยาบาลให้นอนพักบนเตียงหลังผ้าม่าน แล้วปิดไฟดวงใหญ่ให้',
  'พยาบาลบอกว่าถ้าปวดหัวมากขึ้นให้เรียกทันที แล้วนั่งทำงานเอกสารอยู่ใกล้ๆ',
  'พยาบาลหยิบยาหม่องกลิ่นเย็นให้ดม และเล่าเรื่องวันคริสต์มาสปีก่อนๆ ที่เคยมีคนโดนหนักกว่านี้',
];
const VISIT_LINES = [
  '{name} แวะมาเยี่ยมพร้อมลูกอมสองเม็ดที่เก็บมาให้ แล้วขอโทษที่หัวเราะก่อนหน้านี้',
  '{name} เดินเข้ามานั่งข้างเตียง เอาการ์ดคริสต์มาสใบเล็กมาวางไว้ให้ แล้วบอกว่าหายไวๆ นะ',
  '{name} โผล่หน้าเข้ามาที่ประตูห้องพยาบาล โบกมือให้แล้วทำท่าจับหัวตัวเอง',
  '{name} เอาน้ำเก๊กฮวยเย็นมาฝาก แล้วนั่งเล่าเรื่องที่พลาดไปในงานปาร์ตี้ให้ฟัง',
  '{name} ส่งข้อความมาว่าเก็บของฝากไว้ให้แล้ว ขอให้หายเร็ว',
];
const NOTICE_LINES = [
  'ครูเวรที่ผ่านมาห้องพยาบาลหยุดมองและพยักหน้า ชมว่าไม่ร้องไห้ ไม่โวยวาย',
  'ครูประจำชั้นเดินมาถามอาการด้วยตัวเอง และกำชับให้พักผ่อนจนกว่าจะหาย',
  'ครูที่ปรึกษาชมว่าใจเย็นและเป็นตัวอย่างที่ดีแก่เพื่อนที่ตกใจ',
  'ผู้อำนวยการแวะมาเยี่ยมสั้นๆ พร้อมลูกอมสองเม็ดเป็นการขอโทษแทนซานต้า',
];

export const XMAS = {
  title: 'งานคริสต์มาส',
  hitChance: SCHEDULE.xmas.hitChance, // cj: 30%
  texts: {
    morning: 'เช้านี้ทั้งโรงเรียนช่วยกันประดับต้นคริสต์มาสหน้าตึก ไฟเส้นยาวพันเต็มต้น ลูกบอลสีสดแขวนทุกกิ่ง',
    hall: 'ที่หอประชุมมีปาร์ตี้คริสต์มาส ซานต้าขึ้นเวทีพร้อมถุงลูกอมใบใหญ่ และเริ่มโยนลงมายังผู้ชม',
    afternoon: 'บ่ายวันคริสต์มาสกลับมาเรียนตามปกติ แต่ทั้งห้องยังคงคุยกันเรื่องลูกอมไม่เลิก',
    hit: 'ลูกอมของซานต้าลงหัวเรา',
  },
  santaLines: SANTA_LINES,
  npcLines: NPC_HIT_LINES,
  nurseLines: NURSE_LINES,
  visitLines: VISIT_LINES,
  noticeLines: NOTICE_LINES,
  hitRoll(rng) {
    return rng.chance(SCHEDULE.xmas.hitChance);
  },
  craftSpec(rng, ctx = {}) {
    const theme = rng.pick(TREE_THEMES);
    const pieces = shuffled(rng, TREE_PIECES.slice(1)).slice(0, rint(rng, [9, 11]));
    const withBase = [TREE_PIECES[0]].concat(pieces);
    return {
      kind: 'tree',
      theme: { name: theme.name, palette: theme.palette.slice() },
      pieces: withBase.map(([kind, name], i) => ({ id: `p${i + 1}`, name, color: theme.palette[i % theme.palette.length], kind })),
      slots: rint(rng, [6, 8]),
      rubric: { palette: 0.3, symmetry: 0.4, variety: 0.3 },
    };
  },
  candySpec(rng, ctx = {}) {
    const d = clamp01(ctx.difficulty == null ? 0.5 : ctx.difficulty);
    return { tries: 3, zone: r1(lerp(0.3, 0.2, d) * 100) / 100, speed: r1(lerp(1.0, 1.7, d) * 10) / 10, label: 'ยื่นมือรับลูกอมจากซานต้า' };
  },
  hitScene(rng, ctx = {}) {
    return {
      title: XMAS.texts.hit,
      text: rng.pick(HIT_TEXTS),
      options: [
        { id: 'infirmary', label: 'ไปห้องพยาบาลกับเพื่อน', sub: 'พักประคบเย็น สุขภาพลดเล็กน้อยแต่ครูสังเกตเห็น', tone: 'good' },
        { id: 'shrug', label: 'บอกว่าไม่เป็นไร นั่งดูปาร์ตี้ต่อ', sub: 'ฝืนต่อไปได้ แต่ปวดหัวตลอดบ่าย', tone: 'neutral' },
      ],
    };
  },
  npcLine(rng, count) {
    const n = Math.max(0, Math.round(count || 0));
    return `ซานต้าโยนลูกอมโดนนักเรียนไป ${n} คน ${n ? rng.pick(NPC_HIT_LINES) : 'วันนี้ไม่มีใครโดนหัวเลย'}`;
  },
  nurseLine: (rng) => rng.pick(NURSE_LINES),
  visitLine: (rng, name) => fillName(rng.pick(VISIT_LINES), name || 'เพื่อน'),
  noticeLine: (rng) => rng.pick(NOTICE_LINES),
};

// resolve() for the three Christmas event ids (called from resolve's switch)
function resolveXmas(id, s, tier, ctx, rng) {
  if (id === 'xmas_craft') {
    return { fx: { peer: 1 + s * 1.5, stress: -2 - s, energy: -2, diligence: 0.2 }, log: s >= 0.6 ? 'ประดับต้นคริสต์มาสสวยงามจนเพื่อนมาถ่ายรูปด้วย' : 'ประดับต้นคริสต์มาสได้ครึ่งเดียว แต่ทุกคนช่วยกันเก็บงานจนเสร็จ', tier };
  }
  if (id === 'xmas_infirmary') {
    const bits = [XMAS.nurseLine(rng), ctx.visitor ? XMAS.visitLine(rng, ctx.visitor) : '', XMAS.noticeLine(rng)].filter(Boolean);
    return { fx: { health: -1.5, stress: -3, energy: 2, teacherTrust: 0.8, peer: ctx.visitor ? 1 : 0 }, log: `พักที่ห้องพยาบาล ${bits.join(' ')}`, tier };
  }
  // xmas_candy: ctx.hit = Santa's candy landed on the player
  if (ctx.hit) {
    return { fx: { health: -2, stress: 1, peer: 1.5, energy: -1 }, log: `${XMAS.texts.hit} คุณหัวนูนเล็กน้อยและกลายเป็นเรื่องเล่าของวัน`, tier };
  }
  const caught = Math.round(s * 5);
  return { fx: { peer: 1 + s, stress: -3 - s, energy: -1 }, log: caught ? `คุณรับลูกอมของซานต้าได้ ${caught} เม็ด แบ่งให้เพื่อนข้างๆ ด้วย` : 'คุณรับลูกอมไม่ทัน แต่เพื่อนแบ่งให้หนึ่งเม็ด', tier };
}

// ---- epidemics ---------------------------------------------------------------------------------------------------
// Generic common illnesses only. R = spread speed (PLACEHOLDER), sickDays = [min, max] days a person is ill (PLACEHOLDER),
// season weights are for 'hot' / 'cool' / 'cold' (PLACEHOLDER).

const EP = (id, name, symptoms, R, sickDays, seasons, severity, notice) => ({ id, name, symptoms, R, sickDays, seasons, severity, notice });

export const EPIDEMICS = [
  EP('flu', 'ไข้หวัดใหญ่', 'ไข้สูง ปวดเมื่อยตัว ไอและเจ็บคอ', 1.9, [4, 7], { hot: 1, cool: 2, cold: 3 }, 0.8, 'มีนักเรียนหลายห้องมีไข้สูงและปวดเมื่อยตัวพร้อมกัน พยาบาลสงสัยว่าเป็นไข้หวัดใหญ่'),
  EP('cold', 'ไข้หวัดธรรมดา', 'น้ำมูกไหล ไอ จาม ตัวร้อนเล็กน้อย', 1.6, [3, 5], { hot: 1, cool: 2, cold: 3 }, 0.4, 'ในหอเริ่มมีเสียงไอจามดังกันทุกห้อง เพราะอากาศเปลี่ยนไปอย่างรวดเร็ว'),
  EP('conjunctivitis', 'ตาแดง', 'ตาแดง น้ำตาไหล แสบตา ขี้ตามาก', 2.2, [3, 6], { hot: 2, cool: 1, cold: 1 }, 0.35, 'นักเรียนหลายคนมาโรงเรียนด้วยตาแดงก่ำ ครูกำชับไม่ให้ขยี้ตาและใช้ผ้าเช็ดหน้าร่วมกัน'),
  EP('chickenpox', 'อีสุกอีใส', 'ไข้ต่ำ ผื่นตุ่มน้ำใสขึ้นตามตัวและคัน', 1.5, [6, 7], { hot: 1, cool: 2, cold: 2 }, 0.6, 'พบนักเรียนมีตุ่มใสคันตามตัวหลายราย ต้องแยกห้องพักและห้ามเกาจนเป็นแผล'),
  EP('stomach', 'ท้องเสียหมู่', 'ปวดท้อง ถ่ายเหลว คลื่นไส้ อ่อนเพลีย', 2.0, [3, 4], { hot: 3, cool: 1, cold: 1 }, 0.5, 'หลังมื้อเย็นมีคนปวดท้องและไปห้องน้ำกันเป็นแถว ครูสงสัยเรื่องอาหารหรือน้ำดื่มชุดหนึ่ง'),
  EP('hfm', 'มือ เท้า ปาก', 'ไข้ แผลในปาก ตุ่มที่มือและเท้า', 1.7, [5, 7], { hot: 2, cool: 2, cold: 1 }, 0.55, 'มีนักเรียนบ่นเจ็บปากจนกินข้าวไม่ได้ และเห็นตุ่มเล็กๆ ที่ฝ่ามือกับฝ่าเท้า'),
];

export function epidemicById(id) {
  return EPIDEMICS.find((e) => e.id === id) || null;
}

// season: 'hot' | 'cool' | 'cold'
export function pickEpidemic(rng, season = 'cool') {
  return pickWeighted(rng, EPIDEMICS, (e) => e.seasons[season] != null ? e.seasons[season] : 1);
}

const EP_ILL_OPTIONS = (canGoHome) => [
  { id: 'infirmary', label: 'พักที่ห้องพยาบาล', sub: 'มีพยาบาลดูแล ไม่ต้องไปเรียน หายไวกว่าเล็กน้อย', tone: 'good' },
  { id: 'dorm', label: 'พักที่หอ', sub: 'นอนเงียบๆ เพื่อนร่วมห้องอาจติดด้วย', tone: 'neutral' },
  { id: 'home', label: 'กลับไปพักที่บ้าน', sub: canGoHome ? 'ผู้ปกครองมารับ ไม่แพร่เชื้อในหอ' : 'ตอนนี้ยังกลับบ้านไม่ได้', tone: 'neutral', disabled: !canGoHome },
];

// kind: 'outbreak' | 'ill' | 'suspend' | 'resume' | 'recovered'. ctx: { share (0..1), days, canGoHome, name }
export function epidemicScene(kind, disease, ctx = {}, rng = new Rng(1)) {
  const d = disease || EPIDEMICS[0];
  const pct = Math.round(clamp01(ctx.share) * 100);
  switch (kind) {
    case 'outbreak':
      return { title: `เริ่มมีคนป่วยเป็น${d.name}`, text: `${d.notice} ตอนนี้ป่วยแล้วประมาณ ${pct}% ของโรงเรียน ล้างมือบ่อยๆ และเลี่ยงการใช้ของร่วมกัน`, options: [{ id: 'ok', label: 'รับทราบ', sub: 'ล้างมือ ดื่มน้ำ นอนให้พอ' }] };
    case 'ill':
      return { title: `ติด${d.name}`, text: rng.pick([`ตื่นขึ้นมาแล้วรู้สึกไม่ไหว อาการเข้าได้กับ${d.name}: ${d.symptoms} พยาบาลแนะนำให้พักผ่อนและหยุดเรียนจนกว่าจะหาย`, `ตลอดเช้าคุณรู้สึกตัวร้อนและหมดแรง ผลตรวจสั้นๆ บอกว่าติด${d.name} (${d.symptoms}) ต้องพักจนกว่าจะหาย`]), options: EP_ILL_OPTIONS(!!ctx.canGoHome) };
    case 'suspend': {
      const days = Math.max(1, Math.round(ctx.days || 3));
      return { title: 'โรงเรียนประกาศหยุดเรียน', text: `เพราะ${d.name}ระบาดหนักถึง ${pct}% ของโรงเรียน ผู้อำนวยการจึงประกาศหยุดเรียน ${days} วัน ให้ทุกคนพักในหอหรือกลับบ้าน ระหว่างนี้ล้างมือ ดื่มน้ำ และอย่ารวมตัวกันเป็นกลุ่มใหญ่`, options: [{ id: 'dorm', label: 'พักอยู่ที่หอ', sub: 'นอนพักและอ่านหนังสือเงียบๆ' }, { id: 'home', label: 'กลับไปพักที่บ้าน', sub: ctx.canGoHome ? 'ผู้ปกครองมารับ' : 'กลับบ้านไม่ได้ในตอนนี้', disabled: !ctx.canGoHome }] };
    }
    case 'resume':
      return { title: 'เปิดเรียนอีกครั้ง', text: `หลังหยุดเรียนหลายวัน ${d.name}ลดลงเหลือประมาณ ${pct}% โรงเรียนประกาศให้กลับมาเรียนตามปกติ ครูฝากเตือนให้ล้างมือก่อนกินข้าวทุกครั้ง`, options: [{ id: 'ok', label: 'รับทราบ' }] };
    default:
      return { title: `หายจาก${d.name}แล้ว`, text: INFIRMARY.recoveryLine(rng), options: [{ id: 'ok', label: 'รับทราบ' }] };
  }
}

export function epidemicChip(disease, share) {
  const d = typeof disease === 'string' ? epidemicById(disease) : disease;
  return `โรคระบาด: ${d ? d.name : 'ไม่ทราบชนิด'} ${Math.round(clamp01(share) * 100)}%`;
}

// ---- infirmary and sick days ----------------------------------------------------------------------------------------

const SICK_DETAIL = {
  dorm: ['นอนพักที่หอ ตื่นมากินยาแล้วหลับต่อ', 'เพื่อนร่วมห้องแบ่งข้าวต้มมาให้ที่เตียง ตัวยังร้อนอยู่', 'พักที่หอ ดื่มน้ำเยอะๆ ฟังเพลงเบาๆ จนง่วง', 'ครูเวรแวะเช็กอาการหน้าห้องและเตือนให้พักผ่อน'],
  infirmary: ['นอนพักที่ห้องพยาบาล พยาบาลวัดไข้ทุกสองชั่วโมง', 'พยาบาลเอาผ้าเย็นมาเช็ดตัวและให้ยาลดไข้ตามเวลา', 'ได้นอนบนเตียงสะอาดหลังม่านสีขาว สงบดี', 'พยาบาลเตือนให้ดื่มน้ำเกลือแร่แก้วเล็กๆ ทีละนิด'],
  home: ['พักที่บ้านกับผู้ปกครองดูแลใกล้ชิด', 'แม่ทำข้าวต้มและคอยวัดไข้ให้ทั้งวัน', 'นอนยาวที่บ้านและได้นอนหลับสนิทที่สุดในรอบสัปดาห์'],
};
const SICK_FX = {
  dorm: { health: 2.5, stress: -0.5, energy: 3, diligence: -0.3 },
  infirmary: { health: 3.5, stress: -1, energy: 3, diligence: -0.2 },
  home: { health: 4, stress: -3, energy: 4, diligence: -0.3 },
};
const RECOVERY_LINES = [
  'ไข้ลดและกินข้าวได้เต็มชามแล้ว พยาบาลอนุญาตให้กลับไปเรียน',
  'ตื่นเช้ามารู้สึกโล่งตัว ไม่มีไข้ ไม่ปวดหัว ขอบคุณเพื่อนที่คอยจดงานให้',
  'อาการหายสนิท คุณล้างมือสองรอบก่อนเข้าห้องเรียนเพื่อกันกลับไปป่วยอีก',
  'กลับมาเดินในโรงเรียนอีกครั้ง ข้างทางเพื่อนทักว่าหายแล้วหรือยัง คุณยิ้มรับ',
  'หมอ พยาบาลและเพื่อนทุกคนช่วยกันดูแลจนหายดี คุณตั้งใจจะนอนให้พอมากขึ้น',
];

export const INFIRMARY = {
  places: { dorm: 'พักที่หอ', infirmary: 'ห้องพยาบาล', home: 'พักที่บ้าน' },
  nurseLines: NURSE_LINES.concat([
    'พยาบาลวัดอุณหภูมิแล้วจดตัวเลขลงสมุดเล่มเล็ก',
    'พยาบาลถามว่ากินข้าวมื้อล่าสุดเมื่อไร แล้วเสนอโจ๊กร้อนๆ',
    'พยาบาลสอนวิธีล้างมือให้ถูกวิธีซ้ำอีกครั้งแบบใจเย็น',
  ]),
  recoveryLines: RECOVERY_LINES,
  sickLabel: (place) => `ไม่สบาย: ${INFIRMARY.places[place] || 'พักที่หอ'}`,
  // detail text for a sick day block
  detail: (place, rng) => rng.pick(SICK_DETAIL[place] || SICK_DETAIL.dorm),
  // per-day fx of resting
  dayFx: (place) => cleanFx(SICK_FX[place] || SICK_FX.dorm),
  nurseLine: (rng) => rng.pick(INFIRMARY.nurseLines),
  recoveryLine: (rng) => rng.pick(RECOVERY_LINES),
};

// ---- sick before or on an exam day ---------------------------------------------------------------------------------
// The numbers mirror E3's config (E.MISSED_EXAM_CREDIT, E.SICK_BEFORE_EXAM_PENALTY); they are only shown in texts here.
const EXAM_TH = { mid: 'สอบกลางภาค', final: 'สอบปลายภาค' };
const examName = (e) => EXAM_TH[e] || (typeof e === 'string' && e ? e : 'การสอบ');

export const EXAM_SICK = {
  config: { missedCredit: 0.4, penalty: 0.15, windowDays: 3 }, // PLACEHOLDER (cj gave only the rules: sick on exam day = no exam, within 3 days before = worse)
  // sick on the exam day: cannot take the exam. ctx: { exam: 'mid'|'final', subject?, sickDays? }
  missed(rng, ctx = {}) {
    const ex = examName(ctx.exam);
    const sub = ctx.subject ? ` วิชา${ctx.subject}` : '';
    const text = rng.pick([
      `คุณมีไข้และต้องนอนพักในวัน${ex}${sub} ครูแจ้งว่าไม่มีสอบซ่อม คะแนนส่วนที่ขาดสอบจะถูกนับเพียงบางส่วน`,
      `เช้าวัน${ex}${sub} คุณลุกไม่ไหว ครูมารับทราบอาการแล้วบอกว่าขาดสอบแล้วจะไม่มีโอกาสทำใหม่`,
      `พยาบาลไม่อนุญาตให้ไปห้องสอบในวัน${ex}${sub} เพราะยังมีไข้ คุณได้แต่มองนาฬิกาอย่างเสียดาย`,
    ]);
    return {
      title: 'ขาดสอบเพราะป่วย',
      text,
      record: `ขาดสอบ${sub ? sub : ''} (${ex})`,
      reportLine: `ขาดสอบ ${ex}: ได้คะแนนส่วนนี้เพียง ${Math.round(EXAM_SICK.config.missedCredit * 100)}% ของที่ควรได้`,
      options: [{ id: 'ok', label: 'รับทราบ', sub: 'ผลการเรียนจะลดลงตามส่วนที่ขาด' }],
    };
  },
  // ill within 3 days before the exam: worse score. ctx: { exam, daysBefore 1..3 }
  penalty(rng, ctx = {}) {
    const ex = examName(ctx.exam);
    const d = clamp(Math.round(ctx.daysBefore || 3), 1, 3);
    const how = d === 1 ? 'เพิ่งหายไข้เมื่อวาน ยังอ่อนเพลียมาก' : d === 2 ? 'เพิ่งหายป่วยเมื่อสองวันก่อน หัวยังตื้อ' : 'เพิ่งหายป่วยเมื่อสามวันก่อน ยังไม่เต็มร้อย';
    return {
      title: 'ป่วยก่อนสอบ',
      text: `${how} ${rng.pick(['อ่านหนังสือได้ไม่เต็มที่และสมาธิหลุดง่าย', 'ทบทวนได้น้อยกว่าที่ตั้งใจ', 'นั่งสอบทั้งที่ยังมึนๆ'])} คะแนน${ex}จึงอาจแย่กว่าที่ควรเป็น`,
      record: `ป่วยก่อน${ex} ${d} วัน`,
      reportLine: `ป่วยก่อน${ex} ${d} วัน: คะแนนสอบลดลง (ยิ่งใกล้วันสอบยิ่งลดมาก)`,
      scale: r1((4 - d) / 3 * 100) / 100,
      options: [{ id: 'ok', label: 'รับทราบ' }],
    };
  },
  // classes were suspended over exam days, so the exam moves. ctx: { exam, days }
  postponed(rng, ctx = {}) {
    const ex = examName(ctx.exam);
    const days = Math.max(1, Math.round(ctx.days || 3));
    return {
      title: `เลื่อน${ex}`,
      text: `เพราะโรงเรียนหยุดเรียนช่วงนี้ ${ex}จึงเลื่อนออกไป ${days} วัน ${rng.pick(['เพื่อนๆ ถือโอกาสทบทวนเพิ่ม', 'ได้เวลาอ่านหนังสือเพิ่มอีกหน่อย', 'ทุกคนใจชื้นขึ้นมานิดหนึ่ง'])}`,
      record: `${ex}เลื่อน ${days} วัน`,
      reportLine: `${ex} เลื่อน ${days} วัน เพราะโรงเรียนหยุดเรียน`,
      options: [{ id: 'ok', label: 'รับทราบ' }],
    };
  },
};

// ---- colour sports day (กีฬาสี) -------------------------------------------------------------------------------------
// colorOf(no) -> { id, th, name, hex, index }: student number 1,2,3,4,5.. -> red, yellow, purple, blue, red.. (cj).
// SPORTS = { config, colors, events, byId, signupScene, signupOptions, commentary, rivalJoke, playerPoints }.
//   events: 8 sports + 'stand' + 'cheer', each { id, name, kind:'team'|'solo'|'mass', game, blurb, teamSize, spec(rng, ctx), texts:{great,good,ok,bad}, practice }.
//   spec ctx: { difficulty 0..1, color: 'red'|'yellow'|'purple'|'blue' }; params match CONTRACT3 section 5 for that game.
// sportsResult(sportId, score, ctx, rng) -> { fx, log, tier, points, closenessGain }   (also resolve('sport_<id>') and resolve('sport_practice')).
//   points = what the player adds to the colour team (0..10); closenessGain = extra closeness with same-colour friends.
// colorRanking(points) -> { ranking:[{id,th,hex,points,rank}], winner, title, text, card:{rows}, bars, fx:{[colorId]:fx} }
//   points = { red, yellow, purple, blue } or an array in that order. colorRankFx(place) -> fx for a student of that place.

const COLOR_LIST = [
  { id: 'red', th: 'แดง', hex: '#d32f2f',
    cheers: ['แดงสู้ๆ แดงสู้ๆ ลุยไฟไม่ถอย', 'สีแดงร้อนแรง ไม่แพ้ใคร', 'เลือดแดงไม่มีวันถอย'],
    chant: 'แดง แดง แดง ไฟลุกทั่วสนาม',
    stand: { name: 'ไฟลุกท่วมสนาม', palette: ['#d32f2f', '#ff8a65', '#fff3e0'], stunts: ['เปลวไฟพลิกการ์ด', 'หัวใจสีแดง', 'ตัวอักษรชื่อสี'] } },
  { id: 'yellow', th: 'เหลือง', hex: '#f9a825',
    cheers: ['เหลืองสดใส ให้ใจเต้นแรง', 'พลังแสงอาทิตย์ส่องมาที่สีเหลือง', 'เหลืองเหลืองเหลือง ไม่เคยเหนื่อย'],
    chant: 'เหลือง เหลือง เหลือง สดใสทั้งสนาม',
    stand: { name: 'ทุ่งทานตะวัน', palette: ['#f9a825', '#fff176', '#6d4c41'], stunts: ['ดอกทานตะวันบาน', 'พระอาทิตย์ขึ้น', 'ตัวอักษรชื่อสี'] } },
  { id: 'purple', th: 'ม่วง', hex: '#7b1fa2',
    cheers: ['ม่วงลึกลับ แต่ชนะทุกรอบ', 'สีม่วงพลังมหัศจรรย์', 'ม่วงรวมใจ ไม่หวั่นไหว'],
    chant: 'ม่วง ม่วง ม่วง ปริศนาทั่วสนาม',
    stand: { name: 'กาแล็กซีสีม่วง', palette: ['#7b1fa2', '#ce93d8', '#ffe082'], stunts: ['ดาวหางพุ่งผ่าน', 'ดวงจันทร์สีม่วง', 'ตัวอักษรชื่อสี'] } },
  { id: 'blue', th: 'ฟ้า', hex: '#0288d1',
    cheers: ['ฟ้าใสๆ ใจสู้ไม่ยอมแพ้', 'ฟ้ากว้างใหญ่ ใจเราก็เช่นกัน', 'คลื่นสีฟ้าซัดท่วมสนาม'],
    chant: 'ฟ้า ฟ้า ฟ้า คลื่นแรงทั่วสนาม',
    stand: { name: 'คลื่นทะเลสีฟ้า', palette: ['#0288d1', '#b3e5fc', '#ffffff'], stunts: ['คลื่นซัดฝั่ง', 'นกนางนวลโบยบิน', 'ตัวอักษรชื่อสี'] } },
];
const COLOR_BY_ID = Object.fromEntries(COLOR_LIST.map((c) => [c.id, c]));

export function colorOf(no) {
  const n = Math.max(1, Math.floor(Number(no) || 1));
  const index = (n - 1) % 4;
  const c = COLOR_LIST[index];
  return { id: c.id, th: c.th, name: `สี${c.th}`, hex: c.hex, index };
}

const colorTh = (id) => (COLOR_BY_ID[id] ? COLOR_BY_ID[id].th : 'แดง');
const colorStand = (id) => (COLOR_BY_ID[id] || COLOR_LIST[0]).stand;

const SPORT_TEXTS = (great, good, ok, bad) => ({ great, good, ok, bad });
const track = (rng, d, mode = 'camera') => ({ mode, speed: r1(lerp(0.8, 1.3, d) * 10) / 10, band: r1(lerp(0.4, 0.26, d) * 100) / 100 });
const tim = (d, label, z, sp) => ({ tries: 3, zone: r1(lerp(z[0], z[1], d) * 100) / 100, speed: r1(lerp(sp[0], sp[1], d) * 10) / 10, label });
const rhy = (rng, d, lanes, bpm, notes, label) => ({ lanes, bpm: Math.round(lerp(bpm[0], bpm[1], d)) + rng.int(-3, 3), notes: rint(rng, notes), label });

const SPORT_EVENTS = [
  { id: 'football', name: 'ฟุตบอล', kind: 'team', game: 'timing', teamSize: 7, blurb: 'ลงสนามฟุตบอลเจ็ดคนต่อทีม คุณมีหน้าที่ยิงลูกสำคัญ',
    spec: (rng, c) => tim(c.d, 'ยิงประตูให้เข้ามุม', [0.26, 0.17], [1.2, 1.8]),
    practice: 'ซ้อมยิงประตูและส่งบอลกับเพื่อนสีเดียวกัน',
    texts: SPORT_TEXTS('คุณยิงประตูสำคัญจนทั้งสแตนด์ลุกขึ้นกรี๊ด', 'คุณเล่นได้ดีและส่งบอลให้เพื่อนยิงประตูได้หนึ่งลูก', 'คุณวิ่งเต็มที่แม้บอลไม่ค่อยเข้าทาง ทีมยังสู้ต่อ', 'ลูกยิงของคุณลอยข้ามคานไปไกล คนดูหัวเราะแต่ก็ปรบมือให้') },
  { id: 'basketball', name: 'บาสเกตบอล', kind: 'team', game: 'timing', teamSize: 5, blurb: 'ห้าคนต่อทีม คุณได้โอกาสชู้ตลูกสำคัญในช่วงท้าย',
    spec: (rng, c) => tim(c.d, 'ชู้ตลูกโทษ', [0.22, 0.15], [1.0, 1.5]),
    practice: 'ซ้อมชู้ตและเลี้ยงบอลที่สนามหลังตึก',
    texts: SPORT_TEXTS('ลูกโทษของคุณลงห่วงเสียงดังกริ๊บ สแตนด์ระเบิด', 'คุณชู้ตลงเกือบทุกลูก ทีมนำขึ้นมาอย่างน่าตื่นเต้น', 'ลูกชู้ตเข้าบ้างพลาดบ้าง แต่ทีมช่วยกันอุดได้', 'ลูกชู้ตกระดอนห่วงไปไกลจนต้องวิ่งตามเก็บเอง') },
  { id: 'volleyball', name: 'วอลเลย์บอล', kind: 'team', game: 'track', teamSize: 6, blurb: 'ต้องจับตามองลูกให้ทันทุกจังหวะ เพื่อรับและส่งต่อ',
    spec: (rng, c) => track(rng, c.d),
    practice: 'ซ้อมรับส่งลูกกับเพื่อนที่สนามหน้าหอ',
    texts: SPORT_TEXTS('คุณรับลูกยากได้ทุกครั้งจนทั้งทีมตะโกนชื่อ', 'คุณรับส่งลูกได้ต่อเนื่อง ทีมทำแต้มได้หลายแต้ม', 'คุณเสียแต้มบ้าง แต่เพื่อนช่วยกันปิดจนจบเซต', 'ลูกกระดอนออกนอกสนามบ่อยจนคุณขำตัวเอง') },
  { id: 'takraw', name: 'ตะกร้อ', kind: 'team', game: 'rhythm', teamSize: 3, blurb: 'ตะกร้อสามคนต่อทีม ต้องคุมจังหวะให้ลูกไม่ตก',
    spec: (rng, c) => rhy(rng, c.d, 4, [88, 118], [20, 28], 'เซปักตะกร้อให้ครบจังหวะ'),
    practice: 'ซ้อมเตะตะกร้อวงเล็กใต้ต้นไม้ใหญ่',
    texts: SPORT_TEXTS('คุณเซปักตะกร้อสวยจนคนดูร้องว้าว ทีมได้แต้มติดๆ', 'คุณเตะตะกร้อได้ต่อเนื่อง พลาดเพียงนิดเดียว', 'ลูกตะกร้อตกบ้างแต่ทีมยังประคองได้', 'ลูกตะกร้อกระเด็นไปตกหน้าครูเวร ทุกคนขำจนจอยต้องหยุดชั่วคราว') },
  { id: 'sprint', name: 'วิ่ง 100 เมตร', kind: 'solo', game: 'dash', teamSize: 1, blurb: 'ลงวิ่งเดี่ยวหนึ่งร้อยเมตร ทำเวลาให้ดีที่สุดเพื่อเก็บแต้มให้สี',
    spec: (rng, c) => ({ items: shuffled(rng, ['ออกตัว', 'ก้าวแรก', 'เร่งสปีด', 'แกว่งแขน', 'ก้มตัวเข้าเส้น', 'ทะยานเข้าเส้นชัย', 'ยกมือฉลอง']).map((name, i) => ({ id: `s${i + 1}`, name })), sequenceLen: Math.round(lerp(5, 7, c.d)), timeLimit: Math.round(lerp(20, 14, c.d)) }),
    practice: 'ซ้อมออกตัวและเร่งสปีดรอบสนามกีฬา',
    texts: SPORT_TEXTS('คุณพุ่งเข้าเส้นชัยก่อนคนอื่นจนคนดูตะโกนลั่น', 'คุณวิ่งเข้าเส้นอยู่ในกลุ่มหน้าและทำเวลาส่วนตัวได้ดี', 'คุณวิ่งจนจบโดยไม่หยุด แม้จะเข้าท้ายๆ ก็ภูมิใจ', 'คุณออกตัวช้าไปหนึ่งจังหวะ แต่ยังวิ่งจนครบเส้นทาง') },
  { id: 'relay', name: 'วิ่งผลัด', kind: 'team', game: 'rhythm', teamSize: 4, blurb: 'สี่คนส่งไม้ต่อกัน ต้องส่งจังหวะให้เป๊ะ',
    spec: (rng, c) => rhy(rng, c.d, 3, [100, 125], [18, 24], 'ส่งไม้ผลัดให้ทันจังหวะ'),
    practice: 'ซ้อมส่งไม้ผลัดกับเพื่อนสีเดียวกันจนไม้ไม่ตก',
    texts: SPORT_TEXTS('ไม้ผลัดส่งต่อกันราบรื่นไม่มีสะดุด ทีมเข้าเส้นชัยก่อน', 'การส่งไม้ผลัดทำได้ดี สะดุดเพียงนิดเดียว', 'ไม้ผลัดเกือบตกหนึ่งครั้ง แต่ทีมยังวิ่งต่อได้', 'ไม้ผลัดหลุดมือกลางทางจนต้องวิ่งกลับไปเก็บ คนดูร้องอย่างเอ็นดู') },
  { id: 'tug', name: 'ชักเย่อ', kind: 'team', game: 'timing', teamSize: 8, blurb: 'ออกแรงดึงเชือกพร้อมกันทั้งทีม ต้องจับจังหวะให้ตรงกัน',
    spec: (rng, c) => tim(c.d, 'ออกแรงดึงเชือกพร้อมกัน', [0.3, 0.22], [0.9, 1.4]),
    practice: 'ซ้อมดึงเชือกกับทีมสีจนมือแดง',
    texts: SPORT_TEXTS('ทั้งทีมดึงพร้อมกันจนเชือกพุ่งมาทางสี คุณคือคนที่ตะโกนจังหวะ', 'ทีมดึงเชือกได้นิ่งและชนะสองในสามยก', 'คุณและทีมสู้สุดแรง แพ้ไปนิดเดียว', 'เชือกหลุดมือจนทั้งทีมล้มกองอยู่บนสนามและหัวเราะกันไม่หยุด') },
  { id: 'badminton', name: 'แบดมินตัน', kind: 'solo', game: 'pattern', teamSize: 1, blurb: 'ลงเดี่ยวแบดมินตัน ต้องจำทิศที่ลูกจะมาและตอบโต้ให้ถูก',
    spec: (rng, c) => ({ beads: shuffled(rng, BEAD_COLORS).slice(0, 5), rounds: 4 + Math.round(c.d), startLen: 3, label: 'อ่านทิศลูกขนไก่' }),
    practice: 'ซ้อมตีลูกขนไก่ใต้อาคารกีฬา',
    texts: SPORT_TEXTS('คุณอ่านทิศลูกขนไก่ได้ขาดจนคู่แข่งตามไม่ทัน', 'คุณตีโต้ได้หลายรอบและเก็บแต้มให้สีได้', 'คุณตีสู้ได้พอสมควร แพ้ไปแต่ไม่เสียศูนย์', 'ลูกขนไก่ลอยออกนอกเส้นบ่อยจนคุณต้องหัวเราะตัวเอง') },
  { id: 'stand', name: 'แสตนด์เชียร์', kind: 'mass', game: 'rhythm', teamSize: 0, squad: true, blurb: 'ทั้งสีนั่งแสตนด์พลิกการ์ดเป็นภาพใหญ่ ต้องพลิกให้ตรงจังหวะ',
    spec: (rng, c) => { const st = colorStand(c.color); return rhy(rng, c.d, 3, [76, 100], [20, 28], `แสตนด์สี${colorTh(c.color)}: ${st.name}`); },
    practice: 'ซ้อมพลิกการ์ดแสตนด์พร้อมกันทั้งสีบนอัฒจันทร์',
    texts: SPORT_TEXTS('การ์ดของคุณพลิกตรงจังหวะทุกครั้ง ภาพใหญ่ของสีออกมาเป๊ะจนกรรมการยกมือไหว้', 'คุณพลิกการ์ดได้เกือบทั้งหมด ภาพแสตนด์ออกมาสวย', 'คุณพลิกการ์ดช้าไปสองสามครั้ง ภาพมีรอยโหว่นิดเดียว', 'คุณพลิกผิดจังหวะจนเกิดจุดดำกลางภาพ แต่เพื่อนข้างๆ ช่วยกันกลบ') },
  { id: 'cheer', name: 'เชียร์ลีดเดอร์', kind: 'mass', game: 'rhythm', teamSize: 24, squad: true, blurb: 'ขึ้นลานเชียร์ลีดของสี ต้องเต้นให้ตรงจังหวะและยิ้มตลอดการแสดง',
    spec: (rng, c) => rhy(rng, c.d, 4, [96, 126], [22, 30], `เชียร์ลีดเดอร์สี${colorTh(c.color)}`),
    practice: 'ซ้อมท่าเต้นเชียร์ลีดเดอร์จนเหงื่อซึม',
    texts: SPORT_TEXTS('คุณเต้นตรงจังหวะทุกท่าและยิ้มตลอด กรรมการให้คะแนนเต็มกับทีมของคุณ', 'คุณเต้นได้ดีและพลาดนิดเดียว ทีมได้คะแนนสูง', 'คุณจำท่าได้ครึ่งหนึ่งแต่ยิ้มสู้เต็มที่', 'คุณลืมท่ากลางเพลงแล้วยิ้มกลบ เพื่อนข้างๆ แอบกระซิบบอกท่าให้') },
];
void track;

const SPORT_COMMENTARY = {
  great: ['พิธีกรประกาศเสียงดังว่านี่คือผลงานแห่งปี', 'ผู้ชมทั้งสแตนด์ลุกขึ้นปรบมือโดยไม่ต้องมีใครบอก', 'เพื่อนสีเดียวกันตะโกนชื่อคุณจนเสียงแหบ', 'ครูพละยกนิ้วโป้งให้จากข้างสนาม'],
  good: ['พิธีกรบอกว่าเล่นได้เรียบร้อย ไม่มีอะไรต้องติ', 'เพื่อนในทีมตบไหล่แล้วบอกว่าเยี่ยมมาก', 'เสียงเชียร์จากสีดังขึ้นกว่าเดิมทันที'],
  ok: ['พิธีกรบอกว่าเล่นได้เรื่อยๆ ยังสู้ต่อได้', 'เพื่อนในทีมส่งน้ำให้และบอกว่าไม่เป็นไร', 'ครูเวรบอกว่าที่สำคัญคือได้ลงเล่น'],
  bad: ['พิธีกรพยายามเอ่ยชมให้แต่หัวเราะเองก่อน', 'เพื่อนในทีมหัวเราะแล้วบอกว่าไว้แก้มือรอบหน้า', 'ผู้ชมปรบมือให้กำลังใจดังกว่าตอนเล่นดีเสียอีก', 'ครูพละบอกว่าที่สำคัญคือไม่เจ็บตัว'],
  any: ['ลมแรงจนธงสีปลิวทั้งสนาม', 'ขนมในมือเพื่อนหายไปครึ่งถุงระหว่างดู', 'น้ำแข็งที่ขอจากโรงอาหารละลายหมดก่อนถึงเวลาแข่ง', 'ครูเวรเดินสวนมาพร้อมหมวกสีหลุดหนึ่งใบ', 'เพื่อนต่างสีมาทักทายแล้วแซวเบาๆ ก่อนวิ่งกลับกลุ่ม', 'เสียงเพลงเชียร์ดังข้ามสนามไปถึงหอพัก'],
};

const RIVAL_JOKES = [
  '{name} สีอื่นเดินผ่านมาแล้วแซวว่าสีคุณคงแพ้ ก่อนจะวิ่งหนีไปพร้อมเสียงหัวเราะ',
  '{name} แอบเอาธงสีของตัวเองมาปักบนกระเป๋าคุณเป็นเรื่องล้อเล่น',
  '{name} มาท้าว่ารอบนี้สีของใครจะได้คะแนนมากกว่า แล้วแลกขนมกินกัน',
  '{name} ตะโกนข้ามสนามว่าอย่าลืมปรบมือให้สีเขาด้วย คุณชูนิ้วโป้งตอบกลับ',
  '{name} ส่งข้อความมาว่าวันนี้เป็นคู่แข่งกัน แต่หลังเลิกแข่งจะเลี้ยงน้ำ',
  '{name} ทำท่าเป็นศัตรูคู่อาฆาตอยู่ตั้งนาน แล้วหลุดหัวเราะจนต้องยอมแพ้ก่อน',
];

export const SPORTS = {
  config: {
    term: 1, // PLACEHOLDER
    maxEntries: 2, // cj: up to 2 events (stand counts as one)
    studyDrag: 0.9, // PLACEHOLDER: mirror of E.SPORT_STUDY_DRAG
    closenessPractice: 1.5, // PLACEHOLDER
    closenessDay: 5, // PLACEHOLDER
    playerPointsMax: 10, // PLACEHOLDER
  },
  colors: COLOR_LIST,
  events: SPORT_EVENTS.map((e) => ({ ...e, spec: (rng, ctx = {}) => e.spec(rng, { d: clamp01(ctx.difficulty == null ? 0.5 : ctx.difficulty), color: ctx.color || 'red' }) })),
  byId(id) {
    return SPORTS.events.find((e) => e.id === id) || null;
  },
  playerPoints(score) {
    return Math.round(clamp01(score) * SCHEDULE.sports.playerPointsMax);
  },
  rivalJokes: RIVAL_JOKES,
  rivalJoke(rng, name) {
    return fillName(rng.pick(RIVAL_JOKES), name || 'เพื่อน');
  },
  commentary(rng, ctx = {}) {
    const pool = SPORT_COMMENTARY[ctx.tier] || SPORT_COMMENTARY.any;
    return rng.chance(0.5) ? rng.pick(pool) : rng.pick(SPORT_COMMENTARY.any);
  },
  signup: { title: 'สมัครกีฬาสี', none: { id: 'none', label: 'ไม่ลงเลย', sub: 'ไม่เสียเวลาอ่านหนังสือ แต่ก็ไม่ได้สนิทกับเพื่อนสีเพิ่ม' }, done: { id: 'done', label: 'ยืนยันการสมัคร', sub: 'เริ่มซ้อมหลังเลิกเรียน' } },
  // ctx: { color:'red'.., no?, chosen:[eventIds] }
  signupScene(rng, ctx = {}) {
    const c = COLOR_BY_ID[ctx.color] || COLOR_LIST[0];
    const noPart = ctx.no ? ` (เลขที่ ${ctx.no})` : '';
    const max = SPORTS.config.maxEntries;
    return {
      title: SPORTS.signup.title,
      text: `ใบสมัครกีฬาสีมาแล้ว คุณอยู่สี${c.th}${noPart} เลือกสีเองไม่ได้ เพราะสีไล่ตามเลขที่ ลงแข่งได้ไม่เกิน ${max} รายการ (แสตนด์นับเป็นหนึ่ง) ถ้าลงจะซ้อมหลังเลิกเรียน เวลาอ่านหนังสือลดลง แต่สนิทกับเพื่อนสีเดียวกันมากขึ้น`,
      color: { id: c.id, th: c.th, hex: c.hex },
      options: SPORTS.signupOptions(rng, ctx),
    };
  },
  signupOptions(rng, ctx = {}) {
    const chosen = ctx.chosen || [];
    const full = chosen.length >= SPORTS.config.maxEntries;
    const out = SPORT_EVENTS.map((e) => {
      const picked = chosen.includes(e.id);
      return {
        id: `sport:${e.id}`,
        label: e.name,
        sub: e.blurb,
        selected: picked,
        disabled: !picked && full,
        reason: !picked && full ? `ลงได้ไม่เกิน ${SPORTS.config.maxEntries} รายการ` : '',
      };
    });
    if (chosen.length) out.push({ ...SPORTS.signup.done });
    out.push({ ...SPORTS.signup.none });
    return out;
  },
};

export function sportsResult(sportId, score, ctx = {}, rng = new Rng(1)) {
  const ev = SPORTS.byId(sportId);
  const s = score == null ? 0.6 : clamp01(score);
  const tier = scoreTier(s);
  if (!ev) return { fx: {}, log: 'กีฬาสีผ่านไป', tier, points: 0, closenessGain: 0 };
  const base = ev.kind === 'mass'
    ? { peer: 3 + s * 2, stress: -4 - s * 2, energy: -3, teacherTrust: 0.5, diligence: 0.1 }
    : { peer: 2 + s * 2.5, stress: -3 - s * 2, energy: -4, teacherTrust: 0.4 + s * 0.4, health: 0.3, diligence: 0.1 };
  const colorPart = ctx.color ? `สี${colorTh(ctx.color)}: ` : '';
  const log = `กีฬาสี ${colorPart}${ev.name} ${ev.texts[tier.id]} ${SPORTS.commentary(rng, { tier: tier.id })}`;
  return { fx: cleanFx(base), log, tier, points: SPORTS.playerPoints(s), closenessGain: SCHEDULE.sports.closenessDay };
}

function resolveSport(id, s, tier, ctx, rng) {
  if (id === 'sport_practice') {
    const ev = SPORTS.byId(ctx.sportId);
    return {
      fx: { peer: 1.5, stress: -2, energy: -2, diligence: -0.2, health: 0.2, teacherTrust: 0.1 },
      log: `ซ้อมกีฬาสี: ${ev ? ev.practice : 'ซ้อมกับเพื่อนสีเดียวกัน'} ${rng.chance(0.4) ? SPORTS.rivalJoke(rng, ctx.rival || 'เพื่อนต่างสี') : ''}`.trim(),
      tier,
    };
  }
  const r = sportsResult(id.slice('sport_'.length), s, ctx, rng);
  return { fx: r.fx, log: r.log, tier: r.tier };
}

// ---- colour ranking -------------------------------------------------------------------------------------------------

export function colorRankFx(place) {
  if (place === 1) return cleanFx({ stress: -3, peer: 3, energy: 0, diligence: 0.3 });
  if (place === 2) return cleanFx({ stress: -1.5, peer: 1.5 });
  if (place === 3) return cleanFx({ stress: -0.5, peer: 0.5 });
  return cleanFx({ stress: 0, peer: 0.3 });
}

export function colorRanking(points) {
  const pts = Array.isArray(points) ? Object.fromEntries(COLOR_LIST.map((c, i) => [c.id, points[i]])) : points || {};
  const rows = COLOR_LIST.map((c, i) => ({ id: c.id, th: c.th, hex: c.hex, points: Math.max(0, Math.round(Number(pts[c.id]) || 0)), i }));
  rows.sort((a, b) => b.points - a.points || a.i - b.i);
  let rank = 0;
  let prev = null;
  const ranking = rows.map((r, idx) => {
    if (prev === null || r.points !== prev) rank = idx + 1;
    prev = r.points;
    return { id: r.id, th: r.th, hex: r.hex, points: r.points, rank };
  });
  const top = ranking[0].points;
  const winners = ranking.filter((r) => r.rank === 1);
  const winner = { id: winners[0].id, th: winners[0].th };
  const max = Math.max(1, top);
  const text = winners.length > 1
    ? `กีฬาสีปีนี้สูสีมาก สี${winners.map((w) => w.th).join('และสี')}ได้คะแนนเท่ากัน ${top} คะแนน ขึ้นรับถ้วยร่วมกัน`
    : `กีฬาสีจบลงแล้ว สี${winner.th}ได้คะแนนสูงสุด ${top} คะแนน เสียงเชียร์ดังไปทั้งโรงเรียน ส่วนสีอื่นสัญญาว่าปีหน้าจะแก้มือ`;
  return {
    ranking,
    winner,
    title: 'ผลกีฬาสี',
    text,
    card: { rows: ranking.map((r) => [`อันดับ ${r.rank} สี${r.th}`, `${r.points} คะแนน`]) },
    bars: ranking.map((r) => ({ id: r.id, th: r.th, hex: r.hex, points: r.points, frac: r2(r.points / max) })),
    fx: Object.fromEntries(ranking.map((r) => [r.id, colorRankFx(r.rank)])),
  };
}
function r2(x) {
  return Math.round(x * 100) / 100;
}
