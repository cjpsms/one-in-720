// Every number from cj's description lives here, with where it came from.
// Items marked PLACEHOLDER are my guesses and are meant to be tuned.

// minutes since midnight
export const MIN = (h, m = 0) => h * 60 + m;

export const SCHOOL = {
  // x/1 .. x/n rooms per grade (the "_KP" rooms are another school, not simulated)
  roomsPerGrade: { 1: 4, 2: 4, 3: 4, 4: 6, 5: 6, 6: 6 },
  roomSize: 24,
  seats4: 144, // ม.4 takes 144 people from anyone
  maleShare: 0.5, // PLACEHOLDER
};

// How the GPA is spread over the rank in a grade (cj: rooms follow GPA).
// share = fraction of the grade, hi..lo = GPA range inside that band.
export const GPA_BANDS = {
  // ม.1-3, 96 students: 4.00 = room 1 + half of room 2; 3.8-3.9 = rest of room 2 + room 3; room 4 = 3.50 up to 3.79
  lower: [
    { share: 36 / 96, hi: 4.0, lo: 4.0 },
    { share: 36 / 96, hi: 3.99, lo: 3.8 },
    { share: 24 / 96, hi: 3.79, lo: 3.5 },
  ],
  // ม.4-6, 144 students: 4.00 = rooms 1,2 + a third of room 3; 3.8-3.9 = rest of room 3 + room 4; rooms 5-6 = 3.4 or less (floor 2.60 is a PLACEHOLDER)
  upper: [
    { share: 56 / 144, hi: 4.0, lo: 4.0 },
    { share: 40 / 144, hi: 3.99, lo: 3.8 },
    { share: 48 / 144, hi: 3.4, lo: 2.6 },
  ],
};

// Chance to pass the ม.4 gate from the ม.3 GPA. cj: "3.79 high, 3.5 still has a chance". Points are PLACEHOLDERS.
export const GATE_CURVE = [
  [3.4, 0.03],
  [3.5, 0.2],
  [3.65, 0.5],
  [3.79, 0.85],
  [3.9, 1.0],
];

// Chance per student per year to drop out, as "x in 96" (cj). Same for 1&4, 2&5, 3&6.
export const DROPOUT_PER_96 = { 1: 1, 2: 0.2, 3: 0.05, 4: 1, 5: 0.2, 6: 0.05 };

// Chance that a 4.00 student in ม.3 leaves for MWIT / KVIS / วมว. (cj allowed it, the rate is a PLACEHOLDER)
export const LEAVE_ELITE_RATE = 0.04;

export const MONEY = {
  richPer96: 2.5, // cj: very rich about 2-3 in 96
  spoiledPer96: 10, // cj: spoiled about 10 in 96
  normal: [800, 2000], // cj
  spoiled: [2001, 10000], // cj: above normal is "spoiled"
  rich: [10001, 20000], // cj: above 10,000 is "rich", max about 20,000
  askDivisor: 10, // cj: you may ask for day-1 amount / 10
  refuseBelow: 20, // cj: 80, 40, 20, below 20 they refuse
  autoTransferBelow: 5000, // cj: rich parents transfer by themselves under 5,000
  perDay: 135, // cj: allowance, paid monthly
};

// Dorms (cj). outBy = must be out of the dorm in the morning, bed = go upstairs and lights off.
export const DORMS = {
  g1: { name: 'หอพักภรณ์คุณาศัย', sex: 'F', grades: [1, 4], cap: 10, outBy: MIN(7, 10), bed: MIN(23) },
  g2: { name: 'หอพักวสัยคุณาศักดิ์', sex: 'F', grades: [2, 5], cap: 10, outBy: MIN(7, 10), bed: MIN(23) },
  g3: { name: 'หอพักลักษณานุสรณ์', sex: 'F', grades: [3, 6], cap: 10, outBy: MIN(7, 10), bed: MIN(23) },
  bPhi: { name: 'หอพักจุฬาพิลาส', sex: 'M', grades: [1, 2], cap: 10, outBy: MIN(6, 30), bed: MIN(22) },
  bLin: { name: 'หอพักจุลินทิรา', sex: 'M', grades: [4, 5], cap: 10, outBy: MIN(6, 30), bed: MIN(22) },
  bLak: { name: 'หอพักจุฬาลักษณ์', sex: 'M', grades: [3, 6], cap: 6, outBy: MIN(7, 0), bed: MIN(23), lowest: true },
};

export const DORM_DAY = {
  open: MIN(15, 30),
  checkIn: MIN(18),
  assembly: MIN(19),
  eveningStart: MIN(19), // cj: 19:00-00:00 at the dorm, do anything
  eveningEnd: MIN(24),
  getReady: 45, // PLACEHOLDER: minutes between waking and being out of the dorm
};
