// All drawn artwork: monster heads, weapons, items, avatars, and the line-icon set.
import { TAU, App } from './core.js';
import { COLORS } from './data.js';
import { ART } from './artdata.js';

// ---------- painted monster art (assets/monsters, packed by tools/make_art.py) ----------
// Head portraits replace the drawn heads wherever they exist; body frames (walk + grab) are used in the AR scope.
const MI = {}, BODY = {};
const mk = src => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; };
if (typeof Image !== 'undefined') {
  for (const k in ART.icon) MI[k] = mk(ART.icon[k]);
  for (const k in ART.body) BODY[k] = { walk: ART.body[k].walk.map(mk), grab: ART.body[k].grab.map(mk) };
}
export const imgReady = im => !!(im && im.complete && im.naturalWidth > 0);
export const bodyFrames = k => (BODY[k] && imgReady(BODY[k].walk[0]) ? BODY[k] : null);

// ---------- line icons (SVG, currentColor) ----------
export const I = {
  fire: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  freeze: '<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/><path d="m9 4 3 3 3-3M9 20l3-3 3 3"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  scan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9 6 6M22 9l-6 6"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  radar: '<circle cx="12" cy="12" r="9"/><path d="M12 12V3"/><circle cx="16" cy="9" r="1.5" fill="currentColor"/>',
  star: '<path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" fill="currentColor"/>',
  radio: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M7 8 17 3"/><circle cx="8" cy="14.5" r="2.5"/><path d="M14 13h4M14 16h4"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  flag: '<path d="M5 22V3"/><path d="M5 4h12l-2 4 2 4H5" fill="currentColor"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
  box: '<path d="M3 7 12 3l9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
  crate: '<rect x="3" y="6" width="18" height="14" rx="1"/><path d="M3 10h18M3 16h18M8 6v14M16 6v14"/>',
  ammo: '<path d="M6 21V9l2-5 2 5v12zM14 21V9l2-5 2 5v12z"/><path d="M6 17h4M14 17h4"/>',
  medkit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7"/>',
  teddy: '<circle cx="7" cy="5" r="2.5"/><circle cx="17" cy="5" r="2.5"/><circle cx="12" cy="10" r="6"/><circle cx="12" cy="12" r="1.8"/><path d="M7 16c-2 1-2 5 1 5h8c3 0 3-4 1-5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  antenna: '<path d="M12 9v13M8 22h8"/><circle cx="12" cy="7" r="2"/><path d="M7.8 3.8a6 6 0 0 0 0 6.4M16.2 3.8a6 6 0 0 1 0 6.4"/>',
  binos: '<circle cx="6.5" cy="15" r="4"/><circle cx="17.5" cy="15" r="4"/><path d="M10.5 15h3M5 11V5h4v6M15 11V5h4v6"/>',
  feet: '<path d="M7 3c-2 0-3 3-3 6s1 4 3 4 2-2 2-5-.2-5-2-5zM4.5 15h4v2a2 2 0 0 1-4 0zM17 7c2 0 3 3 3 6s-1 4-3 4-2-2-2-5 .2-5 2-5zM15.5 19h4v.5a2 2 0 0 1-4 0z"/>',
  heli: '<path d="M3 5h16M11 5v3"/><path d="M5 12a6 4 0 0 1 12 0v2H5z"/><path d="M17 12h5M21 10v4M7 17v3M15 17v3M5 20h12"/>',
  moon: '<path d="M20 15A8 8 0 1 1 9 4a6.5 6.5 0 0 0 11 11z"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="9" cy="13" r="1.5" fill="currentColor"/><circle cx="15" cy="13" r="1.5" fill="currentColor"/><path d="M9 16.5h6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  static: '<path d="M2 12h3l2-5 3 10 3-8 2 6 2-3h5"/>',
  barricade: '<path d="M3 8h18v6H3z"/><path d="m7 8-4 6M13 8l-6 6M19 8l-6 6M5 14v6M19 14v6"/>',
  target: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  clear: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 10V3.5a1.5 1.5 0 0 1 3 0V10M14 10V5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 8-7 8-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 15"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  gear: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  bag: '<path d="M6 8h12l1 13H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 10.5 6M19 11a7 7 0 0 1-.6 2.8M12 18v3M8 21h8M3 3l18 18"/>',
  pin: '<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="7" r="2.5"/><path d="M17 13c3 0 5 2 5 5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="M15 8l2-2M17 4l1-1M19 6l1.5-.5"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>',
  power: '<path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  zoomin: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6"/>',
  house: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M12 20v-5"/>',
  // room pictures for the radar (paths only, so they can be drawn on a canvas too)
  r_bed: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M5 11a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/>',
  r_sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
  r_pot: '<path d="M4 11h14v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM18 13h4M2 11h2M8 7c0-1.5 1.5-1.5 1.5-3M12.5 7c0-1.5 1.5-1.5 1.5-3"/>',
  r_tub: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
  r_toy: '<path d="M4 13h7v7H4zM13 13h7v7h-7zM8.5 4h7v7h-7z"/>',
  r_sun: '<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  r_door: '<path d="M6 21V3h12v18M3 21h18M14.5 12h.5"/>',
  r_table: '<path d="M3 9h18M5 9v11M19 9v11M3 9l2-3h14l2 3"/>'
};
// Draw one of the line icons above on a canvas, centred at x, y, size px wide.
const P2 = {};
export function pict(c, n, x, y, size, color, lw = 2.2) {
  if (!I[n] || typeof Path2D === 'undefined') return;
  if (!P2[n]) P2[n] = [...I[n].matchAll(/ d="([^"]+)"/g)].map(m => new Path2D(m[1]));
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 24, size / 24);
  c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; for (const p of P2[n]) c.stroke(p); c.restore();
}
export const svg = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

