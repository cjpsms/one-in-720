// A block of class periods: the whole school runs period by period (every room, every teacher), and the
// player's own room gets the player's stance, skips, handed-in work and LINE-shop purchases.
import { clamp } from './util.js';
import { E } from './config.js';
import { shops, subjectOf, clubById } from './adapters.js';
import { cellAt } from './world.js';
import { classPeriod, decayTeachers } from './teachers.js';
import { resolvePlayerTasks } from './tasks.js';
import { periodInfo, scene, opt } from './pending.js';
import { say, applyFx, addTrust, calOf, spend, studyFactor } from './player.js';
import { rcAdd } from './recap.js';

const fullTick = (pl) => {
  pl.fullness = clamp(pl.fullness - E.HUNGER_PER_PERIOD, 0, 100);
  pl.d.fullSum += pl.fullness;
  pl.d.fullN += 1;
};

// input: { stance, skipPeriods, line:[{p,itemId}] }
export function runBlock(G, ps, input) {
  const S = G.S;
  const me = G.me;
  const cal = calOf(G);
  const skip = new Set(input.skipPeriods || []);
  const lines = new Map((input.line || []).map((l) => [l.p, l.itemId]));
  for (const p of ps) {
    S.minute = E.PERIODS[p - 1][0];
    decayTeachers(G, E.PERIOD_DECAY);
    const mineInfo = periodInfo(G, p);
    for (let g = 1; g <= 6; g++) {
      for (const room of Object.keys(G.rooms[g])) {
        const cell = cellAt(G, g, room, cal.dow, p);
        if (!cell || !cell.code) continue;
        if (g === me.grade && Number(room) === me.room) playerClass(G, mineInfo, p, input, skip, lines);
        else classPeriod(G, g, Number(room), p, cell);
      }
    }
    if (mineInfo.kind === 'activity') playerActivity(G, mineInfo, input, skip);
    else if (mineInfo.kind === 'free') {
      const pl = S.pl;
      pl.energy = clamp(pl.energy + 1.5, 0, 100);
      pl.stress = clamp(pl.stress - 0.3, 0, 100);
      fullTick(pl);
      pl.d.cu[1] += 0;
    }
    S.donePeriod = p;
  }
}

// the whole school sits in the hall in periods 7-8 (lecture, special day, farewell): no classes, teachers cool off
export function runHall(G, ps = [7, 8]) {
  const S = G.S;
  for (const p of ps) {
    S.minute = E.PERIODS[p - 1][0];
    decayTeachers(G, E.PERIOD_DECAY);
    fullTick(S.pl);
    S.donePeriod = p;
  }
}

// periods of the other grades while one grade (the freshers) is in the hall or at a team game
export function runOthers(G, ps, skipGrade) {
  const S = G.S;
  const cal = calOf(G);
  for (const p of ps) {
    decayTeachers(G, E.PERIOD_DECAY);
    for (let g = 1; g <= 6; g++) {
      if (g === skipGrade) continue;
      for (const room of Object.keys(G.rooms[g])) {
        const cell = cellAt(G, g, room, cal.dow, p);
        if (cell && cell.code) classPeriod(G, g, Number(room), p, cell);
      }
    }
    fullTick(S.pl);
    S.donePeriod = p;
  }
}

