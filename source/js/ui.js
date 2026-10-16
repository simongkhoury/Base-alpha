// Everything on screen: header, pad, context button, radar, map, overlays and sheets.
import { App, S, saveS, ME, saveMe, $, $$, clamp, esc, TAU } from './core.js';
import { ROOMS, B, SHAPES, roomAt, PLACE_ROOMS, MISSION_ROOMS, SPAWN_ROOMS, T, MONSTER_MENU, WEAPONS, WEAPON_ORDER, ITEMS, ITEM_ORDER, GEAR, GEAR_ORDER, RANKS, rankOf, MIS, EVENTS, LINES, CALLS, COLORS, AVATARS, FREEZE_ROUND_CD, GRAB } from './data.js';
import { LINES as VOICE, LINE_CATS, Lines, L } from './lines.js';
import { Track } from './track.js';
import { Scope } from './scope.js';
import { svg, IMG, avImg, icHTML, head, heli, item as drawItem, avatar as drawAvatar, circ } from './art.js';
import { G, fireCheck, fireSound, accuracy, canTarget } from './game.js';
import { Snd, Voice } from './audio.js';
import { Mic } from './mic.js';
import { Net } from './net.js';
import { Saves } from './saves.js';

const me = () => G.players[ME.id];
const act = a => Net.act(a);
const onlinePlayers = () => Object.values(G.players).filter(p => p.online);
let sel = null;          // targeted monster id (this phone)
let sheetKind = null, tab = null, spawnK = null, delay = 0, armed = null, vcat = 'monsters';
let started = false, wl = null;

// ---------- ticker, toast ----------
export function ticker(text, ic, personal) {
  $('#tkText').textContent = text; $('#tkIc').innerHTML = icHTML(ic);
  const t = $('#ticker'); t.classList.toggle('me', !!personal); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
}
let toastT = null;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2300); }

// ---------- audio unlock, screen wake ----------
async function wakeLock() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
export function unlock() {
  Snd.init(); Net.audioReady(); Net.unlockAudio();
  if (!started) { started = true; Voice.prime(); wakeLock(); if (S.micOn && !Mic.on) Mic.enable().catch(() => {}); if (S.trackOn && !Track.on) Track.enable().catch(() => {}); if (S.scopeOn && !Scope.on) Scope.enable().catch(() => {}); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && started) { wakeLock(); Snd.init(); } });
document.addEventListener('pointerdown', () => { if (!Snd.ctx || Snd.ctx.state !== 'running') unlock(); }, { capture: true });

// ---------- hold-to-act buttons ----------
function holdBtn(el, onStart, onTick, onStop) {
  let iv = null;
  const start = e => { e.preventDefault(); if (iv) return; el.classList.add('holding'); onStart && onStart(); if (onTick) { onTick(); iv = setInterval(onTick, 220); } else iv = 1; };
  const stop = () => { if (!iv) return; if (iv !== 1) clearInterval(iv); iv = null; el.classList.remove('holding'); onStop && onStop(); };
  el.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, stop));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const holdAct = w => () => act({ a: 'hold', w });

// ---------- firing ----------
function doFire(w, mic) {
  const P = me(); if (!P) return;
  const W = w && P.inv.w[w] ? w : P.wpn;
  const probe = Object.assign({}, P, { wpn: W, mode: P.mode && WEAPONS[W].modes.includes(P.mode) ? P.mode : null });
  const chk = fireCheck(probe);
  if (chk === 'ok') { Snd.play(fireSound(probe)); if (!Net.isHost()) P.cdFire = WEAPONS[W].cd; flashFire(); }
  act({ a: 'fire', id: sel, w: W !== P.wpn ? W : undefined, mic: typeof mic === 'number' ? +mic.toFixed(4) : undefined });
}
function flashFire() { const b = $('#fireBtn'); b.classList.remove('holding'); void b.offsetWidth; b.classList.add('holding'); setTimeout(() => b.classList.remove('holding'), 90); }
export function onShot(w, pk) {
  if (G.phase !== 'play' || G.paused) return; const P = me(); if (!P || P.down) return;
  doFire(S.shotMode === 'each' ? w : null, pk || 0);
}
export function onDetect() { if (sheetKind === 'sound') renderDetect(); }

// ---------- context button ----------
function ctxAction() {
  const P = me(); if (!P || G.phase !== 'play' || G.paused) return null;
  if (P.down) return P.room !== 'base' ? { ic: 'home', t: 'BACK TO BASE', s: 'Go recover', a: { a: 'move', room: 'base' }, cls: 'warn' } : { ic: 'heart', t: `RECOVERING ${P.rec ? Math.ceil(P.rec) : ''}`, dis: true, cls: 'dim' };
  const solo = onlinePlayers().length <= 1;
  const hurt = onlinePlayers().filter(q => q.inj > 0 && (q.id !== P.id || solo));
  if (hurt.length && P.inv.it.medkit > 0) return { ic: 'medkit', t: `MEDKIT: ${hurt[0].name.toUpperCase()}`, s: `${Math.ceil(hurt[0].inj)}s left`, a: { a: 'item', k: 'medkit', t: hurt[0].id }, cls: 'med' };
  const m = G.mission;
  if (m && m.step === 1 && P.room === m.room) {
    const d = MIS[m.k];
    if (d.act === 'hold') return { ic: d.bic, t: 'HOLD', s: d.t, hold: 'gen', prog: m.prog, cls: 'go' };
    return { ic: d.bic, t: d.btn + (d.need > 1 ? ` ${Math.round(m.prog * d.need)}/${d.need}` : ''), s: d.t, a: { a: 'step' }, cls: 'go' };
  }
  const here = G.drops.find(d => d.room === P.room);
  if (here) return { ic: 'crate', t: 'PICK UP', s: `${Math.ceil(here.t)}s left`, a: { a: 'pickup', id: here.id }, cls: 'go' };
  if (G.th.some(t => t.k === 'dn' && t.rv !== false) && G.dance <= 0) return { ic: 'music', t: 'DANCE!', a: { a: 'dance' }, cls: 'pink' };
  if (m && m.step === 0) return { ic: 'flag', t: ROOMS[m.room].n.toUpperCase(), s: "Tap when you're there", a: { a: 'step' }, cls: 'go' };
  if (m && m.step === 1) return { ic: 'flag', t: ROOMS[m.room].n.toUpperCase(), s: "Tap when you're there", a: { a: 'move', room: m.room }, cls: 'go' };
  if (m && m.step === 2 && P.room !== 'base') return { ic: 'bed', t: 'AT BASE', s: 'Tap when back', a: { a: 'step' }, cls: 'go' };
  if (G.drops.length) { const d = G.drops[0]; return { ic: 'crate', t: `CRATE: ${ROOMS[d.room].n.toUpperCase()}`, s: `${Math.ceil(d.t)}s left`, a: { a: 'pickup', id: d.id }, cls: 'go' }; }
  const W = WEAPONS[P.wpn]; if (W.ammo !== Infinity && !(P.inv.ammo[P.wpn] > 0)) return { ic: 'swap', t: 'SWITCH WEAPON', open: 'inv', cls: 'warn' };
  if (P.room === 'base' && G.shield < 100 && !G.th.some(t => t.at)) return { ic: 'wrench', t: 'REPAIR', s: G.cov ? 'Hold' : 'Needs cover fire', hold: 'repair', prog: G.shield / 100, cls: G.cov ? '' : 'warn' };
  return { ic: 'scan', t: G.scan > 0 ? 'SCANNING' : 'SCAN', a: { a: 'scan' }, cls: G.scan > 0 ? 'dim' : '' };
}
let ctxNow = null, ctxSig = '';
function renderCtx() {
  const c = ctxNow = ctxAction(); const b = $('#ctxBtn');
  const sig = c ? [c.ic, c.t, c.s, c.cls, c.hold, c.dis].join('|') : 'none';
  if (sig !== ctxSig) {
    ctxSig = sig; b.className = 'pb ctxb ' + (c ? c.cls || '' : 'dim'); b.disabled = !c || !!c.dis;
    $('#ctxIc').innerHTML = svg(c ? c.ic : 'scan'); $('#ctxT').textContent = c ? c.t : '—'; $('#ctxS').textContent = c && c.s ? c.s : '';
    $('#ctxMeter').hidden = !(c && c.hold);
  }
  if (c && c.hold) $('#ctxMeter i').style.width = Math.round(clamp(c.prog || 0, 0, 1) * 100) + '%';
}
let ctxHold = null;
function ctxDown(e) {
  e.preventDefault(); const c = ctxNow; if (!c || c.dis) return; unlock();
  if (c.hold) { const w = c.hold; act({ a: 'hold', w }); clearInterval(ctxHold); ctxHold = setInterval(() => act({ a: 'hold', w }), 220); $('#ctxBtn').classList.add('holding'); return; }
  if (c.open === 'inv') { openSheet('inv'); return; }
  if (c.a) { act(c.a); Snd.play('tick'); }
}
function ctxUp() { clearInterval(ctxHold); ctxHold = null; $('#ctxBtn').classList.remove('holding'); }

// ---------- pad ----------
function buildPad() {
  $('#fireIc').innerHTML = svg('fire'); $('#frzIc').innerHTML = svg('freeze'); $('#bombIc').innerHTML = svg('bomb');
  $('#shieldIc').innerHTML = svg('shield'); $('#radioIc').innerHTML = svg('radio'); $('#shIc').innerHTML = svg('shield');
  $('#fireBtn').addEventListener('pointerdown', e => { e.preventDefault(); unlock(); doFire(); });
  const cb = $('#ctxBtn'); cb.addEventListener('pointerdown', ctxDown); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => cb.addEventListener(ev, ctxUp)); cb.addEventListener('contextmenu', e => e.preventDefault());
  $('#wpnBtn').addEventListener('click', () => openSheet('inv'));
  $('#frzBtn').addEventListener('pointerdown', e => { e.preventDefault(); act({ a: 'mode', m: 'freeze' }); });
  $('#bombBtn').addEventListener('pointerdown', e => { e.preventDefault(); act({ a: 'mode', m: 'bomb' }); });
  $('#shieldBtn').addEventListener('pointerdown', e => { e.preventDefault(); act({ a: 'shield' }); });
  // radio: quick tap opens calls, holding talks
  const rb = $('#radioBtn'); let rt = null, talking = false;
  rb.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); rt = setTimeout(() => { talking = true; rb.classList.add('live'); pttStart(); }, 280); });
  const rUp = () => { if (rt) clearTimeout(rt); rt = null; if (talking) { talking = false; rb.classList.remove('live'); pttStop(); } };
  rb.addEventListener('pointerup', e => { const wasTalk = talking; rUp(); if (!wasTalk && e.type === 'pointerup') openSheet('calls'); });
  ['pointerleave', 'pointercancel'].forEach(ev => rb.addEventListener(ev, rUp));
  rb.addEventListener('contextmenu', e => e.preventDefault());
}
async function pttStart() {
  if (!Mic.on) { try { await Mic.enable(); } catch (e) { toast(Mic.err || 'Microphone not available'); return; } }
  Net.talk(true);
}
function pttStop() { if (Mic.ptt) Net.talk(false); }

