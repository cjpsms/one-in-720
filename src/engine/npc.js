// The other 719 students: simple rule-based days. Diligence decides handing in work and class stance, money decides
// meals, stress and health drift, some order from the LINE shop. Everything is flat numbers on the student objects.
import { clamp, calendar } from './util.js';
import { E } from './config.js';
import { monthlyAllowance, autoTransfer } from '../money.js';
import { clubsFor, electivesFor, shops } from './adapters.js';
import { cellAt } from './world.js';

const gauss = (G) => G.rng.gauss();

// a school day, run in the morning for every NPC; also fills S.rdef (how defiant each room is today, 0..1)
export function npcSchoolDay(G, cal) {
  const S = G.S;
  const rng = G.rng;
  const rdef = {};
  const sums = {};
  const month = Math.floor((S.day - 1) / E.ALLOWANCE_EVERY);
  const payday = month > S.lastAllow;
  for (const s of S.school.students) {
    if (s.status !== 'active') continue;
    const key = s.grade * 10 + s.room;
    if (s.isPlayer) continue;
    if (payday) s.money += monthlyAllowance(30);
    const cost = rng.int(E.NPC_FOOD[0], E.NPC_FOOD[1]);
    if (s.money >= cost) s.money -= cost;
    else {
      s.money = 0;
      s.hp = Math.max(0, s.hp - 1.2);
    }
    if (s.tier === 'rich') autoTransfer(s, rng);
    if (s.sick > 0) {
      s.sick--;
      s.abs = 1;
    } else {
      s.abs = 0;
      if (rng.float() < E.SICK_BASE + Math.max(0, 50 - s.hp) * 0.002) {
        s.sick = rng.int(1, 3);
        s.abs = 1;
        S.stat.sick++;
      }
    }
    s.st = clamp(s.st + 0.6 + 0.3 * gauss(G) - 0.04 * (s.st - 30) + (rng.float() < E.NPC_SHOCK ? 35 : 0), 0, 100);
    if (s.st > E.NPC_SNAP) {
      s.st = 55;
      s.hp = Math.max(0, s.hp - 2);
      s.snaps++;
      S.stat.npcMeltdowns++;
    }
    s.hp = clamp(s.hp + 0.4 - (s.st > 70 ? 0.7 : 0), 0, 100);
    const dil = clamp(s.diligence, -2.5, 2.5);
    const e = s.abs ? -0.8 : dil + 0.5 * gauss(G) - (s.st > 80 ? 0.4 : 0);
    s.acc += e;
    s.nd += 1;
    s.hand = rng.chance(clamp(0.5 + 0.2 * dil, 0.05, 0.97)) ? 1 : 0;
    if (!s.abs) {
      const d = 0.2 * dil + (s.hand ? 0.15 : -0.2);
      const list = G.dayTk[s.grade][s.room][cal.dow];
      for (let i = 0; i < list.length; i++) s.close[list[i]] = clamp(s.close[list[i]] + d, 0, 100);
    }
    const a = sums[key] || (sums[key] = [0, 0]);
    a[0] += clamp(0.5 - 0.3 * dil + 0.004 * (s.st - 50), 0, 1);
    a[1] += 1;
  }
  for (const [key, a] of Object.entries(sums)) {
    const g = Math.floor(key / 10);
    (rdef[g] ||= {})[key % 10] = a[1] ? a[0] / a[1] : 0.4;
  }
  S.rdef = rdef;
  if (payday) S.lastAllow = month;
}

// a weekend day in the dorm
export function npcWeekend(G) {
  const S = G.S;
  const sat = calendar(S.day, E.TERM_CYCLES).dayInCycle === 6;
  const month = Math.floor((S.day - 1) / E.ALLOWANCE_EVERY);
  const payday = month > S.lastAllow;
  for (const s of S.school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    if (payday) s.money += monthlyAllowance(30);
    s.money = Math.max(0, s.money - Math.round(E.NPC_FOOD[0] * 0.7));
    if (s.tier === 'rich') autoTransfer(s, G.rng);
    s.abs = 0;
    if (s.sick > 0) s.sick--;
    s.st = Math.max(8, s.st - 2);
    s.hp = Math.min(100, s.hp + 0.6);
    // Saturday lessons: a study group adds effort, the chill club a little rest (CONTRACT3 section 3)
    if (sat && s.sat) {
      if (s.sat === 'club') s.st = Math.max(5, s.st - 1.5);
      else s.acc += E.ACT.SAT_NPC_ACC[0] + E.ACT.SAT_NPC_ACC[1] * clamp(s.diligence, -1, 1);
    }
  }
  if (payday) S.lastAllow = month;
}

