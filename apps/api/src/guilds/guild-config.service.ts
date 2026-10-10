// apps/api/src/guilds/guild-config.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import type { GuildConfig } from "@phenix/database";
import {
    CONFIG_CHANNEL_FIELDS,
    CONFIG_ROLE_FIELDS,
    REDIS_CHANNELS,
    type ChannelKind,
    type GuildConfigPatch,
} from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { validationError, type FieldError } from "../validation.js";
import { DiscordGuildService } from "./discord-guild.service.js";

// Compteurs internes, jamais renvoyés au panel
const HIDDEN = { lastCaseId: true, lastTicketNumber: true } as const;
export type VisibleGuildConfig = Omit<GuildConfig, keyof typeof HIDDEN>;

@Injectable()
export class GuildConfigService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly discord: DiscordGuildService,
        @Inject(REDIS) private readonly redis: Redis,
    ) {}

    /** Config du serveur, créée avec les valeurs par défaut à la première lecture */
    get(guildId: string): Promise<VisibleGuildConfig> {
        return this.prisma.guildConfig.upsert({ where: { guildId }, create: { guildId }, update: {}, omit: HIDDEN });
    }

    /** patch a déjà passé guildConfigPatchSchema : seuls les champs autorisés arrivent ici */
    async update(guildId: string, actorId: string | null, patch: GuildConfigPatch): Promise<VisibleGuildConfig> {
        await this.checkReferences(guildId, patch);

        const config = await this.prisma.$transaction(async (tx) => {
            const before = await tx.guildConfig.findUnique({ where: { guildId } });
            const after = await tx.guildConfig.upsert({
                where: { guildId },
                create: { guildId, ...patch },
                update: patch,
                omit: HIDDEN,
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

    /** Les salons et rôles choisis doivent exister sur CE serveur, avec le bon type */
    private async checkReferences(guildId: string, patch: GuildConfigPatch) {
        const channelFields = (Object.entries(CONFIG_CHANNEL_FIELDS) as [keyof typeof CONFIG_CHANNEL_FIELDS, ChannelKind][])
            .filter(([field]) => patch[field]);
        const roleFields = CONFIG_ROLE_FIELDS.filter((field) => patch[field]);
        if (channelFields.length === 0 && roleFields.length === 0) return;

        const { channels, roles } = await this.discord.resources(guildId, { fresh: true });
        const errors: FieldError[] = [];
        for (const [field, expected] of channelFields) {
            const channel = channels.find((candidate) => candidate.id === patch[field]);
            if (!channel) {
                errors.push({ path: field, message: "Ce salon n'existe pas sur ce serveur, ou Phenix ne peut pas le voir" });
            } else if (channel.kind !== expected) {
                errors.push({ path: field, message: expected === "text" ? "Choisissez un salon textuel" : "Choisissez une catégorie" });
            }
        }
        for (const field of roleFields) {
            if (!roles.some((role) => role.id === patch[field])) {
                errors.push({ path: field, message: "Ce rôle n'existe pas sur ce serveur" });
            }
        }
        if (errors.length > 0) throw validationError(errors);
    }
}