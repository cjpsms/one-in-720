// Mini game loader (docs/CONTRACT3.md section 5 and 8). Every game file exports play(container, spec, done), bot(spec, rng)
// and INFO = { id, title, how }. Files are loaded lazily; a game whose file is missing or broken loads as null and the
// minigame screen falls back to "ให้ระบบเล่นให้".
export const GAMES = {
  watch: () => import('./watch.js'),
  serve: () => import('./serve.js'),
  craft: () => import('./craft.js'),
  pattern: () => import('./pattern.js'),
  dash: () => import('./dash.js'),
  timing: () => import('./timing.js'),
  rhythm: () => import('./rhythm.js'),
  track: () => import('./track.js'),
  sequence: () => import('./sequence.js'),
  steps: () => import('./steps.js'),
};
export const GAME_IDS = Object.keys(GAMES);

const cache = new Map();
export async function loadGame(id) {
  const loader = GAMES[id];
  if (!loader) return null;
  if (cache.has(id)) return cache.get(id);
  let mod = null;
  try {
    const m = await loader();
    if (m && typeof m.play === 'function') mod = m;
    else console.warn(`[one-in-720] mini game ${id} has no play()`);
  } catch (e) { console.warn(`[one-in-720] mini game ${id} not available:`, e && e.message ? e.message : e); }
  if (mod) cache.set(id, mod);
  return mod;
}
