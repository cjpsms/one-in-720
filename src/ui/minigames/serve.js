// Mini game "serve": run a food stall. Customers queue with an order, tap the ingredients in the recipe order
// before their patience runs out (CONTRACT3 section 5).
import { mount, h, clamp, botScore, swatch, digitIndex } from './kit.js';

export const INFO = {
  id: 'serve',
  title: 'ขายของในร้าน',
  how: 'ดูออร์เดอร์ของลูกค้าแต่ละคน แตะวัตถุดิบให้ตรงลำดับในสูตร ครบแล้วจะเสิร์ฟให้เอง ก่อนที่ความอดทนของลูกค้าจะหมด',
};

export function bot(spec, rng) { return botScore(spec, rng, 0.74, 0.09); }

function norm(p) {
  p = p || {};
  let menu = (Array.isArray(p.menu) ? p.menu : []).filter((m) => m && m.id != null && Array.isArray(m.steps) && m.steps.length).map((m) => ({ id: String(m.id), name: String(m.name || m.id), steps: m.steps.map(String), price: Number(m.price) || 0 }));
  let ing = (Array.isArray(p.ingredients) ? p.ingredients : []).filter((i) => i && i.id != null).map((i) => ({ id: String(i.id), name: String(i.name || i.id) }));
  if (!menu.length) {
    menu = [{ id: 'm1', name: 'กล้วยทอด', steps: ['banana', 'flour', 'oil'], price: 20 }, { id: 'm2', name: 'ชาเย็น', steps: ['tea', 'milk', 'ice'], price: 20 }];
    ing = [{ id: 'banana', name: 'กล้วย' }, { id: 'flour', name: 'แป้ง' }, { id: 'oil', name: 'น้ำมัน' }, { id: 'tea', name: 'ชา' }, { id: 'milk', name: 'นม' }, { id: 'ice', name: 'น้ำแข็ง' }];
  }
  const known = new Set(ing.map((i) => i.id));
  for (const m of menu) for (const s of m.steps) if (!known.has(s)) { known.add(s); ing.push({ id: s, name: s }); }
  return { stallName: String(p.stallName || 'ร้านของเรา'), menu, ing, n: clamp(Math.round(Number(p.customers) || 8), 3, 30), patience: clamp(Number(p.patience) || 12, 5, 40) };
}

