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
walk_right
walk_up
walk_up
walk_up
walk_up
walk_up
walk_in_place_left
}
hideobject NPC_2
applymovement player
{
emote_question
look_left
}
setvar 8000 1
end

start: "var_8000_1"
applymovement player
{
emote_question
}
msgbox.normal
{
{red}Mom{/}: Don't go down yet, honey!\p
I'm still trying to clean the mess\n
here.
}
applymovement player
{
walk_right
}
end

start: "bag_start"
applymovement player
{
emote_question
}
wait 400
applymovement NPC_1
{
jump_in_place
}
shakecamera
applymovement player
{
emote_exclaim
}
wait 300
applymovement NPC_1
{
jump_in_place
}
flashscreen
shakecamera
applymovement NPC_1
{
jump_in_place
}
flashscreen
wait 600
showobject NPC_2
applymovement player yes
{
look_right
}
applymovement NPC_2 yes
{
emote_exclaim
run_down
run_down
run_down
run_down
run_down
run_left
run_left
run_left
run_left
run_left
run_left
run_up
look_left
}
waitmovement
msgbox.normal
{
{red}Mom{/}: $player! I heard a loud bang\n
up here, are you alright?!
}
msgbox.normal
{
Oh my goodness... that thing is\n
shaking AGAIN?!\p
Honey, step away from it, right\n
now!
}
msgbox.normal
{
I've spent all morning sweeping up\n
that kitchen, and now this!\p
The whole house is rattling like a\n
pot lid!
}
msgbox.normal
{
That {orange}bag{/} has to get to Professor\n
Beckett right now, before it brings\p
the whole house down on our heads!
}
msgbox.normal
{
Oh, and your best friend {cyan}Wilhelm{/}\n
is taking {pink}Hazel{/} to {yellow}Olenburg City{/}.\p
She'll get her very first Pokémon\n
from the gym leader there!
}
msgbox.normal
{
You tag along with them, okay?\n
I won't take no for an answer.\p
It is NOT safe to go through\n
{green}Route 1{/} without a Pokémon!
}
msgbox.normal
{
Now pick that {orange}bag{/} up, and don't\n
you dare drop it.\p
I'll pack some food for the road.\p
$player... be safe, my brave little\n
aide. I love you.
}
applymovement NPC_2
{
walk_down
walk_right
walk_right
walk_right
walk_right
}
hideobject NPC_2
applymovement player
{
look_last_facing
delay_400
walk_in_place_last_facing
}
flashscreen
hideobject NPC_1
wait 500
applymovement player
{
emote_exclaim
delay_300
look_last_facing
emote_question
}
setvar 8000 2
end

start: "mom_house"
faceplayer
msgbox.normal
{
{red}Mom{/}: Oh, $player! You're all set?\p
Good luck on your journey, sweetie.\n
I'm so proud of you.
}
msgbox.normal
{
And please, bring that {orange}bag{/} to\n
Professor Beckett immediately!\p
I won't sleep a wink until that\n
thing is out of this house.
}
msgbox.normal
{
Now off you go, and call me when you\n
get to Olenburg City, okay?
}
end

start: "town_science_fan"
faceplayer
msgbox.normal
{
Science is simply AMAZING!\p
Did you know a Poké Ball turns a\n
Pokémon into pure energy and stores\p
it inside a tiny capsule?\n
Incredible!
}
msgbox.normal
{
Professor {yellow}Beckett{/} in Olenburg City\n
studies all of it. He's a genius!\p
One day I'll work in his lab. I'll\n
bring snacks and lots of notebooks!
}
end

start: "town_beauty"
faceplayer
msgbox.normal
{
Oh! Do you like my hair?\p
I use a special Pokémon-friendly\n
shampoo. Even my {pink}Pokémon{/} glows!
}
end

start: "town_lass"
faceplayer
msgbox.normal
{
Did you hear about {pink}Hazel{/}?\p
She'll get her first Pokémon from\n
the gym leader in {yellow}Olenburg City{/}!\p
So jealous!
}
msgbox.normal
{
And {cyan}Wilhelm{/} is escorting her there.\p
The two of them are always\n
together. Hehe, don't you think so?
}
end

start: "town_youngster"
faceplayer
msgbox.normal
{
I'm going to be the strongest\n
trainer in the world!\p
Just you wait and see!
}
msgbox.normal
{
...As soon as Mom lets me past\n
{green}Route 1{/}.\p
She says it's too dangerous without\n
a Pokémon. Ugh, so unfair!
}
end

start: "town_old_man"
faceplayer
msgbox.normal
{
Ahh, {yellow}Criscanto Town{/}... Seventy\n
years here, so few changes.\p
The cold winds, the quiet mornings,\n
the smell of fresh bread...\p
Not a bad place to call home.
}
msgbox.normal
{
Take my advice, young one.\p
Explore the world, but never forget\n
where you came from.
}
end

