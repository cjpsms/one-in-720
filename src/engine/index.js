// Engine entry: createGame / loadGame as in docs/CONTRACT.md section 3.
//   import { createGame, loadGame } from './engine/index.js';
import { DORMS } from '../config.js';
import { newState } from './world.js';
import { advance, answer, advanceDays, stepBlock } from './day.js';
import { planDay, dayLabel } from './dayplan.js';
import { defaultPayload as makeDefault } from './payloads.js';
import { serialize, restore } from './save.js';
import { calOf, clockLabel, viewStats, yearLabel, gpax } from './player.js';
import { mergeRoutine, happyOf } from './routine.js';
import { E } from './config.js';
import { SCHOOL } from '../config.js';
import { periodInfo, parentsInfo } from './pending.js';
import { taskNotes } from './tasks.js';
import { roommates } from './world.js';
import { DOW_TH, hhmm } from './util.js';
import { friendsView, partnerView } from './friends.js';
import { conductView } from './conduct.js';

// the day's timeline: done blocks carry their real detail, upcoming ones only the plan
function dayView(G, cal) {
  const S = G.S;
  const blocks = S.dayB && S.dayB.day === S.day ? S.dayB.blocks : planDay(G).map((b) => ({ ...b, done: false }));
  const cur = blocks.findIndex((b) => !b.done);
  return {
    label: dayLabel(G), dow: cal.dow, schoolDay: cal.schoolDay,
    blocks: blocks.map((b, i) => ({ from: b.from, to: b.to, place: b.place, placeKind: b.placeKind, what: b.what, ...(b.done ? { detail: b.detail || '' } : {}), done: !!b.done, current: i === cur })),
  };
}

const clamp0 = (x, hi) => Math.max(0, Math.min(hi, x));

function makeView(G) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const cal = calOf(G);
  const d = DORMS[me.dorm] || { name: '-' };
  const today = [];
  if (cal.schoolDay && me.status === 'active') {
    for (let p = 1; p <= 8; p++) {
      const i = periodInfo(G, p);
      if (i.kind === 'free') continue;
      const t = i.tk && S.teachers[i.tk] ? S.teachers[i.tk].name : '';
      today.push({ from: i.from, to: i.to, title: i.name, loc: i.loc || '', teacher: t, done: p <= (S.donePeriod || 0) });
    }
  }
  const pc = parentsInfo(G);
  const notes = taskNotes(G);
  const mates = roommates(G, me);
  if (mates.length) notes.push('เพื่อนร่วมห้องนอน: ' + mates.map((m) => m.name).join(', '));
  const st = viewStats(G);
  const dayInYear = (cal.cycleInYear - 1) * 14 + cal.dayInCycle;
  const daysInYear = E.TERM_CYCLES * 2 * 14;
  const grades = [];
  for (let g = 1; g <= 6; g++) grades.push({ grade: g, rooms: Object.keys(G.rooms[g]).map((r) => G.rooms[g][r].length) });
  return {
    mode: S.mode,
    miniGames: S.miniGames,
    friends: friendsView(G),
    conduct: conductView(G),
    partner: partnerView(G),
    routine: { ...S.routine },
    progress: { yearIndex: clamp0(cal.year - 1, 5), termIndex: cal.term - 1, dayInYear, daysInYear, fraction: Math.min(1, dayInYear / daysInYear) },
    label: yearLabel(G),
    stats4: { health: st.health, happy: Math.round(happyOf(G)), know: st.knowledge, bonds: Math.round((st.peer + st.teacherTrust) / 2) },
    record: (S.record || []).slice(),
    birth: S.birth ? { ...S.birth } : null,
    schoolMap: { grades, meRoom: { grade: me.grade, room: me.room } },
    day: dayView(G, cal),
    recap: S.recap || null,
    clock: { label: clockLabel(G), year: cal.year, term: cal.term, cycle: cal.cycle, day: cal.day, dow: cal.dow, minute: S.minute, dayInCycle: cal.dayInCycle, schoolDay: cal.schoolDay },
    place: S.place,
    me: { name: me.name, sex: me.sex, trait: me.trait, grade: me.grade, room: me.room, rank: pl.lastRank !== null ? pl.lastRank : me.rank, rankSize: pl.lastRankSize || G.rooms[me.grade] && Object.values(G.rooms[me.grade]).reduce((a, r) => a + r.length, 0), dormName: d.name, dormRoom: me.dormRoom, tier: me.tier },
    stats: st,
    statMax: 100,
    today,
    askParents: { available: pc.canAsk, nextAmount: pc.nextAmount },
    notes,
  };
}

function debugInfo(G) {
  const S = G.S;
  const byGrade = {};
  for (const s of S.school.students) {
    if (s.status !== 'active') continue;
    const b = byGrade[s.grade] || (byGrade[s.grade] = { n: 0, gpa: 0, rooms: {} });
    b.n++;
    b.gpa += s.gpa || 0;
    b.rooms[s.room] = (b.rooms[s.room] || 0) + 1;
  }
  for (const b of Object.values(byGrade)) b.gpa = Math.round((b.gpa / Math.max(1, b.n)) * 100) / 100;
  const teachers = Object.values(S.ts);
  return {
    day: S.day, phase: S.phase, active: S.school.students.filter((s) => s.status === 'active').length, byGrade,
    snapsTotal: S.stat.snaps, stat: S.stat, teachers: teachers.length, maxPressure: Math.max(...teachers.map((t) => t.p)),
    tasksOpen: S.tasks.length, ending: S.ending || null, pl: { health: S.pl.health, stress: S.pl.stress, energy: S.pl.energy, terms: S.pl.terms },
    me: {
      mode: S.mode, gpax: gpax(S.pl), terms: S.pl.terms.length, years: S.pl.terms.length / 2, gatePassed: S.pl.gatePassed, ending: S.ending || null, money: Math.round(G.me.money),
      cnt: { ...S.pl.cnt }, lineUses: S.pl.lineUses, caughtCount: S.pl.caughtCount, sickDays: S.stat.sick,
    },
  };
}

