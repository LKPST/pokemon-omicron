// ===========================================================================
// js/StartMenu.js     the START MENU (lower screen, animated) + RotomDex, Town Map, PokeNav, Aide's Log, Trainer card, Save, Options
//
// Load AFTER SaveSystem.js, PokedexTables.js, ItemSystem.js, BagMenu.js and PokemonSummary.js (and before the scenes start).
//
// OPEN IT   Enter (Start) in the overworld, or click one of the small buttons of the dock on the lower screen.
//           Keys in the menu: arrows / WASD = move, Z / Space = A, X / Esc / Backspace = B, Enter = close, Tab = ORDER (RotomDex).
//           Mouse / touch: click the tiles, the buttons, the red X.
//           Left / Right at the edge of the page flips to page 2 (PokeNav, Town Map, Aide's Log).
// SETTINGS  StartMenu.DOCK = true|false          the row of small buttons shown on the lower screen while the menu is closed
//           StartMenu.TOWNMAP = { image: 'assets/ui/town_map.png', pos: { 'Criscanto Town': [x, y], ... } }   your map picture + where each map is on it
//                                (without a picture the Town Map draws a schematic of all your maps)
//           StartMenu.LOGNAME = "AIDE'S LOG"       the name of the quest journal
// QUESTS    Quests.add(id, title, text, giver)  Quests.step(id, text, done)  Quests.complete(id)  Quests.remove(id)  (saved in saveData.quests)
//           script commands: addquest, addqueststep, completequest
// ===========================================================================
(function (root) {
'use strict';
const W = 240, H = 160;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const backOut = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------------------------------------------------------------- glyphs
// The map below is a copy of EmeraldFont.glyphMap (c = column of the 8x16 frames, r = row). If EmeraldFont is loaded in the
// game, ITS map is used, so a change in EmeraldFont.js is picked up. Characters it does not have come from EXTRA_GLYPHS.
const EMERALD_GLYPHS = {
  0:{c:2,r:10},1:{c:4,r:10},2:{c:6,r:10},3:{c:8,r:10},4:{c:10,r:10},5:{c:12,r:10},6:{c:14,r:10},7:{c:16,r:10},8:{c:18,r:10},9:{c:20,r:10},
  '!':{c:22,r:10},'?':{c:24,r:10},'.':{c:26,r:10},'-':{c:28,r:10},',':{c:16,r:11},
  A:{c:22,r:11},B:{c:24,r:11},C:{c:26,r:11},D:{c:28,r:11},E:{c:30,r:11},F:{c:0,r:12},G:{c:2,r:12},H:{c:4,r:12},I:{c:6,r:12},J:{c:8,r:12},
  K:{c:10,r:12},L:{c:12,r:12},M:{c:14,r:12},N:{c:16,r:12},O:{c:18,r:12},P:{c:20,r:12},Q:{c:22,r:12},R:{c:24,r:12},S:{c:26,r:12},T:{c:28,r:12},
  U:{c:30,r:12},V:{c:0,r:13},W:{c:2,r:13},X:{c:4,r:13},Y:{c:6,r:13},Z:{c:8,r:13},a:{c:10,r:13},b:{c:12,r:13},c:{c:14,r:13},d:{c:16,r:13},
  e:{c:18,r:13},f:{c:20,r:13},g:{c:22,r:13},h:{c:24,r:13},i:{c:26,r:13},j:{c:28,r:13},k:{c:30,r:13},l:{c:0,r:14},m:{c:2,r:14},n:{c:4,r:14},
  o:{c:6,r:14},p:{c:8,r:14},q:{c:10,r:14},r:{c:12,r:14},s:{c:14,r:14},t:{c:16,r:14},u:{c:18,r:14},v:{c:20,r:14},w:{c:22,r:14},x:{c:24,r:14},
  y:{c:26,r:14},z:{c:28,r:14},':':{c:0,r:15},'Ä':{c:0,r:15},'Ö':{c:2,r:15},'Ü':{c:4,r:15},'ä':{c:6,r:15},'ö':{c:8,r:15},'ü':{c:10,r:15},
  '/up/':{c:0,r:16},'/down/':{c:2,r:16},'/left/':{c:4,r:16},'/right/':{c:6,r:16},'+':{c:8,r:16},Lv:{c:10,r:16},PP:{c:12,r:16},ID:{c:14,r:16},
  '№':{c:16,r:16},_:{c:18,r:16},'(':{c:6,r:17},')':{c:8,r:17},'■':{c:10,r:17},'▲':{c:12,r:17},'✖':{c:14,r:17}
};
// From the Emerald character map (frame = row*32 + 2*(code%16), code = row*16 + column): what EmeraldFont.js does not list.
const EXTRA_GLYPHS = (() => {
  const g = {}, put = (ch, code) => { g[ch] = { r: code >> 4, c: 2 * (code & 15) }; };
  const run = (start, chars) => { let code = start; for (const ch of chars) put(ch, code++); };
  run(0x01, 'ÀÁÂÇÈÉÊËÌ'); run(0x0B, 'ÎÏÒÓÔŒÙÚÛÑß'); run(0x16, 'àá'); run(0x19, 'çèéêëì');
  run(0x20, 'îïòóôœùúûñºª'); run(0x2D, '&+'); run(0x35, '=;'); run(0x5A, 'Í%()');
  run(0xB0, '…“”‘’♂♀'); run(0xB8, ',×/');
  if (g['’']) g["'"] = g['’']; if (g['“']) g['"'] = g['“'];
  return g;
})();
const TOKENS = { Lv: 'Lv', PP: 'PP', ID: 'ID', No: '№' };
const pretty = s => String(s == null ? '' : s).replace(/^(MOVE|SPECIES|ABILITY|TYPE|ITEM|NATURE|RIBBON)_/, '').toLowerCase().split(/[_\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const BALL_BY_ID = { 1: 'poke', 2: 'great', 3: 'ultra', 4: 'master', 5: 'premier' };
const BALLS = { poke: ['#e83848', '#f8f8f8'], great: ['#3868e0', '#f8f8f8'], ultra: ['#f0c820', '#383848'], premier: ['#f8f8f8', '#f8f8f8'], master: ['#9038c8', '#f8f8f8'] };
const TYPE_COL = { Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f0c820', Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0', Ground: '#d8b858', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820', Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#a8a8c0', Fairy: '#ee99ac', Stellar: '#58b8c8' };
const TLAB = { Normal: 'NORMAL', Fire: 'FIRE', Water: 'WATER', Electric: 'ELECT', Grass: 'GRASS', Ice: 'ICE', Fighting: 'FIGHT', Poison: 'POISON', Ground: 'GROUND', Flying: 'FLYING', Psychic: 'PSYCH', Bug: 'BUG', Rock: 'ROCK', Ghost: 'GHOST', Dragon: 'DRAGON', Dark: 'DARK', Steel: 'STEEL', Fairy: 'FAIRY', Stellar: 'STELLR' };

function createStart(env) {
  const warnings = new Set();
  const urlFor = env.urlFor || (p => p);
  const opt = { cries: false, shinyFrame: false, frames: 'auto', nudge: 0 };

  // ------------------------------------------------ images
  const imgs = new Map(), failed = new Set();
  function getImg(path) {
    if (!path) return null;
    let e = imgs.get(path);
    if (!e) {
      e = { img: new Image(), ok: false, fail: false };
      e.img.onload = () => { e.ok = true; };
      e.img.onerror = () => { e.fail = true; if (!failed.has(path)) { failed.add(path); warnings.add('image not found: ' + path); try { console.warn('[Menu] could not load image: ' + path + '  (looked for it relative to your index.html)'); } catch (er) { /* no console */ } } };
      const u = urlFor(path);
      if (u) e.img.src = u; else e.fail = true;
      imgs.set(path, e);
    }
    return e;
  }

  // ------------------------------------------------ font
  let rawSheet = null, fontSrc = '', GLY = {};
  const FT = { top: 2, cap: 9 }, fontCache = new Map(), advCache = new Map();
  const loadImgP = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('load')); im.src = url; });
  function buildGlyphs() {
    let base = EMERALD_GLYPHS;
    try { const o = env.glyphs && env.glyphs(); if (o && typeof o === 'object') base = o; } catch (e) { /* keep the copy */ }
    GLY = Object.assign({}, EXTRA_GLYPHS, base); for (const k of Object.keys(GLY)) if (!GLY[k]) delete GLY[k];
  }
  function fallbackSheet() {   // only used when latin_short.png cannot be read: draws a plain pixel font
    const c = mk(256, 288), x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#f8f8f8'; x.fillRect(0, 0, 256, 288);
    const cell = mk(8, 16), cx = cell.getContext('2d', { willReadFrequently: true });
    const put = (gl, drawFn) => {
      cx.clearRect(0, 0, 8, 16); drawFn(cx);
      const d = cx.getImageData(0, 0, 8, 16).data, out = x.createImageData(8, 16), o = out.data, ink = new Uint8Array(128);
      for (let i = 0; i < 128; i++) ink[i] = d[i * 4 + 3] > 110 ? 1 : 0;
      for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 8; xx++) {
        const i = yy * 8 + xx; let v = 248;
        if (ink[i]) v = 0; else if ((xx > 0 && ink[i - 1]) || (yy > 0 && ink[i - 8]) || (xx > 0 && yy > 0 && ink[i - 9])) v = 170;
        o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = 255;
      }
      x.putImageData(out, gl.c * 8, gl.r * 16);
    };
    const txt = (s, size) => cx => { cx.font = `bold ${size}px "DejaVu Sans Mono","Courier New",monospace`; cx.fillStyle = '#000'; cx.fillText(s, 0, size === 10 ? 12 : 11); };
    for (const ch of Object.keys(GLY)) {
      const gl = GLY[ch];
      if (ch === 'Lv') put(gl, txt('Lv', 8)); else if (ch === 'PP') put(gl, txt('PP', 8)); else if (ch === 'ID') put(gl, txt('ID', 8)); else if (ch === '№') put(gl, txt('No', 8));
      else if (ch === '/up/' || ch === '/down/' || ch === '/left/' || ch === '/right/') {
        put(gl, cx => { cx.fillStyle = '#000'; cx.beginPath();
          if (ch === '/up/') { cx.moveTo(4, 3); cx.lineTo(8, 9); cx.lineTo(0, 9); } else if (ch === '/down/') { cx.moveTo(0, 4); cx.lineTo(8, 4); cx.lineTo(4, 10); }
          else if (ch === '/left/') { cx.moveTo(1, 6); cx.lineTo(6, 2); cx.lineTo(6, 10); } else { cx.moveTo(7, 6); cx.lineTo(2, 2); cx.lineTo(2, 10); }
          cx.closePath(); cx.fill(); });
      } else if (ch.length === 1) put(gl, txt(ch, 10));
    }
    return c;
  }
  function measureFont() {
    const gl = GLY['H'], d = rawSheet.getContext('2d', { willReadFrequently: true }).getImageData(gl.c * 8, gl.r * 16, 8, 16).data;
    let t = 99, b = -1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 110 && d[i + 3] > 0) { t = Math.min(t, y); b = Math.max(b, y); } }
    if (b < 0) { t = 2; b = 10; }
    FT.top = t; FT.cap = b - t + 1;
  }
  async function initFont() {
    buildGlyphs();
    let sheet = null, src = '';
    try {
      const fu = urlFor('graphics/fonts/latin_short.png'); if (!fu) throw new Error('none');
      const im = await loadImgP(fu), c = mk(im.width, im.height), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0); x.getImageData(0, 0, 1, 1); sheet = c; src = 'latin_short.png';
    } catch (e) { sheet = null; }
    if (!sheet) { sheet = fallbackSheet(); src = 'built-in fallback (latin_short.png not loaded)'; }
    rawSheet = sheet; fontSrc = src; fontCache.clear(); advCache.clear(); measureFont();
  }
  const hex4 = h => { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16), h.length > 6 ? parseInt(h.substr(6, 2), 16) : 255]; };
  function font(tc, sc) {
    const key = tc + '|' + sc; let f = fontCache.get(key); if (f) return f;
    const T = hex4(tc), S = hex4(sc), c = mk(rawSheet.width, rawSheet.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(rawSheet, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data, bgR = d[0], bgG = d[1], bgB = d[2];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (d[i + 3] === 0 || (r === bgR && g === bgG && b === bgB) || (r >= 245 && g >= 245 && b >= 245)) { d[i + 3] = 0; continue; }
      const q = (r + g + b) / 3 < 110 ? T : S; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = q[3];
    }
    x.putImageData(id, 0, 0); fontCache.set(key, c); return c;
  }
  const TX = { dark: ['#2a2a3a', '#b4bad0'], white: ['#ffffff', '#5a5e7c'], mute: ['#6a7396', '#cdd3e6'], blue: ['#2f64e0', '#a9bdf2'], red: ['#e0344f', '#f2aab8'], badge: ['#ffffff', '#00000070'] };
  // advance of a glyph: 6 px like EmeraldFont, a little more for the wide bitmap glyphs (Lv, PP, ID, arrows ...)
  function advOf(key) {
    if (advCache.has(key)) return advCache.get(key);
    let a = 6; const gl = GLY[key];
    if (gl && rawSheet) {
      const d = rawSheet.getContext('2d', { willReadFrequently: true }).getImageData(gl.c * 8, gl.r * 16, 8, 16).data, bgR = d[0], bgG = d[1], bgB = d[2];
      let mx = -1;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; if (d[i + 3] && !(d[i] === bgR && d[i + 1] === bgG && d[i + 2] === bgB) && !(d[i] >= 245 && d[i + 1] >= 245 && d[i + 2] >= 245)) mx = Math.max(mx, x); }
      if (mx >= 0) a = clamp(mx + 2, 6, 10);
    }
    advCache.set(key, a); return a;
  }
  function* glyphs(s) {
    s = String(s); let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '{') { const j = s.indexOf('}', i); if (j > 0) { const k = TOKENS[s.slice(i + 1, j)]; if (k && GLY[k]) { yield { gl: GLY[k], adv: advOf(k) }; i = j + 1; continue; } } }
      if (ch === '/') { const j = s.indexOf('/', i + 1); if (j > 0) { const tag = s.slice(i, j + 1); if (GLY[tag]) { yield { gl: GLY[tag], adv: advOf(tag) }; i = j + 1; continue; } } }
      if (ch === ' ') { yield { gl: null, adv: 5 }; i++; continue; }
      yield { gl: GLY[ch] || null, adv: 6 }; i++;
    }
  }
  const tw = s => { let w = 0; for (const g of glyphs(s)) w += g.adv; return w; };
  function T(c, s, x, y, k = 'dark') {
    const f = font(TX[k][0], TX[k][1]); let cx = x;
    for (const g of glyphs(s)) { if (g.gl) c.drawImage(f, g.gl.c * 8, g.gl.r * 16, 8, 16, cx, y - FT.top + opt.nudge, 8, 16); cx += g.adv; }
    return cx;
  }
  const TR = (c, s, xr, y, k) => T(c, s, xr - tw(s), y, k);

  // ------------------------------------------------ pixel helpers
  const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  function pill(c, x, y, w, h, col, R) {
    const r = Math.min(R ?? Math.floor(h / 2), Math.floor(h / 2), Math.floor(w / 2)); c.fillStyle = col;
    for (let row = 0; row < h; row++) {
      let dy = 0; if (row < r) dy = r - row - .5; else if (row >= h - r) dy = row - (h - r) + .5;
      const inset = dy ? r - Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))) : 0; c.fillRect(x + inset, y + row, w - 2 * inset, 1);
    }
  }
  function ell(c, cx, cy, rx, ry, col) { c.fillStyle = col; for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((ry + .5) * (ry + .5)))); c.fillRect(cx - w, cy + dy, w * 2, 1); } }
  function tri(c, x, cy, half, col) { c.fillStyle = col; for (let dy = -half; dy <= half; dy++) c.fillRect(x, cy + dy, half + 1 - Math.abs(dy), 1); }
  function ball(c, x, y, type, s = 1) {
    const [top, bot] = BALLS[type] || BALLS.poke;
    for (let py = 0; py < 9; py++) for (let px = 0; px < 9; px++) {
      const dx = px - 4, dy = py - 4, r2 = dx * dx + dy * dy; if (r2 > 20) continue;
      let col = r2 > 12 ? '#202030' : dy === 0 ? '#202030' : dy < 0 ? top : bot; if (r2 <= 2 && dy !== 0 || r2 <= 1) col = '#f8f8f8'; if (r2 === 2 && dy === 0) col = '#202030';
      c.fillStyle = col; c.fillRect(x + px * s, y + py * s, s, s);
    }
  }
  const STAR = ['..#..', '..#..', '#####', '.###.', '##.##'];
  function star(c, x, y) { c.fillStyle = '#f0b820'; STAR.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') c.fillRect(x + i, y + j, 1, 1); }); }

  // ------------------------------------------------ type icons (TypeTable) with a text fallback
  let keyedSheet = null, keyedFor = null;   // the type sheet with its top-left colour made transparent (TypeTable.bgKey)
  function typeSheet(TT) {
    const sh = getImg(TT.sheet); if (!sh || !sh.ok) return null;
    if (!TT.bgKey) return sh.img;
    if (keyedFor === sh.img && keyedSheet) return keyedSheet;
    try {
      const w = sh.img.naturalWidth, h = sh.img.naturalHeight, c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(sh.img, 0, 0); const id = x.getImageData(0, 0, w, h), d = id.data, r0 = d[0], g0 = d[1], b0 = d[2], tol = TT.bgTolerance || 0;
      if (d[3] === 255) for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) <= tol && Math.abs(d[i + 1] - g0) <= tol && Math.abs(d[i + 2] - b0) <= tol) d[i + 3] = 0;
      x.putImageData(id, 0, 0); keyedSheet = c; keyedFor = sh.img; return c;
    } catch (e) { return sh.img; }
  }
  const typeLabel = key => pretty(key);
  function badge(c, key, x, y) {
    const TT = env.types && env.types(), te = TT && TT.types && TT.types[key];
    if (te && te.icon && TT.sheet) {
      const src = typeSheet(TT);
      if (src) { c.imageSmoothingEnabled = false; c.drawImage(src, te.icon.x, te.icon.y, te.icon.w, te.icon.h, x, y, te.icon.w, te.icon.h); return te.icon.w; }
    }
    const nm = typeLabel(key), lab = (te && te.short ? te.short : TLAB[nm] || nm.toUpperCase().slice(0, 6)).toUpperCase(), w = tw(lab) + 4;
    pill(c, x, y + 1, w, 13, '#00000040'); pill(c, x, y, w, 13, (te && te.color) || TYPE_COL[nm] || '#a8a878'); T(c, lab, x + 2, y + 2, 'badge'); return w;
  }
  function badges(c, types, x, y) { let cx = x; for (const t of types.slice(0, 2)) cx += badge(c, t, cx, y) + 2; }
  const iconKeyed = new WeakMap();
  function keyedIcon(img, label) {
    if (iconKeyed.has(img)) return iconKeyed.get(img);
    let out = img, note = 'no opaque background found';
    try {
      const w = img.naturalWidth, h = img.naturalHeight, n = h >= w * 2 ? Math.round(h / w) : 1, fh = Math.floor(h / n), c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0); const id = x.getImageData(0, 0, w, h), d = id.data, seeds = [];
      for (let f = 0; f < n; f++) { const y0 = f * fh, y1 = y0 + fh - 1; for (let i = 0; i < w; i++) { seeds.push(y0 * w + i, y1 * w + i); } for (let j = y0; j <= y1; j++) seeds.push(j * w, j * w + w - 1); }
      const cnt = new Map(); for (const p of seeds) if (d[p * 4 + 3] === 255) { const k = ((d[p * 4] >> 4) << 8) | ((d[p * 4 + 1] >> 4) << 4) | (d[p * 4 + 2] >> 4), e = cnt.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += d[p * 4]; e.g += d[p * 4 + 1]; e.b += d[p * 4 + 2]; cnt.set(k, e); }
      const cands = []; const addC = (r, g, b) => { if (!cands.some(q => Math.abs(q[0] - r) <= 6 && Math.abs(q[1] - g) <= 6 && Math.abs(q[2] - b) <= 6)) cands.push([r, g, b]); };
      for (let f = 0; f < n; f++) { const p = f * fh * w; if (d[p * 4 + 3] === 255) addC(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]); }
      let top = null; for (const e of cnt.values()) if (!top || e.n > top.n) top = e; if (top) addC(Math.round(top.r / top.n), Math.round(top.g / top.n), Math.round(top.b / top.n));
      if (cands.length) {
        const tol = 18, seen = new Uint8Array(w * h), stack = [];
        const match = p => { if (d[p * 4 + 3] !== 255) return false; for (const q of cands) if (Math.abs(d[p * 4] - q[0]) <= tol && Math.abs(d[p * 4 + 1] - q[1]) <= tol && Math.abs(d[p * 4 + 2] - q[2]) <= tol) return true; return false; };
        const fOf = p => Math.min(n - 1, Math.floor(Math.floor(p / w) / fh));
        const push = p => { if (!seen[p] && match(p)) { seen[p] = 1; stack.push(p); } };
        for (const p of seeds) push(p);
        while (stack.length) { const p = stack.pop(), px = p % w, py = (p - px) / w, f0 = fOf(p); const tryP = q => { if (fOf(q) === f0) push(q); };
          if (px > 0) tryP(p - 1); if (px < w - 1) tryP(p + 1); if (py > 0) tryP(p - w); if (py < h - 1) tryP(p + w); }
        let cntR = 0; for (let p = 0; p < w * h; p++) if (seen[p]) { d[p * 4 + 3] = 0; cntR++; }
        x.putImageData(id, 0, 0); out = c; note = `${w}x${h}, ${n} frame(s), background ${cands.map(q => 'rgb(' + q.join(',') + ')').join(' / ')} removed, ${cntR} px`;
      }
    } catch (e) { out = img; note = 'could not process: ' + e.message; }
    try { console.log('[Menu] icon background: ' + (label || '') + ' -> ' + note); } catch (e) { /* no console */ }
    iconKeyed.set(img, out); return out;
  }
  // ===================================================================== START MENU (bottom screen) + sub screens (top screen)
  const BW = 240, TH = 160; let BH = (env.bottomH && env.bottomH()) || 148;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = { out: p => 1 - Math.pow(1 - clamp(p), 3), back: p => { p = clamp(p); const c = 2.70158; return 1 + c * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2); }, io: p => { p = clamp(p); return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; } };
  TX.gold = ['#ffd23c', '#5a4210']; TX.cream = ['#f4e9d8', '#7a3a30']; TX.navy = ['#1b2338', '#aab4d0']; TX.rwhite = ['#ffffff', '#8a1820']; TX.grey = ['#8a93ab', '#222838'];
  const LOG_NAME = () => (env.logName && env.logName()) || "AIDE'S LOG";
  const P1 = [['pokemon', 'POKéMON', '#e03c3c'], ['dex', 'ROTOMDEX', '#d83038'], ['bag', 'BAG', '#3aa0e8'], ['card', '', '#f0902c'], ['save', 'SAVE', '#8a4ad8'], ['options', 'OPTIONS', '#36c070']];
  const P2 = [['nav', 'POKéNAV', '#9aa6c0'], ['map', 'TOWN MAP', '#58b868'], ['log', LOG_NAME(), '#e8c838']];
  const PAGES = [P1, P2];
  const S = { open: false, closing: false, since: 0, t: 0, scr: 'menu', page: 0, sel: 0, pageAnim: null, child: false, hit: [], msg: null,
    look: { x: 0, y: 0, tx: 0, ty: 0 }, blink: 0, nextBlink: 2.5, bgSeed: 0 };
  const sys = () => env.sys && env.sys();
  const party = () => (env.party && env.party()) || [];
  const dbOf = sp => { const d = env.db && env.db(); return (d && (d[sp] || d[String(sp).replace(/_[MF]$/, '')])) || {}; };
  const saveData = () => (env.saveData && env.saveData()) || {};
  const SS = () => env.save && env.save();
  const now = () => new Date();
  const two = n => String(n).padStart(2, '0');
  const fmtTime = s => Math.floor(s / 3600) + ':' + two(Math.floor(s / 60) % 60);

  // ------------------------------------------------------------ tiny pixel helpers (rounded rects, slanted tiles, icons)
  function rr(c, x, y, w, h, r, col) { pill(c, Math.round(x), Math.round(y), Math.round(w), Math.round(h), col, r); }
  function grad(c, x, y, w, h, a, b) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x, y, w, h); }
  function slant(c, x, y, w, h, sl, col) { c.fillStyle = col; for (let r = 0; r < h; r++) { const o = Math.round(sl * (1 - r / h)); c.fillRect(x + o, y + r, w - sl, 1); } }
  function wrapText(text, wpx) {
    const out = [];
    for (const raw of String(text || '').split('\n')) { let line = ''; for (const w of raw.split(' ')) { const t = line ? line + ' ' + w : w; if (tw(t) > wpx && line) { out.push(line); line = w; } else line = t; } out.push(line); }
    return out;
  }
  const getSprite = path => { const e = path && getImg(path); return e && e.ok ? e.img : null; };
  function drawFit(c, im, x, y, bw, bh, maxS) {
    if (!im) return false; const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; let s = Math.min(bw / iw, bh / ih); if (maxS) s = Math.min(s, maxS); if (s >= 1) s = Math.floor(s);
    const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s)); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, iw, ih, Math.round(x + (bw - w) / 2), Math.round(y + (bh - h) / 2), w, h); return true;
  }
  // first frame of a sprite sheet (frames are stacked when the sheet is at least twice as tall as wide), background removed
  function monFrame(path) {
    const e = path && getImg(path); if (!e || !e.ok) return null; const iw = e.img.naturalWidth, ih = e.img.naturalHeight, n = ih >= iw * 2 ? Math.round(ih / iw) : 1, fh = Math.floor(ih / n);
    return { img: keyedIcon(e.img, path), w: iw, h: fh, key: path };
  }
  const silCache = new Map();
  function silhouette(f) {
    let s = silCache.get(f.key); if (s) return s; s = mk(f.w, f.h); const x = s.getContext('2d'); x.drawImage(f.img, 0, 0, f.w, f.h, 0, 0, f.w, f.h); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#1a2030'; x.fillRect(0, 0, f.w, f.h); silCache.set(f.key, s); return s;
  }
  function drawMonSprite(c, f, x, y, bw, bh, sil) {
    if (!f) return; const src = sil ? silhouette(f) : f.img; let s = Math.min(bw / f.w, bh / f.h); if (s >= 1) s = Math.floor(s); const w = Math.round(f.w * s), h = Math.round(f.h * s);
    c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, f.w, f.h, Math.round(x + (bw - w) / 2), Math.round(y + bh - h), w, h);
  }

  // ------------------------------------------------------------ icons (procedural, 22x22 box centred on cx, cy)
  function icon(c, id, cx, cy, t, sel) {
    const x = Math.round(cx - 11), y = Math.round(cy - 11 + (sel ? Math.sin(t * 5) * 1.2 : 0));
    const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
    if (id === 'pokemon') { ell(c, cx, cy, 10, 10, '#1c1c28'); for (let dy = -9; dy <= 9; dy++) { const w = Math.round(Math.sqrt(81 - dy * dy)); c.fillStyle = dy < 0 ? '#e83848' : '#f4f4f8'; c.fillRect(cx - w, Math.round(y + 11 + dy), w * 2, 1); } R(0, 10, 22, 2, '#1c1c28'); ell(c, cx, y + 11, 4, 4, '#1c1c28'); ell(c, cx, y + 11, 2, 2, '#f4f4f8'); }
    else if (id === 'dex') { rr(c, x + 3, y, 16, 22, 3, '#7a1018'); rr(c, x + 4, y + 1, 14, 20, 3, '#e03c48'); R(6, 3, 10, 8, '#1c2a40'); R(7, 4, 8, 6, '#58b0f0'); R(7, 14, 3, 3, '#f4f4f8'); R(12, 14, 3, 3, '#ffd23c'); R(7, 18, 8, 1, '#7a1018'); }
    else if (id === 'bag') { rr(c, x + 2, y + 5, 18, 16, 5, '#14406e'); rr(c, x + 3, y + 6, 16, 14, 5, '#3aa0e8'); R(7, 1, 8, 5, '#14406e'); R(9, 3, 4, 3, '#0c1e34'); R(5, 12, 12, 2, '#14406e'); R(9, 11, 4, 4, '#ffd23c'); }
    else if (id === 'card') { rr(c, x, y + 3, 22, 16, 3, '#9a4a08'); rr(c, x + 1, y + 4, 20, 14, 3, '#f0902c'); R(3, 7, 7, 8, '#fff2d8'); ell(c, x + 6, y + 10, 2, 2, '#9a4a08'); R(4, 13, 5, 2, '#9a4a08'); R(12, 8, 7, 2, '#fff2d8'); R(12, 12, 7, 2, '#fff2d8'); }
    else if (id === 'save') { rr(c, x + 1, y + 2, 19, 18, 2, '#3a1c78'); R(3, 4, 15, 14, '#f4f0fc'); R(4, 6, 12, 1, '#a898d0'); R(4, 9, 12, 1, '#a898d0'); R(4, 12, 9, 1, '#a898d0'); R(16, 1, 3, 12, '#ffd23c'); R(16, 12, 3, 2, '#d03848'); }
    else if (id === 'options') { rr(c, x, y + 2, 22, 18, 3, '#14603a'); rr(c, x + 1, y + 3, 20, 16, 3, '#36c070'); R(4, 7, 14, 3, '#f4fff8'); R(4, 13, 14, 3, '#f4fff8'); R(13, 6, 4, 5, '#14603a'); R(6, 12, 4, 5, '#14603a'); }
    else if (id === 'nav') { rr(c, x + 3, y, 16, 22, 3, '#3a4258'); rr(c, x + 4, y + 1, 14, 20, 3, '#9aa6c0'); R(6, 3, 10, 9, '#1c2438'); R(8, 5, 6, 5, '#f06888'); R(7, 15, 3, 3, '#fff'); R(12, 15, 3, 3, '#fff'); }
    else if (id === 'map') { R(0, 3, 22, 16, '#14502c'); R(1, 4, 6, 14, '#58b868'); R(8, 4, 6, 14, '#88d098'); R(15, 4, 6, 14, '#58b868'); R(2, 9, 5, 3, '#3a88d8'); R(16, 12, 4, 3, '#3a88d8'); ell(c, x + 12, y + 9, 3, 3, '#e03c3c'); R(11, 11, 2, 5, '#e03c3c'); }
    else if (id === 'log') { rr(c, x + 2, y, 18, 22, 2, '#7a5e08'); R(4, 2, 14, 18, '#fff4c0'); R(4, 2, 3, 18, '#e8c838'); R(8, 5, 8, 1, '#a89048'); R(8, 8, 8, 1, '#a89048'); R(8, 11, 6, 1, '#a89048'); R(14, 0, 4, 9, '#d03848'); }
  }

  // ------------------------------------------------------------ animated background of the menu (drifting stripes + rising bubbles + a soft glow)
  function menuBg(c, W2, H2, t) {
    grad(c, 0, 0, W2, H2, '#1a1e2c', '#0c0e16');
    c.save(); c.beginPath(); c.rect(0, 0, W2, H2); c.clip();
    const off = (t * 9) % 36; c.fillStyle = 'rgba(120,140,200,.055)';
    for (let k = -8; k < W2 / 18 + 8; k++) { const x0 = k * 36 + off - H2; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 14, 0); c.lineTo(x0 + 14 + H2, H2); c.lineTo(x0 + H2, H2); c.closePath(); c.fill(); }
    for (let i = 0; i < 9; i++) { const sp = 6 + (i * 7) % 9, px = (i * 53 + 17) % W2, py = H2 + 14 - ((t * sp + i * 41) % (H2 + 28)), r = 4 + (i * 5) % 9, a = .05 + (i % 3) * .015;
      c.strokeStyle = 'rgba(190,205,255,' + a * 2.2 + ')'; c.lineWidth = 1; c.beginPath(); c.arc(px + Math.sin(t * .7 + i) * 4, py, r, 0, 6.2832); c.stroke();
      c.fillStyle = 'rgba(190,205,255,' + a + ')'; c.beginPath(); c.arc(px + Math.sin(t * .7 + i) * 4, py, r - 1, 0, 6.2832); c.fill(); }
    const gx = W2 / 2 + Math.sin(t * .4) * W2 * .3, g = c.createRadialGradient(gx, H2 * .4, 4, gx, H2 * .4, W2 * .6); g.addColorStop(0, 'rgba(80,110,200,.16)'); g.addColorStop(1, 'rgba(80,110,200,0)'); c.fillStyle = g; c.fillRect(0, 0, W2, H2);
    c.restore();
  }
  function statusBar(c, p) {
    const y0 = -Math.round((1 - p) * 14); rect(c, 0, y0, BW, 12, '#0a0c12'); rect(c, 0, y0 + 12, BW, 1, '#2c3242');
    const d = now(), ck = two(d.getHours()) + ':' + two(d.getMinutes()); T(c, ck, 6, y0 + 1, 'white');
    let x = 52; for (const l of ['IR', 'ONLINE', 'WIRELESS']) { rect(c, x, y0 + 5, 2, 2, '#6a7396'); T(c, l, x + 5, y0 + 1, 'mute'); x += tw(l) + 13; }
    rr(c, BW - 18, y0 + 2, 11, 8, 2, '#cfd6ea'); rect(c, BW - 7, y0 + 4, 2, 4, '#cfd6ea'); rect(c, BW - 16, y0 + 4, 7, 4, '#2a2e3e'); rect(c, BW - 16, y0 + 4, 5, 4, '#58c868');
  }

  // ------------------------------------------------------------ the menu
  const TW = 113, THt = 34;
  function tileRect(i) { const col = i % 2, row = Math.floor(i / 2); return { x: 5 + col * 118, y: 16 + row * (THt + 3), w: TW, h: THt }; }
  function tileLabel(def) { if (def[0] === 'card') return (saveData().player && saveData().player.name) || 'PLAYER'; return def[1]; }
  function drawTile(c, i, def, selected, dx, anim) {
    const r = tileRect(i); let x = r.x + dx, y = r.y; const a = clamp(anim); if (a <= 0) return;
    const col = i % 2; x += Math.round((1 - ease.back(a)) * (col ? 130 : -130)); c.save(); c.globalAlpha = clamp(a * 1.6);
    const pulse = selected ? .5 + .5 * Math.sin(S.t * 6) : 0;
    slant(c, x - 1, y - 1, r.w + 2, r.h + 2, 7, selected ? '#ffffff' : '#0a0c12'); slant(c, x, y, r.w, r.h, 7, selected ? '#2e3548' : '#171a24'); slant(c, x + 1, y + 1, r.w - 2, Math.floor((r.h - 2) / 2), 7, selected ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.04)');
    if (selected) { c.strokeStyle = 'rgba(255,230,120,' + (.35 + pulse * .5) + ')'; c.lineWidth = 1; c.strokeRect(x + 1.5, y + 1.5, r.w - 3, r.h - 3); }
    rr(c, x + 5, y + 5, 26, 24, 4, selected ? '#0c0e16' : '#0e1018'); icon(c, def[0], x + 18, y + 17, S.t + i, selected);
    T(c, tileLabel(def), x + 38, Math.round(y + (r.h - FT.cap) / 2), selected ? 'white' : 'grey');
    if (def[0] === 'save' && SS() && SS().dirty) { rect(c, x + r.w - 12, y + 6, 5, 5, '#ffd23c'); }
    if (selected) { c.save(); c.beginPath(); c.rect(x, y, r.w, r.h); c.clip(); const sx = x - 30 + ((S.t * 70) % (r.w + 90)); c.fillStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.moveTo(sx, y + r.h); c.lineTo(sx + 12, y + r.h); c.lineTo(sx + 34, y); c.lineTo(sx + 22, y); c.fill(); c.restore(); }
    c.restore();
  }
  function closeBtnRect() { return { x: BW - 27, y: BH - 17, w: 22, h: 14 }; }
  function drawBottomBar(c, p) {
    const y0 = BH - 17 + Math.round((1 - p) * 20); rect(c, 0, y0 - 1, BW, 1, '#2c3242'); rect(c, 0, y0, BW, 20, '#0a0c12');
    const r = closeBtnRect(); const xr = r.x, yr = y0 + 2; c.strokeStyle = '#e8403c'; c.lineWidth = 3; c.beginPath(); c.moveTo(xr + 5, yr + 2); c.lineTo(xr + 17, yr + 12); c.moveTo(xr + 17, yr + 2); c.lineTo(xr + 5, yr + 12); c.stroke();
    for (let i = 0; i < PAGES.length; i++) { rr(c, BW / 2 - 8 + i * 10, y0 + 6, i === S.page ? 8 : 5, 5, 2, i === S.page ? '#ffffff' : '#4a5270'); }
    if (S.page > 0) tri(c, 12, y0 + 8, 4, '#cfd6ea'); if (S.page < PAGES.length - 1) { c.fillStyle = '#cfd6ea'; for (let dy = -4; dy <= 4; dy++) c.fillRect(BW - 60 - (5 - Math.abs(dy)), y0 + 8 + dy, 5 - Math.abs(dy), 1); }
  }
  function renderMenu(c) {
    const p = ease.out(S.since / .35), closeP = S.closing ? 1 - clamp(S.closeT / .25) : 1;
    menuBg(c, BW, BH, S.t); statusBar(c, p * closeP); const pg = PAGES[S.page];
    if (S.pageAnim) {
      const a = ease.io(S.pageAnim.t / .28), d = S.pageAnim.dir, old = PAGES[S.pageAnim.from];
      old.forEach((def, i) => drawTile(c, i, def, false, -d * Math.round(a * 250), 1)); pg.forEach((def, i) => drawTile(c, i, def, i === S.sel, d * Math.round((1 - a) * 250), 1));
    } else pg.forEach((def, i) => drawTile(c, i, def, i === S.sel && S.scr === 'menu', 0, S.closing ? closeP : (S.since - i * .06) / .4));
    drawBottomBar(c, p * closeP);
    if (S.scr === 'menu' && !S.child) { /* hint line */ }
  }
  function openScreen(id) {
    S.scr = id; S.sub = null;
    if (SCREENS[id]) { S.sub = SCREENS[id]; S.sub.enter && S.sub.enter(); }
  }
  function activate(def) {
    const id = def[0];
    if (id === 'pokemon') { S.child = true; env.openChild('summary', () => { S.child = false; }); }
    else if (id === 'bag') { S.child = true; env.openChild('bag', () => { S.child = false; }); }
    else openScreen(id);
  }
  function pressMenu(k) {
    const pg = PAGES[S.page];
    if (S.pageAnim) return;
    if (k === 'b') return requestClose();
    if (k === 'a') return activate(pg[S.sel]);
    const n = pg.length;
    if (k === 'left' || k === 'right') {
      const col = S.sel % 2;
      if (k === 'left' && col === 0 && S.page > 0) return changePage(-1);
      if (k === 'right' && (col === 1 || S.sel + 1 >= n) && S.page < PAGES.length - 1) return changePage(1);
      if (k === 'left' && col === 1) S.sel--; else if (k === 'right' && col === 0 && S.sel + 1 < n) S.sel++;
    } else if (k === 'up') { if (S.sel >= 2) S.sel -= 2; } else if (k === 'down') { if (S.sel + 2 < n) S.sel += 2; else if (S.sel + 2 === n + 1 - 1 && S.sel + 1 < n) S.sel = n - 1; }
  }
  function changePage(d) { const from = S.page; S.page = clamp(S.page + d, 0, PAGES.length - 1); S.sel = Math.min(S.sel % 2 === 0 ? 0 : 1, PAGES[S.page].length - 1); if (d > 0 && S.sel === 1 && PAGES[S.page].length < 2) S.sel = 0; S.pageAnim = { from, dir: d, t: 0 }; }
  function requestClose() { if (S.closing) return; S.closing = true; S.closeT = 0; }
  function clickMenu(x, y) {
    if (S.pageAnim) return; const cb = closeBtnRect();
    if (x >= cb.x - 4 && y >= cb.y - 4 && x <= cb.x + cb.w + 4 && y <= cb.y + cb.h + 4) return requestClose();
    if (y >= BH - 18) { if (x < BW / 2 - 20 && S.page > 0) return changePage(-1); if (x > BW / 2 + 20 && x < BW - 32 && S.page < PAGES.length - 1) return changePage(1); return; }
    const pg = PAGES[S.page]; for (let i = 0; i < pg.length; i++) { const r = tileRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { if (S.sel === i) activate(pg[i]); else { S.sel = i; activate(pg[i]); } return; } }
  }

  // ===================================================================== shared helpers for the sub screens
  const SCREENS = {};
  const flagsOf = () => (env.flags && env.flags()) || {};
  const btn = (c, x, y, w, h, label, f, col, on) => {
    S.hit.push({ x, y, w, h, f }); col = col || '#2e3548'; const hot = on || (S.press_ && S.press_.f === f);
    slant(c, x - 1, y - 1, w + 2, h + 2, 5, hot ? '#ffffff' : '#0a0c12'); slant(c, x, y, w, h, 5, col); slant(c, x + 1, y + 1, w - 2, Math.floor(h / 2) - 1, 5, 'rgba(255,255,255,.10)');
    T(c, label, Math.round(x + (w - tw(label)) / 2), Math.round(y + (h - FT.cap) / 2), 'white');
  };
  function botGeneric(c, hint, extra) {
    S.hit = []; menuBg(c, BW, BH, S.t); statusBar(c, 1);
    if (hint) { const ls = wrapText(hint, 210); ls.forEach((l, i) => T(c, l, 15, 30 + i * 13, 'mute')); }
    if (extra) extra(c);
    btn(c, BW - 74, BH - 24, 68, 18, 'B  BACK', () => back(), '#4a2030');
  }
  function back() { S.scr = 'menu'; S.sub = null; }
  function wobbly(t, a, s) { return Math.sin(t * s) * a; }
  // ---- the RotomDex body (red body + big eyes). Returns the screen rectangle.
  function rotomFrame(c, mood) {
    grad(c, 0, 0, BW, TH, '#5c0c14', '#3a0810');
    const off = (S.t * 8) % 16; c.fillStyle = 'rgba(255,255,255,.035)'; for (let k = -10; k < 20; k++) { const x0 = k * 16 + off; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 6, 0); c.lineTo(x0 + 6 - TH / 2, TH); c.lineTo(x0 - TH / 2, TH); c.closePath(); c.fill(); }
    rr(c, 1, 1, 238, 158, 11, '#2c0509'); rr(c, 2, 2, 236, 156, 10, '#d02c3a'); rr(c, 2, 2, 236, 60, 10, '#e4465a'); rect(c, 4, 40, 232, 20, '#d02c3a'); rect(c, 5, 5, 230, 1, '#f48a98');
    // lightning bolts on the sides
    for (const sx of [0, 1]) { const bx = sx ? 224 : 8; c.fillStyle = '#ffd23c'; for (let r = 0; r < 12; r++) { const o = Math.round(Math.sin(r * 1.1) * 2); c.fillRect(bx + o + (sx ? -r % 3 : r % 3), 8 + r, 4, 1); } }
    // eyes
    const L = S.look; L.x += (L.tx - L.x) * .12; L.y += (L.ty - L.y) * .12; S.blink = Math.max(0, S.blink - 1 / 60);
    if (S.t > S.nextBlink) { S.blink = .16; S.nextBlink = S.t + 2 + (Math.sin(S.t * 3.7) + 1) * 1.8; }
    const closed = S.blink > 0, happy = mood === 'happy' || S.happy > S.t;
    for (const ex of [74, 166]) {
      ell(c, ex, 20, 25, 15, '#2c0509'); ell(c, ex, 20, 24, 14, '#fff6f0');
      if (closed || happy) { ell(c, ex, 20, 24, 14, '#d02c3a'); ell(c, ex, 20, 25, 15, '#2c0509'); ell(c, ex, 20, 24, 14, '#e4465a'); c.fillStyle = '#2c0509'; if (happy) { for (let k = -13; k <= 13; k++) c.fillRect(ex + k, 22 - Math.round(Math.sqrt(Math.max(0, 169 - k * k)) * .55), 1, 3); } else c.fillRect(ex - 14, 21, 29, 2); }
      else { const px = Math.round(ex + L.x * 9), py = Math.round(20 + L.y * 5); ell(c, px, py, 9, 9, '#14182c'); ell(c, px, py, 7, 7, '#2a3a78'); ell(c, px, py, 4, 4, '#0a0c18'); rect(c, px - 3, py - 4, 3, 3, '#ffffff'); rect(c, px + 2, py + 2, 2, 2, 'rgba(255,255,255,.7)'); }
    }
    // nose-mouth between the eyes
    rect(c, 118, 14, 4, 3, '#ffd23c'); rect(c, 117, 17, 6, 2, '#ffd23c'); rect(c, 119, 19, 4, 2, '#ffd23c'); rect(c, 116, 21, 5, 2, '#ffd23c');
    rr(c, 8, 32, 224, 124, 7, '#2c0509'); rr(c, 9, 33, 222, 122, 6, '#0c1018');
    return { x: 11, y: 35, w: 218, h: 118 };
  }
  function lookTo(dx, dy) { S.lookHold = S.t + 1.2; S.look.tx = clamp(dx, -1, 1); S.look.ty = clamp(dy, -1, 1); }
  function lookIdle() { if (Math.abs(S.look.tx) < .01 && Math.abs(S.look.ty) < .01) { /* wander */ } else { S.look.tx *= .96; S.look.ty *= .96; } }

  // ===================================================================== TRAINER CARD
  function badgeFlag(i) { const f = flagsOf(); return !!(f['FLAG_BADGE0' + i + '_GET'] || f['FLAG_BADGE' + i + '_GET'] || f['FLAG_BADGE' + two(i) + '_GET'] || f['BADGE_' + i]); }
  SCREENS.card = {
    top(c) {
      const inf = SS() ? SS().info() : { name: 'Player', money: 0, badges: 0, playTime: 0, dexSeen: 0, dexCaught: 0 }, sv = saveData(), p = sv.player || {};
      grad(c, 0, 0, BW, TH, '#10204a', '#06101e');
      const off = (S.t * 14) % 24; c.fillStyle = 'rgba(120,160,255,.06)'; for (let k = -6; k < 16; k++) c.fillRect(k * 24 + off, 0, 10, TH);
      rr(c, 6, 6, 228, 148, 8, '#d8a020'); rr(c, 8, 8, 224, 144, 7, '#1c3a8a'); rr(c, 8, 8, 224, 20, 7, '#2a54c0'); rect(c, 8, 20, 224, 8, '#2a54c0');
      T(c, 'TRAINER CARD', 16, 12, 'white'); TR(c, 'ID No.' + String(inf.id || 0).padStart(5, '0'), 224, 12, 'gold');
      const row = (lab, val, y) => { T(c, lab, 16, y, 'gold'); TR(c, val, 150, y, 'white'); };
      row('NAME', String(p.name || inf.name).toUpperCase(), 36); row('MONEY', String(+p.money || 0), 51); row('POKéDEX', inf.dexCaught + ' / ' + inf.dexSeen, 66); row('TIME', fmtTime(inf.playTime), 81);
      rr(c, 156, 33, 70, 66, 4, '#0c1a46'); const pt = party(); let n = 0;
      for (let i = 0; i < 6; i++) { const m = pt[i], gx = 160 + (i % 3) * 22, gy = 36 + Math.floor(i / 3) * 30; if (m && m.species) { const pp = dbOf(m.species).iconSprite, f = monFrame(pp); if (f) { c.imageSmoothingEnabled = false; const s = 20 / Math.max(f.w, f.h); c.drawImage(f.img, 0, 0, f.w, f.h, gx, gy + (i % 2 ? Math.round(Math.sin(S.t * 6 + i) + 1) : 0), Math.round(f.w * s), Math.round(f.h * s)); } else ball(c, gx + 5, gy + 5, 'poke', 1); n++; } }
      T(c, 'BADGES', 16, 100, 'gold');
      for (let i = 1; i <= 8; i++) { const x = 16 + (i - 1) * 27, y = 114, got = badgeFlag(i) || (inf.badges >= i && !Object.keys(flagsOf()).some(k => /BADGE/.test(k) && false));
        rr(c, x, y, 24, 30, 4, '#0c1a46'); ell(c, x + 12, y + 14, 8, 8, got ? ['#e8d048', '#e86838', '#58b8e8', '#98d048', '#d870d8', '#f0f0f0', '#e84848', '#8868e8'][i - 1] : '#26346a');
        if (got) { rect(c, x + 8, y + 9, 3, 2, 'rgba(255,255,255,.8)'); const sh = ((S.t * 40 + i * 20) % 120) - 20; if (sh > 0 && sh < 24) rect(c, x + sh, y + 4, 2, 20, 'rgba(255,255,255,.25)'); } else T(c, String(i), x + 9, y + 10, 'grey'); T(c, '', x, y, 'white'); }
    },
    bot(c) { botGeneric(c, 'Your trainer card. Badges light up as you earn them.'); },
    press(k) { if (k === 'b' || k === 'a') back(); }, click() {},
  };

  // ===================================================================== SAVE
  const SV = { stage: 'ask', i: 0, t: 0, ok: true };
  SCREENS.save = {
    enter() { SV.stage = 'ask'; SV.i = 0; SV.t = 0; },
    top(c) {
      const inf = SS() ? SS().info() : { name: 'Player', badges: 0, playTime: 0, dexCaught: 0, map: '' };
      grad(c, 0, 0, BW, TH, '#241a48', '#0c0820');
      const off = (S.t * 20) % 40; c.fillStyle = 'rgba(190,160,255,.06)'; for (let k = -6; k < 12; k++) { c.fillRect(0, k * 40 + off, BW, 14); }
      rr(c, 8, 8, 224, 90, 6, '#f4f0fc'); rr(c, 10, 10, 220, 86, 5, '#2c2358'); T(c, 'SAVE GAME', 18, 14, 'gold');
      const row = (lab, val, y) => { T(c, lab, 18, y, 'mute'); TR(c, val, 222, y, 'white'); };
      row('PLAYER', String(inf.name).toUpperCase(), 32); row('LOCATION', String(inf.map || '—').toUpperCase().slice(0, 22), 45); row('BADGES', String(inf.badges), 58); row('POKéDEX', String(inf.dexCaught), 71); row('TIME', fmtTime(inf.playTime), 84);
      rr(c, 8, 104, 224, 48, 6, '#f4f0fc'); rr(c, 10, 106, 220, 44, 5, '#0c0e1c');
      let msg = ['Would you like to save', 'your progress?'];
      if (SS() && !SS().dirty && SS().savedAt) msg = ['No changes since the last save.', 'Save anyway?'];
      if (SV.stage === 'saving') { const d = '.'.repeat(1 + Math.floor(SV.t * 4) % 3); msg = ['Saving' + d, "Don't close the game."]; c.fillStyle = '#ffd23c'; for (let k = 0; k < 8; k++) { const a = SV.t * 8 + k * .785; c.globalAlpha = .25 + .75 * ((k / 8)); c.fillRect(Math.round(212 + Math.cos(a) * 8), Math.round(128 + Math.sin(a) * 8), 3, 3); } c.globalAlpha = 1; }
      if (SV.stage === 'done') msg = SV.ok ? [String(inf.name).toUpperCase() + ' saved the game!', ''] : ['Could not save!', (SS() && SS().lastError || 'Storage is blocked').slice(0, 30)];
      msg.forEach((l, i) => T(c, l, 18, 114 + i * 14, 'white'));
      if (SV.stage === 'done' && SV.ok) { const s = Math.min(1, SV.t * 4); ell(c, 212, 126, Math.round(10 * s), Math.round(10 * s), '#36c070'); if (s >= 1) { rect(c, 207, 126, 3, 2, '#fff'); rect(c, 209, 128, 3, 2, '#fff'); rect(c, 211, 126, 3, 2, '#fff'); rect(c, 213, 124, 3, 2, '#fff'); } }
    },
    bot(c) {
      botGeneric(c, SV.stage === 'ask' ? 'Progress is only kept when you save. Unsaved changes are lost if you close the page.' : '', cc => {
        if (SV.stage === 'ask') { btn(cc, 30, 70, 84, 34, 'YES', () => SCREENS.save.yes(), '#2c5a3a', SV.i === 0); btn(cc, 126, 70, 84, 34, 'NO', () => back(), '#5a2c2c', SV.i === 1); }
        if (SV.stage === 'done') btn(cc, 76, 70, 88, 34, 'OK', () => back(), '#2e3548', true);
      });
    },
    yes() { if (SV.stage !== 'ask') return; SV.stage = 'saving'; SV.t = 0; },
    tick(dt) { SV.t += dt; if (SV.stage === 'saving' && SV.t > 1.1) { SV.ok = SS() ? SS().save(env.scene && env.scene()) : false; SV.stage = 'done'; SV.t = 0; } },
    press(k) {
      if (SV.stage === 'ask') { if (k === 'left' || k === 'right' || k === 'up' || k === 'down') SV.i = 1 - SV.i; else if (k === 'a') { if (SV.i === 0) this.yes(); else back(); } else if (k === 'b') back(); }
      else if (SV.stage === 'done' && (k === 'a' || k === 'b')) back();
    },
  };

  // ===================================================================== OPTIONS
  const OP = { i: 0, msg: '', msgT: 0 };
  const OPTROWS = ['AUTOSAVE', 'TEXT SPEED', 'MUSIC VOLUME', 'EXPORT SAVE FILE', 'BACK'];
  const optApply = () => { try { env.applyOptions && env.applyOptions(SS() ? SS().options() : {}); } catch (e) { /* ignore */ } };
  SCREENS.options = {
    enter() { OP.i = 0; OP.msg = ''; },
    top(c) {
      const o = SS() ? SS().options() : { autosave: false, textSpeed: 1, volume: .5 };
      grad(c, 0, 0, BW, TH, '#0c2c20', '#04140e'); const off = (S.t * 12) % 20; c.fillStyle = 'rgba(80,220,140,.06)'; for (let k = -6; k < 16; k++) c.fillRect(k * 20 + off, 0, 8, TH);
      rr(c, 8, 8, 224, 144, 6, '#e8fff0'); rr(c, 10, 10, 220, 140, 5, '#103a28'); T(c, 'OPTIONS', 18, 14, 'gold');
      OPTROWS.forEach((lab, i) => {
        const y = 32 + i * 22, sel = i === OP.i; if (sel) { rect(c, 14, y - 3, 212, 17, 'rgba(255,214,60,.20)'); tri(c, 17 + Math.round(Math.abs(Math.sin(S.t * 6)) * 2), y + 5, 3, '#ffd23c'); }
        T(c, lab, 26, y, sel ? 'white' : 'mute');
        if (i === 0) TR(c, o.autosave ? 'ON' : 'OFF', 220, y, o.autosave ? 'gold' : 'grey');
        else if (i === 1) { ['SLOW', 'NORMAL', 'FAST'].forEach((s, j) => T(c, s, [112, 146, 192][j], y, j === o.textSpeed ? 'gold' : 'grey')); }
        else if (i === 2) { for (let b = 0; b < 10; b++) rect(c, 132 + b * 8, y + 2, 6, 7, b < Math.round(o.volume * 10) ? '#ffd23c' : '#24503c'); TR(c, String(Math.round(o.volume * 100)), 226, y, 'white'); }
      });
      if (OP.msg) { T(c, OP.msg, 18, 134, 'gold'); }
    },
    bot(c) { botGeneric(c, 'Left / Right changes a setting.   Autosave saves when you enter a new map. Export downloads save.json.', cc => { btn(cc, 14, 80, 100, 22, 'AUTOSAVE', () => SCREENS.options.chg(0, 1), '#2e3548'); btn(cc, 126, 80, 100, 22, 'EXPORT SAVE', () => SCREENS.options.chg(3, 1), '#2e3548'); }); },
    chg(i, d) {
      const o = SS() && SS().options(); if (!o) return; OP.i = i;
      if (i === 0) { o.autosave = !o.autosave; if (SS()) SS().touch(); }
      else if (i === 1) { o.textSpeed = clamp(o.textSpeed + d, 0, 2); if (SS()) SS().touch(); }
      else if (i === 2) { o.volume = clamp(Math.round((o.volume + d * .1) * 10) / 10, 0, 1); if (SS()) SS().touch(); }
      else if (i === 3) { if (d !== 0) { OP.msg = SS() && SS().exportFile() ? 'save.json downloaded.' : 'Could not export.'; } }
      else if (i === 4) { if (d !== 0) return back(); }
      optApply();
    },
    press(k) {
      if (k === 'b') return back(); if (k === 'up') OP.i = (OP.i + 4) % 5; else if (k === 'down') OP.i = (OP.i + 1) % 5;
      else if (k === 'left') this.chg(OP.i, -1); else if (k === 'right') this.chg(OP.i, 1);
      else if (k === 'a') { if (OP.i === 0 || OP.i === 3 || OP.i === 4) this.chg(OP.i, 1); else this.chg(OP.i, 1); }
    },
    click(x, y, area) {
      if (area !== 'top') return; const i = Math.floor((y - 29) / 22); if (i < 0 || i > 4) return;
      if (i === 1) { const j = x < 142 ? 0 : (x < 188 ? 1 : 2); if (x >= 108) { const o = SS().options(); o.textSpeed = j; optApply(); OP.i = 1; return; } }
      if (i === 2 && x >= 130 && x <= 214) { const o = SS().options(); o.volume = clamp(Math.round((x - 132) / 8 + 1) / 10, 0, 1); optApply(); OP.i = 2; return; }
      this.chg(i, 1);
    },
  };

  // ===================================================================== AIDE'S LOG (quest journal)
  const LG = { tab: 0, i: 0, top: 0 };
  function questList() {
    const q = (env.quests && env.quests()) || {}; const all = Object.keys(q).map(k => Object.assign({ id: k }, q[k]));
    return all.filter(e => (LG.tab === 0) === (e.status !== 'done')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }
  SCREENS.log = {
    enter() { LG.tab = 0; LG.i = 0; LG.top = 0; },
    top(c) {
      grad(c, 0, 0, BW, TH, '#3a2c10', '#1c1406'); const off = (S.t * 6) % 12; c.fillStyle = 'rgba(255,220,120,.05)'; for (let k = -2; k < 16; k++) c.fillRect(0, k * 12 + off, BW, 5);
      rr(c, 6, 6, 228, 148, 6, '#7a5e08'); rr(c, 8, 8, 224, 144, 5, '#fff4c0'); rect(c, 8, 8, 12, 144, '#e8c838'); for (let k = 0; k < 8; k++) ell(c, 14, 20 + k * 17, 3, 3, '#7a5e08');
      T(c, LOG_NAME(), 28, 12, 'dark'); ['ACTIVE', 'DONE'].forEach((s, i) => { const x = 140 + i * 48; if (i === LG.tab) rect(c, x - 2, 22, tw(s) + 4, 2, '#d03848'); T(c, s, x, 12, i === LG.tab ? 'red' : 'mute'); });
      rect(c, 24, 25, 204, 1, '#a89048');
      const list = questList(); LG.i = clamp(LG.i, 0, Math.max(0, list.length - 1)); if (LG.i < LG.top) LG.top = LG.i; if (LG.i >= LG.top + 6) LG.top = LG.i - 5;
      if (!list.length) { T(c, LG.tab === 0 ? 'Nothing to do right now.' : 'No finished tasks yet.', 34, 60, 'mute'); T(c, 'Talk to people to get started!', 34, 74, 'mute'); return; }
      for (let r = 0; r < 6; r++) { const e = list[LG.top + r]; if (!e) break; const y = 30 + r * 14, sel = LG.top + r === LG.i; if (sel) { rect(c, 24, y - 1, 82, 13, 'rgba(208,56,72,.18)'); tri(c, 24, y + 5, 3, '#d03848'); } T(c, String(e.title || e.id).slice(0, 12), 31, y, sel ? 'red' : 'dark'); }
      const e = list[LG.i]; rect(c, 108, 28, 1, 120, '#a89048');
      if (e) {
        T(c, String(e.title || e.id).slice(0, 18), 114, 30, 'red'); let y = 44; if (e.giver) { T(c, 'From ' + e.giver, 114, y, 'mute'); y += 13; }
        for (const l of wrapText(e.text || e.desc || '', 112).slice(0, 5)) { T(c, l, 114, y, 'dark'); y += 12; }
        (e.steps || []).slice(0, 4).forEach(st => { const done = typeof st === 'object' ? st.done : false, tx = typeof st === 'object' ? st.text : st; rect(c, 114, y + 2, 7, 7, '#a89048'); rect(c, 115, y + 3, 5, 5, '#fff4c0'); if (done) { rect(c, 116, y + 5, 2, 2, '#36a060'); rect(c, 118, y + 3, 2, 3, '#36a060'); } T(c, String(tx).slice(0, 16), 124, y, done ? 'mute' : 'dark'); y += 12; });
      }
    },
    bot(c) { botGeneric(c, 'Left / Right switches between active and finished tasks.  Up / Down picks one.', cc => { btn(cc, 14, 70, 100, 22, 'ACTIVE', () => { LG.tab = 0; LG.i = 0; }, '#5a4a10', LG.tab === 0); btn(cc, 126, 70, 100, 22, 'DONE', () => { LG.tab = 1; LG.i = 0; }, '#5a4a10', LG.tab === 1); }); },
    press(k) { if (k === 'b') return back(); if (k === 'up') LG.i = Math.max(0, LG.i - 1); else if (k === 'down') LG.i++; else if (k === 'left') { LG.tab = 0; LG.i = 0; } else if (k === 'right') { LG.tab = 1; LG.i = 0; } },
    click(x, y, area) { if (area === 'top' && x > 24 && x < 108 && y >= 30 && y < 114) { LG.i = LG.top + Math.floor((y - 30) / 14); } },
  };

  // ===================================================================== TOWN MAP (RotomDex frame)
  const TM = { sel: null, keys: [], info: {}, bounds: null, built: false };
  const MAPCOL = { City: '#78c850', Town: '#78c850', Route: '#e0cc88', Cave: '#a07850', Dungeon: '#a07850', Forest: '#3c9048', Sea: '#4890e0', Building: '#b8b8c8' };
  function buildTownMap() {
    const maps = (env.maps && env.maps()) || {}, offs = (env.offsets && env.offsets()) || {}; TM.keys = []; TM.info = {};
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k of Object.keys(maps)) { const m = maps[k], d = m && m.dimensions; if (!d || !offs[k]) continue; const r = { x: offs[k].x, y: offs[k].y, w: d.width * 32, h: d.height * 32, type: m.mapType || '' }; TM.info[k] = r; TM.keys.push(k); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    TM.bounds = TM.keys.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; TM.built = true;
  }
  const TMCFG = () => (env.townMap && env.townMap()) || {};
  function tmGeom(sc) {
    const cfg = TMCFG(), im = cfg.image && getSprite(cfg.image);
    if (im) { const iw = im.naturalWidth, ih = im.naturalHeight, s = Math.min((sc.w - 4) / iw, (sc.h - 18) / ih); return { im, s, ox: sc.x + (sc.w - iw * s) / 2, oy: sc.y + 2, pos: cfg.pos || {} }; }
    const b = TM.bounds; if (!b) return { s: 1, ox: sc.x, oy: sc.y }; const s = Math.min((sc.w - 12) / b.w, (sc.h - 28) / b.h); return { s, ox: sc.x + (sc.w - b.w * s) / 2 - b.x * s, oy: sc.y + 4 + (sc.h - 28 - b.h * s) / 2 - b.y * s };
  }
  function tmCenter(k, g) {
    if (g.im) { const p = g.pos[k]; return p ? { x: g.ox + p[0] * g.s, y: g.oy + p[1] * g.s } : null; }
    const r = TM.info[k]; return r ? { x: g.ox + (r.x + r.w / 2) * g.s, y: g.oy + (r.y + r.h / 2) * g.s } : null;
  }
  function tmKeys() { const g = TMCFG(); return g.image && getSprite(g.image) ? Object.keys(g.pos || {}) : TM.keys; }
  function tmMove(dx, dy) {
    const sc = { x: 11, y: 35, w: 218, h: 118 }, g = tmGeom(sc), cur = tmCenter(TM.sel, g); if (!cur) return; let best = null, bd = 1e9;
    for (const k of tmKeys()) { if (k === TM.sel) continue; const p = tmCenter(k, g); if (!p) continue; const vx = p.x - cur.x, vy = p.y - cur.y, along = vx * dx + vy * dy; if (along <= 1) continue; const perp = Math.abs(vx * dy - vy * dx), d = along + perp * 1.5; if (d < bd) { bd = d; best = k; } }
    if (best) TM.sel = best; lookTo(dx, dy);
  }
  SCREENS.map = {
    enter() { if (!TM.built) buildTownMap(); const cur = env.playerPos && env.playerPos(); TM.sel = (cur && (TM.info[cur.key] || (TMCFG().pos || {})[cur.key]) && cur.key) || TM.keys[0] || null; },
    top(c) {
      const sc = rotomFrame(c); const g = tmGeom(sc), cur = env.playerPos && env.playerPos();
      c.save(); c.beginPath(); c.rect(sc.x, sc.y, sc.w, sc.h); c.clip();
      grad(c, sc.x, sc.y, sc.w, sc.h, '#3a78c8', '#2458a0'); c.fillStyle = 'rgba(255,255,255,.10)'; for (let k = 0; k < 9; k++) { const yy = sc.y + 6 + k * 14; for (let xx = 0; xx < sc.w; xx += 4) c.fillRect(sc.x + xx, yy + Math.round(Math.sin(S.t * 1.6 + xx * .08 + k) * 1.4), 2, 1); }
      if (g.im) { c.imageSmoothingEnabled = false; c.drawImage(g.im, 0, 0, g.im.naturalWidth, g.im.naturalHeight, Math.round(g.ox), Math.round(g.oy), Math.round(g.im.naturalWidth * g.s), Math.round(g.im.naturalHeight * g.s)); }
      else if (!TM.keys.length) { T(c, 'No map data.', sc.x + 8, sc.y + 40, 'mute'); }
      else for (const k of TM.keys) { const r = TM.info[k], x = Math.round(g.ox + r.x * g.s), y = Math.round(g.oy + r.y * g.s), w = Math.max(3, Math.round(r.w * g.s)), h = Math.max(3, Math.round(r.h * g.s)); const col = MAPCOL[r.type] || MAPCOL.Route; rect(c, x - 1, y - 1, w + 2, h + 2, '#143c20'); rect(c, x, y, w, h, col); rect(c, x, y, w, 1, 'rgba(255,255,255,.35)'); }
      const k = TM.sel, p = k && tmCenter(k, g);
      if (k && !g.im && TM.info[k]) { const r = TM.info[k], x = Math.round(g.ox + r.x * g.s), y = Math.round(g.oy + r.y * g.s), w = Math.max(3, Math.round(r.w * g.s)), h = Math.max(3, Math.round(r.h * g.s)); if (Math.floor(S.t * 4) % 2) { c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3); } else { c.strokeStyle = '#ffd23c'; c.lineWidth = 1; c.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3); } }
      else if (p) { ell(c, Math.round(p.x), Math.round(p.y), 3, 3, Math.floor(S.t * 4) % 2 ? '#fff' : '#ffd23c'); }
      // where the player is
      if (cur) { const key = cur.key; let pp = null; if (!g.im && TM.info[key]) pp = { x: g.ox + (cur.wx || 0) * g.s, y: g.oy + (cur.wy || 0) * g.s }; else if (g.im && (g.pos || {})[key]) pp = tmCenter(key, g); if (pp) { const bob = Math.round(Math.abs(Math.sin(S.t * 5)) * 3); tri(c, Math.round(pp.x) - 2, Math.round(pp.y) - 6 - bob, 3, '#e8283c'); rect(c, Math.round(pp.x) - 2, Math.round(pp.y) - 6 - bob, 1, 1, '#e8283c'); c.fillStyle = '#e8283c'; c.fillRect(Math.round(pp.x) - 1, Math.round(pp.y) - 9 - bob, 3, 7); ell(c, Math.round(pp.x), Math.round(pp.y), 1, 1, '#ffffff'); } }
      c.restore();
      rect(c, sc.x, sc.y + sc.h - 16, sc.w, 16, '#0c1018'); rect(c, sc.x, sc.y + sc.h - 17, sc.w, 1, '#d02c3a');
      if (k) { T(c, String(k).toUpperCase().slice(0, 28), sc.x + 6, sc.y + sc.h - 13, 'white'); if (cur && cur.key === k) TR(c, 'YOU ARE HERE', sc.x + sc.w - 5, sc.y + sc.h - 13, Math.floor(S.t * 3) % 2 ? 'gold' : 'red'); }
    },
    bot(c) { botGeneric(c, 'Move the cursor to look at the map.', cc => { const d = [['<', -1, 0, 20], ['^', 0, -1, 80], ['v', 0, 1, 120], ['>', 1, 0, 180]]; btn(cc, 90, 62, 60, 18, 'UP', () => tmMove(0, -1), '#2e3548'); btn(cc, 28, 84, 60, 18, 'LEFT', () => tmMove(-1, 0), '#2e3548'); btn(cc, 152, 84, 60, 18, 'RIGHT', () => tmMove(1, 0), '#2e3548'); btn(cc, 90, 106, 60, 18, 'DOWN', () => tmMove(0, 1), '#2e3548'); }); },
    press(k) { if (k === 'b') return back(); const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[k]; if (d) tmMove(d[0], d[1]); },
    click(x, y, area) { if (area !== 'top') return; const sc = { x: 11, y: 35, w: 218, h: 118 }, g = tmGeom(sc); let best = null, bd = 400; for (const k of tmKeys()) { const r = TM.info[k]; let hit = false, dd = 1e9; if (!g.im && r) { const rx = g.ox + r.x * g.s, ry = g.oy + r.y * g.s; hit = x >= rx && x <= rx + r.w * g.s && y >= ry && y <= ry + r.h * g.s; dd = hit ? 0 : 1e9; } else { const p = tmCenter(k, g); if (p) dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); } if (dd < bd) { bd = dd; best = k; } } if (best) TM.sel = best; },
  };

  // ===================================================================== POKENAV  (hub: map / condition / ribbons / calls)
  const NV = { stage: 'hub', i: 0, sel: 0 };
  const NAVAPPS = [['MAP', '#58b868'], ['CONDITION', '#e8a0c8'], ['RIBBONS', '#e8c838'], ['CALLS', '#58a0e8']];
  const CONTEST = [['cool', 'COOL', '#e84838'], ['beauty', 'BEAUTY', '#3a78e8'], ['cute', 'CUTE', '#f080b8'], ['smart', 'SMART', '#48b848'], ['tough', 'TOUGH', '#e8c828']];
  SCREENS.nav = {
    enter() { NV.stage = 'hub'; NV.i = 0; NV.sel = 0; },
    top(c) {
      grad(c, 0, 0, BW, TH, '#1c2438', '#0a0e1a'); const off = (S.t * 10) % 20; c.fillStyle = 'rgba(150,170,220,.06)'; for (let k = -8; k < 16; k++) c.fillRect(0, k * 20 + off, BW, 1);
      rr(c, 40, 4, 160, 152, 12, '#2a3048'); rr(c, 42, 6, 156, 148, 11, '#aab4cc'); rr(c, 46, 14, 148, 120, 5, '#0a0e1c'); rr(c, 48, 16, 144, 116, 4, '#162040');
      T(c, 'POKéNAV', 56, 20, 'gold'); const pt = party().filter(m => m && m.species);
      if (NV.stage === 'hub') {
        NAVAPPS.forEach(([lab, col], i) => { const x = 54 + (i % 2) * 68, y = 38 + Math.floor(i / 2) * 44, sel = i === NV.i, bob = sel ? Math.round(Math.sin(S.t * 6) * 1) : 0; rr(c, x - 1, y - 1 + bob, 66, 40, 5, sel ? '#ffffff' : '#0a0e1c'); rr(c, x, y + bob, 64, 38, 4, sel ? '#324a88' : '#1c2a50'); rr(c, x + 20, y + 4 + bob, 24, 18, 4, col); T(c, lab, Math.round(x + (64 - tw(lab)) / 2), y + 26 + bob, sel ? 'white' : 'mute'); });
      } else if (NV.stage === 'cond') {
        T(c, 'CONDITION', 108, 20, 'white'); if (!pt.length) T(c, 'No Pokémon.', 56, 60, 'mute');
        const m = pt[NV.sel] || pt[0]; if (m) { const nm = String(m.nickname || m.species.replace('SPECIES_', '').replace(/_/g, ' ')).toUpperCase().slice(0, 12); T(c, nm, 56, 34, 'white'); TR(c, 'Lv' + (m.level || 1), 186, 34, 'mute');
          CONTEST.forEach(([k, lab, col], i) => { const y = 50 + i * 14, v = clamp((+m[k] || 0) / 255); T(c, lab, 56, y, 'mute'); rect(c, 102, y + 2, 82, 7, '#0a0e1c'); rect(c, 103, y + 3, Math.round(80 * v), 5, col); });
          const f = clamp((+m.friendship || 0) / 255); T(c, 'BOND', 56, 120, 'gold'); rect(c, 102, 122, 82, 7, '#0a0e1c'); rect(c, 103, 123, Math.round(80 * f), 5, '#f06888'); }
      } else if (NV.stage === 'rib') {
        T(c, 'RIBBONS', 108, 20, 'white'); const m = pt[NV.sel] || pt[0]; if (!m) T(c, 'No Pokémon.', 56, 60, 'mute'); else { T(c, String(m.nickname || m.species.replace('SPECIES_', '')).toUpperCase().slice(0, 14), 56, 34, 'white'); const rb = (m.ribbons || []); if (!rb.length) T(c, 'No ribbons yet.', 56, 60, 'mute'); rb.slice(0, 6).forEach((r, i) => { ell(c, 62, 60 + i * 13, 4, 4, '#e8c838'); T(c, String(r).replace(/^RIBBON_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()).slice(0, 20), 72, 56 + i * 13, 'white'); }); }
      } else if (NV.stage === 'call') {
        T(c, 'CALLS', 108, 20, 'white'); const ct = (saveData().contacts || []); if (!ct.length) { T(c, 'No trainers registered.', 56, 50, 'mute'); T(c, 'Trainers who ask to', 56, 70, 'mute'); T(c, 'swap numbers show up here.', 56, 83, 'mute'); } else ct.slice(0, 6).forEach((n, i) => T(c, String(n.name || n).toUpperCase().slice(0, 18), 62, 36 + i * 14, i === NV.sel ? 'white' : 'mute'));
      }
      if (NV.stage !== 'hub' && pt.length > 1 && NV.stage !== 'call') { T(c, '<', 52, 120, 'mute'); T(c, '>', 184, 120, 'mute'); }
    },
    bot(c) { botGeneric(c, NV.stage === 'hub' ? 'Pick an app.' : 'Left / Right changes Pokémon.', cc => { if (NV.stage === 'hub') NAVAPPS.forEach(([lab], i) => btn(cc, 14 + (i % 2) * 114, 62 + Math.floor(i / 2) * 28, 100, 22, lab, () => SCREENS.nav.open(i), '#2e3548', i === NV.i)); else { btn(cc, 14, 62, 60, 22, '<', () => { NV.sel = Math.max(0, NV.sel - 1); }, '#2e3548'); btn(cc, 90, 62, 60, 22, '>', () => { NV.sel = Math.min(5, NV.sel + 1); }, '#2e3548'); } }); },
    open(i) { NV.i = i; if (i === 0) return openScreen('map'); NV.stage = ['', 'cond', 'rib', 'call'][i]; NV.sel = 0; },
    press(k) {
      if (NV.stage === 'hub') { if (k === 'b') return back(); if (k === 'left' || k === 'right') NV.i ^= 1; else if (k === 'up' || k === 'down') NV.i = (NV.i + 2) % 4; else if (k === 'a') this.open(NV.i); return; }
      if (k === 'b') { NV.stage = 'hub'; return; } const n = Math.max(1, party().filter(m => m && m.species).length); if (k === 'left') NV.sel = (NV.sel + n - 1) % n; else if (k === 'right') NV.sel = (NV.sel + 1) % n;
    }, click() {},
  };

  // ===================================================================== ROTOMDEX (Pokedex)
  const DXM = [['national', 'NATIONAL'], ['regional', 'REGIONAL'], ['alpha', 'A TO Z'], ['weight', 'WEIGHT'], ['height', 'HEIGHT'], ['type', 'TYPE']];
  const DX = { mode: 0, seenOnly: false, list: [], idx: 0, top: 0, stage: 'list', dirty: true, flip: 0 };
  const DEXAPI = () => (typeof window !== 'undefined' && window.Dex) || null;
  function dxBuild(keep) {
    const D = DEXAPI(); if (!D) { DX.list = []; return; }
    const cur = keep && DX.list[DX.idx]; let ord = D.order(DXM[DX.mode][0]);
    if (DX.seenOnly) ord = ord.filter(n => D.seen(n)); DX.list = ord; DX.idx = cur ? Math.max(0, ord.indexOf(cur)) : 0; DX.top = 0; DX.dirty = false;
  }
  const dxEntry = () => { const D = DEXAPI(); return D && DX.list[DX.idx] ? D.entry(DX.list[DX.idx]) : null; };
  function dxSprite(e) { if (!e) return null; const p = dbOf(e.species).frontSprite; return p ? monFrame(p) : null; }
  function dxMove(d) { if (!DX.list.length) return; DX.idx = clamp(DX.idx + d, 0, DX.list.length - 1); lookTo(0, d > 0 ? .8 : -.8); const e = dxEntry(); dxSprite(e); }
  const fmtH = d => (d / 10).toFixed(1) + 'm', fmtW = h => (h / 10).toFixed(1) + 'kg';
  SCREENS.dex = {
    enter() { if (DX.dirty || !DX.list.length) dxBuild(false); DX.stage = 'list'; },
    top(c) {
      const D = DEXAPI(), sc = rotomFrame(c), cn = D ? D.counts() : { seen: 0, caught: 0, total: 0 };
      grad(c, sc.x, sc.y, sc.w, sc.h, '#e8f4ff', '#b8d4f0'); c.save(); c.beginPath(); c.rect(sc.x, sc.y, sc.w, sc.h); c.clip();
      const off = (S.t * 6) % 12; c.fillStyle = 'rgba(80,140,220,.10)'; for (let k = -6; k < 24; k++) c.fillRect(sc.x + k * 12 + off, sc.y, 5, sc.h);
      rect(c, sc.x, sc.y, sc.w, 14, '#d02c3a'); rect(c, sc.x, sc.y + 14, sc.w, 1, '#7a1018'); T(c, DX.stage === 'entry' ? 'ROTOMDEX  DATA' : 'ROTOMDEX  ' + DXM[DX.mode][1], sc.x + 5, sc.y + 3, 'white');
      TR(c, 'SEEN ' + cn.seen + '  OWN ' + cn.caught, sc.x + sc.w - 5, sc.y + 3, 'gold');
      if (!D) { T(c, 'PokedexTables.js is not loaded.', sc.x + 8, sc.y + 40, 'dark'); c.restore(); return; }
      const e = dxEntry(); const num = e && e.num, seen = num && D.seen(num), got = num && D.caught(num);
      // left: picture
      rr(c, sc.x + 3, sc.y + 18, 82, 74, 4, '#143058'); rr(c, sc.x + 4, sc.y + 19, 80, 72, 3, '#1f4a82'); const fl = (S.t * 30) % 160; rect(c, sc.x + 4 + fl - 20, sc.y + 19, 8, 72, 'rgba(255,255,255,.07)');
      const f = e && seen ? dxSprite(e) : null; const bob = Math.round(Math.sin(S.t * 3) * 1);
      if (f) drawMonSprite(c, f, sc.x + 7, sc.y + 22 + bob, 74, 66, !got); else if (e && seen) T(c, 'NO IMAGE', sc.x + 22, sc.y + 52, 'mute'); else { T(c, '?', sc.x + 40, sc.y + 48, 'mute'); }
      if (got) ball(c, sc.x + 8, sc.y + 23, 'poke', 1);
      rr(c, sc.x + 3, sc.y + 95, 82, 20, 3, '#143058');
      if (e) { rect(c, sc.x + 3, sc.y + 95, 82, 20, '#143058'); T(c, seen ? e.name.toUpperCase().slice(0, 12) : '??????????', sc.x + 8, sc.y + 97, 'white'); T(c, 'No.' + String(e.num).padStart(4, '0'), sc.x + 8, sc.y + 106, 'gold'); }
      if (DX.stage === 'list') {
        // right: list
        const R = { x: sc.x + 89, y: sc.y + 17, w: sc.w - 92, rows: 7, h: 14 }; if (DX.idx < DX.top) DX.top = DX.idx; if (DX.idx >= DX.top + R.rows) DX.top = DX.idx - R.rows + 1; DX.top = clamp(DX.top, 0, Math.max(0, DX.list.length - R.rows));
        rr(c, R.x - 1, R.y - 1, R.w + 2, R.rows * R.h + 2, 3, '#143058');
        for (let r = 0; r < R.rows; r++) {
          const i = DX.top + r, n = DX.list[i]; if (n == null) break; const y = R.y + r * R.h, sel = i === DX.idx; const en = D.entry(n), sn = D.seen(n), cg = D.caught(n);
          rect(c, R.x, y, R.w - 6, R.h - 1, sel ? '#ffd23c' : (r % 2 ? '#fdfeff' : '#e6f0fa'));
          if (sel) { tri(c, R.x - 1 + Math.round(Math.abs(Math.sin(S.t * 6)) * 2), y + 6, 3, '#d02c3a'); }
          T(c, String(n).padStart(4, '0'), R.x + 6, y + 2, sel ? 'dark' : 'mute'); T(c, sn ? en.name.toUpperCase().slice(0, 11) : '-----------', R.x + 34, y + 2, sel ? 'dark' : (sn ? 'dark' : 'mute'));
          if (cg) ball(c, R.x + R.w - 18, y + 2, 'poke', 1);
        }
        const tot = Math.max(1, DX.list.length - R.rows), sbH = R.rows * R.h; rect(c, R.x + R.w - 4, R.y, 3, sbH, '#0c2040'); rect(c, R.x + R.w - 4, R.y + Math.round((sbH - 14) * DX.top / tot), 3, 14, '#ffd23c');
        if (!DX.list.length) T(c, 'Nothing to show.', R.x + 8, R.y + 20, 'white');
      } else if (e) {
        const X = sc.x + 91; T(c, seen ? e.name.toUpperCase() : '??????????', X, sc.y + 19, 'dark'); T(c, got ? String(e.category).toUpperCase() + ' POKéMON' : '', X, sc.y + 31, 'red');
        T(c, 'HT', X, sc.y + 45, 'mute'); T(c, got ? fmtH(e.height) : '???', X + 20, sc.y + 45, 'dark'); T(c, 'WT', X + 62, sc.y + 45, 'mute'); T(c, got ? fmtW(e.weight) : '???', X + 82, sc.y + 45, 'dark');
        rr(c, sc.x + 3, sc.y + 117 - 0, 1, 1, 'rgba(0,0,0,0)');
        const txt = got ? (D.text(e.num) || 'No Pokédex text installed yet.') : (seen ? 'Catch this Pokémon to learn more about it.' : 'Nothing is known about this Pokémon.');
        wrapText(txt, 128).slice(0, 5).forEach((l, i) => T(c, l, X, sc.y + 59 + i * 11, got ? 'dark' : 'mute'));
        T(c, got ? 'REGISTERED' : (seen ? 'SEEN' : 'UNKNOWN'), X, sc.y + 105, got ? 'red' : 'mute');
      }
      c.restore();
    },
    bot(c) {
      botGeneric(c, '', cc => {
        const D = DEXAPI();
        if (DX.stage === 'list') {
          btn(cc, 10, 22, 108, 22, DXM[DX.mode][1], () => SCREENS.dex.order(), '#7a1c28'); btn(cc, 122, 22, 108, 22, DX.seenOnly ? 'SEEN ONLY' : 'SHOW ALL', () => SCREENS.dex.filter(), '#7a1c28');
          btn(cc, 10, 50, 50, 22, '-10', () => dxMove(-10), '#2e3548'); btn(cc, 64, 50, 50, 22, '-1', () => dxMove(-1), '#2e3548'); btn(cc, 118, 50, 50, 22, '+1', () => dxMove(1), '#2e3548'); btn(cc, 172, 50, 58, 22, '+10', () => dxMove(10), '#2e3548');
          btn(cc, 10, 78, 108, 22, 'ENTRY  (A)', () => SCREENS.dex.open(), '#2c5a3a');
        } else { btn(cc, 10, 28, 70, 24, 'PREV', () => dxMove(-1), '#2e3548'); btn(cc, 90, 28, 70, 24, 'NEXT', () => dxMove(1), '#2e3548'); T(cc, (DX.idx + 1) + ' / ' + DX.list.length, 12, 62, 'mute'); }
        if (D) { const cn = D.counts(); const w = 100, p = cn.total ? cn.caught / cn.total : 0; T(cc, 'COMPLETION', 12, BH - 38, 'mute'); rect(cc, 12, BH - 25, w, 7, '#0a0c12'); rect(cc, 13, BH - 24, Math.round((w - 2) * p), 5, '#ffd23c'); }
      });
    },
    order() { DX.mode = (DX.mode + 1) % DXM.length; if (!(DEXAPI() && window.DexOrders && (DXM[DX.mode][0] === 'national' || window.DexOrders[DXM[DX.mode][0]]))) DX.mode = 0; dxBuild(true); },
    filter() { DX.seenOnly = !DX.seenOnly; dxBuild(true); },
    open() { if (!dxEntry()) return; DX.stage = 'entry'; S.happy = S.t + .5; lookTo(0, 0); const e = dxEntry(); if (e && DEXAPI().caught(e.num)) S.happy = S.t + .7; },
    press(k) {
      if (DX.stage === 'entry') { if (k === 'b' || k === 'a') { DX.stage = 'list'; return; } if (k === 'up' || k === 'left') dxMove(-1); else if (k === 'down' || k === 'right') dxMove(1); return; }
      if (k === 'b') return back(); if (k === 'up') dxMove(-1); else if (k === 'down') dxMove(1); else if (k === 'left') dxMove(-7); else if (k === 'right') dxMove(7); else if (k === 'a') this.open(); else if (k === 'sel') this.order(); else if (k === 'filter') this.filter();
    },
    click(x, y, area) { if (area !== 'top' || DX.stage !== 'list') return; const sc = { x: 11, y: 35 }, rx = sc.x + 89, ry = sc.y + 17; if (x >= rx && x < rx + 120 && y >= ry && y < ry + 98) { const i = DX.top + Math.floor((y - ry) / 14); if (i < DX.list.length) { if (i === DX.idx) this.open(); else { DX.idx = i; lookTo(0, 0); } } } },
  };

  // ===================================================================== the core api
  function enterMenu(o) { S.open = true; S.closing = false; S.since = 0; S.scr = 'menu'; S.sub = null; S.page = 0; S.sel = (o && o.select) || 0; S.pageAnim = null; S.child = false; S.t = S.t || 0; S.nextBlink = S.t + 2; S.hit = []; }
  function press(k) {
    if (!S.open || S.child || S.closing) return;
    if (S.scr === 'menu') return pressMenu(k);
    if (S.sub && S.sub.press) S.sub.press(k);
  }
  function click(x, y, area) {
    if (!S.open || S.child || S.closing) return;
    if (S.scr === 'menu') { if (area === 'bot') clickMenu(x, y); return; }
    if (area === 'bot') { for (let i = S.hit.length - 1; i >= 0; i--) { const h = S.hit[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.f(); return; } } }
    if (S.sub && S.sub.click) S.sub.click(x, y, area);
  }
  function update(dt) {
    S.t += dt; S.since += dt; if (S.pageAnim) { S.pageAnim.t += dt; if (S.pageAnim.t >= .28) S.pageAnim = null; }
    if (S.closing) { S.closeT += dt; if (S.closeT >= .25 && !S.exited) { S.exited = true; env.onExit && env.onExit(); } }
    if (S.t > (S.lookHold || 0)) { S.look.tx = Math.sin(S.t * .9) * .7; S.look.ty = Math.cos(S.t * 1.3) * .35; }
    if (S.sub && S.sub.tick) S.sub.tick(dt);
  }
  function renderBottom(c) {
    c.imageSmoothingEnabled = false; c.clearRect(0, 0, BW, BH);
    if (S.scr === 'menu' || !S.sub) renderMenu(c); else S.sub.bot(c);
  }
  function renderTop(c) { c.imageSmoothingEnabled = false; c.clearRect(0, 0, BW, TH); if (S.scr !== 'menu' && S.sub) S.sub.top(c); }
  function start(o) {
    o = o || {}; S.exited = false; enterMenu(o); SCREENS_RESET();
    const keys = []; for (const pg of PAGES) pg.forEach(d => keys.push(d[0]));
    if (o.screen && SCREENS[o.screen]) openScreen(o.screen); else if (o.activate) activate(PAGES[0][S.sel] || PAGES[0][0]);
  }
  function SCREENS_RESET() { DX.dirty = true; }
  function status() { return { scr: S.scr, page: S.page, sel: S.sel, closing: S.closing, child: S.child, dexList: DX.list.length, warnings: [...warnings] }; }
  return { icon, S, W: BW, H: BH, TH, press, click, update, render: renderBottom, renderTop, start, initFont, status, SCREENS, DX, TM, openScreen, topActive: () => S.scr !== 'menu' && !!S.sub, requestClose };
}
root.StartMenuCore = createStart;
})(window);

