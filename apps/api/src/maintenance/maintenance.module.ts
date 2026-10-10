import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MAINTENANCE_QUEUE } from "@phenix/shared";
import { MaintenanceProcessor } from "./maintenance.processor.js";
import { RetentionService } from "./retention.service.js";

@Module({
    imports: [BullModule.registerQueue({ name: MAINTENANCE_QUEUE })],
    providers: [RetentionService, MaintenanceProcessor],
})
export class MaintenanceModule {}