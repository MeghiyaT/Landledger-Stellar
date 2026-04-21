module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',    // disables 'React must be in scope' for new JSX transform
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Prop-types are not needed when using TypeScript or when relying on runtime checks
    // Disable for now to reduce noise — add TypeScript for proper type safety
    'react/prop-types': 'warn',
    // Allow unescaped entities in JSX (apostrophes in text are extremely common)
    'react/no-unescaped-entities': 'warn',
    // Allow unused function params if prefixed with underscore
    'no-unused-vars': ['error', {
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
  },
}
