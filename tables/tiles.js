/**
 * Pokémon Micron - Tiles Registry
 * Path: table/tiles.js
 */

window.TileRegistry = {
    0: { id: 0, name: "Normal Floor", type: "floor", passability: "walkable", image: "graphics/tiles/floor_normal.png" },
    1: { id: 1, name: "Grass Patch", type: "grass", passability: "walkable", image: "graphics/tiles/grass.png" },
    2: { id: 2, name: "Building Wall", type: "wall", passability: "solid", image: "graphics/tiles/wall.png" },
    3: { id: 3, name: "Fishing Spot", type: "water", passability: "surfable", image: "graphics/tiles/water_fish.png" },
    4: { id: 4, name: "Waterfall", type: "waterfall", passability: "waterfall", image: "graphics/tiles/waterfall.png" },
    5: { id: 5, name: "Covering NPC Roof", type: "roof", passability: "overlay", image: "graphics/tiles/roof_overlay.png" }
  };
  
  console.log("[TileRegistry] Loaded successfully.");