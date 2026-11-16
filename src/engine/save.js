// Saving and loading: the whole state is plain JSON (the Rng state is one number, students are plain objects).
import { Rng } from '../rng.js';
import { SAVE_VERSION, makeG } from './world.js';
import { R } from './config.js';
import { initRc } from './recap.js';
import { advance } from './day.js';
import { setupFriends } from './friends.js';

export function serialize(G) {
  G.S.rngS = G.rng.s;
  return JSON.stringify(G.S);
}

export function restore(json) {
  let S;
  try {
    S = JSON.parse(json);
  } catch (e) {
    throw new Error('save file is not valid JSON');
  }
  if (!S || S.v !== SAVE_VERSION || !S.school || !S.pl || !S.tt) throw new Error('save file is not from this version of the game');
  const rng = new Rng(0);
  rng.s = S.rngS | 0;
  const G = makeG(S, rng);
  // saves from before routine mode: detailed play, no record
  if (!S.mode) S.mode = 'detailed';
  if (!S.routine) S.routine = { ...R.DEFAULT };
  if (!S.record) S.record = [];
  for (const [k, v] of Object.entries({ dayB: null, bspend: 0, blkNotes: [], evPlan: null, stopDay: -1, bp: null, home: null, recap: null, flags: { term: false, year: false, weekSkip: false } })) if (S[k] === undefined) S[k] = v;
  if (S.pl.prev === undefined) S.pl.prev = null;
  // saves from before CONTRACT3 (activities, friends, crush)
  for (const [k, v] of Object.entries({ miniGames: 'play', crushMode: 'normal', act: null, companion: null, crush: { done: {}, askAt: 0, who: null, exes: 0 }, fair: null, satTeachers: null, playDay: -1 })) if (S[k] === undefined) S[k] = v;
  for (const [k, v] of Object.entries({ partner: null, heartbreak: 0, diligence: 50, dilBase: 50, satGroup: null, satZ: {}, showRole: null, showPrep: 0, showDirector: null, plays: { year: 0, n: 0, byYear: {} }, recentLabs: [], recentTopics: [] })) if (S.pl[k] === undefined) S.pl[k] = v;
  if (!Array.isArray(S.pl.friends)) { S.pl.friends = []; setupFriends(G, true); }
  if (!S.rc) initRc(G);
  if (!S.pl.cnt) S.pl.cnt = { events: 0, snapsMe: 0, scoldShown: 0, scoldYear: 0, scoldYearNo: 0, caught: 0, emergencies: 0, focus: 0, lastEmergency: -99, midCheck: 0, pendings: 0 };
  if (!S.pending && S.mode === 'detailed') advance(G);
  else if (!S.pending && S.queue.length) S.pending = S.queue.shift();
  return G;
}
