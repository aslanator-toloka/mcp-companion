# How an AI player plays Game

You control one side (`p1` or `p2`) in Marvel Crisis Protocol against another model. The server is already running; the port is given in your task as `PORT`.

## Commands (from the repository root)

```bash
PORT=<port> node scripts/ai-player.cjs brief   <side>                  # roster, tactics, crises — once at the start
PORT=<port> node scripts/ai-player.cjs wait    <side> 100              # wait for your decision (up to 100 s); returns state and actions
PORT=<port> node scripts/ai-player.cjs state   <side>                  # current state without waiting
PORT=<port> node scripts/ai-player.cjs scout   <side>                  # enemy profiles: HP, defenses, attacks, conditions they inflict, role
PORT=<port> node scripts/ai-player.cjs card    <side> <slug>           # stat card: attacks and superpowers
PORT=<port> node scripts/ai-player.cjs mission <side>                  # chosen crises: rules and VP scoring
PORT=<port> node scripts/ai-player.cjs reach   <side> <type> [fighter|power] [x,y]   # legal points; with x,y — the closest to that target
PORT=<port> node scripts/ai-player.cjs act     <side> '<JSON>' '<short reason>'       # make a move
```

- Deployment alternates: after each of your `deploy` commands, call `wait` again.
- Interact and Active superpowers do not spend actions (Interact costs 1 Power), except superpowers whose text starts with "Action:". So `power` can appear in actions even with `actionsLeft: 0`.
- Use **only** actions listed in `actions`. Take `type` and `value` from there.
- Before `advance` / `climb` / `deploy` / a moving superpower, get a point with `reach … x,y` and send one of the `best` points.
  Example: `reach p1 advance 18,18` → `act p1 '{"type":"advance","x":15.5,"y":12}' 'moving to the Power Core'`.
  Deployment: `reach p1 deploy p1:hulk 18,6` → `act p1 '{"type":"deploy","fighter":"p1:hulk","x":18,"y":6}' '...'`.
- Attack: `{"type":"attack","index":<attack index>,"target":"<target id>","damageType":"physical"}` (add `"angle"` for a beam). See `actions[].attacks` for parameters.

### State fields that help you decide

- `scoreForecast`: score now, after the next Cleanup if nothing changes, VP left to 16, and an `alert` when the match is decided this round. Check it at the start of every activation.
- `scoringNow`: which objectives would score for you or the enemy if Cleanup happened now. Your main compass.
- `objectiveDistance` (active fighter only): distance to each free objective and how many Advances it takes to reach Range 1.
- `underThreat`: which enemies can reach each of your fighters (their Advance + longest attack) and whether they have already activated this round.

### Command formats (common mistakes from earlier matches)

| Action | JSON |
| --- | --- |
| Squad | `{"type":"squad","characters":["hulk",...],"tactics":["battle-plan"],"affiliation":"Avengers"}` — slugs without `p1:`; set `affiliation` if more than half of the squad belongs to it, otherwise you get no Leadership |
| Attack | `{"type":"attack","index":0,"target":"p2:mystique","damageType":"physical"}` — `damageType` is required |
| Beam (range `B…`) | the same plus `"angle": 90` (degrees clockwise from "right"; towards a target: `atan2(dy,dx)`) |
| displace with `mode: "push"` or `"throw"` | `{"type":"displace","angle":-90}` — an angle, not x,y |
| displace with `mode: "advance"` or `"place"` (Slippery, Journey Through Limbo, Asteroid M…) | `reach <side> displace <x,y>` → `{"type":"displace","x":..,"y":..}` — a point, not an angle |
| Reroll dice | `{"type":"modify-dice","id":"<id from actions>","indices":[2,5]}` — only legal indices from actions |
| Change a die face (`kind: "change"`) | `{"type":"modify-dice","id":"<id>","indices":[1],"face":"critical"}` — `face`: critical, wild, hit, block, failure, blank |
| Reactions, tactics, effect options | copy the option's fields from `actions` as they are: `{"type":"reaction","value":"Perfect Block","key":"p1:…:Perfect Block"}` |
| Sequence superpower (Charge etc.) | first `{"type":"power","value":"Charge"}`, then `granted-move` appears in actions → `reach <side> granted-move x,y` → `{"type":"granted-move","x":..,"y":..}`, then the attack |
| Paying with another fighter's Power (e.g. Red Skull) | if the attack option lists `payers`, add `"payer":"<one id from payers>"` (singular) to the attack |
| Superpower with a target | `{"type":"power","value":"<name>","target":"<id from the power's targets>"}`, then resolve any `displace` it creates |
| Activate a fighter | `{"type":"activate","value":"<fighter id>"}` — only on your turn, when `activate` is in actions |
| Interact | `{"type":"interact","value":"<value from actions[].interacts>"}` — copy the value exactly (e.g. `freedom|secure:…`) |
| Reduce damage | `{"type":"modify-dice","id":"<id>","amount":1}` |
| Drop an objective | `{"type":"drop-objective","x":..,"y":..}` — within Range 2 (3") of its position |
| Moving superpower | first `reach <side> power "<name>" x,y`, then `{"type":"power","value":"<name>","x":..,"y":..}` |

- If `act` returns `ok:false`, read the error (and `hint`, if present), refresh `state` and fix the command. Do not repeat the same command more than twice — choose a different action (`end`, `pass`, something else).
- The second argument of `act` is a short reason (one sentence). The engine logs what actually happened on its own.
- Play until `phase` is `finished`. If `wait` returns `waiting:true`, just call `wait` again.

## Rules in brief

- The battlefield is 36×36 inches. Range: 1 = 1", 2 = 3", 3 = 6", 4 = 8", 5 = 10". Movement tools: S = 3.25", M = 5", L = 7.25" (the base also moves its diameter).
- Setup: Priority roll → crises (Secure and Extract) → Threat → deployment edge → squad (total threat ≤ Threat, ≤ 1 Peerless, up to 5 tactics, affiliation if more than half of the squad belongs to it) → deployment → Leadership.
- A round: sides alternate activating one fighter each. A fighter has 2 actions: advance (move), attack, and superpowers marked "Action:". Interact and other Active superpowers are free. `end` ends the activation.
- Grunts (e.g. Ultron Drones) are not chosen to activate. When you activate the parent, the grunt activates first, then the parent right away. If the parent is Dazed, the grunt does not activate this round; if the parent is KO'd, the grunt is removed. Grunts have no Power and do not count for `pass`.
- Power: +1 to everyone in the Power Phase; a fighter gains Power when it suffers damage. Power pays for strong attacks, superpowers, tactics and Interact.
- Damage: a Healthy fighter at 0 HP becomes Dazed (flips to Injured in Cleanup); an Injured fighter at 0 HP is KO'd.
- VP are scored in Cleanup every round:
  - **Secure**: an objective is yours if more of your (non-Dazed, non-Grunt) fighters are within Range 1 of it than enemy ones. Healthy fighters outweigh Injured ones.
  - **Extract**: 1 VP for each of your fighters holding an objective (Interact to pick it up).
- Victory: 16+ VP, or the most VP after round 6.

## Tactics

Before the match read `docs/ai-play/TACTICS.md` — the lessons learned from earlier matches.
