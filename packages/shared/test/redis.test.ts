import { describe, expect, it } from "vitest";
import { isUtcDay, parseDailyKey, redisKeys, utcDay } from "../src/redis.js";

describe("jours UTC", () => {
    it("formate la date du jour en UTC, pas en heure locale", () => {
        expect(utcDay(new Date("2026-10-09T23:30:00-02:00"))).toBe("2026-10-10");
    });

    it("refuse les jours qui n'existent pas", () => {
        expect(isUtcDay("2024-02-29")).toBe(true);
        expect(isUtcDay("2026-02-29")).toBe(false);
        expect(isUtcDay("2026-13-01")).toBe(false);
        expect(isUtcDay("pas-une-date")).toBe(false);
    });
});

describe("parseDailyKey", () => {
    const guildId = "123456789012345678";

    it("relit les clés écrites par redisKeys", () => {
        expect(parseDailyKey(redisKeys.dailyCounters("2026-10-09", guildId))).toEqual({
            kind: "counters",
            day: "2026-10-09",
            guildId,
        });
        expect(parseDailyKey(redisKeys.dailyActiveUsers("2026-10-09", guildId))?.kind).toBe("activeUsers");
    });

    it("ignore les clés mal formées", () => {
        expect(parseDailyKey(`phenix:daily:2026-02-30:${guildId}`)).toBeNull();
        expect(parseDailyKey("phenix:daily:2026-10-09:abc")).toBeNull();
        expect(parseDailyKey(`phenix:daily:2026-10-09:${guildId}:extra`)).toBeNull();
        expect(parseDailyKey(`autre:daily:2026-10-09:${guildId}`)).toBeNull();
    });
});