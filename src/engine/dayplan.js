// The player's day as a list of blocks (CONTRACT2 5.1): what the timeline shows and what stepBlock() runs.
import { DORMS, DORM_DAY } from '../config.js';
import { E } from './config.js';
import { hhmm, DOW_TH } from './util.js';
import { calOf } from './player.js';
import { periodInfo } from './pending.js';
import { dayKind, afternoonPeriods } from './plan.js';
import { ACT } from './adapters.js';

export function placeKindOf(loc, sj) {
  const l = String(loc || '');
  if (l.startsWith('COM')) return 'computer';
  if (l.startsWith('สนาม')) return 'field';
  if (l.startsWith('ศ.กีฬา')) return 'gym';
  if (l.startsWith('ฝึกงาน') || l.startsWith('นาฏศิลป์')) return 'activity';
  if (sj && ['physics', 'chemistry', 'biology', 'earth', 'science'].includes(sj.kind)) return 'lab';
  return 'classroom';
}

const placeName = (loc) => (/^\d+$/.test(String(loc || '')) ? `ห้อง ${loc}` : String(loc || 'ห้องเรียน'));

export const dayLabel = (G) => {
  const cal = calOf(G);
  const inYear = (cal.cycleInYear - 1) * 14 + cal.dayInCycle;
  return `วัน${DOW_TH[cal.dow]}ที่ ${inYear}`;
};

// minute -> a block. from / to are minutes since midnight (to may be 24:00 = 1440 or beyond for sleep).
const blk = (id, from, to, place, placeKind, what) => ({ id, from: hhmm(from), to: hhmm(to), minute: from, end: to, place, placeKind, what });

export function freeSlots(G) {
  let end = 780;
  for (let p = 1; p <= 8; p++) if (periodInfo(G, p).kind !== 'free') end = Math.max(end, E.PERIODS[p - 1][1]);
  const start = Math.ceil(end / 30) * 30;
  return { start, slots: Math.floor((18 * 60 - start) / 30) };
}

