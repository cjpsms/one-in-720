// The `minigame` pending kind (CONTRACT3 section 4): building the pending, difficulty, the bot score used in 'auto'
// mode and by defaultPayload(), applying the effects of a play (fx of C2's resolve()).
import { clamp, nf } from './util.js';
import { E } from './config.js';
import { ACT } from './adapters.js';
import { mk } from './pending.js';
import { viewStats, say, addTrust, spend } from './player.js';
import { rcAdd } from './recap.js';

export const GAME_IDS = ['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'];
const DURATION = { watch: 30, serve: 40, craft: 35, pattern: 25, dash: 20, timing: 15, rhythm: 30, track: 25, sequence: 30, steps: 35 };
const PLACE_OK = ['hall', 'fair', 'stage', 'lab', 'activity', 'classroom'];

// the stats C2's expectedScore / difficultyFor read (0-100)
export function mgStats(G, extra) {
  const st = viewStats(G);
  return { health: st.health, energy: st.energy, stress: st.stress, knowledge: st.knowledge, peer: st.peer, teacherTrust: st.teacherTrust, diligence: Math.round(G.S.pl.diligence), ...(extra || {}) };
}

export function mgDifficulty(G, game, bias = 0, xs) {
  const st = mgStats(G, xs);
  const d = typeof ACT.difficultyFor === 'function' ? ACT.difficultyFor(game, st, bias) : 0.5 + bias;
  return Math.round(clamp(d, 0.05, 0.95) * 100) / 100;
}

export function expectedFor(G, game, difficulty, xs) {
  const st = mgStats(G, xs);
  const v = typeof ACT.expectedScore === 'function' ? ACT.expectedScore(game, st, difficulty) : 0.6;
  return clamp(Number.isFinite(v) ? v : 0.6, 0, 1);
}

// 'auto' mode and plays beyond the one-a-day rule: expected score plus noise (uses the game's Rng)
export function autoScore(G, game, difficulty, xs) {
  return clamp(expectedFor(G, game, difficulty, xs) + 0.08 * G.rng.gauss(), 0.02, 0.99);
}

// o: { tag, game, title, text, params, canSkip, skipLabel, context, placeKind, difficulty, xs (extra stats), data }
export function mgPending(G, o) {
  const S = G.S;
  const pk = PLACE_OK.includes(o.placeKind) ? o.placeKind : 'classroom';
  const p = mk(G, 'minigame', {
    tag: o.tag,
    game: o.game,
    title: o.title,
    text: o.text || '',
    seed: G.rng.int(1, 0x7ffffffe),
    difficulty: o.difficulty,
    durationSec: (o.params && o.params.durationSec) || DURATION[o.game] || 25,
    params: o.params || {},
    canSkip: !!o.canSkip,
    context: { eventId: o.context.eventId, stage: o.context.stage || '', ...(o.context.who ? { who: o.context.who } : {}) },
    placeKind: pk,
    data: { xs: o.xs || null, ...(o.data || {}) },
  });
  if (o.canSkip && o.skipLabel) p.skipLabel = o.skipLabel;
  void S;
  return p;
}

// JSON-safe copy of what the UI reported
export function cleanStats(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(x)) {
    if (n >= 12) break;
    if (typeof v === 'number' && Number.isFinite(v)) out[String(k).slice(0, 24)] = v;
    else if (typeof v === 'string') out[String(k).slice(0, 24)] = v.slice(0, 60);
    else continue;
    n++;
  }
  return out;
}

// resolve() with a safety net: C2's function is the single entry point, the fallback only fires if it is missing or throws
export function resolveMg(G, eventId, game, score, ctx) {
  const c = { money: Math.round(G.me.money), grade: G.me.grade, ...ctx };
  let r = null;
  if (typeof ACT.resolve === 'function') {
    try { r = ACT.resolve(eventId, game, score, c, G.rng); } catch (e) { r = null; }
  }
  if (!r || typeof r !== 'object') {
    const s = clamp(score, 0, 1);
    r = { fx: { peer: 1 + 2 * s, stress: -1 - 2 * s, energy: -2 }, log: `${eventId}: ${Math.round(s * 100)}%`, tier: ACT.scoreTier ? ACT.scoreTier(s) : { id: 'ok', th: '' } };
  }
  return { fx: r.fx || {}, log: r.log || '', tier: r.tier || null };
}

// apply an fx object of a play to the player. Returns a short summary of the money moved.
export function applyMgFx(G, fx) {
  const pl = G.S.pl;
  const me = G.me;
  let money = 0;
  for (const [k, v] of Object.entries(fx || {})) {
    if (!Number.isFinite(v) || !v) continue;
    switch (k) {
      case 'health': case 'energy': case 'stress': case 'peer':
        pl[k] = clamp(pl[k] + v, 0, 100);
        break;
      case 'knowledge': pl.bonusZ += (v / E.KNOWLEDGE_SCALE) * E.ACT.MG_KNOW_SCALE; break;
      case 'teacherTrust': addTrust(G, v); break;
      case 'diligence': pl.diligence = clamp(pl.diligence + v, 0, 100); break;
      case 'money': {
        const m = v < 0 ? -Math.min(me.money, -v) : v;
        me.money += m;
        if (m < 0) spend(G, -m);
        money += m;
        break;
      }
      default: break;
    }
  }
  return money;
}

export function playLine(res, money) {
  const bits = [];
  if (res.log) bits.push(res.log);
  else if (res.tier && res.tier.th) bits.push(res.tier.th);
  if (money && !(res.log && /บาท/.test(res.log))) bits.push(`${money > 0 ? 'ได้' : 'เสีย'}เงิน ${nf(Math.abs(money))} บาท`);
  return bits.join(' ');
}

export function countPlay(G) {
  const pl = G.S.pl;
  const year = Math.ceil((G.S.day / (E.TERM_CYCLES * 28)));
  if (!pl.plays || pl.plays.year !== year) pl.plays = { year, n: 0, byYear: pl.plays ? pl.plays.byYear : {} };
  pl.plays.n += 1;
  pl.plays.byYear[year] = pl.plays.n;
  rcAdd(G, 'acts');
}

export { say };
