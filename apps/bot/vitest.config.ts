import { defineConfig } from "vitest/config";

// Comme customConditions dans tsconfig.base.json : les packages @phenix/* sont lus dans src/,
// sans attendre leur build (la CI lance les tests avant pnpm build).
// Vite remplace ses conditions par défaut au lieu de les compléter : on les répète.
const conditions = ["@phenix/source", "module", "node", "development|production"];

export default defineConfig({
    resolve: { conditions },
    ssr: { resolve: { conditions } },
});
