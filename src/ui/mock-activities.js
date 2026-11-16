// Mock content for the mini games (docs/CONTRACT3.md sections 4 and 5): param builders for all ten games, used by the
// mock engine and by the `?mg=<game>` test page. All texts are Thai and fictional. Deterministic from the seed.
import { Rng } from '../rng.js';

export const MOCK_GAME_IDS = ['watch', 'serve', 'craft', 'pattern', 'dash', 'timing', 'rhythm', 'track', 'sequence', 'steps'];

const TOPICS = [
  { topic: 'การวางแผนเวลา', slides: [['เขียนก่อนทำ', 'จดรายการงานที่ต้องทำทุกเช้าก่อนเริ่มเรียน'], ['งานสำคัญก่อน', 'เรียงงานจากสำคัญมากไปน้อย แล้วทำทีละอย่าง'], ['พักให้พอ', 'พักสิบนาทีทุกหนึ่งชั่วโมงช่วยให้จำได้ดีขึ้น'], ['ทบทวนตอนเย็น', 'ก่อนนอนทบทวนสิ่งที่เรียนมาห้านาที'], ['สรุป', 'แผนที่เขียนไว้ช่วยให้เหนื่อยน้อยลง']],
    keywords: ['รายการงาน', 'สำคัญก่อน', 'พักสิบนาที', 'ทบทวน'],
    questions: [{ q: 'ครูบอกให้จดรายการงานตอนไหน', choices: ['ทุกเช้าก่อนเริ่มเรียน', 'ก่อนสอบเท่านั้น', 'ตอนเที่ยง'], answer: 0 }, { q: 'ควรพักกี่นาทีทุกหนึ่งชั่วโมง', choices: ['สามสิบนาที', 'สิบนาที', 'ไม่ต้องพัก'], answer: 1 }, { q: 'ก่อนนอนควรทำอะไร', choices: ['ทบทวนห้านาที', 'อ่านหนังสือสามชั่วโมง', 'เล่นโทรศัพท์'], answer: 0 }] },
  { topic: 'การดูแลหอพัก', slides: [['ของใช้ส่วนรวม', 'ช่วยกันเก็บรองเท้าให้เป็นระเบียบหน้าห้อง'], ['เวลาเงียบ', 'หลังสามทุ่มครึ่งต้องเบาเสียงในทุกห้อง'], ['ประหยัดไฟ', 'ปิดไฟและพัดลมทุกครั้งที่ออกจากห้อง'], ['ดูแลกัน', 'ถ้าเพื่อนป่วยให้แจ้งครูเวรทันที'], ['สรุป', 'หอพักที่ดีเริ่มจากคนในห้อง']],
    keywords: ['รองเท้า', 'เบาเสียง', 'ปิดไฟ', 'ครูเวร'],
    questions: [{ q: 'หลังกี่โมงต้องเบาเสียง', choices: ['สามทุ่มครึ่ง', 'สี่ทุ่ม', 'ห้าโมงเย็น'], answer: 0 }, { q: 'ถ้าเพื่อนป่วยควรแจ้งใคร', choices: ['เพื่อนข้างห้อง', 'ครูเวร', 'ไม่ต้องแจ้ง'], answer: 1 }, { q: 'ออกจากห้องต้องทำอะไร', choices: ['ปิดไฟและพัดลม', 'เปิดไฟทิ้งไว้', 'ล็อกประตูอย่างเดียว'], answer: 0 }] },
  { topic: 'ประวัติโรงเรียน', slides: [['วันแรก', 'โรงเรียนเริ่มรับนักเรียนรุ่นแรกในสมมติปีหนึ่ง'], ['ตึกเรียน', 'ตึกหลังแรกสร้างข้างสนามกีฬากลางโรงเรียน'], ['ต้นไม้ใหญ่', 'ต้นจามจุรีหน้าเสาธงปลูกโดยนักเรียนรุ่นแรก'], ['ประเพณี', 'ทุกปีมีงานราตรีส่งรุ่นพี่ที่กำลังจะจบ'], ['สรุป', 'เรื่องเล่านี้ส่งต่อกันมารุ่นต่อรุ่น']],
    keywords: ['รุ่นแรก', 'จามจุรี', 'งานราตรี', 'สนาม'],
    questions: [{ q: 'ต้นจามจุรีอยู่ที่ไหน', choices: ['หน้าเสาธง', 'หลังโรงอาหาร', 'ข้างหอพัก'], answer: 0 }, { q: 'งานราตรีจัดเพื่อใคร', choices: ['ครูใหม่', 'รุ่นพี่ที่กำลังจะจบ', 'ผู้ปกครอง'], answer: 1 }, { q: 'ตึกหลังแรกอยู่ข้างอะไร', choices: ['สนามกีฬา', 'สระน้ำ', 'ประตูโรงเรียน'], answer: 0 }] },
];

