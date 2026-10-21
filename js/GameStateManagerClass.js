  class GameStateManagerClass {
  constructor() {
    // --- PLAYER & METADATA ---
    this.saveData = {
      player: {
        name: 'Clay',
        gender: 'MALE',
        playerOTID: 54321,
        playerSecretID: 12345,
        money: 500,
        mapID: 1,
        x: 320,
        y: 240
      },
      party: [
        null, null, null, null, null, null
      ],
      pcStorage: Array.from({ length: 8 }, () => []),
      flags: {},
      vars: {}
    };

    // --- OPPONENT & BATTLE STATE ---
    this.opponentPartyMon1 = {
      species: 'SPECIES_EELEKTROSS_M',
      nickname: 'Hexerene',
      OTID: 12345,
      HP: 150,
      maxHP: 150,
      level: 50,
      isShiny: 1,
      teraType: 'TYPE_GRASS',
      isGigantaMax: false,
      heldItem: 'ITEM_LEFTOVERS',
      ability: 'ABILITY_PROTEAN',
      paradoxPoint: 10,
      manaPoint: 100,
      ballId: 1
    };

    this.activeOpponentNameBankA = 'PORTIA';
    this.activeOpponentTrainerIDBankA = 101;
    this.activeOpponentTrainerSpriteBankA = 'portia';
    this.activeOpponentClassBankA = 'PKMN TRAINER';
    this.activeOpponentMoneyBankA = 500;
  }

  // --- SEAMLESS GETTERS/SETTERS FOR BATTLE & SAVE COMPATIBILITY ---
  get playerPartyMon1() { return this.saveData.party[0]; }
  set playerPartyMon1(mon) { this.saveData.party[0] = mon; }

  get playerPartyMon2() { return this.saveData.party[1]; }
  set playerPartyMon2(mon) { this.saveData.party[1] = mon; }

  get activePlayerName() { return this.saveData.player.name; }
  set activePlayerName(name) { this.saveData.player.name = name; }

  // --- LOAD METHOD FROM save.json ---
  loadSaveData(externalSaveData) {
    if (externalSaveData) {
      this.saveData = externalSaveData;
    }
  }

  // --- TEXT INTERPOLATION ---
  parseText(text) {
    if (!text) return '';
    const firstMon = this.playerPartyMon1;
    const monName = firstMon ? (firstMon.nickname || firstMon.species.replace('SPECIES_', '')) : 'Pokémon';

    return text
      .replace(/\$activePlayerName/g, this.saveData.player.name)
      .replace(/\$activeMonName/g, monName)
      .replace(/\$activeOpponentNameBankA/g, this.activeOpponentNameBankA);
  }

  getStaticData(partyMon) {
    if (!partyMon || typeof PokemonDatabase === 'undefined' || !PokemonDatabase[partyMon.species]) {
      return {
        name: 'Unknown',
        frontSprite: '',
        backSprite: '',
        backShinySprite: '',
        iconSprite: '',
        cry: '',
        xPos: 65,
        yPos: 100
      };
    }
    return PokemonDatabase[partyMon.species];
  }

  setPlayerName(name) {
    this.saveData.player.name = name;
  }

  getPlayerName() {
    return this.saveData.player.name;
  }

  setOpponentBankA(trainerData) {
    this.activeOpponentNameBankA = trainerData.name || 'UNKNOWN';
    this.activeOpponentTrainerIDBankA = trainerData.id || 0;
    this.activeOpponentTrainerSpriteBankA = trainerData.sprite || '';
    this.activeOpponentClassBankA = trainerData.trainerClass || 'TRAINER';
    this.activeOpponentMoneyBankA = trainerData.money || 0;
  }

  // --- ASYNC LOADER FOR save.json ---
  async initSaveFile() {
    try {
      const response = await fetch('save.json');
      if (!response.ok) throw new Error('Failed to fetch save.json');
      
      const externalSaveData = await response.json();
      this.loadSaveData(externalSaveData);
      console.log('[GameStateManager] Successfully loaded and synchronized with save.json!');
    } catch (error) {
      console.warn('[GameStateManager] Could not load save.json. Using constructor default data.', error);
    }
  }
  
}

// Global Singleton Instance
window.GameStateManager = new GameStateManagerClass(); 