// the plan of the current day (S.day). `tname(tk)` is the teacher's name.
export function planDay(G) {
  const S = G.S;
  const me = G.me;
  const cal = calOf(G);
  const dorm = DORMS[me.dorm];
  const dormName = dorm ? `${dorm.name} ห้อง ${me.dormRoom}` : 'หอพัก';
  const wake = dorm ? dorm.outBy - DORM_DAY.getReady : 6 * 60;
  const out = dorm ? dorm.outBy : 7 * 60;
  const list = [];
  if (cal.home) {
    list.push(blk('h_morning', 8 * 60, 12 * 60, 'บ้าน', 'home', 'ตื่นสายที่บ้าน ช่วงเช้า'));
    list.push(blk('h_lunch', 12 * 60, 13 * 60, 'บ้าน', 'home', 'กินข้าวกลางวันที่บ้าน'));
    list.push(blk('h_afternoon', 13 * 60, 18 * 60, 'บ้าน', 'home', 'ช่วงบ่ายที่บ้าน'));
    list.push(blk('h_evening', 18 * 60, 24 * 60, cal.dayInCycle === 14 ? dormName : 'บ้าน', cal.dayInCycle === 14 ? 'dorm' : 'home', cal.dayInCycle === 14 ? 'กลับหอ 18:00 ค่ำที่หอ' : 'ค่ำที่บ้าน'));
    list.push(blk('sleep', 24 * 60, 24 * 60 + wake, cal.dayInCycle === 14 ? dormName : 'บ้าน', cal.dayInCycle === 14 ? 'dorm' : 'home', 'นอน'));
    return list;
  }
  const k = dayKind(G);
  if (cal.weekend) {
    list.push(blk('wake', wake, 8 * 60, dormName, 'dorm', 'ตื่นนอน วันหยุด'));
    list.push(blk('breakfast', 8 * 60, 8 * 60 + 30, 'โรงอาหาร', 'canteen', 'อาหารเช้า'));
    if (k.sportSat) list.push(blk('sport_morning', 8 * 60 + 30, 12 * 60, 'สนามกีฬา', 'fair', 'กีฬาสี: รอบเช้า'));
    else if (k.fair) list.push(blk('fair_morning', 8 * 60 + 30, 12 * 60, 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: เตรียมซุ้ม'));
    else if (k.sat) {
      const T = [[8 * 60 + 30, 9 * 60 + 20], [9 * 60 + 20, 10 * 60 + 10], [10 * 60 + 20, 11 * 60 + 10], [11 * 60 + 10, 12 * 60]];
      const g = ACT.SATURDAY && ACT.SATURDAY[G.me.grade];
      const gid = G.S.pl.satGroup || 'club';
      const grp = g && g.groups[gid];
      T.forEach(([f, t], i) => {
        if (grp) list.push(blk('sat' + (i + 1), f, t, 'ห้องเรียนวันเสาร์', 'classroom', `เรียนวันเสาร์: ${grp.subjects[i].name}`));
        else list.push(blk('sat' + (i + 1), f, t, 'ชุมนุมวันเสาร์', 'activity', 'ชุมนุมวันเสาร์ (ชิล)'));
      });
    } else list.push(blk('morning', 8 * 60 + 30, 12 * 60, 'วันหยุดที่โรงเรียน', 'walk', 'เช้าวันหยุด'));
    list.push(blk('lunch', 12 * 60, 13 * 60, 'โรงอาหาร', 'canteen', 'อาหารกลางวัน'));
    if (k.sportSat) list.push(blk('sport_afternoon', 13 * 60, 17 * 60 + 30, 'สนามกีฬา', 'fair', 'กีฬาสี: รอบชิง'));
    else if (k.fair) list.push(blk('fair_afternoon', 13 * 60, 17 * 60 + 30, 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: บ่าย'));
    else if (k.rehearsal) list.push(blk('rehearsal', 13 * 60, 17 * 60 + 30, 'เวทีหอประชุม', 'stage', 'ซ้อมงานราตรี'));
    else list.push(blk('afternoon', 13 * 60, 17 * 60 + 30, 'วันหยุดที่โรงเรียน', 'walk', 'บ่ายวันหยุด'));
    list.push(blk('dinner', 17 * 60 + 30, 18 * 60, 'โรงอาหาร', 'canteen', 'อาหารเย็น'));
    if (k.fair) list.push(blk('fair_evening', 18 * 60, 24 * 60, 'ลานงานลอยกระทง', 'fair', 'งานลอยกระทง: ค่ำ ประกวดและลอยกระทง'));
    else if (k.show) list.push(blk('show', 18 * 60, 24 * 60, 'หอประชุม', 'stage', 'งานราตรี'));
    else list.push(blk('evening', 18 * 60, 24 * 60, 'ห้องอ่านหนังสือของหอ', 'dormStudy', 'ค่ำที่หอพัก'));
    list.push(blk('sleep', 24 * 60, 24 * 60 + wake, dormName, 'dorm', 'นอน'));
    return list;
  }
  list.push(blk('wake', wake, out, dormName, 'dorm', 'ตื่นนอน เตรียมตัวออกจากหอ'));
  list.push(blk('breakfast', out, Math.max(out + 15, E.HOMEROOM), 'โรงอาหาร', 'canteen', 'อาหารเช้า'));
  const period = (p) => {
    const i = periodInfo(G, p);
    const [f, t] = E.PERIODS[p - 1];
    if (i.kind === 'class') {
      const tn = S.teachers[i.tk] ? S.teachers[i.tk].name : 'ครู';
      return blk('p' + p, f, t, placeName(i.loc), placeKindOf(i.loc, i.sj), `${i.name} กับ${tn}`);
    }
    if (i.kind === 'activity') return blk('p' + p, f, t, i.name, i.act === 'ลส/ยว' ? 'field' : 'activity', i.name);
    return blk('p' + p, f, t, 'หลังห้องเรียน', 'walk', 'คาบว่าง');
  };
  const HALL_WHAT = { lecture: 'หอประชุม: ฟังบรรยาย', special: 'หอประชุม: กิจกรรมวันสำคัญ', farewell: 'หอประชุม: พิธีอำลาครู' };
  const frDefs = k.fresher && ACT.FRESHER ? ACT.FRESHER.days[k.fresher - 1].blocks : null;
  const frb = (i, f, t) => { const d = frDefs ? frDefs[i] : null; return blk('fr' + (i + 1), f, t, d ? d.place : 'หอประชุม', d ? d.placeKind : 'hall', d ? d.what : 'กิจกรรมรับน้อง'); };
  if (k.fresher) {
    list.push(frb(0, 8 * 60 + 30, 10 * 60 + 30));
    list.push(frb(1, 10 * 60 + 40, 12 * 60));
    list.push(blk('lunch', 12 * 60, 13 * 60, 'โรงอาหาร', 'canteen', 'อาหารกลางวัน'));
    list.push(frb(2, 13 * 60, 16 * 60 + 30));
  } else if (k.xmas) {
    list.push(blk('xmas_morning', 8 * 60 + 30, 12 * 60, 'ลานต้นคริสต์มาส', 'hall', 'คริสต์มาส: ประดับต้นไม้'));
    list.push(blk('lunch', 12 * 60, 13 * 60, 'โรงอาหาร', 'canteen', 'อาหารกลางวัน'));
    list.push(blk('xmas_hall', 13 * 60, 14 * 60 + 50, 'หอประชุม', 'hall', 'คริสต์มาส: ปาร์ตี้ในหอประชุม'));
    for (const p of afternoonPeriods(G)) list.push(period(p));
  } else {
    for (let p = 1; p <= 4; p++) list.push(period(p));
    list.push(blk('lunch', 12 * 60, 13 * 60, 'โรงอาหาร', 'canteen', 'อาหารกลางวัน'));
    for (const p of afternoonPeriods(G)) list.push(period(p));
    if (k.sportFri) list.push(blk('sport_fri', 13 * 60, 16 * 60 + 30, 'สนามกีฬา', 'fair', 'กีฬาสี: ขบวนพาเหรดและแสตนด์'));
    if (k.hall) list.push(blk('hall', 14 * 60 + 50, 16 * 60 + 30, 'หอประชุม', 'hall', HALL_WHAT[k.hall]));
  }
  if (cal.lastSchoolDay) {
    list.push(blk('trip', 16 * 60 + 30, 18 * 60, 'ทางกลับบ้าน', 'walk', 'เลิกเรียนวันศุกร์ กลับบ้าน'));
    list.push(blk('sleep', 24 * 60, 24 * 60 + wake, 'บ้าน', 'home', 'นอนที่บ้าน'));
    return list;
  }
  const fs = freeSlots(G);
  if (fs.slots > 0) list.push(blk('free', fs.start, 17 * 60 + 30, 'หลังเลิกเรียน', 'walk', 'ช่วงว่างหลังเลิกเรียน'));
  list.push(blk('dinner', 17 * 60 + 30, 18 * 60, 'โรงอาหาร', 'canteen', 'อาหารเย็น'));
  list.push(blk('checkin', 18 * 60, 19 * 60, dormName, 'dorm', 'เช็คชื่อเข้าหอ รวมหอ'));
  list.push(blk('evening', 19 * 60, 24 * 60, 'ห้องอ่านหนังสือของหอ', 'dormStudy', 'ค่ำที่หอพัก'));
  list.push(blk('sleep', 24 * 60, 24 * 60 + wake, dormName, 'dorm', 'นอน'));
  return list;
}