function playerClass(G, info, p, input, skip, lines) {
  const S = G.S;
  const me = G.me;
  const pl = S.pl;
  const tk = info.tk;
  const idx = G.tkIdx[me.grade][tk];
  const tName = S.teachers[tk] ? S.teachers[tk].name : 'ครู';
  const skipped = skip.has(p) || me.abs === 1;
  const wasAbs = me.abs;
  if (skipped) me.abs = 1;
  const stance = input.stance || 'normal';
  const opts = { defyAdj: skipped ? 0.04 : E.STANCE_DEFY[stance], singleOut: skipped ? 0 : E.SINGLE_OUT[stance] };
  let failedNow = false;
  let caught = false;
  let buffed = false;
  if (!skipped) {
    const r = resolvePlayerTasks(G, tk, tName);
    for (const l of r.lines) say(G, l.text, l.tone, l.tone === 'good');
    if (r.failed) {
      failedNow = true;
      pl.d.failed = true;
      opts.extraPressure = E.PLAYER_MISS_K * (me.close[idx] >= E.CLOSE ? 1.2 : 0.5);
    }
    const itemId = lines.get(p);
    if (itemId) {
      const ctx = { day: S.day, period: p, loc: info.loc, teacherKey: tk, afternoonScience: p >= 5 && info.sj.roomKind === 'science' };
      const res = shops.lineConsume(S.shop, me, { itemId }, ctx, G.rng);
      if (res && res.ok) {
        me.money -= res.price;
        spend(G, res.price);
        rcAdd(G, 'snacks');
        applyFx(G, res.fx);
        pl.lineUses += 1;
        const o = pl.orders.find((x) => x.status === 'placed' && x.itemId === itemId && x.forDay === S.day);
        if (o) o.status = 'eaten';
        say(G, `แอบกินของจากมิ้วในคาบ ${info.short} (${res.price} บาท)`, 'neutral');
        if (res.buff) { pl.buffLeft = res.buff.periods || 1; buffed = true; }
        if (res.caught) {
          caught = true;
          const fx = res.caughtFx || {};
          addTrust(G, (fx.teacherTrust || -15) / 0.6);
          pl.pen[info.code] = (pl.pen[info.code] || 0) + Math.abs(fx.scoreBands || 1);
          opts.extraPressure = (opts.extraPressure || 0) + (fx.teacherPressure || 20);
          opts.force = true;
          opts.playerTarget = true;
          pl.caughtCount += 1;
          pl.cnt.caught += 1;
          rcAdd(G, 'caught');
          G.S.stat.caught += 1;
        }
      } else if (res) say(G, `สั่งของจากมิ้วไม่สำเร็จ: ${res.reason}`, 'bad');
    }
  }
  if (failedNow && !opts.playerTarget && G.rng.chance(0.6)) opts.playerTarget = true;
  const res = classPeriod(G, me.grade, me.room, p, info.cell, opts);
  me.abs = wasAbs;

  if (skipped) {
    pl.d.skips += 1;
    pl.d.cu[1] += 1;
    if (!S.sickDay) rcAdd(G, 'skipped');
    if (!S.sickDay) { // a skipped class is a class with no effort in it (a sick day is not held against you)
      const cl0 = pl.cls[info.code] || (pl.cls[info.code] = [0, 0]);
      cl0[1] += 1;
    }
    me.close[idx] = clamp(me.close[idx] - 1.5, 0, 100);
    if (!pl.sick) say(G, `โดดคาบ ${info.short}`, 'bad');
  } else {
    let unit = E.STANCE_UNIT[stance] * (0.65 + (0.35 * pl.energy) / 100) * studyFactor(G);
    if (pl.fullness < E.HUNGRY_BELOW) unit *= 0.8;
    if (pl.buffLeft > 0 && !buffed) { unit += E.LINE_BUFF_UNIT; pl.buffLeft -= 1; } else if (buffed) unit += E.LINE_BUFF_UNIT;
    if (res && res.snapped && res.kind === 'walkout') unit *= 0.3;
    else if (res && !res.snapped && res.ratio > 0.85) unit *= 0.9;
    const cl = pl.cls[info.code] || (pl.cls[info.code] = [0, 0]);
    cl[0] += unit;
    cl[1] += 1;
    rcAdd(G, 'attended');
    pl.d.cu[0] += unit;
    pl.d.cu[1] += 1;
    me.close[idx] = clamp(me.close[idx] + E.STANCE_TRUST[stance], 0, 100);
    pl.energy = clamp(pl.energy + E.STANCE_ENERGY[stance], 0, 100);
    pl.stress = clamp(pl.stress + E.STANCE_STRESS[stance], 0, 100);
  }
  fullTick(pl);

  if (res && res.snapped) {
    pl.cnt.snapsRoom = (pl.cnt.snapsRoom || 0) + 1;
    const when = `คาบ ${info.short}`;
    say(G, `${tName}สลิ้งแตกใน${when}`, 'bad');
    if (!skipped) pl.stress = clamp(pl.stress + E.SNAP_STRESS, 0, 100);
    if (!skipped) { pl.cnt.snapsMe += 1; rcAdd(G, 'snaps'); } // a snap in a class the player sat in
    if (res.target === 'player' && !skipped) {
      const sc = scoldedScene(G, tName, info, caught, idx);
      if (S.mode === 'routine' && (S.stopDay === S.day || (!caught && !scoldPending(G)))) {
        // the routine answers it by itself (the player is told in the record)
        const o = S.routine.study === 'relax' ? 'silent' : 'apologize';
        answerScolded(G, { optionId: o }, sc);
      } else { S.queue.push(sc); S.stopDay = S.day; }
    }
    else if (res.kind === 'extra') say(G, 'ครูสั่งงานเพิ่มให้ทั้งห้อง', 'bad');
    else if (res.kind === 'quiz') say(G, 'ครูสุ่มเก็บคะแนนกะทันหัน', 'bad');
    else if (res.kind === 'walkout') say(G, 'ครูเดินออกจากห้อง คาบนี้เรียนไม่ได้เลย', 'bad');
  }
}

