const { randomInt } = require("node:crypto");
const { details, pool, grantedAttacks } = require("./catalog.cjs");
const log = require("./log.cjs");
const {
  within,
  lineOfSight,
  fits,
  beamReaches,
  projectionAt,
  allowedAngle,
  toolEnd,
  terrainThrowPath,
  distanceToTerrain,
  range,
} = require("./geometry.cjs");

const faces = [
  "critical",
  "wild",
  "hit",
  "hit",
  "block",
  "failure",
  "blank",
  "blank",
];
const profiles = {
  "Mystic Beam": { fixedPool: true },
  "Helios Laser Bombardment": { ignoreSight: true, helios: true },
  "Ricochet Rampage": {},
  "X-BO-SI-N Plasma Rifle": {
    fixedPool: true,
    builder: "damage",
    illicit: true,
  },
  "Energy Blast": {},
  "Binary Blast": {
    afterMove: { mode: "push", speed: "S", required: true },
    conditions: [["wild", "incinerate"]],
  },
  Warbird: {
    afterMove: { mode: "place", who: "actor", range: 2, required: true },
    warbird: true,
  },
  "Sword Strike": {
    builder: "damage",
    pierce: true,
    duelist: true,
    afterMove: {
      mode: "advance",
      who: "actor",
      speed: "S",
      on: "critical wild",
    },
  },
  "Coup de Grâce": {
    afterMove: { mode: "advance", who: "actor", speed: "S", on: "down" },
  },
  "Brooklyn Brawler": {
    sizeBonus: true,
    extra: "frontliner",
    afterMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 3,
      on: "critical",
    },
  },
  "Photon Blast": {
    builder: "damage",
    beforeMove: {
      mode: "advance",
      who: "actor",
      speed: "S",
      direction: "toward",
      on: "wild",
    },
  },
  "Up Close and Personal": {
    afterMove: { mode: "throw", speed: "S", limit: 2, required: true },
  },
  Strike: {
    builder: "damage",
    beforeMove: { mode: "push", speed: "S", direction: "away", on: "wild" },
  },
  "Hulk Smash!": {
    beforeMove: { mode: "throw", speed: "S" },
    conditions: [["wild", "stagger"]],
  },
  "Repulsor Mk 2": {
    builder: "at-least-one",
    beforeMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      on: "wild",
      required: true,
    },
  },
  "Billion-Dollar Punch": {
    beforeMove: { mode: "place", who: "actor", range: 1, required: true },
    afterMove: {
      mode: "throw",
      speed: "M",
      direction: "away",
      limit: 3,
      on: "wild hit",
      required: true,
    },
  },
  "Reality Bows to Me!": { extra: "reality" },
  "Savage Predator": { extra: "claw" },
  "Impact Webbing": {
    builder: 1,
    beforeMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 2,
      on: "wild",
    },
  },
  "Web-Head Wallop": { catchTerrain: true },
  "Deadly Origins": {
    extra: "batons",
    afterMove: { mode: "advance", who: "actor", speed: "M" },
  },
  "Extinction Protocols": {
    beforeMove: { mode: "throw", speed: "S", limit: 4, required: true },
    explosive: true,
  },
  "Plasma Beam": { builder: 1, pierce: "wild failure" },
  "Arm Lasers 2.0": { conditions: [["wild", "incinerate"]] },
  "Thunder Clap": {},
  "Freezing Blast": { builder: 1, conditions: [["wild", "slow"]] },
  Chill: { conditions: [["wild", "stagger"]] },
  Flyby: { builder: 1 },
  "Avenging Angel": {
    afterMove: { mode: "throw", speed: "S", limit: 3 },
    conditions: [["wild", "stun"]],
  },
  "Psionic Bolt": { builder: "damage", drain: "sap", pierce: "failure" },
  "Telekinetic Force": {
    beforeMove: { mode: "throw", speed: "S", direction: "away", limit: 4 },
    nearbyDamage: "wild",
  },
  "Teleporting Strike": { builder: "damage", distantStun: true },
  "Brimstone Blitz": { placementDice: true, flurry: true },
  "Optic Blast": {
    builder: "damage",
    beforeMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 3,
      on: "wild",
    },
    extra: "speed-of-sight",
  },
  "Optic Devastation": { afterDrain: true },
  "Lightning Bolt": { builder: "damage", conditions: [["wild", "shock"]] },
  "Ice Blizzard": { conditions: [["damage", "stun"]] },
  Hurricane: { ignoreSight: true },
  "Acrobatic Strike": {
    builder: "damage",
    afterMove: {
      mode: "place",
      who: "actor",
      range: 1,
      required: true,
      on: "wild",
    },
  },
  "Animalistic Freestyle": {
    beforeMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 3,
      required: true,
      on: "wild",
    },
    afterMove: { mode: "advance", who: "actor", speed: "M" },
    conditions: [["", "bleed"]],
  },
  "Adamantium Slash": {
    builder: "damage",
    pierce: true,
    conditions: [["wild", "bleed"]],
  },
  "Berserker Barrage": {
    beforeMove: { mode: "place", who: "actor", range: 1, required: true },
    afterMove: { mode: "throw", speed: "S", limit: 3, damageRequired: true },
  },
  "X-Slam": {
    beforeMove: { mode: "throw", speed: "S", limit: 4, on: "wild" },
    conditions: [["", "stun"]],
  },
  "Psionic Vampirism": { builder: "damage", drain: "sap", heal: 1 },
  "Psionic Concussion": {
    builder: 1,
    afterMove: {
      mode: "push",
      speed: "S",
      direction: "toward",
      limit: 4,
      on: "wild",
      damageRequired: true,
    },
  },
  "You Can Do Nothing but Fall": { conditions: [["", "incinerate"]] },
  "Psychic Spike": {
    builder: "damage",
    afterMove: { mode: "advance", speed: "S", on: "wild hit" },
  },
  "Hands Off": {
    beforeMove: {
      mode: "advance",
      targetSpeed: true,
      direction: "away",
      damage: 1,
      on: "wild",
    },
  },
  "Diamond Strike": {
    builder: "damage",
    pierce: "critical",
    conditions: [["wild", "stun"]],
  },
  Shatter: { pierce: "critical" },
  "Mental Shackle": {
    builder: "damage",
    afterMove: { mode: "advance", speed: "S", damageRequired: true },
    conditions: [["wild", "root"]],
  },
  "Astral Disintegration": { powerDice: true, lockDefense: true },
  "Telekinetic Katana": {
    types: ["energy", "mystic"],
    builder: "damage",
    drain: "each",
  },
  "Psi-Bow": {
    builder: 1,
    beforeMove: {
      mode: "advance",
      who: "actor",
      speed: "S",
      direction: "toward",
      on: "hit",
    },
  },
  "Psionic Assault": { before: [["", "stun"]] },
  "Phasing Strike": {
    builder: "damage",
    ignoreDefenseCritical: true,
    afterMove: {
      mode: "place",
      who: "actor",
      self: true,
      range: 1,
      on: "wild",
    },
  },
  "Get‘em Lockheed!": { builder: 1, conditions: [["wild", "incinerate"]] },
  "Intangible Assault": {
    ignoreDefenseCritical: true,
    afterMove: {
      mode: "place",
      who: "actor",
      self: true,
      range: 2,
      on: "wild",
    },
  },
  "Plasma Blast": { builder: "damage", conditions: [["wild", "incinerate"]] },
  "Plasma Wave": { pierce: true, conditions: [["", "incinerate"]] },
  "Lumikinetic Blast": { builder: 1, conditions: [["wild hit", "stun"]] },
  "Princess of Pyrotechnics": { extra: "rapid", rapidOn: "wild hit" },
  "Automatic Pistols": { builder: 1, extra: "rapid" },
  "Grenade Bounce": {
    ignoreSight: true,
    nearbyDamage: "wild",
    conditions: [["", "incinerate"]],
  },
  "Lucky Shot": { noPower: true, conditions: [["wild", "stun"]] },
  "XSE Blaster": { builder: "damage", closeCondition: [3, "incinerate"] },
  "Return With Interest": {
    types: ["physical", "energy", "mystic"],
    boost: 3,
    conditions: [["wild", "slow"]],
    afterMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      on: "wild",
      required: true,
    },
  },
  "Claw Rush": {
    pierce: true,
    afterMove: { mode: "advance", who: "actor", speed: "M" },
  },
  Hamstring: {
    conditions: [["damage", "slow", "bleed"]],
    afterMove: { mode: "advance", who: "actor", speed: "M", on: "wild" },
  },
  Soulsword: { builder: "damage", pierce: true },
  "Bolts of Oshtur": { builder: 1, conditions: [["critical wild", "hex"]] },
  Darkchylde: {
    failuresSucceed: true,
    conditions: [["", "bleed", "incinerate"]],
  },
  "Plasma Rifle": {
    builder: "damage",
    closeReroll: true,
    conditions: [["wild", "incinerate"]],
  },
  "Askani‘Son": { healOnDamage: 1 },
  "X-Slash": {
    builder: "damage",
    pierce: true,
    afterMove: { mode: "place", who: "actor", range: 1, required: true },
  },
  "Tornado Claw": {
    pierce: true,
    conditions: [["wild", "bleed"]],
    placeAfterVolley: true,
  },
  "Razor Wing Strike": {
    builder: "damage",
    conditionChoice: ["bleed", "poison"],
    conditionTrigger: "each-wild",
    afterMove: {
      mode: "place",
      who: "actor",
      range: 1,
      on: "critical",
      required: true,
    },
  },
  "Avatar of Death": { neurotoxin: true },
  "Neurokinetic Arrows": { builder: "damage", neural: true },
  "Psionic Salvo": { extra: "salvo", rapidOn: "critical wild" },
  "UV Strike": { builder: "damage", flareOn: "wild hit" },
  "Dark Solar Blast": { concussion: "wild hit" },
  Stab: { builder: "damage", extra: "rapid", rapidOn: "wild wild" },
  Bang: { builder: 1, extra: "rapid", rapidOn: "wild hit" },
  "Duodenum Poke": { conditions: [["damage", "bleed", "slow"]] },
  "Maximum Effort!": {
    afterMove: {
      mode: "advance",
      who: "actor",
      speed: "S",
      on: "wild",
      danceParty: true,
    },
  },
  "T-O Talons": {
    builder: "damage",
    conditions: [["wild", "bleed", "poison"]],
  },
  "Buster Cannon": { builder: 1, conditions: [["wild", "shock"]] },
  "Self Must Protect Selffriend": {
    selffriend: true,
    afterMove: {
      mode: "throw",
      speed: "S",
      direction: "away",
      limit: 3,
      on: "wild",
    },
  },
  "Plasma Blasters": { builder: 1, extra: "rapid" },
  "Adamantium Knife": { builder: "damage", conditions: [["wild", "bleed"]] },
  "Agent Zero": {
    afterMove: {
      mode: "throw",
      speed: "S",
      direction: "away",
      limit: 3,
      on: "wild",
    },
  },
  "Berserker Rage": { builder: 1, pierce: true, repeatBonus: true },
  "Uncontrollable Weapon": {
    rampage: "wild hit",
    extra: "rapid",
    rapidOn: "wild wild",
  },
  "Carbonadium Coils": { builder: "damage", healOnDamage: 1 },
  "Red Terror": { types: ["physical", "energy"], absorbEssence: true },
  "Mind Possession": { afterMove: { mode: "advance", speed: "S" } },
  "Flesh Manipulation": { explosiveForce: true },
  Dogpile: { dupeReroll: true, conditions: [["wild", "slow"]] },
  "Madrox Monkey Pile!": { dupeDice: 2, conditions: [["wild hit", "stagger"]] },
  "Bolts of Flame": { builder: "damage", conditions: [["wild", "incinerate"]] },
  Firestorm: { conditions: [["wild", "incinerate"]] },
  "Phoenix Blast": { destructiveForce: true, phoenixGain: 1 },
  "Molecular Disintegration": { phoenixLoss: true },
  "Shield Throw": {
    builder: 1,
    ignoreSight: true,
    extra: "bounce",
    bounceOn: "wild",
  },
  "Siberian Shield Slam": {
    beforeMove: { mode: "throw", speed: "S", limit: 3 },
  },
  "Bear-Handed Slap": { builder: "damage", conditions: [["wild", "bleed"]] },
  "Bear-Armed Brawler": {
    beforeMove: { mode: "throw", speed: "S", limit: 4 },
    conditions: [["", "stagger"]],
  },
  "Darkforce Strike": { builder: 1, rerollAll: true },
  "Rending Force": {
    types: ["physical", "energy"],
    conditions: [["wild", "bleed"]],
  },
  "Mixed Technique": {
    conditions: [["damage", "stagger"]],
    afterMove: { mode: "advance", who: "actor", speed: "S", on: "wild" },
  },
  "Electric Blast": { builder: 1, conditions: [["wild", "shock"]] },
  "Homing Rockets": { ignoreSight: true, nearbyDamage: "wild" },
  "Psychic Dart": { builder: "damage", conditions: [["wild", "root"]] },
  "Mental Suggestion": {
    afterMove: { mode: "advance", targetSpeed: true, damageRequired: true },
  },
  "Astral Duel": { mysticDice: true, lockDefense: true },
  "Deadly Illusions": {
    builder: 1,
    damageCap: 1,
    mindOverMatter: true,
    conditionChoice: ["bleed", "poison", "shock", "incinerate"],
    conditionTrigger: "each-wild",
  },
  "Mass Hallucinations": {
    afterMove: { mode: "advance", speed: "S", on: "wild" },
  },
  Seismokinesis: { builder: 1, conditions: [["wild", "stun"]] },
  "Epicenter of Destruction": { conditions: [["", "stun"]] },
  "Bo Staff": {
    builder: 1,
    beforeMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 3,
      on: "wild",
    },
  },
  "Kinetic Ace": { builder: "damage", nearbyDamage: "wild" },
  "52 Card Pickup": { conditions: [["wild wild", "stun"]] },
  "Bloodthirsty Onslaught": {
    pierce: true,
    conditions: [["wild", "bleed"]],
    afterMove: { mode: "place", who: "actor", range: 1, required: true },
  },
  "I‘m the Juggernaut": { rush: true },
  "Fire Blast": { builder: 1, conditions: [["wild", "incinerate"]] },
  "Flame Jet": { builder: 1, conditions: [["wild", "incinerate"]] },
  Inferno: { nearbyDamage: true, conditions: [["", "incinerate"]] },
  "Thunderous Splash": {
    beforeMove: { mode: "place", who: "actor", range: 1, required: true },
    explosive: true,
  },
  "Solar Energy Beam": { builder: 1, drain: "sap" },
  "Genetic Splicing": { volleyReward: true },
  "Recombinant Disintegration": { sampleBoost: true, geneticBurst: true },
  "Adhesive X Pistol": {
    conditions: [
      ["wild", "slow"],
      ["critical wild", "stun"],
      ["critical wild failure", "stagger"],
    ],
  },
  "Shield Bounce": { builder: "damage", extra: "bounce" },
  "Sonic Boom": { builder: "damage", drain: "wild" },
  "Striking Tentacles": { builder: "damage", doubleWild: true },
  "Scientific Breakthrough": {
    conditions: [["damage", "bleed", "poison", "shock"]],
  },
  "Arrow Shot": {
    builder: "damage",
    types: ["physical", "energy"],
    conditionChoice: ["bleed", "poison", "shock", "slow"],
  },
  "Hex Bolt": {
    builder: "damage",
    conditionChoice: ["bleed", "hex", "incinerate", "poison"],
    conditionTrigger: "failure",
  },
  "Supersonic Strike": { builder: "damage", dash: true, velocity: true },
  "Cyclonic Vortex": {
    afterMove: { mode: "advance", who: "actor", speed: "M" },
  },
  "Cruel Twist": { ignoreDefenseCritical: true, pierce: "failure" },
  "Reverse Polarity": { builder: "damage", reversePolarity: true },
  "Magnetic Crush": { magneticCrush: true },
  "Tongue Lash": { builder: "damage", conditions: [["wild", "poison"]] },
  "Spit Acid": { conditions: [["", "incinerate"]] },
  "Absorbing Strike": {
    types: ["physical", "energy"],
    builder: "damage",
    drain: "sap",
  },
  "Southern Hospitality": {
    afterMove: { mode: "throw", speed: "S", limit: 4 },
  },
  "Focused Unibeam": { criticals: 2, backlash: true },
  Pistol: { builder: 1, extra: "rapid" },
  Espionage: { before: [["", "stun"]] },
  "Cosmic Burst": {
    builder: "damage",
    types: ["energy", "mystic"],
    conditions: [["wild", "shock"]],
  },
  "Claw Slash": {
    builder: "damage",
    pierce: true,
    conditions: [["wild", "bleed"]],
  },
  "Swinging Strike": { builder: 1, advance: true },
  "Shock Batons": { builder: "damage", before: [["wild", "shock"]] },
  "Widow Stingers": { builder: 1, before: [["wild", "stun"]] },
  "Concussion Blasters": {
    builder: "damage",
    conditions: [["wild", "poison", "bleed"]],
  },
  "Synthezoid Avenger": { ignoreDefenseCritical: true },
  "Spec Ops Rifle": { builder: "damage", drain: "all-wilds" },
  "Concussion Grenade": { conditions: [["damage", "stun"]], splashShock: true },
  "The Red Agent": { splashDamage: true },
};

