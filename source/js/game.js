// Game state and the simulation. Only the commander's phone runs tick() and apply();
// other phones send actions and draw the state they receive.
import { App, rnd, pick, clamp } from './core.js';
import { ROOMS, B, route, roomAt, MISSION_ROOMS, T, WEAPONS, MIN_ACC, FREEZE_ROUND_CD, ITEMS, GEAR, GEAR_ORDER, WEAPON_ORDER, starterInv, BOOST_SHOTS, RANKS, rankOf, MIS, CALLS, CONTACT_R, GRAB } from './data.js';
import { L, Lines, LINES } from './lines.js';
import { odds, pickTarget } from './aim.js';

export const G = {
  phase: 'start', paused: false, th: [], nid: 1, shield: 100, shOn: 0, cdShield: 0, scan: 0, power: true, dance: 0,
  mission: null, finale: false, chopper: 0, sesStars: 0, last: 'Base Alpha standing by.', lastIc: 'radio',
  interf: 0, robot: 0, emerg: 0, autoT: 12, dropT: 120, drone: 0, droneT: 0, holds: {}, repairBy: null,
  clock: 0, lastShot: -99, lastBomb: -99, cov: true,
  drops: [], turrets: [], players: {},
  cfg: { auto: 'calm', voice: 'all', off: ['master'], injuries: true, drops: true },
  roster: {}, slot: -1, hostId: null
};
const CDMAX_SHIELD = 30;
const pend = [];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const posOf = P => (P && P.x != null ? P : ROOMS[P && P.room] || B);
const online = () => Object.values(G.players).filter(p => p.online);
const hostile = t => !T[t.k].friendly;
const mname = t => T[t.k].n.toLowerCase().replace(' mutant', '');
const Mname = t => { const n = mname(t); return n[0].toUpperCase() + n.slice(1); };
const where = r => ROOMS[r] ? ROOMS[r].say : r;

// ---------- players ----------
function place(P, room) { const r = ROOMS[room] || B; P.room = ROOMS[room] ? room : 'base'; P.x = r.x + rnd(-25, 25); P.y = r.y + rnd(-15, 25); }
export function addPlayer(profile, peer) {
  let P = G.players[profile.id];
  if (!P) {
    P = { id: profile.id, inj: 0, down: false, rec: 0, stars: 0, kills: 0, inv: starterInv(), wpn: 'striker', mode: null, cdFire: 0, cdLaser: 0, cdFrz: 0, talk: false, grab: 0 };
    place(P, 'base');
    const saved = G.roster[profile.id] || Object.values(G.roster).find(r => r.name && profile.name && r.name.toLowerCase() === String(profile.name).toLowerCase());
    if (saved) applySaved(P, saved);
    G.players[profile.id] = P;
  }
  P.name = String(profile.name || 'Soldier').slice(0, 16); P.color = profile.color | 0; P.av = profile.av | 0; P.online = true; P.peer = peer || null;
  return P;
}
export function applySaved(P, s) { P.stars = s.stars | 0; P.kills = s.kills | 0; if (s.inv) P.inv = sanitizeInv(s.inv); }
export function sanitizeInv(v) {
  const inv = starterInv(); if (!v || typeof v !== 'object') return inv;
  for (const k of WEAPON_ORDER) inv.w[k] = v.w && v.w[k] ? 1 : (k === 'handgun' ? 1 : 0);
  for (const k in inv.ammo) inv.ammo[k] = clamp((v.ammo && v.ammo[k]) | 0, 0, 999);
  for (const k in inv.it) inv.it[k] = clamp((v.it && v.it[k]) | 0, 0, 99);
  for (const k of GEAR_ORDER) if (v.gear && v.gear[k]) inv.gear[k] = 1;
  inv.boost = clamp(v.boost | 0, 0, 999);
  return inv;
}
export function dropPlayer(pid) { const P = G.players[pid]; if (P) { P.online = false; P.talk = false; } }

// ---------- effects: sounds + announcements, routed to the right phones ----------
const thr = {};
export function say(text, pri = 1, ic = 'radio', key, to, extra) {
  if (!text) return;
  if (key) { const t = Date.now(); if (thr[key] && t - thr[key] < (extra && extra.every || 9000)) return; thr[key] = t; }
  if (!to) { G.last = text; G.lastIc = ic; }
  fxOut(Object.assign({ say: text, pri, ic, to }, extra && extra.vib ? { vib: extra.vib } : {}));
}
export const sfx = (n, o = {}) => fxOut(Object.assign({ snd: n }, o));
function fxOut(f) { App.fx.play(f); if (App.net && App.net.isHost()) App.net.fx(f); }

// ---------- threats ----------
function pickSpawnRoom() {
  const r = Math.random(); if (r < .4) return 'balcony'; if (r < .75) return 'frontdoor';
  const o = ['living', 'couch', 'nook1', 'nook2', 'dining', 'kitchen'].filter(x => !G.cfg.off.includes(x)); return o.length ? pick(o) : 'balcony';
}
let grp = null;
export function spawn(k, roomId, o = {}) {
  if (!T[k]) return null;
  if (!roomId || roomId === 'surprise' || !ROOMS[roomId] || roomId === 'base') roomId = pickSpawnRoom();
  const r = ROOMS[roomId];
  const t = { id: G.nid++, k, x: r.x + rnd(-20, 20), y: r.y + rnd(-20, 20), hp: T[k].hp, mx: T[k].hp, fz: 0, vul: 0, sl: false, at: false, age: 0, room: roomId, path: [], pi: 0, rv: k !== 'my', dz: 0, hitT: 0,
    prey: null, hunt: false, grab: 0, done: [], huntRoom: null, inC: false };
  if (r.out) { t.x = r.out[0]; t.y = r.out[1] + rnd(-14, 14); }
  if (k === 'sl') { const mids = [roomId, ...route(roomId, 'base')].filter(n => ['living', 'dining', 'kitchen', 'couch'].includes(n) && n !== roomId); t.goal = o.sleepAt || mids[0] || roomId; }
  if (k === 'cat') { t.goal = pick(['living', 'couch', 'kitchen', 'dining']); t.life = 24; }
  if (o.asleep) { t.sl = true; t.goal = null; }
  const dest = t.goal || 'base';
  t.path = r.out ? [roomId, ...route(roomId, dest)] : route(roomId, dest);
  if (t.sl) t.path = [];
  G.th.push(t);
  if (!o.quiet) announceSpawn(t, roomId);
  return t;
}
function announceSpawn(t, room) {
  const w = where(room), snd = { z: 'pip', h: 'horde', tk: 'pulse', sp: 'pulse', iv: 'pulse', sl: 'low', dn: 'boing', my: 'static' }[t.k];
  if (snd) sfx(snd);
  if (t.k === 'z') {
    if (grp && grp.room === room) grp.n++;
    else { grp = { room, n: 1 }; setTimeout(() => { const g = grp; grp = null; if (!g) return; const count = ['', 'A zombie', 'Two zombies', 'Three zombies', 'Four zombies'][g.n] || 'Lots of zombies'; say(L('spawn_z', { count, where: where(g.room) }), 1, 'z'); }, 1300); }
  } else if (LINES['spawn_' + t.k]) say(L('spawn_' + t.k, { where: w }), 2, t.k);
}
function removeT(t) { const i = G.th.indexOf(t); if (i >= 0) G.th.splice(i, 1); }
function defeat(t, P) {
  removeT(t); sfx('die_' + (t.k === 'cat' ? 'my' : t.k));
  if (P) P.kills = (P.kills | 0) + 1;
  if (T[t.k].mut) { say(L('mutant_down', { name: P ? P.name : 'trooper' }), 2, 'star'); if (P) addStars(1, [P]); else addStars(1); }
  else if (t.k === 'h') { say(L('horde_down'), 2, 'star'); addStars(1); }
  else if (Math.random() < .3) say(L('zombie_down'), 0, 'z');
}
function reveal(t) {
  if (t.rv) return; t.rv = true;
  if (Math.random() < .45) { t.k = 'cat'; t.life = t.age + 10; t.path = []; t.prey = null; sfx('meow'); say(L('reveal_cat'), 1, 'cat'); }
  else { const k = pick(['z', 'tk', 'sp', 'dn']); t.k = k; t.hp = t.mx = T[k].hp; sfx('pulse'); say(L('reveal_monster', { monster: T[k].n.toLowerCase() }), 2, k); }
}
export function canTarget(t, P) { if (t.k === 'iv' && G.scan <= 0 && !(P && P.inv && P.inv.gear.nvg)) return false; return true; }
function nearestTo(P, maxD = 1e9) {
  const pos = posOf(P); let best = null, bd = maxD;
  for (const t of G.th) { if (!hostile(t) || t.sl || !canTarget(t, P)) continue; const d = dist(t, pos); if (d < bd) { bd = d; best = t; } }
  return best;
}
function toBase(t) { t.prey = null; t.hunt = false; t.huntRoom = null; t.grab = 0; t.path = route(t.room, 'base'); t.pi = 0; }
function bounce(t) { sfx('bonk'); t.at = false; const k = ROOMS.kitchen; t.x = k.x + rnd(-20, 20); t.y = k.y + rnd(-20, 20); t.room = 'kitchen'; toBase(t); t.fz = 2; say(L('bounce'), 0, 'shield', 'bounce'); }
// Anything that shoots at a monster (hit or miss) breaks its grab and counts as cover fire.
function shotAt(t) { if (t) t.grab = 0; G.lastShot = G.clock; }

