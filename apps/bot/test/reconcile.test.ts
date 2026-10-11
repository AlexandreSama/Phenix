import { describe, expect, it, vi } from "vitest";
import type { Queue } from "bullmq";
import type { PrismaClient } from "@phenix/database";
import { JOBS, jobId, td2ReminderAt } from "@phenix/shared";
import { reconcileJobs } from "../src/reconcile.js";

const NOW = new Date("2026-10-10T12:00:00Z");
const LATER = new Date("2026-10-11T12:00:00Z");

type Rows = { giveaways?: unknown[]; bans?: unknown[]; mutes?: unknown[]; events?: unknown[] };

function fakePrisma({ giveaways = [], bans = [], mutes = [], events = [] }: Rows) {
    const findMany = (rows: unknown[]) => ({ findMany: vi.fn().mockResolvedValue(rows) });
    return {
        giveaway: findMany(giveaways),
        guildBan: findMany(bans),
        guildMute: findMany(mutes),
        td2Event: findMany(events),
    } as unknown as PrismaClient;
}

/** File BullMQ dont chaque job existant est décrit par son état */
function fakeQueue(states: Record<string, string> = {}) {
    const removed: string[] = [];
    const queue = {
        getJob: vi.fn(async (id: string) =>
            id in states ? { getState: async () => states[id], remove: async () => removed.push(id) } : undefined,
        ),
        add: vi.fn(),
    };
    return { queue: queue as unknown as Queue, add: queue.add, removed };
}

describe("reconcileJobs", () => {
    it("ajoute les jobs que Redis n'a pas", async () => {
        const prisma = fakePrisma({ giveaways: [{ id: "g1", endsAt: LATER }] });
        const { queue, add } = fakeQueue();

        const report = await reconcileJobs(queue, prisma, NOW);

        expect(report).toEqual({ expected: 1, pending: 0, added: 1, replaced: 0 });
        expect(add).toHaveBeenCalledWith(
            JOBS.giveawayEnd,
            { giveawayId: "g1" },
            expect.objectContaining({ jobId: jobId(JOBS.giveawayEnd, "g1"), delay: LATER.getTime() - NOW.getTime() }),
        );
    });

    it("ne touche pas aux jobs encore planifiés", async () => {
        const prisma = fakePrisma({ giveaways: [{ id: "g1", endsAt: LATER }] });
        const { queue, add, removed } = fakeQueue({ [jobId(JOBS.giveawayEnd, "g1")]: "delayed" });

        const report = await reconcileJobs(queue, prisma, NOW);

        expect(report).toEqual({ expected: 1, pending: 1, added: 0, replaced: 0 });
        expect(add).not.toHaveBeenCalled();
        expect(removed).toEqual([]);
    });

    it("recrée un job terminé ou en échec alors que la base attend encore l'action", async () => {
        const prisma = fakePrisma({
            bans: [{ id: "b1", action: { endsAt: LATER } }],
            mutes: [{ id: "m1", action: { endsAt: LATER } }],
        });
        const { queue, add, removed } = fakeQueue({
            [jobId(JOBS.banExpire, "b1")]: "failed",
            [jobId(JOBS.muteExpire, "m1")]: "completed",
        });

        const report = await reconcileJobs(queue, prisma, NOW);

        expect(report).toEqual({ expected: 2, pending: 0, added: 0, replaced: 2 });
        expect(removed).toEqual([jobId(JOBS.banExpire, "b1"), jobId(JOBS.muteExpire, "m1")]);
        expect(add).toHaveBeenCalledTimes(2);
    });

    it("ignore les sanctions sans date de fin", async () => {
        const prisma = fakePrisma({ bans: [{ id: "b1", action: null }, { id: "b2", action: { endsAt: null } }] });
        const { queue, add } = fakeQueue();

        expect(await reconcileJobs(queue, prisma, NOW)).toEqual({ expected: 0, pending: 0, added: 0, replaced: 0 });
        expect(add).not.toHaveBeenCalled();
    });

    it("planifie le rappel TD2 avant le début de l'événement", async () => {
        const startsAt = new Date("2026-10-12T20:00:00Z");
        const prisma = fakePrisma({ events: [{ id: "e1", startsAt }] });
        const { queue, add } = fakeQueue();

        await reconcileJobs(queue, prisma, NOW);

        expect(add).toHaveBeenCalledWith(
            JOBS.td2Reminder,
            { eventId: "e1" },
            expect.objectContaining({ delay: td2ReminderAt(startsAt).getTime() - NOW.getTime() }),
        );
    });

    it("ne cherche que les lignes des serveurs encore actifs", async () => {
        const prisma = fakePrisma({});
        const { queue } = fakeQueue();

        await reconcileJobs(queue, prisma, NOW);

        for (const model of [prisma.giveaway, prisma.guildBan, prisma.guildMute, prisma.td2Event]) {
            expect(vi.mocked(model.findMany).mock.calls[0]?.[0]?.where).toMatchObject({ guild: { leftAt: null } });
        }
    });
});