const blobStrike = {
  builder: "damage",
  afterMove: {
    mode: "push",
    speed: "S",
    direction: "away",
    limit: 3,
    on: "wild",
  },
};
const duplicates = "multiple-man-duplicates-grunts";
const nearDuplicates = (state, actor, target) =>
  state.fighters.some(
    (f) =>
      f.side === actor.side &&
      f.slug === (actor.slug === duplicates ? "multiple-man" : duplicates) &&
      usable(f) &&
      within(f, target, 2),
  );
const characterProfiles = {
  "black-widow:Strike": { builder: "damage", widowSting: true },
  "black-widow:Pistol": {},
  "red-guardian:Strike": {
    builder: 1,
    afterMove: {
      mode: "push",
      speed: "S",
      direction: "away",
      limit: 3,
      required: true,
    },
  },
  "multiple-man:Strike": { builder: "damage", dupeReroll: true },
  "cassandra-nova:Psionic Bolt": { builder: "damage", drain: "sap" },
  "honey-badger:Claw Slash": {
    builder: "damage",
    conditions: [["wild", "bleed"]],
  },
};
function attackProfile(actor, attack) {
  if (attack.borrowedFrom) return {};
  const own = characterProfiles[actor.slug + ":" + attack.name];
  if (own) return own;
  if (actor.slug === "colossus" && attack.name === "Strike")
    return colossusStrike;
  return actor.slug === "the-blob" && attack.name === "Strike"
    ? blobStrike
    : profiles[attack.name];
}
const colossusStrike = {
  builder: "damage",
  beforeMove: { mode: "push", speed: "S", limit: 4, on: "wild" },
};

const activePowers = {
  "Web-Slinger": { mode: "place", range: 3 },
  "Hook Arrow": { mode: "place", range: 3 },
  "Quick Step": { mode: "advance", speed: "M" },
  "Trick Shot": { mode: "self", repeat: true },
  "I‘m Just Getting Warmed Up": {
    mode: "target",
    terrain: 4,
    enemy: 4,
    range: 2,
    speed: "M",
    effect: "throw",
  },
  "Ready or Not . . .": {
    mode: "sequence",
    order: ["move", "attack"],
    action: true,
  },
  "Gamma Leap": { mode: "place", range: 2 },
  Firewall: { mode: "target", range: 3, enemy: 99, effect: "firewall" },
  "Stoke the Flames": { mode: "self", repeat: true },
  "Catch Little Man!": {
    mode: "target",
    terrain: 3,
    range: 2,
    speed: "M",
    effect: "throw",
  },
  "Nothing Stops the Juggernaut!": { mode: "self", repeat: true },
  "Avatar of Cyttorak": {
    mode: "target",
    enemy: 3,
    terrain: 3,
    range: 2,
    speed: "M",
    effect: "throw",
  },
  Speedster: { mode: "self" },
  Hop: { mode: "place", range: 2 },
  "Phase Rush": { mode: "place", range: 2 },
  "Blast Off": { mode: "place", range: 2 },
  "Propulsion Thrusters": { mode: "place", range: 2 },
  "Overcharge Capacitors": { mode: "self", action: true, repeat: true },
  "Ursine Temper": {
    mode: "target",
    range: 2,
    terrain: 3,
    speed: "M",
    effect: "throw",
  },
  "Dimensional Portal": {
    mode: "target",
    range: 3,
    ally: true,
    self: true,
    effect: "place",
    destinationRange: 3,
    oncePerTarget: true,
    repeat: true,
  },
  "Cosmically Empowered Telekinesis": {
    mode: "target",
    range: 2,
    enemy: 5,
    terrain: 4,
    speed: "M",
    effect: "throw",
  },
  "Rejuvenating Flames": {
    mode: "target",
    range: 3,
    ally: true,
    self: true,
    effect: "rejuvenate",
    oncePerTarget: true,
    repeat: true,
  },
  "Duplicate Reabsorption": {
    mode: "target",
    range: 3,
    ally: true,
    duplicate: true,
    effect: "reabsorb",
  },
  "Follow the Leads": { mode: "self" },
  Biokinesis: {
    mode: "target",
    range: 3,
    enemy: 99,
    effect: "firewall",
    repeat: true,
  },
  "Death Factor": { mode: "self" },
  Ensnare: {
    mode: "target",
    range: 4,
    enemy: 99,
    sight: true,
    effect: "push",
    speed: "M",
    direction: "toward",
    referenceActor: true,
    oncePerTarget: true,
    repeat: true,
  },
  "You Can‘t Spell Legendary Without Leg Day": { mode: "place", range: 2 },
  "Merc with a Mouth": { mode: "target", range: 3, enemy: 99, effect: "mouth" },
  "Techno-Organic Absorption": {
    mode: "target",
    range: 3,
    terrain: 3,
    effect: "absorb-terrain",
    repeat: true,
  },
  "Transmode Virus Infection": { mode: "self" },
  "Figment of Fantasy": {
    mode: "target",
    range: 5,
    enemy: 99,
    effect: "advance",
    speed: "S",
    neuralTarget: true,
  },
  "High Energy Conversion": {
    mode: "target",
    range: 2,
    terrain: 0,
    enemy: 0,
    flareLimit: true,
    speed: "S",
    effect: "throw",
  },
  Sunburn: { mode: "self", action: true },
  "Body Slide by One": { mode: "place", range: 2 },
  "Limbo Step": { mode: "self", variableCost: "bamf" },
  "Omega Level Threat": {
    mode: "target",
    range: 3,
    terrain: 4,
    speed: "M",
    effect: "throw",
    variableCost: "terrain",
  },
  "What I Do Isn‘t Very Nice": {
    mode: "sequence",
    action: true,
    order: ["attack"],
    attackName: "X-Slash",
    throwAfter: true,
  },
  "Absorbed Energy Conversion": {
    mode: "target",
    range: 2,
    terrain: 4,
    enemy: 4,
    speed: "M",
    effect: "throw",
  },
  "Cosmic Energy Absorption": { mode: "self", action: true, repeat: true },
  "Telekinetic Combat Enhancement": { mode: "advance", speed: "S" },
  "Freeze and Fade": {
    mode: "sequence",
    action: true,
    order: ["attack", "move"],
    moveSizeFive: true,
  },
  "Battlefield Manipulation": {
    mode: "target",
    range: 3,
    terrain: 4,
    speed: "M",
    effect: "throw",
  },
  "Matter Transmutation": {
    mode: "target",
    range: 2,
    any: true,
    activatedTarget: true,
    speed: "S",
    effect: "push",
    repeat: true,
  },
  "BAMF!": { mode: "self", variableCost: "bamf" },
  "Field Leader": {
    mode: "target",
    range: 4,
    effect: "advance",
    ally: true,
    speed: "S",
    repeat: true,
  },
  "Eye of the Storm": { mode: "self", repeat: true },
  Tempest: {
    mode: "target",
    range: 3,
    effect: "throw",
    speed: "S",
    terrain: 2,
    enemy: 2,
  },
  "Baser Instincts": {
    mode: "target",
    range: 2,
    terrain: 2,
    enemy: 2,
    effect: "throw",
    speed: "S",
  },
  "The Best At What I Do . . .": {
    mode: "sequence",
    action: true,
    order: ["move", "attack"],
    doubleWild: true,
  },
  "Playing Catch": {
    mode: "target",
    range: 2,
    terrain: 3,
    effect: "throw",
    speed: "M",
  },
  Teleportation: { mode: "place", range: 2 },
  "Astral Fiend": {
    mode: "place",
    range: 3,
    action: true,
    effect: "projection",
  },
  "Immortal Essence": { mode: "self" },
  "Your Reality is Whatever I Want it to Be": {
    mode: "target",
    range: 5,
    effect: "borrow-attack",
    variableCost: "mystic-defense",
  },
  "Telepathic Lash": {
    mode: "target",
    range: 3,
    enemy: 99,
    effect: "telepathic-lash",
  },
  "Sometimes One Must Get Their Hands Dirty": {
    mode: "target",
    range: 2,
    enemy: 3,
    terrain: 3,
    effect: "throw",
    speed: "M",
  },
  "My Faith Can Move Mountains": {
    mode: "target",
    range: 3,
    terrain: 4,
    effect: "throw",
    speed: "M",
    variableCost: "terrain",
  },
  Landslide: {
    mode: "target",
    range: 3,
    enemy: 4,
    effect: "push",
    direction: "away",
    speed: "S",
  },
  "Catch, Runt!": {
    mode: "target",
    range: 2,
    enemy: 3,
    effect: "throw",
    speed: "M",
  },
  "Primal Pounce": { mode: "self" },
  "Stop Squealing and Die": { mode: "self", repeat: true },
  "Finders Keepers": {
    mode: "target",
    range: 2,
    action: true,
    repeat: true,
    effect: "transfer-extract",
  },
  "Marvelous Strength": {
    mode: "target",
    terrain: 4,
    range: 2,
    speed: "M",
    effect: "throw",
  },
  "Mutant Absorption": {
    mode: "target",
    range: 2,
    enemy: 99,
    effect: "absorb-power",
  },
  "Fatal Attraction": {
    mode: "target",
    terrain: 4,
    range: 3,
    speed: "L",
    effect: "throw",
    repeat: true,
    escalatingCost: true,
  },
  Telekinesis: {
    mode: "target",
    terrain: 4,
    range: 3,
    speed: "M",
    effect: "throw",
  },
  Synthesis: { mode: "self", action: true, repeat: true },
  "No Mercy": { mode: "self", repeat: true },
  Charge: { mode: "sequence", order: ["move", "attack"], action: true },
  "Hit and Run": { mode: "sequence", order: ["attack", "move"], action: true },
  "Ock‘s Grasp": {
    mode: "target",
    terrain: 3,
    enemy: 3,
    range: 3,
    speed: "S",
    effect: "throw",
  },
  "Strongest One There Is": {
    mode: "target",
    terrain: 4,
    range: 2,
    speed: "L",
    effect: "throw",
  },
  "Reshape the World": {
    mode: "target",
    terrain: 3,
    range: 3,
    speed: "M",
    effect: "throw",
  },
  "Kinetic Field Generator": {
    mode: "target",
    terrain: 4,
    range: 3,
    speed: "M",
    effect: "throw",
  },
  "Calculated Trajectory": {
    mode: "target",
    terrain: 3,
    enemy: 3,
    range: 2,
    speed: "M",
    effect: "throw",
  },
  "Proportionate Strength of a Spider": {
    mode: "target",
    enemy: 3,
    range: 3,
    speed: "S",
    effect: "throw",
  },
  "Encephalo-Beam": {
    mode: "target",
    enemy: 99,
    range: 3,
    speed: "S",
    effect: "advance",
  },
  "Such Fun Little Playthings": {
    mode: "target",
    enemy: 99,
    range: 3,
    speed: "S",
    effect: "advance",
  },
  "Nothing is Beyond My Reach": {
    mode: "target",
    any: true,
    range: 2,
    effect: "place",
    destinationRange: 3,
  },
  "Expert Sabotage": {
    mode: "target",
    terrain: 3,
    range: 4,
    effect: "sabotage",
    action: true,
  },
  "Genetic Negation": {
    mode: "target",
    enemy: 99,
    range: 3,
    effect: "root",
    repeat: true,
  },
  "Engineered Perfection": { mode: "target", effect: "purge" },
};

const face = (f) => {
  const detail = details[f.slug];
  const card = (f.form && detail.secondStatCard) || detail.statCard;
  return f.injured ? card.backSide || card.frontSide : card.frontSide;
};
const has = (fighter, condition) => fighter.conditions?.includes(condition);
const usable = (f) => f.x != null && !f.ko && !f.dazed;
const power = (fighter, name) =>
  face(fighter).superPowers?.find((p) => p.name === name);
const rangeOf = (attack) => Number(String(attack.range).replace(/^[AB]/, ""));
const shapeOf = (attack) =>
  ({ A: "area", B: "beam" })[String(attack.range)[0]] || "single";
const addSample = (actor) => {
  actor.samples = Math.min(3, (actor.samples ?? 1) + 1);
};
function attackCard(actor, index) {
  return (
    actor.borrowedAttacks?.[index] ||
    grantedAttacks[index] ||
    face(actor).attacks[index]
  );
}
function isPower(fighter, name) {
  return (face(fighter).superPowers || []).some(
    (p) =>
      p.name === name ||
      p.name.startsWith(name + ",") ||
      p.name.includes(", " + name + ",") ||
      p.name.endsWith(", " + name),
  );
}
const displacementSize = (fighter) =>
  isPower(fighter, "Adamantium Skeleton") ? 3 : fighter.size;

