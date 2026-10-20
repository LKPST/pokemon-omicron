// js/OverworldFollower.js
//
// The first Pokémon of the party walks one tile behind the player in the overworld.
// Uses js/OverworldSpriteLoader.js (OWSprites) + tables/OverworldSprites.js for the sprites.
//
// How it follows: the player's path is recorded every frame and the Pokémon always stands on that path exactly one tile
// (32 px) behind the player. So it works with every kind of movement (walking, scripts, map connections) without
// touching them. Walking back into it simply swaps places. After a warp / fly / dig / map change it starts on the
// player's tile and steps out behind him as soon as he moves.
//
// Hook-up (already done in overworld_scene.js):   create():  OWFollower.attach(this)      update():  OWFollower.update(this, time, delta)
//
// Settings (change them any time, e.g. from the console while testing):
//   OWFollower.enabled   = true | false          also: GameStateManager.saveData.follower = false  turns it off for that save
//   OWFollower.scale = 2 (default: the game draws every art pixel 2x, like the player and the tiles: a 32x32 sprite = 64x64 on screen)
//                                                OWFollower.setScale(1.5) changes it live; 'auto' = half the art's native size, max 48px tall, measured on the real pixels)
//   OWFollower.offsetY   = 14                    how far below the tile centre the feet are (px)
//   OWFollower.distance  = 32                    path distance behind the player
//   map option:  follower: false  in a map in overworld_map.js hides it there (shops, indoors ...)
//   OWFollower.leadMon(saveData) can be replaced if the lead should be chosen differently (default: first Pokémon with HP > 0)
(function () {
  'use strict';
  const log = (...a) => { if (F.log) console.log('[FOLLOWER]', ...a); };
  const F = {
    log: true, why: '',
    enabled: true, scale: 2, offsetY: 14, distance: 32,
    spr: null, species: null, shiny: false, pts: [], last: null, trav: 0, dir: 'down', busy: false, nextCheck: 0, scene: null, wasHidden: true,
  };

  F.leadMon = function (sd) {
    const party = (sd && sd.party) || [];
    for (const m of party) if (m && m.species && !(m.hp <= 0 || m.currentHp <= 0 || m.fainted)) return m;
    return null;
  };

  function why(r) { if (F.why !== r) { F.why = r; log(r); } return null; }
  function wanted(scene) {
    const gsm = window.GameStateManager, sd = gsm && gsm.saveData;
    if (!F.enabled) return why('not following: OWFollower.enabled is false');
    if (sd && sd.follower === false) return why('not following: saveData.follower is false');
    if (scene.currentMap && scene.currentMap.follower === false) return why('not following: this map has follower:false');
    if (!window.OWSprites) return why('not following: js/OverworldSpriteLoader.js is not loaded (window.OWSprites missing)');
    if (!window.OverworldSprites) return why('not following: tables/OverworldSprites.js is not loaded (window.OverworldSprites missing)');
    if (!sd) return why('not following: GameStateManager.saveData is missing');
    const party = sd.party || [];
    if (!party.length) return why('not following: the party is empty');
    const m = F.leadMon(sd);
    if (!m) return why('not following: no party Pokémon with HP > 0 (' + party.map(x => x && x.species + ' hp=' + (x && (x.hp ?? x.currentHp))).join(', ') + ')');
    if (!window.OWSprites.hasSprite(m.species)) return why('not following: "' + m.species + '" has no entry in tables/OverworldSprites.js (map it in the editor, Overworld tab)');
    F.why = 'ok'; return m;
  }

  function dropSprite() {
    if (F.spr) { window.OWSprites.destroy(F.spr); F.spr = null; }
    F.species = null;
  }

  async function makeSprite(scene, m) {
    F.busy = true;
    try {
      log('creating the follower for', m.species, m.isShiny ? '(shiny)' : '', '…');
      const spr = await window.OWSprites.create(scene, -999, -999, m.species, { shiny: !!m.isShiny, dir: F.dir });
      if (!spr) { log('FAILED: OWSprites.create returned nothing - see the [OWSprites] message above (image path / fetch?)'); F.why = 'create failed'; F.fails = (F.fails || 0) + 1; if (F.fails >= 3) log('giving up after 3 failures - fix the problem, then run OWFollower.refresh()'); return; }
      if (F.scene !== scene || !scene.sys || !scene.add) { window.OWSprites.destroy(spr); return; }
      const e = window.OverworldSprites.species[m.species], w = e ? e.w : 32;
      // 'auto': half of the art's native size (the game draws a 32px tile), but never taller than 48px - measured on the drawn pixels, not on the empty cell around them
      let content = e ? Math.max(e.w, e.h) : 32;
      try {
        const tex = scene.textures.get('ow_' + m.species), img = tex.getSourceImage(), cx = img.getContext('2d'), d = cx.getImageData(0, 0, e.w, e.h).data;
        let x0 = e.w, x1 = -1, y0 = e.h, y1 = -1;
        for (let y = 0; y < e.h; y++) for (let x = 0; x < e.w; x++) if (d[(y * e.w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= 0) content = Math.max(x1 - x0 + 1, y1 - y0 + 1);
      } catch (_) { }
      const sc = F.scale === 'auto' ? Math.min(0.5, 48 / content) : Number(F.scale) || 1;
      F.autoInfo = { cell: e ? e.w + 'x' + e.h : '?', content, scale: sc };
      spr.setOrigin(0.5, 1).setScale(sc).setVisible(false);
      if (F.spr) window.OWSprites.destroy(F.spr);
      F.spr = spr; F.species = m.species; F.shiny = !!m.isShiny; F.wasHidden = true;
      log('follower ready:', m.species, 'frame', e ? e.w + 'x' + e.h : '?', 'scale', sc, '(art ' + content + 'px in a ' + (e ? e.w : '?') + 'px cell) | player at', Math.round(scene.player.x), Math.round(scene.player.y));
    } finally { F.busy = false; }
  }

  F.attach = function (scene) {
    log('attach: OWSprites=' + !!window.OWSprites + ' OverworldSprites=' + (window.OverworldSprites ? Object.keys(window.OverworldSprites.species).length + ' species, image ' + window.OverworldSprites.image : 'MISSING') + ' party=' + (((window.GameStateManager || {}).saveData || {}).party || []).length);
    F.why = '';
    F.scene = scene; F.spr = null; F.species = null; F.pts = []; F.last = null; F.trav = 0; F.nextCheck = 0; F.busy = false;
    scene.events.once('shutdown', () => { F.detach(); });
  };
  F.detach = function () { dropSprite(); F.pts = []; F.last = null; F.scene = null; };

  // call after the party changed (the check also runs by itself twice a second)
  // live size change, e.g. OWFollower.setScale(0.6)   (setScale('auto') goes back to the automatic size)
  F.setScale = function (v) { F.scale = v; if (F.spr) { const sc = v === 'auto' ? (F.autoInfo ? F.autoInfo.scale : 0.5) : Number(v) || 1; F.spr.setScale(sc); } log('scale set to', v); };

  F.refresh = function () { F.nextCheck = 0; F.fails = 0; };

  F.update = function (scene, time, delta) {
    if (F.scene !== scene) F.attach(scene);
    const p = scene.player; if (!p) return;

    // 1. who should follow?
    if (time >= F.nextCheck && !F.busy && (F.fails || 0) < 3) {
      F.nextCheck = time + 500;
      const m = wanted(scene);
      if (!m) { if (F.spr) dropSprite(); }
      else if (!F.spr || F.species !== m.species || F.shiny !== !!m.isShiny) makeSprite(scene, m);
    }

    // 2. record the player's path (a jump = warp / map change: start again from there)
    const hidden = p.alpha < 0.5 || p.visible === false;
    if (!hidden) {
      const q = { x: p.x, y: p.y }, l = F.last;
      if (!l || Math.hypot(q.x - l.x, q.y - l.y) > 96) { F.pts = [q]; F.trav = 0; if (F.spr) F.wasHidden = true; }
      else if (Math.hypot(q.x - l.x, q.y - l.y) >= 0.5) F.pts.push(q);
      F.last = q;
      if (F.pts.length > 400) F.pts.splice(0, F.pts.length - 300);
    }

    const s = F.spr; if (!s) return;
    if (hidden || F.pts.length === 0) { s.setVisible(false); return; }

    // 3. the point `distance` px back along the path
    const pts = F.pts; let need = F.distance, i = pts.length - 1, x = pts[i].x, y = pts[i].y;
    while (i > 0 && need > 0) {
      const a = pts[i], b = pts[i - 1], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d >= need) { const t = need / d; x = a.x + (b.x - a.x) * t; y = a.y + (b.y - a.y) * t; need = 0; break; }
      need -= d; x = b.x; y = b.y; i--;
    }
    if (need > 0) { x = pts[0].x; y = pts[0].y; }
    // path older than needed is not kept
    if (i > 8) pts.splice(0, i - 4);

    // 4. move, face, animate
    const ox = s.owX === undefined ? x : s.owX, oy = s.owY === undefined ? y : s.owY, mx = x - ox, my = y - oy, mv = Math.hypot(mx, my);
    s.owX = x; s.owY = y;
    if (F.wasHidden) { F.wasHidden = false; s.owX = x; s.owY = y; }
    else if (mv > 0.05) {
      F.dir = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
      F.trav += mv;
    }
    const moving = mv > 0.05 && !F.wasHidden, step = moving ? Math.floor(F.trav / 12) % 2 : 0;
    window.OWSprites.setFrame(s, F.dir, step, F.shiny);
    s.setPosition(Math.round(x), Math.round(y + F.offsetY - (step ? 1 : 0)));
    s.setDepth(y - 0.5);
    // not drawn while it still sits on the player's own tile right after a warp (it steps out when he moves)
    const dp = Math.hypot(x - p.x, y - p.y);
    s.setVisible(dp > 6);
    s.setAlpha(1);
  };

  // OWFollower.debug() in the console prints the whole state
  F.debug = function () {
    const sc = F.scene, sd = (window.GameStateManager || {}).saveData || {}, m = sc && F.leadMon(sd);
    const o = { attached: !!sc, enabled: F.enabled, reason: F.why, lead: m && m.species, hasSprite: !!(m && window.OWSprites && window.OWSprites.hasSprite(m.species)),
      sprite: F.spr ? { x: F.spr.x, y: F.spr.y, visible: F.spr.visible, frame: F.spr.frame, scale: F.spr.scaleX } : null, pathPoints: F.pts.length, loader: window.OWSprites ? window.OWSprites.stats() : null };
    console.log('[FOLLOWER] debug', o); return o;
  };
  window.OWFollower = F;
})();
