// Building the whole school state and the derived indexes (rooms, teachers by grade). Student objects are the
// ones from src/cohort.js with a few extra plain fields (name, hp, st, close ...) so the state stays JSON.
import { createSchool, activeIn } from '../sim.js';
import { SCHOOL } from '../config.js';
import { clamp, DOW_KEYS } from './util.js';
import { E, R } from './config.js';
import { initRc } from './recap.js';
import { TIMETABLES, makeTeachers, shops, subjectOf } from './adapters.js';
import { setupFriends } from './friends.js';

export const SAVE_VERSION = 1;

const GIRL = ['ฟ้า', 'ใบเตย', 'แพรว', 'มิ้นท์', 'น้ำใส', 'ปราง', 'ออมสิน', 'พลอย', 'ข้าวหอม', 'เกรซ', 'นุ่น', 'เฟิร์น', 'ไอซ์', 'แก้ม', 'ก้อย', 'ตะวัน', 'อิ่มเอม', 'มาย', 'ขนม', 'ฝ้าย', 'เบลล์', 'ใบบัว', 'ชมพู่', 'นีน่า', 'พิมพ์', 'ปาริส', 'ณิชา', 'ขวัญ', 'อุ้ม', 'ต้นข้าว', 'มายด์', 'จีจี้', 'น้ำหวาน', 'ลูกพีช', 'เมษา', 'ภูริ', 'ใหม่', 'บีท', 'แป้ง', 'กานต์'];
const BOY = ['ต้น', 'ภูมิ', 'ก้อง', 'กัน', 'ปัน', 'เจมส์', 'ณัฐ', 'ฟิล์ม', 'ภาคิน', 'เต้', 'ธาม', 'นนท์', 'บอส', 'พีท', 'โอม', 'ไอซ์', 'ต้นกล้า', 'ปุณ', 'เก่ง', 'ออม', 'ตั้ม', 'ฮั่น', 'ภัทร', 'แบงค์', 'ดิว', 'ไนท์', 'เมฆ', 'ปลื้ม', 'กฤต', 'พาย', 'ขุน', 'โฟล์ค', 'ธัช', 'นิว', 'เจ', 'ภพ', 'ก๊อต', 'ลีโอ', 'พลัง', 'ฝน'];

export function detachRng(school, rng) {
  Object.defineProperty(school, 'rng', { value: rng, enumerable: false, writable: true, configurable: true });
}

// plain fields every student needs for the day-by-day simulation
export function setupStudent(G, s) {
  const rng = G.rng;
  if (s.name === undefined) s.name = rng.pick(s.sex === 'M' ? BOY : GIRL);
  s.hp = Math.round(clamp(82 + 8 * rng.gauss(), 35, 100));
  s.st = Math.round(clamp(30 + 10 * rng.gauss(), 5, 80));
  s.acc = 0; // sum of daily effort this term
  s.nd = 0; // school days counted
  s.pt = []; // term performances of this year
  s.sick = 0;
  s.abs = 0;
  s.hand = 1;
  s.snaps = 0;
  s.club = null;
  s.sat = null;
  s.elec = null;
  s.close = [];
}

// closeness to every teacher of the student's grade (0-100), by the order of G.tkList[grade]
export function initCloseness(G, s) {
  const list = G.tkList[s.grade];
  const dil = clamp(s.diligence, -2.5, 2.5);
  s.close = list.map((tk) => {
    const w = G.S.teachers[tk] ? (G.S.teachers[tk].personality.warmth - 50) / 5 : 0;
    return Math.round(clamp(38 + 7 * dil + w + 8 * G.rng.gauss(), 5, 92));
  });
}

export function newPlayerState(G, me) {
  return {
    health: E.START.health, energy: E.START.energy, stress: E.START.stress, fullness: E.START.fullness, peer: E.START.peer,
    speaking: 0,
    inv: {}, orders: [], path: [], friends: [], partner: null, heartbreak: 0, prog: {}, done: {},
    diligence: 50, dilBase: 50, satGroup: null, satZ: {}, showRole: null, showPrep: 0, showDirector: null, plays: { year: 0, n: 0, byYear: {} }, recentLabs: [], recentTopics: [],
    clubId: null, electiveId: null, elGroup: 'G1',
    subj: {}, talent: {}, cls: {}, eN: 0, studyZ: 0, bonusZ: 0, pen: {},
    healthSum: 0, sleepSum: 0, stressSum: 0, nDays: 0,
    terms: [], // [{ year, term, gpa, credits, rank, size }]
    lastGpa: null, lastRank: null, lastRankSize: null,
    d: freshDay(),
    sleepHours: 8, sick: 0, askedToday: 0,
    recentEvents: [], buffLeft: 0, lineUses: 0, caughtCount: 0,
    log: [],
    cnt: { events: 0, snapsMe: 0, scoldShown: 0, scoldYear: 0, scoldYearNo: 0, caught: 0, emergencies: 0, focus: 0, lastEmergency: -99, midCheck: 0, pendings: 0 },
    gatePassed: null, hint: '', prev: null,
  };
}

export function freshDay() {
  return { cu: [0, 0], study: 0, work: 0, skips: 0, failed: false, fullSum: 0, fullN: 0, borrowTried: [] };
}

