-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `discordId` VARCHAR(20) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `globalName` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `locale` VARCHAR(10) NULL,
    `platformRole` ENUM('USER', 'DEVELOPER') NOT NULL DEFAULT 'USER',
    `encryptedAccessToken` TEXT NULL,
    `encryptedRefreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_discordId_key`(`discordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guild` (
    `id` VARCHAR(20) NOT NULL,
    `name` VARCHAR(191) NULL,
    `iconHash` VARCHAR(191) NULL,
    `ownerId` VARCHAR(20) NULL,
    `memberCount` INTEGER NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildConfig` (
    `guildId` VARCHAR(20) NOT NULL,
    `language` VARCHAR(10) NULL,
    `welcomeChannelId` VARCHAR(20) NULL,
    `goodbyeChannelId` VARCHAR(20) NULL,
    `logsChannelId` VARCHAR(20) NULL,
    `activityChannelId` VARCHAR(20) NULL,
    `giveawayChannelId` VARCHAR(20) NULL,
    `raidChannelId` VARCHAR(20) NULL,
    `incursionChannelId` VARCHAR(20) NULL,
    `raidVocalCategoryId` VARCHAR(20) NULL,
    `ticketCategoryId` VARCHAR(20) NULL,
    `ticketStaffRoleId` VARCHAR(20) NULL,
    `enableWelcome` BOOLEAN NOT NULL DEFAULT true,
    `enableModeration` BOOLEAN NOT NULL DEFAULT true,
    `enableLevels` BOOLEAN NOT NULL DEFAULT true,
    `enableGiveaways` BOOLEAN NOT NULL DEFAULT true,
    `enableTd2` BOOLEAN NOT NULL DEFAULT false,
    `td2StrikeThreshold` INTEGER NOT NULL DEFAULT 3,
    `lastCaseId` INTEGER NOT NULL DEFAULT 0,
    `lastTicketNumber` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`guildId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildPanelAccess` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `role` ENUM('ADMIN', 'MODERATOR', 'VIEWER') NOT NULL,
    `createdById` VARCHAR(20) NOT NULL,
    `updatedById` VARCHAR(20) NULL,
    `revokedAt` DATETIME(3) NULL,
    `memberValidUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuildPanelAccess_guildId_revokedAt_idx`(`guildId`, `revokedAt`),
    INDEX `GuildPanelAccess_userId_revokedAt_idx`(`userId`, `revokedAt`),
    UNIQUE INDEX `GuildPanelAccess_guildId_userId_key`(`guildId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PanelAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `actorId` VARCHAR(20) NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `changes` JSON NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PanelAuditLog_guildId_createdAt_idx`(`guildId`, `createdAt`),
    INDEX `PanelAuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `PanelAuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoredFile` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `purpose` ENUM('TICKET_TRANSCRIPT', 'PANEL_IMAGE') NOT NULL,
    `bucket` VARCHAR(63) NOT NULL,
    `objectKey` VARCHAR(512) NOT NULL,
    `contentType` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` CHAR(64) NULL,
    `uploadedById` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `StoredFile_guildId_purpose_deletedAt_idx`(`guildId`, `purpose`, `deletedAt`),
    UNIQUE INDEX `StoredFile_bucket_objectKey_key`(`bucket`, `objectKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildStaffRole` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `roleId` VARCHAR(20) NOT NULL,
    `type` ENUM('ADMIN', 'MODERATOR') NOT NULL DEFAULT 'MODERATOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuildStaffRole_guildId_roleId_key`(`guildId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildJoinRole` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `roleId` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GuildJoinRole_guildId_roleId_key`(`guildId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutoRole` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `roleId` VARCHAR(20) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `label` VARCHAR(191) NULL,
    `emoji` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AutoRole_guildId_enabled_idx`(`guildId`, `enabled`),
    UNIQUE INDEX `AutoRole_guildId_roleId_key`(`guildId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModerationAction` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `caseId` INTEGER NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `moderatorId` VARCHAR(20) NOT NULL,
    `action` ENUM('BAN', 'UNBAN', 'MUTE', 'UNMUTE', 'KICK', 'WARN', 'TIMEOUT', 'OTHER') NOT NULL,
    `reason` TEXT NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `clearedAt` DATETIME(3) NULL,
    `clearedById` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModerationAction_guildId_userId_createdAt_idx`(`guildId`, `userId`, `createdAt`),
    UNIQUE INDEX `ModerationAction_guildId_caseId_key`(`guildId`, `caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildBan` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `actionId` VARCHAR(191) NULL,
    `liftedAt` DATETIME(3) NULL,
    `liftedById` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuildBan_actionId_key`(`actionId`),
    INDEX `GuildBan_guildId_userId_liftedAt_idx`(`guildId`, `userId`, `liftedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildMute` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `actionId` VARCHAR(191) NULL,
    `liftedAt` DATETIME(3) NULL,
    `liftedById` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuildMute_actionId_key`(`actionId`),
    INDEX `GuildMute_guildId_userId_liftedAt_idx`(`guildId`, `userId`, `liftedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildLevel` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `totalXp` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuildLevel_guildId_totalXp_idx`(`guildId`, `totalXp`),
    INDEX `GuildLevel_userId_idx`(`userId`),
    UNIQUE INDEX `GuildLevel_guildId_userId_key`(`guildId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LevelRewardRole` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `level` INTEGER NOT NULL,
    `roleId` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LevelRewardRole_guildId_level_idx`(`guildId`, `level`),
    UNIQUE INDEX `LevelRewardRole_guildId_roleId_key`(`guildId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LevelIgnoredChannel` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `channelId` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LevelIgnoredChannel_guildId_channelId_key`(`guildId`, `channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Td2Event` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `type` ENUM('RAID', 'INCURSION') NOT NULL,
    `raidType` ENUM('NORMAL', 'SEMI_SPEED') NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `title` VARCHAR(191) NOT NULL,
    `zone` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `notifiedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(20) NOT NULL,
    `channelId` VARCHAR(20) NULL,
    `threadId` VARCHAR(20) NULL,
    `messageId` VARCHAR(20) NULL,
    `playersLimit` INTEGER NOT NULL DEFAULT 8,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Td2Event_guildId_status_startsAt_idx`(`guildId`, `status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Td2Participant` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `username` VARCHAR(191) NULL,
    `role` ENUM('DPS', 'HEAL', 'TANK') NULL,
    `status` ENUM('CONFIRMED', 'WAITING', 'SUBSTITUTE', 'SPECTATOR', 'ABSENT', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Td2Participant_eventId_status_createdAt_idx`(`eventId`, `status`, `createdAt`),
    INDEX `Td2Participant_userId_idx`(`userId`),
    UNIQUE INDEX `Td2Participant_eventId_userId_key`(`eventId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Td2Blacklist` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `strikeCount` INTEGER NOT NULL DEFAULT 0,
    `blacklistedAt` DATETIME(3) NULL,
    `blacklistedById` VARCHAR(20) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Td2Blacklist_userId_idx`(`userId`),
    UNIQUE INDEX `Td2Blacklist_guildId_userId_key`(`guildId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Td2BlacklistLog` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `actorId` VARCHAR(20) NOT NULL,
    `action` ENUM('STRIKE_ADD', 'STRIKE_REMOVE', 'BLACKLIST_ON', 'BLACKLIST_OFF', 'REASON_SET') NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Td2BlacklistLog_guildId_userId_createdAt_idx`(`guildId`, `userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Giveaway` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `channelId` VARCHAR(20) NOT NULL,
    `messageId` VARCHAR(20) NULL,
    `prize` VARCHAR(256) NOT NULL,
    `winnersCount` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('RUNNING', 'ENDED', 'CANCELLED') NOT NULL DEFAULT 'RUNNING',
    `endsAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Giveaway_messageId_key`(`messageId`),
    INDEX `Giveaway_guildId_status_endsAt_idx`(`guildId`, `status`, `endsAt`),
    INDEX `Giveaway_channelId_idx`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiveawayEntry` (
    `id` VARCHAR(191) NOT NULL,
    `giveawayId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `wonAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiveawayEntry_giveawayId_wonAt_idx`(`giveawayId`, `wonAt`),
    INDEX `GiveawayEntry_userId_idx`(`userId`),
    UNIQUE INDEX `GiveawayEntry_giveawayId_userId_key`(`giveawayId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `number` INTEGER NOT NULL,
    `channelId` VARCHAR(20) NOT NULL,
    `userId` VARCHAR(20) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `claimedById` VARCHAR(20) NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` VARCHAR(20) NULL,
    `closeReason` TEXT NULL,
    `transcriptFileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ticket_channelId_key`(`channelId`),
    UNIQUE INDEX `Ticket_transcriptFileId_key`(`transcriptFileId`),
    INDEX `Ticket_guildId_userId_status_idx`(`guildId`, `userId`, `status`),
    UNIQUE INDEX `Ticket_guildId_number_key`(`guildId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuildBotEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guildId` VARCHAR(20) NOT NULL,
    `type` ENUM('JOINED', 'LEFT') NOT NULL,
    `memberCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GuildBotEvent_guildId_createdAt_idx`(`guildId`, `createdAt`),
    INDEX `GuildBotEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InteractionEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guildId` VARCHAR(20) NULL,
    `userId` VARCHAR(20) NOT NULL,
    `kind` ENUM('SLASH_COMMAND', 'CONTEXT_MENU', 'BUTTON', 'SELECT_MENU', 'MODAL') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `subcommand` VARCHAR(100) NULL,
    `success` BOOLEAN NOT NULL,
    `errorCode` VARCHAR(64) NULL,
    `durationMs` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InteractionEvent_createdAt_idx`(`createdAt`),
    INDEX `InteractionEvent_guildId_createdAt_idx`(`guildId`, `createdAt`),
    INDEX `InteractionEvent_name_createdAt_idx`(`name`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyMetric` (
    `date` DATE NOT NULL,
    `guildId` VARCHAR(20) NOT NULL,
    `metric` VARCHAR(64) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyMetric_guildId_date_idx`(`guildId`, `date`),
    INDEX `DailyMetric_metric_date_idx`(`metric`, `date`),
    PRIMARY KEY (`date`, `guildId`, `metric`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceMetricSample` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service` ENUM('BOT', 'API', 'WEB') NOT NULL,
    `instanceId` VARCHAR(64) NOT NULL,
    `uptimeSec` INTEGER NOT NULL,
    `rssMb` INTEGER NOT NULL,
    `heapUsedMb` INTEGER NOT NULL,
    `cpuPercent` DOUBLE NULL,
    `eventLoopLagMs` DOUBLE NULL,
    `wsPingMs` INTEGER NULL,
    `guildCount` INTEGER NULL,
    `requestCount` INTEGER NULL,
    `errorCount` INTEGER NULL,
    `p95LatencyMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceMetricSample_service_createdAt_idx`(`service`, `createdAt`),
    INDEX `ServiceMetricSample_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ErrorEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service` ENUM('BOT', 'API', 'WEB') NOT NULL,
    `instanceId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `message` TEXT NOT NULL,
    `stack` TEXT NULL,
    `context` JSON NULL,
    `guildId` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ErrorEvent_fingerprint_createdAt_idx`(`fingerprint`, `createdAt`),
    INDEX `ErrorEvent_service_createdAt_idx`(`service`, `createdAt`),
    INDEX `ErrorEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GuildConfig` ADD CONSTRAINT `GuildConfig_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildPanelAccess` ADD CONSTRAINT `GuildPanelAccess_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PanelAuditLog` ADD CONSTRAINT `PanelAuditLog_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredFile` ADD CONSTRAINT `StoredFile_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildStaffRole` ADD CONSTRAINT `GuildStaffRole_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildJoinRole` ADD CONSTRAINT `GuildJoinRole_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoRole` ADD CONSTRAINT `AutoRole_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationAction` ADD CONSTRAINT `ModerationAction_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildBan` ADD CONSTRAINT `GuildBan_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildBan` ADD CONSTRAINT `GuildBan_actionId_fkey` FOREIGN KEY (`actionId`) REFERENCES `ModerationAction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildMute` ADD CONSTRAINT `GuildMute_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildMute` ADD CONSTRAINT `GuildMute_actionId_fkey` FOREIGN KEY (`actionId`) REFERENCES `ModerationAction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildLevel` ADD CONSTRAINT `GuildLevel_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LevelRewardRole` ADD CONSTRAINT `LevelRewardRole_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LevelIgnoredChannel` ADD CONSTRAINT `LevelIgnoredChannel_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Td2Event` ADD CONSTRAINT `Td2Event_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Td2Participant` ADD CONSTRAINT `Td2Participant_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Td2Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Td2Blacklist` ADD CONSTRAINT `Td2Blacklist_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Td2BlacklistLog` ADD CONSTRAINT `Td2BlacklistLog_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Giveaway` ADD CONSTRAINT `Giveaway_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiveawayEntry` ADD CONSTRAINT `GiveawayEntry_giveawayId_fkey` FOREIGN KEY (`giveawayId`) REFERENCES `Giveaway`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_transcriptFileId_fkey` FOREIGN KEY (`transcriptFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuildBotEvent` ADD CONSTRAINT `GuildBotEvent_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
