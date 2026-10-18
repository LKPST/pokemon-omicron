// ===========================================================================
// PokemonSummary.js   (put it in js/, load it AFTER PokemonDatabase.js, TypeTables.js and GameStateManagerClass.js)
//
// The GBA-style party menu + summary screens (Info / Skills / Moves), drawn on a 240x160 canvas.
//
//  IN THE GAME   PokemonSummary.open(scene)    opens it over the TOP screen (OW_TEXT.screen, 480x320 = 240x160 at 2x).
//                PokemonSummary.close()        closes it.        PokemonSummary.isOpen()
//                The overworld opens it when the player presses Enter (see the [SUMMARY] lines in overworld_scene.js).
//
//  WHICH POKEMON?  GameStateManager.saveData.party  (the live save: loaded from the browser's local save at start-up and
//                  shaped like save.json). Empty slots (null) are skipped. If that is empty, the local save
//                  (localStorage 'pokemon_micron_save') is tried. Nothing is ever written back.
//
//  DATA IT USES    save mon       species, nickname, natdexID, level, exp, expmax, isShiny, gender, HP, maxHP, Attack, Def,
//                                 spattack, sdpef, speed, nature, ability, teraType, heldItem, ballId, OTName, OTID,
//                                 caughtloc, moves[{moveId,currentPP,maxPP}]
//                  PokemonDatabase  sprite (battleSprite), icon (iconSprite), cry, name, types, base stats, abilities
//                  TypeTable        (tables/TypeTables.js, made with type_icon_tool.html) type icons from your icon sheet
//                  EmeraldFont      the glyph map of js/utils/EmeraldFont.js (+ the accents / male / female signs it lacks)
//                  Move table       window.MoveDatabase / MoveTable / MoveTables if you have one (see moveInfo below)
//
//  SPECIAL TEXT    {Lv} {PP} {ID} {No} draw the little bitmap glyphs of the font.  /up/ /down/ /left/ /right/ draw arrows.
//
//  The same file runs in pokemon_summary.html (the preview / export tool): PokemonSummaryCore(env) is the engine.
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

