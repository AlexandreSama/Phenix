import type { Redis } from "ioredis";
import type { GuildConfig, PrismaClient } from "@phenix/database";
import { REDIS_CHANNELS } from "@phenix/shared";

/** Filet de sécurité si une invalidation se perd : la config est relue au plus tard après ce délai */
export const CONFIG_CACHE_TTL_MS = 5 * 60_000;

type Entry = { config: GuildConfig | null; expiresAt: number };

/** Garde la config de chaque serveur en mémoire jusqu'à ce que l'API signale un changement */
export class ConfigCache {
    private readonly cache = new Map<string, Entry>();
    /**
     * Incrémenté à chaque invalidation. Une lecture lancée avant une invalidation
     * ne remplit pas le cache : elle a pu lire la base avant le commit de l'API.
     */
    private generation = 0;

    constructor(
        private readonly prisma: Pick<PrismaClient, "guildConfig">,
        private readonly ttlMs = CONFIG_CACHE_TTL_MS,
        private readonly now: () => number = Date.now,
    ) {}

    async get(guildId: string): Promise<GuildConfig | null> {
        const entry = this.cache.get(guildId);
        if (entry && entry.expiresAt > this.now()) return entry.config;

        const generation = this.generation;
        const config = await this.prisma.guildConfig.findUnique({ where: { guildId } });
        if (generation === this.generation) {
            this.cache.set(guildId, { config, expiresAt: this.now() + this.ttlMs });
        }
        return config;
    }

    invalidate(guildId: string): void {
        this.generation++;
        this.cache.delete(guildId);
    }

    clear(): void {
        this.generation++;
        this.cache.clear();
    }

    async listen(subscriber: Redis): Promise<void> {
        subscriber.on("message", (channel, guildId) => {
            if (channel === REDIS_CHANNELS.configInvalidated) this.invalidate(guildId);
        });
        // Les messages publiés pendant une coupure Redis sont perdus : on repart d'un cache vide
        subscriber.on("ready", () => this.clear());
        await subscriber.subscribe(REDIS_CHANNELS.configInvalidated);
    }
}
