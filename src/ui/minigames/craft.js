// Mini game "craft": decorate a krathong or a costume. Pick a part, tap a slot to place it (tap a filled slot to take it
// off). Scored on a rubric: palette match, left-right symmetry, variety, and how full it is (CONTRACT3 section 5).
import { mount, h, clamp, botScore, colorDist, digitIndex } from './kit.js';

export const INFO = {
  id: 'craft',
  title: 'ตกแต่งชิ้นงาน',
  how: 'เลือกชิ้นส่วนด้านล่าง แล้วแตะตำแหน่งบนชิ้นงานเพื่อวาง ใช้สีตามธีม ให้ซ้ายขวาเหมือนกัน และใช้ชิ้นส่วนหลายแบบ',
};

export function bot(spec, rng) { return botScore(spec, rng, 0.7, 0.1); }

const COSTUME_SLOTS = [
  { id: 'hat', x: 50, y: 9, pair: null }, { id: 'torso', x: 50, y: 44, pair: null },
  { id: 'shL', x: 26, y: 29, pair: 'shR' }, { id: 'shR', x: 74, y: 29, pair: 'shL' },
  { id: 'waist', x: 50, y: 60, pair: null },
  { id: 'lgL', x: 38, y: 76, pair: 'lgR' }, { id: 'lgR', x: 62, y: 76, pair: 'lgL' },
  { id: 'ftL', x: 34, y: 92, pair: 'ftR' }, { id: 'ftR', x: 66, y: 92, pair: 'ftL' },
  { id: 'hdL', x: 12, y: 56, pair: 'hdR' }, { id: 'hdR', x: 88, y: 56, pair: 'hdL' },
  { id: 'collar', x: 50, y: 24, pair: null },
];

function norm(p) {
  p = p || {};
  const kind = p.kind === 'costume' ? 'costume' : p.kind === 'tree' ? 'tree' : 'krathong';
  const theme = { name: String((p.theme && p.theme.name) || 'ธีมอิสระ'), palette: Array.isArray(p.theme && p.theme.palette) ? p.theme.palette.map(String) : [] };
  const all = (Array.isArray(p.pieces) ? p.pieces : []).filter((x) => x && x.id != null);
  const baseP = all.find((x) => x.kind === 'base'); // a 'base' piece is the tree itself, not a part to place
  let pieces = all.filter((x) => x.kind !== 'base').map((x) => ({ id: String(x.id), name: String(x.name || x.id), color: String(x.color || '#cccccc'), kind: String(x.kind || 'flower') }));
  if (!pieces.length) pieces = [{ id: 'f1', name: 'ดอกไม้', color: '#e8688a', kind: 'flower' }, { id: 'l1', name: 'ใบตอง', color: '#3f8f4a', kind: 'leaf' }, { id: 'c1', name: 'เทียน', color: '#f6e7a8', kind: 'candle' }];
  const max = kind === 'costume' ? COSTUME_SLOTS.length : kind === 'tree' ? 15 : 13;
  const slots = clamp(Math.round(Number(p.slots) || 8), kind === 'costume' ? 4 : 5, max);
  const r = p.rubric || {};
  const w = { palette: Number(r.palette) || 0.4, symmetry: Number(r.symmetry) || 0.3, variety: Number(r.variety) || 0.3 };
  const sum = w.palette + w.symmetry + w.variety;
  return { kind, base: baseP ? String(baseP.color || '#2f7a3e') : '#2f7a3e', theme, pieces, slots, w: { palette: w.palette / sum, symmetry: w.symmetry / sum, variety: w.variety / sum } };
}

// slot layout: [{ id, x, y, pair }] in percent of the board
function layout(kind, n) {
  if (kind === 'costume') return COSTUME_SLOTS.slice(0, n).map((s) => ({ ...s, pair: COSTUME_SLOTS.slice(0, n).some((o) => o.id === s.pair) ? s.pair : null }));
  if (kind === 'tree') { // rows of 1, 2, 3 ... slots in a triangle, mirrored around the middle
    const rows = []; let left = n; for (let r = 0; left > 0; r++) { const k = Math.min(r + 1, left); rows.push(k); left -= k; }
    const out = [];
    rows.forEach((k, r) => { for (let i = 0; i < k; i++) { out.push({ id: `t${r}_${i}`, x: k === 1 ? 50 : 50 + (i - (k - 1) / 2) * 24, y: 20 + r * (66 / Math.max(1, rows.length - 1 || 1)) * (rows.length > 1 ? 1 : 0), pair: k > 1 ? `t${r}_${k - 1 - i}` : null }); } });
    return out.map((s) => ({ ...s, pair: s.pair === s.id ? null : s.pair }));
  }
  const out = [{ id: 's0', x: 50, y: 50, pair: null, center: true }];
  const r = n - 1;
  for (let k = 0; k < r; k++) {
    const a = (-90 + (k * 360) / r) * (Math.PI / 180);
    const m = (r - k) % r;
    out.push({ id: `s${k + 1}`, x: 50 + 37 * Math.cos(a), y: 50 + 37 * Math.sin(a), pair: m === k ? null : `s${m + 1}` });
  }
  return out;
}

