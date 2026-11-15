# AI player tactics

Version 1.6 — based on four matches (see `matches/`): `2026-11-14-avengers-vs-cabal` (Cabal 19:9), `2026-11-14-match2-avengers-vs-cabal` (Cabal 16:9), `2026-11-14-match3-avengers-vs-cabal` (Avengers 17:11), `2026-11-14-match4-xmen-vs-brotherhood` (X-Men 19:10).

Match 3 confirmed sections 2a, 2b and 6: both players planned fighter → objective at deployment, cheap fighters held objectives, holders retreated with their Spellbooks — and the side that did it better scored 4–5 VP every round. A rule is added here only when the engine log confirms it, not a model's opinion.

## 1. VP matter more than damage

The winner is whoever scores more VP every Cleanup. In match 1 the winner dealt less damage but scored 4 VP a round against 1–3.
Before every activation look at `scoringNow` and ask: "How does this move change VP in the next Cleanup?"

### Count the score every turn

The state contains `scoreForecast`, computed with the same function the engine uses in Cleanup:
- the score **now** and **after this Cleanup if nothing changes**;
- **VP left to 16** for each side;
- an **`alert`** when this Cleanup decides the match.

How to read it:
- Victory is 16+ VP after Cleanup with unequal scores, or the most VP after round 6.
- **If `alert` says DEFEAT**, every activation this round goes into **denying enemy VP**: Daze a holder, outnumber him on a Secure objective. Your own new VP only help if they tie or overtake the enemy. Match 2, round 4: the forecast was 9:16. Avengers lose unless they take at least 1 VP away from Cabal; an extra VP of their own changes nothing.
- **If `alert` says VICTORY**, do not risk your holders or fighters on Secure objectives; move them only to protect them.
- An objective taken from the enemy shifts the difference by 2 VP (−1 for him, +1 for you); a new one of your own only by 1.

## 2. Setup

- **Always set the affiliation** if more than half of the squad belongs to it. Without it you get no Leadership (in match 1 the Cabal Leadership fired in 3 of 5 attacks).
- Take at least 1–2 fast fighters (M/L) for Extract: collecting objectives in the first two rounds decides the match.
- Choose tactics for the characters in the squad: a card for someone else will not play.

## 2a. Every fighter's role and the price of its threat

Every fighter in the squad needs a job worth its threat. Before choosing the squad and before deployment, answer for each one: **"What does it do that a cheaper fighter could not?"**

- **Holding your own safe objective** is a job anyone can do. It belongs to the **cheapest** fighter (threat 2–3), not the most expensive one. Match 2: Mystique (threat 3) held a Spellbook on a console at Cabal's edge. Hulk (threat 6) did the same at Avengers' edge: 1 Advance, 1 pickup and 7 unused actions out of 8 over 4 rounds. Same job, Avengers paid twice as much for it and were short on the flanks, where Cabal held 2 consoles unopposed.
- **Expensive heavy hitters** (strong attacks, lots of HP, threat 5–6) work where the score is decided:
  - contest enemy and contested Secure objectives;
  - knock out holders;
  - stand so that the enemy is afraid to come to the centre.
- **A slow expensive fighter (S)** will not get there in time if deployed far away. Deploy it right on the lane of the contested objective, not at your own edge.
- **Fast fighters (L)** collect Extract objectives and intercept distant ones.
- **Long-range fighters** pressure holders from behind cover.
- **Power is a resource to spend.** If a fighter has 4+ Power and does not act, you are wasting its best attacks and superpowers. For example, Gamma Leap places Hulk closer to his target.

Warning sign: an expensive fighter ends its activation without any action two rounds in a row. Revisit the roles: swap it with a cheap fighter or send it to a contested objective.

## 2b. "Fighter → objective" plan before deployment

Deployment already decides who takes which objective. Do not place fighters "in the centre" or "next to the leader". Before the first `deploy`, write a table and put it in `why`:

| Objective | Type | Who takes it | Why this fighter |
| --- | --- | --- | --- |
| Console @6,18 | Secure | Crossbones | near flank, M speed, holds the position |
| Spellbook @18,18 | Extract | Black Widow | L speed, gets there in R1, Interact right away |

