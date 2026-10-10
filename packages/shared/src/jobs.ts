/** Une seule file pour toutes les tâches différées. L'API y ajoute des jobs, le bot les exécute. */
export const SCHEDULED_QUEUE = "phenix-scheduled";

export const JOBS = {
    giveawayEnd: "giveaway-end",
    banExpire: "ban-expire",
    muteExpire: "mute-expire",
    td2Reminder: "td2-reminder",
    /** Récurrent : planifié par le bot avec upsertJobScheduler, sous le même nom */
    flushMetrics: "flush-metrics",
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