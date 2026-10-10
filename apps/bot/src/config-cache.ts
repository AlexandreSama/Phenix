import type { Redis } from "ioredis";
import type { GuildConfig, PrismaClient } from "@phenix/database";
import { REDIS_CHANNELS } from "@phenix/shared";

/** Garde la config de chaque serveur en mémoire jusqu'à ce que l'API signale un changement */
export class ConfigCache {
    private readonly cache = new Map<string, GuildConfig | null>();

    constructor(private readonly prisma: PrismaClient) {}

    async get(guildId: string): Promise<GuildConfig | null> {
        if (this.cache.has(guildId)) return this.cache.get(guildId) ?? null;
        const config = await this.prisma.guildConfig.findUnique({ where: { guildId } });
        this.cache.set(guildId, config);
        return config;
    }

    async listen(subscriber: Redis): Promise<void> {
        await subscriber.subscribe(REDIS_CHANNELS.configInvalidated);
        subscriber.on("message", (_channel, guildId) => this.cache.delete(guildId));
    }
}