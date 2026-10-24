// Overworld NPC movement. Each NPC's `movementType` (from overworld_map.js) is looked up in `types`;
// the scene calls OverworldMovement.tick(npc) regularly. Add your own types to `types`.
window.OverworldMovement = (() => {
  const TILE = 32, DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const ORDER = ['down', 'left', 'up', 'right'];   // clockwise
  // Frame of an entity for a facing + step (NOT the same as ow_table.js's getOverworldFrameFor(name, anim, dir, step), which this calls):
  //  - a Pokémon NPC (owSpecies, made by OWSprites) has named frames,
  //  - an NPC whose sprite has a frameMap (Overworld Sprite Editor) uses its 'walk' frames,
  //  - everything else uses the fixed 4x4 layout (getOverworldFrame).
  window.getOverworldFrameOf = function (e, d, s) {
    if (e && e._anim === 'run' && typeof window.getOverworldFrameFor === 'function') { const id0 = e.eventConfig && e.eventConfig.owID; try { const f0 = window.getOverworldFrameFor(id0, 'run', d, s); if (typeof f0 === 'number' && !(e.owSpecies)) return f0; } catch (er) { /* no run frames: use walk */ } }
    if (e && e.owSpecies && window.OWSprites) { const f = window.OWSprites.frameName(e.owSpecies, { shiny: e.owShiny, dir: d, step: s === 1 ? 1 : 0 }); if (f && e.scene && e.scene.textures.exists(f.key)) return f.frame; }
    const id = e && e.eventConfig && e.eventConfig.owID, T = window.OverworldTable;
    if (id && T && T[id] && T[id].frameMap && typeof window.getOverworldFrameFor === 'function') { try { const f = window.getOverworldFrameFor(id, 'walk', d, s); if (typeof f === 'number') return f; } catch (er) { /* fall back */ } }
    return window.getOverworldFrame(d, s);
  };
  const frame = (e, d, s) => window.getOverworldFrameOf(e, d, s);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const tileOf = e => ({ x: Math.round((e.x - 16) / TILE), y: Math.round((e.y - 16) / TILE) });

  // Can this entity step one tile? (map collision, the player, and its wander radius)
  function canStep(scene, e, dx, dy) {
    const t = tileOf(e), nx = t.x + dx, ny = t.y + dy;
    const off = scene.getMapWorldOffset(scene.currentMapKey);
    if (!scene.isPassable(nx - Math.round(off.x / TILE), ny - Math.round(off.y / TILE))) return false;
    const p = tileOf(scene.player);
    if (p.x === nx && p.y === ny) return false;
    // the tile the player is walking INTO is taken too (set by OverworldScene.movePlayerTo for the whole step)
    const pd = scene.playerDest; if (pd && pd.x === nx && pd.y === ny) return false;
    if (window.OWFollower && window.OWFollower.occupies && window.OWFollower.occupies(nx, ny)) return false;   // the player's follower Pokémon is there
    // another NPC that is stepping onto it (its source and destination tiles stay reserved for the whole step)
    for (const o of (scene.npcs || [])) { if (o === e) continue; if ((o.dest && o.dest.x === nx && o.dest.y === ny) || (o.src && o.src.x === nx && o.src.y === ny)) return false; }
    if (e.home && !e.noRadius) {
      const r = (e.eventConfig && e.eventConfig.wanderRadius) ?? 3;
      if (Math.abs(nx - e.home.x) > r || Math.abs(ny - e.home.y) > r) return false;
    }
    return true;
  }

  // One tile step (ms = duration, hop = small jump arc)
  function step(e, dir, done, ms = 240, hop = false, force = false) {
    const s = e.scene, [dx, dy] = DIRS[dir];
    e.direction = dir;
    if (!force && !canStep(s, e, dx, dy)) { e.setFrame(frame(e, dir, 0)); done && done(); return; }
    e._anim = ms <= 130 ? 'run' : 'walk';
    e.alt = e.alt === 1 ? 2 : 1;
    e.setFrame(frame(e, dir, e.alt));
    const x0 = e.x, y0 = e.y;
    const t0 = tileOf(e); e.src = { x: t0.x, y: t0.y }; e.dest = { x: t0.x + dx, y: t0.y + dy };   // reserve both tiles until the step is over
    e.stepInfo = { x0, y0, dx, dy, dir, done, force };
    if (e.monFollower) followStep(e, t0, ms);   // the Pokémon that follows this NPC steps onto the tile the NPC just left
    e.stepTw = s.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: t => { const v = t.getValue(); e.x = x0 + dx * TILE * v; e.y = y0 + dy * TILE * v - (hop ? Math.sin(v * Math.PI) * 14 : 0); },
      onComplete: () => { e.x = x0 + dx * TILE; e.y = y0 + dy * TILE; e.src = e.dest = null; e.stepTw = null; e.stepInfo = null; e.setFrame(frame(e, dir, 0)); e._anim = null; done && done(); },
    });
  }

  // ---- a Pokémon that follows an NPC (NPC field followMon, see OverworldScene.spawnNpcFollower): it always moves onto the tile the NPC just left
  function followStep(e, t0, ms) {
    const f = e.monFollower, s = e.scene, OWS = window.OWSprites; if (!f || !f.scene || !s) return;
    const tx = t0.x * TILE + 16, ty = t0.y * TILE + 16, fx = f.x, fy = f.y;
    const ddx = tx - fx, ddy = ty - fy; if (Math.abs(ddx) < 1 && Math.abs(ddy) < 1) return;
    const dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up');
    f.direction = dir; if (f.moveTw) { try { f.moveTw.stop(); } catch (_) { } }
    let alt = 0;
    if (OWS) OWS.setFrame(f, dir, 1, f.owShiny);
    f.moveTw = s.tweens.addCounter({ from: 0, to: 1, duration: ms,
      onUpdate: t => { const v = t.getValue(); f.x = fx + ddx * v; f.y = fy + ddy * v; const st = v > 0.5 ? 0 : 1; if (st !== alt) { alt = st; if (OWS) OWS.setFrame(f, dir, st === 0 ? 1 : 0, f.owShiny); } },
      onComplete: () => { f.x = tx; f.y = ty; f.moveTw = null; if (OWS) OWS.setFrame(f, dir, 0, f.owShiny); } });
  }

  // walk in place = ONE step animation on the spot (stand -> step frame -> stand). Use walk_in_place_right*3 for three.
  function inPlace(e, dir, done, scripted = false) {
    e.direction = dir;
    e.alt = e.alt === 1 ? 2 : 1;
    e.setFrame(frame(e, dir, e.alt));
    e.scene.time.delayedCall(120, () => {
      if (!e.scene) return;
      e.setFrame(frame(e, dir, 0));
      e.scene.time.delayedCall(120, () => { done && done(); });
    });
  }

  // CONTINUOUS movement types (walk in place, spin): one timer per NPC, it keeps going for as long as the map is open.
  // It pauses while a script / menu / battle is running or while the NPC is doing a scripted move, and picks up again afterwards.
  function loopOn(e, delay, fn) {
    if (e.loopTimer) return;
    e.loopTimer = e.scene.time.addEvent({ delay, loop: true, callback: () => {
      if (!e.scene || !e.active) { e.loopTimer && e.loopTimer.remove(false); e.loopTimer = null; return; }
      const sc = e.scene; if (sc.isLocked || sc.scriptRunning || sc.evolving || e.stepTw || e.scriptBusy) return;
      fn(e);
    } });
  }
  const walkLoop = dir => e => { e.direction = dir; loopOn(e, 170, n => { n.direction = dir; n.alt = n.alt === 1 ? 2 : 1; n.setFrame(frame(n, dir, n.alt)); }); return null; };
  const spinLoop = cw => e => { let i = Math.max(0, ORDER.indexOf(e.direction)); loopOn(e, 240, n => { i = (i + (cw ? 1 : 3)) % 4; n.direction = ORDER[i]; n.setFrame(frame(n, ORDER[i], 0)); }); return null; };

  // RUN AROUND: runs viewRadius tiles up, then left, then down, then right, and round again (a blocked side is skipped)
  function runCycle(e) {
    e.noRadius = true;
    const N = Math.max(1, Number(e.eventConfig && e.eventConfig.viewRadius) || 3), CY = ['up', 'left', 'down', 'right'];
    if (e.cyI == null) { e.cyI = 0; e.cyLeft = N; }
    for (let tries = 0; tries < 5; tries++) {
      if (e.cyLeft <= 0) { e.cyI = (e.cyI + 1) % 4; e.cyLeft = N; }
      const d = CY[e.cyI], [dx, dy] = DIRS[d];
      if (canStep(e.scene, e, dx, dy)) { e.cyLeft--; return 'run_' + d; }
      e.cyLeft = 0;   // blocked: go on to the next side
    }
    return null;
  }

  function spin(e, clockwise, done, scripted = false) {
    let i = ORDER.indexOf(e.direction); if (i < 0) i = 0;
    let n = 0;
    const ev = e.scene.time.addEvent({
      delay: 140, repeat: 3,
      callback: () => {
        if (!scripted && e.scene.scriptRunning) { ev.remove(false); done && done(); return; }
        i = (i + (clockwise ? 1 : 3)) % 4; e.direction = ORDER[i]; e.setFrame(frame(e, ORDER[i], 0));
        if (++n === 4 && done) done();
      },
    });
  }

  // Actions: look_<dir> walk_<dir> run_<dir> jump_<dir> walk_in_place_<dir> look_random look_player
  //          spin_cw spin_ccw jump_in_place wait emote_exclaim emote_question emote_heart emote_sweat
  // opts.force = true: scripted movement, walks through anything (no collision, no wander radius)
  function execute(e, action, onComplete, opts) {
    const s = e.scene; if (!s) return;
    const force = !!(opts && opts.force);
    const m = /^(walk_in_place|look|walk|run|jump)_(up|down|left|right)$/.exec(action);
    if (m) {
      const [, k, d] = m;
      if (k === 'look') { e.direction = d; e.setFrame(frame(e, d, 0)); onComplete && onComplete(); }
      else if (k === 'walk') step(e, d, onComplete, 240, false, force);
      else if (k === 'run') step(e, d, onComplete, 120, false, force);
      else if (k === 'jump') step(e, d, onComplete, 300, true, force);
      else inPlace(e, d, onComplete, force);
      return;
    }
    // emote bubble above the head: emote_exclaim (!) emote_question (?) emote_heart emote_sweat. Waits until the bubble is gone.
    const em = /^emote_(exclaim|question|heart|sweat)$/.exec(action);
    if (em) {
      const SYM = { exclaim: ['!', '#e53935'], question: ['?', '#1e88e5'], heart: ['♥', '#e91e63'], sweat: ['💧', '#039be5'] }[em[1]];
      const top = e.y - (e.displayHeight || 48) * (e.originY != null ? e.originY : 0.85) - 14;
      const g = s.add.graphics().setPosition(e.x, top).setDepth(6000);
      g.fillStyle(0xffffff, 1).lineStyle(2, 0x222222, 1).fillRoundedRect(-12, -14, 24, 24, 7).strokeRoundedRect(-12, -14, 24, 24, 7);
      g.fillTriangle(-4, 9, 4, 9, 0, 16);
      const t = s.add.text(e.x, top - 2, SYM[0], { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: SYM[1] }).setOrigin(0.5).setDepth(6001);
      const parts = [g, t]; g.setScale(0); t.setScale(0);
      s.tweens.add({ targets: parts, scale: 1, duration: 140, ease: 'Back.easeOut' });
      let follow = s.time.addEvent({ delay: 16, loop: true, callback: () => { if (!e.scene || !g.scene) return; const ty = e.y - (e.displayHeight || 48) * (e.originY != null ? e.originY : 0.85) - 14; g.setPosition(e.x, ty); t.setPosition(e.x, ty - 2); } });
      s.time.delayedCall(800, () => { follow.remove(false); parts.forEach(o => o.destroy()); onComplete && onComplete(); });
      return;
    }
    if (action === 'look_random') return execute(e, 'look_' + pick(Object.keys(DIRS)), onComplete, opts);
    if (action === 'look_player') {
      const dx = s.player.x - e.x, dy = s.player.y - e.y;
      return execute(e, 'look_' + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')), onComplete, opts);
    }
    if (action === 'spin_cw') return spin(e, true, onComplete, force);
    if (action === 'spin_ccw') return spin(e, false, onComplete, force);
    if (action === 'jump_in_place') {
      s.tweens.add({ targets: e, y: e.y - 10, duration: 140, yoyo: true, onComplete: () => onComplete && onComplete() });
      return;
    }
    s.time.delayedCall(400, () => onComplete && onComplete());   // 'wait' / unknown
  }

  const chance = (p, f) => e => (Math.random() < p ? f(e) : null);
  const patrol = axis => e => {
    const [a, b] = axis === 'h' ? ['left', 'right'] : ['up', 'down'];
    e.pd = e.pd || b;
    const [dx, dy] = DIRS[e.pd];
    if (!canStep(e.scene, e, dx, dy)) e.pd = OPP[e.pd];
    return 'walk_' + e.pd;
  };
  const face = d => () => 'look_' + d;
  const inPl = d => () => 'walk_in_place_' + d;

  // movementType -> function(entity) returning an action (or null to stay still this tick)
  const types = {
    MOVEMENT_TYPE_LOOK_AROUND: chance(0.5, () => 'look_random'),
    MOVEMENT_TYPE_FACE_PLAYER: () => 'look_player',
    MOVEMENT_TYPE_FACE_UP: face('up'), MOVEMENT_TYPE_FACE_DOWN: face('down'),
    MOVEMENT_TYPE_FACE_LEFT: face('left'), MOVEMENT_TYPE_FACE_RIGHT: face('right'),
    MOVEMENT_TYPE_WANDER_LEFT_RIGHT: chance(0.6, () => 'walk_' + pick(['left', 'right'])),
    MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT: chance(0.6, () => 'walk_' + pick(['left', 'right'])),
    MOVEMENT_TYPE_WANDER_UP_AND_DOWN: chance(0.6, () => 'walk_' + pick(['up', 'down'])),
    MOVEMENT_TYPE_WANDER_AROUND: chance(0.6, () => 'walk_' + pick(Object.keys(DIRS))),
    MOVEMENT_TYPE_RUN_AROUND: runCycle,
    MOVEMENT_TYPE_HOP_AROUND: chance(0.7, () => 'jump_' + pick(Object.keys(DIRS))),   // every move is a hop
    MOVEMENT_TYPE_HOP_CASUAL: chance(0.7, () => pick(['walk_', 'jump_']) + pick(Object.keys(DIRS))),   // a mix of walking and hopping
    MOVEMENT_TYPE_JUMP_IN_PLACE: () => 'jump_in_place',
    MOVEMENT_TYPE_WALK_IN_PLACE_UP: walkLoop('up'), MOVEMENT_TYPE_WALK_IN_PLACE_DOWN: walkLoop('down'),
    MOVEMENT_TYPE_WALK_IN_PLACE_LEFT: walkLoop('left'), MOVEMENT_TYPE_WALK_IN_PLACE_RIGHT: walkLoop('right'),
    MOVEMENT_TYPE_SPIN_CLOCKWISE: spinLoop(true),
    MOVEMENT_TYPE_SPIN_COUNTER_CLOCKWISE: spinLoop(false),
    MOVEMENT_TYPE_PATROL_LEFT_RIGHT: patrol('h'),
    MOVEMENT_TYPE_PATROL_UP_DOWN: patrol('v'),
    MOVEMENT_TYPE_INVISIBLE: () => null,
  };

  // Before an NPC starts its next move: is something about to start a script / warp that involves the player? Then it stays where it is.
  //  - the player stands next to it and looks at it (one press of Z talks to it), or Z is held while he is next to it
  //  - the player is in the middle of a step onto a walk-on Script / Warp tile (the script starts when the step ends)
  function holdFor(e) {
    const s = e.scene, p = s && s.player; if (!p) return false;
    const dx = e.x - p.x, dy = e.y - p.y;
    const near = (Math.abs(dx) <= 40 && Math.abs(dy) <= 10) || (Math.abs(dy) <= 40 && Math.abs(dx) <= 10);
    if (near) {
      const d = p.direction, facing = (d === 'right' && dx > 0) || (d === 'left' && dx < 0) || (d === 'down' && dy > 0) || (d === 'up' && dy < 0);
      if (facing || (s.spaceKey && s.spaceKey.isDown)) return true;
    }
    const pd = s.playerDest;
    if (pd && s.triggers) for (const t of s.triggers) if (t.wx === pd.x && t.wy === pd.y && (t.type === 'Warp' || (t.type === 'Script' && t.config && t.config.script))) return true;
    return false;
  }

  function tick(e) {
    const t = e.eventConfig && e.eventConfig.movementType, fn = types[t];
    if (!fn || e.busy || !e.scene || e.scene.isLocked || e.scene.scriptRunning || e.texture.frameTotal < 4) return;   // buildings/trees have 1 frame
    if (!e.home) e.home = tileOf(e);
    if (/WALK_IN_PLACE|SPIN_/.test(t)) { fn(e); return; }   // continuous types: the timer does the work
    if (holdFor(e)) return;   // a script is about to start: do not begin another move
    const a = fn(e);
    if (!a) return;
    e.busy = true;
    execute(e, a, () => { e.busy = false; });
  }

  // A script is about to start (the player talked to somebody / stepped on a script tile): an NPC that is in the middle of a normal step
  // stops AT ONCE and snaps to the nearer tile, so nobody keeps walking while the script (or the message box) begins.
  // Scripted movements (applymovement) are never touched.
  function freeze(e) {
    const i = e && e.stepInfo; if (!i || i.force || !e.stepTw) return false;
    let k = 0; try { k = e.stepTw.getValue(); } catch (_) { k = 0.5; }
    try { e.stepTw.stop(); } catch (_) { }
    const f = k >= 0.5 ? 1 : 0;
    e.x = i.x0 + i.dx * TILE * f; e.y = i.y0 + i.dy * TILE * f;
    e.src = e.dest = null; e.stepTw = null; e.stepInfo = null; e.setFrame(frame(e, i.dir, 0));
    const d = i.done; d && d(); return true;
  }
  function freezeAll(scene) { let n = 0; for (const e of (scene.npcs || [])) if (freeze(e)) n++; return n; }

  // ---- TRAINERS: an NPC with isTrainer + a script + viewRadius spots the player standing in a straight, free line in front of it (within viewRadius tiles).
  // It shows the ! emote, walks up to the player, then its script runs (the script holds the speech, setflag and trainerbattle).
  // flagID = the "defeated" flag: while it is ON the trainer does not spot the player any more (set it in the script, before trainerbattle).
  function seeThrough(scene, e, wx, wy) {
    const off = scene.getMapWorldOffset(scene.currentMapKey);
    if (!scene.isPassable(wx - Math.round(off.x / TILE), wy - Math.round(off.y / TILE))) return false;
    for (const o of (scene.npcs || [])) if (o !== e && scene.npcOccupiesTile && scene.npcOccupiesTile(o, wx, wy)) return false;
    return true;
  }
  function trainerSpot(scene, now) {
    if (!scene || !scene.player || !scene.npcs || !scene.npcs.length) return;
    if (scene._tsAt && now - scene._tsAt < 100) return; scene._tsAt = now;
    if (scene.trainerBusy || scene.isLocked || scene.scriptRunning || scene.warping || scene.evolving || scene.isMoving || scene.playerDest) return;
    if (scene.scriptEndedAt && scene.time.now - scene.scriptEndedAt < 600) return;
    if ((window.PokemonSummary && window.PokemonSummary.isOpen()) || (window.BagMenu && window.BagMenu.isOpen()) || (window.StartMenu && window.StartMenu.isOpen())) return;
    const E = window.OverworldScriptEngine, p = tileOf(scene.player);
    for (const e of scene.npcs) {
      const c = e.eventConfig;
      if (!c || c.isTrainer !== true || !c.script || !e.active || !e.visible || e.stepTw || e.texture.frameTotal < 4) continue;
      if (c.flagID && E && E.getFlag && E.getFlag(c.flagID)) continue;
      const R = Number(c.viewRadius) || 0; if (R < 1) continue;
      const t = tileOf(e), d = e.direction || 'down', [dx, dy] = DIRS[d] || DIRS.down;
      const rx = p.x - t.x, ry = p.y - t.y;
      const k = dx !== 0 ? (ry === 0 ? rx * dx : 0) : (rx === 0 ? ry * dy : 0);
      if (k < 1 || k > R) continue;
      let clear = true;
      for (let i = 1; i < k; i++) if (!seeThrough(scene, e, t.x + dx * i, t.y + dy * i)) { clear = false; break; }
      if (!clear) continue;
      return spotted(scene, e, k, d);
    }
  }
  function spotted(scene, e, k, d) {
    const E = window.OverworldScriptEngine, name = e.eventConfig.script;
    scene.trainerBusy = true; scene.scriptRunning = true;   // nobody moves, the player cannot walk
    if (freezeAll) freezeAll(scene);
    e.busy = true; let done = false;
    const fin = () => {
      if (done) return; done = true;
      e.setFrame(frame(e, d, 0)); e.direction = d;
      const pd = OPP[d]; scene.player.direction = pd; try { scene.player.setFrame(window.getOverworldFrame(pd, 0)); } catch (_) { }
      e.busy = false; scene.trainerBusy = false; scene.scriptRunning = false; scene.activeNPC = e;
      if (E) E.runScript(scene, name);
    };
    const walk = left => { if (left <= 0 || !e.scene) return fin(); execute(e, 'walk_' + d, () => walk(left - 1), { force: true }); };
    scene.time.delayedCall(6000 + k * 400, fin);   // fail-safe: never leave the player locked
    execute(e, 'emote_exclaim', () => walk(k - 1));
  }

  return { execute, tick, types, canStep, freeze, freezeAll, trainerSpot };
})();