// ---------------------------------------------------------------------------
// the quest journal API (Aide's Log)
// ---------------------------------------------------------------------------
(function (root) {
'use strict';
const store = () => { const s = root.GameStateManager && root.GameStateManager.saveData; if (!s) return {}; return s.quests || (s.quests = {}); };
const touch = () => { if (root.SaveSystem) root.SaveSystem.touch(); };
const Quests = {
  add(id, title, text, giver) { const q = store(); if (q[id]) { if (title) q[id].title = title; if (text) q[id].text = text; q[id].updated = Date.now(); return q[id]; } q[id] = { title: title || id, text: text || '', giver: giver || '', status: 'active', steps: [], updated: Date.now() }; touch(); return q[id]; },
  step(id, text, done) { const q = store()[id]; if (!q) return false; const st = q.steps.find(s => s.text === text); if (st) st.done = done !== false; else q.steps.push({ text, done: !!done }); q.updated = Date.now(); touch(); return true; },
  complete(id) { const q = store()[id]; if (!q) return false; q.status = 'done'; q.steps.forEach(s => { s.done = true; }); q.updated = Date.now(); touch(); return true; },
  remove(id) { delete store()[id]; touch(); }, get(id) { return store()[id] || null; }, has(id) { return !!store()[id]; }, isDone(id) { const q = store()[id]; return !!q && q.status === 'done'; },
};
root.Quests = Quests;
})(window);

