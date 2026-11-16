// Money from the parents: the day-1 amount, asking them, and rich parents sending money by themselves.
import { MONEY } from './config.js';

const REFUSALS = [
  'ซื้ออะไรไม่ได้แล้ว แพงไปหมดแล้วลูก',
  'เดือนนี้ค่าใช้จ่ายเยอะ รอก่อนนะ',
  'ขอบ่อยเกินไปแล้วนะ',
  'ไว้ค่อยโอนให้ทีหลังนะ',
];

// Allowance comes monthly, about 135 baht x days in the month (cj).
export function monthlyAllowance(daysInMonth = 30) {
  return MONEY.perDay * daysInMonth;
}

// The player phones the parents and asks. You may ask for (day-1 amount / 10),
// every repeat halves it (80, 40, 20), below 20 baht they refuse. Resets at each home trip.
export function askParents(student, rng) {
  const base = student.startMoney / MONEY.askDivisor;
  const amount = Math.round(base / 2 ** student.askCount);
  if (amount < MONEY.refuseBelow) {
    return { ok: false, amount: 0, reason: rng.pick(REFUSALS) };
  }
  student.askCount += 1;
  student.money += amount;
  return { ok: true, amount };
}

export function resetAsks(student) {
  student.askCount = 0;
}

// Only rich parents do this, when the balance is under 5,000. Amount is random, scaled from the day-1 amount.
export function autoTransfer(student, rng) {
  if (student.tier !== 'rich' || student.money >= MONEY.autoTransferBelow) return 0;
  const amount = Math.round((student.startMoney / MONEY.askDivisor) * (0.5 + rng.float()));
  student.money += amount;
  return amount;
}
