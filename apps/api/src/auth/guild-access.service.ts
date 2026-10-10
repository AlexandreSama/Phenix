// apps/api/src/auth/guild-access.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import type { GuildPanelRole } from "@phenix/database";
import { redisKeys, type PanelGuild } from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { AuthService } from "./auth.service.js";
import type { AuthContext } from "./decorators.js";
import { DiscordService } from "./discord.service.js";

const MANAGED_GUILDS_TTL_SECONDS = 5 * 60;

interface ManagedGuild {
    id: string;
    name: string;
    icon: string | null;
}

function iconUrl(guildId: string, hash: string | null): string | null {
    return hash ? `https://cdn.discordapp.com/icons/${guildId}/${hash}.png?size=64` : null;
}

@Injectable()
export class GuildAccessService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auth: AuthService,
        private readonly discord: DiscordService,
        @Inject(REDIS) private readonly redis: Redis,
    ) {}

    /** Serveurs que l'utilisateur gère sur Discord, gardés 5 min en cache */
    async managedGuilds(auth: AuthContext): Promise<ManagedGuild[]> {
        const key = redisKeys.managedGuilds(auth.discordId);
        const cached = await this.redis.get(key);
        if (cached) return JSON.parse(cached) as ManagedGuild[];

        const accessToken = await this.auth.getDiscordAccessToken(auth.userId);
        const guilds = (await this.discord.getGuilds(accessToken))
            .filter((guild) => DiscordService.canManage(guild))
            .map(({ id, name, icon }) => ({ id, name, icon }));
        await this.redis.set(key, JSON.stringify(guilds), "EX", MANAGED_GUILDS_TTL_SECONDS);
        return guilds;
    }

    /**
     * Rôle de l'utilisateur sur un serveur, du plus fort au plus faible :
     * développeur Phenix, gestionnaire du serveur sur Discord, puis accès donné dans le panel.
     */
    async roleFor(auth: AuthContext, guildId: string): Promise<GuildPanelRole | null> {
        if (auth.platformRole === "DEVELOPER") return "ADMIN";
        const managed = await this.managedGuilds(auth);
        if (managed.some((guild) => guild.id === guildId)) return "ADMIN";

        const access = await this.prisma.guildPanelAccess.findUnique({
            where: { guildId_userId: { guildId, userId: auth.discordId } },
            select: { role: true, revokedAt: true },
        });
        return access && !access.revokedAt ? access.role : null;
    }

    /** Liste affichée par le panel après la connexion */
    async listForUser(auth: AuthContext): Promise<PanelGuild[]> {
        const managed = await this.managedGuilds(auth);
        const grants = await this.prisma.guildPanelAccess.findMany({
            where: { userId: auth.discordId, revokedAt: null },
            select: { guildId: true, role: true },
        });
        const ids = [...new Set([...managed.map((guild) => guild.id), ...grants.map((grant) => grant.guildId)])];
        const withBot = new Map(
            (
                await this.prisma.guild.findMany({
                    where: { id: { in: ids }, leftAt: null },
                    select: { id: true, name: true, iconHash: true },
                })
            ).map((guild) => [guild.id, guild]),
        );

        const result: PanelGuild[] = managed.map((guild) => ({
            id: guild.id,
            name: guild.name,
            iconUrl: iconUrl(guild.id, guild.icon),
            role: "ADMIN",
            botPresent: withBot.has(guild.id),
        }));
        for (const grant of grants) {
            const guild = withBot.get(grant.guildId);
            if (!guild || result.some((entry) => entry.id === grant.guildId)) continue;
            result.push({
                id: guild.id,
                name: guild.name ?? guild.id,
                iconUrl: iconUrl(guild.id, guild.iconHash),
                role: grant.role,
                botPresent: true,
            });
        }
        // Serveurs où Phenix est présent d'abord, puis ordre alphabétique
        return result.sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));
    }
}