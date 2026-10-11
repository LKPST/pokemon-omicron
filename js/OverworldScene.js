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
    // Inside OverworldScene preload()
    this.load.spritesheet('lily_ow', 'graphics/overworld/lily.png', {
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
    console.group("[Diagnostics] 🗺️ === OVERWORLD MAP EVENTS AUDIT ===");
    
    // 1. Inspect map data source
    const mapKey = this.currentMapKey || "Criscanto Town";
    const mapData = window.OverworldMaps ? window.OverworldMaps[mapKey] : null;
    
    console.log(`[Diagnostics] Target Map Key: "${mapKey}"`, mapData);

    if (!mapData) {
      console.error(`[Diagnostics] ❌ CRITICAL: Map data for "${mapKey}" is undefined or not found in window.OverworldMaps!`);
      console.groupEnd();
      return;
    }

    const events = mapData.events;
    if (!events) {
      console.error("[Diagnostics] ❌ CRITICAL: 'events' property is missing entirely from mapData!", mapData);
      console.groupEnd();
      return;
    }

    // 2. Log all found event keys raw from the map object
    const rawEventKeys = Object.keys(events);
    console.log(`[Diagnostics] 📋 Total raw event keys found in map object: ${rawEventKeys.length}`, rawEventKeys);

    this.npcs = [];
    const blockSize = mapData.dimensions.blockSize || 8;
    const successfullySpawned = [];
    const failedEvents = [];

    // 3. Evaluate each event individually
    for (const [key, eventData] of Object.entries(events)) {
      console.group(`[Diagnostics] Evaluating Event: "${key}"`);
      console.log("Event Data Object:", eventData);

      if (!eventData.eventType) {
        console.warn(`[Diagnostics] ⚠️ FAILED: Missing 'eventType' property.`);
        failedEvents.push({ key, reason: "Missing eventType" });
        console.groupEnd();
        continue;
      }

      if (eventData.eventType === 'NPC') {
        const owID = eventData.owID;
        console.log(`[Diagnostics] Detected NPC Event with owID: "${owID}"`);

        if (!owID) {
          console.warn(`[Diagnostics] ❌ FAILED: NPC event is missing 'owID'.`);
          failedEvents.push({ key, reason: "Missing owID" });
          console.groupEnd();
          continue;
        }

        const tableEntry = window.OverworldTable ? window.OverworldTable[owID] : null;
        console.log(`[Diagnostics] Table Entry lookup in window.OverworldTable["${owID}"]:`, tableEntry);

        if (!tableEntry) {
          console.error(`[Diagnostics] ❌ FAILED: owID "${owID}" does not exist in window.OverworldTable!`);
          failedEvents.push({ key, reason: `owID "${owID}" missing from OverworldTable` });
          console.groupEnd();
          continue;
        }

        const textureKey = tableEntry.spriteID || `${owID.toLowerCase()}_ow`;
        const textureExists = this.textures.exists(textureKey);
        console.log(`[Diagnostics] Texture Key check "${textureKey}": Exists = ${textureExists}`);

        if (!textureExists) {
          console.error(`[Diagnostics] ❌ FAILED: Texture "${textureKey}" is not loaded in Phaser TextureManager.`);
          failedEvents.push({ key, reason: `Texture "${textureKey}" not loaded` });
          console.groupEnd();
          continue;
        }

        // Spawn calculation
        const x = eventData.xPos * blockSize + blockSize / 2;
        const y = eventData.yPos * blockSize + blockSize / 2;

        const npcSprite = this.add
          .sprite(x, y, textureKey, 0)
          .setOrigin(0.5, 0.85)
          .setScale(0.5);

        npcSprite.direction = 'down';
        npcSprite.eventConfig = eventData;
        this.npcs.push(npcSprite);

        console.log(`[Diagnostics] ✅ SUCCESS: Spawned NPC "${owID}" at grid (${eventData.xPos}, ${eventData.yPos}) -> world coords (${x}, ${y})`);
        successfullySpawned.push({ key, owID });
      } else {
        console.log(`[Diagnostics] ℹ️ Skipped non-NPC eventType: "${eventData.eventType}"`);
      }

      console.groupEnd();
    }

    // 4. Final summary block
    console.log("--------------------------------------------------AVE SUMMARY--------------------------------------------------");
    console.log(`[Diagnostics] 🟢 Successfully Spawned (${successfullySpawned.length}):`, successfullySpawned);
    console.log(`[Diagnostics] 🔴 Failed / Skipped (${failedEvents.length}):`, failedEvents);
    console.groupEnd();
  }

  updateNPCMovement() {
    if (this.isLocked || !this.npcs || this.npcs.length === 0) return;

    // Loop through all NPCs and apply movement if their config allows it
    this.npcs.forEach(npc => {
      const config = npc.eventConfig;
      if (!config || config.movementType !== 'wander_left_right') return;

      const moveTypes = ['walk_left', 'walk_right'];
      const chosenMove = Phaser.Math.RND.pick(moveTypes);

      console.log(`[Logger] NPC Movement triggered for ${config.owID}: ${chosenMove}`);
      if (window.OverworldMovement) {
        window.OverworldMovement.execute(npc, chosenMove);
      }
    });
  }

  update(time, delta) {
    if (this.isLocked) return;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryInteract();
      return;
    }

    // --- CRITICAL FIX: Depth Sorting by Y ---
    if (this.player && this.npcs) {
      this.player.setDepth(this.player.y);
      this.npcs.forEach(npc => npc.setDepth(npc.y));
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
          // --- FIX: Guard or remove this.activeNPC references in collision bump ---
          const stepCycle = Math.floor(time / 150) % 2 === 0 ? 1 : 2;
          const frameIndex = window.getOverworldFrame(newDir, stepCycle);
          this.player.setFrame(frameIndex);
          console.log(
            `[Logger] Collision Bump! Dir: ${newDir}, Frame: ${frameIndex}, Player Y: ${this.player.y}`
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

    const blockSize = this.currentMap.dimensions.blockSize;

    // Check if player occupies the target tile (using Math.round to prevent float drift)
    if (this.player) {
      const playerGridX = Math.round((this.player.x - blockSize / 2) / blockSize);
      const playerGridY = Math.round((this.player.y - blockSize / 2) / blockSize);
      if (playerGridX === gridX && playerGridY === gridY) {
        return false;
      }
    }

    // Check if any NPC occupies the target tile (using Math.round)
    if (this.npcs) {
      for (const npc of this.npcs) {
        const npcGridX = Math.round((npc.x - blockSize / 2) / blockSize);
        const npcGridY = Math.round((npc.y - blockSize / 2) / blockSize);
        if (npcGridX === gridX && npcGridY === gridY) {
          return false;
        }
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

    // --- FIX: Removed reference to this.activeNPC.y ---
    console.log(
      `[Logger] Moving player to grid (${targetX}, ${targetY}) | Player Y: ${this.player.y}`
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
    if (!this.npcs || this.npcs.length === 0) return;

    const blockSize = this.currentMap.dimensions.blockSize;
    const playerGridX = Math.round((this.player.x - blockSize / 2) / blockSize);
    const playerGridY = Math.round((this.player.y - blockSize / 2) / blockSize);

    let targetX = playerGridX;
    let targetY = playerGridY;
    if (this.player.direction === 'up') targetY -= 1;
    else if (this.player.direction === 'down') targetY += 1;
    else if (this.player.direction === 'left') targetX -= 1;
    else if (this.player.direction === 'right') targetX += 1;

    const targetNPC = this.npcs.find(npc => {
      const npcGridX = Math.round((npc.x - blockSize / 2) / blockSize);
      const npcGridY = Math.round((npc.y - blockSize / 2) / blockSize);
      return npcGridX === targetX && npcGridY === targetY;
    });

    if (targetNPC) {
      this.activeNPC = targetNPC;
      const scriptName = targetNPC.eventConfig.script;
      console.log(`[Logger] Triggering script for ${targetNPC.eventConfig.owID}: ${scriptName}`);

      if (window.OverworldScriptEngine) {
        window.OverworldScriptEngine.runScript(this, scriptName);
      } else {
        console.error('[Logger] FATAL: OverworldScriptEngine not found globally!');
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
