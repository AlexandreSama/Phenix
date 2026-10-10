// packages/shared/src/api-types.ts
/** Réponses de l'API lues par le panel : un seul endroit pour les deux côtés */

export type PanelRole = "ADMIN" | "MODERATOR" | "VIEWER";
import type { ChannelKind } from "./guild-config.js";

/** GET /me */
export interface MeResponse {
    id: string; // ID Discord
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
    platformRole: "USER" | "DEVELOPER";
}

/** Élément de GET /me/guilds */
export interface PanelGuild {
    id: string;
    name: string;
    iconUrl: string | null;
    role: PanelRole;
    /** false : l'utilisateur gère ce serveur mais Phenix n'y est pas encore */
    botPresent: boolean;
}

/** Réponse 400 : une erreur par champ, que le panel affiche sous le bon champ */
export interface ValidationErrorResponse {
    statusCode: 400;
    message: string;
    errors: { path: string; message: string }[];
}

/** GET /guilds/:guildId/discord : salons et rôles proposés dans les formulaires du panel */
export interface GuildDiscordResources {
    channels: { id: string; name: string; kind: ChannelKind; parentId: string | null }[];
    roles: { id: string; name: string; managed: boolean }[];
}