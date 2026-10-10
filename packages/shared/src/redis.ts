// packages/shared/src/redis.ts
const PREFIX = "phenix";

export const redisKeys = {
    /** SET … EX 60 NX : la clé existe tant que le membre est en cooldown XP */
    xpCooldown: (guildId: string, userId: string) => `${PREFIX}:xp-cd:${guildId}:${userId}`,
    /** Session du panel. La clé contient l'empreinte SHA-256 du cookie, jamais le cookie lui-même */
    session: (tokenHash: string) => `${PREFIX}:session:${tokenHash}`,
    /** state OAuth2 en attente du retour de Discord (10 min, usage unique) */
    loginState: (state: string) => `${PREFIX}:login-state:${state}`,
    /** Serveurs que l'utilisateur peut gérer d'après Discord (cache de 5 min) */
    managedGuilds: (discordUserId: string) => `${PREFIX}:managed-guilds:${discordUserId}`,
    /** Salons et rôles d'un serveur, pour les listes du panel (cache de 60 s) */
    guildResources: (guildId: string) => `${PREFIX}:guild-resources:${guildId}`,
    /** Hash des compteurs du jour (HINCRBY), reporté dans DailyMetric */
    dailyCounters: (day: string, guildId: string) => `${PREFIX}:daily:${day}:${guildId}`,
    /** HyperLogLog des membres actifs du jour (PFADD, PFCOUNT) */
    dailyActiveUsers: (day: string, guildId: string) => `${PREFIX}:dau:${day}:${guildId}`,
} as const;

export const REDIS_CHANNELS = {
    /** Message publié = guildId dont la config vient de changer */
    configInvalidated: `${PREFIX}:config-invalidated`,
} as const;

/** Jour UTC au format AAAA-MM-JJ (clés Redis et DailyMetric.date) */
export function utcDay(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

/** Vrai si `day` est un jour AAAA-MM-JJ qui existe (refuse 2026-02-30) */
export function isUtcDay(day: string): boolean {
    const date = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && utcDay(date) === day;
}

/** Motifs SCAN des clés journalières : compteurs (hash) et membres actifs (HyperLogLog) */
export const DAILY_KEY_PATTERNS = [`${PREFIX}:daily:*`, `${PREFIX}:dau:*`] as const;

export type DailyKey = {
    kind: "counters" | "activeUsers";
    day: string;
    guildId: string;
};

const DAILY_KEY = new RegExp(`^${PREFIX}:(daily|dau):(\\d{4}-\\d{2}-\\d{2}):(\\d{17,20})$`);

/** Décode une clé journalière. null si elle ne suit pas le format attendu. */
export function parseDailyKey(key: string): DailyKey | null {
    const match = DAILY_KEY.exec(key);
    if (!match) return null;
    const [, type, day, guildId] = match;
    if (!isUtcDay(day)) return null;
    return { kind: type === "daily" ? "counters" : "activeUsers", day, guildId };
}