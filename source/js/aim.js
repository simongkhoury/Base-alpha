// Hit chance for one shot at one monster: distance, where the trooper is facing, and walls.
// Shared by the commander (who rolls the dice) and every phone (which draws the aim cone and lock-on).
import { App } from './core.js';
import { ROOMS, B, roomAt, AREA, route, WEAPONS, MIN_ACC } from './data.js';

export const FAR_ACC = 0.05;   // floor for hopeless shots (way out of range or aimed the wrong way)
export const NEAR_CONE = 60;   // aim half-angle (degrees) right next to you; narrows to WEAPONS[w].cone at full range
export const WALL_FACTOR = 0.25;
const POINT_BLANK = 80;        // this close, the direction doesn't matter

// Openings between areas. Shots pass through these; any other boundary crossed is a wall.
const OPEN = new Set(['balcony|living', 'kitchen|living']);          // glass doors and the open kitchen
const DOORS = {                                                       // [x, y, half-width]
  'hall|kitchen': [[480, 1024, 75]], 'hall|master': [[350, 1085, 45]], 'bath|hall': [[600, 1066, 42]],
  'hall|toy': [[450, 1128, 50]], 'base|hall': [[550, 1110, 50]]
};
const pair = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// Number of walls the straight line from a to b goes through.
export function wallsBetween(a, b) {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
  let prev = null, px = a.x, py = a.y, w = 0;
  for (let i = 0; i <= n; i++) {
    const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n, r = roomAt(x, y); if (!r) continue;
    const ar = AREA(r);
    if (prev && ar !== prev) {
      const k = pair(prev, ar), mx = (px + x) / 2, my = (py + y) / 2;
      if (!OPEN.has(k) && !(DOORS[k] || []).some(([dx, dy, h]) => Math.hypot(mx - dx, my - dy) < h)) w++;
    }
    prev = ar; px = x; py = y;
  }
  return w;
}
// Without a compass the trooper's spot is only known by room, so distance is measured walking through the doors.
export function walkDist(pos, room, t) {
  const tr = roomAt(t.x, t.y) || t.room;
  if (!room || !tr || AREA(room) === AREA(tr)) return Math.hypot(t.x - pos.x, t.y - pos.y);
  const path = route(room, tr); if (!path.length) return Math.hypot(t.x - pos.x, t.y - pos.y);
  let d = 0, p = pos;
  for (const r of path.slice(0, -1)) { const q = ROOMS[r]; d += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
  return d + Math.hypot(t.x - p.x, t.y - p.y);
}
export const bearing = (a, b) => Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI;   // map degrees, 0 = up
export const angOff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
export const coneAt = (W, d) => NEAR_CONE + (W.cone - NEAR_CONE) * Math.min(1, d / W.rng);

// o: { pos, room, t, w, aim (map degrees, or null without tracking), scope }
// Returns the chance plus the parts, so screens can explain it.
export function odds(o) {
  const W = WEAPONS[o.w] || WEAPONS.handgun, t = o.t, pos = o.pos || ROOMS[o.room] || B;
  const tracked = typeof o.aim === 'number' && isFinite(o.aim);
  const d = tracked ? Math.hypot(t.x - pos.x, t.y - pos.y) : walkDist(pos, o.room, t);
  const pin = Math.min(.98, Math.max(MIN_ACC, W.acc - W.fall * d / 100 + (o.scope ? .12 : 0)));
  const over = Math.max(0, d - W.rng), gR = over ? Math.exp(-Math.pow(over / (.3 * W.rng), 2)) : 1;
  let off = 0, cone = 180, gH = 1, walls = 0;
  if (tracked) {
    cone = coneAt(W, d); off = d < POINT_BLANK ? 0 : angOff(bearing(pos, t), o.aim);
    if (off > cone) gH = Math.exp(-Math.pow((off - cone) / 15, 2));
    walls = wallsBetween(pos, t);
  }
  const p = (FAR_ACC + (pin - FAR_ACC) * gR * gH) * Math.pow(WALL_FACTOR, walls);
  return { p, d, off, cone, walls, inRange: !over, inCone: off <= cone, clear: !over && off <= cone && !walls };
}
// The monster a shot goes to: the best chance wins; a tapped target is kept unless something is much easier.
export function pickTarget(list, o, selId) {
  let best = null, bo = null, sel = null, so = null;
  for (const t of list) {
    const r = odds(Object.assign({}, o, { t }));
    if (t.id === selId) { sel = t; so = r; }
    if (!bo || r.p > bo.p + 1e-6 || (Math.abs(r.p - bo.p) < 1e-6 && r.d < bo.d)) { best = t; bo = r; }
  }
  if (sel && (!bo || so.p >= bo.p * .8)) return { t: sel, o: so };
  return best ? { t: best, o: bo } : null;
}
App.aim = { odds, pickTarget, wallsBetween, walkDist, coneAt };
