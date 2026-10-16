// Shared namespace and helpers. Modules register themselves on App to avoid import cycles.
export const App = {};

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const TAU = Math.PI * 2;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10);

export function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}
export function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

// Settings that belong to this phone only.
export const S = Object.assign({
  rot: 0,          // radar rotation in degrees
  speaker: null,   // does this phone play shared announcements (null = decide by role)
  sound: true,     // master sound on this phone
  view: 'dock',
  shotMode: 'snap', // 'snap' | 'one' | 'each'
  sens: 0.55,      // detection sensitivity 0..1
  strict: 0.78,    // match strictness 0..1 (cosine similarity floor)
  micOn: false,
  lastCode: ''
}, load('ba2.settings', {}));
export const saveS = () => store('ba2.settings', S);

// This phone's player profile.
export const ME = Object.assign({ id: 'p' + uid(), name: '', color: 0, av: 0 }, load('ba2.profile', {}));
export const saveMe = () => store('ba2.profile', ME);
if (!load('ba2.profile', null)) saveMe();
