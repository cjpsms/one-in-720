# 1 ใน 720 — rough design (draft, nothing built yet)

Own code. Idea borrowed from "1 ใน 65 ล้าน" (weighted random birth + stats + life stages + choices with a price + final score). No code or text copied.

## Cast and time
- 720 students: ม.ต้น 4 rooms x 24 x 3 grades = 288, ม.ปลาย 6 rooms x 24 x 3 grades = 432.
- Player always starts at ม.1 (random sex, random room 1-4) and plays to ม.6 graduation.
- 12 terms. One term = ~9 cycles. One cycle = ~14 days in the dorm, ending with a trip home (save point).
- The engine ticks by school day and keeps values per day (cj: "เก็บเป็นค่าตามวัน"), running through a real timetable. The player makes choices at beats inside each cycle. Level of detail (cj, round 16: "ทำระบบแบบเหมือนรันทั้งโรงเรียนจริงๆเลย"): the whole school is simulated day by day, every school day: all 720 students, every teacher, the timetable, the canteen shops, the LINE shop orders and stock, and teacher pressure. NPC students use simple rule-based habits, the simulation runs in a Web Worker with a seeded RNG and fast-forwards between the player's decisions. Rough size: 720 agents x 8 periods x ~1,200 school days is about 7 million agent-periods, fine if each NPC step is cheap and the state is kept in flat arrays.
- The other 719 are full agents run by the same model with simple rule-based habits (seeded diligence, ability, personality, money, dorm, friends), so the player's rank is a real rank and school events (LINE-shop stock, caught students, angry teachers) come from the whole population.

## Stats
- Hidden: knowledge K (grows with study, drives GPA), diligence habits.
- Shown: GPA this term + GPAX (2 decimals), peer social, teacher social, health/energy, stress, money.
- Teacher social: work handed in, talking to teachers. Gives a small GPA bonus and helps the ม.4 lottery.
- Peer social: who you hang out with (a few friend groups). Helps stress and group work, costs time/money.
- Money ("ค่าตัง", always shown): see the Money section. Food is bought by the player: cheap meal / normal meal / skipped meal trade-off (skip = money saved, health and GPA down).

## Money
- Allowance comes monthly, about 135 baht x days in the month (~4,050), not per day. Tier may scale it a little (to confirm).
- Day 1: the player randomly asks the parents for a lump sum, up to 20,000. The amount sets the family tier (from cj): 800-2,000 = normal, above that = written as "spoiled" (สปอยล์), above 10,000 = written as "rich".
- Only rich parents transfer money on their own, when the balance is under 5,000 (confirmed by cj). Spoiled and normal parents never phone: the player must phone them.
- Asking parents: you can ask for (day-1 amount / 10). Each repeat ask halves it (800 start: 80, 40, 20), and below 20 baht they refuse with a random reason ("can't buy anything", "already too expensive"). The counter resets at every home trip (every 2 weeks, confirmed by cj).
- Day-1 draw is two random rounds (cj): round 1 picks the tier, about 2-3 in 96 rich, about 10 in 96 spoiled, the rest normal (~87%); round 2 picks the amount inside the tier (normal 800-2,000, spoiled 2,000-10,000, rich 10,000-20,000). The rich parents' self-transfer amount is also random, scaled from the day-1 amount (my proposal: day-1 / 10 x 0.5-1.5).