// ---------- header ----------
function buildHeader() {
  const em = $('#emblem'); let lpT = null, lpStart = 0;
  const frame = () => { if (!lpT) return; const p = Math.min(1, (performance.now() - lpStart) / 900); em.style.setProperty('--lp', p); if (p >= 1) { lpT = null; em.style.setProperty('--lp', 0); openSheet('cmd'); } else requestAnimationFrame(frame); };
  em.addEventListener('pointerdown', e => { e.preventDefault(); lpStart = performance.now(); lpT = 1; requestAnimationFrame(frame); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => em.addEventListener(ev, () => { lpT = null; em.style.setProperty('--lp', 0); }));
  em.addEventListener('contextmenu', e => e.preventDefault());
  em.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet('cmd'); } });
  $('#micBtn').addEventListener('click', async () => {
    unlock();
    if (!Mic.on) { try { await Mic.enable(); toast('Blaster microphone on'); } catch (e) { openSheet('sound'); } }
    else { Mic.disable(); toast('Blaster microphone off'); }
  });
  $('#modeBtn').addEventListener('click', () => setView(S.view === 'dock' ? 'field' : 'dock'));
  $('#soundBtn').addEventListener('click', () => { unlock(); S.sound = !S.sound; saveS(); if (!S.sound && 'speechSynthesis' in window) speechSynthesis.cancel(); });
  $('#pauseBtn').addEventListener('click', () => { unlock(); act({ a: 'pause', v: !G.paused }); });
  $('#repeatBtn').innerHTML = svg('replay');
  $('#repeatBtn').addEventListener('click', () => { unlock(); if (Net.isHost()) act({ a: 'repeat' }); else { ticker(G.last, G.lastIc); Voice.say(G.last); } });
  $$('[data-gear]').forEach(b => { b.innerHTML = svg('gear'); b.addEventListener('click', () => { unlock(); openSheet('cmd', G.phase === 'night' ? 'say' : 'setup'); }); });
}
export function setView(v) {
  S.view = v; saveS(); $('#dock').hidden = v !== 'dock'; $('#field').hidden = v !== 'field';
  const home = v === 'dock' ? $('#dockSide') : $('#fieldSide'); home.appendChild($('#statusRow')); home.appendChild($('#pad'));
  (v === 'dock' ? $('#radarWrap') : $('#mapWrap')).appendChild($('#scope')); (v === 'dock' ? $('#radarWrap') : $('#mapWrap')).appendChild($('#moveFab'));
  $('#modeBtn').innerHTML = svg(v === 'dock' ? 'map' : 'radar'); $('#modeBtn').setAttribute('aria-label', v === 'dock' ? 'Switch to the map' : 'Switch to the radar');
}

