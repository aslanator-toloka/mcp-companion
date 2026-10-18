# MCP Companion

Static edition for GitHub Pages: character cards, collection, rosters, tournament archive and local battle tracker. No Google account or backend required. Collection, rosters and matches are saved in this browser. Use **Данные → Экспорт JSON / Импорт JSON** for backups and moving between devices or site addresses.

Direct two-player battles on the same Wi-Fi use WebRTC DataChannel: the creator is the authority, players exchange an invitation and an answer manually. There is no account, signalling server, STUN or TURN service. Updates are sent immediately; a full snapshot is sent every 10 seconds. After a reload use the saved room to exchange new connection texts. The legacy Node multiplayer service is not part of this edition. Artwork may load from the original Jarvis CDN. This build does not promise offline access.

## Publishing

GitHub Pages publishes the root of the main branch. An empty .nojekyll disables Jekyll. All runtime paths are relative to the project URL.

## Data credits

Rules, character and card data: Jarvis Protocol / Atomic Mass Games. Tournament snapshot: Longshanks. Marvel characters and artwork belong to their respective owners.
