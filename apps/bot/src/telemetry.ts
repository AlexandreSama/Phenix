import type { Client } from "discord.js";
import type { PrismaClient } from "@phenix/database";
import { INSTANCE_ID, SAMPLE_EVERY_MS, createProcessSampler, type RecordError } from "@phenix/shared/telemetry";

/** Écrit un ServiceMetricSample par minute tant que le bot tourne */
export function startSampling(prisma: PrismaClient, client: Client, everyMs = SAMPLE_EVERY_MS) {
    const sampler = createProcessSampler();

    const writeSample = async () => {
        const ping = client.ws.ping; // -1 avant le premier heartbeat
        await prisma.serviceMetricSample.create({
            data: {
                service: "BOT",
                instanceId: INSTANCE_ID,
                ...sampler.sample(),
                wsPingMs: Number.isFinite(ping) && ping >= 0 ? Math.round(ping) : null,
                guildCount: client.guilds.cache.size,
            },
        });
    };

    const timer = setInterval(() => {
        writeSample().catch((error) => console.error("Échantillon non écrit :", error));
    }, everyMs);
    timer.unref(); // n'empêche pas le process de s'arrêter

    return {
        writeSample,
        stop() {
            clearInterval(timer);
            sampler.stop();
        },
    };
}

/** Filets de sécurité du process : toute erreur échappée finit dans ErrorEvent */
export function installProcessHandlers(recordError: RecordError) {
    process.on("unhandledRejection", (reason) => {
        // Sans ce handler, Node arrête le process : une requête Prisma ratée dans un
        // handler d'événement suffirait à couper le bot
        console.error("Promesse rejetée sans catch :", reason);
        void recordError(reason, { source: "unhandledRejection" });
    });

    process.on("uncaughtException", (error) => {
        // L'état du process est incertain : on journalise, puis on sort pour que Docker redémarre le bot
        console.error("Exception non rattrapée :", error);
        const timeout = new Promise((resolve) => setTimeout(resolve, 2_000));
        void Promise.race([recordError(error, { source: "uncaughtException" }), timeout]).finally(() => process.exit(1));
    });
}