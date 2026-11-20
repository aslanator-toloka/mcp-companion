# Tactics album

Screen `#screen=album&page=<n>&q=<text>` lays out every Team Tactics card from purchased boxes for a physical binder: 20 double-sided sheets, 8 pockets per side (pages 1–40, odd = side А, even = side Б).

- One slot per distinct artwork (Jarvis `artworkName`, else the card family's main art): the same card with different art keeps separate pockets, copies with the same picture share one. Pockets show the art from Jarvis' CDN (`card_backs/<artwork>.png`).
- Order: affiliation cards → character cards (placed in the character's affiliation that already holds most of the owner's affiliation cards) → `Общие карты` last; within a group by character, name, box.
- Numbers are frozen: the library stores `albumOrder` (artwork keys, exported with the collection). The first load saves the current order; cards seen later get the next numbers at the end. Unmarking a box leaves its pockets empty, and they return to the same numbers if it is marked again.
- Search matches card names and the characters a card names; choosing a result opens its page, highlights the pocket and clears the query. Clicking a pocket opens the card.

Box contents come from `data/box-sets.json` → `sets[].tactics` (`slug`, `name`, `amount`, optional `artwork`), produced by `scripts/apply-jarvis-refresh.mjs` or, without refreshing rules, `node scripts/prepare-box-tactics.mjs <capture>` from `boxes/<CODE>.json` (`GET /api/box_sets/<CODE>`). Logic: `frontend/src/tactics-album.js`, tests: `tests/tactics-album.test.cjs`.
