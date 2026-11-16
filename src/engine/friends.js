// The player's friend graph, "go with whom" before festivals, the crush system and the partner (CONTRACT3 section 10).
// pl.friends = [{ id (NPC student id), name, grade, room, closeness 0..100 }], pl.partner = { id, name, grade, room,
// since, closeness, dates, lastDate } or null. Texts come from C2's ACT.COMPANION / ACT.CRUSH when they have the field,
// otherwise from the small local tables below.
import { Rng } from '../rng.js';
import { E } from './config.js';
import { clamp } from './util.js';
import { ACT } from './adapters.js';
import { roommates } from './world.js';
import { calOf, say, addTrust, applyFx } from './player.js';
export { partnerFactor } from './player.js';
import { scene, opt } from './pending.js';
import { getPlan, dayKind } from './plan.js';
import { applyMgFx } from './minigame.js';

const hash = (a, b) => (Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul((b + 1) | 0, 0xc2b2ae35)) >>> 0;
const f1 = (x) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- the friend list
export const friendOf = (pl, id) => pl.friends.find((f) => f.id === id) || null;

function trim(G) {
  const pl = G.S.pl;
  while (pl.friends.length > E.FRIENDS_MAX) {
    let worst = -1;
    pl.friends.forEach((f, i) => {
      if (pl.partner && f.id === pl.partner.id) return;
      if (worst < 0 || f.closeness < pl.friends[worst].closeness) worst = i;
    });
    if (worst < 0) break;
    pl.friends.splice(worst, 1);
  }
}

export function addFriend(G, s, closeness) {
  const pl = G.S.pl;
  if (!s || s.isPlayer) return null;
  let f = friendOf(pl, s.id);
  if (f) f.closeness = clamp(Math.max(f.closeness, closeness), 0, 100);
  else {
    f = { id: s.id, name: s.name, grade: s.grade, room: s.room, closeness: clamp(closeness, 0, 100) };
    pl.friends.push(f);
    trim(G);
  }
  return f;
}

export function bumpFriend(G, id, d) {
  const pl = G.S.pl;
  const f = friendOf(pl, id);
  if (!f) return;
  f.closeness = clamp(f.closeness + d, 0, 100);
  if (pl.partner && pl.partner.id === id) pl.partner.closeness = f.closeness;
}

// mean closeness of the nine closest (the old "dorm room" average), 25 when there are none
export function friendAvg(pl) {
  if (!pl.friends.length) return 25;
  const top = pl.friends.map((f) => f.closeness).sort((a, b) => b - a).slice(0, 9);
  return top.reduce((a, b) => a + b, 0) / top.length;
}

// refresh name / grade / room (they change every year) and forget students who left
export function syncFriends(G) {
  const pl = G.S.pl;
  pl.friends = pl.friends.filter((f) => { const s = G.byId.get(f.id); return s && s.status === 'active'; });
  for (const f of pl.friends) { const s = G.byId.get(f.id); f.name = s.name; f.grade = s.grade; f.room = s.room; }
  if (pl.partner) {
    const s = G.byId.get(pl.partner.id);
    if (!s || s.status !== 'active') pl.partner = null;
    else { pl.partner.grade = s.grade; pl.partner.room = s.room; }
  }
}

// start of the game and the start of a new year: roommates, classmates, then (each term) clubmates and the Saturday group
export function setupFriends(G, keepOld) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  if (!keepOld) {
    // a new year: friendships cool a little, the partner stays
    for (const f of pl.friends || []) f.closeness = pl.partner && f.id === pl.partner.id ? f.closeness : f.closeness * 0.7;
  }
  for (const r of roommates(G, me)) addFriend(G, r, keepOld ? 25 : 22);
  const room = G.rooms[me.grade] && G.rooms[me.grade][me.room] ? G.rooms[me.grade][me.room] : [];
  const mates = room.filter((s) => !s.isPlayer && !friendOf(pl, s.id));
  for (let i = 0; i < 3 && mates.length; i++) addFriend(G, mates.splice(G.rng.int(0, mates.length - 1), 1)[0], 18 + G.rng.int(0, 6));
  syncFriends(G);
}