const ING = [['banana', 'กล้วย'], ['flour', 'แป้ง'], ['oil', 'น้ำมัน'], ['tea', 'ชา'], ['milk', 'นมข้น'], ['ice', 'น้ำแข็ง'], ['sausage', 'ไส้กรอก'], ['sauce', 'ซอส'], ['sugar', 'น้ำตาล']];
const DISHES = [
  { id: 'd1', name: 'กล้วยทอด', steps: ['banana', 'flour', 'oil'], price: 20 }, { id: 'd2', name: 'ชาเย็น', steps: ['tea', 'milk', 'ice'], price: 25 },
  { id: 'd3', name: 'ไส้กรอกทอด', steps: ['sausage', 'oil', 'sauce'], price: 20 }, { id: 'd4', name: 'ขนมหวาน', steps: ['flour', 'sugar', 'milk'], price: 15 },
];
const STALLS = ['ร้านกล้วยทอดข้างหอ', 'ร้านชาเย็นลมเย็น', 'ร้านของกินครูเอก', 'ร้านหอพักจุฬาพิลาส'];

const KRA = [
  { id: 'leaf', name: 'ใบตอง', color: '#3f8f4a', kind: 'leaf' }, { id: 'flr', name: 'ดอกชมพู', color: '#e8688a', kind: 'flower' }, { id: 'flw', name: 'ดอกขาว', color: '#f4f1e8', kind: 'flower' },
  { id: 'can', name: 'เทียน', color: '#f6e7a8', kind: 'candle' }, { id: 'rib', name: 'ริบบิ้นชมพู', color: '#f2a1b8', kind: 'ribbon' }, { id: 'sti', name: 'ธูป', color: '#8a5a3a', kind: 'stick' },
];
const COS = [
  { id: 'hat', name: 'หมวกสีทอง', color: '#e0b04a', kind: 'hat' }, { id: 'cap', name: 'ผ้าคลุมน้ำเงิน', color: '#2b3f8a', kind: 'cloth' }, { id: 'bow', name: 'โบว์ทอง', color: '#d9a640', kind: 'ribbon' },
  { id: 'jew', name: 'เครื่องประดับ', color: '#f2d27a', kind: 'flower' }, { id: 'sas', name: 'สายสะพายน้ำเงิน', color: '#26324f', kind: 'cloth' }, { id: 'shoe', name: 'รองเท้า', color: '#3a2a20', kind: 'leaf' },
];

const GARMENT = ['เสื้อ', 'กางเกง', 'ถุงเท้า', 'รองเท้า', 'เข็มขัด', 'หมวก', 'เนคไท', 'ผ้าพันคอ'];
const COLORS = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0', '#b07ad8'];

