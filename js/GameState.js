function removeSpriteBackground(scene, textureKey, frameWidth = 0, frameHeight = 0, shinyPaletteSourceKey = null) {
  const transKey = shinyPaletteSourceKey ? `${textureKey}_shiny_trans` : `${textureKey}_trans`;
  if (scene.textures.exists(transKey)) {
    return transKey; 
  }

  if (!scene.textures.exists(textureKey)) {
    console.warn(`[BackgroundRemoval] Texture "${textureKey}" does not exist.`);
    return textureKey;
  }
  
  const sourceImage = scene.textures.get(textureKey).getSourceImage();
  if (!sourceImage || sourceImage.width === 0) return textureKey;

  const canvasTex = scene.textures.createCanvas(
    transKey,
    sourceImage.width,
    sourceImage.height
  );
  if (!canvasTex) return textureKey;

  canvasTex.draw(0, 0, sourceImage);
  const ctx = canvasTex.context;
  const imgData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
  const data = imgData.data;

  const alphaVal = data[3];
  if (alphaVal !== 0) {
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
        data[i + 3] = 0; // Transparent
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  canvasTex.refresh();

  if (frameWidth > 0 && frameHeight > 0) {
    let frameIndex = 0;
    for (let y = 0; y < sourceImage.height; y += frameHeight) {
      for (let x = 0; x < sourceImage.width; x += frameWidth) {
        canvasTex.add(frameIndex, 0, x, y, frameWidth, frameHeight);
        frameIndex++;
      }
    }
  }

  return transKey;
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
    this.selectedMenuIndex = 0;
    this.menuActive = false;
    this.menuConfirmed = false;
  }

  preload() {
    this.load.image('pokeball_transition', 'graphics/battle_scene/pokeball_icon_battle_start.png');
    this.load.image('portia', 'graphics/trainer_front_sprites/portia.png');
    this.load.spritesheet('brendan', 'graphics/trainer_back_sprites/gTrainerBackPic_Brendan.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.image('latin_short', 'graphics/fonts/latin_short.png');

    if (this.sound.context && this.sound.context.state === 'suspended') {
      this.sound.context.resume();
    }

    this.load.spritesheet('pokeball_raw', 'graphics/poke_ball/gInterfaceGfx_PokeBall.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('sparkle_raw', 'graphics/poke_ball/Sparkle.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    const activeMon = window.GameStateManager ? window.GameStateManager.playerPartyMon1 : null;
    if (activeMon && typeof PokemonDatabase !== 'undefined') {
      const staticData = PokemonDatabase[activeMon.species];
      if (staticData) {
        const spritePath = activeMon.isShiny === 1
          ? staticData.backShinySprite || staticData.backSprite
          : staticData.backSprite || staticData.frontSprite;
        this.pkmnTextureKey = `pkmn_${activeMon.species}_${activeMon.isShiny}`;
        this.load.image(this.pkmnTextureKey, spritePath);

        if (staticData.cry) {
          this.cryKey = `cry_${activeMon.species}`;
          this.load.audio(this.cryKey, staticData.cry);
        }
      }
    }

    // 2. Preload Enemy Pokémon & Cry
    const enemyMon = window.GameStateManager ? window.GameStateManager.opponentPartyMon1 : null;
    if (enemyMon && typeof PokemonDatabase !== 'undefined') {
      const speciesKey = enemyMon.species;
      const cleanSpecies = speciesKey.replace('SPECIES_', '').replace(/_[MF]$/, '').toLowerCase();
      
      const dbKey = Object.keys(PokemonDatabase).find(k => {
        const kClean = k.replace('SPECIES_', '').replace(/_[mf]$/, '').toLowerCase();
        return kClean === cleanSpecies || k.toLowerCase() === speciesKey.toLowerCase();
      });

      const enemyStatic = dbKey ? PokemonDatabase[dbKey] : null;
      if (enemyStatic) {
        const isShiny = enemyMon.isShiny || 0;
        const enemySpritePath = isShiny === 1
          ? enemyStatic.frontShinySprite || enemyStatic.frontSprite
          : enemyStatic.frontSprite || enemyStatic.frontShinySprite;
          
        this.enemyPkmnTextureKey = `pkmn_${speciesKey}_${isShiny}_front`;
        this.load.image(this.enemyPkmnTextureKey, enemySpritePath);

        if (enemyStatic.cry) {
          this.enemyCryKey = `cry_${speciesKey}`;
          this.load.audio(this.enemyCryKey, enemyStatic.cry);
        }
      }
    }
  } 

  create() {
    removeSpriteBackground(this, 'pokeball_raw', 16, 16);
    removeSpriteBackground(this, 'sparkle_raw', 32, 32);

    if (this.sound.context && this.sound.context.state === 'suspended') {
      const unlockAudio = () => {
        this.sound.context.resume().then(() => {
          this.input.off('pointerdown', unlockAudio);
          this.input.off('keydown', unlockAudio);
        });
      };
      this.input.on('pointerdown', unlockAudio);
      this.input.on('keydown', unlockAudio);
    }

    if (this.textures.exists('latin_short') && !this.textures.exists('emerald_font')) {
      const sourceImage = this.textures.get('latin_short').getSourceImage();
      const canvasTex = this.textures.createCanvas('emerald_font', sourceImage.width, sourceImage.height);
      canvasTex.draw(0, 0, sourceImage);

      const ctx = canvasTex.context;
      const imgData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
      const data = imgData.data;

      const bgR = data[0], bgG = data[1], bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if ((r === bgR && g === bgG && b === bgB) || (r >= 245 && g >= 245 && b >= 245)) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      canvasTex.refresh();

      let frameIndex = 0;
      for (let y = 0; y < sourceImage.height; y += 16) {
        for (let x = 0; x < sourceImage.width; x += 8) {
          canvasTex.add(frameIndex, 0, x, y, 8, 16);
          frameIndex++;
        }
      }
    }

    this.enemyData = window.GameStateManager && typeof window.GameStateManager.getEnemyData === 'function'
      ? window.GameStateManager.getEnemyData()
      : { name: 'PORTIA', level: 5, pokemon: [{ level: 5 }] };

    if (typeof EmeraldFont !== 'undefined') {
      this.fontRenderer = new EmeraldFont(this);
    }

    // 640x480 Widescreen/Boxed Battle Background
    this.add.rectangle(320, 180, 640, 360, 0x88d8b0);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // --- ADDED: POSITION EDITOR KEYS & STATE ---
    this.selectedTarget = 'player'; // 'player' or 'enemy'
    this.tfghKeys = this.input.keyboard.addKeys({
      t: Phaser.Input.Keyboard.KeyCodes.T, // Up
      f: Phaser.Input.Keyboard.KeyCodes.F, // Left
      g: Phaser.Input.Keyboard.KeyCodes.G, // Down
      h: Phaser.Input.Keyboard.KeyCodes.H, // Right
      y: Phaser.Input.Keyboard.KeyCodes.Y  // Switch focus target
    });
    console.log('[CoordEditor] Position Editor Active! Press "Y" to switch focus between Player and Enemy. Use T, F, G, H to nudge coordinates.');

    this.time.delayedCall(1000, () => {
      this.startFlashingPokeballTransition();
    });
  }

  update() {
    this.handleMenuInput();
    this.handleCoordinateEditor(); // --- ADDED: EDITOR UPDATE LOOP ---
  }

  // --- UPDATED: Smooth Continuous Hold & Nudge Editor ---
  handleCoordinateEditor() {
    if (!this.tfghKeys) return;

    if (Phaser.Input.Keyboard.JustDown(this.tfghKeys.y)) {
      this.selectedTarget = this.selectedTarget === 'player' ? 'enemy' : 'player';
      console.log(`[CoordEditor] 🔄 Switched focus to: ${this.selectedTarget.toUpperCase()} POKÉMON`);
    }

    const activeSprite = this.selectedTarget === 'player' ? this.playerSpriteRef : this.enemySpriteRef;
    if (!activeSprite) return;

    let moved = false;
    const speed = 2; // Speed of movement when holding down keys

    if (this.tfghKeys.t.isDown) { activeSprite.y -= speed; moved = true; }
    if (this.tfghKeys.g.isDown) { activeSprite.y += speed; moved = true; }
    if (this.tfghKeys.f.isDown) { activeSprite.x -= speed; moved = true; }
    if (this.tfghKeys.h.isDown) { activeSprite.x += speed; moved = true; }

    // Throttle the log so it doesn't spam the console too fast per frame, but updates smoothly
    if (moved) {
      if (!this._lastLogTime || this.time.now - this._lastLogTime > 150) {
        console.log(`[CoordEditor] 📍 ${this.selectedTarget.toUpperCase()} Position -> x: ${activeSprite.x}, y: ${activeSprite.y}`);
        this._lastLogTime = this.time.now;
      }
    }
  }

  handleMenuInput() {
    if (!this.menuActive) return;

    const justUp = (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) || (this.wasd.up && Phaser.Input.Keyboard.JustDown(this.wasd.up));
    const justDown = (this.cursors.down && Phaser.Input.Keyboard.JustDown(this.cursors.down)) || (this.wasd.down && Phaser.Input.Keyboard.JustDown(this.wasd.down));
    const justLeft = (this.cursors.left && Phaser.Input.Keyboard.JustDown(this.cursors.left)) || (this.wasd.left && Phaser.Input.Keyboard.JustDown(this.wasd.left));
    const justRight = (this.cursors.right && Phaser.Input.Keyboard.JustDown(this.cursors.right)) || (this.wasd.right && Phaser.Input.Keyboard.JustDown(this.wasd.right));
    const justEnter = (this.wasd.enter && Phaser.Input.Keyboard.JustDown(this.wasd.enter)) || Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)) || Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z));

    if (justEnter) {
      this.menuConfirmed = !this.menuConfirmed;
      this.redrawMenuButtons(true);
      if (this.menuConfirmed) {
        this.handleMenuSelection();
      }
      return;
    }

    let previousIndex = this.selectedMenuIndex;
    if (justUp) { if (this.selectedMenuIndex >= 2) this.selectedMenuIndex -= 2; }
    else if (justDown) { if (this.selectedMenuIndex < 2) this.selectedMenuIndex += 2; }
    else if (justLeft) { if (this.selectedMenuIndex % 2 === 1) this.selectedMenuIndex -= 1; }
    else if (justRight) { if (this.selectedMenuIndex % 2 === 0) this.selectedMenuIndex += 1; }

    if (previousIndex !== this.selectedMenuIndex) {
      this.menuConfirmed = false;
      this.redrawMenuButtons(true);
    }
  }

  startFlashingPokeballTransition() {
    this.flashBg = this.add.rectangle(320, 240, 640, 480, 0x000000).setDepth(20);

    const pokeballExists = this.textures.exists('pokeball_transition') && this.textures.get('pokeball_transition').key !== '__MISSING';
    this.pokeballIcon = pokeballExists
      ? this.add.image(320, 240, 'pokeball_transition').setDepth(21).setScale(0.3)
      : this.add.circle(320, 240, 40, 0xffffff).setDepth(21);

    this.tweens.add({
      targets: this.pokeballIcon,
      angle: 360,
      scale: 0.05,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.pokeballIcon.destroy();
        this.flashBg.destroy();
        this.startTrainerSlide();
      },
    });

    for (let i = 1; i <= 5; i++) {
      this.time.delayedCall(i * 200, () => {
        if (this.flashBg && this.flashBg.active) {
          this.flashBg.setFillStyle(i % 2 === 1 ? 0xffffff : 0x000000);
        }
      });
    }
  }

  startTrainerSlide() {
    this.setupBattleUIElements();

    const portiaY = 120;
    const brendanY = 250;

    const enemyExists = this.textures.exists('portia') && this.textures.get('portia').key !== '__MISSING';
    const portiaKey = enemyExists ? removeSpriteBackground(this, 'portia') : 'portia';

    const brendanExists = this.textures.exists('brendan') && this.textures.get('brendan').key !== '__MISSING';
    const brendanKey = brendanExists ? removeSpriteBackground(this, 'brendan', 64, 64) : 'brendan';

    const enemySprite = enemyExists
      ? this.add.image(-100, portiaY, portiaKey).setDepth(15).setScale(3)
      : this.add.rectangle(-100, portiaY, 96, 96, 0x9b59b6).setDepth(15);

    const brendan = brendanExists
      ? this.add.sprite(740, brendanY, brendanKey, 0).setDepth(15).setScale(3)
      : this.add.rectangle(740, brendanY, 96, 96, 0x3498db).setDepth(15);

    this.tweens.add({
      targets: enemySprite,
      x: 520,
      duration: 1500,
      ease: 'Cubic.easeOut',
    });

    this.tweens.add({
      targets: brendan,
      x: 160,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: enemySprite,
          x: 740,
          duration: 600,
          ease: 'Power2',
          onComplete: () => {
            enemySprite.destroy();

            this.spawnEnemyPokemon(() => {
              if (!brendanExists) return;

              this.time.delayedCall(150, () => {
                brendan.setFrame(1);
                this.time.delayedCall(200, () => {
                  brendan.setFrame(2);
                  this.time.delayedCall(200, () => {
                    brendan.setFrame(3);
                    this.spawnPlayerPokemon();

                    this.tweens.add({
                      targets: brendan,
                      x: -100,
                      duration: 900,
                      ease: 'Power2',
                    });
                  });
                });
              });
            });
          },
        });
      },
    });
  }

  spawnEnemyPokemon(callback) {
    const activeEnemyMon = window.GameStateManager && window.GameStateManager.opponentPartyMon1;
    if (!activeEnemyMon || !activeEnemyMon.species) {
      if (typeof callback === 'function') callback();
      return;
    }

    const speciesKey = activeEnemyMon.species;
    const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase;

    if (!db) {
      if (typeof callback === 'function') callback();
      return;
    }

    const cleanSpecies = speciesKey.replace('SPECIES_', '').replace(/_[MF]$/, '').toLowerCase();
    const foundDbKey = Object.keys(db).find(k => {
      const kClean = k.replace('SPECIES_', '').replace(/_[mf]$/, '').toLowerCase();
      return kClean === cleanSpecies || k.toLowerCase() === speciesKey.toLowerCase();
    });

    let staticData = foundDbKey ? db[foundDbKey] : null;
    if (!staticData) {
      staticData = Object.values(db).find(entry => entry && entry.name && entry.name.toLowerCase() === cleanSpecies);
    }

    if (!staticData) {
      if (typeof callback === 'function') callback();
      return;
    }

    const frontSpritePath = staticData.frontSprite;
    const frontTextureKey = `pkmn_${speciesKey}_front`;
    const cryKey = `cry_${speciesKey}`;
    
    const xPos = staticData.xPos !== undefined ? staticData.xPos : 480;
    const yPos = staticData.yPos !== undefined ? staticData.yPos : 150;
    const cryPath = staticData.cry;

    const needsFront = !this.textures.exists(frontTextureKey);

    const finishSpawn = () => {
      const transKey = removeSpriteBackground(this, frontTextureKey, 0, 0);
      this.executeEnemyThrow(transKey, { xPos, yPos }, cryKey, callback);
    };

    if (needsFront) {
      if (frontSpritePath) this.load.image(frontTextureKey, frontSpritePath);
      if (cryPath && !this.cache.audio.exists(cryKey)) this.load.audio(cryKey, cryPath);

      this.load.once('complete', finishSpawn);
      this.load.start();
    } else {
      finishSpawn();
    }
  }
 
  executeEnemyThrow(textureKey, staticData, cryKey, callback) {
    const ballKey = this.textures.exists('pokeball_raw_trans') ? 'pokeball_raw_trans' : 'pokeball_raw';
    const sparkleKey = this.textures.exists('sparkle_raw_trans') ? 'sparkle_raw_trans' : 'sparkle_raw';

    const ball = this.add.sprite(520, 120, ballKey, 0).setDepth(20).setScale(3);

    this.tweens.add({
      targets: ball,
      x: staticData.xPos,
      y: staticData.yPos - 20,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ball.destroy();
        
        // --- ADDED: Save reference to enemy sprite for coordinate editing ---
        this.enemySpriteRef = this.add.image(staticData.xPos, staticData.yPos, textureKey).setDepth(4);

        const sparkle = this.add.sprite(staticData.xPos, staticData.yPos, sparkleKey, 0).setDepth(25).setScale(5);
        const sparkleAnimKey = 'sparkle_anim_enemy';
        if (!this.anims.exists(sparkleAnimKey)) {
          this.anims.create({
            key: sparkleAnimKey,
            frames: this.anims.generateFrameNumbers(sparkleKey, { start: 0, end: 5 }),
            frameRate: 20,
            repeat: 0
          });
        }
        sparkle.play(sparkleAnimKey);
        sparkle.on('animationcomplete', () => sparkle.destroy());

        try {
          if (this.sound.context && this.sound.context.state === 'suspended') this.sound.context.resume();
          if (cryKey && this.cache.audio.exists(cryKey)) {
            const soundInstance = this.sound.add(cryKey);
            soundInstance.once('complete', () => { if (typeof callback === 'function') callback(); });
            soundInstance.play();
          } else {
            if (typeof callback === 'function') callback();
          }
        } catch (e) {
          if (typeof callback === 'function') callback();
        }
      }
    });

    this.tweens.add({ targets: ball, angle: -360 * 2, duration: 400, ease: 'Linear' });
  }

  spawnPlayerPokemon() {
    const activeMon = window.GameStateManager && window.GameStateManager.playerPartyMon1;
    if (!activeMon || !activeMon.species) return;

    const speciesKey = activeMon.species;
    const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase;
    let staticData = db[speciesKey];

    if (!staticData) {
      const cleanSpecies = speciesKey.replace('SPECIES_', '').toLowerCase();
      const foundKey = Object.keys(db).find(k => k.toLowerCase() === speciesKey.toLowerCase() || k.toLowerCase().replace('species_', '') === cleanSpecies);
      staticData = foundKey ? db[foundKey] : Object.values(db).find(entry => entry && entry.name && entry.name.toLowerCase() === cleanSpecies);
    }

    if (!staticData) return;

    const isShiny = activeMon.isShiny === 1;
    const spritePath = isShiny 
      ? (staticData.backShinySprite || staticData.backSprite || staticData.frontSprite) 
      : (staticData.backSprite || staticData.backShinySprite || staticData.frontSprite);

    const cryPath = staticData.cry;
    const xPos = staticData.xPos !== undefined ? staticData.xPos : 180;
    const yPos = staticData.yPos !== undefined ? staticData.yPos : 300;

    const textureKey = `pkmn_${speciesKey}_${activeMon.isShiny || 0}_back`;
    const cryKey = `cry_${speciesKey}`;

    if (!this.textures.exists(textureKey)) {
      this.load.image(textureKey, spritePath);
      if (cryPath && !this.cache.audio.exists(cryKey)) this.load.audio(cryKey, cryPath);

      this.load.start();
      this.load.once('complete', () => {
        const transKey = removeSpriteBackground(this, textureKey);
        this.executePlayerThrow(transKey, { xPos, yPos }, cryKey);
      });
    } else {
      const transKey = removeSpriteBackground(this, textureKey);
      this.executePlayerThrow(transKey, { xPos, yPos }, cryKey);
    }
  }

  executePlayerThrow(textureKey, staticData, cryKey) {
    const pokeSprite = this.add.image(staticData.xPos, staticData.yPos, textureKey).setDepth(4).setVisible(false).setScale(0.1, 1.5);

    // --- ADDED: Save reference to player sprite for coordinate editing ---
    this.playerSpriteRef = pokeSprite;

    if (typeof ThrowPokeBallAnim !== 'undefined') {
      const throwAnim = new ThrowPokeBallAnim(this, window.GameStateManager.playerPartyMon1);
      throwAnim.startThrowAnimation(() => {
        pokeSprite.setVisible(true);

        if (cryKey && this.cache.audio.exists(cryKey)) this.sound.add(cryKey).play();

        this.tweens.add({
          targets: pokeSprite,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.menuActive = true;
            this.redrawMenuButtons(true);
          },
        });
      });
    } else {
      pokeSprite.setVisible(true).setScale(1);
      if (cryKey && this.cache.audio.exists(cryKey)) this.sound.add(cryKey).play();
      this.menuActive = true;
      this.redrawMenuButtons(true);
    }
  }

  setupBattleUIElements() {
    this.add.rectangle(320, 477, 636, 6, 0x3b3a32).setDepth(10);
    this.add.rectangle(320, 420, 632, 112, 0x5a554a).setDepth(10);
    this.add.rectangle(10, 420, 6, 108, 0x8c7355).setDepth(10);
    this.add.rectangle(630, 420, 6, 108, 0x8c7355).setDepth(10);
    this.add.rectangle(320, 415, 616, 96, 0xffffff).setDepth(10);

    this.menuGfx = this.add.graphics().setDepth(11);

    if (this.fontRenderer) {
      const rawDialogue = 'What will\n$activePlayerName do?';
      const formattedDialogue = window.GameStateManager.parseText(rawDialogue);

      this.fontRenderer.print(40, 385, formattedDialogue, 24); 

      this.fontRenderer.print(400, 375, 'FIGHT', 20);
      this.fontRenderer.print(530, 375, 'BAG', 20);
      this.fontRenderer.print(400, 430, 'PARTY', 20);
      this.fontRenderer.print(530, 430, 'RUN', 20);
    }

    this.selectedMenuIndex = 0;
    this.redrawMenuButtons(false);
  }

  redrawMenuButtons(drawDot = true) {
    if (!this.menuGfx) return;
    this.menuGfx.clear();

    const buttons = [
      { x: 375, y: 368, w: 110, h: 42, normal: 0xd9381e, active: 0xff5722, border: 0x4a0e04, dotX: 390, dotY: 389 },
      { x: 500, y: 368, w: 110, h: 42, normal: 0x2196f3, active: 0x4fc3f7, border: 0x0a233b, dotX: 515, dotY: 389 },
      { x: 375, y: 420, w: 110, h: 42, normal: 0x9c27b0, active: 0xba68c8, border: 0x24062e, dotX: 390, dotY: 441 },
      { x: 500, y: 420, w: 110, h: 42, normal: 0xffeb3b, active: 0xfff59d, border: 0x3b3002, dotX: 515, dotY: 441 },
    ];

    buttons.forEach((btn, index) => {
      const isSelected = index === this.selectedMenuIndex && drawDot;
      const fillColor = isSelected ? btn.active : btn.normal;

      this.menuGfx.lineStyle(3, btn.border, 1);
      this.menuGfx.strokeRoundedRect(btn.x, btn.y, btn.w, btn.h, 10);

      this.menuGfx.fillStyle(fillColor, 1);
      this.menuGfx.fillRoundedRect(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4, 8);

      this.menuGfx.fillStyle(0xffffff, isSelected ? 0.45 : 0.25);
      this.menuGfx.fillRoundedRect(btn.x + 4, btn.y + 4, btn.w - 8, 10, { tl: 8, tr: 8, bl: 0, br: 0 });
    });

    if (drawDot) {
      const activeDot = buttons[this.selectedMenuIndex];
      const dotColor = this.menuConfirmed ? 0x55ff55 : 0x686868;

      this.menuGfx.fillStyle(dotColor, 1);
      this.menuGfx.beginPath();
      this.menuGfx.arc(activeDot.dotX, activeDot.dotY, 5, 0, Math.PI * 2);
      this.menuGfx.fillPath();

      this.menuGfx.lineStyle(2, 0x000000, 1);
      this.menuGfx.beginPath();
      this.menuGfx.arc(activeDot.dotX, activeDot.dotY, 5, 0, Math.PI * 2);
      this.menuGfx.strokePath();
    }
  }

  handleMenuSelection() {
    switch (this.selectedMenuIndex) {
      case 0: if (typeof this.fightSelected === 'function') this.fightSelected(); break;
      case 1: if (typeof this.bagSelected === 'function') this.bagSelected(); break;
      case 2: if (typeof this.partySelected === 'function') this.partySelected(); break;
      case 3: if (typeof this.runSelected === 'function') this.runSelected(); break;
    }
  }
}