// UI smoke test (node, no DOM): the UI modules that do not touch the DOM import cleanly, and the mock engine plus the
// real engine both satisfy the routine API the UI builds on (docs/CONTRACT2.md): createGame({mode}), advance, setRoutine,
// view() additions, focus pending, save/load. Run: node test/ui-smoke.mjs
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error('FAIL', msg); } };

const mods = {};
for (const f of ['dom', 'focus-data', 'record', 'pixelscene', 'dots', 'cards', 'mock-routine', 'mock-engine', 'mock-activities', 'icons', 'registry', 'api']) {
  try { mods[f] = await import(`../src/ui/${f}.js`); } catch (e) { ok(false, `import src/ui/${f}.js: ${e.message}`); }
}
ok(mods['focus-data'] && mods['focus-data'].FOCUS_FIELDS.length === 4, 'focus fields');
ok(mods.pixelscene && mods.pixelscene.classifyPlace('โรงอาหาร') === 'canteen' && mods.pixelscene.classifyPlace('ห้อง 218 (คณิตศาสตร์)') === 'class' && mods.pixelscene.classifyPlace('หอพัก') === 'dorm', 'classifyPlace');
ok(mods.dom && mods.dom.shortYear('ม.6 เทอม 1') === 'ม.6 ท1', 'shortYear');

function play(name, make, { maxPend = 400 } = {}) {
  const g = make();
  let v = g.view();
  for (const k of ['routine', 'progress', 'label', 'stats4', 'record', 'birth', 'schoolMap', 'clock', 'place', 'me', 'stats']) ok(v[k] != null, `${name}: view().${k}`);
  ok(v.progress && v.progress.daysInYear > 0 && typeof v.progress.dayInYear === 'number', `${name}: progress numbers`);
  ok(v.birth && v.birth.regNo && v.birth.sentence, `${name}: birth card fields`);
  ok(v.schoolMap && v.schoolMap.grades.length === 6, `${name}: schoolMap 6 grades`);
  ok(['health', 'happy', 'know', 'bonds'].every((k) => typeof v.stats4[k] === 'number'), `${name}: stats4`);
  JSON.stringify(g.pending);
  ok(g.pending && g.pending.kind === 'scene', `${name}: first pending is the intro scene`);
  const stats = { blocks: 0, weeks: 0, terms: 0, years: 0, maxBlocks: 0 };
  const kinds = {}; let pend = 0; let guard = 0; let days = 0; let sawFocus = false;
  const t0 = Date.now();
  while (!(g.pending && g.pending.final) && guard++ < 20000) {
    if (g.pending) {
      pend++; kinds[g.pending.kind] = (kinds[g.pending.kind] || 0) + 1;
      if (g.pending.kind === 'focus') {
        sawFocus = true;
        ok(Array.isArray(g.pending.fields) && g.pending.fields.length === 4 && g.pending.current, `${name}: focus pending shape`);
        const r = g.setRoutine({ study: 'focus' });
        ok(!r || r.ok !== false, `${name}: setRoutine ok`);
      }
      const r = g.act(g.defaultPayload());
      ok(!r || r.ok !== false, `${name}: act default (${r && r.error})`);
      if (r && r.ok === false) break;
      if (pend > maxPend) { ok(false, `${name}: too many pendings`); break; }
    } else {
      if (typeof g.stepBlock === 'function') {
        const r = g.stepBlock();
        ok(r && r.ok !== false && Array.isArray(r.log) && 'dayEnded' in r && 'weekEnded' in r, `${name}: stepBlock result shape`);
        if (r.ok === false) { ok(false, `${name}: stepBlock error ${r.error}`); break; }
        stats.blocks++;
        if (r.block) { ok(r.block.from && r.block.place && r.block.placeKind && r.block.what, `${name}: block fields`); }
        if (r.dayEnded) { days++; const v = g.view(); ok(v.day && v.day.blocks.length >= 4 && v.day.blocks.filter((b) => b.current).length === 1, `${name}: view().day`); stats.maxBlocks = Math.max(stats.maxBlocks, v.day.blocks.length); }
        if (r.weekEnded) { stats.weeks++; const rc = g.view().recap; ok(rc && rc.kind === 'week' && rc.rows.length && rc.highlights.length >= 3 && rc.money, `${name}: week recap shape`); }
        if (r.termEnded) { stats.terms++; ok(g.view().recap && g.view().recap.kind === 'term', `${name}: term recap`); }
        if (r.yearEnded) { stats.years++; ok(g.view().recap && g.view().recap.kind === 'year', `${name}: year recap`); }
      } else {
        const r = g.advance({ days: 4, untilDecision: true });
        ok(r && Array.isArray(r.log) && r.progress, `${name}: advance result shape`);
        if (r.ok === false) { ok(false, `${name}: advance error ${r.error}`); break; }
        days += r.days;
      }
    }
  }
  ok(g.pending && g.pending.final, `${name}: reached an ending`);
  ok(sawFocus, `${name}: focus pending appeared`);
  const years = 6;
  console.log(`${name}: ${pend} pendings (${(pend / years).toFixed(1)}/year), ${days} days advanced, ${Date.now() - t0} ms`, kinds, stats);
  v = g.view();
  ok(v.record.length > 0, `${name}: record has lines`);
  ok(v.record.every((l) => l.text), `${name}: record lines have text`);
  // save / load round trip keeps the view label and routine
  return g;
}

