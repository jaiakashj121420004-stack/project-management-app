import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // supabase/functions runs on Deno (its own runtime/globals) and scripts/ are
  // standalone Node tools — neither belongs to the app's typed TS project graph.
  { ignores: ['dist', 'dev-dist', 'node_modules', '.remember', 'supabase/functions', 'scripts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Anti-slop: forbid `any` outright (see CLAUDE.md coding standards).
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Config files run in Node and aren't part of the typed project graph.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Tests: relax the `no-unsafe-*` family (fixtures cast partial rows, and
  // Tiptap's `attrs` are typed `any`) and allow non-null assertions on the
  // known-shaped data under test. The app source keeps the strict rules.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
