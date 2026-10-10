// src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { SCHEDULED_QUEUE } from "@phenix/shared";
import { HealthController } from "./health.controller.js";
import { GuildsModule } from "./guilds/guilds.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    // En local : le .env de la racine. En Docker : le fichier n'existe pas, les variables viennent de Compose.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>("REDIS_URL"));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: SCHEDULED_QUEUE }),
    PrismaModule,
    RedisModule,
    StorageModule,
    GuildsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}