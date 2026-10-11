class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene');
    this.isLocked = false;
    this.activeNPC = null;
    this.player = null;
    this.playerGridX = 1;
    this.playerGridY = 1;
    this.isMoving = false;
  }

  preload() {
    // Safely call parent preload without context errors
    BaseScene.prototype.preload.call(this);

    // Load overworld specific assets
    this.load.spritesheet('brendan_ow', 'graphics/overworld/brendan.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.spritesheet('portia_ow', 'graphics/overworld/portia.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create() {
    console.log('[Logger] OverworldScene: create started');
    const mapData = window.OverworldMaps['Criscanto Town'];
    if (!mapData) {
      console.error('[Logger] FATAL: Criscanto Town map data not found!');
      return;
    }

    this.currentMap = mapData;

    this.renderMapGrid();
    this.spawnPlayer();
    this.spawnEvents();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Setup periodic NPC movement timer
    this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        this.updateNPCMovement();
      },
    });

    console.log('[Logger] OverworldScene: initialization complete.');
  }

  renderMapGrid() {
    if (!this.textures.exists('tile_floor')) {
      this.generateTileTextures();
    }

    const blockData = this.currentMap.blockData;
    const blockSize = this.currentMap.dimensions.blockSize;

    for (let row = 0; row < blockData.length; row++) {
      for (let col = 0; col < blockData[row].length; col++) {
        const tileType = blockData[row][col];
        let textureKey = 'tile_floor';
        if (tileType === 1) textureKey = 'tile_grass';
        if (tileType === 2) textureKey = 'tile_wall';

        const x = col * blockSize + blockSize / 2;
        const y = row * blockSize + blockSize / 2;

        this.add.image(x, y, textureKey).setDepth(-100); // Set background deep in the back
      }
    }
  }

  generateTileTextures() {
    const size = 8;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    graphics.clear();
    graphics.fillStyle(0x78c850, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture('tile_floor', size, size);

    graphics.clear();
    graphics.fillStyle(0x55aa77, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture('tile_grass', size, size);

    graphics.clear();
    graphics.fillStyle(0x88d8b0, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture('tile_wall', size, size);

    graphics.destroy();
  }

  spawnPlayer() {
    this.playerGridX = 1;
    this.playerGridY = 1;
    const blockSize = this.currentMap.dimensions.blockSize;

    const px = this.playerGridX * blockSize + blockSize / 2;
    const py = this.playerGridY * blockSize + blockSize / 2;

    this.player = this.add
      .sprite(px, py, 'brendan_ow', 0)
      .setOrigin(0.5, 0.85)
      .setScale(0.5);

    this.player.direction = 'down';
    console.log('[Logger] Player spawned at:', px, py);
  }

  spawnEvents() {
    const events = this.currentMap.events;
    const blockSize = this.currentMap.dimensions.blockSize;

    for (const key in events) {
      const eventData = events[key];
      if (eventData.eventType === 'NPC') {
        const x = eventData.xPos * blockSize + blockSize / 2;
        const y = eventData.yPos * blockSize + blockSize / 2;

        const npcSprite = this.add
          .sprite(x, y, 'portia_ow', 0)
          .setOrigin(0.5, 0.85)
          .setScale(0.5);

        npcSprite.direction = 'down';
        npcSprite.eventConfig = eventData;
        this.activeNPC = npcSprite;

        console.log(
          `[Logger] NPC ${eventData.owID} spawned at grid (${eventData.xPos}, ${eventData.yPos}) -> world (${x}, ${y})`
        );
      }
    }
  }

  updateNPCMovement() {
    if (this.isLocked || !this.activeNPC) return;

    const config = this.activeNPC.eventConfig;
    if (!config || config.movementType !== 'wander_left_right') return;

    const moveTypes = ['walk_left', 'walk_right'];
    const chosenMove = Phaser.Math.RND.pick(moveTypes);

    console.log(`[Logger] NPC Movement triggered for Portia: ${chosenMove}`);
    if (window.OverworldMovement) {
      window.OverworldMovement.execute(this.activeNPC, chosenMove);
    }
  }

  update(time, delta) {
    if (this.isLocked) return;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryInteract();
      return;
    }

    // --- CRITICAL FIX: Depth Sorting by Y ---
    if (this.player && this.activeNPC) {
      this.player.setDepth(this.player.y);
      this.activeNPC.setDepth(this.activeNPC.y);
    }

    if (!this.isMoving) {
      let dx = 0;
      let dy = 0;
      let newDir = this.player.direction;

      if (this.cursors.left.isDown) {
        dx = -1;
        newDir = 'left';
      } else if (this.cursors.right.isDown) {
        dx = 1;
        newDir = 'right';
      } else if (this.cursors.up.isDown) {
        dy = -1;
        newDir = 'up';
      } else if (this.cursors.down.isDown) {
        dy = 1;
        newDir = 'down';
      }

      this.player.direction = newDir;

      if (dx !== 0 || dy !== 0) {
        const targetGridX = this.playerGridX + dx;
        const targetGridY = this.playerGridY + dy;

        if (this.isPassable(targetGridX, targetGridY)) {
          this.movePlayerTo(targetGridX, targetGridY, newDir);
        } else {
          // --- CRITICAL FIX: Force continuous stepping frame when key is held down against collision ---
          const stepCycle = Math.floor(time / 150) % 2 === 0 ? 1 : 2;
          const frameIndex = window.getOverworldFrame(newDir, stepCycle);
          this.player.setFrame(frameIndex);
          console.log(
            `[Logger] Collision Bump! Dir: ${newDir}, Frame: ${frameIndex}, Player Y: ${this.player.y}, NPC Y: ${this.activeNPC.y}`
          );
        }
      } else {
        this.player.setFrame(window.getOverworldFrame(newDir, 0));
      }
    }
  }

  isPassable(gridX, gridY) {
    const blockData = this.currentMap.blockData;
    if (
      gridY < 0 ||
      gridY >= blockData.length ||
      gridX < 0 ||
      gridX >= blockData[0].length
    ) {
      return false;
    }
    // Solid building walls
    if (blockData[gridY][gridX] === 2) return false;

    // Check if player occupies the target tile
    if (this.player) {
      const blockSize = this.currentMap.dimensions.blockSize;
      const playerGridX = Math.floor(this.player.x / blockSize);
      const playerGridY = Math.floor(this.player.y / blockSize);
      if (playerGridX === gridX && playerGridY === gridY) {
        return false; // Blocked by player!
      }
    }

    // Check if another NPC occupies the target tile
    if (this.activeNPC) {
      const blockSize = this.currentMap.dimensions.blockSize;
      const npcGridX = Math.floor(this.activeNPC.x / blockSize);
      const npcGridY = Math.floor(this.activeNPC.y / blockSize);
      if (npcGridX === gridX && npcGridY === gridY) {
        return false;
      }
    }

    return true;
  }

  movePlayerTo(targetX, targetY, direction) {
    this.isMoving = true;
    const blockSize = this.currentMap.dimensions.blockSize;

    const destX = targetX * blockSize + blockSize / 2;
    const destY = targetY * blockSize + blockSize / 2;

    this.walkStep = this.walkStep === 1 ? 2 : 1;
    this.player.setFrame(window.getOverworldFrame(direction, this.walkStep));

    console.log(
      `[Logger] Moving player to grid (${targetX}, ${targetY}) | Player Y: ${this.player.y} vs NPC Y: ${this.activeNPC.y}`
    );

    this.tweens.add({
      targets: this.player,
      x: destX,
      y: destY,
      duration: 150,
      onComplete: () => {
        this.playerGridX = targetX;
        this.playerGridY = targetY;
        this.player.setFrame(window.getOverworldFrame(direction, 0));
        this.isMoving = false;
      },
    });
  }

  tryInteract() {
    if (!this.activeNPC) return;

    // Check grid position to ensure player is directly facing the NPC
    const blockSize = this.currentMap.dimensions.blockSize;
    const playerGridX = Math.floor(this.player.x / blockSize);
    const playerGridY = Math.floor(this.player.y / blockSize);

    const npcGridX = Math.floor(this.activeNPC.x / blockSize);
    const npcGridY = Math.floor(this.activeNPC.y / blockSize);

    // Calculate expected target grid coordinate based on player's facing direction
    let targetX = playerGridX;
    let targetY = playerGridY;
    if (this.player.direction === 'up') targetY -= 1;
    else if (this.player.direction === 'down') targetY += 1;
    else if (this.player.direction === 'left') targetX -= 1;
    else if (this.player.direction === 'right') targetX += 1;

    // Check if the tile the player is facing matches the NPC's position
    const isFacingNPC = targetX === npcGridX && targetY === npcGridY;

    console.log(
      `[Logger] Try Interact: Facing NPC? ${isFacingNPC} (Player Dir: ${this.player.direction})`
    );

    if (isFacingNPC) {
      const scriptName = this.activeNPC.eventConfig.script;
      console.log(`[Logger] Triggering script: ${scriptName}`);

      if (window.OverworldScriptEngine) {
        window.OverworldScriptEngine.runScript(this, scriptName);
      } else {
        console.error(
          '[Logger] FATAL: OverworldScriptEngine not found globally!'
        );
      }
    }
  }

  showDialogueBox(text, callback) {
    console.log("[Logger Dialogue]:", text);

    // 1. UI container locked to screen space (ScrollFactor 0)
    const uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(99999);

    // 2. GBA dialogue box background matching BattleScene styling exactly
    const bgOuterBottom = this.add.rectangle(120, 159, 238, 2, 0x3b3a32);
    const bgMain = this.add.rectangle(120, 137, 236, 46, 0x5a554a);
    const bgBorderLeft = this.add.rectangle(4, 137, 4, 44, 0x8c7355);
    const bgBorderRight = this.add.rectangle(236, 137, 4, 44, 0x8c7355);
    const bgInner = this.add.rectangle(120, 134, 228, 40, 0xffffff);

    uiContainer.add([bgOuterBottom, bgMain, bgBorderLeft, bgBorderRight, bgInner]);

    if (typeof EmeraldFont === 'undefined') {
      console.error("[Logger] EmeraldFont class not found!");
      if (callback) callback();
      return;
    }

    const fontRenderer = new EmeraldFont(this);
    const formattedText = window.GameStateManager && typeof window.GameStateManager.parseText === 'function'
      ? window.GameStateManager.parseText(text)
      : text;

    let currentIndex = 1;
    let currentGlyphImages = [];
    let isTyping = true;

    // Helper to render text incrementally up to the current index
    const renderTextUpTo = (index) => {
      currentGlyphImages.forEach(img => img.destroy());
      currentGlyphImages = [];

      const subText = formattedText.substring(0, index);
      const glyphImages = fontRenderer.print(14, 122, subText, 100000);
      if (glyphImages && glyphImages.length > 0) {
        currentGlyphImages = glyphImages;
        uiContainer.add(glyphImages);
      }
    };

    // Render the first character immediately on start
    renderTextUpTo(currentIndex);

    // Typewriter timer event (adjust delay for typing speed: lower = faster)
    const typeEvent = this.time.addEvent({
      delay: 35,
      repeat: formattedText.length - 1,
      callback: () => {
        currentIndex++;
        renderTextUpTo(currentIndex);
        if (currentIndex >= formattedText.length) {
          isTyping = false;
        }
      }
    });

    // Space key handler (A button)
    const spaceHandler = () => {
      if (isTyping) {
        // If still typing, skip animation and display full text instantly
        typeEvent.remove();
        currentIndex = formattedText.length;
        renderTextUpTo(currentIndex);
        isTyping = false;
      } else {
        // If finished typing, close the box and resume script execution
        this.spaceKey.off('down', spaceHandler);
        uiContainer.destroy();
        if (callback) callback();
      }
    };

    this.time.delayedCall(250, () => {
      this.spaceKey.on('down', spaceHandler);
    });
  }
}
