// Decides which phone plays which sound or announcement.
//  f.to   -> only that player's phone (personal: "Laser not recharged").
//  f.from -> a player's own action; their phone already played it, speaker phones play it too.
//  else   -> shared: phones with the speaker on.
import { App, S } from './core.js';
import { Snd, Voice } from './audio.js';

export function speakerOn() {
  if (S.speaker === true) return true;
  if (S.speaker === false) return false;
  const net = App.net; if (!net || net.isHost()) return true;
  // Auto: a follower phone speaks when its player is away from the commander.
  const G = App.game.G, me = G.players[App.myId()], host = G.players[G.hostId];
  return !!(me && host && me.room !== host.room);
}
function voiceAllows(pri, personal) {
  if (!S.sound) return false; const v = App.game.G.cfg.voice;
  if (personal) return v !== 'off' || pri >= 2;
  return v !== 'off' && (v === 'all' || pri >= 2);
}
export const FX = {
  play(f) {
    if (!f || typeof f !== 'object') return;
    const me = App.myId();
    if (f.to && f.to !== me) return;
    const personal = !!f.to, own = !!f.from && f.from === me;
    const audible = personal || (!own && speakerOn());
    if (typeof f.snd === 'string' && audible) Snd.play(f.snd);
    if (typeof f.say === 'string') {
      App.ui && App.ui.ticker(f.say, f.ic, personal);
      if (audible && voiceAllows(f.pri | 0, personal)) Voice.say(f.say);
    }
  }
};
App.fx = FX;
