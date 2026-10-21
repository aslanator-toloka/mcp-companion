# MCP Companion

[Open the app](https://aslanator-toloka.github.io/mcp-companion/).

Native React + MobX companion for Marvel Crisis Protocol: character/tactic/crisis cards, collection, boxes and wishlist, roster builder, tournament archive and local/direct multiplayer battles. Data lives in this browser; use **Данные → Экспорт JSON / Импорт JSON** for backups and device transfers. No Google account or backend is required.

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

Artwork, layouts and rules originate from Jarvis Protocol / Atomic Mass Games; tournament snapshot from Longshanks. Marvel characters/art belong to their respective owners. This static publication does not promise offline operation.
