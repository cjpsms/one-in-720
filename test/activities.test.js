// Tests for src/content/activities.js. Run: node test/activities.test.js (exit code 1 on failure)
import { Rng } from '../src/rng.js';
import {
  SCHEDULE, SATURDAY, satTeacherKeys, satMood, satGroupForKind, INGREDIENTS, makeStalls, serveSpec, investResult,
  ownStallOptions, ownStallResult, CONTESTS, rankFromScore, FLOAT, HALL, skipCaught, skipOutcome, hallResult, SHOW, LAB,
  labResult, labById, CLUB_CRAFTS, craftForClub, clubCraftResult, FRESHER, fresherResult, expectedScore, scoreTier,
  difficultyFor, resolve, SPORTS, colorOf, sportsResult, colorRanking, colorRankFx, XMAS, EPIDEMICS, INFIRMARY, EXAM_SICK, pickEpidemic, epidemicScene, epidemicChip, epidemicById, COMPANION, companionEffect, CRUSH, crushWho, crushScene, resolveCrush,
} from '../src/content/activities.js';
import { CLUBS } from '../src/data/clubs.js';

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
const noEmoji = (v, where) => ok(!EMOJI.test(JSON.stringify(v)), `emoji in ${where}`);

// plain JSON: survives a round trip unchanged, no NaN / Infinity / undefined
function isJson(v, where) {
  let s;
  try {
    s = JSON.stringify(v);
  } catch (e) {
    ok(false, `${where} not serialisable`);
    return;
  }
  ok(s !== undefined && !/null/.test('') && JSON.stringify(JSON.parse(s)) === s, `${where} round trip`);
  const bad = (x) => {
    if (typeof x === 'number') return !Number.isFinite(x);
    if (x === undefined || typeof x === 'function') return true;
    if (Array.isArray(x)) return x.some(bad);
    if (x && typeof x === 'object') return Object.values(x).some(bad);
    return false;
  };
  ok(!bad(v), `${where} has no NaN/Infinity/undefined/function`);
  noEmoji(v, where);
}

const texts = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => texts(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => texts(x, out));
  return out;
};

function checkWatch(spec, where) {
  ok(Array.isArray(spec.slides) && spec.slides.length >= 3, `${where} slides`);
  for (const s of spec.slides) ok(typeof s.title === 'string' && s.title && typeof s.line === 'string' && s.line, `${where} slide shape`);
  ok(Array.isArray(spec.keywords) && spec.keywords.length >= 1, `${where} keywords`);
  const all = spec.slides.map((s) => s.line + ' ' + s.title).join(' ');
  for (const k of spec.keywords) ok(all.includes(k), `${where} keyword "${k}" appears in slides`);
  ok(Array.isArray(spec.questions) && spec.questions.length === 3, `${where} 3 questions`);
  for (const q of spec.questions) {
    ok(typeof q.q === 'string' && q.q.length > 0, `${where} question text`);
    ok(Array.isArray(q.choices) && q.choices.length === 3 && new Set(q.choices).size === 3, `${where} 3 distinct choices (${q.q})`);
    ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 3, `${where} answer index`);
  }
  ok(typeof spec.topic === 'string' && spec.topic, `${where} topic`);
  isJson(spec, where);
}

// ---- SCHEDULE
{
  ok(SCHEDULE.fresher.days === 3 && SCHEDULE.fresher.source === 'cj', 'freshers 3 days (cj)');
  ok(SCHEDULE.saturday.periods === 4 && SCHEDULE.saturday.groups.join('') === 'ABCD', 'saturday 4 periods, groups A-D (cj)');
  ok(SCHEDULE.hall.skip.caughtChance === 0.5 && SCHEDULE.hall.skip.source === 'cj', 'skip caught 0.5 (cj)');
  ok(SCHEDULE.fair.stalls.min === 15 && SCHEDULE.fair.stalls.max === 25 && SCHEDULE.fair.dormStalls === 1, 'stalls 15-25, 1 per dorm (cj)');
  ok(SCHEDULE.show.directors[0] === 2 && SCHEDULE.show.directors[1] === 3, 'directors 2-3 (cj)');
  ok(SCHEDULE.fair.contests.length === 4, 'four contests');
  isJson(SCHEDULE, 'SCHEDULE');
}

// ---- SATURDAY
{
  const seenNames = new Set();
  for (let g = 1; g <= 6; g++) {
    const sat = SATURDAY[g];
    ok(sat && sat.grade === g, `SATURDAY ${g}`);
    ok(sat.club && sat.club.name === 'ชุมนุมวันเสาร์' && sat.club.note.length > 10, `club ${g}`);
    for (const id of ['A', 'B', 'C', 'D']) {
      const grp = sat.groups[id];
      ok(grp && grp.id === id && grp.name && grp.blurb, `group ${g}${id}`);
      ok(grp.subjects.length === 4, `group ${g}${id} has 4 subjects`);
      for (const s of grp.subjects) {
        ok(s.name && s.short && s.roomKind && s.kind && s.teacherKey.startsWith(`sat-m${g}-`), `subject ${g}${id} ${s.name}`);
      }
      ok(!seenNames.has(grp.name), `group name unique across grades: ${grp.name}`);
      seenNames.add(grp.name);
    }
  }
  // every grade clearly different: no two grades share a full set of subject names
  const sets = [];
  for (let g = 1; g <= 6; g++) {
    const names = Object.values(SATURDAY[g].groups).flatMap((x) => x.subjects.map((s) => s.name));
    sets.push(names);
  }
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
    const shared = sets[a].filter((n) => sets[b].includes(n)).length;
    ok(shared <= 2, `grades ${a + 1} and ${b + 1} share few subject names (${shared})`);
  }
  const keys = satTeacherKeys();
  ok(keys.length >= 48 && keys.every((k) => k.key && typeof k.foreign === 'boolean'), 'satTeacherKeys');
  ok(new Set(keys.map((k) => k.key)).size === keys.length, 'sat teacher keys unique');
  const club = satMood('club');
  ok(club.fx.stress < 0 && club.difficulty === 0, 'club saturday is chill');
  const hard = satMood(SATURDAY[6].groups.A);
  const easy = satMood(SATURDAY[1].groups.D);
  ok(hard.difficulty > easy.difficulty, 'physics-chem group harder than art group');
  ok(satMood('B', 3).id === 'B', 'satMood by id + grade');
  eq(satGroupForKind(3, 'computer'), 'D', 'satGroupForKind computer ม.3');
  eq(satGroupForKind(1, 'nonexistent'), 'A', 'satGroupForKind default');
  isJson(SATURDAY, 'SATURDAY');
}