// ---------- weapons ----------
// Hit chance: see aim.js. aim = the trooper's facing in map degrees, or null when not tracking.
const shotCtx = (P, w, aim) => ({ pos: posOf(P), room: P.room, w: w || P.wpn, aim: typeof aim === 'number' ? aim : null, scope: !!P.inv.gear.scope });
export function accuracy(P, t, w, aim) { return odds(Object.assign(shotCtx(P, w, aim), { t })).p; }
const RIC = { handgun: ['ric_1', 'ric_2', 'ric_4'], striker: ['ric_1', 'ric_3', 'ric_4'], viper: ['ric_2', 'ric_4'], longshot: ['ric_3', 'ric_1'], laser: ['ric_laser'], cannon: ['ric_cannon'] };
const HIT = { laser: 'hit_laser', cannon: 'hit_cannon' };
export function fireCheck(P) {
  if (!P || P.down || G.phase !== 'play' || G.paused) return 'no';
  const W = WEAPONS[P.wpn]; if (!W || !P.inv.w[P.wpn]) return 'no';
  if (P.cdFire > 0) return 'cool';
  if (P.wpn === 'laser' && P.cdLaser > 0) return 'laser';
  if (W.ammo !== Infinity && (P.inv.ammo[P.wpn] | 0) <= 0) return 'empty';
  return 'ok';
}
export function fireSound(P) { return P.mode === 'freeze' && P.cdFrz <= 0 ? 'fire_freeze' : P.mode === 'bomb' && P.inv.it.bomb > 0 ? 'fire_bomb' : 'fire_' + P.wpn; }
function fire(pid, id, wOverride, aim) {
  const P = G.players[pid]; if (!P) return;
  // A recognized blaster can switch weapons; a loaded freeze/bomb round stays loaded if the new weapon takes it.
  if (wOverride && P.inv.w[wOverride] && WEAPONS[wOverride] && wOverride !== P.wpn) { P.wpn = wOverride; if (P.mode && !WEAPONS[wOverride].modes.includes(P.mode)) P.mode = null; }
  const chk = fireCheck(P);
  if (chk === 'no' || chk === 'cool') return;
  if (chk === 'laser') { sfx('laser_deny', { to: pid }); say(L('laser_wait'), 1, 'laser', 'ld' + pid, pid); return; }
  if (chk === 'empty') { sfx('empty', { to: pid }); say(L('out_of_ammo', { weapon: WEAPONS[P.wpn].n }), 2, 'ammo', 'oa' + pid, pid); P.wpn = 'handgun'; P.mode = null; return; }
  const W = WEAPONS[P.wpn]; P.cdFire = W.cd; G.lastShot = G.clock;
  if (W.ammo !== Infinity) P.inv.ammo[P.wpn]--;
  if (P.wpn === 'laser') {
    const b = P.inv.boost > 0; P.cdLaser = W.recharge * (b ? .5 : 1);
    if (b && --P.inv.boost === 0) say(L('booster_empty'), 1, 'booster', 'bst' + pid, pid, { every: 2000 });
  }
  let mode = P.mode;
  if (mode === 'freeze') { if (P.cdFrz > 0 || !W.modes.includes('freeze')) mode = null; else P.cdFrz = FREEZE_ROUND_CD; }
  if (mode === 'bomb') { if (!(P.inv.it.bomb > 0) || !W.modes.includes('bomb')) mode = null; else P.inv.it.bomb--; }
  P.mode = null;
  sfx(mode === 'freeze' ? 'fire_freeze' : mode === 'bomb' ? 'fire_bomb' : 'fire_' + P.wpn, { from: pid });
  const cands = G.th.filter(x => canTarget(x, P) && (x.id === id || (hostile(x) && !x.sl)));
  const pk = pickTarget(cands, shotCtx(P, P.wpn, aim), id);
  if (!pk) return;
  const t = pk.t, o = pk.o;
  shotAt(t);
  if (mode === 'bomb') {
    if (Math.random() <= Math.min(.98, o.p + .15)) explode(t.x, t.y, t, P, W, false);
    else { const a = Math.random() * Math.PI * 2, r = 130 + Math.random() * 90; explode(t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, null, P, W, true); }
    return;
  }
  if (T[t.k].dodge && t.fz <= 0 && mode !== 'freeze') { sfx('ric_dodge'); say(L('too_fast'), 1, 'sp', 'spfast'); return; }
  if (Math.random() > o.p) {
    sfx(o.walls ? 'ric_wall' : mode === 'freeze' ? 'ric_freeze' : pick(RIC[P.wpn] || RIC.handgun));
    // Say why, now and then: aiming, distance and walls are the lessons.
    const why = o.walls ? 'shot_wall' : !o.inCone ? 'shot_aim' : !o.inRange ? 'shot_far' : null;
    if (why) say(L(why), 1, why === 'shot_wall' ? 'barricade' : why === 'shot_aim' ? 'target' : P.wpn, 'why' + pid, pid, { every: 7000 });
    else if (mode === 'freeze') say(L('freeze_miss'), 0, 'freeze', 'frzmiss' + pid, pid); else if (Math.random() < .15) say(L('miss'), 0, P.wpn, 'miss' + pid, pid);
    return;
  }
  hit(t, P, W, mode);
}
function hit(t, P, W, mode) {
  t.hitT = .25;
  switch (t.k) {
    case 'dn': t.dz = 1.5; sfx('boing'); say(L('dancer_shot'), 1, 'dn', 'dnshot'); return;
    case 'cat': sfx('meow'); say(L('cat_shot'), 1, 'cat', 'catshot'); t.life = t.age + 2; return;
    case 'my': reveal(t); return;
    case 'sl': if (t.sl) { t.sl = false; t.goal = null; toBase(t); sfx('roar'); say(L('sleepy_woke'), 2, 'sl'); } break;
  }
  if (mode === 'freeze') { t.fz = 6; if (T[t.k].armor) t.vul = 8; sfx('hit_freeze'); say(L(T[t.k].armor ? 'frozen_armor' : 'frozen'), 1, 'freeze', 'frzhit'); }
  if (T[t.k].armor && t.vul <= 0) { sfx('hit_armor'); say(L('armor'), 1, 'tk', 'tkarm'); return; }
  if (mode !== 'freeze') sfx(HIT[P.wpn] || 'hit_bullet');
  t.hp -= W.dmg;
  if (t.hp <= 0) defeat(t, P); else sfx('hurt_' + t.k);
}
function explode(cx, cy, t, P, W, far) {
  G.lastBomb = G.clock; sfx(far ? 'explode_far' : 'explode'); say(L(far ? 'bomb_miss' : 'bomb_hit'), 0, 'bomb', 'boom');
  for (const m of G.th.slice()) {
    if (Math.hypot(m.x - cx, m.y - cy) > 170 || !hostile(m)) continue;
    m.grab = 0;
    if (m.k === 'dn' || m.k === 'my') { if (m.k === 'my') reveal(m); continue; }
    if (m.sl) { m.sl = false; m.goal = null; toBase(m); }
    if (T[m.k].armor) m.vul = 8;
    m.hp -= (m === t ? W.dmg : 0) + 4; m.hitT = .3;
    if (m.hp <= 0) defeat(m, P); else sfx('hurt_' + m.k);
  }
}

