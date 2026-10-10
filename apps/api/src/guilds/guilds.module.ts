// src/guilds/guilds.module.ts
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { SCHEDULED_QUEUE } from "@phenix/shared";
import { GiveawaysService } from "./giveaways.service.js";
import { GuildConfigController } from "./guild-config.controller.js";
import { GuildConfigService } from "./guild-config.service.js";
import {DiscordGuildService} from "./discord-guild.service.js";

@Module({
    imports: [BullModule.registerQueue({ name: SCHEDULED_QUEUE })],
    controllers: [GuildConfigController],
    providers: [GuildConfigService, GiveawaysService, DiscordGuildService],
})
export class GuildsModule {}