# Player-adjusted character rating v1 (experimental)

This metric is displayed alongside historical tournament points. It estimates associations with **inclusion in a ten-model roster**, not the strength of a character actually fielded in a game. No actual match squads or opponents are in the archive. It is a deterministic statistical calculation, not an LLM judgement.

## Input and scope

`frontend/src/character-rating.js` is the shared pure implementation used by tests, the audit script and the browser worker. Inputs are raw wins/losses and roster membership. Old points, placing, field size and the previous +5% win bonus do not enter this estimator.

Before filtering, group the full archive by `(playerId, eventId)`. Keep only a single unambiguous list, a completed individual result, a fully identified roster of exactly ten distinct non-grunt catalog identities, and positive integer `W+L`. Multiple lists, incomplete or unconventional roster sizes, doubles, provisional events and invalid records are excluded from this experimental metric, but remain in the archive and historical points. Draws are excluded from the response denominator; a draw-only result has no response. A result may include draws alongside decisive games.

Country and affiliation filters restrict the eligible cohort and refit the entire model. Multiple affiliations use their union without duplication. A selected individual player changes displayed roster history and old points, **not** the calibration population. Search, character selection, collection readiness and roster list sorting do not change the model. Within-player comparisons and support counts refer to the selected cohort, not the pilot's full unfiltered history.

## Estimator

For performance i of pilot p:

- `n_pi = W_pi + L_pi`; response `y_pi = W_pi / n_pi`.
- `G_p = sum_i n_pi` and `q_pi = n_pi / G_p`.
- Bounded pilot reliability `r_p = G_p / (G_p + 8) < 1`.
- `x_pi` contains an intercept, all roster membership indicators, and an event indicator.
- `xbar_p = sum_i q_pi x_pi`, `ybar_p = sum_i q_pi y_pi`.

Fit intercept μ, character coefficients β and event coefficients γ by minimizing:

```
sum_p r_p sum_i q_pi [ (y_pi - ybar_p) - (x_pi - xbar_p)'θ ]²
+ 0.15 sum_p r_p [ ybar_p - xbar_p'θ ]²
+ 2 sum_c β_c²
+ 1 sum_e γ_e²
```

The first term is strong within-pilot evidence. The second is weak between-pilot evidence: permanent picks and singleton pilots can contribute with weight 0.15. **That is an evidence weight, not a promise that exactly 15% of a final rating comes from permanent picks.** With only between-pilot data, player skill and character choice remain confounded; many permanent pilots can still create a biased association. No observational method here can identify a character effect independently of unchanging pilot/roster combinations without further assumptions.

Equivalently, the fitted player deviation is `a_p = 0.85 * (ybar_p - xbar_p'θ)` with a quadratic penalty on player deviations. This gives partial adjustment rather than subtracting every player's own mean and erasing permanent choices. All roster characters are fitted simultaneously. Penalizing character coefficients reduces sparse estimates, but always-cooccurring characters still cannot be separated; equal penalties split their shared signal.

Pilot influence saturates: 100 repeated performances cannot become 100 independent pilots. They improve the weight toward 1 and may reveal within-pilot contrasts. They do not directly multiply total pilot weight. An event effect adjusts for the observed event context; it does **not** measure the strength of the field, and Swiss pairings are not modeled.

With fixed roster size, the character coefficients are anchored by the intercept and equal ridge penalties (their sum is zero up to solver tolerance). The displayed **R = 100 β_c** is a relative coefficient in percentage points of modeled win fraction. It is neither a calibrated change in win probability, nor an absolute causal power score. Models with no eligible observations show `—`, not an artificial neutral score. Other sparse models can have a nonzero estimate and an explicit low-comparison warning.

All constants are initial, fixed experimental choices, not statistically proven optima. They were not tuned on the chronological holdout.

## Numerical and browser behavior

A preconditioned conjugate-gradient solver operates on sparse equations with an explicit convergence check. A nonconverged or unavailable worker produces an error and retry control; historical scores remain usable. Fitting runs in a dedicated Web Worker embedded in the built JS, without an additional network request. The store caches eight cohort fits, ignores stale results, and never displays a preceding cohort's rating during recalculation. Choosing another character/player does not refit.

## Validation and audit

```
npm test
npx playwright test tests/e2e/character-rating.spec.cjs tests/e2e/tournament-countries.spec.cjs
node scripts/audit-character-rating.mjs
```

The audit regenerates `data/character-rating-audit.json` from the current published archive. Re-run after a data refresh. It contains parameters, coverage, exact estimates, a chronological holdout, and 100 seeded resamples of complete player histories. The bootstrap's empirical 90% ranges describe sampling stability under this model; they are not calibrated causal confidence intervals. Event dependence and roster selection may make them optimistic, so the UI does not present them as causal certainty.

Tests cover unequal pilot skill, neutral characters and event swings, within-pilot improvements, nonzero but weaker permanent-pick evidence, saturation of a prolific main, variants and incomplete records, losses, unused characters, determinism, numerical convergence, stale asynchronous results, country/affiliation cohorts, player selection, URL history/reload, mobile layout, worker failure and retries. Synthetic cases verify designed behavior; they do not establish correctness of a real-world causal ranking.

For the 2026-08-05–2026-10-21 snapshot:

- 2,270 performances, 1,466 players and 233 events qualify.
- 200 player-event groups excluded: 33 ambiguous variants, 135 incomplete/unconventional rosters, 16 nonindividual and 16 provisional results.
- Temporal split at 2026-10-03: 1,770 training / 500 test performances; 268 test performances have previously seen pilots.
- Game-weighted RMSE of held-out tournament win fraction: **0.269615** with character terms vs **0.269871** for the same player/event model with character terms suppressed. This tiny difference does not establish a useful predictive improvement, much less causal identification.
- Wong: R ≈ −1.84 p.p.; 258 pilots, 79 switching pilots. The bootstrap range crosses zero (about −4.46 to +0.51), so a confident claim that Wong hurts rosters is unsupported.

The audit intentionally remains separate from the UI's filtered calculation and is never used to transfer full-cohort intervals onto a filtered estimate.

## Background

The within/between and shrinkage design draws on standard multilevel regression ideas. The exact weighting, linear response and fixed penalties above are specific to this prototype, not prescribed by these references:

- [PyMC: multilevel modeling and partial pooling](https://www.pymc.io/projects/examples/en/latest/generalized_linear_models/multilevel_modeling.html)
- [Stan: introduction to multilevel modeling](https://mc-stan.org/learn-stan/case-studies/tutorial_rstanarm.html)

Next research steps: compare penalty/weight sensitivity using training-only resampling; evaluate on further future events; estimate time-varying pilot strength; model opponents and actual fielded squads when those data become available. Do not tune to make favorite characters rank higher.
