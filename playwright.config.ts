import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      // L'application doit être utilisable d'une seule main sur un
      // écran de 375 px : c'est la cible de référence, pas le bureau.
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
