const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
let roles;
const data = require("../data/character-roles.json"),
  provenance = require("../data/character-role-provenance.json"),
  catalog = require("../data/catalog.json");
test.before(async () => {
  roles = await import("../frontend/src/character-roles.js");
});
test("each current non-Grunt character has a curated profile tied to its actual card version; role ids, conditions and notes are valid", () => {
  const keys = data.roles.map((r) => r.id),
    known = new Set(keys);
  assert.equal(known.size, 10);
  assert.deepEqual(
    Object.keys(data.characters).sort(),
    catalog.characters.map((c) => c.slug).sort(),
  );
  for (const c of catalog.characters) {
    const p = data.characters[c.slug],
      proof = provenance.characters[c.slug];
    assert.equal(p.name, c.name);
    assert.equal(p.roles.length > 0, !c.isGrunt, c.slug);
    assert.equal(p.roles.length, new Set(p.roles).size, c.slug);
    assert(
      p.roles.every((r) => known.has(r)),
      c.slug,
    );
    assert(
      Object.keys(p.notes || {}).every((r) => p.roles.includes(r)),
      c.slug,
    );
    for (const [id, requirement] of Object.entries(p.requires || {})) {
      assert(p.roles.includes(id));
      if (requirement.tactic)
        assert(
          require("../data/roster-cards.json").tactics.some(
            (t) => t.slug === requirement.tactic,
          ),
        );
      if (requirement.ally) assert(data.characters[requirement.ally]);
      if (requirement.leader) assert(data.characters[requirement.leader]);
    }
    assert.equal(
      proof.cardVersion,
      c.version,
      c.slug + " needs a role review after catalog update",
    );
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(`data/cards/${c.slug}.json`))
      .digest("hex");
    assert.equal(
      proof.cardSha256,
      hash,
      c.slug + " needs a role review after card update",
    );
  }
});
test("roles have stable semantic ordering; unknown identities, duplicate slots and Grunts don't invent providers", () => {
  assert.deepEqual(
    roles.characterRoles("wong").map((r) => r.id),
    ["support"],
  );
  assert.deepEqual(
    roles.characterRoles("nebula").map((r) => r.id),
    ["striker"],
  );
  assert.deepEqual(roles.characterRoles("constructor"), []);
  assert.deepEqual(roles.characterRoles("hand-ninjas-grunts"), []);
  assert.deepEqual(roles.squadRoles([]), []);
  const summary = roles.squadRoles([
    "wong",
    "wong",
    "ghost-spider",
    "unknown",
    "hand-ninjas-grunts",
  ]);
  assert.equal(summary.find((r) => r.id === "support").members.length, 1);
  assert.equal(summary.find((r) => r.id === "protector").members.length, 1);
  assert(summary.every((r) => r.members.every((m) => m.slug !== "unknown")));
  assert.equal(
    roles.roleProfile({
      id: "prime-sentinel",
      inventoryIds: ["prime-sentinel-1", "prime-sentinel-2"],
    }).slug,
    "prime-sentinel-1",
  );
  assert.equal(
    roles
      .squadRoles(["prime-sentinel-1", "prime-sentinel-2"])
      .find((r) => r.id === "brawler").members.length,
    2,
  );
});
test("tactics, partner and leadership conditions affect roster/squad summaries without erasing individual conditional explanations", () => {
  const has = (xs, id) => xs.some((r) => r.id === id);
  assert(has(roles.characterRoles("rhino"), "extract-hunter"));
  assert(!has(roles.squadRoles(["rhino"], { tactics: [] }), "extract-hunter"));
  assert(
    has(
      roles.squadRoles(["rhino"], { tactics: ["this-is-a-robbery"] }),
      "extract-hunter",
    ),
  );
  assert(
    has(
      roles.squadRoles(["rhino"], { tactics: ["This is a Robbery"] }),
      "extract-hunter",
    ),
  );
  assert(!has(roles.squadRoles(["groot"]), "protector"));
  assert(has(roles.squadRoles(["groot", "rocket-raccoon"]), "protector"));
  assert(!has(roles.squadRoles(["storm"], { leaderSlug: "" }), "support"));
  assert(has(roles.squadRoles(["storm"], { leaderSlug: "storm" }), "support"));
  assert(has(roles.squadRoles(["storm"]), "support"));
});
test("summaries recompute from the actual selection and don't mutate roster or saved data", () => {
  const roster = ["wong", "ghost-spider", "black-cat"],
    before = JSON.stringify(roster);
  const full = roles.squadRoles(roster);
  assert.equal(full.find((r) => r.id === "extract-runner").members.length, 2);
  const squad = roles.squadRoles(roster.filter((s) => s !== "wong"));
  assert(!squad.some((r) => r.id === "support"));
  assert.equal(JSON.stringify(roster), before);
});

test("every role uses a real pinned Font Awesome webfont glyph; local CSS, font and license match upstream assets", () => {
  const base = "assets/fontawesome/7.3.1/",
    source = require("../" + base + "SOURCE.json");
  const css = fs.readFileSync(base + "css/fontawesome.min.css", "utf8");
  assert.equal(source.version, "7.3.1");
  for (const role of data.roles) {
    assert.equal(role.icon, source.roleIcons[role.id]);
    assert(
      css.includes(".fa-" + role.icon + "{") ||
        css.includes(".fa-" + role.icon + ","),
      role.icon,
    );
  }
  for (const [file, expected] of Object.entries(source.sha256))
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(base + file))
        .digest("hex"),
      expected,
      file,
    );
  assert.equal(
    fs
      .readFileSync(base + "webfonts/fa-solid-900.woff2")
      .subarray(0, 4)
      .toString(),
    "wOF2",
  );
  const index = fs.readFileSync("index.html", "utf8");
  assert(index.includes(base + "css/fontawesome.min.css"));
  assert(index.includes(base + "css/solid.min.css"));
});
