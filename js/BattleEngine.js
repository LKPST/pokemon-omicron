/* =====================================================================================================================
   BattleEngine.js  --  singles battle logic for the Phaser game (no rendering, no DOM).
   Rules are ported from CFRU-expansion: attackcanceler.c (order of "can the mon move"), accuracy_calc.c (accuracy),
   damage_calc.c (damage formula, crit, STAB, weather, ability/item modifiers), end_turn.c (end-of-turn order),
   exp.c (scaled exp), catching.c (catch odds).  Config defaults follow CFRU's config.h: Gen 6+ crit (1.5x),
   crit stages 1/24, 1/8, 1/2, always; confusion hits itself 33%; frostbite replaces freeze (special damage halved).

   usage
     const b = BattleEngine.create({ db, moves, learn, evo, types, player:[saveMon...], foe:[saveMon...], kind:'wild'|'trainer' });
     b.start()                         -> events (intro, switch-in abilities)
     b.turn({type:'move',slot:0}, null)-> events; foe action is chosen by the AI when null
       actions: {type:'move',slot} {type:'switch',to} {type:'ball',ball:'ULTRA'} {type:'run'} {type:'item',item,target}
     b.pending                         -> null | {type:'switch'} | {type:'learn', mon, move} | {type:'end', result}
     b.switchTo(idx) / b.resolveLearn(slot|-1)
     b.commit()                        -> writes HP/PP/status/exp/level back into the save mons you passed in
   events are plain objects, the screen plays them in order (see EVENTS at the bottom of this file).
   ===================================================================================================================== */
(function (root) {
'use strict';

// ------------------------------------------------------------------------------------------------ small helpers
const NORM = s => String(s == null ? '' : s).toUpperCase().replace(/^(ABILITY|ITEM|MOVE|SPECIES|TYPE|NATURE)_/, '').replace(/[^A-Z0-9]/g, '');
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const imul = Math.imul;
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = imul(t ^ (t >>> 15), t | 1); t ^= t + imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const prettyKey = k => String(k || '').replace(/^(SPECIES|MOVE|TYPE|ABILITY|ITEM)_/, '').toLowerCase().split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
const STATS = ['atk', 'def', 'spa', 'spd', 'spe'];
const STAT_NAMES = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' };
const sm = (stat, stage) => stage >= 0 ? Math.floor(stat * (2 + stage) / 2) : Math.floor(stat * 2 / (2 - stage));   // gStatStageRatios

// ------------------------------------------------------------------------------------------------ natures, growth
const NATURES = ['HARDY','LONELY','BRAVE','ADAMANT','NAUGHTY','BOLD','DOCILE','RELAXED','IMPISH','LAX','TIMID','HASTY','SERIOUS','JOLLY','NAIVE','MODEST','MILD','QUIET','BASHFUL','RASH','CALM','GENTLE','SASSY','CAREFUL','QUIRKY'];
function natureMods(n) { // returns {atk,def,spe,spa,spd} multipliers (percent)
  let i = typeof n === 'number' ? n : NATURES.indexOf(NORM(n)); const m = { atk: 100, def: 100, spe: 100, spa: 100, spd: 100 };
  if (i < 0) return m; const up = Math.floor(i / 5), dn = i % 5, order = ['atk', 'def', 'spe', 'spa', 'spd'];
  if (up !== dn) { m[order[up]] = 110; m[order[dn]] = 90; } return m; }
function expForLevel(growth, n) {
  n = clamp(n | 0, 1, 100); const g = NORM(growth), c = n * n * n;
  switch (g) {
    case 'GROWTHFAST': return Math.floor(4 * c / 5);
    case 'GROWTHMEDIUMSLOW': return Math.max(0, Math.floor(6 * c / 5) - 15 * n * n + 100 * n - 140);
    case 'GROWTHSLOW': return Math.floor(5 * c / 4);
    case 'GROWTHERRATIC': return n <= 50 ? Math.floor(c * (100 - n) / 50) : n <= 68 ? Math.floor(c * (150 - n) / 100) : n <= 98 ? Math.floor(c * Math.floor((1911 - 10 * n) / 3) / 500) : Math.floor(c * (160 - n) / 100);
    case 'GROWTHFLUCTUATING': return n <= 15 ? Math.floor(c * (Math.floor((n + 1) / 3) + 24) / 50) : n <= 36 ? Math.floor(c * (n + 14) / 50) : Math.floor(c * (Math.floor(n / 2) + 32) / 50);
    default: return c;                                                                                   // medium fast
  } }
function calcStat(base, iv, ev, level, mod) { return Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5) * mod / 100); }
function calcHP(base, iv, ev, level) { return base === 1 ? 1 : Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10; }

// ------------------------------------------------------------------------------------------------ type chart fallback
const FALLBACK_CHART = (() => {
  const t = {}; const set = (a, list, v) => { for (const d of list.split(' ')) { (t[a] = t[a] || {})['TYPE_' + d] = v; } };
  set('TYPE_NORMAL', 'ROCK STEEL', .5); set('TYPE_NORMAL', 'GHOST', 0);
  set('TYPE_FIRE', 'GRASS ICE BUG STEEL', 2); set('TYPE_FIRE', 'FIRE WATER ROCK DRAGON', .5);
  set('TYPE_WATER', 'FIRE GROUND ROCK', 2); set('TYPE_WATER', 'WATER GRASS DRAGON', .5);
  set('TYPE_ELECTRIC', 'WATER FLYING', 2); set('TYPE_ELECTRIC', 'ELECTRIC GRASS DRAGON', .5); set('TYPE_ELECTRIC', 'GROUND', 0);
  set('TYPE_GRASS', 'WATER GROUND ROCK', 2); set('TYPE_GRASS', 'FIRE GRASS POISON FLYING BUG DRAGON STEEL', .5);
  set('TYPE_ICE', 'GRASS GROUND FLYING DRAGON', 2); set('TYPE_ICE', 'FIRE WATER ICE STEEL', .5);
  set('TYPE_FIGHTING', 'NORMAL ICE ROCK DARK STEEL', 2); set('TYPE_FIGHTING', 'POISON FLYING PSYCHIC BUG FAIRY', .5); set('TYPE_FIGHTING', 'GHOST', 0);
  set('TYPE_POISON', 'GRASS FAIRY', 2); set('TYPE_POISON', 'POISON GROUND ROCK GHOST', .5); set('TYPE_POISON', 'STEEL', 0);
  set('TYPE_GROUND', 'FIRE ELECTRIC POISON ROCK STEEL', 2); set('TYPE_GROUND', 'GRASS BUG', .5); set('TYPE_GROUND', 'FLYING', 0);
  set('TYPE_FLYING', 'GRASS FIGHTING BUG', 2); set('TYPE_FLYING', 'ELECTRIC ROCK STEEL', .5);
  set('TYPE_PSYCHIC', 'FIGHTING POISON', 2); set('TYPE_PSYCHIC', 'PSYCHIC STEEL', .5); set('TYPE_PSYCHIC', 'DARK', 0);
  set('TYPE_BUG', 'GRASS PSYCHIC DARK', 2); set('TYPE_BUG', 'FIRE FIGHTING POISON FLYING GHOST STEEL FAIRY', .5);
  set('TYPE_ROCK', 'FIRE ICE FLYING BUG', 2); set('TYPE_ROCK', 'FIGHTING GROUND STEEL', .5);
  set('TYPE_GHOST', 'PSYCHIC GHOST', 2); set('TYPE_GHOST', 'DARK', .5); set('TYPE_GHOST', 'NORMAL', 0);
  set('TYPE_DRAGON', 'DRAGON', 2); set('TYPE_DRAGON', 'STEEL', .5); set('TYPE_DRAGON', 'FAIRY', 0);
  set('TYPE_DARK', 'PSYCHIC GHOST', 2); set('TYPE_DARK', 'FIGHTING DARK FAIRY', .5);
  set('TYPE_STEEL', 'ICE ROCK FAIRY', 2); set('TYPE_STEEL', 'FIRE WATER ELECTRIC STEEL', .5);
  set('TYPE_FAIRY', 'FIGHTING DRAGON DARK', 2); set('TYPE_FAIRY', 'FIRE POISON STEEL', .5);
  return { multiplier(a, defs) { let m = 1; const row = t[a] || {}; for (const d of [].concat(defs)) { if (!d || d === 'TYPE_NONE') continue; const v = row[d]; if (v !== undefined) m *= v; } return m; } };
})();

// item/ability knowledge used by the calc (names are the keys with ITEM_/ABILITY_ and underscores removed)
const TYPE_ITEMS = { FIRE: 'CHARCOAL FLAMEPLATE', WATER: 'MYSTICWATER SEAINCENSE WAVEINCENSE SPLASHPLATE', GRASS: 'MIRACLESEED ROSEINCENSE MEADOWPLATE', ELECTRIC: 'MAGNET ZAPPLATE', ICE: 'NEVERMELTICE ICICLEPLATE', FIGHTING: 'BLACKBELT FISTPLATE', POISON: 'POISONBARB TOXICPLATE', GROUND: 'SOFTSAND EARTHPLATE', FLYING: 'SHARPBEAK SKYPLATE', PSYCHIC: 'TWISTEDSPOON ODDINCENSE MINDPLATE', BUG: 'SILVERPOWDER INSECTPLATE', ROCK: 'HARDSTONE ROCKINCENSE STONEPLATE', GHOST: 'SPELLTAG SPOOKYPLATE', DRAGON: 'DRAGONFANG DRACOPLATE', DARK: 'BLACKGLASSES DREADPLATE', STEEL: 'METALCOAT IRONPLATE', NORMAL: 'SILKSCARF', FAIRY: 'PIXIEPLATE' };
const TYPE_ITEM_MAP = {}; for (const [t, l] of Object.entries(TYPE_ITEMS)) for (const i of l.split(' ')) TYPE_ITEM_MAP[i] = 'TYPE_' + t;
const RESIST_BERRIES = { OCCABERRY: 'FIRE', PASSHOBERRY: 'WATER', WACANBERRY: 'ELECTRIC', RINDOBERRY: 'GRASS', YACHEBERRY: 'ICE', CHOPLEBERRY: 'FIGHTING', KEBIABERRY: 'POISON', SHUCABERRY: 'GROUND', COBABERRY: 'FLYING', PAYAPABERRY: 'PSYCHIC', TANGABERRY: 'BUG', CHARTIBERRY: 'ROCK', KASIBBERRY: 'GHOST', HABANBERRY: 'DRAGON', COLBURBERRY: 'DARK', BABIRIBERRY: 'STEEL', ROSELIBERRY: 'FAIRY', CHILANBERRY: 'NORMAL' };
const PUNCH = new Set('BULLETPUNCH COMETPUNCH DIZZYPUNCH DOUBLEIRONBANG DRAINPUNCH DYNAMICPUNCH FIREPUNCH FOCUSPUNCH HAMMERARM ICEHAMMER ICEPUNCH MACHPUNCH MEGAPUNCH METEORMASH PLASMAFISTS POWERUPPUNCH SHADOWPUNCH SKYUPPERCUT SUCKERPUNCH THUNDERPUNCH SURGINGSTRIKES WICKEDBLOW JETPUNCH RAGEFIST'.split(' '));
const BITE = new Set('BITE CRUNCH FIREFANG ICEFANG POISONFANG PSYCHICFANGS THUNDERFANG HYPERFANG JAWLOCK FISHIOUSREND BOLTBEAK'.split(' '));
const SOUND = new Set('BOOMBURST BUGBUZZ CHATTER CLANGINGSCALES CLANGOROUSSOUL CONFIDE DISARMINGVOICE ECHOEDVOICE EERIESPELL GRASSWHISTLE GROWL HEALBELL HOWL HYPERVOICE METALSOUND NOBLEROAR OVERDRIVE PARTINGSHOT PERISHSONG RELICSONG ROAR ROUND SCREECH SING SNARL SNORE SPARKLINGARIA SUPERSONIC UPROAR SCALESHOT TORCHSONG'.split(' '));
const SLASH = new Set('AERIALACE AIRCUTTER AIRSLASH BEHEMOTHBLADE CEASELESSEDGE CROSSPOISON CUT FURYCUTTER LEAFBLADE NIGHSLASH NIGHTSLASH PSYCHOCUT RAZORLEAF RAZORSHELL SACREDSWORD SLASH SOLARBLADE STONEAXE XSCISSOR KOWTOWCLEAVE TACHYONCUTTER POPULATIONBOMB'.split(' '));
const SPECIAL_SPLIT_PHYS = new Set(['PSYSHOCK', 'PSYSTRIKE', 'SECRETSWORD']);                              // special move, hits Defense
const ALWAYS_CRIT = new Set(['FROSTBREATH', 'STORMTHROW', 'WICKEDBLOW', 'SURGINGSTRIKES', 'FLOWERTRICK', 'ZIPZAP_NO']);
const IGNORE_STAT_CHANGES = new Set(['DARKESTLARIAT', 'SACREDSWORD', 'CHIPAWAY']);
const NEVER_MISS_RAIN = new Set(['THUNDER', 'HURRICANE', 'BLEAKWINDSTORM', 'WILDBOLTSTORM', 'SANDSEARSTORM']);
const FLAT = { SONICBOOM: 20, DRAGONRAGE: 40 };
const THAW_MOVES = new Set(['FLAMEWHEEL', 'SACREDFIRE', 'FLAREBLITZ', 'FUSIONFLARE', 'SCALD', 'STEAMERUPTION', 'BURNUP', 'PYROBALL', 'SCORCHINGSANDS', 'MATCHAGOTCHA', 'BURNINGJEALOUSY']);
const CONTACT_STATUS_ABIL = { STATIC: ['par', 30], POISONPOINT: ['psn', 30], FLAMEBODY: ['brn', 30], EFFECTSPORE: ['*', 30] };
const STATUS_NAMES = { psn: 'poisoned', tox: 'badly poisoned', brn: 'burned', par: 'paralyzed', slp: 'fell asleep', frz: 'frostbitten' };

const MOLD_IGNORED = new Set('LEVITATE STURDY WONDERGUARD MULTISCALE FILTER SOLIDROCK THICKFAT FLASHFIRE VOLTABSORB WATERABSORB SAPSIPPER STORMDRAIN LIGHTNINGROD MOTORDRIVE DRYSKIN MARVELSCALE FURCOAT FLUFFY ICESCALES BATTLEARMOR SHELLARMOR CLEARBODY WHITESMOKE HYPERCUTTER KEENEYE SANDVEIL SNOWCLOAK UNAWARE CONTRARY SIMPLE SOUNDPROOF MAGICBOUNCE HEATPROOF WATERBUBBLE LIMBER IMMUNITY INSOMNIA VITALSPIRIT WATERVEIL MAGMAARMOR OWNTEMPO SHIELDDUST PRISMARMOR TANGLEDFEET WONDERSKIN BULLETPROOF OVERCOAT'.split(' '));
const MOLD_BREAKERS = new Set(['MOLDBREAKER', 'TERAVOLT', 'TURBOBLAZE']);

// ------------------------------------------------------------------------------------------------ the battle object
class Battle {
  constructor(o) {
    this.db = o.db || {}; this.moveTable = o.moves || {}; this.learn = o.learn || {}; this.evo = o.evo || {};
    this.chart = (o.types && o.types.multiplier) ? o.types : FALLBACK_CHART; this.typeTable = o.types || null;
    this.kind = o.kind || 'wild'; this.trainerName = o.trainerName || 'the trainer'; this.introText = o.introText || ''; this.defeatText = o.defeatText || ''; this.ai = o.ai || 'basic'; this.trainerItems = (o.items || []).slice(); this.frostbite = o.frostbite !== false;
    this.rand = o.rng || mulberry(o.seed != null ? o.seed : (Date.now() ^ 0x9e3779b9));
    this.opts = o; this.dbIndex = null; this._moves = new Map();
    this.weather = ['rain', 'sun', 'sand', 'hail'].indexOf(o.weather) >= 0 ? { type: o.weather, turns: 99999 } : { type: null, turns: 0 }; this.terrain = { type: null, turns: 0 }; this.room = { trick: 0 };   // o.weather: the map's weather lasts the whole battle
    this.turnNo = 0; this.events = []; this.pending = null; this.over = false; this.result = null; this.caught = []; this.ranAttempts = 0; this.trainerMoney = o.money || 0;
    this.sides = [0, 1].map(i => ({ idx: i, party: [], active: -1, spikes: 0, rocks: false, tspikes: 0, web: false, reflect: 0, lscreen: 0, veil: 0, tailwind: 0, safeguard: 0, mist: 0, wish: null }));
    this.expLog = []; this.levelUps = []; this.learnQueue = []; this.futureHits = [];
    (o.player || []).forEach((m, i) => this.sides[0].party.push(this.mkBattler(m, 0, i)));
    (o.foe || []).forEach((m, i) => this.sides[1].party.push(this.mkBattler(m, 1, i)));
    this.sides[0].active = Math.max(0, this.sides[0].party.findIndex(m => m.hp > 0));
    this.sides[1].active = Math.max(0, this.sides[1].party.findIndex(m => m.hp > 0));
  }
  // ---- randomness
  rnd(n) { return Math.floor(this.rand() * n); }                       // 0..n-1
  chance(pct) { return this.rnd(100) < pct; }
  // ---- lookups
  speciesData(key) {
    if (this.db[key]) return this.db[key];
    if (!this.dbIndex) { this.dbIndex = {}; for (const k of Object.keys(this.db)) this.dbIndex[NORM(k)] = k; }
    const k = this.dbIndex[NORM(key)]; return k ? this.db[k] : null; }
  mv(key) {
    if (key == null || key === '' || key === 0) return null;
    if (typeof key === 'object' && key.norm) return key;
    const ck = String(key); if (this._moves.has(ck)) return this._moves.get(ck);
    let e = null, T = this.moveTable, rk = ck;
    if (typeof key === 'number') { for (const k in T) if (T[k].id === key) { e = T[k]; rk = k; break; } }
    else if (T[ck]) e = T[ck];
    else { const al = T.constructor && 0; const n = NORM(ck); for (const k in T) { if (NORM(k) === n) { e = T[k]; rk = k; break; } } }
    let out = null;
    if (e) out = { key: rk, norm: NORM(rk), id: e.id, name: e.name || prettyKey(rk), type: e.type || 'TYPE_NORMAL', power: e.power | 0, accuracy: e.accuracy | 0, pp: e.pp || 5, split: String(e.split || 'PHYSICAL').toUpperCase(), priority: e.priority | 0, effect: String(e.effect || 'HIT'), effectChance: e.effectChance | 0, target: e.target || 'SELECTED', flags: e.flags || [], description: e.description || '' };
    else if (NORM(ck) === 'STRUGGLE') out = { key: 'MOVE_STRUGGLE', norm: 'STRUGGLE', id: 165, name: 'Struggle', type: 'TYPE_MYSTERY', power: 50, accuracy: 0, pp: 1, split: 'PHYSICAL', priority: 0, effect: 'STRUGGLE', effectChance: 0, target: 'SELECTED', flags: ['contact', 'protect'], description: '' };
    this._moves.set(ck, out); return out; }
  hasFlag(mv, f) { return mv.flags.indexOf(f) >= 0; }
  // ---- battlers
  mkBattler(src, side, idx) {
    const sp = this.speciesData(src.species) || {}; const g = (...ks) => { for (const k of ks) if (src[k] != null && src[k] !== '') return src[k]; return undefined; };
    const level = clamp(g('level', 'Level') | 0 || 1, 1, 100);
    const iv = k => { const v = g('iv' + k, 'IV' + k, 'iv_' + k.toLowerCase()); return v == null ? 31 : v | 0; };
    const nm = natureMods(g('nature', 'Nature'));
    const st = {
      atk: g('Attack', 'attack') | 0 || calcStat(sp.baseAttack || 50, iv('Attack'), 0, level, nm.atk),
      def: g('Def', 'Defense', 'defense') | 0 || calcStat(sp.baseDefense || 50, iv('Defense'), 0, level, nm.def),
      spa: g('spattack', 'SpAttack', 'spAttack') | 0 || calcStat(sp.baseSpAttack || 50, iv('SpAttack'), 0, level, nm.spa),
      spd: g('sdpef', 'spdef', 'SpDefense', 'spDefense') | 0 || calcStat(sp.baseSpDefense || 50, iv('SpDefense'), 0, level, nm.spd),
      spe: g('speed', 'Speed') | 0 || calcStat(sp.baseSpeed || 50, iv('Speed'), 0, level, nm.spe) };
    const maxhp = g('maxHP', 'maxhp', 'MaxHP') | 0 || calcHP(sp.baseHP || 50, iv('HP'), 0, level);
    let hp = g('HP', 'hp', 'currentHP'); hp = hp == null ? maxhp : clamp(hp | 0, 0, maxhp);
    const types = []; for (const t of [sp.type1, sp.type2]) if (t && t !== 'TYPE_NONE' && types.indexOf(t) < 0) types.push(t);
    if (!types.length) types.push('TYPE_NORMAL');
    let ability = g('ability', 'Ability'); if (typeof ability === 'number') ability = [sp.ability1, sp.ability2, sp.hiddenAbility][ability];
    if (!ability || /^(NONE|ABILITY_NONE|0)$/i.test(String(ability))) ability = sp.ability1;
    const moves = []; for (const m of (src.moves || [])) { const id = m.moveId != null ? m.moveId : (m.id != null ? m.id : m); const mm = this.mv(id); if (!mm) continue; const maxpp = m.maxPP || mm.pp; moves.push({ key: mm.key, norm: mm.norm, pp: m.currentPP != null ? m.currentPP : maxpp, maxpp }); }
    if (!moves.length && this.learn.movesAt) for (const k of this.learn.movesAt(src.species, level)) { const mm = this.mv(k); if (mm) moves.push({ key: mm.key, norm: mm.norm, pp: mm.pp, maxpp: mm.pp }); }
    let status = g('status'); status = ['psn', 'tox', 'brn', 'par', 'slp', 'frz'].indexOf(status) >= 0 ? status : null;
    const b = {
      src, side, idx, species: src.species, spData: sp, name: g('nickname', 'name') || sp.name || prettyKey(src.species), level, hp, maxhp, stats: st, base: { ...st }, types, baseTypes: types.slice(), ability: NORM(ability), baseAbility: NORM(ability),
      item: NORM(g('heldItem', 'item', 'helditem') || ''), origItem: NORM(g('heldItem', 'item', 'helditem') || ''), moves, status, sleep: status === 'slp' ? 2 : 0, toxic: 0, gender: g('gender'), shiny: !!g('isShiny'), friendship: g('friendship') != null ? g('friendship') | 0 : 70,
      exp: g('exp') | 0, growth: sp.growthRate, expYield: sp.expYield || 64, fought: new Set(), ball: g('ballId'), heldUsed: false };
    { const fl = expForLevel(b.growth, b.level), nx = expForLevel(b.growth, Math.min(100, b.level + 1)); if (b.exp < fl) b.exp = fl; else if (b.level < 100 && b.exp >= nx) b.exp = nx - 1; }   // a save whose exp does not match its level would leave the EXP bar stuck at 0
    this.resetVolatile(b); return b; }
  resetVolatile(b) {
    b.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
    b.v = { confused: 0, flinch: false, protect: false, protectN: 0, endure: false, charging: null, semi: null, recharge: false, lock: null, sub: 0, leech: false, leechBy: -1, trap: 0, trapMove: null, taunt: 0, disable: null, disableTurns: 0, encore: null, encoreTurns: 0, focusEnergy: false, lastMove: null, lastDmg: 0, lastDmgSplit: null, lastTarget: null, flinchImmune: false, infatuated: false, yawn: 0, perish: 0, ingrain: false, aqua: false, nightmare: false, curse: false, minimized: false, rollout: 0, furyCutter: 0, chargeBoost: false, stockpile: 0, roost: false, truantTurn: false, movedThisTurn: false, tookDmg: false, slowStart: 0, mudSport: false, torment: false, imprison: false, magnetRise: 0, lockOn: 0, mindReader: -1, destinyBond: false, grudge: false, helping: false, rage: false, bide: 0, bideDmg: 0, flashFire: false, lastWasMove: null, speedBoostOK: false };
    b.types = b.baseTypes.slice(); b.ability = b.baseAbility; b.stats = { ...b.base }; }
  active(side) { const s = this.sides[side]; return s.party[s.active]; }
  foeOf(m) { return this.active(1 - m.side); }
  alive(side) { return this.sides[side].party.filter(m => m.hp > 0); }
  nm(m, cap) { const base = m.name; if (m.side === 0) return base; const t = this.kind === 'wild' ? 'wild ' : 'the opposing '; return cap === false ? t + base : (t + base).replace(/^./, c => c.toUpperCase()); }
  ev(o) { this.events.push(o); return o; }
  msg(text) { this.events.push({ t: 'msg', text }); }
  // ---- ability helpers (Mold Breaker and friends make some defender abilities invisible)
  abil(D, A, mv) { if (!D.ability) return ''; if (A && A !== D && MOLD_BREAKERS.has(A.ability) && MOLD_IGNORED.has(D.ability) && !D.v.suppressIgnore) return ''; if (D.v && D.v.gastro) return ''; return D.ability; }
  mold(A) { return A && MOLD_BREAKERS.has(A.ability); }
  hasItem(m, n) { return m.item === n && !m.v.embargo && !m.heldUsed; }
  ownItem(m) { return m.heldUsed ? '' : (m.v.embargo ? '' : m.item); }
  isType(m, t) { return m.types.indexOf(t) >= 0; }
  weatherOn(w) { const x = this.weather.type; if (!x) return false; for (const m of [this.active(0), this.active(1)]) if (m && (m.ability === 'CLOUDNINE' || m.ability === 'AIRLOCK')) return false; return w ? x === w : true; }
  grounded(m) { if (m.v.smackedDown || m.v.ingrain || this.gravity) return true; if (this.isType(m, 'TYPE_FLYING') && !m.v.roost) return false; if (m.ability === 'LEVITATE' && !m.v.gastro) return false; if (m.item === 'AIRBALLOON' && !m.heldUsed) return false; if (m.v.magnetRise) return false; return true; }
  sideSt(side) { return this.sides[side]; }
  effSpeed(m) {
    let s = sm(m.stats.spe, m.stages.spe); const a = m.ability, w = this.weatherOn.bind(this);
    if ((a === 'SWIFTSWIM' && w('rain')) || (a === 'CHLOROPHYLL' && w('sun')) || (a === 'SANDRUSH' && w('sand')) || (a === 'SLUSHRUSH' && w('hail'))) s *= 2;
    if (a === 'SURGESURFER' && this.terrain.type === 'electric') s *= 2;
    if (a === 'UNBURDEN' && m.v.unburden) s *= 2; if (a === 'QUICKFEET' && m.status) s = Math.floor(s * 1.5);
    if (a === 'SLOWSTART' && m.v.slowStart > 0) s = Math.floor(s / 2);
    if (this.hasItem(m, 'CHOICESCARF')) s = Math.floor(s * 1.5); if (this.hasItem(m, 'IRONBALL') || this.hasItem(m, 'MACHOBRACE')) s = Math.floor(s / 2);
    if (this.sides[m.side].tailwind > 0) s *= 2;
    if (m.status === 'par' && a !== 'QUICKFEET') s = Math.floor(s / 2);
    return Math.max(1, s); }

