import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Client } from "discord.js";
import type { PrismaClient } from "@phenix/database";
import { JOBS, SCHEDULED_QUEUE, type JobData } from "@phenix/shared";
import { type RecordError} from "@phenix/shared/telemetry";
import { METRICS_FLUSH_EVERY_MS, flushDailyMetrics } from "./metrics.js";
import { reconcileJobs } from "./reconcile.js";

type SchedulerDeps = {
    redisUrl: string;
    /** Connexion Redis du bot, pour lire les compteurs */
    redis: Redis;
    client: Client;
    prisma: PrismaClient;
    recordError: RecordError;
};

export type Scheduler = { close(): Promise<void> };

export async function startScheduler({ redisUrl, redis, client, prisma, recordError }: SchedulerDeps): Promise<Scheduler> {
    // BullMQ exige maxRetriesPerRequest: null sur la connexion d'un Worker
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue(SCHEDULED_QUEUE, { connection });

    // Upsert : rejoué à chaque démarrage, il met à jour le planning au lieu d'en ajouter un.
    // Le premier report part tout de suite, puis toutes les 5 minutes.
    await queue.upsertJobScheduler(
        JOBS.flushMetrics,
        { every: METRICS_FLUSH_EVERY_MS },
        {
            name: JOBS.flushMetrics,
            // Sans ça, Redis garderait les 288 jobs terminés de chaque journée
            opts: { removeOnComplete: true, removeOnFail: 50 },
        },
    );

    const worker = new Worker(
        SCHEDULED_QUEUE,
        async (job: Job) => {
            switch (job.name) {
                case JOBS.banExpire: {
                    const { banId } = job.data as JobData["ban-expire"];
                    const ban = await prisma.guildBan.findUnique({ where: { id: banId } });
                    if (!ban || ban.liftedAt) return; // déjà levé à la main entre-temps
                    const guild = await client.guilds.fetch(ban.guildId);
                    await guild.bans.remove(ban.userId, "Fin du ban temporaire");
                    await prisma.guildBan.update({ where: { id: banId }, data: { liftedAt: new Date() } });
                    return;
                }
                case JOBS.flushMetrics:
                    return flushDailyMetrics(redis, prisma);
                case JOBS.giveawayEnd:
                case JOBS.muteExpire:
                case JOBS.td2Reminder:
                    // Même principe : relire la base, vérifier l'état, puis agir sur Discord
                    return;
                default:
                    throw new Error(`Job inconnu : ${job.name}`);
            }
        },
        { connection, concurrency: 5 },
    );

    worker.on("failed", (job, error) => {
        console.error(`Job ${job?.name ?? "?"} en échec :`, error);
        void recordError(error, { job: job?.name ?? null, jobId: job?.id ?? null, attempt: job?.attemptsMade ?? null });
    });
    // Sans écouteur, une erreur de connexion émise par le Worker ferait planter le process
    worker.on("error", (error) => {
        console.error("Worker BullMQ :", error);
        void recordError(error, { source: "bullmq" });
    });

    // Après le Worker : un échec ici ne doit pas empêcher les jobs déjà planifiés de tourner
    try {
        console.log("Réconciliation des jobs :", await reconcileJobs(queue, prisma));
    } catch (error) {
        console.error("Réconciliation impossible :", error);
    }

    return {
        async close() {
            await worker.close();
            await queue.close();
            connection.disconnect(); // connexion partagée : BullMQ ne la ferme pas lui-même
        },
    };
}