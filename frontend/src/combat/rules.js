import { clean } from "./profile.js";
const num = (s) =>
  ({ one: 1, two: 2, three: 3, four: 4, five: 5, any: 99 })[s] ?? Number(s);
const only = (body, type) => {
  const before = body.split(/(?:attack[, .]|attacks[, .]|roll[, .])/i)[0];
  const types = [...before.matchAll(/\b(physical|energy|mystic)\b/g)].map(
    (x) => x[1],
  );
  return !types.length || types.includes(type);
};
const relevant = (b) =>
  /(?:reroll|re-roll|total (?:number of )?success|counts?.*success|add.*(?:attack|defense).*dic|(?:attack|defense).*additional dic|reduce.*(?:amount|damage)|cannot.*(?:modify|reroll)|do not.*additional dice|does not.*critical|treat.*critical)/i.test(
    b,
  );
export function powerRules(p, other, attack, role, distance) {
  const effects = [],
    warnings = [],
    notes = [];
  const atk = role === "attack",
    def = !atk,
    type = attack.type;
  const add = (kind, power, extra = {}) =>
    effects.push({
      kind,
      name: clean(power.name),
      cost: power.type === "innate" ? 0 : Number(power.powerCost) || 0,
      variable: power.powerCost === "X" || Number(power.powerCost) === 100,
      paid: power.type !== "innate",
      ...extra,
    });
  for (const power of p.powers) {
    const b = clean(power.body || ""),
      name = clean(power.name);
    if (!b) continue;
    if (
      /Interacting with (?:an?|a Secure) objective|Other allied characters/.test(
        b,
      ) &&
      !/This character and|Additionally.*(?:attack|defense)/.test(b)
    )
      continue;
    if (
      /damage from a collision|damage from collisions|suffer.*collision damage/.test(
        b,
      ) &&
      !/attack|defense/.test(b)
    )
      continue;
    let handled = false;
    const use = (kind, extra) => {
      handled = true;
      add(kind, power, extra);
    };
    // These abilities belong to separate effects, other allies, or future rolls.
    if (
      /^(?:While|When|After) (?:another allied|other allied)/i.test(b) &&
      !/this character or|this character and/i.test(b)
    )
      continue;
    if (
      /^Whenever this character rolls dice|^When this character rolls dice/i.test(
        b,
      ) &&
      !relevant(b)
    )
      continue;
    if (
      /^After an attack (?:against|targeting) this character is resolved/i.test(
        b,
      )
    ) {
      if (def)
        notes.push(
          `${name}: ответный урон после атаки не прибавляется к атаке персонажа`,
        );
      continue;
    }
    if (
      /^When an enemy character ends|^Choose an enemy character.*roll \d|^During the.*Power Phase.*roll \d/i.test(
        b,
      ) &&
      !relevant(b)
    )
      continue;
    if (/^If this character Dazes or KO's/i.test(b)) {
      if (atk) notes.push(`${name}: продолжение после Daze/KO не моделируется`);
      continue;
    }
    if (/Cloak of Shadows|Probability Manipulation/.test(name))
      use("cloak", { cost: 1, variable: true });
    else if (name === "Empowered Gauntlets") {
      handled = true;
      if (atk && clean(attack.name) === "Blitz Strike") use("cloakAll");
    } else if (
      [
        "Witty Banter",
        "Disruption Field",
        "It's Madness, My Favorite Kind",
        "Temporal Divergence",
        "Distracting Illusions",
        "Telepathic Emotion Manifestation",
        "Telepathic Suggestion",
      ].includes(name)
    ) {
      handled = true;
      const attacking = name === "Telepathic Suggestion";
      const reach =
        name === "Telepathic Emotion Manifestation"
          ? 1
          : name === "Temporal Divergence" || attacking
            ? 5
            : 3;
      if ((attacking ? atk : def) && distance <= reach)
        use("opponentReroll", {
          amount: [
            "Witty Banter",
            "Distracting Illusions",
            "Telepathic Suggestion",
          ].includes(name)
            ? 1
            : 2,
        });
    } else if (name === "Binary Form") use("dice", { amount: 2 });
    else if (name === "Smoke and Mirrors") {
      handled = true;
      if (def) use("smoke");
    } else if (name === "Ethereal") {
      handled = true;
      if (def && type === "physical") use("capDamage", { amount: 1 });
    } else if (name === "Rapid Phase" || name === "Omega Cycle") {
      handled = true;
      if (
        def &&
        ["physical", "energy"].includes(type) &&
        p.state.stance !== type
      )
        use("dice", { amount: name === "Rapid Phase" ? 3 : 2 });
    } else if (name === "Eye of Agamotto") {
      use("failureAllowed");
      use("allReroll");
    } else if (["Plucky Attitude", "Case Prep"].includes(name))
      use("allReroll", { conditional: true });
    else if (["Chronokinesis", "Temporal Rewind"].includes(name)) {
      if (power.type !== "innate")
        warnings.push(
          `${name}: совместный переброс обеих сторон пока не моделируется`,
        );
      handled = true;
    } else if (
      /enemy characters cannot (?:reroll or )?modify attack dice|enemy characters cannot reroll or modify (?:their )?attack dice/i.test(
        b,
      )
    ) {
      handled = true;
      if (def) use("banEnemyMod");
    } else if (
      /defender cannot (?:modify|reroll or modify)|defender cannot modify/.test(
        b,
      )
    ) {
      handled = true;
      if (atk) use("banEnemyMod");
    } else if (name === "Bad Luck") {
      handled = true;
      if (def) {
        use("banEnemyMod");
        use("banEnemyCrit");
      }
    } else if (["Things Tend To Go My Way", "God of Mischief"].includes(name)) {
      handled = true;
      if (name !== "God of Mischief" || distance <= 4) {
        use("banEnemyCrit");
        if (name === "God of Mischief") use("taxEnemy", { amount: 1 });
      }
    } else if (name === "Moss and Mud and Swamp") {
      handled = true;
      if (def) use("banEnemyCrit");
    } else if (name === "Symbiotic Serial Killer") {
      handled = true;
      if (atk) use("banEnemyCrit");
    } else if (name === "Mystic Vulnerability") {
      handled = true;
      if (def && type === "mystic") use("noCrit");
    } else if (
      name !== "Master of the Realm of Darkness" &&
      /adds failure results in its rolls? to its total successes|adds failure results to its total successes/i.test(
        b,
      )
    )
      use("failureSuccess");
    else if (name === "Master of the Realm of Darkness") {
      handled = true;
      if (atk) {
        use("failureSuccess");
        use("addEnemyFailures");
      }
    } else if (name === "This isn't Mischief, This is Mayhem")
      use("enemyFailures");
    else if (name === "Ready to Roll") {
      handled = true;
      if (p.state.special) use("failureSuccess");
    } else if (name === "Spirit of Brother Daniel") {
      handled = true;
      if (def && p.state.special) use("dice", { amount: 2 });
    } else if (name === "Squirrelese") {
      handled = true;
      if (p.state.special) use("reroll", { amount: 2 });
    } else if (name === "Tippy-Toe Takedown!") {
      handled = true;
      if (atk)
        warnings.push(
          "Tippy-Toe Takedown!: перенос токена на врага не включён; параметр Tippy-Toe учитывает токен у Squirrel Girl",
        );
    } else if (name === "The Cards Always Be In My Favor") use("doubleWild");
    else if (name === "The Best At What I Do . . .") {
      handled = true;
      if (atk) use("doubleWild");
    } else if (name === "Death Dancer") use("echo");
    else if (name === "Specter of Death") {
      handled = true;
      if (atk) use("ronin");
    } else if (name === "Psionic Force Field") {
      handled = true;
      if (def) use("blankEnemyWilds", { amount: 99 });
    } else if (name === "Midnight Field") {
      handled = true;
      if (def) use("blankEnemyWilds", { cost: 1, variable: true, amount: 99 });
    } else if (
      /for each wild in the defense roll.*change (?:one|1) of the attacker's/i.test(
        b,
      )
    ) {
      handled = true;
      if (def && only(b, type)) use("cancelWithWilds");
    } else if (
      /counts? (?:each )?wild(?: results| result| in the defense roll).*as (?:2|two) successes/.test(
        b,
      )
    ) {
      handled = true;
      if (def && only(b, type)) use("doubleWild");
    } else if (name === "I am a GOD!") use("blankSuccess");
    else if (
      /adds? blanks?.*(?:defense roll|total successes)|counts Blank results in its defense roll as successes/i.test(
        b,
      )
    ) {
      handled = true;
      const range = b.match(/within range (\d)/i);
      if (def && only(b, type) && (!range || distance <= +range[1]))
        use("blankSuccess");
    } else if (name === "I am a GOD!") use("blankSuccess");
    else if (name === "Arrogance") {
      handled = true;
      if (atk) {
        use("failureSuccess");
        use("enemyFailureSuccess");
      }
    } else if (["Super Genius", "Special Forces"].includes(name)) {
      handled = true;
      if (atk) use("swapHits");
    } else if (name === "A Little Something Extra") {
      handled = true;
      if (atk) use("hitToWild");
    } else if (name === "Atlantean Might") {
      handled = true;
      if (atk) use("noReduction");
    } else if (name === "Adaptive Nano-Shifting Protocols") {
      handled = true;
      if (
        def &&
        p.state.stance === type &&
        ["physical", "energy"].includes(type)
      )
        use("dice", { amount: 2 });
      if (atk && p.state.stance === "reroll") use("reroll", { amount: 2 });
    } else if (["Leviathan Armor", "Phasing"].includes(name)) {
      handled = true;
      if (def && p.state.stance === type) use("dice", { amount: 3 });
    } else if (/^Arch ?[Nn]emesis/.test(name)) {
      handled = true;
      const enemy = clean(b.match(/When attacking (.*?),/i)?.[1] || "");
      if (atk && enemy && other.alterEgo.includes(enemy)) {
        use("failureAllowed");
        use("reroll", { amount: 99 });
      }
    } else if (name === "You Won't Like Me When I'm Angry") {
      handled = true;
      if (atk) use("dice", { amount: Math.floor(p.state.damage / 4) });
    } else if (name === "Driven by Vengeance") {
      handled = true;
      if (atk && p.state.special)
        use("dice", { amount: 3, cost: 0, paid: false });
    } else if (name === "Analyzing Strike") {
      handled = true;
      if (p.state.special) use("dice", { amount: 3 });
    } else if (name === "Kill Count") {
      handled = true;
      if (atk) use("reroll", { amount: p.state.tokens });
    } else if (name === "Thermokinesis") {
      handled = true;
      if (atk) use("dice", { amount: p.state.tokens });
    } else if (name === "Molecular Regeneration") {
      handled = true;
      if (def) use("reduce", { amount: p.state.tokens, minimum: 0 });
    } else if (name === "Undead Empowerment") {
      handled = true;
      if (atk) use("failureToWild", { amount: p.state.tokens });
    } else if (["Unstoppable Momentum", "Nova Force"].includes(name)) {
      handled = true;
      if (
        atk &&
        p.state.moved &&
        (name !== "Nova Force" ||
          /Nova Burst|Lightspeed Lance/.test(clean(attack.name)))
      )
        use("dice", { amount: 3 });
    } else if (["Focused on the Kill", "Master Duelist"].includes(name)) {
      handled = true;
      if (
        atk &&
        p.state.attacked &&
        (name !== "Master Duelist" || clean(attack.name) === "Sword Strike")
      )
        use("dice", { amount: 2 });
    } else if (name === "Intuitive Pattern Recognition") {
      handled = true;
      if (def && other.state.attacked) use("dice", { amount: 2 });
    } else if (name === "Savagery Protocols") {
      handled = true;
      if (p.state.objective) use("dice", { amount: atk ? 2 : -1 });
    } else if (name === "Sniper Nest") {
      handled = true;
      if (def && p.state.special && ["physical", "energy"].includes(type))
        use("dice", { amount: 2 });
    } else if (
      /While this character is holding 1 or more objective tokens or Contesting a Secure objective/.test(
        b,
      )
    ) {
      handled = true;
      if (p.state.objective) use("reroll", { amount: 1 });
    } else if (name === "Assassin") {
      handled = true;
      if (atk && other.state.objective) use("reroll", { amount: 99 });
    }
    // Generic templates are deliberately bounded to the character's own roll.
    if (
      !handled &&
      /reduces? (?:the amount (?:of damage )?suffered|the amount of damage suffered|the amount of damage|the amount suffered|damage suffered) by (\d|one|two)/i.test(
        b,
      ) &&
      !/from a collision|suffer collision|damage from collisions/.test(
        b.split(/reduce/i)[0],
      )
    ) {
      handled = true;
      const m = b.match(/reduces?.*?by (\d|one|two)/i),
        min = b.match(/minimum of (\d)/i);
      if (def && (!/from a physical attack/.test(b) || type === "physical"))
        use("reduce", { amount: num(m[1]), minimum: min ? +min[1] : 0 });
    }
    if (
      !handled &&
      ["Guided Infection", "Sentinel Nanotech Corruption"].includes(name)
    ) {
      handled = true;
      if (
        other.state.conditions.includes("root") &&
        (name === "Guided Infection" ? atk : def && distance <= 3)
      )
        use(name === "Guided Infection" ? "reroll" : "opponentReroll", {
          amount: 2,
        });
    }
    if (!handled && name === "Bound") {
      handled = true;
      if (atk && clean(attack.name) === "Vibranium Spear")
        use("reroll", { amount: 2 });
    }
    if (!handled && /reroll/.test(b)) {
      const otherDice =
        /(?:reroll.*(?:attacker's|opposing defense)|rerolls? \d of the attacking character's)/.test(
          b,
        );
      const attackOnly =
        /when attacking|when making attacks|this character (?:makes an attack|attacks)|during (?:its|the next) attack|attack dice for each|while attacking|during the next.*attack|when this character is attacking/i.test(
          b,
        ) &&
        !/attack and defense|attack or defense|attacking or defending|attacks, during.*or defend/i.test(
          b,
        );
      const defenseOnly =
        /(?:when|while) this character is defending|defense or dodge|defense rolls|when this character is targeted/.test(
          b,
        ) &&
        !/attack and defense|attack or defense|attacking or defending/.test(b);
      const objectiveOnly =
        /Interacting|Secure objective|Crisis Card/.test(b) &&
        !/Alternatively/.test(b);
      const otherOnly =
        /another allied|Other allied/.test(b) &&
        !/this character or|this character and/.test(b);
      const range = b.match(/within range (\d)/i);
      const validRange =
        !range ||
        /allied character|this character and allied/.test(b) ||
        distance <= +range[1];
      const count = b.match(
        /reroll (?:up to )?(\d|one|two|three|any)(?: number)?/i,
      );
      if (
        !objectiveOnly &&
        !otherOnly &&
        count &&
        !/genetic|roll.*critical.*opposing/.test(b)
      ) {
        handled = true;
        const enabled =
          (!attackOnly || atk) &&
          (!defenseOnly || def) &&
          validRange &&
          only(b, type);
        if (
          enabled &&
          (!/smaller than this character/.test(b) || other.size < p.size) &&
          (!/holding.*objective|Contesting a Secure/.test(b) ||
            p.state.objective)
        ) {
          if (otherDice) {
            if (
              (/opposing defense/.test(b) && atk) ||
              (!/opposing defense/.test(b) && def)
            )
              use("opponentReroll", { amount: num(count[1]) });
          } else
            use("reroll", {
              amount:
                Number(power.powerCost) === 100 || power.powerCost === "X"
                  ? 99
                  : num(count[1]),
              failures: /including failure|reroll failure/.test(b),
              variable:
                Number(power.powerCost) === 100 || power.powerCost === "X",
              cost:
                Number(power.powerCost) === 100 || power.powerCost === "X"
                  ? 1
                  : Number(power.powerCost) || 0,
              max: /up to 3/.test(b) ? 3 : 99,
            });
        }
      }
      if (!handled && /reroll all/.test(b)) {
        handled = true;
        if ((!attackOnly || atk) && (!defenseOnly || def))
          use("allReroll", { failures: /including failure/.test(b) });
      }
    }
    if (
      !handled &&
      /(?:Add|adds) (?:2|two|3|three) dice to.*(?:attack|defense).*roll/i.test(
        b,
      )
    ) {
      const range = b.match(/within range (\d)/i),
        defense = /(?:Add|adds) (?:2|two|3|three) dice to.*defense/i.test(b);
      const nextAttack =
        /next.*attack|during.*attack|when.*makes an attack/i.test(b);
      const specific = {
        "Web Swing": {
          "amazing-spider-man": ["Spider Strike"],
          "spider-man-miles-morales": ["Webline Kick"],
          "ultimate-spider-man": ["Swinging Strike"],
        }[p.slug],
        "Telekinetic Combat Enhancement": ["Telekinetic Katana"],
        Stampede: ["Gore"],
        Haymaker: ["Strike", "Overpower"],
        "Stop Squealing and Die": ["Claw Slash", "Bloodthirsty Onslaught"],
      }[name];
      if (
        !/another allied|other allied/.test(b) ||
        /this character or|this character and/.test(b)
      ) {
        handled = true;
        if (
          ((defense && def) || (nextAttack && atk)) &&
          only(b, type) &&
          (!specific || specific.includes(clean(attack.name))) &&
          (!range || defense || specific || distance <= +range[1])
        )
          use("dice", {
            amount: /(?:Add|adds) (?:3|three) dice/i.test(b) ? 3 : 2,
          });
      }
    }
    if (!handled && name === "Superior Weight Training") {
      handled = true;
      if (atk) use("dice", { amount: other.size });
    }
    if (
      !handled &&
      /Instead of rolling dice equal to its Defense, it rolls (?:5|five) defense dice/.test(
        b,
      )
    ) {
      handled = true;
      const outside = /not within range 2/.test(b);
      if (def && (outside ? distance > 2 : distance <= 2))
        use("setDefense", { amount: 5 });
    }
    if (!handled && name === "Binary Form") use("dice", { amount: 2 });
    if (!handled && name === "Analyze and Annihilate") {
      handled = true;
      if (atk) use("rerollPerEnemyCrit");
    }
    if (!handled && name === "Multiple Personalities") {
      handled = true;
      if (atk) use("moonKnight");
    }
    if (!handled && name === "Mental Monolith") handled = true;
    if (!handled && name === "Neurokinetic Chronal Armor") handled = true;
    if (!handled && relevant(b))
      warnings.push(`${name}: правило пока не включено в расчёт`);
  }
  return {
    effects: effects.filter((e) => e.amount !== 0),
    warnings: [...new Set(warnings)],
    notes: [...new Set(notes)],
  };
}
export function attackRules(p, other, attack, distance) {
  const text = (attack.steps || []).map(clean),
    b = text.join(" ");
  const result = {
    bonus: 0,
    reroll: 0,
    failures: false,
    allReroll: false,
    critExtra: 1,
    banDefenseMod:
      /defender cannot (?:modify|reroll or modify)|defender cannot modify or reroll/.test(
        b,
      ),
    noDefenseCrit: /defender does not add critical/.test(b),
    noDefenseWild:
      /does not count wild.*success/.test(b) &&
      other.state.conditions.includes("bleed"),
    doubleWild: /each wild.*counts as (?:2|two) successes/.test(b),
    cap: /(?:it deals 1 damage instead|deals 1 damage instead)/.test(b)
      ? 1
      : null,
    noDamage: /does not and the defender loses that much power instead/.test(b),
    pierce: [],
    warnings: [],
    notes: [],
    extras: 0,
  };
  if (/Add dice.*defender's (?:threat|Threat)/.test(b))
    result.bonus += other.threat;
  if (/Add dice.*defender's (?:size|Size)/.test(b)) result.bonus += other.size;
  if (/Add dice.*defender's (?:physical|mystic) Defense/.test(b))
    result.bonus +=
      other.defense[/mystic Defense/.test(b) ? "mystic" : "physical"];
  if (/Add dice.*amount of damage this character has/.test(b))
    result.bonus += p.state.damage;
  if (/Add 2 dice.*for each special condition/.test(b))
    result.bonus += other.state.conditions.length * 2;
  if (/Add dice.*number of times this character has been Placed/.test(b))
    result.bonus += p.state.tokens;
  if (/Add dice.*amount of power the target character has/.test(b))
    result.enemyPowerBonus = true;
  if (/adds 1 die.*each non-Dazed enemy character/.test(b)) result.bonus += 1;
  if (/already attacked|has attacked the target/.test(b) && p.state.attacked) {
    if (/reroll any number/.test(b)) result.reroll = 99;
    const m = b.match(/add(?:s)? (\d) di(?:e|ce) to (?:this|the) attack roll/);
    if (m) result.bonus += +m[1];
  }
  if (/has Advanced or been Placed this Turn/i.test(b) && p.state.moved)
    result.bonus += 3;
  if (/may reroll/.test(b) && !/already attacked|has attacked/.test(b)) {
    const range = b.match(/defender is within range (\d)/),
      bleed =
        /(?:defender|target character) has the Bleed special condition/i.test(
          b,
        ),
      poison = /defender has the Poison special condition/i.test(b),
      flight = /defender has the Flight/i.test(b);
    if (
      (!range || distance <= +range[1]) &&
      (!bleed || other.state.conditions.includes("bleed")) &&
      (!poison || other.state.conditions.includes("poison")) &&
      (!flight ||
        other.powers.some((p) => /(?:^|, )Flight(?:,|$)/.test(clean(p.name))))
    ) {
      const m = b.match(/reroll (?:up to )?(\d|two|one|any)/i);
      result.reroll = m ? num(m[1].toLowerCase()) : 0;
      result.allReroll = /reroll all/.test(b);
      result.failures = /including failure/.test(b);
    }
  }
  if (/roll 2 additional dice instead of 1/.test(b)) result.critExtra = 2;
  for (const step of text) {
    if (/Pierce:|Reality Contortion:/.test(step)) {
      const prefix = step.split(/Pierce:|Reality Contortion:/)[0];
      result.pierce = [
        ...prefix.matchAll(/\b(critical|wild|hit|block|failure)\b/g),
      ].map((m) => m[1]);
    }
    if (
      /spend up to (?:\d|three|seven).*power|spend up to (?:\d|three|seven) additional power/.test(
        step,
      ) &&
      /Add (?:1|one) die/.test(step)
    ) {
      const m = step.match(/spend up to (\d|three|seven)/);
      result.extras = num(m?.[1] === "seven" ? "7" : m?.[1] || "0");
    }
    if (
      /Throw|Thrown/.test(step) &&
      !/another character|other characters|other enemy/.test(step)
    )
      result.notes.push("Бросок цели и столкновения не включены в прямой урон");
    if (/additional.*attack|may make (?:a|an).*attack/.test(step))
      result.notes.push(
        "Дополнительные атаки не суммируются: показан один бросок атаки",
      );
    if (/terrain feature/.test(step) && /Add.*dice|reroll/.test(step))
      result.warnings.push("Бонус от уничтожаемого ландшафта не включён");
    if (
      /allied.*(?:within|character)/.test(step) &&
      /add.*dice|reroll/i.test(step)
    )
      result.notes.push("Бонус от союзных персонажей отсутствует в дуэли");
    if (/Sap Power:|Suppressive:/.test(step)) result.sap = true;
    if (/Clumsy Warrior:/.test(step))
      result.warnings.push(
        "Clumsy Warrior: отдельные 3 урона после атаки не включены",
      );
  }
  if (result.noDamage)
    result.notes.push(
      "Эта атака снимает энергию вместо прямого урона; Devour Mind не переводится в урон",
    );
  return result;
}
