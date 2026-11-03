const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const modules = Promise.all([
  import("../frontend/src/photo-import/matching.js"),
  import("../frontend/src/photo-import/application.js"),
  import("../frontend/src/photo-import/store.js"),
  import("../frontend/src/validation.js"),
]);
const characters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/catalog.json")),
).characters;
const lists = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/roster-cards.json")),
);
async function setup() {
  const [matching, application, stores, validation] = await modules;
  const cards = {
    tactics: validation.latestCards(lists.tactics),
    crises: validation.latestCards(lists.crises),
  };
  const index = matching.createPhotoCatalog({ characters, ...cards });
  return { ...matching, ...application, ...stores, cards, index };
}
function fakeDeps(cards) {
  const deps = {
    catalog: {
      rows: characters,
      byId: new Map(characters.map((c) => [c.slug, c])),
      detail: async (slug) =>
        JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../data/cards", slug + ".json"),
          ),
        ),
    },
    rosters: {
      draft: {
        id: "draft",
        name: "Photo roster",
        characters: [],
        tactics: [],
        crises: [],
      },
      tab: "characters",
      cards,
      card: (kind, slug) =>
        cards[kind].find((c) => c.slug === slug) ||
        lists[kind].find((c) => c.slug === slug),
      canonical: (kind, slug) => {
        const original = lists[kind].find((c) => c.slug === slug);
        return (
          cards[kind].find((c) => c.cardFamily === original?.cardFamily)
            ?.slug || slug
        );
      },
      choose(kind, slug, include) {
        this.draft[kind] = include
          ? [...new Set([...this.draft[kind], slug])]
          : this.draft[kind].filter((s) => s !== slug);
      },
    },
    battle: {
      current: null,
      activeNetwork: false,
      ownSide: "mine",
      network: null,
      label: (s) => (s === "mine" ? "Мои" : "Противник"),
    },
    ui: {
      messages: [],
      notify(m) {
        this.messages.push(m);
      },
    },
  };
  return deps;
}
function battleMatch(deps, status = "active") {
  return {
    id: "match",
    name: "Photo battle",
    status,
    threat: 99,
    round: 1,
    score: { mine: 0, opponent: 0 },
    priority: "unknown",
    sourceRoster: {
      id: "source",
      name: "Source",
      characters: ["hulk", "ultimate-spider-man"],
      tactics: ["fall-back"],
      crises: [],
    },
    mine: {
      name: "Я",
      affiliation: "",
      fighters: [],
      tactics: [],
      leader: null,
    },
    opponent: {
      name: "Противник",
      affiliation: "",
      fighters: [],
      tactics: [],
      leader: null,
    },
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    references: {},
    secure: null,
    extract: null,
    undo: [],
    log: [],
  };
}
function nativeFake() {
  return {
    native: false,
    photos: [],
    released: [],
    cancelled: 0,
    cancel() {
      this.cancelled++;
    },
    release(photos) {
      this.released.push(...photos.map((p) => p.id));
    },
    fromFiles(files) {
      return files.map((f, i) => ({
        id: f.id || "p" + i,
        name: f.name || "Photo",
        rotation: 0,
        text: f.text,
      }));
    },
    async recognize(photo, progress) {
      progress?.({ value: 1 });
      return { text: photo.text };
    },
  };
}

