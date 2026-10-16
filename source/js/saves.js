// Five save slots on the commander's phone, plus a backup file.
import { App, load, store } from './core.js';
import { applySaved, sanitizeInv } from './game.js';
import { Lines } from './lines.js';

const KEY = 'ba2.saves', CFG = 'ba2.cfg';
let autoT = null;
export const Saves = {
  list() { const l = load(KEY, []); while (l.length < 5) l.push(null); return l.slice(0, 5); },
  snapshot(name) {
    const G = App.game.G;
    return { v: 2, at: Date.now(), name: String(name || 'Save').slice(0, 30), cfg: G.cfg, lines: Lines.over,
      players: Object.values(G.players).map(p => ({ id: p.id, name: p.name, color: p.color, av: p.av, stars: p.stars, kills: p.kills, inv: p.inv })) };
  },
  save(i, name) { const l = this.list(); const prev = l[i]; l[i] = this.snapshot(name || (prev && prev.name) || `Slot ${i + 1}`); store(KEY, l); App.game.G.slot = i; return l[i]; },
  apply(data) {
    if (!data || !Array.isArray(data.players)) return false;
    const G = App.game.G; G.roster = {};
    for (const s of data.players) { if (!s || typeof s.id !== 'string') continue; G.roster[s.id] = { id: s.id, name: String(s.name || ''), stars: s.stars | 0, kills: s.kills | 0, inv: sanitizeInv(s.inv) }; }
    for (const P of Object.values(G.players)) {
      const s = G.roster[P.id] || Object.values(G.roster).find(r => r.name && r.name.toLowerCase() === String(P.name).toLowerCase());
      if (s) applySaved(P, s); else { P.stars = 0; P.kills = 0; }
    }
    if (data.lines && typeof data.lines === 'object') Lines.replaceAll(data.lines);
    if (data.cfg && typeof data.cfg === 'object') Object.assign(G.cfg, { auto: data.cfg.auto || G.cfg.auto, voice: data.cfg.voice || G.cfg.voice, off: Array.isArray(data.cfg.off) ? data.cfg.off : G.cfg.off, injuries: data.cfg.injuries !== false, drops: data.cfg.drops !== false });
    return true;
  },
  load(i) { const s = this.list()[i]; if (!s) return false; const ok = this.apply(s); if (ok) App.game.G.slot = i; return ok; },
  del(i) { const l = this.list(); l[i] = null; store(KEY, l); if (App.game.G.slot === i) App.game.G.slot = -1; },
  autosave() { const G = App.game.G; if (G.slot < 0 || !App.net.isHost()) return; clearTimeout(autoT); autoT = setTimeout(() => this.save(G.slot), 1500); },
  saveCfg() { if (App.net.isHost()) store(CFG, App.game.G.cfg); this.autosave(); },
  loadCfg() { const c = load(CFG, null); if (c) Object.assign(App.game.G.cfg, c); },
  exportFile() {
    const data = JSON.stringify({ app: 'base-alpha', v: 2, slots: this.list() }, null, 1);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `base-alpha-saves-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  },
  async importFile(file) {
    const text = await file.text(); const d = JSON.parse(text);
    if (!d || d.app !== 'base-alpha' || !Array.isArray(d.slots)) throw new Error('This is not a Base Alpha backup file.');
    store(KEY, d.slots.slice(0, 5)); return true;
  }
};
App.saves = Saves;
