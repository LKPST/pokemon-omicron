window.OverworldTable = {
  Portia: {
    spriteID: 'portia_ow',
    frames: 12, // 3 frames per direction across 4 directions (Down, Left, Right, Up)
    genderBased: false,
    owType: 'NPC',
    owDimension: '16x32', // Standard GBA human NPC dimension
    isRunning: false,
    isFishing: false,
    isSurfing: false,
    isCycling: false,
    owSprite: 'graphics/overworld/portia.png',
  },
  Brendan: {
    spriteID: 'brendan_ow',
    frames: 12,
    genderBased: false,
    owType: 'NPC',
    owDimension: '16x32',
    isRunning: true,
    isFishing: false,
    isSurfing: false,
    isCycling: false,
    owSprite: 'graphics/overworld/brendan.png',
  },
  Lily: {
    spriteID: 'lily_ow',
    frames: 12, // 3 frames per direction across 4 directions (Down, Left, Right, Up)
    genderBased: false,
    owType: 'NPC',
    owDimension: '16x32', // Standard GBA human NPC dimension
    isRunning: false,
    isFishing: false,
    isSurfing: false,
    isCycling: false,
    owSprite: 'graphics/overworld/lily.png',
  },
  Hatterene: {
    spriteID: 'hatterene_ow',
    frames: 12,
    genderBased: false,
    owType: 'Pokemon',
    owDimension: '32x32', // Larger dimensions supported for overworld Pokémon
    isRunning: false,
    isFishing: false,
    isSurfing: false,
    isCycling: false,
    owSprite: 'graphics/overworld/hatterene_ow.png',
    shinySprite: 'graphics/overworld/hatterene_shiny_ow.png'
  }
};

// Helper utility to get frame indices based on direction and animation step
window.getOverworldFrame = function(direction, step = 0) {
  // direction: 'down', 'left', 'right', 'up'
  // step: 0 (standing), 1 (walk step 1), 2 (walk step 2)
  
  const rowMap = {
    'down': 0,  // Row 0
    'left': 1,  // Row 1
    'right': 2, // Row 2
    'up': 3     // Row 3
  };

  const row = rowMap[direction] !== undefined ? rowMap[direction] : 0;
  let col = 0;

  // Custom column mapping based on your exact sequence rules
  if (direction === 'up') {
    // Up uses walking right/left frames from columns 1 and 3
    if (step === 1) col = 1; // walking right frame
    else if (step === 2) col = 3; // walking left frame
    else col = 0; // standing
  } else if (direction === 'right') {
    // Right uses columns 1 and 2/3 for proper right/left stepping
    if (step === 1) col = 1;
    else if (step === 2) col = 2;
    else col = 0;
  } else {
    // Standard sequence for Down and Left
    if (step === 1) col = 1; // walking right 1
    else if (step === 2) col = 3; // walking left 1
    else col = 0; // standing
  }

  // 4 columns total per row
  return (row * 4) + col;
};