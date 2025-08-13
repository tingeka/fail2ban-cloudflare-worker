// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // This first object handles ignoring the temporary files.
  // It's a top-level configuration that applies to the entire project.
  {
    ignores: [
      '.wrangler/**',
      'worker-configuration.d.ts'
    ],
  },
  
  // This second object applies the base rules to your source code.
  {
    // Define the files to which this configuration applies.
    files: ['src/**/*.ts', 'tests/**/*.ts'],

    // The 'extends' property pulls in the recommended rule sets.
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    
    // The 'languageOptions' property configures the environment.
    // We add the Cloudflare Worker globals here.
    languageOptions: {
      globals: {
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        addEventListener: 'readonly',
        console: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
);