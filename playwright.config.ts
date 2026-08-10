import { defineConfig, devices } from '@playwright/test';

/**
 * Port dédié, distinct du 3000 par défaut.
 *
 * `reuseExistingServer` attraperait sinon n'importe quel serveur de
 * développement déjà en écoute sur 3000 — y compris celui d'un autre
 * projet — et les tests s'exécuteraient contre la mauvaise application
 * en échouant de façon incompréhensible.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      // L'application doit être utilisable d'une seule main sur un
      // écran de 375 px : c'est la cible de référence, pas le bureau.
      //
      // Chromium et non le profil « iPhone 13 » : ce dernier lance
      // WebKit, dont le binaire livré ici est incompatible avec le
      // pilote (`Unknown setting: PushAPIEnabled`). Le viewport et le
      // tactile sont ce que ces tests vérifient ; le moteur de rendu
      // importera davantage quand il y aura des tests visuels.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
