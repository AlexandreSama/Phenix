import { describe, expect, it } from "vitest";
import { JOBS, TD2_REMINDER_BEFORE_MS, jobId, scheduledJobOptions, td2ReminderAt } from "../src/jobs.js";

describe("jobs BullMQ", () => {
    it("construit un jobId sans « : », interdit par BullMQ", () => {
        for (const name of Object.values(JOBS)) expect(jobId(name, "abc123")).not.toContain(":");
        expect(jobId(JOBS.giveawayEnd, "abc123")).toBe("giveaway-end-abc123");
    });

    it("donne les mêmes options à l'API et au bot, avec un délai jamais négatif", () => {
        const now = Date.parse("2026-10-10T12:00:00Z");
        const future = scheduledJobOptions(JOBS.banExpire, "b1", new Date(now + 60_000), now);
        expect(future).toEqual({
            jobId: "ban-expire-b1",
            delay: 60_000,
            attempts: 5,
            backoff: { type: "exponential", delay: 10_000 },
            removeOnComplete: true,
        });
        expect(scheduledJobOptions(JOBS.banExpire, "b1", new Date(now - 60_000), now).delay).toBe(0);
    });

    it("place le rappel TD2 avant le début de l'événement", () => {
        const startsAt = new Date("2026-10-10T20:00:00Z");
        expect(startsAt.getTime() - td2ReminderAt(startsAt).getTime()).toBe(TD2_REMINDER_BEFORE_MS);
    });
});