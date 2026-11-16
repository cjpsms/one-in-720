// Monte Carlo balance check of routine mode (docs/CONTRACT2.md section 2). Plays whole lives with a fixed routine,
// answering every pending with its default. 200 lives per routine preset, deterministic seeds (the same seeds for every
// preset, so the presets are compared on the same students), run in worker threads.
//   node test/balance.test.js            (about a minute and a half on 16 cores)
//   BALANCE_N=60 node test/balance.test.js   (quicker, wider error bars: the target checks are skipped below 150)
//   mini games are played in 'auto' mode; BALANCE_CRUSH=accept forces every confession to be accepted (CONTRACT3 section 10)
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { createGame } from '../src/engine/index.js';

// ---------------------------------------------------------------- one life
function playLife(seed, routine) {
  const g = createGame({ seed, mode: 'routine', miniGames: 'auto', crush: process.env.BALANCE_CRUSH === 'accept' ? 'accept' : 'normal' });
  const set = g.setRoutine(routine);
  if (!set.ok) throw new Error('setRoutine: ' + set.error);
  const samp = { health: 0, happy: 0, know: 0, bonds: 0, n: 0 };
  let k = 0;
  let steps = 0;
  while (!(g.pending && g.pending.final)) {
    if (++steps > 20000) throw new Error('life did not end, seed ' + seed);
    if (g.pending) {
      const r = g.act(g.defaultPayload());
      if (!r.ok) throw new Error(`seed ${seed}: ${r.error} ${g.lastError && g.lastError.stack}`);
    } else {
      const a = g.advance({ days: 7 });
      if (!a.ok) throw new Error(`seed ${seed}: ${a.error} ${g.lastError && g.lastError.stack}`);
      if (++k % 3 === 0) {
        const s = g.view().stats4;
        samp.health += s.health; samp.happy += s.happy; samp.know += s.know; samp.bonds += s.bonds; samp.n++;
      }
    }
  }
  const d = g.debug().me;
  const years = Math.max(0.5, d.years);
  return {
    gate: d.gatePassed, graduated: g.pending.title === 'จบแล้วพอเลย', ending: g.pending.title, gpax: d.gpax,
    snapsYr: d.cnt.snapsMe / years, eventsYr: d.cnt.events / years, pendings: d.cnt.pendings + 1,
    caught: d.cnt.caught, lineUses: d.lineUses, emerg: d.cnt.emergencies, money: d.money,
    health: samp.n ? samp.health / samp.n : 0, happy: samp.n ? samp.happy / samp.n : 0, know: samp.n ? samp.know / samp.n : 0, bonds: samp.n ? samp.bonds / samp.n : 0,
    years: d.years,
  };
}

if (!isMainThread) {
  const out = workerData.jobs.map((j) => ({ label: j.label, seed: j.seed, ...playLife(j.seed, j.routine) }));
  parentPort.postMessage(out);
} else {
  await main();
}

