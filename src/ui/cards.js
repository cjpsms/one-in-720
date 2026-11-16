// Shareable PNG cards drawn on a canvas (birth registration card, ending card). No external assets.
import { drawDotsInto } from './dots.js';

const SERIF = '"Charter","Noto Serif Thai","Noto Serif Thai UI","Sarabun",Georgia,serif';
const SANS = '"Sarabun","Noto Sans Thai","Noto Sans Thai UI","Leelawadee UI",Tahoma,system-ui,sans-serif';
const MONO = 'ui-monospace,"IBM Plex Mono","DejaVu Sans Mono",Menlo,Consolas,monospace';
const COL = { bg: '#0e151a', card: '#151e25', card2: '#1a252d', fg: '#e8ece9', muted: '#8a989c', line: '#26333b', accent: '#e8688a', accentFg: '#1b0910', teal: '#4fc3a1', bad: '#f08b7e' };

let segmenter = null;
function segments(text) {
  try {
    if (!segmenter && typeof Intl !== 'undefined' && Intl.Segmenter) segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    if (segmenter) return [...segmenter.segment(text)].map((s) => s.segment);
  } catch { /* fall through */ }
  return Array.from(text);
}
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let cur = '';
    for (const seg of segments(para)) {
      const test = cur + seg;
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur.trimEnd()); cur = seg.trimStart(); } else cur = test;
    }
    lines.push(cur.trimEnd());
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, x, y);
}
function paragraph(ctx, str, x, y, maxW, font, color, lh, maxLines = 99) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left';
  const lines = wrapText(ctx, str, maxW).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function frame({ width = 1080, header, headerRight, headerColor, headerFg, build }) {
  const tall = document.createElement('canvas');
  tall.width = width; tall.height = 3200;
  const ctx = tall.getContext('2d');
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, width, 3200);
  const x0 = 56; const w = width - 112; const top = 56;
  // header bar
  ctx.save(); roundRect(ctx, x0, top, w, 3000, 18); ctx.clip();
  ctx.fillStyle = COL.card; ctx.fillRect(x0, top, w, 3000);
  ctx.fillStyle = headerColor; ctx.fillRect(x0, top, w, 150);
  text(ctx, header, x0 + 40, top + 76, `700 54px ${SERIF}`, headerFg);
  text(ctx, headerRight, x0 + 40, top + 122, `500 28px ${MONO}`, headerFg);
  ctx.restore();
  let y = build(ctx, x0 + 40, top + 150 + 30, w - 80);
  y += 40;
  text(ctx, '1 ใน 720', x0 + w / 2, y + 6, `700 34px ${SERIF}`, COL.accent, 'center');
  const total = y + 56;
  const out = document.createElement('canvas');
  out.width = width; out.height = Math.ceil(total + 56);
  const o = out.getContext('2d');
  o.fillStyle = COL.bg; o.fillRect(0, 0, out.width, out.height);
  o.drawImage(tall, 0, 0, width, total, 0, 0, width, total);
  o.strokeStyle = COL.line; o.lineWidth = 2; roundRect(o, x0 + 1, top + 1, w - 2, total - top - 28, 18); o.stroke();
  return out;
}

function fieldsGrid(ctx, rows, x, y, w) {
  const colW = (w - 40) / 2;
  let cy = y; let rowH = 0;
  rows.forEach(([label, value], i) => {
    const col = i % 2; const cx = x + col * (colW + 40);
    ctx.font = `600 22px ${MONO}`; ctx.fillStyle = COL.muted; ctx.textAlign = 'left';
    ctx.fillText(String(label), cx, cy + 20);
    ctx.font = `600 32px ${SANS}`; ctx.fillStyle = COL.fg;
    const lines = wrapText(ctx, String(value), colW).slice(0, 3);
    lines.forEach((l, k) => ctx.fillText(l, cx, cy + 62 + k * 42));
    rowH = Math.max(rowH, 62 + (lines.length - 1) * 42 + 30);
    if (col === 1 || i === rows.length - 1) { cy += rowH + 14; rowH = 0; }
  });
  return cy;
}

