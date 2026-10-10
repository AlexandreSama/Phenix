import { z } from "zod";

// Messages d'erreur de Zod en français, côté API comme côté panel
z.config(z.locales.fr());

export const SUPPORTED_LANGUAGES = ["fr", "en-US"] as const;

/** ID Discord : 17 à 20 chiffres */
export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "ID Discord invalide");

/** Un salon ou un rôle, ou null pour retirer le réglage */
const reference = snowflakeSchema.nullable().optional();

/**
 * Corps de PATCH /guilds/:guildId/config.
 * strictObject : tout champ absent de cette liste est refusé (guildId, lastCaseId…).
 */
export const guildConfigPatchSchema = z
    .strictObject({
        language: z.enum(SUPPORTED_LANGUAGES).nullable().optional(),

        welcomeChannelId: reference,
        goodbyeChannelId: reference,
        logsChannelId: reference,
        activityChannelId: reference,
        giveawayChannelId: reference,
        raidChannelId: reference,
        incursionChannelId: reference,
        raidVocalCategoryId: reference,
        ticketCategoryId: reference,
        ticketStaffRoleId: reference,

        enableWelcome: z.boolean().optional(),
        enableModeration: z.boolean().optional(),
        enableLevels: z.boolean().optional(),
        enableGiveaways: z.boolean().optional(),
        enableTd2: z.boolean().optional(),

        td2StrikeThreshold: z.int().min(1).max(10).optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, "Aucun champ à modifier");

export type GuildConfigPatch = z.infer<typeof guildConfigPatchSchema>;

export type ChannelKind = "text" | "category" | "voice" | "other";

/** Type de salon attendu par champ : l'API le vérifie, le panel s'en sert pour filtrer ses listes */
export const CONFIG_CHANNEL_FIELDS = {
    welcomeChannelId: "text",
    goodbyeChannelId: "text",
    logsChannelId: "text",
    activityChannelId: "text",
    giveawayChannelId: "text",
    raidChannelId: "text",
    incursionChannelId: "text",
    raidVocalCategoryId: "category",
    ticketCategoryId: "category",
} as const satisfies Partial<Record<keyof GuildConfigPatch, ChannelKind>>;

export const CONFIG_ROLE_FIELDS = ["ticketStaffRoleId"] as const satisfies readonly (keyof GuildConfigPatch)[];

/** Réponse de GET et PATCH /guilds/:guildId/config : tous les champs modifiables, plus guildId */
export type GuildConfigResponse = { guildId: string } & {
    [K in keyof GuildConfigPatch]-?: Exclude<GuildConfigPatch[K], undefined>;
};