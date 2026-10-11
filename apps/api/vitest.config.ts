import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Comme customConditions dans tsconfig.json : les packages @phenix/* sont lus dans src/,
// sans attendre leur build (la CI lance les tests avant pnpm build).
// Vite remplace ses conditions par défaut au lieu de les compléter : on les répète.
const conditions = ['@phenix/source', 'module', 'node', 'development|production'];

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
