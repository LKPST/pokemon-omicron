// ===========================================================================
// js/BattleScene.js      REPLACES your old BattleScene.js  (scene key is still 'BattleScene')
//
// Load order in index.html (all before the scene is used):
//   PokemonDatabase.js, MoveTables.js, LearnsetTables.js, EvolutionTables.js, TypeTables.js, TrainerTables.js, BattleEngine.js, BattleScene.js
//   (EmeraldFont.js is used if present, ThrowPokeBallAnim.js is no longer needed by this scene but can stay)
//   and add BattleScene to your Phaser scene list like before.
//
// START IT      this.scene.start('BattleScene', {name:'Roxanne'})     <- what `trainerbattle Roxanne single` does: the team, sprite, class, prize
//                                                                   money and texts come from TrainerTable (tables/TrainerTables.js)
//               this.scene.start('BattleScene', {name:'Portia', pokemon:[{species:'SPECIES_RATTATA', level:5}]})   (explicit team, overrides the table)
//               this.scene.start('BattleScene', {kind:'wild', pokemon:[{species:'SPECIES_PIDGEY', level:3}], bg:'grass'})
//   data: kind 'wild'|'trainer' (default: trainer when name/trainerName is given), name/trainerName, pokemon [{species, level, isShiny?, moves?, item?, ability?}],
//         bg 'grass'|'cave'|'water'|'indoor'|'sand', bag (default: saveData.bag / items / inventory), skipIntro,
//         foeTrainerSprite, playerTrainerSprite (paths), returnScene (default 'OverworldScene'), returnData, onEnd(result)
//
// WHAT IT READS   GameStateManager.saveData.party (the live Pokemon: HP, exp, level, moves are written back when the battle ends),
//                 opponentPartyMon1 / activeOpponentNameBankA / ...SpriteBankA / ...MoneyBankA, PokemonDatabase (sprite sheets, cry, xPos/yPos offsets).
//
// LAYOUT        Two 240x155 screens drawn at 2x: TOP = the field, BOTTOM = messages and menus (size is taken from the game canvas:
//               top = (canvas height - 4) / 2). Override with BattleScene.LAYOUT = {topH: 310, gap: 4}.
//
// AFTER A BATTLE   caught Pokemon go into the first free party slot (else pcStorage[0]); a trainer win adds the prize money;
//                  a loss heals the party. GameStateManager.lastBattle = {result, evolutions, ...}; GameStateManager.onBattleEnd(result) is called if you define it.
//                  Then the scene returns to BattleScene.RETURN_SCENE ('OverworldScene').
//
// EDITOR KEYS   Y switches between your Pokemon and the foe; T F G H nudge the focused Pokemon. The console prints the xPosFront / yPosFront
//               (foe) or xPosBack / yPosBack (yours) to put in PokemonDatabase (the Pokemon editor has those fields). They are used as a shift from the default spot (503,107 / 129,359), the same numbers your old scene used.
//
//   Keys: arrows / WASD, Z / Enter / Space = A, X / Esc / Backspace = B.
// ===========================================================================
(function (root) {
'use strict';
const W = 240, H = 155;
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

function createBattle(env) {
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
      e.img.onerror = () => { e.fail = true; if (!failed.has(path)) { failed.add(path); warnings.add('image not found: ' + path); try { console.warn('[BS] could not load image: ' + path + '  (looked for it relative to your index.html)'); } catch (er) { /* no console */ } } };
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

  // ================================================== state
  // Two 240x155 surfaces (GBA pixels, drawn 2x): TOP = the field (sprites, HP boxes, effects), BOTTOM = messages and menus.
  const BE = () => root.BattleEngine;
  const NORMK = s => String(s == null ? '' : s).toUpperCase().replace(/^(ABILITY|ITEM|MOVE|SPECIES|TYPE)_/, '').replace(/[^A-Z0-9]/g, '');
  const S = {
    b: null, mode: 'idle', q: [], cur: null, t: 0, fade: 1, fadeDir: -1, onFade: null,
    lines: [], pages: [], page: 0, shown: 0, textWait: 0, typed: false,
    sides: [mkSide(), mkSide()], weather: null, terrain: null,
    cmd: 0, mv: 0, pty: 0, bagSel: 0, bagTop: 0, ctx: 'switch', yn: 0, learn: null, partyMsg: '', mvMsg: '', bagMsg: '',
    bag: [], bgKind: 'grass', result: null, ballFx: null, particles: [], levelBox: null, introT: 0,
    tr: { me: { path: '', vis: false, ox: 130, frame: 0 }, foe: { path: '', vis: false, ox: -130, frame: 0 } },
    ball: { path: 'graphics/poke_ball/gInterfaceGfx_PokeBall.png', fw: 16, fh: 16 }, sparkle: { path: 'graphics/poke_ball/Sparkle.png', fw: 32, fh: 32, frames: 6 },
    hit: {}, editMode: false, introIcon: 'graphics/battle_scene/pokeball_icon_battle_start.png', nudged: [{ x: 0, y: 0 }, { x: 0, y: 0 }], focus: 0,
  };
  function mkSide() { return { vis: false, name: '', species: '', level: 1, hp: 1, maxhp: 1, dhp: 1, status: null, shiny: false, gender: '', idx: 0, ox: 0, oy: 0, dx: 0, dy: 0, alpha: 1, scale: 1, blink: 0, exp: 0, hpFrom: 0, hpTo: 0 }; }
  const side = i => S.sides[i];
  let FLASH = .45, SLIDE = 1.15;   // intro lengths (seconds); BattleScene.CONFIG.intro overrides
  // layout of the TOP surface (GBA pixels)
  // Live values: copied every frame from BattleScene.CONFIG (see the top of BattleScene.js), so editing the config in the console moves things at once.
  const FOE = { cx: 170, bottom: 74, platY: 72, platX: 170, trX: 170, boxX: 6, boxY: 6, boxW: 104, fit: 64, scale: 0, trBottom: 74, trScale: 1 };
  const ALLY = { cx: 60, bottom: 112, platY: 110, platX: 60, trX: 60, boxX: 126, boxY: 84, boxW: 108, fit: 64, scale: 1, trBottom: 112, trScale: 1 };
  const CF = { levelBox: { x: 148, y: 26 }, ball: 1, msg: { x: 4, y: 111, w: 232, h: 42 }, info: { x: 4, y: 4 }, party: { x: 4, y: 12, gap: 38, show: true }, btn: { x: 4, y: 56, w: 112, h: 44, gapX: 8, gapY: 4 } };
  function applyConfig() {
    const g = root.BattleScene && root.BattleScene.CONFIG; if (!g) return; const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    for (const [o, k] of [[FOE, 'foe'], [ALLY, 'ally']]) {
      const c = g[k]; if (!c) continue;
      o.cx = num(c.x, o.cx); o.bottom = num(c.bottom, o.bottom); o.platY = num(c.platform, o.bottom - 2 * (k === 'ally')); o.fit = num(c.fit, o.fit); o.scale = num(c.scale, o.scale);
      o.platX = num(c.platformX, o.cx); o.trX = num(c.trainerX, o.cx); o.trBottom = num(c.trainerBottom, o.trBottom); o.trScale = num(c.trainerScale, o.trScale);
      if (c.box) { o.boxX = num(c.box.x, o.boxX); o.boxY = num(c.box.y, o.boxY); o.boxW = num(c.box.w, o.boxW); }
    }
    if (g.intro) { FLASH = Math.max(0, num(g.intro.flash, FLASH)); SLIDE = Math.max(.05, num(g.intro.slide, SLIDE)); }
    CF.ball = num(g.ballScale, CF.ball); if (g.levelBox) { CF.levelBox.x = num(g.levelBox.x, CF.levelBox.x); CF.levelBox.y = num(g.levelBox.y, CF.levelBox.y); }
    const bt = g.bottom; if (bt) for (const k of ['msg', 'btn', 'info', 'party']) if (bt[k]) for (const f of Object.keys(CF[k])) CF[k][f] = k === 'party' && f === 'show' ? bt[k][f] !== false : num(bt[k][f], CF[k][f]);
  }

  // ------------------------------------------------ colour helpers
  const rgbOf = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixHex = (h, t, a) => '#' + rgbOf(h).map(v => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join('');
  const lighten = (h, a) => mixHex(h, 255, a), darken = (h, a) => mixHex(h, 0, a);

  // ------------------------------------------------ background removal (same rule as the old scene: top-left pixel colour = transparent,
  // only when the sheet is not already transparent)
  const keyedBg = new WeakMap();
  function keyBg(img) {
    if (keyedBg.has(img)) return keyedBg.get(img);
    let out = img;
    try {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (w && h) {
        const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        const id = x.getImageData(0, 0, w, h), d = id.data;
        if (d[3] !== 0) { const r = d[0], g = d[1], b = d[2]; for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) d[i + 3] = 0; x.putImageData(id, 0, 0); out = c; }
      }
    } catch (e) { out = img; }
    keyedBg.set(img, out); return out;
  }
  const loaded = path => { const e = path && getImg(path); return e && e.ok ? e : null; };

  // ------------------------------------------------ species lookups
  function spData(sp) { const b = S.b; return (b && b.speciesData(sp)) || {}; }
  function spritePath(sp) { const d = spData(sp); return d.battleSprite || d.frontSprite || ''; }
  function iconPath(sp) { return spData(sp).iconSprite || ''; }
  function frameCount(e) { const iw = e.img.naturalWidth, ih = e.img.naturalHeight; if (!iw || !ih) return 1; return iw / ih >= 3.5 ? 4 : 1; }
  // Sprites have transparent padding under the feet. feetPad = number of empty rows at the bottom of a frame (scan from the bottom row up until a
  // pixel is found), so the lowest opaque pixel can be put exactly on the grass / platform line.
  const padCache = new WeakMap();
  function feetPad(src, sx, sy, fw, fh) {
    let m = padCache.get(src); if (!m) padCache.set(src, m = new Map());
    const k = sx + ',' + sy + ',' + fw + ',' + fh; if (m.has(k)) return m.get(k);
    let pad = 0;
    try {
      const cv = mk(fw, fh), x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(src, sx, sy, fw, fh, 0, 0, fw, fh);
      const d = x.getImageData(0, 0, fw, fh).data; let last = -1;
      for (let y = fh - 1; y >= 0 && last < 0; y--) for (let xx = 0; xx < fw; xx++) if (d[(y * fw + xx) * 4 + 3] > 8) { last = y; break; }
      pad = last < 0 ? 0 : fh - 1 - last;
    } catch (e) { pad = 0; }
    m.set(k, pad); return pad;
  }
  function drawMon(c, sd, front, cx, bottom, maxPx, wantScale) {
    if (!sd.vis || !sd.species || sd.alpha <= 0) return;
    const path = spritePath(sd.species), e = getImg(path), pop = sd.scale;
    if (!e || e.fail || !path) { const bx = Math.round(cx + sd.dx + sd.ox - 13 * pop), by = Math.round(bottom + sd.dy + sd.oy - 30); S.hit[front ? 'foeMon' : 'allyMon'] = { x: bx, y: by, w: 26, h: 30 }; ball(c, bx, by, 'poke', 3); return; }
    if (!e.ok) return;
    const n = frameCount(e), fw = Math.floor(e.img.naturalWidth / n), fh = e.img.naturalHeight;
    let fr = 0;
    if (n >= 4) fr = front ? (sd.shiny ? 1 : 0) : (sd.shiny ? 3 : 2); else if (n > 1) fr = front && sd.shiny ? 1 : 0;
    let s = wantScale || Math.min(maxPx / fw, maxPx / fh); s = s >= 2 ? Math.floor(s) : s > 1 ? Math.floor(s * 2) / 2 : s; s *= pop;
    const dw = Math.max(1, Math.round(fw * s)), dh = Math.max(1, Math.round(fh * s)), dx = Math.round(cx + sd.dx + sd.ox - dw / 2), dy = Math.round(bottom + sd.dy + sd.oy - dh + feetPad(keyBg(e.img), fr * fw, 0, fw, fh) * s);
    if (dw <= 1 || dh <= 1) return;
    S.hit[front ? 'foeMon' : 'allyMon'] = { x: dx, y: dy, w: dw, h: dh };
    c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = clamp(sd.alpha);
    if (sd.blink > 0 && Math.floor(S.t * 16) % 2 === 0) c.globalAlpha *= 0.15;
    c.drawImage(keyBg(e.img), fr * fw, 0, fw, fh, dx, dy, dw, dh); c.restore();
  }
  function drawTrainer(c, tr, cx, bottom, scale, back) {
    if (!tr.vis || !tr.path) return; const e = loaded(tr.path); if (!e) return;
    const img = keyBg(e.img), iw = e.img.naturalWidth, ih = e.img.naturalHeight; let fw = iw, fh = ih, sx = 0, sy = 0;
    if (back) { fw = fh = 64; const cols = Math.max(1, Math.floor(iw / 64)), rows = Math.max(1, Math.floor(ih / 64)); let fr = tr.frame | 0; if (fr >= cols * rows) fr = 0; sx = (fr % cols) * 64; sy = Math.floor(fr / cols) * 64; }
    const dw = Math.round(fw * scale), dh = Math.round(fh * scale);
    const tx = Math.round(cx + tr.ox - dw / 2), ty = Math.round(bottom - dh + feetPad(img, sx, sy, fw, fh) * scale); S.hit[back ? 'allyTrainer' : 'foeTrainer'] = { x: tx, y: ty, w: dw, h: dh };
    c.imageSmoothingEnabled = false; c.drawImage(img, sx, sy, fw, fh, tx, ty, dw, dh);
  }
  function drawBallSprite(c, x, y, rot, scale) {
    const e = loaded(S.ball.path);
    if (!e) { ball(c, Math.round(x - 9), Math.round(y - 9), 'poke', 2); return; }
    const img = keyBg(e.img), fw = S.ball.fw, fh = S.ball.fh;
    c.save(); c.imageSmoothingEnabled = false; c.translate(Math.round(x), Math.round(y)); c.rotate(rot || 0); c.drawImage(img, 0, 0, fw, fh, -fw * scale / 2, -fh * scale / 2, fw * scale, fh * scale); c.restore();
  }
  function drawSparkle(c, x, y, t) {
    const sp = S.sparkle, e = loaded(sp.path), idx = Math.floor(t * 20);
    if (e) {
      if (idx >= sp.frames) return; const img = keyBg(e.img), cols = Math.max(1, Math.floor(e.img.naturalWidth / sp.fw));
      const sx = (idx % cols) * sp.fw, sy = Math.floor(idx / cols) * sp.fh, sc = 2;
      c.imageSmoothingEnabled = false; c.drawImage(img, sx, sy, sp.fw, sp.fh, Math.round(x - sp.fw * sc / 2), Math.round(y - sp.fh * sc / 2), sp.fw * sc, sp.fh * sc); return;
    }
    const p = clamp(t / .3); if (p >= 1) return; c.globalAlpha = 1 - p; c.fillStyle = '#fff8c0';
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, r = 4 + p * 20; c.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r) - 1, 3, 3); } c.globalAlpha = 1;
  }
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
    try { console.log('[BS] icon background: ' + (label || '') + ' -> ' + note); } catch (e) { /* no console */ }
    iconKeyed.set(img, out); return out;
  }
  function drawIconAt(c, sp, x, y, sel, i) {
    const path = iconPath(sp), e = getImg(path);
    if (!e || e.fail || !path) { ball(c, x + 9, y + 14, 'poke', 2); return; }
    if (!e.ok) return;
    const iw = e.img.naturalWidth, ih = e.img.naturalHeight, n = ih >= iw * 2 ? 2 : 1, fh = Math.floor(ih / n), fr = n > 1 ? Math.floor(S.t / (sel ? .16 : .7) + i) % 2 : 0;
    c.imageSmoothingEnabled = false; c.drawImage(keyedIcon(e.img, path), 0, fr * fh, iw, fh, x + Math.round((32 - iw) / 2), y + 32 - fh, iw, fh);
  }

  // ------------------------------------------------ big text (2x glyphs, for the menu buttons)
  const twb = s => tw(s) * 2;
  function Tb(c, s, x, y, k = 'white') {
    const f = font(TX[k][0], TX[k][1]); let cx = x;
    for (const g of glyphs(s)) { if (g.gl) c.drawImage(f, g.gl.c * 8, g.gl.r * 16, 8, 16, cx, y - FT.top * 2 + opt.nudge, 16, 32); cx += g.adv * 2; }
    return cx;
  }
  const Tc = (c, s, x, w, y, k, big) => { const wd = big ? twb(s) : tw(s); (big ? Tb : T)(c, s, Math.round(x + (w - wd) / 2), y, k); };

  // ------------------------------------------------ move / item helpers
  function mvInfo(key) { const m = S.b && S.b.mv(key); return m ? { name: m.name, type: m.type, power: m.power, acc: m.accuracy, split: m.split, key: m.key, mv: m } : { name: pretty(key), type: 'TYPE_NORMAL', power: 0, acc: 0, split: 'STATUS', key, mv: null }; }
  const TYPE_COLOR = k => { const TT = env.types && env.types(), te = TT && TT.types && TT.types[k]; return (te && te.color) || TYPE_COL[pretty(k)] || '#a8a878'; };
  const BALL_KIND = k => { const n = NORMK(k); return n === 'GREATBALL' ? 'great' : n === 'ULTRABALL' ? 'ultra' : n === 'PREMIERBALL' ? 'premier' : n === 'MASTERBALL' ? 'master' : 'poke'; };
  const isBall = k => /BALL$/.test(NORMK(k));
  const STATUS_LAB = { psn: ['PSN', '#a040a0', 'white'], tox: ['PSN', '#782878', 'white'], brn: ['BRN', '#f08030', 'white'], par: ['PAR', '#f0c820', 'dark'], slp: ['SLP', '#8890a8', 'white'], frz: ['FRZ', '#58b8d8', 'white'] };
  const HEAL_ITEMS = new Set('POTION SUPERPOTION HYPERPOTION MAXPOTION FULLRESTORE ANTIDOTE PARALYZEHEAL AWAKENING BURNHEAL ICEHEAL FULLHEAL REVIVE MAXREVIVE XATTACK XDEFENSE XSPEED XSPATK XSPECIAL XSPDEF XACCURACY DIREHIT ETHER MAXETHER FRESHWATER SODAPOP LEMONADE MOOMOOMILK BERRYJUICE'.split(' '));
  const prettyItem = k => pretty(String(k).replace(/^ITEM_/, '')).replace(/\bPoke\b/, 'Poké');
  function normBag(list) {
    const out = [];
    if (Array.isArray(list)) { for (const e of list) { if (!e) continue; const item = e.item || e.id || e.key || e.name, count = e.count != null ? e.count : (e.qty != null ? e.qty : (e.quantity != null ? e.quantity : 1)); if (item && count > 0) out.push({ item, count, name: e.label || prettyItem(item), ref: e }); } }
    else if (list && typeof list === 'object') { for (const k of Object.keys(list)) { const v = list[k]; const count = typeof v === 'number' ? v : (v && (v.count || v.qty || v.quantity)) || 0; if (count > 0) out.push({ item: k, count, name: prettyItem(k) }); } }
    return out.filter(e => isBall(e.item) || HEAL_ITEMS.has(NORMK(e.item)));
  }
  function itemWorks(item, M) {
    const k = NORMK(item);
    if (k === 'REVIVE' || k === 'MAXREVIVE') return M.hp <= 0;
    if (M.hp <= 0) return false;
    if (/POTION|FRESHWATER|SODAPOP|LEMONADE|MOOMOOMILK|BERRYJUICE/.test(k)) return M.hp < M.maxhp;
    if (k === 'FULLRESTORE') return M.hp < M.maxhp || !!M.status;
    const cure = { ANTIDOTE: ['psn', 'tox'], PARALYZEHEAL: ['par'], AWAKENING: ['slp'], BURNHEAL: ['brn'], ICEHEAL: ['frz'], FULLHEAL: ['psn', 'tox', 'par', 'slp', 'brn', 'frz'] }[k];
    if (cure) return !!M.status && cure.indexOf(M.status) >= 0;
    return true;
  }

  // ================================================== starting a battle
  // o: { kind:'wild'|'trainer', trainerName, player:[save mons], foe:[{species,level,...}], bag, bg, seed, money, onEnd,
  //      foeTrainerSprite, playerTrainerSprite, ballSheet:{path,fw,fh}, sparkleSheet, introIcon, skipIntro }
  function start(o) {
    o = o || {};
    const E = BE(); if (!E) throw new Error('BattleEngine.js is not loaded (load it before BattleScene.js)');
    const ee = env.engine ? env.engine() : {};
    const foe = (o.foe || []).map(f => (f && f.species && f.moves && (f.HP != null || f.maxHP != null || f.Attack != null)) ? f : E.makeMon({ db: ee.db, moves: ee.moves, learn: ee.learn }, f.species || f.key, f.level || 5, Object.assign({}, f.opts || f, f.isShiny != null ? { shiny: f.isShiny ? 1 : 0 } : (f.shiny != null ? { shiny: f.shiny ? 1 : 0 } : {}), f.ivs === 31 ? { maxIV: true, ivs: undefined } : {})));
    S.b = E.create(Object.assign({}, ee, { kind: o.kind || 'wild', trainerName: o.trainerName || 'Trainer', ai: o.ai, items: o.items, player: o.player || [], foe, seed: o.seed, money: o.money, noExp: o.noExp, expMultiplier: o.expMultiplier, weather: o.weather }));
    S.onEnd = o.onEnd || env.onEnd || null; S.bgKind = o.bg || 'grass'; S.mapWeather = o.weather || null; S.mapFx = !!o.weather; S.bag = normBag(o.bag != null ? o.bag : (env.bag && env.bag()));
    S.sides = [mkSide(), mkSide()]; S.q = []; S.cur = null; S.lines = []; S.pages = []; S.result = null; S.t = 0; S.weather = S.mapWeather; S.terrain = null; S.particles = []; S.ballFx = null; S.levelBox = null;
    S.fade = 1; S.fadeDir = -1; S.done = false; S.editMode = false; S.finished = null; S.onFade = null; S.noAuto = false; S.nudged = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const skip = !!o.skipIntro;
    S.tr = { me: { path: o.playerTrainerSprite || '', vis: !skip && !!o.playerTrainerSprite, ox: skip ? 0 : 130, frame: 0 }, foe: { path: o.foeTrainerSprite || '', vis: !skip && S.b.kind === 'trainer' && !!o.foeTrainerSprite, ox: skip ? 0 : -130, frame: 0 } };
    if (o.ballSheet) S.ball = Object.assign({}, S.ball, o.ballSheet); if (o.sparkleSheet) S.sparkle = Object.assign({}, S.sparkle, o.sparkleSheet); if (o.introIcon) S.introIcon = o.introIcon;
    for (const m of [...S.b.sides[0].party, ...S.b.sides[1].party]) { getImg(spritePath(m.species)); getImg(iconPath(m.species)); }
    for (const p of [S.tr.me.path, S.tr.foe.path, S.ball.path, S.sparkle.path, S.introIcon, ...SPARKS]) if (p) getImg(p);
    S.introT = 0; S.stripPlayed = false; S.stripT = 0; S.introTextSet = false; S.preShown = null; S.mode = skip ? 'play' : 'intro'; S.q = S.b.start().slice(); if (skip) S.fadeDir = -1;
    // wild battle: the wild Pokémon slides in from the left WHILE the player's trainer slides in (like the original), not after it
    S.introFoe = null;
    if (!skip && S.b.kind === 'wild') {
      const ev = S.q.find(e => e.t === 'switchin' && e.side === 1);
      if (ev) {
        const sd = side(1); sd.vis = true; sd.name = ev.name; sd.species = ev.species; sd.level = ev.level; sd.hp = ev.hp; sd.maxhp = ev.maxhp; sd.dhp = ev.hp; sd.status = ev.status || null; sd.shiny = !!ev.shiny; sd.gender = ev.gender || ''; sd.idx = ev.idx;
        sd.ox = -190; sd.oy = 0; sd.alpha = 1; sd.scale = 1; sd.blink = 0; placeOffsets(sd, 1); getImg(spritePath(ev.species));
        S.introFoe = { ev, cried: false };
      }
    }
    return S.b;
  }
  // xPosFront / yPosFront / xPosBack / yPosBack in the Pokemon database are the OLD scene's absolute positions (640x480 space); every species
  // currently holds the same default (503,107 front, 129,359 back). They are used here as an OFFSET from that default, so the default gives the
  // layout above and a species you tuned by hand keeps its shift. (640x480 -> top surface: x * 0.75 / 2, y * 0.646 / 2 in GBA pixels.)
  const LEG = { f: [503, 107], b: [129, 359], kx: .75 / 2, ky: (310 / 480) / 2 };
  function placeOffsets(sd, sideIdx) {
    const d = spData(sd.species), n = S.nudged[sideIdx], ref = sideIdx === 0 ? LEG.b : LEG.f;
    const x = sideIdx === 0 ? d.xPosBack : d.xPosFront, y = sideIdx === 0 ? d.yPosBack : d.yPosFront;
    sd.dx = (x != null ? (x - ref[0]) * LEG.kx : 0) + n.x; sd.dy = (y != null ? (y - ref[1]) * LEG.ky : 0) + n.y;
  }
  // live nudge (GBA pixels); returns the values to store in the database
  function nudge(sideIdx, dx, dy) {
    const n = S.nudged[sideIdx]; n.x += dx; n.y += dy; const sd = side(sideIdx); if (sd.species) placeOffsets(sd, sideIdx);
    const ref = sideIdx === 0 ? LEG.b : LEG.f; return { x: Math.round(ref[0] + sd.dx / LEG.kx), y: Math.round(ref[1] + sd.dy / LEG.ky) };
  }

  // ================================================== text
  function wrapPx(s, w) { const out = []; let cur = ''; for (const word of String(s).split(' ')) { const t = cur ? cur + ' ' + word : word; if (tw(t) > w && cur) { out.push(cur); cur = word; } else cur = t; } if (cur) out.push(cur); return out; }
  function setText(s, instant, wmax) {
    const ls = wrapPx(s, wmax || (CF.msg.w - 18)); S.pages = []; for (let i = 0; i < ls.length; i += 2) S.pages.push(ls.slice(i, i + 2));
    S.page = 0; S.shown = instant ? 999 : 0; S.lines = S.pages[0] || []; S.textWait = 0; S.typed = !!instant;
  }
  const pageLen = () => (S.lines || []).reduce((a, l) => a + l.length, 0);

  // ================================================== event playback
  const DIR = [1, -1];
  const cry = sp => { try { if (env.cry) env.cry(sp); } catch (e) { /* no audio */ } };
  function begin(ev) {
    const t = ev.t, sd = ev.side != null ? side(ev.side) : null;
    S.cur = { ev, t: 0, dur: 0 };
    switch (t) {
      case 'msg': { const pre = S.preShown === ev.text; S.preShown = null; setText(ev.text, pre); S.cur.dur = -1; break; }
      case 'usemove': S.cur.dur = 0; break;
      case 'anim': {
        const k = ev.kind; S.cur.dur = k === 'attack' ? .55 : k === 'status' ? .45 : k === 'miss' || k === 'immune' ? .25 : k === 'protect' || k === 'sub' || k === 'subhit' || k === 'subbreak' || k === 'bounce' || k === 'charge' ? .4 : .2;
        if (k === 'attack' || k === 'status') S.cur.col = TYPE_COLOR(ev.type || 'TYPE_NORMAL');
        break; }
      case 'hp': {
        if (ev.bench || !sd || (ev.idx != null && ev.idx !== sd.idx)) { S.cur.dur = 0; break; }
        sd.hpFrom = sd.dhp; sd.hpTo = ev.to; sd.maxhp = ev.max || sd.maxhp; S.cur.dur = clamp(Math.abs(ev.to - ev.from) / Math.max(1, sd.maxhp) * 1.4, .25, 1.3);
        if (ev.to < ev.from) sd.blink = Math.min(.45, S.cur.dur + .1); break; }
      case 'status': if (sd) sd.status = ev.status || null; S.cur.dur = .15; break;
      case 'weather': if (S.mapFx && ev.type !== S.mapWeather) S.mapFx = false; S.weather = ev.type && !/^(none|clear)$/i.test(ev.type) ? ev.type : null; S.cur.dur = .2; break;
      case 'terrain': S.terrain = ev.type || null; S.cur.dur = .1; break;
      case 'switchin': {
        if (ev.side === 1 && env.onSeen) { try { env.onSeen(ev.species); } catch (e) { /* ignore */ } }   // Pokedex: seen
        sd.vis = true; sd.name = ev.name; sd.species = ev.species; sd.level = ev.level; sd.hp = ev.hp; sd.maxhp = ev.maxhp; sd.dhp = ev.hp; sd.status = ev.status || null; sd.shiny = !!ev.shiny; sd.gender = ev.gender || ''; sd.idx = ev.idx;
        sd.ox = 0; sd.oy = 0; sd.alpha = 1; sd.scale = 1; sd.blink = 0; placeOffsets(sd, ev.side);
        if (ev.side === 0) { const M = S.b.sides[0].party[ev.idx]; sd.exp = M ? expFrac(M.exp, M.growth, M.level) : 0; }
        getImg(spritePath(ev.species));
        const wild = ev.side === 1 && S.b.kind === 'wild', hasTr = ev.side === 0 ? S.tr.me.vis : S.tr.foe.vis;
        S.cur.hasTr = hasTr;
        if (wild && S.introFoe && S.introFoe.ev === ev) { S.cur.style = 'slide'; sd.ox = 0; S.cur.dur = 0; S.introFoe = null; }   // it already slid in during the intro
        else if (wild) { S.cur.style = 'slide'; sd.ox = -190; S.cur.dur = .65; }
        else { S.cur.style = ev.side === 0 ? 'throw' : 'throwFoe'; sd.alpha = 0; sd.scale = .1; S.cur.dur = ev.side === 0 ? (hasTr ? 1.4 : 1.0) : (hasTr ? 1.1 : .95); }
        break; }
      case 'withdraw': S.cur.dur = .3; break;
      case 'faint': S.cur.dur = .6; break;
      case 'exp': {
        if (!ev.active) { S.cur.dur = 0; break; }
        const sd0 = side(0); S.cur.f0 = clamp((ev.from - ev.floor) / Math.max(1, ev.next - ev.floor)); S.cur.f1 = clamp((ev.to - ev.floor) / Math.max(1, ev.next - ev.floor));
        S.cur.dur = clamp((S.cur.f1 - S.cur.f0) * 1.8, .2, 1.4); sd0.exp = S.cur.f0; break; }
      case 'levelup': {
        if (ev.active) { const sd0 = side(0); sd0.level = ev.level; sd0.maxhp = ev.maxhp; sd0.hp = ev.hp; sd0.dhp = ev.hp; sd0.exp = 0; }
        S.levelBox = { level: ev.level, stats: ev.stats || {}, gain: ev.gain || {}, t: 0 }; S.cur.dur = -2; break; }
      case 'learned': S.cur.dur = 0; break;
      case 'ball': startBall(ev); break;
      case 'item': S.cur.dur = .2; break;
      case 'confused': case 'stage': case 'stagereset': S.cur.dur = ev.t === 'stage' ? .25 : .2;
        if (ev.t === 'stage' && ev.side != null) S.particles.push({ kind: 'stage', side: ev.side, up: ev.delta > 0, t: 0, dur: .6 }); break;
      case 'endturn': S.cur.dur = 0; break;
      case 'end': S.result = ev.result; S.cur.dur = 0; break;
      default: S.cur.dur = 0;
    }
  }
  const expFrac = (exp, growth, level) => { const E = BE(); if (!E || level >= 100) return 0; const a = E.expForLevel(growth, level), b = E.expForLevel(growth, level + 1); return clamp((exp - a) / Math.max(1, b - a)); };
  const arc = (x0, y0, x1, y1, p, h) => ({ x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * h });

  function tickCur(dt) {
    const c = S.cur, ev = c.ev; c.t += dt;
    const sd = ev.side != null ? side(ev.side) : null, p = c.dur > 0 ? clamp(c.t / c.dur) : 1;
    switch (ev.t) {
      case 'msg': {
        if (c.dur !== -1) break;
        const tot = pageLen();
        if (!S.typed) { S.shown += dt * 48; if (S.shown >= tot) { S.shown = tot; S.typed = true; S.textWait = 0; } }
        else { S.textWait += dt; const last = S.page >= S.pages.length - 1, auto = last ? (S.noAuto ? 1e9 : .55) : 1e9; if (S.textWait >= auto) { c.dur = 0; c.t = 1; } }
        return false; }
      case 'anim': {
        if (!sd) break;
        if (ev.kind === 'attack') {
          const lunge = p < .4 ? Math.sin(p / .4 * Math.PI) * 14 : 0; sd.ox = DIR[ev.side] * lunge;
          if (p >= .35 && !c.hit) { c.hit = true; S.particles.push({ kind: 'burst', side: 1 - ev.side, col: c.col, t: 0, dur: .35 }); }
        } else if (ev.kind === 'status') { sd.oy = -Math.abs(Math.sin(p * Math.PI * 2)) * 4; if (!c.hit) { c.hit = true; S.particles.push({ kind: 'ring', side: ev.side, col: c.col, t: 0, dur: .45 }); } }
        else if (ev.kind === 'protect') { if (!c.hit) { c.hit = true; S.particles.push({ kind: 'shield', side: ev.side, t: 0, dur: .4 }); } }
        else if (ev.kind === 'subbreak' || ev.kind === 'bounce') { sd.oy = -Math.sin(p * Math.PI) * 6; }
        if (p >= 1) { sd.ox = 0; sd.oy = 0; }
        break; }
      case 'hp': { if (c.dur > 0) { const sd2 = side(ev.side); sd2.dhp = sd2.hpFrom + (sd2.hpTo - sd2.hpFrom) * p; if (p >= 1) { sd2.dhp = sd2.hpTo; sd2.hp = sd2.hpTo; } } break; }
      case 'switchin': tickSwitchIn(c, ev, sd, p); break;
      case 'withdraw': { sd.alpha = 1 - p; sd.scale = 1 - p * .6; sd.oy = 0; if (p >= 1) { sd.vis = false; sd.alpha = 0; sd.scale = 1; } break; }
      case 'faint': { sd.oy = p * 40; sd.alpha = 1 - p; if (p >= 1) { sd.vis = false; sd.oy = 0; sd.alpha = 0; } break; }
      case 'exp': { if (c.dur > 0) side(0).exp = c.f0 + (c.f1 - c.f0) * p; break; }
      case 'levelup': { if (S.levelBox) S.levelBox.t += dt; if (c.t > 3) c.dur = 0; return false; }
      case 'ball': tickBall(c, dt); return c.t >= c.dur;
      default: break;
    }
    return c.dur >= 0 && c.t >= c.dur;
  }
  // sending a Pokemon out: the trainer winds up, a ball flies, sparkles, the Pokemon grows out of it and cries
  function tickSwitchIn(c, ev, sd, p) {
    const t = c.t;
    if (c.style === 'slide') { sd.ox = -190 * (1 - ease(p)); if (t > .3 && !c.cried) { c.cried = true; cry(ev.species); } return; }
    const ally = ev.side === 0, tr = ally ? S.tr.me : S.tr.foe, hasTr = c.hasTr;
    const t0 = ally ? (hasTr ? .35 : 0) : .1, fl = ally ? .45 : .4, popT = t0 + fl;
    const tx = (ally ? ALLY.cx : FOE.cx) + sd.dx, ty = (ally ? ALLY.platY - 12 : FOE.platY - 6) + sd.dy;
    if (hasTr) {
      if (ally) { tr.frame = t < .1 ? 0 : t < .2 ? 1 : t < .3 ? 2 : 3; if (t > .55) tr.ox = -130 * ease(clamp((t - .55) / .6)); if (t >= 1.15) tr.vis = false; }
      else { tr.ox = 130 * ease(clamp(t / .5)); if (t >= .5) tr.vis = false; }
    }
    c.ballPos = null;
    if (t >= t0 && t < popT) { const q = (t - t0) / fl, a = ally ? arc(hasTr ? 44 : 20, ALLY.bottom - (hasTr ? 38 : 46), tx, ty, q, 34) : arc(hasTr ? 200 : 232, hasTr ? 30 : 20, tx, ty, q, 22); c.ballPos = { x: a.x, y: a.y, rot: (ally ? 1 : -1) * q * 12 }; }
    if (t >= popT) { sd.alpha = 1; sd.scale = Math.max(.1, backOut(clamp((t - popT) / .35))); c.spT = t - popT; if (!c.cried) { c.cried = true; cry(ev.species); } } else sd.alpha = 0;
    sd.ox = 0;
    if (p >= 1) { sd.alpha = 1; sd.scale = 1; if (tr.vis && hasTr) tr.vis = false; }
  }

  // ------------------------------------------------ catching
  function startBall(ev) {
    const shakes = ev.shakes | 0;
    S.ballFx = { kind: BALL_KIND(ev.ball), shakes, caught: !!ev.caught, blocked: !!ev.blocked, t: 0 };
    S.cur.dur = ev.blocked ? 1.2 : .55 + .35 + .5 + shakes * .75 + .6 + (ev.caught ? .5 : .35);
  }
  function tickBall(c, dt) {
    const f = S.ballFx; if (!f) return; f.t = c.t; const F = side(1), sh = f.shakes;
    const tThrow = .55, tAbs = tThrow + .35, tDrop = tAbs + .5, tShake = tDrop + sh * .75 + .3;
    if (f.blocked) { if (c.t > .6) f.t = .6 - (c.t - .6); return; }
    if (c.t < tThrow) F.scale = 1; else if (c.t < tAbs) F.scale = 1 - ease((c.t - tThrow) / .35); else if (c.t < tShake) F.scale = 0; else if (!f.caught) F.scale = ease(clamp((c.t - tShake) / .3));
    if (f.caught && c.t >= tShake) F.scale = 0;
    f.tThrow = tThrow; f.tAbs = tAbs; f.tDrop = tDrop; f.tShake = tShake;
  }
  function drawBallFx(c) {
    const f = S.ballFx; if (!f || !S.cur || S.cur.ev.t !== 'ball') return;
    const sx = 50, sy = ALLY.bottom - 38, tx = FOE.cx, ty = FOE.bottom - 24, gy = FOE.platY - 4, t = f.t;
    let x, y, rot = 0;
    if (f.blocked) { const p = clamp(t / .6); x = sx + (tx - sx) * p; y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 28; }
    else if (t < f.tThrow) { const p = t / f.tThrow; x = sx + (tx - sx) * p; y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 38; }
    else if (t < f.tAbs) { x = tx; y = ty + (t - f.tThrow) / .35 * 3; }
    else if (t < f.tDrop) { const p = (t - f.tAbs) / .5; x = tx; y = ty + (gy - ty) * p * p; if (p > .85) y -= Math.sin((p - .85) / .15 * Math.PI) * 4; }
    else if (t < f.tShake) { x = tx; y = gy; const k = t - f.tDrop; if (k < f.shakes * .75) { const ph = (k % .75) / .75; if (ph < .6) rot = Math.sin(ph / .6 * Math.PI * 2) * 4; } }
    else { x = tx; y = gy; }
    if (f.blocked && t < .02) return;
    if (f.caught && t >= f.tShake) { ball(c, Math.round(x - 9), Math.round(y - 9), f.kind, 2); star(c, Math.round(x - 14 + Math.sin(t * 20) * 2), Math.round(y - 20)); star(c, Math.round(x + 10), Math.round(y - 16 + Math.cos(t * 17) * 2)); star(c, Math.round(x - 2), Math.round(y - 26)); return; }
    if (t >= f.tShake) return;
    ball(c, Math.round(x - 9 + rot), Math.round(y - 9), f.kind, 2);
  }

  // ================================================== flow
  function idle() {
    const b = S.b, pe = b.pending;
    if (S.result && !pe) { endBattle(); return; }
    if (!pe) {
      const P = b.active(0);
      if (P && (P.v.charging || P.v.lock || P.v.recharge)) { act({ type: 'move', slot: 0 }); return; }
      S.mode = 'cmd'; S.cmd = 0; setText('What will ' + P.name + ' do?', true); return;
    }
    if (pe.type === 'switch') { S.ctx = pe.pivot ? 'pivot' : 'forced'; S.mode = 'party'; S.pty = firstOk(); S.partyMsg = pe.pivot ? 'Choose a Pokémon to switch in.' : 'Choose a Pokémon to send out.'; return; }
    if (pe.type === 'learn') {
      const M = b.sides[0].party[pe.mon]; S.learn = { mon: M, name: pe.name, key: pe.move, slot: 0 };
      setText(M.name + ' wants to learn ' + pe.name + '. Forget a move to make room?', true); S.mode = 'learnAsk'; S.yn = 0; return;
    }
    if (pe.type === 'end') { S.result = pe.result; endBattle(); return; }
    S.mode = 'cmd';
  }
  const firstOk = () => { const P = S.b.sides[0]; for (let i = 0; i < P.party.length; i++) if (P.party[i].hp > 0 && i !== P.active) return i; return P.active; };
  function play(evs) { S.q = (evs || []).slice(); S.mode = 'play'; S.cur = null; }
  function act(a) { S.noAuto = false; play(S.b.turn(a, null)); }
  function endBattle() {
    if (S.done) return; S.done = true; S.mode = 'end';
    S.fadeDir = 1; S.onFade = () => {
      const b = S.b; let party = null, evo = [];
      try { party = b.commit(); } catch (e) { console.warn('[BattleScene] commit failed', e); }
      try { evo = b.evolutions(); } catch (e) { evo = []; }
      const res = { result: S.result || b.result, caught: b.caught || [], evolutions: evo, party, usedItems: b.usedItems || [], money: (S.result || b.result) === 'win' ? (b.trainerMoney || 0) : 0, levelUps: b.levelUps || [], battle: b };
      S.finished = res; if (S.onEnd) S.onEnd(res);
    };
  }

  // ================================================== update
  const HUDM = ['cmd', 'move', 'party', 'bag', 'learnAsk', 'learnPick'];
  function update(dt) {
    S.t += dt;
    S.lowT = (S.lowT || 0) + dt; if (window.StartMenu && window.StartMenu.tickBg) window.StartMenu.tickBg(dt);
    { const want = HUDM.includes(S.mode) ? 1 : 0, cur = S.botIn || 0; S.botIn = want > cur ? Math.min(1, cur + dt * 2.6) : Math.max(0, cur - dt * 3.4); if (want) S.botMode = S.mode;
      const noStrip = ['move', 'party', 'bag', 'learnPick'].includes(S.mode); if (noStrip || S.botIn <= 0) S.stripT = 0; else { S.stripT = (S.stripT || 0) + dt; if (S.stripT > 1.5) S.stripPlayed = true; } }
    for (const sd of S.sides) if (sd.blink > 0) sd.blink = Math.max(0, sd.blink - dt);
    for (const pa of S.particles) pa.t += dt; S.particles = S.particles.filter(p => p.t < p.dur);
    if (S.fadeDir) { S.fade = clamp(S.fade + S.fadeDir * dt * 1.5); if ((S.fadeDir < 0 && S.fade <= 0) || (S.fadeDir > 0 && S.fade >= 1)) { S.fadeDir = 0; const f = S.onFade; S.onFade = null; if (f) f(); } }
    if (!S.b) return;
    if (S.mode === 'intro') {
      S.introT += dt; const t = S.introT; if (S.fade > 0) S.fade = 0, S.fadeDir = 0;
      const q = clamp((t - FLASH) / SLIDE), e = ease(q);
      if (S.tr.me.path) S.tr.me.ox = 130 * (1 - e); if (S.tr.foe.path) S.tr.foe.ox = -130 * (1 - e);
      if (S.introFoe) { side(1).ox = -190 * (1 - e); if (q > .55 && !S.introFoe.cried) { S.introFoe.cried = true; cry(S.introFoe.ev.species); } }
      if (t >= FLASH && !S.introTextSet) { S.introTextSet = true; const m = S.q.find(e => e.t === 'msg'); if (m) { setText(m.text, true); S.preShown = m.text; } }
      if (t >= FLASH + SLIDE + .3) { S.mode = 'play'; S.tr.me.ox = 0; S.tr.foe.ox = 0; if (S.introFoe) side(1).ox = 0; S.cur = null; }
      return;
    }
    if (S.mode === 'play') {
      let guard = 0;
      while (guard++ < 40) {
        if (!S.cur) { const ev = S.q.shift(); if (!ev) { idle(); break; } begin(ev); }
        if (S.cur && S.cur.dur === 0) { finishCur(); continue; }
        if (S.cur) { if (tickCur(dt)) { finishCur(); continue; } }
        break;
      }
    }
    if (S.levelBox && !(S.cur && S.cur.ev.t === 'levelup')) S.levelBox = null;
  }
  function finishCur() {
    const ev = S.cur.ev;
    if (ev.t === 'anim' && ev.side != null) { side(ev.side).ox = 0; side(ev.side).oy = 0; }
    if (ev.t === 'ball') { S.ballFx = null; const F = side(1); if (!ev.caught) F.scale = 1; }
    if (ev.t === 'hp' && ev.side != null && !ev.bench) { const sd = side(ev.side); if (ev.idx == null || ev.idx === sd.idx) { sd.dhp = ev.to; sd.hp = ev.to; } }
    if (ev.t === 'levelup' && ev.active) { const M = S.b.sides[0].party[ev.idx]; if (M) side(0).exp = expFrac(M.exp, M.growth, ev.level); }   // leftover exp after the level-up
    if (ev.t === 'switchin') { const sd = side(ev.side); sd.ox = 0; sd.alpha = 1; sd.scale = 1; if (ev.side === 0 && S.tr.me.vis && S.cur.style === 'throw' && S.cur.hasTr) S.tr.me.vis = false; if (ev.side === 1 && S.cur.style === 'throwFoe') S.tr.foe.vis = false; }
    S.cur = null;
  }

  // ================================================== input
  function press(k) {
    if (!S.b || S.fadeDir) return;
    if (S.mode === 'intro') { return; }
    if (S.mode === 'play') {
      const c = S.cur;
      if (k === 'a' || k === 'b') {
        if (c && c.ev.t === 'msg') {
          if (!S.typed) { S.shown = 999; S.typed = true; S.textWait = 0; }
          else if (S.page < S.pages.length - 1) { S.page++; S.lines = S.pages[S.page]; S.shown = 0; S.typed = false; S.textWait = 0; }
          else { c.dur = 0; }
        } else if (c && c.ev.t === 'levelup') { c.dur = 0; S.levelBox = null; }
      }
      return;
    }
    if (S.mode === 'cmd') {
      if (k === 'left') S.cmd = S.cmd & 2; else if (k === 'right') S.cmd = (S.cmd & 2) | 1; else if (k === 'up') S.cmd &= 1; else if (k === 'down') S.cmd |= 2;
      else if (k === 'a') {
        if (S.cmd === 0) {
          const P = S.b.active(0), us = S.b.usable(P);
          if (us.struggle) { act({ type: 'move', slot: 'struggle' }); return; }
          S.mode = 'move'; S.mv = Math.min(S.mv, P.moves.length - 1); S.mvMsg = '';
        } else if (S.cmd === 1) { S.mode = 'bag'; S.bagSel = Math.min(S.bagSel, Math.max(0, S.bag.length - 1)); S.bagMsg = ''; }
        else if (S.cmd === 2) { S.ctx = 'switch'; S.mode = 'party'; S.pty = S.b.sides[0].active; S.partyMsg = 'Choose a Pokémon.'; }
        else act({ type: 'run' });
      }
      return;
    }
    if (S.mode === 'move') {
      const P = S.b.active(0), n = P.moves.length;
      if (k === 'b') { S.mode = 'cmd'; return; }
      if (k === 'left') { if (S.mv % 2 === 1) S.mv--; } else if (k === 'right') { if (S.mv % 2 === 0 && S.mv + 1 < n) S.mv++; }
      else if (k === 'up') { if (S.mv >= 2) S.mv -= 2; } else if (k === 'down') { if (S.mv + 2 < n) S.mv += 2; }
      else if (k === 'a') {
        const us = S.b.usable(P)[S.mv];
        if (us && us.disabled) { S.mvMsg = us.reason === 'no PP' ? "There's no PP left for this move!" : us.reason ? "Can't use it: " + us.reason + '.' : "Can't use it."; return; }
        act({ type: 'move', slot: S.mv });
      }
      return;
    }
    if (S.mode === 'party') {
      const P = S.b.sides[0], n = P.party.length, forced = S.ctx === 'forced' || S.ctx === 'pivot';
      if (k === 'b') { if (forced) { S.partyMsg = 'You must choose a Pokémon!'; return; } S.mode = S.ctx === 'item' ? 'bag' : 'cmd'; return; }
      if (k === 'up') S.pty = (S.pty + n - 2) % n; else if (k === 'down') S.pty = (S.pty + 2) % n;
      else if (k === 'left') S.pty = (S.pty + n - 1) % n; else if (k === 'right') S.pty = (S.pty + 1) % n;
      else if (k === 'a') {
        const M = P.party[S.pty];
        if (S.ctx === 'item') {
          const it = S.bag[S.bagSel]; if (!it) return;
          if (!itemWorks(it.item, M)) { S.partyMsg = "It won't have any effect."; return; }
          useBagEntry(it); S.mode = 'play'; act({ type: 'item', item: it.item, target: S.pty }); return;
        }
        if (M.hp <= 0) { S.partyMsg = M.name + ' has no energy left to battle!'; return; }
        if (S.pty === P.active && S.ctx !== 'forced') { S.partyMsg = M.name + ' is already in battle!'; return; }
        if (S.ctx === 'forced' || S.ctx === 'pivot') { S.mode = 'play'; S.noAuto = false; play(S.b.switchTo(S.pty)); return; }
        if (!S.b.canSwitch(0)) { S.partyMsg = "There's no switching out!"; return; }
        act({ type: 'switch', to: S.pty });
      }
      return;
    }
    if (S.mode === 'bag') {
      const n = S.bag.length;
      if (k === 'b') { S.mode = 'cmd'; return; }
      if (!n) return;
      if (k === 'up') S.bagSel = (S.bagSel + n - 1) % n; else if (k === 'down') S.bagSel = (S.bagSel + 1) % n;
      else if (k === 'a') {
        const it = S.bag[S.bagSel];
        if (isBall(it.item)) { useBagEntry(it); act({ type: 'ball', ball: it.item }); }
        else { S.ctx = 'item'; S.mode = 'party'; S.pty = S.b.sides[0].active; S.partyMsg = 'Use on which Pokémon?'; }
      }
      const vis = 5; if (S.bagSel < S.bagTop) S.bagTop = S.bagSel; if (S.bagSel >= S.bagTop + vis) S.bagTop = S.bagSel - vis + 1;
      return;
    }
    if (S.mode === 'learnAsk') {
      if (k === 'up' || k === 'down' || k === 'left' || k === 'right') S.yn ^= 1;
      else if (k === 'a') { if (S.yn === 0) { S.mode = 'learnPick'; S.learn.slot = 0; } else { S.mode = 'play'; S.noAuto = false; play(S.b.resolveLearn(-1)); } }
      else if (k === 'b') { S.mode = 'play'; play(S.b.resolveLearn(-1)); }
      return;
    }
    if (S.mode === 'learnPick') {
      const n = S.learn.mon.moves.length;
      if (k === 'left') { if (S.learn.slot % 2 === 1) S.learn.slot--; } else if (k === 'right') { if (S.learn.slot % 2 === 0 && S.learn.slot + 1 < n) S.learn.slot++; }
      else if (k === 'up') { if (S.learn.slot >= 2) S.learn.slot -= 2; } else if (k === 'down') { if (S.learn.slot + 2 < n) S.learn.slot += 2; }
      else if (k === 'b') { S.mode = 'learnAsk'; S.yn = 1; }
      else if (k === 'a') { S.mode = 'play'; play(S.b.resolveLearn(S.learn.slot)); }
      return;
    }
  }
  function useBagEntry(it) { it.count--; if (env.onItemUsed) { try { env.onItemUsed(it.item, it.ref); } catch (e) { /* host error */ } } if (it.count <= 0) { S.bag = S.bag.filter(x => x !== it); S.bagSel = clamp(S.bagSel, 0, Math.max(0, S.bag.length - 1)); } }
  function click() { /* not used */ }

  // ================================================== drawing: TOP surface (the field)
  const PAL = {
    grass: { sky: ['#9fd4f0', '#c4e6f4'], far: '#8cc870', mid: ['#78b858', '#6caa4e'], plat: ['#b8d890', '#98c070'], line: '#5a9a44' },
    cave: { sky: ['#505060', '#686878'], far: '#706860', mid: ['#8a7e6c', '#7c705e'], plat: ['#a89c88', '#8c8070'], line: '#5c5244' },
    water: { sky: ['#8cc8f0', '#c0e4f8'], far: '#5c9ee0', mid: ['#4890d8', '#3c84cc'], plat: ['#78b0e8', '#5a98d8'], line: '#2c6cb0' },
    indoor: { sky: ['#d8c8a0', '#e4d8b4'], far: '#c0a878', mid: ['#b09868', '#a48c5c'], plat: ['#d8c898', '#c4b080'], line: '#8c7444' },
    sand: { sky: ['#f0d8a0', '#f8e8c0'], far: '#e0c080', mid: ['#d8b470', '#cca860'], plat: ['#ecd8a0', '#d8c088'], line: '#a88848' },
  };
  function drawBg(c) {
    const P = PAL[S.bgKind] || PAL.grass;
    for (let y = 0; y < H; y++) { c.fillStyle = y < 46 ? P.sky[(y >> 2) & 1 && y > 30 ? 1 : 0] : (y < 54 ? P.far : P.mid[((y - 54) >> 3) & 1]); c.fillRect(0, y, W, 1); }
    c.fillStyle = P.line; c.fillRect(0, 46, W, 1); c.fillRect(0, 53, W, 1);
    for (let i = 0; i < 34; i++) { const x = (i * 97 + 13) % 236, y = 60 + (i * 53) % 88; c.fillStyle = P.line; c.fillRect(x, y, 2, 1); c.fillRect(x + 1, y - 1, 1, 1); }
    ell(c, FOE.platX, FOE.platY + 3, 46, 8, P.plat[1]); ell(c, FOE.platX, FOE.platY + 1, 44, 7, P.plat[0]); S.hit.foePlat = { x: FOE.platX - 46, y: FOE.platY - 6, w: 92, h: 18 };
    ell(c, ALLY.platX, ALLY.platY + 3, 58, 10, P.plat[1]); ell(c, ALLY.platX, ALLY.platY, 56, 9, P.plat[0]); S.hit.allyPlat = { x: ALLY.platX - 58, y: ALLY.platY - 9, w: 116, h: 24 };
  }
  function drawWeather(c) {
    const w = S.weather && String(S.weather).toLowerCase(); if (!w) return;
    // the map's weather plays once at the start of the battle and fades out (a weather move keeps its effect for as long as it lasts)
    let fa = 1; if (S.mapFx) { const T0 = CF.weatherSecs != null ? CF.weatherSecs : 6; fa = Math.max(0, Math.min(1, T0 + 1.5 - S.t)); if (fa <= 0) return; }
    c.save(); c.globalAlpha = fa; try { drawWeatherFx(c, w); } finally { c.restore(); }
  }
  function drawWeatherFx(c, w) {
    if (/rain|drizzle/.test(w)) { c.fillStyle = 'rgba(40,70,140,0.18)'; c.fillRect(0, 0, W, H); c.fillStyle = '#d8e8ff'; for (let i = 0; i < 40; i++) { const x = (i * 37 + S.t * 90) % 250 - 6, y = (i * 53 + S.t * 220) % H; c.fillRect(Math.round(x), Math.round(y), 1, 4); } }
    else if (/sun|harsh/.test(w)) { c.fillStyle = 'rgba(255,200,60,0.16)'; c.fillRect(0, 0, W, H); }
    else if (/sand/.test(w)) { c.fillStyle = 'rgba(200,160,80,0.28)'; c.fillRect(0, 0, W, H); c.fillStyle = '#e8d098'; for (let i = 0; i < 40; i++) c.fillRect(Math.round((i * 41 + S.t * 160) % 250), Math.round((i * 29 + S.t * 40) % H), 2, 1); }
    else if (/hail|snow/.test(w)) { c.fillStyle = 'rgba(200,220,255,0.18)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; for (let i = 0; i < 36; i++) c.fillRect(Math.round((i * 43 + S.t * 30) % 244), Math.round((i * 59 + S.t * 90) % H), 2, 2); }
    else if (/fog/.test(w)) { c.fillStyle = 'rgba(230,230,240,0.35)'; c.fillRect(0, 0, W, H); }
  }
  function panel(c, x, y, w, h, dark) {
    rect(c, x + 1, y, w - 2, h, '#2c3450'); rect(c, x, y + 1, w, h - 2, '#2c3450');
    rect(c, x + 2, y + 1, w - 4, h - 2, dark ? '#38405e' : '#7c88b4'); rect(c, x + 1, y + 2, w - 2, h - 4, dark ? '#38405e' : '#7c88b4');
    rect(c, x + 3, y + 3, w - 6, h - 6, dark ? '#f0f0f8' : '#fbfbfe'); rect(c, x + 3, y + h - 4, w - 6, 1, '#d8dcec');
  }
  // ---- HP boxes: a slanted bar (name + level above, HP numbers inside, EXP strip under it, party balls below)
  function slantRect(c, x, y, w, h, slant, col) { c.fillStyle = col; for (let r = 0; r < h; r++) c.fillRect(x, y + r, w - slant + Math.round(slant * (r + 1) / h), 1); }
  function infoBox(c, sd, isPlayer) {
    if (!sd.vis || !sd.species || sd.alpha <= 0) return;
    if (S.mode === 'intro' && !isPlayer && S.introFoe) return;   // the wild Pokémon's box appears when it has finished sliding in
    const H = isPlayer ? ALLY : FOE, x = H.boxX, y = H.boxY, w = H.boxW, bh = isPlayer ? 10 : 8, by = y + 11, slant = 6;
    S.hit[isPlayer ? 'allyBox' : 'foeBox'] = { x, y, w, h: 11 + bh + (isPlayer ? 5 : 1) };
    const nm = sd.name.length > 10 ? sd.name.slice(0, 10) : sd.name, nx = T(c, nm, x + 1, y - 1, 'dark');
    if (sd.gender) T(c, sd.gender[0] === 'M' ? '♂' : sd.gender[0] === 'F' ? '♀' : '', nx + 1, y - 1, sd.gender[0] === 'M' ? 'blue' : 'red');
    TR(c, '{Lv}' + sd.level, x + w - 3, y - 1, 'dark');
    slantRect(c, x - 1, by - 1, w + 2, bh + 2, slant, '#12121c'); slantRect(c, x, by, w, bh, slant, '#4a4e62');
    rect(c, x + 1, by + 1, 17, bh - 2, '#2c3042');
    const st = sd.status && STATUS_LAB[sd.status];
    if (st) { rect(c, x + 2, by + 1, 15, bh - 2, st[1]); T(c, st[0], x + 1, by + (bh - 8) / 2 - 1, st[2] === 'dark' ? 'dark' : 'badge'); } else T(c, 'HP', x + 3, by + (bh - 8) / 2 - 1, 'white');
    const tx = x + 20, tW = w - 20 - slant - 3, ty = by + 2, tH = bh - 4, frac = clamp(sd.dhp / Math.max(1, sd.maxhp)), f = Math.ceil(tW * frac);
    rect(c, tx - 1, ty - 1, tW + 2, tH + 2, '#12121c'); rect(c, tx, ty, tW, tH, '#262a3a');
    if (f > 0) { const col = frac > .5 ? '#38d050' : frac > .2 ? '#f0c820' : '#f03838'; rect(c, tx, ty, f, tH, col); rect(c, tx, ty, f, 1, 'rgba(255,255,255,0.45)'); rect(c, tx, ty + tH - 1, f, 1, 'rgba(0,0,0,0.25)'); }
    if (isPlayer) {
      TR(c, Math.max(0, Math.round(sd.dhp)) + '/' + sd.maxhp, tx + tW - 1, by + (bh - 8) / 2 - 1, 'white');
      const ey = by + bh + 2, ex = x + 10, eW = w - 10 - slant - 4;
      rect(c, ex - 1, ey - 1, eW + 2, 5, '#12121c'); rect(c, ex, ey, eW, 3, '#262a3a');
      const ef = Math.ceil(eW * clamp(sd.exp));   // ceil: even a tiny gain shows as at least 1 px if (ef > 0) { rect(c, ex, ey, ef, 3, '#34d4f4'); rect(c, ex, ey, ef, 1, 'rgba(255,255,255,0.4)'); }
    }
  }
  function drawParticles(c) {
    for (const pa of S.particles) {
      const p = clamp(pa.t / pa.dur); if (pa.side == null) continue;
      const cx = pa.side === 1 ? FOE.cx + side(1).dx : ALLY.cx + side(0).dx, cy = pa.side === 1 ? FOE.bottom - 28 + side(1).dy : ALLY.bottom - 34 + side(0).dy;
      if (pa.kind === 'burst') {
        c.globalAlpha = 1 - p; c.fillStyle = pa.col || '#fff';
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .3, r = 4 + p * 24; c.fillRect(Math.round(cx + Math.cos(a) * r) - 2, Math.round(cy + Math.sin(a) * r) - 2, 4, 4); }
        c.fillStyle = '#fff'; c.fillRect(cx - 3, cy - 3, 6, 6); c.globalAlpha = 1;
      } else if (pa.kind === 'ring') { c.globalAlpha = 1 - p * .8; c.strokeStyle = pa.col || '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 6 + p * 24, 0, 6.283); c.stroke(); c.globalAlpha = 1; }
      else if (pa.kind === 'shield') { c.globalAlpha = .5 * (1 - p); c.fillStyle = '#9fe4ff'; c.fillRect(cx - 24, cy - 28, 48, 56); c.globalAlpha = 1; }
      else if (pa.kind === 'stage') { c.globalAlpha = 1 - p; const col = pa.up ? '#f04848' : '#4878f0'; for (let i = 0; i < 3; i++) { const yy = cy + 14 - ((p * 28 + i * 9) % 28) * (pa.up ? 1 : -1) - (pa.up ? 0 : 20), xx = cx - 14 + i * 14; tri2(c, xx, yy, pa.up, col); } c.globalAlpha = 1; }
    }
  }
  function tri2(c, x, y, up, col) { c.fillStyle = col; for (let i = 0; i < 5; i++) { const w = up ? 1 + i * 2 : 9 - i * 2; c.fillRect(x - (w >> 1), y + i, w, 1); } }
  function levelBoxView(c) {
    const lb = S.levelBox; if (!lb) return; S.hit.levelBox = { x: CF.levelBox.x, y: CF.levelBox.y, w: 90, h: 76 };
    c.save(); c.translate(CF.levelBox.x - 148, CF.levelBox.y - 26);
    panel(c, 148, 26, 90, 76, false);
    const names = [['hp', 'HP'], ['atk', 'Attack'], ['def', 'Defense'], ['spa', 'Sp. Atk'], ['spd', 'Sp. Def'], ['spe', 'Speed']];
    T(c, '{Lv}' + lb.level, 156, 31, 'dark');
    names.forEach(([k, n], i) => { const y = 45 + i * 9; T(c, n, 156, y, 'dark'); const v = lb.stats[k]; if (v != null) TR(c, String(v), 230, y, 'dark'); });
    c.restore();
  }
  // battle intro (like the overworld transition before it): black for a moment, then the arena opens from a bar in the middle of the screen,
  // with fast speed lines sweeping across while the trainers / the wild Pokémon slide in. Lengths: FLASH (black) and SLIDE.
  const OPEN = .45;
  function drawIntroTop(c) {
    if (S.introT < FLASH) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); return true; }
    return false;
  }
  function introOverlay(c) {
    const t = S.introT - FLASH; if (t < 0) return;
    const o = clamp(t / OPEN), e = o * o * (3 - 2 * o), half = Math.round(H / 2 * (1 - e));
    if (half > 0) { c.fillStyle = '#000'; c.fillRect(0, 0, W, half); c.fillRect(0, H - half, W, half); c.fillStyle = '#fff'; if (half < H / 2) { c.fillRect(0, half, W, 1); c.fillRect(0, H - half - 1, W, 1); } }
    const life = clamp(t / (SLIDE + .2)), a = life < .7 ? 1 : 1 - (life - .7) / .3; if (a <= 0) return;
    c.save(); c.globalAlpha = a * .85;
    for (let i = 0; i < 16; i++) {
      const y = Math.round(((i * 53 + 17) % H)), len = 40 + (i * 37) % 90, sp = 520 + (i % 5) * 140, x = ((t * sp + i * 97) % (W + len + 60)) - len, hh = (i % 3 === 0) ? 2 : 1;
      c.fillStyle = i % 2 ? '#ffffff' : '#fff2a8'; c.fillRect(Math.round(x), y, len, hh);
    }
    c.restore();
  }
  function drawTop(c) {
    if (S.mode === 'intro' && drawIntroTop(c)) return;
    drawBg(c);
    drawTrainer(c, S.tr.foe, FOE.trX, FOE.trBottom, FOE.trScale, false);
    drawMon(c, side(1), true, FOE.cx, FOE.bottom, FOE.fit, FOE.scale || undefined);
    drawMon(c, side(0), false, ALLY.cx, ALLY.bottom, ALLY.fit, ALLY.scale || undefined);
    drawTrainer(c, S.tr.me, ALLY.trX, ALLY.trBottom, ALLY.trScale, true);
    drawWeather(c); drawParticles(c); drawBallFx(c);
    if (S.cur && S.cur.ev.t === 'switchin') {
      const cu = S.cur, sd = side(cu.ev.side), cx = (cu.ev.side === 0 ? ALLY.cx : FOE.cx) + sd.dx, cy = (cu.ev.side === 0 ? ALLY.bottom - 30 : FOE.bottom - 26) + sd.dy;
      if (cu.ballPos) drawBallSprite(c, cu.ballPos.x, cu.ballPos.y, cu.ballPos.rot, CF.ball);
      if (cu.spT != null) drawSparkle(c, cx, cy, cu.spT);
    }
    infoBox(c, side(1), false); infoBox(c, side(0), true);
    levelBoxView(c);
    msgBox(c);   // always visible, whatever menu is open
    if (S.mode === 'intro') introOverlay(c);
  }

  // ================================================== drawing: BOTTOM surface (messages + menus)
  // the same animated lower-screen background as the overworld (StartMenu.drawBg); this copy is used only if an older StartMenu.js is loaded
  function lowerBgCopy(c, W2, H2, t) {
    const g0 = c.createLinearGradient(0, 0, 0, H2); g0.addColorStop(0, '#1a1e2c'); g0.addColorStop(1, '#0c0e16'); c.fillStyle = g0; c.fillRect(0, 0, W2, H2);
    c.save(); c.beginPath(); c.rect(0, 0, W2, H2); c.clip();
    const off = (t * 9) % 36; c.fillStyle = 'rgba(120,140,200,.055)';
    for (let k = -8; k < W2 / 18 + 8; k++) { const x0 = k * 36 + off - H2; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 14, 0); c.lineTo(x0 + 14 + H2, H2); c.lineTo(x0 + H2, H2); c.closePath(); c.fill(); }
    for (let i = 0; i < 9; i++) { const sp = 6 + (i * 7) % 9, px = (i * 53 + 17) % W2, py = H2 + 14 - ((t * sp + i * 41) % (H2 + 28)), r = 4 + (i * 5) % 9, a = .05 + (i % 3) * .015;
      c.strokeStyle = 'rgba(190,205,255,' + a * 2.2 + ')'; c.lineWidth = 1; c.beginPath(); c.arc(px + Math.sin(t * .7 + i) * 4, py, r, 0, 6.2832); c.stroke();
      c.fillStyle = 'rgba(190,205,255,' + a + ')'; c.beginPath(); c.arc(px + Math.sin(t * .7 + i) * 4, py, r - 1, 0, 6.2832); c.fill(); }
    const gx = W2 / 2 + Math.sin(t * .4) * W2 * .3, g = c.createRadialGradient(gx, H2 * .4, 4, gx, H2 * .4, W2 * .6); g.addColorStop(0, 'rgba(80,110,200,.16)'); g.addColorStop(1, 'rgba(80,110,200,0)'); c.fillStyle = g; c.fillRect(0, 0, W2, H2);
    c.restore();
  }
  function drawBottomBg(c) {
    const SM = window.StartMenu;
    if (SM && SM.drawBg) { try { if (SM.drawBg(c, W, H)) return; } catch (e) { /* fall through to the copy */ } }
    if (!S.bgWarned) { S.bgWarned = true; console.warn('[BattleScene] StartMenu.drawBg is missing or has no idle screen yet: drawing the lower-screen background with its own copy (is js/StartMenu.js the latest version?)'); }
    lowerBgCopy(c, W, H, (SM && SM.bgT) || S.lowT || 0);
  }
  function msgBox(c, y, h) {
    const m = CF.msg; y = y == null ? m.y : y; h = h == null ? m.h : h;
    S.hit.msg = { x: m.x, y, w: m.w, h };
    panel(c, m.x, y, m.w, h, true);
    const ls = S.lines; let rem = Math.floor(S.shown);
    for (let i = 0; i < ls.length; i++) { const t = ls[i].slice(0, Math.max(0, rem)); rem -= ls[i].length; T(c, t, m.x + 8, y + 8 + i * 16, 'dark'); }
    if (S.mode === 'play' && S.cur && S.cur.ev.t === 'msg' && S.typed && S.textWait > .25 && Math.floor(S.t * 4) % 2 === 0 && S.page < S.pages.length - 1) tri(c, m.x + m.w - 10, y + h - 8, 3, '#d04040');
  }
  function btn(c, x, y, w, h, col, sel) {
    const off = sel ? Math.round(Math.sin(S.t * 8)) : 0;
    pill(c, x, y + 3, w, h, darken(col, .6), 9); pill(c, x, y + off, w, h, sel ? '#ffffff' : darken(col, .45), 9);
    pill(c, x + 2, y + 2 + off, w - 4, h - 4, sel ? lighten(col, .22) : col, 8); pill(c, x + 6, y + 4 + off, w - 12, 7, 'rgba(255,255,255,0.28)', 3);
    return off;
  }
  const btnXY = i => [CF.btn.x + (i & 1) * (CF.btn.w + CF.btn.gapX), CF.btn.y + (i >> 1) * (CF.btn.h + CF.btn.gapY)];
  const markBtns = () => { S.hit.buttons = { x: CF.btn.x, y: CF.btn.y, w: CF.btn.w * 2 + CF.btn.gapX, h: CF.btn.h * 2 + CF.btn.gapY }; };
  function cmdButtons(c) {
    markBtns(); const lab = ['FIGHT', 'BAG', 'POKéMON', 'RUN'], col = ['#d9381e', '#2196f3', '#9c27b0', '#e6a800'];
    for (let i = 0; i < 4; i++) { const [x, y] = btnXY(i), off = btn(c, x, y, CF.btn.w, CF.btn.h, col[i], S.cmd === i); Tc(c, lab[i], x, CF.btn.w, y + Math.round((CF.btn.h - 18) / 2) + off, i === 3 ? 'dark' : 'white', true); }
  }
  function moveButtons(c, P, getSlot, sel, dimFn) {
    const us = S.b.usable(P); markBtns();
    for (let i = 0; i < 4; i++) {
      const [x, y] = btnXY(i), s = P.moves[i];
      if (!s) { pill(c, x, y, CF.btn.w, CF.btn.h, '#1e2232', 9); continue; }
      const m = mvInfo(s.key), dis = us[i] && us[i].disabled, col = dis ? '#6b7080' : TYPE_COLOR(m.type), off = btn(c, x, y, CF.btn.w, CF.btn.h, col, sel === i);
      let nm = m.name; const avail = CF.btn.w - 16; while (nm.length > 3 && tw(nm) > avail) nm = nm.slice(0, -1);
      T(c, nm, x + 9, y + 8 + off, 'white');
      T(c, '{PP}', x + 9, y + 25 + off, 'white'); T(c, s.pp + '/' + s.maxpp, x + 28, y + 25 + off, s.pp <= Math.floor(s.maxpp / 4) ? 'red' : 'white');
      badge(c, m.type, x + 74, y + 24 + off);
    }
  }
  function moveInfoBox(c, P) { c.save(); c.translate(CF.info.x - 4, CF.info.y - 4); S.hit.info = { x: CF.info.x, y: CF.info.y, w: 232, h: 44 }; try { moveInfoBox0(c, P); } finally { c.restore(); } }
  function moveInfoBox0(c, P) {
    const s = P.moves[S.mv]; panel(c, 4, 4, 232, 44, true); if (!s) return;
    if (S.mvMsg) { T(c, S.mvMsg.slice(0, 34), 12, 20, 'red'); return; }
    const m = mvInfo(s.key), mv = m.mv, F = S.b.active(1);
    const cat = m.split === 'SPECIAL' ? 'Special' : m.split === 'STATUS' ? 'Status' : 'Physical';
    T(c, m.name, 12, 10, 'dark'); TR(c, cat, 228, 10, 'mute');
    T(c, 'Power ' + (m.power ? m.power : '--') + '   Acc ' + (m.acc ? m.acc : '--'), 12, 28, 'dark');
    if (mv && m.split !== 'STATUS' && m.power && F) {
      let e = 1; try { e = S.b.typeMult(m.type, F, P, mv); } catch (er) { e = 1; }
      if (e === 0) TR(c, 'No effect', 228, 28, 'mute'); else if (e > 1) TR(c, 'Super effective!', 228, 28, 'red'); else if (e < 1) TR(c, 'Not very effective', 228, 28, 'blue');
    }
  }
  function partyBottom(c) {
    const P = S.b.sides[0];
    for (let i = 0; i < 6; i++) {
      const x = 4 + (i & 1) * 118, y = 4 + (i >> 1) * 45, sel = S.pty === i, M = P.party[i];
      if (!M) { pill(c, x, y, 114, 42, '#1a1e2e', 7); pill(c, x + 2, y + 2, 110, 38, '#222740', 6); ballSil(c, x + 57, y + 21, 15, '#2d3350', '#3a4166'); continue; }
      const faint = M.hp <= 0, active = i === P.active, tc = faint ? 'white' : active ? 'white' : 'dark';
      const base = faint ? '#b0566a' : active ? '#4c9ee8' : '#eef1fb', top = faint ? '#cc7488' : active ? '#7cbcf4' : '#ffffff', ballBody = faint ? '#963e52' : active ? '#3a80c8' : '#c4cce6', ballLine = faint ? '#cc7488' : active ? '#8cc4f4' : '#f6f8ff';
      const glow = sel ? (Math.floor(S.t * 4) % 2 ? '#ffe98a' : '#f8c828') : null;
      pill(c, x, y, 114, 42, glow || '#10162a', 7); pill(c, x + 2, y + 2, 110, 38, base, 6);
      pill(c, x + 4, y + 3, 106, 14, top, 5); pill(c, x + 4, y + 17, 106, 21, base, 4);
      ballSil(c, x + 19, y + 21, 17, ballBody, ballLine);
      drawIconAt(c, M.species, x + 2, y + 5, sel, i);
      const nm = M.name.slice(0, 8), hi = faint || active ? '#ffffff' : '#2a2a3a';
      T(c, nm, x + 37, y + 4, tc); TR(c, '{Lv}' + M.level, x + 108, y + 4, tc);
      const bx = x + 52, by = y + 18, bw = 54, fr = clamp(M.hp / Math.max(1, M.maxhp));
      T(c, 'HP', x + 37, y + 14, tc);
      pill(c, bx - 2, by - 2, bw + 4, 8, '#1c2038', 3); rect(c, bx, by, bw, 4, '#4a5070'); const f = Math.ceil(bw * fr);
      if (f > 0) { rect(c, bx, by, f, 4, fr > .5 ? '#38d050' : fr > .2 ? '#f0c820' : '#f03838'); rect(c, bx, by, f, 1, 'rgba(255,255,255,0.45)'); }
      TR(c, M.hp + '/' + M.maxhp, x + 108, y + 27, tc);
      const st = M.status && STATUS_LAB[M.status]; if (st) { pill(c, x + 37, y + 28, 21, 9, st[1], 3); T(c, st[0], x + 38, y + 28, st[2] === 'dark' ? 'dark' : 'badge'); } else if (faint) T(c, 'FNT', x + 37, y + 28, 'white');
      if (M.item) { rect(c, x + 99, y + 28, 7, 7, '#f0c838'); rect(c, x + 100, y + 29, 5, 5, '#e89828'); }
    }
    rect(c, 0, 140, W, 15, '#161a28'); T(c, S.partyMsg || '', 6, 143, 'white');
  }
  function bagBottom(c) {
    panel(c, 4, 4, 232, 132, false);
    T(c, 'BAG', 12, 10, 'dark'); TR(c, 'A: use   B: back', 228, 10, 'mute'); rect(c, 10, 24, 220, 1, '#b0b6cc');
    const vis = 5;
    if (!S.bag.length) T(c, 'No usable items.', 14, 50, 'mute');
    for (let i = 0; i < vis; i++) {
      const k = S.bagTop + i, it = S.bag[k]; if (!it) continue; const y = 30 + i * 20;
      if (k === S.bagSel) { pill(c, 9, y - 2, 222, 18, '#cfe0ff', 6); tri(c, 12 + Math.round(Math.sin(S.t * 9)), y + 6, 3, '#d04040'); }
      if (isBall(it.item)) ball(c, 20, y, BALL_KIND(it.item), 1);
      T(c, it.name, 34, y + 3, 'dark'); TR(c, 'x' + it.count, 224, y + 3, 'dark');
    }
    if (S.bag.length > vis) { const th = 100 * vis / S.bag.length, ty = 28 + (100 - th) * (S.bagTop / Math.max(1, S.bag.length - vis)); rect(c, 232, 28, 2, 100, '#d0d4e4'); rect(c, 232, Math.round(ty), 2, Math.round(th), '#586080'); }
    rect(c, 0, 140, W, 15, '#161a28'); T(c, S.bagMsg || (S.bag.length ? 'Choose an item.' : 'Your bag has nothing to use.'), 6, 143, 'white');
  }
  function learnBottom(c) {
    const L = S.learn, M = L.mon;
    if (S.mode === 'learnAsk') {
      [['YES', '#2e9e57'], ['NO', '#d9381e']].forEach(([s, col], i) => { const [x, y] = [[4, 70], [124, 70]][i], off = btn(c, x, y, 112, 50, col, S.yn === i); Tc(c, s, x, 112, y + 16 + off, 'white', true); });
    } else {
      c.save(); c.translate(CF.info.x - 4, CF.info.y - 4); S.hit.info = { x: CF.info.x, y: CF.info.y, w: 232, h: 44 }; panel(c, 4, 4, 232, 44, true); wrapPx('Learn ' + L.name + ' in place of which move? (B: give up)', 214).slice(0, 2).forEach((l, i) => T(c, l, 12, 12 + i * 16, 'dark')); c.restore();
      moveButtons(c, M.side != null ? M : S.b.sides[0].party[M.idx] || M, null, L.slot);
    }
  }
  // pokeball silhouette (dark body, light band and centre ring) used behind icons
  function ballSil(c, cx, cy, r, body, line, a) {
    c.save(); c.globalAlpha = (c.globalAlpha == null ? 1 : c.globalAlpha) * (a == null ? 1 : a);
    ell(c, cx, cy, r, r, body); rect(c, cx - r + 2, cy - 1, r * 2 - 3, 2, line);
    const q = Math.max(3, Math.round(r * .42)); ell(c, cx, cy, q + 1, q + 1, body); ell(c, cx, cy, q, q, line); ell(c, cx, cy, q - 2, q - 2, body); ell(c, cx, cy, Math.max(1, Math.round(q / 2.4)), Math.max(1, Math.round(q / 2.4)), line);
    c.restore();
  }
  // the player's party as icons, just above the menu buttons
  // sparkle.png: 6 frames of 32x32 stacked vertically (graphics/poke_ball/sparkle.png); the drawn 4-point one is used if the file is missing
  const SPARKS = ['graphics/poke_ball/sparkle.png', 'graphics/poke_ball/Sparkle.png'], SPARK = SPARKS[0];   // both spellings are tried (a server can be case-sensitive)
  // the sheet's background colour (the first pixel) is made transparent once, like the other sprites
  function sparkSheet() {
    if (S.sparkKeyed) return S.sparkKeyed;
    let e = null; for (const path of SPARKS) { const g = getImg(path); if (g && g.ok) { e = g; break; } }
    if (!e) { if (!S.sparkWarned && SPARKS.every(path => { const g = getImg(path); return g && g.fail; })) { S.sparkWarned = true; console.warn('[BattleScene] sparkle sheet not found: tried ' + SPARKS.join(' and ') + ' (relative to index.html); using the drawn sparkle'); } return null; }
    const w = e.img.width, h = e.img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(e.img, 0, 0);
    try { const id = x.getImageData(0, 0, w, h), d = id.data, r0 = d[0], g0 = d[1], b0 = d[2]; if (d[3] > 0) { for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) < 6 && Math.abs(d[i + 1] - g0) < 6 && Math.abs(d[i + 2] - b0) < 6) d[i + 3] = 0; x.putImageData(id, 0, 0); } } catch (er) { /* keep as is */ }
    return S.sparkKeyed = { cv, w, h };
  }
  // ONE sparkle, all 6 frames in order at 20 fps (like ThrowPokeBallAnim); p = seconds since it started
  function sparkImg(c, cx, cy, size, sec) {
    const sh = sparkSheet(); if (!sh) return false; const n = 6, f = Math.floor(sec * 20); if (f < 0 || f >= n) return true;
    const fh = Math.floor(sh.h / n) || 32; c.imageSmoothingEnabled = false; c.drawImage(sh.cv, 0, f * fh, sh.w, fh, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size); return true;
  }
  // a 4-point sparkle
  function sparkle(c, x, y, r, a) {
    if (a <= 0 || r <= 0) return; c.save(); c.globalAlpha = clamp(a); c.fillStyle = '#fffbe0';
    const R = Math.max(1, Math.round(r)); c.fillRect(Math.round(x) - 1, Math.round(y) - R, 2, R * 2); c.fillRect(Math.round(x) - R, Math.round(y) - 1, R * 2, 2);
    c.fillStyle = '#ffd84a'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); c.restore();
  }
  function partyStrip(c) {
    const P = CF.party; if (!P.show || !S.b) return;
    const party = S.b.sides[0].party || [], gap = P.gap, T0 = S.stripPlayed || S.stripT == null ? 9 : S.stripT;   // the entrance plays once per battle
    S.hit.party = { x: P.x, y: P.y, w: gap * 5 + 32, h: 38 };
    const bk = q => { q = clamp(q); const t = q - 1; return 1 + t * t * (2.6 * t + 1.6); };   // pop with a small overshoot
    for (let i = 0; i < 6; i++) {
      const M = party[i], x = P.x + i * gap, y = P.y, t = T0 - i * .09;   // the balls come in from left to right
      const bs = bk(t / .26); if (bs <= 0) continue;
      const ballCols = !M ? ['#2a2e3e', '#3c4156'] : (M.hp <= 0 ? ['#5a3a46', '#8a6470'] : i === S.b.sides[0].active ? ['#3f86c8', '#d8ecff'] : ['#454957', '#eef0f8']);
      c.save(); c.translate(x + 16, y + 18); c.scale(bs, bs); c.translate(-(x + 16), -(y + 18)); ballSil(c, x + 16, y + 18, 15, ballCols[0], ballCols[1]); c.restore();
      if (!M) continue;
      const faint = M.hp <= 0, it = t - .24;   // then the Pokémon icon appears with a sparkle
      if (it > 0) {
        const is = bk(it / .22);
        c.save(); if (faint) c.globalAlpha = .45; c.translate(x + 16, y + 34); c.scale(is, is); c.translate(-(x + 16), -(y + 34)); drawIconAt(c, M.species, x, y, false, i);
        if (it < .22) { c.globalAlpha = (1 - it / .22) * .6; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + 16, y + 18, 14, 0, 6.2832); c.fill(); }   // a quick white shine on arrival
        c.restore();
        if (it < .4 && !sparkImg(c, x + 16, y + 18, 32, it)) { const p = it / .4, a = Math.sin(p * Math.PI); [[x + 5, y + 6, 1], [x + 27, y + 9, .8], [x + 10, y + 28, .7], [x + 26, y + 26, 1.1]].forEach(([sx, sy, sc]) => sparkle(c, sx, sy - p * 4, (2 + 3 * sc) * a, a)); }   // (the drawn one only if the sheet is missing)
      }
      const bw = 24, fr = clamp(M.hp / Math.max(1, M.maxhp));
      if (it > .1) { rect(c, x + 4, y + 34, bw, 3, '#12121c'); if (!faint) rect(c, x + 5, y + 35, Math.max(0, Math.round((bw - 2) * fr)), 1, fr > .5 ? '#38d050' : fr > .2 ? '#f0c820' : '#f03838');
        const st = M.status && STATUS_LAB[M.status]; if (st && !faint) rect(c, x + 24, y + 4, 6, 6, st[1]); }
    }
  }
  function drawBottom(c) {
    drawBottomBg(c);
    const k = S.botIn || 0; if (k <= 0.001 || !S.botMode) return;
    const real = S.mode, m = S.botMode, bk = x => { x = clamp(x); const t = x - 1; return 1 + t * t * (2.2 * t + 1.2); };   // ease-out-back: a small overshoot
    const out = real !== m && !HUDM.includes(real);   // sliding out while the battle goes on
    S.mode = m;
    try {
      c.save(); c.translate(0, Math.round((1 - (out ? k : bk(k))) * 80));
      if (!['move', 'party', 'bag', 'learnPick'].includes(m)) partyStrip(c);
      if (m === 'cmd') { c.save(); c.translate(Math.round((1 - bk(k * 1.3 - .15)) * 70), 0); cmdButtons(c); c.restore(); }
      else if (m === 'move') { const P = S.b.active(0); moveInfoBox(c, P); moveButtons(c, P, null, S.mv); }
      else if (m === 'party') partyBottom(c);
      else if (m === 'bag') bagBottom(c);
      else if (m === 'learnAsk' || m === 'learnPick') learnBottom(c);
      c.restore();
    } finally { S.mode = real; }
  }
  function fadeOverlay(c) { if (S.fade > 0) { c.fillStyle = `rgba(0,0,0,${clamp(S.fade)})`; c.fillRect(0, 0, W, H); } }

  // render(top, bottom): both 240x155 canvases (bottom may be omitted)
  function render(top, bot) {
    applyConfig(); S.hit = {}; if (S.editMode && S.b) { placeOffsets(side(0), 0); placeOffsets(side(1), 1); } top.imageSmoothingEnabled = false; top.clearRect(0, 0, W, H);
    if (!S.b) { rect(top, 0, 0, W, H, '#101018'); if (bot) rect(bot, 0, 0, W, H, '#101018'); return; }
    drawTop(top); fadeOverlay(top);
    if (bot) { bot.imageSmoothingEnabled = false; bot.clearRect(0, 0, W, H); drawBottom(bot); fadeOverlay(bot); }
  }

  // ---- layout editor support: a frozen scene with everything on screen at once (used by battle_layout_editor.html)
  // o: { ally:{species,level,shiny}, foe:{species,level,shiny}, bg, foeTrainerSprite, playerTrainerSprite, trainerName, mode:'cmd'|'move'|'msg', text,
  //      showAllyMon, showFoeMon, showAllyTrainer, showFoeTrainer }
  function layoutPreview(o) {
    const a = o.ally || {}, f = o.foe || {};
    start({ kind: o.foeTrainerSprite ? 'trainer' : 'wild', trainerName: o.trainerName || 'Trainer', bg: o.bg || 'grass', skipIntro: true, noExp: true,
      player: [{ species: a.species, level: a.level || 20, shiny: a.shiny ? 1 : 0 }].concat((o.party || []).map(m => ({ species: m.species, level: m.level || 15 }))), foe: [{ species: f.species, level: f.level || 15, shiny: f.shiny ? 1 : 0 }],
      foeTrainerSprite: o.foeTrainerSprite || '', playerTrainerSprite: o.playerTrainerSprite || '' });
    for (const ev of S.q) if (ev.t === 'switchin') {
      const sd = side(ev.side); sd.vis = true; sd.name = ev.name; sd.species = ev.species; sd.level = ev.level; sd.hp = ev.hp; sd.maxhp = ev.maxhp; sd.dhp = ev.hp; sd.status = ev.status || null; sd.shiny = !!ev.shiny; sd.gender = ev.gender || ''; sd.idx = ev.idx;
      sd.ox = 0; sd.oy = 0; sd.alpha = 1; sd.scale = 1; sd.blink = 0; placeOffsets(sd, ev.side);
      if (ev.side === 0) { const M = S.b.sides[0].party[ev.idx]; sd.exp = M ? expFrac(M.exp, M.growth, M.level) : 0; }
    }
    if (o.showAllyMon === false) side(0).vis = false; if (o.showFoeMon === false) side(1).vis = false;
    S.tr.me.vis = o.showAllyTrainer !== false && !!S.tr.me.path; S.tr.foe.vis = o.showFoeTrainer !== false && !!S.tr.foe.path; S.tr.me.ox = 0; S.tr.foe.ox = 0;
    S.q = []; S.cur = null; S.fade = 0; S.fadeDir = 0; S.editMode = true; S.mode = o.mode || 'cmd'; S.mv = 0; S.cmd = o.cmd | 0;
    setText(o.text || ('What will ' + side(0).name + ' do?'), true);
  }
  function status() {
    return { mode: S.mode, queue: S.q.length, cur: S.cur && S.cur.ev.t, pending: S.b && S.b.pending, result: S.result, text: (S.lines || []).join(' / '), bag: S.bag.map(b => b.item + ' x' + b.count), warnings: [...warnings],
      sides: S.sides.map(s => ({ name: s.name, level: s.level, hp: Math.round(s.dhp), maxhp: s.maxhp, status: s.status, vis: s.vis, dx: s.dx, dy: s.dy })), over: S.b && S.b.over, finished: !!S.finished, intro: S.introT };
  }
  function rebuild() { /* images load on demand */ }
  return { S, opt, W, H, press, click, update, render, start, initFont, status, rebuild, warnings, act, getImg, nudge, layoutPreview, LEG };
}
root.BattleSceneCore = createBattle;
})(window);