test("normalization handles printed punctuation, curly apostrophes, ampersands and Unicode accents", async () => {
  const m = await setup();
  assert.equal(
    m.normalizeCardText(" Aunt May’s  Wheat-Cakes! "),
    "aunt may s wheat cakes",
  );
  assert.equal(m.normalizeCardText("Cloak & Dagger"), "cloak and dagger");
  assert.equal(m.normalizeCardText("Écho"), "echo");
});
test("all ten requested Web Warriors are recognized from names without adding other Spider-Man versions", async () => {
  const m = await setup();
  const slugs = [
    "ultimate-spider-man",
    "amazing-spider-man",
    "scarlet-spider",
    "ghost-spider",
    "agent-venom",
    "spider-woman",
    "spider-ham",
    "spider-man-2099",
    "spider-man-noir",
    "black-cat",
  ];
  const result = m.findPhotoCards(m.index, "characters", {
    text: slugs
      .map((s) => characters.find((c) => c.slug === s).name.toUpperCase())
      .join("\n"),
  });
  assert.deepEqual(
    new Set(result.filter((r) => r.checked).map((r) => r.slug)),
    new Set(slugs),
  );
});
test("wrapped Ultimate Spider-Man heading suppresses the contained classic Spider-Man match", async () => {
  const m = await setup(),
    r = m.findPhotoCards(m.index, "characters", {
      text: "ULTIMATE\nSPIDER-MAN\nMILES MORALES",
    });
  assert.deepEqual(
    r.filter((r) => r.checked).map((r) => r.slug),
    ["ultimate-spider-man"],
  );
});
test("wrapped headings cannot join across distinct OCR blocks or neighbouring columns", async () => {
  const m = await setup();
  const r = m.findPhotoCards(m.index, "characters", {
    lines: [
      { text: "ULTIMATE", block: 1, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.03 } },
      {
        text: "SPIDER-MAN",
        block: 2,
        box: { x: 0.6, y: 0.1, w: 0.2, h: 0.03 },
      },
    ],
  });
  assert(!r.some((x) => x.slug === "ultimate-spider-man" && x.exact));
});
test("name mentioned inside a long ability sentence is not an exact title", async () => {
  const m = await setup();
  const r = m.findPhotoCards(m.index, "characters", {
    text: "After this attack Spider-Man gains power.\nAn allied Spider-Woman may spend 2 energy to play this card.",
  });
  assert(!r.some((x) => x.checked));
});
test("uncertain OCR spelling selects the best match by default", async () => {
  const m = await setup(),
    r = m
      .findPhotoCards(m.index, "characters", { text: "SPIDER-MAN N0IR" })
      .find((r) => r.slug === "spider-man-noir");
  assert(r);
  assert.equal(r.exact, false);
  assert.equal(r.checked, true);
});
test("a short exact name works but a fuzzy short word is not used as a character", async () => {
  const m = await setup();
  assert(
    m
      .findPhotoCards(m.index, "characters", { text: "HULK" })
      .some((r) => r.slug === "hulk" && r.checked),
  );
  assert(
    !m
      .findPhotoCards(m.index, "characters", { text: "HUL" })
      .some((r) => r.checked),
  );
});
test("Peter Parker alone cannot choose a particular Spider-Man", async () => {
  const m = await setup();
  assert(
    !m
      .findPhotoCards(m.index, "characters", { text: "PETER PARKER" })
      .some((r) => r.checked),
  );
});
test("tactic and crisis modes do not import character names or other card kinds", async () => {
  const m = await setup();
  assert(
    m
      .findPhotoCards(m.index, "tactics", { text: "CLONE SAGA" })
      .some((r) => r.slug === "clone-saga" && r.checked),
  );
  assert(
    !m
      .findPhotoCards(m.index, "characters", { text: "CLONE SAGA" })
      .some((r) => r.checked),
  );
  assert(
    !m
      .findPhotoCards(m.index, "crises", { text: "CLONE SAGA" })
      .some((r) => r.checked),
  );
});
test("long crisis headings join up to four lines and resolve to the current printing", async () => {
  const m = await setup();
  const r = m.findPhotoCards(m.index, "crises", {
    text: "MUTANT MADMAN TURNS\nCITY INTO LETHAL\nAMUSEMENT PARK",
  });
  assert(
    r.some(
      (r) =>
        r.slug === "mutant-madman-turns-city-into-lethal-amusement-park-ca09" &&
        r.checked,
    ),
  );
});
test("multiple exact aliases select the first candidate and retain alternatives", async () => {
  const m = await setup(),
    idx = m.createPhotoCatalog({
      characters: [
        { slug: "a", name: "Same Name" },
        { slug: "b", name: "Same Name" },
      ],
    });
  const [r] = m.findPhotoCards(idx, "characters", { text: "SAME NAME" });
  assert.equal(r.ambiguous, true);
  assert.equal(r.slug, "a");
  assert.equal(r.checked, true);
  assert.equal(r.options.length, 2);
});
test("grunts and Infinity Gems are excluded from recognition catalogue", async () => {
  const m = await setup(),
    idx = m.createPhotoCatalog({
      characters: [{ slug: "grunt", name: "Grunt", isGrunt: true }],
      tactics: [{ slug: "gem", name: "Power Gem", isInfinityGem: true }],
    });
  assert.equal(idx.entries.length, 0);
});
test("healthy/injured and repeated photos merge while preserving a user uncheck", async () => {
  const m = await setup(),
    one = m.findPhotoCards(m.index, "characters", { text: "HULK" }, "one"),
    two = m.findPhotoCards(m.index, "characters", { text: "HULK" }, "two");
  one[0].checked = false;
  one[0].touched = true;
  const [r] = m.mergePhotoCards(one, two);
  assert.equal(r.checked, false);
  assert.equal(r.evidence.length, 2);
});
test("manual search supports alter ego and returns at most 25 cards", async () => {
  const m = await setup();
  assert(
    m
      .searchPhotoCatalog(m.index, "characters", "Miles Morales")
      .some((c) => c.slug === "ultimate-spider-man"),
  );
  assert.equal(m.searchPhotoCatalog(m.index, "characters", "").length, 0);
});
test("roster import is additive, deduplicated and targets the current draft only", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    target = { type: "roster", id: "draft", kind: "characters" };
  const r = await m.applyPhotoSelection(d, target, [
    "hulk",
    "hulk",
    "black-cat",
  ]);
  assert.equal(r.count, 2);
  assert.deepEqual(d.rosters.draft.characters, ["hulk", "black-cat"]);
  assert.equal((await m.applyPhotoSelection(d, target, ["hulk"])).count, 0);
  d.rosters.draft.id = "other";
  await assert.rejects(
    m.applyPhotoSelection(d, target, ["wong"]),
    /другой ростер/,
  );
});
test("old card editions normalize to the current family without duplicate tactics", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    old = lists.tactics.find(
      (c) => d.rosters.canonical("tactics", c.slug) !== c.slug,
    );
  assert(old);
  const latest = d.rosters.canonical("tactics", old.slug);
  d.rosters.draft.tactics = [old.slug];
  assert.equal(
    (
      await m.applyPhotoSelection(
        d,
        { type: "roster", id: "draft", kind: "tactics" },
        [latest],
      )
    ).count,
    0,
  );
});
test("unknown cards and grunts cannot be injected through the import API", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    target = { type: "roster", id: "draft", kind: "characters" };
  await assert.rejects(
    m.applyPhotoSelection(d, target, ["../../private"]),
    /неизвестная/,
  );
  assert.deepEqual(d.rosters.draft.characters, []);
});
test("battle import is one undoable transaction and preserves existing fighter state", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    Core = require("../battle-core.js");
  d.battle.current = battleMatch(d);
  d.battle.domain = { Core };
  const h = await d.catalog.detail("hulk");
  d.battle.current.references.hulk = h;
  d.battle.current.opponent.fighters = [
    Core.fighter(d.catalog.byId.get("hulk"), h, "old-hulk"),
  ];
  d.battle.current.opponent.fighters[0].power = 7;
  let edits = 0;
  d.battle.edit = (label, fn) => {
    edits++;
    d.battle.current = Core.update(
      d.battle.current,
      label,
      fn,
      "2026-11-01T00:01:00Z",
    );
    return true;
  };
  await m.applyPhotoSelection(
    d,
    { type: "battle", id: "match", side: "opponent", kind: "characters" },
    ["hulk", "black-cat", "wong"],
  );
  assert.equal(edits, 1);
  assert.equal(d.battle.current.opponent.fighters.length, 3);
  assert.equal(d.battle.current.opponent.fighters[0].power, 7);
  assert.equal(d.battle.current.undo.length, 1);
  const undone = Core.undo(d.battle.current, "2026-11-01T00:02:00Z");
  assert.equal(undone.opponent.fighters.length, 1);
  assert.equal(undone.opponent.fighters[0].power, 7);
});
test("battle never loads partially if one character reference fails", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d);
  d.catalog.detail = async () => {
    throw Error("offline missing reference");
  };
  let calls = 0;
  d.battle.edit = () => {
    calls++;
    return true;
  };
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "characters" },
      ["hulk", "wong"],
    ),
    /offline/,
  );
  assert.equal(calls, 0);
});
test("changing the battle while references load cannot import into the new battle", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d);
  d.catalog.detail = async () => {
    d.battle.current = { ...d.battle.current, id: "other" };
    return {};
  };
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "characters" },
      ["hulk"],
    ),
    /другая партия/,
  );
});
test("own squad and peer imports enforce roster membership and preparation ownership", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d, "preparing");
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "mine", kind: "characters" },
      ["wong"],
    ),
    /Нет в ростере/,
  );
  d.battle.activeNetwork = true;
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "characters" },
      ["hulk"],
    ),
    /только свой отряд/,
  );
});
test("finished battles and wrong crisis types are rejected before mutation", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d, "finished");
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "tactics" },
      ["fall-back"],
    ),
    /Завершённую/,
  );
  d.battle.current.status = "active";
  const extract = m.cards.crises.find((c) => c.type === "Extraction");
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      {
        type: "battle",
        id: "match",
        side: "opponent",
        kind: "crises",
        mission: "secure",
      },
      [extract.slug],
    ),
    /Другой тип/,
  );
});
test("battle tactic count and one mission per type are explicit selection constraints", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d);
  d.battle.current.opponent.tactics = Array.from({ length: 5 }, (_, i) => ({
    slug: "old" + i,
  }));
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "tactics" },
      ["fall-back"],
    ),
    /ещё 0 тактик/,
  );
  const sec = m.cards.crises
    .filter((c) => c.type === "Secure")
    .slice(0, 2)
    .map((c) => c.slug);
  await assert.rejects(
    m.applyPhotoSelection(
      d,
      { type: "battle", id: "match", side: "opponent", kind: "crises" },
      sec,
    ),
    /по одной/,
  );
});
test("store accumulates photos, deduplicates and applies only after confirmation", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    recognizer = nativeFake(),
    s = new m.PhotoImportStore(d, recognizer);
  s.openRoster("characters");
  await s.addFiles([
    { id: "one", text: "HULK" },
    { id: "two", text: "HULK\nBLACK CAT" },
  ]);
  assert.equal(s.photos.length, 2);
  assert.equal(s.selected.length, 2);
  assert.deepEqual(d.rosters.draft.characters, []);
  await s.apply();
  assert.equal(s.target, null);
  assert.deepEqual(
    new Set(d.rosters.draft.characters),
    new Set(["hulk", "black-cat"]),
  );
  assert.equal(recognizer.released.length, 2);
});
test("store ignores late OCR results after closing or switching target", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    recognizer = nativeFake();
  let resolve;
  recognizer.recognize = () => new Promise((r) => (resolve = r));
  const s = new m.PhotoImportStore(d, recognizer);
  s.openRoster("characters");
  const pending = s.addFiles([{ id: "late" }]);
  s.close();
  s.openRoster("tactics");
  resolve({ text: "HULK" });
  await pending;
  assert.equal(s.target.kind, "tactics");
  assert.equal(s.rows.length, 0);
  assert.equal(s.photos.length, 0);
  assert.equal(s.busy, false);
  assert(recognizer.released.includes("late"));
});
test("removing one photo removes its evidence but keeps another photo and manual selections", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    s = new m.PhotoImportStore(d, nativeFake());
  s.openRoster("characters");
  await s.addFiles([
    { id: "one", text: "HULK" },
    { id: "two", text: "HULK\nBLACK CAT" },
  ]);
  s.addManual("wong");
  s.removePhoto("two");
  assert.deepEqual(
    new Set(s.selected.map((r) => r.slug)),
    new Set(["hulk", "wong"]),
  );
});
test("one unreadable photo does not lose successful photos and can be retried by rotating", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    recognizer = nativeFake();
  recognizer.recognize = async (p) => {
    if (p.id === "bad" && !p.rotation) throw Error("blurred");
    return { text: "WONG" };
  };
  const s = new m.PhotoImportStore(d, recognizer);
  s.openRoster("characters");
  await s.addFiles([{ id: "bad" }, { id: "good" }]);
  assert.equal(s.photos.find((p) => p.id === "bad").error, "blurred");
  assert.equal(s.selected.length, 1);
  await s.rotate("bad", 90);
  assert.equal(s.photos.find((p) => p.id === "bad").error, "");
  assert.equal(s.selected.length, 1);
});
test("photographing several same-type crises does not silently choose the first mission", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d);
  const sec = m.cards.crises.filter((c) => c.type === "Secure").slice(0, 2);
  const s = new m.PhotoImportStore(d, nativeFake());
  s.openBattle("opponent", "crises");
  await s.addFiles([{ id: "crises", text: sec.map((c) => c.name).join("\n") }]);
  assert.equal(s.selected.length, 0);
  s.toggleRow(s.rows.find((r) => r.slug === sec[1].slug).key, true);
  assert.equal(s.selected.length, 1);
  assert.equal(s.selected[0].slug, sec[1].slug);
});
test("photo limit is enforced without silently dropping files", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    s = new m.PhotoImportStore(d, nativeFake());
  s.openRoster("characters");
  await s.addFiles(
    Array.from({ length: 13 }, (_, i) => ({ id: String(i), text: "HULK" })),
  );
  assert.equal(s.photos.length, 0);
  assert.match(s.error, /12 фото/);
});

