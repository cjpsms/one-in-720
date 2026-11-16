// Who sleeps where. Boys by grade pairs 1+2, 4+5, 3+6; girls 1+4, 2+5, 3+6 and they move every year (cj).
import { DORMS } from './config.js';

export function dormKeyOf(s) {
  for (const [key, d] of Object.entries(DORMS)) {
    if (d.sex === s.sex && d.grades.includes(s.grade)) return key;
  }
  throw new Error(`no dorm for sex ${s.sex} grade ${s.grade}`);
}

// New dorm and new roommates for everyone, called when the year changes.
export function assignDorms(school) {
  const groups = {};
  for (const s of school.students) {
    if (s.status !== 'active') continue;
    (groups[dormKeyOf(s)] ||= []).push(s);
  }
  const summary = {};
  for (const [key, list] of Object.entries(groups)) {
    school.rng.shuffle(list);
    const cap = DORMS[key].cap;
    list.forEach((s, i) => {
      s.dorm = key;
      s.dormRoom = Math.floor(i / cap) + 1;
    });
    summary[key] = { students: list.length, rooms: Math.ceil(list.length / cap), cap };
  }
  return summary;
}

export function roommatesOf(school, s) {
  return school.students.filter(
    (o) => o !== s && o.status === 'active' && o.dorm === s.dorm && o.dormRoom === s.dormRoom,
  );
}
