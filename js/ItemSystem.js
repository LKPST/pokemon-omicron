// ===========================================================================
// js/ItemSystem.js     the player's bag and the item PC, plus what items DO outside of battle
//
// Load after tables/ItemTables.js (and before overworld_script_commands.js is used - order does not matter, it is read when a command runs).
//
// SAVE   GameStateManager.saveData.bag      { ITEM_POTION: 3, ITEM_POKE_BALL: 10 }     the bag
//        GameStateManager.saveData.pcItems  { ITEM_POTION: 12 }                         the item storage of the PC
//        (an old bag saved as a list [{item,count}] is converted the first time it is touched; BattleScene reads the same bag)
//
// API    ItemSystem.add('ITEM_POTION', 3)              -> how many were added (0 when the stack is full / unknown item)
//        ItemSystem.remove('potion', 1)                -> true / false (false: not enough, nothing is removed)
//        ItemSystem.count('potion')  ItemSystem.has('potion', 2)
//        ItemSystem.add(id, n, 'pc')  ItemSystem.remove(id, n, 'pc')  ItemSystem.count(id, 'pc')   same for the PC
//        ItemSystem.list('bag', 'berries') -> [{key, count, item}]   (pocket: items | balls | tms | berries | key | undefined = all)
//        ItemSystem.key('Potion') -> 'ITEM_POTION'   (any spelling; null when ItemTable does not know it)
//        ItemSystem.info('ITEM_POTION') -> the ItemTable entry
//        ItemSystem.useInfo(key) -> {kind, usable, why}     ItemSystem.useOnMon(key, mon, opts) -> {ok, msg, used}
//        ItemSystem.giveHeld(mon, key) -> the item that was held before (or null)
// ===========================================================================
(function (root) {
'use strict';
const SAVE_KEY = 'pokemon_micron_save', MAX = 999;
const sv = () => (root.GameStateManager && root.GameStateManager.saveData) || null;
const table = () => (typeof ItemTable !== 'undefined' ? ItemTable : root.ItemTable) || null;
function save() { if (root.SaveSystem) root.SaveSystem.touch(); }   // no autosave: SAVE in the start menu writes the file

function key(id) {
  const t = table(); if (id == null || id === '') return null;
  if (typeof id === 'number') { if (t) for (const k in t) if (t[k].id === id) return k; return null; }
  const s = String(id).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!t) return s.startsWith('ITEM_') ? s : 'ITEM_' + s;
  if (t[s]) return s; if (t['ITEM_' + s]) return 'ITEM_' + s;
  const n = s.replace(/_/g, '');   // POKEBALL / MASTERBALL ...
  for (const k in t) if (k.replace(/_/g, '') === n || k.replace(/_/g, '') === 'ITEM' + n) return k;
  return null;
}
const info = k => { const t = table(); return t && k ? t[k] || null : null; };
const prettyKey = k => String(k).replace(/^ITEM_/, '').toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const nameOf = k => { const i = info(k); const n = i && i.name ? i.name : prettyKey(k); return n.replace(/^Pok[eé]/, 'Poké'); };

function store(where) {
  const s = sv(); if (!s) return null; const f = where === 'pc' ? 'pcItems' : 'bag';
  let b = s[f];
  if (Array.isArray(b)) { const o = {}; for (const e of b) { if (!e) continue; const k = key(e.item || e.id || e.key || e.name), c = e.count != null ? e.count : (e.qty != null ? e.qty : (e.quantity != null ? e.quantity : 1)); if (k && c > 0) o[k] = (o[k] || 0) + c; } b = s[f] = o; }
  if (!b || typeof b !== 'object') b = s[f] = {};
  for (const k of Object.keys(b)) { const v = b[k]; if (v && typeof v === 'object') b[k] = v.count || v.qty || v.quantity || 0; }   // {count: 3} -> 3
  return b;
}
function count(id, where) { const k = key(id), b = store(where); return k && b ? (+b[k] || 0) : 0; }
const has = (id, n, where) => count(id, where) >= (n == null ? 1 : n);
function add(id, n, where) {
  const k = key(id), b = store(where); n = Math.floor(n == null ? 1 : n); if (!k || !b || n <= 0) return 0;
  const cur = +b[k] || 0, put = Math.max(0, Math.min(n, MAX - cur)); if (!put) return 0;
  b[k] = cur + put; save(); return put;
}
function remove(id, n, where) {
  const k = key(id), b = store(where); n = Math.floor(n == null ? 1 : n); if (!k || !b || n <= 0) return false;
  const cur = +b[k] || 0; if (cur < n) return false;
  if (cur === n) delete b[k]; else b[k] = cur - n; save(); return true;
}
function list(where, pocket) {
  const b = store(where) || {}, out = [];
  for (const k of Object.keys(b)) { const c = +b[k]; if (!(c > 0)) continue; const it = info(k); if (pocket && (!it || it.pocket !== pocket)) continue; out.push({ key: k, count: c, item: it }); }
  out.sort((x, y) => ((x.item ? x.item.id : 1e9) - (y.item ? y.item.id : 1e9)));
  return out;
}

// ---------------------------------------------------------------- what an item does
const CURES = {
  ITEM_ANTIDOTE: ['psn', 'tox'], ITEM_BURN_HEAL: ['brn'], ITEM_ICE_HEAL: ['frz'], ITEM_AWAKENING: ['slp'], ITEM_PARALYZE_HEAL: ['par'],
  ITEM_CHERI_BERRY: ['par'], ITEM_CHESTO_BERRY: ['slp'], ITEM_PECHA_BERRY: ['psn', 'tox'], ITEM_RAWST_BERRY: ['brn'], ITEM_ASPEAR_BERRY: ['frz'],
};
const ALL_STATUS = ['psn', 'tox', 'par', 'slp', 'brn', 'frz'];
const FULL_CURE = new Set(['ITEM_FULL_HEAL', 'ITEM_LUM_BERRY', 'ITEM_HEAL_POWDER', 'ITEM_LAVA_COOKIE', 'ITEM_RAGE_CANDY_BAR', 'ITEM_OLD_GATEAU', 'ITEM_CASTELIACONE', 'ITEM_LUMIOSE_GALETTE', 'ITEM_SHALOUR_SABLE', 'ITEM_BIG_MALASADA', 'ITEM_FULL_RESTORE']);
const HP_ITEMS = new Set(['ITEM_POTION', 'ITEM_SUPER_POTION', 'ITEM_HYPER_POTION', 'ITEM_MAX_POTION', 'ITEM_FULL_RESTORE', 'ITEM_FRESH_WATER', 'ITEM_SODA_POP', 'ITEM_LEMONADE', 'ITEM_MOOMOO_MILK', 'ITEM_BERRY_JUICE', 'ITEM_ORAN_BERRY', 'ITEM_SITRUS_BERRY', 'ITEM_ENERGY_POWDER', 'ITEM_ENERGY_ROOT']);
const HERB_HP = { ITEM_ENERGY_POWDER: 50, ITEM_ENERGY_ROOT: 200 };
const REVIVE = { ITEM_REVIVE: .5, ITEM_MAX_REVIVE: 1, ITEM_REVIVAL_HERB: 1 };
const PP_ONE = new Set(['ITEM_ETHER', 'ITEM_MAX_ETHER', 'ITEM_LEPPA_BERRY']), PP_ALL = new Set(['ITEM_ELIXIR', 'ITEM_MAX_ELIXIR']);

// kind: hp | status | revive | pp1 | ppall | none      (what the bag does with it: "none" = "can't be used here yet")
function useInfo(k) {
  const it = info(k); if (!it) return { kind: 'none', usable: false, why: '' };
  if (it.pocket === 'key') return { kind: 'none', usable: false, why: "This can't be used here yet." };
  if (REVIVE[k]) return { kind: 'revive', usable: true };
  if (PP_ONE.has(k)) return { kind: 'pp1', usable: true };
  if (PP_ALL.has(k)) return { kind: 'ppall', usable: true };
  if (HP_ITEMS.has(k)) return { kind: 'hp', usable: true };
  if (CURES[k] || FULL_CURE.has(k)) return { kind: 'status', usable: true };
  return { kind: 'none', usable: false, why: "This can't be used here yet." };
}
const canHold = k => { const it = info(k); return !!it && it.pocket !== 'key'; };
const NOPE = { ok: false, msg: "It won't have any effect." };
function useOnMon(k, mon, o) {
  o = o || {}; const u = useInfo(k), it = info(k), nm = (mon.nickname || prettyKey(mon.species || '')).slice(0, 12);
  if (!u.usable || !mon) return { ok: false, msg: u.why || NOPE.msg };
  const hp = +mon.HP, mx = +mon.maxHP;
  if (u.kind === 'revive') {
    if (hp > 0) return NOPE; mon.HP = Math.max(1, Math.floor(mx * REVIVE[k])); mon.status = null;
    return { ok: true, used: true, msg: nm + ' was revived!' };
  }
  if (u.kind === 'hp') {
    const cure = k === 'ITEM_FULL_RESTORE', st = mon.status;
    if (hp <= 0) return NOPE;
    if (hp >= mx && !(cure && st)) return NOPE;
    let amt = HERB_HP[k] || +it.holdEffectParam || 20; if (amt >= 255) amt = mx;
    const before = mon.HP; mon.HP = Math.min(mx, hp + amt); if (cure) mon.status = null;
    return { ok: true, used: true, msg: nm + (mon.HP >= mx && !cure ? ' was fully healed!' : ' recovered ' + (mon.HP - before) + ' HP.') };
  }
  if (u.kind === 'status') {
    if (hp <= 0) return NOPE; const st = mon.status; if (!st) return NOPE;
    const list = FULL_CURE.has(k) ? ALL_STATUS : CURES[k] || []; if (list.indexOf(st) < 0) return NOPE;
    mon.status = null; return { ok: true, used: true, msg: nm + ' was cured.' };
  }
  if (u.kind === 'pp1' || u.kind === 'ppall') {
    const mv = (mon.moves || []).filter(m => m && m.maxPP != null), amt = +it.holdEffectParam >= 255 ? 999 : (+it.holdEffectParam || 10);
    const targets = u.kind === 'pp1' ? (o.moveIndex != null && mon.moves[o.moveIndex] ? [mon.moves[o.moveIndex]] : []) : mv;
    let did = false; for (const m of targets) { if (m && m.currentPP < m.maxPP) { m.currentPP = Math.min(m.maxPP, m.currentPP + amt); did = true; } }
    return did ? { ok: true, used: true, msg: u.kind === 'pp1' ? 'PP was restored.' : nm + "'s PP was restored." } : NOPE;
  }
  return NOPE;
}
function giveHeld(mon, k) { const old = mon.heldItem || null; mon.heldItem = k || null; save(); return old; }

root.ItemSystem = { key, info, name: nameOf, prettyKey, add, remove, count, has, list, store, save, useInfo, useOnMon, canHold, giveHeld, MAX };

// ---------------------------------------------------------------- script commands (giveitem, additemtopc, removeitem, removeitemfrompc, checkitem ...)
// They are registered into window.OverworldScriptCommands by overworld_script_commands.js (which calls ItemSystem). Nothing to do here.
})(window);
