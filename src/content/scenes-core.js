// Helpers for the choice scenes (see engine/scenes.js for how a scene runs).
//
// sc(id, { places, w, when(c), grades, dflt, title, text(c), options })
// option: { id, label, sub, cost: { money }, odds: [base, [factor, weight, reason, arg], ...], ok, when(c),
//           yes: result, no: result }       (no odds = always `yes`)
// result: { fx, log, calm, heat, trust, trustAll, friend, mem, diligence, offend }
//   fx: health stress energy peer knowledge teacherTrust money   calm: 0-1 share of the teacher's pressure removed
//   trust: closeness to this scene's teacher   friend: closeness to the friend in the scene   mem: remembered key
// c: { teacher, mood, ratio, friend: { name, tag, sexTh, closeness }, other (another room), cause, phase, grade }
// The first option the player can afford is the default for auto play unless `dflt` names another one.
export const sc = (id, d) => ({ id, grades: [1, 6], places: ['class', 'dorm', 'canteen', 'weekend'], w: 1, ...d });
export const ALL = ['class', 'dorm', 'canteen', 'weekend', 'home'];
export const tense = (c) => c.ratio >= 0.5;
