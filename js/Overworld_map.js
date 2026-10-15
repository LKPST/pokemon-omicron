window.OverworldMaps = {
  "Criscanto Town": {
    map: "Criscanto Town",
    bank: 0,
    dimensions: {
      width: 10,
      height: 10,
      blockSize: 8
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    connections: {
      up: null,
      down: ["Route 1", 0, 0],
      left: null,
      right: null,
    },
    events: {
      NPC_Portia: {
        eventType: "NPC",
        owID: "Portia",
        script: "portia_battle_trigger",
        movementType: "MOVEMENT_TYPE_WANDER_LEFT_RIGHT",
        isTrainer: true,
        viewRadius: 3,
        xPos: 5,
        yPos: 3,
        flagID: "FLAG_DEFEATED_PORTIA"
      },
    },
    wildData: {
      morning: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 },
      ],
      afternoon: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 },
      ],
      night: [
        { pokemonName: "Hatterene", levelRange: [5, 8], appearanceRate: 15 },
      ],
      dawn: [
        { pokemonName: "Bulbasaur", levelRange: [5, 7], appearanceRate: 20 },
      ],
    },
    tileData: [
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "3|0", "0|0", "1|0", "1|1", "1|2", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "1|3", "1|4", "1|5", "0|0", "0|0"],
      ["0|0", "1|5", "3|0", "3|0", "0|0", "1|6", "1|7", "1|8", "0|0", "0|0"],
      ["0|0", "1|5", "3|0", "3|0", "0|0", "2|0", "2|1", "2|2", "0|0", "0|0"],
      ["0|0", "1|5", "1|5", "0|0", "0|0", "2|3", "2|4", "2|5", "0|0", "0|0"],
      ["1|5", "1|5", "0|0", "0|0", "0|0", "2|6", "2|7", "2|8", "0|0", "0|0"],
      ["1|5", "1|5", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "1|5", "0|0", "1|5", "0|0", "0|0", "0|0", "0|0", "0|0"]
    ]
  },

  "Route 1": {
    map: "Route 1",
    bank: 0,
    dimensions: {
      width: 10,
      height: 10,
      blockSize: 8
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    connections: {
      up: ["Criscanto Town", 0, 0],
      down: ["Olenburg City", 0, 0],
      left: null,
      right: null,
    },
    events: {
      Lily: {
        eventType: "NPC",
        owID: "Lily",
        script: "portia_battle_trigger",
        movementType: "MOVEMENT_TYPE_WANDER_UP_AND_DOWN",
        isTrainer: true,
        viewRadius: 3,
        xPos: 4,
        yPos: 3,
        flagID: "FLAG_LILY_DEFEATED"
      },
    },
    wildData: {
      morning: [
      ],
      afternoon: [
      ],
      night: [
      ],
      dawn: [
      ],
    },
    tileData: [

    ]
  },

  "Olenburg City": {
    map: "Olenburg City",
    bank: 0,
    dimensions: {
      width: 10,
      height: 10,
      blockSize: 8
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    connections: {
      up: ["Route 1", 0, 0],
      down: null,
      left: null,
      right: ["Route_2", 0, 0],
    },
    events: {
    },
    wildData: {
      morning: [
      ],
      afternoon: [
      ],
      night: [
      ],
      dawn: [
      ],
    },
    tileData: [
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"]
    ]
  },

  "Route_2": {
    map: "Route_2",
    bank: 0,
    dimensions: {
      width: 10,
      height: 10,
      blockSize: 8
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    connections: {
      up: null,
      down: null,
      left: ["Olenburg City", 0, 0],
      right: null,
    },
    events: {
    },
    wildData: {
      morning: [
      ],
      afternoon: [
      ],
      night: [
      ],
      dawn: [
      ],
    },
    tileData: [
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"]
    ]
  },

  "Route_3": {
    map: "Route_3",
    bank: 0,
    dimensions: {
      width: 10,
      height: 10,
      blockSize: 8
    },
    mapType: "City",
    weather: "Normal",
    isFlyable: true,
    isRunning: true,
    music: "audio/music/criscanto_town.mp3",
    connections: {
      up: null,
      down: null,
      left: null,
      right: null,
    },
    events: {
    },
    wildData: {
      morning: [
      ],
      afternoon: [
      ],
      night: [
      ],
      dawn: [
      ],
    },
    tileData: [
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"],
      ["0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0", "0|0"]
    ]
  }
};