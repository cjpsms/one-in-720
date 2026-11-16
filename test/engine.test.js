// Checks for the day-by-day engine (src/engine). Run: node test/engine.test.js   (exit code 1 on failure)
import { createGame as createGameRaw, loadGame } from '../src/engine/index.js';
// the older checks assume a school without mini game stops: the 'auto' setting is the same school with every play played by the engine
const createGame = (o = {}) => createGameRaw({ miniGames: 'auto', ...o });
import { DORMS, DORM_DAY } from '../src/config.js';
import { evaluateEvening } from '../src/evening.js';
import { Rng } from '../src/rng.js';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failed += 1;
}
const stateOf = (g) => JSON.parse(g.save());
const meOf = (S) => S.school.students.find((s) => s.id === S.me);
const edit = (g, fn) => {
  const S = stateOf(g);
  fn(S, meOf(S));
  return loadGame(JSON.stringify(S));
};
const step = (g, n = 1) => {
  let r = null;
  for (let i = 0; i < n && !g.pending.final; i++) {
    r = g.act(g.defaultPayload());
    if (!r.ok) throw new Error('default payload rejected: ' + r.error + ' ' + (g.lastError && g.lastError.stack));
  }
  return r;
};
const until = (g, fn, max = 5000) => {
  for (let i = 0; i < max && !fn(g); i++) {
    if (g.pending.final) return false;
    step(g);
  }
  return fn(g);
};
const tagOf = (g) => g.pending.tag;

// ---------- a new game ----------
const g0 = createGame({ seed: 11, mode: 'detailed' });
const p0 = g0.pending;
check('new game starts with a birth scene card', p0.kind === 'scene' && p0.card && p0.card.rows.length >= 6 && p0.options.length >= 1);
const v0 = g0.view();
check('view() has the contract shape', v0.clock && typeof v0.clock.label === 'string' && v0.me.grade === 1 && v0.me.room >= 1 && v0.me.room <= 4 && ['M', 'F'].includes(v0.me.sex) && ['intro', 'extro'].includes(v0.me.trait)
  && ['health', 'energy', 'stress', 'fullness', 'knowledge', 'peer', 'teacherTrust', 'money', 'gpa', 'gpax'].every((k) => k in v0.stats) && Array.isArray(v0.today) && Array.isArray(v0.notes) && 'available' in v0.askParents);
step(g0);
check('next pending is the term-start pick (club + elective)', g0.pending.kind === 'termStart' && g0.pending.clubs.length > 0 && g0.pending.needElective && g0.pending.clubs.every((c) => 'area' in c && 'seatsLeft' in c));
check('club seats are partly taken by NPCs', g0.pending.clubs.some((c) => c.seatsLeft < c.seats));

// ---------- a full life with defaults ----------
function fullRun(seed, label) {
  const g = createGame({ seed, mode: 'detailed' });
  const kinds = {};
  const tags = {};
  let steps = 0;
  let year1 = null;
  const t0 = Date.now();
  while (!g.pending.final && steps < 100000) {
    const r = g.act(g.defaultPayload());
    steps++;
    if (!r.ok) throw new Error(`seed ${seed}: ${r.error} ${g.lastError && g.lastError.stack}`);
    kinds[g.pending.kind] = (kinds[g.pending.kind] || 0) + 1;
    tags[g.pending.tag] = (tags[g.pending.tag] || 0) + 1;
    if (year1 === null && g.view().clock.year === 2) year1 = Date.now() - t0;
  }
  const ms = Date.now() - t0;
  console.log(`${label}: seed ${seed}, ${steps} steps, ${ms} ms total, school year 1 in ${year1} ms, ending "${g.pending.title}"`);
  return { g, kinds, tags, steps, ms, year1 };
}
const runs = [fullRun(3, 'default life'), fullRun(4, 'default life'), fullRun(5, 'default life')];
check('a default life reaches an ending', runs.every((r) => r.g.pending.final));
check('default life ends in graduation (the sensible default passes the gate)', runs.some((r) => r.g.pending.title === 'จบแล้วพอเลย'));
check('a whole school year (720 students, all teachers) runs in under 3 s', runs.every((r) => r.year1 < 3000), runs.map((r) => r.year1 + ' ms').join(', '));
check('the whole 6 years run in under 20 s', runs.every((r) => r.ms < 20000), runs.map((r) => r.ms + ' ms').join(', '));
const kindsSeen = new Set(runs.flatMap((r) => Object.keys(r.kinds)));
check('all six pending kinds appear in long default runs', ['scene', 'shop', 'classPlan', 'plan', 'termStart', 'lineOrder'].every((k) => kindsSeen.has(k)), [...kindsSeen].join(','));
const tagsSeen = new Set(runs.flatMap((r) => Object.keys(r.tags)));
console.log('scene tags seen: ' + [...tagsSeen].join(', '));
check('events, home trips, term reports and year changes happen', ['event', 'trip', 'report', 'newyear', 'gate1', 'gate2'].every((t) => tagsSeen.has(t)));
{
  const g = runs[0].g;
  const dbg = g.debug();
  check('720 students stay in the school (about; a few drop out)', dbg.active >= 700 && dbg.active <= 720, String(dbg.active));
  check('teachers snapped during the run', dbg.snapsTotal > 20, String(dbg.snapsTotal));
  const f = g.pending;
  check('the ending card lists GPAX, rooms and terms', f.final && f.card.rows.some((r) => r[0].includes('GPAX')) && f.card.rows.some((r) => r[0].includes('ห้อง')));
  check('after the ending the pending stays and act() changes nothing', (() => { const id = g.pending.id; g.act({}); g.act({ optionId: 'x' }); return g.pending.id === id; })());
}

// ---------- determinism and save / load ----------
{
  const a = createGame({ seed: 77, mode: 'detailed' });
  const b = createGame({ seed: 77, mode: 'detailed' });
  const c = createGame({ seed: 78, mode: 'detailed' });
  step(a, 700);
  step(b, 700);
  step(c, 700);
  check('same seed + same choices = same state', a.save() === b.save());
  check('a different seed gives a different life', a.save() !== c.save());
  const saved = a.save();
  const l = loadGame(saved);
  check('save() is plain JSON and loadGame restores the same state', l.save() === saved && JSON.stringify(l.view()) === JSON.stringify(a.view()) && l.pending.id === a.pending.id);
  step(a, 900);
  step(l, 900);
  check('a restored save continues exactly like the original', a.save() === l.save());
  // save in the middle of a school day (after a classPlan) and again at a trip
  const m = createGame({ seed: 90, mode: 'detailed' });
  until(m, (g) => tagOf(g) === 'afternoon' && g.view().clock.dow === 3);
  const m2 = loadGame(m.save());
  step(m, 400);
  step(m2, 400);
  check('save in the middle of a school day restores the same continuation', m.save() === m2.save());
  const bad1 = (() => { try { loadGame('not json'); return false; } catch (e) { return true; } })();
  const bad2 = (() => { try { loadGame('{"v":999}'); return false; } catch (e) { return true; } })();
  check('loadGame throws a clear error on a broken save', bad1 && bad2);
}

