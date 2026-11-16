// Follows one new ม.1 student through the school at year level. Run: node demo.js [seed]
import { createSchool, yearStep, activeIn } from './src/sim.js';
import { DORMS } from './src/config.js';
import { askParents } from './src/money.js';

const seed = Number(process.argv[2]) || 2026;
const school = createSchool(seed);
const me = activeIn(school, 1)[Math.floor(school.rng.float() * 96)];
me.isPlayer = true; // never drops out by chance, only by choice

const tierTh = { normal: 'ปกติ', spoiled: 'สปอยล์', rich: 'รวยมาก' };
const mates = school.students.filter((s) => s !== me && s.status === 'active' && s.dorm === me.dorm && s.dormRoom === me.dormRoom);

console.log(`seed ${seed}: you are 1 in ${activeIn(school, 1).length + activeIn(school, 2).length + activeIn(school, 3).length + activeIn(school, 4).length + activeIn(school, 5).length + activeIn(school, 6).length}`);
console.log(`  ${me.sex === 'M' ? 'ชาย' : 'หญิง'}, ${me.trait === 'extro' ? 'extrovert' : 'introvert'}, ม.1/${me.room}`);
console.log(`  พ่อแม่: ${tierTh[me.tier]}  เงินวันแรก ${me.startMoney} บาท  ขอได้ครั้งละ ${Math.round(me.startMoney / 10)}`);
console.log(`  หอ: ${DORMS[me.dorm].name} ห้อง ${me.dormRoom} (${mates.length + 1} คน)`);
const ask = askParents(me, school.rng);
console.log(`  ลองโทรขอเงิน: ${ask.ok ? '+' + ask.amount + ' บาท' : ask.reason}`);

console.log('\nปี  ชั้น/ห้อง  เกรดปีนี้  อันดับ  หอ');
for (let y = 1; y <= 6; y++) {
  const grade = me.grade;
  const room = me.room;
  const report = yearStep(school);
  const mark = me.gpaHist[me.gpaHist.length - 1]; // this year's GPA and rank in the grade
  const where = me.status === 'active' ? `${DORMS[me.dorm].name} ห้อง ${me.dormRoom}` : '';
  console.log(`${y}   ม.${grade}/${room}      ${mark.gpa.toFixed(2)}      ${String(mark.rank).padStart(3)}/${mark.size}  ${where}`);
  if (me.status === 'failed_gate') {
    console.log(`  -> ไม่ติด ม.4 (เกรด ม.3 ${me.gpa.toFixed(2)}) จบที่นี่: เลือกไป smurf โรงเรียนแถวบ้าน หรือพอ`);
    break;
  }
  if (me.status === 'graduated') {
    console.log('  -> จบ ม.6');
    break;
  }
  if (report.year === 3) console.log(`  (ประตู ม.4 ปีนี้: เด็กเดิมติด ${report.gatePassed}/${report.gateInternal}, เด็กนอกเข้า ${report.outsiders})`);
}
