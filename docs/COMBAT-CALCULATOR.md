# Character attack calculator

Implemented 2026-10-23. Standalone «Калькулятор» tab at `#screen=calculator`, with one searchable combobox for each character. Search matches name and alter ego (including punctuation-independent multiword queries); suggestions show portrait, identity and Threat. Mouse/touch and Arrow/Enter selection, Escape/blur cancellation and explicit clearing are supported. Typing only filters suggestions; only a committed selection updates the URL or starts a new calculation. Catalog and battle-detail shortcuts navigate to this page and preselect the first character; the battle shortcut copies form/side, damage and conditions without editing the match. No character dialog remains underneath. Both identities, faces/forms, distance and context live in hash navigation; Back/Forward and reload restore the comparison. Valid old overlay URLs migrate to the standalone page. Changing one character resets only its own context, and tab navigation retains the last comparison. The same character may occupy both slots with independent state. Leaving cancels the worker, and entering from a dirty roster uses the existing unsaved-changes guard. No account, backend, tournament statistics or local-library writes are involved.

## Quantities and scenarios

Each row is **one attack roll against one target**, in both directions. The UI states this scope. Rows for flexible attack types are expanded by type. Beam and area attacks report damage to the selected target, not damage summed over a hypothetical squad. Output includes mean potential damage, probability of at least one damage, and the complete exact damage probability distribution. Displayed numbers are rounded; there is no sampling confidence interval.

- No extra power: the printed attack price is covered; the attacker has zero after paying it, defender starts with zero. Free abilities still work.
- Full power: both start with ten power. Printed attack price, preparatory buffs, superpower surcharges, dice manipulation and reductions spend that budget. It is renewed for each independent row. No power earned during/after the attack is credited.
- A fixed policy activates applicable pool buffs, converts initial skulls, rerolls failures (or all eligible dice if their expected total improves), applies opponent modifications, and reduces damage. Costs are paid only when affordable; variable costs charge per actual die. Fixed powers with several effects are charged once. This is not a minimax optimal strategy, nor an optimization over alternative preparatory actions.
- Cover requires distance >2 and can be ignored by attack/card rules. Range/Stealth gate impossible attacks. Existing attack/defense pools cannot be reduced below one die. A printed zero pool is supported by the pure engine only as a synthetic analytic fixture; current catalog cards have positive pools.
- Health limits context-dependent buffs (e.g. Hulk) to a legal amount of damage on the selected face. Displayed damage is **potential**, not capped by the target's remaining stamina. No Daze/KO transition is simulated.

## Dice and timing

D8 = two hits, two blanks, one critical, one wild, one block, one failure. Initial criticals add one further die, or two for the relevant attacks. Added dice never expand again. Hex and specific critical bans suppress the additional dice.

Cloak of Shadows / Probability Manipulation treats **initial** failures as criticals before Resolve Criticals, spending the actual power and any Root/Loki surcharge. It does not convert failures on the extra dice or failures rolled later. Treat-as survives until the die is subsequently modified and works through an own-modification ban. A ban on additional critical dice still suppresses the extra dice, including those from treated criticals.

The current core rulebook allows a die to be rerolled by **different** abilities. Each die therefore tracks the names of rules already used on it, rather than a single global rerolled flag. Duplicated instances of the same rule cannot reroll the same die twice. All-dice rerolls remain indivisible; they do not become selective rerolls. Criticals on rerolls do not expand.

Own modifications resolve attacker first, defender second, then opponent modifications attacker first, defender second. Count-as effects remain distinct from modifications. Pierce removes one eligible defense face if the complete required symbol multiset exists. Remaining face counts feed success totals, followed by caps and damage reduction.

## Covered mechanics

The card-driven rule compiler handles common and named self effects: physical/energy/mystic restrictions; attack/defense pool increases; fixed/variable/full rerolls and failure permissions; own-dice modification bans; initial critical suppression; skull/blank counting and double wilds; opponent rerolls and wildcard cancellation; Pierce; flat reduction with its actual minimum; paid mitigation; Namor's reduction prevention; Mysterio's defense substitution/payment; Supergiant's physical damage cap; conditional size/threat/defense/power/condition/damage scaling; mutually exclusive defensive stances and paid switching; selected tokens, previous attacks/movement and objective context. Conditions respect card immunities.

There are explicit adapters for Cloak, Probability Manipulation, Empowered Gauntlets, Eye of Agamotto, Spider-Sense variants, Arrogance, Echo, Dormammu, Loki, MODOK, Ronin, Shuri/Killmonger, Scarlet Witch and other specialized count/modify effects. Most common buffs/reductions use bounded card-text templates. Adding or refreshing a card requires checking rule coverage, not just making the JSON load.

## Limits made visible in the UI

- Ally/leadership/tactics/gem effects, other enemy auras, destroyed terrain, collisions, counterattacks, status damage on later turns, and additional generated attacks are excluded. Terrain-dependent dice bonuses are flagged on the affected row rather than silently treated as implemented.
- Chronokinesis and Temporal Rewind jointly reroll both sides and are explicitly marked unsupported. Moving Tippy-Toe to the opponent is also flagged; the initial token on Squirrel Girl herself is supported.
- Preparatory movement is assumed possible for a paid move/buff. Actual paths, LOS, action-count restrictions and collisions are not solved. State-dependent innate movement/previous-attack buffs require the relevant context toggle.
- Dice policies favor immediate successes. The probabilities are exact for the declared fixed policy and implemented rules; they do not establish optimal play or rules completeness. Different choices of which dice to modify can change the result. Resource guards reject an oversized state space explicitly; they never replace it with samples or drop low-probability tails.
- The known rule adapters do not prove universal coverage of arbitrary future card wording. Unknown relevant powers are marked as partial calculations. Tests walking every card establish compatibility/finite results, not rules completeness.

