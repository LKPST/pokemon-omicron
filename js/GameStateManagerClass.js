// js/GameStateManagerClass.js

class GameStateManagerClass {
  constructor() {
    // --- PLAYER STATE ---
    this.activePlayerName = 'Clay';
    this.activePlayerGender = 'MALE'; // 'MALE' or 'FEMALE'
    this.activePlayerBackSprite = 'gTrainerBackPic_Brendan';
    this.activePlayerMapID = 1;
    this.activePlayerBankID = 0;
    this.activePlayerXpos = 0;
    this.activePlayerYpos = 0;

    // --- PLAYER PARTY POKEMON (Slots 1 to 6) ---
    this.playerPartyMon1 = {
      species: 'SPECIES_LUCARIO_Z',
      nickname: 'Flora',
      OTID: 54321,
      HP: 150,
      maxHP: 150,
      level: 50,
      isShiny: 1,           // 1 = Shiny (uses backShinySprite), 0 = Normal
      teraType: 'TYPE_GRASS',
      isGigantaMax: false,
      heldItem: 'ITEM_LEFTOVERS',
      ability: 'ABILITY_PROTEAN',
      paradoxPoint: 10,
      manaPoint: 100,
      ballId: 1             // Pokeball ID used for throwing animation
    };
    this.playerPartyMon2 = null;
    this.playerPartyMon3 = null;
    this.playerPartyMon4 = null;
    this.playerPartyMon5 = null;
    this.playerPartyMon6 = null;

    // --- BATTLE CONTEXT & TARGETING BANKS ---
    this.attackerBank = null; // Who is currently executing an action
    this.targetBankA = null; // Primary target
    this.targetBankB = null; // Secondary target (multi-battles)
    this.targetBankC = null; // Tertiary target
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
    }; // Current active opponent Pokémon

    this.partnerPartyMon = null; // Current active ally Pokémon (multi-battles)

    // --- OPPONENT BANK A (Primary Enemy / Trainer) ---
    this.activeOpponentNameBankA = 'PORTIA';
    this.activeOpponentTrainerIDBankA = 101;
    this.activeOpponentTrainerSpriteBankA = 'portia';
    this.activeOpponentClassBankA = 'PKMN TRAINER';
    this.activeOpponentMoneyBankA = 500;
    this.activeOpponentMovePoolBankA = [];
    this.activeOpponentItemPoolBankA = [];
    this.activeOpponentNatureBankA = 'Hardy';
    this.activeOpponentCustomBallBankA = 'poke_ball';
    this.activeOpponentBankA = null;

    // --- OPPONENT BANK B (Multi-battle slot 2) ---
    this.activeOpponentNameBankB = '';
    this.activeOpponentTrainerIDBankB = null;
    this.activeOpponentTrainerSpriteBankB = null;
    this.activeOpponentClassBankB = '';
    this.activeOpponentMoneyBankB = 0;
    this.activeOpponentMovePoolBankB = [];
    this.activeOpponentItemPoolBankB = [];
    this.activeOpponentNatureBankB = '';
    this.activeOpponentCustomBallBankB = '';
    this.activeOpponentBankB = null;

    // --- OPPONENT BANK C (Multi-battle slot 3) ---
    this.activeOpponentNameBankC = '';
    this.activeOpponentTrainerIDBankC = null;
    this.activeOpponentTrainerSpriteBankC = null;
    this.activeOpponentClassBankC = '';
    this.activeOpponentMoneyBankC = 0;
    this.activeOpponentMovePoolBankC = [];
    this.activeOpponentItemPoolBankC = [];
    this.activeOpponentNatureBankC = '';
    this.activeOpponentCustomBallBankC = '';
    this.activeOpponentBankC = null;
  }

  // --- STATIC DATABASE LOOKUP HELPER ---
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

  // --- TEXT INTERPOLATION HELPER ---
  // Automatically replaces $activePlayerName or opponent name tags inside any dialogue string
  parseText(text) {
    if (!text) return '';
    return text
      .replace(/\$activePlayerName/g, this.activePlayerName)
      .replace(/\$activeOpponentNameBankA/g, this.activeOpponentNameBankA)
      .replace(/\$activeOpponentNameBankB/g, this.activeOpponentNameBankB)
      .replace(/\$activeOpponentNameBankC/g, this.activeOpponentNameBankC);
  }

  // --- GETTERS & SETTERS ---
  setPlayerName(name) {
    this.activePlayerName = name;
  }

  getPlayerName() {
    return this.activePlayerName;
  }

  setOpponentBankA(trainerData) {
    this.activeOpponentNameBankA = trainerData.name || 'UNKNOWN';
    this.activeOpponentTrainerIDBankA = trainerData.id || 0;
    this.activeOpponentTrainerSpriteBankA = trainerData.sprite || '';
    this.activeOpponentClassBankA = trainerData.trainerClass || 'TRAINER';
    this.activeOpponentMoneyBankA = trainerData.money || 0;
    this.activeOpponentMovePoolBankA = trainerData.moves || [];
    this.activeOpponentItemPoolBankA = trainerData.items || [];
  }
}

// Global Singleton Instance
window.GameStateManager = new GameStateManagerClass();