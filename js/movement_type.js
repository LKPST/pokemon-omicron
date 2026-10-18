// Overworld NPC movement. Each NPC's `movementType` (from overworld_map.js) is looked up in `types`;
// the scene calls OverworldMovement.tick(npc) regularly. Add your own types to `types`.
window.OverworldMovement = (() => {
  const TILE = 32, DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const ORDER = ['down', 'left', 'up', 'right'];   // clockwise
  const frame = (d, s) => window.getOverworldFrame(d, s);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const tileOf = e => ({ x: Math.round((e.x - 16) / TILE), y: Math.round((e.y - 16) / TILE) });

  // Can this entity step one tile? (map collision, the player, and its wander radius)
  function canStep(scene, e, dx, dy) {
    const t = tileOf(e), nx = t.x + dx, ny = t.y + dy;
    const off = scene.getMapWorldOffset(scene.currentMapKey);
    if (!scene.isPassable(nx - Math.round(off.x / TILE), ny - Math.round(off.y / TILE))) return false;
    const p = tileOf(scene.player);
    if (p.x === nx && p.y === ny) return false;
    if (e.home) {
      const r = (e.eventConfig && e.eventConfig.wanderRadius) ?? 3;
      if (Math.abs(nx - e.home.x) > r || Math.abs(ny - e.home.y) > r) return false;
    }
    return true;
  }

  // One tile step (ms = duration, hop = small jump arc)
  function step(e, dir, done, ms = 240, hop = false) {
    const s = e.scene, [dx, dy] = DIRS[dir];
    e.direction = dir;
    if (!canStep(s, e, dx, dy)) { e.setFrame(frame(dir, 0)); done && done(); return; }
    e.alt = e.alt === 1 ? 2 : 1;
    e.setFrame(frame(dir, e.alt));
    const x0 = e.x, y0 = e.y;
    s.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: t => { const v = t.getValue(); e.x = x0 + dx * TILE * v; e.y = y0 + dy * TILE * v - (hop ? Math.sin(v * Math.PI) * 12 : 0); },
      onComplete: () => { e.x = x0 + dx * TILE; e.y = y0 + dy * TILE; e.setFrame(frame(dir, 0)); done && done(); },
    });
  }

  function inPlace(e, dir, done, cycles = 3) {
    const seq = [1, 0, 2, 0]; let i = 0;
    e.direction = dir;
    e.scene.time.addEvent({
      delay: 120, repeat: cycles * 4 - 1,
      callback: () => {
        e.setFrame(frame(dir, seq[i++ % 4]));
        if (i >= cycles * 4) { e.setFrame(frame(dir, 0)); done && done(); }
      },
    });
  }

  function spin(e, clockwise, done) {
    let i = ORDER.indexOf(e.direction); if (i < 0) i = 0;
    let n = 0;
    e.scene.time.addEvent({
      delay: 140, repeat: 3,
      callback: () => {
        i = (i + (clockwise ? 1 : 3)) % 4; e.direction = ORDER[i]; e.setFrame(frame(ORDER[i], 0));
        if (++n === 4 && done) done();
      },
    });
  }

  // Actions: look_<dir> walk_<dir> run_<dir> jump_<dir> walk_in_place_<dir> look_random look_player
  //          spin_cw spin_ccw jump_in_place wait
  function execute(e, action, onComplete) {
    const s = e.scene; if (!s) return;
    const m = /^(walk_in_place|look|walk|run|jump)_(up|down|left|right)$/.exec(action);
    if (m) {
      const [, k, d] = m;
      if (k === 'look') { e.direction = d; e.setFrame(frame(d, 0)); onComplete && onComplete(); }
      else if (k === 'walk') step(e, d, onComplete, 240);
      else if (k === 'run') step(e, d, onComplete, 120);
      else if (k === 'jump') step(e, d, onComplete, 300, true);
      else inPlace(e, d, onComplete);
      return;
    }
    if (action === 'look_random') return execute(e, 'look_' + pick(Object.keys(DIRS)), onComplete);
    if (action === 'look_player') {
      const dx = s.player.x - e.x, dy = s.player.y - e.y;
      return execute(e, 'look_' + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')), onComplete);
    }
    if (action === 'spin_cw') return spin(e, true, onComplete);
    if (action === 'spin_ccw') return spin(e, false, onComplete);
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
    MOVEMENT_TYPE_RUN_AROUND: chance(0.6, () => 'run_' + pick(Object.keys(DIRS))),
    MOVEMENT_TYPE_HOP_AROUND: chance(0.6, () => 'jump_' + pick(Object.keys(DIRS))),
    MOVEMENT_TYPE_JUMP_IN_PLACE: () => 'jump_in_place',
    MOVEMENT_TYPE_WALK_IN_PLACE_UP: inPl('up'), MOVEMENT_TYPE_WALK_IN_PLACE_DOWN: inPl('down'),
    MOVEMENT_TYPE_WALK_IN_PLACE_LEFT: inPl('left'), MOVEMENT_TYPE_WALK_IN_PLACE_RIGHT: inPl('right'),
    MOVEMENT_TYPE_SPIN_CLOCKWISE: () => 'spin_cw',
    MOVEMENT_TYPE_SPIN_COUNTER_CLOCKWISE: () => 'spin_ccw',
    MOVEMENT_TYPE_PATROL_LEFT_RIGHT: patrol('h'),
    MOVEMENT_TYPE_PATROL_UP_DOWN: patrol('v'),
    MOVEMENT_TYPE_INVISIBLE: () => null,
  };

  function tick(e) {
    const t = e.eventConfig && e.eventConfig.movementType, fn = types[t];
    if (!fn || e.busy || !e.scene || e.scene.isLocked || e.texture.frameTotal < 4) return;   // buildings/trees have 1 frame
    if (!e.home) e.home = tileOf(e);
    const a = fn(e);
    if (!a) return;
    e.busy = true;
    execute(e, a, () => { e.busy = false; });
  }

  return { execute, tick, types, canStep };
})();