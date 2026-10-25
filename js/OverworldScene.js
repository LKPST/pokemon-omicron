// ===========================================================================
// TILE BEHAVIORS  (the third number of a map cell "tile|frame|behavior")
//   0 passable · 1 blocked · 2 passable, tile drawn above NPCs · 3 surf · 4 dive · 5 grass (wild)
//   6-9   passable, but a wall on the N / E / W / S edge of the tile
//   10-13 the same with the tile drawn above NPCs ("NPC below")
//   14    blocked, tile drawn above NPCs
//   15-18 spin tile: pushes the player left / up / right / down until something stops them
//   19-22 spin tile, drawn above NPCs
// ===========================================================================
window.OW_BEH = window.OW_BEH || {
  solid: new Set([1, 14]),
  above: new Set([2, 10, 11, 12, 13, 14, 19, 20, 21, 22]),
  wall: { 6: 'n', 7: 'e', 8: 'w', 9: 's', 10: 'n', 11: 'e', 12: 'w', 13: 's' },
  spin: { 15: 'left', 16: 'up', 17: 'right', 18: 'down', 19: 'left', 20: 'up', 21: 'right', 22: 'down' },
  names: ['passable', 'BLOCKED', 'passable (above NPC)', 'surf', 'dive', 'GRASS (wild)',
    'passable, N wall', 'passable, E wall', 'passable, W wall', 'passable, S wall',
    'N wall (above NPC)', 'E wall (above NPC)', 'W wall (above NPC)', 'S wall (above NPC)', 'BLOCKED (above NPC)',
    'SPIN left', 'SPIN up', 'SPIN right', 'SPIN down', 'SPIN left (above NPC)', 'SPIN up (above NPC)', 'SPIN right (above NPC)', 'SPIN down (above NPC)'],
};

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

    // [START] where a NEW game begins: window.OverworldStart (set in the map editor, saved at the end of Overworld_map.js)
    const maps = window.OverworldMaps || {}, sd = window.GameStateManager && window.GameStateManager.saveData;
    const st = Object.assign({ map: 'Criscanto Town - Player Room', x: 2, y: 8, facing: 'down' }, window.OverworldStart || {});
    this.startCfg = st;
    if (sd && sd.mapID && maps[sd.mapID]) this.currentMapKey = sd.mapID;
    else { this._useStart = true; this.currentMapKey = maps[st.map] ? st.map : Object.keys(maps)[0]; }
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
            frameWidth: Number(tileDef.tileCell) || 16, frameHeight: Number(tileDef.tileCell) || 16, margin: 0, spacing: 0   // tileCell: 16 (default) or 32 = detailed tiles drawn at the size they show on screen
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

    // [PLAYER] the player's overworld sprite: male_player_ow by default (female_player_ow for a female player when it exists), Brendan as the fallback
    { const pc = this.playerOWCandidates(); for (const c of pc) { if (c.key === 'brendan_ow' || this.textures.exists(c.key)) continue; const sz = this.getOWFrameSize(c.entry, c.name); if (sz) this.load.spritesheet(c.key, c.entry.owSprite, { frameWidth: sz.w, frameHeight: sz.h }); } }
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
      if (!sp && this._useStart && this.currentMapKey === this.startCfg.map) {   // [START] a new game
        this.playerGridX = Number(this.startCfg.x) || 0; this.playerGridY = Number(this.startCfg.y) || 0;
        if (['up', 'down', 'left', 'right'].includes(this.startCfg.facing)) this.lastDir = this.startCfg.facing;
      } else if (sp && (!sp.map || sp.map === this.currentMapKey)) { this.playerGridX = sp.x; this.playerGridY = sp.y; if (['up', 'down', 'left', 'right'].includes(sp.dir)) this.lastDir = sp.dir; console.log('[SAVE] spawning at the saved position', sp); }
    }
    this.runBeforeLoadScripts(this.currentMapKey, true);   // [LEVEL SCRIPTS] before the map is built
    this.spawnAllEvents();
    this.spawnPlayer();
    if (window.__owLevelMap !== this.currentMapKey) this.runLevelScripts();   // [LEVEL SCRIPTS] game start / loaded save (not when coming back from a battle)
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
    { const lbE = window.GameStateManager && window.GameStateManager.lastBattle; if (lbE && lbE.evolutions && lbE.evolutions.length && window.OWUI && window.OWUI.runEvolutions) { this.evolving = true; this._evoPre = true; this.time.delayedCall(8000, () => { if (this._evoPre) { this._evoPre = false; if (!(this._evoN > 0)) this.evolving = false; } }); } }   // (the 8 s fail-safe: the map can never stay paused if the evolution never starts)   // the map is already paused during the 900 ms before the evolution starts
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
    const keys = new Set(['brendan_ow', 'male_player_ow', 'female_player_ow']);
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

  // Character looks (script command spritefx, or the NPC fields spriteFx / fxColor): holo, ghost, glitch, off
  applySpriteFx(spr, style, color) {
    if (!spr || !spr.scene) return;
    const old = spr._fx;
    if (old) { try { old.t.remove(false); } catch (_) { } spr.clearTint(); spr.setAlpha(old.a0); spr.setBlendMode(old.bm); spr.scaleX = old.sx; spr._fx = null; }
    style = String(style || '').toLowerCase(); if (!style || style === 'off' || style === 'none') return;
    const def = { holo: { col: 0x66ffff, a: 0.78, add: true }, ghost: { col: 0xd0d8ff, a: 0.5, add: false }, glitch: { col: 0x66ffff, a: 0.9, add: true } }[style];
    if (!def) { console.warn('[spritefx] unknown look "' + style + '" (holo, ghost, glitch, off)'); return; }
    const names = { cyan: 0x66ffff, blue: 0x66aaff, green: 0x66ff99, pink: 0xff88dd, purple: 0xbb99ff, red: 0xff6666, orange: 0xffaa55, yellow: 0xffee66, white: 0xffffff };
    let col = def.col, cs = String(color || '').trim().toLowerCase();
    if (names[cs] !== undefined) col = names[cs]; else if (/^(#|0x)[0-9a-f]{6}$/.test(cs)) col = parseInt(cs.replace('#', '').replace('0x', ''), 16);
    const fx = { a0: spr.alpha, bm: spr.blendMode, sx: spr.scaleX, g: 0 };
    spr.setTint(col); spr.setAlpha(def.a); if (def.add) spr.setBlendMode(Phaser.BlendModes.ADD);   // additive: dark pixels fade away, bright ones glow
    let n = 0;
    fx.t = this.time.addEvent({ delay: 90, loop: true, callback: () => {
      if (!spr.scene) { fx.t.remove(false); return; }
      n++; const r = Math.random();
      if (style === 'ghost') { spr.setAlpha(0.42 + 0.14 * Math.sin(n * 0.35)); return; }
      spr.setAlpha(def.a * (0.65 + 0.35 * Math.abs(Math.sin(n * 0.5))) * (r < 0.08 ? 0.5 : 1));   // flicker
      if (fx.g > 0) { fx.g--; if (fx.g === 0) { spr.setTint(col); spr.scaleX = fx.sx; } }
      else if (r < (style === 'glitch' ? 0.35 : 0.06)) { fx.g = 1 + (n % 2); spr.setTint(0xff66ff); spr.scaleX = fx.sx * 1.12; }   // glitch frame: wider and pink for a moment
    } });
    spr._fx = fx; spr.once('destroy', () => { try { fx.t.remove(false); } catch (_) { } });
  }

  // Animated multi-tile object (a fountain, a flag ...): tile fields animFrames (how many animation frames) and animColumns (tiles per frame across; default = sheet columns / animFrames).
  // The frames sit on the sheet as a grid (side by side, then below). You paint the tiles of the FIRST frame; every animation frame uses the same cell of its own block.
  multiAnimList(tileDef, tex, frame, C) {
    const N = Math.floor(Number(tileDef.animFrames) || 0), total = Math.max(1, tex.frameTotal - 1); if (N < 2) return null;
    const R = Math.ceil(total / C), fc = Math.floor(Number(tileDef.animColumns) || 0) || Math.floor(C / N); if (fc < 1) return null;
    const perRow = Math.max(1, Math.floor(C / fc)), gridRows = Math.ceil(N / perRow), fr = Math.max(1, Math.floor(R / gridRows));
    const rr = Math.floor(frame / C) % fr, cc = (frame % C) % fc, list = [];
    for (let k = 0; k < N; k++) { const idx = (Math.floor(k / perRow) * fr + rr) * C + (k % perRow) * fc + cc; if (idx < total) list.push(idx); }
    return list.length > 1 ? list : null;
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
      frame = Math.min(frameID, total - 1); scale = 32 / (Number(tileDef.tileCell) || 16); multi = true;
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
      const fw = multi ? (Number(tileDef.tileCell) || 16) : (parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16);
      const cols = Math.max(1, Math.floor(tex.getSourceImage().width / fw));
      let base, count, list = null;
      if (multi && tileDef.animFrames > 1) { list = this.multiAnimList(tileDef, tex, frame, cols); count = list ? list.length : 0; if (list && list.length) img.setFrame(list[0]); }   // animFrames / animColumns: the animation frames are laid out as a grid on the sheet
      else if (multi) { base = Math.floor(frame / cols) * cols; count = Math.min(cols, total - base); }
      else { base = 0; count = cols > 1 ? cols : total; }
      if (count > 1) this.animTiles.push({ img, base, count, list });
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
            scale = 32 / (Number(tileDef.tileCell) || 16); multi = true;
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
          const depth = window.OW_BEH.above.has(pass) ? 4000 + layer : -300 + (layer - 1) * 50 + (multi ? 10 : 0);
          const x = Math.round(offsetX + col * tileSize + tileSize / 2);
          const y = Math.round(offsetY + row * tileSize + tileSize / 2);
          const img = this.add.image(x, y, key, frame).setScale(scale).setDepth(depth);
          this.mapGroup.add(img);
          // isAnimated: cycle through the frames of the same row of the sheet
          if (tileDef.isAnimated) {
            const tex = this.textures.get(key);
            const total = Math.max(1, tex.frameTotal - 1);
            const fw = multi ? (Number(tileDef.tileCell) || 16) : (parseInt(String(tileDef.tileDimension || '16x16').split('x')[0]) || 16);
            const cols = Math.max(1, Math.floor(tex.getSourceImage().width / fw));
            let base, count, list = null;
            if (multi && tileDef.animFrames > 1) { list = this.multiAnimList(tileDef, tex, frame, cols); count = list ? list.length : 0; if (list && list.length) img.setFrame(list[0]); }   // animFrames / animColumns: the animation frames are laid out as a grid on the sheet
            else if (multi) { base = Math.floor(frame / cols) * cols; count = Math.min(cols, total - base); }
            else { base = 0; count = cols > 1 ? cols : total; }
            if (count > 1) this.animTiles.push({ img, base, count, list });
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
      console.log(`• Layer ${layer}: tile ${c.tileID} (${def.tileName || 'Unknown'}) frame ${c.frameID} · behavior: ${window.OW_BEH.names[c.pass] || c.pass}`);
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
      this.player = this.add.sprite(px, py, this.playerTextureKey(), 0).setOrigin(0.5, 0.85).setScale(this.playerScale());
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
    this.signposts = [];
    (this.npcFollowers || []).forEach(f => { try { f.destroy(); } catch (_) { } }); this.npcFollowers = [];
    this._npcGen = (this._npcGen || 0) + 1;   // Pokémon NPCs load their sprite later: they check this to see they still belong

    for (const [mapKey, mapData] of Object.entries(window.OverworldMaps)) {
      const offsetPos = this.getMapWorldOffset(mapKey);
      this.spawnMapEvents(mapData, mapKey, offsetPos.x, offsetPos.y);
    }
    this.respawnRuntimeNPCs();   // [SPAWNNPC]
  }

  spawnMapEvents(mapData, mapKey, offsetX, offsetY) {
    if (!mapData.events) return;

    const _sd = window.GameStateManager && window.GameStateManager.saveData, _ov = (_sd && _sd.owOverrides) || {};
    for (const [key, eventData0] of Object.entries(mapData.events)) {
      const eventData = _ov[mapKey + ':' + key] ? Object.assign({}, eventData0, { owID: _ov[mapKey + ':' + key] }) : eventData0;   // [CHANGEOWID] a sprite changed by script (changeowid)
      // [NEW] Warp and Script events are walk-on triggers. They are NOT added to this.npcs,
      // so they never block the player (isPassable only checks this.npcs).
      // [SIGNPOST] a Signpost runs its script when the player presses the talk key while facing its tile (see tryInteract)
      if (eventData.eventType === 'Signpost') {
        (this.signposts = this.signposts || []).push({ key, mapKey, config: eventData, wx: Math.round(offsetX / 32) + (eventData.xPos || 0), wy: Math.round(offsetY / 32) + (eventData.yPos || 0) });
        continue;
      }
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
        // [POKEMON NPC] owID SPECIES_XXX = a Pokémon overworld sprite (tables/OverworldSprites.js) used as a normal NPC
        if (/^SPECIES_/.test(eventData.owID) && !OW_TABLE()[eventData.owID]) { this.spawnMonNPC(eventData, key, mapKey, offsetX, offsetY); continue; }
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
        if (!isBuilding && Number(tableEntry.owScale) > 0 && Number(tableEntry.owScale) !== 1) npcSprite.setScale(Number(tableEntry.owScale));   // [SCALE] per-sprite display scale from the table

        npcSprite.footprint = isBuilding
          ? { w: Math.ceil(frame0.width / 32), h: Math.ceil(frame0.height / 32) }
          : { w: 1, h: 1 };

        // [FACING] a NPC whose movementType says FACE_RIGHT / WALK_IN_PLACE_LEFT ... (or has facing:) starts out looking that way
        { const fm = /(?:FACE|WALK_IN_PLACE|LOOK)_(UP|DOWN|LEFT|RIGHT)$/i.exec(String(eventData.movementType || ''));
          const fd = fm ? fm[1].toLowerCase() : String(eventData.facing || '').toLowerCase();
          npcSprite.direction = ['up', 'down', 'left', 'right'].includes(fd) ? fd : 'down';
          if (!isBuilding && npcSprite.direction !== 'down' && window.getOverworldFrame && frame0 && this.textures.getFrame(textureKey, window.getOverworldFrame(npcSprite.direction, 0)) ) npcSprite.setFrame(window.getOverworldFrame(npcSprite.direction, 0)); }
        npcSprite.eventConfig = eventData;
        npcSprite.eventKey = key;   // [SCRIPTS] lets scripts say applymovement NPC_Portia
        npcSprite.mapName = mapKey;
        npcSprite._owAttr = this.owAttrOf(eventData.owTileAttribute || tableEntry.owTileAttribute);
        npcSprite.setDepth(this.npcDepth(npcSprite));
        { const rf = (window.OWSpriteFx || {})[mapKey + ':' + key], st = rf ? rf.style : eventData.spriteFx; if (st) this.applySpriteFx(npcSprite, st, rf ? rf.color : eventData.fxColor); }   // [FX] holo / ghost / glitch

        this.npcs.push(npcSprite);
        this.npcGroup.add(npcSprite);
        if (eventData.followMon) this.spawnNpcFollower(npcSprite);   // [NPC POKÉMON]
      }
    }
  }


  // ---- [SPAWNNPC] NPCs made while the game runs by the script command spawnnpc.
  // permanent ones are stored in the save (saveData.spawnedNPCs) and come back every time; the others live until this scene is rebuilt (battle, loading a save).
  runtimeNpcList() { const sd = window.GameStateManager && window.GameStateManager.saveData; return [...((sd && sd.spawnedNPCs) || []), ...(this._tempSpawns || [])]; }
  respawnRuntimeNPCs() {
    for (const r of this.runtimeNpcList()) {
      if (!r || !r.ev || !(window.OverworldMaps || {})[r.map]) continue;
      const off = this.getMapWorldOffset(r.map); this.spawnMapEvents({ events: { [r.key]: r.ev } }, r.map, off.x, off.y);
    }
  }
  // cfg: { owID, effect, filter, color, permanent, movementType, key, x, y, script }  (x, y = tile on the current map). Returns the new NPC's key, or null.
  spawnRuntimeNPC(cfg) {
    const E = window.OverworldScriptEngine, map = this.currentMapKey, maps = window.OverworldMaps || {};
    const isRnd = this.isRandomOw(cfg.owID);
    const id = isRnd ? (this.pickRandomOw(cfg.owID) || '') : String(cfg.owID || '').trim();
    if (!id || (!OW_TABLE()[id] && !/^SPECIES_/.test(id))) { console.warn('[spawnnpc] "' + id + '" is not in tables/ow_table.js (or a SPECIES_ id)'); return null; }
    this._spawnN = (this._spawnN || 0) + 1;
    const key = String(cfg.key || '').trim() || ('NPC_Spawn' + this._spawnN);
    if (maps[map] && maps[map].events && maps[map].events[key]) { console.warn('[spawnnpc] "' + key + '" is already an event of this map: pick another name'); return null; }
    const old = (this.npcs || []).find(n => n.eventKey === key && n.mapName === map);
    if (old) { this.npcs.splice(this.npcs.indexOf(old), 1); try { old.destroy(); } catch (_) { } }
    let mt = String(cfg.movementType || '').trim().toUpperCase(); if (mt && !/^MOVEMENT_TYPE_/.test(mt)) mt = 'MOVEMENT_TYPE_' + mt;
    const ev = { eventType: 'NPC', owID: id, xPos: Math.round(+cfg.x || 0), yPos: Math.round(+cfg.y || 0) };
    if (mt) ev.movementType = mt; if (cfg.script) ev.script = cfg.script; if (cfg.filter) { ev.spriteFx = cfg.filter; if (cfg.color) ev.fxColor = cfg.color; }
    const sd = window.GameStateManager && window.GameStateManager.saveData, rec = { map, key, ev };
    const drop = l => { const i = l.findIndex(r => r.map === map && r.key === key); if (i >= 0) l.splice(i, 1); };
    this._tempSpawns = this._tempSpawns || []; drop(this._tempSpawns); if (sd) { sd.spawnedNPCs = sd.spawnedNPCs || []; drop(sd.spawnedNPCs); }
    if (cfg.permanent && sd) sd.spawnedNPCs.push(rec); else this._tempSpawns.push(rec);
    if (E && E.getFlag(`HIDDEN:${map}:${key}`)) E.setFlag(`HIDDEN:${map}:${key}`, false);
    if (E) E.save();
    const off = this.getMapWorldOffset(map);
    this.spawnMapEvents({ events: { [key]: ev } }, map, off.x, off.y);
    let tries = 0; const fx = () => { const spr = (this.npcs || []).find(n => n.eventKey === key && n.mapName === map); if (spr) return this.spawnEffect(spr, cfg.effect); if (++tries < 25) this.time.delayedCall(80, fx); };   // Pokémon NPCs load their sprite a moment later
    fx();
    if (isRnd && String(cfg.randomMode || '').toLowerCase() === 'changing') {
      let t2 = 0; const go = () => { const spr = (this.npcs || []).find(n => n.eventKey === key && n.mapName === map); if (spr) this.startOwRandom(spr, cfg.owID, cfg.changeEvery); else if (++t2 < 25) this.time.delayedCall(80, go); }; go();
    }
    return key;
  }
  // ---- [CHANGEOWID] random sprite ids and changing the sprite of an NPC that already exists
  isRandomOw(spec) { return /^random_?(pokemon|npc)$/i.test(String(spec || '').trim()); }
  pickRandomOw(spec, not) {
    const poke = /pokemon/i.test(String(spec)); let list = [];
    if (poke) { const sp = window.OverworldSprites && window.OverworldSprites.species; list = sp ? Object.keys(sp) : Object.entries(OW_TABLE()).filter(([, v]) => v && v.owType === 'Pokemon').map(([k]) => k); }
    else list = Object.entries(OW_TABLE()).filter(([k, v]) => v && v.owType === 'NPC' && this.textures.exists(v.spriteID || `${k.toLowerCase()}_ow`)).map(([k]) => k);
    if (not && list.length > 1) list = list.filter(k => k !== not);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  // randomMode 'changing' = a new random sprite every `every` ms (min 250) until changeowid is used on it again; otherwise one random pick that stays
  startOwRandom(spr, spec, every) {
    this.stopOwRandom(spr); const k = spr.mapName + ':' + spr.eventKey, ms = Math.max(250, +every || 1000);
    this._owRnd = this._owRnd || {};
    this._owRnd[k] = this.time.addEvent({ delay: ms, loop: true, callback: () => {
      const cur = (this.npcs || []).find(n => n.eventKey === spr.eventKey && n.mapName === spr.mapName);
      if (!cur || !cur.scene) { this.stopOwRandom(spr); return; }
      const id = this.pickRandomOw(spec, cur.eventConfig && cur.eventConfig.owID); if (id) this.changeNpcOwID(cur, id, true);
    } });
  }
  stopOwRandom(spr) { const k = spr.mapName + ':' + spr.eventKey, t = this._owRnd && this._owRnd[k]; if (t) { try { t.remove(false); } catch (_) { } delete this._owRnd[k]; } }
  // the entry point of the script command changeowid: spec = a real id, randomPokemon or randomNPC
  setNpcOwID(spr, spec, mode, every) {
    if (!spr || !spr.scene) return false;
    this.stopOwRandom(spr);
    if (this.isRandomOw(spec)) {
      const id = this.pickRandomOw(spec); if (!id) { console.warn('[changeowid] nothing to pick for ' + spec); return false; }
      if (!this.changeNpcOwID(spr, id, String(mode || '').toLowerCase() === 'changing')) return false;
      if (String(mode || '').toLowerCase() === 'changing') this.startOwRandom(spr, spec, every);
      return true;
    }
    return this.changeNpcOwID(spr, String(spec || '').trim(), false);
  }
  // swap the picture (and nothing else) of an NPC. temp = a passing change (no save). Table NPC -> table NPC changes the texture in place; anything else (a Pokémon, a building) rebuilds the NPC on its current tile.
  changeNpcOwID(spr, id, temp) {
    const table = OW_TABLE(), te = table[id], old = spr.eventConfig || {}, oldTe = table[old.owID];
    if (!te && !(/^SPECIES_/.test(id) && window.OWSprites && window.OWSprites.hasSprite(id))) { console.warn('[changeowid] "' + id + '" is not in tables/ow_table.js (or a SPECIES_ id with a sprite)'); return false; }
    const map = spr.mapName, key = spr.eventKey, sd = window.GameStateManager && window.GameStateManager.saveData, E = window.OverworldScriptEngine;
    if (!temp) {   // remember it: a spawned NPC keeps it in its own record, a map NPC in the save
      const rec = this.runtimeNpcList().find(r => r.map === map && r.key === key);
      if (rec) rec.ev.owID = id; else if (sd) { sd.owOverrides = sd.owOverrides || {}; sd.owOverrides[map + ':' + key] = id; }
      if (E) E.save();
    }
    const tex = te && (te.spriteID || `${id.toLowerCase()}_ow`);
    if (te && oldTe && te.owType !== 'Building' && oldTe.owType !== 'Building' && !spr.owSpecies && this.textures.exists(tex)) {
      const f = window.getOverworldFrame ? window.getOverworldFrame(spr.direction || 'down', 0) : 0;
      spr.setTexture(tex, this.textures.getFrame(tex, f) ? f : 0);
      const sc = Number(te.owScale) > 0 ? Number(te.owScale) : 1; spr.setScale(sc);
      spr.eventConfig = Object.assign({}, old, { owID: id }); return true;
    }
    // rebuild on the tile it stands on now
    const off = this.getMapWorldOffset(map), bld = oldTe && oldTe.owType === 'Building';
    const tx = Math.round((spr.x - 16 - off.x) / 32), ty = Math.round((spr.y - (bld ? 32 : 16) - off.y) / 32);
    const ev2 = Object.assign({}, spr.eventConfig, { owID: id, xPos: tx, yPos: ty, facing: spr.direction || 'down' });
    const wasActive = this.activeNPC === spr, hadTimer = this._owRnd && this._owRnd[map + ':' + key];
    this.npcs.splice(this.npcs.indexOf(spr), 1); try { spr.destroy(); } catch (_) { }
    this.spawnMapEvents({ events: { [key]: ev2 } }, map, off.x, off.y);
    if (wasActive) { let n = 0; const fix = () => { const s2 = this.npcs.find(x => x.eventKey === key && x.mapName === map); if (s2) this.activeNPC = s2; else if (++n < 25) this.time.delayedCall(80, fix); }; fix(); }
    return true;
  }
  // appearing effects: fade, poof (smoke puff), sparkle, holo (cyan light beam + flicker) and teleport (white beam)
  spawnEffect(spr, effect) {
    const f = String(effect || '').toLowerCase().trim(); if (!f || f === 'none' || f === 'off' || !spr || !spr.scene) return;
    const a = spr.alpha, sx = spr.scaleX, sy = spr.scaleY, x = spr.x, y = spr.y, d = spr.depth + 1, T = o => { o.setDepth(d); return o; };
    if (f === 'fade') { spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: a, duration: 600 }); return; }
    if (f === 'poof') {
      spr.setAlpha(0); spr.setScale(sx * 0.6, sy * 0.6);
      this.tweens.add({ targets: spr, alpha: a, scaleX: sx, scaleY: sy, duration: 260, delay: 140, ease: 'Back.Out' });
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2, c = T(this.add.circle(x, y - 12, 5 + Math.random() * 3, 0xffffff, 0.85)); this.tweens.add({ targets: c, x: x + Math.cos(an) * 24, y: y - 12 + Math.sin(an) * 15, alpha: 0, scale: 2, duration: 460, onComplete: () => c.destroy() }); }
      return;
    }
    if (f === 'sparkle') {
      spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: a, duration: 450, delay: 150 });
      for (let i = 0; i < 9; i++) { const r = T(this.add.rectangle(x + (Math.random() - .5) * 28, y - 4 - Math.random() * 20, 3, 3, i % 2 ? 0xfff6a8 : 0xffffff)); this.tweens.add({ targets: r, y: r.y - 26, alpha: 0, duration: 650, delay: i * 40, onComplete: () => r.destroy() }); }
      return;
    }
    if (f === 'holo' || f === 'teleport') {
      const col = f === 'holo' ? 0x77ffff : 0xffffff; spr.setAlpha(0);
      const b = T(this.add.rectangle(x, y - 30, 26, 100, col, 0.6)); b.setScale(1, 0.05); b.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: b, scaleY: 1, duration: 160, onComplete: () => {
        let n = 0; const seq = f === 'holo' ? [0.2, 0.9, 0.3, 1, 0.5, 1] : [1];
        const tick = () => { if (!spr.scene) return; spr.setAlpha(a * seq[n]); if (++n < seq.length) this.time.delayedCall(60, tick); };
        tick(); this.tweens.add({ targets: b, scaleX: 0.1, alpha: 0, duration: 380, delay: 120, onComplete: () => b.destroy() });
      } });
      return;
    }
    console.warn('[spawnnpc] unknown effect "' + effect + '" (none, fade, poof, sparkle, holo, teleport)');
  }

  // owTileAttribute of an NPC (ow_table.js field, or on the event): 'None' = follows the tile behavior (normal depth),
  // 'On Top' = always above everything (tiles, NPCs, the player), 'Under' = just above layer 1, below layers 2-5, the NPCs and the player.
  owAttrOf(v) { const s = String(v || '').toLowerCase().replace(/[^a-z]/g, ''); return (s === 'ontop' || s === 'top') ? 'top' : (s === 'under' || s === 'below') ? 'under' : ''; }
  npcDepth(n) { const a = n._owAttr; return a === 'top' ? 4100 + n.y / 1000 : a === 'under' ? -275 + n.y / 100000 : n.y; }   // tiles: layer 1 = -300 ... layer 5 = -100, 'above' tiles 4000+, weather 5000

  // A Pokémon (owID SPECIES_XXX) as a regular NPC: the sprite is cut out on demand by OWSprites, then it behaves like any NPC
  // (scripts, movementType, collision, talking). Drawn like the follower: art-fitted scale, feet 14 px below the tile centre.
  spawnMonNPC(ev, key, mapKey, offsetX, offsetY) {
    const OWS = window.OWSprites, sp = ev.owID;
    if (!OWS || !OWS.hasSprite(sp)) { console.warn('[POKEMON NPC] "' + sp + '" has no entry in tables/OverworldSprites.js (or OverworldSpriteLoader.js is missing): ' + mapKey + '/' + key); return; }
    if (window.OverworldScriptEngine && window.OverworldScriptEngine.isHidden(mapKey, key)) return;
    const gen = this._npcGen;
    const make = () => {
      if (!this.sys || !this.sys.isActive() || !this.add || gen !== this._npcGen) return;
      if (this.npcs.some(n => n.eventKey === key && n.mapName === mapKey)) return;
      const f = OWS.frameName(sp, { dir: 'down', step: 0 });
      if (!f || !this.textures.exists(f.key)) { console.warn('[POKEMON NPC] texture for ' + sp + ' was not made'); return; }
      const x = Math.round(offsetX + ev.xPos * 32 + 16), y = Math.round(offsetY + ev.yPos * 32 + 16);
      const F = window.OWFollower || {}, sc = OWS.fitScale(sp, Number(F.scale) || 2), fh = this.textures.getFrame(f.key, f.frame).height;
      const spr = this.add.sprite(x, y, f.key, f.frame).setScale(sc).setOrigin(0.5, 1 - 14 / (fh * sc));   // the tile centre stays e.x / e.y, the feet sit 14 px lower
      spr.owSpecies = sp; spr.owShiny = !!ev.shiny; OWS.retain(sp);
      spr.footprint = { w: 1, h: 1 };
      const fm = /(?:FACE|WALK_IN_PLACE|LOOK)_(UP|DOWN|LEFT|RIGHT)$/i.exec(String(ev.movementType || ''));
      const fd = fm ? fm[1].toLowerCase() : String(ev.facing || '').toLowerCase();
      spr.direction = ['up', 'down', 'left', 'right'].includes(fd) ? fd : 'down';
      OWS.setFrame(spr, spr.direction, 0, spr.owShiny);
      spr.eventConfig = ev; spr.eventKey = key; spr.mapName = mapKey;
      spr._owAttr = this.owAttrOf(ev.owTileAttribute);
      spr.setDepth(this.npcDepth(spr));
      this.npcs.push(spr); this.npcGroup.add(spr);
      if (ev.followMon) this.spawnNpcFollower(spr);   // [NPC POKÉMON]
    };
    if (OWS.has(this, sp)) make(); else OWS.ensure(this, [sp]).then(make);
  }

  // A Pokémon that walks behind an NPC like its own partner (NPC field followMon = SPECIES_XXX). It is only a picture: it never blocks anybody.
  // movement_type.js (followStep) moves it onto the tile the NPC just left every time the NPC steps.
  spawnNpcFollower(npc) {
    const OWS = window.OWSprites, ev = npc.eventConfig, sp = ev && ev.followMon;
    if (!OWS || !sp || !OWS.hasSprite(sp)) { console.warn('[NPC POKÉMON] "' + sp + '" has no entry in tables/OverworldSprites.js: ' + (npc.eventKey || '')); return; }
    const gen = this._npcGen;
    const make = () => {
      if (!this.sys || !this.sys.isActive() || !this.add || gen !== this._npcGen || !npc.scene || npc.monFollower) return;
      const shiny = !!ev.followShiny, f = OWS.frameName(sp, { dir: 'down', step: 0, shiny });
      if (!f || !this.textures.exists(f.key)) { console.warn('[NPC POKÉMON] texture for ' + sp + ' was not made'); return; }
      const d = npc.direction || 'down', back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[d] || [0, -1];
      const nt = { x: Math.round((npc.x - 16) / 32), y: Math.round((npc.y - 16) / 32) };
      const off = this.getMapWorldOffset(this.currentMapKey);
      const free = (tx, ty) => this.isPassable(tx - Math.round(off.x / 32), ty - Math.round(off.y / 32));
      const cand = [back, [1, 0], [-1, 0], [0, 1], [0, -1]].find(([bx, by]) => free(nt.x + bx, nt.y + by)) || [0, 0];
      const x = (nt.x + cand[0]) * 32 + 16, y = (nt.y + cand[1]) * 32 + 16;
      const F = window.OWFollower || {}, sc = OWS.fitScale(sp, Number(F.scale) || 2), fh = this.textures.getFrame(f.key, f.frame).height;
      const spr = this.add.sprite(x, y, f.key, f.frame).setScale(sc).setOrigin(0.5, 1 - 14 / (fh * sc));
      spr.owSpecies = sp; spr.owShiny = shiny; OWS.retain(sp); spr.direction = d; spr.owner = npc; spr._owAttr = npc._owAttr;
      OWS.setFrame(spr, d, 0, shiny);
      spr.setDepth(this.npcDepth(spr));
      npc.monFollower = spr; (this.npcFollowers = this.npcFollowers || []).push(spr);
      npc.once('destroy', () => { try { spr.destroy(); } catch (_) { } const i = (this.npcFollowers || []).indexOf(spr); if (i >= 0) this.npcFollowers.splice(i, 1); });
    };
    if (OWS.has(this, sp)) make(); else OWS.ensure(this, [sp]).then(make);
  }
  // the NPC-follower Pokémon standing on a tile (world tile coordinates). A follower with followPass on its NPC is ignored (walk-through).
  followerAtTile(tx, ty, ignoreOwner) {
    for (const f of (this.npcFollowers || [])) {
      if (!f.scene || !f.visible || !f.owner || f.owner === ignoreOwner) continue;
      const ec = f.owner.eventConfig; if (ec && ec.followPass) continue;
      if (Math.round((f.x - 16) / 32) === tx && Math.round((f.y - 16) / 32) === ty) return f;
    }
    return null;
  }
  updateNpcFollowers() {
    for (const f of this.npcFollowers) {
      const n = f.owner; if (!f.scene || !n) continue;
      f.setDepth(this.npcDepth(f)); f.setVisible(n.visible);
      // the NPC was moved by something else (a warp, setpos…): bring the Pokémon along
      if (!n.stepTw && !f.moveTw && (Math.abs(f.x - n.x) > 40 || Math.abs(f.y - n.y) > 40)) { f.x = n.x; f.y = n.y + 32; }
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

  // behaviors of every layer of a tile of the CURRENT map
  passesAt(gx, gy) {
    const out = [];
    if (!this.currentMap) return out;
    for (const { grid } of this.getTileLayers(this.currentMap)) {
      const c = this.parseTileCell(grid[gy] && grid[gy][gx]);
      if (c) out.push(c.pass);
    }
    return out;
  }

  // does a wall on edge `w` ('n','e','w','s') stop a move in direction `dir`? entering = the wall belongs to the tile we step onto
  wallBlocks(w, dir, entering) {
    if (!w) return false;
    if (entering) return (dir === 'up' && w === 's') || (dir === 'down' && w === 'n') || (dir === 'left' && w === 'e') || (dir === 'right' && w === 'w');
    return (dir === 'up' && w === 'n') || (dir === 'down' && w === 's') || (dir === 'left' && w === 'w') || (dir === 'right' && w === 'e');
  }

  // the direction a spin tile under the player pushes them, or null
  spinDir() {
    for (const p of this.passesAt(this.playerGridX, this.playerGridY)) { const d = window.OW_BEH.spin[p]; if (d) return d; }
    return null;
  }

  // dir (optional, 'up'|'down'|'left'|'right'): the way the player is moving, so wall tiles (behavior 6-13) can block it
  isPassable(gridX, gridY, dir) {
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
      if (window.OW_BEH.solid.has(c.pass)) return false;  // blocked
      if (dir && this.wallBlocks(window.OW_BEH.wall[c.pass], dir, true)) return false;   // wall on the edge we would enter through
      if (c.pass === 3 && !this.isSurfing) return false;  // surfable water
      if (c.pass === 4 && !this.isDiving) return false;   // diveable water
    }

    // wall on the edge of the tile we are standing on and leaving through
    if (dir) {
      for (const p of this.passesAt(this.playerGridX, this.playerGridY)) if (this.wallBlocks(window.OW_BEH.wall[p], dir, false)) return false;
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
      if (dir && this.npcFollowers && this.npcFollowers.length && this.followerAtTile(worldTX, worldTY)) return false;   // [NPC POKÉMON] solid for the PLAYER only (the player's moves pass dir); NPCs and wild Pokémon walk through it
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
    if (this.scriptRunning) return;

    let targetX = Math.round((this.player.x - 16) / 32);
    let targetY = Math.round((this.player.y - 16) / 32);
    if (this.player.direction === 'up') targetY -= 1;
    else if (this.player.direction === 'down') targetY += 1;
    else if (this.player.direction === 'left') targetX -= 1;
    else if (this.player.direction === 'right') targetX += 1;

    const targetNPC = (this.npcs || []).find(npc => this.npcOccupiesTile(npc, targetX, targetY));
    if (!targetNPC) {   // [NPC POKÉMON] the Pokémon that follows an NPC: talk to it (followScript, or the built-in lock / cry / release)
      const fol = this.followerAtTile(targetX, targetY);
      if (fol && fol.owner && fol.owner.eventConfig) {
        const ec = fol.owner.eventConfig, E = window.OverworldScriptEngine;
        if (E) {
          const dx = this.player.x - fol.x, dy = this.player.y - fol.y, dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          fol.direction = dir; if (window.OWSprites) window.OWSprites.setFrame(fol, dir, 0, fol.owShiny);
          this.activeNPC = fol.owner; this.activeFollower = fol;
          E.runScript(this, ec.followScript || '__follower_default');
          return;
        }
      }   // [SIGNPOST] nobody there: a signpost on that tile?
      const sp = (this.signposts || []).find(s => s.wx === targetX && s.wy === targetY && s.config.script);
      const E = window.OverworldScriptEngine;
      if (sp && E) { this.activeNPC = null; E.runScript(this, sp.config.script); }
      return;
    }

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
    const here = this.triggers.filter(tr => tr.wx === wx && tr.wy === wy);
    if (!here.length) return;
    if (this.scriptRunning) return;

    // A Script tile on the same spot as a Warp goes FIRST and the warp is ignored. A script tile whose Var/Value
    // condition is not met does not count, so the warp still works then.
    const E = window.OverworldScriptEngine;
    const live = here.find(tr => {
      if (tr.type !== 'Script' || !tr.config.script || !E) return false;
      const sv = tr.config.scriptVar;
      return !(sv && E.getVar(sv) !== (Number(tr.config.varValue) || 0));
    });
    if (live) {
      this.activeNPC = null;
      E.runScript(this, live.config.script);
      return;
    }
    const w = here.find(tr => tr.type === 'Warp');
    if (w) this.runWarp(w.config);
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
    this.runBeforeLoadScripts(mapKey, false);   // [LEVEL SCRIPTS]
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

  // ===========================================================================
  // [LEVEL SCRIPTS] scripts of the map that run when the player ENTERS it (map.levelScripts, set in the map editor)
  //   type 'mapEnter'      always plays                                  (runs first)
  //   type 'mapEnterOnce'  plays once, then never again (a flag remembers it)   (runs second)
  //   type 'flag'          plays only while flag `flagID` is ON          (runs last)
  // ===========================================================================
  // type 'beforeLoad': silent scripts (flags / variables / hideobject) that run BEFORE the map is built or entered
  lvlLog(t) { try { const a = (window.__lvlLog = window.__lvlLog || []); a.push(t); if (a.length > 5) a.shift(); console.log('[LEVEL SCRIPTS] ' + t); } catch (e) { } }

  runBeforeLoadScripts(mapKey, flagOnly) {
    const E = window.OverworldScriptEngine, m = window.OverworldMaps && window.OverworldMaps[mapKey];
    if (!E || !E.runSilent) { if (m && Array.isArray(m.levelScripts) && m.levelScripts.some(l => l && l.type === 'beforeLoad')) console.warn('[LEVEL SCRIPTS] before map load needs the NEW js/overworld_script_engine.js (it has no runSilent)'); return; }
    if (!m || !Array.isArray(m.levelScripts)) return;
    for (const l of m.levelScripts) if (l && l.type === 'beforeLoad' && l.script) { this.lvlLog(`before-load ${mapKey}: ${l.script}`); try { E.runSilent(this, l.script, { flagOnly: !!flagOnly, mapKey }); } catch (e) { console.error('[LEVEL SCRIPTS] before map load failed:', e); } }
  }

  runLevelScripts() {
    const key = this.currentMapKey, E = window.OverworldScriptEngine, m = this.currentMap;
    window.__owLevelMap = key;
    if (!E || !m || !Array.isArray(m.levelScripts) || !m.levelScripts.length) { this.lvlLog(`enter ${key}: no level scripts in the map data`); return; }
    const rank = { mapEnter: 0, mapEnterOnce: 1, flag: 2 };
    const list = m.levelScripts.filter(l => l && l.script && rank[l.type] !== undefined)
      .map((l, i) => ({ l, i })).sort((a, b) => rank[a.l.type] - rank[b.l.type] || a.i - b.i).map(o => o.l);
    if (!list.length) return;
    let tries = 0;
    const next = () => {
      if (this.currentMapKey !== key) return;                       // a script moved the player to another map: that map has its own level scripts
      const l = list.shift(); if (!l) return;
      if (l.type === 'mapEnterOnce') { const f = `LEVELONCE:${key}:${l.script}`; if (E.getFlag(f)) { this.lvlLog(`once ${l.script}: already played (flag ${f})`); return next(); } E.setFlag(f, true); }
      else if (l.type === 'flag' && !(l.flagID && E.getFlag(l.flagID))) { this.lvlLog(`flag ${l.script}: ${l.flagID || '(no flag)'} is OFF`); return next(); }
      this.lvlLog(`run ${l.type}: ${l.script}`);
      E.runScript(this, l.script, () => this.time.delayedCall(60, next));
    };
    const start = () => {
      if (!this.sys || !this.sys.isActive() || this.currentMapKey !== key) return;
      if ((this.scriptRunning || this.warping || this.isMoving || this.isLocked) && tries++ < 100) { this.time.delayedCall(100, start); return; }
      next();
    };
    this.time.delayedCall(250, start);
  }

  finishWarp() {
    this.player.setScale(this.playerScale()).setAlpha(1);
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.warping = false;
    this.isMoving = false;
    this.runLevelScripts();   // [LEVEL SCRIPTS]
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
            this.player.setScale(this.playerScale()).setAlpha(1).setPosition(landX, landY - 320);
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
    for (const t of this.animTiles) t.img.setFrame(t.list ? t.list[step % t.list.length] : t.base + (step % t.count));
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
    const legit = menu || this.evolving || this.scriptRunning || this.warping || this.trainerBusy || (window.BattleTransition && window.BattleTransition.busy) || (window.OWWild && window.OWWild.busy);
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
    if (window.OverworldMovement && window.OverworldMovement.trainerSpot) window.OverworldMovement.trainerSpot(this, time);   // [TRAINER] isTrainer NPCs that see the player
    if (this.npcFollowers && this.npcFollowers.length) this.updateNpcFollowers();   // [NPC POKÉMON] Pokémon that follow an NPC

    // [CHANGED] depth is updated every frame (also while walking), before the early return
    if (this.player && this.player.direction) { this.lastDir = this.player.direction; const sd1 = window.GameStateManager && window.GameStateManager.saveData; if (sd1) sd1.facing = this.lastDir; }
    if (this.player && this.npcs) {
      this.player.setDepth(this.player.y);
      this.npcs.forEach(npc => npc.setDepth(this.npcDepth(npc)));
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

    // [SPIN] a spin tile keeps pushing the player until the way ahead is blocked
    const spin = this.spinDir();
    if (spin) {
      const sx = spin === 'left' ? -1 : spin === 'right' ? 1 : 0, sy = spin === 'up' ? -1 : spin === 'down' ? 1 : 0;
      if (this.isPassable(this.playerGridX + sx, this.playerGridY + sy, spin)) { dx = sx; dy = sy; newDir = spin; }
    }

    this.player.direction = newDir;

    if (dx !== 0 || dy !== 0) {
      this.idleMs = 0;
      const targetGridX = this.playerGridX + dx;
      const targetGridY = this.playerGridY + dy;

      if (this.isPassable(targetGridX, targetGridY, newDir)) {
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

  // [PLAYER] table entries that can be the player sprite, best first: [{ key, name, entry }]
  playerOWCandidates() {
    const t = OW_TABLE() || {}, sd = window.GameStateManager && window.GameStateManager.saveData;
    const female = String((sd && sd.player && sd.player.gender) || 'MALE').toUpperCase() === 'FEMALE';
    const want = (female ? ['female_player_ow'] : []).concat(['male_player_ow']), out = [];
    for (const id of want) {
      for (const [name, entry] of Object.entries(t)) {
        if (entry && entry.owSprite && ((entry.spriteID || `${name.toLowerCase()}_ow`) === id)) { out.push({ key: id, name, entry }); break; }
      }
    }
    return out;
  }

  // [PLAYER] texture key of the player sprite that is actually loaded
  // [PLAYER] display scale of the player sprite (owScale of its table entry)
  playerScale() {
    const key = this.playerTextureKey(), t = OW_TABLE() || {};
    for (const c of this.playerOWCandidates()) if (c.key === key) return Number(c.entry.owScale) > 0 ? Number(c.entry.owScale) : 1;
    const b = t['Brendan'];
    return b && Number(b.owScale) > 0 ? Number(b.owScale) : 1;
  }

  playerTextureKey() {
    for (const c of this.playerOWCandidates()) if (this.textures.exists(c.key)) return c.key;
    return 'brendan_ow';
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
    this.runBeforeLoadScripts(this.currentMapKey, false);   // [LEVEL SCRIPTS]
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
        this.runLevelScripts();   // [LEVEL SCRIPTS]
      }
    });
  }
}