// ---------- radar ----------
let sweep = -Math.PI / 2, lastPing = 0, hits = [], mapHits = [], tnow = 0, mapGeo = null;
const rc = () => $('#radar'), mc = () => $('#map');
function fitCanvas(cv) { const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2.5); const w = Math.round(r.width * d), h = Math.round(r.height * d); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return d; }
function angDiff(a, b) { let d = (a - b) % TAU; if (d < 0) d += TAU; return d; }
const threatR = (k, base) => base * ({ h: 1.2, sl: 1.25, tk: 1.1 }[k] || 1);
function decorate(c, t, x, y, r, dpr) {
  if (t.fz > 0) { circ(c, x, y, r * 1.25); c.fillStyle = 'rgba(134,220,255,.22)'; c.fill(); c.lineWidth = 2.5 * dpr; c.strokeStyle = '#86dcff'; c.stroke(); }
  if (t.sl) { c.fillStyle = '#cfe9ff'; c.font = `${Math.round(r * .7)}px "Black Ops One", Impact, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; const b = (tnow * 1.2) % 1; c.fillText('z', x + r * .9, y - r * .6 - b * r * .5); c.fillText('Z', x + r * 1.25, y - r * 1.1 - b * r * .5); }
  if (t.mx > 1 && t.k !== 'h') { const n = Math.min(t.mx, 8), w = r * .3, gap = r * .07, tot = n * w + (n - 1) * gap, filled = Math.ceil(t.hp / t.mx * n); for (let i = 0; i < n; i++) { c.fillStyle = i < filled ? '#ffc83a' : 'rgba(255,255,255,.18)'; c.fillRect(x - tot / 2 + i * (w + gap), y + r * 1.25, w, r * .16); } }
  if (t.hitT > 0) { circ(c, x, y, r * 1.15); c.lineWidth = 3 * dpr; c.strokeStyle = '#fff'; c.stroke(); }
  if (sel === t.id) { const s = r * 1.5, l = r * .55; c.strokeStyle = '#ffc83a'; c.lineWidth = 3.5 * dpr; c.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(x + sx * s, y + sy * (s - l)); c.lineTo(x + sx * s, y + sy * s); c.lineTo(x + sx * (s - l), y + sy * s); } c.stroke(); }
}
function drawThreat(c, t, x, y, r, dpr, alpha) {
  const P = me();
  if (t.k === 'iv' && !canTarget(t, P)) { c.globalAlpha = alpha * .14; head(c, 'iv', x, y, r); c.globalAlpha = 1; return; }
  c.globalAlpha = alpha; let rot = 0;
  if (t.k === 'dn') rot = Math.sin(tnow * (G.dance > 0 || t.dz > 0 ? 14 : 6)) * .35;
  if (t.at) x += Math.sin(tnow * 40) * r * .12;
  const k = t.rv === false ? 'my' : t.k;
  head(c, k, x, y, r, { rot, vul: t.vul > 0, heads: Math.ceil(t.hp / 2) });
  c.globalAlpha = Math.min(1, alpha + .2); decorate(c, t, x, y, r, dpr); c.globalAlpha = 1;
}
function playerDot(c, P, x, y, r, dpr, isMe) {
  c.save(); if (P.down) c.globalAlpha = .45;
  circ(c, x, y, r); c.fillStyle = COLORS[P.color % COLORS.length]; c.fill(); c.lineWidth = 2.5 * dpr; c.strokeStyle = '#0c100a'; c.stroke();
  if (isMe) { circ(c, x, y, r * 1.6); c.strokeStyle = COLORS[P.color % COLORS.length]; c.lineWidth = 2 * dpr; c.stroke(); }
  if (P.inj > 0) { circ(c, x, y, r * (1.8 + .3 * Math.sin(tnow * 8))); c.strokeStyle = '#ff5a5a'; c.lineWidth = 3 * dpr; c.stroke(); }
  c.fillStyle = '#0c100a'; c.font = `${Math.round(r * 1.1)}px "Baloo 2", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((P.name || '?')[0].toUpperCase(), x, y + r * .05);
  c.restore();
}
function drawRadar(dt) {
  const cv = rc(), dpr = fitCanvas(cv), c = cv.getContext('2d'), W = cv.width, H = cv.height; if (!W || !H) return;
  c.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4 * dpr; if (R < 20) return;
  const rot = S.rot * Math.PI / 180, cs = Math.cos(rot), sn = Math.sin(rot);
  const P = (x, y) => { const dx = x - B.x, dy = y - B.y, rx = dx * cs - dy * sn, ry = dx * sn + dy * cs, d = Math.hypot(rx, ry); if (d < 1) return [cx, cy]; const k = R * .92 * Math.pow(Math.min(d, 1250) / 1250, .8) / d; return [cx + rx * k, cy + ry * k]; };
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, '#1d3a21'); g.addColorStop(1, '#0c180d');
  circ(c, cx, cy, R); c.fillStyle = g; c.fill(); c.lineWidth = 4 * dpr; c.strokeStyle = '#4b5a39'; c.stroke();
  c.save(); circ(c, cx, cy, R); c.clip();
  c.strokeStyle = 'rgba(141,252,158,.16)'; c.lineWidth = 1.2 * dpr;
  for (let i = 1; i <= 4; i++) { circ(c, cx, cy, R * i / 4); c.stroke(); }
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  for (let a = 0; a < 360; a += 10) { const ra = a * Math.PI / 180, l = a % 30 ? R * .03 : R * .06; c.beginPath(); c.moveTo(cx + Math.cos(ra) * (R - l), cy + Math.sin(ra) * (R - l)); c.lineTo(cx + Math.cos(ra) * R, cy + Math.sin(ra) * R); c.stroke(); }
  const live = G.phase === 'play' || G.phase === 'emergency';
  c.font = `${Math.round(10.5 * dpr)}px "Share Tech Mono", ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'top';
  for (const [id, lab] of [['balcony', 'BALCONY'], ['frontdoor', 'DOOR'], ['living', 'LIVING'], ['kitchen', 'KITCHEN'], ['hall', 'HALL'], ['toy', 'TOYS'], ['master', 'MASTER'], ['bath', 'BATH'], ['couch', 'COUCH']]) {
    const r = id === 'frontdoor' ? { x: ROOMS.frontdoor.out[0] - 60, y: 845 } : ROOMS[id]; const [x, y] = P(r.x, r.y);
    c.fillStyle = G.cfg.off.includes(id) ? 'rgba(255,106,61,.5)' : 'rgba(141,252,158,.38)'; circ(c, x, y, 2.2 * dpr); c.fill(); c.fillText(lab, x, y + 4 * dpr);
  }
  if (G.power && G.phase !== 'night') {
    const prev = sweep; sweep = (sweep + dt * TAU / 4) % TAU;
    for (let i = 0; i < 28; i++) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, sweep - (i + 1) * .04, sweep - i * .04); c.closePath(); c.fillStyle = `rgba(141,252,158,${.2 * (1 - i / 28)})`; c.fill(); }
    c.strokeStyle = 'rgba(141,252,158,.9)'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); c.stroke();
    if (live && !G.paused && tnow - lastPing > .7) for (const t of G.th) { if (!canTarget(t, me())) continue; const [x, y] = P(t.x, t.y); const a = Math.atan2(y - cy, x - cx);
      if (angDiff(sweep, a) < angDiff(sweep, prev) + .0001) { lastPing = tnow; Snd.play(T[t.k].mut ? 'ping_mut' : t.k === 'h' ? 'ping_low' : 'ping_soft', { soft: true }); break; } }
  } else if (G.phase === 'night') { sweep = (sweep + dt * TAU / 9) % TAU; c.strokeStyle = 'rgba(141,252,158,.35)'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); c.stroke(); }
  if (G.scan > 0) for (let i = 0; i < 3; i++) { const p = ((tnow * .8) + i / 3) % 1; circ(c, cx, cy, R * p); c.strokeStyle = `rgba(94,230,255,${.5 * (1 - p)})`; c.lineWidth = 3 * dpr; c.stroke(); }
  if (G.dance > 0) { const cols = ['#ff70b8', '#ffc83a', '#8dfc9e', '#86dcff', '#b98cff']; for (let i = 0; i < 5; i++) { const p = ((tnow * 1.2) + i / 5) % 1; circ(c, cx, cy, R * p); c.strokeStyle = cols[i]; c.globalAlpha = .6 * (1 - p); c.lineWidth = 6 * dpr; c.stroke(); } c.globalAlpha = 1; }
  // mission target, drops, turrets
  if (G.mission) { const tgt = G.mission.step === 2 ? null : ROOMS[G.mission.room]; if (tgt) { const [x, y] = P(tgt.x, tgt.y), p = (tnow * 1.4) % 1; circ(c, x, y, R * (.04 + .08 * p)); c.strokeStyle = `rgba(255,200,58,${1 - p})`; c.lineWidth = 3 * dpr; c.stroke(); } }
  for (const d of G.drops) { const [x, y] = P(ROOMS[d.room].x, ROOMS[d.room].y); drawItem(c, 'crate', x, y, Math.max(22 * dpr, R * .1)); }
  for (const tu of G.turrets) { const [x, y] = P(ROOMS[tu.room].x, ROOMS[tu.room].y); drawItem(c, 'turret', x + R * .05, y - R * .05, Math.max(20 * dpr, R * .09)); }
  hits = [];
  if (G.power) { const base = Math.max(14 * dpr, R * .075);
    for (const t of G.th) { const [x, y] = P(t.x, t.y), r = threatR(t.k, base); const a = Math.atan2(y - cy, x - cx); const since = angDiff(sweep, a) / TAU; drawThreat(c, t, x, y, r, dpr, .6 + .4 * Math.pow(1 - since, 2)); hits.push({ id: t.id, x, y, r: r * 1.5 }); } }
  // players
  const nearBase = [];
  for (const Q of onlinePlayers()) { const q = ppos(Q); if (Math.hypot(q.x - B.x, q.y - B.y) < 70) { nearBase.push(Q); continue; } const [x, y] = P(q.x, q.y); playerDot(c, Q, x, y, 8 * dpr, dpr, Q.id === ME.id); grabRing(c, Q, x, y, 15 * dpr, dpr); }
  if (G.chopper > 0) { const [bx, by] = P(ROOMS.balcony.x, ROOMS.balcony.y), ex = cx + (bx - cx) * 1.6, ey = cy + (by - cy) * 1.6, p = Math.min(1, G.chopper * 1.3); heli(c, ex + (bx - ex) * p, ey + (by - ey) * p, Math.max(18 * dpr, R * .09), tnow); }
  if (G.robot > 0) { const a = tnow * 2, rr = R * .26; head(c, 'rb', cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(12 * dpr, R * .06)); }
  if (G.drone > 0) { const a = -tnow * .7, rr = R * .6; drawItem(c, 'drone', cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(22 * dpr, R * .1)); }
  if (G.interf > 0) for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(200,255,210,${Math.random() * .25})`; c.fillRect(cx - R, Math.random() * H, R * 2, Math.random() * 3 * dpr + 1); }
  if (!G.power && live) { c.fillStyle = 'rgba(12,16,10,.75)'; c.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(200,255,210,${Math.random() * .15})`; c.fillRect(Math.random() * W, Math.random() * H, 3 * dpr, 3 * dpr); }
    c.fillStyle = '#ff6a3d'; c.font = `${Math.round(24 * dpr)}px "Black Ops One", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NO POWER', cx, cy - R * .3); }
  c.restore();
  const br = Math.max(16 * dpr, R * .085);
  if (G.shOn > 0) { circ(c, cx, cy, br * 2.3 + Math.sin(tnow * 6) * 2 * dpr); c.fillStyle = 'rgba(94,230,255,.13)'; c.fill(); c.lineWidth = 3 * dpr; c.strokeStyle = '#5ee6ff'; c.stroke(); }
  c.lineWidth = 5 * dpr; circ(c, cx, cy, br * 1.45); c.strokeStyle = 'rgba(255,255,255,.08)'; c.stroke();
  c.beginPath(); c.arc(cx, cy, br * 1.45, -Math.PI / 2, -Math.PI / 2 + TAU * G.shield / 100); c.strokeStyle = G.shield < 30 ? '#ff6a3d' : G.shield < 60 ? '#ffc83a' : '#5ee6ff'; c.stroke();
  circ(c, cx, cy, br); c.fillStyle = '#ffc83a'; c.fill(); c.lineWidth = 3 * dpr; c.strokeStyle = '#5a430a'; c.stroke();
  c.fillStyle = '#0c100a'; c.font = `${Math.round(br * 1.15)}px "Black Ops One", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', cx, cy + br * .06);
  nearBase.forEach((Q, i) => { const a = -Math.PI / 2 + (i - (nearBase.length - 1) / 2) * .7, x = cx + Math.cos(a) * br * 2.1, y = cy + Math.sin(a) * br * 2.1; playerDot(c, Q, x, y, 7 * dpr, dpr, Q.id === ME.id); grabRing(c, Q, x, y, 13 * dpr, dpr); });
}

// ---------- map ----------
// Where a trooper is drawn: this phone's own tracked position is the most up to date.
function ppos(Q) { if (Q.id === ME.id && Track.on && Track.p && Track.cal) return Track.p; const r = ROOMS[Q.room] || B; return { x: Q.x != null ? Q.x : r.x, y: Q.y != null ? Q.y : r.y }; }
function grabRing(c, Q, x, y, r, dpr) { if (!(Q.grab > 0)) return; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, Q.grab)); c.strokeStyle = '#ff5a5a'; c.lineWidth = 5 * dpr; c.stroke(); }
function drawMap() {
  const cv = mc(), dpr = fitCanvas(cv), c = cv.getContext('2d'), W = cv.width, H = cv.height; if (!W || !H) return;
  c.clearRect(0, 0, W, H);
  const s = Math.min(W / 900, H / 1350) * .97, ox = (W - 900 * s) / 2, oy = (H - 1350 * s) / 2, M = (x, y) => [ox + x * s, oy + y * s];
  mapGeo = { s, ox, oy };
  const poly = pts => { c.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = M(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); };
  c.fillStyle = 'rgba(211,194,140,.06)'; c.fillRect(...M(600, 660), 280 * s, 360 * s);
  c.fillStyle = 'rgba(211,194,140,.35)'; c.font = `${Math.round(13 * dpr)}px "Share Tech Mono", ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('OUTSIDE', ...M(740, 760));
  const P0 = me();
  for (const id in SHAPES) {
    poly(SHAPES[id]); c.fillStyle = id === 'base' ? 'rgba(255,200,58,.2)' : id === 'balcony' ? 'rgba(134,220,255,.08)' : '#222b1b'; c.fill();
    if (P0 && P0.room === id) { c.fillStyle = 'rgba(141,252,158,.10)'; c.fill(); }
    c.lineWidth = 2.5 * dpr; c.strokeStyle = '#4b5a39'; c.stroke();
    if (G.cfg.off.includes(id)) { c.save(); poly(SHAPES[id]); c.clip(); c.strokeStyle = 'rgba(255,106,61,.35)'; c.lineWidth = 3 * dpr; for (let i = -H; i < W; i += 24 * dpr) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); } c.restore(); }
  }
  c.fillStyle = 'rgba(211,194,140,.28)';
  const rect = (x, y, w, h) => { const [px, py] = M(x, y); c.fillRect(px, py, w * s, h * s); };
  rect(515, 410, 250, 40); rect(725, 410, 40, 190);
  c.save(); { const [tx, ty] = M(330, 580); c.translate(tx, ty); c.rotate(-.18); c.fillRect(-35 * s, -82 * s, 70 * s, 164 * s); } c.restore();
  c.save(); { const [kx, ky] = M(405, 910); c.translate(kx, ky); c.rotate(-.06); c.fillRect(-28 * s, -72 * s, 56 * s, 144 * s); } c.restore();
  rect(140, 425, 100, 60); rect(585, 355, 55, 60); rect(220, 1180, 110, 120);
  c.strokeStyle = '#ffc83a'; c.lineWidth = 5 * dpr; c.beginPath(); c.moveTo(...M(578, 812)); c.lineTo(...M(578, 878)); c.stroke();
  c.font = `${Math.round(12 * dpr)}px "Share Tech Mono", ui-monospace, monospace`;
  for (const [id, lab, x, y] of [['balcony', 'BALCONY', 430, 200], ['living', 'LIVING', 480, 765], ['kitchen', 'KITCHEN', 260, 960], ['hall', 'HALL', 420, 1078], ['bath', 'BATH', 633, 1040], ['master', 'MASTER', 275, 1080], ['toy', 'TOYS', 448, 1150], ['base', 'BASE', 550, 1135], ['frontdoor', 'DOOR', 540, 845], ['couch', 'COUCH', 640, 470], ['nook1', 'NOOK 1', 190, 500], ['nook2', 'NOOK 2', 700, 330], ['dining', 'TABLE', 230, 640]]) {
    c.fillStyle = G.cfg.off.includes(id) ? 'rgba(255,106,61,.8)' : 'rgba(241,230,189,.75)'; c.fillText(lab, ...M(x, y));
  }
  { const [bx, by] = M(B.x, B.y + 20), r = Math.max(10 * dpr, 22 * s); circ(c, bx, by, r); c.fillStyle = '#ffc83a'; c.fill(); c.fillStyle = '#0c100a'; c.font = `${Math.round(r * 1.1)}px "Black Ops One", Impact, sans-serif`; c.fillText('A', bx, by + r * .05);
    if (G.shOn > 0) { circ(c, bx, by, r * 1.8); c.strokeStyle = '#5ee6ff'; c.lineWidth = 3 * dpr; c.stroke(); } }
  const m = G.mission;
  if (m) { const tgt = m.step === 2 ? B : ROOMS[m.room]; const [x, y] = M(tgt.x, tgt.y); const p = (tnow * 1.4) % 1;
    circ(c, x, y, (30 + 40 * p) * s * 1.6); c.strokeStyle = `rgba(255,200,58,${1 - p})`; c.lineWidth = 4 * dpr; c.stroke();
    c.save(); c.translate(x, y - 26 * dpr); c.fillStyle = '#ffc83a'; c.strokeStyle = '#0c100a'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(-10 * dpr, 26 * dpr); c.lineTo(-10 * dpr, -12 * dpr); c.lineTo(14 * dpr, -6 * dpr); c.lineTo(-10 * dpr, 2 * dpr); c.fill(); c.stroke(); c.restore(); }
  for (const d of G.drops) { const [x, y] = M(ROOMS[d.room].x, ROOMS[d.room].y); const sz = Math.max(26 * dpr, 56 * s); drawItem(c, 'crate', x, y, sz); c.fillStyle = '#ffc83a'; c.font = `${Math.round(13 * dpr)}px "Share Tech Mono", monospace`; c.fillText(Math.ceil(d.t) + 's', x, y + sz * .65); }
  for (const tu of G.turrets) { const [x, y] = M(ROOMS[tu.room].x, ROOMS[tu.room].y); drawItem(c, 'turret', x + 30 * s, y - 30 * s, Math.max(22 * dpr, 50 * s)); }
  mapHits = [];
  if (G.power) { const base = Math.max(13 * dpr, 30 * s); for (const t of G.th) { const [x, y] = M(t.x, t.y), r = threatR(t.k, base); drawThreat(c, t, x, y, r, dpr, 1); mapHits.push({ id: t.id, x, y, r: r * 1.5 }); } }
  const ar = Math.max(14 * dpr, 30 * s), drawn = [];
  for (const Q of onlinePlayers()) {
    const q = ppos(Q); let [px, y] = M(q.x, q.y); for (const o of drawn) if (Math.hypot(o[0] - px, o[1] - y) < ar * 1.6) px += ar * 1.8; drawn.push([px, y]);
    c.save(); if (Q.down) c.globalAlpha = .45; drawAvatar(c, Q.av, Q.color, px, y, ar); c.restore();
    if (Q.id === ME.id) { circ(c, px, y + ar * .1, ar * 1.3); c.strokeStyle = COLORS[Q.color % COLORS.length]; c.lineWidth = 3 * dpr; c.stroke(); }
    if (Q.inj > 0) { circ(c, px, y + ar * .1, ar * (1.5 + .2 * Math.sin(tnow * 8))); c.strokeStyle = '#ff5a5a'; c.lineWidth = 3 * dpr; c.stroke(); }
    grabRing(c, Q, px, y + ar * .1, ar * 1.7, dpr);
  }
  if (G.chopper > 0) { const [bx, by] = M(ROOMS.balcony.x, ROOMS.balcony.y), p = Math.min(1, G.chopper * 1.3); heli(c, bx, by - (1 - p) * 200 * dpr, Math.max(18 * dpr, 40 * s), tnow); }
  if (!G.power && (G.phase === 'play')) { c.fillStyle = '#ff6a3d'; c.font = `${Math.round(20 * dpr)}px "Black Ops One", Impact, sans-serif`; c.fillText('RADAR OFFLINE', W / 2, 30 * dpr); }
}
function canvasPt(cv, e) { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d, d]; }
function pickHit(list, x, y, d) { let best = null, bd = 1e9; for (const h of list) { const dd = Math.hypot(h.x - x, h.y - y); if (dd < h.r + 12 * d && dd < bd) { bd = dd; best = h; } } return best; }
function bindCanvases() {
  rc().addEventListener('pointerdown', e => { const [x, y, d] = canvasPt(rc(), e); const h = pickHit(hits, x, y, d); sel = h ? h.id : null; if (h) Snd.play('tick'); });
  mc().addEventListener('pointerdown', e => {
    const [x, y, d] = canvasPt(mc(), e); const h = pickHit(mapHits, x, y, d);
    if (h) { sel = h.id; Snd.play('tick'); return; }
    if (!mapGeo) return; const ux = (x - mapGeo.ox) / mapGeo.s, uy = (y - mapGeo.oy) / mapGeo.s; const room = roomAt(ux, uy);
    if (room && G.phase === 'play') { act({ a: 'move', room }); if (Track.on) Track.resetTo(room); Snd.play('tick'); toast(`You are at: ${ROOMS[room].n}`); }
  });
}