function mindShielded(model) {
  return [
    "Helmet",
    "Psychic Immunity",
    "Omega-Level Telepath",
    "Unicorns, Rainbows, and Sugar Plums Dancing Through My Head",
  ].some((name) => isPower(model, name));
}
function moveEvent(spec, actor, target, damageType) {
  const mover = spec.who === "actor" ? actor : target;
  const ref = spec.self
    ? mover
    : spec.reference || (mover === actor ? target : actor);
  if (
    !usable(mover) ||
    (spec.mode === "place" && ref.x == null) ||
    (spec.limit &&
      (["push", "throw"].includes(spec.mode)
        ? displacementSize(mover)
        : mover.size) > spec.limit) ||
    (spec.mode === "push" &&
      mover.side !== actor.side &&
      isPower(mover, "Organic Steel")) ||
    (damageType &&
      damageType !== "superpower" &&
      ["push", "throw"].includes(spec.mode) &&
      isPower(mover, "Nothing Can Move The Blob!")) ||
    ((damageType === "mystic" || damageType === "superpower") &&
      mover.side !== actor.side &&
      ["push", "advance"].includes(spec.mode) &&
      mindShielded(mover)) ||
    (spec.mode === "push" &&
      (mover.phasing === "density" ||
        (isPower(mover, "Metal Mind") &&
          mover.side !== actor.side &&
          ["mystic", "superpower"].includes(damageType))))
  )
    return null;
  return {
    ...spec,
    ...(spec.targetSpeed && { speed: mover.speed }),
    cause: damageType,
    type: "displace",
    side: actor.side,
    mover: mover.id,
    source: actor.id,
    reference: { x: ref.x, y: ref.y, radius: ref.radius },
    name: mover.name,
  };
}
function dodge(state, target, source, random, bonus = 0) {
  if (target.phasing === "phased") return;
  const rolled = dice(
    Number(face(target).physicalDefense) +
      bonus +
      (target.selfDiscovery ? 3 : 0),
    has(target, "hex") ? 0 : 1,
    random,
  );
  const rolls = [{ label: "Уклонение", faces: rolled.slice() }];
  if (isPower(target, "Spider-Sense")) {
    reroll(rolled, 2, random, "defense");
    if (rolled.some((value, index) => value !== rolls[0].faces[index]))
      rolls.push({ label: "После переброса", faces: rolled });
  }
  log(state, "Уклонение · " + target.name, {
    side: target.side,
    fighter: target.id,
    rolls,
  });
  const observers = failureObservers(state, target, [
    ...rolls[0].faces,
    ...rolled,
  ]);
  damage(state, target, dodgeDamage(target, rolled), source);
  grantFailurePower(state, observers);
  totallyMeantIt(state, target, rolled);
}
function totallyMeantIt(state, model, roll) {
  if (
    !usable(model) ||
    !roll.includes("critical") ||
    !isPower(model, "I Totally Meant to Do That!")
  )
    return;
  gain(model, 1);
  dropObjectives(state, model);
  log(state, "I Totally Meant to Do That! · " + model.name, {
    side: model.side,
    fighter: model.id,
  });
}
function savage(state, model) {
  return (
    isPower(model, "Savagery Protocols") &&
    state.objectives?.some((o) => o.role === "secure" && within(model, o, 1))
  );
}
// Removes damage unless an enemy Anti-Healing Factor Corrosive stops it.
function heal(state, model, amount) {
  if (!usable(model) || amount <= 0 || !model.damage) return;
  const maverick = state.fighters.find(
    (f) =>
      f.side !== model.side &&
      usable(f) &&
      isPower(f, "Anti-Healing Factor Corrosive") &&
      f.power >= 2 + rootTax(f) &&
      reactiveAllowed(model, f, state) &&
      within(f, model, 3),
  );
  if (maverick) {
    (state.effects ||= []).unshift({
      type: "anti-healing",
      side: maverick.side,
      source: maverick.id,
      target: model.id,
      amount,
      cost: 2 + rootTax(maverick),
    });
    return;
  }
  model.damage = Math.max(0, model.damage - amount);
}
function unleash(state, phoenix) {
  const back = details[phoenix.slug].statCard.backSide;
  Object.assign(phoenix, {
    injured: true,
    dazed: false,
    damage: 0,
    conditions: [],
    size: Number(back.size) || phoenix.size,
    speed: back.speed || phoenix.speed,
  });
  log(state, "Phoenix Unleashed", { side: phoenix.side, fighter: phoenix.id });
}
function phoenixExplosion(state, phoenix, random) {
  const rolled = rawDice(phoenix.phoenix || 0, random);
  const hits = rolled.filter((d) =>
    ["critical", "wild", "hit"].includes(d),
  ).length;
  const origin = { x: phoenix.x, y: phoenix.y, radius: phoenix.radius };
  log(state, "Untamed Cosmic Entity · " + hits, {
    side: phoenix.side,
    fighter: phoenix.id,
    rolls: [{ label: "Phoenix", faces: rolled }],
  });
  phoenix.phoenix = 0;
  phoenix.ko = true;
  phoenix.dazed = false;
  phoenix.x = phoenix.y = null;
  dropObjectives(state, phoenix);
  if (hits) {
    for (const f of state.fighters.filter(
      (f) => usable(f) && within(f, origin, 5),
    ))
      damage(state, f, hits, phoenix);
    state.terrain = state.terrain.filter(
      (p) => p.size > hits || distanceToTerrain(origin, p) > range[5],
    );
  }
}
function addFlare(model, amount = 1) {
  if (isPower(model, "Flare State"))
    model.flares = Math.min(3, (model.flares || 0) + amount);
}
function dodgeDamage(target, rolled) {
  return Math.max(
    0,
    3 -
      rolled.filter((d) => ["critical", "wild", "block"].includes(d)).length -
      innateDiceSuccesses(target, rolled),
  );
}
function cantTouchThis(state, target, source) {
  return state.fighters.find(
    (f) =>
      f.side === target.side &&
      usable(f) &&
      ((isPower(f, "Can‘t Touch This") &&
        (f.id === target.id || within(f, target, 2))) ||
        (isPower(f, "Wing Shield") && f.id === target.id)) &&
      f.power >= 2 + rootTax(f) &&
      reactiveAllowed(source, f, state),
  );
}
function collide(
  state,
  target,
  source,
  random,
  offerDiamond = true,
  offerDeflection = true,
) {
  if (!usable(target)) return;
  if (
    offerDeflection &&
    isPower(target, "Telekinetic Deflection") &&
    target.power >= 2 + rootTax(target) &&
    reactiveAllowed(source, target, state)
  ) {
    (state.effects ||= []).unshift({
      type: "deflection",
      side: target.side,
      target: target.id,
      source: source?.id,
      offerDiamond,
      cost: 2 + rootTax(target),
    });
    return;
  }
  const acrobaticsCost = 2 + rootTax(target);
  const shadowcat = cantTouchThis(state, target, source);
  if (
    (isPower(target, "Unglaublich Acrobatics") &&
      target.power >= acrobaticsCost &&
      reactiveAllowed(source, target, state)) ||
    shadowcat
  ) {
    const payer = isPower(target, "Unglaublich Acrobatics")
      ? target
      : shadowcat;
    (state.effects ||= []).unshift({
      type: "acrobatic-dodge",
      side: target.side,
      target: target.id,
      source: source?.id,
      payer: payer.id,
      label:
        payer === target && isPower(target, "Unglaublich Acrobatics")
          ? "Unglaublich Acrobatics"
          : (isPower(payer, "Wing Shield")
              ? "Wing Shield"
              : "Can‘t Touch This") +
            " · " +
            payer.name,
      cost: 2 + rootTax(payer),
    });
    return;
  }
  if (
    offerDiamond &&
    isPower(target, "Diamond Form") &&
    target.power >= rootTax(target) &&
    reactiveAllowed(source, target, state)
  ) {
    (state.effects ||= []).unshift({
      type: "diamond-dodge",
      side: target.side,
      target: target.id,
      source: source?.id,
      cost: rootTax(target),
    });
    return;
  }
  const stars =
    isPower(target, "Stars and Garters") &&
    reactiveAllowed(source, target, state)
      ? Math.min(3, target.power - rootTax(target))
      : 0;
  const reflexes = isPower(target, "Supersonic Reflexes");
  const luck =
    isPower(target, "Probability Manipulation") &&
    reactiveAllowed(source, target, state)
      ? target.power - rootTax(target)
      : 0;
  if (stars <= 0 && !reflexes && luck <= 0) {
    dodge(state, target, source, random);
    return;
  }
  const rolled = dice(
    Number(face(target).physicalDefense) + (target.selfDiscovery ? 3 : 0),
    has(target, "hex") ? 0 : 1,
    random,
  );
  if (luck > 0) {
    const failures = rolled.flatMap((d, i) => (d === "failure" ? [i] : []));
    const effect = {
      type: "modify-dice",
      id: "luck-dodge",
      kind: "fixed-face",
      face: "critical",
      explode: !has(target, "hex"),
      label: "Probability Manipulation · Уклонение",
      role: "defense",
      dice: rolled,
      max: Math.min(failures.length, luck),
      variable: true,
      cost: rootTax(target),
      eligible: failures,
      side: target.side,
      collision: { target: target.id, source: source?.id },
    };
    if (failures.length) (state.effects ||= []).unshift(effect);
    else resolveDodge(state, effect, null, random);
    return;
  }
  const eligible = rolled.flatMap((die, index) =>
    die === "failure" ? [] : [index],
  );
  const effect = {
    type: "modify-dice",
    id: stars > 0 ? "stars-dodge" : "supersonic-dodge",
    kind: "reroll",
    label:
      (stars > 0 ? "Stars and Garters" : "Supersonic Reflexes") +
      " · Уклонение",
    role: "defense",
    dice: rolled,
    max: Math.min(eligible.length, stars > 0 ? stars : 2),
    ...(stars > 0 && { variable: true, cost: rootTax(target) }),
    eligible,
    side: target.side,
    collision: { target: target.id, source: source?.id },
  };
  if (eligible.length) (state.effects ||= []).unshift(effect);
  else resolveDodge(state, effect, null, random);
}
function resolveDodge(state, effect, action, random) {
  const target = fighter(state, effect.collision.target);
  const rolled = effect.dice.slice();
  const indices = action?.indices || [];
  if (
    action &&
    (!Array.isArray(indices) ||
      !indices.length ||
      indices.length > effect.max ||
      new Set(indices).size !== indices.length ||
      !indices.every((index) => effect.eligible.includes(index)))
  )
    throw Error("Выберите допустимые кубики.");
  for (const index of indices) rolled[index] = effect.face || faces[random(8)];
  if (effect.explode) for (const _ of indices) rolled.push(faces[random(8)]);
  if (effect.variable && indices.length)
    spend(state, target, effect.cost + indices.length);
  log(state, "Уклонение · " + target.name, {
    side: target.side,
    fighter: target.id,
    rolls: [
      { label: "Уклонение", faces: effect.dice },
      ...(indices.length ? [{ label: "После переброса", faces: rolled }] : []),
    ],
  });
  const observers = failureObservers(state, target, [
    ...effect.dice,
    ...rolled,
  ]);
  damage(
    state,
    target,
    dodgeDamage(target, rolled),
    fighter(state, effect.collision.source),
  );
  grantFailurePower(state, observers);
  totallyMeantIt(state, target, rolled);
}
function resolveAcrobaticDodge(state, effect, use, random) {
  const target = fighter(state, effect.target);
  if (use)
    spend(state, fighter(state, effect.payer || effect.target), effect.cost);
  dodge(state, target, fighter(state, effect.source), random, use ? 2 : 0);
}

function displacement(state, spec, action, random, geometry) {
  const mover = fighter(state, spec.mover),
    source = fighter(state, spec.source);
  const before = { x: mover.x, y: mover.y };
  if (spec.mode === "place" || spec.mode === "advance") {
    const point = { x: action.x, y: action.y };
    const angle =
      (Math.atan2(point.y - mover.y, point.x - mover.x) * 180) / Math.PI;
    const allowed =
      spec.mode === "place"
        ? within(
            spec.reference,
            { ...point, radius: mover.radius },
            spec.range,
          ) && fits(point, mover, state.fighters, state.terrain)
        : allowedAngle(mover, spec.reference, spec.direction, angle) &&
          powerDestination(
            mover,
            { mode: "advance", speed: spec.speed },
            point,
            state,
            geometry,
          );
    if (!allowed) throw Error("Недопустимая точка для эффекта.");
    Object.assign(mover, point);
    if (spec.damage && (mover.x !== before.x || mover.y !== before.y))
      damage(state, mover, spec.damage, source, { attackType: spec.cause });
    return point;
  }
  if (!allowedAngle(mover, spec.reference, spec.direction, action.angle))
    throw Error("Недопустимое направление.");
  const result = toolEnd(
    mover,
    mover,
    state.terrain,
    state.fighters,
    spec.speed,
    action.angle,
    spec.mode === "throw" ? source.id : null,
    spec.breakSize,
  );
  if (result.destroyed)
    state.terrain = state.terrain.filter(
      (piece) => !result.destroyed.includes(piece.id),
    );
  if (fits(result.point, mover, state.fighters, state.terrain))
    Object.assign(mover, result.point);
  if (spec.mode === "throw" && (result.terrain || result.fighter)) {
    const hit = state.terrain.find((p) => p.id === result.terrain);
    if (hit && hit.size < displacementSize(mover))
      state.terrain = state.terrain.filter((p) => p.id !== hit.id);
    if (mover.phasing !== "phased" && !spec.noSelfCollisionDamage)
      damage(state, mover, 1, source);
    if (result.fighter) {
      const target = fighter(state, result.fighter);
      collide(state, target, source, random);
    }
  }
  if (spec.damage && (mover.x !== before.x || mover.y !== before.y))
    damage(state, mover, spec.damage, source);
  if (spec.breakSize) {
    mover.conditions = (mover.conditions || []).filter(
      (name) => name !== "stagger",
    );
    const targets = (result.contacts || []).filter(
      (id) => !mover.juggernautHit?.includes(id) && usable(fighter(state, id)),
    );
    if (targets.length === 1)
      damage(state, fighter(state, targets[0]), 1, mover, {
        juggernautContact: true,
      });
    else if (targets.length)
      (state.effects ||= []).unshift({
        type: "juggernaut-contact",
        side: mover.side,
        source: mover.id,
        targets,
      });
  }
  return result.point;
}
function reroll(rolled, amount, random, role, includeFailure = false) {
  const good =
    role === "defense"
      ? ["block", "wild", "critical"]
      : ["hit", "wild", "critical"];
  const indexes = rolled
    .map((_, i) => i)
    .filter(
      (i) =>
        !good.includes(rolled[i]) &&
        (includeFailure || rolled[i] !== "failure"),
    );
  for (const i of indexes.slice(0, amount)) rolled[i] = faces[random(8)];
}

function beginVolley(state, actor, option, angle, damageType) {
  const targets = option.targets.filter(
    (t) => !t.types || t.types.includes(damageType),
  );
  if (option.shape === "area") return targets.map((t) => t.value);
  if (!Number.isFinite(angle))
    throw Error("Укажите направление луча в градусах.");
  return targets
    .filter((t) =>
      beamReaches(
        option.origin || actor,
        fighter(state, t.value),
        option.range,
        angle,
        damageType,
      ),
    )
    .map((t) => t.value);
}
const rangeOrigin = (actor) => actor.projection || actor;
function attackReaches(state, actor, target, pending) {
  const card = attackCard(actor, pending.index);
  const rules = attackProfile(actor, card);
  const origin = attackOrigin(state, actor, pending.index, card);
  const level = rangeOf(card);
  const ignoreSight =
    rules.ignoreSight || (actor.trickShot && card.name === "Arrow Shot");
  return (
    (shapeOf(card) === "beam" && Number.isFinite(pending.angle)
      ? beamReaches(origin, target, level, pending.angle, pending.damageType)
      : within(origin, target, level) ||
        (pending.damageType === "mystic" &&
          target.projection &&
          within(origin, target.projection, level))) &&
    (ignoreSight ||
      lineOfSight(card.borrowedFrom ? origin : actor, target, state.terrain)
        .visible)
  );
}
function attackOrigin(state, actor, index, card) {
  if (card.borrowedFrom) return fighter(state, card.borrowedFrom);
  if (index === 102)
    return fighter(state, actor.grantedAttacks?.[102]?.origin) || actor;
  return rangeOrigin(actor);
}
function finishVolley(actor, index) {
  if (index === 102) delete actor.grantedAttacks[102];
  if (attackProfile(actor, attackCard(actor, index)).volleyReward) {
    gain(actor, 1);
    addSample(actor);
  }
}
const fighter = (state, id) => state.fighters.find((f) => f.id === id);

function gain(fighter, amount) {
  if (fighter.grunt) return;
  fighter.power = Math.min(
    10,
    fighter.power + (has(fighter, "stun") ? Math.min(1, amount) : amount),
  );
}

function condition(fighter, name) {
  if (!usable(fighter) || has(fighter, name)) return;
  const immune = face(fighter).superPowers?.some((p) =>
    p.name
      .match(/Immun(?:e|ity) \[([^\]]+)\]/i)?.[1]
      .toLowerCase()
      .split(/,\s*/)
      .includes(name),
  );
  if (!immune) (fighter.conditions ||= []).push(name);
}

function dropObjectives(state, target) {
  for (const obj of state.objectives.filter(
    (obj) => obj.holder === target.id,
  )) {
    obj.holder = null;
    obj.x = target.x;
    obj.y = target.y;
    (state.drops ||= []).push({
      id: obj.id,
      origin: { x: target.x, y: target.y, radius: target.radius },
      side: power(target, "All that Matters is the Mission")
        ? target.side
        : target.side === "p1"
          ? "p2"
          : "p1",
    });
  }
}

