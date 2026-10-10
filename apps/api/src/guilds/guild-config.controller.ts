// apps/api/src/guilds/guild-config.controller.ts
import { Body, Controller, Param, Patch } from "@nestjs/common";
import { CurrentUser, RequireGuildRole, type AuthContext } from "../auth/decorators.js";
import { GuildConfigService, type GuildConfigPatch } from "./guild-config.service.js";

@Controller("guilds/:guildId/config")
export class GuildConfigController {
    constructor(private readonly configs: GuildConfigService) {}

    @Patch()
    @RequireGuildRole("ADMIN")
    update(
        @Param("guildId") guildId: string,
        @Body() patch: GuildConfigPatch,
        @CurrentUser() auth: AuthContext,
    ) {
        return this.configs.update(guildId, auth.discordId, patch);
    }
}