How to assign:
- **One task per fighter**; two fighters on one objective only on purpose (Secure goes to the majority, so put two on a contested one). In match 2 Hulk and Black Widow both went for the same Spellbook @18,26, while nobody planned for the side consoles @6,18 and @30,18.
- **Objectives closest to your edge** go to slow and tough fighters (S, lots of HP): arrive, stand, hold.
- **Central and contested objectives** go to fast (L) or tough fighters. The enemy will come there, so you need someone who survives a hit or arrives first.
- **Extract objectives** go to fighters with good speed. Ideally, after the pickup the holder can stand within Range 1 of a Secure objective (double scoring, see below).
- **Long-range fighters**: place them so they can shoot the contested objective from behind terrain, not in front of everyone.
- **Put each fighter on its lane**: opposite its objective in your deployment zone. Check with `reach <side> deploy <id> x,y` that it reaches the target in 1–2 Advances in R1.
- **Deployment alternates**: watch where the enemy places and adjust. If his fast fighter stands opposite a free objective, reinforce that lane or pick another objective.
- **Count the balance**: how many objectives can you really control by Cleanup in R1 and R2? You do not need all of them, just more VP than the enemy.

## 3. Rounds 1–2: take the objectives

- In R1–R2 every fighter that can reach a Power Core or another Extract objective goes for it: Advance + Interact.
- The best position is an Extract holder within Range 1 of a Secure objective: it scores 2 VP a round.
- Do not leave an enemy Extract unanswered: every round he holds it costs you VP.

## 4. Use both actions

- `end` with **any** unused action is almost always a mistake, not only with two. If the fighter already stands on an objective, attack an enemy in reach but do not leave the objective.
- If there is nobody to attack and you must not leave, `end` is fine. Say so in `why`.
- **"I'll get there next round" is a mistake if you can get there now.** Before `end` with an action left, check `reach <side> advance <objective x,y>`: if `best` contains a point within reach of the objective, go. An objective you start controlling this round scores in this Cleanup.

### Movement arithmetic (calculate, do not guess)

- An Advance moves a fighter's centre at most `tool length + 2 × base radius`. Engine tools: S = 3.25", M = 5", L = 7.25", plus the base diameter. With a 35 mm base (radius 0.69") an M fighter moves up to 6.38" centre-to-centre per Advance, an L fighter up to 8.63".
- To control an objective (Range 1), the **centre-to-centre** distance must be ≤ `1 + fighter radius + token radius` ≈ 2.19" for a 35 mm base. Base radius = diameter in mm / 50.8.
- So an M fighter on a 35 mm base reaches an objective ≤ 8.57" away (centre-to-centre) with 1 Advance, and ≤ 14.95" with 2 Advances in one activation. An L fighter: ≤ 10.8" and ≤ 19.4".
- Match 2 example: Crossbones started 12.65" from a console — 2 Advances, first turn. He made one (to 8,12) and ended the activation, although a second Advance led to 5.25,16, within Range 1 of the console. That most likely cost 1 VP in the very first round.
- `objectiveDistance` in the state gives this estimate for the active fighter.

## 5. Whom to attack

There is no single rule "always hit X". Choose the target that changes the next Cleanup and the enemy's next turn the most. Candidates, roughly in order of value:

1. **An enemy objective holder.** Dazed drops the objective and removes him from scoring.
2. **A threat to your holders.** An enemy that can reach your holder in his activation (his speed + attack range) and hits hard enough to knock him out. Sometimes removing him matters more than hitting an enemy holder.
3. **A future holder.** A fast (L) or strong fighter next to a free objective will pick it up in his activation. Stop him while the objective is still unclaimed.
4. **A wounded fighter you can finish.** Dazing an Injured fighter means KO: the enemy loses him for the rest of the match.

**Timing matters.** A fighter Dazed **before his activation** this round loses it: Dazed fighters do not activate (Core Rulebook, "Character Damage"). If an enemy has not activated yet and is close to Dazed, hit him now — it takes a whole turn away from the enemy. A fighter who already activated loses less from being Dazed.

More rules about Dazed:
- A Dazed fighter **cannot be attacked** and is not affected by superpowers. Do not waste actions on him; switch targets.
- Dazed fighters score no VP and do not contest objectives. In Cleanup a Dazed fighter removes damage and flips to Injured with full HP.

After you knock an objective loose:
- Drop it **towards your fighters and away from the enemy**, and pick it up in the same or the next activation. In match 1 the enemy twice picked up an objective dropped next to him.
- Do not spend expensive attacks on tanks (Hulk, 20 HP) when a more valuable target from the list above is in reach.

## 5a. Read the opponent before the first move

After squads are revealed, call `scout <side>`. For every enemy it gives HP, defenses, speed, attacks with strength and range, the conditions they inflict and a role from the stats. Build a short threat map and update it when HP, Power and conditions change.

