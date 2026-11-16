// Small helpers shared by the engine files: clamp, rounding, clock text, the calendar.
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const r1 = (x) => Math.round(x * 10) / 10;
export const r2 = (x) => Math.round(x * 100) / 100;
export const nf = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function hhmm(m) {
  const t = Math.round(m);
  const h = Math.floor(t / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 1 = Monday ... 7 = Sunday
export const DOW_TH = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
export const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

// Calendar of the whole game. Day 1 is the Monday of cycle 1.
// A cycle is 14 days: Mon..Sun in the dorm (days 1-7), Mon..Fri in the dorm (days 8-12),
// then the home trip (days 13-14, Sat and Sun at home). A term is termCycles cycles, a year is two terms.
export function calendar(day, termCycles) {
  const d0 = day - 1;
  const cycle = Math.floor(d0 / 14) + 1;
  const dayInCycle = (d0 % 14) + 1;
  const dow = ((dayInCycle - 1) % 7) + 1;
  const perYear = termCycles * 2;
  const year = Math.floor((cycle - 1) / perYear) + 1;
  const cycleInYear = ((cycle - 1) % perYear) + 1;
  const term = cycleInYear <= termCycles ? 1 : 2;
  const cycleInTerm = term === 1 ? cycleInYear : cycleInYear - termCycles;
  const home = dayInCycle >= 13;
  const weekend = dayInCycle === 6 || dayInCycle === 7;
  return {
    day, cycle, dayInCycle, dow, year, term, cycleInYear, cycleInTerm,
    home, weekend, schoolDay: !home && !weekend,
    lastSchoolDay: dayInCycle === 12, // after the last class the trip home starts
    firstDayOfTerm: cycleInTerm === 1 && dayInCycle === 1,
    lastCycleOfTerm: cycleInTerm === termCycles,
  };
}

// PLACEHOLDER: the Thai school year starts in May; hot, then rainy/cool, cold in Dec-Jan, hot again.
export function seasonOf(cal) {
  if (cal.term === 1) return cal.cycleInTerm <= 2 ? 'hot' : 'cool';
  return cal.cycleInTerm <= 4 ? 'cold' : 'hot';
}
