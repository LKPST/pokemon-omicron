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

start: "start_script"
hideobject NPC_2
end

start: "mom_arrives_in_room"
wait 507
applymovement player yes
{
walk_right
}
movecamera 4 0
movecamera 0 -2
waitmovement
showobject NPC_2
applymovement NPC_2 yes
{
walk_in_place_right
emote_exclaim
walk_down
walk_down
walk_down
walk_down
walk_down
walk_left
walk_left
walk_left
walk_left
walk_left
walk_left
walk_up
look_left
}
resetcamera sync=yes
waitmovement
msgbox.normal
{
{yellow}$player{/}! Oh, thank goodness, you're\n
awake!\p
I could hear you tossing and\n
turning from the hallway.
}
applymovement player
{
emote_sweat
}
msgbox.normal
{
Look at you, you're all pale and\n
sweaty, sweetie.\p
Was it another bad dream?
}
shakecamera
applymovement NPC_2 yes
{
emote_exclaim
look_right
}
applymovement PLAYER yes
{
emote_exclaim
}
waitmovement
wait 500
applymovement NPC_2 yes
{
look_left
}
waitmovement
msgbox.normal
{
...Hm? Did you hear that?\p
Something clattered downstairs just\n
now.\p
I thought it was only the wind, but\n
that sounded like {red}something\p
knocking things over{/}.
}
applymovement NPC_2
{
walk_in_place_left
}
msgbox.normal
{
And what's that next to your bed?\p
I don't remember seeing that {orange}bag{/} in\n
here before.
}
applymovement NPC_1
{
jump_in_place
}
shakecamera
applymovement NPC_2 yes
{
emote_exclaim
}
applymovement player
{
emote_exclaim
look_left
}
waitmovement
msgbox.normal
{
Wait... did that {orange}bag{/} just MOVE?!\p
$player, did you see that?!
}
applymovement player
{
look_right
}
msgbox.normal
{
Well, goodness me! Today of all\n
days!\p
Your very first day as Professor\n
Beckett's aide in Olenburg City,\p
and you wake up to a mystery.\p
You have the strangest timing, you\n
know that?
}
msgbox.normal
{
Tell you what, you take a good look\n
at that {orange}bag{/} while I go downstairs.\p
I'll find out what that noise was\n
and get {yellow}something to eat{/} ready.\p
You are not leaving on an empty\n
stomach, not on my watch!
}
msgbox.normal
{
And $player... be careful, alright?\p
I'm {pink}so proud{/} of you.
}
applymovement NPC_2
{
walk_down
walk_right
walk_right
walk_right
walk_right
walk_right
walk_right
walk_up
walk_up
walk_up
walk_up
walk_up
walk_left
}
hideobject NPC_2
applymovement player
{
emote_question
look_left
}
setvar 8000 1
end
`;
