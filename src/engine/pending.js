// Builders for the six pending kinds (CONTRACT.md section 3). A pending is plain JSON: it also carries `tag`
// (which answer handler gets the payload) and `data` (what the handler needs); the UI ignores both.
import { DORMS, DORM_DAY } from '../config.js';
import { E } from './config.js';
import { hhmm, seasonOf, DOW_KEYS, sexTh } from './util.js';
import { calOf, clockLabel } from './player.js';
import { shops, subjectOf, clubsFor, electivesFor, hasElective, ACTIVITY_NAMES, electiveById } from './adapters.js';
import { actionList } from './actions.js';
import { moodOf } from './teachers.js';
import { askParents } from '../money.js';
import { cellAt, roommates } from './world.js';
import { dayKind, morningPeriods, afternoonPeriods } from './plan.js';
import { ACT } from './adapters.js';

export function mk(G, kind, props) {
  const S = G.S;
  S.pid += 1;
  return { id: S.pid, kind, clock: clockLabel(G), ...props };
}

export function scene(G, { tag, title, text, card, options, final = false, data = null }) {
  const p = mk(G, 'scene', { tag, title, text, options: options || [], final, data });
  if (card) p.card = { rows: card };
  return p;
}

export const opt = (id, label, sub, tone) => {
  const o = { id, label };
  if (sub) o.sub = sub;
  if (tone) o.tone = tone;
  return o;
};

export function shopP(G, mode, meal, tag) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const ctx = { mode, meal, season: seasonOf(calOf(G)), minute: S.minute, student: me, inventory: pl.inv, day: S.day };
  const list = shops.listShop(S.shop, ctx);
  const title = { breakfast: 'อาหารเช้า', lunch: 'อาหารกลางวัน', dinner: 'อาหารเย็น' }[meal] || (mode === 'coop' ? 'สหกรณ์' : mode === 'print' ? 'ห้องปริ้น' : 'โรงอาหาร');
  const text = mode === 'coop' ? 'อาคารร้านค้าสวัสดิการโรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย พิษณุโลก (สหกรณ์)' : mode === 'print' ? 'ปริ้นหน้าละ 2 บาท ต้องมีกระดาษ A4 ก่อน' : 'เลือกซื้อได้หลายร้าน หรือข้ามมื้อนี้ก็ได้';
  return mk(G, 'shop', { tag, title, text, mode, meal: meal || null, money: Math.round(me.money), fullness: Math.round(pl.fullness), shops: list, canSkip: true });
}

export const isLineLoc = (loc) => {
  const m = String(loc || '').match(/\d{3}/);
  return !!m && (m[0] === '221' || m[0] === '223');
};

// what the player does in period p of today: class / activity / free (the elective block depends on the group)
export function periodInfo(G, p) {
  const S = G.S;
  const me = G.me;
  const cal = calOf(G);
  const cell = cellAt(G, me.grade, me.room, cal.dow, p);
  const [from, to] = E.PERIODS[p - 1];
  const base = { p, from: hhmm(from), to: hhmm(to), cell };
  const dk = dayKind(G);
  if (dk.fresher) return { ...base, kind: 'activity', act: 'รับน้อง', name: 'กิจกรรมรับน้อง' };
  if (dk.xmas && p <= 6) return { ...base, kind: 'activity', act: 'คริสต์มาส', name: 'งานคริสต์มาส' };
  if (dk.xmas && G.S.xmasInf) return { ...base, kind: 'activity', act: 'ห้องพยาบาล', name: 'ห้องพยาบาล' };
  if (dk.sportFri && p >= 5) return { ...base, kind: 'activity', act: 'กีฬาสี', name: 'กีฬาสี' };
  if (dk.hall && p >= 7) return { ...base, kind: 'activity', act: 'หอประชุม', name: 'หอประชุม' };
  if (cell && cell.code) {
    const sj = subjectOf(cell.code);
    const tk = cell.tk;
    return { ...base, kind: 'class', code: cell.code, name: sj.th, short: sj.short, loc: cell.loc, tk, sj };
  }
  if (cell && cell.act) {
    const group = cell.group && cell.group !== 'all' ? cell.group : null;
    if (cell.act.startsWith('พก.')) {
      if (group && group !== S.pl.elGroup) return { ...base, kind: 'free', name: 'คาบว่าง (วิชาเลือกกลุ่มอื่น)' };
      const el = S.pl.electiveId ? electiveById(S.pl.electiveId) : null;
      return { ...base, kind: 'activity', act: cell.act, name: el ? `พก. ${el.name}` : 'วิชาเลือก (พก.)' };
    }
    if (cell.act === 'ชุมนุม') return { ...base, kind: 'activity', act: cell.act, name: 'ชุมนุม' };
    return { ...base, kind: 'activity', act: cell.act, name: ACTIVITY_NAMES[cell.act] || cell.act };
  }
  return { ...base, kind: 'free', name: 'คาบว่าง' };
}