// ---------- base actions ----------
function shield() { if (G.phase !== 'play' || G.paused || G.cdShield > 0) return; G.cdShield = CDMAX_SHIELD; G.shOn = 12; sfx('shield'); say(L('shield_up'), 1, 'shield', 'shup'); }
function scan(free) {
  if (G.phase !== 'play' || G.paused) return; if (!free && G.scan > 0) return; G.scan = free ? 4 : 8; sfx('scan');
  const my = G.th.filter(t => t.k === 'my' && !t.rv); my.forEach((t, i) => setTimeout(() => { if (G.th.includes(t)) reveal(t); }, 900 + i * 1600));
  if (G.th.some(t => t.k === 'iv')) say(L('scan_iv'), 2, 'iv');
  else if (!my.length && !free) say(L(G.th.length ? 'scan_done' : 'scan_quiet'), 0, 'scan', 'scan');
}
function dance() {
  if (G.phase !== 'play' || G.paused || G.dance > 0) return;
  if (!G.th.some(t => t.k === 'dn')) { sfx('boing'); say(L('dance_none'), 0, 'music', 'nodance'); return; }
  G.dance = 8; sfx('dance'); say(L('dance_start'), 2, 'music');
}
function endDance() { G.dance = 0; G.th.filter(t => t.k === 'dn').forEach(t => defeat(t, null)); }

// Repair only works with cover: no monsters near base, or a shot in the last 3 s, a bomb in the last 5 s, or a frozen monster.
function covered() {
  const near = G.th.filter(t => hostile(t) && !t.sl && (t.at || dist(t, B) < 450));
  if (!near.length) return true;
  return G.clock - G.lastShot <= 3 || G.clock - G.lastBomb <= 5 || near.some(t => t.fz > 0);
}
function noCover() {
  const P = G.players[G.repairBy];
  if (P) say(L('need_cover'), 2, 'wrench', 'nc' + P.id, P.id, { every: 4000 });
  for (const Q of online()) if (!P || Q.id !== P.id) say(L('cover_team', { name: P ? P.name : 'your teammate' }), 2, 'shield', 'ct' + Q.id, Q.id, { every: 8000 });
}

// ---------- items ----------
function useItem(pid, k, target) {
  const P = G.players[pid]; if (!P || G.phase !== 'play' || G.paused || !(P.inv.it[k] > 0)) return;
  switch (k) {
    case 'medkit': {
      const Q = G.players[target]; if (!Q || !(Q.inj > 0)) return;
      if (Q.id === P.id && online().length > 1) { say(L('self_medkit'), 1, 'medkit', 'selfmed' + pid, pid); return; }
      P.inv.it.medkit--; Q.inj = 0; sfx('heal'); say(L('patched', { name: Q.name, medic: P.id === Q.id ? 'medic' : P.name }), 2, 'medkit'); break; }
    case 'freezebomb': P.inv.it.freezebomb--; for (const t of G.th) { if (!hostile(t)) continue; t.fz = 6; t.grab = 0; if (T[t.k].armor) t.vul = 8; } sfx('freeze'); say(L('freeze_bomb'), 2, 'freezebomb'); break;
    case 'drone': P.inv.it.drone--; G.drone = 90; G.droneT = 0; sfx('robot'); say(L('drone_go'), 2, 'drone'); break;
    case 'turret': P.inv.it.turret--; G.turrets.push({ room: P.room, t: 30, cd: 0, owner: pid }); sfx('robot'); say(L('turret_go', { where: where(P.room) }), 2, 'turret'); break;
    case 'booster':
      if (!P.inv.w.laser) { say(L('booster_nolaser'), 1, 'booster', 'bnl' + pid, pid); return; }
      P.inv.it.booster--; P.inv.boost = (P.inv.boost | 0) + BOOST_SHOTS; P.cdLaser = 0; sfx('booster', { to: pid }); say(L('booster_in', { shots: P.inv.boost }), 1, 'booster', null, pid);
      if (P.wpn !== 'laser') { P.wpn = 'laser'; P.mode = null; } break;
    case 'bomb': if (!WEAPONS[P.wpn].modes.includes('bomb')) { say(L('bomb_fit'), 1, 'bomb', 'bfit' + pid, pid); return; } P.mode = P.mode === 'bomb' ? null : 'bomb'; return;
  }
}
function setMode(pid, mode) {
  const P = G.players[pid]; if (!P) return; const W = WEAPONS[P.wpn];
  if (!mode || P.mode === mode) { P.mode = null; return; }
  if (!W.modes.includes(mode)) return;
  if (mode === 'bomb' && !(P.inv.it.bomb > 0)) { say(L('no_bombs'), 1, 'bomb', 'nob' + pid, pid); return; }
  if (mode === 'freeze' && P.cdFrz > 0) { say(L('freeze_charging'), 0, 'freeze', 'frc' + pid, pid); return; }
  P.mode = mode; sfx('equip', { to: pid });
}
function equip(pid, w) { const P = G.players[pid]; if (!P || !WEAPONS[w] || !P.inv.w[w]) return; if (P.wpn !== w) { P.wpn = w; P.mode = null; sfx('equip', { to: pid }); } }

