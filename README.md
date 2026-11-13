# MCP Companion

[Open the app](https://aslanator-toloka.github.io/mcp-companion/).

Native React + MobX companion for Marvel Crisis Protocol: character/tactic/crisis cards, collection, boxes and wishlist, roster builder, tournament archive and local/direct multiplayer battles. Data lives in this browser; use **Данные → Экспорт JSON / Импорт JSON** for backups and device transfers. No Google account or backend is required.

The app starts in dark mode. The sun/moon button in the top right switches themes and remembers the choice on this device. Printed game cards and the game board retain their original colours in either theme.

Use **Ростеры → Ростер по коду** to import a Jarvis/Longshanks MCT code, a Jarvis validator link, or a Companion code. **Код ростера** is available on saved roster tiles and in the editor, including unsaved edits. The Companion format preserves the name and affiliation; MCT transfers membership for other MCP tools. Imports open a new draft for review and explicit saving.

## Develop and verify

Node.js 22 or newer. From a clean clone:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run serve
```

The local URL is http://127.0.0.1:4173/mcp-companion/. All UI and stores are in `frontend/src`; root pure domain modules are shared with tests. One root npm workspace lockfile pins React 19.3.1, MobX 7.1.0 and mobx-react-lite 5.1.0. Build scripts emit the production bundle and hash entry URLs. GitHub Pages publishes the checked-in root of main. [Architecture and verification](docs/REACT-UI.md).

Two-player battles use WebRTC DataChannel, a browser-hosted authority and manual invitation/answer exchange. There is no signaling, STUN or TURN service. Changes are sent immediately, with a full snapshot every 10 seconds. After reload exchange new connection texts for the saved room. Direct connectivity depends on browser/network permissions and Wi-Fi peer access; two physical iPads remain a manual test.

## Local Game

Run `npm run build` and `npm run serve`, then open **Game** at
[127.0.0.1:4173/mcp-companion](http://127.0.0.1:4173/mcp-companion/#screen=game).
The Avengers and Cabal roster presets use local card data for stat cards,
mission rules, attacks, superpowers, and tactics. Game shows pending decisions
from both sides, including attacks with multiple targets and reactions.
Movement, line of sight, and collisions use sampled 2D geometry. Game saves its
state to `.runtime/game.json` separately from Battle.

The CLI and browser share one local match. The browser's **Вернуть управление**
button retakes a side at its current decision. Set `PORT` if you started the
server on a different port.

```sh
npm run game -- state p2
npm run game -- take p2
npm run game -- reach p2 advance
npm run game -- act p2 '{"type":"advance","x":12.25,"y":7}' <revision>
npm run game -- snapshot
npm run game -- finish
```

Use the current `revision` and the side's `actions` from `state` to construct
a command. Use `reach` for legal sample positions and `character <slug>` for the
stat card. For a beam, send an `attack` with `angle` in degrees clockwise from
the right of the screen. For an area, omit the angle. Resolve each target with
the `volley-target` commands returned in `state`. The same action list describes
pending reactions, dice changes, tactics, and effect placements. `snapshot` also includes both sides' sealed choices and is intended
for inspection outside the player's normal view.

Game feedback is configured in `assets/game-feedback.json`. Under `attacks` or
`powers`, add the card's exact move name and set `animation` to `beam`,
`bolt`, `slash` or `pulse`. You can set a colour, use a built-in sound
(`impact`, `zap`, `charge`, `silent`), or point `sound` at a local file
under `assets/`. An optional `sprite` path under `assets/` adds custom art
at the impact point. Refresh Game to reload the configuration.

## Android and photo import

The Capacitor Android app imports characters, tactics and crises from photos into rosters and battles. Recognition runs locally using bundled ML Kit, followed by a review before adding cards. No account or OCR server is needed.

```sh
npm run android:prepare
npm run android:check
npm run android:apk
```

The APK is written to `output/apk/mcp-companion-debug.apk`. Transfer browser data with JSON export/import; Android has separate local storage. See [photo import, build requirements and verification](docs/PHOTO-IMPORT.md).

Artwork, layouts and rules originate from Jarvis Protocol / Atomic Mass Games; tournament snapshot from Longshanks. Marvel characters/art belong to their respective owners. This static publication does not promise offline operation.