export function newState(seed, mode = 'routine', opts = {}) {
  const school = createSchool(seed);
  const rng = school.rng;
  detachRng(school, rng);
  const tt = JSON.parse(JSON.stringify(TIMETABLES));
  const S = {
    v: SAVE_VERSION, seed, rngS: 0, mode, miniGames: opts.miniGames === 'auto' ? 'auto' : 'play', crushMode: opts.crush === 'accept' ? 'accept' : 'normal', act: null, companion: null, crush: { done: {}, askAt: 0, who: null, exes: 0 }, fair: null, satTeachers: null, playDay: -1, routine: { ...R.DEFAULT }, record: [], birth: null,
    dayB: null, bspend: 0, blkNotes: [], evPlan: null, stopDay: -1, bp: null, home: null, recap: null, flags: { term: false, year: false, weekSkip: false }, rc: null,
    day: 1, minute: 0, phase: 'intro', place: '',
    pending: null, queue: [], pid: 0, logBuf: [],
    school, tt, teachers: {}, ts: {}, tasks: [], taskSeq: 0,
    shop: null, me: 0, pl: null,
    forced: {}, rdef: {}, lastAllow: -1, npcOrders: [], clubTaken: {}, gate: null, yearPending: false,
    stat: { snaps: 0, caught: 0, tasks: 0, sick: 0, npcMeltdowns: 0, daysRun: 0 },
  };
  const G = makeG(S, rng);
  const keys = [];
  for (let g = 1; g <= 6; g++) keys.push(...Object.keys(tt[g].teachers));
  S.teachers = makeTeachers(rng, keys);
  for (const k of keys) S.ts[k] = { p: 0, snaps: 0, miss: {} };
  S.shop = shops.createShopState(rng);
  const first = activeIn(school, 1);
  const me = first[rng.int(0, first.length - 1)];
  me.isPlayer = true;
  S.me = me.id;
  for (const s of school.students) setupStudent(G, s);
  G.me = me;
  for (const s of school.students) initCloseness(G, s);
  S.pl = newPlayerState(G, me);
  const dil = Math.max(-2.5, Math.min(2.5, me.diligence));
  S.pl.diligence = S.pl.dilBase = Math.max(10, Math.min(90, 50 + 12 * dil));
  setupFriends(G, true);
  S.birth = makeBirth(G, me);
  initRc(G);
  return G;
}

export function makeG(S, rng) {
  const G = { S, rng, tt: S.tt, me: null, subjKind: (code) => subjectOf(code).kind };
  detachRng(S.school, rng);
  G.tkList = {};
  G.tkIdx = {};
  G.roomTk = {};
  G.dayTk = {};
  for (let g = 1; g <= 6; g++) {
    const list = Object.keys(S.tt[g].teachers).sort();
    G.tkList[g] = list;
    G.tkIdx[g] = {};
    list.forEach((k, i) => (G.tkIdx[g][k] = i));
    G.roomTk[g] = {};
    G.dayTk[g] = {};
    for (const [r, week] of Object.entries(S.tt[g].rooms)) {
      const all = new Set();
      G.dayTk[g][r] = {};
      DOW_KEYS.forEach((dk, di) => {
        const day = new Set();
        for (const c of week[dk]) if (c && c.tk) { all.add(c.tk); day.add(G.tkIdx[g][c.tk]); }
        G.dayTk[g][r][di + 1] = [...day];
      });
      G.roomTk[g][r] = [...all];
    }
  }
  rebuildIndex(G);
  return G;
}

// students by grade and room (active only), plus an id lookup; call after anything changes rooms
export function rebuildIndex(G) {
  const S = G.S;
  G.byId = new Map();
  G.rooms = {};
  for (let g = 1; g <= 6; g++) {
    G.rooms[g] = {};
    for (let r = 1; r <= SCHOOL.roomsPerGrade[g]; r++) G.rooms[g][r] = [];
  }
  for (const s of S.school.students) {
    G.byId.set(s.id, s);
    if (s.status === 'active' && G.rooms[s.grade] && G.rooms[s.grade][s.room]) G.rooms[s.grade][s.room].push(s);
  }
  G.me = G.byId.get(S.me) || null;
}

export const roomOf = (G, s) => G.rooms[s.grade][s.room];

// roommates in the dorm
export function roommates(G, s) {
  return G.S.school.students.filter((o) => o !== s && o.status === 'active' && o.dorm === s.dorm && o.dormRoom === s.dormRoom);
}

export function cellAt(G, grade, room, dow, p) {
  const week = G.S.tt[grade].rooms[room];
  return week ? week[DOW_KEYS[dow - 1]][p - 1] : null;
}

export const teacherName = (G, tk) => (G.S.teachers[tk] ? G.S.teachers[tk].name : 'ครู');

// the registration number and sentence of the birth card (view().birth)
function makeBirth(G, me) {
  const tier = { normal: 'ครอบครัวธรรมดา', spoiled: 'ครอบครัวที่ตามใจลูก', rich: 'ครอบครัวรวยมาก' }[me.tier];
  const num = String(me.id + 1).padStart(6, '0');
  return {
    regNo: `720-2569-${num}`,
    roomOdds: 1 / SCHOOL.roomsPerGrade[1],
    sentence: `เกิดมาเป็นนักเรียน${me.sex === 'M' ? 'ชาย' : 'หญิง'}ห้อง ม.1/${me.room} ลำดับที่ ${me.id + 1} จาก 720 คนของโรงเรียนประจำแห่งนี้ ${tier} เงินก้อนแรก ${String(Math.round(me.startMoney)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} บาท`,
  };
}
