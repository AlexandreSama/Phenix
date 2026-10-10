import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Client } from "discord.js";
import type { PrismaClient } from "@phenix/database";
import { JOBS, SCHEDULED_QUEUE, type JobData } from "@phenix/shared";

export function startScheduler(redisUrl: string, client: Client, prisma: PrismaClient) {
    // BullMQ exige maxRetriesPerRequest: null sur la connexion d'un Worker
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

    return new Worker(
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
}