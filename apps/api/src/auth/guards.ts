// apps/api/src/auth/guards.ts
import {
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
    type CanActivate,
    type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { GuildPanelRole } from "@phenix/database";
import { PrismaService } from "../prisma/prisma.service.js";
import { GUILD_ROLE_KEY, IS_PUBLIC_KEY, SESSION_COOKIE, type AuthedRequest } from "./decorators.js";
import { GuildAccessService } from "./guild-access.service.js";
import { SessionService } from "./session.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Exige une session valide sur toutes les routes, sauf celles marquées @Public() */
@Injectable()
export class SessionGuard implements CanActivate {
    private readonly webOrigin: string;

    constructor(
        private readonly reflector: Reflector,
        private readonly sessions: SessionService,
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        this.webOrigin = config.getOrThrow<string>("WEB_ORIGIN");
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthedRequest>();

        // Défense contre le CSRF, en plus du cookie SameSite=Lax : une requête qui modifie doit venir du panel
        const origin = request.headers.origin;
        if (!SAFE_METHODS.has(request.method) && origin && origin !== this.webOrigin) {
            throw new ForbiddenException("Origine refusée");
        }

        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
        const session = token ? await this.sessions.get(token) : null;
        if (!token || !session) throw new UnauthorizedException();

        const user = await this.prisma.user.findUnique({
            where: { id: session.userId },
            select: { discordId: true, platformRole: true },
        });
        if (!user) {
            await this.sessions.destroy(token);
            throw new UnauthorizedException();
        }
        request.auth = { userId: session.userId, discordId: user.discordId, platformRole: user.platformRole };
        return true;
    }
}

const RANK: Record<GuildPanelRole, number> = { VIEWER: 1, MODERATOR: 2, ADMIN: 3 };

/** Vérifie le rôle sur le serveur :guildId quand la route porte @RequireGuildRole() */
@Injectable()
export class GuildAccessGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly access: GuildAccessService,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const required = this.reflector.getAllAndOverride<GuildPanelRole | undefined>(GUILD_ROLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required) return true;

        const request = context.switchToHttp().getRequest<AuthedRequest>();
        const guildId = request.params["guildId"]; // Express 5 type les paramètres en string | string[]
        if (typeof guildId !== "string") throw new ForbiddenException(); // route sans :guildId

        const guild = await this.prisma.guild.findUnique({ where: { id: guildId }, select: { leftAt: true } });
        if (!guild || guild.leftAt) throw new NotFoundException("Phenix n'est pas sur ce serveur");

        const role = await this.access.roleFor(request.auth, guildId);
        if (!role || RANK[role] < RANK[required]) throw new ForbiddenException();
        return true;
    }
}