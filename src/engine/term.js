// Term and year bookkeeping: marks for all 720 students, term report, the ม.4 gate, promotion, rooms, dorms, endings.
import { SCHOOL, DROPOUT_PER_96, LEAVE_ELITE_RATE, DORMS } from '../config.js';
import { makeStudent, makeOutsider, yearPerf } from '../cohort.js';
import { gpaByRank, placeRooms, scoreYear, standing, gateProb, roomByRank } from '../rooms.js';
import { assignDorms } from '../dorm.js';
import { clamp, nf, DOW_KEYS } from './util.js';
import { E } from './config.js';
import { calOf, say, gpax, trustAvg } from './player.js';
import { scene, opt } from './pending.js';
import { setupStudent, initCloseness, rebuildIndex, roommates } from './world.js';
import { setupFriends } from './friends.js';
import { subjectOf, creditsFor, clubsFor } from './adapters.js';

const r2 = (x) => Math.round(x * 100) / 100;
const activeIn = (S, g) => S.school.students.filter((s) => s.status === 'active' && s.grade === g);

// subjects of the player's room this term (credits from periods per week) and the elective block
export function setupTermPlayer(G) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const week = S.tt[me.grade].rooms[me.room];
  const count = {};
  const tkOf = {};
  let elec = 0;
  for (const dk of DOW_KEYS) {
    for (const c of week[dk]) {
      if (!c) continue;
      if (c.code) { count[c.code] = (count[c.code] || 0) + 1; tkOf[c.code] = c.tk; } else if (c.act && c.act.startsWith('พก.')) {
        if (!c.group || c.group === 'all' || c.group === pl.elGroup) elec++;
      }
    }
  }
  pl.subj = {};
  for (const [code, n] of Object.entries(count)) {
    const sj = subjectOf(code);
    pl.subj[code] = { code, pw: n, tk: tkOf[code], credits: creditsFor(n), name: sj.th, short: sj.short };
    if (pl.talent[code] === undefined) pl.talent[code] = E.TALENT_SD * G.rng.gauss();
  }
  if (elec) pl.subj.ELEC = { code: 'ELEC', pw: elec, tk: null, credits: creditsFor(elec), name: 'วิชาเลือก (พก.)', short: 'พก.' };
  pl.cls = {};
  pl.satZ = {};
  pl.eN = 0;
  pl.studyZ = 0;
  pl.bonusZ = 0;
  pl.pen = {};
  pl.healthSum = 0;
  pl.sleepSum = 0;
  pl.stressSum = 0;
  pl.nDays = 0;
}

// the player's marks this term, same scale as an NPC's perf (0.6 ability + 0.4 effort + small things + luck)
function playerTermPerf(G) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const zStudy = pl.eN ? pl.studyZ / pl.eN : 0;
  const hAvg = pl.nDays ? pl.healthSum / pl.nDays : 80;
  const sAvg = pl.nDays ? pl.sleepSum / pl.nDays : 8;
  const stAvg = pl.nDays ? pl.stressSum / pl.nDays : 30;
  const body = 0.25 * clamp((hAvg - 70) / 30, -1, 0.5) + 0.25 * clamp((sAvg - 7) / 2, -1, 0.3) - 0.2 * clamp((stAvg - 55) / 30, 0, 1);
  const rows = [];
  let num = 0;
  let den = 0;
  for (const sj of Object.values(pl.subj)) {
    const cl = pl.cls[sj.code];
    const avg = cl && cl[1] ? cl[0] / cl[1] : E.CLASS_BASE;
    const z = E.CLASS_Z * (avg - E.CLASS_BASE) + zStudy + (pl.talent[sj.code] || 0) + body - 0.2 * (pl.pen[sj.code] || 0) + pl.bonusZ + (pl.satZ[sj.code] || 0);
    rows.push({ sj, z });
    num += sj.credits * z;
    den += sj.credits;
  }
  const zMean = den ? num / den : 0;
  const trust = E.TRUST_PERF * ((trustAvg(G) - 50) / 50);
  return { perf: 0.6 * me.ability + 0.4 * zMean + trust + E.TERM_NOISE * G.rng.gauss(), rows, zMean, credits: den };
}