export function classPlanP(G, block, tag) {
  const S = G.S;
  const me = G.me;
  const ps = block === 'morning' ? morningPeriods(G) : afternoonPeriods(G);
  const periods = ps.map((p) => {
    const i = periodInfo(G, p);
    const o = { p, from: i.from, to: i.to, kind: i.kind, name: i.name };
    if (i.kind === 'class') {
      o.code = i.code;
      o.loc = i.loc;
      o.teacher = { key: i.tk, name: S.teachers[i.tk] ? S.teachers[i.tk].name : 'ครู', mood: moodOf(G, i.tk) };
      const eligible = isLineLoc(i.loc);
      const menu = eligible ? shops.lineMenu(S.shop, { day: S.day, studentId: me.id, loc: i.loc, period: p, afternoonScience: p >= 5 && i.sj.roomKind === 'science', teacherKey: i.tk }) : [];
      o.lineShop = { eligible, items: menu.map((m) => ({ id: m.id, name: m.name, price: m.price, available: !!m.available, ...(m.reason ? { reason: m.reason } : {}) })) };
    } else if (i.act) o.loc = '';
    return o;
  });
  const has = periods.some((q) => q.kind !== 'free');
  return { pending: mk(G, 'classPlan', { tag, title: block === 'morning' ? 'คาบเช้า' : 'คาบบ่าย', text: 'ตั้งท่าทีในห้องเรียน และเลือกว่าจะโดดคาบไหนไหม', block, periods, money: Math.round(me.money), data: { ps } }), has };
}

export function parentsInfo(G) {
  const me = G.me;
  const base = me.startMoney / 10;
  const amount = Math.round(base / 2 ** me.askCount);
  return { canAsk: amount >= 20, nextAmount: amount >= 20 ? amount : 0 };
}

export function planP(G, planKind, startMinute, slots, title, text, tag) {
  const me = G.me;
  const dorm = DORMS[me.dorm];
  const p = mk(G, 'plan', {
    tag, title, text, planKind, startMinute, slotMinutes: 30, slots,
    actions: actionList(planKind).filter((a) => a.id !== 'date' || (G.S.pl.partner && planKind !== 'evening')), money: Math.round(me.money), parents: parentsInfo(G),
    wakeMinute: dorm.outBy - DORM_DAY.getReady,
  });
  if (planKind === 'evening') p.lightsOutMinute = dorm.bed;
  return p;
}

export function needElective(G) {
  const me = G.me;
  if (!hasElective(me.grade)) return false;
  const week = G.S.tt[me.grade].rooms[me.room];
  return DOW_KEYS.some((dk) => week[dk].some((c) => c && c.act && c.act.startsWith('พก.')));
}

// Saturday groups of the player's grade (CONTRACT3 section 3) plus the chill club
export function satGroupList(G) {
  const g = ACT.SATURDAY && ACT.SATURDAY[G.me.grade];
  if (!g) return [];
  const out = ['A', 'B', 'C', 'D'].filter((id) => g.groups[id]).map((id) => ({ id, name: g.groups[id].name, blurb: g.groups[id].blurb, subjects: g.groups[id].subjects.map((s) => s.short) }));
  out.push({ id: 'club', name: g.club.name, blurb: g.club.note, subjects: [] });
  return out;
}

