// Mini game "dash": tap the items in the order shown, as fast as you can; a wrong tap costs time (CONTRACT3 section 5).
import { mount, h, clamp, botScore, swatch, digitIndex } from './kit.js';

export const INFO = {
  id: 'dash',
  title: 'แข่งความเร็ว',
  how: 'ดูลำดับที่แถบด้านบน แล้วแตะของให้ตรงลำดับให้เร็วที่สุด แตะผิดเสียเวลาเพิ่ม 1.5 วินาที',
};

export function bot(spec, rng) { return botScore(spec, rng, 0.7, 0.1); }

function norm(p) {
  p = p || {};
  let items = (Array.isArray(p.items) ? p.items : []).filter((x) => x && x.id != null).map((x) => ({ id: String(x.id), name: String(x.name || x.id) }));
  if (items.length < 3) items = ['เสื้อ', 'กางเกง', 'ถุงเท้า', 'รองเท้า', 'เข็มขัด', 'หมวก'].map((n, i) => ({ id: `i${i}`, name: n }));
  const len = clamp(Math.round(Number(p.sequenceLen) || 5), 3, items.length);
  const limit = clamp(Number(p.timeLimit) || 25, 8, 90);
  return { items, len, limit, rounds: clamp(Math.round(limit / (len * 1.7)), 2, 4) };
}

export function play(container, spec, done) {
  const P = norm(spec && spec.params);
  return mount(container, spec, INFO, done, (g) => {
    const PEN = 1.5;
    const strip = h('ol', { class: 'mg-d-strip', 'aria-label': 'ลำดับที่ต้องแตะ' });
    const grid = h('div', { class: 'mg-d-grid' });
    const flash = h('div', { class: 'mg-d-flash', 'aria-live': 'polite' });
    g.stage.append(strip, grid, flash);

    let round = 0; let order = []; let at = 0; let elapsed = 0; let mistakes = 0; let correct = 0; let running = false; let locked = false;
    const total = P.rounds * P.len;

    function newRound() {
      round++;
      const pool = g.rng.shuffle(P.items.slice());
      order = pool.slice(0, P.len);
      const layout = g.rng.shuffle(P.items.slice());
      at = 0; locked = false;
      strip.replaceChildren(...order.map((it, i) => h('li', { class: i === 0 ? 'now' : '', style: `--c:${swatch(it.id)}`, 'data-id': it.id }, h('b', { class: 'mono', text: String(i + 1) }), ' ', it.name)));
      grid.replaceChildren(...layout.map((it, k) => h('button', { type: 'button', class: 'mg-d-tile', style: `--c:${swatch(it.id)}`, 'data-id': it.id, onclick: (e) => tap(it, e.currentTarget) },
        h('span', { class: 'mg-d-nm', text: it.name }), k < 9 ? h('small', { class: 'mono', text: String(k + 1) }) : null)));
    }
    function tap(it, btn) {
      if (!running || locked || !g.alive) return;
      if (it.id === order[at].id) {
        correct++; btn.disabled = true; btn.classList.add('ok');
        strip.children[at].className = 'ok'; at++;
        if (at < order.length) strip.children[at].className = 'now';
        else if (round < P.rounds) { locked = true; flash.textContent = `รอบ ${round} เสร็จ`; g.timeout(() => { flash.textContent = ''; newRound(); }, 450); }
        else end(true);
      } else {
        mistakes++; elapsed += PEN;
        btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad');
        flash.textContent = `ผิด! เสียเวลา +${PEN} วินาที`;
        if (elapsed >= P.limit) end(false);
      }
    }
    function end(complete) {
      running = false;
      const ideal = total * 0.6;
      const speed = complete ? clamp((P.limit - elapsed) / Math.max(1, P.limit - ideal), 0, 1) : 0;
      const acc = correct + mistakes ? correct / (correct + mistakes) : 0;
      const progress = correct / total;
      const score = clamp(progress * (0.65 * speed + 0.35 * acc), 0, 1);
      g.finish(score, { time: +elapsed.toFixed(1), mistakes, correct, total },
        complete ? `ใช้เวลา ${elapsed.toFixed(1)} วินาที (รวมโทษ) ผิด ${mistakes} ครั้ง` : `หมดเวลา ทำได้ ${correct} จาก ${total} ชิ้น`);
    }
    g.on(document, 'keydown', (e) => {
      const i = digitIndex(e); const tiles = grid.querySelectorAll('button');
      if (i >= 0 && i < tiles.length && !tiles[i].disabled) { e.preventDefault(); tap(P.items.find((x) => x.id === tiles[i].dataset.id), tiles[i]); }
    });
    g.hud(`เวลา 0.0 / ${P.limit}`, `รอบ 1 / ${P.rounds}`);
    newRound();
    g.ready(() => {
      running = true;
      g.loop((dt) => {
        elapsed += dt;
        g.hud(`เวลา ${Math.min(elapsed, P.limit).toFixed(1)} / ${P.limit}`, `รอบ ${round} / ${P.rounds}  ผิด ${mistakes}`);
        if (elapsed >= P.limit) { end(false); return false; }
        return running;
      });
    }, 'คีย์บอร์ด: เลข 1-9 = แตะช่องตามตำแหน่งในตาราง');
  });
}