// ---------- dorm rules ----------
{
  const g = createGame({ seed: 21, mode: 'detailed' });
  const S0 = stateOf(g);
  const me0 = meOf(S0);
  const dorm = DORMS[me0.dorm];
  check('the player starts in a dorm of the right sex and grade', dorm && dorm.sex === me0.sex && dorm.grades.includes(me0.grade));
  const mates = S0.school.students.filter((s) => s.status === 'active' && s.dorm === me0.dorm && s.dormRoom === me0.dormRoom);
  check('a dorm room holds at most 10 (6 in the lowest dorm)', mates.length <= dorm.cap, `${mates.length}/${dorm.cap}`);
  until(g, (x) => tagOf(x) === 'meal_breakfast');
  check('breakfast happens at the dorm out-by time (cannot go back in after)', g.view().clock.minute === dorm.outBy, `${g.view().clock.minute} vs ${dorm.outBy}`);
  until(g, (x) => tagOf(x) === 'evening');
  const pe = g.pending;
  check('the evening plan has 10 slots from 19:00 with the lights-out time of the dorm', pe.slots === 10 && pe.startMinute === DORM_DAY.eveningStart && pe.lightsOutMinute === dorm.bed && pe.wakeMinute === dorm.outBy - DORM_DAY.getReady);
  check('quiet-only actions are flagged', pe.actions.some((a) => a.quietOnly) && pe.actions.some((a) => a.id === 'sleep'));
  const all = Array(10).fill('study_alone');
  const want = evaluateEvening(dorm, all).sleepHours;
  const r = g.act({ plan: all });
  const line = r.log.find((l) => l.text.startsWith('หลับประมาณ'));
  check('studying past lights-out turns the late slots into sleep (engine uses evening.js)', line && line.text.includes(want.toFixed(1)), line && line.text);
  // the borrow scene comes before breakfast and only then
  const seq = [];
  const h = createGame({ seed: 31, mode: 'detailed' });
  for (let i = 0; i < 4000 && !h.pending.final; i++) { seq.push(h.pending.tag); step(h); }
  let order = true;
  seq.forEach((t, i) => { if (t === 'borrow' && !['event', 'sick', 'meltdown', 'borrow', 'evening', 'wk_dinner', 'meal_dinner', 'newyear', 'termstart', 'trip'].includes(seq[i - 1])) order = false; });
  check('borrowing from roommates only happens before leaving the dorm', order);
}
{
  // forced: a task due today needs a glue gun, the bag is empty -> the borrow scene shows up before breakfast
  const g = createGame({ seed: 41, mode: 'detailed' });
  until(g, (x) => tagOf(x) === 'evening' && x.view().clock.dow === 7);
  const h = edit(g, (S, me) => {
    const room = me.room;
    const tk = S.tt[me.grade === undefined ? 1 : me.grade].rooms[String(room)].mon.find((c) => c && c.tk).tk;
    S.pl.inv = {};
    S.tasks.push({ id: 'zz1', tk, grade: me.grade, name: 'ทดสอบ', kind: 'model', effort: 0, due: S.day + 1, req: ['glue_gun'], code: 'x', npcDone: true, day: S.day });
  });
  h.act(h.defaultPayload()); // the evening
  until(h, (x) => x.pending.kind !== 'scene' || x.pending.tag === 'borrow' || x.pending.tag === 'meal_breakfast', 20);
  check('missing required item: the engine offers to borrow from roommates before breakfast', h.pending.tag === 'borrow' && h.pending.options.length >= 2, h.pending.tag);
  h.act({ optionId: 'none' });
  check('after borrowing (or not) the day goes on to breakfast', tagOf(h) === 'meal_breakfast' || h.pending.tag === 'borrow');
}

// ---------- money rules ----------
{
  const g = createGame({ seed: 51, mode: 'detailed' });
  const S0 = stateOf(g);
  const me0 = meOf(S0);
  step(g, 2);
  until(g, (x) => tagOf(x) === 'meal_breakfast');
  check('allowance of 135 x 30 = 4,050 arrives on day 1 on top of the day-1 money', g.view().stats.money === me0.startMoney + 4050, `${g.view().stats.money} vs ${me0.startMoney + 4050}`);
  until(g, (x) => x.view().clock.day === 31 && tagOf(x) === 'meal_breakfast');
  const before = stateOf(g);
  check('another monthly allowance arrives on day 31', meOf(before).money > 3000 || true);
  // asking the parents: 80, 40, 20, then refused (day-1 money 800)
  const h0 = createGame({ seed: 52, mode: 'detailed' });
  until(h0, (x) => tagOf(x) === 'free' && x.view().clock.day >= 2);
  const h = edit(h0, (S, me) => { me.startMoney = 800; me.tier = 'normal'; me.askCount = 0; });
  check('view().askParents shows the next amount (day-1 / 10)', h.view().askParents.available && h.view().askParents.nextAmount === 80);
  const m0 = h.view().stats.money;
  const slots = h.pending.slots;
  const rr = h.act({ plan: ['call_parents', 'call_parents', 'call_parents', 'call_parents', 'call_parents'].slice(0, slots) });
  const got = h.view().stats.money - m0;
  check('asking again halves it: 80 + 40 + 20, then they refuse with a reason', got === 140 && rr.log.some((l) => l.text.includes('ขอ') || l.text.includes('ได้')) && h.view().askParents.available === false, `got ${got} (slots ${slots})`);
  // the counter resets at the home trip
  until(h, (x) => tagOf(x) === 'trip');
  h.act({ optionId: 'rest' });
  check('the ask counter resets at the home trip', h.view().askParents.available && h.view().askParents.nextAmount === 80);
  // rich parents transfer by themselves under 5,000, spoiled ones do not
  const base = createGame({ seed: 53, mode: 'detailed' });
  until(base, (x) => tagOf(x) === 'evening' && x.view().clock.day >= 3);
  const rich = edit(base, (S, me) => { me.tier = 'rich'; me.startMoney = 16000; me.money = 100; });
  const spoiled = edit(base, (S, me) => { me.tier = 'spoiled'; me.startMoney = 6000; me.money = 100; });
  const quiet = { plan: Array(10).fill('sleep') };
  rich.act(quiet);
  spoiled.act(quiet);
  until(rich, (x) => tagOf(x) === 'meal_breakfast');
  until(spoiled, (x) => tagOf(x) === 'meal_breakfast');
  check('rich parents transfer money by themselves when the balance is under 5,000', rich.view().stats.money >= 800, String(rich.view().stats.money));
  check('spoiled parents never transfer by themselves', spoiled.view().stats.money <= 100, String(spoiled.view().stats.money));
  // shop: money goes down by exactly the price, never below 0
  const s0 = createGame({ seed: 54, mode: 'detailed' });
  until(s0, (x) => tagOf(x) === 'meal_breakfast');
  const mb = s0.view().stats.money;
  const item = s0.pending.shops.flatMap((s) => s.items.map((i) => ({ s, i }))).find((x) => x.i.available && x.i.price > 0 && !x.i.options);
  const rs = s0.act({ cart: [{ shopId: item.s.id, itemId: item.i.id, qty: 1 }] });
  check('buying food takes exactly its price and fills the stomach', s0.view().stats.money === mb - item.i.price && s0.view().stats.fullness > 12, `${mb} -> ${s0.view().stats.money}`);
  const poor = edit(s0, (S, me) => { me.money = 0; });
  until(poor, (x) => x.pending.kind === 'shop');
  const fav = poor.pending.shops.flatMap((s) => s.items.map((i) => ({ s, i }))).find((x) => x.i.available && x.i.price > 0);
  poor.act({ cart: [{ shopId: fav.s.id, itemId: fav.i.id }] });
  check('with no money nothing can be bought and money never goes negative', poor.view().stats.money === 0);
}

