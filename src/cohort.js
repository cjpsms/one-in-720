// Making students: sex, personality, family money, ability and diligence.
import { SCHOOL, MONEY } from './config.js';

const r2 = (x) => Math.round(x * 100) / 100;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Day-1 money is two random rounds (cj): round 1 picks the tier, round 2 picks the amount inside it.
export function drawWealth(rng) {
  const pRich = MONEY.richPer96 / 96;
  const pSpoiled = MONEY.spoiledPer96 / 96;
  const r = rng.float();
  if (r < pRich) return { tier: 'rich', start: rng.int(MONEY.rich[0], MONEY.rich[1]) };
  if (r < pRich + pSpoiled) return { tier: 'spoiled', start: rng.int(MONEY.spoiled[0], MONEY.spoiled[1]) };
  return { tier: 'normal', start: rng.int(MONEY.normal[0], MONEY.normal[1]) };
}

export function makeStudent(rng, school, grade) {
  const w = drawWealth(rng);
  return {
    id: school.nextId++,
    isPlayer: false,
    sex: rng.chance(SCHOOL.maleShare) ? 'M' : 'F',
    trait: rng.chance(0.5) ? 'extro' : 'intro', // cj: born extrovert or introvert
    grade,
    room: 0,
    rank: 0,
    ability: rng.gauss(),
    diligence: rng.gauss(),
    effortBonus: 0, // the player's choices add to this
    perf: 0,
    gpa: null,
    gpaHist: [],
    tier: w.tier,
    startMoney: w.start,
    money: w.start,
    askCount: 0,
    status: 'active', // active | graduated | dropped | failed_gate | left_elite
    dorm: null,
    dormRoom: 0,
  };
}

// A student coming from another school into ม.4. Already selected, so a bit above average.
export function makeOutsider(rng, school) {
  const s = makeStudent(rng, school, 4);
  s.gpa = r2(clamp(3.72 + 0.12 * rng.gauss(), 3.3, 4.0));
  s.ability = rng.gauss() * 0.5 + 0.4;
  s.outsider = true;
  return s;
}

// Marks for one year. The player's choices will change effortBonus.
export function yearPerf(rng, s) {
  // noise 0.3 is a PLACEHOLDER: lower = ranks stay more stable from year to year
  return 0.6 * s.ability + 0.4 * s.diligence + 0.3 * rng.gauss() + s.effortBonus;
}
