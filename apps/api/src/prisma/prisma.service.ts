// src/prisma/prisma.service.ts
import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, createMariaDbAdapter } from "@phenix/database";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
    constructor(config: ConfigService) {
        super({ adapter: createMariaDbAdapter(config.getOrThrow<string>("DATABASE_URL")) });
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}