const sisters = { "Big Sis": "honey-badger", "Lil‘ Sis": "x-23" };
function sisterAdvance(state, target, source) {
  for (const f of state.fighters) {
    const power = Object.keys(sisters).find(
      (name) => sisters[name] === target.slug && isPower(f, name),
    );
    if (
      !power ||
      f.side !== target.side ||
      f.id === target.id ||
      !usable(f) ||
      !within(f, target, 3) ||
      state.reactionUses?.includes(f.id + ":sister")
    )
      continue;
    (state.reactionUses ||= []).push(f.id + ":sister");
    (state.effects ||= []).push({
      type: "displace",
      mode: "advance",
      speed: "M",
      direction: "toward",
      side: f.side,
      mover: f.id,
      source: f.id,
      name: power,
      reference: { x: source.x, y: source.y, radius: source.radius },
    });
  }
}
function damage(
  state,
  target,
  amount,
  source,
  {
    noPower = false,
    reviewed = false,
    gainIfDeferred,
    followAdvance,
    juggernautContact = false,
    attackType,
  } = {},
) {
  if (!usable(target) || amount <= 0) return 0;
  const enemy = source && source.side !== target.side;
  if (enemy && target.survival) return 0;
  const cost = 1 + rootTax(target);
  if (
    !reviewed &&
    isPower(target, "Nice Punch...") &&
    target.power >= cost &&
    reactiveAllowed(source, target, state)
  ) {
    (state.effects ||= []).unshift({
      type: "nice-punch",
      side: target.side,
      target: target.id,
      source: source?.id,
      amount,
      cost,
      noPower,
      gainIfDeferred,
      followAdvance,
      juggernautContact,
    });
    return null;
  }
  if (
    enemy &&
    (power(target, "I Can Take It") ||
      power(target, "Kree-Mutant Physiology") ||
      power(target, "Organic Steel") ||
      power(target, "Carbonadium Armor") ||
      power(target, "Carborundum Matrix Alloy"))
  )
    amount = Math.max(1, amount - 1);
  const maximum = Number(face(target).stamina);
  const dealt = Math.min(amount, maximum - (target.damage || 0));
  if (dealt && juggernautContact) (source.juggernautHit ||= []).push(target.id);
  target.damage = (target.damage || 0) + dealt;
  if (dealt && enemy && attackType === "mystic" && target.projection) {
    delete target.projection;
    log(state, "Astral Fiend · Projection снята", {
      side: target.side,
      fighter: target.id,
    });
  }
  if (enemy && !noPower && !has(target, "judgment")) gain(target, dealt);
  if (dealt && enemy && source?.x != null) sisterAdvance(state, target, source);
  if (
    dealt &&
    target.damage < Number(face(target).stamina) &&
    isPower(target, "Red Guardian‘s Suit")
  )
    gain(target, 1);
  if (dealt && enemy)
    for (const [dupe, side] of [
      [target, target.side],
      [source, source?.side],
    ])
      if (dupe?.slug === duplicates)
        for (const madrox of state.fighters.filter(
          (f) =>
            f.side === side &&
            usable(f) &&
            isPower(f, "Shared Experiences") &&
            (dupe.x == null || within(f, dupe, 3)),
        ))
          gain(madrox, 1);
  if (
    dealt &&
    usable(target) &&
    isPower(target, "Kinetic Duplication") &&
    target.damage < Number(face(target).stamina) &&
    !state.fighters.some(
      (f) => f.slug === duplicates && f.side === target.side && usable(f),
    ) &&
    !state.effects?.some(
      (e) => e.type === "spawn-drones" && e.side === target.side,
    )
  ) {
    const card = pool.characters[duplicates];
    (state.effects ||= []).push({
      type: "spawn-drones",
      mode: "place",
      side: target.side,
      model: {
        id: target.side + ":" + duplicates,
        side: target.side,
        slug: duplicates,
        name: card.name,
        size: card.size,
        speed: card.speed,
        radius: card.baseSize / 50.8,
        power: 0,
        grunt: true,
        activated: false,
        x: null,
        y: null,
      },
      name: card.name,
      range: 2,
      reference: { x: target.x, y: target.y, radius: target.radius },
    });
  }
  if (
    dealt &&
    enemy &&
    attackType === "physical" &&
    usable(target) &&
    isPower(target, "Kinetic Energy Absorption")
  ) {
    gain(target, 1);
    (state.effects ||= []).push({
      type: "displace",
      mode: "advance",
      speed: "S",
      side: target.side,
      mover: target.id,
      source: target.id,
      name: "Kinetic Energy Absorption",
    });
  }
  if (
    dealt &&
    enemy &&
    attackType === "mystic" &&
    usable(target) &&
    isPower(target, "Get Out of my Head!") &&
    !state.reactionUses?.includes(target.id + ":head")
  ) {
    (state.reactionUses ||= []).push(target.id + ":head");
    for (const ally of state.fighters.filter(
      (f) =>
        f.id !== target.id &&
        f.side === target.side &&
        usable(f) &&
        within(f, target, 3),
    )) {
      damage(state, ally, 1, target, { reviewed: true });
      gain(ally, 1);
    }
    log(state, "Get Out of my Head! · " + target.name, {
      side: target.side,
      fighter: target.id,
    });
  }
  if (
    target.damage === maximum &&
    target.flares &&
    isPower(target, "Flare State")
  ) {
    const reach = target.flares;
    target.flares = 0;
    log(state, "Flare State · " + target.name + " · Range " + reach, {
      side: target.side,
      fighter: target.id,
    });
    for (const f of state.fighters.filter(
      (f) => f.side !== target.side && usable(f) && within(f, target, reach),
    ))
      damage(state, f, 1, target);
  }
  if (target.damage === maximum) {
    if (!target.grunt)
      for (const phoenix of state.fighters.filter(
        (f) =>
          f.id !== target.id &&
          f.side === target.side &&
          !f.ko &&
          f.x != null &&
          (isPower(f, "I Am Fire and Life Incarnate") ||
            isPower(f, "Untamed Cosmic Entity")),
      ))
        phoenix.phoenix = (phoenix.phoenix || 0) + 1;
    if (
      source &&
      source.side !== target.side &&
      source.phoenix &&
      isPower(source, "Untamed Cosmic Entity")
    )
      source.phoenix -= 1;
    if (!target.injured && isPower(target, "I Am Fire and Life Incarnate"))
      target.phoenix = (target.phoenix || 0) + 3;
    if (target.injured && isPower(target, "Untamed Cosmic Entity")) {
      phoenixExplosion(state, target, state.rng || randomInt);
      return dealt;
    }
  }
  if (
    target.damage === maximum &&
    (target.injured || target.grunt) &&
    isPower(target, "Aimless Aggression")
  ) {
    const rolled = rawDice(5, state.rng || randomInt);
    const hits = rolled.filter((d) => d === "critical" || d === "wild").length;
    log(state, "Aimless Aggression · " + target.name, {
      side: target.side,
      fighter: target.id,
      rolls: [{ label: "Aimless Aggression", faces: rolled }],
    });
    if (hits)
      for (const f of state.fighters.filter(
        (f) => f.id !== target.id && usable(f) && within(f, target, 2),
      ))
        damage(state, f, hits, target);
  }
  if (target.damage === maximum) {
    target.ko = !!target.injured || !!target.grunt;
    target.dazed = !target.ko;
    dropObjectives(state, target);
    if (target.ko) {
      if (target.grunt) removeGrunt(state, target, source);
      else {
        target.x = target.y = null;
        if (target.slug === "ultron-metal-tyrant")
          for (const drone of state.fighters.filter(
            (f) => f.grunt && f.side === target.side && !f.ko,
          ))
            removeGrunt(state, drone, source);
      }
    }
    if (target.dazed && target.slug === "ultron-metal-tyrant")
      for (const drone of state.fighters.filter(
        (f) => f.grunt && f.side === target.side,
      ))
        drone.activated = true;
  }
  const curse = dealt > 0 && enemy && usable(target) && power(target, "Curse");
  if (curse && usable(source) && reactiveAllowed(source, target, state)) {
    const cost = Number(curse.powerCost) + rootTax(target);
    if (target.power >= cost)
      (state.effects ||= []).push({
        type: "curse",
        side: target.side,
        source: target.id,
        target: source.id,
        cost,
      });
  }
  if (dealt && followAdvance && usable(target))
    (state.effects ||= []).push(followAdvance);
  return dealt;
}

function removeGrunt(state, drone, source) {
  const origin = { x: drone.x, y: drone.y, radius: drone.radius };
  drone.ko = true;
  drone.x = drone.y = null;
  if (
    source &&
    source.side !== drone.side &&
    !reactiveAllowed(source, drone, state)
  )
    return;
  const ultron = state.fighters.find(
    (f) =>
      f.slug === "ultron-metal-tyrant" && f.side === drone.side && usable(f),
  );
  if (drone.slug !== "ultron-drones-grunts") return;
  let dealt = 0;
  for (const enemy of state.fighters.filter(
    (f) => usable(f) && f.side !== drone.side && within(f, origin, 2),
  ))
    dealt += damage(state, enemy, 1, drone, { gainIfDeferred: ultron?.id });
  if (ultron) gain(ultron, dealt);
}

function resolveNicePunch(state, effect, use) {
  const target = fighter(state, effect.target);
  if (!usable(target)) return;
  if (use) spend(state, target, effect.cost);
  const dealt = damage(
    state,
    target,
    effect.amount - Number(use),
    fighter(state, effect.source),
    {
      noPower: effect.noPower,
      reviewed: true,
      juggernautContact: effect.juggernautContact,
      followAdvance: effect.followAdvance,
    },
  );
  log(state, target.name + " · " + dealt + " урона", {
    side: target.side,
    fighter: target.id,
  });
  const recipient = fighter(state, effect.gainIfDeferred);
  if (recipient && dealt) gain(recipient, dealt);
}

function transformModel(f, form) {
  const next = { ...f, form };
  const card = face(next);
  const data = pool.characters[f.slug];
  return {
    ...next,
    size: Number(card.size),
    speed: card.speed,
    radius:
      (form ? data.secondFormBaseSize || data.baseSize : data.baseSize) / 50.8,
  };
}

function movementModel(fighter) {
  return isPower(fighter, "Flight") ||
    fighter.sunburnFlight ||
    isPower(fighter, "Wall Crawler") ||
    isPower(fighter, "Wallcrawler")
    ? { ...fighter, climbsOnAdvance: true }
    : fighter;
}

function status(f) {
  const card = face(f);
  return {
    climbsOnAdvance: !!movementModel(f).climbsOnAdvance,
    interactRange: interactRange(f),
    hp: Math.max(0, Number(card.stamina) - (f.damage || 0)),
    maxHp: Number(card.stamina),
    defenses: Object.fromEntries(
      ["physical", "energy", "mystic"].map((k) => [
        k,
        Number(card[k + "Defense"]),
      ]),
    ),
    conditions: f.conditions || [],
    attacks: (card.attacks || []).map((a) => ({
      ...a,
      implemented: !!attackProfile(f, a) && !!rangeOf(a),
    })),
    powers: (card.superPowers || []).map((p) => ({
      ...p,
      range: activePowers[p.name]?.range,
      placement: activePowers[p.name]?.mode === "place",
      implemented:
        !!activePowers[p.name] ||
        [
          "Perfect Block",
          "Fast Draw",
          "Rapid Phase",
          "Calculated Risk",
          "Curse",
          "Can‘t Catch Me",
          "Polarity Shielding",
          "Slippery",
          "Ha, Ha, Ha, That Tickles!",
          "Nice Punch...",
          "Hulk Not Puny Banner",
          "I Am Iron Man",
          "Molecular Regeneration",
          "J.A.R.V.I.S.",
          "Untamed Force",
          "Kill Box",
          "Beware Falling Debris",
          "A Little Something Extra",
          "Enhanced Agility",
          "Big Brother",
          "Bozhe Moi",
          "Telekinetic Shield",
          "Diamond Form",
          "Shield Mind",
          "Nightmare Visions",
          "Stars and Garters",
          "Quick Draw",
          "Puff of Smoke",
          "Unglaublich Acrobatics",
          "Ice Slide",
          "Air Lift",
          "Hostile Takeover",
          "I Don‘t Need a Powerup to Kick Your Butt",
          "Rough Around the Edges",
        ].includes(p.name),
    })),
  };
}

function attacks(state, actor, previous) {
  const targets = state.fighters.filter(
    (f) => f.side !== actor.side && usable(f),
  );
  const entries =
    previous?.kind === "borrowed"
      ? Object.entries(actor.borrowedAttacks || {}).map(([index, attack]) => [
          Number(index),
          attack,
        ])
      : (face(actor).attacks || []).map((attack, index) => [index, attack]);
  if (
    previous?.kind !== "borrowed" &&
    !actor.montesiUsed &&
    state.objectives.some(
      (o) => o.holder === actor.id && o.name === "Spellbook",
    )
  )
    entries.push([100, grantedAttacks[100]]);
  for (const id of [101, 102, 103])
    if (previous?.kind !== "borrowed" && actor.grantedAttacks?.[id])
      entries.push([id, grantedAttacks[id]]);
  return entries.flatMap(([index, attack]) => {
    const rules = attackProfile(actor, attack);
    if (
      !rules ||
      !rangeOf(attack) ||
      ((!previous || previous.kind === "flurry") &&
        Number(attack.powerCost) > availablePower(state, actor)) ||
      (previous &&
        !["borrowed", "flurry"].includes(previous.kind) &&
        previous.index !== index)
    )
      return [];
    const origin = attackOrigin(state, actor, index, attack);
    const types = rules.types || [attack.type];
    const trick =
      (actor.trickShot && attack.name === "Arrow Shot") || rules.ignoreSight;
    const options = targets
      .filter((target) => {
        if (target.id === attack.borrowedFrom) return false;
        if (isPower(target, "Telepathic Cloak") && !within(actor, target, 3))
          return false;
        if (previous?.kind === "flurry" && target.id !== previous.target)
          return false;
        if (
          (power(target, "Stealth") ||
            isPower(target, "Goddess of Storms") ||
            (isPower(target, "Invisible in Shadow") &&
              state.terrain.some(
                (piece) =>
                  piece.size >= 2 &&
                  distanceToTerrain(target, piece) <= range[1],
              ))) &&
          !within(actor, target, 3)
        )
          return false;
        if (
          !trick &&
          !lineOfSight(
            attack.borrowedFrom ? origin : actor,
            target,
            state.terrain,
          ).visible
        )
          return false;
        if (previous?.kind === "rapid") return target.id === previous.target;
        if (previous?.kind === "salvo") return target.id !== previous.target;
        if (
          ["velocity", "speed-of-sight"].includes(previous?.kind) &&
          target.id === previous.target
        )
          return false;
        if (previous?.kind === "bounce")
          return (
            target.id !== previous.target && within(previous.origin, target, 3)
          );
        if (previous?.kind === "frontliner")
          return (
            target.id !== previous.target &&
            within(actor, target, rangeOf(attack))
          );
        if (previous?.kind === "reality")
          return (
            !actor.realityTargets?.includes(target.id) &&
            within(previous.origin, target, 2)
          );
        return (
          origin &&
          (within(origin, target, rangeOf(attack)) ||
            (types.includes("mystic") &&
              target.projection &&
              within(origin, target.projection, rangeOf(attack))))
        );
      })
      .map((target) => ({
        value: target.id,
        label: target.name,
        ...(target.projection &&
          !within(origin, target, rangeOf(attack)) && { types: ["mystic"] }),
      }));
    return options.length
      ? [
          {
            index,
            name: attack.name,
            shape: shapeOf(attack),
            ...(origin !== actor && {
              origin: { x: origin.x, y: origin.y, radius: origin.radius },
            }),
            range: rangeOf(attack),
            cost: Number(attack.powerCost),
            payers:
              actor.slug === "red-skull-master-of-the-world"
                ? state.fighters
                    .filter(
                      (f) =>
                        f.id !== actor.id &&
                        f.side === actor.side &&
                        usable(f) &&
                        within(actor, f, 3) &&
                        f.power >= Number(attack.powerCost),
                    )
                    .map((f) => ({ value: f.id, label: f.name }))
                : [],
            sampleBoost: !!rules.sampleBoost && (actor.samples ?? 1) > 0,
            flareMax: isPower(actor, "Thermokinesis") ? actor.flares || 0 : 0,
            boostMax: rules.boost
              ? Math.max(
                  0,
                  Math.min(rules.boost, actor.power - Number(attack.powerCost)),
                )
              : 0,
            types,
            targets: options,
          },
        ]
      : [];
  });
}

const limitedExtracts = ["Power Core", "Senator", "Spellbook"];
function canHoldExtract(state, actor, token) {
  return (
    token.role === "extract" &&
    !isPower(actor, "Wild Rage") &&
    !isPower(actor, "Savagery Protocols") &&
    !isPower(actor, "Berserker Wrath") &&
    (!limitedExtracts.includes(token.name) ||
      !state.objectives.some(
        (o) => o.holder === actor.id && o.name === token.name,
      ))
  );
}
function interactRange(fighter) {
  return isPower(fighter, "Wild Rage")
    ? 0
    : isPower(fighter, "Prehensile Tongue")
      ? 2
      : 1;
}

function powers(state, actor) {
  return (face(actor).superPowers || []).flatMap((card) => {
    const base = activePowers[card.name];
    const settings = base?.flareLimit
      ? { ...base, enemy: actor.flares || 0, terrain: actor.flares || 0 }
      : base;
    const spendable = availablePower(state, actor) - rootTax(actor);
    const cost =
      (settings?.variableCost ? 1 : Number(card.powerCost)) +
      rootTax(actor) +
      (settings?.escalatingCost
        ? (state.usedPowers || []).filter((name) => name === card.name).length
        : 0);
    if (
      card.type !== "active" ||
      !settings ||
      availablePower(state, actor) < cost ||
      (settings.action && state.actionsLeft < 1) ||
      (!settings.repeat && state.usedPowers?.includes(card.name))
    )
      return [];
    const targets = [];
    if (settings.mode === "target") {
      if (settings.effect === "borrow-attack") {
        for (const f of state.fighters) {
          const minPower = Number(face(f).mysticDefense);
          if (
            f.side !== actor.side &&
            f.x != null &&
            !f.ko &&
            minPower <= spendable &&
            within(actor, f, settings.range) &&
            face(f).attacks.some((a) => Number(a.powerCost) === 0)
          )
            targets.push({ value: f.id, label: f.name, minPower });
        }
      } else if (settings.effect === "transfer-extract") {
        for (const token of state.objectives) {
          const ally = token.holder && fighter(state, token.holder);
          if (
            ally &&
            ally.id !== actor.id &&
            ally.side === actor.side &&
            usable(ally) &&
            within(actor, ally, settings.range) &&
            canHoldExtract(state, actor, token)
          )
            targets.push({
              value: token.id,
              label: ally.name + " · " + token.name,
            });
        }
      } else if (settings.effect === "purge") {
        if ((actor.samples ?? 1) > 0)
          (actor.conditions || []).forEach((value) =>
            targets.push({ value, label: value }),
          );
      } else {
        if (settings.effect === "root" && !(actor.samples ?? 1)) return [];
        for (const f of state.fighters) {
          if (
            !usable(f) ||
            (settings.activatedTarget &&
              (!f.activated ||
                f.id === actor.id ||
                state.usedPowers?.includes("matter:" + f.id))) ||
            (settings.ally &&
              (f.side !== actor.side ||
                (f.id === actor.id && !settings.self) ||
                state.fieldLeaderMoves?.includes(f.id))) ||
            (!settings.any &&
              !settings.ally &&
              (f.side === actor.side ||
                !settings.enemy ||
                (["push", "throw"].includes(settings.effect)
                  ? displacementSize(f)
                  : f.size) > settings.enemy)) ||
            !within(rangeOrigin(actor), f, settings.range) ||
            (settings.effect === "mouth" && state.mouthRound?.includes(f.id)) ||
            (settings.duplicate && f.slug !== duplicates) ||
            (settings.oncePerTarget &&
              state.usedPowers?.includes(card.name + ":" + f.id)) ||
            (settings.sight && !lineOfSight(actor, f, state.terrain).visible) ||
            (settings.neuralTarget &&
              !within(actor, f, 1) &&
              state.neural?.[actor.id] !== f.id) ||
            (["advance", "push"].includes(settings.effect) &&
              ((f.side !== actor.side && isPower(f, "Metal Mind")) ||
                (f.side !== actor.side && mindShielded(f)) ||
                (settings.effect === "push" &&
                  (f.phasing === "density" ||
                    (f.side !== actor.side && isPower(f, "Organic Steel"))))))
          )
            continue;
          targets.push({ value: f.id, label: f.name });
        }
        for (const piece of state.terrain.filter(
          (p) =>
            p.size <= settings.terrain &&
            (!settings.variableCost || p.size <= spendable) &&
            distanceToTerrain(rangeOrigin(actor), p) <= range[settings.range],
        ))
          targets.push({
            value: piece.id,
            label: piece.name + " · " + piece.size,
            ...(settings.variableCost === "terrain" && {
              minPower: piece.size,
            }),
          });
      }
      if (!targets.length) return [];
    }
    const payers =
      actor.slug === "red-skull-master-of-the-world"
        ? state.fighters
            .filter(
              (f) =>
                f.id !== actor.id &&
                f.side === actor.side &&
                usable(f) &&
                within(actor, f, 3) &&
                f.power >= cost,
            )
            .map((f) => ({ value: f.id, label: f.name }))
        : [];
    return [
      {
        value: card.name,
        label: card.name,
        cost,
        ...settings,
        ...(settings.variableCost && {
          maxPower: ["terrain", "bamf"].includes(settings.variableCost)
            ? Math.min(settings.variableCost === "terrain" ? 4 : 3, spendable)
            : spendable,
          tax: rootTax(actor),
        }),
        ...(targets.length && { targets }),
        payers,
      },
    ];
  });
}

