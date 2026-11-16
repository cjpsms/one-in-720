// Mini game "watch": sit in the hall, keep your eyes open, catch the keywords, answer the questions (CONTRACT3 section 5).
import { mount, h, clamp, botScore } from './kit.js';

export const INFO = {
  id: 'watch',
  title: 'นั่งฟังในหอประชุม',
  how: 'แตะปุ่ม "ลืมตา" รัวๆ ไม่ให้เปลือกตาตก แตะคำสำคัญที่วาบขึ้นบนจอ แล้วตอบคำถามสามข้อตอนท้าย',
};

export function bot(spec, rng) {
  const p = (spec && spec.params) || {};
  const hasQ = Array.isArray(p.questions) && p.questions.length;
  return botScore(spec, rng, hasQ ? 0.66 : 0.72, 0.1);
}

function norm(p) {
  p = p || {};
  const slides = (Array.isArray(p.slides) && p.slides.length ? p.slides : [
    { title: 'ยินดีต้อนรับ', line: 'วันนี้ครูมีเรื่องสำคัญมาเล่าให้ฟัง' },
    { title: 'ใจความหลัก', line: 'ตั้งใจฟังแล้วจดสิ่งที่สำคัญไว้' },
    { title: 'สรุป', line: 'ทบทวนสิ่งที่ได้ฟังก่อนกลับห้อง' },
  ]).map((s) => ({ title: String((s && s.title) || ''), line: String((s && s.line) || '') }));
  const keywords = (Array.isArray(p.keywords) && p.keywords.length ? p.keywords : slides.map((s) => s.title)).map(String).filter(Boolean);
  const questions = (Array.isArray(p.questions) ? p.questions : [])
    .filter((q) => q && q.q && Array.isArray(q.choices) && q.choices.length)
    .slice(0, 3)
    .map((q) => ({ q: String(q.q), choices: q.choices.map(String), answer: typeof q.answer === 'number' ? q.answer : Math.max(0, q.choices.indexOf(q.answer)) }));
  return { slides, keywords: keywords.length ? keywords : ['ตั้งใจฟัง'], questions, topic: p.topic ? String(p.topic) : '' };
}

