// The calendar of special days (docs/CONTRACT3.md section 3): freshers, Saturday lessons, hall sessions, the Loy Krathong
// fair, the night show, lab and club-craft plays. The plan of a term is a pure function of (seed, term, the player's
// room, club and Saturday group), built with its own Rng, so it never touches the game's Rng and can be asked for from
// view(). It is cached on G (not saved) and rebuilt after a load.
import { Rng } from '../rng.js';
import { E } from './config.js';
import { calOf } from './player.js';
import { cellAt } from './world.js';
import { subjectOf, ACT } from './adapters.js';

const SCI = new Set(['physics', 'chemistry', 'biology', 'earth', 'science']);
const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
const hash = (a, b) => (Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 1) | 0, 0xc2b2ae35)) >>> 0;

export const termFirstDay = (cal) => cal.day - ((cal.cycleInTerm - 1) * 14 + cal.dayInCycle - 1);
const dayOf = (first, cycle, dic) => first + (cycle - 1) * 14 + dic - 1;
const dowOf = (dic) => ((dic - 1) % 7) + 1;

export function farewellTerm(G, year) {
  return new Rng(hash(G.S.seed, year + 999)).int(1, 2);
}

// the science subject of Saturday group `gid` of this grade: index of the first period of a science kind, or -1
export function satScienceIndex(grade, gid) {
  const g = ACT.SATURDAY && ACT.SATURDAY[grade];
  const grp = g && g.groups && g.groups[gid];
  if (!grp) return -1;
  return grp.subjects.findIndex((s) => SCI.has(s.kind));
}