// ---------- rewards ----------
function giveReward(P, r) {
  if (!P) return '';
  switch (r) {
    case 'ammo': { let any = false; for (const w of WEAPON_ORDER) { const W = WEAPONS[w]; if (P.inv.w[w] && W.pack) { P.inv.ammo[w] = Math.min(999, (P.inv.ammo[w] | 0) + W.pack); any = true; } }
      if (!any) P.inv.ammo.striker += 30; return 'ammo'; }
    case 'weapon': { const locked = WEAPON_ORDER.filter(w => !P.inv.w[w]); if (!locked.length) return giveReward(P, 'ammo'); const w = locked[0]; P.inv.w[w] = 1; if (WEAPONS[w].pack) P.inv.ammo[w] = Math.max(P.inv.ammo[w] | 0, WEAPONS[w].ammo); return WEAPONS[w].n; }
    case 'scope': case 'vest': case 'nvg': if (P.inv.gear[r]) return giveReward(P, 'ammo'); P.inv.gear[r] = 1; return GEAR[r].n;
    default: if (ITEMS[r]) { P.inv.it[r] = (P.inv.it[r] | 0) + (r === 'bomb' ? 2 : 1); return ITEMS[r].n; } return '';
  }
}
const rewardWords = got => (got === 'ammo' ? 'a full ammo refill' : 'a ' + got);
export function addStars(n, who) {
  const list = who || online();
  for (const P of list) {
    const before = rankOf(P.stars); P.stars += n; const after = rankOf(P.stars);
    if (after > before) setTimeout(() => { sfx('fanfare'); say(L('promotion', { name: P.name, rank: RANKS[after][0] }), 2, 'star'); }, 2600);
    if (Math.floor(P.stars / 10) > Math.floor((P.stars - n) / 10)) { const got = giveReward(P, 'weapon'); if (got && Object.values(WEAPONS).some(W => W.n === got)) setTimeout(() => say(L('weapon_unlock', { name: P.name, weapon: got }), 2, 'star'), 4500); }
  }
  G.sesStars += n; App.saves && App.saves.autosave();
}

// ---------- missions ----------
function startMission(k) {
  const rooms = MISSION_ROOMS.filter(r => !G.cfg.off.includes(r)); const room = pick(rooms.length ? rooms : ['living']);
  G.mission = { k, room, step: 0, prog: 0, by: null }; sfx('alarm'); say(L('go_' + k, { where: where(room) }), 2, MIS[k].ic);
  if (k === 'sneak') spawn('h', room, { asleep: true, quiet: true });
  const here = online().find(p => p.room === room); if (here) setTimeout(() => arriveCheck(here), 1500);
}
function arriveCheck(P) {
  const m = G.mission; if (!m || P.down) return;
  if (m.step === 0 && P.room === m.room) { m.step = 1; m.prog = 0; m.by = P.id; sfx('pop'); say(L('act_' + m.k), 2, MIS[m.k].bic); }
  else if (m.step === 2 && P.room === 'base') completeMission(P);
}
function missionAct(pid) {
  const m = G.mission, P = G.players[pid]; if (!m || !P || G.phase !== 'play' || G.paused || P.down) return; const d = MIS[m.k];
  if (m.step === 0) { move(pid, m.room); return; }
  if (m.step === 1 && d.act === 'tap') { m.by = pid; m.prog += 1 / d.need; sfx('pop'); if (m.prog >= .999) missionActDone(); }
  else if (m.step === 2) move(pid, 'base');
}
function missionActDone() {
  const m = G.mission; m.step = 2; m.prog = 1; const d = MIS[m.k];
  if (m.k === 'gen') { G.power = true; sfx('power'); }
  if (m.k === 'scout') { if (Math.random() < .5) { spawn('z', m.room, { quiet: true }); sfx('alarm'); say(L('scout_zombie'), 2, 'z'); } else say(L('scout_clear', { where: ROOMS[m.room].n }), 2, 'flag'); }
  else say(L('done_' + m.k), 2, d.ic);
  const P = G.players[m.by]; if (P && P.room === 'base') setTimeout(() => arriveCheck(P), 800);
}
function completeMission(P) {
  const m = G.mission; if (!m) return; G.mission = null;
  const who = G.players[m.by] || P, got = giveReward(who, pick(MIS[m.k].reward));
  sfx('fanfare'); say(got ? L('mission_reward', { reward: rewardWords(got), name: who.name }) : L('mission_done'), 2, 'star');
  addStars(1);
  if (m.k === 'sneak') G.th.filter(t => t.sl && t.room === m.room && t.k === 'h').forEach(removeT);
  if (G.cfg.auto !== 'off' && Math.random() < .5) pend.push({ t: 7, fn: () => { spawn('z', 'frontdoor', { quiet: true }); say(L('followed'), 1, 'z'); } });
}
function abortMission() { if (!G.mission) return; const gen = G.mission.k === 'gen'; G.mission = null; if (gen) G.power = true; say(L('mission_cancel'), 1, 'flag'); }

// ---------- supply drops ----------
const DROP_KINDS = [['ammo', 40], ['medkit', 20], ['bomb', 12], ['freezebomb', 12], ['weapon', 8], ['gear', 8], ['booster', 10]];
function wpickArr(a) { let s = 0; for (const [, w] of a) s += w; let r = Math.random() * s; for (const [k, w] of a) { r -= w; if (r <= 0) return k; } return a[0][0]; }
function supplyDrop(kind) {
  const rooms = MISSION_ROOMS.filter(r => !G.cfg.off.includes(r) && r !== 'master'); const room = pick(rooms.length ? rooms : ['living']);
  G.drops.push({ id: G.nid++, room, kind: kind || wpickArr(DROP_KINDS), t: 75 }); sfx('crate'); sfx('alarm');
  say(L('drop', { where: where(room) }), 2, 'crate');
}
function pickUp(pid, id) {
  const P = G.players[pid], d = G.drops.find(x => x.id === id); if (!P || !d || P.down) return;
  if (P.room !== d.room) move(pid, d.room);
  G.drops.splice(G.drops.indexOf(d), 1);
  const gear = GEAR_ORDER.filter(g => !P.inv.gear[g]);
  const got = giveReward(P, d.kind === 'gear' ? (gear.length ? pick(gear) : 'ammo') : d.kind);
  sfx('pickup'); say(L('drop_got', { name: P.name, reward: got === 'ammo' ? 'Ammo for every weapon' : got }), 2, 'crate');
}

