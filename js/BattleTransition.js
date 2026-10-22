// js/BattleTransition.js
//
// The transition from the overworld into a battle. A picture of the TOP screen is taken and one of several effects plays on it, ending in black;
// the battle scene (js/BattleScene.js) then opens from the black.   The lower screen's HUD slides away at the same time (StartMenu.setExit).
//
//   BattleTransition.start(scene, 'BattleScene', data)   plays a random effect, then starts the battle scene
//   BattleTransition.force = 'balls'                     always use this one (null = random).    data.transition = 'iris' does the same for one battle
//   BattleTransition.wild / .trainer                     the lists the random pick draws from
//   BattleTransition.enabled = false                     no effect at all
//   BattleTransition.list()                              names of all effects:
//     spin      flash, then the picture spins and shrinks away
//     zoom      the picture is blown up, turning, and fades to black
//     balls     Poké Balls roll in from the left and the right, pulling a black bar behind them
//     checker   black squares pop up in a diagonal wave
//     diamonds  black diamonds grow across the screen
//     stripes   strips of the picture slide out, left and right in turns
//     blinds    black blinds close from the middle of each column
//     shutter   black closes in from the top and the bottom
//     iris      a black circle closes in on the player
//     wave      the picture ripples and melts
//     pixel     the picture gets blockier and blockier
//
// Used by js/OverworldWild.js (wild encounters) and by the trainerbattle script command (js/overworld_script_commands.js).
(function () {
  'use strict';
  const ALL = ['spin', 'zoom', 'balls', 'checker', 'diamonds', 'stripes', 'blinds', 'shutter', 'iris', 'wave', 'pixel'];
  const T = {
    enabled: true, force: null, last: null, busy: false,
    wild: ALL.slice(), trainer: ['spin', 'balls', 'diamonds', 'stripes', 'blinds', 'shutter', 'iris', 'checker'],
    exitMs: 650, dimMs: 130, flashMs: 520, spinMs: 900, holdMs: 240, turn: 0.75, list: () => ALL.slice(),
  };
  const cl = q => Math.max(0, Math.min(1, q)), ease = q => q * q * (3 - 2 * q), easeIn = q => q * q, easeOut = q => 1 - (1 - q) * (1 - q);

  // ------------------------------------------------------------------ the effects drawn on a 2D canvas: fx(ctx, q 0..1, img, W, H, env)
  const px = (c, x, y, w, h) => c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  function ballShape(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#e83838'; c.beginPath(); c.arc(0, 0, r, Math.PI, 0); c.fill();
    c.fillStyle = '#f4f4fa'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(-r * .38, -r * .42, r * .2, 0, 6.2832); c.fill();
    c.fillStyle = '#202030'; c.fillRect(-r, -r * .1, r * 2, r * .2);
    c.strokeStyle = '#202030'; c.lineWidth = Math.max(2, r * .12); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.stroke();
    c.fillStyle = '#f4f4fa'; c.beginPath(); c.arc(0, 0, r * .32, 0, 6.2832); c.fill(); c.stroke();
    c.restore();
  }
  const FX = {
    zoom: { ms: 1000, draw(c, q, im, W, H) {
      const e = easeIn(q), s = 1 + e * 6, cx = W / 2, cy = H / 2; c.save(); c.translate(cx, cy); c.rotate(e * .5); c.scale(s, s); c.drawImage(im, -cx, -cy, W, H); c.restore();
      if (q < .25) { c.fillStyle = 'rgba(255,255,255,' + Math.sin(q / .25 * Math.PI) * .8 + ')'; c.fillRect(0, 0, W, H); }
      c.fillStyle = 'rgba(0,0,0,' + cl((q - .45) / .5) + ')'; c.fillRect(0, 0, W, H); } },
    balls: { ms: 1250, draw(c, q, im, W, H) {
      c.drawImage(im, 0, 0, W, H); const rows = 6, rh = H / rows, r = rh / 2 - 2;
      for (let i = 0; i < rows; i++) {
        const k = easeOut(cl((q - i * .06) / .6)), fromLeft = i % 2 === 0, x = fromLeft ? -r + k * (W + 2 * r) : W + r - k * (W + 2 * r), y = i * rh + rh / 2;
        c.fillStyle = '#000'; if (fromLeft) c.fillRect(0, i * rh, Math.min(W, x + 1), rh + 1); else c.fillRect(Math.max(0, x - 1), i * rh, W, rh + 1);   // the black bar behind the ball
        if (k < 1) ballShape(c, x, y, r, (fromLeft ? 1 : -1) * x / r);
      }
      if (q > .985) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } } },
    checker: { ms: 950, draw(c, q, im, W, H) {
      c.drawImage(im, 0, 0, W, H); const n = 40, cols = Math.ceil(W / n), rows = Math.ceil(H / n); c.fillStyle = '#000';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = (x + y) / (cols + rows) * .5, s = easeOut(cl((q - d) / .5)); if (s > 0) { const w = n * s * 1.04; px(c, x * n + (n - w) / 2, y * n + (n - w) / 2, w + 1, w + 1); } } } },
    diamonds: { ms: 1000, draw(c, q, im, W, H) {
      c.drawImage(im, 0, 0, W, H); const n = 40, cols = Math.ceil(W / n) + 1, rows = Math.ceil(H / n) + 1; c.fillStyle = '#000';
      for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) { const d = x / cols * .45, s = ease(cl((q - d) / .55)); if (s <= 0) continue; const h = n * 1.03 * s, cx = x * n, cy = y * n; c.beginPath(); c.moveTo(cx - h, cy); c.lineTo(cx, cy - h); c.lineTo(cx + h, cy); c.lineTo(cx, cy + h); c.closePath(); c.fill(); } } },
    stripes: { ms: 950, draw(c, q, im, W, H) {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H); const n = 16, cnt = Math.ceil(H / n);
      for (let i = 0; i < cnt; i++) { const k = easeIn(cl((q - (i / cnt) * .3) / .7)), dx = (i % 2 ? 1 : -1) * k * (W + 20); if (k < 1) c.drawImage(im, 0, i * n * (im.height / H), im.width, n * (im.height / H), dx, i * n, W, n); } } },
    blinds: { ms: 900, draw(c, q, im, W, H) {
      c.drawImage(im, 0, 0, W, H); const n = 40, cols = Math.ceil(W / n); c.fillStyle = '#000';
      for (let i = 0; i < cols; i++) { const k = ease(cl((q - Math.abs(i - cols / 2) / cols * .3) / .65)), w = n * k * 1.03; px(c, i * n + (n - w) / 2, 0, w + 1, H); } } },
    shutter: { ms: 800, draw(c, q, im, W, H) {
      c.drawImage(im, 0, 0, W, H); const e = easeIn(q) * .5 + q * .5, h = H / 2 * cl(e) + 1; c.fillStyle = '#000'; c.fillRect(0, 0, W, h); c.fillRect(0, H - h, W, h);
      c.fillStyle = '#fff'; if (q < .98) { c.globalAlpha = .6; c.fillRect(0, h - 1, W, 2); c.fillRect(0, H - h - 1, W, 2); c.globalAlpha = 1; } } },
    iris: { ms: 1000, draw(c, q, im, W, H, env) {
      c.drawImage(im, 0, 0, W, H); const cx = env.cx, cy = env.cy, R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 4, r = R * (1 - easeIn(q) * .5 - q * .5);
      c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H); if (r > 0.5) c.arc(cx, cy, r, 0, 6.2832, true); c.fill('evenodd'); } },
    wave: { ms: 1100, draw(c, q, im, W, H) {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H); const sh = 4, amp = q * q * 70, z = 1 + q * .25, ih = im.height / H;
      for (let y = 0; y < H; y += sh) { const dx = Math.sin(y * .045 + q * 14) * amp; c.drawImage(im, 0, y * ih, im.width, sh * ih, dx - (z - 1) * W / 2, y, W * z, sh); }
      c.fillStyle = 'rgba(0,0,0,' + cl((q - .45) / .5) + ')'; c.fillRect(0, 0, W, H); } },
    pixel: { ms: 1000, draw(c, q, im, W, H, env) {
      const bs = Math.max(1, Math.round(1 + easeIn(q) * 56)), sw = Math.max(1, Math.ceil(W / bs)), sh = Math.max(1, Math.ceil(H / bs)), t = env.tmp(sw, sh);
      t.imageSmoothingEnabled = true; t.drawImage(im, 0, 0, sw, sh); c.imageSmoothingEnabled = false; c.drawImage(t.canvas, 0, 0, sw, sh, 0, 0, sw * bs, sh * bs);
      c.fillStyle = 'rgba(0,0,0,' + cl((q - .5) / .5) + ')'; c.fillRect(0, 0, W, H); } },
  };

  T.pick = function (data) {
    const want = (data && data.transition) || T.force; if (want && (want === 'spin' || FX[want])) return want;
    const kind = data && (data.kind === 'wild' || !(data.trainerID || data.name)) ? 'wild' : 'trainer', pool = (T[kind] || ALL).filter(n => n === 'spin' || FX[n]);
    let n = pool[Math.floor(Math.random() * pool.length)]; if (pool.length > 1 && n === T.last) n = pool[(pool.indexOf(n) + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length];
    return T.last = n;
  };

  T.start = function (scene, key, data) {
    const go = () => { T.busy = false; scene.isLocked = false; scene.scene.start(key, data); };
    if (!T.enabled || !scene.add || !scene.cameras || !scene.cameras.main || typeof Phaser === 'undefined') return go();
    if (T.busy) return; T.busy = true;
    if (window.PMAudio) window.PMAudio.enterBattle();   // the map music stops here and cannot restart until the battle is over
    scene.isLocked = true;
    const cam = scene.cameras.main, W = cam.width, H = cam.height, name = T.pick(data);
    let began = false;
    const begin = im => { if (began) return; began = true; try { if (name !== 'spin' && im && FX[name]) runCanvas(scene, go, W, H, im, name); else run(scene, go, cam, W, H, im ? '__bt_snap' + Date.now() : null, im); } catch (e) { console.warn('[BattleTransition]', e); go(); } };
    // take a picture of the TOP screen only; if that is not possible the cropped-window version of "spin" is used
    let snapped = false;
    try {
      const r = scene.game && scene.game.renderer, scr = (window.OW_TEXT && window.OW_TEXT.screen) || { x: 0, y: 0, w: W, h: H };
      if (r && r.snapshotArea) r.snapshotArea(scr.x, scr.y, scr.w, scr.h, im => { snapped = true; begin(im); });
      else begin(null);
    } catch (e) { begin(null); }
    setTimeout(() => { if (!snapped) begin(null); }, 250);
  };

  // ------------------------------------------------------------------ canvas effects
  function runCanvas(scene, go, W, H, im, name) {
    const fx = FX[name], total = fx.ms + T.holdMs, key = '__bt_cv' + Date.now();
    const tex = scene.textures.createCanvas(key, W, H), ctx = tex.getContext(); try { tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ }
    const pic = scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(100001);
    const pp = scene.player, cam = scene.cameras.main; let cx = W / 2, cy = H / 2;
    try { if (pp && cam.worldView) { cx = Math.max(0, Math.min(W, (pp.x - cam.worldView.x) * cam.zoom)); cy = Math.max(0, Math.min(H, (pp.y - cam.worldView.y) * cam.zoom - 8)); } } catch (e) { /* centre */ }
    let tmpC = null; const env = { cx, cy, tmp: (w, h) => { if (!tmpC) tmpC = document.createElement('canvas'); tmpC.width = w; tmpC.height = h; return tmpC.getContext('2d'); } };
    let done = false;
    const cleanup = () => { try { pic.destroy(); if (scene.textures.exists(key)) scene.textures.remove(key); } catch (e) { /* scene gone */ } };
    scene.events.once('shutdown', cleanup);
    const draw = ms => {
      if (window.StartMenu && StartMenu.setExit) StartMenu.setExit(cl(ms / T.exitMs));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
      const q = cl(ms / fx.ms);
      if (q >= 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); } else fx.draw(ctx, q, im, W, H, env);
      tex.refresh();
    };
    const finish = () => { if (done) return; done = true; draw(total); go(); };   // black stays up until the battle scene takes over
    draw(0);
    scene.tweens.addCounter({ from: 0, to: total, duration: total, ease: 'Linear', onUpdate: tw => { if (!done) draw(tw.getValue()); }, onComplete: finish });
  }

  // ------------------------------------------------------------------ "spin": flash, then the picture spins and shrinks (or, without a snapshot, a spinning window)
  function run(scene, go, cam, W, H, imgKey, im) {
    const cx = W / 2, cy = H / 2, D = Math.max(W, H) * 3;
    if (imgKey && im) { try { scene.textures.addImage(imgKey, im); } catch (e) { imgKey = null; } } else imgKey = null;
    const mk = d => scene.add.graphics().setScrollFactor(0).setDepth(100000 + (d || 0));
    const total = T.flashMs + T.spinMs + T.holdMs, cl2 = cl, ease2 = ease;
    const back = mk(0), white = mk(3).setBlendMode(Phaser.BlendModes.ADD), black = mk(2);
    let pic = null;
    if (imgKey) { pic = scene.add.image(cx, cy, imgKey).setScrollFactor(0).setDepth(100001); pic.setDisplaySize(W, H); pic.__sx = pic.scaleX; pic.__sy = pic.scaleY; back.setVisible(false); }
    let done = false;
    const cleanup = () => { try { [back, white, black].forEach(g => g.destroy()); if (pic) { pic.destroy(); if (scene.textures.exists(imgKey)) scene.textures.remove(imgKey); } } catch (e) { /* scene gone */ } };
    scene.events.once('shutdown', cleanup);   // the black cover stays on screen until the battle scene has really taken over (no one-frame flash of the overworld)
    const finish = () => {
      if (done) return; done = true;
      try { if (pic) pic.setVisible(false); white.clear(); black.clear(); black.fillStyle(0x000000, 1); black.fillRect(0, 0, W, H); } catch (e) { /* ignore */ }
      go();
    };
    // brightness: two quick pulses (white added on top), then it falls back to normal
    const pulse = ms => { const p = ms / T.flashMs; return cl2(Math.max(Math.sin(cl2(p / .5) * Math.PI) * .75, Math.sin(cl2((p - .42) / .58) * Math.PI) * .95)); };
    const draw = ms => {
      if (window.StartMenu && StartMenu.setExit) StartMenu.setExit(cl2(ms / T.exitMs));
      white.clear(); black.clear();
      const f = pulse(Math.min(ms, T.flashMs)); if (f > 0 && ms < T.flashMs) { white.fillStyle(0xffffff, f * .8); white.fillRect(0, 0, W, H); }
      const q = cl2((ms - T.flashMs) / T.spinMs), e = q * q * q * .35 + ease2(q) * .65;
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
