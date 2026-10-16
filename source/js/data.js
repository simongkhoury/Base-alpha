// Static game data: the apartment, monsters, weapons, items, missions, ranks.

// ---- The apartment (from Simon's sketch, 900 x 1350 units) ----
export const ROOMS = {
  balcony: { n: 'Balcony', say: 'the balcony', x: 430, y: 215 },
  frontdoor: { n: 'Front Door', say: 'the front door', x: 600, y: 845, out: [770, 845] },
  living: { n: 'Living Room', say: 'the living room', x: 470, y: 470 },
  couch: { n: 'Couch', say: 'the couch', x: 655, y: 525 },
  nook1: { n: 'Nook 1', say: 'nook one', x: 190, y: 460 },
  nook2: { n: 'Nook 2', say: 'nook two', x: 715, y: 385 },
  dining: { n: 'Dining Table', say: 'the dining table', x: 335, y: 595 },
  kitchen: { n: 'Kitchen', say: 'the kitchen', x: 330, y: 895 },
  hall: { n: 'Hall', say: 'the hall', x: 470, y: 1072 },
  bath: { n: 'Bathroom', say: 'the bathroom', x: 632, y: 1065 },
  master: { n: 'Master Bedroom', say: 'the master bedroom', x: 275, y: 1175 },
  toy: { n: 'Toy Room', say: 'the toy room', x: 448, y: 1192 },
  base: { n: 'Base Alpha', say: 'Base Alpha', x: 552, y: 1172 }
};
export const B = ROOMS.base;
const EDGES = [['balcony', 'living'], ['living', 'nook1'], ['living', 'nook2'], ['living', 'couch'], ['living', 'dining'], ['nook1', 'dining'], ['dining', 'kitchen'], ['kitchen', 'frontdoor'], ['kitchen', 'hall'], ['hall', 'bath'], ['hall', 'master'], ['hall', 'toy'], ['hall', 'base']];
const ADJ = {}; for (const k in ROOMS) ADJ[k] = []; for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
export function route(a, b) {
  if (a === b || !ROOMS[a] || !ROOMS[b]) return [];
  const prev = { [a]: null }, q = [a];
  while (q.length) { const n = q.shift(); if (n === b) break; for (const m of ADJ[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  if (!(b in prev)) return [];
  const out = []; for (let n = b; n !== a; n = prev[n]) out.unshift(n); return out;
}
// Room outlines for the map and for tap-to-locate. Spots (couch, nooks, table) sit inside the living room.
export const SHAPES = {
  balcony: [[20, 170], [740, 18], [812, 322], [110, 405], [60, 440]],
  living: [[110, 410], [812, 322], [872, 652], [578, 656], [578, 800], [205, 800]],
  kitchen: [[205, 800], [578, 800], [585, 1020], [205, 1000]],
  hall: [[350, 1035], [600, 1025], [600, 1110], [350, 1125]],
  bath: [[600, 1015], [666, 1015], [666, 1116], [600, 1110]],
  master: [[180, 1000], [350, 1050], [350, 1130], [372, 1322], [195, 1325]],
  toy: [[396, 1130], [500, 1125], [500, 1255], [400, 1258]],
  base: [[500, 1110], [600, 1110], [598, 1226], [500, 1230]]
};
export const SPOTS = ['couch', 'nook1', 'nook2', 'dining'];
export const MISSION_ROOMS = ['balcony', 'living', 'couch', 'nook1', 'nook2', 'dining', 'kitchen', 'hall', 'bath', 'toy', 'master'];
export const SPAWN_ROOMS = ['balcony', 'frontdoor', 'living', 'couch', 'nook1', 'nook2', 'dining', 'kitchen', 'hall', 'bath', 'toy', 'master'];
export const PLACE_ROOMS = ['base', 'hall', 'toy', 'bath', 'master', 'kitchen', 'frontdoor', 'dining', 'living', 'couch', 'nook1', 'nook2', 'balcony'];

// ---- Monsters ----
// hp is in "damage points"; the handgun does 1.
export const T = {
  z: { n: 'Zombie', hp: 2, sp: 22, dmg: 4 },
  h: { n: 'Horde', hp: 10, sp: 15, dmg: 9 },
  tk: { n: 'Tank mutant', hp: 8, sp: 11, dmg: 7, mut: 1, armor: 1 },
  sp: { n: 'Speedy mutant', hp: 2, sp: 52, dmg: 6, mut: 1, dodge: 1 },
  iv: { n: 'Invisible mutant', hp: 4, sp: 18, dmg: 5, mut: 1 },
  sl: { n: 'Sleepy giant', hp: 12, sp: 12, dmg: 8, mut: 1 },
  dn: { n: 'Dancing mutant', hp: 1, sp: 19, dmg: 4, mut: 1 },
  my: { n: 'Mystery signal', hp: 2, sp: 18, dmg: 3 },
  cat: { n: 'Friendly cat', hp: 1, sp: 30, dmg: 0, friendly: 1 }
};
export const MONSTER_MENU = [['z', 'Zombie'], ['h', 'Horde'], ['tk', 'Tank'], ['sp', 'Speedy'], ['iv', 'Invisible'], ['sl', 'Sleepy giant'], ['dn', 'Dancer'], ['my', 'Mystery']];

// ---- Weapons ----
// acc: hit chance up close. fall: chance lost per 100 units of distance. Never below 35%.
export const MIN_ACC = 0.35;
export const WEAPONS = {
  handgun: { n: 'Handgun', short: 'PISTOL', dmg: 1, acc: 0.86, fall: 0.10, ammo: Infinity, cd: 0.35, modes: [], pack: 0, d: 'Weak but never runs out.' },
  striker: { n: 'Striker AR', short: 'STRIKER', dmg: 2, acc: 0.88, fall: 0.07, ammo: 45, cd: 0.2, modes: ['freeze', 'bomb'], pack: 30, d: 'Balanced rifle. Freeze and bomb rounds.' },
  viper: { n: 'Viper AR', short: 'VIPER', dmg: 1, acc: 0.84, fall: 0.12, ammo: 60, cd: 0.1, modes: [], pack: 45, d: 'Super fast. Best up close.' },
  longshot: { n: 'Longshot AR', short: 'LONGSHOT', dmg: 4, acc: 0.93, fall: 0.03, ammo: 16, cd: 0.8, modes: ['freeze'], pack: 10, d: 'Slow, accurate from far away, hits hard.' },
  laser: { n: 'Laser Rifle', short: 'LASER', dmg: 4, acc: 0.95, fall: 0.04, ammo: Infinity, cd: 0.2, recharge: 3, modes: ['freeze'], pack: 0, d: 'Never runs out. Needs 3 seconds to recharge.' },
  cannon: { n: 'Heavy Cannon', short: 'CANNON', dmg: 6, acc: 0.76, fall: 0.08, ammo: 8, cd: 1.2, modes: ['bomb', 'freeze'], splash: 1, pack: 4, d: 'Huge damage. Bomb rounds hit everything nearby.' }
};
export const WEAPON_ORDER = ['handgun', 'striker', 'viper', 'longshot', 'laser', 'cannon'];
export const FREEZE_ROUND_CD = 10;

// ---- Items and gear ----
export const ITEMS = {
  medkit: { n: 'Medkit', d: 'Heals a hurt teammate.' },
  freezebomb: { n: 'Freeze bomb', d: 'Freezes every monster for 6 seconds.' },
  bomb: { n: 'Bomb rounds', d: 'Load into the Striker or Cannon. Hits everything nearby.' },
  drone: { n: 'Scout drone', d: 'Scans the apartment by itself for 90 seconds.' },
  turret: { n: 'Mini turret', d: 'Shoots monsters near you for 30 seconds.' }
};
export const ITEM_ORDER = ['medkit', 'freezebomb', 'bomb', 'drone', 'turret'];
export const GEAR = {
  scope: { n: 'Scope', d: '+12% accuracy with every weapon.' },
  vest: { n: 'Armor vest', d: 'Half the chance of getting hurt.' },
  nvg: { n: 'Night-vision goggles', d: 'See invisible mutants without scanning.' }
};
export const GEAR_ORDER = ['scope', 'vest', 'nvg'];
export function starterInv() {
  return {
    w: { handgun: 1, striker: 1 },
    ammo: { striker: 45, viper: 0, longshot: 0, cannon: 0 },
    it: { medkit: 1, freezebomb: 1, bomb: 0, drone: 0, turret: 0 },
    gear: {}
  };
}

// ---- Ranks ----
export const RANKS = [['Recruit', 0], ['Private', 3], ['Corporal', 8], ['Sergeant', 15], ['Lieutenant', 25], ['Captain', 40], ['Major', 60], ['Commander', 85]];
export const rankOf = s => { let i = 0; RANKS.forEach((r, j) => { if (s >= r[1]) i = j; }); return i; };

// ---- Missions ----
// act: 'tap' (press need times) or 'hold' (hold for 3 s). reward: what the crate gives.
export const MIS = {
  supply: { ic: 'box', t: 'SUPPLY RUN', go: r => `Supply run! Get a power cell from ${r}. Any toy can be the power cell.`, act: 'tap', need: 1, btn: 'GRAB', bic: 'hand', actSay: 'Grab the power cell!', done: 'Power cell secured! Hurry back to Base Alpha!', reward: ['bomb', 'freezebomb', 'turret'] },
  ammo: { ic: 'ammo', t: 'AMMO RUN', go: r => `Ammo run! There's an ammo crate in ${r}. Go get it!`, act: 'tap', need: 1, btn: 'PICK UP', bic: 'ammo', actSay: 'Pick up the ammo crate!', done: 'Ammo crate secured! Back to base!', reward: ['ammo'] },
  rescue: { ic: 'teddy', t: 'RESCUE', go: r => `Distress call! A survivor is trapped in ${r}. Bring them back to base!`, act: 'tap', need: 1, btn: 'RESCUE', bic: 'teddy', actSay: 'Find the survivor and pick them up gently.', done: 'Survivor rescued! Bring them home to Base Alpha!', reward: ['medkit'] },
  gen: { ic: 'bolt', t: 'GENERATOR', go: r => `Power failure! The radar is down. Go restart the generator in ${r}!`, act: 'hold', need: 1, btn: 'HOLD', bic: 'bolt', actSay: 'Hold the button to restart the generator!', done: 'Generator running! Radar back online. Return to base!', reward: ['drone'] },
  sensor: { ic: 'antenna', t: 'FIX SENSOR', go: r => `A radar sensor is broken in ${r}. Go fix it, Commander!`, act: 'tap', need: 5, btn: 'FIX', bic: 'wrench', actSay: 'Tap fix five times to repair the sensor.', done: 'Sensor fixed! Return to base!', reward: ['scope', 'drone'] },
  scout: { ic: 'binos', t: 'SCOUT', go: r => `Scout mission. Check ${r} for monsters.`, act: 'tap', need: 1, btn: 'LOOK', bic: 'binos', actSay: 'Look around carefully, then press the button.', reward: ['ammo'] },
  sneak: { ic: 'feet', t: 'SNEAK', go: r => `A horde is sleeping in ${r}. Tiptoe through without waking them!`, act: 'tap', need: 1, btn: 'MADE IT', bic: 'feet', actSay: 'Shh. Tiptoe. Quiet as a mouse.', done: 'You did it! They are still snoring. Back to base, quietly.', reward: ['nvg', 'vest'] }
};

export const EVENTS = [
  ['mission', 'flag', 'New mission', 'Random mission in an allowed room'],
  ['ammo', 'ammo', 'Ammo run', 'Fetch an ammo crate'],
  ['drop', 'crate', 'Timed supply drop', 'Crate appears in a room. 75 seconds to grab it'],
  ['distress', 'teddy', 'Distress call', 'Rescue a stuffed-animal survivor'],
  ['supply', 'box', 'Supply run', 'Fetch a power cell (any toy)'],
  ['power', 'bolt', 'Power failure', 'Radar goes dark until the generator restarts'],
  ['interf', 'static', 'Interference', 'Mystery signal: a mutant or a cat'],
  ['sneak', 'feet', 'Sleeping horde', 'Tiptoe mission past sleepers'],
  ['barricade', 'barricade', 'Barricade damaged', 'Shield drops 35%. Hold repair'],
  ['injure', 'medkit', 'Someone gets hurt', 'Random player needs a medkit'],
  ['sensor', 'antenna', 'Broken sensor', 'Tap-to-fix mission'],
  ['scout', 'binos', 'Scout', 'Check a room. Might find a zombie'],
  ['robot', 'robot', 'Friendly robot', 'Full shield plus a bonus bubble'],
  ['finale', 'heli', 'Chopper finale', 'Clear the balcony. Chopper lands. +3 stars'],
  ['night', 'moon', 'Night watch', 'Monsters retreat. Calm goodnight']
];

export const LINES = ['Commander {n}, report to base!', 'Movement detected. Stay alert.', 'Great shooting, Commander {n}!', 'Something is coming. Get ready.', 'Take cover behind the couch!', 'Teammate needs backup in the kitchen!', 'Shh. Listen. Did you hear that?', 'Water break! Hydrate, troopers.', 'You are the bravest commander in the whole base!', 'Five minutes until lights out, Commander.', 'Commander {n}, salute!', 'Check your ammo, soldier!'];

// Radio calls players send each other (icon, spoken text with {n} = sender name).
export const CALLS = [
  ['alert', 'HELP!', '{n} needs help!'],
  ['feet', 'COMING', '{n} is coming!'],
  ['check', 'CLEAR', '{n} says: all clear here.'],
  ['ammo', 'AMMO', '{n} needs ammo!'],
  ['medkit', 'MEDIC', '{n} needs a medic!'],
  ['shield', 'COVER ME', '{n} says: cover me!']
];

export const COLORS = ['#ffc83a', '#5ee6ff', '#ff70b8', '#8dfc9e', '#ff8a3d', '#b98cff'];
export const AVATARS = ['helmet', 'beret', 'cap', 'goggles', 'bandana', 'astro'];
