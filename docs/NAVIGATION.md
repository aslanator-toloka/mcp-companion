# URL and browser history

All navigable views use the History API with relative hash URLs, compatible with GitHub Pages. Existing `#character=…`, `#collection=ready` and `#player=…` tournament links still open correctly and are canonicalized with `screen=tournaments`.

Examples:

- `#screen=catalog&card=moondragon&face=back`
- `#screen=rosters&roster=<saved-id>&tab=tactics`
- `#screen=rosters&roster=new:<draft-id>`
- `#screen=purchases&tab=all&box=CP170`
- `#screen=tournaments&character=ultimate-spider-man&affiliation=Web+Warriors`
- `#screen=battle&match=<local-id>&view=map`
- `#screen=battle&match=<local-id>&panel=fighter&fighter=<fighter-id>`

`navigation/routes.js` is the only UI-to-URL mapping. It captures active screen filters, tabs, selected entities, pickers, supported dialogs, card forms/sides and map view settings. It restores views using current stores and saved records. Missing/deleted records fall back to an available view. Locally saved roster/match IDs refer to data on this browser; a URL does not transfer the underlying saved game or establish a peer connection.

`navigation/history.js` receives read/apply/context/guard callbacks and owns history entries. It does not depend on React or MobX. Bootstrap observes the route through a MobX reaction and coalesces synchronous view changes into one navigation entry. Screen/entity/tab/filter changes push an entry; search text replaces the current entry rather than adding a step for every keystroke. Dismissing a modal returns to its known parent entry when possible, preserving Forward. It handles native history truncation, duplicate hash/pop events and asynchronous card loading.

Each history state has a session, entry ID and monotonic index, plus viewport/panel scroll positions and an optional local roster draft. Before leaving a dirty editor through browser Back/Forward, navigation first returns to the current indexed entry and asks the existing save/discard/cancel question. Cancelling preserves both sides of the history stack. Accepted traversal then applies the destination. Overlays and tabs in the same editor do not discard a draft or require this prompt. A session draft can survive reload in browser history state; durable exports still omit unsaved drafts.

Navigation restoration never replays commands, rewinds HP/VP, toggles collection ownership or restores an old network revision. Gameplay and saved data stay authoritative in their respective stores. History uses current saved matches/cards; peer rooms reopen locally without silently generating new connection offers. ICE invitations, answers, player credentials, complete match snapshots and imported file contents are never put into URLs. Pending data-import confirmations and save/discard prompts are actions rather than shareable locations.

Native dialog close callbacks ignore delayed close events if the dialog has already reopened. Card loading cannot reopen a view that was left in the meantime. Scroll restoration waits for the selected card data and a rendered frame; regular in-place edits preserve existing DOM and scroll.

`tests/e2e/navigation.spec.cjs` covers screens, nested cards/boxes and sides, links/reload, filters and tabs, browser save/discard/cancel, roster pickers, local battles/fighter views/maps, gameplay independence, scroll, slow loads, session drafts, manually changed hashes and pruned history entries. Older reload tests now assert that the active card/battle/map restores directly.

Rule references use `reference=token:<key>`, `character:<grunt-slug>`, `map:<setup>` or `note:<frozen-id>`. They open above the current character/tactic/crisis card, preserve that parent view, and participate in Back/Forward/reload. Special conditions retain their existing `condition=<key>` links. Token artwork and inline annotations are frozen in `data/card-references.json`; `scripts/sync-rule-references.py` refreshes the local artwork from Jarvis manually. No runtime requests to Jarvis are required for these references. Where Jarvis supplies no token artwork (currently Weakness), help shows the corresponding printed ability instead of a fabricated image.

Character catalog advanced filters use `filters=<JSON>` alongside the existing `q`, `affiliation` and `threat` parameters. Only non-default settings are encoded. `catalog-filters.js` bounds and validates restored values. Multiple affiliations can require any/all memberships in the selected timeline. Each attack block matches all its predicates on the same attack; multiple blocks can require any/all blocks, including different attacks. Empty blocks have no effect. Advanced filters, sorting and collection mode survive Back/Forward, nested character cards and reload. Search supports affiliation names, `#tag` prefixes and `!#tag` exclusions.