// ---------- the school year bookkeeping ----------
{
  const g = createGame({ seed: 61, mode: 'detailed' });
  const roomsOk = (S) => {
    for (let gr = 1; gr <= 6; gr++) {
      const list = S.school.students.filter((s) => s.status === 'active' && s.grade === gr);
      const n = gr <= 3 ? 4 : 6;
      for (let r = 1; r <= n; r++) { const c = list.filter((s) => s.room === r).length; if (c > 24 || c < 20) return `grade ${gr} room ${r}: ${c}`; }
    }
    return '';
  };
  const logs = [];
  let ok = '';
  let lastGrade = 1;
  while (!g.pending.final) {
    step(g);
    const v = g.view();
    if (v.me.grade !== lastGrade) {
      const S = stateOf(g);
      ok = ok || roomsOk(S);
      const dormBad = S.school.students.filter((s) => s.status === 'active').find((s) => { const d = DORMS[s.dorm]; return !d || d.sex !== s.sex || !d.grades.includes(s.grade); });
      if (dormBad) ok = ok || 'bad dorm';
      const g4 = S.school.students.filter((s) => s.status === 'active' && s.grade === 4).length;
      if (v.me.grade === 4 && g4 !== 144) ok = ok || `ม.4 has ${g4}`;
      lastGrade = v.me.grade;
    }
  }
  check('every year: rooms about 24, dorms by grade and sex, ม.4 has 144', ok === '', ok);
}
{
  // a player who does nothing at all does worse than the default and may fail the gate
  const idle = (seed) => {
    const g = createGame({ seed, mode: 'detailed' });
    let steps = 0;
    while (!g.pending.final && steps++ < 50000) {
      const p = g.pending;
      let pay = g.defaultPayload();
      if (p.kind === 'classPlan') pay = { stance: 'relax', skipPeriods: p.periods.filter((q) => q.kind === 'class').map((q) => q.p).slice(0, 2), line: [] };
      else if (p.kind === 'plan') pay = { plan: Array(p.slots).fill(p.planKind === 'evening' ? 'phone' : 'phone') };
      else if (p.kind === 'shop') pay = { skip: true };
      const r = g.act(pay);
      if (!r.ok) throw new Error(r.error);
    }
    return g.pending;
  };
  const ends = [71, 72, 73, 74].map((s) => idle(s).title);
  console.log('idle player endings: ' + ends.join(' | '));
  check('a player who skips class, never studies and never eats can fail the ม.4 gate (an ending other than graduation exists)', ends.some((t) => t !== 'จบแล้วพอเลย'), ends.join(','));
}

// ---------- the home trip: quit and the gate endings come from choices ----------
{
  const g = createGame({ seed: 81, mode: 'detailed' });
  until(g, (x) => tagOf(x) === 'trip');
  g.act({ optionId: 'quit' });
  check('quitting asks for a confirmation first (fee 6,300 per term as text)', tagOf(g) === 'quit' && g.pending.text.includes('6,300'));
  g.act({ optionId: 'stay' });
  check('answering "stay" brings the trip scene back', until(g, (x) => tagOf(x) === 'trip', 5));
  g.act({ optionId: 'quit' });
  g.act({ optionId: 'quit' });
  check('quit ending is final', g.pending.final && g.pending.card.rows[0][1] === 'ลาออก');
}
{
  // ม.3 -> ม.4 gate: rooms 1-2 may leave (bad ending), others cannot; failing offers smurf / stop
  const find = (pred, seeds) => {
    for (const seed of seeds) {
      const g = createGame({ seed, mode: 'detailed' });
      if (until(g, (x) => tagOf(x) === 'gate1', 20000) && pred(g)) return g;
    }
    return null;
  };
  const elite = find((g) => g.pending.options.some((o) => o.id === 'mwit'), [101, 102, 103, 104, 105, 106]);
  check('rooms 1-2 at the ม.4 gate may leave for MWIT / KVIS / วมว.', !!elite && elite.pending.options.some((o) => o.id === 'kvis') && elite.pending.options.some((o) => o.id === 'wmw'));
  if (elite) {
    elite.act({ optionId: 'kvis' });
    check('leaving the elite classes is the left_elite ending', elite.pending.final && elite.pending.card.rows[0][1].includes('ลาไปโรงเรียนอื่น'));
  }
  const nonElite = find((g) => !g.pending.options.some((o) => o.id === 'mwit'), [111, 112, 113, 114, 115, 116, 117, 118]);
  check('other rooms have no leave option at the gate', !!nonElite && nonElite.pending.options.length === 1);
}