## Systems
- Subjects and teachers: about 8 subjects, each with a fictional teacher (style, strictness, what they reward: work handed in, questions in class, exam scores). Knowledge per subject, teacher score per teacher. Term GPA = credit-weighted average of subject grades, so one strict teacher can drag the GPA.
- Canteen (โรงอาหาร): 10 shops with real menus and prices, see the Canteen section.
- Co-op: always written in full, played for laughs: "อาคารร้านค้าสวัสดิการโรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย พิษณุโลก (สหกรณ์)". Stock and the print room: see the Co-op section.
- Mood and teasing: "สลิ้งแตก" is current online slang for snapping / a meltdown, written directly in the game (cj: skip the syringe item, "สลิ้ง" = syringe). When a student's stress hits the cap they snap (yell at a friend, tear up the work, skip class, cry in the dorm), a big event with consequences. Teachers snap too, see Timetable. "ล้อ" (my reading, not confirmed) = friends teasing and nicknames, moves peer social and mood, can turn into bullying.
- Optional idea of mine, not from cj: belongings that break (bike wheel, bag strap, charger) with repair costs at the co-op, and health room visits when flu goes around.
- Clubs (cj sent https://pcshspl.my.canva.site/dahiay-eqay, titled "กิจกรรมชุมนุม" semester 2/2569, one page per level; cj first called it "กิจกรรมเลือก (พก)" and then corrected it: the clubs are the Tuesday ชุมนุม block, and พก. is a different thing). Each club has a seat cap ("รับ N คน", 5-28), so a seat is scarce. "เป็นที่ปรึกษาชุมนุม" with no club name = a student-run club, the teacher is only the advisor (cj). Teacher names on the page are real, so only the club names are kept, teachers stay random.
  - ม.1: คณิตศาสตร์เพื่อเป้าหมาย 12, English for fun 12, คณิตคิดเร็ว 12, ดนตรีไทย 12, ประวัติศาสตร์ไทย 12, Nihongo roku nana 12, วิทยาศาสตร์การออกกำลังกาย 10, plus 1 unnamed (12).
  - ม.2: Math for life ver.2 8, ภาษาและวัฒนธรรมจีน 10, ตะลุยโจทย์คณิตศาสตร์ 10, การพูดเพื่อนำเสนองาน 20, ต่อคำศัพท์ภาษาอังกฤษ 10, Computer Project 12, an art club 15, plus 3 unnamed (10, 10, 12).
  - ม.3: Math test 67 10, รักการอ่าน 2 15, classroom theater 10, a Thai-skills club 12, plus 1 unnamed (10).
  - ม.4: unity 24, การบินโดรนเพื่อการท่องเที่ยวของชุมชน 6, ภาพยนตร์เยอรมัน 12, English Drama 15, Biology intensive 2 10, Math for Board game 10, Crossword 12, เศรษฐกิจพอเพียง 10, พฤกศาสตร์ 15, two นศท. clubs (25 each), plus about 5 unnamed.
  - ม.5: ฟิสิกส์สัประยุทธ์1 5 (already selected for a competition), บอร์ดเกมเพื่อการศึกษา 12, เคมีเพิ่มเติม 12, Library Club 2 15, Young Social Innovators 12, an นศท. club, plus about 5 unnamed.
  - ม.6: จิตอาสา 10, ขนมนานาชาติ 10, สถิติสำหรับโครงงาน 15, ฟุตซอล 15, an นศท. club, plus 3 unnamed.
  - All levels: วงโยธวาทิต จภ.พล 28, Library Club 1 (ม.4-6 only) 15, a performing-arts club 15, and some unnamed ones (12-25; one is ม.ปลาย only, 24).
  - Game idea: at the start of each term the player picks a club from their level's list, seats are limited and NPCs fill seats too; club choice drives which skill grows (maths, English, science, music...), which friends you make, and sometimes a competition. Other activities (scouts, Red Cross youth, reading, นศท.) stay as fixed blocks.

## Timetable and teacher snapping
- Timetable copied from cj's real one (PDF: ~/.claude/uploads/3f77f74d-d086-460a-bbef-de65c8eb349c/77d5858c-StudentM1-6.pdf, semester 2 of 2569, 18 pages, 2 rooms per page). Real structure and subjects are kept, teacher names are random fictional ones (cj: "เอาตามนี้แต่สุ่มๆ"). Rooms re-sort every year, so the player's timetable and teachers change with the room.
- Day structure: Monday to Friday only, no Saturday. Homeroom 07:45-08:30; P1 08:30-09:20; P2 09:20-10:10; P3 10:20-11:10; P4 11:10-12:00; lunch 12:00-13:00; P5 13:00-13:50; P6 13:50-14:40; P7 14:50-15:40; P8 15:40-16:30.
- Hours per week: ม.1, ม.2, ม.4, ม.5 = 37; ม.3 = 33; ม.6 = 25 (afternoons mostly empty).
- Rooms: ม.1-3 have 4 rooms (x/1-x/4), ม.4-6 have 6 rooms. The "x/1_KP" pages in the PDF are another school (cj: KP is a different school that just shares the campus). They are NOT among the 720 and are not simulated, at most background flavor.
- One teacher teaches a given subject to all rooms of a year (e.g. ม.1 maths: same teacher in 1/1-1/4). A few English-named teachers (foreign) teach conversation/lab periods.
- The number under each teacher is a subject room (maths 218, Thai 213, English 232, social 242, science 221/223, lab 111, COM1-3 computer rooms, ศ.กีฬา, สนาม, นาฏศิลป์, ฝึกงาน, แนะแนว), so students walk between rooms.
- Fixed weekly blocks: Tuesday P5-P7 is activities for everyone (ม.1-3: ลส/ยว, ชุมนุม, ส.การอ่าน; ม.4-6: ชน./นศท., บพ./นศท., ส.การอ่าน). "พก. 2 ตามกลุ่ม" blocks at P7-P8 (ม.1 Mon, ม.2 Thu/Fri as G1/G2, ม.4 Wed, ม.5 Wed+Fri, ม.6 Mon/Wed/Thu as G1-G3). ม.5 also has "ภาษาที่ 2 ตามกลุ่ม" 2 periods. แนะแนว 1 period each week.
- Subject decode (cj's answers first, then my guesses from the room numbers and the standard Thai numbering; cj said "ม.ปลาย ไปเดาตาม ม.ต้นเอา"):
  - Rooms (cj): 111 = science, and a ว subject with only 2 periods a week there is the science project; COM1/2/3 = computer rooms (a period in COM = computer class); 242 = social studies, religion, history (243 teaches roughly the same); ศ.กีฬา 4 = art room; นาฏศิลป์ = dance room; แนะแนว = guidance room; 228 maybe maths (cj unsure). My guesses: 211-215 Thai, 216-228 maths, 231-238 English, สนาม = PE field, ศ.กีฬา 1/2 = health, ศ.กีฬา 5 = music, ฝึกงาน = work/workshop.
  - ม.ต้น: ท Thai; ค maths (+ ค...202 extra); ว...102 science (3); computer = ว21202 (ม.1), ว22203 (ม.2), ว23202 (ม.3), 2 periods in COM; ว22202 = science project (2, room 111); ว21203 = science in room 111 (3 periods, unsure which); ส...102 = social studies, ส...104 and ส...106 = history and religion (which is which unknown), ส20209 = social type (room 243); ศ...102 art; ศ...103 dance; พ...102 health; พ...104 PE; ง21101 work/workshop; อ...102 English (3); อ...202 English with a foreign teacher (1); 20271 = a 1-period project (ม.2 room 228, ม.3 room 223, unsure).
  - ม.ปลาย (guess): ...202 physics, ...222 chemistry, ...242 biology (3 periods each in ม.4, ม.5 chemistry 2); ว31162 earth and space (2, ม.4); ว31283 science project (2, ม.4); ว31284 and ว32281 = computer (COM1 / COM2, 2); ว30281 = science project or independent study (1). ม.6: ว33101 physics, ว33121 chemistry, ว33141 biology (1 each). Same-room hints agree: physics 134 / 138 / 138, chemistry 128 / 133 / 126, biology 125 / 123 / 123 for ม.4 / 5 / 6.
  - Activities (guess): "ภาษาที่ 2 ตามกลุ่ม" = second foreign language by group (English rooms 231-233); "ชน./นศท." and "บพ./นศท." = club or military students (นศท.) / service work or นศท.; "พก. 2 ตามกลุ่ม" = elective subjects (วิชาเลือก, cj), chosen by group, 2 periods in a block at P7-P8 (ม.2 and ม.6 have 2-3 groups G1-G3 on different days). This is a place for a player choice (which elective) and for peer groups. cj (round 11): พก. means elective extensions of the core subjects, not clubs ("วิทย์เพื่อ...", "คณิตเพื่อ...", computer ones like multimedia or IoT). About 100 invented names are in ELECTIVES.md; ลส/ยว = scouts / youth red cross.
  - ม.1 periods per week (37): Thai 3, maths 3 + 2, science 3 + 1, computer 2, ว21203 3, social 2, history/religion 1 + 1, English 3 + 1, health 1, PE 1, art 1, dance 1, work 2, guidance 1, พก.2 2, ลส/ยว 1, ชุมนุม 1, ส.การอ่าน 1.
- Data entry later: the PDF text layer is broken (digits missing), so the grids must be transcribed from the images.
- Each teacher has: patience (random per teacher), style, and a closeness value with every student (rises with handing in work and talking to them, drops when ignored).
- Each class has a defiance level (how stubborn the room is, from its students' diligence).
- Daily pressure per teacher and class: class defiance x (share of students NOT close to the teacher) + a heavy bump for every close student who did not hand in work that day. Pressure belongs to the teacher, not the class: it carries over from period to period (decaying during the day and overnight), so a class that angers a teacher makes the next class pay.
- When pressure passes the teacher's patience, the teacher "สลิ้งแตก": scolds the class or the one student, extra homework, surprise quiz, or walks out. Pressure then resets. If you are the close student who did not hand in work, the teacher turns on you (teacher score for that teacher drops, stress rises).
- Per-day values stored: who handed in work, pressure, snap events.

## One cycle
1. Status card.
2. Beats: food plan, after-school (activity club / study / rest), who to hang with (pick 1 of 3 offered), dorm evening (study alone, study group, sleep early, phone/games, chat, sneak to the shop, call home), plus 1-2 random events (weighted by stats, each with a cost).
3. Cycle 5 = midterm, cycle 9 = final. Term GPA = f(K, exam luck, teacher bonus, health penalty), clamp 0-4.00.
4. Home trip: autosave (localStorage), family beat, quit option.

## Dorm (from cj, round 12)
- Six dorms (names read from a screenshot, may have typos): girls x3 = หอพักภรณ์คุณาศัย (หอ 1), หอพักวสัยคุณาศักดิ์ (หอ 2), หอพักลักษณานุสรณ์ (หอ 3); boys and others x3 = หอพักจุลินทิรา, หอพักจุฬาพิลาส, หอพักจุฬาลักษณ์.
- Every dorm has a study room on the ground floor; the bedrooms are upstairs. 10 per bedroom, except the "lowest" boys' dorm (หอล่างสุด) with 6 per room.
- Daily: dorm opens 15:30; you must be in by 18:00; dorm assembly (รวมหอ) 19:00; then study downstairs; bedtime = go upstairs and lights off at 23:00 for all girls' dorms and for the lowest boys' dorm, 22:00 for the other boys' dorms.
- Everyone must be out of the bedrooms (downstairs) by 08:30. Students who stay over a home weekend can go up at 12:00; the lowest dorm can go up at any time but must come down before 08:30.
- Who lives where (cj, round 13). Boys: จุฬาพิลาส = ม.1 + ม.2; จุลินทิรา = ม.4 + ม.5; จุฬาลักษณ์ (the lowest dorm, หอล่างสุด) = ม.3 + ม.6, so the oldest year of each stage gets the privileges (6 per room, later bedtime, can go up any time). A boy therefore changes dorm at ม.3, ม.4 and ม.6, and gets new roommates each time.
- Girls move every year (cj, round 15: "ผู้หญิง เอาย้าย"): หอ 1 = ม.1 + ม.4, หอ 2 = ม.2 + ม.5, หอ 3 = ม.3 + ม.6 (about 120 girls per dorm). A girl gets new roommates each year.
- Morning (cj, round 14): you must be out of the dorm by 07:10 (girls), 07:00 (lowest boys' dorm), 06:30 (other boys' dorms). Once you have left you cannot go back in, so anything forgotten stays behind. If you wake early you can still ask roommates for what you lack before you go out.
- Game use: roommates (9, or 5 in the lowest dorm) are the closest peer group; the 15:30-18:00 window is free time (canteen, co-op, friends); the evening beats happen downstairs; lights-out is the fixed end of the day (late phone use or sneaking out costs sleep and health).

## Canteen: 10 shops plus a LINE shop (from cj, rounds 12 and 15)
Meals are breakfast, lunch and evening. A cheap day is about 30 + 40 + 50 = 120 of the 135 baht, so a drink or snack makes it tight. Personality: the player is born an extrovert or an introvert (random).
1. Smoothie / drinks (ร้านน้ำปั่น): gives energy; for an introvert it also raises speaking skill. Price 25-45 in steps of 5 (25/30/35/40/45), blended or not costs the same. In cold season there are warm drinks at 15 (hot cocoa and similar).
2. Fruit: fruit 20; ice cream cup 25, cone 15 or 20; banana 20 per piece; mochi in the evening only, 49, with ice cream 59.
3. Chicken rice (ข้าวมันไก่): 30+ like a normal shop (crispy chicken, spicy chicken); pork leg 50, special 60.
4. Curry rice (ข้าวแกง): from 30, +5 per extra dish; also ข้าวซอย and ขนมจีน (two kinds of sauce), 30 each.
5. Fried food: skewers 10-15 (nuggets, fried banana, fried chicken...); the special "ไก่อ้วน" skewer is 10 and two fill you up; cheese is free at the whole shop, adding it fills you more and counts as a good choice.
6. Made-to-order (ตามสั่ง, one of two shops with the same name): the better one, signature ข้าวไข่ข้น..., shrimp / pork / chicken dishes, and instant noodles (Mama red / white / black pack).
7. Noodles: normal, nothing special.
8. Yam / steak / malatang shop, menu changes by meal. Breakfast: sticky rice with sides (spicy fried chicken, sweet pork, grilled pork, grilled chicken, pork floss, more). Lunch: yam and steak (fish, chicken, pork, and a round chicken-cheese ball "ไก่ชีส"; extra cheese +5; order several); yam is a pick-your-own-flavour game with real brands (Mama, Nissin, Yum Yum...). Evening: malatang or suki (pick items on skewers, several noodle types, broth: black, malatang or ramen).
9. Crepes: very cheap and few customers; เฉาก๊วยนมสด 15, crepe 5 per piece, batter 10. Subplot: if you have been around a while and chip in to support them, they have an 85% chance of becoming rich; then you get your money back, the teachers like you more, friends get free crepes (friend affection up), and you eat free once a week.
10. Made-to-order, the second shop with the same name: plain, no signature dish (only ordinary ข้าวไข่ข้น), no instant noodles, 10 baht more expensive, less filling.
11. The LINE shop ("สั่งของจากมิ้ว", cj's words; ordered through LINE, run from room 222): sells pickled things (ของดอง), pickled salmon rice (ข้าวแซลมอนดอง), Hokkaido milk, fried rice, instant noodles, Kit Kat 15. Prices (cj, round 16): pickled salmon rice 99, ordinary pickles 15-25. Everything must be ordered in advance, except pickled egg, pickled salmon and instant noodles, which can be bought on the spot only when someone ordered and then cancelled. In the afternoon science periods that spare stock is gone. My placeholders for the rest: Hokkaido milk 25, fried rice 30, instant noodles 20, Kit Kat 15, pickled egg 20, pickled salmon 59. It is the only shop you can buy from DURING a period, and only when the class is in a room next to 222 (221 or 223, the science rooms). Eating gives a buff during class. Each purchase has a 10% chance of being caught; then that teacher "สลิ้งแตก" at once: teacher trust score down and the grade score for that subject down (numbers are placeholders, e.g. trust -15, that period's score -1 band, teacher pressure +). The anger carries over: if the previous class made the teacher snap, the next class with that teacher can get snapped at too (cj, round 16).
- The canteen is open all the time (cj). If the crepe shop does not get rich (the 15%), you lose the money you put in, but the shop gives you a discount whenever you buy from it afterwards.

## Co-op and required items (from cj, round 14)
- The co-op sells food and drinks like a 7-Eleven (food only), plus stationery: pens, stationery, A4 paper (100 sheets), A3 pound paper, coloured paper, a glue gun, and scout / youth red cross (ลส/ยว) gear.
- Print room: to print (for example photos a teacher asks for) you must first buy paper, then print at 2 baht per page.
- Teachers sometimes order things you must have (paper, glue gun, scout gear, printed photos). If you do not have everything you get penalised ("ถ้าไม่ครบโดน"), and belongings can go missing. Before leaving the dorm in the morning you can ask friends or roommates for what you lack, because you cannot go back in.
- Prices are placeholders until cj gives them (A4 100 sheets, A3, coloured paper, glue gun, scout gear), plus the penalty size.

## Evening at the dorm (cj, round 17)
- From 19:00 to 00:00 at the dorm you can do whatever you like. Built as 10 half-hour slots (src/evening.js): study alone, study with friends, do teacher-set work, chat with roommates, phone or games, phone the parents, exercise, sleep. After the dorm's lights-out (22:00 or 23:00) only quiet things work (sleep, whisper in bed, secret phone, studying by phone light), the rest turns into sleep. Sleep hours run from the last awake slot to the wake-up time (out-by time minus 45 minutes, a placeholder) and change health. All effect numbers are placeholders.

## Planned for tomorrow (cj said these come next)
- Each teacher's personality.
- Assignments and school activities / events.

## Build status
- Phase 1 done and tested (`node test/run.js`): seeded RNG, config of every number from cj, 720 students with sex / trait / ability / diligence / family money, GPA bands by rank, rooms re-sorted every year, the ม.4 gate with outsiders, rare dropouts, dorms by grade, asking the parents, the dorm evening.
- Phase 2 done (2026-11-10, built by a team of agents against docs/CONTRACT.md, about 9,600 lines): real timetable data for all 30 rooms (checked by scripts/check-timetable.mjs), subjects / clubs / 100 electives / fictional teachers / 40 events / tasks, all 11 shops + co-op + print room + crepe subplot, the whole-school day-by-day engine (720 students, teachers with carried-over pressure, LINE-shop catch, ม.4 gate and endings, save/load; one school year takes about 0.15 s), and the mobile web UI. Run: `node serve.js`, open http://127.0.0.1:4026/ (`?mock=1` for the mock engine). All test suites pass.
- Phase 3 done (2026-11-10, docs/CONTRACT2.md): routine mode as the default (set study / food / evening / snack once per term, the school runs itself, about 13 stops per school year at the moment), detailed mode kept, balance Monte Carlo in test/balance.test.js (focus 94% / normal 81% / relax 45% gate pass), UI restyled like 1 in 8 Billion with pictures drawn in code (720-dot school map, pixel scenes, share PNG cards).
- Phase 4 done (2026-11-10, docs/CONTRACT2.md section 5): watch-the-days play. The engine steps one block of the day at a time (stepBlock, about 16 blocks per school day), the UI shows the day as a timeline with the pixel scene following the real place and clock, speeds 1x-8x plus skip-day / skip-week, rest-break recaps for week / term / year, events as story cards, fewer stops (about 9 per school year).
- Known gaps: NPCs have no friend graph (only closeness to teachers); teacher personalities and assignments are placeholders until cj describes them; many numbers are PLACEHOLDER (see the config files); the teacher snaps about 45-95 times a year (tune); the default player usually ranks in the top 30%.

## Rooms and the ม.4 gate
- ม.1 entry: random room 1-4 (24 each). Start K from the room's GPA band.
- Room bands (from cj): ม.ต้น 4.00 = room 1 + half of room 2; 3.8-3.9 = rooms 2-3; room 4 lower, min 3.5. ม.ปลาย 4.00 = rooms 1,2 + part of 3; 3.8-3.9 = rooms 3-4; rest <= 3.4.
- Rooms are re-sorted EVERY year by that year's GPA (not fixed). Implement as: sort by GPA, fill rooms in rank order, then check the bands.
- ม.4 takes 144 from anyone, NO reserved internal seats. Pass chance depends only on the ม.3 year GPA (the room you land in after the yearly re-sort): room 1-2 level = pass (they are just too good), room 3-4 level = chance rising with GPA (3.79 high, 3.5 low but not zero). A room 1-2 student who slips to room-4 level in ม.3 does not get in. Outsiders fill the remaining seats. The draw is shown as a tense scene.
- After the 144 are fixed, sort by ม.3 GPA into rooms 1-6.
- Rare NPC dropouts, per student per year: ม.1 and ม.4 = 1/96, ม.2 and ม.5 = 0.2/96, ม.3 and ม.6 = 0.05/96. The player never drops out by chance, only by choice.

## Endings
- Graduate at ม.6: report with GPAX, rank x/144, room path, social scores, story tags, one-line summary.
- Quit: fee is 12,600 per year, split per term (6,300 per term). Ending text only.
- ม.4 exam fail: a scene asks "continue studying" or "stop studying". Continue = written as going to smurf (Smurfing) at the school near home, not as a loser ending. Stop = the end.
- Rooms 1-2 may choose to leave for another school at the ม.3 to ม.4 gate: MWIT, KVIS (both confirmed by cj) or a วมว. (university-run science classroom program in network schools, ม.4-ม.6, e.g. วมว.-มน. Naresuan). Bad ending, same as failing.

## Tech (proposal)
Static web, vanilla JS, no build, no server: index.html + a few js files (seeded rng, cohort, model, events, ui). Save in localStorage at each home trip. Thai plain-text UI, no emoji. Phone friendly.

## Open questions for cj
1. Quit fee: school costs 12,600/year (6,300/term); is it charged only when you quit, and who pays (player's family, shown as a loss)?
2. (answered) ม.4 fail = choose smurf at the local school or stop. Rooms 1-2 may leave too = bad ending.
3. (answered) Rooms re-sort every year.
4. (answered) Allowance is monthly, about 135/day.
5. (answered) No reserved internal seats, outsiders fill the rest.
6. School activities/events: cj will list them.
7. (answered) Leave-school names: MWIT, KVIS, วมว.
8. (answered) Day-1 minimum is 800, normal up to 2,000.
9. (answered) Rich parents transfer by themselves when the balance is under 5,000, others must be phoned.
10. (answered) Skip the syringe, write "สลิ้งแตก" directly.
12. (answered) Rich 2-3 in 96, spoiled 10 in 96, rest normal, 2 random rounds.
13. (answered) The ask counter resets every home trip (2 weeks).
14. (answered) Spoiled parents do not transfer by themselves, only rich.
15. (answered) Periods, times, subjects, no Saturday; dorm times and the canteen (rounds 7 and 12). Still missing: co-op prices and the penalty size for missing items (placeholders in use).
16. "Close to the teacher": is it enough to define it as the closeness value above (handing in work + talking)?
11. Teachers: fictional names and types, not real teachers (recommended)?