start: "town_old_couple_man"
faceplayer
msgbox.normal
{
My wife makes the best berry tea in\n
all of {yellow}Criscanto{/}.\p
Forty years of marriage, and I\n
still can't get enough of it!
}
msgbox.normal
{
Don't tell her I said that. She'll\n
get a big head about it.
}
end

start: "town_old_couple_woman"
faceplayer
msgbox.normal
{
Oh, hello dear! Did that old fool\n
tell you about my tea?\p
He says it every day. Every.\n
Single. Day.
}
msgbox.normal
{
Here's a secret: the true recipe is\n
a pinch of love.\p
And one extra spoon of honey,\n
because he likes it sweet.
}
end

start: "criscanto_town"
msgbox.normal
{
{red}Criscanto Town{/}\p
A quiet town in the heart of the\n
forest, where every journey begins.
}
end

start: "ralts_script"
lock
faceplayer
cry npc yes
msgbox.normal
{
Nyaaahhh...
}
release
end

start: "8000_2"
lock
hideobject Trainer_1
hideobject Trainer_2
hideobject Trainer_3
applymovement NPC_4 yes
{
look_up
emote_exclaim
}
applymovement NPC_5 yes
{
emote_exclaim
}
waitmovement
msgbox.normal
{
{blue}Wilhelm{/}: Looks like someone finally\n
decided to wake up! We were\n
starting to think you got eaten by\n
a Slakoth.
}
getpos 4000 4001
goto_if_eq 4000 11 row_11
goto_if_eq 4000 12 row_12
goto_if_eq 4000 13 row_13
goto after_row
label row_11
applymovement player
{
walk_down
walk_right
look_down
}
goto after_row
label row_12
applymovement player
{
walk_down
}
goto after_row
label row_13
applymovement player
{
walk_down
walk_left
look_down
}
label after_row
applymovement NPC_4
{
look_down
}
msgbox.normal
{
Since you're joining us on Route 1,\n
pay close attention.\p
I've had my Pokémon for months, so\n
I know these roads inside and out.
}
msgbox.normal
{
First rule of wild Pokémon: tall\n
grass is their playground.\p
If you step in without a team,\n
you're just asking for trouble!
}
applymovement NPC_5
{
emote_question
}
msgbox.normal
{
Isn't that right, {red}Hazel{/}? Experience\n
speaks for itself.
}
msgbox.normal
{
{red}Hazel{/}: Experience?\p
You caught one Rockruff last month\n
and haven't stopped talking about\n
it since!
}
applymovement NPC_4
{
look_up
}
msgbox.normal
{
But... he's actually right for\n
once.\p
Walking in tall grass without a\n
Pokémon is a terrible idea.
}
applymovement NPC_5 yes
{
emote_exclaim
}
waitmovement
msgbox.normal
{
{blue}Wilhelm{/}: See? I told you! Now,\n
let's keep moving.
}
applymovement NPC_5 yes
{
walk_down*4
}
applymovement NPC_4 yes
{
walk_down*4
}
applymovement player yes
{
walk_down*4
}
waitmovement
applymovement NPC_5
{
emote_exclaim
}
msgbox.normal
{
{big}{blue}WAIT!
}
applymovement NPC_5
{
look_up
}
msgbox.normal
{
{blue}Wilhelm{/}: Hold up a second! Look\n
over there in the grass.
}
applymovement NPC_5
{
look_down
}
movecamera 0 6
msgbox.normal
{
{blue}Wilhelm{/}: See those wild Pokémon\n
roaming around out in the open?\p
You can actually spot them before\n
they even spot you.
}
resetcamera
applymovement NPC_5
{
look_up
}
msgbox.normal
{
{blue}Wilhelm{/}: Honestly, I'm surprised a\n
Professor's Aide like you didn't\n
know that already.
}
msgbox.normal
{
Then again, fetching bags and\n
running errands doesn't really take\n
much battle brain, does it?
}
applymovement NPC_4
{
walk_in_place_down
}
msgbox.normal
{
{red}Hazel{/}: Wilhelm! Don't be so rude!\n
Being an Aide is a huge\n
responsibility!
}
applymovement NPC_4
{
look_up
}
msgbox.normal
{
Though... observing how wild\n
Pokémon move before approaching\n
them is pretty solid advice.
}
msgbox.normal
{
Just ignore his big mouth. He's\n
just flexing because he has a Poké\n
Ball on his belt.
}
applymovement NPC_4
{
look_down
}
msgbox.normal
{
If I had a choice, I'd skip all\n
these local Pokémon and start my\n
journey with a Mew!
}
msgbox.normal
{
Cute, powerful, and mysterious...\p
Mew is literally the ultimate\n
Pokémon!
}
msgbox.normal
{
{blue}Wilhelm{/}: Dream on, Hazel! Mew is a\n
Mythical Pokémon.\p
You can't just find one hanging out\n
in Route 1 grass!
}
applymovement NPC_5 yes
{
walk_down*5
emote_exclaim
}
applymovement NPC_4 yes
{
walk_down*5
emote_exclaim
}
applymovement player yes
{
walk_down*5
}
waitmovement
applymovement NPC_5
{
look_up
}
msgbox.normal
{
{blue}Wilhelm{/}: Okay, one more tip before\n
we get to the city.\p
Pay attention to the Trainers\n
standing around out here.
}
msgbox.normal
{
The second you walk into their line\n
of sight, they'll spot you and rush\n
right over.\p
Once they've seen you, there's no\n
running away!
}
msgbox.normal
{
So if you don't feel like battling,\n
stay out of their sight.\p
And if you do, make sure your team\n
is ready first.
}
applymovement NPC_4
{
look_up
}
msgbox.normal
{
{red}Hazel{/}: Ugh, I hate to say it, but\n
he's right again.\p
Trainers on the road never take no\n
for an answer.
}
msgbox.normal
{
Not that it matters for us yet,\n
since we don't have a Pokémon.\p
But it's good to know before we get\n
one!
}
applymovement NPC_4
{
look_down
}
msgbox.normal
{
{blue}Wilhelm{/}: Hear that? Even Hazel\n
agrees with me. Mark the date!
}
applymovement NPC_4
{
walk_in_place_down
}
msgbox.normal
{
{red}Hazel{/}: Don't push it, Wilhelm.
}
applymovement NPC_5 yes
{
walk_down*6
emote_exclaim
}
applymovement NPC_4 yes
{
walk_down*6
emote_exclaim
}
applymovement player yes
{
walk_down*6
}
waitmovement
applymovement NPC_5
{
look_up
}
msgbox.normal
{
{blue}Wilhelm{/}: Okay, last tip before we\n
reach the city.\p
This one will save your life, so\n
listen up.
}
msgbox.normal
{
Every Pokémon has a type, and some\n
types are strong against others.
}
msgbox.normal
{
{blue}Water{/} beats {orange}Fire{/}. {orange}Fire{/} beats {green}Grass{/}.\n
{green}Grass{/} beats {blue}Water{/}.\p
Hit a Pokémon with a move it's weak\n
to and it takes double damage!
}
msgbox.normal
{
It works the other way too. Use a\n
move the target resists and you'll\n
barely scratch it.
}
applymovement NPC_5
{
emote_question
}
msgbox.normal
{
Right, Hazel? Go on, tell them I'm\n
not making this up.
}
applymovement NPC_4
{
walk_in_place_down
}
msgbox.normal
{
{red}Hazel{/}: Ugh... fine. He's right.\n
Type advantage can decide a whole\n
battle.
}
applymovement NPC_4
{
look_up
}
msgbox.normal
{
Even a Pokémon with a lower level\n
can win if it has the advantage.\p
Check the types before you pick a\n
move!
}
msgbox.normal
{
{blue}Wilhelm{/}: Ha! Two for two. Hazel\n
agrees with me again!
}
applymovement NPC_4
{
look_down
}
msgbox.normal
{
{red}Hazel{/}: Don't get used to it. Come\n
on, the city is right there.
}
applymovement NPC_5 yes
{
walk_down*9
emote_exclaim
}
applymovement NPC_4 yes
{
walk_down*9
emote_exclaim
}
applymovement player yes
{
walk_down*9
}
waitmovement
applymovement NPC_4 yes
{
look_up
}
applymovement NPC_5 yes
{
look_up
}
waitmovement
msgbox.normal
{
{blue}Wilhelm{/}: Anyway, enough dreaming.\n
Olenburg City is right ahead.
}
msgbox.normal
{
Well, here we are! Olenburg City,\n
right at the end of Route 1.
}
msgbox.normal
{
{blue}Wilhelm{/}: This is where we part ways\n
for now.
}
msgbox.normal
{
{red}Hazel{/}: I'm heading to the south\n
side of the city to meet Aster. I\n
can't wait to finally get my very\n
first Pokémon!
}
msgbox.normal
{
{red}Hazel{/}: Maybe one day Aster will\n
help me track down Mew... imagine\n
how amazing that would be!
}
msgbox.normal
{
{blue}Wilhelm{/}: Yeah, yeah, good luck with\n
that. I'm heading west to push\n
forward on my journey. \p
There are way bigger challenges\n
waiting for me out there!
}
msgbox.normal
{
{blue}Wilhelm{/}: As for you, the Pokémon\n
Lab is right by the city entrance.\p
You can't miss it.
}
msgbox.normal
{
{red}Hazel{/}: Good luck with Professor\n
Beckett, and make sure you deliver\n
that bag safely!\p
See you both later!
}
applymovement NPC_5 yes
{
walk_down*6
}
applymovement NPC_4 yes
{
walk_down*6
}
waitmovement
hideobject NPC_4
hideobject NPC_5
setvar 8000 3
release
end
`;
