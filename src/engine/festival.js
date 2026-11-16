// School activities (CONTRACT3): Saturday lessons, freshers, hall sessions, the award, the Loy Krathong fair, the night
// show, lab and club-craft plays. Everything runs as an "act": S.act = { k, stage, blockId, next, ... } driven by
// actStep() from the phase 'act'. An act either asks something (a scene or a `minigame` pending, then the answer
// handler stores the result in S.act.res and the act continues), emits one block of the player's day, or both.
// day.js binds the few helpers it owns (ask / emit / go) with bindIO().
import { DORMS } from '../config.js';
import { Rng } from '../rng.js';
import { E } from './config.js';
import { clamp } from './util.js';
import { ACT, subjectOf, clubById, makeTeachers } from './adapters.js';
import { calOf, say, applyFx, addTrust, studyFactor, dilFactor } from './player.js';
import { scene, opt } from './pending.js';
import { dayKind, getPlan, satScienceIndex } from './plan.js';
import { runHall, runOthers } from './blocks.js';
import { mgPending, mgDifficulty, autoScore, resolveMg, applyMgFx, playLine, countPlay, cleanStats } from './minigame.js';
import { companionScene, setCompanion, applyCompanion, companionBonus, companionLabel, crushScene, bumpFriend, friendOf } from './friends.js';
import { rcAdd, rcNote } from './recap.js';
import { playerColor, colorOfStudent, sportsRankingFor } from './season.js';

const A = E.ACT;
let IO = null;
export function bindIO(io) { IO = io; }

const hash = (a, b) => (Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 1) | 0, 0xc2b2ae35)) >>> 0;
const pickOne = (rng, arr) => arr[rng.int(0, arr.length - 1)];
const STANCE_TH = { focus: 'ตั้งใจเรียน', normal: 'เรียนตามปกติ', relax: 'เรียนสบายๆ' };

// ---------------------------------------------------------------- content adapters (C2's activities.js)
// A spec function may return the params directly or { title, text, params }.
function norm(x, defTitle, defText) {
  const o = x && typeof x === 'object' ? x : {};
  const params = o.params && typeof o.params === 'object' ? o.params : o;
  const topic = params.topic && typeof params.topic === 'object' ? params.topic.title : params.topic;
  return { title: o.title || params.title || (typeof topic === 'string' ? topic : '') || defTitle, text: o.text || params.text || defText || '', params, topic: typeof topic === 'string' ? topic : '' };
}

const HALL_TH = { lecture: 'บรรยายในหอประชุม', special: 'กิจกรรมวันสำคัญในหอประชุม', farewell: 'พิธีอำลาครู', award: 'พิธีมอบรางวัลเกียรตินิยม 4.00' };

function hallSpec(G, kind, ctx) {
  const H = ACT.HALL || {};
  const rng = G.rng;
  const pl = G.S.pl;
  const recent = pl.recentTopics || [];
  let raw = null;
  try {
    if (kind === 'lecture') raw = H.lecture.spec(rng, { recent });
    else if (kind === 'special') raw = H.specialSpec(rng, { recent });
    else if (kind === 'award') raw = H.award.spec(rng, { onStage: true, term: calOf(G).term, awardees: ctx.count, grade: ctx.grade });
    else if (kind === 'farewell') raw = H.farewell.spec(rng, { teacherName: ctx.who, reason: ctx.reason });
  } catch (e) { raw = null; }
  const n = norm(raw, HALL_TH[kind]);
  if (raw && raw.topicId) { recent.push(raw.topicId); if (recent.length > 10) recent.shift(); pl.recentTopics = recent; }
  return n;
}

// ---------------------------------------------------------------- launching a play
// o: { cat, filler, game, title, text, params, canSkip, skipLabel, ctxId, stage, who, placeKind, bias, xs, data }
// When no pending opens (auto mode, or a filler play on a day that already has a stop) the result goes straight into a.res.
function launch(G, a, o) {
  const S = G.S;
  const diff = mgDifficulty(G, o.game, o.bias || 0, o.xs);
  const blocked = S.miniGames !== 'play' || (o.filler && !o.forced && (E.FILLER_AUTO || S.stopDay === S.day || S.playDay === S.day));
  if (blocked) {
    const skip = o.canSkip && S.miniGames === 'auto' && G.rng.chance(A.SKIP_AUTO[S.routine.study] || 0);
    a.res = skip ? { skip: true } : { score: autoScore(G, o.game, diff, o.xs), auto: true };
    if (!skip) say(G, 'เล่นอัตโนมัติ', 'neutral', true);
    return;
  }
  if (o.filler) S.playDay = S.day;
  const p = mgPending(G, {
    tag: 'act_mg', game: o.game, title: o.title, text: o.text, params: o.params, canSkip: o.canSkip, skipLabel: o.skipLabel,
    context: { eventId: o.ctxId, stage: o.stage || a.stage, who: o.who || '' }, placeKind: o.placeKind, difficulty: diff, xs: o.xs, data: {},
  });
  IO.ask(G, p);
}

// the answer of a minigame pending
export function answerMg(G, payload) {
  const a = G.S.act;
  if (!a) return;
  if (payload.skip) a.res = { skip: true };
  else {
    a.res = { score: payload.score, auto: !!payload.auto, stats: cleanStats(payload.stats) };
    countPlay(G);
    if (payload.auto) say(G, 'เล่นอัตโนมัติ', 'neutral', true);
  }
  IO.go(G, 'act');
}

// the answer of a choice scene inside an act
export function answerActScene(G, payload) {
  const a = G.S.act;
  if (!a) return;
  a.sel = payload.optionId;
  IO.go(G, 'act');
}

export function answerCompanion(G, payload, pd) {
  const a = G.S.act;
  setCompanion(G, pd.data.eventId, payload.optionId, pd.data.whos);
  if (a) IO.go(G, 'act');
}

// ---------------------------------------------------------------- entering and finishing acts
export function enterAct(G, k, data = {}) {
  G.S.act = { k, stage: 'start', ...data };
  IO.go(G, 'act');
}

function fin(G, a, o) {
  const S = G.S;
  IO.emit(G, a.blockId, { addNotes: false, ...o });
  S.act = null;
  IO.go(G, a.next);
}

const sick = (G) => G.S.sickDay || G.me.abs === 1;
const stanceOf = (G) => G.S.routine.study;
const tierTone = (res) => (res.tier && res.tier.id === 'great' ? 'good' : res.tier && res.tier.id === 'bad' ? 'bad' : 'neutral');

export function actStep(G) {
  const a = G.S.act;
  if (!a) { IO.go(G, 'daybegin'); return; }
  switch (a.k) {
    case 'hall': return hallStep(G, a);
    case 'award': return awardStep(G, a);
    case 'fresher': return fresherStep(G, a);
    case 'sat': return satStep(G, a);
    case 'fair_am': return fairAm(G, a);
    case 'fair_pm': return fairPm(G, a);
    case 'fair_ev': return fairEv(G, a);
    case 'rehearsal': return rehearsalStep(G, a);
    case 'show': return showStep(G, a);
    case 'filler': return fillerStep(G, a);
    case 'xmas_am': return xmasAm(G, a);
    case 'xmas_pm': return xmasPm(G, a);
    case 'xmas_inf': return xmasInf(G, a);
    case 'sport_fri': return sportDay(G, a, 'fri');
    case 'sport_am': return sportDay(G, a, 'am');
    case 'sport_pm': return sportDay(G, a, 'pm');
    default: throw new Error('unknown act ' + a.k);
  }
}

// ---------------------------------------------------------------- NPCs: the whole school takes part, cheaply
function npcHall(G, kind) {
  const S = G.S;
  const rng = G.rng;
  const skippable = kind === 'lecture' || kind === 'special';
  let caught = 0;
  for (const s of S.school.students) {
    if (s.status !== 'active' || s.isPlayer || s.abs) continue;
    s.st = Math.max(0, s.st - (kind === 'special' ? 1.5 : 0.5));
    if (!skippable) continue;
    if (!rng.chance(0.1 + 0.07 * clamp(-s.diligence, 0, 2))) continue;
    if (rng.chance(A.SKIP_CAUGHT)) {
      caught++;
      const list = G.tkList[s.grade];
      for (let i = 0; i < list.length; i++) s.close[i] = Math.max(0, s.close[i] - 2);
    }
  }
  S.stat.hallCaught = (S.stat.hallCaught || 0) + caught;
}

function npcFestival(G, relief) {
  for (const s of G.S.school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    s.st = Math.max(0, s.st - relief);
    s.hp = Math.min(100, s.hp + 0.5);
  }
}

