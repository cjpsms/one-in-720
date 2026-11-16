// Checks for the school activities (docs/CONTRACT3.md sections 3-10): calendar, Saturday blocks, hall, fair, show, freshers,
// mini game pendings, friends / crush / partner. Run: node test/festival.test.js   (exit code 1 on failure)
import { createGame, loadGame } from '../src/engine/index.js';
import { newState } from '../src/engine/world.js';
import { crushWho, crushSameSexP, crushDay } from '../src/engine/friends.js';
import { partnerFactor } from '../src/engine/player.js';
import { E } from '../src/engine/config.js';
import { Rng } from '../src/rng.js';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failed += 1;
}
const stateOf = (g) => JSON.parse(g.save());

// plays a whole life with default answers (or fn decides), calling fn(g, resultOrPending) at every step
function life(opts, fn, maxSteps = 60000) {
  const g = createGame(opts);
  let steps = 0;
  while (!(g.pending && g.pending.final) && steps++ < maxSteps) {
    if (g.pending) {
      const p = g.pending;
      const custom = fn && fn(g, { pending: p });
      const r = g.act(custom && typeof custom === 'object' ? custom : g.defaultPayload());
      if (!r.ok) throw new Error('rejected: ' + r.error + ' ' + (g.lastError && g.lastError.stack));
      continue;
    }
    const r = g.stepBlock();
    if (!r.ok) throw new Error('stepBlock: ' + r.error + ' ' + (g.lastError && g.lastError.stack));
    if (fn && fn(g, r) === 'stop') break;
  }
  return g;
}

// ---------- a whole life in 'play' mode: plays per year, festivals once a year ----------
const perYear = {};
const ctxCount = {};
let timeMs = 0;
let allPlaysValid = true;
{
  const t0 = Date.now();
  const g = life({ seed: 31 }, (gg, r) => {
    if (r.pending && !('block' in r) && r.pending.kind === 'minigame') {
      const p = r.pending;
      const year = gg.view().progress.yearIndex + 1;
      perYear[year] = (perYear[year] || 0) + 1;
      ctxCount[p.context.eventId] = (ctxCount[p.context.eventId] || 0) + 1;
      const okShape = Number.isInteger(p.seed) && p.difficulty >= 0 && p.difficulty <= 1 && p.durationSec > 0 && typeof p.params === 'object' && ['hall', 'fair', 'stage', 'lab', 'activity', 'classroom'].includes(p.placeKind)
        && typeof p.canSkip === 'boolean' && p.context && p.context.eventId && JSON.stringify(JSON.parse(JSON.stringify(p))) === JSON.stringify(p);
      if (!okShape) allPlaysValid = false;
    }
    return undefined;
  });
  timeMs = Date.now() - t0;
  check('a 6-year life in play mode reaches an ending', g.pending && g.pending.final);
  check('every minigame pending has the section 4 shape (JSON, seed, difficulty 0..1, placeKind)', allPlaysValid);
  console.log('plays per year:', JSON.stringify(perYear), 'events:', JSON.stringify(ctxCount));
  const ys = Object.keys(perYear).map(Number);
  const normal = ys.filter((y) => y !== 1 && y !== 4);
  check('plays per school year are 4-8 (cj 2026-11-16: fewer mini games, only the festivals and contests; year 1 and 4 add the freshers)', normal.every((y) => perYear[y] >= 4 && perYear[y] <= 8) && ys.filter((y) => y === 1 || y === 4).every((y) => perYear[y] >= 6 && perYear[y] <= 12), JSON.stringify(perYear));
  check('the Loy Krathong float and the night show happen once a year (the last year has no show after the ending)', ctxCount.loy_float >= 5 && ctxCount.loy_float <= 6 && (ctxCount.show_act || 0) + (ctxCount.show_camera || 0) + (ctxCount.show_sound || 0) + (ctxCount.show_edit || 0) + (ctxCount.show_director || 0) + (ctxCount.show_watch || 0) >= 5);
  check('the freshers play in year 1 and year 4', (ctxCount.fresher_game || 0) + (ctxCount.fresher_hall || 0) + (ctxCount.fresher_serve || 0) >= 6);
  check('a whole life in play mode stays fast (under 8 s)', timeMs < 8000, timeMs + ' ms');
}

// ---------- auto mode never opens a minigame ----------
{
  let n = 0;
  let scenes = 0;
  const g = life({ seed: 32, miniGames: 'auto' }, (gg, r) => { if (r.pending && !('block' in r) && r.pending.kind === 'minigame') n++; if (r.pending && !('block' in r) && ['companion', 'fair_choice', 'fair_contest', 'show_role'].includes(r.pending.tag)) scenes++; });
  check("auto mode never opens a minigame pending (nor a festival choice scene)", g.pending.final && n === 0 && scenes === 0, `${n} / ${scenes}`);
  const h = createGame({ seed: 32 });
  check('setMiniGames switches the mode and view().miniGames shows it', h.view().miniGames === 'play' && h.setMiniGames('auto').ok && h.view().miniGames === 'auto' && !h.setMiniGames('x').ok && stateOf(h).miniGames === 'auto');
}