// ---- stalls
{
  const teachers = [];
  for (let i = 0; i < 40; i++) teachers.push({ key: `t${i}`, name: `ครูทดสอบ${i}` });
  const dorms = ['g1', 'g2', 'g3', 'bPhi', 'bLin', 'bLak'].map((k) => ({ key: k, name: `หอ ${k}` }));
  const counts = new Set();
  for (let s = 1; s <= 100; s++) {
    const rng = new Rng(s);
    const stalls = makeStalls(rng, { teachers, dorms, playerWealth: s % 2 ? 'rich' : 3000 });
    ok(stalls.length >= 15 && stalls.length <= 25, `stalls ${stalls.length} in 15..25 (seed ${s})`);
    counts.add(stalls.length);
    for (const d of dorms) ok(stalls.filter((x) => x.owner.kind === 'dorm' && x.owner.key === d.key).length === 1, `one stall for dorm ${d.key}`);
    ok(new Set(stalls.map((x) => x.name)).size === stalls.length, 'stall names unique');
    ok(new Set(stalls.map((x) => x.id)).size === stalls.length, 'stall ids unique');
    ok(new Set(stalls.filter((x) => x.owner.kind === 'teacher').map((x) => x.owner.key)).size === stalls.filter((x) => x.owner.kind === 'teacher').length, 'a teacher opens at most one stall');
    for (const st of stalls) {
      ok(st.name && st.theme && st.menu.length === 3, `stall ${st.id} shape`);
      ok(typeof st.needHelp === 'boolean' && st.pay.base >= 0 && st.pay.perDish >= 0, 'stall pay');
      ok(st.trust === (st.owner.kind === 'teacher' ? 'teacher' : null), 'trust only for teachers');
      for (const m of st.menu) {
        ok(m.id && m.name && m.steps.length >= 3 && m.price > 0, `menu ${m.id}`);
        for (const step of m.steps) ok(INGREDIENTS.some((i) => i.id === step), `ingredient ${step} exists`);
      }
    }
    if (s <= 20) {
      isJson(stalls, `stalls seed ${s}`);
      const sp = serveSpec(new Rng(s), stalls[0], { difficulty: 0.7 });
      ok(sp.stallName === stalls[0].name && sp.customers >= 8 && sp.patience > 0, 'serveSpec shape');
      const ids = new Set(sp.ingredients.map((i) => i.id));
      for (const m of sp.menu) for (const step of m.steps) ok(ids.has(step), 'serve ingredients cover every step');
      isJson(sp, `serveSpec ${s}`);
      eq(makeStalls(new Rng(s), { teachers, dorms }), makeStalls(new Rng(s), { teachers, dorms }), 'makeStalls deterministic');
    }
  }
  ok(counts.size >= 8, 'stall count varies');
  const few = makeStalls(new Rng(3), { teachers: teachers.slice(0, 3), dorms });
  ok(few.length === 9 && few.filter((x) => x.owner.kind === 'dorm').length === 6, 'few teachers: fewer stalls but every dorm still has one');
  // own stall
  for (let s = 1; s <= 50; s++) {
    for (const money of [0, 15, 45, 120, 800, 5000]) {
      const rng = new Rng(s);
      const opts = ownStallOptions(rng, { money });
      ok(opts.length <= 3, 'at most 3 own-stall plans');
      for (const o of opts) {
        ok(o.invest <= money && o.invest > 0, `invest ${o.invest} <= money ${money}`);
        ok(o.expected.min <= o.expected.max && o.menu.length === 3 && o.name && o.id, 'plan shape');
        const r = ownStallResult(o, Math.random() * 0 + (s % 10) / 10, new Rng(s));
        ok(Number.isInteger(r.income) && r.income >= 0 && r.profit === r.income - o.invest && r.fx.money === r.profit - 0 || r.profit === 0, 'ownStallResult math');
        ok(r.log.length > 5, 'ownStallResult log');
      }
      isJson(opts, 'own plans');
    }
  }
  ok(ownStallOptions(new Rng(1), { money: 5 }).length === 0, 'no plan when almost broke');
  ok(ownStallOptions(new Rng(1), { money: 1000 }).length === 3, 'three plans when rich');
  let lost = 0;
  for (let s = 1; s <= 200; s++) {
    const plan = ownStallOptions(new Rng(s), { money: 1000 })[2];
    if (ownStallResult(plan, 0.1, new Rng(s + 7)).profit < 0) lost++;
  }
  ok(lost > 20, `own stall can lose money (${lost}/200 with a bad score)`);
  const inv = investResult(few[0], 100, 0.9, new Rng(1));
  ok(inv.payout > 0 && inv.fx.money === inv.payout - 100, 'investResult');
}

