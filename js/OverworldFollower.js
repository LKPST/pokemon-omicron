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
    enabled: true, fit: true, scale: 2, offsetY: 14, distance: 32,
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

  // ---- the sparkle (graphics/poke_ball/Sparkle.png: 6 frames of 32x32 stacked, 20 fps) that plays on the follower when it appears:
  // when the game starts / a save is loaded, and when the lead Pokémon changes (party switch). The sheet's background colour (first pixel) is keyed out.
  const SPARKS = ['graphics/poke_ball/Sparkle.png', 'graphics/poke_ball/sparkle.png'];
  function sparkSheet() {
    if (F._spark !== undefined) return F._spark;
    if (!F._sparkTry) { F._sparkTry = 1; const tryLoad = i => { if (i >= SPARKS.length) { F._spark = null; return; } const im = new Image(); im.onload = () => {
      try { const w = im.naturalWidth, h = im.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
        const id = x.getImageData(0, 0, w, h), d = id.data, r0 = d[0], g0 = d[1], b0 = d[2]; if (d[3] > 0) { for (let k = 0; k < d.length; k += 4) if (Math.abs(d[k] - r0) < 6 && Math.abs(d[k + 1] - g0) < 6 && Math.abs(d[k + 2] - b0) < 6) d[k + 3] = 0; x.putImageData(id, 0, 0); }
        F._spark = { cv, w, h, n: Math.max(1, Math.round(h / 32)) }; } catch (e) { F._spark = null; } }; im.onerror = () => tryLoad(i + 1); im.src = SPARKS[i]; }; tryLoad(0); }
    return undefined;   // still loading
  }
  function startSpark(scene, s) {
    const sh = sparkSheet(); if (sh === undefined) return false;   // not loaded yet: try again next frame
    if (!sh) return true;                                          // no sheet: nothing to play
    if (!scene.textures.exists('ow_fx_spark')) { const tex = scene.textures.addCanvas('ow_fx_spark', sh.cv); for (let i = 0; i < sh.n; i++) tex.add(i, 0, 0, i * 32, 32, 32); try { tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (_) { } }
    if (F.fx && F.fx.spr) F.fx.spr.destroy();
    F.fx = { spr: scene.add.sprite(s.x, s.y, 'ow_fx_spark', 0).setScale(Math.max(2, (s.scaleX || 1) * 1.2)), t0: scene.time.now, n: sh.n };
    return true;
  }
  function tickSpark(scene, s) {
    const f = F.fx; if (!f) return;
    const i = Math.floor((scene.time.now - f.t0) / 50);   // 20 fps
    if (i >= f.n || !s) { f.spr.destroy(); F.fx = null; return; }
    f.spr.setFrame(i); f.spr.setPosition(s.x, s.y - Math.round(s.displayHeight * 0.45)); f.spr.setDepth(s.depth + 1);
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
      const sc = F.scale === 'auto' ? Math.min(0.5, 48 / content) : (F.fit !== false && window.OWSprites.fitScale ? window.OWSprites.fitScale(m.species, Number(F.scale) || 1) : Number(F.scale) || 1);
      F.autoInfo = { cell: e ? e.w + 'x' + e.h : '?', content, scale: sc };
      spr.setOrigin(0.5, 1).setScale(sc).setVisible(false);
      if (F.spr) window.OWSprites.destroy(F.spr);
      F.spr = spr; F.species = m.species; F.shiny = !!m.isShiny; F.wasHidden = true;
      const sig = m.species + (m.isShiny ? '*' : ''); if (F.lastSpark !== sig) { F.lastSpark = sig; F.wantSpark = true; sparkSheet(); }   // new lead Pokémon (or first start / load): sparkle
      log('follower ready:', m.species, 'frame', e ? e.w + 'x' + e.h : '?', 'scale', sc, '(art ' + content + 'px in a ' + (e ? e.w : '?') + 'px cell) | player at', Math.round(scene.player.x), Math.round(scene.player.y));
    } finally { F.busy = false; }
  }

  F.attach = function (scene) {
    log('attach: OWSprites=' + !!window.OWSprites + ' OverworldSprites=' + (window.OverworldSprites ? Object.keys(window.OverworldSprites.species).length + ' species, image ' + window.OverworldSprites.image : 'MISSING') + ' party=' + (((window.GameStateManager || {}).saveData || {}).party || []).length);
    F.why = '';
    F.scene = scene; F.spr = null; F.species = null; F.pts = []; F.last = null; F.trav = 0; F.nextCheck = 0; F.busy = false;
    scene.events.once('shutdown', () => { F.detach(); });
  };
  // does the follower stand on (or is it walking onto) this world tile? NPCs use it so they never step into it (same as the player's tile)
  F.occupies = function (tx, ty) {
    const s = F.spr; if (!s || !s.visible || s.owX === undefined) return false;
    return Math.abs(s.owX - (16 + tx * 32)) < 31 && Math.abs(s.owY - (16 + ty * 32)) < 31;
  };
  F.detach = function () { if (F.fx && F.fx.spr) { try { F.fx.spr.destroy(); } catch (_) { } } F.fx = null; dropSprite(); F.pts = []; F.last = null; F.scene = null; };

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
      if (!l || Math.hypot(q.x - l.x, q.y - l.y) > 96) {
        // start of the path (map load, warp, loading a save): put the follower right behind the player at once, so it does not wait for the first step
        const dv = ({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })[p.direction] || [0, 1];
        F.pts = [{ x: q.x - dv[0] * F.distance, y: q.y - dv[1] * F.distance }, q]; F.trav = 0; F.dir = ['up', 'down', 'left', 'right'].includes(p.direction) ? p.direction : F.dir; if (F.spr) F.wasHidden = true;
      }
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
    let hop = 0; if (F.hop) { const k = (scene.time.now - F.hop.t0) / F.hop.dur; if (k >= 1) F.hop = null; else hop = Math.abs(Math.sin(k * Math.PI * (F.hop.n || 2))) * (F.hop.h || 9); }
    s.setPosition(Math.round(x), Math.round(y + F.offsetY - (step ? 1 : 0) - hop));
    s.setDepth(y - 0.5);
    // not drawn while it still sits on the player's own tile right after a warp (it steps out when he moves)
    const dp = Math.hypot(x - p.x, y - p.y);
    const shouldShow = dp > 6;
    s.setAlpha(1);
    // appearing: the sparkle plays first on the spot where the follower stands (it is still hidden), then it shows up with one little hop in place
    if (F.wantSpark && shouldShow && startSpark(scene, s)) { F.wantSpark = false; F.holding = true; }
    s.setVisible(F.holding ? false : shouldShow);
    tickSpark(scene, s);
    if (F.holding && !F.fx) { F.holding = false; s.setVisible(shouldShow); F.hop = { t0: scene.time.now, dur: 380, n: 1, h: 14 }; }
  };

  // ---- talk to it: Z while it stands next to the player (any side). It turns to the player, hops, a heart pops up, a short message.
  F.lines = ['{n} looks happy!', '{n} is looking at $player.', '{n} is walking in step with $player.', '{n} wants to play!', '{n} cried out cheerfully!', '{n} is full of energy.'];
  function heart(scene, x, y) {
    if (!scene.textures.exists('ow_heart')) {
      const rows = ['.XX.XX.', 'XHXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], cv = document.createElement('canvas'); cv.width = 7; cv.height = 6;
      const c = cv.getContext('2d'); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; c.fillStyle = ch === 'H' ? '#ffd0d4' : '#e8484f'; c.fillRect(i, j, 1, 1); }));
      scene.textures.addCanvas('ow_heart', cv);
    }
    const im = scene.add.image(x, y, 'ow_heart').setScale(3).setDepth(5000);
    scene.tweens.add({ targets: im, y: y - 26, alpha: 0, duration: 1000, ease: 'Sine.easeOut', onComplete: () => im.destroy() });
    scene.tweens.add({ targets: im, scale: 4, duration: 220, yoyo: true });
  }
  F.interact = function (scene) {
    const s = F.spr, p = scene.player; if (!s || !p || !s.visible || scene.isLocked || scene.scriptRunning) return false;
    const fx = s.owX === undefined ? s.x : s.owX, fy = s.owY === undefined ? s.y : s.owY, dx = fx - p.x, dy = fy - p.y;
    if (Math.hypot(dx, dy) > 44) return false;   // not next to the player
    const toF = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), back = { up: 'down', down: 'up', left: 'right', right: 'left' }[toF];
    p.direction = toF; p.setFrame(window.getOverworldFrame(toF, 0));
    F.dir = back; window.OWSprites.setFrame(s, back, 0, F.shiny); F.hop = { t0: scene.time.now, dur: 420 };
    heart(scene, s.x, s.y - 40);
    const m = F.leadMon((window.GameStateManager || {}).saveData) || {};
    const pretty = String(m.species || '').replace(/^SPECIES_/, '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const DBm = (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase) || {}, name = m.nickname || ((DBm[m.species] && DBm[m.species].name) || pretty || 'Your Pokémon');
    let text = F.lines[Math.floor(Math.random() * F.lines.length)].replace('{n}', name);
    if (window.OverworldText && window.OverworldText.autoWrap) text = window.OverworldText.autoWrap(text.replace('$player', ((window.GameStateManager || {}).saveData || {}).player ? window.GameStateManager.saveData.player.name || 'Player' : 'Player'));
    scene.isLocked = true;
    const done = () => { scene.isLocked = false; scene.scriptEndedAt = scene.time.now; };
    if (window.OverworldTextbox) window.OverworldTextbox.show(scene, text, done); else scene.time.delayedCall(900, done);
    return true;
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
