# pokemon-omicron

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/LKPST/pokemon-omicron)

okay requests:

1. When electing rectangle to the tiles in the actual map, I want it to be copied and Ihould be able to pencil the entire rectangle election. Do you get it?
2. Right now, tiles.js isPassable dictates the passability of the tile.. I want it to be dictated in the Tiledata_: in overworld_map instead... it would now be "TileID | FrameID | Passability" WHERE: 0 means Passable, 1 means not passable, 2 means passable but the overworld NPC is below it, 3 means Surfable, 4 means Diveable so overworldscene, tiles.jh, overworld_map needs to be updated.. map editor will be updated as well to allow me to add passable behaviours to the tile.. similar
3. If in Tiles.jh, isAnimated is true, it will be animated based on the frames of the same row.
4. I need more movements, please create more
5. Move player when idle.. so if the screen is not being played or somethng, try making the player move IN PLACE based on the frames
