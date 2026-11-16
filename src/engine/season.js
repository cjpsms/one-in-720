// Epidemics, exam rules, colours of the sports day (CONTRACT3 sections 11-12). Pure helpers and the daily updates;
// the acts that need pendings (Christmas, sports days) live in festival.js.
import { Rng } from '../rng.js';
import { DORMS } from '../config.js';
import { E } from './config.js';
import { clamp, calendar, seasonOf } from './util.js';
import { ACT } from './adapters.js';
import { calOf, say } from './player.js';
import { roommates } from './world.js';
import { scene, opt } from './pending.js';

const hash = (a, b) => (Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 1) | 0, 0xc2b2ae35)) >>> 0;
const YEAR_DAYS = E.TERM_CYCLES * 2 * 14;

// ---------------------------------------------------------------- colours (กีฬาสี)
// student number = position in the room's list sorted by id (stable), recomputed every year; 1 red, 2 yellow, 3 purple, 4 blue, 5 red ...
export function colorMap(G) {
  const S = G.S;
  const key = `${S.school.year}|${S.school.students.length}`;
  if (G.colorKey === key && G.colorByStudent) return G.colorByStudent;
  const m = new Map();
  for (let g = 1; g <= 6; g++) {
    for (const room of Object.keys(G.rooms[g])) {
      G.rooms[g][room].slice().sort((a, b) => a.id - b.id).forEach((s, i) => m.set(s.id, { no: i + 1, ...ACT.colorOf(i + 1) }));
    }
  }
  G.colorKey = key;
  G.colorByStudent = m;
  return m;
}
export const colorOfStudent = (G, s) => colorMap(G).get(s.id) || { no: 1, ...ACT.colorOf(1) };
export const playerColor = (G) => { const c = colorOfStudent(G, G.me); return { id: c.id, th: c.th, no: c.no }; };

// ---------------------------------------------------------------- epidemics
export function epiPlan(G, year) {
  G.epiPlans ||= {};
  if (G.epiPlans[year]) return G.epiPlans[year];
  const rng = new Rng(hash(G.S.seed, 31000 + year));
  const P = E.EPI.P_COUNT;
  const r = rng.float();
  const n = r < P[0] ? 0 : r < P[0] + P[1] ? 1 : 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = (year - 1) * YEAR_DAYS + rng.int(8, YEAR_DAYS - 10);
    const cal = calendar(day, E.TERM_CYCLES);
    if (!cal.schoolDay) { i--; continue; }
    const d = ACT.pickEpidemic(rng, seasonOf(cal));
    out.push({ day, id: d.id });
  }
  out.sort((a, b) => a.day - b.day);
  G.epiPlans[year] = out;
  return out;
}

export const isSuspended = (S, day) => !!(S.epi && S.epi.susp && day >= S.epi.susp.from && day <= S.epi.susp.to);

export function examOf(cal) {
  const c = cal.cycleInTerm;
  if ((c === E.MIDTERM_CYCLE || c === E.TERM_CYCLES) && cal.dayInCycle >= 10 && cal.dayInCycle <= 12) return { kind: c === E.MIDTERM_CYCLE ? 'mid' : 'final', i: cal.dayInCycle - 9 };
  return null;
}
const examWindowSoon = (cal) => { const c = cal.cycleInTerm; return (c === E.MIDTERM_CYCLE || c === E.TERM_CYCLES) && cal.dayInCycle >= 7; };

