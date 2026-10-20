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
  const T = { enabled: true, dimMs: 130, flashMs: 520, spinMs: 900, holdMs: 240, turn: 0.75, busy: false };

  T.start = function (scene, key, data) {
    const go = () => { T.busy = false; scene.isLocked = false; scene.scene.start(key, data); };
    if (!T.enabled || !scene.add || !scene.cameras || !scene.cameras.main || typeof Phaser === 'undefined') return go();
    if (T.busy) return; T.busy = true;
    scene.isLocked = true;
    const cam = scene.cameras.main, W = cam.width, H = cam.height;
    let began = false;
    const begin = img => { if (began) return; began = true; try { run(scene, go, cam, W, H, img); } catch (e) { console.warn('[BattleTransition]', e); go(); } };
    // take a picture of the current screen, so the picture itself can spin; if that is not possible use the cropped-window version
    let snapped = false;
    try {
      const r = scene.game && scene.game.renderer;
      if (r && r.snapshot) r.snapshot(im => { snapped = true; if (!began) { try { const k = '__bt_snap' + Date.now(); scene.textures.addImage(k, im); begin(k); } catch (e) { begin(null); } } });
      else begin(null);
    } catch (e) { begin(null); }
    setTimeout(() => { if (!snapped) begin(null); }, 250);
  };

  function run(scene, go, cam, W, H, imgKey) {
    const cx = W / 2, cy = H / 2, D = Math.max(W, H) * 3;
    const mk = d => scene.add.graphics().setScrollFactor(0).setDepth(100000 + (d || 0));
    const total = T.flashMs + T.spinMs + T.holdMs, ease = q => q * q * (3 - 2 * q), cl = q => Math.max(0, Math.min(1, q));
    const back = mk(0), white = mk(3).setBlendMode(Phaser.BlendModes.ADD), black = mk(2);
    let pic = null;
    if (imgKey) { pic = scene.add.image(cx, cy, imgKey).setScrollFactor(0).setDepth(100001); pic.setDisplaySize(W, H); pic.__sx = pic.scaleX; pic.__sy = pic.scaleY; back.clear(); back.fillStyle(0x000000, 1); back.fillRect(0, 0, W, H); back.setVisible(false); }
    let done = false;
    const finish = () => { if (done) return; done = true; try { [back, white, black].forEach(g => g.destroy()); if (pic) { pic.destroy(); scene.textures.remove(imgKey); } } catch (e) { /* scene gone */ } go(); };
    // brightness: two quick pulses (white added on top), then it falls back to normal
    const pulse = ms => { const p = ms / T.flashMs; return cl(Math.max(Math.sin(cl(p / .5) * Math.PI) * .75, Math.sin(cl((p - .42) / .58) * Math.PI) * .95)); };
    const draw = ms => {
      white.clear(); black.clear();
      const f = pulse(Math.min(ms, T.flashMs)); if (f > 0 && ms < T.flashMs) { white.fillStyle(0xffffff, f * .8); white.fillRect(0, 0, W, H); }
      const q = cl((ms - T.flashMs) / T.spinMs), e = q * q * q * .35 + ease(q) * .65;
      if (pic) {
        back.setVisible(ms >= T.flashMs); if (ms >= T.flashMs) { back.clear(); back.fillStyle(0x000000, 1); back.fillRect(0, 0, W, H); }
        const s = Math.max(0, 1 - e * 1.0);
        pic.setRotation(-e * Math.PI * 2 * T.turn).setScale(pic.__sx * s, pic.__sy * s).setVisible(s > 0.004);
      } else if (ms >= T.flashMs) {
        // fallback: a rotating, shrinking window - everything outside it is painted black
        const s = 1.3 * (1 - e), ang = -e * Math.PI * T.turn * 1.6, hw = W / 2 * s, hh = H / 2 * s;
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
  }
  window.BattleTransition = T;
})();
