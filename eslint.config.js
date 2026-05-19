import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'web/vendor/**',
      '.trellis/**',
      '.claude/**',
      '.codex/**',
      '.agents/**',
      '.ace-tool/**',
    ],
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: js.configs.recommended.rules,
  },
  {
    files: ['web/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: js.configs.recommended.rules,
  },
];