// ---------------------------------------------------------------------------
// kept from the old scene: other files (ThrowPokeBallAnim ...) may still call it
// ---------------------------------------------------------------------------
if (typeof window.removeSpriteBackground !== 'function') {
  window.removeSpriteBackground = function (scene, textureKey, frameWidth = 0, frameHeight = 0, shinyPaletteSourceKey = null) {
    const transKey = shinyPaletteSourceKey ? `${textureKey}_shiny_trans` : `${textureKey}_trans`;
    if (scene.textures.exists(transKey)) return transKey;
    if (!scene.textures.exists(textureKey)) return textureKey;
    const sourceImage = scene.textures.get(textureKey).getSourceImage();
    if (!sourceImage || sourceImage.width === 0) return textureKey;
    const canvasTex = scene.textures.createCanvas(transKey, sourceImage.width, sourceImage.height);
    if (!canvasTex) return textureKey;
    canvasTex.draw(0, 0, sourceImage);
    const ctx = canvasTex.context, imgData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height), data = imgData.data;
    if (data[3] !== 0) { const r = data[0], g = data[1], b = data[2]; for (let i = 0; i < data.length; i += 4) if (data[i] === r && data[i + 1] === g && data[i + 2] === b) data[i + 3] = 0; }
    ctx.putImageData(imgData, 0, 0); canvasTex.refresh();
    if (frameWidth > 0 && frameHeight > 0) { let f = 0; for (let y = 0; y < sourceImage.height; y += frameHeight) for (let x = 0; x < sourceImage.width; x += frameWidth) canvasTex.add(f++, 0, x, y, frameWidth, frameHeight); }
    return transKey;
  };
}

