const { test } = require("node:test");
const assert = require("node:assert/strict");
const catalog = require("../data/catalog.json");
const rawCards = require("../data/roster-cards.json");
let codec, cardIndex, cards, create;
test.before(async () => {
  create = (await import("../frontend/src/roster-code.js"))
    .createRosterCodeCodec;
  const { latestCards } = await import("../frontend/src/validation.js");
  cards = Object.fromEntries(
    ["tactics", "crises"].map((kind) => [kind, latestCards(rawCards[kind])]),
  );
  cardIndex = new Map();
  for (const kind of ["tactics", "crises"]) {
    const families = new Map(
      cards[kind].map((c) => [c.cardFamily || c.name, c]),
    );
    for (const row of rawCards[kind])
      cardIndex.set(
        kind + ":" + row.slug,
        families.get(row.cardFamily || row.name) || row,
      );
  }
  codec = create({
    characters: catalog.characters,
    cards: rawCards,
    canonical: (kind, slug) => cardIndex.get(kind + ":" + slug)?.slug || slug,
  });
});
const roster = () => ({
  id: "private-local-id",
  name: "Мой ростер · Халк 🟢",
  affiliation: "Avengers",
  characters: ["hulk", "iron-man"],
  tactics: ["gamma-launch"],
  crises: ["infinity-formula-goes-missing"],
  groups: ["private-group"],
  tournamentSource: { player: "private provenance" },
});

test("MCT codes use public exchange identifiers and canonicalize old printings; Jarvis URLs and whitespace are accepted", () => {
  const decoded = codec.decode(" 00040101,\n00010201, 00010302 ");
  assert.deepEqual(decoded.characters, ["hulk"]);
  assert.deepEqual(decoded.tactics, ["avengers-assemble-ca10"]);
  assert.deepEqual(decoded.crises, ["infinity-formula-goes-missing-ca09"]);
  assert.equal(codec.encode(decoded), "00040101,00010201,00010302");
  assert.deepEqual(
    codec.decode(
      "https://www.jarvis-protocol.com/roster-validator?mctCode=00040101%2C00010201%2C00010302",
    ),
    decoded,
  );
  const duplicatePrinting = codec.decode("00040101,00010201,00010201");
  assert.equal(duplicatePrinting.tactics.length, 1);
});

test("a real Longshanks roster with ten characters, ten tactics and ten crises imports completely", () => {
  const sample =
    "00010102,00380101,00010103,00040101,00010107,00690101,00470101,01580101,10040102,01680102,00010201,00690201,00520202,00010213,00010214,00570202,00050203,01580205,01430201,01680201,00010302,20230303,20230310,20130307,20130302,20130305,20230308,20230307,20230306,00050301";
  const value = codec.decode(sample);
  assert.equal(value.characters.length, 10);
  assert.equal(value.tactics.length, 10);
  assert.equal(value.crises.length, 10);
  assert(value.characters.includes("hulk"));
  assert.deepEqual(codec.decode(codec.encode(value)), value);
});

test("Companion codes preserve Unicode names, affiliation and membership across devices without local data", () => {
  const source = roster();
  const code = codec.encode(source, "companion");
  assert.match(code, /^MCP1\.[\w-]+$/);
  const value = codec.decode(code);
  assert.equal(value.name, source.name);
  assert.equal(value.affiliation, source.affiliation);
  assert.deepEqual(value.characters, source.characters);
  assert.deepEqual(value.tactics, ["gamma-launch-ca10"]);
  assert.deepEqual(value.crises, ["infinity-formula-goes-missing-ca09"]);
  assert.deepEqual(value.groups, []);
  assert.equal(value.id, undefined);
  assert.equal(value.tournamentSource, undefined);
  assert.equal(codec.encode(value, "companion"), code);
});

test("separate Prime Sentinel copies remain distinct; unsupported gems, unknown IDs and malformed codes fail without partial lists", () => {
  assert.deepEqual(codec.decode("20230101,20230102").characters, [
    "prime-sentinel-1",
    "prime-sentinel-2",
  ]);
  for (const text of [
    "",
    "0004010",
    "00040101,",
    "00040101 garbage",
    "00040101,99999999",
    "00040101,00040101",
    "00250101",
    "MCP2.abc",
    "MCP1.%bad",
    "MCP1.YQ",
    "x".repeat(20001),
    "https://example.com/?mctCode=00040101",
  ])
    assert.throws(() => codec.decode(text), Error, text.slice(0, 40));
  const payload = (value) =>
    "MCP1." + Buffer.from(JSON.stringify(value)).toString("base64url");
  assert.throws(
    () => codec.decode(payload(["Name", "", ["unknown"], [], []])),
    /не найден/,
  );
  assert.throws(
    () => codec.decode(payload(["Name", "", ["hulk"], "not-an-array", []])),
    /некорректный/,
  );
  assert.throws(
    () => codec.decode(payload(["x".repeat(101), "", [], [], []])),
    /название/,
  );
});

