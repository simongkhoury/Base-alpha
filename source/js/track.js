// Movement tracking by steps and compass ("pedestrian dead reckoning").
// Each step moves this phone's trooper one step length in the compass direction, but never
// through a wall: a step into a room that doesn't connect to the current one slides or stops.
// Calibration: walk base -> balcony -> base. The step count gives the step length, and the
// average walking direction gives the compass offset of the floor plan. No pointing needed.
import { App, S, saveS, load, store } from './core.js';
import { ROOMS, B, roomAt, AREA, areasTouch, route } from './data.js';

const CAL_ROUTE = ['base', ...route('base', 'balcony')];
const ROUTE_LEN = CAL_ROUTE.slice(1).reduce((s, r, i) => s + Math.hypot(ROOMS[r].x - ROOMS[CAL_ROUTE[i]].x, ROOMS[r].y - ROOMS[CAL_ROUTE[i]].y), 0);
const NET_BEARING = Math.atan2(ROOMS.balcony.x - B.x, -(ROOMS.balcony.y - B.y)) * 180 / Math.PI; // map bearing base -> balcony

// Forward direction of a phone held anywhere between flat and upright: the horizontal part of
// its top edge plus the horizontal part of where the back camera looks (W3C Z-X'-Y'' angles).
function compassFromEuler(alpha, beta, gamma) {
  const d = Math.PI / 180, a = (alpha || 0) * d, b = (beta || 0) * d, g = (gamma || 0) * d;
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b), sg = Math.sin(g), cg = Math.cos(g);
  const E = -sa * cb + (-sg * ca - cg * sb * sa), N = ca * cb + (-sg * sa + cg * sb * ca);
  return ((Math.atan2(E, N) * 180 / Math.PI) % 360 + 360) % 360;
}
const wrap = a => ((a % 360) + 360) % 360;
const angAvg = list => { let sx = 0, sy = 0; for (const a of list) { sx += Math.sin(a * Math.PI / 180); sy += Math.cos(a * Math.PI / 180); } return { a: wrap(Math.atan2(sx, sy) * 180 / Math.PI), r: Math.hypot(sx, sy) / Math.max(1, list.length) }; };

