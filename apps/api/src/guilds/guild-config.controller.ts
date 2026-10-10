// apps/api/src/guilds/guild-config.controller.ts
import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { guildConfigPatchSchema, type GuildConfigPatch } from "@phenix/shared";
import { CurrentUser, RequireGuildRole, type AuthContext } from "../auth/decorators.js";
import { DiscordGuildService } from "./discord-guild.service.js";
import { GuildConfigService } from "./guild-config.service.js";

@Controller("guilds/:guildId")
export class GuildConfigController {
    constructor(
        private readonly configs: GuildConfigService,
        private readonly discord: DiscordGuildService,
    ) {}

    @Get("config")
    @RequireGuildRole("VIEWER")
    get(@Param("guildId") guildId: string) {
        return this.configs.get(guildId);
    }

    @Patch("config")
    @RequireGuildRole("ADMIN")
    update(
        @Param("guildId") guildId: string,
        @Body({ schema: guildConfigPatchSchema }) patch: GuildConfigPatch,
        @CurrentUser() auth: AuthContext,
    ) {
        return this.configs.update(guildId, auth.discordId, patch);
    }

    /** Salons et rôles du serveur, pour les listes de choix du panel */
    @Get("discord")
    @RequireGuildRole("VIEWER")
    resources(@Param("guildId") guildId: string) {
        return this.discord.resources(guildId);
    }
}