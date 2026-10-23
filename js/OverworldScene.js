// ===========================================================================
// WEATHER
// The weather of the map the player is standing in comes from the `weather:`
// field in overworld_map.js. Supported values (case, spaces, "_" and "-" are
// ignored, so "Volcanic Ash", "volcanic_ash" and "VolcanicAsh" all work):
//   Normal · Sunny · Drought · Rain · Thunderstorm · Snow · Fog · Sandstorm · Volcanic Ash
// The weather of the map you are standing in covers every connected map that is
// visible on screen. It only changes (with a fade) when the player ENTERS a map
// with different weather. Weather lives in the world, so it does not follow the camera.
// To change how a weather looks, edit OW_WEATHER_TYPES below.
// ===========================================================================

// [TABLE] The overworld table. Found as window.OverworldTable, or as a plain `const OverworldTable = {...}` / `OVERWORLD_TABLE` in another script
// (a const at the top of a script is NOT on window, so window.OverworldTable alone would miss it).
function OW_TABLE() {
  if (window.OverworldTable) return window.OverworldTable;
  let t = null;
  try { if (typeof OverworldTable !== 'undefined') t = OverworldTable; } catch (e) { /* not declared */ }
  if (!t) { try { if (typeof OverworldTables !== 'undefined') t = OverworldTables; } catch (e) { /* not declared */ } }
  if (!t) { try { if (typeof OW_TABLES !== 'undefined') t = OW_TABLES; } catch (e) { /* not declared */ } }
  if (t) window.OverworldTable = t;
  else if (!OW_TABLE.warned) { OW_TABLE.warned = true; console.error('[OW] OverworldTable was not found. Check that its script is loaded (and has no error) BEFORE overworld_scene.js in index.html.'); }
  return t;
}

const OW_WEATHER_DEPTH = 5000;
// How many tiles the border block is drawn beyond the edge of the maps. Weather covers the same area.
const OW_BORDER_RANGE = 14;

// Sprite background removal: the colour of the first pixel (top-left) of an OW sprite sheet
// is treated as the background. If that pixel is already transparent, nothing is done.
//   'edge' = only remove that colour where it touches the frame border (safe: keeps white
//            hats, eyes, etc. inside the sprite)
//   'all'  = remove every pixel of that colour in the sheet
const OW_BG_MODE = 'edge';
const OW_BG_TOLERANCE = 6;   // how far (0-255 per channel) a colour may differ and still count as background

const OW_WEATHER_ALIASES = {
  '': 'none', normal: 'none', none: 'none', clear: 'none',
  sunny: 'sunny', sun: 'sunny',
  drought: 'drought', harshsunlight: 'drought',
  rain: 'rain', rainy: 'rain',
  thunderstorm: 'thunderstorm', thunder: 'thunderstorm',
  snow: 'snow', snowy: 'snow',
  fog: 'fog', foggy: 'fog',
  sandstorm: 'sandstorm', sand: 'sandstorm',
  volcanicash: 'ash', ash: 'ash', ashfall: 'ash',
};

// overlay   : color wash (color, alpha, optional pulse {amount, speed}, optional shift {to, speed}
//             which slowly blends the colour towards `to` and back)
// particles : one entry or a list. texture, density (per 100,000 world pixels of screen),
//             vx/vy (px per second), alpha / scale ranges, tint, align, sway,
//             splash {chance} (drops land on the "floor" and make a ripple)
// fog       : drifting cloud layers
// lightning : random flashes
const OW_WEATHER_TYPES = {
  none: {},

  sunny: {
    overlay: {
      color: 0xfff0b0, alpha: 0.14,
      pulse: { amount: 0.04, speed: 0.8 },
      shift: { to: 0xffd27a, speed: 0.6 },
    },
  },

  drought: {
    overlay: {
      color: 0xffb347, alpha: 0.24,
      pulse: { amount: 0.05, speed: 1.2 },
      shift: { to: 0xff6a1f, speed: 0.9 },
    },
    particles: {
      texture: 'owx_dot', density: 22,
      vx: [-6, 6], vy: [-45, -20],
      alpha: [0.12, 0.3], scale: [0.5, 1.1],
      tint: 0xfff2c0, sway: { amp: [6, 16], freq: [0.8, 1.8] },
    },
  },

  rain: {
    overlay: { color: 0x14213d, alpha: 0.16 },
    particles: {
      texture: 'owx_drop', density: 90,
      vx: [-150, -110], vy: [700, 900],
      alpha: [0.35, 0.6], scale: [1, 1],
      tint: 0xbcd7ff, align: true,
      splash: { chance: 0.7 },
    },
  },

  thunderstorm: {
    overlay: { color: 0x0a1020, alpha: 0.36 },
    particles: {
      texture: 'owx_drop', density: 170,
      vx: [-260, -200], vy: [900, 1150],
      alpha: [0.4, 0.7], scale: [1, 1.3],
      tint: 0xa8c4f0, align: true,
      splash: { chance: 0.5 },
    },
    lightning: { minDelay: 3000, maxDelay: 9000 },
  },

  snow: {
    overlay: { color: 0xcfe0ff, alpha: 0.08 },
    particles: {
      texture: 'owx_dot', density: 60,
      vx: [-15, 15], vy: [35, 80],
      alpha: [0.7, 1], scale: [0.5, 1.0],
      tint: 0xffffff, sway: { amp: [10, 28], freq: [0.6, 1.6] },
    },
  },

  ash: {
    overlay: { color: 0x3b322d, alpha: 0.32 },
    particles: {
      texture: 'owx_dot', density: 55,
      vx: [-30, -8], vy: [40, 75],
      alpha: [0.5, 0.85], scale: [0.4, 0.9],
      tint: 0x8a8580, sway: { amp: [6, 18], freq: [0.5, 1.2] },
    },
  },

  fog: {
    overlay: { color: 0xdfe6ea, alpha: 0.14 },
    fog: [
      { texture: 'owx_fogA', alpha: 0.34, vx: 12, vy: 2 },
      { texture: 'owx_fogB', alpha: 0.26, vx: 22, vy: -3 },
    ],
  },

  sandstorm: {
    overlay: { color: 0xb89455, alpha: 0.30, pulse: { amount: 0.05, speed: 0.7 } },
    particles: [
      {
        texture: 'owx_dot', density: 140,
        vx: [-720, -480], vy: [20, 90],
        alpha: [0.35, 0.75], scale: [0.35, 0.8],
        tint: 0xd8b878,
      },
      {
        texture: 'owx_drop', density: 35,
        vx: [-900, -650], vy: [30, 100],
        alpha: [0.25, 0.5], scale: [1, 1.8],
        tint: 0xe6cc94, align: true,
      },
    ],
  },
};

const owLerpColor = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};

class OverworldWeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
    this.currentType = null;
    this.mapKey = null;
    this.warned = new Set();
    OverworldWeatherSystem.ensureTextures(scene);
  }

  static ensureTextures(scene) {
    const tm = scene.textures;
    const make = (key, w, h, draw) => {
      if (tm.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make('owx_px', 2, 2, g => { g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 2, 2); });
    make('owx_drop', 2, 14, g => { g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 2, 14); });
    make('owx_dot', 8, 8, g => { g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 3.5); });
    // Small flat ring used for rain ripples on the ground
    make('owx_ring', 16, 8, g => { g.lineStyle(1.5, 0xffffff, 1); g.strokeEllipse(8, 4, 13, 5); });

    const makeFog = (key, seed, blobs, minR, maxR) => {
      if (tm.exists(key)) return;
      const size = 512;
      const tex = tm.createCanvas(key, size, size);
      const ctx = tex.getContext();
      let s = seed;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      for (let i = 0; i < blobs; i++) {
        const r = minR + rnd() * (maxR - minR);
        const bx = rnd() * size;
        const by = rnd() * size;
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            const cx = bx + ox, cy = by + oy;
            if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, 'rgba(255,255,255,0.55)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          }
        }
      }
      tex.refresh();
    };
    makeFog('owx_fogA', 7, 14, 60, 170);
    makeFog('owx_fogB', 13, 9, 90, 210);
  }

  rand(a, b) { return a + Math.random() * (b - a); }
  range(r) { return this.rand(r[0], r[1]); }

  normalize(name) {
    const key = String(name == null ? '' : name).toLowerCase().replace(/[\s_\-]/g, '');
    const type = OW_WEATHER_ALIASES[key];
    if (type) return type;
    if (!this.warned.has(key)) {
      this.warned.add(key);
      console.warn(`[weather] Unknown weather "${name}" in overworld_map.js. Use: Normal, Sunny, Drought, Rain, Thunderstorm, Snow, Fog, Sandstorm or Volcanic Ash.`);
    }
    return 'none';
  }

  // Call whenever the current map changes (and once when the scene starts)
  set(name, instant = false, mapKey = null) {
    if (mapKey) this.mapKey = mapKey;
    const type = this.normalize(name);

    if (type === this.currentType) {
      // Same weather: keep it running, just re-cover the maps connected to the new map
      const layer = this.layers.find(l => !l.leaving && l.type === type);
      if (layer) this.setRegions(layer, this.computeRegions());
      return;
    }

    this.currentType = type;
    window.OverworldWeather = type;   // read by BattleScene so a battle starts in the map's weather
    for (const layer of this.layers.slice()) {
      if (!layer.leaving) this.fadeOut(layer, instant);
    }
    if (type !== 'none') this.layers.push(this.createLayer(type, instant));
  }

  // The weather of the current map covers EVERY connected map (all of them can be on screen).
  // The weather also covers the border area around those maps (OW_BORDER_RANGE tiles). The expanded rectangles
  // overlap, so they are merged into non-overlapping bands (otherwise overlays would stack and look darker).
  computeRegions() {
    const M = OW_BORDER_RANGE * 32;
    const rects = Object.values(this.scene.getConnectedMapRects()).map(r => ({ x: r.x - M, y: r.y - M, w: r.w + 2 * M, h: r.h + 2 * M }));
    const xs = [...new Set(rects.flatMap(r => [r.x, r.x + r.w]))].sort((a, b) => a - b);
    const ys = [...new Set(rects.flatMap(r => [r.y, r.y + r.h]))].sort((a, b) => a - b);
    const out = [];
    for (let j = 0; j < ys.length - 1; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      let run = null;
      const flush = () => { if (run) { out.push({ x: run.x0, y: ys[j], w: run.x1 - run.x0, h: ys[j + 1] - ys[j] }); run = null; } };
      for (let i = 0; i < xs.length - 1; i++) {
        const cx = (xs[i] + xs[i + 1]) / 2;
        if (rects.some(r => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h)) {
          if (run) run.x1 = xs[i + 1]; else run = { x0: xs[i], x1: xs[i + 1] };
        } else flush();
      }
      flush();
    }
    return out;
  }

  createLayer(type, instant) {
    const cfg = OW_WEATHER_TYPES[type];
    const layer = {
      type, cfg, fade: instant ? 1 : 0, leaving: false, time: 0,
      groups: [].concat(cfg.particles || []).map(spec => ({ spec, items: [] })),
      regions: [], regionObjs: [], sig: '', bolt: 0,
      splashes: [], splashPool: [],
    };
    if (cfg.lightning) layer.bolt = this.rand(cfg.lightning.minDelay, cfg.lightning.maxDelay);

    this.setRegions(layer, this.computeRegions());

    if (!instant) {
      this.scene.tweens.add({ targets: layer, fade: 1, duration: 1500, ease: 'Sine.easeInOut' });
    }
    return layer;
  }

  setRegions(layer, rects) {
    const sig = rects.map(r => `${r.x},${r.y},${r.w},${r.h}`).sort().join('|');
    if (sig === layer.sig) return;
    layer.sig = sig;
    this.destroyRegionObjects(layer);
    layer.regions = rects;
    layer.regionObjs = rects.map(r => this.buildRegionObjects(layer, r));
  }

  buildRegionObjects(layer, r) {
    const scene = this.scene;
    const cfg = layer.cfg;
    const box = (depth, tint) => scene.add.image(r.x, r.y, 'owx_px')
      .setOrigin(0, 0).setDepth(depth).setTint(tint).setDisplaySize(r.w, r.h).setAlpha(0);

    const o = { r, overlay: null, flash: null, fogs: [] };
    if (cfg.overlay) o.overlay = box(OW_WEATHER_DEPTH, cfg.overlay.color);
    if (cfg.fog) {
      o.fogs = cfg.fog.map(f => scene.add.tileSprite(r.x, r.y, r.w, r.h, f.texture)
        .setOrigin(0, 0).setDepth(OW_WEATHER_DEPTH).setAlpha(0));
    }
    if (cfg.lightning) o.flash = box(OW_WEATHER_DEPTH + 2, 0xffffff);
    return o;
  }

  destroyRegionObjects(layer) {
    for (const o of layer.regionObjs) {
      if (o.overlay) o.overlay.destroy();
      if (o.flash) o.flash.destroy();
      o.fogs.forEach(f => f.destroy());
    }
    layer.regionObjs = [];
  }

  fadeOut(layer, instant) {
    layer.leaving = true;
    this.scene.tweens.killTweensOf(layer);
    if (instant) {
      this.destroyLayer(layer);
      return;
    }
    this.scene.tweens.add({
      targets: layer, fade: 0, duration: 900,
      onComplete: () => this.destroyLayer(layer),
    });
  }

  destroyLayer(layer) {
    const i = this.layers.indexOf(layer);
    if (i >= 0) this.layers.splice(i, 1);
    this.scene.tweens.killTweensOf(layer);
    for (const g of layer.groups) {
      g.items.forEach(p => p.img.destroy());
      g.items = [];
    }
    layer.splashes.forEach(s => s.img.destroy());
    layer.splashPool.forEach(img => img.destroy());
    layer.splashes = [];
    layer.splashPool = [];
    this.destroyRegionObjects(layer);
  }

  destroy() {
    for (const layer of this.layers.slice()) this.destroyLayer(layer);
    this.layers = [];
    this.currentType = null;
  }

  // The visible area in WORLD coordinates (zoom aware). Particles live in the world,
  // so they stay put when the camera moves.
  getView() {
    const wv = this.scene.cameras.main.worldView;
    return { left: wv.x, top: wv.y, right: wv.right, bottom: wv.bottom, w: wv.width, h: wv.height };
  }

  inRegions(regions, wx, wy) {
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h) return true;
    }
    return false;
  }

  update(delta) {
    if (!this.layers.length) return;
    const dt = Math.min(delta, 50) / 1000;
    const view = this.getView();

    for (const layer of this.layers.slice()) {
      layer.time += dt;
      const cfg = layer.cfg;

      for (const o of layer.regionObjs) {
        if (o.overlay) {
          const ov = cfg.overlay;
          let a = ov.alpha;
          if (ov.pulse) a += Math.sin(layer.time * ov.pulse.speed) * ov.pulse.amount;
          o.overlay.setAlpha(Math.max(0, a) * layer.fade);
          if (ov.shift) {
            const t = (Math.sin(layer.time * ov.shift.speed) + 1) / 2;
            o.overlay.setTint(owLerpColor(ov.color, ov.shift.to, t));
          }
        }
        o.fogs.forEach((f, i) => {
          const spec = cfg.fog[i];
          f.setAlpha(spec.alpha * layer.fade);
          f.tilePositionX = o.r.x - layer.time * spec.vx;
          f.tilePositionY = o.r.y - layer.time * spec.vy;
        });
      }

      for (const g of layer.groups) this.updateParticles(layer, g, view, dt);
      this.updateSplashes(layer, dt);

      if (cfg.lightning && !layer.leaving) {
        layer.bolt -= dt * 1000;
        if (layer.bolt <= 0) {
          this.strike(layer);
          layer.bolt = this.rand(cfg.lightning.minDelay, cfg.lightning.maxDelay);
        }
      }
    }
  }

  updateParticles(layer, group, view, dt) {
    const spec = group.spec;
    const items = group.items;

    const want = Math.min(600, Math.max(1, Math.round(spec.density * (view.w * view.h) / 100000)));
    while (items.length < want) items.push(this.spawnParticle(spec, view));
    while (items.length > want) items.pop().img.destroy();

    const regions = layer.regions;

    for (const p of items) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Particles wrap around the (slightly padded) visible area, so the density stays even
      // when the camera moves, while every particle keeps its place in the world.
      const L = view.left - p.m, R = view.right + p.m, T = view.top - p.m, B = view.bottom + p.m;
      if (p.x < L || p.x > R) {
        p.x = Phaser.Math.Wrap(p.x, L, R);
        if (!spec.splash) p.y = T + Math.random() * (B - T);
      }

      if (spec.splash) {
        // Rain: each drop falls to a random "ground" height, makes a ripple, then restarts
        if (p.y >= p.land) {
          if (Math.random() < spec.splash.chance && p.land >= view.top && this.inRegions(regions, p.x, p.land)) {
            this.addSplash(layer, p.x, p.land);
          }
          this.resetParticle(p, spec, view, false);
        } else if (p.land < view.top || p.land > view.bottom + 30) {
          this.resetParticle(p, spec, view, false);
        }
      } else if (p.y < T || p.y > B) {
        p.y = Phaser.Math.Wrap(p.y, T, B);
        p.x = L + Math.random() * (R - L);
      }

      const sway = p.amp ? Math.sin(layer.time * p.freq + p.phase) * p.amp : 0;
      const sx = p.x + sway;
      p.img.setPosition(sx, p.y);
      p.img.setAlpha(this.inRegions(regions, sx, p.y) ? p.a * layer.fade : 0);
    }
  }

  spawnParticle(spec, view) {
    const img = this.scene.add.image(0, 0, spec.texture)
      .setDepth(OW_WEATHER_DEPTH + 1)
      .setTint(spec.tint || 0xffffff).setAlpha(0);
    const p = { img, x: 0, y: 0, vx: 0, vy: 0, a: 1, m: 10, amp: 0, freq: 0, phase: 0, land: 0 };
    this.resetParticle(p, spec, view, true);
    return p;
  }

  resetParticle(p, spec, view, initial) {
    p.vx = this.range(spec.vx);
    p.vy = this.range(spec.vy);
    p.a = this.range(spec.alpha);
    p.img.setScale(this.range(spec.scale));
    p.m = Math.max(p.img.displayWidth, p.img.displayHeight) * 0.5 + 8;

    if (spec.sway) {
      p.amp = this.range(spec.sway.amp);
      p.freq = this.range(spec.sway.freq);
      p.phase = Math.random() * Math.PI * 2;
    } else {
      p.amp = 0;
    }
    if (spec.align) p.img.setRotation(Math.atan2(-p.vx, p.vy));

    if (spec.splash) {
      p.land = view.top + view.h * (0.3 + Math.random() * 0.7);
      p.x = view.left - 40 + Math.random() * (view.w + 80);
      p.y = initial
        ? view.top + Math.random() * (p.land - view.top)
        : view.top - p.m - Math.random() * 20;
      return;
    }

    p.x = view.left + Math.random() * view.w;
    p.y = view.top + Math.random() * view.h;
  }

  addSplash(layer, x, y) {
    if (layer.splashes.length >= 160) return;
    const img = layer.splashPool.pop()
      || this.scene.add.image(0, 0, 'owx_ring').setDepth(OW_WEATHER_DEPTH + 1).setTint(0xdbe9ff);
    img.setPosition(x, y).setScale(0.4).setAlpha(0.6 * layer.fade).setVisible(true);
    layer.splashes.push({ img, t: 0, dur: 0.3 + Math.random() * 0.15 });
  }

  updateSplashes(layer, dt) {
    for (let i = layer.splashes.length - 1; i >= 0; i--) {
      const s = layer.splashes[i];
      s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) {
        s.img.setVisible(false);
        layer.splashPool.push(s.img);
        layer.splashes.splice(i, 1);
        continue;
      }
      s.img.setScale(0.4 + k * 1.1).setAlpha(0.6 * (1 - k) * layer.fade);
    }
  }

  strike(layer) {
    const flashes = layer.regionObjs.map(o => o.flash).filter(Boolean);
    if (!flashes.length) return;
    const scene = this.scene;
    const setAll = a => flashes.forEach(f => { if (f.active) f.setAlpha(a); });

    scene.tweens.killTweensOf(flashes);
    setAll(0.85);
    scene.time.delayedCall(70, () => setAll(0.15));
    scene.time.delayedCall(140, () => setAll(0.7));
    scene.time.delayedCall(210, () => {
      const live = flashes.filter(f => f.active);
      if (live.length) scene.tweens.add({ targets: live, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
    });
  }
}

const OW_DIRS = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene');
    this.isLocked = false;
    this.activeNPC = null;
    this.player = null;
    this.playerGridX = 1;
    this.playerGridY = 1;
    this.isMoving = false;

    this.currentMapKey = window.GameStateManager && window.GameStateManager.saveData && window.GameStateManager.saveData.mapID
      ? window.GameStateManager.saveData.mapID
      : Object.keys(window.OverworldMaps)[0];
  }

  init() {
    this.player = null;
    this.npcs = [];
    this.triggers = [];
    this.isMoving = false;
    this.warping = false;
    this.worldOffsets = null;
    this.spinTimer = null;
    this.scriptRunning = false;   // [SCRIPTS]
    this.scriptEndedAt = 0;
    this.camMoved = false;
    this.playerDest = null;
    this._musicLoading = {};
    this.isLocked = false; this._lockedMs = 0;   // a scene that is started again must never keep the lock of the last run
    this.evolving = false; this._evoN = 0; this._evoPre = false;   // an evolution animation pauses the whole map (wild Pokémon, NPCs, the 'stuck lock' safety net)
  }

  preload() {
    BaseScene.prototype.preload.call(this);

    if (window.OverworldTiles) {
      for (const [tID, tileDef] of Object.entries(window.OverworldTiles)) {
        if (!tileDef.tileImage) continue;

        if (tileDef.tileType === "Multi-tile" || tileDef.tileType === "Multi-tile Pixel Split") {
          this.load.spritesheet(`tile_sheet_${tID}`, tileDef.tileImage, {
            frameWidth: 16, frameHeight: 16, margin: 0, spacing: 0
          });
        } else if (tileDef.isAnimated) {
          // animated single tile: frame size comes from tileDimension (default 16x16); frames run along the row
          const [fw, fh] = String(tileDef.tileDimension || '16x16').split('x').map(n => parseInt(n) || 16);
          this.load.spritesheet(`tile_anim_${tID}`, tileDef.tileImage, {
            frameWidth: fw, frameHeight: fh
          });
        } else {
          this.load.image(`tile_img_${tID}`, tileDef.tileImage);
        }
      }
    }

    if (window.OverworldMaps) {
      for (const [mKey, mapData] of Object.entries(window.OverworldMaps)) {
        // [SPEED] the music (a few MB of mp3 that must also be decoded) is no longer loaded here: the map would not appear before it was
        // downloaded. updateMapMusic() loads the track of the current map AFTER the scene is on screen, and only when a map needs it.

        if (mapData.events) {
          for (const [eKey, eventData] of Object.entries(mapData.events)) {
            if (eventData.eventType === 'NPC' && eventData.owID && OW_TABLE()) {
              const tableEntry = OW_TABLE()[eventData.owID];
              if (tableEntry && tableEntry.owSprite) {
                const textureKey = tableEntry.spriteID || `${eventData.owID.toLowerCase()}_ow`;
                const size = this.getOWFrameSize(tableEntry, eventData.owID);

                if (size) {
                  if (this.textures.exists(textureKey)) {
                    const f = this.textures.getFrame(textureKey, 0);
                    if (f.width !== size.w || f.height !== size.h) {
                      this.textures.remove(textureKey);
                    }
                  }
                  if (!this.textures.exists(textureKey)) {
                    this.load.spritesheet(textureKey, tableEntry.owSprite, {
                      frameWidth: size.w,
                      frameHeight: size.h
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    if (OW_TABLE() && !OW_TABLE()['Brendan']) console.error("[OW] The overworld table has no 'Brendan' entry, so the player sprite cannot load. Keys:", Object.keys(OW_TABLE()).slice(0, 12));
    if (OW_TABLE() && OW_TABLE()['Brendan']) {
      const bEntry = OW_TABLE()['Brendan'];
      if (!this.textures.exists('brendan_ow')) {
        const size = this.getOWFrameSize(bEntry, 'Brendan');
        if (size) {
          this.load.spritesheet('brendan_ow', bEntry.owSprite, {
            frameWidth: size.w,
            frameHeight: size.h
          });
        }
      }
    }
  }

  create() {
    this.isMoving = false;
    this.currentMap = window.OverworldMaps[this.currentMapKey];

    if (window.GameStateManager && window.GameStateManager.saveData) {
      window.GameStateManager.saveData.mapID = this.currentMapKey;
      window.SaveSystem && window.SaveSystem.touch('map');   // [SAVE] no autosave: SaveSystem.save() runs from the start menu
    }

    if (window.StartMenu) window.StartMenu.attach(this);   // [MENU] the clickable MENU button on the lower screen
    this.buildWorldOffsets();
    this.processSpriteBackgrounds();   // [NEW] remove sprite backgrounds before sprites are created
    if (window.PMAudio) window.PMAudio.leaveBattle();   // back from a battle: its music is off, the map music may play again
    this.updateMapMusic(this.currentMapKey);

    this.renderUnifiedWorld();
    // [SAVE] the first time this scene starts after the page loaded: stand where the save was made, looking the same way
    if (!this._spawnFromSave) {
      this._spawnFromSave = true;
      const sp = window.SaveSystem && window.SaveSystem.savedPos && window.SaveSystem.savedPos();
      if (sp && (!sp.map || sp.map === this.currentMapKey)) { this.playerGridX = sp.x; this.playerGridY = sp.y; if (['up', 'down', 'left', 'right'].includes(sp.dir)) this.lastDir = sp.dir; console.log('[SAVE] spawning at the saved position', sp); }
    }
    this.spawnAllEvents();
    this.spawnPlayer();
    if (window.OWFollower) window.OWFollower.attach(this);   // [FOLLOWER] the first party Pokémon walks behind the player

    this.cursors = this.input.keyboard.createCursorKeys();
    { const K = Phaser.Input.Keyboard.KeyCodes, kk = c => this.input.keyboard.addKey(c, false); this.wasd = { up: kk(K.W), left: kk(K.A), down: kk(K.S), right: kk(K.D) }; }   // W A S D walk too (no key capture, so typing still works)
    this.followKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);   // SPACE = talk to the follower Pokémon
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);   // the interact / talk key is Z (the variable keeps its old name)
    // [SUMMARY] Enter opens the party / summary screen (js/PokemonSummary.js)
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.bagKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);   // [BAG] B opens the bag (js/BagMenu.js)

    // [DUAL SCREEN] the overworld only uses the TOP screen (480x320 = the GBA screen at 2x). The bottom screen is left free.
    // Change the size in OW_TEXT.screen (overworld_textbox.js).
    const scr = (window.OW_TEXT && window.OW_TEXT.screen) || { x: 0, y: 0, w: 480, h: 320 };
    this.cameras.main.setViewport(scr.x, scr.y, scr.w, scr.h);

    // [CHANGED] lerp 1 = camera sits exactly on the player every frame (no trailing delay)
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.setRoundPixels(true);

    this.weather = new OverworldWeatherSystem(this);
    this.weather.set(this.currentMap.weather, true, this.currentMapKey);
    window.debugWeather = (name) => this.weather.set(name, false, this.currentMapKey);
    this.events.once('shutdown', () => { if (this.weather) this.weather.destroy(); });

    this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => this.updateNPCMovement(),
    });

    this.showMapBanner();                       // [BANNER]
    { const lbE = window.GameStateManager && window.GameStateManager.lastBattle; if (lbE && lbE.evolutions && lbE.evolutions.length) { this.evolving = true; this._evoPre = true; } }   // the map is already paused during the 900 ms before the evolution starts
    if (window.OWUI && window.OWUI.runEvolutions) this.time.delayedCall(900, () => window.OWUI.runEvolutions(this));   // [EVOLVE] Pokémon that reached their level in the last battle
    if (window.OWWarm) window.OWWarm.start();   // [SPEED] warm the menu / party pictures in the background

    // [NEW] safety net: if the music stopped for any reason, start it again
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => { const t = performance.now(); if (t - (this._mmChk || 0) < 900) return; this._mmChk = t; this.updateMapMusic(this.currentMapKey); },   // (after a long idle Phaser fires a loop timer once per frame to catch up: the check must not run in a burst)
    });
  }

  // [BANNER] the map-name banner (js/OverworldUI.js): once per map change, and when the game starts / a save is loaded.
  // Not shown again when the scene restarts on the same map (coming back from a battle). `banner: false` in a map hides it there.
  showMapBanner() {
    const k = this.currentMapKey, m = this.currentMap;
    if (!window.OWUI || !m || m.banner === false || window._lastBannerMap === k) return;
    window._lastBannerMap = k;
    this.time.delayedCall(350, () => { if (this.sys && this.sys.isActive() && this.currentMapKey === k) window.OWUI.banner(this, m.map || k); });
  }

  // ===========================================================================
  // MUSIC: loops forever, only changes when the new map uses a different track
  // ===========================================================================
  updateMapMusic(mapKey) {
    if (window.PMAudio ? !window.PMAudio.mapOk() : (window.BattleTransition && window.BattleTransition.busy)) return;   // a battle is starting / running: the map music must stay stopped (this method is also called by a timer and by the audio unlock)
    const mapData = window.OverworldMaps[mapKey];
    if (!mapData || !mapData.music) return;

    const path = mapData.music;
    // The map music is a plain looping <audio> element (PMAudio.playMap in Layout.js), like the battle music. play() on an element that is already playing does
    // nothing, so the 1 s safety check below can never restart the track (a Phaser sound restarts from 0 on every play(): that was the "broken record").
    if (window.PMAudio && window.PMAudio.playMap) {
      const old = window.currentGlobalMusic; if (old) { try { old.stop(); old.destroy(); } catch (e) { /* ignore */ } window.currentGlobalMusic = null; }   // no second, Phaser copy
      window.currentGlobalMusicPath = path; window.PMAudio.playMap(path); return;
    }
    const key = `map_music_${path}`;
    const cur = window.currentGlobalMusic;
    const alive = cur && cur.manager && !cur.pendingRemove;

    // Same track: leave it alone (just make sure it is still running and looping)
    if (alive && window.currentGlobalMusicPath === path) {
      if (cur.setLoop) cur.setLoop(true);
      if (cur.isPaused) cur.resume();
      else if (!cur.isPlaying && !this.sound.locked) {
        // NEVER call play() on every check: play() restarts the track from 0, so a sound that reports "not playing" every second sounds like a broken
        // record (the first second repeating). Restart only after 2 checks in a row, at most once per 10 s; if that does not help, rebuild the sound once,
        // and after that stay silent for a minute instead of looping.
        const t = performance.now(); cur._dead = (cur._dead || 0) + 1;
        if (cur._dead >= 2 && t - (cur._restartAt || 0) > 10000) {
          cur._dead = 0; cur._restartAt = t; const recent = (window._mmRestarts = (window._mmRestarts || []).filter(x => t - x < 60000)); recent.push(t);
          console.warn('[music] the map music was not playing: restart #' + recent.length + ' (context ' + (this.sound.context && this.sound.context.state) + ')');
          if (recent.length === 2) { try { cur.stop(); cur.destroy(); } catch (e) { /* ignore */ } window.currentGlobalMusic = null; window.currentGlobalMusicPath = null; return this.updateMapMusic(mapKey); }
          if (recent.length <= 3) cur.play();
        }
      } else cur._dead = 0;
      return;
    }

    // Different track: stop the old one
    if (alive) {
      cur.stop();
      cur.destroy();
    }
    window.currentGlobalMusic = null;
    window.currentGlobalMusicPath = null;

    if (!this.cache.audio.exists(key)) {
      // [SPEED] not loaded yet: fetch it in the background, then start it (the scene is already playable)
      this._musicLoading = this._musicLoading || {};
      if (!this._musicLoading[key] && this.load) {
        this._musicLoading[key] = true;
        this.load.audio(key, path);
        this.load.once('filecomplete-audio-' + key, () => { this._musicLoading[key] = false; if (this.sys && this.sys.isActive()) this.updateMapMusic(this.currentMapKey); });
        this.load.once('loaderror', () => { this._musicLoading[key] = false; });
        if (!this.load.isLoading()) this.load.start();
      }
      return;
    }

    this.sound.pauseOnBlur = false;   // keep playing when the tab loses focus
    const snd = this.sound.add(key, { loop: true, volume: 0.5 });
    snd.on('complete', () => { if (window.currentGlobalMusic === snd && snd.manager) snd.play(); });
    window.currentGlobalMusic = snd;
    window.currentGlobalMusicPath = path;
    snd.play();
  }

  // ===========================================================================
  // SPRITE BACKGROUND REMOVAL (colour of the first pixel)
  // ===========================================================================
  processSpriteBackgrounds() {
    const keys = new Set(['brendan_ow']);
    for (const entry of Object.values(OW_TABLE() || {})) {
      if (!entry || !entry.owSprite) continue;
      keys.add(entry.spriteID || null);
    }
    for (const [id, entry] of Object.entries(OW_TABLE() || {})) {
      if (entry && entry.owSprite) keys.add(entry.spriteID || `${id.toLowerCase()}_ow`);
    }
    keys.delete(null);
    for (const key of keys) {
      if (this.textures.exists(key)) this.removeSpriteBackground(key);
    }
  }

  removeSpriteBackground(key) {
    const tex = this.textures.get(key);
    if (!tex || tex.owBgDone) return;

    const f0 = tex.get(0);
    if (!f0) return;
    const fw = f0.width, fh = f0.height;
    const img = tex.getSourceImage();
    const W = img.width, H = img.height;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    let data;
    try {
      data = ctx.getImageData(0, 0, W, H);
    } catch (e) {
      console.warn(`[bg] Can't read pixels of "${key}" (browser security, run the game from a local server):`, e.message);
      tex.owBgDone = true;
      return;
    }
    const px = data.data;

    // First pixel already transparent -> nothing to do
    if (px[3] === 0) { tex.owBgDone = true; return; }

    const kr = px[0], kg = px[1], kb = px[2];
    const tol = OW_BG_TOLERANCE;
    const isBg = (i) => px[i + 3] > 0
      && Math.abs(px[i] - kr) <= tol && Math.abs(px[i + 1] - kg) <= tol && Math.abs(px[i + 2] - kb) <= tol;

    if (OW_BG_MODE === 'all') {
      for (let i = 0; i < px.length; i += 4) if (isBg(i)) px[i + 3] = 0;
    } else {
      // Flood fill inward from the border of every frame
      const cols = Math.floor(W / fw), rows = Math.floor(H / fh);
      const visited = new Uint8Array(W * H);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = c * fw, y0 = r * fh;
          const stack = [];
          const seed = (x, y) => {
            const idx = y * W + x;
            if (!visited[idx] && isBg(idx * 4)) { visited[idx] = 1; stack.push(idx); }
          };
          for (let x = 0; x < fw; x++) { seed(x0 + x, y0); seed(x0 + x, y0 + fh - 1); }
          for (let y = 0; y < fh; y++) { seed(x0, y0 + y); seed(x0 + fw - 1, y0 + y); }
          while (stack.length) {
            const idx = stack.pop();
            px[idx * 4 + 3] = 0;
            const x = idx % W, y = (idx / W) | 0;
            if (x > x0) seed(x - 1, y);
            if (x < x0 + fw - 1) seed(x + 1, y);
            if (y > y0) seed(x, y - 1);
            if (y < y0 + fh - 1) seed(x, y + 1);
          }
        }
      }
    }

    ctx.putImageData(data, 0, 0);

    // Replace the texture with the cleaned canvas and re-slice it into the same frames
    this.textures.remove(key);
    const nt = this.textures.addCanvas(key, canvas);
    const cols = Math.floor(W / fw), rows = Math.floor(H / fh);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) nt.add(i++, 0, c * fw, r * fh, fw, fh);
    }
    nt.owBgDone = true;
  }

  // ===========================================================================
  // MAP NAME / WORLD LAYOUT
  // ===========================================================================
  findMapKeyByName(nameOrKey) {
    if (!window.OverworldMaps || nameOrKey == null) return null;
    if (window.OverworldMaps[nameOrKey]) return nameOrKey;

    const normalizedTarget = String(nameOrKey).replace(/[\s_]/g, '').toLowerCase();

    for (const [key, data] of Object.entries(window.OverworldMaps)) {
      const normalizedKey = key.replace(/[\s_]/g, '').toLowerCase();
      const normalizedMapName = (data.map || '').replace(/[\s_]/g, '').toLowerCase();

      if (normalizedKey === normalizedTarget || normalizedMapName === normalizedTarget) {
        return key;
      }
    }
    return null;
  }

  resolveConn(conn) {
    return conn && conn[0] ? this.findMapKeyByName(conn[0]) : null;
  }

  // [CHANGED] Computed once. Maps that are not connected to the first map are placed on their
  // own "island" far to the right, so they no longer draw on top of the first map (needed for warps).
  buildWorldOffsets() {
    const maps = window.OverworldMaps;
    const offs = {};

    const place = (startKey, sx, sy) => {
      offs[startKey] = { x: sx, y: sy };
      const queue = [startKey];
      while (queue.length) {
        const key = queue.shift();
        const m = maps[key];
        const o = offs[key];
        for (const [dir, conn] of Object.entries(m.connections || {})) {
          const nk = this.resolveConn(conn);
          if (!nk || offs[nk]) continue;
          const n = maps[nk];
          const shift = (conn[2] || 0) * 32;
          let x, y;
          if (dir === 'up') { x = o.x + shift; y = o.y - n.dimensions.height * 32; }
          else if (dir === 'down') { x = o.x + shift; y = o.y + m.dimensions.height * 32; }
          else if (dir === 'left') { x = o.x - n.dimensions.width * 32; y = o.y + shift; }
          else if (dir === 'right') { x = o.x + m.dimensions.width * 32; y = o.y + shift; }
          else continue;
          offs[nk] = { x, y };
          queue.push(nk);
        }
      }
    };

    const keys = Object.keys(maps);
    place(keys[0], 0, 0);
    for (const k of keys) {
      if (offs[k]) continue;
      let right = 0;
      for (const [kk, o] of Object.entries(offs)) right = Math.max(right, o.x + maps[kk].dimensions.width * 32);
      place(k, right + 20 * 32, 0);
    }
    this.worldOffsets = offs;
  }

  getMapWorldOffset(targetKey) {
    if (!this.worldOffsets) this.buildWorldOffsets();
    const k = this.findMapKeyByName(targetKey);
    return (k && this.worldOffsets[k]) || { x: 0, y: 0 };
  }

  // World rectangles of the current map and every map connected to it (what can be on screen)
  getConnectedMapRects() {
    const maps = window.OverworldMaps;
    const rects = {};
    const start = maps[this.currentMapKey] ? this.currentMapKey : Object.keys(maps)[0];
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const key = queue.shift();
      const m = maps[key];
      const off = this.getMapWorldOffset(key);
      rects[key] = { x: off.x, y: off.y, w: m.dimensions.width * 32, h: m.dimensions.height * 32 };
      for (const conn of Object.values(m.connections || {})) {
        const nk = this.resolveConn(conn);
        if (nk && !seen.has(nk)) { seen.add(nk); queue.push(nk); }
      }
    }
    return rects;
  }

  renderUnifiedWorld() {
    if (this.mapGroup) {
      this.mapGroup.destroy(true);
    }
    this.mapGroup = this.add.group();
    this.animTiles = [];

    if (!window.OverworldMaps) return;

    for (const [mapKey, mapData] of Object.entries(window.OverworldMaps)) {
      const offsetPos = this.getMapWorldOffset(mapKey);
      this.renderMapGrid(mapData, offsetPos.x, offsetPos.y, mapKey);
    }
    this.renderBorders();
  }

  // Creates one tile image for (tileID, frameID) and registers it for tile animation. Returns null when it cannot be drawn.
  addTileImage(tileID, frameID, x, y, depth) {
    const tileDef = window.OverworldTiles && window.OverworldTiles[tileID];
    if (!tileDef) return null;
    let key, frame = 0, scale, multi = false;
    if (tileDef.tileType === 'Multi-tile' || tileDef.tileType === 'Multi-tile Pixel Split') {
      key = `tile_sheet_${tileID}`;
      if (!this.textures.exists(key)) return null;
      const total = Math.max(1, this.textures.get(key).frameTotal - 1);
      frame = Math.min(frameID, total - 1); scale = 2; multi = true;
    } else if (tileDef.isAnimated) {
      key = `tile_anim_${tileID}`;
      scale = 32 / (parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16);
    } else {
      key = `tile_img_${tileID}`; scale = 2;
    }
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x, y, key, frame).setScale(scale).setDepth(depth + (multi ? 2 : 0));
    this.mapGroup.add(img);
    if (tileDef.isAnimated) {
      const tex = this.textures.get(key);
      const total = Math.max(1, tex.frameTotal - 1);
      const fw = multi ? 16 : (parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16);
      const cols = Math.max(1, Math.floor(tex.getSourceImage().width / fw));
      let base, count;
      if (multi) { base = Math.floor(frame / cols) * cols; count = Math.min(cols, total - base); }
      else { base = 0; count = cols > 1 ? cols : total; }
      if (count > 1) this.animTiles.push({ img, base, count });
    }
    return img;
  }

  // BORDER: every map has an optional `borderData` block (width x height, default 2x2, with up to 5 tile layers).
  // It repeats over the empty space around the maps (up to BORDER_RANGE tiles away). It is always impassable
  // (the player cannot leave a map where there is no connection), so only the picture matters here.
  renderBorders() {
    const maps = window.OverworldMaps;
    if (!maps) return;
    const T = 32, BORDER_RANGE = OW_BORDER_RANGE;
    const info = [];
    for (const [k, m] of Object.entries(maps)) {
      const off = this.getMapWorldOffset(k);
      const b = m.borderData;
      let layers = [];
      if (b) {
        for (let l = 1; l <= 5; l++) {
          const g = b['tileData_' + l];
          if (Array.isArray(g) && g.some(r => Array.isArray(r) && r.some(v => v && String(v).trim() !== ''))) layers.push({ l, g });
        }
      }
      info.push({
        k, b, layers,
        bw: (b && (b.width || (b.tileData_1 && b.tileData_1[0] && b.tileData_1[0].length))) || 2,
        bh: (b && (b.height || (b.tileData_1 && b.tileData_1.length))) || 2,
        x0: Math.round(off.x / T), y0: Math.round(off.y / T), w: m.dimensions.width, h: m.dimensions.height
      });
    }
    // the nearest map owns a cell; cells inside any map are never border
    const ownerOf = (x, y) => {
      let best = null, bd = Infinity;
      for (const i of info) {
        const d = Math.max(i.x0 - x, x - (i.x0 + i.w - 1), i.y0 - y, y - (i.y0 + i.h - 1));
        if (d <= 0) return null;
        if (d < bd) { bd = d; best = i; }
      }
      return bd <= BORDER_RANGE ? best : null;
    };
    let drawn = 0;
    for (const me of info) {
      if (!me.layers.length) continue;
      for (let y = me.y0 - BORDER_RANGE; y < me.y0 + me.h + BORDER_RANGE; y++) {
        for (let x = me.x0 - BORDER_RANGE; x < me.x0 + me.w + BORDER_RANGE; x++) {
          if (ownerOf(x, y) !== me) continue;
          const bx = (((x - me.x0) % me.bw) + me.bw) % me.bw;
          const by = (((y - me.y0) % me.bh) + me.bh) % me.bh;
          for (const { l, g } of me.layers) {
            const cell = this.parseTileCell(g[by] && g[by][bx]);
            if (!cell) continue;
            // below every map tile (-300 and up)
            if (this.addTileImage(cell.tileID, cell.frameID, x * T + T / 2, y * T + T / 2, -400 + (l - 1) * 10)) drawn++;
          }
        }
      }
    }
    console.log(`[render] border: drew ${drawn} tiles`);
  }

  getTileGrid(mapData) {
    if (!mapData) return null;

    for (const k of ['tileData_1', 'tileData', 'blockData', 'tiles', 'data', 'mapMatrix', 'grid', 'matrix', 'layout']) {
      const v = mapData[k];
      if (Array.isArray(v) && Array.isArray(v[0])) return v;
    }

    for (const [k, v] of Object.entries(mapData)) {
      if (Array.isArray(v) && Array.isArray(v[0])) return v;
      if (Array.isArray(v) && v[0] && typeof v[0] === 'object') {
        const inner = Object.values(v[0]).find(x => Array.isArray(x) && Array.isArray(x[0]));
        if (inner) return inner;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const inner = Object.values(v).find(x => Array.isArray(x) && Array.isArray(x[0]));
        if (inner) return inner;
      }
    }
    return null;
  }

  // Up to 5 stacked tile layers: tileData_1 (bottom) ... tileData_5 (top).
  // An old single `tileData` grid counts as layer 1. Empty cells ("") are skipped.
  getTileLayers(mapData) {
    const out = [];
    for (let l = 1; l <= 5; l++) {
      const g = mapData[`tileData_${l}`];
      if (Array.isArray(g) && Array.isArray(g[0])) out.push({ layer: l, grid: g });
    }
    if (!out.length) {
      const g = this.getTileGrid(mapData);
      if (g) out.push({ layer: 1, grid: g });
    }
    return out;
  }

  parseTileCell(v) {
    if (typeof v === 'number') v = `${v}|0`;
    if (typeof v !== 'string' || v.trim() === '') return null;
    // cell format: "tileID|frameID|behavior"  behavior: 0 passable, 1 blocked, 2 passable (tile drawn above NPCs/player), 3 surfable, 4 diveable
    const [a, b, c] = v.split('|');
    const id = parseInt(a);
    if (Number.isNaN(id) || id < 0) return null;
    return { tileID: id, frameID: parseInt(b) || 0, pass: parseInt(c) || 0 };
  }

  renderMapGrid(mapData, offsetX, offsetY, label = '?') {
    const layers = this.getTileLayers(mapData);
    if (!layers.length) {
      console.warn(`[render] "${label}": no tile layers found. Keys on this map:`, Object.keys(mapData));
      return;
    }

    const tileSize = 32;
    const skipped = { noDef: new Set(), noTexture: new Set() };
    let drawn = 0;

    for (const { layer, grid } of layers) {
      for (let row = 0; row < grid.length; row++) {
        if (!Array.isArray(grid[row])) continue;
        for (let col = 0; col < grid[row].length; col++) {
          const cell = this.parseTileCell(grid[row][col]);
          if (!cell) continue;
          const { tileID, frameID, pass } = cell;

          const tileDef = window.OverworldTiles && window.OverworldTiles[tileID];
          if (!tileDef) { skipped.noDef.add(tileID); continue; }

          let key, frame = 0, scale, multi = false;
          if (tileDef.tileType === 'Multi-tile' || tileDef.tileType === 'Multi-tile Pixel Split') {
            key = `tile_sheet_${tileID}`;
            const tex = this.textures.exists(key) ? this.textures.get(key) : null;
            // trust the real sheet size, not the (possibly wrong) frames value in tiles.js
            const total = tex ? Math.max(1, tex.frameTotal - 1) : (tileDef.frames || 1);
            frame = Math.min(frameID, total - 1);
            scale = 2; multi = true;
          } else if (tileDef.isAnimated) {
            key = `tile_anim_${tileID}`;
            const fw = parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16;
            scale = 32 / fw;
          } else {
            key = `tile_img_${tileID}`;
            scale = 2;
          }

          if (!this.textures.exists(key)) { skipped.noTexture.add(key); continue; }

          // layer 1 is the lowest (-300), layer 5 the highest (-100); all stay below NPCs and the player
          // behavior 2 tiles draw above NPCs and the player (below the weather, which is at 5000)
          const depth = pass === 2 ? 4000 + layer : -300 + (layer - 1) * 50 + (multi ? 10 : 0);
          const x = Math.round(offsetX + col * tileSize + tileSize / 2);
          const y = Math.round(offsetY + row * tileSize + tileSize / 2);
          const img = this.add.image(x, y, key, frame).setScale(scale).setDepth(depth);
          this.mapGroup.add(img);
          // isAnimated: cycle through the frames of the same row of the sheet
          if (tileDef.isAnimated) {
            const tex = this.textures.get(key);
            const total = Math.max(1, tex.frameTotal - 1);
            const fw = multi ? 16 : (parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16);
            const cols = Math.max(1, Math.floor(tex.getSourceImage().width / fw));
            let base, count;
            if (multi) { base = Math.floor(frame / cols) * cols; count = Math.min(cols, total - base); }
            else { base = 0; count = cols > 1 ? cols : total; }
            if (count > 1) this.animTiles.push({ img, base, count });
          }
          drawn++;
        }
      }
    }

    console.log(`[render] "${label}": drew ${drawn} tiles on ${layers.length} layer(s)`);
    if (skipped.noDef.size) console.warn(`[render] "${label}": tile IDs missing from OverworldTiles:`, [...skipped.noDef]);
    if (skipped.noTexture.size) console.warn(`[render] "${label}": textures not loaded:`, [...skipped.noTexture]);
  }

  logCurrentTileDetails(gridX, gridY, mapKey = this.currentMapKey) {
    const targetMap = window.OverworldMaps[mapKey];
    if (!targetMap) return;
    console.group(`🔍 [Tile Inspector] "${mapKey}" at (${gridX}, ${gridY})`);
    for (const { layer, grid } of this.getTileLayers(targetMap)) {
      const c = this.parseTileCell(grid[gridY] && grid[gridY][gridX]);
      if (!c) { console.log(`• Layer ${layer}: empty`); continue; }
      const def = (window.OverworldTiles && window.OverworldTiles[c.tileID]) || {};
      console.log(`• Layer ${layer}: tile ${c.tileID} (${def.tileName || 'Unknown'}) frame ${c.frameID} · behavior: ${['passable', 'BLOCKED', 'passable (above NPC)', 'surf', 'dive', 'GRASS (wild)'][c.pass] || c.pass}`);
    }
    console.groupEnd();
  }

  findFreeSpawnTile(startX, startY) {
    const { width, height } = this.currentMap.dimensions;
    const seen = new Set();
    const queue = [[startX, startY]];

    while (queue.length) {
      const [x, y] = queue.shift();
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (this.isPassable(x, y)) return { x, y };
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return { x: startX, y: startY };
  }

  spawnPlayer() {
    const free = this.findFreeSpawnTile(this.playerGridX, this.playerGridY);
    this.playerGridX = free.x;
    this.playerGridY = free.y;

    const mapOffset = this.getMapWorldOffset(this.currentMapKey);
    const px = Math.round(mapOffset.x + this.playerGridX * 32 + 16);
    const py = Math.round(mapOffset.y + this.playerGridY * 32 + 16);

    if (!this.player) {
      this.player = this.add.sprite(px, py, 'brendan_ow', 0).setOrigin(0.5, 0.85);
      const sd0 = window.GameStateManager && window.GameStateManager.saveData;
      const dir0 = ['up', 'down', 'left', 'right'].includes(this.lastDir) ? this.lastDir : (sd0 && ['up', 'down', 'left', 'right'].includes(sd0.facing) ? sd0.facing : 'down');
      this.player.direction = dir0;   // the way the player was facing before the battle / menu / map change
      if (window.getOverworldFrame) this.player.setFrame(window.getOverworldFrame(dir0, 0));
    } else {
      this.player.setPosition(px, py);
    }
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================
  spawnAllEvents() {
    if (this.npcGroup) {
      this.npcGroup.destroy(true);
    }
    this.npcGroup = this.add.group();
    this.npcs = [];
    this.triggers = [];

    for (const [mapKey, mapData] of Object.entries(window.OverworldMaps)) {
      const offsetPos = this.getMapWorldOffset(mapKey);
      this.spawnMapEvents(mapData, mapKey, offsetPos.x, offsetPos.y);
    }
  }

  spawnMapEvents(mapData, mapKey, offsetX, offsetY) {
    if (!mapData.events) return;

    for (const [key, eventData] of Object.entries(mapData.events)) {
      // [NEW] Warp and Script events are walk-on triggers. They are NOT added to this.npcs,
      // so they never block the player (isPassable only checks this.npcs).
      if (eventData.eventType === 'Warp' || eventData.eventType === 'Script' || eventData.eventType === 'Script Tile') {
        this.triggers.push({
          type: eventData.eventType === 'Warp' ? 'Warp' : 'Script',
          key,
          mapKey,
          config: eventData,
          wx: Math.round(offsetX / 32) + (eventData.xPos || 0),
          wy: Math.round(offsetY / 32) + (eventData.yPos || 0),
        });
        continue;
      }

      if (eventData.eventType === 'NPC' && eventData.owID) {
        const tableEntry = OW_TABLE()[eventData.owID];
        if (!tableEntry) continue;
        // [SCRIPTS] hidden with the hideobject command
        if (window.OverworldScriptEngine && window.OverworldScriptEngine.isHidden(mapKey, key)) continue;

        const textureKey = tableEntry.spriteID || `${eventData.owID.toLowerCase()}_ow`;
        if (!this.textures.exists(textureKey)) continue;

        const frame0 = this.textures.getFrame(textureKey, 0);
        const isBuilding = tableEntry.owType === 'Building';

        const x = Math.round(offsetX + eventData.xPos * 32 + 16);
        const y = Math.round(offsetY + eventData.yPos * 32 + (isBuilding ? 32 : 16));

        const npcSprite = this.add.sprite(x, y, textureKey, 0)
          .setOrigin(0.5, isBuilding ? 1 : 0.85);

        npcSprite.footprint = isBuilding
          ? { w: Math.ceil(frame0.width / 32), h: Math.ceil(frame0.height / 32) }
          : { w: 1, h: 1 };

        npcSprite.direction = 'down';
        npcSprite.eventConfig = eventData;
        npcSprite.eventKey = key;   // [SCRIPTS] lets scripts say applymovement NPC_Portia
        npcSprite.mapName = mapKey;
        npcSprite.setDepth(y);

        this.npcs.push(npcSprite);
        this.npcGroup.add(npcSprite);
      }
    }
  }

  updateNPCMovement() {
    if (this.isLocked || this.scriptRunning || !this.npcs || this.npcs.length === 0) return;

    this.npcs.forEach(npc => {
      if (window.OverworldMovement && window.OverworldMovement.tick) { window.OverworldMovement.tick(npc); return; }
      const config = npc.eventConfig;
      if (!config || config.movementType !== 'MOVEMENT_TYPE_WANDER_LEFT_RIGHT') return;

      const moveTypes = ['walk_left', 'walk_right'];
      const chosenMove = Phaser.Math.RND.pick(moveTypes);

      if (window.OverworldMovement) {
        window.OverworldMovement.execute(npc, chosenMove);
      }
    });
  }

  npcOccupiesTile(npc, worldTX, worldTY) {
    const isBuilding = npc.originY === 1;
    const baseX = Math.round((npc.x - 16) / 32);
    const baseY = Math.round((npc.y - (isBuilding ? 32 : 16)) / 32);
    const fp = npc.footprint || { w: 1, h: 1 };

    const minX = baseX - Math.floor((fp.w - 1) / 2);
    const maxX = baseX + Math.floor(fp.w / 2);
    const minY = baseY - (fp.h - 1);

    if (worldTX >= minX && worldTX <= maxX && worldTY >= minY && worldTY <= baseY) return true;
    // a walking NPC also holds the tile it left and the tile it is walking onto (see movement_type.js), so the player can never share a tile with it
    if (npc.dest && npc.dest.x === worldTX && npc.dest.y === worldTY) return true;
    if (npc.src && npc.src.x === worldTX && npc.src.y === worldTY) return true;
    return false;
  }

  isPassable(gridX, gridY) {
    const cols = this.currentMap.dimensions.width;
    const rows = this.currentMap.dimensions.height;
    const connections = this.currentMap.connections || {};

    let targetMap = this.currentMap;
    let targetMapKey = this.currentMapKey;
    let localX = gridX;
    let localY = gridY;

    if (gridY < 0) {
      const k = this.resolveConn(connections.up);
      if (!k) return false;
      targetMapKey = k;
      targetMap = window.OverworldMaps[k];
      localX = gridX - (connections.up[2] || 0);
      localY = targetMap.dimensions.height - 1;
    } else if (gridY >= rows) {
      const k = this.resolveConn(connections.down);
      if (!k) return false;
      targetMapKey = k;
      targetMap = window.OverworldMaps[k];
      localX = gridX - (connections.down[2] || 0);
      localY = 0;
    } else if (gridX < 0) {
      const k = this.resolveConn(connections.left);
      if (!k) return false;
      targetMapKey = k;
      targetMap = window.OverworldMaps[k];
      localX = targetMap.dimensions.width - 1;
      localY = gridY - (connections.left[2] || 0);
    } else if (gridX >= cols) {
      const k = this.resolveConn(connections.right);
      if (!k) return false;
      targetMapKey = k;
      targetMap = window.OverworldMaps[k];
      localX = 0;
      localY = gridY - (connections.right[2] || 0);
    }

    // A tile is blocked if ANY of its layers is not passable
    const layers = this.getTileLayers(targetMap);
    if (!layers.length) return false;
    const base = layers[0].grid;
    if (localY < 0 || localY >= base.length || localX < 0 || localX >= base[0].length) return false;
    for (const { grid } of layers) {
      const c = this.parseTileCell(grid[localY] && grid[localY][localX]);
      if (!c) continue;
      if (c.pass === 1) return false;                     // blocked
      if (c.pass === 3 && !this.isSurfing) return false;  // surfable water
      if (c.pass === 4 && !this.isDiving) return false;   // diveable water
    }

    // Only NPCs/buildings block. Warp and Script triggers are not in this.npcs.
    if (this.npcs) {
      const targetOffset = this.getMapWorldOffset(targetMapKey);
      const worldTX = Math.round(targetOffset.x / 32) + localX;
      const worldTY = Math.round(targetOffset.y / 32) + localY;

      for (const npc of this.npcs) {
        if (this.npcOccupiesTile(npc, worldTX, worldTY)) {
          return false;
        }
      }
    }

    return true;
  }

  // ===========================================================================
  // MOVEMENT
  // ===========================================================================
  movePlayerTo(targetX, targetY, direction, onDone) {
    this.isMoving = true;
    const mapOffset = this.getMapWorldOffset(this.currentMapKey);

    const destX = Math.round(mapOffset.x + targetX * 32 + 16);
    const destY = Math.round(mapOffset.y + targetY * 32 + 16);

    this.walkStep = this.walkStep === 1 ? 2 : 1;
    this.player.setFrame(window.getOverworldFrame(direction, this.walkStep));
    this.playerDest = { x: Math.round((destX - 16) / 32), y: Math.round((destY - 16) / 32) };   // NPCs treat this tile as taken while the step lasts

    this.tweens.add({
      targets: this.player,
      x: destX,
      y: destY,
      duration: 150,
      onComplete: () => {
        this.playerGridX = targetX;
        this.playerGridY = targetY;
        this.player.setPosition(destX, destY);
        this.player.setFrame(window.getOverworldFrame(direction, 0));
        this.isMoving = false;
        this.playerDest = null;

        this.logCurrentTileDetails(targetX, targetY, this.currentMapKey);
        if (onDone) onDone();
        else this.handleTriggers();
      },
    });
  }

  tryInteract() {
    if (!this.npcs || this.npcs.length === 0) return;

    let targetX = Math.round((this.player.x - 16) / 32);
    let targetY = Math.round((this.player.y - 16) / 32);
    if (this.player.direction === 'up') targetY -= 1;
    else if (this.player.direction === 'down') targetY += 1;
    else if (this.player.direction === 'left') targetX -= 1;
    else if (this.player.direction === 'right') targetX += 1;

    const targetNPC = this.npcs.find(npc => this.npcOccupiesTile(npc, targetX, targetY));

    if (targetNPC && targetNPC.eventConfig) {
      const scriptName = targetNPC.eventConfig.script;
      if (!scriptName || this.scriptRunning) return;
      this.activeNPC = targetNPC;
      if (window.OverworldScriptEngine) {
        window.OverworldScriptEngine.runScript(this, scriptName);
      }
    }
  }

  // ===========================================================================
  // WALK-ON TRIGGERS (Script + Warp)
  // ===========================================================================
  handleTriggers() {
    if (this.warping || !this.triggers || !this.triggers.length) return;

    const off = this.getMapWorldOffset(this.currentMapKey);
    const wx = Math.round(off.x / 32) + this.playerGridX;
    const wy = Math.round(off.y / 32) + this.playerGridY;
    const t = this.triggers.find(tr => tr.wx === wx && tr.wy === wy);
    if (!t) return;
    if (this.scriptRunning) return;

    if (t.type === 'Warp') {
      this.runWarp(t.config);
    } else if (t.type === 'Script' && t.config.script && window.OverworldScriptEngine) {
      // [SCRIPTS] Script Tile: only runs while the variable `scriptVar` equals `varValue`
      const sv = t.config.scriptVar;
      if (sv && window.OverworldScriptEngine.getVar(sv) !== (Number(t.config.varValue) || 0)) return;
      this.activeNPC = null;
      window.OverworldScriptEngine.runScript(this, t.config.script);
    }
  }

  // ===========================================================================
  // WARPS
  // Warp event fields (in overworld_map.js):
  //   xPos, yPos   : the tile that triggers the warp (on the map the event is in)
  //   map          : target map
  //   targetWarp   : (optional) name of a Warp event in the target map, e.g. "Warp_1".
  //                  The player arrives on that warp's tile. "warpName" also works.
  //   targetX/Y    : (optional) exact arrival tile; wins over targetWarp
  //   facing       : "Up" | "Down" | "Left" | "Right" (how the player faces on arrival)
  //   warpType     : "Teleport" | "Normal" | "Hole"
  // If neither targetWarp nor targetX/Y is given, the player arrives at the first Warp in the
  // target map that points back to this map, or at the centre of the map as a last resort.
  // ===========================================================================
  runWarp(cfg) {
    if (this.warping) return;

    const targetKey = this.findMapKeyByName(cfg.map);
    if (!targetKey) {
      console.warn(`[warp] Target map "${cfg.map}" not found.`);
      return;
    }

    const dest = this.resolveWarpDestination(cfg, targetKey);
    const facing = String(cfg.facing || this.player.direction || 'down').toLowerCase();
    const dir = OW_DIRS[facing] ? facing : 'down';
    const type = String(cfg.warpType || 'Normal').toLowerCase().replace(/[\s_\-]/g, '');

    this.warping = true;
    this.isMoving = true;

    if (type === 'teleport') this.warpTeleport(targetKey, dest, dir);
    else if (type === 'hole') this.warpHole(targetKey, dest, dir);
    else this.warpNormal(targetKey, dest, dir);
  }

  resolveWarpDestination(cfg, targetKey) {
    const tm = window.OverworldMaps[targetKey];
    if (cfg.targetX != null && cfg.targetY != null) return { x: cfg.targetX, y: cfg.targetY };

    const events = tm.events || {};
    const name = cfg.targetWarp || cfg.warpName;
    let w = name ? events[name] : null;
    if (!w) {
      w = Object.values(events).find(e => e.eventType === 'Warp' && this.findMapKeyByName(e.map) === this.currentMapKey);
    }
    if (w) return { x: w.xPos || 0, y: w.yPos || 0 };

    return { x: Math.floor(tm.dimensions.width / 2), y: Math.floor(tm.dimensions.height / 2) };
  }

  // Moves the player (and the current-map state) to a tile of another map. No animation.
  placePlayerAt(mapKey, gx, gy) {
    this.currentMapKey = mapKey;
    this.currentMap = window.OverworldMaps[mapKey];
    this.playerGridX = gx;
    this.playerGridY = gy;

    if (window.GameStateManager && window.GameStateManager.saveData) {
      window.GameStateManager.saveData.mapID = mapKey;
      window.SaveSystem && window.SaveSystem.touch('map');   // [SAVE] no autosave: SaveSystem.save() runs from the start menu
    }

    this.updateMapMusic(mapKey);
    if (this.weather) this.weather.set(this.currentMap.weather, false, mapKey);
    this.showMapBanner();

    const off = this.getMapWorldOffset(mapKey);
    this.player.setPosition(Math.round(off.x + gx * 32 + 16), Math.round(off.y + gy * 32 + 16));
  }

  startSpin() {
    const order = ['down', 'left', 'up', 'right'];
    let i = 0;
    this.stopSpinTimer();
    this.spinTimer = this.time.addEvent({
      delay: 60, loop: true,
      callback: () => this.player.setFrame(window.getOverworldFrame(order[i++ % 4], 0)),
    });
  }

  stopSpinTimer() {
    if (this.spinTimer) { this.spinTimer.remove(false); this.spinTimer = null; }
  }

  faceAfterWarp(dir) {
    this.stopSpinTimer();
    this.player.direction = dir;
    this.player.setFrame(window.getOverworldFrame(dir, 0));
  }

  finishWarp() {
    this.player.setScale(1).setAlpha(1);
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.warping = false;
    this.isMoving = false;
  }

  // Teleport: player spins up and out of the exit map, then spins down into the new map
  warpTeleport(targetKey, dest, dir) {
    const cam = this.cameras.main;
    cam.stopFollow();
    this.startSpin();

    this.tweens.add({
      targets: this.player,
      y: this.player.y - 220, alpha: 0,
      duration: 700, ease: 'Quad.easeIn',
      onComplete: () => {
        this.placePlayerAt(targetKey, dest.x, dest.y);
        const landX = this.player.x, landY = this.player.y;
        cam.centerOn(landX, landY);
        this.player.setPosition(landX, landY - 220).setAlpha(0);

        this.tweens.add({
          targets: this.player,
          y: landY, alpha: 1,
          duration: 700, ease: 'Quad.easeOut',
          onComplete: () => {
            this.faceAfterWarp(dir);
            this.finishWarp();
          },
        });
      },
    });
  }

  // Normal: screen fades to black, player appears on the target tile and walks one step the way they face
  warpNormal(targetKey, dest, dir) {
    const cam = this.cameras.main;
    cam.fadeOut(250, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.placePlayerAt(targetKey, dest.x, dest.y);
      this.faceAfterWarp(dir);
      cam.centerOn(this.player.x, this.player.y);
      cam.fadeIn(250, 0, 0, 0);

      this.time.delayedCall(300, () => {
        const d = OW_DIRS[dir];
        const nx = this.playerGridX + d.dx, ny = this.playerGridY + d.dy;
        const { width, height } = this.currentMap.dimensions;
        const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
        if (inside && this.isPassable(nx, ny)) {
          this.movePlayerTo(nx, ny, dir, () => this.finishWarp());
        } else {
          this.finishWarp();
        }
      });
    });
  }

  // Hole: a hole opens under the player, who falls in; they drop in from above on the other side
  warpHole(targetKey, dest, dir) {
    const cam = this.cameras.main;
    cam.stopFollow();
    this.stopSpinTimer();

    const hole = this.add.ellipse(this.player.x, this.player.y, 4, 2, 0x000000, 0.9)
      .setDepth(this.player.y - 1);

    this.tweens.add({
      targets: hole, displayWidth: 30, displayHeight: 14,
      duration: 300, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.player,
          y: this.player.y + 14, scaleX: 0.2, scaleY: 0.2, alpha: 0,
          duration: 450, ease: 'Quad.easeIn',
          onComplete: () => {
            hole.destroy();
            this.placePlayerAt(targetKey, dest.x, dest.y);
            const landX = this.player.x, landY = this.player.y;
            cam.centerOn(landX, landY);
            this.player.setScale(1).setAlpha(1).setPosition(landX, landY - 320);
            this.player.direction = dir;
            this.player.setFrame(window.getOverworldFrame(dir, 0));

            this.tweens.add({
              targets: this.player,
              y: landY, duration: 650, ease: 'Bounce.easeOut',
              onComplete: () => {
                cam.shake(120, 0.004);
                this.faceAfterWarp(dir);
                this.finishWarp();
              },
            });
          },
        });
      },
    });
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================
  tickTileAnim(delta) {
    if (!this.animTiles || !this.animTiles.length) return;
    this.tileAnimMs = (this.tileAnimMs || 0) + delta;
    const step = Math.floor(this.tileAnimMs / 300);
    if (step === this.tileAnimStep) return;
    this.tileAnimStep = step;
    for (const t of this.animTiles) t.img.setFrame(t.base + (step % t.count));
  }

  // [GUARD] Safety net for the "I can't move after a battle" freeze. It does two things:
  //  1. a keyboard capture listener (battle / bag / summary / start menu all use one) that was left behind by a screen that is not open any more
  //     swallows every key for the whole game (the mouse still works): such listeners are removed every second
  //  2. isLocked / isMoving stuck at true for 3 s while nothing is running (no script, warp, battle transition, wild bump or menu): reset, with a warning
  inputGuard(time, delta) {
    if (!this._guardAt || time - this._guardAt > 1000) {
      this._guardAt = time;
      try {
        const bs = this.scene.get('BattleScene'); if (bs && bs.kd && !this.scene.isActive('BattleScene')) window.removeEventListener('keydown', bs.kd, true);
        for (const o of [window.BagMenu, window.PokemonSummary, window.StartMenu]) if (o && o.kd && !o.active) window.removeEventListener('keydown', o.kd, true);
      } catch (e) { /* ignore */ }
    }
    const menu = (window.PokemonSummary && window.PokemonSummary.isOpen()) || (window.BagMenu && window.BagMenu.isOpen()) || (window.StartMenu && window.StartMenu.isOpen());
    const legit = menu || this.evolving || this.scriptRunning || this.warping || (window.BattleTransition && window.BattleTransition.busy) || (window.OWWild && window.OWWild.busy);
    const stuckMoving = this.isMoving && this.player && this.tweens.getTweensOf(this.player).length === 0;
    if (!legit && (this.isLocked || stuckMoving)) {
      this._lockedMs = (this._lockedMs || 0) + delta;
      if (this._lockedMs > 3000) { console.warn('[INPUT] the overworld was locked for 3 s with nothing running (isLocked=' + this.isLocked + ', isMoving=' + this.isMoving + '): unlocking'); this.isLocked = false; this.isMoving = false; this.playerDest = null; this._lockedMs = 0; }
    } else this._lockedMs = 0;
  }

  update(time, delta) {
    this.inputGuard(time, delta);
    if (this.weather) this.weather.update(delta);
    this.tickTileAnim(delta);
    if (window.OWFollower) window.OWFollower.update(this, time, delta);   // [FOLLOWER]
    if (window.OWWild) window.OWWild.update(this, time, delta);           // [WILD] wild Pokémon on grass (behavior 5)

    // [CHANGED] depth is updated every frame (also while walking), before the early return
    if (this.player && this.player.direction) { this.lastDir = this.player.direction; const sd1 = window.GameStateManager && window.GameStateManager.saveData; if (sd1) sd1.facing = this.lastDir; }
    if (this.player && this.npcs) {
      this.player.setDepth(this.player.y);
      this.npcs.forEach(npc => npc.setDepth(npc.y));
    }

    // [SUMMARY] while the summary screen is open the overworld does nothing (the screen reads the keys itself)
    if ((window.PokemonSummary && window.PokemonSummary.isOpen()) || (window.BagMenu && window.BagMenu.isOpen()) || (window.StartMenu && window.StartMenu.isOpen())) {
      Phaser.Input.Keyboard.JustDown(this.enterKey);
      Phaser.Input.Keyboard.JustDown(this.spaceKey); if (this.followKey) Phaser.Input.Keyboard.JustDown(this.followKey);
      if (this.bagKey) Phaser.Input.Keyboard.JustDown(this.bagKey);
      return;
    }

    // [SCRIPTS] no input while a script runs (and for a moment after, so the button that closed the last message does not start it again)
    if (this.scriptRunning || (this.scriptEndedAt && this.time.now - this.scriptEndedAt < 300)) {
      Phaser.Input.Keyboard.JustDown(this.spaceKey); if (this.followKey) Phaser.Input.Keyboard.JustDown(this.followKey);
      return;
    }

    if (this.isLocked || this.isMoving) { Phaser.Input.Keyboard.JustDown(this.enterKey); if (this.bagKey) Phaser.Input.Keyboard.JustDown(this.bagKey); return; }

    // [BAG] B -> the bag (GameStateManager.saveData.bag)
    if (this.bagKey && Phaser.Input.Keyboard.JustDown(this.bagKey)) {
      this.idleMs = 0;
      if (window.BagMenu) window.BagMenu.open(this);
      else console.error('[BAG] B pressed, but js/BagMenu.js is not loaded (window.BagMenu is missing).');
      return;
    }

    // [SUMMARY] Enter -> summary screen of the party in the save (GameStateManager.saveData.party)
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.idleMs = 0;
      if (window.StartMenu) window.StartMenu.toggle(this);   // [MENU] Start / Enter -> the start menu (Pokémon, Pokédex, Bag ...)
      else if (window.PokemonSummary) window.PokemonSummary.open(this);
      else console.error('[MENU] Enter pressed, but js/StartMenu.js is not loaded (window.StartMenu is missing).');
      return;
    }

    if (this.followKey && Phaser.Input.Keyboard.JustDown(this.followKey)) {   // [FOLLOWER] SPACE next to it = talk to it
      this.idleMs = 0;
      if (window.OWFollower && window.OWFollower.interact) window.OWFollower.interact(this);
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.idleMs = 0;
      this.tryInteract();
      return;
    }

    let dx = 0;
    let dy = 0;
    let newDir = this.player.direction;

    if (this.cursors.left.isDown || (this.wasd && this.wasd.left.isDown)) {
      dx = -1;
      newDir = 'left';
    } else if (this.cursors.right.isDown || (this.wasd && this.wasd.right.isDown)) {
      dx = 1;
      newDir = 'right';
    } else if (this.cursors.up.isDown || (this.wasd && this.wasd.up.isDown)) {
      dy = -1;
      newDir = 'up';
    } else if (this.cursors.down.isDown || (this.wasd && this.wasd.down.isDown)) {
      dy = 1;
      newDir = 'down';
    }

    this.player.direction = newDir;

    if (dx !== 0 || dy !== 0) {
      this.idleMs = 0;
      const targetGridX = this.playerGridX + dx;
      const targetGridY = this.playerGridY + dy;

      if (this.isPassable(targetGridX, targetGridY)) {
        const transitionMap = this.checkMapBoundaryTransition(targetGridX, targetGridY);
        if (transitionMap) {
          this.executeSeamlessTransition(transitionMap, newDir);
          return;
        }

        this.movePlayerTo(targetGridX, targetGridY, newDir);
      } else {
        const stepCycle = Math.floor(time / 150) % 2 === 0 ? 1 : 2;
        const frameIndex = window.getOverworldFrame(newDir, stepCycle);
        this.player.setFrame(frameIndex);
      }
    } else {
      // idle: after 4 s without input the player walks in place
      this.idleMs = (this.idleMs || 0) + delta;
      if (this.idleMs > 4000) {
        const seq = [1, 0, 2, 0];
        this.player.setFrame(window.getOverworldFrame(newDir, seq[Math.floor(time / 180) % 4]));
      } else {
        this.player.setFrame(window.getOverworldFrame(newDir, 0));
      }
    }
  }

  checkMapBoundaryTransition(gridX, gridY) {
    const cols = this.currentMap.dimensions.width;
    const rows = this.currentMap.dimensions.height;
    const c = this.currentMap.connections;

    if (!c) return null;

    if (gridY < 0) {
      const k = this.resolveConn(c.up);
      if (k) return { mapKey: k, entryX: gridX - (c.up[2] || 0), entryY: window.OverworldMaps[k].dimensions.height - 1 };
    }
    if (gridY >= rows) {
      const k = this.resolveConn(c.down);
      if (k) return { mapKey: k, entryX: gridX - (c.down[2] || 0), entryY: 0 };
    }
    if (gridX < 0) {
      const k = this.resolveConn(c.left);
      if (k) return { mapKey: k, entryX: window.OverworldMaps[k].dimensions.width - 1, entryY: gridY - (c.left[2] || 0) };
    }
    if (gridX >= cols) {
      const k = this.resolveConn(c.right);
      if (k) return { mapKey: k, entryX: 0, entryY: gridY - (c.right[2] || 0) };
    }

    return null;
  }

  getOWFrameSize(tableEntry, id = '?') {
    const raw = tableEntry && tableEntry.trueDimension;
    const m = /^\s*(\d+)\s*[xX]\s*(\d+)\s*$/.exec(raw || '');
    if (!m) {
      console.error(`[OW] "${id}" has no valid trueDimension (got "${raw}"), so its sprite can't be sliced.`);
      return null;
    }
    return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
  }

  executeSeamlessTransition(transitionData, direction) {
    this.isMoving = true;
    this.currentMapKey = transitionData.mapKey;
    this.currentMap = window.OverworldMaps[this.currentMapKey];
    this.playerGridX = transitionData.entryX;
    this.playerGridY = transitionData.entryY;

    if (window.GameStateManager && window.GameStateManager.saveData) {
      window.GameStateManager.saveData.mapID = this.currentMapKey;
      window.SaveSystem && window.SaveSystem.touch('map');   // [SAVE] no autosave: SaveSystem.save() runs from the start menu
    }

    this.updateMapMusic(this.currentMapKey);
    this.showMapBanner();

    // Entering a map with different weather fades the old one out and the new one in
    if (this.weather) this.weather.set(this.currentMap.weather, false, this.currentMapKey);

    const mapOffset = this.getMapWorldOffset(this.currentMapKey);
    const destX = Math.round(mapOffset.x + this.playerGridX * 32 + 16);
    const destY = Math.round(mapOffset.y + this.playerGridY * 32 + 16);

    this.walkStep = this.walkStep === 1 ? 2 : 1;
    this.player.setFrame(window.getOverworldFrame(direction, this.walkStep));
    this.playerDest = { x: Math.round((destX - 16) / 32), y: Math.round((destY - 16) / 32) };   // NPCs treat this tile as taken while the step lasts

    this.tweens.add({
      targets: this.player,
      x: destX,
      y: destY,
      duration: 150,
      onComplete: () => {
        this.player.setFrame(window.getOverworldFrame(direction, 0));
        this.isMoving = false;
        this.playerDest = null;
        this.handleTriggers();
      }
    });
  }
}