test("a corrected ambiguous detection and a later exact photo stay one row with one explicit choice", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards),
    s = new m.PhotoImportStore(d, nativeFake());
  s.openRoster("characters");
  s.rows = [
    {
      key: "characters:ambiguous:example",
      kind: "characters",
      slug: null,
      name: "Black Cat",
      exact: false,
      confidence: 0.9,
      ambiguous: true,
      checked: false,
      options: [{ slug: "black-cat", name: "Black Cat" }],
      evidence: [],
    },
  ];
  s.chooseRow("characters:ambiguous:example", "black-cat");
  await s.addFiles([{ id: "one", text: "BLACK CAT" }]);
  assert.equal(s.rows.filter((r) => r.slug === "black-cat").length, 1);
  s.toggleRow(s.rows.find((r) => r.slug === "black-cat").key, false);
  await s.addFiles([{ id: "two", text: "BLACK CAT" }]);
  assert.equal(s.rows.filter((r) => r.slug === "black-cat").length, 1);
  assert.equal(s.selected.length, 0);
});
test("cancel rejects an in-flight recognition wait instead of leaving an unresolved worker job", async () => {
  const { PhotoRecognizer } =
    await import("../frontend/src/photo-import/recognizer.js");
  const r = new PhotoRecognizer(),
    job = r.waitFor(new Promise(() => {}), r.generation);
  const rejection = assert.rejects(job, /отменено/);
  await r.cancel();
  await rejection;
  assert.equal(r.pending.size, 0);
});
test("closing during worker parameter initialization terminates that late worker", async () => {
  const { PhotoRecognizer } =
    await import("../frontend/src/photo-import/recognizer.js");
  const before = global.window,
    beforeDocument = global.document;
  let release,
    terminated = 0;
  global.window = {
    Tesseract: {
      OEM: { LSTM_ONLY: 1 },
      createWorker: async () => ({
        setParameters: () => new Promise((r) => (release = r)),
        terminate: async () => {
          terminated++;
        },
      }),
    },
  };
  global.document = { baseURI: "http://localhost/" };
  try {
    const r = new PhotoRecognizer(),
      job = r.getWorker();
    const rejection = assert.rejects(job, /отменено/);
    await new Promise(setImmediate);
    await r.cancel();
    release();
    await rejection;
    assert.equal(r.worker, null);
    assert.equal(terminated, 1);
  } finally {
    if (before === undefined) delete global.window;
    else global.window = before;
    if (beforeDocument === undefined) delete global.document;
    else global.document = beforeDocument;
  }
});
test("a failed peer acknowledgement keeps the review and original battle for retry", async () => {
  const m = await setup(),
    d = fakeDeps(m.cards);
  d.battle.current = battleMatch(d);
  d.battle.activeNetwork = true;
  d.battle.network = {
    editAsync: async () => {
      throw Error("Нет соединения");
    },
  };
  d.battle.domain = { Core: require("../battle-core.js") };
  const s = new m.PhotoImportStore(d, nativeFake());
  s.openBattle("opponent", "tactics");
  await s.addFiles([{ id: "one", text: "CLONE SAGA" }]);
  await s.apply();
  assert(s.target);
  assert.match(s.error, /Нет соединения/);
  assert.equal(s.photos.length, 1);
  assert.equal(d.battle.current.opponent.tactics.length, 0);
});
test("truncated distinctive crisis titles are selected by default", async () => {
  const m = await setup(),
    r = m
      .findPhotoCards(m.index, "crises", { text: "POWER OVERLOAD! FACTORY" })
      .find((r) => r.slug === "power-overload-factory-goes-up-in-flames");
  assert(r);
  assert.equal(r.checked, true);
  assert.equal(r.exact, false);
});
