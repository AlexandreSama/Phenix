import type { Queue } from "bullmq";
import type { PrismaClient } from "@phenix/database";
import {
    JOBS,
    jobId,
    scheduledJobOptions,
    td2ReminderAt,
    type JobData,
    type TargetJobName,
} from "@phenix/shared";

/** Un job que la base attend, d'après l'état de ses lignes */
type ExpectedJob = {
    [N in TargetJobName]: { name: N; targetId: string; data: JobData[N]; runAt: Date };
}[TargetJobName];

/** États où le job finira par s'exécuter : on n'y touche pas */
const PENDING_STATES = new Set(["delayed", "waiting", "prioritized", "waiting-children", "active"]);

export type ReconcileReport = {
    /** Jobs que la base attend */
    expected: number;
    /** Déjà planifiés, laissés tels quels */
    pending: number;
    /** Absents de Redis, ajoutés */
    added: number;
    /** Terminés ou en échec alors que la base attend encore l'action, recréés */
    replaced: number;
};

/**
 * La base est la source de vérité, Redis n'est qu'un agenda. Au démarrage, on recrée
 * chaque job que la base attend et que Redis n'a plus (Redis perdu, crash entre
 * l'écriture en base et l'ajout du job, job mort après ses 5 essais).
 * Rejouable : un job déjà planifié n'est jamais touché.
 */
export async function reconcileJobs(queue: Queue, prisma: PrismaClient, now = new Date()): Promise<ReconcileReport> {
    const expected = await findExpectedJobs(prisma, now);
    const report: ReconcileReport = { expected: expected.length, pending: 0, added: 0, replaced: 0 };

    for (const job of expected) {
        const existing = await queue.getJob(jobId(job.name, job.targetId));
        const state = existing ? await existing.getState() : "unknown";
        if (PENDING_STATES.has(state)) {
            report.pending++;
            continue;
        }
        if (existing && state !== "unknown") {
            await existing.remove(); // sinon le add() ci-dessous serait ignoré : même jobId
            report.replaced++;
        } else {
            report.added++;
        }
        await queue.add(job.name, job.data, scheduledJobOptions(job.name, job.targetId, job.runAt, now.getTime()));
    }
    return report;
}

async function findExpectedJobs(prisma: PrismaClient, now: Date): Promise<ExpectedJob[]> {
    const activeGuild = { leftAt: null }; // le bot ne peut plus agir sur un serveur quitté
    const timedAction = { endsAt: { not: null } }; // un ban ou un mute sans fin n'a pas de job

    const [giveaways, bans, mutes, events] = await Promise.all([
        prisma.giveaway.findMany({
            where: { status: "RUNNING", guild: activeGuild },
            select: { id: true, endsAt: true },
        }),
        prisma.guildBan.findMany({
            where: { liftedAt: null, action: timedAction, guild: activeGuild },
            select: { id: true, action: { select: { endsAt: true } } },
        }),
        prisma.guildMute.findMany({
            where: { liftedAt: null, action: timedAction, guild: activeGuild },
            select: { id: true, action: { select: { endsAt: true } } },
        }),
        prisma.td2Event.findMany({
            // Un rappel après le début ne sert plus à rien
            where: { status: "SCHEDULED", notifiedAt: null, startsAt: { gt: now }, guild: activeGuild },
            select: { id: true, startsAt: true },
        }),
    ]);

    return [
        ...giveaways.map((g): ExpectedJob => ({
            name: JOBS.giveawayEnd,
            targetId: g.id,
            data: { giveawayId: g.id },
            runAt: g.endsAt,
        })),
        ...bans.flatMap((b): ExpectedJob[] =>
            b.action?.endsAt ? [{ name: JOBS.banExpire, targetId: b.id, data: { banId: b.id }, runAt: b.action.endsAt }] : [],
        ),
        ...mutes.flatMap((m): ExpectedJob[] =>
            m.action?.endsAt ? [{ name: JOBS.muteExpire, targetId: m.id, data: { muteId: m.id }, runAt: m.action.endsAt }] : [],
        ),
        ...events.map((e): ExpectedJob => ({
            name: JOBS.td2Reminder,
            targetId: e.id,
            data: { eventId: e.id },
            runAt: td2ReminderAt(e.startsAt),
        })),
    ];
}