// js/OverworldWild.js
//
// Wild Pokémon that walk around on GRASS tiles of the overworld (map editor behavior 5 = "Grass (wild)").
// They come from the map's Wild tab (wildData: morning / afternoon / night / dawn, with species, level range and Rate %).
// Walk into one - or let one walk into you - and a wild battle starts (BattleScene, kind 'wild').
//
// Needs: js/OverworldSpriteLoader.js (OWSprites) + tables/OverworldSprites.js (the species must be mapped in the editor's Overworld tab;
//        a species without a sprite is skipped), and a map with tiles whose behavior is 5.
// Hook-up (overworld_scene.js, update()):   if (window.OWWild) window.OWWild.update(this, time, delta);   // after the follower line
//
// Settings (change from the console while testing):
//   OWWild.enabled = true | false      OWWild.max = 15         most wild Pokémon around the screen at once
//   OWWild.log = true                  OWWild.debug()          prints the state
//   OWWild.shinyOdds = 4096            (1 in N)                OWWild.fill = 0.25   at most this share of the visible grass tiles is occupied
//   OWWild.spawnEvery = 1200 (ms)      OWWild.safeRadius = 3   no spawns this close (tiles) to the player
//   OWWild.hours = { dawn:[4,6], morning:[6,12], afternoon:[12,18] }   everything else is night
//   OWWild.bucket() can be replaced to pick the time slot differently (return 'morning' | 'afternoon' | 'night' | 'dawn')
//   map option:  wild: false  in overworld_map.js turns the wild Pokémon off for that map
//   saveData.wild = false     turns them off for that save
(function () {
  'use strict';
  const W = {
    enabled: true, max: 15, log: true, shinyOdds: 4096, fill: 0.25, spawnEvery: 1200, safeRadius: 3, margin: 3, walkMs: 420,
    hours: { dawn: [4, 6], morning: [6, 12], afternoon: [12, 18] },
    scene: null, mapKey: null, grass: new Set(), mons: [], loading: 0, nextSpawn: 0, busy: false, why: '', list: [], lastBucket: '', warned: {},
  };
  const log = (...a) => { if (W.log) console.log('[WILD]', ...a); };
  const why = r => { if (W.why !== r) { W.why = r; log(r); } };
  const DIRS = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];
  const key = (x, y) => x + ',' + y;

  W.bucket = function () {
    const h = new Date().getHours();
    for (const [n, r] of Object.entries(W.hours)) if (h >= r[0] && h < r[1]) return n;
    return 'night';
  };

  function reset(scene) {
    for (const m of W.mons) kill(m);
    W.mons = []; W.scene = scene; W.mapKey = null; W.grass = new Set(); W.list = []; W.busy = false; W.nextSpawn = 0; W.lastBucket = '';
  }
  function kill(m) { m.dead = true; if (m.tw) { try { m.tw.stop(); } catch (_) { } } if (m.spr) { window.OWSprites.destroy(m.spr); m.spr = null; } if (m.bang) { m.bang.destroy(); m.bang = null; } }

  // ---- map data
  function scanGrass(scene) {
    const set = new Set(), layers = scene.getTileLayers(scene.currentMap) || [];
    for (const { grid } of layers) for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
      const c = scene.parseTileCell(grid[y][x]); if (c && c.pass === 5) set.add(key(x, y));
    }
    return set;
  }
  function pickList(scene) {
    const wd = scene.currentMap && scene.currentMap.wildData, b = W.bucket(), arr = (wd && wd[b]) || [], out = [];
    for (const w of arr) {
      if (!w || !w.pokemonName || w.pokemonName === 'None' || !(w.appearanceRate > 0)) continue;
      const sp = window.OWSprites.nameToKey(w.pokemonName);
      if (!sp || !window.OWSprites.hasSprite(sp)) { if (!W.warned[w.pokemonName]) { W.warned[w.pokemonName] = 1; log('skipped "' + w.pokemonName + '": no overworld sprite for it in tables/OverworldSprites.js (Overworld tab of the Pokémon editor)'); } continue; }
      out.push({ sp, rate: w.appearanceRate, lo: (w.levelRange && w.levelRange[0]) || 2, hi: (w.levelRange && w.levelRange[1]) || (w.levelRange && w.levelRange[0]) || 2 });
    }
    return out;
  }
  function pickOne(list) {
    let t = 0; for (const e of list) t += e.rate; let r = Math.random() * t;
    for (const e of list) { r -= e.rate; if (r <= 0) return e; }
    return list[list.length - 1];
  }

  // ---- geometry (all in this map's tile grid, like scene.playerGridX / Y)
  const off = scene => { const o = scene.getMapWorldOffset(scene.currentMapKey); return { x: Math.round(o.x / 32), y: Math.round(o.y / 32) }; };
  const toWorld = (scene, gx, gy) => { const o = off(scene); return { x: (o.x + gx) * 32 + 16, y: (o.y + gy) * 32 + 16 }; };
  function view(scene) {   // tile rectangle that is on screen (+ margin)
    const cam = scene.cameras.main, v = cam.worldView, o = off(scene), m = W.margin;
    return { x0: Math.floor(v.x / 32) - o.x - m, y0: Math.floor(v.y / 32) - o.y - m, x1: Math.floor((v.x + v.width) / 32) - o.x + m, y1: Math.floor((v.y + v.height) / 32) - o.y + m,
      sx0: Math.floor(v.x / 32) - o.x, sy0: Math.floor(v.y / 32) - o.y, sx1: Math.floor((v.x + v.width) / 32) - o.x, sy1: Math.floor((v.y + v.height) / 32) - o.y };
  }
  const inView = (v, x, y) => x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1;
  const onScreen = (v, x, y) => x >= v.sx0 - 1 && x <= v.sx1 + 1 && y >= v.sy0 - 1 && y <= v.sy1 + 1;
  const occupied = (x, y) => W.mons.some(m => !m.dead && ((m.gx === x && m.gy === y) || (m.tx === x && m.ty === y)));
  const walkable = (scene, x, y) => W.grass.has(key(x, y)) && !occupied(x, y) && scene.isPassable(x, y);

  async function spawnAt(scene, gx, gy) {
    if (!W.list.length) return;
    const e = pickOne(W.list), lvl = e.lo + Math.floor(Math.random() * (Math.max(e.hi, e.lo) - e.lo + 1));
    const m = { sp: e.sp, lvl, shiny: W.shinyOdds > 0 && Math.random() < 1 / W.shinyOdds, gx, gy, tx: gx, ty: gy, dir: DIRS[Math.floor(Math.random() * 4)][2], next: scene.time.now + 500 + Math.random() * 2000, spr: null, dead: false, step: 0 };
    W.mons.push(m); W.loading++;
    try {
      const spr = await window.OWSprites.create(scene, -999, -999, m.sp, { shiny: m.shiny, dir: m.dir });
      if (!spr || m.dead || W.scene !== scene || !scene.sys || !scene.add) { if (spr) window.OWSprites.destroy(spr); m.dead = true; return; }
      const F = window.OWFollower || {};
      spr.setOrigin(0.5, 1).setScale(Number(F.scale) || 2);
      const p = toWorld(scene, gx, gy); m.oy = F.offsetY === undefined ? 14 : F.offsetY;
      spr.setPosition(p.x, p.y + m.oy).setDepth(p.y); m.spr = spr;
      window.OWSprites.setFrame(spr, m.dir, 0, m.shiny);
      log('spawned', m.sp, 'Lv' + m.lvl, m.shiny ? '(shiny)' : '', 'at', gx + ',' + gy, '| around:', W.mons.filter(q => !q.dead).length);
    } catch (err) { m.dead = true; log('spawn failed', err); }
    finally { W.loading--; }
  }

  function wander(scene, m, now) {
    if (m.moving || now < m.next) return;
    m.next = now + 700 + Math.random() * 2200;
    if (Math.random() < 0.35) { m.dir = DIRS[Math.floor(Math.random() * 4)][2]; window.OWSprites.setFrame(m.spr, m.dir, 0, m.shiny); return; }   // just look around
    const opts = DIRS.filter(([dx, dy]) => walkable(scene, m.gx + dx, m.gy + dy));
    if (!opts.length) return;
    const [dx, dy, dir] = opts[Math.floor(Math.random() * opts.length)];
    m.dir = dir; m.tx = m.gx + dx; m.ty = m.gy + dy; m.moving = true;
    const a = toWorld(scene, m.gx, m.gy), b = toWorld(scene, m.tx, m.ty), t0 = now;
    m.tw = scene.tweens.addCounter({ from: 0, to: 1, duration: W.walkMs, onUpdate: tw => {
      if (m.dead || !m.spr) return; const k = tw.getValue(), x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
      window.OWSprites.setFrame(m.spr, m.dir, k < 0.5 ? 1 : 0, m.shiny); m.spr.setPosition(Math.round(x), Math.round(y + m.oy - (k > 0.25 && k < 0.75 ? 1 : 0))); m.spr.setDepth(y);
    }, onComplete: () => { m.gx = m.tx; m.gy = m.ty; m.moving = false; m.tw = null; if (m.spr) window.OWSprites.setFrame(m.spr, m.dir, 0, m.shiny); } });
  }

  function healthy(sd) { return (sd.party || []).some(p => p && p.species && !(p.hp <= 0 || p.currentHp <= 0 || p.fainted)); }

  function encounter(scene, m) {
    if (W.busy) return; W.busy = true;
    const sd = (window.GameStateManager || {}).saveData || {};
    log('ENCOUNTER:', m.sp, 'Lv' + m.lvl, m.shiny ? '(shiny)' : '');
    scene.isLocked = true;
    for (const q of W.mons) if (q.tw) { try { q.tw.pause(); } catch (_) { } }
    if (m.spr) { const bang = scene.add.text(m.spr.x, m.spr.y - m.spr.displayHeight - 4, '!', { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', stroke: '#c00000', strokeThickness: 5, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(9000); m.bang = bang;
      scene.tweens.add({ targets: bang, y: bang.y - 8, duration: 180, yoyo: true }); scene.tweens.add({ targets: m.spr, y: m.spr.y - 6, duration: 120, yoyo: true, repeat: 1 }); }
    const go = () => {
      if (scene.sound && scene.sound.stopAll) scene.sound.stopAll();
      if (window.GameStateManager) window.GameStateManager.opponentPartyMon1 = { species: m.sp, level: m.lvl, isShiny: m.shiny ? 1 : 0 };
      scene.isLocked = false;
      scene.scene.start('BattleScene', { kind: 'wild', pokemon: [{ species: m.sp, level: m.lvl, isShiny: m.shiny ? 1 : 0 }], bg: 'grass' });
    };
    scene.time.delayedCall(650, go);
  }

  W.update = function (scene, time, delta) {
    if (W.scene !== scene) reset(scene);
    if (!scene.player || !scene.currentMap || !scene.sys || !scene.sys.isActive()) return;
    const sd = (window.GameStateManager || {}).saveData || {};
    if (!W.enabled || sd.wild === false || scene.currentMap.wild === false) { if (W.mons.length) reset(scene); return why('off (enabled=' + W.enabled + ')'); }
    if (!window.OWSprites || !window.OverworldSprites) return why('js/OverworldSpriteLoader.js or tables/OverworldSprites.js is not loaded');
    if (W.busy) return;
    const menu = (window.PokemonSummary && window.PokemonSummary.isOpen()) || (window.BagMenu && window.BagMenu.isOpen()) || (window.StartMenu && window.StartMenu.isOpen());
    if (scene.scriptRunning || scene.warping || menu) return;

    // new map -> new grass
    if (W.mapKey !== scene.currentMapKey) {
      for (const m of W.mons) kill(m); W.mons = [];
      W.mapKey = scene.currentMapKey; W.grass = scanGrass(scene); W.lastBucket = ''; W.nextSpawn = time + 400; W.fresh = true; W.freshUntil = scene.time.now + 6000; W.grace = scene.time.now + 1500;
      log('map', scene.currentMapKey, '-', W.grass.size, 'grass tiles');
      if (!W.grass.size) why('no tiles with behavior 5 (Grass) on this map: paint some with the Behavior tool in the map editor');
    }
    if (!W.grass.size) return;
    const b = W.bucket();
    if (b !== W.lastBucket) {
      W.lastBucket = b; W.list = pickList(scene);
      log('time slot:', b, '->', W.list.map(e => e.sp.replace('SPECIES_', '') + ' ' + e.rate + '%').join(', ') || 'nothing in this slot (fill the map\'s Wild tab)');
      if (W.list.length) window.OWSprites.ensure(scene, W.list.map(e => e.sp)).catch(() => { });
    }
    if (!W.list.length) { why('the map "' + scene.currentMapKey + '" has no usable wild Pokémon for ' + b); return; }
    why('ok');

    if (W.fresh && scene.time.now > W.freshUntil) W.fresh = false;
    const v = view(scene), px = scene.playerGridX, py = scene.playerGridY, now = scene.time.now;

    // despawn the ones that wandered / were left far off screen
    for (const m of W.mons) if (!m.dead && !m.moving && !inView(v, m.gx, m.gy)) kill(m);
    W.mons = W.mons.filter(m => !m.dead);

    // spawn
    const n = W.mons.length;
    if (n < W.max && W.loading < 2 && now >= W.nextSpawn) {
      W.nextSpawn = now + W.spawnEvery * (W.fresh ? 0.15 : 1);
      const cand = [];
      let visGrass = 0;
      for (const k of W.grass) { const [x, y] = k.split(',').map(Number); if (!inView(v, x, y)) continue; visGrass++;
        if (Math.abs(x - px) + Math.abs(y - py) < W.safeRadius || occupied(x, y)) continue;
        if (!W.fresh && onScreen(v, x, y)) continue;       // later spawns appear just outside the screen; the first batch fills it
        cand.push([x, y]); }
      const cap = Math.min(W.max, Math.max(1, Math.floor(visGrass * W.fill)));
      if (n < cap && cand.length) { const [x, y] = cand[Math.floor(Math.random() * cand.length)]; if (scene.isPassable(x, y)) spawnAt(scene, x, y); }
      else if (n >= cap) W.fresh = false;
      if (W.fresh && n + 1 >= cap) W.fresh = false;
    }

    // behave + touch
    const pp = scene.player;
    for (const m of W.mons) {
      if (m.dead || !m.spr) continue;
      wander(scene, m, now);
      if (Math.hypot(m.spr.x - pp.x, (m.spr.y - m.oy) - pp.y) < 20 && now > (W.grace || 0)) { if (healthy(sd)) return encounter(scene, m); why('touched a wild Pokémon, but no party Pokémon can fight'); }
    }
  };

  W.debug = function () {
    const o = { enabled: W.enabled, reason: W.why, map: W.mapKey, grassTiles: W.grass.size, slot: W.lastBucket, list: W.list, around: W.mons.filter(m => !m.dead).map(m => m.sp + ' Lv' + m.lvl + ' @' + m.gx + ',' + m.gy), loader: window.OWSprites && window.OWSprites.stats() };
    console.log('[WILD] debug', o); return o;
  };
  window.OWWild = W;
})();
