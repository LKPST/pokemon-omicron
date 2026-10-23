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
  mode = 'landscape'; ls.set('pm_layout', 'landscape');   // the landscape layout is the only one now (?layout=portrait is ignored)
  const cfg = { opacity: parseFloat(ls.get('pm_tc_opacity', '0.9')), size: parseFloat(ls.get('pm_tc_size', '1')), hand: ls.get('pm_tc_hand', 'right') };
  const tq = qs.get('touch');
  const isTouch = tq === '1' || (tq !== '0' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || matchMedia('(pointer: coarse)').matches));
  const PM = window.PMLayout = { version: 13, mode, isTouch, cfg, landscape: mode === 'landscape', scale: 1,
    set(o) {
      o = o || {};
      if (o.opacity != null) { cfg.opacity = Math.max(.15, Math.min(1, +o.opacity)); ls.set('pm_tc_opacity', cfg.opacity); }
      if (o.size != null) { cfg.size = Math.max(.7, Math.min(1.5, +o.size)); ls.set('pm_tc_size', cfg.size); }
      if (o.hand) { cfg.hand = o.hand === 'left' ? 'left' : 'right'; ls.set('pm_tc_hand', cfg.hand); }
      if (o.mode && o.mode !== mode) { ls.set('pm_layout', o.mode); location.reload(); return; }
      apply();
    } };
  // ---------------------------------------------------------------- audio
  // ONE place decides which music may play (window.PMAudio): the map music (Phaser sound, window.currentGlobalMusic) and the battle music
  // (an <audio> element, BattleScene._m) never play together. mode 'battle' is set when a battle starts (BattleTransition.start / BattleScene.create)
  // and ends in BattleScene.teardown; while it is on, updateMapMusic() and the unlock below refuse to start the map music.
  // iPhone: sound stays locked until a real tap (touchend / click). On those taps we resume the Web Audio context, play a silent buffer,
  // set the audio session to "playback" (so the silent switch does not mute the game), and "prime" a few <audio> elements: iOS only lets an
  // element play from code (cries, battle music) after it has been started once by a tap, so cries go through those primed elements.
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const PMAudio = window.PMAudio = {
    mode: 'map', pool: [], primed: false, keep: null,
    game() { return window.game || null; },
    battleActive() { try { const g = this.game(); return !!(g && g.scene.isActive('BattleScene')); } catch (e) { return false; } },
    mapOk() { return this.mode === 'map' && !(window.BattleTransition && window.BattleTransition.busy) && !this.battleActive(); },
    silenceMap() { try { if (this.mapEl) this.mapEl.pause(); } catch (e) { /* ignore */ } try { const c = window.currentGlobalMusic; if (c && c.manager && !c.pendingRemove && (c.isPlaying || c.isPaused)) c.stop(); } catch (e) { /* ignore */ } },
    silenceBattle() { try { const BS = window.BattleScene, m = BS && BS._m; if (BS) BS.musicOn = false; if (m) { m.pause(); m.currentTime = 0; } } catch (e) { /* ignore */ } },
    // the map music: one looping <audio> element (native loop, play() is harmless when it is already playing)
    mapEl: null, mapPath: null,
    playMap(path) {
      let el = this.mapEl;
      if (!el) { el = this.mapEl = new Audio(); el.preload = 'auto'; }
      el.loop = true;
      if (this.mapPath !== path) { this.mapPath = path; el.src = path; el.volume = 0.5; }
      if (el.paused || el.ended) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => { /* blocked until a tap: the unlock below starts it */ }); }
    },
    // after a long idle: start the map track again from the top on the same element (a new element would need a tap on iPhone)
    refreshMap() { try { const el = this.mapEl; if (el && this.mapPath) { el.pause(); try { el.currentTime = 0; } catch (e) { /* not ready */ } const pr = el.play(); if (pr && pr.catch) pr.catch(() => { /* ignore */ }); return; } } catch (e) { /* ignore */ }
      try { const c = window.currentGlobalMusic; if (c) { try { c.stop(); c.destroy(); } catch (e) { /* ignore */ } } window.currentGlobalMusic = null; window.currentGlobalMusicPath = null; const g = this.game(), sc = g && g.scene.getScene('OverworldScene'); if (sc && g.scene.isActive('OverworldScene') && sc.updateMapMusic) sc.updateMapMusic(sc.currentMapKey); } catch (e) { /* ignore */ } },
    enterBattle() { this.mode = 'battle'; this.silenceMap(); },
    leaveBattle() { this.mode = 'map'; this.silenceBattle(); },
    // a short sound (cry) through a primed element
    play(url, vol) {
      if (!url) return null;
      try {
        let a = this.pool.find(p => p.paused || p.ended);
        if (!a) { a = new Audio(); this.pool.push(a); }
        a.muted = false; a.src = url; a.volume = vol == null ? 1 : vol; try { a.currentTime = 0; } catch (e) { /* not ready */ }
        const pr = a.play(); if (pr && pr.catch) pr.catch(() => { /* blocked until a tap */ });
        return a;
      } catch (e) { return null; }
    },
    prime() {
      const prime1 = a => { try { a.muted = true; const pr = a.play(); if (pr && pr.then) pr.then(() => { if (a._keep || (a === this.mapEl && this.mapPath)) { a.muted = false; return; } a.pause(); a.muted = false; }).catch(() => { a.muted = false; }); } catch (e) { /* ignore */ } };
      if (!this.primed) {
        this.primed = true;
        for (let i = 0; i < 4; i++) { const a = new Audio(SILENT); a.preload = 'auto'; this.pool.push(a); prime1(a); }
        if (IOS && !(navigator.audioSession)) { try { const k = new Audio(SILENT); k.loop = true; k.setAttribute('playsinline', ''); this.keep = k; k.play().catch(() => { this.keep = null; this.primed = false; }); } catch (e) { /* ignore */ } }
      }
      if (!this.mapEl) { const e = this.mapEl = new Audio(SILENT); e.loop = true; prime1(e); }   // the map music element is unlocked by this first tap
      const BS = window.BattleScene, m = BS && BS._m;
      if (m && !m._primed && !BS.musicOn) { m._primed = true; m._keep = false; prime1(m); }
    },
  };
  (function () {
    const kick = (real) => {
      const g = window.game; if (!g) return;
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
      try {
        const ctx = g.sound && g.sound.context;
        if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { /* needs a real tap */ });
        if (real && ctx && !PMAudio._tone) { PMAudio._tone = true; const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); }
      } catch (e) { /* ignore */ }
      if (real) PMAudio.prime();
      const inBattle = PMAudio.battleActive() || PMAudio.mode === 'battle';
      try { const m = window.BattleScene && window.BattleScene._m; if (inBattle && m && m.paused && window.BattleScene.musicOn) { const pr = m.play(); if (pr && pr.catch) pr.catch(() => { /* ignore */ }); } } catch (e) { /* ignore */ }
      if (!PMAudio.mapOk()) return;   // never start the map music during a battle (or while one is starting)
      try { const el = PMAudio.mapEl; if (el && PMAudio.mapPath) { if (el.paused) { const pr = el.play(); if (pr && pr.catch) pr.catch(() => { /* ignore */ }); } return; } } catch (e) { /* ignore */ }
      try {
        const cur = window.currentGlobalMusic;
        if (cur && cur.manager && !cur.pendingRemove) { if (cur.isPaused) cur.resume(); else if (!cur.isPlaying && !(g.sound && g.sound.locked)) cur.play(); }
        else if (!cur) { const sc = g.scene.getScene('OverworldScene'); if (sc && g.scene.isActive('OverworldScene') && sc.updateMapMusic) sc.updateMapMusic(sc.currentMapKey); }
      } catch (e) { /* ignore */ }
    };
    PM.kickAudio = kick;
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(t => window.addEventListener(t, () => { const real = t !== 'pointerdown'; kick(real); setTimeout(() => kick(real), 150); setTimeout(() => kick(real), 700); }, { capture: true, passive: true }));
    // coming back to the page (iOS suspends / "interrupts" the audio when the app is in the background or a call comes in)
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = performance.now(); return; }
      const away = hiddenAt ? performance.now() - hiddenAt : 0; hiddenAt = 0;
      try { const g = window.game, ctx = g && g.sound && g.sound.context; if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { /* needs a tap */ }); } catch (e) { /* ignore */ }
      if (away > 20000 && PMAudio.mapOk()) setTimeout(() => PMAudio.refreshMap(), 300);   // long away: start the map music fresh
      kick(false); setTimeout(() => kick(false), 400);
    });
    window.addEventListener('pageshow', () => kick(false));
  })();


  // ---------------------------------------------------------------- music hint + ?debug=1 panel (readable on a phone, no console needed)
  (function () {
    const mkBox = css => { const d = document.createElement('div'); d.style.cssText = css; (document.body || document.documentElement).appendChild(d); return d; };
    let hint = null;
    const DBG1 = /[?&]debug=1/.test(location.search); let box = null; const logs = [];
    if (DBG1) {
      ['warn', 'error'].forEach(k => { const o = console[k]; console[k] = function () { try { logs.push(k[0].toUpperCase() + ': ' + [].map.call(arguments, a => typeof a === 'string' ? a : (a && a.message) || String(a)).join(' ').slice(0, 150)); if (logs.length > 7) logs.shift(); } catch (e) { /* ignore */ } return o.apply(console, arguments); }; });
      window.addEventListener('error', e => { logs.push('E: ' + e.message); if (logs.length > 7) logs.shift(); });
      window.addEventListener('unhandledrejection', e => { logs.push('P: ' + ((e.reason && e.reason.message) || e.reason)); if (logs.length > 7) logs.shift(); });
    }
    setInterval(() => {
      try {
        const el = PMAudio.mapEl, blocked = !!(el && PMAudio.mapPath && el.paused && PMAudio.mapOk());
        if (blocked && !hint) { hint = mkBox('position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99998;background:rgba(10,14,30,.82);color:#fff;font:600 13px system-ui,sans-serif;padding:7px 14px;border-radius:999px;pointer-events:none;letter-spacing:.3px'); hint.textContent = '♪ Tap the screen to start the music'; }
        if (hint) hint.style.display = blocked ? 'block' : 'none';
        if (!DBG1) return;
        if (!box) box = mkBox('position:fixed;left:4px;top:4px;z-index:99999;max-width:min(94vw,440px);background:rgba(0,0,0,.74);color:#9f9;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre-wrap;word-break:break-word');
        const g = window.game, sc = g && g.scene.getScene('OverworldScene'), W = window.OWWild || {}, OS = window.OWSprites, ctx = g && g.sound && g.sound.context;
        const L = [];
        L.push('wild: ' + (W.why || '-') + '\nslot ' + (W.lastBucket || '-') + ' | list ' + ((W.list || []).length) + ' | grass ' + (W.grass ? W.grass.size : '-') + ' | mons ' + ((W.mons || []).length) + ' | loading ' + (W.loading || 0) + ' | enabled ' + W.enabled);
        L.push('sprites loaded: ' + (OS && OS.stats ? OS.stats().loaded.length : '-'));
        if (sc) L.push('map ' + sc.currentMapKey + ' | locked ' + sc.isLocked + ' | evolving ' + sc.evolving + ' | script ' + sc.scriptRunning);
        L.push('music: ' + (el ? (el.paused ? 'PAUSED' : 'playing t=' + el.currentTime.toFixed(0)) : 'none') + ' | ctx ' + (ctx && ctx.state) + ' | mode ' + PMAudio.mode + ' | ' + new Date().toTimeString().slice(0, 8));
        if (logs.length) L.push(logs.join('\n'));
        box.textContent = L.join('\n');
      } catch (e) { /* ignore */ }
    }, 600);
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
    Object.defineProperty(e, 'pmPad', { value: name });   // which on-screen button sent it (the name screen must not TYPE the letter of a pad button)
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
  #pm-bh { position: fixed; inset: 0; z-index: 2; pointer-events: none; display: none; }
  #pm-bh .bw { --tx: 0%; --sc: 1; transform: translateX(var(--tx)) scale(var(--sc)); transition: transform .34s cubic-bezier(.2,1.25,.4,1), filter .1s, visibility 0s .4s; visibility: hidden; pointer-events: none; }
  #pm-bh.on .bw { visibility: visible; pointer-events: auto; transition-delay: 0s; }
  #pm-bh:not(.on) .L { --tx: -135%; } #pm-bh:not(.on) .R { --tx: 135%; }
  #pm-bh.on .c2, #pm-bh.on .c0 { transition-delay: .03s; } #pm-bh.on .c1, #pm-bh.on .c3 { transition-delay: .09s; }
  #pm-bh .bw { position: absolute; pointer-events: auto; -webkit-tap-highlight-color: transparent; touch-action: none; transition: transform .1s, filter .1s; filter: drop-shadow(0 3px 3px rgba(0,0,0,.5)); }
  #pm-bh .bw.sel { --sc: 1.07; filter: drop-shadow(0 0 7px rgba(255,255,255,.95)) drop-shadow(0 3px 3px rgba(0,0,0,.5)); z-index: 2; }
  #pm-bh svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  #pm-bh .tx { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fff; font: 900 var(--fs) / 1 system-ui, -apple-system, sans-serif; letter-spacing: .01em; -webkit-text-stroke: calc(var(--fs) * .22) #1b1f2e; paint-order: stroke fill; text-shadow: 0 2px 0 rgba(0,0,0,.35); }
  #pm-bh .L .tx { padding: 0 24% 0 16%; } #pm-bh .R .tx { padding: 0 16% 0 24%; }
  #pm-bh .ar { position: absolute; top: 50%; width: calc(var(--fs) * 1.5); height: auto; margin-top: calc(var(--fs) * -.75); image-rendering: pixelated; display: none; }
  #pm-bh .sel .ar { display: block; }
  #pm-bh .L .ar { left: 9%; } #pm-bh .R .ar { right: 9%; transform: scaleX(-1); }
  #pm-bh .noar .ar { display: none !important; }
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
  const HEXD = {
    0: ['#ff8c50', '#d22c18', '<path d="M110 90 C70 74 78 44 98 22 C100 42 114 44 118 24 C140 44 150 72 110 90Z" fill="rgba(255,226,140,.38)"/><path d="M150 86 C128 76 132 58 144 46 C146 58 156 58 158 50 C170 62 172 78 150 86Z" fill="rgba(255,226,140,.3)"/>'],
    1: ['#f6dc50', '#b48a14', '<rect x="82" y="34" width="58" height="48" rx="12" fill="rgba(255,255,255,.3)"/><path d="M92 36 C92 14 130 14 130 36" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="7"/><rect x="104" y="52" width="14" height="10" rx="3" fill="rgba(0,0,0,.18)"/>'],
    2: ['#4cdc7c', '#168a3a', '<circle cx="110" cy="50" r="36" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="7"/><path d="M74 50 H146" stroke="rgba(255,255,255,.3)" stroke-width="7"/><circle cx="110" cy="50" r="11" fill="rgba(255,255,255,.3)"/>'],
    3: ['#5ad8f4', '#1c72c4', '<g fill="rgba(255,255,255,.3)"><ellipse cx="90" cy="62" rx="11" ry="16"/><circle cx="82" cy="36" r="5"/><circle cx="91" cy="34" r="5"/><circle cx="100" cy="37" r="5"/><ellipse cx="136" cy="44" rx="11" ry="16"/><circle cx="128" cy="18" r="5"/><circle cx="137" cy="16" r="5"/><circle cx="146" cy="19" r="5"/></g>'],
  };
  function hexSvg(i) {
    const d = HEXD[i], P = '0,50 30,6 190,6 220,50 190,94 30,94', Q = '9,50 34,12 186,12 211,50 186,88 34,88';
    return '<svg viewBox="0 0 220 100" preserveAspectRatio="none"><defs><linearGradient id="hg' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + d[0] + '"/><stop offset="1" stop-color="' + d[1] + '"/></linearGradient><clipPath id="hc' + i + '"><polygon points="' + Q + '"/></clipPath></defs>' +
      '<polygon points="' + P + '" transform="translate(0 4)" fill="rgba(0,0,0,.4)"/>' +
      '<polygon points="' + P + '" fill="#171b28" stroke="#171b28" stroke-width="10" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<polygon points="' + P + '" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<polygon points="' + Q + '" fill="url(#hg' + i + ')" stroke="' + d[1] + '" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<g clip-path="url(#hc' + i + ')">' + d[2] + '<path d="M0 12 H220 V46 C150 56 70 38 0 52Z" fill="rgba(255,255,255,.2)"/></g></svg>';
  }
  function buildBattleHud() {
    const root = document.createElement('div'); root.id = 'pm-bh'; document.body.appendChild(root); BH.root = root;
    const lab = ['FIGHT', 'BAG', 'PARTY', 'RUN'];
    lab.forEach((t, i) => {
      const w = document.createElement('div'); w.className = 'bw c' + i + (i === 0 || i === 3 ? ' R' : ' L');
      w.innerHTML = hexSvg(i) + '<div class="tx">' + t + '</div><img class="ar" src="graphics/battle_scene/battle_arrow.png" alt="" onerror="this.parentNode.classList.add(\'noar\')">';
      root.appendChild(w); BH.els[i] = w;
      w.addEventListener('pointerdown', e => { e.preventDefault(); try { if (window.PMBattle) window.PMBattle.choose(i); } catch (x) { /* ignore */ } });
    });
    setInterval(() => {
      const st = window.PMBattle && window.PMBattle.state && window.PMBattle.state(), on = !!(st && st.on && st.mode === 'cmd' && PM.landscape && BH.geo);
      root.style.display = BH.geo && PM.landscape ? 'block' : 'none'; root.classList.toggle('on', on); if (!on) return;
      BH.els.forEach((w, i) => w.classList.toggle('sel', st.cmd === i));
    }, 70);
  }
  // docked to the main screen's edge (flat side against it, pointed side outward): POKéMON over BAG on the left, FIGHT over RUN on the right, all the same size
  // full hexagons tucked ~20% behind the main screen's edge (the screen covers that part): POKéMON over BAG on the left, FIGHT over RUN on the right, all one size
  function placeBattleHud(vx, vw, avail, y0, y1) {
    BH.geo = null; PM.hudOk = false; if (!BH.root) return;
    const zh = y1 - y0, W0 = Math.min(210, avail / .8), gap = 6, bh = Math.min(W0 * .58, (zh - gap) / 2), Wf = Math.min(W0, bh * 2.4);
    if (zh < 70 || W0 < 70 || bh < 30) return;
    BH.geo = 1; PM.hudOk = true;
    const ty = y0 + (zh - (bh * 2 + gap)) / 2, tuck = Wf * .2;
    const put = (el, x, y) => { Object.assign(el.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(Wf) + 'px', height: Math.round(bh) + 'px' }); el.style.setProperty('--fs', Math.max(10, Math.min(22, bh * .3)) + 'px'); };
    const lx = vx - Wf + tuck, rx = vx + vw - tuck;
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
    let u = Math.max(54, Math.min(portraitPhone ? 80 : 70, (portraitPhone ? W * .2 : Math.min(H * .24, (vx + 90)))) ) * cfg.size;
    if (!portraitPhone) { const gut = Math.min(vx - si.l, W - si.r - vx - vw); u = Math.max(40, Math.min(u, (gut + 14) / 2.5)); }   // phones: keep the button clusters inside the side gutters
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
    { const yTop = topRow + ph * 2 + 14, yBot = yMid - 6;
      if (portraitPhone) { BH.geo = null; PM.hudOk = false; }   // no room beside the screen when the phone is held upright: the battle then draws its own menu on the screen
      else placeBattleHud(vx, vw, Math.min(vx - si.l - 4, W - si.r - vx - vw - 4), yTop, yBot); }
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
