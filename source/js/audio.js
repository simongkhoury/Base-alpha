// Synthesized sound effects and the radio operator's voice.
import { App, S } from './core.js';
import { SFX } from './sfxdata.js';

export const Snd = {
  ctx: null, m: null, nbuf: null, buf: {}, eff: {}, boost: 2.2, dry: false,
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return this.ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
      // master -> compressor -> make-up gain: everything loud, nothing clips
      this.m = this.ctx.createGain(); this.m.gain.value = 1;
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = .002; comp.release.value = .2;
      const out = this.ctx.createGain(); out.gain.value = 1.8;
      this.m.connect(comp); comp.connect(out); out.connect(this.ctx.destination);
      this.loadSamples();
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.m); s.start(0);
      const n = this.ctx.sampleRate * 2; this.nbuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const a = this.nbuf.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
    return this.ctx;
  },
  tone(f, d, type = 'sine', v = .2, t = 0, f2) {
    if (this.dry) return; v *= this.boost;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), st = c.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, st); if (f2) o.frequency.exponentialRampToValueAtTime(f2, st + d);
    g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(v, st + .008); g.gain.exponentialRampToValueAtTime(.0001, st + d);
    o.connect(g); g.connect(this.m); o.start(st); o.stop(st + d + .03);
  },
  // Gentle tone with a slow attack: radar pings the blaster detector cannot mistake for a snap.
  soft(f, d, v, t = 0) {
    if (this.dry) return; v *= this.boost; const c = this.ctx, o = c.createOscillator(), g = c.createGain(), st = c.currentTime + t;
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(v, st + .045); g.gain.linearRampToValueAtTime(0, st + d);
    o.connect(g); g.connect(this.m); o.start(st); o.stop(st + d + .02);
  },
  noise(d, v = .15, t = 0, fq = 1200, q = .7, type = 'bandpass', fq2) {
    if (this.dry) return; v *= this.boost;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.nbuf;
    const fl = c.createBiquadFilter(); fl.type = type; const st = c.currentTime + t;
    fl.frequency.setValueAtTime(fq, st); if (fq2) fl.frequency.exponentialRampToValueAtTime(fq2, st + d); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(v, st); g.gain.exponentialRampToValueAtTime(.0001, st + d);
    s.connect(fl); fl.connect(g); g.connect(this.m); s.start(st, Math.random() * 1.5); s.stop(st + d + .03);
  },
  // Cartoon monster voice: buzzy tone through two vowel filters with a wobble.
  groan(f, d, v = .12, t = 0, f2, vow = [520, 900], wob = 6) {
    if (this.dry) return; v *= this.boost * 1.5;
    const c = this.ctx, st = c.currentTime + t, o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, st); if (f2) o.frequency.exponentialRampToValueAtTime(f2, st + d);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = wob; lg.gain.value = f * .06; lfo.connect(lg); lg.connect(o.frequency);
    const out = c.createGain(); out.gain.setValueAtTime(.0001, st); out.gain.exponentialRampToValueAtTime(v, st + .06); out.gain.setValueAtTime(v, st + d * .6); out.gain.exponentialRampToValueAtTime(.0001, st + d);
    for (const fq of vow) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = 6; o.connect(b); b.connect(out); }
    out.connect(this.m); o.start(st); lfo.start(st); o.stop(st + d + .05); lfo.stop(st + d + .05);
  },
  // Plays a named sound. Returns its rough length so the shot detector can ignore it.
  loadSamples() {
    for (const [k, b64] of Object.entries(SFX)) {
      try {
        const bin = atob(b64), ab = new ArrayBuffer(bin.length), u = new Uint8Array(ab); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(ab, b => { this.buf[k] = b; this.eff[k] = effLen(b); }, () => {});
      } catch (e) {}
    }
  },
  sample(n, vol = 1, rate = 1) {
    const c = this.ctx, b = this.buf[n]; if (!b) return 0;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.m); s.start(); return (this.eff[n] || b.duration) / rate;
  },
  // How long a sound can still produce snap-like transients. Most only snap at the start;
  // explosions and debris keep crackling.
  blockLen(n, d) { return /^(explode|ric_cannon|chopper|dance|fire_cannon)/.test(n) ? d : Math.min(d, .35); },
  // Rough audible length of a sound (seconds), used to keep the blaster detector from hearing the game.
  dur(n) {
    if (this.eff[n]) return this.eff[n];
    if (!this.ctx) return .4;
    this.dry = true; let d = .4; try { d = this.synth(n) || .4; } catch (e) {} this.dry = false; return d;
  },
  play(n, opt) {
    if (!this.ctx || !S.sound || !n) return 0;
    if (n === 'hurt_z' && Math.random() < .5) n = 'hurt_z2';
    let d = 0;
    if (this.buf[n]) {
      const vary = /^(hurt|die|ric|fire_(handgun|striker|viper))/.test(n) ? .94 + Math.random() * .12 : 1;
      d = this.sample(n, 1, vary);
    } else d = this.synth(n);
    if (d && App.mic && !(opt && opt.soft)) App.mic.ownSound(this.blockLen(n, d));
    return d;
  },
  synth(n) {
    if (!this.ctx) return 0;
    let d = .3;
    try {
      const T = this.tone.bind(this), N = this.noise.bind(this), Gr = this.groan.bind(this), r = Math.random;
      switch (n) {
        // --- weapons ---
        case 'fire_handgun': N(.09, .35, 0, 1800, .9); T(420, .08, 'square', .06, 0, 140); d = .12; break;
        case 'fire_striker': N(.07, .32, 0, 1400, .8); T(300, .07, 'sawtooth', .07, 0, 90); N(.12, .1, .03, 600, 1, 'lowpass'); d = .14; break;
        case 'fire_viper': N(.05, .28, 0, 2400, 1); T(700, .04, 'square', .05, 0, 300); d = .07; break;
        case 'fire_longshot': N(.16, .4, 0, 900, .7); T(160, .22, 'sawtooth', .08, 0, 50); N(.4, .08, .05, 400, .6, 'lowpass'); d = .4; break;
        case 'fire_laser': T(1800, .22, 'sawtooth', .07, 0, 220); T(2400, .18, 'sine', .06, 0, 400); d = .25; break;
        case 'fire_cannon': N(.35, .5, 0, 300, .6, 'lowpass'); T(90, .4, 'sine', .25, 0, 35); N(.6, .12, .08, 1200, .5, 'bandpass', 200); d = .6; break;
        case 'fire_freeze': T(2600, .3, 'sine', .08, 0, 900); N(.25, .1, 0, 6000, 2); d = .3; break;
        case 'fire_bomb': T(500, .35, 'triangle', .1, 0, 1400); N(.2, .1, 0, 2000, 1); d = .35; break;
        case 'empty': T(2000, .02, 'square', .06); T(1500, .02, 'square', .05, .06); d = .1; break;
        case 'laser_deny': T(180, .25, 'square', .07); T(140, .25, 'square', .06, .05); d = .3; break;
        case 'equip': N(.04, .2, 0, 3000, 2); T(900, .05, 'square', .05, .05); N(.04, .2, .1, 2200, 2); d = .2; break;
        // --- misses (ricochets) ---
        case 'ric_1': N(.04, .2, 0, 3000, 2); T(2800, .35, 'sine', .07, .01, 900); d = .4; break;
        case 'ric_2': N(.04, .2, 0, 2500, 2); T(3600, .28, 'sine', .06, .01, 1500); T(1800, .2, 'triangle', .03, .05, 700); d = .35; break;
        case 'ric_3': N(.05, .18, 0, 2000, 1.5); T(2200, .45, 'sine', .06, 0, 600); d = .5; break;
        case 'ric_4': T(1200, .08, 'square', .04); N(.1, .15, .02, 4000, 3); T(4200, .2, 'sine', .04, .04, 2500); d = .3; break;
        case 'ric_laser': N(.25, .12, 0, 5000, 3, 'bandpass', 1500); T(900, .15, 'sine', .04, 0, 300); d = .3; break;
        case 'ric_cannon': N(.5, .25, 0, 400, .7, 'lowpass', 120); T(70, .3, 'sine', .12, 0, 40); d = .5; break;
        case 'ric_dodge': N(.15, .1, 0, 800, 1, 'bandpass', 3000); T(600, .15, 'sine', .05, 0, 1200); d = .2; break;
        // --- hits ---
        case 'hit_bullet': N(.06, .3, 0, 900, 1); T(180, .06, 'sine', .12, 0, 90); d = .1; break;
        case 'hit_laser': N(.2, .15, 0, 4000, 2); T(1400, .15, 'sawtooth', .05, 0, 300); d = .22; break;
        case 'hit_cannon': N(.25, .35, 0, 500, .8, 'lowpass'); T(110, .25, 'sine', .18, 0, 50); d = .3; break;
        case 'hit_armor': T(2400, .06, 'square', .07); T(1800, .14, 'square', .05, .03); N(.06, .1, 0, 5000, 3); d = .2; break;
        case 'hit_freeze': T(3000, .3, 'sine', .07, 0, 1200); N(.2, .2, 0, 6000, 2); d = .4; break;
        case 'ric_freeze': N(.4, .12, 0, 1500, 1, 'bandpass', 5000); T(4200, .2, 'sine', .04, .2); d = .5; break;
        case 'explode_far': N(.8, .3, 0, 300, .5, 'lowpass', 80); T(60, .5, 'sine', .15, 0, 30); d = .8; break;
        case 'hurt_z2': Gr(130, .35, .12, 0, 170); d = .4; break;
        case 'explode': N(.8, .5, 0, 800, .5, 'lowpass', 90); T(70, .6, 'sine', .3, 0, 30); N(.3, .15, .05, 2500, 1); d = .8; break;
        // --- monster hurt ---
        case 'hurt_z': Gr(140 + r() * 30, .35, .12, 0, 110); d = .4; break;
        case 'hurt_h': Gr(130, .3, .08, 0, 100); Gr(170, .3, .07, .07, 120); d = .4; break;
        case 'hurt_tk': Gr(80, .4, .14, 0, 65, [400, 700], 4); d = .45; break;
        case 'hurt_sp': T(900, .12, 'square', .06, 0, 1500); d = .15; break;
        case 'hurt_iv': N(.3, .12, 0, 1500, 4, 'bandpass', 4000); d = .3; break;
        case 'hurt_sl': Gr(70, .6, .14, 0, 55, [350, 600], 3); d = .6; break;
        case 'hurt_my': T(600, .1, 'triangle', .06, 0, 300); d = .12; break;
        // --- monster defeated ---
        case 'die_z': Gr(150, .7, .13, 0, 70); T(200, .3, 'triangle', .06, .55, 80); d = .9; break;
        case 'die_h': Gr(150, .6, .09, 0, 70); Gr(120, .6, .08, .1, 60); Gr(180, .5, .07, .2, 80); d = .9; break;
        case 'die_tk': Gr(90, .8, .14, 0, 40, [400, 700], 3); N(.5, .3, .5, 300, .6, 'lowpass'); T(2000, .1, 'square', .04, .6); d = 1.1; break;
        case 'die_sp': T(1600, .2, 'square', .05, 0, 300); T(300, .3, 'sine', .1, .15, 1200); d = .5; break;
        case 'die_iv': [1800, 2400, 3000, 3600].forEach((f, i) => T(f, .15, 'sine', .05, i * .06)); N(.4, .06, 0, 6000, 3); d = .5; break;
        case 'die_sl': Gr(90, .9, .12, 0, 60, [350, 600], 2); T(60, .3, 'sine', .2, .8, 40); d = 1.1; break;
        case 'die_dn': [523, 659, 784, 1047].forEach((f, i) => T(f, .12, 'square', .05, i * .08)); d = .5; break;
        case 'die_my': T(500, .2, 'triangle', .08, 0, 150); d = .25; break;
        // --- radar, base and game ---
        case 'pip': T(1250, .12, 'sine', .07); d = .12; break;
        case 'ping_soft': this.soft(1250, .16, .06); d = .16; break;
        case 'ping_mut': this.soft(520, .14, .08); this.soft(520, .14, .08, .17); d = .3; break;
        case 'ping_low': this.soft(170, .4, .08); d = .4; break;
        case 'pulse': T(520, .1, 'triangle', .12); T(520, .1, 'triangle', .12, .16); d = .3; break;
        case 'low': T(150, .45, 'sawtooth', .06, 0, 105); N(.4, .05, 0, 300, 1, 'lowpass'); d = .45; break;
        case 'horde': Gr(130, .6, .08, 0, 100); Gr(160, .6, .07, .1, 120); Gr(110, .6, .07, .2, 90); d = .8; break;
        case 'chime': T(880, .25, 'sine', .1); T(1320, .3, 'sine', .08, .09); d = .4; break;
        case 'pop': T(300, .08, 'sine', .14, 0, 900); d = .1; break;
        case 'boing': T(220, .25, 'sine', .14, 0, 700); T(700, .2, 'sine', .08, .18, 260); d = .4; break;
        case 'star': [660, 880, 1320].forEach((f, i) => T(f, .14, 'triangle', .1, i * .09)); d = .4; break;
        case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => T(f, i === 3 ? .5 : .16, 'square', .06, i * .14)); T(1047, .5, 'triangle', .08, .42); d = 1; break;
        case 'freeze': T(2000, .5, 'sine', .08, 0, 600); [2600, 3100, 2300].forEach((f, i) => T(f, .08, 'sine', .05, .08 + i * .07)); d = .6; break;
        case 'shield': T(220, .45, 'sine', .12, 0, 880); T(330, .45, 'sine', .06, .05, 1100); d = .5; break;
        case 'scan': T(300, .7, 'sine', .07, 0, 1600); d = .7; break;
        case 'alarm': T(700, .16, 'triangle', .09); T(550, .16, 'triangle', .09, .18); T(700, .16, 'triangle', .09, .36); d = .55; break;
        case 'static': N(.45, .12, 0, 3000, .5); d = .45; break;
        case 'meow': T(700, .16, 'triangle', .1, 0, 1150); T(1150, .22, 'triangle', .08, .16, 750); d = .4; break;
        case 'bonk': T(180, .12, 'square', .08, 0, 90); d = .15; break;
        case 'basehit': T(120, .18, 'sawtooth', .06, 0, 80); d = .2; break;
        case 'roar': Gr(90, .8, .14, 0, 60, [400, 700], 5); N(.6, .07, 0, 400, .8); d = .8; break;
        case 'power': T(110, .8, 'sawtooth', .05, 0, 440); T(440, .2, 'sine', .06, .75); d = 1; break;
        case 'robot': [880, 660, 990, 1320].forEach((f, i) => T(f, .09, 'square', .05, i * .1)); d = .45; break;
        case 'chopper': for (let i = 0; i < 70; i++) N(.05, .22, i * .1, 110, 1, 'lowpass'); d = 7; break;
        case 'dance': { const mel = [523, 659, 784, 659, 587, 698, 880, 698], bass = [131, 131, 175, 175, 147, 147, 196, 196];
          for (let i = 0; i < 32; i++) { T(mel[i % 8], .18, 'square', .045, i * .25); if (i % 2 === 0) T(bass[(i / 2) % 8], .22, 'triangle', .09, i * .25); } d = 8; break; }
        case 'lullaby': [784, 659, 523, 587, 523].forEach((f, i) => T(f, .6, 'sine', .07, i * .55)); d = 3; break;
        case 'tick': T(1600, .03, 'sine', .04); d = .05; break;
        case 'pickup': [880, 1175, 1568].forEach((f, i) => T(f, .1, 'square', .05, i * .07)); d = .3; break;
        case 'heal': [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, .2, 'sine', .07, i * .08)); d = .6; break;
        case 'injury': T(500, .25, 'triangle', .1, 0, 250); T(400, .3, 'triangle', .08, .25, 200); d = .6; break;
        case 'radio_on': N(.08, .2, 0, 2500, 1); T(1400, .05, 'square', .04, .05); d = .15; break;
        case 'radio_off': T(1100, .05, 'square', .04); N(.12, .15, .04, 2500, 1); d = .2; break;
        case 'call': N(.15, .18, 0, 2500, 1); T(1200, .08, 'square', .05, .12); T(1600, .08, 'square', .05, .22); d = .35; break;
        case 'crate': T(180, .15, 'square', .06); N(.2, .2, .05, 600, 1, 'lowpass'); T(1200, .1, 'triangle', .05, .25); d = .4; break;
        case 'turret': T(1000, .04, 'square', .04); N(.03, .15, 0, 3000, 2); d = .06; break;
        default: d = 0;
      }
    } catch (e) { d = 0; }
    return d;
  }
};
// Length until the sound fades below 4% of its peak (ignores the quiet reverb tail).
function effLen(b) { const a = b.getChannelData(0); let pk = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > pk) pk = v; } const th = pk * .04; let last = 0; for (let i = a.length - 1; i >= 0; i--) if (Math.abs(a[i]) > th) { last = i; break; } return last / b.sampleRate; }

