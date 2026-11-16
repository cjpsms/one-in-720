// Routine fields (docs/CONTRACT2.md): the choices the "focus of the term" card and the focus screen show.
export const ROUTINE_DEFAULT = { study: 'normal', food: 'normal', evening: 'balanced', snack: 'sometimes' };

export const FOCUS_FIELDS = [
  { key: 'study', label: 'การเรียน', choices: [
    { value: 'focus', label: 'ตั้งใจเต็มที่', sub: 'ความรู้ขึ้นเร็ว แต่เหนื่อยและเครียดกว่า' },
    { value: 'normal', label: 'ตามปกติ', sub: 'เรียนและทำการบ้านพอประมาณ' },
    { value: 'relax', label: 'ผ่อนๆ', sub: 'สบายใจ แต่เกรดมีโอกาสตก' } ] },
  { key: 'food', label: 'อาหาร', choices: [
    { value: 'cheap', label: 'ประหยัด', sub: 'ราว 90 บาทต่อวัน' },
    { value: 'normal', label: 'ปกติ', sub: 'ราว 135 บาทต่อวัน' },
    { value: 'treat', label: 'จัดเต็ม', sub: 'ราว 190 บาทต่อวัน' } ] },
  { key: 'evening', label: 'ช่วงค่ำที่หอ', choices: [
    { value: 'study', label: 'อ่านหนังสือ', sub: 'ความรู้ขึ้น แต่นอนดึกและเหงา' },
    { value: 'balanced', label: 'สมดุล', sub: 'อ่านบ้าง คุยบ้าง นอนตรงเวลา' },
    { value: 'social', label: 'อยู่กับเพื่อน', sub: 'เพื่อนและความสุขขึ้น' },
    { value: 'rest', label: 'พักผ่อน', sub: 'สุขภาพดีขึ้น นอนเร็ว' } ] },
  { key: 'snack', label: 'ขนมในคาบ (LINE)', choices: [
    { value: 'none', label: 'ไม่เลย', sub: 'ไม่เสี่ยงโดนจับ' },
    { value: 'sometimes', label: 'บางครั้ง', sub: 'เสี่ยงโดนจับ 10% ต่อครั้ง' },
    { value: 'often', label: 'บ่อย', sub: 'อิ่มและมีความสุข แต่เปลืองเงินและเสี่ยง' } ] },
];
