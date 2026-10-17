// Everything the radio operator says, editable by the commander.
// Each line can have several versions; the game picks one at random.
// Commas are kept out on purpose: the phone's voice pauses at every comma, which kills the excitement.
import { App, load, store } from './core.js';

export const LINE_CATS = [
  ['monsters', 'Monsters'], ['combat', 'Combat'], ['contact', 'Contact and injuries'], ['base', 'Base and repair'],
  ['missions', 'Missions'], ['items', 'Items and crates'], ['game', 'Game and ranks'], ['calls', 'Radio calls']
];

// key: [category, description, default versions, placeholders]
export const LINES = {
  // ----- monsters -----
  spawn_z: ['monsters', 'Zombies appear', ['{count} near {where}.', '{count} coming from {where}!'], '{count} {where}'],
  spawn_h: ['monsters', 'A horde appears', ['Horde detected at {where}! Get ready troopers!'], '{where}'],
  spawn_tk: ['monsters', 'A tank mutant appears', ['Heavy tank mutant at {where}! It is armored. Hit it with a freeze round or a bomb round first!'], '{where}'],
  spawn_sp: ['monsters', 'A speedy mutant appears', ['Speedy mutant at {where}! Too fast to hit. Freeze it first!'], '{where}'],
  spawn_iv: ['monsters', 'An invisible mutant appears', ['Something strange near {where}. Use the scanner to find it.'], '{where}'],
  spawn_sl: ['monsters', 'A sleepy giant appears', ['A sleepy giant is wandering in from {where}. If it falls asleep do not wake it up!'], '{where}'],
  spawn_dn: ['monsters', 'A dancing mutant appears', ['Uh oh! A dancing mutant from {where}! Only a dance party can stop it!'], '{where}'],
  spawn_my: ['monsters', 'A mystery signal appears', ['Unknown signal near {where}. Scan it to find out what it is.'], '{where}'],
  reveal_cat: ['monsters', 'Mystery signal was a cat', ["It's just a friendly cat! Phew."], ''],
  reveal_monster: ['monsters', 'Mystery signal was a monster', ['The signal is a {monster}!'], '{monster}'],
  sleepy_asleep: ['monsters', 'Sleepy giant falls asleep', ['The sleepy giant fell asleep in {where}. Shh! Do not wake it up!'], '{where}'],
  sleepy_woke: ['monsters', 'Sleepy giant wakes up', ['Uh oh! You woke up the sleepy giant! Here it comes!'], ''],
  hall_contact: ['monsters', 'Monster reaches the hall', ['Contact in the hall! It is close to base!'], ''],
  dance_start: ['monsters', 'Dance party starts', ['Dance party! Dance troopers dance!'], ''],
  dance_none: ['monsters', 'Dance pressed with no dancer', ['No dancers out there. Nice moves though!'], ''],
  dancer_shot: ['monsters', 'Shooting a dancer', ["It's dancing away from your shots! Press the dance button!"], ''],
  cat_shot: ['monsters', 'Shooting the friendly cat', ["Hold your fire! That's a friendly cat!"], ''],
  // ----- combat -----
  mutant_down: ['combat', 'Mutant defeated', ['Mutant defeated! Great shot {name}!', 'Mutant down! Plus one star!', 'Got it! That mutant is history!'], '{name}'],
  horde_down: ['combat', 'Horde cleared', ['Horde cleared! Awesome teamwork!'], ''],
  zombie_down: ['combat', 'Zombie defeated (sometimes)', ['Zombie down!', 'Nice shot!', 'Target cleared!'], ''],
  miss: ['combat', 'A miss (sometimes)', ['Missed! Get closer!', 'Close one!', 'Missed!'], ''],
  too_fast: ['combat', 'Shooting an unfrozen speedy', ['Too fast! Freeze it first!'], ''],
  armor: ['combat', 'Shooting tank armor', ['Armor too strong! Use a freeze round or a bomb round!'], ''],
  frozen: ['combat', 'Freeze round hits', ['Frozen solid!'], ''],
  frozen_armor: ['combat', 'Freeze round cracks armor', ['Frozen! The armor cracked. Fire now!'], ''],
  freeze_miss: ['combat', 'Freeze round misses', ['Freeze round missed!'], ''],
  bomb_hit: ['combat', 'Bomb round hits', ['Boom! Direct hit!'], ''],
  bomb_miss: ['combat', 'Bomb round misses', ['Bomb round missed but it still went boom!'], ''],
  laser_wait: ['combat', 'Laser fired too soon', ['Laser not recharged!'], ''],
  shot_aim: ['combat', 'Missed because you faced the wrong way', ['Face the monster!', 'Point at the monster!', 'Wrong way! Turn and shoot!'], ''],
  shot_far: ['combat', 'Missed because it was out of range', ['Too far! Get closer!', 'Out of range! Move in!'], ''],
  shot_wall: ['combat', 'Shot hit a wall', ['You hit the wall!', 'A wall is in the way! Find the door!'], ''],
  out_of_ammo: ['combat', 'Out of ammo', ['Out of ammo for the {weapon}! Switching to the handgun.'], '{weapon}'],
  no_bombs: ['combat', 'No bomb rounds left', ['No bomb rounds left. Find some in supply crates!'], ''],
  bomb_fit: ['combat', 'Bomb rounds need another gun', ['Bomb rounds only fit the Striker or the Cannon.'], ''],
  freeze_charging: ['combat', 'Freeze round still charging', ['Freeze round still charging.'], ''],
  freeze_bomb: ['combat', 'Freeze bomb used', ['Freeze bomb! Everything is frozen. Fire now!'], ''],
  scan_iv: ['combat', 'Scanner finds an invisible mutant', ['Scanner found an invisible mutant! Fire now!'], ''],
  scan_done: ['combat', 'Scan finished', ['Scan complete.'], ''],
  scan_quiet: ['combat', 'Scan finds nothing', ['Scan complete. All quiet.'], ''],
  // ----- contact and injuries -----
  contact: ['contact', 'A monster reaches you (your phone only)', ['{monster} in {where} with you! Shoot it or run!', 'Watch out {name}! {monster} right next to you!'], '{name} {monster} {where}'],
  contact_team: ['contact', 'A monster reaches a teammate', ['{name} has a {monster} right next to them! Help!'], '{name} {monster}'],
  grabbed: ['contact', 'A monster grabs a player', ['Ouch! The {monster} grabbed {name}! Medic! Use a medkit within one minute!'], '{name} {monster}'],
  grabbed_noinj: ['contact', 'A monster grabs a player (injuries off)', ['The {monster} tagged {name}! Shake it off!'], '{name} {monster}'],
  grab_next: ['contact', 'The monster goes after the next player', ['The {monster} is going after {name} next!'], '{name} {monster}'],
  medkit_20: ['contact', 'Twenty seconds left to heal', ['{name} needs a medkit! Twenty seconds left!'], '{name}'],
  out_of_action: ['contact', 'Nobody healed in time', ['{name} is out of action! Mission lost. {name} get back to base to recover.'], '{name}'],
  recovering: ['contact', 'Back at base to recover', ['{name} made it back to base. Recovering!'], '{name}'],
  back_in_action: ['contact', 'Recovered', ['{name} is back in action!'], '{name}'],
  patched: ['contact', 'Medkit used', ['{name} is patched up! Thanks {medic}!'], '{name} {medic}'],
  self_medkit: ['contact', 'Trying to heal yourself', ['A teammate has to use the medkit on you!'], ''],
  // ----- base -----
  attack: ['base', 'Base under attack', ['Base Alpha is under attack! Fire!'], ''],
  bounce: ['base', 'Shield bounces a monster', ['Shield bounce! Ha!'], ''],
  shield_up: ['base', 'Shield button', ['Shield up!'], ''],
  need_cover: ['base', 'Repairing without cover (repairer only)', ['You need cover fire!', 'No cover! Someone has to shoot!'], ''],
  cover_team: ['base', 'Asking teammates for cover', ['Cover {name}! Repair in progress!'], '{name}'],
  emergency: ['base', 'Shield down', ['Shield down! Emergency repair! Hold the repair button while your teammate fires!'], ''],
  emergency_done: ['base', 'Shield restored', ['Shield restored! Great teamwork!'], ''],
  barricade: ['base', 'Barricade damaged event', ['The barricade is damaged! Hold repair at base while your teammate covers you!'], ''],
  robot: ['base', 'Friendly robot event', ['Friendly robot reporting for duty! Shields fully charged!'], ''],
  // ----- missions -----
  go_supply: ['missions', 'Supply run starts', ['Supply run! Get a power cell from {where}. Any toy can be the power cell.'], '{where}'],
  act_supply: ['missions', 'Supply run: arrived', ['Grab the power cell!'], ''],
  done_supply: ['missions', 'Supply run: got it', ['Power cell secured! Hurry back to Base Alpha!'], ''],
  go_ammo: ['missions', 'Ammo run starts', ['Ammo run! There is an ammo crate in {where}. Go get it!'], '{where}'],
  act_ammo: ['missions', 'Ammo run: arrived', ['Pick up the ammo crate!'], ''],
  done_ammo: ['missions', 'Ammo run: got it', ['Ammo crate secured! Back to base!'], ''],
  go_rescue: ['missions', 'Rescue starts', ['Distress call! A survivor is trapped in {where}. Bring them back to base!'], '{where}'],
  act_rescue: ['missions', 'Rescue: arrived', ['Find the survivor and pick them up gently.'], ''],
  done_rescue: ['missions', 'Rescue: got them', ['Survivor rescued! Bring them home to Base Alpha!'], ''],
  go_gen: ['missions', 'Power failure starts', ['Power failure! The radar is down. Go restart the generator in {where}!'], '{where}'],
  act_gen: ['missions', 'Generator: arrived', ['Hold the button to restart the generator!'], ''],
  done_gen: ['missions', 'Generator: running', ['Generator running! Radar back online. Return to base!'], ''],
  go_sensor: ['missions', 'Broken sensor starts', ['A radar sensor is broken in {where}. Go fix it!'], '{where}'],
  act_sensor: ['missions', 'Sensor: arrived', ['Tap fix five times to repair the sensor.'], ''],
  done_sensor: ['missions', 'Sensor: fixed', ['Sensor fixed! Return to base!'], ''],
  go_scout: ['missions', 'Scout starts', ['Scout mission! Check {where} for monsters.'], '{where}'],
  act_scout: ['missions', 'Scout: arrived', ['Look around carefully then press the button.'], ''],
  scout_zombie: ['missions', 'Scout finds a zombie', ['Zombie spotted! Run back to base!'], ''],
  scout_clear: ['missions', 'Scout finds nothing', ['{where} is clear! Head back to base!'], '{where}'],
  go_sneak: ['missions', 'Sleeping horde starts', ['A horde is sleeping in {where}. Tiptoe through without waking them!'], '{where}'],
  act_sneak: ['missions', 'Sneak: arrived', ['Shh! Tiptoe. Quiet as a mouse.'], ''],
  done_sneak: ['missions', 'Sneak: made it', ['You did it! They are still snoring. Back to base quietly.'], ''],
  mission_done: ['missions', 'Mission complete', ['Mission complete! Plus one star for the team!'], ''],
  mission_reward: ['missions', 'Mission complete with a reward', ['Mission complete! One star for the team and {reward} for {name}!'], '{reward} {name}'],
  followed: ['missions', 'Something followed you home', ['Something followed you home! Front door!'], ''],
  mission_cancel: ['missions', 'Mission called off', ['Mission called off. Return to base.'], ''],
  checkpoint: ['missions', 'Room checkpoint confirmed', ['Checkpoint {where} secured!'], '{where}'],
  // ----- items -----
  drop: ['items', 'Supply crate dropped', ['Supply drop in {where}! Seventy five seconds to grab it!'], '{where}'],
  drop_got: ['items', 'Crate picked up', ['{name} grabbed the crate! {reward}!'], '{name} {reward}'],
  drop_lost: ['items', 'Crate missed', ['The supply crate in {where} was lost.'], '{where}'],
  booster_in: ['items', 'Laser booster plugged in', ['Laser booster in! Super fast recharge for {shots} shots!', 'Booster charged! Your laser is turbo now!'], '{shots}'],
  booster_empty: ['items', 'Laser booster used up', ['Laser booster drained. Back to normal speed.'], ''],
  booster_nolaser: ['items', 'Booster without a laser', ['You need the laser rifle for that booster!'], ''],
  drone_go: ['items', 'Drone launched', ['Scout drone launched! It will scan for ninety seconds.'], ''],
  drone_home: ['items', 'Drone returns', ['Scout drone is coming home.'], ''],
  turret_go: ['items', 'Turret set up', ['Mini turret set up in {where}!'], '{where}'],
  turret_off: ['items', 'Turret runs out', ['Mini turret is out of power.'], ''],
  // ----- game -----
  start: ['game', 'Game starts', ['Base Alpha online! Welcome {names}! Radar is scanning.'], '{names}'],
  restart: ['game', 'Commander restarts the round', ['Round restarted! Everyone back to Base Alpha. Here we go again!'], ''],
  wake: ['game', 'Base wakes up', ['Base Alpha is back online! Stay sharp troopers!'], ''],
  pause: ['game', 'Pause', ['Pause! Break time troopers.'], ''],
  resume: ['game', 'Resume', ['Resuming! Stay alert!'], ''],
  all_base: ['game', 'Everyone to base', ['All troopers return to Base Alpha!'], ''],
  radar_clear: ['game', 'Radar cleared by commander', ['Radar is clear. All quiet.'], ''],
  promotion: ['game', 'Promotion', ['Promotion! {name} is now {rank} {name}!'], '{name} {rank}'],
  weapon_unlock: ['game', 'New weapon unlocked', ['New weapon unlocked for {name}! The {weapon}!'], '{name} {weapon}'],
  joined: ['game', 'A phone joins', ['{name} joined Base Alpha!'], '{name}'],
  link_lost: ['game', 'A phone loses the link', ["{name}'s phone lost the link."], '{name}'],
  finale: ['game', 'Chopper finale starts', ['Rescue chopper inbound! Clear the balcony landing zone troopers!'], ''],
  finale_clear: ['game', 'Landing zone clear', ['Landing zone clear! The rescue chopper is landing on the balcony!'], ''],
  victory: ['game', 'Victory', ['Base secured! The rescue chopper has landed! Amazing work troopers! Three stars each!'], ''],
  night: ['game', 'Night watch', ['All the monsters are running away. Base Alpha is safe. Good night troopers. Night watch is on.'], ''],
  // ----- radio calls -----
  call_0: ['calls', 'Radio call: Help', ['{name} needs help!'], '{name}'],
  call_1: ['calls', 'Radio call: Coming', ['{name} is coming!'], '{name}'],
  call_2: ['calls', 'Radio call: Clear', ['{name} says all clear here.'], '{name}'],
  call_3: ['calls', 'Radio call: Ammo', ['{name} needs ammo!'], '{name}'],
  call_4: ['calls', 'Radio call: Medic', ['{name} needs a medic!'], '{name}'],
  call_5: ['calls', 'Radio call: Cover me', ['{name} says cover me!'], '{name}']
};

