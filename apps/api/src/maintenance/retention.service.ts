import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@phenix/database";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "../storage/storage.service.js";

/** Durée de conservation de la télémétrie, en jours (voir l'en-tête de schema.prisma) */
const TELEMETRY_RETENTION = {
    InteractionEvent: { table: Prisma.sql`InteractionEvent`, days: 90 },
    ServiceMetricSample: { table: Prisma.sql`ServiceMetricSample`, days: 30 },
    ErrorEvent: { table: Prisma.sql`ErrorEvent`, days: 30 },
} as const;

type TelemetryTable = keyof typeof TELEMETRY_RETENTION;

/** Un fichier marqué supprimé reste récupérable 7 jours (remettre deletedAt à null) */
const FILE_GRACE_DAYS = 7;
/** Lignes par DELETE : assez petit pour ne pas verrouiller la table longtemps */
const ROW_BATCH = 5_000;
/** Fichiers traités par tour : la limite d'une requête DeleteObjects */
const FILE_BATCH = 1_000;
const DAY_MS = 86_400_000;

/** Dernière ligne non vide du message : pour Prisma, la cause sans le rappel de la requête */
function lastLine(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.split("\n").filter((line) => line.trim() !== "").at(-1) ?? message;
}

export type PurgeReport = {
    /** Lignes supprimées par table */
    rows: Record<TelemetryTable, number>;
    /** Objets S3 supprimés avec leur ligne StoredFile, et objets en échec (gardés pour la prochaine purge) */
    files: { deleted: number; failed: number };
};

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    /**
     * Chaque partie tourne même si une autre échoue. Tout est rejouable : relancer
     * la purge après un échec ne supprime rien de plus que ce qui était expiré.
     */
    async purge(): Promise<PurgeReport> {
        const errors: unknown[] = [];
        const report: PurgeReport = {
            rows: { InteractionEvent: 0, ServiceMetricSample: 0, ErrorEvent: 0 },
            files: { deleted: 0, failed: 0 },
        };

        for (const name of Object.keys(TELEMETRY_RETENTION) as TelemetryTable[]) {
            const { table, days } = TELEMETRY_RETENTION[name];
            try {
                report.rows[name] = await this.deleteOlderThan(table, days);
            } catch (error) {
                errors.push(error);
            }
        }
        try {
            report.files = await this.purgeDeletedFiles();
        } catch (error) {
            errors.push(error);
        }

        this.logger.log(`Purge : ${JSON.stringify(report)}`);
        if (errors.length > 0 || report.files.failed > 0) {
            for (const error of errors) this.logger.error(error instanceof Error ? error.stack : String(error));
            // Job en échec : visible dans BullMQ avec la cause, et retenté
            const causes = errors.map(lastLine);
            if (report.files.failed > 0) causes.push(`${report.files.failed} objet(s) S3 non supprimé(s)`);
            throw new AggregateError(errors, `Purge incomplète : ${causes.join(" | ")}\nRapport : ${JSON.stringify(report)}`);
        }
        return report;
    }

    /** DELETE … LIMIT en boucle : des transactions courtes plutôt qu'une seule énorme */
    private async deleteOlderThan(table: Prisma.Sql, days: number): Promise<number> {
        let total = 0;
        for (;;) {
            // Date limite calculée par MySQL, en UTC comme les dates écrites par Prisma
            const deleted = await this.prisma.$executeRaw`
        DELETE FROM ${table}
        WHERE createdAt < UTC_TIMESTAMP(3) - INTERVAL ${days} DAY
        LIMIT ${ROW_BATCH}`;
            total += deleted;
            if (deleted < ROW_BATCH) return total;
        }
    }

    /**
     * Objet S3 d'abord, ligne ensuite. Un crash entre les deux laisse une ligne dont
     * l'objet n'existe plus : la purge suivante la termine, car supprimer une clé
     * absente réussit. L'ordre inverse laisserait des objets que plus rien ne référence.
     */
    private async purgeDeletedFiles(): Promise<PurgeReport["files"]> {
        const deletedBefore = new Date(Date.now() - FILE_GRACE_DAYS * DAY_MS);
        const result = { deleted: 0, failed: 0 };
        let afterId: string | undefined;

        for (;;) {
            // Pagination par id : un fichier en échec n'est pas relu dans la même purge
            const files = await this.prisma.storedFile.findMany({
                where: { deletedAt: { lt: deletedBefore }, ...(afterId ? { id: { gt: afterId } } : {}) },
                select: { id: true, bucket: true, objectKey: true },
                orderBy: { id: "asc" },
                take: FILE_BATCH,
            });
            if (files.length === 0) return result;
            afterId = files[files.length - 1]!.id;

            const byBucket = new Map<string, typeof files>();
            for (const file of files) {
                const group = byBucket.get(file.bucket);
                if (group) group.push(file);
                else byBucket.set(file.bucket, [file]);
            }

            const removedIds: string[] = [];
            for (const [bucket, group] of byBucket) {
                try {
                    const failedKeys = await this.storage.deleteMany(bucket, group.map((file) => file.objectKey));
                    for (const file of group) {
                        if (failedKeys.has(file.objectKey)) result.failed++;
                        else removedIds.push(file.id);
                    }
                } catch (error) {
                    result.failed += group.length;
                    this.logger.error(`Suppression S3 impossible dans ${bucket}`, error instanceof Error ? error.stack : error);
                }
            }

            // Ticket.transcriptFileId passe à null tout seul (onDelete: SetNull)
            await this.prisma.storedFile.deleteMany({ where: { id: { in: removedIds } } });
            result.deleted += removedIds.length;
            if (files.length < FILE_BATCH) return result;
        }
    }
}