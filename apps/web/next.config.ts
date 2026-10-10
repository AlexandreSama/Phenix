import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker légère : Next copie seulement les fichiers utilisés dans .next/standalone
  output: "standalone",
  // Racine du monorepo, pour que les packages @phenix/* soient trouvés
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // En dev, le panel relaie /api/* vers l'API : navigateur, cookies et API partagent la même origine.
  // En prod, c'est le reverse proxy qui fait ce relais (voir le Caddyfile).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const apiUrl = process.env["API_URL"] ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;