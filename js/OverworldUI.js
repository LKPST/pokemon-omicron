// js/OverworldUI.js
//
// Two small pieces of overworld UI (top screen, 480x320). Load it AFTER overworld_textbox.js (it uses the same font).
//
//   OWUI.banner(scene, 'Criscanto Town')         the map-name banner (brush stroke + two white lines) that slides in from the top
//   OWUI.receive(scene, opts, done)              the "you got something" card: picture on the left, label + name + info on the right
//        opts = { kind: 'item' | 'pokemon' | 'info', label: 'OBTAINED', name: 'Potion', count: 3, note: 'Put away in the ITEMS pocket.',
//                 sprite: 'graphics/item_sprites/potion.png',     (item picture, optional)
//                 mon: { species, shiny, level, types: ['Normal','Flying'] },  (a Pokémon: its battle sprite is used)
//                 key: 'ITEM_POTION' }                            (an item key: name / picture / pocket come from ItemSystem)
//   OWUI.receiveItem(scene, 'ITEM_POTION', 3, done)        shortcuts
//   OWUI.receivePokemon(scene, mon, 'party' | 'pc', done)
//
// Settings: OWUI.bannerMs (time on screen), OWUI.accent / OWUI.bannerColors.  A map can hide its banner with  banner: false  in overworld_map.js.
// All the drawing is plain canvas (drawBanner / drawCard), so OWUI.drawBanner / OWUI.drawCard can be used by editors / previews too.
(function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const TYPE_COL = { Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f0c820', Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0', Ground: '#d8b858', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820', Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#a8a8c0', Fairy: '#ee99ac', Stellar: '#58b8c8' };
  const API = {
    bannerMs: 2400, accent: '#46d2c8', bannerColors: ['#7b4fd8', '#4c7de6', '#52cfe0'],
    W: 480, H: 320,
  };

  // ------------------------------------------------------------------ text (the game's pixel font, any colour, integer scale)
  // font = { img, cols }  img = the white font sheet (ow_font_white), glyph n at ((n % cols) * 8, floor(n / cols) * 16)
  function glyphOf(ch) { const g = (window.OW_GLYPHS || (window.OverworldText && window.OverworldText.glyphs) || {})[ch]; return g ? g.r * 32 + g.c : -1; }
  function adv(ch) { return (window.OverworldText ? window.OverworldText.charWidth(ch) : (ch === ' ' ? 5 : 6)); }
  function textW(str, sc) { let w = 0; for (const ch of String(str)) w += adv(ch) * sc; return w; }
  function drawText(ctx, font, str, x, y, sc, color, shadow) {
    str = String(str == null ? '' : str);
    const w = Math.max(1, textW(str, sc)), cv = mk(w + 8 * sc, 16 * sc), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    let cx = 0;
    for (const ch of str) { const n = glyphOf(ch); if (n >= 0) c.drawImage(font.img, (n % font.cols) * 8, Math.floor(n / font.cols) * 16, 8, 16, cx, 0, 8 * sc, 16 * sc); cx += adv(ch) * sc; }
    if (color) { c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); }
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (shadow !== false) { const sh = mk(cv.width, cv.height), s = sh.getContext('2d'); s.drawImage(cv, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(0,0,0,0.55)'; s.fillRect(0, 0, sh.width, sh.height); ctx.drawImage(sh, x + sc, y + sc); }
    ctx.drawImage(cv, x, y); ctx.restore();
    return w;
  }
  const chamfer = (c, x, y, w, h, k) => { c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k); c.closePath(); };

  // ------------------------------------------------------------------ the map banner (480 x 64)
  function drawBanner(font, name, seed) {
    const W = API.W, H = 64, cv = mk(W, H), c = cv.getContext('2d');
    name = String(name || '').slice(0, 22); const sc = 3, tw = textW(name, sc);
    const bw = clamp(tw + 150, 300, W - 40), x0 = Math.round((W - bw) / 2), y0 = 10, bh = H - 20;
    let r = (seed || 7) >>> 0; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
    // brush stroke: ragged left / right ends, streaky top and bottom
    c.beginPath();
    const L = [], R = [];
    for (let y = 0; y <= bh; y += 3) { L.push([x0 + rnd() * 16 - (y % 9 < 3 ? 6 : 0), y0 + y]); R.push([x0 + bw - rnd() * 16 + (y % 12 < 3 ? 8 : 0), y0 + y]); }
    c.moveTo(L[0][0], L[0][1]); for (let i = 1; i < L.length; i++) c.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
    c.closePath();
    const g = c.createLinearGradient(x0, 0, x0 + bw, 0); const cols = API.bannerColors;
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    c.save(); c.clip();
    c.fillStyle = g; c.fillRect(x0 - 10, y0, bw + 20, bh);
    // soft light from the top, dark at the bottom, a few paint streaks
    const v = c.createLinearGradient(0, y0, 0, y0 + bh); v.addColorStop(0, 'rgba(255,255,255,0.28)'); v.addColorStop(0.45, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(10,10,40,0.30)');
    c.fillStyle = v; c.fillRect(x0 - 10, y0, bw + 20, bh);
    for (let i = 0; i < 26; i++) { const yy = y0 + rnd() * bh, xx = x0 + rnd() * bw * 0.8, ww = 30 + rnd() * 110; c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(30,20,80,0.12)'; c.fillRect(xx, yy, ww, 1 + (rnd() * 2 | 0)); }
    c.restore();
    // the two white lines run across the whole screen
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.fillRect(0, y0 - 5, W, 2); c.fillRect(0, y0 + bh + 3, W, 2);
    // name
    drawText(c, font, name, Math.round((W - tw) / 2), y0 + Math.round((bh - 16 * sc) / 2) + 2, sc, '#ffffff');
    return cv;
  }

  // ------------------------------------------------------------------ the "you got" card (448 x 92)
  function drawCard(font, o, spr) {
    const W = 448, H = 100, cv = mk(W, H), c = cv.getContext('2d'), acc = o.accent || API.accent;
    c.imageSmoothingEnabled = false;
    // glass panel
    chamfer(c, 1, 1, W - 2, H - 2, 8); c.fillStyle = 'rgba(8,12,26,0.88)'; c.fill();
    const gl = c.createLinearGradient(0, 0, 0, H); gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fill();
    chamfer(c, 1.5, 1.5, W - 3, H - 3, 8); c.lineWidth = 2; const bg = c.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, acc); bg.addColorStop(1, 'rgba(255,255,255,0.25)'); c.strokeStyle = bg; c.stroke();
    // picture badge
    const bs = 72, bx = 14, by = Math.round((H - bs) / 2);
    chamfer(c, bx, by, bs, bs, 6); const rg = c.createRadialGradient(bx + bs / 2, by + bs / 2, 4, bx + bs / 2, by + bs / 2, bs * 0.75); rg.addColorStop(0, 'rgba(70,210,200,0.38)'); rg.addColorStop(1, 'rgba(20,30,60,0.95)'); c.fillStyle = rg; c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
    c.strokeStyle = acc; c.lineWidth = 2;
    [[bx, by, 1, 1], [bx + bs, by, -1, 1], [bx, by + bs, 1, -1], [bx + bs, by + bs, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x + sx * 10, y + 0); c.lineTo(x, y); c.lineTo(x, y + sy * 10); c.stroke(); });
    // text (the font cell is 16 px tall but the letters only use ~9 of them, so the y values are cell tops)
    const tx = bx + bs + 18, avail = W - tx - 22;
    drawText(c, font, o.label || 'OBTAINED', tx, 5, 2, acc);
    const nm = String(o.name || '') + (o.count > 1 ? ' x' + o.count : '');
    const nsc = textW(nm, 3) <= avail ? 3 : 2;
    drawText(c, font, nm, tx, 22, nsc, '#ffffff');
    const hasPills = !!(o.mon && o.mon.types && o.mon.types.length);
    if (hasPills) {
      let px = tx; const yr = 58;
      if (o.mon.level) { px += drawText(c, font, 'Lv' + o.mon.level, px, yr - 1, 1, '#c8d4ee') + 14; }
      o.mon.types.forEach(t => {
        const lab = String(t).toUpperCase(), w = textW(lab, 1) + 14, col = TYPE_COL[t] || '#a8a878';
        chamfer(c, px, yr, w, 14, 3); c.fillStyle = col; c.fill(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, yr + 7, w, 7);
        drawText(c, font, lab, px + 7, yr - 2, 1, '#ffffff'); px += w + 6;
      });
    }
    if (o.note) { const sc = textW(o.note, 2) <= avail ? 2 : 1; drawText(c, font, o.note, tx, hasPills ? 70 : (sc === 2 ? 62 : 70), sc, '#aebbd8'); }
    return cv;
  }

  // ------------------------------------------------------------------ images
  const imgCache = new Map();
  function loadImg(path) {
    if (!path) return Promise.resolve(null);
    if (imgCache.has(path)) return imgCache.get(path);
    const p = new Promise(res => { const im = new Image(); const t = setTimeout(() => res(null), 2500); im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = path; });
    imgCache.set(path, p); return p;
  }
  // a picture canvas (max 60x60) from an image: Pokémon sheets (4 frames wide) use frame 0 (shiny: frame 1)
  function pictureOf(im, opts) {
    if (!im) return null;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; if (!iw || !ih) return null;
    // battle sheets are 4 frames side by side; icon sheets are 2 frames stacked (frame 0 = the top one)
    const stacked = opts && opts.icon && ih >= iw * 2, n = opts && opts.mon ? (iw / ih >= 3.5 ? 4 : 1) : 1, fw = Math.floor(iw / n), fr = n >= 4 && opts.shiny ? 1 : 0, fh = stacked ? Math.floor(ih / Math.round(ih / iw)) : ih;
    // trim transparent borders so it is centred
    const t = mk(fw, fh), tc = t.getContext('2d', { willReadFrequently: true }); tc.drawImage(im, fr * fw, 0, fw, fh, 0, 0, fw, fh);
    let x0 = fw, x1 = -1, y0 = fh, y1 = -1;
    try { const d = tc.getImageData(0, 0, fw, fh).data; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch (e) { x0 = 0; x1 = fw - 1; y0 = 0; y1 = fh - 1; }
    if (x1 < 0) return null;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1; const MAXP = (opts && opts.max) || 60; let s = Math.min(MAXP / cw, MAXP / ch); s = opts && opts.icon ? Math.min(1, s) : (s >= 2 ? Math.floor(s) : s);   // icons stay at 100%
    const out = mk(Math.max(1, Math.round(cw * s)), Math.max(1, Math.round(ch * s))), oc = out.getContext('2d'); oc.imageSmoothingEnabled = false;
    oc.drawImage(t, x0, y0, cw, ch, 0, 0, out.width, out.height); return out;
  }
  // fallback picture: a little gift box (items without art) or a ball (Pokémon without art)
  function fallbackPicture(kind) {
    const cv = mk(48, 48), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    if (kind === 'pokemon') {
      c.fillStyle = '#d83848'; c.beginPath(); c.arc(24, 24, 20, Math.PI, 0); c.fill(); c.fillStyle = '#f4f4f8'; c.beginPath(); c.arc(24, 24, 20, 0, Math.PI); c.fill();
      c.fillStyle = '#20202c'; c.fillRect(4, 22, 40, 4); c.beginPath(); c.arc(24, 24, 7, 0, 7); c.fill(); c.fillStyle = '#f4f4f8'; c.beginPath(); c.arc(24, 24, 4, 0, 7); c.fill();
    } else {
      c.fillStyle = '#5a8cf0'; c.fillRect(8, 18, 32, 24); c.fillStyle = '#7aa8ff'; c.fillRect(6, 12, 36, 8); c.fillStyle = '#f0c820'; c.fillRect(21, 12, 6, 30);
      c.beginPath(); c.arc(18, 9, 5, 0, 7); c.arc(30, 9, 5, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(8, 20, 32, 3);
    }
    return cv;
  }

  // ------------------------------------------------------------------ Phaser glue
  function withFont(scene, then) {
    const T = window.OverworldTextbox; if (!T) { then(null); return; }
    T.ensureFont(scene, () => {
      const tex = scene.textures.get(T.fontKey), img = tex && tex.getSourceImage();
      then(img ? { img, cols: Math.floor(img.width / 8) } : null);
    });
  }
  let uid = 0;
  const addTex = (scene, cv) => { const k = 'owui_' + (++uid); scene.textures.addCanvas(k, cv); return k; };
  const dropTex = (scene, k) => { try { if (scene.textures && scene.textures.exists(k)) scene.textures.remove(k); } catch (e) { /* scene gone */ } };

  API.drawBanner = drawBanner; API.drawCard = drawCard; API.drawText = drawText; API.textWidth = textW; API.pictureOf = pictureOf; API.fallbackPicture = fallbackPicture;

  API.banner = function (scene, name) {
    if (!scene || !scene.add || !name) return;
    withFont(scene, font => {
      if (!font || !scene.sys || !scene.sys.isActive()) return;
      if (API._banner) { try { API._banner.destroy(); } catch (e) { /* gone */ } API._banner = null; }
      const cv = drawBanner(font, name, name.length * 977 + 13), k = addTex(scene, cv);
      const im = scene.add.image(0, -70, k).setOrigin(0, 0).setScrollFactor(0).setDepth(5900).setAlpha(0);
      const S = (window.OW_TEXT && window.OW_TEXT.screen) || { x: 0, y: 0 };
      im.x = S.x; API._banner = im;
      scene.tweens.add({ targets: im, y: S.y + 6, alpha: 1, duration: 420, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: im, alpha: 0, y: S.y - 10, delay: 420 + API.bannerMs, duration: 520, ease: 'Sine.easeIn', onComplete: () => { im.destroy(); dropTex(scene, k); if (API._banner === im) API._banner = null; } });
    });
  };

  function sparkles(scene, cx, cy) {
    if (!scene.textures.exists('owui_spark')) {
      const cv = mk(5, 5), c = cv.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(2, 0, 1, 5); c.fillRect(0, 2, 5, 1); c.fillStyle = '#9ff4ee'; c.fillRect(1, 1, 3, 3);
      c.clearRect(0, 0, 1, 1); c.clearRect(4, 0, 1, 1); c.clearRect(0, 4, 1, 1); c.clearRect(4, 4, 1, 1); c.fillStyle = '#fff'; c.fillRect(2, 2, 1, 1); scene.textures.addCanvas('owui_spark', cv);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4, d = 38 + Math.random() * 26;
      const s = scene.add.image(cx, cy, 'owui_spark').setScrollFactor(0).setDepth(6102).setScale(2 + (i % 3)).setAlpha(0);
      scene.tweens.add({ targets: s, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, alpha: { from: 1, to: 0 }, angle: 90, delay: 120 + (i % 4) * 40, duration: 700, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
      scene.tweens.add({ targets: s, alpha: 1, duration: 1, delay: 120 + (i % 4) * 40 });
    }
  }

  // opts: see the header
  API.receive = async function (scene, o, done) {
    o = o || {}; const fin = () => { if (done) done(); };
    if (!scene || !scene.add) return fin();
    // resolve what the card needs: item data, picture
    let path = o.sprite || '', name = o.name, icon = '';
    if (o.key && window.ItemSystem) {
      const it = window.ItemSystem.info && window.ItemSystem.info(o.key);
      if (!path && it && it.sprite) path = it.sprite;
      if (!name) name = window.ItemSystem.name ? window.ItemSystem.name(o.key) : o.key;
      if (!o.note && it && it.pocket) { const pk = { items: 'ITEMS', medicine: 'MEDICINE', pokeballs: 'POKE BALLS', balls: 'POKE BALLS', tms: 'TMs & HMs', berries: 'BERRIES', key: 'KEY ITEMS', keyitems: 'KEY ITEMS', battle: 'BATTLE ITEMS' }[String(it.pocket).toLowerCase()] || String(it.pocket).toUpperCase(); o = Object.assign({}, o, { note: 'In the ' + pk + ' pocket.' }); }
    }
    if (o.mon && o.mon.species) {
      const db = (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase) || {}, d = db[o.mon.species] || db[String(o.mon.species).replace(/_[MF]$/, '')] || {};
      if (!path) path = d.battleSprite || d.frontSprite || '';
      icon = d.iconSprite || '';   // used when the big sprite is missing
      if (!name) name = o.mon.nickname || d.name || String(o.mon.species).replace(/^SPECIES_/, '');
      if (!o.mon.types) { const pretty = t => { t = String(t || '').replace(/^TYPE_/, ''); return t && t !== 'NONE' ? t[0] + t.slice(1).toLowerCase() : null; }; o = Object.assign({}, o, { mon: Object.assign({}, o.mon, { types: [pretty(d.type1), d.type2 !== d.type1 ? pretty(d.type2) : null].filter(Boolean) }) }); }
    }
    let [font, im] = await Promise.all([new Promise(r => withFont(scene, r)), loadImg(path)]);
    let isIcon = false; if (!im && icon) { im = await loadImg(icon); isIcon = !!im; }   // no battle sprite: the Pokémon's icon at 100%
    if (!font || !scene.sys || !scene.sys.isActive()) return fin();
    const pic = pictureOf(im, { mon: !!o.mon && !isIcon, icon: isIcon, shiny: o.mon && o.mon.shiny }) || fallbackPicture(o.mon ? 'pokemon' : 'item');
    const card = drawCard(font, Object.assign({}, o, { name }), pic), kc = addTex(scene, card), kp = addTex(scene, pic);
    const S = (window.OW_TEXT && window.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 };
    const CH = card.height, cx = S.x + Math.round((S.w - 448) / 2), cy = S.y + S.h - CH - 10;
    const D = 6100, objs = [];
    const img = scene.add.image(cx, cy + 40, kc).setOrigin(0, 0).setScrollFactor(0).setDepth(D).setAlpha(0); objs.push(img);
    const px = cx + 14 + 36, py = cy + Math.round(CH / 2);
    const sp = scene.add.image(px, py + 40, kp).setScrollFactor(0).setDepth(D + 1).setAlpha(0).setScale(0.2); objs.push(sp);
    const arrow = scene.add.triangle(cx + 448 - 22, cy + CH - 20, 0, 0, 14, 0, 7, 9, 0xffffff, 0.9).setScrollFactor(0).setDepth(D + 1).setVisible(false); objs.push(arrow);
    scene.tweens.add({ targets: img, y: cy, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: sp, y: py, alpha: 1, scale: 1, duration: 420, ease: 'Back.easeOut', delay: 90, onComplete: () => { sparkles(scene, px, py); } });
    let bob = null, closed = false, ready = false;
    scene.time.delayedCall(520, () => {
      if (closed) return; ready = true; arrow.setVisible(true);
      bob = scene.tweens.add({ targets: arrow, y: arrow.y + 4, duration: 320, yoyo: true, repeat: -1 });
      scene.tweens.add({ targets: sp, y: py - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    const close = () => {
      if (closed || !ready) return; closed = true;
      scene.input.keyboard.off('keydown', onKey); scene.input.off('pointerdown', close);
      scene.tweens.killTweensOf(sp); if (bob) bob.stop();
      scene.tweens.add({ targets: [img, sp, arrow], alpha: 0, y: '+=14', duration: 200, onComplete: () => { objs.forEach(x => x.destroy()); dropTex(scene, kc); dropTex(scene, kp); fin(); } });
    };
    const onKey = ev => { if (!ev.repeat && ['Space', 'Enter', 'KeyZ', 'KeyX'].includes(ev.code)) close(); };
    scene.input.keyboard.on('keydown', onKey); scene.input.on('pointerdown', close);
  };

  API.receiveItem = function (scene, key, count, done) { return API.receive(scene, { kind: 'item', label: 'OBTAINED', key, count }, done); };
  API.receivePokemon = function (scene, mon, where, done) {
    const note = where === 'pc' ? 'Your party is full: sent to the PC.' : 'Added to your party.';
    return API.receive(scene, { kind: 'pokemon', label: 'NEW POKEMON', mon: { species: mon.species, shiny: !!mon.isShiny, level: mon.level, nickname: mon.nickname }, note }, done);
  };


  // ------------------------------------------------------------------ evolution
  //   OWUI.evolve(scene, { name, from, to, shiny, canCancel }, done(ok))   the "What? X is evolving!" scene (B cancels). Only plays it.
  //   OWUI.applyEvolution(mon, 'SPECIES_X')                                changes the save mon (species, stats, ability, Pokédex)
  //   OWUI.runEvolutions(scene, done)                                      plays + applies every evolution the last battle reported
  const dbOf = () => (typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase) || {};
  const specOf = k => { const db = dbOf(); return db[k] || db[String(k).replace(/_[MF]$/, '')] || {}; };
  const nameOf = k => specOf(k).name || String(k).replace(/^SPECIES_/, '').toLowerCase().replace(/^./, c => c.toUpperCase());
  function wrapText(str, sc, maxW) {
    const lines = []; let cur = '';
    for (const w of String(str).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && textW(t, sc) > maxW) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function drawMsg(font, text) {
    const W = 448, H = 76, cv = mk(W, H), c = cv.getContext('2d');
    chamfer(c, 1, 1, W - 2, H - 2, 8); c.fillStyle = 'rgba(8,12,26,0.94)'; c.fill();
    chamfer(c, 1.5, 1.5, W - 3, H - 3, 8); c.lineWidth = 2; c.strokeStyle = API.accent; c.stroke();
    wrapText(text, 2, W - 60).slice(0, 2).forEach((l, i) => drawText(c, font, l, 20, 10 + i * 30, 2, '#ffffff'));
    return cv;
  }
  function whiteOf(pic) { const cv = mk(pic.width, pic.height), c = cv.getContext('2d'); c.drawImage(pic, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height); return cv; }

  API.evolve = async function (scene, o, done) {
    o = o || {}; let finished = false; const fin = ok => { if (finished) return; finished = true; if (done) done(!!ok); };
    try {
      if (!scene || !scene.add || !scene.sys || !scene.sys.isActive()) return fin(false);
      const dF = specOf(o.from), dT = specOf(o.to), shiny = !!o.shiny, name = o.name || nameOf(o.from), toName = nameOf(o.to);
      const [font, imO, imN] = await Promise.all([new Promise(r => withFont(scene, r)), loadImg(dF.battleSprite || dF.frontSprite), loadImg(dT.battleSprite || dT.frontSprite)]);
      if (!font || !scene.sys || !scene.sys.isActive()) return fin(false);
      const pO = pictureOf(imO, { mon: true, shiny, max: 120 }) || fallbackPicture('pokemon'), pN = pictureOf(imN, { mon: true, shiny, max: 120 }) || fallbackPicture('pokemon');
      const keys = [addTex(scene, pO), addTex(scene, pN), addTex(scene, whiteOf(pO)), addTex(scene, whiteOf(pN))], [kO, kN, kWO, kWN] = keys;
      const S = (window.OW_TEXT && window.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 }, D = 6200, objs = [], cx = S.x + S.w / 2, base = S.y + 196;
      const dim = scene.add.rectangle(cx, S.y + S.h / 2, S.w, S.h, 0x070a18, 1).setScrollFactor(0).setDepth(D).setAlpha(0); objs.push(dim);
      const sp = scene.add.image(cx, base, kO).setOrigin(0.5, 1).setScrollFactor(0).setDepth(D + 1).setAlpha(0); objs.push(sp);
      const flash = scene.add.rectangle(cx, S.y + S.h / 2, S.w, S.h, 0xffffff, 1).setScrollFactor(0).setDepth(D + 3).setAlpha(0); objs.push(flash);
      const msg = scene.add.image(S.x + Math.round((S.w - 448) / 2), S.y + S.h - 86, kO).setOrigin(0, 0).setScrollFactor(0).setDepth(D + 2).setAlpha(0); objs.push(msg);
      const arrow = scene.add.triangle(msg.x + 448 - 24, msg.y + 56, 0, 0, 14, 0, 7, 9, 0xffffff, 0.9).setScrollFactor(0).setDepth(D + 3).setVisible(false); objs.push(arrow);
      let msgKey = null, waiting = null, cancelled = false, animating = false;
      const wait = ms => new Promise(r => scene.time.delayedCall(ms, r));
      const say = (text, needKey) => new Promise(res => {
        const k = addTex(scene, drawMsg(font, text)); msg.setTexture(k); if (msgKey) dropTex(scene, msgKey); msgKey = k; msg.setAlpha(1);
        if (!needKey) return res();
        arrow.setVisible(true); waiting = () => { arrow.setVisible(false); waiting = null; res(); };
      });
      const onKey = ev => {
        if (ev.repeat) return;
        if (waiting && ['Space', 'Enter', 'KeyZ', 'KeyX'].includes(ev.code)) waiting();
        else if (animating && o.canCancel !== false && ['KeyX', 'Escape', 'Backspace'].includes(ev.code)) cancelled = true;
      };
      const onPtr = () => { if (waiting) waiting(); };
      scene.input.keyboard.on('keydown', onKey); scene.input.on('pointerdown', onPtr);
      const cleanup = () => {
        scene.input.keyboard.off('keydown', onKey); scene.input.off('pointerdown', onPtr);
        scene.tweens.add({ targets: [dim, sp, msg], alpha: 0, duration: 260, onComplete: () => { objs.forEach(x => { try { x.destroy(); } catch (e) { /* gone */ } }); keys.concat(msgKey ? [msgKey] : []).forEach(k => dropTex(scene, k)); } });
      };
      scene.tweens.add({ targets: dim, alpha: 0.94, duration: 300 }); scene.tweens.add({ targets: sp, alpha: 1, duration: 300 }); await wait(340);
      await say('What? ' + name + ' is evolving!', true);
      msg.setAlpha(0); animating = true;
      for (let i = 0; i < 18 && !cancelled; i++) { sp.setTexture(i % 2 ? kWN : kWO); sp.setScale(1 + 0.05 * (i % 2)); await wait(Math.max(70, 330 * Math.pow(0.8, i))); }
      animating = false;
      if (cancelled) { sp.setTexture(kO).setScale(1); await say('Huh? ' + name + ' stopped evolving!', true); cleanup(); return fin(false); }
      sp.setTexture(kN).setScale(1.15); flash.setAlpha(1); scene.tweens.add({ targets: flash, alpha: 0, duration: 700 });
      scene.tweens.add({ targets: sp, scale: 1, duration: 500, ease: 'Back.easeOut' }); sparkles(scene, cx, base - 60);
      await wait(800);
      await say('Congratulations! Your ' + name + ' evolved into ' + toName + '!', true);
      cleanup(); fin(true);
    } catch (e) { console.error('[OWUI.evolve]', e); fin(false); }
  };

  API.applyEvolution = function (mon, to) {
    if (!mon) return;
    const sp = specOf(to), old = specOf(mon.species), BE = window.BattleEngine || (typeof BattleEngine !== 'undefined' ? BattleEngine : null);
    if (sp.name) {
      if (mon.ability === old.ability1 && sp.ability1) mon.ability = sp.ability1;
      else if (mon.ability === old.ability2 && sp.ability2 && sp.ability2 !== 'ABILITY_NONE') mon.ability = sp.ability2;
    }
    mon.species = to;
    if (BE && sp.baseHP != null) {
      const L = mon.level | 0 || 1, nm = BE.natureMods(mon.nature || ''), iv = k => (mon['iv' + k] != null ? mon['iv' + k] : 15), oldMax = mon.maxHP || 0;
      mon.maxHP = BE.calcHP(sp.baseHP, iv('HP'), 0, L); mon.HP = Math.min(mon.maxHP, Math.max(0, (mon.HP || 0) + Math.max(0, mon.maxHP - oldMax)));
      mon.Attack = BE.calcStat(sp.baseAttack || 50, iv('Attack'), 0, L, nm.atk); mon.Def = BE.calcStat(sp.baseDefense || 50, iv('Defense'), 0, L, nm.def);
      mon.spattack = BE.calcStat(sp.baseSpAttack || 50, iv('SpAttack'), 0, L, nm.spa); mon.sdpef = BE.calcStat(sp.baseSpDefense || 50, iv('SpDefense'), 0, L, nm.spd);
      mon.speed = BE.calcStat(sp.baseSpeed || 50, iv('Speed'), 0, L, nm.spe);
      if (BE.expForLevel && sp.growthRate) mon.expmax = BE.expForLevel(sp.growthRate, L + 1);
    }
    try { if (window.Dex) { window.Dex.catch(to, !!mon.isShiny); if (mon.natdexID != null && window.Dex.num) mon.natdexID = window.Dex.num(to) || mon.natdexID; } } catch (e) { /* no Pokédex */ }
  };

  // after a battle: evolutions the battle reported (gameStateManager.lastBattle.evolutions), one after the other
  API.runEvolutions = function (scene, done) {
    const gsm = window.GameStateManager, lb = gsm && gsm.lastBattle, list = lb && lb.evolutions;
    if (!list || !list.length) { if (done) done(); return false; }
    lb.evolutions = [];
    const party = ((gsm.saveData || {}).party || []).filter(m => m && m.species), seen = new Set(), todo = list.filter(e => !seen.has(e.idx) && seen.add(e.idx));
    scene.isLocked = true;
    const next = i => {
      if (i >= todo.length || !scene.sys || !scene.sys.isActive()) {
        scene.time.delayedCall(250, () => {
          const J = Phaser.Input.Keyboard.JustDown; ['spaceKey', 'followKey', 'enterKey', 'bagKey'].forEach(k => { if (scene[k]) J(scene[k]); });
          scene.isLocked = false; try { if (window.OWFollower) { window.OWFollower.refresh(); } } catch (e) { /* ignore */ } try { window.SaveSystem && window.SaveSystem.touch('party'); } catch (e) { /* ignore */ }
          if (done) done();
        }); return;
      }
      const e = todo[i], mon = party[e.idx];
      if (!mon) return next(i + 1);
      API.evolve(scene, { name: mon.nickname || nameOf(mon.species), from: mon.species, to: e.to, shiny: mon.isShiny }, ok => { if (ok) API.applyEvolution(mon, e.to); next(i + 1); });
    };
    next(0); return true;
  };

  window.OWUI = API;
})();
