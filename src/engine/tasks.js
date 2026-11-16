// Assignments teachers set (content/tasks.js makes them), who hands them in, and the required items.
import { clamp, nf } from './util.js';
import { E } from './config.js';
import { makeTask, requiredItemName, TASK_ITEMS, subjectOf } from './adapters.js';

export function assignTasks(G, cal) {
  const S = G.S;
  S.tasks = S.tasks.filter((t) => t.due >= S.day - E.TASK_KEEP_DAYS);
  for (let g = 1; g <= 6; g++) {
    const seen = new Set();
    for (const r of Object.keys(G.dayTk[g])) {
      for (const idx of G.dayTk[g][r][cal.dow]) seen.add(G.tkList[g][idx]);
    }
    for (const tk of [...seen].sort()) {
      if (!G.rng.chance(E.TASK_RATE)) continue;
      const codes = S.tt[g].teachers[tk].codes || [];
      if (!codes.length) continue;
      const code = codes[G.rng.int(0, codes.length - 1)];
      const t = makeTask(G.rng, { teacher: S.teachers[tk], subject: code, grade: g, day: S.day });
      const due = S.day + Math.ceil((t.dueIn * 7) / 5);
      S.taskSeq += 1;
      S.tasks.push({ id: `k${S.taskSeq}`, tk, grade: g, name: t.name, kind: t.kind, effort: t.effort, due, req: t.requiredItems.slice(), code, npcDone: false, day: S.day });
      S.stat.tasks += 1;
    }
  }
}

const teachesRoom = (G, t, room) => G.roomTk[t.grade][room] && G.roomTk[t.grade][room].includes(t.tk);

// NPC students hand work in (or not) on the due day; close students who fail raise the teacher's pressure
export function resolveNpcTasks(G) {
  const S = G.S;
  for (const t of S.tasks) {
    if (t.npcDone || t.due > S.day) continue;
    t.npcDone = true;
    const idx = G.tkIdx[t.grade][t.tk];
    for (const room of Object.keys(G.rooms[t.grade])) {
      if (t.room && String(t.room) !== room) continue;
      if (!teachesRoom(G, t, room)) continue;
      let miss = 0;
      for (const s of G.rooms[t.grade][room]) {
        if (s.isPlayer) continue;
        const p = clamp(0.5 + 0.2 * clamp(s.diligence, -2.5, 2.5) + 0.1 * (s.close[idx] / 50 - 1), 0.05, 0.98);
        if (G.rng.chance(p)) s.close[idx] = Math.min(100, s.close[idx] + 2.5);
        else {
          if (s.close[idx] >= E.CLOSE) miss++;
          s.close[idx] = Math.max(0, s.close[idx] - 5);
          s.st = Math.min(100, s.st + 2);
        }
      }
      if (miss) S.ts[t.tk].miss[room] = (S.ts[t.tk].miss[room] | 0) + miss;
    }
  }
}

export function playerTasks(G) {
  const S = G.S;
  const me = G.me;
  return S.tasks
    .filter((t) => t.grade === me.grade && (!t.room || t.room === me.room) && teachesRoom(G, t, me.room) && !S.pl.done[t.id] && t.due >= S.day - 6)
    .sort((a, b) => a.due - b.due);
}

// missing items for a task: [{ id (task id), inv, need, have, name }]
export function missingItems(G, t) {
  const inv = G.S.pl.inv;
  const out = [];
  for (const id of t.req || []) {
    const m = TASK_ITEMS[id];
    if (!m) continue;
    const have = inv[m.inv] || 0;
    if (have < m.qty) out.push({ id, inv: m.inv, need: m.qty, have, name: requiredItemName(id) });
  }
  return out;
}

// the player's homework time goes to the earliest-due unfinished tasks
export function addWork(G, units) {
  const pl = G.S.pl;
  let left = units;
  for (const t of playerTasks(G)) {
    if (left <= 0) break;
    const need = t.effort - (pl.prog[t.id] || 0);
    if (need <= 0) continue;
    const use = Math.min(need, left);
    pl.prog[t.id] = (pl.prog[t.id] || 0) + use;
    left -= use;
  }
}

// In the player's class with teacher tk: hand in what is due. Returns { failed, lines:[{text,tone}] }
export function resolvePlayerTasks(G, tk, name) {
  const S = G.S;
  const pl = S.pl;
  const me = G.me;
  const idx = G.tkIdx[me.grade][tk];
  const lines = [];
  let failed = false;
  for (const t of playerTasks(G)) {
    if (t.tk !== tk || t.due > S.day) continue;
    const workOk = (pl.prog[t.id] || 0) >= t.effort;
    const miss = missingItems(G, t);
    if (workOk && !miss.length) {
      pl.done[t.id] = 'ok';
      for (const id of t.req || []) {
        const m = TASK_ITEMS[id];
        if (m && m.use) pl.inv[m.inv] = Math.max(0, (pl.inv[m.inv] || 0) - m.use);
      }
      me.close[idx] = clamp(me.close[idx] + E.TASK_TRUST_OK, 0, 100);
      lines.push({ text: `ส่ง "${t.name}" ให้${name}ครบ ครูพอใจ`, tone: 'good' });
    } else {
      pl.done[t.id] = 'fail';
      failed = true;
      const bits = [];
      if (!workOk) bits.push('งานยังไม่เสร็จ');
      if (miss.length) bits.push('ของไม่ครบ (' + miss.map((m) => m.name).join(', ') + ')');
      me.close[idx] = clamp(me.close[idx] + (workOk ? E.TASK_TRUST_ITEMS : E.TASK_TRUST_FAIL), 0, 100);
      pl.stress = Math.min(100, pl.stress + 4);
      pl.pen[t.code] = (pl.pen[t.code] || 0) + 1;
      lines.push({ text: `"${t.name}" ถูกหักเพราะ${bits.join(' และ ')}`, tone: 'bad' });
    }
  }
  return { failed, lines };
}

// reminder lines for view().notes
export function taskNotes(G) {
  const S = G.S;
  const pl = S.pl;
  const out = [];
  for (const t of playerTasks(G)) {
    const left = t.due - S.day;
    const prog = Math.min(t.effort, pl.prog[t.id] || 0);
    const need = (t.req || []).map((id) => {
      const m = TASK_ITEMS[id];
      const ok = !m || (pl.inv[m.inv] || 0) >= m.qty;
      return `${requiredItemName(id)}${ok ? ' (มีแล้ว)' : ' (ยังไม่มี)'}`;
    });
    const nm = S.teachers[t.tk] ? S.teachers[t.tk].name : 'ครู';
    const when = left > 0 ? `ส่งอีก ${left} วัน` : 'ถึงกำหนดแล้ว';
    out.push(`${nm} สั่ง ${t.name} ${when} (ทำแล้ว ${prog}/${t.effort})${need.length ? ' ต้องใช้: ' + need.join(', ') : ''}`);
  }
  if (pl.orders.some((o) => o.status === 'placed')) out.push('สั่งของจากมิ้วไว้: ' + pl.orders.filter((o) => o.status === 'placed').map((o) => `${o.itemName} (วันที่ ${o.forDay})`).join(', '));
  return out;
}
