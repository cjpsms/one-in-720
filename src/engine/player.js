// The player: stats, applying effects, the end-of-day bookkeeping and the numbers for view().
import { clamp, r1, hhmm, DOW_TH, calendar } from './util.js';
import { E } from './config.js';
import { autoTransfer } from '../money.js';
import { shops } from './adapters.js';
import { addWork, playerTasks } from './tasks.js';
import { decayTeachers } from './teachers.js';
import { rcAdd } from './recap.js';
import { nightlyFriends } from './friends.js';

export const calOf = (G) => calendar(G.S.day, E.TERM_CYCLES);
export const clockLabel = (G) => `วัน${DOW_TH[calOf(G).dow]} ${hhmm(G.S.minute)}`;

// study units are scaled by diligence (a little) and dragged down by a partner (CONTRACT3 section 10) unless the routine is 'focus'
export const dilFactor = (G) => 1 + (E.ACT.DIL_SCALE * (G.S.pl.diligence - 50)) / 50;
export const partnerFactor = (G) => { const p = G.S.pl.partner; return !p ? 1 : G.S.routine.study === 'focus' || (p.focusUntil || 0) >= G.S.day ? E.PARTNER_STUDY_DRAG_FOCUS : E.PARTNER_STUDY_DRAG; };
export const studyFactor = (G) => dilFactor(G) * partnerFactor(G);

export const yearLabel = (G) => `ม.${G.me ? G.me.grade : 1} เทอม ${calOf(G).term}`;

// log line: kept in the buffer returned by act()/advance() and in the saved record (last 200 lines)
export function say(G, text, tone = 'neutral', minor = false) {
  const S = G.S;
  const e = { t: clockLabel(G), text, tone, day: S.day, yearLabel: yearLabel(G) };
  if (S.blkNotes) { S.blkNotes.push(e); if (S.blkNotes.length > 40) S.blkNotes.shift(); } // the notes of the block being played (stepBlock)
  if (minor && S.mode === 'routine') return; // routine mode: everyday things are not worth a record line
  S.logBuf.push(e);
  if (!S.record) S.record = [];
  S.record.push(e);
  if (S.record.length > 200) S.record.splice(0, S.record.length - 200);
}

// money spent by the player (the block's `spend` and the recaps)
export function spend(G, amount) {
  G.S.bspend = (G.S.bspend || 0) + amount;
  rcAdd(G, 'spent', amount);
}

export function addTrust(G, v) {
  const me = G.me;
  for (const tk of G.roomTk[me.grade][me.room]) {
    const i = G.tkIdx[me.grade][tk];
    me.close[i] = clamp(me.close[i] + v * 0.6, 0, 100);
  }
}

export function trustAvg(G) {
  const me = G.me;
  const list = G.roomTk[me.grade][me.room];
  if (!list.length) return 50;
  let sum = 0;
  for (const tk of list) sum += me.close[G.tkIdx[me.grade][tk]];
  return sum / list.length;
}

// fx: { health, energy, stress, fullness, peer, knowledge, work, teacherTrust, money, speaking }
// slot = true: small numbers from evening.js / free-time actions (scaled up, knowledge is study time, work is homework)
export function applyFx(G, fx, slot = false) {
  const pl = G.S.pl;
  const sc = slot ? E.FX_SCALE : 1;
  for (const [k, v] of Object.entries(fx || {})) {
    if (!v) continue;
    switch (k) {
      case 'health': case 'energy': case 'stress': case 'fullness': case 'peer':
        pl[k] = clamp(pl[k] + v * (slot ? (k === 'health' ? E.HEALTH_SLOT_SCALE : k === 'stress' ? E.STRESS_SLOT_SCALE : sc) : 1), 0, 100);
        break;
      case 'knowledge':
        if (slot) pl.d.study += v > 0 ? v * studyFactor(G) : v;
        else pl.bonusZ += v / E.KNOWLEDGE_SCALE;
        break;
      case 'work':
        pl.d.work += v;
        addWork(G, v);
        break;
      case 'teacherTrust': addTrust(G, v * sc); break;
      case 'money': G.me.money = Math.max(0, G.me.money + v); break;
      case 'speaking': pl.speaking += v; break;
      default: break;
    }
  }
}

export function knowledgeStat(G) {
  const pl = G.S.pl;
  const zs = studyZ(pl);
  let num = 0;
  let den = 0;
  for (const [code, sj] of Object.entries(pl.subj)) {
    const cl = pl.cls[code];
    const avg = cl && cl[1] ? cl[0] / cl[1] : E.CLASS_BASE;
    num += sj.credits * (E.CLASS_Z * (avg - E.CLASS_BASE) + (pl.talent[code] || 0) * 0.5 + (pl.satZ[code] || 0));
    den += sj.credits;
  }
  const z = (den ? num / den : 0) + zs + pl.bonusZ + E.KNOWLEDGE_OFFSET;
  return clamp(50 + E.KNOWLEDGE_SCALE * z, 0, 100);
}

export const studyZ = (pl) => (pl.eN ? pl.studyZ / pl.eN : 0);