// called at the start of each day (before the day's calendar is read)
export function epiDay(G) {
  const S = G.S;
  const pl = S.pl;
  const e = S.epi;
  const cal0 = calendar(S.day, E.TERM_CYCLES);
  const rng = G.rng;
  const stu = S.school.students;
  // track the last sick day of every student (exam rules)
  for (const s of stu) if (s.status === 'active' && !s.isPlayer && (s.abs || s.sick > 0)) s.lastSick = S.day - 1;
  if (!E.EPIDEMIC) return null;
  if (e.susp && S.day > e.susp.to) { e.susp = null; }
  if (!e.cur) {
    const hit = epiPlan(G, cal0.year).find((x) => x.day === S.day);
    if (hit) {
      const d = ACT.epidemicById(hit.id);
      e.n = (e.n || 0) + 1;
      e.cur = { id: hit.id, start: S.day, n: e.n, noticed: false };
      const act = stu.filter((s) => s.status === 'active' && !s.isPlayer);
      for (let i = 0; i < E.EPI.SEED_SICK; i++) { const s = act[rng.int(0, act.length - 1)]; s.sick = rng.int(d.sickDays[0], d.sickDays[1]); s.epiImm = e.n; }
    }
  }
  if (!e.cur) { e.share = 0; return null; }
  const d = ACT.epidemicById(e.cur.id);
  // counts per dorm room and per class room
  const dormN = {}; const dormS = {}; const clsN = {}; const clsS = {};
  let sickN = 0; let n = 0;
  for (const s of stu) {
    if (s.status !== 'active') continue;
    n++;
    const sk = s.isPlayer ? (pl.ill && pl.ill.days > 0 ? 1 : 0) : (s.sick > 0 ? 1 : 0);
    const dk = `${s.dorm}:${s.dormRoom}`; const ck = `${s.grade}:${s.room}`;
    dormN[dk] = (dormN[dk] || 0) + 1; clsN[ck] = (clsN[ck] || 0) + 1;
    if (sk) { sickN++; dormS[dk] = (dormS[dk] || 0) + 1; clsS[ck] = (clsS[ck] || 0) + 1; }
  }
  const share = sickN / Math.max(1, n);
  const susp = isSuspended(S, S.day);
  const k = E.EPI.SPREAD * d.R;
  for (const s of stu) {
    if (s.status !== 'active' || s.isPlayer || s.sick > 0 || s.epiImm === e.n) continue;
    const dk = `${s.dorm}:${s.dormRoom}`; const ck = `${s.grade}:${s.room}`;
    const ds = (dormS[dk] || 0) / dormN[dk]; const cs = susp ? 0 : (clsS[ck] || 0) / clsN[ck];
    const p = k * (0.55 * ds + 0.3 * cs + (susp ? 0.02 : 0.15) * share) + 0.0008;
    if (rng.float() < p) { s.sick = rng.int(d.sickDays[0], d.sickDays[1]); s.epiImm = e.n; }
  }
  // the player
  let scn = null;
  if (!pl.ill && pl.epiImm !== e.n) {
    const mates = roommates(G, G.me);
    const ms = mates.length ? mates.filter((m) => m.sick > 0).length / mates.length : 0;
    const ck = `${G.me.grade}:${G.me.room}`;
    const cs = susp ? 0 : (clsS[ck] || 0) / Math.max(1, clsN[ck]);
    let pp = E.EPI.PLAYER_BASE * d.R * (0.05 + 1.0 * ms + 0.6 * cs + 0.8 * share) * (1 + Math.max(0, 60 - pl.health) / 60) * (1 + Math.max(0, 7 - pl.sleepHours) * 0.1);
    if (pl.partner) pp *= 1.1;
    if (rng.float() < Math.min(0.5, pp)) {
      pl.ill = { days: rng.int(d.sickDays[0], d.sickDays[1]), place: null, id: d.id, fresh: true };
      pl.epiImm = e.n;
      pl.epiNew = true;
    }
  }
  e.share = Math.round(share * 1000) / 1000;
  e.lastName = d.name;
  // suspension when too many are sick
  if (!susp && share >= E.EPI.SUSPEND_SHARE && cal0.schoolDay && !examWindowSoon(cal0) && !cal0.lastSchoolDay) {
    const want = rng.int(E.EPI.SUSPEND_DAYS[0], E.EPI.SUSPEND_DAYS[1]);
    let to = S.day - 1;
    let cnt = 0;
    for (let x = S.day; x < S.day + 14 && cnt < want; x++) {
      const c = calendar(x, E.TERM_CYCLES);
      if (c.home) break;
      if (c.schoolDay) {
        if (c.lastSchoolDay || examOf(c) || examWindowSoon(c)) break;
        cnt++;
      }
      to = x;
    }
    if (cnt > 0) {
      e.susp = { from: S.day, to };
      S.dayB = null; // today's plan changes
      scn = scene(G, { tag: 'epi_notice', ...notice('suspend', d, share, cnt) });
      e.cur.suspended = (e.cur.suspended || 0) + cnt;
    }
  }
  if (e.cur && S.day > e.cur.start + 5 && share < E.EPI.END_SHARE) {
    say(G, `โรคระบาด ${d.name} สงบลงแล้ว`, 'neutral', true);
    e.history.push({ id: e.cur.id, start: e.cur.start, end: S.day, suspended: e.cur.suspended || 0 });
    e.cur = null;
  }
  return scn;
}

