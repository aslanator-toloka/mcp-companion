const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 45000,
  expect: { timeout: 7000 },
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
  reporter: "list",
});