export function play(container, spec, done) {
  const P = norm(spec && spec.params);
  return mount(container, spec, INFO, done, (g) => {
    const D = Math.max(15, Number(spec.durationSec) || 30);
    const names = new Map(P.ing.map((i) => [i.id, i.name]));
    const gap = Math.max(1.6, (D * 0.6) / P.n);
    const SEATS = 3;

    const queue = h('div', { class: 'mg-s-queue', 'aria-label': 'ลูกค้าที่รออยู่' });
    const trayChips = h('div', { class: 'mg-s-chips', 'aria-live': 'polite' });
    const clearBtn = h('button', { type: 'button', class: 'btn small', onclick: () => clearTray() }, 'ล้างถาด');
    const tray = h('div', { class: 'mg-s-tray' }, h('span', { class: 'label', text: 'ถาด' }), trayChips, clearBtn);
    const flash = h('div', { class: 'mg-s-flash', 'aria-live': 'polite' });
    const grid = h('div', { class: 'mg-s-grid' }, P.ing.map((i, k) => h('button', {
      type: 'button', class: 'mg-s-ing', style: `--c:${swatch(i.id)}`, 'data-id': i.id, onclick: () => tap(i.id),
    }, h('i', { class: 'mg-s-dot' }), h('span', { class: 'mg-s-nm', text: i.name }), k < 9 ? h('small', { class: 'mono', text: String(k + 1) }) : null)));
    g.stage.append(h('div', { class: 'mg-s-name', text: P.stallName }), queue, tray, flash, grid);

    let t = 0; let spawned = 0; let nextAt = 0.8; let id = 0; let served = 0; let missed = 0; let mistakes = 0; let points = 0;
    let trayIds = [];
    const waiting = [];

    function drawTray() {
      trayChips.replaceChildren(...trayIds.map((x) => h('span', { class: 'mg-s-chip', style: `--c:${swatch(x)}`, text: names.get(x) })));
      if (!trayIds.length) trayChips.append(h('span', { class: 'mg-s-empty', text: 'ยังว่าง' }));
      drawQueue(true);
    }
    function recipeMatch(c) { return trayIds.every((x, i) => c.dish.steps[i] === x); }
    function drawQueue(light) {
      for (const c of waiting) {
        if (!c.el) {
          c.bar = h('i');
          c.stepsEl = h('div', { class: 'mg-s-steps' });
          c.el = h('div', { class: 'mg-s-cust' },
            h('div', { class: 'mg-s-ch' }, h('b', { text: c.dish.name }), h('span', { class: 'mono', text: `฿${c.dish.price}` })),
            c.stepsEl, h('div', { class: 'mg-bar' }, c.bar));
          queue.append(c.el);
        }
        c.stepsEl.replaceChildren(...c.dish.steps.map((s, i) => h('span', { class: `mg-s-step${trayIds.length && recipeMatch(c) && i < trayIds.length ? ' ok' : ''}`, text: names.get(s) || s })));
        if (!light) c.el.classList.remove('urgent');
      }
    }
    function seat() {
      const dish = P.menu[g.rng.int(0, P.menu.length - 1)];
      const c = { id: ++id, dish, left: P.patience * (0.85 + g.rng.float() * 0.3), max: 0, el: null };
      c.max = c.left;
      waiting.push(c); spawned++;
      drawQueue();
    }
    function leave(c, ok) {
      const i = waiting.indexOf(c); if (i >= 0) waiting.splice(i, 1);
      if (c.el) { c.el.classList.add(ok ? 'served' : 'gone'); const el = c.el; g.timeout(() => el.remove(), g.reduce ? 60 : 380); }
    }
    function say(text, tone) { flash.textContent = text; flash.className = `mg-s-flash ${tone || ''}`; }
    function clearTray() { trayIds = []; drawTray(); }
    function tap(ing) {
      if (!g.alive) return;
      const next = trayIds.concat(ing);
      const cands = waiting.filter((c) => next.every((x, i) => c.dish.steps[i] === x));
      if (!cands.length) {
        mistakes++; trayIds = []; waiting.forEach((c) => { c.left -= 1; });
        tray.classList.remove('shake'); void tray.offsetWidth; tray.classList.add('shake');
        say('ผิดลำดับ ล้างถาดแล้ว (เสียเวลา 1 วินาที)', 'bad'); drawTray(); return;
      }
      trayIds = next;
      const full = cands.filter((c) => c.dish.steps.length === next.length).sort((a, b) => a.left - b.left)[0];
      if (full) {
        served++; points += 0.5 + 0.5 * clamp(full.left / full.max, 0, 1);
        say(`เสิร์ฟ ${full.dish.name} แล้ว +฿${full.dish.price}`, 'good');
        trayIds = []; leave(full, true);
      } else say('', '');
      drawTray();
    }

    g.on(document, 'keydown', (e) => {
      const i = digitIndex(e);
      if (i >= 0 && i < P.ing.length) { e.preventDefault(); tap(P.ing[i].id); }
      else if (e.code === 'Backspace' || e.code === 'Escape') { e.preventDefault(); clearTray(); }
    });
    g.hud('ลูกค้า 0 / ' + P.n, '');
    drawTray();

    function end() {
      const score = clamp(points / P.n, 0, 1);
      g.finish(score, { served, missed, mistakes }, `เสิร์ฟได้ ${served} จาก ${P.n} คน ลูกค้าเดินหนี ${missed} คน ทำผิดลำดับ ${mistakes} ครั้ง`);
    }
    function start() {
      g.loop((dt) => {
        t += dt;
        if (spawned < P.n && t >= nextAt && waiting.length < SEATS) { seat(); nextAt = t + gap * (0.8 + g.rng.float() * 0.4); }
        for (const c of waiting.slice()) {
          c.left -= dt;
          const f = clamp(c.left / c.max, 0, 1);
          if (c.bar) { c.bar.style.width = `${(f * 100).toFixed(1)}%`; c.bar.className = f < 0.3 ? 'hot' : f < 0.6 ? 'mid' : ''; }
          if (c.el) c.el.classList.toggle('urgent', f < 0.3);
          if (c.left <= 0) { missed++; say(`ลูกค้าสั่ง ${c.dish.name} รอนานเกินไปแล้วเดินจากไป`, 'bad'); leave(c, false); if (trayIds.length && !waiting.some((w) => trayIds.every((x, i) => w.dish.steps[i] === x))) clearTray(); }
        }
        g.hud(`ลูกค้า ${served + missed} / ${P.n}`, `เสิร์ฟ ${served}  ผิด ${mistakes}`);
        if (spawned >= P.n && !waiting.length) { end(); return false; }
        if (t > D * 2.5 + P.patience) { missed += P.n - served - missed; end(); return false; }
        return true;
      });
    }
    g.ready(start, 'คีย์บอร์ด: เลข 1-9 = วัตถุดิบ, Backspace = ล้างถาด');
  });
}
