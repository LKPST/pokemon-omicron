/**
 * Pokémon Micron - Global Constants & Configuration Tables
 * Path: table/global.js
 */

window.GlobalTables = {

    // Weather States
    Weather: {
      NONE: "WEATHER_NONE",
      RAIN: "WEATHER_RAIN",
      SNOW: "WEATHER_SNOW",
      FOG: "WEATHER_FOG",
      THUNDERSTORM: "WEATHER_THUNDERSTORM",
      VOLCANIC_ASH: "WEATHER_VOLCANIC_ASH",
      SANDSTORM: "WEATHER_SANDSTORM",
      SUNNY: "WEATHER_SUNNY"
    },
  
    // Map Types
    MapTypes: {
      TOWN: "MAP_TYPE_TOWN",
      CITY: "MAP_TYPE_CITY",
      ROUTE: "MAP_TYPE_ROUTE",
      INDOOR: "MAP_TYPE_INDOOR",
      CAVE: "MAP_TYPE_CAVE",
      DOTTED_HOLE: "MAP_TYPE_DOTTED_HOLE"
    },
  
    // Pokémon Natures (Gen 3 Standard)
    // Each nature boosts one stat by 10% (+1.1) and hinders another by 10% (0.9)
    Natures: {
      HARDY:   { name: "Hardy",   up: null,     down: null },
      LONELY:  { name: "Lonely",  up: "attack", down: "defense" },
      BRAVE:   { name: "Brave",   up: "attack", down: "speed" },
      ADAMANT: { name: "Adamant", up: "attack", down: "spAtk" },
      NAUGHTY: { name: "Naughty", up: "attack", down: "spDef" },
      
      BOLD:    { name: "Bold",    up: "defense", down: "attack" },
      DOCILE:  { name: "Docile",  up: null,      down: null },
      RELAXED: { name: "Relaxed", up: "defense", down: "speed" },
      IMPISH:  { name: "Impish",  up: "defense", down: "spAtk" },
      LAX:     { name: "Lax",     up: "defense", down: "spDef" },
      
      TIMID:   { name: "Timid",   up: "speed", down: "attack" },
      HASTY:   { name: "Hasty",   up: "speed", down: "defense" },
      SERIOUS: { name: "Serious", up: null,    down: null },
      JOLLY:   { name: "Jolly",   up: "speed", down: "spAtk" },
      NAIVE:   { name: "Naive",   up: "speed", down: "spDef" },
      
      MODEST:  { name: "Modest",  up: "spAtk", down: "attack" },
      MILD:    { name: "Mild",    up: "spAtk", down: "defense" },
      QUIET:   { name: "Quiet",   up: "spAtk", down: "speed" },
      BASHFUL: { name: "Bashful", up: null,    down: null },
      RASH:    { name: "Rash",    up: "spAtk", down: "spDef" },
      
      CALM:    { name: "Calm",    up: "spDef", down: "attack" },
      GENTLE:  { name: "Gentle",  up: "spDef", down: "defense" },
      SASSY:   { name: "Sassy",   up: "spDef", down: "speed" },
      CAREFUL: { name: "Careful", up: "spDef", down: "spAtk" },
      QUIRKY:  { name: "Quirky",  up: null,    down: null }
    }
  
  };
  
  console.log("[GlobalTables] Loaded successfully.");