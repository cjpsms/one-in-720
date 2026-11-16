// GPA by rank, rooms by rank, and the ม.4 gate.
import { SCHOOL, GPA_BANDS, GATE_CURVE } from './config.js';

const r2 = (x) => Math.round(x * 100) / 100;
const isUpper = (grade) => grade >= 4;

// rank is 1-based, size is how many students are in the grade now
export function gpaByRank(grade, rank, size) {
  const bands = GPA_BANDS[isUpper(grade) ? 'upper' : 'lower'];
  let cum = 0;
  let prevLimit = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    cum += b.share;
    // whole-number limits, so a band never leaks one student into the next
    const limit = i === bands.length - 1 ? size : Math.round(cum * size);
    if (rank <= limit) {
      if (b.hi === b.lo) return b.hi;
      const count = limit - prevLimit;
      const pos = count > 1 ? (rank - prevLimit - 1) / (count - 1) : 0;
      return r2(b.hi - (b.hi - b.lo) * pos);
    }
    prevLimit = limit;
  }
  return 0;
}

export function roomByRank(grade, rank, size) {
  const n = SCHOOL.roomsPerGrade[grade];
  return Math.min(n, Math.floor(((rank - 1) / size) * n) + 1);
}

export const sortDesc = (students, keyFn) => students.slice().sort((a, b) => keyFn(b) - keyFn(a));

// Turns this year's performance into a GPA for everyone in the grade.
export function scoreYear(students, grade) {
  const sorted = sortDesc(students, (s) => s.perf);
  sorted.forEach((s, i) => {
    s.gpa = gpaByRank(grade, i + 1, sorted.length);
    s.rank = i + 1;
    s.gpaHist.push({ grade, gpa: s.gpa, rank: i + 1, size: sorted.length });
  });
}

// Puts students in rooms by a score (highest first). Rooms are re-sorted every year (cj).
export function placeRooms(students, grade, keyFn) {
  const sorted = sortDesc(students, keyFn);
  sorted.forEach((s, i) => {
    s.room = roomByRank(grade, i + 1, sorted.length);
    s.rank = i + 1;
  });
  return sorted;
}

// Same standing for rooms: GPA first, performance only breaks ties.
export const standing = (s) => s.gpa * 1000 + s.perf;

// Chance to pass the ม.4 gate from the ม.3 GPA.
export function gateProb(gpa) {
  const pts = GATE_CURVE;
  if (gpa <= pts[0][0]) return pts[0][1];
  if (gpa >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (gpa <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (gpa - x0)) / (x1 - x0);
    }
  }
  return 1;
}