export function play(container, spec, done) {
  const P = norm(spec && spec.params);
  return mount(container, spec, INFO, done, (g) => {
    const D = Math.max(15, Number(spec.durationSec) || 30);
    const diff = clamp(Number(spec.difficulty) || 0, 0, 1);
    const qTime = P.questions.length * 4;
    const slidePhase = Math.max(9, D - qTime);
    const slides = P.slides.slice(0, Math.max(1, Math.min(P.slides.length, Math.floor(slidePhase / 3))));
    const slideDur = slidePhase / slides.length;
    const total = slidePhase;

    const slideTitle = h('div', { class: 'mg-w-title' });
    const slideLine = h('div', { class: 'mg-w-line' });
    const slideNo = h('div', { class: 'mg-w-no' });
    const slideBox = h('div', { class: 'mg-w-slide' }, slideNo, slideTitle, slideLine);
    const kwLayer = h('div', { class: 'mg-w-kw' });
    const lidT = h('i', { class: 'mg-w-lid top' });
    const lidB = h('i', { class: 'mg-w-lid bot' });
    const screen = h('div', { class: 'mg-w-screen', role: 'img', 'aria-label': 'จอฉายสไลด์' }, slideBox, kwLayer, lidT, lidB);
    const fill = h('i');
    const meter = h('div', { class: 'mg-meter' }, h('span', { class: 'label', text: 'ความง่วง' }), h('div', { class: 'mg-bar' }, fill));
    const eye = h('button', { type: 'button', class: 'btn primary block mg-w-eye' }, 'ลืมตา');
    g.stage.append(h('div', { class: 'mg-w-topic', text: P.topic || 'หอประชุม' }), screen, meter, eye);

    // keyword flashes, planned up front from the seed
    const events = [];
    slides.forEach((_, i) => {
      const n = 1 + (g.rng.chance(0.5) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        events.push({ at: i * slideDur + 0.9 + (k * (slideDur - 2.4)) / n + g.rng.float() * 0.8, word: P.keywords[(i * 2 + k) % P.keywords.length], x: 8 + g.rng.float() * 56, y: 34 + g.rng.float() * 38, el: null, state: 0 });
      }
    });

    let t = 0; let slide = -1; let sleep = 0.2; let nod = 0; let awake = 0; let held = false; let caught = 0; let shown = 0;
    const rise = 0.085 + 0.06 * diff;

    function paintSleep() {
      const s = g.reduce ? Math.round(sleep * 10) / 10 : sleep;
      const cover = clamp((s - 0.25) / 0.75, 0, 1) * 50;
      lidT.style.height = `${cover}%`; lidB.style.height = `${cover}%`;
      slideBox.style.filter = s > 0.5 ? `blur(${(clamp((s - 0.5) * 2, 0, 1) * 3).toFixed(1)}px)` : '';
      fill.style.width = `${Math.round(clamp(sleep, 0, 1) * 100)}%`;
      fill.className = sleep > 0.75 ? 'hot' : '';
      screen.classList.toggle('nod', nod > 0);
    }
    function showSlide(i) {
      slide = i;
      slideTitle.textContent = slides[i].title; slideLine.textContent = slides[i].line;
      slideNo.textContent = `${i + 1} / ${slides.length}`;
    }
    function poke(amount) { sleep = clamp(sleep - amount, 0, 1); }
    function tapEye() { if (nod > 0) return; poke(0.11); paintSleep(); }
    function catchWord(ev) {
      if (ev.state !== 1) return;
      ev.state = 2; caught++; poke(0.12);
      ev.el.classList.add('hit'); g.timeout(() => ev.el.remove(), 220);
    }
    function liveWord() { return events.find((e) => e.state === 1); }

    eye.addEventListener('pointerdown', (e) => { e.preventDefault(); held = true; tapEye(); });
    const up = () => { held = false; };
    g.on(window, 'pointerup', up); g.on(window, 'pointercancel', up);
    eye.addEventListener('click', (e) => e.preventDefault());
    g.on(document, 'keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) { held = true; tapEye(); } }
      else if (e.code === 'Enter' || e.code === 'ArrowRight' || e.code === 'KeyK') { const w = liveWord(); if (w) { e.preventDefault(); catchWord(w); } }
    });
    g.on(document, 'keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); held = false; } });

    g.hud('เวลา', '');
    paintSleep();

    function questions() {
      g.stopLoop();
      eye.remove(); meter.remove(); screen.remove();
      const qs = P.questions;
      let qi = 0; let right = 0;
      const box = h('div', { class: 'mg-w-q' });
      g.stage.append(box);
      const ask = () => {
        const q = qs[qi];
        g.hud(`คำถาม ${qi + 1} / ${qs.length}`, `ถูก ${right}`);
        box.replaceChildren(h('div', { class: 'label', text: 'ที่ครูพูดเมื่อสักครู่' }), h('p', { class: 'mg-w-qt', text: q.q }),
          h('div', { class: 'mg-choices' }, q.choices.map((c, i) => h('button', { type: 'button', class: 'btn block mg-choice', 'data-i': i, onclick: () => pick(i) }, h('b', { class: 'mono', text: `${i + 1}` }), ' ', c))));
        const first = box.querySelector('button'); if (first) first.focus({ preventScroll: true });
      };
      let locked = false;
      const pick = (i) => {
        if (locked || !g.alive) return; locked = true;
        const q = qs[qi]; const ok = i === q.answer; if (ok) right++;
        box.querySelectorAll('button').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
        g.timeout(() => { locked = false; qi++; if (qi < qs.length) ask(); else end(right / qs.length); }, 750);
      };
      g.on(document, 'keydown', (e) => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || ''); if (m && !locked && qi < qs.length && Number(m[1]) <= qs[qi].choices.length) pick(Number(m[1]) - 1); });
      ask();
    }
    function end(qShare) {
      const awakeShare = clamp(awake / total, 0, 1);
      const kw = shown ? caught / shown : 1;
      const score = P.questions.length ? 0.45 * awakeShare + 0.15 * kw + 0.4 * qShare : 0.7 * awakeShare + 0.3 * kw;
      g.finish(score, { awake: Math.round(awakeShare * 100) / 100, keywords: caught, keywordsShown: shown, questions: P.questions.length ? Math.round(qShare * P.questions.length) : 0 },
        `ตื่นอยู่ ${Math.round(awakeShare * 100)}% จับคำสำคัญได้ ${caught} จาก ${shown}${P.questions.length ? ` ตอบถูก ${Math.round(qShare * P.questions.length)} จาก ${P.questions.length} ข้อ` : ''}`);
    }

    function start() {
      showSlide(0);
      g.loop((dt) => {
        t += dt;
        if (nod > 0) { nod -= dt; if (nod <= 0) { nod = 0; sleep = 0.5; } }
        else {
          sleep += (rise - (held ? 0.05 : 0)) * dt;
          if (sleep >= 1) { sleep = 1; nod = 1.1; } else awake += dt;
        }
        const si = Math.min(slides.length - 1, Math.floor(t / slideDur));
        if (si !== slide) showSlide(si);
        for (const ev of events) {
          if (ev.state === 0 && t >= ev.at) {
            ev.state = 1; shown++;
            ev.el = h('button', { type: 'button', class: 'mg-w-word', style: `left:${ev.x}%;top:${ev.y}%`, text: ev.word, onpointerdown: (e) => { e.preventDefault(); catchWord(ev); } });
            ev.el.addEventListener('click', (e) => e.preventDefault());
            kwLayer.append(ev.el);
          } else if (ev.state === 1 && t >= ev.at + 1.9) { ev.state = 3; ev.el.remove(); }
        }
        paintSleep();
        g.hud(`เวลา ${Math.max(0, Math.ceil(total - t))}`, `คำสำคัญ ${caught}/${shown}`);
        if (t >= total) {
          if (P.questions.length) { questions(); return false; }
          end(0); return false;
        }
        return true;
      });
    }
    g.ready(start, 'คีย์บอร์ด: เว้นวรรค = ลืมตา, Enter = จับคำสำคัญ, 1-3 = ตอบคำถาม');
  });
}
