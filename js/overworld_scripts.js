// ===========================================================================
// overworld_scripts.js  -  YOUR SCRIPTS  (xSE style)
//
// Write scripts here, or use the Scripts editor in the map editor (it saves this file).
// Put the script name in an event's `script` field. Every command is explained in
// overworld_script_commands.js and in the editor.
//
//   start: "name"         begins a script       end   stops it (a script can have several)
//   msgbox.normal { ... } a message: \n = new line, \p = new paragraph, $player = player name
//   applymovement npc { walk_down*2 look_left }     targets: player, npc, or an event name (NPC_Portia)
//   # a comment
//
// Do not use the ` character or ${ inside a script (this file is a JavaScript template string).
// ===========================================================================

window.OverworldScriptSource = String.raw`
start: "portia_battle_trigger"
lock
faceplayer
msgbox.normal
{
Portia: I've been expecting you\n
here.\p
Come back if you have enough\n
Pokemon to battle me.
}
release
end

start: "lily_gift_trigger"
lock
faceplayer
goto_if_set FLAG_GOT_LILY_GIFT already_given
msgbox.normal
{
Lily: I want you to have\n
this Pokémon!
}
givepokemon SPECIES_EELEKTROSS_M 15 Lance NATURE_MODEST
setflag FLAG_GOT_LILY_GIFT
msgbox.normal
{
Lily: Take good care of it!
}
release
end
label already_given
msgbox.normal
{
Lily: How is your new partner,\n
$player?
}
release
end

start: "roxanne_gym_leader"
lock
faceplayer
goto_if_set FLAG_DEFEATED_ROXANNE roxanne_after
msgbox.normal
{
Portia: Hey, do you wanna test my\n
Rock-hard Pokemon?\p
I won't back down!
}
setflag FLAG_DEFEATED_ROXANNE
release
trainerbattle TRAINER_ROXANNE single
end
label roxanne_after
msgbox.normal
{
Portia: Why are you so mean to me?
}
release
end

start: "example_cutscene"
# A small cutscene example: the NPC walks up to the player, the camera pans, the player answers yes/no.
lock
faceplayer
msgbox.normal
{
Hi $player, isn't Criscanto\n
the best town ever?\p
Let me show you something!
}
applymovement npc
{
walk_up
walk_right*2
look_down
}
movecamera 0 -3 900
wait 400
resetcamera 700
msgbox.yesno
{
Isn't it beautiful?
}
goto_if_yes yes
msgbox.normal
{
Oh... Maybe next time!
}
release
end
label yes
msgbox.normal
{
I knew you'd say that!
}
release
end

start: "new_script"
lock
faceplayer
msgbox.normal
{
Hello, $player! Take this Sprigatito\n
with you.
}
givepokemon SPECIES_SPRIGATITO 20 Flora moves=MOVE_LEAFAGE
release
end

start: "giveitem"
lock
faceplayer
msgbox.normal
{
Hello, $player!\p
I want you to take this item\n
please.
}
giveitem ITEM_POKEBALL 5
release
end
`;