test("cards without a public exchange code still round-trip through Companion format", () => {
  const crisis = cards.crises.find((c) => !c.exportCode);
  assert(crisis);
  const value = { ...roster(), crises: [crisis.slug] };
  assert.throws(() => codec.encode(value), /Выберите формат MCP Companion/);
  assert.deepEqual(codec.decode(codec.encode(value, "companion")).crises, [
    crisis.slug,
  ]);
});
test("ambiguous public identifiers fail only that exchange and leave Companion codes usable", () => {
  const local = create({
    characters: [
      { slug: "a", name: "A", exportCode: "12345678" },
      { slug: "b", name: "B", exportCode: "12345678" },
    ],
    cards: { tactics: [], crises: [] },
  });
  const value = {
    name: "Example",
    affiliation: "",
    characters: ["a"],
    tactics: [],
    crises: [],
  };
  assert.throws(() => local.decode("12345678"), /Неоднозначный код/);
  assert.throws(() => local.encode(value), /Выберите формат MCP Companion/);
  assert.deepEqual(local.decode(local.encode(value, "companion")).characters, [
    "a",
  ]);
});

async function stores(write = () => {}) {
  const { LibraryStore } = await import("../frontend/src/stores/library.js");
  const { RosterStore } = await import("../frontend/src/stores/rosters.js");
  const { validateLibrary } = await import("../frontend/src/validation.js");
  const byId = new Map(catalog.characters.map((c) => [c.slug, c]));
  const library = new LibraryStore({
    write,
    validate: (value) => validateLibrary(value, byId),
  });
  library.configure({ characters: byId });
  library.replace({
    version: 1,
    owned: ["hulk"],
    groups: [{ id: "private-group", name: "Local" }],
    rosters: [roster()],
  });
  const ui = { notify() {}, actions: { showRosterList() {} } };
  const store = new RosterStore(
    library,
    { rows: catalog.characters, byId, affiliations: [] },
    ui,
  );
  store.configure({
    cards,
    codeCards: rawCards,
    index: cardIndex,
    archiveAffiliations: [],
  });
  return { library, store };
}

test("import creates a fresh unsaved draft, preserves the library, and failed saves keep the imported draft", async () => {
  let fail = true;
  const { library, store } = await stores(() => {
    if (fail) throw Error("quota");
  });
  const before = JSON.stringify(library.snapshot);
  store.showCodeImport();
  store.setCodeInput("00040101,99999999");
  assert.equal(store.importCode(), false);
  assert.match(store.dialog.error, /Неизвестные коды/);
  assert.equal(store.draft, null);
  store.setCodeInput(codec.encode(roster(), "companion"));
  assert.equal(store.importCode(), true);
  assert.equal(store.dialog, null);
  assert.notEqual(store.draft.id, "private-local-id");
  assert.deepEqual([...store.draft.groups], []);
  assert.equal(JSON.stringify(library.snapshot), before);
  assert.equal(store.save(), false);
  assert.equal(store.draft.name, roster().name);
  fail = false;
  assert.equal(store.save(), true);
  assert.equal(library.snapshot.rosters.length, 2);
  assert.deepEqual(library.snapshot.owned, ["hulk"]);
  assert.equal(
    library.snapshot.rosters.find((r) => r.id === "private-local-id").name,
    roster().name,
  );
});

test("export includes unsaved edits; importing another roster uses the existing save/discard guard", async () => {
  const { library, store } = await stores();
  store.open("private-local-id");
  store.setField("name", "Unsaved changes");
  store.showCode(undefined, "companion");
  assert.equal(codec.decode(store.dialog.code).name, "Unsaved changes");
  store.closeDialog();
  store.showCodeImport();
  store.setCodeInput("00040101");
  store.importCode();
  assert.equal(store.dialog.type, "leave");
  store.closeDialog();
  assert.equal(store.draft.name, "Unsaved changes");
  store.showCodeImport();
  store.setCodeInput("00040101");
  store.importCode();
  store.leaveWith(false);
  assert.equal(store.draft.name, "Ростер по коду");
  assert.equal(store.dirty, true);
  assert.equal(library.snapshot.rosters.length, 1);
  assert.equal(library.snapshot.rosters[0].name, roster().name);
});