export function termFriends(G) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const pool = S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && s.grade === me.grade && !friendOf(pl, s.id));
  const club = pool.filter((s) => pl.clubId && s.club === pl.clubId);
  const sat = pool.filter((s) => pl.satGroup && s.sat === pl.satGroup);
  for (const list of [club, sat]) {
    for (let k = 0; k < 2 && list.length; k++) addFriend(G, list.splice(G.rng.int(0, list.length - 1), 1)[0], 15 + G.rng.int(0, 8));
  }
}

// every night: friendships fade slowly, roommates see each other, a partner lifts friends and teachers a little (per cycle)
export function nightlyFriends(G, cal) {
  const pl = G.S.pl;
  const mates = new Set(roommates(G, G.me).map((m) => m.id));
  for (const f of pl.friends) {
    if (mates.has(f.id)) f.closeness = clamp(f.closeness + E.FRIEND_ROOMMATE_GAIN, 0, 100);
    if (f.closeness > 15) f.closeness = clamp(f.closeness - E.FRIEND_DECAY * (f.closeness - 15), 0, 100);
  }
  const p = pl.partner;
  if (p) {
    pl.stress = clamp(pl.stress - E.PARTNER_STRESS, 0, 100);
    if (cal.dayInCycle === 1) {
      for (const f of pl.friends) f.closeness = clamp(f.closeness + E.PARTNER_FRIEND_GAIN, 0, 100);
      addTrust(G, E.PARTNER_TRUST_GAIN);
    }
    const f = friendOf(pl, p.id);
    p.closeness = f ? f.closeness : p.closeness;
  }
  if (pl.heartbreak > 0) pl.stress = clamp(pl.stress + E.HEARTBREAK_STRESS, 0, 100);
}

export function friendsView(G) {
  const pl = G.S.pl;
  const sorted = pl.friends.slice().sort((a, b) => b.closeness - a.closeness);
  let top = sorted.slice(0, 8);
  if (pl.partner && !top.some((f) => f.id === pl.partner.id)) { const pf = friendOf(pl, pl.partner.id); if (pf) top = [...top.slice(0, 7), pf]; }
  return top.map((f) => ({ id: f.id, name: f.name, grade: f.grade, room: f.room, closeness: Math.round(f.closeness), partner: !!(pl.partner && pl.partner.id === f.id) }));
}

export function partnerView(G) {
  const p = G.S.pl.partner;
  return p ? { id: p.id, name: p.name, grade: p.grade, room: p.room, since: p.since, closeness: Math.round(p.closeness) } : null;
}

// ---------------------------------------------------------------- go with whom
// C2: COMPANION.scene(eventId, { friends, partner, acquaintance }, rng) and companionEffect(eventId, closeness|'alone'|'group', rng, name)
export function companionScene(G, eventId) {
  const S = G.S;
  const pl = S.pl;
  const sorted = pl.friends.slice().sort((a, b) => b.closeness - a.closeness);
  const partner = pl.partner ? friendOf(pl, pl.partner.id) || pl.partner : null;
  const top = sorted.filter((f) => !partner || f.id !== partner.id).slice(0, 4);
  const rest = sorted.filter((f) => !top.includes(f) && (!partner || f.id !== partner.id));
  let acq = rest.length ? rest[G.rng.int(0, rest.length - 1)] : null;
  if (!acq) {
    const pool = S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && Math.abs(s.grade - G.me.grade) <= 1 && !friendOf(pl, s.id));
    if (pool.length) { const s = pool[G.rng.int(0, pool.length - 1)]; acq = { id: s.id, name: s.name, grade: s.grade, room: s.room, closeness: 12 }; }
  }
  const cs = ACT.COMPANION.scene(eventId, { friends: top, partner, acquaintance: acq }, G.rng);
  const whos = {};
  const options = cs.options.map((o) => { whos[o.id] = o.who || null; const x = { id: o.id, label: o.label }; if (o.sub) x.sub = o.sub; return x; });
  return scene(G, { tag: 'companion', title: cs.title, text: cs.text, options, data: { eventId, whos } });
}

// payload.optionId -> S.companion { event, kind, id, name, closeness, eff }
export function setCompanion(G, eventId, optionId, whos) {
  const S = G.S;
  const w = (whos && whos[optionId]) || null;
  let c;
  if (!w) c = { event: eventId, kind: optionId === 'group' ? 'group' : 'alone', id: null, name: optionId === 'group' ? 'เพื่อนในห้อง' : '', closeness: optionId === 'group' ? Math.min(60, friendAvg(S.pl)) : 0 };
  else c = { event: eventId, kind: w.kind === 'acquaintance' ? 'friend' : w.kind, id: w.id, name: w.name, closeness: w.closeness };
  const key = c.kind === 'alone' ? 'alone' : c.kind === 'group' ? 'group' : c.closeness;
  c.eff = ACT.companionEffect(eventId, key, G.rng, c.name) || { fx: {}, closenessGain: 0, scoreBonus: 0, metNew: false, detail: '', line: '' };
  S.companion = c;
  return c;
}

