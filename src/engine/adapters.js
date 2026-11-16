// One place that imports the data/content/shop modules written by the other agents, plus the timetable loader
// (JSON files read with fs in node, fetch in the browser; top-level await, so import this file as a module).
export { subjectOf, creditsFor, ACTIVITY_NAMES } from '../data/subjects.js';
export { clubsFor, clubById } from '../data/clubs.js';
export { electivesFor, electiveById, hasElective } from '../data/electives.js';
export { makeTeachers } from '../data/teachers.js';
export { makeTask, requiredItemName } from '../content/tasks.js';
export { pickEvent, restoreEvent } from '../content/events.js';
import * as shops from '../economy/shops.js';
// namespace import on purpose: every name is read at call time as ACT.<name>
import * as ACT from '../content/activities.js';
export { ACT };
export { shops };

// The tasks module and the shops module name some items differently (agreed map, see docs/REQUESTS.md).
// inv = id in the player's inventory, qty = how many must be in the bag, use = how many are used up when handed in.
export const TASK_ITEMS = {
  a4_paper_100: { inv: 'a4_sheet', qty: 5, use: 5 },
  a3_pound_paper: { inv: 'a3_paper', qty: 1, use: 1 },
  colored_paper: { inv: 'colour_paper', qty: 1, use: 1 },
  glue_gun: { inv: 'glue_gun', qty: 1, use: 0 },
  pen: { inv: 'pen', qty: 1, use: 0 },
  scout_gear: { inv: 'scout_gear', qty: 1, use: 0 },
  redcross_gear: { inv: 'redcross_gear', qty: 1, use: 0 },
  printed_photos: { inv: 'print_page', qty: 2, use: 2 },
};

async function loadJson(rel) {
  const url = new URL(rel, import.meta.url);
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const fs = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    return JSON.parse(await fs.readFile(fileURLToPath(url), 'utf8'));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cannot load ${rel}`);
  return res.json();
}

// { 1: {grade, hoursPerWeek, rooms, teachers}, ... 6 }
export const TIMETABLES = {};
for (let g = 1; g <= 6; g++) TIMETABLES[g] = await loadJson(`../data/timetable/m${g}.json`);
