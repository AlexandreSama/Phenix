// apps/api/src/auth/decorators.ts
import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { GuildPanelRole, PlatformRole } from "@phenix/database";

export const SESSION_COOKIE = "phenix_session";
export const STATE_COOKIE = "phenix_oauth_state";

/** Utilisateur connecté, attaché à la requête par SessionGuard */
export interface AuthContext {
    userId: string; // User.id
    discordId: string;
    platformRole: PlatformRole;
}

export type AuthedRequest = Request & { auth: AuthContext };

export const IS_PUBLIC_KEY = "phenix:public";
export const GUILD_ROLE_KEY = "phenix:guild-role";

/** Route accessible sans session (connexion, santé) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Rôle minimal exigé sur le serveur :guildId de la route */
export const RequireGuildRole = (role: GuildPanelRole) => SetMetadata(GUILD_ROLE_KEY, role);

/** Injecte l'utilisateur connecté dans un paramètre de contrôleur */
export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AuthedRequest>().auth,
);