#!/usr/bin/env node
// Checks every src/data/timetable/m*.json that exists (see docs/CONTRACT.md 2.1).
// Errors -> exit code 1. Warnings (teacher clash in one slot) do not fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'timetable');
const HOURS = { 1: 37, 2: 37, 3: 33, 4: 37, 5: 37, 6: 25 };
const ROOMS = { 1: 4, 2: 4, 3: 4, 4: 6, 5: 6, 6: 6 };
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const ACTS = new Set(['ลส/ยว', 'ชุมนุม', 'ส.การอ่าน', 'ชน./นศท.', 'บพ./นศท.', 'พก. 2', 'ภาษาที่ 2']);
const wantArg = process.argv.slice(2);

let errors = 0, warns = 0;
const err = (m) => { errors++; console.log('  ERROR ' + m); };
const warn = (m) => { warns++; console.log('  warn  ' + m); };

function checkFile(file) {
  const name = path.basename(file);
  console.log(name);
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(name + ': cannot parse JSON: ' + e.message); return; }
  const g = d.grade;
  if (!(g >= 1 && g <= 6)) { err(name + ': bad grade ' + g); return; }
  if (name !== `m${g}.json`) err(`${name}: file name does not match grade ${g}`);
  if (d.hoursPerWeek !== HOURS[g]) err(`${name}: hoursPerWeek ${d.hoursPerWeek}, expected ${HOURS[g]}`);
  if (!d.teachers || typeof d.teachers !== 'object') { err(name + ': missing teachers'); return; }
  if (!d.rooms || typeof d.rooms !== 'object') { err(name + ': missing rooms'); return; }
  for (const [k, t] of Object.entries(d.teachers)) {
    if (!new RegExp(`^m${g}-[A-Z]+$`).test(k)) err(`${name}: teacher key '${k}' not like m${g}-A`);
    if (!t || !Array.isArray(t.codes) || typeof t.foreign !== 'boolean') err(`${name}: teacher ${k} needs codes[] and foreign:boolean`);
    else if (JSON.stringify(t.codes) !== JSON.stringify([...new Set(t.codes)].sort())) err(`${name}: teacher ${k} codes not sorted/unique`);
  }
  const usedTeachers = new Map(); // key -> Set(codes)
  const slotMap = new Map(); // "day|p|tk" -> [rooms]
  let okRooms = 0;
  for (let r = 1; r <= ROOMS[g]; r++) {
    const R = d.rooms[String(r)];
    const label = `${name} room ${g}/${r}`;
    if (!R) { err(label + ': missing'); continue; }
    const before = errors;
    let nonNull = 0;
    const counts = {};
    for (const day of DAYS) {
      const cells = R[day];
      if (!Array.isArray(cells) || cells.length !== 8) { err(`${label} ${day}: need 8 cells, got ${Array.isArray(cells) ? cells.length : typeof cells}`); continue; }
      cells.forEach((c, i) => {
        const where = `${label} ${day} p${i + 1}`;
        if (c === null) return;
        if (typeof c !== 'object') { err(where + ': cell must be null or object'); return; }
        nonNull++;
        if (c.act !== undefined) {
          if (!ACTS.has(c.act)) err(`${where}: unknown act '${c.act}'`);
          if (c.group !== undefined && !/^G\d+$/.test(c.group) && c.group !== 'all') err(`${where}: bad group '${c.group}'`);
          if (c.code || c.tk || c.loc) err(where + ': act cell must not have code/tk/loc');
          const key = c.group && c.group !== 'all' ? `${c.act}_${c.group}` : c.act;
          counts[key] = (counts[key] || 0) + 1;
        } else {
          if (typeof c.code !== 'string' || !c.code) { err(where + ': subject cell without code'); return; }
          if (typeof c.loc !== 'string' || !c.loc) err(`${where} (${c.code}): missing loc`);
          if (typeof c.tk !== 'string' || !d.teachers[c.tk]) { err(`${where} (${c.code}): tk '${c.tk}' not in teachers`); return; }
          counts[c.code] = (counts[c.code] || 0) + 1;
          if (!usedTeachers.has(c.tk)) usedTeachers.set(c.tk, new Set());
          usedTeachers.get(c.tk).add(c.code);
          const sk = `${day}|${i + 1}|${c.tk}`;
          if (!slotMap.has(sk)) slotMap.set(sk, []);
          slotMap.get(sk).push(`${g}/${r}`);
        }
      });
    }
    if (nonNull !== d.hoursPerWeek) err(`${label}: ${nonNull} non-empty cells, expected ${d.hoursPerWeek}`);
    const pc = R.printedCounts;
    if (!pc || typeof pc !== 'object') err(label + ': missing printedCounts');
    else {
      const sumPrinted = Object.values(pc).reduce((a, b) => a + b, 0);
      if (sumPrinted !== d.hoursPerWeek) err(`${label}: printedCounts sum ${sumPrinted}, expected ${d.hoursPerWeek}`);
      const keys = new Set([...Object.keys(pc), ...Object.keys(counts)]);
      for (const k of keys) {
        let have = counts[k] || 0, want = pc[k];
        // allow printed "พก. 2": n to cover grouped cells พก. 2_G1.. summed
        if (want === undefined && /_G\d+$/.test(k)) continue;
        if (want === undefined) { err(`${label}: '${k}' appears ${have}x in grid but not in printedCounts`); continue; }
        if (!(k in counts) && /^(.+)$/.test(k)) {
          const grouped = Object.keys(counts).filter((x) => x.startsWith(k + '_G')).reduce((a, x) => a + counts[x], 0);
          if (grouped) have = grouped;
        }
        if (have !== want) err(`${label}: '${k}' grid ${have} vs printed ${want}`);
      }
    }
    if (errors === before) okRooms++;
  }
  for (const r of Object.keys(d.rooms)) if (!(Number(r) >= 1 && Number(r) <= ROOMS[g])) err(`${name}: unexpected room '${r}'`);
  // teacher table consistency
  for (const [k, t] of Object.entries(d.teachers)) {
    const used = usedTeachers.get(k);
    if (!used) { err(`${name}: teacher ${k} never used in a cell`); continue; }
    if (t && Array.isArray(t.codes) && JSON.stringify([...used].sort()) !== JSON.stringify(t.codes)) err(`${name}: teacher ${k} codes ${JSON.stringify(t.codes)} differ from cells ${JSON.stringify([...used].sort())}`);
  }
  // clash warning: same teacher in two rooms at the same slot
  for (const [sk, rs] of slotMap) {
    if (rs.length > 1) { const [day, p, tk] = sk.split('|'); warn(`${name}: ${tk} teaches rooms ${rs.join(', ')} at ${day} p${p}`); }
  }
  console.log(`  rooms passing: ${okRooms}/${ROOMS[g]}  teachers: ${Object.keys(d.teachers).length}  foreign: ${Object.entries(d.teachers).filter(([, t]) => t && t.foreign).map(([k]) => k).join(',') || '-'}`);
}

let files = [];
try { files = fs.readdirSync(dir).filter((f) => /^m[1-6]\.json$/.test(f)).sort(); } catch { /* dir missing */ }
if (wantArg.length) files = files.filter((f) => wantArg.some((a) => f === a || f === `m${a}.json`));
if (!files.length) console.log('no timetable files found in ' + dir);
for (const f of files) checkFile(path.join(dir, f));
console.log(`\n${files.length} file(s), ${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
