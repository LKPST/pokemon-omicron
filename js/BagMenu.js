// ===========================================================================
// js/BagMenu.js      the BAG and the ITEM STORAGE of the PC   (drawn like the summary screen: over the top screen of the overworld)
//
// Load after PokemonDatabase.js, tables/ItemTables.js and ItemSystem.js (EmeraldFont.js is used if present).
//
// IN THE GAME   B (in the overworld)     opens the bag          BagMenu.open(scene)  /  BagMenu.open(scene, {mode: 'storage'})
//               scripts                  openbag   openpcitems
//               Keys: arrows / WASD = move, Left / Right = change pocket, Z / Enter / Space = A, X / Esc / Backspace = B.
//   In the bag:  A on an item = USE / GIVE / TOSS / CANCEL.   USE works for medicine (potions, status cures, revives, Ether / Elixir, berries).
//                Other items say "can't be used here yet" (stones, Rare Candy, TMs, repels ... come later).
//   Item storage: WITHDRAW / DEPOSIT / TOSS / EXIT.
//
// PICTURES      BagMenu.BG = { bag: 'assets/ui/bag_bg.png', storage: 'assets/ui/item_storage_bg.png' }    (240x160, change the paths here)
//               the item pictures come from ItemTable[item].sprite (item_editor.html writes those paths).
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
const TYPE_COL = { Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f0c820', Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0', Ground: '#d8b858', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820', Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#a8a8c0', Fairy: '#ee99ac', Stellar: '#58b8c8', Mana: '#705898'};
const TLAB = { Normal: 'NORMAL', Fire: 'FIRE', Water: 'WATER', Electric: 'ELECT', Grass: 'GRASS', Ice: 'ICE', Fighting: 'FIGHT', Poison: 'POISON', Ground: 'GROUND', Flying: 'FLYING', Psychic: 'PSYCH', Bug: 'BUG', Rock: 'ROCK', Ghost: 'GHOST', Dragon: 'DRAGON', Dark: 'DARK', Steel: 'STEEL', Fairy: 'FAIRY', Stellar: 'STELLR', Mana: 'MANA' };