// the default Saturday group: study 'relax' -> the chill club, otherwise the group that matches the weakest kind of subject, else A
export function defaultSatGroup(G) {
  const pl = G.S.pl;
  if (G.S.routine.study === 'relax') return 'club';
  const weak = {};
  for (const sj of Object.values(pl.subj || {})) {
    if (sj.code === 'ELEC') continue;
    const k = subjectOf(sj.code).kind;
    const cl = pl.cls[sj.code];
    const avg = cl && cl[1] ? cl[0] / cl[1] : null;
    if (avg === null) continue;
    weak[k] = Math.min(weak[k] === undefined ? 9 : weak[k], avg + (pl.talent[sj.code] || 0) * 0.1);
  }
  const kinds = Object.keys(weak).sort((a, b) => weak[a] - weak[b]);
  if (kinds.length && ACT.satGroupForKind) return ACT.satGroupForKind(G.me.grade, kinds[0]);
  return 'A';
}

export function termStartP(G, tag) {
  const S = G.S;
  const me = G.me;
  const clubs = clubsFor(me.grade).map((c) => ({ id: c.id, name: c.name, area: c.area, seatsLeft: Math.max(0, c.seats - (S.clubTaken[c.id] || 0)), seats: c.seats, studentRun: !!c.studentRun }));
  const need = needElective(G);
  const electives = need ? electivesFor(me.grade).map((e) => ({ id: e.id, name: e.name, area: e.area })) : [];
  let text = 'เลือกชุมนุม (ที่นั่งมีจำกัด) และวิชาเลือก (พก.) ของเทอมนี้';
  if (S.mode === 'routine' && calOf(G).term === 1) {
    const d = DORMS[me.dorm];
    const mates = roommates(G, me).map((m) => `${m.name} (${sexTh(m.sex)})`).join(', ');
    text = `ม.${me.grade}/${me.room} หอ ${d ? d.name : '-'} ห้อง ${me.dormRoom}${mates ? ' เพื่อนร่วมห้องนอน ' + mates : ''}. ` + text;
  }
  // "same club and elective as last term"
  const prev = S.pl.prev || null;
  const satGroups = satGroupList(G);
  const canKeep = !!prev
    && (prev.clubId === null || clubs.some((c) => c.id === prev.clubId && c.seatsLeft > 0))
    && (!need || (prev.electiveId !== null && electives.some((e) => e.id === prev.electiveId)));
  const p = mk(G, 'termStart', { tag, title: `เปิดเทอม ${calOf(G).term} ม.${me.grade}/${me.room}`, text, clubs, electives, needElective: need, canKeep, satGroups, previous: prev ? { clubId: prev.clubId, electiveId: prev.electiveId, satGroup: prev.satGroup || null } : null });
  if (S.pl.partner) p.hint = 'มีแฟนอยู่: ถ้าไม่เน้นเรียนเกรดจะตก';
  return p;
}

export function lineOrderP(G, tag) {
  const S = G.S;
  const me = G.me;
  const menu = shops.lineMenu(S.shop, { day: S.day, studentId: me.id }).map((m) => ({ id: m.id, name: m.name, price: m.price, ...(m.note ? { note: m.note } : {}) }));
  const orders = S.pl.orders.slice(-12).map((o) => ({ id: o.id, itemName: o.itemName, forDay: o.forDay, status: o.status }));
  return mk(G, 'lineOrder', { tag, title: 'สั่งของจากมิ้ว', text: 'สั่งล่วงหน้าสำหรับวันเรียนถัดไป จ่ายตอนรับของ กินในคาบได้เฉพาะห้องที่ติดห้อง 222 (221, 223)', menu, orders, money: Math.round(me.money) });
}

export { askParents };
