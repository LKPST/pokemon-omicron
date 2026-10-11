window.OverworldMaps = {
  "Criscanto Town": {
    map: "Criscanto Town",
    bank: 0,
    dimensions: {
      width: 10,   // 10 blocks wide
      height: 10,  // 10 blocks high
      blockSize: 8 // Each block is 8x8 pixels
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    
    // NPC, Script tiles, signposts, and buildings
    events: {
      NPC_Portia: {
        owID: "Portia",
        eventType: "NPC",
        script: "portia_battle_trigger",
        movementType: "wander_left_right", // Movement pattern
        isTrainer: true,
        viewRadius: 3,
        xPos: 5,
        yPos: 3,
        flagID: "FLAG_DEFEATED_PORTIA"
      }
    },

    // Wild encounters structured by day cycles
    wildData: {
      morning: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 }
      ],
      afternoon: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 }
      ],
      night: [
        { pokemonName: "Hatterene", levelRange: [5, 8], appearanceRate: 15 }
      ],
      dawn: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 }
      ]
    },

    // Placeholder block mapping for 10x10 blocks
    // 0 = standard floor/passable, 1 = grass patch, 2 = building/solid structure
    blockData: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 0, 0, 1, 1, 0, 2],
      [2, 0, 1, 1, 0, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 0, 1, 1, 0, 0, 1, 1, 0, 2],
      [2, 0, 1, 1, 0, 0, 1, 1, 0, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  }
};