// what went well or badly this term, shown on the next focus pending
function termHint(G, gpa, prev, rank, size) {
  const pl = G.S.pl;
  const n = pl.nDays || 1;
  const h = pl.healthSum / n;
  const sl = pl.sleepSum / n;
  const st = pl.stressSum / n;
  const bits = [`เทอมที่แล้ว เกรด ${gpa.toFixed(2)} อันดับ ${rank} จาก ${size}`];
  if (prev !== null) bits.push(gpa > prev + 0.04 ? 'เกรดดีขึ้นกว่าเทอมก่อน' : gpa < prev - 0.04 ? 'เกรดตกลงจากเทอมก่อน' : 'เกรดใกล้เคียงเทอมก่อน');
  bits.push(`นอนเฉลี่ย ${sl.toFixed(1)} ชั่วโมง`);
  if (sl < 6.8) bits.push('นอนน้อยไป ร่างกายสะสมความเหนื่อย');
  if (h < 60) bits.push('สุขภาพแย่ลง ควรพักหรือออกกำลังกายมากขึ้น');
  else if (h > 85) bits.push('สุขภาพดีตลอดเทอม');
  if (st > 60) bits.push('เครียดสูงมากช่วงที่ผ่านมา');
  else if (st < 35) bits.push('เครียดน้อย ใจสบาย');
  if (pl.caughtCount > 0 && pl.cnt.caught > (pl.cnt.caughtSeen || 0)) { bits.push('มีโดนครูจับกินในคาบ ครูเริ่มไม่ไว้ใจ'); pl.cnt.caughtSeen = pl.cnt.caught; }
  bits.push(`เงินเหลือ ${nf(G.me.money)} บาท`);
  return bits.join(' / ');
}

const gradeStep = (x) => clamp(Math.round(x * 2) / 2, 0, 4);

// end of a term (called on the last Friday): everyone's marks, ranks, the player's report scene
export function closeTerm(G) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const cal = calOf(G);
  const rng = G.rng;
  let mine = null;
  for (let g = 1; g <= 6; g++) {
    const list = activeIn(S, g);
    for (const s of list) {
      let perf;
      if (s.isPlayer) {
        mine = playerTermPerf(G);
        perf = mine.perf;
      } else {
        const idxs = G.roomTk[g][s.room].map((tk) => G.tkIdx[g][tk]);
        let c = 0;
        for (const i of idxs) c += s.close[i];
        c = idxs.length ? c / idxs.length : 50;
        perf = 0.6 * s.ability + 0.4 * (s.nd ? s.acc / s.nd : s.diligence) + E.TRUST_PERF * ((c - 50) / 50) + E.TERM_NOISE * rng.gauss();
      }
      s.pt.push(perf);
      s.acc = 0;
      s.nd = 0;
    }
    const sorted = list.slice().sort((a, b) => b.pt[b.pt.length - 1] - a.pt[a.pt.length - 1]);
    sorted.forEach((s, i) => {
      s.tgpa = gpaByRank(g, i + 1, sorted.length);
      s.trank = i + 1;
    });
  }
  const size = activeIn(S, me.grade).length;
  const credits = mine.credits;
  pl.terms.push({ year: cal.year, term: cal.term, gpa: me.tgpa, credits, rank: me.trank, size });
  pl.lastGpa = me.tgpa;
  pl.lastRank = me.trank;
  pl.lastRankSize = size;
  const rows = [
    ['เกรดเทอมนี้', me.tgpa.toFixed(2)],
    ['อันดับในชั้นปี', `${me.trank} จาก ${size}`],
    ['หน่วยกิตเทอมนี้', String(credits)],
    ['เกรดเฉลี่ยสะสม (GPAX)', r2(gpax(pl)).toFixed(2)],
  ];
  for (const r of mine.rows.sort((a, b) => b.sj.credits - a.sj.credits)) {
    rows.push([r.sj.name, gradeStep(me.tgpa + 0.35 * (r.z - mine.zMean)).toFixed(1)]);
  }
  let yearNote = '';
  if (cal.term === 2) {
    for (let g = 1; g <= 6; g++) {
      const list = activeIn(S, g);
      for (const s of list) {
        s.perf = s.pt.reduce((a, b) => a + b, 0) / Math.max(1, s.pt.length);
      }
      scoreYear(list, g);
      for (const s of list) s.pt = [];
    }
    pl.lastGpa = me.gpa;
    pl.lastRank = me.rank;
    pl.lastRankSize = size;
    pl.path.push(`ม.${me.grade}/${me.room}`);
    rows.push(['เกรดรวมของปีนี้', me.gpa.toFixed(2)]);
    rows.push(['อันดับรวมของปีนี้', `${me.rank} จาก ${size}`]);
    yearNote = ' ห้องเรียนปีหน้าจะจัดใหม่ตามเกรดรวมของปีนี้';
  }
  S.yearPending = cal.term === 2;
  const prev = pl.terms.length > 1 ? pl.terms[pl.terms.length - 2].gpa : null;
  say(G, `ผลเทอม ${cal.term} ม.${me.grade}: เกรด ${me.tgpa.toFixed(2)} อันดับ ${me.trank} จาก ${size}`, me.tgpa >= 3.9 ? 'good' : me.tgpa < 3.6 ? 'bad' : 'neutral');
  pl.hint = termHint(G, me.tgpa, prev, me.trank, size);
  return scene(G, {
    tag: 'report',
    title: cal.term === 2 ? `สรุปผลปีการศึกษา ม.${me.grade}` : `ผลสอบเทอม ${cal.term} ม.${me.grade}`,
    text: `ผลออกแล้ว${yearNote}`,
    card: rows,
    options: [opt('next', 'ไปต่อ')],
  });
}

