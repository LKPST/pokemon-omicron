// save.json lives in public/ (Vite serves it at the root); on GitHub Pages it is at public/save.json unless you copy it next to index.html. Both places are tried.
async function fetchSaveJson() {
  for (const p of ['save.json', 'public/save.json']) {
    try { const r = await fetch(p); if (r.ok) return await r.json(); } catch (e) { /* try the next place */ }
  }
  return null;
}

async function startGame() {
  try {
    const saveData = await fetchSaveJson();
    {
      if (saveData && window.GameStateManager && typeof window.GameStateManager.loadSaveData === 'function') {
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
  fetchSaveJson()
    .then(data => {
      if (!data) { console.error('[AppBoot] save.json was not found (looked for save.json and public/save.json)'); return; }
      window.GameStateManager.saveData = data;
      localStorage.setItem('pokemon_micron_save', JSON.stringify(data));
      console.log("[AppBoot] Initialized save.json into localStorage.");
    });
}

  // Ensure config is fully defined here so main.js doesn't throw a ReferenceError
  const config = {
    type: Phaser.AUTO,
    width: 480,
    height: 620,
    parent: 'game-container',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [OverworldScene, BattleScene]
  };
  
  window.game = new Phaser.Game(config);
}

// start when the page has loaded; if the 'load' event is slow (a hung request, the debug console ...) start anyway after 1.5 s. Runs only once.
let booted = false;
function boot() { if (booted || window.__PM_LOADING) return; booted = true; console.log('[AppBoot] starting'); startGame(); }
window.addEventListener('load', boot);
setTimeout(() => { if (document.readyState !== 'loading') boot(); }, 1500);
