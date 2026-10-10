// apps/api/src/auth/auth.service.ts
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Redis } from "ioredis";
import { redisKeys } from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { randomToken, TokenCipher } from "./crypto.js";
import { DiscordApiError, DiscordService, type DiscordTokens } from "./discord.service.js";
import { SessionService } from "./session.service.js";

const RELOGIN = "Session Discord expirée, reconnectez-vous";

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly discord: DiscordService,
        private readonly sessions: SessionService,
        private readonly cipher: TokenCipher,
        @Inject(REDIS) private readonly redis: Redis,
    ) {}

    /** Étape 1 : prépare l'URL Discord et le state qui protège le retour */
    async startLogin(returnTo: string) {
        const state = randomToken();
        await this.sessions.saveLoginState(state, returnTo);
        return { state, url: this.discord.authorizeUrl(state) };
    }

    /** Étape 2 : Discord a renvoyé un code. On l'échange, on enregistre l'utilisateur, on ouvre une session. */
    async finishLogin(code: string, state: string) {
        const returnTo = await this.sessions.consumeLoginState(state);
        if (returnTo === null) throw new UnauthorizedException("Connexion expirée, recommencez");

        const tokens = await this.discord.exchangeCode(code);
        const profile = await this.discord.getUser(tokens.access_token);
        const data = {
            username: profile.username,
            globalName: profile.global_name,
            avatar: profile.avatar,
            locale: profile.locale ?? null,
            ...this.encryptTokens(tokens),
        };
        const user = await this.prisma.user.upsert({
            where: { discordId: profile.id },
            create: { discordId: profile.id, ...data },
            update: data,
        });

        // La liste des serveurs gérables est relue sur Discord à chaque connexion
        await this.redis.del(redisKeys.managedGuilds(profile.id));
        const sessionToken = await this.sessions.create(user.id);
        return { sessionToken, returnTo };
    }

    /** Token Discord valide pour appeler l'API au nom de l'utilisateur, rafraîchi si besoin */
    async getDiscordAccessToken(userId: string): Promise<string> {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { encryptedAccessToken: true, encryptedRefreshToken: true, tokenExpiresAt: true },
        });
        if (!user.encryptedAccessToken || !user.encryptedRefreshToken) throw new UnauthorizedException(RELOGIN);

        const expiresSoon = !user.tokenExpiresAt || user.tokenExpiresAt.getTime() < Date.now() + 60_000;
        if (!expiresSoon) return this.cipher.decrypt(user.encryptedAccessToken);

        try {
            const tokens = await this.discord.refresh(this.cipher.decrypt(user.encryptedRefreshToken));
            await this.prisma.user.update({ where: { id: userId }, data: this.encryptTokens(tokens) });
            return tokens.access_token;
        } catch (error) {
            // 4xx : refresh token révoqué ou expiré, seule une nouvelle connexion règle le problème
            if (error instanceof DiscordApiError && error.status < 500) throw new UnauthorizedException(RELOGIN);
            throw error;
        }
    }

    logout(sessionToken: string): Promise<void> {
        return this.sessions.destroy(sessionToken);
    }

    private encryptTokens(tokens: DiscordTokens) {
        return {
            encryptedAccessToken: this.cipher.encrypt(tokens.access_token),
            encryptedRefreshToken: this.cipher.encrypt(tokens.refresh_token),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        };
    }
}