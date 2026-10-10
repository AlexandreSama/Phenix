import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import {
    INSTANCE_ID,
    SAMPLE_EVERY_MS,
    createErrorRecorder,
    createProcessSampler,
    type ErrorContext,
} from "@phenix/shared/telemetry";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TelemetryService.name);
    private readonly sampler = createProcessSampler();
    private readonly record = createErrorRecorder("API", (data) => this.prisma.errorEvent.create({ data }));
    private timer?: NodeJS.Timeout;

    // Requêtes terminées depuis le dernier échantillon
    private durations: number[] = [];
    private serverErrors = 0;

    private readonly onUnhandledRejection = (reason: unknown) => {
        this.logger.error(`Promesse rejetée sans catch : ${String(reason)}`);
        void this.recordError(reason, { source: "unhandledRejection" });
    };

    constructor(private readonly prisma: PrismaService) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            this.writeSample().catch((error) => this.logger.error(`Échantillon non écrit : ${String(error)}`));
        }, SAMPLE_EVERY_MS);
        this.timer.unref();
        process.on("unhandledRejection", this.onUnhandledRejection);
    }

    onModuleDestroy() {
        clearInterval(this.timer);
        this.sampler.stop();
        process.off("unhandledRejection", this.onUnhandledRejection);
    }

    /** Appelé par RequestMetricsMiddleware à la fin de chaque réponse */
    recordRequest(durationMs: number, statusCode: number) {
        this.durations.push(durationMs);
        if (statusCode >= 500) this.serverErrors++;
    }

    /** Journalise une erreur dans ErrorEvent, sans jamais lever */
    recordError(error: unknown, context?: ErrorContext): Promise<void> {
        return this.record(error, context);
    }

    async writeSample() {
        const durations = this.durations;
        const errorCount = this.serverErrors;
        this.durations = [];
        this.serverErrors = 0;

        await this.prisma.serviceMetricSample.create({
            data: {
                service: "API",
                instanceId: INSTANCE_ID,
                ...this.sampler.sample(),
                requestCount: durations.length,
                errorCount,
                p95LatencyMs: percentile95(durations),
            },
        });
    }
}

function percentile95(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]!);
}