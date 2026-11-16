// Choice scenes with a % on every option, conduct and expulsion (cj 2026-11-16). Run: node test/scenes.test.js
import { createGame, loadGame } from '../src/engine/index.js';
import { SCENES, SCENE_BY_ID } from '../src/content/scenes.js';
import { KINDS } from '../src/engine/conduct.js';
import { FACTORS } from '../src/engine/odds.js';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
  if (!ok) failed += 1;
}
const MEM_OK = /^[a-z]+$/;
const FX_KEYS = ['health', 'energy', 'stress', 'fullness', 'peer', 'knowledge', 'work', 'teacherTrust', 'money', 'speaking'];
const PLACES = ['class', 'dorm', 'canteen', 'weekend', 'home'];

// ---------- the content itself ----------
{
  const ids = new Set();
  let bad = '';
  for (const d of SCENES) {
    if (ids.has(d.id)) bad += ` dup:${d.id}`;
    ids.add(d.id);
    if (!d.options || d.options.length < 2) bad += ` fewOptions:${d.id}`;
    if (typeof d.text !== 'function') bad += ` text:${d.id}`;
    for (const pl of d.places) if (!PLACES.includes(pl)) bad += ` place:${d.id}:${pl}`;
    const oids = new Set();
    for (const o of d.options) {
      if (oids.has(o.id)) bad += ` dupOpt:${d.id}.${o.id}`;
      oids.add(o.id);
      if (!o.yes) bad += ` noYes:${d.id}.${o.id}`;
      if (o.odds) {
        if (!(o.odds[0] >= 0 && o.odds[0] <= 100)) bad += ` base:${d.id}.${o.id}`;
        if (!o.no) bad += ` noNo:${d.id}.${o.id}`;
        for (const m of o.odds.slice(1)) if (!FACTORS[m[0]]) bad += ` factor:${d.id}.${o.id}:${m[0]}`;
      }
      for (const r of [o.yes, o.no].filter(Boolean)) {
        for (const k of Object.keys(r.fx || {})) if (!FX_KEYS.includes(k)) bad += ` fx:${d.id}.${o.id}:${k}`;
        if (r.offend && !KINDS[r.offend]) bad += ` offend:${d.id}.${o.id}:${r.offend}`;
        if (r.mem && !MEM_OK.test(r.mem)) bad += ` mem:${d.id}.${o.id}`;
        if (!r.log) bad += ` log:${d.id}.${o.id}`;
      }
    }
  }
  check('every scene is well formed (ids, options, odds factors, fx keys, offence kinds, log lines)', bad === '', bad);
  check('at least 55 scenes, and the direct "scolded" scene exists', SCENES.length >= 55 && !!SCENE_BY_ID.scolded, String(SCENES.length));
}

// ---------- scenes in a running game ----------
function playRoutine(seed, chooser, days = 4000) {
  const g = createGame({ seed });
  const seen = { cscene: 0, conduct: 0 };
  const ids = {};
  let steps = 0;
  while (!(g.pending && g.pending.final) && steps++ < 4000) {
    if (g.pending) {
      const p = g.pending;
      if (p.tag === 'cscene') { seen.cscene++; ids[p.title] = (ids[p.title] || 0) + 1; }
      if (p.tag === 'conduct') seen.conduct++;
      const pay = chooser ? chooser(p) : null;
      const r = g.act(pay || g.defaultPayload());
      if (!r.ok) throw new Error(`seed ${seed}: ${r.error}`);
    } else {
      const a = g.advance({ days: 7 });
      if (!a.ok) throw new Error(`seed ${seed}: ${a.error}`);
    }
  }
  void days;
  return { g, seen, ids, title: g.pending.title };
}

{
  const r = playRoutine(11);
  const g = r.g;
  check('a routine life plays scenes with no engine error', g.pending.final && r.seen.cscene > 100, JSON.stringify(r.seen));
  check('many different scenes are met in one life', Object.keys(r.ids).length >= 40, String(Object.keys(r.ids).length));
}

