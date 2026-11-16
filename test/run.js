// Checks that phase 1 does what cj described. Run: node test/run.js
import { createSchool, yearStep, activeIn } from '../src/sim.js';
import { gateProb } from '../src/rooms.js';
import { drawWealth } from '../src/cohort.js';
import { askParents, autoTransfer, resetAsks } from '../src/money.js';
import { evaluateEvening } from '../src/evening.js';
import { DORMS, SCHOOL } from '../src/config.js';
import { Rng } from '../src/rng.js';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failed += 1;
}
const near = (x, y, tol) => Math.abs(x - y) <= tol;

// ---------- the starting school ----------
const school = createSchool(7);
const sizes = [1, 2, 3, 4, 5, 6].map((g) => activeIn(school, g).length);
check('grade sizes 96/96/96/144/144/144', sizes.join('/') === '96/96/96/144/144/144', sizes.join('/'));
check('720 students in total', sizes.reduce((a, b) => a + b, 0) === 720);

function roomCountsOk(sch) {
  for (const g of [1, 2, 3, 4, 5, 6]) {
    const list = activeIn(sch, g);
    const n = SCHOOL.roomsPerGrade[g];
    for (let r = 1; r <= n; r++) {
      const c = list.filter((s) => s.room === r).length;
      if (c > SCHOOL.roomSize || c < SCHOOL.roomSize - 3) return `grade ${g} room ${r} has ${c}`;
    }
    if (list.some((s) => s.room < 1 || s.room > n)) return `grade ${g} has a bad room number`;
  }
  return '';
}
check('every room has about 24 students at the start', roomCountsOk(school) === '', roomCountsOk(school));

const g1 = activeIn(school, 1);
const g4 = activeIn(school, 4);
check('ม.1: 36 of 96 have 4.00 (room 1 + half of room 2)', g1.filter((s) => s.gpa === 4).length === 36);
check('ม.1: nobody under 3.50', g1.every((s) => s.gpa >= 3.5));
check('ม.4: 56 of 144 have 4.00', g4.filter((s) => s.gpa === 4).length === 56);
check('ม.4: rooms 5-6 are 3.40 or less', g4.filter((s) => s.room >= 5).every((s) => s.gpa <= 3.4));
check('ม.4: rooms 1-2 are all 4.00', g4.filter((s) => s.room <= 2).every((s) => s.gpa === 4));

// ---------- the gate curve ----------
check('gate: 3.90 and up always passes', gateProb(3.9) === 1 && gateProb(4) === 1);
check('gate: 3.79 is high (about 85%)', near(gateProb(3.79), 0.85, 0.01));
check('gate: 3.50 is low but not zero', gateProb(3.5) > 0 && gateProb(3.5) < 0.3);

// ---------- day-1 money (two random rounds) ----------
const rng = new Rng(99);
const N = 40000;
const tiers = { normal: 0, spoiled: 0, rich: 0 };
let outOfRange = 0;
for (let i = 0; i < N; i++) {
  const w = drawWealth(rng);
  tiers[w.tier] += 1;
  if (w.tier === 'normal' && (w.start < 800 || w.start > 2000)) outOfRange += 1;
  if (w.tier === 'spoiled' && (w.start <= 2000 || w.start > 10000)) outOfRange += 1;
  if (w.tier === 'rich' && (w.start <= 10000 || w.start > 20000)) outOfRange += 1;
}
const pRich = tiers.rich / N;
const pSpoiled = tiers.spoiled / N;
check('rich is about 2.5 in 96', near(pRich, 2.5 / 96, 0.004), `${(pRich * 96).toFixed(2)} in 96`);
check('spoiled is about 10 in 96', near(pSpoiled, 10 / 96, 0.008), `${(pSpoiled * 96).toFixed(2)} in 96`);
check('amounts stay inside their tier', outOfRange === 0);