// ---------------------------------------------------------------- built-in demo data (used only when your tables have nothing)
const pretty = s => String(s == null ? '' : s).replace(/^(MOVE|SPECIES|ABILITY|TYPE|ITEM|NATURE|RIBBON)_/, '').toLowerCase().split(/[_\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const DEMO = {
  BULBASAUR: { id: '001', name: 'Bulbasaur', t: ['TYPE_GRASS', 'TYPE_POISON'], b: [45, 49, 49, 65, 65, 45], abs: ['Overgrow'] },
  CHARMANDER: { id: '004', name: 'Charmander', t: ['TYPE_FIRE'], b: [39, 52, 43, 60, 50, 65], abs: ['Blaze'] },
  SQUIRTLE: { id: '007', name: 'Squirtle', t: ['TYPE_WATER'], b: [44, 48, 65, 50, 64, 43], abs: ['Torrent'] },
  PIKACHU: { id: '025', name: 'Pikachu', t: ['TYPE_ELECTRIC'], b: [35, 55, 40, 50, 50, 90], abs: ['Static'] },
  EEVEE: { id: '133', name: 'Eevee', t: ['TYPE_NORMAL'], b: [55, 55, 50, 45, 65, 55], abs: ['Run Away'] },
  MAGIKARP: { id: '129', name: 'Magikarp', t: ['TYPE_WATER'], b: [20, 10, 55, 15, 20, 80], abs: ['Swift Swim'] },
};
const MV = { // key: [name, type, power, accuracy, pp, description]
  TACKLE: ['Tackle', 'TYPE_NORMAL', 40, 100, 35, 'A full-body charge attack.'], GROWL: ['Growl', 'TYPE_NORMAL', 0, 100, 40, "Lowers the foe's Attack."],
  VINEWHIP: ['Vine Whip', 'TYPE_GRASS', 45, 100, 25, 'Strikes with slender vines.'], RAZORLEAF: ['Razor Leaf', 'TYPE_GRASS', 55, 95, 25, 'Cuts with sharp leaves. High crit rate.'],
  EMBER: ['Ember', 'TYPE_FIRE', 40, 100, 25, 'May inflict a burn.'], SCRATCH: ['Scratch', 'TYPE_NORMAL', 40, 100, 35, 'Scratches with sharp claws.'],
  WATERGUN: ['Water Gun', 'TYPE_WATER', 40, 100, 25, 'Squirts water to attack.'], THUNDERSHOCK: ['Thunder Shock', 'TYPE_ELECTRIC', 40, 100, 30, 'An electric blast. May paralyze.'],
  QUICKATTACK: ['Quick Attack', 'TYPE_NORMAL', 40, 100, 30, 'An almost invisible, fast attack.'], TAILWHIP: ['Tail Whip', 'TYPE_NORMAL', 0, 100, 30, "Lowers the foe's Defense."],
  SPLASH: ['Splash', 'TYPE_NORMAL', 0, 0, 40, 'Splashes around. Nothing happens.'], BITE: ['Bite', 'TYPE_DARK', 60, 100, 25, 'A fang attack. May cause flinching.'],
  CLOSECOMBAT: ['Close Combat', 'TYPE_FIGHTING', 120, 100, 5, 'A reckless all-out attack.'], BULLETPUNCH: ['Bullet Punch', 'TYPE_STEEL', 40, 100, 30, 'A fast punch. Always strikes first.'],
  SWORDSDANCE: ['Swords Dance', 'TYPE_NORMAL', 0, 0, 20, 'A dance that sharply raises Attack.'], IRONHEAD: ['Iron Head', 'TYPE_STEEL', 80, 100, 15, 'Slams with a hard head. May flinch.'],
};
const NATURES = { Hardy: [0, 0], Docile: [0, 0], Serious: [0, 0], Bashful: [0, 0], Quirky: [0, 0], Lonely: [1, 2], Brave: [1, 5], Adamant: [1, 3], Naughty: [1, 4], Bold: [2, 1], Relaxed: [2, 5], Impish: [2, 3], Lax: [2, 4],
  Timid: [5, 1], Hasty: [5, 2], Jolly: [5, 3], Naive: [5, 4], Modest: [3, 1], Mild: [3, 2], Quiet: [3, 5], Rash: [3, 4], Calm: [4, 1], Gentle: [4, 2], Sassy: [4, 5], Careful: [4, 3] };
const BALL_BY_ID = { 1: 'poke', 2: 'great', 3: 'ultra', 4: 'master', 5: 'premier' };
const BALLS = { poke: ['#e83848', '#f8f8f8'], great: ['#3868e0', '#f8f8f8'], ultra: ['#f0c820', '#383848'], premier: ['#f8f8f8', '#f8f8f8'], master: ['#9038c8', '#f8f8f8'] };
const TYPE_COL = { Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f0c820', Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0', Ground: '#d8b858', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820', Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#a8a8c0', Fairy: '#ee99ac', Stellar: '#58b8c8' };
const TLAB = { Normal: 'NORMAL', Fire: 'FIRE', Water: 'WATER', Electric: 'ELECT', Grass: 'GRASS', Ice: 'ICE', Fighting: 'FIGHT', Poison: 'POISON', Ground: 'GROUND', Flying: 'FLYING', Psychic: 'PSYCH', Bug: 'BUG', Rock: 'ROCK', Ghost: 'GHOST', Dragon: 'DRAGON', Dark: 'DARK', Steel: 'STEEL', Fairy: 'FAIRY', Stellar: 'STELLR' };
const wrapText = (s, n) => { const out = []; let cur = ''; for (const w of String(s).split(/\s+/).filter(Boolean)) { const t = cur ? cur + ' ' + w : w; if (t.length <= n || !cur) cur = t; else { out.push(cur); cur = w; } } if (cur) out.push(cur); return out; };
const normType = t => { t = String(t || ''); if (!t) return 'TYPE_NORMAL'; return /^TYPE_/.test(t) ? t : 'TYPE_' + t.toUpperCase().replace(/[^A-Z0-9]+/g, '_'); };

// ===========================================================================
//  ENGINE
//  env = {
//    urlFor(path)  -> url of a project file ('' = not available)       (default: the path itself)
//    db()          -> PokemonDatabase object or null
//    types()       -> TypeTable object or null
//    moves()       -> move table object or null
//    party()       -> array of save-format mons (nulls allowed)
//    ballType(id)  -> 'poke' | 'great' | 'ultra' | 'premier' | 'master'
//    glyphs()      -> glyph map override (optional)
//    onExit()      -> called when B is pressed on the party list
//  }
// ===========================================================================
function createSummary(env) {
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
      e.img.onerror = () => { e.fail = true; if (!failed.has(path)) { failed.add(path); warnings.add('image not found: ' + path); try { console.warn('[PS] could not load image: ' + path + '  (looked for it relative to your index.html)'); } catch (er) { /* no console */ } } };
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

  // ------------------------------------------------ species / moves / mon
  const warnings = new Set();
  let dbIndex = null, dbIndexFor = null;
  function speciesInfo(key) {
    const k = String(key || '').trim(), DB = env.db && env.db();
    if (DB) {
      if (dbIndexFor !== DB) { dbIndexFor = DB; dbIndex = new Map(); for (const kk of Object.keys(DB)) { const nk = kk.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!dbIndex.has(nk) || kk === 'SPECIES_NONE') dbIndex.set(nk, kk); } }
      const parts = k.split('_'), cand = [k, k.replace(/_/g, '')];
      for (let n = parts.length - 1; n >= 2; n--) cand.push(parts.slice(0, n).join('_'));
      const more = []; for (const c of cand) { const real = dbIndex.get(c.toUpperCase().replace(/[^A-Z0-9]/g, '')); if (real) more.push(real); }
      for (const cKey of [...cand, ...more]) { const e = DB[cKey]; if (e && typeof e === 'object' && !(cKey === 'SPECIES_NONE' && k !== 'SPECIES_NONE')) {
        if (cKey !== k) warnings.add(`${k}: not in PokemonDatabase, showing ${cKey}`);
        const m = /gSprite(\d+)/.exec(e.battleSprite || '');
        const ty = [e.type1, e.type2].filter(t => t && t !== 'TYPE_NONE'), ab = [e.ability1, e.ability2, e.hiddenAbility].map(a => a && a !== 'ABILITY_NONE' ? pretty(a) : '');
        return { id: m ? m[1] : '000', name: e.name && e.name !== 'None' ? e.name : pretty(cKey), t: ty.length ? ty : ['TYPE_NORMAL'],
          b: [e.baseHP, e.baseAttack, e.baseDefense, e.baseSpAttack, e.baseSpDefense, e.baseSpeed].map(v => v || 50), abs: ab, sprite: e.battleSprite, icon: e.iconSprite, cry: e.cry };
      } }
      warnings.add(`${k}: not found in PokemonDatabase`);
    }
    const up = k.toUpperCase().replace(/^SPECIES_/, '').replace(/[^A-Z0-9]/g, ''), d = DEMO[up];
    if (d) return { ...d, sprite: `graphics/pokemon_battle_sprites/battle/gSprite${d.id}${d.name}.png`, icon: `graphics/pokemon_battle_sprites/icons/gIconSprite${d.id}${d.name}.png`, cry: `audio/cries/gCry${d.name}.wav` };
    return { id: '000', name: pretty(k) || 'Unknown', t: ['TYPE_NORMAL'], b: [50, 50, 50, 50, 50, 50], abs: [], sprite: '', icon: '', cry: '' };
  }
  function moveTable() { try { return (env.moves && env.moves()) || null; } catch (e) { return null; } }
  let mvIdx = null, mvIdxFor = null;
  function findMove(MT, id, key) {      // exact key, the table's own get(), then a loose match (MOVE_CLOSECOMBAT = MOVE_CLOSE_COMBAT)
    let e = MT[id] || MT[id.toUpperCase()]; if (e && typeof e === 'object') return e;
    if (typeof MT.get === 'function') { try { e = MT.get(id); if (e) return e; } catch (er) { /* ignore */ } }
    if (mvIdxFor !== MT) { mvIdxFor = MT; mvIdx = new Map(); for (const k of Object.keys(MT)) mvIdx.set(k.toUpperCase().replace(/^MOVE_/, '').replace(/[^A-Z0-9]/g, ''), MT[k]); }
    return mvIdx.get(key) || null;
  }
  function moveInfo(x) {
    const id = typeof x === 'string' ? x : String((x && (x.moveId || x.id || x.name || x.move)) || ''), MT = moveTable();
    const key = id.toUpperCase().replace(/^MOVE_/, '').replace(/[^A-Z0-9]/g, ''), e = MT && findMove(MT, id, key), d = MV[key];
    let name, type, pow, acc, ppMax, desc;
    if (e) { name = e.name || e.moveName || pretty(id); type = e.type || e.moveType; pow = e.power ?? e.basePower ?? e.pow ?? 0; acc = e.accuracy ?? e.acc ?? 0; ppMax = e.pp ?? e.maxPP; desc = e.description || e.desc || e.effectText || ''; }
    else if (d) { [name, type, pow, acc, ppMax, desc] = d; }
    else { name = pretty(id) || '---'; type = 'TYPE_NORMAL'; pow = 0; acc = 0; ppMax = 20; desc = ''; }
    const maxPP = (x && x.maxPP) ?? ppMax ?? 20, cur = (x && x.currentPP) ?? maxPP;
    return { name: String(name).slice(0, 12), type: normType(type), pow, acc, ppMax: maxPP, pp: cur, desc: String(desc || '') };
  }
  function buildMon(raw) {
    const sp = speciesInfo(raw.species), L = clamp(parseInt(raw.level) || 5, 1, 100), nat = NATURES[pretty(raw.nature) || 'Hardy'] || [0, 0];
    const iv = [raw.ivhp, raw.ivatk, raw.ivdef, raw.ivspa, raw.ivspd, raw.ivspe].map(v => v ?? 15);
    const calc = i => { const b = sp.b[i]; if (i === 0) return Math.floor((2 * b + iv[0]) * L / 100) + L + 10; const v = Math.floor((2 * b + iv[i]) * L / 100) + 5; return Math.floor(v * (nat[0] === i ? 1.1 : nat[1] === i ? .9 : 1)); };
    const stats = [raw.maxHP ?? calc(0), raw.Attack ?? calc(1), raw.Def ?? calc(2), raw.spattack ?? calc(3), (raw.sdpef ?? raw.spdef) ?? calc(4), raw.speed ?? calc(5)];
    const exp = raw.exp ?? L ** 3, expN = raw.expmax ?? (L + 1) ** 3;
    const g = String(raw.gender || '').toUpperCase(), tera = raw.teraType && raw.teraType !== 'TYPE_NONE' ? raw.teraType : '';
    const item = raw.heldItem && raw.heldItem !== 'ITEM_NONE' ? pretty(raw.heldItem) : '';
    return { sp, rawSpecies: raw.species, species: sp.name, nick: String(raw.nickname || sp.name).slice(0, 10), dex: raw.natdexID ?? parseInt(sp.id, 10), types: sp.t, lv: L, stats, max: stats[0], hp: clamp(raw.HP ?? stats[0], 0, stats[0]),
      natUp: nat[0], natDown: nat[1], nature: pretty(raw.nature) || 'Hardy', ability: pretty(raw.ability) || sp.abs[0] || '-', gender: g === 'MALE' || g === 'M' ? 'M' : g === 'FEMALE' || g === 'F' ? 'F' : '',
      ball: (env.ballType ? env.ballType(raw.ballId) : BALL_BY_ID[raw.ballId]) || 'poke', item, tera, ot: raw.OTName || 'PLAYER', idno: String(raw.OTID ?? 0).padStart(5, '0'),
      exp, expN, moves: (raw.moves || []).slice(0, 4).map(moveInfo), sprite: sp.sprite, icon: sp.icon, cry: sp.cry, shiny: !!raw.isShiny, place: pretty(raw.caughtloc) || 'Unknown' };
  }

  // ------------------------------------------------ state
  const S = { view: 'party', sel: 0, page: 0, mv: 0, mvMode: false, t: 0, rowT: 0, selT: 9, statP: 1, hpShown: [], party: [], tr: null, pg: null };
  function rebuild(keepHp) {
    warnings.clear();
    const old = S.hpShown, raws = (env.party ? env.party() : []).filter(Boolean).slice(0, 6);
    S.party = raws.map(buildMon);
    S.party.forEach(m => { getImg(m.sprite); getImg(m.icon); });
    const TT = env.types && env.types(); if (TT && TT.sheet) getImg(TT.sheet);
    if (!TT) warnings.add('TypeTable not found: load tables/TypeTables.js before PokemonSummary.js (text badges are used)');
    else { if (!TT.sheet) warnings.add('TypeTable has no sheet path'); for (const m of S.party) for (const ty of [...m.types, m.tera]) if (ty && !(TT.types && TT.types[ty] && TT.types[ty].icon)) warnings.add('no icon rect in TypeTable for ' + ty); }
    S.hpShown = S.party.map((m, i) => keepHp && old[i] !== undefined ? old[i] : 0);
    S.sel = Math.min(S.sel, Math.max(0, S.party.length - 1));
    if (!keepHp) { S.rowT = 0; S.statP = 0; S.view = 'party'; S.tr = null; S.pg = null; S.page = 0; S.mvMode = false; }
  }
  function reset() { imgs.clear(); }

  // ------------------------------------------------ background (per pixel, crisp)
  const bgc = mk(W, H), bgx = bgc.getContext('2d'), bgd = bgx.createImageData(W, H), bd = bgd.data, RCX = 198, RCY = 86, ringR = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ringR[y * W + x] = Math.hypot(x + .5 - RCX, y + .5 - RCY);
  const CR1 = [216, 50, 74], CR2 = [208, 46, 70], CD1 = [168, 38, 62], CD2 = [158, 34, 56], CP = [230, 236, 249], CW = [255, 255, 255], CE = [238, 106, 128];
  function drawBg(t) {
    const rot = t * .3, sn = Math.sin(rot), cs = Math.cos(rot), off = Math.floor(t * 18);
    for (let y = 0; y < H; y++) {
      const edge = 172 - y * .375;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = edge - x; let c;
        if (d < 0) { const r = ringR[i], v = -(x - RCX) * sn + (y - RCY) * cs; c = ((r >= 40 && r <= 46) || (r >= 9 && r <= 13) || (r > 13 && r < 40 && Math.abs(v) <= 5)) ? CW : CP; }
        else if (d < 2) c = CE; else if (d < 24) c = (((x + y + off) >> 4) & 1) ? CD2 : CD1; else c = (((x + y + off) >> 4) & 1) ? CR2 : CR1;
        const j = i * 4; bd[j] = c[0]; bd[j + 1] = c[1]; bd[j + 2] = c[2]; bd[j + 3] = 255;
      }
    }
    bgx.putImageData(bgd, 0, 0);
  }

  // ------------------------------------------------ sprites and icons
  const tmpC = mk(200, 200), tmpX = tmpC.getContext('2d');
  function frameInfo(e) { const iw = e.img.naturalWidth, ih = e.img.naturalHeight, n = opt.frames === 'auto' ? (iw / ih >= 3.5 ? 4 : 1) : +opt.frames; return { n, fw: Math.floor(iw / n), fh: ih }; }
  function drawSprite(c, m, cx, bottom, bw, bh, pop, flash) {
    const e = getImg(m.sprite);
    if (!e || e.fail || !m.sprite) { ball(c, cx - 13, bottom - 30, m.ball, 3); return; }
    if (!e.ok) return;
    const fi = frameInfo(e), fr = (m.shiny || opt.shinyFrame) && fi.n > 1 ? 1 : 0; let s = Math.min(bw / fi.fw, bh / fi.fh);
    s = s >= 2 ? Math.floor(s) : s > 1 ? Math.floor(s * 2) / 2 : s; s *= pop;
    const dw = Math.max(1, Math.round(fi.fw * s)), dh = Math.max(1, Math.round(fi.fh * s)), dx = Math.round(cx - dw / 2), dy = Math.round(bottom - dh);
    c.imageSmoothingEnabled = false;
    if (flash > 0) {
      tmpC.width = dw; tmpC.height = dh; tmpX.imageSmoothingEnabled = false; tmpX.clearRect(0, 0, dw, dh); tmpX.drawImage(e.img, fr * fi.fw, 0, fi.fw, fi.fh, 0, 0, dw, dh);
      tmpX.globalCompositeOperation = 'source-atop'; tmpX.fillStyle = `rgba(255,255,255,${flash})`; tmpX.fillRect(0, 0, dw, dh); tmpX.globalCompositeOperation = 'source-over'; c.drawImage(tmpC, dx, dy);
    } else c.drawImage(e.img, fr * fi.fw, 0, fi.fw, fi.fh, dx, dy, dw, dh);
  }
  // Pokemon icon sheets come with a solid background colour (the colour of the top-left pixel). It is made transparent here:
  // only background that touches the edge of the sheet is removed (flood fill), so same-coloured pixels inside the Pokemon stay.
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
    try { console.log('[PS] icon background: ' + (label || '') + ' -> ' + note); } catch (e) { /* no console */ }
    iconKeyed.set(img, out); return out;
  }
  function drawIcon(c, m, x, y, sel, i) {
    const e = getImg(m.icon);
    if (!e || e.fail || !m.icon) { ball(c, x + 9, y + 14, m.ball, 2); return; }
    if (!e.ok) return;
    const iw = e.img.naturalWidth, ih = e.img.naturalHeight, n = ih >= iw * 2 ? 2 : 1, fh = Math.floor(ih / n), fr = n > 1 ? Math.floor(S.t / (sel ? .16 : .7) + i) % 2 : 0;
    c.imageSmoothingEnabled = false; c.drawImage(keyedIcon(e.img, m.icon), 0, fr * fh, iw, fh, x + Math.round((32 - iw) / 2), y + 32 - fh, iw, fh);
  }
  const genderGlyph = (c, g, xr, y) => { if (g === 'M') TR(c, '♂', xr, y, 'blue'); else if (g === 'F') TR(c, '♀', xr, y, 'red'); };
  function hpBar(c, x, y, w, h, frac, sel) {
    rect(c, x - 1, y - 1, w + 2, h + 2, sel ? '#9aa2c0' : '#2a2a3a'); rect(c, x, y, w, h, '#586080');
    const f = Math.ceil(w * frac); if (f > 0) rect(c, x, y, f, h, frac > .5 ? '#38c850' : frac > .2 ? '#f0c820' : '#f03838');
  }

  // ------------------------------------------------ PARTY view
  function drawParty(c) {
    for (let i = 0; i < 6; i++) {
      const m = S.party[i], sl = ease(clamp((S.rowT - i * .06) / .35)), x = 8 + Math.round(-(1 - sl) * 150), y = 3 + i * 26;
      if (!m) { pill(c, x, y, 136, 25, 'rgba(110,16,40,.35)'); continue; }
      const sel = i === S.sel, tc = sel ? 'white' : 'dark';
      pill(c, x, y + 1, 136, 25, sel ? '#000000' : '#9aa6cc'); pill(c, x, y, 136, 25, sel ? '#1c1c28' : '#fbfcff');
      ell(c, x + 16, y + 20, 12, 3, sel ? '#3c3e52' : '#cdd3e6');
      drawIcon(c, m, x, y - 8, sel, i);
      const nx = T(c, m.nick, x + 32, y + 3, tc); if (m.shiny) star(c, nx + 2, y + 5);
      genderGlyph(c, m.gender, x + 130, y + 3);
      T(c, '{Lv}' + m.lv, x + 32, y + 14, tc);
      const hs = S.hpShown[i] || 0; const ht = `${Math.round(hs)}/${m.max}`; hpBar(c, x + 62, y + 16, Math.max(16, Math.min(36, 132 - tw(ht) - 4 - 62)), 3, hs / m.max, sel); TR(c, ht, x + 132, y + 14, tc);
    }
    const m = S.party[S.sel];
    if (S.party.length) { const ax = 1 + Math.round(Math.sin(S.t * 9) * 1.2), cy = 3 + S.sel * 26 + 12; tri(c, ax - 1, cy, 6, '#1c1c28'); tri(c, ax, cy, 5, '#ffffff'); }
    TR(c, 'POKéMON', 234, 4, 'mute');
    if (m) {
      ell(c, 196, 118, 30, 5, '#c4cfee'); const pp = clamp(S.selT / .3), sc = pp < 1 ? backOut(pp) : 1, bob = Math.sin(S.t * 3.2) > 0 ? 1 : 0;
      drawSprite(c, m, 196, 118 - bob, 92, 80, Math.max(.2, sc), S.selT < .09 ? .85 : 0);
      const nx = T(c, m.nick, 150, 127, 'dark'); genderGlyph(c, m.gender, nx + 9, 127); TR(c, '{Lv}' + m.lv, 234, 127, 'dark');
      badges(c, m.types, 150, 141);
    }
  }

  // ------------------------------------------------ SUMMARY view
  const PAGE_TITLE = ['POKéMON INFO', 'POKéMON SKILLS', 'KNOWN MOVES'], PW = 134;
  function ring(c, x0, y0, rot, col) {
    const R = 33; c.fillStyle = col;
    for (let dy = -R; dy <= R; dy++) {
      const wo = Math.sqrt(R * R - dy * dy), wi = Math.abs(dy) < R - 7 ? Math.sqrt((R - 7) * (R - 7) - dy * dy) : -1;
      if (wi < 0) c.fillRect(Math.round(x0 - wo), y0 + dy, Math.round(wo * 2), 1); else { c.fillRect(Math.round(x0 - wo), y0 + dy, Math.round(wo - wi), 1); c.fillRect(Math.round(x0 + wi), y0 + dy, Math.round(wo - wi), 1); }
    }
    const sn = Math.sin(rot), cs = Math.cos(rot);
    for (let yy = -R + 8; yy <= R - 8; yy++) for (let xx = -R + 8; xx <= R - 8; xx++) { const r = Math.hypot(xx, yy), v = -xx * sn + yy * cs; if (r < R - 7 && r > 11 && Math.abs(v) <= 4) c.fillRect(x0 + xx, y0 + yy, 1, 1); }
    for (let dy = -12; dy <= 12; dy++) {
      const wo = Math.sqrt(144 - dy * dy), wi = Math.abs(dy) <= 8 ? Math.sqrt(64 - dy * dy) : -1;
      if (wi < 0) c.fillRect(Math.round(x0 - wo), y0 + dy, Math.round(wo * 2), 1); else { c.fillRect(Math.round(x0 - wo), y0 + dy, Math.round(wo - wi), 1); c.fillRect(Math.round(x0 + wi), y0 + dy, Math.round(wo - wi), 1); }
    }
  }
  function drawSummary(c) {
    const m = S.party[S.sel]; if (!m) return;
    pill(c, 4, 3, 232, 15, '#6a1226'); pill(c, 4, 2, 232, 15, '#1c1c28');
    const showPage = S.pg && S.pg.p < .5 ? S.pg.from : S.page; T(c, PAGE_TITLE[showPage], 12, 5, 'white');
    T(c, '/left/', 183, 5, S.page > 0 ? 'white' : 'mute'); T(c, '/right/', 226, 5, S.page < 2 ? 'white' : 'mute');
    for (let i = 0; i < 3; i++) { const on = i === S.page, pulse = on && Math.sin(S.t * 7) > 0; pill(c, 194 + i * 11, 6, 9, 6, on ? (pulse ? '#ffffff' : '#d8dcff') : '#5a5e7c', 3); }
    pill(c, 4, 22, 90, 136, '#9aa6cc'); pill(c, 4, 21, 90, 136, '#ffffff', 8);
    c.save(); c.beginPath(); c.rect(4, 21, 90, 86); c.clip(); pill(c, 4, 21, 90, 136, '#e6ecf9', 8); ring(c, 49, 60, S.t * .3, '#ffffff'); c.restore();
    ell(c, 49, 100, 26, 4, '#c4cfee');
    const pp = clamp(S.selT / .3), sc = pp < 1 ? backOut(pp) : 1, bob = Math.sin(S.t * 3.2) > 0 ? 1 : 0;
    drawSprite(c, m, 49, 100 - bob, 76, 72, Math.max(.2, sc), S.selT < .09 ? .85 : 0);
    const nx = T(c, m.nick, 10, 110, 'dark'); if (m.shiny) star(c, nx + 2, 112); genderGlyph(c, m.gender, 88, 110);
    T(c, '{Lv}' + m.lv, 10, 124, 'dark'); ball(c, 76, 123, m.ball, 1);
    badges(c, m.types, 8, 141);
    pill(c, 98, 22, 138, 136, '#9aa6cc'); pill(c, 98, 21, 138, 136, '#fafbff', 8);
    c.save(); c.beginPath(); c.rect(100, 23, PW, 132); c.clip();
    if (S.pg) {
      const p = ease(clamp(S.pg.p)), d = S.pg.to > S.pg.from ? 1 : -1;
      c.save(); c.translate(Math.round(-d * p * PW), 0); drawPage(c, S.pg.from, m); c.restore();
      c.save(); c.translate(Math.round(d * (1 - p) * PW), 0); drawPage(c, S.pg.to, m); c.restore();
    } else drawPage(c, S.page, m);
    c.restore();
  }
  function drawPage(c, idx, m) {
    const x0 = 106, dot = y => { for (let x = 104; x < 230; x += 4) rect(c, x, y, 2, 1, '#c2cae6'); };
    if (idx === 0) {
      const rows = [['{No}', String(m.dex).padStart(3, '0')], ['Name', m.species], ['Type'], ['Tera'], ['OT', m.ot], ['{ID}No.', m.idno], ['Item', m.item || 'None']].filter(r => r[0] !== 'Tera' || m.tera);
      const step = rows.length > 6 ? 13 : 14;
      rows.forEach((r, i) => {
        const y = 26 + i * step; T(c, r[0], x0, y, 'mute');
        if (r[0] === 'Type') badges(c, m.types, x0 + 42, y - 2); else if (r[0] === 'Tera') badges(c, [m.tera], x0 + 42, y - 2); else T(c, r[1], x0 + 42, y, 'dark');
      });
      const yd = 26 + rows.length * step + 3; dot(yd);
      wrapText(`${m.nature} nature. Met at ${m.place}.`, 21).slice(0, 2).forEach((ln, i) => T(c, ln, x0, yd + 5 + i * 13, 'dark'));
    } else if (idx === 1) {
      const names = ['HP', 'Attack', 'Defense', 'Sp.Atk', 'Sp.Def', 'Speed'], cols = ['#4cc860', '#e85a4c', '#e8a43c', '#4c8ce8', '#58c8b8', '#d868c8'], cap = 50 + m.lv * 4;
      names.forEach((n, i) => {
        const y = 25 + i * 12; T(c, n, x0, y, i && i === m.natUp ? 'red' : i && i === m.natDown ? 'blue' : 'mute');
        rect(c, x0 + 44, y + 3, 44, 4, '#d6dcf0'); rect(c, x0 + 44, y + 3, Math.round(44 * clamp(m.stats[i] / cap) * S.statP), 4, cols[i]);
        TR(c, i === 0 ? `${m.hp}/${m.max}` : String(m.stats[i]), x0 + 124, y, 'dark');
      });
      dot(100);
      T(c, 'Ability', x0, 105, 'mute'); T(c, m.ability, x0 + 50, 105, 'dark');
      T(c, 'Exp.', x0, 118, 'mute'); TR(c, String(m.exp), x0 + 124, 118, 'dark');
      T(c, 'Next Lv.', x0, 131, 'mute'); TR(c, String(Math.max(0, m.expN - m.exp)), x0 + 124, 131, 'dark');
      const fr = clamp(m.exp / Math.max(1, m.expN)) * S.statP; rect(c, x0, 145, 124, 4, '#d6dcf0'); rect(c, x0, 145, Math.round(124 * fr), 4, '#4c8ce8');
    } else {
      for (let i = 0; i < 4; i++) {
        const y = 25 + i * 24, mo = m.moves[i], on = S.mvMode && i === S.mv, k = on ? 'white' : 'dark', km = on ? 'white' : 'mute';
        if (on) pill(c, x0 - 3, y - 1, 128, 22, '#1c1c28', 6); else rect(c, x0, y + 22, 122, 1, '#e0e5f4');
        if (!mo) { T(c, '-', x0 + 44, y + 6, km); continue; }
        badge(c, mo.type, x0, y + 4); T(c, mo.name, x0 + 44, y + 1, k);
        T(c, '{PP}', x0 + 44, y + 12, km); T(c, ` ${mo.pp}/${mo.ppMax}`, x0 + 44 + advOf('PP'), y + 12, k);
        TR(c, mo.pow ? 'Pwr' + mo.pow : '---', x0 + 122, y + 12, km);
      }
      dot(122); const cur = m.moves[S.mv] || m.moves[0]; if (cur) wrapText(cur.desc, 21).slice(0, 2).forEach((ln, i) => T(c, ln, x0, 127 + i * 13, 'dark'));
    }
  }

  // ------------------------------------------------ render
  const lA = mk(W, H), lB = mk(W, H), lAx = lA.getContext('2d'), lBx = lB.getContext('2d'); lAx.imageSmoothingEnabled = lBx.imageSmoothingEnabled = false;
  const layer = (cv, x, view) => { x.clearRect(0, 0, W, H); (view === 'party' ? drawParty : drawSummary)(x); return cv; };
  function render(ctx) {
    if (!rawSheet) return;
    ctx.imageSmoothingEnabled = false; drawBg(S.t); ctx.drawImage(bgc, 0, 0);
    if (S.tr) {
      const p = ease(clamp(S.tr.p)), dir = S.tr.to === 'summary' ? -1 : 1;
      layer(lA, lAx, S.tr.from); layer(lB, lBx, S.tr.to); ctx.drawImage(lA, Math.round(dir * p * W), 0); ctx.drawImage(lB, Math.round(-dir * (1 - p) * W), 0);
    } else { layer(lA, lAx, S.view); ctx.drawImage(lA, 0, 0); }
  }
  function renderSettled(view, page) {     // a finished frame (no animation in progress), for PNG export
    const k = { view: S.view, page: S.page, tr: S.tr, pg: S.pg, rowT: S.rowT, selT: S.selT, statP: S.statP, hp: S.hpShown, mvMode: S.mvMode };
    S.view = view; S.page = page; S.tr = null; S.pg = null; S.rowT = 9; S.selT = 9; S.statP = 1; S.hpShown = S.party.map(m => m.hp); S.mvMode = false;
    const c = mk(W, H); render(c.getContext('2d'));
    S.view = k.view; S.page = k.page; S.tr = k.tr; S.pg = k.pg; S.rowT = k.rowT; S.selT = k.selT; S.statP = k.statP; S.hpShown = k.hp; S.mvMode = k.mvMode; return c;
  }

  // ------------------------------------------------ input / update
  function cry() {
    if (!opt.cries) return; const m = S.party[S.sel]; if (!m || !m.cry) return;
    try { const u = urlFor(m.cry); if (!u) return; const a = new Audio(u); a.volume = .6; a.play().catch(() => {}); } catch (e) { /* no sound */ }
  }
  function select(i) { if (i === S.sel) return; S.sel = i; S.selT = 0; S.statP = 0; cry(); }
  function setPage(p) { p = clamp(p, 0, 2); if (p === S.page) return; S.pg = { from: S.page, to: p, p: 0 }; S.page = p; S.statP = 0; S.mvMode = false; }
  function go(v) { S.tr = { from: S.view, to: v, p: 0 }; S.mvMode = false; if (v === 'summary') { S.page = 0; S.pg = null; S.statP = 0; S.selT = 0; cry(); } }
  function press(k) {
    if (S.tr || !S.party.length) { if (k === 'b' && !S.tr && env.onExit) env.onExit(); return; }
    const n = S.party.length;
    if (S.view === 'party') { if (k === 'up') select((S.sel + n - 1) % n); else if (k === 'down') select((S.sel + 1) % n); else if (k === 'a') go('summary'); else if (k === 'b' && env.onExit) env.onExit(); }
    else {
      if (S.mvMode) { if (k === 'up') S.mv = (S.mv + 3) % 4; else if (k === 'down') S.mv = (S.mv + 1) % 4; else if (k === 'b' || k === 'left') S.mvMode = false; return; }
      if (k === 'up') select((S.sel + n - 1) % n); else if (k === 'down') select((S.sel + 1) % n);
      else if (k === 'left') setPage(S.page - 1); else if (k === 'right') setPage(S.page + 1);
      else if (k === 'a' && S.page === 2) { S.mvMode = true; S.mv = 0; } else if (k === 'b') go('party');
    }
  }
  function click(x, y) {     // x, y in 240x160 screen pixels
    if (S.tr) return;
    if (S.view === 'party') { const i = Math.floor((y - 3) / 26); if (x >= 8 && x <= 144 && i >= 0 && i < S.party.length && (y - 3) % 26 < 25) { if (i === S.sel) press('a'); else select(i); } }
    else if (y < 18) { if (x >= 190) { const i = Math.floor((x - 194) / 11); if (i >= 0 && i < 3) setPage(i); } else press('b'); }
    else if (S.page === 2 && x >= 100 && y >= 24 && y < 122) { const i = Math.floor((y - 24) / 24); if (i < 4) { S.mvMode = true; S.mv = i; } }
  }
  function update(dt) {
    S.t += dt; S.rowT += dt; S.selT += dt; S.statP = Math.min(1, S.statP + dt / .6);
    if (S.tr) { S.tr.p += dt / .3; if (S.tr.p >= 1) { S.view = S.tr.to; S.tr = null; } }
    if (S.pg) { S.pg.p += dt / .22; if (S.pg.p >= 1) S.pg = null; }
    S.party.forEach((m, i) => { const cur = S.hpShown[i] || 0, d = m.hp - cur, st = Math.max(.5, m.max * .6) * dt; S.hpShown[i] = Math.abs(d) <= st ? m.hp : cur + Math.sign(d) * st; });
  }
  function status() {
    let sp = 0, ic = 0; for (const m of S.party) { const a = imgs.get(m.sprite), b = imgs.get(m.icon); if (a && a.ok) sp++; if (b && b.ok) ic++; }
    const TT = env.types && env.types(), sh = TT && TT.sheet ? imgs.get(TT.sheet) : null, DB = env.db && env.db();
    return { mons: S.party.map(m => ({ nickname: m.nick, saveSpecies: m.rawSpecies, showing: m.species, types: m.types, sprite: m.sprite, spriteLoaded: !!(imgs.get(m.sprite) && imgs.get(m.sprite).ok), icon: m.icon, iconLoaded: !!(imgs.get(m.icon) && imgs.get(m.icon).ok) })), typeSheetPath: TT && TT.sheet, font: fontSrc, species: DB ? Object.keys(DB).length : 0, count: S.party.length, sprites: sp, icons: ic, typeTable: !!TT, typeSheet: !!(sh && sh.ok), moveTable: !!moveTable(), warnings: [...warnings] };
  }
  return { S, opt, W, H, press, click, update, render, rebuild, reset, initFont, status, renderSettled, buildMon };
}
root.PokemonSummaryCore = createSummary;

