// tables/PokeballTables.js
//
// Every Poké Ball: its picture (16x48 sheet = 3 frames of 16x16: closed, half open, open), the sparkle sheet and the CFRU catching rule.
// Ported from CFRU's catching.c / pokeball.c.  Look a ball up with  PokeballTables.get(x)  where x is the id (4), the item ("ITEM_MASTER_BALL"),
// or the name ("Master Ball").   PokeballTables[1] etc. also works.
//
//   bonus        the catch multiplier x10 (10 = x1, 15 = x1.5, 20 = x2, 255 = Master Ball)
//   rule         ball with a condition (CFRU GetBaseBallCatchOdds):
//                  net     x3.5 on Water / Bug types              dive   x3.5 when surfing / fishing / underwater
//                  nest    41 - level (levels 1-30)               repeat x3.5 on a species you already caught
//                  timer   10 + 3 per turn (max x4)               quick  x5 on the first turn
//                  dusk    x3 (CFRU: DUSK_BALL_MULTIPLIER) at night / in caves
//                  level   x2 / x4 / x8 the higher your level is  lure   x4 when fishing
//                  moon    x4 on Nidoran / Nido- / Clefairy / Jigglypuff / Skitty / Munna lines
//                  love    x8 same species, opposite gender       heavy  changes the catch RATE by the weight (-20, +20, +30)
//                  fast    x4 on base Speed 100+                  dream  x4 on a sleeping target
//                  beast   x5 on Ultra Beasts, x0.1 on everything else
//   guaranteed   always catches (Master Ball, Park Ball)
//   after        'heal' (Heal Ball: full HP and no status), 'friend' (Friend Ball: friendship 200)
//   Ultra Beasts are very hard to catch with every ball except the Beast Ball (x0.1).
//
// All of this can be changed here: the engine (js/BattleEngine.js) reads bonus / rule / guaranteed / after from this table.
const PokeballTables = {
  1: { id: 1, item: 'ITEM_POKE_BALL', name: 'Poké Ball', type: 'BALL_TYPE_POKE_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_PokeBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10 },
  2: { id: 2, item: 'ITEM_GREAT_BALL', name: 'Great Ball', type: 'BALL_TYPE_GREAT_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_GreatBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 15 },
  3: { id: 3, item: 'ITEM_ULTRA_BALL', name: 'Ultra Ball', type: 'BALL_TYPE_ULTRA_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_UltraBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 20 },
  4: { id: 4, item: 'ITEM_MASTER_BALL', name: 'Master Ball', type: 'BALL_TYPE_MASTER_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_MasterBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 255, guaranteed: true },
  5: { id: 5, item: 'ITEM_SAFARI_BALL', name: 'Safari Ball', type: 'BALL_TYPE_SAFARI_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_SafariBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 15 },
  6: { id: 6, item: 'ITEM_NET_BALL', name: 'Net Ball', type: 'BALL_TYPE_NET_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_NetBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'net' },
  7: { id: 7, item: 'ITEM_DIVE_BALL', name: 'Dive Ball', type: 'BALL_TYPE_DIVE_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_DiveBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'dive' },
  8: { id: 8, item: 'ITEM_NEST_BALL', name: 'Nest Ball', type: 'BALL_TYPE_NEST_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_NestBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'nest' },
  9: { id: 9, item: 'ITEM_REPEAT_BALL', name: 'Repeat Ball', type: 'BALL_TYPE_REPEAT_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_RepeatBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'repeat' },
  10: { id: 10, item: 'ITEM_TIMER_BALL', name: 'Timer Ball', type: 'BALL_TYPE_TIMER_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_TimerBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'timer' },
  11: { id: 11, item: 'ITEM_LUXURY_BALL', name: 'Luxury Ball', type: 'BALL_TYPE_LUXURY_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_LuxuryBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10 },
  12: { id: 12, item: 'ITEM_PREMIER_BALL', name: 'Premier Ball', type: 'BALL_TYPE_PREMIER_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_PremierBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10 },
  13: { id: 13, item: 'ITEM_CHERISH_BALL', name: 'Cherish Ball', type: 'BALL_TYPE_CHERISH_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_CherishBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10 },
  14: { id: 14, item: 'ITEM_DUSK_BALL', name: 'Dusk Ball', type: 'BALL_TYPE_DUSK_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_DuskBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'dusk' },
  15: { id: 15, item: 'ITEM_HEAL_BALL', name: 'Heal Ball', type: 'BALL_TYPE_HEAL_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_HealBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, after: 'heal' },
  16: { id: 16, item: 'ITEM_QUICK_BALL', name: 'Quick Ball', type: 'BALL_TYPE_QUICK_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_QuickBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'quick' },
  17: { id: 17, item: 'ITEM_FAST_BALL', name: 'Fast Ball', type: 'BALL_TYPE_FAST_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_FastBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'fast' },
  18: { id: 18, item: 'ITEM_LEVEL_BALL', name: 'Level Ball', type: 'BALL_TYPE_LEVEL_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_LevelBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'level' },
  19: { id: 19, item: 'ITEM_LURE_BALL', name: 'Lure Ball', type: 'BALL_TYPE_LURE_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_LureBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'lure' },
  20: { id: 20, item: 'ITEM_HEAVY_BALL', name: 'Heavy Ball', type: 'BALL_TYPE_HEAVY_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_HeavyBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'heavy' },
  21: { id: 21, item: 'ITEM_LOVE_BALL', name: 'Love Ball', type: 'BALL_TYPE_LOVE_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_LoveBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'love' },
  22: { id: 22, item: 'ITEM_FRIEND_BALL', name: 'Friend Ball', type: 'BALL_TYPE_FRIEND_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_FriendBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, after: 'friend' },
  23: { id: 23, item: 'ITEM_MOON_BALL', name: 'Moon Ball', type: 'BALL_TYPE_MOON_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_MoonBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'moon' },
  24: { id: 24, item: 'ITEM_SPORT_BALL', name: 'Sport Ball', type: 'BALL_TYPE_SPORT_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_SportBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 15 },
  25: { id: 25, item: 'ITEM_BEAST_BALL', name: 'Beast Ball', type: 'BALL_TYPE_BEAST_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_BeastBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'beast' },
  26: { id: 26, item: 'ITEM_DREAM_BALL', name: 'Dream Ball', type: 'BALL_TYPE_DREAM_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_DreamBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, rule: 'dream' },
  27: { id: 27, item: 'ITEM_PARK_BALL', name: 'Park Ball', type: 'BALL_TYPE_PARK_BALL', spriteSheet: 'graphics/poke_ball/gInterfaceGfx_ParkBall.png', frameWidth: 16, frameHeight: 16, particleSheet: 'graphics/poke_ball/gPokeBallEffects.png', particleFrameSize: 8, animEffect: 'sparkle_burst', bonus: 10, guaranteed: true },
};
// lookup by id, item or name (not listed when you loop over the table)
Object.defineProperty(PokeballTables, 'get', { enumerable: false, value: function (k) {
  if (k == null || k === '') return PokeballTables[1];
  if (PokeballTables[k]) return PokeballTables[k];
  const n = String(k).toUpperCase().replace(/^ITEM_/, '').replace(/[^A-Z0-9]/g, '');
  for (const id of Object.keys(PokeballTables)) { const b = PokeballTables[id]; if (String(b.item).replace(/^ITEM_/, '').replace(/[^A-Z0-9]/g, '') === n || String(b.name).toUpperCase().replace(/[^A-Z0-9]/g, '') === n) return b; }
  return null;
} });
if (typeof window !== 'undefined') window.PokeballTables = PokeballTables;