// ---------------------------------------------------------------- hall: lecture, special day, farewell
function replaceTeacher(G, tk, reason) {
  const S = G.S;
  const old = S.teachers[tk];
  if (!old) return null;
  const names = new Set(Object.values(S.teachers).map((t) => t.name));
  const rng = new Rng(hash(G.S.seed, S.day * 31 + 5));
  let nt = null;
  for (let k = 0; k < 8; k++) {
    const r = makeTeachers(rng, [{ key: tk, foreign: !!old.foreign }]);
    if (!names.has(r[tk].name)) { nt = r[tk]; break; }
    if (k === 7) nt = r[tk];
  }
  const oldName = old.name;
  S.teachers[tk] = nt;
  if (S.ts[tk]) { S.ts[tk].p = 0; S.ts[tk].miss = {}; }
  // students who were close to the old teacher feel it: closeness is pulled toward the average
  const me = G.me;
  const tg = Number(tk[1]);
  for (const s of S.school.students) {
    if (s.status !== 'active' || s.isPlayer || s.grade !== tg) continue;
    const i = G.tkIdx[s.grade][tk];
    if (i !== undefined && s.close[i] >= E.CLOSE) { s.st = Math.min(100, s.st + 4); s.close[i] = 45 + (s.close[i] - 45) * (1 - A.FAREWELL_PULL); }
  }
  const idx = G.tkIdx[me.grade] ? G.tkIdx[me.grade][tk] : undefined;
  let feel = 0;
  if (idx !== undefined) {
    feel = me.close[idx];
    if (feel >= E.CLOSE) applyFx(G, { stress: 3 + (feel - E.CLOSE) / 12 });
    me.close[idx] = 45 + (me.close[idx] - 45) * (1 - A.FAREWELL_PULL);
  }
  say(G, `${oldName} ${reason} ครูคนใหม่ชื่อ${nt.name} มาแทน`, feel >= E.CLOSE ? 'bad' : 'neutral');
  return { oldName, newName: nt.name };
}

function pickFarewell(G) {
  const me = G.me;
  const list = (G.roomTk[me.grade][me.room] || []).filter((tk) => G.S.teachers[tk]);
  const tk = pickOne(G.rng, list);
  const reasons = (ACT.HALL && ACT.HALL.farewell && ACT.HALL.farewell.reasons) || ['ลาออก', 'เกษียณอายุ 60 ปี'];
  return { tk, reason: pickOne(G.rng, reasons) };
}

function trustGain(G) {
  const T = (ACT.HALL && ACT.HALL.trustGain) || {};
  const r = typeof T.roll === 'function' ? T.roll(G.rng, {}) : null;
  if (!r) return '';
  applyMgFx(G, r.fx || { teacherTrust: A.TRUST_GAIN });
  say(G, r.text, 'good');
  return r.text;
}

function hallStep(G, a) {
  const S = G.S;
  const me = G.me;
  switch (a.stage) {
    case 'start': {
      if (!a.began) {
        a.began = true;
        runHall(G);
        npcHall(G, a.kind);
        if (sick(G)) return fin(G, a, { detail: 'พักที่ห้องพยาบาล ไม่ได้เข้าหอประชุม', tone: 'neutral' });
        if (a.kind === 'farewell') a.who = pickFarewell(G);
      }
      const spec = hallSpec(G, a.kind, { grade: me.grade, who: a.who && S.teachers[a.who.tk] ? S.teachers[a.who.tk].name : '', reason: a.who ? a.who.reason : '', forced: !!a.forced });
      a.title = spec.title;
      a.topic = spec.topic;
      a.stage = 'got';
      launch(G, a, {
        filler: true, game: 'watch', title: spec.title, text: spec.text || (a.forced ? 'ถูกจับได้ ต้องกลับไปนั่งฟังจนจบ' : HALL_TH[a.kind]),
        params: spec.params, canSkip: (a.kind === 'lecture' || a.kind === 'special') && !a.forced, skipLabel: 'แอบหนีไปนอน',
        ctxId: 'hall_' + a.kind, stage: a.forced ? 'forced' : 'start', placeKind: 'hall', bias: a.forced ? 0.1 : 0, forced: !!a.forced,
      });
      return;
    }
    case 'got': {
      const r = a.res;
      a.res = null;
      if (r.skip) { a.stage = 'skipped'; return; }
      a.score = r.score;
      a.stage = 'result';
      return;
    }
    case 'skipped': {
      let o = null;
      if (typeof ACT.skipOutcome === 'function') { try { o = ACT.skipOutcome(G.rng, { grade: me.grade, kind: a.kind }); } catch (e) { o = null; } }
      if (!o) o = { caught: typeof ACT.skipCaught === 'function' ? !!ACT.skipCaught(G.rng) : G.rng.chance(A.SKIP_CAUGHT), fx: null, log: '' };
      if (o.caught) {
        const fx = { ...(o.fx || {}) };
        if (!fx.teacherTrust) fx.teacherTrust = A.CAUGHT_TRUST;
        applyMgFx(G, fx);
        say(G, o.log || 'แอบหนีหอประชุมแต่ถูกครูจับได้ ต้องกลับไปนั่งฟังต่อ ครูไม่ไว้ใจเท่าเดิม', 'bad');
        a.forced = true;
        a.caught = true;
        a.stage = 'start';
        return;
      }
      applyMgFx(G, o.fx && Object.keys(o.fx).length ? o.fx : { energy: 4, stress: -2 });
      const line = o.log || 'แอบหนีไปนอนที่หอ ไม่มีใครจับได้';
      say(G, line, 'good');
      return fin(G, a, { detail: `แอบหนีหอประชุม: ${line}`, tone: 'good', tags: ['skip', 'minigame'] });
    }
    case 'result': {
      const res = resolveMg(G, 'hall_' + a.kind, 'watch', a.score, { topic: a.topic || '', who: a.who ? S.teachers[a.who.tk] && S.teachers[a.who.tk].name : '', reason: a.who ? a.who.reason : '', closeness: 0.5 });
      applyMgFx(G, res.fx);
      let extra = '';
      if (a.kind === 'farewell' && a.who) {
        const rep = replaceTeacher(G, a.who.tk, a.who.reason);
        if (rep) extra = `${rep.oldName} ${a.who.reason} ครูคนใหม่ชื่อ${rep.newName}`;
      }
      const tg = trustGain(G);
      const tone = a.caught ? 'bad' : tierTone(res);
      const line = playLine(res, 0);
      say(G, `หอประชุม: ${a.title}${line ? ' ' + line : ''}`, tone, true);
      return fin(G, a, { detail: [`${a.title}`, line, extra, tg].filter(Boolean).join(' · '), tone, tags: ['minigame'] });
    }
    default: throw new Error('hall stage ' + a.stage);
  }
}

// ---------------------------------------------------------------- the 4.00 award (after the term report)
function awardStep(G, a) {
  const S = G.S;
  const me = G.me;
  switch (a.stage) {
    case 'start': {
      let n = 0;
      for (const s of S.school.students) if (s.status === 'active' && s.tgpa >= 4) n++;
      a.n = n;
      if (sick(G)) return fin(G, a, { detail: 'ไม่สบาย ไม่ได้ขึ้นเวทีรับรางวัล', tone: 'bad', place: 'หอประชุม', placeKind: 'stage' });
      const spec = hallSpec(G, 'award', { grade: me.grade, onStage: true, count: n });
      a.stage = 'got';
      launch(G, a, { filler: false, game: 'watch', title: spec.title || HALL_TH.award, text: spec.text || `เกรดเทอมนี้ 4.00 ขึ้นเวทีรับรางวัลพร้อมเพื่อนอีก ${n - 1} คน`, params: spec.params, canSkip: false, ctxId: 'hall_award', stage: 'award', placeKind: 'stage' });
      return;
    }
    case 'got': { a.score = a.res.score; a.res = null; a.stage = 'result'; return; }
    case 'result': {
      const res = resolveMg(G, 'hall_award', 'watch', a.score, { onStage: true, count: a.n });
      applyMgFx(G, { diligence: 2, ...res.fx });
      const tg = trustGain(G);
      say(G, `รับรางวัล 4.00 บนเวที (ขึ้นเวทีรวม ${a.n} คน)`, 'good');
      return fin(G, a, { detail: ['รับรางวัล 4.00 บนเวที', `ขึ้นเวทีรวม ${a.n} คน`, playLine(res, 0), tg].filter(Boolean).join(' · '), tone: 'good', place: 'หอประชุม', placeKind: 'stage', tags: ['minigame'] });
    }
    default: throw new Error('award stage');
  }
}

