window.OverworldMovement = {
  execute(entity, action, onComplete) {
    const scene = entity.scene;
    if (!scene) return;

    const blockSize = scene.currentMap ? scene.currentMap.dimensions.blockSize : 16;
    const currentGridX = Math.floor(entity.x / blockSize);
    const currentGridY = Math.floor(entity.y / blockSize);

    let targetGridX = currentGridX;
    let targetGridY = currentGridY;
    let direction = entity.direction;

    switch (action) {
      case 'look_up': direction = 'up'; break;
      case 'look_down': direction = 'down'; break;
      case 'look_left': direction = 'left'; break;
      case 'look_right': direction = 'right'; break;

      case 'walk_up':
        direction = 'up';
        targetGridY -= 1;
        break;
      case 'walk_down':
        direction = 'down';
        targetGridY += 1;
        break;
      case 'walk_left':
        direction = 'left';
        targetGridX -= 1;
        break;
      case 'walk_right':
        direction = 'right';
        targetGridX += 1;
        break;
    }

    entity.direction = direction;

    // If it's just a look command, update frame and finish
    if (action.startsWith('look_')) {
      entity.setFrame(window.getOverworldFrame(direction, 0));
      if (onComplete) onComplete();
      return;
    }

    // For walk commands, check if target tile is passable using scene's isPassable check
    if (scene.isPassable && !scene.isPassable(targetGridX, targetGridY)) {
      // Blocked! Just turn to face that direction without moving
      entity.setFrame(window.getOverworldFrame(direction, 0));
      if (onComplete) onComplete();
      return;
    }

    // Perform physical step execution if passable
    const destX = targetGridX * blockSize + (blockSize / 2);
    const destY = targetGridY * blockSize + (blockSize / 2);

    entity.setFrame(window.getOverworldFrame(direction, 1));
    scene.time.delayedCall(75, () => {
      if (!entity.active) return;
      entity.setFrame(window.getOverworldFrame(direction, 2));
      entity.x = destX;
      entity.y = destY;
      scene.time.delayedCall(75, () => {
        if (!entity.active) return;
        entity.setFrame(window.getOverworldFrame(direction, 0));
        if (onComplete) onComplete();
      });
    });
  }
};