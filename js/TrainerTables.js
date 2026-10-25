// tables/TrainerTables.js   (load before BattleScene.js, after the species / move tables)
//
// One entry per trainer. The key is the trainer ID used in scripts:   trainerbattle Roxanne single
// The ID is matched loosely: Roxanne, ROXANNE, roxanne and TRAINER_ROXANNE all find TRAINER_ROXANNE.
//
//   name          shown in battle ("Roxanne would like to battle!")
//   class         key of TrainerClassTable below (shown before the name: "Gym Leader Roxanne"); "" = none
//   frontSprite   battle sprite. Default: graphics/trainer_front_sprites/<id in lower case>.png  (TRAINER_ROXANNE -> roxanne.png)
//   party         the team, in order. Each: { species, level, moves?, item?, ability?, nature?, nickname?, shiny?, ivs? }
//                   moves   ['MOVE_A', ...] up to 4. Missing = the last 4 moves it learns by that level.
//                   item    the item that Pokemon HOLDS (ITEM_LEFTOVERS ...)
//                   ivs     31 (all perfect), or { HP, Attack, Defense, SpAttack, SpDefense, Speed }. Missing = random.
//   items         the trainer's own bag, used during the battle: ['ITEM_FULL_RESTORE', 'ITEM_POTION'].
//                   It heals the Pokemon in battle when it drops below 25% HP, and cures a status. Each item is used once.
//   bg            battle background: grass | cave | water | indoor | sand  (default grass)
//   ai            'basic' (default) | 'smart'  (smart = always takes the move it scores best; basic = a little random)
//   money         prize for winning. Default: class money rate x level of the LAST Pokemon
//
// The "would like to battle" line, speeches before and after the fight are written in the script (msgbox before / after trainerbattle).
//
// SAMPLE ENTRIES: replace them with your own.

const TrainerClassTable = {
  'Youngster': { money: 4 },
  'Lass': { money: 4 },
  'Bug Catcher': { money: 3 },
  'Rival': { money: 8 },
  'Gym Leader': { money: 60 },
  'Pkmn Trainer': { money: 12 },
};

const TrainerTable = {
  TRAINER_ROXANNE: {
    name: 'Roxanne', class: 'Gym Leader', frontSprite: 'graphics/trainer_front_sprites/portia.png', bg: 'indoor', ai: 'smart', items: ['ITEM_SUPER_POTION', 'ITEM_SUPER_POTION'],
    party: [
      { species: 'SPECIES_GEODUDE', level: 12, moves: ['MOVE_TACKLE', 'MOVE_DEFENSE_CURL', 'MOVE_ROCK_THROW'] },
      { species: 'SPECIES_GEODUDE', level: 12, moves: ['MOVE_TACKLE', 'MOVE_DEFENSE_CURL', 'MOVE_ROCK_THROW'] },
      { species: 'SPECIES_NOSEPASS', level: 15, item: 'ITEM_ORAN_BERRY', moves: ['MOVE_TACKLE', 'MOVE_HARDEN', 'MOVE_ROCK_THROW', 'MOVE_SAND_ATTACK'], ivs: 31 },
    ],
  },
  TRAINER_PORTIA: {
    name: 'Portia', class: 'Pkmn Trainer', frontSprite: 'graphics/trainer_front_sprites/portia.png',
    party: [
      { species: 'SPECIES_PIDGEY', level: 6 },
      { species: 'SPECIES_RATTATA', level: 7 },
    ],
  },
  TRAINER_YOUNGSTER_JOEY: {
    name: 'Joey', class: 'Youngster', frontSprite: 'graphics/trainer_front_sprites/youngster.png',
    party: [
      { species: 'SPECIES_RATTATA', level: 4 },
    ],
  },
};

// finds a trainer by a loose ID; returns { id, ...entry } or null
function findTrainer(id) {
  if (id == null) return null;
  const n = s => String(s).toUpperCase().replace(/^TRAINER_/, '').replace(/[^A-Z0-9]/g, '');
  const want = n(id);
  for (const k of Object.keys(TrainerTable)) if (n(k) === want) return Object.assign({ id: k }, TrainerTable[k]);
  return null;
}
// prize money: the entry's own `money`, else class rate x level of the last Pokemon
function trainerMoney(t) {
  if (!t) return 0;
  if (t.money != null) return t.money;
  const rate = (TrainerClassTable[t.class] || { money: 4 }).money, last = (t.party || [])[(t.party || []).length - 1];
  return rate * (last ? last.level : 1);
}

window.TrainerTable = TrainerTable; window.TrainerClassTable = TrainerClassTable; window.findTrainer = findTrainer; window.trainerMoney = trainerMoney;