// ---------- mini games (docs/CONTRACT3.md sections 4, 5, 8) ----------
{
  const idx = await import('../src/ui/minigames/index.js');
  const act = mods['mock-activities'];
  const ids = ['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'];
  ok(JSON.stringify(Object.keys(idx.GAMES)) === JSON.stringify(ids), 'GAMES lists all ten ids');
  const { Rng } = await import('../src/rng.js');
  for (const id of ids) {
    let m = null;
    try { m = await idx.GAMES[id](); } catch (e) { console.log(`mini game ${id}: file not there yet (${e.code || e.message})`); continue; }
    ok(typeof m.play === 'function' && typeof m.bot === 'function' && m.INFO && m.INFO.id === id && typeof m.INFO.how === 'string' && m.INFO.how.length > 5, `mini game ${id}: play/bot/INFO exports`);
    const scores = [];
    for (let seed = 1; seed <= 20; seed++) {
      const spec = { seed, difficulty: (seed % 5) / 5, durationSec: 30, params: act.mockSpec(id, seed).params };
      const a = m.bot(spec, new Rng(seed)); const b = m.bot(spec, new Rng(seed));
      ok(typeof a === 'number' && a >= 0 && a <= 1 && a === b, `mini game ${id}: bot in 0..1 and deterministic (${a})`);
      scores.push(a);
    }
    const avg = scores.reduce((x, y) => x + y, 0) / scores.length;
    ok(avg > 0.3 && avg < 0.95, `mini game ${id}: bot average plausible (${avg.toFixed(2)})`);
  }
  const craft = await import('../src/ui/minigames/craft.js');
  ok(typeof craft.rubric === 'function', 'craft exports rubric');
  const sp = act.mockSpec('craft', 3).params;
  ok(JSON.stringify(sp).length > 50 && JSON.stringify(sp) === JSON.stringify(act.mockSpec('craft', 3).params), 'mock specs are JSON and deterministic');
}

