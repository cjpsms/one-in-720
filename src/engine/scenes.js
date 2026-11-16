// Choice scenes (content/scenes.js): a story beat with 2-5 options. Every option shows its cost and, when it is a gamble,
// the chance it works (a percentage built from the real state, see odds.js). The roll uses the game's Rng; the result
// can calm a teacher, change closeness, leave a memory that changes later odds, or put a mark on the conduct record.
import { clamp } from './util.js';
import { E } from './config.js';
import { say, applyFx, spend, calOf } from './player.js';
import { scene, opt } from './pending.js';
import { moodOf, threshold } from './teachers.js';
import { friendOf, bumpFriend } from './friends.js';
import { calcOdds, reasonText, rollOdds } from './odds.js';
import { offend } from './conduct.js';
import { SCENES, SCENE_BY_ID } from '../content/scenes.js';

const B = E.BEAT;
const sexWord = (x) => (x === 'M' ? 'ชาย' : x === 'F' ? 'หญิง' : '');

// ctx for a scene: plain data rebuilt from the saved `vars` { tk, friend, other, cause } so a loaded game gives the same scene
export function sceneCtx(G, place, vars = {}) {
  const S = G.S;
  const me = G.me;
  const c = { G, place, vars, grade: me.grade, term: Math.ceil(((S.day / 28) % (E.TERM_CYCLES * 2)) / E.TERM_CYCLES) || 1, cause: vars.cause | 0, other: vars.other || 1 };
  const tk = vars.tk && S.ts[vars.tk] ? vars.tk : null;
  c.tk = tk;
  c.teacher = tk && S.teachers[tk] ? S.teachers[tk].name : 'ครู';
  c.ratio = tk ? S.ts[tk].p / threshold(G, tk) : 0;
  c.mood = tk ? moodOf(G, tk) : 'calm';
  const f = vars.friend !== undefined ? G.byId.get(vars.friend) : null;
  if (f) {
    const fo = friendOf(S.pl, f.id);
    c.friend = { id: f.id, name: f.name, sex: f.sex, sexTh: sexWord(f.sex), tag: `${f.name} (${sexWord(f.sex)})`, closeness: fo ? fo.closeness : 15 };
  }
  const cal = calOf(G);
  c.phase = cal.cycleInTerm === E.MIDTERM_CYCLE ? 'midterm' : cal.lastCycleOfTerm ? 'final' : cal.cycleInTerm === 1 && cal.dayInCycle <= 5 ? 'results' : '';
  c.stats = { stress: S.pl.stress, energy: S.pl.energy, peer: S.pl.peer, money: me.money };
  c.mem = S.pl.mem || {};
  c.cond = S.pl.conduct || { pts: 0, probation: false };
  return c;
}

function rollVars(G) {
  const S = G.S;
  const me = G.me;
  const tks = G.roomTk[me.grade][me.room] || [];
  let tk = null;
  let best = -1;
  for (const k of tks) { const r = S.ts[k] ? S.ts[k].p / threshold(G, k) : 0; if (r > best) { best = r; tk = k; } }
  if (tks.length && G.rng.chance(0.25)) tk = tks[G.rng.int(0, tks.length - 1)];
  const fr = S.pl.friends.slice().sort((a, b) => b.closeness - a.closeness).slice(0, 6);
  const friend = fr.length ? fr[G.rng.int(0, fr.length - 1)].id : undefined;
  const rooms = Object.keys(G.rooms[me.grade] || {}).map(Number).filter((r) => r !== me.room);
  return { tk, friend, other: rooms.length ? rooms[G.rng.int(0, rooms.length - 1)] : 1, cause: G.rng.int(0, 11) };
}

// choose a scene for this place and day (null when nothing fits)
export function pickScene(G, place) {
  const pl = G.S.pl;
  const vars = rollVars(G);
  const c = sceneCtx(G, place, vars);
  const recent = pl.recentScenes || (pl.recentScenes = []);
  const list = [];
  let total = 0;
  for (const d of SCENES) {
    if (d.w === 0 || c.grade < d.grades[0] || c.grade > d.grades[1] || !d.places.includes(place)) continue;
    if (d.when && !d.when(c)) continue;
    let w = typeof d.w === 'function' ? d.w(c) : d.w;
    if (!(w > 0)) continue;
    if (recent.includes(d.id)) w *= B.RECENT_PENALTY;
    list.push([d, w]);
    total += w;
  }
  if (!list.length) return null;
  let r = G.rng.float() * total;
  for (const [d, w] of list) { r -= w; if (r <= 0) return { def: d, vars }; }
  return { def: list[list.length - 1][0], vars };
}

const costText = (o) => (o.cost && o.cost.money ? `${o.cost.money} บาท` : '');