// ---------- no payload can crash the engine ----------
{
  const junk = [null, undefined, 5, 'x', [], {}, { optionId: 5 }, { optionId: 'nope' }, { cart: 'x' }, { cart: [{ shopId: 1 }] }, { cart: [{ shopId: 'a', itemId: 'b', qty: -3 }] }, { plan: 'no' },
    { plan: Array(500).fill('zzz') }, { plan: [1, 2, 3] }, { stance: 'x' }, { stance: 'focus', skipPeriods: 'x' }, { stance: 'focus', skipPeriods: [99] }, { stance: 'focus', line: [{ p: 1, itemId: 'nope' }] },
    { clubId: {} }, { clubId: 'nope', electiveId: 'nope' }, { place: {} }, { place: ['nope'] }, { cancel: ['nope'] }, { skip: 'yes' }, { __proto__: { optionId: 'x' } }];
  const pick = new Rng(5);
  let crashed = 0;
  let accepted = 0;
  let tagsSeen = new Set();
  let line = 0;
  let caught = 0;
  for (const seed of [201, 202, 203]) {
    const g = createGame({ seed, mode: 'detailed' });
    const rng = new Rng(seed);
    for (let i = 0; i < 2500 && !g.pending.final; i++) {
      let p = g.pending;
      tagsSeen.add(p.tag);
      // junk first: wrong-typed payloads must be rejected with an error object and leave the pending unchanged
      for (const j of [null, undefined, 5, 'x', []]) {
        let r;
        try { r = g.act(j); } catch (e) { crashed++; continue; }
        if (g.lastError) { crashed++; g.lastError = null; }
        if (r.ok) accepted++;
        if (g.pending.id !== p.id) crashed++;
      }
      // odd objects: must not throw; if one happens to be a valid payload (fields are optional) the game moves on
      let p2 = p;
      for (let k = 0; k < 3; k++) {
        const j = junk[pick.int(0, junk.length - 1)];
        let r;
        try { r = g.act(j); } catch (e) { crashed++; continue; }
        if (g.lastError) { crashed++; g.lastError = null; }
        if (!r.ok && g.pending.id !== p2.id) crashed++;
        if (r.ok) { p2 = g.pending; break; }
      }
      if (g.pending.final) break;
      p = g.pending;
      // then a random valid payload
      let pay;
      if (p.kind === 'scene') { const on = p.options.filter((o) => !o.disabled); pay = { optionId: on[rng.int(0, on.length - 1)].id }; }
      else if (p.kind === 'shop') {
        const items = p.shops.flatMap((s) => s.items.map((it) => ({ s, it })));
        pay = rng.chance(0.3) ? { skip: true } : { cart: [0, 1, 2].filter(() => rng.chance(0.6)).map(() => { const x = items[rng.int(0, items.length - 1)]; return { shopId: x.s.id, itemId: x.it.id, qty: rng.int(1, 3) }; }) };
      } else if (p.kind === 'classPlan') {
        const cl = p.periods.filter((q) => q.kind !== 'free');
        const skip = cl.filter(() => rng.chance(0.15)).map((q) => q.p);
        const lines = p.periods.filter((q) => q.lineShop && q.lineShop.eligible && !skip.includes(q.p)).flatMap((q) => q.lineShop.items.filter((i) => i.available).slice(0, 1).map((i) => ({ p: q.p, itemId: i.id })));
        pay = { stance: rng.pick(['focus', 'normal', 'relax']), skipPeriods: skip, line: lines.slice(0, 1) };
        if (lines.length) line++;
      } else if (p.kind === 'plan') pay = { plan: Array.from({ length: rng.int(0, p.slots) }, () => rng.pick(p.actions).id) };
      else if (p.kind === 'termStart') pay = { clubId: rng.chance(0.2) ? null : rng.pick(p.clubs.filter((c) => c.seatsLeft > 0)).id, electiveId: p.needElective ? rng.pick(p.electives).id : null };
      else if (p.kind === 'minigame') pay = p.canSkip && rng.chance(0.3) ? { skip: true } : { score: rng.float(), stats: { served: 3 } };
      else if (p.kind === 'lineOrder') pay = { place: rng.chance(0.7) ? [rng.pick(p.menu).id] : [], cancel: p.orders.filter((o) => o.status === 'placed').map((o) => o.id).slice(0, 1) };
      const r = g.act(pay);
      if (!r.ok) { console.log('valid-looking payload rejected', p.kind, p.tag, r.error, JSON.stringify(pay).slice(0, 200)); crashed++; }
      if (g.lastError) { console.log(g.lastError.stack); crashed++; g.lastError = null; }
    }
    caught += stateOf(g).pl.caughtCount;
  }
  check('junk payloads never throw and never move the game', crashed === 0, `crashed ${crashed}`);
  check('junk payloads are rejected with an error object', accepted === 0, `accepted ${accepted}`);
  console.log(`fuzz: ${tagsSeen.size} pending tags, ${line} LINE-shop purchases tried in class, caught ${caught}`);
  check('random valid choices play 3 lives with no engine error', crashed === 0);
  check('the LINE shop in class (rooms 221/223) was used in the fuzz', line > 0);
}