// ---------- lobby (start screen) ----------
let lobbySig = '';
function renderLobby(force) {
  const role = Net.role, players = onlinePlayers();
  const sig = [role, Net.status, Net.code, Net.err, players.map(p => p.id + p.name + p.av + p.color).join(','), ME.av, ME.color, Mic.on].join('|');
  if (!force && sig === lobbySig) return; lobbySig = sig;
  const nameFocused = document.activeElement && document.activeElement.id === 'nameIn';
  const codeVal = $('#codeIn') ? $('#codeIn').value : (S.lastCode || '');
  const plist = `<div class="plist">${players.map(p => `<div><img src="${avImg(p.av, p.color)}" alt="">${esc(p.name)}${p.id === G.hostId ? '<span class="lbl">CMDR</span>' : ''}</div>`).join('')}</div>`;
  let net = '';
  if (!role) net = `<div class="panel"><h3>COMMANDER PHONE</h3><p class="note">Runs the game. Other phones join with a code.</p><button class="big" id="hostBtn">${svg('radar')} HOST GAME</button></div>
    <div class="panel"><h3>JOIN THE COMMANDER</h3><div class="field-in"><input id="codeIn" placeholder="BRAVO-27" autocapitalize="characters" autocomplete="off" value="${esc(codeVal)}"><button class="btn go" id="joinBtn">${svg('link')} JOIN</button></div></div>`;
  else if (role === 'host') {
    const st = { connecting: 'Connecting to the linking server…', hosting: players.length > 1 ? `${players.length} troopers linked` : 'Waiting for other phones. Share this code:', reconnecting: 'Reconnecting…', offline: Net.err || 'Offline. Playing on this phone only.' }[Net.status] || '';
    net = `<div class="panel"><h3>GAME CODE</h3><div class="codebig">${esc(Net.code)}</div><div class="netst ${Net.status === 'offline' ? 'err' : ''}">${esc(st)}</div>${plist}
      <button class="big go" id="startBtn">${svg('play')} START</button><div class="row"><button class="btn ghost sm" id="leaveBtn">${svg('close')} Stop hosting</button></div></div>`;
  } else {
    const st = { connecting: 'Linking…', linked: 'Linked! Waiting for the commander to press START.', notfound: Net.err, lost: 'Link lost. Retrying…', offline: Net.err }[Net.status] || '';
    net = `<div class="panel"><h3>JOINING ${esc(Net.code)}</h3><div class="netst ${['notfound', 'offline'].includes(Net.status) ? 'err' : ''}">${esc(st)}</div>${Net.status === 'linked' ? plist : ''}
      <div class="row"><button class="btn ghost sm" id="leaveBtn">${svg('close')} Leave</button></div></div>`;
  }
  $('#lobby').innerHTML = `
    <svg viewBox="0 0 48 48" width="96" height="96" aria-hidden="true"><path d="M24 3 42 10v14c0 10-7.5 18.5-18 21C13.5 42.5 6 34 6 24V10z" fill="#2e3a25" stroke="#ffc83a" stroke-width="2.5"/><path d="m24 11 3.6 7.4 8.1 1.1-5.9 5.7 1.4 8L24 29.4l-7.2 3.8 1.4-8-5.9-5.7 8.1-1.1z" fill="#ffc83a"/></svg>
    <h1>BASE ALPHA</h1>
    <div class="panel"><h3>YOUR SOLDIER</h3><div class="prof"><button class="av" id="avBtn" aria-label="Change look"><img src="${avImg(ME.av, ME.color)}" alt=""></button>
      <div class="pf"><input id="nameIn" maxlength="16" placeholder="Name" value="${esc(ME.name)}" autocomplete="off">
      <div class="colors">${COLORS.map((c, i) => `<button style="background:${c}" data-col="${i}" aria-pressed="${ME.color === i}" aria-label="Color ${i + 1}"></button>`).join('')}</div></div></div></div>
    ${net}
    <div class="row"><button class="btn ghost" id="sndBtn">${svg(Mic.on ? 'mic' : 'micoff')} Blaster sounds</button><button class="btn ghost" id="moveBtn">${svg('feet')} Movement</button><button class="btn ghost" id="setBtn">${svg('gear')} Parent setup</button></div>`;
  if (nameFocused) { const n = $('#nameIn'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
}
let helloT = null;
function profileChanged() {
  saveMe();
  if (Net.role === 'client') { clearTimeout(helloT); helloT = setTimeout(() => Net.hello(), 400); }
  else { const P = G.players[ME.id]; if (P) { P.name = ME.name || 'Commander'; P.color = ME.color; P.av = ME.av; } }
}
function bindLobby() {
  const L = $('#lobby');
  L.addEventListener('input', e => { if (e.target.id === 'nameIn') { ME.name = e.target.value.trim().slice(0, 16); profileChanged(); } });
  L.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; unlock();
    if (b.id === 'avBtn') { ME.av = (ME.av + 1) % AVATARS.length; profileChanged(); renderLobby(true); }
    else if (b.dataset.col != null) { ME.color = +b.dataset.col; profileChanged(); renderLobby(true); }
    else if (b.id === 'hostBtn') { if (!ME.name) { ME.name = 'Commander'; saveMe(); } S.role = 'host'; saveS(); becomeHost(); }
    else if (b.id === 'joinBtn') { const code = $('#codeIn').value.trim(); if (!code) { toast('Type the code from the commander phone'); return; } if (!ME.name) { toast('Type your name first'); $('#nameIn').focus(); return; } S.role = 'client'; S.lastCode = code; saveS(); Net.join(code); }
    else if (b.id === 'startBtn') { act({ a: 'start' }); }
    else if (b.id === 'leaveBtn') { Net.leave(); S.role = null; saveS(); G.players = {}; ensureSelf(); renderLobby(true); }
    else if (b.id === 'sndBtn') openSheet('sound');
    else if (b.id === 'moveBtn') openSheet('move');
    else if (b.id === 'setBtn') openSheet('cmd', 'setup');
  });
}
export function ensureSelf() {
  if (Net.role === 'client') return;
  const P = App.game.addPlayer({ id: ME.id, name: ME.name || 'Commander', color: ME.color, av: ME.av }, Net.myPeer);
  G.hostId = ME.id; return P;
}
export function becomeHost(code) { Net.host(code); ensureSelf(); renderLobby(true); }