// ---------------- the ม.4 gate and endings ----------------
export function gateScene(G) {
  const S = G.S;
  const me = G.me;
  const elite = roomByRank(3, me.rank, activeIn(S, 3).length) <= 2;
  S.gate = { pass: G.rng.chance(gateProb(me.gpa)), elite };
  G.S.pl.gatePassed = S.gate.pass;
  const options = [opt('exam', 'สอบเข้า ม.4 ที่นี่', `เกรดปีนี้ ${me.gpa.toFixed(2)}`)];
  if (elite) {
    options.push(opt('mwit', 'ลาไปเรียนต่อที่ MWIT', 'ถือเป็นแบดเอนดิ้ง', 'bad'));
    options.push(opt('kvis', 'ลาไปเรียนต่อที่ KVIS', 'ถือเป็นแบดเอนดิ้ง', 'bad'));
    options.push(opt('wmw', 'ลาไปเรียนต่อ วมว. (ห้องเรียนวิทยาศาสตร์ของมหาวิทยาลัย)', 'ถือเป็นแบดเอนดิ้ง', 'bad'));
  }
  return scene(G, {
    tag: 'gate1', title: 'ประตู ม.4',
    text: `ม.4 รับ ${SCHOOL.seats4} คนจากทุกที่ ไม่มีที่นั่งสำรอง เด็กนอกก็มาสอบแย่งด้วย${elite ? ' เราอยู่ระดับห้อง 1-2 จึงมีทางเลือกไปโรงเรียนอื่นด้วย' : ''}`,
    options,
  });
}

export function gateResultScene(G) {
  const me = G.me;
  if (G.S.gate.pass) {
    return scene(G, { tag: 'gate2', title: 'ประกาศผล ม.4', text: 'ชื่อเราอยู่ในรายชื่อ! ได้ขึ้น ม.4 ที่เดิม', card: [['เกรด ม.3', me.gpa.toFixed(2)]], options: [opt('next', 'ไปต่อ', null, 'good')] });
  }
  return scene(G, {
    tag: 'gate3', title: 'ประกาศผล ม.4',
    text: 'ไม่มีชื่อเราในรายชื่อ "เด็กสอบไม่ติด = ตายในนี้" ต้องตัดสินใจว่าจะทำอย่างไรต่อ',
    card: [['เกรด ม.3', me.gpa.toFixed(2)]],
    options: [opt('smurf', 'เรียนต่อ: ไป smurf ที่โรงเรียนใกล้บ้าน'), opt('stop', 'หยุดเรียน', null, 'bad')],
  });
}

const ENDINGS = {
  graduated: { title: 'จบแล้วพอเลย', text: 'จบ ม.6 ครบหกปี ใส่ชุดครุยถ่ายรูปกับเพื่อนแล้วเดินออกประตูโรงเรียน' },
  quit: { title: 'ลาออก', text: `เราตัดสินใจลาออกจากโรงเรียน ต้องจ่ายค่าธรรมเนียม ${nf(E.QUIT_FEE_PER_TERM)} บาทต่อเทอม (ปีละ ${nf(E.QUIT_FEE_PER_TERM * 2)} บาท) ตามที่ตกลงกันไว้` },
  failed_gate_smurf: { title: 'ไป smurf ที่โรงเรียนใกล้บ้าน', text: 'สอบ ม.4 ไม่ติด แต่ไม่ยอมแพ้ ย้ายไปเรียนต่อที่โรงเรียนใกล้บ้าน เรื่องของเราที่นี่จบแล้ว แต่เรื่องใหม่เพิ่งเริ่ม' },
  failed_gate_stop: { title: 'หยุดเรียน', text: 'สอบ ม.4 ไม่ติด และเลือกที่จะหยุดเรียน ชีวิตที่โรงเรียนจบลงตรงนี้' },
  left_elite: { title: 'ลาไปโรงเรียนอื่น', text: 'เราเลือกไปเรียนต่อที่อื่นทั้งที่ยังเรียนอยู่ห้องหัวแถว ถือเป็นแบดเอนดิ้งของเรื่องนี้' },
};

