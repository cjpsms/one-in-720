// The life record (log lines with year labels) and the keepsakes (starred lines kept across lives).
import { lsGetJson, lsSetJson } from './dom.js';

const KEEP_KEY = 'one-in-720-keep-v1';
const MAX_LINES = 600;
const MAX_KEEP = 120;

export function lineId(lifeId, l) { return `${lifeId}|${l.day == null ? '' : l.day}|${l.text}`; }

export function loadKeep() {
  const v = lsGetJson(KEEP_KEY, []);
  return Array.isArray(v) ? v : [];
}

export function createRecord(lifeId) {
  let lines = [];
  let keep = loadKeep();
  const api = {
    lifeId,
    get lines() { return lines; },
    get keep() { return keep; },
    reset(seed) { lines = []; if (Array.isArray(seed)) api.add(seed); },
    add(list) {
      const fresh = (Array.isArray(list) ? list : []).filter((l) => l && l.text).map((l) => ({
        t: l.t || '', text: l.text, tone: l.tone || 'neutral', day: l.day == null ? null : l.day, yearLabel: l.yearLabel || '',
      }));
      lines.push(...fresh);
      if (lines.length > MAX_LINES) lines = lines.slice(-MAX_LINES);
      return fresh;
    },
    isStarred(l) { const id = lineId(lifeId, l); return keep.some((k) => k.id === id); },
    toggleStar(l, who) {
      const id = lineId(lifeId, l);
      const i = keep.findIndex((k) => k.id === id);
      if (i >= 0) keep.splice(i, 1);
      else {
        keep.unshift({ id, life: who || '', yearLabel: l.yearLabel || '', text: l.text, tone: l.tone || 'neutral' });
        if (keep.length > MAX_KEEP) keep = keep.slice(0, MAX_KEEP);
      }
      lsSetJson(KEEP_KEY, keep);
      return i < 0;
    },
    starredOfLife() { return keep.filter((k) => k.id.startsWith(`${lifeId}|`)); },
    reloadKeep() { keep = loadKeep(); },
  };
  return api;
}
