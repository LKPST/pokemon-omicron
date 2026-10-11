class EmeraldFont {
  constructor(scene) {
    this.scene = scene;
    this.charWidth = 8;
    this.charHeight = 16;
    this.sheetColumns = 32;

    this.glyphMap = {
      // Numerals & Symbols (Row 10)
      0: { c: 2, r: 10 },
      1: { c: 4, r: 10 },
      2: { c: 6, r: 10 },
      3: { c: 8, r: 10 },
      4: { c: 10, r: 10 },
      5: { c: 12, r: 10 },
      6: { c: 14, r: 10 },
      7: { c: 16, r: 10 },
      8: { c: 18, r: 10 },
      9: { c: 20, r: 10 },
      '!': { c: 22, r: 10 },
      '?': { c: 24, r: 10 },
      '.': { c: 26, r: 10 },
      '-': { c: 28, r: 10 },
      ',': { c: 16, r: 11 },

      // Uppercase A-E
      A: { c: 22, r: 11 },
      B: { c: 24, r: 11 },
      C: { c: 26, r: 11 },
      D: { c: 28, r: 11 },
      E: { c: 30, r: 11 },

      // Uppercase F-U
      F: { c: 0, r: 12 },
      G: { c: 2, r: 12 },
      H: { c: 4, r: 12 },
      I: { c: 6, r: 12 },
      J: { c: 8, r: 12 },
      K: { c: 10, r: 12 },
      L: { c: 12, r: 12 },
      M: { c: 14, r: 12 },
      N: { c: 16, r: 12 },
      O: { c: 18, r: 12 },
      P: { c: 20, r: 12 },
      Q: { c: 22, r: 12 },
      R: { c: 24, r: 12 },
      S: { c: 26, r: 12 },
      T: { c: 28, r: 12 },
      U: { c: 30, r: 12 },

      // Uppercase V-Z
      V: { c: 0, r: 13 },
      W: { c: 2, r: 13 },
      X: { c: 4, r: 13 },
      Y: { c: 6, r: 13 },
      Z: { c: 8, r: 13 },

      // Lowercase a-k (Row 13)
      a: { c: 10, r: 13 },
      b: { c: 12, r: 13 },
      c: { c: 14, r: 13 },
      d: { c: 16, r: 13 },
      e: { c: 18, r: 13 },
      f: { c: 20, r: 13 },
      g: { c: 22, r: 13 },
      h: { c: 24, r: 13 },
      i: { c: 26, r: 13 },
      j: { c: 28, r: 13 },
      k: { c: 30, r: 13 },

      // Lowercase l-z (Row 14)
      l: { c: 0, r: 14 },
      m: { c: 2, r: 14 },
      n: { c: 4, r: 14 },
      o: { c: 6, r: 14 },
      p: { c: 8, r: 14 },
      q: { c: 10, r: 14 },
      r: { c: 12, r: 14 },
      s: { c: 14, r: 14 },
      t: { c: 16, r: 14 },
      u: { c: 18, r: 14 },
      v: { c: 20, r: 14 },
      w: { c: 22, r: 14 },
      x: { c: 24, r: 14 },
      y: { c: 26, r: 14 },
      z: { c: 28, r: 14 },

      // Row 15: Diaeresis characters
      ':': { c: 0, r: 15 },
      Ä: { c: 0, r: 15 },
      Ö: { c: 2, r: 15 },
      Ü: { c: 4, r: 15 },
      ä: { c: 6, r: 15 },
      ö: { c: 8, r: 15 },
      ü: { c: 10, r: 15 },

      // Row 16: UI Symbols & D-Pad arrows
      '/up/': { c: 0, r: 16 }, // Up arrow glyph
      '/down/': { c: 2, r: 16 }, // Down arrow glyph
      '/left/': { c: 4, r: 16 }, // Left arrow glyph
      '/right/': { c: 6, r: 16 }, // Right arrow glyph
      '+': { c: 8, r: 16 },
      Lv: { c: 10, r: 16 },
      PP: { c: 12, r: 16 },
      ID: { c: 14, r: 16 },
      '№': { c: 16, r: 16 },
      _: { c: 18, r: 16 },
      '①': { c: 20, r: 16 },
      '②': { c: 22, r: 16 },
      '③': { c: 24, r: 16 },
      '④': { c: 26, r: 16 },
      '⑤': { c: 28, r: 16 },
      '⑥': { c: 30, r: 16 },

      // Row 17
      '⑦': { c: 0, r: 17 },
      '⑧': { c: 2, r: 17 },
      '⑨': { c: 4, r: 17 },
      '(': { c: 6, r: 17 },
      ')': { c: 8, r: 17 },
      '■': { c: 10, r: 17 },
      '▲': { c: 12, r: 17 },
      '✖': { c: 14, r: 17 },
    };
  }

  ensureTexture() {
    // 1. If Phaser already has 'emerald_font' registered in this scene, we're good
    if (this.scene.textures.exists('emerald_font')) return true;

    // 2. If 'latin_short' was loaded by BattleScene or elsewhere, build 'emerald_font' from it instantly
    if (this.scene.textures.exists('latin_short')) {
      const sourceImage = this.scene.textures.get('latin_short').getSourceImage();
      return this._buildCanvasTexture(sourceImage);
    }

    // 3. Otherwise, check global shared image cache
    if (!window._globalEmeraldFontImg) {
      window._globalEmeraldFontImg = new Image();
      window._globalEmeraldFontImg.src = 'graphics/fonts/latin_short.png';
    }

    if (window._globalEmeraldFontImg.complete && window._globalEmeraldFontImg.naturalWidth > 0) {
      return this._buildCanvasTexture(window._globalEmeraldFontImg);
    }

    return false;
  }

  _buildCanvasTexture(sourceImage) {
    if (this.scene.textures.exists('emerald_font')) return true;

    const canvasTex = this.scene.textures.createCanvas('emerald_font', sourceImage.width, sourceImage.height);
    if (!canvasTex) return false;

    canvasTex.draw(0, 0, sourceImage);
    const ctx = canvasTex.context;
    const imgData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);
    const data = imgData.data;

    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

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
    return true;
  }

  print(startX, startY, text, depth = 11, scale = 2) {
    // If the texture isn't built yet, trigger an async load and auto-redraw when ready
    if (!this.ensureTexture()) {
      if (window._globalEmeraldFontImg && !window._globalEmeraldFontImg.onload) {
        window._globalEmeraldFontImg.onload = () => {
          // Re-trigger print once loaded
          this.print(startX, startY, text, depth, scale);
        };
      }
      return [];
    }

    const createdGlyphs = [];
    let currentX = startX;
    let currentY = startY;
    const strText = String(text);

    let i = 0;
    while (i < strText.length) {
      const char = strText[i];

      if (char === '\n') {
        currentX = startX;
        currentY += 16 * scale; // Scaled line height
        i++;
        continue;
      }

      if (char === ' ') {
        currentX += 5 * scale; // Scaled space width
        i++;
        continue;
      }

      let matchedGlyph = null;
      let matchedTagLength = 0;

      if (char === '/') {
        const closingIndex = strText.indexOf('/', i + 1);
        if (closingIndex !== -1) {
          const potentialTag = strText.substring(i, closingIndex + 1);
          if (this.glyphMap[potentialTag]) {
            matchedGlyph = this.glyphMap[potentialTag];
            matchedTagLength = potentialTag.length;
          }
        }
      }

      if (!matchedGlyph) {
        matchedGlyph = this.glyphMap[char];
        matchedTagLength = 1;
      }

      if (matchedGlyph) {
        const frameIndex = matchedGlyph.r * this.sheetColumns + matchedGlyph.c;
        const charImage = this.scene.add.image(
          currentX,
          currentY,
          'emerald_font',
          frameIndex
        );
        charImage.setOrigin(0, 0);
        charImage.setDepth(depth);
        charImage.setScale(scale); // Scale up glyphs to match high-res canvas
        createdGlyphs.push(charImage);
      }

      currentX += 6 * scale; // Scaled character spacing
      i += matchedTagLength;
    }

    return createdGlyphs;
  }
}