// rubric 0..1 for a filled board (exported for tests): placed = { slotId: pieceId|null }
export function rubric(P, slots, placed) {
  const byId = new Map(P.pieces.map((x) => [x.id, x]));
  const filled = slots.filter((s) => placed[s.id]);
  const fill = filled.length / slots.length;
  let pal = 1;
  if (P.theme.palette.length) {
    pal = filled.length ? filled.filter((s) => { const pc = byId.get(placed[s.id]); return pc && P.theme.palette.some((c) => colorDist(c, pc.color) < 70); }).length / filled.length : 0;
  }
  const seen = new Set(); const pairs = [];
  for (const s of slots) if (s.pair && !seen.has(s.id)) { seen.add(s.id); seen.add(s.pair); pairs.push([s.id, s.pair]); }
  const sym = pairs.length ? pairs.filter(([a, b]) => placed[a] && placed[a] === placed[b]).length / pairs.length : 1;
  const distinct = new Set(filled.map((s) => placed[s.id])).size;
  const want = Math.min(4, new Set(P.pieces.map((x) => x.id)).size);
  const variety = clamp(distinct / want, 0, 1);
  const raw = P.w.palette * pal + P.w.symmetry * sym + P.w.variety * variety;
  return { score: clamp(raw * (0.35 + 0.65 * fill), 0, 1), pal, sym, variety, fill };
}

function pieceEl(pc, small) {
  return h('span', { class: `mg-pc k-${pc.kind}${small ? ' sm' : ''}`, style: `--c:${pc.color}`, 'aria-hidden': 'true' }, h('i'));
}

export function play(container, spec, done) {
  const P = norm(spec && spec.params);
  return mount(container, spec, INFO, done, (g) => {
    const D = Math.max(15, Number(spec.durationSec) || 30);
    const slots = layout(P.kind, P.slots);
    const placed = {};
    let sel = P.pieces[0].id;
    let t = 0;

    const board = h('div', { class: `mg-c-board ${P.kind}` });
    if (P.kind === 'krathong') board.append(h('i', { class: 'mg-c-base' }), h('i', { class: 'mg-c-base b2' }));
    else if (P.kind === 'tree') board.append(h('div', { class: 'mg-c-tree', style: `--tc:${P.base}` }, h('i'), h('i'), h('i'), h('b')));
    else board.append(h('i', { class: 'mg-c-fig' }));
    const btns = new Map();
    slots.forEach((s, i) => {
      const b = h('button', { type: 'button', class: `mg-c-slot${s.center ? ' center' : ''}`, style: `left:${s.x}%;top:${s.y}%`, 'aria-label': `ตำแหน่ง ${i + 1}`, onclick: () => place(s.id) });
      btns.set(s.id, b); board.append(b);
    });
    const trayBtns = P.pieces.map((pc, i) => h('button', { type: 'button', class: 'mg-c-pc', 'data-id': pc.id, 'aria-pressed': String(pc.id === sel), onclick: () => choose(pc.id) },
      pieceEl(pc), h('span', { class: 'mg-c-nm', text: pc.name }), i < 9 ? h('small', { class: 'mono', text: String(i + 1) }) : null));
    const tray = h('div', { class: 'mg-c-tray', role: 'group', 'aria-label': 'ชิ้นส่วน' }, trayBtns);
    const theme = h('div', { class: 'mg-c-theme' }, h('span', { class: 'label', text: 'ธีม' }), h('b', { text: P.theme.name }),
      h('span', { class: 'mg-c-pal' }, P.theme.palette.map((c) => h('i', { style: `background:${c}`, title: c }))));
    const finishBtn = h('button', { type: 'button', class: 'btn primary block', onclick: () => end() }, 'เสร็จแล้ว');
    g.stage.append(theme, board, tray, finishBtn);

    function choose(id) { sel = id; trayBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); }
    function paint(id) {
      const b = btns.get(id); const pid = placed[id];
      b.replaceChildren();
      b.classList.toggle('on', !!pid);
      if (pid) { const pc = P.pieces.find((x) => x.id === pid); if (pc) b.append(pieceEl(pc)); }
    }
    function place(id) {
      if (!g.alive) return;
      if (placed[id] && placed[id] === sel) delete placed[id];
      else placed[id] = sel;
      paint(id);
      const n = Object.keys(placed).length;
      g.hud(`เวลา ${Math.max(0, Math.ceil(D - t))}`, `วางแล้ว ${n} / ${slots.length}`);
    }
    function end() {
      const r = rubric(P, slots, placed);
      g.finish(r.score, { palette: +r.pal.toFixed(2), symmetry: +r.sym.toFixed(2), variety: +r.variety.toFixed(2), filled: +r.fill.toFixed(2) },
        `สีตามธีม ${Math.round(r.pal * 100)}%  สมมาตร ${Math.round(r.sym * 100)}%  ความหลากหลาย ${Math.round(r.variety * 100)}%  วางครบ ${Math.round(r.fill * 100)}%`);
    }
    g.on(document, 'keydown', (e) => { const i = digitIndex(e); if (i >= 0 && i < P.pieces.length) { e.preventDefault(); choose(P.pieces[i].id); } });
    g.hud(`เวลา ${Math.ceil(D)}`, `วางแล้ว 0 / ${slots.length}`);
    g.ready(() => {
      g.loop((dt) => {
        t += dt;
        g.hud(`เวลา ${Math.max(0, Math.ceil(D - t))}`, `วางแล้ว ${Object.keys(placed).length} / ${slots.length}`);
        if (t >= D) { end(); return false; }
        return true;
      });
    }, 'คีย์บอร์ด: เลข 1-9 = เลือกชิ้นส่วน, Tab แล้ว Enter = วาง');
  });
}