- **Hard hitters**: attacks of 7+ dice, especially cheap ones (0–2 Power). Do not leave a holder in such a fighter's zone: speed plus attack range.
- **Tank** (stamina 8+ or every defense 4+): slow to knock out. Attack him only if he holds an objective or is the only threat.
- **Fragile** (stamina ≤ 5 or a defense of 2): quick to knock out. A good target, especially before his activation.
- **Long range** (Range 4+, beams B…): reaches from behind cover. Hide your fighters behind terrain out of his line of sight, or get into base contact.
- **Fast (L)** reaches objectives first. **Slow (S)** is only dangerous near himself.
- **Weak defense** (`weakestDefense`): attack with the damage type he rolls the fewest defense dice against.
- **Conditions** the enemy inflicts (Core Rulebook, Appendix B). The same condition never stacks. Damage from conditions gives no Power.
  - **Stagger**: the first action of the activation must be `shake` to remove it. The fighter loses an action.
  - **Slow**: Advance only with Short (3.25"). Cannot reach distant objectives.
  - **Bleed**: 1 damage at the end of each of its activations. Finishes wounded fighters.
  - **Incinerate**: 1 fewer defense die. A convenient target for your attacks.
  - **Shock**: 1 fewer attack die.
  - **Hex**: Criticals add no extra dice in attack, defense or dodge rolls.
  - **Poison**: −1 Power in the Power Phase.
  - **Stun**: gains at most 1 Power at a time. Stops saving up for strong attacks.
  - **Root**: pays 1 extra Power before Active and Reactive superpowers.
  - **Judgment**: gains no Power from damage dealt by enemy attacks.
  - **Push, Throw** (attack effects, not conditions): the enemy can drag your fighter off an objective.
- **Enemy Power** is a threat too. A fighter with 4+ Power can make his strongest attack or reaction. Keep it in mind when you approach.

## 5b. Mobility vs slow hitters

Match 4 (X-Men 19:10 Brotherhood): fast Extract holders (Quicksilver, Shadowcat) picked up Spellbooks and kept moving out of reach while still scoring; the slow Brotherhood hitters (Magneto S, Pyro) never caught them.
- With a slow squad, **do not chase** fast holders across the board. Block their path earlier: stand between them and their retreat, or put your own holder on the objective first.
- With a fast squad, take Extract objectives early and keep the holders moving away from the slow hitters' threat zone.
- Before attacking, check redirections: Can't Touch This, Big Brother and similar powers move the damage to another fighter. If they keep triggering, switch targets instead of repeating the same attack.

## 6. Do not expose your holder

**Interact costs 1 Power, not an action** (Core Rulebook, "Objective tokens"). So "Advance → Interact → one more action" is normal, and a holder almost always has an action left after the pickup. An Extract objective scores anywhere; there is no need to stay where you picked it up. Options for the remaining action:

1. **Move away** with a second Advance out of the threat zone: towards your fighters, behind terrain, within Range 1 of your own Secure objective (where he scores twice).
2. **Attack** with a free attack (cost 0), especially one that inflicts a harmful condition on whoever will come for your holder.
3. `end` out in the open next to enemies is the worst option.

Match 2, round 2: Red Skull Advanced to 18,18 and picked up a Spellbook, then ended his activation with an action left ("no second action worth the exposure"). He stayed inside the threat zone of Hulk, Black Widow, Cap and Iron Man. What was available:
- An Advance back to ~17.5,12: within Range 1 of his own console @18,10 and out of Hulk's reach.
- A free Cosmic Burst (Range 4, 5 dice, Wild → Shock) on Black Widow 4" away or Iron Man 7" away. Shock means −1 attack die for whoever comes to hit him.

Next round Iron Man dealt him 3 damage.

The state contains `underThreat`: which enemies can reach each of your fighters (their Advance + longest attack) and whether they have already activated this round. **An enemy marked "still to activate this round!" is the most urgent threat.**

- A holder should not end his turn within reach of a strong enemy melee fighter (Range 2–3 + his speed). In match 1 Ultron with a Power Core stopped next to Hulk, lost the objective and then himself.
- Keep your fighters on Secure objectives until Cleanup: leaving one for a 0-damage attack cost p1 a VP in match 1. In match 3 Zemo left Vault @30,18 to chase Iron Man, the attack failed, and Hawkeye took the vault (+1 VP for the enemy). Leave an objective only if the attack is likely to Daze a holder, and count the VP both ways first.

## 7. Commands

- Range levels are not inches: Range 1 = 1", 2 = 3", 3 = 6", 4 = 8", 5 = 10". In match 3 Sabretooth treated Range 2 as 6" and lost his attack.
- Never guess coordinates: there is terrain on the battlefield (benches, cars, buildings) and a base cannot stand on it. In match 1 Hulk tried to leap into a bench 5 times while plenty of free points were next to his target. Call `reach … x,y` before every move, deployment or placing superpower.
- After two errors in a row, re-read the formats in `PLAYER-GUIDE.md` and choose a different action.
