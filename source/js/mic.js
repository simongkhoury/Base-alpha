// Blaster shot recognition.
// An AudioWorklet watches the microphone for a sharp jump in loudness, then hands ~110 ms of
// audio to the page. The page turns it into a sound fingerprint (spectrum at the hit, spectrum
// of the tail, and how fast it fades) and compares it with the recorded blaster samples.
import { App, S, saveS, load, store } from './core.js';

const WORKLET = `
class Onset extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    this.N = Math.floor(sr * 0.25); this.buf = new Float32Array(this.N); this.w = 0;
    this.floor = 1e-6; this.thr = 12; this.cap = -1; this.capLen = Math.floor(sr * 0.11); this.pre = Math.floor(sr * 0.012);
    this.hold = 0; this.lv = 0; this.cnt = 0; this.prev = 1e-7;
    this.port.onmessage = e => { if (e.data && e.data.thr) this.thr = e.data.thr; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]; if (!ch) return true;
    const n = ch.length; let e = 0;
    for (let i = 0; i < n; i++) { const v = ch[i]; this.buf[this.w] = v; this.w = (this.w + 1) % this.N; e += v * v; }
    e /= n;
    if (e > this.lv) this.lv = e;
    if (++this.cnt >= 12) { this.port.postMessage({ level: this.lv, floor: this.floor, thr: this.thr }); this.lv = 0; this.cnt = 0; }
    if (this.cap >= 0) {
      this.cap += n;
      if (this.cap >= this.capLen) {
        const L = this.capLen + this.pre, out = new Float32Array(L), s = (this.w - L + this.N * 2) % this.N;
        for (let i = 0; i < L; i++) out[i] = this.buf[(s + i) % this.N];
        this.port.postMessage({ seg: out, t: this.onT }, [out.buffer]); this.cap = -1; this.hold = Math.floor(sampleRate * 0.12);
      }
    } else if (this.hold > 0) { this.hold -= n; }
    else if (e > this.floor * this.thr && e > 3e-6 && e > this.prev * 4) { this.cap = 0; this.onT = currentTime; }
    if (this.cap < 0) { this.floor = e < this.floor ? this.floor * 0.8 + e * 0.2 : this.floor * 0.998 + e * 0.002; if (this.floor < 1e-7) this.floor = 1e-7; }
    this.prev = e < 1e-7 ? 1e-7 : e;
    return true;
  }
}
registerProcessor('ba-onset', Onset);
`;

// ---------- small FFT ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const NB = 20, FN = 1024; let HANN = null;
function bands(x, start, sr) {
  if (!HANN) { HANN = new Float32Array(FN); for (let i = 0; i < FN; i++) HANN[i] = .5 - .5 * Math.cos(2 * Math.PI * i / (FN - 1)); }
  const re = new Float32Array(FN), im = new Float32Array(FN);
  for (let i = 0; i < FN; i++) { const v = x[start + i]; re[i] = (v || 0) * HANN[i]; }
  fft(re, im);
  const lo = 200, hi = Math.min(14000, sr * .47), out = new Array(NB).fill(0);
  for (let b = 0; b < NB; b++) {
    const f0 = lo * Math.pow(hi / lo, b / NB), f1 = lo * Math.pow(hi / lo, (b + 1) / NB);
    const k0 = Math.max(1, Math.floor(f0 * FN / sr)), k1 = Math.max(k0 + 1, Math.ceil(f1 * FN / sr));
    let e = 0; for (let k = k0; k < k1 && k < FN / 2; k++) e += re[k] * re[k] + im[k] * im[k];
    out[b] = Math.log10(e / (k1 - k0) + 1e-12);
  }
  return out;
}
const center = v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return v.map(x => +(x - m).toFixed(3)); };
export function features(seg, sr) {
  let mx = 0; for (let i = 0; i < seg.length; i++) { const a = Math.abs(seg[i]); if (a > mx) mx = a; }
  if (mx < 2e-4) return null;
  let on = 0; const th = mx * .25; for (let i = 0; i < seg.length; i++) if (Math.abs(seg[i]) >= th) { on = Math.max(0, i - 64); break; }
  if (on + 3 * FN > seg.length) on = Math.max(0, seg.length - 3 * FN);
  const a = bands(seg, on, sr), b1 = bands(seg, on + FN, sr), b2 = bands(seg, on + 2 * FN, sr);
  const b = b1.map((v, i) => (v + b2[i]) / 2);
  const env = []; const C = Math.floor(sr * .008);
  for (let k = 0; k < 8; k++) { let e = 0; for (let i = on + k * C; i < on + (k + 1) * C && i < seg.length; i++) e += seg[i] * seg[i]; env.push(Math.log10(e / C + 1e-12)); }
  return { a: center(a), b: center(b), e: center(env) };
}
function cos(u, v) { let d = 0, x = 0, y = 0; for (let i = 0; i < u.length; i++) { d += u[i] * v[i]; x += u[i] * u[i]; y += v[i] * v[i]; } return x && y ? d / Math.sqrt(x * y) : 0; }
export function similarity(f, g) { return (cos(f.a, g.a) * 1 + cos(f.b, g.b) * .7 + cos(f.e, g.e) * .6) / 2.3; }