export const awardApplies = (G) => {
  const me = G.me;
  return me.status === 'active' && me.tgpa >= 4 && !(me.grade === 6 && calOf(G).term === 2);
};

// ---------------------------------------------------------------- freshers (days 1-3 of year 1 and 4)
function fresherDefs(day) {
  const F = ACT.FRESHER && ACT.FRESHER.days;
  const d = F && F[day];
  return d ? d.blocks : [];
}
const FR_PERIODS = [[1, 2], [3, 4], [5, 6, 7, 8]];

function fresherStep(G, a) {
  const S = G.S;
  const me = G.me;
  const plan = getPlan(G);
  const defs = fresherDefs(a.day);
  const def = defs[a.i] || { id: `fr-${a.day}-${a.i}`, name: 'กิจกรรมรับน้อง', what: 'กิจกรรมรับน้อง', place: 'หอประชุม', placeKind: 'hall', play: false, game: 'watch', eventId: 'fresher_auto' };
  switch (a.stage) {
    case 'start': {
      if (a.day === 0 && a.i === 0 && (!S.companion || S.companion.event !== 'fresher') && !a.asked) {
        a.asked = true;
        a.stage = 'with';
        IO.ask(G, companionScene(G, 'fresher'));
        return;
      }
      a.stage = 'block';
      return;
    }
    case 'with': a.stage = 'block'; return;
    case 'block': {
      runOthers(G, FR_PERIODS[a.i], me.grade);
      if (sick(G)) { a.stage = 'emit'; a.detail = 'พักที่ห้องพยาบาล ไม่ได้ร่วมกิจกรรมรับน้อง'; a.tone = 'neutral'; return; }
      const playIt = plan.fresh && plan.fresh[a.day * 3 + a.i] && def.play && def.game;
      const ctx = { grade: me.grade, blockId: def.id, day: a.day + 1, who: S.companion ? S.companion.name : '' };
      if (playIt) {
        let params = {};
        try { params = ACT.FRESHER.spec(def.id, G.rng, ctx) || {}; } catch (e) { params = {}; }
        a.stage = 'got';
        launch(G, a, { filler: false, game: def.game, title: def.name, text: def.what, params: params.params || params, ctxId: def.eventId, stage: `day${a.day + 1}`, who: S.companion ? companionLabel(S.companion) : '', placeKind: def.placeKind || 'hall', xs: null });
        return;
      }
      a.score = null;
      a.stage = 'result';
      return;
    }
    case 'got': {
      const r = a.res;
      a.res = null;
      a.score = r.score;
      a.stage = 'result';
      return;
    }
    case 'result': {
      const game = def.game || 'watch';
      let score = a.score;
      if (score === null || score === undefined) score = autoScore(G, game, mgDifficulty(G, game));
      let res = null;
      if (typeof ACT.fresherResult === 'function') { try { res = ACT.fresherResult(def.id, score, { grade: me.grade, day: a.day + 1, money: Math.round(me.money) }, G.rng); } catch (e) { res = null; } }
      if (!res) res = resolveMg(G, def.eventId || 'fresher_auto', game, score, { grade: me.grade });
      applyMgFx(G, res.fx || {});
      a.detail = [def.name, playLine(res, 0)].filter(Boolean).join(': ');
      a.tone = tierTone(res);
      a.stage = 'emit';
      return;
    }
    case 'emit': {
      const last = a.i >= a.end;
      if (last && a.day === 2 && S.companion && S.companion.event === 'fresher') {
        const txt = applyCompanion(G, S.companion);
        if (companionLabel(S.companion)) a.detail += ` · รับน้อง${companionLabel(S.companion)}${txt ? ' ' + txt : ''}`;
      }
      IO.emit(G, 'fr' + (a.i + 1), { detail: a.detail, tone: a.tone, what: def.what || def.name, place: def.place, placeKind: def.placeKind, addNotes: false, tags: ['minigame'] });
      rcAdd(G, 'acts');
      a.i += 1;
      if (a.i > a.end) { S.act = null; IO.go(G, a.next); } else a.stage = 'block';
      return;
    }
    default: throw new Error('fresher stage');
  }
}

// ---------------------------------------------------------------- Saturday lessons
export function satGroupOf(G) {
  const pl = G.S.pl;
  return pl.satGroup || 'club';
}

// the 4 subjects of the player's Saturday group (or the chill club)
export function satSubjects(G) {
  const g = ACT.SATURDAY && ACT.SATURDAY[G.me.grade];
  const gid = satGroupOf(G);
  if (!g || gid === 'club' || !g.groups[gid]) return null;
  return g.groups[gid];
}

export function satTeacherName(G, key) {
  const S = G.S;
  if (!S.satTeachers) {
    const rng = new Rng(hash(S.seed, 4242));
    const names = new Set(Object.values(S.teachers).map((t) => t.name));
    let t = makeTeachers(rng, typeof ACT.satTeacherKeys === 'function' ? ACT.satTeacherKeys() : []);
    for (let k = 0; k < 6 && Object.values(t).some((x) => names.has(x.name)); k++) t = makeTeachers(rng, ACT.satTeacherKeys());
    S.satTeachers = t;
  }
  const t = S.satTeachers[key];
  return t ? t.name : 'ครู';
}

function satPeriod(G, i) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const gid = satGroupOf(G);
  const grp = satSubjects(G);
  const stance = stanceOf(G);
  const mood = typeof ACT.satMood === 'function' ? ACT.satMood(gid === 'club' ? 'club' : grp || gid, me.grade) : { fx: {} };
  const fx = mood.fx || {};
  if (sick(G)) return { detail: 'พักที่ห้องพยาบาล ไม่ได้เรียนวันเสาร์', tone: 'neutral', what: null };
  const sf = { focus: 1, normal: 0.8, relax: 0.6 }[stance];
  const per = (v) => (v || 0) / 4;
  pl.stress = clamp(pl.stress + per(fx.stress) * (gid === 'club' ? 1 : sf), 0, 100);
  pl.energy = clamp(pl.energy + per(fx.energy) * (gid === 'club' ? 1 : sf), 0, 100);
  pl.peer = clamp(pl.peer + per(fx.peer), 0, 100);
  pl.diligence = clamp(pl.diligence + per(fx.diligence), 0, 100);
  pl.fullness = clamp(pl.fullness - E.HUNGER_PER_PERIOD, 0, 100);
  if (gid === 'club') {
    pl.bonusZ += pl.clubId ? 0.002 : 0.0005;
    return { detail: 'ชุมนุมวันเสาร์ ชิลๆ', tone: 'good', what: 'ชุมนุมวันเสาร์ (ชิล)' };
  }
  addTrust(G, per(fx.teacherTrust));
  const sj = grp.subjects[i];
  const unit = E.STANCE_UNIT[stance] * (0.65 + (0.35 * pl.energy) / 100) * studyFactor(G);
  pl.bonusZ += A.SAT_Z * unit;
  for (const code of Object.keys(pl.subj)) {
    if (code !== 'ELEC' && subjectOf(code).kind === sj.kind) pl.satZ[code] = (pl.satZ[code] || 0) + A.SAT_MATCH_Z * unit;
  }
  pl.d.study += 0.1 * unit;
  rcAdd(G, 'attended');
  return { detail: `${sj.short} กับ${satTeacherName(G, sj.teacherKey)} ${STANCE_TH[stance]}`, tone: mood.tone === 'bad' ? 'bad' : 'neutral', what: `${sj.name}` };
}

function satStep(G, a) {
  const S = G.S;
  const k = dayKind(G);
  const grp = satSubjects(G);
  switch (a.stage) {
    case 'start': a.stage = 'period'; return;
    case 'period': {
      const r = satPeriod(G, a.i);
      a.det = r;
      const fill = k.fill && k.fill.where === 'sat' && k.fill.i === a.i && !sick(G) ? k.fill : null;
      if (fill) { a.stage = 'fill'; a.fillGame = fill.game; return; }
      a.stage = 'emit';
      return;
    }
    case 'fill': return fillerStep(G, a, 'sat');
    case 'emit': {
      const r = a.det;
      const o = { detail: r.detail, tone: r.tone, addNotes: false };
      if (r.what) { o.what = grp ? `เรียนวันเสาร์: ${r.what}` : r.what; o.placeKind = grp ? 'classroom' : 'activity'; o.place = grp ? 'ห้องเรียนวันเสาร์' : 'ชุมนุมวันเสาร์'; }
      IO.emit(G, 'sat' + (a.i + 1), o);
      a.i += 1;
      a.stage = 'period';
      if (a.i >= 4) { S.act = null; IO.go(G, a.next); }
      else if (S.mode !== 'routine') return satStep(G, a); // detailed mode runs the whole morning at once
      return;
    }
    default: throw new Error('sat stage');
  }
}

