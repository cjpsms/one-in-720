// Tunable numbers of the engine. "cj" = given by cj (see DESIGN.md), PLACEHOLDER = my guess to tune.
import { MIN } from '../config.js';

export const E = {
  // ---- calendar ----
  TERM_CYCLES: 9, // PLACEHOLDER: 9 cycles of 14 days per term (CONTRACT.md)
  MIDTERM_CYCLE: 5, // PLACEHOLDER (DESIGN.md: cycle 5 = midterm, cycle 9 = final)
  ALLOWANCE_EVERY: 30, // cj: the allowance comes monthly
  // periods 1..8 (cj's real timetable)
  PERIODS: [
    [MIN(8, 30), MIN(9, 20)], [MIN(9, 20), MIN(10, 10)], [MIN(10, 20), MIN(11, 10)], [MIN(11, 10), MIN(12, 0)],
    [MIN(13, 0), MIN(13, 50)], [MIN(13, 50), MIN(14, 40)], [MIN(14, 50), MIN(15, 40)], [MIN(15, 40), MIN(16, 30)],
  ],
  HOMEROOM: MIN(7, 45),

  // ---- player stats (all 0-100 unless noted) ----
  START: { health: 85, energy: 75, stress: 25, fullness: 15, peer: 15 }, // PLACEHOLDER
  FX_SCALE: 4, // PLACEHOLDER: evening.js and free-time actions use small numbers; multiplied to the 0-100 scale
  FULLNESS_START_OF_DAY: 12,
  HUNGER_PER_PERIOD: 6, // PLACEHOLDER: fullness lost per class period
  HUNGRY_BELOW: 22,
  // what one class period gives, by stance (effort units, 0..1) and its costs
  STANCE_UNIT: { focus: 1.0, normal: 0.45, relax: 0.08 },
  STANCE_ENERGY: { focus: -3.5, normal: -2.5, relax: -1.2 },
  STANCE_STRESS: { focus: 0.4, normal: 0.25, relax: -0.1 },
  STANCE_TRUST: { focus: 0.35, normal: 0.12, relax: -0.1 }, // closeness to the teacher per period
  SINGLE_OUT: { focus: 0.45, normal: 0.4, relax: 0.35 }, // PLACEHOLDER: when the teacher snaps in the player's class, the chance that they pick on the player
  STANCE_DEFY: { focus: -0.04, normal: 0, relax: 0 }, // adds to the room's defiance
  LINE_BUFF_UNIT: 0.2, // PLACEHOLDER: extra effort unit while the LINE-shop buff lasts
  // effort -> marks. A day is worth Z points on the same scale as an NPC's diligence (1 = a very diligent student).
  CLASS_Z: 3.3, // PLACEHOLDER (balance.test.js)
  CLASS_BASE: 0.65, // PLACEHOLDER: the effort unit that counts as zero
  STUDY_Z: 3.2,
  STUDY_BASE: 0.46,
  KNOWLEDGE_OFFSET: 0.7, // PLACEHOLDER: a normal player shows about 50 knowledge
  STUDY_DAY_CAP: 8,
  WEEKEND_STUDY_Z: 0.5,
  TALENT_SD: 0.45, // PLACEHOLDER: each subject suits the player a bit differently
  KNOWLEDGE_SCALE: 18, // knowledge stat = 50 + 18 * (z + offset), clamped to 0-100
  TRUST_PERF: 0.1, // teacher-trust bonus on marks (cj: "small GPA bonus")
  TERM_NOISE: 0.3, // same as cohort.js yearPerf noise

  // ---- sleep, health, stress ----
  WAKE_ENERGY: { base: 22, perSleepHour: 7.5, perStress: 0.2 },
  STRESS_NIGHT: { base: 6.5, recover: 0.12, recoverLow: 0.22, around: 30, perTask: 0.6 }, // PLACEHOLDER (recover: how strongly stress is pulled back to 'around' every night)
  STRESS_SNAP: 92, // above this the player snaps (สลิ้งแตก)
  SICK_BELOW: 35, // PLACEHOLDER: low health can make you ill
  HEALTH_NIGHT_BASE: -1.4, // PLACEHOLDER: wear and tear; sleep and exercise must pay for it
  STRESS_SLOT_SCALE: 3, // PLACEHOLDER: same for the stress effects of slots
  HEALTH_SLOT_SCALE: 2, // PLACEHOLDER: health effects of free-time / evening slots are scaled by this instead of FX_SCALE
  HEALTH_SET: 80, // PLACEHOLDER: the body drifts back toward this every night ...
  HEALTH_PULL: 0.08, // ... by this share of the gap
  HEALTH_STRESS: 0.04, // PLACEHOLDER: health lost every night per stress point above 50
  PEER_DECAY: 0.08, // PLACEHOLDER: friendships fade a little every night
  HEALTH_HUNGER: 2.0, // lost if the day average fullness stayed low
  ITEM_LOSS_CHANCE: 0.012, // PLACEHOLDER: a belonging goes missing (cj: "items can be lost")

  // ---- money ----
  MEAL_BUDGET: { breakfast: 35, lunch: 45, dinner: 50 }, // PLACEHOLDER: default cart size
  PARENT_CALL_BELOW: 150,

  // ---- school simulation ----
  CLOSE: 55, // "close to the teacher" if closeness >= this (0-100)
  PERIOD_DECAY: 0.82, // teacher pressure kept from one period to the next (PLACEHOLDER)
  NIGHT_DECAY: 0.4,
  PLAYER_MISS_K: 3, // PLACEHOLDER: pressure when the player fails to hand in work (MISS_K for the NPCs)
  DEFY_K: 52, // PLACEHOLDER: pressure per period = K * room defiance * share of students not close
  MISS_K: 9, // PLACEHOLDER: pressure per close student who did not hand in work
  PRESSURE_BASE: 55, // snap threshold = BASE + SPAN * patience (0..1)
  PRESSURE_SPAN: 65,
  SNAP_RESET: 0.2,
  SNAP_STRESS: 3,
  SNAP_STRESS_TARGET: 9,
  TASK_RATE: 0.03, // PLACEHOLDER: chance per (teacher, grade, teaching day) of a new task
  TASK_KEEP_DAYS: 20,
  SICK_BASE: 0.006,
  NPC_SHOCK: 0.002, // PLACEHOLDER: chance per NPC per day of a stress shock (bad news, a fight)
  NPC_SNAP: 82, // an NPC whose stress passes this has a meltdown
  LINE_NPC_RATE: 0.012, // PLACEHOLDER: share of NPC students ordering from the LINE shop per day
  LINE_NPC_CANCEL: 0.3,
  NPC_FOOD: [95, 140], // PLACEHOLDER: NPC daily food spending

  // ---- events (chance that a place offers an event today) ----
  EVENT_CHANCE: { dorm: 0.08, class: 0.07, canteen: 0.06, weekend: 0.3, home: 0.6 },
  TASK_TRUST_OK: 3,
  TASK_TRUST_FAIL: -7,
  TASK_TRUST_ITEMS: -5,

  // ---- routine mode (docs/CONTRACT2.md): every number here is a PLACEHOLDER tuned by test/balance.test.js ----
  EVENT_CHANCE_ROUTINE: { dorm: 0.0052, class: 0.0046, canteen: 0.0041, weekend: 0.0155, home: 0.08 },
  EVENT_DAY: { school: 0.0085, weekend: 0.02, home: 0.014 }, // PLACEHOLDER: chance that a day has one random event (at most one a day, never on the day of another stop)
  SCOLD_PENDINGS_PER_YEAR: 5, // player-targeted snaps that stop the game per school year; the others are resolved by themselves (was 1: cj wanted to see them)
  // ---- choice scenes (content/scenes*.js, engine/scenes.js): odds are shown as % and rolled, all PLACEHOLDER ----
  BEAT: { SCHOOL: 0.08, WEEKEND: 0.1, CATCHUP_AFTER: 4, CATCHUP_STEP: 0.13, SCENE_SHARE: 0.85, RECENT_PENALTY: 0.05 }, // chance of a story beat per day, +step per day over CATCHUP_AFTER days without one; share of beats taken from the new scenes (the rest from events.js)
  FILLER_AUTO: true, // lab / club / lecture filler mini games resolve by themselves with a one-line result (cj: too many mini games); festivals and contests stay playable
  // ---- conduct and discipline (engine/conduct.js) ----
  CONDUCT: {
    DECAY_PER_DAY: 0.1, // points lost per day
    TERM_KEEP: 0.6, // share of points kept at a term end
    STAGES: [3, 6, 10, 14], // points for: name noted, dorm punishment, probation, disciplinary hearing
    PROBATION_MULT: 1.5, // offences count more while on probation
    PROBATION_CLEAN_DAYS: 25, // clean days that end probation
    SKIP_CAUGHT: 0.25, // chance a skipped class is noticed
    HEARING_EXPEL_BASE: 0.3, // chance of expulsion at a hearing before the modifiers
  },
  MONEY_EMERGENCY_BELOW: 60, // a pending appears when the balance is under this and the parents cannot be asked any more
  MONEY_EMERGENCY_GAP: 20, // days between two emergencies
  MONEY_EMERGENCY_LOAN: 150,
  PEER_RELIEF: 1.2, // PLACEHOLDER: stress relief per night from good friendships (bonds matter a little for happiness)
  MID_CHECK_HEALTH: 45, // a mid-term "focus" pending appears if health is under this ...
  MID_CHECK_STRESS: 72, // ... or stress over this ...
  MID_CHECK_KNOWLEDGE: 38, // ... or knowledge under this at the midterm

  // ---- clubs ----
  CLUB_FILL: 0.8, // NPC students fill at most this share of the seats before the player picks

  // ---- activities (docs/CONTRACT3.md): every number is a PLACEHOLDER unless marked cj ----
  MINIGAMES_PER_YEAR: 6, // filler plays only; with FILLER_AUTO they resolve by themselves (cj 2026-11-16: too many mini games). Festivals/contests stay playable
  ACT: {
    SAT_Z: 0.0016, // marks z gained per Saturday period at effort unit 1 (everyone's subjects)
    SAT_MATCH_Z: 0.006, // extra z on a subject of the same kind as the Saturday subject
    SAT_NPC_ACC: [0.15, 0.15], // NPC Saturday group: acc += a + b * clamp(diligence, -1, 1)
    DIL_SCALE: 0.08, // study units are scaled by 1 + DIL_SCALE * (diligence - 50) / 50
    DIL_DRIFT: 0.03, // share of the gap to the target that diligence closes each school day
    DIL_STANCE: { focus: 8, normal: 0, relax: -8 },
    MG_KNOW_SCALE: 0.25, // knowledge points of a play fx count this much (they are tiny next to a term of classes)
    LECTURES_PER_TERM: [1, 3], // cj follow-up: 2-3 lectures a term in term 1 (term 2 has the fair, Christmas and the show)
    LECTURE_THREE_CHANCE: 0.4,
    SPECIALS_PER_TERM: 1, // 2 a year
    FAREWELL_PER_YEAR: 1, // one term of the year gets a farewell
    AWARD_EXPECTED: 0.1, // chance the player has 4.00 (only used to size the filler plays)
    SPORT: { SIGNUP_CYCLE: 3, PRACTICE_CYCLES: [4, 5], PRACTICE_BLOCKS: 7, DAY_CYCLE: 6 },
    FAIR_CYCLE: 2, // cj calendar fix: the Loy Krathong fair is in term 2, cycle 2 (mid November)
    XMAS_CYCLE: 4, // Christmas day: term 2, cycle 4, a school day
    XMAS_DIC: 3,
    XMAS_PLAYS: 2, // decorate the tree (craft) + catch the candy (timing) // decorate the tree (craft) + catch the candy (timing)
    XMAS_HIT: 0.3, // cj: chance that Santa's candy hits the player on the head
    FAIR_PLAYS: 3, // stall/shopping + one contest + float (a second contest is optional)
    SHOW_PLAYS: 2, // one rehearsal play + show night
    REHEARSAL_PLAY_CYCLES: [6],
    FRESHER_PLAYS: 4, // plays among the 9 freshers blocks
    FRESHER_YEARS: [1, 4],
    CONTESTS_MAX: 1,
    CONTEST_RIVALS: [8, 20],
    SKIP_CAUGHT: 0.5, // cj
    SKIP_AUTO: { focus: 0, normal: 0.08, relax: 0.3 }, // auto mode: chance the player tries to skip a lecture
    CAUGHT_TRUST: -6, // PLACEHOLDER teacher trust points lost when caught skipping
    TRUST_GAIN: 4,
    SATURDAY_FILLER_SHARE: 0.34, // share of lab/club plays put on a Saturday when one fits
    SHOW_PREP_GAIN: 0.14, // pl.showPrep (0..1) gained per rehearsal at an average play
    NIGHT_SLEEP_HOURS: 7.0, // fair night and show night
    FAREWELL_PULL: 0.7, // closeness to the old teacher is pulled this much toward the average
  },

  // ---- epidemics, exams, Christmas, sports day (CONTRACT3 sections 11-12): PLACEHOLDER unless marked cj ----
  EPIDEMIC: true, // switch: false = no outbreaks (tests)
  EPI: {
    P_COUNT: [0.45, 0.35, 0.2], // outbreaks in a school year: 0 / 1 / 2 (mean 0.75)
    SEED_SICK: 5, // students who start an outbreak
    SPREAD: 0.16, // daily infection chance scale (times R, times local sick share mix)
    SUSPEND_SHARE: 0.25, SUSPEND_DAYS: [3, 5], END_SHARE: 0.02,
    PLAYER_BASE: 0.22, // player exposure scale
  },
  MISSED_EXAM_CREDIT: 0.4, // sick on an exam day: the missed part counts this much
  SICK_BEFORE_EXAM_PENALTY: 0.15, // sick within the 3 days before: this share of the exam component is lost (3 days = 1/3 of it, 1 day = all of it)
  EXAM_PERF: 0.35, // size of the exam component in the term performance (same scale as 0.4 * z)
  SPORT_STUDY_DRAG: 0.9, // study units and diligence while signed up (focus halves the drag)
  SPORT_CLOSE_PRACTICE: 1.5,
  SPORT_CLOSE_DAY: 5,
  SPORT_ENTRY_POINTS: 4, // base team points per event of a colour (before NPC abilities)

  // ---- friends, companions, crush (CONTRACT3 section 10): PLACEHOLDER unless marked cj ----
  FRIENDS_MAX: 15,
  FRIEND_DECAY: 0.004, // share of the gap above 15 lost every night
  FRIEND_ROOMMATE_GAIN: 0.12,
  ALONE_MEET_CHANCE: 0.25,
  COMPANION_SCORE_BONUS: 0.08, // score bonus of a fully close companion in the fair contests and the float
  CRUSH_P: 0.8, // cj: chance per 2-year window that someone confesses
  CRUSH_WINDOW_YEARS: 2, // cj
  CRUSH_SEX_MIX: { same: 0.1, opposite: 0.9 },
  CRUSH_SAME_SEX_IF_TOP3_SAME: 0.7, // cj: top 3 friends all the player's sex -> the confessor is the player's sex with this chance
  CRUSH_FESTIVAL_WEIGHT: 12,
  CRUSH_ASK_DAYS: 10,
  PARTNER_STUDY_DRAG: 0.85, // study units and diligence are multiplied by this while there is a partner ...
  PARTNER_STUDY_DRAG_FOCUS: 0.97, // ... unless the routine study is 'focus'
  PARTNER_STRESS: 0.8, // stress relief per night
  PARTNER_FRIEND_GAIN: 1.5, // friends' closeness per cycle
  PARTNER_TRUST_GAIN: 0.6, // teacher trust per cycle
  PARTNER_FOCUS_DAYS: 60, // 'ขอเวลาโฟกัสเรียน' at the check-in lightens the study drag for this long
  BREAKUP_PER_TERM: 0.12,
  BREAKUP_RELAX: 0.06,
  BREAKUP_NO_DATE: 0.06,
  BREAKUP_NO_DATE_DAYS: 25,
  HEARTBREAK_TERMS: 2,
  HEARTBREAK_STRESS: 0.3,

  // ---- ending text ----
  QUIT_FEE_PER_TERM: 6300, // cj: 12,600 per year, split per term
};