  // ---- type effectiveness for a move type against a defender (honours grounded/ghost-scrappy/etc.)
  typeMult(type, D, A, mv) {
    if (!type || type === 'TYPE_MYSTERY') return 1;
    let tys = D.types.slice(); const scr = A && (A.ability === 'SCRAPPY' || A.ability === 'MINDSEYE');
    let m = 1;
    for (const t of tys) {
      let v = this.chart.multiplier(type, [t]);
      if (v === 0 && scr && t === 'TYPE_GHOST' && (type === 'TYPE_NORMAL' || type === 'TYPE_FIGHTING')) v = 1;
      if (v === 0 && t === 'TYPE_FLYING' && type === 'TYPE_GROUND' && this.grounded(D) && !(A && mv && mv.norm === 'THOUSANDARROWS' && false)) v = 1;
      if (mv && mv.norm === 'FREEZEDRY' && t === 'TYPE_WATER') v = 2;
      if (mv && mv.norm === 'FLYINGPRESS') v *= this.chart.multiplier('TYPE_FLYING', [t]);
      if (D.v.foresight && t === 'TYPE_GHOST' && v === 0) v = 1;
      if (v < 1 && (this.hasItem(D, 'RINGTARGET'))) v = v === 0 ? 1 : v;
      m *= v; }
    if (type === 'TYPE_GROUND' && !this.grounded(D) && !(mv && mv.norm === 'THOUSANDARROWS')) {
      const ab = A ? this.abil(D, A, mv) : D.ability; if (this.isType(D, 'TYPE_FLYING') ? false : (ab === 'LEVITATE' || D.item === 'AIRBALLOON' || D.v.magnetRise)) return 0; }
    return m; }
  moveType(A, mv) {
    let t = mv.type; const n = mv.norm;
    if (n === 'WEATHERBALL') { if (this.weatherOn('sun')) t = 'TYPE_FIRE'; else if (this.weatherOn('rain')) t = 'TYPE_WATER'; else if (this.weatherOn('sand')) t = 'TYPE_ROCK'; else if (this.weatherOn('hail')) t = 'TYPE_ICE'; else t = 'TYPE_NORMAL'; return t; }
    if (n === 'HIDDENPOWER' && A.hpType) return A.hpType;
    if (n === 'JUDGMENT' || n === 'MULTIATTACK') { if (A.types[0]) t = A.types[0]; }
    if (t === 'TYPE_NORMAL') { const a = A.ability; const map = { AERILATE: 'TYPE_FLYING', PIXILATE: 'TYPE_FAIRY', REFRIGERATE: 'TYPE_ICE', GALVANIZE: 'TYPE_ELECTRIC' }; if (map[a]) return map[a]; }
    if (A.ability === 'NORMALIZE' && mv.power >= 0 && mv.split !== 'STATUS') return 'TYPE_NORMAL';
    return t; }
  isAte(A, mv) { return mv.type === 'TYPE_NORMAL' && ({ AERILATE: 1, PIXILATE: 1, REFRIGERATE: 1, GALVANIZE: 1 })[A.ability]; }
  moveSplit(A, mv) { if (mv.split !== 'STATUS' && SPECIAL_SPLIT_PHYS.has(mv.norm)) return 'SPECIAL'; return mv.split; }

  // ---- accuracy (accuracy_calc.c)
  accuracyOf(A, D, mv) {
    const dAb = this.abil(D, A, mv), aAb = A.ability; let acc;
    acc = dAb === 'UNAWARE' || aAb === 'MINDSEYE' ? 0 : A.stages.acc;
    let buff;
    if (aAb === 'UNAWARE' || D.v.foresight || D.v.miracleEye || IGNORE_STAT_CHANGES.has(mv.norm)) buff = acc;
    else if (aAb === 'KEENEYE' || aAb === 'MINDSEYE') buff = D.stages.eva > 0 ? acc : acc - D.stages.eva;
    else buff = acc - D.stages.eva;
    buff = clamp(buff, -6, 6);
    let moveAcc = mv.accuracy;
    if (this.weatherOn('sun') && NEVER_MISS_RAIN.has(mv.norm) && mv.norm !== 'BLEAKWINDSTORM') moveAcc = 50; if (mv.norm === 'HURRICANE' && this.weatherOn('sun')) moveAcc = 50;
    if (dAb === 'WONDERSKIN' && mv.split === 'STATUS' && moveAcc > 50) moveAcc = 50;
    const num = 3 + Math.max(0, buff), den = 3 + Math.max(0, -buff);
    let calc = Math.floor(num * moveAcc / den);
    if (aAb === 'COMPOUNDEYES') calc = Math.floor(calc * 130 / 100); else if (aAb === 'HUSTLE' && this.moveSplit(A, mv) === 'PHYSICAL') calc = Math.floor(calc * 80 / 100); else if (aAb === 'VICTORYSTAR') calc = Math.floor(calc * 110 / 100);
    if (this.weatherOn('sand') && dAb === 'SANDVEIL') calc = Math.floor(calc * 80 / 100);
    if (this.weatherOn('hail') && dAb === 'SNOWCLOAK') calc = Math.floor(calc * 80 / 100);
    if (dAb === 'TANGLEDFEET' && D.v.confused > 0) calc = Math.floor(calc / 2);
    if (this.hasItem(A, 'WIDELENS')) calc = Math.floor(calc * 110 / 100);
    if (this.hasItem(A, 'ZOOMLENS') && A.v.movedAfter) calc = Math.floor(calc * 120 / 100);
    if (this.gravity) calc = Math.floor(calc * 5 / 3);
    if (this.hasItem(D, 'BRIGHTPOWDER') || this.hasItem(D, 'LAXINCENSE')) calc = Math.floor(calc * 90 / 100);
    if (mv.accuracy === 0) calc = 0xFFFF;
    return calc; }
  alwaysHits(A, D, mv) {
    if (A.v.lockOn > 0 && A.v.lockTarget === D) return true;
    if (A.ability === 'NOGUARD' || D.ability === 'NOGUARD') return true;
    if (mv.norm === 'TOXIC' && this.isType(A, 'TYPE_POISON')) return true;
    if (mv.accuracy === 0) return true;
    if (mv.effect === 'ALWAYS_HIT' || mv.norm === 'AERIALACE') return true;
    if (this.weatherOn('rain') && NEVER_MISS_RAIN.has(mv.norm) && mv.norm !== 'SANDSEARSTORM') return true;
    if (this.weatherOn('hail') && mv.norm === 'BLIZZARD') return true;
    if (D.v.minimized && (mv.norm === 'STOMP' || mv.norm === 'BODYSLAM' || mv.norm === 'DRAGONRUSH' || mv.norm === 'HEATCRASH' || mv.norm === 'HEAVYSLAM' || mv.norm === 'FLYINGPRESS')) return true;
    if (mv.norm === 'MINIMIZE') return true; return false; }

  // ---- critical hits (damage_calc.c: stages {24,8,2,1,1}, multiplier 1.5)
  critStage(A, D, mv) {
    const dAb = this.abil(D, A, mv);
    if (dAb === 'BATTLEARMOR' || dAb === 'SHELLARMOR') return -1;
    if (this.sides[D.side].luckyChant > 0) return -1;
    if (ALWAYS_CRIT.has(mv.norm) || A.v.laserFocus) return 99;
    if (A.ability === 'MERCILESS' && (D.status === 'psn' || D.status === 'tox')) return 99;
    let c = (A.v.focusEnergy ? 2 : 0) + (mv.effect === 'HIGH_CRITICAL' || mv.norm === 'PSYCHOCUT' ? 1 : 0) + (this.hasItem(A, 'SCOPELENS') || this.hasItem(A, 'RAZORCLAW') ? 1 : 0) + (A.ability === 'SUPERLUCK' ? 1 : 0)
      + (this.hasItem(A, 'LUCKYPUNCH') && NORM(A.species) === 'CHANSEY' ? 2 : 0) + ((this.hasItem(A, 'STICK') || this.hasItem(A, 'LEEK')) && /FARFETCH|SIRFETCH/.test(NORM(A.species)) ? 2 : 0);
    return Math.min(c, 4); }
  critRoll(A, D, mv) {
    const s = this.critStage(A, D, mv); if (s < 0) return false; if (s === 99) return true;
    return this.rnd([24, 8, 2, 1, 1][s]) === 0; }

  // ---- move base power (GetBasePower + AdjustBasePower)
  basePower(A, D, mv, o) {
    let p = mv.power; const n = mv.norm, hpr = A.hp / A.maxhp;
    switch (mv.effect) {
      case 'FLAIL': { const r = Math.floor(48 * A.hp / A.maxhp); p = r <= 1 ? 200 : r <= 4 ? 150 : r <= 9 ? 100 : r <= 16 ? 80 : r <= 32 ? 40 : 20; break; }
      case 'MAGNITUDE': p = o && o.magnitude ? o.magnitude : 71; break;
      case 'ROLLOUT': p = mv.power * Math.pow(2, Math.min(4, A.v.rollout || 0)) * (A.v.defCurl ? 2 : 1); break;
      case 'FURY_CUTTER': p = Math.min(160, mv.power * Math.pow(2, Math.min(4, A.v.furyCutter || 0))); break;
      case 'TRIPLE_KICK': p = mv.power * ((o && o.hitNo) || 1); break;
      case 'LAST_RESORT': break;
    }
    switch (n) {
      case 'ERUPTION': case 'WATERSPOUT': case 'DRAGONENERGY': p = Math.max(1, Math.floor(150 * A.hp / A.maxhp)); break;
      case 'REVERSAL': { const r = Math.floor(48 * A.hp / A.maxhp); p = r <= 1 ? 200 : r <= 4 ? 150 : r <= 9 ? 100 : r <= 16 ? 80 : r <= 32 ? 40 : 20; break; }
      case 'WRINGOUT': case 'CRUSHGRIP': p = Math.max(1, Math.floor(120 * D.hp / D.maxhp)); break;
      case 'RETURN': p = Math.max(1, Math.floor(A.friendship * 10 / 25)); break;
      case 'FRUSTRATION': p = Math.max(1, Math.floor((255 - A.friendship) * 10 / 25)); break;
      case 'GYROBALL': p = Math.min(150, Math.floor(25 * this.effSpeed(D) / this.effSpeed(A)) + 1); break;
      case 'ELECTROBALL': { const r = Math.floor(this.effSpeed(A) / this.effSpeed(D)); p = r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40; break; }
      case 'HEX': if (D.status) p *= 2; break;
      case 'VENOSHOCK': if (D.status === 'psn' || D.status === 'tox') p *= 2; break;
      case 'FACADE': if (A.status && A.status !== 'slp') p *= 2; break;
      case 'BRINE': if (D.hp * 2 <= D.maxhp) p *= 2; break;
      case 'WAKEUPSLAP': if (D.status === 'slp') p *= 2; break;
      case 'SMELLINGSALT': if (D.status === 'par') p *= 2; break;
      case 'ACROBATICS': if (!this.ownItem(A)) p *= 2; break;
      case 'PAYBACK': if (D.v.movedThisTurn) p *= 2; break;
      case 'REVENGE': case 'AVALANCHE': if (A.v.tookDmg) p *= 2; break;
      case 'ASSURANCE': if (D.v.tookDmg) p *= 2; break;
      case 'WEATHERBALL': if (this.weatherOn()) p *= 2; break;
      case 'STOMPINGTANTRUM': if (A.v.lastFailed) p *= 2; break;
      case 'BOLTBEAK': case 'FISHIOUSREND': if (!D.v.movedThisTurn) p *= 2; break;
      case 'FUSIONBOLT': case 'FUSIONFLARE': break;
      case 'SOLARBEAM': case 'SOLARBLADE': break;
    }
    // ---- AdjustBasePower: ability, item, terrain modifiers (each step floors like the C code)
    const mod = (m) => { p = Math.floor(p * m / 100); };
    const aAb = A.ability, type = this.moveType(A, mv), split = this.moveSplit(A, mv);
    const contact = this.hasFlag(mv, 'contact') && aAb !== 'LONGREACH' && !this.hasItem(A, 'PROTECTIVEPADS');
    if (aAb === 'TECHNICIAN' && p <= 60) mod(150);
    if (aAb === 'IRONFIST' && PUNCH.has(n)) mod(120);
    if (aAb === 'RECKLESS' && (mv.effect === 'RECOIL' || mv.effect === 'RECOIL_IF_MISS')) mod(120);
    if (aAb === 'STRONGJAW' && BITE.has(n)) mod(150);
    if (aAb === 'TOUGHCLAWS' && contact) mod(130);
    if (aAb === 'SHARPNESS' && SLASH.has(n)) mod(150);
    if (aAb === 'PUNKROCK' && SOUND.has(n)) mod(130);
    if (aAb === 'SHEERFORCE' && mv.effectChance > 0 && !o.noSheer) { mod(130); o.sheer = true; }
    if (aAb === 'SANDFORCE' && this.weatherOn('sand') && (type === 'TYPE_ROCK' || type === 'TYPE_GROUND' || type === 'TYPE_STEEL')) mod(130);
    if (aAb === 'ANALYTIC' && A.v.movedAfter) mod(130);
    if (aAb === 'STEELWORKER' && type === 'TYPE_STEEL') mod(150);
    if (aAb === 'TRANSISTOR' && type === 'TYPE_ELECTRIC') mod(150);
    if (aAb === 'DRAGONSMAW' && type === 'TYPE_DRAGON') mod(150);
    if (aAb === 'WATERBUBBLE' && type === 'TYPE_WATER') mod(200);
    if (aAb === 'TOXICBOOST' && (A.status === 'psn' || A.status === 'tox') && split === 'PHYSICAL') mod(150);
    if (aAb === 'FLAREBOOST' && A.status === 'brn' && split === 'SPECIAL') mod(150);
    if (aAb === 'NORMALIZE' && mv.type !== 'TYPE_NORMAL') mod(120);
    if (this.isAte(A, mv)) mod(120);
    if (aAb === 'RIVALRY' && A.gender && D.gender) mod(A.gender === D.gender ? 125 : 75);
    const it = this.ownItem(A);
    if (TYPE_ITEM_MAP[it] === type) mod(120);
    else if (it === 'MUSCLEBAND' && split === 'PHYSICAL') mod(110);
    else if (it === 'WISEGLASSES' && split === 'SPECIAL') mod(110);
    else if (it === 'ADAMANTORB' && NORM(A.species) === 'DIALGA' && (type === 'TYPE_STEEL' || type === 'TYPE_DRAGON')) mod(120);
    else if (it === 'LUSTROUSORB' && NORM(A.species) === 'PALKIA' && (type === 'TYPE_WATER' || type === 'TYPE_DRAGON')) mod(120);
    else if (it === 'GRISEOUSORB' && /GIRATINA/.test(NORM(A.species)) && (type === 'TYPE_GHOST' || type === 'TYPE_DRAGON')) mod(120);
    const tr = this.terrain.type;
    if (tr && this.grounded(A)) { if ((tr === 'electric' && type === 'TYPE_ELECTRIC') || (tr === 'grassy' && type === 'TYPE_GRASS') || (tr === 'psychic' && type === 'TYPE_PSYCHIC')) mod(130); }
    if (tr === 'misty' && this.grounded(D) && type === 'TYPE_DRAGON') mod(50);
    if (tr === 'grassy' && this.grounded(D) && (n === 'EARTHQUAKE' || n === 'BULLDOZE' || n === 'MAGNITUDE')) mod(50);
    if (D.v.charged === 1 && type === 'TYPE_ELECTRIC') { /* Charge doubles the next electric move */ }
    if (A.v.chargeBoost && type === 'TYPE_ELECTRIC') mod(200);
    return Math.max(1, p); }

  // ---- fixed / special damage (returns a number, or null for the normal formula)
  fixedDamage(A, D, mv, o) {
    const n = mv.norm;
    if (FLAT[n] != null) return FLAT[n];
    switch (mv.effect) {
      case 'LEVEL_DAMAGE': return A.level;
      case 'PSYWAVE': return Math.max(1, Math.floor(A.level * (this.rnd(11) + 5) / 10));
      case 'SUPER_FANG': return Math.max(1, Math.floor(D.hp / 2));
      case '0HKO': return D.hp;
      case 'ENDEAVOR': return D.hp > A.hp ? D.hp - A.hp : 0;
      case 'COUNTER': { const d = A.v.lastDmgBy && A.v.lastDmgBy.phys; if (n === 'COUNTER') return d ? d * 2 : 0; if (n === 'METALBURST') return A.v.lastDmgBy && A.v.lastDmgBy.any ? Math.floor(A.v.lastDmgBy.any * 3 / 2) : 0; return A.v.lastDmgBy && A.v.lastDmgBy.any ? A.v.lastDmgBy.any * 2 : 0; }
      case 'MIRROR_COAT': { const d = A.v.lastDmgBy && A.v.lastDmgBy.spec; return d ? d * 2 : 0; }
    }
    if (n === 'MIRRORCOAT') { const d = A.v.lastDmgBy && A.v.lastDmgBy.spec; return d ? d * 2 : 0; }
    if (n === 'NIGHTSHADE' || n === 'SEISMICTOSS') return A.level;
    if (n === 'FINALGAMBIT') return A.hp;
    if (n === 'NATURESMADNESS' || n === 'RUINATION') return Math.max(1, Math.floor(D.hp / 2));
    if (n === 'PAINSPLIT') return null;
    return null; }

