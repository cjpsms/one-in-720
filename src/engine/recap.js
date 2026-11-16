// Recaps (view().recap): what happened since the last week / term / year recap. Three accumulators live in the state
// (S.rc.week / term / year); the engine adds to all three, and a recap reads one and resets it.
import { nf } from './util.js';
import { DORMS } from '../config.js';
import { gpax } from './player.js';
import { happyOf } from './routine.js';

const KEYS = ['spent', 'sleepSum', 'sleepN', 'attended', 'skipped', 'snacks', 'caught', 'snaps', 'days', 'events', 'acts'];

// a row for the recap pages ([label, value]) kept until the recap of that period is built
export function rcNote(G, row) {
  const rc = G.S.rc;
  if (!rc) return;
  for (const k of ['week', 'term', 'year']) { (rc[k].notes ||= []).push(row); if (rc[k].notes.length > 8) rc[k].notes.shift(); }
}

const fresh = (G) => {
  const pl = G.S.pl;
  const o = { day0: G.S.day, happy0: Math.round(happyOf(G)), health0: Math.round(pl.health), money0: Math.round(G.me.money) };
  for (const k of KEYS) o[k] = 0;
  o.notes = [];
  return o;
};

export function initRc(G) {
  G.S.rc = { week: fresh(G), term: fresh(G), year: fresh(G), n: 0 };
}

export function rcAdd(G, key, v = 1) {
  const rc = G.S.rc;
  if (!rc) return;
  for (const k of ['week', 'term', 'year']) rc[k][key] = (rc[k][key] || 0) + v;
}

export const weekNo = (cal) => (cal.cycleInTerm - 1) * 2 + (cal.dayInCycle > 7 ? 2 : 1);

const r1 = (x) => Math.round(x * 10) / 10;

// highlights: the notable record lines since day0 (bad first, then good), at least 3 and at most 6
function highlights(G, day0, extra) {
  const lines = (G.S.record || []).filter((l) => l.day >= day0 && l.text && !l.text.startsWith('สัปดาห์ที่') && !l.text.startsWith('ตั้งโฟกัส') && !l.text.startsWith('เข้าชุมนุม'));
  const bad = lines.filter((l) => l.tone === 'bad').slice(-3);
  const good = lines.filter((l) => l.tone === 'good').slice(-3);
  const neutral = lines.filter((l) => l.tone === 'neutral' && (l.text.includes('แอบกิน') || l.text.includes('สลิ้งแตก'))).slice(-2);
  let pick = [...bad, ...good, ...neutral].sort((a, b) => a.day - b.day).map((l) => l.text);
  pick = pick.slice(-6);
  for (const t of extra) if (pick.length < 3) pick.push(t);
  return pick;
}

// kind: 'week' | 'term' | 'year'. Builds the recap object and resets that accumulator (and the shorter ones).
export function buildRecap(G, kind, cal, grade) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const a = S.rc[kind];
  const gr = grade === undefined ? me.grade : grade;
  const days = Math.max(1, S.day - a.day0 + (kind === 'week' ? 0 : 0));
  const happy = Math.round(happyOf(G));
  const dh = happy - a.happy0;
  const mood = dh >= 4 ? 'up' : dh <= -4 ? 'down' : 'flat';
  const spent = Math.round(a.spent);
  const sleepAvg = a.sleepN ? r1(a.sleepSum / a.sleepN) : null;
  const total = a.attended + a.skipped;
  let label;
  if (kind === 'week') label = `สัปดาห์ที่ ${weekNo(cal)} · ม.${gr} เทอม ${cal.term}`;
  else if (kind === 'term') label = `สรุปเทอม ${cal.term} · ม.${gr}`;
  else label = `สรุปปีการศึกษา ม.${gr}`;
  const rows = [
    ['คาบที่เข้าเรียน', total ? `${a.attended} จาก ${total}` : '-'],
    ['เงินที่ใช้', `${nf(spent)} บาท`],
    ['เงินคงเหลือ', `${nf(me.money)} บาท`],
    ['นอนเฉลี่ย', sleepAvg !== null ? `${sleepAvg.toFixed(1)} ชั่วโมง` : '-'],
    ['สุขภาพ', `${Math.round(pl.health)} (จาก ${a.health0})`],
    ['ความสุข', `${happy} (จาก ${a.happy0})`],
  ];
  if (a.snacks) rows.push(['แอบกินของจากมิ้ว', `${a.snacks} ครั้ง${a.caught ? ` โดนจับ ${a.caught}` : ''}`]);
  if (a.snaps) rows.push(['ครูสลิ้งแตกในคาบที่เรานั่ง', `${a.snaps} ครั้ง`]);
  if (a.acts) rows.push(['กิจกรรมพิเศษและมินิเกม', `${a.acts} ครั้ง`]);
  for (const n of a.notes || []) rows.push(n);
  const extra = [`เข้าเรียน ${a.attended} คาบ`, `ใช้เงินไป ${nf(spent)} บาท`, sleepAvg !== null ? `นอนเฉลี่ย ${sleepAvg.toFixed(1)} ชั่วโมง` : 'สัปดาห์ที่เงียบสงบ'];
  const recap = {
    kind, label, rows,
    highlights: highlights(G, a.day0, extra),
    money: { spent, left: Math.round(me.money), perDay: Math.round(spent / days) },
    sleepAvg, classesAttended: a.attended, snacks: a.snacks, mood,
  };
  if (kind !== 'week') {
    const t = pl.terms[pl.terms.length - 1];
    recap.gpa = kind === 'year' ? (me.gpa !== null && me.gpa !== undefined ? me.gpa : t && t.gpa) : t && t.gpa;
    recap.rank = kind === 'year' ? `${pl.lastRank} จาก ${pl.lastRankSize}` : t ? `${t.rank} จาก ${t.size}` : null;
    rows.unshift(['เกรด', recap.gpa !== null && recap.gpa !== undefined ? Number(recap.gpa).toFixed(2) : '-']);
    rows.unshift(['อันดับในชั้นปี', recap.rank || '-']);
    const gx = gpax(pl);
    if (gx !== null) rows.push(['เกรดเฉลี่ยสะสม (GPAX)', (Math.round(gx * 100) / 100).toFixed(2)]);
  }
  if (kind === 'year') {
    const d = DORMS[me.dorm];
    recap.roomNext = `ม.${me.grade}/${me.room}`;
    recap.dormNext = d ? `${d.name} ห้อง ${me.dormRoom}` : null;
    rows.push(['ห้องเรียนปีหน้า', recap.roomNext]);
    if (recap.dormNext) rows.push(['หอพักปีหน้า', recap.dormNext]);
  }
  // reset: a year recap resets everything, a term recap resets term + week, a week recap only the week
  const order = ['week', 'term', 'year'];
  for (const k of order.slice(0, order.indexOf(kind) + 1)) S.rc[k] = fresh(G);
  return recap;
}

