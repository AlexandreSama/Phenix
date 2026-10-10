// src/guilds/guild-config.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import type { GuildConfig } from "@phenix/database";
import { REDIS_CHANNELS } from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";

/** Champs modifiables depuis le panel */
export type GuildConfigPatch = Partial<Omit<GuildConfig, "guildId" | "lastCaseId" | "lastTicketNumber">>;

@Injectable()
export class GuildConfigService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS) private readonly redis: Redis,
    ) {}

    async update(guildId: string, actorId: string | null, patch: GuildConfigPatch) {
        const config = await this.prisma.$transaction(async (tx) => {
            const before = await tx.guildConfig.findUnique({ where: { guildId } });
            const after = await tx.guildConfig.upsert({
                where: { guildId },
                create: { guildId, ...patch },
                update: patch,
            });
            // Journal du panel : { champ: [ancienne valeur, nouvelle valeur] }
            const changes = Object.fromEntries(
                Object.keys(patch).map((key) => {
                    const field = key as keyof GuildConfigPatch;
                    return [field, [before?.[field] ?? null, after[field]]];
                }),
            );
            await tx.panelAuditLog.create({
                data: {
                    guildId,
                    actorId,
                    action: before ? "UPDATE" : "CREATE",
                    entity: "GuildConfig",
                    entityId: guildId,
                    changes,
                },
            });
            return after;
        });

        // Après le commit seulement : le bot vide son cache pour ce serveur
        await this.redis.publish(REDIS_CHANNELS.configInvalidated, guildId);
        return config;
    }
}