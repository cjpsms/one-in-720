// Conduct and discipline: offences add points (decaying over time), points climb a ladder
// (name noted -> dorm punishment -> probation -> disciplinary hearing), and a hearing can end in expulsion.
// Every way out is a percentage shown to the player. All numbers are in E.CONDUCT (PLACEHOLDER).
import { clamp } from './util.js';
import { E } from './config.js';
import { calOf, say, addTrust, applyFx, spend } from './player.js';
import { scene, opt } from './pending.js';
import { calcOdds, reasonText, rollOdds } from './odds.js';
import { endGame } from './term.js';

const C = E.CONDUCT;
const r1 = (x) => Math.round(x * 10) / 10;

export const KINDS = {
  late: { th: 'เข้าห้องสาย', pts: 0.5 },
  skip: { th: 'โดดคาบ', pts: 0.7 },
  snack: { th: 'แอบกินในคาบ', pts: 0.35, daily: true },
  phone: { th: 'แอบเล่นมือถือ', pts: 1, daily: true },
  curfew: { th: 'ออกนอกหอเกินเวลา', pts: 2 },
  rude: { th: 'เถียงครู', pts: 1.5 },
  nowork: { th: 'ไม่ส่งงานซ้ำๆ', pts: 1 },
  fight: { th: 'ทะเลาะวิวาท', pts: 3, severe: 0.3 },
  cheat: { th: 'ลอกข้อสอบ', pts: 3, severe: 0.35 },
  contraband: { th: 'มีของต้องห้ามในหอ', pts: 3, severe: 0.4 },
};

export const cond = (G) => G.S.pl.conduct || (G.S.pl.conduct = { pts: 0, stage: 0, probation: false, lastOffence: -99, last: '', hearings: 0, noHome: 0, curfewUntil: -1, hearingPending: false });

const STAGE_TH = ['เรียบร้อยดี', 'ถูกจดชื่อ', 'มีโทษที่หอ', 'ทัณฑ์บน', 'เสี่ยงโดนเรียกประชุมกรรมการ'];

// the survival chance at a hearing for a given way of defending yourself (also used for the risk meter)
const HEAR_BASE = Math.round(100 * (1 - C.HEARING_EXPEL_BASE));
const HEAR_COMMON = [['conduct', -1.8, 'แต้มพฤติกรรมสูง'], ['probation', -10, 'อยู่ทัณฑ์บน'], ['trust', 0.3, 'ครูไว้ใจ']];
const HEAR_OPTS = {
  sorry: { label: 'ขอโทษและสำนึกผิดต่อหน้ากรรมการ', odds: [HEAR_BASE, ...HEAR_COMMON, ['one', 8, 'สำนึกผิด']] },
  parents: { label: 'ให้พ่อแม่มาพบกรรมการ', cost: 300, odds: [HEAR_BASE, ...HEAR_COMMON, ['one', 18, 'พ่อแม่มา']] },
  mates: { label: 'ให้เพื่อนช่วยยืนยันความประพฤติ', odds: [HEAR_BASE, ...HEAR_COMMON, ['peer', 0.4, 'เพื่อนช่วยพูด'], ['one', 4, 'มีพยาน']] },
  argue: { label: 'เถียงว่าตัวเองไม่ได้ทำ', odds: [HEAR_BASE, ...HEAR_COMMON, ['one', -12, 'เถียงกรรมการ']] },
};
const APPEAL = {
  appeal: { label: 'ขอเบาโทษกับครูหอ', odds: [45, ['trust', 0.3, 'ครูไว้ใจ'], ['conduct', -2, 'ประวัติเสีย']] },
  mates: { label: 'ให้เพื่อนร่วมห้องช่วยพูดกับครูหอ', odds: [35, ['peer', 0.35, 'เพื่อนเยอะ'], ['conduct', -1.5, 'ประวัติเสีย']] },
};
const PUNISH = {
  chores: { th: 'เวรทำความสะอาดหอ 3 วัน', fx: { energy: -8, stress: 3, peer: -1 } },
  phone: { th: 'ยึดมือถือ 1 สัปดาห์', fx: { stress: 5, peer: -3 } },
  nohome: { th: 'งดกลับบ้านรอบหน้า (ไม่ได้จุดเซฟ)', fx: { stress: 4 }, flag: 'noHome' },
  curfew: { th: 'เคอร์ฟิวเข้มขึ้น 10 วัน', fx: { stress: 2 }, flag: 'curfew' },
};

