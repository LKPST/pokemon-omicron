window.OverworldScriptEngine = {
  // Define available scripts mapped by script name
  scripts: {
    "portia_battle_trigger": [
      { cmd: "lock" },
      { cmd: "faceplayer" },
      { cmd: "msgbox.normal", text: "Portia: So you finally made it.\nLet's see what you've got!" },
      { cmd: "release" },
      { cmd: "trainerbattle", trainerID: "Portia", matchType: "single" },
      { cmd: "end" }
    ]
  },

  // Run a script sequentially
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

  // Execute an individual XSE-style command
  executeCommand(scene, instr, nextCallback) {
    switch (instr.cmd) {
      case 'lock':
        // Freeze player and NPC movement
        scene.isLocked = true;
        nextCallback();
        break;

      case 'faceplayer':
        // Make active NPC turn toward player
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
        break;

      case 'msgbox.normal':
        // Draw message box using your font renderer and pause until key press
        if (scene.showDialogueBox) {
          scene.showDialogueBox(instr.text, () => {
            nextCallback();
          });
        } else {
          console.log("[Dialogue]", instr.text);
          nextCallback();
        }
        break;

      case 'msgbox.yesno':
        if (scene.showYesNoBox) {
          scene.showYesNoBox(instr.text, (choice) => {
            scene.registry.set('lastChoice', choice);
            nextCallback();
          });
        } else {
          nextCallback();
        }
        break;

      case 'release':
        scene.isLocked = false;
        nextCallback();
        break;

        case 'trainerbattle':
          console.log(`[ScriptEngine] Initiating trainer battle: ${instr.trainerID} (${instr.matchType})`);
          
          // Stop overworld music & transition to your BattleScene
          if (scene.sound && scene.sound.stopAll) {
            scene.sound.stopAll();
          }
  
          // If GameStateManager is present, keep its configured opponentPartyMon1 
          // or update it dynamically from trainer data if provided by 'instr'
          if (window.GameStateManager && instr.pokemon && instr.pokemon.length > 0) {
            // If the script instruction passes custom pokemon data, respect it
            // Otherwise leave GameStateManager's opponentPartyMon1 intact
            const incomingMon = instr.pokemon[0];
            window.GameStateManager.opponentPartyMon1 = {
              species: incomingMon.species || window.GameStateManager.opponentPartyMon1.species,
              level: incomingMon.level || 5,
              isShiny: incomingMon.isShiny !== undefined ? incomingMon.isShiny : 1
            };
          }
  
          // Launch BattleScene with trainer context
          scene.scene.start('BattleScene', {
            name: instr.trainerID,
            pokemon: instr.pokemon || []
          });
          break;
          
      case 'end':
        if (nextCallback) nextCallback();
        break;

      default:
        console.warn(`[ScriptEngine] Unknown command: ${instr.cmd}`);
        nextCallback();
        break;
    }
  }
};