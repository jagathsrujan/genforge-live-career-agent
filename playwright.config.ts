import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      OPENCODE_API_KEY: "ci-test-only",
      GENFORGE_PI_BIN: path.join(process.cwd(), "tests/fixtures/fake-pi.mjs"),
      GENFORGE_DATA_DIR: path.join(process.cwd(), ".e2e-data"),
      GENFORGE_NO_OPEN: "1",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
