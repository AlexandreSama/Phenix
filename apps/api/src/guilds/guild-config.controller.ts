// src/guilds/guild-config.controller.ts
import { Body, Controller, Param, Patch } from "@nestjs/common";
import { GuildConfigService, type GuildConfigPatch } from "./guild-config.service.js";

@Controller("guilds/:guildId/config")
export class GuildConfigController {
    constructor(private readonly configs: GuildConfigService) {}

    // À protéger dès que l'auth Discord est en place (voir la checklist)
    @Patch()
    update(@Param("guildId") guildId: string, @Body() patch: GuildConfigPatch) {
        return this.configs.update(guildId, null, patch);
    }
}