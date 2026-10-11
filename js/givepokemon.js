window.GivePokemonSystem = {
  give: function(pokemonData) {
    if (!window.GameStateManager || !window.GameStateManager.saveData) {
      console.error("[GivePokemon] GameStateManager or saveData not initialized.");
      return false;
    }

    const saveData = window.GameStateManager.saveData;
    if (!saveData.party) {
      saveData.party = [null, null, null, null, null, null];
    }

    // Find first open party slot
    let addedToParty = false;
    for (let i = 0; i < 6; i++) {
      if (!saveData.party[i]) {
        saveData.party[i] = pokemonData;
        addedToParty = true;
        console.log(`[GivePokemon] Added ${pokemonData.nickname || pokemonData.species} to party slot ${i + 1}`);
        break;
      }
    }

    // Fallback to PC Storage if party is full
    if (!addedToParty) {
      if (!saveData.pcStorage || !Array.isArray(saveData.pcStorage)) {
        saveData.pcStorage = [[]];
      }
      saveData.pcStorage[0].push(pokemonData);
      console.log(`[GivePokemon] Party full! Sent to PC Box 1`);
    }

    // --- PERSISTENCE HOOK ---
    // Save state to browser storage so it never gets lost on refresh
    try {
      localStorage.setItem('pokemon_micron_save', JSON.stringify(saveData));
      console.log("[GivePokemon] Save state successfully committed to localStorage!");
    } catch (e) {
      console.error("[GivePokemon] Failed to write to localStorage:", e);
    }

    return true;
  }
};