export function endGame(G, kind, extra = '') {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const e = ENDINGS[kind];
  S.ending = kind;
  me.status = { graduated: 'graduated', quit: 'dropped', failed_gate_smurf: 'failed_gate', failed_gate_stop: 'failed_gate', left_elite: 'left_elite' }[kind];
  const gx = gpax(pl);
  const card = [
    ['จบแบบไหน', e.title],
    ['เกรดเฉลี่ยสะสม (GPAX)', gx !== null ? r2(gx).toFixed(2) : '-'],
    ['ห้องที่ผ่านมา', pl.path.join(' > ') || `ม.${me.grade}/${me.room}`],
    ['เทอมที่เรียน', String(pl.terms.length)],
    ['เงินที่เหลือ', `${nf(me.money)} บาท`],
  ];
  if (kind === 'graduated') card.push(['อันดับรวมปี ม.6', `${pl.lastRank} จาก ${pl.lastRankSize}`]);
  S.phase = 'ended';
  S.queue.push(scene(G, { tag: 'final', title: e.title, text: e.text + extra, card, options: [], final: true }));
  S.ending = kind;
}

// ---------------- promotion (same logic as src/sim.js yearStep, with marks from the day-by-day run) ----------------
export function promoteAll(G) {
  const S = G.S;
  const school = S.school;
  const rng = G.rng;
  const me = G.me;
  // rare NPC dropouts
  for (const s of school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    if (rng.chance(DROPOUT_PER_96[s.grade] / 96)) s.status = 'dropped';
  }
  // the ม.4 gate for the others (the player already passed)
  const passers = [];
  for (const s of activeIn(S, 3)) {
    if (s.isPlayer) { passers.push(s); continue; }
    if (s.gpa >= 4 && rng.chance(LEAVE_ELITE_RATE)) { s.status = 'left_elite'; continue; }
    if (rng.chance(gateProb(s.gpa))) passers.push(s);
    else s.status = 'failed_gate';
  }
  const moves = [];
  for (const s of school.students) {
    if (s.status !== 'active' || s.grade === 3) continue;
    if (s.grade === 6) s.status = 'graduated';
    else moves.push([s, s.grade + 1]);
  }
  for (const s of passers) moves.push([s, 4]);
  for (const [s, g] of moves) s.grade = g;
  // outsiders fill ม.4 up to 144
  const seats = Math.max(0, SCHOOL.seats4 - passers.length);
  for (let i = 0; i < seats; i++) {
    const o = makeOutsider(rng, school);
    o.perf = yearPerf(rng, o);
    school.students.push(o);
    setupStudent(G, o);
  }
  // new ม.1 intake, rooms by prior results
  const intake = [];
  for (let i = 0; i < SCHOOL.roomsPerGrade[1] * SCHOOL.roomSize; i++) {
    const s = makeStudent(rng, school, 1);
    s.perf = yearPerf(rng, s);
    intake.push(s);
    school.students.push(s);
    setupStudent(G, s);
  }
  placeRooms(intake, 1, (s) => s.ability);
  for (const s of intake) s.gpa = null;
  for (const g of [2, 3, 4, 5, 6]) placeRooms(activeIn(S, g), g, standing);
  // forget everyone who left; new dorms and roommates
  school.students = school.students.filter((s) => s.status === 'active');
  school.dorms = assignDorms(school);
  school.year += 1;
  rebuildIndex(G);
  for (const s of school.students) {
    initCloseness(G, s);
    s.pt = [];
    s.acc = 0;
    s.nd = 0;
    s.club = null;
  }
  // the player's new year
  const pl = S.pl;
  setupFriends(G, false);
  pl.talent = {};
  pl.clubId = null;
  pl.electiveId = null;
  S.gate = null;
  S.yearPending = false;
  S.tasks = [];
  S.npcOrders = [];
  S.forced = {};
  for (const T of Object.values(S.ts)) { T.p = 0; T.miss = {}; }
}

export function newYearScene(G) {
  const me = G.me;
  const mates = roommates(G, me);
  const d = DORMS[me.dorm];
  return scene(G, {
    tag: 'newyear', title: `ขึ้นชั้น ม.${me.grade}`,
    text: 'ห้องเรียนจัดใหม่ตามเกรดปีที่แล้ว หอพักและเพื่อนร่วมห้องนอนก็ย้ายใหม่',
    card: [
      ['ชั้น/ห้อง', `ม.${me.grade}/${me.room}`],
      ['หอพัก', `${d.name} ห้อง ${me.dormRoom}`],
      ['เพื่อนร่วมห้องนอน', mates.map((m) => m.name).join(', ')],
      ['เกรดปีที่แล้ว', me.gpa !== null ? me.gpa.toFixed(2) : '-'],
    ],
    options: [opt('next', 'เริ่มเทอมใหม่')],
  });
}


export { clubsFor };
