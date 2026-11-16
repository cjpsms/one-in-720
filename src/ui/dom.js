// Small DOM + storage helpers shared by the app shell and the new screens.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// localStorage, always wrapped
export function lsGet(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function lsDel(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
export function lsGetJson(key, fallback) {
  const t = lsGet(key);
  if (t == null) return fallback;
  try { return JSON.parse(t); } catch { return fallback; }
}
export function lsSetJson(key, value) { return lsSet(key, JSON.stringify(value)); }

// ---------- preferences ----------
const PREF_KEY = 'one-in-720-prefs-v1';
const DEFAULT_PREFS = { theme: 'dark', speed: 1, mode: 'routine' };
let prefs = null;
export function getPrefs() {
  if (!prefs) prefs = { ...DEFAULT_PREFS, ...(lsGetJson(PREF_KEY, {}) || {}) };
  return prefs;
}
export function setPref(key, value) {
  getPrefs()[key] = value;
  lsSetJson(PREF_KEY, prefs);
  if (key === 'theme') applyTheme();
}
export function applyTheme() {
  const t = getPrefs().theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#ffffff' : '#0e151a');
}

// tiny seeded hash random for decorative drawings (not game state)
export function hashRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(str) {
  let h32 = 2166136261;
  for (let i = 0; i < str.length; i++) { h32 ^= str.charCodeAt(i); h32 = Math.imul(h32, 16777619); }
  return h32 >>> 0;
}

export const THAI_DAYS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

// "ม.6 เทอม 1" -> "ม.6 ท1" (short year label for the narrow record column)
export const shortYear = (s) => String(s || '').replace(/\s*เทอม\s*(\d)/, ' ท$1');