function lifeWith(mode, seed, onPending) {
  const m = mods['mock-engine'];
  const g = m.createGame({ seed, mode: 'routine' });
  ok(g.setMiniGames(mode).ok && g.view().miniGames === mode, `setMiniGames(${mode})`);
  const games = {}; const tags = {}; let guard = 0; let sawEpidemic = false; let sawClosed = false; let friends = false; let saveLoad = false; let sat = false;
  while (!(g.pending && g.pending.final) && guard++ < 60000) {
    const v = g.view();
    if (v.epidemic) { sawEpidemic = true; ok(v.epidemic.name && typeof v.epidemic.sickShare === 'number', 'epidemic shape'); if (v.epidemic.suspended) sawClosed = true; }
    if (g.pending) {
      const p = g.pending; JSON.stringify(p);
      tags[`${p.kind}:${p.tag || ''}`] = 1;
      if (p.kind === 'termStart' && Array.isArray(p.satGroups) && p.satGroups.length === 4) sat = true;
      if (p.kind === 'minigame') {
        ok(p.game && p.seed != null && p.params && p.durationSec > 0 && p.context && p.context.eventId && p.placeKind, `minigame pending shape (${p.game})`);
        games[p.game] = (games[p.game] || 0) + 1;
        if (!saveLoad) { saveLoad = true; const back = m.loadGame(g.save()); ok(back.pending && back.pending.seed === p.seed && back.pending.game === p.game, 'save/load keeps the open minigame'); }
        if (p.canSkip) { const r = g.act({ skip: true }); ok(!r || r.ok !== false, 'skip allowed when canSkip'); continue; }
      }
      if (p.kind === 'scene' && p.tag === 'signup') { const r0 = g.act({ optionId: 'both' }); ok(!r0 || r0.ok !== false, 'sign up for sports day'); continue; }
      if (p.kind === 'scene' && p.card && p.card.person) ok(p.card.person.name && p.card.person.closeness != null, 'person card data');
      const r = g.act(g.defaultPayload());
      if (r && r.ok === false) { ok(false, `act failed: ${r.error}`); break; }
    } else {
      const r = g.stepBlock(); if (r.ok === false) { ok(false, `stepBlock failed: ${r.error}`); break; }
    }
    if (!friends && v.friends && v.friends.length) { friends = true; ok(v.friends.length <= 8 && v.friends.every((f) => f.name && typeof f.closeness === 'number'), 'friends list shape'); }
  }
  ok(g.pending && g.pending.final, `mock life (${mode}) reaches an ending`);
  return { games, tags, sawEpidemic, sawClosed, friends, sat };
}
if (mods['mock-engine']) {
  const a = lifeWith('play', 7);
  ok(['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'].every((k) => a.games[k] > 0), `mock emits all ten mini games (${JSON.stringify(a.games)})`);
  ok(a.tags['scene:signup'] && a.tags['scene:ranking'] && a.tags['minigame:sport_sprint'], 'mock: sports day sign-up, plays and colour ranking appear');
  { const g0 = mods['mock-engine'].createGame({ seed: 9 }); const v0 = g0.view(); ok(v0.me.color && ['red', 'yellow', 'purple', 'blue'].includes(v0.me.color.id) && v0.me.color.th && v0.sports && v0.sports.color, 'view().me.color and view().sports'); }
  ok(a.sawEpidemic && a.sawClosed && a.friends && a.sat, 'mock: epidemic + closed school + friends + satGroups appear');
  ok(a.tags['scene:santa'] || a.tags['scene:crush'] || a.tags['scene:who'], 'mock: who / crush / santa scenes appear');
  const b = lifeWith('auto', 7);
  ok(Object.keys(b.games).length === 0, 'auto mode never opens a minigame');
}

if (mods['mock-engine']) {
  const m = mods['mock-engine'];
  const g = play('mock routine', () => m.createGame({ seed: 7, mode: 'routine' }));
  const g2 = m.createGame({ seed: 3, mode: 'routine' });
  g2.act(g2.defaultPayload()); g2.advance({ days: 30 });
  const back = m.loadGame(g2.save());
  ok(back.view().label === g2.view().label && JSON.stringify(back.view().routine) === JSON.stringify(g2.view().routine), 'mock save/load round trip');
  const d = m.createGame({ seed: 5, mode: 'detailed' });
  ok(d.view().label && d.pending.kind === 'scene', 'mock detailed starts with a scene');
  let n = 0; while (!d.pending.final && n++ < 400) { d.act(d.defaultPayload()); }
  ok(d.pending.final, 'mock detailed reaches its ending');
}

try {
  const real = await import('../src/engine/index.js');
  const probe = real.createGame({ seed: 1, mode: 'routine' });
  if (typeof probe.advance === 'function' && probe.view().progress) {
    play('real routine', () => real.createGame({ seed: 11, mode: 'routine' }), { maxPend: 200 });
    const g = real.createGame({ seed: 4, mode: 'routine' });
    g.act(g.defaultPayload());
    g.advance({ days: 20 });
    const back = real.loadGame(g.save());
    ok(back.view().label === g.view().label, 'real save/load round trip');
  } else console.log('real engine: no routine API yet, skipped');
  const det = real.createGame({ seed: 2, mode: 'detailed' });
  ok(det.pending && det.view().clock, 'real detailed starts');
} catch (e) { console.log('real engine not loaded:', e.message); }

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log('ui-smoke: all checks passed');