// ---------- the detector ----------
export const ONE_KEYS = ['one', 'one2', 'one3', 'one4'];
export const oneName = k => 'Blaster ' + (ONE_KEYS.indexOf(k) + 1);
export const Mic = {
  ctx: null, stream: null, src: null, node: null, on: false, level: 0, floor: 1e-6, thr: 12,
  quietUntil: 0, speechUntil: 0, pauseUntil: 0, blocks: [], recent: [], ptt: false, rec: null, last: null, err: '',
  sig: load('ba2.sig', {}), // { key: [features, ...] }  keys: 'one', 'one2'... (one sound for all) or a weapon id
  async enable() {
    this.err = '';
    const ctx = App.snd.init(); if (!ctx) { this.err = 'Sound is not available on this browser.'; throw new Error(this.err); }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.err = 'This browser cannot use the microphone. Open the game from its https link in Safari or Chrome.'; throw new Error(this.err); }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) { this.err = 'Microphone permission was refused. Allow it in the browser settings for this site, then try again.'; throw e; }
    this.ctx = ctx;
    if (!this._mod) { const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })); await ctx.audioWorklet.addModule(url); this._mod = true; }
    this.src = ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(ctx, 'ba-onset');
    this.src.connect(this.node); const z = ctx.createGain(); z.gain.value = 0; this.node.connect(z); z.connect(ctx.destination);
    this.node.port.onmessage = e => this.onMsg(e.data);
    this.on = true; S.micOn = true; saveS(); this.applySens();
    App.net && App.net.micReady(this.src);
    return true;
  },
  disable() {
    try { this.stream && this.stream.getTracks().forEach(t => t.stop()); this.node && this.node.disconnect(); this.src && this.src.disconnect(); } catch (e) {}
    this.on = false; this.stream = this.node = this.src = null; S.micOn = false; saveS();
  },
  applySens() { this.thr = 3 + (1 - S.sens) * 37; if (this.node) this.node.port.postMessage({ thr: this.thr }); },
  quiet(sec) { this.quietUntil = Math.max(this.quietUntil, performance.now() + sec * 1000); },
  hold() {},
  // Game sounds must never be heard as shots. Each sound blocks a time window (audio clock).
  block(t0, t1) { const now = this.ctx ? this.ctx.currentTime : 0; this.blocks = this.blocks.filter(b => b[1] > now - 1); this.blocks.push([t0, t1]); },
  latency() { const c = App.snd.ctx; return c ? (c.outputLatency || 0) + (c.baseLatency || 0) + 0.06 : 0.1; },
  // This phone is about to play a sound lasting d seconds.
  ownSound(d) { const c = App.snd.ctx; if (!c) return; const t = c.currentTime; this.block(t - 0.02, t + this.latency() + d + 0.1); },
  // Another phone is playing a sound right about now (we only learn of it over the network).
  remoteSound(d) { const c = App.snd.ctx; if (!c) return; const t = c.currentTime; this.block(t - 0.3, t + d + 0.2); },
  speech(sec) { this.speechUntil = Math.max(this.speechUntil, performance.now() + sec * 1000); },
  blocked(t) { return t != null && this.blocks.some(b => t >= b[0] && t <= b[1]); },
  muted() { const now = performance.now(); return now < this.quietUntil || now < this.pauseUntil || App.voice.speaking || (S.shotMode === 'snap' && now < this.speechUntil) || this.ptt || (App.net && App.net.someoneTalking()); },
  onMsg(d) {
    if (!d) return;
    if (d.level != null) { this.level = d.level; this.floor = d.floor; return; }
    if (!d.seg) return;
    if (this.muted() || this.blocked(d.t)) return;
    const f = features(d.seg, this.ctx.sampleRate); if (!f) return;
    if (this.rec) { this.addSample(f); return; }
    let pk = 0; for (let i = 0; i < d.seg.length; i++) { const v = Math.abs(d.seg[i]); if (v > pk) pk = v; }
    // Wait a moment in case another phone's "I just played a sound" message is still on its way.
    setTimeout(() => { if (!this.blocked(d.t) && !this.muted()) this.classify(f, pk); }, 80);
  },
  // ----- recording -----
  startRec(key, onUpdate) { this.rec = { key, got: [], onUpdate }; },
  stopRec() { this.rec = null; },
  addSample(f) {
    const r = this.rec; r.got.push(f); App.snd.play('tick');
    if (r.got.length >= 5) { this.sig[r.key] = r.got; store('ba2.sig', this.sig); this.rec = null; r.onUpdate && r.onUpdate(true); }
    else r.onUpdate && r.onUpdate(false, r.got.length);
  },
  clear(key) { delete this.sig[key]; store('ba2.sig', this.sig); },
  consistency(key) {
    const s = this.sig[key]; if (!s || s.length < 2) return 0; let t = 0, n = 0;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) { t += similarity(s[i], s[j]); n++; }
    return t / n;
  },
  // ----- recognition -----
  classify(f, pk = 0) {
    const mode = S.shotMode, now = performance.now();
    let res = null;
    if (mode === 'snap') res = { ok: true, w: null, score: 1 };
    else if (mode === 'one') {
      // any of the recorded blasters counts (two players with two different blasters, for example)
      const keys = ONE_KEYS.filter(k => this.sig[k] && this.sig[k].length);
      if (!keys.length) res = { ok: true, w: null, score: 1, note: 'no recording' };
      else { let sc = -1, key = null; for (const k of keys) { const v = Math.max(...this.sig[k].map(g => similarity(f, g))); if (v > sc) { sc = v; key = k; } }
        res = { ok: sc >= S.strict, w: null, score: sc, key }; }
    } else {
      const scores = Object.keys(this.sig).filter(k => !ONE_KEYS.includes(k) && this.sig[k].length).map(k => [k, Math.max(...this.sig[k].map(g => similarity(f, g)))]).sort((a, b) => b[1] - a[1]);
      if (!scores.length) res = { ok: true, w: null, score: 1, note: 'no recordings' };
      else { const [w, sc] = scores[0]; const second = scores[1] ? scores[1][1] : -1;
        res = { ok: sc >= S.strict && sc - second >= .015, w, score: sc, second: scores[1] ? scores[1][0] : null }; }
    }
    res.t = now; this.last = res;
    if (res.ok && !this.rec) {
      // Safety net: a burst of "shots" with nobody shooting means the phone is hearing itself.
      this.recent = this.recent.filter(x => now - x < 2500); this.recent.push(now);
      if (this.recent.length >= 7) { this.recent = []; this.pauseUntil = now + 4000; App.ui && App.ui.toast('Microphone paused for a moment: it kept hearing shots by itself. Try lower sensitivity.'); return; }
      App.ui && App.ui.onShot(res.w, pk);
    }
    App.ui && App.ui.onDetect && App.ui.onDetect(res);
  }
};
App.mic = Mic;
