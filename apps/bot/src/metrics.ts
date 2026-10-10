import type { Redis } from "ioredis";
import { Prisma, type PrismaClient } from "@phenix/database";
import {
    DAILY_KEY_PATTERNS,
    METRICS,
    parseDailyKey,
    redisKeys,
    utcDay,
    type DailyKey,
    type MetricName,
} from "@phenix/shared";

/** Fréquence du report Redis → DailyMetric */
export const METRICS_FLUSH_EVERY_MS = 5 * 60_000;

/** Les clés du jour J expirent à J+3 00:00 UTC : deux jours de marge pour un report en retard */
const KEY_TTL_DAYS = 3;
/** DailyMetric.value est un INT signé */
const INT_MAX = 2_147_483_647;
/** Clés lues par pipeline Redis, et lignes écrites par requête SQL */
const BATCH_SIZE = 500;

type CounterMetric = Exclude<MetricName, typeof METRICS.activeUsers>;

const COUNTER_METRICS: ReadonlySet<string> = new Set<CounterMetric>([
    METRICS.interactions,
    METRICS.messages,
    METRICS.xpGained,
    METRICS.membersJoined,
    METRICS.membersLeft,
]);

// ---------------------------------------------------------------------
//  Côté événements : le bot compte dans Redis, sans attendre la réponse
// ---------------------------------------------------------------------

function logRedisError(error: unknown) {
    console.warn("Compteur Redis non mis à jour :", error);
}

/** Ajoute `by` à un compteur du jour. Une stat perdue ne doit jamais casser une action du bot. */
export function countDaily(redis: Redis, guildId: string, metric: CounterMetric, by = 1): void {
    redis.hincrby(redisKeys.dailyCounters(utcDay(), guildId), metric, by).catch(logRedisError);
}

/** Note un membre actif aujourd'hui. Le HyperLogLog ne garde aucun ID et pèse 12 Ko au plus. */
export function markActive(redis: Redis, guildId: string, userId: string): void {
    redis.pfadd(redisKeys.dailyActiveUsers(utcDay(), guildId), userId).catch(logRedisError);
}

// ---------------------------------------------------------------------
//  Report : recopie les valeurs Redis dans DailyMetric
// ---------------------------------------------------------------------

type MetricRow = { day: string; guildId: string; metric: MetricName; value: number };

export type FlushReport = {
    /** Clés journalières lues */
    keys: number;
    /** Lignes envoyées à la base (une par serveur, jour et métrique) */
    rows: number;
    /** Clés au mauvais format ou au mauvais type Redis, laissées telles quelles */
    ignoredKeys: number;
};

/**
 * Écrit dans DailyMetric la valeur absolue de chaque compteur Redis, jamais un incrément.
 * - Rejouer le report (job relancé, deux instances en même temps) ne change rien.
 * - GREATEST côté SQL : si Redis perd des données, la base ne recule pas.
 * - Chaque clé reçoit son expiration après l'écriture en base. Elle dépend du jour
 *   de la clé, donc la rejouer ne la repousse pas.
 */
export async function flushDailyMetrics(redis: Redis, prisma: PrismaClient): Promise<FlushReport> {
    const { keys, ignored } = await scanDailyKeys(redis);
    const report: FlushReport = { keys: 0, rows: 0, ignoredKeys: ignored.size };

    for (const batch of chunk(keys, BATCH_SIZE)) {
        const { rows, readable, wrongType } = await readValues(redis, batch);
        for (const part of chunk(rows, BATCH_SIZE)) await writeRows(prisma, part);
        await expireKeys(redis, readable);
        report.keys += readable.length;
        report.rows += rows.length;
        report.ignoredKeys += wrongType;
    }
    return report;
}

async function scanDailyKeys(redis: Redis) {
    const keys = new Map<string, DailyKey>(); // SCAN peut renvoyer une clé plusieurs fois
    const ignored = new Set<string>();
    for (const match of DAILY_KEY_PATTERNS) {
        for await (const found of redis.scanStream({ match, count: 1000 })) {
            for (const key of found as string[]) {
                const parsed = parseDailyKey(key);
                if (parsed) keys.set(key, parsed);
                else ignored.add(key);
            }
        }
    }
    return { keys: [...keys], ignored };
}

async function readValues(redis: Redis, batch: [string, DailyKey][]) {
    const pipeline = redis.pipeline();
    for (const [key, { kind }] of batch) {
        if (kind === "counters") pipeline.hgetall(key);
        else pipeline.pfcount(key);
    }
    const replies = (await pipeline.exec()) ?? [];

    const rows: MetricRow[] = [];
    const readable: [string, DailyKey][] = [];
    let wrongType = 0;

    batch.forEach((entry, index) => {
        const [, { kind, day, guildId }] = entry;
        const result = replies[index];
        if (!result || result[0]) {
            wrongType++; // ex : WRONGTYPE si quelqu'un a écrit une chaîne sous ce nom
            return;
        }
        const reply = result[1];
        readable.push(entry);

        if (kind === "activeUsers") {
            const value = toCount(reply);
            if (value > 0) rows.push({ day, guildId, metric: METRICS.activeUsers, value });
            return;
        }
        for (const [field, raw] of Object.entries(reply as Record<string, string>)) {
            if (!COUNTER_METRICS.has(field)) continue; // champ inconnu : ignoré
            const value = toCount(raw);
            if (value > 0) rows.push({ day, guildId, metric: field as CounterMetric, value });
        }
    });

    return { rows, readable, wrongType };
}

/** Entier positif borné à la colonne INT. 0 pour tout le reste (négatif, texte...) */
function toCount(raw: unknown): number {
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) return 0;
    return Math.min(value, INT_MAX);
}

async function writeRows(prisma: PrismaClient, rows: MetricRow[]) {
    if (rows.length === 0) return;
    const values = Prisma.join(
        rows.map((row) => Prisma.sql`(${row.day}, ${row.guildId}, ${row.metric}, ${row.value}, UTC_TIMESTAMP(3))`),
    );
    // Alias de ligne (AS incoming) : syntaxe MySQL 8.0.19+, qui remplace VALUES(col), déprécié.
    // updatedAt passe avant value : MySQL applique les affectations de gauche à droite,
    // et la comparaison doit encore voir l'ancienne valeur.
    await prisma.$executeRaw`
    INSERT INTO DailyMetric (date, guildId, metric, value, updatedAt)
    VALUES ${values} AS incoming
    ON DUPLICATE KEY UPDATE
      updatedAt = IF(incoming.value > DailyMetric.value, incoming.updatedAt, DailyMetric.updatedAt),
      value = GREATEST(DailyMetric.value, incoming.value)`;
}

async function expireKeys(redis: Redis, keys: [string, DailyKey][]) {
    if (keys.length === 0) return;
    const pipeline = redis.pipeline();
    for (const [key, { day }] of keys) pipeline.expireat(key, expiresAt(day));
    await pipeline.exec();
}

/** Timestamp Unix (secondes) d'expiration des clés du jour `day`. Déjà passé : Redis supprime la clé. */
export function expiresAt(day: string): number {
    return Date.parse(`${day}T00:00:00Z`) / 1000 + KEY_TTL_DAYS * 86_400;
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    return chunks;
}