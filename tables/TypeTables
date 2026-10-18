// tables/TypeTables.js  (made with type_icon_tool.html - edit it there, or by hand)
//
// sheet        the icon sheet (path used by the game)
// bgKey        true = the colour of the top-left pixel of the sheet is transparent
// icon         { x, y, w, h } of the type icon on the sheet (null = no icon, a text badge is drawn)
// effectiveness  attacker -> { defender: 0 | 0.5 | 2 }  (missing = 1)

const TypeTable = {
  sheet: 'graphics/ui/Type_Icons.png',
  bgKey: true,
  bgTolerance: 24,
  order: ['TYPE_NORMAL', 'TYPE_FIGHTING', 'TYPE_FLYING', 'TYPE_POISON', 'TYPE_GROUND', 'TYPE_ROCK', 'TYPE_BUG', 'TYPE_GHOST', 'TYPE_STEEL', 'TYPE_MYSTERY', 'TYPE_FIRE', 'TYPE_WATER', 'TYPE_GRASS', 'TYPE_ELECTRIC', 'TYPE_PSYCHIC', 'TYPE_ICE', 'TYPE_DRAGON', 'TYPE_DARK', 'TYPE_FAIRY', 'TYPE_STELLAR', 'TYPE_MANA'],
  types: {
    TYPE_NORMAL: { id: 0, name: 'Normal', short: 'Normal', color: '#a8a878', icon: { x: 0, y: 16, w: 32, h: 12 }, effectiveness: { TYPE_ROCK: 0.5, TYPE_STEEL: 0.5, TYPE_GHOST: 0 } },
    TYPE_FIGHTING: { id: 1, name: 'Fighting', short: 'Fight', color: '#c03028', icon: { x: 32, y: 48, w: 32, h: 12 }, effectiveness: { TYPE_NORMAL: 2, TYPE_ICE: 2, TYPE_POISON: 0.5, TYPE_FLYING: 0.5, TYPE_PSYCHIC: 0.5, TYPE_BUG: 0.5, TYPE_FAIRY: 0.5, TYPE_ROCK: 2, TYPE_DARK: 2, TYPE_STEEL: 2, TYPE_GHOST: 0 } },
    TYPE_FLYING: { id: 2, name: 'Flying', short: 'Flying', color: '#a890f0', icon: { x: 0, y: 48, w: 32, h: 12 }, effectiveness: { TYPE_ELECTRIC: 0.5, TYPE_GRASS: 2, TYPE_FIGHTING: 2, TYPE_BUG: 2, TYPE_ROCK: 0.5, TYPE_STEEL: 0.5, TYPE_MANA: 2 } },
    TYPE_POISON: { id: 3, name: 'Poison', short: 'Poison', color: '#a040a0', icon: { x: 0, y: 64, w: 32, h: 12 }, effectiveness: { TYPE_GRASS: 2, TYPE_FAIRY: 2, TYPE_POISON: 0.5, TYPE_GROUND: 0.5, TYPE_ROCK: 0.5, TYPE_GHOST: 0.5, TYPE_STEEL: 0 } },
    TYPE_GROUND: { id: 4, name: 'Ground', short: 'Ground', color: '#d8b858', icon: { x: 64, y: 32, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 2, TYPE_ELECTRIC: 2, TYPE_GRASS: 0.5, TYPE_POISON: 2, TYPE_FLYING: 0, TYPE_BUG: 0.5, TYPE_ROCK: 2, TYPE_STEEL: 2 } },
    TYPE_ROCK: { id: 5, name: 'Rock', short: 'Rock', color: '#b8a038', icon: { x: 32, y: 32, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 2, TYPE_ICE: 2, TYPE_FIGHTING: 0.5, TYPE_GROUND: 0.5, TYPE_FLYING: 2, TYPE_BUG: 2, TYPE_STEEL: 0.5 } },
    TYPE_BUG: { id: 6, name: 'Bug', short: 'Bug', color: '#a8b820', icon: { x: 96, y: 48, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 0.5, TYPE_GRASS: 2, TYPE_FIGHTING: 0.5, TYPE_POISON: 0.5, TYPE_FLYING: 0.5, TYPE_PSYCHIC: 2, TYPE_GHOST: 0.5, TYPE_DARK: 2, TYPE_STEEL: 0.5, TYPE_FAIRY: 0.5 } },
    TYPE_GHOST: { id: 7, name: 'Ghost', short: 'Ghost', color: '#705898', icon: { x: 64, y: 48, w: 32, h: 12 }, effectiveness: { TYPE_NORMAL: 0, TYPE_PSYCHIC: 2, TYPE_DARK: 0.5, TYPE_GHOST: 2 } },
    TYPE_STEEL: { id: 8, name: 'Steel', short: 'Steel', color: '#a8a8c0', icon: { x: 64, y: 64, w: 32, h: 12 }, effectiveness: { TYPE_STEEL: 0.5, TYPE_FIRE: 0.5, TYPE_WATER: 0.5, TYPE_ELECTRIC: 0.5, TYPE_ICE: 2, TYPE_ROCK: 2, TYPE_FAIRY: 2, TYPE_MANA: 2 } },
    TYPE_MYSTERY: { id: 9, name: '???', short: '???', color: '#68a090', icon: { x: 32, y: 80, w: 32, h: 12 }, effectiveness: {  } },
    TYPE_FIRE: { id: 10, name: 'Fire', short: 'Fire', color: '#f08030', icon: { x: 32, y: 16, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 0.5, TYPE_WATER: 0.5, TYPE_GRASS: 2, TYPE_ICE: 2, TYPE_BUG: 2, TYPE_ROCK: 0.5, TYPE_DRAGON: 0.5, TYPE_STEEL: 2 } },
    TYPE_WATER: { id: 11, name: 'Water', short: 'Water', color: '#6890f0', icon: { x: 64, y: 16, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 2, TYPE_WATER: 0.5, TYPE_GRASS: 0.5, TYPE_GROUND: 2, TYPE_ROCK: 2, TYPE_DRAGON: 0.5, TYPE_MANA: 0.5 } },
    TYPE_GRASS: { id: 12, name: 'Grass', short: 'Grass', color: '#78c850', icon: { x: 96, y: 16, w: 32, h: 12 }, effectiveness: { TYPE_FIRE: 0.5, TYPE_WATER: 2, TYPE_GRASS: 0.5, TYPE_POISON: 0.5, TYPE_GROUND: 2, TYPE_FLYING: 0.5, TYPE_BUG: 0.5, TYPE_ROCK: 2, TYPE_DRAGON: 0.5, TYPE_STEEL: 0.5, TYPE_MANA: 0.5 } },
    TYPE_ELECTRIC: { id: 13, name: 'Electric', short: 'Electr', color: '#f0c820', icon: { x: 0, y: 32, w: 32, h: 12 }, effectiveness: { TYPE_WATER: 2, TYPE_ELECTRIC: 0.5, TYPE_GRASS: 0.5, TYPE_GROUND: 0, TYPE_FLYING: 2, TYPE_DRAGON: 0.5, TYPE_MANA: 0.5 } },
    TYPE_PSYCHIC: { id: 14, name: 'Psychic', short: 'Psychc', color: '#f85888', icon: { x: 32, y: 64, w: 32, h: 12 }, effectiveness: { TYPE_FIGHTING: 2, TYPE_POISON: 2, TYPE_PSYCHIC: 0.5, TYPE_DARK: 0, TYPE_STEEL: 0.5 } },
    TYPE_ICE: { id: 15, name: 'Ice', short: 'Ice', color: '#98d8d8', icon: { x: 96, y: 32, w: 32, h: 12 }, effectiveness: { TYPE_WATER: 0.5, TYPE_GRASS: 2, TYPE_ICE: 0.5, TYPE_GROUND: 2, TYPE_FLYING: 2, TYPE_DRAGON: 2, TYPE_STEEL: 0.5, TYPE_FIRE: 0.5 } },
    TYPE_DRAGON: { id: 16, name: 'Dragon', short: 'Dragon', color: '#7038f8', icon: { x: 0, y: 80, w: 32, h: 12 }, effectiveness: { TYPE_DRAGON: 2, TYPE_STEEL: 0.5, TYPE_FAIRY: 0 } },
    TYPE_DARK: { id: 17, name: 'Dark', short: 'Dark', color: '#705848', icon: { x: 96, y: 64, w: 32, h: 12 }, effectiveness: { TYPE_FIGHTING: 0.5, TYPE_PSYCHIC: 2, TYPE_GHOST: 2, TYPE_DARK: 0.5, TYPE_FAIRY: 0.5 } },
    TYPE_FAIRY: { id: 23, name: 'Fairy', short: 'Fairy', color: '#ee99ac', icon: { x: 0, y: 128, w: 32, h: 12 }, effectiveness: { TYPE_POISON: 0.5, TYPE_STEEL: 0.5, TYPE_FIRE: 0.5, TYPE_FIGHTING: 2, TYPE_DRAGON: 2, TYPE_DARK: 2, TYPE_MANA: 0.5 } },
    TYPE_STELLAR: { id: 24, name: 'Stellar', short: 'Stellr', color: '#58b8c8', icon: { x: 32, y: 128, w: 32, h: 12 }, effectiveness: {  } },
    TYPE_MANA: { id: 25, name: 'Mana', short: 'Mana', color: '#888888', icon: { x: 64, y: 128, w: 32, h: 12 }, effectiveness: { TYPE_NORMAL: 0, TYPE_GROUND: 0.5, TYPE_ROCK: 0.5, TYPE_STEEL: 0.5, TYPE_FAIRY: 2, TYPE_FIRE: 2, TYPE_WATER: 2, TYPE_GRASS: 2, TYPE_MANA: 2, TYPE_FIGHTING: 2 } },
  },
  labels: { TYPE: { x: 64, y: 82, w: 38, h: 9 }, POWER: { x: 0, y: 98, w: 38, h: 9 }, ACCURACY: { x: 64, y: 98, w: 38, h: 9 }, PP: { x: 0, y: 114, w: 38, h: 9 }, EFFECT: { x: 64, y: 114, w: 38, h: 9 } },

  get(key) { return this.types[key] || null; },

  // damage multiplier of an attack of type `attackKey` against a Pokemon with the type keys in `defenderKeys` (TYPE_NONE is ignored)
  multiplier(attackKey, defenderKeys) {
    const a = this.types[attackKey]; if (!a) return 1;
    let m = 1;
    for (const d of [].concat(defenderKeys)) { if (!d || d === 'TYPE_NONE') continue; const v = a.effectiveness[d]; if (v !== undefined) m *= v; }
    return m;
  },

  // draws the icon of a type on a canvas 2D context. img = the loaded sheet (an Image or canvas).
  drawIcon(ctx, img, key, x, y, scale = 1) {
    const t = this.types[key]; if (!t || !t.icon) return false;
    ctx.drawImage(img, t.icon.x, t.icon.y, t.icon.w, t.icon.h, x, y, t.icon.w * scale, t.icon.h * scale);
    return true;
  },
};
window.TypeTable = TypeTable;
