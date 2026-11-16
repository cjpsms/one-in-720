// The school as a whole: 720 students, 6 grades, rooms re-sorted every year, the ม.4 gate.
// Phase 1 runs at year level. Day-by-day simulation comes later.
import { Rng } from './rng.js';
import { SCHOOL, DROPOUT_PER_96, LEAVE_ELITE_RATE } from './config.js';
import { makeStudent, makeOutsider, yearPerf } from './cohort.js';
import { scoreYear, placeRooms, standing, gateProb } from './rooms.js';
import { assignDorms } from './dorm.js';

const GRADES = [1, 2, 3, 4, 5, 6];

export const activeIn = (school, grade) =>
  school.students.filter((s) => s.status === 'active' && s.grade === grade);

export function createSchool(seed = 1) {
  const rng = new Rng(seed);
  const school = { seed, year: 1, nextId: 1, rng, students: [] };
  for (const g of GRADES) {
    const n = SCHOOL.roomsPerGrade[g] * SCHOOL.roomSize;
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = makeStudent(rng, school, g);
      s.perf = yearPerf(rng, s);
      list.push(s);
      school.students.push(s);
    }
    scoreYear(list, g);
    placeRooms(list, g, (s) => s.perf);
  }
  school.dorms = assignDorms(school);
  return school;
}

// End of a school year: marks, dropouts, the ม.4 gate, promotion, new intake, new rooms, new dorms.
export function yearStep(school) {
  const { rng } = school;
  const report = {
    year: school.year,
    dropouts: 0,
    leftElite: 0,
    gateInternal: 0,
    gatePassed: 0,
    outsiders: 0,
    graduated: 0,
    newFirstYear: 0,
  };

  // 1. this year's marks for everyone
  for (const g of GRADES) {
    const list = activeIn(school, g);
    for (const s of list) s.perf = yearPerf(rng, s);
    scoreYear(list, g);
  }

  // 2. rare dropouts (the player never drops out by chance, only by choice)
  for (const s of school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    if (rng.chance(DROPOUT_PER_96[s.grade] / 96)) {
      s.status = 'dropped';
      report.dropouts += 1;
    }
  }

  // 3. the ม.4 gate: no reserved seats, only the ม.3 GPA counts
  const passers = [];
  for (const s of activeIn(school, 3)) {
    if (!s.isPlayer && s.gpa >= 4 && rng.chance(LEAVE_ELITE_RATE)) {
      s.status = 'left_elite';
      report.leftElite += 1;
      continue;
    }
    report.gateInternal += 1;
    if (rng.chance(gateProb(s.gpa))) {
      passers.push(s);
      report.gatePassed += 1;
    } else {
      s.status = 'failed_gate';
    }
  }

  // 4. promotion (ม.3 students are handled by the gate above)
  const moves = [];
  for (const s of school.students) {
    if (s.status !== 'active') continue;
    if (s.grade === 3) continue;
    if (s.grade === 6) {
      s.status = 'graduated';
      report.graduated += 1;
    } else {
      moves.push([s, s.grade + 1]);
    }
  }
  for (const s of passers) moves.push([s, 4]);
  for (const [s, g] of moves) s.grade = g;

  // 5. outsiders fill ม.4 up to 144
  const seats = Math.max(0, SCHOOL.seats4 - passers.length);
  for (let i = 0; i < seats; i++) {
    const o = makeOutsider(rng, school);
    o.perf = yearPerf(rng, o);
    school.students.push(o);
  }
  report.outsiders = seats;

  // 6. new ม.1 intake, rooms by prior results (ability stands in for them)
  const intake = [];
  for (let i = 0; i < SCHOOL.roomsPerGrade[1] * SCHOOL.roomSize; i++) {
    const s = makeStudent(rng, school, 1);
    s.perf = yearPerf(rng, s);
    intake.push(s);
    school.students.push(s);
  }
  report.newFirstYear = intake.length;
  placeRooms(intake, 1, (s) => s.ability);
  for (const s of intake) s.gpa = null;

  // 7. rooms are re-sorted every year by the GPA just earned
  for (const g of [2, 3, 4, 5, 6]) {
    placeRooms(activeIn(school, g), g, standing);
  }

  // 8. new dorms and roommates, then the next year starts
  school.dorms = assignDorms(school);
  school.year += 1;
  return report;
}
