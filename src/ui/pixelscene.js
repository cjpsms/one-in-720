// Procedural pixel-art scene (canvas, no image files): sky, buildings, ground and little characters that change with
// the place and the time of day. Logical size 172 x 50, scaled up by CSS with image-rendering: pixelated.
import { hashRand, reducedMotion } from './dom.js';

export const SCENE_W = 172;
export const SCENE_H = 50;

// ---------- place -> scene kind ----------
export function classifyPlace(place, minute) {
  const p = String(place || '');
  if (/กีฬาสี|แสตน|เชียร์/.test(p)) return 'sports';
  if (/คริสต์มาส|ซานต้า/.test(p)) return 'hallxmas';
  if (/ห้องพยาบาล|พยาบาล/.test(p)) return 'infirmary';
  if (/หอประชุม/.test(p)) return 'hall';
  if (/ลอยกระทง|ลานงาน|งานวัด|ตลาดนัด/.test(p)) return 'fair';
  if (/เวที|งานราตรี/.test(p)) return 'stage';
  if (/โรงอาหาร|ครัว|กินข้าว/.test(p)) return 'canteen';
  if (/สหกรณ์|ห้องปริ้น|ร้านค้า/.test(p)) return 'coop';
  if (/สนาม|พละ|พลศึกษา|ศ\.กีฬา|โรงยิม/.test(p)) return 'field';
  if (/บ้าน/.test(p)) return 'home';
  if (/แถว|เคารพธง|ลานหน้า/.test(p)) return 'assembly';
  if (/หอ|ห้องนอน|นอน/.test(p) && !/หน้าหอ/.test(p)) return 'dorm';
  if (/ห้อง|คาบ|เรียน|ศูนย์|COM|lab/i.test(p)) return 'class';
  return minute != null && minute < 8 * 60 + 30 && minute > 6 * 60 ? 'assembly' : 'yard';
}

// ---------- colours ----------
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => { const x = hex(a); const y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const SKY = [
  [0, '#0a1024', '#16224a'], [5, '#101a3e', '#2a3a6e'], [6, '#3d3b73', '#f29b7a'], [7, '#5aa4dc', '#f6d9b0'],
  [10, '#5eb0e8', '#b9e4f7'], [16, '#5eb0e8', '#cfe9f4'], [17.5, '#7a5aa0', '#f6a468'], [18.5, '#26305e', '#8a5a82'],
  [20, '#0c1430', '#1a2650'], [24, '#0a1024', '#16224a'],
];
function skyAt(hour) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i]; const b = SKY[i + 1];
    if (hour >= a[0] && hour <= b[0]) { const t = (hour - a[0]) / (b[0] - a[0] || 1); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  }
  return [SKY[0][1], SKY[0][2]];
}
function lightAt(hour) {
  const e = Math.sin(((hour - 6) / 12) * Math.PI);
  return Math.max(0, Math.min(1, 0.36 + 0.7 * Math.max(0, Math.min(1, e * 1.6 + 0.15)))); // 0.36 night .. 1 day
}
const SKINS = ['#f1c9a0', '#e0ac7e', '#c68c5c', '#9a6a46'];
const HAIRS = ['#1a1410', '#2b1d14', '#3d2a1b', '#0d0d12'];

