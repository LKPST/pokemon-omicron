// js/ThrowPokeBallAnim.js

class ThrowPokeBallAnim {
  constructor(scene, partyMon) {
    this.scene = scene;
    this.partyMon = partyMon || window.GameStateManager.playerPartyMon1;
    this.staticData = window.GameStateManager.getStaticData(this.partyMon);

    const tables = typeof PokeballTables !== 'undefined' ? PokeballTables : {
      1: {
        id: 1,
        spriteSheet: 'graphics/poke_ball/gInterfaceGfx_PokeBall.png',
        frameWidth: 16,
        frameHeight: 16,
        particleSheet: 'graphics/poke_ball/Sparkle.png',
        particleFrameSize: 32,
      },
    };
    this.ballConfig = tables[this.partyMon.ballId || 1] || tables[1];
  }

  startThrowAnimation(onCompleteCallback) {
    const pokeballSheetKey = 'pokeball_raw_trans';
    const sparkleSheetKey = 'sparkle_raw_trans';
    const cryKey = `mon_cry_${this.partyMon.species}`;

    const finalBallKey = this.scene.textures.exists(pokeballSheetKey) ? pokeballSheetKey : 'pokeball_raw';
    const finalSparkleKey = this.scene.textures.exists(sparkleSheetKey) ? sparkleSheetKey : 'sparkle_raw';

    this.executeThrow(finalBallKey, finalSparkleKey, cryKey, onCompleteCallback);
  }

  executeThrow(ballKey, sparkleKey, cryKey, onCompleteCallback) {
    // Scaled up for 640x480 coordinate space (originating from Brendan's slide position)
    const startX = 160;
    const startY = 230; 
    const targetX = this.staticData.xPos !== undefined ? this.staticData.xPos : 180;
    const targetY = this.staticData.yPos !== undefined ? this.staticData.yPos - 20 : 280;

    const ball = this.scene.add.sprite(startX, startY, ballKey, 0).setDepth(20).setScale(3);

    this.scene.tweens.add({
      targets: ball,
      x: targetX,
      duration: 500,
      ease: 'Linear',
    });

    this.scene.tweens.add({
      targets: ball,
      y: targetY - 70, // Higher arc for 640x480 viewport
      duration: 250,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ball.destroy();
        this.triggerOpenEffect(sparkleKey, cryKey, onCompleteCallback);
      },
    });

    this.scene.tweens.add({
      targets: ball,
      angle: 360 * 3,
      duration: 500,
      ease: 'Linear',
    });
  }

  triggerOpenEffect(sparkleKey, cryKey, onCompleteCallback) {
    const sparkleX = this.staticData.xPos !== undefined ? this.staticData.xPos : 180;
    const sparkleY = this.staticData.yPos !== undefined ? this.staticData.yPos : 300;

    const sparkle = this.scene.add.sprite(sparkleX, sparkleY, sparkleKey, 0).setDepth(25).setScale(5);

    const sparkleAnimKey = 'sparkle_anim';
    if (!this.scene.anims.exists(sparkleAnimKey)) {
      this.scene.anims.create({
        key: sparkleAnimKey,
        frames: this.scene.anims.generateFrameNumbers(sparkleKey, { start: 0, end: 5 }),
        frameRate: 20,
        repeat: 0,
      });
    }

    sparkle.play(sparkleAnimKey);
    sparkle.on('animationcomplete', () => { sparkle.destroy(); });

    try {
      if (this.scene.sound.context && this.scene.sound.context.state === 'suspended') {
        this.scene.sound.context.resume();
      }
      if (this.scene.cache.audio.exists(cryKey)) {
        this.scene.sound.play(cryKey);
      }
    } catch (e) {
      console.warn('[ThrowAnim] Audio playback skipped:', e);
    }

    if (typeof onCompleteCallback === 'function') {
      onCompleteCallback();
    }
  }
}