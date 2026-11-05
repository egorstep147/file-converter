import { defineConfig, devices } from '@playwright/test';

// BASE_URL=https://... npm run test:e2e  -> test the deployed site instead of a local build
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: remote ?? 'http://localhost:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote
    ? undefined
    : {
        command: 'npm run build && npx astro preview --port 4321',
        url: 'http://localhost:4321/en/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
