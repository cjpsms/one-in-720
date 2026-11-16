# CONTRACT: how the parts of "1 ใน 720" fit together

Read first: `~/program/one-in-720/DESIGN.md` (the full game spec from cj, wins on game rules), `~/claude/projects/one-in-720/LOG.txt` (cj's own words, round by round), and this file (wins on code interfaces).
The game: a web life sim of cj's boarding school. You are 1 of 720 students (ม.1 to ม.6, 6 years), the whole school is simulated day by day, the player makes choices about meals, classes, friends, the dorm evening, money, shops.

## 0. Rules for every agent
1. Plain JavaScript ES modules. No build step, no npm packages, no TypeScript. Must run in node 22 (tests) and in a browser (ES modules over http).
2. Randomness: only `Rng` from `src/rng.js` (never `Math.random`). All game state must be JSON-serializable (no Map, Set, class instances, functions in saved state).
3. UI text is Thai, plain text, NO emoji anywhere. Code, identifiers and comments are English.
4. Own only the files listed for you in section 1. Never edit another owner's file. If you need a change elsewhere, append a note to `docs/REQUESTS.md` (who, what, why) and continue with a stub or workaround.
5. Never write real teacher names (from the timetable PDF) into any file. Teachers in the game are fictional.
6. Tests: each owner adds a test script under `test/` (own file name), runnable as `node test/<file>`, exit code 1 on failure. Run it before you report.
7. Numbers that are guesses go in config objects, marked `PLACEHOLDER`, so cj can tune them. Numbers cj gave must be marked with their source ("cj").
8. Final report to the main agent, under 250 words: files written, deviations from this contract, tests run and result, open problems.
9. The project dir is `~/program/one-in-720/` (not a git repo; do not run git). Static server: `node serve.js` serves it on http://127.0.0.1:4026 .

## 1. File ownership
| Agent | Owns |
|---|---|
| T1 timetable ม.1-3 | `src/data/timetable/m1.json`, `m2.json`, `m3.json`, `scripts/check-timetable.mjs` |
| T2 timetable ม.4-5 | `src/data/timetable/m4.json`, `m5.json` |
| T3 timetable ม.6 | `src/data/timetable/m6.json` |
| C content | `src/data/subjects.js`, `clubs.js`, `electives.js`, `teachers.js`, `src/content/events.js`, `src/content/tasks.js`, `test/content.test.js` |
| S shops | `src/data/shops.js`, `src/economy/shops.js`, `test/shops.test.js` |
| E engine | `src/engine/*.js`, `test/engine.test.js` |
| U1 ui shell | `index.html`, `css/base.css`, `src/ui/app.js`, `src/ui/registry.js`, `src/ui/api.js`, `src/ui/mock-engine.js`, `src/ui/screens/scene.js`, `src/ui/screens/status.js`, `src/ui/screens/classplan.js` |
| U2 ui screens | `css/screens.css`, `src/ui/screens/shop.js`, `plan.js`, `termstart.js`, `lineorder.js` |
| main | `docs/`, `serve.js`, `package.json`, `demo.js`, existing core `src/{rng,config,cohort,rooms,sim,dorm,money,evening}.js`, `test/run.js`, integration |

Existing core (read it): `rng.js` (Rng: float, int, chance, pick, gauss, shuffle), `config.js` (all of cj's numbers; SCHOOL, GPA_BANDS, GATE_CURVE, DROPOUT_PER_96, MONEY, DORMS, DORM_DAY), `cohort.js` (makeStudent, makeOutsider, drawWealth, yearPerf), `rooms.js` (gpaByRank, roomByRank, scoreYear, placeRooms, standing, gateProb), `sim.js` (createSchool, yearStep: the year-level school), `dorm.js` (dormKeyOf, assignDorms), `money.js` (askParents, autoTransfer, monthlyAllowance, resetAsks), `evening.js` (ACTIONS, evaluateEvening, SLOT=30).

## 2. Data schemas

### 2.1 Timetable `src/data/timetable/m{grade}.json`
```json
{
  "grade": 1,
  "hoursPerWeek": 37,
  "rooms": {
    "1": { "mon": [cell x8], "tue": [cell x8], "wed": [...], "thu": [...], "fri": [...] }
  },
  "teachers": { "m1-A": { "codes": ["ค21102","ค21202"], "foreign": false } }
}
```
Each day is an array of exactly 8 cells (period 1..8, 08:30-09:20 ... 15:40-16:30). A cell is one of:
- `null` (free period)
- `{ "code": "ค21102", "loc": "218", "tk": "m1-A" }` a subject. `loc` is the text under the teacher name exactly as printed (218, 111, COM3, ศ.กีฬา 4, สนาม 2, นาฏศิลป์, ฝึกงาน 3, แนะแนว 2 ...).
- `{ "act": "ลส/ยว" }` activity block. act is one of: "ลส/ยว", "ชุมนุม", "ส.การอ่าน", "ชน./นศท.", "บพ./นศท.", "พก. 2" (elective block, optional `"group": "G1"|"G2"|"G3"` when the cell says พก. 2_G1 etc., otherwise group "all"), "ภาษาที่ 2" (second language by group).
- แนะแนว (guidance) is a subject cell: `{ "code": "แนะแนว", "loc": "แนะแนว 2", "tk": "m1-B" }`.
`tk` is an anonymous per-grade teacher key: "m{grade}-A", "m{grade}-B", ... assigned in order of first appearance within the grade. The same real teacher gets the same key across all rooms of that grade. `foreign: true` when the printed name was written in English letters. NEVER store real names.
Rooms: ม.1-3 have rooms "1".."4", ม.4-6 have rooms "1".."6". Skip every "_KP" page (another school). Class code letters: copy the code exactly as printed (Thai letter + digits, e.g. ค21102, ว21203, ส21106, ศ21103, พ21104, ง21101, อ21202). If a glyph is unclear (ส/ศ/ว), use the bottom table "วิชาที่เรียน" and the room name to decide.
Checks each grid must pass: (a) number of non-null cells = hoursPerWeek (37 for ม.1, ม.2, ม.4, ม.5; 33 for ม.3; 25 for ม.6); (b) per-code counts equal the counts in the printed "วิชาที่เรียน" table under the grid; (c) every grade/room present.
Source PDF: `/home/cj/.claude/uploads/3f77f74d-d086-460a-bbef-de65c8eb349c/77d5858c-StudentM1-6.pdf` (18 pages, 2 classes per page; read with the Read tool, `pages` parameter). Page map: p1 ม.1/1, 1/2 | p2 1/3, 1/4 | p3 1/1_KP(skip), 2/1 | p4 2/2, 2/3 | p5 2/4, 2/1_KP(skip) | p6 3/1, 3/2 | p7 3/3, 3/4 | p8 3/1_KP(skip), 4/1 | p9 4/2, 4/3 | p10 4/4, 4/5 | p11 4/6, 4/1_KP(skip) | p12 5/1, 5/2 | p13 5/3, 5/4 | p14 5/5, 5/6 | p15 5/1_KP(skip), 6/1 | p16 6/2, 6/3 | p17 6/4, 6/5 | p18 6/6, 6/1_KP(skip).

### 2.2 Subjects `src/data/subjects.js`
`export const SUBJECTS = { "ค21102": { th, kind, roomKind, short } , ... }` and `export function subjectOf(code)` (falls back to a generic entry from the code letter). kind in: thai, math, science, physics, chemistry, biology, earth, computer, social, history, religion, english, foreignlang, art, music, dance, health, pe, work, guidance, project, other. Use the decode table in DESIGN.md ("Subject decode"); unknown codes get a best guess with `guess: true`. Also `export const ACTIVITY_NAMES` for the activity blocks and `export function creditsFor(periodsPerWeek)` (0.5 credit per period per week per term).

### 2.3 Clubs, electives, teachers (owner C)
- `clubs.js`: `export const CLUBS = [{ id, name, grades:[1..6], seats, studentRun, area }]`, `clubsFor(grade)`. Real club names are in DESIGN.md ("Clubs"); fill unnamed ones as student-run clubs with invented names.
- `electives.js`: parse the 100 names from `ELECTIVES.md` into `ELECTIVES = [{ id, name, area, level: 'low'|'high'|'any' }]` (ต้น=low, ปลาย=high, ทุก=any), `electivesFor(grade)` (พก. exists for grades 1,2,4,5,6; none for 3).
- `teachers.js`: `export function makeTeachers(rng, teacherKeys)` -> `{ [key]: { key, name, sex, foreign, archetype, personality: { patience, strictness, warmth, humor, forgiveness } } }` with fictional Thai names (nicknames style: ครูมินท์, ครูเอก ...) and a few archetypes. PLACEHOLDER: cj will describe each teacher's personality tomorrow, so keep archetypes data-driven in one table.
- `events.js`: `export const EVENTS = [...]`, `export function pickEvent(ctx, rng)` (ctx: grade, place 'dorm'|'class'|'canteen'|'home'|'weekend', stats, day). Each event: `{ id, grades:[min,max], places:[...], weight(ctx)->number, title, text(ctx)->string, options:[{ id, label, sub?, apply(ctx, rng)->{ fx:{health,stress,energy,knowledge,peer,teacherTrust,money}, log:string, ending?:string } }] }`. Write 25+ school-life events (exams, group work, fights with friends, being teased "ล้อ", teacher calls you, illness, flu going around, homesick, lost belongings, helping someone, rumours, dorm roommates, going home, a friend borrows money, stress meltdown "สลิ้งแตก" ...). Pure functions of ctx and rng.
- `tasks.js`: `export function makeTask(rng, { teacher, subject, grade, day })` -> `{ id, name, kind, dueIn, effort, requiredItems:[coopItemId...] }` for assignments the teacher sets (poster needs A3 + coloured paper, glue gun, scout uniform, print photos ...). PLACEHOLDER: cj will describe assignments tomorrow.

### 2.4 Shops (owner S) `src/data/shops.js` and `src/economy/shops.js`
Data (cj's exact menus and prices are in DESIGN.md "Canteen: 10 shops plus a LINE shop" and "Co-op and required items"): 10 canteen shops + LINE shop + co-op + print room. Item shape: `{ id, shopId, name, price, fill, energy?, mealsAvailable:['breakfast','lunch','dinner'], seasons?:[...], options?:[{ key, label, multi?:bool, max?:n, choices:[{ value, label, priceDelta }] }], fx:{ fullness, energy, health, stress, speaking? }, tags:[] }`.
API in `src/economy/shops.js` (all pure except through the passed state, deterministic with the passed rng):
- `createShopState(rng)` -> JSON: crepe subplot, LINE orders/spare stock, co-op stock.
- `listShop(shopState, { mode:'meal'|'coop'|'print'|'canteen', meal?, season:'hot'|'cool'|'cold', minute, student, inventory })` -> `[{ id, name, items:[{ id, name, price, fill, note, options?, available, reason? }] }]` ready to put in a `shop` pending (section 3).
- `buy(shopState, student, { shopId, itemId, qty?, options? }, ctx, rng)` -> `{ ok, reason?, price, fx, notes:[string], giveItems?:[{itemId,qty}] }` (does NOT change student.money; the engine does). Handles smoothie price steps, free cheese, crepe discounts and the weekly free crepe, extrovert/introvert speaking bonus.
- `lineMenu(shopState, ctx)`; `placeOrder(shopState, student, itemId, forDay)` -> order; `cancelOrder(shopState, orderId)`; `lineConsume(shopState, student, { itemId, orderId? }, ctx, rng)` -> `{ ok, reason?, price, fx, caught }` (ctx: day, period, loc, teacherKey, afternoonScience). Walk-up purchase only for pickled egg / pickled salmon / instant noodles from cancelled-order spare stock, gone in afternoon science periods. Only possible when the class is in a room next to 222 (221 or 223). 10% caught (config constant).
- `crepeFund(shopState, student, amount)`, `nightly(shopState, day, rng)` (spare stock reset, crepe weekly tick, 85% rich).
- `coopItems()`; print: `printCost(pages)` = 2 baht per page and paper must be bought first.

## 3. Engine API (owner E, files `src/engine/*.js`, entry `src/engine/index.js`)
```js
import { createGame, loadGame } from './engine/index.js';
const game = createGame({ seed });      // new life: a random student in ม.1 becomes the player
game.pending            // the decision the UI must show now (see below); null never, even at the end (an ending scene stays)
game.view()             // status snapshot for the always-visible panel
game.act(payload)       // answer the current pending; returns { log:[{t, text, tone}], pending }
game.defaultPayload()   // a valid payload meaning "just do the sensible default" (for fast-forward)
game.fastForward(stopKinds=['scene','termStart'], maxSteps=2000) // repeats act(defaultPayload()) until pending.kind is in stopKinds
game.save()             // JSON string; loadGame(jsonString) restores it (also deterministic: same saved state + same choices = same result)
game.debug()            // optional: whole-school stats for tests (counts, ranks)
```
`view()` returns:
```js
{ clock:{ label:'วันจันทร์ 07:45', year:1, term:1, cycle:3, day:12, dow:1, minute:465, dayInCycle:2, schoolDay:true },
  place:'ห้อง 218 (คณิตศาสตร์)',
  me:{ name, sex, trait, grade, room, rank, rankSize, dormName, dormRoom, tier },
  stats:{ gpa, gpax, health, energy, stress, fullness, knowledge, peer, teacherTrust, money },
  today:[{ from:'08:30', to:'09:20', title:'คณิตศาสตร์', loc:'218', teacher:'ครูมินท์', done:false }],
  askParents:{ available:true, nextAmount:80 },
  notes:[string] }
```
Every pending: `{ id, kind, title, text, clock:string, ... }`. Six kinds:
1. `scene` (generic): `{ card?:{ rows:[[label,value],...] }, options:[{ id, label, sub?, disabled?, reason?, tone?:'good'|'bad'|'neutral' }], final?:boolean }`. payload `{ optionId }`. Used for intro/birth card, events, home trip (save point), the ม.4 gate, year report, endings (`final:true`), teacher snaps, being caught, notices.
2. `shop`: `{ mode:'meal'|'coop'|'print'|'canteen', meal?, money, fullness, shops:[{ id, name, items:[{ id, name, price, fill, note?, available, reason?, options?:[{ key, label, multi?, max?, choices:[{ value, label, priceDelta }] }] }] }], canSkip:true }`. payload `{ skip:true }` or `{ cart:[{ shopId, itemId, qty?, options?:{ key: value|[values] } }] }`.
3. `classPlan`: `{ block:'morning'|'afternoon', periods:[{ p, from, to, kind:'class'|'activity'|'free', code?, name, loc?, teacher?:{ key, name, mood:'calm'|'tense'|'snapping' }, lineShop?:{ eligible, items:[{ id, name, price, available }] } }], money }`. payload `{ stance:'focus'|'normal'|'relax', skipPeriods:[p], line:[{ p, itemId }] }`.
4. `plan`: slot planner `{ planKind:'free'|'evening'|'weekend', startMinute, slotMinutes:30, slots:N, actions:[{ id, label, hint?, quietOnly? }], lightsOutMinute?, money, parents:{ canAsk, nextAmount } }`. payload `{ plan:[actionId x slots] }`. Evening uses `src/evening.js` ACTIONS.
5. `termStart`: `{ clubs:[{ id, name, seatsLeft, studentRun }], electives:[{ id, name, area }], needElective }`. payload `{ clubId, electiveId|null }`.
6. `lineOrder`: `{ menu:[{ id, name, price }], orders:[{ id, itemName, forDay, status }], money }`. payload `{ place:[itemId], cancel:[orderId] }`.

Time model (PLACEHOLDER where marked): day starts at wake (out-by time minus 45 min from DORM_DAY.getReady). A 14-day cycle = Mon..Sun (dorm) + Mon..Fri (dorm, home trip after the last class on Friday until Sunday 18:00, save point) ; term = 9 cycles (PLACEHOLDER); 2 terms a year; a short break between terms is skipped. School days follow the timetable of the player's grade and room; weekends have no class. Year end = `yearStep`-like bookkeeping (marks by rank -> GPA by band, gate, promotion, outsiders, rooms re-sorted by that year's GPA, new dorms and roommates; reuse `rooms.js`, `cohort.js`, `dorm.js`).
Whole school: all 720 students and all teachers are simulated every school day (cj: "like running the real school"). NPCs use simple rule-based habits, flat arrays, deterministic; a full school year must run in under 3 s in node. Teacher pressure belongs to the teacher and carries over from period to period (see DESIGN.md "Timetable and teacher snapping").
The engine imports data modules from section 2. While another owner's module is missing, use a tiny local stub behind the same function signatures and leave a `TODO(stub)` comment.

## 4. UI (owners U1, U2)
- Single page, mobile first (360 px wide upward), light and dark via `prefers-color-scheme`, system Thai font stack, large touch targets, no emoji, no external fonts or libraries (self-contained, works offline over http).
- `src/ui/app.js` (U1): boot, new game / continue (localStorage key `one-in-720-save-v1`, wrapped in try/catch), main loop: `render(pending)` -> pick a screen from `src/ui/registry.js` by `pending.kind` -> user acts -> `engine.act(payload)` -> re-render. Always-visible status header from `engine.view()` (clock, place, money, health, energy, stress, GPA). A log drawer with the last lines, a "skip to next decision" button (`fastForward`), save/load/restart menu.
- `src/ui/api.js` (U1): `export function getEngine()` returns the real engine (`createGame`/`loadGame`) or `mock-engine.js` when the URL has `?mock=1` or the real engine import fails.
- `src/ui/registry.js` (U1): `export const SCREENS = { scene: () => import('./screens/scene.js'), shop: () => import('./screens/shop.js'), classPlan: ..., plan: ..., termStart: ..., lineOrder: ... }`.
- Every screen module exports `render(container, pending, ctx)` where `ctx = { view, act(payload), toast(text) }`. Screens build DOM with a tiny helper (`h(tag, attrs, ...children)`) that each owner may copy locally, do not share helper files across owners.
- `src/ui/mock-engine.js` (U1): implements the API of section 3 with canned data of all six kinds so both UI agents can develop and screenshot without the real engine.
- CSS: U1 `css/base.css` (layout, header, theme variables `--bg --fg --muted --accent --good --bad --card`), U2 `css/screens.css` (shop grid, planner, club picker) using the same variables.

## 5. Definition of done
- `node test/run.js` (core) and every owner's test pass.
- `node serve.js`, open http://127.0.0.1:4026/ : start a new life, play through a few days with the mock and with the real engine, no console errors.