// the number the status screen shows: chance of being expelled if a hearing happened now (best defence)
export function conductView(G) {
  const c = cond(G);
  const survive = calcOdds(G, null, HEAR_OPTS.parents.odds).p;
  return { pts: r1(c.pts), stage: c.stage, label: c.probation ? 'อยู่ทัณฑ์บน' : STAGE_TH[c.stage] || STAGE_TH[0], probation: c.probation, noHome: c.noHome > 0, expelRisk: c.stage >= 3 || c.probation ? 100 - survive : 0 };
}

function queue(G, p) {
  G.S.queue.push(p);
  G.S.stopDay = G.S.day;
}

export function offend(G, kind) {
  const k = KINDS[kind];
  if (!k) return;
  const S = G.S;
  const c = cond(G);
  if (k.daily) { if (c['d_' + kind] === S.day) return; c['d_' + kind] = S.day; } // a habit is marked once a day
  c.pts = r1(c.pts + k.pts * (c.probation ? C.PROBATION_MULT : 1));
  c.lastOffence = S.day;
  c.last = k.th;
  say(G, `ถูกจดชื่อ: ${k.th} (แต้มพฤติกรรม ${c.pts})`, 'bad');
  addTrust(G, -2);
  const stage = C.STAGES.filter((t) => c.pts >= t).length;
  // a serious offence goes to a hearing more often when there is already a record (a first offence is usually just a warning)
  const sev = k.severe ? k.severe * clamp(0.25 + c.pts / 8, 0.25, 1.2) + (c.probation ? 0.15 : 0) : 0;
  const hearing = !c.hearingPending && ((sev && G.rng.chance(sev)) || stage >= 4);
  if (hearing) { c.stage = Math.max(c.stage, 4); return hearingScene(G, k.th); }
  if (stage > c.stage) {
    c.stage = stage;
    if (stage === 1) { say(G, 'ครูจดชื่อไว้และโทรบอกผู้ปกครอง', 'bad'); applyFx(G, { stress: 3 }); }
    else if (stage === 2) dormScene(G, k.th);
    else if (stage === 3) { c.probation = true; say(G, 'โดนทัณฑ์บน ทำผิดอีกจะถูกเรียกประชุมกรรมการ', 'bad'); applyFx(G, { stress: 5 }); addTrust(G, -6); }
  }
}

function applyPunish(G, key) {
  const c = cond(G);
  const pn = PUNISH[key];
  applyFx(G, pn.fx);
  if (pn.flag === 'noHome') c.noHome = 1;
  if (pn.flag === 'curfew') c.curfewUntil = G.S.day + 10;
  say(G, `โทษที่หอ: ${pn.th}`, 'bad');
}

function dormScene(G, why) {
  const keys = Object.keys(PUNISH);
  const key = keys[G.rng.int(0, keys.length - 1)];
  const p = {};
  const options = [opt('accept', 'รับโทษแต่โดยดี', PUNISH[key].th, null)];
  for (const [id, a] of Object.entries(APPEAL)) {
    const r = calcOdds(G, null, a.odds);
    p[id] = r.p;
    options.push(opt(id, a.label, `ได้ผล ~${r.p}%${reasonText(r.parts) ? ' (' + reasonText(r.parts) + ')' : ''}`, null));
  }
  queue(G, scene(G, { tag: 'conduct', title: 'ครูหอเรียกไปคุย', text: `ครูหอเรียกไปคุยเรื่อง${why} บอกว่าจะลงโทษที่หอ: ${PUNISH[key].th}`, options, data: { type: 'dorm', key, p } }));
}

function hearingScene(G, why) {
  const c = cond(G);
  c.hearingPending = true;
  const p = {};
  const options = [];
  for (const [id, h] of Object.entries(HEAR_OPTS)) {
    const r = calcOdds(G, null, h.odds);
    p[id] = r.p;
    const o = opt(id, h.label, `${h.cost ? h.cost + ' บาท · ' : ''}ไม่โดนไล่ออก ~${r.p}%${reasonText(r.parts) ? ' (' + reasonText(r.parts) + ')' : ''}`, id === 'argue' ? 'bad' : null);
    if (h.cost && G.me.money < h.cost) { o.disabled = true; o.reason = 'เงินไม่พอ'; }
    options.push(o);
  }
  queue(G, scene(G, {
    tag: 'conduct', title: 'ถูกเรียกประชุมกรรมการนักเรียน',
    text: `เรื่อง${why}ถูกยกขึ้นพิจารณา ห้องประชุมเงียบ ครูหลายคนนั่งอยู่ ประวัติความประพฤติของเราถูกวางบนโต๊ะ ผลที่เป็นไปได้มีตั้งแต่ทัณฑ์บน พักการเรียน ไปจนถึงให้ออก`,
    options, data: { type: 'hearing', p },
  }));
}

