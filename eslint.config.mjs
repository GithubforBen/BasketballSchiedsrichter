import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lint-Regeln.
 *
 * Neben den ueblichen Pruefungen setzen die letzten beiden Bloecke die
 * Design-System-Treue durch: keine rohen Hex-Farben, keine rohen Pixelwerte
 * und keine fremde Schrift im TSX. Die Muster stammen aus
 * design/_ds/.../_adherence.oxlintrc.json und sind hier auf ESLint uebertragen.
 */
export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'design/**', 'drizzle/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Die Lint-Konfiguration selbst gehoert zu keinem tsconfig-Projekt und kann
    // deshalb nicht typgestuetzt geprueft werden.
    files: ['eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Design-System-Treue — gilt fuer alles, was Oberflaeche erzeugt.
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Rohe Hex-Farbe. Nimm ein Token: var(--color-…) oder var(--status-…) aus app.css.',
        },
        {
          // JSX schreibt fontFamily, CSS-Strings font-family — beide Formen pruefen.
          selector: "Property[key.name='fontFamily'] > Literal[value=/^(?!(var\\(|Archivo))/]",
          message: 'Fremde Schrift. Das System kennt nur Archivo über var(--font-heading|body).',
        },
        {
          selector: 'Literal[value=/font-family\\s*:\\s*(?![\'"]?(?:Archivo|var\\())/i]',
          message: 'Fremde Schrift. Das System kennt nur Archivo über var(--font-heading|body).',
        },
        {
          // Abstaende sind als Tokens vorhanden (--space-1 bis --space-8), also
          // gehoeren dort keine rohen Pixelwerte hin. Schriftgroessen und Masse
          // einzelner Bausteine bleiben frei — dafuer gibt es keine Tokens.
          selector:
            "Property[key.name=/^(margin|padding|gap|rowGap|columnGap)([A-Z].*)?$/] > Literal[value=/\\d+px/]",
          message: 'Roher Pixelwert für einen Abstand. Nimm var(--space-1 … --space-8).',
        },
      ],
    },
  },
  {
    // Skripte laufen im Terminal und duerfen ihren Fortschritt melden.
    files: ['src/db/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/__fixtures__/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