export function gpax(pl) {
  let n = 0;
  let d = 0;
  for (const t of pl.terms) { n += t.gpa * t.credits; d += t.credits; }
  return d ? n / d : null;
}

export function viewStats(G) {
  const pl = G.S.pl;
  const me = G.me;
  const gx = gpax(pl);
  return {
    gpa: pl.lastGpa !== null ? pl.lastGpa : me.gpa, gpax: gx !== null ? Math.round(gx * 100) / 100 : me.gpa,
    health: Math.round(pl.health), energy: Math.round(pl.energy), stress: Math.round(pl.stress),
    fullness: Math.round(pl.fullness), knowledge: Math.round(knowledgeStat(G)), peer: Math.round(pl.peer),
    teacherTrust: Math.round(trustAvg(G)), money: Math.round(me.money), diligence: Math.round(pl.diligence),
  };
}

// morning: energy comes from last night's sleep
export function wakeUp(G) {
  const pl = G.S.pl;
  const w = E.WAKE_ENERGY;
  pl.energy = clamp(w.base + pl.sleepHours * w.perSleepHour - pl.stress * w.perStress - (pl.sick > 0 ? 30 : 0), 15, 100);
  pl.fullness = E.FULLNESS_START_OF_DAY;
}

// end of a day (the player's evening or, on the trip day, after the last class)
export function finishDay(G, cal, home = false) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const d = pl.d;
  const study = clamp(d.study, -1, E.STUDY_DAY_CAP);
  if (cal.schoolDay) {
    pl.studyZ += E.STUDY_Z * (study / 10 - E.STUDY_BASE);
    pl.eN += 1;
  } else if (!home) {
    pl.studyZ += Math.max(0, E.STUDY_Z * (study / 10 - 0.15)) * E.WEEKEND_STUDY_Z;
  }
  const fullAvg = d.fullN ? d.fullSum / d.fullN : 50;
  pl.health = clamp(pl.health + E.HEALTH_NIGHT_BASE + E.HEALTH_PULL * (E.HEALTH_SET - pl.health) - (fullAvg < 30 && !home ? E.HEALTH_HUNGER : 0) - E.HEALTH_STRESS * Math.max(0, pl.stress - 50), 0, 100);
  const load = playerTasks(G).filter((t) => t.due - S.day <= 3 && (pl.prog[t.id] || 0) < t.effort).length;
  const sn = E.STRESS_NIGHT;
  const relief = E.PEER_RELIEF * clamp((pl.peer - 25) / 50, -1, 1); // good friendships calm the night a little
  pl.stress = clamp(pl.stress + sn.base + sn.perTask * load - (pl.stress < sn.around ? sn.recoverLow : sn.recover) * (pl.stress - sn.around) - (cal.schoolDay ? 0 : 2) - relief, 0, 100);
  if (home) pl.sleepHours = 8.5;
  if (cal.schoolDay) {
    const target = clamp((pl.dilBase + E.ACT.DIL_STANCE[S.routine.study]) * partnerFactor(G), 0, 100);
    pl.diligence = clamp(pl.diligence + E.ACT.DIL_DRIFT * (target - pl.diligence), 0, 100);
  }
  nightlyFriends(G, cal);
  pl.peer = clamp(pl.peer - E.PEER_DECAY * pl.peer, 0, 100);
  pl.healthSum += pl.health;
  pl.sleepSum += pl.sleepHours;
  pl.stressSum += pl.stress;
  pl.nDays += 1;
  if (pl.sick > 0) pl.sick -= 1;
  else if (pl.health < E.SICK_BELOW && G.rng.chance(0.3)) {
    pl.sick = G.rng.int(1, 2);
    say(G, 'ไม่สบาย ตัวร้อนตั้งแต่ตอนกลางคืน', 'bad');
  }
  // a belonging goes missing
  const ids = Object.keys(pl.inv).filter((k) => pl.inv[k] > 0);
  if (ids.length && G.rng.chance(E.ITEM_LOSS_CHANCE)) {
    const k = ids[G.rng.int(0, ids.length - 1)];
    pl.inv[k] = Math.max(0, pl.inv[k] - (k === 'a4_sheet' ? 20 : 1));
    say(G, 'ของหายไปชิ้นหนึ่งในกระเป๋า (' + k + ')', 'bad');
  }
  // rich parents transfer by themselves under 5,000 (cj)
  const got = autoTransfer(me, G.rng);
  if (got > 0) say(G, `พ่อแม่โอนเงินให้เองอีก ${got} บาท`, 'good');
  // the world goes on: teachers cool off, shops reset
  decayTeachers(G, E.NIGHT_DECAY);
  const evs = shops.nightly(S.shop, S.day, G.rng) || [];
  for (const ev of evs) {
    if (ev.type === 'crepeRich') {
      me.money += ev.refund || 0;
      applyFx(G, ev.fx || {});
      say(G, ev.text, 'good');
    } else if (ev.type === 'crepeFailed') say(G, ev.text, 'bad');
  }
  pl.d = { cu: [0, 0], study: 0, work: 0, skips: 0, failed: false, fullSum: 0, fullN: 0, borrowTried: [] };
  pl.askedToday = 0;
}

export function stat1(x) { return r1(x); }