// ---------- movement, contact, injuries ----------
function move(pid, room, keepPos) {
  const P = G.players[pid]; if (!P || !ROOMS[room]) return;
  if (!keepPos) place(P, room); else P.room = room;
  if (P.down && room === 'base' && !(P.rec > 0)) { P.rec = 8; say(L('recovering', { name: P.name }), 1, 'bed'); }
  arriveCheck(P);
}
// A phone with movement tracking reports its position; the room follows from it.
function setPos(pid, x, y) {
  const P = G.players[pid]; if (!P || !isFinite(x) || !isFinite(y)) return;
  x = clamp(x, 0, 900); y = clamp(y, 0, 1350); const r = roomAt(x, y); if (!r) return;
  P.x = x; P.y = y; if (r !== P.room) move(pid, r, true);
}
function injure(P, t) {
  if (!P || P.inj > 0 || P.down) return;
  P.inj = 60; sfx('injury'); say(t ? L('grabbed', { name: P.name, monster: mname(t) }) : L('grabbed', { name: P.name, monster: 'monster' }), 2, 'medkit');
}
const canBeGrabbed = (P, t) => P && P.online && !P.down && !(P.inj > 0) && !t.done.includes(P.id);
function nextPrey(t, from) {
  let best = null, bd = 1e9; for (const P of online()) { if (!canBeGrabbed(P, t)) continue; const d = dist(P, from); if (d < bd) { bd = d; best = P; } } return best;
}
function grabbed(t, P) {
  if (G.cfg.injuries) injure(P, t); else { sfx('injury'); say(L('grabbed_noinj', { name: P.name, monster: mname(t) }), 2, 'alert'); }
  t.done.push(P.id); t.grab = 0; t.inC = false;
  // After grabbing someone, the monster goes after the next trooper, or back to the base.
  const n = nextPrey(t, t);
  if (n) { t.prey = n.id; t.hunt = true; t.huntRoom = null; say(L('grab_next', { name: n.name, monster: mname(t) }), 2, t.k, 'gn' + t.id); }
  else toBase(t);
}
// Monster behaviour for one step: who it is after, where it walks, and the grab timer.
function think(t, dt) {
  if (!GRAB[t.k] || t.sl || t.at) return false;
  let P = t.prey && G.players[t.prey];
  if (P && !canBeGrabbed(P, t)) { P = null; toBase(t); }
  if (!P) {
    // speedies chase the nearest trooper; others only fight troopers who get in their way
    const cand = nextPrey(t, t);
    if (cand && (t.k === 'sp' || dist(cand, t) < CONTACT_R * 1.7)) { P = cand; t.prey = P.id; t.hunt = t.k === 'sp'; t.huntRoom = null; }
  } else if (!t.hunt && dist(P, t) > CONTACT_R * 2.6) { toBase(t); return false; }
  if (!P) return false;
  const d = dist(P, t);
  if (d < CONTACT_R) {
    if (!t.inC) { t.inC = true; sfx('alarm', { to: P.id }); say(L('contact', { name: P.name, monster: Mname(t), where: where(P.room) }), 2, 'alert', 'c' + t.id + P.id, P.id, { vib: [200, 80, 200], every: 6000 });
      for (const Q of online()) if (Q.id !== P.id) say(L('contact_team', { name: P.name, monster: mname(t) }), 1, 'alert', 'ct' + t.id + Q.id, Q.id, { every: 8000 }); }
    if (t.fz <= 0) { t.grab += dt; if (t.grab >= GRAB[t.k]) { grabbed(t, P); return true; } }
    if (d > CONTACT_R * .5 && t.fz <= 0) stepToward(t, P.x, P.y, T[t.k].sp * .5 * dt);
    return true;
  }
  t.inC = false; t.grab = Math.max(0, t.grab - dt);
  if (t.fz > 0) return true;
  // walk: through doorways to the trooper's room, then straight at them
  if (t.huntRoom !== P.room || t.pi >= t.path.length) { t.huntRoom = P.room; t.path = route(t.room, P.room); t.pi = 0; }
  const sp = T[t.k].sp * dt;
  const next = t.path[t.pi];
  if (next) { const n = ROOMS[next]; if (stepToward(t, n.x, n.y, sp)) { t.room = next; t.pi++; } }
  else stepToward(t, P.x, P.y, sp);
  return true;
}
function stepToward(t, x, y, s) { const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy); if (d <= s) { t.x = x; t.y = y; return true; } t.x += dx / d * s; t.y += dy / d * s; return false; }
function injuryTick(dt) {
  for (const P of online()) {
    // grab progress for this trooper's screen
    let g = 0; for (const t of G.th) if (t.prey === P.id && t.inC && GRAB[t.k]) g = Math.max(g, t.grab / GRAB[t.k]); P.grab = g;
    if (P.inj > 0) {
      P.inj -= dt;
      if (P.inj > 0 && Math.abs(P.inj - 20) < dt) say(L('medkit_20', { name: P.name }), 2, 'medkit');
      if (P.inj <= 0) { P.inj = 0; P.down = true; P.mode = null; say(L('out_of_action', { name: P.name }), 2, 'alert');
        if (G.mission && G.mission.by === P.id) abortMission(); if (P.room === 'base') P.rec = 8; }
      continue;
    }
    if (P.down && P.room === 'base' && P.rec > 0) { P.rec -= dt; if (P.rec <= 0) { P.rec = 0; P.down = false; sfx('heal'); say(L('back_in_action', { name: P.name }), 2, 'heart'); } }
  }
}

// ---------- events ----------
function event(e) {
  if (G.phase !== 'play' && !['night', 'finale'].includes(e)) return;
  switch (e) {
    case 'mission': startMission(pick(['supply', 'rescue', 'sensor', 'scout', 'ammo'])); break;
    case 'ammo': startMission('ammo'); break;
    case 'drop': supplyDrop(); break;
    case 'distress': startMission('rescue'); break;
    case 'supply': startMission('supply'); break;
    case 'sensor': startMission('sensor'); break;
    case 'scout': startMission('scout'); break;
    case 'sneak': startMission('sneak'); break;
    case 'power': G.power = false; sfx('static'); startMission('gen'); break;
    case 'interf': G.interf = 6; sfx('static'); spawn('my', pickSpawnRoom()); break;
    case 'barricade': G.shield = Math.max(5, G.shield - 35); sfx('alarm'); say(L('barricade'), 2, 'barricade'); spawn('z', 'frontdoor', { quiet: true }); break;
    case 'injure': { const list = online().filter(p => !p.inj && !p.down); if (list.length) injure(pick(list)); break; }
    case 'robot': G.robot = 8; G.shield = 100; G.shOn = 15; sfx('robot'); say(L('robot'), 2, 'robot'); break;
    case 'finale': if (G.phase !== 'play') return; G.finale = true; G.chopper = 0; sfx('alarm'); say(L('finale'), 2, 'heli');
      spawn('z', 'balcony', { quiet: true }); spawn('z', 'balcony', { quiet: true }); spawn('tk', 'balcony', { quiet: true }); break;
    case 'night': nightWatch(); break;
  }
}
function startEmergency() {
  G.phase = 'emergency'; G.emerg = 0;
  for (const t of G.th) { if (t.at) { t.at = false; const k = ROOMS.kitchen; t.x = k.x + rnd(-25, 25); t.y = k.y + rnd(-25, 25); t.room = 'kitchen'; toBase(t); } t.fz = Math.max(t.fz, 10); }
  sfx('alarm'); say(L('emergency'), 2, 'wrench');
}
function endEmergency() { G.phase = 'play'; G.shield = 65; G.emerg = 0; sfx('shield'); say(L('emergency_done'), 2, 'shield'); }
function victory() { G.phase = 'victory'; G.finale = false; G.chopper = 0; G.th.length = 0; G.mission = null; sfx('fanfare'); say(L('victory'), 2, 'star'); addStars(3); }
function nightWatch() {
  G.phase = 'night'; G.th.length = 0; G.finale = false; G.chopper = 0; G.mission = null; G.power = true; G.paused = false; G.drops.length = 0; G.turrets.length = 0; pend.length = 0;
  for (const P of Object.values(G.players)) { P.inj = 0; P.down = false; P.rec = 0; P.grab = 0; }
  sfx('lullaby'); say(L('night'), 2, 'moon');
}
function startGame() {
  G.phase = 'play'; G.paused = false; G.autoT = 10; G.dropT = rnd(120, 200); G.shield = 100; G.sesStars = 0; sfx('power');
  const n = online().map(p => p.name); say(L('start', { names: n.length > 1 ? n.slice(0, -1).join(' ') + ' and ' + n[n.length - 1] : n[0] || 'Commander' }), 2, 'radar');
}
// Commander: start this round again. Monsters, missions and crates are cleared; stars and inventories stay.
function restartRound() {
  if (G.phase === 'start') return;
  G.th.length = 0; G.mission = null; G.finale = false; G.chopper = 0; G.power = true; G.paused = false; G.drops.length = 0; G.turrets.length = 0; pend.length = 0;
  G.shield = 100; G.shOn = 0; G.cdShield = 0; G.scan = 0; G.dance = 0; G.interf = 0; G.robot = 0; G.drone = 0; G.emerg = 0; G.holds = {}; G.repairBy = null;
  G.autoT = 10; G.dropT = rnd(120, 200); G.sesStars = 0; G.lastShot = -99; G.lastBomb = -99; G.phase = 'play';
  for (const P of Object.values(G.players)) { P.inj = 0; P.down = false; P.rec = 0; P.grab = 0; P.mode = null; P.cdFire = 0; P.cdLaser = 0; P.cdFrz = 0; place(P, 'base'); }
  sfx('power'); say(L('restart'), 2, 'replay');
}
function wakeBase() { G.phase = 'play'; G.autoT = 12; sfx('power'); say(L('wake'), 2, 'radar'); }
function endSession() { G.phase = 'start'; G.th.length = 0; G.mission = null; G.finale = false; G.chopper = 0; G.power = true; G.paused = false; G.drops.length = 0; G.turrets.length = 0; pend.length = 0; }

