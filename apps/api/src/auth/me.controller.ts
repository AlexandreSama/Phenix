// apps/api/src/auth/me.controller.ts
import { Controller, Get } from "@nestjs/common";
import type { MeResponse, PanelGuild } from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { CurrentUser, type AuthContext } from "./decorators.js";
import { GuildAccessService } from "./guild-access.service.js";

@Controller("me")
export class MeController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: GuildAccessService,
    ) {}

    @Get()
    async me(@CurrentUser() auth: AuthContext): Promise<MeResponse> {
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
        return {
            id: user.discordId,
            username: user.username,
            globalName: user.globalName,
            avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : null,
            platformRole: user.platformRole,
        };
    }

    @Get("guilds")
    guilds(@CurrentUser() auth: AuthContext): Promise<PanelGuild[]> {
        return this.access.listForUser(auth);
    }
}