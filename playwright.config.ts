import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3001);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}`,
    // Headless Chromium renders WebGL through SwiftShader.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  // Reuses a running `next start` on the port; otherwise starts one (requires `npm run build` first).
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
