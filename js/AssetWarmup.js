// js/AssetWarmup.js
//
// Why the menus / follower icons / type icons showed up late: every menu (start menu, summary, bag, battle) creates its pictures the first
// time it needs them (new Image().src = ...), draws nothing until they have loaded, and the first request of each file goes to the dev
// server one by one. This file asks for the small pictures that are certain to be needed (the party's icons and sprites, the type icon
// sheet, the player card, the font, the bag items, the first Pokédex icons) right after the map is on screen, a few at a time, and keeps
// them decoded. The menus then get them from the browser's cache instantly.
//
//   OWWarm.run()          start / re-check now (the game calls it after the scene is created and the check repeats every 2 s for new party members)
//   OWWarm.add(path)      warm one more picture
//   OWWarm.stats()        { requested, loaded, failed: [...] }
(function () {
  'use strict';
  const held = new Map(), failed = [], queue = []; let active = 0, loaded = 0, timer = 0, lastSig = '';
  const MAX = 4;
  const W = { dexCount: 30 };

  function pump() {
    while (active < MAX && queue.length) {
      const path = queue.shift(); active++;
      const im = new Image(); held.set(path, im);
      const done = ok => { active--; if (ok) loaded++; else failed.push(path); pump(); };
      im.onload = () => { (im.decode ? im.decode().catch(() => { }) : Promise.resolve()).then(() => done(true)); };
      im.onerror = () => done(false);
      im.src = path;
    }
  }
  W.add = function (path) { if (!path || held.has(path) || queue.includes(path)) return; queue.push(path); pump(); };
  const db = () => window.PokemonDatabase || (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : null) || {};

  W.run = function () {
    const gs = (window.GameStateManager || {}).saveData || {}, D = db(), party = (gs.party || []).filter(Boolean);
    const sig = party.map(m => m.species + (m.ballId || '')).join(',') + '|' + Object.keys(gs.bag || {}).length;
    if (sig === lastSig) return; lastSig = sig;
    // fixed: font, type icons, player card
    W.add('graphics/fonts/latin_short.png');
    if (window.TypeTable && window.TypeTable.sheet) W.add(window.TypeTable.sheet);
    W.add('graphics/trainer_front_sprites/player_male.png'); W.add('graphics/trainer_front_sprites/player_female.png');
    W.add('graphics/poke_ball/Sparkle.png');
    // party: icon, front/battle sprite, ball
    for (const m of party) {
      const d = D[m.species] || D[String(m.species).replace(/_[MF]$/, '')] || {};
      W.add(d.iconSprite); W.add(d.battleSprite || d.frontSprite);
      const PB = window.PokeballTables || (typeof PokeballTables !== 'undefined' ? PokeballTables : null);
      const b = PB && (PB.balls || PB)[m.ballId || 4]; if (b) W.add(b.spriteSheet);
    }
    // bag: item pictures
    const IS = window.ItemSystem;
    if (IS && IS.info && gs.bag) for (const k of Object.keys(gs.bag)) { const it = IS.info(k); if (it && it.sprite) W.add(it.sprite); }
    // the first Pokédex page icons
    let n = 0; for (const k of Object.keys(D)) { if (k === 'SPECIES_NONE') continue; if (D[k].iconSprite) W.add(D[k].iconSprite); if (++n >= W.dexCount) break; }
  };
  W.stats = () => ({ requested: held.size, loaded, queued: queue.length, failed: failed.slice() });
  W.start = function () { if (timer) return; setTimeout(W.run, 60); timer = setInterval(W.run, 2000); };
  window.OWWarm = W;
})();
