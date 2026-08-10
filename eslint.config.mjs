import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Le moteur manipule des nombres bruts : un `any` masquerait une
      // erreur d'unité (kcal contre kg, grammes contre portions).
      '@typescript-eslint/no-explicit-any': 'error',
      // Le préfixe `_` marque une valeur volontairement écartée, par
      // exemple un champ retiré par déstructuration.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
