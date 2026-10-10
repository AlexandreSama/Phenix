// src/guilds/giveaways.service.ts
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { JOBS, SCHEDULED_QUEUE, jobId, type JobData } from "@phenix/shared";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CreateGiveawayInput {
    guildId: string;
    channelId: string;
    prize: string;
    winnersCount: number;
    endsAt: Date;
    createdById: string;
}

@Injectable()
export class GiveawaysService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(SCHEDULED_QUEUE) private readonly queue: Queue,
    ) {}

    async create(input: CreateGiveawayInput) {
        const giveaway = await this.prisma.giveaway.create({ data: input });
        const data: JobData["giveaway-end"] = { giveawayId: giveaway.id };

        // Le bot recevra ce job à endsAt et tirera les gagnants
        await this.queue.add(JOBS.giveawayEnd, data, {
            jobId: jobId(JOBS.giveawayEnd, giveaway.id),
            delay: Math.max(0, giveaway.endsAt.getTime() - Date.now()),
            attempts: 5,
            backoff: { type: "exponential", delay: 10_000 },
            removeOnComplete: true,
        });
        return giveaway;
    }
}