function buildPlan(G, cal, key, sig) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const A = E.ACT;
  const rng = new Rng(hash(S.seed, key));
  const first = termFirstDay(cal);
  const fresherYear = cal.term === 1 && A.FRESHER_YEARS.includes(cal.year);
  const plan = { sig, key, first, term: cal.term, year: cal.year, hall: {}, fill: {}, playDays: {}, fair: 0, show: null, fresher: fresherYear, fresh: null };

  // all school days of the term: { day, c (cycle in term), dic, dow }
  const days = [];
  for (let c = 1; c <= E.TERM_CYCLES; c++) for (const dic of [1, 2, 3, 4, 5, 8, 9, 10, 11, 12]) days.push({ day: dayOf(first, c, dic), c, dic, dow: dowOf(dic) });
  const examDay = (x) => (x.c === E.MIDTERM_CYCLE || x.c === E.TERM_CYCLES) && x.dic >= 8;
  const plain = (x) => !examDay(x) && !(fresherYear && x.c === 1 && x.dic <= 3) && !(x.c === E.TERM_CYCLES && x.dic === 12) && !(x.c === E.MIDTERM_CYCLE && x.dic === 1) && x.dic !== 12;
  const taken = new Set();

  // fixed festival days
  if (cal.term === 1) {
    // colour sports day (CONTRACT3 section 12): sign-up, practice after school, Friday parade and the Saturday finals
    const sc = A.SPORT;
    const prac = days.filter((x) => (x.c === sc.PRACTICE_CYCLES[0] || x.c === sc.PRACTICE_CYCLES[1]) && x.dow !== 2);
    const pick = rng.shuffle(prac.slice()).slice(0, sc.PRACTICE_BLOCKS).map((x) => x.day).sort((a, b) => a - b);
    plan.sport = { signup: dayOf(first, sc.SIGNUP_CYCLE, 2), practice: pick, fri: dayOf(first, sc.DAY_CYCLE, 5), sat: dayOf(first, sc.DAY_CYCLE, 6) };
    for (const d of pick) taken.add(d);
    taken.add(plan.sport.signup); taken.add(plan.sport.fri);
    plan.playDays[plan.sport.sat] = 1;
  }
  if (cal.term === 2) {
    plan.fair = dayOf(first, A.FAIR_CYCLE, 6); // cj calendar fix: the fair is on the dorm Saturday of term 2, cycle 2
    plan.xmas = dayOf(first, A.XMAS_CYCLE, A.XMAS_DIC);
    plan.show = { role: dayOf(first, 3, 6), rehearsal: [4, 5, 6, 7].map((c) => dayOf(first, c, 6)), night: dayOf(first, 8, 6) };
  }
  if (plan.xmas) { taken.add(plan.xmas); plan.playDays[plan.xmas] = 1; }
  if (fresherYear) {
    const flat = [];
    const F = ACT.FRESHER && ACT.FRESHER.days;
    if (F) F.forEach((d, di) => d.blocks.forEach((b, bi) => { if (b.play) flat.push(di * 3 + bi); }));
    const pick = new Set(rng.shuffle(flat.slice()).slice(0, A.FRESHER_PLAYS));
    plan.fresh = Array.from({ length: 9 }, (_, i) => pick.has(i));
  }

  // the filler lists: lab periods and club blocks of the player's timetable
  const labs = {}; // dow -> [p]
  const clubs = {}; // dow -> [p]
  const week = S.tt[me.grade].rooms[me.room];
  for (let dow = 1; dow <= 5; dow++) {
    for (let p = 1; p <= 8; p++) {
      const c = cellAt(G, me.grade, me.room, dow, p);
      if (!c) continue;
      if (c.code && SCI.has(subjectOf(c.code).kind)) (labs[dow] ||= []).push(p);
      if (c.act === 'ชุมนุม' && pl.clubId) (clubs[dow] ||= []).push(p);
    }
  }
  void week;

  // how many plays go in this term
  const target = E.MINIGAMES_PER_YEAR / 2;
  const farewell = farewellTerm(G, cal.year) === cal.term;
  let others = A.SPECIALS_PER_TERM + (farewell ? A.FAREWELL_PER_YEAR : 0) + A.AWARD_EXPECTED;
  if (cal.term === 2) others += A.FAIR_PLAYS + A.SHOW_PLAYS + A.XMAS_PLAYS;
  if (fresherYear) others += A.FRESHER_PLAYS;
  const room = target - others; // what is left for lectures and lab / club crafts
  const lo = A.LECTURES_PER_TERM[0];
  const hi = A.LECTURES_PER_TERM[1];
  let nLect = Math.floor(clampN(room - 1.0, lo - 1, hi)) + (rng.chance(A.LECTURE_THREE_CHANCE) ? 1 : 0);
  nLect = Math.max(1, Math.min(hi, nLect));
  const fixed = others + nLect;
  const want = Math.max(0, target - fixed);
  let nFill = Math.floor(want) + (rng.chance(want - Math.floor(want)) ? 1 : 0);
  nFill = Math.min(nFill, 6);

  const items = [];
  for (let i = 0; i < nLect; i++) items.push('lecture');
  for (let i = 0; i < A.SPECIALS_PER_TERM; i++) items.push('special');
  if (farewell) items.push('farewell');
  const fillKinds = [];
  for (let i = 0; i < nFill; i++) fillKinds.push(i % 2 === 0 ? 'lab' : 'club');
  rng.shuffle(fillKinds);
  for (const f of fillKinds) items.push(f);
  rng.shuffle(items);

  // Saturdays that can hold a filler play: the player's group has a science period (lab), or the chill club (craft)
  const satDays = [];
  for (let c = 1; c <= E.TERM_CYCLES; c++) {
    const d = dayOf(first, c, 6);
    if (d === plan.fair || (plan.sport && d === plan.sport.sat)) continue;
    if (plan.show && (plan.show.night === d || plan.show.rehearsal.includes(d) || plan.show.role === d)) continue;
    satDays.push({ day: d, c });
  }
  let satFill = null;
  if (pl.satGroup === 'club' && pl.clubId) satFill = { game: 'club', i: 2 };
  else if (pl.satGroup) {
    const i = satScienceIndex(me.grade, pl.satGroup);
    if (i >= 0) satFill = { game: 'lab', i };
  }

  const n = items.length;
  items.forEach((type, idx) => {
    const c0 = Math.floor((idx * E.TERM_CYCLES) / n) + 1;
    const c1 = Math.max(c0, Math.floor(((idx + 1) * E.TERM_CYCLES) / n));
    const band = (x) => x.c >= c0 && x.c <= c1;
    let cand;
    let fill = null;
    if (type === 'lecture' || type === 'special' || type === 'farewell') {
      cand = days.filter((x) => band(x) && plain(x) && x.dow !== 2 && !taken.has(x.day));
    } else if (type === 'lab') {
      cand = days.filter((x) => band(x) && plain(x) && labs[x.dow] && x.dow !== 2 && !taken.has(x.day));
      fill = (x) => ({ game: 'lab', where: 'p', p: labs[x.dow][rng.int(0, labs[x.dow].length - 1)] });
    } else {
      cand = days.filter((x) => band(x) && plain(x) && clubs[x.dow] && !taken.has(x.day));
      fill = (x) => ({ game: 'club', where: 'p', p: clubs[x.dow][0] });
    }
    if ((type === 'lab' || type === 'club') && satFill && satFill.game === type && rng.chance(A.SATURDAY_FILLER_SHARE)) {
      const sc = satDays.filter((x) => band(x) && !taken.has(x.day));
      if (sc.length) {
        const pick = sc[rng.int(0, sc.length - 1)];
        taken.add(pick.day);
        plan.fill[pick.day] = { game: type, where: 'sat', i: satFill.i };
        plan.playDays[pick.day] = 1;
        return;
      }
    }
    if (!cand.length) cand = days.filter((x) => plain(x) && x.dow !== 2 && !taken.has(x.day) && (type === 'lab' ? labs[x.dow] : type === 'club' ? clubs[x.dow] : true));
    if (!cand.length) return;
    const pick = cand[rng.int(0, cand.length - 1)];
    taken.add(pick.day);
    plan.playDays[pick.day] = 1;
    if (fill) plan.fill[pick.day] = fill(pick);
    else plan.hall[pick.day] = type;
  });
  if (plan.fair) plan.playDays[plan.fair] = 1;
  if (plan.show) {
    plan.playDays[plan.show.night] = 1;
    for (const d of plan.show.rehearsal) plan.playDays[d] = 1;
  }
  return plan;
}

