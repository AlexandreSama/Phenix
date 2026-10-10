import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";

export function createMariaDbAdapter(databaseUrl: string, connectionLimit = 10) {
    const url = new URL(databaseUrl);
    return new PrismaMariaDb({
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        connectionLimit,
        // MySQL 8 sans TLS (réseau Docker interne) : le driver récupère la clé RSA du serveur
        allowPublicKeyRetrieval: true,
    });
}

export function createPrismaClient(databaseUrl: string) {
    return new PrismaClient({ adapter: createMariaDbAdapter(databaseUrl) });
}