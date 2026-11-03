const axePath = require.resolve("axe-core/axe.min.js");
exports.scan = async function scan(page) {
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => !!window.axe)))
    await page.addScriptTag({ path: axePath });
  return page.evaluate(() =>
    axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    }),
  );
};
exports.summarize = (result) =>
  result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    count: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target),
  }));