export const Voice = {
  v: null, speaking: false,
  pick() {
    try {
      const vs = speechSynthesis.getVoices(); const pref = ['Samantha', 'Daniel', 'Karen', 'Moira', 'Google US English', 'Google UK English Male', 'Alex'];
      for (const p of pref) { const f = vs.find(v => v.name.includes(p) && /^en/i.test(v.lang)); if (f) return this.v = f; }
      this.v = vs.find(v => /^en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    } catch (e) {}
  },
  say(t) {
    if (!('speechSynthesis' in window) || !S.sound) return;
    Snd.play('chime');
    setTimeout(() => {
      try {
        if (speechSynthesis.speaking && speechSynthesis.pending) speechSynthesis.cancel();
        if (!this.v) this.pick();
        const u = new SpeechSynthesisUtterance(t); if (this.v) { u.voice = this.v; u.lang = this.v.lang; } else u.lang = 'en-US';
        u.rate = 1.06; u.pitch = 1;
        u.onstart = () => { this.speaking = true; App.mic && App.mic.hold(true); };
        u.onend = u.onerror = () => { this.speaking = false; App.mic && App.mic.hold(false); };
        speechSynthesis.speak(u);
      } catch (e) {}
    }, 300);
  },
  prime() { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
};
if ('speechSynthesis' in window) { try { speechSynthesis.onvoiceschanged = () => Voice.pick(); } catch (e) {} }
App.snd = Snd; App.voice = Voice;
