// js/BattleTransition.js
//
// The transition from the overworld into a battle (wild AND trainer battles):
//   1. the screen dims for a moment and then flashes bright,
//   2. the picture spins and shrinks to nothing (a rotating, collapsing rectangle: everything outside it is black),
//   3. black for a moment - the battle scene (js/BattleScene.js) then opens the arena from a bar in the middle, with speed lines.
//
//   BattleTransition.start(scene, 'BattleScene', data)     plays the effect on the overworld scene, then starts the battle scene
//   BattleTransition.enabled = false                       skips the effect (the battle just starts)
//   BattleTransition.flashMs / spinMs / holdMs             lengths (ms),  BattleTransition.turn = 0.62 (how far it spins, in half turns)
//
// Used by js/OverworldWild.js (wild encounters) and by the trainerbattle script command (js/overworld_script_commands.js).
(function () {
  'use strict';
  const T = { enabled: true, dimMs: 130, flashMs: 560, spinMs: 950, holdMs: 260, turn: 0.62, busy: false };

  T.start = function (scene, key, data) {
    const go = () => { T.busy = false; scene.isLocked = false; scene.scene.start(key, data); };
    if (!T.enabled || !scene.add || !scene.cameras || !scene.cameras.main || typeof Phaser === 'undefined') return go();
    if (T.busy) return; T.busy = true;
    const cam = scene.cameras.main, W = cam.width, H = cam.height, cx = W / 2, cy = H / 2, D = Math.max(W, H) * 3;
    scene.isLocked = true;
    const mk = () => scene.add.graphics().setScrollFactor(0).setDepth(100000);
    const dim = mk(), white = mk().setBlendMode(Phaser.BlendModes.ADD), black = mk();
    const total = T.flashMs + T.spinMs + T.holdMs, ease = q => q * q * (3 - 2 * q), cl = q => Math.max(0, Math.min(1, q));
    let done = false;
    const finish = () => { if (done) return; done = true; try { [dim, white, black].forEach(g => g.destroy()); } catch (e) { /* scene gone */ } go(); };
    const draw = ms => {
      // 1. dim, then a bright flash that stays during the spin
      dim.clear(); white.clear(); black.clear();
      const d = cl(ms / T.dimMs) * (1 - cl((ms - T.dimMs) / 120)); if (d > 0) { dim.fillStyle(0x000000, .28 * d); dim.fillRect(0, 0, W, H); }
      const f = cl((ms - T.dimMs) / 150) * (ms < T.flashMs + T.spinMs ? 1 : 0); if (f > 0) { white.fillStyle(0xffffff, .72 * f); white.fillRect(0, 0, W, H); }
      // 2. spin + shrink: the visible part is a rotated rectangle, the 4 half-planes outside its edges are painted black
      const q = cl((ms - T.flashMs) / T.spinMs);
      if (ms >= T.flashMs) {
        const e = ease(q), s = 1.3 * (1 - e), ang = -e * Math.PI * T.turn, hw = W / 2 * s, hh = H / 2 * s;
        black.fillStyle(0x000000, 1);
        if (q >= 1 || s <= 0.004) black.fillRect(0, 0, W, H);
        else {
          const co = Math.cos(ang), si = Math.sin(ang), P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: cx + x * co - y * si, y: cy + x * si + y * co }));
          for (let i = 0; i < 4; i++) {
            const A = P[i], B = P[(i + 1) % 4]; let dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            let nx = dy, ny = -dx; if (nx * ((A.x + B.x) / 2 - cx) + ny * ((A.y + B.y) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
            black.beginPath(); black.moveTo(A.x - dx * D, A.y - dy * D); black.lineTo(B.x + dx * D, B.y + dy * D); black.lineTo(B.x + dx * D + nx * D, B.y + dy * D + ny * D); black.lineTo(A.x - dx * D + nx * D, A.y - dy * D + ny * D); black.closePath(); black.fillPath();
          }
        }
      }
    };
    draw(0);
    scene.tweens.addCounter({ from: 0, to: total, duration: total, ease: 'Linear', onUpdate: tw => { if (!done) draw(tw.getValue()); }, onComplete: finish });
  };
  window.BattleTransition = T;
})();
