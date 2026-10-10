// Helpers Node pour la télémétrie du bot et de l'API.
// Export séparé (@phenix/shared/telemetry) : le panel importe @phenix/shared côté navigateur,
// où node:perf_hooks n'existe pas.
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";

/** Nom du conteneur en Docker, nom de la machine en local */
export const INSTANCE_ID = hostname().slice(0, 64);

/** Intervalle entre deux ServiceMetricSample */
export const SAMPLE_EVERY_MS = 60_000;

const LAG_RESOLUTION_MS = 20;
const MB = 1024 * 1024;

export type ProcessSample = {
    uptimeSec: number;
    rssMb: number;
    heapUsedMb: number;
    /** CPU du process depuis l'échantillon précédent (peut dépasser 100 avec plusieurs threads) */
    cpuPercent: number;
    /** Plus long blocage de la boucle d'événements depuis l'échantillon précédent */
    eventLoopLagMs: number;
};

/** Mesure le process entre deux appels à sample() */
export function createProcessSampler() {
    const lag = monitorEventLoopDelay({ resolution: LAG_RESOLUTION_MS });
    lag.enable();
    let lastCpu = process.cpuUsage();
    let lastAt = process.hrtime.bigint();

    return {
        sample(): ProcessSample {
            const now = process.hrtime.bigint();
            const cpu = process.cpuUsage(lastCpu); // microsecondes depuis lastCpu
            const elapsedUs = Number(now - lastAt) / 1000;
            const memory = process.memoryUsage();
            // L'histogramme mesure l'intervalle réel du timer : au repos il vaut la résolution
            const worstLagMs = Math.max(0, lag.max / 1e6 - LAG_RESOLUTION_MS);

            lastCpu = process.cpuUsage();
            lastAt = now;
            lag.reset();

            return {
                uptimeSec: Math.round(process.uptime()),
                rssMb: Math.round(memory.rss / MB),
                heapUsedMb: Math.round(memory.heapUsed / MB),
                cpuPercent: round1(elapsedUs > 0 ? ((cpu.user + cpu.system) / elapsedUs) * 100 : 0),
                eventLoopLagMs: round1(worstLagMs),
            };
        },
        stop() {
            lag.disable();
        },
    };
}

function round1(value: number) {
    return Math.round(value * 10) / 10;
}

export type DescribedError = {
    name: string;
    message: string;
    stack: string | null;
    /** Même erreur au même endroit = même empreinte, quels que soient les IDs du message */
    fingerprint: string;
};

/** Prépare une erreur pour ErrorEvent, en respectant la taille des colonnes */
export function describeError(error: unknown): DescribedError {
    const isError = error instanceof Error;
    // discord.js nomme déjà ses erreurs avec le code : "DiscordAPIError[50013]"
    const name = (isError ? error.name : "NonError").slice(0, 128);
    const message = (isError ? error.message : safeString(error)).slice(0, 10_000);
    const stack = isError && error.stack ? error.stack.slice(0, 20_000) : null;

    const normalizedMessage = message
        .replace(/\b\d{17,20}\b/g, "<snowflake>")
        .replace(/\b[0-9a-f]{8,}\b/gi, "<hex>")
        .replace(/\d+/g, "<n>");
    // Première ligne "at …" sans numéros de ligne : un redéploiement ne change pas l'empreinte
    const firstFrame = stack?.split("\n").find((line) => line.trimStart().startsWith("at "))?.trim().replace(/:\d+:\d+\)?$/, "") ?? "";
    const fingerprint = createHash("sha256").update(`${name}\n${normalizedMessage}\n${firstFrame}`).digest("hex");

    return { name, message, stack, fingerprint };
}

function safeString(value: unknown): string {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

/**
 * Limite les écritures d'une même erreur : une boucle qui plante 1 000 fois par
 * seconde ne doit pas remplir ErrorEvent. Au-delà de `perMinute` occurrences d'une
 * empreinte dans la minute, les suivantes sont ignorées jusqu'à la minute suivante.
 */
export function createErrorThrottle(perMinute = 10) {
    const windows = new Map<string, { startedAt: number; count: number }>();

    return {
        /** Vrai s'il faut écrire cette occurrence */
        allow(fingerprint: string, now = Date.now()): boolean {
            const window = windows.get(fingerprint);
            if (!window || now - window.startedAt >= 60_000) {
                if (windows.size > 1_000) windows.clear(); // borne mémoire, au pire on réécrit un peu
                windows.set(fingerprint, { startedAt: now, count: 1 });
                return true;
            }
            window.count++;
            return window.count <= perMinute;
        },
    };
}

/** Contexte libre d'une erreur : valeurs simples seulement, pour rester du JSON propre */
export type ErrorContext = { guildId?: string | null } & Record<string, string | number | boolean | null | undefined>;

export type ErrorEventInput = DescribedError & {
    service: "BOT" | "API" | "WEB";
    instanceId: string;
    guildId: string | null;
    context: Record<string, string | number | boolean | null> | undefined;
};

/**
 * Renvoie une fonction qui journalise une erreur sans jamais lever : la télémétrie
 * ne doit pas aggraver une panne. `write` fait l'insertion (Prisma, côté appelant).
 */
export function createErrorRecorder(
    service: ErrorEventInput["service"],
    write: (event: ErrorEventInput) => Promise<unknown>,
) {
    const throttle = createErrorThrottle();

    return async function recordError(error: unknown, context: ErrorContext = {}): Promise<void> {
        const described = describeError(error);
        if (!throttle.allow(described.fingerprint)) return;

        const { guildId, ...rest } = context;
        const extra = Object.fromEntries(Object.entries(rest).filter((entry) => entry[1] !== undefined)) as Record<
            string,
            string | number | boolean | null
        >;
        try {
            await write({
                service,
                instanceId: INSTANCE_ID,
                ...described,
                guildId: guildId && /^\d{17,20}$/.test(guildId) ? guildId : null, // colonne VarChar(20)
                context: Object.keys(extra).length > 0 ? extra : undefined,
            });
        } catch (writeError) {
            console.error("ErrorEvent non écrit :", writeError);
        }
    };
}

export type RecordError = ReturnType<typeof createErrorRecorder>;