{
  // every option of a scene shows its cost and, for a gamble, a percentage between 5 and 95
  const g = createGame({ seed: 21 });
  let steps = 0;
  let scenes = 0;
  let gambles = 0;
  let badPct = 0;
  let noPct = 0;
  while (!(g.pending && g.pending.final) && steps++ < 800) {
    const p = g.pending;
    if (p) {
      if (p.tag === 'cscene') {
        scenes++;
        const def = SCENE_BY_ID[p.id] || null;
        void def;
        for (const o of p.options) {
          const m = /~(\d+)%/.exec(o.sub || '');
          if (m) { gambles++; if (+m[1] < 5 || +m[1] > 95) badPct++; }
        }
        const gamblesIn = p.options.filter((o) => /~\d+%/.test(o.sub || '')).length;
        if (!gamblesIn && p.options.length > 1 && p.options.every((o) => !o.sub)) noPct++;
      }
      g.act(g.defaultPayload());
    } else g.advance({ days: 7 });
  }
  check('options show a percentage inside 5-95%', scenes > 20 && gambles > 40 && badPct === 0, `${scenes} scenes, ${gambles} gambles, ${badPct} out of range`);
  void noPct;
}

{
  // determinism and save / load through a scene
  const mk = () => createGame({ seed: 31 });
  const a = mk();
  const b = mk();
  const run = (g) => { let n = 0; while (!(g.pending && g.pending.tag === 'cscene') && n++ < 300) { if (g.pending) g.act(g.defaultPayload()); else g.advance({ days: 3 }); } };
  run(a);
  run(b);
  check('the same seed gives the same scene and the same odds', JSON.stringify(a.pending) === JSON.stringify(b.pending) && a.pending.tag === 'cscene');
  const l = loadGame(a.save());
  check('a saved game restores the same scene', JSON.stringify(l.pending) === JSON.stringify(a.pending));
  const o = a.pending.options.find((x) => !x.disabled).id;
  a.act({ optionId: o });
  l.act({ optionId: o });
  check('answering after a load gives the same result', a.save() === l.save());
}

// ---------- discipline ----------
function reckless(p) {
  if (p.tag === 'cscene') {
    // take the option whose result carries an offence, otherwise the boldest one
    const risky = p.options.filter((o) => !o.disabled && (o.tone === 'bad' || /โกง|ลอก|ซ่อน|แอบ|เถียง|แทรก|หนี|กล่าวหา|โยน/.test(o.label)));
    if (risky.length) return { optionId: risky[0].id };
  }
  if (p.tag === 'conduct' && p.options.some((o) => o.id === 'argue')) return { optionId: 'argue' };
  if (p.tag === 'conduct' && p.options.some((o) => o.id === 'accept')) return { optionId: 'accept' };
  return null;
}
{
  const N = 24;
  let expelledDefault = 0;
  let expelledReckless = 0;
  let hearingsReckless = 0;
  let probation = 0;
  for (let seed = 100; seed < 100 + N; seed++) {
    if (playRoutine(seed).title === 'ถูกไล่ออก') expelledDefault++;
    const r = playRoutine(seed, reckless);
    if (r.title === 'ถูกไล่ออก') expelledReckless++;
    const c = JSON.parse(r.g.save()).pl && JSON.parse(r.g.save()).pl.conduct;
    if (c && c.hearings > 0) hearingsReckless++;
    if (c && (c.probation || c.stage >= 3)) probation++;
  }
  check('an ordinary player is almost never expelled (at most 2 in 24)', expelledDefault <= 2, `${expelledDefault} / ${N}`);
  check('a player who breaks rules again and again does get expelled sometimes', expelledReckless >= 3, `${expelledReckless} / ${N}`);
  check('a reckless player is called to hearings and put on probation far more than the ordinary one', hearingsReckless >= 8 && probation >= 4, `hearings ${hearingsReckless}, probation ${probation}`);
  check('even a reckless player is not expelled every time (the hearing is a gamble)', expelledReckless <= N - 3, `${expelledReckless} / ${N}`);
}

{
  // a story beat about once a week: weeks without any stop are rare
  const g = createGame({ seed: 51 });
  const weeks = new Set();
  let steps = 0;
  while (!(g.pending && g.pending.final) && steps++ < 4000) {
    if (g.pending) { weeks.add(Math.floor(g.debug().day / 7)); g.act(g.defaultPayload()); } else g.advance({ days: 1 });
  }
  const last = Math.floor(g.debug().day / 7);
  const share = weeks.size / Math.max(1, last);
  check('at least 7 weeks in 10 have a stop (cj: skipping must not give empty weeks)', share >= 0.7, `${(share * 100).toFixed(0)}% of ${last} weeks`);
}

if (failed) { console.log(`\n${failed} scene check(s) failed`); process.exit(1); }
console.log('\nall scene checks passed');
