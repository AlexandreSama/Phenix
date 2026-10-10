// apps/api/src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TokenCipher } from "./crypto.js";
import { DiscordService } from "./discord.service.js";
import { GuildAccessService } from "./guild-access.service.js";
import { GuildAccessGuard, SessionGuard } from "./guards.js";
import { MeController } from "./me.controller.js";
import { SessionService } from "./session.service.js";

@Module({
    controllers: [AuthController, MeController],
    providers: [
        {
            provide: TokenCipher,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => new TokenCipher(config.getOrThrow<string>("TOKEN_ENCRYPTION_KEY")),
        },
        DiscordService,
        SessionService,
        AuthService,
        GuildAccessService,
        // Gardes globales, dans cet ordre : session d'abord, rôle sur le serveur ensuite
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: GuildAccessGuard },
    ],
})
export class AuthModule {}