// ---------------------------------------------------------------- main
async function main() {
  const N = Number(process.env.BALANCE_N || 200);
  const NX = Number(process.env.BALANCE_EXTRA_N || 40);
  const base = { food: 'normal', evening: 'balanced', snack: 'sometimes' };
  const presets = [
    ['study focus', { ...base, study: 'focus' }, N],
    ['study normal', { ...base, study: 'normal' }, N],
    ['study relax', { ...base, study: 'relax' }, N],
  ];
  // the other fields: smaller samples, same seeds, everything else at the normal preset
  const mid = { ...base, study: 'normal' };
  const extras = process.env.BALANCE_ONLY ? [] : [
    ['evening study', { ...mid, evening: 'study' }, NX],
    ['evening social', { ...mid, evening: 'social' }, NX],
    ['evening rest', { ...mid, evening: 'rest' }, NX],
    ['food cheap', { ...mid, food: 'cheap' }, NX],
    ['food treat', { ...mid, food: 'treat' }, NX],
    ['snack none', { ...mid, snack: 'none' }, NX],
    ['snack often', { ...mid, snack: 'often' }, NX],
    ['treat + often', { ...mid, food: 'treat', snack: 'often' }, NX],
  ];
  const all = [...presets, ...extras];
  const jobs = [];
  for (const [label, routine, n] of all) for (let i = 0; i < n; i++) jobs.push({ label, routine, seed: 5000 + i });
  const W = Math.max(1, Math.min(Number(process.env.BALANCE_WORKERS || os.availableParallelism()), 16));
  const parts = Array.from({ length: W }, () => []);
  jobs.forEach((j, i) => parts[i % W].push(j));
  const t0 = Date.now();
  const results = (await Promise.all(parts.map((jobs) => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { jobs } });
    w.on('message', resolve);
    w.on('error', reject);
    w.on('exit', (c) => { if (c !== 0) reject(new Error('worker exit ' + c)); });
  })))).flat();
  console.log(`${jobs.length} lives in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${W} workers\n`);

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pct = (a) => (100 * a.filter(Boolean).length) / Math.max(1, a.length);
  const q95 = (a) => a.slice().sort((x, y) => x - y)[Math.floor(0.95 * (a.length - 1))];
  const stat = {};
  for (const [label] of all) {
    const r = results.filter((x) => x.label === label);
    const reached = r.filter((x) => x.gate !== null);
    const ends = {};
    for (const x of r) ends[x.ending] = (ends[x.ending] || 0) + 1;
    stat[label] = {
      n: r.length, gate: pct(reached.map((x) => x.gate)), grad: pct(r.map((x) => x.graduated)), gpax: mean(r.map((x) => x.gpax || 0)),
      snaps: mean(r.map((x) => x.snapsYr)), events: mean(r.map((x) => x.eventsYr)), pend: mean(r.map((x) => x.pendings)), pend95: q95(r.map((x) => x.pendings)), pendMax: Math.max(...r.map((x) => x.pendings)),
      caught: mean(r.map((x) => x.caught)), lines: mean(r.map((x) => x.lineUses)), emerg: mean(r.map((x) => x.emerg)), money: mean(r.map((x) => x.money)),
      health: mean(r.map((x) => x.health)), happy: mean(r.map((x) => x.happy)), know: mean(r.map((x) => x.know)), bonds: mean(r.map((x) => x.bonds)), ends,
    };
  }
  const f = (x, d = 0) => x.toFixed(d);
  const head = ['routine', 'n', 'gate%', 'grad%', 'GPAX', 'snap/y', 'evt/y', 'pend', 'p95', 'caught', 'emerg', 'money', 'health', 'happy', 'know', 'bonds'];
  const rows = Object.entries(stat).map(([l, s]) => [l, s.n, f(s.gate), f(s.grad), f(s.gpax, 2), f(s.snaps, 1), f(s.events, 1), f(s.pend), f(s.pend95), f(s.caught, 1), f(s.emerg, 2), f(s.money), f(s.health), f(s.happy), f(s.know), f(s.bonds)]);
  const wid = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => (i === 0 ? String(c).padEnd(wid[i]) : String(c).padStart(wid[i]))).join('  ');
  console.log(line(head));
  for (const r of rows) console.log(line(r));
  console.log('\nendings:');
  for (const [l, s] of Object.entries(stat)) console.log(`  ${l.padEnd(14)} ${Object.entries(s.ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log('');

  // ------------------------------------------------------------ checks
  let failed = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '   ' + detail : ''}`);
    if (!ok) failed++;
  };
  const near = (x, want, tol) => Math.abs(x - want) <= tol;
  const F = stat['study focus'];
  const M = stat['study normal'];
  const X = stat['study relax'];
  const big = N >= 150;
  check('ordering: gate pass focus > normal > relax', F.gate > M.gate && M.gate > X.gate, `${f(F.gate)} > ${f(M.gate)} > ${f(X.gate)}`);
  check('ordering: graduated focus > normal > relax', F.grad > M.grad && M.grad > X.grad, `${f(F.grad)} > ${f(M.grad)} > ${f(X.grad)}`);
  check('ordering: GPAX focus > normal > relax with a clear gap (0.08 or more each)', F.gpax - M.gpax >= 0.08 && M.gpax - X.gpax >= 0.08, `${f(F.gpax, 2)} / ${f(M.gpax, 2)} / ${f(X.gpax, 2)}`);
  if (big) {
    check('target: focus passes the ม.4 gate about 95% (88-100)', near(F.gate, 95, 7), f(F.gate));
    check('target: normal passes about 80% (71-89)', near(M.gate, 80, 9), f(M.gate));
    check('target: relax passes about 45% (33-57)', near(X.gate, 45, 12), f(X.gate));
    check('target: graduated about 90 / 75 / 40 (within 10 / 10 / 12)', near(F.grad, 90, 10) && near(M.grad, 75, 10) && near(X.grad, 40, 12), `${f(F.grad)} / ${f(M.grad)} / ${f(X.grad)}`);
    check('graduating needs the gate: graduated is never above gate pass', F.grad <= F.gate + 0.01 && M.grad <= M.gate + 0.01 && X.grad <= X.gate + 0.01);
  }
  for (const [name, s] of [['focus', F], ['normal', M], ['relax', X]]) {
    check(`${name}: teacher snaps in the player's classes about 3-8 a year (2.5-10 allowed for one preset)`, s.snaps >= 2.5 && s.snaps <= 10, f(s.snaps, 1));
    check(`${name}: random events 1.5-5 a year (round 22: fewer, better stops)`, s.events >= 1.5 && s.events <= 5, f(s.events, 1));
    check(`${name}: about 6-11 stops per school year (all kinds, default answers)`, s.pend / 6 >= 5.5 && s.pend / 6 <= 11.5, `${f(s.pend / 6, 1)} a year`);
    check(`${name}: a whole life uses at most about 120 pendings (95th percentile)`, s.pend95 <= 120, `mean ${f(s.pend)}, p95 ${f(s.pend95)}, max ${s.pendMax}`);
    check(`${name}: money does not run out (emergencies under 0.5 a life)`, s.emerg < 0.5, f(s.emerg, 2));
  }
  const snapsMean = (F.snaps + M.snaps + X.snaps) / 3;
  check('teacher snaps involving the player average 3-8 a year over the presets', snapsMean >= 3 && snapsMean <= 8, f(snapsMean, 1));
  const allLines = results.reduce((a, x) => a + x.lineUses, 0);
  const allCaught = results.reduce((a, x) => a + x.caught, 0);
  check('LINE-shop catches follow the 10% rule', allLines > 200 && near(allCaught / allLines, 0.1, 0.03), `${allCaught} caught in ${allLines} uses`);
  if (!process.env.BALANCE_ONLY) {
    const E1 = stat['evening study'];
    const E2 = stat['evening rest'];
    const E3 = stat['evening social'];
    check('evening rest: better health than evening study', E2.health > E1.health + 3, `${f(E2.health)} vs ${f(E1.health)}`);
    check('evening study: more knowledge than evening rest and social', E1.know > E2.know + 2 && E1.know > E3.know + 2, `${f(E1.know)} vs ${f(E2.know)} / ${f(E3.know)}`);
    check('evening study: less happy than rest and social', E1.happy < E2.happy - 3 && E1.happy < E3.happy - 1, `${f(E1.happy)} vs ${f(E2.happy)} / ${f(E3.happy)}`);
    check('evening study: more GPAX than evening rest', E1.gpax > E2.gpax, `${f(E1.gpax, 2)} vs ${f(E2.gpax, 2)}`);
    const Fc = stat['food cheap'];
    const Ft = stat['food treat'];
    check('food: treat costs money (less left at the end than cheap by 5,000+)', Fc.money - Ft.money > 5000, `${f(Fc.money)} vs ${f(Ft.money)}`);
    check('food: treat is happier than cheap', Ft.happy > Fc.happy + 1, `${f(Ft.happy)} vs ${f(Fc.happy)}`);
    check('food: cheap does not wreck health (within 15 of normal)', Fc.health > M.health - 15, `${f(Fc.health)} vs ${f(M.health)}`);
    const S0 = stat['snack none'];
    const S1 = stat['snack often'];
    check('snack: none = no catches, sometimes in between, often = most', S0.caught === 0 && S1.caught > M.caught && M.caught > 0, `${f(S0.caught, 1)} / ${f(M.caught, 1)} / ${f(S1.caught, 1)} caught per life`);
    check('snack: often is a real risk (GPAX not above none by more than 0.05, 0.12 with small samples)', S1.gpax <= S0.gpax + (NX >= 40 ? 0.05 : 0.12), `${f(S1.gpax, 2)} vs ${f(S0.gpax, 2)}`);
    const T = stat['treat + often'];
    check('money only breaks with food treat + snack often', T.emerg > M.emerg + 0.3 && T.emerg > Ft.emerg && T.emerg > S1.emerg, `treat+often ${f(T.emerg, 2)}, treat ${f(Ft.emerg, 2)}, often ${f(S1.emerg, 2)}, normal ${f(M.emerg, 2)}`);
  }
  console.log(failed === 0 ? '\nall balance checks passed' : `\n${failed} balance check(s) failed`);
  process.exit(failed === 0 ? 0 : 1);
}
