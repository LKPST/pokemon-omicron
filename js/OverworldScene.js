class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene');
    this.isLocked = false;
    this.activeNPC = null;
    this.player = null;
    this.playerGridX = 1;
    this.playerGridY = 1;
    this.isMoving = false;
    
    this.currentMapKey = window.GameStateManager && window.GameStateManager.saveData && window.GameStateManager.saveData.mapID 
      ? window.GameStateManager.saveData.mapID 
      : Object.keys(window.OverworldMaps)[0];
  }

  preload() {
    BaseScene.prototype.preload.call(this);
    
    // 1. Load all tile assets correctly
    if (window.OverworldTiles) {
      for (const [tID, tileDef] of Object.entries(window.OverworldTiles)) {
        if (!tileDef.tileImage) continue;
        
        if (tileDef.tileType === "Multi-tile" || tileDef.tileType === "Multi-tile Pixel Split") {
          this.load.spritesheet(`tile_sheet_${tID}`, tileDef.tileImage, {
            frameWidth: 16,
            frameHeight: 16,
            margin: 0,
            spacing: 0
          });
        } else if (tileDef.isAnimated && tileDef.frames > 1) {
          this.load.spritesheet(`tile_anim_${tID}`, tileDef.tileImage, {
            frameWidth: 32,
            frameHeight: 32
          });
        } else {
          this.load.image(`tile_img_${tID}`, tileDef.tileImage);
        }
      }
    }

    if (window.OverworldMaps) {
      for (const [mKey, mapData] of Object.entries(window.OverworldMaps)) {
        if (mapData.music) {
          this.load.audio(`map_music_${mapData.music}`, mapData.music);
        }

        // 🌟 2. Correctly check texture existence using this.textures instead of this.load.texture
        if (mapData.events) {
          for (const [eKey, eventData] of Object.entries(mapData.events)) {
            if (eventData.eventType === 'NPC' && eventData.owID && window.OverworldTable) {
              const tableEntry = window.OverworldTable[eventData.owID];
              if (tableEntry && tableEntry.owSprite) {
                const textureKey = tableEntry.spriteID || `${eventData.owID.toLowerCase()}_ow`;
                if (!this.textures.exists(textureKey)) {
                  this.load.spritesheet(textureKey, tableEntry.owSprite, {
                    frameWidth: 32,
                    frameHeight: 48
                  });
                }
              }
            }
          }
        }
      }
    }

    if (window.OverworldTable && window.OverworldTable['Brendan']) {
      const bEntry = window.OverworldTable['Brendan'];
      if (!this.textures.exists('brendan_ow')) {
        this.load.spritesheet('brendan_ow', bEntry.owSprite, {
          frameWidth: 32,
          frameHeight: 48,
        });
      }
    }
  }

  create() {
    this.isMoving = false;
    this.currentMap = window.OverworldMaps[this.currentMapKey];

    if (window.GameStateManager && window.GameStateManager.saveData) {
      window.GameStateManager.saveData.mapID = this.currentMapKey;
      localStorage.setItem('pokemon_micron_save', JSON.stringify(window.GameStateManager.saveData));
    }

    this.updateMapMusic(this.currentMapKey);

    this.renderUnifiedWorld();
    this.spawnPlayer();
    this.spawnAllEvents();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setRoundPixels(true);

    this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        this.updateNPCMovement();
      },
    });
  }

  updateMapMusic(mapKey) {
    const mapData = window.OverworldMaps[mapKey];
    if (!mapData || !mapData.music) return;

    const musicAssetKey = `map_music_${mapData.music}`;
    if (window.currentGlobalMusic && window.currentGlobalMusicPath === mapData.music && window.currentGlobalMusic.isPlaying) {
      return;
    }

    if (window.currentGlobalMusic && window.currentGlobalMusic.isPlaying) {
      window.currentGlobalMusic.stop();
    }

    window.currentGlobalMusicPath = mapData.music;
    if (this.cache.audio.exists(musicAssetKey)) {
      window.currentGlobalMusic = this.sound.add(musicAssetKey, { loop: true, volume: 0.5 });
      window.currentGlobalMusic.play();
    }
  }

  findMapKeyByName(nameOrKey) {
    if (!window.OverworldMaps) return null;
    if (window.OverworldMaps[nameOrKey]) return nameOrKey;
    
    // Normalize spaces and underscores for bulletproof matching
    const normalizedTarget = nameOrKey.replace(/[\s_]/g, '').toLowerCase();

    for (const [key, data] of Object.entries(window.OverworldMaps)) {
      const normalizedKey = key.replace(/[\s_]/g, '').toLowerCase();
      const normalizedMapName = (data.map || '').replace(/[\s_]/g, '').toLowerCase();

      if (normalizedKey === normalizedTarget || normalizedMapName === normalizedTarget) {
        return key;
      }
    }
    return null;
  }

  getMapWorldOffset(targetKey, rootKey = Object.keys(window.OverworldMaps)[0], visited = new Set()) {
    const resolvedTarget = this.findMapKeyByName(targetKey);
    const resolvedRoot = this.findMapKeyByName(rootKey);

    if (!resolvedTarget || !resolvedRoot) return { x: 0, y: 0 };
    if (resolvedTarget === resolvedRoot) return { x: 0, y: 0 };
    if (visited.has(resolvedRoot)) return { x: 0, y: 0 };
    visited.add(resolvedRoot);

    const rootMap = window.OverworldMaps[resolvedRoot];
    if (!rootMap || !rootMap.connections) return { x: 0, y: 0 };

    for (const [dir, connInfo] of Object.entries(rootMap.connections)) {
      if (!connInfo || !connInfo[0]) continue;
      
      const connectedMapKey = this.findMapKeyByName(connInfo[0]);
      const offset = connInfo[2] || 0;
      const connectedMap = connectedMapKey ? window.OverworldMaps[connectedMapKey] : null;
      if (!connectedMap || !connectedMapKey) continue;
      
      let offsetX = 0;
      let offsetY = 0;

      if (dir === 'up') {
        offsetX = offset * 32;
        offsetY = -(connectedMap.dimensions.height * 32);
      } else if (dir === 'down') {
        offsetX = offset * 32;
        offsetY = rootMap.dimensions.height * 32;
      } else if (dir === 'left') {
        offsetX = -(connectedMap.dimensions.width * 32);
        offsetY = offset * 32;
      } else if (dir === 'right') {
        offsetX = rootMap.dimensions.width * 32;
        offsetY = offset * 32;
      }

      if (connectedMapKey === resolvedTarget) {
        return { x: offsetX, y: offsetY };
      }

      const subResult = this.getMapWorldOffset(resolvedTarget, connectedMapKey, visited);
      if (subResult.x !== 0 || subResult.y !== 0 || connectedMapKey === resolvedTarget) {
        return { x: offsetX + subResult.x, y: offsetY + subResult.y };
      }
    }

    return { x: 0, y: 0 };
  }

  renderUnifiedWorld() {
    if (this.mapGroup) {
      this.mapGroup.destroy(true);
    }
    this.mapGroup = this.add.group();

    if (!window.OverworldMaps) return;

    for (const [mapKey, mapData] of Object.entries(window.OverworldMaps)) {
      const resolvedKey = typeof this.findMapKeyByName === 'function' ? this.findMapKeyByName(mapKey) : mapKey;
      const offsetPos = this.getMapWorldOffset(resolvedKey);
      
      console.log(`🗺️ [Unified World Render] Map "${resolvedKey}" -> Rendering at World Offset: x=${offsetPos.x}, y=${offsetPos.y}`);

      // Call renderMapGrid with the explicit offset for this map
      this.renderMapGrid(mapData, offsetPos.x, offsetPos.y);this.renderMapGrid(mapData, offsetPos.x, offsetPos.y, resolvedKey);
    }
  }

  renderMapGrid(mapData, offsetX, offsetY, label = '?') {
    const tileData = mapData.tileData || mapData.blockData || mapData.tiles || mapData.data || mapData.mapMatrix;
    if (!Array.isArray(tileData) || tileData.length === 0) {
      console.warn(`[render] "${label}": no tile grid found. Keys on this map:`, Object.keys(mapData));
      return;
    }
  
    const tileSize = 32;
    const skipped = { noDef: new Set(), noTexture: new Set() };
    let drawn = 0;
  
    for (let row = 0; row < tileData.length; row++) {
      if (!Array.isArray(tileData[row])) continue;
  
      for (let col = 0; col < tileData[row].length; col++) {
        let cellVal = tileData[row][col];
        if (typeof cellVal === 'number') cellVal = `${cellVal}|0`;
        if (typeof cellVal !== 'string') cellVal = '0|0';
  
        const [tIDStr, fIDStr] = cellVal.split('|');
        const tileID = parseInt(tIDStr) || 0;
        const frameID = parseInt(fIDStr) || 0;
  
        const tileDef = window.OverworldTiles && window.OverworldTiles[tileID];
        if (!tileDef) { skipped.noDef.add(tileID); continue; }
  
        let key, frame, depth, scale;
        if (tileDef.tileType === 'Multi-tile' || tileDef.tileType === 'Multi-tile Pixel Split') {
          key = `tile_sheet_${tileID}`;
          frame = Math.min(frameID, (tileDef.frames || 1) - 1);
          depth = -50;  scale = 2;
        } else if (tileDef.isAnimated && tileDef.frames > 1) {
          key = `tile_anim_${tileID}`;
          frame = 0;            // animation comes later
          depth = -200; scale = 1;   // these sheets load as 32x32 frames
        } else {
          key = `tile_img_${tileID}`;
          depth = -200; scale = 2;
        }
  
        if (!this.textures.exists(key)) { skipped.noTexture.add(key); continue; }
  
        const x = Math.round(offsetX + col * tileSize + tileSize / 2);
        const y = Math.round(offsetY + row * tileSize + tileSize / 2);
        const img = this.add.image(x, y, key, frame).setScale(scale).setDepth(depth);
        this.mapGroup.add(img);
        drawn++;
      }
    }
  
    console.log(`[render] "${label}": drew ${drawn} tiles`);
    if (skipped.noDef.size) console.warn(`[render] "${label}": tile IDs missing from OverworldTiles:`, [...skipped.noDef]);
    if (skipped.noTexture.size) console.warn(`[render] "${label}": textures not loaded:`, [...skipped.noTexture]);
  }

  logCurrentTileDetails(gridX, gridY, mapKey = this.currentMapKey) {
    const targetMap = window.OverworldMaps[mapKey];
    if (!targetMap) return;

    const tileData = targetMap.tileData || targetMap.blockData;
    if (!tileData || !tileData[gridY] || tileData[gridY][gridX] === undefined) return;

    let cellVal = tileData[gridY][gridX];
    if (typeof cellVal === 'number') cellVal = `${cellVal}|0`;
    if (typeof cellVal !== 'string') cellVal = "0|0";

    const [tIDStr, fIDStr] = cellVal.split('|');
    const tileID = parseInt(tIDStr) || 0;
    const frameID = parseInt(fIDStr) || 0;

    const tileDef = window.OverworldTiles ? window.OverworldTiles[tileID] : {};
    const colsPerRow = tileDef.columns || 3;
    const col = frameID % colsPerRow;
    const row = Math.floor(frameID / colsPerRow);

    console.group(`🔍 [Tile Inspector] Step Details on Map: "${mapKey}" at Grid (${gridX}, ${gridY})`);
    console.log(`• Tile ID: ${tileID} (${tileDef.tileName || 'Unknown'})`);
    console.log(`• Tile Type: ${tileDef.tileType || 'Normal'}`);
    console.log(`• Sub-Frame Index: ${frameID}`);
    console.log(`• Sheet Column & Row: Col ${col}, Row ${row} (Cols Per Row: ${colsPerRow})`);
    console.log(`• Dimensions: ${tileDef.tileDimension || '32x32'}`);
    console.log(`• Passable: ${tileDef.isPassable !== false ? 'Yes 🟢' : 'No 🔴'}`);
    console.log(`• Raw Cell String: "${cellVal}"`);
    console.groupEnd();
  }

  spawnPlayer() {
    const mapOffset = this.getMapWorldOffset(this.currentMapKey);
    const px = Math.round(mapOffset.x + this.playerGridX * 32 + 16);
    const py = Math.round(mapOffset.y + this.playerGridY * 32 + 16);

    if (!this.player) {
      this.player = this.add.sprite(px, py, 'brendan_ow', 0).setOrigin(0.5, 0.85);
      this.player.direction = 'down';
    } else {
      this.player.setPosition(px, py);
    }
  }

  spawnAllEvents() {
    if (this.npcGroup) {
      this.npcGroup.destroy(true);
    }
    this.npcGroup = this.add.group();
    this.npcs = [];

    for (const [mapKey, mapData] of Object.entries(window.OverworldMaps)) {
      const offsetPos = this.getMapWorldOffset(mapKey);
      this.spawnMapEvents(mapData, mapKey, offsetPos.x, offsetPos.y); // 🌟 Pass mapKey here
    }
  }

  spawnMapEvents(mapData, mapKey, offsetX, offsetY) {
    if (!mapData.events) return;

    for (const [key, eventData] of Object.entries(mapData.events)) {
      if (eventData.eventType === 'NPC' && eventData.owID) {
        const tableEntry = window.OverworldTable[eventData.owID];
        if (!tableEntry) continue;

        const textureKey = tableEntry.spriteID || `${eventData.owID.toLowerCase()}_ow`;
        if (!this.textures.exists(textureKey)) continue;

        const x = Math.round(offsetX + eventData.xPos * 32 + 16);
        const y = Math.round(offsetY + eventData.yPos * 32 + 16);

        const npcSprite = this.add.sprite(x, y, textureKey, 0).setOrigin(0.5, 0.85);
        npcSprite.direction = 'down';
        npcSprite.eventConfig = eventData;
        npcSprite.mapName = mapKey; // 🌟 Store the exact map registry key, not the display name
        npcSprite.setDepth(y);
        
        this.npcs.push(npcSprite);
        this.npcGroup.add(npcSprite);
      }
    }
  }

  updateNPCMovement() {
    if (this.isLocked || !this.npcs || this.npcs.length === 0) return;

    this.npcs.forEach(npc => {
      const config = npc.eventConfig;
      if (!config || config.movementType !== 'MOVEMENT_TYPE_WANDER_LEFT_RIGHT') return;

      const moveTypes = ['walk_left', 'walk_right'];
      const chosenMove = Phaser.Math.RND.pick(moveTypes);

      if (window.OverworldMovement) {
        window.OverworldMovement.execute(npc, chosenMove);
      }
    });
  }

  isPassable(gridX, gridY) {
    const cols = this.currentMap.dimensions.width;
    const rows = this.currentMap.dimensions.height;
    const connections = this.currentMap.connections;

    let targetMap = this.currentMap;
    let targetMapKey = this.currentMapKey;
    let localX = gridX;
    let localY = gridY;

    if (gridY < 0) {
      if (connections && connections.up && window.OverworldMaps[connections.up[0]]) {
        targetMapKey = connections.up[0];
        targetMap = window.OverworldMaps[targetMapKey];
        localX = gridX - connections.up[2];
        localY = targetMap.dimensions.height - 1;
      } else {
        return false;
      }
    } else if (gridY >= rows) {
      if (connections && connections.down && window.OverworldMaps[connections.down[0]]) {
        targetMapKey = connections.down[0];
        targetMap = window.OverworldMaps[targetMapKey];
        localX = gridX - connections.down[2];
        localY = 0;
      } else {
        return false;
      }
    } else if (gridX < 0) {
      if (connections && connections.left && window.OverworldMaps[connections.left[0]]) {
        targetMapKey = connections.left[0];
        targetMap = window.OverworldMaps[targetMapKey];
        localX = targetMap.dimensions.width - 1;
        localY = gridY - connections.left[2];
      } else {
        return false;
      }
    } else if (gridX >= cols) {
      if (connections && connections.right && window.OverworldMaps[connections.right[0]]) {
        targetMapKey = connections.right[0];
        targetMap = window.OverworldMaps[targetMapKey];
        localX = 0;
        localY = gridY - connections.right[2];
      } else {
        return false;
      }
    }

    const tileData = targetMap.tileData || targetMap.blockData;
    if (!tileData || localY < 0 || localY >= tileData.length || localX < 0 || localX >= tileData[0].length) {
      return false;
    }

    let cellVal = tileData[localY][localX];
    if (typeof cellVal === 'string') cellVal = cellVal.split('|')[0];
    const tileID = parseInt(cellVal) || 0;

    const tileDef = window.OverworldTiles ? window.OverworldTiles[tileID] : null;
    if (tileDef && tileDef.isPassable === false) {
      return false;
    }

    if (this.npcs) {
      for (const npc of this.npcs) {
        const npcMapName = npc.mapName || this.currentMapKey;
        const npcMapOffset = this.getMapWorldOffset(npcMapName);
        const npcGridX = Math.round((npc.x - npcMapOffset.x - 16) / 32);
        const npcGridY = Math.round((npc.y - npcMapOffset.y - 16) / 32);

        if (targetMapKey === npcMapName && npcGridX === localX && npcGridY === localY) {
          return false;
        }
      }
    }

    return true;
  }

  movePlayerTo(targetX, targetY, direction) {
    this.isMoving = true;
    const mapOffset = this.getMapWorldOffset(this.currentMapKey);

    const destX = Math.round(mapOffset.x + targetX * 32 + 16);
    const destY = Math.round(mapOffset.y + targetY * 32 + 16);

    this.walkStep = this.walkStep === 1 ? 2 : 1;
    this.player.setFrame(window.getOverworldFrame(direction, this.walkStep));

    this.tweens.add({
      targets: this.player,
      x: destX,
      y: destY,
      duration: 150,
      onComplete: () => {
        this.playerGridX = targetX;
        this.playerGridY = targetY;
        this.player.setPosition(destX, destY);
        this.player.setFrame(window.getOverworldFrame(direction, 0));
        this.isMoving = false;

        this.logCurrentTileDetails(targetX, targetY, this.currentMapKey);
      },
    });
  }

  tryInteract() {
    if (!this.npcs || this.npcs.length === 0) return;

    const mapOffset = this.getMapWorldOffset(this.currentMapKey);
    const playerGridX = Math.round((this.player.x - mapOffset.x - 16) / 32);
    const playerGridY = Math.round((this.player.y - mapOffset.y - 16) / 32);

    let targetX = playerGridX;
    let targetY = playerGridY;
    if (this.player.direction === 'up') targetY -= 1;
    else if (this.player.direction === 'down') targetY += 1;
    else if (this.player.direction === 'left') targetX -= 1;
    else if (this.player.direction === 'right') targetX += 1;

    const targetNPC = this.npcs.find(npc => {
      const npcMapOffset = this.getMapWorldOffset(npc.mapName || this.currentMapKey);
      const npcGridX = Math.round((npc.x - npcMapOffset.x - 16) / 32);
      const npcGridY = Math.round((npc.y - npcMapOffset.y - 16) / 32);
      return npcGridX === targetX && npcGridY === targetY;
    });

    if (targetNPC && targetNPC.eventConfig) {
      this.activeNPC = targetNPC;
      const scriptName = targetNPC.eventConfig.script;
      if (window.OverworldScriptEngine) {
        window.OverworldScriptEngine.runScript(this, scriptName);
      }
    }
  }

  update(time, delta) {
    if (this.isLocked || this.isMoving) return;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryInteract();
      return;
    }

    if (this.player && this.npcs) {
      this.player.setDepth(this.player.y);
      this.npcs.forEach(npc => npc.setDepth(npc.y));
    }

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
        const transitionMap = this.checkMapBoundaryTransition(targetGridX, targetGridY);
        if (transitionMap) {
          this.executeSeamlessTransition(transitionMap, newDir);
          return;
        }

        this.movePlayerTo(targetGridX, targetGridY, newDir);
      } else {
        const stepCycle = Math.floor(time / 150) % 2 === 0 ? 1 : 2;
        const frameIndex = window.getOverworldFrame(newDir, stepCycle);
        this.player.setFrame(frameIndex);
      }
    } else {
      this.player.setFrame(window.getOverworldFrame(newDir, 0));
    }
  }

  checkMapBoundaryTransition(gridX, gridY) {
    const cols = this.currentMap.dimensions.width;
    const rows = this.currentMap.dimensions.height;
    const connections = this.currentMap.connections;

    if (!connections) return null;

    if (gridY < 0 && connections.up && window.OverworldMaps[connections.up[0]]) {
      return { mapKey: connections.up[0], entryX: gridX - connections.up[2], entryY: window.OverworldMaps[connections.up[0]].dimensions.height - 1 };
    }
    if (gridY >= rows && connections.down && window.OverworldMaps[connections.down[0]]) {
      return { mapKey: connections.down[0], entryX: gridX - connections.down[2], entryY: 0 };
    }
    if (gridX < 0 && connections.left && window.OverworldMaps[connections.left[0]]) {
      return { mapKey: connections.left[0], entryX: window.OverworldMaps[connections.left[0]].dimensions.width - 1, entryY: gridY - connections.left[2] };
    }
    if (gridX >= cols && connections.right && window.OverworldMaps[connections.right[0]]) {
      return { mapKey: connections.right[0], entryX: 0, entryY: gridY - connections.right[2] };
    }

    return null;
  }

  executeSeamlessTransition(transitionData, direction) {
    this.isMoving = true;
    this.currentMapKey = transitionData.mapKey;
    this.currentMap = window.OverworldMaps[this.currentMapKey];
    this.playerGridX = transitionData.entryX;
    this.playerGridY = transitionData.entryY;

    if (window.GameStateManager && window.GameStateManager.saveData) {
      window.GameStateManager.saveData.mapID = this.currentMapKey;
      localStorage.setItem('pokemon_micron_save', JSON.stringify(window.GameStateManager.saveData));
    }

    this.updateMapMusic(this.currentMapKey);

    const mapOffset = this.getMapWorldOffset(this.currentMapKey);
    const destX = Math.round(mapOffset.x + this.playerGridX * 32 + 16);
    const destY = Math.round(mapOffset.y + this.playerGridY * 32 + 16);

    this.walkStep = this.walkStep === 1 ? 2 : 1;
    this.player.setFrame(window.getOverworldFrame(direction, this.walkStep));

    this.tweens.add({
      targets: this.player,
      x: destX,
      y: destY,
      duration: 150,
      onComplete: () => {
        this.player.setFrame(window.getOverworldFrame(direction, 0));
        this.isMoving = false;
      }
    });
  }
}