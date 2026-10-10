// packages/shared/src/api-types.ts
/** Réponses de l'API lues par le panel : un seul endroit pour les deux côtés */

export type PanelRole = "ADMIN" | "MODERATOR" | "VIEWER";

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