# Character attack calculator

Implemented 2026-10-23. Standalone «Калькулятор» tab at `#screen=calculator`, with independent search/selection for both characters. Catalog and battle-detail shortcuts navigate to this page and preselect the first character; the battle shortcut copies form/side, damage and conditions without editing the match. No character dialog remains underneath. Both identities, faces/forms, distance and context live in hash navigation; Back/Forward and reload restore the comparison. Valid old overlay URLs migrate to the standalone page. Changing one character resets only its own context, and tab navigation retains the last comparison. The same character may occupy both slots with independent state. Leaving cancels the worker, and entering from a dirty roster uses the existing unsaved-changes guard. No account, backend, tournament statistics or local-library writes are involved.

## Quantities and scenarios

Each row is **one attack roll against one target**, in both directions. The UI states this scope. Rows for flexible attack types are expanded by type. Beam and area attacks report damage to the selected target, not damage summed over a hypothetical squad. Output includes mean potential damage, probability of at least one damage, and an estimated 95% Monte Carlo error interval.

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
- Dice policies favor immediate successes, not the downstream value of a trigger. Paid-ability ordering and unmodeled effects can create error much larger than the displayed sampling interval. That interval is labeled as sampling uncertainty only.
- The known rule adapters do not prove universal coverage of arbitrary future card wording. Unknown relevant powers are marked as partial calculations. Tests walking every card establish compatibility/finite results, not rules completeness.

## Implementation and validation

`frontend/src/combat/profile.js` normalizes the selected card face and context. `rules.js` compiles applicable effects. `engine.js` owns dice, resource and damage resolution. A bundled Blob Worker runs 60,000 reproducibly seeded trials per row/scenario; changing selection terminates stale work. No compute runs on the UI thread. `calculator.jsx` mounts the calculator page only while its tab is active; `CardStore` owns route-visible inputs. Library saves, battle state and tournament ratings are independent.

Tests include independent analytic one-die expectations, initial skull/critical timing, critical and modification bans, per-ability rerolls, power budgets, reductions/minimums, Pierce, full rerolls, damage caps and substitutions, type/range/context/immunity rules, and both faces/forms of the entire current catalog. Browser tests cover comparisons, mobile layout, retries, rapid selection/cancellation, independent and mirrored selections, page navigation from catalog/battle details, dirty-roster guards, legacy links and URL restoration.

## Primary rule sources (internal reference)

Verified 2026-10-23. Use current local card JSON rather than obsolete versions quoted in old discussions.

- [Official current MCP rules hub](https://www.atomicmassgames.com/mcp-rules/).
- [August 2026 core rulebook](https://cdn.svc.asmodee.net/production-amgcom/uploads/2026/08/CP143en_RevisedCoreSet_Rulebook_08_2026.pdf): p.10 dice faces; p.15 attack sequence, minimum pools and per-ability reroll rules; p.17 excess damage. Downloaded and text-inspected locally when the web reader could not extract the 42MB PDF.
- [Eye of Agamotto timing, moderator June 11, 2026](https://forums.atomicmassgames.com/topic/20592-eye-of-agamotto-timing/): normal placement in Modify Dice; owner chooses order of appropriate effects.
- [Eye of Agamotto full reroll clarification](https://forums.atomicmassgames.com/topic/290-dr-stranges-eye-of-agamotto-power/).
- [Darkforce Strike all-dice reroll](https://forums.atomicmassgames.com/topic/6930-darkstar-darkforce-strike-rerolls/): all eligible dice, not a chosen subset.
- [Cloak of Shadows treat-as clarification](https://forums.atomicmassgames.com/topic/6962-malekith-cloak-of-shadows-treats-as-skulls-to-crits/): treated symbols are read consistently by both sides. Some surrounding old discussion uses obsolete Malekith abilities; the local card is authoritative for implemented text.
