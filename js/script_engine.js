window.OverworldScriptEngine = {
  // ==========================================
  // 1. LIST OF COMMAND PROCESSORS (The Engine)
  // ==========================================
  commands: {
    lock: function(scene, instr, nextCallback) {
      scene.isLocked = true;
      nextCallback();
    },

    faceplayer: function(scene, instr, nextCallback) {
      if (scene.activeNPC && scene.player) {
        const dx = scene.player.x - scene.activeNPC.x;
        const dy = scene.player.y - scene.activeNPC.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          const dir = dx > 0 ? 'right' : 'left';
          window.OverworldMovement.execute(scene.activeNPC, `look_${dir}`, nextCallback);
        } else {
          const dir = dy > 0 ? 'down' : 'up';
          window.OverworldMovement.execute(scene.activeNPC, `look_${dir}`, nextCallback);
        }
      } else {
        nextCallback();
      }
    },

    'msgbox.normal': function(scene, instr, nextCallback) {
      if (scene.showDialogueBox) {
        scene.showDialogueBox(instr.text, () => {
          nextCallback();
        });
      } else {
        console.log("[Dialogue]", instr.text);
        nextCallback();
      }
    },

    'msgbox.yesno': function(scene, instr, nextCallback) {
      if (scene.showYesNoBox) {
        scene.showYesNoBox(instr.text, (choice) => {
          scene.registry.set('lastChoice', choice);
          nextCallback();
        });
      } else {
        nextCallback();
      }
    },

    givepokemon: function(scene, instr, nextCallback) {
      const speciesKey = instr.species || "SPECIES_EELEKTROSS_M";
      const level = instr.level || 5;
      const nickname = instr.nickname || null;
      const isShiny = instr.isShiny || 0;
      const heldItem = instr.heldItem || null;

      // Pull base stats from PokemonDatabase if available
      const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase;
      const staticData = db ? (db[speciesKey] || db[speciesKey.replace(/_[MF]$/, '')]) : null;

      // Base stat fallback calculations
      const baseHP = staticData && staticData.baseHP ? staticData.baseHP : 50;
      const baseAtk = staticData && staticData.baseAttack ? staticData.baseAttack : 50;
      const baseDef = staticData && staticData.baseDefense ? staticData.baseDefense : 50;
      const baseSpA = staticData && staticData.baseSpAttack ? staticData.baseSpAttack : 50;
      const baseSpD = staticData && staticData.baseSpDefense ? staticData.baseSpDefense : 50;
      const baseSpe = staticData && staticData.baseSpeed ? staticData.baseSpeed : 50;

      // Simple level scaling approximation for dynamic stats
      const calcStat = (base) => Math.floor(((2 * base + 31) * level) / 100) + 5;
      const calcHP = (base) => Math.floor(((2 * base + 31) * level) / 100) + level + 10;

      const pkmnData = {
        species: speciesKey,
        nickname: nickname,
        level: level,
        HP: calcHP(baseHP),
        maxHP: calcHP(baseHP),
        Attack: calcStat(baseAtk),
        Def: calcStat(baseDef),
        spattack: calcStat(baseSpA),
        sdpef: calcStat(baseSpD),
        speed: calcStat(baseSpe),
        ivhp: 31, ivatk: 31, ivdef: 31, ivspd: 31, ivspa: 31, ivspe: 31,
        nature: instr.nature || "NATURE_HARDY",
        ability: instr.ability || (staticData && staticData.ability1 ? staticData.ability1 : "ABILITY_NONE"),
        teraType: instr.teraType || "TYPE_NORMAL",
        isShiny: isShiny,
        heldItem: heldItem,
        pokerus: 0,
        friendship: 70,
        isHatched: true,
        paradoxPoint: 0,
        manaPoint: 50,
        ballId: instr.ballId || 4, // Default Pokéball
        cool: 0, cute: 0, smart: 0, tough: 0, beauty: 0, sheen: 0,
        OTID: 54321,
        OTsecretID: 12345,
        OTName: window.GameStateManager && window.GameStateManager.saveData ? window.GameStateManager.saveData.player.name : "Player",
        latestOTID: 54321,
        latestOTName: window.GameStateManager && window.GameStateManager.saveData ? window.GameStateManager.saveData.player.name : "Player",
        caughtloc: "CRISCANTO_TOWN",
        moves: instr.moves || [
          { moveId: "MOVE_TACKLE", currentPP: 35, maxPP: 35 }
        ],
        markings: { circle: false, triangle: false, square: false, heart: false, star: false, diamond: false },
        ribbons: [],
        superTrainingFlags: { hpMedal: false, atkMedal: false, defMedal: false, spatkMedal: false, spdefMedal: false, speedMedal: false }
      };

      if (window.GivePokemonSystem && typeof window.GivePokemonSystem.give === 'function') {
        window.GivePokemonSystem.give(pkmnData);
      } else {
        console.warn("[ScriptEngine] GivePokemonSystem not found!");
      }
      
      nextCallback();
    },

    release: function(scene, instr, nextCallback) {
      scene.isLocked = false;
      nextCallback();
    },

    trainerbattle: function(scene, instr, nextCallback) {
      console.log(`[ScriptEngine] Initiating trainer battle: ${instr.trainerID} (${instr.matchType})`);
      if (scene.sound && scene.sound.stopAll) {
        scene.sound.stopAll();
      }

      if (window.GameStateManager && instr.pokemon && instr.pokemon.length > 0) {
        const incomingMon = instr.pokemon[0];
        window.GameStateManager.opponentPartyMon1 = {
          species: incomingMon.species || window.GameStateManager.opponentPartyMon1.species,
          level: incomingMon.level || 5,
          isShiny: incomingMon.isShiny !== undefined ? incomingMon.isShiny : 1
        };
      }

      scene.scene.start('BattleScene', {
        name: instr.trainerID,
        pokemon: instr.pokemon || []
      });
    },

    end: function(scene, instr, nextCallback) {
      if (nextCallback) nextCallback();
    }
  },

  // ==========================================
  // 2. LIST OF SCRIPTS (The Sequences)
  // ==========================================
  scripts: {
    "portia_battle_trigger": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox.normal", text: "Portia: So you finally made it.\nLet's see what you've got!" },
      { cmd: "release" },
      { cmd: "trainerbattle", trainerID: "Portia", matchType: "single" },
      { cmd: "end" }
    ],

    "lily_gift_trigger": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox.normal", text: "Lily: I want you to have\nthis Pokémon!" },
      { 
        cmd: "givepokemon", 
        species: "SPECIES_EELEKTROSS_M", 
        nickname: "Lance", 
        level: 15,
        nature: "NATURE_MODEST"
      },
      { cmd: "msgbox.normal", text: "Lily: Take good care of it!" },
      { cmd: "release" },
      { cmd: "end" }
    ]
  },

  // ==========================================
  // 3. RUNNER LOGIC
  // ==========================================
  runScript(scene, scriptName, onFinish) {
    const scriptQueue = this.scripts[scriptName];
    if (!scriptQueue) {
      console.warn(`[ScriptEngine] Script not found: ${scriptName}`);
      if (onFinish) onFinish();
      return;
    }

    let index = 0;

    const executeNext = () => {
      if (index >= scriptQueue.length) {
        if (onFinish) onFinish();
        return;
      }

      const instruction = scriptQueue[index++];
      this.executeCommand(scene, instruction, () => {
        executeNext();
      });
    };

    executeNext();
  },

  executeCommand(scene, instr, nextCallback) {
    const commandFn = this.commands[instr.cmd];
    if (commandFn) {
      commandFn(scene, instr, nextCallback);
    } else {
      console.warn(`[ScriptEngine] Unknown command: ${instr.cmd}`);
      nextCallback();
    }
  }
};