// ---------- simulation (commander only) ----------
const AUTO = { off: null, calm: { gap: [35, 60], max: 3 }, normal: { gap: [18, 35], max: 5 }, busy: { gap: [9, 18], max: 8 } };
const WEIGHTS = { z: 52, h: 9, tk: 7, sp: 7, iv: 5, sl: 4, dn: 7, my: 6 };
function wpick(w) { let s = 0; for (const k in w) s += w[k]; let r = Math.random() * s; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'z'; }
function autoSpawn(dt) {
  const a = AUTO[G.cfg.auto]; if (!a || G.finale || !G.power) return;
  G.autoT -= dt * (G.mission ? .6 : 1); if (G.autoT > 0) return; G.autoT = rnd(a.gap[0], a.gap[1]);
  if (G.th.filter(hostile).length >= a.max + Math.max(0, online().length - 2)) return; spawn(wpick(WEIGHTS), pickSpawnRoom());
}
function arrived(t, node) {
  if (node === 'base') { t.at = true; sfx('alarm'); return; }
  if (t.goal && node === t.goal) { if (t.k === 'sl') { t.sl = true; say(L('sleepy_asleep', { where: where(node) }), 2, 'sl'); } t.goal = null; t.path = []; t.pi = 0; return; }
  if (node === 'hall' && !t.hw && hostile(t)) { t.hw = 1; say(L('hall_contact'), 1, 'alert', 'hall'); }
}
function updThreat(t, dt) {
  t.age += dt; if (t.fz > 0) t.fz -= dt; if (t.vul > 0) t.vul -= dt; if (t.dz > 0) t.dz -= dt; if (t.hitT > 0) t.hitT -= dt;
  if (t.k === 'cat' && t.age > (t.life || 22)) { removeT(t); return; }
  if (t.k === 'my' && !t.rv && dist(t, B) < 330) reveal(t);
  if (!G.power || t.sl || t.age < 2.5) return;
  if (t.k === 'dn' && G.dance > 0) return;
  if (think(t, dt)) return;
  if (t.fz > 0) return;
  if (t.at) {
    if (G.shOn > 0) { bounce(t); return; }
    if (T[t.k].dmg > 0) { G.shield = Math.max(0, G.shield - T[t.k].dmg * dt); say(L('attack'), 2, 'alert', 'attack'); if (Math.random() < dt * 1.4) sfx('basehit'); }
    return;
  }
  const next = t.path[t.pi]; if (!next) { if (t.room === 'base') { t.at = true; return; } if (!t.goal && !t.sl && t.k !== 'cat') toBase(t); return; }
  const tg = ROOMS[next], sp = T[t.k].sp * (G.mission ? .85 : 1);
  if (stepToward(t, tg.x, tg.y, sp * dt)) { t.room = next; t.pi++; arrived(t, next); }
}
function turretTick(dt) {
  for (const tu of G.turrets.slice()) {
    tu.t -= dt; if (tu.t <= 0) { G.turrets.splice(G.turrets.indexOf(tu), 1); say(L('turret_off'), 0, 'turret'); continue; }
    tu.cd -= dt; if (tu.cd > 0) continue; tu.cd = .8;
    const pos = ROOMS[tu.room]; let best = null, bd = 420;
    for (const t of G.th) { if (!hostile(t) || t.sl || t.k === 'dn' || !canTarget(t, null)) continue; const d = dist(t, pos); if (d < bd) { bd = d; best = t; } }
    if (!best) continue; sfx('turret'); shotAt(best);
    if (Math.random() < .7 && !(T[best.k].armor && best.vul <= 0) && !(T[best.k].dodge && best.fz <= 0)) { if (best.k === 'my') { reveal(best); continue; } best.hp -= 1; best.hitT = .2; if (best.hp <= 0) defeat(best, G.players[tu.owner]); }
  }
}
export function tick(dt) {
  G.cdShield = Math.max(0, G.cdShield - dt);
  for (const k in G.holds) G.holds[k] = Math.max(0, G.holds[k] - dt);
  for (const P of Object.values(G.players)) { P.cdFire = Math.max(0, P.cdFire - dt); P.cdLaser = Math.max(0, P.cdLaser - dt); P.cdFrz = Math.max(0, P.cdFrz - dt); }
  if (G.phase === 'emergency') {
    G.clock += dt; for (const t of G.th) if (t.fz > 0) t.fz -= dt;
    G.cov = covered();
    if (G.holds.emerg > 0) { if (G.cov) { G.emerg += dt / 4; if (G.emerg >= 1) endEmergency(); } else noCover(); }
    return;
  }
  if (G.phase !== 'play' || G.paused) return;
  G.clock += dt;
  G.shOn = Math.max(0, G.shOn - dt); G.scan = Math.max(0, G.scan - dt); G.interf = Math.max(0, G.interf - dt); G.robot = Math.max(0, G.robot - dt);
  for (let i = pend.length - 1; i >= 0; i--) { pend[i].t -= dt; if (pend[i].t <= 0) { const p = pend.splice(i, 1)[0]; try { p.fn(); } catch (e) { console.error(e); } } }
  if (G.dance > 0) { G.dance -= dt; if (G.dance <= 0) endDance(); }
  G.cov = covered();
  if (G.holds.repair > 0 && G.shield < 100) { if (!G.th.some(t => t.at) && G.cov) G.shield = Math.min(100, G.shield + 9 * dt); else noCover(); }
  const m = G.mission; if (m && m.step === 1 && MIS[m.k].act === 'hold' && G.holds.gen > 0) { m.prog += dt / 3; if (m.prog >= 1) missionActDone(); }
  if (G.drone > 0) { G.drone -= dt; G.droneT -= dt; if (G.droneT <= 0) { G.droneT = 15; scan(true); } if (G.drone <= 0) say(L('drone_home'), 0, 'drone'); }
  for (const d of G.drops.slice()) { d.t -= dt; if (d.t <= 0) { G.drops.splice(G.drops.indexOf(d), 1); say(L('drop_lost', { where: where(d.room) }), 1, 'crate'); } }
  if (G.cfg.drops && !G.finale) { G.dropT -= dt; if (G.dropT <= 0) { G.dropT = rnd(150, 260); if (G.drops.length < 2) supplyDrop(); } }
  for (const t of G.th.slice()) updThreat(t, dt);
  turretTick(dt);
  injuryTick(dt);
  if (G.shield <= 0 && G.phase === 'play') { startEmergency(); return; }
  autoSpawn(dt);
  if (G.finale) {
    if (!G.th.some(hostile) && G.chopper === 0) { G.chopper = .001; sfx('chopper'); say(L('finale_clear'), 2, 'heli'); }
    if (G.chopper > 0) { G.chopper += dt / 7; if (G.chopper >= 1) victory(); }
  }
}