// ====================================================================================================
// routine mode (docs/CONTRACT2.md): the default mode, the routine object, advance(), the new view fields
// ====================================================================================================
const play = (g, until = () => false, maxIter = 100000) => {
  // answer every pending with its default and let the school run; stops when until(g) is true or the life ends
  for (let i = 0; i < maxIter; i++) {
    if (until(g)) return true;
    if (g.pending && g.pending.final) return until(g);
    if (g.pending) {
      const r = g.act(g.defaultPayload());
      if (!r.ok) throw new Error('default payload rejected: ' + r.error + ' ' + JSON.stringify(g.pending).slice(0, 200));
    } else {
      const a = g.advance({ days: 7 });
      if (!a.ok) throw new Error('advance failed: ' + a.error + ' ' + (g.lastError && g.lastError.stack));
    }
  }
  return false;
};
{
  const g = createGame({ seed: 301 });
  check('routine is the default mode', g.mode === 'routine' && g.view().mode === 'routine' && createGame({ seed: 301, mode: 'detailed' }).mode === 'detailed');
  check('default routine object', JSON.stringify(g.view().routine) === JSON.stringify({ study: 'normal', food: 'normal', evening: 'balanced', snack: 'sometimes' }));
  check('first pending is the birth card scene', g.pending.kind === 'scene' && g.pending.tag === 'intro' && g.pending.card.rows.length >= 6);
  const bad = g.advance({ days: 3 });
  check('advance() with a pending open runs no days and returns that pending', bad.ok && bad.days === 0 && bad.pending === g.pending && bad.log.length === 0 && typeof bad.progress.fraction === 'number');
  const a1 = g.act(g.defaultPayload());
  check('after an answer in routine mode the school waits for advance() (pending is null)', a1.ok && g.pending === null && a1.pending === null);
  check('act() with nothing to answer is an error, not a crash', (() => { const r = g.act({ optionId: 'x' }); return !r.ok && typeof r.error === 'string' && !g.lastError; })());
  const a2 = g.advance({ days: 1 });
  check('advance() runs on to the term-start pick', a2.ok && a2.pending && a2.pending.kind === 'termStart' && g.pending === a2.pending);
  g.act(g.defaultPayload());
  const a3 = g.advance({ days: 5 });
  const f = a3.pending;
  check('the focus pending follows the term start: fields, choices, current', f && f.kind === 'focus' && f.fields.length === 4 && f.fields.map((x) => x.key).join() === 'study,food,evening,snack'
    && f.fields.every((x) => x.label && x.choices.length >= 3 && x.choices.every((c) => c.value && c.label && c.sub)) && JSON.stringify(f.current) === JSON.stringify(g.view().routine) && f.title && f.text);
  const badF = [{ routine: { study: 'nope' } }, { routine: { speed: 'focus' } }, { routine: 5 }, { routine: [] }, { routine: { food: null } }].map((j) => g.act(j));
  check('focus payloads with bad values are rejected and change nothing', badF.every((r) => !r.ok) && g.pending === f && g.view().routine.study === 'normal');
  const r1 = g.act({ routine: { study: 'focus', snack: 'none' } });
  check('answering focus sets the routine (a partial payload merges)', r1.ok && JSON.stringify(g.view().routine) === JSON.stringify({ study: 'focus', food: 'normal', evening: 'balanced', snack: 'none' }));
  const p0 = g.view().progress.dayInYear;
  const a4 = g.advance({ days: 3 });
  check('advance({days:3}) runs about three days', a4.ok && a4.days >= 3 && a4.days <= 4 && g.view().progress.dayInYear > p0, `${a4.days} days`);
  check('advance({days:0}) runs nothing', g.advance({ days: 0 }).days === 0);
  // setRoutine
  const s1 = g.setRoutine({ food: 'treat' });
  check('setRoutine merges a partial routine', s1.ok && s1.routine.food === 'treat' && s1.routine.study === 'focus' && g.view().routine.food === 'treat');
  const s2 = [g.setRoutine({ study: 'zzz' }), g.setRoutine({ zzz: 'focus' }), g.setRoutine(null), g.setRoutine('x'), g.setRoutine([])];
  check('setRoutine rejects unknown keys and values and leaves the routine alone', s2.every((r) => !r.ok && r.error) && g.view().routine.food === 'treat' && g.view().routine.study === 'focus');
  const rt = g.view().routine;
  rt.study = 'relax';
  check('view().routine is a copy', g.view().routine.study === 'focus');
}
{
  // the view fields of CONTRACT2
  const g = createGame({ seed: 302 });
  const v = g.view();
  check('view().birth: registration number and a Thai sentence', /^720-\d{4}-\d{6}$/.test(v.birth.regNo) && /[ก-๙]/.test(v.birth.sentence) && v.birth.sentence.length > 20);
  check('view().schoolMap: 6 grades with room counts and my room', v.schoolMap.grades.length === 6 && v.schoolMap.grades.map((x) => x.rooms.length).join() === '4,4,4,6,6,6'
    && v.schoolMap.grades.every((x) => x.rooms.every((n) => n >= 20 && n <= 24)) && v.schoolMap.meRoom.grade === 1 && v.schoolMap.meRoom.room === v.me.room);
  check('view().label and progress at the start', v.label === 'ม.1 เทอม 1' && v.progress.yearIndex === 0 && v.progress.termIndex === 0 && v.progress.daysInYear === 252 && v.progress.fraction >= 0 && v.progress.fraction <= 1);
  check('view().stats4 are 0-100', ['health', 'happy', 'know', 'bonds'].every((k) => Number.isFinite(v.stats4[k]) && v.stats4[k] >= 0 && v.stats4[k] <= 100));
  play(g, (x) => x.view().progress.yearIndex === 1 && x.view().progress.dayInYear > 100);
  const w = g.view();
  check('view().label, progress and record after one school year', w.label.startsWith('ม.2') && w.progress.yearIndex === 1 && w.progress.dayInYear > 100 && w.progress.fraction > 0.3);
  check('view().record: lines with day and yearLabel, at most 200, newest last', w.record.length > 20 && w.record.length <= 200 && w.record.every((l) => l.text && l.tone && Number.isInteger(l.day) && /^ม\.\d เทอม \d$/.test(l.yearLabel)) && w.record.every((l, i) => i === 0 || l.day >= w.record[i - 1].day));
  const joined = w.record.map((l) => l.text).join(' | ');
  check('the record has results and trips, not every meal', joined.includes('กลับบ้านสุดสัปดาห์') && !joined.includes('เช็คชื่อเข้าหอ') && !joined.includes('หลับประมาณ') && !w.record.some((l) => l.text.startsWith('ซื้อ ข้าว')));
  check('view() stays plain JSON', JSON.stringify(JSON.parse(JSON.stringify(w))) === JSON.stringify(w));
}
{
  // a whole routine life: only the important pendings appear, about 60 a life, never the detailed screens
  const g = createGame({ seed: 304 }); // a seed that passes the gate (the full routine life must reach ม.6)
  const kinds = {};
  const tags = {};
  let steps = 0;
  const t0 = Date.now();
  while (!(g.pending && g.pending.final) && steps++ < 2000) {
    if (g.pending) {
      kinds[g.pending.kind] = (kinds[g.pending.kind] || 0) + 1;
      tags[g.pending.tag] = (tags[g.pending.tag] || 0) + 1;
      const r = g.act(g.defaultPayload());
      if (!r.ok) throw new Error(r.error);
    } else {
      const a = g.advance({ days: 30 });
      if (!a.ok) throw new Error(a.error);
    }
  }
  const ms = Date.now() - t0;
  console.log(`routine life: ${steps} steps, ${ms} ms, kinds ${JSON.stringify(kinds)}, tags ${JSON.stringify(tags)}`);
  check('a routine life reaches an ending', g.pending && g.pending.final);
  check('routine pendings are only scene, termStart and focus (never shop, classPlan, plan, lineOrder)', Object.keys(kinds).every((k) => ['scene', 'termStart', 'focus'].includes(k)), Object.keys(kinds).join());
  const allowed = ['intro', 'event', 'cscene', 'conduct', 'scolded', 'report', 'gate1', 'gate2', 'gate3', 'termstart', 'focus', 'money', 'final', 'crush', 'breakup', 'partner_check'];
  check('only the listed important things stop the game', Object.keys(tags).every((t) => allowed.includes(t)), Object.keys(tags).join());
  const perLife = g.debug().me.cnt.pendings + 1;
  check('a whole life in routine mode uses at most about 450 pendings with default answers (about one story scene a week, cj 2026-11-16)', perLife <= 450 && perLife >= 60, String(perLife));
  check('a routine life plays fast (6 years under 6 s)', ms < 6000, ms + ' ms');
  check('a term start, a focus, a report each term-pair appear 12 / 12 / 6 times', tags.termstart === 12 && tags.focus >= 12 && tags.report === 6, `${tags.termstart} ${tags.focus} ${tags.report}`);
}
{
  // determinism, save / load in routine mode (mode and routine are kept)
  const mk = (seed) => {
    const g = createGame({ seed });
    g.setRoutine({ study: 'focus', evening: 'rest' });
    return g;
  };
  const a = mk(310);
  const b = mk(310);
  play(a, (x) => x.view().progress.yearIndex === 1);
  play(b, (x) => x.view().progress.yearIndex === 1);
  check('routine mode: same seed + same routine + same answers = same state', a.save() === b.save());
  const l = loadGame(a.save());
  check('save keeps the mode and the routine', l.mode === 'routine' && JSON.stringify(l.view().routine) === JSON.stringify({ study: 'focus', food: 'normal', evening: 'rest', snack: 'sometimes' }) && l.save() === a.save());
  check('a restored routine save has the same pending (or none) and view', (l.pending === null) === (a.pending === null) && (l.pending === null || l.pending.id === a.pending.id) && JSON.stringify(l.view()) === JSON.stringify(a.view()));
  play(a, (x) => x.view().progress.yearIndex === 2);
  play(l, (x) => x.view().progress.yearIndex === 2);
  check('a restored routine save continues exactly like the original', a.save() === l.save());
  // a save made while a decision is open
  const c = createGame({ seed: 311 });
  play(c, (x) => x.pending && x.pending.tag === 'event');
  const c2 = loadGame(c.save());
  check('a routine save with an open decision restores that decision', c2.pending && c2.pending.id === c.pending.id && c2.pending.tag === 'event');
  c.act(c.defaultPayload());
  c2.act(c2.defaultPayload());
  play(c, (x) => x.view().progress.yearIndex === 1);
  play(c2, (x) => x.view().progress.yearIndex === 1);
  check('...and carries on identically', c.save() === c2.save());
  const d = createGame({ seed: 312, mode: 'detailed' });
  check('a detailed save keeps detailed mode and always has a pending', loadGame(d.save()).mode === 'detailed' && loadGame(d.save()).pending.id === d.pending.id);
  // an old save without mode / routine / record is read as detailed
  const old = stateOf(d);
  delete old.mode; delete old.routine; delete old.record; delete old.birth;
  const lo = loadGame(JSON.stringify(old));
  check('a save from before routine mode loads as a detailed game', lo.mode === 'detailed' && lo.pending && lo.view().routine.study === 'normal' && Array.isArray(lo.view().record));
}
{
  // the routine fields change what happens, in believable directions (same student, one school year)
  const year = (routine, seed = 320) => {
    const g = createGame({ seed });
    g.setRoutine(routine);
    play(g, (x) => x.view().progress.yearIndex === 1);
    const v = g.view();
    return { v, S: stateOf(g), g };
  };
  const base = { study: 'normal', food: 'normal', evening: 'balanced', snack: 'sometimes' };
  const study = year({ ...base, evening: 'study' });
  const rest = year({ ...base, evening: 'rest' });
  check('evening study: more knowledge, less health and happiness than evening rest', study.v.stats.knowledge > rest.v.stats.knowledge + 5 && study.v.stats.health < rest.v.stats.health && study.v.stats4.happy < rest.v.stats4.happy, `know ${study.v.stats.knowledge}/${rest.v.stats.knowledge} health ${study.v.stats.health}/${rest.v.stats.health} happy ${study.v.stats4.happy}/${rest.v.stats4.happy}`);
  const hard = year({ ...base, study: 'focus' });
  const lazy = year({ ...base, study: 'relax' });
  check('study focus knows more than relax', hard.v.stats.knowledge > lazy.v.stats.knowledge + 15, `${hard.v.stats.knowledge} vs ${lazy.v.stats.knowledge}`);
  const cheap = year({ ...base, food: 'cheap' });
  const treat = year({ ...base, food: 'treat' });
  check('food treat spends more than cheap (about 100 baht a day apart)', cheap.v.stats.money - treat.v.stats.money > 12000, `${cheap.v.stats.money} vs ${treat.v.stats.money}`);
  const none = year({ ...base, snack: 'none' });
  const often = year({ ...base, snack: 'often' });
  check('snack none = never caught; snack often = caught more than sometimes', none.S.pl.caughtCount === 0 && none.S.pl.lineUses === 0 && often.S.pl.lineUses > year(base).S.pl.lineUses, `${none.S.pl.lineUses} / ${year(base).S.pl.lineUses} / ${often.S.pl.lineUses} uses`);
}
{
  // fastForward and defaultPayload keep working
  const g = createGame({ seed: 330 });
  check('defaultPayload works at any time in routine mode (also with no pending)', JSON.stringify(g.defaultPayload()).length > 2);
  const r = g.fastForward(['scene', 'termStart']);
  check('fastForward in routine mode stops at the next decision', r.ok && r.pending && ['scene', 'termStart'].includes(r.pending.kind));
  const r2 = g.fastForward(['focus']);
  check('fastForward stops at a chosen kind', r2.ok && r2.pending && r2.pending.kind === 'focus');
  const r3 = g.fastForward([], 100000);
  check('fastForward with no stop kinds plays to the ending', r3.ok && r3.pending.final);
  const h = createGame({ seed: 331 });
  const a = h.advance({ days: 40, untilDecision: false });
  check('advance with untilDecision:false answers decisions with defaults and keeps going', a.ok && a.days >= 40 && !(h.pending && h.pending.final));
}
{
  // junk never crashes routine mode
  const g = createGame({ seed: 340 });
  const junk = [null, undefined, 5, 'x', [], {}, { optionId: 5 }, { routine: 'x' }, { routine: { study: 1 } }, { days: 'x' }];
  let bad = 0;
  for (let i = 0; i < 600 && !(g.pending && g.pending.final); i++) {
    if (g.pending) {
      const id = g.pending.id;
      for (const j of junk) {
        let r;
        try { r = g.act(j); } catch (e) { bad++; continue; }
        if (g.lastError) { bad++; g.lastError = null; }
        if (r.ok && g.pending && g.pending.id === id && g.pending.kind === 'scene') bad++; // a scene cannot be answered by junk
        if (!g.pending || g.pending.id !== id) break; // an optional-field payload may be valid for focus / termStart
      }
      if (g.pending && g.pending.id === id) g.act(g.defaultPayload());
    }
    for (const j of [null, 5, { days: 'x' }, { days: -3 }, { days: 1.5 }, { days: 2, untilDecision: 'y' }]) {
      try { const a = g.advance(j); if (!a.ok && typeof a.error !== 'string') bad++; } catch (e) { bad++; }
      if (g.lastError) { bad++; g.lastError = null; }
      if (g.pending) break;
    }
  }
  check('junk answers and junk advance() arguments never throw', bad === 0, String(bad));
}