// The routine fields (study / food / evening / snack). Meaning of each value, PLACEHOLDER numbers.
export const R = {
  DEFAULT: { study: 'normal', food: 'normal', evening: 'balanced', snack: 'sometimes' },
  // food: baht per day (about 90 / 135 / 190) and how it is split between the three meals
  FOOD_BUDGET: { cheap: 90, normal: 135, treat: 190 },
  MEAL_SPLIT: { breakfast: 0.22, lunch: 0.39, dinner: 0.39 },
  FOOD_MEAL_FX: { cheap: { stress: 0.4, health: -0.25 }, normal: { stress: 0, health: 0 }, treat: { stress: -0.6, health: 0.25, energy: 1 } },
  // study: class stance, how often a class is skipped, how reliably homework is done
  STUDY_STANCE: { focus: 'focus', normal: 'normal', relax: 'relax' },
  STUDY_SKIP: { focus: 0, normal: 0, relax: 0.05 },
  STUDY_HOMEWORK: { focus: 1, normal: 0.9, relax: 0.5 },
  // evening: the 19:00-00:00 plan. awake until (bed time + slots of 30 min); study_alone slots turned into phone by the study field
  EVENING_AWAKE: { study: 0, balanced: -1, social: 0, rest: -3 },
  STUDY_IDLE: { focus: 0, normal: 0.12, relax: 0.75 }, // share of study slots that become phone time
  // snack: chance per school day with a LINE class (rooms next to 222) tomorrow that an order is placed
  SNACK_RATE: { none: 0, sometimes: 0.12, often: 0.4 },
  SNACK_CANTEEN_RATE: { none: 0, sometimes: 0.1, often: 0.3 }, // grades without LINE classes: a canteen snack in free time
};

// the dorm evening uses src/evening.js; in the free-time plan the first slot can start at most here
export const FREE_FROM = MIN(13, 0);