// two nights at home: everyone rests
export function npcHome(G) {
  for (const s of G.S.school.students) {
    if (s.status !== 'active' || s.isPlayer) continue;
    s.st = Math.max(8, s.st - 12);
    s.hp = Math.min(100, s.hp + 3);
    s.sick = 0;
    s.abs = 0;
  }
}

const eligibleLoc = (loc) => {
  const m = String(loc || '').match(/\d{3}/);
  return !!m && (m[0] === '221' || m[0] === '223');
};

function nextSchoolDay(G, from) {
  for (let d = from + 1; d < from + 15; d++) if (calendar(d, E.TERM_CYCLES).schoolDay) return d;
  return from + 1;
}

// LINE shop: a few NPC students order for the next school day (some cancel, which makes the spare stock), and the
// orders for today are eaten in class; a catch makes that period's teacher snap at once.
export function npcLineDay(G, cal) {
  const S = G.S;
  const rng = G.rng;
  if (!G.lineIds) G.lineIds = shops.lineMenu(S.shop, { day: S.day, studentId: 0 }).map((i) => i.id);
  // eat today's orders
  const keep = [];
  for (const o of S.npcOrders) {
    if (o.day > S.day) { keep.push(o); continue; }
    if (o.day < S.day) continue;
    const s = G.byId.get(o.sid);
    if (!s || s.status !== 'active' || s.abs || !cal.schoolDay) continue;
    for (let p = 1; p <= 8; p++) {
      const c = cellAt(G, s.grade, s.room, cal.dow, p);
      if (!c || !c.code || !eligibleLoc(c.loc)) continue;
      const kind = G.subjKind ? G.subjKind(c.code) : '';
      const res = shops.lineConsume(S.shop, s, { itemId: o.item, orderId: o.oid }, { day: S.day, period: p, loc: c.loc, teacherKey: c.tk, afternoonScience: p >= 5 && kind.includes('science') }, rng);
      if (res && res.ok) {
        s.money -= res.price;
        if (res.caught) {
          S.forced[`${s.grade}:${s.room}:${p}`] = 1;
          S.stat.caught++;
        }
      }
      break;
    }
  }
  S.npcOrders = keep;
  // place new ones
  const forDay = nextSchoolDay(G, S.day);
  for (const s of S.school.students) {
    if (s.status !== 'active' || s.isPlayer || !rng.chance(E.LINE_NPC_RATE)) continue;
    const item = G.lineIds[rng.int(0, G.lineIds.length - 1)];
    const o = shops.placeOrder(S.shop, s, item, forDay);
    if (!o || !o.ok) continue;
    if (rng.chance(E.LINE_NPC_CANCEL)) shops.cancelOrder(S.shop, o.id);
    else S.npcOrders.push({ sid: s.id, oid: o.id, item, day: forDay });
  }
}

// clubs and electives: the NPCs choose first and fill part of the seats, then the player picks
export function npcTermStart(G) {
  const S = G.S;
  const rng = G.rng;
  S.clubTaken = {};
  const byGrade = {};
  const order = S.school.students.filter((s) => s.status === 'active' && !s.isPlayer);
  rng.shuffle(order);
  for (const s of order) {
    const clubs = byGrade[s.grade] || (byGrade[s.grade] = clubsFor(s.grade));
    s.club = null;
    if (rng.chance(0.92) && clubs.length) {
      const start = rng.int(0, clubs.length - 1);
      for (let i = 0; i < clubs.length; i++) {
        const c = clubs[(start + i) % clubs.length];
        if ((S.clubTaken[c.id] || 0) < Math.floor(c.seats * E.CLUB_FILL)) {
          s.club = c.id;
          S.clubTaken[c.id] = (S.clubTaken[c.id] || 0) + 1;
          break;
        }
      }
    }
    s.sat = rng.chance(0.55 + 0.1 * clamp(s.diligence, -1.5, 1.5)) ? 'ABCD'[rng.int(0, 3)] : 'club';
    const els = electivesFor(s.grade);
    s.elec = els.length ? els[rng.int(0, els.length - 1)].id : null;
  }
}