export function getPlan(G) {
  const cal = calOf(G);
  const key = cal.year * 2 + cal.term;
  const pl = G.S.pl;
  const sig = `${key}|${G.me.grade}/${G.me.room}|${pl.clubId}|${pl.satGroup}`;
  if (!G.plan || G.plan.sig !== sig) G.plan = buildPlan(G, cal, key, sig);
  return G.plan;
}

// what is special about the current day (S.day)
export function dayKind(G) {
  const cal = calOf(G);
  const k = {};
  if (cal.home || cal.suspended) return k;
  const plan = getPlan(G);
  const d = G.S.day;
  if (cal.dayInCycle === 6) {
    if (plan.fair === d) k.fair = true;
    else if (plan.sport && plan.sport.sat === d) k.sportSat = true;
    else k.sat = true;
    const sh = plan.show;
    if (sh) {
      const role = G.S.pl.showRole;
      if (sh.role === d) k.rolepick = true;
      if (sh.rehearsal.includes(d) && role && role !== 'none') k.rehearsal = sh.rehearsal.indexOf(d) + 1;
      if (sh.night === d) k.show = true;
    }
    if (plan.fill[d]) k.fill = plan.fill[d];
  } else if (cal.dayInCycle === 7) {
    // Sunday: nothing special
  } else {
    if (plan.fresher && cal.cycleInTerm === 1 && cal.dayInCycle <= 3) k.fresher = cal.dayInCycle;
    if (plan.xmas === d) k.xmas = true;
    if (plan.sport) { if (plan.sport.fri === d) k.sportFri = true; if (plan.sport.practice.includes(d)) k.sportPractice = true; if (plan.sport.signup === d) k.sportSignup = true; }
    if (plan.hall[d]) k.hall = plan.hall[d];
    if (plan.fill[d]) k.fill = plan.fill[d];
  }
  return k;
}

export const morningPeriods = (G) => { const k = dayKind(G); return k.fresher || k.xmas ? [] : [1, 2, 3, 4]; };
export const afternoonPeriods = (G) => { const k = dayKind(G); return k.fresher || k.sportFri ? [] : k.hall ? [5, 6] : k.xmas ? (G.S.xmasInf ? [] : [7, 8]) : [5, 6, 7, 8]; };
