// ===========================================================================
// overworld_script_commands.js  -  THE COMMAND LIST
//
// Every command you can write in overworld_scripts.js lives here. Each entry says:
//   group : where it appears in the editor's "add command" menu
//   help  : one line shown in the editor
//   args  : the arguments, in the order you type them:  { n:name, t:type, opt:true if optional, def:default, opts:[choices], h:help }
//           types: text, num, bool, flag, var, label, script, target, dir, map, select (uses opts)
//   block : (optional) the command takes a { ... } block. 'text' = a message, 'moves' = a list of movements
//   run   : what the game does:  run(a, ctx, next)   - a = the arguments, call next() when the command is finished
//
// How to add a command:  copy one of the entries below, change the name and the run() function.
// The editor reads this file, so the new command shows up in the Scripts editor by itself.
//
// "ctx" (what run() can use):
//   ctx.scene            the Phaser scene (game only)          ctx.preview   true when run by the editor's preview
//   ctx.host.*           visual things (message box, movement, camera ...) - the game and the preview each have their own
//   ctx.getFlag(n) ctx.setFlag(n, bool) ctx.getVar(n) ctx.setVar(n, number)
//   ctx.jump(label)  ctx.call(scriptName)  ctx.ret()  ctx.stop()  ctx.choice (last yes/no answer)
// ===========================================================================

