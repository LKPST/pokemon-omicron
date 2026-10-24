// ===========================================================================
// overworld_textbox.js
//
// 1) OverworldText   - pure text rules (no Phaser). Used by the game AND by the Scripts editor to
//                      warn you when a message will not fit in the box.
// 2) OverworldTextbox - the dark, see-through message box with WHITE text (Phaser).
//
// Text codes inside msgbox text:
//     \n   new line          \p   new paragraph (clears the box, waits for a button)
//     $player   the player's name      $npc   the name of the NPC you are talking to
//     $anything_else   a script variable set with `setvar` (printed as a number)
//     {red}colored words{/}   colors: red orange yellow green cyan blue purple pink gray brown white, or {#ff8800}. {/} ends the color.
//
// One page = 2 lines of up to 34 characters (GBA box). Change the numbers in OW_TEXT to resize.
// ===========================================================================

const OW_TEXT = {
    // The GBA screen is 240x160. The game draws it 2x -> 480x320 (the TOP screen of your dual-screen layout).
    // The box is placed at the bottom of that area. If your top screen is not at (0,0) change x / y here.
    screen: { x: 0, y: 0, w: 480, h: 320 },
    scale: 2,               // glyph scale (GBA pixels -> game pixels)
    advance: 6,             // width of one character, in GBA pixels (the font is fixed width)
    space: 5,               // width of a space, in GBA pixels
    innerWidth: 208,        // text area width, in GBA pixels (26 tiles)
    maxLines: 2,            // lines per page
    lineHeight: 16,         // GBA pixels
    box: { x: 8, y: 112, w: 224, h: 48 },   // GBA pixels: the dark panel
    textOffset: { x: 8, y: 8 },             // text start inside the panel, GBA pixels
    fill: 0x080c18, fillAlpha: 0.72,        // dark, semi transparent
    border: 0xffffff, borderAlpha: 0.35,
    textColor: [255, 255, 255],             // glyph colour (the font sheet is black, it is recoloured at load)
    shadowColor: [0, 0, 0, 150],            // r, g, b, alpha of the glyph shadow pixels
    speed: 28,                              // ms per character (hold Space/Z to go faster)
    depth: 6000,
  };
  
  // ---- glyph table: a character -> its cell in latin_short.png (frame = row*32 + 2*(code%16), code = row*16 + column) ----
  const OW_GLYPHS = (() => {
    const g = {};
    const put = (ch, code) => { g[ch] = { r: code >> 4, c: 2 * (code & 15) }; };
    // codes in a run are consecutive, but the accent rows have gaps, so they are listed explicitly
    const run = (start, chars) => { let code = start; for (const ch of chars) put(ch, code++); };
    run(0x01, 'ÀÁÂÇÈÉÊËÌ'); run(0x0B, 'ÎÏÒÓÔŒÙÚÛÑß'); run(0x16, 'àá'); run(0x19, 'çèéêëì');
    run(0x20, 'îïòóôœùúûñºª'); run(0x2D, '&+'); run(0x35, '=;'); run(0x5A, 'Í%()');
    run(0xA1, '0123456789!?.-'); run(0xB0, '…“”‘’♂♀'); run(0xB8, ',×/'); run(0xBB, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
    run(0xF0, ':ÄÖÜäöü');
    g["'"] = g['’']; g['"'] = g['“'];
    return g;
  })();
  
  // The glyph table of the game's font. If js/utils/EmeraldFont.js is loaded ITS map is used (edit it in the Font Editor tab of
  // background_remover.html): it adds the /tags/ like /m/ /f/ /up/, wide glyphs (w = cells of 8 px) and per glyph advances (adv).
  // The table above is only the fallback when EmeraldFont.js is not loaded.
  let owTable = null, owFromEF = false;
  function owGlyphs() {
    if (owTable && (owFromEF || typeof EmeraldFont === 'undefined')) return owTable;
    let ef = null;
    try { if (typeof EmeraldFont !== 'undefined') ef = new EmeraldFont(null).glyphMap; } catch (e) { ef = null; }
    owFromEF = !!ef;
    owTable = ef ? Object.assign({}, OW_GLYPHS, ef) : OW_GLYPHS;
    if (ef) { if (owTable['/m/']) owTable['\u2642'] = owTable['/m/']; if (owTable['/f/']) owTable['\u2640'] = owTable['/f/']; }
    return owTable;
  }
  const owAdv = gl => (gl && typeof gl.adv === 'number') ? gl.adv : (gl && gl.w > 1 ? gl.w * 8 : OW_TEXT.advance);

  // text colors (bright, so they read on the dark box). Use {red}text{/} in a message, or {#rrggbb}.
  const OW_COLORS = { red: '#ff5a5a', orange: '#ffa24d', yellow: '#ffe14d', green: '#6fe07a', cyan: '#5ee6e6', blue: '#6ab4ff', purple: '#c59bff', pink: '#ff8fd0', gray: '#bdbdbd', grey: '#bdbdbd', brown: '#d2a06b', white: '#ffffff' };
  const OW_COLOR_RE = /\{(\/|#[0-9a-fA-F]{6}|red|orange|yellow|green|cyan|blue|purple|pink|gray|grey|brown|white|big)\}/gi;   // {big} = the whole message in 200% text (one line per page, fills the box); it is not a color

  const OverworldText = {
    get glyphs() { return owGlyphs(); },
    colors: OW_COLORS,
    stripColor(s) { return String(s == null ? '' : s).replace(OW_COLOR_RE, ''); },
    // 'text {red}hi{/}' -> { text:'text hi', cols:[null,null,...,'#ff5a5a','#ff5a5a'] } (one entry per character)
    parseColors(raw) {
      raw = String(raw == null ? '' : raw); let text = '', cols = [], cur = null, last = 0, m, big = false; OW_COLOR_RE.lastIndex = 0;
      while ((m = OW_COLOR_RE.exec(raw))) {
        const seg = raw.slice(last, m.index); text += seg; for (let k = 0; k < seg.length; k++) cols.push(cur);
        const t = m[1].toLowerCase(); if (t === 'big') big = true; else cur = t === '/' ? null : (t[0] === '#' ? t : OW_COLORS[t]); last = m.index + m[0].length;
      }
      const seg = raw.slice(last); text += seg; for (let k = 0; k < seg.length; k++) cols.push(cur);
      return { text, cols, big };
    },

    // Splits a line into drawable tokens. A single / is a slash; /name/ (closed by another /) is a special glyph (/m/ /f/ /up/ ...).
    tokens(s) {
      s = String(s == null ? '' : s); const G = owGlyphs(), out = []; let i = 0;
      while (i < s.length) {
        const ch = s[i], i0 = i;
        if (ch === ' ') { out.push({ ch: ' ', gl: null, adv: OW_TEXT.space, w: 1, i0 }); i++; continue; }
        if (ch === '/') {
          const j = s.indexOf('/', i + 1);
          if (j > 0) { const tag = s.slice(i, j + 1); if (G[tag]) { out.push({ ch: tag, gl: G[tag], adv: owAdv(G[tag]), w: G[tag].w || 1, i0 }); i = j + 1; continue; } }
        }
        const gl = G[ch] || null; out.push({ ch, gl, adv: owAdv(gl), w: (gl && gl.w) || 1, i0 }); i++;
      }
      return out;
    },
  
    // $player, $npc and variables
    expand(text, vars = {}) {
      return String(text == null ? '' : text).replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    },
  
    charWidth(ch) { return ch === ' ' ? OW_TEXT.space : owAdv(owGlyphs()[ch]); },   // one character or one /tag/
    lineWidth(s) { let w = 0; for (const t of this.tokens(s)) w += t.adv; return w; },   // GBA pixels
  
    // Splits text into pages and lines. Returns { pages:[{lines:[...]}], warnings:[{page,line,type,msg}] }
    layout(text, vars) {
      const pc = this.parseColors(this.expand(text, vars)), raw = pc.text;
      const big = !!pc.big, bg = big ? 2 : 1, maxLines = big ? 1 : OW_TEXT.maxLines;   // {big}: glyphs twice as large, so half the width and one line per page
      // \n and \l start a new line. The box shows 2 lines (1 with {big}); from the 3rd line on the text SCROLLS UP: after \n at once, after \l when the player presses a button (like the Emerald font).
      const pages = [{ lines: [''], cols: [[]], brk: [null], big }];
      let i = 0;
      while (i < raw.length) {
        const two = raw.substr(i, 2);
        const page = pages[pages.length - 1];
        if (two === '\\n' || two === '\\l') { page.lines.push(''); page.cols.push([]); page.brk.push(two === '\\l' ? 'l' : 'n'); i += 2; continue; }
        if (two === '\\p') { pages.push({ lines: [''], cols: [[]], brk: [null], big }); i += 2; continue; }
        if (raw[i] === '\n') { page.lines.push(''); page.cols.push([]); page.brk.push('n'); i++; continue; }
        page.lines[page.lines.length - 1] += raw[i]; page.cols[page.cols.length - 1].push(pc.cols[i]); i++;
      }
      if (pages.length > 1 && pages[pages.length - 1].lines.every(l => l === '')) pages.pop();   // trailing \p
      pages.forEach(pg => { while (pg.lines.length > 1 && pg.lines[pg.lines.length - 1] === '') { pg.lines.pop(); pg.cols.pop(); pg.brk.pop(); } });   // a \n at the very end of a message
      const warnings = [];
      pages.forEach((pg, p) => {
        pg.lines.forEach((ln, l) => {
          const w = this.lineWidth(ln) * bg;
          if (w > OW_TEXT.innerWidth) {
            warnings.push({ page: p, line: l, type: 'width', msg: `Page ${p + 1}, line ${l + 1} is too long (${w}/${OW_TEXT.innerWidth} px${big ? ', {big} text' : ''}). It runs out of the box: add \\n.` });
          }
          const bad = this.tokens(ln).filter(t => t.ch !== ' ' && !t.gl).map(t => t.ch);
          if (bad.length) warnings.push({ page: p, line: l, type: 'glyph', msg: `Page ${p + 1}, line ${l + 1}: the font has no "${[...new Set(bad)].join('')}".` });
        });
      });
      return { pages, warnings, big };
    },
  
    // Re-flows text: breaks lines at spaces so that they fit, 2 lines per page, \p between pages.
    // Existing \n and \p are kept as hard breaks.
    autoWrap(text) {
      const bigRe = /\{big\}/gi, big = bigRe.test(String(text));   // {big}: half the width, one line per page; the tag stays at the start
      if (big) text = String(text).replace(bigRe, '');
      const lim = big ? OW_TEXT.innerWidth / 2 : OW_TEXT.innerWidth, per = big ? 1 : OW_TEXT.maxLines;
      const paras = String(text).replace(/\r?\n/g, ' ').split('\\p');
      const outParas = paras.map(par => {
        const hard = par.split(/\\n|\\l/);
        const lines = [];
        for (const h of hard) {
          let cur = '';
          for (const word of h.split(/\s+/).filter(Boolean)) {
            const t = cur ? cur + ' ' + word : word;
            if (this.lineWidth(this.stripColor(t)) <= lim || !cur) cur = t; else { lines.push(cur); cur = word; }
          }
          lines.push(cur);
        }
        // one page per paragraph: line 2 follows with \n, the next lines scroll up after a button press (\l); \p only where YOU wrote it
        return lines.map((ln, i) => (i === 0 ? '' : (i < per ? '\\n' : '\\l')) + ln).join('');
      });
      return (big ? '{big}' : '') + outParas.join('\\p');
    },
  };
  
  // ===========================================================================
  // PHASER PART (only used in the game)
  // ===========================================================================
  const OverworldTextbox = {
    fontKey: 'ow_font_white',
  
    // Builds a white copy of the font sheet (black -> white, grey shadow -> dark). The shared
    // 'emerald_font' texture used by battles is NOT touched.
    ensureFont(scene, then) {
      if (scene.textures.exists(this.fontKey)) { then(); return; }
      const make = (src) => {
        if (scene.textures.exists(this.fontKey)) { then(); return; }
        const W = src.width, H = src.height;
        const tex = scene.textures.createCanvas(this.fontKey, W, H);
        tex.draw(0, 0, src);
        const ctx = tex.context, data = ctx.getImageData(0, 0, W, H), d = data.data;
        const bgR = d[0], bgG = d[1], bgB = d[2];
        const T = OW_TEXT.textColor, S = OW_TEXT.shadowColor;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if ((r === bgR && g === bgG && b === bgB) || (r >= 245 && g >= 245 && b >= 245)) { d[i + 3] = 0; continue; }
          const lum = (r + g + b) / 3;
          if (lum < 110) { d[i] = T[0]; d[i + 1] = T[1]; d[i + 2] = T[2]; d[i + 3] = 255; }
          else { d[i] = S[0]; d[i + 1] = S[1]; d[i + 2] = S[2]; d[i + 3] = S[3]; }
        }
        ctx.putImageData(data, 0, 0);
        tex.refresh();
        let n = 0;
        for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 8) tex.add(n++, 0, x, y, 8, 16);
        then();
      };
      if (scene.textures.exists('latin_short')) { make(scene.textures.get('latin_short').getSourceImage()); return; }
      let im = window._globalEmeraldFontImg;
      if (!im) { im = window._globalEmeraldFontImg = new Image(); im.src = 'graphics/fonts/latin_short.png'; }
      if (im.complete && im.naturalWidth > 0) make(im);
      else im.addEventListener('load', () => make(im), { once: true });
    },
  
    // Draws one line of text. Returns the glyph images (so they can be revealed one by one).
    drawLine(scene, x, y, line, depth, cols, mul) {
      const sc = OW_TEXT.scale * (mul || 1), out = [];
      let cx = x;
      for (const t of OverworldText.tokens(line)) {
        const gl = t.gl;
        if (gl) {
          for (let k = 0; k < t.w; k++) {   // wide glyphs (w > 1) are drawn from w cells side by side
            const im = scene.add.image(cx + k * 8 * sc, y, this.fontKey, gl.r * 32 + gl.c + k).setOrigin(0, 0).setScale(sc).setDepth(depth).setScrollFactor(0);
            const cc = cols && cols[t.i0]; if (cc) im.setTint(parseInt(cc.slice(1), 16));
            out.push(im);
          }
        }
        cx += t.adv * sc;
      }
      return out;
    },
  
    vars(scene) {
      const gs = window.GameStateManager && window.GameStateManager.saveData;
      const v = Object.assign({}, gs && gs.vars ? gs.vars : {});
      v.player = gs && gs.player && gs.player.name ? gs.player.name : 'Player';
      const npc = scene.activeNPC;
      v.npc = npc && npc.eventConfig ? (npc.eventConfig.owID || '') : '';
      return v;
    },
  
    // Shows text page by page. cb() is called when the player closes the last page.
    show(scene, text, cb, opts = {}) {
      this.ensureFont(scene, () => this._show(scene, text, cb, opts));
    },
  
    _show(scene, text, cb, opts) {
      const T = OW_TEXT, sc = T.scale, S = T.screen;
      const lay = OverworldText.layout(text, this.vars(scene));
      lay.warnings.forEach(w => console.warn('[textbox] ' + w.msg));
      const D = T.depth;
      const bx = S.x + T.box.x * sc, by = S.y + T.box.y * sc, bw = T.box.w * sc, bh = T.box.h * sc;
  
      const gfx = scene.add.graphics().setDepth(D).setScrollFactor(0);
      gfx.fillStyle(T.fill, T.fillAlpha).fillRoundedRect(bx, by, bw, bh, 8);
      gfx.lineStyle(2, T.border, T.borderAlpha).strokeRoundedRect(bx + 1, by + 1, bw - 2, bh - 2, 8);
  
      const arrow = scene.add.triangle(bx + bw - 22, by + bh - 18, 0, 0, 14, 0, 7, 9, 0xffffff, 0.9).setDepth(D + 1).setScrollFactor(0).setVisible(false);
      const bob = scene.tweens.add({ targets: arrow, y: arrow.y + 4, duration: 320, yoyo: true, repeat: -1 });
  
      const tx = bx + T.textOffset.x * sc, ty = by + T.textOffset.y * sc;
      let pageIdx = 0, glyphs = [], revealed = 0, timer = null, waiting = false, closed = false, fast = false;
  
      const clearGlyphs = () => { glyphs.forEach(g => g.destroy()); glyphs = []; };
      const finish = () => {
        if (closed) return; closed = true;
        if (timer) timer.remove(false);
        bob.stop(); arrow.destroy(); clearGlyphs(); gfx.destroy();
        scene.input.keyboard.off('keydown', onKey); scene.input.keyboard.off('keyup', onUp); scene.input.off('pointerdown', onPress);
        if (cb) cb();
      };
      // The page is a list of lines; the box shows `rows` of them (2, or 1 with {big}). When the typing reaches a line past the box, the lines scroll up:
      // at once after \n, or after a button press after \l.
      let lineG = [], li = 0, gi = 0, rows = 2, mul = 1, pendingScroll = false;
      const rowY = r => ty + r * T.lineHeight * sc * mul;
      const doScroll = () => {   // the shown lines move up by one row; the top one disappears
        const hide = li - rows; if (hide >= 0 && lineG[hide]) lineG[hide].forEach(g => g.setVisible(false));
        for (let k = Math.max(0, li - rows + 1); k <= li; k++) { const r = k - (li - rows + 1); lineG[k].forEach(g => { g.y = rowY(r); }); }
      };
      const startPage = () => {
        clearGlyphs(); arrow.setVisible(false); waiting = false; pendingScroll = false;
        const pg = lay.pages[pageIdx]; mul = pg.big ? 2 : 1; rows = pg.big ? 1 : T.maxLines;
        lineG = pg.lines.map((ln, i) => this.drawLine(scene, tx, rowY(Math.min(i, rows - 1)), ln, D + 1, pg.cols && pg.cols[i], mul));
        lineG.forEach(a => { a.forEach(g => g.setVisible(false)); glyphs.push(...a); });
        li = 0; gi = 0;
        if (timer) timer.remove(false);
        timer = scene.time.addEvent({ delay: T.speed, loop: true, callback: () => reveal(fast ? 3 : 1) });
      };
      const reveal = (n) => {
        const pg = lay.pages[pageIdx];
        while (n > 0) {
          if (gi >= lineG[li].length) {   // this line is typed out
            if (li + 1 >= lineG.length) { if (timer) timer.remove(false); timer = null; waiting = true; arrow.setVisible(true); return; }
            li++; gi = 0;
            if (li >= rows) {
              if (pg.brk[li] === 'l') { if (timer) timer.remove(false); timer = null; pendingScroll = true; arrow.setVisible(true); return; }
              doScroll();
            }
            continue;
          }
          lineG[li][gi++].setVisible(true); n--;
        }
      };
      const onPress = () => {
        if (pendingScroll) {   // \l: scroll up now and go on typing
          pendingScroll = false; arrow.setVisible(false); doScroll();
          timer = scene.time.addEvent({ delay: T.speed, loop: true, callback: () => reveal(fast ? 3 : 1) }); return;
        }
        if (!waiting) { reveal(1e6); return; }   // first press types out the rest (it still stops at a \l)
        if (pageIdx < lay.pages.length - 1) { pageIdx++; startPage(); } else finish();
      };
      const onKey = (ev) => {
        if (['Space', 'Enter', 'KeyZ', 'KeyX'].includes(ev.code)) { if (!ev.repeat) onPress(); fast = true; }
      };
      scene.input.keyboard.on('keydown', onKey);
      const onUp = () => { fast = false; };
      scene.input.keyboard.on('keyup', onUp);
      scene.input.on('pointerdown', onPress);
      startPage();
      return { close: finish };
    },
  };
  
  // Yes / No question: cb(true|false). The message is shown first, then the choice box
  OverworldTextbox.yesno = function (scene, text, cb) {
    this.ensureFont(scene, () => {
      const T = OW_TEXT, sc = T.scale, S = T.screen, D = T.depth;
      const lay = OverworldText.layout(text, this.vars(scene));
      // show every page but the last normally; the last page stays on screen while the choice is asked
      const pages = lay.pages;
      const lastPg = pages[pages.length - 1], rowsN = lastPg.big ? 1 : T.maxLines, cut = Math.max(0, lastPg.lines.length - rowsN);   // lines above the last ones are shown first
      const headPages = pages.slice(0, -1).map(p => p.lines.join('\\n')); if (cut) headPages.push(lastPg.lines.slice(0, cut).join('\\n'));
      const head0 = headPages.join('\\p'), head = head0 ? (lay.big ? '{big}' : '') + head0 : '';
      const ask = () => {
        this.ensureFont(scene, () => {
          const bx = S.x + T.box.x * sc, by = S.y + T.box.y * sc, bw = T.box.w * sc, bh = T.box.h * sc;
          const gfx = scene.add.graphics().setDepth(D).setScrollFactor(0);
          gfx.fillStyle(T.fill, T.fillAlpha).fillRoundedRect(bx, by, bw, bh, 8);
          gfx.lineStyle(2, T.border, T.borderAlpha).strokeRoundedRect(bx + 1, by + 1, bw - 2, bh - 2, 8);
          const objs = [gfx];
          const tx = bx + T.textOffset.x * sc, ty = by + T.textOffset.y * sc;
          lastPg.lines.slice(cut).forEach((ln, i) => objs.push(...this.drawLine(scene, tx, ty + i * T.lineHeight * sc * (lay.big ? 2 : 1), ln, D + 1, lastPg.cols && lastPg.cols[cut + i], lay.big ? 2 : 1)));
          // choice box, right side, just above the message box
          const cw = 56 * sc, ch = 40 * sc, cx = bx + bw - cw, cy = by - ch - 4;
          const g2 = scene.add.graphics().setDepth(D + 2).setScrollFactor(0);
          g2.fillStyle(T.fill, Math.min(1, T.fillAlpha + 0.15)).fillRoundedRect(cx, cy, cw, ch, 8);
          g2.lineStyle(2, T.border, T.borderAlpha).strokeRoundedRect(cx + 1, cy + 1, cw - 2, ch - 2, 8);
          objs.push(g2);
          objs.push(...this.drawLine(scene, cx + 20 * sc, cy + 6 * sc, 'Yes', D + 3));
          objs.push(...this.drawLine(scene, cx + 20 * sc, cy + 22 * sc, 'No', D + 3));
          let sel = 0;
          const cur = scene.add.triangle(cx + 10 * sc, cy + 14 * sc, 0, 0, 0, 14, 10, 7, 0xffffff, 1).setDepth(D + 3).setScrollFactor(0);
          objs.push(cur);
          const place = () => { cur.y = cy + (sel === 0 ? 14 : 30) * sc; };
          let done = false;
          const end = (yes) => {
            if (done) return; done = true;
            scene.input.keyboard.off('keydown', onKey); objs.forEach(o => o.destroy());
            cb(yes);
          };
          const onKey = (ev) => {
            if (ev.code === 'ArrowUp' || ev.code === 'ArrowDown') { sel = 1 - sel; place(); }
            else if (['Space', 'Enter', 'KeyZ'].includes(ev.code) && !ev.repeat) end(sel === 0);
            else if (ev.code === 'KeyX' || ev.code === 'Escape') end(false);
          };
          scene.input.keyboard.on('keydown', onKey);
        });
      };
      if (head) this.show(scene, head, ask); else ask();
    });
  };
  
  window.OW_TEXT = OW_TEXT;
  window.OverworldText = OverworldText;
  window.OverworldTextbox = OverworldTextbox;