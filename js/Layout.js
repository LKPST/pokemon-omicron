// js/Layout.js  -  LANDSCAPE layout: one centred main screen (480x320) + floating Switch-style controls in the side gutters.
// Portrait (the old two-screen layout) stays available.  Choose with  ?layout=landscape  /  ?layout=portrait  (remembered in this browser),
// or in code:  PMLayout.set({ mode:'portrait' })  (reloads the page).  Other settings: PMLayout.set({ opacity:.5, size:1, hand:'left' })  (live).
// Controls send the same key presses the keyboard does.  D-pad = arrows, A = Z, B = X, X = B (bag), Y = Space (follower talk), "-" = Tab (select), "+" = Enter (menu).
// The camera button saves a picture of the MAIN screen only.
(function () {
  'use strict';
  const DEFAULT_MODE = 'landscape';       // portrait (the old two-screen layout) stays available with ?layout=portrait
  const qs = new URLSearchParams(location.search);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  let mode = qs.get('layout'); if (mode === 'landscape' || mode === 'portrait') ls.set('pm_layout', mode); else mode = ls.get('pm_layout', DEFAULT_MODE);
  if (mode !== 'landscape' && mode !== 'portrait') mode = DEFAULT_MODE;
  const cfg = { opacity: parseFloat(ls.get('pm_tc_opacity', '0.9')), size: parseFloat(ls.get('pm_tc_size', '1')), hand: ls.get('pm_tc_hand', 'right') };
  const tq = qs.get('touch');
  const isTouch = tq === '1' || (tq !== '0' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || matchMedia('(pointer: coarse)').matches));
  const PM = window.PMLayout = { version: 9, mode, isTouch, cfg, landscape: mode === 'landscape', scale: 1,
    set(o) {
      o = o || {};
      if (o.opacity != null) { cfg.opacity = Math.max(.15, Math.min(1, +o.opacity)); ls.set('pm_tc_opacity', cfg.opacity); }
      if (o.size != null) { cfg.size = Math.max(.7, Math.min(1.5, +o.size)); ls.set('pm_tc_size', cfg.size); }
      if (o.hand) { cfg.hand = o.hand === 'left' ? 'left' : 'right'; ls.set('pm_tc_hand', cfg.hand); }
      if (o.mode && o.mode !== mode) { ls.set('pm_layout', o.mode); location.reload(); return; }
      apply();
    } };
  // ---------------------------------------------------------------- audio: phones keep sound locked until a tap. On the first touch / click / key press (and shortly after)
  // resume the audio context and start whatever music should already be playing (map music, battle music), instead of waiting for the next track.
  (function () {
    const kick = () => {
      const g = window.game; if (!g) return;
      try { const ctx = g.sound && g.sound.context; if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { /* needs a real tap */ }); } catch (e) { /* ignore */ }
      let inBattle = false; try { inBattle = g.scene.isActive('BattleScene'); } catch (e) { /* ignore */ }
      try { const m = window.BattleScene && window.BattleScene._m; if (inBattle && m && m.paused && window.BattleScene.musicOn) { const pr = m.play(); if (pr && pr.catch) pr.catch(() => { /* ignore */ }); } } catch (e) { /* ignore */ }
      if (inBattle || (window.BattleTransition && window.BattleTransition.busy)) return;
      try {
        const cur = window.currentGlobalMusic;
        if (cur && cur.manager && !cur.pendingRemove) { if (cur.isPaused) cur.resume(); else if (!cur.isPlaying && !(g.sound && g.sound.locked)) cur.play(); }
        else if (!cur) { const sc = g.scene.getScene('OverworldScene'); if (sc && g.scene.isActive('OverworldScene') && sc.updateMapMusic) sc.updateMapMusic(sc.currentMapKey); }
      } catch (e) { /* ignore */ }
    };
    PM.kickAudio = kick;
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(t => window.addEventListener(t, () => { kick(); setTimeout(kick, 150); setTimeout(kick, 700); }, { capture: true, passive: true }));
  })();

  if (!PM.landscape) return;                // portrait: nothing to do here (TouchControls.js handles the old layout)

  // ---------------------------------------------------------------- key sending
  const KEY = {
    up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40], left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
    a: ['z', 'KeyZ', 90], b: ['x', 'KeyX', 88], x: ['b', 'KeyB', 66], y: [' ', 'Space', 32], minus: ['Tab', 'Tab', 9], plus: ['Enter', 'Enter', 13],
  };
  const down = new Set();
  function fire(type, name) {
    const [key, code, kc] = KEY[name], e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, repeat: false });
    Object.defineProperty(e, 'keyCode', { get: () => kc }); Object.defineProperty(e, 'which', { get: () => kc });
    window.dispatchEvent(e);
  }
  const DBG = /[?&]debug=1/.test(location.search);
  const press = n => { if (down.has(n)) return; down.add(n); if (DBG) console.log('[PM] button down: ' + n); fire('keydown', n); if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } } };
  const release = n => { if (!down.has(n)) return; down.delete(n); fire('keyup', n); };

  // ---------------------------------------------------------------- styles
  const css = `
  html.pml, html.pml body { height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; background: #07080c; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  html.pml body { position: fixed; inset: 0; display: block; }
  #pm-bg { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; image-rendering: pixelated; }
  #pm-view { position: absolute; z-index: 3; overflow: hidden; background: #000; border-radius: 6px; box-shadow: 0 0 0 5px #0a0c14, 0 0 0 7px rgba(150,170,255,.28), 0 0 38px rgba(90,130,255,.35), 0 10px 40px rgba(0,0,0,.7); }
  .pm-grip { position: absolute; z-index: 1; overflow: hidden; box-shadow: inset 0 0 50px rgba(0,0,0,.5), 0 0 30px rgba(0,0,0,.6); backdrop-filter: blur(2px); }
  .pm-grip::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,0) 38%); }
  .pm-grip::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 10px, rgba(255,255,255,0) 10px 22px); }
  .pm-grip.l { background: linear-gradient(165deg, rgba(40,205,235,.42), rgba(8,40,78,.72)); border-right: 3px solid rgba(130,235,255,.55); }
  .pm-grip.r { background: linear-gradient(195deg, rgba(255,92,80,.42), rgba(84,14,30,.72)); border-left: 3px solid rgba(255,160,150,.55); }
  html.pml #game-container { position: absolute; left: 0; top: 0; border: 0; border-radius: 0; box-shadow: none; margin: 0; }
  html.pml canvas { image-rendering: pixelated; }
  #pm-tc { position: absolute; inset: 0; pointer-events: none; z-index: 20; --op: .55; touch-action: none; }
  #pm-tc * { touch-action: none; -webkit-tap-highlight-color: transparent; }
  #pm-tc .g { position: absolute; pointer-events: none; opacity: var(--op); }
  #pm-tc .hit { pointer-events: auto; }
  #pm-tc .pad { border-radius: 50%; background: radial-gradient(circle at 50% 40%, rgba(70,74,92,.85), rgba(26,28,40,.85)); box-shadow: inset 0 0 0 2px rgba(255,255,255,.18), 0 2px 8px rgba(0,0,0,.5); }
  #pm-tc .pad::before, #pm-tc .pad::after { content: ""; position: absolute; background: rgba(0,0,0,.28); border-radius: 4px; }
  #pm-tc .pad::before { left: 36%; right: 36%; top: 8%; bottom: 8%; } #pm-tc .pad::after { top: 36%; bottom: 36%; left: 8%; right: 8%; }
  #pm-tc .pad i { position: absolute; width: 0; height: 0; border: solid transparent; opacity: .55; z-index: 1; }
  #pm-tc .pad i.on { opacity: 1; filter: drop-shadow(0 0 4px #7ff); }
  #pm-tc .pad .u { left: 50%; top: 14%; margin-left: calc(var(--p) * -.09); border-width: 0 calc(var(--p) * .09) calc(var(--p) * .14); border-bottom-color: #e6ebff; }
  #pm-tc .pad .d { left: 50%; bottom: 14%; margin-left: calc(var(--p) * -.09); border-width: calc(var(--p) * .14) calc(var(--p) * .09) 0; border-top-color: #e6ebff; }
  #pm-tc .pad .l { top: 50%; left: 14%; margin-top: calc(var(--p) * -.09); border-width: calc(var(--p) * .09) calc(var(--p) * .14) calc(var(--p) * .09) 0; border-right-color: #e6ebff; }
  #pm-tc .pad .r { top: 50%; right: 14%; margin-top: calc(var(--p) * -.09); border-width: calc(var(--p) * .09) 0 calc(var(--p) * .09) calc(var(--p) * .14); border-left-color: #e6ebff; }
  #pm-tc .b { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 35%, rgba(86,90,110,.9), rgba(30,32,46,.9)); color: #eef1ff; font: 700 calc(var(--u) * .30) / 1 system-ui, sans-serif; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 2px rgba(255,255,255,.2), 0 2px 6px rgba(0,0,0,.5); }
  #pm-tc .b.on { background: radial-gradient(circle at 50% 35%, #7ee8e0, #26a8a0); color: #05161a; transform: scale(.94); }
  #pm-tc .pill { border-radius: 999px; color: #eef1ff; font: 700 calc(var(--u) * .26) / 1 system-ui, sans-serif; background: rgba(40,43,60,.9); display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 2px rgba(255,255,255,.2); }
  #pm-tc .pill.on { background: #26a8a0; color: #05161a; }
  #pm-tc .cam svg { width: 56%; height: 56%; }
  #pm-bh { position: fixed; inset: 0; z-index: 21; pointer-events: none; display: none; }
  #pm-bh .bw { position: absolute; pointer-events: auto; filter: drop-shadow(0 4px 5px rgba(0,0,0,.55)); transition: transform .12s, filter .12s; -webkit-tap-highlight-color: transparent; touch-action: none; }
  #pm-bh .bw.sel { transform: scale(1.07); filter: drop-shadow(0 0 9px rgba(255,255,255,.9)) drop-shadow(0 4px 5px rgba(0,0,0,.55)); }
  #pm-bh .bo, #pm-bh .bi { position: absolute; }
  #pm-bh .bw.L .bo, #pm-bh .bw.L .bi { clip-path: polygon(0 50%, 20% 0, 100% 0, 100% 100%, 20% 100%); }
  #pm-bh .bw.R .bo, #pm-bh .bw.R .bi { clip-path: polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%); }
  #pm-bh .bo { inset: 0; background: rgba(16,20,36,.92); } #pm-bh .bw.sel .bo { background: #fff; }
  #pm-bh .bi { inset: 3px; display: flex; align-items: center; justify-content: center; color: #fff; font: 800 var(--fs) / 1 system-ui, sans-serif; letter-spacing: .02em; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
  #pm-bh .bw.L .bi { padding-left: 12%; } #pm-bh .bw.R .bi { padding-right: 12%; }
  #pm-bh .bi::before { content: ""; position: absolute; inset: 0 0 52% 0; background: linear-gradient(180deg, rgba(255,255,255,.34), rgba(255,255,255,0)); }
  #pm-bh .bw.sel .bi::after { content: "\\25B6"; position: absolute; left: 24%; color: #ff4a4a; font-size: .8em; text-shadow: none; }
  #pm-bh .bw.R.sel .bi::after { left: 10%; }
  #pm-bh .c0 .bi { background: linear-gradient(160deg, #ff7a44, #c4261a); } #pm-bh .c1 .bi { background: linear-gradient(160deg, #f6d040, #b58410); color: #fffbe6; }
  #pm-bh .c2 .bi { background: linear-gradient(160deg, #46d874, #178a3c); } #pm-bh .c3 .bi { background: linear-gradient(160deg, #44cdee, #1a74b8); }
  #pm-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 30; transition: opacity .35s; }
  #pm-toast { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); background: rgba(10,12,20,.88); color: #fff; font: 600 13px system-ui, sans-serif; padding: 7px 14px; border-radius: 999px; z-index: 31; opacity: 0; transition: opacity .25s; pointer-events: none; white-space: nowrap; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add('pml');

  // ---------------------------------------------------------------- DOM
  let view, tc, flash, toast, bg, gripL, gripR; const els = {};
  // animated background (the same drifting stripes / bubbles / glow as the start menu), drawn small and scaled up
  function startBg() {
    const x = bg.getContext('2d'); let t = 0, last = performance.now();
    const grad = (w, h, a, b) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    function draw(now) {
      const dt = Math.min(.1, (now - last) / 1000); last = now; t += dt;
      const w = Math.ceil(innerWidth / 4), h = Math.ceil(innerHeight / 4); if (bg.width !== w || bg.height !== h) { bg.width = w; bg.height = h; }
      grad(w, h, '#161a2a', '#07080e'); x.save();
      const off = (t * 9) % 36; x.fillStyle = 'rgba(120,140,200,.06)';
      for (let k = -8; k < w / 18 + 8; k++) { const x0 = k * 36 + off - h; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + 14, 0); x.lineTo(x0 + 14 + h, h); x.lineTo(x0 + h, h); x.closePath(); x.fill(); }
      for (let i = 0; i < 14; i++) { const sp = 6 + (i * 7) % 9, px = (i * 53 + 17) % w, py = h + 14 - ((t * sp + i * 41) % (h + 28)), r = 4 + (i * 5) % 9, a = .05 + (i % 3) * .015;
        x.strokeStyle = 'rgba(190,205,255,' + a * 2.2 + ')'; x.lineWidth = 1; x.beginPath(); x.arc(px + Math.sin(t * .7 + i) * 4, py, r, 0, 6.2832); x.stroke(); x.fillStyle = 'rgba(190,205,255,' + a + ')'; x.beginPath(); x.arc(px + Math.sin(t * .7 + i) * 4, py, r - 1, 0, 6.2832); x.fill(); }
      const gx = w / 2 + Math.sin(t * .4) * w * .3, g = x.createRadialGradient(gx, h * .4, 4, gx, h * .4, w * .6); g.addColorStop(0, 'rgba(80,110,200,.18)'); g.addColorStop(1, 'rgba(80,110,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
    }
    let acc = 0; const loop = now => { if (now - acc > 45) { acc = now; try { draw(now); } catch (e) { /* ignore */ } } requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  function build() {
    const gc = document.getElementById('game-container'); if (!gc) return;
    bg = document.createElement('canvas'); bg.id = 'pm-bg'; document.body.insertBefore(bg, document.body.firstChild); startBg();
    gripL = document.createElement('div'); gripL.className = 'pm-grip l'; gripR = document.createElement('div'); gripR.className = 'pm-grip r'; document.body.appendChild(gripL); document.body.appendChild(gripR);
    view = document.createElement('div'); view.id = 'pm-view'; gc.parentNode.insertBefore(view, gc); view.appendChild(gc);
    flash = document.createElement('div'); flash.id = 'pm-flash'; view.appendChild(flash);
    toast = document.createElement('div'); toast.id = 'pm-toast'; view.appendChild(toast);
    buildBattleHud();
    if (tq !== '0') buildControls();   // the buttons show on every device in landscape (mouse works too); ?touch=0 hides them
    ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
    if (isTouch) document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    window.addEventListener('resize', apply); window.addEventListener('orientationchange', () => setTimeout(apply, 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
    window.addEventListener('blur', () => { setDir(null); [...down].forEach(release); });
    apply();
  }
  const g = (cls, html) => { const d = document.createElement('div'); d.className = 'g ' + cls; if (html) d.innerHTML = html; tc.appendChild(d); return d; };
  function btn(parent, cls, label, key) {
    const d = document.createElement('div'); d.className = cls + ' hit'; d.innerHTML = label; parent.appendChild(d); bindBtn(d, key); return d;
  }
  function bindBtn(el, key) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } el.classList.add('on'); if (key === 'shot') PM.screenshot(); else press(key); });
    const up = () => { el.classList.remove('on'); if (key !== 'shot') release(key); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  }
  let curDir = null;
  function setDir(d) { if (d === curDir) return; if (curDir) { release(curDir); els.arrows[curDir].classList.remove('on'); } curDir = d; if (d) { press(d); els.arrows[d].classList.add('on'); } }
  function buildControls() {
    tc = document.createElement('div'); tc.id = 'pm-tc'; document.body.appendChild(tc); tc.addEventListener('contextmenu', e => e.preventDefault());
    // D-pad
    const pad = g('pad hit', '<i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i>'); pad.style.pointerEvents = 'auto'; els.pad = pad;
    els.arrows = { up: pad.querySelector('.u'), down: pad.querySelector('.d'), left: pad.querySelector('.l'), right: pad.querySelector('.r') };
    const dirOf = e => { const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); if (Math.hypot(dx, dy) < r.width * 0.13) return null; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } setDir(dirOf(e)); });
    pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture && pad.hasPointerCapture(e.pointerId)) setDir(dirOf(e)); });
    const end = () => setDir(null); pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
    // face buttons (Switch layout: X top, Y left, A right, B bottom)
    const face = g('face'); face.style.pointerEvents = 'none'; els.face = face;
    els.fx = btn(face, 'b fx', 'X', 'x'); els.fy = btn(face, 'b fy', 'Y', 'y'); els.fa = btn(face, 'b fa', 'A', 'a'); els.fb = btn(face, 'b fb', 'B', 'b');
    // minus / plus / camera
    els.minus = g('mn'); btn(els.minus, 'pill', '&minus;', 'minus'); els.minus.style.pointerEvents = 'none';
    els.plus = g('pl'); btn(els.plus, 'pill', '+', 'plus'); els.plus.style.pointerEvents = 'none';
    els.cam = g('cam'); btn(els.cam, 'pill cam', '<svg viewBox="0 0 24 24" fill="none" stroke="#eef1ff" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>', 'shot'); els.cam.style.pointerEvents = 'none';
  }

  // ---------------------------------------------------------------- battle command buttons (outside the main screen)
  // POKéMON + BAG on the left, FIGHT + RUN on the right; shown only while a battle asks "What will X do?"
  const BH = { geo: null, els: [] };
  function buildBattleHud() {
    const root = document.createElement('div'); root.id = 'pm-bh'; document.body.appendChild(root); BH.root = root;
    const lab = ['FIGHT', 'BAG', 'POK\u00e9MON', 'RUN'];
    lab.forEach((t, i) => {
      const w = document.createElement('div'); w.className = 'bw c' + i + (i === 0 || i === 3 ? ' R' : ' L'); w.innerHTML = '<div class="bo"></div><div class="bi">' + t + '</div>'; root.appendChild(w); BH.els[i] = w;
      w.addEventListener('pointerdown', e => { e.preventDefault(); try { if (window.PMBattle) window.PMBattle.choose(i); } catch (x) { /* ignore */ } });
    });
    setInterval(() => {
      const st = window.PMBattle && window.PMBattle.state && window.PMBattle.state(), on = !!(st && st.on && st.mode === 'cmd' && PM.landscape && BH.geo);
      root.style.display = on ? 'block' : 'none'; if (!on) return;
      BH.els.forEach((w, i) => w.classList.toggle('sel', st.cmd === i));
    }, 70);
  }
  // docked to the main screen's edge (flat side against it, pointed side outward): POKéMON over BAG on the left, FIGHT over RUN on the right, all the same size
  function placeBattleHud(lx, rx, bw, y0, y1) {
    if (!BH.root) return; const zh = y1 - y0; BH.geo = (zh >= 96 && bw >= 64) ? 1 : null; if (!BH.geo) return;
    const gap = 8, bh = Math.min(60, (zh - gap) / 2), ty = y0 + (zh - (bh * 2 + gap)) / 2;
    const put = (el, x, y) => { Object.assign(el.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(bw) + 'px', height: Math.round(bh) + 'px' }); el.style.setProperty('--fs', Math.max(10, Math.min(20, bh * .27)) + 'px'); };
    put(BH.els[2], lx, ty); put(BH.els[1], lx, ty + bh + gap); put(BH.els[0], rx, ty); put(BH.els[3], rx, ty + bh + gap);
  }

  // ---------------------------------------------------------------- layout maths
  function apply() {
    if (!view) return;
    const vv = window.visualViewport, W = Math.round(vv ? vv.width : innerWidth), H = Math.round(vv ? vv.height : innerHeight);
    const cs = getComputedStyle(document.documentElement);
    const saf = n => parseFloat(getComputedStyle(document.body).getPropertyValue('--sa-' + n)) || 0;
    const R = document.createElement('div'); R.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(R);
    const rs = getComputedStyle(R), si = { t: parseFloat(rs.paddingTop) || 0, r: parseFloat(rs.paddingRight) || 0, b: parseFloat(rs.paddingBottom) || 0, l: parseFloat(rs.paddingLeft) || 0 }; R.remove(); void cs; void saf;
    const portraitPhone = H > W * 1.1;
    let s, vx, vy;
    if (portraitPhone) { s = (W - si.l - si.r) / 480; vx = si.l; vy = si.t + 6; }
    else { s = Math.min((H - si.t - si.b) / 320, (W - si.l - si.r) / 480); vx = Math.round((W - 480 * s) / 2); vy = Math.round((H - 320 * s) / 2); }
    const cap = parseFloat(qs.get('maxscale')) || (isTouch ? 99 : 2); if (!portraitPhone && s > cap) { s = cap; vx = Math.round((W - 480 * s) / 2); vy = Math.round((H - 320 * s) / 2); }
    s = Math.max(.5, s); PM.scale = s;
    const vw = Math.round(480 * s), vh = Math.round(320 * s);
    Object.assign(view.style, { left: vx + 'px', top: vy + 'px', width: vw + 'px', height: vh + 'px' });
    const gc = document.getElementById('game-container'); Object.assign(gc.style, { width: vw + 'px', height: Math.round(vw * 620 / 480) + 'px' });
    // let Phaser re-read the parent size and the canvas position (pointer mapping)
    try { if (window.game && window.game.scale) { window.game.scale.refresh(); window.game.scale.updateBounds && window.game.scale.updateBounds(); } } catch (e) { /* ignore */ }
    { const swap = cfg.hand === 'left', L = swap ? gripR : gripL, Rr = swap ? gripL : gripR; void L; void Rr;
      if (portraitPhone) { const top = vy + vh + 10, hh = H - top; Object.assign(gripL.style, { left: '0px', top: top + 'px', width: Math.round(W / 2) + 'px', height: hh + 'px', borderRadius: '0 40px 0 0' }); Object.assign(gripR.style, { left: Math.round(W / 2) + 'px', top: top + 'px', width: Math.round(W / 2) + 'px', height: hh + 'px', borderRadius: '40px 0 0 0' }); }
      else { Object.assign(gripL.style, { left: '0px', top: '0px', width: vx + 'px', height: H + 'px', borderRadius: '0 46px 46px 0' }); Object.assign(gripR.style, { left: (vx + vw) + 'px', top: '0px', width: Math.max(0, W - vx - vw) + 'px', height: H + 'px', borderRadius: '46px 0 0 46px' }); } }
    if (!tc) return;
    tc.style.setProperty('--op', cfg.opacity);
    const u = Math.max(54, Math.min(portraitPhone ? 80 : 70, (portraitPhone ? W * .2 : Math.min(H * .24, (vx + 90)))) ) * cfg.size;
    const padS = Math.round(u * 1.85), left = cfg.hand === 'left';
    const edge = 12, bot = si.b + 12;
    const place = (el, x, y, w, h) => { Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); el.style.setProperty('--u', u + 'px'); };
    const dpadSide = left ? 'right' : 'left';   // 'hand: left' swaps the two groups
    let yMid, padX, faceX, fW = Math.round(u * 2.5), fH = fW;
    if (portraitPhone) { // controls under the screen
      const top = vy + vh + 14 + Math.round(u * .46) + 8, avail = H - top - si.b;
      yMid = top + Math.max(6, (avail - padS) / 2);
      padX = si.l + edge; faceX = W - si.r - edge - fW;
    } else {
      yMid = H - bot - padS - Math.round(H * .04);
      padX = si.l + Math.max(edge, (vx - si.l - padS) / 2); faceX = W - si.r - fW - Math.max(edge, (vx - si.r - fW) / 2);
    }
    if (dpadSide === 'right') { const t = padX; padX = W - si.r - edge - padS; faceX = si.l + edge; void t; }
    place(els.pad, padX, yMid, padS, padS); els.pad.style.setProperty('--p', padS + 'px');
    place(els.face, faceX, yMid + Math.round((padS - fH) / 2) - Math.round(u * .0), fW, fH);
    const bs = Math.round(u * .98); const pos = { fx: [(fW - bs) / 2, 0], fb: [(fW - bs) / 2, fH - bs], fy: [0, (fH - bs) / 2], fa: [fW - bs, (fH - bs) / 2] };
    for (const k in pos) { const e = els[k]; Object.assign(e.style, { left: Math.round(pos[k][0]) + 'px', top: Math.round(pos[k][1]) + 'px', width: bs + 'px', height: bs + 'px' }); e.style.setProperty('--u', u + 'px'); e.style.pointerEvents = 'auto'; }
    // pills: minus above the d-pad side, plus above the face side, camera near plus
    const pw = Math.round(u * 1.0), ph = Math.round(u * .46);
    const topRow = portraitPhone ? yMid - ph - 6 : Math.max(vy + 8, si.t + 10);
    const padCx = padX + padS / 2 - pw / 2, faceCx = faceX + fW / 2 - pw / 2;
    const setPill = (el, x, y, w, h) => { place(el, x, y, w, h); const p = el.firstChild; p.style.cssText = 'position:absolute;inset:0;pointer-events:auto'; };
    if (portraitPhone) { const py = vy + vh + 14; setPill(els.minus, W / 2 - pw * 1.5 - 12, py, pw, ph); setPill(els.cam, W / 2 - pw / 2, py, pw, ph); setPill(els.plus, W / 2 + pw / 2 + 12, py, pw, ph); }
    else { const tl = dpadSide === 'left'; setPill(els.minus, tl ? padCx : faceCx, topRow, pw, ph); setPill(els.plus, tl ? faceCx : padCx, topRow, pw, ph); setPill(els.cam, tl ? faceCx : padCx, topRow + ph + 8, pw, ph); }
    { const yTop = (portraitPhone ? vy + vh + 14 + ph + 10 : topRow + ph * 2 + 24), yBot = yMid - 8;
      if (portraitPhone) { const bw2 = Math.min(150, W / 2 - 14); placeBattleHud(W / 2 - bw2 - 4, W / 2 + 4, bw2, yTop, yBot); }
      else { const bw2 = Math.min(150, vx - si.l - 2, W - si.r - vx - vw - 2); placeBattleHud(vx - bw2, vx + vw, bw2, yTop, yBot); } }
    // the d-pad / face groups keep their own hit areas
  }

  // ---------------------------------------------------------------- screenshot of the MAIN screen only
  function say(t) { if (!toast) return; toast.textContent = t; toast.style.opacity = 1; clearTimeout(say.t); say.t = setTimeout(() => { toast.style.opacity = 0; }, 1800); }
  PM.toast = say;
  function save(canvas) {
    const name = 'pokemon-micron-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.png';
    canvas.toBlob(async blob => {
      if (!blob) { say('Screenshot failed'); return; }
      try { const f = new File([blob], name, { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: 'Pokémon Micron' }); say('Screenshot ready'); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); say('Screenshot saved'); }
      catch (e) { say('Screenshot failed'); }
    }, 'image/png');
  }
  PM.screenshot = function () {
    flash.style.transition = 'none'; flash.style.opacity = .7; requestAnimationFrame(() => { flash.style.transition = 'opacity .35s'; flash.style.opacity = 0; });
    const G = window.game; if (!G) return;
    const out = (src, sx, sy, sw, sh) => { const c = document.createElement('canvas'); c.width = 480; c.height = 320; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, sx, sy, sw, sh, 0, 0, 480, 320); save(c); };
    try {
      const r = G.renderer;
      if (r && r.snapshotArea) { r.snapshotArea(0, 0, 480, 320, img => { const go = () => out(img, 0, 0, img.width, img.height); if (img.complete !== false && img.width) go(); else img.onload = go; }); return; }
    } catch (e) { /* fall through */ }
    G.events.once('postrender', () => out(G.canvas, 0, 0, G.canvas.width, Math.round(G.canvas.width * 320 / 480)));
  };

  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