function availablePower(state, actor) {
  return actor.slug === "red-skull-master-of-the-world"
    ? Math.max(
        actor.power,
        ...state.fighters
          .filter(
            (f) => f.side === actor.side && usable(f) && within(actor, f, 3),
          )
          .map((f) => f.power),
      )
    : actor.power;
}
function payerFor(state, actor, cost, payer) {
  const payerModel =
    payer && payer !== actor.id ? fighter(state, payer) : actor;
  if (
    !payerModel ||
    (payerModel !== actor &&
      (actor.slug !== "red-skull-master-of-the-world" ||
        payerModel.side !== actor.side ||
        !usable(payerModel) ||
        !within(actor, payerModel, 3))) ||
    payerModel.power < cost
  )
    throw Error("Недостаточно Power у выбранного персонажа.");
  return payerModel;
}
function pay(state, actor, cost, payer) {
  payerFor(state, actor, cost, payer).power -= cost;
}
const leadershipRerolls = ["avengers", "shield-rolled", "shield-defense"];
const xavierSchool = "Xavier's School for Gifted Youngsters";
// Power spent on an active or reactive superpower. Xavier's School lets
// another ally gain 1 Power once per Turn after that effect is resolved.
function spend(state, model, amount, superpower = true) {
  model.power -= amount;
  const side = model.side;
  if (
    !superpower ||
    amount < 1 ||
    !leadership(state, side, xavierSchool) ||
    state.leadershipUses?.[side]?.includes("xavier") ||
    !xavierTargets(state, model).length
  )
    return;
  (state.leadershipUses ||= { p1: [], p2: [] })[side].push("xavier");
  (state.effects ||= []).push({
    type: "xavier-school",
    side,
    source: model.id,
  });
}
function xavierTargets(state, spender) {
  return state.fighters.filter(
    (f) =>
      f.id !== spender.id && f.side === spender.side && usable(f) && !f.grunt,
  );
}

function throwTerrain(state, effect, angle, random) {
  if (!Number.isFinite(angle)) throw Error("Укажите направление броска.");
  const piece = state.terrain.find((p) => p.id === effect.piece);
  const actor = fighter(state, effect.source);
  if (!piece || !usable(actor)) return;
  const result = terrainThrowPath(
    actor,
    piece.id,
    state.terrain,
    state.fighters,
    effect.speed,
    angle,
  );
  state.terrain = state.terrain.filter((p) => p.id !== piece.id);
  const hit = state.terrain.find((p) => p.id === result.terrain);
  if (hit && hit.size < piece.size)
    state.terrain = state.terrain.filter((p) => p.id !== hit.id);
  if (result.fighter) {
    const target = fighter(state, result.fighter);
    collide(state, target, actor, random);
  }
}

function usePower(state, actor, selected, action, random) {
  if (selected.action) state.actionsLeft--;
  spend(
    state,
    payerFor(state, actor, selected.cost, action.payer),
    selected.cost,
  );
  if (selected.value === "Telekinetic Combat Enhancement") actor.apexDice = 2;
  switch (selected.value) {
    case "Trick Shot":
      actor.trickShot = true;
      return;
    case "Sunburn": {
      const blaze = (actor.flares || 0) >= 3;
      if (blaze) actor.sunburnFlight = true;
      state.effects.push(
        {
          type: "displace",
          mode: "advance",
          speed: blaze ? "L" : actor.speed,
          side: actor.side,
          mover: actor.id,
          source: actor.id,
          name: "Sunburn",
          required: true,
        },
        { type: "granted-attack", side: actor.side, source: actor.id },
      );
      return;
    }
    case "Transmode Virus Infection":
    case "Death Factor":
      for (const f of [
        actor,
        ...state.fighters.filter(
          (f) =>
            f.side !== actor.side &&
            usable(f) &&
            has(f, "poison") &&
            within(actor, f, 2),
        ),
      ])
        damage(state, f, 2, actor);
      return;
    case "Synthesis":
    case "Overcharge Capacitors":
    case "Cosmic Energy Absorption":
      gain(actor, 2);
      return;
    case "No Mercy":
      actor.noMercy = true;
      return;
    case "Stoke the Flames":
    case "Eye of the Storm":
      actor.stokeFlames = (actor.stokeFlames || 0) + 2;
      return;
    case "Nothing Stops the Juggernaut!":
      state.effects.push(juggernautPush(actor));
      return;
    case "Follow the Leads":
      state.effects.push({
        type: "displace",
        mode: "throw",
        speed: "S",
        side: actor.side,
        mover: actor.id,
        source: actor.id,
        name: "Follow the Leads",
        required: true,
      });
      return;
    case "Primal Pounce":
      state.effects.push({
        type: "displace",
        mode: "throw",
        speed: "M",
        side: actor.side,
        mover: actor.id,
        source: actor.id,
        name: "Primal Pounce",
        required: true,
        noSelfCollisionDamage: true,
      });
      return;
    case "Stop Squealing and Die":
      actor.apexDice = (actor.apexDice || 0) + 3;
      return;
    case "Astral Fiend":
      actor.projection = projectionAt(action, rangeOrigin(actor));
      return;
    case "Immortal Essence":
      heal(state, actor, 3);
      return;
    case "BAMF!":
    case "Limbo Step":
      state.effects.push({
        type: "displace",
        mode: "place",
        range: selected.cost - selected.tax,
        side: actor.side,
        mover: actor.id,
        source: actor.id,
        name: selected.value,
        required: true,
        reference: { x: actor.x, y: actor.y, radius: actor.radius },
      });
      return;
    case "Speedster":
      dropObjectives(state, actor);
      state.afterDrops = {
        type: "displace",
        mode: "advance",
        speed: "L",
        side: actor.side,
        mover: actor.id,
        source: actor.id,
        name: "Speedster",
        required: true,
      };
      if (!state.drops?.length) {
        state.effects.push(state.afterDrops);
        delete state.afterDrops;
      }
      return;
  }
  if (selected.mode === "place" || selected.mode === "advance") {
    Object.assign(actor, { x: action.x, y: action.y });
    return;
  }
  if (selected.mode === "sequence") {
    state.effects.push(
      ...selected.order.map((kind) => ({
        type: kind === "move" ? "granted-move" : "granted-attack",
        side: actor.side,
        source: actor.id,
        ...(kind === "attack" && selected.doubleWild && { doubleWild: true }),
        ...(kind === "attack" &&
          selected.attackName && {
            index: face(actor).attacks.findIndex(
              (a) => a.name === selected.attackName,
            ),
            throwAfter: !!selected.throwAfter,
          }),
        ...(kind === "move" &&
          selected.moveSizeFive && { climbsOnAdvance: true }),
      })),
    );
    return;
  }
  const target = fighter(state, action.target);
  const terrain = state.terrain.find((p) => p.id === action.target);
  if (selected.oncePerTarget)
    (state.usedPowers ||= []).push(selected.value + ":" + action.target);
  if (selected.value === "Figment of Fantasy" && state.neural)
    delete state.neural[actor.id];
  if (selected.value === "Field Leader")
    (state.fieldLeaderMoves ||= []).push(target.id);
  if (selected.value === "Matter Transmutation")
    (state.usedPowers ||= []).push("matter:" + target.id);
  if (selected.effect === "rejuvenate") {
    heal(state, target, 2);
    const remove =
      action.condition && target.conditions?.includes(action.condition)
        ? action.condition
        : target.conditions?.[0];
    if (remove)
      target.conditions = target.conditions.filter((c) => c !== remove);
    return;
  }
  if (selected.effect === "reabsorb") {
    const token = state.objectives.find(
      (o) => o.holder === target.id && o.role === "extract",
    );
    if (token && canHoldExtract(state, actor, token)) token.holder = actor.id;
    else if (token) delete token.holder;
    removeGrunt(state, target);
    heal(state, actor, 3);
    return;
  }
  if (selected.effect === "mouth") {
    target.power = Math.max(0, target.power - 2);
    (state.mouthRound ||= []).push(target.id);
    return;
  }
  if (selected.effect === "absorb-terrain") {
    state.terrain = state.terrain.filter((p) => p.id !== terrain.id);
    heal(state, actor, terrain.size);
    return;
  }
  if (selected.effect === "firewall") {
    condition(target, "root");
    condition(target, "slow");
  } else if (selected.effect === "borrow-attack") {
    actor.borrowedAttacks = Object.fromEntries(
      face(target)
        .attacks.filter((a) => Number(a.powerCost) === 0)
        .map((a, index) => [
          104 + index,
          {
            name: a.name,
            range: a.range,
            strength: a.strength,
            type: a.type,
            powerCost: 0,
            borrowedFrom: target.id,
          },
        ]),
    );
    state.effects.push({ type: "borrowed-attack", side: actor.side });
  } else if (selected.effect === "telepathic-lash") {
    const rolled = rawDice(3, random);
    const amount = rolled.filter((die) =>
      ["critical", "wild", "hit"].includes(die),
    ).length;
    const followAdvance = moveEvent(
      { mode: "advance", speed: "S", required: true },
      actor,
      target,
      "superpower",
    );
    damage(state, target, amount, actor, { followAdvance });
    failurePower(state, actor, rolled);
    log(state, "Telepathic Lash · " + target.name, {
      side: actor.side,
      fighter: actor.id,
      target: target.id,
      rolls: [{ label: "Telepathic Lash", faces: rolled }],
    });
  } else if (selected.effect === "transfer-extract") {
    state.objectives.find((o) => o.id === action.target).holder = actor.id;
  } else if (selected.effect === "absorb-power") {
    const rolled = rawDice(5, random);
    const successes = rolled.filter((die) =>
      ["critical", "wild", "hit"].includes(die),
    ).length;
    const lost = Math.min(target.power, successes);
    target.power -= lost;
    const dealt = damage(state, target, successes - lost, actor, {
      noPower: true,
    });
    failurePower(state, actor, rolled);
    log(
      state,
      "Mutant Absorption · " +
        target.name +
        " · −" +
        lost +
        " Power" +
        (dealt == null ? "" : " · " + dealt + " урона"),
      {
        side: actor.side,
        fighter: actor.id,
        target: target.id,
        rolls: [{ label: "Mutant Absorption", faces: rolled }],
      },
    );
  } else if (selected.effect === "purge") {
    actor.samples = (actor.samples ?? 1) - 1;
    actor.conditions = actor.conditions.filter((c) => c !== action.target);
    if (actor.samples && actor.conditions.length)
      state.effects.push({ type: "purge", side: actor.side, actor: actor.id });
  } else if (selected.effect === "root") {
    actor.samples = (actor.samples ?? 1) - 1;
    condition(target, "root");
  } else if (selected.effect === "sabotage") {
    for (const f of state.fighters.filter(
      (f) =>
        usable(f) &&
        f.side !== actor.side &&
        distanceToTerrain(f, terrain) <= range[1],
    )) {
      damage(state, f, 2, actor);
    }
    state.terrain = state.terrain.filter((p) => p !== terrain);
  } else if (terrain) {
    state.effects.push({
      type: "throw-terrain",
      side: actor.side,
      piece: terrain.id,
      source: actor.id,
      name: terrain.name,
      speed: selected.speed,
    });
  } else {
    state.effects.push({
      type: "displace",
      side: actor.side,
      mover: target.id,
      name: target.name,
      source: actor.id,
      mode: selected.effect,
      cause: "superpower",
      direction: selected.direction,
      speed: selected.speed,
      range: selected.destinationRange,
      required: true,
      reference: selected.referenceActor
        ? { x: actor.x, y: actor.y, radius: actor.radius }
        : { x: target.x, y: target.y, radius: target.radius },
    });
  }
}

function juggernautPush(actor) {
  return {
    type: "displace",
    mode: "push",
    speed: "S",
    side: actor.side,
    mover: actor.id,
    source: actor.id,
    name: "Nothing Stops the Juggernaut!",
    breakSize: 3,
  };
}
function powerDestination(actor, move, point, state, geometry) {
  if (move.effect === "projection")
    return geometry.projectionAt(point, rangeOrigin(actor));
  if (move.mode === "place")
    return (
      within(actor, { ...point, radius: actor.radius }, move.range) &&
      fits(point, actor, state.fighters, state.terrain)
    );
  return geometry
    .movement(
      { ...movementModel(actor), speed: move.speed },
      "advance",
      state.fighters,
      state.terrain,
    )
    .route(point);
}