// build the pending for a scene definition + vars
export function sceneP(G, def, vars, place) {
  const c = sceneCtx(G, place, vars);
  const p = {};
  const options = def.options.filter((o) => !o.when || o.when(c)).map((o) => {
    let sub = o.sub || '';
    let tone = o.tone || null;
    if (o.odds) {
      const r = calcOdds(G, c, o.odds);
      p[o.id] = r.p;
      const why = reasonText(r.parts);
      sub = [costText(o), `${o.ok || 'สำเร็จ'} ~${r.p}%${why ? ' (' + why + ')' : ''}`, sub].filter(Boolean).join(' · ');
    } else sub = [costText(o), sub].filter(Boolean).join(' · ');
    const x = opt(o.id, typeof o.label === 'function' ? o.label(c) : o.label, sub, tone);
    if (o.cost && o.cost.money && G.me.money < o.cost.money) { x.disabled = true; x.reason = 'เงินไม่พอ'; }
    return x;
  });
  // the default answer (a skipped or auto-answered scene) is the quiet one: it must not be a free study boost or a gamble
  const gain = (o) => { const r = o.yes || {}; return ((r.fx && r.fx.knowledge) || 0) + 2 * (r.diligence || 0) + (o.odds ? 0.5 : 0) + (o.cost ? 5 : 0); };
  const quiet = def.options.filter((o) => options.some((x) => x.id === o.id && !x.disabled)).sort((a, b) => gain(a) - gain(b))[0];
  const first = quiet ? { id: quiet.id } : options.find((x) => !x.disabled);
  return scene(G, {
    tag: 'cscene', title: typeof def.title === 'function' ? def.title(c) : def.title, text: def.text(c), options,
    data: { id: def.id, vars, place, p, defaultId: def.dflt && options.some((x) => x.id === def.dflt && !x.disabled) ? def.dflt : first ? first.id : null },
  });
}

// queue a beat for today (used by day.js maybeEvent); returns true when a scene was queued
export function queueBeat(G, place, after) {
  const S = G.S;
  const pk = pickScene(G, place);
  if (!pk) return false;
  const pl = S.pl;
  pl.lastBeat = S.day;
  (pl.recentScenes || (pl.recentScenes = [])).push(pk.def.id);
  if (pl.recentScenes.length > 24) pl.recentScenes.shift();
  pl.cnt.events += 1;
  const p = sceneP(G, pk.def, pk.vars, place);
  S.queue.push(p);
  if (after) p.after = { id: after.id, what: after.what, place: after.place, from: after.from, to: after.to };
  return true;
}

// scenes that are built on purpose (a teacher snap, a hearing) rather than drawn: SCENE_BY_ID[id]
export function directScene(G, id, vars, place = 'class') {
  const def = SCENE_BY_ID[id];
  return def ? sceneP(G, def, vars, place) : null;
}

const val = (x, c) => (typeof x === 'function' ? x(c) : x);

export function answerCScene(G, payload, pd) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const def = SCENE_BY_ID[pd.data.id];
  const o = def && def.options.find((x) => x.id === payload.optionId);
  if (!o) return;
  const c = sceneCtx(G, pd.data.place, pd.data.vars);
  if (o.cost && o.cost.money) { me.money = Math.max(0, me.money - o.cost.money); spend(G, o.cost.money); }
  let hit = true;
  let p = null;
  if (o.odds) { p = pd.data.p[o.id] !== undefined ? pd.data.p[o.id] : calcOdds(G, c, o.odds).p; hit = rollOdds(G, p); }
  const res = hit ? o.yes : o.no || o.yes;
  if (!res) return;
  applyFx(G, res.fx || {});
  const idx = c.tk && G.tkIdx[me.grade][c.tk] !== undefined ? G.tkIdx[me.grade][c.tk] : -1;
  if (res.calm && c.tk && S.ts[c.tk]) S.ts[c.tk].p *= clamp(1 - res.calm, 0, 1);
  if (res.heat && c.tk && S.ts[c.tk]) S.ts[c.tk].p += res.heat;
  if (res.trust && idx >= 0) me.close[idx] = clamp(me.close[idx] + res.trust, 0, 100);
  if (res.trustAll) for (const k of G.roomTk[me.grade][me.room]) { const i = G.tkIdx[me.grade][k]; me.close[i] = clamp(me.close[i] + res.trustAll, 0, 100); }
  if (res.friend && c.friend) bumpFriend(G, c.friend.id, res.friend);
  if (res.mem) { const m = pl.mem || (pl.mem = {}); m[res.mem] = (m[res.mem] || 0) + 1; }
  if (res.diligence) pl.diligence = clamp(pl.diligence + res.diligence, 0, 100);
  const log = val(res.log, c) || '';
  const odds = p !== null ? ` (โอกาส ${p}% ${hit ? 'ออกมาดี' : 'พลาด'})` : '';
  const bad = !hit || (res.fx && ((res.fx.stress || 0) > 3 || (res.fx.health || 0) < 0));
  say(G, `${log}${odds}`, bad ? 'bad' : 'good');
  if (res.offend) offend(G, res.offend);
}