  // ---- the damage formula (CalculateBaseDamage). o: {crit, roll(85..100), dry}
  calcDamage(A, D, mv, o) {
    o = o || {}; const type = this.moveType(A, mv), split = this.moveSplit(A, mv);
    const r = { eff: 1, type, split, crit: false, dmg: 0, stab: false, berry: null, immune: false };
    const dAb = this.abil(D, A, mv), aAb = A.ability;
    r.eff = this.typeMult(type, D, A, mv);
    const fixed = this.fixedDamage(A, D, mv, o);
    if (mv.split === 'STATUS') return r;
    if (r.eff === 0) { r.immune = true; return r; }
    if (fixed != null) { r.dmg = fixed; r.fixed = true; return r; }
    const power = this.basePower(A, D, mv, o); r.power = power;
    let atk, def, atkStage, defStage; const crit = !!o.crit; r.crit = crit;
    const phys = split === 'PHYSICAL';
    const dUsesDef = phys || SPECIAL_SPLIT_PHYS.has(mv.norm);
    if (mv.norm === 'BODYPRESS') { atk = A.stats.def; atkStage = A.stages.def; }
    else if (mv.norm === 'FOULPLAY') { atk = phys ? D.stats.atk : D.stats.spa; atkStage = phys ? D.stages.atk : D.stages.spa; }
    else if (phys) { atk = A.stats.atk; atkStage = A.stages.atk; } else { atk = A.stats.spa; atkStage = A.stages.spa; }
    if (dUsesDef) { def = D.stats.def; defStage = D.stages.def; } else { def = D.stats.spd; defStage = D.stages.spd; }
    // attacker abilities (stat multipliers)
    switch (aAb) {
      case 'HUGEPOWER': case 'PUREPOWER': if (phys) atk *= 2; break;
      case 'HUSTLE': if (phys) atk = Math.floor(atk * 15 / 10); break;
      case 'GUTS': if (phys && A.status) atk = Math.floor(atk * 15 / 10); break;
      case 'SOLARPOWER': if (!phys && this.weatherOn('sun')) atk = Math.floor(atk * 15 / 10); break;
      case 'FLOWERGIFT': if (phys && this.weatherOn('sun')) atk = Math.floor(atk * 15 / 10); break;
      case 'DEFEATIST': if (A.hp * 2 <= A.maxhp) atk = Math.floor(atk / 2); break;
      case 'SLOWSTART': if (phys && A.v.slowStart > 0) atk = Math.floor(atk / 2); break;
      case 'GORILLATACTICS': if (phys) atk = Math.floor(atk * 15 / 10); break;
      case 'FLASHFIRE': if (A.v.flashFire && type === 'TYPE_FIRE') atk = Math.floor(atk * 15 / 10); break;
      case 'OVERGROW': if (type === 'TYPE_GRASS' && A.hp * 3 <= A.maxhp) atk = Math.floor(atk * 15 / 10); break;
      case 'BLAZE': if (type === 'TYPE_FIRE' && A.hp * 3 <= A.maxhp) atk = Math.floor(atk * 15 / 10); break;
      case 'TORRENT': if (type === 'TYPE_WATER' && A.hp * 3 <= A.maxhp) atk = Math.floor(atk * 15 / 10); break;
      case 'SWARM': if (type === 'TYPE_BUG' && A.hp * 3 <= A.maxhp) atk = Math.floor(atk * 15 / 10); break;
      case 'ORICHALCUMPULSE': if (phys && this.weatherOn('sun')) atk = Math.floor(atk * 4 / 3); break;
      case 'HADRONENGINE': if (!phys && this.terrain.type === 'electric') atk = Math.floor(atk * 4 / 3); break;
    }
    if (dAb === 'THICKFAT' && (type === 'TYPE_FIRE' || type === 'TYPE_ICE')) atk = Math.floor(atk / 2);
    if (dAb === 'MARVELSCALE' && D.status && dUsesDef) def = Math.floor(def * 15 / 10);
    if (dAb === 'FURCOAT' && dUsesDef) def *= 2;
    if (dAb === 'GRASSPELT' && this.terrain.type === 'grassy' && dUsesDef) def = Math.floor(def * 15 / 10);
    // attacker items
    const aIt = this.ownItem(A), dIt = this.ownItem(D); const sp = NORM(A.species), dsp = NORM(D.species);
    if (aIt === 'CHOICEBAND' && phys) atk = Math.floor(atk * 15 / 10); if (aIt === 'CHOICESPECS' && !phys) atk = Math.floor(atk * 15 / 10);
    if (aIt === 'THICKCLUB' && phys && /^(CUBONE|MAROWAK)/.test(sp)) atk *= 2;
    if (aIt === 'LIGHTBALL' && sp === 'PIKACHU') atk *= 2;
    if (aIt === 'DEEPSEATOOTH' && !phys && sp === 'CLAMPERL') atk *= 2;
    if (aIt === 'SOULDEW' && !phys && /^(LATIAS|LATIOS)/.test(sp)) atk = Math.floor(atk * 15 / 10);
    if (dIt === 'ASSAULTVEST' && !dUsesDef) def = Math.floor(def * 15 / 10);
    if (dIt === 'EVIOLITE' && this.canEvolve(D)) def = Math.floor(def * 15 / 10);
    if (dIt === 'DEEPSEASCALE' && !dUsesDef && dsp === 'CLAMPERL') def *= 2;
    if (dIt === 'METALPOWDER' && dUsesDef && dsp === 'DITTO') def *= 2;
    // weather: sand boosts rock Sp.Def, hail (snow) boosts ice Defense
    if (this.weatherOn('sand') && !dUsesDef && this.isType(D, 'TYPE_ROCK')) def = Math.floor(def * 15 / 10);
    if (this.weatherOn('hail') && dUsesDef && this.isType(D, 'TYPE_ICE')) def = Math.floor(def * 15 / 10);
    // stat stages (Unaware, crits ignore the unfavourable ones)
    const ignoreDef = aAb === 'UNAWARE' || IGNORE_STAT_CHANGES.has(mv.norm), ignoreAtk = dAb === 'UNAWARE';
    if (!ignoreAtk && atkStage !== 0) { if (!(crit && atkStage < 0)) atk = sm(atk, atkStage); }
    if (!ignoreDef && defStage !== 0) { if (!(crit && defStage > 0)) def = sm(def, defStage); }
    let dmg = Math.floor(2 * A.level / 5) + 2; dmg = Math.floor(dmg * power * Math.max(1, atk) / Math.max(1, def)); dmg = Math.floor(dmg / 50) + 2;
    // move specific
    const n = mv.norm;
    if ((n === 'EARTHQUAKE' || n === 'MAGNITUDE') && D.v.semi === 'dig') dmg *= 2;
    if (n === 'SURF' && D.v.semi === 'dive') dmg *= 2;
    if (n === 'KNOCKOFF' && this.canKnockOff(D)) dmg = Math.floor(dmg * 15 / 10);
    if ((n === 'SOLARBEAM' || n === 'SOLARBLADE') && this.weatherOn() && !this.weatherOn('sun')) dmg = Math.floor(dmg / 2);
    if (D.v.minimized && (n === 'STOMP' || n === 'BODYSLAM' || n === 'DRAGONRUSH' || n === 'FLYINGPRESS')) dmg *= 2;
    if (A.v.helping) dmg = Math.floor(dmg * 15 / 10);
    if ((type === 'TYPE_ELECTRIC' && (A.v.mudSport || D.v.mudSport)) || (type === 'TYPE_FIRE' && (A.v.waterSport || D.v.waterSport))) dmg = Math.floor(dmg / 3);
    // weather
    if (this.weatherOn() && dIt !== 'UTILITYUMBRELLA') {
      if (this.weatherOn('rain')) { if (type === 'TYPE_FIRE') dmg = Math.floor(dmg / 2); else if (type === 'TYPE_WATER') dmg = Math.floor(dmg * 15 / 10); }
      else if (this.weatherOn('sun')) { if (type === 'TYPE_FIRE') dmg = Math.floor(dmg * 15 / 10); else if (type === 'TYPE_WATER' && n !== 'HYDROSTEAM') dmg = Math.floor(dmg / 2); else if (type === 'TYPE_WATER') dmg = Math.floor(dmg * 15 / 10); }
    }
    // crit
    if (crit) dmg = Math.floor(dmg * (aAb === 'SNIPER' ? 225 : 150) / 100);
    // random roll (CFRU: 100 - (Random() & 15) -> 85..100)
    const roll = o.roll != null ? o.roll : 100 - this.rnd(16); dmg = Math.max(1, Math.floor(dmg * roll / 100));
    // STAB
    const stabType = type; const hasStab = A.types.indexOf(stabType) >= 0 || (A.v.addType === stabType);
    if (hasStab) { r.stab = true; dmg = aAb === 'ADAPTABILITY' ? dmg * 2 : Math.floor(dmg * 15 / 10); }
    else if (aAb === 'PROTEAN' || aAb === 'LIBERO') { r.stab = true; dmg = Math.floor(dmg * 15 / 10); }
    // type effectiveness (per defender type, floor each step like the C code)
    if (r.eff !== 1) { for (const t of D.types) { let v = this.chart.multiplier(type, [t]); if (mv.norm === 'FREEZEDRY' && t === 'TYPE_WATER') v = 2; if (v === 0 && ((t === 'TYPE_FLYING' && type === 'TYPE_GROUND' && this.grounded(D)) || (t === 'TYPE_GHOST' && (aAb === 'SCRAPPY' || aAb === 'MINDSEYE')) || (D.v.foresight && t === 'TYPE_GHOST'))) v = 1; if (v === 2) dmg *= 2; else if (v === 0.5) dmg = Math.floor(dmg / 2); else if (v === 4) dmg *= 4; else if (v !== 1) dmg = Math.floor(dmg * v); } if (mv.norm === 'FLYINGPRESS') { dmg = Math.floor(dmg * this.chart.multiplier('TYPE_FLYING', D.types)); } }
    // burn / frostbite, screens, final modifiers
    if (split === 'PHYSICAL' && A.status === 'brn' && aAb !== 'GUTS' && n !== 'FACADE') dmg = Math.floor(dmg / 2);
    else if (split === 'SPECIAL' && A.status === 'frz' && this.frostbite) dmg = Math.floor(dmg / 2);
    if (n !== 'BRICKBREAK' && n !== 'PSYCHICFANGS' && n !== 'RAGINGBULL' && !crit && aAb !== 'INFILTRATOR') {
      const S = this.sides[D.side]; if ((split === 'PHYSICAL' && S.reflect > 0) || (split === 'SPECIAL' && S.lscreen > 0) || S.veil > 0) dmg = Math.floor(dmg / 2); }
    if (aAb === 'TINTEDLENS' && r.eff < 1) dmg *= 2;
    if (aAb === 'SNIPER' && false) dmg = dmg;
    if (aIt === 'EXPERTBELT' && r.eff > 1) dmg = Math.floor(dmg * 12 / 10);
    if (aIt === 'LIFEORB') dmg = Math.floor(dmg * 13 / 10);
    if (aAb === 'NEUROFORCE' && r.eff > 1) dmg = Math.floor(dmg * 125 / 100);
    switch (dAb) {
      case 'DRYSKIN': if (type === 'TYPE_FIRE') dmg = Math.floor(dmg * 125 / 100); break;
      case 'FILTER': case 'SOLIDROCK': case 'PRISMARMOR': if (r.eff > 1) dmg = Math.floor(dmg * 75 / 100); break;
      case 'HEATPROOF': case 'WATERBUBBLE': if (type === 'TYPE_FIRE') dmg = Math.floor(dmg / 2); break;
      case 'MULTISCALE': case 'SHADOWSHIELD': if (D.hp >= D.maxhp) dmg = Math.floor(dmg / 2); break;
      case 'FLUFFY': if (type === 'TYPE_FIRE') dmg *= 2; if (this.hasFlag(mv, 'contact')) dmg = Math.floor(dmg / 2); break;
      case 'ICESCALES': if (split === 'SPECIAL') dmg = Math.floor(dmg / 2); break;
      case 'PUNKROCK': if (SOUND.has(n)) dmg = Math.floor(dmg / 2); break;
      case 'PURIFYINGSALT': if (type === 'TYPE_GHOST') dmg = Math.floor(dmg / 2); break;
    }
    if (RESIST_BERRIES[dIt] && TYPE_ITEM_MAP && ('TYPE_' + RESIST_BERRIES[dIt]) === type && (r.eff > 1 || RESIST_BERRIES[dIt] === 'NORMAL') && !o.dry) { dmg = Math.floor(dmg / 2); r.berry = dIt; }
    else if (RESIST_BERRIES[dIt] && ('TYPE_' + RESIST_BERRIES[dIt]) === type && (r.eff > 1 || RESIST_BERRIES[dIt] === 'NORMAL') && o.dry) dmg = Math.floor(dmg / 2);
    if (D.hp >= D.maxhp && this.isType(D, 'TYPE_GHOST') && this.opts.shadowShield) dmg = Math.floor(dmg / 2);
    r.dmg = Math.max(1, dmg); return r; }
  canEvolve(m) { const e = this.evo[m.species]; return !!(e && e.length); }
  canKnockOff(D) { const it = this.ownItem(D); if (!it) return false; if (D.ability === 'STICKYHOLD') return false; if (/ORB$|^MEGA|^Z/.test(it) && false) return false; return true; }

  // =================================================================================================== state changes
  heal(M, amt, text) {
    if (M.hp <= 0 || M.hp >= M.maxhp || amt <= 0) return 0; if (M.v.healBlock) return 0;
    const from = M.hp; M.hp = Math.min(M.maxhp, M.hp + amt); this.ev({ t: 'hp', side: M.side, from, to: M.hp, max: M.maxhp, heal: true });
    if (text) this.msg(text); return M.hp - from; }
  loseHp(M, amt, text, src) {
    if (M.hp <= 0) return 0; const from = M.hp; amt = Math.max(1, Math.min(M.hp, amt)); M.hp -= amt; this.ev({ t: 'hp', side: M.side, from, to: M.hp, max: M.maxhp });
    if (text) this.msg(text); if (M.hp <= 0) { this.handleFaint(M, src); return amt; } this.afterHpChange(M); return amt; }
  afterHpChange(M) {
    if (M.hp <= 0) return; const it = this.ownItem(M); if (!it || M.v.noBerry) return;
    const half = M.hp * 2 <= M.maxhp, quarter = M.hp * 4 <= M.maxhp;
    if (it === 'SITRUSBERRY' && half) { this.useItem(M, 'ate its Sitrus Berry'); this.heal(M, Math.max(1, Math.floor(M.maxhp / 4))); }
    else if (it === 'ORANBERRY' && half) { this.useItem(M, 'ate its Oran Berry'); this.heal(M, 10); }
    else if (['FIGYBERRY', 'WIKIBERRY', 'MAGOBERRY', 'AGUAVBERRY', 'IAPAPABERRY'].indexOf(it) >= 0 && quarter) { this.useItem(M, 'ate its ' + prettyKey(it).replace(/berry/i, 'Berry')); this.heal(M, Math.max(1, Math.floor(M.maxhp / 3))); }
    else if (it === 'BERRYJUICE' && half) { this.useItem(M, 'drank its Berry Juice'); this.heal(M, 20); }
    else if (['LIECHIBERRY', 'GANLONBERRY', 'SALACBERRY', 'PETAYABERRY', 'APICOTBERRY'].indexOf(it) >= 0 && (M.hp * 4 <= M.maxhp || (M.ability === 'GLUTTONY' && half))) {
      const st = { LIECHIBERRY: 'atk', GANLONBERRY: 'def', SALACBERRY: 'spe', PETAYABERRY: 'spa', APICOTBERRY: 'spd' }[it]; this.useItem(M, 'ate its ' + prettyKey(it)); this.stage(M, st, 1, M, { self: true }); }
    else if (it === 'WHITEHERB' && false) { } }
  useItem(M, verb) { this.msg(this.nm(M) + ' ' + verb + '!'); M.heldUsed = true; M.v.unburden = true; this.ev({ t: 'item', side: M.side }); }
  setStatus(M, st, text) { M.status = st; M.toxic = st === 'tox' ? 1 : 0; this.ev({ t: 'status', side: M.side, status: st }); if (text) this.msg(text); }
  cureStatus(M, text) { if (!M.status) return; M.status = null; M.sleep = 0; M.toxic = 0; this.ev({ t: 'status', side: M.side, status: null }); if (text) this.msg(text); }

  // status infliction (statuses: psn tox brn par slp frz). returns true when applied
  inflict(D, st, A, mv, o) {
    o = o || {}; const verbose = !!o.verbose, who = this.nm(D);
    const fail = t => { if (verbose && t !== false) this.msg(t || 'But it failed!'); return false; };
    if (D.hp <= 0) return false;
    if (D.status) return fail(D.status === st || true ? (verbose ? 'But it failed!' : false) : false);
    const ab = A ? this.abil(D, A, mv) : D.ability, S = this.sides[D.side];
    if (D.v.sub > 0 && A && A !== D && !o.bypassSub && verbose) return fail();
    if (st === 'psn' || st === 'tox') { if ((this.isType(D, 'TYPE_POISON') || this.isType(D, 'TYPE_STEEL')) && !(A && A.ability === 'CORROSION')) return fail("It doesn't affect " + who + '...'); if (ab === 'IMMUNITY' || ab === 'PASTELVEIL') return fail(who + "'s " + prettyKey(ab) + ' prevents poisoning!'); }
    if (st === 'brn') { if (this.isType(D, 'TYPE_FIRE')) return fail("It doesn't affect " + who + '...'); if (ab === 'WATERVEIL' || ab === 'WATERBUBBLE') return fail(who + "'s " + prettyKey(ab) + ' prevents burns!'); }
    if (st === 'par') { if (this.isType(D, 'TYPE_ELECTRIC')) return fail("It doesn't affect " + who + '...'); if (ab === 'LIMBER') return fail(who + "'s Limber prevents paralysis!"); }
    if (st === 'frz') { if (this.isType(D, 'TYPE_ICE')) return fail("It doesn't affect " + who + '...'); if (ab === 'MAGMAARMOR') return fail(who + "'s Magma Armor prevents freezing!"); if (this.weatherOn('sun')) return fail(); }
    if (st === 'slp') { if (ab === 'INSOMNIA' || ab === 'VITALSPIRIT' || ab === 'SWEETVEIL') return fail(who + "'s " + prettyKey(ab) + ' keeps it awake!'); if (this.terrain.type === 'electric' && this.grounded(D)) return fail(who + ' surrounds itself with electrified terrain!'); if (this.sides[1 - D.side].uproar || this.active(0).v.uproar || this.active(1).v.uproar) return fail(); }
    if (ab === 'PURIFYINGSALT' || (ab === 'LEAFGUARD' && this.weatherOn('sun'))) return fail();
    if (S.safeguard > 0 && !(A && A.ability === 'INFILTRATOR') && A && A.side !== D.side) return fail(who + ' is protected by Safeguard!');
    if (this.terrain.type === 'misty' && this.grounded(D)) return fail(who + ' surrounds itself with a protective mist!');
    D.sleep = 0; this.setStatus(D, st);
    if (st === 'slp') D.sleep = 2 + this.rnd(3);
    const t = { psn: ' was poisoned!', tox: ' was badly poisoned!', brn: ' was burned!', par: " is paralyzed! It may be unable to move!", slp: ' fell asleep!', frz: ' was frostbitten!' }[st];
    this.msg(who.replace(/^./, c => c.toUpperCase()) + t);
    if (A && A !== D && (st === 'psn' || st === 'tox' || st === 'brn' || st === 'par') && D.ability === 'SYNCHRONIZE' && !A.status) this.inflict(A, st === 'tox' ? 'psn' : st, D, null, { bypassSub: true, verbose: false });
    this.cureBerry(D); return true; }
  cureBerry(M) {
    const it = this.ownItem(M); if (!it) return;
    const map = { CHESTOBERRY: 'slp', PECHABERRY: 'psn', RAWSTBERRY: 'brn', CHERIBERRY: 'par', ASPEARBERRY: 'frz' };
    if ((it === 'LUMBERRY' && (M.status || M.v.confused > 0)) || (map[it] && map[it] === M.status && true) || (map[it] === 'psn' && M.status === 'tox')) { this.useItem(M, 'ate its ' + prettyKey(it).replace(/berry/i, 'Berry')); this.cureStatus(M, null); M.v.confused = 0; this.msg(this.nm(M).replace(/^./, c => c.toUpperCase()) + ' is cured!'); }
    else if (it === 'PERSIMBERRY' && M.v.confused > 0) { this.useItem(M, 'ate its Persim Berry'); M.v.confused = 0; this.msg(this.nm(M).replace(/^./, c => c.toUpperCase()) + ' snapped out of its confusion!'); } }
  confuse(D, A, mv, verbose) {
    if (D.hp <= 0) return false; const who = this.nm(D); const ab = A ? this.abil(D, A, mv) : D.ability;
    if (D.v.confused > 0) { if (verbose) this.msg(who.replace(/^./, c => c.toUpperCase()) + ' is already confused!'); return false; }
    if (ab === 'OWNTEMPO') { if (verbose) this.msg(who + "'s Own Tempo prevents confusion!"); return false; }
    if (this.sides[D.side].safeguard > 0 && A && A.side !== D.side) { if (verbose) this.msg(who + ' is protected by Safeguard!'); return false; }
    if (this.terrain.type === 'misty' && this.grounded(D)) return false;
    D.v.confused = 2 + this.rnd(4); this.ev({ t: 'confused', side: D.side }); this.msg(who.replace(/^./, c => c.toUpperCase()) + ' became confused!'); this.cureBerry(D); return true; }

  // stat stage change
  stage(M, stat, delta, src, o) {
    o = o || {}; if (M.hp <= 0 || !delta) return false; const who = this.nm(M).replace(/^./, c => c.toUpperCase()); const foe = src && src !== M && src.side !== M.side;
    let ab = foe ? this.abil(M, src, o.mv) : M.ability;
    if (ab === 'CONTRARY') delta = -delta; else if (ab === 'SIMPLE') delta *= 2;
    if (delta < 0 && foe) {
      if (M.v.sub > 0 && !o.bypassSub) return false;
      const S = this.sides[M.side]; if (S.mist > 0 && !(src && src.ability === 'INFILTRATOR')) { this.msg(who + ' is protected by Mist!'); return false; }
      if (ab === 'CLEARBODY' || ab === 'WHITESMOKE' || ab === 'FULLMETALBODY') { this.msg(who + "'s " + prettyKey(ab) + ' prevents stat loss!'); return false; }
      if (ab === 'HYPERCUTTER' && stat === 'atk') { this.msg(who + "'s Hyper Cutter prevents Attack loss!"); return false; }
      if (ab === 'BIGPECKS' && stat === 'def') { this.msg(who + "'s Big Pecks prevents Defense loss!"); return false; }
      if (ab === 'KEENEYE' && stat === 'acc') { this.msg(who + "'s Keen Eye prevents accuracy loss!"); return false; }
      if (this.hasItem(M, 'CLEARAMULET')) return false;
    }
    const cur = M.stages[stat]; const nv = clamp(cur + delta, -6, 6);
    if (nv === cur) { if (!o.silent) this.msg(who + "'s " + STAT_NAMES[stat] + (delta > 0 ? " won't go higher!" : " won't go lower!")); return false; }
    M.stages[stat] = nv; const d = nv - cur;
    this.ev({ t: 'stage', side: M.side, stat, delta: d });
    this.msg(who + "'s " + STAT_NAMES[stat] + (d >= 3 ? ' rose drastically!' : d === 2 ? ' rose sharply!' : d === 1 ? ' rose!' : d === -1 ? ' fell!' : d === -2 ? ' harshly fell!' : ' severely fell!'));
    if (d < 0 && foe) {
      if (ab === 'DEFIANT') this.stage(M, 'atk', 2, M, { self: true }); else if (ab === 'COMPETITIVE') this.stage(M, 'spa', 2, M, { self: true });
      if (this.hasItem(M, 'ADRENALINEORB') && false) { } }
    return true; }

  // weather / terrain
  setWeather(type, src, quiet) {
    const msgs = { rain: 'It started to rain!', sun: 'The sunlight turned harsh!', sand: 'A sandstorm kicked up!', hail: 'It started to hail!' };
    if (this.weather.type === type) return false;
    let turns = 5; if (src) { const it = this.ownItem(src); if ((type === 'rain' && it === 'DAMPROCK') || (type === 'sun' && it === 'HEATROCK') || (type === 'sand' && it === 'SMOOTHROCK') || (type === 'hail' && it === 'ICYROCK')) turns = 8; }
    this.weather = { type, turns }; this.ev({ t: 'weather', type }); this.msg(msgs[type]); return true; }
  setTerrain(type, src) {
    if (this.terrain.type === type) return false; const m = { electric: 'An electric current runs across the battlefield!', grassy: 'Grass grew to cover the battlefield!', misty: 'Mist swirled about the battlefield!', psychic: 'The battlefield got weird!' };
    this.terrain = { type, turns: src && this.ownItem(src) === 'TERRAINEXTENDER' ? 8 : 5 }; this.ev({ t: 'terrain', type }); this.msg(m[type]); return true; }