// Commander's edits: { key: 'version one\nversion two' }. Kept on the commander phone and in saves.
export const Lines = {
  over: load('ba2.lines', {}),
  versions(k) { const o = this.over[k]; return o ? o.split('\n').map(s => s.trim()).filter(Boolean) : (LINES[k] ? LINES[k][2] : []); },
  text(k) { return this.versions(k).join('\n'); },
  set(k, v) { if (!LINES[k]) return; const def = LINES[k][2].join('\n'); const clean = String(v || '').split('\n').map(s => s.trim().slice(0, 220)).filter(Boolean).slice(0, 8).join('\n'); if (!clean || clean === def) delete this.over[k]; else this.over[k] = clean; store('ba2.lines', this.over); },
  reset(k) { delete this.over[k]; store('ba2.lines', this.over); },
  replaceAll(o) { this.over = {}; if (o && typeof o === 'object') for (const k in o) if (LINES[k] && typeof o[k] === 'string') this.over[k] = o[k].slice(0, 2000); store('ba2.lines', this.over); }
};
export function L(k, vars = {}) {
  const v = Lines.versions(k); let s = v.length ? v[Math.floor(Math.random() * v.length)] : '';
  return s.replace(/\{(\w+)\}/g, (m, n) => (vars[n] != null ? String(vars[n]) : m)).replace(/\s+/g, ' ').trim();
}
App.lines = Lines;
