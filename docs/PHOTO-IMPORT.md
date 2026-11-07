# Photo import of MCP cards

## Scope

The same review dialog imports **characters**, **team tactics** and **crises** into an open roster, a preparation, or an active local/peer battle. The Android implementation uses **bundled Latin ML Kit Text Recognition 16.0.1**, with no Google login, API key, photo upload, or model download. It does not claim to use the Pixel TPU.

The web version has a local WASM fallback, useful for development and importing existing photographs. Pinned Tesseract.js/core 7.0.0 and its English model are committed in `assets/ocr/`; they load only when scanning. The browser worker is terminated and photo object URLs are revoked when the review closes. Android temporary copies are deleted on release; original gallery photographs are never deleted.

## User flow

- **Ростеры → Ростер по фото**, or open any roster and use **По фото** next to Characters/Tactics/Crises.
- Photo-entry buttons first show only **Сфотографировать** and **Загрузить фото**. The camera or gallery opens after that choice. Cancelling keeps the choice available; adding a photo opens the review, which also allows more photos.
- Capture or pick one or more photos. Show the side with the title; 2–4 cards per image is preferable for small printed text. Up to 12 photos, each up to 35 MiB.
- All detected catalogue matches start checked, including fuzzy/truncated matches. Ambiguous detections preselect the top candidate and retain alternatives for correction. Explicit user unchecks are preserved across additional photos. Existing items are labelled and cannot be duplicated. Names/alter egos can also be searched manually. An optional text-paste fallback accepts names already read by another tool.
- Confirm once to add. Roster edits remain a draft until **Сохранить ростер**. Saving without a name highlights and focuses the name field with an inline error; entering a name clears it.
- In battle, the photo buttons are beside each side's fighters/tactics and each mission. A batch is one edit and one undo in an active battle. Existing fighter HP/power/conditions and tactic played-state are preserved.
- Own/peer roster membership, preparation-side ownership, finished-state protection, five battle tactics and one mission of each type are enforced. Mission replacements are shown before confirmation. Multiple same-type crisis detections do not silently select a mission.
- Photos recognize catalogue identities, not models, HP tokens or an opponent's intentions. Current rules come from the application catalogue, including current printings of older card families.

## Source layout

- `frontend/src/photo-import/matching.js`: OCR line/window matching, bounded fuzzy candidates and duplicate reconciliation; no UI/platform dependency.
- `application.js`: live target validation and atomic additive roster/battle mutations.
- `recognizer.js`: local browser worker or Capacitor plugin, cancellation and photo lifetime.
- `regions.js`: browser-only title-panel/line-band proposals for stylized condensed type.
- `store.js`: MobX review workflow, batch progress, corrections, deduplication and confirmation.
- `dialog.jsx`, `photo-import.css`: photo acquisition, review, manual search and mobile/tablet layout.
- `android/app/src/main/java/org/mcpcompanion/local/CardScannerPlugin.java`: system camera/document picker, private bounded cache copies, EXIF orientation, bounded decoding and bundled ML Kit. It only recognizes opaque UUID handles returned by its own picker, never arbitrary JS paths.
- `PhotoInputPolicy.java`: bounded image/rotation/ID policy, tested on JVM.
- `frontend/src/platform/export.js` and `LocalDataPlugin.java`: browser downloads or Android system Save As for JSON backups; cancellation is harmless and retryable.
- `MainActivity.java`: plugin registration before bridge construction and Android Back support for native HTML dialogs.

## Android build on this Mac

The canonical Android project is now **inside the Git repository**, under `android/`. The older sibling `../mobile/` was used as a scaffold and was not modified. Do not build its stale web directory.

```sh
npm run android:prepare  # build current React, prepare an allowlisted offline web bundle, cap sync
npm run android:check    # compile Android sources and run JVM tests; no install
npm run android:apk      # prepare + assembleDebug when an APK is requested
```

The installable debug APK is copied to `output/apk/mcp-companion-debug.apk`, with a `.sha256` checksum alongside it. Gradle also retains `android/app/build/outputs/apk/debug/app-debug.apk`. No phone is touched by these commands. Copy/install the APK explicitly afterwards.