  // =================================================================================================== switching
  hazardsOn(M) {
    const S = this.sides[M.side]; if (M.hp <= 0) return; const who = this.nm(M).replace(/^./, c => c.toUpperCase()); const boots = this.hasItem(M, 'HEAVYDUTYBOOTS');
    if (boots || M.ability === 'MAGICGUARD') return;
    if (S.rocks) { const e = this.chart.multiplier('TYPE_ROCK', M.types); this.loseHp(M, Math.max(1, Math.floor(M.maxhp * e / 8)), 'Pointed stones dug into ' + this.nm(M, false) + '!'); }
    if (M.hp > 0 && S.spikes > 0 && this.grounded(M)) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / ([8, 6, 4][S.spikes - 1]))), who + ' was hurt by the spikes!');
    if (M.hp > 0 && S.tspikes > 0 && this.grounded(M)) { if (this.isType(M, 'TYPE_POISON')) { S.tspikes = 0; this.msg('The poison spikes disappeared from the ground around ' + this.nm(M, false) + '!'); } else this.inflict(M, S.tspikes >= 2 ? 'tox' : 'psn', null, null, { verbose: false }); }
    if (M.hp > 0 && S.web && this.grounded(M)) { this.msg(who + ' was caught in a sticky web!'); this.stage(M, 'spe', -1, null, {}); } }
  switchInEffects(M) {
    const foe = this.foeOf(M); const who = this.nm(M).replace(/^./, c => c.toUpperCase());
    M.v.firstTurn = true; this.hazardsOn(M); if (M.hp <= 0) return;
    switch (M.ability) {
      case 'INTIMIDATE': if (foe && foe.hp > 0) { this.msg(who + "'s Intimidate!"); if (foe.v.sub > 0) break; const fa = this.abil(foe, M); if (fa === 'INNERFOCUS' || fa === 'OWNTEMPO' || fa === 'OBLIVIOUS' || fa === 'SCRAPPY') { this.msg(this.nm(foe).replace(/^./, c => c.toUpperCase()) + "'s " + prettyKey(fa) + ' prevents Intimidate!'); break; } this.stage(foe, 'atk', -1, M, { mv: null }); } break;
      case 'DRIZZLE': this.setWeather('rain', M); break; case 'DROUGHT': this.setWeather('sun', M); break; case 'SANDSTREAM': this.setWeather('sand', M); break; case 'SNOWWARNING': this.setWeather('hail', M); break;
      case 'ELECTRICSURGE': this.setTerrain('electric', M); break; case 'GRASSYSURGE': this.setTerrain('grassy', M); break; case 'MISTYSURGE': this.setTerrain('misty', M); break; case 'PSYCHICSURGE': this.setTerrain('psychic', M); break;
      case 'PRESSURE': this.msg(who + ' is exerting its pressure!'); break; case 'MOLDBREAKER': this.msg(who + ' breaks the mold!'); break; case 'TERAVOLT': this.msg(who + ' is radiating a bursting aura!'); break; case 'TURBOBLAZE': this.msg(who + ' is radiating a blazing aura!'); break;
      case 'UNNERVE': this.msg(this.nm(foe).replace(/^./, c => c.toUpperCase()) + ' is too nervous to eat Berries!'); break; case 'SLOWSTART': M.v.slowStart = 5; this.msg(who + " can't get it going!"); break;
      case 'DOWNLOAD': if (foe && foe.hp > 0) { const d = sm(foe.stats.def, foe.stages.def), s = sm(foe.stats.spd, foe.stages.spd); this.stage(M, d < s ? 'atk' : 'spa', 1, M, { self: true }); } break;
      case 'INTREPIDSWORD': this.stage(M, 'atk', 1, M, { self: true }); break; case 'DAUNTLESSSHIELD': this.stage(M, 'def', 1, M, { self: true }); break;
      case 'ANTICIPATION': case 'FOREWARN': case 'FRISK': case 'SHADOWTAG': case 'ARENATRAP': case 'TRACE': break; }
    const it = this.ownItem(M);
    if (it === 'AIRBALLOON') this.msg(who + ' floats in the air with its Air Balloon!');
    if (it === 'WHITEHERB' || it === 'MENTALHERB') { }
    if (M.status === 'slp' && false) { } }
  // take a mon off the field (voluntary or fainted) and put the next one on
  withdraw(M, o) {
    o = o || {}; const keep = o.baton ? { stages: { ...M.stages }, sub: M.v.sub, focus: M.v.focusEnergy, leech: M.v.leech, confused: M.v.confused } : null;
    if (M.hp > 0) { if (M.ability === 'NATURALCURE' && M.status) { M.status = null; M.sleep = 0; } if (M.ability === 'REGENERATOR') M.hp = Math.min(M.maxhp, M.hp + Math.floor(M.maxhp / 3)); }
    this.resetVolatile(M); M.v.firstTurn = false; return keep; }
  sendOut(side, idx, o) {
    o = o || {}; const S = this.sides[side]; const M = S.party[idx];
    if (!M || M.hp <= 0) return false; const prev = S.party[S.active];
    if (this.pending && this.pending.type === 'switch') this.pending = null;
    S.active = idx; this.ev({ t: 'switchin', side, idx, name: M.name, species: M.species, level: M.level, hp: M.hp, maxhp: M.maxhp, status: M.status, shiny: M.shiny, gender: M.gender });
    if (o.keep) { Object.assign(M.stages, o.keep.stages); M.v.sub = o.keep.sub; M.v.focusEnergy = o.keep.focus; M.v.leech = o.keep.leech; M.v.confused = o.keep.confused; }
    if (side === 0) this.msg(o.msg || ('Go! ' + M.name + '!')); else this.msg(o.msg || (this.kind === 'trainer' ? this.trainerName + ' sent out ' + M.name + '!' : 'A wild ' + M.name + ' appeared!'));
    const foe = this.active(1 - side); if (side === 0 && foe) foe.fought.add(idx); if (side === 1) { const p = this.active(0); if (p) M.fought.add(p.idx); }
    // everybody who faces the new mon counts as a participant
    if (side === 1) for (const m of this.sides[0].party) { if (m === this.active(0)) M.fought.add(m.idx); }
    this.switchInEffects(M); if (M.hp <= 0) this.handleFaint(M); this.checkSwitchChain();
    return true; }
  checkSwitchChain() { }

  // =================================================================================================== using a move
  usable(M) { // list of {slot, move, pp, disabled, reason} for the move menu
    const out = []; let any = false;
    M.moves.forEach((s, i) => { let reason = null; if (s.pp <= 0) reason = 'no PP'; else if (M.v.disable === s.key && M.v.disableTurns > 0) reason = 'disabled'; else if (M.v.taunt > 0 && this.mv(s.key).split === 'STATUS') reason = 'taunted'; else if (M.v.choiceLock && M.v.choiceLock !== s.key && this.hasItem(M, 'CHOICEBAND') || (M.v.choiceLock && M.v.choiceLock !== s.key && (this.hasItem(M, 'CHOICESPECS') || this.hasItem(M, 'CHOICESCARF')))) reason = 'choice locked'; else if (M.v.encore && M.v.encoreTurns > 0 && M.v.encore !== s.key) reason = 'encore'; else if (this.hasItem(M, 'ASSAULTVEST') && this.mv(s.key).split === 'STATUS') reason = 'assault vest'; if (!reason) any = true; out.push({ slot: i, key: s.key, pp: s.pp, maxpp: s.maxpp, disabled: !!reason, reason }); });
    out.struggle = !any; return out; }
  say(M, t) { this.msg(this.nm(M).replace(/^./, c => c.toUpperCase()) + ' ' + t); }
  cancelMulti(A) { A.v.charging = null; A.v.semi = null; A.v.lock = null; A.v.rollout = 0; }
  // attackcanceler.c: returns false when A cannot move (events already queued)
  canMove(A, mv, forced) {
    const w = this.nm(A).replace(/^./, c => c.toUpperCase()); A.v.destinyBond = false;
    if (A.status === 'slp' && !forced) {
      const sub = A.ability === 'EARLYBIRD' ? 2 : 1; A.sleep = Math.max(0, A.sleep - sub);
      if (A.sleep > 0) { if (mv.effect !== 'SNORE' && mv.effect !== 'SLEEP_TALK') { this.ev({ t: 'anim', kind: 'asleep', side: A.side }); this.msg(w + ' is fast asleep.'); this.cancelMulti(A); return false; } }
      else { this.cureStatus(A, null); this.msg(w + ' woke up!'); A.v.nightmare = false; } }
    if (A.ability === 'TRUANT' && A.v.truantTurn) { A.v.truantTurn = false; this.msg(w + ' is loafing around!'); this.cancelMulti(A); return false; }
    if (A.v.recharge) { A.v.recharge = false; this.msg(w + ' must recharge!'); this.cancelMulti(A); return false; }
    if (A.v.flinch && !forced) { A.v.flinch = false; this.msg(w + ' flinched and couldn\'t move!'); this.cancelMulti(A); return false; }
    if (!forced) {
      if (A.v.disable === mv.key && A.v.disableTurns > 0) { this.msg(w + "'s " + mv.name + ' is disabled!'); this.cancelMulti(A); return false; }
      if (A.v.torment && A.v.lastMove === mv.key && mv.norm !== 'STRUGGLE') { this.msg(w + " can't use the same move twice in a row due to the torment!"); this.cancelMulti(A); return false; }
      if (A.v.taunt > 0 && mv.split === 'STATUS') { this.msg(w + " can't use " + mv.name + ' after the taunt!'); this.cancelMulti(A); return false; }
      if (this.hasItem(A, 'ASSAULTVEST') && mv.split === 'STATUS' && mv.norm !== 'STRUGGLE') { this.msg(w + " can't use status moves with Assault Vest!"); return false; }
    }
    if (A.v.confused > 0) {
      A.v.confused--;
      if (A.v.confused > 0) {
        this.ev({ t: 'anim', kind: 'confused', side: A.side }); this.msg(w + ' is confused!');
        if (this.rnd(100) <= 33) { // 33 %: hurts itself (CFRU: Random()%100 > 33 keeps going)
          const fake = { key: 'CONFUSION', norm: 'CONFUSION', name: 'confusion', type: 'TYPE_MYSTERY', power: 40, accuracy: 0, pp: 1, split: 'PHYSICAL', priority: 0, effect: 'HIT', effectChance: 0, target: 'USER', flags: [] };
          const r = this.calcDamage(A, A, fake, { crit: false, noSheer: true }); this.msg('It hurt itself in its confusion!'); this.damageMon(A, r.dmg, { src: null, confusion: true }); this.cancelMulti(A); return false; } }
      else this.msg(w + ' snapped out of its confusion!'); }
    if (A.status === 'par' && this.rnd(4) === 0) { this.ev({ t: 'anim', kind: 'par', side: A.side }); this.msg(w + " is paralyzed! It can't move!"); this.cancelMulti(A); return false; }
    if (A.v.infatuated) { this.msg(w + ' is in love with the foe!'); if (this.rnd(100) >= 50) { this.msg(w + ' is immobilized by love!'); this.cancelMulti(A); return false; } }
    if (A.status === 'frz' && !this.frostbite) { if (this.rnd(5) === 0 || THAW_MOVES.has(mv.norm)) { this.cureStatus(A, w + ' thawed out!'); } else { this.msg(w + ' is frozen solid!'); return false; } }
    if (A.status === 'frz' && this.frostbite && THAW_MOVES.has(mv.norm)) this.cureStatus(A, w + ' thawed out!');
    return true; }

  useMove(A, slot, o) {
    o = o || {}; if (A.hp <= 0 || this.over) return; const D = this.foeOf(A);
    let mv, ms = null, cont = false;
    if (A.v.charging) { mv = this.mv(A.v.charging.move); cont = true; ms = A.moves.find(x => x.key === mv.key); }
    else if (A.v.lock) { mv = this.mv(A.v.lock.move); cont = true; ms = A.moves.find(x => x.key === mv.key); }
    else if (slot === 'struggle' || slot == null || !A.moves[slot]) mv = this.mv('STRUGGLE');
    else { ms = A.moves[slot]; mv = this.mv(ms.key); }
    if (!mv) { this.msg('But it has no move to use!'); return; }
    if (o.metronome) { cont = true; }
    A.v.movedThisTurn = true; A.v.turnsUsed = (A.v.turnsUsed || 0) + 1;
    const wasFirst = A.v.firstTurn;
    if (!this.canMove(A, mv, cont || o.forced)) { A.v.firstTurn = false; A.v.truantTurn = false; return; }
    const w = this.nm(A).replace(/^./, c => c.toUpperCase());
    // announce
    if (!(A.v.charging && cont && false)) { this.ev({ t: 'usemove', side: A.side, move: mv.key, name: mv.name, type: mv.type }); this.msg(w + ' used ' + mv.name + '!'); }
    // PP
    if (!cont && !o.noPP && ms) { let c = 1; if (D && D.hp > 0 && this.abil(D, A, mv) === 'PRESSURE' && mv.target !== 'USER') c = 2; ms.pp = Math.max(0, ms.pp - c); }
    if (A.item && /^CHOICE(BAND|SPECS|SCARF)$/.test(A.item) && !cont && ms) A.v.choiceLock = mv.key;
    if (A.ability === 'TRUANT') A.v.truantTurn = true;
    A.v.lastMove = mv.key; A.v.lastMoveNorm = mv.norm; A.v.firstTurnWas = wasFirst;
    const fin = () => { A.v.firstTurn = false; if (!(o.noEnd)) { } };
    // two-turn moves
    const two = this.chargeInfo(A, mv);
    if (two && !A.v.charging) {
      A.v.charging = { move: mv.key }; this.ev({ t: 'anim', kind: 'charge', side: A.side, move: mv.key }); this.msg(two.text.replace('{u}', this.nm(A, false)).replace('{U}', w));
      if (two.semi) A.v.semi = two.semi; if (two.boost) this.stage(A, two.boost[0], two.boost[1], A, { self: true });
      if (this.hasItem(A, 'POWERHERB')) { this.useItem(A, 'became fully charged due to its Power Herb'); A.v.charging = null; A.v.semi = null; } else { fin(); return; } }
    if (A.v.charging) { A.v.charging = null; A.v.semi = null; }
    this.runMove(A, D, mv, o); A.v.firstTurn = false; }

  chargeInfo(A, mv) {
    switch (mv.effect) {
      case 'SOLARBEAM': if (this.weatherOn('sun')) return null; return { text: '{U} absorbed light!' };
      case 'SKULL_BASH': return { text: '{U} tucked in its head!', boost: ['def', 1] };
      case 'SKY_ATTACK': return { text: '{U} became cloaked in a harsh light!' };
      case 'RAZOR_WIND': return { text: '{U} whipped up a whirlwind!' };
      case 'SEMI_INVULNERABLE': { const n = mv.norm; if (n === 'FLY' || n === 'BOUNCE') return { text: '{U} flew up high!', semi: 'fly' }; if (n === 'DIG') return { text: '{U} burrowed its way under the ground!', semi: 'dig' }; if (n === 'DIVE') return { text: '{U} hid underwater!', semi: 'dive' }; return { text: '{U} vanished instantly!', semi: 'shadow' }; } }
    if (mv.norm === 'METEORBEAM' || mv.norm === 'ELECTROSHOT') return { text: '{U} is overflowing with space power!', boost: ['spa', 1] };
    if (mv.norm === 'GEOMANCY') return { text: '{U} is absorbing power!' };
    return null; }

  // protect / semi-invulnerable / immunity gates, accuracy, damage, effects
  runMove(A, D, mv, o) {
    const self = mv.target === 'USER' || mv.target === 'USER_OR_PARTNER'; const aName = this.nm(A).replace(/^./, c => c.toUpperCase());
    if (!self && (!D || D.hp <= 0) && mv.target !== 'OPPONENTS_FIELD' && mv.target !== 'ALL' && mv.target !== 'DEPENDS') { this.msg('But it failed!'); this.cancelMulti(A); return; }
    // moves that need a special condition
    if (this.preFail(A, D, mv)) { A.v.lastFailed = true; this.cancelMulti(A); return; }
    A.v.lastFailed = false;
    if (self) { this.statusMove(A, A, mv, o); return; }
    if ((mv.target === 'ALL' || mv.target === 'OPPONENTS_FIELD') && mv.split === 'STATUS') { this.statusMove(A, D, mv, o); return; }
    // Magic Coat / Magic Bounce
    if (this.hasFlag(mv, 'magicCoat') && !o.bounced && D && (D.v.magicCoat || this.abil(D, A, mv) === 'MAGICBOUNCE')) { this.ev({ t: 'anim', kind: 'bounce', side: D.side }); this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + (D.v.magicCoat ? "'s " + mv.name + ' was bounced back!' : "'s Magic Bounce reflected " + mv.name + '!')); D.v.magicCoat = false; this.runMove(D, A, mv, { ...o, bounced: true }); return; }
    // protect
    if (D.v.protect && this.hasFlag(mv, 'protect') && mv.norm !== 'FEINT' && !['FEINT', 'HYPERSPACEHOLE', 'HYPERSPACEFURY', 'SHADOWFORCE', 'PHANTOMFORCE'].includes(mv.norm)) {
      this.ev({ t: 'anim', kind: 'protect', side: D.side }); this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + ' protected itself!');
      if (D.v.protectKind === 'spiky' && this.hasFlag(mv, 'contact')) this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 8)), aName + ' was hurt!');
      if (D.v.protectKind === 'kings' && this.hasFlag(mv, 'contact')) this.stage(A, 'atk', -1, D, {});
      if (D.v.protectKind === 'baneful' && this.hasFlag(mv, 'contact')) this.inflict(A, 'psn', D, null, {});
      if (mv.effect === 'RECOIL_IF_MISS') this.crash(A);
      this.cancelMulti(A); A.v.lastFailed = true; return; }
    // semi-invulnerable target
    if (D.v.semi && !this.hitsSemi(A, D, mv) && !this.alwaysHitsSemi(A, D)) { this.missMsg(A, D, mv); this.cancelMulti(A); if (mv.effect === 'RECOIL_IF_MISS') this.crash(A); return; }
    // ability immunities
    const dAb = this.abil(D, A, mv), type = this.moveType(A, mv);
    if (mv.target !== 'OPPONENTS_FIELD' && this.abilityBlocks(A, D, mv, dAb, type)) { this.cancelMulti(A); return; }
    // priority / terrain / misc blockers
    if (mv.priority > 0 && this.terrain.type === 'psychic' && this.grounded(D) && A.side !== D.side) { this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + ' surrounds itself with psychic terrain!'); return; }
    if ((mv.priority > 0 || (A.ability === 'PRANKSTER' && mv.split === 'STATUS')) && dAb && ['DAZZLING', 'QUEENLYMAJESTY', 'ARMORTAIL'].includes(dAb)) { this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + ' is protected by ' + prettyKey(dAb) + '!'); return; }
    if (A.ability === 'PRANKSTER' && mv.split === 'STATUS' && this.isType(D, 'TYPE_DARK') && A.side !== D.side) { this.msg("It doesn't affect " + this.nm(D, false) + '...'); return; }
    // accuracy
    const sure = this.alwaysHits(A, D, mv) || (mv.effect === 'SEMI_INVULNERABLE' && false);
    let hit = true;
    if (!sure) { const acc = this.accuracyOf(A, D, mv); if (this.rnd(101) > acc) hit = false; }
    if (!hit) { this.missMsg(A, D, mv); if (mv.effect === 'RECOIL_IF_MISS') this.crash(A); this.cancelMulti(A); A.v.rollout = 0; A.v.furyCutter = 0; if (this.hasItem(A, 'BLUNDERPOLICY') && !A.v.blunder) { this.useItem(A, 'used its Blunder Policy'); this.stage(A, 'spe', 2, A, { self: true }); } return; }
    if (mv.split === 'STATUS') { this.statusMove(A, D, mv, o); return; }
    this.attackMove(A, D, mv, o); }
  missMsg(A, D, mv) { this.ev({ t: 'anim', kind: 'miss', side: A.side }); this.msg(D.v.semi || (this.alwaysHitsSemi && false) ? this.nm(D).replace(/^./, c => c.toUpperCase()) + ' avoided the attack!' : this.nm(A).replace(/^./, c => c.toUpperCase()) + "'s attack missed!"); }
  crash(A) { const dmg = Math.max(1, Math.floor(A.maxhp / 2)); this.msg(this.nm(A).replace(/^./, c => c.toUpperCase()) + ' kept going and crashed!'); this.loseHp(A, dmg); }
  hitsSemi(A, D, mv) { const s = D.v.semi, n = mv.norm;
    if (s === 'fly') return ['GUST', 'TWISTER', 'THUNDER', 'SKYUPPERCUT', 'HURRICANE', 'SMACKDOWN', 'THOUSANDARROWS', 'WHIRLWIND'].includes(n);
    if (s === 'dig') return ['EARTHQUAKE', 'MAGNITUDE', 'FISSURE'].includes(n);
    if (s === 'dive') return ['SURF', 'WHIRLPOOL'].includes(n); return false; }
  alwaysHitsSemi(A, D) { return A.ability === 'NOGUARD' || D.ability === 'NOGUARD' || (A.v.lockOn > 0 && A.v.lockTarget === D); }
  abilityBlocks(A, D, mv, dAb, type) {
    const w = this.nm(D).replace(/^./, c => c.toUpperCase()); const dmgMove = mv.split !== 'STATUS';
    const bl = (text, fn) => { this.ev({ t: 'anim', kind: 'immune', side: D.side }); if (fn) fn(); this.msg(text); return true; };
    if (A === D) return false;
    if (type === 'TYPE_ELECTRIC') { if (dAb === 'VOLTABSORB') return bl(w + "'s Volt Absorb made " + mv.name + ' useless!', () => { if (!this.heal(D, Math.floor(D.maxhp / 4))) { } }); if (dAb === 'LIGHTNINGROD') return bl(w + "'s Lightning Rod absorbed the attack!", () => this.stage(D, 'spa', 1, D, { self: true })); if (dAb === 'MOTORDRIVE') return bl(w + "'s Motor Drive absorbed the attack!", () => this.stage(D, 'spe', 1, D, { self: true })); }
    if (type === 'TYPE_WATER') { if (dAb === 'WATERABSORB' || dAb === 'DRYSKIN') return bl(w + "'s " + prettyKey(dAb) + ' made ' + mv.name + ' useless!', () => this.heal(D, Math.floor(D.maxhp / 4))); if (dAb === 'STORMDRAIN') return bl(w + "'s Storm Drain absorbed the attack!", () => this.stage(D, 'spa', 1, D, { self: true })); }
    if (type === 'TYPE_FIRE' && dAb === 'FLASHFIRE') return bl(w + "'s Flash Fire made " + mv.name + ' useless!', () => { D.v.flashFire = true; });
    if (type === 'TYPE_GRASS' && dAb === 'SAPSIPPER') return bl(w + "'s Sap Sipper absorbed the attack!", () => this.stage(D, 'atk', 1, D, { self: true }));
    if (type === 'TYPE_GROUND' && dAb === 'EARTHEATER') return bl(w + "'s Earth Eater absorbed the attack!", () => this.heal(D, Math.floor(D.maxhp / 4)));
    if (type === 'TYPE_FIRE' && dAb === 'WELLBAKEDBODY') return bl(w + "'s Well-Baked Body absorbed the attack!", () => this.stage(D, 'def', 2, D, { self: true }));
    if (dAb === 'SOUNDPROOF' && SOUND.has(mv.norm)) return bl(w + "'s Soundproof blocks " + mv.name + '!');
    if (dAb === 'BULLETPROOF' && /BALL|BOMB|BLAST|CANNON|SHOT$/.test(mv.norm) && dmgMove) return bl(w + "'s Bulletproof blocks " + mv.name + '!');
    if (dAb === 'WONDERGUARD' && dmgMove && mv.norm !== 'STRUGGLE' && this.typeMult(type, D, A, mv) <= 1 && mv.type !== 'TYPE_MYSTERY') return bl(w + "'s Wonder Guard protects it!");
    if (dAb === 'DAMP' && ['SELFDESTRUCT', 'EXPLOSION', 'MISTYEXPLOSION', 'MINDBLOWN'].includes(mv.norm)) return bl(w + "'s Damp prevents " + mv.name + '!');
    if (dAb === 'TELEPATHY' && false) return false; return false; }
  // moves that fail before anything happens
  preFail(A, D, mv) {
    const f = (t) => { this.msg(t || 'But it failed!'); return true; };
    switch (mv.effect) {
      case 'FOCUS_PUNCH': if (mv.norm === 'FOCUSPUNCH' && A.v.tookDmg) return f(this.nm(A).replace(/^./, c => c.toUpperCase()) + ' lost its focus and couldn\'t move!'); break;
      case 'FAKE_OUT': if (!A.v.firstTurnWas) return f(); break;
      case 'SUCKER_PUNCH': if (!D.v.willAttack || D.v.movedThisTurn) return f(); break;
      case 'DREAM_EATER': if (D.status !== 'slp') return f(); break; case 'SNORE': case 'SLEEP_TALK': if (A.status !== 'slp') return f(); break;
      case 'LAST_RESORT': if (A.moves.length < 2 || A.moves.some(m => m.norm !== NORM(mv.key) && !(A.v.usedMoves && A.v.usedMoves.has(m.key)))) return f(); break; }
    if (mv.norm === 'FIRSTIMPRESSION' && !A.v.firstTurnWas) return f();
    if (mv.norm === 'BELCH' && !A.heldUsed) return f();
    if (mv.norm === 'SYNCHRONOISE' && false) return false; return false; }

  // ---------------------------------------------------------------------------------------------- damaging moves
  hitCount(A, mv) {
    switch (mv.effect) {
      case 'DOUBLE_HIT': return 2;
      case 'MULTI_HIT': if (A.ability === 'SKILLLINK' || this.hasItem(A, 'LOADEDDICE')) return 5; { const r = this.rnd(8); return r < 3 ? 2 : r < 6 ? 3 : r < 7 ? 4 : 5; }
      case 'TRIPLE_KICK': return 3; }
    if (mv.norm === 'POPULATIONBOMB') return 10; if (mv.norm === 'SCALESHOT' || mv.norm === 'BULLETSEED' || mv.norm === 'WATERSHURIKEN') return A.ability === 'SKILLLINK' ? 5 : (() => { const r = this.rnd(8); return r < 3 ? 2 : r < 6 ? 3 : r < 7 ? 4 : 5; })();
    return 1; }
  attackMove(A, D, mv, o) {
    const aName = this.nm(A).replace(/^./, c => c.toUpperCase()), dName = this.nm(D).replace(/^./, c => c.toUpperCase());
    const n = mv.norm; let hits = this.hitCount(A, mv), done = 0, total = 0, lastR = null, ko = false, hitSub = false;
    const type = this.moveType(A, mv); const mvAnim = { t: 'anim', kind: 'attack', side: A.side, move: mv.key, type };
    // first-hit-only effects that need immediate checks
    if (mv.effect === 'COUNTER' || mv.effect === 'MIRROR_COAT') { const d = this.fixedDamage(A, D, mv, {}); if (!d) { this.msg('But it failed!'); return; } }
    if (n === 'MAGNITUDE') { const r = this.rnd(100); const m = r < 5 ? [4, 10] : r < 15 ? [5, 30] : r < 35 ? [6, 50] : r < 65 ? [7, 70] : r < 85 ? [8, 90] : r < 95 ? [9, 110] : [10, 150]; o.magnitude = m[1]; this.msg('Magnitude ' + m[0] + '!'); }
    for (let i = 1; i <= hits; i++) {
      if (D.hp <= 0 || A.hp <= 0) break;
      if (i > 1 && mv.effect === 'TRIPLE_KICK' && A.ability !== 'SKILLLINK') { const acc = this.accuracyOf(A, D, mv); if (this.rnd(101) > acc) break; }
      const crit = this.critRoll(A, D, mv); const r = this.calcDamage(A, D, mv, { crit, hitNo: i, magnitude: o.magnitude, noSheer: false });
      if (r.immune) { this.ev({ t: 'anim', kind: 'immune', side: D.side }); this.msg("It doesn't affect " + this.nm(D, false) + '...'); this.cancelMulti(A); return; }
      if (mv.effect === 'COUNTER' && !r.dmg) break;
      if (i === 1) this.ev(mvAnim);
      let dmg = r.dmg;
      // Endure / Sturdy / sash / band: only if this blow would be lethal
      const res = this.damageMon(D, dmg, { src: A, mv, r, crit, hitNo: i, hits });
      done++; lastR = r; total += res.dealt; if (res.sub) hitSub = true;
      if (D.v.sub <= 0 || !res.sub) { /* real hit */ }
      if (res.fainted) { ko = true; break; }
    }
    if (!done) return;
    if (hits > 1) this.msg('Hit ' + done + ' time(s)!');
    // messages: effectiveness is reported once (CFRU prints it after the last hit)
    if (lastR) { if (lastR.eff > 1) this.msg("It's super effective!"); else if (lastR.eff < 1 && lastR.eff > 0) this.msg("It's not very effective..."); }
    this.afterAttack(A, D, mv, lastR, total, ko, done, hitSub, o); }

  // apply damage to a mon. returns {dealt, sub, fainted}
  damageMon(M, dmg, c) {
    c = c || {}; const A = c.src, mv = c.mv; const res = { dealt: 0, sub: false, fainted: false };
    if (c.crit) { this.ev({ t: 'anim', kind: 'crit', side: M.side }); this.msg('A critical hit!'); }
    // substitute
    if (A && M.v.sub > 0 && A !== M && !(mv && (SOUND.has(mv.norm) || A.ability === 'INFILTRATOR')) && !c.confusion) {
      const d = Math.min(M.v.sub, dmg); M.v.sub -= d; res.sub = true; res.dealt = 0; this.ev({ t: 'anim', kind: 'subhit', side: M.side });
      this.msg(M.v.sub > 0 ? 'The substitute took damage for ' + this.nm(M, false) + '!' : this.nm(M).replace(/^./, c2 => c2.toUpperCase()) + "'s substitute faded!"); if (M.v.sub <= 0) this.ev({ t: 'anim', kind: 'subbreak', side: M.side }); return res; }
    if (M.hp <= 0) return res;
    let hp = M.hp, d = Math.min(dmg, hp); let endured = false;
    if (d >= hp && !c.confusion) {
      const dAb = A ? this.abil(M, A, mv) : M.ability;
      if (M.v.endure && true) { d = hp - 1; endured = true; this.msg(this.nm(M).replace(/^./, c2 => c2.toUpperCase()) + ' endured the hit!'); }
      else if (dAb === 'STURDY' && M.hp === M.maxhp && !(mv && mv.effect === '0HKO')) { d = hp - 1; endured = true; this.msg(this.nm(M).replace(/^./, c2 => c2.toUpperCase()) + ' endured the hit using Sturdy!'); }
      else if (this.hasItem(M, 'FOCUSSASH') && M.hp === M.maxhp) { d = hp - 1; endured = true; this.useItem(M, 'hung on using its Focus Sash'); }
      else if (this.hasItem(M, 'FOCUSBAND') && this.rnd(100) < 10) { d = hp - 1; endured = true; this.msg(this.nm(M).replace(/^./, c2 => c2.toUpperCase()) + ' hung on using its Focus Band!'); }
      else if (mv && mv.effect === 'FALSE_SWIPE') { d = hp - 1; endured = true; }
      else if (mv && c.hitNo != null && false) { } }
    // resistance berry consumed
    if (c.r && c.r.berry) { this.msg('The ' + prettyKey(c.r.berry) + ' weakened the damage to ' + this.nm(M, false) + '!'); M.heldUsed = true; M.v.unburden = true; this.ev({ t: 'item', side: M.side }); }
    const from = M.hp; M.hp -= d; res.dealt = d;
    this.ev({ t: 'hp', side: M.side, from, to: M.hp, max: M.maxhp, crit: !!c.crit, hit: true });
    if (A && A !== M) { M.v.lastDmgBy = M.v.lastDmgBy || {}; M.v.lastDmgBy.any = d; const sp = mv ? this.moveSplit(A, mv) : 'PHYSICAL'; if (sp === 'PHYSICAL') M.v.lastDmgBy.phys = d; else M.v.lastDmgBy.spec = d; M.v.lastHitBy = A; }
    M.v.tookDmg = true;
    if (M.hp <= 0) { res.fainted = true; this.handleFaint(M, A); return res; }
    if (A && A !== M && mv) this.onContactAndHit(A, M, mv, d, c);
    this.afterHpChange(M);
    if (M.v.bideActive) M.v.bideDmg += d;
    return res; }
  onContactAndHit(A, D, mv, d, c) {
    const contact = this.hasFlag(mv, 'contact') && A.ability !== 'LONGREACH' && !this.hasItem(A, 'PROTECTIVEPADS'); if (!contact) return;
    const dAb = this.abil(D, A, mv), dn = this.nm(D).replace(/^./, c2 => c2.toUpperCase()), an = this.nm(A).replace(/^./, c2 => c2.toUpperCase());
    if (A.hp <= 0) return;
    if ((dAb === 'ROUGHSKIN' || dAb === 'IRONBARBS') && A.ability !== 'MAGICGUARD') { this.msg(an + ' was hurt!'); this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 8))); }
    else if (this.hasItem(D, 'ROCKYHELMET') && A.ability !== 'MAGICGUARD') { this.msg(an + ' was hurt by ' + this.nm(D, false) + "'s Rocky Helmet!"); this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 6))); }
    if (A.hp > 0 && CONTACT_STATUS_ABIL[dAb] && !A.status && this.rnd(100) < CONTACT_STATUS_ABIL[dAb][1]) { let st = CONTACT_STATUS_ABIL[dAb][0]; if (st === '*') st = ['psn', 'par', 'slp'][this.rnd(3)]; if (A.ability !== 'OVERCOAT' || st === 'psn' && false) this.inflict(A, st, D, null, { bypassSub: true }); }
    if (A.hp > 0 && dAb === 'GOOEY' || dAb === 'TANGLINGHAIR') this.stage(A, 'spe', -1, D, {});
    if (A.hp > 0 && dAb === 'MUMMY' && A.ability !== 'MUMMY') { A.ability = 'MUMMY'; this.msg(an + "'s Ability became Mummy!"); }
    if (A.hp > 0 && this.hasItem(D, 'STICKYBARB') && !this.ownItem(A)) { A.item = D.item; D.item = ''; this.msg(an + ' was snagged by the Sticky Barb!'); } }

  // after all hits of a damaging move
  afterAttack(A, D, mv, r, total, ko, hits, hitSub, o) {
    const aName = this.nm(A).replace(/^./, c => c.toUpperCase()); const n = mv.norm, e = mv.effect;
    const dealt = total; const secOK = !hitSub && D.hp > 0 || (ko && false);
    const shieldDust = this.abil(D, A, mv) === 'SHIELDDUST' || this.hasItem(D, 'COVERTCLOAK'); const sheer = A.ability === 'SHEERFORCE' && mv.effectChance > 0;
    const chance = (def) => { let c = mv.effectChance || def; if (A.ability === 'SERENEGRACE') c *= 2; return c; };
    const sec = (fn, def) => { if (D.hp <= 0 || hitSub || shieldDust || sheer) return; if (this.rnd(100) < chance(def)) fn(); };
    // ---- effect specific secondary effects
    const st = { BURN_HIT: ['brn', 10], FREEZE_HIT: ['frz', 10], PARALYZE_HIT: ['par', 10], POISON_HIT: ['psn', 20], BAD_POISON_HIT: ['tox', 30] }[e];
    if (st) sec(() => this.inflict(D, st[0], A, mv, { verbose: false }), st[1]);
    else if (e === 'THUNDER' || e === 'SMELLINGSALT' && false) sec(() => this.inflict(D, 'par', A, mv, {}), 30);
    else if (e === 'FLINCH_HIT') { if (D.v.movedThisTurn === false || !D.v.movedThisTurn) sec(() => { D.v.flinch = true; }, 30); }
    else if (e === 'CONFUSE_HIT') sec(() => this.confuse(D, A, mv, false), 10);
    else if (e === 'TRI_ATTACK') sec(() => this.inflict(D, ['par', 'brn', 'frz'][this.rnd(3)], A, mv, {}), 20);
    else if (n === 'FLAMEBURST') { }
    else if (e === 'SPEED_DOWN_HIT' || e === 'ATTACK_DOWN_HIT' || e === 'DEFENSE_DOWN_HIT' || e === 'SPECIAL_ATTACK_DOWN_HIT' || e === 'SPECIAL_DEFENSE_DOWN_HIT' || e === 'ACCURACY_DOWN_HIT' || e === 'SPECIAL_DEFENSE_DOWN_2_HIT') {
      const m = { SPEED: 'spe', ATTACK: 'atk', DEFENSE: 'def', SPECIAL_ATTACK: 'spa', SPECIAL_DEFENSE: 'spd', ACCURACY: 'acc' }; const mm = /^(.*)_DOWN(_2)?_HIT$/.exec(e); sec(() => this.stage(D, m[mm[1]], mm[2] ? -2 : -1, A, { mv }), 10); }
    else if (e === 'ATTACK_UP_HIT' || e === 'DEFENSE_UP_HIT' || e === 'DEFENSE_UP_2_HIT' || e === 'SPECIAL_ATTACK_UP_HIT' || e === 'SPEED_UP_1_HIT') { const m = { ATTACK: 'atk', DEFENSE: 'def', SPECIAL_ATTACK: 'spa', SPEED: 'spe' }; const mm = /^(.*?)_UP(_1|_2)?_HIT$/.exec(e); if (!sheer && A.hp > 0 && this.rnd(100) < (mv.effectChance || (e === 'SPEED_UP_1_HIT' ? 100 : 10))) this.stage(A, m[mm[1]], mm[2] === '_2' ? 2 : 1, A, { self: true }); }
    else if (e === 'ALL_STATS_UP_HIT') { if (!sheer && A.hp > 0 && this.rnd(100) < (mv.effectChance || 10)) for (const s of STATS) this.stage(A, s, 1, A, { self: true }); }
    else if (e === 'HIGHER_OFFENSES_DEFENSES_UP_HIT') { }
    // user stat drops after the attack
    if (e === 'OVERHEAT' && A.hp > 0 && !sheer) this.stage(A, ['DRACOMETEOR', 'OVERHEAT', 'PSYCHOBOOST', 'LEAFSTORM', 'FLEURCANNON'].includes(n) ? 'spa' : 'spa', -2, A, { self: true });
    if (e === 'SUPERPOWER' && A.hp > 0 && !sheer) { if (n === 'CLOSECOMBAT') { this.stage(A, 'def', -1, A, { self: true }); this.stage(A, 'spd', -1, A, { self: true }); } else if (n === 'VCREATE') { this.stage(A, 'def', -1, A, { self: true }); this.stage(A, 'spd', -1, A, { self: true }); this.stage(A, 'spe', -1, A, { self: true }); } else if (n === 'HAMMERARM' || n === 'ICEHAMMER' || n === 'SPINOUT') this.stage(A, 'spe', -1, A, { self: true }); else if (n === 'CLANGINGSCALES' || n === 'ARMORCANNON') this.stage(A, 'def', -1, A, { self: true }); else if (n === 'DRAGONASCENT') { this.stage(A, 'def', -1, A, { self: true }); this.stage(A, 'spd', -1, A, { self: true }); } else if (n === 'HYPERSPACEFURY') this.stage(A, 'def', -1, A, { self: true }); else if (n === 'MAKEITRAIN') this.stage(A, 'spa', -1, A, { self: true }); else { this.stage(A, 'atk', -1, A, { self: true }); this.stage(A, 'def', -1, A, { self: true }); } }
    // drain, recoil
    if (e === 'ABSORB' && dealt > 0 && A.hp > 0) { const pct = ['DRAININGKISS'].includes(n) ? 75 : ['DRAINPUNCH', 'MEGADRAIN', 'GIGADRAIN', 'LEECHLIFE', 'HORNLEECH', 'ABSORB', 'PARABOLICCHARGE', 'DRAINLIFE'].includes(n) ? 50 : 50; let h = Math.max(1, Math.floor(dealt * pct / 100)); if (this.hasItem(A, 'BIGROOT')) h = Math.floor(h * 13 / 10); if (this.abil(D, A, mv) === 'LIQUIDOOZE') { this.msg(aName + ' sucked up liquid ooze!'); this.loseHp(A, h); } else this.heal(A, h, this.nm(D).replace(/^./, c => c.toUpperCase()) + ' had its energy drained!'); }
    if (e === 'DREAM_EATER' && dealt > 0 && A.hp > 0) this.heal(A, Math.max(1, Math.floor(dealt / 2)), this.nm(D).replace(/^./, c => c.toUpperCase()) + "'s dream was eaten!");
    if ((e === 'RECOIL' || (e === 'STRUGGLE')) && dealt > 0 && A.hp > 0 && A.ability !== 'ROCKHEAD' && A.ability !== 'MAGICGUARD') { const div = n === 'HEADSMASH' || n === 'LIGHTOFRUIN' ? 2 : ['DOUBLEEDGE', 'BRAVEBIRD', 'FLAREBLITZ', 'VOLTTACKLE', 'WOODHAMMER', 'WAVECRASH', 'CHLOROBLAST'].includes(n) ? 3 : 4; if (e === 'STRUGGLE') { this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 4)), aName + ' is damaged by recoil!'); } else this.loseHp(A, Math.max(1, Math.floor(dealt / div)), aName + ' is damaged by recoil!'); }
    if (e === 'STRUGGLE' && dealt <= 0 && A.hp > 0) this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 4)), aName + ' is damaged by recoil!');
    if (this.hasItem(A, 'LIFEORB') && dealt > 0 && A.hp > 0 && A.ability !== 'MAGICGUARD' && !sheer) this.loseHp(A, Math.max(1, Math.floor(A.maxhp / 10)), aName + ' lost some of its HP!');
    if (this.hasItem(A, 'SHELLBELL') && dealt > 0 && A.hp > 0) this.heal(A, Math.max(1, Math.floor(dealt / 8)), aName + ' restored a little HP using its Shell Bell!');
    // misc effects
    switch (e) {
      case 'RECHARGE': if (A.hp > 0 && !(D.hp <= 0 && false)) A.v.recharge = true; break;
      case 'EXPLOSION': if (A.hp > 0) { A.hp = 0; this.ev({ t: 'hp', side: A.side, from: A.hp, to: 0, max: A.maxhp }); this.handleFaint(A, null); } break;
      case 'RAMPAGE': if (!A.v.lock) { A.v.lock = { move: mv.key, turns: 2 + this.rnd(2) }; } A.v.lock.turns--; if (A.v.lock.turns <= 0 || D.hp <= 0 && false) { A.v.lock = null; if (A.hp > 0) this.confuse(A, A, null, false); } break;
      case 'ROLLOUT': A.v.rollout = (A.v.rollout || 0) + 1; if (A.v.rollout >= 5) A.v.rollout = 0; else if (!A.v.lock) A.v.lock = { move: mv.key, turns: 5 }; if (A.v.lock) { A.v.lock.turns--; if (A.v.lock.turns <= 0) { A.v.lock = null; A.v.rollout = 0; } } break;
      case 'FURY_CUTTER': A.v.furyCutter = (A.v.furyCutter || 0) + 1; break;
      case 'TRAP': if (D.hp > 0 && !D.v.trap && !hitSub) { D.v.trap = 4 + this.rnd(2); D.v.trapMove = mv.name; D.v.trapBy = A; this.msg(this.trapText(n, D)); } break;
      case 'THIEF': if (D.hp > 0 && !hitSub && !this.ownItem(A) && this.ownItem(D) && D.ability !== 'STICKYHOLD') { A.item = D.item; D.item = ''; this.msg(aName + ' stole ' + this.nm(D, false) + "'s " + prettyKey(A.item) + '!'); } break;
      case 'KNOCK_OFF': if (D.hp > 0 && !hitSub && this.canKnockOff(D)) { this.msg(aName + ' knocked off ' + this.nm(D, false) + "'s " + prettyKey(D.item) + '!'); D.item = ''; D.v.unburden = true; } break;
      case 'SMACK_DOWN': if (D.hp > 0 && !hitSub) { D.v.smackedDown = true; D.v.semi = null; this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + ' fell straight down!'); } break;
      case 'BRICK_BREAK': { const S = this.sides[D.side]; if (S.reflect || S.lscreen || S.veil) { S.reflect = S.lscreen = S.veil = 0; this.msg("The wall shattered!"); } break; }
      case 'BURN_UP': if (A.hp > 0) { A.types = A.types.filter(t => t !== 'TYPE_FIRE'); if (!A.types.length) A.types = ['TYPE_MYSTERY']; this.msg(aName + ' burned itself out!'); } break;
      case 'RAPID_SPIN': { const S = this.sides[A.side]; if (n === 'RAPIDSPIN' || n === 'MORTALSPIN' || n === 'TIDYUP') { if (S.spikes || S.rocks || S.tspikes || S.web || A.v.leech || A.v.trap) { S.spikes = 0; S.rocks = false; S.tspikes = 0; S.web = false; A.v.leech = false; A.v.trap = 0; this.msg(aName + ' blew away the hazards!'); } if (n === 'RAPIDSPIN') this.stage(A, 'spe', 1, A, { self: true }); if (n === 'MORTALSPIN' && D.hp > 0) this.inflict(D, 'psn', A, mv, {}); } else if (n === 'DEFOG') { const T = this.sides[D.side]; T.reflect = T.lscreen = T.veil = T.safeguard = T.mist = 0; T.spikes = 0; T.rocks = false; T.tspikes = 0; T.web = false; S.spikes = 0; S.rocks = false; S.tspikes = 0; S.web = false; } break; }
      case 'PAY_DAY': this.coins = (this.coins || 0) + A.level * 2; this.msg('Coins scattered everywhere!'); break;
      case 'REMOVE_TARGET_STAT_CHANGES': if (D.hp > 0 && !hitSub) { for (const k of Object.keys(D.stages)) D.stages[k] = 0; this.ev({ t: 'stagereset', side: D.side }); this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + "'s stat changes were removed!"); } break;
      case 'EAT_BERRY': if (D.hp > 0 && !hitSub && /BERRY$/.test(D.item) && !D.heldUsed) { this.msg(aName + ' stole and ate ' + this.nm(D, false) + "'s " + prettyKey(D.item) + '!'); D.item = ''; D.heldUsed = true; } break;
      case 'BATON_PASS': if (A.hp > 0) this.pivot(A, n === 'BATONPASS'); break;
      case 'DAMAGE_SET_TERRAIN': { const t = { STEELROLLER: null, ICESPINNER: null, GENESISSUPERNOVA: 'psychic' }[n]; if (n === 'STEELROLLER' || n === 'ICESPINNER') this.terrain = { type: null, turns: 0 }; else if (t) this.setTerrain(t, A); break; }
      case 'FAKE_OUT': break; case 'ROAR': if (n === 'DRAGONTAIL' || n === 'CIRCLETHROW') { if (D.hp > 0 && !hitSub) this.forceSwitchTarget(A, D); } break;
      case 'SEMI_INVULNERABLE': if (n === 'BOUNCE' && D.hp > 0 && !hitSub && this.rnd(100) < 30) this.inflict(D, 'par', A, mv, {}); break;
      case 'ATTACK_BLOCKERS': if (n === 'THROATCHOP' && D.hp > 0) D.v.throatChop = 2; break;
      case 'SPLINTER': break; }
    if (n === 'WHIRLPOOL' || n === 'FIRESPIN') { }
    // Moxie style
    if (ko && A.hp > 0) { if (A.ability === 'MOXIE') this.stage(A, 'atk', 1, A, { self: true }); else if (A.ability === 'BEASTBOOST') { const best = STATS.slice().sort((x, y) => A.stats[y] - A.stats[x])[0]; this.stage(A, best, 1, A, { self: true }); } else if (A.ability === 'CHILLINGNEIGH') this.stage(A, 'atk', 1, A, { self: true }); else if (A.ability === 'GRIMNEIGH') this.stage(A, 'spa', 1, A, { self: true }); }
    if (!ko && hits >= 1) this.afterHpChange(D);
    if (this.hasItem(D, 'KINGSROCK') && false) { }
    if (this.hasItem(A, 'KINGSROCK') && !ko && D.hp > 0 && !hitSub && this.hasFlag(mv, 'kingsRock') && !D.v.movedThisTurn && this.rnd(100) < 10) D.v.flinch = true;
    if (this.hasItem(A, 'RAZORFANG') && !ko && D.hp > 0 && !D.v.movedThisTurn && this.rnd(100) < 10) D.v.flinch = true;
    if (this.hasItem(D, 'REDCARD') && false) { }
    if (D.v.destinyBond && ko && A.hp > 0) { this.msg(aName + ' took its attacker down with it!'); const f = A.hp; A.hp = 0; this.ev({ t: 'hp', side: A.side, from: f, to: 0, max: A.maxhp }); this.handleFaint(A, D); }
    if (this.hasItem(A, 'EJECTBUTTON') && false) { } }
  trapText(n, D) { const d = this.nm(D).replace(/^./, c => c.toUpperCase()); return ({ FIRESPIN: d + ' became trapped in the vortex!', WHIRLPOOL: d + ' became trapped in the vortex!', CLAMP: this.nm(D).replace(/^./, c => c.toUpperCase()) + ' was clamped!', BIND: d + ' was squeezed!', WRAP: d + ' was wrapped!', SANDTOMB: d + ' was trapped by Sand Tomb!', MAGMASTORM: d + ' became trapped by swirling magma!', INFESTATION: d + ' has been afflicted with an infestation!', SNAPTRAP: d + ' got trapped by a snap trap!', THUNDERCAGE: d + ' was trapped in the cage!', SALTCURE: d + ' is being salt cured!' })[n] || d + ' was trapped!'; }

  // ---------------------------------------------------------------------------------------------- status (non damaging) moves
  statusMove(A, D, mv, o) {
    const n = mv.norm, e = mv.effect; const aN = this.nm(A).replace(/^./, c => c.toUpperCase()), dN = D ? this.nm(D).replace(/^./, c => c.toUpperCase()) : '';
    const self = D === A; const fail = (t) => { this.msg(t || 'But it failed!'); A.v.lastFailed = true; return false; };
    this.ev({ t: 'anim', kind: 'status', side: A.side, move: mv.key, type: mv.type, self });
    // ----- plain stat changes
    const ST = { ATTACK: 'atk', DEFENSE: 'def', SPEED: 'spe', SPECIAL_ATTACK: 'spa', SPECIAL_DEFENSE: 'spd', ACCURACY: 'acc', EVASION: 'eva' };
    let m = /^(ATTACK|DEFENSE|SPEED|SPECIAL_ATTACK|SPECIAL_DEFENSE|ACCURACY|EVASION)_(UP|DOWN)(?:_(\d))?$/.exec(e);
    if (m) { const amt = +(m[3] || 1), up = m[2] === 'UP'; const T = up ? A : D; if (!up && D.v.sub > 0) return fail(); if (!this.stage(T, ST[m[1]], up ? amt : -amt, A, { mv })) A.v.lastFailed = false; return true; }
    const combo = { CALM_MIND: [['spa', 1], ['spd', 1]], BULK_UP: [['atk', 1], ['def', 1]], DRAGON_DANCE: [['atk', 1], ['spe', 1]], COSMIC_POWER: [['def', 1], ['spd', 1]], ATK_SPATK_UP: [['atk', 1], ['spa', 1]], ATK_ACC_UP: [['atk', 1], ['acc', 1]], DEF_SPD_UP: [['def', 2]] };
    if (combo[e]) { if (n === 'SHIFTGEAR') { this.stage(A, 'atk', 1, A, { self: true }); this.stage(A, 'spe', 2, A, { self: true }); return true; } if (n === 'COIL') { this.stage(A, 'atk', 1, A, { self: true }); this.stage(A, 'def', 1, A, { self: true }); this.stage(A, 'acc', 1, A, { self: true }); return true; } for (const [s, d] of combo[e]) this.stage(A, s, d, A, { self: true }); return true; }
    switch (e) {
      case 'TICKLE': if (D.v.sub > 0) return fail(); this.stage(D, 'atk', -1, A, { mv }); this.stage(D, 'def', -1, A, { mv }); return true;
      case 'PLAY_NICE': if (D.v.sub > 0) return fail(); this.stage(D, 'atk', -1, A, { mv }); if (n === 'NOBLEROAR' || n === 'TEARFULLOOK') this.stage(D, 'spa', -1, A, { mv }); return true;
      case 'EXTREME_EVOBOOST': if (n === 'CLANGOROUSSOUL') { if (A.hp * 3 <= A.maxhp) return fail(); this.loseHp(A, Math.floor(A.maxhp / 3)); } for (const s of STATS) this.stage(A, s, n === 'EXTREMEEVOBOOST' ? 2 : 1, A, { self: true }); return true;
      case 'FLATTER': if (D.v.sub > 0) return fail(); this.stage(D, 'spa', 1, A, { mv }); this.confuse(D, A, mv, true); return true;
      case 'SWAGGER': if (D.v.sub > 0) return fail(); this.stage(D, 'atk', 2, A, { mv }); this.confuse(D, A, mv, true); return true;
      case 'SLEEP': return this.inflict(D, 'slp', A, mv, { verbose: true });
      case 'POISON': return this.inflict(D, 'psn', A, mv, { verbose: true });
      case 'TOXIC': return this.inflict(D, 'tox', A, mv, { verbose: true });
      case 'WILL_O_WISP': return this.inflict(D, 'brn', A, mv, { verbose: true });
      case 'PARALYZE': if (mv.type === 'TYPE_ELECTRIC' && this.typeMult(mv.type, D, A, mv) === 0) { this.msg("It doesn't affect " + this.nm(D, false) + '...'); return false; } return this.inflict(D, 'par', A, mv, { verbose: true });
      case 'CONFUSE': return this.confuse(D, A, mv, true) || (D.v.confused > 0 ? false : false);
      case 'ATTRACT': if (!A.gender || !D.gender || A.gender === D.gender || D.v.infatuated) return fail(); D.v.infatuated = true; this.msg(dN + ' fell in love!'); return true;
      case 'YAWN': if (D.status || D.v.yawn) return fail(); D.v.yawn = 2; this.msg(dN + ' became drowsy!'); return true;
      case 'NIGHTMARE': if (D.status !== 'slp' || D.v.nightmare) return fail(); D.v.nightmare = true; this.msg(dN + ' began having a nightmare!'); return true;
      case 'RESTORE_HP': { if (A.hp >= A.maxhp) return fail(this.nm(A).replace(/^./, c => c.toUpperCase()) + "'s HP is full!"); if (n === 'ROOST') A.v.roost = true; if (n === 'LIFEDEW') { this.heal(A, Math.max(1, Math.floor(A.maxhp / 4)), null); return true; } if (n === 'JUNGLEHEALING' || n === 'LUNARBLESSING') { this.heal(A, Math.floor(A.maxhp / 4)); this.cureStatus(A, null); return true; } this.heal(A, Math.max(1, Math.floor(A.maxhp / 2)), aN + ' regained health!'); return true; }
      case 'MORNING_SUN': { if (A.hp >= A.maxhp) return fail(this.nm(A).replace(/^./, c => c.toUpperCase()) + "'s HP is full!"); const w = this.weatherOn(); const f = !w ? 2 : this.weatherOn('sun') ? 1.5 : 4; this.heal(A, Math.max(1, Math.floor(f === 1.5 ? A.maxhp * 2 / 3 : A.maxhp / f)), aN + ' regained health!'); return true; }
      case 'HEAL_TARGET': if (D.hp >= D.maxhp) return fail(); this.heal(D, Math.max(1, Math.floor(D.maxhp / 2)), dN + ' regained health!'); return true;
      case 'REST': if (A.hp >= A.maxhp || A.status === 'slp') return fail(); if (A.ability === 'INSOMNIA' || A.ability === 'VITALSPIRIT') return fail(); A.status = null; this.setStatus(A, 'slp'); A.sleep = 3; this.heal(A, A.maxhp - A.hp, aN + ' slept and became healthy!'); return true;
      case 'PROTECT': { if (n === 'MAXGUARD') return fail(); let c = true; if (A.v.protectN > 0) c = this.rnd(Math.pow(3, Math.min(A.v.protectN, 6))) === 0; if (!c) { A.v.protectN = 0; return fail(); } A.v.protectN++; A.v.protectKind = n === 'KINGSSHIELD' ? 'kings' : n === 'SPIKYSHIELD' ? 'spiky' : n === 'BANEFULBUNKER' ? 'baneful' : 'normal'; if (n === 'ENDURE') { A.v.endure = true; this.msg(aN + ' braced itself!'); } else { A.v.protect = true; this.ev({ t: 'anim', kind: 'protect', side: A.side }); this.msg(aN + ' protected itself!'); } return true; }
      case 'SUBSTITUTE': { if (A.v.sub > 0) return fail(aN + ' already has a substitute!'); const c = Math.floor(A.maxhp / 4); if (A.hp <= c) return fail('It was too weak to make a substitute!'); this.loseHp(A, c); A.v.sub = c; this.ev({ t: 'anim', kind: 'sub', side: A.side }); this.msg(aN + ' put in a substitute!'); return true; }
      case 'LEECH_SEED': if (this.isType(D, 'TYPE_GRASS') || D.v.leech) return fail(D.v.leech ? 'But it failed!' : "It doesn't affect " + this.nm(D, false) + '...'); if (D.v.sub > 0) return fail(); D.v.leech = true; D.v.leechTo = A.side; this.msg(dN + ' was seeded!'); return true;
      case 'REFLECT': { const S = this.sides[A.side]; if (S.reflect) return fail(); S.reflect = this.hasItem(A, 'LIGHTCLAY') ? 8 : 5; this.msg('Reflect raised ' + (A.side === 0 ? 'your' : "the opposing") + " team's Defense!"); return true; }
      case 'LIGHT_SCREEN': { const S = this.sides[A.side]; if (S.lscreen) return fail(); S.lscreen = this.hasItem(A, 'LIGHTCLAY') ? 8 : 5; this.msg('Light Screen raised ' + (A.side === 0 ? 'your' : "the opposing") + " team's Sp. Def!"); return true; }
      case 'MIST': { const S = this.sides[A.side]; if (S.mist) return fail(); S.mist = 5; this.msg('A mist shrouded the team!'); return true; }
      case 'SAFEGUARD': { const S = this.sides[A.side]; if (S.safeguard) return fail(); S.safeguard = 5; this.msg('A veil of mystical power covered the team!'); return true; }
      case 'SPIKES': { const S = this.sides[D.side]; if (n === 'SPIKES') { if (S.spikes >= 3) return fail(); S.spikes++; this.msg('Spikes were scattered on the ground around the opposing team\'s feet!'.replace('opposing team\'s', D.side === 1 ? "the opposing team's" : "your team's").replace('around the the', 'around the')); return true; } if (n === 'TOXICSPIKES') { if (S.tspikes >= 2) return fail(); S.tspikes++; this.msg('Poison spikes were scattered on the ground!'); return true; } if (n === 'STEALTHROCK') { if (S.rocks) return fail(); S.rocks = true; this.msg('Pointed stones float in the air around the foe!'); return true; } if (n === 'STICKYWEB') { if (S.web) return fail(); S.web = true; this.msg('A sticky web spreads out on the ground!'); return true; } return fail(); }
      case 'RAIN_DANCE': return this.setWeather('rain', A) || fail(); case 'SUNNY_DAY': return this.setWeather('sun', A) || fail(); case 'SANDSTORM': return this.setWeather('sand', A) || fail(); case 'HAIL': return this.setWeather('hail', A) || fail();
      case 'SET_TERRAIN': { const t = { ELECTRICTERRAIN: 'electric', GRASSYTERRAIN: 'grassy', MISTYTERRAIN: 'misty', PSYCHICTERRAIN: 'psychic' }[n]; return t && this.setTerrain(t, A) || fail(); }
      case 'FOCUS_ENERGY': if (A.v.focusEnergy) return fail(); A.v.focusEnergy = true; this.msg(aN + ' is getting pumped!'); return true;
      case 'MINIMIZE': A.v.minimized = true; this.stage(A, 'eva', 2, A, { self: true }); return true;
      case 'DEFENSE_CURL': A.v.defCurl = true; this.stage(A, 'def', 1, A, { self: true }); return true;
      case 'BELLY_DRUM': if (A.hp * 2 <= A.maxhp || A.stages.atk >= 6) return fail(); this.loseHp(A, Math.floor(A.maxhp / 2)); this.stage(A, 'atk', 12, A, { self: true, silent: true }); this.msg(aN + ' cut its own HP and maximized its Attack!'); return true;
      case 'ROAR': return this.forceSwitchTarget(A, D, true);
      case 'TELEPORT': if (this.kind === 'wild' && A.side === 0) { this.finish('ran', 'You got away safely!'); return true; } if (this.kind === 'wild' && A.side === 1) { this.finish('foefled', 'The wild ' + A.name + ' fled!'); return true; } return fail();
      case 'BATON_PASS': return this.pivot(A, n === 'BATONPASS') || fail();
      case 'FAIRY_LOCK_HAPPY_HOUR': this.msg('But nothing happened!'); return true;
      case 'DISABLE': { const lm = D.v.lastMove; if (!lm || D.v.disable) return fail(); D.v.disable = lm; D.v.disableTurns = 4; this.msg(dN + "'s " + this.mv(lm).name + ' was disabled!'); return true; }
      case 'ENCORE': { const lm = D.v.lastMove; if (!lm || D.v.encore) return fail(); D.v.encore = lm; D.v.encoreTurns = 3; this.msg(dN + ' received an encore!'); return true; }
      case 'TAUNT': if (D.v.taunt > 0) return fail(); D.v.taunt = 3; this.msg(dN + ' fell for the taunt!'); return true;
      case 'HAZE': for (const k of [A, D]) { for (const s of Object.keys(k.stages)) k.stages[s] = 0; } this.ev({ t: 'stagereset', side: 0 }); this.ev({ t: 'stagereset', side: 1 }); this.msg('All stat changes were eliminated!'); return true;
      case 'CURSE': if (this.isType(A, 'TYPE_GHOST')) { if (D.v.curse) return fail(); this.loseHp(A, Math.floor(A.maxhp / 2), aN + ' cut its own HP and laid a curse on ' + this.nm(D, false) + '!'); D.v.curse = true; } else { this.stage(A, 'spe', -1, A, { self: true }); this.stage(A, 'atk', 1, A, { self: true }); this.stage(A, 'def', 1, A, { self: true }); } return true;
      case 'PERISH_SONG': if (A.v.perish || D.v.perish) return fail(); A.v.perish = 4; D.v.perish = 4; this.msg('All Pokémon that heard the song will faint in three turns!'); return true;
      case 'DESTINY_BOND': A.v.destinyBond = true; this.msg(aN + ' is trying to take its foe down with it!'); return true;
      case 'PAIN_SPLIT': { const t = Math.floor((A.hp + D.hp) / 2); const fa = A.hp, fd = D.hp; A.hp = Math.min(A.maxhp, t); D.hp = Math.min(D.maxhp, t); this.ev({ t: 'hp', side: A.side, from: fa, to: A.hp, max: A.maxhp, heal: A.hp > fa }); this.ev({ t: 'hp', side: D.side, from: fd, to: D.hp, max: D.maxhp, heal: D.hp > fd }); this.msg('The battlers shared their pain!'); return true; }
      case 'METRONOME': { const keys = Object.keys(this.moveTable).filter(k => { const x = this.moveTable[k]; return x && x.effect !== 'MAX_MOVE' && !/METRONOME|STRUGGLE|SLEEPTALK|ASSIST|COPYCAT|MIRRORMOVE|MEFIRST|NATUREPOWER|SKETCH|MIMIC|PROTECT$/.test(NORM(k)); }); const k = keys[this.rnd(keys.length)]; const mm = this.mv(k); this.msg('Waggling a finger let it use ' + mm.name + '!'); this.runMove(A, this.foeOf(A), mm, { ...o, metronome: true }); return true; }
      case 'SKILL_SWAP': { if (n === 'SKILLSWAP') { const x = A.ability; A.ability = D.ability; D.ability = x; this.msg(aN + ' swapped Abilities with its target!'); return true; } if (n === 'WORRYSEED') { D.ability = 'INSOMNIA'; this.msg(dN + ' acquired Insomnia!'); return true; } if (n === 'SIMPLEBEAM') { D.ability = 'SIMPLE'; this.msg(dN + ' acquired Simple!'); return true; } if (n === 'GASTROACID') { D.v.gastro = true; this.msg(dN + "'s Ability was suppressed!"); return true; } if (n === 'ENTRAINMENT') { D.ability = A.ability; this.msg(dN + ' acquired ' + prettyKey(A.ability) + '!'); return true; } return fail(); }
      case 'TRICK': { if (n === 'BESTOW') return fail(); if (D.ability === 'STICKYHOLD') return fail(); const x = A.item; A.item = D.item; D.item = x; A.heldUsed = D.heldUsed = false; this.msg(aN + ' switched items with its target!'); return true; }
      case 'LOCK_ON': A.v.lockOn = 2; A.v.lockTarget = D; this.msg(aN + ' took aim at ' + this.nm(D, false) + '!'); return true;
      case 'FORESIGHT': D.v.foresight = true; this.msg(aN + ' identified ' + this.nm(D, false) + '!'); return true;
      case 'CONVERSION': { const first = A.moves[0] && this.mv(A.moves[0].key); if (!first || A.types.includes(first.type)) return fail(); A.types = [first.type]; this.msg(aN + ' transformed into the ' + prettyKey(first.type) + ' type!'); return true; }
      case 'HELPING_HAND': this.msg('But it failed!'); return false;
      case 'PSYCH_UP': Object.assign(A.stages, D.stages); this.msg(aN + ' copied ' + this.nm(D, false) + "'s stat changes!"); return true;
      case 'HEAL_BELL': for (const x of this.sides[A.side].party) if (x.hp > 0 && x.status) { x.status = null; x.sleep = 0; } this.ev({ t: 'status', side: A.side, status: null }); this.msg('A bell chimed!'); return true;
      case 'INGRAIN': if (A.v.ingrain) return fail(); A.v.ingrain = true; this.msg(aN + ' planted its roots!'); return true;
      case 'MEAN_LOOK': if (D.v.trapped || this.isType(D, 'TYPE_GHOST')) return fail(); D.v.trapped = true; this.msg(dN + ' can no longer escape!'); return true;
      case 'SPITE': { const lm = D.v.lastMove; const sl = D.moves.find(x => x.key === lm); if (!sl || sl.pp <= 0) return fail(); sl.pp = Math.max(0, sl.pp - 4); this.msg('It reduced the PP of ' + this.nm(D, false) + "'s " + this.mv(lm).name + ' by 4!'); return true; }
      case 'RECYCLE': if (n === 'RECYCLE' && A.heldUsed && A.item) { A.heldUsed = false; this.msg(aN + ' found one ' + prettyKey(A.item) + '!'); return true; } return fail();
      case 'REFRESH': if (!A.status) return fail(); this.cureStatus(A, aN + ' became healthy!'); return true;
      case 'MEMENTO': if (n === 'MEMENTO') { const f = A.hp; this.stage(D, 'atk', -2, A, { mv }); this.stage(D, 'spa', -2, A, { mv }); A.hp = 0; this.ev({ t: 'hp', side: A.side, from: f, to: 0, max: A.maxhp }); this.handleFaint(A, null); return true; } return fail();
      case 'MAGIC_COAT': A.v.magicCoat = true; this.msg(aN + ' shrouded itself with Magic Coat!'); return true;
      case 'TEAM_EFFECTS': { if (n === 'TAILWIND') { const S = this.sides[A.side]; if (S.tailwind) return fail(); S.tailwind = 4; this.msg('The tailwind blew from behind ' + (A.side === 0 ? 'your' : 'the opposing') + ' team!'); return true; } if (n === 'LUCKYCHANT') { this.sides[A.side].luckyChant = 5; this.msg('The Lucky Chant shielded the team from critical hits!'); return true; } if (n === 'MAGNETRISE') { A.v.magnetRise = 5; this.msg(aN + ' levitated with electromagnetism!'); return true; } return fail(); }
      case 'FIELD_EFFECTS': { if (n === 'TRICKROOM') { if (this.room.trick > 0) { this.room.trick = 0; this.msg('The twisted dimensions returned to normal!'); } else { this.room.trick = 5; this.msg(aN + ' twisted the dimensions!'); } return true; } if (n === 'GRAVITY') { if (this.gravity) return fail(); this.gravity = 5; this.msg('Gravity intensified!'); return true; } return fail(); }
      case 'ATTACK_BLOCKERS': if (n === 'HEALBLOCK') { D.v.healBlock = 5; this.msg(dN + ' was prevented from healing!'); return true; } if (n === 'EMBARGO') { D.v.embargo = 5; this.msg(dN + " can't use items anymore!"); return true; } if (n === 'TELEKINESIS') { D.v.magnetRise = 3; this.msg(dN + ' was hurled into the air!'); return true; } return fail();
      case 'TYPE_CHANGES': { if (n === 'SOAK') { D.types = ['TYPE_WATER']; this.msg(dN + ' transformed into the Water type!'); return true; } if (n === 'FORESTSCURSE') { D.v.addType = 'TYPE_GRASS'; D.types = D.types.concat('TYPE_GRASS'); this.msg('Grass type was added to ' + this.nm(D, false) + '!'); return true; } if (n === 'TRICKORTREAT') { D.types = D.types.concat('TYPE_GHOST'); this.msg('Ghost type was added to ' + this.nm(D, false) + '!'); return true; } if (n === 'MAGICPOWDER') { D.types = ['TYPE_PSYCHIC']; this.msg(dN + ' transformed into the Psychic type!'); return true; } return fail(); }
      case 'STAT_SWAP_SPLIT': { const sw = (x, y, ks, st) => { for (const k of ks) { const t = (st ? x.stages : x.stats)[k]; (st ? x.stages : x.stats)[k] = (st ? y.stages : y.stats)[k]; (st ? y.stages : y.stats)[k] = t; } }; if (n === 'POWERTRICK') { const t = A.stats.atk; A.stats.atk = A.stats.def; A.stats.def = t; this.msg(aN + ' switched its Attack and Defense!'); return true; } if (n === 'GUARDSWAP') { sw(A, D, ['def', 'spd'], true); this.msg(aN + ' switched all changes to its Defense and Sp. Def with the target!'); return true; } if (n === 'POWERSWAP') { sw(A, D, ['atk', 'spa'], true); this.msg(aN + ' switched all changes to its Attack and Sp. Atk with the target!'); return true; } if (n === 'HEARTSWAP') { sw(A, D, Object.keys(A.stages), true); this.msg(aN + ' switched stat changes with the target!'); return true; } if (n === 'SPEEDSWAP') { sw(A, D, ['spe'], false); this.msg(aN + ' exchanged Speed stats with its target!'); return true; } if (n === 'GUARDSPLIT') { for (const k of ['def', 'spd']) { const v = Math.floor((A.stats[k] + D.stats[k]) / 2); A.stats[k] = D.stats[k] = v; } this.msg(aN + ' shared its guard with the target!'); return true; } if (n === 'POWERSPLIT') { for (const k of ['atk', 'spa']) { const v = Math.floor((A.stats[k] + D.stats[k]) / 2); A.stats[k] = D.stats[k] = v; } this.msg(aN + ' shared its power with the target!'); return true; } return fail(); }
      case 'CHARGE': A.v.chargeBoost = true; this.stage(A, 'spd', 1, A, { self: true }); this.msg(aN + ' began charging power!'); return true;
      case 'WISH': { const S = this.sides[A.side]; if (S.wish) return fail(); S.wish = { turns: 2, amt: Math.max(1, Math.floor(A.maxhp / 2)), name: A.name }; this.msg(aN + ' made a wish!'); return true; }
      case 'STOCKPILE': if (A.v.stockpile >= 3) return fail(); A.v.stockpile++; this.msg(aN + ' stockpiled ' + A.v.stockpile + '!'); this.stage(A, 'def', 1, A, { self: true }); this.stage(A, 'spd', 1, A, { self: true }); return true;
      case 'SWALLOW': { const k = A.v.stockpile; if (!k || A.hp >= A.maxhp) return fail(); this.heal(A, Math.floor(A.maxhp * (k === 1 ? 25 : k === 2 ? 50 : 100) / 100), aN + ' regained health!'); A.v.stockpile = 0; return true; }
      case 'MUD_SPORT': case 'WATER_SPORT': A.v[n === 'MUDSPORT' ? 'mudSport' : 'waterSport'] = true; this.msg(n === 'MUDSPORT' ? 'Electricity\'s power was weakened!' : "Fire's power was weakened!"); return true;
      case 'NATURE_POWER': { const t = this.terrain.type; const k = t === 'electric' ? 'THUNDERBOLT' : t === 'grassy' ? 'ENERGYBALL' : t === 'misty' ? 'MOONBLAST' : t === 'psychic' ? 'PSYCHIC' : 'TRIATTACK'; const mm = this.mv(k) || this.mv('MOVE_TRI_ATTACK'); if (!mm) return fail(); this.msg('Nature Power turned into ' + mm.name + '!'); this.runMove(A, this.foeOf(A), mm, { ...o, metronome: true }); return true; }
      case 'MIRROR_MOVE': { const f = this.foeOf(A); const lm = f && f.v.lastMove ? this.mv(f.v.lastMove) : null; if (!lm || !this.hasFlag(lm, 'mirrorMove') && n === 'MIRRORMOVE') return fail(); this.runMove(A, f, lm, { ...o, metronome: true }); return true; }
      case 'ROLE_PLAY': A.ability = D.ability; this.msg(aN + ' copied ' + this.nm(D, false) + "'s " + prettyKey(D.ability) + '!'); return true;
      case 'VENOM_DRENCH': if (D.status === 'psn' || D.status === 'tox') { this.stage(D, 'atk', -1, A, { mv }); this.stage(D, 'spa', -1, A, { mv }); this.stage(D, 'spe', -1, A, { mv }); return true; } return fail();
      case 'ABSORB': if (n === 'STRENGTHSAP') { const amt = sm(D.stats.atk, D.stages.atk); this.stage(D, 'atk', -1, A, { mv }); this.heal(A, amt); return true; } return fail();
      case 'TORMENT': D.v.torment = true; this.msg(dN + ' was subjected to torment!'); return true;
      case 'FOLLOW_ME': this.msg('But it failed!'); return false;
      case 'CAMOUFLAGE': { const t = { electric: 'TYPE_ELECTRIC', grassy: 'TYPE_GRASS', misty: 'TYPE_FAIRY', psychic: 'TYPE_PSYCHIC' }[this.terrain.type] || 'TYPE_NORMAL'; A.types = [t]; this.msg(aN + ' transformed into the ' + prettyKey(t) + ' type!'); return true; }
      case 'RAPID_SPIN': if (n === 'DEFOG') { const S = this.sides[A.side], T = this.sides[D.side]; T.reflect = T.lscreen = T.veil = T.safeguard = T.mist = 0; for (const X of [S, T]) { X.spikes = 0; X.rocks = false; X.tspikes = 0; X.web = false; } this.msg(aN + ' blew away the hazards!'); this.stage(D, 'eva', -1, A, { mv }); return true; } if (n === 'TIDYUP') { const S = this.sides[A.side]; S.spikes = 0; S.rocks = false; S.tspikes = 0; S.web = false; this.stage(A, 'atk', 1, A, { self: true }); this.stage(A, 'spe', 1, A, { self: true }); return true; } return fail();
      case 'INSTRUCT_AFTER_YOU_QUASH': case 'MEMENTO_': return fail();
      case 'TRANSFORM': return fail();
      default: break; }
    // moves that only appear as MOVE_xxx without a handler: weather names, aurora veil, etc.
    if (n === 'AURORAVEIL') { if (!this.weatherOn('hail') || this.sides[A.side].veil) return fail(); this.sides[A.side].veil = 5; this.msg('Aurora Veil made ' + (A.side === 0 ? 'your' : 'the opposing') + ' team stronger against physical and special moves!'); return true; }
    if (n === 'SPLASH' || n === 'CELEBRATE' || n === 'HOLDHANDS') { this.msg('But nothing happened!'); return true; }
    this.unimpl = this.unimpl || new Set(); this.unimpl.add(e + ':' + n);
    this.msg('But nothing happened!'); return false; }
  // U-turn / Baton Pass: swap the user out after the move
  pivot(A, baton) {
    const S = this.sides[A.side]; const alive = S.party.filter(x => x.hp > 0 && x !== A); if (!alive.length) return false;
    if (A.side === 1) { const to = alive[0]; const keep = this.withdraw(A, { baton }); this.sendOut(1, to.idx, { keep: baton ? keep : null }); return true; }
    this.pendingPivot = { baton }; this.pending = { type: 'switch', pivot: true, baton }; return true; }
  forceSwitchTarget(A, D, status) {
    if (this.kind === 'wild') { if (D.side === 1) { if (A.level < D.level && status) { this.msg('But it failed!'); return false; } this.finish('foefled', 'The wild ' + D.name + ' fled!'); return true; } this.msg('But it failed!'); return false; }
    const S = this.sides[D.side]; const alive = S.party.filter(x => x.hp > 0 && x !== D); if (!alive.length || D.ability === 'SUCTIONCUPS' || D.v.ingrain) { if (status) this.msg('But it failed!'); return false; }
    const to = alive[this.rnd(alive.length)]; this.msg(this.nm(D).replace(/^./, c => c.toUpperCase()) + ' was dragged out!'); this.withdraw(D, {}); this.sendOut(D.side, to.idx, { msg: (D.side === 0 ? '' : '') + to.name + ' was dragged out!' }); return true; }

  // =================================================================================================== faint, exp, level up
  handleFaint(M, killer) {
    if (M.fainted) return; M.fainted = true; M.hp = 0; M.status = M.status;
    this.ev({ t: 'faint', side: M.side, idx: M.idx }); this.msg(this.nm(M).replace(/^./, c => c.toUpperCase()) + ' fainted!');
    if (M.side === 1) this.giveExp(M);
    const alive = this.alive(M.side).length; if (!alive) this.finish(M.side === 0 ? 'lose' : 'win'); }
  finish(result, text) {
    if (this.over) return; this.over = true; this.result = result; if (text) this.msg(text);
    if (result === 'win') { if (this.kind === 'trainer') { this.msg('You defeated ' + this.trainerName + '!'); if (this.defeatText) this.msg(this.defeatText); if (this.trainerMoney) this.msg('You got $' + this.trainerMoney + ' for winning!'); } }
    else if (result === 'lose') this.msg('You are out of usable Pokémon!');
    this.ev({ t: 'end', result }); }
  giveExp(F) {
    if (this.opts.noExp || this.kind === 'safari') return; const trainer = this.kind === 'trainer';
    const part = this.sides[0].party.filter(m => m.hp > 0 && F.fought.has(m.idx)); if (!part.length) return;
    for (const m of part) {
      const L = F.level, Lp = m.level, b = F.expYield || 64; let calc = (trainer ? 15 : 10) * b * L / 50;
      calc = calc * Math.pow((2 * L + 10) / (L + Lp + 10), 2.5) + 1; if (this.hasItem(m, 'LUCKYEGG')) calc *= 1.5; if (m.src && m.src.OTID && this.opts.playerId != null && m.src.OTID !== this.opts.playerId) calc *= 1.5;
      calc = Math.max(1, Math.floor(calc)); if (this.opts.expMultiplier) calc = Math.floor(calc * this.opts.expMultiplier);
      this.msg(m.name + ' gained ' + calc + ' Exp. Points!'); const before = m.exp; m.exp += calc; this.ev({ t: 'exp', idx: m.idx, gain: calc, from: before, to: m.exp, level: m.level, active: m === this.active(0), floor: expForLevel(m.growth, m.level), next: expForLevel(m.growth, m.level + 1) });
      while (m.level < 100 && m.exp >= expForLevel(m.growth, m.level + 1)) this.levelUp(m); } }
  levelUp(M) {
    const sp = M.spData || {}, nm = natureMods(M.src && M.src.nature); const iv = k => { const s = M.src || {}; const v = s['iv' + k]; return v == null ? 31 : v | 0; };
    const oldMax = M.maxhp; M.level++;
    const ev = k => { const s = M.src || {}; const v = s['ev' + k]; return v == null ? 0 : v | 0; };
    const nb = { atk: calcStat(sp.baseAttack || 50, iv('Attack'), ev('Attack'), M.level, nm.atk), def: calcStat(sp.baseDefense || 50, iv('Defense'), ev('Defense'), M.level, nm.def), spa: calcStat(sp.baseSpAttack || 50, iv('SpAttack'), ev('SpAttack'), M.level, nm.spa), spd: calcStat(sp.baseSpDefense || 50, iv('SpDefense'), ev('SpDefense'), M.level, nm.spd), spe: calcStat(sp.baseSpeed || 50, iv('Speed'), ev('Speed'), M.level, nm.spe) };
    const mh = calcHP(sp.baseHP || 50, iv('HP'), ev('HP'), M.level); M.maxhp = mh; if (M.hp > 0) M.hp += mh - oldMax;
    const gain = { hp: mh - oldMax, atk: nb.atk - M.base.atk, def: nb.def - M.base.def, spa: nb.spa - M.base.spa, spd: nb.spd - M.base.spd, spe: nb.spe - M.base.spe };
    M.base = nb; for (const k of STATS) M.stats[k] = nb[k] * 1; const actM = M === this.active(0);
    this.msg(M.name + ' grew to Lv. ' + M.level + '!'); this.ev({ t: 'levelup', idx: M.idx, level: M.level, gain, stats: { hp: mh, ...nb }, hp: M.hp, maxhp: M.maxhp, active: actM });
    const L = this.learn[M.species]; if (L && L.levelUp) for (const [lv, key] of L.levelUp) { if (lv !== M.level) continue; const mm = this.mv(key); if (!mm || M.moves.some(x => x.norm === mm.norm)) continue;
      if (M.moves.length < 4) { M.moves.push({ key: mm.key, norm: mm.norm, pp: mm.pp, maxpp: mm.pp }); this.msg(M.name + ' learned ' + mm.name + '!'); this.ev({ t: 'learned', idx: M.idx, move: mm.key }); }
      else this.learnQueue.push({ mon: M, move: mm }); }
    this.levelUps.push(M.idx); }
  resolveLearn(slot) {
    this.events = []; const q = this.learnQueue.shift(); if (!q) return this.events; const M = q.mon, mm = q.move;
    if (slot == null || slot < 0 || slot > 3) this.msg(M.name + ' did not learn ' + mm.name + '.');
    else { const old = M.moves[slot]; M.moves[slot] = { key: mm.key, norm: mm.norm, pp: mm.pp, maxpp: mm.pp }; this.msg('1, 2, and... Poof! ' + M.name + ' forgot ' + this.mv(old.key).name + '. And... ' + M.name + ' learned ' + mm.name + '!'); this.ev({ t: 'learned', idx: M.idx, move: mm.key }); }
    this.pending = this.learnQueue.length ? { type: 'learn', mon: this.learnQueue[0].mon.idx, move: this.learnQueue[0].move.key, name: this.learnQueue[0].move.name } : (this.over ? { type: 'end', result: this.result } : null);
    return this.events; }

  // =================================================================================================== the turn
  start() {
    this.events = []; this.phase = 'idle';
    if (this.weather.type) this.ev({ t: 'weather', type: this.weather.type });
    if (this.kind === 'trainer') this.msg(this.introText || (this.trainerName + ' would like to battle!'));
    const F = this.sides[1].party[this.sides[1].active], P = this.sides[0].party[this.sides[0].active];
    this.sendOut(1, F.idx); this.sendOut(0, P.idx); this.learnQueue = []; return this.events; }
  canSwitch(side) { const M = this.active(side); if (M.v.trap > 0 || M.v.trapped || M.v.ingrain) return false; if (M.item === 'SHEDSHELL') return true; const f = this.active(1 - side); if (f && f.hp > 0 && ((f.ability === 'SHADOWTAG' && M.ability !== 'SHADOWTAG') || (f.ability === 'ARENATRAP' && this.grounded(M)) || (f.ability === 'MAGNETPULL' && this.isType(M, 'TYPE_STEEL')))) return false; return true; }
  actionPriority(M, a) {
    switch (a.type) { case 'switch': return 7; case 'run': case 'ball': case 'item': return 8; }
    const mv = a.mv; if (!mv) return 0; let p = mv.priority;
    if (M.ability === 'PRANKSTER' && mv.split === 'STATUS') p++; if (M.ability === 'GALEWINGS' && mv.type === 'TYPE_FLYING' && M.hp === M.maxhp) p++;
    if (M.ability === 'TRIAGE' && this.hasFlag(mv, 'triage')) p += 3; return p; }
  turn(pa, fa) {
    if (this.over || (this.pending && this.pending.type !== 'none')) return [];
    this.events = []; this.phase = 'moves'; this.turnNo++;
    const P = this.active(0), F = this.active(1);
    for (const m of [P, F]) { m.v.usedMoves = m.v.usedMoves || new Set(); }
    const prep = (M, a) => {
      if (M.v.charging) return { type: 'move', slot: -1, forced: true }; if (M.v.lock) return { type: 'move', slot: -1, forced: true }; if (M.v.recharge) return { type: 'move', slot: -1, forced: true };
      if (a && a.type === 'move') { const us = this.usable(M); if (!M.moves[a.slot] || us[a.slot].disabled) { if (us.struggle) return { type: 'move', slot: 'struggle' }; const ok = us.find(u => !u.disabled); if (!ok) return { type: 'move', slot: 'struggle' }; return { type: 'move', slot: ok.slot }; } if (M.v.encore && M.v.encoreTurns > 0) { const i = M.moves.findIndex(x => x.key === M.v.encore && x.pp > 0); if (i >= 0) return { type: 'move', slot: i }; } }
      return a || { type: 'move', slot: 0 }; };
    pa = prep(P, pa); fa = prep(F, fa || this.chooseFoe());
    const entries = [];
    for (const [side, M, a] of [[0, P, pa], [1, F, fa]]) {
      const e = { side, mon: M, type: a.type, a, forced: a.forced }; 
      if (a.type === 'move') { const key = a.slot === 'struggle' || a.slot < 0 ? (M.v.charging ? M.v.charging.move : M.v.lock ? M.v.lock.move : 'STRUGGLE') : M.moves[a.slot].key; e.mv = this.mv(key); if (a.slot === -1 && !e.mv) e.mv = this.mv('STRUGGLE'); if (M.v.recharge && !M.v.charging) e.mv = e.mv || this.mv('STRUGGLE'); }
      e.prio = this.actionPriority(M, e); e.spd = this.effSpeed(M); if (this.room.trick > 0) e.spd = -e.spd; if (this.hasItem(M, 'QUICKCLAW') && this.rnd(100) < 20) e.spd = 1e9; if (this.hasItem(M, 'LAGGINGTAIL') || this.hasItem(M, 'FULLINCENSE')) e.prio -= 0.5; if (M.ability === 'STALL') e.prio -= 0.5;
      e.r = this.rand(); entries.push(e);
      M.v.willAttack = a.type === 'move' && e.mv && e.mv.split !== 'STATUS'; }
    for (const m of [P, F]) { m.v.movedThisTurn = false; m.v.tookDmg = false; m.v.protect = false; m.v.endure = false; m.v.lastDmgBy = {}; m.v.movedAfter = false; m.v.lastHitBy = null; if (!m.v.usedProtect) m.v.protectN = 0; m.v.usedProtect = false; }
    entries.sort((x, y) => y.prio - x.prio || y.spd - x.spd || x.r - y.r);
    this.q = entries; this.run(); return this.events; }
  run() {
    while (this.q && this.q.length && !this.over && !this.pending) {
      const a = this.q.shift(); const M = a.mon; const live = this.active(a.side) === M && M.hp > 0;
      if (a.type === 'switch' || a.type === 'item' || a.type === 'ball' || a.type === 'run') { if (!(a.type === 'switch' && !live)) this.doAction(a); }
      else if (live) { const foe = this.foeOf(M); if (foe && foe.v.movedThisTurn) M.v.movedAfter = true; this.doAction(a); } }
    if (this.pending) return;
    if (!this.over && this.phase === 'moves') { this.phase = 'end'; this.endTurn(); }
    if (this.learnQueue.length && !this.pending) { const q = this.learnQueue[0]; this.pending = { type: 'learn', mon: q.mon.idx, move: q.move.key, name: q.move.name }; return; }
    if (!this.over && this.phase === 'end') {
      const F = this.active(1); if (F.hp <= 0) { const nxt = this.sides[1].party.find(m => m.hp > 0); if (nxt) this.sendOut(1, nxt.idx); }
      const P = this.active(0); if (P.hp <= 0 && !this.over) { if (this.alive(0).length) { this.pending = { type: 'switch', forced: true }; if (this.learnQueue.length) { } return; } }
      this.phase = 'idle'; }
    if (this.learnQueue.length && !this.pending) { const q = this.learnQueue[0]; this.pending = { type: 'learn', mon: q.mon.idx, move: q.move.key, name: q.move.name }; return; }
    if (this.over && !this.pending) this.pending = { type: 'end', result: this.result }; }
  doAction(a) {
    const M = a.mon, side = a.side;
    switch (a.type) {
      case 'move': M.v.usedMoves.add(a.mv ? a.mv.key : ''); if (a.mv && /^(PROTECT|DETECT|ENDURE|KINGSSHIELD|SPIKYSHIELD|BANEFULBUNKER|SILKTRAP|OBSTRUCT|BURNINGBULWARK)$/.test(a.mv.norm)) M.v.usedProtect = true; this.useMove(M, a.a.slot, { forced: a.forced }); break;
      case 'switch': { if (!this.canSwitch(side)) { this.msg(this.nm(M).replace(/^./, c => c.toUpperCase()) + " can't be switched out!"); break; } const to = this.sides[side].party[a.a.to]; if (!to || to.hp <= 0 || to === M) break; if (side === 0) this.msg(M.name + ', come back!'); else this.msg(this.trainerName + ' withdrew ' + M.name + '!'); this.ev({ t: 'withdraw', side }); this.withdraw(M, {}); this.sendOut(side, to.idx); break; }
      case 'run': this.tryRun(); break;
      case 'ball': this.throwBall(a.a.ball); break;
      case 'item': this.useBagItem(a.a.item, a.a.target, a.a.move, side); break; } }

  endTurn() {
    this.ev({ t: 'endturn' }); const sp = [this.active(0), this.active(1)].sort((x, y) => this.effSpeed(y) - this.effSpeed(x) || this.rnd(2) - 0.5);
    const nm = M => this.nm(M).replace(/^./, c => c.toUpperCase());
    // weather
    if (this.weather.type) {
      const wt = this.weather.type; this.weather.turns--;
      if (this.weatherOn()) { this.msg({ rain: 'Rain continues to fall.', sun: 'The sunlight is strong.', sand: 'The sandstorm rages.', hail: 'Hail continues to fall.' }[wt]); this.ev({ t: 'anim', kind: 'weather', type: wt });
        for (const M of sp) { if (M.hp <= 0) continue;
          if (wt === 'sand' && !M.types.some(t => t === 'TYPE_ROCK' || t === 'TYPE_GROUND' || t === 'TYPE_STEEL') && !['SANDVEIL', 'SANDRUSH', 'SANDFORCE', 'MAGICGUARD', 'OVERCOAT'].includes(M.ability) && !this.hasItem(M, 'SAFETYGOGGLES')) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 16)), nm(M) + ' is buffeted by the sandstorm!');
          if (wt === 'hail' && !this.isType(M, 'TYPE_ICE') && !['ICEBODY', 'SNOWCLOAK', 'SLUSHRUSH', 'MAGICGUARD', 'OVERCOAT'].includes(M.ability) && !this.hasItem(M, 'SAFETYGOGGLES')) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 16)), nm(M) + ' is pelted by hail!');
          if (M.hp > 0) { if (wt === 'rain' && M.ability === 'RAINDISH') this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), nm(M) + "'s Rain Dish restored its HP!"); if (wt === 'rain' && M.ability === 'DRYSKIN') this.heal(M, Math.max(1, Math.floor(M.maxhp / 8)), nm(M) + "'s Dry Skin restored its HP!"); if (wt === 'sun' && (M.ability === 'DRYSKIN' || M.ability === 'SOLARPOWER')) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 8)), nm(M) + "'s " + prettyKey(M.ability) + ' hurt it!'); if (wt === 'hail' && M.ability === 'ICEBODY') this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), nm(M) + "'s Ice Body restored its HP!"); } } }
      if (this.weather.turns <= 0 && !this.over) { this.msg({ rain: 'The rain stopped.', sun: 'The sunlight faded.', sand: 'The sandstorm subsided.', hail: 'The hail stopped.' }[wt]); this.weather = { type: null, turns: 0 }; this.ev({ t: 'weather', type: null }); } }
    if (this.over) return;
    for (const M of sp) {
      if (M.hp <= 0 || this.over) continue; const w = nm(M); const mg = M.ability === 'MAGICGUARD';
      if (M.v.ingrain) this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), w + ' absorbed nutrients with its roots!');
      if (M.v.leech && M.hp > 0) { const to = this.active(M.v.leechTo); if (!mg) { const amt = Math.max(1, Math.floor(M.maxhp / 8)); this.loseHp(M, amt, w + "'s health is sapped by Leech Seed!"); if (to && to.hp > 0) { if (M.ability === 'LIQUIDOOZE') this.loseHp(to, amt); else this.heal(to, this.hasItem(to, 'BIGROOT') ? Math.floor(amt * 13 / 10) : amt); } } }
      if (M.hp <= 0) continue;
      const it = this.ownItem(M);
      if (it === 'LEFTOVERS') this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), w + ' restored a little HP using its Leftovers!');
      if (it === 'BLACKSLUDGE') { if (this.isType(M, 'TYPE_POISON')) this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), w + ' restored a little HP using its Black Sludge!'); else if (!mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 8)), w + ' was hurt by its Black Sludge!'); }
      if (M.hp <= 0) continue;
      if (this.terrain.type === 'grassy' && this.grounded(M)) this.heal(M, Math.max(1, Math.floor(M.maxhp / 16)), w + "'s HP was restored by the grassy terrain!");
      if (M.status === 'psn') { if (M.ability === 'POISONHEAL') this.heal(M, Math.max(1, Math.floor(M.maxhp / 8)), w + "'s Poison Heal restored its HP!"); else if (!mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 8)), w + ' was hurt by poison!'); }
      else if (M.status === 'tox') { if (M.ability === 'POISONHEAL') this.heal(M, Math.max(1, Math.floor(M.maxhp / 8)), w + "'s Poison Heal restored its HP!"); else if (!mg) { this.loseHp(M, Math.max(1, Math.floor(M.maxhp * M.toxic / 16)), w + ' was hurt by poison!'); } if (M.toxic < 15) M.toxic++; }
      else if (M.status === 'brn' && !mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / (M.ability === 'HEATPROOF' ? 32 : 16))), w + ' was hurt by its burn!');
      else if (M.status === 'frz' && this.frostbite && !mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 16)), w + ' was hurt by frostbite!');
      if (M.hp <= 0) continue;
      if (M.v.nightmare && M.status === 'slp' && !mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 4)), w + ' is locked in a nightmare!');
      if (M.hp > 0 && M.v.curse && !mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / 4)), w + ' is afflicted by the curse!');
      if (M.hp > 0 && M.v.trap > 0) { M.v.trap--; if (M.v.trap <= 0) { this.msg(w + ' was freed from ' + (M.v.trapMove || 'the trap') + '!'); } else if (!mg) this.loseHp(M, Math.max(1, Math.floor(M.maxhp / (this.hasItem(M.v.trapBy || {}, 'BINDINGBAND') ? 6 : 8))), w + ' is hurt by ' + (M.v.trapMove || 'the trap') + '!'); }
      if (M.hp <= 0) continue;
      if (M.v.perish > 0) { M.v.perish--; this.msg(w + "'s perish count fell to " + M.v.perish + '!'); if (M.v.perish === 0) { const f = M.hp; M.hp = 0; this.ev({ t: 'hp', side: M.side, from: f, to: 0, max: M.maxhp }); this.handleFaint(M); continue; } }
      if (M.ability === 'SPEEDBOOST' && !M.v.firstTurnWas) this.stage(M, 'spe', 1, M, { self: true });
      if (M.ability === 'SHEDSKIN' && M.status && this.rnd(3) === 0) this.cureStatus(M, w + "'s Shed Skin cured its status!");
      if (M.ability === 'HYDRATION' && this.weatherOn('rain') && M.status) this.cureStatus(M, w + "'s Hydration cured its status!");
      if (M.ability === 'BADDREAMS') { const f = this.foeOf(M); if (f && f.status === 'slp') this.loseHp(f, Math.max(1, Math.floor(f.maxhp / 8)), nm(f) + ' is tormented!'); }
      if (M.ability === 'HARVEST' && M.heldUsed && /BERRY$/.test(M.item) && (this.weatherOn('sun') || this.rnd(2) === 0)) { M.heldUsed = false; this.msg(w + ' harvested one ' + prettyKey(M.item) + '!'); }
      if (it === 'TOXICORB' && !M.status) this.inflict(M, 'tox', null, null, { verbose: false });
      if (it === 'FLAMEORB' && !M.status) this.inflict(M, 'brn', null, null, { verbose: false });
      if (M.v.yawn > 0) { M.v.yawn--; if (M.v.yawn === 0 && !M.status) this.inflict(M, 'slp', null, null, { verbose: false }); }
      if (M.v.taunt > 0) { M.v.taunt--; if (!M.v.taunt) this.msg(w + "'s taunt wore off!"); }
      if (M.v.encoreTurns > 0) { M.v.encoreTurns--; if (!M.v.encoreTurns) { M.v.encore = null; this.msg(w + "'s encore ended!"); } }
      if (M.v.disableTurns > 0) { M.v.disableTurns--; if (!M.v.disableTurns) { M.v.disable = null; this.msg(w + ' is no longer disabled!'); } }
      if (M.v.magnetRise > 0) { M.v.magnetRise--; if (!M.v.magnetRise) this.msg(w + ' came back down!'); }
      if (M.v.healBlock > 0) M.v.healBlock--; if (M.v.embargo > 0) M.v.embargo--; if (M.v.slowStart > 0) { M.v.slowStart--; if (!M.v.slowStart) this.msg(w + ' got its act together!'); }
      if (M.v.lockOn > 0) M.v.lockOn--; if (M.v.throatChop > 0) M.v.throatChop--;
      M.v.flinch = false; M.v.roost = false; M.v.helping = false; M.v.firstTurnWas = false; M.v.magicCoat = false; M.v.chargeBoost = M.v.chargeBoost;
      if (this.hasItem(M, 'WHITEHERB')) { const neg = Object.keys(M.stages).filter(k => M.stages[k] < 0); if (neg.length) { this.useItem(M, 'restored its status using its White Herb'); for (const k of neg) M.stages[k] = 0; } }
      this.afterHpChange(M); }
    if (this.over) return;
    for (const S of this.sides) if (S.wish && --S.wish.turns <= 0) { const M = this.active(S.idx); if (M && M.hp > 0) this.heal(M, S.wish.amt, S.wish.name + "'s wish came true!"); S.wish = null; }
    // side conditions
    for (const S of this.sides) {
      const who = S.idx === 0 ? 'Your' : 'The opposing';
      for (const [k, t] of [['reflect', 'Reflect'], ['lscreen', 'Light Screen'], ['veil', 'Aurora Veil'], ['safeguard', 'Safeguard'], ['mist', 'Mist'], ['tailwind', 'tailwind'], ['luckyChant', 'Lucky Chant']]) if (S[k] > 0) { S[k]--; if (S[k] === 0) this.msg(who + " team's " + t + ' wore off!'); } }
    if (this.terrain.type) { this.terrain.turns--; if (this.terrain.turns <= 0) { this.msg('The terrain returned to normal!'); this.terrain = { type: null, turns: 0 }; this.ev({ t: 'terrain', type: null }); } }
    if (this.room.trick > 0) { this.room.trick--; if (!this.room.trick) this.msg('The twisted dimensions returned to normal!'); }
    if (this.gravity > 0) { this.gravity--; if (!this.gravity) this.msg('Gravity returned to normal!'); } }

  // =================================================================================================== AI
  chooseFoe() {
    const F = this.active(1), P = this.active(0);
    if (F.v.charging || F.v.lock || F.v.recharge) return { type: 'move', slot: -1, forced: true };
    if (this.kind === 'trainer' && this.trainerItems.length && F.hp > 0) {   // trainer bag: heal below 25% HP, cure a status
      const HEAL = { POTION: 20, SUPERPOTION: 60, HYPERPOTION: 120, MAXPOTION: 9999, FULLRESTORE: 9999, FRESHWATER: 30, SODAPOP: 50, LEMONADE: 70, MOOMOOMILK: 100, BERRYJUICE: 20 };
      const CURE = { ANTIDOTE: ['psn', 'tox'], PARALYZEHEAL: ['par'], AWAKENING: ['slp'], BURNHEAL: ['brn'], ICEHEAL: ['frz'], FULLHEAL: 1, FULLRESTORE: 1 };
      let pick = -1;
      if (F.hp <= F.maxhp / 4) { const miss = F.maxhp - F.hp; let bestI = -1, bestV = 1e9; this.trainerItems.forEach((it, i) => { const h = HEAL[NORM(it)]; if (h == null) return; const v = h >= miss ? h : 1e8 - h; if (v < bestV) { bestV = v; bestI = i; } }); pick = bestI; }
      if (pick < 0 && F.status) pick = this.trainerItems.findIndex(it => { const c = CURE[NORM(it)]; return c === 1 || (c && c.indexOf(F.status) >= 0); });
      if (pick >= 0) { const it = this.trainerItems.splice(pick, 1)[0]; return { type: 'item', item: it, target: F.idx }; }
    }
    const us = this.usable(F); if (us.struggle) return { type: 'move', slot: 'struggle' };
    let best = 0, bs = -1e9; const noise = this.kind === 'wild' ? 35 : (this.ai === 'smart' ? 0 : 6);
    for (const u of us) { if (u.disabled) continue; const mv = this.mv(u.key); const s = this.aiScore(F, P, mv) + this.rnd(noise); if (s > bs) { bs = s; best = u.slot; } }
    // trainers sometimes bring in a better matchup
    if (this.kind === 'trainer' && bs < 20 && this.canSwitch(1)) { const alt = this.sides[1].party.filter(m => m.hp > 0 && m !== F); if (alt.length && this.rnd(100) < 25) return { type: 'switch', to: alt[this.rnd(alt.length)].idx }; }
    return { type: 'move', slot: best }; }
  aiScore(A, D, mv) {
    const hpPct = A.hp / A.maxhp; const e = mv.effect, n = mv.norm;
    if (mv.split !== 'STATUS') {
      const r = this.calcDamage(A, D, mv, { crit: false, roll: 92, dry: true, magnitude: 71, noSheer: false }); if (r.immune) return -100;
      const abl = this.abil(D, A, mv); if (abl === 'WONDERGUARD' && r.eff <= 1) return -100; if ((r.type === 'TYPE_ELECTRIC' && ['VOLTABSORB', 'LIGHTNINGROD', 'MOTORDRIVE'].includes(abl)) || (r.type === 'TYPE_WATER' && ['WATERABSORB', 'STORMDRAIN', 'DRYSKIN'].includes(abl)) || (r.type === 'TYPE_FIRE' && abl === 'FLASHFIRE') || (r.type === 'TYPE_GRASS' && abl === 'SAPSIPPER') || (r.type === 'TYPE_GROUND' && abl === 'EARTHEATER')) return -100;
      const acc = mv.accuracy ? Math.min(100, this.accuracyOf(A, D, mv)) : 100; let s = Math.min(r.dmg, D.hp) / Math.max(1, D.hp) * 100 * acc / 100;
      if (r.dmg >= D.hp) { s += 40 + (mv.priority > 0 ? 25 : 0); }
      if (e === 'RECHARGE') s *= 0.6; if (this.chargeInfo(A, mv)) s *= 0.55; if (e === 'EXPLOSION') s = hpPct < 0.25 ? s : s - 70; if (e === 'RECOIL') s *= 0.9; if (e === 'OVERHEAT' || e === 'SUPERPOWER') s *= 0.85; if (e === 'FOCUS_PUNCH') s *= 0.5; if (e === 'FAKE_OUT' && !A.v.firstTurn) return -50; if (e === 'DREAM_EATER' && D.status !== 'slp') return -100; if (n === 'SNORE' || n === 'SLEEPTALK') if (A.status !== 'slp') return -100;
      if (e === 'SUCKER_PUNCH') s *= 0.7; if (e === 'COUNTER' || e === 'MIRROR_COAT') s = 20; return s; }
    const hasSt = !!D.status, ST = { SLEEP: 'slp', POISON: 'psn', TOXIC: 'tox', PARALYZE: 'par', WILL_O_WISP: 'brn' };
    if (ST[e]) { if (hasSt) return -60; if (this.sides[D.side].safeguard > 0) return -60; const t = mv.type; if (e === 'PARALYZE' && mv.type === 'TYPE_ELECTRIC' && this.typeMult(t, D, A, mv) === 0) return -80; if ((e === 'POISON' || e === 'TOXIC') && (this.isType(D, 'TYPE_POISON') || this.isType(D, 'TYPE_STEEL'))) return -80; if (e === 'WILL_O_WISP' && this.isType(D, 'TYPE_FIRE')) return -80; return e === 'SLEEP' ? 70 : e === 'TOXIC' ? 50 : 45; }
    if (e === 'CONFUSE') return D.v.confused > 0 ? -60 : 40;
    if (e === 'RESTORE_HP' || e === 'MORNING_SUN' || e === 'REST') return hpPct < 0.5 ? 85 : hpPct < 0.75 ? 25 : -50;
    if (e === 'PROTECT') return A.v.protectN > 0 ? -30 : 5;
    if (/_UP(_\d)?$/.test(e) || ['CALM_MIND', 'BULK_UP', 'DRAGON_DANCE', 'COSMIC_POWER', 'ATK_SPATK_UP', 'BELLY_DRUM'].includes(e)) { const st = Math.max(A.stages.atk, A.stages.spa, A.stages.def); return hpPct > 0.4 && st < 2 ? 42 - st * 12 : -20; }
    if (/_DOWN(_\d)?$/.test(e)) return D.stages.atk > -2 ? 22 : -20;
    if (['SUNNY_DAY', 'RAIN_DANCE', 'SANDSTORM', 'HAIL'].includes(e)) return this.weather.type ? -10 : 32;
    if (e === 'SPIKES') { const S = this.sides[D.side]; return (n === 'SPIKES' && S.spikes < 3) || (n === 'TOXICSPIKES' && S.tspikes < 2) || (n === 'STEALTHROCK' && !S.rocks) || (n === 'STICKYWEB' && !S.web) ? 30 : -50; }
    if (e === 'SUBSTITUTE') return !A.v.sub && hpPct > 0.5 ? 34 : -40; if (e === 'LEECH_SEED') return D.v.leech || this.isType(D, 'TYPE_GRASS') ? -50 : 46;
    if (e === 'REFLECT' || e === 'LIGHT_SCREEN') return this.sides[A.side][e === 'REFLECT' ? 'reflect' : 'lscreen'] ? -50 : 36;
    if (e === 'FOCUS_ENERGY') return A.v.focusEnergy ? -50 : 25; if (e === 'HAZE') return Math.max(...Object.values(D.stages)) > 1 ? 40 : -20;
    if (e === 'BATON_PASS') return 5; if (e === 'ROAR' || e === 'TELEPORT') return -10; return 12; }

  // =================================================================================================== run / ball / items
  tryRun() {
    const P = this.active(0), F = this.active(1);
    if (this.kind !== 'wild') { this.msg("No! There's no running from a trainer battle!"); return false; }
    if (!this.canSwitch(0) && P.item !== 'SMOKEBALL') { this.msg("You can't escape!"); return false; }
    this.ranAttempts++; const ps = this.effSpeed(P), fs = this.effSpeed(F);
    let ok = ps >= fs || P.ability === 'RUNAWAY' || this.hasItem(P, 'SMOKEBALL'); if (!ok) { const f = Math.floor(ps * 128 / fs) + 30 * (this.ranAttempts - 1); ok = f > 255 || this.rnd(256) < f; }
    if (ok) { this.finish('ran', 'Got away safely!'); return true; } this.msg("Can't escape!"); return false; }
  catchOdds(ball, F) {
    const rate = F.spData && F.spData.catchRate != null ? F.spData.catchRate : 45; const n = NORM(ball) || 'POKEBALL'; const P = this.active(0);
    let mult = { POKEBALL: 1, GREATBALL: 1.5, ULTRABALL: 2, SAFARIBALL: 1.5, PREMIERBALL: 1, LUXURYBALL: 1, HEALBALL: 1, CHERISHBALL: 1, DUSKBALL: 1, TIMERBALL: Math.min(4, 1 + this.turnNo * 0.3), QUICKBALL: this.turnNo <= 1 ? 5 : 1, NESTBALL: Math.max(1, (41 - F.level) / 10), NETBALL: (this.isType(F, 'TYPE_BUG') || this.isType(F, 'TYPE_WATER')) ? 3.5 : 1, DIVEBALL: 1, REPEATBALL: 1, LEVELBALL: P.level >= F.level * 4 ? 8 : P.level >= F.level * 2 ? 4 : P.level > F.level ? 2 : 1, FASTBALL: (F.stats.spe >= 100 ? 4 : 1), MOONBALL: 1, LOVEBALL: 1, HEAVYBALL: 1, FRIENDBALL: 1, LUREBALL: 1, MASTERBALL: 255 }[n]; if (mult == null) mult = 1;
    if (n === 'DUSKBALL') mult = 1; let odds = Math.floor((3 * F.maxhp - 2 * F.hp) * rate * mult / (3 * F.maxhp));
    if (F.level <= 20) odds = Math.floor(odds * (30 - F.level) / 10); // CFRU: SwSh low level modifier
    if (F.status === 'slp') odds = Math.floor(odds * 25 / 10); else if (F.status) odds = Math.floor(odds * 15 / 10);
    return n === 'MASTERBALL' ? 0xFFFF : odds; }
  throwBall(ball) {
    const F = this.active(1), P = this.active(0);
    if (this.kind !== 'wild' && this.kind !== 'safari') { this.ev({ t: 'ball', ball, shakes: 0, caught: false, blocked: true }); this.msg("The trainer blocked the Ball! Don't be a thief!"); return false; }
    const odds = this.catchOdds(ball, F); let shakes = 0;
    if (odds >= 0xFF) shakes = 4; else { const b = Math.floor(0xFFFF0 / Math.sqrt(Math.sqrt(0xFF0000 / Math.max(1, odds)))); while (shakes < 4 && this.rnd(65536) < b) shakes++; }
    const caught = shakes >= 4; this.ev({ t: 'ball', ball, shakes: Math.min(shakes, 3), caught }); this.usedItems = (this.usedItems || []).concat([ball || 'ITEM_POKE_BALL']);
    if (caught) { this.msg('Gotcha! ' + F.name + ' was caught!'); const src = this.snapshot(F); src.ballId = ball; this.caught.push(src); this.giveExp(F); this.finish('caught'); return true; }
    this.msg(['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Shoot! It was so close, too!'][Math.min(shakes, 3)]); return false; }
  snapshot(M) { const s = JSON.parse(JSON.stringify(M.src || {})); this.writeBack(M, s); return s; }
  useBagItem(item, target, moveSlot, sd) {
    sd = sd || 0; const key = NORM(item); const M = this.sides[sd].party[target == null ? this.sides[sd].active : target]; if (!M) return false;
    const heal = { POTION: 20, SUPERPOTION: 60, HYPERPOTION: 120, MAXPOTION: 9999, FRESHWATER: 30, SODAPOP: 50, LEMONADE: 70, MOOMOOMILK: 100, BERRYJUICE: 20 };
    const cure = { ANTIDOTE: ['psn', 'tox'], PARALYZEHEAL: ['par'], AWAKENING: ['slp'], BURNHEAL: ['brn'], ICEHEAL: ['frz'], FULLHEAL: ['psn', 'tox', 'par', 'slp', 'brn', 'frz'] };
    const xs = { XATTACK: ['atk'], XDEFENSE: ['def'], XSPEED: ['spe'], XSPATK: ['spa'], XSPECIAL: ['spa'], XSPDEF: ['spd'], XACCURACY: ['acc'], DIREHIT: [] };
    if (sd === 0) this.usedItems = (this.usedItems || []).concat([item]); else this.msg(this.trainerName + ' used ' + prettyKey(String(item).replace(/^ITEM_/, '')) + '!'); const nm = M.name;
    if (key === 'REVIVE' || key === 'MAXREVIVE') { if (M.hp > 0) { this.msg('It won\'t have any effect.'); return false; } M.fainted = false; M.hp = key === 'MAXREVIVE' ? M.maxhp : Math.max(1, Math.floor(M.maxhp / 2)); this.ev({ t: 'hp', side: sd, from: 0, to: M.hp, max: M.maxhp, heal: true, idx: M.idx, bench: M !== this.active(sd) }); this.msg(nm + ' was revived!'); return true; }
    if (M.hp <= 0) { this.msg('It won\'t have any effect.'); return false; }
    if (heal[key] != null) { if (M.hp >= M.maxhp) { this.msg('It won\'t have any effect.'); return false; } const f = M.hp; M.hp = Math.min(M.maxhp, M.hp + heal[key]); this.ev({ t: 'hp', side: sd, from: f, to: M.hp, max: M.maxhp, heal: true, idx: M.idx, bench: M !== this.active(sd) }); this.msg(nm + ' recovered ' + (M.hp - f) + ' HP!'); return true; }
    if (key === 'FULLRESTORE') { const f = M.hp; M.hp = M.maxhp; M.status = null; M.sleep = 0; M.v.confused = 0; this.ev({ t: 'hp', side: sd, from: f, to: M.hp, max: M.maxhp, heal: true, idx: M.idx, bench: M !== this.active(sd) }); this.ev({ t: 'status', side: sd, status: null }); this.msg(nm + ' was fully restored!'); return true; }
    if (cure[key]) { if (!M.status || cure[key].indexOf(M.status) < 0) { this.msg('It won\'t have any effect.'); return false; } this.cureStatus(M, nm + ' was cured!'); return true; }
    if (xs[key]) { if (key === 'DIREHIT') { M.v.focusEnergy = true; this.msg(nm + ' is getting pumped!'); } else this.stage(M, xs[key][0], 2, M, { self: true }); return true; }
    if (key === 'ETHER' || key === 'MAXETHER') { const s = M.moves[moveSlot || 0]; if (!s) return false; s.pp = Math.min(s.maxpp, s.pp + (key === 'MAXETHER' ? 99 : 10)); this.msg(nm + "'s PP was restored!"); return true; }
    this.msg('It won\'t have any effect.'); return false; }

  // =================================================================================================== public API for the screen + saving
  switchTo(idx) {
    this.events = []; const P = this.sides[0]; const M = P.party[idx];
    if (!this.pending || this.pending.type !== 'switch' || !M || M.hp <= 0 || idx === P.active && P.party[P.active].hp > 0) return this.events;
    const piv = this.pendingPivot; this.pendingPivot = null; this.pending = null;
    if (piv) { const cur = this.active(0); this.msg(cur.name + ', come back!'); this.ev({ t: 'withdraw', side: 0 }); const keep = this.withdraw(cur, { baton: piv.baton }); this.sendOut(0, idx, { keep: piv.baton ? keep : null }); }
    else this.sendOut(0, idx);
    this.run(); return this.events; }
  writeBack(M, s) {
    s.HP = M.hp; s.maxHP = M.maxhp; s.level = M.level; s.exp = M.exp; s.Attack = M.base.atk; s.Def = M.base.def; s.spattack = M.base.spa; s.sdpef = M.base.spd; s.speed = M.base.spe;
    if (s.expmax != null || true) s.expmax = expForLevel(M.growth, M.level + 1); s.status = M.status || 'none'; if (s.status === 'none') delete s.status;
    s.moves = M.moves.map(x => ({ moveId: x.key, currentPP: x.pp, maxPP: x.maxpp }));
    if (M.heldUsed) s.heldItem = ''; else if (M.item !== M.origItem) s.heldItem = M.item ? 'ITEM_' + M.item : ''; }
  commit() { for (const M of this.sides[0].party) if (M.src) { this.writeBack(M, M.src); } return this.sides[0].party.map(m => m.src); }
  evolutions() { const out = []; for (const M of this.sides[0].party) { if (!this.levelUps.includes(M.idx) || M.hp <= 0) continue; const rows = this.evo[M.species] || []; for (const r of rows) if (r.method === 'LEVEL' && M.level >= (r.param | 0)) out.push({ idx: M.idx, from: M.species, to: r.to }); } return out; }
  summary() { return this.sides.map(S => S.party.map(m => ({ idx: m.idx, name: m.name, species: m.species, level: m.level, hp: m.hp, maxhp: m.maxhp, status: m.status, active: S.party[S.active] === m }))); }
}

