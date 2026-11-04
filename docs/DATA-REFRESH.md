# Public data refresh

The canonical files live in this repository. Do not run the historical `mcp-companion/scripts` preparation jobs against `app/` and copy that archived app back over Pages.

Jarvis snapshot checked on 2026-11-04: 243 characters, 525 tactic printings, 72 crisis printings and 198 box sets. Drax the Destroyer's Driven by Vengeance and N‘Kantu, the Living Mummy's Spend Captured Soul wording changed on both faces; their parameters, attacks and other powers are unchanged. Both cards and their Jarvis presentation metadata were reviewed, and their existing roles retained. Jubilee now has the source release date 2026-10-30; its unchanged stat card was reviewed and its shooter/support roles retained. Pretty Sneaky, Sis changes standard-timeline legality from legal to rotated. There are no new characters, tactics, crises or boxes in this snapshot. Existing character IDs, variant IDs, collection keys and save formats are retained.

The 2026-10-21 refresh added Red Hulk, The Leader, Sensational She-Hulk, five tactics and current affiliations including Intelligencia and Thunderbolts. These previews have the source release date 2026-11-13; the existing hide-unreleased filter uses that date. The 2026-10-26 refresh corrected Nimrod, the Hunter's base size from 50 to 65 mm.

`data/refresh-audit.json` records added characters/tactics and changed stat cards. The API capture was public English data from `https://www.jarvis-protocol.com/api/characters`, `team_tactics_cards`, `crisis_cards`, `box_sets` and `artworks`, plus each `/characters/<slug>` and `/box_sets/<code>` detail. Raw public responses remain outside the published repository. The capture directory contains `characters.json`, `tactics.json`, `crises.json`, `boxes.json`, `artworks.json`, `cards/`, `boxes/` and per-face `layouts/` captures of changed/new character cards. Local portrait images are downloaded to `assets/avatars/`.

Apply a complete capture from the Pages root:

```
node scripts/apply-jarvis-refresh.mjs /path/to/capture
python3 scripts/sync-rule-references.py
```

The apply step checks that no existing identities or card printings disappear, keeps original gameplay JSON as structured data, derives attack summaries from both faces/forms, and refreshes visual metadata separately. Changed/new character cards require an explicit Jarvis layout capture; a guessed artwork position is not used. API objects unrelated to the app, account metadata and shop links are not published. Existing box cover assets and custom reskin settings remain intact.

Longshanks is still all played results with submitted rosters from rated offline events, including losing records. The complete snapshot is through 2026-11-03: 287 events, 2869 performances and 2936 roster variants (+15, +141 and +149 respectively). All 2787 existing roster IDs and previously resolved character memberships are retained; 37 existing roster variants have updated standings. There are 2849 scored performances and 20 provisional performances. The source contains 283 zero-win performances and 229 with four or more losses, and no unresolved encoded character names. Player country coverage is 1729 declared / 8 unknown.

Source collection reused 251 older finished events and refreshed 61 tables at 20-second request spacing, making 234 network requests. All 312 scoped standings tables were collected without errors; 1013 unplayed or unsubmitted rows were excluded. All 2728 previous played results remain, with 141 newly downloaded public rosters and 149 new roster variants. Final completeness and source-error checks passed.

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

### Scheduled execution

The checked-in runner is `tools/data-refresh/refresh.py`; the local Temporal worker
runs its stages daily at 10:00 Europe/Amsterdam and waits for review before
publication. See [Temporal operation and recovery](TEMPORAL-REFRESH.md).
