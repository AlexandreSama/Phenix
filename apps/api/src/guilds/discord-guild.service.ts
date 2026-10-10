// apps/api/src/guilds/discord-guild.service.ts
import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import { redisKeys, type ChannelKind, type GuildDiscordResources } from "@phenix/shared";
import { REDIS } from "../redis/redis.module.js";

const DISCORD_API = "https://discord.com/api/v10";
const CACHE_TTL_SECONDS = 60;

interface RawChannel {
    id: string;
    type: number;
    name?: string | null;
    parent_id?: string | null;
    position?: number;
}

interface RawRole {
    id: string;
    name: string;
    managed: boolean;
    position: number;
}

// Types de salons Discord : 0 textuel, 5 annonces, 4 catégorie, 2 vocal, 13 conférence
function kindOf(type: number): ChannelKind {
    if (type === 0 || type === 5) return "text";
    if (type === 4) return "category";
    if (type === 2 || type === 13) return "voice";
    return "other";
}

/** Salons et rôles d'un serveur, lus avec le token du bot */
@Injectable()
export class DiscordGuildService {
    private readonly botToken: string;

    constructor(
        config: ConfigService,
        @Inject(REDIS) private readonly redis: Redis,
    ) {
        this.botToken = config.getOrThrow<string>("DISCORD_TOKEN");
    }

    /** fresh : ignore le cache (vérification avant une modification) */
    async resources(guildId: string, { fresh = false } = {}): Promise<GuildDiscordResources> {
        const key = redisKeys.guildResources(guildId);
        if (!fresh) {
            const cached = await this.redis.get(key);
            if (cached) return JSON.parse(cached) as GuildDiscordResources;
        }

        const [channels, roles] = await Promise.all([
            this.get<RawChannel[]>(`/guilds/${guildId}/channels`),
            this.get<RawRole[]>(`/guilds/${guildId}/roles`),
        ]);
        const resources: GuildDiscordResources = {
            channels: channels
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((channel) => ({
                    id: channel.id,
                    name: channel.name ?? "",
                    kind: kindOf(channel.type),
                    parentId: channel.parent_id ?? null,
                })),
            roles: roles
                .filter((role) => role.id !== guildId) // @everyone porte l'ID du serveur
                .sort((a, b) => b.position - a.position)
                .map(({ id, name, managed }) => ({ id, name, managed })),
        };
        await this.redis.set(key, JSON.stringify(resources), "EX", CACHE_TTL_SECONDS);
        return resources;
    }

    private async get<T>(path: string): Promise<T> {
        const response = await fetch(`${DISCORD_API}${path}`, {
            headers: { Authorization: `Bot ${this.botToken}` },
        });
        if (!response.ok) throw new ServiceUnavailableException("Discord ne répond pas, réessayez dans un instant");
        return (await response.json()) as T;
    }
}