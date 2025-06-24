import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: ['node_modules', '.next', 'out'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        document: true,
        window: true,
        navigator: true,
        process: true,
        fetch: true,
        Request: true,
        console: true,
        alert: true,
        confirm: true,
        URL: true,
        Blob: true,
        File: true,
        Buffer: true,
        location: true,
        HTMLInputElement: true,
        React: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-undef': 'off',
    },
  },
  {
    files: ['public/*.js'],
    languageOptions: {
      globals: {
        document: true,
        window: true,
      },
    },
  },
  {
    files: ['tailwind.config.js'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'writable',
      },
    },
  },
]