export const companionLabel = (c) => (!c || c.kind === 'alone' ? '' : c.kind === 'group' ? 'กับเพื่อนในห้อง' : `กับ${c.name}`);

// effects of the whole event with this companion; returns a short text for the block detail
export function applyCompanion(G, c) {
  if (!c) return '';
  const pl = G.S.pl;
  const rng = G.rng;
  const e = c.eff || { fx: {} };
  applyFx(G, e.fx || {});
  let met = '';
  if (c.kind === 'friend' || c.kind === 'partner') {
    if (!friendOf(pl, c.id)) { const s = G.byId.get(c.id); if (s) addFriend(G, s, c.closeness); }
    bumpFriend(G, c.id, e.closenessGain || 2);
  } else if (c.kind === 'group') for (const f of pl.friends.slice(0, 5)) bumpFriend(G, f.id, 0.8);
  else if (e.metNew || rng.chance(E.ALONE_MEET_CHANCE * 0)) {
    const pool = G.S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && Math.abs(s.grade - G.me.grade) <= 1 && !friendOf(pl, s.id));
    if (pool.length) { const s = pool[rng.int(0, pool.length - 1)]; addFriend(G, s, 20); met = `ได้รู้จัก${s.name}`; say(G, `เดินคนเดียวแล้วได้รู้จัก${s.name} (ม.${s.grade}/${s.room})`, 'good'); }
  }
  return met || e.line || '';
}

// the score bonus of a close companion in the fair contests and the float (C2: scoreBonus 0..0.15)
export const companionBonus = (c) => (c && c.eff ? c.eff.scoreBonus || 0 : 0);

// ---------------------------------------------------------------- the crush system
// P(the confessor is the same sex as the player): cj's rule, 0.70 when the top 3 friends are all the player's sex,
// otherwise the placeholder mix (default 0.10)
export function crushSameSexP(G) {
  const pl = G.S.pl;
  const top = pl.friends.slice().sort((a, b) => b.closeness - a.closeness).slice(0, 3);
  const allSame = top.length >= 3 && top.every((f) => { const s = G.byId.get(f.id); return s && s.sex === G.me.sex; });
  return allSame ? E.CRUSH_SAME_SEX_IF_TOP3_SAME : E.CRUSH_SEX_MIX.same;
}

// the confessor: a real student, not in the player's dorm room, within 2 grades; the sex is rolled first
export function crushWho(G) {
  const me = G.me;
  let pool = G.S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && Math.abs(s.grade - me.grade) <= 2 && !(s.dorm === me.dorm && s.dormRoom === me.dormRoom));
  if (!pool.length) return null;
  const wantSame = G.rng.chance(crushSameSexP(G));
  const byS = pool.filter((s) => (s.sex === me.sex) === wantSame);
  if (byS.length) pool = byS;
  if (typeof ACT.crushWho === 'function') {
    const r = ACT.crushWho(G.rng, pool.map((s) => ({ id: s.id, name: s.name, sex: s.sex, grade: s.grade, room: s.room })));
    const id = r && typeof r === 'object' ? r.id : r;
    const s = G.byId.get(id);
    if (s && pool.includes(s)) return s;
  }
  return pool[G.rng.int(0, pool.length - 1)];
}

const YEAR_DAYS = E.TERM_CYCLES * 2 * 14;

