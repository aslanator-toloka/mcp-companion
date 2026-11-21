# Tactics album

Screen `#screen=album&page=<n>&q=<text>` lays out every Team Tactics card from purchased boxes for a physical binder: 20 double-sided sheets, 8 pockets per side (pages 1–40, odd = side А, even = side Б).

- One slot per distinct artwork (Jarvis `artworkName`, else the card family's main art): the same card with different art keeps separate pockets, copies with the same picture share one. Pockets show the art from Jarvis' CDN (`card_backs/<artwork>.png`).
- Order: affiliation cards → character cards (placed in the character's affiliation that already holds most of the owner's affiliation cards) → `Общие карты` last; within a group by character, name, box.
- Numbers are frozen and kept in the repo: `data/tactics-album.json` holds the binder's boxes (`sets`), cards owned without a box (`loose`, e.g. promo or trades) and the pocket `order` (artwork keys). New cards always go to the end; the app renders this file, not the device's collection.
- Update it with `node scripts/update-tactics-album.mjs --set CODE --card SLUG` (or `--from-export file.json` to add the export's purchased boxes); the script appends new keys and never reorders.
- Search matches card names and the characters a card names; choosing a result opens its page, highlights the pocket and clears the query. Clicking a pocket opens the card.

Box contents come from `data/box-sets.json` → `sets[].tactics` (`slug`, `name`, `amount`, optional `artwork`), produced by `scripts/apply-jarvis-refresh.mjs` or, without refreshing rules, `node scripts/prepare-box-tactics.mjs <capture>` from `boxes/<CODE>.json` (`GET /api/box_sets/<CODE>`). A box Jarvis lists without cards yet may carry hand-entered `tactics` with `manualTactics: true` (currently MCP27 Weapon X Program, from its characters); both scripts keep them until Jarvis returns contents, then replace them. Logic: `frontend/src/tactics-album.js`, tests: `tests/tactics-album.test.cjs`.