// ---------------------------------------------------------------- lab and club-craft plays
function fillerStep(G, a, host) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const game = a.k === 'filler' ? a.game : a.fillGame;
  const st = a.k === 'filler' ? a.stage : a.fillStage || 'start';
  const setStage = (v) => { if (host) a.fillStage = v; else a.stage = v; };
  if (st === 'start' || (host && st === 'fill')) {
    let params = {};
    let title = '';
    let ctxId;
    let g;
    let extra = {};
    let pk;
    if (game === 'lab') {
      const labs = ACT.LAB || [];
      const recent = pl.recentLabs || [];
      const pool = labs.filter((l) => !recent.includes(l.id));
      const lab = pool.length ? pickOne(G.rng, pool) : labs.length ? pickOne(G.rng, labs) : null;
      if (lab) { recent.push(lab.id); if (recent.length > 8) recent.shift(); pl.recentLabs = recent; params = lab.spec(G.rng); title = `ทดลอง: ${lab.title || lab.subject}`; extra = { labId: lab.id }; }
      g = 'steps'; ctxId = 'science_lab'; pk = 'lab';
    } else {
      const club = pl.clubId ? clubById(pl.clubId) : null;
      let craft = null;
      if (typeof ACT.craftForClub === 'function') craft = ACT.craftForClub(club || { area: 'art' }, G.rng);
      if (craft) { params = craft.spec(G.rng); g = craft.game; title = `งานฝีมือชุมนุม: ${craft.title}`; extra = { area: craft.area }; } else { g = 'pattern'; title = 'ร้อยกำไลข้อมือ'; }
      ctxId = 'club_craft'; pk = 'activity';
    }
    a.fx = { game: g, ctxId, extra, title };
    setStage('got');
    launch(G, a, { filler: true, game: g, title: title || 'มินิเกม', text: 'ลองทำจริงดู', params, canSkip: false, ctxId, stage: 'period', placeKind: pk });
    return;
  }
  if (st === 'got') {
    const r = a.res;
    a.res = null;
    const f = a.fx;
    const res = resolveMg(G, f.ctxId, f.game, r.score, { grade: me.grade, ...f.extra });
    applyMgFx(G, res.fx);
    const line = playLine(res, 0);
    say(G, `${f.title}${line ? ': ' + line : ''}`, tierTone(res), true);
    const tag = ['minigame'];
    if (host) {
      a.det.detail = `${a.det.detail} · ${f.title}${line ? ': ' + line : ''}`;
      a.det.tone = tierTone(res) === 'neutral' ? a.det.tone : tierTone(res);
      a.fillStage = 'start';
      a.stage = 'emit';
      return;
    }
    fin(G, a, { detail: [a.detail, `${f.title}${line ? ': ' + line : ''}`].filter(Boolean).join(' · '), tone: tierTone(res) === 'neutral' ? a.tone : tierTone(res), tags: tag });
    void S;
  }
}

// ---------------------------------------------------------------- the Loy Krathong fair
function makeFair(G) {
  const S = G.S;
  const teachers = Object.values(S.teachers).filter((t) => t && t.name).map((t) => ({ key: t.key, name: t.name }));
  const dorms = Object.entries(DORMS).map(([key, d]) => ({ key, name: d.name }));
  const stalls = ACT.makeStalls(G.rng, { teachers, dorms, playerWealth: Math.round(G.me.money) });
  S.fair = { day: S.day, stalls };
  return S.fair;
}

const stallById = (G, id) => (G.S.fair ? G.S.fair.stalls.find((s) => s.id === id) : null);

function fairAm(G, a) {
  const S = G.S;
  const pl = S.pl;
  const fair = makeFair(G);
  npcFestival(G, 4);
  pl.stress = clamp(pl.stress - 1, 0, 100);
  pl.peer = clamp(pl.peer + 1, 0, 100);
  pl.fullness = clamp(pl.fullness - 12, 0, 100);
  const mine = fair.stalls.find((s) => s.owner.kind === 'dorm' && s.owner.key === G.me.dorm);
  // the other dorm stalls and teacher stalls finish their day: a line about the player's own dorm
  let dormLine = '';
  if (mine && typeof ACT.investResult === 'function') {
    const r = ACT.investResult(mine, 100, 0.4 + 0.5 * G.rng.float(), G.rng);
    dormLine = ` ซุ้มหอเรา: ${mine.name}`;
    mine.npcNet = r.payout - 100;
  }
  const n = fair.stalls.length;
  say(G, `งานลอยกระทง: ทั้งโรงเรียนเปิดซุ้ม ${n} ซุ้ม`, 'neutral', true);
  fin(G, a, { detail: `ช่วยเตรียมงานลอยกระทง ซุ้มทั้งหมด ${n} ซุ้ม${dormLine}`, tone: 'neutral', what: 'งานลอยกระทง: เตรียมซุ้ม', place: 'ลานงานลอยกระทง', placeKind: 'fair' });
}

function fairChoiceScene(G) {
  const S = G.S;
  const me = G.me;
  const fair = S.fair;
  const help = fair.stalls.filter((s) => s.needHelp);
  const teach = help.filter((s) => s.owner.kind === 'teacher');
  const dorm = help.filter((s) => s.owner.kind === 'dorm');
  G.rng.shuffle(teach);
  G.rng.shuffle(dorm);
  const offers = [...teach.slice(0, 3), ...dorm.slice(0, 1)].slice(0, 4);
  const options = offers.map((s) => opt(`work:${s.id}`, `ช่วยร้าน${s.name} (${s.owner.name})`, `ค่าแรง ${s.pay.base} บาท + ${s.pay.perDish} บาทต่อจาน${s.trust === 'teacher' ? ' ครูเห็นความขยัน' : ''}`, s.trust === 'teacher' ? 'good' : undefined));
  const mine = fair.stalls.find((s) => s.owner.kind === 'dorm' && s.owner.key === me.dorm);
  if (mine && me.money >= 40) options.push(opt('invest', `ลงทุนกับซุ้มของหอเรา (${mine.name})`, 'ใส่เงินลงทุน ช่วยขาย แล้วแบ่งกำไรหรือขาดทุน'));
  if (me.money >= 30) options.push(opt('own', 'เปิดซุ้มของตัวเอง', 'ลงทุนเอง เสี่ยงขาดทุน กำไรเต็มมือ'));
  options.push(opt('wander', 'เดินเที่ยวงาน ซื้อของ', 'ซื้อของกินและของฝาก สนุกแต่เสียเงิน'));
  options.push(opt('rest', 'นั่งพักริมสระ', 'ไม่เล่นอะไร พักผ่อน'));
  return scene(G, { tag: 'fair_choice', title: 'งานลอยกระทง: บ่ายนี้ทำอะไร', text: `ซุ้มเปิดกันแล้ว ${fair.stalls.length} ซุ้ม มีเงินอยู่ ${Math.round(me.money)} บาท`, options });
}

const WANDER_ITEMS = ['ไส้กรอกย่าง', 'ลูกชิ้นปิ้ง', 'ชานมไข่มุก', 'ข้าวโพดต้ม', 'น้ำแข็งใส', 'กล้วยทอด', 'ขนมครก', 'โรตีสายไหม', 'น้ำมะนาวโซดา', 'บัวลอย', 'เครปผลไม้', 'ทาโกะยากิ'];
function buySpec(G) {
  const rng = G.rng;
  const items = rng.shuffle(WANDER_ITEMS.slice()).slice(0, 8).map((n, i) => ({ id: `buy${i}`, name: n }));
  return { items, sequenceLen: 5, timeLimit: 20, label: 'ซื้อของให้ครบตามลิสต์' };
}

