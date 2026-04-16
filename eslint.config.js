// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'dist/',
      'public/',
      'babel-plugins/',
      'backend/',
      '_expo/',
      'web-build/',
      'node_modules/',
      'android/',
      '*.bundle.js',
      '*.bundle.js.map',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/ban-tslint-comment': 'off',
      'react/no-unescaped-entities': 'off',
      'prefer-const': 'off',
      'react/prop-types': 'warn',
      'no-case-declarations': 'off',
      'no-empty': 'off',
      'react/display-name': 'off',
      'no-constant-condition': 'off',
      'no-var': 'off',
      'no-useless-escape': 'off',
    },
  },
]);