// the day the confession of window w (1..3 = ม.1-2, ม.3-4, ม.5-6) arrives, or 0 when it does not
export function crushDay(G, w) {
  G.crushDays ||= {};
  if (G.crushDays[w] !== undefined) return G.crushDays[w];
  const rng = new Rng(hash(G.S.seed, 7000 + w));
  const fires = rng.chance(E.CRUSH_P);
  let day = 0;
  if (fires) {
    const weights = [];
    let total = 0;
    for (let y = 2 * w - 1; y <= 2 * w; y++) {
      const y0 = (y - 1) * YEAR_DAYS;
      for (let i = 1; i <= YEAR_DAYS; i++) {
        const d = y0 + i;
        const dic = ((i - 1) % 14) + 1;
        const cycleInYear = Math.floor((i - 1) / 14) + 1;
        const cit = cycleInYear <= E.TERM_CYCLES ? cycleInYear : cycleInYear - E.TERM_CYCLES;
        let wt = dic >= 13 ? 0 : 1;
        if (wt) {
          if (cycleInYear === E.TERM_CYCLES + E.ACT.FAIR_CYCLE && dic === 6) wt = E.CRUSH_FESTIVAL_WEIGHT; // the fair
          else if (cycleInYear === E.TERM_CYCLES + 8 && dic === 6) wt = E.CRUSH_FESTIVAL_WEIGHT; // the night show
          else if (cit === E.TERM_CYCLES) wt = 3; // the last cycle of a term
          if (i <= 3 && (y === 1 || y === 4)) wt = 0; // freshers days
        }
        weights.push([d, wt]);
        total += wt;
      }
    }
    let r = rng.float() * total;
    for (const [d, wt] of weights) { r -= wt; if (r < 0) { day = d; break; } }
  }
  G.crushDays[w] = day;
  return day;
}

export const crushWindow = (cal) => Math.ceil(cal.year / E.CRUSH_WINDOW_YEARS);

const PLAIN_SETTINGS = ['locker', 'after_class', 'dorm_gate', 'canteen', 'library', 'field', 'club', 'chat'];

function confessionScene(G, who, second) {
  const dk = dayKind(G);
  const setting = dk.fair ? 'fair' : dk.show ? 'show' : PLAIN_SETTINGS[G.rng.int(0, PLAIN_SETTINGS.length - 1)];
  const f = friendOf(G.S.pl, who.id);
  const closeness = Math.round(f ? f.closeness : 12);
  const cs = ACT.crushScene(G.rng, { who: { name: who.name, grade: who.grade, room: who.room }, setting, second: !!second });
  const p = scene(G, {
    tag: 'crush', title: cs.title, text: cs.text,
    card: [['ชื่อ', who.name], ['ชั้น/ห้อง', `ม.${who.grade}/${who.room}`], ['ความสนิท', String(closeness)]],
    options: cs.options.map((o) => opt(o.id, o.label, o.sub, o.tone)), data: { id: who.id, second: !!second },
  });
  p.card.person = { id: who.id, name: who.name, grade: who.grade, room: who.room, closeness };
  return p;
}

// called at the start of a day and after a festival: returns a scene or null. `festival` = called at the end of the fair / show.
export function crushScene(G, festival = false) {
  const S = G.S;
  const pl = S.pl;
  const cal = calOf(G);
  const cr = S.crush;
  if (S.queue.length || S.pending) return null;
  if (pl.partner) return null;
  // a question that was put off
  if (cr.askAt && S.day >= cr.askAt && cr.who !== null) {
    const who = G.byId.get(cr.who);
    cr.askAt = 0;
    if (who && who.status === 'active') return confessionScene(G, who, true);
    return null;
  }
  const w = crushWindow(cal);
  if (cr.done[w]) return null;
  const d = crushDay(G, w);
  if (!d || S.day < d) return null;
  const dk = dayKind(G);
  const fest = !!(dk.fair || dk.show);
  if (fest !== festival) return null; // fair / show days raise it after the event
  if (!fest && (getPlan(G).playDays[S.day] || dk.fresher)) return null;
  const who = crushWho(G);
  cr.done[w] = true;
  if (!who) return null;
  cr.who = who.id;
  return confessionScene(G, who, false);
}

export function startPartner(G, s) {
  const pl = G.S.pl;
  pl.partner = { id: s.id, name: s.name, grade: s.grade, room: s.room, since: G.S.day, closeness: 45, dates: 0, lastDate: G.S.day }; // set first: the friend list never trims the partner
  const f = addFriend(G, s, 45) || friendOf(pl, s.id);
  if (f) { f.closeness = Math.max(f.closeness, 45); pl.partner.closeness = f.closeness; }
}

function crushCtx(G, name, extra) {
  const p = G.S.pl.partner;
  return { name, money: Math.round(G.me.money), closeness: p ? p.closeness : 0, ...extra };
}

