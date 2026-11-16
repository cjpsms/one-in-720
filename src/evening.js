// The dorm evening, 19:00 to 00:00 (cj: "do anything"). 10 half-hour slots.
// After lights-out (the dorm's bed time) only quiet things are possible; the rest turns into sleep.
// All effect numbers are PLACEHOLDERS to tune.
import { DORM_DAY } from './config.js';

export const SLOT = 30;

export const ACTIONS = {
  study_alone: { th: 'อ่านหนังสือคนเดียว', fx: { knowledge: 1.0, stress: 0.2 } },
  study_group: { th: 'อ่านกับเพื่อน', fx: { knowledge: 0.8, peer: 0.2, stress: 0.1 } },
  homework: { th: 'ทำงานที่ครูสั่ง', fx: { knowledge: 0.4, work: 1, teacherTrust: 0.2, stress: 0.2 } },
  chat: { th: 'คุยกับเพื่อนร่วมห้อง', fx: { peer: 0.5, stress: -0.3 } },
  phone: { th: 'เล่นมือถือ/เกม', fx: { stress: -0.4, knowledge: -0.1 } },
  call_parents: { th: 'โทรหาพ่อแม่', fx: { stress: -0.2 }, parents: true },
  exercise: { th: 'ออกกำลังกาย', fx: { health: 0.3, stress: -0.3 } },
  sleep: { th: 'นอน', fx: {}, lightsOut: true },
  // quiet things that still work after lights-out
  whisper_chat: { th: 'กระซิบคุยกันบนเตียง', fx: { peer: 0.3, stress: -0.2 }, lightsOut: true },
  phone_secret: { th: 'แอบเล่นมือถือ', fx: { stress: -0.3, knowledge: -0.1 }, lightsOut: true },
  study_light: { th: 'แอบอ่านใต้ไฟมือถือ', fx: { knowledge: 0.6, stress: 0.3 }, lightsOut: true },
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// plan = array of action ids, one per slot (missing slots count as sleep).
export function evaluateEvening(dorm, plan) {
  const slots = (DORM_DAY.eveningEnd - DORM_DAY.eveningStart) / SLOT;
  const fx = {};
  const done = [];
  let lastAwakeEnd = DORM_DAY.eveningStart;
  let parentCalls = 0;

  for (let i = 0; i < slots; i++) {
    const start = DORM_DAY.eveningStart + i * SLOT;
    let id = plan[i] || 'sleep';
    let a = ACTIONS[id];
    // lights are off: only quiet actions are possible
    if (!a || (start >= dorm.bed && !a.lightsOut)) {
      id = 'sleep';
      a = ACTIONS.sleep;
    }
    done.push(id);
    if (id !== 'sleep') lastAwakeEnd = start + SLOT;
    if (a.parents) parentCalls += 1;
    for (const [k, v] of Object.entries(a.fx)) fx[k] = (fx[k] || 0) + v;
  }

  const wake = dorm.outBy - DORM_DAY.getReady;
  const sleepHours = clamp((24 * 60 - lastAwakeEnd + wake) / 60, 0, 9.5);
  fx.health = (fx.health || 0) + clamp((sleepHours - 7) * 0.5, -2, 0.5);

  return { plan: done, fx, sleepHours, parentCalls };
}