## Implementation and validation

`frontend/src/combat/profile.js` normalizes the selected card face and context. `rules.js` compiles applicable effects. `exact-dice.js` builds finite probability distributions and weighted transitions; `exact-policy.js` defines face equivalence, costs and dice choices; `engine.js` conditions the two rolls correctly and computes the final damage distribution. The bundled Blob Worker runs the exact calculation; changing selection terminates stale work. No calculation runs on the UI thread. `calculator.jsx` mounts the calculator page only while its tab is active; `CardStore` owns route-visible inputs. Library saves, battle state and tournament ratings are independent.

## Exact calculation

For ordinary independent rolls, with criticals adding only one non-expanding die, the single-original-die generating polynomials are

\[
F_A(z)=\tfrac12+\tfrac{7}{16}z+\tfrac1{16}z^2,\qquad
F_D(z)=\tfrac58+\tfrac{21}{64}z+\tfrac3{64}z^2.
\]

With attack pool n and defense pool m, coefficients of \(F_A^n\) and \(F_D^m\) give success probabilities. Expected damage is \(\sum_{i,j}P(A=i)P(D=j)\max(0,i-j)\), followed by the actual caps and reductions. Applying the positive-part function only to the two means would be incorrect.

For abilities the state includes the observable face counts, power remaining, and reroll-rule usage when that rule can appear again. Face classes merge only when every relevant later effect observes them identically. Unobserved results are marginalized, not discarded. Replacement rolls use multinomial coefficients with physical d8 face weights2,2,1,1,1,1. Initial criticals are compound outcomes; a bonus die never recursively adds another die.

Cloak/Probability Manipulation transforms only initial failures and charges the available budget, including a Root/Loki tax once per activation. The compound transition may commute an initial critical's independent bonus dice with later initial dice because those bonus dice cannot activate Cloak. It retains the same joint distribution of all observable faces and power. Empowered Gauntlets pays once for all initial failures. Moon Knight's activation effect is an exact5/8 versus3/8 mixture.

The engine preserves cross-roll dependence. It first groups initial defense outcomes by the critical count observed by the attacker's modifiers (Echo/Ultron), then groups the modified attack roll by the critical count observed by the defender. Opponent modifications resolve afterwards in order. Replacing these distributions with independent marginals would give an incorrect answer. Remaining equivalent states are merged after each phase; ordinary attacks collapse to very small success distributions.

The output is \(P(D=k)\), its mean and \(1-P(D=0)\). Floating-point arithmetic remains subject to normal numerical rounding; there is no Monte Carlo error. Probability mass is validated before correcting numerical summation drift. No epsilon cutoff or low-probability pruning is used. State/cross-product and cache bounds protect browser resources; a bound produces an explicit error rather than an approximate number.

Choices are deterministic: own rerolls select allowed zero-success faces; all-dice rerolls occur only when they improve expected own successes; opponent rerolls choose the highest-success faces. Ties use a fixed face order. Pierce prioritizes the greatest immediate defensive loss, including removal of a wild that could cancel an attacking success. Defensive cancellation prioritizes the greatest immediate success loss. These declared choices replace the previous simulator's incidental original-array tie order, so some means can differ beyond the old sampling noise. Joint all-dice powers still listed as unsupported are not silently approximated.

The conversion also fixes typed defensive rerolls being applied offensively (Hulk Not Puny Banner and similar wording), attack-action rerolls being applied defensively (For Midgard), and preserves Dormammu's copied failure dice for Loki's subsequent opposing-failure count. Current card wording takes precedence over older wording in forum discussions.

Validation uses two independent methods: closed-form polynomial convolution, including30-versus30 pools, and exhaustive ordered-face enumeration for small pools. The latter imports no production transition/partition/formula helpers and checks the whole damage distribution across Cloak budgets, taxes, reroll permissions and rule reuse, all-dice rerolls, cross-roll critical observations, Pierce, forced rerolls, absorption, caps/reduction, block substitution and paid face conversion. Other checks walk every current card face/form, require normalized nonnegative distributions, retain tiny tails, ban RNG calls, and cover browser history, cancellation, retries and ordinary page navigation. Development stress checks include maximum Kill Count,28-die Apocalypse attacks, doubled criticals and mutually coupled Echo/Strange matchups.


## Primary rule sources (internal reference)

Verified 2026-10-23. Use current local card JSON rather than obsolete versions quoted in old discussions.

- [Official current MCP rules hub](https://www.atomicmassgames.com/mcp-rules/).
- [August 2026 core rulebook](https://cdn.svc.asmodee.net/production-amgcom/uploads/2026/08/CP143en_RevisedCoreSet_Rulebook_08_2026.pdf): p.10 dice faces; p.15 attack sequence, minimum pools and per-ability reroll rules; p.17 excess damage. Downloaded and text-inspected locally when the web reader could not extract the 42MB PDF.
- [Eye of Agamotto timing, moderator June 11, 2026](https://forums.atomicmassgames.com/topic/20592-eye-of-agamotto-timing/): normal placement in Modify Dice; owner chooses order of appropriate effects.
- [Eye of Agamotto full reroll clarification](https://forums.atomicmassgames.com/topic/290-dr-stranges-eye-of-agamotto-power/).
- [Darkforce Strike all-dice reroll](https://forums.atomicmassgames.com/topic/6930-darkstar-darkforce-strike-rerolls/): all eligible dice, not a chosen subset.
- [Cloak of Shadows treat-as clarification](https://forums.atomicmassgames.com/topic/6962-malekith-cloak-of-shadows-treats-as-skulls-to-crits/): treated symbols are read consistently by both sides. Some surrounding old discussion uses obsolete Malekith abilities; the local card is authoritative for implemented text.
