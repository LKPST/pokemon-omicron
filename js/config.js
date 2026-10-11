const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  parent: 'game-container',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [OverworldScene, BattleScene]
};