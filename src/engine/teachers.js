// Teacher pressure and snapping (สลิ้งแตก). Pressure belongs to the teacher, not the class: it is added in every class
// period, decays a bit from period to period and a lot overnight, so one bad class makes the next one pay (cj).
import { clamp } from './util.js';
import { E } from './config.js';

export const patience01 = (G, tk) => {
  const t = G.S.teachers[tk];
  return clamp((t ? t.personality.patience : 50) / 100, 0.05, 1);
};
export const threshold = (G, tk) => E.PRESSURE_BASE + E.PRESSURE_SPAN * patience01(G, tk);

export function moodOf(G, tk) {
  const T = G.S.ts[tk];
  if (!T) return 'calm';
  const r = T.p / threshold(G, tk);
  return r < 0.5 ? 'calm' : r < 0.85 ? 'tense' : 'snapping';
}

export function decayTeachers(G, f) {
  for (const T of Object.values(G.S.ts)) T.p *= f;
}

// opts: { defyAdj, extraPressure, playerTarget, force, isMine, code }
// returns null (no teacher) or { tk, snapped, kind, target: 'player'|id|null, ratio }
export function classPeriod(G, g, room, p, cell, opts = {}) {
  const S = G.S;
  const tk = cell.tk;
  const T = S.ts[tk];
  if (!T) return null;
  const idx = G.tkIdx[g][tk];
  const mem = G.rooms[g][room];
  let n = 0;
  let nClose = 0;
  for (const s of mem) {
    if (s.abs) continue;
    n++;
    if (s.close[idx] >= E.CLOSE) nClose++;
  }
  const defy = clamp((S.rdef[g] ? S.rdef[g][room] : 0.4) + (opts.defyAdj || 0), 0, 1);
  const shareNot = n ? 1 - nClose / n : 0;
  let add = E.DEFY_K * defy * shareNot * (0.7 + 0.6 * G.rng.float());
  const miss = T.miss[room] | 0;
  if (miss) {
    add += E.MISS_K * miss;
    delete T.miss[room];
  }
  if (opts.extraPressure) add += opts.extraPressure;
  T.p += add;
  const key = `${g}:${room}:${p}`;
  const forced = !!S.forced[key];
  if (forced) delete S.forced[key];
  const thr = threshold(G, tk);
  if (!forced && !opts.force && T.p < thr) return { tk, snapped: false, ratio: T.p / thr };
  return snap(G, g, room, tk, T, mem, idx, opts, miss, cell);
}

function snap(G, g, room, tk, T, mem, idx, opts, miss, cell) {
  const S = G.S;
  const rng = G.rng;
  T.p = threshold(G, tk) * E.SNAP_RESET;
  T.snaps += 1;
  S.stat.snaps += 1;
  const strict = (S.teachers[tk] ? S.teachers[tk].personality.strictness : 50) / 100;
  let kind;
  let target = null;
  if (opts.playerTarget) {
    kind = 'target';
    target = 'player';
  } else {
    const w = { scold: 4, extra: 2 + 2 * strict, quiz: 1.5, walkout: 1, target: miss > 0 ? 8 : 0.5 };
    let r = rng.float() * (w.scold + w.extra + w.quiz + w.walkout + w.target);
    kind = 'scold';
    for (const k of ['scold', 'extra', 'quiz', 'walkout', 'target']) {
      r -= w[k];
      if (r < 0) { kind = k; break; }
    }
    if (kind === 'target') {
      const cand = mem.filter((s) => !s.abs);
      const t = cand.length ? cand[rng.int(0, cand.length - 1)] : null;
      if (t && t.isPlayer) target = 'player';
      else if (t) {
        target = t.id;
        t.st = Math.min(100, t.st + E.SNAP_STRESS_TARGET);
        t.close[idx] = Math.max(0, t.close[idx] - 6);
      }
    } else if (opts.singleOut && rng.chance(opts.singleOut)) {
      kind = 'target'; // the teacher picks on the player
      target = 'player';
    }
  }
  for (const s of mem) {
    if (s.abs || s.isPlayer) continue;
    s.st = Math.min(100, s.st + E.SNAP_STRESS);
    if (s.close[idx] < E.CLOSE) s.close[idx] = Math.max(0, s.close[idx] - 1);
  }
  if (kind === 'extra' && cell && cell.code) {
    // extra homework for this room
    S.tasks.push({ id: `x${++S.taskSeq}`, tk, grade: g, room, name: 'งานเพิ่มที่ครูสั่งตอนสลิ้งแตก', kind: 'extra', effort: 1, due: S.day + 2, req: [], code: cell.code, npcDone: false, day: S.day });
  }
  return { tk, snapped: true, kind, target, ratio: 1 };
}