export function answerCrush(G, payload, pd) {
  const S = G.S;
  const s = G.byId.get(pd.data.id);
  const name = s ? s.name : 'เขา';
  const o = payload.optionId;
  const r = ACT.resolveCrush(o, crushCtx(G, name, { second: pd.data.second }), G.rng);
  applyFx(G, r.fx || {});
  say(G, r.record || r.log, o === 'accept' ? 'good' : 'neutral');
  if (!s) return;
  if (o === 'accept') {
    startPartner(G, s);
    say(G, `เริ่มคบกับ${name} (ม.${s.grade}/${s.room})`, 'good');
  } else if (o === 'decline') {
    addFriend(G, s, 30);
    S.crush.who = null;
  } else {
    S.crush.askAt = S.day + E.CRUSH_ASK_DAYS;
  }
}

export function breakup(G, why) {
  const S = G.S;
  const pl = S.pl;
  const p = pl.partner;
  if (!p) return;
  pl.partner = null;
  pl.heartbreak = E.HEARTBREAK_TERMS;
  applyFx(G, { stress: 8, peer: -4 });
  const f = friendOf(pl, p.id);
  if (f) f.closeness = Math.max(15, f.closeness * 0.5);
  S.crush.exes = (S.crush.exes || 0) + 1;
  say(G, `เลิกกับ${p.name} (${why})`, 'bad');
}

export function breakupScene(G) {
  const p = G.S.pl.partner;
  const b = ACT.CRUSH.breakupText(G.rng, { name: p.name });
  return scene(G, {
    tag: 'breakup', title: 'เลิกกัน', text: b.text,
    options: [opt('ok', 'รับรู้ แล้วเลิกกัน', 'เครียดขึ้นและเหงาไปสักพัก', 'bad')],
    data: { id: p.id, reason: b.reason },
  });
}

export function answerBreakup(G, payload, pd) {
  const p = G.S.pl.partner;
  const r = ACT.resolveCrush('breakup', crushCtx(G, p ? p.name : 'เขา'), G.rng);
  applyFx(G, r.fx || {});
  breakup(G, pd.data.reason || 'ห่างกัน');
}

export function checkinScene(G) {
  const p = G.S.pl.partner;
  const c = ACT.CRUSH.checkin(G.rng, { name: p.name });
  return scene(G, {
    tag: 'partner_check', title: c.title, text: c.text,
    card: [['คบกันมา', `${Math.max(0, Math.round((G.S.day - p.since) / 14))} สัปดาห์สองสัปดาห์`], ['ความสนิท', String(Math.round(p.closeness))]],
    options: c.options.map((o) => opt(o.id, o.label, o.sub, o.tone)), data: { id: p.id },
  });
}

export function answerCheckin(G, payload) {
  const p = G.S.pl.partner;
  if (!p) return;
  const o = payload.optionId;
  const r = ACT.resolveCrush(o, crushCtx(G, p.name), G.rng);
  applyFx(G, r.fx || {});
  if (o === 'checkin_end') { say(G, r.record || r.log, 'bad'); breakup(G, 'เราเป็นฝ่ายขอเลิก'); return; }
  if (o === 'checkin_focus') p.focusUntil = G.S.day + E.PARTNER_FOCUS_DAYS;
  bumpFriend(G, p.id, 1.5);
  say(G, r.record || r.log, 'good');
}

// a date: free-time action
export function doDate(G) {
  const pl = G.S.pl;
  const p = pl.partner;
  if (!p) return;
  const r = ACT.resolveCrush('date', crushCtx(G, p.name), G.rng);
  applyMgFx(G, r.fx || {});
  p.dates = (p.dates || 0) + 1;
  p.lastDate = G.S.day;
  bumpFriend(G, p.id, 2.5);
  say(G, r.record || r.log, 'good', true);
}

export function breakupRoll(G) {
  const S = G.S;
  const pl = S.pl;
  const p = pl.partner;
  if (pl.heartbreak > 0) pl.heartbreak -= 1;
  if (!p) return null;
  let pr = E.BREAKUP_PER_TERM;
  if (S.routine.study === 'relax') pr += E.BREAKUP_RELAX;
  if (S.day - (p.lastDate || p.since) > E.BREAKUP_NO_DATE_DAYS) pr += E.BREAKUP_NO_DATE;
  if (!G.rng.chance(pr)) return null;
  return breakupScene(G);
}