function notice(kind, d, share, days) {
  const sc = ACT.epidemicScene(kind, d, { share, days }, new Rng(hash(d.R * 100, days)));
  return { title: sc.title, text: sc.text, options: sc.options.map((o) => opt(o.id, o.label, o.sub)), data: null };
}

export function epidemicNoticeScene(G, d, share) {
  return scene(G, { tag: 'epi_notice', ...notice('outbreak', d, share, 0) });
}

export function illScene(G) {
  const pl = G.S.pl;
  const d = ACT.epidemicById(pl.ill.id);
  const sc = ACT.epidemicScene('ill', d, { share: G.S.epi.share, canGoHome: true }, G.rng);
  return scene(G, { tag: 'epi_ill', title: sc.title, text: sc.text, options: sc.options.map((o) => { const x = opt(o.id, o.label, o.sub, o.tone); if (o.disabled) x.disabled = true; return x; }) });
}

export function epidemicView(G) {
  const e = G.S.epi;
  if (!E.EPIDEMIC || !e || !e.cur) return null;
  return { name: e.lastName || '', sickShare: e.share || 0, suspended: isSuspended(G.S, G.S.day) };
}

// ---------------------------------------------------------------- exam rules
// returns the notice scene (missed exam) or null; adds to pl.examLoss and every NPC's s.examLoss
export function examDay(G) {
  const S = G.S;
  const pl = S.pl;
  const cal = calOf(G);
  const ex = examOf(cal);
  if (!ex) return null;
  const w = 1 / 3;
  const sickNow = pl.sick > 0 || (pl.ill && pl.ill.days > 0);
  // NPC students follow the same rules
  for (const s of S.school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    if (s.sick > 0 || s.abs) s.examLoss = (s.examLoss || 0) + w * (1 - E.MISSED_EXAM_CREDIT);
    else if (s.lastSick !== undefined && S.day - s.lastSick <= 3 && S.day - s.lastSick >= 1) s.examLoss = (s.examLoss || 0) + w * E.SICK_BEFORE_EXAM_PENALTY * ((4 - (S.day - s.lastSick)) / 3);
  }
  const name = ex.kind === 'mid' ? 'mid' : 'final';
  if (sickNow) {
    pl.examLoss = (pl.examLoss || 0) + w * (1 - E.MISSED_EXAM_CREDIT);
    const m = ACT.EXAM_SICK.missed(G.rng, { exam: name });
    pl.examNotes.push(m.reportLine);
    say(G, m.record, 'bad');
    return scene(G, { tag: 'exam_notice', title: m.title, text: m.text, options: m.options.map((o) => opt(o.id, o.label, o.sub)) });
  }
  const last = (pl.sickLog || []).filter((d) => S.day - d >= 1 && S.day - d <= 3).sort((a, b) => b - a)[0];
  if (last !== undefined) {
    const d = S.day - last;
    const m = ACT.EXAM_SICK.penalty(G.rng, { exam: name, daysBefore: d });
    pl.examLoss = (pl.examLoss || 0) + w * E.SICK_BEFORE_EXAM_PENALTY * ((4 - d) / 3);
    pl.examNotes.push(m.reportLine);
    say(G, m.record, 'bad');
  }
  return null;
}

export const logSick = (G) => { const pl = G.S.pl; pl.sickLog = (pl.sickLog || []).slice(-6); pl.sickLog.push(G.S.day); pl.sickDaysTotal = (pl.sickDaysTotal || 0) + 1; };

// ---------------------------------------------------------------- sports day points
export function sportsRankingFor(G, playerPoints) {
  const rng = new Rng(hash(G.S.seed, 41000 + calOf(G).year));
  const evs = ACT.SPORTS.events;
  const pts = { red: 0, yellow: 0, purple: 0, blue: 0 };
  const byColor = { red: [], yellow: [], purple: [], blue: [] };
  const cm = colorMap(G);
  for (const s of G.S.school.students) if (s.status === 'active' && !s.isPlayer) byColor[cm.get(s.id).id].push(s.ability);
  for (const c of Object.keys(pts)) {
    const abil = byColor[c];
    const avg = abil.length ? abil.reduce((a, b) => a + b, 0) / abil.length : 0;
    for (let i = 0; i < evs.length; i++) pts[c] += Math.max(0, E.SPORT_ENTRY_POINTS + 1.5 * avg + 1.6 * rng.gauss());
  }
  pts[playerColor(G).id] += playerPoints;
  for (const c of Object.keys(pts)) pts[c] = Math.round(pts[c]);
  return ACT.colorRanking(pts);
}

void DORMS; void clamp;
