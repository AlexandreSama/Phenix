import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { Redis } from "ioredis";
import type { GuildConfig } from "@phenix/database";
import { REDIS_CHANNELS } from "@phenix/shared";
import { ConfigCache } from "../src/config-cache.js";

const GUILD = "123456789012345678";

function config(enableLevels: boolean): GuildConfig {
    return { guildId: GUILD, enableLevels } as GuildConfig;
}

function fakePrisma(...results: (GuildConfig | null)[]) {
    const findUnique = vi.fn();
    for (const result of results) findUnique.mockResolvedValueOnce(result);
    return { prisma: { guildConfig: { findUnique } } as never, findUnique };
}

/** Promesse que le test résout à la main, pour simuler une requête encore en cours */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

describe("ConfigCache", () => {
    it("ne relit pas la base tant que la config est en cache", async () => {
        const { prisma, findUnique } = fakePrisma(config(true));
        const cache = new ConfigCache(prisma);

        expect(await cache.get(GUILD)).toEqual(config(true));
        expect(await cache.get(GUILD)).toEqual(config(true));
        expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it("garde aussi en cache l'absence de config", async () => {
        const { prisma, findUnique } = fakePrisma(null);
        const cache = new ConfigCache(prisma);

        expect(await cache.get(GUILD)).toBeNull();
        expect(await cache.get(GUILD)).toBeNull();
        expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it("relit la base après le TTL, même sans invalidation", async () => {
        let now = 0;
        const { prisma, findUnique } = fakePrisma(config(true), config(false));
        const cache = new ConfigCache(prisma, 1_000, () => now);

        await cache.get(GUILD);
        now = 999;
        expect(await cache.get(GUILD)).toEqual(config(true));
        now = 1_000;
        expect(await cache.get(GUILD)).toEqual(config(false));
        expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it("relit la base après une invalidation", async () => {
        const { prisma, findUnique } = fakePrisma(config(true), config(false));
        const cache = new ConfigCache(prisma);

        await cache.get(GUILD);
        cache.invalidate(GUILD);
        expect(await cache.get(GUILD)).toEqual(config(false));
        expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it("ne garde pas une lecture lancée avant une invalidation", async () => {
        const pending = deferred<GuildConfig>();
        const findUnique = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(config(false));
        const cache = new ConfigCache({ guildConfig: { findUnique } } as never);

        const stale = cache.get(GUILD); // lit la base avant le commit de l'API...
        cache.invalidate(GUILD); // ...l'invalidation arrive pendant la lecture
        pending.resolve(config(true));
        expect(await stale).toEqual(config(true));

        expect(await cache.get(GUILD)).toEqual(config(false));
        expect(findUnique).toHaveBeenCalledTimes(2);
    });

    it("écoute le canal d'invalidation et se vide à la reconnexion Redis", async () => {
        const { prisma, findUnique } = fakePrisma(config(true), config(true), config(true), config(true));
        const cache = new ConfigCache(prisma);
        const subscriber = Object.assign(new EventEmitter(), { subscribe: vi.fn().mockResolvedValue(1) });
        await cache.listen(subscriber as unknown as Redis);
        expect(subscriber.subscribe).toHaveBeenCalledWith(REDIS_CHANNELS.configInvalidated);

        await cache.get(GUILD);
        subscriber.emit("message", "autre-canal", GUILD);
        await cache.get(GUILD);
        expect(findUnique).toHaveBeenCalledTimes(1);

        subscriber.emit("message", REDIS_CHANNELS.configInvalidated, GUILD);
        await cache.get(GUILD);
        expect(findUnique).toHaveBeenCalledTimes(2);

        subscriber.emit("ready");
        await cache.get(GUILD);
        expect(findUnique).toHaveBeenCalledTimes(3);
    });
});