function fairPm(G, a) {
  const S = G.S;
  const me = G.me;
  const rng = G.rng;
  switch (a.stage) {
    case 'start': {
      if (!S.fair || S.fair.day !== S.day) makeFair(G);
      if (sick(G)) return fin(G, a, { detail: 'ไม่สบาย อยู่ห้องพยาบาล ไม่ได้ไปงานลอยกระทง', tone: 'bad', place: 'ห้องพยาบาล', placeKind: 'dorm' });
      a.stage = 'with';
      IO.ask(G, companionScene(G, 'fair'));
      return;
    }
    case 'with': a.stage = 'choose'; return;
    case 'choose': {
      a.stage = 'chosen';
      IO.ask(G, fairChoiceScene(G));
      return;
    }
    case 'chosen': {
      const sel = a.sel;
      a.sel = null;
      const who = companionLabel(S.companion);
      if (sel.startsWith('work:')) {
        const stall = stallById(G, sel.slice(5));
        a.mode = 'work';
        a.stallId = stall.id;
        a.stage = 'got';
        launch(G, a, { filler: false, game: 'serve', title: `ช่วยร้าน${stall.name}`, text: `ช่วยขายให้${stall.owner.name}`, params: ACT.serveSpec(rng, stall, { difficulty: mgDifficulty(G, 'serve') }), ctxId: 'loy_stall', stage: 'work', who, placeKind: 'fair' });
        return;
      }
      if (sel === 'invest') {
        const stall = S.fair.stalls.find((s) => s.owner.kind === 'dorm' && s.owner.key === me.dorm);
        const maxI = stall.invest ? stall.invest.max : 100;
        a.amount = clamp(Math.round((me.money * 0.15) / 10) * 10, 20, Math.min(maxI, Math.floor(me.money)));
        a.mode = 'invest';
        a.stallId = stall.id;
        a.stage = 'got';
        launch(G, a, { filler: false, game: 'serve', title: `ลงทุนซุ้ม${stall.name}`, text: `ใส่เงิน ${a.amount} บาท ช่วยขายเต็มที่`, params: ACT.serveSpec(rng, stall, { difficulty: mgDifficulty(G, 'serve') }), ctxId: 'loy_stall', stage: 'invest', who, placeKind: 'fair' });
        return;
      }
      if (sel === 'own') {
        const plans = ACT.ownStallOptions(rng, { money: Math.floor(me.money) });
        if (!plans.length) { a.sel = 'wander'; return; }
        a.plans = plans;
        a.stage = 'own';
        IO.ask(G, scene(G, { tag: 'fair_own', title: 'เปิดซุ้มของตัวเอง', text: `เงินที่มี ${Math.round(me.money)} บาท เลือกแผนลงทุน`, options: plans.map((p) => opt(`plan:${p.id}`, `${p.name} (ลงทุน ${p.invest} บาท)`, `คาดว่าได้คืน ${p.expected.min}-${p.expected.max} บาท`)) }));
        return;
      }
      if (sel === 'wander') {
        a.mode = 'wander';
        a.stage = 'got';
        launch(G, a, { filler: false, game: 'dash', title: 'เดินซื้อของในงาน', text: 'ซื้อของให้ครบตามลิสต์ก่อนหมดเวลา', params: buySpec(G), ctxId: 'loy_wander', stage: 'buy', who, placeKind: 'fair' });
        return;
      }
      a.mode = 'rest';
      applyFx(G, { stress: -3, energy: 2 });
      return fin(G, a, { detail: `นั่งพักริมสระ ${who}`.trim(), tone: 'neutral', what: 'งานลอยกระทง: บ่าย', place: 'ลานงานลอยกระทง', placeKind: 'fair' });
    }
    case 'own': {
      const id = a.sel.slice(5);
      a.sel = null;
      const plan = a.plans.find((p) => p.id === id) || a.plans[0];
      a.plan = plan;
      a.mode = 'own';
      a.stage = 'got';
      launch(G, a, { filler: false, game: 'serve', title: `ซุ้ม${plan.name}`, text: `ลงทุน ${plan.invest} บาท ขายเอง`, params: ACT.serveSpec(rng, { name: plan.name, menu: plan.menu }, { difficulty: mgDifficulty(G, 'serve'), own: true }), ctxId: 'loy_own', stage: 'own', who: companionLabel(S.companion), placeKind: 'fair' });
      return;
    }
    case 'got': {
      const r = a.res;
      a.res = null;
      const score = r.score;
      const stats = r.stats || {};
      let res;
      let line = '';
      let tone = 'neutral';
      let money = 0;
      if (a.mode === 'work') {
        const stall = stallById(G, a.stallId);
        const served = Number.isFinite(stats.served) ? stats.served : Math.round(score * 10);
        res = resolveMg(G, 'loy_stall', 'serve', score, { stall, served, customers: stats.customers || 10, closeness: 0.5 });
        money = applyMgFx(G, res.fx);
        if (stall.owner.kind === 'teacher') {
          const i = G.tkIdx[me.grade] ? G.tkIdx[me.grade][stall.owner.key] : undefined;
          if (i !== undefined) me.close[i] = clamp(me.close[i] + 2 + 4 * score, 0, 100);
          else addTrust(G, 1.5);
        }
        line = res.log || playLine(res, money);
        tone = tierTone(res);
        say(G, `ลอยกระทง: ช่วยร้าน${stall.owner.name} ${playLine(res, money)}`, money > 0 ? 'good' : tone);
      } else if (a.mode === 'invest') {
        const stall = stallById(G, a.stallId);
        const ir = ACT.investResult(stall, a.amount, score, G.rng);
        res = resolveMg(G, 'loy_stall', 'serve', score, { stall, amount: a.amount, served: Math.round(score * 10), closeness: 0.5 });
        const fx = { ...res.fx };
        delete fx.money;
        applyMgFx(G, { ...fx, ...ir.fx });
        money = ir.fx.money || 0;
        line = ir.log;
        tone = money >= 0 ? 'good' : 'bad';
        say(G, `ลอยกระทง: ${ir.log}`, tone);
      } else if (a.mode === 'own') {
        const rr = ACT.ownStallResult(a.plan, score, G.rng);
        applyMgFx(G, rr.fx);
        money = rr.fx.money || 0;
        line = rr.log;
        tone = rr.profit >= 0 ? 'good' : 'bad';
        say(G, `ลอยกระทง: ${rr.log}`, tone);
      } else {
        res = resolveMg(G, 'loy_wander', 'dash', score, { closeness: 0.5 });
        money = applyMgFx(G, res.fx);
        line = playLine(res, money);
        tone = tierTone(res);
      }
      return fin(G, a, { detail: line, tone, what: 'งานลอยกระทง: บ่าย', place: 'ลานงานลอยกระทง', placeKind: 'fair', tags: ['minigame'] });
    }
    default: throw new Error('fair_pm stage');
  }
}

