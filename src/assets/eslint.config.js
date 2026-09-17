import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

// Config ESLint "flat config" (format natif ESLint 9, celui utilisé par
// défaut par les projets Vite récents). Règles volontairement peu
// nombreuses : attrape les vraies erreurs (hooks mal utilisés, variables
// non définies) sans imposer un style particulier.
export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Désactivée : cette règle signale toute apostrophe dans un texte
      // JSX, ce qui déclenche sur pratiquement chaque phrase en français
      // ("l'équipe", "c'est"...) — que du bruit, pas de vrai risque.
      'react/no-unescaped-entities': 'off',
      // Désactivée : règle récente qui signale le chargement de données
      // dans un useEffect suivi d'un setState — un pattern standard et
      // correct en React 18 (chargement initial depuis Supabase/l'API),
      // pas une erreur dans ce projet.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]