export function mockSpec(game, seed, o = {}) {
  const rng = new Rng((seed >>> 0) || 1);
  const diff = o.difficulty != null ? o.difficulty : 0.35;
  const own = !!o.own;
  switch (game) {
    case 'watch': {
      const T = rng.pick(TOPICS);
      return { durationSec: 30, params: { topic: T.topic, slides: T.slides.map(([title, line]) => ({ title, line })), keywords: T.keywords, questions: T.questions } };
    }
    case 'serve': {
      const menu = rng.shuffle(DISHES.slice()).slice(0, 3);
      const used = new Set(); menu.forEach((m) => m.steps.forEach((s) => used.add(s)));
      return { durationSec: 32, params: { stallName: o.stallName || rng.pick(STALLS), menu, ingredients: ING.filter(([id]) => used.has(id)).map(([id, name]) => ({ id, name })), customers: own ? 10 : 7, patience: Math.round(15 - diff * 4) } };
    }
    case 'craft': {
      const costume = o.kind === 'costume';
      if (o.xmas) return { durationSec: 28, params: { kind: 'tree', theme: { name: 'ต้นคริสต์มาสสีแดงและทอง', palette: ['#d02a38', '#e0b04a', '#2f7a3e'] }, pieces: [{ id: 'base', name: 'ต้นสน', color: '#2f7a3e', kind: 'base' }, { id: 'bal', name: 'ลูกบอลแดง', color: '#d02a38', kind: 'flower' }, { id: 'gld', name: 'ลูกบอลทอง', color: '#e0b04a', kind: 'flower' }, { id: 'grn', name: 'กิ่งสน', color: '#2f7a3e', kind: 'leaf' }, { id: 'rib', name: 'ริบบิ้นแดง', color: '#c4283a', kind: 'ribbon' }, { id: 'sta', name: 'ดาวทอง', color: '#f2d27a', kind: 'candle' }], slots: 9, rubric: { palette: 0.4, symmetry: 0.3, variety: 0.3 } } };
      const pal = costume ? ['#e0b04a', '#2b3f8a', '#d9a640'] : ['#e8688a', '#f4f1e8', '#3f8f4a'];
      return { durationSec: 32, params: { kind: costume ? 'costume' : 'krathong', theme: { name: costume ? 'ชุดราชาในตำนาน น้ำเงินและทอง' : 'ลอยกระทงสีชมพูหวาน', palette: pal }, pieces: costume ? COS : KRA, slots: costume ? 9 : 9, rubric: { palette: 0.4, symmetry: 0.3, variety: 0.3 } } };
    }
    case 'pattern': return { durationSec: 36, params: { beads: rng.shuffle(COLORS.slice()).slice(0, 4 + (diff > 0.5 ? 1 : 0)), rounds: 4, startLen: 3, label: o.label || 'ร้อยกำไลข้อมือ' } };
    case 'dash': return { durationSec: 26, params: { items: rng.shuffle(GARMENT.slice()).slice(0, 6).map((name, i) => ({ id: `g${i}`, name })), sequenceLen: 5, timeLimit: 26 } };
    case 'timing': return { durationSec: 20, params: { tries: 3, zone: 0.22, speed: 1, label: o.xmas ? 'รับลูกอมที่ซานต้าโยนลงมา' : o.sport ? 'ชักเย่อ: ออกแรงให้ตรงจังหวะ' : 'ปล่อยกระทงให้ตรงจังหวะลม' } };
    case 'rhythm': return { durationSec: 28, params: { lanes: 4, bpm: 96, notes: 26, label: o.sport ? 'เชียร์ลีดเดอร์ท่าหลักของสี' : 'การแสดงบนเวที' } };
    case 'track': return { durationSec: 24, params: { mode: o.mode || (rng.chance(0.5) ? 'camera' : 'sound'), speed: 1, band: 0.3 } };
    case 'sequence': return { durationSec: 28, params: { label: 'ตัดต่อวิดีโอบทส่งรุ่นพี่', clips: [['เปิดเรื่อง วันแรกที่เข้าโรงเรียน', 1], ['เพื่อนใหม่ในหอพัก', 2], ['สอบกลางภาคที่เหนื่อยที่สุด', 3], ['งานกีฬาสี', 4], ['วันรับประกาศนียบัตร', 5]].map(([label, order], i) => ({ id: `c${i}`, label, order })) } };
    case 'steps': return { durationSec: 30, params: { title: 'ทดลอง: สีของกะหล่ำปลีม่วง', hazard: 'ระวังน้ำร้อนและของมีคม', steps: [
      { prompt: 'ขั้นแรกควรทำอะไรก่อนเริ่มทดลอง', choices: ['สวมแว่นตานิรภัย', 'ชิมสารละลาย', 'ปิดไฟห้อง'], answer: 0 },
      { prompt: 'ต้องการสกัดสีจากกะหล่ำปลี ควรทำอย่างไร', choices: ['หั่นเป็นชิ้นเล็กแล้วแช่น้ำอุ่น', 'เผาให้ไหม้', 'แช่ในน้ำมัน'], answer: 0 },
      { prompt: 'เทน้ำสกัดลงแก้วอย่างช้าๆ จนถึงขีดที่กำหนด', choices: ['ได้', 'ได้', 'ได้'], answer: 0, hold: { label: 'กดค้างเพื่อเท ปล่อยเมื่อถึงขีด', target: 0.7, width: 0.18 } },
      { prompt: 'หยดน้ำส้มสายชูลงไป สีจะเป็นอย่างไร', choices: ['เปลี่ยนเป็นสีชมพู', 'ไม่เปลี่ยน', 'ใสไม่มีสี'], answer: 0 }] } };
    default: return { durationSec: 25, params: {} };
  }
}