function fairEv(G, a) {
  const S = G.S;
  const me = G.me;
  const rng = G.rng;
  const C = ACT.CONTESTS || {};
  const ids = Array.isArray(C) ? C.map((c) => c.id) : Object.keys(C);
  const get = (id) => (Array.isArray(C) ? C.find((c) => c.id === id) : C[id]);
  const bonus = companionBonus(S.companion);
  switch (a.stage) {
    case 'start': {
      if (sick(G)) return fin(G, a, { detail: 'ไม่สบาย ไม่ได้ไปงานลอยกระทงตอนค่ำ', tone: 'bad', place: 'ห้องพยาบาล', placeKind: 'dorm' });
      a.done = [];
      a.log = [];
      a.stage = 'contest';
      return;
    }
    case 'contest': {
      if (a.done.length >= A.CONTESTS_MAX) { a.stage = 'float'; return; }
      const left = ids.filter((id) => !a.done.includes(id));
      const options = left.map((id) => opt(`contest:${id}`, get(id).title, get(id).entryNote || ''));
      options.push(opt('none', a.done.length ? 'พอแล้ว ไปลอยกระทง' : 'ไม่ลงแข่ง ไปลอยกระทงเลย', 'ไม่ต้องเหนื่อย'));
      a.stage = 'contest_sel';
      IO.ask(G, scene(G, { tag: 'fair_contest', title: a.done.length ? 'ลงแข่งอีกรายการไหม' : 'ประกวดในงานลอยกระทง', text: 'ค่ำแล้ว ลานงานเริ่มมีเวทีประกวด', options }));
      return;
    }
    case 'contest_sel': {
      const sel = a.sel;
      a.sel = null;
      if (sel === 'none') { a.stage = 'float'; return; }
      const id = sel.slice(8);
      const c = get(id);
      a.cur = id;
      let params = {};
      try { params = c.specFor(rng, { grade: me.grade, money: Math.round(me.money) }) || {}; } catch (e) { params = {}; }
      a.stage = 'contest_got';
      launch(G, a, { filler: false, game: c.game, title: c.title, text: c.entryNote || '', params, ctxId: 'loy_contest_' + id, stage: id, who: companionLabel(S.companion), placeKind: 'fair' });
      return;
    }
    case 'contest_got': {
      const r = a.res;
      a.res = null;
      const c = get(a.cur);
      const score = clamp(r.score + bonus, 0, 1);
      const rivals = rng.int(A.CONTEST_RIVALS[0], A.CONTEST_RIVALS[1]);
      const rank = ACT.rankFromScore(score, rivals, rng);
      const res = resolveMg(G, 'loy_contest_' + a.cur, c.game, score, { contestId: a.cur, place: rank.place, of: rank.of });
      const money = applyMgFx(G, res.fx);
      const line = `${c.title} ได้ที่ ${rank.place} จาก ${rank.of}${money > 0 ? ` รางวัล ${money} บาท` : ''}`;
      say(G, `ลอยกระทง: ${line}`, rank.place <= 3 ? 'good' : 'neutral');
      a.log.push(line);
      a.done.push(a.cur);
      a.stage = 'contest';
      return;
    }
    case 'float': {
      let params = {};
      try { params = ACT.FLOAT.floatSpec(rng) || {}; } catch (e) { params = {}; }
      a.stage = 'float_got';
      launch(G, a, { filler: false, game: 'timing', title: 'ลอยกระทง', text: S.companion && S.companion.kind !== 'alone' ? `ลอยกระทง${companionLabel(S.companion)}` : 'ปล่อยกระทงลงน้ำให้ถูกจังหวะ', params, ctxId: 'loy_float', stage: 'float', who: companionLabel(S.companion), placeKind: 'fair' });
      return;
    }
    case 'float_got': {
      const r = a.res;
      a.res = null;
      const score = clamp(r.score + bonus, 0, 1);
      const res = resolveMg(G, 'loy_float', 'timing', score, { closeness: S.companion ? clamp((S.companion.closeness || 0) / 100, 0, 1) : 0, who: S.companion ? S.companion.name : '' });
      applyMgFx(G, res.fx);
      const txt = applyCompanion(G, S.companion);
      const who = companionLabel(S.companion);
      const line = `ลอยกระทง${who ? ' ' + who : ''}${res.log ? ' ' + res.log : ''}`;
      say(G, `ลอยกระทง${who ? ' ' + who : ''}: ${res.log || playLine(res, 0)}`, tierTone(res));
      S.pl.sleepHours = A.NIGHT_SLEEP_HOURS;
      rcAdd(G, 'sleepSum', A.NIGHT_SLEEP_HOURS);
      rcAdd(G, 'sleepN');
      S.companion = null;
      const sc = crushScene(G, true);
      if (sc) S.queue.push(sc);
      fin(G, a, { detail: [...a.log, line, txt].filter(Boolean).join(' · '), tone: 'good', what: 'งานลอยกระทง: ค่ำ', place: 'ลานงานลอยกระทง', placeKind: 'fair', tags: ['minigame'] });
      return;
    }
    default: throw new Error('fair_ev stage');
  }
}

// ---------------------------------------------------------------- the night show
export function showRoles() {
  const roles = (ACT.SHOW && ACT.SHOW.roles) || [];
  return roles;
}

export function roleScene(G) {
  const roles = showRoles();
  const options = roles.map((r) => opt(r.id, r.name, r.blurb));
  return scene(G, { tag: 'show_role', title: 'งานราตรี: เลือกบทบาท', text: 'ชั้นปีเราจะจัดงานราตรีส่งรุ่นพี่ที่ใกล้จบ ต้องมีคนแสดง ถ่ายภาพ บันทึกเสียง ตัดต่อ และกำกับ จะอาสาทำอะไร', options });
}

export function answerRole(G, payload) {
  const pl = G.S.pl;
  pl.showRole = payload.optionId;
  pl.showPrep = 0;
  pl.showDirector = null;
  say(G, payload.optionId === 'none' ? 'ไม่ได้ร่วมงานราตรี จะไปนั่งดู' : `อาสาทำงานราตรี: ${((showRoles().find((r) => r.id === payload.optionId) || {}).name) || payload.optionId}`, 'neutral');
}

const skillOf = (G) => clamp((G.S.pl.peer + G.S.pl.energy) / 200 + 0.2, 0, 1);
const roleOf = (G) => showRoles().find((r) => r.id === G.S.pl.showRole) || null;
const roleGame = (G) => { const r = roleOf(G); return r ? r.game : 'rhythm'; };

function resolveDirector(G) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const cand = [{ id: 'me', name: me.name, trust: G.tkIdx ? 0 : 0, prep: pl.showPrep }];
  const mates = S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && s.grade === me.grade && G.rng.chance(0.1)).slice(0, 8);
  for (const s of mates) cand.push({ id: s.id, name: s.name, trust: 50 + 8 * s.diligence, prep: 0.4 + 0.2 * G.rng.float() });
  let picked = null;
  if (typeof ACT.SHOW.directorPick === 'function') { try { picked = ACT.SHOW.directorPick(G.rng, cand.map((c) => ({ ...c, trust: c.id === 'me' ? Math.round(avgTrust(G)) : c.trust }))); } catch (e) { picked = null; } }
  const ids = Array.isArray(picked) ? picked.map((x) => (x && typeof x === 'object' ? x.id : x)) : null;
  const got = ids ? ids.includes('me') : G.rng.chance(0.5);
  pl.showDirector = got;
  if (got) say(G, 'ได้เป็นผู้กำกับงานราตรี', 'good');
  else { pl.showRole = 'act'; say(G, 'ไม่ได้เป็นผู้กำกับงานราตรี เลยไปรับบทแสดงแทน', 'neutral'); }
}

function avgTrust(G) {
  const me = G.me;
  const list = G.roomTk[me.grade][me.room];
  if (!list.length) return 50;
  let s = 0;
  for (const tk of list) s += me.close[G.tkIdx[me.grade][tk]];
  return s / list.length;
}

function rehearsalStep(G, a) {
  const S = G.S;
  const pl = S.pl;
  const cal = calOf(G);
  switch (a.stage) {
    case 'start': {
      if (sick(G)) return fin(G, a, { detail: 'ไม่สบาย ไม่ได้ไปซ้อมงานราตรี', tone: 'bad' });
      if (a.n === 1 && pl.showRole === 'director' && pl.showDirector === null) resolveDirector(G);
      const playIt = A.REHEARSAL_PLAY_CYCLES.includes(cal.cycleInTerm);
      const role = roleOf(G);
      if (playIt && role) {
        let params = {};
        try { params = ACT.SHOW.showSpec(role.id, G.rng, { prep: pl.showPrep, grade: G.me.grade, skill: skillOf(G) }) || {}; } catch (e) { params = {}; }
        a.stage = 'got';
        launch(G, a, { filler: false, game: role.game, title: `ซ้อม${role.name}`, text: 'ซ้อมใหญ่ก่อนวันจริง', params: params.params || params, ctxId: 'show_rehearsal', stage: 'rehearsal', placeKind: 'stage', xs: { skill: Math.round(pl.showPrep * 100) } });
        return;
      }
      a.score = null;
      a.stage = 'result';
      return;
    }
    case 'got': { a.score = a.res.score; a.res = null; a.stage = 'result'; return; }
    case 'result': {
      const role = roleOf(G);
      const gain = A.SHOW_PREP_GAIN * (0.7 + 0.6 * (a.score === null || a.score === undefined ? 0.5 : a.score));
      pl.showPrep = clamp(pl.showPrep + gain, 0, 1);
      applyFx(G, { energy: -5, stress: 1.5, peer: 1.5 });
      pl.fullness = clamp(pl.fullness - 10, 0, 100);
      let line = '';
      if (a.score !== null && a.score !== undefined) {
        const res = resolveMg(G, 'show_rehearsal', role ? role.game : 'rhythm', a.score, { role: pl.showRole, prep: pl.showPrep });
        applyMgFx(G, res.fx);
        line = playLine(res, 0);
      }
      const nm = role ? role.name : 'งานราตรี';
      say(G, `ซ้อมงานราตรี (${nm}) ครั้งที่ ${a.n} พร้อม ${Math.round(pl.showPrep * 100)}%`, 'neutral', true);
      return fin(G, a, { detail: [`ซ้อม${nm} ครั้งที่ ${a.n}`, `ความพร้อม ${Math.round(pl.showPrep * 100)}%`, line].filter(Boolean).join(' · '), tone: 'neutral', what: `ซ้อมงานราตรี: ${nm}`, place: 'เวทีหอประชุม', placeKind: 'stage', tags: ['minigame'] });
    }
    default: throw new Error('rehearsal stage');
  }
}