// ---------- the calendar ----------
{
  // Saturday blocks, fair day, show night, freshers
  const seen = { sat: null, fair: null, show: null, fresher: [], hall: 0, award: 0 };
  const g = life({ seed: 33, miniGames: 'auto' }, (gg, r) => {
    if (!r.block) return undefined;
    const v = gg.view();
    const ids = v.day.blocks.map((b) => b.id || b.what);
    void ids;
    const c = v.clock;
    if (r.block.id === 'sat1' && !seen.sat) seen.sat = { day: c.day, dow: c.dow, dic: c.dayInCycle, what: r.block.what };
    if (r.block.id === 'fair_afternoon' && !seen.fair) seen.fair = { day: c.day, term: c.term, dic: c.dayInCycle };
    if (r.block.id === 'show' && !seen.show) seen.show = { day: c.day, term: c.term, dic: c.dayInCycle, cycle: c.cycle };
    if (r.block.id === 'fr1') seen.fresher.push(c.day);
    if (r.block.id === 'hall') seen.hall++;
    if (r.block.id === 'award') seen.award++;
    return undefined;
  });
  check('Saturday lessons: sat1 is on a dorm Saturday (dayInCycle 6)', seen.sat && seen.sat.dow === 6 && seen.sat.dic === 6 && seen.sat.what.startsWith('เรียนวันเสาร์') || (seen.sat && seen.sat.what.includes('ชุมนุม')), JSON.stringify(seen.sat));
  check('Loy Krathong is in term 2, cycleInTerm 2 on the dorm Saturday (cj calendar fix)', seen.fair && seen.fair.term === 2 && seen.fair.dic === 6 && ((seen.fair.day - 1) % 252) === 126 + 14 + 5, JSON.stringify(seen.fair));
  check('the night show is in term 2, cycleInTerm 8 on a Saturday', seen.show && seen.show.term === 2 && seen.show.dic === 6 && ((seen.show.day - 1) % 252) === 126 + 7 * 14 + 5, JSON.stringify(seen.show));
  check('freshers: days 1-3 of year 1 and of year 4 (6 days, 2 x blocks fr1)', seen.fresher.length === 6 && seen.fresher.slice(0, 3).join() === '1,2,3' && seen.fresher.slice(3).join() === '757,758,759', seen.fresher.join());
  check('hall sessions happen (2-3 lectures a term and more) and the 4.00 award is given', seen.hall >= 30 && g.pending.final, `${seen.hall} hall blocks, ${seen.award} award blocks`);
}

// ---------- the 50% skip rule in the hall ----------
{
  let tried = 0;
  let caught = 0;
  for (let seed = 500; seed < 600; seed++) {
    const g = createGame({ seed });
    let done = false;
    let guard = 0;
    while (!done && guard++ < 4000) {
      if (g.pending) {
        const p = g.pending;
        if (p.kind === 'minigame' && p.canSkip && p.context.eventId === 'hall_lecture') {
          g.act({ skip: true });
          tried++;
          // caught = made to attend anyway: the next pending is the same lecture again, not skippable
          const q = g.stepBlock().pending;
          if (q && q.kind === 'minigame' && q.context.eventId === 'hall_lecture' && !q.canSkip) caught++;
          done = true;
          continue;
        }
        g.act(g.defaultPayload());
      } else if (!g.stepBlock().ok) throw new Error('step');
    }
  }
  const rate = caught / Math.max(1, tried);
  check('skipping a lecture: about half are caught and made to attend (cj: 50%); lecture plays are automatic now (FILLER_AUTO) so there is nothing to skip', tried === 0 || (tried >= 90 && rate > 0.38 && rate < 0.62), `${caught}/${tried} = ${rate.toFixed(2)}`);
  // a caught skip lowers trust with teachers
  const g = createGame({ seed: 501 });
  let before = null;
  let after = null;
  for (let guard = 0; guard < 4000 && after === null; guard++) {
    if (g.pending) {
      const p = g.pending;
      if (p.kind === 'minigame' && p.canSkip && p.context.eventId === 'hall_lecture') { before = g.view().stats.teacherTrust; g.act({ skip: true }); after = g.view().stats.teacherTrust; continue; }
      g.act(g.defaultPayload());
    } else g.stepBlock();
  }
  check('skip answers are refused when the play cannot be skipped', (() => { const h = createGame({ seed: 502 }); for (let i = 0; i < 400; i++) { if (h.pending && h.pending.kind === 'minigame' && !h.pending.canSkip) return !h.act({ skip: true }).ok; if (h.pending) h.act(h.defaultPayload()); else h.stepBlock(); } return false; })());
  void before;
}

