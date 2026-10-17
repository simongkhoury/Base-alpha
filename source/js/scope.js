// AR scope: the back camera in a small window, with monsters drawn where they are.
// Uses the compass direction (from movement tracking) and the trooper's position on the plan.
import { App, S, saveS, TAU } from './core.js';
import { T } from './data.js';
import { head, circ, bodyFrames, loadBodies, imgReady } from './art.js';

const FOV = 60; // degrees of view shown left to right
const SIZE = { z: 1, h: 1.9, tk: 1.3, sp: .95, iv: 1, sl: 1.4, dn: 1.05 }; // body height compared with a zombie
const SIDE = { dn: 1, sp: 1 };  // drawn walking sideways (to the right), so they get turned towards you
export const Scope = {
  on: false, stream: null, err: '', hits: [],
  async enable() {
    this.err = ''; loadBodies();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.err = 'This browser cannot use the camera.'; throw new Error(this.err); }
    try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); }
    catch (e) { this.err = 'Camera permission was refused. Allow the camera for this site, then try again.'; throw e; }
    const v = document.getElementById('scopeVid'); v.srcObject = this.stream; v.muted = true; v.setAttribute('playsinline', ''); await v.play().catch(() => {});
    this.on = true; S.scopeOn = true; saveS(); document.getElementById('scope').hidden = false;
  },
  disable() {
    try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    this.stream = null; this.on = false; S.scopeOn = false; saveS(); document.getElementById('scope').hidden = true;
  },
  draw(tnow, sel) {
    if (!this.on) return;
    const cv = document.getElementById('scopeCv'), r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    const W = Math.round(r.width * d), H = Math.round(r.height * d); if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, H); this.hits = [];
    const G = App.game.G, P0 = G.players[App.myId()], tr = App.track;
    const P = P0 && tr.p && tr.on ? Object.assign({}, P0, tr.p) : P0;   // this phone's own tracked spot is freshest
    // crosshair
    c.strokeStyle = 'rgba(141,252,158,.8)'; c.lineWidth = 2 * d; c.beginPath(); c.moveTo(W / 2 - 14 * d, H / 2); c.lineTo(W / 2 + 14 * d, H / 2); c.moveTo(W / 2, H / 2 - 14 * d); c.lineTo(W / 2, H / 2 + 14 * d); c.stroke();
    if (!P || tr.heading == null || !tr.cal) { c.fillStyle = 'rgba(12,16,10,.6)'; c.fillRect(0, H - 22 * d, W, 22 * d); c.fillStyle = '#ffc83a'; c.font = `${Math.round(11 * d)}px "Share Tech Mono", monospace`; c.textAlign = 'center'; c.fillText(tr.heading == null ? 'NEEDS COMPASS' : 'CALIBRATE FIRST', W / 2, H - 7 * d); return; }
    const facing = ((tr.heading - tr.cal.offset) % 360 + 360) % 360;
    const list = [];
    for (const t of G.th) {
      if (t.k === 'iv' && !App.game.canTarget(t, P)) continue;
      const dx = t.x - P.x, dy = t.y - P.y, dist = Math.hypot(dx, dy); if (dist < 1) continue;
      const bearing = Math.atan2(dx, -dy) * 180 / Math.PI; let rel = ((bearing - facing + 540) % 360) - 180;
      if (Math.abs(rel) > FOV / 2 + 8) { list.push({ t, rel, dist, off: true }); continue; }
      list.push({ t, rel, dist });
    }
    list.sort((a, b) => b.dist - a.dist);
    for (const o of list) {
      if (o.off) { // edge arrows for monsters just out of view
        if (Math.abs(o.rel) > 100) continue; const x = o.rel < 0 ? 10 * d : W - 10 * d; c.fillStyle = T[o.t.k].mut ? '#b98cff' : '#8fd65f';
        c.beginPath(); c.moveTo(x, H / 2 - 9 * d); c.lineTo(x + (o.rel < 0 ? -8 : 8) * d, H / 2); c.lineTo(x, H / 2 + 9 * d); c.closePath(); c.fill(); continue; }
      let x = W / 2 + (o.rel / (FOV / 2)) * (W / 2), rr = Math.max(12 * d, Math.min(W * .22, 9000 * d / (o.dist + 60)));
      let y = H * .55 + Math.sin(tnow * 3 + o.t.id) * 4 * d;
      const k = o.t.rv === false ? 'my' : o.t.k, body = bodyFrames(k);
      if (body) { // full body: walking, or reaching for you when it's next to you
        const party = G.dance > 0 || o.t.dz > 0, grab = o.t.inC && !party && body.grab && imgReady(body.grab.im), A = grab ? body.grab : body.walk;
        const still = o.t.fz > 0 || o.t.sl, i = still ? 0 : Math.floor(tnow * 1000 / A.ms * (party ? 2 : 1) + o.t.id * 3) % A.n;
        const hgt = Math.min(rr * 3.4 * (SIZE[k] || 1), H * .85), top = H * .58 - hgt * .62 + (party ? -Math.abs(Math.sin(tnow * 8)) * rr * .3 : 0);
        const face = !SIDE[k] ? 1 : (o.t._face = Math.abs(x - W / 2) < W * .06 ? (o.t._face || 1) : (x < W / 2 ? 1 : -1)); // turned towards you
        const bx = Math.min(W - hgt * .3, Math.max(hgt * .3, x));             // keep a close one on screen
        const fw = A.im.naturalWidth / A.n, fh = A.im.naturalHeight;
        c.save(); c.translate(bx, top + hgt / 2); c.scale(face, 1); if (k === 'iv') c.globalAlpha = .8;
        c.drawImage(A.im, i * fw, 0, fw, fh, -hgt / 2, -hgt / 2, hgt, hgt); c.restore();
        x = bx; y = top + hgt / 2; rr = hgt * .4;
      } else head(c, k, x, y, rr, { vul: o.t.vul > 0, heads: Math.ceil((o.t.hp || 2) / 2) });
      if (o.t.fz > 0) { circ(c, x, y, rr * 1.2); c.strokeStyle = '#86dcff'; c.lineWidth = 3 * d; c.stroke(); }
      if (sel === o.t.id) { circ(c, x, y, rr * 1.4); c.strokeStyle = '#ffc83a'; c.lineWidth = 3 * d; c.stroke(); }
      this.hits.push({ id: o.t.id, x, y, r: rr * 1.4 });
    }
  },
  pick(e) {
    const cv = document.getElementById('scopeCv'), r = cv.getBoundingClientRect(), d = cv.width / r.width;
    const x = (e.clientX - r.left) * d, y = (e.clientY - r.top) * d; let best = null, bd = 1e9;
    for (const h of this.hits) { const dd = Math.hypot(h.x - x, h.y - y); if (dd < h.r && dd < bd) { bd = dd; best = h; } }
    return best ? best.id : null;
  }
};
App.scope = Scope;
