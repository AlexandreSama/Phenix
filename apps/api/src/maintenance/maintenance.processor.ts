import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { MAINTENANCE_JOBS, MAINTENANCE_QUEUE } from "@phenix/shared";
import { RetentionService } from "./retention.service.js";

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly logger = new Logger(MaintenanceProcessor.name);

    constructor(
        private readonly retention: RetentionService,
        @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    ) {
        super();
    }

    /** Rejoué à chaque démarrage de l'API : met à jour le planning sans le dupliquer */
    async onApplicationBootstrap() {
        await this.queue.upsertJobScheduler(
            MAINTENANCE_JOBS.purgeRetention,
            { pattern: "0 4 * * *", tz: "Europe/Paris" }, // tous les jours à 4 h, heure de Paris
            {
                name: MAINTENANCE_JOBS.purgeRetention,
                opts: {
                    attempts: 3,
                    backoff: { type: "exponential", delay: 60_000 }, // 1 min, puis 2 min
                    removeOnComplete: { count: 30 }, // les rapports du dernier mois restent lisibles
                    removeOnFail: { count: 30 },
                },
            },
        );
    }

    async process(job: Job) {
        switch (job.name) {
            case MAINTENANCE_JOBS.purgeRetention:
                return this.retention.purge();
            default:
                throw new Error(`Job inconnu : ${job.name}`);
        }
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(`Job ${job?.name ?? "?"} en échec (essai ${job?.attemptsMade ?? "?"}) : ${error.message}`);
    }

    /** Sans écouteur, une erreur de connexion émise par le Worker ferait planter le process */
    @OnWorkerEvent("error")
    onError(error: Error) {
        this.logger.error(`Worker BullMQ : ${error.message}`);
    }
}