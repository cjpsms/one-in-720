// Odds for choice scenes: a base chance plus named modifiers read from the real state, shown to the player as a
// percentage with the reasons, then rolled with the game's Rng (never 0 or 100%).
import { clamp } from './util.js';
import { viewStats, trustAvg } from './player.js';

// each factor reads one number off the state (usually centred on 0); a modifier is [factor, weight, Thai reason, arg?]
export const FACTORS = {
  trust: (G) => trustAvg(G) - 50, // closeness to the teachers of the player's room
  tclose: (G, c) => (c && c.tk && G.tkIdx[G.me.grade][c.tk] !== undefined ? G.me.close[G.tkIdx[G.me.grade][c.tk]] - 50 : 0), // closeness to this scene's teacher
  mood: (G, c) => (c && c.ratio ? clamp(c.ratio, 0, 1.3) * 100 : 0), // how close this scene's teacher is to snapping, 0-130
  peer: (G) => G.S.pl.peer - 50,
  stress: (G) => G.S.pl.stress - 50,
  energy: (G) => G.S.pl.energy - 50,
  know: (G) => viewStats(G).knowledge - 50,
  dil: (G) => G.S.pl.diligence - 50,
  conduct: (G) => (G.S.pl.conduct ? G.S.pl.conduct.pts : 0),
  probation: (G) => (G.S.pl.conduct && G.S.pl.conduct.probation ? 1 : 0),
  fclose: (G, c) => (c && c.friend ? c.friend.closeness - 50 : 0), // closeness to the friend in this scene
  rich: (G) => clamp(G.me.money / 300, 0, 1) * 100,
  mem: (G, c, key) => (G.S.pl.mem && G.S.pl.mem[key]) || 0, // how many times the player did this before
  one: () => 1, // a constant bonus or penalty
  sameSex: (G, c) => (c && c.friend && c.friend.sex === G.me.sex ? 1 : 0),
};

// spec: [base, ...modifiers] -> { p (5..95), parts: [{ th, v }] }
export function calcOdds(G, c, spec) {
  const parts = [];
  let p = spec[0];
  for (let i = 1; i < spec.length; i++) {
    const [f, w, th, arg] = spec[i];
    const fn = FACTORS[f];
    if (!fn) continue;
    const v = fn(G, c, arg) * w;
    p += v;
    if (Math.abs(v) >= 2) parts.push({ th, v: Math.round(v) });
  }
  return { p: Math.round(clamp(p, 5, 95)), parts };
}

// short reason text: the two biggest modifiers, "+สนิทกับครู -ครูตึงมาก"
export function reasonText(parts) {
  return parts
    .slice()
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 2)
    .map((x) => `${x.v > 0 ? '+' : '-'}${x.th}`)
    .join(' ');
}

export const rollOdds = (G, p) => G.rng.chance(p / 100);
