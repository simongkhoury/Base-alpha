// Linking phones with PeerJS (WebRTC). The commander's phone hosts; others join with a short code.
// The free PeerJS server is only used for the handshake; game data and walkie-talkie audio then
// travel directly between the phones over the home Wi-Fi.
import { App, S, saveS, ME, pick } from './core.js';

const PREFIX = 'basealpha2-';
const WORDS = ['ALPHA', 'BRAVO', 'DELTA', 'ECHO', 'FOXTROT', 'HOTEL', 'KILO', 'LIMA', 'OSCAR', 'ROMEO', 'SIERRA', 'TANGO', 'VICTOR', 'ZULU', 'TIGER', 'EAGLE', 'COBRA', 'FALCON'];
const genCode = () => pick(WORDS) + '-' + (Math.floor(Math.random() * 90) + 10);
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const Net = {
  peer: null, role: null, code: '', status: 'off', myPeer: null, conns: new Map(), hc: null, lastRecv: 0, retry: null,
  calls: new Map(), audios: new Map(), talkGain: null, talkDest: null, err: '',
  isHost() { return this.role !== 'client'; },
  linked() { return this.role === 'client' ? this.status === 'linked' && Date.now() - this.lastRecv < 4000 : this.conns.size > 0; },
  opts() {
    const q = new URLSearchParams(location.search), h = q.get('peerhost');
    if (h) return { host: h, port: +q.get('peerport') || 9000, path: '/', secure: false, debug: 1, config: { iceServers: [] } };
    return { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
  },
  hasPeerJS() { return typeof window.Peer === 'function'; },

  // ----- commander -----
  host(code, tries = 0) {
    this.leave(); this.role = 'host'; this.code = code || genCode(); this._tries = tries; this.status = 'connecting'; this.err = '';
    if (!this.hasPeerJS()) { this.status = 'offline'; this.err = 'Linking needs the internet the first time it loads.'; return; }
    const p = this.peer = new window.Peer(PREFIX + normCode(this.code).toLowerCase(), this.opts());
    p.on('open', id => { this.myPeer = id; this.status = 'hosting'; S.lastCode = this.code; saveS(); const me = App.game.G.players[ME.id]; if (me) me.peer = id; });
    p.on('connection', c => this.accept(c));
    p.on('call', call => this.answer(call));
    p.on('disconnected', () => { this.status = 'reconnecting'; setTimeout(() => { try { p.reconnect(); } catch (e) {} }, 1500); });
    p.on('error', e => {
      if (e.type === 'unavailable-id') { const c = this.code, n = this._tries; if (n < 3) setTimeout(() => this.host(c, n + 1), 3000); else this.host(); return; }
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { this.status = 'offline'; this.err = 'Cannot reach the linking server. Check the internet connection.'; }
      else if (e.type === 'browser-incompatible') { this.status = 'offline'; this.err = 'This browser cannot link phones.'; }
    });
  },
  accept(c) {
    this.conns.set(c.peer, { conn: c, pid: null });
    c.on('data', d => this.onHostData(c, d));
    c.on('close', () => this.lost(c));
    c.on('error', () => this.lost(c));
  },
  lost(c) {
    const e = this.conns.get(c.peer); if (!e) return; this.conns.delete(c.peer);
    if (e.pid) { const P = App.game.G.players[e.pid]; App.game.dropPlayer(e.pid); if (P) App.game.say(`${P.name}'s phone lost the link.`, 1, 'link'); }
    this.endCall(c.peer);
  },
  onHostData(c, d) {
    if (!d || typeof d !== 'object') return; const e = this.conns.get(c.peer); if (!e) return;
    if (d.t === 'hello' && d.p && typeof d.p.id === 'string') {
      const pid = d.p.id.slice(0, 24); e.pid = pid;
      const wasOnline = App.game.G.players[pid] && App.game.G.players[pid].online;
      const P = App.game.addPlayer({ id: pid, name: d.p.name, color: d.p.color, av: d.p.av }, c.peer);
      if (!wasOnline) { App.game.sfx('radio_on'); App.game.say(`${P.name} joined Base Alpha.`, 2, 'users'); }
      this.sendState();
    } else if (d.t === 'act' && e.pid) App.game.apply(d.a, e.pid);
  },
  sendState() {
    if (!this.conns.size) return; const msg = { t: 'st', s: App.game.enc() };
    for (const { conn } of this.conns.values()) if (conn.open) try { conn.send(msg); } catch (e) {}
  },
  fx(f) { if (!this.conns.size) return; const msg = { t: 'fx', f }; for (const { conn } of this.conns.values()) if (conn.open) try { conn.send(msg); } catch (e) {} },

  // ----- follower phone -----
  join(code) {
    this.leave(); const c = normCode(code); if (!c) return; this.role = 'client'; this.code = code; this.status = 'connecting'; this.err = '';
    if (!this.hasPeerJS()) { this.status = 'offline'; this.err = 'Linking needs the internet the first time it loads.'; return; }
    const p = this.peer = new window.Peer(this.opts());
    p.on('open', id => { this.myPeer = id; this.connect(); });
    p.on('call', call => this.answer(call));
    p.on('disconnected', () => setTimeout(() => { try { p.reconnect(); } catch (e) {} }, 1500));
    p.on('error', e => {
      if (e.type === 'peer-unavailable') { this.status = 'notfound'; this.err = `No commander found with code ${code}. Check the code on the commander's phone.`; this.retryLater(4000); }
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') { this.status = 'offline'; this.err = 'Cannot reach the linking server. Check the internet connection.'; this.retryLater(5000); }
    });
  },
  connect() {
    if (!this.peer || this.peer.destroyed) return;
    const hc = this.hc = this.peer.connect(PREFIX + normCode(this.code).toLowerCase(), { reliable: true, serialization: 'json' });
    hc.on('open', () => { this.status = 'linked'; this.err = ''; S.lastCode = this.code; saveS(); this.hello(); });
    hc.on('data', d => this.onClientData(d));
    hc.on('close', () => { if (this.role === 'client') { this.status = 'lost'; this.retryLater(2500); } });
    hc.on('error', () => {});
  },
  retryLater(ms) { clearTimeout(this.retry); this.retry = setTimeout(() => { if (this.role === 'client' && this.status !== 'linked') { if (this.peer && !this.peer.disconnected) this.connect(); } }, ms); },
  hello() { if (this.hc && this.hc.open) this.hc.send({ t: 'hello', p: { id: ME.id, name: ME.name || 'Soldier', color: ME.color, av: ME.av } }); },
  onClientData(d) {
    if (!d || typeof d !== 'object') return; this.lastRecv = Date.now();
    if (d.t === 'st') App.game.dec(d.s);
    else if (d.t === 'fx') App.fx.play(d.f);
  },
  act(a) {
    if (this.role === 'client') { if (this.hc && this.hc.open) try { this.hc.send({ t: 'act', a }); } catch (e) {} }
    else App.game.apply(a, ME.id);
  },
  leave() {
    clearTimeout(this.retry);
    for (const k of [...this.calls.keys()]) this.endCall(k);
    try { this.peer && this.peer.destroy(); } catch (e) {}
    this.peer = null; this.hc = null; this.conns.clear(); this.role = null; this.status = 'off'; this.myPeer = null;
  },

  // ----- walkie-talkie (each pair of phones keeps one audio call open; talking unmutes it) -----
  audioReady() {
    const ctx = App.snd.ctx; if (!ctx || this.talkDest) return !!this.talkDest;
    this.talkDest = ctx.createMediaStreamDestination(); this.talkGain = ctx.createGain(); this.talkGain.gain.value = 0; this.talkGain.connect(this.talkDest);
    return true;
  },
  micReady(src) { if (this.audioReady()) try { src.connect(this.talkGain); } catch (e) {} },
  meshTick() {
    if (!this.peer || !this.myPeer || !this.audioReady()) return;
    const peers = Object.values(App.game.G.players).filter(p => p.online && p.peer && p.peer !== this.myPeer).map(p => p.peer);
    for (const id of peers) if (!this.calls.has(id) && this.myPeer < id) {
      try { const call = this.peer.call(id, this.talkDest.stream); if (call) this.setupCall(id, call); } catch (e) {}
    }
    for (const id of [...this.calls.keys()]) if (!peers.includes(id)) this.endCall(id);
  },
  answer(call) { if (!this.audioReady()) { try { call.close(); } catch (e) {} return; } call.answer(this.talkDest.stream); this.setupCall(call.peer, call); },
  setupCall(id, call) {
    if (this.calls.has(id)) { try { this.calls.get(id).close(); } catch (e) {} }
    this.calls.set(id, call);
    call.on('stream', rs => {
      let el = this.audios.get(id); if (!el) { el = document.createElement('audio'); el.autoplay = true; el.setAttribute('playsinline', ''); el.hidden = true; document.body.appendChild(el); this.audios.set(id, el); }
      el.srcObject = rs; el.play().catch(() => {});
    });
    call.on('close', () => this.endCall(id)); call.on('error', () => this.endCall(id));
  },
  endCall(id) { const c = this.calls.get(id); this.calls.delete(id); try { c && c.close(); } catch (e) {} const el = this.audios.get(id); if (el) { el.srcObject = null; el.remove(); this.audios.delete(id); } },
  unlockAudio() { for (const el of this.audios.values()) el.play().catch(() => {}); },
  talk(on) {
    if (!this.audioReady()) return;
    App.mic.ptt = on;
    this.talkGain.gain.setTargetAtTime(on ? 1.4 : 0, App.snd.ctx.currentTime, .02);
    App.snd.play(on ? 'radio_on' : 'radio_off');
    App.ui.act({ a: 'ptt', on });
  },
  someoneTalking() { const G = App.game.G; return Object.values(G.players).some(p => p.talk && p.id !== ME.id); }
};
App.net = Net;
App.myId = () => ME.id;
setInterval(() => { if (Net.role === 'host') Net.sendState(); }, 200);
setInterval(() => { try { Net.meshTick(); } catch (e) {} }, 2500);