// ===========================================================================
//  GAME PART (Phaser): PokemonSummary.open(scene)
// ===========================================================================
const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right', e: 'right', z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b' };
const SAVE_KEY = 'pokemon_micron_save';
function gameParty() {
  const gs = root.GameStateManager, pick = o => { let p = o && (o.party || o.playerParty || (o.saveData && o.saveData.party)); if (p && !Array.isArray(p) && typeof p === 'object') p = Object.values(p); return Array.isArray(p) ? p.filter(m => m && typeof m === 'object') : []; };
  let party = pick(gs && gs.saveData);
  if (!party.length) party = pick(gs);
  if (!party.length) { for (const k of [SAVE_KEY, 'save', 'saveData', 'pokemon_save']) { try { const o = JSON.parse(localStorage.getItem(k) || 'null'); party = pick(o); if (party.length) break; } catch (e) { /* not json */ } } }
  return party;
}
const PokemonSummary = {
  active: false,
  isOpen() { return this.active; },

  open(scene, opts = {}) {
    if (this.active || !scene) return false;
    const party = gameParty();
    console.info('[PokemonSummary] open: ' + party.length + ' Pokemon in the party');
    if (!party.length) { console.warn('[PokemonSummary] the party is empty: GameStateManager.saveData.party has no Pokemon, and no local save was found'); return false; }
    // (typeof works for tables declared with `const` in your other scripts, window.X would not)
    const core = createSummary({
      urlFor: p => p,
      db: () => (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : null),
      types: () => (typeof TypeTable !== 'undefined' ? TypeTable : (PokemonSummary._tt || null)),
      moves: () => (typeof MoveDatabase !== 'undefined' && MoveDatabase) || (typeof MoveTable !== 'undefined' && MoveTable) || (typeof MoveTables !== 'undefined' && MoveTables) || null,
      party: () => gameParty(),
      glyphs: () => { try { return typeof EmeraldFont !== 'undefined' ? new EmeraldFont(null).glyphMap : null; } catch (e) { return null; } },
      onExit: () => this.close(),
    });
    core.opt.cries = opts.cries !== false;
    this.core = core; this.scene = scene; this.opts = opts; this.openedAt = performance.now();
    const scr = (root.OW_TEXT && root.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 };
    core.initFont().then(() => {
      if (!this.active) return;
      core.rebuild(false);
      setTimeout(() => { if (PokemonSummary.active && PokemonSummary.logging) PokemonSummary.debug(); }, 1500);
      const key = 'ps_screen_canvas';
      if (scene.textures.exists(key)) scene.textures.remove(key);
      this.tex = scene.textures.createCanvas(key, W, H);
      try { this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ }
      this.ctx = this.tex.getContext ? this.tex.getContext() : this.tex.context;
      this.img = scene.add.image(0, 0, key).setOrigin(0, 0).setScale(scr.w / W, scr.h / H).setScrollFactor(0).setDepth(9000);
      this.upd = (time, delta) => { core.update(Math.min(.05, delta / 1000)); core.render(this.ctx); this.tex.refresh(); };
      scene.events.on('update', this.upd);
    });
    if (typeof TypeTable === 'undefined' && !this._tt) {   // not loaded by a script tag: fetch it and say exactly what went wrong
      const url = opts.typeTablesUrl || 'tables/TypeTables.js';
      fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url + ' (file missing or named wrongly: it must be exactly tables/TypeTables.js)'); return r.text(); })
        .then(txt => { const o = new Function('window', txt + '\n;return typeof TypeTable!=="undefined"?TypeTable:null')({}); if (!o) throw new Error(url + ' loaded but it does not define TypeTable'); this._tt = o; console.warn('[PS] TypeTable was not defined by a <script> tag, so ' + url + ' was fetched instead. Add <script src="' + url + '"></script> to index.html.'); if (this.active) core.rebuild(true); })
        .catch(e => console.error('[PS] TypeTables.js problem: ' + e.message));
    }
    this.active = true;
    this.kd = e => {
      const k = KEYS[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || performance.now() - this.openedAt < 250) return;
      core.press(k);
    };
    window.addEventListener('keydown', this.kd, true);
    return true;
  },

  close() {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('keydown', this.kd, true);
    const scene = this.scene;
    try { if (this.upd) scene.events.off('update', this.upd); if (this.img) this.img.destroy(); if (scene.textures.exists('ps_screen_canvas')) scene.textures.remove('ps_screen_canvas'); } catch (e) { /* scene already gone */ }
    this.img = this.tex = this.ctx = this.upd = null;
    if (scene && scene.time) scene.scriptEndedAt = scene.time.now;     // the overworld ignores input for 300 ms, so the closing key does nothing there
    if (this.opts && this.opts.onClose) this.opts.onClose();
  },
};
root.PokemonSummary = PokemonSummary;