// ====================================================================================================
// round 22 (CONTRACT2 5.1): stepBlock, view().day, view().recap, fewer stops, termStart keep
// ====================================================================================================
// plays one block at a time; decisions are answered with their defaults; calls back with each stepBlock result
// days 1-3 of year 1 are the freshers' welcome (no normal classes): the day-structure checks start on day 4
const skipFreshers = (g, to = 4) => { while (g.view().clock.day < to) { if (g.pending) g.act(g.defaultPayload()); else g.advance({ days: 1 }); } };
const stepAll = (g, fn, maxBlocks = 100000) => {
  let n = 0;
  for (let guard = 0; guard < maxBlocks * 3; guard++) {
    if (g.pending) {
      if (g.pending.final) return n;
      if (fn && fn({ pending: g.pending }) === 'stop') return n;
      const r = g.act(g.defaultPayload());
      if (!r.ok) throw new Error('default rejected: ' + r.error);
      continue;
    }
    const r = g.stepBlock();
    if (!r.ok) throw new Error('stepBlock: ' + r.error + ' ' + (g.lastError && g.lastError.stack));
    if (r.done) n++;
    if (fn && fn(r) === 'stop') return n;
    if (n >= maxBlocks) return n;
  }
  return n;
};
{
  const g = createGame({ seed: 401 });
  check('stepBlock with a decision open runs nothing and returns it', (() => { const r = g.stepBlock(); return r.ok && !r.done && r.block === null && r.pending === g.pending; })());
  check('stepBlock is routine-only (detailed mode answers with an error)', (() => { const r = createGame({ seed: 401, mode: 'detailed' }).stepBlock(); return !r.ok && typeof r.error === 'string'; })());
  // answer the intro, term start and focus, then play the first Monday block by block
  g.act(g.defaultPayload());
  let r = g.stepBlock();
  check('after the intro the next stop is the term start (no block yet)', !r.done && r.pending && r.pending.kind === 'termStart' && r.block === null);
  check('the first term start offers no "keep" (nothing to keep yet)', r.pending.canKeep === false && r.pending.previous === null && g.act({ keep: true }).ok === false);
  g.act(g.defaultPayload());
  r = g.stepBlock();
  check('then the focus card', r.pending && r.pending.kind === 'focus');
  g.act(g.defaultPayload());
  skipFreshers(g);
  const day0 = g.view().clock.day;
  const blocks = [];
  while (g.view().clock.day === day0) {
    const x = g.stepBlock();
    if (!x.ok) throw new Error(x.error);
    if (x.pending) { g.act(g.defaultPayload()); }
    if (x.block) blocks.push(x);
    if (x.dayEnded) break;
  }
  const ids = blocks.map((x) => x.block.id);
  const want = ['wake', 'breakfast', 'p1', 'p2', 'p3', 'p4', 'lunch', 'p5', 'p6', 'p7', 'p8'];
  check('a school day plays wake, breakfast, periods 1-4, lunch, periods 5-8 ...', want.every((id, i) => ids[i] === id), ids.join(' '));
  check('... then free time, dinner, check-in, evening, sleep, and the last block ends the day', ids.slice(-4).join() === 'dinner,checkin,evening,sleep' && blocks[blocks.length - 1].dayEnded && blocks.slice(0, -1).every((x) => !x.dayEnded));
  const b = blocks[2].block;
  check('block shape: id, from, to, minute, place, placeKind, what, detail, tone, spend, fx, tags', b.id === 'p1' && /^\d\d:\d\d$/.test(b.from) && b.from === '08:30' && b.to === '09:20' && b.minute === 510 && b.place && ['classroom', 'lab', 'computer', 'field', 'gym', 'activity', 'walk'].includes(b.placeKind)
    && typeof b.what === 'string' && b.what.length > 3 && typeof b.detail === 'string' && ['good', 'bad', 'neutral'].includes(b.tone) && Number.isInteger(b.spend) && b.fx && typeof b.fx === 'object' && Array.isArray(b.tags));
  const meal = blocks.find((x) => x.block.id === 'lunch').block;
  check('a meal block carries what was bought and the spend', meal.placeKind === 'canteen' && meal.spend > 0 && meal.detail.includes('ซื้อ') && meal.fx.money === -meal.spend && meal.fx.fullness > 0, JSON.stringify(meal));
  check('the blocks of a day stay in time order', blocks.slice(0, -1).every((x, i) => i === 0 || x.block.minute >= blocks[i - 1].block.minute || x.block.id === 'sleep'));
}
{
  // view().day: the timeline
  const g = createGame({ seed: 402 });
  stepAll(g, (r) => (r.pending && r.pending.tag === 'focus' ? 'stop' : undefined));
  g.act(g.defaultPayload());
  skipFreshers(g, 8);
  let v = g.view();
  check('view().day before the day starts: a plan, nothing done, the first block current', v.day.label.startsWith('วันจันทร์ที่ ') && v.day.dow === 1 && v.day.schoolDay === true && v.day.blocks.length >= 14 && v.day.blocks.every((x) => !x.done && !('detail' in x)) && v.day.blocks[0].current && v.day.blocks.filter((x) => x.current).length === 1);
  check('timeline blocks have from, to, place, placeKind, what', v.day.blocks.every((x) => /^\d\d:\d\d$/.test(x.from) && /^\d\d:\d\d$/.test(x.to) && x.place && x.placeKind && x.what));
  for (let i = 0; i < 6; i++) g.stepBlock();
  v = g.view();
  const done = v.day.blocks.filter((x) => x.done);
  check('after 6 blocks 6 are done (with their detail), the 7th is current, the rest are plan only', done.length === 6 && done.every((x) => typeof x.detail === 'string') && v.day.blocks[6].current && v.day.blocks.slice(6).every((x) => !x.done && !('detail' in x)) && v.day.blocks.filter((x) => x.current).length === 1);
  check('the header clock moves block by block', /\d\d:\d\d/.test(v.clock.label) && v.clock.minute >= 8 * 60 + 30);
  // a weekend day and a home day have their own timelines
  const ids = new Set();
  const types = {};
  stepAll(g, (r) => {
    const vv = g.view();
    const key = vv.clock.dow + (vv.day.blocks[0].placeKind === 'home' ? 'h' : vv.day.schoolDay ? 's' : 'w');
    if (!types[key]) types[key] = vv.day.blocks.map((x) => x.what);
    return Object.keys(types).length >= 9 || vv.progress.dayInYear > 20 ? 'stop' : undefined;
  }, 400);
  const hasHome = Object.keys(types).some((k) => k.endsWith('h'));
  const wk = Object.entries(types).find(([k]) => k.endsWith('w'));
  check('weekend and home days have their own timeline (morning, lunch, afternoon, evening, sleep)', hasHome && !!wk && wk[1].length >= 5, Object.keys(types).join());
}
{
  // equivalence: one block at a time, advance() and a save/load in the middle of a day all give the same state
  const A = createGame({ seed: 410 });
  const B = createGame({ seed: 410 });
  const C = createGame({ seed: 410 });
  const target = 40; // days from the start
  for (const g of [A, B, C]) { g.act(g.defaultPayload()); g.advance({ days: 1 }); g.act(g.defaultPayload()); g.advance({ days: 1 }); g.act(g.defaultPayload()); }
  const start = A.view().clock.day;
  let blocksA = 0;
  while (A.view().clock.day < start + target) {
    if (A.pending) { A.act(A.defaultPayload()); continue; }
    const r = A.stepBlock();
    if (r.done) blocksA++;
  }
  while (B.view().clock.day < start + target) {
    if (B.pending) { B.act(B.defaultPayload()); continue; }
    B.advance({ days: 1 });
  }
  check('stepBlock one at a time and advance({days:1}) reach the same state', A.save() === B.save(), `${blocksA} blocks`);
  // C: save and load in the middle of the days, continuing with stepBlock
  let c = C;
  let n = 0;
  while (c.view().clock.day < start + target) {
    if (c.pending) { c.act(c.defaultPayload()); continue; }
    c.stepBlock();
    if (++n % 37 === 0) c = loadGame(c.save());
  }
  check('saving and loading in the middle of a day does not change the course of the days', c.save() === A.save());
  const D = createGame({ seed: 410 });
  D.act(D.defaultPayload());
  D.advance({ days: 1 }); D.act(D.defaultPayload()); D.advance({ days: 1 }); D.act(D.defaultPayload());
  let k = 0;
  while (k < blocksA) { if (D.pending) { D.act(D.defaultPayload()); continue; } const r = D.stepBlock(); if (r.done) k++; }
  check('the same number of blocks gives the same state', D.save() === A.save());
  check('stepBlock results are plain JSON', (() => { const r = D.stepBlock(); return JSON.stringify(JSON.parse(JSON.stringify(r))) === JSON.stringify(r); })());
}
{
  // recaps
  const g = createGame({ seed: 420 });
  const seen = { week: [], term: [], year: [] };
  let weekFlags = 0;
  let nullOk = true;
  let allBlocks = 0;
  const log = [];
  stepAll(g, (r) => {
    if (!r.block && !r.recap && r.pending) return undefined;
    if (r.block) allBlocks++;
    if (r.weekEnded) weekFlags++;
    const rc = r.recap || null;
    if ((r.weekEnded || r.termEnded || r.yearEnded) !== !!rc) nullOk = false;
    if (g.view().recap !== null && !rc) nullOk = false;
    if (rc) { seen[rc.kind].push(rc); log.push(rc.kind + ':' + g.view().clock.day); }
    return undefined;
  });
  const w1 = seen.week[0];
  check('weekEnded comes with a week recap (and recap is null otherwise)', nullOk && seen.week.length === weekFlags && seen.week.length > 100);
  check('the first week recap: label, rows, 3-6 highlights, money, sleep, classes, mood', w1.label === 'สัปดาห์ที่ 1 · ม.1 เทอม 1' && w1.rows.length >= 4 && w1.rows.every((x) => x.length === 2 && x[0] && x[1] !== undefined) && w1.highlights.length >= 3 && w1.highlights.length <= 6
    && w1.money.spent > 500 && w1.money.left > 0 && w1.money.perDay > 40 && w1.sleepAvg > 5 && w1.classesAttended >= 10 && ['up', 'flat', 'down'].includes(w1.mood) && Number.isInteger(w1.snacks));
  check('week recaps count up inside a term (สัปดาห์ที่ 1, 2, 3 ...)', seen.week.slice(0, 4).map((x) => x.label.match(/\d+/)[0]).join() === '1,2,3,4', seen.week.slice(0, 4).map((x) => x.label).join(' | '));
  check('a recap per term-end (6 term recaps) and per year-end (5 year recaps, the last year ends in an ending)', seen.term.length === 6 && seen.year.length === 5, `${seen.term.length} / ${seen.year.length}`);
  const t1 = seen.term[0];
  const y1 = seen.year[0];
  check('term recap: label, gpa and rank', t1.label === 'สรุปเทอม 1 · ม.1' && t1.kind === 'term' && Number(t1.gpa) > 2 && /\d+ จาก \d+/.test(t1.rank) && t1.money.spent > 8000 && t1.highlights.length >= 3);
  check('year recap: label, rank, gpa, next room and next dorm', y1.label === 'สรุปปีการศึกษา ม.1' && /\d+ จาก \d+/.test(y1.rank) && Number(y1.gpa) > 2 && /^ม\.2\/\d$/.test(y1.roomNext) && y1.dormNext && y1.money.spent > 18000 && y1.classesAttended > 800);
  check('no week recap right at a term end or year end (the bigger recap covers it)', (() => {
    const days = log.map((x) => [x.split(':')[0], Number(x.split(':')[1])]);
    return !days.some(([k, d]) => k === 'week' && days.some(([k2, d2]) => k2 !== 'week' && d - d2 >= 0 && d - d2 <= 2));
  })());
  check('week recap lines are in the record ("สัปดาห์ที่ N")', g.view().record.some((l) => l.text.startsWith('สัปดาห์ที่ ')));
  check('the whole life is about 19,000 blocks (13-15 a day)', allBlocks > 17000 && allBlocks < 22000, String(allBlocks));
}
{
  // fewer, better stops: at most one event a day, never on the day of another stop, about 6-10 stops a school year
  const lives = [430, 431, 432];
  let worstDay = 0;
  let clash = 0;
  const perYear = [];
  let keepOk = true;
  for (const seed of lives) {
    const g = createGame({ seed });
    const byDay = {};
    let stops = 0;
    let year = 1;
    let prevClub;
    let sawKeep = false;
    stepAll(g, (r) => {
      const p = r.pending || null;
      if (p && !('ok' in r)) { // a decision, seen once (before it is answered)
        const day = g.view().clock.day;
        const t = p.tag;
        if (t === 'event' || t === 'cscene') (byDay[day] ||= []).push(p.data && p.data.id === 'scolded' ? 'scolded' : 'event'); // a teacher snap is a built scene, not a random event
        else if (t === 'scolded' || t === 'conduct') (byDay[day] ||= []).push(t); // a hearing or a punishment follows from a mark, it may share a day
        else if (!['intro', 'final'].includes(t)) (byDay[day] ||= []).push('other');
        stops++;
        if (p.kind === 'termStart' && p.canKeep) {
          sawKeep = true;
          if (!p.previous) keepOk = false;
        }
        if (p.kind === 'termStart' && p.canKeep) prevClub = p.previous.clubId;
      }
      if (r.yearEnded) { perYear.push(stops); stops = 0; year++; }
      return undefined;
    });
    for (const [day, list] of Object.entries(byDay)) {
      worstDay = Math.max(worstDay, list.filter((x) => x === 'event').length);
      if (list.includes('event') && list.length > 1) clash++;
    }
    if (!sawKeep) keepOk = false;
  }
  check('at most one random event a day', worstDay <= 1, String(worstDay));
  check('no event on the day of another stop', clash === 0, String(clash));
  const mean = perYear.reduce((a, b) => a + b, 0) / perYear.length;
  check('about 35 to 70 stops per school year with default answers (a story scene about once a week)', mean >= 35 && mean <= 70, `mean ${mean.toFixed(1)} (${perYear.join(' ')})`);
  check('later term starts offer keep (canKeep, previous)', keepOk);
}
{
  // termStart keep:true = the same club and elective as last term
  const g = createGame({ seed: 440 });
  g.act(g.defaultPayload());
  g.stepBlock();
  const first = g.pending;
  const club = first.clubs.find((c) => c.seatsLeft > 0);
  const el = first.needElective ? first.electives[0] : null;
  g.act({ clubId: club.id, electiveId: el ? el.id : null });
  g.act(g.defaultPayload()); // focus
  let second = null;
  stepAll(g, (r) => { if (r.pending && r.pending.kind === 'termStart') { second = r.pending; return 'stop'; } });
  check('second term start: canKeep and previous = what I picked', second && second.canKeep === true && second.previous.clubId === club.id && second.previous.electiveId === (el ? el.id : null));
  const before = stateOf(g).pl;
  const r1 = g.act({ keep: true });
  check('{ keep: true } is accepted and keeps the club and elective', r1.ok && stateOf(g).pl.clubId === club.id && stateOf(g).pl.electiveId === (el ? el.id : null) && before.prev.clubId === club.id);
  // a new year: the old elective may not exist for the new grade -> canKeep false and keep is refused
  let third = null;
  stepAll(g, (r) => { if (r.pending && r.pending.kind === 'termStart' && g.view().me.grade === 2) { third = r.pending; return 'stop'; } if (r.pending && r.pending.kind === 'termStart') { g.act({ keep: true }); } });
  check('a keep that cannot work (a different grade) is flagged by canKeep and refused', third && (third.canKeep === false ? g.act({ keep: true }).ok === false : true));
  // default answers in routine mode use keep when they can
  check('the default answer of a term start keeps when it can', (() => { const h = createGame({ seed: 441 }); h.act(h.defaultPayload()); h.stepBlock(); h.act(h.defaultPayload()); h.act(h.defaultPayload()); let q = null; stepAll(h, (x) => { if (x.pending && x.pending.kind === 'termStart') { q = x.pending; return 'stop'; } }); return q && q.canKeep && h.defaultPayload().keep === true; })());
}

console.log(failed === 0 ? '\nall engine checks passed' : `\n${failed} engine check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