function createBag(env) {
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
      e.img.onerror = () => { e.fail = true; if (!failed.has(path)) { failed.add(path); warnings.add('image not found: ' + path); try { console.warn('[Bag] could not load image: ' + path + '  (looked for it relative to your index.html)'); } catch (er) { /* no console */ } } };
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
    try { console.log('[Bag] icon background: ' + (label || '') + ' -> ' + note); } catch (e) { /* no console */ }
    iconKeyed.set(img, out); return out;
  }
  // ===================================================================== BAG / ITEM STORAGE (240x160 screen)
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const POCKETS = [['items', 'ITEMS'], ['balls', 'BALLS'], ['tms', 'TMs'], ['berries', 'BERRY'], ['key', 'KEY']];
  const TABX = [4, 42, 80, 118, 156, 194];
  const LAY = {
    bag: { rows: { x: 75, y: 34, pitch: 16, h: 12, w: 158, n: 5 }, text: { x: 46, y: 119, w: 188, lines: 3 }, iconBox: { x: 8, y: 120, s: 32 }, qtyRight: 229, nameX: 94, iconX: 77, dark: false },
    storage: { rows: { x: 54, y: 11, pitch: 16.2, h: 12, w: 150, n: 6 }, text: { x: 6, y: 117, w: 196, lines: 3 }, iconBox: { x: 206, y: 120, s: 32 }, qtyRight: 197, nameX: 74, iconX: 58, dark: true },
  };
  const S = { mode: 'bag', stage: 'list', pocket: 0, cur: [0, 0, 0, 0, 0, 0], top: [0, 0, 0, 0, 0, 0], src: 'bag', act: 'withdraw', sm: 0, menu: null, msg: '', msgQ: [], after: null,
    qty: { n: 1, max: 1 }, pick: null, pc: 0, mi: 0, t: 0, flash: 0, closed: false, bg: { bag: null, storage: null } };
  const sys = () => env.sys && env.sys();
  const party = () => (env.party && env.party()) || [];
  const dbOf = sp => { const d = env.db && env.db(); return (d && (d[sp] || d[String(sp).replace(/_[MF]$/, '')])) || {}; };

  function bgImg(kind) { const p = env.bgPaths && env.bgPaths()[kind]; const e = p && getImg(p); return e && e.ok ? e.img : null; }
  function itemImg(k) { const it = sys() && sys().info(k), p = it && it.sprite; if (!p) return null; const e = getImg(p); return e && e.ok ? keyedIcon(e.img, p) : null; }
  function drawFit(c, im, x, y, bw, bh, maxScale) {
    if (!im) return false; const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; let s = Math.min(bw / iw, bh / ih); if (maxScale) s = Math.min(s, maxScale); if (s >= 1) s = Math.floor(s);
    const w = Math.max(1, Math.round(iw * s)), h = Math.max(1, Math.round(ih * s)); c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, iw, ih, Math.round(x + (bw - w) / 2), Math.round(y + (bh - h) / 2), w, h); return true;
  }
  function monIcon(c, sp, x, y, size) {
    const p = dbOf(sp).iconSprite, e = p && getImg(p); if (!e || !e.ok) { ball(c, x + Math.round((size - 9) / 2), y + Math.round((size - 9) / 2), 'poke', 1); return; }
    const iw = e.img.naturalWidth, ih = e.img.naturalHeight, n = ih >= iw * 2 ? 2 : 1, fh = Math.floor(ih / n), fr = n > 1 ? Math.floor(S.t / .3) % 2 : 0, im = keyedIcon(e.img, p);
    const s = size / Math.max(iw, fh); const w = Math.round(iw * s), h = Math.round(fh * s); c.imageSmoothingEnabled = false; c.drawImage(im, 0, fr * fh, iw, fh, x + Math.round((size - w) / 2), y + size - h, w, h);
  }
  const ty = (y, h) => Math.round(y + (h - FT.cap) / 2) + 0;

  // ---------------------------------------------------------------- what is listed
  const inStorage = () => S.mode === 'storage';
  const layout = () => LAY[inStorage() ? 'storage' : 'bag'];
  const curIdx = () => (inStorage() ? 5 : S.pocket);
  function rows() {
    const s = sys(); if (!s) return [{ cancel: true }];
    const list = inStorage() ? s.list(S.src) : s.list('bag', POCKETS[S.pocket][0]);
    return list.concat([{ cancel: true }]);
  }
  const sel = () => { const r = rows(), i = clamp(S.cur[curIdx()], 0, r.length - 1); return r[i]; };
  function fixCursor() { const r = rows(), i = curIdx(), n = layout().rows.n; S.cur[i] = clamp(S.cur[i], 0, r.length - 1); if (S.cur[i] < S.top[i]) S.top[i] = S.cur[i]; if (S.cur[i] >= S.top[i] + n) S.top[i] = S.cur[i] - n + 1; S.top[i] = clamp(S.top[i], 0, Math.max(0, r.length - n)); }

  // ---------------------------------------------------------------- messages / stages
  function say(lines, then) { S.msgQ = [].concat(lines); S.msg = S.msgQ.shift(); S.stage = 'msg'; S.after = then || (() => { S.stage = 'list'; }); S.flash = 0; }
  function exitAll() { if (S.closed) return; S.closed = true; env.onExit && env.onExit(); }
  function openCtx() {
    const it = sel(); if (!it || it.cancel) { if (inStorage()) { S.stage = 'smenu'; return; } return exitAll(); }
    const s = sys(), opts = [];
    if (S.mode === 'bag') {
      opts.push(['USE', 'use']); if (s.canHold(it.key)) opts.push(['GIVE', 'give']);
      if (!(it.item && it.item.pocket === 'key')) opts.push(['TOSS', 'toss']); opts.push(['CANCEL', 'cancel']);
      S.menu = { opts, i: 0, key: it.key };
      S.stage = 'ctx';
    } else {
      if (S.act === 'toss') { S.qty = { n: 1, max: it.count, key: it.key, what: 'toss' }; S.stage = 'qty'; return; }
      S.qty = { n: 1, max: it.count, key: it.key, what: S.act }; S.stage = 'qty';
    }
  }
  function nameOf(k) { return sys() ? sys().name(k) : String(k); }
  function afterQty() {
    const q = S.qty, s = sys(), nm = nameOf(q.key);
    if (q.what === 'toss') { S.menu = { opts: [['YES', 'y'], ['NO', 'n']], i: 1, key: q.key, ask: true }; S.stage = 'yesno'; return; }
    if (q.what === 'withdraw') {
      if (!s.remove(q.key, q.n, 'pc')) return say('There is not enough.');
      const put = s.add(q.key, q.n); if (put < q.n) s.add(q.key, q.n - put, 'pc');
      return say(put ? 'Withdrew ' + nm + (put > 1 ? ' x' + put : '') + '.' : 'The bag is full.');
    }
    if (q.what === 'deposit') {
      if (!s.remove(q.key, q.n)) return say('There is not enough.');
      const put = s.add(q.key, q.n, 'pc'); if (put < q.n) s.add(q.key, q.n - put);
      return say(put ? 'Stored ' + nm + (put > 1 ? ' x' + put : '') + ' in the PC.' : 'The PC cannot hold any more.');
    }
  }
  function doToss() {
    const q = S.qty, s = sys(), where = inStorage() ? 'pc' : undefined, nm = nameOf(q.key);
    if (s.remove(q.key, q.n, where)) say('Threw away ' + nm + (q.n > 1 ? ' x' + q.n : '') + '.'); else say('There is not enough.');
  }
  function pickMon(what) { S.pick = { what, key: sel().key }; S.pc = clamp(S.pc, 0, Math.max(0, party().length - 1)); S.stage = 'party'; }
  function useOnPicked() {
    const s = sys(), m = party()[S.pc], k = S.pick.key; if (!m) return;
    const u = s.useInfo(k);
    if (S.pick.what === 'give') {
      const old = s.giveHeld(m, k); if (!s.remove(k, 1)) { s.giveHeld(m, old); return say('There is not enough.'); }
      const nm = (m.nickname || String(m.species).replace(/^SPECIES_/, '')).slice(0, 12);
      if (old) s.add(old, 1);
      return say(old ? [nm + ' was given ' + nameOf(k) + ' to hold.', 'It took ' + nameOf(old) + ' back.'] : nm + ' was given ' + nameOf(k) + ' to hold.', () => { S.stage = 'list'; });
    }
    if (u.kind === 'pp1') { S.pick.mon = m; S.mi = 0; S.stage = 'movepick'; return; }
    const r = s.useOnMon(k, m);
    if (!r.ok) return say(r.msg, () => { S.stage = 'party'; });
    s.remove(k, 1); say(r.msg, () => { S.stage = rows().length > 1 && sys().count(k) > 0 ? 'party' : 'list'; });
  }
  function useMove() {
    const s = sys(), m = S.pick.mon, k = S.pick.key, r = s.useOnMon(k, m, { moveIndex: S.mi });
    if (!r.ok) return say(r.msg, () => { S.stage = 'movepick'; });
    s.remove(k, 1); say(r.msg, () => { S.stage = 'list'; });
  }

  // ---------------------------------------------------------------- input
  function press(k) {
    if (S.closed) return; fixCursor();
    const st = S.stage, s = sys();
    if (st === 'msg') { if (k === 'a' || k === 'b') { if (S.msgQ.length) { S.msg = S.msgQ.shift(); S.flash = 0; } else { const f = S.after; S.after = null; S.stage = 'list'; if (f) f(); fixCursor(); } } return; }
    if (st === 'list') {
      const i = curIdx(), r = rows();
      if (k === 'up') S.cur[i] = Math.max(0, S.cur[i] - 1); else if (k === 'down') S.cur[i] = Math.min(r.length - 1, S.cur[i] + 1);
      else if (k === 'left' && !inStorage()) S.pocket = (S.pocket + POCKETS.length - 1) % POCKETS.length;
      else if (k === 'right' && !inStorage()) S.pocket = (S.pocket + 1) % POCKETS.length;
      else if (k === 'a') openCtx();
      else if (k === 'b') { if (inStorage()) S.stage = 'smenu'; else exitAll(); }
      fixCursor(); return;
    }
    if (st === 'ctx' || st === 'yesno' || st === 'smenu') {
      const menu = st === 'smenu' ? { opts: [['WITHDRAW', 'withdraw'], ['DEPOSIT', 'deposit'], ['TOSS', 'toss'], ['EXIT', 'exit']], i: S.sm } : S.menu, n = menu.opts.length;
      if (k === 'up') menu.i = (menu.i + n - 1) % n; else if (k === 'down') menu.i = (menu.i + 1) % n;
      else if (k === 'b') { if (st === 'smenu') exitAll(); else { S.stage = 'list'; } }
      else if (k === 'a') {
        const v = menu.opts[menu.i][1];
        if (st === 'smenu') { S.sm = menu.i; if (v === 'exit') return exitAll(); S.act = v; S.src = v === 'deposit' ? 'bag' : 'pc'; S.cur[5] = 0; S.top[5] = 0; S.stage = 'list'; if (!s.list(S.src).length) say(v === 'deposit' ? 'There is nothing to store.' : 'There is nothing in the PC.', () => { S.stage = 'smenu'; }); return; }
        if (st === 'yesno') { if (v === 'y') doToss(); else S.stage = 'list'; return; }
        const it = sel(); if (v === 'cancel') S.stage = 'list';
        else if (v === 'toss') { S.qty = { n: 1, max: it.count, key: it.key, what: 'toss' }; S.stage = 'qty'; }
        else if (v === 'give') pickMon('give');
        else if (v === 'use') { const u = s.useInfo(it.key); if (!u.usable) say(u.why || "This can't be used here yet."); else pickMon('use'); }
      }
      return;
    }
    if (st === 'qty') {
      const q = S.qty; if (k === 'up') q.n = q.n >= q.max ? 1 : q.n + 1; else if (k === 'down') q.n = q.n <= 1 ? q.max : q.n - 1;
      else if (k === 'right') q.n = Math.min(q.max, q.n + 10); else if (k === 'left') q.n = Math.max(1, q.n - 10);
      else if (k === 'b') S.stage = 'list'; else if (k === 'a') afterQty(); return;
    }
    if (st === 'party') {
      const n = party().length; if (!n) { S.stage = 'list'; return; }
      if (k === 'b') { S.stage = 'list'; return; }
      if (k === 'a') { useOnPicked(); return; }
      let c = S.pc; const col = c % 2, row = Math.floor(c / 2);
      if (k === 'left') c = col ? c - 1 : c; else if (k === 'right') c = col === 0 && c + 1 < n ? c + 1 : c; else if (k === 'up') c = row > 0 ? c - 2 : c; else if (k === 'down') c = c + 2 < n ? c + 2 : c;
      S.pc = c; return;
    }
    if (st === 'movepick') {
      const mv = (S.pick.mon.moves || []).filter(Boolean), n = mv.length || 1;
      if (k === 'up') S.mi = (S.mi + n - 1) % n; else if (k === 'down') S.mi = (S.mi + 1) % n; else if (k === 'b') S.stage = 'party'; else if (k === 'a') useMove();
    }
  }
  function click() {}

  // ---------------------------------------------------------------- drawing
  function box(c, x, y, w, h, fill = '#eef0fa', line = '#0c101e') { rect(c, x, y, w, h, line); rect(c, x + 1, y + 1, w - 2, h - 2, '#a8b0d8'); rect(c, x + 2, y + 2, w - 4, h - 4, fill); }
  function menuBox(c, opts, i, x, y, w) {
    const h = opts.length * 13 + 6; box(c, x, y, w, h);
    opts.forEach((o, j) => { if (j === i) tri(c, x + 5, y + 3 + j * 13 + 6, 3, '#d02838'); T(c, o[0], x + 12, ty(y + 3 + j * 13, 13), 'dark'); });
    return h;
  }
  function drawBase(c) {
    const kind = inStorage() ? 'storage' : 'bag', im = bgImg(kind);
    if (im) { c.imageSmoothingEnabled = false; c.drawImage(im, 0, 0, W, H); return; }
    // the picture is not there (yet): a plain stand-in so everything stays usable
    rect(c, 0, 0, W, H, inStorage() ? '#de3042' : '#141822');
    if (!inStorage()) { TABX.forEach(x => rect(c, x, 3, 34, 17, '#2b3350')); rect(c, 3, 33, 68, 78, '#1b2540'); for (let i = 0; i < 5; i++) rect(c, 74, 33 + i * 16, 162, 14, '#273258'); rect(c, 2, 113, 236, 45, '#0e1118'); }
    else { for (let i = 0; i < 6; i++) rect(c, 50, 10 + Math.round(i * 16.2), 156, 14, '#d6d3de'); rect(c, 0, 112, W, 48, '#393839'); rect(c, 0, 10, 46, 20, '#393839'); }
  }
  function drawTabs(c) {
    for (let i = 0; i < 6; i++) {
      const x = TABX[i], on = (i === S.pocket && i < 5) || (i === 5 && false), lab = i < 5 ? POCKETS[i][1] : 'EXIT';
      if (on) { rect(c, x, 3, 34, 17, 'rgba(255,255,255,.2)'); rect(c, x + 2, 18, 30, 2, '#ffd23c'); }
      const w = tw(lab); T(c, lab, x + Math.round((34 - w) / 2), ty(3, 16), on ? 'white' : 'mute');
    }
  }
  function drawRows(c) {
    const L = layout(), R = L.rows, r = rows(), i = curIdx(), top = S.top[i], dark = L.dark, shownSel = S.stage === 'list' || S.stage === 'ctx' || S.stage === 'qty' || S.stage === 'yesno';
    for (let n = 0; n < R.n; n++) {
      const e = r[top + n]; if (!e) break; const y = Math.round(R.y + n * R.pitch), isSel = top + n === S.cur[i];
      if (isSel && shownSel) { rect(c, R.x, y, R.w, R.h, 'rgba(255,214,60,.30)'); tri(c, R.x - 3 + (dark ? 4 : 1), y + R.h / 2, 3, '#ffd23c'); }
      if (e.cancel) { T(c, inStorage() ? 'CANCEL' : 'CLOSE BAG', L.nameX, ty(y, R.h), dark ? 'dark' : 'white'); continue; }
      const im = itemImg(e.key); if (im) drawFit(c, im, L.iconX, y - 1, 14, R.h + 2, 1);
      const nm = nameOf(e.key); T(c, nm, L.nameX, ty(y, R.h), dark ? 'dark' : 'white');
      if (!(e.item && e.item.pocket === 'key')) TR(c, '×' + e.count, L.qtyRight, ty(y, R.h), dark ? 'dark' : 'white');
    }
    // scroll marks
    if (top > 0) tri(c, R.x + R.w - 8, R.y - 2, 3, '#ffd23c'); if (top + R.n < r.length) tri(c, R.x + R.w - 8, Math.round(R.y + R.n * R.pitch) - 3, 3, '#ffd23c');
  }
  function wrap(text, wpx) {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
      let line = ''; for (const w of raw.split(' ')) { const t = line ? line + ' ' + w : w; if (tw(t) > wpx && line) { out.push(line); line = w; } else line = t; } out.push(line);
    }
    return out;
  }
  function drawBottom(c) {
    const L = layout(), X = L.text, e = S.stage === 'msg' ? null : sel();
    let text = '', k = null;
    if (S.stage === 'msg') text = S.msg;
    else if (S.stage === 'party') text = S.pick && S.pick.what === 'give' ? 'Give to which POKéMON?' : 'Use on which POKéMON?';
    else if (S.stage === 'movepick') text = 'Restore which move?';
    else if (S.stage === 'qty') text = ({ toss: 'Throw away how many?', withdraw: 'Withdraw how many?', deposit: 'Store how many?' })[S.qty.what] || 'How many?';
    else if (S.stage === 'yesno') text = 'Throw away ' + S.qty.n + ' ' + nameOf(S.qty.key) + '?';
    else if (S.stage === 'smenu') text = 'What would you like to do?';
    else if (e && e.cancel) text = inStorage() ? 'Return to the menu.' : 'Close the BAG.';
    else if (e) { k = e.key; text = e.item ? e.item.description : ''; }
    const kk = k || (S.stage === 'party' || S.stage === 'movepick' || S.stage === 'qty' || S.stage === 'yesno' ? (S.pick ? S.pick.key : S.qty && S.qty.key) : null);
    if (kk) { const im = itemImg(kk), B = L.iconBox; if (im) drawFit(c, im, B.x, B.y, B.s, B.s, 2); }
    const col = 'white', lines = S.stage === 'list' ? String(text).split('\n').filter((l, i, a) => !(l === '' && (i === 0 || a[i - 1] === ''))) : wrap(text, X.w);
    lines.slice(0, 4).forEach((l, i) => T(c, l, X.x, X.y + 1 + i * 12, col));
    if (S.stage === 'msg') { if (Math.floor(S.t * 2) % 2 === 0) tri(c, X.x + X.w - 6, X.y + 36, 3, '#ffffff'); }
  }
  function drawQty(c) {
    const q = S.qty, w = 58, x = inStorage() ? 142 : 172, y = inStorage() ? 76 : 88; box(c, x, y, w, 20);
    T(c, '×' + String(q.n).padStart(2, '0'), x + 8, ty(y, 20), 'dark'); tri(c, x + w - 12, y + 6, 2, '#6a7396'); tri(c, x + w - 12, y + 14, 2, '#6a7396');
  }
  function drawParty(c) {
    rect(c, 3, 22, 234, 90, '#0e1118'); const p = party();
    for (let i = 0; i < 6; i++) {
      const x = 6 + (i % 2) * 117, y = 25 + Math.floor(i / 2) * 29, w = 114, h = 27, m = p[i], on = i === S.pc;
      rect(c, x, y, w, h, on ? '#3a4a86' : '#1e2748'); rect(c, x, y, w, 1, on ? '#ffd23c' : '#364572'); rect(c, x, y + h - 1, w, 1, on ? '#ffd23c' : '#364572'); rect(c, x, y, 1, h, on ? '#ffd23c' : '#364572'); rect(c, x + w - 1, y, 1, h, on ? '#ffd23c' : '#364572');
      if (!m) continue;
      monIcon(c, m.species, x + 2, y + 1, 24);
      const nm = String(m.nickname || m.species).replace(/^SPECIES_/, '').toLowerCase().replace(/(^|_)(\w)/g, (z, a, b) => (a ? ' ' : '') + b.toUpperCase()).slice(0, 10);
      T(c, nm, x + 28, y + 1, 'white'); TR(c, '{Lv}' + m.level, x + w - 4, y + 1, 'white');
      const hp = Math.max(0, +m.HP || 0), mx = Math.max(1, +m.maxHP || 1), f = hp / mx;
      rect(c, x + 28, y + 12, 48, 4, '#0c101e'); rect(c, x + 29, y + 13, Math.round(46 * f), 2, f > .5 ? '#40d060' : f > .2 ? '#f0c820' : '#e03c3c');
      TR(c, hp + '/' + mx, x + w - 4, y + 11, 'mute');
      if (m.status && STATUS_LAB2[m.status]) { rect(c, x + 28, y + 17, 22, 9, STATUS_LAB2[m.status][1]); T(c, STATUS_LAB2[m.status][0], x + 30, y + 17, 'white'); }
      else if (S.pick && S.pick.what === 'give' && m.heldItem) T(c, nameOf(m.heldItem).slice(0, 12), x + 28, y + 18, 'mute');
      else if (hp <= 0) T(c, 'FAINTED', x + 28, y + 18, 'red');
    }
  }
  const STATUS_LAB2 = { psn: ['PSN', '#a040a0'], tox: ['PSN', '#782878'], brn: ['BRN', '#f08030'], par: ['PAR', '#c8a010'], slp: ['SLP', '#6870a0'], frz: ['FRZ', '#58a8c8'] };
  function drawMovePick(c) {
    rect(c, 3, 22, 234, 90, '#0e1118'); const mv = (S.pick.mon.moves || []).filter(Boolean);
    mv.forEach((m, i) => {
      const y = 28 + i * 20, on = i === S.mi; rect(c, 20, y, 200, 17, on ? '#3a4a86' : '#1e2748'); if (on) { rect(c, 20, y, 200, 1, '#ffd23c'); rect(c, 20, y + 16, 200, 1, '#ffd23c'); }
      const info = env.moveName ? env.moveName(m.moveId) : String(m.moveId).replace(/^MOVE_/, '').replace(/_/g, ' ');
      T(c, info, 28, ty(y, 17), 'white'); TR(c, 'PP ' + m.currentPP + '/' + m.maxPP, 212, ty(y, 17), 'white');
    });
  }
  function drawStorageHeader(c) {
    const lab = ({ withdraw: 'WITHDRAW', deposit: 'DEPOSIT', toss: 'TOSS' })[S.act] || 'ITEMS'; if (S.stage === 'smenu') return;
    T(c, lab, 4, ty(10, 20), 'white');
  }
  function render(c) {
    const s = sys(); c.imageSmoothingEnabled = false; c.clearRect(0, 0, W, H); drawBase(c);
    if (S.stage === 'party' || S.stage === 'movepick') { drawBase(c); }
    if (!inStorage()) { drawTabs(c); }
    // left panel (bag): big picture of the selected item
    if (!inStorage()) { const e = sel(); if (e && !e.cancel) { const im = itemImg(e.key); if (im) drawFit(c, im, 8, 44, 58, 58, 3); else if (!s) T(c, 'No ItemTable', 8, 60, 'mute'); } }
    if (inStorage() && S.stage === 'smenu') {
      const o = [['WITHDRAW', 0], ['DEPOSIT', 1], ['TOSS', 2], ['EXIT', 3]];
      o.forEach(([lab, j]) => { const R = layout().rows, y = Math.round(R.y + j * R.pitch); if (j === S.sm) { rect(c, R.x, y, R.w, R.h, 'rgba(255,214,60,.30)'); tri(c, R.x + 1, y + R.h / 2, 3, '#ffd23c'); } T(c, lab, layout().nameX, ty(y, R.h), 'dark'); });
    } else drawRows(c);
    if (inStorage()) drawStorageHeader(c);
    drawBottom(c);
    if (S.stage === 'ctx') menuBox(c, S.menu.opts, S.menu.i, 150, 108 - (S.menu.opts.length * 13 + 6), 82);
    if (S.stage === 'yesno') menuBox(c, S.menu.opts, S.menu.i, inStorage() ? 150 : 186, 108 - (S.menu.opts.length * 13 + 6), 46);
    if (S.stage === 'qty') drawQty(c);
    if (S.stage === 'party') drawParty(c);
    if (S.stage === 'movepick') drawMovePick(c);
  }
  function update(dt) { S.t += dt; }
  function start(o) {
    o = o || {}; S.mode = o.mode === 'storage' ? 'storage' : 'bag'; S.stage = S.mode === 'storage' ? 'smenu' : 'list'; S.closed = false; S.pocket = 0; S.cur = [0, 0, 0, 0, 0, 0]; S.top = [0, 0, 0, 0, 0, 0]; S.sm = 0; S.src = 'pc'; S.act = 'withdraw'; S.menu = null; S.msgQ = []; S.after = null;
    if (!sys()) console.warn('[BagMenu] ItemSystem.js is not loaded');
    else if (!sys().info('ITEM_POTION')) console.warn('[BagMenu] tables/ItemTables.js is not loaded');
    const d = env.db && env.db(); if (d) for (const m of party()) { const p = dbOf(m && m.species).iconSprite; if (p) getImg(p); }
    const sy = sys(); if (sy) { for (const e of sy.list('bag').concat(sy.list('pc'))) { const p = e.item && e.item.sprite; if (p) getImg(p); } }
    for (const k of ['bag', 'storage']) { const p = env.bgPaths && env.bgPaths()[k]; if (p) getImg(p); }
  }
  function status() { return { mode: S.mode, stage: S.stage, pocket: POCKETS[S.pocket][0], sel: (sel() || {}).key, rows: rows().length, bgBag: !!bgImg('bag'), bgStorage: !!bgImg('storage'), warnings: [...warnings] }; }
  return { S, W, H, press, click, update, render, start, initFont, status, rows, say };
}
root.BagMenuCore = createBag;
})(window);