// ---------- sheets ----------
function openSheet(kind, t) {
  sheetKind = kind; spawnK = null; armed = null;
  const tabs = { cmd: [['spawn', 'SPAWN'], ['events', 'EVENTS'], ['players', 'TROOPERS'], ['say', 'RADIO'], ['voice', 'VOICE LINES'], ['setup', 'SETUP']].concat(Net.isHost() ? [['saves', 'SAVES']] : []), move: [],
    inv: [['w', 'WEAPONS'], ['it', 'ITEMS'], ['gear', 'GEAR']], calls: [], sound: [] }[kind];
  tab = t || (tabs.length ? tabs[0][0] : null);
  $('#shTitle').textContent = { cmd: 'COMMAND', inv: 'INVENTORY', calls: 'RADIO', sound: 'BLASTER SOUNDS', move: 'MOVEMENT AND SCOPE' }[kind];
  $('#shTabs').innerHTML = tabs.map(([k, l]) => `<button class="tab" data-tab="${k}" role="tab" aria-selected="${k === tab}">${l}</button>`).join('');
  $('#shTabs').hidden = !tabs.length;
  $('#sheet').hidden = false; renderSheet();
}
function closeSheet() { $('#sheet').hidden = true; if (Mic.rec) Mic.stopRec(); sheetKind = null; }
function renderSheet() {
  if (!sheetKind) return;
  $$('#shTabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  const body = $('#shBody'), keep = body.scrollTop;
  body.innerHTML = sheetKind === 'cmd' ? cmdHTML() : sheetKind === 'inv' ? invHTML() : sheetKind === 'calls' ? callsHTML() : sheetKind === 'move' ? moveHTML() : soundHTML();
  body.scrollTop = keep;
  if (sheetKind === 'calls') holdBtn($('#pttBig'), () => pttStart(), null, () => pttStop());
}
const delayRow = () => `<div class="sub"><span class="lbl">When</span><div class="seg" data-g="delay">${[[0, 'Now'], [5, 'In 5 sec'], [15, 'In 15 sec']].map(([v, l]) => `<button aria-pressed="${delay === v}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
const bar = v => `<i><u style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></u></i>`;

function invHTML() {
  const P = me(); if (!P) return '<p class="note">Join or host a game first.</p>';
  if (tab === 'w') return `<div class="cards">${WEAPON_ORDER.map(k => { const W = WEAPONS[k], own = !!P.inv.w[k], eq = P.wpn === k;
    const ammo = W.ammo === Infinity ? '∞' : (P.inv.ammo[k] | 0);
    return `<div class="card2 ${eq ? 'eq' : ''} ${own ? '' : 'locked'}"><div class="art"><img src="${IMG.w[k]}" alt=""></div><b>${W.n}</b><small>${W.d}</small>
      <div class="stat"><span>DAMAGE</span>${bar(W.dmg / 6)}<span>ACCURACY</span>${bar(W.acc)}<span>RANGE</span>${bar(1 - W.fall / .13 + .15)}<span>AMMO</span><span style="color:var(--hazard);font-size:14px">${ammo}</span></div>
      ${own ? `<button class="btn ${eq ? 'ghost' : 'go'}" data-equip="${k}" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>` : `<button class="btn ghost" disabled>LOCKED</button>`}</div>`; }).join('')}</div>
    <p class="note">New weapons unlock every 10 stars, in supply crates, or from the commander.</p>`;
  if (tab === 'it') return `<div class="cards">${ITEM_ORDER.map(k => { const n = P.inv.it[k] | 0;
    let btn = '';
    if (k === 'medkit') { const hurt = onlinePlayers().filter(q => q.inj > 0); btn = hurt.length ? hurt.map(q => `<button class="btn go" data-use="medkit" data-t="${q.id}" ${n ? '' : 'disabled'}>HEAL ${esc(q.name).toUpperCase()}</button>`).join('') : `<button class="btn ghost" disabled>NOBODY HURT</button>`; }
    else if (k === 'bomb') btn = `<button class="btn ${P.mode === 'bomb' ? 'ghost' : 'go'}" data-use="bomb" ${n && WEAPONS[P.wpn].modes.includes('bomb') ? '' : 'disabled'}>${P.mode === 'bomb' ? 'LOADED' : 'LOAD'}</button>`;
    else btn = `<button class="btn go" data-use="${k}" ${n && G.phase === 'play' ? '' : 'disabled'}>USE</button>`;
    return `<div class="card2"><span class="count">${n}</span><div class="art"><img src="${IMG.i[k]}" alt=""></div><b>${ITEMS[k].n}</b><small>${ITEMS[k].d}</small>${btn}</div>`; }).join('')}</div>`;
  return `<div class="cards">${GEAR_ORDER.map(k => { const own = !!P.inv.gear[k];
    return `<div class="card2 ${own ? 'eq' : 'locked'}"><div class="art"><img src="${IMG.i[k]}" alt=""></div><b>${GEAR[k].n}</b><small>${GEAR[k].d}</small><button class="btn ghost" disabled>${own ? 'WEARING' : 'NOT FOUND YET'}</button></div>`; }).join('')}</div>
    <p class="note">Gear works automatically once you have it. Find it on missions and in supply crates.</p>`;
}
function callsHTML() {
  return `<button class="pttbig" id="pttBig">${svg('mic')} HOLD TO TALK</button>
    <div class="callgrid">${CALLS.map(([ic, t], i) => `<button data-call="${i}">${svg(ic)}${t}</button>`).join('')}</div>
    <p class="note">Calls play on every linked phone. Talking needs the microphone on.</p>`;
}
// ----- sound setup -----
function soundHTML() {
  const modes = [['snap', 'Any snap'], ['one', 'One sound for all'], ['each', 'Each weapon its own sound']];
  const recRow = (key, title, img) => { const s = Mic.sig[key] || [], recNow = Mic.rec && Mic.rec.key === key, n = recNow ? Mic.rec.got.length : s.length, cons = Mic.consistency(key);
    return `<div class="recrow ${recNow ? 'recording' : ''}">${img ? `<img src="${img}" alt="">` : svg('fire')}<div class="rb"><b>${title}</b><small>${recNow ? 'Fire now…' : s.length ? `Recorded · consistency ${Math.round(cons * 100)}%` : 'Not recorded'}</small>
      <div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div></div>
      ${recNow ? `<button class="btn warn sm" data-stoprec>STOP</button>` : `<button class="btn sm" data-rec="${key}" ${Mic.on ? '' : 'disabled'}>${svg('mic')} ${s.length ? 'REDO' : 'RECORD'}</button>${s.length ? `<button class="btn ghost sm" data-clr="${key}" aria-label="Clear">${svg('clear')}</button>` : ''}`}</div>`; };
  let rec = '';
  if (S.shotMode === 'one') rec = `<div class="sub"><span class="lbl">Record the blaster</span>${recRow('one', 'All weapons', null)}<p class="note">Fire 5 times about one step from the phone. The game then fires your selected weapon whenever it hears that sound.</p></div>`;
  if (S.shotMode === 'each') rec = `<div class="sub"><span class="lbl">Record each blaster</span>${WEAPON_ORDER.map(k => recRow(k, WEAPONS[k].n, IMG.w[k])).join('')}
    <p class="note">Fire each blaster 5 times about one step from the phone. When the game hears one, it switches to that weapon and fires. Blasters that sound alike will get mixed up.</p></div>`;
  return `<div class="sub"><span class="lbl">Microphone on this phone</span>
      <div class="row" style="justify-content:flex-start">${Mic.on ? `<button class="btn ghost" data-mic="off">${svg('micoff')} Turn off</button>` : `<button class="btn go" data-mic="on">${svg('mic')} Turn on microphone</button>`}</div>
      ${Mic.err ? `<p class="note" style="color:var(--alert)">${esc(Mic.err)}</p>` : ''}
      <div class="meterbar" id="mtr"><i></i><b></b></div><p class="note">Green is what the phone hears. A shot has to jump past the yellow line.</p></div>
    <div class="sub"><span class="lbl">How shots are recognized</span><div class="seg" data-g="shotMode">${modes.map(([v, l]) => `<button aria-pressed="${S.shotMode === v}" data-v="${v}">${l}</button>`).join('')}</div>
      <p class="note">${S.shotMode === 'snap' ? 'Any sharp snap or click fires your selected weapon. Simplest, but claps and knocks count too.' : S.shotMode === 'one' ? 'Only your recorded blaster sound fires. Pick the weapon in the inventory.' : 'Each blaster fires its own weapon.'}</p></div>
    <div class="slider"><span><b>Sensitivity</b><em>${Math.round(S.sens * 100)}%</em></span><input type="range" id="sensIn" min="0" max="1" step="0.05" value="${S.sens}"><span><small>Loud shots only</small><small>Quiet clicks</small></span></div>
    ${S.shotMode !== 'snap' ? `<div class="slider"><span><b>Strictness</b><em>${Math.round(S.strict * 100)}%</em></span><input type="range" id="strictIn" min="0.6" max="0.95" step="0.01" value="${S.strict}"><span><small>Accept more</small><small>Fewer mistakes</small></span></div>` : ''}
    ${rec}
    <div class="sub"><span class="lbl">Test</span><div class="detect" id="detBox"><span class="note">Fire a blaster to test.</span></div></div>`;
}
function renderDetect() {
  const r = Mic.last, el = $('#detBox'); if (!el || !r) return;
  el.className = 'detect ' + (r.ok ? 'ok' : 'no');
  const w = r.w || (r.ok ? me() && me().wpn : r.w);
  el.innerHTML = r.ok ? `${w && IMG.w[w] ? `<img src="${IMG.w[w]}" alt="">` : svg('check')}<div><b>${r.w ? WEAPONS[r.w].n : 'Shot heard'}</b><br><small>${r.note ? esc(r.note) : `Match ${Math.round(r.score * 100)}%`}</small></div>`
    : `${svg('close')}<div><b>Not recognized</b><br><small>Closest: ${r.w ? WEAPONS[r.w] ? WEAPONS[r.w].n : 'recorded sound' : 'recorded sound'} ${Math.round(r.score * 100)}%</small></div>`;
}
function updateMeter() {
  const m = $('#mtr'); if (!m) return;
  const toPct = e => clamp((Math.log10(e + 1e-9) + 7) / 6, 0, 1) * 100;
  m.querySelector('i').style.width = (Mic.on ? toPct(Mic.level) : 0) + '%';
  m.querySelector('b').style.left = (Mic.on ? toPct(Mic.floor * Mic.thr) : 0) + '%';
}
// ----- movement and scope -----
function moveHTML() {
  const c = Track.calib, cal = Track.cal;
  let calHTML;
  if (!c) calHTML = `<p class="note">${cal ? `Calibrated: ${cal.n1} steps out and ${cal.n2} back.` : 'Not calibrated yet. Tracking needs one calibration walk on this phone, by the person who will carry it.'}</p>
      <button class="btn go" data-cal="start">${svg('feet')} ${cal ? 'Calibrate again' : 'Start calibration'}</button>`;
  else if (c.phase === 'out') calHTML = `<div class="panel"><h3>1. WALK TO THE BALCONY</h3><p class="note">Start at Base Alpha. Hold the phone in front of you, screen up, and walk normally to the balcony door.</p>
      <div class="codebig" id="mvCal">${c.n1}</div><span class="lbl" style="text-align:center">steps</span><button class="btn go" data-cal="turn">I'M AT THE BALCONY</button><button class="btn ghost sm" data-cal="cancel">Cancel</button></div>`;
  else calHTML = `<div class="panel"><h3>2. WALK BACK TO BASE</h3><p class="note">Now walk back to Base Alpha the same way.</p>
      <div class="codebig" id="mvCal">${c.n2}</div><span class="lbl" style="text-align:center">steps</span><button class="btn go" data-cal="done">I'M BACK AT BASE</button><button class="btn ghost sm" data-cal="cancel">Cancel</button></div>`;
  return `<div class="sub"><span class="lbl">Step and compass tracking (this phone)</span>
      <div class="detect" id="mvStat"></div>
      <div class="row" style="justify-content:flex-start">${Track.on ? `<button class="btn ghost" data-trk="off">${svg('close')} Turn off</button>` : `<button class="btn go" data-trk="on">${svg('feet')} Turn on</button>`}</div>
      ${Track.err ? `<p class="note" style="color:var(--alert)">${esc(Track.err)}</p>` : ''}
      ${calHTML}
      <p class="note">Each step moves your marker on the map. It can't walk through walls, so it snaps back on track at doorways. If it drifts, tap your room on the map: that resets it.</p></div>
    <div class="sub"><span class="lbl">AR scope</span>
      <p class="note">Shows the back camera in a small window with monsters drawn where the radar says they are. Point the phone around to find them. Needs tracking calibrated.</p>
      <div class="row" style="justify-content:flex-start">${Scope.on ? `<button class="btn ghost" data-scope="off">${svg('close')} Close scope</button>` : `<button class="btn go" data-scope="on">${svg('target')} Open scope</button>`}</div>
      ${Scope.err ? `<p class="note" style="color:var(--alert)">${esc(Scope.err)}</p>` : ''}</div>`;
}
function updateMove() {
  const st = $('#mvStat'); if (st) st.innerHTML = Track.on ? `${svg('radar')}<div><b>${Track.heading == null ? 'No compass yet' : 'Heading ' + Math.round(Track.heading) + '°'}</b><br><small>${Track.steps} steps · at ${ROOMS[Track.room] ? ROOMS[Track.room].n : '?'}${Track.cal ? '' : ' · not calibrated'}</small></div>` : `<span class="note">Tracking is off.</span>`;
  const c = $('#mvCal'); if (c && Track.calib) c.textContent = Track.calib.phase === 'out' ? Track.calib.n1 : Track.calib.n2;
}
// ----- command drawer -----
function cmdHTML() {
  const playing = G.phase === 'play' || G.phase === 'emergency';
  if (tab === 'spawn') {
    if (!spawnK) return (playing ? '' : `<p class="note">Start the game first, then monsters can be sent in.</p>`) + delayRow() +
      `<div class="sub"><span class="lbl">Send a monster</span><div class="grid">${MONSTER_MENU.map(([k, n]) => `<button class="gbtn" data-k="${k}"><img src="${IMG.m[k]}" alt="">${n}</button>`).join('')}</div></div>
      <div class="sub"><span class="lbl">Tools</span><div class="row" style="justify-content:flex-start"><button class="btn ghost" data-x="kill">${svg('target')} Defeat target</button><button class="btn ghost" data-x="clear">${svg('clear')} Clear radar</button></div>
      <p class="note">Defeat target removes the monster this phone has targeted, or the closest one.</p></div>`;
    const nm = MONSTER_MENU.find(m => m[0] === spawnK)[1];
    return `<div class="chooser-h"><button class="ibtn" data-x="back" aria-label="Back">${svg('back')}</button><img src="${IMG.m[spawnK]}" alt=""><b>Where does the ${nm.toLowerCase()} come from?</b></div>${delayRow()}
      <div class="grid"><button class="gbtn" data-r="surprise">${svg('dice')}Surprise</button>${SPAWN_ROOMS.map(r => `<button class="gbtn" data-r="${r}">${svg(r === 'frontdoor' ? 'flag' : 'map')}${ROOMS[r].n}</button>`).join('')}</div>`;
  }
  if (tab === 'events') return delayRow() + `<div class="evlist">${EVENTS.map(([e, ic, t, d]) => `<button class="ev" data-e="${e}">${IMG.i[ic] ? `<img src="${IMG.i[ic]}" alt="" style="width:30px;height:30px">` : svg(ic)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
    ${G.mission ? `<button class="btn ghost" data-x="abort">${svg('close')} Cancel current mission</button>` : ''}`;
  if (tab === 'players') {
    const list = Object.values(G.players);
    return `<div class="row" style="justify-content:flex-start"><button class="btn" data-x="allbase">${svg('home')} Everyone to base</button></div>` + list.map(P => {
      const ri = rankOf(P.stars);
      return `<div class="prow"><div class="ph"><img src="${avImg(P.av, P.color)}" alt=""><b>${esc(P.name)}<br><small>${RANKS[ri][0]} · ${P.stars} stars · ${P.online ? ROOMS[P.room].n : 'offline'}${P.inj > 0 ? ` · HURT ${Math.ceil(P.inj)}s` : ''}${P.down ? ' · OUT' : ''}</small></b></div>
        <div class="minirow"><button class="tg" data-p="${P.id}" data-pa="heal">${svg('heart')} Heal</button><button class="tg" data-p="${P.id}" data-pa="hurt">${svg('medkit')} Hurt</button><button class="tg" data-p="${P.id}" data-pa="base">${svg('home')} To base</button></div>
        <div class="field-in"><span class="lbl" style="width:auto">Location</span><select data-p="${P.id}" data-loc aria-label="Location of ${esc(P.name)}">${PLACE_ROOMS.map(r => `<option value="${r}" ${P.room === r ? 'selected' : ''}>${ROOMS[r].n}</option>`).join('')}</select></div>
        <div class="minirow"><span class="lbl">Give items</span>${ITEM_ORDER.map(k => `<button class="tg" data-p="${P.id}" data-give="${k}"><img src="${IMG.i[k]}" alt="" style="width:20px;height:20px">+1 ${ITEMS[k].n} (${P.inv.it[k] | 0})</button>`).join('')}<button class="tg" data-p="${P.id}" data-pa="ammo"><img src="${IMG.i.ammo}" alt="" style="width:20px;height:20px">Ammo refill</button></div>
        <div class="minirow"><span class="lbl">Weapons</span>${WEAPON_ORDER.filter(k => k !== 'handgun').map(k => `<button class="tg" data-p="${P.id}" data-wpn="${k}" aria-pressed="${!!P.inv.w[k]}"><img src="${IMG.w[k]}" alt="">${WEAPONS[k].short}</button>`).join('')}</div>
        <div class="minirow"><span class="lbl">Gear</span>${GEAR_ORDER.map(k => `<button class="tg" data-p="${P.id}" data-gear="${k}" aria-pressed="${!!P.inv.gear[k]}">${GEAR[k].n}</button>`).join('')}</div></div>`; }).join('');
  }
  if (tab === 'say') return `<div class="sub"><span class="lbl">Type a message</span><div class="field-in"><textarea id="sayTxt" maxlength="220" placeholder="Troopers, the snack supplies have arrived."></textarea></div>
      <div class="row" style="justify-content:flex-start"><button class="btn" data-x="say">${svg('radio')} Announce</button><button class="btn ghost" data-x="repeat">${svg('replay')} Repeat last</button></div></div>
    <div class="sub"><span class="lbl">Quick lines</span><div class="lines">${LINES.map((l, i) => `<button class="line" data-l="${i}">${svg('radio')}${esc(l.replace(/\{n\}/g, ME.name || 'Commander'))}</button>`).join('')}</div></div>`;
  if (tab === 'voice') {
    if (!Net.isHost()) return `<p class="note">Edit voice lines on the commander phone.</p>`;
    const keys = Object.keys(VOICE).filter(k => VOICE[k][0] === vcat);
    return `<div class="seg" data-g="vcat">${LINE_CATS.map(([k, n]) => `<button aria-pressed="${vcat === k}" data-v="${k}">${n}</button>`).join('')}</div>
      <p class="note">One version per line; the game picks one at random each time. Leave out commas: the phone's voice pauses at every comma. Words in curly brackets get filled in by the game.</p>` +
      keys.map(k => { const [, desc, , ph] = VOICE[k], edited = !!Lines.over[k], txt = Lines.text(k);
        return `<div class="vline ${edited ? 'edited' : ''}"><div class="vh"><b>${esc(desc)}</b>${ph ? `<small>${esc(ph)}</small>` : ''}</div>
          <textarea data-vk="${k}" rows="${Math.max(1, txt.split('\n').length)}" aria-label="${esc(desc)}">${esc(txt)}</textarea>
          <div class="minirow"><button class="tg" data-vplay="${k}">${svg('play')} Hear it</button>${edited ? `<button class="tg" data-vreset="${k}">${svg('replay')} Original</button><span class="lbl" style="width:auto">EDITED</span>` : ''}</div></div>`; }).join('');
  }
  if (tab === 'saves') {
    const l = Saves.list();
    return `<p class="note">Saves keep every trooper's rank, stars, weapons and items. They live on this phone. Back them up to a file now and then.</p>` +
      l.map((s, i) => `<div class="saverow ${G.slot === i ? 'cur' : ''}">${svg('save')}<div class="sb"><b>${s ? esc(s.name) : `Slot ${i + 1} · empty`}</b><small>${s ? `${new Date(s.at).toLocaleString()} · ${s.players.map(p => esc(p.name) + ' ' + p.stars + '★').join(', ')}` : 'Nothing saved yet'}</small></div>
        <button class="btn sm" data-save="${i}">${armed === 'save' + i ? 'Sure?' : 'Save'}</button>${s ? `<button class="btn go sm" data-load="${i}">${armed === 'load' + i ? 'Sure?' : 'Load'}</button><button class="btn ghost sm" data-del="${i}" aria-label="Delete">${armed === 'del' + i ? 'Sure?' : svg('clear')}</button>` : ''}</div>`).join('') +
      `<div class="row" style="justify-content:flex-start"><button class="btn ghost" data-x="export">${svg('download')} Back up to a file</button><button class="btn ghost" data-x="import">${svg('upload')} Restore from file</button></div>
      <p class="note">The current slot (highlighted) saves automatically when stars or items change.</p>`;
  }
  // setup
  return `<div class="sub"><span class="lbl">Monsters arriving on their own</span><div class="seg" data-g="auto">${[['off', 'Off'], ['calm', 'Calm'], ['normal', 'Normal'], ['busy', 'Busy']].map(([v, l]) => `<button aria-pressed="${G.cfg.auto === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="sub"><span class="lbl">Radio voice</span><div class="seg" data-g="voice">${[['all', 'Everything'], ['important', 'Important only'], ['off', 'Silent']].map(([v, l]) => `<button aria-pressed="${G.cfg.voice === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="sub"><span class="lbl">Injuries in long fights</span><div class="seg" data-g="injuries">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button aria-pressed="${G.cfg.injuries === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="sub"><span class="lbl">Timed supply drops</span><div class="seg" data-g="drops">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button aria-pressed="${G.cfg.drops === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="sub"><span class="lbl">Missions never go to</span><div class="seg rooms" data-g="off">${MISSION_ROOMS.map(r => `<button aria-pressed="${G.cfg.off.includes(r)}" data-v="${r}">${ROOMS[r].n}</button>`).join('')}</div></div>
    <div class="sub"><span class="lbl">This phone's speaker plays team announcements</span><div class="seg" data-g="speaker">${[[null, 'Auto'], [true, 'Always'], [false, 'Only mine']].map(([v, l]) => `<button aria-pressed="${S.speaker === v}" data-v="${v}">${l}</button>`).join('')}</div>
      <p class="note">Auto: the commander phone always speaks; other phones speak when their trooper is in a different room from the commander.</p></div>
    <div class="sub"><span class="lbl">Radar direction (this phone)</span><div class="seg" data-g="rot">${[[0, 'Balcony up'], [90, 'Balcony right'], [180, 'Balcony down'], [270, 'Balcony left']].map(([v, l]) => `<button aria-pressed="${S.rot === v}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="row" style="justify-content:flex-start"><button class="btn ghost" data-x="sound">${svg('mic')} Blaster sounds</button><button class="btn ghost" data-x="move">${svg('feet')} Movement</button><button class="btn ghost" data-x="end">${svg('back')} Back to start screen</button></div>
    ${Net.role ? `<p class="note">Game code: <b>${esc(Net.code)}</b> · ${esc(Net.status)}</p>` : ''}`;
}
function bindSheet() {
  $('#shClose').innerHTML = svg('close'); $('#shClose').addEventListener('click', closeSheet);
  $('#shTabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; tab = b.dataset.tab; spawnK = null; armed = null; renderSheet(); });
  $('#shBody').addEventListener('change', e => {
    if (e.target.matches('textarea[data-vk]')) { act({ a: 'line', k: e.target.dataset.vk, v: e.target.value }); e.target.closest('.vline').classList.add('edited'); toast('Saved'); return; } if (e.target.matches('select[data-loc]')) { act({ a: 'move', room: e.target.value, who: e.target.dataset.p }); toast('Location set'); } });
  $('#shBody').addEventListener('input', e => {
    if (e.target.id === 'sensIn') { S.sens = +e.target.value; saveS(); Mic.applySens(); e.target.parentElement.querySelector('em').textContent = Math.round(S.sens * 100) + '%'; }
    if (e.target.id === 'strictIn') { S.strict = +e.target.value; saveS(); e.target.parentElement.querySelector('em').textContent = Math.round(S.strict * 100) + '%'; }
  });
  $('#shBody').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t || t.disabled) return; unlock();
    const seg = t.closest('[data-g]');
    if (seg) {
      const g = seg.dataset.g, raw = t.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : raw;
      if (g === 'delay') delay = +v;
      else if (g === 'auto' || g === 'voice') { act({ a: 'set', k: g, v }); G.cfg[g] = v; }
      else if (g === 'injuries' || g === 'drops') { act({ a: 'set', k: g, v }); G.cfg[g] = v; }
      else if (g === 'off') { const o = new Set(G.cfg.off); o.has(v) ? o.delete(v) : o.add(v); const arr = [...o]; act({ a: 'set', k: 'off', v: arr }); G.cfg.off = arr; }
      else if (g === 'rot') { S.rot = +v; saveS(); }
      else if (g === 'speaker') { S.speaker = v; saveS(); }
      else if (g === 'shotMode') { S.shotMode = v; saveS(); Mic.stopRec(); }
      else if (g === 'vcat') { vcat = v; $('#shBody').scrollTop = 0; }
      renderSheet(); return;
    }
    const d = t.dataset;
    // inventory
    if (d.equip) { act({ a: 'equip', w: d.equip }); Snd.play('equip'); setTimeout(renderSheet, 250); return; }
    if (d.use) { act({ a: 'item', k: d.use, t: d.t }); if (d.use !== 'bomb') closeSheet(); else setTimeout(renderSheet, 250); return; }
    // calls
    if (d.call != null) { act({ a: 'call', i: +d.call }); toast('Call sent'); closeSheet(); return; }
    // sound setup
    if (d.mic === 'on') { try { await Mic.enable(); } catch (err) {} renderSheet(); return; }
    if (d.mic === 'off') { Mic.disable(); renderSheet(); return; }
    if (d.rec) { Mic.startRec(d.rec, done => { renderSheet(); if (done) toast('Recorded!'); }); renderSheet(); return; }
    if (d.stoprec != null) { Mic.stopRec(); renderSheet(); return; }
    if (d.clr) { Mic.clear(d.clr); renderSheet(); return; }
    // voice lines
    if (d.vplay) { const ta = $(`textarea[data-vk="${d.vplay}"]`); const vers = (ta ? ta.value : Lines.text(d.vplay)).split('\n').map(x => x.trim()).filter(Boolean);
      const sample = { name: ME.name || 'Jordi', where: 'the kitchen', monster: 'zombie', count: 'Two zombies', weapon: 'Striker AR', reward: 'a medkit', rank: 'Sergeant', names: 'Dad and Jordi', medic: 'Dad' };
      const line = (vers[Math.floor(Math.random() * vers.length)] || '').replace(/\{(\w+)\}/g, (m, n) => sample[n] || m); if (line) { S.sound = true; Voice.say(line); ticker(line, 'radio'); } return; }
    if (d.vreset) { act({ a: 'line', k: d.vreset, reset: true }); setTimeout(renderSheet, 100); return; }
    // movement and scope
    if (d.trk === 'on') { try { await Track.enable(); toast('Tracking on'); } catch (err) { toast(Track.err); } renderSheet(); return; }
    if (d.trk === 'off') { Track.disable(); renderSheet(); return; }
    if (d.cal === 'start') { if (!Track.on) { try { await Track.enable(); } catch (err) { toast(Track.err); renderSheet(); return; } } Track.calStart(); act({ a: 'move', room: 'base' }); renderSheet(); return; }
    if (d.cal === 'turn') { Track.calTurn(); Snd.play('pop'); renderSheet(); return; }
    if (d.cal === 'done') { const r = Track.calFinish(); toast(r.msg); renderSheet(); return; }
    if (d.cal === 'cancel') { Track.calCancel(); renderSheet(); return; }
    if (d.scope === 'on') { try { await Scope.enable(); } catch (err) { toast(Scope.err); } renderSheet(); return; }
    if (d.scope === 'off') { Scope.disable(); renderSheet(); return; }
    // command
    if (d.k) { spawnK = d.k; renderSheet(); return; }
    if (d.r) { act({ a: 'spawn', k: spawnK, r: d.r, d: delay }); const nm = MONSTER_MENU.find(m => m[0] === spawnK)[1]; toast(`${nm} ${d.r === 'surprise' ? 'from a surprise spot' : 'from ' + ROOMS[d.r].n}${delay ? ` in ${delay}s` : ''}`); closeSheet(); return; }
    if (d.e) { act({ a: 'event', e: d.e, d: delay }); toast(`${EVENTS.find(x => x[0] === d.e)[2]}${delay ? ` in ${delay}s` : ''}`); closeSheet(); return; }
    if (d.l != null) { act({ a: 'say', t: LINES[+d.l].replace(/\{n\}/g, ME.name || 'Commander') }); toast('Announced'); return; }
    if (d.p) {
      const who = d.p;
      if (d.pa === 'heal') act({ a: 'heal', who }); else if (d.pa === 'hurt') act({ a: 'hurt', who }); else if (d.pa === 'base') act({ a: 'move', room: 'base', who });
      else if (d.pa === 'ammo') { for (const k of ['striker', 'viper', 'longshot', 'cannon']) act({ a: 'grant', who, kind: 'ammo', k, n: WEAPONS[k].pack }); }
      else if (d.move) act({ a: 'move', room: d.move, who });
      else if (d.give) act({ a: 'grant', who, kind: 'it', k: d.give, n: 1 });
      else if (d.wpn) act({ a: 'grant', who, kind: 'w', k: d.wpn, on: t.getAttribute('aria-pressed') !== 'true' });
      else if (d.gear) act({ a: 'grant', who, kind: 'gear', k: d.gear, on: t.getAttribute('aria-pressed') !== 'true' });
      setTimeout(renderSheet, 300); return;
    }
    if (d.save != null) { const i = +d.save; if (Saves.list()[i] && armed !== 'save' + i) { armed = 'save' + i; renderSheet(); return; } Saves.save(i); armed = null; toast(`Saved to slot ${i + 1}`); renderSheet(); return; }
    if (d.load != null) { const i = +d.load; if (armed !== 'load' + i) { armed = 'load' + i; renderSheet(); return; } Saves.load(i); armed = null; toast(`Loaded slot ${i + 1}`); renderSheet(); return; }
    if (d.del != null) { const i = +d.del; if (armed !== 'del' + i) { armed = 'del' + i; renderSheet(); return; } Saves.del(i); armed = null; renderSheet(); return; }
    switch (d.x) {
      case 'back': spawnK = null; renderSheet(); break;
      case 'kill': act({ a: 'kill', id: sel }); toast('Target defeated'); break;
      case 'clear': act({ a: 'clear' }); toast('Radar cleared'); break;
      case 'abort': act({ a: 'abort' }); closeSheet(); break;
      case 'allbase': act({ a: 'allbase' }); toast('Everyone to base'); setTimeout(renderSheet, 300); break;
      case 'say': { const v = $('#sayTxt').value; if (v.trim()) { act({ a: 'say', t: v }); $('#sayTxt').value = ''; toast('Announced'); } break; }
      case 'repeat': act({ a: 'repeat' }); break;
      case 'end': act({ a: 'end' }); closeSheet(); break;
      case 'sound': openSheet('sound'); break;
      case 'move': openSheet('move'); break;
      case 'export': Saves.exportFile(); break;
      case 'import': $('#importIn').click(); break;
    }
  });
  $('#importIn').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { await Saves.importFile(f); toast('Backup restored'); renderSheet(); } catch (err) { toast(err.message || 'Could not read that file'); } e.target.value = ''; });
}

// ---------- overlays ----------
function bindOverlays() {
  $('#resumeBtn').innerHTML = `${svg('play')} RESUME`; $('#resumeBtn').addEventListener('click', () => { unlock(); act({ a: 'pause', v: false }); });
  $('#keepBtn').innerHTML = `${svg('play')} KEEP GOING`; $('#keepBtn').addEventListener('click', () => act({ a: 'wake' }));
  $('#vNightBtn').innerHTML = `${svg('moon')} NIGHT WATCH`; $('#vNightBtn').addEventListener('click', () => act({ a: 'night' }));
  $('#wakeBtn').innerHTML = `${svg('radar')} WAKE THE BASE`; $('#wakeBtn').addEventListener('click', () => { unlock(); act({ a: 'wake' }); });
  $('#moonIc').innerHTML = svg('moon', 'moon'); $('#emergBtn').innerHTML = svg('wrench');
  holdBtn($('#emergBtn'), null, holdAct('emerg'));
}
const show = (id, on) => { const el = $(id); if (el.hidden === on) el.hidden = !on; };

// ---------- periodic UI refresh ----------
let prevTalk = new Set(), victSig = '';
export function ui() {
  const P = me(), ph = G.phase;
  show('#ovStart', ph === 'start'); show('#ovPause', G.paused && (ph === 'play' || ph === 'emergency')); show('#ovEmerg', ph === 'emergency' && !G.paused);
  show('#ovVictory', ph === 'victory'); show('#ovNight', ph === 'night');
  if (ph === 'start') renderLobby();
  if (ph === 'victory') { const sig = Object.values(G.players).map(p => p.id + p.stars).join(); if (sig !== victSig) { victSig = sig;
    $('#vPlayers').innerHTML = onlinePlayers().map(p => `<div><img src="${avImg(p.av, p.color)}" alt="">${esc(p.name)}<span class="lbl">${RANKS[rankOf(p.stars)][0]} · ${p.stars}★</span></div>`).join('');
    $('#vNote').textContent = `${G.sesStars} star${G.sesStars === 1 ? '' : 's'} earned this mission.`; } }
  $('#emergBtn').style.setProperty('--p', Math.min(1, G.emerg));
  // header
  $('#cmdTitle').textContent = P && P.name ? P.name.toUpperCase() : 'BASE ALPHA'; $('#cmdName').textContent = P ? `${RANKS[rankOf(P.stars)][0].toUpperCase()} · ${P.stars}★` : '';
  $('#team').innerHTML = Object.values(G.players).filter(p => p.online).map(p => `<span class="chip"><img src="${avImg(p.av, p.color)}" alt="${esc(p.name)}">${p.talk ? '<i class="dot talk"></i>' : p.inj > 0 ? '<i class="dot hurt"></i>' : p.down ? '<i class="dot down"></i>' : ''}</span>`).join('');
  $('#micBtn').innerHTML = svg(Mic.on ? 'mic' : 'micoff'); $('#micBtn').classList.toggle('live', Mic.on);
  $('#soundBtn').innerHTML = svg(S.sound ? 'sound' : 'mute'); $('#soundBtn').classList.toggle('on', !S.sound);
  $('#pauseBtn').innerHTML = svg(G.paused ? 'play' : 'pause');
  $('#moveFab').classList.toggle('live', Track.on && !!Track.cal);
  // banner
  const bn = $('#banner'); const talkers = Object.values(G.players).filter(p => p.talk && p.id !== ME.id);
  let bh = '', bc = '';
  if (P && P.inj > 0) { bc = 'hurt'; bh = `${svg('medkit')}<span><b>YOU'RE HURT!</b> Get a teammate with a medkit.</span><span class="tm">${Math.ceil(P.inj)}s</span>`; }
  else if (P && P.grab > 0) { bc = 'hurt'; bh = `${svg('alert')}<span><b>MONSTER ON YOU!</b> Shoot it or run!</span><span class="gbar"><i style="width:${Math.round(Math.min(1, P.grab) * 100)}%"></i></span>`; }
  else if (P && P.down) { bc = 'down'; bh = `${svg('home')}<span><b>OUT OF ACTION.</b> ${P.room === 'base' ? 'Recovering at base…' : 'Get back to base to recover.'}</span>${P.rec ? `<span class="tm">${Math.ceil(P.rec)}s</span>` : ''}`; }
  else if (talkers.length) { bc = 'talk'; bh = `${svg('radio')}<span><b>${esc(talkers[0].name.toUpperCase())}</b> is talking…</span>`; }
  else if (!Snd.ctx || Snd.ctx.state !== 'running') { if (ph !== 'start') { bc = 'down'; bh = `${svg('sound')}<span>Tap anywhere to turn on sound.</span>`; } }
  document.body.classList.toggle('danger', !!(P && P.grab > 0));
  if (bn.dataset.h !== bh) { bn.dataset.h = bh; bn.innerHTML = bh; bn.className = 'banner ' + bc; bn.hidden = !bh; }
  const now = new Set(talkers.map(p => p.id)); for (const id of now) if (!prevTalk.has(id)) Snd.play('radio_on'); for (const id of prevTalk) if (!now.has(id)) Snd.play('radio_off'); prevTalk = now;
  // status
  const sh = $('#shbar'); $('#shFill').style.width = G.shield + '%'; $('#shPct').textContent = Math.round(G.shield);
  sh.classList.toggle('low', G.shield < 30); sh.classList.toggle('mid', G.shield >= 30 && G.shield < 60); sh.classList.toggle('on', G.shOn > 0);
  const mch = $('#mchip'); const m = G.mission;
  if (m) { const d = MIS[m.k]; const txt = `${d.t}: ${m.step === 2 ? 'BACK TO BASE' : ROOMS[m.room].n.toUpperCase()}`; if (mch.dataset.t !== txt) { mch.dataset.t = txt; mch.innerHTML = svg(d.ic) + esc(txt); } mch.hidden = false; } else mch.hidden = true;
  // pad
  if (P) {
    const W = WEAPONS[P.wpn], am = W.ammo === Infinity ? '∞' : (P.inv.ammo[P.wpn] | 0);
    const wb = $('#wpnBtn'); if ($('#wpnImg').dataset.k !== P.wpn) { $('#wpnImg').src = IMG.w[P.wpn]; $('#wpnImg').dataset.k = P.wpn; }
    $('#wpnAm').innerHTML = `${am}<small>${P.wpn === 'laser' && P.cdLaser > 0 ? 'CHARGING' : W.short}</small>`; wb.classList.toggle('empty', am === 0);
    const fz = $('#frzBtn'), bm = $('#bombBtn');
    fz.disabled = !W.modes.includes('freeze'); fz.classList.toggle('armed', P.mode === 'freeze'); fz.style.setProperty('--cd', P.cdFrz > 0 ? P.cdFrz / FREEZE_ROUND_CD : 0);
    bm.disabled = !W.modes.includes('bomb') || !(P.inv.it.bomb > 0); bm.classList.toggle('armed', P.mode === 'bomb'); $('#bombCnt').textContent = P.inv.it.bomb | 0;
    const chk = fireCheck(P); $('#fireBtn').classList.toggle('deny', chk === 'laser' || chk === 'empty' || chk === 'no');
    const tgt = G.th.find(t => t.id === sel); $('#accTxt').textContent = tgt && G.phase === 'play' ? Math.round(accuracy(P, tgt) * 100) + '%' : '';
  }
  $('#shieldBtn').style.setProperty('--cd', G.cdShield / 30); $('#shieldBtn').classList.toggle('lit', G.shOn > 0);
  if (sel != null && !G.th.some(t => t.id === sel)) sel = null;
  renderCtx();
  Track.sync(P);
  if (sheetKind === 'sound') updateMeter();
  if (sheetKind === 'move') updateMove();
}

// ---------- loop ----------
let lastT = performance.now(), uiT = 0, sheetT = 0;
function loop(t) {
  const dt = Math.min(.1, Math.max(0, (t - lastT) / 1000)); lastT = t; tnow += dt;
  try {
    if (Net.isHost()) App.game.tick(dt); else App.game.lerp(dt);
    if (!$('#dock').hidden) drawRadar(dt); else if (!$('#field').hidden) drawMap();
    Scope.draw(tnow, sel);
    uiT += dt; if (uiT > .12) { uiT = 0; ui(); }
    sheetT += dt; if (sheetT > 1 && sheetKind && (sheetKind === 'cmd' && tab === 'players' || sheetKind === 'inv') && !document.activeElement.matches('input,textarea,select')) { sheetT = 0; renderSheet(); }
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
export function startUI() {
  buildHeader(); buildPad(); bindCanvases(); bindLobby(); bindSheet(); bindOverlays();
  $('#moveFab').innerHTML = svg('feet'); $('#moveFab').addEventListener('click', () => { unlock(); openSheet('move'); });
  $('#scopeCv').addEventListener('pointerdown', e => { const id = Scope.pick(e); if (id != null) { sel = id; Snd.play('tick'); } });
  $('#scopeX').innerHTML = svg('close'); $('#scopeX').addEventListener('click', () => Scope.disable());
  setView(S.view === 'field' ? 'field' : 'dock'); ticker(G.last, 'radio');
  requestAnimationFrame(loop);
}
App.ui = { ticker, onShot, onDetect, act, ui, toast };