function wrap(G) {
  const S = G.S;
  const game = {
    get pending() { return S.pending; },
    get mode() { return S.mode; },
    view() { return makeView(G); },
    act(payload) {
      S.logBuf = [];
      try {
        const r = answer(G, payload);
        const log = S.logBuf;
        S.logBuf = [];
        if (!r.ok) return { ok: false, error: r.error, log: [], pending: S.pending };
        return { ok: true, log, pending: S.pending };
      } catch (e) {
        game.lastError = e;
        return { ok: false, error: 'engine error: ' + (e && e.message), log: S.logBuf, pending: S.pending };
      }
    },
    defaultPayload() { return S.pending ? makeDefault(G, S.pending) : {}; },
    // routine mode: run the school forward up to `days` days or until a pending needs the player
    advance(opts) {
      const o = opts && typeof opts === 'object' && !Array.isArray(opts) ? opts : {};
      const days = o.days === undefined ? 1 : Number(o.days);
      const untilDecision = o.untilDecision !== false;
      if (!(days >= 0) || days > 1e6) return { ok: false, error: 'days ต้องเป็นจำนวนวัน 0 ขึ้นไป', days: 0, log: [], pending: S.pending, progress: makeView(G).progress };
      S.logBuf = [];
      let ran = 0;
      try {
        ran = advanceDays(G, Math.floor(days), untilDecision);
      } catch (e) {
        game.lastError = e;
        const log = S.logBuf;
        S.logBuf = [];
        return { ok: false, error: 'engine error: ' + (e && e.message), days: 0, log, pending: S.pending, progress: makeView(G).progress };
      }
      const log = S.logBuf;
      S.logBuf = [];
      return { ok: true, days: ran, log, pending: S.pending, progress: makeView(G).progress };
    },
    // routine mode: play exactly one block of the player's day (CONTRACT2 5.1)
    stepBlock() {
      if (S.mode !== 'routine') return { ok: false, error: 'stepBlock ใช้ได้เฉพาะโหมดปกติ (routine)', done: false, block: null, log: [], pending: S.pending };
      S.logBuf = [];
      try {
        const r = stepBlock(G);
        r.log = S.logBuf;
        S.logBuf = [];
        return r;
      } catch (e) {
        game.lastError = e;
        const log = S.logBuf;
        S.logBuf = [];
        return { ok: false, error: 'engine error: ' + (e && e.message), done: false, block: null, log, pending: S.pending };
      }
    },
    setMiniGames(mode) {
      if (mode !== 'play' && mode !== 'auto') return { ok: false, error: "miniGames ต้องเป็น 'play' หรือ 'auto'", miniGames: S.miniGames };
      S.miniGames = mode;
      return { ok: true, miniGames: S.miniGames };
    },
    setRoutine(partial) {
      const m = mergeRoutine(partial, S.routine);
      if (!m.ok) return { ok: false, error: m.error, routine: { ...S.routine } };
      S.routine = m.routine;
      return { ok: true, routine: { ...S.routine } };
    },
    fastForward(stopKinds = ['scene', 'termStart'], maxSteps = 2000) {
      if (S.mode === 'routine') {
        const log = [];
        let steps = 0;
        while (steps < maxSteps && !(S.pending && S.pending.final)) {
          if (S.pending) {
            const r = game.act(game.defaultPayload());
            steps++;
            if (r.log) log.push(...r.log);
            if (!r.ok) return { ok: false, error: r.error, log: log.slice(-200), pending: S.pending, steps };
          }
          if (!S.pending) {
            const a = game.advance({ days: 400 });
            if (a.log) log.push(...a.log);
            if (!a.ok) return { ok: false, error: a.error, log: log.slice(-200), pending: S.pending, steps };
          }
          if (S.pending && (stopKinds.includes(S.pending.kind) || S.pending.final)) break;
        }
        return { ok: true, log: log.slice(-200), pending: S.pending, steps };
      }
      const log = [];
      let steps = 0;
      while (steps < maxSteps && !S.pending.final) {
        const r = game.act(game.defaultPayload());
        steps++;
        if (r.log) log.push(...r.log);
        if (!r.ok) return { ok: false, error: r.error, log: log.slice(-200), pending: S.pending, steps };
        if (stopKinds.includes(S.pending.kind) || S.pending.final) break;
      }
      return { ok: true, log: log.slice(-200), pending: S.pending, steps };
    },
    save() { return serialize(G); },
    debug() { return debugInfo(G); },
    lastError: null,
  };
  return game;
}

export function createGame({ seed = 1, mode = 'routine', miniGames = 'play', crush = 'normal' } = {}) {
  const G = newState(seed >>> 0, mode === 'detailed' ? 'detailed' : 'routine', { miniGames, crush });
  advance(G);
  return wrap(G);
}

export function loadGame(json) {
  return wrap(restore(json));
}