// ------------------------------------------------------------------------------------------------ make a mon from a species (wild encounters, trainer parties)
function makeMon(env, speciesKey, level, o) {
  o = o || {}; const rng = o.rng || Math.random; const db = env.db || {}; let sp = db[speciesKey];
  if (!sp) { const n = NORM(speciesKey); for (const k of Object.keys(db)) if (NORM(k) === n) { sp = db[k]; speciesKey = k; break; } }
  sp = sp || {}; level = clamp(level | 0 || 5, 1, 100); const R = n => Math.floor(rng() * n);
  const iv = o.ivs || {}; const IV = k => iv[k] != null ? iv[k] : (o.maxIV ? 31 : R(32));
  const nature = o.nature || NATURES[R(25)]; const nm = natureMods(nature); const pn = nature.charAt(0) + nature.slice(1).toLowerCase();
  const I = { HP: IV('HP'), Attack: IV('Attack'), Defense: IV('Defense'), SpAttack: IV('SpAttack'), SpDefense: IV('SpDefense'), Speed: IV('Speed') };
  const maxHP = calcHP(sp.baseHP || 50, I.HP, 0, level);
  const abs = [sp.ability1, sp.ability2].filter(a => a && a !== 'ABILITY_NONE'); const ability = o.ability || (abs.length ? abs[R(abs.length)] : '');
  const gr = sp.genderRatio; const gender = gr == null || gr < 0 ? '' : (R(1000) / 10 < gr ? 'FEMALE' : 'MALE');
  let moves = o.moves; if (!moves && env.learn && env.learn.movesAt) moves = env.learn.movesAt(speciesKey, level);
  const mt = env.moves || {}; const getm = k => { if (mt.get) return mt.get(k); return mt[k]; };
  const mm = (moves || []).slice(-4).map(k => { const m = getm(k); const key = m ? Object.keys(mt).find(x => mt[x] === m) || k : k; const pp = m ? m.pp : 10; return { moveId: key, currentPP: pp, maxPP: pp }; });
  return { species: speciesKey, nickname: o.nickname || '', level, exp: expForLevel(sp.growthRate, level), expmax: expForLevel(sp.growthRate, level + 1), isShiny: o.shiny != null ? o.shiny : R(4096) === 0, gender,
    HP: maxHP, maxHP, Attack: calcStat(sp.baseAttack || 50, I.Attack, 0, level, nm.atk), Def: calcStat(sp.baseDefense || 50, I.Defense, 0, level, nm.def), spattack: calcStat(sp.baseSpAttack || 50, I.SpAttack, 0, level, nm.spa), sdpef: calcStat(sp.baseSpDefense || 50, I.SpDefense, 0, level, nm.spd), speed: calcStat(sp.baseSpeed || 50, I.Speed, 0, level, nm.spe),
    ivHP: I.HP, ivAttack: I.Attack, ivDefense: I.Defense, ivSpAttack: I.SpAttack, ivSpDefense: I.SpDefense, ivSpeed: I.Speed, nature: pn, ability, heldItem: o.item || '', moves: mm, OTName: '', OTID: 0, caughtloc: o.loc || '', ballId: 0 }; }

