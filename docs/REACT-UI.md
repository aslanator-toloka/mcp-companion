# React + MobX client

The entire interactive application is native React JSX. One `createRoot` mounts the persistent shell. `observer` from mobx-react-lite subscribes views to the fields they render. MobX uses `enforceActions: "always"`. No HTML-string view registry, DOMParser adapter, delegated button controller, manual `render/refresh` chain or `flushSync` compatibility layer remains.

## Source and build

This repository is the source of truth. Install dependencies with `npm ci` in the root, build with `npm run build`, run domain/store/native-render tests with `npm test`, and browser tests with `npm run test:e2e` after `npx playwright install chromium`. `npm run serve` serves http://127.0.0.1:4173/mcp-companion/. The workspace lockfile is the root package-lock.json.

`frontend/src` contains all application UI and state. Root battle-core, room-core, power-phase, map-geometry, tournament core/import and card-insight files are shared pure domain modules, bundled with the client. The large read-only artwork/layout/tournament snapshots load as separate relative assets. `react-ui.js` and hashed index URLs are generated. GitHub Pages serves the checked-in static build; no backend, Google account or runtime package CDN is required.

## State ownership

- `LibraryStore`: explicit version-1 durable snapshot; fine-grained observable maps for manual/effective collection, bought boxes, wishlist and planned character status. Disk writes complete before publishing a transaction. Unknown set codes survive; manual/overlapping box sources remain independent.
- `CatalogStore`: immutable catalog, filters, complete-card request deduplication/cache, current character/form/side and loading errors.
- `PurchaseStore`: immutable box catalog, list tab/search and selected set.
- `RosterStore`: saved records via LibraryStore; observable draft, dirty baseline, groups, picker filters and contextual metrics. Two-tab conflicts are explicit; failed saves preserve drafts.
- `TournamentStore`: archive/core index, character/player/affiliation/country filters, cached computed cohorts, pagination and derived presentation. Existing signed score math and 2/4-appearance thresholds are unchanged.
- `BattleStore`: immutable accepted matches, current side/view, setup/picker/dialog state, local commands, pending picker intents and bounded fighter presentation cache. Battle calculations remain in the shared pure modules.
- `PeerSessionStore`: observable accepted room, role, connection, saved rooms, handshake form, error/status and pending count. `peer-protocol.js` preserves serialized host authority, operation ID deduplication, CAS retries and immediate/full 10-second snapshots. Pending picker checkboxes show the local intention while the actual match waits for authority acceptance.
- `MapStore`: selected point, units, measurement mode, zoom, coordinate/rename fields and pointer preview. Committed movement goes through the same battle command/undo path.
- `CardStore`: independent appearance-layer preferences, game-card viewer and condition help. `cards.jsx` renders character, tactic and crisis faces, rules, icons and diagrams directly as React elements. Card fitting is a local layout effect with a scoped ResizeObserver; no document-wide card MutationObserver remains.
- `UIStore`: routing/menu, sidebar preference, notifications, import confirmation and membership dialogs. Transient input drafts may use local React state; they do not become durable game state.

`share.js` retains identities of unchanged entities in accepted immutable snapshots. Changing one fighter retains other fighters, card references and teams, allowing memoized views to skip work. Modal/card/row identities preserve focus, caret, horizontal positions and scroll without rebuilding live HTML. SVG pointer capture and local DOM measurements are appropriate imperative browser operations inside React effects/refs.

## Persistence and browser lifecycle

Existing localStorage keys and JSON export shape remain compatible. Old owned-only libraries become manual ownership; wishlist/purchased/group fields default appropriately. Export omits unsaved drafts/UI. Import validates the library and optional battles before writing, restores previous keys if a write fails, then publishes accepted snapshots. This is rollback across localStorage keys, not a database transaction across browser tabs. Malformed library saves block incidental writes until an explicit valid restore; their original raw value is preserved.

Cross-tab updates enter store actions. Browser hash changes respect the dirty-roster prompt. WebRTC lifecycle listeners handle background/return/close; view effects dispose resize, font and keyboard subscriptions. Saved direct rooms still require a fresh invitation/answer after reload. Tests use real RTC loopback on one machine; two physical iPads and a long real game remain manual validation.

## Verification

Node tests exercise the shared game/math modules, real store interfaces, storage failures, source provenance, conflict handling and async loads. Native React server-render tests cover all structured character faces, all 1,184 tactic/crisis faces, independent reskin combinations, rule-token escaping and accessible condition references.

Playwright covers purchases/import/reload/two tabs, retained scroll/focus/DOM, related-card cohorts and Challenger filters, textures/skins, roster/group CRUD/conflicts, tournament player/country/affiliation scope, failed writes/corrupt saves, new/local battles, live stats/conditions/portraits/state cycle, power/round/undo/finish, SVG distances/coordinates/drag/pins, and real peer handshake/concurrency/reconnect/deduplication/unchanged heartbeat snapshots. Public-origin environment variables allow running these against Pages with isolated test browser storage.

Release verification, 2026-10-21: clean npm ci and build, passing Node and Playwright suites including real WebRTC. Additional regressions cover resetting scroll on character navigation and preserving the roster draft baseline after an immediate membership save. Visual checks of battle, SVG map and full character card; browser diagnostics report one React root and MobX, with no page errors or MobX warnings. These are automated/browser checks, not a physical iPad game.
