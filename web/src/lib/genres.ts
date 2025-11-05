export const GENRES: string[] = [
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Historical Fiction",
  "Horror",
  "Literary Fiction",
  "Young Adult",
  "Adventure",
  "Dystopian",
  "Magical Realism",
  "Crime",
  "Contemporary",
  "Paranormal",
  "Urban Fantasy",
  "Steampunk",
  "Cyberpunk",
  "Space Opera",
  "Post-Apocalyptic",
  "Time Travel",
  "Alternate History",
  "Mythology & Folklore",
  "Western",
  "Humor/Satire",
  "Other / Custom",
];

const SEEDS: Record<string, string[]> = {
  Fantasy: [
    "At dawn, the rune on the gate pulsed for the first time in a century.",
    "The map ink refused to dry, writhing toward a place no one named.",
    "A courier staggers into town carrying a crown that chooses its wearer.",
  ],
  "Science Fiction": [
    "The station’s night cycle failed, revealing stars no chart recognized.",
    "A maintenance drone began writing poetry on the hull.",
    "Your jump log shows an arrival time that predates your departure.",
  ],
  Mystery: [
    "The clock tower chimed thirteen; everyone swore it never had.",
    "A letter arrives—postmarked tomorrow—containing your fingerprints.",
    "The museum’s emptiest display case just set off the alarm.",
  ],
  Thriller: [
    "Your phone vibrates: a live feed from your own living room.",
    "A red dot dances across the train window and settles on you.",
    "Six minutes left until the auction ends and your alias expires.",
  ],
  Romance: [
    "The storm canceled everything—except the smile at gate C7.",
    "A misdelivered bouquet carries your exact favorite flowers.",
    "Two rival bakers tie for first, then share a kitchen for a week.",
  ],
  "Historical Fiction": [
    "News from the front arrives with a coded sketch of the city.",
    "A forbidden book survives the fire, smelling of salt and smoke.",
    "On coronation morning, the seamstress finds a hidden note.",
  ],
  Horror: [
    "Every mirror in the house shows you blinking out of sync.",
    "The town’s last obituary describes someone still breathing.",
    "Your neighbor’s wind chimes play a tune you heard underground.",
  ],
  "Literary Fiction": [
    "On the third morning, the river returns your father’s watch.",
    "She catalogs the things they never said, alphabetized by regret.",
    "The city learns to speak softly, and only the lonely hear it.",
  ],
  "Young Adult": [
    "The cafeteria ceiling map lights up above your table—only yours.",
    "Your locker combination opens a door behind the gym.",
    "Detention ends with a field trip to a place not built yet.",
  ],
  Adventure: [
    "The rope bridge holds, but the mountain hums like a throat clearing.",
    "A bottle washes ashore with coordinates written twice.",
    "You inherit a compass that points to whatever you’re avoiding.",
  ],
  Dystopian: [
    "The billboard corrects your memory in real time—again.",
    "Curfew sirens falter, replaced by a child counting to ten.",
    "Your ration card prints a second name below yours.",
  ],
  "Magical Realism": [
    "Your apartment grows a window that faces last summer.",
    "Today’s rain smells exactly like cinnamon and apologies.",
    "Grandmother’s teacup refuses to hold anything but the truth.",
  ],
  Crime: [
    "The safe is empty except for a receipt in your handwriting.",
    "Someone fenced the evidence before the crime happened.",
    "Your alibi calls you from a blocked number.",
  ],
  Contemporary: [
    "The group chat votes to meet offline for the first time in years.",
    "A package arrives with a note: “You left this in 2012.”",
    "Your rideshare driver is your ex’s new partner.",
  ],
  Paranormal: [
    "The ghost in your kitchen starts leaving grocery lists.",
    "Streetlights flicker Morse code spelling your name.",
    "Your shadow lags behind, staring at something you can’t see.",
  ],
  "Urban Fantasy": [
    "The subway skips a station and stops at a platform with ivy.",
    "Vendors start selling spells with exact change only.",
    "A graffiti tag glows and asks where you’ve been.",
  ],
  Steampunk: [
    "The automaton in the square sneezes coal dust and a key.",
    "Airships circle a storm that never moves off the city.",
    "Your goggles reveal a blueprint hidden in the fog.",
  ],
  Cyberpunk: [
    "Your reflection boots a different OS.",
    "An ad follows you into a dead zone and keeps talking.",
    "The city’s firewall grows teeth at midnight.",
  ],
  "Space Opera": [
    "The admiral orders silence; the stars begin to sing anyway.",
    "Your ship receives a royal summons from an extinct dynasty.",
    "An asteroid writes a message in your wake.",
  ],
  "Post-Apocalyptic": [
    "The Geiger counter laughs—a sound it shouldn’t make.",
    "A library survives, guarded by a flock of trained crows.",
    "The highway is clear for the first time since the sirens.",
  ],
  "Time Travel": [
    "Your future self texts: “Don’t open the blue door. Not yet.”",
    "The calendar repeats the same Tuesday until you apologize.",
    "A museum exhibit features your watch, scratched tomorrow.",
  ],
  "Alternate History": [
    "The treaty is signed with ink that refuses to dry.",
    "A coin flip crowns the wrong monarch.",
    "A telegram arrives addressed to a country that never existed.",
  ],
  "Mythology & Folklore": [
    "A fox leaves footprints on your ceiling.",
    "The river demands a story before letting you cross.",
    "You inherit a name that opens locked hills.",
  ],
  Western: [
    "The new sheriff rides in with rainclouds.",
    "A wanted poster lists your horse’s name.",
    "High noon comes early and doesn’t leave.",
  ],
  "Humor/Satire": [
    "Breaking: your toaster starts a podcast about bread trauma.",
    "You win a lifetime supply of disclaimers.",
    "The HOA elects a raccoon and productivity soars.",
  ],
};

// Best-effort fix for common mojibake and curly punctuation to ASCII.
function sanitize(text: string): string {
  return text
    .replaceAll("�?T", "'")
    .replaceAll("�?o", '"')
    .replaceAll("�??", '"')
    .replaceAll("�?�", "...")
    .replaceAll("�?\"", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("—", "-")
    .replaceAll("…", "...");
}

export function randomSeedForGenre(genre: string): string {
  const key = GENRES.includes(genre) && genre !== "Other / Custom" ? genre : "Contemporary";
  const list = SEEDS[key] ?? SEEDS["Contemporary"];
  const v = list[Math.floor(Math.random() * list.length)];
  return sanitize(v);
}