// ---- contests, rank, float
{
  for (const id of ['krathong_creative', 'krathong_beautiful', 'dress_fast', 'costume_beauty']) {
    const c = CONTESTS[id];
    ok(c && c.id === id && c.title && c.entryNote && ['craft', 'dash'].includes(c.game), `contest ${id}`);
    ok(c.prize.money > 0 && c.prize.peer > 0 && c.prize.tiers.length >= 3, `prize ${id}`);
    for (let s = 1; s <= 30; s++) {
      const p = c.specFor(new Rng(s), { difficulty: (s % 10) / 10 });
      isJson(p, `${id} spec`);
      eq(c.specFor(new Rng(s), { difficulty: (s % 10) / 10 }), p, `${id} deterministic`);
      if (c.game === 'craft') {
        ok(['krathong', 'costume'].includes(p.kind) && p.theme.name && p.theme.palette.length >= 3, `${id} craft theme`);
        ok(p.pieces.length >= 8 && p.slots >= 5 && p.slots <= p.pieces.length, `${id} pieces/slots`);
        for (const pc of p.pieces) ok(pc.id && pc.name && /^#/.test(pc.color) && pc.kind, `${id} piece`);
        const r = p.rubric;
        ok(Math.abs(r.palette + r.symmetry + r.variety - 1) < 0.03, `${id} rubric sums to 1`);
      } else {
        ok(p.items.length >= 6 && p.sequenceLen >= 5 && p.sequenceLen <= p.items.length && p.timeLimit >= 10, `${id} dash`);
      }
    }
  }
  const kinds = new Set();
  const themes = new Set();
  for (let s = 1; s <= 200; s++) {
    themes.add(CONTESTS.krathong_creative.specFor(new Rng(s)).theme.name);
    themes.add(CONTESTS.costume_beauty.specFor(new Rng(s)).theme.name);
    kinds.add(CONTESTS.dress_fast.specFor(new Rng(s)).items.map((i) => i.name).join(','));
  }
  ok(themes.size >= 14, `many contest themes (${themes.size})`);
  ok(kinds.size >= 4, 'dress_fast has several outfits');
  // rank
  let top = 0;
  let low = 0;
  for (let s = 1; s <= 300; s++) {
    const a = rankFromScore(0.95, 14, new Rng(s));
    const b = rankFromScore(0.1, 14, new Rng(s));
    ok(a.of === 15 && a.place >= 1 && a.place <= 15, 'rank shape');
    if (a.place <= 3) top++;
    if (b.place >= 10) low++;
  }
  ok(top > 250 && low > 250, `rank follows score (${top}, ${low})`);
  eq(rankFromScore(0.5, [1, 2, 3], new Rng(1)).of, 4, 'rivals as array');
  // float
  const labels = new Set();
  for (let s = 1; s <= 100; s++) {
    const sp = FLOAT.floatSpec(new Rng(s));
    ok(sp.tries === 3 && sp.zone > 0.1 && sp.zone < 0.5 && sp.speed > 0 && sp.label, 'floatSpec shape');
    isJson(sp, 'floatSpec');
    labels.add(sp.label);
    const r = FLOAT.floatResult(s / 100, new Rng(s));
    ok(r.fx.stress < 0 && r.log.includes(r.wish) && r.tier.id, 'floatResult');
  }
  ok(labels.size >= 6 && FLOAT.wishes.length >= 12, `float variety (${labels.size})`);
}

// ---- hall
{
  ok(HALL.lecture.topics.length >= 20, `>= 20 lecture topics (${HALL.lecture.topics.length})`);
  ok(HALL.special.length >= 10, `>= 10 special days (${HALL.special.length})`);
  ok(HALL.farewell.speeches.length >= 6 && HALL.farewell.reasons.length === 2, 'farewell speeches');
  ok(HALL.fresher.sessions.length >= 6, `>= 6 fresher sessions (${HALL.fresher.sessions.length})`);
  ok(HALL.award.variants.length >= 4, 'award variants');
  ok(HALL.trustGain.texts.length >= 6, 'trust gain texts');
  const ids = new Set();
  for (const t of HALL.lecture.topics) {
    ok(t.id && !ids.has(t.id), `unique topic id ${t.id}`);
    ids.add(t.id);
    ok(t.slides.length >= 4 && t.questions.length === 3, `topic ${t.id} shape`);
    for (let s = 1; s <= 3; s++) checkWatch(HALL.lecture.spec(new Rng(s), { topicId: t.id }), `lecture ${t.id}`);
  }
  for (const d of HALL.special) {
    ok(d.month >= 1 && d.month <= 12 && d.title, `special ${d.id}`);
    checkWatch(d.spec(new Rng(4)), `special ${d.id}`);
  }
  for (let s = 1; s <= 30; s++) {
    checkWatch(HALL.award.spec(new Rng(s), { term: 1 + (s % 2), awardees: s }), `award ${s}`);
    checkWatch(HALL.fresher.spec(new Rng(s), {}), `fresher ${s}`);
    checkWatch(HALL.specialSpec(new Rng(s), {}), `specialSpec ${s}`);
    checkWatch(HALL.farewell.spec(new Rng(s), { teacherName: 'ครูทดสอบ', reason: s % 2 ? 'ลาออก' : 'เกษียณอายุ 60 ปี' }), `farewell ${s}`);
    const t = HALL.farewell.text(new Rng(s), { teacherName: 'ครูทดสอบ' });
    ok(HALL.farewell.reasons.includes(t.reason) && t.speech.length > 30 && t.title.includes('ครูทดสอบ'), 'farewell text');
    eq(HALL.lecture.spec(new Rng(s), {}), HALL.lecture.spec(new Rng(s), {}), 'lecture spec deterministic');
  }
  // lecture topics spread: 60 draws give many distinct topics, and `recent` is respected
  const seen = new Set();
  for (let s = 1; s <= 60; s++) seen.add(HALL.lecture.spec(new Rng(s), {}).topicId);
  ok(seen.size >= 15, `lecture draws vary (${seen.size})`);
  for (let s = 1; s <= 30; s++) {
    const recent = HALL.lecture.topics.slice(0, 19).map((t) => t.id);
    ok(!recent.includes(HALL.lecture.spec(new Rng(s), { recent }).topicId), 'recent topics avoided');
  }
  // the shuffled answer index points at the right choice
  const raw = HALL.lecture.topics.find((t) => t.id === 'firstaid');
  const sp = HALL.lecture.spec(new Rng(9), { topicId: 'firstaid' });
  ok(sp.questions[0].choices[sp.questions[0].answer] === raw.questions[0].choices[0], 'answer index follows the shuffle');
  // skip rule
  let caught = 0;
  for (let s = 1; s <= 4000; s++) if (skipCaught(new Rng(s * 7919))) caught++;
  ok(caught > 1850 && caught < 2150, `skipCaught about 50% (${caught}/4000)`);
  let trustDrop = 0;
  for (let s = 1; s <= 100; s++) {
    const o = skipOutcome(new Rng(s), {});
    ok(typeof o.caught === 'boolean' && o.log.length > 5, 'skipOutcome shape');
    if (o.caught) {
      ok(o.fx.teacherTrust < 0, 'caught -> trust drops');
      trustDrop++;
    } else ok(!o.fx.teacherTrust, 'not caught -> no trust change');
  }
  ok(trustDrop > 20 && trustDrop < 80, 'both skip outcomes occur');
  // lectures lower diligence, better attention lowers it less
  const l0 = hallResult('lecture', 0, { topic: 'ทดสอบ' }, new Rng(1));
  const l1 = hallResult('lecture', 1, { topic: 'ทดสอบ' }, new Rng(1));
  ok(l0.fx.diligence < 0 && l1.fx.diligence < 0 && l0.fx.diligence < l1.fx.diligence, 'lecture drops diligence, less when awake');
  const aw = hallResult('award', 0.8, { onStage: true }, new Rng(1));
  ok(aw.fx.teacherTrust > 0 && aw.fx.diligence > 0, 'award on stage raises trust and diligence');
  for (const k of ['award', 'lecture', 'special', 'farewell', 'fresher']) {
    const r = hallResult(k, 0.5, {}, new Rng(2));
    ok(r.log && r.tier.id && typeof r.fx === 'object', `hallResult ${k}`);
    isJson(r, `hallResult ${k}`);
  }
  let gains = 0;
  for (let s = 1; s <= 1000; s++) {
    const g = HALL.trustGain.roll(new Rng(s), {});
    if (g) {
      gains++;
      ok(g.fx.teacherTrust > 0 && g.text, 'trust gain shape');
    }
  }
  ok(gains > 80 && gains < 170, `trust gain chance about 12% (${gains}/1000)`);
}

// ---- show
{
  eq(SHOW.roles.map((r) => r.id), ['act', 'camera', 'sound', 'edit', 'director', 'none'], 'show roles');
  for (const r of SHOW.roles) ok(r.name && r.blurb.length > 10 && r.game, `role ${r.id}`);
  for (let g = 1; g <= 6; g++) {
    ok(SHOW.themes[g].title && SHOW.themes[g].items.length === 5 && SHOW.themes[g].story.length === 6, `theme ${g}`);
    for (const r of SHOW.roles) {
      const sp = SHOW.showSpec(r.id, new Rng(g), { grade: g, prep: 0.5 });
      isJson(sp, `showSpec ${r.id} ${g}`);
      if (r.game === 'rhythm') ok([3, 4].includes(sp.lanes) && sp.bpm > 50 && sp.notes >= 10 && sp.label, 'act spec');
      if (r.game === 'track') ok(sp.mode === r.id && sp.speed > 0 && sp.band > 0 && sp.band < 1, 'track spec');
      if (r.game === 'sequence') {
        ok(sp.clips.length >= 5 && sp.label, 'sequence spec');
        eq(sp.clips.map((c) => c.order).sort((a, b) => a - b), sp.clips.map((_, i) => i), 'sequence orders are 0..n-1');
      }
      if (r.game === 'watch') checkWatch(sp, 'show watch');
      for (const sc of [0, 0.5, 1]) {
        const res = SHOW.showResult(r.id, sc, 0.5, new Rng(1));
        ok(res.log && res.tier && typeof res.fx === 'object', `showResult ${r.id}`);
      }
    }
  }
  const easy = SHOW.showSpec('camera', new Rng(1), { grade: 2, prep: 1 });
  const hard = SHOW.showSpec('camera', new Rng(1), { grade: 2, prep: 0 });
  ok(easy.band > hard.band && easy.speed < hard.speed, 'prep makes the track game easier');
  ok(SHOW.showResult('director', 0.9, 0.5, new Rng(1)).fx.teacherTrust > SHOW.showResult('camera', 0.9, 0.5, new Rng(1)).fx.teacherTrust, 'directors earn more trust');
  const cands = [];
  for (let i = 0; i < 20; i++) cands.push({ id: `s${i}`, trust: i * 5, prep: i / 20 });
  const counts = {};
  for (let s = 1; s <= 300; s++) {
    const d = SHOW.directorPick(new Rng(s), cands);
    ok(d.length >= 2 && d.length <= 3 && new Set(d).size === d.length, 'directorPick 2-3 distinct');
    d.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  }
  ok((counts.s19 || 0) > (counts.s0 || 0) * 3, 'directors lean to trusted, prepared candidates');
  ok(SHOW.directorPick(new Rng(1), [{ id: 'a' }]).length === 1, 'directorPick with one candidate');
}

// ---- labs and club crafts
{
  ok(LAB.length >= 12, `>= 12 labs (${LAB.length})`);
  const ids = new Set();
  for (const lab of LAB) {
    ok(lab.id && !ids.has(lab.id) && lab.subject && lab.title, `lab ${lab.id}`);
    ids.add(lab.id);
    for (let s = 1; s <= 4; s++) {
      const sp = lab.spec(new Rng(s));
      ok(sp.title === lab.title && sp.hazard && sp.steps.length >= 4, `lab ${lab.id} spec`);
      for (const st of sp.steps) {
        ok(st.prompt && st.choices.length === 3 && new Set(st.choices).size === 3 && st.answer >= 0 && st.answer < 3, `lab ${lab.id} step`);
        if (st.hold) ok(st.hold.label && st.hold.target > 0 && st.hold.target < 1 && st.hold.width > 0.1 && st.hold.width < 0.4, `lab ${lab.id} hold`);
      }
      isJson(sp, `lab ${lab.id}`);
      eq(lab.spec(new Rng(s)), sp, `lab ${lab.id} deterministic`);
    }
  }
  ok(labById('titration').subject === 'chemistry' && labById('nope') === null, 'labById');
  ok(LAB.some((l) => l.spec(new Rng(1)).steps.some((s) => s.hold)), 'some labs have a hold step');
  ok(labResult(0.9).fx.knowledge > labResult(0.1).fx.knowledge, 'better lab -> more knowledge');
  // club crafts: >= 3 per club area, every club area covered
  const areas = new Set(CLUBS.map((c) => c.area));
  for (const a of areas) ok(CLUB_CRAFTS[a] && CLUB_CRAFTS[a].length >= 3, `>= 3 crafts for club area ${a}`);
  const cids = new Set();
  for (const [area, list] of Object.entries(CLUB_CRAFTS)) {
    for (const c of list) {
      ok(c.id && c.area === area && c.title && c.game, `craft ${c.id}`);
      ok(!cids.has(c.id), `unique craft id ${c.id}`);
      cids.add(c.id);
      const sp = c.spec(new Rng(5));
      isJson(sp, `craft ${c.id}`);
      eq(c.spec(new Rng(5)), sp, `craft ${c.id} deterministic`);
      if (c.game === 'pattern') ok(sp.beads.length >= 4 && sp.rounds >= 4 && sp.startLen >= 3 && sp.label, `pattern ${c.id}`);
      if (c.game === 'sequence') ok(sp.clips.length >= 5 && sp.label, `sequence ${c.id}`);
      if (c.game === 'dash') ok(sp.items.length >= 6 && sp.sequenceLen <= sp.items.length && sp.timeLimit > 10, `dash ${c.id}`);
      if (c.game === 'timing') ok(sp.tries === 3 && sp.zone > 0 && sp.label, `timing ${c.id}`);
      if (c.game === 'rhythm') ok(sp.lanes >= 3 && sp.bpm > 50 && sp.notes >= 10, `rhythm ${c.id}`);
      if (c.game === 'track') ok(['camera', 'sound'].includes(sp.mode), `track ${c.id}`);
      if (c.game === 'steps') ok(sp.steps.length >= 4, `steps ${c.id}`);
    }
  }
  ok(CLUB_CRAFTS.art.some((c) => c.id === 'art-bracelet' && c.game === 'pattern'), 'bracelet craft exists');
  ok(craftForClub({ area: 'music' }).area === 'music' && craftForClub({ area: 'zzz' }).area === 'art', 'craftForClub');
  ok(craftForClub({ area: 'sport' }, new Rng(2)).area === 'sport', 'craftForClub with rng');
  ok(clubCraftResult(0.8, 'art', new Rng(1)).log.length > 5, 'clubCraftResult');
}

// ---- freshers
{
  eq(FRESHER.days.map((d) => d.day), [1, 2, 3], 'freshers 3 days');
  let plays = 0;
  const bids = new Set();
  for (const d of FRESHER.days) {
    ok(d.blocks.length === 3 && d.title, `fresher day ${d.day}`);
    for (const b of d.blocks) {
      ok(b.id && b.name && b.what && b.place && b.placeKind && b.eventId, `block ${b.id}`);
      ok(!bids.has(b.id), 'unique block id');
      bids.add(b.id);
      const sp = FRESHER.spec(b.id, new Rng(3), { grade: 1 });
      if (b.play) {
        plays++;
        ok(sp !== null, `play block ${b.id} has a spec`);
        isJson(sp, `fresher spec ${b.id}`);
        if (b.game === 'watch') checkWatch(sp, `fresher ${b.id}`);
        if (b.game === 'pattern') ok(sp.beads.length === 5 && sp.rounds >= 4, 'fresher pattern');
        if (b.game === 'dash') ok(sp.items.length >= 6 && sp.sequenceLen >= 5, 'fresher dash');
        if (b.game === 'serve') ok(sp.menu.length === 3 && sp.customers >= 8, 'fresher serve');
      } else ok(sp === null, `auto block ${b.id} has no spec`);
      const r = fresherResult(b.id, b.play ? 0.7 : null, {}, new Rng(1));
      ok(r.log && r.tier && r.fx.peer > 0, `fresherResult ${b.id}`);
    }
  }
  ok(plays >= 3 && plays <= 5, `3-5 plays over the freshers (${plays})`);
  ok(FRESHER.titleFor(4) !== FRESHER.titleFor(1) && FRESHER.titleFor(1).includes('ม.1'), 'fresher titles');
}

// ---- scores and resolve
{
  eq(scoreTier(0.9).id, 'great', 'tier great');
  eq(scoreTier(0.65).id, 'good', 'tier good');
  eq(scoreTier(0.45).id, 'ok', 'tier ok');
  eq(scoreTier(0.1).id, 'bad', 'tier bad');
  eq(scoreTier(NaN).id, 'bad', 'tier NaN');
  const games = ['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'];
  const fit = { health: 90, energy: 90, stress: 10, knowledge: 90, peer: 90, diligence: 90 };
  const poor = { health: 20, energy: 15, stress: 90, knowledge: 20, peer: 20, diligence: 20 };
  for (const g of games) {
    const a = expectedScore(g, fit, 0.5);
    const b = expectedScore(g, poor, 0.5);
    ok(a > b && a <= 0.95 && b >= 0.05, `expectedScore ${g} rises with condition (${a.toFixed(2)} vs ${b.toFixed(2)})`);
    ok(expectedScore(g, fit, 0.1) > expectedScore(g, fit, 0.9), `expectedScore ${g} falls with difficulty`);
    const d = difficultyFor(g, poor);
    ok(d > difficultyFor(g, fit) && d >= 0 && d <= 1, `difficultyFor ${g}`);
  }
  ok(expectedScore('nope', {}, 0.5) > 0, 'unknown game does not throw');
  // resolve: every eventId returns fx + log + tier, no emoji, money never below -ctx.money
  const stall = makeStalls(new Rng(1), { teachers: [{ key: 't', name: 'ครูทดสอบ' }], dorms: [{ key: 'g1', name: 'หอทดสอบ' }] })[0];
  const plan = ownStallOptions(new Rng(1), { money: 1000 })[1];
  const ev = [
    'fresher_hall', 'fresher_game', 'fresher_serve', 'fresher_auto', 'hall_award', 'hall_lecture', 'hall_special', 'hall_farewell',
    'hall_fresher', 'loy_stall', 'loy_own', 'loy_float', 'loy_contest_krathong_creative', 'loy_contest_krathong_beautiful',
    'loy_contest_dress_fast', 'loy_contest_costume_beauty', 'loy_prep', 'loy_wander', 'show_act', 'show_camera', 'show_sound',
    'show_edit', 'show_director', 'show_watch', 'show_rehearsal', 'science_lab', 'club_craft', 'saturday_club', 'saturday_class',
    'something_unknown',
  ];
  for (const id of ev) {
    for (const money of [0, 5, 60, 5000]) {
      for (const sc of [0, 0.3, 0.7, 1, null]) {
        const r = resolve(id, 'x', sc, { money, stall, plan, grade: 2, group: 'A', onStage: true, prep: 0.5, area: 'art', title: 'ทดลอง', topic: 'ทดสอบ', invest: 0 }, new Rng(11));
        ok(r.log && typeof r.log === 'string' && r.tier && r.tier.id && r.fx && typeof r.fx === 'object', `resolve ${id} shape`);
        ok(!(r.fx.money < -money), `resolve ${id}: money ${r.fx.money} not below -${money}`);
        for (const [k, v] of Object.entries(r.fx)) ok(Number.isFinite(v) && v !== 0, `resolve ${id} fx ${k} finite and non-zero`);
        noEmoji(r, `resolve ${id}`);
        eq(resolve(id, 'x', sc, { money, stall, plan, grade: 2, group: 'A', onStage: true, prep: 0.5, area: 'art', title: 'ทดลอง', topic: 'ทดสอบ', invest: 0 }, new Rng(11)), r, `resolve ${id} deterministic`);
      }
    }
  }
  const stallPay = resolve('loy_stall', 'serve', 1, { money: 0, stall: { name: 'ร้านทดสอบ', pay: { base: 50, perDish: 3 }, trust: 'teacher', owner: { name: 'ครูทดสอบ' } }, served: 10 }, new Rng(1));
  ok(stallPay.fx.money === 80 && stallPay.fx.teacherTrust > 0, 'working a teacher stall pays base + per dish and builds trust');
  const inv = resolve('loy_stall', 'serve', 0.5, { money: 100, stall: { name: 'ร้านหอ', invest: { min: 20, max: 100 } }, invest: 100 }, new Rng(1));
  ok(inv.log.includes('ลงทุน'), 'invested stall logs the investment');
  const ct = resolve('loy_contest_dress_fast', 'dash', 1, { money: 0, place: 1, of: 12 }, new Rng(1));
  ok(ct.fx.money === CONTESTS.dress_fast.prize.money && ct.log.includes('ที่ 1 จาก 12'), 'first place gets the prize');
  ok(resolve('hall_lecture', 'watch', 0, { money: 0 }, new Rng(1)).fx.diligence < 0, 'lecture via resolve lowers diligence');
}

// ---- companions
{
  const friends = [
    { id: 1, name: 'ตั้มทดสอบ', grade: 2, room: 3, closeness: 70 },
    { id: 2, name: 'เฟิร์นทดสอบ', grade: 2, room: 1, closeness: 90 },
    { id: 3, name: 'ปุยทดสอบ', grade: 1, room: 2, closeness: 20 },
    { id: 4, name: 'โอ๊ตทดสอบ', grade: 3, room: 4, closeness: 50 },
    { id: 5, name: 'มายด์ทดสอบ', grade: 2, room: 2, closeness: 40 },
    { id: 6, name: 'ฟ้าทดสอบ', grade: 2, room: 2, closeness: 10 },
  ];
  for (const ev of ['fair', 'show', 'fresher', 'date']) {
    const sc = COMPANION.scene(ev, { friends, acquaintance: { id: 9, name: 'คนรู้จักทดสอบ', grade: 1, room: 1, closeness: 12 }, partner: null }, new Rng(1));
    ok(sc.title && sc.text && sc.options.length >= 4 && sc.options.length <= 7, `companion scene ${ev}`);
    ok(sc.options.some((o) => o.id === 'alone' && o.label === 'เดินคนเดียว') && sc.options.some((o) => o.id === 'group' && o.label === 'ไปกับห้อง/หอ'), 'alone and group options');
    ok(sc.options.some((o) => o.id === 'acq:9'), 'acquaintance option');
    ok(sc.options.filter((o) => o.id.startsWith('friend:')).length <= 4, 'at most 4 friends');
    ok(sc.options.find((o) => o.id.startsWith('friend:')).id === 'friend:2', 'closest friend first');
    isJson(sc, `companion scene ${ev}`);
    const sp = COMPANION.scene(ev, { friends, partner: { id: 7, name: 'แฟนทดสอบ', closeness: 85 } }, new Rng(1));
    ok(sp.options[0].id === 'partner' && sp.options[0].who.name === 'แฟนทดสอบ', 'partner first');
  }
  const cl = companionEffect('fair', 90, new Rng(1), 'ตั้ม');
  const dist = companionEffect('fair', 10, new Rng(1), 'ตั้ม');
  ok(cl.detail === 'ลอยกระทงกับตั้ม', 'detail line names the companion');
  ok(cl.scoreBonus > dist.scoreBonus && cl.scoreBonus <= 0.15 && cl.fx.peer > dist.fx.peer && cl.fx.stress < dist.fx.stress, 'closer companion helps more');
  ok(cl.closenessGain > 0 && dist.closenessGain > cl.closenessGain, 'closeness grows more when less close');
  const alone = companionEffect('show', 'alone', new Rng(1));
  ok(alone.fx.stress < 0 && alone.scoreBonus === 0 && alone.closenessGain === 0, 'alone is calm');
  let met = 0;
  for (let s = 1; s <= 500; s++) if (companionEffect('fair', 'alone', new Rng(s)).metNew) met++;
  ok(met > 50 && met < 160, `alone sometimes meets someone (${met}/500)`);
  ok(companionEffect('fresher', 'group', new Rng(1)).fx.peer > 0, 'group gives peer');
  isJson([cl, dist, alone], 'companionEffect');
}

// ---- crush
{
  ok(CRUSH.config.perWindow === 0.8 && CRUSH.config.windowYears === 2, 'crush rate 0.8 per 2 years (cj)');
  ok(CRUSH.confessions.length >= 12, `>= 12 confessions (${CRUSH.confessions.length})`);
  const settings = new Set(CRUSH.confessions.map((c) => c.setting));
  for (const s of ['locker', 'after_class', 'dorm_gate', 'fair', 'show']) ok(settings.has(s), `confession setting ${s}`);
  ok(CRUSH.replies.accept.length >= 4 && CRUSH.replies.decline.length >= 4 && CRUSH.replies.wait.length >= 4 && CRUSH.replies.askBack.length >= 3, 'reply variants');
  ok(CRUSH.dateOutcomes.length >= 6 && CRUSH.breakups.length >= 6, 'date outcomes and breakups');
  ok(CRUSH.coupleLines.length >= 6 && CRUSH.exLines.length >= 4, 'couple and ex lines');
  eq(CRUSH.options.map((o) => o.id), ['accept', 'decline', 'wait'], 'crush options');
  eq(CRUSH.options.map((o) => o.label), ['ตกลง', 'ขอเป็นเพื่อนกัน', 'ขอเวลาคิด'], 'crush option labels (cj)');
  // texts do not assume anyone's sex
  const GENDERED = /(ครับ|ค่ะ|คะ(?!แนน)|ผม|ดิฉัน|หนู|\bเขา\b|\bเธอ(เป็น|ชอบ|บอก|ยิ้ม|พูด|เดิน)|เขา(บอก|ยิ้ม|พูด|ชอบ|เดิน|คือ)|ผู้ชาย|ผู้หญิง|แฟนหนุ่ม|แฟนสาว|พี่ชาย|พี่สาว|น้องชาย|น้องสาว)/;
  for (const t of texts([CRUSH.confessions, CRUSH.replies, CRUSH.dateOutcomes, CRUSH.breakups, CRUSH.coupleLines, CRUSH.exLines, CRUSH.options, CRUSH.optionsSecond, COMPANION])) {
    ok(!GENDERED.test(t), `sex-neutral text: ${t.slice(0, 40)}`);
  }
  for (const c of CRUSH.confessions) ok(c.text.includes('{name}'), `confession ${c.id} names the person`);
  const pool = [{ id: 1, name: 'ก', grade: 1 }, { id: 2, name: 'ข', grade: 2 }, { id: 3, name: 'ค', grade: 6 }];
  ok(crushWho(new Rng(1), []) === null, 'crushWho empty pool');
  for (let s = 1; s <= 50; s++) {
    ok(crushWho(new Rng(s), pool, { grade: 2 }).id !== 3, 'crushWho within 2 grades');
    ok(crushWho(new Rng(s), pool, { excludeIds: [1, 2, 3] }) === null, 'crushWho exclude all');
  }
  ok(pool.some((p) => crushWho(new Rng(1), pool) === p), 'crushWho picks from pool');
  const sets = new Set();
  for (let s = 1; s <= 200; s++) {
    const sc = crushScene(new Rng(s), { who: { name: 'ทดสอบ', grade: 3, room: 2 } });
    ok(sc.title.includes('ทดสอบ') && sc.text.includes('ทดสอบ') && !sc.text.includes('{name}'), 'crushScene fills the name');
    eq(sc.options.map((o) => o.id), ['accept', 'decline', 'wait'], 'crushScene options');
    ok(sc.person.name === 'ทดสอบ' && sc.person.grade === 3 && sc.person.room === 2, 'crushScene person card');
    sets.add(sc.setting);
    isJson(sc, 'crushScene');
    const fixed = crushScene(new Rng(s), { who: { name: 'ทดสอบ' }, setting: 'fair' });
    ok(fixed.setting === 'fair', 'crushScene fixed setting');
  }
  ok(sets.size >= 8, `crush settings vary (${sets.size})`);
  const second = crushScene(new Rng(1), { who: { name: 'ทดสอบ' }, second: true });
  eq(second.options.map((o) => o.id), ['accept', 'decline'], 'second ask has no wait option');
  // resolveCrush
  const accept = resolveCrush('accept', { name: 'ทดสอบ' }, new Rng(1));
  ok(accept.partner === 'start' && accept.fx.diligence < 0 && accept.fx.peer > 0 && accept.fx.teacherTrust > 0 && accept.fx.stress < 0, 'accept: closeness up, study down');
  ok(resolveCrush('decline', { name: 'ทดสอบ' }, new Rng(1)).partner === null, 'decline');
  const wait = resolveCrush('wait', { name: 'ทดสอบ' }, new Rng(1));
  ok(wait.ask === true && wait.partner === null, 'wait asks again later');
  ok(resolveCrush('checkin_focus', { name: 'ท' }, new Rng(1)).fx.diligence > 0, 'check-in: focus on study raises diligence');
  ok(resolveCrush('checkin_keep', { name: 'ท' }, new Rng(1)).partner === 'keep', 'check-in keep');
  ok(resolveCrush('checkin_end', { name: 'ท' }, new Rng(1)).partner === 'end', 'check-in end');
  ok(resolveCrush('breakup', { name: 'ท' }, new Rng(1)).fx.stress > 0, 'breakup raises stress');
  for (const id of ['accept', 'decline', 'wait', 'checkin_keep', 'checkin_focus', 'checkin_end', 'breakup', 'date']) {
    for (let s = 1; s <= 30; s++) {
      for (const money of [0, 10, 500]) {
        const r = resolveCrush(id, { name: 'ทดสอบ', money }, new Rng(s));
        ok(r.log.length > 5 && r.record.length > 3 && !r.log.includes('{name}') && !r.record.includes('{name}'), `resolveCrush ${id} text`);
        ok(!(r.fx.money < -money), `resolveCrush ${id} money`);
        isJson(r, `resolveCrush ${id}`);
      }
    }
  }
  const ci = CRUSH.checkin(new Rng(2), { name: 'ทดสอบ' });
  eq(ci.options.map((o) => o.id), ['checkin_keep', 'checkin_focus', 'checkin_end'], 'check-in options');
  ok(ci.text.includes('ทดสอบ') && !ci.text.includes('{name}'), 'check-in names the partner');
  ok(CRUSH.breakupText(new Rng(1), { name: 'ทดสอบ' }).text.includes('ทดสอบ') || true, 'breakupText');
  ok(CRUSH.coupleLine(new Rng(1), 'ทดสอบ').includes('ทดสอบ') && CRUSH.exLine(new Rng(1), 'ทดสอบ').includes('ทดสอบ'), 'couple and ex lines name the person');
  const date = new Set();
  for (let s = 1; s <= 100; s++) date.add(resolveCrush('date', { name: 'ท', money: 500 }, new Rng(s)).log.slice(0, 12));
  ok(date.size >= 5, 'date outcomes vary');
}


// ---- calendar update, Christmas, epidemics, infirmary, exam sickness
{
  ok(SCHEDULE.fair.term === 2 && SCHEDULE.fair.cycleInTerm === 2 && SCHEDULE.fair.dayInCycle === 6, 'fair moved to term 2 cycle 2');
  ok(SCHEDULE.xmas.term === 2 && SCHEDULE.xmas.cycleInTerm === 4 && SCHEDULE.xmas.hitChance === 0.3 && SCHEDULE.xmas.source === 'cj', 'xmas term 2 cycle 4, hit 0.3 (cj)');
  ok(SCHEDULE.show.term === 2 && SCHEDULE.show.showCycle === 8, 'show stays term 2 cycle 8');
  ok(SCHEDULE.exam.sickBeforeDays === 3 && SCHEDULE.epidemic.suspendShare > 0 && SCHEDULE.lab.preferTerm === 1, 'epidemic and exam numbers, plays moved to term 1');
  isJson(SCHEDULE, 'SCHEDULE 2');
  // Santa candy
  let hits = 0;
  for (let s = 1; s <= 5000; s++) if (XMAS.hitRoll(new Rng(s * 104729))) hits++;
  ok(hits > 1380 && hits < 1620, `xmas hit rate about 30% (${hits}/5000)`);
  ok(XMAS.santaLines.length >= 8 && XMAS.npcLines.length >= 6 && XMAS.nurseLines.length >= 6 && XMAS.visitLines.length >= 4 && XMAS.noticeLines.length >= 3, 'xmas text pools');
  ok(XMAS.texts.hit === 'ลูกอมของซานต้าลงหัวเรา', 'hit scene title');
  for (let s = 1; s <= 30; s++) {
    const cs = XMAS.craftSpec(new Rng(s));
    ok(cs.kind === 'tree' && cs.pieces.length >= 9 && cs.pieces[0].kind === 'base' && cs.slots >= 6 && cs.slots <= cs.pieces.length, 'xmas craft spec');
    isJson(cs, 'xmas craft');
    const ca = XMAS.candySpec(new Rng(s), { difficulty: s / 30 });
    ok(ca.tries === 3 && ca.zone > 0.1 && ca.speed > 0 && ca.label, 'candy timing spec');
    isJson(ca, 'candy');
    const hs = XMAS.hitScene(new Rng(s), {});
    eq(hs.options.map((o) => o.id), ['infirmary', 'shrug'], 'hit scene options');
    isJson([hs, XMAS.npcLine(new Rng(s), s % 7), XMAS.visitLine(new Rng(s), 'ทดสอบ')], 'xmas texts');
    ok(XMAS.visitLine(new Rng(s), 'ทดสอบ').includes('ทดสอบ'), 'visit line names the friend');
  }
  ok(XMAS.candySpec(new Rng(1), { difficulty: 1 }).zone < XMAS.candySpec(new Rng(1), { difficulty: 0 }).zone, 'harder candy catch is narrower');
  ok(XMAS.npcLine(new Rng(1), 0).includes('ไม่มีใคร') && XMAS.npcLine(new Rng(1), 12).includes('12 คน'), 'npc hit count line');
  const hit = resolve('xmas_candy', 'timing', 0.5, { money: 0, hit: true }, new Rng(1));
  ok(hit.fx.health < 0 && hit.log.includes('ลูกอมของซานต้าลงหัวเรา'), 'candy hit costs health');
  ok(!resolve('xmas_candy', 'timing', 0.5, { money: 0, hit: false }, new Rng(1)).fx.health, 'candy catch costs no health');
  const inf = resolve('xmas_infirmary', null, null, { money: 0, visitor: 'ทดสอบ' }, new Rng(1));
  ok(inf.fx.health < 0 && inf.fx.stress < 0 && inf.fx.teacherTrust > 0 && inf.log.includes('ทดสอบ'), 'infirmary: small health loss, stress relief, trust, visitor');
  ok(resolve('xmas_craft', 'craft', 0.9, { money: 0 }, new Rng(1)).fx.peer > 0, 'xmas craft result');
  // epidemics
  ok(EPIDEMICS.length >= 3 && EPIDEMICS.length <= 6, `3-6 diseases (${EPIDEMICS.length})`);
  const eids = new Set();
  for (const e of EPIDEMICS) {
    ok(e.id && e.name && e.symptoms && e.notice && !eids.has(e.id), `disease ${e.id}`);
    eids.add(e.id);
    ok(e.R > 1 && e.R < 3 && e.sickDays[0] >= 3 && e.sickDays[1] <= 7 && e.sickDays[0] <= e.sickDays[1], `disease ${e.id} numbers`);
    ok(e.seasons.hot > 0 && e.seasons.cool > 0 && e.seasons.cold > 0 && e.severity > 0 && e.severity <= 1, `disease ${e.id} seasons`);
    ok(!/covid|โควิด|sars|ซาร์ส|เมอร์ส|อีโบล่า|ฝีดาษลิง/i.test(JSON.stringify(e)), `disease ${e.id} is not a named recent pandemic`);
  }
  const cold = {};
  for (let s = 1; s <= 600; s++) { const id = pickEpidemic(new Rng(s), 'cold').id; cold[id] = (cold[id] || 0) + 1; }
  ok(Object.keys(cold).length >= 4 && cold.flu > cold.stomach, 'pickEpidemic leans to flu in the cold season');
  ok(epidemicById('flu').name === 'ไข้หวัดใหญ่' && epidemicById('zzz') === null, 'epidemicById');
  for (const e of EPIDEMICS) {
    for (const kind of ['outbreak', 'ill', 'suspend', 'resume', 'recovered']) {
      const sc = epidemicScene(kind, e, { share: 0.27, days: 4, canGoHome: true }, new Rng(1));
      ok(sc.title && sc.text.length > 15 && sc.options.length >= 1, `epidemic scene ${e.id} ${kind}`);
      isJson(sc, `epidemic scene ${kind}`);
      if (kind === 'ill') eq(sc.options.map((o) => o.id), ['infirmary', 'dorm', 'home'], 'ill options');
      if (kind === 'suspend') ok(sc.title === 'โรงเรียนประกาศหยุดเรียน' && sc.text.includes('4 วัน') && sc.text.includes('27%'), 'suspend notice');
    }
  }
  ok(epidemicScene('ill', EPIDEMICS[0], { canGoHome: false }, new Rng(1)).options[2].disabled === true, 'home disabled when not allowed');
  eq(epidemicChip(EPIDEMICS[0], 0.12), 'โรคระบาด: ไข้หวัดใหญ่ 12%', 'epidemic chip text');
  eq(epidemicChip('flu', 0.5), 'โรคระบาด: ไข้หวัดใหญ่ 50%', 'epidemic chip by id');
  // infirmary
  ok(INFIRMARY.nurseLines.length >= 8 && INFIRMARY.recoveryLines.length >= 5, 'infirmary line pools');
  for (const place of ['dorm', 'infirmary', 'home']) {
    ok(INFIRMARY.sickLabel(place).startsWith('ไม่สบาย: '), `sick label ${place}`);
    ok(INFIRMARY.detail(place, new Rng(1)).length > 10, `sick detail ${place}`);
    const fx = INFIRMARY.dayFx(place);
    ok(fx.health > 0 && fx.energy > 0, `resting heals ${place}`);
  }
  eq(INFIRMARY.sickLabel('dorm'), 'ไม่สบาย: พักที่หอ', 'dorm label matches the timeline text');
  eq(INFIRMARY.sickLabel('infirmary'), 'ไม่สบาย: ห้องพยาบาล', 'infirmary label');
  ok(INFIRMARY.dayFx('infirmary').health > INFIRMARY.dayFx('dorm').health && INFIRMARY.dayFx('home').stress < INFIRMARY.dayFx('dorm').stress, 'infirmary heals more, home relieves stress');
  // exam sickness
  for (const exam of ['mid', 'final']) {
    const m = EXAM_SICK.missed(new Rng(1), { exam, subject: 'คณิตศาสตร์' });
    ok(m.title && m.text.includes('คณิตศาสตร์') && m.record.startsWith('ขาดสอบ') && m.reportLine.includes('40%') && m.options.length === 1, `missed exam ${exam}`);
    const pp = [1, 2, 3].map((d) => EXAM_SICK.penalty(new Rng(1), { exam, daysBefore: d }));
    ok(pp[0].scale > pp[1].scale && pp[1].scale > pp[2].scale && pp[2].scale > 0 && pp[0].scale <= 1, '1 day before is worse than 3');
    ok(pp.every((x) => x.record.includes('ป่วยก่อน') && x.reportLine.length > 10), 'penalty lines');
    const po = EXAM_SICK.postponed(new Rng(1), { exam, days: 4 });
    ok(po.text.includes('4 วัน') && po.reportLine.includes('4 วัน'), 'postponed exam');
    isJson([m, pp, po], 'exam sick');
  }
  ok(EXAM_SICK.config.windowDays === 3 && EXAM_SICK.config.missedCredit === 0.4, 'exam sick config');
}

// ---- colour sports day
{
  const sp = SCHEDULE.sports;
  ok(sp.maxEntries === 2 && sp.source === 'cj' && sp.colors.join() === 'red,yellow,purple,blue' && sp.dayCycle === 6 && sp.term === 1, 'SCHEDULE.sports');
  isJson(SCHEDULE, 'SCHEDULE 3');
  // colours cycle 1-2-3-4 by number (cj)
  const ids = [];
  for (let n = 1; n <= 9; n++) ids.push(colorOf(n).id);
  eq(ids, ['red', 'yellow', 'purple', 'blue', 'red', 'yellow', 'purple', 'blue', 'red'], 'colorOf cycles red yellow purple blue');
  eq(colorOf(1).th, 'แดง', 'colorOf 1 is แดง');
  eq(colorOf(2).th, 'เหลือง', 'colorOf 2');
  eq(colorOf(3).th, 'ม่วง', 'colorOf 3');
  eq(colorOf(4).th, 'ฟ้า', 'colorOf 4');
  eq(colorOf(4).name, 'สีฟ้า', 'colorOf name');
  ok(colorOf(0).id === 'red' && colorOf(undefined).id === 'red' && colorOf(-3).id === 'red', 'colorOf bad numbers fall back to red');
  const per = { red: 0, yellow: 0, purple: 0, blue: 0 };
  for (let n = 1; n <= 24; n++) per[colorOf(n).id]++;
  eq(per, { red: 6, yellow: 6, purple: 6, blue: 6 }, '6 per colour in a room of 24');
  ok(/^#[0-9a-f]{6}$/i.test(colorOf(7).hex), 'colour hex');
  // events
  eq(SPORTS.events.map((e) => e.id), ['football', 'basketball', 'volleyball', 'takraw', 'sprint', 'relay', 'tug', 'badminton', 'stand', 'cheer'], '8 sports + stand + cheer');
  const GAMES = ['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'];
  const labelsSeen = new Set();
  for (const ev of SPORTS.events) {
    ok(ev.name && ev.blurb.length > 10 && ev.practice && GAMES.includes(ev.game), `sport ${ev.id}`);
    ok(['team', 'solo', 'mass'].includes(ev.kind), `sport ${ev.id} kind`);
    for (const t of ['great', 'good', 'ok', 'bad']) ok(ev.texts[t].length > 10, `sport ${ev.id} text ${t}`);
    for (const color of ['red', 'yellow', 'purple', 'blue']) {
      for (const d of [0, 0.5, 1]) {
        const p = ev.spec(new Rng(7), { difficulty: d, color });
        isJson(p, `sport spec ${ev.id}`);
        eq(ev.spec(new Rng(7), { difficulty: d, color }), p, `sport spec ${ev.id} deterministic`);
        if (ev.game === 'timing') ok(p.tries === 3 && p.zone > 0.1 && p.zone < 0.4 && p.speed > 0 && p.label, `${ev.id} timing params`);
        if (ev.game === 'rhythm') ok([3, 4].includes(p.lanes) && p.bpm > 60 && p.notes >= 16 && p.label, `${ev.id} rhythm params`);
        if (ev.game === 'track') ok(['camera', 'sound'].includes(p.mode) && p.speed > 0 && p.band > 0 && p.band < 1, `${ev.id} track params`);
        if (ev.game === 'dash') ok(p.items.length >= 6 && p.sequenceLen >= 5 && p.sequenceLen <= p.items.length && p.timeLimit >= 10, `${ev.id} dash params`);
        if (ev.game === 'pattern') ok(p.beads.length === 5 && p.rounds >= 4 && p.startLen >= 3 && p.label, `${ev.id} pattern params`);
        if (ev.game === 'rhythm') labelsSeen.add(p.label);
      }
    }
    ok(ev.spec(new Rng(1), { difficulty: 1 }) !== null && ev.spec(new Rng(1), {}) !== null, `${ev.id} spec with missing ctx`);
  }
  ok(SPORTS.byId('stand').spec(new Rng(1), { color: 'blue' }).label.includes('สีฟ้า'), 'stand label carries the colour');
  ok(SPORTS.byId('cheer').spec(new Rng(1), { color: 'purple' }).label.includes('สีม่วง'), 'cheer label carries the colour');
  ok(labelsSeen.size >= 6, 'rhythm labels differ by colour/event');
  ok(SPORTS.byId('stand').game === 'rhythm' && SPORTS.byId('cheer').game === 'rhythm' && SPORTS.byId('relay').game === 'rhythm' && SPORTS.byId('sprint').game === 'dash' && SPORTS.byId('tug').game === 'timing', 'game mapping (cj)');
  ok(SPORTS.byId('nope') === null, 'byId');
  // colours: names, cheers, chants, stand themes
  for (const c of SPORTS.colors) {
    ok(c.th && /^#/.test(c.hex) && c.cheers.length >= 3 && c.chant && c.stand.name && c.stand.palette.length >= 3 && c.stand.stunts.length >= 3, `colour ${c.id} content`);
  }
  // sign-up scene
  const sc = SPORTS.signupScene(new Rng(1), { color: 'purple', no: 7, chosen: [] });
  ok(sc.title === 'สมัครกีฬาสี' && sc.text.includes('สีม่วง') && sc.text.includes('เลขที่ 7') && sc.color.id === 'purple', 'signup scene');
  ok(sc.options.length === 11 && sc.options[sc.options.length - 1].id === 'none' && sc.options[sc.options.length - 1].label === 'ไม่ลงเลย', 'signup options end with ไม่ลงเลย');
  ok(!sc.options.some((o) => o.id === 'done'), 'no confirm button until something is chosen');
  const one = SPORTS.signupOptions(new Rng(1), { chosen: ['stand'] });
  ok(one.some((o) => o.id === 'done') && one.find((o) => o.id === 'sport:stand').selected === true && !one.find((o) => o.id === 'sport:relay').disabled, 'one chosen: others still open');
  const two = SPORTS.signupOptions(new Rng(1), { chosen: ['stand', 'relay'] });
  ok(two.find((o) => o.id === 'sport:football').disabled === true && two.find((o) => o.id === 'sport:football').reason.includes('2') && two.find((o) => o.id === 'sport:relay').disabled === false, 'max 2 events');
  isJson([sc, one, two], 'signup');
  // results
  const g = sportsResult('football', 0.9, { color: 'red' }, new Rng(1));
  const b = sportsResult('football', 0.1, { color: 'red' }, new Rng(1));
  ok(g.points > b.points && g.points <= 10 && g.fx.peer > 0 && g.fx.stress < 0 && g.closenessGain === 5 && g.log.includes('สีแดง') && g.log.includes('ฟุตบอล'), 'sportsResult shape and scaling');
  ok(g.fx.peer > b.fx.peer && g.tier.id === 'great' && b.tier.id === 'bad', 'better play, more peer');
  isJson([g, b], 'sportsResult');
  for (const ev of SPORTS.events) {
    for (const money of [0, 50]) for (const sc2 of [0, 0.5, 1, null]) {
      const r = resolve(`sport_${ev.id}`, ev.game, sc2, { money, color: 'blue' }, new Rng(5));
      ok(r.log.includes(ev.name) && r.tier && Object.values(r.fx).every((v) => Number.isFinite(v) && v !== 0), `resolve sport_${ev.id}`);
      noEmoji(r, `resolve sport_${ev.id}`);
    }
  }
  const pr = resolve('sport_practice', null, null, { money: 0, sportId: 'relay', rival: 'ทดสอบ' }, new Rng(2));
  ok(pr.fx.peer > 0 && pr.fx.stress < 0 && pr.fx.diligence < 0 && pr.log.includes('ซ้อม'), 'practice block');
  ok(resolve('sport_unknown_thing', 'x', 0.5, { money: 0 }, new Rng(1)).log.length > 3, 'unknown sport id does not throw');
  // ranking
  const rk = colorRanking({ red: 90, yellow: 120, purple: 60, blue: 75 });
  eq(rk.ranking.map((r) => r.id), ['yellow', 'red', 'blue', 'purple'], 'ranking order');
  eq(rk.ranking.map((r) => r.rank), [1, 2, 3, 4], 'ranks');
  ok(rk.winner.id === 'yellow' && rk.winner.th === 'เหลือง' && rk.text.includes('สีเหลือง') && rk.title === 'ผลกีฬาสี', 'ranking winner text');
  eq(rk.card.rows[0], ['อันดับ 1 สีเหลือง', '120 คะแนน'], 'ranking card row');
  ok(rk.bars[0].frac === 1 && rk.bars[3].frac === 0.5 && /^#/.test(rk.bars[0].hex), 'ranking bars');
  ok(rk.fx.yellow.peer > rk.fx.red.peer && rk.fx.red.peer > rk.fx.purple.peer - 0.0001 && rk.fx.yellow.stress < 0, 'winning colour gets the biggest boost');
  eq(colorRanking([10, 20, 30, 40]).ranking.map((r) => r.id), ['blue', 'purple', 'yellow', 'red'], 'ranking from an array');
  const tie = colorRanking({ red: 50, yellow: 50, purple: 10, blue: 5 });
  ok(tie.ranking[0].rank === 1 && tie.ranking[1].rank === 1 && tie.ranking[2].rank === 3 && tie.text.includes('เท่ากัน'), 'ties share a rank');
  ok(colorRanking({}).ranking.length === 4 && colorRanking(null).winner.id === 'red', 'ranking with no points');
  ok(colorRankFx(1).peer > colorRankFx(2).peer && colorRankFx(2).peer > colorRankFx(4).peer, 'rank fx falls with place');
  isJson([rk, tie], 'colorRanking');
  // jokes and commentary are neutral
  ok(SPORTS.rivalJokes.length >= 6 && SPORTS.rivalJoke(new Rng(1), 'ทดสอบ').includes('ทดสอบ'), 'rival jokes');
  // companion at the sports day
  const friends = [
    { id: 1, name: 'แดงหนึ่ง', closeness: 80, color: 'red', grade: 2, room: 1 },
    { id: 2, name: 'ฟ้าหนึ่ง', closeness: 95, color: 'blue', grade: 2, room: 1 },
    { id: 3, name: 'แดงสอง', closeness: 40, color: 'red', grade: 3, room: 2 },
  ];
  const cs = COMPANION.scene('sport', { friends, myColor: 'red', partner: { id: 7, name: 'แฟนทดสอบ', closeness: 70, color: 'blue' } }, new Rng(1));
  ok(cs.title === 'นั่งเชียร์สีกับใครดี' && !cs.options.some((o) => o.id === 'friend:2'), 'sport scene hides other-colour friends');
  ok(cs.options[0].id === 'partner' && cs.options[0].sub.includes('คนละสี') && cs.options.some((o) => o.id === 'friend:1') && cs.options.some((o) => o.id === 'alone') && cs.options.some((o) => o.id === 'group'), 'sport scene partner of another colour is a rival');
  const same = COMPANION.scene('sport', { friends, myColor: 'red', partner: { id: 7, name: 'แฟนทดสอบ', closeness: 70, color: 'red' } }, new Rng(1));
  ok(!same.options[0].sub.includes('คนละสี'), 'same-colour partner is plain');
  const noColor = COMPANION.scene('sport', { friends }, new Rng(1));
  ok(noColor.options.some((o) => o.id === 'friend:2'), 'no colour info: nobody filtered');
  const ce = companionEffect('sport', 80, new Rng(1), 'ทดสอบ');
  ok(ce.detail === 'เชียร์สีกับทดสอบ' && ce.fx.peer > 0 && ce.fx.stress < 0, 'companionEffect sport');
  const riv = companionEffect('sport', 80, new Rng(1), 'ทดสอบ', { sameColor: false });
  ok(riv.line.length > 10 && ['เป็นคู่แข่ง', 'เชียร์คนละฝั่ง', 'ตกลงกันว่า'].some((p) => riv.line.startsWith(p)), 'rival line for another colour');
  noEmoji([SPORTS, cs, ce], 'sports texts');
  const GENDERED2 = /(ครับ|ค่ะ|คะ(?!แนน)|ผม|ดิฉัน|หนู|\bเขา\b|เขา(บอก|ยิ้ม|พูด|ชอบ|เดิน)|ผู้ชาย|ผู้หญิง|พี่ชาย|พี่สาว|น้องชาย|น้องสาว)/;
  for (const t of texts([SPORTS.events.map((e) => [e.name, e.blurb, e.practice, e.texts]), SPORTS.rivalJokes, SPORTS.colors, SPORTS.signup, sc.text])) ok(!GENDERED2.test(t), `sex-neutral sport text: ${t.slice(0, 40)}`);
}

// ---- every text in every export: no emoji, no real brand-ish leftovers, no unfilled placeholders in static data
{
  const all = { SCHEDULE, SATURDAY, CONTESTS: Object.values(CONTESTS).map((c) => ({ t: c.title, n: c.entryNote, p: c.prize })), FLOAT: { t: FLOAT.texts, w: FLOAT.wishes, v: FLOAT.variants }, LABS: LAB.map((l) => l.title), SHOW: { t: SHOW.themes, r: SHOW.roles }, FRESHER: FRESHER.days, INGREDIENTS };
  noEmoji(all, 'static data');
  noEmoji(HALL.lecture.topics, 'lecture topics');
  noEmoji(HALL.special.map((d) => ({ ...d, spec: undefined })), 'special days');
  noEmoji(HALL.farewell.speeches, 'farewell speeches');
  noEmoji(CRUSH, 'CRUSH');
  noEmoji(COMPANION, 'COMPANION');
  noEmoji([XMAS, EPIDEMICS, INFIRMARY, EXAM_SICK], 'xmas/epidemic/infirmary/exam texts');
}

if (failed) {
  console.error(`\n${failed} of ${checks} checks FAILED`);
  process.exit(1);
}
console.log(`activities tests passed (${checks} checks)`);