// ---------------------------------------------------------------------------
// the overlay: BagMenu.open(scene)   (same idea as PokemonSummary.open)
// ---------------------------------------------------------------------------
(function (root) {
'use strict';
const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right', e: 'right', z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b' };
const KEY = 'bag_screen_canvas';
const BagMenu = {
  active: false,
  BG: { bag: 'graphics/ui/NB_BG.png', storage: 'graphics/ui/Item_Storage.png' },
  isOpen() { return this.active; },
  open(scene, opts) {
    if (this.active || !scene) return false; opts = opts || {};
    const gs = root.GameStateManager, sv = (gs && gs.saveData) || {};
    const core = root.BagMenuCore({
      urlFor: p => p,
      sys: () => root.ItemSystem, bgPaths: () => BagMenu.BG,
      party: () => (Array.isArray(sv.party) ? sv.party.filter(m => m && m.species) : []),
      db: () => (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : null),
      moveName: id => { try { const t = typeof MoveTable !== 'undefined' ? MoveTable : null; const m = t && (t.get ? t.get(id) : t[id]); if (m && m.name) return m.name; } catch (e) { /* ignore */ } return String(id).replace(/^MOVE_/, '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); },
      types: () => null,
      glyphs: () => { try { return typeof EmeraldFont !== 'undefined' ? new EmeraldFont(null).glyphMap : null; } catch (e) { return null; } },
      onExit: () => this.close(),
    });
    this.core = core; this.scene = scene; this.opts = opts; this.openedAt = performance.now(); this.active = true;
    const scr = (root.OW_TEXT && root.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 };
    core.initFont().then(() => {
      if (!this.active) return;
      core.start({ mode: opts.mode });
      if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
      this.tex = scene.textures.createCanvas(KEY, core.W, core.H);
      try { this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ }
      this.ctx = this.tex.getContext ? this.tex.getContext() : this.tex.context;
      this.img = scene.add.image(0, 0, KEY).setOrigin(0, 0).setScale(scr.w / core.W, scr.h / core.H).setScrollFactor(0).setDepth(9000);
      this.upd = (time, delta) => { core.update(Math.min(.05, delta / 1000)); core.render(this.ctx); this.tex.refresh(); };
      scene.events.on('update', this.upd);
    });
    this.kd = e => {
      const k = KEYS[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat && (k === 'a' || k === 'b')) return; if (performance.now() - this.openedAt < 250) return;
      core.press(k);
    };
    window.addEventListener('keydown', this.kd, true);
    return true;
  },
  close() {
    if (!this.active) return; this.active = false;
    window.removeEventListener('keydown', this.kd, true);
    const scene = this.scene;
    try { if (this.upd) scene.events.off('update', this.upd); if (this.img) this.img.destroy(); if (scene.textures.exists(KEY)) scene.textures.remove(KEY); } catch (e) { /* scene already gone */ }
    this.img = this.tex = this.ctx = this.upd = null;
    if (scene && scene.time) scene.scriptEndedAt = scene.time.now;     // the overworld ignores input for 300 ms, so the closing key does nothing there
    if (this.opts && this.opts.onClose) { const f = this.opts.onClose; this.opts = null; f(); }
  },
};
root.BagMenu = BagMenu;
})(window);