function reactiveAllowed(actor, defender, state) {
  const active = state ? fighter(state, state.active) : actor;
  return (
    !defender.survival &&
    !(
      active &&
      usable(active) &&
      active.side !== defender.side &&
      ["Shapeshifter", "Power Inhibition", "Brain Fog"].some((name) =>
        isPower(active, name),
      )
    )
  );
}
const rootTax = (f) => Number(has(f, "root") || false);
function targetReactions(state, actor, target, pending = {}) {
  if (!reactiveAllowed(actor, target, state)) return [];
  const options = [];
  if (
    pending.damageType &&
    pending.damageType !== "mystic" &&
    isPower(target, "Unglaublich Acrobatics") &&
    target.power >= 2 + rootTax(target)
  )
    options.push({
      value: "acrobatic-defense",
      label: "Unglaublich Acrobatics · " + (2 + rootTax(target)) + " Power",
    });
  if (
    isPower(target, "Quick Draw") &&
    target.power >= 2 + rootTax(target) &&
    !within(actor, target, 2)
  )
    options.push({
      value: "quick-draw",
      label: "Quick Draw · " + (2 + rootTax(target)) + " Power",
      cost: 2 + rootTax(target),
    });
  if (isPower(target, "Diamond Form") && target.power >= rootTax(target))
    options.push({
      value: "diamond-form",
      label: "Diamond Form",
      cost: rootTax(target),
    });
  const evasionCost = 3 + rootTax(target);
  if (
    isPower(target, "Can‘t Catch Me") &&
    target.power >= evasionCost &&
    !state.reactionUses?.includes(target.id + ":evasion")
  )
    options.push({
      value: "cant-catch-me",
      label: "Can’t Catch Me · " + evasionCost + " Power",
      cost: evasionCost,
    });
  if (isPower(target, "Perfect Block") && target.power >= 2 + rootTax(target))
    options.push({ value: "Perfect Block", label: "Perfect Block" });
  if (
    !target.injured &&
    pending.damageType &&
    pending.damageType !== "mystic" &&
    isPower(target, "Bozhe Moi") &&
    target.power >= 2 + rootTax(target)
  )
    options.push({
      value: "bozhe-moi",
      label: "Bozhe Moi · " + (2 + rootTax(target)) + " Power",
    });
  if (isPower(target, "Rapid Phase") && target.power >= 2 + rootTax(target))
    options.push(
      { value: "density", label: "Rapid Phase · Enhanced Density" },
      { value: "phased", label: "Rapid Phase · Phased" },
    );
  if (
    isPower(target, "Fast Draw") &&
    target.power >= 1 + rootTax(target) &&
    !within(actor, target, 3)
  ) {
    const attack = attacks(state, target).find(
      (a) =>
        a.name === "Arrow Shot" && a.targets.some((t) => t.value === actor.id),
    );
    if (attack)
      for (const type of attack.types)
        options.push({
          value: "fast-draw:" + type,
          label: "Fast Draw · " + type,
          index: attack.index,
        });
  }
  return options;
}
function leadership(state, side, title) {
  const chosen = state.leaders[side];
  return (
    !!chosen?.split(":").slice(1).join(":").includes(title) &&
    state.fighters.some(
      (f) => f.side === side && !f.ko && f.slug === chosen.split(":")[0],
    )
  );
}
function rawDice(count, random) {
  return Array.from({ length: Math.max(1, count) }, () => faces[random(8)]);
}
function failureObservers(state, roller, rolled) {
  if (!rolled.includes("failure")) return [];
  const observers = state.fighters
    .filter(
      (f) =>
        f.side !== roller.side &&
        usable(f) &&
        isPower(f, "Try a Little Harder Next Time") &&
        within(f, roller, 3),
    )
    .map((f) => f.id);
  if (isPower(roller, "Disconcerting, Yet Provocative!"))
    observers.push(roller.id);
  return observers;
}
function grantFailurePower(state, recipients) {
  for (const id of recipients) {
    const recipient = fighter(state, id);
    if (!recipient || !usable(recipient)) continue;
    gain(recipient, 1);
    const power = isPower(recipient, "Disconcerting, Yet Provocative!")
      ? "Disconcerting, Yet Provocative!"
      : "Try a Little Harder Next Time";
    log(state, power + " · +1 Power", {
      side: recipient.side,
      fighter: id,
    });
  }
}
function failurePower(state, roller, rolled) {
  grantFailurePower(state, failureObservers(state, roller, rolled));
}
function recordFailure(state, pending, role, roller, rolled) {
  const observers = failureObservers(state, roller, rolled);
  if (!observers.length) return;
  const observed = (pending.failureObservers ||= {});
  observed[role] = [...new Set([...(observed[role] || []), ...observers])];
}
function dice(count, criticals, random, initial = rawDice(count, random)) {
  const bonus =
    initial.filter((value) => value === "critical").length * criticals;
  return initial.concat(Array.from({ length: bonus }, () => faces[random(8)]));
}
const sides = ["p1", "p2"];
function modEvent(state, pending, rolled, defense, actor, target, rules) {
  const reviewed = pending.reviewed || [];
  const candidate = (id, side, data) =>
    reviewed.includes(id)
      ? null
      : {
          type: "modify-dice",
          id,
          side,
          ...data,
          resume: { ...pending, rolls: { rolled, defense } },
        };
  if (
    !rules.fixedPool &&
    isPower(actor, "A Little Something Extra") &&
    reactiveAllowed(target, actor, state) &&
    actor.power >= 1 + rootTax(actor) &&
    rolled.includes("hit")
  ) {
    const option = candidate("something-extra", actor.side, {
      label: "A Little Something Extra",
      dice: rolled,
      max: 1,
      kind: "fixed-face",
      face: "wild",
      cost: 1 + rootTax(actor),
      payer: actor.id,
      role: "rolled",
      eligible: rolled.flatMap((die, index) => (die === "hit" ? [index] : [])),
    });
    if (option) return option;
  }
  if (
    !rules.fixedPool &&
    actor.power >= 1 &&
    rolled.includes("hit") &&
    leadership(state, actor.side, "Mightiest Heroes") &&
    !state.leadershipUses?.[actor.side]?.includes("avengers")
  ) {
    const option = candidate("avengers", actor.side, {
      label: "Earth’s Mightiest Heroes",
      dice: rolled,
      max: 1,
      kind: "change",
      cost: 1,
      payer: actor.id,
      role: "rolled",
      eligible: rolled
        .map((d, i) => (d !== "failure" ? i : -1))
        .filter((i) => i >= 0),
    });
    if (option) return option;
  }
  for (const [model, role, values] of [
    [actor, "rolled", rolled],
    [target, "defense", defense],
  ]) {
    if (rules.lockDefense && role === "defense") continue;
    if (rules.fixedPool && role === "rolled") continue;
    const eligible = values
      .map((die, i) => (die !== "failure" ? i : -1))
      .filter((i) => i >= 0);
    if (
      eligible.length &&
      model.power > 0 &&
      leadership(state, model.side, "Get You An Upgrade")
    ) {
      const option = candidate("shield-" + role, model.side, {
        label: "Let’s Get You An Upgrade",
        dice: values,
        max: 1,
        kind: "reroll",
        cost: 1,
        payer: model.id,
        role,
        eligible,
      });
      if (option) return option;
    }
    if (role === "rolled" && eligible.length) {
      const iron = state.fighters.find(
        (f) =>
          f.id !== actor.id &&
          f.side === actor.side &&
          usable(f) &&
          reactiveAllowed(target, f, state) &&
          isPower(f, "J.A.R.V.I.S.") &&
          within(f, actor, 4) &&
          f.power > rootTax(f),
      );
      if (iron) {
        const option = candidate("jarvis", model.side, {
          label: "J.A.R.V.I.S.",
          dice: values,
          max: Math.min(3, iron.power - rootTax(iron)),
          kind: "reroll",
          cost: rootTax(iron),
          variable: true,
          payer: iron.id,
          role,
          eligible,
        });
        if (option) return option;
      }
    }
    const failures = values.flatMap((d, i) => (d === "failure" ? [i] : []));
    if (
      failures.length &&
      isPower(model, "Probability Manipulation") &&
      reactiveAllowed(model === actor ? target : actor, model, state) &&
      model.power > rootTax(model)
    ) {
      const option = candidate("luck-" + role, model.side, {
        label: "Probability Manipulation",
        dice: values,
        max: Math.min(failures.length, model.power - rootTax(model)),
        kind: "fixed-face",
        face: "critical",
        explode: !has(model, "hex"),
        cost: rootTax(model),
        variable: true,
        payer: model.id,
        role,
        eligible: failures,
      });
      if (option) return option;
    }
    const wildCount = values.filter((d) => d === "wild").length;
    const dispersible = values.flatMap((d, i) =>
      ["blank", "failure", "block"].includes(d) ? [i] : [],
    );
    if (
      role === "rolled" &&
      wildCount &&
      dispersible.length &&
      (isPower(model, "Plasma Dispersion") ||
        isPower(model, "Chosen of Apocalypse"))
    ) {
      const option = candidate("dispersion", model.side, {
        label: isPower(model, "Plasma Dispersion")
          ? "Plasma Dispersion"
          : "Chosen of Apocalypse",
        dice: values,
        max: Math.min(wildCount, dispersible.length),
        kind: "fixed-face",
        face: "hit",
        cost: 0,
        payer: model.id,
        role,
        eligible: dispersible,
      });
      if (option) return option;
    }
    const jubilee =
      role === "defense" &&
      eligible.length &&
      !state.reactionUses?.includes(model.id + ":fireworks") &&
      state.fighters.find(
        (f) =>
          f.side === model.side &&
          usable(f) &&
          isPower(f, "Fireworks") &&
          reactiveAllowed(actor, f, state) &&
          (f.id === model.id || within(f, model, 2)) &&
          f.power > rootTax(f),
      );
    if (jubilee) {
      const option = candidate("fireworks", model.side, {
        label: "Fireworks",
        dice: values,
        max: Math.min(3, jubilee.power - rootTax(jubilee)),
        kind: "reroll",
        cost: rootTax(jubilee),
        variable: true,
        payer: jubilee.id,
        usage: model.id + ":fireworks",
        role,
        eligible,
      });
      if (option) return option;
    }
    const dynamo =
      role === "rolled" &&
      model.side !== target.side &&
      values.length &&
      state.fighters.find(
        (f) =>
          f.side === target.side &&
          usable(f) &&
          isPower(f, "Disruption Field") &&
          reactiveAllowed(model, f, state) &&
          f.power >= 2 + rootTax(f) &&
          within(f, model, 3),
      );
    if (dynamo) {
      const option = candidate("disruption", dynamo.side, {
        label: "Disruption Field",
        dice: values,
        max: Math.min(2, values.length),
        kind: "reroll",
        cost: 2 + rootTax(dynamo),
        payer: dynamo.id,
        role,
        eligible: values.map((_, i) => i),
      });
      if (option) return option;
    }
    const mirage =
      role === "rolled" &&
      model.side !== target.side &&
      values.length &&
      state.fighters.find(
        (f) =>
          f.side === target.side &&
          usable(f) &&
          isPower(f, "Telepathic Emotion Manifestation") &&
          reactiveAllowed(model, f, state) &&
          f.power >= 2 + rootTax(f) &&
          !state.reactionUses?.includes(f.id + ":manifestation") &&
          (within(f, model, 1) ||
            (state.neural?.[f.id] === model.id && within(f, model, 5))),
      );
    if (mirage) {
      const option = candidate("manifestation", mirage.side, {
        label: "Telepathic Emotion Manifestation",
        dice: values,
        max: Math.min(2, values.length),
        kind: "reroll",
        cost: 2 + rootTax(mirage),
        payer: mirage.id,
        usage: mirage.id + ":manifestation",
        clearNeural: mirage.id,
        role,
        eligible: values.map((_, i) => i),
      });
      if (option) return option;
    }
    if (
      eligible.length &&
      isPower(model, "Temporal Domination") &&
      reactiveAllowed(model === actor ? target : actor, model, state) &&
      model.power >= rootTax(model) &&
      !state.reactionUses?.includes(model.id + ":temporal")
    ) {
      const option = candidate("temporal-" + role, model.side, {
        label: "Temporal Domination",
        dice: values,
        max: Math.min(3, eligible.length),
        kind: "reroll",
        cost: rootTax(model),
        payer: model.id,
        usage: model.id + ":temporal",
        phoenixToken: true,
        role,
        eligible,
      });
      if (option) return option;
    }
    const precognition =
      eligible.length &&
      isPower(model, "Telepathic Precognition") &&
      reactiveAllowed(model === actor ? target : actor, model, state) &&
      !state.reactionUses?.includes(model.id + ":precognition") &&
      model.power > rootTax(model);
    if (precognition) {
      const option = candidate("precognition-" + role, model.side, {
        label: "Telepathic Precognition",
        dice: values,
        max: Math.min(eligible.length, model.power - rootTax(model)),
        kind: "reroll",
        cost: rootTax(model),
        variable: true,
        payer: model.id,
        usage: model.id + ":precognition",
        role,
        eligible,
      });
      if (option) return option;
    }
    if (eligible.length) {
      const opponent = model === actor ? target : actor;
      const professor = state.fighters.find(
        (f) =>
          f.id !== model.id &&
          f.side === model.side &&
          usable(f) &&
          reactiveAllowed(opponent, f, state) &&
          isPower(f, "Professor's Guidance") &&
          !state.reactionUses?.includes(f.id + ":guidance") &&
          within(f, model, 4) &&
          f.power > rootTax(f),
      );
      if (professor) {
        const option = candidate("guidance-" + role, model.side, {
          label: "Professor's Guidance",
          dice: values,
          max: Math.min(3, professor.power - rootTax(professor)),
          kind: "reroll",
          cost: rootTax(professor),
          variable: true,
          payer: professor.id,
          usage: professor.id + ":guidance",
          role,
          eligible,
        });
        if (option) return option;
      }
    }
  }
  for (const [model, opponent, role, values] of [
    [actor, target, "rolled", rolled],
    [target, actor, "defense", defense],
  ]) {
    if (rules.lockDefense && role === "defense") continue;
    if (rules.fixedPool && role === "rolled") continue;
    const genius = state.fighters.some(
      (ally) =>
        ally.side === model.side &&
        usable(ally) &&
        isPower(ally, "Strategic Genius") &&
        (ally.id === model.id || within(model, ally, 2)),
    );
    const sources = [
      [
        role === "defense" &&
          leadership(state, model.side, "X-Men Gold") &&
          !within(actor, target, 2),
        "xmen-gold",
        "X-Men Gold",
        1,
        false,
      ],
      [
        role === "rolled" && rules.reversePolarity && within(actor, target, 2),
        "reverse-polarity",
        "Reverse Polarity",
        rolled.length,
        false,
      ],
      [genius, "genius", "Strategic Genius", 1, false],
      [
        role === "rolled" &&
          rules.dupeReroll &&
          nearDuplicates(state, actor, target),
        "dogpile",
        actor.slug === duplicates ? "Dogpile" : "Strike · Multiple Man",
        2,
        false,
      ],
      [
        role === "rolled" && rules.rerollAll,
        "darkforce",
        "Darkforce Strike · все кубики",
        values.length,
        true,
        null,
        true,
      ],
      [
        role === "rolled" && pending.selffriend,
        "selffriend",
        "Self Must Protect Selffriend",
        pending.selffriend,
        false,
      ],
      [
        role === "rolled" && rules.closeReroll && within(actor, target, 3),
        "plasma-rifle",
        "Plasma Rifle",
        2,
        false,
      ],
      [
        role === "rolled" &&
          isPower(model, "On the Hunt") &&
          !state.fighters.some(
            (f) =>
              f.id !== model.id &&
              f.side === model.side &&
              usable(f) &&
              within(f, model, 3),
          ),
        "on-the-hunt",
        "On the Hunt",
        2,
        false,
      ],
      [
        role === "rolled" &&
          !model.grunt &&
          leadership(state, model.side, "Wetworks") &&
          !state.reactionUses?.includes(model.id + ":wetworks"),
        "wetworks",
        "Wetworks",
        1,
        true,
        model.id + ":wetworks",
      ],
      [
        [
          "Assassin Training",
          "I Know Karate",
          "All Right, Now it‘s Serious...",
        ].some((name) => isPower(model, name)),
        "assassin",
        [
          "Assassin Training",
          "I Know Karate",
          "All Right, Now it‘s Serious...",
        ].find((name) => isPower(model, name)),
        1,
        false,
      ],
      [
        isPower(model, "Spetsnaz Training") && within(model, opponent, 1),
        "spetsnaz",
        "Spetsnaz Training",
        1,
        false,
      ],
      [
        role === "defense" &&
          pending.damageType !== "mystic" &&
          isPower(model, "Spider-Sense"),
        "spider-sense",
        "Spider-Sense",
        2,
        false,
      ],
      [
        role === "defense" &&
          pending.damageType !== "mystic" &&
          isPower(model, "Supersonic Reflexes"),
        "supersonic-reflexes",
        "Supersonic Reflexes",
        2,
        false,
      ],
      [
        role === "rolled" && model.baronRerolls,
        "baron",
        "I Am A Baron, After All",
        model.baronRerolls,
        false,
      ],
      [
        role === "rolled" && pending.reroll,
        "follow-up",
        "Переброс дополнительной атаки",
        values.length,
        pending.reroll === "failures",
      ],
    ];
    for (const [enabled, id, label, max, failures, usage, exact] of sources) {
      if (!enabled) continue;
      const eligible = values
        .map((d, i) => (d !== "failure" || failures ? i : -1))
        .filter((i) => i >= 0);
      const option =
        eligible.length &&
        candidate(id + "-" + role, model.side, {
          label,
          dice: values,
          max,
          kind: "reroll",
          cost: 0,
          payer: model.id,
          role,
          eligible,
          ...(usage && { usage }),
          ...(exact && { exact: true }),
        });
      if (option) return option;
    }
  }
  if (!rules.lockDefense && reactiveAllowed(actor, target, state)) {
    if (isPower(target, "Stars and Garters")) {
      const eligible = defense.flatMap((die, index) =>
        die === "failure" ? [] : [index],
      );
      const max = Math.min(3, target.power - rootTax(target), eligible.length);
      const option =
        max > 0 &&
        candidate("stars-defense", target.side, {
          label: "Stars and Garters",
          dice: defense,
          max,
          kind: "reroll",
          role: "defense",
          eligible,
          cost: rootTax(target),
          variable: true,
          payer: target.id,
        });
      if (option) return option;
    }
    const ability =
      isPower(target, "Calculated Risk") && pending.damageType !== "energy"
        ? ["Calculated Risk", 2]
        : isPower(target, "Hulk Not Puny Banner") &&
            pending.damageType !== "mystic"
          ? ["Hulk Not Puny Banner", 4]
          : null;
    if (ability && target.power >= ability[1] + rootTax(target)) {
      const option = candidate("defense-power", target.side, {
        label: ability[0],
        dice: defense,
        max: defense.length,
        kind: "reroll",
        cost: ability[1] + rootTax(target),
        payer: target.id,
        role: "defense",
        eligible: defense.map((_, i) => i),
      });
      if (option) return option;
    }
  }
  const cover =
    !rules.lockDefense &&
    !(
      pending.reviewed?.includes("wetworks-rolled") && within(actor, target, 3)
    ) &&
    !rules.ignoreSight &&
    !(
      actor.trickShot && attackCard(actor, pending.index).name === "Arrow Shot"
    ) &&
    lineOfSight(
      attackCard(actor, pending.index).borrowedFrom
        ? attackOrigin(
            state,
            actor,
            pending.index,
            attackCard(actor, pending.index),
          )
        : actor,
      target,
      state.terrain,
    ).cover;
  if (cover) {
    const eligible = defense
      .map((d, i) => (!["failure", "block"].includes(d) ? i : -1))
      .filter((i) => i >= 0);
    const option =
      eligible.length &&
      candidate("cover", target.side, {
        label: "Cover",
        dice: defense,
        max: 1,
        kind: "fixed-face",
        face: "block",
        cost: 0,
        payer: target.id,
        role: "defense",
        eligible,
      });
    if (option) return option;
  }
  if (rules.absorbEssence && rolled.includes("wild")) {
    const eligible = defense.flatMap((d, i) =>
      ["critical", "wild", "block"].includes(d) ? [i] : [],
    );
    const option =
      eligible.length &&
      candidate("essence", actor.side, {
        label: "Absorb Essence",
        dice: defense,
        max: 1,
        kind: "fixed-face",
        face: "failure",
        cost: 0,
        payer: actor.id,
        role: "defense",
        eligible,
      });
    if (option) return option;
  }
  if (
    rules.pierce &&
    (typeof rules.pierce === "string"
      ? rules.pierce.split(" ").every((die) => rolled.includes(die))
      : rolled.includes("wild"))
  ) {
    const eligible = defense
      .map((d, i) => (["critical", "wild", "block"].includes(d) ? i : -1))
      .filter((i) => i >= 0);
    const option =
      eligible.length &&
      candidate("pierce", actor.side, {
        label: rules.pierce === "failure" ? "Reality Contortion" : "Pierce",
        dice: defense,
        max: 1,
        kind: "fixed-face",
        face: "blank",
        required: true,
        cost: 0,
        payer: actor.id,
        role: "defense",
        eligible,
      });
    if (option) return option;
  }
  if (
    !rules.fixedPool &&
    ((isPower(target, "Enhanced Energy Absorption") &&
      pending.damageType !== "physical") ||
      isPower(target, "Mutant Energy Absorption") ||
      (isPower(target, "Scrying Mirrors of Limbo") &&
        pending.damageType === "mystic"))
  ) {
    const mutant = isPower(target, "Mutant Energy Absorption")
      ? "Mutant Energy Absorption"
      : isPower(target, "Scrying Mirrors of Limbo")
        ? "Scrying Mirrors of Limbo"
        : null;
    const max = defense.filter((d) => d === "wild").length;
    const eligible = rolled
      .map((d, i) => (["critical", "wild", "hit"].includes(d) ? i : -1))
      .filter((i) => i >= 0);
    const option =
      max &&
      eligible.length &&
      candidate("absorption", target.side, {
        label: mutant || "Enhanced Energy Absorption",
        dice: rolled,
        max: Math.min(max, eligible.length),
        kind: "fixed-face",
        face: "blank",
        cost: 0,
        payer: target.id,
        role: "rolled",
        eligible,
      });
    if (option) return option;
  }
  return null;
}
function applyModifier(state, event, action, random) {
  const pending = event.resume;
  (pending.reviewed ||= []).push(event.id);
  if (action) {
    if (event.kind === "reduce") {
      if (
        !Number.isInteger(action.amount) ||
        action.amount < 1 ||
        action.amount > event.max
      )
        throw Error("Укажите число сокращаемого урона.");
      const payer = fighter(state, event.payer);
      spend(state, payer, event.cost);
      if (event.id === "molecular")
        payer.samples = (payer.samples ?? 1) - action.amount;
      pending.reduction = action.amount;
      if (event.id === "tickles") pending.tickles = true;
    } else {
      const indices = action.indices;
      if (
        !Array.isArray(indices) ||
        !indices.length ||
        indices.length > event.max ||
        new Set(indices).size !== indices.length ||
        !indices.every((i) => event.eligible.includes(i))
      )
        throw Error("Выберите допустимые кубики.");
      if (event.exact && indices.length !== event.eligible.length)
        throw Error("Перебросьте все кубики.");
      if (event.kind === "cabal") {
        pending.initial[indices[0]] = "critical";
        pending.cabal = true;
      } else {
        const payer = fighter(state, event.payer);
        spend(
          state,
          payer,
          event.cost + (event.variable ? indices.length : 0),
          !leadershipRerolls.includes(event.id),
        );
        if (event.usage) (state.reactionUses ||= []).push(event.usage);
        if (event.phoenixToken) payer.phoenix = (payer.phoenix || 0) + 1;
        if (event.clearNeural && state.neural)
          delete state.neural[event.clearNeural];
        const values = pending.rolls[event.role];
        if (event.kind === "change" && !faces.includes(action.face))
          throw Error("Выберите грань.");
        for (const index of indices)
          values[index] =
            event.kind === "change"
              ? action.face
              : event.kind === "fixed-face"
                ? event.face
                : faces[random(8)];
        if (event.explode)
          for (const _ of indices) values.push(faces[random(8)]);
        if (event.kind === "reroll")
          recordFailure(
            state,
            pending,
            event.role,
            fighter(
              state,
              event.role === "rolled" ? pending.actor : pending.target,
            ),
            indices.map((index) => values[index]),
          );
        if (event.id === "absorption") for (const _ of indices) gain(payer, 1);
        if (event.id === "essence") gain(payer, 1);
      }
    }
    if (["avengers", "cabal"].includes(event.id)) {
      const used = (state.leadershipUses ||= Object.fromEntries(
        sides.map((side) => [side, []]),
      ));
      used[event.side].push(event.id);
    }
  }
  return pending;
}

