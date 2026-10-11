async function startGame() {
  try {
    const response = await fetch('save.json');
    if (response.ok) {
      const saveData = await response.json();
      if (window.GameStateManager && typeof window.GameStateManager.loadSaveData === 'function') {
        window.GameStateManager.loadSaveData(saveData);
        console.log('[AppBoot] save.json successfully loaded!');
      }
    }
  } catch (error) {
    console.warn('[AppBoot] Could not parse save.json, using defaults.', error);
  }

 // At game startup / boot:
const existingSave = localStorage.getItem('pokemon_micron_save');

if (existingSave) {
  window.GameStateManager.saveData = JSON.parse(existingSave);
  console.log("[AppBoot] Loaded active save data from browser storage.");
} else {
  // Fallback to loading save.json if no local save exists yet
  fetch('save.json')
    .then(res => res.json())
    .then(data => {
      window.GameStateManager.saveData = data;
      localStorage.setItem('pokemon_micron_save', JSON.stringify(data));
      console.log("[AppBoot] Initialized save.json into localStorage.");
    });
}

  // Ensure config is fully defined here so main.js doesn't throw a ReferenceError
  const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 480,
    scene: [OverworldScene,BattleScene]
  };
  
  window.game = new Phaser.Game(config);
}

window.onload = () => {
  startGame();
};