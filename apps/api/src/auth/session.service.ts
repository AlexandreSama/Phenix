// apps/api/src/auth/session.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { Redis } from "ioredis";
import { redisKeys } from "@phenix/shared";
import { REDIS } from "../redis/redis.module.js";
import { randomToken, sha256 } from "./crypto.js";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_STATE_TTL_SECONDS = 10 * 60;

export interface Session {
    userId: string;
    createdAt: number;
}

@Injectable()
export class SessionService {
    constructor(@Inject(REDIS) private readonly redis: Redis) {}

    /** Crée une session et renvoie le jeton à placer dans le cookie */
    async create(userId: string): Promise<string> {
        const token = randomToken();
        const session: Session = { userId, createdAt: Date.now() };
        await this.redis.set(redisKeys.session(sha256(token)), JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
        return token;
    }

    async get(token: string): Promise<Session | null> {
        const raw = await this.redis.get(redisKeys.session(sha256(token)));
        return raw ? (JSON.parse(raw) as Session) : null;
    }

    async destroy(token: string): Promise<void> {
        await this.redis.del(redisKeys.session(sha256(token)));
    }

    /** Mémorise le state OAuth2 et la page où revenir après la connexion */
    async saveLoginState(state: string, returnTo: string): Promise<void> {
        await this.redis.set(redisKeys.loginState(state), returnTo, "EX", LOGIN_STATE_TTL_SECONDS);
    }

    /** Usage unique : GETDEL empêche de rejouer un même retour de Discord */
    consumeLoginState(state: string): Promise<string | null> {
        return this.redis.getdel(redisKeys.loginState(state));
    }
}