export function answerConduct(G, payload, pd) {
  const S = G.S;
  const c = cond(G);
  const id = payload.optionId;
  if (pd.data.type === 'dorm') {
    if (id === 'accept') return applyPunish(G, pd.data.key);
    if (rollOdds(G, pd.data.p[id])) {
      say(G, `ครูหอใจอ่อน ลดโทษเหลือแค่ตักเตือน (โอกาส ${pd.data.p[id]}% ออกมาดี)`, 'good');
      applyFx(G, { stress: 2 });
    } else {
      say(G, `ขอแล้วไม่ได้ผล (โอกาส ${pd.data.p[id]}% แต่พลาด) ครูหอเพิ่มโทษ`, 'bad');
      applyPunish(G, pd.data.key);
      c.pts = r1(c.pts + 1);
      if (id === 'mates') applyFx(G, { peer: -2 });
    }
    return;
  }
  // disciplinary hearing
  c.hearingPending = false;
  c.hearings += 1;
  const h = HEAR_OPTS[id];
  if (h.cost) { G.me.money -= h.cost; spend(G, h.cost); applyFx(G, { stress: 4 }); }
  const p = pd.data.p[id];
  if (rollOdds(G, p)) {
    c.probation = true;
    c.pts = Math.min(c.pts, C.STAGES[1] + 0.5);
    c.stage = 3;
    c.lastOffence = S.day;
    applyFx(G, { stress: 8 });
    addTrust(G, -8);
    say(G, `กรรมการให้โอกาสอีกครั้ง ทัณฑ์บนเข้ม (โอกาส ${p}% ที่รอด และรอดจริง)`, 'good');
    return;
  }
  if (G.rng.chance(0.45)) {
    say(G, `กรรมการมีมติให้ออก (โอกาส ${p}% ที่รอด แต่ไม่รอด)`, 'bad');
    return endGame(G, 'expelled');
  }
  c.pts = Math.min(c.pts, C.STAGES[1] + 0.5);
  c.stage = 3;
  c.probation = true;
  c.noHome = 1;
  G.S.pl.bonusZ -= 0.12; // a week of lessons missed
  applyFx(G, { stress: 10, peer: -5 });
  addTrust(G, -12);
  say(G, `ถูกพักการเรียนหนึ่งสัปดาห์ (โอกาส ${p}% ที่รอด แต่ไม่รอด)`, 'bad');
}

// once a day (from planEventForDay): points decay, probation ends after clean days, a new term keeps part of the points
export function conductDaily(G) {
  const S = G.S;
  const c = cond(G);
  const cal = calOf(G);
  if (cal.firstDayOfTerm) c.pts = r1(c.pts * C.TERM_KEEP);
  c.pts = Math.max(0, r1(c.pts - C.DECAY_PER_DAY));
  while (c.stage > 0 && c.stage < 4 && c.pts < C.STAGES[c.stage - 1] - 1) c.stage -= 1;
  if (c.stage >= 4 && !c.hearingPending && c.pts < C.STAGES[3] - 2) c.stage = 3;
  if (c.probation && S.day - c.lastOffence >= C.PROBATION_CLEAN_DAYS) { c.probation = false; c.stage = Math.min(c.stage, 2); say(G, 'พ้นทัณฑ์บนแล้ว ความประพฤติดีต่อเนื่อง', 'good'); }
}

// a skipped class is noticed with a chance; being close to the teacher helps
export function skipNoticed(G, idx) {
  const close = G.me.close[idx] || 0;
  const strict = G.S.pl.conduct && G.S.pl.conduct.curfewUntil >= G.S.day ? 0.15 : 0;
  return G.rng.chance(clamp(C.SKIP_CAUGHT + strict - (close - 50) * 0.003, 0.1, 0.8));
}
