// js/OverworldSpriteLoader.js
//
// Loads overworld Pokémon sprites ON DEMAND from the one big sheet made by pokemon_editor.html (Overworld tab).
// The sheet is NEVER put into the GPU as a whole: only the Pokémon you ask for are cut out into small textures,
// and at most OWSprites.max (default 30) of them stay loaded - the least recently used one that nothing is using is dropped.
//
// Needs:  tables/OverworldSprites.js  (the table, loaded with a <script> tag BEFORE this file)
//         the PNG named in OverworldSprites.image (e.g. graphics/overworld/pokemon_ow.png)
//
//   await OWSprites.ensure(scene, ['SPECIES_PIKACHU', 'SPECIES_ODDISH'])      // load (cut out) these now
//   await OWSprites.ensureNames(scene, ['Pikachu', 'Oddish'])                  // same, by display name (wildData uses names)
//   await OWSprites.ensureMap(scene, 'Route 1')                                // every species in that map's wildData
//   const spr = await OWSprites.create(scene, x, y, 'SPECIES_PIKACHU', { shiny: false, dir: 'down' })   // Phaser sprite, kept loaded while it exists
//   OWSprites.setFrame(spr, 'left', step)          // step 0 | 1  (walk animation = alternate 0,1)
//   OWSprites.destroy(spr)                         // lets the texture be unloaded again
//   OWSprites.frameName(species, { shiny, dir, step })  ->  { key, frame } | null     (for your own scene.add.sprite / setTexture)
//   OWSprites.retain(species) / OWSprites.release(species)                              (manual hold, e.g. the party)
//   OWSprites.stats()  ->  { loaded: [...], max, sheetBytes }
//
// Frame names inside a Pokémon's texture:  "n_down_0" ... "n_up_1"  (normal)  and  "s_down_0" ... (shiny)
(function () {
  'use strict';
  const DIRS = ['down', 'left', 'right', 'up'];
  const S = { art: new Map(), artMax: 32, max: 30, ent: new Map(), blob: null, blobP: null, bmp: null, bmpTimer: 0, queue: Promise.resolve(), warned: false, tick: 0, holdMs: 4000 };

  const table = () => (typeof window !== 'undefined' && window.OverworldSprites) || (typeof OverworldSprites !== 'undefined' ? OverworldSprites : null);
  const keyOf = sp => 'ow_' + sp;
  const entry = sp => { const t = table(); return t && t.species[sp] || null; };
  const warn = m => console.warn('[OWSprites] ' + m);
  const log = (...a) => { if (API.log) console.log('[OWSprites]', ...a); };

  async function getBlob() {
    if (S.blob) return S.blob;
    if (!S.blobP) log('fetching the sheet', table().image), S.blobP = fetch(table().image).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + table().image); return r.blob(); })
      .then(b => (S.blob = b, log('sheet downloaded:', Math.round(b.size / 1024) + ' KB'), b)).catch(e => { S.blobP = null; throw e; });
    return S.blobP;
  }
  // The decoded sheet is kept only for a few seconds (so a burst of requests decodes it once), then closed to free the memory.
  async function getBitmap() {
    clearTimeout(S.bmpTimer);
    if (!S.bmp) S.bmp = await createImageBitmap(await getBlob());
    S.bmpTimer = setTimeout(() => { if (S.bmp) { S.bmp.close(); S.bmp = null; } }, S.holdMs);
    return S.bmp;
  }

  function evict(scene, keep) {
    if (S.ent.size <= S.max) return;
    const idle = [...S.ent.entries()].filter(([sp, e]) => e.refs <= 0 && !(keep && keep.has(sp))).sort((a, b) => a[1].last - b[1].last);
    for (const [sp] of idle) {
      if (S.ent.size <= S.max) break;
      const e = S.ent.get(sp); try { e.mgr.remove(keyOf(sp)); } catch (_) { }
      S.ent.delete(sp);
    }
  }

  function cut(scene, bmp, sp) {
    const e = entry(sp), w = e.w, h = e.h, W = 4 * w, H = 4 * h;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(bmp, e.x, e.y, W, H, 0, 0, W, H);
    const mgr = scene.textures, key = keyOf(sp);
    if (mgr.exists(key)) mgr.remove(key);
    const tex = mgr.addCanvas(key, c);
    try {   // size of the real art (largest side of the drawn pixels over the normal frames): used by fitScale
      const cx = c.getContext('2d'); let big = 0;
      for (let d = 0; d < 4; d++) for (let st = 0; st < 2; st++) {
        const px = cx.getImageData(st * w, d * h, w, h).data; let x0 = w, x1 = -1, y0 = h, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 >= 0) big = Math.max(big, x1 - x0 + 1, y1 - y0 + 1);
      }
      S.art.set(sp, big || Math.max(w, h)); log('art size', sp, (big || '?') + 'px in a ' + w + 'x' + h + ' cell');
    } catch (_) { S.art.set(sp, Math.max(w, h)); }
    for (const v of ['n', 's']) for (let d = 0; d < 4; d++) for (let st = 0; st < 2; st++)
      tex.add(`${v}_${DIRS[d]}_${st}`, 0, (v === 's' ? 2 * w : 0) + st * w, d * h, w, h);
    try { if (typeof Phaser !== 'undefined' && Phaser.Textures && tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.NEAREST); } catch (_) { }
    S.ent.set(sp, { refs: (S.ent.get(sp) || { refs: 0 }).refs, last: ++S.tick, mgr });
  }

  // load (cut out) the given species; resolves when all are ready. Unknown species are skipped.
  function ensure(scene, species) {
    const want = [...new Set((species || []).filter(sp => sp && entry(sp)))];
    want.forEach(sp => { const e = S.ent.get(sp); if (e) e.last = ++S.tick; });
    const need = want.filter(sp => !(S.ent.has(sp) && scene.textures.exists(keyOf(sp))));
    if (!need.length) return Promise.resolve(true);
    S.queue = S.queue.then(async () => {
      const todo = need.filter(sp => !(S.ent.has(sp) && scene.textures.exists(keyOf(sp))));
      if (!todo.length) return true;
      try {
        if (!table()) throw new Error('tables/OverworldSprites.js is not loaded');
        const bmp = await getBitmap();
        log('sheet decoded', bmp.width + 'x' + bmp.height, '- cutting', todo.join(', '));
        for (const sp of todo) cut(scene, bmp, sp);
        evict(scene, new Set(want));   // what was just asked for is never dropped (the cap is soft for one request)
        return true;
      } catch (err) { warn('could not load the overworld sheet: ' + err.message); return false; }
    });
    return S.queue;
  }

  const nameToKey = (() => { let map = null, src = null; return name => {
    const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : (window.PokemonDatabase || null); if (!db) return null;
    if (src !== db) { src = db; map = new Map(); for (const [k, v] of Object.entries(db)) { if (k === 'SPECIES_NONE') continue; const n = String(v.name || '').toLowerCase(); if (n && !map.has(n)) map.set(n, k); } }
    return map.get(String(name || '').toLowerCase()) || (db['SPECIES_' + String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_')] ? 'SPECIES_' + String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_') : null);
  }; })();

  function frameName(sp, o) {
    const e = entry(sp); o = o || {}; if (!e) return null;
    const v = o.shiny && e.shiny ? 's' : 'n', d = DIRS.includes(o.dir) ? o.dir : 'down', st = (o.step | 0) & 1;
    return { key: keyOf(sp), frame: `${v}_${d}_${st}` };
  }
  function touch(sp) { const e = S.ent.get(sp); if (e) e.last = ++S.tick; }

  const API = {
    log: true,
    get max() { return S.max; }, set max(n) { S.max = Math.max(1, n | 0); },
    ensure,
    ensureNames: (scene, names) => ensure(scene, (names || []).map(nameToKey).filter(Boolean)),
    ensureMap(scene, mapName) {
      const maps = (typeof OverworldMaps !== 'undefined' ? OverworldMaps : window.OverworldMaps) || {}, m = maps[mapName], names = new Set();
      if (m && m.wildData) for (const arr of Object.values(m.wildData)) for (const w of arr || []) if (w && w.pokemonName) names.add(w.pokemonName);
      return API.ensureNames(scene, [...names]);
    },
    has: (scene, sp) => !!(entry(sp) && S.ent.has(sp) && scene.textures.exists(keyOf(sp))),
    hasSprite: sp => !!entry(sp),
    frameName, textureKey: keyOf, nameToKey,

    // Grookey and everything after it at OWSprites.bigScale (2 = 200%). Decided by the sprite number in tables/OverworldSprites.js.
    // An optional  scale: 1.2  on a species entry multiplies the result. OWSprites.bigFrom = 'SPECIES_GROOKEY' changes the turning point.
    normalScale: 1, bigScale: 2, bigFrom: 'SPECIES_GROOKEY', maxPx: 64,
    fitScale(sp) {
      const e = entry(sp), t = entry(API.bigFrom), from = t ? t.src : 816, art = S.art.get(sp) || 0;
      let sc = (e && e.src >= from) ? API.bigScale : API.normalScale;
      if (art && API.maxPx > 0 && art * sc > API.maxPx) sc = API.maxPx / art;    // never taller/wider than maxPx on screen
      return sc * ((e && e.scale) || 1);
    },
    retain(sp) { const e = S.ent.get(sp); if (e) { e.refs++; e.last = ++S.tick; } },
    release(sp) { const e = S.ent.get(sp); if (e && e.refs > 0) e.refs--; },
    async create(scene, x, y, sp, o) {
      if (!entry(sp)) { warn('create: no entry for ' + sp); return null; }
      if (!(await ensure(scene, [sp])) || !scene.textures.exists(keyOf(sp))) { warn('create: texture for ' + sp + ' was not made'); return null; }
      const f = frameName(sp, o), spr = scene.add.sprite(x, y, f.key, f.frame);
      spr.owSpecies = sp; spr.owShiny = !!(o && o.shiny); API.retain(sp); return spr;
    },
    setFrame(spr, dir, step, shiny) {
      if (!spr || !spr.owSpecies) return; if (shiny !== undefined) spr.owShiny = !!shiny;
      const f = frameName(spr.owSpecies, { shiny: spr.owShiny, dir, step }); touch(spr.owSpecies);
      if (f && spr.scene && spr.scene.textures.exists(f.key)) spr.setFrame(f.frame);
    },
    destroy(spr) { if (spr && spr.owSpecies) { API.release(spr.owSpecies); spr.owSpecies = null; } if (spr && spr.destroy) spr.destroy(); },
    stats: () => ({ loaded: [...S.ent.keys()], max: S.max, sheetBytes: S.blob ? S.blob.size : 0, decoded: !!S.bmp }),
    // drop the decoded sheet right now (it is dropped by itself a few seconds after the last request)
    releaseSheet() { clearTimeout(S.bmpTimer); if (S.bmp) { S.bmp.close(); S.bmp = null; } },
  };
  window.OWSprites = API;
})();