export function mountScene(canvas) {
  canvas.width = SCENE_W; canvas.height = SCENE_H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const motion = !reducedMotion();
  let info = { kind: 'yard', hour: 8, seed: 1 };
  let timer = 0; let t0 = 0; let alive = true;

  const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };

  function person(x, y, o) {
    const { skin, hair, shirt, bottom, long, back, girl, f = 0, seated } = o;
    R(x + 1, y, 3, 1, hair);
    if (long) { R(x, y + 1, 1, 3, hair); R(x + 4, y + 1, 1, 3, hair); }
    R(x + 1, y + 1, 3, 2, back ? hair : skin);
    if (!back) { R(x + 1, y + 2, 1, 1, '#1c1c24'); R(x + 3, y + 2, 1, 1, '#1c1c24'); }
    R(x + 1, y + 3, 3, 3, shirt);
    const sw = f ? 1 : 0;
    R(x, y + 3 + sw, 1, 3 - sw, shirt); R(x + 4, y + 4 - sw, 1, 2 + sw, shirt);
    if (seated) return;
    if (girl) { R(x + 1, y + 6, 3, 2, bottom); R(x + 1, y + 8, 1, 1, skin); R(x + 3, y + 8, 1, 1, skin); }
    else { R(x + 1, y + 6, 1, 3 - (f ? 1 : 0), bottom); R(x + 3, y + 6, 1, 2 + (f ? 1 : 0), bottom); }
    R(x + 1, y + 9 - (f ? 1 : 0), 1, 1, '#16161c'); R(x + 3, y + 8 + (f ? 1 : 0), 1, 1, '#16161c');
  }
  const look = (rnd, uniform, light) => {
    const girl = rnd() < 0.5;
    return {
      skin: SKINS[Math.floor(rnd() * SKINS.length)], hair: HAIRS[Math.floor(rnd() * HAIRS.length)], girl, long: girl && rnd() < 0.6,
      shirt: uniform ? mix('#f4f3ee', '#10131c', 1 - light * 0.9 > 0 ? (1 - light) * 0.55 : 0) : ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0', '#b07ad8', '#e8884a'][Math.floor(rnd() * 6)],
      bottom: uniform ? mix('#26324f', '#0a0e1c', 1 - light) : ['#26324f', '#3a3a44', '#5a4632'][Math.floor(rnd() * 3)],
    };
  };
  const tint = (c, light) => mix('#05070f', c, light);
  const meMark = (x, y) => { R(x + 1, y - 3, 3, 1, '#e8688a'); R(x + 2, y - 2, 1, 1, '#e8688a'); };

  function sky(hour, light, f) {
    const [top, bot] = skyAt(hour);
    for (let i = 0; i < 8; i++) R(0, i * 5, SCENE_W, 5, mix(top, bot, i / 7));
    const night = light < 0.55;
    const rnd = hashRand(77);
    if (night) for (let i = 0; i < 26; i++) { const x = Math.floor(rnd() * SCENE_W); const y = Math.floor(rnd() * 24); const tw = (i + f) % 5 === 0; R(x, y, 1, 1, tw ? '#8c98c8' : '#e8ecff'); }
    if (hour >= 6 && hour < 18) {
      const t = (hour - 6) / 12; const sx = 14 + t * (SCENE_W - 28); const sy = 28 - Math.sin(t * Math.PI) * 22;
      R(sx - 3, sy - 3, 6, 6, '#fff3b0'); R(sx - 4, sy - 2, 8, 4, '#fff3b0'); R(sx - 2, sy - 4, 4, 8, '#fff3b0');
      if (hour < 7.5 || hour > 16.5) R(sx - 6, sy - 1, 12, 2, mix('#fff3b0', top, 0.6));
    } else {
      const t = (((hour + 6) % 24) % 12) / 12; const mx = 14 + t * (SCENE_W - 28); const my = 26 - Math.sin(t * Math.PI) * 18;
      R(mx - 3, my - 3, 6, 6, '#f4efd2'); R(mx - 2, my - 4, 4, 8, '#f4efd2'); R(mx - 4, my - 2, 8, 4, '#f4efd2');
      R(mx + 1, my - 3, 3, 5, mix(top, bot, 0.3));
    }
    const cc = mix('#ffffff', '#2a3560', 1 - light);
    for (let i = 0; i < 3; i++) {
      const x = ((i * 63 + (motion ? f * 1.2 : 0)) % (SCENE_W + 30)) - 20; const y = 6 + i * 7;
      R(x + 3, y, 10, 2, cc); R(x, y + 2, 17, 2, cc); R(x + 4, y + 4, 9, 1, mix(cc, '#000000', 0.12));
    }
    // far hills
    for (let x = 0; x < SCENE_W; x++) {
      const y = 33 + Math.round(Math.sin(x * 0.06 + 1) * 3 + Math.sin(x * 0.15) * 1.5);
      R(x, y, 1, 8, tint('#4c8a5e', light * 0.85));
    }
  }
  function ground(y, col, f) {
    R(0, y, SCENE_W, SCENE_H - y, tint(col, 0.0 + lightAt(info.hour)));
    R(0, y, SCENE_W, 1, tint(mix(col, '#ffffff', 0.18), lightAt(info.hour)));
    R(0, SCENE_H - 5, SCENE_W, 5, tint('#7a5a3a', lightAt(info.hour)));
    const rnd = hashRand(5); for (let i = 0; i < 18; i++) R(Math.floor(rnd() * SCENE_W), y + 2 + Math.floor(rnd() * (SCENE_H - y - 4)), 2, 1, tint(mix(col, '#000000', 0.2), lightAt(info.hour)));
  }
  function tree(x, y, light) {
    R(x + 3, y + 8, 2, 7, tint('#6a4a2a', light));
    R(x, y + 2, 8, 6, tint('#2f7a3e', light)); R(x + 1, y, 6, 3, tint('#3b8d4a', light)); R(x + 2, y + 7, 4, 1, tint('#2a6a36', light));
  }
  function building(x, y, w, h, light, f, floors = 2) {
    R(x, y, w, h, tint('#d9c9a6', light)); R(x - 1, y - 3, w + 2, 3, tint('#b04a3a', light)); R(x - 1, y - 4, w + 2, 1, tint('#8c3a2e', light));
    const lit = light < 0.62;
    for (let fl = 0; fl < floors; fl++) for (let wx = x + 4; wx < x + w - 6; wx += 9) {
      R(wx, y + 3 + fl * 8, 5, 4, lit ? '#ffe9a0' : tint('#6aa0c8', light)); R(wx, y + 5 + fl * 8, 5, 1, tint('#b0b8c0', light));
    }
    R(x + (w >> 1) - 2, y + h - 6, 5, 6, tint('#6a4a2a', light));
  }
  function floorRoom(y, col, light) {
    R(0, y, SCENE_W, SCENE_H - y, tint(col, light)); for (let x = 0; x < SCENE_W; x += 12) R(x, y, 1, SCENE_H - y, tint(mix(col, '#000000', 0.2), light));
  }
  function wallRoom(col, light) { R(0, 0, SCENE_W, 36, tint(col, light)); R(0, 34, SCENE_W, 2, tint(mix(col, '#000000', 0.3), light)); }

  // ---------- scenes ----------
  function sceneYard(c) {
    sky(c.hour, c.light, c.f); building(24, 16, 120, 20, c.light, c.f, 2); ground(37, '#4d9a58', c.f);
    R(0, 41, SCENE_W, 4, tint('#c9b58c', c.light)); tree(6, 22, c.light); tree(152, 21, c.light);
    for (let i = 0; i < 5; i++) { const L = look(c.rnd, true, c.light); const sp = 5 + i * 3; const x = ((i * 41 + (motion ? c.f * sp * 0.5 : 0)) % (SCENE_W + 20)) - 8; person(x, 34, { ...L, f: (c.f + i) % 2 }); if (i === 0) meMark(x, 34); }
  }
  function sceneAssembly(c) {
    sky(c.hour, c.light, c.f); building(100, 18, 62, 18, c.light, c.f, 2); ground(37, '#4d9a58', c.f);
    R(72, 8, 1, 29, tint('#c8ccd2', c.light)); const wave = c.f % 2; R(73, 9, 8, 2, '#cc3a44'); R(73, 11 + wave, 8, 1, '#f4f3ee'); R(73, 12 + wave, 8, 1, '#2b3f8a');
    R(8, 32, 12, 3, tint('#8a6a4a', c.light)); person(11, 24, { ...look(c.rnd, true, c.light), f: 0 });
    for (let row = 0; row < 3; row++) for (let i = 0; i < 13; i++) {
      const L = look(c.rnd, true, c.light); const x = 22 + i * 10 + (row % 2) * 4; const y = 25 + row * 6 - (row === 0 ? 0 : 0);
      person(x, y, { ...L, back: true, f: 0 }); if (row === 1 && i === 6) meMark(x, y);
    }
  }
  function sceneField(c) {
    sky(c.hour, c.light, c.f); building(124, 20, 44, 14, c.light, c.f, 1); ground(36, '#3f9a4e', c.f);
    R(10, 40, SCENE_W - 20, 1, tint('#e8f0e0', c.light)); R(86, 37, 1, 8, tint('#e8f0e0', c.light)); R(150, 36, 1, 8, tint('#f4f3ee', c.light)); R(150, 36, 5, 1, tint('#f4f3ee', c.light));
    const bx = 40 + ((c.f * 7) % 90); const by = 40 - Math.abs(Math.sin(c.f * 0.9)) * 5; R(bx, by, 2, 2, '#f4f3ee');
    for (let i = 0; i < 4; i++) { const L = look(c.rnd, false, c.light); const x = ((i * 37 + c.f * (3 + i)) % 130) + 10; person(x, 33, { ...L, f: (c.f + i) % 2 }); if (i === 0) meMark(x, 33); }
  }
  function sceneHome(c) {
    sky(c.hour, c.light, c.f); ground(37, '#55a05a', c.f); tree(10, 20, c.light); tree(146, 22, c.light);
    R(50, 20, 62, 17, tint('#e6d8bc', c.light)); R(46, 16, 70, 5, tint('#b04a3a', c.light)); R(54, 12, 54, 4, tint('#b04a3a', c.light)); R(60, 9, 42, 3, tint('#b04a3a', c.light));
    const lit = c.light < 0.7; R(58, 24, 8, 6, lit ? '#ffe9a0' : tint('#6aa0c8', c.light)); R(96, 24, 8, 6, lit ? '#ffe9a0' : tint('#6aa0c8', c.light)); R(77, 26, 8, 11, tint('#6a4a2a', c.light));
    for (let x = 6; x < 166; x += 6) { R(x, 36, 1, 5, tint('#d8d2c0', c.light)); } R(4, 38, 164, 1, tint('#d8d2c0', c.light));
    const fam = [[122, 'p'], [130, 'p'], [138, 'k']];
    fam.forEach(([x, k], i) => { const L = look(c.rnd, false, c.light); person(x, k === 'k' ? 31 : 28, { ...L, f: 0, girl: i === 1, long: i === 1 }); if (i === 2) meMark(x, 31); });
  }
  function sceneCanteen(c) {
    wallRoom('#caa86e', c.light); floorRoom(36, '#9a8a70', c.light); R(0, 0, SCENE_W, 4, tint('#6a4a2a', c.light));
    const cols = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0', '#e8884a'];
    cols.forEach((col, i) => { const x = 10 + i * 32; R(x, 5, 26, 4, tint(col, c.light)); R(x + 1, 9, 24, 11, tint('#4a3a2a', c.light)); R(x + 3, 11, 20, 4, tint('#e8d8b8', c.light)); R(x + 2, 20, 22, 3, tint('#7a6a58', c.light)); });
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 54; R(x, 33, 34, 3, tint('#b08a5a', c.light)); R(x + 2, 36, 2, 8, tint('#7a5a3a', c.light)); R(x + 30, 36, 2, 8, tint('#7a5a3a', c.light));
      for (let k = 0; k < 2; k++) { const L = look(c.rnd, true, c.light); const px = x + 3 + k * 17; person(px, 22 + (c.f + i + k) % 2, { ...L, back: k === 1, seated: true }); if (i === 1 && k === 0) meMark(px, 22); R(px, 33, 6, 1, '#e8e8e0'); }
    }
  }
  function sceneClass(c) {
    wallRoom('#c8d6c2', c.light); floorRoom(36, '#a89070', c.light); R(0, 0, SCENE_W, 3, tint('#fff6d6', c.light * 0.9 + 0.1));
    R(24, 8, 70, 20, tint('#2f4a3f', c.light)); R(24, 8, 70, 1, tint('#6a4a2a', c.light)); R(24, 27, 70, 2, tint('#6a4a2a', c.light));
    const rnd = hashRand(3); for (let i = 0; i < 5; i++) R(30 + Math.floor(rnd() * 50), 12 + i * 3, 8 + Math.floor(rnd() * 20), 1, tint('#dfe8e0', c.light));
    person(98, 22, { ...look(c.rnd, false, c.light), f: c.f % 2, back: false });
    const [top, bot] = skyAt(c.hour); R(120, 6, 36, 20, tint('#e8e8e2', c.light)); R(122, 8, 32, 16, mix(top, bot, 0.5)); R(137, 8, 2, 16, tint('#e8e8e2', c.light));
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
      const x = 10 + i * 27 + row * 6; const y = 31 + row * 7;
      const L = look(c.rnd, true, c.light); person(x + 2, y - 7, { ...L, back: true, seated: true, f: 0 }); if (row === 0 && i === 3) meMark(x + 2, y - 7);
      R(x, y, 14, 2, tint('#b08a5a', c.light)); R(x + 1, y + 2, 1, 5, tint('#7a5a3a', c.light)); R(x + 12, y + 2, 1, 5, tint('#7a5a3a', c.light));
    }
  }
  function sceneDorm(c) {
    const night = c.hour >= 21.5 || c.hour < 5.5; const lt = night ? 0.5 : Math.max(0.7, c.light);
    wallRoom('#6f8fa0', lt); floorRoom(36, '#7a6a58', lt);
    const [top, bot] = skyAt(c.hour); R(70, 6, 30, 20, tint('#e0e0d8', lt)); R(72, 8, 26, 16, mix(top, bot, 0.4));
    if (night) { R(90, 11, 4, 4, '#f4efd2'); R(78, 13, 1, 1, '#e8ecff'); R(84, 19, 1, 1, '#e8ecff'); }
    R(10, 12, 36, 4, tint('#6a4a2a', lt)); R(10, 24, 36, 3, tint('#6a4a2a', lt)); R(10, 12, 3, 28, tint('#6a4a2a', lt)); R(43, 12, 3, 28, tint('#6a4a2a', lt));
    R(14, 8, 28, 4, tint('#9ab0d8', lt)); R(14, 21, 28, 3, tint('#d8a0b0', lt));
    const L1 = look(c.rnd, false, lt); if (night) { R(16, 18, 6, 3, L1.hair); R(22, 19, 14, 2, tint('#e8e8f0', lt)); if (c.f % 2) { R(24, 14, 2, 1, '#cfd8ff'); R(27, 11, 3, 1, '#cfd8ff'); } }
    else person(20, 11, { ...L1, seated: true });
    R(112, 24, 40, 3, tint('#b08a5a', lt)); R(114, 27, 2, 12, tint('#7a5a3a', lt)); R(148, 27, 2, 12, tint('#7a5a3a', lt)); R(128, 16, 10, 8, tint('#2a3a50', lt)); R(129, 17, 8, 5, c.f % 7 === 0 ? '#8ab8e8' : '#4a78b8');
    person(122, 15, { ...look(c.rnd, false, lt), seated: true, back: true, f: 0 }); meMark(122, 15);
    R(144, 20, 2, 4, '#ffd978'); R(143, 19, 4, 1, '#ffd978');
    if (night) { g.globalAlpha = 0.5; R(0, 0, SCENE_W, SCENE_H, '#04060e'); g.globalAlpha = 0.22; R(130, 6, 34, 32, '#ffd978'); g.globalAlpha = 1; }
  }
  function sceneCoop(c) {
    wallRoom('#d8c8a8', c.light); floorRoom(36, '#9a8a78', c.light);
    for (let s = 0; s < 3; s++) for (let i = 0; i < 12; i++) { const col = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0', '#e8884a', '#b07ad8'][(i * 5 + s * 2) % 6]; R(8 + i * 8, 6 + s * 9, 6, 6, tint(col, c.light)); }
    for (let s = 0; s < 3; s++) R(6, 12 + s * 9, SCENE_W - 12, 1, tint('#7a5a3a', c.light));
    R(100, 28, 60, 5, tint('#7a5a3a', c.light)); R(100, 33, 60, 8, tint('#5a4026', c.light)); person(126, 19, { ...look(c.rnd, false, c.light), f: 0 });
    for (let i = 0; i < 3; i++) { const x = 60 + i * 12; const L = look(c.rnd, true, c.light); person(x, 29, { ...L, back: true, f: (c.f + i) % 2 }); if (i === 2) meMark(x, 29); }
  }

  // ---------- festival scenes (CONTRACT3: hall, fair, stage) ----------
  function sceneHall(c) {
    const lt = 0.82;
    wallRoom('#3b4864', lt); floorRoom(36, '#8a6a4a', lt);
    for (let x = 22; x < 150; x += 16) { R(x, 1, 7, 2, '#ffe9a0'); g.globalAlpha = 0.12; R(x - 2, 3, 11, 6, '#ffe9a0'); g.globalAlpha = 1; }
    for (let i = 0; i < 2; i++) { const x = i ? 154 : 0; R(x, 0, 18, 37, tint('#7a1f2b', lt)); for (let k = 0; k < 18; k += 4) R(x + k, 0, 1, 37, tint('#5a1520', lt)); }
    R(30, 31, 112, 5, tint('#6a4a2a', lt)); R(30, 31, 112, 1, tint('#a07a4a', lt));
    R(50, 5, 72, 25, '#232a33'); R(52, 7, 68, 21, '#e8eee9');
    const rnd = hashRand(11); R(56, 11, 36, 3, '#2f4a6a'); for (let i = 0; i < 4; i++) R(56, 17 + i * 3, 14 + Math.floor(rnd() * 40), 1, '#8aa0b4');
    const pulse = c.f % 6 === 0; R(100, 12, 14, 10, pulse ? '#e8688a' : '#4fc3a1');
    g.globalAlpha = 0.1; R(48, 4, 76, 28, '#9ad0ff'); g.globalAlpha = 1;
    person(40, 24, { ...look(c.rnd, false, lt), f: c.f % 2 }); R(37, 31, 9, 1, tint('#2a1a10', lt));
    for (let row = 0; row < 3; row++) for (let i = 0; i < 14; i++) {
      const L = look(c.rnd, true, lt); const x = 8 + i * 11 + (row % 2) * 5; const y = 32 + row * 6;
      const nod = (i * 5 + row * 3) % 11 === 0 && c.f % 4 < 2 ? 1 : 0;
      person(x, y + nod, { ...L, back: true, seated: true, f: 0 }); if (row === 1 && i === 7) meMark(x, y);
    }
  }
  function sceneFair(c) {
    const hr = Math.max(17.6, Math.min(22, c.hour)); const lt = lightAt(hr);
    sky(hr, lt, c.f); ground(35, '#3c7a48', c.f);
    R(0, 46, SCENE_W, 4, tint('#c9b58c', lt));
    // string of lanterns
    const cols = ['#e83a44', '#ff9a3a', '#ffd24a', '#e8688a'];
    for (let x = 0; x < SCENE_W; x++) R(x, 8 + Math.round(Math.sin(x * 0.07) * 2), 1, 1, '#3a2a20');
    for (let x = 4, i = 0; x < SCENE_W; x += 9, i++) {
      const y = 9 + Math.round(Math.sin(x * 0.07) * 2); const col = cols[i % 4];
      g.globalAlpha = 0.25; R(x - 2, y, 7, 8, col); g.globalAlpha = 1; R(x, y + 1, 3, 4, col); R(x + 1, y + 5, 1, 1, '#3a2a20');
    }
    // stalls
    [8, 48, 88, 128].forEach((x, k) => {
      const a = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0'][k];
      R(x, 25, 30, 10, tint('#5a4026', lt)); R(x + 1, 27, 28, 8, tint('#2a1c10', lt));
      for (let j = 0; j < 30; j += 6) { R(x + j, 18, 6, 4, tint(j % 12 ? '#f4f3ee' : a, lt)); R(x + j, 22, 6, 1, tint(mix(a, '#000000', 0.3), lt)); }
      R(x - 1, 18, 1, 17, tint('#7a5a3a', lt)); R(x + 30, 18, 1, 17, tint('#7a5a3a', lt));
      g.globalAlpha = 0.3; R(x + 4, 22, 22, 12, '#ffd978'); g.globalAlpha = 1;
      person(x + 12, 24 + (c.f + k) % 2 * 0, { ...look(c.rnd, false, lt), f: (c.f + k) % 2 });
      R(x + 2, 33, 26, 2, tint('#b08a5a', lt));
    });
    // pond with krathong
    R(0, 41, SCENE_W, 7, tint('#27507a', lt)); for (let x = (c.f * 2) % 8; x < SCENE_W; x += 8) R(x, 43, 4, 1, tint('#4a7aa8', lt));
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 33 + ((c.f + i) % 3); const y = 42 + (i % 2) * 2;
      R(x, y, 7, 2, tint('#3f8f4a', lt)); R(x + 1, y - 1, 5, 1, tint('#e8688a', lt)); R(x + 3, y - 3, 1, 2, '#f6e7a8'); R(x + 3, y - 4 - (c.f + i) % 2, 1, 1, '#ff9a3a');
      g.globalAlpha = 0.2; R(x - 2, y - 4, 11, 8, '#ff9a3a'); g.globalAlpha = 1;
    }
    for (let i = 0; i < 4; i++) { const L = look(c.rnd, false, lt); const x = ((i * 47 + (motion ? c.f * (3 + i) * 0.5 : 0)) % (SCENE_W + 20)) - 8; person(x, 36, { ...L, f: (c.f + i) % 2 }); if (i === 0) meMark(x, 36); }
  }
  function sceneStage(c) {
    const lt = 0.7;
    R(0, 0, SCENE_W, 50, '#0d0a18'); R(0, 34, SCENE_W, 16, tint('#6a4a30', lt));
    for (let x = 20; x < 150; x += 4) R(x, 0, 2, 33, '#15122a');
    // spotlights
    const lc = ['#ff9ab8', '#9ad0ff', '#ffe08a'];
    for (let i = 0; i < 3; i++) {
      const cx = 44 + i * 42 + (c.f % 3 === i ? 3 : 0); R(cx - 3, 0, 6, 3, '#2a2a3a');
      g.globalAlpha = 0.16 + ((c.f + i) % 3 === 0 ? 0.08 : 0);
      for (let y = 3; y < 36; y++) { const w = 3 + (y - 3) * 0.55; R(cx - w, y, w * 2, 1, lc[i]); }
      g.globalAlpha = 1;
    }
    R(20, 33, 132, 3, tint('#9a7048', lt)); R(20, 36, 132, 1, tint('#4a3220', lt));
    // curtains + valance
    for (let i = 0; i < 2; i++) { const x = i ? 152 : 0; R(x, 0, 20, 36, '#7a1f2b'); for (let k = 0; k < 20; k += 4) R(x + k, 0, 1, 36, '#5a1520'); R(x + (i ? 0 : 19), 0, 1, 36, '#a03040'); }
    R(0, 0, SCENE_W, 5, '#5a1520'); for (let x = 0; x < SCENE_W; x += 8) R(x, 5, 4, 2, '#7a1f2b');
    const shirts = ['#e8688a', '#4fc3a1', '#e0b04a', '#6a8be0'];
    for (let i = 0; i < 3; i++) { const x = 58 + i * 26; person(x, 21 - (motion && (c.f + i) % 2 ? 1 : 0), { ...look(c.rnd, false, lt), shirt: shirts[i], bottom: '#1b1b2a', f: (c.f + i) % 2 }); }
    R(62, 22, 1, 1, '#cfd8ff'); R(65, 20, 1, 3, '#2a2a3a');
    // audience silhouettes
    for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
      const x = 4 + i * 11 + row * 5; const y = 41 + row * 5; const L = look(c.rnd, true, 0.4);
      person(x, y, { ...L, back: true, seated: true, f: 0 }); if (row === 0 && i === 8) meMark(x, y);
      if ((i + c.f) % 9 === 0) { g.globalAlpha = 0.9; R(x - 1, y - 5, 1, 3, '#cfd8ff'); g.globalAlpha = 1; }
    }
  }

  // Christmas hall party: the hall with a tree, red and green lights, Santa on the stage and candy in the air
  function sceneHallXmas(c) {
    const lt = 0.82;
    wallRoom('#2f4a5a', lt); floorRoom(36, '#8a6a4a', lt);
    for (let x = 0; x < SCENE_W; x += 6) { const y = 2 + Math.round(Math.sin(x * 0.12) * 1.5); R(x, y, 2, 2, ['#e83a44', '#4fc3a1', '#ffd24a'][(x / 6 + (c.f % 3)) % 3 | 0]); }
    for (let i = 0; i < 2; i++) { const x = i ? 154 : 0; R(x, 0, 18, 37, tint('#7a1f2b', lt)); for (let k = 0; k < 18; k += 4) R(x + k, 0, 1, 37, tint('#5a1520', lt)); }
    R(28, 31, 116, 5, tint('#6a4a2a', lt)); R(28, 31, 116, 1, tint('#a07a4a', lt));
    // tree (left)
    for (let t = 0; t < 4; t++) { const w = 8 + t * 6; R(37 - w / 2, 8 + t * 6, w, 6, tint('#2f7a3e', lt)); R(37 - w / 2 + 1, 8 + t * 6, w - 2, 1, tint('#3b8d4a', lt)); }
    R(36, 32, 3, 3, tint('#6a4a2a', lt)); R(36, 5, 3, 3, '#ffd24a');
    [[33, 15], [40, 16], [31, 22], [43, 23], [35, 28], [41, 29], [37, 12]].forEach(([x, y], i) => R(x, y, 2, 2, ['#e83a44', '#ffd24a', '#6a8be0'][(i + c.f) % 3]));
    // snow window
    R(84, 8, 36, 20, '#232a33'); R(86, 10, 32, 16, '#12203a'); const rnd = hashRand(21); for (let i = 0; i < 14; i++) R(86 + Math.floor(rnd() * 31), 10 + (Math.floor(rnd() * 15) + c.f) % 16, 1, 1, '#ffffff');
    // Santa
    const sx = 100; R(sx, 21, 6, 8, '#d02a38'); R(sx - 1, 24, 1, 5, '#d02a38'); R(sx + 6, 22 - (c.f % 2), 1, 6, '#d02a38'); R(sx + 1, 17, 4, 4, '#f1c9a0'); R(sx + 1, 20, 4, 2, '#ffffff'); R(sx, 15, 6, 3, '#d02a38'); R(sx + 5, 14, 2, 2, '#ffffff'); R(sx, 29, 6, 1, '#16161c');
    for (let i = 0; i < 7; i++) { const cx = 10 + ((i * 23 + c.f * 5) % 150); const cy = 12 + ((i * 11 + c.f * 6) % 22); R(cx, cy, 2, 2, ['#e83a44', '#ffd24a', '#4fc3a1', '#e8688a'][i % 4]); }
    for (let row = 0; row < 3; row++) for (let i = 0; i < 14; i++) {
      const L = look(c.rnd, true, lt); const x = 8 + i * 11 + (row % 2) * 5; const y = 32 + row * 6;
      person(x, y, { ...L, back: true, seated: true, f: 0 }); if ((i * 3 + row) % 5 === 0) R(x + 1, y - 1, 3, 1, '#d02a38'); if (row === 1 && i === 7) meMark(x, y);
    }
  }
  // school infirmary: a bed with a patient, a curtain, the nurse at her desk, a red cross on the wall
  function sceneInfirmary(c) {
    const lt = 0.9;
    wallRoom('#d8e6e0', lt); floorRoom(36, '#b8c8c2', lt);
    R(0, 0, SCENE_W, 3, tint('#fff6d6', 0.9)); R(80, 6, 14, 14, '#ffffff'); R(85, 8, 4, 10, '#d02a38'); R(82, 11, 10, 4, '#d02a38');
    const [top, bot] = skyAt(c.hour); R(120, 6, 30, 20, tint('#e8e8e2', lt)); R(122, 8, 26, 16, mix(top, bot, 0.5)); R(134, 8, 2, 16, tint('#e8e8e2', lt));
    // curtain on a rail
    R(0, 4, 56, 2, '#8a97a0'); for (let x = 0; x < 56; x += 4) { R(x, 6, 3, 30, tint(x % 8 ? '#a8c8e0' : '#90b4d0', lt)); }
    // bed
    R(14, 24, 54, 4, tint('#7a8a92', lt)); R(14, 28, 2, 10, tint('#7a8a92', lt)); R(66, 28, 2, 10, tint('#7a8a92', lt));
    R(16, 20, 50, 5, tint('#ffffff', lt)); R(16, 22, 36, 3, tint('#a8c8e0', lt)); R(54, 18, 11, 5, tint('#f4f4f0', lt));
    const L = look(c.rnd, false, lt); R(56, 19, 7, 3, L.skin); R(55, 18, 8, 2, L.hair); if (c.f % 4 < 2) R(60, 14, 2, 1, '#9fb0b8');
    R(9, 22, 1, 12, tint('#9aa6ac', lt)); R(6, 21, 7, 1, tint('#9aa6ac', lt)); R(8, 17, 3, 4, '#cfe6f0');
    // nurse desk
    R(100, 28, 40, 4, tint('#b08a5a', lt)); R(102, 32, 3, 8, tint('#7a5a3a', lt)); R(136, 32, 3, 8, tint('#7a5a3a', lt));
    R(108, 24, 8, 4, '#ffffff'); R(124, 24, 3, 4, '#d02a38');
    const nurse = look(c.rnd, false, lt); person(112, 18 + (c.f % 2 ? 0 : 0), { ...nurse, girl: true, long: true, shirt: '#ffffff', bottom: '#ffffff', f: 0 }); R(112, 16, 5, 1, '#ffffff'); R(114, 15, 1, 1, '#d02a38');
    person(84, 28, { ...look(c.rnd, true, lt), f: c.f % 2 }); meMark(84, 28);
  }

  // colour sports day: the field with four colour stands, banners, a running track and a few runners
  function sceneSports(c) {
    const lt = Math.max(lightAt(c.hour), 0.9);
    sky(c.hour, c.light, c.f); ground(36, '#3f9a4e', c.f);
    const cols = ['#e0414f', '#e8c23a', '#9a5ad0', '#4aa3e0'];
    cols.forEach((col, i) => {
      const x = 6 + i * 41;
      R(x, 20, 36, 3, tint('#8a8f96', lt)); R(x, 23, 36, 9, tint(mix(col, '#000000', 0.2), lt)); R(x, 32, 36, 2, tint('#6a6f76', lt));
      for (let k = 0; k < 9; k++) { const L = look(c.rnd, false, lt); R(x + 2 + k * 4, 23 + ((k + c.f) % 2), 3, 3, L.skin); R(x + 2 + k * 4, 26 + ((k + c.f) % 2), 3, 3, col); }
      R(x + 17, 6, 1, 14, tint('#c8ccd2', lt)); const w = c.f % 2; R(x + 18, 6, 9, 5, col); R(x + 18, 11 + w, 7, 2, col);
    });
    for (let x = 0; x < SCENE_W; x += 5) R(x, 4 + (x % 10 ? 1 : 0), 4, 3, cols[(x / 5) % 4 | 0]);
    R(0, 40, SCENE_W, 8, tint('#c4613a', lt)); for (let i = 0; i < 4; i++) R(0, 41 + i * 2, SCENE_W, 1, tint('#f4efe2', lt));
    R(150, 38, 2, 10, tint('#f4f3ee', lt)); R(150, 38, 8, 2, '#e8688a');
    for (let i = 0; i < 4; i++) { const L = look(c.rnd, false, lt); const x = ((i * 31 + c.f * (4 + i)) % 140) + 6; person(x, 33 + (i % 2) * 2, { ...L, shirt: cols[i], bottom: '#1b1b2a', f: (c.f + i) % 2 }); if (i === 0) meMark(x, 33); }
  }

  const SCENES = { sports: sceneSports, hallxmas: sceneHallXmas, infirmary: sceneInfirmary, hall: sceneHall, fair: sceneFair, stage: sceneStage, yard: sceneYard, assembly: sceneAssembly, field: sceneField, home: sceneHome, canteen: sceneCanteen, class: sceneClass, dorm: sceneDorm, coop: sceneCoop };

  function draw(now) {
    if (!alive) return;
    const f = motion ? Math.floor((now - t0) / 420) : 0;
    const hour = info.hour;
    const ctx = { hour, light: lightAt(hour), f, rnd: hashRand((info.seed * 31 + (info.kind.length * 977)) >>> 0) };
    const fn = SCENES[info.kind] || sceneYard;
    g.globalAlpha = 1;
    fn(ctx);
  }
  const loop = () => { draw(performance.now()); };
  const start = () => { t0 = performance.now(); loop(); if (motion && !timer) timer = setInterval(loop, 420); };
  start();
  return {
    set(next) { info = { ...info, ...next }; loop(); },
    destroy() { alive = false; clearInterval(timer); timer = 0; },
  };
}