// ---------- asking the parents ----------
const kid = { startMoney: 800, money: 0, askCount: 0, tier: 'normal' };
const asks = [askParents(kid, rng), askParents(kid, rng), askParents(kid, rng), askParents(kid, rng)];
check('asking: 80, 40, 20, then refused', asks.map((a) => a.amount).join(',') === '80,40,20,0', asks.map((a) => a.amount).join(','));
check('a refusal comes with a reason', !asks[3].ok && asks[3].reason.length > 0);
resetAsks(kid);
check('asking resets at the home trip', askParents(kid, rng).amount === 80);
const richKid = { startMoney: 16000, money: 4000, askCount: 0, tier: 'rich' };
check('rich parents send money under 5,000', autoTransfer(richKid, rng) > 0);
const spoiledKid = { startMoney: 6000, money: 100, askCount: 0, tier: 'spoiled' };
check('spoiled parents never send by themselves', autoTransfer(spoiledKid, rng) === 0);

// ---------- six school years ----------
console.log('\nyear  gate(in/pass)  outsiders  dropped  left  graduated  active');
const first = createSchool(2026);
let bad = '';
for (let y = 1; y <= 6; y++) {
  const r = yearStep(first);
  const active = first.students.filter((s) => s.status === 'active').length;
  console.log(
    `${String(y).padStart(4)}  ${String(r.gateInternal).padStart(3)}/${String(r.gatePassed).padEnd(3)}        ${String(r.outsiders).padStart(5)}    ${String(r.dropouts).padStart(5)}  ${String(r.leftElite).padStart(4)}  ${String(r.graduated).padStart(8)}  ${String(active).padStart(6)}`,
  );
  const s4 = activeIn(first, 4).length;
  const s1 = activeIn(first, 1).length;
  if (s4 !== 144) bad += ` y${y}: ม.4 has ${s4};`;
  if (s1 !== 96) bad += ` y${y}: ม.1 has ${s1};`;
  const rc = roomCountsOk(first);
  if (rc) bad += ` y${y}: ${rc};`;
}
check('ม.4 is always 144 and ม.1 always 96, rooms stay sane for 6 years', bad === '', bad);

// ---------- dorms ----------
function dormsOk(sch) {
  for (const s of sch.students) {
    if (s.status !== 'active') continue;
    const d = DORMS[s.dorm];
    if (!d || d.sex !== s.sex || !d.grades.includes(s.grade)) return `student ${s.id} (${s.sex}, ม.${s.grade}) is in ${s.dorm}`;
  }
  for (const [key, info] of Object.entries(sch.dorms)) {
    const list = sch.students.filter((s) => s.status === 'active' && s.dorm === key);
    for (let r = 1; r <= info.rooms; r++) {
      const c = list.filter((s) => s.dormRoom === r).length;
      if (c > DORMS[key].cap) return `${key} room ${r} has ${c}`;
    }
  }
  return '';
}
check('everyone is in the right dorm, no room over 10 (6 in the lowest dorm)', dormsOk(first) === '', dormsOk(first));
console.log(
  'dorm sizes: ' +
    Object.entries(first.dorms)
      .map(([k, v]) => `${k}=${v.students}/${v.rooms} rooms`)
      .join('  '),
);

// ---------- the dorm evening ----------
const girlsDorm = DORMS.g1; // lights off 23:00, out by 07:10
const boysDorm = DORMS.bPhi; // lights off 22:00, out by 06:30
const allStudy = Array(10).fill('study_alone');
const eg = evaluateEvening(girlsDorm, allStudy);
const eb = evaluateEvening(boysDorm, allStudy);
check('girls: slots after 23:00 turn into sleep', eg.plan.slice(8).every((a) => a === 'sleep') && eg.plan[7] === 'study_alone');
check('boys (22:00): slots after 22:00 turn into sleep', eb.plan.slice(6).every((a) => a === 'sleep') && eb.plan[5] === 'study_alone');
check('sleeping early gives more sleep than studying late', evaluateEvening(girlsDorm, []).sleepHours > eg.sleepHours);
const secret = evaluateEvening(girlsDorm, [...Array(8).fill('chat'), 'study_light', 'study_light']);
check('quiet things still work after lights-out and cost sleep', secret.plan[8] === 'study_light' && secret.sleepHours < eg.sleepHours);
console.log(`evening: girls all-study ${eg.sleepHours.toFixed(1)} h sleep, boys all-study ${eb.sleepHours.toFixed(1)} h sleep`);

// ---------- same seed, same school ----------
const a = createSchool(5);
const b = createSchool(5);
const same = a.students.slice(0, 50).every((s, i) => s.gpa === b.students[i].gpa && s.sex === b.students[i].sex && s.tier === b.students[i].tier);
check('the same seed gives the same school', same);

console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
