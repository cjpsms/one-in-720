// Seeded random numbers: the same seed always gives the same school.
// Works in the browser and in node (no imports).
export class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0;
  }

  // 0 <= x < 1 (mulberry32)
  float() {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // whole number a..b, both included
  int(a, b) {
    return a + Math.floor(this.float() * (b - a + 1));
  }

  chance(p) {
    return this.float() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.float() * arr.length)];
  }

  // normal distribution, mean 0, spread 1
  gauss() {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.float();
    while (v === 0) v = this.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
