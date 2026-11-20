# Tactics album

Screen `#screen=album&page=<n>&q=<text>` lays out every Team Tactics card from purchased boxes for a physical binder: 20 double-sided sheets, 8 pockets per side (pages 1–40, odd = side А, even = side Б).

- One slot per printed copy: duplicates from different boxes keep separate pockets (different artwork).
- Order: affiliation cards → character cards (placed in the character's affiliation that already holds most of the owner's affiliation cards) → `Общие карты` last; within a group by character, name, box.
- Buying a new box renumbers cards after its slots.
- Search matches card names; choosing a result opens its page, highlights the pocket and clears the query. Clicking a pocket opens the card.

Box contents come from `data/box-sets.json` → `sets[].tactics` (`slug`, `name`, `amount`, optional `artwork`), produced by `scripts/apply-jarvis-refresh.mjs` or, without refreshing rules, `node scripts/prepare-box-tactics.mjs <capture>` from `boxes/<CODE>.json` (`GET /api/box_sets/<CODE>`). Logic: `frontend/src/tactics-album.js`, tests: `tests/tactics-album.test.cjs`.
