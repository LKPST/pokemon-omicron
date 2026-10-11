// tables/TrainerTables.js

// 1. Front Sprite Lookup Table
const TrainerSpritesTable = {
  1: 'graphics/trainer_front_sprites/male_player.png',
  2: 'graphics/trainer_front_sprites/female_player.png',
  3: 'graphics/trainer_front_sprites/wilhelm.png',
  4: 'graphics/trainer_front_sprites/hazel.png',
  5: 'graphics/trainer_front_sprites/vance.png',
  6: 'graphics/trainer_front_sprites/portia.png'
};

// 2. Back Sprite Lookup Table
const TrainerBackSpritesTable = {
  1: 'graphics/trainer_back_sprites/gTrainerBackPic_Brendan.png'
};

// 3. Master Trainer Details Table
const TrainersTable = {
  portia: {
      id: 6,
      name: 'Portia',
      frontSpriteId: 6,
      backSpriteId: null,
  },
  wilhelm: {
      id: 3,
      name: 'WILHELM',
      frontSpriteId: 3,
      backSpriteId: null,
  }
  // Easily add more trainers here later!
};