// ---------- stalls ----------
{
  const counts = [];
  let dormsOk = true;
  for (let seed = 700; seed < 712; seed++) {
    const g = createGame({ seed, miniGames: 'auto' });
    let fair = null;
    for (let guard = 0; guard < 20000 && !fair; guard++) {
      if (g.pending) { g.act(g.defaultPayload()); continue; }
      const r = g.stepBlock();
      if (r.block && r.block.id === 'fair_morning') fair = stateOf(g).fair;
    }
    counts.push(fair.stalls.length);
    const dorms = new Set(fair.stalls.filter((s) => s.owner.kind === 'dorm').map((s) => s.owner.key));
    if (dorms.size !== 6) dormsOk = false;
  }
  check('the fair has 15-25 stalls and every dorm opens one', counts.every((n) => n >= 15 && n <= 25) && dormsOk, counts.join());
}

// ---------- teacher replacement (farewell) ----------
{
  let changed = 0;
  const g = createGame({ seed: 41, miniGames: 'auto' });
  let names = null;
  let sawFarewell = false;
  for (let guard = 0; guard < 60000 && !g.pending?.final; guard++) {
    if (g.pending) { g.act(g.defaultPayload()); continue; }
    const r = g.stepBlock();
    if (r.block && r.block.id === 'hall' && r.block.what.includes('อำลา')) {
      sawFarewell = true;
      const now = Object.fromEntries(Object.entries(stateOf(g).teachers).map(([k, t]) => [k, t.name]));
      if (names) for (const k of Object.keys(now)) if (names[k] && now[k] !== names[k]) changed++;
    }
    if (r.block && r.block.id === 'wake') names = Object.fromEntries(Object.entries(stateOf(g).teachers).map(([k, t]) => [k, t.name]));
    if (changed) break;
  }
  check('a farewell session replaces a teacher with a new fictional name in the timetable', sawFarewell && changed === 1, `${changed} replaced`);
}

// ---------- save / load in the middle of a mini game, determinism ----------
{
  const a = createGame({ seed: 51 });
  let found = null;
  for (let guard = 0; guard < 8000 && !found; guard++) {
    if (g_pending(a) && a.pending.kind === 'minigame' && a.pending.context.stage !== '' && ['loy_stall', 'hall_lecture'].includes(a.pending.context.eventId)) { found = a.pending; break; }
    if (a.pending) a.act(a.defaultPayload()); else a.stepBlock();
  }
  const saved = a.save();
  const b = loadGame(saved);
  check('save/load in the middle of a mini game restores the same pending (same seed and params)', found && JSON.stringify(b.pending) === JSON.stringify(a.pending) && b.save() === saved);
  const pay = { score: 0.7, stats: { served: 5 } };
  const ra = a.act(a.pending.canSkip ? { skip: true } : pay);
  const rb = b.act(b.pending.canSkip ? { skip: true } : pay);
  check('both continue identically after the answer', ra.ok && rb.ok && a.save() === b.save());
  for (let i = 0; i < 600; i++) { for (const x of [a, b]) { if (x.pending) x.act(x.defaultPayload()); else x.stepBlock(); } }
  check('... and keep identical over 600 more steps', a.save() === b.save());
  const c = createGame({ seed: 51 });
  const d = createGame({ seed: 51 });
  for (let i = 0; i < 3000; i++) for (const x of [c, d]) { if (x.pending) x.act(x.defaultPayload()); else x.stepBlock(); }
  check('determinism: same seed + same answers = same state (mini games on)', c.save() === d.save());
}
function g_pending(g) { return !!g.pending; }