window.OverworldScriptCommands = (() => {
  const A = (n, t, opt, def, h, opts) => ({ n, t, opt: !!opt, def, h, opts });
  const DIRS = ['up', 'down', 'left', 'right'];
  const C = {};
  const def = (name, group, help, args, run, block) => { C[name] = { group, help, args, run, block }; };

  // ------------------------------------------------------------------ control
  def('lock', 'Control', 'Freeze the player and the NPCs (while a script talks)', [], (a, ctx, next) => { ctx.host.lock(true); next(); });
  def('release', 'Control', 'Let the player and the NPCs move again', [], (a, ctx, next) => { ctx.host.lock(false); next(); });
  def('wait', 'Control', 'Pause the script', [A('ms', 'num', 0, 500, 'milliseconds')], (a, ctx, next) => ctx.host.wait(+a.ms || 0, next));
  def('goto', 'Control', 'Jump to a label', [A('label', 'label')], (a, ctx, next) => { ctx.jump(a.label); next(); });
  def('call', 'Control', 'Run another script, then come back here', [A('script', 'script')], (a, ctx, next) => { ctx.call(a.script); next(); });
  def('return', 'Control', 'Go back to the script that used `call` (or end this one)', [], (a, ctx, next) => { ctx.ret(); next(); });
  def('end', 'Control', 'Stop the script here', [], (a, ctx, next) => { ctx.stop(); });
  def('label', 'Control', 'A place to jump to with goto', [A('name', 'label')], (a, ctx, next) => next());

  const cond = (name, help, test) => def(name, 'Control', help, [A('flag', 'flag'), A('label', 'label')], (a, ctx, next) => { if (test(ctx.getFlag(a.flag))) ctx.jump(a.label); next(); });
  cond('goto_if_set', 'Jump if the flag is set', v => v);
  cond('goto_if_unset', 'Jump if the flag is NOT set', v => !v);
  const condCall = (name, help, test) => def(name, 'Control', help, [A('flag', 'flag'), A('script', 'script')], (a, ctx, next) => { if (test(ctx.getFlag(a.flag))) ctx.call(a.script); next(); });
  condCall('call_if_set', 'Run a script if the flag is set', v => v);
  condCall('call_if_unset', 'Run a script if the flag is NOT set', v => !v);
  def('goto_if_yes', 'Control', 'After msgbox.yesno: jump if the answer was Yes', [A('label', 'label')], (a, ctx, next) => { if (ctx.choice) ctx.jump(a.label); next(); });
  def('goto_if_no', 'Control', 'After msgbox.yesno: jump if the answer was No', [A('label', 'label')], (a, ctx, next) => { if (!ctx.choice) ctx.jump(a.label); next(); });
  const cmp = (name, help, f) => def(name, 'Control', help, [A('var', 'var'), A('value', 'num'), A('label', 'label')], (a, ctx, next) => { if (f(ctx.getVar(a.var), +a.value)) ctx.jump(a.label); next(); });
  cmp('goto_if_eq', 'Jump if variable = value', (x, y) => x === y);
  cmp('goto_if_ne', 'Jump if variable != value', (x, y) => x !== y);
  cmp('goto_if_lt', 'Jump if variable < value', (x, y) => x < y);
  cmp('goto_if_gt', 'Jump if variable > value', (x, y) => x > y);

  // ------------------------------------------------------------------ flags / variables
  def('setflag', 'Flags', 'Set a flag (for example FLAG_GOT_STARTER)', [A('flag', 'flag')], (a, ctx, next) => { ctx.setFlag(a.flag, true); next(); });
  def('clearflag', 'Flags', 'Clear a flag', [A('flag', 'flag')], (a, ctx, next) => { ctx.setFlag(a.flag, false); next(); });
  def('setvar', 'Flags', 'Set a variable to a number', [A('var', 'var'), A('value', 'num', 0, 0)], (a, ctx, next) => { ctx.setVar(a.var, +a.value || 0); next(); });
  def('addvar', 'Flags', 'Add a number to a variable', [A('var', 'var'), A('amount', 'num', 0, 1)], (a, ctx, next) => { ctx.setVar(a.var, ctx.getVar(a.var) + (+a.amount || 0)); next(); });

  // ------------------------------------------------------------------ messages
  def('msgbox.normal', 'Message', 'Show a message. \\n = new line, \\p = new paragraph, $player = player name',
    [A('text', 'text')], (a, ctx, next) => ctx.host.say(a.text, false, () => next()), 'text');
  def('msgbox.yesno', 'Message', 'Ask Yes / No. Then use goto_if_yes / goto_if_no',
    [A('text', 'text')], (a, ctx, next) => ctx.host.say(a.text, true, (yes) => { ctx.choice = !!yes; next(); }), 'text');
  def('faceplayer', 'Message', 'Make the NPC you talked to look at the player', [], (a, ctx, next) => ctx.host.facePlayer(next));

  // ------------------------------------------------------------------ movement
  def('applymovement', 'Movement', 'Move the player, an NPC or an event. Waits until it is finished (unless async)',
    [A('target', 'target', 0, 'npc', 'player, npc (the one you talked to) or an event name like NPC_Portia'), A('async', 'bool', 1, false, 'do not wait, use waitmovement later')],
    (a, ctx, next) => ctx.host.move(a.target, a.moves, !!a.async, next), 'moves');
  def('waitmovement', 'Movement', 'Wait until every async movement is finished', [], (a, ctx, next) => ctx.host.waitMove(next));
  def('movecamera', 'Movement', 'Slide the camera by some tiles (dx right, dy down)',
    [A('dx', 'num', 0, 0, 'tiles right (negative = left)'), A('dy', 'num', 0, 0, 'tiles down (negative = up)'), A('ms', 'num', 1, 800, 'duration')],
    (a, ctx, next) => ctx.host.moveCamera(+a.dx || 0, +a.dy || 0, a.ms == null || a.ms === '' ? 800 : +a.ms, next));
  def('resetcamera', 'Movement', 'Slide the camera back to the player',
    [A('ms', 'num', 1, 800, 'duration')], (a, ctx, next) => ctx.host.resetCamera(a.ms == null || a.ms === '' ? 800 : +a.ms, next));
  def('hideobject', 'Movement', 'Hide an NPC / event for good (until showobject)', [A('target', 'target', 0, 'npc')], (a, ctx, next) => { ctx.host.setHidden(a.target, true); next(); });
  def('showobject', 'Movement', 'Show a hidden NPC / event again', [A('target', 'target')], (a, ctx, next) => { ctx.host.setHidden(a.target, false); next(); });

  // ------------------------------------------------------------------ screen
  def('fadescreen', 'Screen', 'Fade the screen out (to a colour) or back in',
    [A('mode', 'select', 0, 'out', '', ['out', 'in']), A('ms', 'num', 1, 500, 'duration'), A('color', 'select', 1, 'black', '', ['black', 'white'])],
    (a, ctx, next) => ctx.host.fade(a.mode === 'in' ? 'in' : 'out', a.ms == null || a.ms === '' ? 500 : +a.ms, a.color === 'white' ? 'white' : 'black', next));
  def('shakecamera', 'Screen', 'Shake the screen',
    [A('ms', 'num', 1, 400, 'duration'), A('power', 'num', 1, 0.01, 'strength (0.005 small, 0.02 big)')],
    (a, ctx, next) => ctx.host.shake(a.ms == null || a.ms === '' ? 400 : +a.ms, a.power == null || a.power === '' ? 0.01 : +a.power, next));
  def('setweather', 'Screen', 'Change the weather until the player enters another map',
    [A('weather', 'select', 0, 'Rain', '', ['Normal', 'Sunny', 'Drought', 'Rain', 'Thunderstorm', 'Snow', 'Fog', 'Sandstorm', 'Volcanic Ash'])],
    (a, ctx, next) => { ctx.host.weather(a.weather); next(); });
  def('warp', 'Screen', 'Move the player to another map',
    [A('map', 'map'), A('x', 'num'), A('y', 'num'), A('facing', 'select', 1, 'down', '', DIRS), A('type', 'select', 1, 'Normal', '', ['Normal', 'Teleport', 'Hole'])],
    (a, ctx, next) => ctx.host.warp(a.map, +a.x || 0, +a.y || 0, a.facing || 'down', a.type || 'Normal', next));
  def('playse', 'Screen', 'Play a sound that is already loaded (its key)', [A('sound', 'text')], (a, ctx, next) => { ctx.host.sound(a.sound); next(); });

  // ------------------------------------------------------------------ pokemon
  def('givepokemon', 'Pokémon', 'Give the player a Pokémon (goes to the PC when the party is full)',
    [A('species', 'text', 0, 'SPECIES_BULBASAUR'), A('level', 'num', 0, 5), A('nickname', 'text', 1, ''), A('nature', 'text', 1, 'NATURE_HARDY'),
      A('shiny', 'bool', 1, false), A('item', 'text', 1, '', 'held item'), A('moves', 'text', 1, '', 'MOVE_A,MOVE_B,...')],
    (a, ctx, next) => {
      if (ctx.preview) { ctx.host.note(`Gives ${a.nickname || a.species} (Lv ${a.level || 5})`); return next(); }
      const speciesKey = a.species || 'SPECIES_EELEKTROSS_M';
      const level = +a.level || 5;
      const db = typeof PokemonDatabase !== 'undefined' ? PokemonDatabase : window.PokemonDatabase;
      const sd = db ? (db[speciesKey] || db[speciesKey.replace(/_[MF]$/, '')]) : null;
      const b = k => (sd && sd[k] ? sd[k] : 50);
      const calcStat = (base) => Math.floor(((2 * base + 31) * level) / 100) + 5;
      const calcHP = (base) => Math.floor(((2 * base + 31) * level) / 100) + level + 10;
      const gs = window.GameStateManager && window.GameStateManager.saveData;
      const pname = gs && gs.player ? gs.player.name : 'Player';
      const mapName = String(ctx.scene.currentMapKey || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      const moves = a.moves ? String(a.moves).split(',').map(s => s.trim()).filter(Boolean).slice(0, 4).map(m => ({ moveId: m, currentPP: 35, maxPP: 35 })) : [{ moveId: 'MOVE_TACKLE', currentPP: 35, maxPP: 35 }];
      const mon = {
        species: speciesKey, nickname: a.nickname || null, level,
        HP: calcHP(b('baseHP')), maxHP: calcHP(b('baseHP')), Attack: calcStat(b('baseAttack')), Def: calcStat(b('baseDefense')),
        spattack: calcStat(b('baseSpAttack')), sdpef: calcStat(b('baseSpDefense')), speed: calcStat(b('baseSpeed')),
        ivhp: 31, ivatk: 31, ivdef: 31, ivspd: 31, ivspa: 31, ivspe: 31,
        nature: a.nature || 'NATURE_HARDY', ability: (sd && sd.ability1) || 'ABILITY_NONE', teraType: 'TYPE_NORMAL',
        isShiny: a.shiny ? 1 : 0, heldItem: a.item || null, pokerus: 0, friendship: 70, isHatched: true, paradoxPoint: 0, manaPoint: 50, ballId: 4,
        cool: 0, cute: 0, smart: 0, tough: 0, beauty: 0, sheen: 0,
        OTID: 54321, OTsecretID: 12345, OTName: pname, latestOTID: 54321, latestOTName: pname, caughtloc: mapName,
        moves,
        markings: { circle: false, triangle: false, square: false, heart: false, star: false, diamond: false },
        ribbons: [],
        superTrainingFlags: { hpMedal: false, atkMedal: false, defMedal: false, spatkMedal: false, spdefMedal: false, speedMedal: false },
      };
      if (window.Dex) window.Dex.catch(speciesKey, a.shiny === true || a.shiny === 'true');   // Pokedex: caught
      if (window.GivePokemonSystem && typeof window.GivePokemonSystem.give === 'function') window.GivePokemonSystem.give(mon);
      else console.warn('[ScriptEngine] GivePokemonSystem not found!');
      next();
    });

  def('trainerbattle', 'Pokémon', 'Start a trainer battle',
    [A('trainerID', 'text'), A('matchType', 'select', 1, 'single', '', ['single', 'double']), A('pokemon', 'text', 1, '', 'optional: SPECIES_A:level,SPECIES_B:level (default: the team in TrainerTable)')],
    (a, ctx, next) => {
      if (ctx.preview) { ctx.host.note(`Battle: ${a.trainerID}`); return next(); }
      const scene = ctx.scene;
      const pokemon = a.pokemon ? String(a.pokemon).split(',').map(s => s.trim()).filter(Boolean).map(s => { const [sp, lv] = s.split(':'); return { species: sp, level: +lv || 5 }; }) : [];
      console.log(`[ScriptEngine] Initiating trainer battle: ${a.trainerID} (${a.matchType || 'single'})`);
      if (scene.sound && scene.sound.stopAll) scene.sound.stopAll();
      if (window.GameStateManager && pokemon.length) {
        const m = pokemon[0], old = window.GameStateManager.opponentPartyMon1 || {};
        window.GameStateManager.opponentPartyMon1 = { species: m.species || old.species, level: m.level || 5, isShiny: m.isShiny !== undefined ? m.isShiny : 1 };
      }
      ctx.finish();   // the script is over, the scene is about to change
      scene.scene.start('BattleScene', { name: a.trainerID, trainerID: a.trainerID, matchType: a.matchType || 'single', pokemon });   // no `pokemon` given: BattleScene reads the team from TrainerTable
    });

  // ------------------------------------------------------------------ items (js/ItemSystem.js, tables/ItemTables.js)
  // giveitem / additemtopc / removeitem / removeitemfrompc / checkitem / checkitemfrompc answer in ctx.choice, like msgbox.yesno does:
  // use goto_if_yes / goto_if_no right after them (no: the bag had no room / the player did not have the item).
  const IS = () => window.ItemSystem;
  const itemArgs = [A('item', 'text', 0, 'ITEM_POTION', 'ITEM_POTION, or just Potion'), A('count', 'num', 1, 1)];
  const itemOf = (a, ctx) => {
    const sys = IS(); if (!sys) { console.warn('[ScriptEngine] ItemSystem.js is not loaded'); return null; }
    const k = sys.key(a.item); if (!k) { console.warn(`[ScriptEngine] Unknown item: ${a.item}`); return null; }
    return { sys, k, n: Math.max(1, Math.floor(+a.count || 1)) };
  };
  def('giveitem', 'Items', 'Put an item in the bag and say so. goto_if_no afterwards = the bag was full',
    [...itemArgs, A('silent', 'bool', 1, false, 'no message')], (a, ctx, next) => {
      if (ctx.preview) { ctx.host.note(`Gives ${a.count || 1} x ${a.item}`); ctx.choice = true; return next(); }
      const o = itemOf(a, ctx); if (!o) { ctx.choice = false; return next(); }
      const put = o.sys.add(o.k, o.n), name = o.sys.name(o.k); ctx.choice = put >= o.n;
      if (a.silent === true || a.silent === 'true') return next();
      ctx.host.say(put ? `$player obtained ${name}${put > 1 ? ' x' + put : ''}!` : `$player has no room for ${name}.`, false, () => next());
    });
  def('additemtopc', 'Items', 'Put an item in the item storage of the PC (silent)', itemArgs, (a, ctx, next) => {
    if (ctx.preview) { ctx.host.note(`Sends ${a.count || 1} x ${a.item} to the PC`); return next(); }
    const o = itemOf(a, ctx); ctx.choice = !!o && o.sys.add(o.k, o.n, 'pc') >= o.n; next();
  });
  def('removeitem', 'Items', 'Take an item out of the bag (silent). goto_if_no afterwards = the player did not have enough', itemArgs, (a, ctx, next) => {
    if (ctx.preview) { ctx.host.note(`Takes ${a.count || 1} x ${a.item}`); return next(); }
    const o = itemOf(a, ctx); ctx.choice = !!o && o.sys.remove(o.k, o.n); next();
  });
  def('removeitemfrompc', 'Items', 'Take an item out of the PC item storage (silent)', itemArgs, (a, ctx, next) => {
    if (ctx.preview) { ctx.host.note(`Takes ${a.count || 1} x ${a.item} from the PC`); return next(); }
    const o = itemOf(a, ctx); ctx.choice = !!o && o.sys.remove(o.k, o.n, 'pc'); next();
  });
  def('checkitem', 'Items', 'Does the bag hold the item? Then goto_if_yes / goto_if_no', itemArgs, (a, ctx, next) => {
    if (ctx.preview) { ctx.choice = true; return next(); }
    const o = itemOf(a, ctx); ctx.choice = !!o && o.sys.has(o.k, o.n); next();
  });
  def('checkitemfrompc', 'Items', 'Does the PC item storage hold the item? Then goto_if_yes / goto_if_no', itemArgs, (a, ctx, next) => {
    if (ctx.preview) { ctx.choice = true; return next(); }
    const o = itemOf(a, ctx); ctx.choice = !!o && o.sys.has(o.k, o.n, 'pc'); next();
  });
  def('openbag', 'Items', 'Open the bag; the script goes on when the player closes it', [], (a, ctx, next) => {
    if (ctx.preview || !window.BagMenu) { if (!ctx.preview) console.warn('[ScriptEngine] BagMenu.js is not loaded'); return next(); }
    window.BagMenu.open(ctx.scene, { mode: 'bag', onClose: () => next() });
  });
  def('openpcitems', 'Items', 'Open the item storage of the PC (withdraw / deposit / toss)', [], (a, ctx, next) => {
    if (ctx.preview || !window.BagMenu) { if (!ctx.preview) console.warn('[ScriptEngine] BagMenu.js is not loaded'); return next(); }
    window.BagMenu.open(ctx.scene, { mode: 'storage', onClose: () => next() });
  });

  // ------------------------------------------------------------------ Aide's Log (quests, start menu page 2)
  const QS = () => window.Quests;
  const noQ = () => { console.warn('[ScriptEngine] StartMenu.js is not loaded (Quests API missing)'); return null; };
  def('addquest', "Aide's Log", "Add (or update) a task in the Aide's Log", [A('id', 'text', 0, 'find_rotom', 'short name, no spaces'), A('title', 'text', 0, 'Find the Rotom'), A('text', 'text', 1, '', 'description'), A('giver', 'text', 1, '', 'who asked')],
    (a, ctx, next) => { if (ctx.preview) { ctx.host.note(`Log: new task "${a.title}"`); return next(); } if (!QS()) noQ(); else QS().add(a.id, a.title, a.text, a.giver); next(); });
  def('addqueststep', "Aide's Log", 'Add a step to a task, or tick it off (done = true)', [A('id', 'text', 0, 'find_rotom'), A('step', 'text', 0, 'Search the cave'), A('done', 'bool', 1, false)],
    (a, ctx, next) => { if (ctx.preview) { ctx.host.note(`Log: step "${a.step}"`); return next(); } if (!QS()) noQ(); else QS().step(a.id, a.step, a.done === true || a.done === 'true'); next(); });
  def('completequest', "Aide's Log", 'Mark a task as finished', [A('id', 'text', 0, 'find_rotom')],
    (a, ctx, next) => { if (ctx.preview) { ctx.host.note(`Log: finished "${a.id}"`); return next(); } if (!QS()) noQ(); else QS().complete(a.id); next(); });
  def('checkquest', "Aide's Log", 'Is the task in the log? status = active / done. Then goto_if_yes / goto_if_no', [A('id', 'text', 0, 'find_rotom'), A('status', 'text', 1, 'done', 'done or active')],
    (a, ctx, next) => { if (ctx.preview) { ctx.choice = true; return next(); } const q = QS() && QS().get(a.id); ctx.choice = !!q && (q.status === (a.status || 'done')); next(); });
  def('openmenu', 'Menu', 'Open the start menu (screen: pokedex / map / log / card / save / options)', [A('screen', 'text', 1, '', 'optional')],
    (a, ctx, next) => { if (ctx.preview || !window.StartMenu) return next(); window.StartMenu.open(ctx.scene, { screen: ({ pokedex: 'dex', rotomdex: 'dex', map: 'map', townmap: 'map', log: 'log', card: 'card', save: 'save', options: 'options', nav: 'nav' })[String(a.screen || '').toLowerCase()], onClose: () => next() }); });

  // ------------------------------------------------------------------ naming screens (js/PokemonSummary.js)
  def('nameplayer', 'Player', "Open the naming screen for the player's name (stored in saveData.player.name)", [A('gender', 'text', 1, '', 'male or female (picture); empty = from the save'), A('max', 'num', 1, 7, 'longest name')],
    (a, ctx, next) => {
      if (ctx.preview) { ctx.host.note('Asks for the player name'); return next(); }
      if (!window.PokemonSummary || !window.PokemonSummary.namePlayer) { console.warn('[ScriptEngine] js/PokemonSummary.js is not loaded'); return next(); }
      window.PokemonSummary.namePlayer(ctx.scene, { gender: a.gender || undefined, max: +a.max || 7, onDone: () => next() });
    });
  def('namepokemon', 'Pokémon', 'Open the nickname screen for a party Pokémon (slot 1 = first)', [A('slot', 'num', 0, 1)],
    (a, ctx, next) => {
      if (ctx.preview) { ctx.host.note(`Asks for a nickname for party slot ${a.slot || 1}`); return next(); }
      const gs = window.GameStateManager && window.GameStateManager.saveData, mon = gs && gs.party && gs.party[(+a.slot || 1) - 1];
      if (!mon || !window.PokemonSummary || !window.PokemonSummary.nameMon) return next();
      window.PokemonSummary.nameMon(ctx.scene, mon, { onDone: () => next() });
    });

  return C;
})();
