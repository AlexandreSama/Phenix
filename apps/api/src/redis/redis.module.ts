// src/redis/redis.module.ts
import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

/** Jeton d'injection du client Redis partagé (publication, cache) */
export const REDIS = Symbol("REDIS");

@Global()
@Module({
    providers: [
        {
            provide: REDIS,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>("REDIS_URL")),
        },
    ],
    exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
    constructor(@Inject(REDIS) private readonly redis: Redis) {}

    onModuleDestroy() {
        this.redis.disconnect();
    }
}