// Several phones can hear the same blaster. Shots heard within 130 ms of each other are treated
// as one sound and only the phone that heard it loudest (the shooter's own phone) fires.
let micGroup = null;
const aimOf = a => (typeof a.h === 'number' && isFinite(a.h) ? ((a.h % 360) + 360) % 360 : null);
function micShot(pid, a) {
  if (!micGroup) { micGroup = []; setTimeout(() => { const g = micGroup; micGroup = null; const best = g.reduce((x, y) => (y.lv > x.lv ? y : x)); fire(best.pid, best.a.id, best.a.w, aimOf(best.a)); }, 130); }
  micGroup.push({ pid, a, lv: +a.mic || 0 });
}

// ---------- actions (validated; may come from any phone) ----------
function schedule(d, fn) { d = +d || 0; if (d <= 0) fn(); else pend.push({ t: Math.min(d, 60), fn }); }
export function apply(a, pid) {
  if (!a || typeof a !== 'object') return;
  const P = G.players[pid];
  switch (a.a) {
    case 'fire': if (typeof a.mic === 'number' && online().length > 1) micShot(pid, a); else fire(pid, a.id, a.w, aimOf(a)); break;
    case 'mode': setMode(pid, a.m); break;
    case 'equip': equip(pid, a.w); break;
    case 'item': useItem(pid, a.k, a.t); break;
    case 'shield': shield(); break;
    case 'scan': scan(); break;
    case 'dance': dance(); break;
    case 'hold': if (['repair', 'gen', 'emerg'].includes(a.w)) { G.holds[a.w] = .6; if (a.w !== 'gen') G.repairBy = pid; } break;
    case 'move': if (ROOMS[a.room]) move(a.who && G.players[a.who] ? a.who : pid, a.room); break;
    case 'pos': setPos(pid, +a.x, +a.y); break;
    case 'checkpoint': if (ROOMS[a.room] && P) { move(pid, a.room); sfx('pickup', { to: pid }); say(L('checkpoint', { where: ROOMS[a.room].n }), 1, 'pin', 'cp' + pid, pid, { every: 2000 }); } break;
    case 'allbase': for (const Q of online()) move(Q.id, 'base'); say(L('all_base'), 2, 'home'); break;
    case 'step': missionAct(pid); break;
    case 'pickup': pickUp(pid, a.id); break;
    case 'ptt': if (P) P.talk = !!a.on; break;
    case 'call': if (P && CALLS[a.i]) { sfx('call'); say(L('call_' + a.i, { name: P.name }), 2, CALLS[a.i][0]); } break;
    case 'spawn': if (T[a.k] && G.phase === 'play') schedule(a.d, () => spawn(a.k, a.r)); break;
    case 'event': schedule(a.d, () => event(a.e)); break;
    case 'say': if (typeof a.t === 'string' && a.t.trim()) say(a.t.trim().slice(0, 220), 3, 'radio'); break;
    case 'repeat': fxOut({ say: G.last, pri: 3, ic: G.lastIc }); break;
    case 'kill': { const t = G.th.find(x => x.id === a.id) || nearestTo(P || { room: 'base', inv: { gear: {} } }); if (t) defeat(t, null); break; }
    case 'clear': G.th.length = 0; sfx('die_z'); say(L('radar_clear'), 1, 'radar'); break;
    case 'abort': abortMission(); break;
    case 'pause': if (G.phase === 'play' || G.phase === 'emergency') { G.paused = !!a.v; say(L(G.paused ? 'pause' : 'resume'), 2, G.paused ? 'pause' : 'radar'); } break;
    case 'start': if (G.phase === 'start') startGame(); break;
    case 'wake': if (G.phase === 'night' || G.phase === 'victory') wakeBase(); break;
    case 'night': nightWatch(); break;
    case 'restart': restartRound(); break;
    case 'end': endSession(); break;
    case 'set': setCfg(a.k, a.v); break;
    case 'line': if (typeof a.k === 'string' && LINES[a.k]) { if (a.reset) Lines.reset(a.k); else Lines.set(a.k, String(a.v || '')); App.saves && App.saves.autosave(); } break;
    // commander tools
    case 'heal': { const Q = G.players[a.who]; if (Q) { Q.inj = 0; Q.down = false; Q.rec = 0; sfx('heal'); } break; }
    case 'hurt': { const Q = G.players[a.who]; if (Q && G.phase === 'play') injure(Q); break; }
    case 'grant': grant(a); break;
  }
}
function grant(a) {
  const Q = G.players[a.who]; if (!Q) return; const n = clamp(a.n | 0, -99, 99);
  if (a.kind === 'w' && WEAPONS[a.k] && a.k !== 'handgun') { Q.inv.w[a.k] = a.on ? 1 : 0; if (a.on && WEAPONS[a.k].pack) Q.inv.ammo[a.k] = Math.max(Q.inv.ammo[a.k] | 0, WEAPONS[a.k].ammo); if (!a.on && Q.wpn === a.k) Q.wpn = 'handgun'; }
  else if (a.kind === 'ammo' && a.k in Q.inv.ammo) Q.inv.ammo[a.k] = clamp((Q.inv.ammo[a.k] | 0) + n, 0, 999);
  else if (a.kind === 'it' && ITEMS[a.k]) Q.inv.it[a.k] = clamp((Q.inv.it[a.k] | 0) + n, 0, 99);
  else if (a.kind === 'gear' && GEAR[a.k]) { if (a.on) Q.inv.gear[a.k] = 1; else delete Q.inv.gear[a.k]; }
  App.saves && App.saves.autosave();
}
function setCfg(k, v) {
  const c = G.cfg;
  if (k === 'auto' && AUTO.hasOwnProperty(v)) { c.auto = v; G.autoT = Math.min(G.autoT, 8); }
  else if (k === 'voice' && ['all', 'important', 'off'].includes(v)) c.voice = v;
  else if (k === 'off' && Array.isArray(v)) c.off = v.filter(x => MISSION_ROOMS.includes(x));
  else if (k === 'injuries') c.injuries = !!v;
  else if (k === 'drops') c.drops = !!v;
  App.saves && App.saves.saveCfg();
}

