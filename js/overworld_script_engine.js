// ===========================================================================
// overworld_script_engine.js  -  reads your scripts and runs them.   (You normally never edit this file.)
//
//   overworld_scripts.js           your scripts, written like xSE   (edit this, or use the Scripts editor)
//   overworld_script_commands.js   the command list (add new commands there)
//   overworld_textbox.js           the message box
//
// Script syntax:
//     start: "portia_script"        <- the name you put in the event's `script` field
//     lock
//     faceplayer
//     msgbox.normal
//     {
//     Hi $player, isn't Criscanto the best?\p
//     Come and see me again!
//     }
//     applymovement npc
//     {
//     walk_down*2
//     look_left
//     }
//     release
//     end
//
//   * `command arg1 arg2 key=value` - arguments are typed in the order the command lists them, or by name.
//     Use "quotes" for values with spaces.
//   * { ... } holds the text of a message or the steps of a movement. Lines inside a message are joined,
//     so only \n and \p break lines.
//   * # comment      and      label name  /  goto name   work too.
//   * A script runs until `end` and may have several `end`s (for example after a goto). It stops at the next start:
// ===========================================================================

window.OverworldScriptEngine = (() => {
  const E = { scripts: {}, order: [], header: '', errors: [], loaded: false };
  const CMDS = () => window.OverworldScriptCommands || {};

  // ------------------------------------------------------------------ parsing
  const TOKEN = /([A-Za-z_]\w*)=("(?:[^"\\]|\\.)*"|\S*)|"((?:[^"\\]|\\.)*)"|(\S+)/g;
  const unq = s => (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ? s.slice(1, -1).replace(/\\"/g, '"') : s;

  function tokenize(line) {
    const out = [];
    let m; TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(line))) {
      if (m[1] !== undefined) out.push({ key: m[1], val: unq(m[2]) });
      else if (m[3] !== undefined) out.push({ val: m[3].replace(/\\"/g, '"') });
      else out.push({ val: m[4] });
    }
    return out;
  }

  function convert(arg, v) {
    if (arg.t === 'num') { const n = Number(v); return v !== '' && !isNaN(n) ? n : v; }
    if (arg.t === 'bool') return /^(1|true|yes|on)$/i.test(String(v));
    return v;
  }

  // Joins the lines of a { } block. Message lines are joined with a space unless the line ends in \n \p \l.
  function joinBlock(lines, kind) {
    if (kind === 'moves') return lines.join(' ').replace(/\s+/g, ' ').trim();
    let out = '';
    lines.forEach(l => {
      const t = l.trim();
      if (t === '') return;
      if (out && !/\\[npl]$/.test(out)) out += ' ';
      out += t;
    });
    return out;
  }

  // text -> { scripts:{name:{name,steps,line}}, order:[names], header:'text before the first start:', errors:[{line,msg,script}] }
  E.parse = function (text) {
    const res = { scripts: {}, order: [], header: '', errors: [] };
    const lines = String(text == null ? '' : text).replace(/^﻿/, '').split(/\r?\n/);
    const headerLines = [];
    let cur = null;
    const err = (i, msg) => res.errors.push({ line: i + 1, msg, script: cur ? cur.name : null });
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i], t = raw.trim();
      const st = /^start\s*:\s*(?:"([^"]*)"|(\S+))\s*$/i.exec(t);
      if (st) {
        const name = st[1] !== undefined ? st[1] : st[2];
        if (res.scripts[name]) err(i, `Script "${name}" is defined twice (the last one wins)`);
        // comments written just above this start: belong to the new script, not the one before
        const lead = [];
        if (cur) while (cur.steps.length && cur.steps[cur.steps.length - 1].cmd === '#') lead.unshift(cur.steps.pop());
        cur = { name, steps: lead, line: i + 1 };
        res.scripts[name] = cur;
        if (!res.order.includes(name)) res.order.push(name);
        continue;
      }
      if (!cur) { if (t !== '' || headerLines.length) headerLines.push(raw); continue; }
      if (t === '') continue;
      if (t.startsWith('#') || t.startsWith('//')) { cur.steps.push({ cmd: '#', args: { text: t.replace(/^(#|\/\/)\s?/, '') }, line: i + 1 }); continue; }
      if (/^end$/i.test(t)) { cur.steps.push({ cmd: 'end', args: {}, line: i + 1 }); continue; }   // a script may have several `end`s; it stops at the next start:

      let toks = tokenize(t), opensBlock = false, blockInline = '';
      const brace = t.indexOf('{');
      if (brace >= 0 && !t.slice(0, brace).includes('"')) {            // `cmd args {` or `cmd {text}`
        blockInline = t.slice(brace + 1); toks = tokenize(t.slice(0, brace)); opensBlock = true;
      }
      const cmd = toks[0] && toks[0].key === undefined ? toks[0].val : null;
      if (!cmd) { err(i, `Cannot read this line: ${t}`); continue; }
      const sc = CMDS()[cmd];
      const step = { cmd, args: {}, line: i + 1 };
      if (!sc) err(i, `Unknown command "${cmd}"`);

      // a block can also start on the next non-empty line
      if (sc && sc.block && !opensBlock) {
        let j = i + 1; while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length && lines[j].trim().startsWith('{')) { opensBlock = true; blockInline = lines[j].trim().slice(1); i = j; }
      }
      if (opensBlock) {
        const body = []; let closed = false;
        const take = (s) => { const k = s.lastIndexOf('}'); if (k >= 0 && s.slice(k + 1).trim() === '') { if (s.slice(0, k).trim() !== '') body.push(s.slice(0, k)); closed = true; } else if (s.trim() !== '') body.push(s); };
        take(blockInline);
        while (!closed && i + 1 < lines.length) { i++; take(lines[i]); }
        if (!closed) err(i, 'Missing "}" at the end of the block');
        if (sc && sc.block) step.args[sc.block === 'text' ? 'text' : sc.block] = joinBlock(body, sc.block);
        else if (sc) err(step.line - 1, `"${cmd}" does not take a { } block`);
      }

      const rest = toks.slice(1);
      if (sc) {
        let pi = 0;
        for (const tk of rest) {
          if (tk.key !== undefined) {
            const ag = sc.args.find(x => x.n === tk.key);
            if (!ag) err(i, `${cmd}: unknown argument "${tk.key}"`); else step.args[ag.n] = convert(ag, tk.val);
          } else {
            while (pi < sc.args.length && step.args[sc.args[pi].n] !== undefined) pi++;
            const ag = sc.args[pi++];
            if (!ag) err(i, `${cmd}: too many arguments (${tk.val})`); else step.args[ag.n] = convert(ag, tk.val);
          }
        }
        for (const ag of sc.args) {
          if (step.args[ag.n] === undefined) {
            if (!ag.opt && ag.def === undefined) err(i, `${cmd}: missing ${ag.n}`);
            else if (ag.def !== undefined && !ag.opt) step.args[ag.n] = ag.def;
          }
        }
      } else {
        rest.forEach((tk, k) => { step.args[tk.key || `arg${k + 1}`] = tk.val; });
      }
      cur.steps.push(step);
    }
    res.header = headerLines.join('\n').replace(/\s+$/, '');
    return res;
  };

  // ------------------------------------------------------------------ writing text back
  const q = v => { const s = String(v); return (s === '' || /[\s"{}]/.test(s)) ? `"${s.replace(/"/g, '\\"')}"` : s; };
  function blockLines(text, kind) {
    if (kind === 'moves') return String(text || '').split(/[\s,]+/).filter(Boolean);
    return String(text || '').replace(/(\\[npl])/g, '$1\n').split('\n').map(s => s.trim()).filter((s, i, a) => s !== '' || a.length === 1);
  }
  E.stepToText = function (step) {
    if (step.cmd === '#') return '# ' + (step.args.text || '');
    if (step.cmd === 'end') return 'end';
    const sc = CMDS()[step.cmd];
    if (!sc) return [step.cmd, ...Object.entries(step.args).map(([k, v]) => `${k}=${q(v)}`)].join(' ');
    const parts = [step.cmd]; let positional = true;
    for (const ag of sc.args) {
      if (sc.block === 'text' && ag.n === 'text') continue;
      const v = step.args[ag.n];
      const empty = v === undefined || v === null || v === '' || (ag.t === 'bool' && !v);
      if (empty) { positional = false; continue; }
      if (positional) parts.push(ag.t === 'bool' ? 'yes' : q(v)); else parts.push(`${ag.n}=${ag.t === 'bool' ? 'yes' : q(v)}`);
    }
    let out = parts.join(' ');
    if (sc.block) {
      const key = sc.block === 'text' ? 'text' : sc.block;
      out += '\n{\n' + blockLines(step.args[key], sc.block).join('\n') + '\n}';
    }
    return out;
  };
  E.stringify = function (data) {
    const out = [];
    if (data.header) out.push(data.header, '');
    for (const name of data.order) {
      const s = data.scripts[name]; if (!s) continue;
      out.push(`start: "${name}"`);
      for (const st of s.steps) out.push(E.stepToText(st));
      const real = s.steps.filter(x => x.cmd !== '#');
      if (!real.length || real[real.length - 1].cmd !== 'end') out.push('end');
      out.push('');
    }
    return out.join('\n').replace(/\n+$/, '\n');
  };

  // ------------------------------------------------------------------ loading
  // window.OverworldScriptSource (a string or a list of strings) is read the first time a script is needed.
  E.load = function (force) {
    if (E.loaded && !force) return;
    E.loaded = true;
    const src = [].concat(window.OverworldScriptSource || []);
    E.scripts = {}; E.order = []; E.errors = [];
    src.forEach(text => {
      const r = E.parse(text);
      Object.assign(E.scripts, r.scripts);
      r.order.forEach(n => { if (!E.order.includes(n)) E.order.push(n); });
      r.errors.forEach(e => { E.errors.push(e); console.warn(`[script] line ${e.line}${e.script ? ' in "' + e.script + '"' : ''}: ${e.msg}`); });
    });
  };
  E.getScript = function (name) {
    E.load();
    const s = E.scripts[name];
    if (!s) return null;
    if (Array.isArray(s)) return { name, steps: s.map(o => { const { cmd, ...args } = o; return { cmd, args }; }) };   // old array format
    return s;
  };

  // ------------------------------------------------------------------ runner
  // ctxBase: { scene, host, preview, getFlag, setFlag, getVar, setVar }
  E.createRunner = function (getScript, ctxBase, name, onDone) {
    const stack = []; let finished = false;
    const push = (n) => { const s = getScript(n); if (!s) { console.warn(`[ScriptEngine] Script not found: ${n}`); return false; } stack.push({ name: n, steps: s.steps, pc: 0 }); return true; };
    const ctx = Object.assign({ choice: false }, ctxBase);
    ctx.jump = (label) => {
      const f = stack[stack.length - 1];
      const i = f.steps.findIndex(s => s.cmd === 'label' && String(s.args.name) === String(label));
      if (i < 0) { console.warn(`[ScriptEngine] Label not found in "${f.name}": ${label}`); return false; }
      f.pc = i + 1; return true;
    };
    ctx.call = (n) => { if (stack.length > 20) { console.warn('[ScriptEngine] call depth > 20'); return; } push(n); };
    ctx.ret = () => { stack.pop(); if (!stack.length) ctx.finish(); };
    ctx.stop = () => ctx.finish();
    ctx.finish = () => { if (finished) return; finished = true; try { if (ctx.host && ctx.host.end) ctx.host.end(); } finally { if (onDone) onDone(); } };

    function pump() {
      while (!finished) {
        const f = stack[stack.length - 1];
        if (!f) { ctx.finish(); return; }
        if (f.pc >= f.steps.length) { stack.pop(); if (!stack.length) { ctx.finish(); return; } continue; }
        const st = f.steps[f.pc++];
        if (st.cmd === '#') continue;
        if (st.cmd === 'end') { ctx.finish(); return; }
        if (ctx.onStep) ctx.onStep(st, f);
        const c = CMDS()[st.cmd];
        if (!c) { console.warn(`[ScriptEngine] Unknown command: ${st.cmd}`); continue; }
        let sync = true, called = false, doneSync = false;
        const next = () => { if (called) return; called = true; if (sync) doneSync = true; else pump(); };
        try { c.run(st.args, ctx, next); } catch (e) { console.error(`[ScriptEngine] ${st.cmd} failed:`, e); next(); }
        sync = false;
        if (!doneSync) return;     // waiting for an animation / button; next() will call pump() again
      }
    }
    ctx.start = () => { if (push(name)) pump(); else ctx.finish(); };
    return ctx;
  };

  // ------------------------------------------------------------------ save data: flags and variables
  const SD = () => (window.GameStateManager && window.GameStateManager.saveData) || null;
  E.getFlag = n => { const s = SD(); return !!(s && s.flags && s.flags[n]); };
  E.getVar = n => { const s = SD(); return (s && s.vars && Number(s.vars[n])) || 0; };
  E.save = () => { if (window.SaveSystem) window.SaveSystem.touch(); };   // no autosave: the player saves from the start menu (SaveSystem.save)
  E.setFlag = (n, on) => { const s = SD(); if (!s) return; s.flags = s.flags || {}; if (on) s.flags[n] = true; else delete s.flags[n]; E.save(); };
  E.setVar = (n, v) => { const s = SD(); if (!s) return; s.vars = s.vars || {}; s.vars[n] = v; E.save(); };
  E.isHidden = (mapKey, eventKey) => E.getFlag(`HIDDEN:${mapKey}:${eventKey}`);

  // ------------------------------------------------------------------ the game's "host": how things look in Phaser
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const MOVE_ALIAS = [[/^(exclaim|exclamation|alert)$/, 'emote_exclaim'], [/^(question|confused)$/, 'emote_question'], [/^heart$/, 'emote_heart'], [/^sweat$/, 'emote_sweat'], [/^walk_fast_/, 'run_'], [/^face_/, 'look_'], [/^walk_slow_/, 'walk_'], [/^step_/, 'walk_'], [/^hop_/, 'jump_']];

  // "walk_down*3 look_left" -> ['walk_down','walk_down','walk_down','look_left']
  E.expandMoves = function (text) {
    const out = [];
    String(text || '').split(/[\s,]+/).filter(Boolean).forEach(tok => {
      const m = /^(.+?)\*(\d+)$/.exec(tok);
      let n = 1; if (m) { tok = m[1]; n = Math.min(99, +m[2]); }
      for (const [re, rep] of MOVE_ALIAS) if (re.test(tok)) { tok = tok.replace(re, rep); break; }
      for (let i = 0; i < n; i++) out.push(tok);
    });
    return out;
  };

  E.makeHost = function (scene) {
    const OM = () => window.OverworldMovement;
    const pending = { n: 0, waiters: [], ends: [] };
    // how long a movement string lasts (ms), so the camera can be timed to the async movements that are running
    const tokMs = t => { let m; if ((m = /^delay_(\d+)$/.exec(t))) return +m[1]; if (/^run_/.test(t)) return 120; if (/^(walk|walk_in_place)_/.test(t)) return 240; if (/^jump_/.test(t)) return 300; if (/^spin_/.test(t)) return 560; if (/^emote_/.test(t)) return 800; return 0; };
    // the camera follows only the actual walking: from the first walk/run/jump step to the end of the last one (looks, emotes and delays at the edges don't count)
    const span = toks => { let t = 0, s = null, e = null; for (const k of toks) { const d = tokMs(k); if (/^(walk|run|jump)_(up|down|left|right)$/.test(k)) { if (s === null) s = t; e = t + d; } t += d; } return s === null ? null : { s, e }; };
    const syncPlan = fb => { const now = scene.time.now, L = pending.ends; if (!L.length) return { wait: 0, ms: fb }; const s = Math.min(...L.map(x => x.s)), e = Math.max(...L.map(x => x.e)), from = Math.max(now, s); return e - from > 60 ? { wait: Math.max(0, s - now), ms: e - from } : { wait: 0, ms: fb }; };
    // synced camera glide: own linear tween (no Phaser pan effect), always finishes, tracks a moving target
    function camTween(x0, y0, target, ms, done, ease) {
      const c = cam(); let fin = false; const ez = ease ? (k => -(Math.cos(Math.PI * k) - 1) / 2) : (k => k);
      const end = () => { if (fin) return; fin = true; const t = target(); c.centerOn(t.x, t.y); done(); };
      scene.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: tw => { if (fin) return; const k = ez(tw.getValue()), t = target(); c.centerOn(x0 + (t.x - x0) * k, y0 + (t.y - y0) * k); }, onComplete: end });
      scene.time.delayedCall(ms + 600, end);
    }
    const flush = () => { if (pending.n === 0) pending.waiters.splice(0).forEach(f => f()); };
    const cam = () => scene.cameras.main;

    function resolve(spec) {
      const s = String(spec == null || spec === '' ? 'npc' : spec);
      if (/^player$/i.test(s)) return scene.player;
      if (/^npc$/i.test(s)) return scene.activeNPC;
      const list = scene.npcs || [];
      return list.find(n => n.eventKey === s && n.mapName === scene.currentMapKey) || list.find(n => n.eventKey === s)
        || list.find(n => n.eventConfig && n.eventConfig.owID === s) || null;
    }
    function syncPlayer() {
      const p = scene.player, off = scene.getMapWorldOffset(scene.currentMapKey);
      scene.playerGridX = Math.round((p.x - 16) / 32 - off.x / 32);
      scene.playerGridY = Math.round((p.y - 16) / 32 - off.y / 32);
    }
    function runToken(e, tok, done) {
      const d = /^delay_(\d+)$/.exec(tok);
      if (d) { scene.time.delayedCall(+d[1], done); return; }
      // failsafe: a step that never reports back (blocked, unknown token, old movement_type.js) must not freeze the script forever
      let fin = false, tm = null;
      const fin1 = () => { if (fin) return; fin = true; if (tm) tm.remove(false); if (e === scene.player) syncPlayer(); done(); };
      tm = scene.time.delayedCall(tokMs(tok) + 2500, () => { if (!fin) console.warn('[script] movement "' + tok + '" never finished; continuing (is movement_type.js up to date?)'); fin1(); });
      OM().execute(e, tok, fin1, { force: true });
    }
    function findEvent(spec) {   // (mapKey, eventKey) of an event, hidden or not
      const s = String(spec);
      if (/^npc$/i.test(s) && scene.activeNPC) return { map: scene.activeNPC.mapName, key: scene.activeNPC.eventKey };
      const maps = window.OverworldMaps || {};
      if (maps[scene.currentMapKey] && maps[scene.currentMapKey].events && maps[scene.currentMapKey].events[s]) return { map: scene.currentMapKey, key: s };
      for (const [mk, m] of Object.entries(maps)) if (m.events && m.events[s]) return { map: mk, key: s };
      return null;
    }

    return {
      lock(on) { scene.isLocked = !!on; },
      wait(ms, next) { scene.time.delayedCall(Math.max(0, ms), next); },
      note(t) { console.log('[script]', t); },

      say(text, yesno, cb) {
        if (window.OverworldTextbox) { yesno ? window.OverworldTextbox.yesno(scene, text, cb) : window.OverworldTextbox.show(scene, text, () => cb()); return; }
        if (yesno && scene.showYesNoBox) return scene.showYesNoBox(text, cb);
        if (scene.showDialogueBox) return scene.showDialogueBox(text, () => cb());
        console.log('[Dialogue]', text); cb(true);
      },

      facePlayer(next) {
        const n = scene.activeNPC;
        if (!n || !scene.player) return next();
        const dx = scene.player.x - n.x, dy = scene.player.y - n.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        OM().execute(n, `look_${dir}`, next);
      },

      move(spec, moves, async, next) {
        const e = resolve(spec);
        if (!e) { console.warn(`[script] applymovement: nobody called "${spec}"`); return next(); }
        const toks = E.expandMoves(moves);
        const go = (done) => {
          let i = 0;
          const step = () => { if (i >= toks.length) { e.home = null; done(); return; } runToken(e, toks[i++], step); };
          step();
        };
        if (async) { const sp = span(toks), rec = sp && { s: scene.time.now + sp.s, e: scene.time.now + sp.e }; if (rec) pending.ends.push(rec); pending.n++; go(() => { pending.n--; const i = rec ? pending.ends.indexOf(rec) : -1; if (i >= 0) pending.ends.splice(i, 1); flush(); }); next(); } else go(next);
      },
      waitMove(next) { if (pending.n === 0) next(); else pending.waiters.push(next); },

      moveCamera(dx, dy, ms, next, sync) {
        if (sync) { const pl = syncPlan(ms); if (pl.wait > 0) return scene.time.delayedCall(pl.wait, () => this.moveCamera(dx, dy, pl.ms, next, 'go')); if (sync !== 'go') ms = pl.ms; }
        const c = cam(); c.stopFollow(); scene.camMoved = true;
        const m = c.midPoint, tx = m.x + dx * 32, ty = m.y + dy * 32;
        if (ms <= 0) { c.centerOn(tx, ty); return next(); }
        return camTween(m.x, m.y, () => ({ x: tx, y: ty }), ms, next, !sync);   // own tween: Phaser's pan effect swallows a pan started from the previous pan's callback
      },
      resetCamera(ms, next, sync) {
        if (sync) { const pl = syncPlan(ms); if (pl.wait > 0) return scene.time.delayedCall(pl.wait, () => this.resetCamera(pl.ms, next, 'go')); if (sync !== 'go') ms = pl.ms; }
        const c = cam(), p = scene.player, done = () => { c.startFollow(p, true, 1, 1); scene.camMoved = false; next(); };
        if (ms <= 0) { c.centerOn(p.x, p.y); return done(); }
        return camTween(c.midPoint.x, c.midPoint.y, () => ({ x: p.x, y: p.y }), ms, done, !sync);
      },

      fade(mode, ms, color, next) {
        if (color === 'last') color = scene._fadeCol || 'black';   // fadedefault: come back from the colour we faded to
        scene._fadeCol = color;
        const c = cam(), v = color === 'white' ? 255 : 0;
        if (mode === 'in') c.fadeIn(ms, v, v, v); else c.fadeOut(ms, v, v, v);
        scene.time.delayedCall(ms + 30, next);
      },
      flash(ms, color, next) {
        const rgb = { white: [255, 255, 255], black: [0, 0, 0], red: [255, 60, 60], yellow: [255, 235, 80] }[color] || [255, 255, 255];
        cam().flash(ms, rgb[0], rgb[1], rgb[2]); scene.time.delayedCall(ms + 20, next);
      },
      // screen look: CSS filter on the game canvas (works with the WebGL and the Canvas renderer); reset when the scene goes away
      filter(mode, ms) {
        const cv = scene.game && scene.game.canvas; if (!cv) return;
        const css = { sepia: 'sepia(1)', grayscale: 'grayscale(1)', inverted: 'invert(1)' }[mode] || '';
        cv.style.transition = ms > 0 ? `filter ${ms}ms linear` : 'none'; cv.style.filter = css;
        if (!scene._fxHook) { scene._fxHook = true; scene.events.once('shutdown', () => { const c2 = scene.game && scene.game.canvas; if (c2) { c2.style.filter = ''; c2.style.transition = ''; } scene._fxHook = false; }); }
      },
      shake(ms, power, next) { cam().shake(ms, power); scene.time.delayedCall(ms + 20, next); },
      weather(name) { if (scene.weather) scene.weather.set(name, false, scene.currentMapKey); },
      warp(map, x, y, facing, type, next) {
        scene.warping = false;
        scene.runWarp({ map, targetX: x, targetY: y, facing, warpType: type });
        const poll = () => { if (scene.warping) scene.time.delayedCall(80, poll); else scene.time.delayedCall(60, next); };
        poll();
      },
      sound(key) { if (scene.cache.audio.exists(key)) scene.sound.play(key); else console.warn(`[script] playse: sound "${key}" is not loaded`); },

      setHidden(spec, hide) {
        const ev = findEvent(spec);
        if (!ev) { console.warn(`[script] hideobject/showobject: no event called "${spec}"`); return; }
        E.setFlag(`HIDDEN:${ev.map}:${ev.key}`, hide);
        if (hide) {
          const n = (scene.npcs || []).find(x => x.eventKey === ev.key && x.mapName === ev.map);
          if (n) { scene.npcs.splice(scene.npcs.indexOf(n), 1); n.destroy(); if (scene.activeNPC === n) scene.activeNPC = null; }
        } else if (scene.spawnAllEvents) scene.spawnAllEvents();
      },

      // called when the script is over (also when it ends by itself without `release`)
      end() {
        if (scene.camMoved) { cam().startFollow(scene.player, true, 1, 1); scene.camMoved = false; }
        scene.isLocked = false; scene.scriptRunning = false;
        scene.scriptEndedAt = scene.time ? scene.time.now : 0;
      },
    };
  };

  // Called by the scene: talk to an NPC / step on a script tile
  E.runScript = function (scene, scriptName, onFinish) {
    if (!scriptName) { if (onFinish) onFinish(); return; }
    if (scene.scriptRunning) return;
    E.load();
    if (!E.getScript(scriptName)) { console.warn(`[ScriptEngine] Script not found: ${scriptName}`); if (onFinish) onFinish(); return; }
    scene.scriptRunning = true;   // from now on no NPC starts a new move and the player cannot walk
    const run = E.createRunner(E.getScript, {
      scene, host: E.makeHost(scene), preview: false,
      getFlag: E.getFlag, setFlag: E.setFlag, getVar: E.getVar, setVar: E.setVar,
    }, scriptName, onFinish);
    // [LOCK] NPCs that are in the middle of a normal step stop at once (js/movement_type.js), then the script starts in the same frame
    if (window.OverworldMovement && window.OverworldMovement.freezeAll) window.OverworldMovement.freezeAll(scene);
    run.start();
  };

  // Silent run for the level script type "Before Map Load": no text, no movement, no waiting. Flags, variables and hideobject / showobject work at once.
  // opts.flagOnly = true: the map is not built yet, so hide / show only write the flag (the map build reads it)
  E.runSilent = function (scene, scriptName, opts) {
    if (!scriptName) return;
    E.load();
    if (!E.getScript(scriptName)) { console.warn(`[ScriptEngine] Script not found: ${scriptName}`); return; }
    const flagOnly = !!(opts && opts.flagOnly);
    const find = (spec) => {
      const s = String(spec), maps = window.OverworldMaps || {}, cur = (opts && opts.mapKey) || scene.currentMapKey;
      if (maps[cur] && maps[cur].events && maps[cur].events[s]) return { map: cur, key: s };
      for (const [mk, m] of Object.entries(maps)) if (m.events && m.events[s]) return { map: mk, key: s };
      return null;
    };
    const none = () => { };
    const host = {
      setHidden(spec, hide) {
        const ev = find(spec);
        if (!ev) { console.warn(`[script] before map load: no event called "${spec}"`); return; }
        E.setFlag(`HIDDEN:${ev.map}:${ev.key}`, hide);
        if (flagOnly) return;
        if (hide) { const n = (scene.npcs || []).find(x => x.eventKey === ev.key && x.mapName === ev.map); if (n) { scene.npcs.splice(scene.npcs.indexOf(n), 1); n.destroy(); } }
        else if (scene.spawnAllEvents) scene.spawnAllEvents();
      },
      end: none, lock: none, note: none,
    };
    const h = new Proxy(host, { get: (t, k) => (k in t ? t[k] : (...a) => { const cb = a.find(x => typeof x === 'function'); if (cb) cb(true); }) });
    E.createRunner(E.getScript, { scene, host: h, preview: false, getFlag: E.getFlag, setFlag: E.setFlag, getVar: E.getVar, setVar: E.setVar }, scriptName, null).start();
  };

  return E;
})();