const BattleEngine = { version: 1, create: o => new Battle(o), Battle, makeMon, expForLevel, calcStat, calcHP, NORM, prettyKey, natureMods, NATURES };
root.BattleEngine = BattleEngine; if (typeof module !== 'undefined' && module.exports) module.exports = BattleEngine;

/* EVENTS the screen plays back (every call returns an array of these, in order):
   msg{text}                         text box line
   usemove{side,move,name,type}      the mon announces a move (play animation start)
   anim{kind,side,...}               attack|status|miss|crit|immune|protect|sub|subhit|subbreak|charge|asleep|par|confused|weather|bounce
   hp{side,from,to,max,heal,hit,idx,bench}  HP bar tween (side 0 = player). `hit` = damage flash
   status{side,status}               psn tox brn par slp frz or null
   confused{side}  stage{side,stat,delta}  stagereset{side}
   weather{type}  terrain{type}  item{side}
   switchin{side,idx,name,species,level,hp,maxhp,status,shiny,gender}   withdraw{side}
   faint{side,idx}
   exp{idx,gain,from,to,level,floor,next,active}   levelup{idx,level,gain,stats,hp,maxhp,active}   learned{idx,move}
   ball{ball,shakes,caught,blocked}
   endturn{}   end{result}           result: win lose ran caught foefled
   After the events: b.pending is null, or {type:'switch',forced?,pivot?} / {type:'learn',mon,move,name} / {type:'end',result}  */
})(typeof window !== 'undefined' ? window : globalThis);