function showStep(G, a) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  switch (a.stage) {
    case 'start': {
      npcFestival(G, 3);
      if (sick(G)) return fin(G, a, { detail: 'ไม่สบาย ไม่ได้ไปงานราตรี', tone: 'bad', place: 'ห้องพยาบาล', placeKind: 'dorm' });
      a.stage = 'with';
      IO.ask(G, companionScene(G, 'show'));
      return;
    }
    case 'with': {
      // everyone also watches the other grades' show items (auto)
      const w = resolveMg(G, 'show_watch', 'watch', autoScore(G, 'watch', 0.4), { grade: me.grade });
      applyMgFx(G, w.fx);
      a.watch = w.log || 'นั่งดูการแสดงของชั้นปีอื่น';
      const role = roleOf(G);
      if (!role || pl.showRole === 'none') { a.score = null; a.stage = 'result'; return; }
      let params = {};
      try { params = ACT.SHOW.showSpec(role.id, G.rng, { prep: pl.showPrep, grade: me.grade, skill: skillOf(G) }) || {}; } catch (e) { params = {}; }
      a.stage = 'got';
      launch(G, a, { filler: false, game: role.game, title: `งานราตรี: ${role.name}`, text: role.blurb || '', params: params.params || params, ctxId: 'show_' + role.id, stage: 'night', who: companionLabel(S.companion), placeKind: 'stage', xs: { skill: Math.round(pl.showPrep * 100) } });
      return;
    }
    case 'got': { a.score = a.res.score; a.res = null; a.stage = 'result'; return; }
    case 'result': {
      const role = roleOf(G);
      let line = '';
      let tone = 'neutral';
      if (a.score !== null && a.score !== undefined && role) {
        const score = clamp(a.score + 0.5 * companionBonus(S.companion), 0, 1);
        let res = null;
        if (typeof ACT.SHOW.showResult === 'function') { try { res = ACT.SHOW.showResult(role.id, score, pl.showPrep, G.rng); } catch (e) { res = null; } }
        if (!res || !res.fx) res = resolveMg(G, 'show_' + role.id, role.game, score, { role: role.id, prep: pl.showPrep });
        applyMgFx(G, res.fx);
        line = playLine(res, 0);
        tone = tierTone(res);
        say(G, `งานราตรี (${role.name}): ${line}`, tone);
      } else {
        applyFx(G, { stress: -3, peer: 1.5 });
        line = 'ดูงานราตรีจากที่นั่งคนดู';
      }
      const txt = applyCompanion(G, S.companion);
      const who = companionLabel(S.companion);
      pl.sleepHours = A.NIGHT_SLEEP_HOURS;
      rcAdd(G, 'sleepSum', A.NIGHT_SLEEP_HOURS);
      rcAdd(G, 'sleepN');
      S.companion = null;
      pl.showRole = null;
      pl.showPrep = 0;
      const sc = crushScene(G, true);
      if (sc) S.queue.push(sc);
      fin(G, a, { detail: [`งานราตรี${who ? ' ' + who : ''}`, a.watch, line, txt].filter(Boolean).join(' · '), tone, what: 'งานราตรี', place: 'หอประชุม', placeKind: 'stage', tags: ['minigame'] });
      void bumpFriend; void friendOf; void dilFactor;
      return;
    }
    default: throw new Error('show stage');
  }
}

// ---------------------------------------------------------------- Christmas (CONTRACT3 section 11)
function xmasAm(G, a) {
  const me = G.me;
  switch (a.stage) {
    case 'start': {
      runHall(G, [1, 2, 3, 4]);
      if (sick(G)) return fin(G, a, { detail: 'พักที่ห้องพยาบาล ไม่ได้ไปประดับต้นคริสต์มาส', tone: 'neutral', place: 'ลานต้นคริสต์มาส', placeKind: 'hall', what: 'คริสต์มาส: ประดับต้นไม้' });
      let params = {};
      try { params = ACT.XMAS.craftSpec(G.rng, {}) || {}; } catch (e) { params = {}; }
      a.stage = 'got';
      launch(G, a, { filler: false, game: 'craft', title: 'ประดับต้นคริสต์มาส', text: ACT.XMAS.texts.morning, params, ctxId: 'xmas_craft', stage: 'tree', placeKind: 'hall' });
      return;
    }
    case 'got': {
      const res = resolveMg(G, 'xmas_craft', 'craft', a.res.score, { grade: me.grade });
      a.res = null;
      applyMgFx(G, res.fx);
      say(G, `คริสต์มาส: ${res.log}`, tierTone(res), true);
      return fin(G, a, { detail: res.log, tone: tierTone(res), what: 'คริสต์มาส: ประดับต้นไม้', place: 'ลานต้นคริสต์มาส', placeKind: 'hall', tags: ['minigame'] });
    }
    default: throw new Error('xmas_am stage');
  }
}

function xmasPm(G, a) {
  const S = G.S;
  const me = G.me;
  switch (a.stage) {
    case 'start': {
      runHall(G, [5, 6]);
      if (sick(G)) return fin(G, a, { detail: 'พักที่ห้องพยาบาล ไม่ได้ไปปาร์ตี้คริสต์มาส', tone: 'neutral', what: 'คริสต์มาส: ปาร์ตี้ในหอประชุม', place: 'หอประชุม', placeKind: 'hall' });
      a.hit = G.rng.chance(A.XMAS_HIT); // cj: 30%
      let params = {};
      try { params = ACT.XMAS.candySpec(G.rng, { difficulty: mgDifficulty(G, 'timing') }) || {}; } catch (e) { params = {}; }
      a.stage = 'got';
      launch(G, a, { filler: false, game: 'timing', title: 'รับลูกอมจากซานต้า', text: ACT.XMAS.texts.hall, params, ctxId: 'xmas_candy', stage: 'candy', placeKind: 'hall' });
      return;
    }
    case 'got': {
      const res = resolveMg(G, 'xmas_candy', 'timing', a.res.score, { hit: a.hit, grade: me.grade });
      a.res = null;
      applyMgFx(G, res.fx);
      let n = 0;
      for (const s of S.school.students) if (s.status === 'active' && !s.isPlayer && G.rng.chance(0.03)) { n++; s.st = Math.min(100, s.st + 2); }
      a.detail = [res.log, ACT.XMAS.npcLine(G.rng, n + (a.hit ? 1 : 0))].join(' · ');
      a.tone = a.hit ? 'bad' : tierTone(res);
      if (a.hit) {
        const hs = ACT.XMAS.hitScene(G.rng, {});
        a.stage = 'hit';
        IO.ask(G, scene(G, { tag: 'xmas_hit', title: hs.title, text: hs.text, options: hs.options.map((o) => opt(o.id, o.label, o.sub, o.tone)) }));
        return;
      }
      a.stage = 'emit';
      return;
    }
    case 'hit': {
      const sel = a.sel;
      a.sel = null;
      say(G, `คริสต์มาส: ${ACT.XMAS.texts.hit}`, 'bad');
      rcNote(G, ['คริสต์มาส', 'ลูกอมของซานต้าลงหัว']);
      if (sel === 'infirmary') { S.xmasInf = true; a.next = 'xmas_inf'; a.detail += ' · ไปห้องพยาบาล'; } else { applyFx(G, { health: -1, stress: 1.5, energy: -2 }); a.detail += ' · ฝืนดูปาร์ตี้ต่อทั้งที่ปวดหัว'; }
      a.stage = 'emit';
      return;
    }
    case 'emit': return fin(G, a, { detail: a.detail, tone: a.tone, what: 'คริสต์มาส: ปาร์ตี้ในหอประชุม', place: 'หอประชุม', placeKind: 'hall', tags: ['minigame'] });
    default: throw new Error('xmas_pm stage');
  }
}

function xmasInf(G, a) {
  const S = G.S;
  const pl = S.pl;
  if (S.dayB && S.dayB.day === S.day) {
    const bl = S.dayB.blocks.filter((b) => b.id !== 'p7' && b.id !== 'p8');
    const at = bl.findIndex((b) => b.id === 'free' || b.id === 'dinner');
    bl.splice(at < 0 ? bl.length : at, 0, { id: 'infirmary', from: '14:50', to: '16:30', minute: 890, end: 990, place: 'ห้องพยาบาล', placeKind: 'dorm', what: 'ห้องพยาบาล: ลูกอมของซานต้าลงหัว', done: false });
    S.dayB.blocks = bl;
  }
  runOthers(G, [7, 8], G.me.grade);
  const f = pl.friends.slice().sort((x, y) => y.closeness - x.closeness)[0];
  const res = resolveMg(G, 'xmas_infirmary', 'timing', 0.5, { visitor: f ? f.name : '' });
  applyMgFx(G, res.fx);
  S.xmasInf = false;
  a.blockId = 'infirmary';
  a.next = 'free';
  if (f) bumpFriend(G, f.id, 2);
  say(G, 'พักที่ห้องพยาบาลหลังโดนลูกอมของซานต้า', 'neutral', true);
  fin(G, a, { detail: res.log, tone: 'neutral', place: 'ห้องพยาบาล', placeKind: 'dorm', what: 'ห้องพยาบาล: ลูกอมของซานต้าลงหัว' });
}