export function drawBirthCard({ name, regNo, sentence, rows, schoolMap, me }) {
  return frame({
    header: 'ทะเบียนแรกเข้า', headerRight: `No. ${regNo || '720-0000-000000'}`, headerColor: COL.accent, headerFg: COL.accentFg,
    build(ctx, x, y, w) {
      let cy = y + 20;
      text(ctx, 'ชื่อ', x, cy + 18, `600 22px ${MONO}`, COL.muted);
      cy += 40;
      ctx.font = `700 78px ${SERIF}`;
      const nl = wrapText(ctx, name || '-', w).slice(0, 2);
      nl.forEach((l, i) => text(ctx, l, x, cy + 66 + i * 90, `700 78px ${SERIF}`, COL.fg));
      cy += 66 + (nl.length - 1) * 90 + 40;
      cy = paragraph(ctx, sentence || '', x, cy + 14, w, `400 34px ${SANS}`, COL.fg, 54, 7) + 22;
      ctx.strokeStyle = COL.line; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke(); ctx.setLineDash([]);
      cy = fieldsGrid(ctx, rows || [], x, cy + 26, w) + 16;
      drawDotsInto(ctx, x, cy, w, 230, schoolMap, me, { accent: COL.accent, fg: COL.fg, muted: COL.muted });
      ctx.strokeStyle = COL.line; ctx.lineWidth = 2; roundRect(ctx, x, cy, w, 230, 12); ctx.stroke();
      return cy + 230 + 10;
    },
  });
}

export function drawEndingCard({ name, title, sentence, rows, moments, schoolMap, me }) {
  return frame({
    header: 'บันทึกสุดท้าย', headerRight: name ? `${name} · ชีวิตจบแล้ว` : 'ชีวิตจบแล้ว', headerColor: COL.teal, headerFg: '#04140f',
    build(ctx, x, y, w) {
      let cy = y + 30;
      ctx.font = `700 72px ${SERIF}`;
      const tl = wrapText(ctx, title || '', w).slice(0, 2);
      tl.forEach((l, i) => text(ctx, l, x, cy + 60 + i * 84, `700 72px ${SERIF}`, COL.fg));
      cy += 60 + (tl.length - 1) * 84 + 30;
      if (sentence) cy = paragraph(ctx, sentence, x, cy + 20, w, `400 32px ${SANS}`, COL.muted, 50, 4) + 10;
      cy += 14;
      ctx.strokeStyle = COL.line; ctx.setLineDash([2, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke(); ctx.setLineDash([]);
      cy = fieldsGrid(ctx, rows || [], x, cy + 26, w) + 10;
      if (moments && moments.length) {
        text(ctx, 'ช่วงเวลาที่จำได้', x, cy + 34, `700 36px ${SERIF}`, COL.fg);
        cy += 54;
        for (const m of moments.slice(0, 4)) {
          text(ctx, m.label || '', x, cy + 30, `500 22px ${MONO}`, COL.muted);
          cy = paragraph(ctx, m.text, x + 90, cy + 30, w - 90, `400 30px ${SANS}`, m.tone === 'bad' ? COL.bad : COL.fg, 44, 3) + 18;
        }
      }
      cy += 12;
      drawDotsInto(ctx, x, cy, w, 210, schoolMap, me, { accent: COL.accent, fg: COL.fg, muted: COL.muted });
      ctx.strokeStyle = COL.line; ctx.lineWidth = 2; roundRect(ctx, x, cy, w, 210, 12); ctx.stroke();
      return cy + 210 + 10;
    },
  });
}

export function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    const finish = (blob) => {
      if (!blob) { resolve(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(true);
    };
    try { canvas.toBlob(finish, 'image/png'); } catch { resolve(false); }
  });
}