// ---------------------------------------------------------------------------
// the Phaser scene
// ---------------------------------------------------------------------------
class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }
  init(data) { this.battleData = data || {}; this.finishedOnce = false; }

  // (nothing to preload: the music is fetched in the background after the scene is on screen, so the battle opens at once)

  create() {
    this.tornDown = false;   // Phaser reuses this scene object: without this reset, the 2nd battle never cleaned up (music kept playing, keys stayed captured)
    try { window.removeEventListener('keydown', this.kd, true); } catch (e) { /* ignore */ }
    const gsm = window.GameStateManager, d = this.battleData, sv = (gsm && gsm.saveData) || {};
    const cw = this.scale.width || 480, ch = this.scale.height || 620, L = BattleScene.LAYOUT || {};
    const gap = L.gap != null ? L.gap : 4, topH = L.topH || Math.round((ch - gap) / 2), botY = topH + gap;
    this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x111111).setDepth(0);
    const mkTex = key => { if (this.textures.exists(key)) this.textures.remove(key); const t = this.textures.createCanvas(key, 240, 155); try { t.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (e) { /* older Phaser */ } return t; };
    this.texTop = mkTex('bs_top'); this.texBot = mkTex('bs_bot');
    this.ctxTop = this.texTop.getContext ? this.texTop.getContext() : this.texTop.context; this.ctxBot = this.texBot.getContext ? this.texBot.getContext() : this.texBot.context;
    this.add.image(0, 0, 'bs_top').setOrigin(0, 0).setScale(cw / 240, topH / 155).setDepth(1);
    this.add.image(0, botY, 'bs_bot').setOrigin(0, 0).setScale(cw / 240, (ch - botY) / 155).setDepth(1);
    if (gap > 0) this.add.rectangle(cw / 2, topH + gap / 2, cw, gap, 0x111111).setDepth(30);

    const audioCache = {};
    const cry = sp => { const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : null; let e = db && db[sp]; if (!e && db) { const k = Object.keys(db).find(x => x.toUpperCase().replace(/[^A-Z0-9]/g, '') === String(sp).toUpperCase().replace(/[^A-Z0-9]/g, '')); e = k && db[k]; } if (!e || !e.cry) return; try { const a = audioCache[e.cry] || (audioCache[e.cry] = new Audio(e.cry)); a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { /* blocked until a key press */ }); } catch (er) { /* no audio */ } };
    const tables = typeof PokeballTables !== 'undefined' ? PokeballTables : null, first = (sv.party || []).find(m => m && m.species) || {}, bt = tables && (tables[first.ballId || 1] || tables[1]);
    const core = BattleSceneCore({
      urlFor: p => p, engine: engineEnv, types: () => engineEnv().types, cry,
      bag: () => sv.bag || sv.items || sv.inventory || [],
      onItemUsed: (item, ref) => decItem(sv, item, ref),
      onSeen: sp => { if (window.Dex) window.Dex.see(sp); },
      onEnd: res => this.finishBattle(res),
      glyphs: () => { try { return typeof EmeraldFont !== 'undefined' ? new EmeraldFont(null).glyphMap : null; } catch (e) { return null; } },
    });
    this.core = core;

    // ---- who fights: TrainerTable (looked up by the trainer ID in the script) or the data passed in
    const opp = gsm && gsm.opponentPartyMon1;
    const id = d.trainerID || d.name, tt = typeof findTrainer === 'function' && id ? findTrainer(id) : null;
    if (id && !tt && !(d.pokemon && d.pokemon.length)) console.warn(`[BattleScene] trainer "${id}" is not in TrainerTable (tables/TrainerTables.js) and no pokemon were given: using GameStateManager.opponentPartyMon1`);
    const list = d.pokemon && d.pokemon.length ? d.pokemon : (tt ? tt.party : (opp ? [opp] : []));
    const foe = list.map((f, i) => Object.assign({}, f, { isShiny: f.isShiny !== undefined ? f.isShiny : (f.shiny !== undefined ? f.shiny : (!tt && i === 0 && opp && opp.species === f.species ? opp.isShiny : 0)) }));
    const kind = d.kind || (id || d.trainerName ? 'trainer' : 'wild');
    const nice = s => { s = String(s || ''); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
    const cls = tt && tt.class ? tt.class + ' ' : '';
    const trainerName = d.trainerName || (tt ? cls + tt.name : nice(id || (gsm && gsm.activeOpponentNameBankA) || 'Trainer'));
    const spriteId = tt ? tt.id.replace(/^TRAINER_/, '').toLowerCase() : String(id || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const prize = kind !== 'trainer' ? 0 : (d.money != null ? d.money : (tt && typeof trainerMoney === 'function' ? trainerMoney(tt) : ((gsm && gsm.activeOpponentMoneyBankA) || 0)));
    if (tt && gsm && typeof gsm.setOpponentBankA === 'function') gsm.setOpponentBankA({ name: tt.name, id: tt.id, sprite: spriteId, trainerClass: tt.class || '', money: prize });
    // weather of the map the player was on (the overworld keeps it in window.OverworldWeather), or d.weather ('rain', 'sun', 'sand', 'hail', 'fog', 'none')
    const rawW = d.weather !== undefined ? d.weather : (BattleScene.USE_MAP_WEATHER ? window.OverworldWeather : null);
    const battleWeather = rawW ? (BattleScene.WEATHER_MAP[String(rawW).toLowerCase().replace(/[^a-z]/g, '')] || (['rain', 'sun', 'sand', 'hail', 'fog'].includes(rawW) ? rawW : null)) : null;
    const player = (sv.party || []).filter(m => m && m.species);
    const back = (BattleScene.PLAYER_BACK || {})[String(sv.player && sv.player.gender || 'MALE').toUpperCase()] || (BattleScene.PLAYER_BACK || {}).MALE;
    this.cleanup = this.cleanup || [];
    core.initFont().then(() => {
      if (!this.sys || !this.sys.isActive()) return;
      try {
        core.start({
          weather: battleWeather, kind, trainerName, player, foe, bag: d.bag, bg: d.bg || (tt && tt.bg) || 'grass', ai: tt && tt.ai, items: tt && tt.items, seed: d.seed, skipIntro: !!d.skipIntro,
          money: prize,
          foeTrainerSprite: d.foeTrainerSprite || (tt && tt.frontSprite) || (kind === 'trainer' && spriteId ? `graphics/trainer_front_sprites/${spriteId}.png` : ''),
          playerTrainerSprite: d.playerTrainerSprite || back,
          ballSheet: bt ? { path: bt.spriteSheet, fw: bt.frameWidth || 16, fh: bt.frameHeight || 16 } : undefined,
          sparkleSheet: bt && bt.particleSheet ? { path: bt.particleSheet, fw: bt.particleFrameSize || 32, fh: bt.particleFrameSize || 32 } : undefined,
        });
      } catch (e) { console.error('[BattleScene] could not start the battle:', e); this.finishBattle(null); }
    });

    // ---- music
    // music: a plain <audio> element, created (and downloading) as soon as BattleScene.js loads, so it starts at once
    try { const m = BattleScene.musicEl(); if (m) { m.loop = true; m.volume = 0.5; m.currentTime = 0; const pr = m.play(); if (pr && pr.catch) pr.catch(() => { /* blocked until a key press */ }); this.battleMusic = m; } } catch (e) { /* no audio */ }

    // ---- input
    const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b' };
    this.openedAt = performance.now();
    this.kd = e => {
      const k = KEYS[e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat && k !== 'up' && k !== 'down' && k !== 'left' && k !== 'right') return;
      if (performance.now() - this.openedAt < 250) return;
      core.press(k);
    };
    window.addEventListener('keydown', this.kd, true);
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.tfgh = this.input.keyboard.addKeys({ t: KC.T, f: KC.F, g: KC.G, h: KC.H, y: KC.Y });
    this.editFocus = 0; this.editLast = 0;
    this.events.once('shutdown', () => this.teardown());
    this.events.once('destroy', () => this.teardown());
  }

  update(time, delta) {
    if (!this.core || !this.ctxTop) return;
    this.core.update(Math.min(.05, delta / 1000));
    if (!this.ctxTop) return;
    this.core.render(this.ctxTop, this.ctxBot); this.texTop.refresh(); this.texBot.refresh();
    this.coordEditor();
  }

  // Y = switch target, T/F/G/H = nudge (hold). Prints the values for PokemonDatabase.
  coordEditor() {
    const k = this.tfgh; if (!k || !this.core.S.b) return;
    if (Phaser.Input.Keyboard.JustDown(k.y)) { this.editFocus ^= 1; console.log('[CoordEditor] focus: ' + (this.editFocus === 0 ? 'YOUR Pokemon (xPosBack / yPosBack)' : 'FOE (xPosFront / yPosFront)')); }
    let dx = 0, dy = 0; const sp = .5;
    if (k.t.isDown) dy -= sp; if (k.g.isDown) dy += sp; if (k.f.isDown) dx -= sp; if (k.h.isDown) dx += sp;
    if (!dx && !dy) return;
    const v = this.core.nudge(this.editFocus, dx, dy), now = performance.now();
    if (now - this.editLast > 200) {
      this.editLast = now; const sd = this.core.S.sides[this.editFocus];
      console.log(`[CoordEditor] ${sd.species}: ${this.editFocus === 0 ? 'xPosBack' : 'xPosFront'}: ${v.x}, ${this.editFocus === 0 ? 'yPosBack' : 'yPosFront'}: ${v.y}`);
    }
  }

  finishBattle(res) {
    if (this.finishedOnce) return; this.finishedOnce = true;
    const gsm = window.GameStateManager, d = this.battleData, sv = (gsm && gsm.saveData) || {};
    if (res) {
      for (const mon of res.caught || []) addCaught(sv, mon);
      if (res.money > 0 && sv.player) sv.player.money = (sv.player.money || 0) + res.money;
      if (res.result === 'lose') healParty(sv);
      if (gsm) { gsm.lastBattle = res; if (typeof gsm.onBattleEnd === 'function') { try { gsm.onBattleEnd(res.result, res); } catch (e) { console.error('[BattleScene] onBattleEnd threw', e); } } }
    }
    if (typeof d.onEnd === 'function') { try { d.onEnd(res); } catch (e) { console.error('[BattleScene] onEnd threw', e); } }
    this.teardown();
    if (!d.onEnd || d.returnScene) this.scene.start(d.returnScene || BattleScene.RETURN_SCENE, d.returnData);
  }

  teardown() {
    if (this.tornDown) return; this.tornDown = true;
    try { window.removeEventListener('keydown', this.kd, true); } catch (e) { /* ignore */ }
    try { if (this.battleMusic) { this.battleMusic.pause(); this.battleMusic.currentTime = 0; } } catch (e) { /* ignore */ }
    // The two canvas textures are NOT removed here: the scene's images still use them for the frame being drawn, and removing a texture
    // in use makes WebGL throw "Cannot read properties of null (reading 'isGLTexture')". create() replaces them on the next battle.
    this.ctxTop = this.ctxBot = null;
  }
}
// ---------------------------------------------------------------------------
// LAYOUT / SCALE  -  edit these numbers, change them live in the browser console while a battle is open, or (easiest) use
// battle_layout_editor.html, which drags everything around and writes this block back into this file for you.
//   BattleScene.CONFIG.ally.scale = 1.25
// Units are GBA pixels (the game draws them 2x).  TOP screen is 240 x 155:  x = centre of the sprite, bottom = the line its LOWEST VISIBLE PIXEL stands on
// (transparent padding under the feet is ignored, so every sprite sits on the grass, front and back).
// scale: 1 = the sprite's own pixels.  foe.scale 0 = auto (shrinks big sprites to fit `fit` px).
// platform / platformX: the shadow ellipse.  trainerX / trainerBottom / trainerScale: the trainer sprites.  box: the HP box (top-left corner).
// bottom.msg = the TEXT BOX (drawn on the TOP screen, over the field).  bottom.btn = the FIGHT / BAG / POKeMON / RUN grid on the BOTTOM screen (x, y = top-left
// of the first button).  bottom.info = the move-info / learn-a-move box on the bottom screen.
// Per-species nudges (T/F/G/H keys, Y switches target) are stored in the Pokemon database as xPosFront/yPosFront (foe) and xPosBack/yPosBack (yours).
// ---------------------------------------------------------------------------
/*LAYOUT-BEGIN*/
BattleScene.CONFIG = {
  foe:  { x: 170, bottom: 74,  platform: 72,  platformX: 170, scale: 0, fit: 64, trainerX: 170, trainerBottom: 74,   trainerScale: 1, box: { x: 6,   y: 6,   w: 104 } },
  ally: { x: 60,  bottom: 112, platform: 110, platformX: 60,  scale: 1, fit: 64, trainerX: 60,  trainerBottom: 112, trainerScale: 1, box: { x: 126, y: 84, w: 108 } },
  ballScale: 1,
  intro: { flash: 0.9, slide: 1.0 },   // seconds: the ball flash, then the trainers sliding in
  levelBox: { x: 148, y: 26 },
  bottom: { msg: { x: 4, y: 111, w: 232, h: 42 }, info: { x: 4, y: 4 }, party: { x: 4, y: 12, gap: 38, show: true }, btn: { x: 4, y: 56, w: 112, h: 44, gapX: 8, gapY: 4 } },
};
/*LAYOUT-END*/
BattleScene.MUSIC = 'audio/music/victory_march.mp3';     // set to null for no music
BattleScene.RETURN_SCENE = 'OverworldScene';
BattleScene._m = null;
BattleScene.musicEl = () => { if (!BattleScene.MUSIC) return null; if (!BattleScene._m || BattleScene._m._src !== BattleScene.MUSIC) { const a = new Audio(BattleScene.MUSIC); a._src = BattleScene.MUSIC; a.preload = 'auto'; BattleScene._m = a; } return BattleScene._m; };
try { BattleScene.musicEl(); } catch (e) { /* no audio */ }   // start downloading now
// map weather -> battle weather (rain, sun, sand, hail change the rules; fog is only visual). Set BattleScene.USE_MAP_WEATHER = false to ignore the map.
BattleScene.USE_MAP_WEATHER = true;
BattleScene.WEATHER_MAP = { rain: 'rain', thunderstorm: 'rain', sunny: 'sun', drought: 'sun', snow: 'hail', sandstorm: 'sand', fog: 'fog' };
BattleScene.LAYOUT = null;                               // {topH, gap}; default: split the canvas height in two
BattleScene.PLAYER_BACK = { MALE: 'graphics/trainer_back_sprites/gTrainerBackPic_Brendan.png', FEMALE: 'graphics/trainer_back_sprites/gTrainerBackPic_May.png' };
window.BattleScene = BattleScene;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function engineEnv() {
  const t = n => { try { return (0, eval)('typeof ' + n + '!=="undefined"?' + n + ':null'); } catch (e) { return null; } };
  return { db: t('PokemonDatabase'), moves: t('MoveTable') || t('MoveTables') || t('MoveDatabase'), learn: t('LearnsetTable') || t('LearnsetTables'), evo: t('EvolutionTable') || t('EvolutionTables'), types: t('TypeTable') || BattleScene._tt || null };
}
function decItem(sv, item, ref) {
  if (ref && typeof ref.count === 'number') { ref.count--; return; } if (ref && typeof ref.qty === 'number') { ref.qty--; return; } if (ref && typeof ref.quantity === 'number') { ref.quantity--; return; }
  const bag = sv.bag || sv.items || sv.inventory; if (!bag || Array.isArray(bag)) return;
  const v = bag[item]; if (typeof v === 'number') bag[item] = v - 1; else if (v && typeof v === 'object') { if (typeof v.count === 'number') v.count--; else if (typeof v.qty === 'number') v.qty--; }
}
function addCaught(sv, mon) {
  mon.OTName = mon.OTName || (sv.player && sv.player.name) || ''; sv.party = sv.party || [];
  if (window.Dex) window.Dex.catch(mon.species, !!mon.isShiny);   // Pokedex: caught
  const free = sv.party.findIndex((m, i) => i < 6 && !m);
  if (free >= 0) { sv.party[free] = mon; return; }
  if (sv.party.filter(m => m).length < 6) { sv.party.push(mon); return; }
  sv.pcStorage = sv.pcStorage || [[]]; (sv.pcStorage[0] = sv.pcStorage[0] || []).push(mon);
}
function healParty(sv) {
  for (const m of sv.party || []) if (m) { m.HP = m.maxHP; m.status = null; for (const mv of m.moves || []) if (mv && mv.maxPP != null) mv.currentPP = mv.maxPP; }
}
