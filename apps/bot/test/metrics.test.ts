import { describe, expect, it, vi } from "vitest";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@phenix/database";
import { METRICS, redisKeys } from "@phenix/shared";
import { expiresAt, flushDailyMetrics } from "../src/metrics.js";

const GUILD_A = "111111111111111111";
const GUILD_B = "222222222222222222";
const DAY = "2026-10-10";

type Value = { hash: Record<string, string> } | { hll: Set<string> } | { string: string };

/** Juste assez de Redis pour le report : SCAN, HGETALL, PFCOUNT et EXPIREAT en pipeline */
function fakeRedis(data: Record<string, Value>) {
    const expirations = new Map<string, number>();
    const run = (op: string, key: string, arg?: number): [Error | null, unknown] => {
        const value = data[key];
        if (op === "expireat") {
            expirations.set(key, arg!);
            return [null, 1];
        }
        if (op === "hgetall") {
            if (!value) return [null, {}];
            return "hash" in value ? [null, value.hash] : [new Error("WRONGTYPE"), null];
        }
        if (!value) return [null, 0];
        return "hll" in value ? [null, value.hll.size] : [new Error("WRONGTYPE"), null];
    };
    const redis = {
        async *scanStream({ match }: { match: string }) {
            const pattern = new RegExp(`^${match.replaceAll("*", ".*")}$`);
            yield Object.keys(data).filter((key) => pattern.test(key));
        },
        pipeline() {
            const ops: [string, string, number?][] = [];
            const pipeline = {
                hgetall: (key: string) => (ops.push(["hgetall", key]), pipeline),
                pfcount: (key: string) => (ops.push(["pfcount", key]), pipeline),
                expireat: (key: string, at: number) => (ops.push(["expireat", key, at]), pipeline),
                exec: async () => ops.map(([op, key, arg]) => run(op, key, arg)),
            };
            return pipeline;
        },
    };
    return { redis: redis as unknown as Redis, expirations };
}

/** Lignes envoyées à DailyMetric, relues dans les paramètres de la requête SQL */
function fakePrisma() {
    const rows: { day: string; guildId: string; metric: string; value: number }[] = [];
    const $executeRaw = vi.fn(async (_strings: TemplateStringsArray, values: { values: unknown[] }) => {
        const params = values.values;
        for (let i = 0; i < params.length; i += 4) {
            const [day, guildId, metric, value] = params.slice(i, i + 4) as [string, string, string, number];
            rows.push({ day, guildId, metric, value });
        }
        return 0;
    });
    return { prisma: { $executeRaw } as unknown as PrismaClient, rows, $executeRaw };
}

describe("flushDailyMetrics", () => {
    it("recopie la valeur absolue de chaque compteur et le nombre de membres actifs", async () => {
        const { redis } = fakeRedis({
            [redisKeys.dailyCounters(DAY, GUILD_A)]: {
                hash: { [METRICS.messages]: "42", [METRICS.xpGained]: "630" },
            },
            [redisKeys.dailyCounters(DAY, GUILD_B)]: { hash: { [METRICS.interactions]: "3" } },
            [redisKeys.dailyActiveUsers(DAY, GUILD_A)]: { hll: new Set(["u1", "u2"]) },
        });
        const { prisma, rows } = fakePrisma();

        const report = await flushDailyMetrics(redis, prisma);

        expect(report).toEqual({ keys: 3, rows: 4, ignoredKeys: 0 });
        expect(rows).toEqual(
            expect.arrayContaining([
                { day: DAY, guildId: GUILD_A, metric: METRICS.messages, value: 42 },
                { day: DAY, guildId: GUILD_A, metric: METRICS.xpGained, value: 630 },
                { day: DAY, guildId: GUILD_B, metric: METRICS.interactions, value: 3 },
                { day: DAY, guildId: GUILD_A, metric: METRICS.activeUsers, value: 2 },
            ]),
        );
        expect(rows).toHaveLength(4);
    });

    it("ignore les champs inconnus, les valeurs nulles, négatives ou non numériques", async () => {
        const { redis } = fakeRedis({
            [redisKeys.dailyCounters(DAY, GUILD_A)]: {
                hash: {
                    [METRICS.messages]: "5",
                    [METRICS.membersJoined]: "0",
                    [METRICS.membersLeft]: "-2",
                    [METRICS.interactions]: "abc",
                    champ_inconnu: "10",
                },
            },
            [redisKeys.dailyActiveUsers(DAY, GUILD_A)]: { hll: new Set() },
        });
        const { prisma, rows } = fakePrisma();

        await flushDailyMetrics(redis, prisma);

        expect(rows).toEqual([{ day: DAY, guildId: GUILD_A, metric: METRICS.messages, value: 5 }]);
    });

    it("borne les valeurs à la taille d'une colonne INT", async () => {
        const { redis } = fakeRedis({
            [redisKeys.dailyCounters(DAY, GUILD_A)]: { hash: { [METRICS.xpGained]: "3000000000" } },
        });
        const { prisma, rows } = fakePrisma();

        await flushDailyMetrics(redis, prisma);

        expect(rows[0]?.value).toBe(2_147_483_647);
    });

    it("laisse de côté les clés mal formées ou du mauvais type, sans les faire expirer", async () => {
        const wrongType = redisKeys.dailyCounters(DAY, GUILD_B);
        const { redis, expirations } = fakeRedis({
            [redisKeys.dailyCounters(DAY, GUILD_A)]: { hash: { [METRICS.messages]: "1" } },
            [wrongType]: { string: "pas un hash" },
            "phenix:daily:2026-02-30:111111111111111111": { hash: { [METRICS.messages]: "1" } },
        });
        const { prisma, rows } = fakePrisma();

        const report = await flushDailyMetrics(redis, prisma);

        expect(report).toEqual({ keys: 1, rows: 1, ignoredKeys: 2 });
        expect(rows).toHaveLength(1);
        expect([...expirations.keys()]).toEqual([redisKeys.dailyCounters(DAY, GUILD_A)]);
    });

    it("fait expirer chaque clé selon son jour, après l'écriture en base", async () => {
        const key = redisKeys.dailyCounters(DAY, GUILD_A);
        const { redis, expirations } = fakeRedis({ [key]: { hash: { [METRICS.messages]: "1" } } });
        const { prisma } = fakePrisma();

        await flushDailyMetrics(redis, prisma);

        expect(expirations.get(key)).toBe(expiresAt(DAY));
    });

    it("n'écrit rien quand Redis est vide", async () => {
        const { redis } = fakeRedis({});
        const { prisma, $executeRaw } = fakePrisma();

        expect(await flushDailyMetrics(redis, prisma)).toEqual({ keys: 0, rows: 0, ignoredKeys: 0 });
        expect($executeRaw).not.toHaveBeenCalled();
    });
});

describe("expiresAt", () => {
    it("tombe à J+3 00:00 UTC", () => {
        expect(expiresAt("2026-10-10")).toBe(Date.parse("2026-10-13T00:00:00Z") / 1000);
    });
});
