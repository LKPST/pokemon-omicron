class BaseScene extends Phaser.Scene {
  constructor(key) {
    super(key);
  }

  preload() {
    // Automatically load the font asset globally for any extending scene
    if (this.load && !this.textures.exists('latin_short')) {
      this.load.image('latin_short', 'graphics/fonts/latin_short.png');
    }
  }
}