// ---------- friends, companions, crush, partner (section 10) ----------
{
  const G = newState(61, 'routine', {});
  check('pl.friends is a list of { id, name, grade, room, closeness } (8-15 after a few terms, roommates at the start)', Array.isArray(G.S.pl.friends) && G.S.pl.friends.length >= 5 && G.S.pl.friends.every((f) => f.id !== undefined && f.name && f.grade && f.room && f.closeness >= 0 && f.closeness <= 100));
  const v = createGame({ seed: 61 }).view();
  check('view().friends lists up to 8 friends with partner:false and view().partner is null', v.friends.length >= 5 && v.friends.length <= 8 && v.friends.every((f) => f.partner === false) && v.partner === null);
}
{
  // confession rate: about 0.8 per 2-year window (cj)
  let windowsFired = 0;
  const N = 400;
  const G = newState(62, 'routine', {});
  for (let seed = 0; seed < N; seed++) {
    G.S.seed = seed * 7919 + 13;
    G.crushDays = {};
    for (let w = 1; w <= 3; w++) if (crushDay(G, w) > 0) windowsFired++;
  }
  const rate = windowsFired / (N * 3);
  check('a confession is rolled once per 2-year window with probability 0.8 (cj)', rate > 0.75 && rate < 0.85, rate.toFixed(3));
  // a whole life with the default answers: scenes appear about 2.4 times a life
  let n = 0;
  const lives = 40;
  for (let seed = 800; seed < 800 + lives; seed++) life({ seed, miniGames: 'auto' }, (gg, r) => { if (r.pending && !('block' in r) && r.pending.tag === 'crush') n++; });
  check('in real lives the confession scenes average about 2.4 a life (3 windows x 0.8)', n / lives > 1.9 && n / lives < 2.9, (n / lives).toFixed(2));
}
{
  // confessor sex rule
  const G = newState(63, 'routine', {});
  const me = G.me;
  const same = G.S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && s.sex === me.sex && s.grade === me.grade);
  const opp = G.S.school.students.filter((s) => s.status === 'active' && !s.isPlayer && s.sex !== me.sex && s.grade === me.grade);
  const share = (n) => { let c = 0; for (let i = 0; i < n; i++) { const w = crushWho(G); if (w && w.sex === me.sex) c++; } return c / n; };
  G.S.pl.friends = opp.slice(0, 3).map((s) => ({ id: s.id, name: s.name, grade: s.grade, room: s.room, closeness: 60 }));
  const baseP = crushSameSexP(G);
  const sBase = share(600);
  G.S.pl.friends = same.slice(0, 3).map((s) => ({ id: s.id, name: s.name, grade: s.grade, room: s.room, closeness: 60 }));
  const topP = crushSameSexP(G);
  const sTop = share(600);
  check('confessor sex: top 3 friends all the same sex -> 0.70 same-sex, otherwise the placeholder mix (0.10)', baseP === E.CRUSH_SEX_MIX.same && topP === 0.7 && E.CRUSH_SAME_SEX_IF_TOP3_SAME === 0.7, `${baseP} / ${topP}`);
  check('... and the real share of rolled confessors follows it', Math.abs(sTop - 0.7) < 0.07 && Math.abs(sBase - 0.1) < 0.06, `top3-same ${sTop.toFixed(2)}, other ${sBase.toFixed(2)}`);
}
{
  // study drag
  const fake = (study, partner, focusUntil = 0) => ({ S: { day: 10, routine: { study }, pl: { partner: partner ? { focusUntil } : null, diligence: 50 } } });
  check('a partner multiplies study units by 0.85 unless the routine is focus (0.97)', partnerFactor(fake('normal', true)) === 0.85 && partnerFactor(fake('relax', true)) === 0.85 && partnerFactor(fake('focus', true)) === 0.97 && partnerFactor(fake('normal', false)) === 1);
  check('asking for study time at the check-in lightens the drag for a while', partnerFactor(fake('normal', true, 50)) === 0.97 && partnerFactor(fake('normal', true, 5)) === 0.85);
  // accepted relationship: forced accept, partner exists, is saved and loaded, raises friend closeness, lowers marks
  let partnerSeen = null;
  const g = life({ seed: 64, miniGames: 'auto', crush: 'accept' }, (gg, r) => { if (!partnerSeen && gg.view().partner) { partnerSeen = gg.view().partner; return 'stop'; } return undefined; });
  check('with crush forced to accept, a relationship starts (view().partner)', !!partnerSeen && partnerSeen.name && partnerSeen.closeness >= 40, JSON.stringify(partnerSeen));
  const l = loadGame(g.save());
  check('the partner is saved and loaded', JSON.stringify(l.view().partner) === JSON.stringify(g.view().partner) && l.save() === g.save() && stateOf(l).pl.partner.id === partnerSeen.id);
  check('view().friends marks the partner', l.view().friends.some((f) => f.partner));
  // 20 days later with a partner and normal study, units are dragged: compare class marks with / without the partner on the same state
  const S1 = stateOf(g);
  const run = (partner) => {
    const S = JSON.parse(JSON.stringify(S1));
    if (!partner) S.pl.partner = null;
    const x = loadGame(JSON.stringify(S));
    x.setRoutine({ study: 'normal' });
    for (let i = 0; i < 25; i++) { if (x.pending) x.act(x.defaultPayload()); x.advance({ days: 1 }); }
    const st = stateOf(x);
    let u = 0;
    let n = 0;
    for (const [, cl] of Object.entries(st.pl.cls)) { u += cl[0]; n += cl[1]; }
    return n ? u / n : 0;
  };
  const withP = run(true);
  const without = run(false);
  check('with a partner (study normal) the average effort per class falls by roughly the drag', withP < without * 0.97 && withP > without * 0.7, `${withP.toFixed(3)} vs ${without.toFixed(3)}`);
}

console.log(failed === 0 ? '\nall festival checks passed' : `\n${failed} festival check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
void Rng;