// ---------------------------------------------------------------- colour sports day (CONTRACT3 section 12)
export function signupScene(G, chosen) {
  const c = playerColor(G);
  const sc = ACT.SPORTS.signupScene(G.rng, { color: c.id, no: c.no, chosen });
  return scene(G, {
    tag: 'sport_signup', title: sc.title, text: sc.text,
    card: [['สีของเรา', `สี${c.th}`], ['เลขที่', String(c.no)], ['ลงแล้ว', chosen.length ? chosen.map((id) => ACT.SPORTS.byId(id).name).join(', ') : 'ยังไม่ได้ลง']],
    options: sc.options.map((o) => { const x = opt(o.id, o.label, o.sub); if (o.disabled) { x.disabled = true; x.reason = o.reason; } if (o.selected) x.selected = true; return x; }),
    data: { chosen },
  });
}

export function answerSignup(G, payload, pd) {
  const S = G.S;
  const sp = S.pl.sports;
  let chosen = (pd.data.chosen || []).slice();
  const id = payload.optionId;
  if (id.startsWith('sport:')) {
    const e = id.slice(6);
    chosen = chosen.includes(e) ? chosen.filter((x) => x !== e) : [...chosen, e];
    S.queue.push(signupScene(G, chosen));
    return;
  }
  if (id === 'none') chosen = [];
  sp.entered = chosen;
  sp.signupDay = S.day;
  sp.done = false;
  sp.year = calOf(G).year;
  if (chosen.length) say(G, `สมัครกีฬาสี สี${playerColor(G).th}: ${chosen.map((x) => ACT.SPORTS.byId(x).name).join(', ')}`, 'neutral');
  else say(G, 'ไม่ลงกีฬาสีปีนี้', 'neutral', true);
}

const sameColorFriends = (G) => { const c = playerColor(G).id; return G.S.pl.friends.filter((f) => { const s = G.byId.get(f.id); return s && colorOfStudent(G, s).id === c; }); };

export function sportPractice(G) {
  const sp = G.S.pl.sports;
  const rng = G.rng;
  const evId = sp.entered[rng.int(0, sp.entered.length - 1)];
  const c = playerColor(G);
  const rival = G.S.pl.friends.find((f) => { const s = G.byId.get(f.id); return s && colorOfStudent(G, s).id !== c.id; });
  const res = resolveMg(G, 'sport_practice', 'timing', 0.5, { sportId: evId, rival: rival ? rival.name : '' });
  applyMgFx(G, res.fx);
  const mates = sameColorFriends(G);
  for (const f of mates) bumpFriend(G, f.id, E.SPORT_CLOSE_PRACTICE * 0.5);
  if (rng.chance(0.3)) {
    const pool = G.S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && colorOfStudent(G, s).id === c.id && !G.S.pl.friends.some((f) => f.id === s.id));
    if (pool.length) bumpFriend(G, addFriend2(G, pool[rng.int(0, pool.length - 1)]), 0);
  }
  return `ซ้อมกีฬาสี สี${c.th}: ${res.log}`;
}
function addFriend2(G, s) { const pl = G.S.pl; if (!pl.friends.some((f) => f.id === s.id) && pl.friends.length < E.FRIENDS_MAX) pl.friends.push({ id: s.id, name: s.name, grade: s.grade, room: s.room, closeness: 20 }); return s.id; }

function sportDay(G, a, part) {
  const S = G.S;
  const pl = S.pl;
  const sp = pl.sports;
  const c = playerColor(G);
  const ids = part === 'fri' ? sp.entered.filter((id) => ACT.SPORTS.byId(id).kind === 'mass') : part === 'am' ? sp.entered.filter((id) => ACT.SPORTS.byId(id).kind !== 'mass').slice(0, 1) : sp.entered.filter((id) => ACT.SPORTS.byId(id).kind !== 'mass').slice(1);
  const names = { fri: 'กีฬาสี: ขบวนพาเหรดและแสตนด์', am: 'กีฬาสี: รอบเช้า', pm: 'กีฬาสี: รอบชิง' };
  const what = { what: names[part], place: 'สนามกีฬา', placeKind: 'fair' };
  switch (a.stage) {
    case 'start': {
      if (part === 'fri') runHall(G, [5, 6, 7, 8]);
      npcFestival(G, 2.5);
      if (sick(G)) { a.i = 99; a.stage = 'emit'; a.detail = 'ไม่สบาย ไม่ได้ไปกีฬาสี'; a.tone = 'bad'; return; }
      if (part === 'fri' && !a.asked) { a.asked = true; a.stage = 'with'; IO.ask(G, companionScene(G, 'sport')); return; }
      a.i = 0; a.parts = [];
      a.stage = 'next';
      return;
    }
    case 'with': a.i = 0; a.parts = []; a.stage = 'next'; return;
    case 'next': {
      if (a.i >= ids.length) { a.stage = 'emit'; a.detail = a.parts.length ? a.parts.join(' · ') : `ดูกีฬาสีจากสแตนด์สี${c.th} ${ACT.SPORTS.commentary(G.rng, {})}`; a.tone = 'good'; return; }
      const ev = ACT.SPORTS.byId(ids[a.i]);
      a.cur = ev.id;
      let params = {};
      try { params = ev.spec(G.rng, { difficulty: mgDifficulty(G, ev.game), color: c.id }) || {}; } catch (e) { params = {}; }
      a.stage = 'got';
      launch(G, a, { filler: false, game: ev.game, title: `${ev.name} (สี${c.th})`, text: ev.blurb, params, ctxId: 'sport_' + ev.id, stage: part, who: S.companion ? companionLabel(S.companion) : '', placeKind: 'fair' });
      return;
    }
    case 'got': {
      const r = a.res;
      a.res = null;
      const ev = ACT.SPORTS.byId(a.cur);
      const score = clamp(r.score + 0.5 * companionBonus(S.companion), 0, 1);
      const sr = ACT.sportsResult(ev.id, score, { color: c.id }, G.rng);
      applyMgFx(G, sr.fx);
      sp.points = (sp.points || 0) + sr.points;
      for (const f of sameColorFriends(G)) bumpFriend(G, f.id, E.SPORT_CLOSE_DAY * 0.5);
      say(G, `กีฬาสี สี${c.th}: ${ev.name} ${sr.tier.th}`, tierTone(sr), true);
      a.parts.push(sr.log);
      a.i += 1;
      a.stage = 'next';
      return;
    }
    case 'emit': {
      if (part === 'pm') { a.stage = 'rank'; return; }
      return fin(G, a, { detail: a.detail, tone: a.tone, ...what, tags: a.parts && a.parts.length ? ['minigame'] : [] });
    }
    case 'rank': {
      const R = sportsRankingFor(G, sp.points || 0);
      sp.ranking = R.ranking;
      const me = R.ranking.find((x) => x.id === c.id);
      applyFx(G, ACT.colorRankFx(me.rank));
      for (const f of sameColorFriends(G)) bumpFriend(G, f.id, E.SPORT_CLOSE_DAY * 0.5);
      const mine = sp.entered.length ? `ลงแข่ง ${sp.entered.map((x) => ACT.SPORTS.byId(x).name).join(', ')}` : 'ไม่ได้ลงแข่ง';
      say(G, `กีฬาสี: สี${c.th}ได้ที่ ${me.rank} (${R.winner.th}ชนะ) ${mine}`, me.rank <= 2 ? 'good' : 'neutral');
      rcNote(G, ['กีฬาสี', `สี${c.th} ได้ที่ ${me.rank} · ${mine}`]);
      sp.done = true;
      S.companion = null;
      a.detail = `${a.detail} · สี${c.th}ได้ที่ ${me.rank}`;
      a.stage = 'rank_scene';
      IO.ask(G, scene(G, { tag: 'sport_rank', title: R.title, text: R.text, card: R.card.rows, options: [opt('ok', 'รับทราบ')] }));
      return;
    }
    case 'rank_scene': return fin(G, a, { detail: a.detail, tone: 'good', ...what, tags: a.parts && a.parts.length ? ['minigame'] : [] });
    default: throw new Error('sport stage');
  }
}
