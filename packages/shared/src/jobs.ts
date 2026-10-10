/** Une seule file pour toutes les tâches différées. L'API y ajoute des jobs, le bot les exécute. */
export const SCHEDULED_QUEUE = "phenix-scheduled";

/**
 * Deuxième file, consommée par l'API : la maintenance n'a pas besoin de Discord,
 * et le bot ne doit pas recevoir de jobs qu'il ne sait pas traiter.
 */
export const MAINTENANCE_QUEUE = "phenix-maintenance";

export const JOBS = {
    giveawayEnd: "giveaway-end",
    banExpire: "ban-expire",
    muteExpire: "mute-expire",
    td2Reminder: "td2-reminder",
    /** Récurrent : planifié par le bot avec upsertJobScheduler, sous le même nom */
    flushMetrics: "flush-metrics",
} as const;

export const MAINTENANCE_JOBS = {
    /** Quotidien : planifié par l'API avec upsertJobScheduler, sous le même nom */
    purgeRetention: "purge-retention",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/** Données transportées par chaque type de job */
export type JobData = {
    "giveaway-end": { giveawayId: string };
    "ban-expire": { banId: string };
    "mute-expire": { muteId: string };
    "td2-reminder": { eventId: string };
    "flush-metrics": Record<string, never>;
};

/**
 * jobId déterministe : un seul job par cible et par type.
 * BullMQ interdit ":" dans un jobId, d'où le tiret.
 * Un add() avec un jobId déjà présent est ignoré : pour replanifier,
 * supprimer d'abord l'ancien job avec queue.remove(jobId).
 */
export function jobId(name: JobName, targetId: string): string {
    return `${name}-${targetId}`;
}

/** Jobs liés à une ligne de la base : tous sauf les récurrents */
export type TargetJobName = Exclude<JobName, typeof JOBS.flushMetrics>;

/** Le rappel d'un événement TD2 part 15 minutes avant son début */
export const TD2_REMINDER_BEFORE_MS = 15 * 60_000;

export function td2ReminderAt(startsAt: Date): Date {
    return new Date(startsAt.getTime() - TD2_REMINDER_BEFORE_MS);
}

/**
 * Options d'un job lié à une ligne de la base, les mêmes dans l'API et le bot.
 * Une échéance déjà passée donne un délai de 0 : le job part tout de suite.
 */
export function scheduledJobOptions(name: TargetJobName, targetId: string, runAt: Date, now = Date.now()) {
    return {
        jobId: jobId(name, targetId),
        delay: Math.max(0, runAt.getTime() - now),
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 }, // 10 s, 20 s, 40 s, 80 s
        removeOnComplete: true,
        // Pas de removeOnFail : un échec reste visible, et la réconciliation le relance au démarrage
    };
}