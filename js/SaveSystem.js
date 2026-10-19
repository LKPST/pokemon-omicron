// ===========================================================================
// js/SaveSystem.js     MANUAL saving (no more autosave)
//
// Load before the scenes (after GameStateManager).
//
// How the game saves now
//   * GameStateManager.saveData lives in memory. Nothing writes it anywhere on its own any more: flags, items, money,
//     the Pokedex ... are only kept for the session until the player picks SAVE in the start menu.
//   * SAVE writes the whole saveData as JSON into the browser storage (localStorage 'pokemon_micron_save'). That is what your boot code
//     reads first, so "Continue" keeps working. A web page cannot write a file on the server by itself: save.json is only the
//     starting file. To get a file, use Options > Export save (downloads save.json), or give SaveSystem.ENDPOINT a URL of a small
//     server that accepts the JSON (POST) and writes save.json.
//   * saveData.options.autosave = true (Options > Autosave) saves when a new map is entered. Default: off.
//
// API   SaveSystem.save()  -> true/false        SaveSystem.touch()   a change was made (marks "unsaved", autosaves when enabled)
//       SaveSystem.dirty   unsaved changes      SaveSystem.playTime()  seconds played (kept in saveData.playTime on save)
//       SaveSystem.info()  -> { name, money, badges, playTime, dexSeen, dexCaught, map, savedAt, dirty }
//       SaveSystem.exportFile()  downloads save.json         SaveSystem.reset()  forget the browser save (new game on reload)
// ===========================================================================
(function (root) {
'use strict';
const KEY = 'pokemon_micron_save';
const sv = () => (root.GameStateManager && root.GameStateManager.saveData) || null;
let acc = 0, last = performance.now();
const SaveSystem = {
  KEY, ENDPOINT: null, dirty: false, savedAt: null, lastError: '',
  options() { const s = sv(); if (!s) return {}; const o = s.options || (s.options = {}); if (o.autosave == null) o.autosave = false; if (o.textSpeed == null) o.textSpeed = 1; if (o.volume == null) o.volume = 0.5; return o; },
  // seconds played in this save: what was saved + this session (only counted while the page is visible)
  playTime() { const s = sv(), base = (s && +s.playTime) || 0; this._tick(); return Math.floor(base + acc); },
  _tick() { const n = performance.now(); if (!document.hidden) acc += Math.min(5, (n - last) / 1000); last = n; },
  touch(why) { this.dirty = true; const s = sv(); if (s && s.options && s.options.autosave && why === 'map') this.save(); },
  save(scene) {
    const s = sv(); if (!s) return false;
    try {
      this._tick(); s.playTime = Math.floor((+s.playTime || 0) + acc); acc = 0;
      s.savedAt = Date.now();
      const sc = scene || this.scene;
      if (sc && sc.currentMapKey) s.mapID = sc.currentMapKey;
      const json = JSON.stringify(s); localStorage.setItem(KEY, json);
      if (this.ENDPOINT) { try { fetch(this.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json }).catch(e => { this.lastError = String(e); }); } catch (e) { this.lastError = String(e); } }
      this.dirty = false; this.savedAt = s.savedAt; this.lastError = ''; return true;
    } catch (e) { this.lastError = String(e && e.message || e); console.error('[SaveSystem] could not save:', e); return false; }
  },
  info() {
    const s = sv() || {}, p = s.player || {}, dex = root.Dex ? root.Dex.counts() : { seen: 0, caught: 0 };
    let badges = 0; const f = s.flags || {}; for (const k in f) if (/^FLAG_BADGE\d*_GET|^FLAG_BADGE/.test(k) && f[k]) badges++;
    return { name: p.name || 'Player', money: +p.money || 0, badges, playTime: this.playTime(), dexSeen: dex.seen, dexCaught: dex.caught, map: s.mapID || '', savedAt: s.savedAt || null, dirty: this.dirty, id: ((+p.playerOTID || 0) % 100000) };
  },
  exportFile() {
    const s = sv(); if (!s) return false; this._tick(); const copy = Object.assign({}, s, { playTime: Math.floor((+s.playTime || 0) + acc) });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' })); a.download = 'save.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
  },
  reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } },
};
document.addEventListener('visibilitychange', () => SaveSystem._tick());
root.SaveSystem = SaveSystem;
})(window);