// ---------- network encoding ----------
export function enc() {
  return {
    ph: G.phase, pa: G.paused ? 1 : 0, sh: Math.round(G.shield), so: +G.shOn.toFixed(1), cs: +G.cdShield.toFixed(1), sc: +G.scan.toFixed(1), pw: G.power ? 1 : 0,
    dn: +G.dance.toFixed(1), fi: G.finale ? 1 : 0, ch: +G.chopper.toFixed(2), em: +G.emerg.toFixed(2), it: +G.interf.toFixed(1), rb: +G.robot.toFixed(1), dr: +G.drone.toFixed(0),
    ss: G.sesStars, cfg: G.cfg, hid: G.hostId, la: G.last.slice(0, 240), li: G.lastIc, cov: G.cov ? 1 : 0,
    m: G.mission ? { k: G.mission.k, room: G.mission.room, step: G.mission.step, prog: +G.mission.prog.toFixed(2), by: G.mission.by } : null,
    drops: G.drops.map(d => ({ id: d.id, room: d.room, kind: d.kind, t: Math.ceil(d.t) })),
    tur: G.turrets.map(t => ({ room: t.room, t: Math.ceil(t.t) })),
    pl: Object.values(G.players).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, room: p.room, x: Math.round(p.x), y: Math.round(p.y), inj: Math.ceil(p.inj), down: p.down ? 1 : 0, rec: Math.ceil(p.rec),
      stars: p.stars, kills: p.kills, inv: p.inv, wpn: p.wpn, mode: p.mode, cl: +p.cdLaser.toFixed(1), cf: +p.cdFrz.toFixed(1), talk: p.talk ? 1 : 0, on: p.online ? 1 : 0, peer: p.peer, g: +(p.grab || 0).toFixed(2) })),
    th: G.th.slice(0, 40).map(t => [t.id, t.k, Math.round(t.x), Math.round(t.y), t.hp, t.mx, (t.fz > 0 ? 1 : 0) | (t.vul > 0 ? 2 : 0) | (t.sl ? 4 : 0) | (t.at ? 8 : 0) | (!t.rv ? 32 : 0) | (t.dz > 0 ? 64 : 0) | (t.hitT > 0 ? 128 : 0) | (t.inC ? 256 : 0)])
  };
}
const num = (v, f = 0) => typeof v === 'number' && isFinite(v) ? v : f;
export function dec(d) {
  if (!d || typeof d !== 'object') return;
  if (['start', 'play', 'emergency', 'victory', 'night'].includes(d.ph)) G.phase = d.ph;
  G.paused = !!d.pa; G.shield = num(d.sh, 100); G.shOn = num(d.so); G.cdShield = num(d.cs); G.scan = num(d.sc); G.power = !!d.pw; G.dance = num(d.dn); G.cov = d.cov !== 0;
  G.hostId = typeof d.hid === 'string' ? d.hid : G.hostId;
  G.finale = !!d.fi; G.chopper = num(d.ch); G.emerg = num(d.em); G.interf = num(d.it); G.robot = num(d.rb); G.drone = num(d.dr); G.sesStars = num(d.ss);
  if (d.cfg && typeof d.cfg === 'object') { G.cfg.auto = AUTO.hasOwnProperty(d.cfg.auto) ? d.cfg.auto : G.cfg.auto; G.cfg.voice = ['all', 'important', 'off'].includes(d.cfg.voice) ? d.cfg.voice : G.cfg.voice;
    G.cfg.off = Array.isArray(d.cfg.off) ? d.cfg.off.filter(x => MISSION_ROOMS.includes(x)) : G.cfg.off; G.cfg.injuries = !!d.cfg.injuries; G.cfg.drops = !!d.cfg.drops; }
  if (typeof d.la === 'string' && d.la !== G.last) { G.last = d.la; G.lastIc = typeof d.li === 'string' ? d.li : 'radio'; App.ui && App.ui.ticker(G.last, G.lastIc); }
  G.mission = d.m && MIS[d.m.k] && ROOMS[d.m.room] ? { k: d.m.k, room: d.m.room, step: num(d.m.step), prog: num(d.m.prog), by: d.m.by } : null;
  G.drops = Array.isArray(d.drops) ? d.drops.filter(x => x && ROOMS[x.room]).map(x => ({ id: num(x.id), room: x.room, kind: String(x.kind), t: num(x.t) })) : [];
  G.turrets = Array.isArray(d.tur) ? d.tur.filter(x => x && ROOMS[x.room]).map(x => ({ room: x.room, t: num(x.t) })) : [];
  if (Array.isArray(d.pl)) {
    const seen = new Set();
    for (const p of d.pl) {
      if (!p || typeof p.id !== 'string') continue; seen.add(p.id);
      const Q = G.players[p.id] || (G.players[p.id] = { id: p.id });
      const room = ROOMS[p.room] ? p.room : 'base';
      Object.assign(Q, { name: String(p.name || '').slice(0, 16), color: num(p.color), av: num(p.av), room, x: num(p.x, ROOMS[room].x), y: num(p.y, ROOMS[room].y), inj: num(p.inj), down: !!p.down, rec: num(p.rec),
        stars: num(p.stars), kills: num(p.kills), inv: sanitizeInv(p.inv), wpn: WEAPONS[p.wpn] ? p.wpn : 'handgun', mode: ['freeze', 'bomb'].includes(p.mode) ? p.mode : null,
        cdLaser: num(p.cl), cdFrz: num(p.cf), cdFire: Q.cdFire || 0, talk: !!p.talk, online: !!p.on, peer: typeof p.peer === 'string' ? p.peer : null, grab: num(p.g) });
    }
    for (const id of Object.keys(G.players)) if (!seen.has(id)) delete G.players[id];
  }
  if (Array.isArray(d.th)) {
    const seen = new Set();
    for (const r of d.th) {
      if (!Array.isArray(r) || !T[r[1]]) continue; const [id, k, x, y, hp, mx, f] = r; seen.add(id);
      let t = G.th.find(q => q.id === id); if (!t) { t = { id, k, x: num(x), y: num(y) }; G.th.push(t); }
      t.k = k; t.tx = num(x); t.ty = num(y); t.hp = num(hp, 1); t.mx = num(mx, 1); t.fz = f & 1 ? 1 : 0; t.vul = f & 2 ? 1 : 0; t.sl = !!(f & 4); t.at = !!(f & 8); t.rv = !(f & 32); t.dz = f & 64 ? 1 : 0; t.hitT = f & 128 ? .2 : 0; t.inC = !!(f & 256);
    }
    for (let i = G.th.length - 1; i >= 0; i--) if (!seen.has(G.th[i].id)) G.th.splice(i, 1);
  }
}
export function lerp(dt) {
  const k = Math.min(1, dt * 7); for (const t of G.th) { if (t.tx == null) continue; t.x += (t.tx - t.x) * k; t.y += (t.ty - t.y) * k; }
  for (const P of Object.values(G.players)) P.cdFire = Math.max(0, (P.cdFire || 0) - dt);
}
App.game = { G, apply, tick, enc, dec, lerp, addPlayer, dropPlayer, fireCheck, fireSound, accuracy, canTarget, say, sfx, L };
