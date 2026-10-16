// AR scope: the back camera in a small window, with monsters drawn where they are.
// Uses the compass direction (from movement tracking) and the trooper's position on the plan.
import { App, S, saveS, TAU } from './core.js';
import { T } from './data.js';
import { head, circ } from './art.js';

const FOV = 60; // degrees of view shown left to right
export const Scope = {
  on: false, stream: null, err: '', hits: [],
  async enable() {
    this.err = '';
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
    const G = App.game.G, P = G.players[App.myId()], tr = App.track;
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
      const x = W / 2 + (o.rel / (FOV / 2)) * (W / 2), rr = Math.max(12 * d, Math.min(W * .22, 9000 * d / (o.dist + 60)));
      const y = H * .55 + Math.sin(tnow * 3 + o.t.id) * 4 * d;
      head(c, o.t.rv === false ? 'my' : o.t.k, x, y, rr, { vul: o.t.vul > 0, heads: Math.ceil((o.t.hp || 2) / 2) });
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
