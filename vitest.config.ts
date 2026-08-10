import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Le moteur de calcul est la seule partie dont une erreur est
      // invisible et grave. La spec exige 100 % — le seuil est imposé
      // par la config, pas seulement constaté.
      include: ['lib/calcul/**/*.ts'],
      // `types.ts` ne contient que des types : il est entièrement effacé
      // à la compilation, il n'y a rien à couvrir.
      exclude: ['lib/calcul/types.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