// ---------------------------------------------------------------------------
// the overlay: StartMenu.open(scene) / toggle(scene) / attach(scene)
// ---------------------------------------------------------------------------
(function (root) {
'use strict';
const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right', e: 'right', z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b', Tab: 'sel', o: 'sel', f: 'filter' };
const KB = 'startmenu_bottom', KT = 'startmenu_top', KD = 'startmenu_dock';
const DOCKICONS = ['pokemon', 'dex', 'bag', 'card', 'save', 'options'];
const StartMenu = {
  active: false, DOCK: true, TOWNMAP: { image: '', pos: {} }, LOGNAME: "AIDE'S LOG",
  isOpen() { return this.active; },
  toggle(scene) { if (this.active) { if (this.core) this.core.press('b'); return; } this.open(scene); },
  _geom(scene) { const scr = (root.OW_TEXT && root.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 }, s = scr.w / 240, y0 = scr.y + scr.h + 4, avail = (scene.scale ? scene.scale.height : 620) - y0; return { scr, s, y0, bh: Math.max(100, Math.min(200, Math.floor(avail / s))) }; },
  open(scene, opts) {
    if (this.active || !scene) return false; opts = opts || {};
    const gs = root.GameStateManager, sv = () => (gs && gs.saveData) || {}, geo = this._geom(scene);
    const core = root.StartMenuCore({
      urlFor: p => p, bottomH: () => geo.bh, scene: () => scene, logName: () => StartMenu.LOGNAME,
      save: () => root.SaveSystem, saveData: sv, flags: () => sv().flags || {}, quests: () => sv().quests || {},
      party: () => (Array.isArray(sv().party) ? sv().party.filter(m => m && m.species) : []),
      db: () => (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : null),
      glyphs: () => { try { return typeof EmeraldFont !== 'undefined' ? new EmeraldFont(null).glyphMap : null; } catch (e) { return null; } },
      maps: () => root.OverworldMaps, offsets: () => scene.worldOffsets || {}, townMap: () => StartMenu.TOWNMAP,
      playerPos: () => ({ key: scene.currentMapKey, wx: scene.player ? scene.player.x : 0, wy: scene.player ? scene.player.y : 0 }),
      applyOptions: o => StartMenu.applyOptions(scene, o),
      openChild: (kind, done) => {
        const M = kind === 'bag' ? root.BagMenu : root.PokemonSummary;
        if (!M) { console.warn('[StartMenu] ' + (kind === 'bag' ? 'BagMenu.js' : 'PokemonSummary.js') + ' is not loaded'); done(); return; }
        const ok = M.open(scene, { onClose: () => { StartMenu.openedAt = performance.now(); done(); } }); if (ok === false) done();
      },
      onExit: () => this.close(),
    });
    this.core = core; this.scene = scene; this.opts = opts; this.openedAt = performance.now(); this.active = true; this.geo = geo;
    core.initFont().then(() => {
      if (!this.active) return; core.start({ select: opts.select, screen: opts.screen, activate: opts.activate });
      for (const k of [KB, KT]) if (scene.textures.exists(k)) scene.textures.remove(k);
      this.tb = scene.textures.createCanvas(KB, core.W, core.H); this.tt = scene.textures.createCanvas(KT, core.W, core.TH);
      try { this.tb.setFilter(Phaser.Textures.FilterMode.NEAREST); this.tt.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ }
      this.cb = this.tb.getContext ? this.tb.getContext() : this.tb.context; this.ct = this.tt.getContext ? this.tt.getContext() : this.tt.context;
      const g = this.geo; this.ib = scene.add.image(g.scr.x, g.y0, KB).setOrigin(0, 0).setScale(g.s).setScrollFactor(0).setDepth(8990);
      this.it = scene.add.image(g.scr.x, g.scr.y, KT).setOrigin(0, 0).setScale(g.s).setScrollFactor(0).setDepth(8990).setVisible(false);
      this.upd = (time, delta) => { const dt = Math.min(.05, delta / 1000); core.update(dt); if (!this.active) return; core.render(this.cb); this.tb.refresh(); const ta = core.topActive(); this.it.setVisible(ta); if (ta) { core.renderTop(this.ct); this.tt.refresh(); } };
      scene.events.on('update', this.upd);
    });
    this.kd = e => {
      if (core.S.child) return;     // the bag / party screen has its own key handling
      const k = KEYS[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat && (k === 'a' || k === 'b')) return; if (performance.now() - this.openedAt < 250) return;
      core.press(e.key === 'Enter' && core.S.scr === 'menu' ? 'b' : k);
    };
    window.addEventListener('keydown', this.kd, true);
    this.pd = p => { if (!this.active || !core.S) return; const g = this.geo; if (performance.now() - this.openedAt < 200) return; const x = (p.x - g.scr.x) / g.s;
      if (p.y >= g.y0) core.click(x, (p.y - g.y0) / g.s, 'bot'); else if (p.y >= g.scr.y && p.y < g.scr.y + g.scr.h) core.click(x, (p.y - g.scr.y) / g.s, 'top'); };
    scene.input.on('pointerdown', this.pd);
    this.applyOptions(scene, root.SaveSystem && root.SaveSystem.options());
    return true;
  },
  close() {
    if (!this.active) return; this.active = false; window.removeEventListener('keydown', this.kd, true);
    const scene = this.scene;
    try { if (this.upd) scene.events.off('update', this.upd); scene.input.off('pointerdown', this.pd); for (const i of [this.ib, this.it]) if (i) i.destroy(); for (const k of [KB, KT]) if (scene.textures.exists(k)) scene.textures.remove(k); } catch (e) { /* scene already gone */ }
    this.ib = this.it = this.tb = this.tt = this.cb = this.ct = this.upd = null;
    if (scene && scene.time) scene.scriptEndedAt = scene.time.now;
    if (this.opts && this.opts.onClose) { const f = this.opts.onClose; this.opts = null; f(); }
  },
  applyOptions(scene, o) {
    o = o || {}; root.GameOptions = Object.assign(root.GameOptions || {}, o);
    try { if (scene && scene.sound && o.volume != null) scene.sound.volume = o.volume; } catch (e) { /* no sound */ }
    try { if (o.volume != null) root.dispatchEvent(new CustomEvent('gameoptions', { detail: o })); } catch (e) { /* ignore */ }
  },
  // ----- the dock: small clickable buttons on the lower screen while the menu is closed
  attach(scene) {
    if (!scene || !scene.add) return; const self = this; this.applyOptions(scene, root.SaveSystem && root.SaveSystem.options());
    const tex = () => { if (!scene.textures.exists(KD)) { const t = scene.textures.createCanvas(KD, 240, 26); try { t.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ } } return scene.textures.get(KD); };
    const g = this._geom(scene); let img = null, ctx = null, cache = null, hot = -1, acc = 0;
    const slot = i => ({ x: 6 + i * 38, y: 2, w: 34, h: 22 });
    const draw = (time, delta) => {
      const vis = this.DOCK && !this.active && !scene.scriptRunning && !scene.isLocked && !(root.PokemonSummary && root.PokemonSummary.isOpen()) && !(root.BagMenu && root.BagMenu.isOpen());
      if (!img && vis) { const t = tex(); cache = t; ctx = t.getContext ? t.getContext() : t.context; img = scene.add.image(g.scr.x, g.y0 + (g.bh - 26) * g.s, KD).setOrigin(0, 0).setScale(g.s).setScrollFactor(0).setDepth(80); }
      if (img) img.setVisible(!!vis); if (!vis || !ctx) return; acc += delta; if (acc < 50) return; acc = 0;
      const c = ctx, t = time / 1000; c.clearRect(0, 0, 240, 26);
      DOCKICONS.forEach((id, i) => { const r = slot(i), on = i === hot; c.fillStyle = on ? '#ffffff' : '#0a0c12'; c.fillRect(r.x - 1, r.y - 1 + (on ? -1 : 0), r.w + 2, r.h + 2); c.fillStyle = on ? '#3a4260' : '#1a1e2c'; c.fillRect(r.x, r.y + (on ? -1 : 0), r.w, r.h); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(r.x, r.y + (on ? -1 : 0), r.w, 9); if (StartMenu.drawIcon) StartMenu.drawIcon(c, id, r.x + r.w / 2, r.y + r.h / 2 + (on ? -1 : 0), t, on); });
      if (cache.refresh) cache.refresh();
    };
    if (!StartMenu.drawIcon) { try { StartMenu.drawIcon = root.StartMenuCore({ urlFor: p => p, bottomH: () => 148, party: () => [], db: () => null }).icon; } catch (e) { console.warn('[StartMenu] dock icons:', e); } }
    const move = p => { const x = (p.x - g.scr.x) / g.s, y = (p.y - (g.y0 + (g.bh - 26) * g.s)) / g.s; hot = -1; if (y >= 0 && y <= 26) DOCKICONS.forEach((id, i) => { const r = slot(i); if (x >= r.x && x <= r.x + r.w) hot = i; }); };
    const down = p => { if (self.active || !img || !img.visible) return; move(p); if (hot >= 0) { const i = hot; self.open(scene, { select: i, activate: true }); } };
    scene.events.on('update', draw); scene.input.on('pointermove', move); scene.input.on('pointerdown', down);
    scene.events.once('shutdown', () => { scene.events.off('update', draw); try { scene.input.off('pointermove', move); scene.input.off('pointerdown', down); } catch (e) { /* ignore */ } if (img) img.destroy(); img = null; if (scene.textures.exists(KD)) scene.textures.remove(KD); });
  },
};
root.StartMenu = StartMenu;
})(window);