export const Track = {
  on: false, heading: null, steps: 0, err: '', p: null, room: 'base', lastSendT: 0, lastSentRoom: null,
  cal: load('ba2.track', null), // { offset, stepLen }
  calib: null, // { phase: 'out'|'back', n1, n2, hOut: [], hBack: [] }
  g: null, f: 0, up: false, lastStepT: 0,
  supported() { return 'DeviceMotionEvent' in window && 'DeviceOrientationEvent' in window; },
  async enable() {
    this.err = '';
    if (!this.supported()) { this.err = 'This browser has no motion sensors.'; throw new Error(this.err); }
    try {
      if (typeof DeviceMotionEvent.requestPermission === 'function' && await DeviceMotionEvent.requestPermission() !== 'granted') throw 0;
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && await DeviceOrientationEvent.requestPermission() !== 'granted') throw 0;
    } catch (e) { this.err = 'Motion and compass access was refused. On iPhone: Settings > Safari > Motion & Orientation Access, then reload.'; throw new Error(this.err); }
    if (!this._m) {
      this._m = e => this.onMotion(e); this._o = e => this.onOrient(e);
      window.addEventListener('devicemotion', this._m);
      window.addEventListener('ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation', this._o);
    }
    this.on = true; S.trackOn = true; saveS();
    const P = App.game.G.players[App.myId()]; this.resetTo(P ? P.room : 'base');
  },
  disable() { this.on = false; S.trackOn = false; saveS(); },
  // Where this trooper faces on the floor plan (degrees, 0 = up the map), or null when not tracking.
  aim() { return this.on && this.cal && !this.calib && this.heading != null && performance.now() - (this.hT || 0) < 2500 ? wrap(this.heading - this.cal.offset) : null; },
  ready() { return this.aim() != null && !!this.p; },
  onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;
    else if (e.absolute || e.type === 'deviceorientationabsolute') h = compassFromEuler(e.alpha, e.beta, e.gamma);
    if (h == null || isNaN(h)) return;
    const so = (screen.orientation && screen.orientation.angle) || 0; h = wrap(h + so);
    this.hT = performance.now();
    if (this.heading == null) this.heading = h;
    else { const d = ((h - this.heading + 540) % 360) - 180; this.heading = wrap(this.heading + d * .25); }
  },
  onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
    const m = Math.hypot(a.x, a.y, a.z), t = performance.now();
    this.g = this.g == null ? m : this.g * .97 + m * .03;          // gravity / slow drift
    this.f = this.f * .6 + (m - this.g) * .4;                      // smoothed bounce
    if (!this.up && this.f > 1.2 && t - this.lastStepT > 280) { this.up = true; this.lastStepT = t; this.onStep(); }
    if (this.f < .3) this.up = false;
  },
  onStep() {
    this.steps++;
    const c = this.calib;
    if (c && this.heading != null) { if (c.phase === 'out') { c.n1++; c.hOut.push(this.heading); } else if (c.phase === 'back') { c.n2++; c.hBack.push(this.heading); } }
    if (!this.on || !this.cal || this.heading == null || !this.p || c) return;
    const G = App.game.G; if (G.phase !== 'play' || G.paused) return;
    const h = (this.heading - this.cal.offset) * Math.PI / 180, L = this.cal.stepLen;
    const nx = this.p.x + Math.sin(h) * L, ny = this.p.y - Math.cos(h) * L;
    const okRoom = r => r && areasTouch(AREA(this.room), AREA(r));
    let r = roomAt(nx, ny);
    if (okRoom(r)) { this.p = { x: nx, y: ny }; this.room = r; }
    else if (!r && okRoom(roomAt(nx + (nx - this.p.x) * .7, ny + (ny - this.p.y) * .7))) { this.p = { x: nx, y: ny }; } // in a doorway: keep going
    else { const rx = roomAt(nx, this.p.y), ry = roomAt(this.p.x, ny);
      if (okRoom(rx)) { this.p.x = nx; this.room = rx; } else if (okRoom(ry)) { this.p.y = ny; this.room = ry; } }
    this.send();
  },
  send() {
    const now = performance.now(); if (now - this.lastSendT < 200) { clearTimeout(this._t); this._t = setTimeout(() => this.send(), 220); return; }
    this.lastSendT = now; this.lastSentRoom = this.room; App.ui.act({ a: 'pos', x: Math.round(this.p.x), y: Math.round(this.p.y) });
  },
  resetTo(room, at) { const r = at && isFinite(at.x) && isFinite(at.y) ? at : ROOMS[room] || B; this.p = { x: r.x, y: r.y }; this.room = ROOMS[room] ? room : 'base'; },
  // Called with the commander's view of this trooper: a manual move (map tap, mission button, commander) re-anchors tracking.
  sync(P) {
    if (!this.on || !P) return;
    if (P.pv !== this.pv) { const first = this.pv == null; this.pv = P.pv; if (!first) { this.resetTo(P.room, P); return; } } // moved on the map
    if (P.room !== this.room && P.room !== this.lastSentRoom && performance.now() - this.lastSendT > 800) this.resetTo(P.room);
  },
  // ----- calibration -----
  calStart() { this.calib = { phase: 'out', n1: 0, n2: 0, hOut: [], hBack: [] }; },
  calTurn() { if (this.calib) this.calib.phase = 'back'; },
  calCancel() { this.calib = null; },
  calFinish() {
    const c = this.calib; this.calib = null; if (!c) return { ok: false, msg: 'Calibration was not started.' };
    if (c.n1 < 6 || c.n2 < 6) return { ok: false, msg: `Only ${c.n1} and ${c.n2} steps were counted. Hold the phone in your hand and walk normally, then try again.` };
    const out = angAvg(c.hOut), back = angAvg(c.hBack);
    const diff = 180 - Math.abs(((out.a - back.a + 540) % 360) - 180); // 0 = perfectly opposite directions
    const offOut = wrap(out.a - NET_BEARING), offBack = wrap(back.a - NET_BEARING - 180);
    const offset = angAvg([offOut, offBack]).a;
    const stepLen = ROUTE_LEN * .9 * 2 / (c.n1 + c.n2);
    this.cal = { offset, stepLen, n1: c.n1, n2: c.n2, at: Date.now() }; store('ba2.track', this.cal);
    const P = App.game.G.players[App.myId()]; this.resetTo('base'); if (P) App.ui.act({ a: 'move', room: 'base' });
    return { ok: true, msg: `Calibrated: ${c.n1} steps out and ${c.n2} back.` + (diff > 50 ? ' The compass looked shaky; if tracking drifts, calibrate again away from the fridge and TV.' : '') };
  }
};
App.track = Track;
