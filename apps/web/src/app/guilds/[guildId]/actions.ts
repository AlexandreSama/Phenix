// apps/web/src/app/guilds/[guildId]/actions.ts
"use server";

import type { GuildConfigPatch, GuildConfigResponse, ValidationErrorResponse } from "@phenix/shared";
import { api, ApiError } from "@/lib/api";

export type SaveResult =
    | { ok: true; config: GuildConfigResponse }
    | { ok: false; message: string; errors: ValidationErrorResponse["errors"] };

const MESSAGES: Record<number, string> = {
    401: "Votre session a expiré : reconnectez-vous.",
    403: "Vous n'avez pas le droit de modifier ce serveur.",
    404: "Phenix n'est plus sur ce serveur.",
};

function isValidationError(body: unknown): body is ValidationErrorResponse {
    return typeof body === "object" && body !== null && Array.isArray((body as ValidationErrorResponse).errors);
}

/**
 * Point d'entrée public comme toute Server Action : il ne fait que relayer.
 * L'API vérifie la session, le rôle ADMIN et le contenu du patch.
 */
export async function saveGuildConfig(guildId: string, patch: GuildConfigPatch): Promise<SaveResult> {
    try {
        const config = await api<GuildConfigResponse>(`/guilds/${encodeURIComponent(guildId)}/config`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
        });
        return { ok: true, config };
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (isValidationError(error.body)) return { ok: false, message: error.body.message, errors: error.body.errors };
        const apiMessage = (error.body as { message?: unknown } | null)?.message;
        return {
            ok: false,
            message: MESSAGES[error.status] ?? (typeof apiMessage === "string" ? apiMessage : "Enregistrement impossible, réessayez."),
            errors: [],
        };
    }
}