function innateDiceSuccesses(fighter, dice) {
  const extraFace = isPower(fighter, "Chosen of Chthon")
    ? "failure"
    : isPower(fighter, "The Cards Always Be In My Favor")
      ? "wild"
      : null;
  return extraFace ? dice.filter((die) => die === extraFace).length : 0;
}

function hasFaces(rolled, requirement) {
  const remaining = rolled.slice();
  return requirement.split(" ").every((face) => {
    const index = remaining.indexOf(face);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function attackRollSummary(state, pending, rolls = pending?.rolls) {
  if (!rolls) return undefined;
  const { rolled, defense } = rolls;
  const actor = fighter(state, pending.actor);
  const target = fighter(state, pending.target);
  const rules = attackProfile(actor, attackCard(actor, pending.index));
  const martial =
    power(target, "Martial Artist") &&
    pending.damageType !== "mystic" &&
    within(actor, target, 2);
  const attackHits =
    rolled.filter((die) => ["hit", "wild", "critical"].includes(die)).length +
    innateDiceSuccesses(actor, rolled) +
    (rules.failuresSucceed
      ? [...rolled, ...defense].filter((die) => die === "failure").length
      : 0) +
    (rules.doubleWild || pending.doubleWild
      ? rolled.filter((die) => die === "wild").length
      : 0);
  const defenseHits =
    defense.filter(
      (die) =>
        ["block", "wild"].includes(die) ||
        (die === "critical" && !rules.ignoreDefenseCritical) ||
        (die === "blank" && pending.blanksSucceed) ||
        (die === "blank" &&
          (martial ||
            isPower(target, "I Can Do This All Day") ||
            (target.injured &&
              pending.damageType !== "mystic" &&
              isPower(target, "Bozhe Moi")) ||
            (pending.damageType === "mystic" &&
              isPower(target, "Psychic Immunity")))),
    ).length +
    innateDiceSuccesses(target, defense) +
    (pending.damageType === "mystic" && isPower(target, "Metal Mind")
      ? defense.filter((die) => die === "wild").length
      : 0);
  return {
    attackHits,
    defenseHits,
    incoming: Math.max(0, attackHits - defenseHits),
  };
}

function resolve(state, pending, block, random) {
  const actor = fighter(state, pending.actor),
    target = fighter(state, pending.target);
  const attack = attackCard(actor, pending.index),
    rules = attackProfile(actor, attack);
  pending.block ||= block;
  if (rules.destructiveForce && pending.destructive == null) {
    const pieces = state.terrain.filter(
      (piece) =>
        piece.size >= 2 &&
        piece.size <= 4 &&
        distanceToTerrain(actor, piece) <= range[4],
    );
    if (pieces.length)
      return {
        suspended: true,
        events: [
          {
            type: "selffriend",
            label: "Destructive Force",
            side: actor.side,
            pieces,
            resume: pending,
          },
        ],
      };
  }
  if (rules.selffriend && pending.selffriend == null) {
    const pieces = state.terrain.filter(
      (piece) => piece.size <= 3 && distanceToTerrain(actor, piece) <= range[3],
    );
    if (pieces.length)
      return {
        suspended: true,
        events: [
          { type: "selffriend", side: actor.side, pieces, resume: pending },
        ],
      };
  }
  if (rules.magneticCrush && pending.crushDice == null) {
    const destroyed = state.terrain.filter(
      (piece) =>
        piece.size <= 3 && distanceToTerrain(target, piece) <= range[2],
    );
    if (destroyed.length) {
      state.terrain = state.terrain.filter(
        (piece) => !destroyed.includes(piece),
      );
      return {
        suspended: true,
        events: [
          {
            type: "magnetic-crush",
            side: actor.side,
            destroyed,
            resume: pending,
          },
        ],
      };
    }
  }
  const heavy =
    actor.heavyFirepower &&
    !state.fighters.some(
      (f) => f.side === actor.side && usable(f) && within(f, target, 3),
    );
  const stark = state.fighters.some(
    (f) =>
      f.side === actor.side &&
      usable(f) &&
      f.starkArmory &&
      (f.id === actor.id || within(f, actor, f.starkArmory)),
  );

  const hammer = state.objectives.filter(
    (o) => o.holder === actor.id && o.name === "Celestial Hammer",
  ).length;
  const grantedDice =
    pending.index === 101 ? actor.grantedAttacks?.[101]?.dice || 0 : 0;
  const apexDice = [
    "Claw Slash",
    "Bloodthirsty Onslaught",
    "Telekinetic Katana",
  ].includes(attack.name)
    ? actor.apexDice || 0
    : 0;
  const attackCount =
    Number(attack.strength) +
    (rules.fixedPool
      ? 0
      : grantedDice +
        (pending.crushDice || 0) +
        (actor.momentumReady ? 3 : 0) +
        (pending.diceBonus || 0) +
        apexDice +
        (isPower(actor, "Wild Rage") ? actor.damage || 0 : 0) +
        (rules.powerDice ? Math.min(5, target.power) : 0) +
        (rules.mysticDice ? Number(face(target).mysticDefense) || 0 : 0) +
        (rules.repeatBonus &&
        !actor.injured &&
        state.attackedThisTurn?.includes(actor.id + ">" + target.id)
          ? 1
          : 0) +
        (savage(state, actor) ? 2 : 0) +
        (pending.destructive || 0) +
        (rules.dupeDice && nearDuplicates(state, actor, target)
          ? rules.dupeDice
          : 0) +
        (rules.placementDice ? state.placements?.[actor.id] || 0 : 0) +
        hammer +
        Number(stark) +
        (heavy ? 2 : 0) +
        (pending.sample ? 2 : 0) +
        (rules.sizeBonus ? target.size : 0) +
        (rules.duelist && state.duelTargets?.includes(target.id) ? 2 : 0) +
        (actor.slug === "hulk" ? Math.floor((actor.damage || 0) / 4) : 0) +
        (actor.noMercy ? Math.min(3, target.damage || 0) : 0) -
        Number(has(actor, "shock") || false));
  const initial = pending.rolls
    ? null
    : pending.initial || rawDice(attackCount, random);
  if (initial) {
    (state.attackedThisTurn ||= []).push(actor.id + ">" + target.id);
    recordFailure(state, pending, "rolled", actor, initial);
    actor.momentumReady = false;
    if (apexDice) actor.apexDice = 0;
  }
  if (
    !pending.rolls &&
    !pending.reviewed?.includes("cabal") &&
    initial.includes("failure") &&
    !rules.fixedPool &&
    !actor.grunt &&
    leadership(state, actor.side, "My Cabal") &&
    !state.leadershipUses?.[actor.side]?.includes("cabal")
  ) {
    return {
      suspended: true,
      events: [
        {
          type: "modify-dice",
          kind: "cabal",
          id: "cabal",
          label: "My Cabal is Only for the Strong",
          side: actor.side,
          dice: initial,
          max: 1,
          eligible: initial
            .map((d, i) => (d === "failure" ? i : -1))
            .filter((i) => i >= 0),
          resume: { ...pending, initial },
        },
      ],
    };
  }
  if (heavy) actor.heavyFirepower = false;
  const rolled =
    pending.rolls?.rolled ||
    dice(
      attackCount,
      has(actor, "hex") || isPower(target, "Things Tend To Go My Way")
        ? 0
        : rules.criticals || 1,
      random,
      initial,
    );
  const defense =
    pending.rolls?.defense ||
    dice(
      (pending.quickDraw != null
        ? 5
        : Number(
            face(target)[
              (pending.defenseType || pending.damageType) + "Defense"
            ],
          )) +
        (pending.block ? 2 : 0) +
        (pending.defenseBonus || 0) +
        (target.selfDiscovery ? 3 : 0) -
        (savage(state, target) ? 1 : 0) +
        (isPower(target, "Unstable Outline") &&
        ["physical", "energy"].includes(pending.damageType) &&
        !within(actor, target, 3)
          ? 1
          : 0) -
        Number(
          state.fighters.some(
            (f) =>
              f.id !== actor.id &&
              f.side === actor.side &&
              usable(f) &&
              isPower(f, "Anklebiter") &&
              within(f, target, 1),
          ),
        ) +
        ((target.phasing === "density" && pending.damageType === "physical") ||
        (target.phasing === "phased" && pending.damageType === "energy")
          ? 3
          : 0) -
        Number(has(target, "incinerate") || false),
      has(target, "hex") ||
        rules.ignoreDefenseCritical ||
        isPower(actor, "Things Tend To Go My Way")
        ? 0
        : 1,
      random,
    );
  if (!pending.rolls) {
    recordFailure(state, pending, "rolled", actor, rolled);
    recordFailure(state, pending, "defense", target, defense);
  }
  const wilds = rolled.filter((die) => die === "wild").length;
  const modifier =
    !pending.diceResolved &&
    modEvent(state, pending, rolled, defense, actor, target, rules);
  if (modifier) return { suspended: true, events: [modifier] };
  if (
    rules.mindOverMatter &&
    !pending.mindReviewed &&
    usable(target) &&
    target.conditions?.length >= 2
  ) {
    const pairs = target.conditions.flatMap((first, index) =>
      target.conditions.slice(index + 1).map((second) => [first, second]),
    );
    return {
      suspended: true,
      events: [
        {
          type: "mind-over-matter",
          side: actor.side,
          options: pairs.map(([first, second]) => ({
            value: first + "|" + second,
            label: "Mind Over Matter · " + first + " + " + second,
          })),
          resume: {
            ...pending,
            mindReviewed: true,
            diceResolved: true,
            rolls: { rolled, defense },
          },
        },
      ],
    };
  }
  const matches = (test, dealt = 0) =>
    !test || (test === "damage" ? dealt > 0 : hasFaces(rolled, test));
  if (
    !pending.moved &&
    rules.beforeMove &&
    matches(rules.beforeMove.on) &&
    !(pending.anchored && rules.beforeMove.who !== "actor")
  ) {
    const event = moveEvent(
      rules.beforeMove,
      actor,
      target,
      pending.damageType,
    );
    if (event)
      return {
        suspended: true,
        events: [
          {
            ...event,
            resume: { ...pending, moved: true, rolls: { rolled, defense } },
          },
        ],
      };
  }
  const rollSummary = attackRollSummary(state, pending, { rolled, defense });
  const incoming = Math.min(rollSummary.incoming, rules.damageCap ?? Infinity);
  if (
    !pending.reviewed?.some(
      (id) =>
        id === "iron-reduce" ||
        id === "molecular" ||
        id === "tickles" ||
        id === "nice-punch",
    ) &&
    incoming > 0 &&
    reactiveAllowed(actor, target, state)
  ) {
    const reduction = isPower(target, "I Am Iron Man")
      ? ["iron-reduce", "I Am Iron Man", 1, 1]
      : isPower(target, "Molecular Regeneration")
        ? [
            "molecular",
            "Molecular Regeneration",
            0,
            Math.min(incoming, target.samples ?? 1),
          ]
        : isPower(target, "Ha, Ha, Ha, That Tickles!")
          ? ["tickles", "Ha, Ha, Ha, That Tickles!", 1, 1]
          : isPower(target, "Nice Punch...")
            ? ["nice-punch", "Nice Punch...", 1, 1]
            : null;
    if (reduction?.[3] && target.power >= reduction[2] + rootTax(target))
      return {
        suspended: true,
        events: [
          {
            type: "modify-dice",
            kind: "reduce",
            id: reduction[0],
            label: reduction[1],
            side: target.side,
            cost: reduction[2] + rootTax(target),
            payer: target.id,
            max: reduction[3],
            resume: { ...pending, moved: true, rolls: { rolled, defense } },
          },
        ],
      };
  }
  if (rules.duelist) (state.duelTargets ||= []).push(target.id);
  if (rules.extra === "reality") (actor.realityTargets ||= []).push(target.id);
  for (const [test, ...values] of rules.before || [])
    if (matches(test)) values.forEach((name) => condition(target, name));
  if (rules.drain && wilds) {
    const lost = Math.min(target.power, rules.drain === "wild" ? 1 : wilds);
    target.power -= lost;
    if (rules.drain === "sap") gain(actor, lost);
  }
  const origin = { x: target.x, y: target.y, radius: target.radius };
  if (
    rules.magneticCrush ||
    (rules.nearbyDamage &&
      matches(rules.nearbyDamage === true ? "" : rules.nearbyDamage))
  )
    for (const enemy of state.fighters.filter(
      (f) =>
        f.id !== target.id && f.side !== actor.side && within(f, origin, 2),
    ))
      damage(state, enemy, 1, actor);
  if (rules.warbird && wilds && rolled.includes("critical")) {
    for (const f of state.fighters.filter(
      (f) =>
        f.id !== target.id && f.side === target.side && within(f, origin, 2),
    ))
      damage(state, f, 1, actor);
  }
  const dealt = damage(
    state,
    target,
    Math.max(pending.tickles ? 1 : 0, incoming - (pending.reduction || 0)),
    actor,
    {
      reviewed: true,
      attackType: pending.damageType,
      noPower: !!rules.noPower,
    },
  );
  for (const [model, roll] of [
    [actor, rolled],
    [target, defense],
  ])
    totallyMeantIt(state, model, roll);
  if (rules.builder)
    gain(
      actor,
      rules.builder === "damage"
        ? dealt
        : rules.builder === "at-least-one"
          ? Math.max(1, dealt)
          : rules.builder,
    );
  if (rules.heal) heal(state, actor, rules.heal);
  if (rules.healOnDamage && dealt && usable(actor))
    heal(state, actor, rules.healOnDamage);

  if (rules.afterDrain && wilds)
    target.power = Math.max(0, target.power - wilds);
  if (rules.backlash && rolled.includes("critical")) damage(state, actor, 2);
  for (const [test, ...values] of rules.conditions || [])
    if (matches(test, dealt)) values.forEach((name) => condition(target, name));
  if (rules.neurotoxin && wilds && usable(target)) {
    if (has(target, "bleed") && has(target, "poison") && !target.activated)
      target.activated = true;
    else condition(target, "stagger");
  }
  if (rules.neural && wilds && usable(target))
    (state.neural ||= {})[actor.id] = target.id;
  if (rules.flareOn && matches(rules.flareOn)) addFlare(actor);
  if (rules.widowSting && wilds && usable(target))
    target.power = Math.max(0, target.power - 1);
  if (rules.phoenixGain && usable(actor))
    actor.phoenix = (actor.phoenix || 0) + rules.phoenixGain;
  if (rules.phoenixLoss && usable(target) && actor.phoenix) actor.phoenix -= 1;
  if (pending.flares) condition(target, "incinerate");
  if (rules.rampage && matches(rules.rampage))
    for (const f of state.fighters.filter(
      (f) => f.id !== actor.id && usable(f) && within(f, actor, 2),
    ))
      damage(state, f, 1, actor);
  if (rules.concussion && matches(rules.concussion))
    for (const f of state.fighters.filter(
      (f) =>
        f.id !== actor.id &&
        f.id !== target.id &&
        usable(f) &&
        within(f, origin, 2),
    ))
      damage(state, f, 1, actor, { noPower: true });
  if (rules.closeCondition && within(actor, target, rules.closeCondition[0]))
    condition(target, rules.closeCondition[1]);
  if (rules.splashShock && wilds) {
    state.fighters
      .filter(
        (f) =>
          f.side === target.side &&
          (f.id === target.id || within(f, origin, 2)),
      )
      .forEach((f) => condition(f, "shock"));
  }
  if (rules.splashDamage && wilds && rolled.includes("hit")) {
    state.fighters
      .filter(
        (f) =>
          f.side === target.side && f.id !== target.id && within(actor, f, 3),
      )
      .forEach((f) => damage(state, f, 1, actor));
  }
  if (
    rules.geneticBurst &&
    wilds &&
    rolled.includes("critical") &&
    rolled.includes("hit")
  ) {
    addSample(actor);
    for (const enemy of state.fighters.filter(
      (f) => f.side !== actor.side && within(actor, f, 2),
    )) {
      damage(state, enemy, 1, actor);
    }
  }
  if (rules.helios && wilds) {
    for (const f of state.fighters.filter(
      (f) =>
        f.id !== target.id && f.side === target.side && within(f, origin, 2),
    ))
      damage(state, f, 1, actor);
  }
  if (rules.illicit) {
    for (const f of state.fighters.filter(
      (f) =>
        f.id === target.id || (f.side === target.side && within(f, origin, 2)),
    ))
      condition(f, "incinerate");
  }
  if (pending.index === 101 || pending.index === 103)
    delete actor.grantedAttacks[pending.index];
  if (pending.cabal) {
    if (actor.power) actor.power--;
    else damage(state, actor, 1);
  }
  if (attack.name === "Arrow Shot") actor.trickShot = false;
  actor.noMercy = false;
  actor.baronRerolls = 0;

  if (isPower(actor, "Scientific Hubris") || isPower(actor, "DNA Database")) {
    if (rolled.includes("critical")) gain(actor, 1);
  }
  if (
    usable(target) &&
    (isPower(target, "Scientific Hubris") || isPower(target, "DNA Database")) &&
    defense.includes("critical")
  )
    gain(target, 1);
  if (usable(target) && dealt && isPower(target, "You Call That A Punch?"))
    gain(target, 1);
  const events = [];
  if (usable(target) && leadership(state, target.side, "Sinister Six")) {
    const used = (state.leadershipUses ||= { p1: [], p2: [] })[target.side];
    if (!used.includes("sinister-power")) {
      used.push("sinister-power");
      gain(target, 1);
    }
    const options = (target.conditions || []).filter((name) =>
      ["shock", "slow", "incinerate"].includes(name),
    );
    if (dealt && options.length && !used.includes("sinister-shake"))
      events.push({
        type: "sinister-shake",
        side: target.side,
        target: target.id,
        options: options.map((value) => ({
          value,
          label: "Sinister Six · снять " + value,
        })),
      });
  }
  if (
    usable(target) &&
    reactiveAllowed(actor, target, state) &&
    isPower(target, "Untamed Force") &&
    target.power >= 2 + rootTax(target) &&
    within(actor, target, 2) &&
    !state.reactionUses?.includes(target.id + ":untamed")
  ) {
    const option = attacks(state, target).find(
      (a) =>
        a.name === "Claw Slash" && a.targets.some((t) => t.value === actor.id),
    );
    if (option)
      events.push({
        type: "untamed",
        side: target.side,
        source: target.id,
        target: actor.id,
        index: option.index,
      });
  }
  if (rules.reversePolarity && !within(actor, target, 2)) {
    const push = moveEvent(
      { mode: "push", speed: "S", required: true },
      actor,
      target,
      pending.damageType,
    );
    if (push) events.push(push);
  }
  if (
    rules.afterMove &&
    !(pending.anchored && rules.afterMove.who !== "actor") &&
    (!rules.afterMove.damageRequired || dealt > 0) &&
    (rules.afterMove.on === "down"
      ? dealt > 0 && !usable(target)
      : matches(rules.afterMove.on))
  ) {
    const event = moveEvent(rules.afterMove, actor, target, pending.damageType);
    if (event) events.push(event);
  }
  if (rules.warbird && wilds) {
    const event = moveEvent(
      { mode: "throw", speed: "S" },
      actor,
      target,
      pending.damageType,
    );
    if (event) events.push(event);
  }
  if (rules.catchTerrain && wilds && rolled.includes("hit") && usable(target)) {
    const pieces = state.terrain.filter(
      (t) => t.size <= 2 && distanceToTerrain(actor, t) <= range[3],
    );
    if (pieces.length)
      events.push({
        type: "web-collision",
        side: actor.side,
        target: target.id,
        source: actor.id,
        options: pieces.map((t) => ({
          value: t.id,
          label: t.name + " · " + t.size,
        })),
      });
  }
  if (rules.extra && !pending.extra && usable(actor)) {
    const alternatives = {
      "speed-of-sight": [attack.name, "wild hit"],
      frontliner: [attack.name, "wild hit block"],
      reality: [attack.name, "critical wild hit"],
      claw: ["Claw Slash", "wild hit", true],
      batons: ["Shock Batons", "wild hit", "failures"],
    };
    const rule = alternatives[rules.extra];
    if (rule && matches(rule[1])) {
      const index = face(actor).attacks.findIndex((a) => a.name === rule[0]);
      if (index !== -1)
        events.push({
          type: "bonus-attack",
          side: actor.side,
          kind: rules.extra,
          index,
          target: target.id,
          origin,
          reroll: rule[2],
        });
    }
  }
  if (rules.explosive && wilds) {
    for (const f of state.fighters.filter(
      (f) => f.id !== actor.id && usable(f) && within(actor, f, 2),
    )) {
      const event = moveEvent(
        {
          mode: "push",
          speed: "S",
          direction: "away",
          damage: 1,
          required: true,
        },
        actor,
        f,
        pending.damageType,
      );
      if (event) events.push(event);
    }
  }
  if (usable(target) && dealt && isPower(target, "Aggressive"))
    events.push({
      ...moveEvent(
        { mode: "advance", speed: "S", direction: "toward" },
        actor,
        target,
      ),
      side: target.side,
      reference: { x: actor.x, y: actor.y, radius: actor.radius },
    });
  if (
    dealt &&
    usable(target) &&
    isPower(target, "Slippery") &&
    reactiveAllowed(actor, target, state) &&
    target.power >= 2 + rootTax(target)
  )
    events.push({
      type: "slippery",
      side: target.side,
      mover: target.id,
      cost: 2 + rootTax(target),
    });
  if (pending.tickles && usable(target) && within(target, actor, 3)) {
    const push = moveEvent(
      { mode: "push", speed: "S", direction: "away" },
      target,
      actor,
      "superpower",
    );
    if (push) events.push(push);
  }
  for (const id of pending.bigBrotherMoves || []) {
    const protector = fighter(state, id);
    const move = moveEvent(
      {
        mode: "advance",
        who: "actor",
        speed: "S",
        direction: "toward",
        required: true,
      },
      protector,
      actor,
    );
    if (move) events.push({ ...move, name: "Big Brother" });
  }
  if (
    usable(target) &&
    isPower(target, "Enhanced Agility") &&
    reactiveAllowed(actor, target, state) &&
    target.power >= 2 + rootTax(target)
  )
    events.push({
      type: "enhanced-agility",
      side: target.side,
      mover: target.id,
      target: actor.id,
      cost: 2 + rootTax(target),
    });
  if (
    usable(actor) &&
    isPower(actor, "Fire Manipulation") &&
    has(target, "incinerate") &&
    target.x != null
  ) {
    const targets = state.fighters.filter(
      (f) =>
        f.id !== target.id &&
        f.side !== actor.side &&
        usable(f) &&
        within(f, target, 2),
    );
    if (targets.length)
      events.push({
        type: "fire-manipulation",
        side: actor.side,
        targets: targets.map((f) => f.id),
      });
  }

  if (
    usable(actor) &&
    rules.extra &&
    !pending.extra &&
    hasFaces(rolled, rules.bounceOn || "wild hit") &&
    rules.extra === "bounce"
  )
    events.push({
      type: "bonus-attack",
      side: actor.side,
      kind: rules.extra,
      index: pending.index,
      target: target.id,
      origin,
    });
  if (
    usable(actor) &&
    ["rapid", "salvo"].includes(rules.extra) &&
    !pending.extra &&
    hasFaces(rolled, rules.rapidOn || "hit")
  )
    events.push({
      type: "bonus-attack",
      side: actor.side,
      kind: rules.extra,
      index: pending.index,
      target: target.id,
      origin,
    });
  if (usable(actor) && rules.advance && wilds && rolled.includes("hit"))
    events.push({ type: "bonus-move", side: actor.side });
  if (usable(actor) && rules.rush && wilds && state.active === actor.id)
    events.push(juggernautPush(actor));
  if (rules.distantStun && dealt && !within(actor, origin, 2))
    condition(target, "stun");
  if (usable(actor) && isPower(actor, "Puff of Smoke")) {
    const effects = [];
    if (
      target.x != null &&
      actor.power >= rootTax(actor) &&
      reactiveAllowed(target, actor, state)
    )
      effects.push({
        type: "puff-smoke",
        name: "Puff of Smoke",
        side: actor.side,
        source: actor.id,
        reference: origin,
        cost: rootTax(actor),
      });
    if (rules.flurry && usable(target) && hasFaces(rolled, "critical hit"))
      effects.push({
        type: "flurry-attack",
        name: "Flurry of Blows",
        side: actor.side,
        target: target.id,
      });
    if (effects.length === 2)
      events.unshift({
        type: "strike-order",
        side: actor.side,
        moves: effects,
      });
    else events.unshift(...effects);
  }
  if (
    pending.quickDraw != null &&
    usable(target) &&
    (target.damage || 0) === pending.quickDraw
  )
    events.push({
      type: "quick-draw-damage",
      side: target.side,
      source: target.id,
      target: actor.id,
    });
  if (rules.explosiveForce && wilds)
    for (const f of state.fighters.filter(
      (f) => f.id !== actor.id && usable(f) && within(f, actor, 2),
    )) {
      const push = moveEvent(
        {
          mode: "push",
          speed: "S",
          direction: "away",
          required: true,
          reference: { x: actor.x, y: actor.y, radius: actor.radius },
        },
        actor,
        f,
        pending.damageType,
      );
      if (push) {
        events.push({ ...push, name: "Explosive Force · " + f.name });
        damage(state, f, 1, actor);
      }
    }
  if (
    pending.throwAfter &&
    usable(target) &&
    usable(actor) &&
    displacementSize(target) <= 3
  ) {
    const thrown = moveEvent(
      { mode: "throw", speed: "S" },
      actor,
      target,
      "superpower",
    );
    if (thrown) events.push({ ...thrown, name: "What I Do Isn‘t Very Nice" });
  }
  if (
    state.active === actor.id &&
    (target.dazed || target.ko) &&
    isPower(actor, "Frenzy") &&
    usable(actor) &&
    reactiveAllowed(target, actor, state) &&
    actor.power >= 2 + rootTax(actor) &&
    !state.reactionUses?.includes(actor.id + ":frenzy")
  )
    events.push({
      type: "frenzy",
      side: actor.side,
      source: actor.id,
      cost: 2 + rootTax(actor),
    });
  if (
    usable(target) &&
    usable(actor) &&
    isPower(target, "Counter-Strike") &&
    target.power >= 2 + rootTax(target) &&
    reactiveAllowed(actor, target, state) &&
    within(actor, target, 3)
  )
    events.push({
      type: "counter-strike",
      side: target.side,
      source: target.id,
      target: actor.id,
      cost: 2 + rootTax(target),
    });
  if (
    dealt &&
    leadership(state, actor.side, "X-Men Blue") &&
    xmenBlueTargets(state, actor).length
  )
    events.push({ type: "xmen-blue", side: actor.side, source: actor.id });
  if (usable(actor) && rules.dash) {
    const moves = [];
    if (matches("critical block"))
      moves.push({
        ...moveEvent(
          { mode: "advance", who: "actor", speed: "S" },
          actor,
          target,
        ),
        name: "Dash",
      });
    if (rules.velocity && matches("wild hit"))
      moves.push({
        type: "bonus-attack",
        side: actor.side,
        kind: "velocity",
        name: "Velocity",
        index: pending.index,
        target: target.id,
      });
    if (moves.length === 2)
      events.unshift({ type: "strike-order", side: actor.side, moves });
    else events.unshift(...moves);
  }
  if (rules.conditionChoice && usable(target)) {
    const choices =
      rules.conditionTrigger === "failure"
        ? rolled.filter((die) => die === "failure").length
        : rules.conditionTrigger === "each-wild"
          ? wilds
          : Number(wilds > 0);
    for (let i = 0; i < choices; i++)
      events.push({
        type: "choose-condition",
        side: actor.side,
        target: target.id,
        options: rules.conditionChoice,
      });
  }
  const observers = Object.values(pending.failureObservers || {}).flat();
  if (observers.length)
    events.push({ type: "failure-power", side: actor.side, observers });
  return { actor, target, attack, rolled, defense, rollSummary, dealt, events };
}

function xmenBlueTargets(state, source) {
  return state.fighters.filter(
    (f) =>
      f.id !== source.id &&
      f.side === source.side &&
      usable(f) &&
      !f.grunt &&
      within(source, f, 5) &&
      !state.leadershipUses?.[f.side]?.includes("blue:" + f.id),
  );
}
function counterStrike(state, widow, attacker, random) {
  const rolled = rawDice(4, random);
  const hits = rolled.filter((d) => d === "critical" || d === "wild").length;
  log(state, "Counter-Strike · " + attacker.name, {
    side: widow.side,
    fighter: widow.id,
    target: attacker.id,
    rolls: [{ label: "Counter-Strike", faces: rolled }],
  });
  damage(state, attacker, hits, widow);
}
function psychicDistraction(state, actor, target, random) {
  const rolled = rawDice(4, random);
  const hits = rolled.filter((d) => d === "critical" || d === "wild").length;
  log(state, "Psychic Distraction · " + target.name, {
    side: actor.side,
    fighter: actor.id,
    target: target.id,
    rolls: [{ label: "Psychic Distraction", faces: rolled }],
  });
  const dealt = damage(state, target, hits, actor) || 0;
  if (dealt && usable(actor))
    (state.effects ||= []).unshift({
      type: "displace",
      mode: "advance",
      speed: "S",
      side: actor.side,
      mover: actor.id,
      source: actor.id,
      name: "Psychic Distraction",
    });
}
function nightmareVisions(state, actor, target, random) {
  const rolled = rawDice(4, random);
  const successes = rolled.filter(
    (die) => die === "critical" || die === "wild",
  ).length;
  const followAdvance = moveEvent(
    { mode: "advance", speed: "S" },
    actor,
    target,
    "superpower",
  );
  damage(state, target, successes, actor, { followAdvance });
  failurePower(state, actor, rolled);
  log(state, "Nightmare Visions · " + target.name, {
    side: actor.side,
    fighter: actor.id,
    target: target.id,
    rolls: [{ label: "Nightmare Visions", faces: rolled }],
  });
}

module.exports = {
  rawDice,
  grantFailurePower,
  failurePower,
  rangeOrigin,
  nightmareVisions,
  xmenBlueTargets,
  face,
  attackCard,
  transformModel,
  beginVolley,
  attackReaches,
  displacement,
  moveEvent,
  throwTerrain,
  usePower,
  pay,
  spend,
  heal,
  counterStrike,
  unleash,
  phoenixExplosion,
  psychicDistraction,
  addFlare,
  xavierTargets,
  rootTax,
  payerFor,
  collide,
  resolveDodge,
  resolveAcrobaticDodge,
  isPower,
  cantTouchThis,
  finishVolley,
  movementModel,
  gain,
  condition,
  usable,
  damage,
  resolveNicePunch,
  dropObjectives,
  status,
  attacks,
  powers,
  canHoldExtract,
  interactRange,
  powerDestination,
  targetReactions,
  applyModifier,
  reactiveAllowed,
  leadership,
  attackRollSummary,
  resolve,
};
