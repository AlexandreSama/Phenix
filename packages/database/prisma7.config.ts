import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// En local : le .env de la racine. En Docker : les variables viennent de Compose.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    datasource: { url: process.env["DATABASE_URL"] },
});