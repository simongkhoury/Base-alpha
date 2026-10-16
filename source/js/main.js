// Boot.
import { App, S, ME } from './core.js';
import './data.js';
import { makeImages } from './art.js';
import './audio.js';
import './fx.js';
import { G } from './game.js';
import './mic.js';
import { Net } from './net.js';
import { Saves } from './saves.js';
import { startUI, ensureSelf, becomeHost } from './ui.js';

makeImages();
Saves.loadCfg();
// Reconnect the way this phone was last used, so a reload mid-game rejoins.
if (S.role === 'host') becomeHost(S.lastCode || undefined);
else if (S.role === 'client' && S.lastCode) Net.join(S.lastCode);
else ensureSelf();
startUI();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => makeImages());
window.BA = { App, G, S, ME };