In Android, **Данные → Экспорт JSON** opens the system save dialog. To transfer the existing browser collection/rosters, export JSON from that browser and import it into the APK. The APK uses its own local storage; it does not automatically share browser data.

Requirements: Java 21, Android SDK platform 36, build-tools 36.0.0. `ANDROID_HOME`/`ANDROID_SDK_ROOT` override SDK discovery; `MCP_ANDROID_JAVA_HOME` overrides Java discovery. On macOS, the script selects installed Java 21 instead of the machine's Java 25 default. Gradle uses an isolated `.android-cache/gradle/` unless `GRADLE_USER_HOME` is explicitly set, so unrelated machine-wide Gradle init plugins do not change this build. The existing application ID is retained: `org.mcpcompanion.local`.

The Google-hosted Maven Central mirror is configured because `repo.maven.apache.org` and npm registry connections on this Mac failed with `ENOTCONN`. Existing exact Capacitor 8.5.3 packages were restored from the sibling project's installed copies, then validated with `npm install --package-lock-only --ignore-scripts --offline`. Normal installations use the checked-in public registry URLs/integrity values.

`native-web/` is generated from an explicit runtime allowlist. It excludes `.env`, private exports, tests, documentation, caches and source checkouts. Catalogue/rules/OCR models are bundled. Existing remote character/tactic artwork URLs are not all mirrored; uncached illustrations can still require internet. The recognition pipeline itself does not require it.

## Tests and evidence

```sh
npm test
npm run test:photo:e2e
npm run android:check
MCP_TEST_BROWSER=webkit npm run test:photo:e2e
```

- Unit cases cover name wrapping, multiple Spider-Man versions, conservative partial/fuzzy matching, reprints, ambiguous names, evidence removal, manual corrections across new photos, context changes, restrictions, atomic failure, peer acknowledgement failure and worker cancellation.
- Browser cases cover acquisition through the real Capacitor JS proxy with a **fake native response**, review, draft/save, errors/cancellation, late results, rotation/retry, Pixel-sized layout, accessibility, own/opponent sides, played tactics, mission replacement and undo.
- Separate **real WASM OCR** cases read the three JPEG fixtures with all external browser requests blocked. The fixtures are synthetic card scenes derived from native Jarvis downloads, not field photographs or a measured physical-camera accuracy dataset.
- Android JVM tests cover image bounds, downsampling, rotations and path-handle validation.
- Android instrumentation (`CardScannerIntegrationTest`) exercises the **real native plugin and bundled ML Kit** with a stubbed system document picker returning fixture content URIs. It covers character/tactic/crisis import, EXIF orientation, Back/cancel, invalid file handles, full-size camera output handoff and adding an opponent squad. The external camera is stubbed with a fixture; camera optics are not tested. Additional cases cover saving UTF-8 JSON through the system document picker and cancelling/retrying an export. This does not substitute for testing the Pixel camera and glossy sleeves in real lighting.

Pinned browser runtime URLs and SHA-256 hashes are in `scripts/ocr-assets.json`. `npm run ocr:assets` downloads/verifies them; the normal build checks hashes without network access.

## Remaining physical-device check

Install on Pixel 9 Pro XL; test the actual system camera and gallery, a full roster on the table, reflections, mixed orientations, app background/return, and latency. In particular, Android can kill an unsaved web UI while a memory-intensive external camera is open; process-death draft recovery is not implemented. Ordinary cancel/Back, rotations and late OCR are covered.

TPU routing is not implemented. Local OCR works independently of that research; any later custom-model accelerator path must verify actual execution rather than merely request NPU and assume it was used.

## Verified on 2026-11-01

- 157 JavaScript unit tests and 6 Android JVM tests passed.
- Photo import: 19 Chromium and 19 WebKit scenarios passed, including real local WASM OCR. The final Chromium run also passed 6 existing UX regressions (25 total).
- Earlier affected squad/layout/accessibility verification passed 51 scenarios.
- 12 Android instrumentation cases passed, including real bundled ML Kit and native JSON save/cancel/retry. The final result is recorded in `previews/photo-import/native-instrumentation-final.log`.
- Android debug APK assembled successfully. Physical Pixel camera and lighting validation remain manual.