// ---------- canvas helpers ----------
export function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
export function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function blob(c, r, fill, ink) { circ(c, 0, 0, r); c.fillStyle = fill; c.fill(); c.lineWidth = r * .13; c.strokeStyle = ink; c.stroke(); }
function eye(c, x, y, er, px, py, ink) { circ(c, x, y, er); c.fillStyle = '#fff'; c.fill(); c.lineWidth = er * .3; c.strokeStyle = ink; c.stroke(); circ(c, x + px, y + py, er * .45); c.fillStyle = ink; c.fill(); }

// ---------- monster heads ----------
export function head(c, k, x, y, r, o = {}) {
  if (!o.drawn && imgReady(MI[k])) { // painted portrait
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot);
    const s = r * 2.45; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(MI[k], -s / 2, -s * .52, s, s);
    if (o.vul) { c.setLineDash([r * .3, r * .2]); c.lineWidth = r * .14; c.strokeStyle = '#ffc83a'; circ(c, 0, 0, r * 1.18); c.stroke(); c.setLineDash([]); }
    c.restore(); return;
  }
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.lineCap = 'round'; c.lineJoin = 'round';
  const L = r * .13;
  switch (k) {
    case 'z': { const ink = '#21401a';
      c.strokeStyle = ink; c.lineWidth = L; c.beginPath(); c.moveTo(-r * .15, -r * .95); c.lineTo(-r * .28, -r * 1.22); c.moveTo(r * .08, -r * .98); c.lineTo(r * .12, -r * 1.26); c.stroke();
      blob(c, r, '#8fd65f', ink);
      eye(c, -r * .36, -r * .12, r * .25, r * .04, r * .05, ink);
      c.lineWidth = L; c.strokeStyle = ink; c.beginPath(); { const ex = r * .38, ey = -r * .12, s = r * .15; c.moveTo(ex - s, ey - s); c.lineTo(ex + s, ey + s); c.moveTo(ex + s, ey - s); c.lineTo(ex - s, ey + s); } c.stroke();
      rrect(c, -r * .42, r * .3, r * .84, r * .3, r * .12); c.fillStyle = ink; c.fill(); c.fillStyle = '#f4f1d6'; c.fillRect(-r * .26, r * .3, r * .16, r * .13); c.fillRect(r * .08, r * .3, r * .16, r * .13);
      c.lineWidth = L * .7; c.beginPath(); c.moveTo(r * .08, -r * .72); c.lineTo(r * .6, -r * .5);
      for (let i = 0; i < 3; i++) { const t = i / 2, sx = r * (.16 + .36 * t), sy = -r * (.69 - .17 * t); c.moveTo(sx - r * .05, sy - r * .1); c.lineTo(sx + r * .05, sy + r * .1); } c.stroke();
      break; }
    case 'h': { const n = o.heads == null ? 3 : o.heads;
      const pos = [[0, -.3, .62], [-.5, .24, .56], [.5, .24, .56], [-.85, -.25, .45], [.85, -.25, .45]];
      const order = [3, 4, 0, 1, 2].filter(i => i < Math.max(1, n));
      for (const i of order) head(c, 'z', r * pos[i][0], r * pos[i][1], r * pos[i][2]);
      break; }
    case 'tk': { const ink = '#341a63';
      rrect(c, -r, -r * .85, r * 2, r * 1.8, r * .45); c.fillStyle = '#a978f5'; c.fill(); c.lineWidth = L; c.strokeStyle = ink; c.stroke();
      c.beginPath(); c.moveTo(-r * 1.06, -r * .2); c.quadraticCurveTo(0, -r * 1.5, r * 1.06, -r * .2); c.closePath(); c.fillStyle = o.vul ? '#d9dee0' : '#8d969c'; c.fill(); c.stroke();
      c.fillStyle = ink; for (const xx of [-.6, 0, .6]) { circ(c, r * xx, -r * (xx === 0 ? .62 : .42), r * .07); c.fill(); }
      eye(c, -r * .4, r * .12, r * .2, 0, r * .04, ink); eye(c, r * .4, r * .12, r * .2, 0, r * .04, ink);
      c.beginPath(); c.moveTo(-r * .66, -r * .1); c.lineTo(-r * .2, r * .03); c.moveTo(r * .66, -r * .1); c.lineTo(r * .2, r * .03); c.stroke();
      rrect(c, -r * .45, r * .44, r * .9, r * .24, r * .06); c.fillStyle = '#f4f1d6'; c.fill(); c.stroke();
      c.beginPath(); for (const xx of [-.15, .15]) { c.moveTo(r * xx, r * .44); c.lineTo(r * xx, r * .68); } c.stroke();
      if (o.vul) { c.strokeStyle = '#ffc83a'; c.lineWidth = L * 1.1; c.beginPath(); c.moveTo(-r * .1, -r * 1.05); c.lineTo(r * .06, -r * .72); c.lineTo(-r * .12, -r * .52); c.lineTo(r * .12, -r * .24); c.stroke(); }
      break; }
    case 'sp': { const ink = '#5e2608';
      c.strokeStyle = 'rgba(255,200,120,.85)'; c.lineWidth = L; c.beginPath(); for (const yy of [-.4, 0, .4]) { c.moveTo(-r * 1.15, r * yy); c.lineTo(-r * 1.7, r * yy); } c.stroke();
      c.beginPath(); c.moveTo(-r * .7, -r * .6); c.lineTo(-r * .95, -r * 1.15); c.lineTo(-r * .32, -r * .86); c.lineTo(-r * .2, -r * 1.32); c.lineTo(r * .2, -r * .9); c.lineTo(r * .52, -r * 1.22); c.lineTo(r * .62, -r * .7); c.closePath();
      c.fillStyle = '#e0601c'; c.fill(); c.strokeStyle = ink; c.lineWidth = L; c.stroke();
      blob(c, r, '#ff9b42', ink);
      eye(c, -r * .32, -r * .08, r * .24, r * .1, 0, ink); eye(c, r * .3, -r * .08, r * .24, r * .1, 0, ink);
      c.beginPath(); c.arc(0, r * .25, r * .45, .15 * Math.PI, .85 * Math.PI); c.closePath(); c.fillStyle = ink; c.fill();
      c.beginPath(); c.moveTo(r * .06, -r * .98); c.lineTo(-r * .16, -r * .64); c.lineTo(r * .02, -r * .64); c.lineTo(-r * .08, -r * .4); c.lineTo(r * .22, -r * .74); c.lineTo(r * .04, -r * .74); c.closePath(); c.fillStyle = '#ffe14d'; c.fill();
      break; }
    case 'iv': {
      circ(c, 0, 0, r); c.fillStyle = 'rgba(170,225,255,.22)'; c.fill(); c.setLineDash([r * .3, r * .2]); c.lineWidth = L; c.strokeStyle = '#b4e8ff'; c.stroke(); c.setLineDash([]);
      c.fillStyle = '#b4e8ff'; c.beginPath(); c.ellipse(-r * .35, -r * .1, r * .16, r * .24, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(r * .35, -r * .1, r * .16, r * .24, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0, r * .42, r * .14, r * .17, 0, 0, TAU); c.lineWidth = L * .8; c.stroke();
      break; }
    case 'sl': { const ink = '#173f3a';
      blob(c, r, '#55c7b6', ink);
      c.beginPath(); c.moveTo(-r * .88, -r * .42); c.quadraticCurveTo(-r * .1, -r * 1.45, r * .98, -r * 1.08); c.quadraticCurveTo(r * .5, -r * .8, r * .82, -r * .38); c.closePath();
      c.fillStyle = '#3d6fd1'; c.fill(); c.lineWidth = L; c.strokeStyle = ink; c.stroke();
      circ(c, r * 1.02, -r * 1.1, r * .16); c.fillStyle = '#f4f1d6'; c.fill(); c.stroke();
      c.beginPath(); c.arc(-r * .35, -r * .02, r * .18, .1 * Math.PI, .9 * Math.PI); c.stroke();
      c.beginPath(); c.arc(r * .35, -r * .02, r * .18, .1 * Math.PI, .9 * Math.PI); c.stroke();
      c.beginPath(); c.arc(0, r * .38, r * .18, .2 * Math.PI, .8 * Math.PI); c.stroke();
      c.fillStyle = 'rgba(255,140,160,.5)'; circ(c, -r * .62, r * .25, r * .13); c.fill(); circ(c, r * .62, r * .25, r * .13); c.fill();
      break; }
    case 'dn': { const ink = '#5e1238';
      c.fillStyle = '#3b2347'; for (const [xx, yy, rr] of [[-.6, -.75, .38], [0, -.95, .42], [.6, -.75, .38], [-.88, -.32, .3], [.88, -.32, .3]]) { circ(c, r * xx, r * yy, r * rr); c.fill(); }
      blob(c, r * .92, '#ff70b8', ink);
      c.fillStyle = '#14121c'; rrect(c, -r * .7, -r * .25, r * .6, r * .34, r * .12); c.fill(); rrect(c, r * .1, -r * .25, r * .6, r * .34, r * .12); c.fill(); c.fillRect(-r * .12, -r * .17, r * .24, r * .07);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(-r * .6, -r * .2, r * .14, r * .06); c.fillRect(r * .2, -r * .2, r * .14, r * .06);
      c.beginPath(); c.arc(0, r * .25, r * .38, .1 * Math.PI, .9 * Math.PI); c.lineWidth = L; c.strokeStyle = ink; c.stroke();
      break; }
    case 'cat': { const ink = '#6b3a10';
      c.fillStyle = '#ffb54d'; c.strokeStyle = ink; c.lineWidth = L;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * .85, -r * .3); c.lineTo(s * r * .75, -r * 1.15); c.lineTo(s * r * .2, -r * .8); c.closePath(); c.fill(); c.stroke(); }
      blob(c, r, '#ffb54d', ink);
      c.fillStyle = '#3a8f3a'; c.beginPath(); c.ellipse(-r * .35, -r * .08, r * .13, r * .2, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(r * .35, -r * .08, r * .13, r * .2, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff8fa3'; c.beginPath(); c.moveTo(-r * .12, r * .2); c.lineTo(r * .12, r * .2); c.lineTo(0, r * .34); c.closePath(); c.fill();
      c.lineWidth = L * .6; c.beginPath(); for (const s of [-1, 1]) { c.moveTo(s * r * .3, r * .3); c.lineTo(s * r * 1.05, r * .2); c.moveTo(s * r * .3, r * .4); c.lineTo(s * r * 1.05, r * .5); } c.stroke();
      break; }
    case 'my': {
      circ(c, 0, 0, r); c.fillStyle = '#1e2d1d'; c.fill(); c.setLineDash([r * .25, r * .18]); c.lineWidth = L; c.strokeStyle = '#8dfc9e'; c.stroke(); c.setLineDash([]);
      c.fillStyle = '#8dfc9e'; c.font = `${Math.round(r * 1.3)}px "Black Ops One", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, r * .08);
      break; }
    case 'rb': { const ink = '#2a3238';
      c.strokeStyle = ink; c.lineWidth = L; c.beginPath(); c.moveTo(0, -r * .75); c.lineTo(0, -r * 1.08); c.stroke();
      circ(c, 0, -r * 1.15, r * .16); c.fillStyle = '#ff5a4a'; c.fill(); c.stroke();
      rrect(c, -r * .85, -r * .75, r * 1.7, r * 1.5, r * .3); c.fillStyle = '#c4ccd2'; c.fill(); c.stroke();
      c.fillStyle = '#5ee6ff'; rrect(c, -r * .55, -r * .35, r * .35, r * .3, r * .08); c.fill(); rrect(c, r * .2, -r * .35, r * .35, r * .3, r * .08); c.fill();
      c.fillStyle = ink; for (let i = 0; i < 4; i++) c.fillRect(-r * .45 + i * r * .25, r * .25, r * .14, r * .22);
      break; }
  }
  c.restore();
}
export function heli(c, x, y, r, t) {
  c.save(); c.translate(x, y); c.lineWidth = r * .14; c.strokeStyle = '#2a2208'; c.lineJoin = 'round';
  c.fillStyle = '#ffc83a'; c.beginPath(); c.ellipse(0, 0, r * .9, r * .55, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(r * .8, -r * .1); c.lineTo(r * 1.8, -r * .25); c.lineTo(r * 1.8, r * .05); c.lineTo(r * .8, r * .2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#86dcff'; c.beginPath(); c.ellipse(-r * .35, -r * .1, r * .32, r * .26, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-r * .6, r * .75); c.lineTo(r * .6, r * .75); c.moveTo(-r * .35, r * .5); c.lineTo(-r * .35, r * .75); c.moveTo(r * .35, r * .5); c.lineTo(r * .35, r * .75); c.stroke();
  const w = r * 1.7 * Math.cos(t * 28); c.beginPath(); c.moveTo(-w, -r * .72); c.lineTo(w, -r * .72); c.moveTo(0, -r * .55); c.lineTo(0, -r * .72); c.stroke();
  c.restore();
}

// ---------- weapons (drawn facing right in a 100 x 50 box) ----------
export function weapon(c, k, x, y, w) {
  const s = w / 100; c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  const ink = '#151a10', lw = 2.4;
  const part = (fill, fn) => { c.beginPath(); fn(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = ink; c.stroke(); };
  const R = (x, y, w, h, r = 2) => rrect(c, x, y, w, h, r);
  switch (k) {
    case 'handgun':
      part('#3a4049', () => R(26, 14, 50, 12, 3));
      part('#252a30', () => { c.moveTo(34, 26); c.lineTo(52, 26); c.lineTo(48, 44); c.lineTo(32, 44); c.closePath(); });
      part('#5a6470', () => R(70, 17, 12, 6, 2));
      c.strokeStyle = ink; c.lineWidth = lw; c.beginPath(); c.arc(54, 29, 5, 0, Math.PI); c.stroke();
      c.fillStyle = '#ffc83a'; c.fillRect(30, 17, 10, 3);
      break;
    case 'striker':
      part('#5d6b3a', () => R(4, 18, 20, 12, 3));
      part('#6f7f45', () => R(22, 14, 46, 14, 3));
      part('#3a4049', () => R(66, 17, 26, 6, 2));
      part('#2c3026', () => { c.moveTo(38, 28); c.lineTo(48, 28); c.lineTo(52, 44); c.lineTo(42, 44); c.closePath(); });
      part('#2c3026', () => R(26, 28, 8, 14, 2));
      part('#3a4049', () => R(62, 25, 18, 6, 3));
      part('#252a30', () => R(32, 8, 22, 6, 2));
      break;
    case 'viper':
      part('#2b2f36', () => R(10, 16, 18, 10, 3));
      part('#3c434d', () => R(26, 13, 40, 14, 4));
      part('#ff6a3d', () => R(30, 15, 8, 4, 1));
      part('#3a4049', () => R(64, 16, 18, 6, 2));
      part('#1f2328', () => { c.moveTo(42, 27); c.lineTo(50, 27); c.lineTo(46, 48); c.lineTo(39, 48); c.closePath(); });
      part('#1f2328', () => R(28, 27, 8, 12, 2));
      break;
    case 'longshot':
      part('#7a6a45', () => R(2, 18, 22, 12, 4));
      part('#6b5c3a', () => R(22, 15, 38, 12, 3));
      part('#3a4049', () => R(58, 18, 40, 5, 2));
      part('#1f2328', () => R(28, 5, 26, 8, 4));
      part('#86dcff', () => R(50, 6, 4, 6, 1));
      part('#2c3026', () => R(34, 27, 8, 10, 2));
      c.strokeStyle = ink; c.lineWidth = lw; c.beginPath(); c.moveTo(70, 23); c.lineTo(64, 40); c.moveTo(70, 23); c.lineTo(76, 40); c.stroke();
      break;
    case 'laser':
      part('#d8dde2', () => R(6, 18, 18, 12, 6));
      part('#eef1f4', () => R(22, 12, 48, 16, 7));
      part('#5ee6ff', () => R(28, 16, 34, 6, 3));
      part('#9aa3ab', () => R(68, 16, 22, 8, 4));
      part('#5ee6ff', () => { c.arc(92, 20, 4, 0, TAU); });
      part('#9aa3ab', () => { c.moveTo(40, 28); c.lineTo(48, 28); c.lineTo(45, 44); c.lineTo(37, 44); c.closePath(); });
      c.strokeStyle = 'rgba(94,230,255,.8)'; c.lineWidth = 1.5; for (const xx of [34, 42, 50, 58]) { c.beginPath(); c.moveTo(xx, 14); c.lineTo(xx, 26); c.stroke(); }
      break;
    case 'cannon':
      part('#4a5530', () => R(8, 22, 18, 10, 3));
      part('#5d6b3a', () => R(20, 10, 64, 22, 8));
      part('#3a4049', () => R(80, 12, 14, 18, 4));
      part('#2c3026', () => { c.arc(40, 34, 9, 0, TAU); });
      part('#ffc83a', () => R(48, 14, 22, 4, 2));
      part('#2c3026', () => { c.moveTo(56, 32); c.lineTo(64, 32); c.lineTo(62, 46); c.lineTo(54, 46); c.closePath(); });
      break;
  }
  c.restore();
}

// ---------- items and gear (drawn in a size x size box centered at x,y) ----------
export function item(c, k, x, y, size) {
  const s = size / 100; c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  const ink = '#151a10'; c.lineWidth = 4; c.strokeStyle = ink;
  const R = (x, y, w, h, r) => rrect(c, x, y, w, h, r);
  switch (k) {
    case 'medkit': R(-38, -26, 76, 56, 10); c.fillStyle = '#f4f1e4'; c.fill(); c.stroke(); R(-14, -40, 28, 16, 5); c.stroke();
      c.fillStyle = '#e8463a'; c.fillRect(-8, -16, 16, 38); c.fillRect(-19, -5, 38, 16); break;
    case 'freezebomb': circ(c, 0, 8, 32); c.fillStyle = '#86dcff'; c.fill(); c.stroke(); R(-10, -32, 20, 12, 3); c.fillStyle = '#9aa3ab'; c.fill(); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 4; for (let a = 0; a < 3; a++) { const r = a * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(r) * -18, 8 + Math.sin(r) * -18); c.lineTo(Math.cos(r) * 18, 8 + Math.sin(r) * 18); c.stroke(); } break;
    case 'bomb': circ(c, -4, 10, 30); c.fillStyle = '#2b2f36'; c.fill(); c.stroke(); circ(c, -14, 0, 7); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
      R(8, -28, 14, 14, 3); c.fillStyle = '#9aa3ab'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(16, -28); c.quadraticCurveTo(26, -42, 34, -36); c.stroke();
      c.fillStyle = '#ffc83a'; circ(c, 36, -38, 6); c.fill(); break;
    case 'drone': c.fillStyle = '#c4ccd2'; R(-18, -10, 36, 20, 6); c.fill(); c.stroke();
      c.beginPath(); for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.moveTo(ax * 14, ay * 6); c.lineTo(ax * 30, ay * 22); } c.stroke();
      for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.ellipse(ax * 30, ay * 22, 16, 5, 0, 0, TAU); c.fillStyle = 'rgba(94,230,255,.5)'; c.fill(); c.stroke(); }
      circ(c, 0, 0, 5); c.fillStyle = '#e8463a'; c.fill(); break;
    case 'turret': c.beginPath(); c.moveTo(0, 6); c.lineTo(-26, 40); c.moveTo(0, 6); c.lineTo(26, 40); c.moveTo(0, 6); c.lineTo(0, 40); c.stroke();
      R(-20, -18, 40, 26, 6); c.fillStyle = '#6f7f45'; c.fill(); c.stroke(); R(18, -10, 26, 10, 3); c.fillStyle = '#3a4049'; c.fill(); c.stroke();
      circ(c, -4, -5, 5); c.fillStyle = '#e8463a'; c.fill(); break;
    case 'scope': R(-40, -12, 80, 24, 12); c.fillStyle = '#2b2f36'; c.fill(); c.stroke(); R(-48, -16, 14, 32, 6); c.fill(); c.stroke(); R(34, -16, 14, 32, 6); c.fill(); c.stroke();
      circ(c, 41, 0, 8); c.fillStyle = '#86dcff'; c.fill(); R(-8, 10, 16, 14, 3); c.fillStyle = '#3a4049'; c.fill(); c.stroke(); break;
    case 'vest': c.beginPath(); c.moveTo(-30, -36); c.lineTo(-12, -36); c.quadraticCurveTo(0, -22, 12, -36); c.lineTo(30, -36); c.lineTo(36, 38); c.lineTo(-36, 38); c.closePath();
      c.fillStyle = '#5d6b3a'; c.fill(); c.stroke(); c.fillStyle = '#4a5530'; R(-26, 0, 20, 16, 3); c.fill(); c.stroke(); R(6, 0, 20, 16, 3); c.fill(); c.stroke(); break;
    case 'nvg': c.lineWidth = 4; R(-38, -14, 76, 22, 10); c.fillStyle = '#2b2f36'; c.fill(); c.stroke();
      for (const sx of [-1, 1]) { R(sx * 22 - 12, -2, 24, 28, 8); c.fillStyle = '#3a4049'; c.fill(); c.stroke(); circ(c, sx * 22, 20, 9); c.fillStyle = '#8dfc9e'; c.fill(); c.stroke(); } break;
    case 'ammo': R(-40, -18, 80, 46, 6); c.fillStyle = '#6f7f45'; c.fill(); c.stroke(); c.fillStyle = '#ffc83a';
      for (const xx of [-24, -8, 8, 24]) { R(xx - 5, -38, 10, 26, 4); c.fill(); c.stroke(); } c.fillStyle = ink; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('AMMO', 0, 14); break;
    case 'booster': R(-22, -34, 44, 74, 9); c.fillStyle = '#2b2f36'; c.fill(); c.stroke(); R(-10, -44, 20, 12, 3); c.fillStyle = '#9aa3ab'; c.fill(); c.stroke();
      R(-15, -26, 30, 58, 5); c.fillStyle = '#5ee6ff'; c.fill();
      c.beginPath(); c.moveTo(4, -22); c.lineTo(-11, 4); c.lineTo(0, 4); c.lineTo(-5, 28); c.lineTo(12, -2); c.lineTo(1, -2); c.closePath(); c.fillStyle = '#ffc83a'; c.fill(); c.lineWidth = 3; c.stroke(); break;
    case 'crate': R(-40, -32, 80, 64, 4); c.fillStyle = '#b68a4a'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(-40, -32); c.lineTo(40, 32); c.moveTo(40, -32); c.lineTo(-40, 32); c.stroke();
      c.fillStyle = '#ffc83a'; circ(c, 0, 0, 12); c.fill(); c.stroke(); break;
  }
  c.restore();
}

// ---------- player avatars (soldier faces in their color) ----------
export function avatar(c, av, color, x, y, r) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; const ink = '#151a10', L = r * .12;
  const col = typeof color === 'number' ? COLORS[color % COLORS.length] : color;
  circ(c, 0, r * .12, r * .82); c.fillStyle = '#f0c49a'; c.fill(); c.lineWidth = L; c.strokeStyle = ink; c.stroke();
  circ(c, -r * .28, r * .12, r * .09); c.fillStyle = ink; c.fill(); circ(c, r * .28, r * .12, r * .09); c.fill();
  c.beginPath(); c.arc(0, r * .38, r * .22, .15 * Math.PI, .85 * Math.PI); c.lineWidth = L * .8; c.stroke();
  c.fillStyle = col; c.lineWidth = L;
  switch (av) {
    case 0: c.beginPath(); c.arc(0, -r * .05, r * .9, Math.PI, 0); c.lineTo(r * 1.0, r * .02); c.lineTo(-r * 1.0, r * .02); c.closePath(); c.fill(); c.stroke(); break; // helmet
    case 1: c.beginPath(); c.ellipse(-r * .1, -r * .45, r * .95, r * .42, -.2, 0, TAU); c.fill(); c.stroke(); circ(c, r * .55, -r * .6, r * .12); c.fillStyle = '#ffc83a'; c.fill(); c.stroke(); break; // beret
    case 2: c.beginPath(); c.arc(0, -r * .15, r * .8, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); rrect(c, 0, -r * .25, r * 1.2, r * .22, r * .1); c.fill(); c.stroke(); break; // cap
    case 3: c.beginPath(); c.arc(0, -r * .1, r * .85, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      rrect(c, -r * .75, -r * .45, r * 1.5, r * .4, r * .18); c.fillStyle = '#2b2f36'; c.fill(); c.stroke(); circ(c, -r * .32, -r * .25, r * .14); c.fillStyle = '#86dcff'; c.fill(); circ(c, r * .32, -r * .25, r * .14); c.fill(); break; // goggles
    case 4: rrect(c, -r * .9, -r * .55, r * 1.8, r * .42, r * .15); c.fill(); c.stroke(); c.beginPath(); c.moveTo(r * .85, -r * .35); c.lineTo(r * 1.25, -r * .1); c.lineTo(r * .95, r * .05); c.closePath(); c.fill(); c.stroke(); break; // bandana
    case 5: circ(c, 0, r * .05, r * 1.05); c.lineWidth = L * 1.3; c.strokeStyle = col; c.stroke(); c.lineWidth = L * .7; c.strokeStyle = ink; circ(c, 0, r * .05, r * 1.12); c.stroke();
      c.fillStyle = 'rgba(134,220,255,.18)'; circ(c, 0, r * .05, r * 1.0); c.fill(); break; // astronaut
  }
  c.restore();
}

// ---------- pre-rendered images for HTML ----------
export const IMG = { m: {}, w: {}, i: {}, a: {} };
function render(w, h, fn) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); fn(c); return cv.toDataURL(); }
export function makeImages() {
  for (const k of ['z', 'h', 'tk', 'sp', 'iv', 'sl', 'dn', 'my', 'cat', 'rb']) IMG.m[k] = ART.icon[k] || render(112, 112, c => head(c, k, 56, 62, k === 'h' ? 40 : 36, { drawn: true }));
  for (const k of ['handgun', 'striker', 'viper', 'longshot', 'laser', 'cannon']) IMG.w[k] = render(200, 100, c => weapon(c, k, 0, 2, 200));
  for (const k of ['medkit', 'freezebomb', 'bomb', 'booster', 'drone', 'turret', 'scope', 'vest', 'nvg', 'ammo', 'crate']) IMG.i[k] = render(112, 112, c => item(c, k, 56, 58, 100));
  for (let a = 0; a < 6; a++) for (let col = 0; col < 6; col++) IMG.a[a + '_' + col] = render(96, 96, c => avatar(c, a, col, 48, 52, 34));
}
export const avImg = (av, col) => IMG.a[(av | 0) + '_' + (col | 0)] || IMG.a['0_0'];
// Icon HTML for the ticker and buttons: monster/weapon/item images where they exist, otherwise a line icon.
export function icHTML(k) {
  if (IMG.m[k]) return `<img src="${IMG.m[k]}" alt="">`;
  if (IMG.i[k]) return `<img src="${IMG.i[k]}" alt="">`;
  if (IMG.w[k]) return `<img src="${IMG.w[k]}" alt="" class="wimg">`;
  return svg(k || 'radio');
}
App.art = { head, heli, weapon, item, avatar, svg, icHTML };
