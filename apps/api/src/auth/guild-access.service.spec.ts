import type { Redis } from "ioredis";
import { redisKeys } from "@phenix/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { AuthService } from "./auth.service.js";
import type { AuthContext } from "./decorators.js";
import { DiscordService, type DiscordPartialGuild } from "./discord.service.js";
import { GuildAccessService } from "./guild-access.service.js";

const ADMINISTRATOR = String(1n << 3n);
const MANAGE_GUILD = String(1n << 5n);
const AUTH: AuthContext = { userId: "u1", discordId: "999", platformRole: "USER" };

function partialGuild(id: string, overrides: Partial<DiscordPartialGuild> = {}): DiscordPartialGuild {
    return { id, name: `Serveur ${id}`, icon: null, owner: false, permissions: "0", ...overrides };
}

function setup({
    discordGuilds = [] as DiscordPartialGuild[],
    grant = null as { role: string; revokedAt: Date | null } | null,
    cached = null as string | null,
} = {}) {
    const redis = { get: vi.fn().mockResolvedValue(cached), set: vi.fn() };
    const discord = { getGuilds: vi.fn().mockResolvedValue(discordGuilds) };
    const auth = { getDiscordAccessToken: vi.fn().mockResolvedValue("access-token") };
    const prisma = { guildPanelAccess: { findUnique: vi.fn().mockResolvedValue(grant) } };
    const service = new GuildAccessService(
        prisma as unknown as PrismaService,
        auth as unknown as AuthService,
        discord as unknown as DiscordService,
        redis as unknown as Redis,
    );
    return { service, redis, discord, prisma };
}

describe("DiscordService.canManage", () => {
    it("accepte le propriétaire, « Administrateur » et « Gérer le serveur »", () => {
        expect(DiscordService.canManage(partialGuild("1", { owner: true }))).toBe(true);
        expect(DiscordService.canManage(partialGuild("1", { permissions: ADMINISTRATOR }))).toBe(true);
        expect(DiscordService.canManage(partialGuild("1", { permissions: MANAGE_GUILD }))).toBe(true);
        expect(DiscordService.canManage(partialGuild("1", { permissions: String(1n << 10n) }))).toBe(false);
    });
});

describe("GuildAccessService", () => {
    it("ne garde que les serveurs gérables et les met en cache 5 min", async () => {
        const { service, redis } = setup({
            discordGuilds: [partialGuild("1", { owner: true }), partialGuild("2")],
        });

        const managed = await service.managedGuilds(AUTH);

        expect(managed).toEqual([{ id: "1", name: "Serveur 1", icon: null }]);
        expect(redis.set).toHaveBeenCalledWith(redisKeys.managedGuilds("999"), JSON.stringify(managed), "EX", 300);
    });

    it("lit le cache sans appeler Discord", async () => {
        const cached = JSON.stringify([{ id: "1", name: "Serveur 1", icon: null }]);
        const { service, discord } = setup({ cached });

        expect(await service.managedGuilds(AUTH)).toEqual(JSON.parse(cached));
        expect(discord.getGuilds).not.toHaveBeenCalled();
    });

    describe("roleFor", () => {
        it("donne ADMIN partout à un développeur Phenix, sans appeler Discord", async () => {
            const { service, discord } = setup();
            expect(await service.roleFor({ ...AUTH, platformRole: "DEVELOPER" }, "1")).toBe("ADMIN");
            expect(discord.getGuilds).not.toHaveBeenCalled();
        });

        it("donne ADMIN à qui gère le serveur sur Discord, même avec un accès plus faible dans le panel", async () => {
            const { service } = setup({
                discordGuilds: [partialGuild("1", { permissions: MANAGE_GUILD })],
                grant: { role: "VIEWER", revokedAt: null },
            });
            expect(await service.roleFor(AUTH, "1")).toBe("ADMIN");
        });

        it("utilise l'accès donné dans le panel", async () => {
            const { service, prisma } = setup({ grant: { role: "MODERATOR", revokedAt: null } });
            expect(await service.roleFor(AUTH, "1")).toBe("MODERATOR");
            expect(prisma.guildPanelAccess.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { guildId_userId: { guildId: "1", userId: "999" } } }),
            );
        });

        it("ignore un accès révoqué", async () => {
            const { service } = setup({ grant: { role: "ADMIN", revokedAt: new Date() } });
            expect(await service.roleFor(AUTH, "1")).toBeNull();
        });

        it("renvoie null sans aucun accès", async () => {
            const { service } = setup();
            expect(await service.roleFor(AUTH, "1")).toBeNull();
        });
    });
});
