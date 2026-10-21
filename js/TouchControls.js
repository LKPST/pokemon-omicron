// js/TouchControls.js  -  on-screen buttons for phones / tablets (D-pad, A, B, Start, Bag, Talk).
// It sends the same key presses the keyboard does, so no game code changes. Shown only on touch devices (add ?touch=1 to the address to force it, ?touch=0 to hide it).
// Keys: D-pad = arrows (slide your thumb to change direction), A = Z (talk / confirm), B = X (back / cancel), START = Enter (menu), BAG = B, TALK = Space (your follower).
(function () {
  'use strict';
  const q = new URLSearchParams(location.search).get('touch');
  const isTouch = q === '1' || (q !== '0' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || matchMedia('(pointer: coarse)').matches));
  if (!isTouch) return;

  const KEY = {
    up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40], left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
    a: ['z', 'KeyZ', 90], b: ['x', 'KeyX', 88], start: ['Enter', 'Enter', 13], bag: ['b', 'KeyB', 66], talk: [' ', 'Space', 32],
  };
  const down = new Set();
  function fire(type, name) {
    const [key, code, kc] = KEY[name], e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, repeat: false });
    Object.defineProperty(e, 'keyCode', { get: () => kc }); Object.defineProperty(e, 'which', { get: () => kc });
    window.dispatchEvent(e);
  }
  const press = n => { if (down.has(n)) return; down.add(n); fire('keydown', n); if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } } };
  const release = n => { if (!down.has(n)) return; down.delete(n); fire('keyup', n); };

  const css = `
  html.tc, html.tc body { height: 100%; overflow: hidden; overscroll-behavior: none; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  html.tc body { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; height: 100dvh; background: #0d0d0d; }
  html.tc #game-container { width: min(100vw, calc((100dvh - 250px) * 480 / 620)); height: auto; aspect-ratio: 480 / 620; border: 0; border-radius: 0; box-shadow: none; flex: none; }
  #tc { flex: 1; width: 100%; min-height: 190px; position: relative; background: linear-gradient(#15161d, #0b0b10); touch-action: none; padding-bottom: env(safe-area-inset-bottom, 0px); }
  #tc .pad { position: absolute; left: 14px; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); width: 150px; height: 150px; border-radius: 50%; background: #20222e; box-shadow: inset 0 0 0 2px #323648; touch-action: none; }
  #tc .pad i { position: absolute; width: 0; height: 0; border: 12px solid transparent; transition: opacity .05s; opacity: .45; }
  #tc .pad i.on { opacity: 1; }
  #tc .pad .u { left: 51px; top: 12px; border-bottom: 18px solid #cfd6ee; border-top: 0; } #tc .pad .d { left: 51px; bottom: 12px; border-top: 18px solid #cfd6ee; border-bottom: 0; }
  #tc .pad .l { top: 51px; left: 12px; border-right: 18px solid #cfd6ee; border-left: 0; } #tc .pad .r { top: 51px; right: 12px; border-left: 18px solid #cfd6ee; border-right: 0; }
  #tc .btn { position: absolute; border-radius: 50%; background: #2a2d3d; color: #e8ecff; font: 700 20px/1 system-ui, sans-serif; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 2px #3e4360, 0 3px 0 #090a10; touch-action: none; }
  #tc .btn.on { background: #46d2c8; color: #08121a; transform: translateY(2px); box-shadow: inset 0 0 0 2px #8ff; }
  #tc .a { right: 18px; bottom: calc(76px + env(safe-area-inset-bottom, 0px)); width: 74px; height: 74px; } #tc .b { right: 100px; bottom: calc(30px + env(safe-area-inset-bottom, 0px)); width: 66px; height: 66px; }
  #tc .pill { border-radius: 14px; width: 74px; height: 34px; font-size: 12px; letter-spacing: .08em; }
  #tc .start, #tc .bag, #tc .talk { top: 12px; } #tc .talk { left: calc(50% - 119px); } #tc .bag { left: calc(50% - 37px); } #tc .start { left: calc(50% + 45px); }
  @media (max-width: 380px) { #tc .pad { transform: scale(.88); transform-origin: left bottom; } #tc .pill { width: 64px; } #tc .talk { left: calc(50% - 104px); } #tc .bag { left: calc(50% - 32px); } #tc .start { left: calc(50% + 40px); } }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.documentElement.classList.add('tc');

  function build() {
    const root = document.createElement('div'); root.id = 'tc';
    root.innerHTML = '<div class="pad"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i></div>' +
      '<div class="btn a" data-k="a">A</div><div class="btn b" data-k="b">B</div>' +
      '<div class="btn pill start" data-k="start">START</div><div class="btn pill bag" data-k="bag">BAG</div><div class="btn pill talk" data-k="talk">TALK</div>';
    document.body.appendChild(root);
    root.addEventListener('contextmenu', e => e.preventDefault());
    // buttons
    root.querySelectorAll('.btn').forEach(el => {
      const k = el.dataset.k;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('on'); press(k); });
      const up = e => { el.classList.remove('on'); release(k); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    });
    // d-pad: the direction follows the thumb
    const pad = root.querySelector('.pad'), arrows = { up: pad.querySelector('.u'), down: pad.querySelector('.d'), left: pad.querySelector('.l'), right: pad.querySelector('.r') };
    let cur = null;
    const set = d => { if (d === cur) return; if (cur) { release(cur); arrows[cur].classList.remove('on'); } cur = d; if (d) { press(d); arrows[d].classList.add('on'); } };
    const dirOf = e => { const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); if (Math.hypot(dx, dy) < r.width * 0.12) return null; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); pad.setPointerCapture(e.pointerId); set(dirOf(e)); });
    pad.addEventListener('pointermove', e => { if (pad.hasPointerCapture(e.pointerId)) set(dirOf(e)); });
    const end = () => set(null); pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
    // never leave a key stuck when the page loses focus
    window.addEventListener('blur', () => { set(null); [...down].forEach(release); });
    // block pinch / double-tap zoom and rubber-band scrolling
    ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
