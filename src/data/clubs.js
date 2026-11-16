// The Tuesday ชุมนุม block: clubs a student picks from at the start of each term.
// Real club names and seat caps ("รับ N คน") are from DESIGN.md "Clubs" (cj's Canva page).
// Clubs with studentRun:true are the "เป็นที่ปรึกษาชุมนุม" ones with no printed name: the names below are
// INVENTED (PLACEHOLDER), the teacher is only an advisor. Real teacher names are never stored.
// area = which skill the club grows: math science language computer art music sport social reading service military.

const ALL = [1, 2, 3, 4, 5, 6];
const LOW = [1, 2, 3];
const HIGH = [4, 5, 6];

const club = (id, name, grades, seats, area, studentRun = false, extra = {}) => ({
  id, name, grades, seats, studentRun, area, ...extra,
});

export const CLUBS = [
  // all levels
  club('band', 'วงโยธวาทิต จภ.พล', ALL, 28, 'music'),
  club('library1', 'Library Club 1', HIGH, 15, 'reading'),
  club('perform', 'ชุมนุมศิลปะการแสดง', ALL, 15, 'art'),
  club('hs-prep', 'ติวเข้มเตรียมเรียนต่อ ม.ปลาย', HIGH, 24, 'social', true), // PLACEHOLDER name; cj: one unnamed club, ม.4-6 only, 24 seats
  club('all-football', 'ฟุตบอลเพื่อนสนิท', ALL, 25, 'sport', true), // PLACEHOLDER name
  club('all-guitar', 'กีตาร์และร้องเพลง', ALL, 12, 'music', true), // PLACEHOLDER name
  club('all-board', 'เกมกระดานและหมากกล', ALL, 12, 'math', true), // PLACEHOLDER name
  club('all-photo', 'ถ่ายภาพรอบโรงเรียน', ALL, 15, 'art', true), // PLACEHOLDER name

  // ม.1
  club('m1-math-goal', 'คณิตศาสตร์เพื่อเป้าหมาย', [1], 12, 'math'),
  club('m1-eng-fun', 'English for fun', [1], 12, 'language'),
  club('m1-math-fast', 'คณิตคิดเร็ว', [1], 12, 'math'),
  club('m1-thai-music', 'ดนตรีไทย', [1], 12, 'music'),
  club('m1-thai-history', 'ประวัติศาสตร์ไทย', [1], 12, 'social'),
  club('m1-nihongo', 'Nihongo roku nana', [1], 12, 'language'),
  club('m1-sci-sport', 'วิทยาศาสตร์การออกกำลังกาย', [1], 10, 'science'),
  club('m1-craft', 'งานประดิษฐ์จากวัสดุเหลือใช้', [1], 12, 'art', true), // PLACEHOLDER name

  // ม.2
  club('m2-math-life', 'Math for life ver.2', [2], 8, 'math'),
  club('m2-chinese', 'ภาษาและวัฒนธรรมจีน', [2], 10, 'language'),
  club('m2-math-drill', 'ตะลุยโจทย์คณิตศาสตร์', [2], 10, 'math'),
  club('m2-speaking', 'การพูดเพื่อนำเสนองาน', [2], 20, 'language'),
  club('m2-vocab', 'ต่อคำศัพท์ภาษาอังกฤษ', [2], 10, 'language'),
  club('m2-computer', 'Computer Project', [2], 12, 'computer'),
  club('m2-art', 'ศิลปะสร้างสรรค์', [2], 15, 'art'),
  club('m2-manga', 'วาดการ์ตูนและมังงะ', [2], 10, 'art', true), // PLACEHOLDER name
  club('m2-badminton', 'แบดมินตันเพื่อสุขภาพ', [2], 10, 'sport', true), // PLACEHOLDER name
  club('m2-video', 'ตัดต่อวิดีโอเบื้องต้น', [2], 12, 'computer', true), // PLACEHOLDER name

  // ม.3
  club('m3-math-test', 'Math test 67', [3], 10, 'math'),
  club('m3-reading2', 'รักการอ่าน 2', [3], 15, 'reading'),
  club('m3-theater', 'classroom theater', [3], 10, 'art'),
  club('m3-thai-skill', 'ทักษะภาษาไทยเพื่อการสื่อสาร', [3], 12, 'language'),
  club('m3-tutor', 'ติวเพื่อนก่อนสอบเข้า ม.4', [3], 10, 'math', true), // PLACEHOLDER name

  // ม.4
  club('m4-unity', 'unity', [4], 24, 'computer'),
  club('m4-drone', 'การบินโดรนเพื่อการท่องเที่ยวของชุมชน', [4], 6, 'computer'),
  club('m4-german-film', 'ภาพยนตร์เยอรมัน', [4], 12, 'language'),
  club('m4-eng-drama', 'English Drama', [4], 15, 'language'),
  club('m4-bio', 'Biology intensive 2', [4], 10, 'science'),
  club('m4-math-board', 'Math for Board game', [4], 10, 'math'),
  club('m4-crossword', 'Crossword', [4], 12, 'language'),
  club('m4-sufficiency', 'เศรษฐกิจพอเพียง', [4], 10, 'social'),
  club('m4-botany', 'พฤกศาสตร์', [4], 15, 'science'),
  club('m4-nsd1', 'นศท. ชุมนุมนักศึกษาวิชาทหาร 1', [4], 25, 'military'),
  club('m4-nsd2', 'นศท. ชุมนุมนักศึกษาวิชาทหาร 2', [4], 25, 'military'),
  club('m4-cook', 'ครัวหอพักเมนูง่ายๆ', [4], 12, 'service', true), // PLACEHOLDER name
  club('m4-chess', 'หมากรุกและโกะ', [4], 10, 'math', true), // PLACEHOLDER name
  club('m4-short-film', 'หนังสั้นฝีมือนักเรียน', [4], 12, 'art', true), // PLACEHOLDER name
  club('m4-cycling', 'ปั่นจักรยานรอบเมือง', [4], 15, 'sport', true), // PLACEHOLDER name
  club('m4-band', 'วงดนตรีสากลวงเล็ก', [4], 12, 'music', true), // PLACEHOLDER name

  // ม.5
  club('m5-phys-fight', 'ฟิสิกส์สัประยุทธ์1', [5], 5, 'science', false, { invite: true }), // cj: already selected for a competition
  club('m5-edu-board', 'บอร์ดเกมเพื่อการศึกษา', [5], 12, 'math'),
  club('m5-chem-plus', 'เคมีเพิ่มเติม', [5], 12, 'science'),
  club('m5-library2', 'Library Club 2', [5], 15, 'reading'),
  club('m5-yso', 'Young Social Innovators', [5], 12, 'social'),
  club('m5-nsd', 'นศท. ชุมนุมนักศึกษาวิชาทหาร 3', [5], 25, 'military'),
  club('m5-essay', 'เขียนเรียงความและบทความ', [5], 12, 'language', true), // PLACEHOLDER name
  club('m5-yoga', 'โยคะผ่อนคลายหลังเลิกเรียน', [5], 15, 'sport', true), // PLACEHOLDER name
  club('m5-coding', 'โค้ดดิ้งเพื่อนช่วยเพื่อน', [5], 12, 'computer', true), // PLACEHOLDER name
  club('m5-podcast', 'พอดแคสต์ชีวิตหอพัก', [5], 10, 'language', true), // PLACEHOLDER name
  club('m5-volley', 'วอลเลย์บอลสบายๆ', [5], 20, 'sport', true), // PLACEHOLDER name

  // ม.6
  club('m6-volunteer', 'จิตอาสา', [6], 10, 'service'),
  club('m6-dessert', 'ขนมนานาชาติ', [6], 10, 'service'),
  club('m6-stat', 'สถิติสำหรับโครงงาน', [6], 15, 'math'),
  club('m6-futsal', 'ฟุตซอล', [6], 15, 'sport'),
  club('m6-nsd', 'นศท. ชุมนุมนักศึกษาวิชาทหาร 4', [6], 25, 'military'),
  club('m6-interview', 'ซ้อมสัมภาษณ์และพอร์ตโฟลิโอ', [6], 12, 'social', true), // PLACEHOLDER name
  club('m6-tutoring', 'ติวน้องและติวเพื่อน', [6], 15, 'math', true), // PLACEHOLDER name
  club('m6-cafe', 'ชงกาแฟและเครื่องดื่ม', [6], 10, 'service', true), // PLACEHOLDER name
];

export function clubsFor(grade) {
  return CLUBS.filter((c) => c.grades.includes(grade));
}

export function clubById(id) {
  return CLUBS.find((c) => c.id === id) || null;
}
