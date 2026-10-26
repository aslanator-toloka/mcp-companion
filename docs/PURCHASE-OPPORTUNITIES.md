# Tournament rosters unlocked by a box

Each box tile and detail compares against current owned models (manual ownership plus purchased sets). Wishlist models are not owned. The full archive is used, independently of existing tournament filters.

Eligible published roster variants have a complete recognized inventory, a finished result, and `(wins >= 4 && losses <= 1) || (wins >= 3 && losses === 0)`. Losing/lower records remain in the archive but are outside this purchase calculation. Draws impose no additional constraint. Each archive roster ID counts once; different published variants or tournament appearances remain separate. Tactics, crises and gems are not inventory requirements.

Already-buildable rosters do not count as a purchase benefit. A box must increase available models. `unlocked` contains rosters that become fully available with that box; `almost` contains other rosters completable with one additional box. Each possible finishing box has its own roster-ID list, while `almost` is deduplicated across these alternatives. Physical copy constraints and alternative inventory IDs use the same availability core as tournament collection matching.

Jarvis alternate sculpts are mapped to `mainCharacterSlug` in box membership; the original slug is retained as `sourceSlug`. Both purchase simulation and the existing bought-box ownership use these canonical members. The refresh script preserves this normalization.

The immutable archive/box index and collection-relative result map are MobX computed values. Search, wishlist and dialog changes do not recalculate the entire archive. A development run over the current 198 boxes and 305 eligible variants took approximately 38 ms; this is not a device-independent guarantee.

Count buttons navigate to the tournament roster list using `purchase-box`, optional `purchase-view=almost`, and optional `purchase-extra`. The descriptor is small, reloadable and recomputed against the current collection; it is not a frozen list of IDs. Entry clears competing roster selection/country/affiliation filters. Existing tournament search/country/affiliation filters can then narrow the purchase list. The purchase overview identifies the subset, and its clear button restores ordinary character browsing. Choosing a character/player/collection also clears the purchase subset. These parameters filter the roster list, not global character ratings. Browser Back restores the source box and its parent screen. Saved collections and scoring formulas are unchanged.

Validation includes threshold/union/deduplication, irrelevant or already-owned purchases, two-box alternatives, incomplete/provisional lists, duplicate Sentinel inventory, MobX invalidation and browser purchase/navigation/reload coverage.

Each finishing-box option names only characters still missing after adding the first box to current ownership. The names are the union across that option's matching rosters; when there are multiple rosters, each name shows its own roster count. A repeated physical-copy entry counts that roster once for the name. The specific-pair tournament overview repeats these missing names. Other characters included in a box are not labeled missing.