// ---------------------------------------------------------------- Enter key + logger (works even if the scene file has no [SUMMARY] patch)
// Every Enter press prints a "[PS]" line to the console with what the game looked like at that moment.
// Switch it off with PokemonSummary.logging = false.  PokemonSummary.debug() prints the state any time.
PokemonSummary.logging = true;
const psLog = (...a) => { if (PokemonSummary.logging) console.log('%c[PS]', 'color:#7fa4ff;font-weight:bold', ...a); };
function psScenes() {
  const out = [];
  try { for (const g of psGames()) for (const s of g.scene.getScenes(false)) out.push({ s, active: g.scene.isActive(s.scene.key) }); } catch (e) { psLog('could not list scenes:', e.message); }
  return out;
}
// Phaser.GAMES is empty in newer Phaser builds, so the game object is searched for: Phaser.GAMES, then any global that is a Phaser.Game
// (a `const game = new Phaser.Game()` is not on window, so also try typeof game / phaserGame), then PokemonSummary.game if you set it.
let psGameCache = null;
function psGames() {
  const found = new Set(), P = root.Phaser, isGame = g => g && typeof g === 'object' && g.scene && typeof g.scene.getScenes === 'function' && g.loop;
  if (PokemonSummary.game && isGame(PokemonSummary.game)) found.add(PokemonSummary.game);
  if (psGameCache && isGame(psGameCache)) found.add(psGameCache);
  if (P && P.GAMES) for (const g of P.GAMES) if (isGame(g)) found.add(g);
  const tryGlobal = f => { try { const g = f(); if (isGame(g)) found.add(g); } catch (e) { /* not declared */ } };
  tryGlobal(() => game); tryGlobal(() => phaserGame); tryGlobal(() => gameInstance); tryGlobal(() => window.game);
  if (!found.size) { try { for (const k of Object.getOwnPropertyNames(root)) { let v; try { v = root[k]; } catch (e) { continue; } if (isGame(v)) { found.add(v); break; } } } catch (e) { /* ignore */ } }
  const arr = [...found]; if (arr[0]) psGameCache = arr[0]; return arr;
}
function psState() {
  const all = psScenes(), ow = all.map(o => o.s).find(s => s && s.player && s.OverworldMaps === undefined && s.currentMapKey !== undefined) || all.map(o => o.s).find(s => s && s.player);
  return {
    loaded: true, open: PokemonSummary.active,
    phaser: !!root.Phaser, games: psGames().length,
    scenes: all.map(o => `${o.s.scene.key}${o.active ? ' (active)' : ''}`),
    overworldScene: ow ? ow.scene.key : null,
    sceneHasEnterKey: !!(ow && ow.enterKey),
    scriptRunning: ow ? !!ow.scriptRunning : null, isLocked: ow ? !!ow.isLocked : null, isMoving: ow ? !!ow.isMoving : null,
    partySize: gameParty().length, saveParty: !!(root.GameStateManager && root.GameStateManager.saveData && root.GameStateManager.saveData.party),
    types: typeof TypeTable !== 'undefined', db: typeof PokemonDatabase !== 'undefined',
  };
}
PokemonSummary.debug = () => {
  const s = psState(); console.log('[PS] state', s);
  const c = PokemonSummary.core; if (c) { const st = c.status(); console.table(st.mons); console.log('[PS] type icons: TypeTable ' + (st.typeTable ? 'found' : 'NOT found') + ', sheet ' + st.typeSheetPath + ' -> ' + (st.typeSheet ? 'loaded' : 'NOT loaded') + ' | font: ' + st.font); if (st.warnings.length) console.warn('[PS] warnings:\n' + st.warnings.join('\n')); }
  else console.log('[PS] the screen is not open: open it with Enter, then call PokemonSummary.debug() again');
  return s;
};
window.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.repeat) return;
  const st = psState(); psLog('Enter pressed', st);
  if (PokemonSummary.active) return;
  // the scene's own [SUMMARY] code opens it on its next update; if it has not, we do it here after a short wait
  setTimeout(() => {
    if (PokemonSummary.active) { psLog('opened by the scene'); return; }
    const all = psScenes().filter(o => o.active).map(o => o.s), sc = all.find(s => s.player && s.currentMapKey !== undefined) || all.find(s => s.player);
    if (!sc) { psLog('NOT OPENED: no active scene with a player was found. Scenes:', st.scenes, '| games found:', st.games, '| If games is 0 add this line after you create the game: PokemonSummary.game = game;'); return; }
    if (sc.scriptRunning) { psLog('NOT OPENED: a script is running'); return; }
    if (sc.isLocked) { psLog('NOT OPENED: scene.isLocked is true'); return; }
    if (sc.isMoving) { psLog('NOT OPENED: the player is moving'); return; }
    psLog('the scene did not open it, opening from the key listener (is the [SUMMARY] patch in overworld_scene.js?)');
    const ok = PokemonSummary.open(sc); psLog('open() returned', ok);
  }, 60);
});
psLog('PokemonSummary.js loaded. Press Enter in the game; PokemonSummary.debug() prints the state.', psState());
})(window);
