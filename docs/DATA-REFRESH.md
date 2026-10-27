# Public data refresh

The canonical files live in this repository. Do not run the historical `mcp-companion/scripts` preparation jobs against `app/` and copy that archived app back over Pages.

Jarvis snapshot checked again on 2026-10-26: 243 characters, 525 tactic printings, 72 crisis printings and 198 box sets. Stat-card rules, tactics, crises, boxes and presentation metadata match the previous snapshot. Character metadata corrects Nimrod, the Hunter's base size from 50 to 65 mm; the unchanged stat-card rules were reviewed and its existing roles retained. The 2026-10-21 refresh added Red Hulk, The Leader, Sensational She-Hulk, five tactics and current affiliations including Intelligencia and Thunderbolts. These previews have the source release date 2026-11-13; the existing hide-unreleased filter uses that date. Existing character IDs, variant IDs, collection keys and save formats are retained.

`data/refresh-audit.json` records added characters/tactics and changed stat cards. The API capture was public English data from `https://www.jarvis-protocol.com/api/characters`, `team_tactics_cards`, `crisis_cards`, `box_sets` and `artworks`, plus each `/characters/<slug>` and `/box_sets/<code>` detail. Raw public responses remain outside the published repository. The capture directory contains `characters.json`, `tactics.json`, `crises.json`, `boxes.json`, `artworks.json`, `cards/`, `boxes/` and per-face `layouts/` captures of changed/new character cards. Local portrait images are downloaded to `assets/avatars/`.

Apply a complete capture from the Pages root:

```
node scripts/apply-jarvis-refresh.mjs /path/to/capture
python3 scripts/sync-rule-references.py
```

The apply step checks that no existing identities or card printings disappear, keeps original gameplay JSON as structured data, derives attack summaries from both faces/forms, and refreshes visual metadata separately. Changed/new character cards require an explicit Jarvis layout capture; a guessed artwork position is not used. API objects unrelated to the app, account metadata and shop links are not published. Existing box cover assets and custom reskin settings remain intact.

Longshanks is still all played results with submitted rosters from rated offline events, including losing records. The complete snapshot is through 2026-10-26: 272 events, 2728 performances and 2787 roster variants (+27, +256 and +265 respectively). All 2522 existing roster IDs and previously resolved character memberships are retained; six existing standings changed. There are 2688 scored performances and 40 provisional performances. The source contains 269 zero-win performances and 211 with four or more losses, and no unresolved encoded character names. Player country coverage is 1673 declared / 7 unknown.

Source collection reused 227 older finished events and refreshed 70 tables at 20-second request spacing. Three new tables used rank 0 for registrations with no games: these are treated as unranked registrations and excluded as unplayed, without inventing results. A transient list timeout recovered on a bounded cached retry; final completeness and error checks passed. Source collection and data validation use the existing external Longshanks scripts, including their timeout/registration regressions.

After collecting a complete snapshot with the existing external `longshanks_scraper/full_results.py` and `build_player_countries.py` jobs, build and validate it with the current repo and scoring core:

```
python3 scripts/prepare-tournament-data.py --source /path/to/complete-snapshot
node scripts/validate-tournament-data.cjs tournaments/data.js /path/to/complete-snapshot
npm run audit:rating
npm run build
npm test
npm run test:e2e
```

`prepare-tournament-data.py` uses `data/catalog.json` and the frozen spelling aliases in `data/character-aliases.json`; it preserves unresolved source text and never fabricates a character match. Scoring runs through `scripts/score-tournament-snapshot.cjs` and the exact core used by the React UI. Averages, weights and scoring formulas are unchanged. The source snapshot and audit stay outside the web root.

JSON requests revalidate cached data. The build versions the JS/CSS and tournament snapshot URLs. Publishing changes no browser localStorage collection, wishlist, roster or battle records.

### Character roles after a catalog refresh

Role assignments live in `data/character-roles.json`; their internal card versions,
checksums and source links are in `data/character-role-provenance.json`. Review new
characters and any changed stat cards before updating that provenance. Do not
silently approve old roles just by replacing checksums. `tests/character-roles.test.cjs`
checks complete catalog coverage and pins the reviewed cards. The initial taxonomy,
conditional roles and UI scope are documented in `guides.md`.

Role icons use the vendored Font Awesome Free 7.3.1 CSS and solid WOFF2 in
`assets/fontawesome/7.3.1/`, with the upstream license and SHA-256 manifest. No CDN
or Font Awesome runtime JavaScript is used. If upgrading the library, validate all
ten icon names and update the pinned paths and manifest together.