function scoldedScene(G, tName, info, caught, idx) {
  const text = caught
    ? `${tName}จับได้ว่าแอบกินของในคาบ${info.short} ครูสลิ้งแตกทันที ทั้งห้องหันมามอง`
    : `${tName}สลิ้งแตกในคาบ${info.short} แล้วหันมาตำหนิเราโดยตรง ทั้งห้องเงียบกริบ`;
  return scene(G, {
    tag: 'scolded', title: `${tName}สลิ้งแตก`, text,
    options: [
      opt('apologize', 'ขอโทษและรับผิด', 'ครูใจอ่อนลงเร็วที่สุด', 'good'),
      opt('silent', 'ก้มหน้านิ่ง ฟังไปเงียบๆ', 'ไม่ได้ผลดีนัก'),
      opt('argue', 'เถียงกลับ', 'เพื่อนในห้องอาจชอบ แต่ครูไม่ชอบแน่', 'bad'),
    ],
    data: { idx },
  });
}

export function answerScolded(G, payload, pd) {
  const pl = G.S.pl;
  const me = G.me;
  const idx = pd.data.idx;
  const set = { apologize: [-2, 3, 0], silent: [-4, 5, 0], argue: [-10, 6, 4] }[payload.optionId];
  me.close[idx] = clamp(me.close[idx] + set[0], 0, 100);
  pl.stress = clamp(pl.stress + set[1], 0, 100);
  pl.peer = clamp(pl.peer + set[2], 0, 100);
  say(G, { apologize: 'ขอโทษครู ครูพยักหน้าแล้วสอนต่อ', silent: 'ก้มหน้านิ่ง จนครูหายโมโหเอง', argue: 'เถียงครูกลับ ทั้งห้องตกใจ' }[payload.optionId], 'neutral');
}

function playerActivity(G, info, input, skip) {
  const pl = G.S.pl;
  const me = G.me;
  const skipped = skip.has(info.p) || me.abs === 1;
  fullTick(pl);
  if (skipped) {
    pl.stress = clamp(pl.stress - 0.3, 0, 100);
    return;
  }
  const act = info.act;
  if (act === 'ชุมนุม') {
    const club = pl.clubId ? clubById(pl.clubId) : null;
    pl.bonusZ += club ? 0.004 : 0;
    pl.peer = clamp(pl.peer + (club ? 0.8 : 0.2), 0, 100);
    pl.stress = clamp(pl.stress - 0.4, 0, 100);
  } else if (act.startsWith('พก.')) {
    const stance = input.stance || 'normal';
    const cl = pl.cls.ELEC || (pl.cls.ELEC = [0, 0]);
    cl[0] += E.STANCE_UNIT[stance] * studyFactor(G);
    cl[1] += 1;
    pl.d.cu[0] += E.STANCE_UNIT[stance] * studyFactor(G);
    pl.d.cu[1] += 1;
    pl.energy = clamp(pl.energy + E.STANCE_ENERGY[stance], 0, 100);
  } else if (act === 'ส.การอ่าน') {
    pl.bonusZ += 0.002;
    pl.stress = clamp(pl.stress - 0.3, 0, 100);
  } else {
    pl.peer = clamp(pl.peer + 0.5, 0, 100);
    pl.energy = clamp(pl.energy - 2, 0, 100);
    pl.stress = clamp(pl.stress + 0.2, 0, 100);
  }
}

// routine mode: only a few scolding scenes a year stop the game (getting caught always does)
function scoldPending(G) {
  const pl = G.S.pl;
  const year = calOf(G).year;
  if (pl.cnt.scoldYearNo !== year) { pl.cnt.scoldYearNo = year; pl.cnt.scoldYear = 0; }
  if (pl.cnt.scoldYear >= E.SCOLD_PENDINGS_PER_YEAR) return false;
  pl.cnt.scoldYear += 1;
  pl.cnt.scoldShown += 1;
  return true;
}
